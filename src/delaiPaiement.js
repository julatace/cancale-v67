// ═══════════════════════════════════════════════════════════════════════════
// LE DÉLAI DE PAIEMENT PAR SITE (5 novembre, chantier F)
// ═══════════════════════════════════════════════════════════════════════════
// Julien veut savoir combien de temps l'argent met à arriver, site par site :
// le délai MÉDIAN entre la vente et le versement, et SUR COMBIEN de ventes.
//
// AUCUNE RÈGLE D'ARGENT ICI (§5, §11). Les lignes sont celles de
// `ventesDeclarables` (App.jsx) : `ts` y est la date de VERSEMENT seulement pour
// Vinted (transaction « Commande finalisée », 450, `status_updated_at`) et
// Vestiaire (`dateVersementVc`). Pour Leboncoin, `ts` est la date de VENTE ; pour
// eBay, celle de la commande : aucune date de versement n'y est LUE ⇒ « — »,
// jamais un délai de 0 jour inventé.
// « Pas su » ne vaut pas « oui » : une vente sans date de vente lisible, ou sans
// date de versement (« à dater », déclarée sans date), n'est pas mesurée — elle
// est COMPTÉE à part (`nSans`). Un versement avant la vente (incohérent) est
// écarté et compté (`nIncoherentes`). Exécuté par scripts/audit-chantier-f.cjs.

export const SITES_VERSEMENT_LU = ['Vinted', 'Vestiaire'];
export const SITES_DELAI = ['Vinted', 'Vestiaire', 'Leboncoin', 'eBay'];
const JOUR = 86400000;

// La médiane d'une liste de nombres (déjà filtrés), au dixième de jour.
export const mediane = (xs) => {
  const v = (xs || []).filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  const brut = v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  return Math.round(brut * 10) / 10;
};

// lignes      : `ventesDeclarables(...).lignes` (les ventes REÇUES, datées au versement)
// dateVenteDe : (ligne) → ms de la VENTE, ou null (pas lue)
// → { sites: [{ plateforme, lu, n, mediane, min, max, nSans, nIncoherentes }] }
//   `lu` faux ⇒ ce site ne donne pas sa date de versement : aucun délai (« — »).
export function delaisPaiement({ lignes, dateVenteDe } = {}) {
  if (!Array.isArray(lignes)) return null;
  const par = new Map();
  for (const p of SITES_DELAI) par.set(p, { plateforme: p, lu: SITES_VERSEMENT_LU.includes(p), jours: [], nSans: 0, nIncoherentes: 0, total: 0 });
  for (const l of lignes) {
    if (!l || !par.has(l.plateforme)) continue;
    const s = par.get(l.plateforme);
    s.total += 1;
    if (!s.lu) continue;
    const verse = Number(l.ts);
    const vendu = typeof dateVenteDe === 'function' ? Number(dateVenteDe(l)) : NaN;
    if (!(verse > 0) || !(vendu > 0)) { s.nSans += 1; continue; }
    const j = (verse - vendu) / JOUR;
    if (j < 0) { s.nIncoherentes += 1; continue; }
    s.jours.push(j);
  }
  const sites = [...par.values()].filter((s) => s.total > 0).map((s) => ({
    plateforme: s.plateforme, lu: s.lu, total: s.total, n: s.jours.length,
    mediane: s.lu ? mediane(s.jours) : null,
    min: s.jours.length ? Math.round(Math.min(...s.jours) * 10) / 10 : null,
    max: s.jours.length ? Math.round(Math.max(...s.jours) * 10) / 10 : null,
    nSans: s.nSans, nIncoherentes: s.nIncoherentes,
  }));
  return { sites };
}

// Un délai en mots : « 3,5 jours », « moins d'un jour », « — ».
export const texteDelai = (j) => (j == null ? '—' : j < 1 ? 'moins d’un jour' : `${String(Math.round(j * 10) / 10).replace('.', ',')} jour${j >= 2 ? 's' : ''}`);
