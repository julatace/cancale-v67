// ═══════════════════════════════════════════════════════════════════════════
// « ME LE RAPPELER » — les rappels que le vendeur crée LUI-MÊME (11 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Depuis la fiche d'un article (N°), d'une vente ou d'un achat : « Me le
// rappeler » ⇒ quand (demain matin, dans 3 jours, dans 7 jours, une date) + une
// note courte facultative. Le jour dit, à 9 h (heure de Paris — VRM reste en
// France, §3), UNE notification « Rappel · N°124 · rebaisser le prix » qui ouvre
// l'élément ; une carte « Rappels du jour » dans Ma journée ; la liste dans
// Paramètres → Rappels ; « Fait » / « Reporter » / « Supprimer ».
//
// ⚠️ CE N'EST PAS UN RAPPEL AUTOMATIQUE. Julien a REFUSÉ le 11 oct. (CLAUDE.md
//    §3) les rappels « messages sans réponse depuis 24 h » et « évaluations à
//    laisser » : rien ici ne PROPOSE un rappel, rien n'en crée un sans SON clic
//    sur « Enregistrer ». `audit-rappels-perso.cjs` l'exige.
//
// LA FORME (clé `vrm_rappels` de la ligne `main`, synchronisée par compte, §5
// « Lectures et écritures ») : { [id]: rappel }. Fusionnée clé par clé entre
// appareils (`fusion3`, src/fusionNuage.js) : un rappel = une clé. Supprimer
// pose `etat: 'supprime'` (une pierre tombale purgée après 30 jours) — jamais
// une clé retirée, qu'un autre appareil recréerait à la fusion.
//   rappel = { id, sorte: 'article'|'vente'|'achat', num?, item?, tx?, plat?,
//              jour: 'AAAA-MM-JJ', note?, creeAt, majAt, etat: 'actif'|'fait'|'supprime',
//              faitAt?, reports? }
// L'IDENTITÉ (§5) : un N° (`cleNum`), un identifiant d'annonce Vinted, un n° de
// transaction — JAMAIS un titre. Un rappel sans identité n'est pas créé.
//
// LE SERVEUR (api/ship-reminders.js, passages déjà planifiés — AUCUNE fonction
// `api/` de plus) lit `main` PROJETÉ sur cette seule clé, écrit le mémo
// `rappels_perso_dedup` AVANT l'envoi (confirmé, sinon rien ne part), respecte
// les heures calmes (il attend la fin au lieu de ranger la notification la nuit)
// et ne met AUCUN texte du vendeur dans sa réponse (des nombres seulement).
//
// Pur : aucune lecture, aucune écriture, aucune dépendance de Node — l'app
// l'importe telle quelle (une règle, un propriétaire, §11).
// ═══════════════════════════════════════════════════════════════════════════

export const CLE_RAPPELS = 'vrm_rappels';
export const MEMO_RAPPELS = 'rappels_perso_dedup';
// L'heure (Paris) où un rappel du jour sonne.
export const HEURE_RAPPEL = 9;
export const NOTE_MAX = 80;
export const SORTES = ['article', 'vente', 'achat'];
// Un rappel dû depuis plus longtemps ne sonne plus (la carte de Ma journée le garde).
export const RETARD_MAX_JOURS = 2;
// Les pierres tombales et les rappels faits s'effacent après ce délai.
export const GARDER_JOURS = 30;
// Le mémo des envois se purge au-delà.
export const MEMO_JOURS = 60;

const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const RE_ID = /^[A-Za-z0-9_-]{6,40}$/;
const RE_TX = /^\d{3,20}$/;
const RE_ITEM = /^\d{3,20}$/;
const RE_NUM = /^[A-Za-z]{0,3}\d{1,6}$/;
const RE_PLAT = /^(vinted|leboncoin|ebay|vestiaire)$/;

// La clé d'un N° — la même que `cleNum` (App.jsx, src/cibleNotif.js).
export const cleNumRappel = (v) => {
  let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, '');
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return RE_NUM.test(s) ? s : '';
};

// ── Les jours (Paris) ──────────────────────────────────────────────────────
export function jourParis(ms = Date.now()) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); }
  catch (_) { return new Date(ms).toISOString().slice(0, 10); }
}
export function ajouterJours(jour, n) {
  if (!RE_JOUR.test(String(jour || ''))) return '';
  const [y, m, d] = jour.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}
const ecartJours = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
// L'instant (ms) de `heure`:00 à Paris le jour `jour` (heure d'été comprise).
export function instantParis(jour, heure = HEURE_RAPPEL) {
  if (!RE_JOUR.test(String(jour || ''))) return NaN;
  const [y, m, d] = jour.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, heure, 0, 0);
  let decal = 0;
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
    const h = Number((p.find((x) => x.type === 'hour') || {}).value);
    if (Number.isFinite(h)) decal = ((h - heure) + 24) % 24;
  } catch (_) { decal = 1; }
  return guess - decal * 3600000;
}

