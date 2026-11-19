// Ponte entre o front-end e o back-end real (src/scheduler.ts, na raiz do projeto).
//
// A ponte executa o back-end como no terminal (`tsx src/scheduler.ts <modo> <arquivo.asm>...`),
// alimenta o stdin com as entradas e lê o stdout. O único ajuste no back-end é o trace por
// instrução, ligado pela variável SCHEDULER_TRACE=1 (ver processRunStep em src/scheduler.ts).

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

// Modos aceitos pelo `main()` do back-end (ver `valid` em src/scheduler.ts).
const MODES = ['fifo', 'round_robin', 'sjf', 'strf', 'priority', 'custom'] as const;
export type SchedulerMode = (typeof MODES)[number];

const MAX_PROCESSES = 6; // limite do front: as cores da paleta.
const MAX_SOURCE_BYTES = 16 * 1024;
const MAX_INPUTS = 100;
const MAX_BODY_BYTES = 128 * 1024;
const TIMEOUT_MS = 5000; // programa que passa disso provavelmente tem laço infinito.
const MAX_STDOUT_CHARS = 2_000_000; // com o trace, um laço infinito enche a saída muito rápido.

// Texto exato que o back-end imprime ao pedir uma entrada (rl.question, sem quebra de linha).
const INPUT_PROMPT = /requesting input for r\d+ = /g;

interface Paths {
  repo: string;
  scheduler: string;
  tests: string;
  tsxCli: string;
}

export interface ProgramInfo {
  id: string;
  file: string;
  source: string;
  hasCode: boolean;
}

export interface RunRequest {
  mode: SchedulerMode;
  quantum: number;
  processes: { source: string }[];
  inputs: string[];
}

const MAX_QUANTUM = 20;

export interface SchedulerEvent {
  order: number;
  kind: 'input' | 'print' | 'exit' | 'preempt';
  process: number;
  value: string | null;
  // Registrador usado pela entrada/print (ex.: 2 para `print r2`); null no fim do processo.
  register: number | null;
  // Instante (tick) da instrução INPUT/PRINT (ou da última instrução, no fim) do processo.
  tick: number | null;
}

// Uma instrução executada pela CPU: 1 instante de tempo.
export interface TickInfo {
  tick: number;
  process: number;
  opcode: string;
}

export interface ProcessSummary {
  id: number;
  prints: string[];
  requestedInput: number;
  preemptions: number;
  exitOrder: number | null;
  averageQuantum: number | null;
}

export type RunStatus = 'ok' | 'error' | 'missing_input' | 'timeout';

export interface RunResult {
  status: RunStatus;
  message: string | null;
  mode: SchedulerMode;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  inputsUsed: string[];
  totalTicks: number;
  ticks: TickInfo[];
  events: SchedulerEvent[];
  processes: ProcessSummary[];
}

function resolvePaths(frontendDir: string): Paths {
  const repo = path.resolve(frontendDir, '..');
  // O tsx é a dependência de desenvolvimento do próprio front-end (ver package.json).
  const requireFromFrontend = createRequire(path.join(frontendDir, 'package.json'));
  return {
    repo,
    scheduler: path.join(repo, 'src', 'scheduler.ts'),
    tests: path.join(repo, 'tests'),
    tsxCli: requireFromFrontend.resolve('tsx/cli'),
  };
}

// Um programa "tem código" se sobra alguma linha depois de tirar comentários e espaços.
// Arquivos só com comentário (ex.: TODO) são recusados pelo back-end com erro.
function hasInstructions(source: string): boolean {
  return source.split(/\r?\n/).some((line) => line.replace(/;.*/, '').trim() !== '');
}

function listPrograms(paths: Paths): ProgramInfo[] {
  return fs
    .readdirSync(paths.tests)
    .filter((file) => file.endsWith('.asm'))
    .sort()
    .map((file) => {
      const source = fs.readFileSync(path.join(paths.tests, file), 'utf8');
      return { id: file.slice(0, -'.asm'.length), file, source, hasCode: hasInstructions(source) };
    });
}

