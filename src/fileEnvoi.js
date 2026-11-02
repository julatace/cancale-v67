// ══════════════════════════════════════════════════════════════════════════════
//  LA FILE D'ENVOI — RIEN NE SE PERD SI LE RÉSEAU COUPE (2 nov. 2026)
// ══════════════════════════════════════════════════════════════════════════════
// Demande de Julien : « Rien ne se perd si le réseau coupe : une saisie (prix
// d'achat, N°, note) faite sans réseau est gardée et envoyée au retour, avec
// "en attente d'envoi" affiché. » (iPhone, 4G.)
//
// MESURÉ sur `main` (banc `scripts/bancs/hors-ligne.cjs`, build d'avant) : la
// saisie restait bien dans le navigateur et `cloudPush` la retentait tant que
// l'app restait OUVERTE. Mais `_baseNuage` (ce que l'appareil et le nuage
// savaient ENSEMBLE) ne vivait qu'en mémoire : l'app fermée (iOS tue la PWA) puis
// rouverte avec le réseau, le chargement RECOPIAIT le nuage par-dessus le
// navigateur — le prix d'achat tapé pendant la coupure disparaissait sans un mot
// (les fiches gardaient le nuage dès que les deux portaient un numéro).
//
// La file garde, PAR CLÉ synchronisée touchée et pas encore acceptée par le
// nuage, la BASE de la fusion (la valeur que l'appareil et le nuage partageaient
// avant le geste), l'heure du dernier geste et un numéro de passage (`seq`).
// Au retour (prochain envoi, `online`, premier plan, prochain chargement), la
// clé passe par LA fusion de `src/fusionNuage.js` (`fusionnerLigne` : clé par
// clé, sous-clé par sous-clé, les refus des numéros) et l'écriture reste le
// comparer-et-échanger sur `data.rev` de `cloudPush`. Jamais un écrasement.
//   · « pas su » ≠ « envoyé » : une entrée ne sort de la file que sur une
//     écriture ACCEPTÉE (ou une relecture qui montre le nuage déjà égal) — et
//     seulement si aucun geste n'est venu entre-temps (même `seq`) ;
//   · envoyée en fait mais sans réponse : à la reprise, le nuage porte déjà la
//     valeur ⇒ la fusion à trois voies ne change rien, aucune liste ne double ;
//   · une sous-valeur changée DES DEUX CÔTÉS : si le nuage a été écrit APRÈS le
//     dernier geste de la file (`updated_at` de la ligne, posé par l'écrivain),
//     le nuage gagne — la valeur plus récente d'un autre appareil n'est jamais
//     réécrite ; sinon le geste de l'appareil (la règle d'avant) ;
//   · une lecture de la file ratée n'écrit RIEN (§4) ; une file d'un AUTRE
//     vendeur (même navigateur) n'est jamais appliquée.
// Les NUMÉROS (§5) : la file ne rejoue jamais un numéro sans relire le pool —
// la fusion des fiches se fait contre le pool LU dans le nuage, avec ses trois
// refus ; un refus laisse la règle du chargement d'avant décider des numéros
// (`fusionNumerosAuChargement`) et ne garde de la file que les AUTRES champs
// (prix, notes), jamais un numéro.
//
// Module PUR (le stockage est passé en paramètre) : exécuté tel quel par
// `scripts/audit-file-envoi.cjs`.

import { fusionnerLigne, egal, CLE_POOL, CLES_FICHES, CLE_SERVEUR } from './fusionNuage.js';

export const CLE_FILE = 'vrm_file_envoi';
// Les clés qui n'entrent jamais dans la file : la copie du nuage de
// `vinted_accounts` est sans jetons (l'appareil garde la sienne) ; le marqueur de
// numérotation est écrit par le serveur seul.
export const HORS_FILE = ['vinted_accounts', CLE_SERVEUR];
// Les champs d'une fiche qui portent son NUMÉRO : jamais rejoués hors de la
// fusion des numéros.
export const CHAMPS_NUMERO = ['numero', 'numberedAt', 'auto', 'manuelAt', 'reattribue', 'repriseDe'];

