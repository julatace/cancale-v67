// api/_lib/veille.js — LA VEILLE D'ACHAT, CÔTÉ SERVEUR (15 octobre).
//
// Ce fichier ne JUGE rien : il lit eBay, range et relit. Tout jugement (une
// annonce correspond-elle ? qu'est-ce qui n'est pas vérifiable ? quoi signaler ?)
// vit dans `veille-regle.js`, exécuté tel quel par l'audit (§11).
//
// ⚠️ CE QUI EST PERMIS, ET RIEN D'AUTRE :
//   · eBay seulement, par l'API Browse (`/buy/browse/v1/item_summary/search`),
//     avec le jeton de l'APPLICATION VRM (client_credentials) — jamais le
//     compte eBay d'un vendeur, jamais une route d'achat, d'offre ou d'enchère ;
//   · Vinted et Leboncoin : AUCUNE requête (CLAUDE.md §3 — pas d'accès autorisé,
//     et une recherche automatisée chez eux est le signal de robot qui a fait
//     bloquer un compte) ;
//   · une vérification part sur SON clic (« Vérifier », « Tester »), ou une fois
//     le matin, par le passage quotidien déjà en place (`ship-reminders`), pour
//     les seules recherches où il a allumé l'alerte — aucun nouveau cron ;
//   · ses recherches et leurs résultats vivent dans DEUX lignes à lui
//     (`veille_recherches`, `veille_resultats`), lues et écrites AU NOM du
//     vendeur de la session (`owner=eq.`, compare-et-échange `modifierDonnee`) ;
//   · « pas su » n'est jamais « rien » : une lecture ratée de ses lignes ⇒ 503,
//     on n'écrit rien (repartir de vide effacerait ses recherches).
//
// ⚠️ NON MESURÉ (aucun appel à eBay n'a été fait d'ici) : la forme exacte de la
//    réponse Browse sur eBay.fr et le quota réel de l'application. Une réponse
//    sans `itemSummaries` ni `total` est dite « inattendue », jamais « 0
//    annonce » ; un refus d'eBay (401/403/429) remonte avec sa cause.

import crypto from 'crypto';
import { keysReady, appId, certId, lireDonnee, modifierDonnee } from './ebay.js';
import {
  normaliserRecherche, requetesEbay, jugerLectures, fusionnerVerification, noterEchec, rejuger,
  marquerAlertes, appliquerDecision, reserverQuota, bilanRecherche, dansSilence, resultatsVides,
  centimesDe, PLATEFORMES_VEILLE, VEILLE_MAX_RECHERCHES, VEILLE_QUOTA_JOUR, VEILLE_DELAI_MS,
  VEILLE_MATIN_MAX_APPELS, LIBELLES_EXCLUSION,
} from './veille-regle.js';

const ID_CONF = 'veille_recherches';
const ID_RES = 'veille_resultats';
const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const BROWSE = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const DELAI_APPEL_MS = 8000;