// ── Les choix rapides de la feuille ────────────────────────────────────────
export const CHOIX_QUAND = [
  { id: 'demain', lib: 'Demain matin', jours: 1 },
  { id: '3j', lib: 'Dans 3 jours', jours: 3 },
  { id: '7j', lib: 'Dans 7 jours', jours: 7 },
];
// Le jour d'un choix ('demain' | '3j' | '7j' | 'AAAA-MM-JJ'). Une date passée ⇒ ''.
export function jourDuChoix(choix, maintenant = Date.now()) {
  const auj = jourParis(maintenant);
  const c = CHOIX_QUAND.find((x) => x.id === choix);
  if (c) return ajouterJours(auj, c.jours);
  const s = String(choix || '');
  if (!RE_JOUR.test(s) || s < auj || s > ajouterJours(auj, 400)) return '';
  return s;
}
// Les notes proposées d'un toucher (il peut écrire la sienne) — par sorte.
export const NOTES_RAPIDES = {
  article: ['Rebaisser le prix', 'Republier', 'Changer les photos', 'Vérifier le stock'],
  vente: ['Relancer l’acheteur', 'Vérifier le colis', 'Vérifier le versement'],
  achat: ['Vérifier l’arrivée', 'Aller retirer le colis', 'Ouvrir un litige'],
};

// ── La forme ───────────────────────────────────────────────────────────────
const propreNote = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);
// La cible d'un rappel (identités seulement). `null` si aucune identité.
export function cibleRappel(c) {
  const x = c && typeof c === 'object' ? c : {};
  const sorte = SORTES.includes(x.sorte) ? x.sorte : '';
  if (!sorte) return null;
  const num = cleNumRappel(x.num);
  const item = RE_ITEM.test(String(x.item || '')) ? String(x.item) : '';
  const tx = RE_TX.test(String(x.tx || '')) ? String(x.tx) : '';
  const plat = RE_PLAT.test(String(x.plat || '')) ? String(x.plat) : '';
  if (sorte === 'article' && !num && !item) return null;
  if ((sorte === 'vente' || sorte === 'achat') && !tx) return null;
  return { sorte, ...(num ? { num } : {}), ...(item ? { item } : {}), ...(tx ? { tx } : {}), ...(plat ? { plat } : {}) };
}
// La clé d'identité d'une cible : deux rappels sur la même vente se voient.
export const cleCible = (c) => { const x = cibleRappel(c); return !x ? '' : x.sorte === 'article' ? (x.num ? `article:${x.num}` : `article:i${x.item}`) : `${x.sorte}:${x.tx}`; };
// Un rappel tel que la base le garde, ou `null` s'il est illisible.
export function normaliserRappel(r) {
  if (!r || typeof r !== 'object' || !RE_ID.test(String(r.id || ''))) return null;
  const cible = cibleRappel(r);
  if (!cible || !RE_JOUR.test(String(r.jour || ''))) return null;
  const etat = r.etat === 'fait' || r.etat === 'supprime' ? r.etat : 'actif';
  const note = propreNote(r.note);
  return { id: String(r.id), ...cible, jour: String(r.jour), ...(note ? { note } : {}), creeAt: String(r.creeAt || ''), majAt: String(r.majAt || r.creeAt || ''), etat,
    ...(r.faitAt ? { faitAt: String(r.faitAt) } : {}), ...(Number.isInteger(r.reports) && r.reports > 0 ? { reports: r.reports } : {}) };
}
export function lireRappels(v) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const out = [];
  for (const [k, r] of Object.entries(o)) { const n = normaliserRappel(r); if (n && n.id === k) out.push(n); }
  return out;
}
export const idRappel = (alea = Math.random) => 'r' + Date.now().toString(36) + Math.floor(alea() * 1e9).toString(36).padStart(6, '0');
// Le rappel neuf — créé SEULEMENT par « Enregistrer » (son clic). `null` si incomplet.
export function nouveauRappel({ cible, choix, note } = {}, maintenant = Date.now(), id = idRappel()) {
  const c = cibleRappel(cible);
  const jour = jourDuChoix(choix, maintenant);
  if (!c || !jour) return null;
  const at = new Date(maintenant).toISOString();
  return normaliserRappel({ id, ...c, jour, note, creeAt: at, majAt: at, etat: 'actif' });
}
// Les gestes : rendent la carte `vrm_rappels` À ÉCRIRE (une copie), ou `null` si rien ne change.
const avec = (carte, r) => { const n = normaliserRappel(r); return n ? { ...(carte && typeof carte === 'object' ? carte : {}), [n.id]: n } : null; };
export function poserRappel(carte, r) { return avec(carte, r); }
export function marquerFait(carte, id, maintenant = Date.now()) {
  const r = normaliserRappel(carte && carte[id]); if (!r || r.etat !== 'actif') return null;
  const at = new Date(maintenant).toISOString();
  return avec(carte, { ...r, etat: 'fait', faitAt: at, majAt: at });
}
export function reporterRappel(carte, id, choix, maintenant = Date.now()) {
  const r = normaliserRappel(carte && carte[id]); const jour = jourDuChoix(choix, maintenant);
  if (!r || r.etat === 'supprime' || !jour) return null;
  return avec(carte, { ...r, etat: 'actif', jour, faitAt: undefined, reports: (r.reports || 0) + 1, majAt: new Date(maintenant).toISOString() });
}
export function supprimerRappel(carte, id, maintenant = Date.now()) {
  const r = normaliserRappel(carte && carte[id]); if (!r || r.etat === 'supprime') return null;
  return avec(carte, { ...r, etat: 'supprime', majAt: new Date(maintenant).toISOString() });
}
export function modifierNote(carte, id, note, maintenant = Date.now()) {
  const r = normaliserRappel(carte && carte[id]); if (!r || r.etat === 'supprime') return null;
  return avec(carte, { ...r, note: propreNote(note), majAt: new Date(maintenant).toISOString() });
}
// Les pierres tombales et les rappels faits de plus de GARDER_JOURS : retirés (l'app, à son écriture).
export function purgerRappels(carte, maintenant = Date.now()) {
  const limite = maintenant - GARDER_JOURS * 86400000;
  const out = {};
  for (const [k, v] of Object.entries(carte && typeof carte === 'object' ? carte : {})) {
    const r = normaliserRappel(v);
    if (!r) continue;
    const t = Date.parse(r.majAt || r.creeAt || '');
    if (r.etat !== 'actif' && Number.isFinite(t) && t < limite) continue;
    out[k] = v;
  }
  return out;
}

