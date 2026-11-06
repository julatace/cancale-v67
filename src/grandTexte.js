// ═══════════════════════════════════════════════════════════════════════════
// LE TEXTE EN GRAND — l'échelle de texte voulue par l'appareil (6 nov., v36-finition)
// ═══════════════════════════════════════════════════════════════════════════
// L'app dessine ses tailles en PIXELS (styles en ligne, ~2 500 `fontSize:`) : le
// réglage « texte plus grand » d'un navigateur (taille de police racine) ou de
// l'iPhone (Taille du texte, lue par `font: -apple-system-body`, 17 px par défaut)
// ne la touchait pas. On le traduit en ÉCHELLE de toute l'app, par le même `zoom`
// que la densité d'affichage (`applyZoom`, App.jsx) : textes, marges, cibles et
// photos grandissent ensemble, la mise en page se refait sur une largeur plus
// étroite (390 px à 150 % = 260 px de mise en page) et rien ne déborde.
//
// Ce n'est pas un réglage de l'app : c'est celui de l'appareil, relu à chaque
// redimensionnement. La racine est ensuite remise à 16 px (sinon un texte sans
// taille propre grandirait deux fois : par la racine, puis par le zoom).
// Bornes : 1 (jamais plus petit que voulu par l'app) à 1,6 (au-delà, une colonne
// de 245 px ne porte plus une carte).
export const ECHELLE_MAX = 1.6;
const DEFAUT_RACINE = 16;
const DEFAUT_IOS = 17;

const arrondi = (x) => Math.round(x * 20) / 20; // au 0,05 près : pas de zoom à 1,0312

export function echelleTexte(doc) {
  try {
    const d = (doc || document).documentElement;
    const w = (doc || document).defaultView || window;
    // La racine voulue par le navigateur, sans la remise à 16 px posée par l'app.
    const posee = d.style.getPropertyValue('font-size'), prio = d.style.getPropertyPriority('font-size');
    d.style.removeProperty('font-size');
    const racine = parseFloat(w.getComputedStyle(d).fontSize) || DEFAUT_RACINE;
    if (posee) d.style.setProperty('font-size', posee, prio);
    let ios = 1;
    // iPhone : la taille de texte du système n'atteint une page que par les
    // polices « -apple-system-* » ; une sonde invisible la lit.
    if (w.CSS && w.CSS.supports && w.CSS.supports('font', '-apple-system-body')) {
      const s = (doc || document).createElement('span');
      s.setAttribute('aria-hidden', 'true');
      s.style.cssText = 'font:-apple-system-body;position:absolute;visibility:hidden;pointer-events:none';
      s.textContent = 'x';
      (doc || document).body.appendChild(s);
      const px = parseFloat(w.getComputedStyle(s).fontSize);
      s.remove();
      if (px > 0) ios = px / DEFAUT_IOS;
    }
    const e = Math.max(racine / DEFAUT_RACINE, ios);
    if (!(e > 1.01)) return 1;
    return Math.min(ECHELLE_MAX, arrondi(e));
  } catch (_) { return 1; }
}

// Pose (ou retire) la remise à 16 px de la racine et le marqueur lu par les
// feuilles de style (`html[data-grand-texte]`).
export function marquerGrandTexte(echelle, doc) {
  try {
    const d = (doc || document).documentElement;
    if (echelle > 1) {
      d.style.setProperty('font-size', DEFAUT_RACINE + 'px', 'important');
      d.setAttribute('data-grand-texte', echelle >= 1.35 ? 'tres' : 'oui');
    } else {
      d.style.removeProperty('font-size');
      d.removeAttribute('data-grand-texte');
    }
  } catch (_) {}
}
