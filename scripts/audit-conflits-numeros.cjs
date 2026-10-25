#!/usr/bin/env node
// Audit : le bloc rouge « N numéros portés par deux paires » (§5) ne
// s'allume que pour DEUX PAIRES, jamais pour une paire rangée dans sa case.
//
// Une case du garage (`vinted_garage_grid` : { 'A-1': ['41','42',…] }) est un
// EMPLACEMENT. Une annonce en ligne rangée dans sa case — l'état normal du
// stock — comptait pour deux porteurs : fausse alerte rouge sur Colis.
//
// Exécute la VRAIE règle d'App.jsx dans un `vm` : `conflitsDeNumeros` si elle
// existe, sinon le corps du `useMemo` d'avant (pour être rouge sur le code
// d'avant, §6.1). Les porteurs servis ont la forme que `porteursNum` produit.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');

let ok = 0, ko = 0;
const verifie = (cond, msg, detail) => {
  if (cond) { ok++; console.log('  ✅ ' + msg); }
  else { ko++; console.log('  ❌ ' + msg + (detail ? ' — ' + detail : '')); }
};

const mNorm = src.match(/^const normTitle = .*$/m);
let code = (mNorm ? mNorm[0] : "const normTitle = (t) => (t||'').toLowerCase().trim();") + '\n';
code += 'const triNum = (a, b) => String(a).localeCompare(String(b), "fr", { numeric: true });\n';
const debF = src.indexOf('// <conflits-numeros-regle>');
if (debF >= 0) {
  const fin = src.indexOf('// </conflits-numeros-regle>', debF);
  code += src.slice(debF, fin) + '\nthis.regle = conflitsDeNumeros;';
} else {
  const deb = src.indexOf('const conflitsNum = useMemo(() => {');
  const fin = src.indexOf('}, [porteursNum]);', deb);
  if (deb < 0 || fin < 0) { console.log('❌ règle introuvable'); process.exit(1); }
  const corps = src.slice(deb + 'const conflitsNum = useMemo(() => {'.length, fin);
  code += 'this.regle = function (porteursNum) {' + corps + '};';
}
const ctx = {}; vm.createContext(ctx);
try { vm.runInContext(code, ctx); } catch (e) { console.log('❌ chargement : ' + e.message); process.exit(1); }
const regle = (p) => { try { return ctx.regle(p); } catch (e) { return { erreur: e.message }; } };
const nums = (r) => Array.isArray(r) ? r.map(c => String(c.numero)) : ['ERREUR ' + (r && r.erreur)];

const annonce = (id, titre) => ({ type: 'annonce', titre, id });
const vente = (id, titre) => ({ type: 'vente', titre, id });
const cas = (cell) => ({ type: 'garage', titre: `case ${cell}`, id: cell });
const annulee = (id, titre) => ({ type: 'annulee', titre, id });

console.log('Une paire = pas de rouge');
let r = regle({ '41': [annonce('a1', 'Nike Air Max 90 taille 42'), cas('A-1')] });
verifie(nums(r).length === 0, 'annonce en ligne + sa case du garage : une paire', JSON.stringify(nums(r)));
r = regle({ '42': [vente('t1', 'Samba 40'), cas('A-2')] });
verifie(nums(r).length === 0, 'vente à poster + sa case du garage : une paire', JSON.stringify(nums(r)));
r = regle({ '43': [annonce('a3', 'XT-6 40'), vente('t3', 'XT-6 40'), cas('A-3')] });
verifie(nums(r).length === 0, 'vente + son annonce encore ouverte (même titre) + sa case : une paire', JSON.stringify(nums(r)));
r = regle({ '44': [cas('A-4')] });
verifie(nums(r).length === 0, 'case seule : une paire', JSON.stringify(nums(r)));

console.log('Vente ANNULÉE = plus jamais de rouge (25 oct., décision de Julien)');
// §6.1 : sur le code d'avant, une vente annulée compte comme un porteur → rouge.
r = regle({ '63': [annonce('a63', 'Blouse grain de malice'), annulee('t63', 'Lot 23 articles')] });
verifie(nums(r).length === 0, 'annonce en ligne + vente ANNULÉE (titres différents) : pas de rouge', JSON.stringify(nums(r)));
r = regle({ '64': [vente('t64', 'Nike 42'), annulee('t64b', 'Lot annulé')] });
verifie(nums(r).length === 0, 'vente à poster + vente ANNULÉE : pas de rouge', JSON.stringify(nums(r)));
r = regle({ '66': [annulee('x1', 'Lot A'), annulee('x2', 'Lot B')] });
verifie(nums(r).length === 0, 'deux ventes annulées : pas de rouge (aucune ne part)', JSON.stringify(nums(r)));

console.log('Deux paires = rouge (l\'autre sens)');
r = regle({ '45': [annonce('a5', 'Nike 42'), annonce('a6', 'Adidas 38')] });
verifie(nums(r).includes('45'), 'deux annonces différentes sous le même N°', JSON.stringify(nums(r)));
r = regle({ '46': [annonce('a7', 'Nike 42'), annonce('a8', 'Adidas 38'), cas('B-1')] });
verifie(nums(r).includes('46'), 'deux annonces différentes, l\'une rangée : rouge quand même', JSON.stringify(nums(r)));
r = regle({ '47': [cas('A-1'), cas('B-2')] });
verifie(nums(r).includes('47'), 'le même N° dans deux cases (deux cartons)', JSON.stringify(nums(r)));
r = regle({ '48': [annonce('a9', 'Nike 42'), cas('A-1'), cas('C-3')] });
verifie(nums(r).includes('48'), 'une annonce et deux cases', JSON.stringify(nums(r)));
r = regle({ '49': [annonce('a10', 'Nike 42'), vente('t9', 'Samba 40')] });
verifie(nums(r).includes('49'), 'une annonce et une AUTRE vente (titres différents)', JSON.stringify(nums(r)));
r = regle({ '50': [annonce('a11', 'Nike 42'), annonce('a12', 'Adidas 38'), annulee('t50', 'Lot annulé')] });
verifie(nums(r).includes('50'), 'deux annonces différentes + une vente annulée : rouge quand même (le vrai conflit reste)', JSON.stringify(nums(r)));

console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
process.exit(ko ? 1 : 0);
