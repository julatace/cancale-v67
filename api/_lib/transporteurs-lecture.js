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
// ⚠️⚠️ MONDIAL RELAY — CE QUI A ÉTÉ MESURÉ LE 24 OCTOBRE 2026, depuis dub1
//    (sandbox Vercel), avec le User-Agent honnête, sans cookie ni jeton :
//    · 11:19 UTC : `www.mondialrelay.be/fr-be/suivi-de-colis/` 200, mais
//      `www.mondialrelay.be/api/tracking` 403 en HTML (Cloudflare) — le
//      serveur ne la lit PAS ;
//    · 11:51 et 11:53 UTC : `www.mondialrelay.fr/_mvc/fr-FR/SuiviExpedition/
//      RechercherJsonResponsive?NumeroExpedition=<n°>&CodePostal=<cp>` (GET,
//      `Accept: application/json`, `X-Requested-With: XMLHttpRequest`) 200
//      application/json, 44 867 o, Success:true, pas de `cf-mitigated` ; avec
//      un autre code postal : 200, Success:false (« erreur de saisie »), 1 517 o ;
//    · 12:0x et 12:28 UTC (même route) : 200, 44 867 o, 418 ms. Le fragment
//      `Message` porte la frise `timeline suivi` (5 `<li>`, `validate` sur les
//      étapes atteintes), un `infos-account` par jour (`<p>jj/mm/aaaa</p>`),
//      dans `step-suivi` `<p class="center">hh:mm</p>` puis le libellé, le n°
//      du point relais (`numeroTemp`) et ses horaires (`points_relais
//      PCL_Details` › `detail-mag`) — mais NI le nom NI l'adresse du point
//      (chargés par une autre route, jamais appelée). L'écho : `var
//      numeroExpedition = '<n°>'` et, dans le dataLayer, `'CodePostal' : '<cp>'`.
//    ⇒ Le SERVEUR lit Mondial Relay par cette route (`mr-fr-mvc`), jugée par
//    `lireReponseMondialRelayMvc` avec l'ÉCHO exigé, le code postal étant celui
//    du point relais (mêmes sources : lu, e-mail, saisie, conversation, essai
//    borné). Il ne contourne jamais : un refus (403, 401, 429, défi, HTML hors
//    JSON) pose la PAUSE de Mondial Relay, et c'est SEULEMENT alors (et pendant
//    la pause) que le n° part à l'extension (`besoinNavigateur`, C3 — la règle
//    `aLireParNavigateur`) : elle le lit depuis le navigateur de Julien, par la
//    MÊME route (`mr-fr-mvc`, son adresse IP), et relaie la réponse BRUTE (C4)
//    — jugée ici, avec le contrôle de l'écho (n° ET code postal). L'API .be
//    (`mr-be`), si l'extension la relaie, est jugée par sa propre fonction.
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
import { envoyerNotifTransp, notifEncoreValable } from './transporteurs-notif.js';
import { PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';

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
// Le fragment Mondial Relay (`mr-fr-mvc`) pèse ~45 Ko pour 14 évènements : il
// est lu sur 192 Ko au plus (tronqué, ce n'est plus du JSON ⇒ « forme »).
export const CORPS_MAX_MR = 196608;
export const MAX_APP = 6;           // un passage app ouverte (C5)
export const BUDGET_APP_MS = 12000;
export const MAX_CRON = 12;         // un passage du cron, par vendeur
export const BUDGET_CRON_MS = 20000;
export const MAX_FERMETURE = 6;     // les anciens n° jamais fermés, par passage
export const MAX_C3 = 6;
// (29 oct., revue n° 20) LA BORNE TIENT : un élément ne part que s'il reste de
// quoi le FINIR (le délai du transporteur, l'écart, et ce qu'il faut pour ranger
// et sonner) — la vérification « avant chaque élément » laissait partir une
// lecture à 11,9 s d'un budget de 12 s (le relais répondait à 16,6 s).
export const MARGE_RANGEMENT_MS = 1500;
// (29 oct., revue n° 17) Le BAIL d'une lecture en vol, sur la ligne `transp_` :
// deux passages simultanés (iPhone + Mac, le cron + l'app) ne lisent pas deux
// fois le même n° (le rythme en route : une lecture toutes les 2 h).
export const BAIL_MS = 30000;
// (29 oct., revue n° 19) Une réponse relayée (C4) est datée par son `at` : plus
// vieille que ça, ou plus vieille que la dernière lecture de la ligne, elle ne
// change rien (un colis retiré ne redevient pas « à retirer »).
export const C4_AGE_MAX_MS = 30 * 60000;
export const NOTIFS_REPRISES_MAX = 6;

// Les bancs règlent l'écart (jamais la production : rien ne lit d'environnement ici).
let _ecartMs = ECART_MS, _delaiMs = DELAI_MS;
export function _reglerPourBanc({ ecartMs, delaiMs } = {}) {
  if (Number.isFinite(ecartMs) && ecartMs >= 0) _ecartMs = ecartMs;
  if (Number.isFinite(delaiMs) && delaiMs > 0) _delaiMs = delaiMs;
}

// ── (29 oct., revue n° 15) LA PAUSE EST CELLE DU SERVEUR, PAS D'UN VENDEUR ──
// Un 403 de Chronopost refuse l'ADRESSE du serveur — la même pour tous les
// vendeurs. Rangée par vendeur, elle n'arrêtait rien : le cron (8 vendeurs en
// parallèle) envoyait encore 4 requêtes après le refus, et l'app d'un autre
// vendeur une de plus. Elle vit donc :
//   · dans UNE ligne au propriétaire NEUTRE (`transp_pause`, clé de service —
//     aucune session ne la voit), lue par chaque passage ;
//   · et en mémoire d'instance, posée DANS la file du transporteur au moment
//     même du refus, consultée juste avant CHAQUE requête.
let _pauseInstance = {};
export const _oublierPauseInstance = () => { _pauseInstance = {}; };
const pauseConnue = (p) => {
  const out = { ...(p && typeof p === 'object' ? p : {}) };
  for (const c of T.CARRIERS_LUS) {
    const a = out[c], b = _pauseInstance[c];
    const ja = Date.parse(a && a.jusqua || ''), jb = Date.parse(b && b.jusqua || '');
    if (Number.isFinite(jb) && !(Number.isFinite(ja) && ja >= jb)) out[c] = b;
  }
  return out;
};
// Une règle pour les deux points d'arrêt (le tri du passage et la file, juste
// avant la requête) : la pause rangée en base OU connue de l'instance.
const pauseEnCours = (p, carrier) => T.enPause(pauseConnue(p), carrier, Date.now());
async function lirePauseServeur() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${T.ID_PAUSE}&owner=eq.${PROPRIETAIRE_NEUTRE}&select=data`, { headers: { ...sbCle(SUPABASE_KEY) } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}

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
    lireTout(`app_data?id=like.transp_*&select=${T.SELECT_TRANSP_META},notifEnAttente:meta->>notifEnAttente`),
    lireTout('app_data?id=like.colis_suivi_*&select=id,suivi:meta->>suivi,transporteur:meta->>transporteur,cp:meta->>codePostal,tx:meta->>tx,uid:meta->>uid,at:meta->>at'),
    lireTout('app_data?id=like.harvest_*_suivi_*&select=id,tx:meta->>tx,suivi:meta->>suivi,transporteur:meta->>transporteur,cap:meta->>capturedAt'),
    lireTout('app_data?id=like.email_bord_*&select=suivi:meta->>suivi'),
    lirePauseServeur(),
    lireTout('app_data?id=eq.main&select=points:data->vrm_points_relais'),
    avecRelais ? lireTout('app_data?id=eq.panel_colis_relais&select=data') : Promise.resolve([]),
  ]);
  if (![lignes, transp, manuels, vinted, bords, pause, mainRow, relaisRow].every(Array.isArray)) return null;
  const tMap = new Map();
  const attente = [];
  for (const x of transp) { const t = T.ligneTranspDeMeta(x); if (t) { tMap.set(t.suivi, t); if (x.notifEnAttente) attente.push(t.id); } }
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
    pause: pauseConnue(objet(pause[0] && pause[0].data)),
    relais, liens, prouves: [...new Set(prouves)], attente,
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
// (29 oct., revue n° 18) La RAISON de lire ce n° (« actif », « fermeture »),
// par la règle de la sélection : une ligne `transp_` déjà là n'est jamais une
// fermeture ; sinon la sélection jugée sur ce n° seul, sans le rythme.
export function raisonDu(b, carrier, suivi, maintenant = Date.now()) {
  const k = normaliserSuivi(suivi);
  if (b.transp instanceof Map && b.transp.has(k)) return 'actif';
  const c = T.suivisAInterroger({ lignes: b.lignes, transp: new Map(), manuels: b.manuels, vinted: b.vinted, envoyes: b.envoyes, maintenant, seul: k, max: 1, parTransporteur: 1 });
  const it = c.find((x) => x.suivi === k && x.carrier === carrier);
  return it ? it.raison : null;
}
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
// rien ne part : la route répond Success:false à un code postal faux). Le n° et
// le code postal ont leur FORME (8 chiffres, 5 chiffres) : rien d'autre n'entre
// dans l'adresse.
export const urlTransporteur = (carrier, suivi, cp = '') => {
  const n = normaliserSuivi(suivi);
  if (!T.FORME_SUIVI[carrier] || !T.FORME_SUIVI[carrier].test(n)) return null;
  if (carrier === 'chronopost') return `https://ws.chronopost.fr/tracking-cxf/TrackingServiceWS/trackSkybillV2?language=fr_FR&skybillNumber=${n}`;
  if (carrier === 'vinted') return `https://carrier.vintedgo.com/public/v3/tracking_events/${n}`;
  if (carrier === 'mondialrelay') return /^\d{5}$/.test(String(cp || '')) ? `https://www.mondialrelay.fr/_mvc/fr-FR/SuiviExpedition/RechercherJsonResponsive?NumeroExpedition=${n}&CodePostal=${cp}` : null;
  return null;
};
const ENTETES = {
  chronopost: { Accept: 'text/xml, application/xml' },
  vinted: { Accept: 'application/json', 'Accept-Language': 'fr' },
  // Les deux en-têtes de la mesure (une requête « XHR » de la page) — aucun
  // cookie, aucun jeton, le User-Agent honnête.
  mondialrelay: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
};
// Rend { statut, ctype, corps, retryAfter, defi } ou { echec: 'voie'|'suivi'|'reseau'|'pause'|'budget' }.
// `fin` : l'heure (ms) à laquelle la lecture doit être finie (la borne du
// passage) ; `signal` : l'arrêt du passage (le cron qui a répondu).
export async function lireTransporteur(carrier, suivi, { cp = '', fin = null, signal = null } = {}) {
  if (!LECTURE_SERVEUR[carrier]) return { echec: 'voie' };
  const url = urlTransporteur(carrier, suivi, cp);
  if (!url) return { echec: 'suivi' };
  return unParTransporteur(carrier, async () => {
    // Juste avant la requête (après l'attente de la file) : la pause posée par
    // un autre passage de CETTE instance, la borne, l'arrêt.
    if (pauseEnCours(null, carrier)) return { echec: 'pause' };
    if (signal && signal.aborted) return { echec: 'budget' };
    const reste = Number.isFinite(fin) ? fin - Date.now() : _delaiMs;
    if (reste < Math.min(_delaiMs, 1000)) return { echec: 'budget' };
    try {
      const signaux = [AbortSignal.timeout(Math.min(_delaiMs, reste))];
      if (signal) signaux.push(signal);
      const r = await fetch(url, {
        redirect: 'error',
        signal: signaux.length > 1 && typeof AbortSignal.any === 'function' ? AbortSignal.any(signaux) : signaux[0],
        headers: { 'User-Agent': UA_HONNETE, ...(ENTETES[carrier] || { Accept: 'application/json' }) },
      });
      const h = (k) => { try { return r.headers.get(k) || ''; } catch (_) { return ''; } };
      const rep = { statut: r.status, ctype: h('content-type'), corps: await corpsBorne(r, carrier === 'mondialrelay' ? CORPS_MAX_MR : CORPS_MAX), retryAfter: h('retry-after'), defi: /challenge/i.test(h('cf-mitigated')) };
      // Un REFUS se note ICI, avant que la file ne laisse partir la suivante.
      if (rep.defi || T.lireReponse(carrier, rep.statut, rep.ctype, rep.corps, { suivi, cp, voie: T.VOIE_SERVEUR[carrier] }).res === 'bloque') {
        const p = T.pauseApresRefus(_pauseInstance, carrier, { statut: rep.statut, ctype: rep.ctype, retryAfter: rep.retryAfter, maintenant: Date.now() });
        if (p) _pauseInstance = p;
      }
      return rep;
    } catch (_) { return { echec: (signal && signal.aborted) ? 'budget' : 'reseau' }; }
  });
}

