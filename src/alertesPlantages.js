// ════════════════════════════════════════════════════════════════════════════
//  L'ALERTE DE PLANTAGE POUR LE PROPRIÉTAIRE — LA RÈGLE (8 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Julien (8 nov., « des vendeurs vont payer ») : quand un écran tombe sur son
// garde-fou chez un vendeur, ou qu'une erreur se RÉPÈTE, il doit le savoir sans
// attendre la veille du lendemain matin — et sans recevoir une notification par
// erreur.
//
// Le chemin (rien de payant, §2.9 ; pas une 13ᵉ fonction) :
//   1. L'APPAREIL compte, par type d'erreur (la clé de la veille, `cleType` :
//      le message sans les noms minifiés ni les chiffres), chaque erreur que le
//      journal des plantages voit (src/plantages.js → `brancherAlertes`).
//   2. Un type devient un ÉVÉNEMENT quand l'écran est tombé sur son garde-fou
//      (origine « ecran » / « feuille ») ou quand il s'est répété
//      `REPETITION_MIN` fois. Il part ANONYME, avec le lot des temps réels
//      (src/mesuresCollecte.js, au plus une fois par minute) : l'écran (liste
//      fermée), le message nettoyé, la version de l'app, le nombre — rien
//      d'autre. Le jeton de session ne sert qu'à refuser un inconnu.
//   3. Le SERVEUR (api/_lib/alertes-plantages.js) additionne les événements du
//      jour chez le propriétaire de l'installation (`plantages_terrain_<jour>`,
//      le nombre d'appareils touchés tenu par l'empreinte DU JOUR des temps
//      réels, jamais un identifiant) et envoie UNE notification groupée au plus
//      par heure (`GROUPE_MS`), écrite AVANT d'envoyer.
// Module PUR : l'app, le serveur et l'audit l'exécutent tels quels (§11).
// ════════════════════════════════════════════════════════════════════════════
import { ECRANS, masquer, versionApp } from '../api/_lib/signalement.js';
import { nettoyer } from './plantages.js';
import { cleType } from '../api/_lib/veille-plantages.js';

export const REPETITION_MIN = 3;          // une erreur vue 3 fois « se répète »
export const TYPES_MAX_APPAREIL = 20;     // les types gardés sur l'appareil
export const EVENEMENTS_MAX_LOT = 10;     // par lot envoyé
export const N_MAX = 500;
export const GROUPE_MS = 3600e3;          // une notification groupée par heure au plus
export const TYPES_MAX_JOUR = 100;        // la ligne du jour reste petite
export const EVENEMENTS_MAX_APPAREIL_JOUR = 200;
export const APPAREILS_MAX_TYPE = 50;
export const PREFIXE_TERRAIN = 'plantages_terrain_';

export const ecranAlerte = (v) => { const s = String(v || ''); const e = ECRANS.includes(s) ? s : s.split(':')[0]; return ECRANS.includes(e) ? e : ''; };
const garde = (origine) => origine === 'ecran' || origine === 'feuille';
// Le message tel qu'il peut sortir : nettoyé (journal), masqué (signalement),
// puis `masque` (l'appareil : les jetons du mode stream).
export const messageAlerte = (m, masque) => {
  let t = String(m == null ? '' : m);
  if (typeof masque === 'function') { try { t = String(masque(t)); } catch (_) {} }
  return masquer(nettoyer(t)).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
};

// ── L'APPAREIL ──────────────────────────────────────────────────────────────
// `etat` : { [cle]: { message, ecran, version, n, garde, envoye, at } }.
export function compterErreur(etat, e, { maintenant = Date.now(), masque } = {}) {
  const out = etat && typeof etat === 'object' && !Array.isArray(etat) ? { ...etat } : {};
  const message = messageAlerte(e && e.message, masque);
  if (!message) return out;
  const cle = cleType(message);
  const avant = out[cle] && typeof out[cle] === 'object' ? out[cle] : { n: 0, garde: 0, envoye: 0 };
  out[cle] = {
    message, ecran: ecranAlerte(e.ecran) || avant.ecran || '', version: versionApp(e.version) || avant.version || '',
    n: Math.min(N_MAX, (Number(avant.n) || 0) + 1), garde: (Number(avant.garde) || 0) + (garde(String(e.origine || '')) ? 1 : 0),
    envoye: Math.min(Number(avant.envoye) || 0, N_MAX), at: new Date(maintenant).toISOString(),
  };
  const cles = Object.keys(out).sort((a, b) => String(out[b].at || '').localeCompare(String(out[a].at || ''))).slice(0, TYPES_MAX_APPAREIL);
  return Object.fromEntries(cles.map((k) => [k, out[k]]));
}
// Ce qui part : un écran tombé, ou une erreur vue `REPETITION_MIN` fois ; le
// nombre envoyé est ce qui est NOUVEAU depuis le dernier envoi.
export function evenementsAEnvoyer(etat) {
  const out = [];
  for (const [cle, x] of Object.entries(etat && typeof etat === 'object' ? etat : {})) {
    if (!x || typeof x !== 'object') continue;
    const n = Number(x.n) || 0, envoye = Number(x.envoye) || 0;
    if (n <= envoye) continue;
    if (!(Number(x.garde) > 0) && n < REPETITION_MIN) continue;
    out.push({ cle, ecran: x.ecran || '', message: x.message, version: x.version || '', n: n - envoye, garde: Number(x.garde) > 0 });
  }
  return normaliserEvenements(out.slice(0, EVENEMENTS_MAX_LOT)).map((ev, i) => ({ ...ev, cle: out[i].cle }));
}
export function apresEnvoi(etat, evts) {
  const out = etat && typeof etat === 'object' ? { ...etat } : {};
  for (const ev of evts || []) if (ev && out[ev.cle]) out[ev.cle] = { ...out[ev.cle], envoye: Number(out[ev.cle].n) || 0 };
  return out;
}

