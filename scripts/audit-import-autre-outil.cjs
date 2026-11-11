#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — IMPORTER SON STOCK ET SES VENTES PASSÉES (11 nov.)
//          node scripts/audit-import-autre-outil.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
//   S  stock (src/importStock.js EXÉCUTÉ) : en-têtes FR/EN reconnus (« Prix » seul
//      n'est PAS un prix d'achat), CSV « ; » d'Excel Windows, .xlsx VRAI (zip fabriqué
//      ici), dates JJ/MM/AAAA, « 12,50 € » ; un N° déjà dans VRM ou deux fois dans le
//      fichier ⇒ CONFLIT (jamais écrit) ; montant illisible ⇒ VIDE et dit (la ligne
//      reste) ; N° traduit par la date (remise à zéro), pas su ⇒ rien ; un coût n'est
//      posé que sur un N° sans coût ; 50 paires au même titre entrent toutes ;
//   V  ventes : CSV « , » aux montants « 12,50 € » entre guillemets ; datées comme dans
//      le fichier (illisible ⇒ écartée) ; une vente Vinted/Leboncoin/eBay/Vestiaire
//      SANS n° de commande est « à vérifier » (pas importée sans sa case) ; même n°
//      qu'une vente lue ⇒ « déjà là » ; les VRAIES règles de l'app (ventesDeclarables,
//      ventesFaites, extraites de App.jsx et exécutées) : le CA est daté au VERSEMENT,
//      sans versement ⇒ « à dater » (dans AUCUN mois), montant vide ⇒ nommé, une
//      vente lue APRÈS l'import (même n°) ne compte pas deux fois ;
//   A  annuler : tout ce que l'import a créé, rien d'autre (autre import, coût corrigé
//      à la main gardés) ; le pool de N° n'est jamais réécrit par l'annulation ;
//   P  proposer, jamais relier : même marque, un mot de modèle commun, annonce sans N° ;
//      « Relier » n'existe que sur SON clic ;
//   T  2 000 lignes : l'aperçu se calcule par tranches (l'écran respire entre deux) ;
//   W  le branchement : Paramètres → Importer, clés synchronisées, N° relus au moment
//      d'écrire, pool append-only, les écrans de chiffres passent `importees`.
// `--prouve` : chaque règle réaffaiblie ⇒ ROUGE exigé. Données inventées.
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib'), vm = require('vm');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');

