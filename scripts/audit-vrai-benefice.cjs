// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE VRAI BÉNÉFICE (27 nov., lot vrai-benefice) — src/vraiBenefice.js EXÉCUTÉ (données inventées)
//   node scripts/audit-vrai-benefice.cjs              les contrôles
//   node scripts/audit-vrai-benefice.cjs --prouve     chaque mutation doit faire rougir au moins un contrôle
// ═══════════════════════════════════════════════════════════════════════════
//   R1 une règle : l'export (src/exportComptable.js `detailVenteReleve`) et l'écran (Statistiques › Gains, via
//      src/aujourdhui/StatsBranche.jsx) appellent LA fonction de src/vraiBenefice.js ; elle-même est `margesPar` ;
//   R2 par paire : vente − achat − frais notés (boost, port payé par lui…) ; frais confirmés ⇒ 'ok', sinon 'auPlus' ;
//      prix du reçu ⇒ port de l'achat « recu » ;
//   R3 un prix d'achat inconnu n'est JAMAIS 0 : net null, compté dans « sans prix d'achat », hors de la somme ;
//   R4 le mois = le versement (Vinted), la vente (autres sites) ; pas versée ⇒ « à dater », dans aucun mois ;
//   R5 par compte : la somme des connus, le meilleur d'abord, sans bénéfice connu après ; un compte absent du relevé
//      (exclu) n'apparaît pas ; une vente illisible est écartée et comptée, jamais à 0 ;
//   R6 le relevé range les drapeaux en [12] (frais confirmés, reçu) sans déplacer [10] et [11].
const fs = require('fs'), path = require('path'), os = require('os');
const R0 = path.join(__dirname, '..');
const lire = (p) => fs.readFileSync(path.join(R0, p), 'utf8');
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const MUTATIONS = {
  zero: ['const achat = nombreOuNull(r[5]);\n  const frais', 'const achat = nombreOuNull(r[5]) ?? 0;\n  const frais'],
  vente: ["const quand = plateforme === 'Vinted' ? (r[9] ? String(r[9]) : '') :", "const quand = plateforme === 'Vinted' ? Number(r[3]) :"],
  plafond: ["confirme ? 'ok' : 'auPlus'", "'ok'"],
  boost: ['const frais = r[6] === null ? null : nombreOuNull(r[6]);', 'const frais = 0;'],
  tri: ['(x.net != null && y.net !== x.net ? y.net - x.net : 0)', '(x.net != null && y.net !== x.net ? x.net - y.net : 0)'],
};

