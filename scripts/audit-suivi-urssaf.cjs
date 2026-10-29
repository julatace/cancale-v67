#!/usr/bin/env node
// Le suivi de ses déclarations URSSAF (29 octobre, « fait un vrai suivi »).
// Exécute la VRAIE règle `suiviUrssaf` d'App.jsx dans un vm.
//   --prouve : réaffaiblit la règle (l'écart n'est plus jugé, une période notée
//   « déclarée » si un seul de ses mois l'est) ⇒ des contrôles rougissent.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src0 = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
const prouve = process.argv.includes('--prouve');
let ok = 0, ko = 0;
const verif = (c, m) => { if (c) { ok++; console.log('✅', m); } else { ko++; console.log('❌', m); } };

const extraire = (src, nom) => {
  const i = src.indexOf(`const ${nom} = `);
  if (i < 0) return null;
  const fin = src.indexOf('\n};\n', i);
  return src.slice(i, fin + 4);
};
let src = src0;
if (prouve) src = src.replace("notes.length === yms.length ? 'declaree'", "notes.length ? 'declaree'").replace('const ecart = etat === ', 'const ecart = false && etat === ');
const noms = ['_startOfDay', 'moisPeriodeUrssaf', 'minuitParisMs', 'montantPeriodeUrssaf', 'aPayerUrssaf', 'moisDeclare', 'periodesUrssaf', 'suiviUrssaf'];
let code = "const MOIS_NOMS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];\nconst tauxUrssaf = () => 12.4;\n";
for (const n of noms) {
  let c = extraire(src, n);
  if (n === '_startOfDay' || n === 'moisDeclare') { const i = src.indexOf(`const ${n} = `); c = src.slice(i, src.indexOf('\n', i) + 1); }
  if (!c) { verif(false, `${n} existe dans App.jsx`); continue; }
  code += c + '\n';
}
const ctx = {};
try { vm.runInNewContext(code + '\nthis.suiviUrssaf = suiviUrssaf;', ctx); } catch (e) { verif(false, 'la règle se charge : ' + e.message); }
const S = ctx.suiviUrssaf;
const essaie = (f, m) => { try { f(); } catch (e) { verif(false, `${m} (lève : ${e.message})`); } };

const now = new Date(2026, 9, 29, 12); // 29 octobre 2026
const ligne = { at: Date.parse('2026-10-28T10:00:00Z'), mois: [
  { ym: '2026-07', ca: 500, n: 10 }, { ym: '2026-08', ca: 2311.4, n: 50 }, { ym: '2026-09', ca: 4000, n: 80 }, { ym: '2026-10', ca: 900, n: 20 },
] };

essaie(() => {
  verif(S({ freq: 'mensuel', now, declare: null, ligne }) === null, 'registre pas lu ⇒ pas su (aucune période dite en retard)');
  const declare = {
    '2026-08': { ids: ['v:1'], n: 50, ca: 2311.4, montant: 286.61, regle: 'vente', at: Date.parse('2026-09-20') },
    '2026-09': { ids: ['v:2'], n: 85, ca: 4330.9, montant: null, regle: 'versement', at: Date.parse('2026-10-15') },
  };
  const r = S({ freq: 'mensuel', now, declare, ligne });
  const par = Object.fromEntries(r.lignes.map((l) => [l.label, l]));
  verif(par['août 2026'] && par['août 2026'].etat === 'declaree' && par['août 2026'].ecart === 0, 'août noté, même chiffre ⇒ déclarée, aucun écart');
  verif(par['septembre 2026'] && par['septembre 2026'].ecart === -330.9, 'septembre : VRM compte 330,90 € de moins que la déclaration (compte retiré) ⇒ dit');
  verif(par['juillet 2026'] && par['juillet 2026'].etat === 'en_retard', 'juillet a des ventes, pas noté, échéance passée ⇒ « pas notée »');
  verif(par['octobre 2026'] && par['octobre 2026'].etat === 'en_cours', 'octobre ⇒ en cours');
  verif(!par['juin 2026'], 'un mois sans vente ni déclaration ne s\'affiche pas');
  verif(r.lignes[0].label === 'octobre 2026', 'la plus récente en tête');
  verif(r.annee.ca === 6642.3 && r.annee.n === 2 && r.annee.montant === null, 'l\'année : CA déclaré sommé, cotisations « pas notées » si un mois n\'a pas son montant');
  verif(r.enRetard === 1, 'une seule période pas notée');
});

essaie(() => {
  // Trimestriel : T3 noté sur deux mois seulement ⇒ pas « déclarée ».
  const declare = { '2026-07': { ids: [], ca: 500, at: 1 }, '2026-08': { ids: [], ca: 2311.4, at: 2 } };
  const r = S({ freq: 'trimestriel', now, declare, ligne });
  const t3 = r.lignes.find((l) => l.label === 'T3 2026');
  verif(t3 && t3.etat === 'a_declarer' && t3.aNoter.length === 1 && t3.aNoter[0] === '2026-09', 'T3 noté sur 2 mois sur 3 ⇒ pas déclarée, septembre reste à noter');
});

essaie(() => {
  // Ligne publiée AVANT la fin de septembre ⇒ chiffre « au moins » ⇒ aucun écart affirmé.
  const ligneTot = { at: Date.parse('2026-09-15T10:00:00Z'), mois: [{ ym: '2026-09', ca: 1000 }] };
  const declare = { '2026-09': { ids: [], ca: 4330.9, at: 1 } };
  const r = S({ freq: 'mensuel', now, declare, ligne: ligneTot });
  const sep = r.lignes.find((l) => l.label === 'septembre 2026');
  verif(sep && sep.ecart === null, 'un chiffre de VRM partiel n\'affirme aucun écart');
});

const app = src0;
verif(/<SuiviUrssaf onNav=\{onNav\} \/>/.test(app), 'la carte est rendue dans Comptabilité');
verif(/data-suivi-noter=\{l\.aNoter\[0\]\} onClick=\{\(\) => demanderDeclaration\(/.test(app), '« C\'est déclaré » passe par le formulaire du rapport (un seul, §11)');

console.log(`\n${ok} ✅ · ${ko} ❌`);
process.exit(ko ? 1 : 0);
