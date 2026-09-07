// ═══════════════════════════════════════════════════════════════════════════
// AUDIT DES BANCS   —   node scripts/audit-bancs.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Les bancs vivaient dans le scratchpad d'une session. Une session qui perd son
// conteneur les perdait — et la suivante les réécrivait, en retombant dans les
// mêmes pièges. Ils vivent maintenant dans le dépôt.
//
// ⚠️ MAIS PAS LEURS DONNÉES. `fx/` contient les vraies ventes, les vrais
// acheteurs, les vraies adresses — et **ce dépôt est PUBLIC**. Ce fichier
// vérifie qu'aucune fixture ne s'y glisse, et que les trois leçons qui m'ont
// fait mesurer des fictions restent câblées dans les bancs.
//
// Lecture seule.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const DIR = path.join(RACINE, 'scripts/bancs');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

dit(fs.existsSync(DIR), 'les bancs vivent dans le dépôt, pas dans un scratchpad');
if (!fs.existsSync(DIR)) { console.log(`\n${ko} contrôle(s) non conforme(s).`); process.exit(1); }

const fichiers = fs.readdirSync(DIR);
const bancs = fichiers.filter(f => f.endsWith('.cjs'));
dit(bancs.length >= 9, 'les bancs permanents sont là', bancs.length + ' bancs');
dit(fichiers.includes('README.md'), 'et ils disent comment les lancer');

// ── AUCUNE DONNÉE. Le dépôt est public. ────────────────────────────────────
const donnees = fichiers.filter(f => /\.json$/i.test(f)) ;
dit(donnees.length === 0, 'aucune fixture n\'est commitée (dépôt PUBLIC)',
  donnees.length ? donnees.join(', ') : '');
dit(!fichiers.includes('fx'), 'et pas de dossier `fx/` non plus');

// ── LES TROIS LEÇONS, CÂBLÉES ──────────────────────────────────────────────
const rendus = ['verif_visuel.cjs', 'verif_dark.cjs'].filter(f => fichiers.includes(f));
dit(rendus.length === 2, 'les deux bancs de rendu sont là (clair et sombre)');
for (const f of rendus) {
  const S = fs.readFileSync(path.join(DIR, f), 'utf8');
  // 1. la projection `select=` — sans elle le banc mesure une fiction
  dit(/function projette/.test(S), `${f} applique la projection \`select=\``,
    'sans elle, tous les bordereaux tombent et l\'écran ment');
  // 2. le garde-fou d'écran passait tous les contrôles
  dit(/n'a pas pu s'afficher/.test(S), `${f} voit un écran tombé sur le garde-fou`,
    'un écran mort est un vrai texte, sans erreur : il passait « conforme »');
  // 3. et il regarde les deux tailles
  dit(/390/.test(S) && /1512/.test(S), `${f} rend à 390 ET 1512 px`);
}

// ⚠️ Playwright prend la DERNIÈRE route enregistrée en premier : un fourre-tout
// posé après une route précise l'avale.
const carte = fichiers.includes('carte.cjs') ? fs.readFileSync(path.join(DIR, 'carte.cjs'), 'utf8') : '';
if (carte) {
  const gen = carte.indexOf("route('**/api/**'");
  const spe = carte.indexOf("route('**/api/relais**'");
  dit(gen > 0 && spe > gen, 'carte.cjs pose le fourre-tout AVANT la route précise',
    'sinon `**/api/**` avale /api/relais et la carte reste vide sans erreur');
}

console.log(ko
  ? `\n${ko} contrôle(s) non conforme(s).`
  : '\nLes bancs survivent à la session, et sans emporter ses données.');
process.exit(ko ? 1 : 0);
