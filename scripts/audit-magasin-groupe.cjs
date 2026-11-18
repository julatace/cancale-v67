// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE MAGASIN PARTAGÉ PRÉVIENT SES ABONNÉS ENSEMBLE (18 nov., lot rendus-groupes)
//         node scripts/audit-magasin-groupe.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// src/magasinPartage.js (ventes, achats, versements, suivis : une copie pour tous les moteurs) est EXÉCUTÉ :
//   1. `poser` change la valeur TOUT DE SUITE (`lire` la rend) ;
//   2. les abonnés de plusieurs clés posées dans la même fenêtre sont prévenus en UNE passe, chacun UNE fois ;
//   3. aucun abonné n'est jamais oublié (une clé posée ⇒ ses abonnés prévenus) ;
//   4. une valeur identique (`Object.is`) ne prévient personne ; `grouper: null` prévient tout de suite.
// `--prouve` : chaque mutation affaiblit une règle ; l'audit doit devenir ROUGE.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const MOD = 'src/magasinPartage.js';
const MUTS = {
  'prevenance-oubliee': ['    aPrevenir.add(e);\n', '    \n'],
  'prevenus-un-par-un': ['    if (prevuGroupe) return;\n', ''],
  'valeur-differee': ['      e.v = v;\n      prevenir(e);', '      prevenir(e); grouperV(() => { e.v = v; });'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const [k, [a, b]] of Object.entries(MUTS)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'magasin-mut-')); fs.mkdirSync(path.join(dir, 'src'));
    const t = fs.readFileSync(path.join(R, MOD), 'utf8'); if (!t.includes(a)) { console.log('❌ mutation introuvable : ' + k); continue; }
    fs.writeFileSync(path.join(dir, MOD), t.replace(a, b).replace("export function creerMagasinPartage", "const grouperV = (f) => setTimeout(f, 0);\nexport function creerMagasinPartage"));
    let code = 0; try { execFileSync(process.execPath, [__filename], { stdio: 'pipe', env: { ...process.env, AUDIT_RACINE: dir } }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`\n${n}/${Object.keys(MUTS).length} mutations attrapées`);
  process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'magasin-'));
  fs.writeFileSync(path.join(tmp, 'm.mjs'), fs.readFileSync(path.join(R, MOD), 'utf8'));
  const { creerMagasinPartage } = await import(pathToFileURL(path.join(tmp, 'm.mjs')).href);
  // Une fenêtre manuelle : la passe de prévenance part quand on la vide.
  const passes = []; const vider = () => { const l = passes.splice(0); l.forEach((f) => f()); return l.length; };
  const M = creerMagasinPartage({ grouper: (f) => passes.push(f), planifier: () => {} });
  const journal = [];
  M.abonner('sold', () => journal.push('sold:a'), () => undefined);
  M.abonner('sold', () => journal.push('sold:b'), () => undefined);
  M.abonner('purchased', () => journal.push('purchased'), () => undefined);
  M.abonner('versements', () => journal.push('versements'), () => undefined);
  M.poser('sold', { items: [1] }); M.poser('purchased', { items: [2] }); M.poser('sold', { items: [1, 3] });
  dit(M.lire('sold').items.length === 2 && M.lire('purchased').items[0] === 2, '1. `poser` change la valeur tout de suite (`lire` la rend avant toute prévenance)');
  dit(journal.length === 0, '   personne n’est prévenu avant la fin de la fenêtre', journal.join(','));
  const n = vider();
  dit(n === 1, '2. UNE passe de prévenance pour trois poses sur deux clés', `${n} passe(s)`);
  dit(journal.slice().sort().join(',') === 'purchased,sold:a,sold:b', '   chaque abonné des clés posées prévenu UNE fois ; les autres jamais', journal.join(','));
  journal.length = 0; M.poser('versements', null); vider();
  dit(journal.join(',') === 'versements', '3. une clé posée (même à « pas su ») prévient ses abonnés', journal.join(','));
  journal.length = 0; const v = M.lire('versements'); M.poser('versements', v); vider();
  dit(journal.length === 0, '4. une valeur identique ne prévient personne', journal.join(','));
  const D = creerMagasinPartage({ grouper: null, planifier: () => {} }); let vu = 0; D.abonner('x', () => vu++, () => 0); D.poser('x', 1);
  dit(vu === 1, '   `grouper: null` : prévenu tout de suite');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\naudit-magasin-groupe : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
