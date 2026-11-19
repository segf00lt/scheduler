
export const SCHEDULER_MODES = ["fifo", "round_robin", "sjf", "strf", "priority", "custom"] as const;
export const DEFAULT_QUANTUM = 6;
export const MIN_QUANTUM = 1;
export const MAX_QUANTUM = 20;
export const DEFAULT_BLOCKING_DURATION = 1;
export const DEFAULT_PREEMPTION_DURATION = 1;
export const MIN_EVENT_DURATION = 0;
export const MAX_EVENT_DURATION = 20;
export const MAX_PROCESSES = 6;
export const MAX_INSTRUCTIONS = 100_000;
export const SCHEDULER_EVENT_KINDS = ['input', 'print', 'exit', 'preempt'] as const;

export type SchedulerMode = (typeof SCHEDULER_MODES)[number];

export interface ProgramInfo {
  id: string;
  file: string;
  source: string;
  hasCode: boolean;
}

export interface ProgramsResponse {
  programs: ProgramInfo[];
  modes: SchedulerMode[];
}

export interface SchedulerOptions {
  quantum: number;
  blockingDuration: number;
  preemptionDuration: number;
}

export interface RunRequest extends SchedulerOptions {
  mode: SchedulerMode;
  processes: { source: string }[];
}

export interface RunSnapshot {
  status: 'running' | 'done';
  stdout: string;
  events: SchedulerEvent[];
  waitingInput: { process: number; register: number } | null;
  result: RunResult | null;
}

export type SchedulerEventKind = (typeof SCHEDULER_EVENT_KINDS)[number];

export interface SchedulerEvent {
  order: number;
  kind: SchedulerEventKind;
  process: number;
  value: string | null;
  register: number | null;
  tick: number | null;
  duration: number;
}

export type SchedulerTickKind = 'instruction' | 'blocking' | 'preemption';

export interface TickInfo {
  tick: number;
  process: number;
  kind: SchedulerTickKind;
  event: SchedulerEventKind | null;
  opcode: string | null;
}

export interface ProcessSummary {
  id: number;
  prints: string[];
  requestedInput: number;
  preemptions: number;
  exitOrder: number | null;
  averageQuantum: number | null;
  turnaroundTime: number | null;
}

export type RunStatus = 'ok' | 'error' | 'missing_input' | 'timeout' | 'invalid';

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

export type Opcode =
| "GOTO" | "IFGOTO" | "ADD" | "SUB" | "MUL" | "DIV" | "LT" | "GTE"
| "LOAD" | "STORE" | "REGMOV" | "REGSETIMM" | "INPUT" | "PRINT";

export type Syscall =
"NONE" |
"INPUT" |
"PRINT";

export interface Instruction {
  opcode: Opcode;
  ra?: number;
  rb?: number;
  rc?: number;
  imm?: number;
  signed?: boolean;
}

export interface Program {
  instructions: Instruction[];
}

export type ProcessStatus = "run" | "block" | "exit";

export interface ProcessState {
  id: number;
  priority: number;
  instructions: Instruction[];
  pc: number;
  registers: bigint[];
  memory: Uint8Array;
  maxPcValue: number;
  status: ProcessStatus;
  curSyscall: Syscall;
  syscallReg: number; // registrador usado pelo input/print (o `ra` da instrução)
  lastTick: number | null;
  completionTime: number | null;
  quantumUsedThisRun: number;
  avgQuantumUsed: number;
}

const opcodeQuantumCost: Record<Opcode, number> = {
  GOTO: 1, IFGOTO: 1, ADD: 1, SUB: 1, MUL: 1, DIV: 1, LT: 1, GTE: 1,
  LOAD: 1, STORE: 1, REGMOV: 1, REGSETIMM: 1, INPUT: 1, PRINT: 1,
};

function assert(condition: unknown, message: string): asserts condition {
  if(!condition) throw new Error(message);
}

function exponentialMovingAverage(previous: number, sample: number, alpha = 0.125): number {
  return previous + alpha * (sample - previous);
}

