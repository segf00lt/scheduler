import type { SchedulerEvent, SchedulerMode } from './types';

export interface ModeInfo {
  id: SchedulerMode;
  label: string;
  title: string;
  preemptive: boolean;
  note: string;
}

// Os modos e as regras são os de src/scheduler.ts (sortQueue, isPreemptive e o `valid` do main).
export const MODES: ModeInfo[] = [
  {
    id: 'fifo',
    label: 'FIFO',
    title: 'FIFO (primeiro a chegar, primeiro a sair)',
    preemptive: false,
    note: 'Cada processo roda até pedir entrada, imprimir ou terminar. A fila segue a ordem da lista.',
  },
  {
    id: 'round_robin',
    label: 'Round Robin',
    title: 'Round Robin (revezamento)',
    preemptive: true,
    note: 'Cada processo usa a CPU por um quantum (instruções, escolhidas no topo). Quando a fatia acaba, ele volta para o fim da fila.',
  },
  {
    id: 'sjf',
    label: 'SJF',
    title: 'SJF (menor tarefa primeiro)',
    preemptive: false,
    note: 'Ordena a fila pelo tamanho do programa (número de instruções), não pelo tempo gasto. Quem começou não é interrompido.',
  },
  {
    id: 'strf',
    label: 'STRF',
    title: 'STRF (menor tempo restante primeiro)',
    preemptive: true,
    note: 'Ordena a fila pelas instruções que ainda faltam e interrompe por quantum.',
  },
  {
    id: 'priority',
    label: 'Prioridade',
    title: 'Prioridade',
    preemptive: true,
    note: 'Atenção: o back-end atual não lê prioridades. Todos os processos entram com prioridade 0, então este modo se comporta como Round Robin.',
  },
  {
    id: 'custom',
    label: 'Custom',
    title: 'Custom',
    preemptive: false,
    note: 'Sem regra própria no back-end: a fila fica na ordem de chegada, como no FIFO.',
  },
];

// Quantum padrão (o mesmo que o back-end usa sem a variável SCHEDULER_QUANTUM).
// Só tem efeito nos modos preemptivos: round_robin, strf e priority.
export const DEFAULT_QUANTUM = 6;
export const MIN_QUANTUM = 1;
export const MAX_QUANTUM = 20;

export const MAX_PROCESSES = 6;

// Paleta de processos (a ordem é fixa: P0 é sempre o primeiro cor).
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
    help: 'O processo executou um print. O valor mostrado é o do registrador indicado no print, naquele momento.',
  },
  exit: {
    label: 'Terminou',
    short: 'fim',
    color: '#3DBE7A',
    help: 'O processo chegou ao fim do programa.',
  },
};