if (process.argv.includes('--prouve')) {
  const MUTS = [
    ['un N° déjà dans VRM accepté', 'src/importStock.js', "if (pris) return { ...L, etat: 'conflit'", "if (false && pris) return { ...L, etat: 'conflit'"],
    ['un N° deux fois dans le fichier accepté', 'src/importStock.js', 'if (numsFichier.has(k2))', 'if (false && numsFichier.has(k2))'],
    ['un prix illisible écarte la ligne', 'src/importStock.js', "if (!p.ok) L.notes.push('prix illisible : laissé vide');", "if (!p.ok) return { ...L, etat: 'ecartee', raison: 'Prix illisible', apercu };"],
    ['« Prix » seul lu comme prix d’achat', 'src/importStock.js', "['prix', /^(prix d achat|", "['prix', /^(prix|prix d achat|"],
    ['N° pris tel quel (sans la date)', 'src/importStock.js', 'const numero = numeroDe ? numeroDe(brut, ms) : brut;', 'const numero = brut;'],
    ['coût posé sur un N° qui en a un', 'src/importStock.js', 'if (rec.prix && !coutExiste(rec.numero)', 'if (rec.prix'],
    ['vente sans date ⇒ aujourd’hui', 'src/importStock.js', "const date = dateDuFichier(val(r, 'date'));\n    const pBrut", "const date = dateDuFichier(val(r, 'date')) || '2026-11-11';\n    const pBrut"],
    ['Vinted sans n° importée d’office', 'src/importStock.js', '&& !avecSansRef) return', '&& false) return'],
    ['doublon par le titre', 'src/importStock.js', 'const ref = refVente(refBrute);', 'const ref = refVente(refBrute) || refVente(titre);'],
    ['CA daté à la vente (pas au versement)', 'src/App.jsx', "const t = /^\\d{4}-\\d{2}-\\d{2}$/.test(String(v.versement || '')) ? Date.parse(v.versement + 'T12:00:00') : 0;", "const t = Date.parse((v.versement || v.date) + 'T12:00:00') || 0;"],
    ['vente lue après l’import comptée deux fois', 'src/App.jsx', "if (!v || !v.id || dejaLueImp(v)) continue;\n    const id = 'importe:'", "if (!v || !v.id) continue;\n    const id = 'importe:'"],
    ['montant vide compté 0 €', 'src/App.jsx', "if (eur == null) { vus.add(id); ecartees.push({ id, plateforme: pl, raison: 'montant vide dans ton fichier'", "if (false) { vus.add(id); ecartees.push({ id, plateforme: pl, raison: 'montant vide dans ton fichier'"],
    ['annuler retire un coût corrigé à la main', 'src/importStock.js', 'if (nCouts[n] === p) { delete nCouts[n]; coutsRetires++; }', 'if (n in nCouts) { delete nCouts[n]; coutsRetires++; }'],
    ['annuler retire un autre import', 'src/importStock.js', 'const garde = (x) => !(x && (x.importId === imp.id || ids.has(x.id)));', 'const garde = (x) => !(x && x.source === SOURCE_IMPORT);'],
    ['proposition d’une autre marque', 'src/importStock.js', 'if (bi && ba && bi !== ba) continue;', ''],
    ['l’écriture ne relit plus les N° servis', 'src/App.jsx', 'const pris2 = w.items.filter((x) => pris.has(cleNum(x.numero)));', 'const pris2 = [];'],
    ['l’aperçu d’un bloc (sans tranches)', 'src/importStock.js', 'export const TRANCHE = 250;', 'export const TRANCHE = 100000;'],
  ];
  let rouges = 0;
  const sauf = new Map();
  process.on('exit', () => { for (const [f, s] of sauf) fs.writeFileSync(f, s); });
  for (const [nom, rel, avant, apres] of MUTS) {
    const f = path.join(R, rel);
    const src = fs.readFileSync(f, 'utf8');
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : motif introuvable`); continue; }
    sauf.set(f, src);
    try {
      fs.writeFileSync(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 180000 });
      if (r.status !== 0) rouges++;
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${r.status !== 0 ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(f, src); sauf.delete(f); }
  }
  const ok = rouges === MUTS.length;
  console.log(`\n${ok ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(ok ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d !== '' && d != null ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 600)); } };
const imp = (rel) => import('file://' + path.join(R, rel) + '?t=' + Date.now());

// Un vrai .xlsx (zip) : `fichiers` = { nom: texte }, `stocke` = noms laissés sans compression.
function zip(fichiers, stocke = []) {
  const locaux = [], centraux = []; let off = 0;
  for (const [nom, texte] of Object.entries(fichiers)) {
    const brut = Buffer.from(texte, 'utf8');
    const methode = stocke.includes(nom) ? 0 : 8;
    const data = methode ? zlib.deflateRawSync(brut) : brut;
    const n = Buffer.from(nom, 'utf8');
    const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(methode, 8);
    loc.writeUInt32LE(data.length, 18); loc.writeUInt32LE(brut.length, 22); loc.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(methode, 10);
    cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(brut.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(off, 42);
    locaux.push(loc, n, data); centraux.push(cen, n); off += 30 + n.length + data.length;
  }
  const c = Buffer.concat(centraux);
  const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(Object.keys(fichiers).length, 8); fin.writeUInt16LE(Object.keys(fichiers).length, 10);
  fin.writeUInt32LE(c.length, 12); fin.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...locaux, c, fin]));
}

