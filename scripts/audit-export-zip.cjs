#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// audit-export-zip — « Pour mon comptable » : le zip EXÉCUTÉ, ouvert, relu (11 nov.)
// ═══════════════════════════════════════════════════════════════════════════
//   node scripts/audit-export-zip.cjs                 contrôles sur le code du dépôt
//   node scripts/audit-export-zip.cjs --mutation=NOM  la règle réaffaiblie (doit rougir)
//   node scripts/audit-export-zip.cjs --prouve        chaque mutation doit rougir
//
// Le vrai code (src/exportComptableZip.js, src/exportComptable.js, src/registres.js,
// src/xlsxSimple.js, src/facturePro/registre.js) est copié dans un dossier
// temporaire et importé. Une période d'octobre 2026, des ventes inventées POUR LE
// BANC (aucune base touchée) : une Vinted versée en octobre, une eBay aux frais
// lus, une Vinted « à dater », deux achats (un coût saisi, un sans), une facture
// d'achat jointe, deux factures Pro (octobre, septembre).
//   Z1. un zip lisible, UN dossier, CRC justes, noms clairs
//   Z2. le .xlsx s'ouvre (openpyxl, un vrai lecteur) : feuilles, nombres en nombres
//   Z3. recettes datées au versement ; « à dater » à part, dans aucun mois
//   Z4. frais lus (eBay) en nombre, frais pas lus vides (jamais 0)
//   Z5. le récap PDF : totaux, couverture « sur N », manques NOMMÉS, pièces du zip
//   Z6. justificatifs : la facture Pro du mois (pas celle de septembre), la facture
//       d'achat jointe ; une pièce pas lue est NOMMÉE (« pas dans le zip »), jamais tue
//   Z7. défaut : la dernière période BOUCLÉE ; partage natif, sinon téléchargement
//   Z8. jamais « encaissé »
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const R0 = path.resolve(__dirname, '..');
const NM = (() => { try { return fs.realpathSync(path.join(R0, 'node_modules')); } catch (_) { return path.join(R0, 'node_modules'); } })();
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };

// Les mutations : chacune réaffaiblit UNE règle ; le contrôle qui la garde doit rougir.
const MUTATIONS = {
  'adater-dans-mois': ['src/registres.js', "  for (const a of (decl.aDater || [])) if (a) horsPeriode.push(", "  for (const a of (decl.aDater || [])) if (a) lignes.push("],
  'frais-zero': ['src/registres.js', 'frais: Number.isFinite(l.frais) ? l.frais : null,', 'frais: Number.isFinite(l.frais) ? l.frais : 0,'],
  'manque-tu': ['src/exportComptableZip.js', "if (!f) { out.manque.push(`la facture d’achat ${qui}`); continue; }", 'if (!f) { continue; }'],
  'periode-ignoree': ['src/exportComptableZip.js', '.filter((l) => yms.some((ym) => dansPeriode(l, ym)))', '.filter(() => true)'],
  'nombre-en-texte': ['src/xlsxSimple.js', "if (typeof v === 'number' || (v && typeof v === 'object' && typeof v.n === 'number')) {", "if (false) {"],
  'defaut-en-cours': ['src/exportComptableZip.js', "maintenant)[1];", "maintenant)[0];"],
  'annule-telecharge': ['src/exportComptableZip.js', "if (e && e.name === 'AbortError') return 'annule';", ''],
};

if (process.argv.includes('--prouve')) {
  let ko = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe' }); } catch (_) { rouge = true; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} : ${rouge ? 'rouge (gardée)' : 'VERTE — aucun contrôle ne la voit'}`);
    if (!rouge) ko += 1;
  }
  process.exit(ko ? 1 : 0);
}

