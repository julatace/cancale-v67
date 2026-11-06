#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « PRIX MINI… » SUR UNE SÉLECTION D'ANNONCES (6 nov., vague 2 · 2)
//        node scripts/audit-prix-mini.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/annoncesActions.js (`minisSelection`, `miniDepuisPrix`, `ecritureMini`) :
//   P  le mini = prix − X % ou − X €, arrondi à l'euro, JAMAIS au-dessus du prix ;
//      prix pas lu ⇒ rien posé ; mini sous 1 € ⇒ rien ; réduction illisible ⇒ rien ;
//   F  « Refuser sous » en option, toujours SOUS le mini (sinon pas posé, et dit) ;
//   A  sous un prix d'achat CONNU ⇒ la ligne le dit (rien n'est bloqué : son choix) ;
//   E  l'écriture : un entier que l'extension lit (`Number(min)`, la lecture de
//      `autoAccepterOffres`), `refuse` seulement si l'option est cochée ;
//   X  l'action : non robot (rien ne part chez Vinted), plusieurs comptes permis, un
//      lien sous les quatre tuiles (les tuiles restent celles des moteurs) ;
//   S  le branchement (src/App.jsx, commentaires retirés) : la confirmation liste
//      N° · prix · mini, puis `updatePair` … `ecritureMini` ; aucune commande Vinted.
// --prouve : chaque mutation réaffaiblit une règle ⇒ l'audit DOIT rougir.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'au-dessus-du-prix': ['src/annoncesActions.js', '  if (m > p) m = Math.floor(p);\n', ''],
  'sans-arrondi': ['src/annoncesActions.js', '  let m = Math.round(brut);', '  let m = Math.round(brut * 100) / 100;'],
  'refus-au-dessus': ['src/annoncesActions.js', 'if (rf != null && rf >= mn) {', 'if (rf != null && rf > mn + 1000) {'],
  'achat-tu': ['src/annoncesActions.js', 'sousAchat: achat != null && Number.isFinite(achat) && mn < achat,', 'sousAchat: false,'],
  'prix-absent-zero': ['src/annoncesActions.js', "if (base.prix == null) return { ...base, raison: 'prix pas lu : rien n’est posé' };", 'if (base.prix == null) base.prix = 0;'],
  'pct-cent': ['src/annoncesActions.js', "if (mode === 'pct' && n >= 100) return null;", ''],
  'refus-toujours': ['src/annoncesActions.js', 'if (avecRefus && l.refuse != null) w.refuse = String(l.refuse);', 'w.refuse = String(l.refuse);'],
  'robot': ['src/annoncesActions.js', "etats: ['en-ligne'], robot: false, lien: true, multiComptes: true },", "etats: ['en-ligne'], robot: true, cap: 'commande', lien: true },"],
  'app-sans-confirmation': ['src/App.jsx', "          if (!ok) return;\n          const idx = new Map((listings.items||[]).map((it)=>[String(it.id), it]));", "          const idx = new Map((listings.items||[]).map((it)=>[String(it.id), it]));"],
  'app-autre-chemin': ['src/App.jsx', 'const w = ecritureMini(l, { avecRefus }); if (it && w) { updatePair(it, w); n++; }', 'if (it) { updatePair(it, { min: String(l.prix) }); n++; }'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'prix-mini-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  const [f, de, vers] = MUTS[MUT];
  const p = path.join(d, f); const s = fs.readFileSync(p, 'utf8');
  if (!s.includes(de)) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(p, s.replace(de, vers)); SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + String(d).slice(0, 300))); };
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  let A;
  try { A = await import(require('url').pathToFileURL(path.join(SRC, 'annoncesActions.js')).href); } catch (e) { A = {}; }
  const execute = typeof A.minisSelection === 'function';
  if (!execute) dit(false, '`minisSelection` existe (src/annoncesActions.js)');
  if (execute) {
  const ann = [
    { id: '1', numero: '12', titre: 'Nike Air Max 1', prix: 60, achat: 40 },
    { id: '2', numero: '13', titre: 'Adidas Samba', prix: 45.5, achat: 44 },
    { id: '3', numero: '', titre: 'Sans N°', prix: 3 },
    { id: '4', numero: '15', titre: 'Prix pas lu', prix: null },
  ];
  const parId = (r) => Object.fromEntries(r.lignes.map((l) => [l.id, l]));

  console.log('\n── P. Le mini');
  const r10 = parId(A.minisSelection({ annonces: ann, mini: { mode: 'pct', valeur: '10' } }));
  dit(r10['1'].mini === 54 && r10['2'].mini === 41, 'P1 − 10 % : 60 → 54 ; 45,50 → 41 (arrondi à l’euro)', JSON.stringify([r10['1'].mini, r10['2'].mini]));
  dit(r10['3'].mini === 3 && r10['4'].mini == null && /prix pas lu/.test(r10['4'].raison), 'P2 prix pas lu ⇒ rien posé, dit ; un petit prix garde son mini', JSON.stringify([r10['3'], r10['4']]));
  const r5 = parId(A.minisSelection({ annonces: ann, mini: { mode: 'eur', valeur: '5' } }));
  dit(r5['1'].mini === 55 && r5['2'].mini === 41 && r5['3'].mini == null, 'P3 − 5 € : 60 → 55 ; 45,50 → 41 ; 3 € → rien (mini sous 1 €)', JSON.stringify([r5['1'].mini, r5['2'].mini, r5['3'].mini]));
  dit(A.miniDepuisPrix(45.5, 'pct', '0,5') === 45 && A.miniDepuisPrix(45.5, 'eur', '0,2') === 45, 'P4 jamais au-dessus du prix : 45,50 − 0,5 % ⇒ 45 (pas 46)');
  dit(A.miniDepuisPrix(60, 'pct', '100') === null && A.miniDepuisPrix(60, 'pct', 'abc') === null && A.miniDepuisPrix(60, 'pct', '-5') === null && A.miniDepuisPrix(60, 'xx', '5') === null, 'P5 réduction illisible, nulle, négative ou ≥ 100 % ⇒ rien');
  const e = A.minisSelection({ annonces: ann, mini: { mode: 'pct', valeur: '' } });
  dit(e.erreur && e.aPoser === 0, 'P6 aucune réduction ⇒ rien à poser, l’erreur dite');
  dit(!!A.minisSelection({ annonces: ann, mini: { mode: 'pct', valeur: '100' } }).erreur && A.valeurReduction('100', 'pct') === null && A.valeurReduction('100', 'eur') === 100, 'P8 « − 100 % » est une erreur dite (pas « mini sous 1 € » sur chaque ligne) ; « − 100 € » se lit');
  for (const p of [9.99, 10, 33.33, 45.5, 60, 129, 1500]) for (const x of ['1', '7,5', '33', '99']) {
    const m = A.miniDepuisPrix(p, 'pct', x); if (m != null && (m > p || !Number.isInteger(m))) { dit(false, `P7 ${p} − ${x} % ⇒ ${m}`); }
  }
  dit(true, 'P7 sur 28 prix × réductions : le mini est un entier, jamais au-dessus du prix');

  console.log('\n── F. « Refuser sous »');
  const rf = parId(A.minisSelection({ annonces: ann, mini: { mode: 'pct', valeur: '10' }, refuse: { mode: 'pct', valeur: '30' } }));
  dit(rf['1'].refuse === 42 && rf['2'].refuse === 32, 'F1 − 30 % : 60 → refus sous 42 ; 45,50 → 32');
  const rf2 = parId(A.minisSelection({ annonces: ann, mini: { mode: 'pct', valeur: '30' }, refuse: { mode: 'pct', valeur: '10' } }));
  dit(rf2['1'].refuse == null && /sous le mini/.test(rf2['1'].raison) && rf2['1'].mini === 42, 'F2 un seuil de refus au-dessus du mini n’est pas posé, et c’est dit');
  dit(A.minisSelection({ annonces: ann, mini: { mode: 'pct', valeur: '10' }, refuse: { mode: 'pct', valeur: 'x' } }).erreur, 'F3 un seuil de refus illisible ⇒ rien n’est posé (erreur dite)');

  console.log('\n── A. Sous le prix d’achat');
  dit(!r10['1'].sousAchat && r10['2'].sousAchat, 'A1 41 € sous un achat de 44 € ⇒ dit ; 54 € sur un achat de 40 € ⇒ rien');
  dit(!r10['3'].sousAchat, 'A2 prix d’achat inconnu ⇒ rien n’est dit (pas su)');

  console.log('\n── E. L’écriture');
  const w = A.ecritureMini(r10['2']);
  dit(w && w.min === '41' && Number.isInteger(Number(w.min)) && !('refuse' in w), 'E1 « 41 » : un entier lu par l’extension (`Number(min)`), le refus existant n’est pas touché', JSON.stringify(w));
  const w2 = A.ecritureMini(rf['1'], { avecRefus: true });
  dit(w2 && w2.min === '54' && w2.refuse === '42', 'E2 option cochée : « Refuser sous » écrit aussi', JSON.stringify(w2));
  dit(A.ecritureMini(r10['4']) === null && A.ecritureMini(null) === null, 'E3 rien posé ⇒ rien écrit');
  // La lecture de l'extension (autoAccepterOffres) : `Number(nums[k].min)` > 0.
  const BG = fs.readFileSync(path.join(R, 'vinted-sync-extension', 'background.js'), 'utf8');
  dit(/const n = Number\(nums\[k\] && nums\[k\]\.min\); if \(isFinite\(n\) && n > 0\) mins\[String\(k\)\] = n;/.test(BG) && Number(w.min) > 0, 'E4 l’extension lit `Number(min)` : « 41 » vaut 41 (jamais « 41,00 »)');

  }
  console.log('\n── X. L’action');
  const M = (A.ACTIONS_SELECTION || []).find((x) => x.k === 'mini');
  dit(M && M.robot === false && !M.cap && M.lien === true && !(A.ACTIONS_TUILES || []).includes('mini'), 'X1 « Prix mini… » : non robot, sans capacité d’extension, un lien (les quatre tuiles restent)');
  const act = Object.fromEntries((A.actionsPossibles || (() => []))({ selection: [{ id: '1', uid: '111', etat: 'en-ligne' }, { id: '2', uid: '222', etat: 'en-ligne' }], chrome: null, capOk: () => false, nomCompte: () => '' }).map((x) => [x.k, x]));
  dit(act.mini && act.mini.ok && act.recreer && !act.recreer.ok, 'X2 deux comptes, aucun compte ouvert, extension absente ⇒ « Prix mini… » possible, les moteurs non');

  console.log('\n── S. Le branchement dans l’app');
  const APP = sansCommentaires(fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8'));
  const i = APP.indexOf('<PrixMiniFeuille choisies={miniSel}');
  const bloc = i >= 0 ? APP.slice(i, i + 2000) : '';
  dit(/askConfirm\(\{ title: `Poser \$\{lignes\.length\} prix mini \?`, desc: lignes\.map\(\(l\)=>`\$\{l\.numero \? 'N°'\+l\.numero : 'Sans N°'\} · \$\{montant\(l\.prix\)\} → mini \$\{montant\(l\.mini\)\}/.test(bloc) && /if \(!ok\) return;/.test(bloc), 'S1 la confirmation liste N° · prix · mini, et rien ne s’écrit sans elle');
  dit(/const w = ecritureMini\(l, \{ avecRefus \}\); if \(it && w\) \{ updatePair\(it, w\); n\+\+; \}/.test(bloc), 'S2 l’écriture par le chemin de la carte : `updatePair` … `ecritureMini`');
  dit(!/vmrCmd|executerCommande|recreerVinted/.test(bloc), 'S3 aucune commande n’est envoyée à Vinted');
  dit(/if \(k==='mini'\) \{ setMiniSel\(choisies\); return; \}/.test(APP) && /data-action-sel="mini"/.test(APP), 'S4 la feuille « Actions » ouvre « Prix mini… » (un lien sous les tuiles)');

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
