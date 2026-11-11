// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE VIOLET EST REFUSÉ (CLAUDE.md §3 « Palette », §7 ; chantier
//  v36-visuel-2 du 6 nov. ; récit : docs/passation/2026-11-06-visuel-2.md).
//  Julien a refusé le violet ; la 1re passe visuelle a pourtant trouvé une puce de
//  compte VIOLETTE dans Achats (`ACCT_COLORS` : #9b51e0, #e056fd, #6c5ce7). Règle :
//   V1 aucune couleur écrite dans src/ (CSS, JS, JSX — styles en ligne compris, et
//      index.html) n'a une teinte de 260° à 320° SATURÉE (saturation HSL ≥ 25 %,
//      chroma ≥ 12 %, luminosité entre 12 % et 92 % : un gris bleuté, un quasi-blanc
//      ou un quasi-noir ne sont pas « du violet ») ;
//   V2 aucun nom de couleur violet (purple, violet, indigo, magenta, fuchsia, orchid,
//      plum, rebeccapurple, slateblue, blueviolet…) posé comme VALEUR (CSS ou chaîne JS) ;
//   V3 la palette d'identité des comptes (`ACCT_COLORS`) existe et n'en porte aucune.
//  On juge la RÈGLE (teinte calculée : #rgb, #rrggbb, #rrggbbaa, rgb(), rgba(), hsl()),
//  pas l'orthographe ; les commentaires ne jugent rien.
//  `--mutation` rejoue V1, V2, V3 sur des copies affaiblies : chacune DOIT rougir.
//    node scripts/audit-violet.cjs [--mutation]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const SRC = path.join(RACINE, 'src');