const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Rend { cles } (la file de CE vendeur), {} si vide, ou `null` = PAS SU (le
// stockage refuse la lecture) — l'appelant n'écrit alors rien.
export const lireFile = (stock, owner) => {
  let t;
  try { t = stock.getItem(CLE_FILE); } catch (_) { return null; }
  if (t == null) return { owner, cles: {} };
  let o; try { o = JSON.parse(t); } catch (_) { o = null; }
  if (!estObjet(o) || o.v !== 1 || !estObjet(o.cles)) return { owner, cles: {}, abimee: true };
  if (owner && o.owner && o.owner !== owner) return { owner, cles: {}, autre: o.owner };
  return { owner: o.owner || owner, cles: o.cles };
};
const ecrireFile = (stock, f) => {
  try {
    if (!Object.keys(f.cles).length) stock.removeItem(CLE_FILE);
    else stock.setItem(CLE_FILE, JSON.stringify({ v: 1, owner: f.owner, cles: f.cles }));
    return true;
  } catch (_) { return false; }
};

// Un geste vient d'être gardé dans le navigateur pour la clé `k`. `base` = ce
// que l'appareil et le nuage partageaient (undefined = la clé n'y était pas).
// Une clé déjà en attente GARDE sa base d'origine (celle de la première saisie
// pas envoyée). Rend true si la file est écrite.
export const noterSaisie = (stock, owner, k, base, maintenant = Date.now()) => {
  if (!owner || HORS_FILE.includes(k)) return false;
  const f = lireFile(stock, owner);
  if (!f || f.autre) return false;   // pas su, ou la file d'un autre vendeur : on n'y touche pas
  const e = f.cles[k];
  const seq = (e && Number.isSafeInteger(e.seq) ? e.seq : 0) + 1;
  f.cles[k] = e ? { ...e, at: maintenant, seq } : { ...(base === undefined ? { sans: true } : { base }), at: maintenant, seq };
  f.owner = owner;
  return ecrireFile(stock, f);
};

// L'instantané pris AVANT un envoi : { k: seq }.
export const instantane = (stock, owner) => {
  const f = lireFile(stock, owner); if (!f) return null;
  const out = {}; for (const k in f.cles) out[k] = f.cles[k].seq; return out;
};
// L'envoi est ACCEPTÉ (ou le nuage est déjà égal) : les entrées qui n'ont pas
// bougé depuis l'instantané sortent. `cles` limite aux clés vérifiées. Rend le
// nombre d'entrées sorties.
export const acquitter = (stock, owner, inst, cles = null) => {
  if (!inst) return 0;
  const f = lireFile(stock, owner); if (!f || f.autre) return 0;
  let n = 0;
  for (const k of Object.keys(f.cles)) {
    if (cles && !cles.includes(k)) continue;
    if (k in inst && f.cles[k].seq === inst[k]) { delete f.cles[k]; n++; }
  }
  if (n) ecrireFile(stock, f);
  return n;
};
export const viderFile = (stock) => { try { stock.removeItem(CLE_FILE); } catch (_) {} };
export const oublierCle = (stock, owner, k) => {
  const f = lireFile(stock, owner); if (!f || f.autre || !(k in f.cles)) return;
  delete f.cles[k]; ecrireFile(stock, f);
};

const baseDe = (e) => (e && !e.sans ? e.base : undefined);
const lireLocal = (stock, k) => { let t; try { t = stock.getItem(k); } catch (_) { return undefined; } if (t == null) return undefined; try { return JSON.parse(t); } catch (_) { return t; } };

// Les clés PUBLIÉES par un écran (§11 : un chiffre calculé, un jeton généré) :
// elles partent avec la file comme le reste, mais ne sont pas des « changements »
// qu'il a faits — on ne les compte pas à l'écran (« 1 changement » quand il a
// tapé un prix, pas « 41 »).
export const CLES_PUBLIEES = ['vinted_urssaf_mois', 'vrm_colis_retirer', 'vrm_benefice_jours', 'vrm_paires_dorment', 'vinted_annonces_email_sold', 'vrm_widget_token', 'vrm_agent_ebay_resume', 'vrm_agent_ebay_jour'];
const vide = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || (estObjet(v) && !Object.keys(v).length);
const memeValeur = (a, b) => (vide(a) && vide(b)) || egal(a, b);
// Un élément de liste : un nombre et sa chaîne sont le même (« 12 » = 12, le pool).
const cleElement = (v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v));

// Combien de changements attendent (ce qu'on dit à l'écran) : par clé, le
// nombre de sous-valeurs (une fiche, un N°, un colis) qui diffèrent de la base ;
// une valeur simple compte pour un. Une clé revenue à sa base ne compte pas.
export const compterEnAttente = (stock, owner) => {
  const f = lireFile(stock, owner); if (!f) return null;
  let n = 0;
  for (const k in f.cles) {
    if (CLES_PUBLIEES.includes(k)) continue;
    const b = baseDe(f.cles[k]), l = lireLocal(stock, k);
    if (memeValeur(b, l)) continue;
    if (estObjet(b) || estObjet(l)) {
      const bo = estObjet(b) ? b : {}, lo = estObjet(l) ? l : {};
      let m = 0; for (const i of new Set([...Object.keys(bo), ...Object.keys(lo)])) if (!memeValeur(bo[i], lo[i])) m++;
      n += m;
    } else if (Array.isArray(b) || Array.isArray(l)) {
      const s = (x) => new Set((Array.isArray(x) ? x : []).map(cleElement));
      const sb = s(b), sl = s(l); let m = 0;
      for (const v of sl) if (!sb.has(v)) m++;
      for (const v of sb) if (!sl.has(v)) m++;
      n += m;
    } else n++;
  }
  return n;
};

