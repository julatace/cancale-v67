// api/_lib/transporteurs-lecture.js
// ────────────────────────────────────────────────────────────────────────────
// (24 oct.) LE RÉSEAU : VRM lit le statut PUBLIC d'un colis chez son
// transporteur, par son n° de suivi (jamais le code de retrait), et range ce
// qu'il a lu dans `transp_{transporteur}_{n°}` (le contrat C1, écrit par le
// serveur SEUL, par comparer-et-échanger sur `data.rev`). La RÈGLE — quels n°,
// à quel rythme, ce que dit une réponse, ce qui sonne — vit dans
// api/_lib/transporteurs.js (pure, §11).
//
// Les garde-fous :
//   · un User-Agent HONNÊTE (« VRM-suivi/1.0 (+https://vrm.center) ») : on ne se
//     fait jamais passer pour un navigateur, on ne résout jamais un défi ;
//   · une requête à la fois PAR transporteur (dans cette instance), 1,5 s
//     d'écart FIXE (jamais aléatoire), 6 s de délai, corps lu sur 64 Ko au plus,
//     aucune redirection suivie ;
//   · une PAUSE par transporteur (`transp_pause`, C2) sur 403, 429, défi, HTML :
//     30 min, 1 h, 2 h, 6 h, 24 h, ou `Retry-After` s'il est plus long ; elle
//     tombe à la première lecture réussie ;
//   · « pas su » partout : une lecture de NOTRE base qui échoue ⇒ aucune lecture
//     chez un transporteur ; une lecture chez un transporteur qui échoue ⇒ rien
//     ne change (seulement l'essai, pour le rythme) ;
//   · jamais un n° SORTANT (un colis qu'il a posté : bordereau ou sens), jamais
//     un sens « pas su » (api/_lib/transporteurs.js, `suivisAInterroger`).
//
// ⚠️⚠️ MONDIAL RELAY — MESURÉ LE 24 OCTOBRE 2026, depuis dub1 (sandbox Vercel),
//    avec le User-Agent honnête :
//    · `www.mondialrelay.be/fr-be/suivi-de-colis/` répond 200, mais
//      `www.mondialrelay.be/api/tracking` répond 403 en HTML (Cloudflare) — le
//      serveur ne la lit PAS (11:19 UTC) ;
//    · `www.mondialrelay.fr/_mvc/fr-FR/SuiviExpedition/RechercherJsonResponsive`
//      (GET `?NumeroExpedition=&CodePostal=`, `Accept: application/json`,
//      `X-Requested-With: XMLHttpRequest`, sans cookie ni jeton) répond 200 en
//      JSON, deux fois (11:53 et 12:28 UTC) : `Success:true` et un fragment HTML
//      pour un colis trouvé, `Success:false` (« erreur de saisie ») pour un
//      mauvais code postal. C'est la voie du SERVEUR (`mr-fr-mvc`), jugée par
//      `lireReponseMondialRelayMvc`, avec l'ÉCHO du n° (et du code postal).
//    Le serveur ne contourne jamais : un refus (403, 401, 429, défi, HTML) pose
//    la PAUSE de Mondial Relay, et c'est SEULEMENT alors (et pendant la pause)
//    que le n° part dans `besoinNavigateur` (C3) : l'extension le lit depuis le
//    navigateur de Julien (voie `mr-be`) et relaie la réponse BRUTE (C4).
// MESURÉ LE MÊME JOUR, MÊME UA : Chronopost `ws.chronopost.fr …/trackSkybillV2`
//    200 text/xml ; Vinted Go `carrier.vintedgo.com/public/v3/tracking_events`
//    200 application/json (3 lectures à 2 s d'écart ; 404 JSON
//    `shipment_expired` pour un n° inconnu). Ces deux-là, le serveur les lit.
// ────────────────────────────────────────────────────────────────────────────
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { modifierCas } from './suivi-vinted.js';
import { normaliserSuivi } from './etat-colis-email.js';
import { arriveeColisEmail } from './arrivee-colis.js';
import { relireLigneMeta, SELECT_SUIVI_META, txDuColis, liensDesLignes, suiviDeLigne } from './suivi-colis.js';
import * as T from './transporteurs.js';
import { notifierChangementTransp } from './transporteurs-notif.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

