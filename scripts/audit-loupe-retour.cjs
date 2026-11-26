// La loupe laissée ouverte ne revient pas toute seule (26 nov., Julien : « la recherche se met
// automatiquement, c'est bizarre »). Exécute la vraie règle (src/rechercheEcran.js) et vérifie
// qu'App.jsx la branche sur le retour au premier plan. `--prouve` : mutations ⇒ rouge.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); } };
async function controler(srcRegle, app) {
  const url = 'data:text/javascript;base64,' + Buffer.from(srcRegle.replace(/^import .*$/mg, '')).toString('base64');
  const M = await import(url);
  const f = M.loupeAFermerAuRetour, T0 = 1_800_000_000_000;
  const r = [];
  r.push(f({ ouverte: true, cacheeA: T0, maintenant: T0 + 3 * 3600000 }) === true);   // 3 h : fermée
  r.push(f({ ouverte: true, cacheeA: T0, maintenant: T0 + 10 * 60000 }) === true);    // pile 10 min : fermée
  r.push(f({ ouverte: true, cacheeA: T0, maintenant: T0 + 9 * 60000 }) === false);    // 9 min : gardée
  r.push(f({ ouverte: false, cacheeA: T0, maintenant: T0 + 3 * 3600000 }) === false); // fermée : rien
  r.push(f({ ouverte: true, cacheeA: 0, maintenant: T0 }) === false);                 // jamais cachée : rien
  const branche = /visibilitychange/.test(app) && /loupeAFermerAuRetour\(\{ ouverte: gsOpenRef\.current, cacheeA \}\)\)\{ setGsQ\(''\); fermerRecherche\(\); \}/.test(app);
  return { r, branche };
}
(async () => {
  const regle = fs.readFileSync(path.join(R, 'src/rechercheEcran.js'), 'utf8');
  const app = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
  if (process.argv.includes('--prouve')) {
    const muts = [
      ['10 min devient 1 jour', regle.replace('10 * 60000;\nexport function loupeAFermerAuRetour', '86400000;\nexport function loupeAFermerAuRetour'), app],
      ['ouverte ignorée', regle.replace('if (!ouverte) return false;', ''), app],
      ['la coque ne branche plus la règle', regle, app.replace("setGsQ(''); fermerRecherche(); }", '}')],
    ];
    let rouges = 0;
    for (const [nom, s, a] of muts) { const { r, branche } = await controler(s, a); const rouge = r.includes(false) || !branche; console.log((rouge ? '✅ rouge : ' : '❌ RESTE VERT : ') + nom); if (rouge) rouges++; }
    process.exit(rouges === muts.length ? 0 : 1);
  }
  const { r, branche } = await controler(regle, app);
  dit(r[0] && r[1], 'loupe ouverte, app revenue après 10 min ou plus ⇒ fermée et vidée');
  dit(r[2], 'revenue avant 10 min ⇒ la loupe reste comme elle était');
  dit(r[3] && r[4], 'loupe fermée, ou app jamais cachée ⇒ rien ne bouge');
  dit(branche, 'App.jsx écoute le retour au premier plan et ferme la loupe par cette règle');
  console.log(`\n${ko ? '❌' : '✅'} audit-loupe-retour : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
