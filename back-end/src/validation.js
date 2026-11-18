import { ALGORITHM_IDS } from './algorithms.js';

export const LIMITS = {
  maxProcesses: 6, // o front-end tem 6 cores fixas; não repetimos cores
  maxNameLength: 12,
  maxArrival: 100,
  maxBurst: 100,
  maxPriority: 99,
  maxQuantum: 20,
  maxOverload: 5,
};

const isInt = (value) => typeof value === 'number' && Number.isInteger(value);

// Valida o pedido inteiro e devolve uma lista de erros em português.
// Cada erro diz o campo, a mensagem e (quando existe) a linha da tabela.
export function validateRequest(body) {
  const errors = [];
  const add = (field, message, row = null) => errors.push({ field, message, row });

  if (!body || typeof body !== 'object') {
    add('body', 'Envie um objeto JSON com algoritmo, quantum e processos.');
    return errors;
  }

  if (!ALGORITHM_IDS.includes(body.algorithm)) {
    add('algorithm', 'Escolha um algoritmo da lista.');
  }

  if (body.algorithm === 'rr') {
    if (!isInt(body.quantum) || body.quantum < 1 || body.quantum > LIMITS.maxQuantum) {
      add('quantum', `No Round Robin, o quantum deve ser um número inteiro entre 1 e ${LIMITS.maxQuantum}.`);
    }
  }

  if (!isInt(body.overload) || body.overload < 0 || body.overload > LIMITS.maxOverload) {
    add('overload', `A sobrecarga (troca de contexto) deve ser um inteiro entre 0 e ${LIMITS.maxOverload}.`);
  }

  if (!Array.isArray(body.processes)) {
    add('processes', 'A lista de processos está ausente.');
    return errors;
  }

  if (body.processes.length === 0) {
    add('processes', 'Adicione pelo menos um processo.');
  }
  if (body.processes.length > LIMITS.maxProcesses) {
    add('processes', `Use no máximo ${LIMITS.maxProcesses} processos.`);
  }

  const seenNames = new Map();
  body.processes.forEach((p, index) => {
    const row = index;
    const label = `Processo ${index + 1}`;

    const name = typeof p?.name === 'string' ? p.name.trim() : '';
    if (name === '') {
      add('name', `${label}: dê um nome ao processo.`, row);
    } else if (name.length > LIMITS.maxNameLength) {
      add('name', `${label}: o nome deve ter no máximo ${LIMITS.maxNameLength} caracteres.`, row);
    } else if (seenNames.has(name)) {
      add('name', `${label}: o nome "${name}" já existe na linha ${seenNames.get(name) + 1}. Use nomes diferentes.`, row);
    } else {
      seenNames.set(name, index);
    }

    if (!isInt(p?.arrival) || p.arrival < 0 || p.arrival > LIMITS.maxArrival) {
      add('arrival', `${label}: a chegada deve ser um inteiro entre 0 e ${LIMITS.maxArrival}.`, row);
    }
    if (!isInt(p?.burst) || p.burst < 1 || p.burst > LIMITS.maxBurst) {
      add('burst', `${label}: a duração deve ser um inteiro entre 1 e ${LIMITS.maxBurst}.`, row);
    }
    if (!isInt(p?.priority) || p.priority < 0 || p.priority > LIMITS.maxPriority) {
      add('priority', `${label}: a prioridade deve ser um inteiro entre 0 e ${LIMITS.maxPriority}.`, row);
    }
  });

  return errors;
}
