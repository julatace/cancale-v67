// ════════════════════════════════════════════════════════════════════════════
//  SUPER PDP — chaque vendeur connecte SON compte, et ses factures PARTENT
//  (16 octobre). Plateforme agréée (réforme de la facturation électronique).
// ════════════════════════════════════════════════════════════════════════════
// Julien : « je veux que VRM se connecte à une plateforme agréée ». Règle §2.9 :
// c'est le compte (et la facturation à l'usage) DU VENDEUR, jamais celui de
// Julien. Ses identifiants sont collés une fois, rangés côté serveur, et le
// navigateur ne les relit JAMAIS : il apprend seulement « connecté · bac à
// sable / production ».
//
// ── CE QUI EST DOCUMENTÉ, ET D'OÙ ÇA VIENT ──────────────────────────────────
// ⚠️ La documentation officielle (superpdp.tech/documentation, /openapi) n'a
//    PAS pu être lue d'ici : le réseau de la session refuse ce domaine. Ce qui
//    suit vient d'un client open source qui dit avoir été testé de bout en bout
//    sur leur bac à sable (gem Ruby `super_pdp`, MIT, API `v1.beta`) et de
//    recoupements (moteur de recherche). À REVÉRIFIER sur la doc officielle
//    avant la production :
//    · authentification OAuth2 `client_credentials` : POST
//      https://api.superpdp.tech/oauth2/token, corps form-urlencoded
//      (grant_type, client_id, client_secret), réponse `access_token`,
//      `expires_in` (s) ; erreur : `error`, `error_description` ;
//    · bac à sable et production sur le MÊME hôte : c'est le compte (les
//      identifiants) qui décide de l'environnement. Le choix affiché est donc
//      ce que le vendeur DÉCLARE, pas une mesure ;
//    · envoi : POST /v1.beta/invoices, corps brut (le PDF Factur-X,
//      `application/pdf`), paramètre `external_id` ;
//    · lecture : GET /v1.beta/invoices/{id} ; liste : GET /v1.beta/invoices
//      (`direction=out`, `limit`, `starting_after_id`), réponse `{data,
//      has_more}`, chaque facture porte `id`, `external_id`, `events`
//      (`status_code`, `created_at`) ;
//    · 401 sur une requête ⇒ jeton renouvelé, UN nouvel essai.
// ⚠️ NON documenté, donc NON supposé : la forme de la réponse à l'envoi (on lit
//    `id` s'il y est, sinon « envoyée, identifiant pas lu ») ; le format des
//    erreurs (on lit `message`, `error`, `error_description`, `detail`,
//    `errors` — tel quel, nettoyé) ; les webhooks (le client dit qu'il n'y en a
//    pas encore : on RELIT, à la demande) ; l'e-reporting B2C par API (des
//    chemins existent dans le client, mais son corps est marqué « non confirmé
//    par l'API » : il n'est PAS branché).
//
// ── LES GARANTIES ───────────────────────────────────────────────────────────
// · Session exigée ; base cloisonnée exigée (une clé rangée « pour tout le
//   monde » serait la clé de quelqu'un pour les autres) ; toute lecture et
//   écriture filtrée `owner=eq.{vendeur}`.
// · Les identifiants sont CHIFFRÉS (AES-256-GCM) avec une clé qui n'existe que
//   sur le serveur (dérivée de VRM_COFFRE_CLE, sinon de SUPABASE_SERVICE_KEY),
//   et l'identifiant du vendeur est la donnée associée : un navigateur qui lit
//   SA ligne (RLS le lui permet) n'y voit qu'un chiffré, et un chiffré recopié
//   chez un autre vendeur ne se déchiffre pas. Sans clé de coffre : on ne range
//   RIEN (jamais en clair).
// · Trois issues d'envoi, jamais deux : envoyée (l'identifiant de Super PDP) ·
//   refusée (la raison de Super PDP, telle quelle, sans jeton) · INCERTAINE
//   (coupure, 5xx : on ne dit pas « refusée » — elle a pu partir). Avant tout
//   nouvel essai d'une incertaine, on la CHERCHE chez Super PDP par son
//   `external_id` ; liste illisible ⇒ on ne renvoie pas.
// · Un même numéro (FX-AAAA-NNNN) ne part jamais deux fois : le journal est
//   marqué « en cours » AVANT l'envoi, par comparer-et-échanger.
// · « Pas su » ne vaut jamais « pas connecté » : clé illisible ⇒ 503.
import crypto from 'crypto';
import { sbCle } from './cle.js';
import { baseCloisonnee } from './session.js';
import { lireDonnee, modifierDonnee } from './ebay.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
export const SUPERPDP_API = 'https://api.superpdp.tech';
export const SUPERPDP_TOKEN = `${SUPERPDP_API}/oauth2/token`;
const V = '/v1.beta';
export const ID_CLE = 'superpdp_cle';
export const ID_ENVOIS = 'superpdp_envois';
export const NUMERO_RE = /^FX-\d{4}-\d{4,6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PDF_MAX = 3 * 1024 * 1024;
const EN_COURS_MS = 3 * 60 * 1000;
const DELAI_MS = Number(process.env.SUPERPDP_DELAI_MS) || 25000;
const sbKey = () => process.env.SUPABASE_SERVICE_KEY || '';

// ── LE COFFRE ────────────────────────────────────────────────────────────────
function cleCoffre() {
  const base = process.env.VRM_COFFRE_CLE || sbKey();
  if (!base) return null;
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(base, 'utf8'), Buffer.from('vrm-coffre'), Buffer.from('superpdp-v1'), 32));
}
export const coffrePret = () => !!cleCoffre();
export function chiffrer(owner, obj) {
  const k = cleCoffre(); if (!k) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  c.setAAD(Buffer.from(String(owner)));
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join('.');
}
export function dechiffrer(owner, s) {
  const k = cleCoffre(); if (!k) return null;
  const p = String(s || '').split('.');
  if (p.length !== 4 || p[0] !== 'v1') return null;
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(p[1], 'base64'));
    d.setAAD(Buffer.from(String(owner)));
    d.setAuthTag(Buffer.from(p[2], 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(p[3], 'base64')), d.final()]).toString('utf8'));
  } catch (_) { return null; }
}