// ── Ce que montre l'app ────────────────────────────────────────────────────
// Les rappels du jour (Ma journée) : actifs, échus aujourd'hui ou en retard — le plus ancien d'abord.
export function rappelsDuJour(rappels, maintenant = Date.now()) {
  const auj = jourParis(maintenant);
  return (rappels || []).filter((r) => r.etat === 'actif' && r.jour <= auj).sort((a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : (a.creeAt < b.creeAt ? -1 : 1)));
}
// Les rappels à venir (Paramètres → Rappels), le plus proche d'abord.
export function rappelsAVenir(rappels, maintenant = Date.now()) {
  const auj = jourParis(maintenant);
  return (rappels || []).filter((r) => r.etat === 'actif' && r.jour > auj).sort((a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : 0));
}
export const rappelsFaits = (rappels) => (rappels || []).filter((r) => r.etat === 'fait').sort((a, b) => (a.faitAt > b.faitAt ? -1 : 1));
// Le rappel actif posé sur la même cible (la feuille le dit au lieu d'en créer un second).
export const rappelDeCible = (rappels, cible) => { const k = cleCible(cible); return k ? (rappels || []).find((r) => r.etat === 'actif' && cleCible(r) === k) || null : null; };

// L'objet du rappel, en mots (jamais un titre d'annonce).
export function objetRappel(r) {
  if (!r) return '';
  if (r.num) return `N°${r.num}`;
  return r.sorte === 'vente' ? 'ta vente' : r.sorte === 'achat' ? 'ton achat' : 'ton annonce';
}
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
// « aujourd'hui » · « demain » · « hier » · « lundi 17 nov. »
export function quandEnMots(jour, maintenant = Date.now()) {
  if (!RE_JOUR.test(String(jour || ''))) return '';
  const auj = jourParis(maintenant);
  const e = ecartJours(auj, jour);
  if (e === 0) return 'aujourd’hui';
  if (e === 1) return 'demain';
  if (e === -1) return 'hier';
  const [y, m, d] = jour.split('-').map(Number);
  const js = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return `${JOURS[js]} ${d} ${MOIS[m - 1]}`;
}

