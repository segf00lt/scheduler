import type { ModeInfo } from '../constants.js';
import { MAX_EVENT_DURATION, MAX_QUANTUM, MIN_EVENT_DURATION, MIN_QUANTUM } from '../constants.js';
import type { SchedulerMode } from '../types.js';

interface Props {
  mode: SchedulerMode;
  modes: ModeInfo[];
  quantum: number;
  blockingDuration: number;
  preemptionDuration: number;
  preemptive: boolean;
  theme: 'dark' | 'light';
  busy: boolean;
  onModeChange: (mode: SchedulerMode) => void;
  onQuantumChange: (value: number) => void;
  onBlockingDurationChange: (value: number) => void;
  onPreemptionDurationChange: (value: number) => void;
  onThemeToggle: () => void;
  onRun: () => void;
}

export function TopBar(props: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2.5M9 2h6" />
          </svg>
        </span>
        <div>
          <p className="brand-name">Scheduler</p>
          <p className="brand-sub">OS Process Simulator</p>
        </div>
      </div>

      <div className="topbar-controls">
        <label className="control">
          <span className="control-label">Modo</span>
          <select
            className="control-select"
            value={props.mode}
            onChange={(e) => props.onModeChange(e.target.value as SchedulerMode)}
          >
            {props.modes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>

        <label
          className={`control ${props.preemptive ? '' : 'is-disabled'}`}
          title={
            props.preemptive
              ? 'Quantum: quantas instruções cada processo executa antes de ser interrompido.'
              : 'Este modo não é preemptivo, então o quantum não é usado.'
          }
        >
          <span className="control-label">Quantum</span>
          <input
            type="number"
            className="control-number"
            min={MIN_QUANTUM}
            max={MAX_QUANTUM}
            step={1}
            disabled={!props.preemptive}
            value={Number.isNaN(props.quantum) ? '' : props.quantum}
            aria-label="Quantum (instruções por fatia)"
            onChange={(e) => props.onQuantumChange(e.target.valueAsNumber)}
          />
        </label>

        <label className="control" title="Duração em instantes simulados de input e print.">
          <span className="control-label">Bloqueio</span>
          <input
            type="number"
            className="control-number"
            min={MIN_EVENT_DURATION}
            max={MAX_EVENT_DURATION}
            step={1}
            value={Number.isNaN(props.blockingDuration) ? '' : props.blockingDuration}
            aria-label="Duração de bloqueio em instantes"
            onChange={(e) => props.onBlockingDurationChange(e.target.valueAsNumber)}
          />
        </label>

        <label
          className={`control ${props.preemptive ? '' : 'is-disabled'}`}
          title="Duração em instantes simulados para troca de processo após preempção."
        >
          <span className="control-label">Preempção</span>
          <input
            type="number"
            className="control-number"
            min={MIN_EVENT_DURATION}
            max={MAX_EVENT_DURATION}
            step={1}
            disabled={!props.preemptive}
            value={Number.isNaN(props.preemptionDuration) ? '' : props.preemptionDuration}
            aria-label="Duração de preempção em instantes"
            onChange={(e) => props.onPreemptionDurationChange(e.target.valueAsNumber)}
          />
        </label>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="icon-button"
          onClick={props.onThemeToggle}
          aria-label={props.theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
          title={props.theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        >
          {props.theme === 'dark' ? '☀' : '☾'}
        </button>
        <button type="button" className="run-button" onClick={props.onRun} disabled={props.busy}>
          <span aria-hidden="true">▷</span> {props.busy ? 'Simulando…' : 'Simular'}
        </button>
      </div>
    </header>
  );
}