export const UA_HONNETE = 'VRM-suivi/1.0 (+https://vrm.center)';
// Le drapeau de la lecture SERVEUR, par transporteur (voir la mesure ci-dessus).
// La valeur vit dans api/_lib/transporteurs.js (`LECTURE_SERVEUR_TRANSP`) pour
// que l'app dise la même chose (« Mondial Relay ne se lit que depuis ton
// ordinateur ») sans recopier la mesure (§11).
export const LECTURE_SERVEUR = T.LECTURE_SERVEUR_TRANSP;
export const ECART_MS = 1500;
export const DELAI_MS = 6000;
export const CORPS_MAX = 65536;
export const MAX_APP = 6;           // un passage app ouverte (C5)
export const BUDGET_APP_MS = 12000;
export const MAX_CRON = 12;         // un passage du cron, par vendeur
export const BUDGET_CRON_MS = 20000;
export const MAX_FERMETURE = 6;     // les anciens n° jamais fermés, par passage
export const MAX_C3 = 6;

// Les bancs règlent l'écart (jamais la production : rien ne lit d'environnement ici).
let _ecartMs = ECART_MS;
export function _reglerPourBanc({ ecartMs } = {}) { if (Number.isFinite(ecartMs) && ecartMs >= 0) _ecartMs = ecartMs; }

