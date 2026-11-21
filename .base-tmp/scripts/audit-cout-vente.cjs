#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LOTS BA et BF (10 nov.) — LE COÛT RÉEL D'UNE VENTE et LA VALEUR DU STOCK
//         node scripts/audit-cout-vente.cjs [--mutation=…] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/coutVente.js sur des données INVENTÉES (le dépôt est public) et lit
// dans le code des écrans que :
//   C. la cascade d'une vente DÉCOMPOSE la règle du bénéfice (`beneficePaire`) :
//      vente − achat − frais − emballage = bénéfice, au centime, sur 3 000 tirages ;
//      même état que `beneficeLigneVente` ; achat absent ⇒ bénéfice « — » (jamais
//      un achat à 0) ; emballage vide ⇒ NOMMÉ « non saisi », jamais 0 ni deviné ;
//      l'emballage saisi entre dans `coutsVente` (donc dans tous les totaux) ;
//   V. la valeur du stock = Σ prix d'achat SAISIS des paires données (illisible ou
//      absent ⇒ « sans prix », jamais sommé) ; aucun prix ⇒ « — » ; « au moins »
//      dès qu'il en manque ; 50 paires identiques ⇒ chacune comptée par son id ;
//   E. les écrans : la fiche de vente rend la cascade (barre + emballage, porte
//      ambre, jamais rouge) ; la valeur est calculée UNE fois (écran Annonces, sur
//      `annoncesPresentes`), publiée sous `vrm_valeur_stock`, LUE par le Stock et
//      Statistiques ; l'ancien `liveStats.stockValue` (sans couverture) a disparu.
// `--mutation=…` réaffaiblit une règle dans une copie de src/ : rouge exigé.
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUTS = {
  'emballage-hors-regle': ["['autresFrais','Autres frais'],['emballage','Emballage']]", "['autresFrais','Autres frais']]", 'beneficePaire.js'],
  'emballage-zero': ["const emb = emballageSaisi ? centimes(e.emballage) : null;", "const emb = emballageSaisi ? centimes(e.emballage) : 0;"],
  'frais-avec-emballage': ["const frais = b.valid ? b.cents - (emb ?? 0) : null;", "const frais = b.valid ? b.cents : null;"],
  'achat-zero': ["if (b.achat == null) return { ...base, etat: 'achat', benefice: null };", "if (b.achat == null) return { ...base, etat: 'ok', benefice: b.vente - b.cents };"],
  'partiel-dit-exact': ["etat: b.complet ? 'ok' : 'partiel'", "etat: 'ok'"],
  'stock-sans-prix-zero': ["if (a == null) sans.push(String(it.id)); else { c += a; nPrix += 1; }", "if (a == null) { c += 0; nPrix += 1; } else { c += a; nPrix += 1; }"],
  'stock-au-moins-tu': ["const auMoins = v.nSans > 0 || !!partiel;", "const auMoins = false;"],
  'stock-vide-zero': ["return { centimes: nPrix ? c : (n ? null : 0), n, nPrix, nSans: sans.length, sans };", "return { centimes: c, n, nPrix, nSans: sans.length, sans };"],
  'ecran-rouge': ["color: var(--vrm-warn, #B25000); word-spacing: normal;", "color: #D70015; word-spacing: normal;", 'styles-cout-vente.css'],
  'ecran-porte-absente': ["<SaisieEmballage onSaisir={v=>setSaleOverride(o.transaction_id,{emballage:v})}/>", "'—'", 'App.jsx'],
  'ecran-second-calcul': ["value={valeurStk && valeurStk.centimes != null ?", "value={liveStats && liveStats.online ? fmt(0) : valeurStk && valeurStk.centimes != null ?", 'ecrans/Stats.jsx'],
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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cout-vente-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  const f = path.join(d, 'src', MUTS[MUT][2] || 'coutVente.js'); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MUTS[MUT][0])) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(MUTS[MUT][0], MUTS[MUT][1]));
  SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const lire = (f) => { try { return fs.readFileSync(path.join(SRC, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const url = (f) => require('url').pathToFileURL(path.join(SRC, f)).href;

(async () => {
  let CV, B, BL;
  try { CV = await import(url('coutVente.js')); B = await import(url('beneficePaire.js')); BL = await import(url('beneficeLigne.js')); }
  catch (e) { dit(false, 'src/coutVente.js existe et se charge', e.message); console.log(`\n${ok} verts, ${ko} rouges`); process.exit(1); }

  console.log('\n── C. Le coût réel d’une vente (cascade)');
  const f1 = { buyPrice: '60', fees: '2', commission: '3', emballage: '0,80', fraisComplets: true };
  const c1 = CV.cascadeVente('120', f1);
  dit(c1.etat === 'ok' && c1.vente === 12000 && c1.achat === 6000 && c1.frais === 500 && c1.emballage === 80 && c1.benefice === 5420,
    'C1 120 € − 60 € − 5 € − 0,80 € = 54,20 €', JSON.stringify(c1));
  dit(B.beneficePaire('120', f1).benefice === 54.2, 'C2 l’emballage saisi est dans la règle du bénéfice (`coutsVente`, donc tous les totaux)', String(B.beneficePaire('120', f1).benefice));
  const c2 = CV.cascadeVente('120', { buyPrice: '60', fees: '2' });
  dit(c2.emballage === null && c2.emballageSaisi === false && c2.etat === 'partiel', 'C3 emballage vide ⇒ `null`, « non saisi » (jamais 0, jamais deviné)', JSON.stringify(c2));
  const c3 = CV.cascadeVente('120', { fees: '2', emballage: '1' });
  dit(c3.etat === 'achat' && c3.benefice === null && c3.achat === null, 'C4 prix d’achat pas saisi ⇒ bénéfice « — » (jamais un achat à 0 €)', JSON.stringify(c3));
  const c5 = CV.cascadeVente('120', { buyPrice: '60', emballage: 'un euro' });
  dit(c5.etat === 'illisible' && c5.benefice === null && c5.emballage === null && c5.emballageSaisi, 'C5 un frais illisible ⇒ « — » ; un emballage illisible n’est jamais compté', JSON.stringify(c5));
  dit(CV.cascadeVente(null, f1).etat === 'prix' && CV.cascadeVente('120', f1, { autreDevise: true }).vente === null, 'C6 prix pas lu, autre devise ⇒ rien de compté');
  dit(CV.cascadeVente('120', f1, { annulee: true }).etat === 'annulee' && CV.segmentsCascade(CV.cascadeVente('120', f1, { annulee: true })) === null, 'C7 vente annulée ⇒ pas de bénéfice, pas de barre');
  const s4 = CV.segmentsCascade(CV.cascadeVente('50', { buyPrice: '60', fees: '2', fraisComplets: true }));
  dit(s4 && s4.perte && s4.total === 6200 && !s4.segments.some((x) => x.cle === 'benefice'), 'C8 une perte : la barre mesure les coûts, le trait marque le prix (pas de segment bénéfice)', JSON.stringify(s4));
  // Une seule règle : sur 3 000 tirages, la cascade se referme sur `beneficePaire`, au centime.
  let n = 0, accord = 0, etats = 0; let s = 11;
  const alea = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const m = (p, max) => (alea() < p ? (alea() * max).toFixed(2).replace(alea() < 0.3 ? '.' : '§', ',') : '');
  for (let i = 0; i < 3000; i++) {
    const e = { buyPrice: alea() < 0.85 ? (alea() * 150).toFixed(2) : '', fees: m(0.5, 10), commission: m(0.3, 8), transportVendeur: m(0.2, 6), remboursement: m(0.1, 20), autresFrais: m(0.2, 5), emballage: m(0.5, 3), fraisComplets: alea() < 0.5 };
    const prix = (alea() * 200).toFixed(2);
    const c = CV.cascadeVente(prix, e), b = B.beneficePaire(prix, e), l = BL.beneficeLigneVente(prix, e);
    if (c.etat === l.etat) etats++;
    if (b.benefice == null) { if (c.benefice === null) accord++; n++; continue; }
    n++;
    const ferme = c.vente - c.achat - c.frais - (c.emballage ?? 0);
    if (ferme === c.benefice && Math.round(b.benefice * 100) === c.benefice && (c.emballage != null || !String(e.emballage).trim())) accord++;
  }
  dit(accord === n && n === 3000, `C9 vente − achat − frais − emballage = la règle du bénéfice, au centime : ${accord}/${n}`);
  dit(etats === 3000, `C10 même état que la ligne (\`beneficeLigneVente\`) : ${etats}/3000`);

  console.log('\n── V. La valeur du stock');
  const fiches = { a: { buyPrice: '40' }, b: { buyPrice: '25,50' }, c: {}, d: { buyPrice: 'beaucoup' }, e: { buyPrice: '0' } };
  const v1 = CV.valeurStock(['a', 'b', 'c', 'd', 'e'].map((id) => ({ id })), (it) => fiches[it.id]);
  dit(v1.centimes === 6550 && v1.n === 5 && v1.nPrix === 3 && v1.nSans === 2, 'V1 Σ des prix SAISIS ; absent ou illisible ⇒ « sans prix », jamais sommé ; 0 € saisi compte', JSON.stringify(v1));
  const t1 = CV.texteValeurStock(v1);
  dit(t1.auMoins && t1.montant === '65,50 €' && t1.sur === 'sur 5 paires' && t1.sans === '2 sans prix', 'V2 « au moins 65,50 € · sur 5 paires · 2 sans prix »', JSON.stringify(t1));
  const v2 = CV.valeurStock([{ id: 'c' }, { id: 'x' }], (it) => fiches[it.id]);
  dit(v2.centimes === null && CV.texteValeurStock(v2).montant === '—', 'V3 aucun prix saisi ⇒ « — » (pas su ≠ 0 €)', JSON.stringify(v2));
  dit(CV.valeurStock([], () => ({})).centimes === 0 && CV.texteValeurStock(CV.valeurStock([{ id: 'a' }], (it) => fiches[it.id])).auMoins === false, 'V4 aucune paire ⇒ 0 € connu ; tout saisi ⇒ pas de « au moins »');
  dit(CV.texteValeurStock(CV.valeurStock([{ id: 'a' }], (it) => fiches[it.id]), { partiel: true }).auMoins, 'V5 une lecture d’annonces manque ⇒ « au moins »');
  const cinquante = Array.from({ length: 50 }, (_, i) => ({ id: 'p' + i, title: 'Nike Air Max 90 blanc 42' }));
  const v6 = CV.valeurStock(cinquante, (it) => ({ buyPrice: it.id === 'p7' ? '' : '30' }));
  dit(v6.n === 50 && v6.nPrix === 49 && v6.centimes === 147000 && v6.nSans === 1, 'V6 50 paires identiques : chacune par SON id (aucune ressemblance)', JSON.stringify({ n: v6.n, nPrix: v6.nPrix, c: v6.centimes }));

  console.log('\n── E. Les écrans');
  const A = sansCommentaires(lire('App.jsx'));
  const CSS = lire('styles-cout-vente.css');
  const CJ = sansCommentaires(lire('CascadeVente.jsx'));
  dit(/const cv = cascadeVente\(o\.price\?\.amount, e, \{ annulee: st === 'cancelled', autreDevise \}\);/.test(A) && /<BarreCoutVente c=\{cv\}\/>/.test(A), 'E1 la fiche de vente rend la cascade (règle du bénéfice décomposée) et sa barre');
  dit(/data-recap-emballage=/.test(A) && /<SaisieEmballage onSaisir=\{v=>setSaleOverride\(o\.transaction_id,\{emballage:v\}\)\}\/>/.test(A), 'E2 « Emballage · non saisi » est la porte : elle écrit la fiche de CETTE vente (`saleOv`)');
  dit(/data-cv-emballage-saisir/.test(CJ) && />non saisi</.test(CJ) && /centimes\(t\) == null/.test(CJ), 'E3 la porte nomme le manque ; un montant illisible n’est jamais enregistré');
  dit(/\.vrm-cv-porte[\s\S]*?color: var\(--vrm-warn/.test(CSS) && !/#D70015|#FF3B30|#FF453A|#FF6961|\bred\b/i.test(CSS), 'E4 ambre pour le geste et la perte, jamais rouge');
  dit(/\.vrm-cv-seg\.is-benefice[^{]*\{ background: var\(--vrm-accent/.test(CSS) && /tabular-nums/.test(CSS), 'E5 une couleur d’accent (le bénéfice), le reste neutre ; chiffres alignés');
  const nCalc = (A.match(/valeurStock\(annoncesPresentes,/g) || []).length;
  dit(nCalc === 1 && /fusionEntreeVente\(numeros\[it\.id\] \|\| \{\}, null, buyByNum\)/.test(A), 'E6 la valeur est calculée UNE fois, sur `annoncesPresentes`, prix lu comme pour une vente');
  dit((A.match(/publierValeurStock\(/g) || []).length === 1, 'E7 un seul propriétaire publie `vrm_valeur_stock`');
  const ST = sansCommentaires(lire('ecrans/Stats.jsx')), SK = sansCommentaires(lire('ecrans/Stock.jsx'));
  dit(/useValeurStock\(/.test(ST) && /useValeurStock\(/.test(SK) && !/valeurStock\(|buyPrice/.test(ST.slice(ST.indexOf('label="Valeur du stock"') - 400, ST.indexOf('label="Valeur du stock"') + 600)), 'E8 Statistiques et Stock LISENT la valeur publiée, ne la recalculent pas');
  dit(/value=\{valeurStk && valeurStk\.centimes != null \?/.test(ST) && /onClick=\{valeurStk && valeurStk\.nSans \? versSaisiePrix : null\}/.test(ST), 'E9 Statistiques : « — » si pas su ; « N sans prix » ouvre la saisie en série');
  dit(/<ValeurStockCarte v=\{valeurStk\} onSaisir=\{saisirPrixStock\}( mots=\{motsStock\})?\/>/.test(SK) && /DEMANDE_SAISIE_PRIX\.on = true/.test(SK), 'E10 Stock : le widget, sa porte vers la saisie en série');
  dit(!/stockValue/.test(A) && !/stockValue/.test(ST), 'E11 l’ancien total sans couverture (`stockValue`) a disparu (une règle par notion)');
  dit(/'Autres frais','Emballage','Frais confirmés'/.test(A), 'E12 l’export CSV porte la colonne Emballage (une par champ de frais)');

  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
