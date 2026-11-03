#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — SUGGESTIONS D'ACHAT À RELIER (3 nov., src/suggestionsAchat.js)
//        node scripts/audit-suggestions-achat.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// Julien (14 h 12-14 h 14) : des SUGGESTIONS pour relier une annonce / une vente
// à un achat — marque (obligatoire) + taille (obligatoire si connue des deux
// côtés) + couleur, achat antérieur, pas déjà relié, pas remboursé ; jamais la
// marque seule ; la photo ne compte pas ; « Voir tous les achats » (pas les
// reliés, sauf un LOT jusqu'à son nombre d'articles) ; le prix d'un article de
// lot est SAISI, jamais deviné. Rien n'est relié sans son tap : le module
// n'écrit rien, et `ecritureLot` ne rend rien sans saisie.
// La marque et les couleurs sont celles de l'APP (extractBrand / extractColors,
// extraites de src/App.jsx et exécutées), pas une copie.
// --prouve : chaque mutation de la règle DOIT rougir.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'marque-ignoree': ["if (bas(marqueDe(t)) !== marque) continue;", ''],
  'taille-ignoree': ["if (!ta || ta !== taille) continue;", ''],
  'couleur-ignoree': ["if (!cs.some((c) => couleurs.includes(c))) continue; rang = 1;", 'rang = 1;'],
  'posterieur': ["if (!Number.isFinite(da) || (Number.isFinite(ref) && !(da < ref))) continue;", ''],
  'modele-ignore': ["if (modele && mo && mo !== modele) continue;", ''],
  'deja-relie': ["if (!n) return true;", 'return true;'],
  'rembourse': ["if (!a || !txDe(a) || achatAnnule(a) || !achatDisponible(a, liens, cible.curTx)) continue;\n    const t", "if (!a || !txDe(a) || !achatDisponible(a, liens, cible.curTx)) continue;\n    const t"],
  'lot-sans-fin': ["return l.lot && (l.n == null || n < l.n);", 'return l.lot;'],
  'prix-lot-devine': ["if (!String(saisi == null ? '' : saisi).trim() || !Number.isFinite(v) || v <= 0) return null;", "if (!Number.isFinite(v) || v <= 0) { const p = prixDe(achat), l0 = lotDe(achat); if (p == null || !l0.n) return null; return ecritureLot(achat, String(p / l0.n), { accNom, photo }); }"],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let MOD = path.join(R, 'src', 'suggestionsAchat.js');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sugg-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true, filter: (s) => !/node_modules/.test(s) });
  const f = path.join(d, 'src', 'suggestionsAchat.js'); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MUTS[MUT][0])) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(MUTS[MUT][0], MUTS[MUT][1])); MOD = f;
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };

// Les règles de l'app, exécutées telles quelles.
const APP = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
const bout = (debut, fin) => { const a = APP.indexOf(debut); const b = APP.indexOf(fin, a); if (a < 0 || b < 0) throw new Error('introuvable : ' + debut); return APP.slice(a, b + fin.length); };
const ctx = {};
vm.runInNewContext([bout('const KNOWN_BRANDS=[', '];'), bout('function extractBrand(text){', '\n}'), bout('const COULEURS = {', '\n};'),
  bout('function extractColors(text){', '\n}'), bout('const KNOWN_MODELS = [', '];'), bout('function extractModel(text){', '\n}'), bout('function contientModele(t,k){', '\n}'),
  'this.extractBrand=extractBrand; this.extractColors=extractColors; this.extractModel=extractModel;'].join('\n'), ctx);
const { extractBrand: marqueDe, extractColors: couleursDe, extractModel: modeleDe } = ctx;

