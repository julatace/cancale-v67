// ── APPAREILS CONNECTÉS ET JOURNAL DE CE QUE VRM A FAIT (4 nov.) ─────────────
// Deux modes de `api/compte.js` (12 fonctions au plus : aucune route neuve).
//
// 1. `mode=appareils` — les sessions VRM du vendeur (`auth.sessions`, lisible
//    seulement par la clé de service, via les fonctions de la migration 024).
//    ⚠️ CLOISONNEMENT : l'identifiant passé aux fonctions est celui du JETON
//    vérifié par Supabase (`vendeurExige`), jamais un champ de la requête ; les
//    lignes rendues sont refiltrées ici sur cet identifiant (une fonction mal
//    réécrite ne ferait pas fuir un autre vendeur) ; l'adresse IP n'est jamais
//    lue ni rendue ; le navigateur est RÉSUMÉ (« iPhone · Safari »).
//    Fermer une session : seulement une session de SA liste, jamais celle de
//    l'appareil qui demande (pour lui, c'est « Se déconnecter »).
// 2. `mode=journal` — ce que VRM a envoyé en son nom, agrégé de ce qui est DÉJÀ
//    noté en base (aucune source inventée, rien n'est écrit) : file des messages
//    aux favoris (sa part seulement), journal de l'agent eBay, retraits eBay
//    automatiques, brouillons de Republier, bordereaux récupérés, et (8 nov.,
//    « confiance ») les commandes du téléphone exécutées par l'extension
//    (`cmd_relais_*` : bordereau, Leboncoin, réponse, offre) — projetées SANS
//    leur corps : jamais le texte d'un message, seulement le geste, le compte,
//    l'article et l'heure. Chaque événement porte sa PREUVE (`preuve`) : la
//    ligne de la base qui le note. Une ligne sans preuve ne sort pas d'ici.

import { createHash } from 'node:crypto';
import { evenementsJournalModeration, SELECT_MODERATION } from '../../src/moderationVinted.js';   // (11 nov., 5.350)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Le navigateur, résumé ───────────────────────────────────────────────────
export function resumerAppareil(ua) {
  const s = String(ua || '');
  if (!s) return 'Appareil inconnu';
  const appareil = /iPhone/i.test(s) ? 'iPhone'
    : /iPad/i.test(s) ? 'iPad'
    : /Android/i.test(s) ? 'Android'
    : /Macintosh|Mac OS X/i.test(s) ? 'Mac'
    : /Windows/i.test(s) ? 'Windows'
    : /CrOS/i.test(s) ? 'Chromebook'
    : /Linux/i.test(s) ? 'Linux'
    : /node|undici|vercel/i.test(s) ? 'Serveur VRM'
    : 'Appareil inconnu';
  const nav = /EdgiOS|EdgA|Edg\//.test(s) ? 'Edge'
    : /OPR\/|Opera/.test(s) ? 'Opera'
    : /FxiOS|Firefox\//.test(s) ? 'Firefox'
    : /CriOS|Chrome\//.test(s) ? 'Chrome'
    : /Safari\//.test(s) && /Version\//.test(s) ? 'Safari'
    : /AppleWebKit/.test(s) && /(iPhone|iPad)/.test(s) ? 'App iPhone'
    : '';
  return nav ? `${appareil} · ${nav}` : appareil;
}

// L'identifiant de la session de CET appareil, lu dans le jeton déjà vérifié
// par Supabase (`vendeurExige`) : sert seulement à dire « cet appareil ».
export function sessionDuJeton(jeton) {
  try {
    const p = String(jeton || '').split('.')[1];
    if (!p) return '';
    const j = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return UUID.test(String(j && j.session_id || '')) ? String(j.session_id) : '';
  } catch (_) { return ''; }
}

// Les lignes de `vrm_sessions_de`, pour l'écran. `null` (pas su) reste `null`.
export function listeAppareils(lignes, { userId, ici }) {
  if (!Array.isArray(lignes)) return null;
  return lignes
    .filter((l) => l && UUID.test(String(l.id || '')) && (l.user_id == null || String(l.user_id) === String(userId)))
    .map((l) => ({
      id: String(l.id),
      appareil: resumerAppareil(l.user_agent),
      creeLe: l.cree_le || null,
      actifLe: l.actif_le || l.cree_le || null,
      ici: !!ici && String(l.id) === String(ici),
    }))
    .sort((a, b) => (b.ici - a.ici) || String(b.actifLe || '').localeCompare(String(a.actifLe || '')));
}

