// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE STYLE « COMME VINTEX » TIENT (décision de Julien du 21 nov. 2026 ;
//  contrat docs/design/NATIF.md §1 ; récit docs/passation/2026-11-21-style-vintex.md).
//   S1 plus AUCUN bleu vif écrit dans l'app (src/, public/, index.html : CSS, JS, JSX,
//      styles en ligne compris) : teinte 195°–250°, saturation ≥ 55 %, luminosité 30–72 %
//      (#0068D6, #0071E3, #0A84FF, #409CFF… et leurs rgb()). Permis : les LOGOS de marque
//      (fichiers nommés dans MARQUES_FICHIERS, ou une ligne marquée `logo-marque`) ;
//   S2 les jetons : l'accent est le VERT SAPIN #0F6B4C (nuit #3FD49A), le bouton plein est à
//      l'ENCRE (`--n-plein` = `--n-encre`), le fond #F1F3F6 / #0F0F11, les cartes #FFFFFF / #18181B,
//      les contours #E4E4E7, et aucun jeton `--n-*` n'est bleu ni violet ;
//   S3 l'onglet actif de la barre du bas porte l'accent sur son voile (`--n-teinte`), pas le rose
//      de la maquette (trop proche du rouge réservé au doublon) ;
//   S4 plus AUCUN texte en capitales : `text-transform: uppercase` (CSS) / `textTransform:'uppercase'`
//      (JSX) / `text-transform:uppercase` dans une chaîne HTML — sauf la PLAQUE du N° et le champ où
//      l'on tape un N° (sélecteur qui dit `plaque` ou `vrm-inv-champ`) ;
//   S5 pas de violet : `scripts/audit-violet.cjs` passe ; pas de rouge hors doublon de N° :
//      `scripts/audit-rouge-doublon.cjs` passe (lancés d'ici, leur verdict est le nôtre).
//  On juge la RÈGLE (teinte calculée), pas l'orthographe ; les commentaires ne jugent rien.
//  `--mutation` remet un bleu, un jeton bleu, un plein bleu, un onglet rose, un titre en capitales :
//  chacun DOIT rougir.
//    node scripts/audit-style-vintex.cjs [--mutation]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');

const MARQUES_FICHIERS = new Set([
  'src/transporteursVisuels.js',   // logos des transporteurs (Chronopost bleu, GLS…)
  'src/natif/logo-site.css',       // logos des sites (eBay : rouge, bleu, jaune, vert)
  'src/visuelsReseaux.js',         // les teintes qu'IL choisit pour ses visuels de réseaux sociaux (pas la palette de l'app)
  'src/Room3D.jsx',                // décor de la pièce 3D (jeans, cartons) — pas l'interface
]);
// Les couleurs de MARQUE écrites hors de ces fichiers (un logo posé dans un écran) : Discord (#5865F2, « blurple »).
const MARQUES_COULEURS = new Set(['#5865f2']);
const hex6 = (h) => { h = h.replace('#', ''); if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const hsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; } return { h, s, l }; };
const estBleuVif = (rgb) => { const { h, s, l } = hsl(rgb); return h >= 195 && h <= 250 && s >= 0.55 && l >= 0.3 && l <= 0.72; };
const estViolet = (rgb) => { const { h, s, l } = hsl(rgb); return h > 255 && h <= 320 && s >= 0.25 && l >= 0.12 && l <= 0.92; };
const COULEUR = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])|rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/g;

