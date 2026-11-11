// Audit : STATISTIQUES PAR CATÉGORIE (11 nov., lot stats-categories) —
// src/statsCategories.js EXÉCUTÉ, et ses branchements.
//   · la famille vient du CHEMIN du catalogue Vinted (le plus précis d'abord :
//     des lunettes rangées sous « Accessoires » sont des Lunettes) ; chemin vide
//     ⇒ « pas su », jamais une famille ;
//   · 50 ventes au MÊME titre : seules celles dont l'annonce porte une catégorie
//     LUE sont rangées, les autres restent « Sans catégorie » (la règle ne lit
//     jamais le titre, §5) ;
//   · une catégorie LUE gagne sur le choix à la main ; SON clic n'écrase jamais une lue ;
//   · le brut : seulement les ventes au prix d'achat connu, la couverture « N sur M » ;
//   · un vendeur d'UNE catégorie ne voit pas le bloc ;
//   · branchements : Statistiques importe CES règles, la clé est synchronisée,
//     l'écran Annonces publie le stock par catégorie.
// `--prouve` : chaque règle réaffaiblie doit faire passer l'audit au rouge.
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const FICHIER = path.join(R, 'src', 'statsCategories.js');
const SRC = fs.readFileSync(FICHIER, 'utf8');
const APP = require('./_source-app.cjs').sourceAppDe(path.join(R, 'src', 'App.jsx'));
const STATS = fs.readFileSync(path.join(R, 'src', 'ecrans', 'Stats.jsx'), 'utf8');
const PROFIL = fs.readFileSync(path.join(R, 'src', 'profilVendeur.js'), 'utf8');

const MUTATIONS = {
  main_avant_lue: (s) => s.replace("if (id && table && table[id]) return { famille: table[id], source: 'vinted' };\n  const m =", "const m0 = main && cle && main[cle] && main[cle].f; if (m0 && estFamille(m0)) return { famille: m0, source: 'main' };\n  if (id && table && table[id]) return { famille: table[id], source: 'vinted' };\n  const m ="),
  lunettes_oubliees: (s) => s.replace("  ['lunettes', /lunette/],\n", ''),
  chemin_vide_devine: (s) => s.replace("if (!ch) return '';", "if (!ch) return 'autre';"),
  sans_categorie_range: (s) => s.replace("const f = famDe ? famDe(l.plateforme, l.tx) : null;", "const f = (famDe ? famDe(l.plateforme, l.tx) : null) || { famille: 'chaussures', source: 'main' };"),
  une_famille_montree: (s) => s.replace('if (S.familles >= 2) return true;', 'if (S.familles >= 1) return true;'),
  main_ecrase_lue: (s) => s.replace('if (!k || sauf.has(k)) continue;', 'if (!k) continue;'),
  couverture_perdue: (s) => s.replace('x.nCout = t.nCout;', 'x.nCout = t.n;'),
  famille_inventee_acceptee: (s) => s.replace("if (!estFamille(famille)) continue;\n", ''),
};

