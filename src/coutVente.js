// ════════════════════════════════════════════════════════════════════════════
//  LE COÛT RÉEL D'UNE VENTE (lot BA) ET LA VALEUR DU STOCK (lot BF) — 10 nov.
//  Validés par Julien. UNE règle pour les deux : le prix d'achat SAISI, lu par
//  `beneficePaire` (src/beneficePaire.js) — la même que le bénéfice de la ligne
//  (`beneficeLigneVente`), `vrm_benefice_jours` (`achatDe` + `chargesVente`) et
//  le plancher des offres. Ce module ne CALCULE rien de neuf : il DÉCOMPOSE ce que
//  la règle a déjà compté (§5 « une seule règle par notion »).
//
//  BA · `cascadeVente(prix, fiche)` — vente − achat − frais − emballage = bénéfice.
//    · « frais » = tout ce que `coutsVente` déduit SAUF l'emballage (boost,
//      commission, port payé par lui, remboursement, autres) ;
//    · « emballage » = le champ `emballage` de la fiche (un des `champsCharges`,
//      donc déjà dans `coutsVente` et dans tous les totaux) — vide ⇒ `null`,
//      « non saisi », jamais deviné, jamais 0 ;
//    · par construction : vente − achat − frais − emballage === bénéfice de la
//      règle, au centime (l'audit le vérifie sur des milliers de tirages) ;
//    · états : ceux de `beneficeLigneVente` (`achat`, `partiel`, `ok`,
//      `illisible`, `prix`, `annulee`) — pas su = `null`, l'écran dit « — ».
//
//  BF · `valeurStock(paires, ficheDe)` — Σ prix d'achat SAISIS des paires
//    PRÉSENTES (la liste `annoncesPresentes` de l'écran Annonces, jamais une
//    nouvelle définition) ; la couverture est dite : « au moins 2 340 € · sur 48
//    paires · 6 sans prix ». Un prix illisible n'est pas sommé : il compte dans
//    « sans prix » (la porte de saisie le corrige). Aucun prix ⇒ `null` (« — »).
//    Publiée par l'écran Annonces sous `vrm_valeur_stock` (`publierValeurStock`),
//    lue par le Stock et Statistiques (`lireValeurStock`) — jamais recalculée.
// ════════════════════════════════════════════════════════════════════════════
import { beneficePaire, centimes } from './beneficePaire.js';

const vide = (v) => v == null || String(v).trim() === '';

// ── BA ──────────────────────────────────────────────────────────────────────
export function cascadeVente(prix, fiche, { annulee = false, autreDevise = false } = {}) {
  if (annulee) return { etat: 'annulee', vente: null, achat: null, frais: null, emballage: null, benefice: null, emballageSaisi: false };
  const e = fiche || {};
  const b = beneficePaire(prix, e);
  const emballageSaisi = !vide(e.emballage);
  const emb = emballageSaisi ? centimes(e.emballage) : null;
  const frais = b.valid ? b.cents - (emb ?? 0) : null;
  const base = { vente: autreDevise ? null : b.vente, achat: b.achat, frais, emballage: emb, emballageSaisi };
  if (autreDevise || b.vente == null) return { ...base, etat: 'prix', benefice: null };
  if (!b.valid) return { ...base, etat: 'illisible', benefice: null };
  if (b.achat == null) return { ...base, etat: 'achat', benefice: null };
  return { ...base, etat: b.complet ? 'ok' : 'partiel', benefice: b.vente - b.achat - b.cents };
}