// ── LA BASE (clé de service, filtrée sur le vendeur) ─────────────────────────
// La connexion rangée. TROIS états, jamais deux : `undefined` pas su ·
// `null` aucune · `{env, depuis, cred}` (cred = null si le chiffré ne se lit
// plus : clé du serveur changée — on le DIT, on ne le prend pas pour « absente »).
export async function lireConnexion(owner) {
  if (!sbKey() || !UUID.test(String(owner || ''))) return undefined;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${ID_CLE}&owner=eq.${encodeURIComponent(owner)}&select=env:data->>env,depuis:data->>depuis,chiffre:data->>chiffre`, { headers: { ...sbCle(sbKey()) } });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    if (!rows[0] || !rows[0].chiffre) return null;
    const cred = dechiffrer(owner, rows[0].chiffre);
    return { env: rows[0].env === 'production' ? 'production' : 'sandbox', depuis: rows[0].depuis || null, cred: cred && cred.id && cred.secret ? cred : null };
  } catch (_) { return undefined; }
}
async function rangerConnexion(owner, env, cred) {
  const chiffre = chiffrer(owner, cred);
  if (!chiffre) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST',
      headers: { ...sbCle(sbKey()), 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner, id: ID_CLE, data: { v: 1, env, depuis: new Date().toISOString(), chiffre } }]),
    });
    return r.ok;
  } catch (_) { return false; }
}
async function effacerConnexion(owner) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${ID_CLE}&owner=eq.${encodeURIComponent(owner)}`, { method: 'DELETE', headers: { ...sbCle(sbKey()), Prefer: 'return=minimal' } });
    return r.ok;
  } catch (_) { return false; }
}

// ── LA PLATEFORME ────────────────────────────────────────────────────────────
// Ce que la plateforme dit d'une erreur, TEL QUEL, nettoyé : jamais un jeton,
// jamais l'identifiant ou le secret du vendeur, borné.
export function raisonPlateforme(j, cred) {
  let t = '';
  if (typeof j === 'string') t = j;
  else if (j && typeof j === 'object') {
    const errs = Array.isArray(j.errors) ? j.errors.map((e) => (typeof e === 'string' ? e : (e && (e.message || e.detail || e.code)) || '')).filter(Boolean).join(' · ') : '';
    t = [j.message, j.error_description, j.detail, errs].filter((x) => typeof x === 'string' && x).join(' — ') || (typeof j.error === 'string' ? j.error : '');
  }
  t = String(t).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/Bearer\s+\S+/gi, 'Bearer …').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '…');
  for (const s of [cred && cred.secret, cred && cred.id]) if (s && s.length >= 4) t = t.split(s).join('…');
  return t.trim().slice(0, 400);
}

