// ════════════════════════════════════════════════════════════════════════════
//  « Le rythme des relectures de fond » (src/rythmeLectures.js, 6 nov.) — la
//  VRAIE règle EXÉCUTÉE contre un faux document, une fausse fenêtre et une
//  horloge à la main. Ce qui est jugé, c'est ce qui SE PASSE (combien de tics
//  disent « lis »), jamais l'orthographe du code :
//   1. onglet visible, quelqu'un s'en sert : un tic par période dit « lis » ;
//   2. onglet CACHÉ : aucun tic ne dit « lis », pendant des heures ;
//   3. visible mais personne n'y touche depuis 10 min : une lecture toutes les
//      5 périodes (au moins 5 min) ;
//   4. la main revient (souris, clavier, doigt, retour sur l'onglet) après
//      l'inactivité : les écouteurs `surReveil` sont appelés TOUT DE SUITE, une
//      fois ; et le rythme normal reprend ;
//   5. la main revient alors que l'onglet est caché : rien n'est appelé ;
//   6. `noter` (une relecture faite ailleurs) repousse le tic suivant ;
//   7. deux clés ne se gênent pas.
//  Le banc `scripts/bancs/charge-navigateur.cjs` juge l'app rendue.
//  `--prouve` réaffaiblit la règle (quatre mutations) et exige du ROUGE.
//  Lancer : node scripts/audit-rythme-lectures.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const SRC = path.join(__dirname, '..', 'src', 'rythmeLectures.js');

async function charger(texte) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rythme-'));
  const f = path.join(dir, 'r.mjs');
  fs.writeFileSync(f, texte);
  return import(pathToFileURL(f).href);
}
function faux() {
  const ecoute = { doc: {}, win: {} };
  const doc = { hidden: false, visibilityState: 'visible', addEventListener: (e, f) => { (ecoute.doc[e] = ecoute.doc[e] || []).push(f); } };
  const win = { addEventListener: (e, f) => { (ecoute.win[e] = ecoute.win[e] || []).push(f); } };
  const lancer = (cible, e) => { for (const f of (ecoute[cible][e] || [])) f({}); };
  return { doc, win, lancer };
}

