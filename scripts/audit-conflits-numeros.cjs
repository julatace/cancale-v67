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
//
// (1er nov., audit X1) PLUS JAMAIS PAR LE TITRE : deux paires au même titre
// sous un N° (deux ventes à poster, une vente et une AUTRE annonce, deux
// annonces) sont rouges ; seule la vente dont l'identité (`item`) EST l'annonce
// est dispensée. Et `doublonsAReattribuer` (20 oct.) ne devine rien : une vente
// sans identité ne fait renuméroter aucune annonce.
// (6 nov., finitions) UNE PAIRE EN LIGNE DEUX FOIS : des annonces qu'un groupe de la carte
// ambre « en ligne deux fois » réunit (photo exacte ou `recreeDe`, src/enLigneDeuxFois.js)
// ne sont pas deux paires — pas de rouge ; tout autre cas (groupe absent, partiel, deux
// cases, une annonce de plus) reste rouge.
// `--prouve` : chaque réaffaiblissement (le titre revient, l'identité ignorée,
// deux ventes dispensées, la vente sans identité renumérote) doit rendre
// l'audit ROUGE.
'use strict';
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');

const MUTATIONS = {
  // Le titre dispense de nouveau deux porteurs (le code d'avant le 1er nov.).
  titre_revient: (s) => s.replace('if (!deux && ids.size > 1) deux = !memePaireProuvee(paires);',
    "if (!deux && ids.size > 1) { const titres = new Set(paires.map(x => normTitle(x.titre || ''))); if (!(paires.length === 2 && titres.size === 1)) deux = true; }"),
  // L'identité n'est plus comparée : toute vente + annonce est dispensée.
  identite_ignoree: (s) => s.replace("return v.item != null && String(v.item) !== '' && String(v.item) === String(a.id);", 'return true;'),
  // Deux ventes à la même identité d'annonce seraient dispensées.
  deux_ventes: (s) => s.replace("if (!v || !a) return false;", "if (!v) return false; if (!a) { const w = uniq.find(x => x !== v); return !!(w && w.item != null && String(w.item) === String(v.item)); }"),
  // Une vente sans identité fait renuméroter l'annonce (on devinerait).
  doublon_devine: (s) => s.replace('      if (!item) continue;\n', ''),
  // (6 nov.) Le groupe ambre ignoré (le rouge revient sur une paire prouvée) / un groupe PARTIEL dispense.
  groupe_ignore: (s) => s.replace('if (uniq.length >= 2 && uniq.every(x => x.type === \'annonce\') && Array.isArray(memePaires)) {', 'if (false) {'),
  groupe_partiel: (s) => s.replace('return memePaires.some(g => Array.isArray(g) && ids.every(id => g.some(y => String(y) === id)));', 'return memePaires.some(g => Array.isArray(g) && ids.some(id => g.some(y => String(y) === id)));'),
  groupe_sans_annonces: (s) => s.replace("uniq.every(x => x.type === 'annonce') && Array.isArray(memePaires)", 'Array.isArray(memePaires)'),
};
const prouve = process.argv.includes('--prouve');