// Les segments de la barre empilée, en centimes ; la barre mesure le prix de
// vente, ou les coûts quand ils le dépassent (une perte se voit au-delà du prix).
export function segmentsCascade(c) {
  if (!c || c.vente == null || c.etat === 'annulee') return null;
  const s = [];
  if (c.achat != null && c.achat > 0) s.push({ cle: 'achat', c: c.achat });
  if (c.frais != null && c.frais > 0) s.push({ cle: 'frais', c: c.frais });
  if (c.emballage != null && c.emballage > 0) s.push({ cle: 'emballage', c: c.emballage });
  if (c.benefice != null && c.benefice > 0) s.push({ cle: 'benefice', c: c.benefice });
  const couts = s.filter((x) => x.cle !== 'benefice').reduce((t, x) => t + x.c, 0);
  const total = Math.max(c.vente, couts);
  if (!(total > 0)) return null;
  return { total, perte: c.benefice != null && c.benefice < 0, segments: s.map((x) => ({ ...x, pct: (x.c / total) * 100 })) };
}

// ── BF ──────────────────────────────────────────────────────────────────────
// `paires` : les annonces présentes ; `ficheDe(it)` : la fiche de la paire (prix
// d'achat résolu comme pour une vente : `fusionEntreeVente`).
export function valeurStock(paires, ficheDe) {
  let c = 0, nPrix = 0, n = 0;
  const sans = [];
  for (const it of (Array.isArray(paires) ? paires : [])) {
    if (!it || it.id == null) continue;
    n += 1;
    const a = beneficePaire(null, (ficheDe && ficheDe(it)) || {}).achat;
    if (a == null) sans.push(String(it.id)); else { c += a; nPrix += 1; }
  }
  return { centimes: nPrix ? c : (n ? null : 0), n, nPrix, nSans: sans.length, sans };
}

// « 2 340 € », « 12,50 € » — au centime seulement quand il y en a.
export const eurosStock = (cents) => {
  if (cents == null || !Number.isFinite(cents)) return '—';
  const e = cents / 100;
  return (Number.isInteger(e) ? e.toLocaleString('fr-FR') : e.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' €';
};

// Ce que l'écran écrit. `partiel` : une lecture des annonces manque.
export function texteValeurStock(v, { partiel = false } = {}) {
  if (!v || v.centimes == null) return { montant: '—', auMoins: false, sur: v && v.n ? `sur ${v.n} paire${v.n > 1 ? 's' : ''}` : '', sans: v && v.nSans ? `${v.nSans} sans prix` : '' };
  const auMoins = v.nSans > 0 || !!partiel;
  return { montant: eurosStock(v.centimes), auMoins, sur: `sur ${v.n} paire${v.n > 1 ? 's' : ''}`, sans: v.nSans ? `${v.nSans} sans prix` : '' };
}

// ── Publication (un propriétaire : l'écran Annonces ; des lecteurs) ─────────
export const CLE_VALEUR_STOCK = 'vrm_valeur_stock';
export const EVT_VALEUR_STOCK = 'vrm:valeur-stock';
export function publierValeurStock(v, { owner = '', partiel = false } = {}) {
  if (!v) return;
  const p = { c: v.centimes, n: v.n, nPrix: v.nPrix, nSans: v.nSans, partiel: !!partiel, owner: String(owner || ''), at: Date.now() };
  try {
    const avant = JSON.parse(localStorage.getItem(CLE_VALEUR_STOCK) || 'null');
    if (avant && avant.c === p.c && avant.n === p.n && avant.nPrix === p.nPrix && avant.nSans === p.nSans && avant.partiel === p.partiel && avant.owner === p.owner) return;
    localStorage.setItem(CLE_VALEUR_STOCK, JSON.stringify(p));
  } catch (_) { /* stockage refusé : les lecteurs disent « — » */ }
  try { window.dispatchEvent(new CustomEvent(EVT_VALEUR_STOCK, { detail: p })); } catch (_) {}
}
// null = jamais publiée pour CE compte VRM (pas su ⇒ « — »).
export function lireValeurStock(owner = '') {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_VALEUR_STOCK) || 'null');
    if (!p || typeof p !== 'object' || String(p.owner || '') !== String(owner || '') || !Number.isFinite(p.n)) return null;
    return { centimes: p.c == null ? null : Number(p.c), n: p.n, nPrix: p.nPrix, nSans: p.nSans, partiel: !!p.partiel, at: p.at };
  } catch (_) { return null; }
}
