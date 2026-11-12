// ── LE MODE DE PAIEMENT D'UN ACHAT (11 nov., lot livre-registre — validé par Julien) ──
// « Payé en : Espèces · Carte · Virement · Chèque · Autre », FACULTATIF, sur un achat
// hors plateforme (`vinted_offvinted_buys`, champ `paiement`) et un achat en gros
// (`vrm_fournisseurs.achats[id].paiement`). Rangé avec l'achat, modifiable ensuite,
// jamais deviné : vide ⇒ « — » à l'écran et le manque nommé dans le registre des achats.
// Le registre l'écrit en colonne Règlement, et la colonne Espèces dit Oui / Non
// (D. 123-205-1 : les règlements en espèces sont distingués).
export const MODES_PAIEMENT = Object.freeze(['especes', 'carte', 'virement', 'cheque', 'autre']);
export const modePaiementLu = (v) => (MODES_PAIEMENT.includes(String(v == null ? '' : v)) ? String(v) : '');
// Le libellé du REGISTRE (document légal, en français) ; l'écran passe par tr('achat.paiement.<mode>').
export const LIBELLE_PAIEMENT = Object.freeze({ especes: 'Espèces', carte: 'Carte', virement: 'Virement', cheque: 'Chèque', autre: 'Autre' });
export const libellePaiement = (v) => LIBELLE_PAIEMENT[modePaiementLu(v)] || '';
// Espèces : 'Oui' · 'Non' · '' (pas su).
export const especesDe = (v) => { const m = modePaiementLu(v); return m ? (m === 'especes' ? 'Oui' : 'Non') : ''; };
