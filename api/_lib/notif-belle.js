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
// (15 nov.) LA RÈGLE DE RÉDACTION (api/_lib/notif-redaction.js) : titre ≤ 40, corps ≤ 90,
// coupe sur un mot, aucun identifiant technique ; le texte d'un regroupement dans la
// langue du vendeur.
import { TITRE_MAX as TITRE_R, CORPS_MAX as CORPS_R, couperMot, couperPhrases, sansIdentifiant, titreGroupe, corpsGroupe } from './notif-redaction.js';

export const ICONE_NOTIF = '/vrm-icon-v5-192.png';
// Monochrome (blanc sur transparent, 96 px) : Android le dessine dans la barre d'état.
export const BADGE_NOTIF = '/vrm-badge-96.png';
export const TITRE_MAX = TITRE_R;
// (15 nov.) 170 ⇒ 90 : sur l'écran verrouillé d'un iPhone, quatre lignes au plus.
export const CORPS_MAX = CORPS_R;

// Tout pictogramme (emoji, ⚠ ✅ ↩ ⏰ ❤ …), les sélecteurs de variante et les
// jointures. Les lettres, chiffres, « € », « N° », « · » restent.
const PICTO = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}︎️‍⃣]/gu;
export function sansEmoji(s) {
  return String(s == null ? '' : s).replace(PICTO, ' ').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/[^\S\u00a0\u202f]+/g, ' ')
    .replace(/^[\s·:—–-]+/, '').replace(/[\s·:—–-]+$/, '').trim();
}
// (15 nov.) Coupé sur un MOT (« … »), jamais au milieu.
export const couper = (s, n) => couperMot(s, n);
const majuscule = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Le texte d'une notification, propre : `{ title, body }`.
export function embellir({ title = '', body = '' } = {}, cat = null) {
  // (15 nov.) Aucun identifiant technique (n° de compte, de transaction, uuid, clé de ligne).
  let t = sansIdentifiant(sansEmoji(title));
  let b = sansIdentifiant(sansEmoji(body));
  if (t.length > TITRE_MAX) {
    // Couper sur un séparateur : la suite descend dans le corps, rien ne se perd.
    // « : » ne coupe que si ce qui précède dit déjà un fait (3 mots au moins) :
    // « Chronopost : ton colis… » ne doit pas devenir le titre « Chronopost ».
    const m = /^(.{6,}?)\s+(?:·|—|–|-)\s+(.+)$/.exec(t) || ((x) => (x && x[1].trim().split(/\s+/).length >= 3 ? x : null))(/^(.{6,}?)\s*:\s+(.+)$/.exec(t));
    const tete = m && m[1].length <= TITRE_MAX ? m[1] : null;
    // (15 nov.) Corps ≤ 90 : la suite du titre passe en tête ; si le tout ne tient pas, elle
    // passe en QUEUE (c'est elle qui sera coupée, jamais le lieu, le code ou le n° du corps).
    // (16 nov.) « Tenir » se juge sur la 1re PHRASE du corps (couperPhrases garde des phrases entières) : la suite du titre
    // (« 2927,47 € à déclarer ») reste devant tant qu'elle tient avec elle — la phrase suivante, elle, peut tomber.
    const premiere = b ? (/^[\s\S]*?[.!?](?=\s|$)/.exec(b) || [b])[0] : '';   // sans lookbehind (Safari < 16.4, audit-safari)
    if (tete) { const devant = [majuscule(m[2]), b].filter(Boolean).join(' · '); b = devant.length <= CORPS_MAX || !b || [majuscule(m[2]), premiere].join(' · ').length <= CORPS_MAX ? devant : [b, m[2]].join(' · '); t = tete; }
    else { if (!b) b = t; t = couper(t, TITRE_MAX); }
  }
  if (!t) {
    const f = FAMILLES.find((x) => x.id === familleDe(cat));
    t = f ? f.titre : 'VRM';
  }
  // (15 nov.) Corps ≤ 90 : les phrases entières qui tiennent, jamais une phrase coupée au milieu.
  return { title: t, body: couperPhrases(b, CORPS_MAX) };
}

