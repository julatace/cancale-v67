// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — L'ARRIVÉE DES DONNÉES SANS GEL (16 nov., lot stabilite-iphone)
//  Julien : « l'app bug énormément », « lent quand les données s'affichent, c'est pas fluide ». Ses mesures
//  (Ventes · téléphone · réponse au toucher, le 16) : 7 touchers sur 9 entre 1,25 et 4 s. Le profil de
//  l'ouverture de Ventes (base inventée de 1 000 paires) nommait trois coupables ; chacun est EXÉCUTÉ ici :
//   L  `propositionsArticle` (src/liaisonAchat.js), appelée pour CHAQUE vente sans achat relié à CHAQUE
//      rendu de Ventes, re-préparait TOUS les achats : au 2e appel sur les mêmes achats, aucun achat n'est
//      re-préparé (la marque n'est relue que pour l'article), le résultat est IDENTIQUE, et un achat dont le
//      titre change est bien re-préparé ;
//   R  les rangées défilantes (src/rangeesDefilantes.js) : toutes les MESURES avant toute MARQUE (sinon une
//      mise en page de tout l'écran par rangée) ;
//   C  le grand chiffre (`ajusterChiffre`, src/design/CarteMois.jsx) : quand il tient et n'a jamais été
//      ajusté, AUCUNE écriture de style ni lecture de style calculé ; trop long, il est toujours ajusté.
//  `--prouve` : trois mutations (le cache retiré, lire-écrire entrelacés, le raccourci retiré), chacune ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'cache-retire': ['src/liaisonAchat.js', 'if (peutGarder) PREP_ACHAT.set(', 'if (false) PREP_ACHAT.set('],
  'lire-ecrire-entrelaces': ['src/rangeesDefilantes.js', 'const suites = els.map(mesurer);\n      els.forEach((el, i) => marquer(el, suites[i]));', 'els.forEach((el) => juger(el));'],
  'raccourci-retire': ['src/design/CarteMois.jsx', "if (!el.style.fontSize && !el.style.whiteSpace && !el.hasAttribute('data-chiffre-replie') && !(el.scrollWidth > largeur + 0.5)) return;", ''],
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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'arrivee-'));
  process.on('exit', () => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} });
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true, filter: (s) => !/node_modules/.test(s) });
  const [f, a, b] = MUTS[MUT];
  const p = path.join(d, f); const s = fs.readFileSync(p, 'utf8');
  if (!s.includes(a)) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(p, s.replace(a, b)); SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

// Les règles de texte de l'app, exécutées telles quelles (comme audit-liaison-achat).
const APP = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
const bout = (debut, fin) => { const a = APP.indexOf(debut); const b = APP.indexOf(fin, a); if (a < 0 || b < 0) throw new Error('introuvable : ' + debut); return APP.slice(a, b + fin.length); };
const ctx = {};
vm.runInNewContext([bout('const KNOWN_BRANDS=[', '];'), bout('function extractBrand(text){', '\n}'), bout('const COULEURS = {', '\n};'),
  bout('function extractColors(text){', '\n}'), bout('const KNOWN_MODELS = [', '];'), bout('function extractModel(text){', '\n}'), bout('function contientModele(t,k){', '\n}'),
  'this.extractBrand=extractBrand; this.extractColors=extractColors; this.extractModel=extractModel;'].join('\n'), ctx);