(async () => {
  const S = await import(require('url').pathToFileURL(MOD).href);
  const J = 86400e3, T0 = Date.parse('2026-10-20T12:00:00Z');
  const ach = (tx, title, jours = -10, o = {}) => ({ transaction_id: tx, title, date: new Date(T0 + jours * J).toISOString(), price: { amount: '30.0', currency_code: 'EUR' }, status: 'Commande finalisée', ...o });
  const sugg = (cible, achats, liens = new Map()) => S.suggestionsAchat({ cible: { dateRef: new Date(T0).toISOString(), ...cible }, achats, liens, marqueDe, couleursDe, modeleDe });
  const cible = { titre: 'Adidas Spezial noir taille 42,5' };

  console.log('\n── T. La taille, normalisée d’écriture');
  dit(S.tailleNorm('42,5') === '42.5' && S.tailleNorm('42.5') === '42.5' && S.tailleNorm('42½') === '42.5', 'T1 « 42,5 » = « 42.5 » = « 42½ »');
  dit(S.tailleNorm('42 2/3') === '42 2/3' && S.tailleNorm('42 2/3') !== S.tailleNorm('42,5'), 'T2 « 42 2/3 » ≠ « 42,5 »');
  dit(S.tailleDuTitre('Air Max 90 blanc T42') === '42' && S.tailleDuTitre('Nike Air Max 90 blanche') === '', 'T3 « Air Max 90 » n’est pas une taille');

  console.log('\n── S. Les suggestions');
  const bon = ach(1, 'Adidas Spezial noire 42.5');
  dit(sugg(cible, [bon]).length === 1 && sugg(cible, [bon])[0].rang === 1, 'S1 marque + taille + couleur ⇒ rang 1');
  const s2 = sugg(cible, [ach(2, 'Adidas spezial pointure 42,5'), ach(3, 'adidas spezial black 42.5', -20)]);
  dit(s2.length === 2 && s2[0].achat.transaction_id === 3 && s2[1].rang === 2, 'S2 les trois critères d’abord, puis marque + taille', JSON.stringify(s2.map((x) => [x.achat.transaction_id, x.rang])));
  dit(sugg(cible, [ach(4, 'Nike Spezial noire 42.5')]).length === 0, 'S3 marque différente ⇒ écartée');
  dit(sugg({ titre: 'adidas spezial noir 35,5' }, [ach(14, 'Adidas samba 35,5')]).length === 0 && sugg({ titre: 'adidas spezial noir 35,5' }, [ach(15, 'Adidas baskets 35,5')]).length === 1, 'S3b deux modèles connus et différents (Spezial / Samba) ⇒ écartée ; modèle inconnu d’un côté ⇒ gardée');
  dit(sugg(cible, [ach(5, 'Adidas Spezial noire 43')]).length === 0, 'S4 taille différente ⇒ écartée');
  dit(sugg(cible, [ach(6, 'Adidas Spezial noire 42 2/3')]).length === 0, 'S5 « 42 2/3 » face à « 42,5 » ⇒ écartée');
  dit(sugg(cible, [ach(7, 'Adidas Spezial bleue 42.5')]).length === 0, 'S6 couleur différente ⇒ écartée');
  dit(sugg(cible, [ach(8, 'Adidas Spezial noire')]).length === 0 && sugg({ titre: 'Adidas Spezial noir' }, [bon]).length === 0, 'S7 taille inconnue d’un côté ⇒ jamais la marque seule');
  dit(sugg(cible, [ach(9, 'Adidas Spezial noire 42.5', +3)]).length === 0, 'S8 achat POSTÉRIEUR à la mise en ligne / vente ⇒ écarté');
  dit(sugg(cible, [ach(10, 'Adidas Spezial noire 42.5', 0, { date: '' })]).length === 0, 'S9 date d’achat inconnue ⇒ écarté');
  dit(sugg(cible, [ach(11, 'Adidas Spezial noire 42.5', -5, { status: 'Commande remboursée' })]).length === 0, 'S10 achat remboursé ⇒ écarté');
  dit(sugg(cible, [ach(12, 'Adidas Spezial noire 42.5')], new Map([['12', 1]])).length === 0, 'S11 achat déjà relié ailleurs ⇒ écarté');
  dit(sugg({ ...cible, curTx: '12' }, [ach(12, 'Adidas Spezial noire 42.5')], new Map([['12', 1]])).length === 1, 'S12 l’achat déjà relié À CET article reste visible');
  dit(sugg({ titre: 'Adidas Spezial', marque: 'Adidas', taille: '42,5', couleur: 'Noir' }, [bon]).length === 1, 'S13 marque / taille / couleur des CHAMPS de l’annonce lus d’abord');
  const photoSeule = sugg(cible, [ach(13, 'Baskets montantes 41', -1, { photo: { url: 'x/1.jpg' } })]);
  dit(photoSeule.length === 0, 'S14 la photo ne compte pas (aucune suggestion sans marque + taille)');
  const plein = []; for (let i = 0; i < 9; i++) plein.push(ach(100 + i, 'Adidas Spezial noire 42.5', -i - 1));
  dit(sugg(cible, plein).length === 3, 'S15 au plus 3 suggestions');

  console.log('\n── I. 50 articles au même titre, 50 achats identiques : rien n’est relié sans tap');
  const achats50 = [], liens = new Map();
  for (let i = 0; i < 50; i++) achats50.push(ach(1000 + i, 'Adidas Spezial noire 42.5', -i - 1));
  let total = 0;
  for (let i = 0; i < 50; i++) total += sugg(cible, achats50, liens).length;
  dit(liens.size === 0, 'I1 50 suggestions demandées, AUCUN lien posé (le module n’écrit rien)', String(liens.size));
  dit(total === 150, 'I2 chaque article reçoit 3 propositions — un choix, jamais une décision', String(total));
  const apres = new Map([['1000', 1]]);
  dit(!sugg(cible, achats50, apres).some((x) => x.achat.transaction_id === 1000), 'I3 l’achat relié par SON tap sort des propositions des 49 autres');

  console.log('\n── L. Les lots (forme mesurée : le titre)');
  const lot = ach(2000, 'Lot 3 articles', -30, { price: { amount: '90.0' } });
  dit(S.lotDe(lot).lot && S.lotDe(lot).n === 3 && S.lotDe(ach(1, 'Lot de 2 paires Nike Pegasus')).n === 2 && S.lotDe(ach(1, 'Lot de jeux Nintendo 64')).n === null && !S.lotDe(ach(1, 'Slot machine')).lot, 'L1 « Lot 3 articles » = 3, « Lot de 2 paires » = 2, « Lot de jeux Nintendo 64 » = nombre pas écrit');
  const libres = (m) => S.tousAchatsLibres({ achats: [lot, ach(2001, 'Nike Air Max 1 42'), ach(2002, 'Puma Suede 40', -3, { status: 'Commande annulée' })], liens: m });
  dit(libres(new Map([['2001', 1]])).map((a) => a.transaction_id).join() === '2000', 'L2 un achat déjà relié n’est pas dans « tous les achats », un remboursé non plus');
  dit(libres(new Map([['2000', 2]])).some((a) => a.transaction_id === 2000) && S.etiquetteLot(lot, new Map([['2000', 2]])) === 'lot · 2/3 reliés', 'L3 un lot à 2/3 reste proposable, « lot · 2/3 reliés »');
  dit(!libres(new Map([['2000', 3]])).some((a) => a.transaction_id === 2000), 'L4 un lot complet (3/3) sort de la liste');
  dit(S.ecritureLot(lot, '') === null && S.ecritureLot(lot, 'abc') === null && S.ecritureLot(lot, null) === null, 'L5 aucun prix de lot écrit sans saisie');
  const w = S.ecritureLot(lot, '25,50');
  dit(w && w.buyPrice === '25,50' && w.buyFromId === '2000' && w.buyFrom.lot === true, 'L6 le prix SAISI de cet article est écrit, avec le lien');
  dit(S.prixIndicatifLot(lot) === 30, 'L7 l’indication « prix du lot ÷ 3 » = 30 € (affichée, jamais pré-remplie)');

  console.log('\n── R. « Voir tous les achats » : recherche et filtres');
  const liste = [ach(3000, 'Nike Air Max 1 noir 42', -2, { _c: 'julien' }), ach(3001, 'Adidas Samba 40', -40, { _c: 'arthur' }), ach(3002, 'Nike Dunk 41', -1, { _c: 'arthur' })];
  const compteDe = (a) => a._c;
  dit(S.tousAchatsLibres({ achats: liste, liens: new Map() }).map((a) => a.transaction_id).join() === '3002,3000,3001', 'R1 les plus récents d’abord');
  dit(S.tousAchatsLibres({ achats: liste, liens: new Map(), q: 'nike', marqueDe }).length === 2 && S.tousAchatsLibres({ achats: liste, liens: new Map(), q: '3001' }).length === 1, 'R2 recherche par mot (titre, marque) et par n° de transaction');
  dit(S.tousAchatsLibres({ achats: liste, liens: new Map(), compte: 'arthur', compteDe }).length === 2, 'R3 filtre par compte');
  const m = new Date(T0 - 40 * J).toISOString().slice(0, 7);
  dit(S.tousAchatsLibres({ achats: liste, liens: new Map(), mois: m }).map((a) => a.transaction_id).join() === '3001', 'R4 filtre par mois');

  console.log('\n── A. Le module n’écrit nulle part');
  const src = fs.readFileSync(MOD, 'utf8').replace(/\/\/.*$/gm, '');
  dit(!/fetch\(|localStorage|save\(|setNumeros|setSaleOverride/.test(src), 'A1 aucune écriture ni lecture réseau dans src/suggestionsAchat.js');

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
