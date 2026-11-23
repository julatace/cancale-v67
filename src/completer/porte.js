// ════════════════════════════════════════════════════════════════════════════
//  « COMPLÉTER » — LA PORTE (19 nov. 2026, lot completer-infos)
// ════════════════════════════════════════════════════════════════════════════
// UNE seule porte pour tout ce qui manque à un article (achat relié / prix d'achat, prix mini,
// prix, N°) : `ouvrirCompleter({ sujet, num, lot })` ouvre l'atelier (src/completer/Completer.jsx,
// chargé à la demande), filtré sur son sujet ; `num` l'ouvre sur l'article de ce N°.
//   sujet : 'tout' (défaut) · 'achat' · 'mini' · 'prix' · 'numero' · 'anciennes'
//   lot   : true ⇒ la règle en lot des prix mini, tout de suite.
// Les COMPTEURS par sorte sont publiés ici par l'écran qui a lu les annonces et les ventes
// (src/App.jsx, la règle `compteurs` de src/completer/regles.js) : `undefined` pas encore
// calculé · `null` pas su · { articles, achat, achatVentes, achatAnnonces, mini, prix, numero,
// anciennes, mis, miniActif } (un champ `null` = pas su ; jamais 0 à la place).
// Ce module est petit exprès : c'est le seul morceau de l'atelier chargé au démarrage.
import { useSyncExternalStore } from 'react';

export const EVT_COMPLETER = 'vrm:completer';
const SUJETS_PORTE = ['tout', 'achat', 'mini', 'prix', 'numero', 'anciennes'];

export function demandeCompleter(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  return { sujet: SUJETS_PORTE.includes(o.sujet) ? o.sujet : 'tout', num: o.num != null && String(o.num).trim() !== '' ? String(o.num).trim() : '', lot: o.lot === true, at: Date.now() };
}
export function ouvrirCompleter(opts) {
  const d = demandeCompleter(opts);
  try { window.dispatchEvent(new CustomEvent(EVT_COMPLETER, { detail: d })); } catch (_) {}
  return d;
}

let _compteurs; const _abonnes = new Set();
export function poserCompteurs(c) {
  const v = c && typeof c === 'object' ? c : (c === null ? null : undefined);
  if (JSON.stringify(v) === JSON.stringify(_compteurs)) return;
  _compteurs = v;
  for (const f of [..._abonnes]) { try { f(); } catch (_) {} }
}
export const lireCompteurs = () => _compteurs;
export function abonnerCompteurs(f) { _abonnes.add(f); return () => _abonnes.delete(f); }
export function useCompteursCompleter() { return useSyncExternalStore(abonnerCompteurs, lireCompteurs, lireCompteurs); }
