#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LOT F — LE PLANCHER SOUS UNE OFFRE et « DÉJÀ N PAIRES DE CE MODÈLE »
//         node scripts/audit-plancher-stock.cjs [--mutation=…] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/plancherOffre.js et src/dejaEnStock.js (avec les VRAIES règles de
// marque / modèle / couleur d'App.jsx, extraites dans un vm) sur des données
// INVENTÉES (le dépôt est public), et lit dans le code des écrans que :
//   P. le plancher = prix d'achat SAISI + frais connus, par la règle du bénéfice
//      (`beneficePaire`) : bénéfice < 0 ⇔ offre < plancher, au centime, sur 2 000
//      tirages ; pas de prix d'achat ⇒ AUCUN plancher (pas su ≠ 0) ; frais pas
//      confirmés ⇒ « au moins » ; offre sous ⇒ dit, ambre jamais rouge ; jamais
//      une phrase qui dit à quel prix vendre ; le prix mini sous le plancher est
//      DIT, jamais changé ; le moteur `autoAccepterOffres` n'est pas touché ;
//   S. « déjà N » : 50 paires identiques ⇒ compte 50, rien n'est écrit ni relié ;
//      marque différente, modèles connus différents, aucun mot de modèle commun,
//      taille connue différente ⇒ écartée ; la paire elle-même n'est pas comptée.
// `--mutation=…` réaffaiblit une règle dans une copie de src/ : rouge exigé.
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { execFileSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUTS = {
  'achat-zero': ["if (b.achat == null) {", "if (false) {"],
  'frais-ignores': ["const plancher = Math.round(-b.benefice * 100);", "const plancher = b.achat;"],
  'partiel-dit-exact': ["etat: b.complet && commissionLue ? 'ok' : 'partiel'", "etat: 'ok'"],
  'sous-strict': ["if (o < p.plancher) return", "if (o < p.plancher - 100) return"],
  'mini-tu': ["const miniDit = mini != null && miniSousPlancher(mini, p)", "const miniDit = false && miniSousPlancher(mini, p)"],
  'marque-ignoree': ["if (!ma || !mb || ma !== mb) return false;", "if (!ma || !mb) return false;"],
  'modele-ignore': ["if (oa && ob) return bas(oa) === bas(ob);", "if (oa && ob) return true;"],
  'sans-mot-commun': ["for (const w of wa) if (wb.has(w)) return true;\n  return false;", "return true;"],
  'taille-ignoree': ["if (ta && tb && ta !== tb) return false;", ""],
  'compte-soi': ["if (vus.has(id) || (sauf != null && id === String(sauf))) continue;", "if (vus.has(id)) continue;"],
  'ecran-rouge': ["style={sous && ambre ? { color: ambre } : undefined}", "style={sous ? { color: '#D70015' } : undefined}", 'LignePlancher.jsx'],
  'ecran-plancher-devine': ["const plancherDeItem = (item, devise = 'EUR') => (item == null || (devise || 'EUR') !== 'EUR' ? null : plancherVente(numeros[String(item)] || null));", "const plancherDeItem = (item) => plancherVente({ buyPrice: '0' });", 'App.jsx'],
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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'plancher-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  const cibles = MUTS[MUT][2] ? [MUTS[MUT][2]] : ['plancherOffre.js', 'dejaEnStock.js'];
  let fait = false;
  for (const c of cibles) {
    const f = path.join(d, 'src', c); const s = fs.readFileSync(f, 'utf8');
    if (s.includes(MUTS[MUT][0])) { fs.writeFileSync(f, s.replace(MUTS[MUT][0], MUTS[MUT][1])); fait = true; }
  }
  if (!fait) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const lire = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

// Les vraies règles de l'app (marque, modèle, couleurs), extraites dans un vm.
const APP = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
const bout = (debut, fin) => { const a = APP.indexOf(debut); const b = APP.indexOf(fin, a); if (a < 0 || b < 0) throw new Error('introuvable : ' + debut); return APP.slice(a, b + fin.length); };
const ctx = {};
vm.runInNewContext([bout('const KNOWN_BRANDS=[', '];'), bout('function extractBrand(text){', '\n}'), bout('const COULEURS = {', '\n};'),
  bout('function extractColors(text){', '\n}'), bout('const KNOWN_MODELS = [', '];'), bout('function extractModel(text){', '\n}'), bout('function contientModele(t,k){', '\n}'),
  'this.extractBrand=extractBrand; this.extractColors=extractColors; this.extractModel=extractModel;'].join('\n'), ctx);
const { extractBrand: marqueDe, extractColors: couleursDe, extractModel: modeleDe } = ctx;
const url = (f) => require('url').pathToFileURL(path.join(SRC, f)).href;

(async () => {
  const P = await import(url('plancherOffre.js'));
  const D = await import(url('dejaEnStock.js'));
  const B = await import(url('beneficePaire.js'));

  console.log('\n── P. Le plancher sous une offre');
  const f1 = { buyPrice: '55', fees: '2', autresFrais: '5', fraisComplets: true };
  const p1 = P.plancherVente(f1);
  dit(p1.etat === 'ok' && p1.plancher === 6200, 'P1 achat 55 € + frais 7 € confirmés ⇒ « en dessous de 62 € »', JSON.stringify(p1));
  const t1 = P.textePlancher(p1, { offre: 58 });
  dit(t1 && /En dessous de 62 € tu perds de l’argent/.test(t1.ligne) && t1.niveau === 'sous' && /perdre 4 €/.test(t1.offre), 'P2 offre de 58 € ⇒ « te ferait perdre 4 € »', JSON.stringify(t1));
  dit(P.textePlancher(p1, { offre: 62 }).niveau === 'dessus' && P.textePlancher(p1, { offre: 61.99 }).niveau === 'sous', 'P3 la frontière au centime : 62,00 € ne perd rien, 61,99 € perd');
  const pv = P.plancherVente({ fees: '3' });
  dit(pv.etat === 'achat' && pv.plancher == null, 'P4 aucun prix d’achat saisi ⇒ AUCUN plancher (pas su ≠ 0)', JSON.stringify(pv));
  dit(P.plancherVente(null).plancher == null && P.offreFacePlancher(10, pv) == null, 'P5 pas de fiche ⇒ rien comparé');
  dit(P.plancherVente({ buyPrice: 'quarante' }).etat === 'illisible' && P.textePlancher(P.plancherVente({ buyPrice: 'quarante' })) == null, 'P6 prix d’achat illisible ⇒ rien dit');
  const pp = P.plancherVente({ buyPrice: '40', fees: '1,50' });
  const tp = P.textePlancher(pp, { offre: 45 });
  dit(pp.etat === 'partiel' && pp.plancher === 4150 && tp.partiel && /au moins/.test(tp.precision) && tp.niveau === 'incertain', 'P7 frais pas confirmés ⇒ « au moins », une offre au-dessus n’est pas dite sans perte', JSON.stringify(tp));
  dit(/au moins 1,50 €/.test(P.textePlancher(pp, { offre: 40 }).offre), 'P8 partiel et offre dessous ⇒ « au moins » la perte');
  dit(P.plancherVente({ buyPrice: '40', fraisComplets: true }, { commissionLue: false }).etat === 'partiel', 'P9 commission de la plateforme pas lue ⇒ jamais un plancher exact');
  dit(/prix mini \(50 €\) est sous ce plancher/.test(P.textePlancher(p1, { offre: 70, mini: 50 }).mini) && !P.textePlancher(p1, { offre: 70, mini: 65 }).mini, 'P10 le prix mini sous le plancher est DIT (rien changé) ; au-dessus, rien');
  // Une seule règle : sur 2 000 tirages, bénéfice < 0 ⇔ offre < plancher.
  let accord = 0, n = 0; let s = 7;
  const alea = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (let i = 0; i < 2000; i++) {
    const e = { buyPrice: (alea() * 120).toFixed(2), fees: alea() < 0.5 ? (alea() * 10).toFixed(2) : '', commission: alea() < 0.3 ? (alea() * 8).toFixed(2) : '', transportVendeur: alea() < 0.2 ? (alea() * 6).toFixed(2) : '', fraisComplets: alea() < 0.5 };
    const offre = Math.round(alea() * 15000) / 100 + 0.01;
    const b = B.beneficePaire(offre.toFixed(2), e), p = P.plancherVente(e), f = P.offreFacePlancher(offre, p);
    if (b.benefice == null || !f) continue;
    n++; if ((b.benefice < 0) === (f.niveau === 'sous') && (f.niveau !== 'sous' || f.perte === Math.round(-b.benefice * 100))) accord++;
  }
  dit(n > 1500 && accord === n, `P11 la règle du bénéfice : ${accord}/${n} tirages — bénéfice négatif ⇔ offre sous le plancher, même perte au centime`);
  const textes = [t1, tp, P.textePlancher(pv), P.textePlancher(p1, { offre: 90, mini: 50 })].map((x) => JSON.stringify(x || ''));
  dit(!textes.some((x) => /vend[sre]? (à|a) |prix conseill|conseil|mets? (à|a) |affiche à/i.test(x)), 'P12 aucune phrase ne dit à quel prix vendre (pas un prix conseillé, §3)');

  console.log('\n── E. Les écrans');
  const LP = sansCommentaires(lire('LignePlancher.jsx'));
  dit(/sous && ambre \? \{ color: ambre \}/.test(LP) && !/#D70015|#FF6961|doublon|danger/.test(LP), 'E1 sous le plancher ⇒ ambre (C.warn), jamais rouge');
  dit(/data-plancher-saisir/.test(LP) && /if \(!onSaisir\) return null;/.test(LP), 'E2 sans prix d’achat : la porte « Saisir le prix d’achat », sinon rien');
  const A = sansCommentaires(fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8'));
  dit(/const plancherDeItem = \(item, devise = 'EUR'\) => \(item == null \|\| \(devise \|\| 'EUR'\) !== 'EUR' \? null : plancherVente\(numeros\[String\(item\)\] \|\| null\)\);/.test(A), 'E3 la fiche par IDENTITÉ (item_id) — autre devise ⇒ rien');
  dit((A.match(/<LignePlancher plancher=\{plancherDeItem\(itemF,pc\?\.devise\)\}/g) || []).length === 2, 'E4 la ligne sous l’offre du fil (extension prête ou non)');
  dit(/offreFacePlancher\(offre\.prix, plancherDeItem\(offre\.item, paire&&paire\.devise\)\)\?\.niveau==='sous'/.test(A) && /data-offre-sous-plancher="" [^>]*color:C\.warn/.test(A), 'E5 la liste : « à perte » en ambre sur l’offre sous le plancher');
  dit(!/plancherVente|plancherOffre|textePlancher|dejaEnStock/.test(fs.readFileSync(path.join(R, 'vinted-sync-extension', 'background.js'), 'utf8')), 'E6 le moteur `autoAccepterOffres` (extension) n’est pas touché');
  dit(!/setNumeros[^\n]*plancher|save\([^)]*plancher/i.test(A), 'E7 le plancher n’écrit rien');

  console.log('\n── S. « Tu as déjà N paires de ce modèle en stock »');
  const T0 = Date.parse('2026-11-09T12:00:00Z'), J = 86400e3;
  const st = (id, titre, o = {}) => ({ id, num: String(id), titre, photo: 'p/' + id + '.jpg', depuisMs: T0 - 10 * J, ...o });
  const compte = (titre, stock, o = {}) => D.pairesDuModele({ cible: { titre, ...o }, stock, marqueDe, modeleDe, couleursDe, maintenant: T0 });
  const cinquante = []; for (let i = 1; i <= 50; i++) cinquante.push(st(i, 'Nike Air Max 90 blanche taille 42'));
  const gele = JSON.stringify(cinquante);
  const r50 = compte('Nike Air Max 90 blanc 42', cinquante);
  dit(r50.n === 50 && r50.paires.length === 50, 'S1 50 paires identiques en stock ⇒ « 50 paires de ce modèle »', String(r50.n));
  dit(JSON.stringify(cinquante) === gele && !r50.paires.some((p) => 'buyFromId' in p || 'lie' in p || 'numero' in p), 'S2 rien n’est écrit ni relié (le stock est intact, aucun champ de liaison)');
  dit(D.phraseDejaEnStock(50) === 'Tu as déjà 50 paires de ce modèle en stock' && D.phraseDejaEnStock(1, { autres: true }) === 'Tu as déjà 1 autre paire de ce modèle en stock' && D.phraseDejaEnStock(0) === '', 'S3 la phrase (et rien à zéro)');
  dit(compte('Adidas Air Max 90 blanc 42', cinquante).n === 0, 'S4 marque différente ⇒ écartée');
  dit(compte('Nike Air Force 1 blanche 42', cinquante).n === 0, 'S5 deux modèles connus et différents (Air Force 1 / Air Max 90) ⇒ écartée');
  dit(compte('Nike blanche 42', cinquante).n === 0 && compte('Nike Pegasus noire 42', [st(1, 'Nike Vomero noire 42')]).n === 0, 'S6 aucun mot de modèle commun (une couleur ne compte pas) ⇒ écartée');
  dit(compte('Nike Air Max 90 blanc 43', cinquante).n === 0, 'S7 taille connue des deux côtés et différente ⇒ écartée');
  dit(compte('Nike Air Max 90 blanc', cinquante).n === 50 && compte('Nike Air Max 90 blanc', cinquante).paires[0].taille === '42', 'S8 taille inconnue d’un côté ⇒ comptée, la taille de la paire est dite');
  dit(compte('Nike Air Max 90 blanc 42', cinquante, {}).paires.every((p) => p.jours === 10 && p.num && p.photo), 'S9 chaque paire : N°, photo, taille, « en ligne depuis 10 j »');
  dit(D.pairesDuModele({ cible: { titre: 'Nike Air Max 90 blanc 42' }, stock: cinquante, sauf: 7, marqueDe, modeleDe, couleursDe }).n === 49, 'S10 la paire dont on confirme le prix n’est pas comptée (« 49 autres »)');
  dit(compte('Nike Air Max 90 42', [st(1, 'Air Max 90 blanche 42', { marque: 'Nike' })]).n === 1, 'S11 la marque lue sur l’annonce (champ) compte');
  dit(compte('', cinquante).n === 0 && compte('Nike Air Max 90', null).n === 0, 'S12 rien saisi / stock pas lu ⇒ rien dit');
  dit(compte('Nike Air Max 90 42', [...cinquante.slice(0, 3), ...cinquante.slice(0, 3)]).n === 3, 'S13 une paire n’est comptée qu’une fois');
  const AC = sansCommentaires(fs.readFileSync(path.join(SRC, 'ecrans', 'Achats.jsx'), 'utf8'));
  const DJ = sansCommentaires(lire('DejaEnStock.jsx'));
  dit(/pairesDuModele\(\{ cible: \{ titre: titreForm \}, stock, marqueDe: extractBrand, modeleDe: extractModel, couleursDe: extractColors \}\)/.test(AC) && /<DejaEnStock r=\{dejaStock\}/.test(AC), 'S14 saisie d’un achat hors plateforme : la suggestion pendant la frappe');
  dit(/stock: stockPourModele, sauf: r\.key/.test(A), 'S15 « Prix d’achat à compléter » : les AUTRES paires du modèle sous la proposition');
  dit(!/onClick|fetch|save\(|set[A-Z]/.test(DJ) && /<details/.test(DJ), 'S16 la liste ne porte aucun geste ni aucune écriture (toucher déplie, c’est tout)');

  console.log(`\n${ko ? '❌' : '✅'} audit-plancher-stock : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