async function charger(src) {
  const f = path.join(R, 'src', `.audit-statsCategories-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

async function audit(src, bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
  let M;
  try { M = await charger(src); } catch (e) { dit(false, 'le module se charge', e.message); return ko || 1; }
  const { familleDeChemin, tableFamilles, familleDeVente, cleVente, statsParCategorie, stockParFamille, afficherCategories, ecritureCategoriesMain, FAMILLES_STATS } = M;

  // 1. Le chemin du catalogue Vinted → la famille.
  const cas = [
    ['Femmes > Accessoires > Lunettes de soleil', 'lunettes'], ['Hommes > Accessoires > Montres', 'montres'],
    ['Femmes > Accessoires > Bijoux > Colliers', 'bijoux'], ['Hommes > Accessoires > Sacs et sacoches', 'sacs'],
    ['Hommes > Chaussures > Baskets', 'chaussures'], ['Femmes > Vêtements > Robes', 'vetements'],
    ['Électronique > Jeux vidéo et consoles > Consoles', 'jeux'], ['Divertissement > Livres > Romans', 'livres'],
    ['Maison > Décoration > Bougies', 'maison'], ['Femmes > Beauté > Maquillage', 'beaute'],
    ['Enfants > Jouets > Peluches', 'jouets'], ['Animaux > Laisses', 'autre'],
  ];
  for (const [ch, f] of cas) dit(familleDeChemin(ch) === f, `« ${ch} » ⇒ ${f}`, familleDeChemin(ch));
  dit(familleDeChemin('') === '' && familleDeChemin(null) === '', 'chemin vide ⇒ « pas su » (aucune famille devinée)');

  // 2. La table du catalogue, à la FORME mesurée (`catalogs`, `path`, `title`).
  const catV = { catalogs: [
    { id: 1904, title: 'Femmes', path: '', catalogs: [{ id: 1, title: 'Accessoires', path: 'Femmes', catalogs: [{ id: 26, title: 'Lunettes de soleil', path: 'Femmes > Accessoires', catalogs: [] }] },
      { id: 16, title: 'Chaussures', path: 'Femmes', catalogs: [{ id: 2632, title: 'Baskets', path: 'Femmes > Chaussures', catalogs: [] }] }] },
    { id: 5, title: 'Hommes', catalogs: [{ id: 2050, title: 'Vêtements', catalogs: [{ id: 76, title: 'Tee-shirts', catalogs: [] }] }] },
  ] };
  const T = tableFamilles(catV) || {};
  dit(T['26'] === 'lunettes' && T['2632'] === 'chaussures' && T['76'] === 'vetements', 'table du catalogue : 26 lunettes, 2632 chaussures, 76 vêtements (chemin sans `path` reconstruit)', JSON.stringify(T));
  dit(tableFamilles(null) === null && tableFamilles({}) === null, 'catalogue illisible ⇒ null (pas su)');

  // 3. Cinquante ventes au MÊME titre : seule la catégorie LUE range.
  const vendu = [], releve = [], catDe = {};
  for (let i = 0; i < 50; i++) {
    const tx = String(9000 + i);
    vendu.push({ plateforme: 'Vinted', tx, eur: 40, ts: 1, titre: 'Lunettes Ray-Ban Aviator noires' });
    releve.push({ plateforme: 'Vinted', id: tx, eur: 40, achat: i < 10 ? 15 : null, ts: 2e12, enLigne: 2e12 - 4 * 86400000, titre: 'Lunettes Ray-Ban Aviator noires' });
    if (i < 20) catDe[tx] = '26';
  }
  const famDe = (plat, id) => familleDeVente({ catalogId: plat === 'Vinted' ? catDe[String(id)] : null, table: T, main: {}, cle: cleVente(plat, id) });
  const S = statsParCategorie({ vendu, releve, famDe, stock: { lunettes: 3 } });
  const L = S && S.groupes.find((g) => g.v === 'lunettes');
  dit(L && L.n === 20 && S.sans.n === 30 && S.groupes.length === 1, '50 ventes « Lunettes Ray-Ban » : 20 rangées (catégorie lue), 30 « Sans catégorie » — le titre ne range rien', JSON.stringify(S && { g: S.groupes.map((g) => [g.v, g.n]), sans: S.sans.n }));
  dit(S && S.sans.cles.length === 30 && S.sans.cles.every((k) => /^vinted:90(2\d|3\d|4\d)$/.test(k)), 'chaque vente sans catégorie est NOMMÉE par son identifiant (vinted:tx)', S && S.sans.cles.slice(0, 3).join(','));
  dit(L && L.fin === 20 && L.nCout === 10 && L.brut === 250, 'brut des seules ventes au prix connu : 10 × (40 − 15) = 250 €, couverture 10 sur 20', JSON.stringify(L && { fin: L.fin, nCout: L.nCout, brut: L.brut }));
  dit(L && L.mediane === 4 && L.nDelai === 20 && L.stock === 3, 'délai médian 4 j sur 20 ventes datées ; 3 en ligne', JSON.stringify(L && { m: L.mediane, n: L.nDelai, s: L.stock }));
  dit(S && S.n === 50 && S.eur === 2000, 'le total du bloc = toutes les ventes de la période (50, 2 000 €)', JSON.stringify(S && { n: S.n, eur: S.eur }));

  // 4. Lue gagne ; la main remplit seulement un blanc ; une famille inventée ne passe pas.
  const main = { 'vinted:1': { f: 'vetements' }, 'lbc:7': { f: 'sacs' }, 'ebay:8': { f: 'inventee' } };
  const a = familleDeVente({ catalogId: '26', table: T, main, cle: 'vinted:1' });
  const b = familleDeVente({ catalogId: null, table: T, main, cle: 'lbc:7' });
  const c = familleDeVente({ catalogId: null, table: T, main, cle: 'ebay:8' });
  dit(a && a.famille === 'lunettes' && a.source === 'vinted', 'catégorie LUE (lunettes) gagne sur la main (vêtements)', JSON.stringify(a));
  dit(b && b.famille === 'sacs' && b.source === 'main', 'sans catégorie lue : SON choix compte (Leboncoin → Sacs)', JSON.stringify(b));
  dit(c === null, 'une famille inconnue dans la table ⇒ rien', JSON.stringify(c));
  dit(familleDeVente({ catalogId: '999', table: T, main: {}, cle: 'vinted:2' }) === null, 'catégorie Vinted absente du catalogue ⇒ sans catégorie (pas devinée)');
  dit(cleVente('Leboncoin', 'lbc:42') === 'lbc:42' && cleVente('Leboncoin', '42') === 'lbc:42' && cleVente('Vinted', '') === '', 'clé de vente : la même pour le vendu et le relevé');

  // 5. SON clic : écrit les cochées, jamais une lue, jamais une famille inventée.
  const e1 = ecritureCategoriesMain({ 'lbc:1': { f: 'sacs', at: 1 } }, ['vinted:5', 'vinted:6', 'lbc:2'], 'lunettes', ['vinted:6'], 9);
  dit(e1['vinted:5'] && e1['vinted:5'].f === 'lunettes' && !e1['vinted:6'] && e1['lbc:2'].f === 'lunettes' && e1['lbc:1'].f === 'sacs', 'écriture : les cochées rangées, la lue jamais touchée, l’existant gardé', JSON.stringify(e1));
  const e2 = ecritureCategoriesMain({ 'lbc:1': { f: 'sacs' } }, ['lbc:3'], 'nimporte', [], 9);
  dit(!e2['lbc:3'], 'une famille inventée n’est pas écrite');
  const e3 = ecritureCategoriesMain({ 'lbc:1': { f: 'sacs' } }, ['lbc:1'], '', [], 9);
  dit(!e3['lbc:1'], 'famille vide ⇒ le choix est retiré');

  // 6. Afficher le bloc ? Une seule catégorie ⇒ non.
  const un = statsParCategorie({ vendu: vendu.slice(0, 20), releve: [], famDe, stock: null });
  dit(afficherCategories(un, 'sneakers') === false && afficherCategories(un, 'auto') === false, 'une seule catégorie ⇒ bloc caché', JSON.stringify(un && un.familles));
  const deux = statsParCategorie({ vendu: [...vendu.slice(0, 20), { plateforme: 'Leboncoin', tx: '7', eur: 30, ts: 1 }], releve: [], famDe: (p, id) => (p === 'Leboncoin' ? familleDeVente({ main, cle: cleVente(p, id) }) : famDe(p, id)), stock: null });
  dit(afficherCategories(deux, 'sneakers') === true, 'deux catégories ⇒ bloc montré');
  dit(afficherCategories(S, 'autre') === true && afficherCategories(S, 'sneakers') === false, 'une catégorie + des ventes sans catégorie : montré seulement s’il vend « autre chose »');
  dit(afficherCategories(null, 'autre') === false && statsParCategorie({ vendu: null }) === null, 'ventes pas lues ⇒ rien (jamais un bloc vide)');

  // 7. Le stock par famille : la table manque ⇒ pas su.
  const st = stockParFamille({ '26': 2, '2632': 3, '': 4, '999': 1 }, T);
  dit(st && st.lunettes === 2 && st.chaussures === 3 && st[''] === 5, 'stock : 2 lunettes, 3 chaussures, 5 sans catégorie (dont une catégorie inconnue)', JSON.stringify(st));
  dit(stockParFamille({ '26': 2 }, null) === null && stockParFamille(null, T) === null, 'stock sans table ou sans publication ⇒ null (pas su)');

  // 8. Les familles et les tuiles de « Tu vends quoi ? ».
  const tuiles = [...PROFIL.matchAll(/\{ v: '([a-z]+)', titre:/g)].map((m) => m[1]);
  const sansTuile = FAMILLES_STATS.filter((f) => f.tuile !== 'lunettes' && !tuiles.includes(f.tuile)).map((f) => f.v);
  dit(sansTuile.length === 0, 'chaque famille correspond à une tuile de « Tu vends quoi ? » (Lunettes : lot DJ2)', sansTuile.join(','));
  dit(!/(?<![\w.])(?!c\.)[a-z]\.(titre|title|marque|brand)\b|familleArticle/.test(src.replace(/\/\/[^\n]*/g, '')), 'la règle ne lit ni le titre, ni la marque d’une vente, ni `familleArticle`');
  return ko;
}

(async () => {
  const prouve = process.argv.includes('--prouve');
  let ko = await audit(SRC, true);
  // Branchements (une fois, sur le vrai code).
  const b = (c, m) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m); };
  b(/from '\.\.\/statsCategories\.js'/.test(STATS) && /statsParCategorie\(\{ vendu, releve: lp, famDe/.test(STATS), 'Statistiques importe et exécute `statsParCategorie`');
  b(/<ParCategorie vendu=\{Array\.isArray\(vendu\) \? vendu\.filter\(dansP\)/.test(STATS), 'la carte reçoit le VENDU de la période choisie (mêmes ventes que la tuile)');
  const corpsCarte = (STATS.match(/function ParCategorie[\s\S]*?\n}\n/) || [''])[0];
  b(corpsCarte && !/familleArticle|extractModel|normTitle/.test(corpsCarte), 'la carte ne devine rien par le titre');
  b(/'vrm_categories_main',/.test(APP), 'SON choix est synchronisé (SYNC_KEYS)');
  b(/parCatalogue\[k\] = \(parCatalogue\[k\] \|\| 0\) \+ 1/.test(APP) && /dort: stockDort, parCatalogue/.test(APP), 'l’écran Annonces publie le stock par catégorie Vinted (`vrm_stats_stock.parCatalogue`)');
  b(/lignes\.push\(\{ plateforme: 'Leboncoin'[^\n]*tx: String\(v\.txId\)/.test(APP) && /plateforme: 'eBay'[^\n]*tx: String\(e\.orderId\)/.test(APP) && /plateforme: 'Vestiaire'[^\n]*tx: String\(v\.id\)/.test(APP), 'chaque ligne du vendu porte l’identité de SA vente (Leboncoin, eBay, Vestiaire)');
  b(!/select=data[&`]/.test(corpsCarte) && /->>catalogId/.test(STATS), 'les catégories des fiches se lisent en scalaire, jamais `select=data`');
  if (prouve) {
    console.log('\n── Preuve par mutation');
    for (const [nom, mut] of Object.entries(MUTATIONS)) {
      const m = mut(SRC);
      if (m === SRC) { ko++; console.log(`❌ mutation ${nom} : ne s’applique pas`); continue; }
      const k = await audit(m, false);
      if (k > 0) console.log(`✅ mutation ${nom} : rouge (${k})`); else { ko++; console.log(`❌ mutation ${nom} : reste verte`); }
    }
  }
  console.log(ko ? `\n❌ audit-stats-categories : ${ko} rouge(s)` : '\n✅ audit-stats-categories : tout vert');
  process.exit(ko ? 1 : 0);
})();