async function verifier(mod) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (!process.env.SILENCE) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null ? ' — ' + d : '')); };
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 160)); } };
  const MIN = 60 * 1000;
  // Un minuteur de 60 s qui tourne `n` minutes : combien de « lis » ?
  const tourner = (r, horloge, n, cle = 'k', periode = MIN) => { let lus = 0; for (let i = 0; i < n; i++) { horloge.t += MIN; if (r.doitLire(cle, periode)) lus++; } return lus; };

  await essaie('1', async () => {
    const F = faux(); const h = { t: 1e9 };
    const r = mod.creerRythme({ doc: F.doc, win: F.win, maintenant: () => h.t });
    let lus = 0;
    for (let i = 0; i < 9; i++) { h.t += MIN; F.lancer('win', 'pointerdown'); if (r.doitLire('k', MIN)) lus++; }
    dit(lus === 9, '1. visible, quelqu\'un s\'en sert : une lecture par minute (9 en 9 min)', lus);
  });
  await essaie('2', async () => {
    const F = faux(); const h = { t: 1e9 };
    const r = mod.creerRythme({ doc: F.doc, win: F.win, maintenant: () => h.t });
    F.doc.hidden = true; F.doc.visibilityState = 'hidden';
    const lus = tourner(r, h, 180);
    dit(lus === 0, '2. onglet caché : aucune lecture en 3 heures', lus);
  });
  await essaie('3', async () => {
    const F = faux(); const h = { t: 1e9 };
    const r = mod.creerRythme({ doc: F.doc, win: F.win, maintenant: () => h.t });
    tourner(r, h, 11);                               // passé 10 min sans geste
    const lus = tourner(r, h, 60);
    dit(lus >= 10 && lus <= 13, '3. visible sans geste depuis 10 min : une lecture toutes les 5 min (≈12 par heure)', lus);
  });
  await essaie('4', async () => {
    const F = faux(); const h = { t: 1e9 };
    const r = mod.creerRythme({ doc: F.doc, win: F.win, maintenant: () => h.t });
    let reveils = 0; r.surReveil(() => { reveils++; });
    tourner(r, h, 15);
    F.lancer('win', 'keydown');
    dit(reveils === 1, '4. la main revient après l\'inactivité : les relectures en retard partent TOUT DE SUITE (une fois)', reveils);
    F.lancer('win', 'mousemove'); F.lancer('win', 'pointerdown');
    dit(reveils === 1, '4. les gestes suivants ne relancent rien', reveils);
    h.t += 2 * MIN; F.lancer('win', 'pointerdown');
    dit(r.doitLire('k2', MIN) && (h.t += MIN, F.lancer('win', 'pointerdown'), r.doitLire('k2', MIN)), '4. puis le rythme normal reprend (une par minute)');
    // Retour sur l'onglet après une longue absence.
    const F2 = faux(); const h2 = { t: 1e9 };
    const r2 = mod.creerRythme({ doc: F2.doc, win: F2.win, maintenant: () => h2.t });
    let rv2 = 0; r2.surReveil(() => { rv2++; });
    F2.doc.hidden = true; F2.doc.visibilityState = 'hidden';
    h2.t += 30 * MIN;
    F2.doc.hidden = false; F2.doc.visibilityState = 'visible'; F2.lancer('doc', 'visibilitychange');
    dit(rv2 === 1, '4. revenir sur l\'onglet après 30 min relit tout de suite', rv2);
  });
  await essaie('5', async () => {
    const F = faux(); const h = { t: 1e9 };
    const r = mod.creerRythme({ doc: F.doc, win: F.win, maintenant: () => h.t });
    let reveils = 0; r.surReveil(() => { reveils++; });
    F.doc.hidden = true; F.doc.visibilityState = 'hidden';
    h.t += 20 * MIN; F.lancer('win', 'mousemove');
    dit(reveils === 0, '5. un geste sur un onglet caché (souris qui passe) ne relit rien', reveils);
  });
  await essaie('6-7', async () => {
    const F = faux(); const h = { t: 1e9 };
    const r = mod.creerRythme({ doc: F.doc, win: F.win, maintenant: () => h.t });
    h.t += MIN; F.lancer('win', 'pointerdown');
    dit(r.doitLire('a', MIN) === true, '6. première lecture');
    h.t += 30 * 1000; r.noter('a'); h.t += 40 * 1000; F.lancer('win', 'pointerdown');
    dit(r.doitLire('a', MIN) === false, '6. une relecture faite ailleurs (`noter`) il y a 40 s repousse le tic');
    dit(r.doitLire('b', MIN) === true, '7. une autre clé n\'est pas gênée');
  });
  return ko;
}

(async () => {
  const texte = fs.readFileSync(SRC, 'utf8');
  console.log('── la règle telle qu\'elle est');
  const ko = await verifier(await charger(texte));
  let koMut = 0;
  if (process.argv.includes('--prouve')) {
    const mutations = [
      ['onglet caché ignoré', 'if (cache()) return false;\n    const t = maintenant();', 'const t = maintenant();'],
      ['pas de ralenti sans geste', '(inactif(t) ? Math.max(periodeMs * facteur, minInactif) : periodeMs)', 'periodeMs'],
      ['pas de réveil', 'if (dormait && !cache()) for', 'if (false) for'],
      ['réveil même caché', 'if (dormait && !cache()) for', 'if (dormait) for'],
    ];
    for (const [nom, a, b] of mutations) {
      if (!texte.includes(a)) { console.log(`  ❌ mutation « ${nom} » introuvable`); koMut++; continue; }
      process.env.SILENCE = '1';
      const k = await verifier(await charger(texte.replace(a, b)));
      delete process.env.SILENCE;
      console.log(`  ${k ? '✅' : '❌'} mutation « ${nom} » ⇒ ${k ? k + ' rouge(s)' : 'AUCUN rouge'}`);
      if (!k) koMut++;
    }
  }
  const total = ko + koMut;
  console.log(total ? `\n❌ audit-rythme-lectures : ${total} non conforme(s)` : '\n✅ audit-rythme-lectures : rien pour un onglet caché, ralenti sans geste, réveil immédiat');
  process.exit(total ? 1 : 0);
})();
