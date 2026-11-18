// Simulador de escalonamento de CPU em passos de 1 unidade de tempo.
//
// Para cada instante t guardamos um "frame":
//   cpu:    índice do processo na CPU, IDLE (-1) se ninguém usa, OVERLOAD (-2) se é troca de contexto
//   states: estado de cada processo: 'future' (ainda não chegou), 'ready' (pronto, esperando),
//           'run' (usando a CPU), 'done' (já terminou)

export const IDLE = -1;
export const OVERLOAD = -2;

const byArrival = (a, b) => a.arrival - b.arrival || a.index - b.index;

function bestIndex(list, compare) {
  let best = 0;
  for (let i = 1; i < list.length; i++) if (compare(list[i], list[best]) < 0) best = i;
  return best;
}

// Escolhe o próximo processo pronto, de acordo com o algoritmo.
function pickNext(algorithm, ready) {
  let position = 0;
  if (algorithm === 'sjf') {
    position = bestIndex(ready, (a, b) => a.burst - b.burst || a.arrival - b.arrival || a.index - b.index);
  } else if (algorithm === 'priority') {
    position = bestIndex(ready, (a, b) => a.priority - b.priority || a.arrival - b.arrival || a.index - b.index);
  }
  return ready.splice(position, 1)[0];
}

const round2 = (value) => Math.round(value * 100) / 100;
const average = (values) => (values.length === 0 ? 0 : round2(values.reduce((s, v) => s + v, 0) / values.length));