// ── LE FILTRE (l'app avant d'envoyer, le serveur avant de ranger) ───────────
// Seuls ces champs existent ; la clé est RECALCULÉE (jamais crue).
export function normaliserEvenements(liste) {
  if (!Array.isArray(liste)) return [];
  const out = [];
  for (const x of liste.slice(0, EVENEMENTS_MAX_LOT)) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) continue;
    const message = messageAlerte(x.message);
    const n = Number(x.n);
    if (!message || !Number.isInteger(n) || n < 1) continue;
    out.push({ ecran: ecranAlerte(x.ecran), message, version: versionApp(x.version), n: Math.min(N_MAX, n), garde: x.garde === true });
  }
  return out;
}

// ── LE SERVEUR : la ligne du jour ───────────────────────────────────────────
// data : { v, jour, rev, types: { [cle]: { message, ecrans:{}, versions:{}, n,
//          garde, appareils:[empreintes du jour], premier, dernier, notifie } },
//          contrib: { [empreinte]: n }, notifieA }
export function jourApresEvenements(avant, evts, empreinte, maintenant = Date.now()) {
  const d = avant && typeof avant === 'object' ? avant : {};
  const contrib = { ...(d.contrib && typeof d.contrib === 'object' ? d.contrib : {}) };
  const deja = Number(contrib[empreinte]) || 0;
  const somme = evts.reduce((a, e) => a + e.n, 0);
  if (deja + somme > EVENEMENTS_MAX_APPAREIL_JOUR) return { refus: 'plafond-du-jour' };
  contrib[empreinte] = deja + somme;
  const types = { ...(d.types && typeof d.types === 'object' ? d.types : {}) };
  const at = new Date(maintenant).toISOString();
  for (const e of evts) {
    const cle = cleType(e.message);
    const t = types[cle] && typeof types[cle] === 'object' ? { ...types[cle] } : (Object.keys(types).length >= TYPES_MAX_JOUR ? null : { message: e.message, ecrans: {}, versions: {}, n: 0, garde: 0, appareils: [], premier: at, notifie: 0 });
    if (!t) continue;
    t.n = (Number(t.n) || 0) + e.n;
    if (e.garde) t.garde = (Number(t.garde) || 0) + e.n;
    if (e.ecran) t.ecrans = { ...t.ecrans, [e.ecran]: ((t.ecrans && t.ecrans[e.ecran]) || 0) + e.n };
    if (e.version) t.versions = { ...t.versions, [e.version]: ((t.versions && t.versions[e.version]) || 0) + e.n };
    const ap = Array.isArray(t.appareils) ? t.appareils : [];
    t.appareils = ap.includes(empreinte) || ap.length >= APPAREILS_MAX_TYPE ? ap : [...ap, empreinte];
    t.dernier = at;
    types[cle] = t;
  }
  return { data: { v: 1, jour: d.jour, rev: (Number.isSafeInteger(d.rev) ? d.rev : 0) + 1, types, contrib, notifieA: d.notifieA || null } };
}

// Les types pas encore dits, et si l'heure de la notification groupée est venue.
export function alerteDue(data, maintenant = Date.now()) {
  const types = data && data.types && typeof data.types === 'object' ? data.types : {};
  const enAttente = Object.entries(types).filter(([, t]) => t && (Number(t.n) || 0) > (Number(t.notifie) || 0))
    .map(([cle, t]) => ({ cle, message: t.message, ecrans: Object.keys(t.ecrans || {}), n: (Number(t.n) || 0) - (Number(t.notifie) || 0), appareils: (t.appareils || []).length, garde: Number(t.garde) > 0 }))
    .sort((a, b) => b.n - a.n);
  const derniere = Date.parse((data && data.notifieA) || '') || 0;
  return { enAttente, due: enAttente.length > 0 && (!derniere || maintenant - derniere >= GROUPE_MS) };
}
// La ligne après l'envoi : chaque type « dit » jusqu'à son compte actuel.
export function apresNotification(data, maintenant = Date.now()) {
  const types = {};
  for (const [k, t] of Object.entries((data && data.types) || {})) types[k] = { ...t, notifie: Number(t.n) || 0 };
  return { ...data, types, notifieA: new Date(maintenant).toISOString(), rev: (Number.isSafeInteger(data.rev) ? data.rev : 0) + 1 };
}

// « VRM : 2 écrans ont planté chez des vendeurs depuis 1 h — Colis ×3 (2 appareils), Ventes ×1. »
export function texteAlerte(enAttente, nomEcran = (e) => e) {
  if (!enAttente || !enAttente.length) return null;
  const total = enAttente.reduce((a, t) => a + t.n, 0);
  const un = (t) => `${t.ecrans.length ? t.ecrans.slice(0, 2).map(nomEcran).join(', ') : 'l’app'} ×${t.n}${t.appareils > 1 ? ` (${t.appareils} appareils)` : ''}`;
  const tombe = enAttente.some((t) => t.garde);
  const quoi = enAttente.length === 1 ? (tombe ? 'un écran est tombé' : 'une erreur se répète') : `${enAttente.length} soucis`;
  // (8 nov.) Le titre dit le fait (≤ 40 caractères), le corps où regarder.
  return { title: `${quoi.charAt(0).toUpperCase() + quoi.slice(1)} chez des vendeurs`, body: `${total} fois — ${enAttente.slice(0, 3).map(un).join(' · ')}${enAttente.length > 3 ? ' …' : ''}. Détail : Réglages → Sécurité des données.` };
}
