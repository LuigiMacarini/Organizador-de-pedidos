/**
 * Instrumentação TEMPORÁRIA para medir o tempo de inicialização do app —
 * parte da auditoria de performance do TCC (ver relatório da tarefa). Só
 * marca o que é observável do lado JS; o tempo do processo nativo (antes do
 * bundle rodar) não aparece aqui — isso o Sentry já mede à parte, do lado
 * nativo, via `enableAppStartTracking` (ver app/_layout.tsx). Remover (ou
 * silenciar atrás de `__DEV__`) depois de coletar as medições do
 * experimento — não é para ficar em produção indefinidamente.
 */
const bootTs = Date.now();

export type StartupMark = { label: string; msSinceBoot: number };

const marks: StartupMark[] = [];

/** `label` deve ser estável (mesmo texto sempre) para dar pra comparar entre execuções. */
export function markStartup(label: string): void {
  const msSinceBoot = Date.now() - bootTs;
  marks.push({ label, msSinceBoot });
  console.log(`[startup] ${label} +${msSinceBoot}ms`);
}

/** Snapshot dos marcos já registrados nesta sessão do app — útil pra inspecionar em runtime, se necessário. */
export function getStartupMarks(): StartupMark[] {
  return marks.slice();
}