// ── NOTRE BASE, AU NOM DU VENDEUR (owner=eq., paginée) ──────────────────────
async function lireTout(chemin) {
  const owner = proprietaireCourant();
  if (!owner) return null;
  const out = []; const page = 1000;
  for (let from = 0; from < 200000; from += page) {
    let r;
    try {
      r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}${chemin.includes('?') ? '&' : '?'}owner=eq.${encodeURIComponent(owner)}`, { headers: { ...sbCle(SUPABASE_KEY), 'Range-Unit': 'items', Range: `${from}-${from + page - 1}` } });
    } catch (_) { return null; }
    if (!r.ok) return null;
    let j; try { j = await r.json(); } catch (_) { return null; }
    if (!Array.isArray(j)) return null;
    out.push(...j);
    if (j.length < page) break;
  }
  return out;
}
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// Ce que la sélection lit, en scalaires (§4.4). `null` si UNE lecture échoue.
export async function lireBaseTransp({ avecRelais = true } = {}) {
  const [lignes, transp, manuels, vinted, bords, pause, mainRow, relaisRow] = await Promise.all([
    lireTout(`app_data?id=like.email_track_*&select=${SELECT_SUIVI_META}`),
    lireTout(`app_data?id=like.transp_*&select=${T.SELECT_TRANSP_META}`),
    lireTout('app_data?id=like.colis_suivi_*&select=id,suivi:meta->>suivi,transporteur:meta->>transporteur,cp:meta->>codePostal,tx:meta->>tx,uid:meta->>uid,at:meta->>at'),
    lireTout('app_data?id=like.harvest_*_suivi_*&select=id,tx:meta->>tx,suivi:meta->>suivi,transporteur:meta->>transporteur,cap:meta->>capturedAt'),
    lireTout('app_data?id=like.email_bord_*&select=suivi:meta->>suivi'),
    lireTout(`app_data?id=eq.${T.ID_PAUSE}&select=data`),
    lireTout('app_data?id=eq.main&select=points:data->vrm_points_relais'),
    avecRelais ? lireTout('app_data?id=eq.panel_colis_relais&select=data') : Promise.resolve([]),
  ]);
  if (![lignes, transp, manuels, vinted, bords, pause, mainRow, relaisRow].every(Array.isArray)) return null;
  const tMap = new Map();
  for (const x of transp) { const t = T.ligneTranspDeMeta(x); if (t) tMap.set(t.suivi, t); }
  const relais = objet(relaisRow[0] && relaisRow[0].data);
  const liens = liensDesLignes(vinted, manuels) || [];
  // Les codes postaux PROUVÉS chez ce vendeur : ceux de ses lectures Mondial
  // Relay réussies (l'écho les a vérifiés) et ceux de ses points relais notés.
  const prouves = [];
  for (const t of tMap.values()) if (t.carrier === 'mondialrelay' && t.cp && t.lu) prouves.push(t.cp);
  const pts = mainRow[0] && Array.isArray(mainRow[0].points) ? mainRow[0].points : [];
  for (const p of pts) for (const c of T.codesPostauxDe(p && (p.full || p.adresse || ''))) prouves.push(c);
  return {
    lignes: lignes.map(relireLigneMeta).filter(Boolean),
    transp: tMap,
    manuels: manuels.map((m) => ({ ...m, suivi: normaliserSuivi(m.suivi), cp: /^\d{5}$/.test(String(m.cp || '')) ? String(m.cp) : '' })),
    vinted: vinted.map((v) => ({ ...v, suivi: normaliserSuivi(v.suivi) })),
    envoyes: bords.map((b) => b && b.suivi).filter(Boolean),
    pause: objet(pause[0] && pause[0].data),
    relais, liens, prouves: [...new Set(prouves)],
  };
}
// Les lieux de la conversation Vinted reliée à CE n° par identité (pour son code
// postal), et ses transactions (pour le silence des notifications).
const relaisDe = (b) => (k) => {
  const codes = b.lignes.filter((l) => suiviDeLigne(l) === k).map((l) => l.code).filter(Boolean);
  const txs = new Set();
  for (const c of [null, ...codes]) { const s = txDuColis({ suivi: k, code: c || '' }, b.relais, b.liens); if (s) for (const t of s) txs.add(t); }
  return [...txs].map((tx) => (b.relais[tx] && b.relais[tx].lieu) || '').filter(Boolean);
};
const txsDe = (b, k) => {
  const codes = b.lignes.filter((l) => suiviDeLigne(l) === k).map((l) => l.code).filter(Boolean);
  const txs = new Set();
  for (const c of [null, ...codes]) { const s = txDuColis({ suivi: k, code: c || '' }, b.relais, b.liens); if (s) for (const t of s) txs.add(t); }
  return [...txs];
};
const arriveeDe = (b, k) => {
  let ms = null;
  for (const l of b.lignes) { if (suiviDeLigne(l) !== k) continue; const a = arriveeColisEmail(l); if (a && (ms == null || a.ms < ms)) ms = a.ms; }
  return ms;
};
// Ce n° est-il un ACHAT de ce vendeur (§1.5) ? La même règle que la sélection.
export function estAchatDuVendeur(b, carrier, suivi) {
  const k = normaliserSuivi(suivi);
  const c = T.suivisAInterroger({ lignes: b.lignes, transp: new Map(), manuels: b.manuels, vinted: b.vinted, envoyes: b.envoyes, maintenant: Date.now(), seul: k, force: true, max: 1 });
  return c.some((x) => x.suivi === k && x.carrier === carrier);
}

// ── UNE LECTURE CHEZ UN TRANSPORTEUR ─────────────────────────────────────────
const _files = {}, _dernier = {};
function unParTransporteur(carrier, f) {
  const prec = _files[carrier] || Promise.resolve();
  const p = prec.then(async () => {
    const attente = (_dernier[carrier] || 0) + _ecartMs - Date.now();
    if (attente > 0) await new Promise((ok) => setTimeout(ok, attente));
    try { return await f(); } finally { _dernier[carrier] = Date.now(); }
  });
  _files[carrier] = p.catch(() => {});
  return p;
}
async function corpsBorne(r, max) {
  try {
    if (r.body && typeof r.body.getReader === 'function') {
      const lecteur = r.body.getReader(); const morceaux = []; let n = 0;
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        morceaux.push(value); n += value.byteLength;
        if (n >= max) { try { await lecteur.cancel(); } catch (_) {} break; }
      }
      return Buffer.concat(morceaux.map((m) => Buffer.from(m))).subarray(0, max).toString('utf8');
    }
    return String(await r.text()).slice(0, max);
  } catch (_) { return ''; }
}
// `cp` : le code postal du point relais (Mondial Relay seulement ; sans lui,
// aucune adresse). Le n° et le code postal ont leur FORME (8 chiffres, 5
// chiffres) : rien d'autre n'entre dans l'adresse.
export const urlTransporteur = (carrier, suivi, cp = '') => {
  const n = normaliserSuivi(suivi);
  if (!T.FORME_SUIVI[carrier] || !T.FORME_SUIVI[carrier].test(n)) return null;
  if (carrier === 'chronopost') return `https://ws.chronopost.fr/tracking-cxf/TrackingServiceWS/trackSkybillV2?language=fr_FR&skybillNumber=${n}`;
  if (carrier === 'vinted') return `https://carrier.vintedgo.com/public/v3/tracking_events/${n}`;
  if (carrier === 'mondialrelay') return /^\d{5}$/.test(String(cp || '')) ? `https://www.mondialrelay.fr/_mvc/fr-FR/SuiviExpedition/RechercherJsonResponsive?NumeroExpedition=${n}&CodePostal=${cp}` : null;
  return null;
};
const ACCEPT = { chronopost: 'text/xml, application/xml', vinted: 'application/json', mondialrelay: 'application/json' };
// Rend { statut, ctype, corps, retryAfter, defi } ou { echec: 'voie'|'suivi'|'reseau' }.
export async function lireTransporteur(carrier, suivi, { cp = '' } = {}) {
  if (!LECTURE_SERVEUR[carrier]) return { echec: 'voie' };
  const url = urlTransporteur(carrier, suivi, cp);
  if (!url) return { echec: 'suivi' };
  return unParTransporteur(carrier, async () => {
    try {
      const r = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(DELAI_MS),
        headers: { 'User-Agent': UA_HONNETE, Accept: ACCEPT[carrier], ...(carrier === 'vinted' ? { 'Accept-Language': 'fr' } : {}), ...(carrier === 'mondialrelay' ? { 'X-Requested-With': 'XMLHttpRequest' } : {}) },
      });
      const h = (k) => { try { return r.headers.get(k) || ''; } catch (_) { return ''; } };
      return { statut: r.status, ctype: h('content-type'), corps: await corpsBorne(r, CORPS_MAX), retryAfter: h('retry-after'), defi: /challenge/i.test(h('cf-mitigated')) };
    } catch (_) { return { echec: 'reseau' }; }
  });
}