// ── LE JETON DE L'APPLICATION ────────────────────────────────────────────────
// Le même pour tous les vendeurs (il n'ouvre AUCUN compte) : gardé en mémoire
// de l'instance jusqu'à 2 min avant son expiration. Rien n'est écrit en base.
let _jeton = null;
export const oublierJetonVeille = () => { _jeton = null; };
async function jetonApplication(maintenant) {
  if (_jeton && _jeton.expire - 120000 > maintenant) return { ok: true, jeton: _jeton.valeur };
  try {
    const r = await fetch(EBAY_TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(`${appId()}:${certId()}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&scope=${encodeURIComponent('https://api.ebay.com/oauth/api_scope')}`,
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.access_token) return { ok: false, raison: r.status === 400 || r.status === 401 ? 'cles' : 'ebay', erreur: r.status === 400 || r.status === 401 ? 'eBay refuse les clés de l\'application VRM.' : 'eBay n\'a pas répondu.' };
    _jeton = { valeur: String(j.access_token), expire: maintenant + (Number(j.expires_in) > 0 ? Number(j.expires_in) : 7200) * 1000 };
    return { ok: true, jeton: _jeton.valeur };
  } catch (_) { return { ok: false, raison: 'reseau', erreur: 'eBay injoignable.' }; }
}

// ── UNE RECHERCHE CHEZ eBAY (lecture publique) ───────────────────────────────
async function lireEbay(req, jeton) {
  const url = `${BROWSE}?q=${encodeURIComponent(req.q)}&filter=${encodeURIComponent(req.filter)}&sort=${encodeURIComponent(req.sort)}&limit=${req.limit}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), DELAI_APPEL_MS);
  try {
    const r = await fetch(url, {
      headers: {
        Authorization: 'Bearer ' + jeton,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_FR',
        // Les frais de port affichés : vers la France.
        'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country%3DFR',
        'Accept-Language': 'fr-FR',
      },
      signal: ac.signal,
    });
    if (r.status === 401) { _jeton = null; return { ok: false, raison: 'acces', erreur: 'eBay a refusé le jeton de l\'application — réessaie dans un instant.' }; }
    if (r.status === 403) return { ok: false, raison: 'acces', erreur: 'eBay refuse la recherche à l\'application VRM (accès à la recherche non accordé).' };
    if (r.status === 429) return { ok: false, raison: 'quota', erreur: 'eBay limite le nombre de recherches pour aujourd\'hui — réessaie plus tard.' };
    if (!r.ok) return { ok: false, raison: 'ebay', erreur: `eBay n'a pas répondu (${r.status}).` };
    const j = await r.json().catch(() => null);
    const items = j && Array.isArray(j.itemSummaries) ? j.itemSummaries : null;
    const total = j && Number.isFinite(j.total) ? j.total : null;
    if (!items && total == null) return { ok: false, raison: 'forme', erreur: 'Réponse d\'eBay inattendue — rien n\'en a été déduit.' };
    return { ok: true, items: items || [], total: total != null ? total : (items || []).length };
  } catch (e) {
    return { ok: false, raison: e && e.name === 'AbortError' ? 'delai' : 'reseau', erreur: e && e.name === 'AbortError' ? 'eBay a mis trop de temps à répondre.' : 'eBay injoignable.' };
  } finally { clearTimeout(t); }
}
// Les requêtes d'une recherche, l'une après l'autre (jamais en rafale).
async function lireRecherche(r, jeton, max) {
  const lectures = [];
  for (const req of requetesEbay(r).slice(0, max == null ? undefined : max)) lectures.push(await lireEbay(req, jeton));
  return lectures;
}

// ── CE QUE L'APP REÇOIT ──────────────────────────────────────────────────────
const plateformes = () => PLATEFORMES_VEILLE.map((p) => (p.id === 'ebay' ? { ...p, disponible: keysReady(), pourquoi: keysReady() ? '' : 'clés eBay de l\'application absentes' } : p));
const vueAnnonces = (rr) => Object.entries((rr && rr.annonces) || {}).map(([id, a]) => ({ ...a, id }));
function vueRecherche(res, rid) {
  const rr = res && res.parRecherche && res.parRecherche[rid];
  return { verif: (rr && rr.verif) || null, annonces: vueAnnonces(rr), bilan: bilanRecherche(rr), refusees: Object.keys((rr && rr.refusees) || {}).length };
}
function vueQuota(res, maintenant) {
  const jour = new Date(maintenant).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
  const q = res && res.quota && res.quota.jour === jour ? res.quota.n : 0;
  return { utilise: q, max: VEILLE_QUOTA_JOUR };
}
const R = (status, body) => ({ status, body });
const PAS_SU = R(503, { ok: false, reason: 'base', error: 'Je n\'ai pas pu lire ta veille — rien n\'est perdu, réessaie dans un instant.' });
const NON_RANGE = R(503, { ok: false, reason: 'base', error: 'Je n\'ai pas pu enregistrer — rien n\'a changé, réessaie.' });

