// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE ROUGE N'EST QU'AU DOUBLON DE N° (§5, §7 ; chantier A du 5 nov.,
//  revue de cohérence 1.6 ; récit : docs/passation/2026-11-05-chantier-a.md).
//  « Deux paires présentes sous le même numéro est le seul risque irréversible :
//  c'est le seul endroit où le rouge est justifié. » Or 88 usages de `C.danger`
//  (erreurs, annulations, pertes, « banni ») étaient rouges. Désormais :
//   R1 `danger` (themeMineral.js, les DEUX thèmes) vaut l'ambre `warn` — jamais un rouge ;
//   R2 un jeton `doublon` existe, rouge, dans les deux thèmes, et la coque le pose
//      (`--vrm-doublon`, variablesTheme) ;
//   R3 `C.doublon` / `var(--vrm-doublon)` ne sert QUE là où un doublon de N° est en jeu
//      (le code autour le dit : conflitsNum, numDoublons, dbl, dv === 'num', « par deux »…) ;
//   R4 aucun `C.danger` ne reste sur un doublon de N° (il deviendrait ambre en silence) ;
//      une feuille qui colore un doublon avec `var(--vrm-danger)` est redirigée vers
//      `--vrm-doublon` par design/jetons.css (§16) ;
//   R5 aucune couleur ROUGE écrite en dur dans src/ hors d'un doublon de N°, hors des
//      couleurs de MARQUE (logos de transporteur, Google), et hors de la DETTE nommée
//      ci-dessous (fichier par fichier, plafond qui ne peut que baisser : chaque ligne dit
//      quel chantier la retire). Un nouveau rouge, où que ce soit, rougit l'audit.
//   R6 (6 nov., finitions) le bloc rouge ne s'allume que pour DEUX paires : `conflitsNum` reçoit
//      les groupes que la carte AMBRE « en ligne deux fois » affiche (même paire prouvée : photo
//      exacte ou `recreeDe`) — la carte ambre suffit, jamais le rouge ET l'ambre pour une paire ;
//      et le rouge du bloc Colis / de Ma journée vient bien de `conflitsNum` (une seule règle).
//  On juge la RÈGLE (teinte calculée), pas l'orthographe : #f00, #E5484D, rgb(229,72,77)…
//  `--mutation` rejoue les 5 règles sur des copies affaiblies : chacune DOIT rougir.
//    node scripts/audit-rouge-doublon.cjs [--mutation]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const SRC = path.join(RACINE, 'src');

// Les couleurs de MARQUE : celles des logos (Mondial Relay, Relais Colis, DPD, DHL, Google).
const MARQUES = ['#e2001a', '#e30613', '#dc0032', '#d40511', '#ea4335'];
// La DETTE : les rouges écrits en dur qui restent HORS de la zone du chantier A (fichier : plafond).
// Le plafond ne monte jamais ; un fichier qui n'est pas ici n'a droit à aucun rouge.
const DETTE = {
  'src/App.jsx': { max: 12, pourquoi: "THEMES d'origine morts (danger écrasé par themeMineral), carte des retraits (#e5484d), cellule surlignée et pulsation du Stock, « Supprimer » d'un meuble (C.red absent), teinte de meuble, caisses « vendu » de la pièce 3D — chantiers E1 (Ma journée/Colis) et H (Stock)" },
  'src/Room3D.jsx': { max: 5, pourquoi: 'décor de la pièce 3D (habits, caisses « vendu », surlignage) — chantier H' },
  'src/operations/operations.css': { max: 1, pourquoi: 'échéance en retard (Organisation) — chantier H' },
  'src/reception-emails.css': { max: 1, pourquoi: 'E-mails — chantier G' },
  'src/styles-gestion.css': { max: 1, pourquoi: "repli de var(--vrm-danger) sur un champ invalide (jamais dessiné : la variable existe) — chantier B" },
};
// Ce que le code autour dit quand un doublon de N° est en jeu.
const MARQUEUR = /conflit|\bdbl\b|numDoublons|numDbl|dv\s*===?\s*'num'|par deux|deux (paires|articles|annonces)|même numéro|tout-double|rn\.double|numeros-en-double|is-double|-double\b|data-num-etat="doublon"/i;

