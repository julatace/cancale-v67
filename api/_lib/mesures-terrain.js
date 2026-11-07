// ═══════════════════════════════════════════════════════════════════════════
// LES TEMPS RÉELS DES VENDEURS, CÔTÉ SERVEUR (6 nov., v36)
// ═══════════════════════════════════════════════════════════════════════════
// La règle (cases, clés fermées, filtre, quantiles) : src/mesuresTerrain.js —
// LA MÊME que l'app (§11). Ici, ce que le serveur en fait :
//   · POST `/api/compte?mode=mesures` (un `sendBeacon` de l'app, au plus une
//     fois par minute) : le jeton du corps est VÉRIFIÉ auprès de Supabase (un
//     inconnu ne range rien), le lot repasse par `normaliserLot` (rien d'autre
//     qu'un compte dans une case fermée n'est rangé), puis il est ADDITIONNÉ à
//     l'agrégat du jour de Paris : `app_data`, ligne `mesures_jour_AAAA-MM-JJ`
//     du PROPRIÉTAIRE de l'installation (`proprietaireInstallation`, la règle de
//     « Signaler un problème »). Jamais l'identifiant d'un vendeur en clair :
//     l'anti-abus (au plus un lot par minute et `LOTS_MAX_JOUR` par jour) se
//     tient sur une EMPREINTE du jour (HMAC de l'identifiant ET du jour, avec un
//     secret du serveur) — elle change chaque jour, ne se relie à rien d'un jour
//     à l'autre et n'est jamais montrée (le panneau ne lit que leur NOMBRE).
//   · L'écriture est un comparer-et-échanger sur `data.rev` (PATCH conditionnel,
//     ou insertion « si absente ») : deux lots simultanés ne s'écrasent pas, le
//     perdant relit et rejoue (4 essais). Une lecture ratée n'écrit RIEN.
//   · GET (PROPRIÉTAIRE seulement) : les 14 derniers jours, en agrégats
//     (p50/p75/p95 par écran, appareil et mesure) — jamais un histogramme brut,
//     jamais une empreinte.
//   · La veille du matin (api/_lib/veille-plantages.js) lit les deux derniers
//     jours complets et prévient le propriétaire d'un p75 qui se dégrade de plus
//     de 30 %.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac } from 'node:crypto';
import { sbCle } from './cle.js';
import { proprietaireInstallation } from './signalement.js';
import { normaliserLot, fusionnerHisto, resumeJour, jourParis, LOTS_MAX_JOUR, totalLot } from '../../src/mesuresTerrain.js';

export const PREFIXE_MESURES = 'mesures_jour_';
export const JOURS_LUS = 14;
const ESSAIS = 4;

