// api/_lib/notif-belle.js
// ────────────────────────────────────────────────────────────────────────────
// (8 nov.) LA FORME D'UNE NOTIFICATION — une règle, appliquée par
// `sendPushToAll` (api/_lib/push.js) à TOUT ce qui sonne, et par l'app (cloche,
// aperçus de Paramètres → Notifications) à tout ce qu'elle montre.
//
// Julien (8 nov.) : « fais de belles notifications, là elles ne sont pas très
// belles et pas forcément utiles, des fois des infos qui servent à rien ».
// Inventaire, tri et mesures : docs/passation/2026-11-08-notifications.md.
//
// 1. LE TEXTE : un titre qui dit LE fait (≤ 40 caractères), un corps qui dit le
//    geste et l'échéance ; aucun emoji (l'icône de VRM et celle de la famille
//    suffisent). Un titre trop long n'est jamais coupé au milieu d'un fait : ce
//    qui suit « · » ou « — » descend dans le corps (« N°124 vendu sur Vinted » /
//    « Encore en ligne sur Leboncoin · … »).
// 2. LE REGROUPEMENT (allumé par défaut, `push_prefs.regrouper`) : une seule
//    notification par GENRE (« 3 bordereaux prêts à imprimer » au lieu de 3) ;
//    le genre se lit sur l'étiquette que chaque émetteur pose déjà par objet
//    (`bord-<tx>`, `sale-<…>`, `offer-<…>`…). Le nombre vient des entrées NON LUES
//    du centre (24 h) ; pas su ⇒ aucun nombre inventé, la notification reste seule.
//    Sans regroupement, chaque objet garde SON étiquette : une mise à jour du
//    même objet remplace l'ancienne au lieu de s'empiler.
// 3. L'IMAGE : seulement une photo PROUVÉE (la photo de l'article dans l'e-mail
//    de CETTE vente — même e-mail, même transaction), servie par les serveurs de
//    photos d'annonces de Vinted. Jamais une photo retrouvée par titre (§5).
// 4. LES ACTIONS (Android, Chrome, Edge — iOS les ignore) : le geste du genre,
//    qui ouvre le même écran que le toucher.
// 5. LES HEURES CALMES : la règle est dans notif-textes.js (`dansHeuresCalmes`) ;
//    ici `echeancePressante` dit si une échéance tombe avant 10 h (Paris) — ce
//    qui expire avant que l'on puisse agir le matin sonne quand même.
// Pur : aucune lecture, aucune écriture — l'app l'importe.
// ────────────────────────────────────────────────────────────────────────────
import { familleDe, FAMILLES } from './notif-textes.js';
import { DESTINATIONS, lienNotif } from './lien-notif.js';

export const ICONE_NOTIF = '/vrm-icon-v5-192.png';
// Monochrome (blanc sur transparent, 96 px) : Android le dessine dans la barre d'état.
export const BADGE_NOTIF = '/vrm-badge-96.png';
export const TITRE_MAX = 40;
export const CORPS_MAX = 170;

// Tout pictogramme (emoji, ⚠ ✅ ↩ ⏰ ❤ …), les sélecteurs de variante et les
// jointures. Les lettres, chiffres, « € », « N° », « · » restent.
const PICTO = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}︎️‍⃣]/gu;
export function sansEmoji(s) {
  return String(s == null ? '' : s).replace(PICTO, ' ').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ')
    .replace(/^[\s·:—–-]+/, '').replace(/[\s·:—–-]+$/, '').trim();
}
export const couper = (s, n) => { const x = String(s || ''); return x.length > n ? x.slice(0, n - 1).trimEnd() + '…' : x; };
const majuscule = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Le texte d'une notification, propre : `{ title, body }`.
export function embellir({ title = '', body = '' } = {}, cat = null) {
  let t = sansEmoji(title);
  let b = sansEmoji(body);
  if (t.length > TITRE_MAX) {
    // Couper sur un séparateur : la suite descend dans le corps, rien ne se perd.
    // « : » ne coupe que si ce qui précède dit déjà un fait (3 mots au moins) :
    // « Chronopost : ton colis… » ne doit pas devenir le titre « Chronopost ».
    const m = /^(.{6,}?)\s+(?:·|—|–|-)\s+(.+)$/.exec(t) || ((x) => (x && x[1].trim().split(/\s+/).length >= 3 ? x : null))(/^(.{6,}?)\s*:\s+(.+)$/.exec(t));
    const tete = m && m[1].length <= TITRE_MAX ? m[1] : null;
    if (tete) { b = [majuscule(m[2]), b].filter(Boolean).join(' · '); t = tete; }
    else { if (!b) b = t; t = couper(t, TITRE_MAX); }
  }
  if (!t) {
    const f = FAMILLES.find((x) => x.id === familleDe(cat));
    t = f ? f.titre : 'VRM';
  }
  return { title: t, body: couper(b, CORPS_MAX) };
}

