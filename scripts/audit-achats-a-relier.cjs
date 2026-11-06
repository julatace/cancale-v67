#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — RELIER L'ACHAT AUX ANNONCES NUMÉROTÉES (6 nov., vague 2 · 4)
//        node scripts/audit-achats-a-relier.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/achatsARelier.js avec la marque, les couleurs et le modèle de l'APP
// (extractBrand / extractColors / extractModel, extraits de src/App.jsx) :
//   F  la file « Sans achat relié » : en ligne, numérotée, ni achat relié ni prix
//      connu (un prix saisi à la main n'y est pas : rien à relier) ; « Plus tard »
//      en fin de file et hors du nombre de Ma journée ;
//   G  LA meilleure suggestion : la règle de « Relier un achat » (`suggestionsAchat`)
//      — marque ET taille, achat antérieur à la mise en ligne, les CHAMPS de
//      l'annonce d'abord ; 50 annonces identiques : une proposition chacune, AUCUN
//      lien posé (le module n'écrit rien) ;
//   T  ce que la ligne montre : le prix proposé (reçu), jamais pour un lot ;
//   S  le branchement (src/App.jsx) : le filtre, la vue, Ma journée, « Relier » par
//      l'écriture de « Relier un achat » (`propositionPrixAchat`), « Saisir » le prix
//      tapé, « Plus tard » sans prix ; rien ne relie tout seul.
// --prouve : chaque mutation réaffaiblit une règle ⇒ l'audit DOIT rougir.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'prix-saisi-en-file': ['src/achatsARelier.js', '  return !(p != null && Number.isFinite(Number(p)));', '  return true;'],
  'lien-ignore': ['src/achatsARelier.js', "  if (e.buyFromId != null && String(e.buyFromId).trim() !== '') return false;\n", ''],
  'sans-numero': ['src/achatsARelier.js', "  if (!e || !String(e.numero || '').trim()) return false;", '  if (!e) return false;'],
  'plus-tard-compte': ['src/achatsARelier.js', 'export const aRelierJournee = (file) => (Array.isArray(file) ? file.filter((x) => !x.plusTard).length : 0);', 'export const aRelierJournee = (file) => (Array.isArray(file) ? file.length : 0);'],
  'plus-tard-devant': ['src/achatsARelier.js', '(Number(a.plusTard) - Number(b.plusTard)) || ', ''],
  'sans-date': ['src/achatsARelier.js', "dateRef: ms != null ? new Date(ms).toISOString() : null, curTx: ''", "dateRef: null, curTx: ''"],
  'champs-ignores': ['src/achatsARelier.js', "marque: x.brand || x.brand_title || '', taille: x.size || x.size_title || '',", "marque: '', taille: '',"],
  'lot-propose': ['src/achatsARelier.js', '    proposition: proposition && Number.isSafeInteger(proposition.centimes) ? proposition : null,', '    proposition: proposition || { centimes: 9000, source: "achat" },'],
  'app-auto': ['src/App.jsx', "  useEffect(() => { if (curSub === 'annonces' && annSort === 'sansachat') {", "  useEffect(() => { if (fileAchat && fillBuyAchats.items) for (const x of fileAchat) { const s = meilleureSuggestion({ item: x.item, achats: fillBuyAchats.items, liens: liensAchats, marqueDe: extractBrand, couleursDe: extractColors }); if (s) relierAchatAnnonce(x.item, s.achat); } }, [fileAchat]);\n  useEffect(() => { if (curSub === 'annonces' && annSort === 'sansachat') {"],
  'app-prix-brut': ['src/App.jsx', '  const relierAchatAnnonce = async (it, a) => {\n    const w = await ecritureRelierAchat(a); if (!w) return;', "  const relierAchatAnnonce = async (it, a) => {\n    const w = { buyPrice: String(a.price && a.price.amount), buyFromId: String(a.transaction_id) };"],
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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'achats-a-relier-'));
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
const APP_BRUT = fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8');
const bout = (debut, fin) => { const a = APP_BRUT.indexOf(debut); const b = APP_BRUT.indexOf(fin, a); if (a < 0 || b < 0) throw new Error('introuvable : ' + debut); return APP_BRUT.slice(a, b + fin.length); };
const ctx = {};
vm.runInNewContext([bout('const KNOWN_BRANDS=[', '];'), bout('function extractBrand(text){', '\n}'), bout('const COULEURS = {', '\n};'),
  bout('function extractColors(text){', '\n}'), bout('const KNOWN_MODELS = [', '];'), bout('function extractModel(text){', '\n}'), bout('function contientModele(t,k){', '\n}'),
  'this.extractBrand=extractBrand; this.extractColors=extractColors; this.extractModel=extractModel;'].join('\n'), ctx);
