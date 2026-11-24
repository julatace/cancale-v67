// ══════════════════════════════════════════════════════════════════════════════
//  LE VRAI ACCOMPAGNEMENT DE « BIEN DÉMARRER » (23 nov., lot demarrage-guide)
// ══════════════════════════════════════════════════════════════════════════════
// Julien (validé le 23 nov.) : « démarrage guidé d'un nouveau vendeur en 5 min : relier ses comptes, installer
// l'extension (Chrome/Edge/Orion), voir ses premiers chiffres, coche verte par étape, reprise là où il s'est arrêté » ;
// puis : « un vrai accompagnement, avec du motion design pour expliquer : animations courtes à chaque étape, passables,
// ton chaleureux et simple ». S'appuie sur « Bien démarrer 3/5 » (src/bienDemarrer/regle.js, 21 nov.) — pas un second
// parcours. Module PUR : quelle scène, quelles petites marches, quel geste, selon l'étape et le NAVIGATEUR d'ici.
//   · la coche se pose sur une PREUVE lue (regle.js) — jamais sur « Suivant » ;
//   · la REPRISE : la feuille s'ouvre sur la première étape pas faite (`etapeDeReprise`) ; une étape choisie à la main
//     l'emporte ;
//   · le navigateur n'est nommé que s'il est SU (`navigateurIci`, `mobileIci` : Orion par window.KAGI, jamais « Chrome »
//     au hasard) ; un iPhone hors Orion ⇒ « installe Orion », jamais une boutique qui ne s'ouvrira pas.
// ══════════════════════════════════════════════════════════════════════════════
import { ETAPES_BIEN_DEMARRER } from './regle.js';

// Les petites marches de l'extension, par famille de navigateur (clés de traduction `acc.ext.<famille>.<i>`).
export const MARCHES_EXTENSION = Object.freeze({
  chromium: 3,   // Chrome, Edge, Brave, Opera, Vivaldi : ouvrir la boutique · « Ajouter » · l'épingler
  firefox: 3,    // Firefox (ordinateur et Android) : la page des modules · « Ajouter » · l'épingler
  orion: 3,      // Orion (Mac, iPhone) : télécharger le dossier · Extensions d'Orion · l'activer
  iphone: 2,     // un iPhone hors Orion : installer Orion · revenir ici dans Orion
  inconnu: 2,    // pas su : ouvrir vrm.center sur l'ordinateur · y installer l'extension
});
const CHROMIUM = new Set(['chrome', 'edge', 'brave', 'opera', 'vivaldi', 'yandex']);
// La famille d'ici, à partir de `navigateurIci(ua)` et `mobileIci(ua)` (src/navigateurExtension.js).
export function familleNavigateur(nav, mobile = null) {
  if (mobile === 'ios-orion' || nav === 'orion') return 'orion';
  if (mobile === 'ios') return 'iphone';
  if (mobile === 'firefox-android' || nav === 'firefox') return 'firefox';
  if (mobile && mobile !== 'autre') return 'inconnu';  // Android hors Firefox, Samsung… : l'ordinateur ('autre' = un ordinateur)
  if (CHROMIUM.has(String(nav || ''))) return 'chromium';
  return 'inconnu';
}
// Le nom à dire (seulement s'il est SU) : 'Chrome', 'Edge', 'Orion'… ; '' sinon.
const NOMS = { chrome: 'Chrome', edge: 'Edge', brave: 'Brave', opera: 'Opera', vivaldi: 'Vivaldi', yandex: 'Yandex', firefox: 'Firefox', orion: 'Orion' };
export const nomSu = (nav, mobile = null) => (mobile === 'ios-orion' ? 'Orion' : NOMS[String(nav || '')] || '');

// La scène de chaque étape (une animation SVG courte, src/bienDemarrer/Accompagnement.jsx) et son geste.
export const SCENES = Object.freeze({ extension: 'piece', compte: 'liens', lecture: 'barres', numeros: 'etiquette', fiscal: 'document' });

// L'étape sur laquelle la feuille s'ouvre : celle qu'il a touchée, sinon la première pas faite (la reprise).
export function etapeDeReprise(etapes, voulue = null) {
  const L = Array.isArray(etapes) ? etapes : [];
  if (voulue && L.some((e) => e && e.cle === voulue)) return voulue;
  const c = L.find((e) => e && e.etat !== 'fait');
  return c ? c.cle : (L[L.length - 1] || {}).cle || null;
}
// La suivante PAS FAITE après `cle` (dans l'ordre), sinon null (tout est fait après elle).
export function etapeSuivante(etapes, cle) {
  const L = Array.isArray(etapes) ? etapes : [];
  const i = L.findIndex((e) => e && e.cle === cle);
  const r = L.slice(i + 1).find((e) => e && e.etat !== 'fait');
  return r ? r.cle : null;
}

// Ce que la feuille dessine pour une étape : { cle, scene, rang, total, fait, marches: [clé tr], geste: { cle, nom } }.
export function pageAccompagnement(etapes, cle, { nav = '', mobile = null } = {}) {
  const L = Array.isArray(etapes) ? etapes : [];
  const e = L.find((x) => x && x.cle === cle);
  if (!e || !ETAPES_BIEN_DEMARRER.includes(cle)) return null;
  const fam = familleNavigateur(nav, mobile);
  const marches = cle === 'extension'
    ? Array.from({ length: MARCHES_EXTENSION[fam] }, (_, i) => `acc.ext.${fam}.${i + 1}`)
    : [`acc.${cle}.1`, `acc.${cle}.2`];
  const geste = cle === 'extension' ? { cle: 'acc.geste.extension.' + fam, nom: nomSu(nav, mobile) } : { cle: 'acc.geste.' + cle, nom: '' };
  return { cle, scene: SCENES[cle], rang: L.indexOf(e) + 1, total: L.length, fait: e.etat === 'fait', passu: e.etat === 'passu', famille: fam, marches, geste };
}