(async () => {
  // ── L ──
  const L = await import(require('url').pathToFileURL(path.join(SRC, 'liaisonAchat.js')).href);
  const J = 86400e3, T0 = Date.parse('2026-03-01T10:00:00Z');
  const MODELES = ['Salomon XT-6 noir', 'Nike Air Max 1 blanc', 'Adidas Samba beige', 'New Balance 550 vert', 'Asics Gel-1130 gris', 'Adidas Spezial bleu'];
  const achats = [];
  for (let i = 0; i < 300; i++) achats.push({ transaction_id: 5000 + i, title: `${MODELES[i % MODELES.length]} taille ${36 + (i % 10)}`, date: new Date(T0 + i * J / 3).toISOString(), price: { amount: String(30 + (i % 20)) }, status: 'Transaction finalisée' });
  let appels = 0;
  const marqueDe = (t) => { appels++; return ctx.extractBrand(t); };
  const regles = { marqueDe, couleursDe: ctx.extractColors, modeleDe: ctx.extractModel };
  const cible = { key: 'v:1', titre: 'Salomon XT-6 noir taille 42', marque: 'Salomon', taille: '42', dateRef: new Date(T0 + 200 * J).toISOString(), dateRefSource: 'vente', prix: { amount: '80' } };
  const resume = (l) => JSON.stringify((l || []).map((p) => [String(p.achat.transaction_id), Math.round(p.score * 1000), p.niveau]));
  appels = 0; const r1 = L.propositionsArticle({ cible, achats, ...regles }); const a1 = appels;
  appels = 0; const r2 = L.propositionsArticle({ cible, achats, ...regles }); const a2 = appels;
  dit(a1 >= achats.length, `L0 le 1er appel prépare chaque achat (${a1} lectures de marque pour ${achats.length} achats)`);
  dit(a2 <= 2, `L1 le 2e appel sur les MÊMES achats n'en re-prépare aucun`, `${a2} lecture(s) de marque (avant : une par achat)`);
  // (16 nov., relier-fiable + achats-retour) Ici plusieurs achats identiques : en ligne, aucune « très probable » (la règle
  // d'exclusivité) — le même résultat se juge sur les propositions ET les pistes repliées, recalculées sur les mêmes achats.
  const p1 = L.pistesArticle ? L.pistesArticle({ cible, achats, ...regles }) : [], p2 = L.pistesArticle ? L.pistesArticle({ cible, achats, ...regles }) : [];
  dit(resume(r1) === resume(r2) && resume(p1) === resume(p2) && r1.length + p1.length > 0, 'L2 le même résultat, à l’identique', `${resume(r1.concat(p1)).slice(0, 80)} | ${resume(r2.concat(p2)).slice(0, 80)}`);
  achats[3] = { ...achats[3] }; achats[7].title = 'Salomon XT-6 noir taille 42 état neuf';
  appels = 0; L.propositionsArticle({ cible, achats, ...regles }); const a3 = appels;
  dit(a3 >= 1 && a3 <= 4, 'L3 un achat changé (nouvel objet, ou titre modifié) est re-préparé — lui seul', `${a3} lecture(s)`);

  // ── R ──
  const journal = [];
  const fausse = (i) => ({
    get scrollWidth() { journal.push('R' + i); return 500; }, get clientWidth() { journal.push('R' + i); return 300; }, get scrollLeft() { return 0; },
    closest: () => null, getAttribute: () => null, hasAttribute: () => false, setAttribute: () => journal.push('W' + i), removeAttribute: () => journal.push('W' + i), matches: () => true,
  });
  const els = [0, 1, 2, 3].map(fausse);
  global.window = { addEventListener() {}, __vrmRangees: false };
  global.document = { body: {}, addEventListener() {}, querySelectorAll: () => els };
  global.MutationObserver = class { observe() {} };
  global.setTimeout = (f) => f(); global.requestAnimationFrame = (f) => f();
  const RD = await import(require('url').pathToFileURL(path.join(SRC, 'rangeesDefilantes.js')).href);
  RD.suivreRangeesDefilantes();
  const premiereEcriture = journal.findIndex((x) => x[0] === 'W'), derniereLecture = journal.map((x) => x[0]).lastIndexOf('R');
  dit(premiereEcriture > 0 && derniereLecture < premiereEcriture, 'R1 les rangées : toutes les mesures, PUIS toutes les marques (une seule mise en page)', journal.join(' '));

  // ── C ──
  let C = null;
  try {
    const esbuild = require(path.join(R, 'node_modules', 'esbuild'));
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'carte-mois-')), 'c.cjs');
    esbuild.buildSync({ entryPoints: [path.join(SRC, 'design', 'CarteMois.jsx')], bundle: true, platform: 'node', format: 'cjs', outfile: out, jsx: 'automatic', loader: { '.css': 'empty', '.svg': 'empty' }, nodePaths: [path.join(R, 'node_modules')], logLevel: 'silent' });
    C = require(out);
  } catch (e) { dit(false, 'C src/design/CarteMois.jsx se charge', String(e.message || e).slice(0, 160)); }
  if (C && C.ajusterChiffre) {
    let ecritures = 0, calcules = 0;
    global.getComputedStyle = () => { calcules++; return { fontSize: '38px' }; };
    global.ResizeObserver = undefined;
    const el = (largeur, contenu) => { const style = { fontSize: '', whiteSpace: '', removeProperty() { ecritures++; }, setProperty(k, v) { ecritures++; if (k === 'font-size') this.fontSize = v; } };
      return { style, parentElement: null, get clientWidth() { return largeur; }, get scrollWidth() { const fs = parseFloat(style.fontSize) || 38; return Math.round(contenu * fs / 38); }, hasAttribute: () => false, removeAttribute() { ecritures++; }, setAttribute() { ecritures++; } }; };
    ecritures = 0; calcules = 0; C.ajusterChiffre(el(300, 200));
    dit(ecritures === 0 && calcules === 0, 'C1 un chiffre qui tient, jamais ajusté : aucune écriture de style, aucun style calculé relu', `${ecritures} écriture(s), ${calcules} lecture(s) de style calculé`);
    ecritures = 0; const long = el(200, 400); C.ajusterChiffre(long);
    dit(ecritures > 0 && parseFloat(long.style.fontSize) < 38, 'C2 un chiffre trop long est toujours ajusté (taille réduite)', `taille ${long.style.fontSize || '—'}`);
  }

  console.log(`\naudit-arrivee-sans-gel : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
