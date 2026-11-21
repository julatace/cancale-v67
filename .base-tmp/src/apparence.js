// ══════════════════════════════════════════════════════════════════════════════
//  L'APPARENCE : CLAIR · SOMBRE · AUTOMATIQUE · LE SOIR (8 nov. 2026, « beauté »)
// ══════════════════════════════════════════════════════════════════════════════
// Le mode sombre de VRM reste un CHOIX (§7, `vinted_dark`). Deux modes s'ajoutent,
// eux aussi choisis par lui, jamais posés tout seuls :
//   · « Automatique » : suit le réglage de l'appareil (`prefers-color-scheme`) ;
//   · « Le soir »     : sombre de 19 h à 7 h (heure de l'appareil), clair le jour.
// Rangé dans `vrm_apparence` ('clair' | 'sombre' | 'auto' | 'soir'). Absent (tous
// les appareils d'avant ce chantier) ⇒ le choix d'avant, lu dans `vinted_dark` :
// rien ne change pour qui n'a pas touché au réglage.
//
// ⚠️ LA MÊME RÈGLE AVANT LE PREMIER RENDU : `public/demarrage-theme.js` (un fichier
// sans import, la CSP refuse tout script en ligne) en porte une COPIE ; le banc
// `scripts/audit-apparence.cjs` exécute les deux sur les mêmes entrées (heures,
// préférence du système, anciens réglages) et exige le même verdict — sinon
// l'app s'afficherait d'une teinte puis basculerait (le « flash »).
//
// Module PUR (horloge et préférence du système passées en paramètre).

export const APPARENCES = ['clair', 'sombre', 'auto', 'soir'];
export const SOIR_DEBUT = 19;   // h : à partir de 19 h, sombre
export const SOIR_FIN = 7;      // h : jusqu'à 7 h

export const LIBELLES_APPARENCE = {
  clair: 'Clair',
  sombre: 'Sombre',
  auto: 'Automatique',
  soir: 'Le soir',
};
export const PHRASES_APPARENCE = {
  clair: 'Toujours clair.',
  sombre: 'Toujours sombre.',
  auto: 'Comme ton iPhone ou ton ordinateur.',
  soir: 'Sombre de 19 h à 7 h, clair le jour.',
};

// Le mode choisi : `vrm_apparence` s'il est valable, sinon le choix d'avant.
export function apparenceDe(mode, ancienSombre) {
  if (APPARENCES.includes(mode)) return mode;
  return ancienSombre === true ? 'sombre' : 'clair';
}

export function estLeSoir(date) {
  const h = (date instanceof Date ? date : new Date(date)).getHours();
  return h >= SOIR_DEBUT || h < SOIR_FIN;
}

// Sombre ou non, MAINTENANT. `systemeSombre` : la préférence de l'appareil
// (true / false) ; inconnue ⇒ clair (le défaut de VRM).
export function sombreEffectif(mode, { date = new Date(), systemeSombre = false } = {}) {
  if (mode === 'sombre') return true;
  if (mode === 'auto') return systemeSombre === true;
  if (mode === 'soir') return estLeSoir(date);
  return false;
}

// Dans combien de millisecondes la teinte du mode « Le soir » change (la
// prochaine 19 h ou 7 h, heure locale). Les autres modes : `null` (rien à
// attendre ; « Automatique » suit l'événement du système).
export function prochainChangement(mode, date = new Date()) {
  if (mode !== 'soir') return null;
  const d = new Date(date.getTime());
  const h = d.getHours();
  const cible = new Date(d.getTime());
  cible.setMinutes(0, 0, 0);
  if (h >= SOIR_DEBUT) { cible.setDate(cible.getDate() + 1); cible.setHours(SOIR_FIN); }
  else if (h < SOIR_FIN) cible.setHours(SOIR_FIN);
  else cible.setHours(SOIR_DEBUT);
  return Math.max(1000, cible.getTime() - d.getTime());
}

// Ce qui s'écrit quand il choisit un mode : `vrm_apparence`, et `vinted_dark`
// pour un choix explicite (les lecteurs d'avant — un autre appareil pas encore à
// jour — gardent la bonne teinte). En automatique / le soir, `vinted_dark` ne
// bouge pas : il redevient le choix si l'on revient en arrière.
export function ecrituresApparence(mode) {
  if (!APPARENCES.includes(mode)) return null;
  const out = { vrm_apparence: mode };
  if (mode === 'clair') out.vinted_dark = false;
  if (mode === 'sombre') out.vinted_dark = true;
  return out;
}
