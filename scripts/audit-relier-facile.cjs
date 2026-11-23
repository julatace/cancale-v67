#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « RELIER » PLUS FACILE (21 nov., lot relier-code)
//        node scripts/audit-relier-facile.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// Julien (21 nov.) : « Rends relier les achats à la vente / à l'annonce plus facile. »
// EXÉCUTE src/relierPropositions.js sur la règle pondérée RÉELLE (src/liaisonAchat.js) et les règles de texte de l'app
// (extractBrand / extractColors / extractModel, extraites de src/App.jsx et exécutées) :
//   M  la MEILLEURE proposition : le bon achat seul ⇒ mis en avant, avec SES raisons (modèle, taille, arrivé le…) ;
//   E  « même avec 50 articles identiques… » : 50 achats identiques ⇒ AUCUNE meilleure (égalité dite) ; 50 ventes identiques
//      vues depuis un achat ⇒ aucune meilleure ; la vraie cachée (pas arrivée) ⇒ la suivante n'est pas promue ; marque
//      différente jamais proposée ; « Pas celle-ci » retenu ;
//   L  un LOT : son état (k sur n reliés), jamais un prix divisé ;
//   R  rien n'est relié sans SON toucher : les deux feuilles n'appellent `onRelier` que dans le geste de « Oui » ; aucun effet
//      ne relie ; la série n'avance qu'après une écriture ; les entrées existent (Ventes, Annonces, menu d'un achat, tableau).
// Aucune donnée réelle : tout est inventé ici.
// --prouve : chaque mutation réaffaiblit une règle ⇒ l'audit DOIT rougir.
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'egalite-tranchee': ['src/relierPropositions.js', "else if (p0 && !tresCachee && !p0.ambigu && (!p1 || (Number(p0.score) - Number(p1.score)) >= ECART_TRES_PROBABLE)\n    && (Number(p0.score) - rivalCache) >= ECART_TRES_PROBABLE) meilleure = p0;", 'else if (p0) meilleure = p0;'],
  'cachee-ignoree': ['src/relierPropositions.js', '&& (Number(p0.score) - rivalCache) >= ECART_TRES_PROBABLE) meilleure = p0;', ') meilleure = p0;', '!tresCachee && ', ''],
  'refus-ignore': ['src/relierPropositions.js', '    if (refus && key && refus[cleRefusLiaison(key, tx)]) continue;\n', ''],
  'inverse-egalite': ['src/relierPropositions.js', "else if (a0 && a0.premier && !a0.p.ambigu && (!a1 || (Number(a0.p.score) - Number(a1.p.score)) >= ECART_TRES_PROBABLE)) meilleure = a0;", 'else if (a0) meilleure = a0;'],
  'raison-oubliee': ['src/relierPropositions.js', "if (p && p.recu && Number.isFinite(Number(p.recu.ms)))", 'if (false)'],
  'grille-auto': ['src/natif/ecrans/LierAchatGrille.jsx', '  const relier = async () =>', '  React.useEffect(() => { if (rang.meilleure) onRelier(rang.meilleure.achat); }, [rang.meilleure]);\n  const relier = async () =>'],
  'inverse-auto': ['src/natif/ecrans/LierArticleGrille.jsx', '  const relier = async () =>', '  React.useEffect(() => { if (meilleure) onRelier(parCle.get(meilleure.key)); }, [meilleure]);\n  const relier = async () =>'],
  'relier-au-toucher': ['src/natif/ecrans/LierAchatGrille.jsx', 'data-la-relier={tx} aria-pressed={on ? \'true\' : \'false\'} onClick={() => setChoisi(on ? \'\' : tx)}', 'data-la-relier={tx} aria-pressed={on ? \'true\' : \'false\'} onClick={() => onRelier(a)}'],
  'serie-sans-ecriture': ['src/App.jsx', "    if (cible._serie && serieRelRef.current) { const S = serieRelRef.current; ouvrirSerieA({ ...S, faits: S.faits + 1 }, S.i + 1); return; }\n", '', "    const autres = await detacherAvantRelier(a, cible, opts); if (autres == null) return;", "    if (cible._serie && serieRelRef.current) { const S = serieRelRef.current; ouvrirSerieA({ ...S, faits: S.faits + 1 }, S.i + 1); return; }\n    const autres = await detacherAvantRelier(a, cible, opts); if (autres == null) return;"],
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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'relier-facile-'));
  process.on('exit', () => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} });
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true, filter: (s) => !/node_modules/.test(s) });
  const [f, ...paires] = MUTS[MUT];
  const p = path.join(d, f); let s = fs.readFileSync(p, 'utf8');
  for (let i = 0; i < paires.length; i += 2) { if (!s.includes(paires[i])) { console.log('motif introuvable : ' + MUT + ' ' + i); process.exit(2); } s = s.replace(paires[i], paires[i + 1]); }
  fs.writeFileSync(p, s); SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const APP = fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8');