// ── RANGER UN ESSAI (C1), PUIS SONNER S'IL Y A UN CHANGEMENT ─────────────────
// `lu` : le rendu d'un analyseur. Rend { res, etat, change, ecrit } (ecrit :
// true · false · null = pas su).
// (29 oct., revue n° 13) Ce qui doit sonner est écrit DANS la ligne, par le
// même comparer-et-échanger que le changement (`notif` + `notifEnAttente`, une
// chaîne que la base copie dans `meta` pour la retrouver) : un hoquet de notre
// base au moment de sonner ne consomme plus le changement, le passage suivant
// reprend la notification (`reprendreNotifs`). Un nouvel état remplace une
// notification encore en attente de l'état d'avant (elle ne vaut plus).
async function rangerEssai(b, item, lu, { source = 'serveur', statut = null, maintenant = Date.now(), silence = false, cp = '', cpSource = '', cpEssaye = '', voie = '', signal = null } = {}) {
  const id = T.cleTransp(item.carrier, item.suivi);
  let avant = null, apres = null;
  const arriveeMs = arriveeDe(b, item.suivi);
  const ecrit = await modifierCas(id, (d) => {
    // L'arrêt (le cron a déjà répondu) : plus aucune écriture (revue n° 20).
    if (signal && signal.aborted) return undefined;
    avant = d ? { ...d } : null;
    apres = T.ligneApresEssai(d, lu, { carrier: item.carrier, suivi: item.suivi, voie: voie || (source === 'serveur' ? T.VOIE_SERVEUR : T.VOIE_DE)[item.carrier], source, statut, maintenant, cp, cpSource, cpEssaye });
    if (apres.essaiRes === 'ok' && T.etatAChange(avant, apres)) {
      delete apres.notif; delete apres.notifEnAttente;
      const ch = T.changementANotifier(avant, apres, { maintenant, silence, arriveeMs });
      if (ch) { apres.notif = { ...ch, at: new Date(maintenant).toISOString() }; apres.notifEnAttente = ch.cle; }
    }
    return apres;
  });
  if (ecrit !== true || !apres) return { res: lu.res, etat: (avant && avant.etat) || null, change: false, ecrit };
  // La base du passage suit ce qui vient d'être écrit (le `besoinNavigateur`
  // final se juge sur l'état à jour, la même règle que C3).
  if (b && b.transp instanceof Map) { const t = T.ligneTranspDeMeta({ id, ...apres }); if (t) b.transp.set(t.suivi, t); }
  const change = apres.essaiRes === 'ok' && T.etatAChange(avant, apres);
  if (apres.notif && !(signal && signal.aborted)) { try { await sonnerEnAttente(b, id, apres, maintenant); } catch (_) {} }
  return { res: apres.essaiRes, etat: apres.etat || null, change, ecrit };
}
// La notification EN ATTENTE d'une ligne : envoyée (ou décidée), puis effacée
// de la ligne — sauf « pas su » (rien n'a été réservé : on la garde).
async function sonnerEnAttente(b, id, t, maintenant = Date.now()) {
  const k = t.suivi;
  const cle = t.notifEnAttente;
  let r;
  if (!notifEncoreValable(t, maintenant)) r = { envoye: false, raison: 'perimee' };
  else r = await envoyerNotifTransp(t, t.notif, { txs: txsDe(b, k), codes: b.lignes.filter((l) => suiviDeLigne(l) === k).map((l) => l.code).filter(Boolean) });
  if (r.raison === 'pas-su') return r;
  await modifierCas(id, (d) => {
    if (!d || d.notifEnAttente !== cle) return undefined;
    const o = { ...d }; delete o.rev; delete o.notif; delete o.notifEnAttente;
    return o;
  });
  return r;
}
// Les notifications restées en attente (un hoquet de la base au moment de
// sonner) : reprises en tête de passage, 6 au plus.
async function reprendreNotifs(b, { signal = null } = {}) {
  const ids = (b.attente || []).slice(0, NOTIFS_REPRISES_MAX);
  if (!ids.length) return 0;
  const rows = await lireTout(`app_data?id=in.(${ids.map((x) => encodeURIComponent(x)).join(',')})&select=id,data`);
  if (!Array.isArray(rows)) return 0;
  let n = 0;
  for (const row of rows) {
    if (signal && signal.aborted) break;
    const t = row && row.data;
    if (!t || !t.notifEnAttente) continue;
    try { const r = await sonnerEnAttente(b, row.id, t); if (r.envoye) n++; } catch (_) {}
  }
  return n;
}
// (29 oct., revue n° 17) Le bail : on ne lit un n° que s'il n'a pas été relu
// depuis la lecture de la base de CE passage, et qu'aucun autre passage ne le
// lit en ce moment. Rend true (à nous) · false (un autre l'a, ou l'a déjà relu).
async function prendreBail(b, it, maintenant = Date.now()) {
  const id = T.cleTransp(it.carrier, it.suivi);
  const vu = b.transp instanceof Map ? b.transp.get(it.suivi) : null;
  const r = await modifierCas(id, (d) => {
    const enVol = Date.parse(d && d.enVol || '');
    if (Number.isFinite(enVol) && maintenant - enVol < BAIL_MS) return undefined;
    if (((d && d.essai) || null) !== ((vu && vu.essai) || null)) return undefined;
    const o = d ? { ...d } : { v: 1, suivi: normaliserSuivi(it.suivi), carrier: it.carrier };
    delete o.rev;
    o.enVol = new Date(maintenant).toISOString();
    return o;
  });
  return r === true;
}
async function poserPause(rep, carrier, maintenant) {
  const r = await modifierCas(T.ID_PAUSE, (d) => T.pauseApresRefus(d, carrier, { statut: rep && rep.statut, ctype: rep && rep.ctype, retryAfter: rep && rep.retryAfter, maintenant }), 6, { owner: PROPRIETAIRE_NEUTRE });
  const p = T.pauseApresRefus(_pauseInstance, carrier, { statut: rep && rep.statut, ctype: rep && rep.ctype, retryAfter: rep && rep.retryAfter, maintenant });
  if (p) _pauseInstance = p;
  return r;
}
async function leverPause(b, carrier) {
  const li = T.pauseLevee(_pauseInstance, carrier); if (li) _pauseInstance = li;
  if (!T.enPause(b.pause, carrier) && !(b.pause[carrier] && b.pause[carrier].palier)) return;
  await modifierCas(T.ID_PAUSE, (d) => T.pauseLevee(d, carrier), 6, { owner: PROPRIETAIRE_NEUTRE });
}

