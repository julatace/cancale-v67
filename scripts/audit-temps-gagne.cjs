// ════════════════════════════════════════════════════════════════════════════
// AUDIT DU CALCULATEUR « LE TEMPS QUE VRM TE FAIT GAGNER » (11 nov., lot
// temps-gagne). Lecture seule. §2.3 : une ESTIMATION à partir des chiffres du
// visiteur, jamais un résultat de client.
//
//  J. chaque durée de référence est justifiée : `nature` raisonnée|mesurée,
//     `pourquoi` qui nomme le geste à la main ET avec VRM, `sans` > `avec` ≥ 0 ;
//     une durée « mesurée » dit quand (une date).
//  R. la règle : total = somme des gestes ; 0 vente/achat/baisse, 1 compte ⇒ 0 ;
//     plus de chiffres ⇒ jamais moins de temps ; bornes tenues ; le premier compte
//     n'est pas compté ; arrondis (5 min la semaine, 15 min le mois).
//  H. honnêteté du texte (5 langues) : la note dit « estimation » et « pas des
//     résultats de clients » ; aucun témoignage, aucune moyenne d'utilisateurs,
//     aucun « le seul » ; chaque clé dynamique (champ, geste, par) existe.
//  P. la page : le calculateur est un morceau À PART (React.lazy), jamais importé
//     en dur par Accueil.jsx (budget du fichier d'entrée).
//
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = process.env.TG_RACINE || path.join(__dirname, '..');
const LANGUES = ['fr', 'en', 'es', 'it', 'de'];
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : ''}`); };
const lire = (p) => fs.readFileSync(path.join(R, p), 'utf8');
const imp = async (p) => import(pathToFileURL(path.join(R, p)).href + '?v=' + Math.random());

async function principal() {
  const M = await imp('src/accueil/tempsGagne.js');
  const { GESTES, CHAMPS, tempsGagne, valeursDepart, arrondiSemaine, arrondiMois } = M;

  console.log('── J. chaque durée est justifiée');
  for (const g of GESTES) {
    dit(['raisonnée', 'mesurée'].includes(g.nature), `J ${g.id} : nature raisonnée ou mesurée`, g.nature);
    dit(typeof g.pourquoi === 'string' && /à la main/i.test(g.pourquoi) && /avec vrm/i.test(g.pourquoi) && g.pourquoi.length > 60, `J ${g.id} : « pourquoi » décrit le geste à la main ET avec VRM`);
    dit(Number.isFinite(g.sans) && Number.isFinite(g.avec) && g.sans > g.avec && g.avec >= 0, `J ${g.id} : sans (${g.sans} s) > avec (${g.avec} s) ≥ 0`);
    if (g.nature === 'mesurée') dit(/\b20\d\d-\d\d-\d\d\b|\d{1,2} (janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)/.test(g.pourquoi), `J ${g.id} : une durée mesurée dit quand`);
  }
  dit(GESTES.length >= 5, `J au moins cinq gestes (${GESTES.length})`);

  console.log('── R. la règle');
  const somme = (r) => r.gestes.reduce((s, g) => s + g.secondes, 0);
  const d = valeursDepart();
  const r0 = tempsGagne(d);
  dit(r0.secondes === somme(r0) && r0.secondes > 0, `R le total est la somme des gestes (${r0.secondes} s)`);
  // Un cas calculé à la main : 10 ventes, 3 achats, 2 comptes, 2 plateformes, 5 baisses.
  const attendu = 10 * (120 - 20) + 10 * (60 - 10) + 10 * 30 + 13 * (60 - 10) + 1 * 300 + 3 * (90 - 15) + 5 * (60 - 10);
  const main = tempsGagne({ ventes: 10, achats: 3, comptes: 2, plateformes: 2, baisses: 5 });
  dit(main.secondes === GESTES.reduce((s, g) => s + main.gestes.find((x) => x.id === g.id).n * (g.sans - g.avec), 0), 'R chaque geste = unités × (à la main − avec VRM)');
  dit(main.secondes === attendu || GESTES.some((g) => ({ bordereaux: [120, 20], numeros: [60, 10], urssaf: [30, 0], suivi: [60, 10], sites: [300, 0], codes: [90, 15], prix: [60, 10] }[g.id] || []).join() !== [g.sans, g.avec].join()), `R le cas calculé à la main tombe juste (${main.secondes} s ; attendu ${attendu} s)`);
  dit(tempsGagne({ ventes: 0, achats: 0, comptes: 1, plateformes: 1, baisses: 0 }).secondes === 0, 'R aucun chiffre ⇒ aucun temps gagné');
  dit(tempsGagne({ ...d, comptes: 1, plateformes: 1 }).gestes.find((g) => g.id === 'sites').secondes === 0, 'R un seul compte : le tour des sites ne compte rien');
  let mono = true;
  for (const c of CHAMPS) {
    const a = tempsGagne({ ...d, [c.id]: c.min }).secondes, b = tempsGagne({ ...d, [c.id]: c.max }).secondes;
    if (b < a) mono = false;
  }
  dit(mono, 'R plus de chiffres ⇒ jamais moins de temps');
  const borne = tempsGagne({ ventes: 1e6, achats: -5, comptes: 'x', plateformes: 99, baisses: NaN });
  const max = tempsGagne(Object.fromEntries(CHAMPS.map((c) => [c.id, c.max])));
  dit(borne.secondes <= max.secondes && borne.secondes >= 0, 'R des chiffres hors bornes restent dans les bornes');
  dit(tempsGagne({ ...d, comptes: 1, plateformes: 3 }).gestes.find((g) => g.id === 'sites').n === 2, 'R au moins un compte par plateforme');
  dit(arrondiSemaine(56 * 60) === 55 && arrondiSemaine(3 * 60) === 3 && arrondiMois(55 * 60) === 240, 'R arrondis : 56 min ⇒ 55 ; 3 min ⇒ 3 ; 55 min/sem ⇒ 4 h/mois');

  console.log('── H. honnêteté du texte');
  const champsIds = CHAMPS.map((c) => c.id), gestesIds = GESTES.map((g) => g.id), pars = [...new Set(GESTES.map((g) => g.par))];
  const INTERDIT = /\b(le seul|la seule|the only|el único|la única|l’unico|il solo|der einzige|die einzige|das einzige|témoign|testimon|nos clients|our customers|nuestros clientes|i nostri clienti|unsere kunden|utilisateurs gagnent|users save|en moyenne|on average|★)/i;
  for (const l of LANGUES) {
    const dico = (await imp(`src/i18n/langues/${l}-accueil.js`)).default;
    const t = Object.entries(dico).filter(([k]) => k.startsWith('accueil.temps.'));
    const manque = [...champsIds.map((x) => `champ.${x}`), ...gestesIds.map((x) => `geste.${x}`), ...pars.map((x) => `par.${x}`), 'titre', 'chapo', 'note', 'ref', 'parSemaine']
      .map((k) => 'accueil.temps.' + k).filter((k) => !(k in dico));
    dit(!manque.length, `H ${l} : chaque clé du calculateur existe`, manque);
    const mauvais = t.filter(([, v]) => INTERDIT.test(String(v)));
    dit(!mauvais.length, `H ${l} : aucun « le seul », témoignage ni résultat de clients`, mauvais.map(([k]) => k));
  }
  const fr = (await imp('src/i18n/langues/fr-accueil.js')).default;
  dit(/estimation/i.test(fr['accueil.temps.note'] || '') && /pas des résultats de clients/i.test(fr['accueil.temps.note'] || ''), 'H la note dit « Estimation » et « pas des résultats de clients »');
  const comp = lire('src/accueil/TempsGagne.jsx');
  dit(/tr\('accueil\.temps\.note'\)/.test(comp) && /data-estimation/.test(comp), 'H la note est affichée sous le résultat');

  console.log('── P. la page');
  const acc = lire('src/Accueil.jsx').replace(/\/\/.*$/gm, '');
  dit(/React\.lazy\(\(\) => import\('\.\/accueil\/TempsGagne\.jsx'\)\)/.test(acc), 'P le calculateur est chargé à la demande (React.lazy)');
  dit(!/^\s*import[^;]*TempsGagne/m.test(acc) && !/^\s*import[^;]*accueil\/tempsGagne/m.test(acc), 'P Accueil.jsx ne l’importe jamais en dur');
  dit(/id="temps"/.test(acc) && /<TempsGagne \/>/.test(acc), 'P la section #temps rend le calculateur');
}

function prouve() {
  const muts = [
    ['src/accueil/tempsGagne.js', "nature: 'raisonnée',\n    pourquoi: \"À la main : ouvrir la vente", "nature: 'devinée',\n    pourquoi: \"À la main : ouvrir la vente"],
    ['src/accueil/tempsGagne.js', 'sans: 120, avec: 20', 'sans: 20, avec: 120'],
    ['src/accueil/tempsGagne.js', 'site: sites - 1', 'site: sites'],
    ['src/accueil/tempsGagne.js', 'secondes: n * (g.sans - g.avec)', 'secondes: n * g.sans'],
    ['src/i18n/langues/fr-accueil.js', 'pas des résultats de clients', 'comme nos clients'],
    ['src/i18n/langues/en-accueil.js', '"The time VRM saves you"', '"The only tool that saves you time"'],
    ['src/i18n/langues/de-accueil.js', '"accueil.temps.geste.codes"', '"accueil.temps.geste.codez"'],
    ['src/Accueil.jsx', "const TempsGagne = React.lazy(() => import('./accueil/TempsGagne.jsx'));", "import TempsGagne from './accueil/TempsGagne.jsx';"],
  ];
  let rouges = 0;
  for (const [f, a, b] of muts) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-'));
    for (const d of ['src/accueil', 'src/i18n/langues']) { fs.mkdirSync(path.join(tmp, d), { recursive: true }); for (const x of fs.readdirSync(path.join(R, d))) fs.copyFileSync(path.join(R, d, x), path.join(tmp, d, x)); }
    fs.copyFileSync(path.join(R, 'src/Accueil.jsx'), path.join(tmp, 'src/Accueil.jsx'));
    fs.copyFileSync(path.join(R, 'package.json'), path.join(tmp, 'package.json'));
    const s = fs.readFileSync(path.join(tmp, f), 'utf8');
    if (!s.includes(a)) { console.log(`⚠️ mutation introuvable : ${f} ${a.slice(0, 40)}`); ko++; continue; }
    fs.writeFileSync(path.join(tmp, f), s.replace(a, b));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, TG_RACINE: tmp }, encoding: 'utf8' });
    const rouge = r.status !== 0;
    console.log(`${rouge ? '✅' : '❌'} mutation ${f} « ${a.slice(0, 50)} » ⇒ ${rouge ? 'rouge' : 'VERT (le contrôle ne voit rien)'}`);
    if (rouge) rouges++; else ko++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${rouges}/${muts.length} mutations rougissent l'audit`);
}

if (process.argv.includes('--prouve')) { principal().then(() => { if (ko) { console.log('l’audit doit être vert avant --prouve'); process.exit(1); } ok = 0; prouve(); process.exit(ko ? 1 : 0); }); }
else principal().then(() => { console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(ko ? 1 : 0); }).catch((e) => { console.error(e); process.exit(1); });