const bout = (debut, fin) => { const a = APP.indexOf(debut); const b = APP.indexOf(fin, a); if (a < 0 || b < 0) throw new Error('introuvable : ' + debut); return APP.slice(a, b + fin.length); };
const ctx = {};
vm.runInNewContext([bout('const KNOWN_BRANDS=[', '];'), bout('function extractBrand(text){', '\n}'), bout('const COULEURS = {', '\n};'),
  bout('function extractColors(text){', '\n}'), bout('const KNOWN_MODELS = [', '];'), bout('function extractModel(text){', '\n}'), bout('function contientModele(t,k){', '\n}'),
  'this.extractBrand=extractBrand; this.extractColors=extractColors; this.extractModel=extractModel;'].join('\n'), ctx);
const regles = { marqueDe: ctx.extractBrand, couleursDe: ctx.extractColors, modeleDe: ctx.extractModel };
const J = 86400e3, T0 = Date.parse('2026-10-01T10:00:00Z');
const iso = (t) => new Date(t).toISOString();
const achat = (tx, title, t, prix = '35.0', extra = {}) => ({ transaction_id: tx, title, date: iso(t), price: { amount: prix, currency_code: 'EUR' }, status: 'Transaction finalisée', ...extra });

(async () => {
  const imp = (f) => import(require('url').pathToFileURL(path.join(SRC, f)).href);
  let L, P, S;
  try { L = await imp('liaisonAchat.js'); P = await imp('relierPropositions.js'); S = await imp('suggestionsAchat.js'); }
  catch (e) { dit(false, 'src/relierPropositions.js et la règle pondérée se chargent', e.message); console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(1); }
  const tx = (p) => String(p && p.achat ? p.achat.transaction_id : '');
  const pour = (cible, achats, o = {}) => {
    const base = { cible, achats, liens: o.liens || new Map(), refus: o.refus || {}, ...regles, receptionDe: o.receptionDe || null };
    return P.rangerPropositions({ tres: L.propositionsArticle(base), pistes: L.pistesArticle(base), montrable: o.montrable || (() => true), refus: o.refus || null, key: cible.key });
  };

  // ── M : un cas clair ──
  const cible = { key: 'v:9001', titre: 'Adidas Handball Spezial bleu marine taille 42', taille: '42', marque: 'adidas', dateRef: iso(T0 + 20 * J), prix: { amount: '80.0' } };
  const bon = achat(1001, 'Adidas handball spezial bleu marine 42', T0, '30.0');
  const voisins = [achat(1002, 'Adidas Spezial noir 44', T0 - 60 * J), achat(1003, 'Adidas samba beige 42', T0 - 30 * J), achat(1004, 'Nike Air Force 1 blanc 42', T0 - 10 * J)];
  const recu = (a) => (String(a.transaction_id) === '1001' ? { ms: T0 + 4 * J, source: 'livraison' } : null);
  const r1 = pour(cible, [bon, ...voisins], { receptionDe: recu });
  dit(tx(r1.meilleure) === '1001', 'M1 le bon achat seul ⇒ LA meilleure proposition', JSON.stringify(r1.meilleure && tx(r1.meilleure)));
  const raisons = r1.meilleure ? P.raisonsProposition(r1.meilleure, { prixVente: 80, prixAchat: 30 }) : [];
  const cles = raisons.map((m) => m.cle);
  dit(cles.includes('modele') && cles.includes('taille') && cles.includes('arrive') && cles.includes('prix'), 'M2 sa raison est écrite : même modèle · taille · arrivé le … · payé moins que vendu', cles.join(','));
  dit(!r1.autres.some((p) => /nike/i.test(p.achat.title)) && !(r1.meilleure && /nike/i.test(r1.meilleure.achat.title)), 'M3 une autre MARQUE n’est jamais proposée');

  // ── E : 50 achats identiques ──
  const id50 = Array.from({ length: 50 }, (_, i) => achat(2000 + i, 'Adidas handball spezial bleu marine 42', T0 - i * J, '30.0'));
  const r2 = pour(cible, id50);
  dit(!r2.meilleure, 'E1 50 achats identiques ⇒ AUCUNE meilleure proposition (jamais un tirage)', r2.meilleure ? tx(r2.meilleure) : '');
  dit(r2.egalite && r2.autres.length >= 2, 'E2 … et l’égalité est DITE (« à égalité, regarde la photo »)', `${r2.egalite} ${r2.autres.length}`);
  // La vraie cachée (pas arrivée) : la suivante ne devient pas « la meilleure ».
  const jumelle = achat(1005, 'Adidas handball spezial bleu marine 42', T0 - 2 * J, '31.0');
  const r3 = pour(cible, [bon, jumelle, ...voisins], { montrable: (a) => String(a.transaction_id) !== '1001' });
  dit(!r3.meilleure, 'E3 l’achat le plus proche pas encore arrivé (caché) ⇒ le suivant n’est pas promu « meilleur »', r3.meilleure ? tx(r3.meilleure) : '');
  // « Pas celle-ci »
  const refus = { [L.cleRefusLiaison(cible.key, '1001')]: iso(T0) };
  const r4 = P.rangerPropositions({ tres: [{ achat: bon, score: 12, niveau: 'tres-probable' }], pistes: [], refus, key: cible.key });
  dit(!r4.meilleure && !r4.autres.length, 'E4 « Pas celle-ci » ⇒ ce couple n’est plus proposé');
  // Depuis un achat : 50 ventes identiques.
  const cibles50 = Array.from({ length: 50 }, (_, i) => ({ key: 'v:' + (7000 + i), titre: 'Adidas Handball Spezial bleu marine taille 42', taille: '42', marque: 'adidas', dateRef: iso(T0 + (10 + i) * J), prix: { amount: '80.0' } }));
  const aff = L.affecterPropositions({ cibles: cibles50, achats: [bon], liens: new Map(), ...regles });
  const inv = P.propositionsPourAchat({ liaison: aff, tx: '1001' });
  dit(!inv.meilleure, 'E5 depuis un achat, 50 ventes identiques ⇒ aucune meilleure', inv.meilleure ? inv.meilleure.key : '');
  dit(inv.autres.length >= 2 && inv.egalite, 'E6 … les suggestions restent, l’égalité est dite', `${inv.autres.length} ${inv.egalite}`);
  // Depuis un achat : une seule vente qui lui ressemble ⇒ elle est en avant.
  const aff1 = L.affecterPropositions({ cibles: [cible, { key: 'v:9002', titre: 'Nike Air Force 1 blanc taille 42', taille: '42', dateRef: iso(T0 + 9 * J) }], achats: [bon, ...voisins], liens: new Map(), ...regles });
  const inv1 = P.propositionsPourAchat({ liaison: aff1, tx: '1001' });
  dit(inv1.meilleure && inv1.meilleure.key === cible.key, 'E7 depuis un achat : sa vente unique est la meilleure proposition', JSON.stringify(inv1.meilleure && inv1.meilleure.key));
  dit(!P.propositionsPourAchat({ liaison: aff1, tx: '1001', refus: { [L.cleRefusLiaison(cible.key, '1001')]: 1 } }).meilleure, 'E8 depuis un achat : « Pas celle-ci » retenu');

  // ── L : un lot ──
  const lot = achat(3001, 'Lot de 3 paires Adidas spezial 42', T0, '90.0');
  const e0 = P.etatLot(lot, new Map()), e1 = P.etatLot(lot, new Map([['3001', 2]]));
  dit(e0 && e0.n === 3 && e0.relies === 0 && e1.relies === 2, 'L1 un lot dit combien de ses articles sont reliés (0/3, puis 2/3)');
  dit(S.achatDisponible(lot, new Map([['3001', 2]])) && !S.achatDisponible(lot, new Map([['3001', 3]])), 'L2 un lot reste proposé jusqu’à son nombre, plus après');
  dit(!P.raisonsProposition({ achat: lot, pourquoi: [] }, { prixVente: 80, prixAchat: 90 / 3 }).some((m) => m.cle === 'prix'), 'L3 un lot ne se compare pas au prix de vente (son prix ne se divise pas)');
  dit(P.etatLot(bon, new Map()) === null, 'L4 un achat simple n’est pas un lot');

  // ── R : rien sans son toucher (sources, commentaires retirés) ──
  const G = sansCommentaires(fs.readFileSync(path.join(SRC, 'natif/ecrans/LierAchatGrille.jsx'), 'utf8'));
  const I = sansCommentaires(fs.readFileSync(path.join(SRC, 'natif/ecrans/LierArticleGrille.jsx'), 'utf8'));
  const seulDansOui = (src) => {
    const appels = src.match(/onRelier\(/g) || [];
    const dansRelier = /const relier = async \(\) => \{[^\n]*onRelier\(/.test(src);
    const oui = /data-la-oui=""[^\n]*onClick=\{relier\}/.test(src);
    return appels.length === 1 && dansRelier && oui && !/useEffect\([^\n]*onRelier/.test(src);
  };
  dit(seulDansOui(G), 'R1 « Lier à un achat » : `onRelier` n’est appelé QUE par « Oui » (aucun effet, aucun toucher sur la proposition)');
  dit(seulDansOui(I), 'R2 la feuille inverse (depuis un achat) : idem');
  dit(/data-la-relier=\{tx\}[^\n]*onClick=\{\(\) => setChoisi\(/.test(G) && /data-la-relier=\{x\.key\}[^\n]*onClick=\{\(\) => setChoisi\(/.test(I), 'R3 « Relier » de la meilleure proposition CHOISIT (puis « Oui » relie)');
  const A = sansCommentaires(APP);
  const ra = A.slice(A.indexOf('  const relierAchat = async (a, opts = {}) => {'), A.indexOf('  const entreePicker = '));
  dit(/const w = await ecritureRelierAchat\(a\); if \(!w\) return;[\s\S]*cible\._serie && serieRelRef\.current[\s\S]*ouvrirSerieA/.test(ra), 'R4 la série n’avance qu’APRÈS l’écriture d’avant (`ecritureRelierAchat`, `confirmerLiaison`)');
  dit(/serieRelier: [^\n]*lancerSerieRelier\('vente'\)/.test(A) && /data-vn-serie-relier/.test(fs.readFileSync(path.join(SRC, 'natif/ecrans/Ventes.jsx'), 'utf8')), 'R5 Ventes : « N sans achat · Relier en série »');
  dit(/onCompleter\('relier-serie'\)/.test(fs.readFileSync(path.join(SRC, 'natif/ecrans/Annonces.jsx'), 'utf8')) && /completer\.sujet === 'relier-serie'/.test(A), 'R6 Annonces : « Relier mes achats en série » (instance Compléter)');
  dit(/data-achat-relier=\{tid\}[^\n]*setRelierDepuis\(/.test(A) && /onRelier=\{\(l\) => setRelierDepuis\(/.test(A), 'R7 Achats (liste et tableau) : « Relier à une vente / annonce » ouvre la feuille inverse');
  dit(/x\.genre === 'vente' \? await relierAchatVente\(x\.l, a\) : await relierAchatAnnonce\(x\.item, a\)/.test(A), 'R8 la feuille inverse écrit par les chemins d’avant (`relierAchatVente`, `relierAchatAnnonce`)');
  dit(!/relierAchat|relierAchatVente|relierAchatAnnonce|setSaleOverride|updatePair/.test(sansCommentaires(fs.readFileSync(path.join(SRC, 'relierPropositions.js'), 'utf8'))), 'R9 src/relierPropositions.js n’écrit rien');
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
