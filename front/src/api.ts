import type { ProgramsResponse, RunRequest, RunSnapshot } from './types.js';

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
export async function startScheduler(request: RunRequest): Promise<string> {
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
  const data = await readJson<{ runId?: string; message?: string }>(response);
  if (!response.ok || !data.runId) throw new Error(data.message ?? 'Não foi possível iniciar a simulação.');
  return data.runId;
}

export async function getRunSnapshot(runId: string): Promise<RunSnapshot> {
  const response = await fetch(`/api/run/${encodeURIComponent(runId)}`);
  const data = await readJson<RunSnapshot & { message?: string }>(response);
  if (!response.ok) throw new Error(data.message ?? 'Não foi possível consultar a simulação.');
  return data;
}

export async function submitRunInput(runId: string, value: string): Promise<void> {
  const response = await fetch(`/api/run/${encodeURIComponent(runId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  const data = await readJson<{ message?: string }>(response);
  if (!response.ok) throw new Error(data.message ?? 'Não foi possível enviar a entrada.');
}