let ok = 0, ko = 0;
const dit = (c, t, x) => { if (c) ok += 1; else ko += 1; console.log(`  ${c ? '✅' : '❌'} ${t}${x != null && x !== '' ? ` — ${x}` : ''}`); };

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-export-zip-'));
  // Le vrai code, copié (src entier + api/_lib, pour les imports relatifs).
  fs.cpSync(path.join(R0, 'src'), path.join(dir, 'src'), { recursive: true, filter: (p) => !/\.(png|jpg|jpeg|webp|svg|css|jsx)$/i.test(p) });
  fs.cpSync(path.join(R0, 'api', '_lib'), path.join(dir, 'api', '_lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const mut = arg('mutation');
  if (mut) {
    const [f, a, b] = MUTATIONS[mut] || [];
    const p = f && path.join(dir, f); const s = p && fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    if (!s.includes(a)) { console.log(`mutation ${mut} : texte introuvable (la règle a changé ?)`); process.exit(2); }
    fs.writeFileSync(p, s.replace(a, b));
    console.log(`(mutation ${mut})`);
  }
  let Z, E, REG, XD;
  try {
    Z = await import('file://' + path.join(dir, 'src', 'exportComptableZip.js'));
    E = await import('file://' + path.join(dir, 'src', 'exportComptable.js'));
    REG = await import('file://' + path.join(dir, 'src', 'registres.js'));
    XD = await import('file://' + path.join(dir, 'src', 'exportDonnees.js'));
  } catch (e) { dit(false, 'les modules de l’export se chargent', e.message); console.log(`\n❌ export-zip : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }
  dit(typeof Z.zipExportComptable === 'function' && typeof Z.lireJustificatifs === 'function', 'src/exportComptableZip.js : le zip et les justificatifs existent');
  const PDFLib = require(path.join(NM, 'pdf-lib'));

  // ── La fixture (inventée pour le banc, jamais en base) ──────────────────────
  const T = (s) => new Date(s).getTime();
  const maintenant = T('2026-11-11T10:00:00');
  const decl = {
    lignes: [
      { id: 'vinted:7001', plateforme: 'Vinted', ts: T('2026-10-05T12:00:00'), ym: '2026-10', eur: 52.5, titre: 'Air Force 1 blanches 42', dateVente: '2026-09-29T10:00:00' },
      { id: 'ebay:12-345', plateforme: 'eBay', ts: T('2026-10-20T12:00:00'), ym: '2026-10', eur: 88.15, frais: 11.85, titre: 'Jordan 4 Bred 43' },
      { id: 'vinted:7009', plateforme: 'Vinted', ts: T('2026-09-12T12:00:00'), ym: '2026-09', eur: 40, titre: 'Hors période (septembre)' },
    ],
    aDater: [{ id: 'vinted:7002', plateforme: 'Vinted', eur: 61, titre: 'New Balance 550 à dater', dateVente: '2026-10-18T10:00:00' }],
    ecartees: [],
  };
  const recettes = REG.livreDesRecettes({ decl, periode: '2026-10', numDe: (id) => (id === 'vinted:7001' ? '124' : ''), compteDe: () => 'compte_banc' });
  const achats = REG.registreDesAchats({
    achats: [
      { transaction_id: 5001, date: '2026-10-02T09:00:00', title: 'Lot Nike 42', price: { amount: '30.00', currency_code: 'EUR' }, compte: 'acheteur_banc' },
      { transaction_id: 5002, date: '2026-10-09T09:00:00', title: 'Vans Old Skool', price: { amount: '18.00', currency_code: 'EUR' }, compte: 'acheteur_banc' },
    ],
    fiches: { a: { numero: '124', buyPrice: '32', buyFromId: '5001' } }, periode: '2026-10',
  });
  const factures = { tx_5001: { type: 'pdf', nom: 'facture-lot.pdf' } };
  const d = E.donneesExportComptable({ periode: '2026-10', recettes, achats, ligne: null, regime: 'micro', taux: 12.4, maintenant, factures });

  // Une facture d'achat jointe : un vrai petit PDF, en data URL.
  const petitPdf = async (t) => { const doc = await PDFLib.PDFDocument.create(); const p = doc.addPage([200, 200]); p.drawText(t, { x: 20, y: 100, size: 12 }); return new Uint8Array(await doc.save()); };
  const pdfAchat = await petitPdf('Facture achat banc');
  const dataUrl = 'data:application/pdf;base64,' + Buffer.from(pdfAchat).toString('base64');
  const lignesPro = [
    { id: 'email_invoice_tx7001', numero: 'F2026-0007', type: 'facture_pro', emiseLe: '2026-10-06T09:00:00Z', ttc: '5250', ht: '5250', tva: '0', designation: 'Air Force 1', acheteur: 'Client banc', transaction: '7001' },
    { id: 'email_invoice_tx6000', numero: 'F2026-0006', type: 'facture_pro', emiseLe: '2026-09-20T09:00:00Z', ttc: '4000', ht: '4000', tva: '0', designation: 'Autre', acheteur: 'Client banc', transaction: '6000' },
  ];
  const requetes = [];
  const deps = (o = {}) => ({
    lireTout: async (q) => {
      requetes.push(q);
      if (/^id=like\.email_invoice_\*/.test(q)) return o.proKo ? null : lignesPro;
      if (/^id=in\./.test(q)) return o.contenuKo ? null : lignesPro.filter((l) => q.includes(l.id)).map((l) => ({ id: l.id, contenu: { numero: l.numero } }));
      return [];
    },
    lireFactureAchat: async (cle) => (o.achatKo ? null : cle === 'tx_5001' ? dataUrl : null),
    pdfFacture: async (c) => petitPdf(`Facture ${c.numero}`),
  });

  // ── Z6. Les justificatifs ───────────────────────────────────────────────────
  const j = await Z.lireJustificatifs(d, deps());
  dit(j.ventes.length === 1 && j.ventes[0].nom === 'Facture-F2026-0007.pdf', 'Z6 · la facture Pro d’OCTOBRE est jointe, pas celle de septembre', j.ventes.map((x) => x.nom).join(', '));
  dit(!requetes.some((q) => /select=data(&|$)/.test(q)) && requetes.some((q) => /select=id,numero:data->>number/.test(q)), 'Z6 · lecture projetée (jamais select=data)');
  dit(j.achats.length === 1 && /^Achat-2026-10-02-N124-5001\.pdf$/.test(j.achats[0].nom) && Buffer.from(j.achats[0].octets).equals(Buffer.from(pdfAchat)), 'Z6 · la facture d’achat jointe, octet pour octet, nom clair', j.achats.map((x) => x.nom).join(', '));
  dit(j.manque.length === 0, 'Z6 · rien ne manque quand tout se lit', j.manque.join(' · '));

  // ── Z1. Le zip ──────────────────────────────────────────────────────────────
  const z = await Z.zipExportComptable(d, j, { PDFLib, quand: new Date(maintenant) });
  const fz = XD.lireZipStocke(z.octets);
  const noms = fz.map((x) => x.nom);
  dit(z.nom === 'VRM-comptable-2026-10.zip', 'Z1 · nom du zip clair', z.nom);
  dit(noms.length >= 5 && noms.every((n) => n.startsWith('VRM-comptable-2026-10/')), 'Z1 · le zip se dézippe en UN dossier', noms.join('\n      '));
  dit(fz.every((x) => x.crcOk), 'Z1 · CRC justes');
  const attendus = ['1-Recapitulatif-octobre-2026.pdf', '2-Tableur-octobre-2026.xlsx', '2-Tableur-octobre-2026.csv', 'Factures-de-vente/Registre-des-factures-octobre-2026.csv', 'Factures-de-vente/Facture-F2026-0007.pdf', 'Factures-d-achat/Achat-2026-10-02-N124-5001.pdf'];
  dit(attendus.every((a) => noms.includes('VRM-comptable-2026-10/' + a)), 'Z1 · récap, tableur (xlsx + csv), factures de vente et d’achat', attendus.filter((a) => !noms.includes('VRM-comptable-2026-10/' + a)).join(', '));
  if (process.env.EXPORT_ZIP_SORTIE) fs.writeFileSync(process.env.EXPORT_ZIP_SORTIE, z.octets);

  // ── Z2/Z3/Z4. Le classeur, relu par openpyxl ────────────────────────────────
  const xlsx = fz.find((x) => x.nom.endsWith('.xlsx'));
  const fx = path.join(dir, 'classeur.xlsx'); fs.writeFileSync(fx, xlsx.octets);
  let X = null;
  try {
    const py = `import openpyxl,json,sys\nwb=openpyxl.load_workbook(sys.argv[1])\nprint(json.dumps({ws.title:[[c for c in r] for r in ws.iter_rows(values_only=True)] for ws in wb.worksheets},default=str))`;
    X = JSON.parse(execFileSync('python3', ['-I', '-c', py, fx], { encoding: 'utf8' }));
  } catch (e) { dit(false, 'Z2 · le .xlsx s’ouvre avec openpyxl', String(e.message).slice(0, 200)); }
  if (X) {
    dit(['Résumé', 'Recettes', 'À dater', 'Achats', 'CA par mois'].every((n) => X[n]), 'Z2 · le .xlsx s’ouvre : Résumé, Recettes, À dater, Achats, CA par mois', Object.keys(X).join(', '));
    const rec = X.Recettes || [], h = rec[0] || [];
    const iM = h.indexOf('Montant reçu (€)'), iF = h.indexOf('Frais lus (€)'), iD = h.indexOf('Date de versement');
    const eb = rec.find((r) => r[2] === 'eBay'), vi = rec.find((r) => r[2] === 'Vinted');
    dit(iM >= 0 && eb && typeof eb[iM] === 'number' && eb[iM] === 88.15, 'Z2 · montant reçu en NOMBRE (88,15)', eb && eb[iM]);
    dit(iF >= 0 && eb && eb[iF] === 11.85, 'Z4 · frais eBay lus : 11,85 en nombre', eb && eb[iF]);
    dit(iF >= 0 && vi && vi[iF] == null, 'Z4 · frais Vinted pas lus : case vide, jamais 0', vi && String(vi[iF]));
    dit(iD === 0 && vi && vi[iD] === '05/10/2026', 'Z3 · 1re colonne : la date de VERSEMENT', vi && vi[iD]);
    dit(!rec.some((r) => r.includes('New Balance 550 à dater')) && (X['À dater'] || []).some((r) => r.includes('New Balance 550 à dater')), 'Z3 · la vente sans date de versement : dans « À dater », pas dans les recettes');
    dit(!rec.some((r) => r.includes('Hors période (septembre)')), 'Z3 · une vente versée en septembre n’est pas dans octobre');
    const tot = rec.find((r) => r.includes('Total') || r.includes('Total (au moins)'));
    dit(tot && tot[iM] === 140.65, 'Z2 · total des recettes en nombre = 52,50 + 88,15', tot && tot[iM]);
    const ach = X.Achats || [], ha = ach[0] || [];
    const iS = ha.indexOf('Coût saisi (€)'), iJ = ha.indexOf('Justificatif');
    const a1 = ach.find((r) => r.includes('5001')), a2 = ach.find((r) => r.includes('5002'));
    dit(a1 && a1[iS] === 32 && /facture jointe/.test(String(a1[iJ])), 'Z2 · achat : coût saisi 32 en nombre, « facture jointe »', a1 && `${a1[iS]} · ${a1[iJ]}`);
    dit(a2 && a2[iS] == null, 'Z2 · achat sans coût : case vide (jamais 0)', a2 && String(a2[iS]));
    const res = (X['Résumé'] || []).map((r) => r.filter((c) => c != null).join(' | ')).join('\n');
    dit(/au moins 32,00 € · 1 sur 2/.test(res.replace(/ | /g, ' ')), 'Z5 · couverture « au moins … · 1 sur 2 » à côté du chiffre', (res.match(/Coût[^\n]*/) || [''])[0]);
  }

  // ── Z5. Le récap PDF ────────────────────────────────────────────────────────
  const pdf = fz.find((x) => /Recapitulatif/.test(x.nom));
  const pages = [];
  try {
    const pdfjs = await import('file://' + path.join(NM, 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'));
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf.octets), isEvalSupported: false, useSystemFonts: false, standardFontDataUrl: path.join(NM, 'pdfjs-dist', 'standard_fonts') + '/' }).promise;
    for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const tc = await p.getTextContent(); pages.push(tc.items.map((x) => x.str).join(' ').replace(/\s+/g, ' ')); }
  } catch (e) { dit(false, 'Z5 · le récap PDF se relit', e.message); }
  const p1 = (pages[0] || '').replace(/ | /g, ' ');
  dit(/Export comptable - Octobre 2026/i.test(p1) && /140,65 €/.test(p1), 'Z5 · récap : la période et le montant reçu (140,65 €)', p1.slice(0, 160));
  dit(/Justificatifs dans le zip/.test(p1) && /1 facture de vente/.test(p1) && /1 facture d.achat jointe/.test(p1), 'Z5 · récap : les pièces du zip, comptées');
  dit(/1 vente à dater/.test(p1) && /1 achat sans coût saisi/.test(p1), 'Z5 · récap : les manques dits sur la 1re page');
  dit(pages.some((t) => /^Ventes à dater/.test(t.trim()) && t.includes('New Balance 550')) && pages.some((t) => /^Achats sans coût saisi/.test(t.trim()) && t.includes('Vans Old Skool')), 'Z5 · récap : chaque manque NOMMÉ ligne par ligne');

  // ── Z6 (suite). Une pièce pas lue est NOMMÉE, le zip part quand même ────────
  const jKo = await Z.lireJustificatifs(d, deps({ contenuKo: true, achatKo: true }));
  dit(jKo.ventes.length === 0 && jKo.manque.some((m) => /F2026-0007/.test(m)) && jKo.manque.some((m) => /facture d’achat .*5001/.test(m)), 'Z6 · pièces pas lues : NOMMÉES une par une', jKo.manque.join(' · '));
  const zKo = await Z.zipExportComptable(d, jKo, { PDFLib, quand: new Date(maintenant) });
  const rKo = XD.lireZipStocke(zKo.octets).find((x) => /Recapitulatif/.test(x.nom));
  let tKo = '';
  try {
    const pdfjs = await import('file://' + path.join(NM, 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'));
    const doc = await pdfjs.getDocument({ data: new Uint8Array(rKo.octets), isEvalSupported: false, useSystemFonts: false, standardFontDataUrl: path.join(NM, 'pdfjs-dist', 'standard_fonts') + '/' }).promise;
    const p = await doc.getPage(1); tKo = (await p.getTextContent()).items.map((x) => x.str).join(' ');
  } catch (_) {}
  dit(/pas dans le zip : la facture F2026-0007/.test(tKo) && /0 facture de vente/.test(tKo), 'Z6 · le récap dit « pas dans le zip : … » (jamais un zip présenté complet)');
  const jPro = await Z.lireJustificatifs(d, deps({ proKo: true }));
  dit(jPro.manque.some((m) => /factures de vente \(pas lues\)/.test(m)), 'Z6 · registre des factures illisible : dit, pas « aucune facture »', jPro.manque.join(' · '));

  // ── Z7. Le défaut et le partage ─────────────────────────────────────────────
  dit(Z.periodeBouclee('mois', maintenant) === '2026-10' && Z.periodeBouclee('trimestre', maintenant) === '2026-T3' && Z.periodeBouclee('annee', maintenant) === '2025', 'Z7 · défaut : la dernière période BOUCLÉE (oct. 2026 · T3 · 2025)', `${Z.periodeBouclee('mois', maintenant)} · ${Z.periodeBouclee('trimestre', maintenant)} · ${Z.periodeBouclee('annee', maintenant)}`);
  const telecharges = []; const tel = (b, n) => telecharges.push(n);
  const okNav = { canShare: () => true, share: async () => {} };
  const r1 = await Z.partagerOuTelecharger(z.octets, z.nom, { nav: okNav, telecharger: tel });
  const r2 = await Z.partagerOuTelecharger(z.octets, z.nom, { nav: { canShare: () => true, share: async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; } }, telecharger: tel });
  const n2 = telecharges.length;
  const r3 = await Z.partagerOuTelecharger(z.octets, z.nom, { nav: { canShare: () => true, share: async () => { const e = new Error('x'); e.name = 'NotAllowedError'; throw e; } }, telecharger: tel });
  const r4 = await Z.partagerOuTelecharger(z.octets, z.nom, { nav: {}, telecharger: tel });
  dit(r1 === 'partage' && r2 === 'annule' && n2 === 0, 'Z7 · partage natif ; feuille fermée ⇒ rien d’autre', `${r1} · ${r2}`);
  dit(r3 === 'telecharge' && r4 === 'telecharge' && telecharges.length === 2, 'Z7 · partage refusé ou absent ⇒ téléchargement', `${r3} · ${r4}`);

  // ── Z8. Jamais « encaissé » ─────────────────────────────────────────────────
  const tout = fz.filter((x) => /\.(csv|xml)$/.test(x.nom)).map((x) => x.texte).join('\n') + pages.join('\n') + JSON.stringify(X || {});
  dit(!/encaiss/i.test(tout), 'Z8 · jamais « encaissé »');

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  console.log(ko ? `\n❌ export-zip : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ export-zip : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
