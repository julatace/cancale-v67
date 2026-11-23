#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  ANNONCES · « VENDUE » ET LES COMPTEURS DES FILTRES (22 nov., retour de Julien sur la production :
//  « j'ai fait 3 ventes mais pas que sur Leboncoin : applique un filtre par plateforme, les filtres ne sont
//  pas précis » — Statut « Vendue · 3 » ne montrait que 3 annonces Leboncoin).
//
//  Base d'exemple INVENTÉE, multi-sites (Vinted : 2 comptes, Leboncoin, eBay), exécutée par les VRAIES règles
//  (src/articles/sources.js, src/articles/modele.js, src/natif/ecrans/annoncesComptes.js) :
//   V1  une annonce Vinted vendue (sortie du dressing) est « vendue », datée de SA vente, par SON n° de
//       transaction → item_id ; une vente non PROUVÉE n'entre pas ; preuves pas lues ⇒ rien ; deux ventes au
//       MÊME titre restent deux annonces (identité, jamais le titre) ; un autre compte n'entre pas.
//   V2  Statut « Vendue » = toutes les vendues, TOUS sites (Vinted + Leboncoin + eBay).
//   V3  le nombre de chaque statut = EXACTEMENT les rangées montrées quand on coche ce seul statut (une rangée par
//       article et par compte, l'état de SON annonce) ; plusieurs statuts = union.
//   V4  le filtre Site : son nombre = ses rangées ; Site ∩ Statut = intersection.
//   V5  l'écran : `annoncesVintedVendues` branchée, les retirées Vinted montrées, plus de note des limites en pied,
//       plus de bouton plein « Publier un article » seul sous le tableau, le filtre s'appelle « Site ».
//  Sur origin/main : ROUGE (la règle n'existe pas ; « Vendue » = Leboncoin seulement).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const R = process.env.RACINE ? path.resolve(process.env.RACINE) : path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + JSON.stringify(d).slice(0, 400) : '')); } };
const imp = async (f) => { try { return await import('file://' + path.join(R, f)); } catch (e) { return { __erreur: e.message }; } };