// ── UN PASSAGE (C5, et le cron) ──────────────────────────────────────────────
// Rend { ok, raison?, lus: [{carrier, suivi, res, etat, change}], besoinNavigateur, pause }.
// `signal` : l'arrêt (le cron qui a déjà répondu) — plus aucune lecture, aucune
// écriture, aucune notification ne part après lui (revue n° 20).
export async function passageTransporteurs({ max = MAX_APP, budgetMs = BUDGET_APP_MS, suivi = null, force = false, cpPage = '', maintenant = null, signal = null } = {}) {
  const t0 = Date.now();
  const fin = t0 + budgetMs;
  const b = await lireBaseTransp();
  if (!b) return { ok: false, raison: 'pas-su', lus: [], besoinNavigateur: [], pause: {} };
  const now = maintenant || Date.now();
  // Les notifications restées en attente (un hoquet de la base au moment de
  // sonner) partent d'abord (revue n° 13).
  if (!(signal && signal.aborted)) await reprendreNotifs(b, { signal });
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
      if (signal && signal.aborted) break;
      if (nLus >= max) break;
      // Un élément ne part que s'il reste de quoi le finir (revue n° 20).
      if (Date.now() + _delaiMs + _ecartMs + MARGE_RANGEMENT_MS > fin) break;
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
          const r = await rangerEssai(b, it, { res: 'cp-inconnu' }, { maintenant: now });
          lus.push({ carrier, suivi: it.suivi, res: 'cp-inconnu', etat: r.etat, change: false });
          continue;
        }
        // Un code postal ESSAYÉ (un essai borné, ou donné par la page : pas
        // prouvé pour CE colis), sauf si la ligne l'a déjà prouvé.
        const t = b.transp.get(it.suivi);
        if ((cpSource === 'essai' || cpSource === 'page') && !(t && t.cp === cp)) cpEssaye = cp;
      }
      if (pauseEnCours(b.pause, carrier)) continue;   // l'extension le lit à sa place (besoinNavigateur, plus bas)
      // Le bail : un autre passage le lit déjà, ou vient de le relire (revue n° 17).
      if (!(await prendreBail(b, it, Date.now()))) continue;
      nLus++;
      if (it.raison === 'fermeture') nFermeture++;
      const rep = await lireTransporteur(carrier, it.suivi, { cp, fin, signal });
      // Pas lu (pause posée par un autre passage, borne atteinte, arrêt) : le
      // bail tombe de lui-même (30 s), rien n'est rangé, rien ne compte.
      if (rep.echec === 'pause' || rep.echec === 'budget') { nLus--; if (it.raison === 'fermeture') nFermeture--; if (rep.echec === 'pause') b.pause = pauseConnue(b.pause); continue; }
      if (signal && signal.aborted) break;
      if (rep.echec) {
        const r = await rangerEssai(b, it, { res: 'passu' }, { maintenant: Date.now(), voie: T.VOIE_SERVEUR[carrier] });
        lus.push({ carrier, suivi: it.suivi, res: 'passu', etat: r.etat, change: false });
        continue;
      }
      let lu = rep.defi ? { res: 'bloque' } : T.lireReponse(carrier, rep.statut, rep.ctype, rep.corps, { suivi: it.suivi, cp, voie: T.VOIE_SERVEUR[carrier] });
      if (lu.res === 'bloque') {
        await poserPause(rep, carrier, Date.now());
        b.pause = pauseConnue(b.pause);
      } else if (lu.res === 'ok' || lu.res === 'introuvable' || lu.res === 'expire') await leverPause(b, carrier);
      // Un code postal pas encore PROUVÉ pour CE colis (essayé, donné par la page,
      // ou SAISI à la main — revue n° 7) : « pas de colis » pour ce couple ne veut
      // pas dire « n° inconnu » — on note le code postal refusé, sans compter
      // d'échec (sinon trois refus fermeraient le n° pour toujours). La règle :
      // `resultatMondialRelay` (api/_lib/transporteurs.js, la même qu'en C4).
      if (carrier === 'mondialrelay') lu = T.resultatMondialRelay(lu, { cp, cpSource, cpEssaye, transp: b.transp.get(it.suivi) });
      const r = await rangerEssai(b, it, lu, { statut: rep.statut, maintenant: Date.now(), silence: it.raison === 'fermeture', voie: T.VOIE_SERVEUR[carrier], cp: lu.res === 'ok' ? cp : '', cpSource, cpEssaye, signal });
      lus.push({ carrier, suivi: it.suivi, res: r.res, etat: r.etat, change: r.change });
    }
  };
  await Promise.all([traiterServeur('chronopost'), traiterServeur('vinted'), traiterServeur('mondialrelay')]);
  // Ce que le serveur n'a pas pu lire, pour l'extension : la règle de C3, sur la
  // base à jour de ce passage (un n° demandé seul : lui seul).
  const besoin = T.aLireParNavigateur({ lignes: b.lignes, transp: b.transp, manuels: b.manuels, vinted: b.vinted, envoyes: b.envoyes, relaisDe: relaisDe(b), prouves: b.prouves, pause: pauseConnue(b.pause), maintenant: Date.now(), seul: suivi, cpSeul: cpPage, max: MAX_C3 });
  return { ok: true, lus, besoinNavigateur: besoin, pause: T.pausePublique(pauseConnue(b.pause)), arrete: !!(signal && signal.aborted) };
}

