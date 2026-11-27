// ════════════════════════════════════════════════════════════════════════════
// AUDIT : L'EXPORT POUR L'EXPERT-COMPTABLE — DÉPENSES NOTÉES ET REÇU PAR SITE
//         node scripts/audit-export-depenses.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// (23 nov., lot export-comptable) Julien (validé le 23 nov.) : l'export mensuel /
// annuel dit les ventes (date de vente, date de versement, plateforme, montant
// reçu), les achats, les FRAIS et les VERSEMENTS, par les règles de l'app, la
// couverture affichée (manques nommés), jamais « encaissé ». Cet audit EXÉCUTE
// src/exportComptable.js et src/exportComptableZip.js sur des données INVENTÉES :
//   D  les dépenses = `vrm_compta.depenses` + `packs` DATÉES dans les mois de la
//      période (la règle de `comptaChargesMois`), montant illisible écarté (jamais
//      0), coûts fixes / abonnements NOMMÉS « pas détaillés » (jamais inventés),
//      ligne pas lue ⇒ « — » ;
//   P  le reçu par plateforme = les lignes de VENTES de l'export (datées au
//      versement) regroupées ; un site sans montant lu ⇒ « — », un montant pas lu
//      ⇒ « au moins » et nommé ; la somme des sites = le total des ventes ;
//   C  le CSV et le classeur portent les deux sections ; « encaissé » n'apparaît
//      nulle part ; Compta passe `vrm_compta` (illisible ⇒ null).
// `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const tmpDe = () => path.join(R, 'src', `.audit-ed-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);

async function verifier(EXP, ZIP, COMPTA) {
  let ko = 0;
  const dit = (c, m) => { if (!c) { ko++; if (!PROUVE) console.log('  ❌ ' + m); } else if (process.env.BAVARD) console.log('  ✅ ' + m); };
  const fe = tmpDe(), fz = tmpDe();
  fs.writeFileSync(fe, EXP); fs.writeFileSync(fz, ZIP.replace("from './exportComptable.js'", `from './${path.basename(fe)}'`));
  let M, Z;
  try { M = await import('file://' + fe); Z = await import('file://' + fz); }
  catch (e) { dit(false, 'modules illisibles : ' + e.message); return ko; }
  finally { try { fs.unlinkSync(fe); fs.unlinkSync(fz); } catch (_) {} }
  if (typeof M.depensesPeriode !== 'function' || typeof M.recuParPlateforme !== 'function') { dit(false, 'D0 depensesPeriode / recuParPlateforme existent'); return ko; }
  const ts = (j) => Date.parse(j + 'T10:00:00');
  const recettes = { lignes: [
    { id: 'a', tsVente: ts('2026-09-28'), tsVersement: ts('2026-10-02'), plateforme: 'Vinted', compte: 'shop_a', num: '12', reference: '', titre: 'Paire A', montant: 40 },
    { id: 'b', tsVente: ts('2026-10-03'), tsVersement: ts('2026-10-06'), plateforme: 'Vinted', compte: 'shop_b', num: '13', reference: '', titre: 'Paire A', montant: 35.5 },
    { id: 'c', tsVente: ts('2026-10-04'), tsVersement: ts('2026-10-09'), plateforme: 'eBay', compte: 'e1', num: '', reference: 'VRM-14', titre: 'Paire B', montant: 80, frais: 9.6 },
    { id: 'd', tsVente: ts('2026-10-05'), tsVersement: ts('2026-10-10'), plateforme: 'Leboncoin', compte: 'l1', num: '15', reference: '', titre: 'Paire C', montant: null },
  ], horsPeriode: [], total: 155.5, complet: false, manque: [], sansMontant: 1 };
  const compta = {
    depenses: [
      { id: 1, date: '2026-10-03', montant: 12.5, cat: 'emballage', libelle: 'Cartons', ticket: true },
      { id: 2, date: '2026-10-31', montant: 7, cat: 'transport', libelle: 'Essence' },
      { id: 3, date: '2026-11-01', montant: 9, cat: 'autre', libelle: 'Hors période' },
      { id: 4, date: '2026-10-12', montant: 'douze', cat: 'autre', libelle: 'Illisible' },
    ],
    packs: [{ date: '2026-10-20', montant: 4.99, libelle: 'Pack photo' }],
    fixes: [{ nom: 'Box', montant: 30 }], abonnements: [{ nom: 'Outil', montant: 10, debut: '2026-01' }],
  };
  const base = { periode: '2026-10', recettes, achats: null, ligne: null, regime: 'micro', taux: 12.4, montantPeriode: () => ({ ca: null }), aPayer: () => null };
  const d = M.donneesExportComptable({ ...base, compta });
  // D
  dit(d.nDepenses === 3 && d.totalDepenses === 24.49, `D1 3 dépenses d'octobre (2 ponctuelles + 1 pack), total 24,49 € — ${d.nDepenses} · ${d.totalDepenses}`);
  dit(!(d.depenses || []).some((x) => x.libelle === 'Hors période' || x.libelle === 'Illisible'), 'D2 hors période et montant illisible écartés (jamais lus 0)');
  dit((d.depenses || []).map((x) => x.iso).join(',') === '2026-10-03,2026-10-20,2026-10-31', 'D3 rangées par date');
  dit(d.fixesNonDetailles === 2 && M.couvertureExport(d).some((c) => /2 coûts fixes ou abonnements : pas détaillés/.test(c)), 'D4 coûts fixes et abonnements NOMMÉS, pas inventés');
  const dNull = M.donneesExportComptable({ ...base, compta: null });
  dit(dNull.nDepenses === null && dNull.totalDepenses === null && M.couvertureExport(dNull).some((c) => /dépenses notées pas lues/.test(c)), 'D5 ligne pas lue ⇒ « — » et nommé');
  dit(M.resumeExport(dNull).some(([k, v]) => k === 'Dépenses notées' && v === '—'), 'D6 le résumé dit « — » (jamais 0,00 €)');
  const dVide = M.donneesExportComptable({ ...base, compta: {} });
  dit(dVide.nDepenses === 0 && dVide.totalDepenses === 0, 'D7 aucune dépense notée (ligne lue) ⇒ 0 ligne');
  // P
  const P = d.parPlateforme || [];
  const g = (k) => P.find((x) => x.plateforme === k) || {};
  dit(g('Vinted').n === 2 && g('Vinted').montant === 75.5, 'P1 Vinted : 2 ventes, 75,50 € — ' + JSON.stringify(g('Vinted')));
  dit(g('eBay').frais === 9.6 && g('eBay').fraisLus === 1, 'P2 eBay : frais LUS reportés');
  dit(g('Leboncoin').montant === null && g('Leboncoin').sansMontant === 1, 'P3 Leboncoin sans montant lu ⇒ « — », pas 0 — ' + JSON.stringify(g('Leboncoin')));
  const somme = Math.round(P.reduce((t, x) => t + (x.montant || 0) * 100, 0)) / 100;
  dit(somme === 155.5, `P4 la somme des sites = le total des ventes (${somme})`);
  dit(M.couvertureExport(d).some((c) => /Leboncoin : 1 vente versée au montant pas lu/.test(c)), 'P5 le montant pas lu NOMMÉ par site');
  dit(M.recuParPlateforme(null) === null, 'P6 ventes pas lues ⇒ null');
  // C
  const csv = M.csvExportComptable(d);
  dit(/REÇU PAR PLATEFORME/.test(csv) && /Leboncoin;1;;/.test(csv), 'C1 le CSV : reçu par plateforme, « — » vide pour Leboncoin');
  dit(/DÉPENSES NOTÉES DE LA PÉRIODE/.test(csv) && /03\/10\/2026;dépense;emballage;Cartons;12,50;oui/.test(csv) && /Total;24,49/.test(csv), 'C2 le CSV : dépenses détaillées et total');
  dit(!/encaiss/i.test(csv), 'C3 jamais « encaissé »');
  const F = Z.feuillesExport(d);
  dit(F.some((f) => f.nom === 'Reçu par site') && F.some((f) => f.nom === 'Dépenses' && f.lignes.length === 5), 'C4 le classeur : feuilles « Reçu par site » et « Dépenses »');
  const c = sansCommentaires(COMPTA);
  dit(/load\('vrm_compta', null\)/.test(c) && /compta = c == null \? \{\} : \(typeof c === 'object' && !Array\.isArray\(c\) \? c : null\)/.test(c) && /factures: facturesJointes, compta(?: \}\)|, )/.test(c), 'C5 Compta passe vrm_compta (illisible ⇒ null)');
  return ko;
}

