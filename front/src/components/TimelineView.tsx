import { useState } from 'react';
import { isBlockingEvent } from '../../../back/scheduler.js';
import type { RunResult, SchedulerEvent } from '../types.js';
import { EVENT_META, IDLE_COLOR, PROCESS_COLORS } from '../constants.js';

interface Props {
  result: RunResult;
}

// Largura de cada instante na grade (uma instrução executada).
const CELL_PX = 40;

type ProcState = 'run' | 'ready' | 'blocked' | 'preempted' | 'done';

const STATE_TEXT: Record<ProcState, string> = {
  run: 'usando a CPU',
  ready: 'esperando a vez (pronto)',
  blocked: 'bloqueado em syscall',
  preempted: 'em troca após preempção',
  done: 'já terminou',
};

// Gantt por instante simulado: instruções e durações de eventos do backend.
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
    const slot = ticks[tick];
    if (slot?.process === process) {
      if (slot.kind === 'instruction') return 'run';
      if (slot.kind === 'blocking' && isBlockingEvent(slot.event)) return 'blocked';
      return 'preempted';
    }
    const end = finishTick.get(process);
    if (end !== undefined && tick >= end) return 'done';
    return 'ready';
  };

  const describeEvent = (event: SchedulerEvent) => {
    const who = `P${event.process}`;
    const duration = event.duration > 0 ? ` · ${event.duration} instante(s)` : ' · duração 0';
    if (event.kind === 'input')
      return `${who} pediu entrada para r${event.register}${event.value !== null ? ` (recebeu ${event.value})` : ''}${duration}`;
    if (event.kind === 'print') return `${who} imprimiu r${event.register} = ${event.value}${duration}`;
    if (event.kind === 'preempt') return `${who} foi preemptado${duration}`;
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
        Cada coluna é um instante simulado. Os blocos mostram instruções, syscalls bloqueantes e preempções.
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
            const slot = ticks[t];
            const owner = slot?.process;
            const cpuEvent = slot?.kind === 'blocking' ? 'bloqueio' : slot?.kind === 'preemption' ? 'troca' : null;
            return (
              <button
                type="button"
                key={`cpu-${t}`}
                className={`gantt-cell ${cpuEvent ? `cpu-${slot?.kind}` : ''} ${t === selected ? 'is-now' : ''}`}
                style={{ background: slot?.kind === 'instruction' ? colorOf(owner!) : slot?.kind === 'preemption' ? EVENT_META.preempt.color : IDLE_COLOR }}
                onClick={() => setSelected(t)}
                aria-label={`Instante ${t}: ${slot?.kind === 'instruction' ? `CPU executa P${owner}` : slot?.kind === 'blocking' ? `CPU livre enquanto P${owner} bloqueia` : `troca de processo após preempção de P${owner}`}`}
                title={`t = ${t}: ${slot?.kind === 'instruction' ? `P${owner} · ${slot.opcode}` : `${cpuEvent} · P${owner}`}`}
              >
                {slot?.kind === 'instruction' && <span className="cell-chip">P{owner}</span>}
                {slot?.kind === 'blocking' && <GanttEventIcon kind="blocking" />}
                {slot?.kind === 'preemption' && <GanttEventIcon kind="preemption" />}
              </button>
            );
          })}

          {rows.map((p) => (
            <ProcessRow
              key={`row-${p}`}
              processId={p}
              color={colorOf(p)}
              totalTicks={totalTicks}
              ticks={ticks}
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
          {current?.kind === 'instruction' ? (
            <>
              a CPU executa <span style={{ color: colorOf(current.process) }}>P{current.process}</span> (instrução{' '}
              <code>{current.opcode}</code>).
            </>
          ) : current?.kind === 'blocking' ? (
            <>P{current.process} está bloqueado em {current.event}; a CPU fica livre.</>
          ) : current?.kind === 'preemption' ? (
            <>A CPU gasta tempo na troca após preempção de P{current.process}.</>
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
        <li className="legend-item">
          <span className="legend-swatch" style={{ background: IDLE_COLOR }} aria-hidden="true" />
          CPU livre durante bloqueio
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
  ticks: RunResult['ticks'];
  selected: number;
  stateOf: (tick: number) => ProcState;
  eventsAt: Map<number, SchedulerEvent[]>;
  onSelect: (tick: number) => void;
}

function ProcessRow({ processId, color, totalTicks, ticks, selected, stateOf, eventsAt, onSelect }: ProcessRowProps) {
  return (
    <>
      <div className="gantt-label process-label" style={{ borderLeftColor: color }}>
        P{processId}
      </div>
      {Array.from({ length: totalTicks }, (_, t) => {
        const state = stateOf(t);
        const slot = ticks[t];
        const mine = (eventsAt.get(t) ?? []).filter((e) => e.process === processId);
        const eventColor = slot?.process === processId && slot.kind === 'blocking' && isBlockingEvent(slot.event)
          ? EVENT_META[slot.event!].color
          : slot?.process === processId && slot.kind === 'preemption'
            ? EVENT_META.preempt.color
            : null;
        return (
          <button
            type="button"
            key={`p${processId}-${t}`}
            className={`gantt-cell cell-${state} ${t === selected ? 'is-now' : ''}`}
            style={{
              background: eventColor ?? (state === 'run'
                ? color
                : state === 'ready'
                  ? `color-mix(in srgb, ${color} 22%, transparent)`
                  : undefined),
            }}
            onClick={() => onSelect(t)}
            aria-label={`Instante ${t}: P${processId} ${STATE_TEXT[state]}`}
            title={`t = ${t}: P${processId} ${STATE_TEXT[state]}${eventColor ? ' · evento' : ''}`}
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

function GanttEventIcon({ kind }: { kind: 'blocking' | 'preemption' }) {
  return (
    <svg className="gantt-event-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {kind === 'blocking' ? (
        <path d="M7 3h10M7 21h10M8 3c0 4 2 6 4 9-2 3-4 5-4 9m8-18c0 4-2 6-4 9 2 3 4 5 4 9" />
      ) : (
        <path d="M4 8h14l-3-3m5 11H6l3 3" />
      )}
    </svg>
  );
}
