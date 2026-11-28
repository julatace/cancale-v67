// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « SECTIONS DIFFÉRÉES » (27 nov., budget-vitesse) — la garde de scripts/_sections-differees.cjs.
//  Au build, les sections de `Comptabilite` (Ventes, Achats, Annonces, Messages, fenêtres…) deviennent des
//  morceaux à la demande ; le dépôt ne change pas. On vérifie, sur le Comptabilite.jsx d'aujourd'hui :
//    A. chaque section nommée est trouvée et découpée (aucun refus) ;
//    B. le fichier livré et chaque morceau se lisent (Babel) ;
//    C. un morceau ne lit AUCUN nom qui n'y soit déclaré, importé ou global — un global y est un global du
//       source aussi (jamais une variable de Comptabilite perdue en route) ;
//    D. chaque nom passé par valeur (`__vrmS`) est lu par la section et existe dans Comptabilite ;
//    E. les refus marchent (MUTATIONS, chacune doit refuser la section) : un crochet appelé dans la section,
//       une variable du rendu réaffectée dans un rappel, une variable réaffectée au rendu APRÈS la section ;
//    F. le fichier livré ne porte plus le JSX des sections (une phrase propre à chacune) et Aujourd'hui le
//       demande toujours (sa section porte `ouverture: 'journee'`).
//  Lancer : node scripts/audit-sections-differees.cjs
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const S = require('./_sections-differees.cjs');
const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
const traverse = require(path.join(R, 'node_modules', '@babel', 'traverse')).default;
const F = path.join(R, 'src', 'ecrans', 'Comptabilite.jsx');
const src = fs.readFileSync(F, 'utf8');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (t) => parser.parse(t, { sourceType: 'module', plugins: ['jsx'] });

