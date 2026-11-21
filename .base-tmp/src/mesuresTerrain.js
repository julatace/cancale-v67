// ════════════════════════════════════════════════════════════════════════════
//  LA VRAIE EXPÉRIENCE, MESURÉE CHEZ LES VENDEURS — LA RÈGLE (6 nov., v36)
// ════════════════════════════════════════════════════════════════════════════
// Nos bancs mesurent l'app sur un Chromium de banc. Ce que vit un vendeur sur
// SON iPhone en 4G, personne ne le savait. Ici : quatre mesures, par écran et
// par type d'appareil, ANONYMES et AGRÉGÉES dès l'appareil :
//   · `peu`     — le temps jusqu'au PREMIER ÉCRAN UTILE (ms) : depuis le début
//                 du chargement (première ouverture) ou le toucher qui change
//                 d'écran, jusqu'à ce que l'écran montre son contenu (plus de
//                 « chargement » visible) ;
//   · `inp`     — l'interaction la plus lente de la visite d'un écran (ms,
//                 Event Timing : le temps entre le toucher et l'image suivante) ;
//   · `cls`     — le décalage de mise en page de la visite (fenêtres de session,
//                 la définition des Web Vitals) ;
//   · `morceau` — un morceau de l'app qui n'a pas pu se charger (un compte).
// Un navigateur qui ne sait pas mesurer (`inp` et `cls` sur Safari) n'envoie
// RIEN pour cette mesure — jamais un 0 (« pas su » ≠ « rien », §5).
//
// ⚠️ CE QUI SORT DE L'APPAREIL : uniquement des COMPTES dans des cases fixes
//    (histogrammes) sous trois clés FERMÉES — un nom d'écran de l'app (liste
//    `ECRANS`, la même que « Signaler un problème »), un type d'appareil
//    (`telephone` · `tablette` · `ordinateur`) et un nom de mesure. Aucune chaîne
//    libre, aucune date, aucune adresse, aucun identifiant : `normaliserLot` (la
//    MÊME fonction pour l'app et le serveur, §11) jette tout le reste. Le jeton
//    de session n'accompagne le lot que pour que le serveur refuse un inconnu ;
//    il n'est jamais rangé.
// Le serveur range des AGRÉGATS JOURNALIERS (jour de Paris), additionnés case à
// case : la médiane, le p75 et le p95 se lisent sur l'histogramme
// (`percentile`, interpolé dans la case). Rien ne permet de retrouver qui.
// Module PUR (aucun accès au navigateur) : `scripts/audit-mesures-terrain.cjs`
// l'exécute, l'app (src/mesuresCollecte.js) et le serveur
// (api/_lib/mesures-terrain.js) l'importent.
import { ECRANS } from '../api/_lib/signalement.js';
import { jourParis as jourParisRegle } from './dateParis.js';

export { ECRANS };
export const VERSION_LOT = 1;
export const METRIQUES = ['peu', 'inp', 'cls', 'morceau'];
export const APPAREILS = ['telephone', 'tablette', 'ordinateur'];
// Les cases (bornes HAUTES, la dernière est ouverte). Des temps en ms ; le CLS
// sans unité. Les seuils des Web Vitals (INP 200/500 ms, CLS 0,1/0,25, un
// premier affichage à 2,5/4 s) tombent sur une borne.
export const BORNES_MS = [50, 100, 150, 200, 250, 300, 400, 500, 650, 800, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000, 6500, 8000, 10000, 15000, 20000, 30000];
export const BORNES_CLS = [0.01, 0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.35, 0.5, 0.75, 1, 1.5];
export const bornesDe = (m) => (m === 'cls' ? BORNES_CLS : m === 'morceau' ? [1] : BORNES_MS);
export const nbCases = (m) => bornesDe(m).length + 1;
// L'envoi : au plus une fois par minute, un lot borné.
export const ENVOI_MIN_MS = 60000;
export const MESURES_MAX_PAR_LOT = 400;
export const COMPTE_MAX_PAR_CASE = 400;
// Le serveur : au plus autant de lots par jour et par appareil-vendeur (un lot
// par minute pendant 10 h).
export const LOTS_MAX_JOUR = 600;
// La veille : un p75 qui monte de plus de 30 % d'un jour à l'autre, sur assez
// de mesures les deux jours pour que ce ne soit pas du hasard.
export const SEUIL_DEGRADATION = 0.30;
export const MESURES_MIN_VEILLE = 20;

