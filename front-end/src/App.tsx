import { useEffect, useState } from 'react';
import { ApiFailure, fetchAlgorithms, runSimulation } from './api';
import { ProcessEditor } from './components/ProcessEditor';
import { ResultView } from './components/ResultView';
import { GLOSSARY } from './constants';
import type { Algorithm, AlgorithmId, ApiError, ProcessRow, SimulationResult } from './types';

const INITIAL_PROCESSES: ProcessRow[] = [
  { name: 'P1', arrival: 0, burst: 4, priority: 2 },
  { name: 'P2', arrival: 1, burst: 3, priority: 1 },
  { name: 'P3', arrival: 2, burst: 1, priority: 3 },
];

export default function App() {
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [algorithmId, setAlgorithmId] = useState<AlgorithmId>('fifo');
  const [quantum, setQuantum] = useState(2);
  const [overloadEnabled, setOverloadEnabled] = useState(true);
  const [overloadTime, setOverloadTime] = useState(1);
  const [processes, setProcesses] = useState<ProcessRow[]>(INITIAL_PROCESSES);
  const [errors, setErrors] = useState<ApiError[]>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchAlgorithms()
      .then(setAlgorithms)
      .catch((error: unknown) => {
        if (error instanceof ApiFailure) setErrors(error.errors);
      });
  }, []);

  const algorithm = algorithms.find((a) => a.id === algorithmId);

  const handleRun = async () => {
    setBusy(true);
    setStatus('Simulando…');
    try {
      // Só algoritmos preemptivos têm troca de contexto; sem a opção marcada, o tempo é zero.
      const preemptive = algorithm?.preemptive ?? false;
      const overload = preemptive && overloadEnabled ? overloadTime : 0;
      const data = await runSimulation({ algorithm: algorithmId, quantum, overload, processes });
      setErrors([]);
      setResult(data);
      setStatus('Simulação pronta.');
    } catch (error) {
      setResult(null);
      if (error instanceof ApiFailure) {
        setErrors(error.errors);
        setStatus(error.offline ? 'O back-end não respondeu.' : 'Há erros nos dados.');
      } else {
        setStatus('Algo inesperado aconteceu.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>

      <header className="app-header">
        <div>
          <h1>Escalonamento de CPU</h1>
          <p>Escolha um algoritmo, cadastre os processos e veja quem usa a CPU a cada instante.</p>
        </div>
      </header>

      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>

      <main id="conteudo" className="workspace">
        <div className="workspace-side">
          {errors.length > 0 && (
            <section className="alert" role="alert" aria-labelledby="alert-title">
              <h2 id="alert-title">Corrija para simular</h2>
              <ul>
                {errors.map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
              </ul>
            </section>
          )}

          <ProcessEditor
            algorithms={algorithms}
            algorithmId={algorithmId}
            quantum={quantum}
            processes={processes}
            errors={errors}
            busy={busy}
            onAlgorithmChange={setAlgorithmId}
            onQuantumChange={setQuantum}
            overloadEnabled={overloadEnabled}
            overloadTime={overloadTime}
            onOverloadEnabledChange={setOverloadEnabled}
            onOverloadTimeChange={setOverloadTime}
            onProcessesChange={setProcesses}
            onRun={handleRun}
          />

          <details className="glossary">
            <summary>O que significam os termos?</summary>
            <dl>
              {GLOSSARY.map((item) => (
                <div key={item.term} className="glossary-item">
                  <dt>{item.term}</dt>
                  <dd>{item.meaning}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>

        <div className="workspace-main">
          {result ? (
            <ResultView
              result={result}
              algorithmName={algorithm?.name ?? result.algorithm}
              algorithmRule={algorithm?.rule ?? ''}
            />
          ) : (
            <section className="card empty-state" aria-labelledby="empty-title">
              <h2 id="empty-title" className="section-title">
                3. Resultado
              </h2>
              <p className="hint">
                Monte o cenário à esquerda e clique em Simular. O diagrama de Gantt, os indicadores e o registro de
                eventos aparecem aqui.
              </p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