// ── LES GENRES : ce qui se regroupe, et comment ────────────────────────────
// `re` : l'étiquette posée par l'émetteur (une par objet) ; `titre(k)` : la
// notification regroupée ; `url` : l'écran de la liste ; `action` : le geste.
export const GENRES = [
  { id: 'bordereau', re: /^bord-/, titre: (k) => `${k} bordereaux prêts à imprimer`, url: DESTINATIONS.colis({}), action: { action: 'voir', title: 'Imprimer' } },
  { id: 'vente', re: /^(sale|vc-vente)-/, titre: (k) => `${k} ventes`, url: lienNotif('ventes'), action: { action: 'voir', title: 'Voir la vente' } },
  { id: 'argent', re: /^final-/, titre: (k) => `${k} versements reçus`, url: lienNotif('ventes', { site: 'vinted' }), action: null },
  { id: 'arrivee', re: /^(relais|retrait-code)-/, titre: (k) => `${k} colis t'attendent`, url: DESTINATIONS.retrait({}), action: { action: 'voir', title: 'Voir le code' } },
  { id: 'offre', re: /^offer-/, titre: (k) => `${k} offres à trancher`, url: DESTINATIONS.offres(), action: { action: 'voir', title: 'Répondre' } },
  { id: 'message', re: /^msg-/, titre: (k) => `${k} nouveaux messages`, url: lienNotif('messages', { site: 'vinted' }), action: { action: 'voir', title: 'Répondre' } },
];
// Le genre d'une notification (par son étiquette), ou `null` (elle ne se regroupe pas :
// double vente, rappels, dernier jour d'un retrait — chacun compte seul).
export const genreDe = (tag) => { const t = String(tag || ''); return GENRES.find((g) => g.re.test(t)) || null; };
// Les gestes des notifications qui ne se regroupent pas (par catégorie).
const ACTION_CAT = {
  doublevente: { action: 'voir', title: 'Retirer l’annonce' },
  expedier: { action: 'voir', title: 'Voir les colis' },
  soir: { action: 'voir', title: 'Voir les colis' },
  colis: { action: 'voir', title: 'Voir le colis' },
  offremini: { action: 'voir', title: 'Répondre' },
  action: { action: 'voir', title: 'Ouvrir' },
  urssaf: { action: 'voir', title: 'Déclarer' },
  relecture: { action: 'voir', title: 'Voir les comptes' },
  capture: { action: 'voir', title: 'Voir' },
  lbcsuppression: { action: 'voir', title: 'Ouvrir' },
};
export const actionDe = (cat, tag) => { const g = genreDe(tag); return (g && g.action) || ACTION_CAT[cat] || null; };

// L'étiquette envoyée au téléphone : regroupée ⇒ celle du genre ; sinon celle de
// l'objet (posée par l'émetteur), préfixée pour ne jamais toucher une étiquette
// d'une autre app.
export function etiquette({ tag, cat, regroupe }) {
  const g = regroupe ? genreDe(tag) : null;
  if (g) return `vrm-${g.id}`;
  const t = String(tag || '').replace(/[^A-Za-z0-9_|.-]/g, '').slice(0, 80);
  return t ? (t.startsWith('vrm-') ? t : `vrm-${t}`) : `vrm-${cat || 'notif'}`;
}

// Le texte regroupé : `k` notifications NON LUES de ce genre (celle-ci comprise).
// k ≤ 1 ⇒ inchangé. Le corps dit la dernière (son titre, puis son corps).
export function texteGroupe(n, genre, k) {
  if (!genre || !(k > 1)) return n;
  const derniere = [n.title, n.body].filter(Boolean).join(' · ');
  return { title: couper(genre.titre(k), TITRE_MAX), body: couper(`Dernier : ${derniere}`, CORPS_MAX), url: genre.url };
}

// La photo : seulement prouvée (même e-mail que la vente) et servie par Vinted.
export const RE_PHOTO_SURE = /^https:\/\/images\d*\.vinted\.net\/tc?\/[^\s"'<>]{8,480}$/i;
export const imageSure = (photo) => (photo && typeof photo === 'object' && photo.preuve === 'meme-email' && RE_PHOTO_SURE.test(String(photo.url || '')) ? String(photo.url) : null);

export { echeancePressante } from './notif-textes.js';

// Le nom court d'une famille (cloche, aperçus) et son icône (noms de ICON_PATHS).
export const ICONE_FAMILLE = { ventes: 'cash', doublevente: 'alert', rappels: 'clock', poster: 'box', arrives: 'pin', offres: 'tag', messages: 'chat', test: 'bell2' };
// Le geste écrit sous une ligne de la cloche (ce que fait le toucher).
export const GESTE_FAMILLE = { ventes: 'Voir la vente', doublevente: 'Retirer l’annonce', rappels: 'Ouvrir', poster: 'Voir le colis', arrives: 'Voir le code', offres: 'Répondre', messages: 'Répondre' };
