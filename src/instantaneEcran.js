// ════════════════════════════════════════════════════════════════════════════
//  L'INSTANTANÉ D'UN ÉCRAN — UNE SEULE RÈGLE POUR MA JOURNÉE, COLIS ET VENTES
//  (9 nov. ; Ma journée d'abord — src/journeeInstantanee.js —, puis Colis et Ventes
//  sur la décision de Julien : « Colis et Ventes s'ouvrent comme Ma journée »).
//
//  L'instantané, ce sont les DERNIERS chiffres et listes qu'un écran a RENDUS sur CET
//  appareil pour CE compte VRM : relus dans l'écran vrai une fois TOUTES ses données
//  là (jamais pendant une lecture, jamais au plafond), rangés ici, et montrés à la
//  place du squelette à l'ouverture suivante, avec « Mis à jour il y a N min », INERTES.
//  Quand la relecture finit, l'écran vrai prend la place (src/AttenteEcran.jsx).
//
//  Ce fichier porte ce qui est COMMUN aux trois écrans (une règle, un propriétaire) :
//    · la clé : `vrm_<écran>_instantane:<uid>` (`vrm_` ⇒ effacée par `wipeLocalData` à la
//      déconnexion et au changement de vendeur), l'uid AUSSI dans la valeur ;
//    · la lecture : version, écran, uid, âge (≤ 3 jours, pas dans le futur) ;
//    · l'écriture : UN seul compte sur l'appareil — écrire pour un uid efface les
//      instantanés de tout autre uid, quel que soit l'écran ; jamais dans le nuage
//      (`localStorage.setItem`, hors de `save`, absente des clés synchronisées) ;
//    · l'âge (« il y a 7 min »), le jour et le mois de l'instantané ;
//    · la relecture de la carte des chiffres (`vrm-carte-stats`) : le TEXTE et les
//      `data-*` rendus, rien n'est recalculé (§11) — « — » reste « — » ;
//    · `enLecture` : une valeur encore « lecture… » quelque part ⇒ rien n'est rangé.
//  Ce que chaque écran range est décidé par SA capture (journeeInstantanee.js,
//  colisVentesInstantanes.js), sur liste blanche : rien de personnel.
// Exécuté par scripts/bancs/journee-instantanee.cjs, scripts/bancs/colis-ventes-instantanes.cjs
// et scripts/tests/{journee,colis-ventes}-instantane*.test.mjs.
// ════════════════════════════════════════════════════════════════════════════

export const VERSION_INSTANTANE = 1;
export const AGE_MAX_INSTANTANE_MS = 3 * 86400000;
// Un préfixe par écran. Ma journée garde sa clé du 9 nov. (aucun instantané perdu).
export const PREFIXES_INSTANTANE = Object.freeze({
  journee: 'vrm_journee_instantane:',
  colis: 'vrm_colis_instantane:',
  ventes: 'vrm_ventes_instantane:',
  annonces: 'vrm_annonces_instantane:',   // (11 nov., ouverture-legere-2) src/annoncesInstantanee.js
});
const TXT_MAX = 90;

export const cleInstantaneEcran = (ecran, uid) => (PREFIXES_INSTANTANE[ecran] || '') + String(uid || '');
const estCleInstantane = (k) => !!k && Object.values(PREFIXES_INSTANTANE).some((p) => k.startsWith(p));

const jourIso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const jourLocalIso = jourIso;
export const moisLocalIso = (t) => jourIso(t).slice(0, 7);

// ── LES OUTILS DE CAPTURE (lire ce que l'écran a rendu) ─────────────────────
export const propre = (s, max = TXT_MAX) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
export const attr = (el, n) => (el && el.hasAttribute(n) ? el.getAttribute(n) : null);
export const txt = (el, max) => (el ? propre(el.textContent, max) : '');
// Le texte d'un élément sans certains de ses enfants (un bouton d'aide « ? », un N° déjà rangé à part…).
export const txtSans = (el, sel, max) => {
  if (!el) return '';
  try { const c = el.cloneNode(true); c.querySelectorAll(sel).forEach((x) => x.remove()); return propre(c.textContent, max); } catch (_) { return ''; }
};
// Le texte d'un élément SANS ce que l'app marque comme sensible (`.vrm-sensible` : un nom de compte…).
export const txtSansSensible = (el, max) => {
  if (!el) return '';
  try { const c = el.cloneNode(true); c.querySelectorAll('.vrm-sensible').forEach((x) => x.remove()); return propre(c.textContent, max).replace(/(\s·)+\s*$/, '').replace(/·\s*·/g, '·'); } catch (_) { return ''; }
};
// Une valeur encore en lecture n'est jamais rangée (elle se figerait en « lecture… »).
export const enLecture = (s) => /lecture/i.test(String(s || ''));

// L'en-tête commun d'un instantané.
export const enTeteInstantane = (ecran, uid, maintenant, largeur) => ({
  v: VERSION_INSTANTANE, ecran, uid: String(uid), t: maintenant, jour: jourIso(maintenant), mois: moisLocalIso(maintenant), largeur: Math.round(largeur || 0),
});

// « il y a 4 min » — l'âge d'un instantané, toujours dit.
export const ageTexte = (ms) => {
  const m = Math.max(0, Math.floor((Number(ms) || 0) / 60000));
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  return `il y a ${j} j`;
};