function fichiers(d, o = []) {
  if (!fs.existsSync(d)) return o;
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (f !== 'node_modules' && f !== 'brands') fichiers(p, o); }
    else if (/\.(jsx?|mjs|css|html)$/.test(f)) o.push(p);
  }
  return o;
}
const blanc = (m) => m.replace(/[^\n]/g, ' ');
// Les commentaires ne jugent rien. En JS, seulement les commentaires SÛRS (comme audit-rouge-doublon).
const sansCommentaires = (t, css) => css ? t.replace(/\/\*[\s\S]*?\*\//g, blanc)
  : t.replace(/\{\/\*[\s\S]*?\*\/\}/g, blanc).replace(/^[ \t]*(\/\/|\/\*|\*)[^\n]*/gm, blanc).replace(/(^|[;,{}()\s])\/\/ [^\n]*/g, (m, a) => a + blanc(m.slice(a.length)));
const PERMIS_CAPITALES = /plaque|vrm-inv-champ/i;

function juger(depot = {}, { sousAudits = true } = {}) {
  const rouges = [];
  const dit = (c, m, d) => { if (!c) rouges.push(m + (d ? ' — ' + String(d).slice(0, 300) : '')); return c; };
  const lire = (rel) => depot[rel] != null ? depot[rel] : fs.readFileSync(path.join(RACINE, rel), 'utf8');
  const tous = [...fichiers(path.join(RACINE, 'src')), ...fichiers(path.join(RACINE, 'public')), path.join(RACINE, 'index.html')]
    .map((p) => path.relative(RACINE, p).split(path.sep).join('/'));
  for (const rel of Object.keys(depot)) if (!tous.includes(rel)) tous.push(rel);
  let vus = 0;
  for (const rel of tous) {
    const css = rel.endsWith('.css');
    const brut = lire(rel);
    const net = rel.endsWith('.html') ? brut.replace(/<!--[\s\S]*?-->/g, blanc) : sansCommentaires(brut, css);
    const lignes = net.split('\n');
    const lignesBrutes = brut.split('\n');
    vus++;
    lignes.forEach((l, i) => {
      // S1 — un bleu vif.
      if (!MARQUES_FICHIERS.has(rel) && !/logo-marque/.test(lignesBrutes[i] || '')) {
        COULEUR.lastIndex = 0; let m;
        while ((m = COULEUR.exec(l))) {
          const rgb = m[1] ? hex6(m[1]) : [+m[2], +m[3], +m[4]];
          if (rgb.some((x) => x > 255)) continue;
          if (m[1] && MARQUES_COULEURS.has(('#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('')))) continue;
          if (estBleuVif(rgb)) dit(false, `S1 ${rel}:${i + 1} un bleu vif (${m[0]}) — l'accent est le vert sapin, le bleu est retiré`, l.trim().slice(0, 140));
        }
      }
      // S4 — un texte en capitales (JSX, chaîne HTML).
      if (!css && (/textTransform\s*:\s*['"`]uppercase/.test(l) || /text-transform\s*:\s*uppercase/i.test(l.replace(/\[style\*="[^"]*"\]/g, '')))) {
        dit(PERMIS_CAPITALES.test(l), `S4 ${rel}:${i + 1} un texte en capitales — les titres s'écrivent en minuscules (sauf la plaque du N°)`, l.trim().slice(0, 140));
      }
    });
    // S4 — CSS : bloc par bloc (le sélecteur dit si c'est la plaque du N°).
    if (css) {
      const re = /([^{}]*)\{([^{}]*)\}/g; let b;
      while ((b = re.exec(net))) {
        if (!/text-transform\s*:\s*uppercase/i.test(b[2])) continue;
        const sel = b[1].trim().split('\n').pop();
        dit(PERMIS_CAPITALES.test(sel), `S4 ${rel} « ${sel.slice(0, 80)} » en capitales — les titres s'écrivent en minuscules (sauf la plaque du N°)`);
      }
    }
  }
  dit(vus > 300, `S1 assez de fichiers lus (${vus})`);

  // S2 — les jetons.
  const jet = sansCommentaires(lire('src/natif/jetons.css'), true);
  const iSombre = jet.indexOf(':root[data-theme="dark"]');
  dit(iSombre > 0, 'S2 src/natif/jetons.css a un bloc sombre');
  const blocClair = jet.slice(0, iSombre), blocSombre = jet.slice(iSombre);
  const val = (bloc, nom) => { const m = new RegExp('--n-' + nom + '\\s*:\\s*([^;]+);').exec(bloc); return m ? m[1].trim().toLowerCase() : null; };
  const attendus = [
    [blocClair, 'clair', { accent: '#19222c', fond: '#878b92', carte: '#f1f2f4', bord: '#b9bdc3' }],   // (25 nov., Julien : « gris moyen c'est d'accord ») ; avant (23 nov.) gris clair #dfe1e5, accent ardoise #3d4b5b
    [blocSombre, 'sombre', { accent: '#f4f4f5', fond: '#1c1c20', carte: '#2a2a2f' }],   // (23 nov., Julien) la nuit = le gris de vrm.center
  ];
  for (const [bloc, nom, att] of attendus) {
    for (const [k, v] of Object.entries(att)) dit(val(bloc, k) === v, `S2 --n-${k} (${nom}) vaut ${v}`, val(bloc, k));
    // (23 nov.) Le plein : à l'ARDOISE (l'accent) en clair — plus jamais un aplat noir ; à l'encre la nuit.
    if (nom === 'clair') dit(val(bloc, 'plein') === val(bloc, 'accent'), `S2 le bouton plein (${nom}) est à l'ardoise (--n-plein = --n-accent, jamais noir)`, `${val(bloc, 'plein')} / ${val(bloc, 'accent')}`);
    else dit(val(bloc, 'plein') === val(bloc, 'encre'), `S2 le bouton plein (${nom}) est à l'encre (--n-plein = --n-encre)`, `${val(bloc, 'plein')} / ${val(bloc, 'encre')}`);
    // (23 nov., « j'aime pas le orange ») « à faire » n'est plus orange : l'ambre du clair EST l'accent.
    if (nom === 'clair') dit(val(bloc, 'ambre') === val(bloc, 'accent'), `S2 plus d'orange (${nom}) : --n-ambre = --n-accent`, val(bloc, 'ambre'));
    COULEUR.lastIndex = 0; let m;
    while ((m = COULEUR.exec(bloc))) { const rgb = m[1] ? hex6(m[1]) : [+m[2], +m[3], +m[4]]; dit(!estBleuVif(rgb) && !estViolet(rgb), `S2 aucun jeton ${nom} n'est bleu ni violet`, m[0]); }
  }
  // S2 bis — themeMineral (les couleurs que lit le code d'avant) suit les jetons.
  const th = lire('src/themeMineral.js');
  for (const [nomTheme, acc] of [['MINERAL', '#19222c'], ['MINERAL_DARK', '#f4f4f5']]) {
    const m = new RegExp('export const ' + nomTheme + '\\s*=\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\);').exec(th);
    if (!dit(!!m, `S2 ${nomTheme} lisible dans themeMineral.js`)) continue;
    const a = (/\baccent\s*:\s*'(#[0-9a-fA-F]{6})'/.exec(m[1]) || [])[1];
    dit(a && a.toLowerCase() === acc, `S2 ${nomTheme}.accent vaut ${acc}`, a);
    COULEUR.lastIndex = 0; let c;
    while ((c = COULEUR.exec(m[1]))) { const rgb = c[1] ? hex6(c[1]) : [+c[2], +c[3], +c[4]]; dit(!estBleuVif(rgb), `S2 ${nomTheme} sans bleu vif`, c[0]); }
  }

  // S3 — l'onglet actif : l'accent, sur son voile.
  const nat = sansCommentaires(lire('src/natif/natif.css'), true);
  dit(/\.n-onglet\[aria-current="page"\]\s*\{[^}]*color:\s*var\(--n-accent\)/.test(nat), "S3 l'onglet actif est à l'accent (l'encre)");
  dit(/\.n-onglet\[aria-current="page"\]\s+\.n-onglet-icone\s*\{[^}]*background:\s*var\(--n-teinte\)/.test(nat), "S3 l'icône de l'onglet actif est posée sur le voile d'accent (--n-teinte)");

  // S5 — violet et rouge : les audits dédiés.
  if (sousAudits) for (const a of ['audit-violet.cjs', 'audit-rouge-doublon.cjs']) {
    const r = spawnSync(process.execPath, [path.join(__dirname, a)], { encoding: 'utf8' });
    dit(r.status === 0, `S5 ${a} passe`, (r.stdout + r.stderr).split('\n').filter((x) => /❌|✗/.test(x)).slice(0, 3).join(' | '));
  }
  return rouges;
}

function mutations() {
  const lire = (rel) => fs.readFileSync(path.join(RACINE, rel), 'utf8');
  const jet = lire('src/natif/jetons.css'), nat = lire('src/natif/natif.css');
  const cas = [
    ['un bleu vif dans une feuille', { 'src/natif/complements.css': lire('src/natif/complements.css') + '\n.x-mutation { color: #0068D6; }\n' }, /S1/],
    ['un bleu vif en rgb() dans un style en ligne', { 'src/mutation-vintex.jsx': "export const X = () => <b style={{ color: 'rgb(0, 113, 227)' }}/>;\n" }, /S1/],
    ['l\'accent remis au bleu', { 'src/natif/jetons.css': jet.replace('--n-accent: #3D4B5B;', '--n-accent: #0068D6;') }, /S2 --n-accent \(clair\)/],
    ['le plein remis au noir', { 'src/natif/jetons.css': jet.replace('--n-plein: #3D4B5B;', '--n-plein: #16181D;') }, /S2 le bouton plein \(clair\)/],
    ['l\'orange revenu', { 'src/natif/jetons.css': jet.replace('--n-ambre: #3D4B5B;', '--n-ambre: #874600;') }, /S2 plus d'orange/],
    ['l\'onglet actif en rose', { 'src/natif/natif.css': nat.replace('.n-onglet[aria-current="page"] { color: var(--n-accent);', '.n-onglet[aria-current="page"] { color: #C02D55;') }, /S3/],
    ['un titre en capitales (CSS)', { 'src/natif/complements.css': lire('src/natif/complements.css') + '\n.n-carte-titre-mutation { text-transform: uppercase; }\n' }, /S4/],
    ['un titre en capitales (JSX)', { 'src/mutation-vintex.jsx': "export const X = () => <b style={{ textTransform: 'uppercase' }}>À envoyer</b>;\n" }, /S4/],
  ];
  let ok = true;
  for (const [nom, depot, attendu] of cas) {
    const r = juger(depot, { sousAudits: false });
    const rougit = r.some((x) => attendu.test(x));
    console.log(`${rougit ? '✅' : '❌'} mutation « ${nom} » : ${rougit ? 'rougit' : 'NE ROUGIT PAS'}`);
    if (!rougit) ok = false;
  }
  return ok;
}

if (require.main === module) {
  const rouges = juger();
  for (const r of rouges.slice(0, 80)) console.log('❌ ' + r);
  if (rouges.length > 80) console.log(`… et ${rouges.length - 80} de plus`);
  let ok = rouges.length === 0;
  console.log(ok ? '✅ audit-style-vintex : gris clair étagé, accent ardoise, plus d’orange (23 nov.), aucun bleu vif, aucun titre en capitales, ni violet ni rouge hors doublon' : `\n❌ audit-style-vintex : ${rouges.length} rouge(s)`);
  if (process.argv.includes('--mutation')) ok = mutations() && ok;
  process.exit(ok ? 0 : 1);
}
module.exports = { juger };
