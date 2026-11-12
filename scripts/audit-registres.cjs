// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LIVRE DES RECETTES ET REGISTRE DES ACHATS (3 novembre)
//         node scripts/audit-registres.cjs [--mutation=versement|exclu|adater|zero|complet|annule|article|recu|achat-exclu|saisi
//                                            |gros-parts|gros-deux-fois|gros-oublie|gros-frais|hors-deux-fois|hors-nom|a-verifier-tu|gros-carte]
//         node scripts/audit-registres.cjs --prouve   (toutes les mutations : chacune doit rougir)
// ═══════════════════════════════════════════════════════════════════════════
// Les deux registres obligatoires d'une micro-entreprise d'achat-revente, dans
// Comptabilité (src/registres.js). Cet audit EXÉCUTE la vraie chaîne sur des
// ventes et des achats INVENTÉS (le dépôt est public) :
//   App.jsx `declarablesCompta` → `ventesDeclarables` (extraites, dans un vm)
//   → src/registres.js `livreDesRecettes` / `registreDesAchats` → le tableur
//   (relu) et le PDF (relu par pdf.js).
// Il exige :
//   R1. une recette Vinted est datée au jour du VERSEMENT (vendue en octobre,
//       versée en novembre ⇒ novembre, jamais octobre) ;
//   R2. une vente finalisée sans date de versement n'est dans AUCUNE période,
//       ni mois ni année : listée à part (« à dater »), jamais dans le total ;
//   R3. un compte exclu (Vinted masqué/décoché, Leboncoin écarté) n'entre dans
//       aucune ligne ni aucun total ;
//   R4. eBay au montant REÇU (dû − frais) ; frais inconnus ⇒ ligne SANS montant
//       (jamais 0 €), total « au moins » ; Vestiaire au montant pas sûr ⇒ hors
//       de toute ligne datée ;
//   R5. le N° vient de l'identité de la vente (le relevé), jamais du titre ;
//   R6. total = somme des lignes, au centime ; le tableur et le PDF disent le
//       même total et le même nombre de lignes ;
//   A1. un achat annulé ou remboursé n'est pas un achat (la règle de
//       « Dépensé ») ; un compte exclu n'y entre pas ;
//   A2. montant : le reçu juste d'abord, puis les prix saisis sur les fiches
//       reliées PAR SON CLIC, puis « article seul » (total « au moins »),
//       sinon « sans montant » — jamais deviné ;
//   A3. le N° relié : `buyFromId` seulement — deux achats au même titre ne
//       partagent pas un N° ;
//   A4. les dépenses ne sont pas des achats de marchandise (la carte ne les
//       passe pas au registre).
//   G1. (5 nov.) un ACHAT EN GROS (Achats → Fournisseurs, `vrm_fournisseurs`,
//       lu par la VRAIE `lireRegistre` de src/fournisseurs.js) est UNE ligne :
//       date, fournisseur, nombre de paires, total + frais saisis (« dont frais ») ;
//   G2. jamais la somme des parts posées sur ses paires, et une fiche reliée à
//       un achat en gros ne prête pas son prix à un achat Vinted (`buyFromId`)
//       — aucun double compte ;
//   G3. un achat hors plateforme RATTACHÉ à un fournisseur : UNE ligne, à son
//       nom, jamais ajoutée à un achat en gros ;
//   G4. un achat hors plateforme au N° d'une paire d'un achat en gros : gardé,
//       dit « à vérifier » ;
//   G5. le tableur et le PDF suivent (colonnes « Paires » et « Dont frais ») ;
//   G6. la carte Registres passe le registre des fournisseurs.
// `--mutation=…` réaffaiblit une règle dans une copie : rouge exigé.
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const R0 = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R0, f), 'utf8'); } catch (_) { return ''; } };
let APP = lire('src/App.jsx'), MOD = lire('src/registres.js');
const PRIX = lire('src/prixAchatPropose.js'), VC = lire('api/_lib/vestiaire-regle.js');
const muter = (quoi, avant, apres) => {
  const s = quoi === 'mod' ? MOD : APP;
  if (!s.includes(avant)) { console.log('❌ mutation impossible : motif absent — ' + avant.slice(0, 90)); process.exit(2); }
  if (quoi === 'mod') MOD = s.replace(avant, apres); else APP = s.replace(avant, apres);
};
// Date de VENTE au lieu du versement (la règle d'avant le 3 octobre).
if (MUT === 'versement') muter('app', "const t = v ? Date.parse(v) : 0;\n    if (eur == null)", "const t = Date.parse(o.date || '') || 0;\n    if (eur == null)");
else if (MUT === 'exclu') muter('app', "masquee: (o) => hTx.has(String(o && o.transaction_id)), exclu: (o) => ecarte(uidDe(o)), excluAutre, versements: versements || {} });\n  // (1er nov., audits A2/A10)", "masquee: (o) => hTx.has(String(o && o.transaction_id)), excluAutre, versements: versements || {} });\n  // (1er nov., audits A2/A10)");
else if (MUT === 'adater') muter('mod', "if (a) horsPeriode.push({ ...ligne({ ...a, ts: null }, Number(a.eur), 'à dater'), date: '' });", "if (a) lignes.push(ligne({ ...a, ts: null }, Number(a.eur), 'à dater'));");
else if (MUT === 'zero') muter('mod', "if (dansPeriode(ymLocal(x.ts), periode)) lignes.push(ligne(x, null, x.raison || 'montant pas lu'));", "if (dansPeriode(ymLocal(x.ts), periode)) lignes.push(ligne(x, 0, ''));");
else if (MUT === 'complet') muter('mod', "complet: !sansMontant && !manques.length };", "complet: true };");
else if (MUT === 'annule') muter('mod', "export const achatAnnule = (o) => /annul|rembours|refus/i.test(String((o && o.status) || ''));", "export const achatAnnule = (o) => false;");
else if (MUT === 'article') muter('mod', "complet: !sansMontant && !articleSeul && !manques.length };", "complet: !sansMontant && !manques.length };");
else if (MUT === 'recu') muter('mod', "const m = montantPropose(o, tx ? ventilationDe(tx) : null);", "const m = montantPropose(o, null);");
else if (MUT === 'achat-exclu') muter('mod', "if (exclu && exclu(o)) { exclues += 1; continue; }", "");
else if (MUT === 'saisi') muter('mod', "if (liees.length && saisis.every((c) => c != null))", "if (liees.length && saisis.some((c) => c != null))");
// ── Les achats en gros (5 nov.) ──
// La somme des parts posées sur ses paires au lieu de son total.
else if (MUT === 'gros-parts') muter('mod', "montant: (a.total + frais) / 100, source: 'saisi'", "montant: ((parGros.get(gid) || []).length ? (parGros.get(gid) || []).reduce((t, e) => t + (centimesTexte(e.buyPrice) || 0), 0) : a.total + frais) / 100, source: 'saisi'");
// Le prix posé par un achat en gros relu comme « saisi » d'un achat Vinted : compté deux fois.
else if (MUT === 'gros-deux-fois') muter('mod', "const saisis = liees.map((e) => (lienGros(e) ? null : centimesTexte(e.buyPrice)));", "const saisis = liees.map((e) => centimesTexte(e.buyPrice));");
// Les achats en gros oubliés.
else if (MUT === 'gros-oublie') muter('mod', "for (const [gid, a] of Object.entries(G && G.achats && typeof G.achats === 'object' ? G.achats : {})) {", "for (const [gid, a] of Object.entries({})) {");
// Les frais saisis oubliés.
else if (MUT === 'gros-frais') muter('mod', "montant: (a.total + frais) / 100, source: 'saisi'", "montant: a.total / 100, source: 'saisi'");
// Un achat hors plateforme rattaché compté une seconde fois, chez son fournisseur.
else if (MUT === 'hors-deux-fois') muter('mod', "if (dansPeriode(ymLocal(l.ts), periode)) { lignes.push(l); if (doublon) aVerifier += 1; }", "if (dansPeriode(ymLocal(l.ts), periode)) { lignes.push(l); if (rat) lignes.push({ ...l, id: 'fo:' + hid }); if (doublon) aVerifier += 1; }");
// Le rattachement perdu : la ligne ne dit plus son fournisseur.
else if (MUT === 'hors-nom') muter('mod', "fournisseur: rat || String(", "fournisseur: String(");
// Plus de « à vérifier ».
else if (MUT === 'a-verifier-tu') muter('mod', "const doublon = !!num && numsGros.has(cleNum(num));", "const doublon = false;");
// La carte ne passe plus les achats en gros.
else if (MUT === 'gros-carte') muter('app', "gros: lireRegistre(load(CLE_FOURNISSEURS, null)), cleNum,", "cleNum,");
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
if (process.argv.includes('--prouve')) {
  const { spawnSync } = require('child_process');
  const TOUTES = ['versement', 'exclu', 'adater', 'zero', 'complet', 'annule', 'article', 'recu', 'achat-exclu', 'saisi', 'gros-parts', 'gros-deux-fois', 'gros-oublie', 'gros-frais', 'hors-deux-fois', 'hors-nom', 'a-verifier-tu', 'gros-carte'];
  let pris = 0;
  for (const m of TOUTES) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8', env: process.env });
    // Rouges hors PDF (pdf.js peut manquer : ce n'est pas la mutation qui le fait rougir).
    const rouges = (r.stdout.match(/^ {2}❌ (?!le PDF se crée|R6 · le PDF dit|G5 · le PDF)/gm) || []).length;
    const okM = r.status !== 0 && rouges > 0;
    if (okM) pris++;
    console.log(`${okM ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s) hors PDF`);
  }
  console.log(`\n${pris}/${TOUTES.length} mutations attrapées.`);
  process.exit(pris === TOUTES.length ? 0 : 1);
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

