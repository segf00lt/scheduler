import type { LogType } from './types';

// Paleta categórica validada (scripts/validate_palette.js da skill dataviz).
// A ordem é fixa: o processo 1 é sempre azul, o 2 sempre laranja, e assim por diante.
export const PROCESS_COLORS = [
  { name: 'azul', hex: '#1F6FB2' },
  { name: 'laranja', hex: '#D9621E' },
  { name: 'verde-azulado', hex: '#23937A' },
  { name: 'roxo', hex: '#8A4FB5' },
  { name: 'ocre', hex: '#A87410' },
  { name: 'magenta', hex: '#C7326E' },
] as const;

export const IDLE_COLOR = '#8A8F98';

export const MAX_PROCESSES = PROCESS_COLORS.length;

// Texto curto de cada tipo de evento no registro.
export const LOG_LABELS: Record<LogType, string> = {
  chegada: 'Chegou',
  entra: 'Entrou na CPU',
  preempta: 'Perdeu a CPU',
  sobrecarga: 'Troca de contexto',
  termina: 'Terminou',
  ociosa: 'CPU ociosa',
};

// Explicação dos termos, em linguagem simples.
export const GLOSSARY: { term: string; meaning: string }[] = [
  { term: 'Chegada', meaning: 'Instante em que o processo entra na fila de prontos.' },
  { term: 'Duração', meaning: 'Quantas unidades de tempo de CPU o processo precisa no total.' },
  { term: 'Preempção', meaning: 'Quando o sistema tira o processo da CPU antes dele terminar. Ele volta para a fila.' },
  { term: 'Quantum', meaning: 'Fatia de tempo que cada processo pode usar antes de ser interrompido (Round Robin).' },
  { term: 'Troca de contexto', meaning: 'Tempo gasto pela CPU para salvar um processo e carregar outro. Durante a troca, nenhum processo executa.' },
  { term: 'Espera', meaning: 'Tempo em que o processo ficou pronto, mas sem usar a CPU.' },
  { term: 'Turnaround', meaning: 'Tempo entre a chegada e o término. É a espera somada à duração.' },
  { term: 'Resposta', meaning: 'Tempo entre a chegada e a primeira vez em que o processo usa a CPU.' },
];
