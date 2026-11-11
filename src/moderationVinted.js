// ═══════════════════════════════════════════════════════════════════════════
// QUAND VINTED CACHE, SUPPRIME OU RESTREINT — LA RÈGLE (11 nov., ext. 5.350)
// ═══════════════════════════════════════════════════════════════════════════
// Julien veut « être prévenu tout de suite quand Vinted cache, supprime ou
// restreint ». Rien de NEUF n'est lu chez Vinted : l'extension compare ce
// qu'elle lit DÉJÀ.
//
// 1. MASQUÉE PAR VINTED — une annonce en ligne (ou réservée) à la lecture
//    COMPLÈTE d'avant du dressing de SON compte, `is_hidden` à la suivante.
//    · mode vacances connu (`is_on_holiday` lu dans son profil) ⇒ rien : les
//      vacances expliquent tout ;
//    · TOUTES les annonces en ligne masquées d'un coup (≥ 3) ⇒ rien par annonce :
//      c'est le compte (vacances, ou une limite du compte, dite à part), pas une
//      annonce — « pas su » ne fait pas une alerte.
// 2. DISPARUE — une annonce en ligne ou masquée à la lecture complète d'avant,
//    ABSENTE de la suivante, qu'il n'a pas supprimée (`noterSuppression` : ce
//    Chrome, ou VRM lui-même pendant une republication). Vinted ne supprime pas
//    une annonce vendue : il la FERME (`item_closing_action: 'sold'`, mesuré).
//    Formulé prudemment : « disparue · peut-être retirée par Vinted » (il a pu
//    la supprimer depuis son téléphone).
//    · suppressions illisibles ⇒ aucune « disparue » (pas su) ;
//    · tout le dressing vide d'un coup (≥ 3) ⇒ rien (une suppression en masse,
//      ou une lecture qu'on ne comprend pas) ;
//    · une réservée qui disparaît ne dit rien (une vente en cours).
//    L'app retire encore toute « disparue » dont la vente est PROUVÉE.
// 3. LE COMPTE — `banni` (son profil : `is_account_banned` vrai, déjà relevé
//    par `noterEtatCompte`) ; `restreint` (Vinted a répondu « restricted /
//    suspended » à une mise en ligne ou à une offre : le frein de 24 h
//    `poserFreinRepub`, VRM a déjà arrêté les actions automatiques de CE compte).
//
// UNE LECTURE PARTIELLE NE PROUVE RIEN : seule la moisson ACTIVE qui a lu TOUTES
// les pages (`dressingCompletFaitFoi`) compare ; la première lecture d'un compte
// ne fait que poser le point de départ (jamais d'alerte sur ce qu'on n'a pas vu
// changer).
//
// JAMAIS DEUX FOIS : un événement ouvert (sans `f`) de la même sorte sur la même
// annonce (ou le même compte) n'est pas recréé ; un « restreint » ne revient pas
// dans les 24 h. Une annonce qui redevient visible FERME son événement (`f`).
//
// La ligne : `moderation_vinted_{uid}` = { uid, e: [{ k, s, t, a?, av?, j?, r?, f? }] }
//   k clé · s sorte (masquee|disparue|banni|restreint) · t quand (ms) ·
//   a annonce · av la lecture d'avant (ms) · j jusqu'à (ms) · r raison donnée
//   par Vinted (≤ 160 caractères, jamais un pseudo) · f fini (ms).
// Écrite par l'extension seule ; lue par l'app (Ma journée), par le serveur
// (une notification regroupée, `api/_lib/moderation-notif.js`) et par
// « Ce que VRM a fait ».
// Le bloc entre les balises est RECOPIÉ dans l'extension
// (`node scripts/audit-alerte-moderation.cjs --recopie`), jamais à la main.
// ═══════════════════════════════════════════════════════════════════════════

