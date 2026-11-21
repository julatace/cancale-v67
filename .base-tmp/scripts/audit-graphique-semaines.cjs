// ════════════════════════════════════════════════════════════════════════════
//  « VENDU PAR SEMAINE » FAÇON SANTÉ (src/graphiqueSemaines.js, src/GraphiqueSemaines.jsx)
//        node scripts/audit-graphique-semaines.cjs [--prouve]     (8 nov., « beauté »)
//  · le détail d'une semaine rend SON montant et SES ventes tels quels (aucun
//    recalcul), l'écart à la précédente juste, pas de % sur une semaine à 0 € ;
//  · les graduations sont rondes, commencent à 0 et couvrent le maximum ;
//  · la semaine sous le doigt : bornée, jamais hors du graphique ;
//  · branchement : Statistiques nourrit le graphique de `rythmeVendu(liveStats.venduLignes)`
//    (la règle de « Vendu », `ventesFaites`), « au moins » si une plateforme manque,
//    un tableau caché pour le lecteur d'écran, le clavier (← →) ; les 12 semaines ne
//    sont plus redites dans le volet replié.
//  `--prouve` : chaque mutation ⇒ au moins un rouge.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher();
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const R = path.join(__dirname, '..');
const SRC = path.join(R, 'src', 'graphiqueSemaines.js'), JSX = path.join(R, 'src', 'GraphiqueSemaines.jsx'), STATS = path.join(R, 'src', 'ecrans', 'Stats.jsx');

async function verifier({ src, jsx, stats }, bavard = true) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsem-')); const f = path.join(tmp, 'g.mjs'); fs.writeFileSync(f, src);
  let G; try { G = await import(pathToFileURL(f).href + '?' + Math.random()); } catch (e) { dit(false, 'le module se charge', e.message); return ko; }
  const S = [{ debut: 1, eur: 120, n: 3 }, { debut: 2, eur: 150.5, n: 4 }, { debut: 3, eur: 0, n: 0 }, { debut: 4, eur: 80, n: 2, enCours: true }];
  const d1 = G.detailSemaine(S, 1);
  dit(d1.eur === 150.5 && d1.n === 4 && d1.avant === 120 && d1.ecart === 30.5 && d1.pct === 25, 'semaine touchée : son montant et ses ventes tels quels, +30,50 € soit +25 % sur la précédente', JSON.stringify(d1));
  const d3 = G.detailSemaine(S, 3, { partiel: true });
  dit(d3.pct === null && d3.ecart === 80 && d3.enCours && d3.auMoins, 'après une semaine à 0 € : pas de %, l’écart en euros ; en cours et « au moins » portés', JSON.stringify(d3));
  dit(G.detailSemaine(S, 0).avant === null && G.detailSemaine(S, 9) === null, 'la première semaine n’a pas de comparaison ; hors liste ⇒ rien');
  const ok = (max) => { const g = G.graduations(max); const pas = g[1] - g[0]; return g[0] === 0 && g[g.length - 1] >= max && g.length <= 5 && [1, 2, 2.5, 5].some((k) => Math.abs(pas / Math.pow(10, Math.floor(Math.log10(pas))) - k) < 1e-9); };
  const essais = [1, 7, 42, 99, 100, 101, 333, 1645, 2066.8, 9999];
  dit(essais.every(ok), 'graduations rondes (1 · 2 · 2,5 · 5 × 10ⁿ), de 0 au-delà du maximum, cinq au plus', essais.map((m) => `${m}→${G.graduations(m).join('/')}`).join(' '));
  dit(G.graduations(0).join() === '0', 'aucune vente ⇒ une seule ligne de base');
  dit(G.semaineSous(-5, 300, 12) === 0 && G.semaineSous(299, 300, 12) === 11 && G.semaineSous(400, 300, 12) === 11 && G.semaineSous(130, 300, 12) === 5, 'la semaine sous le doigt reste dans le graphique');
  // Branchement.
  dit(/rythmeVendu\(vendu\)[\s\S]{0,1400}<GraphiqueSemaines semaines=\{R\.semaines\} partiel=\{manque\.length > 0\}/.test(stats), 'Statistiques le nourrit de rythmeVendu(liveStats.venduLignes) (la règle de « Vendu »), « au moins » si une plateforme manque');
  dit(!/BarresStats valeurs=\{R\.semaines/.test(stats), 'les 12 semaines ne sont plus redites dans le volet replié (un nombre, une place)');
  dit(/<table className="vrm-sr-seul">/.test(jsx) && /onKeyDown=\{clavier\}/.test(jsx) && /ArrowLeft/.test(jsx), 'tableau pour le lecteur d’écran, flèches du clavier');
  dit(/aria-live="polite"/.test(jsx) && /data-sante-montant=\{Math\.round\(D\.eur \* 100\)\}/.test(jsx), 'le détail est annoncé, son montant porté en attribut (les bancs jugent le nombre)');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  return ko;
}
(async () => {
  const b = { src: fs.readFileSync(SRC, 'utf8'), jsx: fs.readFileSync(JSX, 'utf8'), stats: fs.readFileSync(STATS, 'utf8') };
  const ko = await verifier(b);
  if (process.argv.includes('--prouve')) {
    const M = [
      ['% sur une semaine à 0 €', (x) => ({ ...x, src: x.src.replace('const pct = avant ? ', 'const pct = avant != null ? ') })],
      ['montant arrondi au détail', (x) => ({ ...x, src: x.src.replace('const eur = Number(s.eur) || 0;', 'const eur = Math.round(Number(s.eur) || 0);') })],
      ['graduations à pas de 3', (x) => ({ ...x, src: x.src.replace('[1, 2, 2.5, 5, 10]', '[1, 3, 10]') })],
      ['semaine hors du graphique', (x) => ({ ...x, src: x.src.replace('Math.max(0, Math.min(n - 1,', '(((') })],
      ['« au moins » perdu', (x) => ({ ...x, stats: x.stats.replace('partiel={manque.length > 0}', 'partiel={false}') })],
      ['plus de tableau caché', (x) => ({ ...x, jsx: x.jsx.replace('<table className="vrm-sr-seul">', '<table>') })],
    ];
    let rates = 0;
    for (const [nom, mut] of M) { const m = mut(b); if (JSON.stringify(m) === JSON.stringify(b)) { console.log('KO  mutation sans effet : ' + nom); rates++; continue; } const k = await verifier(m, false); console.log((k ? 'OK  mutation rouge : ' : 'KO  mutation VERTE : ') + nom); if (!k) rates++; }
    if (rates) process.exit(1);
  }
  console.log(ko ? `\n${ko} échec(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