// Les règles de l'APP (ventesDeclarables, ventesFaites…) extraites de App.jsx et exécutées.
async function reglesApp() {
  const parser = require('@babel/parser');
  const app = require('./_source-app.cjs').sourceApp();
  const ast = parser.parse(app, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const NOMS = ['classifyOrderStatus', 'tsCommande', 'montantCommande', 'montantCommandeLu', 'lbcAnnulee', 'lbcFinalisee', 'lbcExpediee', 'venteFinalisee', 'commandeEbayEngagee', 'montantRecuEbay', 'ymDeTs', 'indexDeclarations', 'moisDeclare', 'ventesDeclarables', 'ventesFaites'];
  const decl = {};
  for (const n of ast.program.body) {
    const d0 = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
    if (!d0 || d0.type !== 'VariableDeclaration') continue;
    for (const d of d0.declarations) if (d.id && NOMS.includes(d.id.name) && !decl[d.id.name]) decl[d.id.name] = 'const ' + app.slice(d.start, d.end) + ';';
  }
  const ctx = vm.createContext({});
  const vcR = await import('file://' + path.join(R, 'api', '_lib', 'vestiaire-regle.js'));
  for (const k of Object.keys(vcR)) ctx[k] = vcR[k];
  for (const n of NOMS) { if (!decl[n]) throw new Error(n + ' introuvable dans App.jsx'); vm.runInContext(decl[n] + `\nthis.${n} = ${n};`, ctx); }
  return ctx;
}

(async () => {
  const M = await imp('src/importStock.js');
  const A = await imp('src/importAchats.js');
  const lireFichier = async (nom, octets) => { const r = await A.lireFichierAchats({ nom, octets }); if (r.erreur) throw new Error(r.erreur); return r.rows; };

  // ── S ─────────────────────────────────────────────────────────────────────
  console.log('── S. le stock');
  await essaie('S', async () => {
    const cS = M.reconnaitreColonnes('stock', ['N°', 'Désignation', 'Prix d’achat', 'Date d’achat', 'Emplacement', 'Remarques']);
    dit(cS.join() === 'numero,titre,prix,date,emplacement,notes', 'en-têtes FR reconnus', cS);
    const cE = M.reconnaitreColonnes('stock', ['SKU', 'Product', 'Cost', 'Purchase date', 'Location', 'Notes']);
    dit(cE.join() === 'numero,titre,prix,date,emplacement,notes', 'en-têtes EN reconnus', cE);
    dit(M.reconnaitreColonnes('stock', ['N°', 'Prix'])[1] === '', '« Prix » seul n’est PAS lu comme prix d’achat (il le choisit)');
    dit(M.colonnesManquantes('stock', ['titre']).join() === 'numero', 'le N° manquant est NOMMÉ');
    dit(M.changerColonne(['numero', 'titre'], 1, 'numero').join() === ',numero', 'un champ choisi quitte l’autre colonne (un geste)');

    // Un fichier FR « ; », encodage d'Excel Windows, dates JJ/MM/AAAA, « 12,50 € ».
    // windows-1252 : « € » = 0x80, « ’ » = 0x92, le reste comme latin1.
    const cp1252 = (t) => Buffer.from([...t].map((c) => (c === '€' ? 0x80 : c === '’' ? 0x92 : c.charCodeAt(0))));
    const csv = cp1252([
      'N°;Désignation;Prix d’achat;Date d’achat;Emplacement;Remarques',
      '12;Nike Air Max 90 blanche 42;12,50 €;03/04/2026;Étagère A;semelle à nettoyer',
      '13;Adidas Samba noire 41;vingt euros;05/04/2026;Étagère A;',
      '14;Nike Dunk Low panda 43;;31/02/2026;Carton 3;',
      '12;Doublon du 12;10,00 €;06/04/2026;;',
      '7;Déjà dans VRM;30 €;06/04/2026;;',
      ';Sans numéro;5 €;06/04/2026;;',
      'ABC;Pas un numéro;5 €;06/04/2026;;',
      ...Array.from({ length: 50 }, (_, i) => `${100 + i};Air Max 90 blanche 43;40,00 €;07/04/2026;Bac 2;`),
    ].join('\r\n'));
    const rows = await lireFichier('stock.csv', new Uint8Array(csv));
    dit(rows.length === 58 && rows[0][1] === 'Désignation' && rows[1][2] === '12,50 €', 'CSV « ; » d’Excel Windows lu (accents)', rows.slice(0, 2));
    const pris = new Map([['7', 'est déjà sur une annonce']]);
    const ctx = { numeroDe: (v) => { const k = String(v).trim().toUpperCase(); return /^([A-Z]{1,3})?\d{1,6}$/.test(k) ? k.replace(/^0+(?=\d)/, '') : ''; }, numeroPris: (n) => pris.get(String(n)) || '', archive: '' };
    const L = M.apercu('stock', { rows, colonnes: M.reconnaitreColonnes('stock', rows[0]), ...ctx });
    const e = (n) => L.find((l) => l.n === n);
    dit(e(2).etat === 'ok' && e(2).rec.prix === '12,50' && e(2).rec.date === '2026-04-03' && e(2).rec.emplacement === 'Étagère A' && e(2).rec.notes === 'semelle à nettoyer', '« 12,50 € » et 03/04/2026 lus (jour/mois), emplacement et notes gardés', e(2));
    dit(e(3).etat === 'ok' && e(3).rec.prix === '' && e(3).notes.includes('prix illisible : laissé vide'), 'montant illisible ⇒ VIDE et dit (la ligne reste)', e(3));
    dit(e(4).etat === 'ok' && e(4).rec.date === '' && e(4).notes.includes('date illisible : laissée vide') && e(4).rec.prix === '', 'date impossible (31/02) ⇒ vide et dite, jamais devinée', e(4));
    dit(e(5).etat === 'conflit' && /deux fois/.test(e(5).raison), 'le même N° deux fois dans le fichier ⇒ conflit', e(5));
    dit(e(6).etat === 'conflit' && /déjà sur une annonce/.test(e(6).raison) && /rien n’est changé/.test(e(6).raison), 'un N° déjà dans VRM ⇒ conflit montré, rien n’est changé', e(6));
    dit(e(7).etat === 'ecartee' && e(8).etat === 'ecartee', 'sans N° / pas un N° ⇒ ignorée et dite');
    const r = M.resume(L);
    dit(r.ok === 53 && r.conflits === 2 && r.ecartees === 2, '50 paires au même titre entrent toutes (le N° est l’identité)', r);
    // ecritures : un coût seulement sur un N° sans coût ; la source « importe »
    let k = 0;
    const w = M.ecritures('stock', L, { nouvelId: () => 'si_' + (++k), importId: 'imp_1', nom: 'stock.csv', coutExiste: (n) => n === '100' });
    dit(w.items.length === 53 && w.items.every((x) => x.source === 'importe' && x.importId === 'imp_1') && !w.items.some((x) => x.numero === '7'), 'ce qui part : les 53 lignes à importer, marquées « importe », jamais le N° en conflit');
    dit(w.couts['12'] === '12,50' && !('13' in w.couts) && !('100' in w.couts) && w.couts['101'] === '40,00', 'coût posé par N° seulement s’il n’en a aucun ; prix vide ⇒ aucun coût', w.couts);
    dit(w.journal.n === 53 && w.journal.ids.length === 53 && w.journal.numeros.length === 53, 'le journal retient ce que l’import a créé (pour « Annuler »)');
    // Remise à zéro : le N° suit la date (numeroDe de l'app), pas su ⇒ ignorée.
    const rowsB = [['N°', 'Désignation', 'Date d’achat'], ['230', 'Vieille paire', '01/09/2026'], ['230', 'Sans date', ''], ['B12', 'Archive tapée', '01/11/2026'], ['5', 'Nouvelle', '01/11/2026']];
    const cut = Date.parse('2026-10-09T00:00:00');
    const numeroDe = (v, ms) => { const kk = String(v).trim().toUpperCase(); if (!/^([A-Z]{1,3})?\d{1,6}$/.test(kk)) return ''; if (/^\d+$/.test(kk) && !(ms != null && isFinite(ms))) return null; return /^\d+$/.test(kk) && ms < cut ? 'B' + kk : kk; };
    const LB = M.apercu('stock', { rows: rowsB, colonnes: M.reconnaitreColonnes('stock', rowsB[0]), numeroDe, numeroPris: () => '', archive: 'B' });
    dit(LB[0].etat === 'ok' && LB[0].numero === 'B230' && LB[0].notes.some((x) => /avant la remise à zéro/.test(x)), '« 230 » d’avant la remise à zéro = B230 (la règle de l’app), et c’est dit', LB[0]);
    dit(LB[1].etat === 'ecartee' && /pas su/.test(LB[1].raison), 'sans date ⇒ N° pas su ⇒ ignorée (jamais devinée)', LB[1]);
    dit(LB[2].etat === 'ecartee' && /archive/.test(LB[2].raison), '« B12 » tapé : l’archive ne reçoit pas de nouveaux N°', LB[2]);
    dit(LB[3].etat === 'ok' && LB[3].numero === '5', 'un N° d’après la remise à zéro reste le sien');
    // Un vrai .xlsx (deflate + stocké) : nombres Excel (date, prix).
    const ss = '<sst><si><t>Numéro</t></si><si><t>Article</t></si><si><t>Coût</t></si><si><t>Date</t></si><si><t>Rangement</t></si><si><t>Puma Suede bleue</t></si><si><t>Bac 4</t></si></sst>';
    const f = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c></row>'
      + '<row r="2"><c r="A2"><v>21</v></c><c r="B2" t="s"><v>5</v></c><c r="C2"><v>12.5</v></c><c r="D2" s="1"><v>46115</v></c><c r="E2" t="s"><v>6</v></c></row></sheetData></worksheet>';
    const x = zip({ 'xl/workbook.xml': '<workbook><sheets><sheet name="Stock" sheetId="1" r:id="rId1"/></sheets></workbook>', 'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>', 'xl/sharedStrings.xml': ss, 'xl/worksheets/sheet1.xml': f }, ['xl/sharedStrings.xml']);
    const rx = await lireFichier('stock.xlsx', x);
    const LX = M.apercu('stock', { rows: rx, colonnes: M.reconnaitreColonnes('stock', rx[0]), ...ctx });
    dit(LX.length === 1 && LX[0].etat === 'ok' && LX[0].rec.numero === '21' && LX[0].rec.prix === '12,50' && LX[0].rec.date === '2026-04-03' && LX[0].rec.emplacement === 'Bac 4', '.xlsx VRAI : N°, coût 12,50, date Excel, emplacement', LX[0] && (LX[0].rec || LX[0].raison));
  });

  // ── V ─────────────────────────────────────────────────────────────────────
  console.log('\n── V. les ventes passées');
  await essaie('V', async () => {
    const cV = M.reconnaitreColonnes('ventes', ['Date de vente', 'Article', 'Prix de vente', 'Plateforme', 'Date de versement', 'N° de commande', 'N°']);
    dit(cV.join() === 'date,titre,prix,plateforme,versement,ref,numero', 'en-têtes FR reconnus (« Date de versement » ≠ « Date de vente »)', cV);
    const cVe = M.reconnaitreColonnes('ventes', ['Sold date', 'Item', 'Sale price', 'Platform', 'Payout date', 'Order ID']);
    dit(cVe.join() === 'date,titre,prix,plateforme,versement,ref', 'en-têtes EN reconnus', cVe);
    const csv = [
      'Date de vente,Article,Prix de vente,Plateforme,Date de versement,N° de commande',
      '02/09/2026,Nike Air Max 90,"45,00 €",Vinted,05/09/2026,9001',        // datée au versement (septembre)
      '28/09/2026,Samba noire,"12,50 €",Vinted,02/10/2026,9002',            // vendue en septembre, versée en octobre
      '10/10/2026,Dunk panda,"60,00 €",Leboncoin,,LBC-77',                  // sans versement ⇒ à dater
      '11/10/2026,Lot vrac,"quinze",Brocante,,',                             // montant illisible ⇒ vide, nommé
      '12/10/2026,Air Force 1,"30,00 €",Vinted,,',                           // Vinted sans n° ⇒ à vérifier
      'demain,Date fausse,"10,00 €",Vinted,,9003',                           // date illisible ⇒ écartée
      '13/10/2026,Déjà lue,"20,00 €",Vinted,15/10/2026,5555',                // même n° qu'une vente lue ⇒ déjà là
      '14/10/2026,Doublon,"20,00 €",Vinted,16/10/2026,9001',                 // même n° dans le fichier ⇒ déjà là
    ].join('\n');
    const rows = await lireFichier('ventes.csv', new Uint8Array(Buffer.from('﻿' + csv, 'utf8')));
    dit(rows.length === 9 && rows[1][2] === '45,00 €', 'CSV « , » aux montants entre guillemets', rows[1]);
    const opts = { rows, colonnes: M.reconnaitreColonnes('ventes', rows[0]), refsLues: new Set(['vinted:5555']), refsImportees: new Set() };
    const L = M.apercu('ventes', opts);
    const e = (n) => L.find((l) => l.n === n);
    dit(e(2).etat === 'ok' && e(2).rec.date === '2026-09-02' && e(2).rec.versement === '2026-09-05' && e(2).rec.prix === '45,00' && e(2).rec.plateforme === 'Vinted', 'datée comme dans le fichier (vente et versement)', e(2));
    dit(e(4).etat === 'ok' && e(4).rec.versement === '' && e(4).notes.some((x) => /à dater/.test(x)), 'sans versement ⇒ « à dater » dit sur la ligne', e(4));
    dit(e(5).etat === 'ok' && e(5).rec.prix === '' && e(5).notes.some((x) => /montant illisible/.test(x)) && e(5).rec.plateforme === 'Autre', 'montant illisible ⇒ vide et dit (hors des totaux)', e(5));
    dit(e(6).etat === 'averifier' && !M.ecritures('ventes', L, { nouvelId: () => 'x', importId: 'i' }).items.some((x) => x.titre === 'Air Force 1'), 'Vinted sans n° de commande ⇒ « à vérifier », pas importée', e(6));
    dit(e(7).etat === 'ecartee' && /Date de vente illisible/.test(e(7).raison), 'date de vente illisible ⇒ écartée (jamais « aujourd’hui »)', e(7));
    dit(e(8).etat === 'double' && /Déjà lue par VRM/.test(e(8).raison), 'même n° qu’une vente lue par VRM ⇒ déjà là', e(8));
    dit(e(9).etat === 'double' && /Deux fois dans le fichier/.test(e(9).raison), 'même n° deux fois dans le fichier ⇒ déjà là', e(9));
    const L2 = M.apercu('ventes', { ...opts, avecSansRef: true });
    dit(L2.find((l) => l.n === 6).etat === 'ok', 'sa case cochée ⇒ la vente sans n° entre (son choix)');
    let k = 0;
    const w = M.ecritures('ventes', L, { nouvelId: () => 'vi_' + (++k), importId: 'imp_v' });
    dit(w.items.length === 4 && w.items.every((x) => x.source === 'importe'), 'les 4 ventes importées sont marquées « importe »', w.items.length);

    // Les VRAIES règles de l'app.
    const ctx = await reglesApp();
    const lue = { transaction_id: 5555, title: 'Déjà lue', status: 'Commande finalisée', date: '2026-10-13T10:00:00Z', price: { amount: '20.0' }, _acc: { vinted_user_id: '1' } };
    const d = ctx.ventesDeclarables({ vinted: [lue], versements: { 5555: '2026-10-15T10:00:00Z' }, importees: w.items });
    const parId = (id) => d.lignes.find((l) => l.id === 'importe:' + id);
    const v1 = w.items.find((x) => x.ref === '9001'), v2 = w.items.find((x) => x.ref === '9002'), v3 = w.items.find((x) => x.ref === 'LBC-77'), v4 = w.items.find((x) => x.titre === 'Lot vrac');
    dit(parId(v1.id) && parId(v1.id).ym === '2026-09' && parId(v1.id).eur === 45, 'CA déclaré : 45 € dans septembre (versée le 5)', parId(v1.id));
    dit(parId(v2.id) && parId(v2.id).ym === '2026-10', 'vendue en septembre, versée en octobre ⇒ dans OCTOBRE (au versement)', parId(v2.id));
    dit(!parId(v3.id) && d.aDater.some((l) => l.id === 'importe:' + v3.id && l.importee), 'sans versement ⇒ « à dater », dans AUCUN mois', d.aDater.map((l) => l.id));
    dit(d.ecartees.some((l) => l.id === 'importe:' + v4.id && l.manque), 'montant vide ⇒ mis à part et NOMMÉ (« au moins »), jamais 0 €', d.ecartees);
    const f = ctx.ventesFaites({ vinted: [lue], importees: w.items });
    const imps = f.lignes.filter((l) => l.importee);
    dit(imps.length === 3 && imps.some((l) => l.ts === Date.parse('2026-09-28T12:00:00') && l.eur === 12.5), 'VENDU : au jour de la VENTE écrit dans le fichier', imps);
    dit(f.nonComptees.some((l) => /montant vide/.test(l.raison)), 'VENDU : le montant vide est nommé');
    // Une vente lue APRÈS l'import, même n° : comptée une fois.
    const lueApres = { transaction_id: 9001, title: 'Nike Air Max 90', status: 'Commande finalisée', date: '2026-09-02T10:00:00Z', price: { amount: '45.0' }, _acc: { vinted_user_id: '1' } };
    const d2 = ctx.ventesDeclarables({ vinted: [lueApres], versements: { 9001: '2026-09-05T10:00:00Z' }, importees: w.items });
    const f2 = ctx.ventesFaites({ vinted: [lueApres], importees: w.items });
    dit(d2.lignes.filter((l) => /9001|importe:vi_1$/.test(l.id) || l.id === 'importe:' + v1.id).length === 1 && f2.lignes.filter((l) => l.eur === 45).length === 1, 'la vente lue après l’import (même n°) ne compte pas deux fois', d2.lignes.map((l) => l.id));
    // Une vente au même titre et au même prix SANS n° commun : jamais confondue (rien par ressemblance).
    const sosie = { transaction_id: 7777, title: 'Samba noire', status: 'Commande finalisée', date: '2026-09-28T10:00:00Z', price: { amount: '12.5' }, _acc: { vinted_user_id: '1' } };
    const f3 = ctx.ventesFaites({ vinted: [sosie], importees: w.items });
    dit(f3.lignes.filter((l) => l.eur === 12.5).length === 2, 'même titre et même prix sans n° commun : deux ventes (aucun rapprochement par ressemblance)');
  });

  // ── A ─────────────────────────────────────────────────────────────────────
  console.log('\n── A. annuler un import');
  await essaie('A', async () => {
    const stock = [{ id: 's1', importId: 'i1', numero: '1' }, { id: 's2', importId: 'i1', numero: '2' }, { id: 's3', importId: 'i2', numero: '3' }];
    const couts = { 1: '10,00', 2: '15,00', 9: '7,00' };
    const imp1 = { id: 'i1', type: 'stock', ids: ['s1', 's2'], couts: { 1: '10,00', 2: '12,00' } };   // le 2 a été corrigé à la main (15)
    const r = M.annulerImport(imp1, { stock, couts, imports: [imp1, { id: 'i2' }] });
    dit(r.stock.length === 1 && r.stock[0].id === 's3', 'retire ce que CET import a créé, garde l’autre import');
    dit(!('1' in r.couts) && r.couts['2'] === '15,00' && r.couts['9'] === '7,00' && r.coutsRetires === 1, 'un coût corrigé à la main reste ; un coût d’ailleurs reste', r.couts);
    dit(r.imports.length === 1 && r.imports[0].id === 'i2', 'le journal perd seulement cet import');
    const app = lire('src/App.jsx');
    const bloc = app.slice(app.indexOf('  annuler: async (imp) => {'), app.indexOf('  // Les annonces Vinted lues dans CET onglet'));
    dit(bloc.length > 100 && !/vinted_used_numeros/.test(bloc) && !/vinted_annonce_numeros/.test(bloc), 'annuler ne réécrit ni le pool de N° (append-only) ni les fiches');
  });

  // ── P ─────────────────────────────────────────────────────────────────────
  console.log('\n── P. proposer, jamais relier');
  await essaie('P', async () => {
    const marqueDe = (t) => (/nike/i.test(t) ? 'Nike' : /adidas/i.test(t) ? 'Adidas' : '');
    const it = { numero: '12', titre: 'Nike Air Max 90 blanche 42' };
    const annonces = [{ id: 'a1', titre: 'Adidas Air Max 90', numero: '' }, { id: 'a2', titre: 'Nike Air Max 90 blanc 42', numero: '5' }, { id: 'a3', titre: 'Nike blanche 42', numero: '' }, { id: 'a4', titre: 'Nike Air Max 90 42', numero: '' }];
    const p = M.propositionAnnonce(it, annonces, { marqueDe });
    dit(p && p.annonce.id === 'a4', 'proposée : même marque, un mot de modèle commun, sans N°', p);
    dit(!M.propositionAnnonce(it, annonces.slice(0, 3), { marqueDe }), 'autre marque, annonce déjà numérotée, aucun mot de modèle commun (couleur, taille) ⇒ rien');
    const comp = lire('src/composants/ImportStock.jsx');
    dit((comp.match(/outils\.relier\(/g) || []).length === 1 && /onClick=\{\(\) => relier\(it, a\)\}/.test(comp), '« Relier » n’existe que sur son clic');
    const app = lire('src/App.jsx');
    const rel = app.slice(app.indexOf('  relier: async (it, a) => {'), app.indexOf('function ImporterSetting()'));
    dit(/déjà le N°/.test(rel) && /déjà sur une autre annonce/.test(rel) && /noterJournalNumeros\(fiches, apres\)/.test(rel), 'relier : jamais sur une annonce numérotée ni avec un N° pris ; le journal des N° le note');
  });

  // ── T ─────────────────────────────────────────────────────────────────────
  console.log('\n── T. 2 000 lignes sans figer l’écran');
  await essaie('T', async () => {
    const rows = [['N°', 'Désignation', 'Prix d’achat', 'Date d’achat'], ...Array.from({ length: 2000 }, (_, i) => [String(i + 1), 'Paire ' + (i % 7), '12,50 €', '03/04/2026'])];
    let pauses = 0, plusLong = 0, t = Date.now();
    const out = await M.apercuParTranches('stock', { rows, colonnes: M.reconnaitreColonnes('stock', rows[0]), numeroDe: (v) => v, numeroPris: () => '' }, {
      attendre: () => { plusLong = Math.max(plusLong, Date.now() - t); pauses++; return new Promise((r) => setTimeout(() => { t = Date.now(); r(); }, 0)); },
    });
    plusLong = Math.max(plusLong, Date.now() - t);
    dit(out.length === 2000 && M.resume(out).ok === 2000, '2 000 lignes lues, toutes à importer');
    dit(pauses >= 7, `l’écran respire entre les tranches (${pauses} pauses)`);
    dit(plusLong < 100, `aucune tranche ne tient la main plus de 100 ms (${plusLong} ms)`);
  });

  // ── W ─────────────────────────────────────────────────────────────────────
  console.log('\n── W. le branchement');
  await essaie('W', async () => {
    const app = lire('src/App.jsx'), reg = lire('src/ecrans/Reglages.jsx'), compta = lire('src/ecrans/Compta.jsx');
    dit(/\{ id:'importer', type:'panneau'[^\n]*el:<ImporterSetting\/>/.test(reg), 'Paramètres → Importer');
    const sync = app.slice(app.indexOf('const SYNC_KEYS = ['), app.indexOf('];', app.indexOf('const SYNC_KEYS = [')));
    dit(['vrm_stock_importe', 'vrm_ventes_importees', 'vrm_imports'].every((k) => sync.includes(`'${k}'`)), 'les trois clés sont synchronisées (un autre appareil les voit)');
    const ecr = app.slice(app.indexOf('  ecrire: async (mode, w) => {'), app.indexOf('  annuler: async (imp) => {'));
    dit(/numerosServisImport\(\)/.test(ecr) && /const pris2 = w\.items\.filter\(\(x\) => pris\.has\(cleNum\(x\.numero\)\)\);\s*if \(pris2\.length\) return \{ ok: false/.test(ecr) && /numerotationPermise\(\)/.test(ecr), 'au moment d’écrire : N° relus, un N° servi entre-temps ⇒ rien écrit');
    dit(/pool\.push\(ep\)/.test(ecr) && !/pool\.(splice|filter|pop|shift)/.test(ecr) && !/vinted_annonce_numeros/.test(ecr), 'pool append-only ; aucune fiche d’annonce touchée par l’import');
    dit(/couts\[n\] == null \|\| String\(couts\[n\]\)\.trim\(\) === ''/.test(ecr), 'un coût déjà là n’est jamais remplacé (relu au moment d’écrire)');
    const nApp = (app.match(/importees: (ventesImp|lireVentesImportees\(\))/g) || []).length, nCompta = (compta.match(/importees: lireVentesImportees\(\)/g) || []).length;
    dit(nApp >= 5 && nCompta >= 3, `les écrans de chiffres passent les ventes importées (${nApp} + ${nCompta})`);
    const srv = lire('api/_lib/ventes-regle.js');
    dit(/importees/.test(srv), 'la copie serveur des règles (refabriquée) les connaît');
    dit(/'importee'/.test(lire('src/versementRaisons.js')) && /data-adater-raison="importee"/.test(compta), '« à dater » dit la raison des ventes importées, avec le geste');
  });

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