async function lireConf(owner) {
  const d = await lireDonnee(ID_CONF, owner);
  if (d === undefined) return undefined;
  return { recherches: Array.isArray(d && d.recherches) ? d.recherches : [], reglages: (d && d.reglages) || {} };
}

// Réserve une vérification (quota du jour, délai de la même recherche) AVANT
// d'appeler eBay. `null` ⇒ base illisible : on n'appelle pas eBay.
async function reserver(owner, rid, maintenant) {
  let refus = null, quota = null;
  const w = await modifierDonnee(ID_RES, owner, (d) => {
    refus = null;
    const v = rid && d && d.parRecherche && d.parRecherche[rid] && d.parRecherche[rid].verif;
    if (v && v.source !== 'matin' && maintenant - v.at < VEILLE_DELAI_MS && maintenant >= v.at) { refus = 'delai'; return undefined; }
    const q = reserverQuota(d, maintenant);
    quota = q.quota;
    if (!q.ok) { refus = 'quota'; return undefined; }
    return q.data;
  });
  if (w === null) return { ok: false, rep: PAS_SU };
  if (refus === 'delai') return { ok: false, rep: R(429, { ok: false, reason: 'delai', error: 'Cette recherche vient d\'être vérifiée — attends deux minutes.' }) };
  if (refus === 'quota') return { ok: false, rep: R(429, { ok: false, reason: 'quota', error: `${VEILLE_QUOTA_JOUR} vérifications aujourd'hui : c'est le maximum. Reprise demain.`, quota: { utilise: quota.n, max: VEILLE_QUOTA_JOUR } }) };
  if (w !== true) return { ok: false, rep: NON_RANGE };
  return { ok: true, quota: { utilise: quota.n, max: VEILLE_QUOTA_JOUR } };
}

