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
// (15 nov., lot fiabilite-auto) Julien : « notification seulement si un même plantage touche
// 3 personnes ou plus, ou bloque l'ouverture ». Le reste se lit dans le rapport, sans bruit.
// Une « personne » = une empreinte DU JOUR (HMAC du vendeur et du jour, jamais un identifiant) ;
// le propriétaire de l'installation n'est jamais compté (api/_lib/mesures-terrain.js).
export const PERSONNES_MIN = 3;
// L'appareil, en deux mots et dans une liste FERMÉE (« iOS Safari ») : rien d'autre ne sort.
const RE_APPAREIL = /^(?:(iOS|Android|Mac|Windows) )?(Edge|Chrome|Firefox|Safari|autre)$/;
export const appareilAlerte = (v) => { const s = String(v == null ? '' : v).trim(); return RE_APPAREIL.test(s) ? s : ''; };
const bloquante = (origine) => origine === 'demarrage' || origine === 'ouverture';
// Un type à DIRE : il touche `PERSONNES_MIN` personnes ou plus ce jour-là, ou il bloque l'ouverture.
export const typeADire = (t) => !!t && ((Array.isArray(t.appareils) ? t.appareils.length : Number(t.appareils) || 0) >= PERSONNES_MIN || Number(t.bloque) > 0);

export const ecranAlerte = (v) => { const s = String(v || ''); const e = ECRANS.includes(s) ? s : s.split(':')[0]; return ECRANS.includes(e) ? e : ''; };
const garde = (origine) => origine === 'ecran' || origine === 'feuille';
// (16 nov., lot anti-bug) D'où vient l'erreur, dans une liste FERMÉE. `promesse` (un rejet que rien n'a
// rattrapé) et `morceau` (un morceau de l'app qui n'a pas pu se charger, rattrapé ou non) partent dès la
// PREMIÈRE fois, comme un écran tombé : avant, ils attendaient 3 répétitions (promesse) ou ne partaient
// jamais (morceau, compté seulement dans les temps réels) — le journal ne disait rien depuis le 12 nov.
export const ORIGINES = ['ecran', 'feuille', 'page', 'promesse', 'morceau', 'demarrage', 'ouverture', 'csp'];
export const origineAlerte = (v) => { const s = String(v == null ? '' : v); return ORIGINES.includes(s) ? s : ''; };
const tout_de_suite = (origine) => origine === 'promesse' || origine === 'morceau';
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
    // (15 nov.) l'ouverture bloquée, et l'appareil (liste fermée).
    bloque: (Number(avant.bloque) || 0) + (bloquante(String(e.origine || '')) ? 1 : 0), appareil: appareilAlerte(e.appareil) || avant.appareil || '',
    immediat: (Number(avant.immediat) || 0) + (tout_de_suite(String(e.origine || '')) ? 1 : 0), origine: origineAlerte(e.origine) || avant.origine || '',
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
    if (!(Number(x.garde) > 0) && !(Number(x.bloque) > 0) && !(Number(x.immediat) > 0) && n < REPETITION_MIN) continue;
    out.push({ cle, ecran: x.ecran || '', message: x.message, version: x.version || '', n: n - envoye, garde: Number(x.garde) > 0, bloque: Number(x.bloque) > 0, appareil: x.appareil || '', origine: x.origine || '' });
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
    out.push({ ecran: ecranAlerte(x.ecran), message, version: versionApp(x.version), n: Math.min(N_MAX, n), garde: x.garde === true,
      ...(x.bloque === true ? { bloque: true } : {}), ...(appareilAlerte(x.appareil) ? { appareil: appareilAlerte(x.appareil) } : {}),
      ...(origineAlerte(x.origine) ? { origine: origineAlerte(x.origine) } : {}) });
  }
  return out;
}

