// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE STUDIO BLEU CLAIR (14 nov., décision de Julien ; spec :
//  docs/design/studio-bleu-clair.md ; récit : docs/passation/2026-11-14-studio-fondation.md)
//
//  Plusieurs chantiers d'écran utilisent les NOMS fixés par le contrat : s'ils disparaissent,
//  leurs écrans perdent leur dessin sans aucune erreur. On lit le code et on juge :
//   S1 les jetons du contrat (`--sb-*`) existent dans src/design/studio.css, et chaque jeton de
//      COULEUR / d'ombre est redéfini la nuit sous `:root[data-theme="dark"]` ET sous
//      `prefers-color-scheme: dark` (gardé : seulement sans choix posé) ;
//   S2 les classes du contrat existent (les quatre formes de bouton, les composants, la coque)
//      et `data-espace` décline ses quatre aplats, le jour et la nuit ;
//   S3 studio.css est la DERNIÈRE feuille importée par src/App.jsx (après styles-tablette et
//      styles-vitrine), ses polices juste avant ; `prefers-reduced-motion` y est traité ;
//   S4 le rouge `--sb-doublon` ne colore que la plaque en doublon (`.is-double`) ;
//   S5 les polices : deux woff2 dans le dépôt, leur licence OFL jointe, `font-display: swap`,
//      aucune police chargée d'ailleurs ;
//   S6 dans les fichiers DÉJÀ MIGRÉS (liste blanche qui grandit, `MIGRES`), chaque <button> porte
//      une des quatre formes (`sb-btn-plein`, `sb-touche`, `sb-rond`, `sb-lien`) ou est une
//      rangée / tuile / lame ENTIÈRE qui se touche (`sb-rangee`, `sb-tuile`, `sb-lame`), ou
//      se déclare chiffre touchable (`data-sb-forme="chiffre"`) — aucune autre forme ;
//   S7 le disque : ses quatre gestes sont branchés sur des gestes qui EXISTENT dans la coque
//      (loupe, scanner de Ventes, « Publier ailleurs », « Imprimer les bordereaux du jour »),
//      et « Imprimer N » lit le nombre que publie Ventes (`vrm_colis_prets.lot`), jamais un 0 deviné.
//  « Un seul plein par écran RENDU » se mesure sur l'app rendue : scripts/bancs/studio-coque.cjs.
//  `--prouve` : chaque mutation réaffaiblit une règle ; l'audit DOIT rougir.
//    node scripts/audit-studio.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const parser = require('@babel/parser');

// Les fichiers dont TOUS les boutons sont déjà aux quatre formes. Un chantier d'écran qui migre son
// fichier l'ajoute ici (jamais l'inverse) : la liste grandit, elle ne rétrécit pas.
const MIGRES = [
  'src/design/DisqueEventail.jsx',
  'src/ui/Filtres.jsx', 'src/ui/BarreOutils.jsx', 'src/ui/MenuCompte.jsx', 'src/ui/Feuille.jsx',
  'src/ui/LigneAFaire.jsx', 'src/ui/AFaire.jsx', 'src/ui/Ligne.jsx', 'src/ui/BandeChiffres.jsx',
  'src/ARetirerAilleurs.jsx',   // (15 nov., retrait-ailleurs)
  'src/MemePhoto.jsx',   // (15 nov., lot meme-photo)
  'src/partenaires/Partenaires.jsx', 'src/VuePartenaire.jsx',   // (15 nov.) le programme partenaire
  'src/RetoursLitiges.jsx',   // (15 nov., lot retours) « À renvoyer »
];
const FORMES = /\bsb-(btn-plein|touche|rond|lien|rangee|tuile|lame)\b/;

const JETONS_COULEUR = ['--sb-haut', '--sb-aplat', '--sb-bas', '--sb-porcelaine', '--sb-porcelaine-2', '--sb-creux', '--sb-verre', '--sb-encre', '--sb-encre-2',
  '--sb-diode', '--sb-lien', '--sb-ambre', '--sb-ambre-point', '--sb-o', '--sb-ombre-pose', '--sb-ombre-plan', '--sb-ombre-avant'];
const JETONS_FIXES = ['--sb-r-tuile', '--sb-r-plan', '--sb-r-barre', '--sb-r-touche', '--sb-r-plaque', '--sb-r-vignette', '--sb-police-affiche', '--sb-police-texte',
  '--sb-e-appui', '--sb-e-espace', '--sb-e-avant'];
