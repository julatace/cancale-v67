#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE PRIX D'ACHAT SE POSE SEUL, DEPUIS LE REÇU (19 nov. 2026)
//        node scripts/audit-prix-achat-recu.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// Décision de Julien du 19 nov. (« 2 oui », docs/passation/2026-11-19-demandes-julien.md) : le montant
// du REÇU de CET achat (son n° de transaction) est posé quand l'achat est relié à l'article par identité
// ou reçoit son N° ; jamais deviné ; un LOT n'est jamais divisé ; une saisie n'est jamais écrasée ; dit
// une fois. EXÉCUTE src/prixAchatRecu.js et le VRAI moteur d'écriture (src/gesteAnnulable.js `ecrireOps`) :
//   R  reçu lu et juste ⇒ posé (fiche + `vinted_buyprice_by_num`, vente) ; 50 achats au même titre :
//      seul celui du lien est lu ; article sans lien ⇒ rien ;
//   L  lot ⇒ demandé (titre « Lot », `estLot` vrai, `estLot` pas su, deux N° sur un achat, `aSaisir`) ;
//   S  saisie existante ⇒ intacte (même « 0 ») — et une saisie arrivée ENTRE la lecture et l'écriture gagne ;
//   P  lecture ratée ⇒ rien d'écrit (fiches, ventes, achat absent, reçu absent ou faux, autre devise,
//      achat remboursé, lecture du moteur ratée) ; l'article seul (sans reçu) n'est JAMAIS posé ;
//   B  le branchement : l'app l'écrit par `ecrireOps` (chemin des gestes), après le nuage, sur des
//      lectures complètes ; l'atelier n'en a pas de copie.
// --prouve : chaque mutation réaffaiblit une règle ⇒ l'audit DOIT rougir.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const MOD = 'src/prixAchatRecu.js', GA = 'src/gesteAnnulable.js', APP = 'src/App.jsx';

const MUTS = {
  'saisie-ecrasee': [MOD, "    if (!vide(e.buyPrice)) continue;                                  // sa saisie : jamais touchée\n", ''],
  'lot-divise': [MOD, "  if (!tx || lot !== false) return null;", "  if (!tx || lot === true) return null;"],
  'lot-titre-oublie': [MOD, "    if (plusieurs(tx)) continue;                                      // un achat, plusieurs paires : un lot\n", ''],
  'a-saisir-oublie': [MOD, "    if (e.buyFrom && e.buyFrom.aSaisir) continue;                     // un article de lot : à saisir\n", ''],
  'autre-achat': [MOD, "    if (!a || txDe(a.transaction_id) !== tx) continue;", "    if (!a) continue;"],
  'recu-faux': [MOD, "v.somme !== 'juste' || ", ''],
  'article-seul': [MOD, "  if (!v || !v.trouve || v.somme !== 'juste' || !Number.isSafeInteger(v.paye) || v.paye <= 0) return null;",
    "  if (!v || !v.trouve || v.somme !== 'juste' || !Number.isSafeInteger(v.paye) || v.paye <= 0) { const c = Math.round(Number(achat.price && achat.price.amount) * 100); return c > 0 ? { tx, centimes: c, valeur: (c / 100).toFixed(2).replace('.', ','), texte: '', source: 'achat' } : null; }"],
  'devise': [MOD, "  if (devise !== 'EUR') return null;\n", ''],
  'rembourse': [MOD, "  if (ACHAT_SANS_COUT.test(String((achat && achat.status) || ''))) return null;\n", ''],
  'fiches-pas-lues': [MOD, "  if (!estObjet(fiches) || !estObjet(ventes)) return [];", "  fiches = fiches || {}; ventes = ventes || {};"],
  'ecriture-sans-condition': [MOD, "type: 'champsSiVide', garde: 'buyPrice',", "type: 'champs', garde: 'buyPrice',"],
  'moteur-sans-garde': [GA, "    if (!estObjet(f) || !videV(f[op.garde || 'buyPrice'])) return valeur;", "    if (!estObjet(f)) return valeur;"],
  'moteur-cle-sans-garde': [GA, "    if (op.type === 'cleSiVide') return videV(base[id]) ? { ...base, [id]: cible } : valeur;", "    if (op.type === 'cleSiVide') return { ...base, [id]: cible };"],
  'lecture-ratee-ecrit': [GA, "    if (v === undefined) return { ok: false, definitif: true, ecrit: false, raison: 'lecture' };", "    if (v === undefined) v = {};"],
  'app-avant-le-nuage': [APP, "if (prixRecuEnCours.current || !isCloudReady() || ", "if (prixRecuEnCours.current || "],
  'app-lots-pas-su': [APP, " || infosAchatsLues === undefined) return;\n    const fiches = _ecrivainVrm.lire", ") return;\n    const fiches = _ecrivainVrm.lire"],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}

