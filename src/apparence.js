// ══════════════════════════════════════════════════════════════════════════════
//  L'APPARENCE : CLAIR · SOMBRE · AUTOMATIQUE · LE SOIR (8 nov. 2026, « beauté »)
// ══════════════════════════════════════════════════════════════════════════════
// Le mode sombre de VRM reste un CHOIX (§7, `vinted_dark`). Deux modes s'ajoutent,
// eux aussi choisis par lui, jamais posés tout seuls :
//   · « Automatique » : suit le réglage de l'appareil (`prefers-color-scheme`) ;
//   · « Le soir »     : sombre de 19 h à 7 h (heure de l'appareil), clair le jour.
// ⚠️ (14 nov., idée 150 de Julien) « AUTOMATIQUE (LE SOIR) » : sombre entre le COUCHER et le LEVER du
//   soleil, calculés ICI (formule astronomique simple : jour de l'année, latitude/longitude de la ville
//   du FUSEAU de l'appareil — aucune position demandée, rien envoyé) ; fuseau inconnu ⇒ 20 h → 7 h.
//   Revu chaque minute par l'app (un état qui ne change que si la teinte change : jamais un clignement).
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
export const SOIR_DEBUT = 20;   // h : à partir de 20 h, sombre (fuseau sans ville connue)
export const SOIR_FIN = 7;      // h : jusqu'à 7 h

export const LIBELLES_APPARENCE = {
  clair: 'Clair',
  sombre: 'Sombre',
  auto: 'Comme l’appareil',
  soir: 'Automatique (le soir)',
};
export const PHRASES_APPARENCE = {
  clair: 'Toujours clair.',
  sombre: 'Toujours sombre.',
  auto: 'Comme ton iPhone ou ton ordinateur.',
  soir: 'Sombre du coucher au lever du soleil.',
};

// Le mode choisi : `vrm_apparence` s'il est valable, sinon le choix d'avant.
export function apparenceDe(mode, ancienSombre) {
  if (APPARENCES.includes(mode)) return mode;
  return ancienSombre === true ? 'sombre' : 'clair';
}

// Une ville par fuseau (sa latitude, sa longitude) : le soleil se calcule pour elle. Le fuseau est
// celui de l'APPAREIL (Intl), jamais une position demandée.
export const VILLES_FUSEAU = Object.freeze({
  'Europe/Paris': [48.86, 2.35], 'Europe/Brussels': [50.85, 4.35], 'Europe/Luxembourg': [49.61, 6.13], 'Europe/Monaco': [43.74, 7.42],
  'Europe/Zurich': [47.37, 8.54], 'Europe/Madrid': [40.42, -3.70], 'Europe/Lisbon': [38.72, -9.14], 'Europe/Rome': [41.90, 12.50],
  'Europe/Berlin': [52.52, 13.40], 'Europe/Vienna': [48.21, 16.37], 'Europe/Amsterdam': [52.37, 4.90], 'Europe/London': [51.51, -0.13],
  'Europe/Dublin': [53.35, -6.26], 'Atlantic/Canary': [28.12, -15.43], 'Indian/Reunion': [-20.88, 55.45], 'America/Martinique': [14.61, -61.07],
  'America/Guadeloupe': [16.24, -61.53], 'America/Montreal': [45.50, -73.57], 'America/Toronto': [43.65, -79.38],
});
export function fuseauAppareil() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { return ''; } }
// Le lever et le coucher du soleil, en minutes depuis minuit (heure de l'appareil), pour le jour de
// `date` à la ville du fuseau. Pas de ville (ou nuit/jour polaire) ⇒ null.
export function soleil(date, fuseau) {
  const v = VILLES_FUSEAU[fuseau]; if (!v) return null;
  const d = date instanceof Date ? date : new Date(date);
  const debut = new Date(d.getFullYear(), 0, 1);
  const n = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - debut) / 86400000) + 1;
  const g = 2 * Math.PI / 365 * (n - 1 + 0.5);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const lat = v[0] * Math.PI / 180;
  const x = Math.cos(90.833 * Math.PI / 180) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl);
  if (!(x >= -1 && x <= 1)) return null;
  const ha = Math.acos(x) * 180 / Math.PI;
  const decalage = -d.getTimezoneOffset();
  return { lever: 720 - 4 * (v[1] + ha) - eq + decalage, coucher: 720 - 4 * (v[1] - ha) - eq + decalage };
}
export function estLeSoir(date, fuseau = fuseauAppareil()) {
  const d = date instanceof Date ? date : new Date(date);
  const s = soleil(d, fuseau);
  if (s) { const m = d.getHours() * 60 + d.getMinutes(); return m >= s.coucher || m < s.lever; }
  const h = d.getHours();
  return h >= SOIR_DEBUT || h < SOIR_FIN;
}

// Sombre ou non, MAINTENANT. `systemeSombre` : la préférence de l'appareil
// (true / false) ; inconnue ⇒ clair (le défaut de VRM).
export function sombreEffectif(mode, { date = new Date(), systemeSombre = false, fuseau } = {}) {
  if (mode === 'sombre') return true;
  if (mode === 'auto') return systemeSombre === true;
  if (mode === 'soir') return fuseau === undefined ? estLeSoir(date) : estLeSoir(date, fuseau);
  return false;
}

// Dans combien de millisecondes la teinte du mode « Le soir » change (la
// prochaine 19 h ou 7 h, heure locale). Les autres modes : `null` (rien à
// attendre ; « Automatique » suit l'événement du système).
export function prochainChangement(mode, date = new Date(), fuseau = fuseauAppareil()) {
  if (mode !== 'soir') return null;
  // Le soleil d'une ville connue : la prochaine minute où la teinte change (au plus 24 h).
  if (VILLES_FUSEAU[fuseau]) {
    const avant = estLeSoir(date, fuseau);
    for (let k = 1; k <= 1440; k++) { const t = new Date(date.getTime() + k * 60000); t.setSeconds(0, 0); if (estLeSoir(t, fuseau) !== avant) return Math.max(1000, t.getTime() - date.getTime()); }
    return 3600000;
  }
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
