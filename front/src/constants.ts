import {
  DEFAULT_BLOCKING_DURATION,
  DEFAULT_QUANTUM,
  DEFAULT_PREEMPTION_DURATION,
  isPreemptiveMode,
  MAX_PROCESSES,
  MAX_EVENT_DURATION,
  MAX_QUANTUM,
  MIN_EVENT_DURATION,
  MIN_QUANTUM,
  SCHEDULER_MODES,
  type SchedulerEvent,
  type SchedulerMode,
} from '../../back/scheduler.js';

export {
  DEFAULT_BLOCKING_DURATION,
  DEFAULT_PREEMPTION_DURATION,
  DEFAULT_QUANTUM,
  MAX_EVENT_DURATION,
  MAX_PROCESSES,
  MAX_QUANTUM,
  MIN_EVENT_DURATION,
  MIN_QUANTUM,
};

export interface ModeInfo {
  id: SchedulerMode;
  label: string;
  title: string;
  preemptive: boolean;
  note: string;
}

// Names and teaching notes are UI copy; mode membership and preemption behavior come from the backend.
const MODE_PRESENTATION: Record<SchedulerMode, Omit<ModeInfo, 'id' | 'preemptive'>> = {
  fifo: {
    label: 'FIFO',
    title: 'FIFO (primeiro a chegar, primeiro a sair)',
    note: 'Cada processo roda até pedir entrada, imprimir ou terminar. A fila segue a ordem da lista.',
  },
  round_robin: {
    label: 'Round Robin',
    title: 'Round Robin (revezamento)',
    note: 'Cada processo usa a CPU por um quantum (instruções, escolhidas no topo). Quando a fatia acaba, ele volta para o fim da fila.',
  },
  sjf: {
    label: 'SJF',
    title: 'SJF (menor tarefa primeiro)',
    note: 'Ordena a fila pelo tamanho do programa (número de instruções), não pelo tempo gasto. Quem começou não é interrompido.',
  },
  strf: {
    label: 'STRF',
    title: 'STRF (menor tempo restante primeiro)',
    note: 'Ordena a fila pelas instruções que ainda faltam e interrompe por quantum.',
  },
  priority: {
    label: 'Prioridade',
    title: 'Prioridade',
    note: 'O back-end atual inicia todos os processos com prioridade 0, então este modo se comporta como Round Robin.',
  },
  custom: {
    label: 'Custom',
    title: 'Custom',
    note: 'Sem regra própria no back-end: a fila fica na ordem de chegada, como no FIFO.',
  },
};

export const MODES: ModeInfo[] = SCHEDULER_MODES.map((id) => ({
  id,
  ...MODE_PRESENTATION[id],
  preemptive: isPreemptiveMode(id),
}));

// Paleta e cores de eventos são configurações visuais, não regras do escalonador.
export const PROCESS_COLORS = ['#E8584F', '#2EB8A6', '#F2A93B', '#9B7BEA', '#4F9CF0', '#E26BA6'] as const;
export const IDLE_COLOR = '#8A8F98';

export const EVENT_META: Record<SchedulerEvent['kind'], { label: string; short: string; color: string; help: string }> = {
  preempt: {
    label: 'Perdeu a CPU',
    short: 'preempção',
    color: '#FF8A4C',
    help: 'A fatia (quantum) acabou e o processo foi tirado da CPU. Ele volta para o fim da fila e ainda não terminou.',
  },
  input: {
    label: 'Pediu entrada',
    short: 'entrada',
    color: '#E0B341',
    help: 'O processo executou um input e ficou bloqueado até o usuário informar um valor.',
  },
  print: {
    label: 'Imprimiu',
    short: 'print',
    color: '#4F9CF0',
    help: 'O valor mostrado é o do registrador indicado no print, naquele momento.',
  },
  exit: {
    label: 'Terminou',
    short: 'fim',
    color: '#3DBE7A',
    help: 'O processo chegou ao fim do programa.',
  },
};
