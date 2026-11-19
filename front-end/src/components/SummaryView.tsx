import type { RunResult } from '../types';
import { MODES, PROCESS_COLORS } from '../constants';

interface Props {
  result: RunResult;
}

const fmtQuantum = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function SummaryView({ result }: Props) {
  const { processes, events, mode, inputsUsed } = result;
  const modeInfo = MODES.find((m) => m.id === mode);
  const finished = processes.filter((p) => p.exitOrder !== null).length;
  const prints = events.filter((e) => e.kind === 'print').length;

  const cards = [
    { label: 'Modo', value: modeInfo?.label ?? mode, help: modeInfo?.preemptive ? 'Preemptivo' : 'Não preemptivo' },
    { label: 'Terminaram', value: `${finished} de ${processes.length}`, help: 'Processos que chegaram ao fim.' },
    { label: 'Prints', value: String(prints), help: 'Valores impressos pelos processos.' },
    { label: 'Entradas usadas', value: String(inputsUsed.length), help: inputsUsed.length ? inputsUsed.join(', ') : 'Nenhuma.' },
  ];

  return (
    <div className="summary">
      <ul className="indicator-grid">
        {cards.map((card) => (
          <li key={card.label} className="indicator">
            <span className="indicator-value">{card.value}</span>
            <span className="indicator-label">{card.label}</span>
            <span className="indicator-help">{card.help}</span>
          </li>
        ))}
      </ul>

      <h3 className="sub-title">Por processo</h3>
      <div className="table-scroll">
        <table className="stats-table">
          <thead>
            <tr>
              <th scope="col">Processo</th>
              <th scope="col">Pediu entrada</th>
              <th scope="col">Preempções</th>
              <th scope="col">Prints (r0)</th>
              <th scope="col">Ordem de término</th>
              <th scope="col">Quantum médio usado</th>
            </tr>
          </thead>
          <tbody>
            {processes.map((stat) => (
              <tr key={stat.id}>
                <th scope="row">
                  <span
                    className="color-dot small"
                    style={{ background: PROCESS_COLORS[stat.id] ?? PROCESS_COLORS[0] }}
                    aria-hidden="true"
                  />
                  P{stat.id}
                </th>
                <td>{stat.requestedInput}</td>
                <td>{stat.preemptions}</td>
                <td>{stat.prints.length ? stat.prints.join(', ') : '—'}</td>
                <td>{stat.exitOrder ?? '—'}</td>
                <td>
                  {stat.averageQuantum === null || !modeInfo?.preemptive
                    ? '—'
                    : fmtQuantum(stat.averageQuantum)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!modeInfo?.preemptive && (
        <p className="hint">Quantum médio só é medido em modos preemptivos. Em {modeInfo?.label ?? mode}, o back-end não o calcula.</p>
      )}
    </div>
  );
}
