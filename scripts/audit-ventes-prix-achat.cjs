#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — VENTES : LE PRIX D'ACHAT DIT UNE FOIS, EN TÊTE (6 nov., vague 2 · 5)
//        node scripts/audit-ventes-prix-achat.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// La ligne Vinted à l'ordinateur répétait « Achat · à saisir » en AMBRE sur chaque
// vente (E2, « ce qui reste »). Comme dans Annonces (chantier C) : UN bandeau
// « Prix d'achat N/M connus · Compléter » en tête, la case de la ligne en gris.
// EXÉCUTE `bandeauPrixAchat` (src/ventesEcran.js) :
//   B  N/M compté sur les ventes qui ont un coût (ni annulées, ni masquées, ni une
//      autre devise), N par la règle de la ligne ; tout connu ⇒ pas de bandeau ;
// et LIT (commentaires retirés) :
//   C  la case « Achat » d'une vente sans prix est grise (plus `--vrm-warn`) ;
//   S  le bandeau est rendu au-dessus de la liste Vinted, avec la règle de la ligne
//      (`beneficeLigneVente`) et « Compléter » ouvre la saisie en série.
// --prouve : chaque mutation réaffaiblit une règle ⇒ l'audit DOIT rougir.
'use strict';
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'annulees-comptees': ['src/ventesEcran.js', "    if (typeof annulee === 'function' && annulee(o)) continue;\n", ''],
  'devise-comptee': ['src/ventesEcran.js', "    const dv = o.price && o.price.currency_code; if (dv && dv !== 'EUR') continue;\n", ''],
  'tout-connu-redit': ['src/ventesEcran.js', '  return m && n < m ? { n, m } : null;', '  return m ? { n, m } : null;'],
  'case-ambre': ['src/styles-ventes-ligne.css', '.vrm-ledger-sale-achat[data-achat-etat="manque"] { color: var(--vrm-muted); font-weight: 500; }', '.vrm-ledger-sale-achat[data-achat-etat="manque"] { color: var(--vrm-warn); font-weight: 600; }'],
  'app-sans-bandeau': ['src/App.jsx', '          if (!bd) return null;\n          const { n, m } = bd;', '          return null;\n          const { n, m } = bd;'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ventes-prix-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  const [f, de, vers] = MUTS[MUT];
  const p = path.join(d, f); const s = fs.readFileSync(p, 'utf8');
  if (!s.includes(de)) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(p, s.replace(de, vers)); SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + String(d).slice(0, 300))); };
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  let V = {};
  try { V = await import(require('url').pathToFileURL(path.join(SRC, 'ventesEcran.js')).href); } catch (e) { V = {}; }
  console.log('\n── B. Le bandeau, compté une fois');
  if (typeof V.bandeauPrixAchat !== 'function') dit(false, 'B0 `bandeauPrixAchat` existe (src/ventesEcran.js)');
  else {
    const v = (tx, o = {}) => ({ transaction_id: tx, price: { amount: '50', currency_code: 'EUR' }, ...o });
    const ventes = [v(1, { _a: 1 }), v(2), v(3, { _ann: 1 }), v(4, { _m: 1 }), v(5, { price: { amount: '40', currency_code: 'GBP' } }), v(6, { _a: 1 }), { title: 'sans tx' }];
    const opts = { annulee: (o) => !!o._ann, masquee: (o) => !!o._m, achatConnu: (o) => !!o._a };
    const b = V.bandeauPrixAchat(ventes, opts);
    dit(b && b.n === 2 && b.m === 3, 'B1 « 2/3 » : ni l’annulée, ni la masquée, ni la vente en livres ne comptent', JSON.stringify(b));
    dit(V.bandeauPrixAchat([v(1, { _a: 1 }), v(2, { _a: 1 })], opts) === null, 'B2 tout est connu ⇒ pas de bandeau');
    dit(V.bandeauPrixAchat([], opts) === null && V.bandeauPrixAchat(null, opts) === null && V.bandeauPrixAchat([v(3, { _ann: 1 })], opts) === null, 'B3 rien à compter ⇒ pas de bandeau (jamais « 0/0 »)');
  }

  console.log('\n── C. La case de la ligne');
  const CSS = sansCommentaires(fs.readFileSync(path.join(SRC, 'styles-ventes-ligne.css'), 'utf8'));
  const regle = (CSS.match(/\.vrm-ledger-sale-achat\[data-achat-etat="manque"\]\s*\{[^}]*\}/g) || []).join(' ');
  dit(regle && /var\(--vrm-muted\)/.test(regle) && !/--vrm-warn|--vrm-ambre/.test(regle), 'C1 « à saisir » sur la ligne : gris, plus d’ambre répété', regle);
  const tous = ['styles-ventes-ligne.css', 'styles-bureau.css', 'ventes-e2.css', 'vague2-ventes.css', 'design/fusion.css'].map((f) => { try { return sansCommentaires(fs.readFileSync(path.join(SRC, f), 'utf8')); } catch (_) { return ''; } }).join('\n');
  dit(!/\.vrm-ledger-sale-achat[^{]*\{[^}]*--vrm-warn/.test(tous), 'C2 aucune autre feuille ne remet l’ambre sur la case « Achat »');

  console.log('\n── S. Le branchement');
  const APP = sansCommentaires(fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8'));
  const i = APP.indexOf('const bd = bandeauPrixAchat(ventesAffichees,');
  const bloc = i >= 0 ? APP.slice(i, i + 1600) : '';
  dit(/achatConnu: \(o\) => beneficeLigneVente\(o\.price\?\.amount, effEntry\(o\), \{ annulee: false \}\)\.achat != null/.test(bloc), 'S1 N = la règle de la ligne (`beneficeLigneVente`), jamais un second calcul');
  dit(/data-ventes-achats=\{`\$\{n\}\/\$\{m\}`\}/.test(bloc) && /data-ventes-achats-completer="" [^>]*onClick=\{\(\)=>setFillBuyOpen\(true\)\}/.test(bloc), 'S2 « Prix d’achat N/M · Compléter » ouvre la saisie en série');
  const iListe = APP.indexOf('<div className="vrm-ventes-liste" data-fu-liste=""');
  dit(i > 0 && iListe > i, 'S3 le bandeau est en tête, au-dessus de la liste Vinted');
  dit(/if \(!bd\) return null;\s*const \{ n, m \} = bd;\s*return \(\s*<div className="vrm-ann-avis vrm-ventes-avis" data-ventes-avis="">/.test(bloc), 'S4 il est rendu dès qu’un prix manque (et seulement alors), dans la forme du bandeau d’Annonces');

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
