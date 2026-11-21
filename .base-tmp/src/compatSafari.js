// ════════════════════════════════════════════════════════════════════════════
//  CE QUI MANQUE AUX ANCIENS SAFARI — un seul endroit (11 nov., lot webkit-fiable)
//  L'app vise iOS 15.4 et plus (iPhone 6s/7/SE 1 restent en iOS 15). Ce qui y
//  manque ne doit JAMAIS être appelé nu : un appel absent lève un TypeError au
//  clic et le geste « ne fait rien ». `scripts/audit-safari.cjs` l'interdit.
// ════════════════════════════════════════════════════════════════════════════

// AbortSignal.timeout : Safari 16.0. Sinon un AbortController et un minuteur
// (même comportement : la requête est interrompue au bout de `ms`, avec une
// erreur nommée « TimeoutError » quand le navigateur sait la porter).
export function signalDelai(ms) {
  try { if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms); } catch (_) {}
  const c = new AbortController();
  setTimeout(() => { try { c.abort(typeof DOMException === 'function' ? new DOMException('Délai dépassé', 'TimeoutError') : undefined); } catch (_) { try { c.abort(); } catch (__) {} } }, ms);
  return c.signal;
}
