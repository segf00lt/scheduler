import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import {
  DEFAULT_BLOCKING_DURATION,
  DEFAULT_PREEMPTION_DURATION,
  hasInstructions,
  MAX_INSTRUCTIONS,
  MAX_EVENT_DURATION,
  MAX_PROCESSES,
  MAX_QUANTUM,
  MIN_EVENT_DURATION,
  MIN_QUANTUM,
  runScheduler,
  SCHEDULER_MODES,
  type ProcessSummary,
  type ProcessState,
  type ProgramInfo,
  type RunRequest,
  type RunResult,
  type SchedulerEvent,
  type SchedulerMode,
  type TickInfo,
} from '../../back/scheduler.js';

const MAX_SOURCE_BYTES = 16 * 1024;
const MAX_BODY_BYTES = 128 * 1024;
const RUN_TIMEOUT_MS = 60_000;

interface WaitingInput { process: number; register: number }
interface Session {
  id: string;
  request: RunRequest;
  fullOutput: string;
  ticks: TickInfo[];
  events: SchedulerEvent[];
  inputsUsed: string[];
  waitingInput: WaitingInput | null;
  resolveInput: ((value: string) => void) | null;
  status: 'running' | 'done';
  result: RunResult | null;
  timer: ReturnType<typeof setTimeout>;
}

const sessions = new Map<string, Session>();

function listPrograms(repoDir: string): ProgramInfo[] {
  const testsDir = path.join(repoDir, 'tests');
  return fs.readdirSync(testsDir).filter((file) => file.endsWith('.asm')).sort().map((file) => {
    const source = fs.readFileSync(path.join(testsDir, file), 'utf8');
    return { id: file.slice(0, -4), file, source, hasCode: hasInstructions(source) };
  });
}

function parseRunRequest(body: unknown): { ok: true; value: RunRequest } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') return { ok: false, message: 'Envie um objeto JSON.' };
  const data = body as Record<string, unknown>;
  if (typeof data.mode !== 'string' || !SCHEDULER_MODES.includes(data.mode as SchedulerMode)) return { ok: false, message: 'Escolha um modo de escalonamento da lista.' };
  if (!Array.isArray(data.processes) || data.processes.length === 0 || data.processes.length > MAX_PROCESSES) {
    return { ok: false, message: `Adicione de 1 a ${MAX_PROCESSES} processos.` };
  }
  const processes: { source: string }[] = [];
  for (const item of data.processes) {
    const source = typeof item === 'object' && item !== null ? (item as { source?: unknown }).source : undefined;
    if (typeof source !== 'string' || source.trim() === '') return { ok: false, message: 'Cada processo precisa de código assembly.' };
    if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) return { ok: false, message: 'Um dos programas é grande demais.' };
    processes.push({ source });
  }
  if (typeof data.quantum !== 'number' || !Number.isInteger(data.quantum) || data.quantum < MIN_QUANTUM || data.quantum > MAX_QUANTUM) {
    return { ok: false, message: `O quantum deve ser um inteiro entre ${MIN_QUANTUM} e ${MAX_QUANTUM}.` };
  }
  const blockingDuration = data.blockingDuration ?? DEFAULT_BLOCKING_DURATION;
  const preemptionDuration = data.preemptionDuration ?? DEFAULT_PREEMPTION_DURATION;
  if (typeof blockingDuration !== 'number' || !Number.isInteger(blockingDuration) || blockingDuration < MIN_EVENT_DURATION || blockingDuration > MAX_EVENT_DURATION) {
    return { ok: false, message: `A duração de bloqueio deve ser um inteiro entre ${MIN_EVENT_DURATION} e ${MAX_EVENT_DURATION}.` };
  }
  if (typeof preemptionDuration !== 'number' || !Number.isInteger(preemptionDuration) || preemptionDuration < MIN_EVENT_DURATION || preemptionDuration > MAX_EVENT_DURATION) {
    return { ok: false, message: `A duração de preempção deve ser um inteiro entre ${MIN_EVENT_DURATION} e ${MAX_EVENT_DURATION}.` };
  }
  return { ok: true, value: { mode: data.mode as SchedulerMode, quantum: data.quantum, blockingDuration, preemptionDuration, processes } };
}