function countPrompts(text: string): number {
  return (text.match(INPUT_PROMPT) ?? []).length;
}

// Quebra a saída em eventos, na ordem em que aparecem no stdout.
// Os padrões são exatamente os textos que src/scheduler.ts imprime.
// Cada linha `trace <instante> <processo> <opcode>` é uma instrução executada (SCHEDULER_TRACE=1).
// Um evento (entrada, print, fim) pertence ao instante da última instrução executada antes dele.
function parseOutput(stdout: string, inputs: string[]): {
  events: SchedulerEvent[];
  quantums: Map<number, number>;
  ticks: TickInfo[];
} {
  const patterns: { kind: 'input' | 'print' | 'exit' | 'preempt' | 'quantum' | 'trace'; re: RegExp }[] = [
    { kind: 'trace', re: /trace (\d+) (\d+) (\w+)\n/g },
    { kind: 'input', re: /process (\d+) requesting input for r(\d+) = /g },
    { kind: 'print', re: /process (\d+) print r(\d+) = (\S+)/g },
    { kind: 'exit', re: /process (\d+) exitedQueue\.\.\./g },
    { kind: 'preempt', re: /process (\d+) preempted/g },
    { kind: 'quantum', re: /process (\d+) average quantum used: (\S+)/g },
  ];

  type Found = { index: number; kind: (typeof patterns)[number]['kind']; a: number; b: string | null; c: string | null };
  const found: Found[] = [];
  for (const { kind, re } of patterns) {
    for (const match of stdout.matchAll(re)) {
      if (kind === 'trace') {
        found.push({ index: match.index ?? 0, kind, a: Number(match[1]), b: match[2] ?? null, c: match[3] ?? null });
      } else {
        // Para input/print, b é o registrador e c o valor impresso (só em print).
        found.push({ index: match.index ?? 0, kind, a: Number(match[1]), b: match[2] ?? null, c: match[3] ?? null });
      }
    }
  }
  found.sort((x, y) => x.index - y.index);

  // O back-end imprime entrada e print depois da rodada (no syscall), então o instante de cada
  // um é o da instrução INPUT/PRINT do próprio processo, na mesma ordem em que ele as executou.
  const syscallTicks = new Map<number, number[]>();
  const lastTickOf = new Map<number, number>();

  const events: SchedulerEvent[] = [];
  const quantums = new Map<number, number>();
  const ticks: TickInfo[] = [];
  let inputCursor = 0;
  for (const item of found) {
    if (item.kind === 'trace') {
      const process = Number(item.b);
      ticks.push({ tick: item.a, process, opcode: item.c ?? '' });
      lastTickOf.set(process, item.a);
      if (item.c === 'INPUT' || item.c === 'PRINT') {
        syscallTicks.set(process, [...(syscallTicks.get(process) ?? []), item.a]);
      }
      continue;
    }
    if (item.kind === 'quantum') {
      quantums.set(item.a, Number(item.b));
      continue;
    }
    if (item.kind === 'exit' || item.kind === 'preempt') {
      // Fim e preempção acontecem logo após a última instrução executada pelo processo.
      events.push({ order: events.length + 1, kind: item.kind, process: item.a, value: null, register: null, tick: lastTickOf.get(item.a) ?? null });
      continue;
    }
    // input ou print: consome a próxima instrução de syscall desse processo.
    const queue = syscallTicks.get(item.a) ?? [];
    const tick = queue.shift() ?? null;
    syscallTicks.set(item.a, queue);
    if (item.kind === 'input') {
      // Cada pedido de entrada recebe o próximo valor enviado pelo usuário.
      events.push({ order: events.length + 1, kind: 'input', process: item.a, value: inputs[inputCursor] ?? null, register: Number(item.b), tick });
      inputCursor++;
    } else {
      events.push({ order: events.length + 1, kind: 'print', process: item.a, value: item.c, register: Number(item.b), tick });
    }
  }
  return { events, quantums, ticks };
}

