import { useState } from 'react';
import type { ProcessState, SimulationResult } from '../types';
import { IDLE_COLOR, PROCESS_COLORS } from '../constants';

interface Props {
  result: SimulationResult;
}

// Largura fixa de cada unidade de tempo, igual ao exemplo: a linha rola na horizontal.
const CELL_PX = 44;

const STATE_WORDS: Record<ProcessState, string> = {
  future: 'ainda não chegou',
  ready: 'esperando a vez',
  run: 'usando a CPU',
  done: 'já terminou',
};

export function GanttChart({ result }: Props) {
  const { frames, processes, totalTime } = result;
  const [now, setNow] = useState(0);

  const colorOf = (index: number) => PROCESS_COLORS[index]?.hex ?? IDLE_COLOR;
  const nameOf = (index: number) => processes.find((p) => p.index === index)?.name ?? `P${index + 1}`;
  const frame = frames[now];

  const cpuDescription = (cpu: number) => {
    if (cpu === -2) return 'A CPU está fazendo troca de contexto: nenhum processo executa neste instante.';
    if (cpu === -1) return 'A CPU está ociosa: nenhum processo estava pronto.';
    return `A CPU está executando ${nameOf(cpu)}.`;
  };

  return (
    <div className="gantt">
      <div className="gantt-scroll">
        <div className="gantt-grid" style={{ minWidth: totalTime * (CELL_PX + 2) + 96 }}>
          {/* Régua de tempo */}
          <div className="gantt-row">
            <div className="gantt-label-col" aria-hidden="true" />
            <div className="gantt-cells" aria-hidden="true">
              {frames.map((_, t) => (
                <span key={t} className={`time-cell ${t === now ? 'is-now' : ''}`} style={{ flex: '1 1 0', minWidth: CELL_PX }}>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Linha da CPU */}
          <div className="gantt-row">
            <div className="gantt-label-col cpu-label">CPU</div>
            <div className="gantt-cells">
              {frames.map((f, t) => {
                const cls =
                  f.cpu === -2 ? 'cell-overload' : f.cpu === -1 ? 'cell-idle' : 'cell-run';
                const text = f.cpu === -2 ? 'troca' : f.cpu === -1 ? '' : nameOf(f.cpu);
                return (
                  <button
                    type="button"
                    key={t}
                    className={`cell ${cls} ${t === now ? 'is-now' : ''}`}
                    style={{
                      flex: '1 1 0', minWidth: CELL_PX,
                      backgroundColor: f.cpu >= 0 ? colorOf(f.cpu) : undefined,
                    }}
                    onClick={() => setNow(t)}
                    aria-label={`Instante ${t}: ${cpuDescription(f.cpu)}`}
                    title={`t = ${t}: ${cpuDescription(f.cpu)}`}
                  >
                    {text && <span className="cell-chip">{text}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Uma linha por processo */}
          {processes.map((p) => (
            <div className="gantt-row" key={p.index}>
              <div className="gantt-label-col process-label" style={{ borderLeftColor: colorOf(p.index) }}>
                {p.name}
              </div>
              <div className="gantt-cells">
                {frames.map((f, t) => {
                  const state = f.states[p.index] ?? 'future';
                  const cls = `cell cell-${state} ${t === now ? 'is-now' : ''}`;
                  return (
                    <button
                      type="button"
                      key={t}
                      className={cls}
                      style={{
                        flex: '1 1 0', minWidth: CELL_PX,
                        backgroundColor:
                          state === 'run' ? colorOf(p.index) : state === 'ready' ? `color-mix(in srgb, ${colorOf(p.index)} 22%, white)` : undefined,
                      }}
                      onClick={() => setNow(t)}
                      aria-label={`Instante ${t}: ${p.name} ${STATE_WORDS[state]}`}
                      title={`t = ${t}: ${p.name} ${STATE_WORDS[state]}`}
                    >
                      {state === 'run' && <span className="cell-chip">{p.name}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="scrubber">
        <label htmlFor="time-scrubber">
          Instante: <strong>t = {now}</strong>
        </label>
        <input
          id="time-scrubber"
          type="range"
          min={0}
          max={Math.max(0, totalTime - 1)}
          value={now}
          onChange={(e) => setNow(Number(e.target.value))}
        />
        {frame && (
          <div className="scrubber-text" aria-live="polite">
            <p className="scrubber-cpu">{cpuDescription(frame.cpu)}</p>
            <ul>
              {processes.map((p) => (
                <li key={p.index}>
                  <span className="color-dot small" style={{ background: colorOf(p.index) }} aria-hidden="true" />
                  <strong>{p.name}</strong> {STATE_WORDS[frame.states[p.index] ?? 'future']}
                </li>
              ))}
            </ul>
          </div>
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
          <span className="legend-swatch striped" aria-hidden="true" />
          Troca de contexto
        </li>
        <li className="legend-item">
          <span className="legend-swatch idle" aria-hidden="true" />
          CPU ociosa
        </li>
      </ul>
      <p className="hint">Cada quadrado é uma unidade de tempo. Clique em um quadrado ou use o controle para ver o que acontece naquele instante.</p>
    </div>
  );
}
