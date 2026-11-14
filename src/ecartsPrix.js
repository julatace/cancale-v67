// ═══════════════════════════════════════════════════════════════════════════
// LA MÊME PAIRE À DEUX PRIX (14 nov., lot argent-prix — proposition 121 validée
// par Julien : « 80 € sur Vinted et 95 € sur Leboncoin, signalée »)
// ═══════════════════════════════════════════════════════════════════════════
// LA MÊME PAIRE = LA MÊME IDENTITÉ (§5), jamais le titre, jamais la ressemblance :
// les annonces d'un N° sont celles que `sitesDuNumero` (src/prixPartout.js, la
// feuille « Changer le prix ») trouve PAR IDENTITÉ — la fiche Vinted, le SKU
// `VRM-{n°}` eBay, le lien posé ou la référence VRM Leboncoin, le N° donné au
// produit Vestiaire. Ce module ne relie RIEN : il reçoit, par N°, les annonces
// déjà reliées, et compare leurs prix.
//   · un N° porté par DEUX annonces en ligne du MÊME site ⇒ pas jugé (« deux
//     annonces » dit) : on ne sait pas laquelle compare ;
//   · une annonce dans une autre devise, ou au prix pas lu ⇒ pas comparée (dite) ;
//   · l'écart VOULU — celui de SON réglage « Publier partout » (`vrm_partout_prix`,
//     `prixParSite` : ± € / ± % par site, depuis le prix Vinted) — est rangé à part
//     (« selon ton réglage ») ; seul l'écart que le réglage n'explique pas est
//     SIGNALÉ.
// RIEN N'EST CHANGÉ : la ligne ouvre « Changer le prix » (son clic, sa feuille).
// Module PUR. Exécuté par scripts/audit-argent-prix.cjs (section 121 : 50 paires
// au même titre ⇒ aucun faux écart).
// ═══════════════════════════════════════════════════════════════════════════

const cts = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100));
const ORDRE = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];

// groupes : [{ num, sites: [{ site, id, prix (€), devise?, titre? }] }] — les sites d'UN N°,
//           tels que `sitesDuNumero` les rend (en ligne, par identité).
// prixAttendu(site, prixVinted) → € attendu selon SON réglage (ou null : pas de réglage pour ce site).
export function ecartsPrix(groupes, { prixAttendu = null } = {}) {
  const ecarts = [], voulus = [], nonJuges = [];
  let compares = 0;
  for (const g of Array.isArray(groupes) ? groupes : []) {
    if (!g || !g.num) continue;
    const parSite = new Map();
    for (const s of Array.isArray(g.sites) ? g.sites : []) {
      if (!s || !ORDRE.includes(s.site)) continue;
      if (!parSite.has(s.site)) parSite.set(s.site, []);
      parSite.get(s.site).push(s);
    }
    if (parSite.size < 2) continue;
    const doubles = [...parSite].filter(([, l]) => l.length > 1).map(([k]) => k);
    if (doubles.length) { nonJuges.push({ num: g.num, raison: 'deux', sites: doubles }); continue; }
    const lus = [], ecartes = [];
    for (const [site, [s]] of parSite) {
      const dev = String(s.devise || 'EUR').toUpperCase();
      const p = cts(s.prix);
      if (dev !== 'EUR' || p == null || p <= 0) { ecartes.push({ site, raison: dev !== 'EUR' ? 'devise' : 'prix' }); continue; }
      lus.push({ site, id: String(s.id || ''), prix: p / 100, c: p, titre: s.titre || '' });
    }
    if (lus.length < 2) { if (ecartes.length) nonJuges.push({ num: g.num, raison: ecartes[0].raison, sites: ecartes.map((x) => x.site) }); continue; }
    lus.sort((a, b) => ORDRE.indexOf(a.site) - ORDRE.indexOf(b.site));
    compares += 1;
    const min = Math.min(...lus.map((x) => x.c)), max = Math.max(...lus.map((x) => x.c));
    if (min === max) continue;
    // L'écart voulu : chaque site au prix que SON réglage donne depuis le prix Vinted.
    const v = lus.find((x) => x.site === 'vinted');
    const attendu = v && typeof prixAttendu === 'function'
      ? lus.every((x) => x.site === 'vinted' || cts(prixAttendu(x.site, v.prix)) === x.c) : false;
    const ligne = { num: g.num, sites: lus.map(({ c: _c, ...x }) => x), ecart: (max - min) / 100, min: min / 100, max: max / 100, ecartes };
    (attendu ? voulus : ecarts).push(ligne);
  }
  ecarts.sort((a, b) => b.ecart - a.ecart || String(a.num).localeCompare(String(b.num), 'fr', { numeric: true }));
  return { ecarts, voulus, nonJuges, compares };
}
