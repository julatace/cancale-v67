// ═══════════════════════════════════════════════════════════════════════════
// « VITESSE D'ENVOI » (10 nov., lot BM) — le temps entre la vente et le dépôt
// ═══════════════════════════════════════════════════════════════════════════
// Julien (validé le 10 nov., peu de texte, du visuel) : combien de temps il met
// à envoyer, par compte, sur 30 jours ; la médiane et « sur N colis » ; des
// dates PROUVÉES seulement.
//
// Ce module NE RE-DÉCIDE RIEN (§5, une règle par notion) :
//   · le DÉPART d'une vente est la règle unique `raisonDepartVente`
//     (api/_lib/depart-vente.js, `partisVinted` dans l'app : Colis fait / scan,
//     panneau de l'extension, e-mail du n° EXACT de son bordereau, prise en
//     charge lue chez le transporteur) — la Map tx → raison est passée telle
//     quelle ;
//   · la date de la vente est `tsCommande` (la date de la commande Vinted).
// Une raison SANS date (« expédié à la main » : aucun horodatage) ou une date
// AVANT la vente (au-delà de la tolérance de la règle du départ) ne donne pas
// de délai : la vente compte dans « sans date de dépôt prouvée », NOMMÉE —
// jamais devinée, jamais comptée à zéro. Une vente annulée, une conversation,
// une vente encore à envoyer ne sont pas des colis : elles ne comptent pas.
//
// Publication (un propriétaire : l'écran qui calcule `partisVinted` ; des
// lecteurs : Statistiques, Ma semaine) : `vrm_vitesse_envoi` (localStorage de
// l'appareil, estampillé du compte VRM) — la même forme que `vrm_sources_ventes`.
// Module PUR hors publier/lire. Exécuté par scripts/audit-vitesse-avis.cjs.

import { TOLERANCE_AVANT_VENTE_MS } from '../api/_lib/depart-colis.js';

const str = (v) => String(v == null ? '' : v);
export const JOURS_VITESSE = 30;
const H = 3600000, J = 24 * H;

// ── UNE LIGNE PAR VENTE PARTIE ──────────────────────────────────────────────
// ventes : les ventes Vinted (forme de « Mes ventes ») ;
// partis : Map tx → raison (`ventesPartiesParPreuve`) ;
// estAnnulee(o), estPartie(o) : les règles de l'écran (annulée ; partie d'après
//   Vinted OU par une preuve) ; compteDe(o) → { cle, nom }.
// Rend [{ tx, compte, nom, vente, depart|null, type }].
export function lignesVitesse({ ventes, partis, estAnnulee = () => false, estPartie = () => false, compteDe = () => ({ cle: '', nom: '' }) } = {}) {
  if (!Array.isArray(ventes)) return null;
  const m = partis instanceof Map ? partis : new Map();
  const out = [], vus = new Set();
  for (const o of ventes) {
    if (!o || o.transaction_id == null) continue;
    const tx = str(o.transaction_id);
    if (vus.has(tx)) continue;
    vus.add(tx);
    if (!str(o.status).trim()) continue;                 // une conversation n'est pas une vente
    if (estAnnulee(o)) continue;
    const vente = Date.parse(str(o.date));
    if (!Number.isFinite(vente)) continue;
    const r = m.get(tx) || null;
    if (!r && !estPartie(o)) continue;                   // encore à envoyer : pas un colis
    let depart = r && Number.isFinite(Number(r.at)) && r.at != null ? Number(r.at) : null;
    if (depart != null && depart < vente - TOLERANCE_AVANT_VENTE_MS) depart = null;   // contredit la vente
    const c = compteDe(o) || {};
    out.push({ tx, compte: str(c.cle), nom: str(c.nom || c.cle), vente, depart, type: r ? str(r.type) : '' });
  }
  return out;
}

const mediane = (xs) => {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b), k = s.length >> 1;
  return s.length % 2 ? s[k] : Math.round((s[k - 1] + s[k]) / 2);
};

