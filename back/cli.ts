import * as fs from 'node:fs';
import * as readline from 'node:readline';
import {
  DEFAULT_BLOCKING_DURATION,
  DEFAULT_PREEMPTION_DURATION,
  DEFAULT_QUANTUM,
  runScheduler,
  SCHEDULER_MODES,
  type SchedulerMode,
} from './scheduler.js';

async function main(argv: string[]): Promise<number> {
  if (argv.length < 2) {
    process.stderr.write(`Usage: cli.ts <${SCHEDULER_MODES.join('|')}> <file.asm>...\n`);
    return 1;
  }
  const mode = argv[0] as SchedulerMode;
  if (!SCHEDULER_MODES.includes(mode)) {
    process.stderr.write(`Unknown option '${argv[0]}'\n`);
    return 1;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const sources = argv.slice(1).map((file) => fs.readFileSync(file, 'utf8'));
    await runScheduler(sources, mode, {
      quantum: Number(process.env.SCHEDULER_QUANTUM) || DEFAULT_QUANTUM,
      blockingDuration: DEFAULT_BLOCKING_DURATION,
      preemptionDuration: DEFAULT_PREEMPTION_DURATION,
    }, {
      output: (text) => process.stdout.write(text),
      input: async () => new Promise<string>((resolve) => rl.question('', resolve)),
      tick: (tick) => {
        if (process.env.SCHEDULER_TRACE === '1') process.stdout.write(`trace ${tick.tick} ${tick.process} ${tick.opcode ?? tick.kind}\n`);
      },
    });
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  void main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
