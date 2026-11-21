// ══ UNE VENTE « À DATER » VENDUE CETTE ANNÉE EST REÇUE CETTE ANNÉE (6 nov.) ══
// MESURÉ sur sa base (lecture seule, 6 nov.) : 1 772 ventes Vinted finalisées
// n'ont pas de date de versement (« à dater ») — toutes d'un même compte, vendues
// de mai 2025 à juin 2026. Le CA de l'année (seuils TVA et micro, revenus, DAC7)
// ne les comptait nulle part : « Reçu en 2026 : au moins 13 786 € » quand ses
// ventes finalisées de 2026 pèsent quatre fois plus, et la jauge de TVA à 16 %.
// ⚠️ CE N'EST PAS UNE DATE DEVINÉE. Le versement d'une vente finalisée tombe
//    entre sa VENTE et l'instant où on la LIT finalisée (on ne finalise pas une
//    vente avant de l'avoir faite, ni après l'avoir lue finalisée). Vendue en
//    2026 et lue finalisée en 2026 ⇒ versée en 2026 : c'est PROUVÉ pour l'ANNÉE.
//    Pour le MOIS, rien n'est prouvé : la vente reste « à dater », dans aucun
//    mois (§5, le CA déclaré daté au versement), et dite.
// ⚠️ Vendue l'année d'AVANT (ou date de vente illisible) : le versement peut
//    être de l'une ou l'autre année ⇒ toujours « au moins », nommée.
// Règle PURE (aucun accès au navigateur) : l'écran Ventes (publication de
// `vinted_urssaf_mois.aDater.annees`), Compta (src/microEntreprise.js,
// src/seuilsAnnee.js, src/dac7Comptes.js) et `scripts/audit-onglets-d.cjs`
// l'appellent (§11 : une règle, un propriétaire).

const anneeDe = (t) => new Date(t).getFullYear();

// L'année PROUVÉE du versement d'une vente finalisée sans date de versement :
// celle de sa vente si elle est aussi celle de la lecture, sinon `null`.
export const anneeSureDeVente = (tsVente, tsLecture) => {
  const v = Number(tsVente), l = Number(tsLecture);
  if (!(v > 0) || !(l > 0) || v > l) return null;
  const y = anneeDe(v);
  return y === anneeDe(l) ? y : null;
};

// La date de VENTE d'une ligne « à dater » de `ventesDeclarables` (Vinted :
// `dateVente`, la date de la commande). Illisible ⇒ `null`.
export const tsVenteADater = (l) => {
  if (!l) return null;
  const t = typeof l.tsVente === 'number' ? l.tsVente : Date.parse(l.dateVente || '');
  return Number.isFinite(t) && t > 0 ? t : null;
};

const r2 = (x) => Math.round(x * 100) / 100;

// Ce que la publication (`vinted_urssaf_mois.aDater`) ajoute : les ventes à dater
// réparties par ANNÉE DE VENTE (`annees[AAAA] = { n, ca, par: { plateforme: { n, ca } } }`),
// et la période où elles ont été vendues (`de`, `a` : ms ; `sansDate` : date illisible).
export const aDaterParAnnee = (aDater) => {
  const annees = {};
  let de = null, a = null, sansDate = 0;
  for (const l of (aDater || [])) {
    if (!l || !Number.isFinite(Number(l.eur))) continue;
    const t = tsVenteADater(l);
    if (t == null) { sansDate += 1; continue; }
    if (de == null || t < de) de = t;
    if (a == null || t > a) a = t;
    const y = String(anneeDe(t));
    const q = annees[y] || (annees[y] = { n: 0, ca: 0, par: {} });
    q.n += 1; q.ca += Number(l.eur);
    const p = q.par[l.plateforme] || (q.par[l.plateforme] = { n: 0, ca: 0 });
    p.n += 1; p.ca += Number(l.eur);
  }
  for (const q of Object.values(annees)) { q.ca = r2(q.ca); for (const p of Object.values(q.par)) p.ca = r2(p.ca); }
  return { annees, de, a, sansDate };
};

// La part PROUVÉE de l'année dans une ligne publiée : lue par `caAnnee`
// (src/microEntreprise.js, qui la porte — sa copie d'audit n'a pas d'import).
export { aDaterSurDansAnnee } from './microEntreprise.js';

// « vendues de mai 2025 à juin 2026 » : la période des ventes à dater, en mots.
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const moisAn = (t) => { const d = new Date(t); return `${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
export const periodeADater = (ad) => {
  if (!ad || !(Number(ad.de) > 0) || !(Number(ad.a) > 0)) return '';
  const a = moisAn(Number(ad.de)), b = moisAn(Number(ad.a));
  return a === b ? `vendues en ${a}` : `vendues de ${a} à ${b}`;
};