function makeResult(session: Session, finishedProcesses: ProcessState[] = [], error: unknown = null, timedOut = false): RunResult {
  const events = [...session.events];
  const processes: ProcessSummary[] = session.request.processes.map((_, id) => {
    const processEvents = events.filter((event) => event.process === id);
    const exits = events.filter((event) => event.kind === 'exit');
    const exitIndex = exits.findIndex((event) => event.process === id);
    const state = finishedProcesses.find((process) => process.id === id);
    return {
      id,
      prints: processEvents.filter((event) => event.kind === 'print').map((event) => event.value ?? ''),
      requestedInput: processEvents.filter((event) => event.kind === 'input').length,
      preemptions: processEvents.filter((event) => event.kind === 'preempt').length,
      exitOrder: exitIndex < 0 ? null : exitIndex + 1,
      averageQuantum: state?.avgQuantumUsed ?? null,
      turnaroundTime: state?.completionTime ?? null,
    };
  });
  const message = timedOut ? 'A simulação excedeu 60 segundos.' : error instanceof Error ? error.message : error ? String(error) : null;
  return {
    status: timedOut ? 'timeout' : error ? 'error' : 'ok', message, mode: session.request.mode,
    exitCode: error || timedOut ? 1 : 0,
    stdout: session.fullOutput, stderr: message ?? '',
    inputsUsed: [...session.inputsUsed], totalTicks: session.ticks.length, ticks: [...session.ticks], events, processes,
  };
}

function startSession(request: RunRequest): Session {
  const session: Session = {
    id: randomUUID(), request, fullOutput: '', ticks: [], events: [], inputsUsed: [], waitingInput: null,
    resolveInput: null, status: 'running', result: null, timer: setTimeout(() => undefined, RUN_TIMEOUT_MS),
  };
  session.timer = setTimeout(() => {
    session.resolveInput?.('');
    session.result = makeResult(session, [], new Error('Simulation timed out.'), true);
    session.status = 'done';
    session.waitingInput = null;
  }, RUN_TIMEOUT_MS);
  void runScheduler(request.processes.map((process) => process.source), request.mode, request, {
    maxInstructions: MAX_INSTRUCTIONS,
    output: (text) => { session.fullOutput += text; },
    tick: (tick) => session.ticks.push(tick),
    event: (event) => session.events.push(event),
    input: (process, register) => new Promise<string>((resolve) => {
      session.waitingInput = { process, register };
      session.resolveInput = resolve;
    }),
  }).then((finishedProcesses) => {
    if (session.status === 'done') return;
    session.result = makeResult(session, finishedProcesses);
    session.status = 'done';
  }).catch((error: unknown) => {
    if (session.status === 'done') return;
    session.result = makeResult(session, [], error);
    session.status = 'done';
  }).finally(() => clearTimeout(session.timer));
  return session;
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')); }
      catch { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

export function schedulerBridge(options: { frontendDir: string }): Plugin {
  const repoDir = path.resolve(options.frontendDir, '..');
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const route = (req.url ?? '/').split('?')[0];
    if (req.method === 'GET' && route === '/programs') {
      try { sendJson(res, 200, { programs: listPrograms(repoDir), modes: [...SCHEDULER_MODES] }); }
      catch (error) { sendJson(res, 500, { message: error instanceof Error ? error.message : String(error) }); }
      return;
    }
    if (req.method === 'POST' && route === '/run') {
      readJsonBody(req).then((body) => {
        const parsed = parseRunRequest(body);
        if (!parsed.ok) { sendJson(res, 422, { message: parsed.message }); return; }
        const session = startSession(parsed.value);
        sessions.set(session.id, session);
        sendJson(res, 202, { runId: session.id });
      }).catch((error: unknown) => sendJson(res, 400, { message: error instanceof Error ? error.message : String(error) }));
      return;
    }
    const runMatch = route?.match(/^\/run\/([\w-]+)$/);
    if (req.method === 'GET' && runMatch) {
      const session = sessions.get(runMatch[1]!);
      if (!session) { sendJson(res, 404, { message: 'Simulação não encontrada.' }); return; }
      sendJson(res, 200, {
        status: session.status, stdout: session.fullOutput, events: session.events,
        waitingInput: session.waitingInput, result: session.result,
      });
      return;
    }
    if (req.method === 'POST' && runMatch) {
      const session = sessions.get(runMatch[1]!);
      if (!session) { sendJson(res, 404, { message: 'Simulação não encontrada.' }); return; }
      readJsonBody(req).then((body) => {
        const value = body && typeof body === 'object' ? (body as { value?: unknown }).value : undefined;
        if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) { sendJson(res, 422, { message: 'Digite um número inteiro.' }); return; }
        if (!session.waitingInput || !session.resolveInput) { sendJson(res, 409, { message: 'O processo não está aguardando entrada.' }); return; }
        session.inputsUsed.push(value.trim());
        session.fullOutput += `${value.trim()}\n`;
        session.waitingInput = null;
        const resolve = session.resolveInput;
        session.resolveInput = null;
        resolve(value.trim());
        sendJson(res, 200, { ok: true });
      }).catch((error: unknown) => sendJson(res, 400, { message: error instanceof Error ? error.message : String(error) }));
      return;
    }
    next();
  };
  return {
    name: 'scheduler-bridge',
    configureServer(server) { server.middlewares.use('/api', middleware); },
    configurePreviewServer(server) { server.middlewares.use('/api', middleware); },
  };
}
