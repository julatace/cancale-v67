// ═══════════════════════════════════════════════════════════════════════════
//  160 · « VENTE EN MAIN PROPRE » — une seule porte, montée une fois (14 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// N'importe quel écran (⌘K / la loupe « vendu 124 », le lien `?idee=vente-main`)
// appelle `ouvrirIdee('vente-main', { num })` ; cette racine, montée UNE fois dans la
// coque après la session, charge la feuille À LA DEMANDE (React.lazy : rien de plus au
// premier écran) et la rend par portail (`SheetShell`, `FermeAuRetour`).
// La coque lui passe `verdict(q, choisie)` — la règle de « Vendu ailleurs » de la fiche
// sur l'histoire du N° (src/ideesArgent/venteMain.js) — et `pret` (ces lectures sont là).
// Elle n'écrit rien par elle-même : l'écriture attend « Vendue » dans la feuille.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { lazySur } from '../chargementSur.js';   // (15 nov.) un morceau qui rate : relancé, puis rechargement propre ou « Mettre à jour VRM »

export const EVT_IDEES = 'vrm:idees';
export const IDEES = Object.freeze(['vente-main']);
export function ouvrirIdee(quoi, detail = {}) {
  if (!IDEES.includes(quoi)) return false;
  try { window.dispatchEvent(new CustomEvent(EVT_IDEES, { detail: { ...(detail || {}), quoi } })); return true; } catch (_) { return false; }
}
// Le lien `?idee=vente-main[&num=124]` (un Raccourci « Ouvrir les URL ») : lu une fois, puis effacé de l'adresse.
export function ideeDuLien(search) {
  try {
    const p = new URLSearchParams(String(search || ''));
    const q = p.get('idee');
    if (!IDEES.includes(q)) return null;
    const num = String(p.get('num') || '').trim();
    return { quoi: q, num: /^[A-Za-z]{0,3}\d{1,6}$/.test(num) ? num : '' };
  } catch (_) { return null; }
}

const Feuilles = lazySur(() => import('./Feuilles.jsx'));

export default function IdeesArgentRacine({ pret = false, verdict = null, surOuverture = null }) {
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
  // La coque lit l'histoire des N° (les mêmes lectures que la fiche) tant que la feuille est ouverte.
  React.useEffect(() => { if (typeof surOuverture === 'function') surOuverture(!!ouvert); }, [ouvert]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!ouvert) return null;
  return (
    <React.Suspense fallback={null}>
      <Feuilles key={ouvert.n} ouvert={ouvert} pret={pret} verdict={verdict} onFermer={() => setOuvert(null)}/>
    </React.Suspense>
  );
}