// ── La copie de travail d'une mutation : les modules lus seulement ──
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
let BASE = R, TMP = null;
if (MUT) {
  if (!MUTS[MUT]) { console.log('mutation inconnue : ' + MUT); process.exit(2); }
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-prix-recu-'));
  for (const rel of [MOD, GA, APP, 'src/prixAchatPropose.js']) { fs.mkdirSync(path.dirname(path.join(TMP, rel)), { recursive: true }); fs.copyFileSync(path.join(R, rel), path.join(TMP, rel)); }
  const [f, de, vers] = MUTS[MUT]; const p = path.join(TMP, f); const s = fs.readFileSync(p, 'utf8');
  if (!s.includes(de)) { console.log(`mutation « ${MUT} » : le texte visé n'est plus dans ${f}`); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(3); }
  fs.writeFileSync(p, s.replace(de, vers));
  BASE = TMP;
}
process.on('exit', () => { if (TMP) { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} } });

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : ''}`); };
const imp = (rel) => import(pathToFileURL(path.join(BASE, rel)).href + '?v=' + Date.now() + Math.random());
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  const M = await imp(MOD), G = await imp(GA);
  // ── Le jeu inventé : 50 achats AU MÊME TITRE, un reçu juste par achat (montant = 30 € + i) ──
  const achats = Array.from({ length: 50 }, (_, i) => ({ transaction_id: 9100000 + i, title: 'Nike Air Max 90 blanche 42', price: { amount: String(25 + i) + '.00', currency_code: 'EUR' }, status: 'Commande finalisée' }));
  achats.push({ transaction_id: 9200001, title: 'Lot de 3 paires', price: { amount: '90.00', currency_code: 'EUR' } });
  achats.push({ transaction_id: 9200002, title: 'Adidas Samba', price: { amount: '40.00', currency_code: 'GBP' } });
  achats.push({ transaction_id: 9200003, title: 'Puma Suede', price: { amount: '30.00', currency_code: 'EUR' }, status: 'Remboursée' });
  achats.push({ transaction_id: 9200004, title: 'Asics', price: { amount: '50.00', currency_code: 'EUR' } });      // reçu faux
  achats.push({ transaction_id: 9200005, title: 'Vans', price: { amount: '45.00', currency_code: 'EUR' } });       // pas de reçu
  achats.push({ transaction_id: 9200006, title: 'Reebok', price: { amount: '35.00', currency_code: 'EUR' } });     // deux N° dessus
  achats.push({ transaction_id: 9200007, title: 'Converse', price: { amount: '33.00', currency_code: 'EUR' } });   // lot pas su
  const parTx = new Map(achats.map((a) => [String(a.transaction_id), a]));
  const achatDe = (tx) => parTx.get(String(tx)) || null;
  const recu = (c) => ({ trouve: true, somme: 'juste', paye: c, lignes: [{ libelle: 'Article', centimes: c }] });
  const ventilationDe = (tx) => { const t = String(tx); if (t === '9200004') return { trouve: true, somme: 'ecart', paye: 5900, lignes: [] }; if (t === '9200005') return null; const a = parTx.get(t); return a ? recu(3000 + (Number(t) % 100) * 100 + 45) : null; };
  const estLot = (a) => (String(a.transaction_id) === '9200007' ? null : /^lot\b/i.test(a.title));
  const fiches = {
    f1: { numero: '12', buyFromId: '9100017', buyPrice: '' },                 // ⇒ reçu de 9100017 : 47,45 €
    f2: { numero: '13', buyFromId: '9100018', buyPrice: '52' },               // saisie : intacte
    f3: { numero: '14', buyFromId: '9100019', buyPrice: '0' },                // « 0 » saisi : intact
    f4: { numero: '15', title: 'Nike Air Max 90 blanche 42', buyPrice: '' },  // aucun lien : rien
    f5: { numero: '16', buyFromId: '9200001', buyPrice: '' },                 // lot (titre)
    f6: { numero: '17', buyFromId: '9200002', buyPrice: '' },                 // GBP
    f7: { numero: '18', buyFromId: '9200003', buyPrice: '' },                 // remboursé
    f8: { numero: '19', buyFromId: '9200004', buyPrice: '' },                 // reçu faux
    f9: { numero: '20', buyFromId: '9200005', buyPrice: '' },                 // sans reçu (article seul : jamais)
    f10: { numero: '21', buyFromId: '9200006', buyPrice: '' },                // deux N° sur un achat
    f11: { numero: '22', buyFromId: '9200006', buyPrice: '' },
    f12: { numero: '23', buyFromId: '9200007', buyPrice: '' },                // lot pas su
    f13: { numero: '24', buyFromId: '9100020', buyPrice: '', buyFrom: { aSaisir: true } },
    f14: { numero: '25', buyFromId: '9999999', buyPrice: '' },                // achat pas lu
  };
  const ventes = { 6300001: { buyFromId: '9100030', numero: '30' }, 6300002: { numero: '31' } };
  const lu = M.prixAPoser({ fiches, ventes, achatDe, ventilationDe, estLot });
  const par = Object.fromEntries(lu.map((c) => [c.ou + ':' + c.cle, c]));

  console.log('── R. le reçu lu ⇒ posé');
  dit(par['fiche:f1'] && par['fiche:f1'].buyPrice === '47,45' && par['fiche:f1'].tx === '9100017', 'R1 article relié, reçu juste ⇒ le montant de CE reçu (47,45 €), pas celui d’un des 49 achats au même titre', par['fiche:f1']);
  dit(par['vente:6300001'] && par['vente:6300001'].buyPrice === '60,45', 'R2 une vente reliée reçoit le montant de SON reçu', par['vente:6300001']);
  dit(!par['fiche:f4'] && !par['vente:6300002'], 'R3 un article sans achat relié : rien (le titre ne relie jamais)');
  dit(lu.length === 2, 'R4 rien d’autre n’est posé', lu.map((c) => c.ou + ':' + c.cle));

  console.log('\n── L. un lot ⇒ demandé');
  dit(!par['fiche:f5'], 'L1 un achat « Lot … » : jamais divisé');
  dit(!par['fiche:f10'] && !par['fiche:f11'], 'L2 un achat qui porte deux N° : un lot, même non déclaré');
  dit(!par['fiche:f12'], 'L3 lot « pas su » (estLot = null) : rien');
  dit(!par['fiche:f13'], 'L4 un article de lot marqué « à saisir » : rien');

  console.log('\n── S. une saisie n’est jamais écrasée');
  dit(!par['fiche:f2'] && !par['fiche:f3'], 'S1 « 52 » et « 0 » saisis : intacts');

  console.log('\n── P. pas su ⇒ rien');
  dit(!par['fiche:f6'] && !par['fiche:f7'] && !par['fiche:f8'] && !par['fiche:f9'] && !par['fiche:f14'], 'P1 autre devise, remboursé, reçu faux, sans reçu (l’article seul n’est pas ce qu’il a payé), achat pas lu : rien');
  // Un appelant négligent qui rendrait « un achat qui ressemble » pour un n° inconnu : la règle exige SON n°.
  const negligent = (tx) => parTx.get(String(tx)) || achats[0];
  dit(!M.prixAPoser({ fiches: { f14: fiches.f14 }, ventes: {}, achatDe: negligent, ventilationDe: (tx) => (String(tx) === '9999999' ? recu(4000) : ventilationDe(tx)), estLot }).length, 'P4 l’achat lu doit porter LE n° du lien (jamais un voisin au même titre)');
  dit(M.prixAPoser({ fiches: undefined, ventes, achatDe, ventilationDe, estLot }).length === 0 && M.prixAPoser({ fiches, ventes: null, achatDe, ventilationDe, estLot }).length === 0, 'P2 fiches ou ventes pas lues : rien');
  dit(M.prixAPoser({ fiches, ventes, achatDe, ventilationDe: null, estLot }).length === 0 && M.prixAPoser({ fiches, ventes, achatDe, ventilationDe, estLot: null }).length === 0, 'P3 reçus ou lots pas lus : rien');

  console.log('\n── E. l’écriture, par le vrai moteur');
  const ops = M.opsPrixRecu(lu);
  const fichesBase = JSON.parse(JSON.stringify(fiches));
  const st = { vinted_annonce_numeros: fichesBase, vinted_sale_overrides: JSON.parse(JSON.stringify(ventes)), vinted_buyprice_by_num: { 13: '52' } };
  // Une saisie arrive ENTRE la lecture de la règle et l'écriture : la vente 6300001 reçoit « 58 » de lui.
  st.vinted_sale_overrides[6300001].buyPrice = '58';
  const ecrits = {};
  const r = await G.ecrireOps({ ops, sens: 'apres', lire: async (k) => JSON.parse(JSON.stringify(st[k] || {})), ecrire: async (k, v) => { ecrits[k] = v; return { ok: true }; } });
  const F = ecrits.vinted_annonce_numeros || {}, V = ecrits.vinted_sale_overrides || {}, N = ecrits.vinted_buyprice_by_num || {};
  dit(r.ok === true && F.f1 && F.f1.buyPrice === '47,45' && F.f1.buyFromId === '9100017' && F.f1.buyPriceSource === 'recu' && N['12'] === '47,45', 'E1 posé : la fiche (le lien intact) et le prix par N°', { f1: F.f1, n12: N['12'] });
  dit(V[6300001] && V[6300001].buyPrice === '58' && N['13'] === '52' && F.f2.buyPrice === '52' && F.f3.buyPrice === '0', 'E2 une saisie arrivée entre la lecture et l’écriture GAGNE (revérifiée sur la valeur relue)', { v: V[6300001] });
  dit(JSON.stringify(Object.keys(F).sort()) === JSON.stringify(Object.keys(fichesBase).sort()) && Object.keys(F).every((k) => k === 'f1' || JSON.stringify(F[k]) === JSON.stringify(fichesBase[k])), 'E3 rien d’autre ne change dans les fiches');
  let n = 0;
  const rate = await G.ecrireOps({ ops, sens: 'apres', lire: async (k) => (k === 'vinted_sale_overrides' ? undefined : {}), ecrire: async () => { n++; return { ok: true }; } });
  dit(rate.ecrit === false && n === 0, 'E4 une lecture ratée ⇒ AUCUNE écriture (pas même les clés déjà lues)', { rate, n });
  const opN = ops.find((o) => o.type === 'cleSiVide');
  dit(opN && G.appliquerOp({ 12: '44' }, opN)['12'] === '44' && G.appliquerOp({}, opN)['12'] === '47,45', 'E6 le prix par N° déjà posé (une saisie) reste ; vide, il est posé');
  dit(G.appliquerOp({ a: { buyPrice: '' } }, ops[0], 'avant').a.buyPrice === '' && egal(G.appliquerOp({ x: 1 }, { k: 'x', type: 'champsSiVide', id: 'zz', apres: { buyPrice: '1' } }), { x: 1 }), 'E5 jamais une fiche créée, aucun « inverse » qui effacerait');

  console.log('\n── B. le branchement');
  const app = sansCommentaires(fs.readFileSync(path.join(BASE, APP), 'utf8'));
  const i = app.indexOf('const prixRecuEnCours'), bloc = i >= 0 ? app.slice(i, i + 2600) : '';
  dit(/!isCloudReady\(\)/.test(bloc) && /!Array\.isArray\(achatsIdentite\)/.test(bloc) && /!Array\.isArray\(recusAchat\)/.test(bloc) && /infosAchatsLues === undefined/.test(bloc), 'B1 l’app n’écrit qu’après le nuage, sur des achats, des reçus et des lots LUS');
  dit(/ecrireOps\(\{ ops, sens: 'apres', lire: _ecrivainVrm\.lire, ecrire: _ecrivainVrm\.ecrire \}\)/.test(bloc) && /opsPrixRecu\(aPoser\)/.test(bloc), 'B2 par le chemin d’écriture des gestes (relire, puis écrire), les écritures de la règle');
  dit(/toast\(tr\('cpl\.fait\.recu'/.test(bloc), 'B3 dit une fois, discrètement (« Prix d’achat repris du reçu »)');
  const ecran = sansCommentaires(fs.readFileSync(path.join(R, 'src/completer/Completer.jsx'), 'utf8'));
  dit(!/prixCertains|opsPrixCertains/.test(ecran), 'B4 l’atelier « Compléter » n’en écrit pas de copie (un seul propriétaire)');

  console.log(`\n${ko ? '❌' : '✅'} audit-prix-achat-recu : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
function egal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
