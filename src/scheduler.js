import * as fs from "node:fs";
let nextProcessId = 0;
let schedulerQuantum = 6;
let schedulerMode = "fifo";
const opcodeQuantumCost = {
    GOTO: 1, IFGOTO: 1, ADD: 1, SUB: 1, MUL: 1, DIV: 1, LT: 1, GTE: 1,
    LOAD: 1, STORE: 1, REGMOV: 1, REGSETIMM: 1, INPUT: 1, PRINT: 1,
};
function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
function exponentialMovingAverage(previous, sample, alpha = 0.125) {
    return previous + alpha * (sample - previous);
}
function isPreemptive(mode) {
    return mode === "strf" || mode === "round_robin" || mode === "priority" || mode === "edf";
}
function createProcess(program, priority = 0) {
    assert(program.instructions.length > 0, "Cannot create a process from an empty program");
    return {
        id: nextProcessId++, priority, instructions: program.instructions, pc: 0,
        registers: Array.from({ length: 256 }, () => 0n), memory: new Uint8Array(64 * 1024),
        maxPcValue: program.instructions.length - 1, status: "run",
        quantumUsedThisRun: 0, avgQuantumUsed: 0,
    };
}
function remainingInstructions(p) {
    return p.maxPcValue - p.pc + 1;
}
function sortQueue(queue) {
    switch (schedulerMode) {
        case "fifo":
        case "round_robin":
            return;
        case "custom":
            return;
        case "sjf":
            queue.items.sort((a, b) => a.instructions.length - b.instructions.length);
            return;
        case "strf":
            queue.items.sort((a, b) => remainingInstructions(a) - remainingInstructions(b));
            return;
        case "priority":
            queue.items.sort((a, b) => a.priority - b.priority);
            return;
    }
}
function readInput(prompt) {
    process.stdout.write(prompt);
    const buffer = Buffer.alloc(1024);
    const count = fs.readSync(0, buffer, 0, buffer.length, null);
    const value = buffer.toString("utf8", 0, count).trim();
    const parsed = BigInt(value || "0");
    return BigInt.asUintN(64, parsed);
}
/** Executes until the quantum expires (preemptive modes), or until block/exit. */
function processRunStep(p, ignoreQuantum) {
    let quantumRemaining = schedulerQuantum;
    let used = 0;
    p.status = "run";
    while (p.pc >= 0 && p.pc <= p.maxPcValue && p.status === "run" && (ignoreQuantum || quantumRemaining > 0)) {
        const inst = p.instructions[p.pc];
        assert(inst, `Invalid program counter ${p.pc} in process ${p.id}`);
        const ra = inst.ra ?? 0, rb = inst.rb ?? 0, rc = inst.rc ?? 0, imm = inst.imm ?? 0;
        let advancePc = true;
        if (!ignoreQuantum) {
            const cost = opcodeQuantumCost[inst.opcode];
            quantumRemaining = Math.max(0, quantumRemaining - cost);
            used += cost;
        }
        switch (inst.opcode) {
            case "GOTO":
                p.pc = imm;
                advancePc = false;
                break;
            case "IFGOTO":
                if (p.registers[ra] !== 0n) {
                    p.pc = imm;
                    advancePc = false;
                }
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
                assert(p.registers[rc] !== 0n, `Division by zero in process ${p.id}`);
                p.registers[ra] = p.registers[rb] / p.registers[rc];
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
                p.currentSyscall = "INPUT";
                break;
            case "PRINT":
                p.status = "block";
                p.currentSyscall = "PRINT";
                break;
        }
        if (advancePc) {
            p.pc++;
        }
        if (p.pc > p.maxPcValue) {
            p.status = "exit";
        }
    }
    p.quantumUsedThisRun = ignoreQuantum ? 0 : used;
    p.avgQuantumUsed = exponentialMovingAverage(p.avgQuantumUsed, p.quantumUsedThisRun);
    return p.quantumUsedThisRun;
}
function syscallHandler(blockedQueue, runQueue) {
    for (const p of blockedQueue) {
        assert(p.status === "block");
        let didSyscall = false;
        switch (p.curSyscall) {
            case "INPUT":
                p.registers[ra] = readInput(`process ${p.id} requesting input forr${ra} = `);
                didSyscall = true;
                break;
            case "PRINT":
                console.log(`process ${p.id} print r${ra} = ${p.registers[ra]}`);
                didSyscall = true;
                break;
        }
        if (didSyscall) {
            p.status = "run";
            runQueue.push(p);
        }
    }
}
function processScheduler(initial) {
    let currentQueue = { items: [...initial.items] };
    const exitedQueue = [];
    let blockedQueue = {};
    const ignoreQuantum = !isPreemptive(schedulerMode);
    while (currentQueue.items.length > 0) {
        sortQueue(currentQueue);
        const nextQueue = [];
        // Snapshot means each process in this round receives one turn.
        for (const p of currentQueue.items) {
            if (p.status === "exit") {
                exitedQueue.push(p);
                continue;
            }
            processRunStep(p, ignoreQuantum);
            if (p.status === "exit") {
                console.log(`process ${p.id} exitedQueue...`);
                exitedQueue.push(p);
            }
            else if (p.status === "block") {
                blockedQueue.push(p);
            }
            else {
                // The C implementation treats BLOCK as ready again after the operation.
                p.status = "run";
                nextQueue.push(p);
            }
        }
        currentQueue = { items: nextQueue };
        syscallHandler(blockedQueue, currentQueue);
    }
    for (const p of exitedQueue) {
        console.log(`process ${p.id} average quantum used: ${p.avgQuantumUsed.toFixed(3)}`);
    }
    return exitedQueue;
}
// Minimal two-pass assembler compatible with the accompanying C assembler.
function parseRegister(token) {
    assert(/^r\d+$/i.test(token), `Invalid register '${token}'`);
    const n = Number(token.slice(1));
    assert(n >= 0 && n < 256, `Register out of range '${token}'`);
    return n;
}
function parseImmediate(token) {
    let value;
    if (/^0x[\da-f]+$/i.test(token))
        value = Number.parseInt(token.slice(2), 16);
    else if (/^0[0-7]+$/.test(token) && token.length > 1)
        value = Number.parseInt(token, 8);
    else
        value = Number(token);
    assert(Number.isSafeInteger(value) && value >= 0, `Invalid immediate '${token}'`);
    return value;
}
function assemble(source) {
    const lines = source.split(/\r?\n/).map(line => line.replace(/;.*/, "").trim()).filter(Boolean);
    const labels = new Map();
    let pc = 0;
    for (const line of lines) {
        const label = line.match(/^([\w.$-]+):\s*$/);
        if (label)
            labels.set(label[1], pc);
        else
            pc++;
    }
    const instructions = [];
    const target = (name) => {
        const value = labels.get(name);
        assert(value !== undefined, `Unknown label '${name}'`);
        return value;
    };
    for (const line of lines) {
        if (/^[\w.$-]+:\s*$/.test(line))
            continue;
        const [opRaw, ...rest] = line.split(/\s+/);
        const op = opRaw.toLowerCase();
        const args = rest.join(" ").split(",").map(s => s.trim()).filter(Boolean);
        const reg = (i) => parseRegister(args[i] ?? "");
        const binary = { add: "ADD", sub: "SUB", mul: "MUL", div: "DIV", lt: "LT", ult: "LT", gte: "GTE", ugte: "GTE" };
        let inst;
        if (op === "goto")
            inst = { opcode: "GOTO", imm: target(args[0] ?? "") };
        else if (op === "ifgoto")
            inst = { opcode: "IFGOTO", ra: reg(0), imm: target(args[1] ?? "") };
        else if (binary[op])
            inst = { opcode: binary[op], ra: reg(0), rb: reg(1), rc: reg(2), signed: op === "lt" || op === "gte" };
        else if (op === "load")
            inst = { opcode: "LOAD", ra: reg(0), rb: reg(1) };
        else if (op === "store")
            inst = { opcode: "STORE", ra: reg(0), rb: reg(1) };
        else if (op === "mov")
            inst = { opcode: "REGMOV", ra: reg(0), rb: reg(1) };
        else if (op === "set")
            inst = { opcode: "REGSETIMM", ra: reg(0), imm: parseImmediate(args[1] ?? "") };
        else if (op === "input")
            inst = { opcode: "INPUT", ra: reg(0) };
        else if (op === "print")
            inst = { opcode: "PRINT", ra: reg(0) };
        else
            throw new Error(`Unknown instruction '${opRaw}'`);
        instructions.push(inst);
    }
    return { instructions };
}
function main(argv) {
    if (argv.length < 2) {
        console.error("Usage: scheduler.ts <fifo|round_robin|sjf|strf|priority|custom> <file.asm>...");
        return 1;
    }
    const mode = argv[0];
    const valid = ["fifo", "round_robin", "sjf", "strf", "priority", "custom"];
    if (!valid.includes(mode)) {
        console.error(`Unknown option '${argv[0]}'`);
        return 1;
    }
    schedulerMode = mode;
    const queue = { items: [] };
    try {
        for (const path of argv.slice(1)) {
            if (!fs.existsSync(path))
                throw new Error(`No such file '${path}'`);
            const program = assemble(fs.readFileSync(path, "utf8"));
            queue.items.push(createProcess(program));
        }
        processScheduler(queue);
        return 0;
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : error);
        return 1;
    }
}
if (require.main === module)
    process.exitCode = main(process.argv.slice(2));