export function isPreemptiveMode(mode: SchedulerMode): boolean {
  return mode === "strf" || mode === "round_robin" || mode === "priority";
}

export function isBlockingEvent(event: SchedulerEvent | SchedulerEventKind | null | undefined): boolean {
  const kind = typeof event === 'string' ? event : event?.kind;
  return kind === 'input' || kind === 'print';
}

function createProcess(program: Program, id: number, priority = 0): ProcessState {
  assert(program.instructions.length > 0, "Cannot create a process from an empty program");
  return {
    id, priority, instructions: program.instructions, pc: 0,
    registers: Array.from({ length: 256 }, () => 0n), memory: new Uint8Array(64 * 1024),
    maxPcValue: program.instructions.length - 1, status: "run",
    quantumUsedThisRun: 0, avgQuantumUsed: 0,
    curSyscall: "NONE", syscallReg: 0,
    lastTick: null,
    completionTime: null,
  };
}

function remainingInstructions(p: ProcessState): number {
  return p.maxPcValue - p.pc + 1;
}

function sortQueue(queue: ProcessState[], mode: SchedulerMode): void {
  switch(mode) {
    case "fifo": case "round_robin":
    return;
    case "custom":
    return;
    case "sjf":
    queue.sort((a, b) => a.instructions.length - b.instructions.length);
    return;
    case "strf":
    queue.sort((a, b) => remainingInstructions(a) - remainingInstructions(b));
    return;
    case "priority":
    queue.sort((a, b) => a.priority - b.priority);
    return;
  }
}

export interface SchedulerCallbacks {
  input: (process: number, register: number) => Promise<string>;
  output: (text: string) => void;
  tick?: (tick: TickInfo) => void;
  event?: (event: SchedulerEvent) => void;
  maxInstructions?: number;
}

export function hasInstructions(source: string): boolean {
  return source.split(/\r?\n/).some((line) => line.replace(/;.*/, '').trim() !== '');
}