// L'ÉTAT DE LA CIBLE au moment de l'ouvrir (« le rappel le dit au lieu d'ouvrir un vide »).
// `ctx` : { vendus: Set d'ids d'annonce vendus | null, presents: Set de cleNum | null (pas su),
//           annulee: (tx) => bool, venteDuNum: (cleNum) => tx | '' }.
// Rend { etat: 'present'|'vendu'|'parti'|'annulee'|'ok'|'pas-su', phrase }.
export function etatCible(r, ctx = {}) {
  if (!r) return { etat: 'pas-su', phrase: '' };
  if (r.sorte === 'article') {
    const vendus = ctx.vendus instanceof Set ? ctx.vendus : null;
    const tx = r.num && typeof ctx.venteDuNum === 'function' ? ctx.venteDuNum(r.num) : '';
    if ((r.item && vendus && vendus.has(String(r.item))) || tx) return { etat: 'vendu', phrase: `${objetRappel(r)} a été vendu entre-temps.`, ...(tx ? { tx } : {}) };
    const presents = ctx.presents instanceof Set ? ctx.presents : null;
    if (!presents || !r.num) return { etat: 'pas-su', phrase: '' };
    if (presents.has(r.num)) return { etat: 'present', phrase: '' };
    return { etat: 'parti', phrase: `${objetRappel(r)} n’est plus en ligne ni en stock (vendu ou supprimé entre-temps).` };
  }
  if (r.sorte === 'vente' && typeof ctx.annulee === 'function' && ctx.annulee(r.tx)) return { etat: 'annulee', phrase: 'Cette vente a été annulée entre-temps.' };
  return { etat: 'ok', phrase: '' };
}

// ── La notification (serveur) ──────────────────────────────────────────────
// L'adresse : l'écran de l'élément (par identité, api/_lib/lien-notif.js) + `rappel=<id>`,
// que l'app lit pour dire l'état de la cible et proposer « Fait » / « Reporter ».
export function lienRappel(r, lienNotif) {
  const extra = { rappel: r.id };
  if (r.sorte === 'vente') return lienNotif('ventes', { site: r.plat || 'vinted', cible: 'vente', tx: r.tx, ...extra });
  if (r.sorte === 'achat') return lienNotif('cat_achats', { vue: 'achats', cible: 'achat', tx: r.tx, ...extra });
  return lienNotif('journee', { num: r.num || '', ...extra });
}
export const TAG_RAPPEL = (id) => `rappel-${id}`;
export function texteRappel(r) {
  const obj = objetRappel(r);
  const objCap = obj.charAt(0).toUpperCase() + obj.slice(1);
  return { title: r.note ? `Rappel · ${obj} · ${r.note}` : `Rappel · ${obj}`, body: r.note ? '' : `${objCap} : tu as demandé qu’on te le rappelle aujourd’hui.` };
}
// Plusieurs rappels dus au même passage : UNE notification.
export function texteRappels(liste) {
  const n = liste.length;
  const corps = liste.slice(0, 4).map((r) => (r.note ? `${objetRappel(r)} · ${r.note}` : objetRappel(r))).join(' — ');
  return { title: `${n} rappels aujourd’hui`, body: corps + (n > 4 ? ` — et ${n - 4} autre${n - 4 > 1 ? 's' : ''}` : '') };
}
// Les rappels à faire sonner maintenant. `envoyes` = le mémo { [id@jour]: jour }.
// Dû = actif · jour ≤ aujourd'hui · 9 h (Paris) passées le jour même · pas plus de
// RETARD_MAX_JOURS de retard · pas déjà envoyé pour CE jour (un report ré-arme).
export const cleEnvoi = (r) => `${r.id}@${r.jour}`;
export function rappelsDus(rappels, envoyes, maintenant = Date.now()) {
  const auj = jourParis(maintenant);
  const plancher = ajouterJours(auj, -RETARD_MAX_JOURS);
  const memo = envoyes && typeof envoyes === 'object' ? envoyes : {};
  return (rappels || []).filter((r) => r.etat === 'actif' && r.jour <= auj && r.jour >= plancher
    && maintenant >= instantParis(r.jour, HEURE_RAPPEL) && !memo[cleEnvoi(r)]);
}
// Le mémo à écrire AVANT l'envoi (purgé au-delà de MEMO_JOURS).
export function memoApres(envoyes, dus, maintenant = Date.now()) {
  const auj = jourParis(maintenant), limite = ajouterJours(auj, -MEMO_JOURS);
  const out = {};
  for (const [k, v] of Object.entries(envoyes && typeof envoyes === 'object' ? envoyes : {})) if (RE_JOUR.test(String(v)) && v >= limite) out[k] = v;
  for (const r of dus) out[cleEnvoi(r)] = auj;
  return out;
}

// ── L'agenda (.ics, api/_lib/agenda-ics.js) ────────────────────────────────
// Un événement par rappel ACTIF à venir (ou d'aujourd'hui), à 9 h, alarme à l'heure.
export function evenementsRappels(carte, maintenant = Date.now()) {
  const auj = jourParis(maintenant);
  return lireRappels(carte).filter((r) => r.etat === 'actif' && r.jour >= auj).map((r) => ({
    uid: `rappel-${r.id}`, type: 'rappel', titre: texteRappel(r).title.slice(0, 70), jour: r.jour,
    at: instantParis(r.jour, HEURE_RAPPEL) + 30 * 60000, alarme: '-PT30M', note: 'Rappel posé dans VRM.',
  }));
}