// Remove só as linhas de trace (que são nossas) da saída mostrada no Console.
function stripTrace(stdout: string): string {
  return stdout.replace(/trace \d+ \d+ \w+\n/g, '');
}

// A primeira linha de erro útil do stderr (erro do montador ou exceção do simulador).
function pickErrorLine(stderr: string): string {
  const lines = stderr.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return (
    lines.find((line) => /Error|Cannot|Unknown|Invalid|Division|out of bounds|No such|Usage/.test(line)) ??
    lines[0] ??
    'O back-end terminou com erro.'
  );
}

function runScheduler(request: RunRequest, paths: Paths): Promise<RunResult> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'escalonador-'));
  const files = request.processes.map((proc, index) => {
    const file = path.join(dir, `P${index}.asm`);
    fs.writeFileSync(file, proc.source, 'utf8');
    return file;
  });

  return new Promise<RunResult>((resolve) => {
    // SCHEDULER_TRACE=1 liga o trace por instrução no back-end (sem ele, a saída é a original).
    const child = spawn(process.execPath, [paths.tsxCli, paths.scheduler, request.mode, ...files], {
      cwd: paths.repo,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, SCHEDULER_TRACE: '1', SCHEDULER_QUANTUM: String(request.quantum) },
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let tooLong = false;
    let finished = false;
    let inputClosed = false;
    const pending = [...request.inputs];
    const consumed: string[] = [];

    const closeInput = () => {
      if (inputClosed) return;
      inputClosed = true;
      child.stdin.end();
    };

    // Um valor por pedido: o readline do back-end perde linhas que chegam antes do
    // rl.question, então só enviamos a próxima entrada depois de ver o prompt.
    const feedInputs = () => {
      while (countPrompts(stdout) > consumed.length) {
        const value = pending.shift();
        if (value === undefined) {
          closeInput();
          return;
        }
        consumed.push(value);
        child.stdin.write(`${value}\n`);
        if (pending.length === 0) closeInput();
      }
    };

    child.stdin.on('error', () => undefined); // o processo pode fechar antes da escrita
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (stdout.length > MAX_STDOUT_CHARS && !tooLong) {
        tooLong = true;
        child.kill();
        return;
      }
      feedInputs();
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    // Sem entradas, o stdin fica fechado: o back-end não trava esperando digitação.
    if (request.inputs.length === 0) closeInput();

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, TIMEOUT_MS);

    const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });

    const finish = (exitCode: number | null, spawnError?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup();

      const { events, quantums, ticks } = parseOutput(stdout, consumed);
      const promptsAsked = countPrompts(stdout);
      const processes: ProcessSummary[] = request.processes.map((_, id) => {
        const exits = events.filter((e) => e.kind === 'exit');
        const exitIndex = exits.findIndex((e) => e.process === id);
        return {
          id,
          prints: events.filter((e) => e.kind === 'print' && e.process === id).map((e) => e.value ?? ''),
          requestedInput: events.filter((e) => e.kind === 'input' && e.process === id).length,
          preemptions: events.filter((e) => e.kind === 'preempt' && e.process === id).length,
          exitOrder: exitIndex === -1 ? null : exitIndex + 1,
          averageQuantum: quantums.has(id) ? quantums.get(id) ?? null : null,
        };
      });

      let status: RunStatus = 'ok';
      let message: string | null = null;
      if (spawnError) {
        status = 'error';
        message = spawnError.message;
      } else if (tooLong) {
        status = 'timeout';
        message = 'O programa gerou saída demais. Provavelmente há um laço infinito.';
      } else if (timedOut) {
        status = 'timeout';
        message = `O programa passou de ${TIMEOUT_MS / 1000} segundos sem terminar. Provavelmente há um laço infinito.`;
      } else if (promptsAsked > consumed.length) {
        status = 'missing_input';
        message = 'Um processo pediu uma entrada que não foi informada. Acrescente valores em "Entradas".';
      } else if (exitCode !== 0) {
        status = 'error';
        message = pickErrorLine(stderr);
      }

      resolve({
        status,
        message,
        mode: request.mode,
        exitCode,
        stdout: stripTrace(stdout),
        stderr,
        inputsUsed: consumed,
        totalTicks: ticks.length,
        ticks,
        events,
        processes,
      });
    };

    child.on('error', (error) => finish(null, error));
    child.on('close', (code) => finish(code));
  });
}

