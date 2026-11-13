// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : ACHATS PRÊTS À CONFIRMER + « EXPORTER POUR MON COMPTABLE » (9 novembre)
//         node scripts/audit-achats-export.cjs [--mutation=NOM]
//         node scripts/audit-achats-export.cjs --prouve   (chaque mutation doit rougir)
// ═══════════════════════════════════════════════════════════════════════════
// Sur des ventes et des achats INVENTÉS (le dépôt est public), il EXÉCUTE :
//   App.jsx `declarablesCompta` → `ventesDeclarables` → `caDeclarableParMois`,
//   `montantPeriodeUrssaf`, `aPayerUrssaf` (extraits, dans un vm) ;
//   src/registres.js (`livreDesRecettes`, `registreDesAchats`, le trimestre) ;
//   src/prixAchatPropose.js (`propositionPrixAchat`, `texteProposition`) ;
//   src/exportComptable.js (données, tableur relu, PDF relu par pdf.js).
// Il exige :
//   P1. la proposition dit « Payé sur Vinted : 85,40 € » quand le reçu tombe juste,
//       « Article seul sur Vinted » sinon (jamais présenté comme payé) ;
//   P2. AUCUN coût n'est écrit sans SON clic : dans la saisie en série, l'écriture
//       (`appliquerProposition`) ne part que d'un onClick (« Garder ») ou après la
//       confirmation de « Tout garder » ; « Corriger » n'écrit rien ;
//   P3. 50 fiches et 50 achats au MÊME titre : un seul achat a un coût saisi, celui
//       que SON n° de transaction relie ; une seule proposition, celle du lien ;
//   E1. le CA déclaré de l'export = la ligne publiée (le même total que la carte
//       « Prochaine déclaration », `montantPeriodeUrssaf`) — mois, trimestre, année ;
//   E2. les ventes listées = le livre des recettes de la période (même total) ;
//       datées au VERSEMENT : vendue en septembre, versée en octobre ⇒ 4e trimestre ;
//   E3. l'URSSAF n'est calculée que pour un micro-entrepreneur ; régime `null` ou
//       autre ⇒ non calculée, et dit ;
//   E4. une vente « à dater » est listée À PART, dans aucun total ; un compte exclu
//       n'est nulle part ;
//   E5. la couverture : « N achats sans coût saisi » ;
//   E6. le tableur : BOM, « ; », virgule décimale, relu = mêmes totaux ; le PDF :
//       UNE page, le même CA ; jamais « encaissé » ;
//   E7. la carte de Comptabilité appelle les MÊMES lectures (`recettesDe`,
//       `registreAchatsDe`, `montantPeriodeUrssaf`, `aPayerUrssaf`) et n'écrit rien.
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const R0 = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R0, f), 'utf8'); } catch (_) { return ''; } };
let APP = lire('src/App.jsx'), REG = lire('src/registres.js'), PRIX = lire('src/prixAchatPropose.js'), EXP = lire('src/exportComptable.js');
const VC = lire('api/_lib/vestiaire-regle.js');
const SRC = { app: () => APP, reg: () => REG, prix: () => PRIX, exp: () => EXP };
const muter = (q, avant, apres) => {
  const s = SRC[q]();
  if (!s.includes(avant)) { console.log('❌ mutation impossible : motif absent — ' + avant.slice(0, 90)); process.exit(2); }
  const t = s.replace(avant, apres);
  if (q === 'app') APP = t; else if (q === 'reg') REG = t; else if (q === 'prix') PRIX = t; else EXP = t;
};
const MUTATIONS = {
  // La proposition écrite toute seule à l'affichage.
  'garder-auto': ['app', "const tp=texteProposition(pp); if(!pp||!tp) return null;", "const tp=texteProposition(pp); if(!pp||!tp) return null; appliquerProposition('f:'+r.key, pp);"],
  // « Article seul » présenté comme payé.
  'article-paye': ['prix', "libelle: recu ? 'Payé sur Vinted' : 'Article seul sur Vinted',", "libelle: 'Payé sur Vinted',"],
  // Le coût deviné depuis le montant lu.
  'cout-devine': ['exp', "saisi: l.saisi == null ? null : l.saisi,", "saisi: l.saisi == null ? l.montant : l.saisi,"],
  // Le lien achat ↔ fiche par TITRE.
  'lien-titre': ['reg', "const k = String(e.buyFromId).trim();\n    parTx.set(k,", "const k = String(e.title || '').trim();\n    parTx.set(k,"],
  // L'URSSAF calculée quel que soit le statut.
  'urssaf-toujours': ['exp', "const micro = regime === 'micro';", "const micro = true;"],
  // Les « à dater » glissées dans les ventes de la période.
  'adater-dedans': ['exp', "const ventes = recettes ? recettes.lignes.map((l) => ({", "const ventes = recettes ? [...recettes.lignes, ...recettes.horsPeriode].map((l) => ({"],
  // Le trimestre réduit à son premier mois.
  'trimestre': ['reg', "const a = t ? de + 2 : (s.length === 4 ? 12 : de);", "const a = t ? de : (s.length === 4 ? 12 : de);"],
  // Le CA déclaré recalculé depuis les ventes listées (et non la ligne publiée).
  'ca-recalcule': ['exp', "const caDeclare = tot && tot.ca != null ? tot.ca : null;", "const caDeclare = recettes ? recettes.total : null;"],
};
if (MUT) { const m = MUTATIONS[MUT]; if (!m) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); } muter(...m); }
if (process.argv.includes('--prouve')) {
  const { spawnSync } = require('child_process');
  let pris = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8', env: process.env });
    const rouges = (r.stdout.match(/^ {2}❌ /gm) || []).length;
    const okM = r.status !== 0 && rouges > 0; if (okM) pris++;
    console.log(`${okM ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
  }
  console.log(`\n${pris}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(pris === Object.keys(MUTATIONS).length ? 0 : 1);
}
function extraire(src, nom) {
  const m = new RegExp(`^(?:async )?function ${nom}\\(|^const ${nom}\\s*=\\s*`, 'm').exec(src);
  if (!m) return '';
  const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const NM = (() => { try { return fs.realpathSync(path.join(R0, 'node_modules')); } catch (_) { return path.join(__dirname, '..', 'node_modules'); } })();

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-achats-export-'));
  let REGM = null, PRM = null, EXM = null, V = null;
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(dir, 'prixAchatPropose.js'), PRIX); fs.copyFileSync(path.join(R0, 'src', 'modePaiement.js'), path.join(dir, 'modePaiement.js'));   // (11 nov.) importé par registres.js
    fs.writeFileSync(path.join(dir, 'dateParis.js'), lire('src/dateParis.js'));
    fs.writeFileSync(path.join(dir, 'sommeConnue.js'), lire('src/sommeConnue.js'));   // (11 nov.) importé par exportComptable.js   // (11 nov.) jour/mois de Paris, importé par registres.js
    fs.writeFileSync(path.join(dir, 'registres.js'), REG);
    fs.writeFileSync(path.join(dir, 'profilVendeur.js'), lire('src/profilVendeur.js'));   // (11 nov., 5.355) importé par registres.js (« paire » / « article »)
    fs.writeFileSync(path.join(dir, 'exportComptable.js'), EXP);
    fs.writeFileSync(path.join(dir, 'factureAchat.js'), lire('src/factureAchat.js'));   // (11 nov.) importé par exportComptable.js (mentionFacture)
    fs.writeFileSync(path.join(dir, 'vestiaire-regle.js'), VC.replace(/from '\.\/([^']+)\.js'/g, (x, n) => `from '${path.join(R0, 'api', '_lib', n + '.js').replace(/\\/g, '/')}'`));
    PRM = await import('file://' + path.join(dir, 'prixAchatPropose.js'));
    REGM = await import('file://' + path.join(dir, 'registres.js'));
    EXM = await import('file://' + path.join(dir, 'exportComptable.js'));
    V = await import('file://' + path.join(dir, 'vestiaire-regle.js'));
  } catch (e) { dit(false, 'les modules se chargent', e.message); }
  dit(!!EXM && typeof EXM.donneesExportComptable === 'function' && typeof EXM.csvExportComptable === 'function' && typeof EXM.pdfExportComptable === 'function', 'src/exportComptable.js : données, tableur et PDF existent');
  dit(!!PRM && typeof PRM.texteProposition === 'function', 'src/prixAchatPropose.js : texteProposition existe');
  if (!EXM || !PRM || !REGM || typeof EXM.donneesExportComptable !== 'function' || typeof PRM.texteProposition !== 'function') { console.log(`\n❌ achats-export : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }

  // ── P1. Le texte de la proposition ─────────────────────────────────────────
  const achat = (tx, eur, titre, date, statut) => ({ transaction_id: tx, title: titre, price: { amount: String(eur), currency_code: 'EUR' }, status: statut || 'Transaction finalisée', date });
  const venti = { trouve: true, somme: 'juste', paye: 8540, lignes: [{ libelle: 'Article', centimes: 8000 }, { libelle: 'Frais de port', centimes: 340 }, { libelle: 'Frais Vinted', centimes: 200 }] };
  const pRecu = PRM.propositionPrixAchat({ identite: { achat: achat('7100001', 80, 'Nike', '2026-10-02'), par: 'lien' }, ventilationDe: () => venti });
  const pArt = PRM.propositionPrixAchat({ identite: { achat: achat('7100002', 80, 'Nike', '2026-10-02'), par: 'lien' }, ventilationDe: () => null });
  const tR = PRM.texteProposition(pRecu), tA = PRM.texteProposition(pArt);
  const nb = (s) => String(s || '').replace(/[  ]/g, ' ');
  dit(!!tR && tR.libelle === 'Payé sur Vinted' && nb(tR.montant) === '85,40 €' && /Frais de port 3,40/.test(nb(tR.detail)) && /Frais Vinted 2,00/.test(nb(tR.detail)), 'P1 · reçu juste : « Payé sur Vinted : 85,40 € », article + port + frais Vinted détaillés', tR && `${tR.libelle} ${nb(tR.montant)} · ${nb(tR.detail)}`);
  dit(!!tA && tA.libelle === 'Article seul sur Vinted' && /port/.test(tA.detail), 'P1 · sans reçu : « Article seul sur Vinted » (le port et les frais manquent, dit)', tA && `${tA.libelle} · ${tA.detail}`);
  dit(!!tR && tR.garder === 'Garder' && tR.corriger === 'Corriger', 'P1 · deux gestes : « Garder » et « Corriger »');
  dit(PRM.texteProposition(null) === null, 'P1 · aucune proposition ⇒ rien à dire');

  // ── P2. Aucun coût écrit sans SON clic (la saisie en série, App.jsx) ──────
  const app = sansCommentaires(APP);
  const i0 = app.indexOf('data-fillbuy-feuille'), i1 = i0 >= 0 ? app.indexOf('{/* ', i0 + 50) : -1;
  const feuille = i0 >= 0 ? app.slice(i0, app.indexOf('data-fillbuy-piste', i0) > 0 ? app.indexOf('data-fillbuy-piste', i0) : i0 + 20000) : '';
  const appels = feuille.match(/appliquerProposition\([^)]*\)/g) || [];
  const dansClic = (feuille.match(/onClick=\{\(\)=>appliquerProposition\(/g) || []).length;
  dit(i0 >= 0 && appels.length === 1 && dansClic === 1, 'P2 · saisie en série : l’écriture d’une proposition part SEULEMENT du clic « Garder »', `${appels.length} appel(s), ${dansClic} dans un onClick`);
  const corr = (feuille.match(/data-prix-corriger=""[^]*?<\/Bouton>/) || [''])[0];
  dit(!!corr && !/appliquerProposition|setNumeros|save\(|setBuyForKey/.test(corr) && /focus\(\)/.test(corr), 'P2 · « Corriger » n’écrit rien : il met le curseur dans le champ (vide)');
  dit(/data-tout-garder=""[^>]*onClick=\{\(\)=>validerPropositions\(cles\)\}/.test(feuille), 'P2 · « Tout garder » : un bouton, SON clic');
  const valider = sansCommentaires(extraire(APP.replace(/^  const validerPropositions/m, 'const validerPropositions'), 'validerPropositions'));
  const iAsk = valider.indexOf('askConfirm('), iBoucle = valider.indexOf('appliquerProposition(');
  dit(iAsk > 0 && iBoucle > iAsk && /if \(!ok\) return;/.test(valider), 'P2 · « Tout garder » écrit APRÈS la confirmation qui liste chaque N° (annuler ⇒ rien)');
  dit(!/save\(|setNumeros|localStorage|fetch\(/.test(sansCommentaires(PRIX)), 'P2 · src/prixAchatPropose.js n’écrit rien (règles pures)');

  // ── P3. 50 fiches et 50 achats au MÊME titre ───────────────────────────────
  const T50 = 'Nike Air Max 90 blanche taille 42';
  const achats50 = Array.from({ length: 50 }, (_, i) => ({ ...achat(String(7200000 + i), 40 + (i === 13 ? 11.3 : 0), T50, new Date(2026, 9, 5, 12).toISOString()), compte: 'atelier', _uid: '111' }));
  const fiches50 = {};
  for (let i = 0; i < 50; i++) fiches50['it' + i] = { numero: String(100 + i), title: T50, buyPrice: '' };
  fiches50.it37 = { ...fiches50.it37, buyFromId: '7200013', buyPrice: '42,00' };   // SON lien, SON prix
  const R50 = REGM.registreDesAchats({ achats: achats50, fiches: fiches50, periode: '2026-10' });
  const avecSaisi = R50.lignes.filter((l) => l.saisi != null);
  dit(R50.n === 50 && avecSaisi.length === 1 && avecSaisi[0].reference === '7200013' && avecSaisi[0].saisi === 42 && avecSaisi[0].num === '137', 'P3 · 50 achats identiques : UN seul porte un coût saisi, celui que SON n° relie (N°137, 42,00 €)', `${avecSaisi.length} · ${avecSaisi.map((l) => l.reference + '/' + l.num + '/' + l.saisi).join(',')}`);
  dit(R50.lignes.filter((l) => l.num).length === 1, 'P3 · aucun autre achat ne reçoit un N° par ressemblance');
  const D50 = EXM.donneesExportComptable({ periode: '2026-10', recettes: null, achats: R50, ligne: null, regime: 'micro', taux: 12.4, maintenant: new Date(2026, 10, 9).getTime() });
  dit(D50.sansCout === 49 && D50.coutSaisi === 42, 'P3/E5 · l’export dit « 49 achats sans coût saisi » et 42,00 € saisis', `${D50.sansCout} · ${D50.coutSaisi}`);
  dit(EXM.couvertureExport(D50).some((c) => /^49 achats sans coût saisi$/.test(c)), 'E5 · la couverture le NOMME');
  // Une seule proposition : la fiche reliée par son clic, sans prix.
  const fichesP = { ...fiches50, it5: { ...fiches50.it5, buyFromId: '7200020' } };
  const lignesP = Object.entries(fichesP).map(([k, e]) => {
    const lie = e.buyFromId ? achats50.find((a) => a.transaction_id === e.buyFromId) : null;
    const identite = PRM.achatParIdentite({ lie, photo: null, achats: achats50, cleDePhoto: () => '' });
    return { cle: 'f:' + k, proposition: PRM.propositionPrixAchat({ prixConnu: !!String(e.buyPrice || '').trim(), identite, ventilationDe: () => null }) };
  });
  const props = PRM.propositionsUniques(lignesP);
  dit(props.size === 1 && props.has('f:it5') && props.get('f:it5').tx === '7200020', 'P3 · une seule proposition : la fiche que SON lien désigne (jamais par le titre)', [...props.keys()].join(','));

  // ── La chaîne des ventes de l'app ───────────────────────────────────────────
  const NOMS = ['classifyOrderStatus', 'venteFinalisee', 'tsCommande', 'montantCommandeLu', 'ymDeTs', 'indexDeclarations', 'moisDeclare', 'lbcAnnulee', 'lbcFinalisee',
    'commandeEbayEngagee', 'montantRecuEbay', 'compteEcarteChoix', 'compteEcarteRegle', 'compteEcarte', 'phraseNonComptees', 'ventesDeclarables', 'declarablesCompta', 'caDeclarableParMois',
    'moisPeriodeUrssaf', 'minuitParisMs', 'montantPeriodeUrssaf', 'tauxDe', 'aPayerUrssaf', 'regimeValide', 'REGIMES_FISCAUX', 'libelleRegime', 'TAUX_URSSAF_DEFAUT'];
  const ctx = { Date, Math, Number, String, Object, Array, JSON, Map, Set, Intl, isFinite, parseFloat, isNaN, console, RAISON_NON_COMPTEE: {},
    // (9 nov.) `compteEcarte` = `compteEcarteRegle(…, reglePlanCourante())` (offre Solo) : règle « pas sue » ⇒ rien bridé.
    venteHorsPlan: () => false, reglePlanCourante: () => null };
  if (V) Object.assign(ctx, { vcVenteAnnulee: V.vcVenteAnnulee, montantRecuVc: V.montantRecuVc, dateVersementVc: V.dateVersementVc, etapeMotVc: V.etapeMotVc, dateVenteVc: V.dateVenteVc });
  vm.createContext(ctx);
  const absents = [];
  for (const n of NOMS) { const t = extraire(APP, n); if (!t) { absents.push(n); continue; } try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (e) { absents.push(n + ' (' + e.message + ')'); } }
  dit(!absents.length, 'la chaîne de l’app se lit (ventesDeclarables, caDeclarableParMois, montantPeriodeUrssaf, aPayerUrssaf)', absents.join(', '));
  if (absents.length) { console.log(`\n❌ achats-export : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }

  const D = (m, j, h = 12) => new Date(2026, m, j, h).toISOString();
  const vinted = (uid, tx, eur, date, titre) => ({ transaction_id: tx, id: tx, title: titre || 'Baskets inventées', price: { amount: String(eur), currency_code: 'EUR' }, status: 'Commande finalisée', date, _acc: { vinted_user_id: uid, login: 'compte_' + uid } });
  const ventes = [
    vinted('111', 9101, 50, D(8, 28)),      // vendue en septembre, VERSÉE le 2 octobre ⇒ T4
    vinted('111', 9102, 60.4, D(9, 3)),     // octobre, versée le 6
    vinted('111', 9103, 70, D(10, 4)),      // novembre, SANS versement ⇒ à dater
    vinted('333', 9104, 99, D(10, 5)),      // compte EXCLU
    vinted('111', 9105, 30, D(10, 6)),      // novembre, versée le 9
    vinted('111', 9106, 44, D(7, 10)),      // août, versée en août ⇒ T3
  ];
  const versements = { 9101: D(9, 2), 9102: D(9, 6), 9104: D(10, 7), 9105: D(10, 9), 9106: D(7, 12) };
  const lbc = [{ txId: 'L1', isSeller: true, price: 4000, dateVente: D(10, 5), stepStatus: 'done', title: 'Baskets LBC', account: 'lbc-account:A' }];
  const { decl, manque } = ctx.declarablesCompta({ ventes, ko: [], lbc, ebay: [], vestiaire: [], rates: [], versements, hTx: new Set(), hAcc: new Set(['333']), panelOff: {}, excluAutre: () => false });
  // La ligne publiée, comme l'écran Ventes la fabrique (`caDeclarableParMois` des mêmes lignes).
  const mois = Object.values(ctx.caDeclarableParMois(decl.lignes)).map((m) => ({ ym: m.ym, n: m.n, ca: Math.round(m.ca * 100) / 100 }));
  const ligne = { mois, aDater: { n: decl.aDater.length }, nonComptees: { n: 0 }, at: new Date(2026, 11, 2).getTime() };
  const maintenant = new Date(2026, 10, 20).getTime();
  const exporter = (periode, regime) => {
    const recettes = REGM.livreDesRecettes({ decl, periode, compteDe: (id) => { const l = [...decl.lignes, ...decl.aDater].find((x) => x.id === id); return l && l.o ? l.o._acc.login : ''; }, manque });
    const achatsR = REGM.registreDesAchats({ achats: [{ ...achat('7300001', 35, 'Achat inventé', D(9, 4)), compte: 'compte_111', _uid: '111' }, { ...achat('7300002', 22, 'Achat inventé', D(9, 8)), compte: 'compte_111', _uid: '111' }, { ...achat('7300003', 18, 'Achat exclu', D(9, 9)), compte: 'compte_333', _uid: '333' }],
      fiches: { a: { numero: '5', buyFromId: '7300001', buyPrice: '35' } }, periode, exclu: (o) => o._uid === '333' });
    return { recettes, d: EXM.donneesExportComptable({ periode, recettes, achats: achatsR, ligne, regime, taux: 12.4, montantPeriode: ctx.montantPeriodeUrssaf, aPayer: ctx.aPayerUrssaf, libelleRegime: ctx.libelleRegime, maintenant }) };
  };
  const cents = (x) => (x == null ? null : Math.round(x * 100));
  for (const [periode, attenduCa, nVentes] of [['2026-T4', 50 + 60.4 + 30 + 40, 4], ['2026-10', 110.4, 2], ['2026', 50 + 60.4 + 30 + 40 + 44, 5], ['2026-T3', 44, 1]]) {
    const { recettes, d } = exporter(periode, 'micro');
    const B = EXM.bornesPeriode(periode);
    const carte = ctx.montantPeriodeUrssaf(B, ligne, 12.4);
    dit(cents(d.caDeclare) === cents(attenduCa) && cents(d.caDeclare) === cents(carte.ca), `E1 · ${periode} : CA déclaré = la ligne publiée = la carte « Prochaine déclaration »`, `${d.caDeclare} · attendu ${attenduCa} · carte ${carte.ca}`);
    dit(d.caParMois && cents(d.caParMois.reduce((t, m) => t + m.ca, 0)) === cents(d.caDeclare), `E1 · ${periode} : les mois listés somment au CA de la période`);
    dit(cents(d.totalVentes) === cents(recettes.total) && d.nVentes === recettes.n && d.nVentes === nVentes, `E2 · ${periode} : les ventes listées = le livre des recettes (${nVentes} ventes, même total)`, `${d.nVentes} · ${d.totalVentes}`);
    dit(cents(d.urssaf) === cents(ctx.aPayerUrssaf(d.caDeclare, 12.4)) && cents(d.urssaf) === cents(carte.apayer), `E3 · ${periode} : URSSAF (micro) = aPayerUrssaf du CA = la carte`, `${d.urssaf}`);
  }
  // E1b — une vente notée « déclarée » dans un autre mois (`vrm_urssaf_declare`) : la ligne publiée
  // la compte dans le mois de SA déclaration ; l'export suit la ligne (pas les ventes listées) et dit l'écart.
  {
    const declare = { '2026-11': { ids: ['vinted:9102'], n: 1, ca: 60.4, regle: 'versement', at: 1 } };
    const dd = ctx.ventesDeclarables({ vinted: ventes, lbc, ebay: [], vestiaire: [], exclu: (o) => o._acc.vinted_user_id === '333', versements, declare });
    const moisD = Object.values(ctx.caDeclarableParMois(dd.lignes)).map((m) => ({ ym: m.ym, n: m.n, ca: Math.round(m.ca * 100) / 100 }));
    const ligneD = { ...ligne, mois: moisD };
    const recettes = REGM.livreDesRecettes({ decl, periode: '2026-10', manque });
    const d = EXM.donneesExportComptable({ periode: '2026-10', recettes, achats: null, ligne: ligneD, regime: 'micro', taux: 12.4, montantPeriode: ctx.montantPeriodeUrssaf, aPayer: ctx.aPayerUrssaf, libelleRegime: ctx.libelleRegime, maintenant });
    const carte = ctx.montantPeriodeUrssaf(EXM.bornesPeriode('2026-10'), ligneD, 12.4);
    dit(cents(d.caDeclare) === 5000 && cents(carte.ca) === 5000, 'E1 · une vente déclarée en novembre sort du CA d’octobre : l’export suit la ligne publiée (50,00 €), comme la carte', `${d.caDeclare} · carte ${carte.ca}`);
    dit(EXM.couvertureExport(d).some((c) => /diffèrent/.test(c)), 'E1 · l’écart entre les ventes listées et le CA déclaré est DIT');
  }
  const { d: T4 } = exporter('2026-T4', 'micro');
  dit(T4.ventes.some((v) => v.id === 'vinted:9101') && !exporter('2026-T3', 'micro').d.ventes.some((v) => v.id === 'vinted:9101'), 'E2 · vendue en septembre, versée en octobre ⇒ 4e trimestre, pas le 3e');
  const v9101 = T4.ventes.find((v) => v.id === 'vinted:9101');
  dit(!!v9101 && v9101.dateVente === '28/09/2026' && v9101.dateVersement === '02/10/2026' && v9101.compte === 'compte_111', 'E2 · la ligne dit la date de vente ET la date de versement, et le compte', v9101 && `${v9101.dateVente} → ${v9101.dateVersement} · ${v9101.compte}`);
  const vL1 = T4.ventes.find((v) => v.id === 'lbc:L1');
  dit(!!vL1 && /pas captée/.test(vL1.dateVersement), 'E2 · Leboncoin : « date de versement pas captée (datée à la vente) », jamais une date inventée', vL1 && vL1.dateVersement);
  dit(T4.aDater.length === 1 && T4.aDater[0].id === 'vinted:9103' && !T4.ventes.some((v) => v.id === 'vinted:9103'), 'E4 · la vente sans date de versement : à part (« à dater »), hors des ventes et du total');
  dit(!JSON.stringify(T4).includes('9104') && !JSON.stringify(T4).includes('7300003'), 'E4 · le compte exclu n’est nulle part (ni vente, ni achat)');
  dit(T4.nAchats === 2 && T4.sansCout === 1, 'E5 · achats : 2, dont 1 sans coût saisi', `${T4.nAchats} · ${T4.sansCout}`);
  {
    const R0a = REGM.registreDesAchats({ achats: achats50.slice(0, 3), fiches: {}, periode: '2026-10' });
    const d0 = EXM.donneesExportComptable({ periode: '2026-10', achats: R0a, maintenant });
    const v = (EXM.resumeExport(d0).find(([, , k]) => k === 'cout') || [])[1];
    dit(d0.coutSaisi == null && v === '—' && !/au moins 0,00/.test(EXM.csvExportComptable(d0) + JSON.stringify(EXM.resumeExport(d0))), 'E5 · aucun coût saisi : « — », jamais « au moins 0,00 € »', v);
  }
  for (const r of [null, 'particulier', 'societe', 'marge']) {
    const { d } = exporter('2026-T4', r);
    dit(d.urssaf == null && !!d.raisonUrssaf && d.caDeclare != null && EXM.resumeExport(d).some(([k, v]) => k === 'URSSAF' && v === 'non calculée'), `E3 · statut ${r === null ? 'pas choisi' : r} : URSSAF non calculée, et dit pourquoi`, d.raisonUrssaf);
  }

  // ── E6. Le tableur et le PDF ────────────────────────────────────────────────
  const csv = EXM.csvExportComptable(T4);
  dit(csv.charCodeAt(0) === 0xfeff && csv.includes(';') && /\r\n/.test(csv), 'E6 · tableur : BOM UTF-8, « ; », fins de ligne CRLF');
  const L = csv.replace(/^﻿/, '').split('\r\n').map((l) => l.split(';'));
  const iCa = L.findIndex((r) => /^CA DÉCLARÉ PAR MOIS/.test(r[0]));
  const tot = L.slice(iCa).find((r) => r[0] === 'Total');
  dit(!!tot && tot[2] === T4.caDeclare.toFixed(2).replace('.', ','), 'E6 · tableur : le total du CA déclaré, virgule décimale, = l’export', tot && tot[2]);
  const iV = L.findIndex((r) => r[0] === 'Date de vente' && r[1] === 'Date de versement');
  dit(iV > 0 && L[iV].includes('Montant reçu (€)') && L[iV].includes('Plateforme') && L[iV].includes('Compte'), 'E6 · tableur : ventes avec date de vente, date de versement, plateforme, compte, montant reçu');
  dit(/VENTES À DATER/.test(csv) && /ACHATS DE LA PÉRIODE/.test(csv) && L.some((r) => r.includes('Coût saisi (€)')), 'E6 · tableur : « à dater » à part, achats avec « Coût saisi »');
  let pdfT = '', pages = 0; const parPage = [];
  try {
    const PDFLib = require(path.join(NM, 'pdf-lib'));
    const oct = await EXM.pdfExportComptable(T4, { PDFLib });
    const pdfjs = await import('file://' + path.join(NM, 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'));
    const doc = await pdfjs.getDocument({ data: new Uint8Array(oct), isEvalSupported: false, useSystemFonts: false, standardFontDataUrl: path.join(NM, 'pdfjs-dist', 'standard_fonts') + '/' }).promise;
    pages = doc.numPages;
    for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const tc = await p.getTextContent(); const t = tc.items.map((x) => x.str).join(' '); parPage.push(t.replace(/\s+/g, ' ')); pdfT += t + '\n'; }
  } catch (e) { dit(false, 'E6 · le PDF se crée et se relit', e.message); }
  const caTxt = T4.caDeclare.toFixed(2).replace('.', ',');
  // (11 nov.) La 1re page est le récapitulatif ; les suivantes NOMMENT les manques (ventes à dater, achats sans coût), une ligne chacun.
  const p1 = parPage[0] || '';
  dit(p1.includes(caTxt) && /4e trimestre 2026/.test(p1) && /CA déclaré par mois/.test(p1), 'E6 · PDF : la 1re page porte le même CA déclaré et la période', `${pages} page(s)`);
  const pAD = parPage.find((t) => /^Ventes à dater/.test(t.trim())) || '';
  const pSC = parPage.find((t) => /^Achats sans coût saisi/.test(t.trim())) || '';
  dit(!T4.nADater || (new RegExp(`Ventes à dater [—-] dans aucun mois \\(${T4.nADater}\\)`).test(pAD) && T4.aDater.every((v) => !v.titre || pAD.includes(v.titre.slice(0, 12)))), 'E6 · PDF : chaque vente à dater NOMMÉE sur sa page', `${T4.nADater} à dater`);
  dit(!T4.sansCout || new RegExp(`Achats sans coût saisi \\(${T4.sansCout}\\)`).test(pSC), 'E6 · PDF : les achats sans coût NOMMÉS sur leur page', `${T4.sansCout} sans coût`);
  dit(T4.nADater > 0, 'E6 · la fixture a des ventes à dater (sinon le contrôle ne juge rien)', String(T4.nADater));
  dit(!/encaiss/i.test(csv + pdfT + sansCommentaires(EXP)), 'E6 · jamais « encaissé »');

  // ── E7. La carte de Comptabilité ────────────────────────────────────────────
  const corps = sansCommentaires(extraire(APP, 'ExportComptableCorps'));
  dit(!!corps && /recettesDe\(\{/.test(corps) && /registreAchatsDe\(\{/.test(corps) && /montantPeriode: montantPeriodeUrssaf/.test(corps) && /aPayer: aPayerUrssaf/.test(corps) && /useRegimeFiscal\(\)/.test(corps), 'E7 · la carte appelle les lectures de « Registres » et les règles du CA et de l’URSSAF');
  dit(!!corps && !/\bsave\(|setNumeros|withOwner|method: 'POST'|\.reduce\(/.test(corps), 'E7 · la carte n’écrit rien et ne recalcule aucun total');
  const carte = sansCommentaires(extraire(APP, 'RegistresCarte'));
  dit(/recettesDe\(\{/.test(carte) && /registreAchatsDe\(\{/.test(carte), 'E7 · « Registres » et l’export : la MÊME écriture (recettesDe, registreAchatsDe)');

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  console.log(ko ? `\n❌ achats-export : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ achats-export : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