// <moderation-regle>
const MODERATION_LIGNE = 'moderation_vinted_';
const MODERATION_MAX = 200;
const MODERATION_JOURS = 90;
const MODERATION_RESTREINT_MS = 24 * 3600 * 1000;
const MODERATION_SORTES = ['masquee', 'disparue', 'banni', 'restreint'];
const RE_ID_MODERATION = /^\d{4,15}$/;
// L'état d'une annonce dans un dressing : o en ligne · r réservée · h masquée ·
// s vendue · c fermée · d brouillon. `null` = pas une annonce.
function etatArticleModeration(it) {
  if (!it || typeof it !== 'object' || it.id == null || !RE_ID_MODERATION.test(String(it.id))) return null;
  if (it.is_draft === true) return 'd';
  if (it.is_closed === true) return /sold/i.test(String(it.item_closing_action || '')) ? 's' : 'c';
  if (it.is_hidden === true) return 'h';
  if (it.is_reserved === true) return 'r';
  return 'o';
}
function etatsDressingModeration(items) {
  const out = {};
  for (const it of Array.isArray(items) ? items : []) {
    const e = etatArticleModeration(it);
    if (e) out[String(it.id)] = e;
  }
  return out;
}
// `avant` / `apres` : { at (ms), etats } — deux lectures COMPLÈTES du même compte.
// `supprimees` : { [id]: date } de SES suppressions (`null` = pas su).
// `vacances` : true · false · null (son profil).
function evenementsDressingModeration({ avant, apres, supprimees, vacances } = {}) {
  const rien = (raison) => ({ evenements: [], raison });
  if (!apres || !apres.etats || typeof apres.etats !== 'object' || !Number.isFinite(Number(apres.at))) return rien('lecture');
  if (!avant || !avant.etats || typeof avant.etats !== 'object' || !Number.isFinite(Number(avant.at))) return rien('premiere-lecture');
  const at = Number(apres.at), av = Number(avant.at);
  if (!(at > av)) return rien('ordre');
  const A = avant.etats, B = apres.etats;
  const ouverts = Object.keys(A).filter((id) => A[id] === 'o' || A[id] === 'r');
  let masquees = ouverts.filter((id) => B[id] === 'h');
  const raisons = [];
  if (vacances === true && masquees.length) { masquees = []; raisons.push('vacances'); }
  if (masquees.length >= 3 && masquees.length === ouverts.length) { masquees = []; raisons.push('tout-masque'); }
  let disparues = Object.keys(A).filter((id) => (A[id] === 'o' || A[id] === 'h') && !Object.prototype.hasOwnProperty.call(B, id));
  if (disparues.length && (supprimees === null || supprimees === undefined || typeof supprimees !== 'object')) { disparues = []; raisons.push('suppressions-pas-sues'); }
  else disparues = disparues.filter((id) => !(supprimees[id] != null && supprimees[id] !== ''));
  const restants = Object.keys(B).filter((id) => B[id] === 'o' || B[id] === 'h' || B[id] === 'r');
  if (disparues.length >= 3 && !restants.length) { disparues = []; raisons.push('tout-disparu'); }
  const evenements = [];
  for (const id of masquees.sort()) evenements.push({ k: `masquee:${id}:${at}`, s: 'masquee', t: at, a: id, av });
  for (const id of disparues.sort()) evenements.push({ k: `disparue:${id}:${at}`, s: 'disparue', t: at, a: id, av });
  return { evenements, raison: raisons.join(',') };
}
// Un événement du COMPTE (banni, restreint) — `null` si la sorte est inconnue.
function evenementCompteModeration(sorte, at, { raison = '', jusqua = null } = {}) {
  const t = Number(at);
  if ((sorte !== 'banni' && sorte !== 'restreint') || !Number.isFinite(t)) return null;
  const e = { k: `${sorte}:${t}`, s: sorte, t };
  const j = Number(jusqua);
  if (jusqua != null && Number.isFinite(j) && j > t) e.j = j;
  const r = String(raison || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (r) e.r = r;
  return e;
}
// Rebâtit une entrée (jamais un champ inconnu) — `null` si elle ne tient pas.
function nettoyerModeration(e) {
  if (!e || typeof e !== 'object' || !MODERATION_SORTES.includes(e.s)) return null;
  const t = Number(e.t);
  if (!Number.isFinite(t) || t <= 0 || typeof e.k !== 'string' || !e.k || e.k.length > 80) return null;
  const o = { k: e.k, s: e.s, t };
  if (e.s === 'masquee' || e.s === 'disparue') { if (!RE_ID_MODERATION.test(String(e.a || ''))) return null; o.a = String(e.a); }
  const av = Number(e.av); if (e.av != null && Number.isFinite(av) && av > 0 && av < t) o.av = av;
  const j = Number(e.j); if (e.j != null && Number.isFinite(j) && j > t) o.j = j;
  const f = Number(e.f); if (e.f != null && Number.isFinite(f) && f >= t) o.f = f;
  const r = typeof e.r === 'string' ? e.r.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
  if (r) o.r = r;
  return o;
}
// Ajoute les nouveaux événements à la liste rangée (jamais deux fois) et ferme
// ceux que la lecture contredit. `etats` : les états de la lecture complète qui
// vient d'arriver (ou null) ; `compte` : 'actif' quand le profil vient de le dire.
// Rend { liste, ajoutes, change }.
function fusionnerModeration(liste, nouveaux, { etats = null, compte = null, at = Date.now(), maintenant = Date.now() } = {}) {
  let change = false;
  const l = [];
  for (const x of Array.isArray(liste) ? liste : []) { const e = nettoyerModeration(x); if (e) l.push(e); else change = true; }
  const fin = Number(at);
  if (etats && typeof etats === 'object') {
    for (const e of l) {
      if (e.f || !e.a || !(e.t < fin)) continue;
      const st = etats[e.a];
      if (e.s === 'masquee' && st && st !== 'h') { e.f = fin; change = true; }
      else if (e.s === 'disparue' && st) { e.f = fin; change = true; }
    }
  }
  if (compte === 'actif') for (const e of l) if (e.s === 'banni' && !e.f && e.t < fin) { e.f = fin; change = true; }
  const ajoutes = [];
  for (const x of Array.isArray(nouveaux) ? nouveaux : []) {
    const n = nettoyerModeration(x);
    if (!n || n.f) continue;
    const meme = (e) => e.s === n.s && (n.a ? e.a === n.a : !e.a);
    // Un « limité » n'est ouvert que jusqu'à sa fin (`j`, sinon 24 h) : une nouvelle
    // limite des semaines plus tard est un nouvel événement.
    const ouvert = (e) => !e.f && !(e.s === 'restreint' && Number(e.j || (e.t + MODERATION_RESTREINT_MS)) <= n.t);
    if (l.some((e) => e.k === n.k)) continue;
    if (l.some((e) => meme(e) && ouvert(e))) continue;                               // déjà ouvert
    if (n.s === 'restreint' && l.some((e) => meme(e) && Math.abs(n.t - e.t) < MODERATION_RESTREINT_MS)) continue;
    l.push(n); ajoutes.push(n); change = true;
  }
  const lim = Number(maintenant) - MODERATION_JOURS * 864e5;
  const gardes = l.filter((e) => e.t > lim).sort((p, q) => p.t - q.t).slice(-MODERATION_MAX);
  if (gardes.length !== l.length) change = true;
  return { liste: gardes, ajoutes, change };
}
// </moderation-regle>

// ── CE QUI SUIT N'EST PAS DANS L'EXTENSION (l'app et le serveur) ─────────────
export const CAT_MODERATION = 'moderation';
export const LIGNE_MODERATION_VU = 'vrm_moderation_vu';          // l'app : { [k]: ms } posé par SON « C'est vu »
export const LIGNE_MODERATION_NOTIFIE = 'vrm_moderation_notifie'; // le serveur : { cles: { [k]: ms }, rev }
export const SELECT_MODERATION = 'id,e:data->e';
export const ALERTE_JOURS = 14;          // une carte de Ma journée reste au plus 14 jours
export const NOTIF_RECENTE_MS = 3 * 864e5; // une notification ne part que pour un événement de moins de 3 jours
const RE_LIGNE = /^moderation_vinted_(\d{1,20})$/;

// Les événements de toutes les lignes, chacun avec son compte (celui de
// l'IDENTIFIANT de la ligne, jamais un champ libre). `null` = pas su.
export function evenementsDesLignes(rows) {
  if (!Array.isArray(rows)) return null;
  const out = [], vus = new Set();
  for (const r of rows) {
    const m = RE_LIGNE.exec(String((r && r.id) || ''));
    if (!m) continue;
    for (const x of Array.isArray(r.e) ? r.e : []) {
      const e = nettoyerModeration(x);
      if (!e) continue;
      const cle = `${m[1]}|${e.k}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      out.push({ ...e, compte: m[1], cle });
    }
  }
  return out.sort((p, q) => q.t - p.t);
}
// Encore d'actualité : pas fini, pas passé (restreint après son « jusqu'à »).
export function estActif(e, maintenant = Date.now()) {
  if (!e || e.f) return false;
  if (e.s === 'restreint') return Number(e.j || (e.t + MODERATION_RESTREINT_MS)) > maintenant;
  return true;
}
// Les cartes de Ma journée : actives, de moins de 14 jours, pas « vues » par lui ;
// une « disparue » dont la vente est PROUVÉE (`vendues` : Set des identifiants
// d'annonce d'une vente prouvée) n'est pas une alerte.
export function alertesActives(rows, { vu = {}, vendues = null, maintenant = Date.now(), exclus = null } = {}) {
  const evts = evenementsDesLignes(rows);
  if (evts === null) return null;
  const v = vu && typeof vu === 'object' ? vu : {};
  return evts.filter((e) => estActif(e, maintenant)
    && maintenant - e.t < ALERTE_JOURS * 864e5
    && !(v[e.cle] != null)
    && !(exclus && exclus.has && exclus.has(e.compte))
    && !(e.s === 'disparue' && vendues && vendues.has && vendues.has(e.a)));
}

// Ce que le frein de 24 h arrête VRAIMENT (`lireFreinRepub` dans l'extension) :
// la republication, les baisses de prix, les offres automatiques. Rien d'autre
// n'est promis.
export const PAUSE_MODERATION = 'Pause conseillée : VRM a arrêté ses actions automatiques sur ce compte pour 24 h (republication, baisses de prix, offres auto).';
const heureParis = (ms) => {
  try {
    const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms));
    const g = (t) => (p.find((x) => x.type === t) || {}).value || '';
    return `${g('day')} ${g('month').replace('.', '')} à ${Number(g('hour'))} h ${g('minute')}`;
  } catch (_) { return new Date(ms).toISOString().slice(0, 16).replace('T', ' '); }
};
export const quandModeration = heureParis;

// Le texte d'UN événement : quoi, quand, la raison si Vinted la donne, le geste.
// `numero` : le N° de la fiche de CETTE annonce (identité) ou null ; `nom` : le compte.
export function texteEvenement(e, { numero = null, nom = '' } = {}) {
  const compte = nom ? ` · ${nom}` : '';
  const article = numero ? `N°${numero}` : (e && e.a ? `l'annonce ${e.a}` : '');
  const lien = e && e.a ? `https://www.vinted.fr/items/${e.a}` : 'https://www.vinted.fr/inbox';
  const jour = (ms) => heureParis(ms).split(' à ')[0];
  const entre = e && e.av ? (jour(e.av) === jour(e.t) ? `vue le ${jour(e.t)} entre ${heureParis(e.av).split(' à ')[1]} et ${heureParis(e.t).split(' à ')[1]}` : `vue entre le ${heureParis(e.av)} et le ${heureParis(e.t)}`) : `vue le ${heureParis(e && e.t)}`;
  if (!e) return null;
  if (e.s === 'masquee') return { titre: `Vinted a masqué ${article}${compte}`, quand: entre,
    detail: 'Elle n’est plus visible des acheteurs. Si tu ne l’as pas masquée toi-même, la raison est écrite sur l’annonce.',
    geste: 'Ouvre l’annonce sur Vinted', lien, ton: 'geste' };
  if (e.s === 'disparue') return { titre: `${article ? article.charAt(0).toUpperCase() + article.slice(1) : 'Une annonce'} a disparu${compte}`, quand: entre,
    detail: 'Peut-être retirée par Vinted — sauf si tu l’as supprimée depuis ton téléphone. Aucune vente prouvée, aucune suppression vue par VRM.',
    geste: 'Vérifie tes messages Vinted', lien: 'https://www.vinted.fr/inbox', ton: 'geste' };
  if (e.s === 'banni') return { titre: `Vinted a fermé le compte${compte}`, quand: `vu le ${heureParis(e.t)}`,
    detail: (e.r ? `Vinted dit : « ${e.r} ». ` : '') + PAUSE_MODERATION,
    geste: 'Vérifie tes messages Vinted', lien: 'https://www.vinted.fr/inbox', ton: 'alerte' };
  if (e.s === 'restreint') return { titre: `Vinted limite le compte${compte}`, quand: `vu le ${heureParis(e.t)}${e.j ? ` · jusqu’au ${heureParis(e.j)} au moins` : ''}`,
    detail: (e.r ? `Vinted dit : « ${e.r} ». ` : '') + PAUSE_MODERATION,
    geste: 'Vérifie tes messages Vinted', lien: 'https://www.vinted.fr/inbox', ton: 'alerte' };
  return null;
}

// Ce qui reste à notifier : actif, récent, pas encore notifié (`notifie` : { [cle]: ms }).
export function aNotifierModeration(evts, notifie, maintenant = Date.now()) {
  const n = notifie && typeof notifie === 'object' ? notifie : {};
  return (Array.isArray(evts) ? evts : []).filter((e) => estActif(e, maintenant) && maintenant - e.t < NOTIF_RECENTE_MS && n[e.cle] == null);
}
// UNE notification pour tout le lot (regroupée), le plus grave d'abord.
export function texteNotifModeration(evts, { nomCompte = () => '' } = {}) {
  const l = Array.isArray(evts) ? evts : [];
  if (!l.length) return null;
  const rang = { banni: 0, restreint: 1, masquee: 2, disparue: 3 };
  const tri = [...l].sort((p, q) => rang[p.s] - rang[q.s] || q.t - p.t);
  const nom = (e) => nomCompte(e.compte) || '';
  const comptes = [...new Set(tri.map(nom).filter(Boolean))];
  const sur = comptes.length === 1 ? ` sur ${comptes[0]}` : comptes.length > 1 ? ` sur ${comptes.length} comptes` : '';
  const n = (s) => tri.filter((e) => e.s === s).length;
  const morceaux = [];
  if (n('banni')) morceaux.push(n('banni') > 1 ? `${n('banni')} comptes fermés` : 'compte fermé');
  if (n('restreint')) morceaux.push(n('restreint') > 1 ? `${n('restreint')} comptes limités` : 'compte limité');
  if (n('masquee')) morceaux.push(`${n('masquee')} annonce${n('masquee') > 1 ? 's' : ''} masquée${n('masquee') > 1 ? 's' : ''}`);
  if (n('disparue')) morceaux.push(`${n('disparue')} annonce${n('disparue') > 1 ? 's' : ''} disparue${n('disparue') > 1 ? 's' : ''}`);
  const grave = n('banni') || n('restreint');
  const title = `Vinted${sur} : ${morceaux.join(', ')}`;
  const body = grave
    ? 'Pause conseillée : VRM a arrêté ses actions automatiques sur ce compte. Vérifie tes messages Vinted.'
    : (n('masquee') ? 'Ouvre l’annonce sur Vinted : la raison est écrite dessus.' : 'Peut-être retirée par Vinted. Vérifie tes messages Vinted.');
  return { title, body };
}

// « Ce que VRM a fait » : un événement constaté (jamais un geste de VRM).
export const TYPES_MODERATION = { masquee: 'moderation_masquee', disparue: 'moderation_disparue', banni: 'moderation_banni', restreint: 'moderation_restreint' };
export function evenementsJournalModeration(rows) {
  const evts = evenementsDesLignes(rows) || [];
  return evts.map((e) => ({ at: e.t, type: TYPES_MODERATION[e.s], site: 'vinted', compte: e.compte, cle: { item: e.a || null }, resultat: 'verifier', source: 'moderation' }));
}

export {
  MODERATION_LIGNE, MODERATION_MAX, MODERATION_JOURS, MODERATION_RESTREINT_MS, MODERATION_SORTES,
  etatArticleModeration, etatsDressingModeration, evenementsDressingModeration, evenementCompteModeration,
  nettoyerModeration, fusionnerModeration,
};