function lancer(src) {
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
    if (deb < 0 || fin < 0) { console.log('❌ règle introuvable'); return 1; }
    const corps = src.slice(deb + 'const conflitsNum = useMemo(() => {'.length, fin);
    code += 'this.regle = function (porteursNum) {' + corps + '};';
  }
  const ctx = {}; vm.createContext(ctx);
  try { vm.runInContext(code, ctx); } catch (e) { console.log('❌ chargement : ' + e.message); return 1; }
  const regle = (p, g) => { try { return ctx.regle(p, g); } catch (e) { return { erreur: e.message }; } };
  const nums = (r) => Array.isArray(r) ? r.map(c => String(c.numero)) : ['ERREUR ' + (r && r.erreur)];
  // doublonsAReattribuer (20 oct.), extraite telle quelle.
  let doublons = null;
  {
    const a = src.indexOf('// <doublons-reattribuer-regle>'), b = src.indexOf('// </doublons-reattribuer-regle>');
    const mc = src.match(/^const cleNum = \(v\) => \{[\s\S]*?\n\};/m);
    if (a >= 0 && b > a && mc) {
      const c2 = {}; vm.createContext(c2);
      try { vm.runInContext(mc[0] + '\n' + src.slice(a, b) + '\nthis.d = doublonsAReattribuer;', c2); doublons = c2.d; } catch (e) { doublons = null; }
    }
  }

  const annonce = (id, titre) => ({ type: 'annonce', titre, id });
  const vente = (id, titre, item) => ({ type: 'vente', titre, id, item: item == null ? null : item });
  const cas = (cell) => ({ type: 'garage', titre: `case ${cell}`, id: cell });
  const annulee = (id, titre) => ({ type: 'annulee', titre, id });

  console.log('Une paire = pas de rouge');
  let r = regle({ '41': [annonce('a1', 'Nike Air Max 90 taille 42'), cas('A-1')] });
  verifie(nums(r).length === 0, 'annonce en ligne + sa case du garage : une paire', JSON.stringify(nums(r)));
  r = regle({ '42': [vente('t1', 'Samba 40'), cas('A-2')] });
  verifie(nums(r).length === 0, 'vente à poster + sa case du garage : une paire', JSON.stringify(nums(r)));
  r = regle({ '43': [annonce('a3', 'XT-6 40'), vente('t3', 'XT-6 40', 'a3'), cas('A-3')] });
  verifie(nums(r).length === 0, 'vente + son annonce encore ouverte (identité de la vente = l\'annonce) + sa case : une paire', JSON.stringify(nums(r)));
  r = regle({ '43': [annonce('a3', 'XT-6 40'), vente('t3', 'Autre titre réécrit', 'a3')] });
  verifie(nums(r).length === 0, 'vente + son annonce PROUVÉE la même, titres différents : une paire', JSON.stringify(nums(r)));
  r = regle({ '44': [cas('A-4')] });
  verifie(nums(r).length === 0, 'case seule : une paire', JSON.stringify(nums(r)));

  console.log('Vente ANNULÉE = plus jamais de rouge (25 oct., décision de Julien)');
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

  console.log('Même titre, deux paires = ROUGE (1er nov., X1 : jamais par le titre)');
  const T = 'Nike Dunk Low Panda 42';
  r = regle({ '40': [vente('9001', T, '555'), annonce('777', T)] });
  verifie(nums(r).includes('40'), 'vente à poster (paire 555) + une AUTRE annonce (777) au même titre', JSON.stringify(nums(r)));
  r = regle({ '40': [vente('9001', T), annonce('777', T)] });
  verifie(nums(r).includes('40'), 'vente SANS identité + annonce au même titre : pas prouvée la même ⇒ rouge', JSON.stringify(nums(r)));
  r = regle({ '40': [annonce('776', T), annonce('777', T)] });
  verifie(nums(r).includes('40'), 'deux annonces en ligne au même titre', JSON.stringify(nums(r)));
  r = regle({ '40': [vente('9001', T), vente('9002', T)] });
  verifie(nums(r).includes('40'), 'deux ventes à poster au même titre', JSON.stringify(nums(r)));
  r = regle({ '40': [vente('9001', T, '777'), vente('9002', T, '777')] });
  verifie(nums(r).includes('40'), 'deux ventes à poster, même identité d\'annonce : rouge quand même (deux colis)', JSON.stringify(nums(r)));
  r = regle({ '40': [vente('9001', T, '777'), annonce('777', T), annonce('778', T)] });
  verifie(nums(r).includes('40'), 'vente + son annonce + une troisième au même titre', JSON.stringify(nums(r)));
  r = regle({ '40': [annonce('777', T), { type: 'annonce', titre: T, id: '777', aConfirmer: true }] });
  verifie(nums(r).length === 0, 'la même annonce lue deux fois (en ligne + à confirmer) : une paire', JSON.stringify(nums(r)));

  console.log('Une paire EN LIGNE DEUX FOIS, prouvée et dite par la carte ambre = pas de rouge (6 nov.)');
  r = regle({ '7': [annonce('3001', 'Jordan'), annonce('3002', 'Jordan')] }, [['3001', '3002']]);
  verifie(nums(r).length === 0, 'deux annonces au N°7 que la carte ambre réunit (même paire) : pas de rouge', JSON.stringify(nums(r)));
  r = regle({ '7': [annonce('3001', 'Jordan'), annonce('3002', 'Jordan'), cas('A-1')] }, [['3001', '3002']]);
  verifie(nums(r).length === 0, '… rangée dans sa case : toujours une paire', JSON.stringify(nums(r)));
  r = regle({ '7': [annonce('3001', 'Jordan'), annonce('3002', 'Jordan')] }, []);
  verifie(nums(r).includes('7'), 'la carte ambre se tait (lecture pas sûre, compte écarté…) : le rouge reste', JSON.stringify(nums(r)));
  r = regle({ '7': [annonce('3001', 'Jordan'), annonce('3002', 'Jordan')] });
  verifie(nums(r).includes('7'), 'aucun groupe passé : le rouge reste (comme avant)', JSON.stringify(nums(r)));
  r = regle({ '7': [annonce('3001', 'Jordan'), annonce('3002', 'Jordan'), annonce('3003', 'Jordan')] }, [['3001', '3002']]);
  verifie(nums(r).includes('7'), 'une TROISIÈME annonce hors du groupe : deux paires, rouge', JSON.stringify(nums(r)));
  r = regle({ '7': [annonce('3001', 'Jordan'), annonce('3009', 'Jordan')] }, [['3001', '3002']]);
  verifie(nums(r).includes('7'), 'un groupe qui ne contient qu’une des deux : rouge', JSON.stringify(nums(r)));
  r = regle({ '7': [annonce('3001', 'Jordan'), annonce('3002', 'Jordan'), cas('A-1'), cas('B-2')] }, [['3001', '3002']]);
  verifie(nums(r).includes('7'), 'la même paire, mais le N° dans DEUX cases (deux cartons) : rouge', JSON.stringify(nums(r)));
  r = regle({ '7': [annonce('3001', 'Jordan'), vente('t7', 'Jordan', '3009')] }, [['3001', '3009']]);
  verifie(nums(r).includes('7'), 'une vente à poster et une autre annonce : le groupe ne dispense que des ANNONCES — rouge', JSON.stringify(nums(r)));
  r = regle({ '43': [annonce('a3', 'XT-6 40'), vente('t3', 'XT-6 40', 'a3')] }, [['x1', 'x2']]);
  verifie(nums(r).length === 0, 'des groupes passés n’ôtent rien à la règle d’avant : une vente et SON annonce restent une paire', JSON.stringify(nums(r)));

  console.log('Doublons réglés seuls (20 oct.) — sans rien deviner');
  if (!doublons) verifie(false, 'doublonsAReattribuer se charge');
  else {
    const fiches = { '777': { numero: '40', auto: true, numberedAt: '2026-10-20' }, '776': { numero: '40', auto: true, numberedAt: '2026-10-19' }, '555': { numero: '40', auto: true } };
    const ids = (a) => (Array.isArray(a) ? a : []).map(x => x.id).sort().join(',');
    const d = (c) => { try { return doublons(c, fiches); } catch (e) { return []; } };
    let c = regle({ '40': [vente('9001', T, '555'), annonce('777', T)] });
    verifie(ids(d(c)) === '777', 'vente (paire 555) + autre annonce 777 : la vente garde, 777 change', ids(d(c)));
    c = regle({ '40': [vente('9001', T), annonce('777', T)] });
    verifie(Array.isArray(c) && c.length === 1 && d(c).length === 0, 'vente SANS identité + annonce : rouge, rien n\'est renuméroté (on ne devine pas)', ids(d(c)));
    c = regle({ '40': [vente('9001', T), vente('9002', T)] });
    verifie(Array.isArray(c) && c.length === 1 && d(c).length === 0, 'deux ventes à poster : rouge, rien n\'est renuméroté', ids(d(c)));
    c = regle({ '40': [vente('9001', T, '777'), annonce('777', T), annonce('776', T)] });
    verifie(ids(d(c)) === '776', 'vente + SON annonce encore ouverte + une autre : seule l\'autre change', ids(d(c)));
    c = regle({ '40': [annonce('776', T), annonce('777', T)] });
    verifie(ids(d(c)) === '777', 'deux annonces : la numérotée la première garde', ids(d(c)));
  }

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  return ko;
}

if (!prouve) process.exit(lancer(SRC) ? 1 : 0);
let toutes = true;
for (const [nom, mut] of Object.entries(MUTATIONS)) {
  const m = mut(SRC);
  console.log(`\n════ mutation « ${nom} »`);
  if (m === SRC) { console.log('  ❌ la mutation ne s\'applique plus (texte changé)'); toutes = false; continue; }
  const k = lancer(m);
  console.log(`  → ${k ? `ROUGE (${k})` : 'VERTE — la mutation n\'est pas attrapée'}`);
  if (!k) toutes = false;
}
console.log(toutes ? '\n✅ chaque réaffaiblissement est attrapé' : '\n❌ une mutation passe au vert');
process.exit(toutes ? 0 : 1);