const CLASSES = ['.sb-btn-plein', '.sb-btn-plein--barre', '.sb-touche', '.sb-rond', '.sb-rond--disque', '.sb-lien', '.sb-plaque', '.sb-plaque.is-double', '.sb-plaque--grande',
  '.sb-tuile', '.sb-tuile-plus', '.sb-rangee', '.sb-vignette', '.sb-bande', '.sb-chiffre-affiche', '.sb-feuille', '.sb-barre', '.sb-disque', '.sb-eventail',
  '.sb-segment', '.sb-champ', '.sb-avant', '.sb-diode', '.sb-onde', '.sb-voile', '.sb-lame'];
const TAILLES = ['1x1', '2x1', '2x2', '3x1'];
const ESPACES = ['journee', 'paires', 'ventes', 'argent'];

const sansCom = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
// Les déclarations d'un bloc (tous les blocs dont le sélecteur correspond exactement).
function blocs(css, selRe) {
  const out = []; const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) { if (selRe.test(m[1].trim())) out.push(m[2]); }
  return out.join(';');
}
const declare = (corps, v) => new RegExp('(^|[;\\s])' + v.replace(/[-]/g, '\\-') + '\\s*:').test(corps);

function juger(depot) {
  const rouges = [];
  const dit = (c, m, d) => { if (!c) rouges.push(m + (d ? ' — ' + String(d).slice(0, 300) : '')); return c; };
  const lire = (rel) => depot[rel] != null ? depot[rel] : (fs.existsSync(path.join(RACINE, rel)) ? fs.readFileSync(path.join(RACINE, rel), 'utf8') : '');
  const css = sansCom(lire('src/design/studio.css'));
  if (!dit(css.length > 1000, 'S0 src/design/studio.css existe')) return rouges;

  // S1 — les jetons, le jour et la nuit.
  // Le PREMIER bloc :root (hors media) : un :root de « prefers-contrast » ne compte pas.
  const racine = (() => { const i = css.search(/(^|\n):root \{/); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); })();
  for (const v of [...JETONS_COULEUR, ...JETONS_FIXES]) dit(declare(racine, v), `S1 ${v} est posé sur :root`);
  const nuit = blocs(css, /^:root\[data-theme="dark"\]$/);
  const sys = (() => { const i = css.indexOf('@media (prefers-color-scheme: dark)'); if (i < 0) return ''; const j = css.indexOf(':root:not([data-theme])', i); return j < 0 ? '' : css.slice(j, css.indexOf('}', j)); })();
  for (const v of JETONS_COULEUR) {
    dit(declare(nuit, v), `S1 ${v} est redéfini la nuit (:root[data-theme="dark"])`);
    dit(declare(sys, v), `S1 ${v} est redéfini sous prefers-color-scheme: dark (sans choix posé)`);
  }
  dit(/:root,\s*\.sb-plaque\.is-double\s*\{\s*--sb-doublon:\s*#[0-9A-Fa-f]{6}/.test(css) && /:root\[data-theme="dark"\][^{]*\.sb-plaque\.is-double\s*\{\s*--sb-doublon/.test(css), 'S1 --sb-doublon existe le jour et la nuit');
  dit(/:root:root:root\s*\{[^}]*--d-fond:\s*var\(--sb-aplat\)/.test(css) && /--d-encre:\s*var\(--sb-encre\)/.test(css) && /--d-accent:\s*var\(--sb-diode\)/.test(css), 'S1 la famille --d-* lit le studio (toute l’app change d’un coup)');

  // S2 — les classes du contrat, l'espace.
  for (const c of CLASSES) dit(new RegExp(c.replace(/[.]/g, '\\.').replace(/-/g, '\\-') + '(?![\\w-])').test(css), `S2 la classe ${c} est définie`);
  for (const t of TAILLES) dit(css.includes(`.sb-tuile[data-taille="${t}"]`), `S2 .sb-tuile[data-taille="${t}"]`);
  for (const e of ESPACES) {
    dit(new RegExp(`(^|\\n)\\[data-espace="${e}"\\]\\s*\\{\\s*--sb-aplat`).test(css), `S2 [data-espace="${e}"] pose son aplat (jour)`);
    dit(new RegExp(`:root\\[data-theme="dark"\\] \\[data-espace="${e}"\\]\\s*\\{\\s*--sb-aplat`).test(css), `S2 [data-espace="${e}"] pose son aplat (nuit)`);
  }
  const app = lire('src/App.jsx'), gardes = lire('src/ecransGardes.jsx');
  dit(/className="vrm-app-shell"[^>]*data-espace=\{espaceDe\(tab, BAR_GROUPE\)\}/.test(app) && /<main className="vrm-main"[^>]*data-espace=\{espaceDe\(tab, BAR_GROUPE\)\}/.test(app), 'S2 la coque et <main> portent data-espace');
  dit(/setAttribute\('data-espace', espaceDe\(tab\)\)/.test(gardes), 'S2 la racine de chaque écran gardé porte data-espace');

  // S3 — l'ordre de la cascade, le mouvement réduit.
  // (14 nov., version studio) Les feuilles d'ÉCRAN du studio (`./design/studio-<écran>.css`, ex. studio-paires.css)
  // se posent PAR-DESSUS la fondation : elles lisent ses jetons et peuvent la suivre. Rien d'autre ne passe après.
  const tous = [...app.matchAll(/^import\s+["']([^"']+\.css)["']/gm)].map((m) => m[1]);
  // (16 nov., intégration vague A) Les feuilles d'écran du VERRE (`verre-*.css`, `ventes-verre.css`, `fiche-d.css`, toutes
  // dans la couche `vrm-verre`) sont de la même famille : par-dessus la fondation, jamais avant ses polices.
  // (17 nov., accessibilité) `accessibilite.css` vit dans SA couche (`vrm-a11y`, nommée la première) : sa place dans les imports ne change rien.
  let fin = tous.length; while (fin > 0 && /^\.\/design\/(?:studio-(?!polices)[a-z-]+|verre-[a-z-]+|ventes-verre|fiche-d|accessibilite)\.css$/.test(tous[fin - 1])) fin--;
  const imports = tous.slice(0, fin);
  dit(imports[imports.length - 1] === './design/studio.css', 'S3 studio.css est la DERNIÈRE feuille importée par App.jsx', imports.slice(-3).join(' · '));
  dit(imports.indexOf('./design/studio-polices.css') === imports.length - 2, 'S3 ses polices juste avant lui');
  dit(imports.indexOf('./styles-tablette.css') >= 0 && imports.indexOf('./styles-tablette.css') < imports.indexOf('./design/studio.css'), 'S3 après styles-tablette.css');
  dit(/import '\.\/stylesApp\.js'/.test(app) && app.indexOf("import './stylesApp.js'") < app.indexOf('import "./design/studio.css"'), 'S3 après stylesApp.js (styles-vitrine.css)');
  const rm = css.indexOf('@media (prefers-reduced-motion: reduce)');
  dit(rm > 0 && /\.sb-onde\s*\{\s*display:\s*none/.test(css.slice(rm)) && /data-sb-eventail[^{]*\{\s*transform:\s*none/.test(css.slice(rm)), 'S3 mouvement réduit : ni ondulation, ni recul de l’écran (fondus seulement)');

  // S4 — le rouge n'est qu'au doublon.
  const usages = [...css.matchAll(/var\(--sb-doublon\)/g)].map((m) => { const avant = css.lastIndexOf('}', m.index); return css.slice(avant + 1, css.indexOf('{', avant + 1)).trim(); });
  dit(usages.length > 0 && usages.every((s) => /is-double/.test(s)), 'S4 --sb-doublon ne colore que .sb-plaque.is-double', usages.filter((s) => !/is-double/.test(s)).join(' | '));

  // S5 — les polices.
  const pol = sansCom(lire('src/design/studio-polices.css'));
  for (const f of ['inter-latin-wght-normal.woff2']) dit(fs.existsSync(path.join(RACINE, 'src/design/polices', f)) && pol.includes(`./polices/${f}`), `S5 ${f} est dans le dépôt et nommé par studio-polices.css`);
  for (const f of ['LICENCE-Inter-OFL.txt']) dit(fs.existsSync(path.join(RACINE, 'src/design/polices', f)) && /SIL Open Font License/.test(fs.readFileSync(path.join(RACINE, 'src/design/polices', f), 'utf8')), `S5 ${f} jointe (OFL)`);
  dit((pol.match(/font-display:\s*swap/g) || []).length === 1 && !/font-display:\s*(block|auto)/.test(pol), 'S5 font-display: swap sur la police (Inter seule depuis le 15 nov.)');
  dit(!/Urbanist/.test(pol) && !/urbanist-latin/.test(lire('src/design/polices.js')) && /--sb-police-affiche:\s*'Inter VRM'/.test(css), 'S5 l’affiche est en Inter (15 nov., Julien : « pro ») — plus d’Urbanist');
  dit(!/url\(\s*['"]?https?:/.test(pol + css), 'S5 aucune police ni image chargée d’ailleurs');

  // S6 — les fichiers migrés : quatre formes, ou la ligne / tuile / lame entière.
  for (const rel of MIGRES) {
    const src = lire(rel); if (!dit(!!src, `S6 ${rel} existe`)) continue;
    let ast; try { ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] }); } catch (e) { dit(false, `S6 ${rel} se lit`, e.message); continue; }
    const pile = [ast.program];
    while (pile.length) {
      const n = pile.pop(); if (!n || typeof n !== 'object') continue;
      if (n.type === 'JSXOpeningElement' && n.name && n.name.name === 'button') {
        const attrs = n.attributes || [];
        const cls = attrs.find((a) => a.name && a.name.name === 'className');
        const texte = cls ? src.slice(cls.start, cls.end) : '';
        const chiffre = attrs.some((a) => a.name && a.name.name === 'data-sb-forme');
        dit(FORMES.test(texte) || chiffre, `S6 ${rel}:${n.loc.start.line} — un <button> hors des quatre formes`, texte || '(sans className)');
      }
      for (const k of Object.keys(n)) { if (k === 'loc' || k === 'start' || k === 'end') continue; const v = n[k]; if (Array.isArray(v)) v.forEach((x) => pile.push(x)); else if (v && typeof v === 'object' && v.type) pile.push(v); }
    }
  }

  // S7 — le disque branché sur les gestes qui existent.
  dit(/chercher:\s*\(\)\s*=>\s*ouvrirRecherche\(\)/.test(app), 'S7 Chercher = la loupe (ouvrirRecherche)');
  // (15 nov., Julien : « tu scannes le code-barres d'un colis… VRM ouvre directement la bonne vente ou le bon achat »)
  // Le disque ouvre le scanner POUR RETROUVER (src/ScannerRetrouver.jsx) ; le scanner de dépôt reste le rond d'À expédier.
  dit(/scanner:\s*\(\)\s*=>\s*ouvrirRetrouver\('disque'\)/.test(app) && /window\.addEventListener\(EV_RETROUVER, o\)/.test(app) && /<ScannerRetrouver Photo=\{PhotoVinted\}/.test(app) && /<HoteRetrouver /.test(app), 'S7 Scanner = le scanner pour retrouver (vrm:retrouver ⇒ HoteRetrouver)');
  dit(/publier:[^\n]*vrm:publier-ailleurs/.test(app) && /addEventListener\('vrm:publier-ailleurs'/.test(app), 'S7 Publier = « Publier ailleurs »');
  dit(/imprimer:\s*\(\)\s*=>\s*lancerActionRecherche\(\{ id: 'imprimer-jour' \}\)/.test(app), 'S7 Imprimer = « Imprimer les bordereaux du jour » (la feuille Tout imprimer)');
  dit(/v\.lot = r\.partent/.test(app) && /colisPrets\.lot\)\?colisPrets\.lot:undefined/.test(app), 'S7 Imprimer N lit `vrm_colis_prets.lot` (le nombre de « Tout imprimer (N) »), undefined sinon');
  const de = lire('src/design/DisqueEventail.jsx');
  dit(/connu && nImprimer > 0 \? tr\('studio\.imprimerN'/.test(de) && /: tr\('studio\.imprimer'\)/.test(de), 'S7 pas su ⇒ « Imprimer » sans nombre (jamais un 0 deviné)');
  // (17 nov., Julien : « Le + dégueulasse ») Le disque a quitté la barre ; ses gestes ont chacun leur place, à un toucher.
  dit(!/<DisqueEventail\b/.test(app), 'S7 plus de disque dans la barre du bas');
  dit(/data-recherche-scanner=""[^\n]*ouvrirRetrouver\('loupe'\)/.test(app) && /<BoutonScanRecherche\/>/.test(app), 'S7 Scanner = une icône DANS le champ de recherche (le même scanner pour retrouver)');
  dit(/data-geste-disque="publier"/.test(app) && /data-v2-principal': 'publier'/.test(app), 'S7 Publier = la ligne du titre d’Annonces (éteint et allumé)');
  return rouges;
}

const MUTATIONS = [
  ['S1', 'jeton de nuit oublié', 'src/design/studio.css', (t) => t.replace(':root[data-theme="dark"] {\n  --sb-haut: #15263D;', ':root[data-theme="dark"] {\n  --sb-hautx: #15263D;')],
  ['S1', 'jeton du contrat renommé', 'src/design/studio.css', (t) => t.replace('  --sb-encre-2: #3F5468;', '  --sb-gris: #3F5468;')],
  ['S2', 'forme du contrat absente', 'src/design/studio.css', (t) => t.split('.sb-rond--disque').join('.sb-rond--grand')],
  ['S2', 'espace sans aplat', 'src/design/studio.css', (t) => t.replace('[data-espace="ventes"]  { --sb-aplat: #D2E5F4; }', '')],
  ['S3', 'studio.css avant une autre feuille', 'src/App.jsx', (t) => t.replace('import "./design/polices.js";', 'import "./design/polices.js";\nimport "./styles-tard.css";')],
  ['S3', 'mouvement réduit oublié', 'src/design/studio.css', (t) => t.replace('  .sb-onde { display: none !important; animation: none !important; }', '')],
  ['S4', 'rouge hors du doublon', 'src/design/studio.css', (t) => t.replace('.sb-lien:active, .sb-lien.is-appui { opacity: .55; }', '.sb-lien:active, .sb-lien.is-appui { opacity: .55; color: var(--sb-doublon); }')],
  ['S5', 'police bloquante', 'src/design/studio-polices.css', (t) => t.replace('font-display: swap;', 'font-display: block;')],
  ['S5', 'police chargée d’ailleurs', 'src/design/studio-polices.css', (t) => t.replace("src: url('./polices/inter-latin-wght-normal.woff2')", "src: url('https://fonts.example.test/inter.woff2')")],
  ['S6', 'un bouton hors des quatre formes', 'src/ui/Filtres.jsx', (t) => t.replace('className="vrm-ui-filtre sb-touche"', 'className="vrm-ui-filtre"')],
  ['S6', 'un bouton sans forme ajouté', 'src/ui/Feuille.jsx', (t) => t.replace('{children}', '{children}<button type="button" className="vrm-pilule">x</button>')],
  ['S7', 'Imprimer N deviné à 0', 'src/App.jsx', (t) => t.replace('colisPrets&&Number.isFinite(colisPrets.lot)?colisPrets.lot:undefined', 'colisPrets&&Number.isFinite(colisPrets.lot)?colisPrets.lot:0')],
  ['S7', 'Scanner débranché', 'src/App.jsx', (t) => t.replace("window.addEventListener(EV_RETROUVER, o);", '')],
];

if (process.argv.includes('--prouve')) {
  let ok = 0;
  for (const [r, nom, fichier, f] of MUTATIONS) {
    const avant = fs.readFileSync(path.join(RACINE, fichier), 'utf8'); const apres = f(avant);
    if (apres === avant) { console.log(`❌ mutation ${r} « ${nom} » : le motif n'existe plus`); continue; }
    const rouges = juger({ [fichier]: apres }).filter((x) => x.startsWith(r));
    if (rouges.length) { ok++; console.log(`✅ mutation ${r} « ${nom} » ⇒ rouge (${rouges[0].slice(0, 90)})`); } else console.log(`❌ mutation ${r} « ${nom} » ⇒ RESTE VERT`);
  }
  console.log(`\n${ok}/${MUTATIONS.length} mutations rougissent`);
  process.exit(ok === MUTATIONS.length ? 0 : 1);
}
const rouges = juger({});
if (rouges.length) { console.log(`❌ audit-studio : ${rouges.length} rouge(s)`); rouges.forEach((r) => console.log('  · ' + r)); process.exit(1); }
console.log(`✅ audit-studio : jetons (jour, nuit, système), ${CLASSES.length} classes du contrat, data-espace, cascade, rouge au doublon, polices, ${MIGRES.length} fichiers migrés aux quatre formes, disque branché`);