async function controler(src, nom) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-vb-'));
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else { ko++; if (!nom) console.log('  ❌ ' + m + (d ? ' — ' + JSON.stringify(d) : '')); } if (c && !nom) console.log('  ✅ ' + m); };
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(dir, 'statsVentes.js'), lire('src/statsVentes.js'));
    fs.writeFileSync(path.join(dir, 'dateParis.js'), lire('src/dateParis.js'));
    fs.writeFileSync(path.join(dir, 'vraiBenefice.js'), src);
    fs.writeFileSync(path.join(dir, 'ceQuiRapporte.js'), lire('src/ceQuiRapporte.js'));
    const V = await import('file://' + path.join(dir, 'vraiBenefice.js'));
    const Q = await import('file://' + path.join(dir, 'ceQuiRapporte.js'));
    // ── R1 ──
    const ex = sansCommentaires(lire('src/exportComptable.js'));
    const det = /export function detailVenteReleve[\s\S]*?\n}/.exec(ex);
    dit(/from '\.\/vraiBenefice\.js'/.test(ex) && !!det && /beneficeReleve\(r\)/.test(det[0]) && !/margesPar\(/.test(det[0]), 'R1 · l’export prend le bénéfice de LA règle (beneficeReleve), aucune copie');
    const sb = sansCommentaires(lire('src/aujourdhui/StatsBranche.jsx'));
    dit(/from '\.\.\/vraiBenefice\.js'/.test(sb) && /vraiBenefice\(L\.releve/.test(sb), 'R1 · Statistiques › Gains calcule par la même règle sur le même relevé');
    dit(/margesPar\(/.test(sansCommentaires(src)), 'R1 · la règle est `margesPar` (src/statsVentes.js), celle des marges de Statistiques');
    // ── Le relevé inventé : [plateforme, compte, tx, ts, vente, achat, frais, titre, N°, versement, lot, détail, drapeaux]
    const ts = (y, m, d) => new Date(y, m - 1, d, 12).getTime();
    const L = [
      ['Vinted', 'shop_a', '1', ts(2026, 9, 20), 48.5, 30, 2, 'A', '13', '2026-10-05T10:00:00Z', null, [200, 0, 0, 0], 'cr'],
      ['Vinted', 'shop_a', '2', ts(2026, 10, 3), 61, 20, 3, 'B', '12', '2026-10-08T10:00:00Z', null, [0, 300, 0, 0]],
      ['Vinted', 'shop_b', '3', ts(2026, 10, 4), 39.9, null, 0, 'C', '', '2026-10-10T10:00:00Z'],
      ['Vinted', 'shop_b', '4', ts(2026, 10, 6), 72.4, 10, 0, 'D', '', ''],
      ['Leboncoin', '', 'lbc:9', ts(2026, 10, 12), 50, 25, 0, 'E', '20', new Date(ts(2026, 10, 12)).toISOString(), null, null, 'c'],
      ['Vinted', 'shop_b', '5', ts(2026, 10, 7), null, 10, 0, 'F', '', '2026-10-09T10:00:00Z'],
      ['Vinted', 'shop_b', '6', ts(2026, 9, 2), 20, 0, 0, 'G', '', '2026-09-04T10:00:00Z', null, null, 'c'],
    ];
    // ── R2 ──
    const t1 = V.termesReleve(L[0]), t2 = V.termesReleve(L[1]);
    dit(t1.net === 1650 && t1.etat === 'ok' && t1.boost === 200 && t1.portAchat === 'recu', 'R2 · 48,50 − 30 − boost 2 = 16,50, frais confirmés, port de l’achat dans le reçu', t1);
    dit(t2.net === 3800 && t2.etat === 'auPlus' && t2.portVendeur === 300 && t2.portAchat === 'saisi', 'R2 · 61 − 20 − port 3 = 38,00, frais pas confirmés ⇒ au plus', t2);
    dit(V.beneficeReleve(L[0]) === 16.5 && V.beneficeReleve(L[1]) === 38, 'R2 · `beneficeReleve` (celle de l’export) rend les mêmes euros');
    // ── R3 ──
    const t3 = V.termesReleve(L[2]);
    dit(t3.net === null && t3.etat === 'achat' && V.beneficeReleve(L[2]) === null, 'R3 · sans prix d’achat : bénéfice null, jamais 0', t3);
    const t7 = V.termesReleve(L[6]);
    dit(t7.net === 2000 && t7.etat === 'ok', 'R3 · un prix d’achat SAISI à 0 est connu (20,00)', t7);
    // ── R4 / R5 ──
    const B = V.vraiBenefice(L, { mois: ['2026-10', '2026-09'] });
    const oct = B.mois.find((m) => m.ym === '2026-10'), sep = B.mois.find((m) => m.ym === '2026-09');
    dit(oct.n === 4 && oct.nNet === 3 && oct.net === 1650 + 3800 + 2500 && oct.sansAchat === 1 && oct.auPlus === 1 && oct.plafond, 'R4 · octobre (versements) : 3 sur 4, 79,50 €, 1 sans achat, 1 au plus', oct);
    dit(sep.n === 1 && sep.net === 2000, 'R4 · septembre : la vente versée en septembre seulement (la 1, vendue en septembre, compte en octobre)', sep);
    dit(B.aDater === 1 && B.ecartees === 1, 'R4 · la vente pas versée est « à dater » ; le montant illisible est écarté et compté', { aDater: B.aDater, ecartees: B.ecartees });
    const vide = V.vraiBenefice([L[2]], { mois: ['2026-10'] }).mois[0];
    dit(vide.n === 1 && vide.net === null && vide.nNet === 0, 'R3 · un mois où aucun achat n’est connu : « — » (null), jamais 0', vide);
    const ordre = B.comptes.map((c) => c.k).join('|');
    dit(ordre === 'Vinted|shop_b|Vinted|shop_a|Leboncoin', 'R5 · par compte : le plus gros bénéfice connu d’abord (shop_b 82,40 · shop_a 54,50 · Leboncoin 25,00)', ordre);
    const a = B.comptes.find((c) => c.k === 'Vinted|shop_a'), bb = B.comptes[0];
    dit(a.net === 5450 && a.n === 2 && a.nNet === 2, 'R5 · shop_a : 54,50 € sur 2 ventes', a);
    dit(bb.net === 6240 + 2000 && bb.n === 3 && bb.nNet === 2 && bb.sansAchat === 1, 'R5 · shop_b : 82,40 € sur 2 des 3 (la vente sans achat nommée, pas comptée à 0)', bb);
    const C2 = V.vraiBenefice([L[2]], { mois: [] }).comptes[0];
    dit(C2.net === null && C2.nNet === 0 && C2.n === 1, 'R5 · un compte sans aucun achat connu : « — » (null), jamais 0', C2);
    dit(!B.comptes.some((c) => /exclu/.test(c.k)), 'R5 · un compte absent du relevé n’apparaît nulle part');
    dit(V.vraiBenefice(null) === null, 'R5 · relevé pas lu ⇒ null (« — »), jamais une liste vide');
    // ── R6 ──
    const rel = Q.releveVentes({ vinted: [{ transaction_id: 7, date: '2026-10-01T10:00:00Z', title: 'x', price: { amount: '10' } }], estFinalisee: () => true, an0: 2025,
      montant: () => 10, achat: () => 4, frais: () => 1, compte: () => 'c', fraisDetail: () => [100, 0, 0, 0], drapeaux: () => 'c' });
    dit(rel.length === 1 && rel[0][10] === null && Array.isArray(rel[0][11]) && rel[0][12] === 'c', 'R6 · relevé : [12] drapeaux, [10] et [11] à leur place', rel[0]);
    const rel2 = Q.releveVentes({ vinted: [{ transaction_id: 8, date: '2026-10-01T10:00:00Z', title: 'x', price: { amount: '10' } }], estFinalisee: () => true, an0: 2025,
      montant: () => 10, achat: () => 4, frais: () => 1, compte: () => 'c' });
    dit(rel2[0].length === 10, 'R6 · sans drapeau, la ligne ne change pas de forme');
    dit(V.drapeauxFiche({ fraisComplets: true, buyPriceSource: 'recu' }) === 'cr' && V.drapeauxFiche({ buyPriceSource: 'division' }) === 'r' && V.drapeauxFiche({}) === '', 'R6 · drapeaux de la fiche');
  } catch (e) { dit(false, 'le module s’exécute', e.message); }
  finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
  return { ko, ok };
}

(async () => {
  const src = lire('src/vraiBenefice.js');
  if (process.argv.includes('--prouve')) {
    let bonnes = 0;
    for (const [nom, [a, b]] of Object.entries(MUTATIONS)) {
      if (!src.includes(a)) { console.log(`  ❌ mutation ${nom} : motif introuvable`); continue; }
      const r = await controler(src.replace(a, b), nom);
      console.log(`  ${r.ko ? '✅' : '❌'} mutation ${nom} : ${r.ko} rouge(s)`);
      if (r.ko) bonnes++;
    }
    const n = Object.keys(MUTATIONS).length;
    console.log(bonnes === n ? `\n✅ vrai-benefice --prouve : ${bonnes}/${n}` : `\n❌ vrai-benefice --prouve : ${bonnes}/${n}`);
    process.exit(bonnes === n ? 0 : 1);
  }
  const r = await controler(src, '');
  console.log(r.ko ? `\n❌ vrai-benefice : ${r.ko} rouge(s), ${r.ok} vert(s)` : `\n✅ vrai-benefice : ${r.ok} verts, 0 rouge`);
  process.exit(r.ko ? 1 : 0);
})();
