import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate, IDLE, OVERLOAD } from '../src/simulator.js';
import { validateRequest } from '../src/validation.js';

const cpuOf = (r) => r.frames.map((f) => f.cpu);

// FIFO sem interrupções. P1 0-4, P2 4-7, P3 7-8.
test('FIFO calcula a linha do tempo e as métricas corretas', () => {
  const r = simulate({
    algorithm: 'fifo',
    processes: [
      { name: 'P1', arrival: 0, burst: 4, priority: 1 },
      { name: 'P2', arrival: 1, burst: 3, priority: 1 },
      { name: 'P3', arrival: 2, burst: 1, priority: 1 },
    ],
  });
  assert.deepEqual(cpuOf(r), [0, 0, 0, 0, 1, 1, 1, 2]);
  assert.equal(r.processStats[1].waitingTime, 3);
  assert.equal(r.processStats[2].waitingTime, 5);
  assert.equal(r.metrics.averageWaitingTime, 2.67);
  assert.equal(r.metrics.preemptions, 0);
});

// Round Robin, quantum 2, sobrecarga 1.
// Cálculo à mão: P1 0-2 | troca 2 | P2 3-5 | troca 5 | P1 6-8 | P2 8-9
test('Round Robin com sobrecarga gasta tempo real da CPU', () => {
  const r = simulate({
    algorithm: 'rr',
    quantum: 2,
    overload: 1,
    processes: [
      { name: 'P1', arrival: 0, burst: 4, priority: 1 },
      { name: 'P2', arrival: 1, burst: 3, priority: 1 },
    ],
  });
  assert.deepEqual(cpuOf(r), [0, 0, OVERLOAD, 1, 1, OVERLOAD, 0, 0, 1]);
  assert.equal(r.metrics.preemptions, 2);
  assert.equal(r.metrics.contextSwitches, 2);
  assert.equal(r.metrics.overloadUnits, 2);
  assert.equal(r.processStats[0].finish, 8);
  assert.equal(r.processStats[1].finish, 9);
  assert.equal(r.processStats[0].preemptions, 1);
  assert.ok(r.logs.some((l) => l.type === 'sobrecarga'));
});

// Round Robin sem sobrecarga: as preempções continuam contadas, mas sem tempo extra.
test('Round Robin sem sobrecarga não gasta tempo extra', () => {
  const r = simulate({
    algorithm: 'rr',
    quantum: 2,
    overload: 0,
    processes: [
      { name: 'P1', arrival: 0, burst: 4, priority: 1 },
      { name: 'P2', arrival: 1, burst: 3, priority: 1 },
    ],
  });
  assert.deepEqual(cpuOf(r), [0, 0, 1, 1, 0, 0, 1]);
  assert.equal(r.metrics.overloadUnits, 0);
  assert.equal(r.metrics.preemptions, 2);
});

// Prioridade preemptiva: A (prioridade 3) começa; B (prioridade 1) chega em 2 e interrompe.
// Linha do tempo: A 0-2, B 2-4, A 4-7 (sobrecarga 0).
test('Prioridade preemptiva interrompe quando chega processo mais prioritário', () => {
  const r = simulate({
    algorithm: 'priority',
    overload: 0,
    processes: [
      { name: 'A', arrival: 0, burst: 5, priority: 3 },
      { name: 'B', arrival: 2, burst: 2, priority: 1 },
    ],
  });
  assert.deepEqual(cpuOf(r), [0, 0, 1, 1, 0, 0, 0]);
  assert.equal(r.metrics.preemptions, 1);
  assert.equal(r.processStats[0].preemptions, 1);
  assert.ok(r.logs.some((l) => l.type === 'preempta' && l.message.includes('prioridade mais alta')));
});

test('SJF não interrompe e escolhe o mais curto entre os prontos', () => {
  const r = simulate({
    algorithm: 'sjf',
    overload: 3,
    processes: [
      { name: 'Longo', arrival: 0, burst: 5, priority: 1 },
      { name: 'Curto', arrival: 1, burst: 1, priority: 1 },
      { name: 'Medio', arrival: 1, burst: 3, priority: 1 },
    ],
  });
  assert.deepEqual(r.segments.map((s) => s.cpu), [0, 1, 2]);
  assert.equal(r.metrics.preemptions, 0);
});

test('CPU ociosa aparece quando ninguém está pronto', () => {
  const r = simulate({
    algorithm: 'fifo',
    processes: [{ name: 'Tarde', arrival: 3, burst: 2, priority: 1 }],
  });
  assert.deepEqual(cpuOf(r).slice(0, 3), [IDLE, IDLE, IDLE]);
  assert.equal(r.metrics.idlePercentage, 60);
});

test('Validação rejeita dados inválidos com mensagens por campo', () => {
  const errors = validateRequest({
    algorithm: 'rr',
    quantum: 0,
    overload: 9,
    processes: [
      { name: 'A', arrival: 0, burst: 0, priority: 1 },
      { name: 'A', arrival: -1, burst: 2, priority: 1 },
    ],
  });
  const fields = errors.map((e) => e.field);
  for (const f of ['quantum', 'overload', 'burst', 'arrival', 'name']) assert.ok(fields.includes(f), f);
});

test('Validação aceita um pedido correto', () => {
  const errors = validateRequest({
    algorithm: 'fifo',
    overload: 0,
    processes: [{ name: 'P1', arrival: 0, burst: 2, priority: 1 }],
  });
  assert.deepEqual(errors, []);
});