const r = S.decouper(R, F, src);
// A
dit(r.refus.length === 0, 'A. chaque section nommée est découpée', r.refus.map((x) => `${x.nom} : ${x.raison}`).join(' | ').slice(0, 400));
const noms = new Set(r.faites.map((x) => x.nom.replace(/\d+$/, '')));
dit(S.SECTIONS.every((s) => noms.has(s.nom)), 'A. les ' + S.SECTIONS.length + ' sections du tableau sont toutes là', [...noms].join(', '));
// B
let astLivre = null;
try { astLivre = lire(r.code); dit(true, 'B. le Comptabilite livré se lit'); } catch (e) { dit(false, 'B. le Comptabilite livré se lit', e.message); }
const asts = {};
for (const [f, c] of Object.entries(r.morceaux)) { try { asts[f] = lire(c); } catch (e) { dit(false, `B. le morceau ${f} se lit`, e.message); } }
dit(Object.keys(asts).length === Object.keys(r.morceaux).length, `B. les ${Object.keys(r.morceaux).length} morceaux se lisent`);
// C : les noms non liés d'un morceau sont des globaux du source
const globauxSource = new Set();
traverse(lire(src), { 'Identifier|JSXIdentifier'(p) { if (p.isReferencedIdentifier() && !p.scope.getBinding(p.node.name)) globauxSource.add(p.node.name); } });
for (const [f, ast] of Object.entries(asts)) {
  const libres = new Set();
  traverse(ast, { 'Identifier|JSXIdentifier'(p) { if (p.isReferencedIdentifier() && !p.scope.getBinding(p.node.name)) libres.add(p.node.name); } });
  const perdus = [...libres].filter((n) => !globauxSource.has(n));
  dit(!perdus.length, `C. ${f} : chaque nom lu y est déclaré, importé ou global`, perdus.slice(0, 12).join(', '));
}
// D : les valeurs passées existent dans Comptabilite et sont lues par la section
if (astLivre) {
  const passes = [];
  traverse(astLivre, { JSXAttribute(p) { if (p.node.name.name === '__vrmS' && p.node.value && p.node.value.expression && p.node.value.expression.type === 'ObjectExpression') { const el = p.parentPath.node.name.name; passes.push([el, p.node.value.expression.properties.map((x) => x.key.name), p.scope]); } } });
  dit(passes.length === r.faites.length, 'D. une section posée par section découpée', `${passes.length} / ${r.faites.length}`);
  const sansLiaison = passes.flatMap(([el, ns, sc]) => ns.filter((n) => !sc.getBinding(n)).map((n) => el + '.' + n));
  dit(!sansLiaison.length, 'D. chaque valeur passée est une variable de Comptabilite', sansLiaison.slice(0, 10).join(', '));
}
// E : mutations
const muter = (nom, paires, attendu) => {
  let t = src;
  for (const [avant, apres] of paires) { if (!t.includes(avant)) { dit(false, `E. mutation « ${nom} » : texte d'ancrage présent`, avant.slice(0, 80)); return; } t = t.replace(avant, apres); }
  const m = S.decouper(R, F, t);
  if (attendu.accepte) { const r2 = m.refus.find((x) => x.nom === attendu.section); dit(!r2 && m.faites.some((x) => x.nom === attendu.section), `E. témoin « ${nom} » : la section ${attendu.section} reste découpée`, r2 ? r2.raison.slice(0, 120) : ''); return; }
  const refusee = m.refus.find((x) => x.nom.replace(/\d+$/, '') === attendu.section && attendu.motif.test(x.raison));
  dit(!!refusee, `E. mutation « ${nom} » : la section ${attendu.section} est refusée`, refusee ? refusee.raison.slice(0, 120) : 'acceptée — ' + JSON.stringify(m.refus).slice(0, 200));
};
const DECL = "  const natifVentes = VENTES_NATIF && colisDans === 'ventes' && ongletColis !== 'toutes';";
const LET = DECL.replace('const natifVentes', 'let natifVentes');
const LIT = ['onClick={exportReportCsv}', 'onClick={natifVentes ? exportReportCsv : exportReportCsv}'];   // la section Rapport lit `natifVentes`
muter('crochet', [["{showReport && (", "{showReport && (useMemo(() => null, []) || "]], { section: 'Rapport', motif: /crochet/ });
muter('rappel qui réaffecte', [[DECL, LET + " setTimeout(() => { natifVentes = false; }, 0);"], LIT], { section: 'Rapport', motif: /rappel/ });
muter('réaffectée au rendu après', [[DECL, LET], LIT, ["{curSub!=='messages' && rendreConversation()}", "{(natifVentes = !natifVentes) && null}{curSub!=='messages' && rendreConversation()}"]], { section: 'Rapport', motif: /après la section/ });
muter('ref écrite dans la section, relue après', [['onClick={exportReportCsv}', 'onClick={(vvHorsLotRef.current = [], exportReportCsv)}'], ["{curSub!=='messages' && rendreConversation()}", "{vvHorsLotRef.current.length ? null : null}{curSub!=='messages' && rendreConversation()}"]], { section: 'Rapport', motif: /relu après/ });
muter('témoin (réaffectée AVANT, au rendu)', [[DECL, LET + " if (curSub === 'x') natifVentes = false;"], LIT], { section: 'Rapport', accepte: true });
// F
const PHRASES = { Rapport: /data-rapport-csv/, Annonces: /annSort==='selection'/ };
for (const [n, re] of Object.entries(PHRASES)) dit(re.test(src) && !re.test(r.code.replace(/\/\*[\s\S]*?\*\//g, '')), `F. le JSX de « ${n} » a quitté le Comptabilite livré`);
const j = r.faites.find((x) => x.nom === 'Journee');
dit(!!(j && j.ouverture === 'journee'), "F. la section d'Aujourd'hui est préchargée à l'ouverture d'Aujourd'hui", j ? j.ouverture : 'absente');
// G : les anciens noms d'onglets que public/demarrage-app.js ramène à Ventes / Achats sont bien ceux de l'app
{
  const dem = fs.readFileSync(path.join(R, 'public', 'demarrage-app.js'), 'utf8');
  const app = require('./_source-app.cjs').sourceAppCode(R);
  const alias = /var ALIAS = \{([^}]*)\}/.exec(dem);
  const paires = alias ? [...alias[1].matchAll(/(\w+): '(\w+)'/g)].map((m) => [m[1], m[2]]) : [];
  const faux = paires.filter(([a, e]) => !new RegExp(`\\b${a}: \\['${e}', null\\]`).test(app));
  dit(paires.length >= 5 && !faux.length, 'G. les anciens noms ramenés à Ventes / Achats au démarrage sont ceux de l’app', faux.map((x) => x.join('→')).join(', ') || paires.length + ' noms');
}
console.log(`\n${ko ? '❌' : '✅'} audit-sections-differees : ${ok} vert(s), ${ko} rouge(s)`);
process.exit(ko ? 1 : 0);
