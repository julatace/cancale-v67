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
dit(bancs.length >= 10, 'les bancs permanents sont là', bancs.length + ' bancs');
dit(fichiers.includes('README.md'), 'et ils disent comment les lancer');

// ── AUCUNE DONNÉE. Le dépôt est public. ────────────────────────────────────
const donnees = fichiers.filter(f => /\.json$/i.test(f)) ;
dit(donnees.length === 0, 'aucune fixture n\'est commitée (dépôt PUBLIC)',
  donnees.length ? donnees.join(', ') : '');
// ⚠️ `fx` DOIT pouvoir exister sur le disque : sans lui aucun banc ne tourne
// (on le remplit avec `copie-fixtures.mjs`, souvent par un LIEN vers le
// scratchpad). Ce qui est interdit, c'est qu'il puisse ENTRER dans le dépôt.
// Le contrôle porte donc sur git, pas sur le disque — et c'est ce qui manquait :
// la ligne `scripts/bancs/fx/` du .gitignore exige un DOSSIER (barre finale),
// donc un lien symbolique du même nom ressortait en « untracked », prêt à être
// commité, sur un dépôt PUBLIC.
const git = (c) => { try { return require('child_process').execSync(c, { cwd: RACINE, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (_) { return ''; } };
const suivis = git('git ls-files scripts/bancs/fx').trim();
dit(suivis === '', "rien sous `fx` n'est suivi par git (dépôt PUBLIC)", suivis.split('\n').slice(0, 3).join(', '));
dit(!fichiers.includes('fx') || git('git check-ignore scripts/bancs/fx').trim() !== '',
  "et si `fx` est là (dossier ou lien), git l'ignore");

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

// ── LES BANCS RENDENT-ILS TOUS LES ÉCRANS ? ────────────────────────────────
// Mesuré le 7 septembre : les deux bancs de rendu couvraient **10 écrans sur
// 13**. `vintedaccounts` — « Comptes liés », l'écran des neuf comptes — n'était
// rendu nulle part, et c'est justement là qu'un bouton « ↻ Actualiser » posait
// sa propre ligne de titre au lieu du slot `right` de `ScreenHead` : il
// atterrissait sous l'île d'actions, donc INVISIBLE. Le contrôle existait
// depuis des semaines ; l'écran n'y passait jamais.
// ⚠️ « TOUS LES ÉCRANS » VEUT DIRE CEUX QU'IL PEUT OUVRIR. Exiger le rendu
// d'un écran monté mais INJOIGNABLE ferait tester un chemin mort — et rendrait
// l'audit faux le jour où il en reste un. Un écran est joignable s'il est dans
// le rail (`BOTTOM_TABS`/`PLUS_TABS`) ou si un `setTab('…')` y mène.
// Mesuré le 7 septembre : `comptabilite` et `inventory` sont montés mais
// n'ont AUCUN appelant — deux culs-de-sac, comme le tiroir `Nav` retiré le
// même jour. Ils ne sont donc pas exigés ici ; les dix autres, si.
{
  const APP = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');
  const montes  = new Set([...APP.matchAll(/tab===\'([a-z_]+)\'\s*&&/g)].map(m => m[1]));
  const auRail  = new Set([...APP.matchAll(/id:'([a-z_]+)',\s*icon:/g)].map(m => m[1]));
  const appeles = new Set([...APP.matchAll(/setTab\('([a-z_]+)'\)/g)].map(m => m[1]));
  const joignables = [...montes].filter(t => auRail.has(t) || appeles.has(t));
  const culsDeSac  = [...montes].filter(t => !auRail.has(t) && !appeles.has(t));
  if (culsDeSac.length) console.log(`--  (${culsDeSac.length} écran(s) monté(s) mais injoignable(s) : ${culsDeSac.join(', ')})`);
  // ⚠️⚠️ ET IL FAUT QUE L'APP ACCEPTE `?tab=` — sinon le banc mesure l'ACCUEIL.
  // Mesuré le 8 septembre : `TABS_OK` (la liste blanche de `goto`) oubliait
  // `leboncoin` et `journee`. Un onglet absent ne lève AUCUNE erreur : `goto`
  // l'ignore et l'app reste sur Ma journée. Le banc annonçait donc « leboncoin
  // rendu » en mesurant « Bonjour Julien » — un faux vert dans la couverture
  // que je venais d'élargir. Un lien vers Leboncoin n'y menait pas non plus.
  {
    const m = /const TABS_OK=\[([^\]]*)\]/.exec(APP);
    const acceptes = new Set(m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map(x => x[1]) : []);
    const refuses = joignables.filter(t => !acceptes.has(t));
    dit(refuses.length === 0,
      `l'app accepte \`?tab=\` pour les ${joignables.length} écrans joignables`,
      refuses.length ? 'ignoré(s) en silence → retombe sur Ma journée : ' + refuses.join(', ') : `${acceptes.size} onglets acceptés`);
  }
  for (const banc of ['verif_visuel.cjs', 'verif_dark.cjs']) {
    const src = fs.readFileSync(path.join(DIR, banc), 'utf8');
    const m = /const TABS=\[([^\]]*)\]/.exec(src);
    const rendus = new Set(m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map(x => x[1]) : []);
    const oublies = joignables.filter(t => !rendus.has(t));
    dit(oublies.length === 0, `${banc} rend les ${joignables.length} écrans qu'il peut ouvrir`,
      oublies.length ? 'jamais rendu(s) : ' + oublies.join(', ') : `${rendus.size} onglets servis`);
  }
}

// ⚠️⚠️ UN BANC QUI SERT UN CHEMIN ABSOLU NE PEUT PAS ÉCHOUER.
// La méthode de preuve du dossier (§6.1) extrait le code d'AVANT dans /tmp/avN,
// y copie le banc et le lance DEPUIS cet arbre — précisément pour que
// `__dirname/..` ne relise pas le dépôt courant. Les quatorze bancs de rendu
// écrivaient pourtant `const DIST='/home/user/cancale-v67/dist'` : lancés depuis
// /tmp/avN ils servaient le build COURANT, donc le CORRECTIF, et sortaient VERT
// sur le code qu'ils devaient condamner. Mesuré le 12 septembre : `panne.cjs`
// annonçait 118 contrôles verts sur un arbre dont l'App.jsx ne contenait même
// pas le mot « Restart ». C'est exactement le défaut d'`audit-coherence.cjs`
// (il imprimait des ❌ et sortait en 0) : un contrôle qui ne peut pas échouer
// est pire qu'absent — il rassure.
// La règle porte sur la RÈGLE, pas sur l'orthographe : est fautif tout chemin
// servi au navigateur qui commence par « / » sans passer par __dirname.
{
  const bancs = fs.readdirSync(DIR).filter(f => f.endsWith('.cjs'));
  const fautifs = [];
  for (const f of bancs) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8')
      .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    const m = /const\s+DIST\s*=\s*([^,;]+)/.exec(src);
    if (!m) continue;                          // ce banc ne sert pas de dist
    const expr = m[1];
    if (/^['"`]\//.test(expr.trim())) fautifs.push(f + ' → ' + expr.trim());
  }
  dit(fautifs.length === 0,
    'aucun banc ne sert un dist en chemin ABSOLU',
    fautifs.length
      ? 'lancé depuis /tmp/avN il servirait le build courant, donc le correctif → vert sur le code d\'avant : ' + fautifs.join(' · ')
      : `${bancs.length} bancs, dist déduit de leur emplacement`);
}

console.log(ko
  ? `\n${ko} contrôle(s) non conforme(s).`
  : '\nLes bancs survivent à la session, et sans emporter ses données.');
process.exit(ko ? 1 : 0);