/** Executes until the quantum expires (preemptive modes), or until block/exit. */
function processRunStep(
  p: ProcessState,
  ignoreQuantum: boolean,
  options: SchedulerOptions,
  callbacks: SchedulerCallbacks,
  clock: { tick: number; instructions: number },
  createTimedEvent: (kind: 'preempt', process: ProcessState, value: string | null, register: number | null) => SchedulerEvent,
  advanceEventDuration: (event: SchedulerEvent) => void,
): number {

  let quantumRemaining = options.quantum;
  let used = 0;
  p.status = "run";

  while (p.pc >= 0 && p.pc <= p.maxPcValue && p.status === "run" && (ignoreQuantum || quantumRemaining > 0)) {

    const inst = p.instructions[p.pc];

    assert(inst, `Invalid program counter ${p.pc} in process ${p.id}`);

    const ra = inst.ra ?? 0, rb = inst.rb ?? 0, rc = inst.rc ?? 0, imm = inst.imm ?? 0;

    if(clock.instructions >= (callbacks.maxInstructions ?? MAX_INSTRUCTIONS)) throw new Error("Instruction limit exceeded; possible infinite loop.");
    callbacks.tick?.({ tick: clock.tick, process: p.id, kind: 'instruction', event: null, opcode: inst.opcode });
    p.lastTick = clock.tick;
    clock.tick++;
    clock.instructions++;

    let advancePc = true;

    if(!ignoreQuantum) {
      const cost = opcodeQuantumCost[inst.opcode];
      quantumRemaining = Math.max(0, quantumRemaining - cost);
      used += cost;
    }

    switch(inst.opcode) {
      case "GOTO":
      p.pc = imm; advancePc = false;
      break;

      case "IFGOTO":
      if(p.registers[ra] !== 0n) { p.pc = imm; advancePc = false; }
      break;

      case "ADD":
      p.registers[ra] = BigInt.asUintN(64, p.registers[rb] + p.registers[rc]);
      break;

      case "SUB":
      p.registers[ra] = BigInt.asUintN(64, p.registers[rb] - p.registers[rc]);
      break;

      case "MUL":
      p.registers[ra] = BigInt.asUintN(64, p.registers[rb] * p.registers[rc]);
      break;

      case "DIV":
      assert(p.registers[rc] !== 0n, `Division by zero in process ${p.id}`); p.registers[ra] = p.registers[rb] / p.registers[rc];
      break;

      case "LT": {
        const left = inst.signed ? BigInt.asIntN(32, p.registers[rb]) : p.registers[rb];
        const right = inst.signed ? BigInt.asIntN(32, p.registers[rc]) : p.registers[rc];
        p.registers[ra] = left < right ? 1n : 0n;
        break;
      }

      case "GTE": {
        const left = inst.signed ? BigInt.asIntN(32, p.registers[rb]) : p.registers[rb];
        const right = inst.signed ? BigInt.asIntN(32, p.registers[rc]) : p.registers[rc];
        p.registers[ra] = left >= right ? 1n : 0n;
        break;
      }

      case "LOAD": {
        const address = Number(p.registers[rb]);
        assert(address >= 0 && address < p.memory.length, `Memory read out of bounds: ${address}`);
        p.registers[ra] = BigInt(p.memory[address]);
        break;
      }

      case "STORE": {
        const address = Number(p.registers[rb]);
        assert(address >= 0 && address < p.memory.length, `Memory write out of bounds: ${address}`);
        p.memory[address] = Number(p.registers[ra] & 0xffn);
        break;
      }

      case "REGMOV":
      p.registers[ra] = p.registers[rb];
      break;

      case "REGSETIMM":
      p.registers[ra] = BigInt.asUintN(64, BigInt(imm));
      break;

      case "INPUT":
      p.status = "block";
      p.curSyscall = "INPUT";
      p.syscallReg = ra;

      break;

      case "PRINT":

      p.status = "block";
      p.curSyscall = "PRINT";
      p.syscallReg = ra;

      break;
    }

    if(advancePc) {
      p.pc++;
    }

    // Só termina se não estiver bloqueado: um print/input na última instrução ainda precisa do syscall.
    if(p.pc > p.maxPcValue && p.status === "run") {
      p.status = "exit";
    }

  }

  // Preempção: a fatia (quantum) acabou sem bloquear nem terminar, então o processo perde a CPU.
  if(!ignoreQuantum && p.status === "run") {
    callbacks.output(`process ${p.id} preempted\n`);
    const event = createTimedEvent('preempt', p, null, null);
    advanceEventDuration(event);
  }

  p.quantumUsedThisRun = ignoreQuantum ? 0 : used;
  p.avgQuantumUsed = exponentialMovingAverage(p.avgQuantumUsed, p.quantumUsedThisRun);
  return p.quantumUsedThisRun;
}

async function syscallHandler(
  blockedQueue: ProcessState[],
  runQueue: ProcessState[],
  callbacks: SchedulerCallbacks,
  createTimedEvent: (kind: 'input' | 'print', process: ProcessState, value: string | null, register: number | null) => SchedulerEvent,
  advanceEventDuration: (event: SchedulerEvent) => void,
): Promise<void> {

  for(const p of blockedQueue) {
    assert(p.status === "block", "expected blocked process");

    let didSyscall: boolean = false;

    switch(p.curSyscall) {
      case "INPUT":
      {
      const event = createTimedEvent('input', p, null, p.syscallReg);
      callbacks.output(`process ${p.id} requesting input for r${p.syscallReg} = `);
      const value = await callbacks.input(p.id, p.syscallReg);
      assert(/^-?\d+$/.test(value.trim()), `Invalid input '${value}'`);
      event.value = value.trim();
      p.registers[p.syscallReg] = BigInt.asUintN(64, BigInt(value.trim()));
      advanceEventDuration(event);
      didSyscall = true;
      break;
      }

      case "PRINT":
      {
      const event = createTimedEvent('print', p, String(p.registers[p.syscallReg]), p.syscallReg);
      callbacks.output(`process ${p.id} print r${p.syscallReg} = ${p.registers[p.syscallReg]}\n`);
      advanceEventDuration(event);
      didSyscall = true;
      break;
      }
    }

    if(didSyscall) {
      p.status = p.pc > p.maxPcValue ? "exit" : "run";
      runQueue.push(p);
    }

  }
}

