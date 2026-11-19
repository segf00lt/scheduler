import { useEffect, useState } from 'react';
import { fetchPrograms, getRunSnapshot, startScheduler, submitRunInput } from './api.js';
import { ProcessEditor, type ProcessDraft } from './components/ProcessEditor.js';
import { ResultView } from './components/ResultView.js';
import { TopBar } from './components/TopBar.js';
import { DEFAULT_BLOCKING_DURATION, DEFAULT_PREEMPTION_DURATION, DEFAULT_QUANTUM, MODES } from './constants.js';
import type { ProgramInfo, RunResult, SchedulerEvent, SchedulerMode } from './types.js';

// Os dois primeiros exemplos vêm carregados. São os mesmos arquivos de tests/ do back-end.
const INITIAL_PROCESSES: ProcessDraft[] = [
  { example: 'fibonacci', source: '' },
  { example: 'test2', source: '' },
];

export default function App() {
  const [programs, setPrograms] = useState<ProgramInfo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<SchedulerMode>('round_robin');
  const [quantum, setQuantum] = useState<number>(DEFAULT_QUANTUM);
  const [blockingDuration, setBlockingDuration] = useState<number>(DEFAULT_BLOCKING_DURATION);
  const [preemptionDuration, setPreemptionDuration] = useState<number>(DEFAULT_PREEMPTION_DURATION);
  const [processes, setProcesses] = useState<ProcessDraft[]>(INITIAL_PROCESSES);
  const [activeProcess, setActiveProcess] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [liveEvents, setLiveEvents] = useState<SchedulerEvent[]>([]);
  const [waitingInput, setWaitingInput] = useState<{ process: number; register: number } | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
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
    setBusy(true);
    setRunError(null);
    setResult(null);
    setLiveEvents([]);
    setWaitingInput(null);
    try {
      const id = await startScheduler({
        mode,
        quantum,
        blockingDuration,
        preemptionDuration,
        processes: processes.map((draft) => ({ source: draft.source })),
      });
      setRunId(id);
      while (true) {
        const snapshot = await getRunSnapshot(id);
        setLiveEvents(snapshot.events);
        setWaitingInput(snapshot.waitingInput);
        if (snapshot.status === 'done') {
          setResult(snapshot.result);
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 180));
      }
    } catch (error) {
      setResult(null);
      setRunError(error instanceof Error ? error.message : 'Algo inesperado aconteceu.');
    } finally {
      setBusy(false);
      setWaitingInput(null);
    }
  };

  const handleInput = async (value: string) => {
    if (!runId) throw new Error('Não há simulação ativa.');
    await submitRunInput(runId, value);
    setWaitingInput(null);
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
        blockingDuration={blockingDuration}
        preemptionDuration={preemptionDuration}
        theme={theme}
        busy={busy}
        onModeChange={setMode}
        onQuantumChange={setQuantum}
        onBlockingDurationChange={setBlockingDuration}
        onPreemptionDurationChange={setPreemptionDuration}
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
            modeNote={modeInfo.note}
            events={liveEvents}
            waitingInput={waitingInput}
            running={busy}
            onSubmitInput={handleInput}
          />
        </aside>

        <section className="panel panel-right" aria-label="Resultado da simulação">
          <ResultView result={result} runError={runError} busy={busy} processCount={processes.length} />
        </section>
      </main>
    </div>
  );
}