// ── Appel des fonctions de la base (clé de service) ─────────────────────────
async function rpc(base, cle, nom, corps, f) {
  try {
    const r = await f(`${base}/rest/v1/rpc/${nom}`, {
      method: 'POST',
      headers: { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(10000),
    });
    if (r.status === 404) return { absente: true };
    if (!r.ok) return null;
    return { valeur: await r.json() };
  } catch (_) { return null; }
}

// GET ⇒ { ok, appareils } · POST { session } ⇒ { ok, ferme }.
// `deps` : { base, cle, user:{id}, jeton, methode, corps, fetch }.
export async function traiterAppareils(deps) {
  const { base, cle, user, jeton, methode, corps } = deps;
  const f = deps.fetch || fetch;
  if (!user || !UUID.test(String(user.id || ''))) return { status: 401, body: { erreur: 'session' } };
  if (!cle) return { status: 503, body: { erreur: 'non-configure', message: "La liste des appareils n'est pas branchée sur le serveur." } };
  const ici = sessionDuJeton(jeton);
  const lire = async () => {
    const r = await rpc(base, cle, 'vrm_sessions_de', { p_user: user.id }, f);
    if (!r) return { status: 503, body: { erreur: 'base', message: "Je n'ai pas pu lire tes appareils — réessaie dans un instant." } };
    if (r.absente) return { status: 503, body: { erreur: 'pas-installe', message: "La liste des appareils n'est pas encore installée sur ta base (migration 024)." } };
    const appareils = listeAppareils(r.valeur, { userId: user.id, ici });
    if (!appareils) return { status: 503, body: { erreur: 'base', message: "Je n'ai pas pu lire tes appareils — réessaie dans un instant." } };
    return { status: 200, body: { ok: true, appareils } };
  };
  if (methode === 'GET') return lire();
  if (methode !== 'POST') return { status: 405, body: { erreur: 'GET ou POST' } };
  const id = String((corps && corps.session) || '');
  if (!UUID.test(id)) return { status: 400, body: { erreur: 'session-invalide' } };
  if (id === ici) return { status: 409, body: { erreur: 'ici', message: 'C’est cet appareil : utilise « Se déconnecter ».' } };
  // Seulement une session de SA liste (relue maintenant, sous SON identifiant).
  const l = await lire();
  if (l.status !== 200) return l;
  if (!l.body.appareils.some((a) => a.id === id)) return { status: 404, body: { erreur: 'inconnue', message: 'Cet appareil n’est plus connecté.' } };
  const r = await rpc(base, cle, 'vrm_fermer_session', { p_user: user.id, p_id: id }, f);
  if (!r || r.absente) return { status: 503, body: { erreur: 'base', message: "Je n'ai pas pu déconnecter cet appareil — réessaie dans un instant." } };
  const n = Number(r.valeur);
  if (n !== 1) return { status: 404, body: { erreur: 'inconnue', message: 'Cet appareil n’est plus connecté.' } };
  return { status: 200, body: { ok: true, ferme: id } };
}

// ── LE JOURNAL ──────────────────────────────────────────────────────────────
// Un événement : { at (ms), type, site, compte, cle:{item|sku|tx}, resultat, source }.
// `resultat` : 'ok' · 'refuse' · 'pause' · 'verifier' · 'en_cours'.
export const TYPES_JOURNAL = {
  favori: 'Message à un favori',
  favori_offre: 'Message et offre à un favori',
  republication: 'Republication',
  ebay_retrait: 'Retrait eBay automatique',
  ebay_action: 'Action eBay',
  bordereau: 'Bordereau récupéré',
  bordereau_demande: 'Bordereau demandé',
  lbc_publication: 'Annonce Leboncoin publiée',
  offre_acceptee: 'Offre acceptée',
  offre_refusee: 'Offre refusée',
  offre_faite: 'Offre envoyée',
  message_envoye: 'Message envoyé',
  // (11 nov., 5.350) constatés chez Vinted (src/moderationVinted.js)
  moderation_masquee: 'Annonce masquée par Vinted',
  moderation_disparue: 'Annonce disparue · peut-être retirée par Vinted',
  moderation_banni: 'Compte fermé par Vinted',
  moderation_restreint: 'Compte limité par Vinted',
};
// (8 nov.) LA PREUVE de chaque ligne : la ligne de SA base qui la note. Une
// source absente d'ici ⇒ l'événement n'est pas rendu (audit-confiance).
export const PREUVES_JOURNAL = {
  favoris: 'Noté dans la file des messages aux favoris',
  brouillons: 'Noté dans la fiche de republication',
  ebay_retraits_auto: 'Noté dans le registre des retraits eBay',
  ebay_agent_journal: 'Noté dans le journal des actions eBay',
  bordereaux: 'Le bordereau est rangé dans ta base',
  relais: 'Résultat écrit par l’extension dans la commande',
  extension: 'Noté par l’extension au moment du geste',
  // (11 nov., 5.350) Ce que VINTED a fait, constaté par l'extension (jamais un geste de VRM).
  moderation: 'Constaté par l’extension en relisant ton dressing ou ton profil Vinted',
};
// Ce qu'aucune ligne de la base ne note — dit tel quel à l'écran.
export const NON_JOURNALISE = [
  // (10 nov., lot G) L'extension 5.337 note ces gestes en base (`journal_vrm_*`) : ils sont ci-dessus.
  // Ce qui reste dit : ce qu'une extension plus ancienne a fait.
  ['offres', 'Offres Vinted acceptées ou refusées depuis l’ordinateur avec une extension avant 5.337 : pas notées en base.'],
  ['messages', 'Réponses aux acheteurs Vinted envoyées depuis l’ordinateur avec une extension avant 5.337 : pas notées en base.'],
  ['lbc', 'Suppressions et réponses Leboncoin : pas notées en base.'],
  ['vestiaire', 'Réponses et offres Vestiaire : pas notées en base.'],
  ['relance', 'Remises en vente eBay : pas notées en base.'],
  ['republications', 'Republications : notées depuis le 28 oct. seulement.'],
];

const ms = (v) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : (/^\d+$/.test(String(v)) ? Number(v) : Date.parse(String(v)));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const ACTIONS_EBAY = {
  expedier: 'Expédition notée', messageacheteur: 'Message à un acheteur', repondre: 'Réponse à un message', repondreoffre: 'Réponse à une offre',
  modifierannonce: 'Annonce modifiée', terminerannonce: 'Annonce retirée', evaluer: 'Évaluation laissée', deciderretour: 'Décision sur un retour',
  rembourserretour: 'Remboursement', decannulation: 'Décision sur une annulation', promouvoir: 'Promotion', changertaux: 'Taux de promotion', arreterpromo: 'Promotion arrêtée',
  agentpublie: 'Annonce publiée',
};

// `sources` : { favoris:[{compte, jobs:[]}], ebayAgent:[{compte, items:[]}], ebayRetraits:[{compte, items:[]}],
//               brouillons:[row.data], bordereaux:[{uid, tx, item, capturedAt}] }
// Une source `null` = pas lue (dite par l'écran), `[]` = lue, rien.
export function evenementsJournal(sources) {
  const s = sources || {};
  const out = [];
  for (const f of s.favoris || []) for (const j of (f && Array.isArray(f.jobs) ? f.jobs : [])) {
    const etat = String(j && j.etat || '');
    const resultat = etat === 'envoye' || etat === 'verifie' ? 'ok' : etat === 'refuse' ? 'refuse' : etat === 'incertain' ? 'verifier' : etat === 'reserve' ? 'en_cours' : null;
    if (!resultat) continue;          // en attente, annulé, ignoré : rien n'est parti
    const at = ms(j.envoyeLe) || ms(j.traiteLe);
    if (!at && resultat !== 'en_cours') continue;
    out.push({ at, type: j.offre || j.pourcentage ? 'favori_offre' : 'favori', site: 'vinted', compte: f.compte || null, cle: { item: j.itemId ? String(j.itemId) : null }, resultat, source: 'favoris' });
  }
  for (const b of s.brouillons || []) {
    if (!b || b.parVRM !== true) continue;
    const publie = b.etat === 'publie';
    const at = ms(publie ? (b.publieLe || b.at) : b.at);
    if (!at) continue;
    out.push({ at, type: 'republication', site: 'vinted', compte: b.uid ? String(b.uid) : null, cle: { item: b.itemId ? String(b.itemId) : (b.ancienId ? String(b.ancienId) : null), ancien: b.ancienId ? String(b.ancienId) : null }, resultat: publie ? 'ok' : 'pause', source: 'brouillons' });
  }
  for (const g of s.ebayRetraits || []) for (const x of (g && Array.isArray(g.items) ? g.items : [])) {
    const at = ms(x && x.at); if (!at) continue;
    out.push({ at, type: 'ebay_retrait', site: 'ebay', compte: g.compte || null, cle: { sku: x.sku ? String(x.sku) : null, item: null }, resultat: 'ok', source: 'ebay_retraits_auto' });
  }
  for (const g of s.ebayAgent || []) for (const x of (g && Array.isArray(g.items) ? g.items : [])) {
    const at = ms(x && x.at); if (!at) continue;
    const e = String(x.etat || '');
    const resultat = e === 'reussi' ? 'ok' : e === 'echec' || e === 'refuse' ? 'refuse' : e === 'en_cours' ? 'verifier' : 'verifier';
    const ref = String(x.ref || '');
    out.push({ at, type: 'ebay_action', action: ACTIONS_EBAY[x.action] || 'Action eBay', site: 'ebay', compte: g.compte || null, cle: { sku: /^VRM-/i.test(ref) ? ref : null, item: null }, resultat, source: 'ebay_agent_journal' });
  }
  for (const l of s.bordereaux || []) {
    const at = ms(l && l.capturedAt); if (!at) continue;
    out.push({ at, type: 'bordereau', site: 'vinted', compte: l.uid ? String(l.uid) : null, cle: { item: l.item && /^\d+$/.test(String(l.item)) ? String(l.item) : null, tx: l.tx ? String(l.tx) : null }, resultat: 'ok', source: 'bordereaux' });
  }
  for (const c of s.relais || []) {
    const ev = evenementRelais(c);
    if (ev) out.push(ev);
  }
  // (10 nov., lot G) Les gestes notés par l'extension 5.337 (`journal_vrm_{uid}_{navigateur}`).
  // Un geste déjà noté par sa propre ligne (commande du téléphone) n'est pas compté deux fois.
  const duTelephone = out.filter((e) => e.source === 'relais');
  for (const ev of evenementsExtension(s.extension)) {
    if (duTelephone.some((r) => r.type === ev.type && String(r.compte || '') === String(ev.compte || '') && (r.cle.tx || null) === (ev.cle.tx || null) && Math.abs((r.at || 0) - ev.at) <= 15 * 60000)) continue;
    out.push(ev);
  }
  // (11 nov., 5.350) Ce que Vinted a masqué, fait disparaître ou limité (`moderation_vinted_{uid}`).
  for (const ev of evenementsJournalModeration(s.moderation)) out.push(ev);
  // La preuve, posée ici pour TOUS : une source sans preuve connue ne sort pas.
  return out.filter((e) => PREUVES_JOURNAL[e.source]).map((e) => ({ ...e, preuve: PREUVES_JOURNAL[e.source] }))
    .sort((a, b) => (b.at || Infinity) - (a.at || Infinity));
}

// ── Les gestes notés par l'extension (10 nov., lot G, extension 5.337) ──────────
// `journal_vrm_{uid}_{navigateur}` : { e: [{ t, s, a?, b?, x?, p?, de?, vers?, auto? }] } —
// une sorte, une heure, des numéros, des prix ; jamais un texte ni un pseudo (l'extension
// rebâtit chaque entrée, ici on la rebâtit encore). Seules les sortes qu'AUCUNE autre
// ligne ne note entrent : la republication (fiche de brouillon), le message à un favori
// (file des favoris) et le bordereau (rangé dans la base) ont déjà leur preuve.
// Le compte vient de l'IDENTIFIANT de la ligne, jamais d'un champ libre.
// (11 nov., extension 5.340) Le mode vacances posé / retiré : aucune autre ligne ne le note.
const SORTES_EXTENSION = { offre_acceptee: 'offre_acceptee', offre_refusee: 'offre_refusee', contre_offre: 'offre_faite', reponse: 'message_envoye', baisse_prix: 'baisse_prix', modifiee: 'annonce_modifiee', vacances_on: 'vacances_pose', vacances_off: 'vacances_retire' };
const numeroOk = (v) => (v != null && /^\d{1,20}$/.test(String(v)) ? String(v) : null);
const prixOk = (v) => { const n = Number(v); return v != null && v !== '' && Number.isFinite(n) && n > 0 && n < 1e6 ? Math.round(n * 100) / 100 : null; };
export function evenementsExtension(lignes) {
  const out = [], vus = new Set();
  for (const l of Array.isArray(lignes) ? lignes : []) {
    const m = /^journal_vrm_(\d{1,20})_[0-9a-f]{16}$/.exec(String((l && l.id) || ''));
    if (!m) continue;
    for (const e of (Array.isArray(l.e) ? l.e : [])) {
      const type = e && Object.prototype.hasOwnProperty.call(SORTES_EXTENSION, e.s) ? SORTES_EXTENSION[e.s] : null;
      const at = e ? ms(e.t) : null;
      if (!type || !at) continue;
      const cle = { item: numeroOk(e.a), tx: numeroOk(e.x) };
      const k = [m[1], at, type, cle.item || '', cle.tx || ''].join('|');
      if (vus.has(k)) continue;
      vus.add(k);
      const ev = { at, type, site: 'vinted', compte: m[1], cle, resultat: 'ok', source: 'extension' };
      if (e.auto === true) ev.auto = true;
      const de = prixOk(e.de), vers = prixOk(e.vers), p = prixOk(e.p);
      if (de != null && vers != null) ev.prix = { de, vers };
      else if (p != null) ev.prix = { p };
      out.push(ev);
    }
  }
  return out;
}

// Une commande du téléphone (`cmd_relais_*`), projetée sans corps. Seuls les
// gestes PARTIS comptent : en attente, annulée ou expirée ⇒ rien n'est parti.
const ETAT_RELAIS = { fait: 'ok', refuse: 'refuse', echec: 'refuse', 'en-cours': 'en_cours', pris: 'verifier' };
export function evenementRelais(c) {
  if (!c) return null;
  const resultat = ETAT_RELAIS[String(c.etat || '')];
  if (!resultat) return null;
  const at = ms(c.finiLe) || ms(c.prisLe) || ms(c.demandeLe);
  if (!at) return null;
  const uid = /^\d{1,20}$/.test(String(c.uid || '')) ? String(c.uid) : null;
  if (c.cmd === 'bordereau') return { at, type: 'bordereau_demande', site: 'vinted', compte: uid, cle: { tx: /^\d{1,20}$/.test(String(c.tx || '')) ? String(c.tx) : null }, resultat, source: 'relais', via: 'telephone' };
  if (c.cmd === 'lbcPublier') return { at, type: 'lbc_publication', site: 'leboncoin', compte: null, cle: { lbc: /^\d{1,20}$/.test(String(c.lbc || '')) ? String(c.lbc) : null }, resultat, source: 'relais', via: 'telephone' };
  if (c.cmd === 'exec') {
    const e = String(c.endpoint || ''), m = String(c.methode || '').toUpperCase();
    const tx = (/^\/api\/v2\/transactions\/(\d+)\//.exec(e) || [])[1] || null;
    const type = m === 'PUT' && /\/offer_requests\/\d+\/accept$/.test(e) ? 'offre_acceptee'
      : m === 'PUT' && /\/offer_requests\/\d+\/reject$/.test(e) ? 'offre_refusee'
      : m === 'POST' && /^\/api\/v2\/transactions\/\d+\/offers$/.test(e) ? 'offre_faite'
      : m === 'POST' && /^\/api\/v2\/conversations\/\d+\/replies$/.test(e) ? 'message_envoye'
      : m === 'POST' && e === '/vrm/favoris' ? 'favori'
      : null;
    if (!type) return null;
    return { at, type, site: 'vinted', compte: uid, cle: { tx }, resultat, source: 'relais', via: 'telephone' };
  }
  return null;
}

// ── La lecture (côté serveur) ───────────────────────────────────────────────
// `lireVendeur(chemin)` lit AU NOM du vendeur (son jeton : RLS ne rend que SES
// lignes). `lireService(chemin)` lit avec la clé de service — utilisé pour la
// SEULE file des favoris (rangée sous le propriétaire neutre), filtrée sur
// `proprietaires` ⊇ [lui] et réduite à `groupes[lui]`.
const hache = (uid) => createHash('sha256').update(String(uid)).digest('hex');
export async function lireJournal({ userId, lireVendeur, lireService, neutre }) {
  const sources = {}; const pasLu = [];
  const comptes = await lireVendeur('vinted_accounts?select=vinted_user_id');
  const parHache = new Map();
  if (Array.isArray(comptes)) for (const c of comptes) if (c && c.vinted_user_id != null) parHache.set(hache(c.vinted_user_id), String(c.vinted_user_id));
  // Favoris
  if (lireService && neutre) {
    const rows = await lireService(`app_data?owner=eq.${neutre}&id=like.favoris_file_*&data->proprietaires=cs.${encodeURIComponent(JSON.stringify([userId]))}&select=id,groupe:data->groupes->${encodeURIComponent('"' + userId + '"')}&limit=100`);
    if (Array.isArray(rows)) sources.favoris = rows.filter((r) => /^favoris_file_[a-f0-9]{64}$/.test(String(r && r.id || ''))).map((r) => ({ compte: parHache.get(String(r.id).slice(13)) || null, jobs: r.groupe && Array.isArray(r.groupe.jobs) ? r.groupe.jobs.map((j) => ({ etat: j.etat, envoyeLe: j.envoyeLe, traiteLe: j.traiteLe, itemId: j.itemId, offre: j.offre ? true : undefined, pourcentage: j.pourcentage })) : [] }));
    else { sources.favoris = null; pasLu.push('favoris'); }
  } else { sources.favoris = null; pasLu.push('favoris'); }
  const lignes = async (nom, chemin, map) => {
    // Double barrière : RLS (son jeton) ET le filtre explicite sur son identifiant.
    const r = await lireVendeur(chemin.replace('app_data?', `app_data?owner=eq.${userId}&`));
    if (!Array.isArray(r)) { sources[nom] = null; pasLu.push(nom); return; }
    sources[nom] = r.map(map);
  };
  const compteEbay = (id, prefixe) => { const k = String(id).slice(prefixe.length).replace(/^_/, ''); return k || 'principal'; };
  await lignes('ebayAgent', 'app_data?id=like.ebay_agent_journal*&select=id,items:data->items&limit=50', (r) => ({ compte: compteEbay(r.id, 'ebay_agent_journal'), items: Array.isArray(r.items) ? r.items : [] }));
  await lignes('ebayRetraits', 'app_data?id=like.ebay_retraits_auto*&select=id,items:data->items&limit=50', (r) => ({ compte: compteEbay(r.id, 'ebay_retraits_auto'), items: Array.isArray(r.items) ? r.items : [] }));
  await lignes('brouillons', 'app_data?id=like.vinted_brouillon_*&select=uid:data->>uid,etat:data->>etat,at:data->>at,publieLe:data->>publieLe,itemId:data->>itemId,ancienId:data->>ancienId,parVRM:data->parVRM&limit=500', (r) => r);
  // ⚠️ Jamais `select=data` : la ligne d'un bordereau porte son PDF (§4.4).
  await lignes('bordereaux', 'app_data?id=like.harvest_*_label_*&select=id,uid:data->>uid,tx:data->>tx,item:data->>item,capturedAt:data->>capturedAt&limit=500', (r) => (/_label_\d+$/.test(String(r && r.id || '')) ? r : null));
  if (Array.isArray(sources.bordereaux)) sources.bordereaux = sources.bordereaux.filter(Boolean);
  // (8 nov.) Les commandes du téléphone : le geste, jamais son corps (`args.body`
  // porte le texte d'un message) — projeté champ par champ.
  await lignes('relais', 'app_data?id=like.cmd_relais_*&select=cmd:data->>cmd,etat:data->>etat,demandeLe:data->>demandeLe,prisLe:data->>prisLe,finiLe:data->>finiLe,uid:data->args->>uid,tx:data->args->>tx,lbc:data->args->>id,methode:data->args->>method,endpoint:data->args->>endpoint&order=id.desc&limit=300', (r) => r);
  // (10 nov., lot G) Les gestes notés par l'extension 5.337 : `e` seulement (jamais `data`).
  await lignes('extension', 'app_data?id=like.journal_vrm_*&select=id,e:data->e&limit=200', (r) => r);
  // (11 nov., 5.350) Les alertes de modération : `e` seulement.
  await lignes('moderation', `app_data?id=like.moderation_vinted_*&select=${SELECT_MODERATION}&limit=100`, (r) => r);
  return { evenements: evenementsJournal(sources), pasLu, nonJournalise: NON_JOURNALISE.map(([id, texte]) => ({ id, texte })) };
}
