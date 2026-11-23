// ── LE STOCK IMPORTÉ D'UN AUTRE OUTIL, MONTRÉ (16 nov., lot ecrans-restes) ─────────────────────
// Paramètres → Importer (src/importStock.js) range les paires d'un autre outil dans `vrm_stock_importe`
// [{ id, numero, titre, prix, date, emplacement, createdAt, annonce?, importId }] : leurs N° sont dans le
// pool (append-only), leur coût par N° (`vinted_buyprice_by_num`). Elles ne se voyaient NULLE PART
// (récit 2026-11-11-import-autre-outil.md, « ce qui n'est pas fait »). Cette règle PURE dit lesquelles
// le Stock et la loupe montrent, par leur N° (`cleNum`, l'identité du N°, §5) — jamais un titre :
//   · une ligne sans N° lisible n'est pas montrée (l'import n'en crée pas) ;
//   · une paire reliée à une annonce (`annonce`, SON clic « Relier ») ou dont le N° est porté par une fiche
//     numérotée est DÉJÀ dans la liste des annonces sous ce N° : pas une seconde fois (§7) ;
//   · deux lignes au même N° (impossible à l'import, refusé) : une seule, la plus ancienne.
// Rien n'est écrit ici. `prix` : le prix d'achat tel que l'import l'a lu (texte du fichier, « 12,50 »),
// `null` quand le fichier n'en disait rien — jamais 0.
const str = (v) => String(v == null ? '' : v).trim();

export function importeesAuStock(importes, { cleNum, numerosPortes = null } = {}) {
  if (!Array.isArray(importes) || typeof cleNum !== 'function') return [];
  const portes = numerosPortes instanceof Set ? numerosPortes : new Set();
  const vus = new Set(), out = [];
  const tri = importes.filter(Boolean).slice().sort((a, b) => (Date.parse(a.createdAt || '') || 0) - (Date.parse(b.createdAt || '') || 0));
  for (const x of tri) {
    const cle = cleNum(str(x.numero));
    if (!cle || vus.has(cle)) continue;
    if (str(x.annonce) || portes.has(cle)) continue;
    vus.add(cle);
    const prix = x.prix == null || str(x.prix) === '' ? null : str(x.prix);
    out.push({ id: str(x.id) || cle, numero: str(x.numero), cle, titre: str(x.titre), prix, emplacement: str(x.emplacement), date: str(x.date), importId: str(x.importId) });
  }
  return out.sort((a, b) => a.cle.localeCompare(b.cle, 'fr', { numeric: true }));
}

// Pour la loupe (src/rechercheUnique.js, `S.stock`) : la même forme que le plan de rangement
// ({ numero, lieu }) plus le titre — une paire importée se trouve par son N° et par ses mots.
export function importeesPourRecherche(importes, { cleNum } = {}) {
  return importeesAuStock(importes, { cleNum }).map((x) => ({ numero: x.numero, lieu: x.emplacement, titre: x.titre, importe: true }));
}

// Pour « Tout sur le N° » (src/rechercheNumero.js) : la paire importée qui porte CE N°, ou null.
export function importeeDuNumero(importes, cle, { cleNum } = {}) {
  if (!Array.isArray(importes) || typeof cleNum !== 'function' || !cle) return null;
  const x = importes.find((i) => i && cleNum(str(i.numero)) === cle);
  return x ? { numero: str(x.numero), titre: str(x.titre), prix: x.prix == null || str(x.prix) === '' ? null : str(x.prix), emplacement: str(x.emplacement), date: str(x.date), annonce: str(x.annonce) || null } : null;
}