// ── PAR COMPTE, SUR 30 JOURS ────────────────────────────────────────────────
// lignes : `lignesVitesse` (null = pas su) ; la fenêtre porte sur la date de la
// VENTE (les 30 derniers jours). Un délai négatif dans la tolérance vaut 0.
// Rend { etat: 'lu'|'passu', comptes: [{ cle, nom, n, mediane, moyenne, sansDate }],
//        tout: { n, mediane, moyenne, sansDate } }.
export function vitesseParCompte(lignes, { maintenant = Date.now(), jours = JOURS_VITESSE } = {}) {
  if (!Array.isArray(lignes)) return { etat: 'passu', comptes: [], tout: { n: 0, mediane: null, moyenne: null, sansDate: 0 } };
  const de = maintenant - jours * J;
  const g = new Map(), tous = [];
  let sansDateTout = 0;
  for (const l of lignes) {
    if (!l || !Number.isFinite(l.vente) || l.vente < de || l.vente > maintenant) continue;
    const k = str(l.compte);
    const e = g.get(k) || { cle: k, nom: str(l.nom || k), d: [], sansDate: 0 };
    if (Number.isFinite(l.depart)) { const d = Math.max(0, l.depart - l.vente); e.d.push(d); tous.push(d); }
    else { e.sansDate++; sansDateTout++; }
    g.set(k, e);
  }
  const resume = (d, sansDate) => ({ n: d.length, mediane: mediane(d), moyenne: d.length ? Math.round(d.reduce((s, x) => s + x, 0) / d.length) : null, sansDate });
  const comptes = [...g.values()].map((e) => ({ cle: e.cle, nom: e.nom, ...resume(e.d, e.sansDate) }))
    .sort((a, b) => (a.mediane == null) - (b.mediane == null) || (a.mediane || 0) - (b.mediane || 0) || b.n - a.n || a.nom.localeCompare(b.nom));
  return { etat: 'lu', comptes, tout: resume(tous, sansDateTout) };
}

// « 18 h », « 1 j 4 h », « 3 j » ; moins d'une heure ⇒ « < 1 h » ; null ⇒ « — ».
export function texteDuree(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms < H) return '< 1 h';
  const h = Math.round(ms / H);
  if (h < 24) return `${h} h`;
  const j = Math.floor(h / 24), r = h % 24;
  if (j >= 4 || r === 0) return `${Math.round(ms / J)} j`;
  return `${j} j ${r} h`;
}
const pl = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
// La phrase de couverture, d'une seule source : « sur 12 colis » (+ « 2 sans date de dépôt prouvée »).
export function texteCouvertureVitesse(x) {
  if (!x) return '';
  const sur = `sur ${pl(x.n, 'colis', 'colis')}`;
  return x.sansDate ? `${sur} · ${x.sansDate} sans date de dépôt prouvée` : sur;
}

// ── LA PUBLICATION ──────────────────────────────────────────────────────────
export const CLE_VITESSE = 'vrm_vitesse_envoi';
export const EVT_VITESSE = 'vrm:vitesse-envoi';
// partiel : une source de preuves n'a pas été lue (e-mails) — moins de dates prouvées, dit.
export function publierVitesse(lignes, { owner = '', partiel = false } = {}) {
  if (!Array.isArray(lignes)) return;
  const l = lignes.map((x) => [str(x.tx), str(x.compte), str(x.nom), x.vente, Number.isFinite(x.depart) ? x.depart : null]);
  const p = { v: 1, owner: str(owner), partiel: !!partiel, l };
  try {
    const avant = localStorage.getItem(CLE_VITESSE);
    const neuf = JSON.stringify(p);
    if (avant && avant.replace(/,"at":\d+}$/, '}') === neuf) return;
    localStorage.setItem(CLE_VITESSE, JSON.stringify({ ...p, at: Date.now() }));
  } catch (_) { /* stockage refusé : Statistiques dit « — » */ }
  try { window.dispatchEvent(new CustomEvent(EVT_VITESSE)); } catch (_) {}
}
// null = jamais publiée pour CE compte VRM (pas su ⇒ « — »).
export function lireVitesse(owner = '') {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_VITESSE) || 'null');
    if (!p || p.v !== 1 || str(p.owner) !== str(owner) || !Array.isArray(p.l)) return null;
    return { partiel: !!p.partiel, at: p.at || null, lignes: p.l.map(([tx, compte, nom, vente, depart]) => ({ tx, compte, nom, vente, depart: Number.isFinite(depart) ? depart : null })) };
  } catch (_) { return null; }
}
