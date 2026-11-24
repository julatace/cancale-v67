// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES TUTOS EN MOUVEMENT (scripts/films/tutos-gestes.cjs, 23 nov.)
//  1. les cinq gestes demandés par Julien existent : relier un compte, imprimer ses
//     bordereaux, numéroter et ranger, relier un achat, lire son bénéfice ;
//  2. chaque phrase dite existe dans les CINQ langues (fr en es it de), courte (≤ 80 signes) ;
//  3. aucun texte incrusté (`f.titre(` : une seule langue à l'image) ;
//  4. une fois publiés (public/aide/tutos/tutos.json), chaque film est au registre
//     (empreintes du mp4 et de l'affiche), fait sur le design d'aujourd'hui, ses 5 pistes
//     présentes, 15–45 s.
//    node scripts/audit-tutos-gestes.cjs [--mutation]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const RACINE = path.join(__dirname, '..');
const { P, GESTES, LANGUES } = require('./films/tutos-gestes.cjs');
const { empreinteDesign } = require('./_empreinte-design.cjs');
const ATTENDUS = ['relier-compte', 'imprimer', 'numeroter', 'relier-achat', 'benefice'];
const PUB = path.join(RACINE, 'public', 'aide', 'tutos');

function verifier(E) {
  const f = [];
  for (const g of ATTENDUS) if (!E.gestes[g]) f.push(`geste « ${g} » absent`);
  const dites = [...E.source.matchAll(/dire\('([a-z.0-9-]+)'\)/g)].map((m) => m[1]);
  for (const k of new Set(dites)) {
    if (!E.P[k]) { f.push(`phrase ${k} dite mais absente`); continue; }
    for (const l of E.langues) if (!E.P[k][l] || E.P[k][l].length > 80) f.push(`phrase ${k} : ${l} absente ou trop longue`);
  }
  if (E.langues.join() !== 'fr,en,es,it,de') f.push('les cinq langues ne sont pas fr en es it de');
  if (/\bf\.titre\(/.test(E.source)) f.push('texte incrusté (f.titre) : une seule langue à l\'image');
  if (E.registre) {
    for (const [g, e] of Object.entries(E.registre)) {
      const p = (x) => path.join(PUB, `${g}.${x}`);
      if (!fs.existsSync(p('mp4')) || E.sha(p('mp4')) !== e.mp4) f.push(`${g}.mp4 : pas celui du tournage enregistré`);
      if (!fs.existsSync(p('jpg')) || E.sha(p('jpg')) !== e.jpg) f.push(`${g}.jpg : pas l'affiche du tournage`);
      for (const l of E.langues) if (!fs.existsSync(p(`${l}.vtt`))) f.push(`${g}.${l}.vtt absent`);
      if (e.design !== E.design) f.push(`${g} : tourné avec un autre design — PUBLIER=1 GESTES=${g} node scripts/films/tutos-gestes.cjs`);
      if (!(e.duree >= 15 && e.duree <= 45.05)) f.push(`${g} : ${e.duree} s hors de 15–45 s`);
    }
  }
  return f;
}
const lire = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; } };
const E = { gestes: GESTES, P, langues: LANGUES, source: fs.readFileSync(path.join(__dirname, 'films', 'tutos-gestes.cjs'), 'utf8').replace(/^\s*\/\/.*$/gm, ''), registre: lire(path.join(PUB, 'tutos.json')), design: empreinteDesign(), sha: (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') };
const fautes = verifier(E);
if (process.argv.includes('--mutation')) {
  const sansIt = JSON.parse(JSON.stringify(P)); delete sansIt['impr.3'].it;
  const cas = [
    ['un geste manque', { ...E, gestes: { ...GESTES, benefice: undefined } }],
    ['une langue manque', { ...E, P: sansIt }],
    ['un texte incrusté', { ...E, source: E.source + "\nf.titre('x');" }],
    ['un film d\'un ancien design', { ...E, registre: { imprimer: { mp4: 'x', jpg: 'x', design: 'vieux', duree: 30 } } }],
  ];
  let ko = 0;
  for (const [n, env] of cas) { const r = verifier(env).length > fautes.length; console.log(`${r ? '✓' : '✗'} mutation « ${n} » ${r ? 'rougit' : 'NE ROUGIT PAS'}`); if (!r) ko++; }
  if (ko) process.exit(1);
}
for (const x of fautes) console.error('✗ ' + x);
if (fautes.length) process.exit(1);
console.log(`✅ audit-tutos-gestes : ${ATTENDUS.length} gestes, ${Object.keys(P).length} phrases × 5 langues, aucun texte incrusté${E.registre ? `, ${Object.keys(E.registre).length} film(s) publiés au design ${E.design}` : ' (pas encore tournés : à faire après la nouvelle apparence claire)'}`);
