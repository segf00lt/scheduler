// Formatos devolvidos pela ponte (front-end/bridge/schedulerBridge.ts), que executa o back-end real.

export type SchedulerMode = 'fifo' | 'round_robin' | 'sjf' | 'strf' | 'priority' | 'custom';

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

export interface RunRequest {
  mode: SchedulerMode;
  quantum: number;
  processes: { source: string }[];
  inputs: string[];
}

// Um evento impresso pelo back-end, com o instante em que aconteceu.
export interface SchedulerEvent {
  order: number;
  kind: 'input' | 'print' | 'exit' | 'preempt';
  process: number;
  value: string | null;
  register: number | null;
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
