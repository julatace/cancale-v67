// ════════════════════════════════════════════════════════════════════════════
// AUDIT : L'OBJECTIF DU MOIS — CE QUI RESTE, EN € ET EN VENTES MOYENNES
//         node scripts/audit-objectif-reste.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// (23 nov., lot objectif-mois) Julien : « Aujourd'hui montre la progression et ce
// qu'il reste (en € et en ventes moyennes), d'après le bénéfice réel avec sa
// couverture — jamais un chiffre inventé ». Cet audit EXÉCUTE src/objectifMois.js
// (`resteEnVentes`) sur des mois INVENTÉS (le dépôt est public) :
//   R  le reste en ventes = ⌈reste ÷ moyenne⌉, la moyenne du MOIS sur les ventes
//      qui portent le chiffre : `nCout` (prix d'achat connu) pour le bénéfice,
//      toutes les ventes lues pour le vendu ; moins de 3 ⇒ pas de moyenne (null) ;
//      un « au moins » ou des prix manquants ⇒ « au plus » ; les ventes sans prix
//      d'achat comptées (`sansPrix`) ; atteint ⇒ 0 ; pas su ⇒ null ; un objectif en
//      ventes n'a pas de « ventes moyennes ».
//   B  le branchement : la case « Bénéfice brut » publie `nCout` ; Aujourd'hui passe
//      `nCout` (pas `n`) pour le bénéfice, le nombre de ventes LU EN ENTIER pour le
//      vendu ; la ligne est rendue par tr() (5 langues) avec ses data-* ; la feuille
//      laisse CHOISIR Vendu ou Bénéfice et enregistre ce type.
// `--prouve` : chaque mutation de la règle doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const charger = async (texte) => {
  const tmp = path.join(R, 'src', `.audit-or-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, texte);
  try { return await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
};
// Le 10 novembre à midi : 21 jours restent (aujourd'hui compris).
const T = new Date(2026, 10, 10, 12).getTime();

async function verifier(OBJ, SRC) {
  let ko = 0;
  const dit = (c, m) => { if (!c) { ko++; if (!PROUVE) console.log('  ❌ ' + m); } else if (process.env.BAVARD) console.log('  ✅ ' + m); };
  let M;
  try { M = await charger(OBJ); } catch (e) { dit(false, 'src/objectifMois.js ne se charge pas : ' + e.message); return ko; }
  const f = M.resteEnVentes;
  dit(typeof f === 'function', 'R0 resteEnVentes existe');
  if (typeof f !== 'function') return ko;
  const prog = (type, objectif, valeur, partiel = false) => M.progressionObjectif({ type, valeur: objectif, cache: {} }, { valeur, partiel });
  // R1 bénéfice : 400 € sur 5 ventes au prix connu (80 €/vente), objectif 1 000 € ⇒ reste 600 € ⇒ 8 ventes (7,5 arrondi VERS LE HAUT).
  let r = f(prog('benefice', 1000, 400), { n: 5, nCout: 5 }, T);
  dit(r && r.ventes === 8 && r.moyenne === 80 && r.auPlus === false && r.sansPrix === 0, 'R1 bénéfice : ⌈600 ÷ 80⌉ = 8 ventes, ni « au plus » ni prix manquant — ' + JSON.stringify(r));
  // R2 la moyenne du bénéfice ne compte QUE les ventes au prix connu : 8 finalisées, 5 au prix connu ⇒ moyenne 80 (pas 50), 3 nommées, « au plus ».
  r = f(prog('benefice', 1000, 400, true), { n: 8, nCout: 5 }, T);
  dit(r && r.moyenne === 80 && r.ventes === 8 && r.sansPrix === 3 && r.auPlus === true, 'R2 bénéfice : moyenne sur nCout (80 €), 3 ventes sans prix NOMMÉES, « au plus » — ' + JSON.stringify(r));
  // R3 moins de 3 ventes au prix connu ⇒ AUCUNE moyenne (jamais une moyenne sur deux ventes).
  r = f(prog('benefice', 1000, 400), { n: 2, nCout: 2 }, T);
  dit(r && r.ventes === null && r.moyenne === null, 'R3 bénéfice sur 2 ventes : pas de moyenne — ' + JSON.stringify(r));
  // R4 vendu : 1 240 € sur 10 ventes, objectif 2 000 € ⇒ reste 760 € ⇒ ⌈6,13⌉ = 7 ventes.
  r = f(prog('ca', 2000, 1240), { n: 10 }, T);
  dit(r && r.ventes === 7 && r.moyenne === 124, 'R4 vendu : ⌈760 ÷ 124⌉ = 7 ventes — ' + JSON.stringify(r));
  // R5 vendu sans nombre de ventes lu en entier ⇒ pas de moyenne.
  r = f(prog('ca', 2000, 1240), { n: null }, T);
  dit(r && r.ventes === null, 'R5 vendu, nombre de ventes pas lu : pas de moyenne — ' + JSON.stringify(r));
  // R6 un « au moins » (un site pas lu) ⇒ « au plus ».
  r = f(prog('ca', 2000, 1240, true), { n: 10 }, T);
  dit(r && r.ventes === 7 && r.auPlus === true, 'R6 vendu « au moins » ⇒ « au plus 7 » — ' + JSON.stringify(r));
  // R7 atteint ⇒ 0, pas su ⇒ null, objectif en ventes ⇒ null.
  r = f(prog('benefice', 300, 400), { n: 5, nCout: 5 }, T);
  dit(r && r.atteint === true && r.ventes === 0, 'R7 atteint ⇒ 0 vente');
  dit(f(prog('benefice', 1000, null), { n: 5, nCout: 5 }, T) === null, 'R8 bénéfice pas su ⇒ null (jamais un reste inventé)');
  dit(f(M.progressionObjectif({ type: 'ventes', valeur: 40, cache: {} }, { valeur: 12 }), { n: 12 }, T) === null, 'R9 objectif en ventes ⇒ pas de « ventes moyennes »');
  // R10 bénéfice négatif ou nul ⇒ pas de moyenne.
  r = f(prog('benefice', 1000, 0), { n: 5, nCout: 5 }, T);
  dit(r && r.ventes === null, 'R10 bénéfice nul ⇒ pas de moyenne — ' + JSON.stringify(r));
  // ── B : le branchement ────────────────────────────────────────────────────
  const carte = sansCommentaires(SRC.carte), branche = sansCommentaires(SRC.branche), auj = sansCommentaires(SRC.auj);
  dit(/n: R\.n, nCout: CB\.nCout \}/.test(carte), 'B1 la case « Bénéfice brut » publie nCout');
  dit(/type === 'benefice' \? \{ n: N\.n, nCout: N\.nCout \}/.test(branche), 'B2 Aujourd’hui passe nCout pour le bénéfice');
  dit(/valeurSel\('ventes', 'mois', SEL_TOUT\)/.test(branche) && /N\.valeur != null && !N\.partiel \? N\.valeur : null/.test(branche), 'B3 le vendu : le nombre de ventes du MOIS lu en entier, sinon rien');
  dit(/resteEnVentes\(prog, mois, maintenant\)/.test(branche), 'B4 la règle resteEnVentes est appelée (aucune seconde somme)');
  dit(/data-objectif-reste=/.test(auj) && /data-objectif-ventes-restantes=/.test(auj) && /data-objectif-sans-prix=/.test(auj), 'B5 la ligne porte ses data-*');
  dit(/tr\(o\.ventesAuPlus \? 'objr\.ventesAuPlus' : 'objr\.ventes'/.test(auj) && /tr\('objr\.sansPrix'/.test(auj), 'B6 la ligne passe par tr()');
  dit(/objectif\.enregistrer\(saisie, typeObj\)/.test(auj) && /enregistrer: \(saisie, t = type\)/.test(branche), 'B7 la feuille enregistre le TYPE choisi');
  dit(/options=\{typesObj\.map/.test(auj) && /\['ca', 'benefice'/.test(auj), 'B8 la feuille propose Vendu et Bénéfice');
  for (const l of ['fr', 'en', 'es', 'it', 'de']) {
    const t = lire(`src/i18n/langues/${l}/objectifReste.js`), idx = lire(`src/i18n/langues/${l}.js`);
    dit(/"objr\.ventes"/.test(t) && /"objr\.sansPrix"/.test(t) && /ecran_objectif_reste/.test(idx), `B9 textes ${l} présents et branchés`);
  }
  return ko;
}

(async () => {
  const OBJ = lire('src/objectifMois.js');
  const SRC = { carte: lire('src/design/carteChiffres.js'), branche: lire('src/aujourdhui/Branche.jsx'), auj: lire('src/natif/ecrans/Aujourdhui.jsx') };
  const ko = await verifier(OBJ, SRC);
  if (!PROUVE) { console.log(ko ? `❌ audit-objectif-reste : ${ko} contrôle(s) rouge(s)` : '✅ audit-objectif-reste : vert'); process.exit(ko ? 1 : 0); }
  if (ko) { console.log(`❌ --prouve : le code actuel n'est pas vert (${ko})`); process.exit(1); }
  const MUT = [
    ['arrondi vers le bas', 'obj', 'Math.ceil(r.reste / moyenne - 1e-9)', 'Math.round(r.reste / moyenne)'],
    ['moyenne sur toutes les ventes', 'obj', "const base = prog.type === 'benefice' ? nCout : n;", 'const base = n;'],
    ['moyenne sur 1 vente', 'obj', 'export const VENTES_MIN_MOYENNE = 3;', 'export const VENTES_MIN_MOYENNE = 1;'],
    ['« au plus » oublié', 'obj', 'auPlus: r.auPlus || sansPrix > 0, sansPrix, reste', 'auPlus: false, sansPrix, reste'],
    ['prix manquants tus', 'obj', 'n > nCout ? n - nCout : 0', '0'],
    ['atteint ignoré', 'obj', "  if (r.atteint) return { atteint: true, ventes: 0, moyenne: null, auPlus: false, sansPrix };\n", ''],
    ['n au lieu de nCout', 'branche', "{ n: N.n, nCout: N.nCout }", "{ n: N.n, nCout: N.n }"],
    ['type ignoré', 'auj', 'objectif.enregistrer(saisie, typeObj)', 'objectif.enregistrer(saisie)'],
  ];
  let rouges = 0;
  for (const [nom, ou, a, b] of MUT) {
    const src = ou === 'obj' ? OBJ : SRC[ou];
    if (!src.includes(a)) { console.log('❌ mutation impossible (motif absent) : ' + nom); process.exit(2); }
    const k = await verifier(ou === 'obj' ? OBJ.replace(a, b) : OBJ, ou === 'obj' ? SRC : { ...SRC, [ou]: src.replace(a, b) });
    console.log((k ? '  ✅ rouge : ' : '  ❌ RESTE VERT : ') + nom);
    if (k) rouges++;
  }
  console.log(rouges === MUT.length ? `✅ --prouve : ${rouges}/${MUT.length} mutations rougissent` : `❌ --prouve : ${MUT.length - rouges} mutation(s) restent vertes`);
  process.exit(rouges === MUT.length ? 0 : 1);
})();
