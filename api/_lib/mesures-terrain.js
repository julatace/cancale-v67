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
// (8 nov.) Les alertes de plantage voyagent avec le lot (`p`) : src/alertesPlantages.js.
import { normaliserEvenements } from '../../src/alertesPlantages.js';
import { recevoirAlertesPlantages, listerPlantagesTerrain } from './alertes-plantages.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai

export const PREFIXE_MESURES = 'mesures_jour_';
export const JOURS_LUS = 14;
const ESSAIS = 4;

const cfg = (env) => ({ url: env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co', service: env.SUPABASE_SERVICE_KEY || '' });
export const idJour = (jour) => PREFIXE_MESURES + jour;

// ── LES ÉCLATS (7 nov., audit « 1 000 vendeurs ») ──────────────────────────
// Une seule ligne par jour, écrite par TOUS les appareils de TOUS les vendeurs,
// c'est un comparer-et-échanger qui se dispute : à 1 000 vendeurs, les lots se
// devancent sans fin (4 essais, puis 503). Le jour est donc ÉCLATÉ en
// `ECLATS` lignes `mesures_jour_{jour}_{éclat}` ; l'éclat d'un appareil est tiré
// de son EMPREINTE du jour (`empreinteJour`, % 16) : le même appareil retombe
// toujours dans le même éclat ce jour-là, donc l'anti-abus (une fois par minute,
// `LOTS_MAX_JOUR`) reste juste. Les LECTURES additionnent les éclats d'un jour
// ET l'ancienne ligne `mesures_jour_{jour}` (celles d'avant le 7 nov. restent
// lisibles, jamais réécrites) ; la purge à 90 jours couvre les deux formes.
export const ECLATS = 16;
export const eclatDe = (empreinte) => (parseInt(String(empreinte || '').slice(0, 2), 16) || 0) % ECLATS;
export const idEclat = (jour, eclat) => `${PREFIXE_MESURES}${jour}_${Number(eclat).toString(16)}`;
// Toutes les lignes possibles d'un jour : l'ancienne forme puis ses éclats.
export const idsDuJour = (jour) => [idJour(jour), ...Array.from({ length: ECLATS }, (_, i) => idEclat(jour, i))];
const RE_ID_MESURES = /^mesures_jour_(\d{4}-\d{2}-\d{2})(?:_([0-9a-f]))?$/;

// Les lignes lues (`{ id, data }` ou `{ id, h }`) ⇒ UN agrégat par jour :
// lots et mesures additionnés, histogrammes additionnés case à case, empreintes
// réunies (un appareil compté une fois). Rend { jour: { lots, mesures, h, contrib } }.
export function agregerJours(rows) {
  const out = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    const m = RE_ID_MESURES.exec(String((r && r.id) || ''));
    if (!m) continue;
    const d = r.data && typeof r.data === 'object' ? r.data : { h: r.h };
    const a = out[m[1]] || (out[m[1]] = { lots: 0, mesures: 0, h: {}, contrib: {}, lignes: 0 });
    a.lots += Number(d.lots) || 0;
    a.mesures += Number(d.mesures) || 0;
    a.h = fusionnerHisto(a.h, { h: d.h && typeof d.h === 'object' ? d.h : {} });
    if (d.contrib && typeof d.contrib === 'object') for (const k of Object.keys(d.contrib)) a.contrib[k] = true;
    a.lignes++;
  }
  return out;
}

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

async function lireJour(env, fetcher, proprio, id) {
  const { url, service } = cfg(env);
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${proprio}&id=eq.${id}&select=data&limit=1`, { headers: sbCle(service) });
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
export async function recevoirMesures({ corps, jetonEntete = '', verifierJeton, env = process.env, fetcher = fetchAvecDelai, maintenant = Date.now(), pousser = null }) {
  if (!cfg(env).service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  const c = lireCorpsMesures(corps);
  if (!c) return { code: 400, corps: { ok: false, raison: 'corps' } };
  const jeton = String(jetonEntete || c.jeton || '');
  if (!jeton || jeton.split('.').length !== 3 || jeton.length > 4096) return { code: 401, corps: { ok: false, raison: 'session' } };
  const lot = normaliserLot(c);
  const evts = normaliserEvenements(c.p);
  if (!lot && !evts.length) return { code: 400, corps: { ok: false, raison: 'lot' } };
  const u = await verifierJeton(jeton);
  if (u === undefined) return { code: 503, corps: { ok: false, raison: 'connexion-injoignable' } };
  if (!u || !u.id) return { code: 401, corps: { ok: false, raison: 'session' } };
  const proprio = await proprietaireInstallation({ env, fetcher });
  if (!proprio) return { code: 503, corps: { ok: false, raison: 'destinataire-inconnu' } };
  const jour = jourParis(maintenant);
  const emp = empreinteJour(u.id, jour, cfg(env).service);
  const minute = Math.floor(maintenant / 60000);
  const { url, service } = cfg(env);
  // (8 nov.) Les alertes d'abord : leur ligne est à part, leur sort ne change
  // rien aux mesures (et l'inverse).
  const alertes = evts.length ? await recevoirAlertesPlantages({ evenements: evts, empreinte: emp, proprio, env, fetcher, pousser: pousser ? (n) => pousser(n, proprio) : null, maintenant }) : null;
  const avecAlertes = (o) => (alertes ? { ...o, alertes: { fait: alertes.fait, ...(alertes.fait ? { due: alertes.due } : { raison: alertes.raison }) } } : o);
  if (!lot) return alertes && alertes.fait ? { code: 200, corps: avecAlertes({ ok: true, jour, mesures: 0 }) } : { code: alertes && alertes.raison === 'plafond-du-jour' ? 429 : 503, corps: avecAlertes({ ok: false, raison: (alertes && alertes.raison) || 'base' }) };
  const id = idEclat(jour, eclatDe(emp));   // l'éclat de CET appareil ce jour-là
  for (let essai = 0; essai < ESSAIS; essai++) {
    const avant = await lireJour(env, fetcher, proprio, id);
    if (avant === undefined) return { code: 503, corps: { ok: false, raison: 'base' } };   // lecture ratée : rien n'est écrit
    const r = jourApres(avant ? { ...avant, jour } : { jour }, lot, emp, minute);
    if (r.refus) return { code: 429, corps: avecAlertes({ ok: false, raison: r.refus === 'minute' ? 'une-fois-par-minute' : 'plafond-du-jour' }) };
    const at = new Date(maintenant).toISOString();
    let rep;
    try {
      rep = avant === null
        ? await fetcher(`${url}/rest/v1/app_data?on_conflict=owner,id`, {
          method: 'POST', headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify([{ owner: proprio, id, data: r.data, updated_at: at }]) })
        : await fetcher(`${url}/rest/v1/app_data?owner=eq.${proprio}&id=eq.${id}&data->>rev=${Number.isSafeInteger(avant.rev) ? 'eq.' + avant.rev : 'is.null'}`, {
          method: 'PATCH', headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ data: r.data, updated_at: at }) });
    } catch (_) { return { code: 503, corps: { ok: false, raison: 'base' } }; }
    if (!rep.ok) return { code: 503, corps: { ok: false, raison: 'base' } };
    const j = await rep.json().catch(() => null);
    if (Array.isArray(j) && j.length === 1) return { code: 200, corps: avecAlertes({ ok: true, jour, mesures: totalLot(lot) }) };
    // 0 ligne : devancé (un autre lot vient d'écrire) — relire et rejouer.
  }
  return { code: 503, corps: { ok: false, raison: 'concurrence' } };
}

// Les lignes lues (anciennes et éclats) ⇒ ce que le panneau montre, UN jour
// par jour (éclats additionnés) : aucune empreinte, aucun histogramme brut.
export function joursPourPanneau(rows) {
  return Object.entries(agregerJours(rows)).map(([jour, a]) => ({ jour, lots: a.lots, mesures: a.mesures, appareils: Object.keys(a.contrib).length, lignes: resumeJour(a.h) }))
    .sort((a, b) => b.jour.localeCompare(a.jour));
}

// Lit les derniers jours (au plus `n`) : `null` = pas su. Deux temps, toujours
// projetés et bornés : (1) les IDENTIFIANTS seuls (`select=id`, paginés), pour
// trouver les `n` jours les plus récents ; (2) les lignes de ces jours-là
// seulement (`id=in.(…)`, ancienne forme et éclats).
export async function lireDerniersJours({ env = process.env, fetcher = fetchAvecDelai, proprio, n = JOURS_LUS }) {
  const { url, service } = cfg(env);
  const nb = Math.max(1, Math.min(60, n));
  try {
    const ids = []; const page = 1000;
    for (let from = 0; from < 200000; from += page) {
      const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${proprio}&id=like.${PREFIXE_MESURES}*&select=id&order=id.desc`, { headers: { ...sbCle(service), 'Range-Unit': 'items', Range: `${from}-${from + page - 1}` } });
      if (!r.ok) return null;
      const j = await r.json().catch(() => null);
      if (!Array.isArray(j)) return null;
      for (const x of j) if (x && typeof x.id === 'string') ids.push(x.id);
      if (j.length !== page) break;
    }
    const jours = [...new Set(ids.map(jourDeId).filter(Boolean))].sort().reverse().slice(0, nb);
    if (!jours.length) return [];
    const voulus = ids.filter((id) => jours.includes(jourDeId(id)));
    const out = [];
    for (let i = 0; i < voulus.length; i += 100) {
      const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${proprio}&id=in.(${voulus.slice(i, i + 100).join(',')})&select=id,data&order=id.asc`, { headers: sbCle(service) });
      if (!r.ok) return null;
      const j = await r.json().catch(() => null);
      if (!Array.isArray(j)) return null;
      out.push(...j);
    }
    return out;
  } catch (_) { return null; }
}

// Les histogrammes des `jours` demandés (éclats additionnés), pour la veille
// des lenteurs. `lire(chemin)` rend la liste paginée ou `null` (pas su).
// Rend { jour: h | null } ou `null` (pas su).
export async function histosDesJours({ lire, proprio, jours }) {
  const rows = await lire(`app_data?owner=eq.${proprio}&id=in.(${jours.flatMap(idsDuJour).join(',')})&select=id,h:data->h`);
  if (!Array.isArray(rows)) return null;
  const ag = agregerJours(rows);
  const out = {};
  for (const j of jours) out[j] = ag[j] && Object.keys(ag[j].h).length ? ag[j].h : null;
  return out;
}

// GET (PROPRIÉTAIRE seulement) : les agrégats des derniers jours.
export async function listerMesures({ utilisateur, quoi = '', env = process.env, fetcher = fetchAvecDelai }) {
  if (!cfg(env).service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  const proprio = await proprietaireInstallation({ env, fetcher });
  if (!proprio) return { code: 503, corps: { ok: false, raison: 'destinataire-inconnu' } };
  if (String(utilisateur.id).toLowerCase() !== proprio) return { code: 403, corps: { ok: false, raison: 'proprietaire' } };
  // (8 nov.) `quoi=plantages` : les alertes de plantage des 7 derniers jours.
  if (quoi === 'plantages') {
    const jours = await listerPlantagesTerrain({ proprio, env, fetcher });
    if (!jours) return { code: 503, corps: { ok: false, raison: 'base' } };
    return { code: 200, corps: { ok: true, jours } };
  }
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
const RE_ID_JOUR = RE_ID_MESURES;   // l'ancienne forme ET les éclats
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
  for (const id of Array.isArray(ids) ? ids : []) { const j = jourDeId(id); if (j && j < seuil) out.push(String(id)); }
  return [...new Set(out)];
}

// `{ url, headers }` : la base et les en-têtes de la clé de service (ceux du cron).
// Rend { fait, lues, retirees, seuil } ou { fait:false, raison, statut|erreur } :
// une purge ratée ne fait échouer rien d'autre (le cron la dit dans sa réponse).
export async function purgerMesuresAnciennes({ url, headers, proprietaire, fetcher = fetchAvecDelai, maintenant = Date.now() }) {
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