(async () => {
  // ── Les modules, chargés depuis des copies (une mutation peut les toucher) ──
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-registres-'));
  let M = null, V = null;
  try {
    fs.writeFileSync(path.join(dir, 'prixAchatPropose.js'), PRIX); fs.copyFileSync(path.join(R0, 'src', 'modePaiement.js'), path.join(dir, 'modePaiement.js'));   // (11 nov.) importé par registres.js
    fs.copyFileSync(path.join(__dirname, '..', 'src', 'profilVendeur.js'), path.join(dir, 'profilVendeur.js'));   // (lot vocabulaire-article) le mot du vendeur, importé par la règle
    fs.writeFileSync(path.join(dir, 'vestiaire-regle.mjs'), VC.replace(/from '\.\/([^']+)\.js'/g, (x, n) => `from '${path.join(R0, 'api', '_lib', n + '.js').replace(/\\/g, '/')}'`));
    if (MOD) { fs.writeFileSync(path.join(dir, 'registres.mjs'), MOD.replace("from './prixAchatPropose.js'", "from './prixAchatPropose.js'")); fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}'); fs.renameSync(path.join(dir, 'registres.mjs'), path.join(dir, 'registres.js')); M = await import('file://' + path.join(dir, 'registres.js')); }
    V = await import('file://' + path.join(dir, 'vestiaire-regle.mjs'));
  } catch (e) { dit(false, 'les modules se chargent', e.message); }
  dit(!!M && typeof M.livreDesRecettes === 'function' && typeof M.registreDesAchats === 'function', 'src/registres.js : livreDesRecettes et registreDesAchats existent');

  // ── La chaîne de l'app : `declarablesCompta` → `ventesDeclarables` ──────────
  const NOMS = ['classifyOrderStatus', 'venteFinalisee', 'tsCommande', 'montantCommandeLu', 'ymDeTs', 'indexDeclarations', 'moisDeclare', 'lbcAnnulee', 'lbcFinalisee',
    'commandeEbayEngagee', 'montantRecuEbay', 'compteEcarteChoix', 'compteEcarteRegle', 'compteEcarte', 'phraseNonComptees', 'ventesDeclarables', 'declarablesCompta'];
  const ctx = { Date, Math, Number, String, Object, Array, JSON, Map, Set, isFinite, parseFloat, isNaN, console, RAISON_NON_COMPTEE: {},
    // (9 nov.) Offre Solo : sans état de plan (« pas su »), aucune vente n'est hors plan — rien n'est bridé.
    venteHorsPlanUid: () => false,
    // (9 nov., suites serveur) `compteEcarte` = `compteEcarteRegle(…, reglePlanCourante())` : règle « pas sue » ⇒ rien bridé.
    venteHorsPlan: () => false, reglePlanCourante: () => null };
  if (V) Object.assign(ctx, { vcVenteAnnulee: V.vcVenteAnnulee, montantRecuVc: V.montantRecuVc, dateVersementVc: V.dateVersementVc, etapeMotVc: V.etapeMotVc, dateVenteVc: V.dateVenteVc });
  vm.createContext(ctx);
  const absents = [];
  for (const n of NOMS) { const t = extraire(APP, n); if (!t) { absents.push(n); continue; } try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (e) { absents.push(n + ' (' + e.message + ')'); } }
  dit(!absents.length, 'la chaîne des recettes se lit dans App.jsx (declarablesCompta → ventesDeclarables)', absents.join(', '));
  if (absents.length || !M) { console.log(`\n❌ registres : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }

  // ── Les ventes INVENTÉES ──────────────────────────────────────────────────
  const D = (m, j, h = 12) => new Date(2026, m, j, h).toISOString();
  const T = (m, j, h = 12) => new Date(2026, m, j, h).getTime();
  const vinted = (uid, tx, eur, statut, date, titre) => ({ transaction_id: tx, id: tx, title: titre || 'Baskets inventées', price: eur == null ? null : { amount: String(eur), currency_code: 'EUR' }, status: statut, date, _acc: { vinted_user_id: uid, login: 'compte_' + uid } });
  const FIN = 'Commande finalisée';
  const ventes = [
    vinted('111', 9001, 50, FIN, D(9, 28)),                    // vendue en octobre, VERSÉE le 2 novembre
    vinted('111', 9002, 60, FIN, D(10, 3)),                    // novembre, versée le 6
    vinted('111', 9003, 70, FIN, D(10, 4)),                    // finalisée, SANS date de versement ⇒ à dater
    vinted('333', 9004, 99, FIN, D(10, 5)),                    // compte EXCLU (masqué)
    vinted('111', 9005, null, FIN, D(10, 6)),                  // prix illisible, versée le 9
    vinted('111', 9006, 45, 'Le paiement a été validé', D(10, 7)), // pas finalisée
    vinted('111', 9007, 30, FIN, D(9, 10)),                    // octobre, versée en octobre
    vinted('111', 9008, 60, FIN, D(10, 8), 'Baskets inventées'), // même titre que 9002, autre N°
  ];
  const versements = { 9001: D(10, 2), 9002: D(10, 6), 9004: D(10, 7), 9005: D(10, 9), 9007: D(9, 12), 9008: D(10, 10) };
  const lbc = [
    { txId: 'L1', isSeller: true, price: 4000, dateVente: D(10, 5), stepStatus: 'done', title: 'Baskets LBC', account: 'lbc-account:A' },
    { txId: 'L2', isSeller: true, price: 2500, dateVente: D(10, 6), stepStatus: 'done', title: 'Baskets LBC exclu', account: 'lbc-account:X' },
  ];
  const ebay = [
    { orderId: 'E1', orderPaymentStatus: 'PAID', creationDate: D(10, 7), paymentSummary: { totalDueSeller: { value: '80.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '9.50', currency: 'EUR' }, lineItems: [{ title: 'eBay inventé' }], _compte: 'eb1' },
    { orderId: 'E2', orderPaymentStatus: 'PAID', creationDate: D(10, 8), paymentSummary: { totalDueSeller: { value: '55.00', currency: 'EUR' } }, lineItems: [{ title: 'eBay frais pas lus' }], _compte: 'eb1' },
  ];
  const vestiaire = [
    { id: 'C1', etat: 'payout done', montant: { valeur: 120, cle: 'sellerEarning', devise: 'EUR' }, verseLe: D(10, 9), date: D(10, 1), compte: 'vc1' },
    { id: 'C2', etat: 'payout done', montant: { valeur: 90, cle: 'price', devise: 'EUR' }, verseLe: D(10, 9), date: D(10, 1), compte: 'vc1' },
  ];
  const excluAutre = (p, v) => p === 'leboncoin' && String(v.account || '').endsWith(':X');
  const { decl, manque } = ctx.declarablesCompta({ ventes, ko: [], lbc, ebay, vestiaire, rates: [], versements, hTx: new Set(), hAcc: new Set(['333']), panelOff: {}, excluAutre });
  // Le relevé de Ventes (par identité) : le N° de 9002 et de 9008 — deux N° différents, même titre.
  const releve = new Map([['vinted:9002', '41'], ['vinted:9008', '42'], ['vinted:9001', 'B12'], ['lbc:L1', '7']]);
  const numDe = (id) => releve.get(id) || '';
  const compteDe = (id) => { const l = decl.lignes.find((x) => x.id === id); return l && l.o ? l.o._acc.login : ''; };
  const nov = M.livreDesRecettes({ decl, periode: '2026-11', numDe, compteDe, manque });
  const oct = M.livreDesRecettes({ decl, periode: '2026-10', numDe, compteDe, manque });
  const an = M.livreDesRecettes({ decl, periode: '2026', numDe, compteDe, manque });
  const ids = (R) => R.lignes.map((l) => l.id);
  console.log('── Livre des recettes');
  console.log('   novembre', JSON.stringify(nov.lignes.map((l) => [l.date, l.id, l.montant, l.num]))); console.log('   octobre ', JSON.stringify(oct.lignes.map((l) => [l.date, l.id, l.montant])));
  dit(ids(nov).includes('vinted:9001') && !ids(oct).includes('vinted:9001'), 'R1 · vendue en octobre, versée le 2 novembre ⇒ novembre, pas octobre');
  const l9001 = nov.lignes.find((l) => l.id === 'vinted:9001');
  dit(!!l9001 && l9001.date === '02/11/2026', 'R1 · sa date est celle du versement', l9001 && l9001.date);
  dit(ids(oct).includes('vinted:9007') && ids(oct).length === 1, 'R1 · octobre : la seule vente VERSÉE en octobre', ids(oct).join(','));
  dit(![nov, oct, an].some((R) => ids(R).includes('vinted:9003')), 'R2 · finalisée sans date de versement : dans AUCUNE période (ni mois ni année)');
  dit([nov, an].every((R) => R.horsPeriode.some((l) => l.id === 'vinted:9003' && l.montant === 70)), 'R2 · listée à part (« à dater »), avec son montant');
  dit(![nov, oct, an].some((R) => ids(R).includes('vinted:9004') || R.horsPeriode.some((l) => l.id === 'vinted:9004')), 'R3 · compte Vinted exclu : nulle part');
  dit(![nov, an].some((R) => ids(R).includes('lbc:L2')), 'R3 · compte Leboncoin écarté : nulle part');
  dit(ids(nov).includes('lbc:L1') && nov.lignes.find((l) => l.id === 'lbc:L1').montant === 40, 'Leboncoin : datée au jour de la vente, au prix final (40 €)');
  const e1 = nov.lignes.find((l) => l.id === 'ebay:E1'), e2 = nov.lignes.find((l) => l.id === 'ebay:E2');
  dit(!!e1 && e1.montant === 70.5, 'R4 · eBay au montant REÇU (80 − 9,50)', e1 && String(e1.montant));
  dit(!!e2 && e2.montant === null, 'R4 · eBay aux frais pas lus : une ligne SANS montant (jamais 0 €)', e2 && String(e2.montant));
  const v5 = nov.lignes.find((l) => l.id === 'vinted:9005');
  dit(!!v5 && v5.montant === null, 'R4 · Vinted au prix illisible : une ligne sans montant', v5 && String(v5.montant));
  dit(ids(nov).includes('vestiaire:C1') && !ids(nov).includes('vestiaire:C2'), 'R4 · Vestiaire : au montant sûr seulement');
  dit(nov.sansMontant === 2 && nov.complet === false, 'R4 · « N lignes sans montant » et total « au moins »', `${nov.sansMontant} · complet=${nov.complet}`);
  dit(M.resumeRegistre(nov).some(([k, v]) => k === 'Total' && /^au moins /.test(v)), 'R4 · le résumé dit « au moins »');
  dit(nov.lignes.find((l) => l.id === 'vinted:9002').num === '41' && nov.lignes.find((l) => l.id === 'vinted:9008').num === '42', 'R5 · même titre, deux N° : chacun le sien, par identité');
  dit(!ids(nov).includes('vinted:9006'), 'une vente pas finalisée n’est pas une recette');
  const somme = (R) => R.lignes.reduce((s, l) => s + (l.montant == null ? 0 : Math.round(l.montant * 100)), 0);
  dit(Math.round(nov.total * 100) === somme(nov) && somme(nov) === 5000 + 6000 + 6000 + 4000 + 7050 + 12000, 'R6 · total = somme des lignes (au centime)', String(nov.total));
  dit(Math.round(an.total * 100) === somme(nov) + 3000 && an.n === nov.n + oct.n, 'R6 · l’année = ses mois', `${an.total} · ${an.n}`);
  const tri = nov.lignes.map((l) => l.ts); dit(tri.every((t, i) => i === 0 || t == null || tri[i - 1] == null || tri[i - 1] <= t), 'chronologique');

  // ── Le tableur et le PDF disent la même chose ───────────────────────────────
  const lireCsv = (t) => t.replace(/^﻿/, '').split(/\r?\n/).map((l) => l.split(';').map((c) => c.replace(/^"|"$/g, '')));
  const csvTotal = (R) => {
    const C = lireCsv(M.csvRegistre(R, { maintenant: T(10, 20) }));
    const i0 = C.findIndex((r) => r[0] === 'Date'); const iT = C.findIndex((r, i) => i > i0 && r[0] === 'Total');
    const rows = C.slice(i0 + 1, iT); const iM = C[i0].indexOf('Montant');
    return { n: rows.length, somme: rows.reduce((s, r) => s + (r[iM] ? Math.round(Number(r[iM].replace(',', '.')) * 100) : 0), 0), total: Math.round(Number(C[iT][iM].replace(',', '.')) * 100), vides: rows.filter((r) => r[iM] === '').length, texte: C.map((r) => r.join(' ')).join('\n') };
  };
  const cN = csvTotal(nov);
  dit(cN.n === nov.n && cN.somme === somme(nov) && cN.total === somme(nov) && cN.vides === nov.sansMontant, 'R6 · tableur : une ligne par recette, total = somme, cases vides = sans montant', JSON.stringify({ n: cN.n, total: cN.total, vides: cN.vides }));
  dit(/Dans aucune période/.test(cN.texte) && /9003/.test(cN.texte), 'R2 · le tableur liste « à dater » à part');
  dit(!/encaiss/i.test(cN.texte), 'jamais « encaissé »');
  // (8 nov.) pdf.js relit le PDF. C'est une VRAIE dépendance du dépôt (`pdfjs-dist`, déclarée dans
// package.json, devDependencies : les audits relisent les PDF avec) : absente de node_modules, l'audit le dit en clair
// et reste ROUGE — un PDF qu'on n'a pas relu n'est pas vérifié (« pas su » ≠ « oui »).
const importerPdfjs = async (NM) => {
  const f = path.join(NM, 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs');
  if (!fs.existsSync(f)) {
    let declare = false; try { const P = JSON.parse(fs.readFileSync(path.join(R0, 'package.json'), 'utf8')); declare = !!({ ...(P.dependencies || {}), ...(P.devDependencies || {}) })['pdfjs-dist']; } catch (_) {}
    throw new Error(`pdfjs-dist n’est pas installé dans ${NM}${declare ? ' (il est déclaré dans package.json : lance « npm install »)' : ' ET n’est pas déclaré dans package.json'} — le PDF n’a pas pu être relu`);
  }
  return import('file://' + f);
};
let pdfTexte = '';
  try {
    const NM = fs.realpathSync(path.join(R0, 'node_modules'));
    const PDFLib = require(path.join(NM, 'pdf-lib'));
    const oct8 = await M.pdfRegistre(nov, { PDFLib, maintenant: T(10, 20) });
    const pdfjs = await importerPdfjs(NM);
    const doc = await pdfjs.getDocument({ data: new Uint8Array(oct8), isEvalSupported: false, useSystemFonts: false, standardFontDataUrl: path.join(NM, 'pdfjs-dist', 'standard_fonts') + '/' }).promise;
    for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const tc = await p.getTextContent(); pdfTexte += tc.items.map((x) => x.str).join(' ') + '\n'; }
  } catch (e) { pdfTexte = ''; dit(false, 'le PDF se crée et se relit', e.message); }
  const totTxt = M.eurosTexte(nov.total).replace(/[  ]/g, ' ').replace('−', '-');
  dit(!!pdfTexte && pdfTexte.replace(/[  ]/g, ' ').includes(String(totTxt).replace(/[\u00a0\u202f]/g, ' ')) && /au moins/.test(pdfTexte) && /Livre des recettes/.test(pdfTexte), 'R6 · le PDF dit le total (« au moins »)', totTxt);

  // ── Registre des achats ───────────────────────────────────────────────────
  console.log('── Registre des achats');
  const achat = (tx, eur, statut, date, extra) => ({ transaction_id: tx, title: 'Baskets achetées', price: eur == null ? null : { amount: String(eur), currency_code: 'EUR' }, status: statut, date, _uid: '111', compte: 'compte_111', ...(extra || {}) });
  const achats = [
    achat(7001, 40, 'Transaction finalisée', D(10, 2)),               // reçu juste : 44,10 €
    achat(7002, 50, 'Transaction finalisée', D(10, 3)),               // relié à deux fiches saisies 20 + 25
    achat(7003, 30, 'Transaction finalisée', D(10, 4)),               // rien : article seul 30 €
    achat(7004, 70, 'Remboursement validé', D(10, 5)),                // remboursé : pas un achat
    achat(7005, 25, 'Transaction finalisée', D(10, 6), { _uid: '333' }), // compte exclu
    achat(7006, 35, 'Transaction finalisée', D(9, 20)),               // octobre
    achat(7007, 20, 'Transaction finalisée', D(10, 7), { price: { amount: '20', currency_code: 'GBP' } }), // autre devise
    achat(7008, 50, 'Transaction finalisée', D(10, 8)),               // relié à une fiche SANS prix ⇒ article seul
    achat(7009, 60, 'Transaction finalisée', D(10, 9)),               // lot : une fiche saisie, l'autre pas ⇒ article seul
  ];
  const fiches = {
    a: { numero: '12', buyFromId: '7002', buyPrice: '20' }, b: { numero: '13', buyFromId: '7002', buyPrice: '25,00' },
    c: { numero: '14', title: 'Baskets achetées' },                  // même titre, AUCUN lien
    d: { numero: '15', buyFromId: '7008', buyPrice: '' },
    e: { numero: '17', buyFromId: '7009', buyPrice: '10' }, f: { numero: '18', buyFromId: '7009' },
  };
  const ventil = { 7001: { trouve: true, somme: 'juste', paye: 4410, lignes: [{ libelle: 'Article', centimes: 4000 }, { libelle: 'Frais de port', centimes: 410 }] } };
  const hors = [{ id: 'ob1', title: 'Lot brocante', price: '15,50', date: '2026-11-09', source: 'brocante', numero: '16' }, { id: 'ob2', title: 'Sans prix', price: '', date: '2026-11-10', source: '' }];
  const A = M.registreDesAchats({ achats, hors, fiches, periode: '2026-11', ventilationDe: (tx) => ventil[tx] || null, exclu: (o) => o._uid === '333',
    montantHors: (b) => { const p = parseFloat(String(b.price).replace(',', '.')); return isNaN(p) ? null : p; }, sourceHors: (s) => s });
  const aid = (id) => A.lignes.find((l) => l.id === id);
  console.log('   novembre', JSON.stringify(A.lignes.map((l) => [l.date, l.id, l.montant, l.source, l.num])));
  dit(!aid('vinted:7004'), 'A1 · un achat remboursé n’est pas un achat');
  dit(!aid('vinted:7005') && A.exclues === 1, 'A1 · un compte exclu n’y entre pas');
  dit(!aid('vinted:7006'), 'période : un achat d’octobre n’est pas en novembre');
  dit(aid('vinted:7001') && aid('vinted:7001').montant === 44.1 && aid('vinted:7001').source === 'recu', 'A2 · le reçu juste d’abord (44,10 €, port compris)', aid('vinted:7001') && String(aid('vinted:7001').montant));
  dit(aid('vinted:7002') && aid('vinted:7002').montant === 45 && aid('vinted:7002').source === 'saisi', 'A2 · puis ses prix saisis sur les fiches reliées (20 + 25)', aid('vinted:7002') && String(aid('vinted:7002').montant));
  dit(aid('vinted:7003') && aid('vinted:7003').montant === 30 && aid('vinted:7003').source === 'article', 'A2 · sinon « article seul »');
  dit(aid('vinted:7008') && aid('vinted:7008').source === 'article', 'A2 · une fiche reliée sans prix ⇒ « article seul », jamais un saisi inventé');
  dit(aid('vinted:7009') && aid('vinted:7009').montant === 60 && aid('vinted:7009').source === 'article', 'A2 · un lot dont une fiche n’a pas de prix ⇒ « article seul », jamais une somme partielle présentée « saisie »', aid('vinted:7009') && `${aid('vinted:7009').montant} ${aid('vinted:7009').source}`);
  dit(aid('vinted:7007') && aid('vinted:7007').montant === null, 'A2 · autre devise ⇒ sans montant, jamais convertie');
  dit(aid('hors:ob1') && aid('hors:ob1').montant === 15.5 && aid('hors:ob1').num === '16', 'achat hors plateforme : son prix et son N° saisis');
  dit(aid('hors:ob2') && aid('hors:ob2').montant === null, 'achat hors plateforme sans prix : sans montant');
  dit(A.complet === false && A.articleSeul === 3 && A.sansMontant === 2 && M.resumeRegistre(A).some(([k, v]) => k === 'Total' && /^au moins /.test(v)), 'A2 · total « au moins », le manque nommé', JSON.stringify({ articleSeul: A.articleSeul, sansMontant: A.sansMontant }));
  dit(aid('vinted:7002').num === '12 + 13' && aid('vinted:7003').num === '' && !A.lignes.some((l) => /14/.test(l.num)), 'A3 · N° relié par buyFromId seulement (la fiche au même titre n’est reliée à rien)');
  const sA = A.lignes.reduce((s, l) => s + (l.montant == null ? 0 : Math.round(l.montant * 100)), 0);
  dit(Math.round(A.total * 100) === sA && sA === 4410 + 4500 + 3000 + 5000 + 6000 + 1550, 'total = somme des lignes', String(A.total));
  const cA = csvTotal(A);
  dit(cA.n === A.n && cA.total === sA && cA.vides === A.sansMontant, 'tableur des achats : mêmes lignes, même total', JSON.stringify({ n: cA.n, total: cA.total }));
  dit(/Article seul/.test(cA.texte) && /Reçu/.test(cA.texte), 'le tableur dit d’où vient chaque montant');
  {
    // Seul un « article seul » manque : le total reste « au moins » (le port et les frais n'y sont pas).
    const A2 = M.registreDesAchats({ achats: [achat(7003, 30, 'Transaction finalisée', D(10, 4))], fiches: {}, periode: '2026-11' });
    dit(A2.sansMontant === 0 && A2.complet === false && M.resumeRegistre(A2).some(([k, v]) => k === 'Total' && /^au moins /.test(v)), 'A2 · « article seul » seul : total « au moins » (port et frais absents)');
  }
  dit(M.registreDesAchats({ achats: null, periode: '2026-11' }).manque.includes('achats Vinted'), 'achats pas lus : nommés (« — », jamais 0)');

  // ── G. Les achats EN GROS (Achats → Fournisseurs) ───────────────────────────
  console.log('── Achats en gros');
  let FO = null;
  try { FO = await import('file://' + path.join(R0, 'src', 'fournisseurs.js')); } catch (e) { dit(false, 'src/fournisseurs.js se charge', e.message); }
  if (FO) {
    // Le registre tel qu'il est rangé (`vrm_fournisseurs`), relu par LA règle (`lireRegistre`).
    const regFo = FO.lireRegistre({
      personnes: { p1: { nom: 'Grossiste inventé', tel: '', email: '', note: '' }, p2: { nom: 'Autre grossiste', tel: '', email: '', note: '' } },
      achats: {
        g1: { fournisseur: 'p1', date: '2026-11-12', paires: 10, total: 30000, frais: 2500, repartition: { mode: 'egal', base: 'frais' }, parts: {}, gardes: {} },
        g2: { fournisseur: 'p1', date: '2026-10-20', paires: 3, total: 9000, frais: 0, repartition: { mode: 'egal', base: '' }, parts: {}, gardes: {} },
        g3: { fournisseur: 'p2', date: '2026-11-14', paires: 1, total: 4000, frais: 0, repartition: { mode: 'egal', base: '' }, parts: {}, gardes: {} },
      },
      hors: { ob3: { fournisseur: 'p1', at: '2026-11-05' } },
    });
    // Ses paires reliées PAR SON CLIC (`buyGros`), avec la part posée (32,50 € chacune).
    const fichesG = {
      ...fiches,
      g20: { numero: '20', buyGros: { id: 'g1', at: '1', part: 3250 }, buyPrice: '32,50' },
      g21: { numero: '21', buyGros: { id: 'g1', at: '2', part: 3250 }, buyPrice: '32,50' },
      g22: { numero: '22', buyGros: { id: 'g1', at: '3', part: 3250 }, buyPrice: '32,50', buyFromId: '7010' },   // reliée AUSSI à un achat Vinted (incohérent)
      g40: { numero: '40', buyGros: { id: 'g3', at: '1', part: 4000 }, buyPrice: '40' },
    };
    const achatsG = [...achats, achat(7010, 28, 'Transaction finalisée', D(10, 13))];
    const horsG = [...hors,
      { id: 'ob3', title: 'Paire rattachée au grossiste', price: '120', date: '2026-11-11', source: 'Fournisseur', numero: '30' },
      { id: 'ob4', title: 'Saisie à la main avant l’achat en gros', price: '35', date: '2026-11-11', source: 'Fournisseur', numero: '020' },
    ];
    const argsG = { achats: achatsG, hors: horsG, fiches: fichesG, periode: '2026-11', ventilationDe: (tx) => ventil[tx] || null, exclu: (o) => o._uid === '333',
      montantHors: (b) => { const p = parseFloat(String(b.price).replace(',', '.')); return isNaN(p) ? null : p; }, sourceHors: (s) => s, gros: regFo,
      cleNum: (v) => { let x = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(x)) x = String(parseInt(x, 10)); return x; } };
    const AG = M.registreDesAchats(argsG);
    const g = (id) => AG.lignes.find((l) => l.id === id);
    console.log('   novembre', JSON.stringify(AG.lignes.filter((l) => /^(gros|hors|vinted:7010)/.test(l.id) || /^fo:/.test(l.id)).map((l) => [l.date, l.id, l.fournisseur, l.paires, l.montant, l.frais, l.source, l.num])));
    const g1 = g('gros:g1');
    dit(!!g1 && g1.montant === 325 && g1.frais === 25 && g1.paires === '10' && g1.fournisseur === 'Grossiste inventé' && g1.date === '12/11/2026', 'G1 · un achat en gros = UNE ligne : date, fournisseur, 10 paires, 300 € + 25 € de frais = 325 €', JSON.stringify(g1));
    dit(!!g('gros:g3') && g('gros:g3').montant === 40 && g('gros:g3').frais == null, 'G1 · un achat en gros sans frais : son total seul (40 €)', JSON.stringify(g('gros:g3')));
    dit(!g('gros:g2') && AG.lignes.filter((l) => /^gros:/.test(l.id)).length === 2 && AG.nGros === 2, 'G1 · un achat en gros d’octobre n’est pas en novembre ; deux lignes en gros en novembre', String(AG.nGros));
    dit(!AG.lignes.some((l) => l.montant === 32.5), 'G2 · aucune ligne faite des parts posées sur ses paires (32,50 €)', JSON.stringify(AG.lignes.filter((l) => l.montant === 32.5)));
    const v10 = g('vinted:7010');
    dit(!!v10 && v10.montant === 28 && v10.source === 'article', 'G2 · un achat Vinted relié à une paire d’un achat en gros ne prend PAS la part du lot comme « saisi » (pas de double compte)', JSON.stringify(v10));
    dit(!!g1 && g1.num === '20 + 21 + 22', 'G1 · le N° des paires reliées par SON clic (buyGros), jamais par titre', g1 && g1.num);
    const o3 = AG.lignes.filter((l) => /ob3$/.test(l.id));
    dit(o3.length === 1 && o3[0].fournisseur === 'Grossiste inventé' && o3[0].montant === 120, 'G3 · achat hors plateforme rattaché au grossiste : UNE ligne, à son nom, 120 €', JSON.stringify(o3));
    dit(!!g1 && g1.montant === 325, 'G3 · il n’est pas ajouté à l’achat en gros (325 € reste 325 €)');
    const o4 = g('hors:ob4');
    dit(!!o4 && o4.montant === 35 && /à vérifier/.test(o4.raison) && AG.aVerifier === 1 && M.resumeRegistre(AG).some(([, , k]) => k === 'a-verifier'), 'G4 · un achat hors plateforme au N° d’une paire de l’achat en gros (« 020 » = N°20) : gardé, dit « à vérifier »', JSON.stringify(o4));
    const sG = AG.lignes.reduce((t, l) => t + (l.montant == null ? 0 : Math.round(l.montant * 100)), 0);
    dit(Math.round(AG.total * 100) === sG && sG === Math.round(A.total * 100) + 32500 + 4000 + 2800 + 12000 + 3500, 'G2 · total = somme des lignes = le registre d’avant + 325 + 40 + 28 + 120 + 35 (rien deux fois)', `${AG.total}`);
    const anG = M.registreDesAchats({ ...argsG, periode: '2026' });
    dit(anG.lignes.some((l) => l.id === 'gros:g2' && l.montant === 90) && anG.nGros === 3, 'G1 · l’année compte ses trois achats en gros', String(anG.nGros));
    // Un fournisseur retiré emporte ses achats en gros (la règle de `sansFournisseur`).
    const sansP2 = FO.sansFournisseur(regFo, 'p2').registre;
    dit(!M.registreDesAchats({ ...argsG, gros: sansP2 }).lignes.some((l) => l.id === 'gros:g3'), 'G1 · un fournisseur retiré : ses achats en gros ne sont plus dans le registre');
    dit(M.registreDesAchats({ ...argsG, gros: null }).nGros === 0, 'G1 · aucun registre de fournisseurs : aucune ligne en gros (rien d’inventé)');
    // G5 — le tableur suit.
    const CG = lireCsv(M.csvRegistre(AG, { maintenant: T(10, 20) }));
    const iH = CG.findIndex((r) => r[0] === 'Date'), iT = CG.findIndex((r, i) => i > iH && r[0] === 'Total');
    const iP = CG[iH].indexOf('Paires'), iF = CG[iH].indexOf('Dont frais'), iMm = CG[iH].indexOf('Montant');
    const rg = CG.slice(iH + 1, iT).find((r) => r.includes('Grossiste inventé') && r[iP] === '10');
    dit(iP > 0 && iF > 0 && !!rg && rg[iMm] === '325,00' && rg[iF] === '25,00', 'G5 · tableur : colonnes « Paires » et « Dont frais » ; la ligne en gros dit 10 · 325,00 · 25,00', JSON.stringify(rg));
    const sCsv = CG.slice(iH + 1, iT).reduce((t, r) => t + (r[iMm] ? Math.round(Number(r[iMm].replace(',', '.')) * 100) : 0), 0);
    dit(sCsv === sG && Math.round(Number(CG[iT][iMm].replace(',', '.')) * 100) === sG, 'G5 · tableur : total = somme des lignes', String(sCsv));
    const tCsv = CG.map((r) => r.join(' ')).join('\n');
    dit(/À vérifier/.test(tCsv) && /Achats en gros/.test(tCsv), 'G5 · tableur : le résumé dit les achats en gros et « à vérifier »');
    let pdfG = '';
    try {
      const NM = fs.realpathSync(path.join(R0, 'node_modules'));
      const PDFLib = require(path.join(NM, 'pdf-lib'));
      const octG = await M.pdfRegistre(AG, { PDFLib, maintenant: T(10, 20) });
      const pdfjs = await importerPdfjs(NM);
      const doc = await pdfjs.getDocument({ data: new Uint8Array(octG), isEvalSupported: false, useSystemFonts: false, standardFontDataUrl: path.join(NM, 'pdfjs-dist', 'standard_fonts') + '/' }).promise;
      for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const tc = await p.getTextContent(); pdfG += tc.items.map((x) => x.str).join(' ') + '\n'; }
    } catch (e) { pdfG = ''; dit(false, 'G5 · le PDF des achats se crée et se relit', e.message); }
    const pg = pdfG.replace(/[\u00a0\u202f]/g, ' ');
    dit(!!pdfG && /Grossiste invent/.test(pg) && /Dont frais/.test(pg) && /325,00/.test(pg) && pg.includes(M.eurosTexte(AG.total).replace(/[\u00a0\u202f]/g, ' ').replace('−', '-')), 'G5 · le PDF : le grossiste, « Dont frais », 325,00 et le total');
    // G6 — la carte passe le registre des fournisseurs, lu par LA règle.
    // (9 nov.) L'écriture du registre vit dans `registreAchatsDe`, partagée avec l'export comptable :
    // la carte doit l'appeler, et l'helper doit passer les achats en gros.
    const carteG = sansCommentaires(extraire(APP, 'RegistresCarte')).includes('registreAchatsDe(') ? sansCommentaires(extraire(APP, 'registreAchatsDe')) : '';
    dit(/gros: lireRegistre\(load\(CLE_FOURNISSEURS, null\)\)/.test(carteG), 'G6 · la carte Registres passe les achats en gros (lireRegistre de vrm_fournisseurs)');
  }

  // ── A4. La carte : les dépenses ne vont pas dans le registre des achats ─────
  const carte0 = sansCommentaires(extraire(APP, 'RegistresCarte'));
  // (9 nov.) Les deux écritures partagées avec « Exporter pour mon comptable » : jugées seulement si la carte les APPELLE.
  const carte = carte0 + (carte0.includes('registreAchatsDe(') ? sansCommentaires(extraire(APP, 'registreAchatsDe')) : '') + (carte0.includes('recettesDe(') ? sansCommentaires(extraire(APP, 'recettesDe')) : '');
  const appel = (carte.match(/registreDesAchats\(\{[\s\S]*?\}\);/) || [''])[0];
  dit(!!appel && !/compta|depense|charges/i.test(appel), 'A4 · la carte ne passe aucune dépense au registre des achats');
  dit(/useDeclarablesCompta\(/.test(carte) && /livreDesRecettes\(\{ decl: calc\.decl/.test(carte), 'la carte lit les recettes par la lecture partagée (la même que Factur-X)');
  dit(/const annule = achatAnnule;/.test(APP), '« Dépensé » (écran Achats) et le registre : la même règle d’annulation');

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  console.log(ko ? `\n❌ registres : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ registres : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