const jetons = new Map();   // une instance : owner → { t, exp, empreinte }
const empreinte = (cred) => crypto.createHash('sha256').update(`${cred.id}\n${cred.secret}`).digest('hex').slice(0, 16);
export const oublierJetons = () => jetons.clear();

async function avecDelai(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), DELAI_MS);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); } finally { clearTimeout(t); }
}
// `{ok, token}` · `{ok:false, refuse:true, raison}` (identifiants refusés) ·
// `{ok:false, refuse:false}` (pas de réponse : on ne sait pas).
export async function jeton(owner, cred, neuf = false) {
  const e = empreinte(cred), m = jetons.get(owner);
  if (!neuf && m && m.empreinte === e && m.exp > Date.now()) return { ok: true, token: m.t };
  let r;
  try {
    r = await avecDelai(SUPERPDP_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: cred.id, client_secret: cred.secret }).toString(),
    });
  } catch (_) { return { ok: false, refuse: false }; }
  const j = await r.json().catch(() => null);
  if (r.ok && j && typeof j.access_token === 'string' && j.access_token) {
    const s = Number(j.expires_in) > 0 ? Number(j.expires_in) : 3600;
    if (jetons.size > 500) jetons.clear();
    jetons.set(owner, { t: j.access_token, exp: Date.now() + Math.max(0, s - 30) * 1000, empreinte: e });
    return { ok: true, token: j.access_token };
  }
  if (r.status === 400 || r.status === 401 || r.status === 403) return { ok: false, refuse: true, raison: raisonPlateforme(j, cred) || 'identifiants refusés' };
  return { ok: false, refuse: false };
}
// Une requête à l'API, avec UN nouvel essai après un 401 (jeton renouvelé).
// Rend `{rep, j}` ou `{coupure:true}` (rien reçu) ou `{jetonKo}`.
async function api(owner, cred, chemin, opts = {}) {
  for (let essai = 0; essai < 2; essai++) {
    const t = await jeton(owner, cred, essai > 0);
    if (!t.ok) return { jetonKo: t };
    let rep;
    try { rep = await avecDelai(SUPERPDP_API + V + chemin, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${t.token}`, accept: 'application/json' } }); }
    catch (_) { return { coupure: true }; }
    if (rep.status === 401 && essai === 0) { jetons.delete(owner); continue; }
    const brut = await rep.text().catch(() => '');
    let j = null; try { j = brut ? JSON.parse(brut) : null; } catch (_) { j = null; }
    return { rep, j, brut };
  }
  return { coupure: true };
}
const dernierStatut = (inv) => {
  const ev = inv && Array.isArray(inv.events) ? inv.events.slice() : [];
  ev.sort((a, b) => String(a && a.created_at || '').localeCompare(String(b && b.created_at || '')));
  const e = ev[ev.length - 1];
  return (e && (e.status_code || e.code)) ? String(e.status_code || e.code).slice(0, 60) : null;
};
const idDe = (j) => (j && (typeof j.id === 'string' || typeof j.id === 'number') ? String(j.id).slice(0, 80) : null);

// Cherche une facture émise par son `external_id`. `{trouve, id, statut}` ·
// `{absente:true}` (liste lue EN ENTIER) · `{pasSu:true}`.
async function chercher(owner, cred, numero) {
  let apres = '';
  for (let page = 0; page < 10; page++) {
    const q = `?direction=out&limit=100${apres ? '&starting_after_id=' + encodeURIComponent(apres) : ''}`;
    const r = await api(owner, cred, '/invoices' + q, { method: 'GET' });
    if (!r.rep || !r.rep.ok || !r.j || !Array.isArray(r.j.data)) return { pasSu: true };
    const vu = r.j.data.find((x) => x && String(x.external_id || '') === numero);
    if (vu) return { trouve: true, id: idDe(vu), statut: dernierStatut(vu) };
    if (!r.j.has_more || !r.j.data.length) return { absente: true };
    apres = idDe(r.j.data[r.j.data.length - 1]) || '';
    if (!apres) return { pasSu: true };
  }
  return { pasSu: true };
}

// ── LE JOURNAL DES ENVOIS (pas un secret : `{parNumero:{FX-…:{etat,…}}}`) ────
const entree = (d, numero) => (d && d.parNumero && d.parNumero[numero]) || null;
async function noter(owner, numero, e) {
  return modifierDonnee(ID_ENVOIS, owner, (d) => ({ ...(d || {}), parNumero: { ...((d && d.parNumero) || {}), [numero]: { ...e, at: new Date().toISOString() } } }));
}
// Ce qui revient au navigateur : jamais `jeton` (le marqueur interne).
const public_ = (e) => (e ? { etat: e.etat, id: e.id || null, statut: e.statut || null, at: e.at || null, raison: e.raison || '', env: e.env || null } : null);

// ── LES ACTIONS ─────────────────────────────────────────────────────────────
const repondre = (res, code, corps) => res.status(code).json(corps);
const ENV_OK = new Set(['sandbox', 'production']);
const champOk = (s) => typeof s === 'string' && s.trim().length >= 1 && s.length <= 512 && !/[\u0000-\u001F\s]/.test(s.trim());

export async function statut(owner, res) {
  const c = await lireConnexion(owner);
  if (c === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "Je n'ai pas pu lire ta connexion Super PDP (la base n'a pas répondu). Rouvre cet écran dans un moment." });
  const d = await lireDonnee(ID_ENVOIS, owner);
  const envois = d === undefined ? null : Object.fromEntries(Object.entries((d && d.parNumero) || {}).map(([k, v]) => [k, public_(v)]));
  return repondre(res, 200, {
    ok: true, coffre: coffrePret(),
    connecte: !!(c && c.cred), illisible: !!(c && !c.cred), env: c ? c.env : null, depuis: c ? c.depuis : null,
    envois,
  });
}

export async function connecter(owner, corps, res) {
  const env = String((corps && corps.environnement) || '');
  const id = corps && corps.client_id, secret = corps && corps.client_secret;
  if (!ENV_OK.has(env)) return repondre(res, 400, { erreur: 'env', message: 'Choisis « Bac à sable » ou « Production ».' });
  if (!champOk(id) || !champOk(secret)) return repondre(res, 400, { erreur: 'champs', message: 'Colle ton identifiant client ET ton secret client Super PDP.' });
  if (!coffrePret()) return repondre(res, 503, { erreur: 'coffre', message: "Le coffre du serveur n'est pas configuré : rien n'a été rangé." });
  const cred = { id: id.trim(), secret: secret.trim() };
  const t = await jeton(owner, cred, true);
  if (!t.ok && t.refuse) return repondre(res, 400, { erreur: 'refuse', message: `Super PDP refuse ces identifiants : « ${t.raison} ». Rien n'a été rangé.` });
  if (!t.ok) return repondre(res, 502, { erreur: 'injoignable', message: "Super PDP n'a pas répondu : je n'ai pas pu vérifier tes identifiants, rien n'a été rangé. Réessaie." });
  if (!(await rangerConnexion(owner, env, cred))) return repondre(res, 503, { erreur: 'base', message: "Super PDP a accepté tes identifiants, mais la base n'a pas pu les ranger. Réessaie." });
  return repondre(res, 200, { ok: true, connecte: true, env });
}

export async function deconnecter(owner, res) {
  if (!(await effacerConnexion(owner))) return repondre(res, 503, { erreur: 'base', message: "La base n'a pas répondu : ta connexion Super PDP est toujours rangée. Réessaie." });
  jetons.delete(owner);
  return repondre(res, 200, { ok: true, connecte: false });
}

// Relire une facture : son statut si on a son identifiant, sinon la CHERCHER
// par son numéro. Utilisée aussi avant tout nouvel essai d'une incertaine.
async function relireEntree(owner, cred, numero, e) {
  if (e && e.id) {
    const r = await api(owner, cred, `/invoices/${encodeURIComponent(e.id)}`, { method: 'GET' });
    if (r.rep && r.rep.ok && r.j) return { etat: 'envoye', id: e.id, statut: dernierStatut(r.j) || e.statut || null };
    return { pasSu: true };
  }
  const s = await chercher(owner, cred, numero);
  if (s.trouve) return { etat: 'envoye', id: s.id, statut: s.statut };
  if (s.absente) return { absente: true };
  return { pasSu: true };
}

export async function relire(owner, corps, res) {
  const numero = String((corps && corps.numero) || '');
  if (!NUMERO_RE.test(numero)) return repondre(res, 400, { erreur: 'numero', message: 'Numéro de facture illisible.' });
  const c = await lireConnexion(owner);
  if (c === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "Je n'ai pas pu lire ta connexion Super PDP. Réessaie." });
  if (!c || !c.cred) return repondre(res, 409, { erreur: 'pas-connecte', message: "Connecte d'abord ton compte Super PDP." });
  const d = await lireDonnee(ID_ENVOIS, owner);
  if (d === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "Je n'ai pas pu lire tes envois. Réessaie." });
  const e = entree(d, numero);
  const r = await relireEntree(owner, c.cred, numero, e);
  if (r.pasSu) return repondre(res, 502, { erreur: 'pas-su', message: "Super PDP n'a pas répondu : statut pas relu.", envoi: public_(e) });
  if (r.absente) {
    const n = { etat: 'absente', raison: "Super PDP ne l'a pas : elle peut être envoyée.", env: c.env };
    await noter(owner, numero, n);
    return repondre(res, 200, { ok: true, envoi: public_({ ...n, at: new Date().toISOString() }) });
  }
  const n = { etat: 'envoye', id: r.id, statut: r.statut, env: c.env };
  const note = await noter(owner, numero, n);
  return repondre(res, 200, { ok: true, note: note === true, envoi: public_({ ...n, at: new Date().toISOString() }) });
}

export async function envoyer(owner, corps, res) {
  const numero = String((corps && corps.numero) || '');
  if (!NUMERO_RE.test(numero)) return repondre(res, 400, { erreur: 'numero', message: 'Numéro de facture illisible (attendu FX-AAAA-NNNN).' });
  let pdf = null;
  try { pdf = Buffer.from(String((corps && corps.pdf) || ''), 'base64'); } catch (_) { pdf = null; }
  if (!pdf || pdf.length < 100 || pdf.length > PDF_MAX || pdf.subarray(0, 5).toString('latin1') !== '%PDF-' || !pdf.includes('factur-x.xml')) {
    return repondre(res, 400, { erreur: 'pdf', message: "Ce fichier n'est pas une facture Factur-X préparée par VRM : rien n'a été envoyé." });
  }
  const c = await lireConnexion(owner);
  if (c === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "Je n'ai pas pu lire ta connexion Super PDP (la base n'a pas répondu) : rien n'a été envoyé." });
  if (!c) return repondre(res, 409, { erreur: 'pas-connecte', message: "Connecte d'abord ton compte Super PDP : rien n'a été envoyé." });
  if (!c.cred) return repondre(res, 409, { erreur: 'illisible', message: 'Ta connexion Super PDP ne se lit plus côté serveur : reconnecte-la. Rien n\'a été envoyé.' });

  // 1. Ce que le journal dit déjà de CE numéro.
  const d = await lireDonnee(ID_ENVOIS, owner);
  if (d === undefined) return repondre(res, 503, { erreur: 'pas-su', message: "Je n'ai pas pu lire tes envois : rien n'a été envoyé (pour ne jamais l'envoyer deux fois)." });
  const e0 = entree(d, numero);
  if (e0 && e0.etat === 'envoye') return repondre(res, 200, { ok: true, deja: true, envoi: public_(e0) });
  const enCoursFrais = e0 && e0.etat === 'en-cours' && Date.now() - Date.parse(e0.at || 0) < EN_COURS_MS;
  if (enCoursFrais) return repondre(res, 409, { erreur: 'en-cours', message: 'Cette facture est déjà en cours d\'envoi.', envoi: public_(e0) });
  // 2. Incertaine (ou « en cours » abandonné) : on la CHERCHE avant tout renvoi.
  if (e0 && (e0.etat === 'incertain' || e0.etat === 'en-cours')) {
    const r = await relireEntree(owner, c.cred, numero, e0);
    if (r.pasSu) return repondre(res, 409, { erreur: 'incertain', message: "Je ne sais toujours pas si cette facture est partie, et Super PDP n'a pas pu me le dire : je ne la renvoie pas. Réessaie dans un moment.", envoi: public_(e0) });
    if (!r.absente) { await noter(owner, numero, { etat: 'envoye', id: r.id, statut: r.statut, env: c.env }); return repondre(res, 200, { ok: true, deja: true, envoi: public_({ etat: 'envoye', id: r.id, statut: r.statut, env: c.env, at: new Date().toISOString() }) }); }
  }
  // 3. Marquer « en cours » — seulement si l'état n'a pas bougé depuis la lecture.
  const marque = crypto.randomBytes(8).toString('hex');
  let bloque = null;
  const pose = await modifierDonnee(ID_ENVOIS, owner, (dd) => {
    bloque = null;
    const e = entree(dd, numero);
    if (e && (e.etat === 'envoye' || (e.etat === 'en-cours' && Date.now() - Date.parse(e.at || 0) < EN_COURS_MS))) { bloque = e; return undefined; }
    if ((e && e.etat) !== (e0 && e0.etat) && !(e0 && (e0.etat === 'incertain' || e0.etat === 'en-cours'))) { bloque = e; return undefined; }
    return { ...(dd || {}), parNumero: { ...((dd && dd.parNumero) || {}), [numero]: { etat: 'en-cours', jeton: marque, at: new Date().toISOString(), env: c.env } } };
  });
  if (bloque) return repondre(res, 409, { erreur: bloque.etat === 'envoye' ? 'deja' : 'en-cours', message: bloque.etat === 'envoye' ? 'Déjà envoyée.' : 'Cette facture est déjà en cours d\'envoi.', envoi: public_(bloque) });
  if (pose !== true) return repondre(res, 503, { erreur: 'base', message: "Je n'ai pas pu noter l'envoi dans la base : rien n'a été envoyé (pour ne jamais l'envoyer deux fois). Réessaie." });

  // 4. L'envoi.
  const r = await api(owner, c.cred, `/invoices?external_id=${encodeURIComponent(numero)}`, { method: 'POST', headers: { 'content-type': 'application/pdf' }, body: pdf });
  let fin, code, msg;
  if (r.jetonKo) {
    fin = { etat: 'refuse', raison: r.jetonKo.refuse ? `Super PDP refuse tes identifiants : « ${r.jetonKo.raison} ». Rien n'a été envoyé.` : "Super PDP n'a pas délivré d'accès : rien n'a été envoyé. Réessaie.", env: c.env };
    code = r.jetonKo.refuse ? 400 : 502; msg = fin.raison;
  } else if (r.coupure || !r.rep || r.rep.status === 408 || r.rep.status >= 500) {
    fin = { etat: 'incertain', raison: "La réponse de Super PDP n'est pas arrivée : je ne sais pas si elle est partie. Je la chercherai chez Super PDP avant tout nouvel essai.", env: c.env };
    code = 504; msg = fin.raison;
  } else if (r.rep.ok) {
    fin = { etat: 'envoye', id: idDe(r.j), statut: dernierStatut(r.j), env: c.env };
    code = 200;
  } else {
    fin = { etat: 'refuse', raison: raisonPlateforme(r.j || r.brut, c.cred) || `Super PDP a refusé la facture (HTTP ${r.rep.status}).`, http: r.rep.status, env: c.env };
    code = 422; msg = `Super PDP a refusé la facture : « ${fin.raison} »`;
  }
  const note = await noter(owner, numero, fin);
  const envoi = public_({ ...fin, at: new Date().toISOString() });
  if (code === 200) return repondre(res, 200, { ok: true, note: note === true, envoi });
  return repondre(res, code, { ok: false, erreur: fin.etat, message: msg, note: note === true, envoi });
}

// Le point d'entrée du mode `superpdp` de /api/compte.
export async function routeSuperPdp(req, res, { vendeur, corps, acces }) {
  if (!(await baseCloisonnee())) return repondre(res, 503, { erreur: 'base', message: "La base ne sépare pas encore les vendeurs : aucune clé n'est rangée tant que ce n'est pas le cas." });
  if (acces === false) return repondre(res, 402, { erreur: 'abonnement', message: 'Ton abonnement VRM est coupé : rien n\'est envoyé.' });
  const owner = vendeur.id;
  if (req.method === 'GET') return statut(owner, res);
  if (req.method !== 'POST') return repondre(res, 405, { erreur: 'GET ou POST' });
  if (!corps || typeof corps !== 'object') return repondre(res, 400, { erreur: 'corps' });
  const a = String(corps.action || '');
  if (a === 'connecter') return connecter(owner, corps, res);
  if (a === 'deconnecter') return deconnecter(owner, res);
  if (a === 'envoyer') return envoyer(owner, corps, res);
  if (a === 'relire') return relire(owner, corps, res);
  return repondre(res, 400, { erreur: 'action inconnue' });
}
