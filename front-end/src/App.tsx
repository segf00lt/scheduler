import { useEffect, useState } from 'react';
import { fetchPrograms, runScheduler } from './api';
import { ProcessEditor, type ProcessDraft } from './components/ProcessEditor';
import { ResultView } from './components/ResultView';
import { TopBar } from './components/TopBar';
import { DEFAULT_QUANTUM, MODES } from './constants';
import type { ProgramInfo, RunResult, SchedulerMode } from './types';

// Os dois primeiros exemplos vêm carregados. São os mesmos arquivos de tests/ do back-end.
const INITIAL_PROCESSES: ProcessDraft[] = [
  { example: 'fibonacci', source: '' },
  { example: 'test2', source: '' },
];

const INITIAL_INPUTS = '8';

export default function App() {
  const [programs, setPrograms] = useState<ProgramInfo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<SchedulerMode>('round_robin');
  const [quantum, setQuantum] = useState<number>(DEFAULT_QUANTUM);
  const [processes, setProcesses] = useState<ProcessDraft[]>(INITIAL_PROCESSES);
  const [activeProcess, setActiveProcess] = useState(0);
  const [inputsText, setInputsText] = useState(INITIAL_INPUTS);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    fetchPrograms()
      .then(({ programs: list }) => {
        setPrograms(list);
        // Preenche o código dos processos iniciais a partir dos exemplos carregados.
        setProcesses((current) =>
          current.map((draft) => {
            const example = list.find((program) => program.id === draft.example);
            return example ? { ...draft, source: example.source } : draft;
          }),
        );
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Erro ao carregar exemplos.'));
  }, []);

  const modeInfo = MODES.find((m) => m.id === mode) ?? MODES[0]!;

  const handleRun = async () => {
    const inputs = inputsText
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value !== '');

    setBusy(true);
    setRunError(null);
    try {
      const data = await runScheduler({
        mode,
        quantum,
        processes: processes.map((draft) => ({ source: draft.source })),
        inputs,
      });
      setResult(data);
    } catch (error) {
      setResult(null);
      setRunError(error instanceof Error ? error.message : 'Algo inesperado aconteceu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app" data-theme={theme}>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>

      <TopBar
        mode={mode}
        modes={MODES}
        quantum={quantum}
        theme={theme}
        busy={busy}
        onModeChange={setMode}
        onQuantumChange={setQuantum}
        preemptive={modeInfo.preemptive}
        onThemeToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        onRun={handleRun}
      />

      <main id="conteudo" className="workspace">
        <aside className="panel panel-left" aria-label="Montagem do cenário">
          {loadError && (
            <div className="alert" role="alert">
              {loadError}
            </div>
          )}
          <ProcessEditor
            programs={programs}
            processes={processes}
            activeIndex={activeProcess}
            onActiveChange={setActiveProcess}
            onProcessesChange={setProcesses}
            inputsText={inputsText}
            onInputsChange={setInputsText}
            modeNote={modeInfo.note}
          />
        </aside>

        <section className="panel panel-right" aria-label="Resultado da simulação">
          <ResultView result={result} runError={runError} busy={busy} processCount={processes.length} />
        </section>
      </main>
    </div>
  );
}