const hexRgb = (h) => { h = h.replace('#', ''); if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const hsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; } return { h, s, l, c: mx - mn }; };
const estVioletHsl = ({ h, s, l, c }) => h >= 260 && h <= 320 && s >= 0.25 && c >= 0.12 && l >= 0.12 && l <= 0.92;
const estViolet = (rgb) => estVioletHsl(hsl(rgb));
const COULEUR = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)|hsla?\(\s*(-?\d+(?:\.\d+)?)(?:deg)?\s*[, ]\s*(\d+(?:\.\d+)?)%\s*[, ]\s*(\d+(?:\.\d+)?)%/g;
const NOMS = 'purple|violet|darkviolet|blueviolet|indigo|magenta|darkmagenta|fuchsia|orchid|darkorchid|mediumorchid|plum|rebeccapurple|mediumpurple|slateblue|darkslateblue|mediumslateblue';
const NOM_CSS = new RegExp(':[^;{}]*(?<![.\\w-])(' + NOMS + ')\\b', 'i');
// En JS, seulement une VALEUR de style (`color: 'purple'`) — un mot de couleur dans une liste
// de mots (« violet » d'un titre d'annonce) n'est pas une couleur posée.
const NOM_JS = new RegExp('\\b(color|background|backgroundColor|fill|stroke|border|borderColor|outline|outlineColor|accentColor|caretColor)\\s*:\\s*[\'"`](' + NOMS + ')\\b', 'i');
// Les EXCEPTIONS, nommées une par une (fichier → morceau de ligne exact → pourquoi). Une
// couleur de MARQUE (logo d'un transporteur) ou la roue des teintes d'un sélecteur de couleur
// LIBRE ne sont pas la palette de l'app. Rien d'autre.
const EXCEPTIONS = {
  'src/App.jsx': [
    ["bg: '#4D148C'", 'couleur de marque du logo FedEx (pastille de transporteur)'],
    ['conic-gradient(red,orange,yellow,lime,cyan,blue,magenta', "roue des teintes du sélecteur de couleur LIBRE (Stock 3D, murs) : c'est lui qui choisit"],
  ],
  // (11 nov.) Les marques des transporteurs ont déménagé ici (« Transporteurs parfaits », 1f50b04b, fa5edfac) :
  // la même exception (logo d'un transporteur), nommée ligne par ligne.
  'src/transporteursVisuels.js': [
    ["fedex: { fond: '#FFFFFF', svg: `<svg", 'logo FedEx (dessin de la tuile, son violet de marque)'],
    ["fedex:        { nom: 'FedEx',         logos: [], marque: { fond: '#4D148C'", 'couleur de marque FedEx (tuile maison)'],
    ["relaiscolis:  { nom: 'Relais Colis',  logos: [], marque: { fond: '#7A1F6B'", 'couleur de marque Relais Colis (tuile maison)'],
  ],
  'src/facturePro/regle.js': [
  ],
};
const excepte = (rel, l) => (EXCEPTIONS[rel] || []).some(([bout]) => l.includes(bout));

function fichiers(d, o = []) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) fichiers(p, o); else if (/\.(jsx?|mjs|css|html)$/.test(f)) o.push(p); } return o; }
const blanc = (m) => m.replace(/[^\n]/g, ' ');
const sansCommentaires = (t, css) => css ? t.replace(/\/\*[\s\S]*?\*\//g, blanc)
  : t.replace(/\{\/\*[\s\S]*?\*\/\}/g, blanc).replace(/<!--[\s\S]*?-->/g, blanc).replace(/^[ \t]*(\/\/|\/\*|\*)[^\n]*/gm, blanc).replace(/(^|[;,{}()\s])\/\/ [^\n]*/g, (m, a) => a + blanc(m.slice(a.length)));

function juger(depot) {
  const rouges = [];
  const dit = (c, m, d) => { if (!c) rouges.push(m + (d ? ' — ' + String(d).slice(0, 300) : '')); return c; };
  const lire = (rel) => depot[rel] != null ? depot[rel] : fs.readFileSync(path.join(RACINE, rel), 'utf8');
  const tous = fichiers(SRC).map((p) => path.relative(RACINE, p).split(path.sep).join('/'));
  if (fs.existsSync(path.join(RACINE, 'index.html'))) tous.push('index.html');
  for (const rel of Object.keys(depot)) if (!tous.includes(rel)) tous.push(rel);
  let vus = 0;
  for (const rel of tous) {
    const css = rel.endsWith('.css');
    const lignes = sansCommentaires(lire(rel), css).split('\n');
    lignes.forEach((l, i) => {
      if (excepte(rel, l)) return;
      COULEUR.lastIndex = 0; let m;
      while ((m = COULEUR.exec(l))) {
        vus++;
        let v;
        if (m[1]) v = estViolet(hexRgb(m[1]));
        else if (m[2] != null) v = estViolet([+m[2], +m[3], +m[4]]);
        else { const h = ((+m[5] % 360) + 360) % 360, s = +m[6] / 100, L = +m[7] / 100; v = estVioletHsl({ h, s, l: L, c: (1 - Math.abs(2 * L - 1)) * s }); }
        dit(!v, `V1 ${rel}:${i + 1} une couleur violette (teinte 260–320°, saturée)`, m[0] + ' · ' + l.trim().slice(0, 140));
      }
      const nom = css ? NOM_CSS.exec(l) : (NOM_JS.exec(l) || (/<[^>]*style=/.test(l) ? NOM_CSS.exec(l) : null));
      dit(!nom, `V2 ${rel}:${i + 1} un nom de couleur violette posé comme valeur`, nom ? nom[0] + ' · ' + l.trim().slice(0, 140) : '');
    });
  }
  const app = sansCommentaires(lire('src/App.jsx'), false);
  const pal = /const ACCT_COLORS\s*=\s*\[([^\]]*)\]/.exec(app);
  if (dit(!!pal, 'V3 la palette des comptes (`ACCT_COLORS`) est lisible dans App.jsx')) {
    const cs = pal[1].match(/#[0-9a-fA-F]{6}\b/g) || [];
    dit(cs.length >= 2, `V3 ACCT_COLORS porte au moins deux teintes (${cs.length})`);
    for (const c of cs) dit(!estViolet(hexRgb(c)), `V3 ${c} (pastille de compte) n'est pas violette`);
  }
  dit(vus > 500, `les couleurs de src/ ont bien été lues (${vus})`);
  return rouges;
}

function mutations() {
  const app = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');
  const cas = [
    ['V1 un #9b51e0 dans une feuille de style', { 'src/__mutation__.css': '.x { color: #9b51e0; }\n' }],
    ['V1 un rgb(155, 81, 224) en style en ligne', { 'src/__mutation__.jsx': "const x = <i style={{ color: 'rgb(155, 81, 224)' }}/>;\n" }],
    ['V1 un hsl(285, 70%, 55%)', { 'src/__mutation__.css': '.x { background: hsl(285, 70%, 55%); }\n' }],
    ['V1 un #a3f en court', { 'src/__mutation__.css': '.x { border-color: #a3f; }\n' }],
    ['V2 « purple » comme valeur CSS', { 'src/__mutation__.css': '.x { color: purple; }\n' }],
    ["V2 'violet' comme valeur de style JS", { 'src/__mutation__.jsx': "const s = { color: 'violet' };\n" }],
    ['V3 une pastille de compte violette', { 'src/App.jsx': app.replace(/const ACCT_COLORS\s*=\s*\[/, "const ACCT_COLORS = ['#9b51e0',") }],
  ];
  let ok = 0;
  for (const [nom, depot] of cas) {
    const r = juger(depot);
    const rougit = r.length > 0;
    if (rougit) ok++;
    console.log((rougit ? '✅ ' : '❌ ') + 'mutation « ' + nom + ' » ' + (rougit ? 'rougit (' + r[0].slice(0, 90) + ')' : 'NE ROUGIT PAS'));
  }
  // Et un gris bleuté, un quasi-noir, le bleu d'Apple ne rougissent pas (pas de faux positif).
  const faux = juger({ 'src/__mutation__.css': '.x { color: #6E6E73; background: #1C1C1E; border-color: #0071E3; outline-color: #5856D6; }\n' });
  console.log((faux.length ? '❌ ' : '✅ ') + 'gris bleuté, quasi-noir, bleu d’Apple, indigo d’iOS (241°) : ' + (faux.length ? 'FAUX POSITIF ' + faux[0] : 'aucun faux positif'));
  const total = cas.length + 1, bons = ok + (faux.length ? 0 : 1);
  console.log(bons === total ? `\n✅ audit-violet --mutation : ${bons}/${total}` : `\n❌ audit-violet --mutation : ${bons}/${total}`);
  process.exit(bons === total ? 0 : 1);
}

if (process.argv.includes('--mutation')) mutations();
else {
  const r = juger({});
  for (const x of r) console.log('❌ ' + x);
  console.log(r.length ? `\n❌ audit-violet : ${r.length} rouge(s)` : '\n✅ audit-violet : aucun violet dans les styles (§3, Palette)');
  process.exit(r.length ? 1 : 0);
}