(async () => {
  const S = await imp('src/articles/sources.js'), M = await imp('src/articles/modele.js'), G = await imp('src/natif/ecrans/annoncesComptes.js');
  dit(typeof S.annoncesVintedVendues === 'function', 'V1 la règle des annonces Vinted vendues existe (src/articles/sources.js `annoncesVintedVendues`)', S.__erreur);
  if (typeof S.annoncesVintedVendues !== 'function' || typeof M.construireArticles !== 'function') { console.log(`\n❌ audit-annonces-vendues : ${ok} vert(s), ${ko + 1} rouge(s)`); process.exit(1); }
  const J = Date.parse('2026-11-20T10:00:00Z');
  const acc = (u, l) => ({ vinted_user_id: u, login: l });
  const ventes = [
    { _acc: acc(11, 'shopa'), transaction_id: 9001, title: 'Nike Air Max 90 taille 42', price: { amount: '60.0' }, date: '2026-11-20T10:00:00Z' },
    { _acc: acc(11, 'shopa'), transaction_id: 9002, title: 'Nike Air Max 90 taille 42', price: { amount: '55.0' }, date: '2026-11-19T10:00:00Z' },   // MÊME titre, autre annonce
    { _acc: acc(12, 'shopb'), transaction_id: 9003, title: 'Adidas Samba 40', price: { amount: '70.0' }, date: '2026-11-18T10:00:00Z' },
    { _acc: acc(12, 'shopb'), transaction_id: 9004, title: 'Pas prouvée', price: { amount: '30.0' }, date: '2026-11-18T10:00:00Z' },            // conversation, pas une vente prouvée
    { _acc: acc(99, 'autre'), transaction_id: 9005, title: 'Autre compte', price: { amount: '30.0' }, date: '2026-11-18T10:00:00Z' },
  ];
  const txnItem = { 9001: '501', 9002: '502', 9003: '503', 9004: '504', 9005: '505' };
  const vendus = new Set(['501', '502', '503', '505']);
  const comptes = { 11: 'shopa', 12: 'shopb' };
  const V = S.annoncesVintedVendues({ ventes, txnItem, vendus, comptes, dressing: { 12: [{ id: '503', title: 'Adidas Samba 40', photo: 'p.jpg', price: 70 }] } });
  const ids = V.map((x) => x.id).sort().join(',');
  dit(ids === '501,502,503', 'V1 vendues : les ventes PROUVÉES de SES comptes, par n° de transaction → annonce (504 pas prouvée, 505 autre compte)', ids);
  dit(V.every((x) => x.etat === 'vendue' && x.site === 'vinted') && (V.find((x) => x.id === '501') || {}).venduLe === J, 'V1 chacune « vendue », datée de SA vente', V.map((x) => [x.id, x.venduLe]));
  dit(V.filter((x) => x.titre === 'Nike Air Max 90 taille 42').length === 2, 'V1 deux ventes au même titre = deux annonces (identité, jamais le titre)');
  dit((V.find((x) => x.id === '503') || {}).photo === 'p.jpg', 'V1 une annonce encore dans le dressing sert ses données');
  dit(S.annoncesVintedVendues({ ventes, txnItem, vendus: null, comptes }).length === 0, 'V1 preuves pas lues ⇒ aucune « vendue » (pas su ≠ oui)');

  // La base multi-sites : Vinted (vendues ci-dessus + en ligne), Leboncoin (3 vendues + 1 en ligne), eBay (1 vendue + 1 en ligne).
  const base = (site, id, compte, etat, extra = {}) => ({ site, id: String(id), compte: String(compte), pseudo: 'c' + compte, titre: site + ' ' + id, photo: null, prix: 50, taille: '', condition: '', marque: '', depuis: J - 864e5 * 10, favoris: null, vues: null, messages: null, etat, numero: '', vintedId: '', url: '', ...extra });
  const annonces = [
    ...V,
    base('vinted', 601, 11, 'enligne'), base('vinted', 602, 12, 'enligne'), base('vinted', 603, 12, 'masquee'), base('vinted', 604, 11, 'retiree'),
    base('leboncoin', 701, 'L1', 'vendue'), base('leboncoin', 702, 'L1', 'vendue'), base('leboncoin', 703, 'L1', 'vendue'), base('leboncoin', 704, 'L1', 'enligne'),
    base('ebay', 801, 'E1', 'vendue'), base('ebay', 802, 'E1', 'enligne'),
  ];
  const { articles } = M.construireArticles({ annonces, fiches: {}, faits: {}, slots: {} });
  // Les rangées du tableau, comme src/natif/ecrans/AnnoncesTableau.jsx : une par article et par compte, l'état de SON annonce.
  const rangees = (site = 'tous') => {
    const arts = articles.filter((a) => M.statutTableau(a, { site }));
    const out = [];
    for (const g of G.groupesParCompte(arts, site)) for (const a of g.articles) out.push({ a, site: g.site, statut: (g.cle !== 'sans' && M.statutTableau(a, { site: g.site, compte: g.compte })) || M.statutTableau(a, { site }) });
    return out;
  };
  const L = rangees('tous');
  const compte = (ls) => { const c = {}; for (const s of M.STATUTS_TABLEAU) c[s] = 0; for (const l of ls) if (l.statut in c) c[l.statut] += 1; return c; };
  const C = compte(L);
  const vend = L.filter((l) => l.statut === 'vendue');
  dit(C.vendue === 7 && new Set(vend.map((l) => l.site)).size === 3, 'V2 « Vendue » = toutes les vendues, tous sites (3 Vinted + 3 Leboncoin + 1 eBay = 7)', { C, sites: [...new Set(vend.map((l) => l.site))] });
  dit(M.STATUTS_TABLEAU.every((s) => C[s] === L.filter((l) => l.statut === s).length), 'V3 chaque statut : son nombre = ses rangées quand on le coche seul', C);
  const union = L.filter((l) => ['vendue', 'retiree'].includes(l.statut)).length;
  dit(union === C.vendue + C.retiree, 'V3 deux statuts cochés = l’union', union);
  for (const s of ['vinted', 'leboncoin', 'ebay']) {
    const Ls = rangees(s), Cs = compte(Ls);
    dit(Ls.every((l) => l.site === s) && Cs.vendue === L.filter((l) => l.site === s && l.statut === 'vendue').length, `V4 Site ${s} : ses rangées seulement ; Site ∩ Vendue = l’intersection (${Cs.vendue})`, Cs);
  }

  // L'écran
  const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
  const eg = lire('src/ecrans/AnnoncesEgalite.jsx'), an = lire('src/natif/ecrans/Annonces.jsx'), at = lire('src/natif/ecrans/AnnoncesTableau.jsx');
  dit(/annoncesVintedVendues\(\{/.test(eg) && /fetchTxnItemIds\(\)/.test(eg) && /lirePreuvesVenteVinted\(\)/.test(eg), 'V5 Annonces branche « Vendue » sur les preuves et le n° de transaction');
  dit(/retirees: bl \? \[\] : \(r\.autres \|\| \[\]\)/.test(eg), 'V5 les annonces Vinted retirées (fermées sans vente) sont montrées « Retirée »');
  dit(!/pied=\{\[manque, \.\.\.limites\]/.test(an) && !/plein=\{onPublier \? <Bouton variante="plein"/.test(an) && /onPublier=\{onPublier \|\| null\}/.test(an), 'V5 plus de note des limites en pied, plus de bouton plein « Publier un article » sous le tableau');
  dit(/cle: 'site', libelle: tr\('tableau\.col\.site'\)/.test(eg) && /n: nRangeesSite\(s\)/.test(eg), 'V5 le filtre s’appelle « Site » et dit le nombre de rangées de chaque site');
  dit(/statutTableau\(a, \{ site: g\.site, compte: g\.compte \}\)/.test(at), 'V5 la rangée d’un compte porte l’état de SON annonce');
  console.log(`\n${ko ? '❌' : '✅'} audit-annonces-vendues : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
