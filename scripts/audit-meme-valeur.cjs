// ════════════════════════════════════════════════════════════════════════════
//  « LA MÊME VALEUR, LA MÊME VERSION » (16 nov., lot vitesse-moteur) — src/memeValeur.js
//  node scripts/audit-meme-valeur.cjs [--prouve]
//
//  `gardeSiMeme(avant, apres)` garde l'identité d'un état reposé au MÊME contenu (aucun rendu,
//  aucun calcul refait). Le risque : une valeur DIFFÉRENTE jugée « la même » — l'écran garderait
//  l'ancienne et un chiffre serait faux. Ce contrôle EXÉCUTE le module et exige :
//   · le même contenu (objets neufs, clés dans un autre ordre, Set et Map neufs) ⇒ l'ancienne valeur ;
//   · toute différence (une valeur, une clé en plus ou en moins, un élément d'un Set — dont le cas
//     où JSON.stringify écrit « {} » pour deux Set différents —, un type, un tableau réordonné,
//     un objet qui n'est pas simple) ⇒ la neuve ;
//   · App.jsx passe par lui aux deux endroits (nuage relu `useStateCle`, n° de transaction ⇒ annonce).
//  --prouve : mutations (Set comparé par taille seulement, clés de b oubliées, tableaux sans
//  longueur, JSON) ⇒ chacune doit faire rougir le contrôle.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const R = path.join(__dirname, '..');
let ko = 0;
const dit = (c, m) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m); };

const MEMES = () => [
  ['objet neuf, même contenu', { a: 1, b: { c: '2', d: [1, 2] } }, { a: 1, b: { c: '2', d: [1, 2] } }],
  ['clés dans un autre ordre', { x: 1, y: 2 }, { y: 2, x: 1 }],
  ['N° d\'annonces (forme de vinted_annonce_numeros)', { 7000000000: { num: '1', numero: '365', auto: true } }, { 7000000000: { num: '1', numero: '365', auto: true } }],
  ['Set neuf, mêmes éléments', new Set(['1', '2', '3']), new Set(['3', '2', '1'])],
  ['Map neuve, mêmes entrées', new Map([['a', { n: 1 }]]), new Map([['a', { n: 1 }]])],
  ['objet vide', {}, {}],
  ['tableau vide', [], []],
  ['NaN', { v: NaN }, { v: NaN }],
];
const DIFFERENTS = () => [
  ['une valeur change', { a: 1, b: 2 }, { a: 1, b: 3 }],
  ['un texte devient un nombre', { a: '1' }, { a: 1 }],
  ['une clé en plus', { a: 1 }, { a: 1, b: 2 }],
  ['une clé en moins', { a: 1, b: 2 }, { a: 1 }],
  ['même nombre de clés, autres clés', { a: 1, b: undefined }, { a: 1, c: undefined }],
  ['Set différent (JSON les écrirait tous deux « {} »)', new Set(['1', '2']), new Set(['1', '3'])],
  ['Set plus grand', new Set(['1']), new Set(['1', '2'])],
  ['Map différente', new Map([['a', 1]]), new Map([['a', 2]])],
  ['tableau réordonné', [1, 2], [2, 1]],
  ['tableau plus long', [1], [1, 1]],
  ['tableau contre objet', [], {}],
  ['valeur profonde', { a: { b: { c: [1, { d: 'x' }] } } }, { a: { b: { c: [1, { d: 'y' }] } } }],
  ['Date (pas un objet simple)', { d: new Date(0) }, { d: new Date(0) }],
  ['null contre objet', null, {}],
  ['-0 et 0', { v: -0 }, { v: 0 }],
];

(async () => {
  const src = fs.readFileSync(path.join(R, 'src', 'memeValeur.js'), 'utf8');
  const prouve = process.argv.includes('--prouve');
  const mutations = [
    ['Set comparé par taille seulement', (s) => s.replace('for (const x of a) if (!b.has(x)) return false;', '')],
    ['clés comparées sans leur nombre', (s) => s.replace('if (ka.length !== kb.length) return false;', '')],
    ['tableaux sans leur longueur', (s) => s.replace("if (!Array.isArray(b) || a.length !== b.length) return false;", "if (!Array.isArray(b)) return false;")],
    ['JSON au lieu de la comparaison', (s) => s.replace('export function memeValeur(a, b, profondeur = 0) {', 'export function memeValeur(a, b, profondeur = 0) { try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) {}')],
    ['objets non simples acceptés', (s) => s.replace('if (!simple(a) || !simple(b)) return false;', '')],
  ];
  const essais = prouve ? mutations : [['code tel quel', (s) => s]];
  for (const [nom, muter] of essais) {
    const f = path.join(require('os').tmpdir(), `memeValeur-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
    fs.writeFileSync(f, muter(src));
    const M = await import('file://' + f);
    fs.unlinkSync(f);
    const avant = ko;
    for (const [t, a, b] of MEMES()) dit(M.gardeSiMeme(a, b) === a, `[${nom}] même contenu garde l'ancienne valeur : ${t}`);
    for (const [t, a, b] of DIFFERENTS()) dit(M.gardeSiMeme(a, b) === b, `[${nom}] contenu différent ⇒ la neuve : ${t}`);
    // Grand volume : 20 000 liens n° ⇒ annonce, un seul change.
    const grand = () => Object.fromEntries(Array.from({ length: 20000 }, (_, i) => [String(22000000000 + i), String(7000000000 + i)]));
    const g1 = grand(), g2 = grand(), g3 = grand(); g3['22000012345'] = 'autre';
    dit(M.gardeSiMeme(g1, g2) === g1 && M.gardeSiMeme(g1, g3) === g3, `[${nom}] 20 000 liens : identiques gardés, un seul changé ⇒ la neuve`);
    if (prouve) { const rouge = ko > avant; ko = avant; dit(rouge, `mutation « ${nom} » ⇒ rouge`); }
  }
  const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
  dit(/onCleRelue\(k, \(\) => \{ try \{ const n = initRef\.current\(\); setV\(\(avant\) => gardeSiMeme\(avant, n\)\);/.test(app), 'App.jsx : `useStateCle` garde la valeur relue à l\'identique');
  dit(/setTxnItem\(\(avant\) => gardeSiMeme\(avant, m\)\)/.test(app), 'App.jsx : le n° de transaction ⇒ annonce relu à l\'identique garde sa valeur');
  dit(!/setGeo\(prev =>/.test(app) && !/const \[geo, setGeo\] = useState\(\(\) => load\('vrm_geo_cache_v2'/.test(app), 'App.jsx : le cache de géocodage n\'est plus un état du moteur (aucun rendu ne le lisait)');
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ même valeur, même version');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
