import http from 'node:http';
import { ALGORITHMS } from './algorithms.js';
import { validateRequest } from './validation.js';
import { simulate } from './simulator.js';

const PORT = Number(process.env.PORT) || 3001;
const MAX_BODY_BYTES = 64 * 1024;

function send(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'));
      } catch {
        reject(Object.assign(new Error('invalid json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/algorithms') {
    send(res, 200, { algorithms: ALGORITHMS });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/simulate') {
    let body;
    try {
      body = await readJson(req);
    } catch (error) {
      const message = error.status === 413
        ? 'O pedido está grande demais.'
        : 'O corpo da requisição não é um JSON válido.';
      send(res, error.status ?? 400, { errors: [{ field: 'body', message, row: null }] });
      return;
    }

    // A validação acontece aqui, no servidor: o front-end só mostra o resultado.
    const errors = validateRequest(body);
    if (errors.length > 0) {
      send(res, 422, { errors });
      return;
    }

    const result = simulate({
      algorithm: body.algorithm,
      quantum: body.quantum,
      overload: body.overload,
      processes: body.processes,
    });
    send(res, 200, result);
    return;
  }

  send(res, 404, { errors: [{ field: 'route', message: 'Rota não encontrada.', row: null }] });
});

// Só sobe a porta quando o arquivo é executado diretamente (os testes importam o módulo).
if (process.argv[1]?.endsWith('server.js')) {
  server.listen(PORT, () => {
    console.log(`API do escalonador rodando em http://localhost:${PORT}`);
  });
}
