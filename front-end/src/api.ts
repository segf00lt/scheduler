import type { Algorithm, ApiError, SimulateRequest, SimulationResult } from './types';

// Erro de validação devolvido pelo back-end (status 422) ou erro de conexão.
export class ApiFailure extends Error {
  readonly errors: ApiError[];
  readonly offline: boolean;

  constructor(errors: ApiError[], offline = false) {
    super(errors[0]?.message ?? 'Erro desconhecido');
    this.errors = errors;
    this.offline = offline;
  }
}

const OFFLINE_MESSAGE = {
  field: 'connection',
  message:
    'Não foi possível falar com o back-end. Confira se ele está rodando (npm start na pasta back-end).',
  row: null,
};

export async function fetchAlgorithms(): Promise<Algorithm[]> {
  let response: Response;
  try {
    response = await fetch('/api/algorithms');
  } catch {
    throw new ApiFailure([OFFLINE_MESSAGE], true);
  }
  const data = (await response.json()) as { algorithms: Algorithm[] };
  return data.algorithms;
}

export async function runSimulation(request: SimulateRequest): Promise<SimulationResult> {
  let response: Response;
  try {
    response = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new ApiFailure([OFFLINE_MESSAGE], true);
  }

  const data = await response.json();
  if (!response.ok) {
    throw new ApiFailure((data as { errors: ApiError[] }).errors ?? [OFFLINE_MESSAGE]);
  }
  return data as SimulationResult;
}
