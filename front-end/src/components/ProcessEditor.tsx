import type { Algorithm, AlgorithmId, ApiError, ProcessRow } from '../types';
import { MAX_PROCESSES, PROCESS_COLORS } from '../constants';

interface Props {
  algorithms: Algorithm[];
  algorithmId: AlgorithmId;
  quantum: number;
  processes: ProcessRow[];
  errors: ApiError[];
  busy: boolean;
  onAlgorithmChange: (id: AlgorithmId) => void;
  onQuantumChange: (value: number) => void;
  overloadEnabled: boolean;
  overloadTime: number;
  onOverloadEnabledChange: (value: boolean) => void;
  onOverloadTimeChange: (value: number) => void;
  onProcessesChange: (rows: ProcessRow[]) => void;
  onRun: () => void;
}

type Field = 'name' | 'arrival' | 'burst' | 'priority';

const FIELD_LABELS: Record<Exclude<Field, 'name'>, string> = {
  arrival: 'Chegada',
  burst: 'Duração',
  priority: 'Prioridade',
};

const NAME_OPTIONS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

export function ProcessEditor(props: Props) {
  const { algorithms, algorithmId, quantum, processes, errors, busy } = props;
  const selected = algorithms.find((a) => a.id === algorithmId);

  const errorFor = (row: number | null, field: string) =>
    errors.find((e) => e.row === row && e.field === field)?.message;

  const updateRow = (index: number, patch: Partial<ProcessRow>) =>
    props.onProcessesChange(processes.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const addRow = () => {
    if (processes.length >= MAX_PROCESSES) return;
    const used = new Set(processes.map((p) => p.name));
    const name = NAME_OPTIONS.find((n) => !used.has(n)) ?? `P${processes.length + 1}`;
    props.onProcessesChange([...processes, { name, arrival: 0, burst: 3, priority: 1 }]);
  };

  const removeRow = (index: number) => props.onProcessesChange(processes.filter((_, i) => i !== index));

  const numberField = (index: number, field: Exclude<Field, 'name'>) => {
    const id = `p${index}-${field}`;
    const message = errorFor(index, field);
    const value = processes[index]?.[field] ?? 0;
    return (
      <div className="mini-field">
        <label htmlFor={id}>{FIELD_LABELS[field]}</label>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={field === 'burst' ? 1 : 0}
          step={1}
          value={Number.isNaN(value) ? '' : value}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${id}-error` : undefined}
          onChange={(e) => updateRow(index, { [field]: e.target.valueAsNumber } as Partial<ProcessRow>)}
        />
        {message && (
          <span className="field-error" id={`${id}-error`}>
            {message}
          </span>
        )}
      </div>
    );
  };

  return (
    <section className="card" aria-labelledby="algorithm-title">
      <h2 id="algorithm-title" className="section-title">
        1. Algoritmo
      </h2>

      <fieldset className="segmented-wrap">
        <legend className="visually-hidden">Escolha o algoritmo</legend>
        <div className="segmented" role="radiogroup">
          {algorithms.map((algorithm) => {
            const checked = algorithm.id === algorithmId;
            return (
              <label key={algorithm.id} className={`segment ${checked ? 'is-on' : ''}`}>
                <input
                  type="radio"
                  name="algorithm"
                  value={algorithm.id}
                  checked={checked}
                  onChange={() => props.onAlgorithmChange(algorithm.id)}
                />
                <span>{algorithm.shortName}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {selected && (
        <p className="rule" aria-live="polite">
          {selected.rule}
        </p>
      )}

      {selected?.usesQuantum && (
        <div className="quantum-row">
          <label htmlFor="quantum">Quantum (fatia de tempo)</label>
          <input
            id="quantum"
            type="number"
            min={1}
            step={1}
            value={Number.isNaN(quantum) ? '' : quantum}
            aria-invalid={errorFor(null, 'quantum') ? true : undefined}
            aria-describedby={errorFor(null, 'quantum') ? 'quantum-error' : undefined}
            onChange={(e) => props.onQuantumChange(e.target.valueAsNumber)}
          />
          {errorFor(null, 'quantum') && (
            <span className="field-error" id="quantum-error">
              {errorFor(null, 'quantum')}
            </span>
          )}
        </div>
      )}

      {selected?.preemptive && (
        <div className="overload-box">
          <label className="check-row">
            <input
              type="checkbox"
              checked={props.overloadEnabled}
              onChange={(e) => props.onOverloadEnabledChange(e.target.checked)}
            />
            <span>Considerar troca de contexto</span>
          </label>
          <p className="hint">
            Cada interrupção faz a CPU gastar um tempo trocando de processo. Nesse tempo, ninguém executa.
          </p>
          {props.overloadEnabled && (
            <div className="quantum-row">
              <label htmlFor="overload-time">Tempo gasto a cada troca (unidades)</label>
              <input
                id="overload-time"
                type="number"
                min={0}
                max={5}
                step={1}
                value={Number.isNaN(props.overloadTime) ? '' : props.overloadTime}
                aria-invalid={errorFor(null, 'overload') ? true : undefined}
                aria-describedby={errorFor(null, 'overload') ? 'overload-error' : undefined}
                onChange={(e) => props.onOverloadTimeChange(e.target.valueAsNumber)}
              />
              {errorFor(null, 'overload') && (
                <span className="field-error" id="overload-error">
                  {errorFor(null, 'overload')}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <h2 className="section-title section-spaced">2. Processos</h2>
      <ul className="process-list">
        {processes.map((row, index) => {
          const nameError = errorFor(index, 'name');
          return (
            <li key={index} className="process-card">
              <div className="process-head">
                <span
                  className="color-dot"
                  style={{ background: PROCESS_COLORS[index]?.hex }}
                  role="img"
                  aria-label={`Cor do processo ${row.name}: ${PROCESS_COLORS[index]?.name}`}
                />
                <label className="visually-hidden" htmlFor={`p${index}-name`}>
                  Nome do processo {index + 1}
                </label>
                <input
                  id={`p${index}-name`}
                  className="name-input"
                  type="text"
                  maxLength={12}
                  value={row.name}
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? `p${index}-name-error` : undefined}
                  onChange={(e) => updateRow(index, { name: e.target.value })}
                />
                <button
                  type="button"
                  className="remove-button"
                  onClick={() => removeRow(index)}
                  disabled={processes.length <= 1}
                  aria-label={`Remover ${row.name}`}
                >
                  Remover
                </button>
              </div>
              {nameError && (
                <span className="field-error" id={`p${index}-name-error`}>
                  {nameError}
                </span>
              )}
              <div className="mini-grid">
                {numberField(index, 'arrival')}
                {numberField(index, 'burst')}
                {numberField(index, 'priority')}
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="add-button"
        onClick={addRow}
        disabled={processes.length >= MAX_PROCESSES}
      >
        Adicionar processo
      </button>
      <p className="hint">
        Chegada: quando entra na fila. Duração: tempo de CPU necessário.
        {selected?.usesPriority && ' Prioridade: número menor é mais importante.'}
      </p>

      <button type="button" className="run-button" onClick={props.onRun} disabled={busy}>
        {busy ? 'Simulando…' : 'Simular'}
      </button>
    </section>
  );
}
