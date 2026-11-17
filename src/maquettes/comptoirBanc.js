// ── src/maquettes/comptoirBanc.js — le réglage de banc de la MAQUETTE E « Le comptoir » (17 nov.) ──
// Une maquette à montrer à Julien, PAS une fonction livrée : elle ne s'allume que par l'adresse
// `?banc_maquette=e` (le banc de captures), gardée pour l'onglet seulement (sessionStorage) ;
// `?banc_maquette=0` l'éteint. Aucun réglage, aucun menu ne la propose : invisible pour Julien.
let actif = false;
try {
  const q = new URLSearchParams(window.location.search).get('banc_maquette');
  if (q === 'e') sessionStorage.setItem('vrm_banc_maquette', 'e');
  else if (q === '0') sessionStorage.removeItem('vrm_banc_maquette');
  actif = sessionStorage.getItem('vrm_banc_maquette') === 'e';
} catch (_) { actif = false; }

export const COMPTOIR = actif;

// Les gestes globaux de la coque (la loupe, le scanner pour retrouver, « Publier ailleurs ») : la coque pose les
// siens ici à chaque rendu (les MÊMES fonctions que le disque de la barre du bas) ; le comptoir les appelle.
export const COMPTOIR_GESTES = { actuels: null };
export const gesteCoque = (id) => { try { const g = COMPTOIR_GESTES.actuels; if (g && typeof g[id] === 'function') g[id](); } catch (_) {} };

// L'ordre des tuiles : une commodité de CET appareil (le banc la remet à zéro). Jamais une donnée.
const CLE_ORDRE = 'vrm_comptoir_ordre';
export function lireOrdre(defaut) {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_ORDRE) || 'null');
    if (!Array.isArray(v)) return defaut;
    const connus = v.filter((id) => defaut.includes(id));
    return connus.concat(defaut.filter((id) => !connus.includes(id)));
  } catch (_) { return defaut; }
}
export function ecrireOrdre(ordre) { try { localStorage.setItem(CLE_ORDRE, JSON.stringify(ordre)); } catch (_) {} }

// Déplacer `id` à la place de `vers` (les autres glissent d'un cran) — la règle du rangement, testable seule.
export function deplacer(ordre, id, vers) {
  const a = ordre.indexOf(id), b = ordre.indexOf(vers);
  if (a < 0 || b < 0 || a === b) return ordre;
  const out = ordre.slice(); out.splice(a, 1); out.splice(b, 0, id);
  return out;
}
