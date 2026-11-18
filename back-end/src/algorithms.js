// Catálogo dos algoritmos. Os textos são escritos para quem está aprendendo:
// dizem o que o algoritmo decide e por que isso importa.
export const ALGORITHMS = [
  {
    id: 'fifo',
    name: 'FIFO (primeiro a chegar, primeiro a sair)',
    shortName: 'FIFO',
    preemptive: false,
    usesQuantum: false,
    usesPriority: false,
    description:
      'A CPU atende os processos na ordem em que chegaram. Quando um processo começa, ele roda até terminar, sem ser interrompido.',
    rule: 'Escolhe sempre o processo que chegou primeiro.',
  },
  {
    id: 'sjf',
    name: 'SJF (menor tarefa primeiro)',
    shortName: 'SJF',
    preemptive: false,
    usesQuantum: false,
    usesPriority: false,
    description:
      'Entre os processos prontos, a CPU escolhe o que precisa de menos tempo de execução. Quem começou não é interrompido.',
    rule: 'Escolhe o processo pronto com a menor duração.',
  },
  {
    id: 'rr',
    name: 'Round Robin (revezamento)',
    shortName: 'Round Robin',
    preemptive: true,
    usesQuantum: true,
    usesPriority: false,
    description:
      'Cada processo recebe uma fatia de tempo chamada quantum. Quando a fatia acaba, ele volta para o fim da fila e o próximo processo entra na CPU.',
    rule: 'Cada processo usa no máximo um quantum por vez; depois vai para o fim da fila.',
  },
  {
    id: 'priority',
    name: 'Prioridade (preemptivo)',
    shortName: 'Prioridade',
    preemptive: true,
    usesQuantum: false,
    usesPriority: true,
    description:
      'Cada processo tem uma prioridade. Se chega um processo mais prioritário que o que está na CPU, ele interrompe o atual. O número MENOR é a prioridade MAIOR.',
    rule: 'Escolhe o pronto com o menor número de prioridade; um recém-chegado mais prioritário interrompe o atual.',
  },
];

export const ALGORITHM_IDS = ALGORITHMS.map((a) => a.id);

export function findAlgorithm(id) {
  return ALGORITHMS.find((a) => a.id === id) ?? null;
}