// processes: [{ name, arrival, burst, priority }] já validados.
// overload: unidades de tempo gastas pela CPU a cada troca de processo (preempção).
export function simulate({ algorithm, quantum = 1, overload = 0, processes }) {
  const preemptive = algorithm === 'rr' || algorithm === 'priority';
  const switchCost = preemptive ? overload : 0;
  const sliceLength = algorithm === 'rr' ? quantum : Infinity;

  const procs = processes.map((p, index) => ({
    index,
    name: p.name.trim(),
    arrival: p.arrival,
    burst: p.burst,
    priority: p.priority,
    remaining: p.burst,
    firstStart: null,
    finish: null,
    stintUsed: 0, // unidades usadas desde que entrou na CPU pela última vez
    preemptions: 0,
  }));

  const pending = [...procs].sort(byArrival);
  const ready = [];
  const frames = [];
  const logs = [];

  let current = null;
  let sliceLeft = 0;
  let overloadLeft = 0;
  let contextSwitches = 0;
  let preemptions = 0;
  let finishedCount = 0;
  let t = 0;

  const log = (time, type, process, message) => logs.push({ time, type, process, message });

  const admitArrivals = (now) => {
    while (pending.length > 0 && pending[0].arrival <= now) {
      const p = pending.shift();
      ready.push(p);
      log(now, 'chegada', p.name, `${p.name} chegou e entrou na fila de prontos.`);
    }
  };

  // Registra o instante t: o que a CPU fez e o estado de cada processo.
  const record = (cpu) => {
    frames.push({
      cpu,
      states: procs.map((p) => {
        if (p.finish !== null) return 'done';
        if (p.arrival > t) return 'future';
        if (p === current) return 'run';
        return 'ready';
      }),
    });
  };

  // Tira o processo atual da CPU por preempção (quantum estourou ou chegou alguém mais prioritário).
  const preempt = (reason) => {
    preemptions++;
    current.preemptions++;
    log(t, 'preempta', current.name, `${current.name} usou a CPU por ${current.stintUsed} unidade(s) e ${reason}.`);
    ready.push(current);
    current = null;
    if (switchCost > 0) {
      overloadLeft = switchCost;
      contextSwitches++;
      log(t, 'sobrecarga', null, `Troca de contexto: a CPU gasta ${switchCost} unidade(s) para trocar de processo.`);
    }
  };

  while (finishedCount < procs.length) {
    admitArrivals(t);

    // 1) Troca de contexto em andamento: a CPU não executa processo algum.
    if (overloadLeft > 0) {
      record(OVERLOAD);
      overloadLeft--;
      t++;
      continue;
    }

    // 2) Prioridade preemptiva: chegou alguém mais prioritário que o processo atual?
    if (current && algorithm === 'priority' && ready.length > 0) {
      const best = ready[bestIndex(ready, (a, b) => a.priority - b.priority || a.arrival - b.arrival || a.index - b.index)];
      if (best.priority < current.priority) {
        preempt(`${best.name} chegou com prioridade mais alta (${best.priority} < ${current.priority})`);
        continue;
      }
    }

    // 3) Quem usa a CPU agora?
    if (current === null) {
      if (ready.length === 0) {
        const wasIdle = frames.length > 0 && frames[frames.length - 1].cpu === IDLE;
        if (!wasIdle) log(t, 'ociosa', null, 'A CPU ficou ociosa: nenhum processo está pronto.');
        record(IDLE);
        t++;
        continue;
      }

      current = pickNext(algorithm, ready);
      sliceLeft = sliceLength;
      current.stintUsed = 0;
      if (current.firstStart === null) current.firstStart = t;
      const resumed = current.remaining < current.burst;
      log(
        t,
        'entra',
        current.name,
        resumed
          ? `${current.name} voltou à CPU e faltam ${current.remaining} unidade(s).`
          : `${current.name} entrou na CPU pela primeira vez.`,
      );
    }

    // 4) Executa uma unidade de tempo do processo atual.
    record(current.index);
    current.remaining--;
    current.stintUsed++;
    sliceLeft--;
    t++;

    if (current.remaining === 0) {
      current.finish = t;
      finishedCount++;
      log(t, 'termina', current.name, `${current.name} terminou depois de usar a CPU por ${current.burst} unidade(s).`);
      current = null;
      continue;
    }

    // Chegadas neste mesmo instante entram antes de decidir a preempção por quantum.
    admitArrivals(t);

    if (algorithm === 'rr' && sliceLeft === 0) {
      preempt(`usou todo o quantum (${quantum}) e volta para o fim da fila`);
    }
  }

  const processStats = procs.map((p) => {
    const turnaround = p.finish - p.arrival;
    return {
      name: p.name,
      arrival: p.arrival,
      burst: p.burst,
      priority: p.priority,
      firstStart: p.firstStart,
      finish: p.finish,
      waitingTime: turnaround - p.burst,
      turnaroundTime: turnaround,
      responseTime: p.firstStart - p.arrival,
      preemptions: p.preemptions,
    };
  });

  // Blocos contínuos da CPU (para resumir a linha do tempo).
  const segments = [];
  frames.forEach((frame, time) => {
    const kind = frame.cpu === IDLE ? 'idle' : frame.cpu === OVERLOAD ? 'overload' : 'process';
    const last = segments[segments.length - 1];
    if (last && last.cpu === frame.cpu) {
      last.end = time + 1;
    } else {
      segments.push({ cpu: frame.cpu, kind, start: time, end: time + 1 });
    }
  });

  const total = frames.length;
  const count = (value) => frames.filter((f) => f.cpu === value).length;

  return {
    algorithm,
    quantum: algorithm === 'rr' ? quantum : null,
    overload: switchCost,
    preemptive,
    totalTime: total,
    processes: procs.map((p) => ({ index: p.index, name: p.name })),
    frames,
    segments,
    processStats,
    metrics: {
      averageWaitingTime: average(processStats.map((s) => s.waitingTime)),
      averageTurnaroundTime: average(processStats.map((s) => s.turnaroundTime)),
      averageResponseTime: average(processStats.map((s) => s.responseTime)),
      idlePercentage: total === 0 ? 0 : round2((count(IDLE) / total) * 100),
      preemptions,
      contextSwitches,
      overloadUnits: count(OVERLOAD),
    },
    logs,
  };
}