// ── C3 : CE QUE L'EXTENSION DOIT LIRE DEPUIS LE NAVIGATEUR ──────────────────
// SEULEMENT ce que le serveur n'a pas pu lire : un n° refusé (`bloque`), ou un
// transporteur en pause — Mondial Relay compris (avec son code postal, voie
// `VOIE_DE`, `mr-fr-mvc` : la même route, lue depuis le navigateur). 6 au plus.
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
  const t = b.transp.get(suivi) || null;
  // (29 oct., revue n° 19) La lecture est DATÉE par son `at` (quand le
  // navigateur l'a lue), borné : plus vieille que 30 min, ou que la dernière
  // lecture de la ligne ⇒ elle ne change rien (un colis retiré redevenait « à
  // retirer » sur une réponse lue avant le retrait). Sans `at` : maintenant.
  const ici = maintenant || Date.now();
  const atMs = Date.parse(String(x.at || ''));
  const now = Number.isFinite(atMs) ? Math.min(atMs, ici) : ici;
  if (ici - now > C4_AGE_MAX_MS) return { status: 409, corps: { error: 'perime' } };
  const luMs = Date.parse(String((t && t.lu) || ''));
  if (Number.isFinite(luMs) && now < luMs) return { status: 409, corps: { error: 'perime' } };
  // (29 oct., revue n° 18) Un ANCIEN n° jamais fermé (« fermeture ») se lit
  // UNE fois, SANS notification — par l'extension comme par le serveur : la
  // même règle (`suivisAInterroger`), jugée sur ce n° seul.
  const silence = raisonDu(b, carrier, suivi, ici) === 'fermeture';
  const voie = String(x.voie);
  // La voie relayée choisit l'analyseur : `mr-fr-mvc` (la route `_mvc`, écho
  // exigé) ou `mr-be` (l'API .be) — la même fonction que nos propres lectures.
  let lu = T.lireReponse(carrier, statut, ctype, x.corps, { suivi, cp, voie });
  let cpSource = '', cpEssaye = '';
  if (carrier === 'mondialrelay') {
    const connu = T.codePostalPourMondialRelay({ suivi, transp: t, lignes: b.lignes.filter((l) => suiviDeLigne(l) === suivi), manuels: b.manuels, relaisLieux: relaisDe(b)(suivi), prouves: [], maintenant: now, essai: false });
    if (connu && connu.cp === cp) cpSource = connu.source;
    else { cpSource = 'essai'; cpEssaye = cp; }
    // Pas encore prouvé pour CE colis : « pas de colis » ne veut pas dire « n°
    // inconnu » (la règle du serveur, `resultatMondialRelay`, revue n° 7).
    lu = T.resultatMondialRelay(lu, { cp, cpSource, cpEssaye, transp: t });
  }
  const r = await rangerEssai(b, { carrier, suivi }, lu, { source, statut, maintenant: now, silence, cp: lu.res === 'ok' ? cp : '', cpSource, cpEssaye, voie });
  if (r.ecrit === null) return { status: 503, corps: { error: 'pas-su' } };
  return { status: 200, corps: { ok: true, res: r.res, etat: r.etat, change: r.change } };
}