export async function processScheduler(initial: ProcessState[], mode: SchedulerMode, options: SchedulerOptions, callbacks: SchedulerCallbacks): Promise<ProcessState[]> {

  let currentQueue: ProcessState[] = [...initial];
  const exitedQueue: ProcessState[] = [];
  let blockedQueue: ProcessState[] = [];
  const ignoreQuantum = !isPreemptiveMode(mode);
  const clock = { tick: 0, instructions: 0 };
  let eventOrder = 0;
  const emitEvent = (event: Omit<SchedulerEvent, 'order'>): SchedulerEvent => {
    const orderedEvent = { order: ++eventOrder, ...event };
    callbacks.event?.(orderedEvent);
    return orderedEvent;
  };
  const createTimedEvent = (
    kind: 'input' | 'print' | 'preempt',
    process: ProcessState,
    value: string | null,
    register: number | null,
  ): SchedulerEvent => {
    const duration = isBlockingEvent(kind) ? options.blockingDuration : options.preemptionDuration;
    return emitEvent({
      kind,
      process: process.id,
      value,
      register,
      tick: duration > 0 ? clock.tick : process.lastTick,
      duration,
    });
  };
  const advanceEventDuration = (event: SchedulerEvent): void => {
    const kind: SchedulerTickKind = isBlockingEvent(event) ? 'blocking' : 'preemption';
    for (let i = 0; i < event.duration; i++) {
      callbacks.tick?.({ tick: clock.tick, process: event.process, kind, event: event.kind, opcode: null });
      clock.tick++;
    }
  };

  while(currentQueue.length > 0) {
    sortQueue(currentQueue, mode);

    const nextQueue: ProcessState[] = [];

    // Snapshot means each process in this round receives one turn.
    for(let i = 0; i < currentQueue.length; i++) {

      let p = currentQueue[i];
      
      if(p.status === "exit") {
        p.completionTime ??= clock.tick;
        callbacks.output(`process ${p.id} exitedQueue...\n`);
        emitEvent({ kind: 'exit', process: p.id, value: null, register: null, tick: clock.tick, duration: 0 });
        exitedQueue.push(p);
        continue;
      }

      processRunStep(p, ignoreQuantum, options, callbacks, clock, createTimedEvent, advanceEventDuration);

      if((p.status as ProcessStatus) === "exit") {
        p.completionTime = clock.tick;
        callbacks.output(`process ${p.id} exitedQueue...\n`);
        emitEvent({ kind: 'exit', process: p.id, value: null, register: null, tick: clock.tick, duration: 0 });
        exitedQueue.push(p);
      } else if((p.status as ProcessStatus) === "block") {
        blockedQueue.push(p);

        // NOTE jfd 19/11/26:
        // If the scheduling mode is not preemptive then we don't want to have the other process get in front of the one that was blocked on a syscall.
        // So in order to do that we do this very nasty hack :D
        if(!isPreemptiveMode(mode)) {
          await syscallHandler(blockedQueue, nextQueue, callbacks, createTimedEvent, advanceEventDuration);
          nextQueue.push(...currentQueue.slice(i+1));
          currentQueue = [];
          blockedQueue = [];
          break;
        }

      } else {
        // The C implementation treats BLOCK as ready again after the operation.
        p.status = "run";
        nextQueue.push(p);
      }

    }

    currentQueue = nextQueue;

    await syscallHandler(blockedQueue, currentQueue, callbacks, createTimedEvent, advanceEventDuration);
    blockedQueue = [];

  }

  for(const p of exitedQueue) {
    callbacks.output(`process ${p.id} average quantum used: ${p.avgQuantumUsed.toFixed(3)}\n`);
  }

  return exitedQueue;
}