(async () => {
  const EXP = lire('src/exportComptable.js'), ZIP = lire('src/exportComptableZip.js'), COMPTA = lire('src/ecrans/Compta.jsx');
  const ko = await verifier(EXP, ZIP, COMPTA);
  if (!PROUVE) { console.log(ko ? `❌ audit-export-depenses : ${ko} contrôle(s) rouge(s)` : '✅ audit-export-depenses : vert'); process.exit(ko ? 1 : 0); }
  if (ko) { console.log(`❌ --prouve : le code actuel n'est pas vert (${ko})`); process.exit(1); }
  const MUT = [
    ['hors période gardé', 'exp', "Array.isArray(b.yms) && b.yms.includes(String(iso).slice(0, 7))", 'true'],
    ['illisible lu 0', 'exp', "if (!Number.isFinite(m) || m <= 0) { illisibles++; return; }", "if (!Number.isFinite(m)) { lignes.push({ date: '', iso: String(x.date).slice(0, 10), sorte, categorie: '', libelle: String(x.libelle || ''), montant: 0, ticket: false }); return; }"],
    ['packs oubliés', 'exp', "for (const x of (Array.isArray(compta.packs) ? compta.packs : [])) prendre(x, 'pack');", ''],
    ['fixes tus', 'exp', "  if (d.fixesNonDetailles) L.push(", "  if (0) L.push("],
    ['pas lu ⇒ 0', 'exp', "if (!compta || typeof compta !== 'object' || Array.isArray(compta) || !bornes) return null;", "if (!compta || typeof compta !== 'object') return { lignes: [], total: 0, fixes: 0, illisibles: 0 };"],
    ['site sans montant ⇒ 0', 'exp', '  for (const g of G.values()) if (g.sansMontant === g.n) g.montant = null;\n', ''],
    ['Compta ne passe rien', 'compta', 'factures: facturesJointes, compta, releve:', 'factures: facturesJointes, releve:'],
  ];
  let rouges = 0;
  for (const [nom, ou, a, b] of MUT) {
    const src = ou === 'exp' ? EXP : COMPTA;
    if (!src.includes(a)) { console.log('❌ mutation impossible (motif absent) : ' + nom); process.exit(2); }
    const k = ou === 'exp' ? await verifier(EXP.replace(a, b), ZIP, COMPTA) : await verifier(EXP, ZIP, COMPTA.replace(a, b));
    console.log((k ? '  ✅ rouge : ' : '  ❌ RESTE VERT : ') + nom);
    if (k) rouges++;
  }
  console.log(rouges === MUT.length ? `✅ --prouve : ${rouges}/${MUT.length} mutations rougissent` : `❌ --prouve : ${MUT.length - rouges} mutation(s) restent vertes`);
  process.exit(rouges === MUT.length ? 0 : 1);
})();
