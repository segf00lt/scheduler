import type { RunResult } from '../types.js';

interface Props {
  result: RunResult;
}

// Saída bruta do back-end, sem nenhuma tradução: é exatamente o que o terminal mostraria.
export function ConsoleView({ result }: Props) {
  return (
    <div className="console">
      <h3 className="sub-title">Saída padrão (stdout)</h3>
      <pre className="console-box" aria-label="Saída do back-end">
        {result.stdout || '(sem saída)'}
      </pre>

      {result.stderr && (
        <>
          <h3 className="sub-title">Erros (stderr)</h3>
          <pre className="console-box is-error">{result.stderr}</pre>
        </>
      )}

      <p className="hint">
        Código de saída: {result.exitCode ?? '—'}. Entradas enviadas ao stdin: {result.inputsUsed.length ? result.inputsUsed.join(', ') : 'nenhuma'}.
      </p>
    </div>
  );
}