const hex6 = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const hsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; } return { h, s, l }; };
const estRouge = (rgb) => { const { h, s, l } = hsl(rgb); return (h >= 345 || h <= 12) && s >= 0.45 && l >= 0.25 && l <= 0.75; };
const COULEUR = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;

function fichiers(d, o = []) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) fichiers(p, o); else if (/\.(jsx?|mjs|css)$/.test(f)) o.push(p); } return o; }
// Les commentaires ne jugent rien (ni marqueur, ni rouge). En JS, seulement les commentaires
// SÛRS : `{/* … */}` de JSX, et les lignes qui commencent par `//` ou `*` — un « image/* »
// dans une chaîne ouvrirait sinon un faux commentaire qui avalerait des milliers de lignes.
const blanc = (m) => m.replace(/[^\n]/g, ' ');
const sansCommentaires = (t, css) => css ? t.replace(/\/\*[\s\S]*?\*\//g, blanc)
  : t.replace(/\{\/\*[\s\S]*?\*\/\}/g, blanc).replace(/^[ \t]*(\/\/|\/\*|\*)[^\n]*/gm, blanc).replace(/(^|[;,{}()\s])\/\/ [^\n]*/g, (m, a) => a + blanc(m.slice(a.length)));
// La fenêtre autour d'une ligne : la ligne et les 12 au-dessus (le bloc qui la contient).
const fenetre = (lignes, i, avant = 12) => lignes.slice(Math.max(0, i - avant), i + 1).join('\n');

function juger(depot) {
  const rouges = [];
  const dit = (c, m, d) => { if (!c) rouges.push(m + (d ? ' — ' + String(d).slice(0, 400) : '')); return c; };
  const lire = (rel) => depot[rel] != null ? depot[rel] : fs.readFileSync(path.join(RACINE, rel), 'utf8');

  // R1 / R2 — les jetons.
  const th = lire('src/themeMineral.js');
  for (const nomTheme of ['MINERAL', 'MINERAL_DARK']) {
    const m = new RegExp('export const ' + nomTheme + '\\s*=\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\);').exec(th);
    if (!dit(!!m, `R1 ${nomTheme} est lisible dans themeMineral.js`)) continue;
    const val = (k) => { const x = new RegExp('\\b' + k + "\\s*:\\s*'(#[0-9a-fA-F]{3,6})'").exec(m[1]); return x ? x[1] : null; };
    const danger = val('danger'), warn = val('warn'), doublon = val('doublon');
    dit(!!danger && !estRouge(hex6(danger)), `R1 ${nomTheme}.danger n'est pas un rouge`, danger);
    dit(!!danger && !!warn && danger.toLowerCase() === warn.toLowerCase(), `R1 ${nomTheme}.danger vaut l'ambre (warn)`, `${danger} / ${warn}`);
    dit(!!doublon && estRouge(hex6(doublon)), `R2 ${nomTheme}.doublon existe et est rouge`, doublon);
  }
  dit(/'--vrm-doublon'\s*:\s*t\.doublon/.test(th), 'R2 la coque pose --vrm-doublon (variablesTheme)');

  // R3 / R4 / R5 — tout src/.
  const tous = fichiers(SRC).map((p) => path.relative(RACINE, p).split(path.sep).join('/'));
  for (const rel of Object.keys(depot)) if (rel.startsWith('src/') && !tous.includes(rel)) tous.push(rel);
  const parDette = {};
  let usagesDoublon = 0;
  const jetonsCss = lire('src/design/jetons.css');
  // Les classes de doublon que jetons.css redirige (`--vrm-danger: var(--vrm-doublon)` sur elles).
  const redirige = (/([^{}]+)\{\s*--vrm-danger:\s*var\(--vrm-doublon\)/.exec(sansCommentaires(jetonsCss, true)) || [])[1] || '';
  for (const rel of tous) {
    if (rel === 'src/themeMineral.js') continue;   // les définitions des jetons
    const css = rel.endsWith('.css');
    const brut = lire(rel);
    const lignes = sansCommentaires(brut, css).split('\n');
    lignes.forEach((l, i) => {
      // R3 — le jeton rouge.
      if (/C\.doublon\b|--vrm-doublon\b/.test(l) && !(rel === 'src/design/jetons.css' && /--vrm-danger:\s*var\(--vrm-doublon\)/.test(l))) {
        usagesDoublon++;
        const f = fenetre(lignes, i).replace(/C\.doublon|--vrm-doublon/g, '');
        dit(MARQUEUR.test(f), `R3 ${rel}:${i + 1} « doublon » sert à un doublon de N°`, l.trim().slice(0, 160));
      }
      // R4 — `danger` sur un doublon : il passerait à l'ambre.
      if (/C\.danger\b/.test(l) && MARQUEUR.test(fenetre(lignes, i, 2).replace(/C\.danger/g, ''))) dit(false, `R4 ${rel}:${i + 1} un doublon de N° coloré par C.danger (⇒ C.doublon)`, l.trim().slice(0, 160));
      if (css && /var\(--vrm-danger\b/.test(l)) {
        const sel = (/^([^{]*)\{/.exec(l) || [])[1] || '';
        const classes = (sel.match(/\.[\w-]*double[\w-]*/g) || []);
        for (const c of classes) dit(redirige.includes(c), `R4 ${rel}:${i + 1} ${c} (un doublon de N°) colore par --vrm-danger : redirigé vers --vrm-doublon par jetons.css §16`, l.trim().slice(0, 140));
      }
      // R5 — les rouges écrits en dur.
      COULEUR.lastIndex = 0; let m;
      while ((m = COULEUR.exec(l))) {
        const rgb = m[1] ? hex6(m[1]) : [+m[2], +m[3], +m[4]];
        if (!estRouge(rgb)) continue;
        if (m[1] && MARQUES.includes(('#' + hex6(m[1]).map((x) => x.toString(16).padStart(2, '0')).join('')).toLowerCase())) continue;
        if (MARQUEUR.test(fenetre(lignes, i))) continue;
        parDette[rel] = parDette[rel] || []; parDette[rel].push(`${i + 1}: ${m[0]}`);
      }
    });
  }
  // R6 — une paire en ligne deux fois n'est pas « deux paires » (la carte ambre suffit).
  {
    const app = sansCommentaires(lire('src/App.jsx'), false);
    const regle = (/function conflitsDeNumeros\(porteurs, memePaires = null\) \{[\s\S]*?\n\}/.exec(app) || [''])[0];
    dit(/uniq\.every\(x => x\.type === 'annonce'\) && Array\.isArray\(memePaires\)/.test(regle) && /ids\.every\(id => g\.some\(/.test(regle), 'R6 `conflitsDeNumeros` dispense des annonces qu’un groupe de la carte ambre réunit TOUTES (jamais une partie)', regle.slice(0, 200));
    dit(/const conflitsNum = useMemo\(\(\) => conflitsDeNumeros\(porteursNum, groupesDeuxFois\)/.test(app) && /const groupesDeuxFois = useMemo\(\(\) => \(enLigneDeux && Array\.isArray\(enLigneDeux\.vinted\)/.test(app), 'R6 le bloc rouge reçoit les groupes de la carte ambre (`enLigneDeux.vinted`)');
    dit(/\{conflitsNum\.length > 0 && \(/.test(app) && /if\(conflitsNum\.length\)\{/.test(app), 'R6 le bloc rouge de Colis et la ligne de Ma journée lisent `conflitsNum` (une seule règle)');
    dit(/conflits: \(p\) => conflitsDeNumeros\(p, GROUPES_DEUX_FOIS\)/.test(app) && /useEffect\(\(\) => \{ GROUPES_DEUX_FOIS = groupesDeuxFois; \}, \[groupesDeuxFois\]\)/.test(app), 'R6 « Tout sur le N° » suit la même règle (les groupes publiés par Ma journée)');
  }
  if (process.env.DETAIL) console.log(JSON.stringify(parDette, null, 1));
  dit(usagesDoublon >= 5, `R3 le jeton doublon sert bien au doublon de N° (${usagesDoublon} usages)`);
  for (const [rel, v] of Object.entries(parDette)) {
    const d = DETTE[rel];
    dit(!!d && v.length <= d.max, `R5 ${rel} : ${v.length} rouge(s) en dur hors doublon${d ? ` (dette nommée, plafond ${d.max})` : ' — aucun permis ici'}`, v.slice(0, 6).join(' ; '));
  }
  return rouges;
}

// ── Les mutations : chaque règle affaiblie DOIT rougir ───────────────────────
function mutations() {
  const lire = (rel) => fs.readFileSync(path.join(RACINE, rel), 'utf8');
  const th = lire('src/themeMineral.js'), app = lire('src/App.jsx'), coque = lire('src/styles-coque.css'), jet = lire('src/design/jetons.css');
  const cas = [
    ['R1 danger redevient rouge', { 'src/themeMineral.js': th.replace("danger:'#B25000'", "danger:'#D70015'") }],
    ['R2 plus de jeton doublon', { 'src/themeMineral.js': th.replace(/doublon:'#[0-9A-Fa-f]+',/g, '') }],
    ['R3 le rouge sur une erreur ordinaire', { 'src/App.jsx': app.replace("{err && <div data-mfa-erreur=\"\" style={{fontSize:13,color:C.danger", "{err && <div data-mfa-erreur=\"\" style={{fontSize:13,color:C.doublon") }],
    ['R4 un doublon repasse à C.danger', { 'src/App.jsx': app.replace("color:a.dv==='num'?C.doublon:C.warn", "color:a.dv==='num'?C.danger:C.warn") }],
    ['R4 la redirection des doublons des feuilles retirée', { 'src/design/jetons.css': jet.replace(/--vrm-danger:\s*var\(--vrm-doublon\)/, '--vrm-x: 0') }],
    ['R5 un rouge en dur dans une feuille de la zone', { 'src/styles-coque.css': coque + '\n.vrm-essai { color: #E5484D; }\n' }],
    ['R6 le rouge ignore la carte ambre', { 'src/App.jsx': app.replace('conflitsDeNumeros(porteursNum, groupesDeuxFois)', 'conflitsDeNumeros(porteursNum)') }],
    ['R6 « Tout sur le N° » ignore la carte ambre', { 'src/App.jsx': app.replace('conflits: (p) => conflitsDeNumeros(p, GROUPES_DEUX_FOIS),', 'conflits: conflitsDeNumeros,') }],
    ['R6 un groupe partiel suffit', { 'src/App.jsx': app.replace('ids.every(id => g.some(', 'ids.some(id => g.some(') }],
    ['R5 un rouge en dur de plus dans App.jsx', { 'src/App.jsx': app.replace('let C = THEMES.light;', "let C = THEMES.light; const ROUGE_ESSAI = 'rgb(229, 72, 77)';") }],
  ];
  let ko = 0;
  for (const [nom, depot] of cas) {
    const change = Object.entries(depot).every(([rel, t]) => t !== lire(rel));
    const r = change ? juger(depot) : [];
    const bon = change && r.length > 0;
    if (!bon) ko++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » : ${change ? r.length + ' rouge(s)' : 'la mutation ne s’applique plus (texte introuvable)'}`);
  }
  return ko;
}

const rouges = juger({});
for (const r of rouges) console.log('❌ ' + r);
let ko = rouges.length;
if (process.argv.includes('--mutation')) ko += mutations();
console.log(ko ? `\n❌ audit-rouge-doublon : ${ko} rouge(s)` : '\n✅ audit-rouge-doublon : le rouge n’est qu’au doublon de N°' + (process.argv.includes('--mutation') ? ' (et chaque règle affaiblie rougit)' : ''));
process.exit(ko ? 1 : 0);
