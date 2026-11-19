import type { ProgramInfo, SchedulerEvent } from '../types.js';
import { MAX_PROCESSES, PROCESS_COLORS } from '../constants.js';
import { ProcessConsole } from './ProcessConsole.js';

export interface ProcessDraft {
  // Exemplo de onde veio o código (id de tests/*.asm), ou null se o usuário editou/escreveu.
  example: string | null;
  source: string;
}

interface Props {
  programs: ProgramInfo[];
  processes: ProcessDraft[];
  activeIndex: number;
  onActiveChange: (index: number) => void;
  onProcessesChange: (rows: ProcessDraft[]) => void;
  modeNote: string;
  events: SchedulerEvent[];
  waitingInput: { process: number; register: number } | null;
  running: boolean;
  onSubmitInput: (value: string) => Promise<void>;
}

const NEW_PROCESS_SOURCE = 'set r0, 1\nprint r0\nset r1, 2\n';

export function ProcessEditor(props: Props) {
  const { programs, processes, activeIndex, onProcessesChange } = props;
  const active = processes[activeIndex] ?? processes[0];
  const activeColor = PROCESS_COLORS[activeIndex] ?? PROCESS_COLORS[0];

  const updateActive = (patch: Partial<ProcessDraft>) =>
    onProcessesChange(processes.map((row, i) => (i === activeIndex ? { ...row, ...patch } : row)));

  const addProcess = () => {
    if (processes.length >= MAX_PROCESSES) return;
    onProcessesChange([...processes, { example: null, source: NEW_PROCESS_SOURCE }]);
    props.onActiveChange(processes.length);
  };

  const removeProcess = (index: number) => {
    if (processes.length <= 1) return;
    const next = processes.filter((_, i) => i !== index);
    onProcessesChange(next);
    props.onActiveChange(Math.max(0, Math.min(activeIndex, next.length - 1)));
  };

  const pickExample = (value: string) => {
    if (value === 'custom') {
      updateActive({ example: null });
      return;
    }
    const program = programs.find((p) => p.id === value);
    if (program) updateActive({ example: program.id, source: program.source });
  };

  const selectedExample = active?.example ?? 'custom';

  return (
    <div className="editor">
      <div className="section-head">
        <h2 className="section-title">Processos</h2>
        <button type="button" className="ghost-button" onClick={addProcess} disabled={processes.length >= MAX_PROCESSES}>
          + Adicionar
        </button>
      </div>

      <div className="tabs process-tabs" role="tablist" aria-label="Processos">
        {processes.map((row, index) => {
          const selected = index === activeIndex;
          const color = PROCESS_COLORS[index] ?? PROCESS_COLORS[0];
          return (
            <div key={index} className={`process-tab ${selected ? 'is-on' : ''}`}>
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                className="process-tab-main"
                onClick={() => props.onActiveChange(index)}
              >
                <span className="color-dot" style={{ background: color }} aria-hidden="true" />
                P{index}
              </button>
              {processes.length > 1 && (
                <button
                  type="button"
                  className="process-tab-x"
                  onClick={() => removeProcess(index)}
                  aria-label={`Remover P${index}`}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="field-row">
        <label htmlFor="example-select" className="field-label">
          Código assembly
        </label>
        <select
          id="example-select"
          className="select"
          value={selectedExample}
          onChange={(e) => pickExample(e.target.value)}
        >
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.file}
              {program.hasCode ? '' : ' (sem instruções)'}
            </option>
          ))}
          <option value="custom">Personalizado</option>
        </select>
      </div>

      <p className="hint mode-note">{props.modeNote}</p>

      <div className="code-box" style={{ borderColor: activeColor }}>
        <label htmlFor="asm-source" className="visually-hidden">
          Código assembly do P{activeIndex}
        </label>
        <textarea
          id="asm-source"
          className="code-area"
          spellCheck={false}
          value={active?.source ?? ''}
          onChange={(e) => updateActive({ source: e.target.value, example: null })}
          rows={14}
        />
      </div>

      <ProcessConsole
        process={activeIndex}
        events={props.events}
        waitingInput={props.waitingInput}
        running={props.running}
        onSubmit={props.onSubmitInput}
      />

      <details className="notice">
        <summary>Por que não há prioridade, chegada ou duração?</summary>
        <p className="hint">
          O back-end lê só os arquivos assembly. Todos os processos chegam juntos (instante 0), entram com prioridade 0 e
          a duração é o próprio programa. O quantum você escolhe no topo (padrão 6).
        </p>
      </details>
    </div>
  );
}