// ── RANGER UN ESSAI (C1), PUIS SONNER S'IL Y A UN CHANGEMENT ─────────────────
// `lu` : le rendu d'un analyseur. Rend { res, etat, change, ecrit } (ecrit :
// true · false · null = pas su).
async function rangerEssai(b, item, lu, { source = 'serveur', statut = null, maintenant = Date.now(), silence = false, cp = '', cpSource = '', cpEssaye = '', voie = '' } = {}) {
  const id = T.cleTransp(item.carrier, item.suivi);
  let avant = null, apres = null;
  const ecrit = await modifierCas(id, (d) => {
    avant = d ? { ...d } : null;
    apres = T.ligneApresEssai(d, lu, { carrier: item.carrier, suivi: item.suivi, voie: voie || T.VOIE_DE[item.carrier], source, statut, maintenant, cp, cpSource, cpEssaye });
    return apres;
  });
  if (ecrit !== true) return { res: lu.res, etat: (avant && avant.etat) || null, change: false, ecrit };
  // La base du passage suit ce qui vient d'être écrit (le `besoinNavigateur`
  // final se juge sur l'état à jour, la même règle que C3).
  if (b && b.transp instanceof Map) { const t = T.ligneTranspDeMeta({ id, ...apres }); if (t) b.transp.set(t.suivi, t); }
  const change = !!(apres.etat && (!avant || avant.etat !== apres.etat || (avant.detail || null) !== (apres.detail || null)));
  if (apres.essaiRes === 'ok' && change) {
    const k = item.suivi;
    try { await notifierChangementTransp(avant, apres, { maintenant, silence, arriveeMs: arriveeDe(b, k), txs: txsDe(b, k), codes: b.lignes.filter((l) => suiviDeLigne(l) === k).map((l) => l.code).filter(Boolean) }); } catch (_) {}
  }
  return { res: apres.essaiRes, etat: apres.etat || null, change, ecrit };
}
async function poserPause(carrier, rep, maintenant) {
  return modifierCas(T.ID_PAUSE, (d) => T.pauseApresRefus(d, carrier, { statut: rep && rep.statut, ctype: rep && rep.ctype, retryAfter: rep && rep.retryAfter, maintenant }));
}
async function leverPause(b, carrier) {
  if (!T.enPause(b.pause, carrier) && !(b.pause[carrier] && b.pause[carrier].palier)) return;
  await modifierCas(T.ID_PAUSE, (d) => T.pauseLevee(d, carrier));
}