const cfg = (env) => ({ url: env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co', service: env.SUPABASE_SERVICE_KEY || '' });
export const idJour = (jour) => PREFIXE_MESURES + jour;

// L'empreinte du jour d'un appareil-vendeur : 12 caractères d'un HMAC (secret du
// serveur) de son identifiant et du jour. Sans le secret, rien à en tirer ; avec
// lui, rien d'un jour à l'autre (le jour est dedans).
export function empreinteJour(uid, jour, secret) {
  return createHmac('sha256', String(secret || 'vrm-mesures')).update(`${uid}|${jour}`).digest('hex').slice(0, 12);
}

// Le corps d'un `sendBeacon` arrive en texte (text/plain) : objet, chaîne ou rien.
export function lireCorpsMesures(brut) {
  if (brut && typeof brut === 'object' && !Buffer.isBuffer(brut)) return brut;
  const t = Buffer.isBuffer(brut) ? brut.toString('utf8') : typeof brut === 'string' ? brut : '';
  if (!t || t.length > 64000) return null;
  try { const o = JSON.parse(t); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch (_) { return null; }
}

async function lireJour(env, fetcher, proprio, jour) {
  const { url, service } = cfg(env);
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${proprio}&id=eq.${idJour(jour)}&select=data&limit=1`, { headers: sbCle(service) });
    if (!r.ok) return undefined;
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j)) return undefined;
    return j[0] && j[0].data && typeof j[0].data === 'object' ? j[0].data : null;   // null = pas encore de ligne
  } catch (_) { return undefined; }
}

// L'agrégat d'un jour après un lot. `null` si l'anti-abus refuse (raison dite).
export function jourApres(avant, lot, empreinte, minute) {
  const d = avant && typeof avant === 'object' ? avant : {};
  const contrib = d.contrib && typeof d.contrib === 'object' ? { ...d.contrib } : {};
  const c = contrib[empreinte] && typeof contrib[empreinte] === 'object' ? contrib[empreinte] : { n: 0, m: -1 };
  if (c.m === minute) return { refus: 'minute' };
  if ((Number(c.n) || 0) >= LOTS_MAX_JOUR) return { refus: 'jour' };
  contrib[empreinte] = { n: (Number(c.n) || 0) + 1, m: minute };
  return { data: { v: 1, jour: d.jour, rev: (Number.isSafeInteger(d.rev) ? d.rev : 0) + 1, lots: (Number(d.lots) || 0) + 1, mesures: (Number(d.mesures) || 0) + totalLot(lot), h: fusionnerHisto(d.h, lot), contrib } };
}

// POST : ranger un lot. `verifierJeton(jeton)` → { id } · null (refusé) · undefined (pas su).
export async function recevoirMesures({ corps, jetonEntete = '', verifierJeton, env = process.env, fetcher = fetch, maintenant = Date.now() }) {
  if (!cfg(env).service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  const c = lireCorpsMesures(corps);
  if (!c) return { code: 400, corps: { ok: false, raison: 'corps' } };
  const jeton = String(jetonEntete || c.jeton || '');
  if (!jeton || jeton.split('.').length !== 3 || jeton.length > 4096) return { code: 401, corps: { ok: false, raison: 'session' } };
  const lot = normaliserLot(c);
  if (!lot) return { code: 400, corps: { ok: false, raison: 'lot' } };
  const u = await verifierJeton(jeton);
  if (u === undefined) return { code: 503, corps: { ok: false, raison: 'connexion-injoignable' } };
  if (!u || !u.id) return { code: 401, corps: { ok: false, raison: 'session' } };
  const proprio = await proprietaireInstallation({ env, fetcher });
  if (!proprio) return { code: 503, corps: { ok: false, raison: 'destinataire-inconnu' } };
  const jour = jourParis(maintenant);
  const emp = empreinteJour(u.id, jour, cfg(env).service);
  const minute = Math.floor(maintenant / 60000);
  const { url, service } = cfg(env);
  for (let essai = 0; essai < ESSAIS; essai++) {
    const avant = await lireJour(env, fetcher, proprio, jour);
    if (avant === undefined) return { code: 503, corps: { ok: false, raison: 'base' } };   // lecture ratée : rien n'est écrit
    const r = jourApres(avant ? { ...avant, jour } : { jour }, lot, emp, minute);
    if (r.refus) return { code: 429, corps: { ok: false, raison: r.refus === 'minute' ? 'une-fois-par-minute' : 'plafond-du-jour' } };
    const at = new Date(maintenant).toISOString();
    let rep;
    try {
      rep = avant === null
        ? await fetcher(`${url}/rest/v1/app_data?on_conflict=owner,id`, {
          method: 'POST', headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify([{ owner: proprio, id: idJour(jour), data: r.data, updated_at: at }]) })
        : await fetcher(`${url}/rest/v1/app_data?owner=eq.${proprio}&id=eq.${idJour(jour)}&data->>rev=${Number.isSafeInteger(avant.rev) ? 'eq.' + avant.rev : 'is.null'}`, {
          method: 'PATCH', headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ data: r.data, updated_at: at }) });
    } catch (_) { return { code: 503, corps: { ok: false, raison: 'base' } }; }
    if (!rep.ok) return { code: 503, corps: { ok: false, raison: 'base' } };
    const j = await rep.json().catch(() => null);
    if (Array.isArray(j) && j.length === 1) return { code: 200, corps: { ok: true, jour, mesures: totalLot(lot) } };
    // 0 ligne : devancé (un autre lot vient d'écrire) — relire et rejouer.
  }
  return { code: 503, corps: { ok: false, raison: 'concurrence' } };
}

// Les jours lus ⇒ ce que le panneau montre (aucune empreinte, aucun histogramme).
export function joursPourPanneau(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => {
    const jour = String((r && r.id) || '').slice(PREFIXE_MESURES.length);
    const d = (r && r.data) || {};
    return { jour, lots: Number(d.lots) || 0, mesures: Number(d.mesures) || 0, appareils: d.contrib && typeof d.contrib === 'object' ? Object.keys(d.contrib).length : 0, lignes: resumeJour(d.h) };
  }).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.jour)).sort((a, b) => b.jour.localeCompare(a.jour));
}

// Lit les derniers jours (au plus `n`), lignes bornées (des comptes) : `null` = pas su.
export async function lireDerniersJours({ env = process.env, fetcher = fetch, proprio, n = JOURS_LUS }) {
  const { url, service } = cfg(env);
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${proprio}&id=like.${PREFIXE_MESURES}*&select=id,data&order=id.desc&limit=${Math.max(1, Math.min(60, n))}`, { headers: sbCle(service) });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}

// GET (PROPRIÉTAIRE seulement) : les agrégats des derniers jours.
export async function listerMesures({ utilisateur, env = process.env, fetcher = fetch }) {
  if (!cfg(env).service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  const proprio = await proprietaireInstallation({ env, fetcher });
  if (!proprio) return { code: 503, corps: { ok: false, raison: 'destinataire-inconnu' } };
  if (String(utilisateur.id).toLowerCase() !== proprio) return { code: 403, corps: { ok: false, raison: 'proprietaire' } };
  const rows = await lireDerniersJours({ env, fetcher, proprio });
  if (!rows) return { code: 503, corps: { ok: false, raison: 'base' } };
  return { code: 200, corps: { ok: true, jours: joursPourPanneau(rows) } };
}

// ═══════════════════════════════════════════════════════════════════════════
// LA PURGE À 90 JOURS (7 nov., décision du 6 nov.) — cron du matin
// ═══════════════════════════════════════════════════════════════════════════
// Les agrégats `mesures_jour_AAAA-MM-JJ` du PROPRIÉTAIRE de plus de 90 jours
// s'effacent. Trois règles :
//   · la lecture est PROJETÉE (`select=id`, jamais `select=data`) et paginée
//     par `Range` (Supabase plafonne à 1 000 lignes sans le dire) ;
//   · une lecture ratée (réseau, statut, page illisible, au début ou au milieu)
//     ne supprime RIEN — on ne supprime que ce qu'on a lu en entier ;
//   · la date se lit dans l'IDENTIFIANT (jamais `updated_at`, qui ment) : un id
//     dont le jour n'est pas une vraie date est GARDÉ. Le jour du seuil est gardé
//     (« plus de 90 jours » = strictement avant).
export const JOURS_GARDES = 90;
const RE_ID_JOUR = /^mesures_jour_(\d{4}-\d{2}-\d{2})$/;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Le jour d'une ligne, lu dans son id ; `null` si ce n'est pas une vraie date.
export function jourDeId(id) {
  const m = RE_ID_JOUR.exec(String(id || ''));
  if (!m) return null;
  const t = Date.parse(m[1] + 'T12:00:00Z');
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== m[1]) return null;
  return m[1];
}

// Le premier jour GARDÉ (jour de Paris, il y a 90 jours).
export const seuilPurgeMesures = (maintenant = Date.now()) => jourParis(maintenant - JOURS_GARDES * 86400000);

// Les ids à supprimer parmi les ids lus (pur : l'audit le juge seul aussi).
export function idsMesuresAPurger(ids, maintenant = Date.now()) {
  const seuil = seuilPurgeMesures(maintenant);
  const out = [];
  for (const id of Array.isArray(ids) ? ids : []) { const j = jourDeId(id); if (j && j < seuil) out.push(idJour(j)); }
  return [...new Set(out)];
}

// `{ url, headers }` : la base et les en-têtes de la clé de service (ceux du cron).
// Rend { fait, lues, retirees, seuil } ou { fait:false, raison, statut|erreur } :
// une purge ratée ne fait échouer rien d'autre (le cron la dit dans sa réponse).
export async function purgerMesuresAnciennes({ url, headers, proprietaire, fetcher = fetch, maintenant = Date.now() }) {
  const seuil = seuilPurgeMesures(maintenant);
  const p = String(proprietaire || '').trim().toLowerCase();
  if (!RE_UUID.test(p)) return { fait: false, raison: 'proprietaire', seuil };
  // 1. Lire TOUS les ids (projection seule). Une page ratée ⇒ rien n'est supprimé.
  const ids = []; const page = 1000;
  try {
    for (let from = 0; from < 200000; from += page) {
      const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${p}&id=like.${PREFIXE_MESURES}*&select=id&order=id.asc`, { headers: { ...headers, 'Range-Unit': 'items', Range: `${from}-${from + page - 1}` } });
      if (!r || !r.ok) return { fait: false, raison: 'lecture', statut: r ? r.status : null, seuil };
      let j = null; try { j = await r.json(); } catch (_) { j = null; }
      if (!Array.isArray(j)) return { fait: false, raison: 'lecture', seuil };
      for (const x of j) if (x && typeof x.id === 'string') ids.push(x.id);
      if (j.length < page) break;
    }
  } catch (e) { return { fait: false, raison: 'lecture', erreur: String((e && e.message) || e).slice(0, 200), seuil }; }
  // 2. Supprimer par date (le jour lu dans l'id), par lots bornés, chez le propriétaire seul.
  const aPurger = idsMesuresAPurger(ids, maintenant);
  let retirees = 0;
  for (let i = 0; i < aPurger.length; i += 100) {
    const lot = aPurger.slice(i, i + 100);
    try {
      const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${p}&id=in.(${lot.join(',')})`, { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } });
      if (!r || !r.ok) return { fait: false, raison: 'suppression', statut: r ? r.status : null, lues: ids.length, retirees, seuil };
    } catch (e) { return { fait: false, raison: 'suppression', erreur: String((e && e.message) || e).slice(0, 200), lues: ids.length, retirees, seuil }; }
    retirees += lot.length;
  }
  return { fait: true, lues: ids.length, retirees, seuil };
}
