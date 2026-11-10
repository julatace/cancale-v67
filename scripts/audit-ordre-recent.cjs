// Audit : L'ORDRE DES LISTES — LE PLUS RÉCENT EN HAUT, TOUS COMPTES MÉLANGÉS (lot AJ, 9 nov. soir).
// Julien : « Les ventes, achats, colis à expédier, à préparer ne sont pas rangés dans l'ordre, du plus
// récent en haut au plus vieux en bas, peu importe le compte, ça doit être parfait. »
//   R. la règle pure (src/ordreRecent.js) : dates de types différents (ISO, ms, secondes, Date),
//      comptes mélangés, égalité STABLE, sans date en bas, rien muté ; dates de référence par type ;
//      les points « À retirer » (un point = une carte, rangés par arrivée lue) ;
//   S. le code de l'app passe par elle (aucun « compte choisi en tête », aucune « étape d'abord »,
//      aucun groupe par transporteur dans « À envoyer », Préparer = la liste).
// `--module chemin` : une autre copie de ordreRecent.js (mutation) ; `--racine dossier` : un autre arbre.
const path = require('path');
const fs = require('fs');
const argv = process.argv.slice(2);
const RACINE = argv.includes('--racine') ? path.resolve(argv[argv.indexOf('--racine') + 1]) : path.join(__dirname, '..');
const MODULE = argv.includes('--module') ? path.resolve(argv[argv.indexOf('--module') + 1]) : path.join(RACINE, 'src', 'ordreRecent.js');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + d : '')); };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');