const { extractBrand: marqueDe, extractColors: couleursDe, extractModel: modeleDe } = ctx;

(async () => {
  let A;
  try { A = await import(require('url').pathToFileURL(path.join(SRC, 'achatsARelier.js')).href); }
  catch (e) { dit(false, 'src/achatsARelier.js se charge', e.message); A = null; }
  if (A) {
  const J = 86400e3, T0 = Date.parse('2026-10-20T12:00:00Z');
  const prixAchat = (e) => { const v = Number(String(e && e.buyPrice != null ? e.buyPrice : '').replace(',', '.')); return String(e && e.buyPrice != null ? e.buyPrice : '').trim() && Number.isFinite(v) ? v : null; };
  const an = (id, title, jours, o = {}) => ({ id, title, createdTs: Math.floor((T0 - jours * J) / 1000), price: { amount: '60.0' }, ...o });
  const ach = (tx, title, jours, o = {}) => ({ transaction_id: tx, title, date: new Date(T0 - jours * J).toISOString(), price: { amount: '30.0', currency_code: 'EUR' }, status: 'Commande finalisée', ...o });

  console.log('\n── F. La file « Sans achat relié »');
  const annonces = [an('1', 'Adidas Spezial noir 42,5', 5), an('2', 'Nike Dunk 41', 20), an('3', 'Puma Suede 40', 2), an('4', 'Asics Gel 43', 9), an('5', 'Vans Era 44', 1), an('2', 'Nike Dunk 41', 20)];
  const numeros = { 1: { numero: '12', auto: true }, 2: { numero: '13', auto: true }, 3: { numero: '14', buyPrice: '25' }, 4: { numero: '15', buyFromId: '777' }, 5: {} };
  const f = A.fileSansAchat({ annonces, numeros, prixAchat });
  dit(f.map((x) => x.id).join(',') === '2,1', 'F1 numérotées, sans achat ni prix : 2 puis 1 (la plus ancienne d’abord), une fois chacune', f.map((x) => x.id).join(','));
  dit(!f.some((x) => x.id === '3'), 'F2 un prix saisi à la main (sans achat Vinted) ⇒ pas dans la file');
  dit(!f.some((x) => x.id === '4'), 'F3 un achat déjà relié ⇒ pas dans la file');
  dit(!f.some((x) => x.id === '5'), 'F4 sans N° ⇒ pas dans cette file (c’est « Sans numéro »)');
  const ft = A.fileSansAchat({ annonces, numeros, prixAchat, plusTard: { 2: 'x' } });
  dit(ft.map((x) => x.id).join(',') === '1,2' && ft[1].plusTard, 'F5 « Plus tard » ⇒ en fin de file (toujours visible)');
  dit(A.aRelierJournee(ft) === 1 && A.aRelierJournee(f) === 2 && A.aRelierJournee(null) === 0, 'F6 Ma journée : le nombre sans les « plus tard »');

  console.log('\n── G. La meilleure suggestion (la règle de « Relier un achat »)');
  const achats = [ach(1, 'Adidas Spezial noire 42.5', 30), ach(2, 'Adidas Spezial noire 42.5', 2), ach(3, 'Adidas Spezial bleue 42.5', 40), ach(4, 'Adidas Samba noire 42.5', 50), ach(5, 'Adidas Spezial noire 43', 60)];
  const s1 = A.meilleureSuggestion({ item: annonces[0], achats, liens: new Map(), marqueDe, couleursDe, modeleDe });
  dit(s1 && s1.achat.transaction_id === 1 && s1.rang === 1, 'G1 marque + taille + couleur, achat ANTÉRIEUR à la mise en ligne (l’achat d’il y a 2 j est postérieur)', JSON.stringify(s1 && s1.achat.transaction_id));
  dit(A.meilleureSuggestion({ item: an('9', 'Adidas Spezial noir', 5), achats, liens: new Map(), marqueDe, couleursDe, modeleDe }) === null, 'G2 taille inconnue ⇒ aucune suggestion (jamais la marque seule)');
  dit(A.meilleureSuggestion({ item: an('9', 'Spezial', 5, { brand: 'Adidas', size: '42,5', color1: 'Noir' }), achats, liens: new Map(), marqueDe, couleursDe, modeleDe }) !== null, 'G3 les CHAMPS de l’annonce (marque, taille, couleur) d’abord');
  dit(A.meilleureSuggestion({ item: annonces[0], achats, liens: new Map([['1', 1]]), marqueDe, couleursDe, modeleDe }) === null, 'G4 l’achat déjà relié ailleurs n’est plus proposé');
  const cinquante = Array.from({ length: 50 }, (_, i) => an(String(100 + i), 'Adidas Spezial noir 42,5', 5));
  const pool = Array.from({ length: 50 }, (_, i) => ach(1000 + i, 'Adidas Spezial noire 42.5', 10 + i));
  const liens = new Map();
  const props = cinquante.map((x) => A.meilleureSuggestion({ item: x, achats: pool, liens, marqueDe, couleursDe, modeleDe }));
  dit(props.every(Boolean) && liens.size === 0, 'G5 50 annonces identiques, 50 achats identiques : une proposition chacune, AUCUN lien posé (SON tap relie)');
  dit(A.cibleAnnonce({ createdTs: 0 }).dateRef === null && A.cibleAnnonce(annonces[0]).dateRef === new Date(annonces[0].createdTs * 1000).toISOString(), 'G6 la date de mise en ligne est la borne (inconnue ⇒ pas de borne inventée)');

  console.log('\n── T. Ce que la ligne montre');
  const prop = { centimes: 3290, source: 'recu', texte: '32,90 €' };
  const t1 = A.texteSuggestion(s1, prop);
  dit(t1 && t1.proposition && t1.proposition.centimes === 3290 && !t1.lot, 'T1 le prix du reçu est montré sur « Relier »');
  const t2 = A.texteSuggestion({ achat: ach(9, 'Lot 3 articles', 30), rang: 2 }, null);
  dit(t2 && t2.lot && t2.proposition === null, 'T2 un LOT : aucun prix proposé (le prix de CET article sera demandé)');
  dit(A.texteSuggestion(null, prop) === null, 'T3 pas de suggestion ⇒ rien à montrer');
  const src = fs.readFileSync(path.join(SRC, 'achatsARelier.js'), 'utf8').replace(/\/\/.*$/gm, '');
  dit(!/fetch\(|localStorage|save\(|setNumeros|updatePair/.test(src), 'T4 le module n’écrit nulle part');

  }
  console.log('\n── S. Le branchement dans l’app');
  const APP = sansCommentaires(APP_BRUT);
  dit(/annSort==='sansachat' \? \(\s*<AchatsARelier file=\{fileAchat\}/.test(APP) && /data-vue-sans-achat=/.test(APP), 'S1 le filtre « Sans achat relié » et sa vue');
  dit(/fileSansAchat\(\{ annonces: listings\.items\.filter\(\(it\) => it && !acctOffOf\(it\)\), numeros, prixAchat: \(e\) => \{ const a = prixAchatDe\(e, buyByNum\);/.test(APP), 'S2 la file lit le prix d’achat par la règle de l’app (`prixAchatDe`), compte exclu écarté');
  const iR = APP.indexOf('const relierAchatAnnonce = async (it, a) => {');
  const rel = iR >= 0 ? APP.slice(iR, APP.indexOf('};', iR)) : '';
  const iE = APP.indexOf('const ecritureRelierAchat = async (a) => {');
  const ecr = iE >= 0 ? APP.slice(iE, APP.indexOf('\n  };', iE)) : '';
  dit(/await ecritureRelierAchat\(a\)/.test(rel) && /updatePair\(it, w\)/.test(rel) && /propositionPrixAchat\(\{ identite: \{ achat: a, par: 'choix' \}, ventilationDe: ventilationDeTx \}\)/.test(ecr) && /ecritureLot\(a, saisi/.test(ecr), 'S3 « Relier » : l’écriture de « Relier un achat » (prix du reçu ; un lot demande le prix de l’article)');
  dit(/onPlusTard=\{poserAchatPlusTard\}/.test(APP) && /const poserAchatPlusTard = \(id\) => setAchatPlusTard/.test(APP) && !/poserAchatPlusTard[^\n]*buyPrice/.test(APP), 'S4 « Plus tard » ne pose aucun prix');
  dit(/if \(nR > 0\) jobs\.push\(\{ id: 'achat-a-relier'/.test(APP) && /aRelierJournee\(fileAchat\)/.test(APP), 'S5 Ma journée dit le nombre, une fois');
  dit(!/useEffect\([^;]*relierAchatAnnonce/.test(APP) && !/useEffect\([^\n]*meilleureSuggestion/.test(APP), 'S6 rien ne relie tout seul (aucun effet ne relie)');

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