// Validação do pedido: o back-end já valida o assembly; aqui só protegemos a ponte.
function parseRunRequest(body: unknown): { ok: true; value: RunRequest } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') return { ok: false, message: 'Envie um objeto JSON.' };
  const data = body as Record<string, unknown>;

  if (typeof data.mode !== 'string' || !(MODES as readonly string[]).includes(data.mode)) {
    return { ok: false, message: 'Escolha um modo de escalonamento da lista.' };
  }

  if (!Array.isArray(data.processes) || data.processes.length === 0) {
    return { ok: false, message: 'Adicione pelo menos um processo.' };
  }
  if (data.processes.length > MAX_PROCESSES) {
    return { ok: false, message: `Use no máximo ${MAX_PROCESSES} processos.` };
  }
  const processes: { source: string }[] = [];
  for (const item of data.processes) {
    const source = typeof item === 'object' && item !== null ? (item as { source?: unknown }).source : undefined;
    if (typeof source !== 'string' || source.trim() === '') {
      return { ok: false, message: 'Cada processo precisa de um código assembly.' };
    }
    if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
      return { ok: false, message: 'Um dos programas é grande demais.' };
    }
    processes.push({ source });
  }

  const rawInputs = data.inputs ?? [];
  if (!Array.isArray(rawInputs) || rawInputs.length > MAX_INPUTS) {
    return { ok: false, message: `Use no máximo ${MAX_INPUTS} entradas.` };
  }
  const inputs: string[] = [];
  for (const value of rawInputs) {
    if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) {
      return { ok: false, message: `Entrada inválida: "${String(value)}". Use apenas números inteiros.` };
    }
    inputs.push(value.trim());
  }

  const quantum = data.quantum;
  if (typeof quantum !== 'number' || !Number.isInteger(quantum) || quantum < 1 || quantum > MAX_QUANTUM) {
    return { ok: false, message: `O quantum deve ser um inteiro entre 1 e ${MAX_QUANTUM}.` };
  }

  return { ok: true, value: { mode: data.mode as SchedulerMode, quantum, processes, inputs } };
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

export function schedulerBridge(options: { frontendDir: string }): Plugin {
  const paths = resolvePaths(options.frontendDir);

  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const route = (req.url ?? '/').split('?')[0];

    if (req.method === 'GET' && route === '/programs') {
      sendJson(res, 200, { programs: listPrograms(paths), modes: MODES });
      return;
    }

    if (req.method === 'POST' && route === '/run') {
      readJsonBody(req)
        .then(async (body) => {
          const parsed = parseRunRequest(body);
          if (!parsed.ok) {
            sendJson(res, 422, { status: 'invalid', message: parsed.message });
            return;
          }
          const result = await runScheduler(parsed.value, paths);
          sendJson(res, 200, result);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Erro inesperado na ponte.';
          sendJson(res, 400, { status: 'invalid', message: 'O corpo da requisição não é um JSON válido.', detail: message });
        });
      return;
    }

    next();
  };

  return {
    name: 'scheduler-bridge',
    configureServer(server) {
      server.middlewares.use('/api', middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api', middleware);
    },
  };
}
