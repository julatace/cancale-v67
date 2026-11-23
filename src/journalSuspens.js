// ── LE JOURNAL DES ATTENTES (22 nov., P0 « le blocage des onglets ») ─────────────────────────────────────────────────────
// Diagnostic SEULEMENT quand un banc l'allume (`window.__vrmJournalSuspens = []` posé avant l'app) : chaque bloc qui suspend
// (un écran gardé gelé, un morceau à la demande pas encore là), chaque transition d'onglet partie / aboutie. Rien sinon.
export function noterSuspens(sorte, quoi) {
  try {
    const J = typeof window !== 'undefined' ? window.__vrmJournalSuspens : null;
    if (!Array.isArray(J)) return;
    const tr = window.__vrmTransitionOnglet || null;
    J.push({ t: Math.round(performance.now()), sorte, quoi: String(quoi || '').slice(0, 90), transition: tr ? tr.id : '' });
    if (J.length > 400) J.splice(0, J.length - 400);
  } catch (_) {}
}
