// ═══════════════════════════════════════════════════════════════════════════
//  LES FEUILLES « IDÉES ARGENT » — une seule porte, montée une fois (14 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// 159 Dépense en photo · 160 Vente en main propre · 162 Partager en image.
// N'importe quel écran (⌘K, Compta, la fiche d'une paire, un lien `?idee=…`)
// appelle `ouvrirIdee(quoi, detail)` ; cette racine, montée UNE fois dans la coque
// après la session, charge les feuilles À LA DEMANDE (React.lazy : rien de plus
// au premier écran) et les rend par portail (`SheetShell`, `FermeAuRetour`).
// Elle n'écrit rien par elle-même : chaque écriture attend le clic de la feuille.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { useSiriPublication } from './siriPublication.js';

export const EVT_IDEES = 'vrm:idees';
export const IDEES = Object.freeze(['vente-main', 'depense-photo', 'partage-image']);
export function ouvrirIdee(quoi, detail = {}) {
  if (!IDEES.includes(quoi)) return false;
  try { window.dispatchEvent(new CustomEvent(EVT_IDEES, { detail: { ...(detail || {}), quoi } })); return true; } catch (_) { return false; }
}
// Le lien `?idee=vente-main` (Raccourcis de l'iPhone) : lu une fois, puis effacé de l'adresse.
export function ideeDuLien(search) {
  try {
    const p = new URLSearchParams(String(search || ''));
    const q = p.get('idee');
    if (!IDEES.includes(q) || q === 'partage-image') return null;
    const num = String(p.get('num') || '').trim();
    return { quoi: q, num: /^[A-Za-z]{0,3}\d{1,6}$/.test(num) ? num : '' };
  } catch (_) { return null; }
}

const Feuilles = React.lazy(() => import('./Feuilles.jsx'));

export default function IdeesArgentRacine() {
  useSiriPublication();   // (161) la ligne `siri_retrait`, seulement si un jeton Siri existe
  const [ouvert, setOuvert] = React.useState(null);
  React.useEffect(() => {
    const f = (e) => { const d = e && e.detail; if (d && IDEES.includes(d.quoi)) setOuvert({ ...d, n: Date.now() }); };
    window.addEventListener(EVT_IDEES, f);
    const lien = ideeDuLien(window.location.search);
    if (lien) {
      setOuvert({ ...lien, n: Date.now() });
      try { const u = new URL(window.location.href); u.searchParams.delete('idee'); u.searchParams.delete('num'); window.history.replaceState(window.history.state, '', u.pathname + (u.search || '') + u.hash); } catch (_) {}
    }
    return () => window.removeEventListener(EVT_IDEES, f);
  }, []);
  if (!ouvert) return null;
  return (
    <React.Suspense fallback={null}>
      <Feuilles key={ouvert.n} ouvert={ouvert} onFermer={() => setOuvert(null)}/>
    </React.Suspense>
  );
}