// Minimal two-pass assembler compatible with the accompanying C assembler.
function parseRegister(token: string): number {
  assert(/^r\d+$/i.test(token), `Invalid register '${token}'`);
  const n = Number(token.slice(1));
  assert(n >= 0 && n < 256, `Register out of range '${token}'`);
  return n;
}

function parseImmediate(token: string): number {
  let value: number;
  if(/^0x[\da-f]+$/i.test(token)) value = Number.parseInt(token.slice(2), 16);
  else if(/^0[0-7]+$/.test(token) && token.length > 1) value = Number.parseInt(token, 8);
  else value = Number(token);
  assert(Number.isSafeInteger(value) && value >= 0, `Invalid immediate '${token}'`);
  return value;
}

export function assemble(source: string): Program {
  const lines = source.split(/\r?\n/).map(line => line.replace(/;.*/, "").trim()).filter(Boolean);

  const labels = new Map<string, number>();

  let pc = 0;
  for(const line of lines) {
    const label = line.match(/^([\w.$-]+):\s*$/);
    if(label) labels.set(label[1], pc); else pc++;
  }

  const instructions: Instruction[] = [];
  
  const target = (name: string): number => {
    const value = labels.get(name);
    assert(value !== undefined, `Unknown label '${name}'`);
    return value;
  };
  
  for(const line of lines) {
    if(/^[\w.$-]+:\s*$/.test(line)) continue;
    const [opRaw, ...rest] = line.split(/\s+/);
    const op = opRaw.toLowerCase();
    const args = rest.join(" ").split(",").map(s => s.trim()).filter(Boolean);
    const reg = (i: number) => parseRegister(args[i] ?? "");
    const binary: Record<string, Opcode> = { add: "ADD", sub: "SUB", mul: "MUL", div: "DIV", lt: "LT", ult: "LT", gte: "GTE", ugte: "GTE" };
    let inst: Instruction;

    if(op === "goto")        inst = { opcode: "GOTO", imm: target(args[0] ?? "") };
    else if(op === "ifgoto") inst = { opcode: "IFGOTO", ra: reg(0), imm: target(args[1] ?? "") };
    else if(binary[op])      inst = { opcode: binary[op], ra: reg(0), rb: reg(1), rc: reg(2), signed: op === "lt" || op === "gte" };
    else if(op === "load")   inst = { opcode: "LOAD", ra: reg(0), rb: reg(1) };
    else if(op === "store")  inst = { opcode: "STORE", ra: reg(0), rb: reg(1) };
    else if(op === "mov")    inst = { opcode: "REGMOV", ra: reg(0), rb: reg(1) };
    else if(op === "set")    inst = { opcode: "REGSETIMM", ra: reg(0), imm: parseImmediate(args[1] ?? "") };
    else if(op === "input")  inst = { opcode: "INPUT", ra: reg(0) };
    else if(op === "print")  inst = { opcode: "PRINT", ra: reg(0) };

    else throw new Error(`Unknown instruction '${opRaw}'`);
    instructions.push(inst);
  }
  
  return { instructions };
}

export async function runScheduler(sources: string[], mode: SchedulerMode, options: SchedulerOptions, callbacks: SchedulerCallbacks): Promise<ProcessState[]> {
  assert(SCHEDULER_MODES.includes(mode), `Unknown scheduler mode '${mode}'`);
  assert(Number.isInteger(options.quantum) && options.quantum >= MIN_QUANTUM && options.quantum <= MAX_QUANTUM, `Quantum must be between ${MIN_QUANTUM} and ${MAX_QUANTUM}`);
  for (const [name, value] of [['blocking duration', options.blockingDuration], ['preemption duration', options.preemptionDuration]] as const) {
    assert(Number.isInteger(value) && value >= MIN_EVENT_DURATION && value <= MAX_EVENT_DURATION, `${name} must be between ${MIN_EVENT_DURATION} and ${MAX_EVENT_DURATION}`);
  }
  const queue = sources.map((source, id) => createProcess(assemble(source), id));
  return processScheduler(queue, mode, options, callbacks);
}