// ══ LES ACTIONS DE L'APP (session vérifiée par api/ebay.js) ═══════════════════
export async function actionVeille(action, b, owner, opts = {}) {
  const maintenant = opts.maintenant || Date.now();
  const body = b || {};
  switch (action) {
    case 'veillelire': {
      const conf = await lireConf(owner);
      const res = await lireDonnee(ID_RES, owner);
      if (conf === undefined || res === undefined) return PAS_SU;
      const resultats = {};
      for (const r of conf.recherches) resultats[r.id] = vueRecherche(res, r.id);
      return R(200, {
        ok: true, recherches: conf.recherches, reglages: conf.reglages, resultats,
        historique: ((res && res.historique) || []).slice(0, 60), matin: (res && res.matin) || null,
        quota: vueQuota(res, maintenant), plateformes: plateformes(), libellesExclusion: LIBELLES_EXCLUSION,
      });
    }
    case 'veillesauver': {
      const n = normaliserRecherche(body.recherche, { maintenant, nouvelId: 'r' + crypto.randomBytes(5).toString('hex') });
      if (!n.ok) return R(400, { ok: false, reason: 'champ', champ: n.champ, error: n.erreur });
      const demandeId = body.recherche && body.recherche.id;
      let range = null, erreur = null;
      const w = await modifierDonnee(ID_CONF, owner, (d) => {
        range = null; erreur = null;
        const liste = Array.isArray(d && d.recherches) ? d.recherches : [];
        const i = liste.findIndex((x) => x && x.id === n.recherche.id);
        if (demandeId && i < 0) { erreur = R(404, { ok: false, reason: 'introuvable', error: 'Cette recherche n\'existe plus.' }); return undefined; }
        if (i < 0 && liste.length >= VEILLE_MAX_RECHERCHES) { erreur = R(409, { ok: false, reason: 'max', error: `${VEILLE_MAX_RECHERCHES} recherches au plus — supprimes-en une d'abord.` }); return undefined; }
        range = i >= 0 ? { ...n.recherche, creeLe: liste[i].creeLe } : n.recherche;
        return { ...(d || {}), v: 1, recherches: i >= 0 ? liste.map((x, k) => (k === i ? range : x)) : [...liste, range] };
      });
      if (erreur) return erreur;
      if (w === null) return PAS_SU;
      if (w !== true || !range) return NON_RANGE;
      // Les annonces encore « nouvelles » sont rejugées avec les critères d'aujourd'hui.
      const r2 = await modifierDonnee(ID_RES, owner, (d) => (d && d.parRecherche && d.parRecherche[range.id] ? rejuger(d, range.id, range) : undefined));
      return R(200, { ok: true, recherche: range, rejugee: r2 === true });
    }
    case 'veillesupprimer': {
      const id = String(body.id || '');
      let trouve = false;
      const w = await modifierDonnee(ID_CONF, owner, (d) => {
        const liste = Array.isArray(d && d.recherches) ? d.recherches : [];
        trouve = liste.some((x) => x && x.id === id);
        return trouve ? { ...d, recherches: liste.filter((x) => x && x.id !== id) } : undefined;
      });
      if (w === null) return PAS_SU;
      if (!trouve) return R(404, { ok: false, reason: 'introuvable', error: 'Cette recherche n\'existe plus.' });
      if (w !== true) return NON_RANGE;
      const w2 = await modifierDonnee(ID_RES, owner, (d) => {
        if (!(d && d.parRecherche && d.parRecherche[id])) return undefined;
        const pr = { ...d.parRecherche }; delete pr[id];
        return { ...d, parRecherche: pr };
      });
      return R(200, { ok: true, resultatsRetires: w2 === true });
    }
    case 'veillereglages': {
      const budget = body.budgetEuros == null || String(body.budgetEuros).trim() === '' ? null : centimesDe(body.budgetEuros);
      if (body.budgetEuros != null && String(body.budgetEuros).trim() !== '' && (budget == null || budget > 10000000)) return R(400, { ok: false, reason: 'champ', champ: 'budget', error: 'Budget illisible (ex. 400 ou 400,50).' });
      let silence = null;
      if (body.silence && typeof body.silence === 'object') {
        const de = Number(body.silence.de), a = Number(body.silence.a);
        if (!Number.isInteger(de) || !Number.isInteger(a) || de < 0 || de > 23 || a < 0 || a > 23 || de === a) return R(400, { ok: false, reason: 'champ', champ: 'silence', error: 'Horaires silencieux illisibles.' });
        silence = { de, a };
      }
      const w = await modifierDonnee(ID_CONF, owner, (d) => ({ ...(d || { v: 1, recherches: [] }), reglages: { ...((d && d.reglages) || {}), budget, silence } }));
      if (w === null) return PAS_SU;
      if (w !== true) return NON_RANGE;
      return R(200, { ok: true, reglages: { budget, silence } });
    }
    case 'veilletester':
    case 'veilleverifier': {
      if (!keysReady()) return R(503, { ok: false, reason: 'no-key', error: 'La recherche eBay n\'est pas configurée sur le serveur (clés de l\'application absentes).' });
      const simulation = action === 'veilletester';
      let r;
      if (simulation) {
        const n = normaliserRecherche(body.recherche, { maintenant, nouvelId: 'rsimulation' });
        if (!n.ok) return R(400, { ok: false, reason: 'champ', champ: n.champ, error: n.erreur });
        r = n.recherche;
      } else {
        const conf = await lireConf(owner);
        if (conf === undefined) return PAS_SU;
        r = conf.recherches.find((x) => x && x.id === String(body.id || ''));
        if (!r) return R(404, { ok: false, reason: 'introuvable', error: 'Cette recherche n\'existe plus.' });
      }
      const resa = await reserver(owner, simulation ? null : r.id, maintenant);
      if (!resa.ok) return resa.rep;
      const jt = await jetonApplication(maintenant);
      const lectures = jt.ok ? await lireRecherche(r, jt.jeton) : [{ ok: false, raison: jt.raison, erreur: jt.erreur }];
      const jug = jugerLectures(lectures, r);
      const erreur = (lectures.find((l) => !l.ok) || {}).erreur || '';
      if (simulation) {
        // ⚠️ SIMULATION : rien n'est rangé (ni résultats, ni historique, ni alerte).
        if (!jug.ok) return R(502, { ok: false, reason: (lectures[0] || {}).raison || 'ebay', error: erreur || 'eBay n\'a pas répondu.', quota: resa.quota });
        return R(200, {
          ok: true, simulation: true, quota: resa.quota,
          verif: { at: maintenant, ok: true, partiel: jug.partiel, lus: jug.lus, totalEbay: jug.totalEbay, complet: jug.complet, retenues: jug.retenues.length, ecartees: jug.ecartees, erreur: jug.partiel ? erreur : '' },
          annonces: jug.retenues.map(({ analyse, ...a }) => ({ ...a, raisons: analyse.raisons, inverifiables: analyse.inverifiables, drapeaux: analyse.drapeaux, total: analyse.total, totalConfirme: analyse.totalConfirme, statut: 'nouvelle', vuLe: maintenant, revuLe: maintenant })),
          exemples: jug.exemples,
        });
      }
      if (!jug.ok) {
        await modifierDonnee(ID_RES, owner, (d) => noterEchec(d, r.id, erreur, maintenant, 'clic'));
        return R(502, { ok: false, reason: (lectures[0] || {}).raison || 'ebay', error: erreur || 'eBay n\'a pas répondu.', quota: resa.quota });
      }
      let fusion = null;
      const w = await modifierDonnee(ID_RES, owner, (d) => { fusion = fusionnerVerification(d, r.id, jug, maintenant, 'clic', r); return fusion.data; });
      return R(200, {
        ok: true, quota: resa.quota, range: w === true,
        resultat: fusion ? vueRecherche(fusion.data, r.id) : null,
        nouvelles: fusion ? fusion.nouvelles.length : 0,
        exemples: jug.exemples, erreurPartielle: jug.partiel ? erreur : '',
      });
    }
    case 'veilledecision': {
      const rid = String(body.id || ''), itemId = String(body.itemId || '');
      const dec = { statut: body.statut == null ? null : String(body.statut), motif: body.motif, note: body.note };
      let out = null;
      const w = await modifierDonnee(ID_RES, owner, (d) => {
        out = appliquerDecision(d, rid, itemId, dec, maintenant);
        return out.ok ? out.data : undefined;
      });
      if (w === null) return PAS_SU;
      if (!out || !out.ok) return R(404, { ok: false, reason: 'introuvable', error: (out && out.erreur) || 'Annonce introuvable.' });
      if (w !== true) return NON_RANGE;
      // « Arrêter quand je l'ai achetée » (VEILLE-50-26) : la recherche se met en pause.
      let pause = false;
      if (dec.statut === 'achetee') {
        const w2 = await modifierDonnee(ID_CONF, owner, (d) => {
          const liste = Array.isArray(d && d.recherches) ? d.recherches : [];
          const i = liste.findIndex((x) => x && x.id === rid && x.arreterQuandAchetee && !x.pause);
          if (i < 0) return undefined;
          pause = true;
          return { ...d, recherches: liste.map((x, k) => (k === i ? { ...x, pause: true, majLe: maintenant } : x)) };
        });
        if (w2 !== true) pause = false;
      }
      return R(200, { ok: true, annonce: { ...out.annonce, id: itemId }, bilan: bilanRecherche(out.data.parRecherche[rid]), recherchePausee: pause });
    }
    default:
      return R(400, { ok: false, error: 'action inconnue' });
  }
}

