// ═══════════════════════════════════════════════════════════════════════════
// COMPARER DEUX MOIS (4 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : ce mois face au mois d'avant, ou au même mois l'an dernier (son
// choix) — ventes, CA vendu, reçu, bénéfice ; l'écart en € et en %.
//
// AUCUNE RÈGLE ICI (§11) : chaque chiffre vient de sa règle propriétaire,
// passée par l'app —
//   · ventes et CA vendu = les lignes de `ventesFaites` (date de la VENTE),
//     comptées par `bilanLignes` sur le mois (heure de l'appareil, la borne de
//     Ma journée et de Statistiques) ;
//   · reçu = la ligne publiée `vinted_urssaf_mois` (`ventesDeclarables`, date de
//     VERSEMENT), lue par `recuDe(ym)` ;
//   · bénéfice = `beneficePeriode` du mois + `chiffreBenefice`, lu par
//     `beneficeDe(ym)` (la colonne « Bénéfice » du récap mensuel).
// Trois états (§5) : `valeur: null` = pas su (« — ») ; `partiel` = un minimum
// (« au moins »), le manque NOMMÉ. L'écart ne se calcule que si les DEUX côtés
// sont complets : un écart contre un minimum serait un faux (« — »).
// Exécuté par scripts/audit-comparer-mois.cjs.

export const ymDe = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export const ymDecale = (ym, k) => {
  const [y, m] = String(ym).split('-').map(Number);
  const d = new Date(y, m - 1 + k, 1);
  return ymDe(d.getTime());
};
// Le mois d'en face : « precedent » (le mois d'avant) ou « an » (le même mois l'an dernier).
export const ymEnFace = (ym, mode) => ymDecale(ym, mode === 'an' ? -12 : -1);
export const bornesMois = (ym) => {
  const [y, m] = String(ym).split('-').map(Number);
  return { de: new Date(y, m - 1, 1).getTime(), a: new Date(y, m, 1).getTime() };
};

const LIGNES = [
  { cle: 'ventes', nom: 'Ventes', type: 'n' },
  { cle: 'vendu', nom: 'CA vendu', type: 'eur' },
  { cle: 'recu', nom: 'Reçu', type: 'eur' },
  { cle: 'benefice', nom: 'Bénéfice', type: 'eur' },
];

const pasSu = (raison) => ({ valeur: null, partiel: false, manque: [], raison });

// Le vendu d'un mois (nombre et montant), par la règle de « Vendu ».
const venduDuMois = (V, ym, R) => {
  if (!V || !Array.isArray(V.lignes)) return { ventes: pasSu('pasSu'), vendu: pasSu('pasSu') };
  const { de, a } = bornesMois(ym);
  const r = R.bilanLignes(V.lignes, de, a - 1);
  const nc = (V.nonComptees || []).filter((x) => x && x.ts != null && x.ts >= de && x.ts < a);
  const manque = [...new Set([...(V.manque || []), ...nc.map((x) => x.plateforme)])];
  const partiel = manque.length > 0;
  // « Au moins 0 » ne se dit jamais (§5).
  const un = (v) => (partiel && !(v > 0) ? pasSu('partiel') : { valeur: v, partiel, manque, raison: '' });
  return { ventes: un(r.n), vendu: un(r.eur) };
};

const cote = (x) => (x && typeof x === 'object' ? { valeur: x.valeur == null ? null : x.valeur, partiel: !!x.partiel, manque: x.manque || [], raison: x.valeur == null ? (x.raison || 'pasSu') : '' } : pasSu('pasSu'));

// → { ymA, ymB, lignes: [{ cle, nom, type, a, b, ecart, pct }] }
//   a = ce mois, b = le mois d'en face.
export function comparerMois({ ymA, mode = 'precedent', vendu, recuDe, beneficeDe, R } = {}) {
  const ymB = ymEnFace(ymA, mode);
  const vA = venduDuMois(vendu, ymA, R), vB = venduDuMois(vendu, ymB, R);
  const val = {
    ventes: [vA.ventes, vB.ventes],
    vendu: [vA.vendu, vB.vendu],
    recu: [cote(recuDe && recuDe(ymA)), cote(recuDe && recuDe(ymB))],
    benefice: [cote(beneficeDe && beneficeDe(ymA)), cote(beneficeDe && beneficeDe(ymB))],
  };
  const lignes = LIGNES.map((L) => {
    const [a, b] = val[L.cle];
    const complets = a.valeur != null && b.valeur != null && !a.partiel && !b.partiel;
    const ecart = complets ? (L.type === 'eur' ? Math.round((a.valeur - b.valeur) * 100) / 100 : a.valeur - b.valeur) : null;
    // Un pourcentage contre zéro ou contre un négatif ne veut rien dire : « — ».
    const pct = complets && b.valeur > 0 ? Math.round(((a.valeur - b.valeur) / b.valeur) * 1000) / 10 : null;
    return { ...L, a, b, ecart, pct };
  });
  return { ymA, ymB, mode, lignes };
}
