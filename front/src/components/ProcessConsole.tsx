import { useMemo, useState } from 'react';
import type { SchedulerEvent } from '../types.js';

interface Props {
  process: number;
  events: SchedulerEvent[];
  waitingInput: { process: number; register: number } | null;
  running: boolean;
  onSubmit: (value: string) => Promise<void>;
}

export function ProcessConsole({ process, events, waitingInput, running, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const output = useMemo(() => {
    const rows: string[] = [];
    for (const event of events) {
      if (event.process !== process) continue;
      if (event.kind === 'print') rows.push(`print r${event.register} = ${event.value}`);
      if (event.kind === 'input') rows.push(`input r${event.register} =${event.value !== null ? ` ${event.value}` : ''}`);
    }
    return rows;
  }, [process, events]);
  const isWaiting = waitingInput?.process === process;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await onSubmit(value);
      setValue('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar a entrada.');
    }
  };

  return (
    <section className="process-console" aria-label={`Console do processo P${process}`}>
      <div className="section-head">
        <h3 className="section-title">Console · P{process}</h3>
        <span className={`console-status ${isWaiting ? 'is-waiting' : ''}`}>
          {isWaiting ? 'aguardando entrada' : running ? 'executando' : 'parado'}
        </span>
      </div>
      <pre className="process-console-output" aria-live="polite">
        {output.length ? output.join('\n') : 'A saída deste processo aparecerá aqui.'}
      </pre>
      <form className="process-console-form" onSubmit={submit}>
        <label className="visually-hidden" htmlFor={`process-input-${process}`}>Entrada para P{process}</label>
        <input
          id={`process-input-${process}`}
          className="text-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={isWaiting ? `Valor para r${waitingInput?.register}` : 'Aguardando pedido de input…'}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={!isWaiting}
        />
        <button className="ghost-button" type="submit" disabled={!isWaiting || value.trim() === ''}>Enviar</button>
      </form>
      {error && <p className="hint console-input-error" role="alert">{error}</p>}
    </section>
  );
}