export const ecranValide = (v) => (ECRANS.includes(String(v || '')) ? String(v) : '');
export const appareilValide = (v) => (APPAREILS.includes(String(v || '')) ? String(v) : '');
export const metriqueValide = (v) => (METRIQUES.includes(String(v || '')) ? String(v) : '');
export const cleCase = (ecran, appareil, metrique) => `${ecran}|${appareil}|${metrique}`;
export function lireCle(k) {
  const p = String(k || '').split('|');
  if (p.length !== 3) return null;
  const [e, a, m] = p;
  return ecranValide(e) && appareilValide(a) && metriqueValide(m) ? { ecran: e, appareil: a, metrique: m } : null;
}

// Le type d'appareil, en trois mots : la largeur de l'écran et le doigt.
export function typeAppareil({ largeur, tactile }) {
  const l = Number(largeur) || 0;
  if (tactile && l > 0 && l < 600) return 'telephone';
  if (tactile && l >= 600 && l < 1100) return 'tablette';
  return 'ordinateur';
}

// La case d'une valeur, ou -1 (valeur absurde ⇒ rien).
export function caseDe(metrique, valeur) {
  if (metrique === 'morceau') return 0;
  const v = Number(valeur);
  if (!Number.isFinite(v) || v < 0) return -1;
  if (metrique !== 'cls' && v > 10 * 60000) return -1;   // plus de 10 min : pas une mesure
  if (metrique === 'cls' && v > 50) return -1;
  const b = bornesDe(metrique);
  for (let i = 0; i < b.length; i++) if (v <= b[i]) return i;
  return b.length;
}

// Un lot vide : { v, h: { '<écran>|<appareil>|<mesure>': [comptes…] } }.
export const lotVide = () => ({ v: VERSION_LOT, h: {} });
export const totalLot = (lot) => Object.values((lot && lot.h) || {}).reduce((s, l) => s + (Array.isArray(l) ? l.reduce((a, b) => a + (Number(b) || 0), 0) : 0), 0);
// Ajoute une mesure (le lot est modifié et rendu). Une clé inconnue, une valeur
// absurde ou un lot plein ⇒ rien.
export function ajouterMesure(lot, ecran, appareil, metrique, valeur) {
  if (!lot || typeof lot !== 'object') return lot;
  const e = ecranValide(ecran), a = appareilValide(appareil), m = metriqueValide(metrique);
  if (!e || !a || !m) return lot;
  const i = caseDe(m, valeur);
  if (i < 0) return lot;
  if (totalLot(lot) >= MESURES_MAX_PAR_LOT) return lot;
  if (!lot.h || typeof lot.h !== 'object') lot.h = {};
  const k = cleCase(e, a, m);
  const l = Array.isArray(lot.h[k]) && lot.h[k].length === nbCases(m) ? lot.h[k] : new Array(nbCases(m)).fill(0);
  l[i] = Math.min(COMPTE_MAX_PAR_CASE, (Number(l[i]) || 0) + 1);
  lot.h[k] = l;
  return lot;
}

// LE FILTRE (§11 : l'app avant d'envoyer, le serveur avant de ranger). Ne garde
// que des clés fermées et des entiers bornés ; rend `null` si rien ne reste.
// Idempotent. Aucune autre propriété du corps ne passe.
export function normaliserLot(corps) {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) return null;
  const h = corps.h;
  if (!h || typeof h !== 'object' || Array.isArray(h)) return null;
  const out = {}; let total = 0;
  for (const [k, l] of Object.entries(h).slice(0, 400)) {
    const c = lireCle(k);
    if (!c || !Array.isArray(l) || l.length !== nbCases(c.metrique)) continue;
    const propre = l.map((x) => (Number.isInteger(x) && x >= 0 && x <= COMPTE_MAX_PAR_CASE ? x : 0));
    const s = propre.reduce((a, b) => a + b, 0);
    if (!s) continue;
    if (total + s > MESURES_MAX_PAR_LOT) break;
    total += s;
    out[cleCase(c.ecran, c.appareil, c.metrique)] = propre;
  }
  return Object.keys(out).length ? { v: VERSION_LOT, h: out } : null;
}

// Additionne un lot (normalisé) dans les histogrammes d'un jour.
export function fusionnerHisto(h, lot) {
  const out = {};
  for (const [k, l] of Object.entries(h && typeof h === 'object' ? h : {})) {
    const c = lireCle(k); if (!c || !Array.isArray(l) || l.length !== nbCases(c.metrique)) continue;
    out[k] = l.map((x) => (Number.isInteger(x) && x >= 0 ? x : 0));
  }
  for (const [k, l] of Object.entries((lot && lot.h) || {})) {
    const c = lireCle(k); if (!c) continue;
    const base = out[k] || new Array(nbCases(c.metrique)).fill(0);
    out[k] = base.map((x, i) => x + (Number(l[i]) || 0));
  }
  return out;
}

