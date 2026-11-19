import type { ProgramsResponse, RunRequest, RunResult } from './types';

const OFFLINE = 'Não foi possível falar com a ponte do back-end. Confira se o `npm run dev` do front-end está rodando.';

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('A ponte devolveu uma resposta que não é JSON.');
  }
}

export async function fetchPrograms(): Promise<ProgramsResponse> {
  let response: Response;
  try {
    response = await fetch('/api/programs');
  } catch {
    throw new Error(OFFLINE);
  }
  if (!response.ok) throw new Error('Não foi possível carregar os exemplos de assembly.');
  return readJson<ProgramsResponse>(response);
}

// Devolve sempre um RunResult (inclusive quando o back-end recusa o programa).
// Só lança erro para problemas de transporte ou de validação da ponte.
export async function runScheduler(request: RunRequest): Promise<RunResult> {
  let response: Response;
  try {
    response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error(OFFLINE);
  }
  const data = await readJson<RunResult & { message?: string }>(response);
  if (response.status === 422 || response.status === 400) {
    throw new Error(data.message ?? 'Pedido inválido.');
  }
  if (!response.ok) throw new Error('A ponte falhou ao executar o back-end.');
  return data;
}
