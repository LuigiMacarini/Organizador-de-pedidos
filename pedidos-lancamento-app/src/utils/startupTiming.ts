/**
 * Instrumentação TEMPORÁRIA pra medir o tempo de inicialização do app.
 * Só marca o que é observável do lado JS; o tempo do processo nativo já é medido
 * à parte pelo Sentry (`enableAppStartTracking`). Remover depois de coletar as
 * medições, não é pra ficar em produção.
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

/** Snapshot dos marcos já registrados nesta sessão do app. */
export function getStartupMarks(): StartupMark[] {
  return marks.slice();
}
