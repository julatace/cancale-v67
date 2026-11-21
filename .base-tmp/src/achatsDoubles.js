// ══════════════════════════════════════════════════════════════════════════════
//  « ACHAT SAISI DEUX FOIS » (10 nov., lot BH — validé par Julien)
//  docs/passation/2026-11-10-note-achat-double.md
// ══════════════════════════════════════════════════════════════════════════════
// Un même achat enregistré deux fois compte deux fois dans « dépensé », dans le
// coût du stock et dans le bénéfice. On le DIT — par IDENTITÉ seulement (§5) :
//   · le n° de transaction Vinted d'un achat lu par l'extension ;
//   · le « N° de commande ou de facture » qu'il a tapé sur un achat hors
//     plateforme (brocante, fournisseur, eBay, Leboncoin…).
// Deux achats sont LE MÊME quand ces références sont identiques (majuscules,
// sans espace ni ponctuation, 6 signes au moins : « 12 » n'est pas une identité).
// ⚠️ JAMAIS par ressemblance : ni le titre, ni le prix, ni la date, ni la photo.
// Cinquante achats identiques sans référence ne font AUCUN doublon (audit-identite).
//
// Rien n'est supprimé, rien n'est décidé : il voit les deux fiches côte à côte et
// choisit « Garder celle-ci » ; l'AUTRE est masquée (geste annulable 5 s, lot B) :
//   · un achat Vinted ⇒ `vinted_purchases_hidden` (le masquage qui existe déjà,
//     réaffichable dans « Masqués ») ;
//   · un achat hors plateforme ⇒ `vrm_achats_hors_masques` (il sort de la liste et
//     des totaux ; « Réafficher » sous le bloc des doublons).
// Une référence partagée dont il ne reste qu'UN achat visible n'est plus un doublon.
//
// Module PUR : exécuté par scripts/audit-note-achat-double.cjs et audit-identite.cjs.
// ══════════════════════════════════════════════════════════════════════════════

export const CLE_HORS_MASQUES = 'vrm_achats_hors_masques';
export const CLE_ACHATS_MASQUES = 'vinted_purchases_hidden';
export const REF_MIN = 6;

// La référence comparée : majuscules, lettres et chiffres seulement, 6 au moins.
export function refAchat(v) {
  const s = String(v == null ? '' : v).toUpperCase().normalize('NFKD').replace(/[^0-9A-Z]/g, '');
  return s.length >= REF_MIN && s.length <= 40 ? s : '';
}

// Les achats tels que la règle les voit : { id, source, ref, achat } — rien d'autre
// n'entre dans la comparaison. `vinted` : achats lus (transaction_id) ; `hors` :
// achats hors plateforme ({ id, ref }) ; `masquesHors` : Set des id masqués.
export function achatsComparables({ vinted = [], hors = [], masquesHors = null } = {}) {
  const out = [];
  const vus = new Set();
  for (const o of Array.isArray(vinted) ? vinted : []) {
    const tx = o && o.transaction_id != null ? String(o.transaction_id).trim() : '';
    const ref = refAchat(tx);
    if (!ref || vus.has('tx:' + tx)) continue;
    vus.add('tx:' + tx);
    out.push({ id: 'tx:' + tx, source: 'vinted', ref, cle: tx, achat: o });
  }
  for (const b of Array.isArray(hors) ? hors : []) {
    if (!b || b.id == null) continue;
    const id = String(b.id);
    if (masquesHors && masquesHors.has(id)) continue;
    const ref = refAchat(b.ref);
    if (!ref || vus.has('ob:' + id)) continue;
    vus.add('ob:' + id);
    out.push({ id: 'ob:' + id, source: 'hors', ref, cle: id, achat: b });
  }
  return out;
}

// Les groupes : une référence portée par AU MOINS deux achats visibles.
export function achatsEnDouble(entree) {
  const L = achatsComparables(entree);
  const parRef = new Map();
  for (const a of L) { if (!parRef.has(a.ref)) parRef.set(a.ref, []); parRef.get(a.ref).push(a); }
  const groupes = [];
  for (const [ref, achats] of parRef) if (achats.length >= 2) groupes.push({ ref, achats });
  return groupes;
}

// « Garder celle-ci » : les sous-valeurs à poser (src/gesteAnnulable.js, type
// 'ensemble') — masquer chacun des AUTRES achats du groupe. Rien d'autre.
export function opsGarder(groupe, idGarde) {
  if (!groupe || !Array.isArray(groupe.achats) || !groupe.achats.some((a) => a.id === idGarde)) return [];
  return groupe.achats.filter((a) => a.id !== idGarde).map((a) => (a.source === 'vinted'
    ? { k: CLE_ACHATS_MASQUES, type: 'ensemble', id: a.cle, apres: true, avant: false }
    : { k: CLE_HORS_MASQUES, type: 'ensemble', id: a.cle, apres: true, avant: false }));
}

// Les achats hors plateforme qui comptent (liste, « dépensé », bilans) : sans les masqués.
export function horsVisibles(liste, masques) {
  const m = masques instanceof Set ? masques : new Set((Array.isArray(masques) ? masques : []).map(String));
  return (Array.isArray(liste) ? liste : []).filter((b) => b && !m.has(String(b.id)));
}
