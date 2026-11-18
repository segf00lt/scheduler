export type AlgorithmId = 'fifo' | 'sjf' | 'rr' | 'priority';

export interface Algorithm {
  id: AlgorithmId;
  name: string;
  shortName: string;
  preemptive: boolean;
  usesQuantum: boolean;
  usesPriority: boolean;
  description: string;
  rule: string;
}

export interface ProcessRow {
  name: string;
  arrival: number;
  burst: number;
  priority: number;
}

export interface SimulateRequest {
  algorithm: AlgorithmId;
  quantum: number;
  overload: number;
  processes: ProcessRow[];
}

export interface ApiError {
  field: string;
  message: string;
  row: number | null;
}

// Estado de um processo em um instante.
export type ProcessState = 'future' | 'ready' | 'run' | 'done';

// Um instante da simulação. cpu: índice do processo, -1 (ociosa) ou -2 (troca de contexto).
export interface Frame {
  cpu: number;
  states: ProcessState[];
}

export interface Segment {
  cpu: number;
  kind: 'process' | 'idle' | 'overload';
  start: number;
  end: number;
}

export interface ProcessStat {
  name: string;
  arrival: number;
  burst: number;
  priority: number;
  firstStart: number;
  finish: number;
  waitingTime: number;
  turnaroundTime: number;
  responseTime: number;
  preemptions: number;
}

export type LogType = 'chegada' | 'entra' | 'preempta' | 'sobrecarga' | 'termina' | 'ociosa';

export interface LogEntry {
  time: number;
  type: LogType;
  process: string | null;
  message: string;
}

export interface SimulationResult {
  algorithm: AlgorithmId;
  quantum: number | null;
  overload: number;
  preemptive: boolean;
  totalTime: number;
  frames: Frame[];
  segments: Segment[];
  processes: { index: number; name: string }[];
  processStats: ProcessStat[];
  metrics: {
    averageWaitingTime: number;
    averageTurnaroundTime: number;
    averageResponseTime: number;
    idlePercentage: number;
    preemptions: number;
    contextSwitches: number;
    overloadUnits: number;
  };
  logs: LogEntry[];
}
