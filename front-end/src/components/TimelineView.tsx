import { useState } from 'react';
import type { RunResult, SchedulerEvent } from '../types';
import { EVENT_META, PROCESS_COLORS } from '../constants';

interface Props {
  result: RunResult;
}

// Largura de cada instante na grade (uma instrução executada).
const CELL_PX = 40;

type ProcState = 'run' | 'ready' | 'done';

const STATE_TEXT: Record<ProcState, string> = {
  run: 'usando a CPU',
  ready: 'esperando a vez (pronto)',
  done: 'já terminou',
};

// Gantt por instante: cada coluna é uma instrução executada pelo back-end.
export function TimelineView({ result }: Props) {
  const { ticks, events, processes, totalTicks } = result;
  const [selected, setSelected] = useState(0);

  const colorOf = (process: number) => PROCESS_COLORS[process] ?? PROCESS_COLORS[0];
  const rows = processes.map((p) => p.id);

  // Instante em que cada processo executou a última instrução (depois disso ele já terminou).
  const finishTick = new Map<number, number>();
  for (const event of events) {
    if (event.kind === 'exit' && event.tick !== null) finishTick.set(event.process, event.tick);
  }

  // Eventos agrupados pelo instante em que ocorrem.
  const eventsAt = new Map<number, SchedulerEvent[]>();
  for (const event of events) {
    if (event.tick === null) continue;
    eventsAt.set(event.tick, [...(eventsAt.get(event.tick) ?? []), event]);
  }

  const stateOf = (process: number, tick: number): ProcState => {
    if (ticks[tick]?.process === process) return 'run';
    const end = finishTick.get(process);
    if (end !== undefined && tick > end) return 'done';
    return 'ready';
  };

  const describeEvent = (event: SchedulerEvent) => {
    const who = `P${event.process}`;
    if (event.kind === 'input')
      return `${who} pediu entrada para r${event.register}${event.value !== null ? ` (recebeu ${event.value})` : ''}`;
    if (event.kind === 'print') return `${who} imprimiu r${event.register} = ${event.value}`;
    if (event.kind === 'preempt') return `${who} perdeu a CPU (fim do quantum)`;
    return `${who} terminou`;
  };

  if (totalTicks === 0) {
    return (
      <div className="empty-inline">
        <p>Nenhuma instrução foi executada.</p>
        <p className="hint">Veja o Console para a mensagem do back-end.</p>
      </div>
    );
  }

  const current = ticks[selected];
  const currentEvents = eventsAt.get(selected) ?? [];

  return (
    <div className="timeline">
      <p className="hint timeline-note">
        Cada coluna é um instante: uma instrução executada pela CPU. Clique em uma coluna para ver o que aconteceu.
      </p>

      <div className="gantt-scroll">
        <div
          className="gantt-grid"
          style={{ gridTemplateColumns: `84px repeat(${totalTicks}, ${CELL_PX}px)` }}
        >
          <div className="gantt-corner" aria-hidden="true">
            t
          </div>
          {Array.from({ length: totalTicks }, (_, t) => (
            <button
              type="button"
              key={`h-${t}`}
              className={`gantt-head ${t === selected ? 'is-now' : ''}`}
              onClick={() => setSelected(t)}
              aria-label={`Instante ${t}`}
            >
              {t}
            </button>
          ))}

          <div className="gantt-label cpu-label">CPU</div>
          {Array.from({ length: totalTicks }, (_, t) => {
            const owner = ticks[t]?.process;
            return (
              <button
                type="button"
                key={`cpu-${t}`}
                className={`gantt-cell ${t === selected ? 'is-now' : ''}`}
                style={owner !== undefined ? { background: colorOf(owner) } : undefined}
                onClick={() => setSelected(t)}
                aria-label={`Instante ${t}: CPU executa P${owner ?? '—'}`}
                title={`t = ${t}: P${owner ?? '—'} (${ticks[t]?.opcode ?? ''})`}
              >
                {owner !== undefined && <span className="cell-chip">P{owner}</span>}
              </button>
            );
          })}

          {rows.map((p) => (
            <ProcessRow
              key={`row-${p}`}
              processId={p}
              color={colorOf(p)}
              totalTicks={totalTicks}
              selected={selected}
              stateOf={(t) => stateOf(p, t)}
              eventsAt={eventsAt}
              onSelect={setSelected}
            />
          ))}
        </div>
      </div>

      <div className="tick-detail" aria-live="polite">
        <p>
          <strong>Instante t = {selected}:</strong>{' '}
          {current ? (
            <>
              a CPU executa <span style={{ color: colorOf(current.process) }}>P{current.process}</span> (instrução{' '}
              <code>{current.opcode}</code>).
            </>
          ) : (
            'nenhuma instrução.'
          )}
        </p>
        <ul>
          {rows.map((p) => (
            <li key={p}>
              <span className="color-dot small" style={{ background: colorOf(p) }} aria-hidden="true" />
              <strong>P{p}</strong> {STATE_TEXT[stateOf(p, selected)]}
            </li>
          ))}
        </ul>
        {currentEvents.length > 0 && (
          <ul className="tick-events">
            {currentEvents.map((event) => (
              <li key={event.order}>
                <span className="tl-tag" style={{ background: EVENT_META[event.kind].color }}>
                  {EVENT_META[event.kind].short}
                </span>{' '}
                {describeEvent(event)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul className="legend" aria-label="Legenda">
        <li className="legend-item">
          <span className="legend-swatch" style={{ background: colorOf(0) }} aria-hidden="true" />
          Usando a CPU (cor do processo)
        </li>
        <li className="legend-item">
          <span className="legend-swatch tint" aria-hidden="true" />
          Esperando a vez
        </li>
        {(Object.keys(EVENT_META) as SchedulerEvent['kind'][]).map((kind) => (
          <li key={kind} className="legend-item">
            <span className="legend-swatch" style={{ background: EVENT_META[kind].color }} aria-hidden="true" />
            {EVENT_META[kind].label}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ProcessRowProps {
  processId: number;
  color: string;
  totalTicks: number;
  selected: number;
  stateOf: (tick: number) => ProcState;
  eventsAt: Map<number, SchedulerEvent[]>;
  onSelect: (tick: number) => void;
}

function ProcessRow({ processId, color, totalTicks, selected, stateOf, eventsAt, onSelect }: ProcessRowProps) {
  return (
    <>
      <div className="gantt-label process-label" style={{ borderLeftColor: color }}>
        P{processId}
      </div>
      {Array.from({ length: totalTicks }, (_, t) => {
        const state = stateOf(t);
        const mine = (eventsAt.get(t) ?? []).filter((e) => e.process === processId);
        return (
          <button
            type="button"
            key={`p${processId}-${t}`}
            className={`gantt-cell cell-${state} ${t === selected ? 'is-now' : ''}`}
            style={{
              background:
                state === 'run'
                  ? color
                  : state === 'ready'
                    ? `color-mix(in srgb, ${color} 22%, transparent)`
                    : undefined,
            }}
            onClick={() => onSelect(t)}
            aria-label={`Instante ${t}: P${processId} ${STATE_TEXT[state]}`}
            title={`t = ${t}: P${processId} ${STATE_TEXT[state]}`}
          >
            {mine.map((event) => (
              <span
                key={event.order}
                className="event-dot"
                style={{ background: EVENT_META[event.kind].color }}
                title={EVENT_META[event.kind].label}
                aria-hidden="true"
              />
            ))}
          </button>
        );
      })}
    </>
  );
}
