// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE MONTANT LU SUR UN TICKET (3 novembre)
//         node scripts/audit-depense-ticket.cjs [--mutation=plus-grand|ht]
// ═══════════════════════════════════════════════════════════════════════════
// `montantDuTicket` (src/depensesTicket.js) ne pré-remplit le champ qu'avec un
// TOTAL payé écrit sur le ticket (« NET À PAYER », « TOTAL TTC », « TOTAL »,
// « CB ») ; jamais le sous-total, la TVA, le HT, le rendu ; sans mot de total,
// RIEN (jamais « le plus grand nombre » : un montant deviné est pire qu'un
// champ vide, §2.5). Tickets INVENTÉS. `--mutation` réaffaiblit la règle.
const fs = require('fs'), path = require('path'), os = require('os');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null ? ' — ' + d : '')); };
let S = ''; try { S = fs.readFileSync(path.join(R, 'src/depensesTicket.js'), 'utf8'); } catch (_) {}
const muter = (a, b) => { if (!S.includes(a)) { console.log('❌ motif absent : ' + a.slice(0, 60)); process.exit(2); } S = S.replace(a, b); };
if (MUT === 'plus-grand') muter('  return null;\n}\nexport const texteMontantSaisie', '  { const tous = lignes.flatMap(montantsDe); return tous.length ? Math.max(...tous) : null; }\n}\nexport const texteMontantSaisie');
else if (MUT === 'ht') muter("const PAS_LE_TOTAL = /sous[\\s-]*total|\\bht\\b|\\btva\\b|rendu|monnaie|remise|[ée]conomie|avoir|points?\\b/i;", 'const PAS_LE_TOTAL = /rendu/i;');
else if (MUT) { console.log('mutation inconnue'); process.exit(2); }
(async () => {
  if (!S) { dit(false, 'src/depensesTicket.js existe'); return fin(); }
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tk-')), 'm.mjs'); fs.writeFileSync(f, S);
  const { montantDuTicket, CATEGORIES_DEPENSE, idTicket } = await import('file://' + f);
  const cas = [
    ['TOTAL TTC parmi sous-total et TVA', 'MAGASIN INVENTÉ\nSOUS-TOTAL 10,42\nTVA 20% 2,08\nTOTAL TTC 12,50 EUR\nCB 12,50', 1250],
    ['NET À PAYER sur la ligne suivante', 'Cartons x3 9,00\nScotch 3,40\nNET A PAYER\n12,40 €', 1240],
    ['TOTAL HT puis TOTAL', 'TOTAL HT 20,00\nTVA 4,00\nTOTAL 24,00', 2400],
    ['espèces et rendu : le total, pas le rendu', 'TOTAL 7,30\nESPECES 10,00\nRENDU 2,70', 730],
    ['milliers', 'TOTAL TTC 1 234,56 €', 123456],
    ['sans mot de total : rien', 'Cartons 9,00\nScotch 3,40\n45,00', null],
    ['texte vide : rien', '', null],
  ];
  for (const [nom, t, attendu] of cas) { const v = montantDuTicket(t); dit(v === attendu, nom, String(v)); }
  dit(CATEGORIES_DEPENSE.map((c) => c.k).join('|') === 'Emballage|Achats de stock|Envois|Abonnements|Autre', 'les catégories de Julien');
  dit(idTicket('a/b c') === 'depense_ticket_abc', 'la ligne du ticket : depense_ticket_{id} nettoyé');
  dit(!/fetch\(|XMLHttpRequest|\/api\//.test(S.replace(/\/\/[^\n]*/g, '')), 'aucune lecture par un service distant (rien envoyé hors de la page)');
  fin();
})();
function fin() { console.log(`\n${ok} verts, ${ko} rouges${MUT ? ' (mutation ' + MUT + ')' : ''}`); process.exit(ko ? 1 : 0); }
