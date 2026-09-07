// ═══════════════════════════════════════════════════════════════════════════
// AUDIT DES ICÔNES   —   node scripts/audit-icones.cjs
// ═══════════════════════════════════════════════════════════════════════════
// `Icon` rend `null` quand le nom n'est pas dans `ICON_PATHS` : AUCUNE erreur,
// rien dans la console, un simple trou à la place de l'icône. Mesuré le
// 7 septembre : l'onglet « Grille » du Garage s'affichait sans icône, entre
// « Ma pièce » et « Photos » qui en ont une — depuis des semaines, parce que
// `grid` n'a jamais existé. C'est la CAPTURE qui l'a vu, pas le build.
//
// Ce fichier vérifie que tout nom d'icône ÉCRIT EN CLAIR dans l'app existe.
// (Un nom calculé — `name={ic}` — n'est pas lisible ici : on remonte alors aux
//  chaînes des tableaux qui alimentent ces boucles, cf. plus bas.)
//
// Lecture seule.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

// ── LES NOMS DISPONIBLES ───────────────────────────────────────────────────
const bloc = /const ICON_PATHS = \{([\s\S]*?)\n\};/.exec(APP);
dit(!!bloc, '`ICON_PATHS` est là');
if (!bloc) { console.log(`\n${ko} contrôle(s) non conforme(s).`); process.exit(1); }
const dispo = new Set([...bloc[1].matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*)\s*:/gm)].map(m => m[1]));
dit(dispo.size >= 30, `${dispo.size} icônes définies`);

// ── 1. LES NOMS ÉCRITS EN CLAIR ────────────────────────────────────────────
const litteraux = [...APP.matchAll(/<Icon\s+name="([A-Za-z0-9]+)"/g)].map(m => m[1]);
const manquants = [...new Set(litteraux.filter(n => !dispo.has(n)))];
dit(manquants.length === 0,
  `les ${new Set(litteraux).size} icônes appelées par leur nom existent toutes`,
  manquants.join(', '));

// ── 2. LES NOMS QUI PASSENT PAR UNE VARIABLE ───────────────────────────────
// On ne peut pas les suivre, mais les tableaux qui les alimentent, si : une
// bascule d'écran s'écrit `[['plan','home','Ma pièce'], …]` et un menu
// `{k:'…', icon:'…'}`. C'est là qu'était le trou (`['grid','grid','Grille']`).
// ⚠️ On ne teste QUE les chaînes qui ressemblent à un nom d'icône déjà connu
// ailleurs — sinon on crierait au loup sur n'importe quel libellé.
// ⚠️ DEUX JETS RATÉS AVANT CELUI-CI.
//   · Trop timide : ne retenir que les noms servant DÉJÀ d'icône ailleurs
//     ratait `grid`, le seul trou réel — vert sur le code d'avant.
//   · Trop large : prendre TOUS les triplets `['a','b','c']` du fichier
//     remontait les pays (`deutschland`, `belgium`…) et les transporteurs
//     (`mondialrelay`), qui ne sont pas des icônes. Un audit qui crie au loup
//     finit ignoré.
// La bonne portée : ce qui alimente RÉELLEMENT un `<Icon name={variable}/>`,
// c'est-à-dire les chaînes écrites dans les ~900 caractères qui le précèdent.
const suspects = new Set();
for (const m of APP.matchAll(/<Icon\s+name=\{([A-Za-z_$][\w$.]*)\}/g)) {
  const fenetre = APP.slice(Math.max(0, m.index - 900), m.index);
  for (const x of fenetre.matchAll(/icon:\s*'([A-Za-z0-9]+)'/g)) suspects.add(x[1]);
  for (const x of fenetre.matchAll(/\[\s*'[a-z0-9_]+'\s*,\s*'([a-z][A-Za-z0-9]*)'\s*,/g)) suspects.add(x[1]);
}
const troues = [...suspects].filter(n => !dispo.has(n));
dit(troues.length === 0,
  'et celles passées par une variable aussi',
  troues.join(', '));

// ── 3. `grid` EXISTE — c'est le trou mesuré, il ne doit pas revenir ────────
dit(dispo.has('grid'), '`grid` est définie',
  "l'onglet « Grille » du Garage s'affichait sans icône");

// ── 4. LE PIÈGE D'ÉCRITURE : `ICON_PATHS` attend du JSX, pas une chaîne ────
const chaines = [...bloc[1].matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*)\s*:\s*['"`]/gm)].map(m => m[1]);
dit(chaines.length === 0,
  'aucune entrée n\'est écrite en chaîne de caractères',
  chaines.join(', ') + ' — une chaîne ne dessine rien');

console.log(ko
  ? `\n${ko} contrôle(s) non conforme(s).`
  : '\nToutes les icônes appelées existent : aucun trou muet.');
process.exit(ko ? 1 : 0);
