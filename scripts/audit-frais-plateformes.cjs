// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : CE QUE COÛTE CHAQUE SITE — FRAIS LUS, COUVERTURE DITE
//         node scripts/audit-frais-plateformes.cjs [--mutation=couverture|vcpct|periode|packs|ebayfrais]
// ═══════════════════════════════════════════════════════════════════════════
// Julien (4 nov.) : sur la période, ce que coûte chaque site, en € et en % de
// ce qu'il a vendu, couverture dite (« frais lus sur N/M ventes »).
// L'audit EXÉCUTE src/fraisPlateformes.js avec la vraie `commandeEbayEngagee`
// d'App.jsx, sur des ventes INVENTÉES (forme du relevé `vrm_stats_ventes` et des
// commandes eBay rangées), et compare à un calcul fait ici à la main :
//   · Vinted et Leboncoin : les frais saisis (relevé) + packs/options du site ;
//   · eBay : `totalMarketplaceFee` de chaque commande, base = dû au vendeur ;
//     frais pas lus ⇒ couverture « n/m », jamais 0 € caché ;
//   · Vestiaire : commission pas lue ⇒ dite, pas de % ;
//   · hors période, commande annulée, compte écarté ⇒ rien ; relevé pas publié ⇒ « pas lu ».
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!c || process.env.BAVARD) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const APP = lire('src/App.jsx');
let MODULE = lire('src/fraisPlateformes.js');
const muter = (avant, apres) => { if (!MODULE.includes(avant)) { console.log('❌ mutation impossible : ' + avant.slice(0, 80)); process.exit(2); } MODULE = MODULE.replace(avant, apres); };
if (MUT === 'couverture') muter('if (du == null || f == null) continue;', 'if (du == null) continue; if (f == null) { S.nLus += 1; S.cBase += c(du); continue; }');
else if (MUT === 'vcpct') { muter("const pct = S.plateforme === 'Vestiaire' || ", 'const pct = '); muter(' || (couverture && couverture.lus === 0) ? null', ' ? null'); }
else if (MUT === 'periode') muter('const dans = (t) => Number.isFinite(t) && t >= de && t < a;', 'const dans = (t) => Number.isFinite(t);');
else if (MUT === 'packs') muter('S.cPacks += c(m); S.nPacks += 1;', '');
else if (MUT === 'ebayfrais') muter("if (plat === 'eBay' || !ORDRE.includes(plat)) continue;", "if (!ORDRE.includes(plat)) continue;");
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
function extraire(src, nom) {
  const m = new RegExp(`^(?:export )?(?:async )?function ${nom}\\(|^(?:export )?const ${nom}\\s*=\\s*`, 'm').exec(src);
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
const charger = async (texte, nom) => {
  const tmp = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, texte);
  try { return await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
};

(async () => {
  let M = null; try { M = await charger(MODULE, 'frais'); if (typeof M.fraisParPlateforme !== 'function') M = null; } catch (_) { M = null; }
  dit(!!M, 'src/fraisPlateformes.js exporte `fraisParPlateforme`');
  const ctx = {}; vm.createContext(ctx);
  const t = extraire(APP, 'commandeEbayEngagee'); dit(!!t, 'App.jsx porte `commandeEbayEngagee`');
  if (t) vm.runInContext(t.replace(/^const /, 'var '), ctx);
  if (M && t) {
    const T = (m, j) => new Date(2026, m, j, 12).getTime();
    const de = new Date(2026, 9, 1).getTime(), a = new Date(2026, 10, 1).getTime();   // octobre
    // [plateforme, compte, id, ts, vente, achat, frais, titre]
    const releve = [
      ['Vinted', 'a', 'v1', T(9, 3), 100, 40, 3.5, ''], ['Vinted', 'a', 'v2', T(9, 9), 50, null, 0, ''], ['Vinted', 'b', 'v3', T(10, 2), 80, 30, 9, ''],   // v3 : novembre
      ['Leboncoin', 'L', 'l1', T(9, 5), 40, 10, 0, ''],
      ['Vestiaire', 'V', 'c1', T(9, 6), 203.23, 90, 0, ''],
      ['eBay', 'e', 'e1', T(9, 7), 95.7, 50, 0, ''],                                   // eBay se lit sur ses commandes
    ];
    const eur = (v) => ({ value: String(v), currency: 'EUR' });
    const ebay = [
      { orderId: 'E1', orderPaymentStatus: 'PAID', creationDate: '2026-10-07T10:00:00Z', paymentSummary: { totalDueSeller: eur(110) }, totalMarketplaceFee: eur(14.3) },
      { orderId: 'E2', orderPaymentStatus: 'PAID', creationDate: '2026-10-08T10:00:00Z', paymentSummary: { totalDueSeller: eur(60) } },                     // frais pas lus
      { orderId: 'E3', orderPaymentStatus: 'PAID', creationDate: '2026-10-09T10:00:00Z', paymentSummary: { totalDueSeller: eur(70) }, totalMarketplaceFee: eur(9), cancelStatus: { cancelState: 'CANCELED' } },
      { orderId: 'E4', orderPaymentStatus: 'PAID', creationDate: '2026-10-10T10:00:00Z', paymentSummary: { totalDueSeller: eur(40) }, totalMarketplaceFee: eur(5), _compte: 'ecarte' },
      { orderId: 'E5', orderPaymentStatus: 'PAID', creationDate: '2026-11-02T10:00:00Z', paymentSummary: { totalDueSeller: eur(40) }, totalMarketplaceFee: eur(5) },
    ];
    const packs = [{ plateforme: 'Leboncoin', date: '2026-10-12', montant: 4.99 }, { plateforme: 'Vinted', date: '2026-10-20', montant: 2.3 }, { plateforme: 'Vinted', date: '2026-11-01', montant: 9 }];
    const excluAutre = (site, o) => site === 'ebay' && o._compte === 'ecarte';
    const F = M.fraisParPlateforme({ releve, ebay, packs, de, a, excluAutre, R: { commandeEbayEngagee: ctx.commandeEbayEngagee } });
    const S = (k) => F.sites.find((x) => x.plateforme === k);
    dit(S('Vinted') && S('Vinted').n === 2 && S('Vinted').frais === 5.8 && S('Vinted').pct === 3.9, 'Vinted : 2 ventes d’octobre, 3,50 € de frais saisis + 2,30 € de pack = 5,80 €, 3,9 % de 150 €', JSON.stringify(S('Vinted')));
    dit(S('Leboncoin') && S('Leboncoin').frais === 4.99 && S('Leboncoin').pct === 12.5, 'Leboncoin : le pack d’options (4,99 €), 12,5 % de 40 €', JSON.stringify(S('Leboncoin')));
    dit(S('eBay') && S('eBay').n === 2 && S('eBay').frais === 14.3 && S('eBay').couverture.lus === 1 && S('eBay').couverture.n === 2, 'eBay : frais lus sur 1/2 commandes (14,30 €) ; l’annulée et le compte écarté n’entrent pas', JSON.stringify(S('eBay')));
    dit(S('eBay').pct === 13, 'eBay : % sur les seules commandes aux frais lus (14,30 / 110)', String(S('eBay').pct));
    dit(M.texteCouverture(S('eBay')) === 'frais lus sur 1/2 ventes', 'la couverture est DITE', M.texteCouverture(S('eBay')));
    dit(S('Vestiaire') && S('Vestiaire').commissionPasLue && S('Vestiaire').pct == null && M.texteCouverture(S('Vestiaire')) === 'commission pas lue', 'Vestiaire : commission pas lue, aucun %');
    dit(F.partiel === true, 'le total se dit partiel (eBay 1/2, Vestiaire)');
    dit(Math.abs(F.total - (5.8 + 4.99 + 14.3)) < 0.005, 'total = 25,09 €', String(F.total));
    const G = M.fraisParPlateforme({ releve: null, ebay: null, packs: [], de, a, R: { commandeEbayEngagee: ctx.commandeEbayEngagee } });
    dit(G.sites.every((x) => x.passu && x.frais == null), 'rien de publié ni lu ⇒ « pas lu », jamais 0 €');
  }
  const A0 = sansCommentaires(APP);
  dit(/<FraisParSiteCarte periode=\{periodeStats\} ebayCommandes=\{ebayCommandes\}\/>/.test(A0), 'Statistiques monte « Frais par site » sur la période choisie');
  dit(/fraisParPlateforme\(\{ releve: releve \? releve\.l : null, ebay: Array\.isArray\(ebayCommandes\) \? ebayCommandes : null, packs: compta && compta\.packs/.test(A0), 'avec le relevé de Ventes, les commandes eBay et les packs de Comptabilité');
  console.log(`\n${ko ? '❌' : '✅'} audit-frais-plateformes : ${ok} vert(s), ${ko} rouge(s)${MUT ? ' [mutation ' + MUT + ']' : ''}`);
  process.exit(ko ? 1 : 0);
})();