// ── LA CARTE DES CHIFFRES (`vrm-carte-stats`, src/design/CarteStats.jsx) ─────
// Les cases : le texte rendu et la valeur des `data-*`. null si l'une est encore en lecture.
export function capturerCases(carte) {
  const cases = carte ? [...carte.querySelectorAll('[data-fu-case]')].map((c) => {
    const b = c.querySelector('b');
    return { cle: attr(c, 'data-fu-case') || '', valeur: attr(c, 'data-carte-valeur') || '', partiel: attr(c, 'data-carte-partiel') === '1', b: txt(b), vide: !!(b && b.classList.contains('is-vide')), l: txt(c.querySelector(':scope > span')), raison: txt(c.querySelector('small')) };
  }) : [];
  return cases.length && !cases.some((c) => enLecture(c.b) || enLecture(c.raison)) ? cases : null;
}
// L'objectif du mois (src/objectifMois.js) : les nombres de SA barre, tels que rendus.
export function capturerObjectif(carte) {
  const ob = carte && carte.querySelector('[data-objectif]');
  return ob ? {
    type: attr(ob, 'data-objectif'), cible: attr(ob, 'data-objectif-cible') || '', valeur: attr(ob, 'data-objectif-valeur') || '',
    pct: attr(ob, 'data-objectif-pct') || '', partiel: attr(ob, 'data-objectif-partiel') === '1', atteint: attr(ob, 'data-objectif-atteint') === '1',
  } : null;
}
// Toute la carte (Colis, Ventes) : surtitre, grand chiffre, cases, objectif, et sa PORTÉE
// (une case du mois ⇒ « mois » : montrée le même mois ; sinon « jour » : montrée le même jour).
const CLASSES_CARTE = /^(vrm-[a-z0-9-]+|a-[a-z]+)$/;
export function capturerCarte(carte) {
  if (!carte) return null;
  if (enLecture(carte.textContent)) return null;
  const g = carte.querySelector('.vrm-fu-grand');
  const spark = carte.querySelector('.vrm-fu-carte-tete > svg');
  const r = spark && spark.getBoundingClientRect ? spark.getBoundingClientRect() : null;
  const cases = capturerCases(carte);
  if (!cases && !g) return null;
  return {
    classes: String(carte.className || '').split(/\s+/).filter((c) => CLASSES_CARTE.test(c)).join(' '),
    portee: carte.querySelector('[data-carte-p="mois"]') ? 'mois' : 'jour',
    surtitre: txt(carte.querySelector('.vrm-fu-surtitre'), 40),
    grand: g ? { texte: txt(g, 24), valeur: attr(g, 'data-carte-valeur') || '', vide: g.classList.contains('is-vide'), sous: txtSans(carte.querySelector('.vrm-fu-sous-nom'), 'button', 40) } : null,
    spark: r && r.width ? { l: Math.round(r.width), h: Math.round(r.height) } : null,
    cases, objectif: capturerObjectif(carte),
  };
}

// ── LECTURE ─────────────────────────────────────────────────────────────────
const stockage = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { return null; } };

// L'instantané brut de CET écran pour CE compte, ou null. Jamais celui d'un autre uid.
export function lireInstantaneEcran(ecran, uid, { maintenant = Date.now(), ls = stockage() } = {}) {
  if (!uid || !ls || !PREFIXES_INSTANTANE[ecran]) return null;
  let s = null;
  try { s = JSON.parse(ls.getItem(cleInstantaneEcran(ecran, uid)) || 'null'); } catch (_) { return null; }
  if (!s || typeof s !== 'object' || s.v !== VERSION_INSTANTANE) return null;
  // Ma journée (rangée avant le 9 nov. au soir) ne portait pas `ecran` : c'est la sienne.
  if ((s.ecran || 'journee') !== ecran) return null;
  if (String(s.uid || '') !== String(uid)) return null;
  const t = Number(s.t);
  if (!Number.isFinite(t) || t > maintenant + 60000 || maintenant - t > AGE_MAX_INSTANTANE_MS) return null;
  return s;
}
// Ce que tout instantané sait de son âge.
export function ageInstantane(s, maintenant = Date.now()) {
  return { t: s.t, age: Math.max(0, maintenant - s.t), memeJour: s.jour === jourIso(maintenant), memeMois: s.mois === moisLocalIso(maintenant) };
}
// La carte se montre selon sa portée (jour / mois).
export const carteMontrable = (carte, A) => (carte && (carte.portee === 'mois' ? A.memeMois : A.memeJour) ? carte : null);

// ── ÉCRITURE / EFFACEMENT ──────────────────────────────────────────────────
export function ecrireInstantaneEcran(ecran, snap, { ls = stockage() } = {}) {
  if (!snap || !snap.uid || !ls || !PREFIXES_INSTANTANE[ecran]) return false;
  try {
    // UN seul compte sur l'appareil : les instantanés d'un autre uid partent (tous écrans).
    const garde = String(snap.uid);
    for (let i = ls.length - 1; i >= 0; i--) {
      const k = ls.key(i);
      if (estCleInstantane(k) && !Object.values(PREFIXES_INSTANTANE).some((p) => k === p + garde)) ls.removeItem(k);
    }
    ls.setItem(cleInstantaneEcran(ecran, snap.uid), JSON.stringify(snap));
    return true;
  } catch (_) { return false; }
}
// Tous les instantanés, de tous les écrans (aperçu sans abonnement, déconnexion).
export function effacerInstantanes({ ls = stockage() } = {}) {
  if (!ls) return;
  try { for (let i = ls.length - 1; i >= 0; i--) { const k = ls.key(i); if (estCleInstantane(k)) ls.removeItem(k); } } catch (_) {}
}