(async () => {
  let M = null;
  try { M = await import(MODULE); } catch (e) { dit(false, 'R. src/ordreRecent.js existe et se charge', String(e && e.message).slice(0, 120)); }
  if (M) {
    const J = 864e5, T0 = Date.UTC(2026, 10, 9, 10, 0, 0);
    // Deux comptes, des formes de date différentes, une égalité, deux sans date.
    const L = [
      { id: 'a1', compte: 'A', d: new Date(T0 - 3 * J).toISOString() },
      { id: 'b1', compte: 'B', d: T0 - 1 * J },                         // ms
      { id: 'a2', compte: 'A', d: null },                               // sans date
      { id: 'b2', compte: 'B', d: Math.floor((T0 - 2 * J) / 1000) },    // secondes Unix
      { id: 'a3', compte: 'A', d: new Date(T0 - 1 * J) },               // Date, même instant que b1
      { id: 'b3', compte: 'B', d: 'pas une date' },                     // illisible ⇒ sans date
      { id: 'a4', compte: 'A', d: new Date(T0 - 5 * J).toISOString() },
    ];
    const avant = JSON.stringify(L);
    const R = M.ordreRecent(L, (x) => x.d).map((x) => x.id).join(',');
    dit(R === 'b1,a3,b2,a1,a4,a2,b3', 'R1 le plus récent en haut, comptes entrelacés, égalité stable (b1 avant a3), sans date en bas dans l’ordre reçu', R);
    dit(JSON.stringify(L) === avant, 'R2 la liste reçue n’est pas modifiée');
    const comptes = M.ordreRecent(L, (x) => x.d).map((x) => x.compte).join('');
    dit(comptes === 'BABAAAB', 'R3 jamais groupé par compte (B, A, B, A…)', comptes);
    dit(M.nbSansDate(L, (x) => x.d) === 2, 'R4 deux lignes sans date lue, comptées pour être dites');
    dit(M.debutSansDate(M.ordreRecent(L, (x) => x.d), (x) => x.d) === 5, 'R5 « Sans date lue » posée au-dessus de la 6ᵉ ligne');
    dit(M.msDe(0) === null && M.msDe('') === null && M.msDe(undefined) === null, 'R6 0, vide, absent ⇒ pas de date (jamais 1970)');
    dit(M.ordreRecent(null, (x) => x).length === 0, 'R7 rien reçu ⇒ liste vide, pas d’erreur');
    // Dates de référence par type.
    dit(M.quandCommandeVinted({ date: '2026-11-08T10:00:00Z' }) === Date.parse('2026-11-08T10:00:00Z'), 'R8 vente/achat Vinted : `date`');
    dit(M.quandLeboncoin({ txId: 'x', dateVente: null }, { x: '2026-11-07T08:00:00Z' }) === Date.parse('2026-11-07T08:00:00Z'), 'R9 Leboncoin : la date relevée (`vrm_lbc_dates`) quand la vente n’en porte pas');
    dit(M.quandLeboncoin({ txId: 'x', dateVente: '2026-11-01T08:00:00Z' }, { x: '2026-11-07T08:00:00Z' }) === Date.parse('2026-11-01T08:00:00Z'), 'R10 Leboncoin : une date de vente LUE gagne toujours');
    dit(M.quandEbay({ creationDate: '2026-11-05T08:00:00Z' }) === Date.parse('2026-11-05T08:00:00Z'), 'R11 eBay : `creationDate`');
    dit(M.quandVestiaire({ premiereVue: '2026-11-04T08:00:00Z' }) === Date.parse('2026-11-04T08:00:00Z'), 'R12 Vestiaire : la première lecture quand la date manque');
    const colis = [
      { key: 'v1', o: { date: new Date(T0 - 4 * J).toISOString() }, dl: 0 },        // urgent mais ancien
      { __autre: 'vc', key: 'vc1', v: { date: new Date(T0 - 1 * J).toISOString() }, dl: 6 },
      { __autre: 'eb', key: 'e1', x: { ordre: { creationDate: new Date(T0 - 2 * J).toISOString() } }, dl: 1 },
      { __autre: 'lbc', key: 'l1', x: {}, o: { at: new Date(T0 - 3 * J).toISOString() }, dl: null },
      { key: 'v2', o: { date: null }, dl: 2 },
    ];
    const C = M.ordreRecent(colis, M.quandColisAEnvoyer).map((x) => x.key).join(',');
    dit(C === 'vc1,e1,l1,v1,v2', 'R13 « À envoyer » / « Préparer » : la vente la plus récente en haut, tous sites — plus la limite la plus proche', C);
    // À retirer : un point = une carte, rangés par leur arrivée la plus récente.
    if (typeof M.ordreRecentPoints === 'function') {
      const pts = M.ordreRecentPoints([
        { cle: 'p1', arrives: [{ id: 'c1', arrivee: T0 - 4 * J }, { id: 'c2', arrivee: T0 - 1 * J }], attendus: [] },
        { cle: 'inc', inconnu: true, arrives: [{ id: 'c9', arrivee: T0 }], attendus: [] },
        { cle: 'p2', arrives: [{ id: 'c3', arrivee: T0 - 2 * J }, { id: 'c4', aVerifier: true, arrivee: T0 }], attendus: [] },
        { cle: 'p3', arrives: [], attendus: [{ id: 'r1' }] },
        { cle: 'p4', arrives: [{ id: 'c5', arrivee: null }], attendus: [] },
      ]);
      const ordreP = pts.map((p) => p.cle).join(',');
      dit(ordreP === 'p1,p2,p4,p3,inc', 'R14 « À retirer » : les points par arrivée la plus récente, sans date après, « en route » puis « pas connu » à la fin', ordreP);
      const c1 = pts[0].arrives.map((c) => c.id).join(','), c2 = pts[1].arrives.map((c) => c.id).join(',');
      dit(c1 === 'c2,c1' && c2 === 'c3,c4', 'R15 dans un point : arrivée la plus récente en haut, « à vérifier » sous les comptés', c1 + ' | ' + c2);
    } else dit(false, 'R14 `ordreRecentPoints` existe');
  }

  // ── S. le code de l'app ─────────────────────────────────────────────────────
  const lire = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };
  const app = sansCommentaires(lire('src/App.jsx'));
  const bloc = (debut, n = 4000) => { const i = app.indexOf(debut); return i < 0 ? '' : app.slice(i, i + n); };
  const ventes = bloc('const ventesAffichees = useMemo(', 6000);
  dit(/ordreRecent\(arr, quandCommandeVinted\)/.test(ventes), 'S1 Ventes Vinted : la règle unique');
  dit(!/ac===bc|ac === bc/.test(ventes.slice(0, ventes.indexOf('const ventesSansDate') > 0 ? ventes.indexOf('const ventesSansDate') : 6000)), 'S2 Ventes Vinted : le compte choisi ne passe plus en tête');
  const achats = bloc('const achatsAffiches = useMemo(', 3000);
  dit(/ordreRecent\(arr, \(x\) => quandCommandeVinted\(x\.o\)\)/.test(achats) && !/x\.st\.step===3\?0/.test(achats) && !/ac===bc/.test(achats), 'S3 Achats Vinted : la règle unique, ni étape d’abord ni compte en tête');
  dit(/return ordreRecent\(out, \(l\) => l\.t\)/.test(app), 'S4 Ventes « Tous » : la règle unique');
  dit(/const rangerColisEnvoi = \(tous\) => ordreRecent\(tous, quandColisAEnvoyer\)/.test(app), 'S5 « À envoyer », Préparer, la tournée : `rangerColisEnvoi` = la règle unique');
  dit(/const colisAEnvoyerRanges = \(\) => \{[^\n]*rangerColisEnvoi\(/.test(app) && /const colisPreparer = \(\) => \{\s*let ranges = \[\]; try \{ ranges = colisAEnvoyerRanges\(\)/.test(app), 'S6 « Préparer mes colis » suit l’ordre de la liste');
  const env = bloc('const exT = rangerColisEnvoi(tousF', 9000);
  dit(!!env && !/data-groupe-transp/.test(env) && /filtresTransporteurs\(tous/.test(app), 'S7 « À envoyer » : aucun groupe par transporteur, une pastille (filtre)');
  dit(/ordonner: ordreRecentPoints/.test(app), 'S8 « À retirer » : les points rangés par arrivée lue');
  dit(/LigneSansDate/.test(app), 'S9 « sans date lue » est dit');
  dit(/ordreRecent\(/.test(lire('src/ecrans/Vestiaire.jsx')) && /ordreRecent\(/.test(lire('src/ecrans/Ebay.jsx')), 'S10 Vestiaire et eBay : la règle unique');
  dit(/return ordreRecent\(liste, quand\)/.test(lire('src/colisEnvoyes.js')), 'S11 « Envoyés » : `rangerEnvoyes` = la règle unique');
  console.log(ko ? `\n❌ audit-ordre-recent : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-ordre-recent : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
