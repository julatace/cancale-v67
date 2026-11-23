// ── LA VALEUR DU STOCK AU PRIX AFFICHÉ (20 nov. 2026, chantier « ce qui manque ») ──────────────────────────────────
// UNE règle, UN propriétaire (§11) : l'écran Annonces (src/ecrans/AnnoncesEgalite.jsx) la calcule sur SES articles et la
// PUBLIE sous `vrm_stock_valeur` ; Aujourd'hui (carte « Stock en ligne ») la lit, ne recalcule rien.
//   · Σ des prix des articles qui ont au moins UNE annonce EN LIGNE prouvée (l'état de chaque site par SA règle :
//     <enligne-regle> Vinted, `etatEnLigneLbc`, eBay lu < 24 h, `etatAnnonceVcBrut` ; « à confirmer », masquée, en
//     pause, brouillon ne comptent pas) ;
//   · UNE PAIRE COMPTÉE UNE FOIS même publiée sur plusieurs sites : l'article EST le regroupement par identité
//     (`construireArticles` : l'annonce Vinted, le lien posé vers elle, le N° — jamais le titre ni la ressemblance) ;
//   · son prix : celui de l'annonce VINTED en ligne quand il y en a une (le prix de référence de la paire), sinon le
//     PLUS BAS de ses annonces en ligne — et c'est DIT (`nVinted`, `nPlusBas`) ;
//   · un prix illisible (autre devise, absent) n'est pas sommé : il compte dans « sans prix » ; deux paires sous un même
//     N° (le doublon, le seul rouge) ne sont pas attribuées : comptées à part (`nDouble`), jamais sommées ;
//   · couverture : « sur N » ; un site pas lu ⇒ « au moins » (`partiel`). Aucun article en ligne ⇒ 0 € « sur 0 » ;
//     lecture ratée ⇒ RIEN publié (la publication d'avant reste).
// Module PUR (hors `publier`/`lire`) : scripts/audit-vues-stock.cjs exécute ces fonctions (une paire sur deux sites
// comptée une fois, mutation rouge).

export const CLE_STOCK_VALEUR = 'vrm_stock_valeur';
export const EVT_STOCK_VALEUR = 'vrm:stock-valeur';

const cents = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null);

// `articles` : `construireArticles(...).articles` — chaque `annonces[]` porte { site, etat, prix (euros, ou null) }.
export function valeurStockAffiche(articles, { partiel = false } = {}) {
  let c = 0, n = 0, nPrix = 0, nSans = 0, nDouble = 0, nVinted = 0, nPlusBas = 0, nMulti = 0;
  for (const a of (Array.isArray(articles) ? articles : [])) {
    const L = (a && Array.isArray(a.annonces) ? a.annonces : []).filter((x) => x && x.etat === 'enligne');
    if (!L.length) continue;
    n += 1;
    if (new Set(L.map((x) => x.site)).size > 1) nMulti += 1;
    if (a.doublon) { nDouble += 1; continue; }
    const v = L.find((x) => x.site === 'vinted' && cents(x.prix) != null);
    let p = null;
    if (v) { p = cents(v.prix); nVinted += 1; }
    else {
      const ps = L.map((x) => cents(x.prix)).filter((x) => x != null);
      if (ps.length) { p = Math.min(...ps); nPlusBas += 1; }
    }
    if (p == null) { nSans += 1; continue; }
    c += p; nPrix += 1;
  }
  return { centimes: nPrix ? c : (n ? null : 0), n, nPrix, nSans, nDouble, nVinted, nPlusBas, nMulti, partiel: !!partiel };
}

export function publierStockValeur(v, { owner = '', maintenant = Date.now() } = {}) {
  if (!v || !Number.isFinite(v.n)) return false;           // lecture ratée : rien (la publication d'avant reste)
  const p = { ...v, owner: String(owner || ''), at: maintenant };
  try {
    const avant = JSON.parse(localStorage.getItem(CLE_STOCK_VALEUR) || 'null');
    if (avant && JSON.stringify({ ...avant, at: 0 }) === JSON.stringify({ ...p, at: 0 })) return false;
    localStorage.setItem(CLE_STOCK_VALEUR, JSON.stringify(p));
  } catch (_) { return false; }
  try { window.dispatchEvent(new CustomEvent(EVT_STOCK_VALEUR, { detail: p })); } catch (_) {}
  return true;
}
// null = jamais publiée pour CE compte VRM (pas su ⇒ « — · ouvre Annonces »).
export function lireStockValeur(owner = '') {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_STOCK_VALEUR) || 'null');
    if (!p || typeof p !== 'object' || String(p.owner || '') !== String(owner || '') || !Number.isFinite(p.n)) return null;
    return p;
  } catch (_) { return null; }
}