// ── LE SERVEUR : la ligne du jour ───────────────────────────────────────────
// data : { v, jour, rev, types: { [cle]: { message, ecrans:{}, versions:{}, n,
//          garde, appareils:[empreintes du jour], premier, dernier, notifie } },
//          contrib: { [empreinte]: n }, notifieA }
// (16 nov., lot anti-bug) `deProprio` : les plantages du PROPRIÉTAIRE de l'installation. Depuis le
// 15 nov. ils n'étaient rangés NULLE PART (« le propriétaire jamais compté ») : seul vendeur actif,
// Julien voyait des bugs et le journal restait vide. Ils sont rangés à part (`proprio` par type) :
// jamais une « personne touchée » (`appareils`), jamais une ouverture bloquée à dire, jamais notifiés.
export function jourApresEvenements(avant, evts, empreinte, maintenant = Date.now(), { deProprio = false } = {}) {
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
    if (deProprio) t.proprio = (Number(t.proprio) || 0) + e.n;
    if (e.origine) t.origines = { ...(t.origines && typeof t.origines === 'object' ? t.origines : {}), [e.origine]: ((t.origines && t.origines[e.origine]) || 0) + e.n };
    if (e.garde) t.garde = (Number(t.garde) || 0) + e.n;
    if (e.ecran) t.ecrans = { ...t.ecrans, [e.ecran]: ((t.ecrans && t.ecrans[e.ecran]) || 0) + e.n };
    if (e.version) t.versions = { ...t.versions, [e.version]: ((t.versions && t.versions[e.version]) || 0) + e.n };
    if (e.bloque && !deProprio) t.bloque = (Number(t.bloque) || 0) + e.n;
    if (e.appareil) { const nav = t.navigateurs && typeof t.navigateurs === 'object' ? t.navigateurs : {}; if (nav[e.appareil] || Object.keys(nav).length < 8) t.navigateurs = { ...nav, [e.appareil]: (nav[e.appareil] || 0) + e.n }; }
    const ap = Array.isArray(t.appareils) ? t.appareils : [];
    t.appareils = deProprio || ap.includes(empreinte) || ap.length >= APPAREILS_MAX_TYPE ? ap : [...ap, empreinte];
    t.dernier = at;
    types[cle] = t;
  }
  return { data: { v: 1, jour: d.jour, rev: (Number.isSafeInteger(d.rev) ? d.rev : 0) + 1, types, contrib, notifieA: d.notifieA || null } };
}

// Les types pas encore dits, et si l'heure de la notification groupée est venue.
// (15 nov., lot fiabilite-auto) Seul un type À DIRE (`typeADire` : ≥ 3 personnes, ou l'ouverture
// bloquée) attend une notification, et UNE fois par jour (`notifie` posé ⇒ dit). Les autres
// restent dans le rapport (Réglages → Tout va bien ? → Plantages chez les vendeurs).
export function alerteDue(data, maintenant = Date.now()) {
  const types = data && data.types && typeof data.types === 'object' ? data.types : {};
  const enAttente = Object.entries(types).filter(([, t]) => t && typeADire(t) && !((Number(t.notifie) || 0) > 0))
    .map(([cle, t]) => ({ cle, message: t.message, ecrans: Object.keys(t.ecrans || {}), n: Number(t.n) || 0, appareils: (t.appareils || []).length, garde: Number(t.garde) > 0, bloque: Number(t.bloque) > 0 }))
    .sort((a, b) => (b.bloque - a.bloque) || (b.appareils - a.appareils) || (b.n - a.n));
  const derniere = Date.parse((data && data.notifieA) || '') || 0;
  return { enAttente, due: enAttente.length > 0 && (!derniere || maintenant - derniere >= GROUPE_MS) };
}
// La ligne après l'envoi : chaque type DIT (à dire) le reste pour la journée ; les autres ne
// sont pas marqués (ils seront dits s'ils atteignent le seuil).
export function apresNotification(data, maintenant = Date.now()) {
  const types = {};
  for (const [k, t] of Object.entries((data && data.types) || {})) types[k] = typeADire(t) ? { ...t, notifie: Number(t.n) || 0 } : { ...t };
  return { ...data, types, notifieA: new Date(maintenant).toISOString(), rev: (Number.isSafeInteger(data.rev) ? data.rev : 0) + 1 };
}

// « VRM : 2 écrans ont planté chez des vendeurs depuis 1 h — Colis ×3 (2 appareils), Ventes ×1. »
// (15 nov.) « L'app ne s'ouvre plus chez 1 personne » / « Un plantage touche 4 personnes » ;
// le corps : où, combien de fois, où regarder (≤ 90 caractères).
export function texteAlerte(enAttente, nomEcran = (e) => e) {
  if (!enAttente || !enAttente.length) return null;
  const pers = (n) => `${n} personne${n > 1 ? 's' : ''}`;
  const t0 = enAttente[0];
  const ou = (t) => (t.ecrans.length ? t.ecrans.slice(0, 2).map(nomEcran).join(', ') : 'l’app');
  const title = enAttente.length > 1 ? `${enAttente.length} plantages chez des vendeurs`
    : t0.bloque ? `L’app ne s’ouvre plus chez ${pers(Math.max(1, t0.appareils))}` : `Un plantage touche ${pers(t0.appareils)}`;
  const corps = `${ou(t0)} ×${t0.n}${enAttente.length > 1 ? ` · +${enAttente.length - 1} autre${enAttente.length > 2 ? 's' : ''}` : ''}. Détail : Réglages → Tout va bien ?`;
  return { title: title.length <= 40 ? title : title.slice(0, 39) + '…', body: corps.length <= 90 ? corps : corps.slice(0, 89) + '…' };
}
