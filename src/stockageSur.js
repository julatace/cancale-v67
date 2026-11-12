// (11 nov., famille « stockage protégé ») UNE règle pour le stockage du navigateur.
// En Safari privé, « bloquer tous les cookies », une iframe ou un quota plein, `localStorage`
// LÈVE une exception : un `getItem` / `setItem` nu arrête le geste en cours (le bouton
// « Fermer » ne fermait plus, un effet s'arrêtait à mi-chemin). Ici rien ne lève :
//   · lireLocal  → la valeur, ou `defaut` si absente OU illisible ;
//   · ecrireLocal / retirerLocal → true si c'est écrit, false sinon (l'appelant décide) ;
//   · lireJSON   → l'objet, ou `defaut` si le texte n'est pas du JSON.
// ⚠️ La SYNCHRO (lireLocalSync, poserFusionLocale) ne passe PAS par ici exprès : un stockage
//    illisible doit l'ARRÊTER (jamais une liste vide poussée au nuage, §5 « une lecture ratée
//    n'écrit rien »). Gardien : scripts/audit-stockage-sur.cjs.

const stockage = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { return null; } };

export function lireLocal(cle, defaut = null) {
  try { const s = stockage(); if (!s) return defaut; const v = s.getItem(cle); return v == null ? defaut : v; } catch (_) { return defaut; }
}
export function ecrireLocal(cle, valeur) {
  try { const s = stockage(); if (!s) return false; s.setItem(cle, typeof valeur === 'string' ? valeur : JSON.stringify(valeur)); return true; } catch (_) { return false; }
}
export function retirerLocal(cle) {
  try { const s = stockage(); if (!s) return false; s.removeItem(cle); return true; } catch (_) { return false; }
}
export function lireJSON(texte, defaut = null) {
  if (texte == null || texte === '') return defaut;
  try { return JSON.parse(texte); } catch (_) { return defaut; }
}
// Le stockage marche-t-il ici ? (`undefined` jamais : true / false.)
export function stockageDispo() {
  try { const s = stockage(); if (!s) return false; const k = '__vrm_essai__'; s.setItem(k, '1'); s.removeItem(k); return true; } catch (_) { return false; }
}
