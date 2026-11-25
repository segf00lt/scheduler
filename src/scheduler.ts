import * as fs from "node:fs";
import * as readline from "node:readline";

export type SchedulerMode = "fifo" | "round_robin" | "sjf" | "strf" | "priority" | "custom" | "edf";

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
  deadline: number;
  instructions: Instruction[];
  pc: number;
  registers: bigint[];
  memory: Uint8Array;
  maxPcValue: number;
  status: ProcessStatus;
  curSyscall: Syscall;
  quantumUsedThisRun: number;
  avgQuantumUsed: number;
}

let nextProcessId = 0;
let schedulerQuantum = 6;
let schedulerMode: SchedulerMode = "fifo";

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

function isPreemptive(mode: SchedulerMode): boolean {
  return mode === "strf" || mode === "round_robin" || mode === "priority" || mode === "edf";
}

function createProcess(program: Program, priority = 0, deadline = Infinity): ProcessState {
  assert(program.instructions.length > 0, "Cannot create a process from an empty program");
  return {
    id: nextProcessId++, priority, deadline, instructions: program.instructions, pc: 0,
    registers: Array.from({ length: 256 }, () => 0n), memory: new Uint8Array(64 * 1024),
    maxPcValue: program.instructions.length - 1, status: "run",
    quantumUsedThisRun: 0, avgQuantumUsed: 0,
    curSyscall: "NONE",
  };
}

function remainingInstructions(p: ProcessState): number {
  return p.maxPcValue - p.pc + 1;
}

function sortQueue(queue: ProcessState[]): void {
  switch(schedulerMode) {
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
    case "edf":
    queue.sort((a, b) => a.deadline - b.deadline);
    return;
  }
}

// function readInput(prompt: string): bigint {
//   process.stdout.write(prompt);
//   const buffer = Buffer.alloc(1024);
//   const count = fs.readSync(0, buffer, 0, buffer.length, null);
//   const value = buffer.toString("utf8", 0, count).trim();
//   const parsed = BigInt(value || "0");
//   return BigInt.asUintN(64, parsed);
// }

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function readInput(prompt: string): Promise<bigint> {
  return new Promise((resolve, reject) => {
    rl.question(prompt, (answer) => {
      try {
        const parsed = BigInt(answer.trim() || "0");
        resolve(BigInt.asUintN(64, parsed));
      } catch (error) {
        reject(error);
      }
    });
  });
}

/** Executes until the quantum expires (preemptive modes), or until block/exit. */
function processRunStep(p: ProcessState, ignoreQuantum: boolean): number {

  let quantumRemaining = schedulerQuantum;
  let used = 0;
  p.status = "run";

  while (p.pc >= 0 && p.pc <= p.maxPcValue && p.status === "run" && (ignoreQuantum || quantumRemaining > 0)) {

    const inst = p.instructions[p.pc];

    assert(inst, `Invalid program counter ${p.pc} in process ${p.id}`);

    const ra = inst.ra ?? 0, rb = inst.rb ?? 0, rc = inst.rc ?? 0, imm = inst.imm ?? 0;

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

      break;

      case "PRINT":

      p.status = "block";
      p.curSyscall = "PRINT";

      break;
    }

    if(advancePc) {
      p.pc++;
    }

    if(p.pc > p.maxPcValue) {
      p.status = "exit";
    }

  }

  p.quantumUsedThisRun = ignoreQuantum ? 0 : used;
  p.avgQuantumUsed = exponentialMovingAverage(p.avgQuantumUsed, p.quantumUsedThisRun);
  return p.quantumUsedThisRun;
}

async function syscallHandler(blockedQueue: ProcessState[], runQueue: ProcessState[]): Promise<void> {

  for(const p of blockedQueue) {
    assert(p.status === "block", "expected blocked process");

    let didSyscall: boolean = false;

    switch(p.curSyscall) {
      case "INPUT":
      p.registers[0] = await readInput(`process ${p.id} requesting input for r${0} = `);
      didSyscall = true;
      break;

      case "PRINT":
      console.log(`process ${p.id} print r${0} = ${p.registers[0]}`);
      didSyscall = true;
      break;
    }

    if(didSyscall) {
      p.status = "run";
      runQueue.push(p);
    }

  }
}

async function processScheduler(initial: ProcessState[]): Promise<ProcessState[]> {

  let currentQueue: ProcessState[] = [...initial];
  const exitedQueue: ProcessState[] = [];
  let blockedQueue: ProcessState[] = [];
  const ignoreQuantum = !isPreemptive(schedulerMode);

  while(currentQueue.length > 0) {
    sortQueue(currentQueue);

    const nextQueue: ProcessState[] = [];

    // Snapshot means each process in this round receives one turn.
    for(const p of currentQueue) {
      if(p.status === "exit") {
        exitedQueue.push(p);
        continue;
      }

      processRunStep(p, ignoreQuantum);

      if((p.status as ProcessStatus) === "exit") {
        console.log(`process ${p.id} exitedQueue...`);
        exitedQueue.push(p);
      } else if((p.status as ProcessStatus) === "block") {
        blockedQueue.push(p);
      } else {
        // The C implementation treats BLOCK as ready again after the operation.
        p.status = "run";
        nextQueue.push(p);
      }
    }
    currentQueue = nextQueue;

    await syscallHandler(blockedQueue, currentQueue);
    blockedQueue = [];

  }

  for(const p of exitedQueue) {
    console.log(`process ${p.id} average quantum used: ${p.avgQuantumUsed.toFixed(3)}`);
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

function assemble(source: string): Program {
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

function main(argv: string[]): number {
  if(argv.length < 2) {
    console.error("Usage: scheduler.ts <fifo|round_robin|sjf|strf|priority|custom|edf> <file.asm>...");
    return 1;
  }
  const mode = argv[0] as SchedulerMode;
  const valid: SchedulerMode[] = ["fifo", "round_robin", "sjf", "strf", "priority", "custom", "edf"];
  if(!valid.includes(mode)) { console.error(`Unknown option '${argv[0]}'`); return 1; }
  schedulerMode = mode;
  const queue: ProcessState[] = [];
  try {
    for(const arg of argv.slice(1)) {
      const [path, rawDeadline] = arg.split(":");
      const deadline = rawDeadline !== undefined ? Number(rawDeadline) : Infinity;

      if(!fs.existsSync(path)) throw new Error(`No such file '${path}'`);
      const program = assemble(fs.readFileSync(path, "utf8"));
      queue.push(createProcess(program, 0, deadline));
    }
    processScheduler(queue);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}

if(require.main === module) process.exitCode = main(process.argv.slice(2));