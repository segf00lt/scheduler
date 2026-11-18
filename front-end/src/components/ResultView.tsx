import type { SimulationResult } from '../types';
import { LOG_LABELS, PROCESS_COLORS } from '../constants';
import { GanttChart } from './GanttChart';

interface Props {
  result: SimulationResult;
  algorithmName: string;
  algorithmRule: string;
}

const fmt = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export function ResultView({ result, algorithmName }: Props) {
  const { metrics, processStats, logs, processes, preemptive, overload } = result;
  const colorOf = (name: string | null) => {
    const index = processes.find((p) => p.name === name)?.index;
    return index === undefined ? '#8A8F98' : PROCESS_COLORS[index]?.hex ?? '#8A8F98';
  };

  // Indicadores principais: os mesmos nomes e a mesma ordem do exemplo.
  const indicators = [
    { label: 'Espera média', value: fmt(metrics.averageWaitingTime), help: 'Tempo pronto sem usar a CPU.' },
    { label: 'Turnaround médio', value: fmt(metrics.averageTurnaroundTime), help: 'Da chegada até o término.' },
    { label: 'Resposta média', value: fmt(metrics.averageResponseTime), help: 'Da chegada até a 1ª vez na CPU.' },
    { label: 'CPU ociosa', value: `${fmt(metrics.idlePercentage)}%`, help: 'Parte do tempo sem ninguém na CPU.' },
  ];

  // Indicadores de interrupção: só fazem sentido em algoritmos preemptivos.
  const preemptionIndicators = [
    { label: 'Preempções', value: String(metrics.preemptions), help: 'Vezes em que um processo foi tirado da CPU antes de terminar.' },
    { label: 'Trocas de contexto', value: String(metrics.contextSwitches), help: 'Trocas em que a CPU gastou tempo para mudar de processo.' },
    {
      label: 'Tempo gasto em trocas',
      value: `${metrics.overloadUnits} un.`,
      help: `${overload} unidade(s) por troca, sem processo executando.`,
    },
  ];

  return (
    <section className="card" aria-labelledby="result-title">
      <h2 id="result-title" className="section-title">
        3. Resultado
      </h2>
      <p className="result-summary">
        <strong>{algorithmName}</strong> · tempo total de {result.totalTime} unidades.
      </p>

      <h3 className="sub-title">Diagrama de Gantt</h3>
      <GanttChart result={result} />

      <h3 className="sub-title">Indicadores</h3>
      <ul className="indicator-grid">
        {indicators.map((item) => (
          <li key={item.label} className="indicator">
            <span className="indicator-value">{item.value}</span>
            <span className="indicator-label">{item.label}</span>
            <span className="indicator-help">{item.help}</span>
          </li>
        ))}
      </ul>

      {preemptive ? (
        <>
          <h3 className="sub-title">Interrupções</h3>
          <ul className="indicator-grid">
            {preemptionIndicators.map((item) => (
              <li key={item.label} className="indicator indicator-accent">
                <span className="indicator-value">{item.value}</span>
                <span className="indicator-label">{item.label}</span>
                <span className="indicator-help">{item.help}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="hint">Este algoritmo não interrompe processos: não há preempções nem trocas de contexto.</p>
      )}

      <h3 className="sub-title">Por processo</h3>
      <div className="table-scroll">
        <table className="stats-table">
          <thead>
            <tr>
              <th scope="col">Processo</th>
              <th scope="col">Chegada</th>
              <th scope="col">Duração</th>
              <th scope="col">1ª vez na CPU</th>
              <th scope="col">Término</th>
              <th scope="col">Espera</th>
              <th scope="col">Turnaround</th>
              <th scope="col">Resposta</th>
              <th scope="col">Preempções</th>
            </tr>
          </thead>
          <tbody>
            {processStats.map((stat) => (
              <tr key={stat.name}>
                <th scope="row">
                  <span className="color-dot small" style={{ background: colorOf(stat.name) }} aria-hidden="true" />
                  {stat.name}
                </th>
                <td>{stat.arrival}</td>
                <td>{stat.burst}</td>
                <td>{stat.firstStart}</td>
                <td>{stat.finish}</td>
                <td>{stat.waitingTime}</td>
                <td>{stat.turnaroundTime}</td>
                <td>{stat.responseTime}</td>
                <td>{stat.preemptions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="sub-title">Registro de eventos</h3>
      <ol className="log-list">
        {logs.map((log, index) => (
          <li key={index} className="log-item">
            <span className="log-time">{log.time}</span>
            <span
              className="color-dot small"
              style={{ background: log.process ? colorOf(log.process) : '#8A8F98' }}
              aria-hidden="true"
            />
            <span className="log-text">
              <span className={`log-tag tag-${log.type}`}>{LOG_LABELS[log.type]}</span>
              {log.message}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
