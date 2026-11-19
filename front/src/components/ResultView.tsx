import { useState } from 'react';
import type { RunResult } from '../types.js';
import { ConsoleView } from './ConsoleView.js';
import { SummaryView } from './SummaryView.js';
import { TimelineView } from './TimelineView.js';

interface Props {
  result: RunResult | null;
  runError: string | null;
  busy: boolean;
  processCount: number;
}

type Tab = 'timeline' | 'console' | 'summary';

const TABS: { id: Tab; label: string }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'console', label: 'Console' },
  { id: 'summary', label: 'Resumo' },
];

const STATUS_TEXT: Record<Exclude<RunResult['status'], 'ok'>, string> = {
  error: 'O back-end recusou o programa',
  missing_input: 'Entrada faltando',
  timeout: 'Tempo esgotado',
  invalid: 'Pedido inválido',
};

export function ResultView({ result, runError, busy, processCount }: Props) {
  const [tab, setTab] = useState<Tab>('timeline');

  return (
    <div className="result">
      <div className="result-head">
        <div className="tabs" role="tablist" aria-label="Visões do resultado">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`tab ${tab === item.id ? 'is-on' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              {item.id === 'timeline' && result && <span className="tab-count">{result.events.length}</span>}
            </button>
          ))}
        </div>
        {result && (
          <div className="badges">
            <span className="badge">{result.events.length} eventos</span>
            <span className="badge">{processCount} processos</span>
          </div>
        )}
      </div>

      {runError && (
        <div className="banner is-error" role="alert">
          <strong>Não foi possível simular.</strong> {runError}
        </div>
      )}

      {result && result.status !== 'ok' && (
        <div className={`banner ${result.status === 'error' ? 'is-error' : 'is-warn'}`} role="alert">
          <strong>{STATUS_TEXT[result.status]}.</strong> {result.message}
        </div>
      )}

      {result && result.status === 'ok' && (
        <div className="banner is-ok" role="status">
          Simulação concluída. Veja a ordem dos eventos na Timeline.
        </div>
      )}

      {!result && !runError && (
        <section className="empty-state" aria-labelledby="empty-title">
          <h2 id="empty-title" className="section-title">
            Resultado
          </h2>
          <p className="hint">
            Escolha o modo, o código assembly de cada processo e as entradas. Depois clique em Simular: o programa é
            executado pelo back-end (<code>back/scheduler.ts</code>) e o resultado aparece aqui.
          </p>
          {busy && <p className="hint">Executando…</p>}
        </section>
      )}

      {result && (
        <div className="result-body" role="tabpanel">
          {tab === 'timeline' && <TimelineView result={result} />}
          {tab === 'console' && <ConsoleView result={result} />}
          {tab === 'summary' && <SummaryView result={result} />}
        </div>
      )}
    </div>
  );
}