// ── UN PASSAGE (C5, et le cron) ──────────────────────────────────────────────
// Rend { ok, raison?, lus: [{carrier, suivi, res, etat, change}], besoinNavigateur, pause }.
export async function passageTransporteurs({ max = MAX_APP, budgetMs = BUDGET_APP_MS, suivi = null, force = false, cpPage = '', maintenant = null } = {}) {
  const t0 = Date.now();
  const b = await lireBaseTransp();
  if (!b) return { ok: false, raison: 'pas-su', lus: [], besoinNavigateur: [], pause: {} };
  const now = maintenant || Date.now();
  const items = T.suivisAInterroger({ lignes: b.lignes, transp: b.transp, manuels: b.manuels, vinted: b.vinted, envoyes: b.envoyes, relaisDe: relaisDe(b), prouves: b.prouves, maintenant: now, max: 50, parTransporteur: 50, seul: suivi, force: !!(suivi && force) });
  const lus = [];
  let nFermeture = 0, nLus = 0;
  // Chaque transporteur suit SA file ; les trois se lisent en parallèle — par le
  // SERVEUR, Mondial Relay compris (voie `mr-fr-mvc`). `besoinNavigateur` ne
  // reçoit un n° que sur REFUS du transporteur (ou pendant sa pause).
  const parC = { chronopost: [], vinted: [], mondialrelay: [] };
  for (const it of items) (parC[it.carrier] || []).push(it);
  const traiterServeur = async (carrier) => {
    for (const it of parC[carrier]) {
      if (Date.now() - t0 > budgetMs || nLus >= max) break;
      if (it.raison === 'fermeture') { if (nFermeture >= MAX_FERMETURE) continue; }
      // Mondial Relay : le code postal du point relais. Sans lui, AUCUNE requête :
      // on le DIT (la carte donne le geste).
      let cp = '', cpSource = '', cpEssaye = '';
      if (carrier === 'mondialrelay') {
        const dePage = suivi && normaliserSuivi(suivi) === it.suivi && /^\d{5}$/.test(String(cpPage || '')) ? String(cpPage) : '';
        cp = it.cp || dePage;
        cpSource = it.cp ? it.cpSource : (dePage ? 'page' : '');
        if (!cp) {
          const t = b.transp.get(it.suivi);
          if (t && t.essaiRes === 'cp-inconnu') continue;
          const r = await rangerEssai(b, it, { res: 'cp-inconnu' }, { maintenant: now, voie: T.VOIE_SERVEUR[carrier] });
          lus.push({ carrier, suivi: it.suivi, res: 'cp-inconnu', etat: r.etat, change: false });
          continue;
        }
        if (cpSource === 'essai') cpEssaye = cp;
      }
      if (T.enPause(b.pause, carrier, Date.now())) continue;   // l'extension le lit à sa place (besoinNavigateur, plus bas)
      nLus++;
      if (it.raison === 'fermeture') nFermeture++;
      const rep = await lireTransporteur(carrier, it.suivi, { cp });
      if (rep.echec) {
        const r = await rangerEssai(b, it, { res: 'passu' }, { maintenant: Date.now(), voie: T.VOIE_SERVEUR[carrier] });
        lus.push({ carrier, suivi: it.suivi, res: 'passu', etat: r.etat, change: false });
        continue;
      }
      let lu = rep.defi ? { res: 'bloque' } : T.lireReponse(carrier, rep.statut, rep.ctype, rep.corps, { suivi: it.suivi, cp, voie: T.VOIE_SERVEUR[carrier] });
      if (lu.res === 'bloque') {
        await poserPause(carrier, rep, Date.now());
        b.pause = T.pauseApresRefus(b.pause, carrier, { statut: rep.statut, ctype: rep.ctype, retryAfter: rep.retryAfter, maintenant: Date.now() });
      } else if (lu.res === 'ok' || lu.res === 'introuvable' || lu.res === 'expire') await leverPause(b, carrier);
      // Un code postal ESSAYÉ (pas encore prouvé pour CE colis) : « pas de colis »
      // pour ce couple ne veut pas dire « n° inconnu » — on note l'essai, sans
      // compter d'échec (sinon trois mauvais essais fermeraient le n° pour toujours).
      if (cpEssaye && (lu.res === 'introuvable' || lu.res === 'forme')) lu = { res: 'cp-inconnu' };
      const r = await rangerEssai(b, it, lu, { statut: rep.statut, maintenant: Date.now(), silence: it.raison === 'fermeture', voie: T.VOIE_SERVEUR[carrier], cp: lu.res === 'ok' ? cp : '', cpSource, cpEssaye });
      lus.push({ carrier, suivi: it.suivi, res: r.res, etat: r.etat, change: r.change });
    }
  };
  await Promise.all([traiterServeur('chronopost'), traiterServeur('vinted'), traiterServeur('mondialrelay')]);
  // Ce que le serveur n'a pas pu lire, pour l'extension : la règle de C3, sur la
  // base à jour de ce passage (un n° demandé seul : lui seul).
  const besoin = T.aLireParNavigateur({ lignes: b.lignes, transp: b.transp, manuels: b.manuels, vinted: b.vinted, envoyes: b.envoyes, relaisDe: relaisDe(b), prouves: b.prouves, pause: b.pause, maintenant: Date.now(), seul: suivi, max: MAX_C3 });
  return { ok: true, lus, besoinNavigateur: besoin, pause: T.pausePublique(b.pause) };
}