// Les clés de la file dont le nuage a été écrit APRÈS le dernier geste : sur
// une sous-valeur changée des deux côtés, le nuage gagne (`nuageGagne`).
export const nuagePlusRecent = (file, majNuage) => {
  const t = majNuage ? Date.parse(majNuage) : NaN;
  if (!file || !Number.isFinite(t)) return [];
  return Object.keys(file.cles).filter((k) => Number.isFinite(file.cles[k].at) && t > file.cles[k].at);
};

// La base de la fusion pour `cloudPush` / `relireNuage` : celle de la mémoire
// (`_baseNuage`) sauf pour une clé en attente, dont la base est celle de la file
// (la mémoire a pu être remise au nuage par un chargement).
export const baseAvecFile = (baseMemoire, file) => {
  const out = { ...(estObjet(baseMemoire) ? baseMemoire : {}) };
  if (file) for (const k in file.cles) { const e = file.cles[k]; if (e.sans) delete out[k]; else out[k] = e.base; }
  return out;
};

// AU CHARGEMENT : le nuage vient d'être lu (`nuage`, `majNuage`), le navigateur
// porte `local` (lu AVANT que le chargement ne le réécrive). Pour chaque clé en
// attente, la valeur à garder dans le navigateur — par la fusion de
// `fusionnerLigne`, jamais le nuage recopié par-dessus.
//   options : `numerosOk` = l'appareil et le nuage sont dans la même version de
//   numérotation (sinon les fiches et le pool gardent le nuage, §5 013) ;
//   `sansFiches` = rechargement d'un écran périmé (ses fiches ne fusionnent pas).
// Rend { vals: { k: valeur }, conflits: [k], ecartees: [k] }.
export const fusionAuChargement = ({ file, local, nuage, majNuage, cleNum, numerosOk = true, sansFiches = false }) => {
  const vals = {}, conflits = [], ecartees = [];
  if (!file) return { vals, conflits, ecartees };
  const L = estObjet(local) ? local : {}, N = estObjet(nuage) ? nuage : {};
  const recents = nuagePlusRecent(file, majNuage);
  for (const k of Object.keys(file.cles)) {
    if (HORS_FILE.includes(k)) { ecartees.push(k); continue; }
    const numerique = k === CLE_POOL || k === 'vinted_annonce_numeros';
    if (numerique && (!numerosOk || (sansFiches && k === 'vinted_annonce_numeros'))) { ecartees.push(k); continue; }
    // Le pool : l'union (jamais un numéro retiré) — la règle du chargement le fait déjà.
    if (k === CLE_POOL) continue;
    const b = baseDe(file.cles[k]);
    const cles = CLES_FICHES.includes(k) ? [k, CLE_POOL] : [k];
    const base = { [k]: b, [CLE_POOL]: file.cles[CLE_POOL] ? baseDe(file.cles[CLE_POOL]) : L[CLE_POOL] };
    const r = fusionnerLigne({ cles, base, local: L, nuage: N, cleNum, nuageGagne: recents });
    if (r.conflit) {
      // Les numéros se refusent : le nuage et la règle du chargement d'avant
      // décident des NUMÉROS ; les autres champs de la file (prix, notes) sont
      // rejoués fiche par fiche, à trois voies, sans aucun champ de numéro.
      conflits.push(k);
      vals[k] = rejouerSansNumeros(b, L[k], N[k], recents.includes(k));
      continue;
    }
    vals[k] = r.data[k];
  }
  return { vals, conflits, ecartees };
};
// Fiches (ou ventes) : chaque champ hors numéro, à trois voies ; une fiche que
// le nuage n'a pas n'est PAS créée ici (elle porte un numéro : la règle du
// chargement la juge).
export const rejouerSansNumeros = (b, l, n, nuageGagne = false) => {
  const bo = estObjet(b) ? b : {}, lo = estObjet(l) ? l : {}, no = estObjet(n) ? n : {};
  const out = { ...no };
  for (const id of Object.keys(no)) {
    const lf = estObjet(lo[id]) ? lo[id] : null; if (!lf) continue;
    const bf = estObjet(bo[id]) ? bo[id] : {}, nf = no[id];
    if (!estObjet(nf)) continue;
    const f = { ...nf };
    for (const c of new Set([...Object.keys(lf), ...Object.keys(bf)])) {
      if (CHAMPS_NUMERO.includes(c)) continue;
      if (egal(lf[c], bf[c])) continue;              // pas touché ici
      if (!egal(nf[c], bf[c]) && nuageGagne) continue; // touché là-bas, plus tard
      if (lf[c] === undefined) delete f[c]; else f[c] = lf[c];
    }
    out[id] = f;
  }
  return out;
};
