// ═══════════════════════════════════════════════════════════════════════════
// COMPARER DEUX PAIRES CÔTE À CÔTE (14 nov. 2026, chantier 95 — validé par Julien)
// ═══════════════════════════════════════════════════════════════════════════
// Deux annonces COCHÉES (Annonces → Sélectionner), choisies par leur IDENTITÉ
// (compte + id de l'annonce, §5 — jamais par titre : deux paires au même titre
// restent deux colonnes). Les lignes sont alignées : achat, prix, marge, en ligne
// depuis, état, taille, marque, N°, compte. Ce qui n'est pas lu vaut `null` et
// l'écran écrit « — » (pas su ≠ zéro, §5) ; la marge n'existe que si les DEUX
// nombres sont connus. Aucun chiffre n'est calculé autrement qu'ailleurs : le prix
// et l'achat sont ceux de la ligne (`prix`, `verif.achat` = `prixAchatDe`).
// Module PUR — scripts/audit-listes-recherche.cjs.

const str = (v) => String(v == null ? '' : v);
const nombre = (v) => { if (v == null || v === '') return null; const n = Number(str(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

// Les deux annonces de la sélection, par identité ; `null` si ce ne sont pas exactement deux lues.
export function deuxChoisies(sel, annonces) {
  if (!Array.isArray(sel) || sel.length !== 2) return null;
  const idx = new Map((annonces || []).map((a) => [str(a.uid) + ':' + str(a.id), a]));
  const l = sel.map((x) => idx.get(str(x.uid) + ':' + str(x.id)) || null);
  return l.every(Boolean) ? l : null;
}
// Les lignes de la comparaison : [{ k, a, b }] — valeurs BRUTES (nombres, textes, null).
export function lignesComparaison(a, b, { maintenant = Date.now() } = {}) {
  const jours = (x) => { const t = Number(x && x.createdTs); if (!Number.isFinite(t) || t <= 0) return null; const ms = t < 1e12 ? t * 1000 : t; const j = Math.floor((maintenant - ms) / 86400000); return j >= 0 ? j : null; };
  const val = (x) => ({
    prix: nombre(x.prix),
    achat: nombre(x.verif ? x.verif.achat : x.achat),
    depuis: jours(x),
    etat: str(x.condition).trim() || null,
    taille: str(x.taille).trim() || null,
    marque: str(x.marque).trim() || null,
    numero: str(x.numero).trim() || null,
    compte: str(x.compte).trim() || null,
  });
  const va = val(a || {}), vb = val(b || {});
  const marge = (v) => (v.prix != null && v.achat != null ? Math.round((v.prix - v.achat) * 100) / 100 : null);
  return [
    { k: 'achat', a: va.achat, b: vb.achat },
    { k: 'prix', a: va.prix, b: vb.prix },
    { k: 'marge', a: marge(va), b: marge(vb) },
    { k: 'depuis', a: va.depuis, b: vb.depuis },
    { k: 'etat', a: va.etat, b: vb.etat },
    { k: 'taille', a: va.taille, b: vb.taille },
    { k: 'marque', a: va.marque, b: vb.marque },
    { k: 'numero', a: va.numero, b: vb.numero },
    { k: 'compte', a: va.compte, b: vb.compte },
  ];
}