// ── LES GENRES : ce qui se regroupe, et comment ────────────────────────────
// `re` : l'étiquette posée par l'émetteur (une par objet) ; `titre(k)` : la
// notification regroupée ; `url` : l'écran de la liste ; `action` : le geste.
export const GENRES = [
  // (15 nov.) `titre(k, langue)` : le texte vient de la règle de rédaction (5 langues).
  { id: 'bordereau', sansTitre: true, re: /^bord-/, titre: (k, l) => titreGroupe('bordereau', k, l), url: DESTINATIONS.colis({}), action: { action: 'voir', title: 'Imprimer' } },
  { id: 'vente', re: /^(sale|vc-vente)-/, titre: (k, l) => titreGroupe('vente', k, l), url: lienNotif('ventes'), action: { action: 'voir', title: 'Voir la vente' } },
  { id: 'argent', re: /^final-/, titre: (k, l) => titreGroupe('argent', k, l), url: lienNotif('ventes', { site: 'vinted' }), action: null },
  { id: 'arrivee', re: /^(relais|retrait-code)-/, titre: (k, l) => titreGroupe('arrivee', k, l), url: DESTINATIONS.retrait({}), action: { action: 'voir', title: 'Voir le code' } },
  { id: 'offre', re: /^offer-/, titre: (k, l) => titreGroupe('offre', k, l), url: DESTINATIONS.offres(), action: { action: 'voir', title: 'Répondre' } },
  // (11 nov.) Les rappels posés par le vendeur (« Me le rappeler ») : plusieurs ⇒ « 3 rappels », Ma journée.
  { id: 'rappel', re: /^rappel-/, titre: (k, l) => titreGroupe('rappel', k, l), url: lienNotif('journee'), action: { action: 'voir', title: 'Ouvrir' } },
  { id: 'message', re: /^msg-/, titre: (k, l) => titreGroupe('message', k, l), url: lienNotif('messages', { site: 'vinted' }), action: { action: 'voir', title: 'Répondre' } },
];
// Le genre d'une notification (par son étiquette), ou `null` (elle ne se regroupe pas :
// double vente, rappels, dernier jour d'un retrait — chacun compte seul).
export const genreDe = (tag) => { const t = String(tag || ''); return GENRES.find((g) => g.re.test(t)) || null; };
// Les gestes des notifications qui ne se regroupent pas (par catégorie).
const ACTION_CAT = {
  doublevente: { action: 'voir', title: 'Retirer l’annonce' },
  expedier: { action: 'voir', title: 'Voir les colis' },
  soir: { action: 'voir', title: 'Ouvrir' },
  colis: { action: 'voir', title: 'Voir le colis' },
  offremini: { action: 'voir', title: 'Répondre' },
  action: { action: 'voir', title: 'Ouvrir' },
  urssaf: { action: 'voir', title: 'Déclarer' },
  relecture: { action: 'voir', title: 'Voir les comptes' },
  capture: { action: 'voir', title: 'Voir' },
  lbcsuppression: { action: 'voir', title: 'Ouvrir' },
};
export const actionDe = (cat, tag) => { const g = genreDe(tag); return (g && g.action) || ACTION_CAT[cat] || null; };

// L'étiquette d'une notification : celle de l'OBJET (posée par l'émetteur — une
// mise à jour du même objet remplace l'ancienne). Le regroupement en pose une
// seconde, `tagGroupe` (« vrm-<genre> »), quand plusieurs du même genre attendent :
// le service worker montre alors le groupe et ferme les notifications de ce genre.
export const etiquette = ({ tag, cat }) => String(tag || '').replace(/[^A-Za-z0-9_|.:-]/g, '').slice(0, 120) || `vrm-${cat || 'notif'}`;
export const etiquetteGroupe = (genre) => `vrm-${genre.id}`;

// Le texte regroupé : `k` notifications NON LUES de ce genre (celle-ci comprise).
// k ≤ 1 ⇒ inchangé. (15 nov.) Le corps dit LA PLUS RÉCENTE en une ligne courte :
// sa `ligne` quand la règle de rédaction l'a faite (« 9060 vert/blanc T38, expire
// dans 24 h »), sinon son titre puis son corps. Dans la langue du vendeur.
export function texteGroupe(n, genre, k, langue = 'fr') {
  if (!genre || !(k > 1)) return n;
  const derniere = n.ligne ? n.ligne : (genre.sansTitre && n.body ? [n.body] : [n.title, n.body]).filter(Boolean).join(' · ');
  return { title: couper(genre.titre(k, langue), TITRE_MAX), body: corpsGroupe(derniere, langue), url: genre.url };
}

// La photo : seulement prouvée (même e-mail que la vente) et servie par Vinted.
export const RE_PHOTO_SURE = /^https:\/\/images\d*\.vinted\.net\/tc?\/[^\s"'<>]{8,480}$/i;
export const imageSure = (photo) => (photo && typeof photo === 'object' && photo.preuve === 'meme-email' && RE_PHOTO_SURE.test(String(photo.url || '')) ? String(photo.url) : null);

export { echeancePressante } from './notif-textes.js';

// Le nom court d'une famille (cloche, aperçus) et son icône (noms de ICON_PATHS).
export const ICONE_FAMILLE = { avis: 'star', comptes: 'link', ventes: 'cash', doublevente: 'alert', rappels: 'clock', poster: 'box', arrives: 'pin', offres: 'tag', messages: 'chat', test: 'bell2' };
// Le geste écrit sous une ligne de la cloche (ce que fait le toucher).
export const GESTE_FAMILLE = { avis: 'Lire l’avis', comptes: 'Voir le compte', ventes: 'Voir la vente', doublevente: 'Retirer l’annonce', rappels: 'Ouvrir', poster: 'Voir le colis', arrives: 'Voir le code', offres: 'Répondre', messages: 'Répondre' };
