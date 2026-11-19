// ════════════════════════════════════════════════════════════════════════════
// (16 nov., lot tampons-parametres — Julien, capture iPhone : « quand je touche Imprimer sur une vente, TOUTE la ligne
// bouge ») UN BOUTON D'IMPRESSION GARDE SA TAILLE PENDANT LA PRÉPARATION : sa largeur est figée, son texte et son icône
// s'effacent sur place et une roue tourne DEDANS (`[data-occupe]`, styles-tampons.css) — rien autour ne se décale.
//   · `occuperPendant(el, f)` : pendant le geste `f` (async), puis rendu tel quel ;
//   · `figerBouton(el)` : TOUT bouton `[data-imprime]` touché (écouteur global d'App.jsx), rendu dès que la suite
//     se montre (`libererBoutonsImprime` : l'aperçu avant impression, la visionneuse, « Bordereau prêt », un message)
//     ou au bout de 30 s au plus.
// ════════════════════════════════════════════════════════════════════════════
const figes = new Set();
export function figerBouton(el) {
  if (!el || !el.style || (el.hasAttribute && el.hasAttribute('data-occupe'))) return false;
  try { const r = el.getBoundingClientRect(); el.style.width = `${r.width}px`; el.style.setProperty('--vrm-roue-c', getComputedStyle(el).color); } catch (_) {}
  el.setAttribute('data-occupe', ''); el.setAttribute('aria-busy', 'true');
  figes.add(el);
  setTimeout(() => libererBouton(el), 30000);
  return true;
}
export function libererBouton(el) {
  if (!el || !figes.has(el)) return;
  figes.delete(el);
  try { el.removeAttribute('data-occupe'); el.removeAttribute('aria-busy'); el.style.width = ''; } catch (_) {}
}
export function libererBoutonsImprime() { for (const el of [...figes]) libererBouton(el); }
export const occuperPendant = async (el, f) => {
  if (el && el.hasAttribute && el.hasAttribute('data-occupe') && !figes.has(el)) return undefined;
  if (el && !figes.has(el)) figerBouton(el);
  try { return await f(); } finally { libererBouton(el); }
};