// ══ LE PASSAGE DU MATIN (appelé par api/ship-reminders.js, une fois par jour) ══
// Pour les recherches où l'alerte est ALLUMÉE et qui ne sont pas en pause.
// Une notification par vendeur et par jour au plus, jamais deux fois pour la
// même annonce (marquée AVANT l'envoi, dans la même écriture que les résultats).
// Les fonctions d'envoi sont PASSÉES (le serveur des notifications n'est pas
// chargé par la route eBay) : `envoyer`, `categorieActive`, `acces`.
export async function veilleDuMatin({ owner, maintenant = Date.now(), envoyer, categorieActive, acces } = {}) {
  if (!keysReady()) return null;
  const conf = await lireConf(owner);
  if (conf === undefined) return 'recherches illisibles';
  const actives = conf.recherches.filter((r) => r && r.alerte === true && r.pause !== true);
  if (!actives.length) return null;
  if (acces && owner && (await acces(owner)) === false) return 'abonnement coupé';
  const jour = new Date(maintenant).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
  // Le mémo du passage AVANT les appels : un passage relancé ne refait rien.
  let deja = false;
  const memo = await modifierDonnee(ID_RES, owner, (d) => {
    deja = !!(d && d.matin && d.matin.jour === jour);
    return deja ? undefined : { ...(d || resultatsVides()), matin: { jour, at: maintenant, etat: 'en-cours' } };
  });
  if (memo === null) return 'résultats illisibles';
  if (deja) return 'déjà passé';
  if (memo !== true) return 'mémo non écrit';
  const jt = await jetonApplication(maintenant);
  const finir = (etat, extra) => modifierDonnee(ID_RES, owner, (d) => ({ ...(d || resultatsVides()), matin: { jour, at: maintenant, etat, ...(extra || {}) } }));
  if (!jt.ok) { await finir('ebay', { erreur: jt.erreur }); return 'eBay : ' + jt.erreur; }
  let appels = 0;
  const vues = new Set(), parRecherche = [];
  for (const r of actives) {
    const reste = VEILLE_MATIN_MAX_APPELS - appels;
    if (reste <= 0) break;
    const lectures = await lireRecherche(r, jt.jeton, reste);
    appels += lectures.length;
    const jug = jugerLectures(lectures, r);
    if (!jug.ok) { await modifierDonnee(ID_RES, owner, (d) => noterEchec(d, r.id, (lectures.find((l) => !l.ok) || {}).erreur, maintenant, 'matin')); continue; }
    let alertees = [];
    const w = await modifierDonnee(ID_RES, owner, (d) => {
      const f = fusionnerVerification(d, r.id, jug, maintenant, 'matin', r);
      const m = marquerAlertes(f.data, r.id, maintenant);
      alertees = m.alertees;
      return m.data;
    });
    // Non rangé ⇒ pas d'alerte (sinon elle repartirait demain : deux alertes).
    if (w !== true) continue;
    const neuves = alertees.filter((k) => !vues.has(k));
    neuves.forEach((k) => vues.add(k));
    if (neuves.length) parRecherche.push({ nom: r.nom, n: neuves.length });
  }
  const total = vues.size;
  if (!total) { await finir('rien', { appels }); return { appels, nouvelles: 0 }; }
  if (categorieActive && !(await categorieActive('veille'))) { await finir('coupe', { appels, nouvelles: total }); return { appels, nouvelles: total, envoi: 'désactivé par le vendeur' }; }
  if (dansSilence(conf.reglages.silence, maintenant)) { await finir('silence', { appels, nouvelles: total }); return { appels, nouvelles: total, envoi: 'horaire silencieux' }; }
  const corps = `${total} nouvelle${total > 1 ? 's' : ''} annonce${total > 1 ? 's' : ''} : ${parRecherche.map((x) => `${x.nom} (${x.n})`).join(', ')}. Rien n'est acheté sans toi.`;
  const envoi = envoyer ? await envoyer({ title: '🔎 Veille d\'achat', body: corps.slice(0, 220), tag: 'veille-' + jour, url: '/?tab=ebay_veille' }) : null;
  await finir('envoye', { appels, nouvelles: total });
  return { appels, nouvelles: total, envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) };
}
