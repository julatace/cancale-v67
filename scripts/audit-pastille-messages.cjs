#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LA PASTILLE DE MESSAGES SUIT « RETIRER » — node scripts/audit-pastille-messages.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (20 nov., chasse-bugs-2) La rangée « N messages à lire » est publiée par Aujourd'hui, monté seul sur son onglet ; la
// coque prenait ce nombre gardé (jusqu'à 12 h) AVANT son compte vivant : sur Messages, retirer ou lire une conversation
// laissait la pastille. Règle (src/designV2/aRegler.js `pastilleMessages`) : part Vinted VIVANTE + part eBay publiée ;
// sans compte vivant, le nombre publié. La coque (src/App.jsx) la branche sur `msgNonLus` (retirées écartées).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== '' ? ' — ' + d : ''}`); };

async function juger(srcRegle, app, bavard = true) {
  ok = 0; ko = 0;
  const D = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-pastille-'));
  fs.mkdirSync(path.join(D, 'designV2'));
  const f = path.join(D, 'designV2', 'aRegler.mjs');
  // La règle importe ses voisins : on garde le fichier tel quel, ses imports relatifs pointés vers le vrai src/designV2/.
  fs.writeFileSync(f, srcRegle.replace(/from '\.\/([^']+)'/g, (m, x) => `from ${JSON.stringify(pathToFileURL(path.join(R, 'src', 'designV2', x)).href)}`)
    .replace(/from '\.\.\/([^']+)'/g, (m, x) => `from ${JSON.stringify(pathToFileURL(path.join(R, 'src', x)).href)}`));
  let M;
  const log = console.log; if (!bavard) console.log = () => {};
  try {
    try { M = await import(pathToFileURL(f).href); } catch (e) { dit(false, 'la règle se charge', e.message); return ko; }
    const P = M.pastilleMessages;
    dit(typeof P === 'function', 'la règle `pastilleMessages` existe');
    if (typeof P === 'function') {
      const g = [{ id: 'messages', n: 5, ebay: 2 }, { id: 'ventes', n: 3 }];
      dit(P({ groupes: g, vintedVivant: 1 }) === 3, 'publié 5 (dont eBay 2), une conversation Vinted retirée ⇒ 1 vivante + 2 eBay = 3', P({ groupes: g, vintedVivant: 1 }));
      dit(P({ groupes: [{ id: 'messages', n: 4 }], vintedVivant: 0 }) === false, 'tout retiré (Vinted 0, aucun eBay) ⇒ plus de pastille', P({ groupes: [{ id: 'messages', n: 4 }], vintedVivant: 0 }));
      dit(P({ groupes: [{ id: 'messages', n: 4, ebay: 4 }], vintedVivant: 0 }) === 4, 'seulement eBay ⇒ la pastille dit eBay', P({ groupes: [{ id: 'messages', n: 4, ebay: 4 }], vintedVivant: 0 }));
      dit(P({ groupes: g, vintedVivant: null }) === 5, 'compte vivant pas su ⇒ le nombre publié reste', P({ groupes: g, vintedVivant: null }));
      dit(P({ groupes: [], vintedVivant: 2 }) === 2, 'rien de publié, 2 vivantes ⇒ 2', P({ groupes: [], vintedVivant: 2 }));
    }
  } finally { console.log = log; try { fs.rmSync(D, { recursive: true, force: true }); } catch (_) {} }
  const sans = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (bavard) {
    dit(/const vintedMsgVivant=liveStats&&Array\.isArray\(liveStats\.unreadConvs\) \? msgNonLus : null;/.test(sans) && /pastilleMessages\(\{ groupes: pubRegler\.groupes, vintedVivant: vintedMsgVivant \}\)/.test(sans)
      && /badgesNav=\{[^}]*\bmessages: pastilleMsg \|\| msgNonLus>0/.test(sans), 'la coque branche la pastille sur le compte VIVANT (`msgNonLus`, retirées écartées)');
    dit(/groupesJ\.push\(\{ id: 'messages', ebay: /.test(sans), 'Aujourd’hui publie la part eBay avec la rangée « messages »');
    dit(/const msgNonLus=useMemo\([\s\S]{0,300}conversationRetiree\(ret,/.test(sans), '`msgNonLus` écarte les conversations retirées');
  }
  return ko;
}

(async () => {
  const regle = fs.readFileSync(path.join(R, 'src', 'designV2', 'aRegler.js'), 'utf8');
  const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
  if (process.argv.includes('--prouve')) {
    const muts = [
      ['le nombre publié l’emporte', regle.replace('const n = Number.isFinite(vintedVivant) ? Math.max(0, vintedVivant) + ebay : publie;', 'const n = publie;')],
      ['eBay oublié', regle.replace('Math.max(0, vintedVivant) + ebay', 'Math.max(0, vintedVivant)')],
    ];
    let rouges = 0;
    for (const [nom, src] of muts) { const k = src === regle ? 0 : await juger(src, app, false); if (k) rouges++; console.log(`${k ? '✅' : '❌'} mutation « ${nom} » ⇒ ${k ? 'ROUGE' : 'encore vert'}`); }
    process.exit(rouges === muts.length ? 0 : 1);
  }
  const k = await juger(regle, app);
  console.log(k ? `❌ audit-pastille-messages : ${k} rouge(s)` : `✅ audit-pastille-messages : ${ok} vert(s)`);
  process.exit(k ? 1 : 0);
})();