// ── C3 : CE QUE L'EXTENSION DOIT LIRE DEPUIS LE NAVIGATEUR ──────────────────
// SEULEMENT ce que le serveur n'a pas pu lire : un n° refusé (`bloque`), ou un
// transporteur en pause — Mondial Relay compris (avec son code postal, voie
// `mr-be` : celle de l'extension). 6 au plus.
export async function transpALire({ maintenant = null } = {}) {
  const b = await lireBaseTransp();
  if (!b) return null;
  const now = maintenant || Date.now();
  const items = T.aLireParNavigateur({ lignes: b.lignes, transp: b.transp, manuels: b.manuels, vinted: b.vinted, envoyes: b.envoyes, relaisDe: relaisDe(b), prouves: b.prouves, pause: b.pause, maintenant: now, max: MAX_C3 });
  return { v: 1, items, pause: T.pausePublique(b.pause) };
}

// ── C4 : LA RÉPONSE BRUTE RELAYÉE PAR L'EXTENSION ───────────────────────────
// Le corps est JUGÉ ici (la même fonction que nos propres lectures) ; il n'est
// jamais une adresse à suivre. Rend { status, corps }.
export const ENVOI_MAX = 80 * 1024;
export async function appliquerReponseBrute(body, { maintenant = null } = {}) {
  const x = body && typeof body === 'object' ? body : null;
  if (!x || x.v !== 1) return { status: 400, corps: { error: 'forme' } };
  const carrier = String(x.carrier || '');
  if (!T.CARRIERS_LUS.includes(carrier)) return { status: 400, corps: { error: 'forme' } };
  const suivi = normaliserSuivi(x.suivi);
  if (!T.FORME_SUIVI[carrier].test(suivi)) return { status: 400, corps: { error: 'suivi' } };
  if (T.VOIES[String(x.voie || '')] !== carrier) return { status: 400, corps: { error: 'voie' } };
  if (typeof x.corps !== 'string') return { status: 400, corps: { error: 'forme' } };
  if (Buffer.byteLength(x.corps, 'utf8') > CORPS_MAX) return { status: 413, corps: { error: 'trop-gros' } };
  const statut = Number(x.statut);
  if (!Number.isInteger(statut) || statut < 0 || statut > 999) return { status: 400, corps: { error: 'forme' } };
  const ctype = typeof x.ctype === 'string' ? x.ctype.slice(0, 200) : '';
  const source = x.source === 'page' ? 'page' : 'extension';
  const cp = carrier === 'mondialrelay' ? String(x.cp == null ? '' : x.cp) : '';
  if (carrier === 'mondialrelay' && !/^\d{5}$/.test(cp)) return { status: 400, corps: { error: 'forme' } };
  const b = await lireBaseTransp();
  if (!b) return { status: 503, corps: { error: 'pas-su' } };
  if (!estAchatDuVendeur(b, carrier, suivi)) return { status: 409, corps: { error: 'inconnu' } };
  const now = maintenant || Date.now();
  const t = b.transp.get(suivi) || null;
  let lu = T.lireReponse(carrier, statut, ctype, x.corps, { suivi, cp, voie: x.voie });
  let cpSource = '', cpEssaye = '';
  if (carrier === 'mondialrelay') {
    const connu = T.codePostalPourMondialRelay({ suivi, transp: t, lignes: b.lignes.filter((l) => suiviDeLigne(l) === suivi), manuels: b.manuels, relaisLieux: relaisDe(b)(suivi), prouves: [], maintenant: now, essai: false });
    if (connu && connu.cp === cp) cpSource = connu.source;
    else {
      // Un code postal ESSAYÉ (pas encore prouvé pour CE colis) : « pas de colis »
      // ne veut pas dire « n° inconnu » — on note l'essai, sans compter d'échec.
      cpSource = 'essai'; cpEssaye = cp;
      if (lu.res === 'introuvable' || lu.res === 'forme') lu = { res: 'cp-inconnu' };
    }
  }
  const r = await rangerEssai(b, { carrier, suivi }, lu, { source, statut, maintenant: now, cp: lu.res === 'ok' ? cp : '', cpSource, cpEssaye });
  if (r.ecrit === null) return { status: 503, corps: { error: 'pas-su' } };
  return { status: 200, corps: { ok: true, res: r.res, etat: r.etat, change: r.change } };
}