// Le quantile `q` (0..1) d'un histogramme, interpolé linéairement dans la case
// (la case 0 commence à 0 ; la dernière, ouverte, rend sa borne basse : « au
// moins »). `null` sans mesure.
export function percentile(comptes, bornes, q) {
  const n = (comptes || []).reduce((a, b) => a + (Number(b) || 0), 0);
  if (!n) return null;
  const rang = q * n;
  let cumul = 0;
  for (let i = 0; i < comptes.length; i++) {
    const c = Number(comptes[i]) || 0;
    if (!c) continue;
    if (cumul + c >= rang) {
      const bas = i === 0 ? 0 : bornes[i - 1];
      if (i >= bornes.length) return bas;
      const haut = bornes[i];
      const f = Math.min(1, Math.max(0, (rang - cumul) / c));
      return bas + (haut - bas) * f;
    }
    cumul += c;
  }
  return bornes[bornes.length - 1];
}

// Les agrégats d'un jour, ligne par ligne : { ecran, appareil, metrique, n,
// p50, p75, p95 } (un `morceau` porte seulement `n`). Triés écran puis appareil.
export function resumeJour(h) {
  const L = [];
  for (const [k, l] of Object.entries(h && typeof h === 'object' ? h : {})) {
    const c = lireCle(k); if (!c || !Array.isArray(l)) continue;
    const n = l.reduce((a, b) => a + (Number(b) || 0), 0);
    if (!n) continue;
    if (c.metrique === 'morceau') { L.push({ ...c, n }); continue; }
    const b = bornesDe(c.metrique);
    const r = (q) => { const v = percentile(l, b, q); return v == null ? null : c.metrique === 'cls' ? Math.round(v * 1000) / 1000 : Math.round(v); };
    L.push({ ...c, n, p50: r(0.5), p75: r(0.75), p95: r(0.95) });
  }
  return L.sort((a, b) => (a.ecran + a.appareil + a.metrique).localeCompare(b.ecran + b.appareil + b.metrique));
}

// Le jour de Paris (AAAA-MM-JJ) d'un instant.
export function jourParis(ms) {
  try {
    const p = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
    return /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : jourParisRegle(ms);
  } catch (_) { return jourParisRegle(ms); }
}

// Les écrans qui se DÉGRADENT d'un jour à l'autre : le p75 d'hier dépasse de
// plus de `seuil` celui d'avant-hier, chaque jour avec au moins `nMin` mesures
// (un écran à 3 mesures n'alerte personne). Le premier écran utile et
// l'interaction (le CLS n'a pas d'unité de temps : il n'alerte pas ici).
export function degradations(hAvant, hHier, { seuil = SEUIL_DEGRADATION, nMin = MESURES_MIN_VEILLE } = {}) {
  const avant = new Map(resumeJour(hAvant).map((x) => [cleCase(x.ecran, x.appareil, x.metrique), x]));
  const out = [];
  for (const x of resumeJour(hHier)) {
    if (x.metrique !== 'peu' && x.metrique !== 'inp') continue;
    const a = avant.get(cleCase(x.ecran, x.appareil, x.metrique));
    if (!a || a.n < nMin || x.n < nMin || !(a.p75 > 0) || x.p75 == null) continue;
    const hausse = (x.p75 - a.p75) / a.p75;
    if (hausse > seuil) out.push({ ecran: x.ecran, appareil: x.appareil, metrique: x.metrique, avant: a.p75, apres: x.p75, hausse: Math.round(hausse * 100) });
  }
  return out.sort((a, b) => b.hausse - a.hausse);
}

export const NOM_APPAREIL = { telephone: 'téléphone', tablette: 'tablette', ordinateur: 'ordinateur' };
export const NOM_METRIQUE = { peu: 'premier écran utile', inp: 'réponse au toucher', cls: 'décalage', morceau: 'morceaux pas chargés' };
const secondes = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1).replace('.', ',')} s` : `${Math.round(ms)} ms`);
// « VRM : Colis plus lent sur téléphone (premier écran utile p75 1,2 s → 1,8 s, +50 %). »
export function texteLenteurs(liste, nomEcran = (e) => e) {
  if (!liste || !liste.length) return null;
  const un = (d) => `${nomEcran(d.ecran)} sur ${NOM_APPAREIL[d.appareil] || d.appareil} (${NOM_METRIQUE[d.metrique]} p75 ${secondes(d.avant)} → ${secondes(d.apres)}, +${d.hausse}\u00a0%)`;
  if (liste.length === 1) return { title: 'VRM', body: `VRM : plus lent hier — ${un(liste[0])}.` };
  return { title: 'VRM', body: `VRM : ${liste.length} écrans plus lents hier — ${liste.slice(0, 3).map(un).join(' · ')}${liste.length > 3 ? ' …' : ''}.` };
}
