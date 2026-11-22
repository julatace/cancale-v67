#!/usr/bin/env node
// LES VENTES ANNULÉES, TOUTES PLATEFORMES (22 nov.) — exécute la VRAIE règle
// src/ventesAnnulees.js avec les VRAIES règles « annulée » de chaque plateforme
// (le miroir api/_lib/ventes-regle.js, identique à src/App.jsx au caractère près —
// audit-bilan-semaine ; api/_lib/ebay-etat-commande.js ; api/_lib/vestiaire-regle.js)
// et les VRAIS totaux d'argent (`ventesFaites`, `ventesDeclarables`).
//   1. chaque plateforme : identité `plateforme:n°`, motif lu ou « pas su », montant annulé ;
//   2. une vente annulée n'est dans AUCUN total d'argent (Vendu, Reçu) ;
//   3. « pas su » ≠ 0 : une plateforme pas lue n'a aucun chiffre et le total la nomme ;
//   4. 50 paires au même titre : 50 lignes, aucune fusion (§5) ;
//   5. le câblage : Statistiques et Ventes lisent CE module.
// `--mutation=X` : role-lbc · passu-zero · retour-taux · titre-identite · motif-devine ·
//                  demandee-annulee · argent-lbc · argent-vc · argent-vinted · devise · exclu
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const ICI = path.join(__dirname, '..');
const mut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let src = fs.readFileSync(path.join(ICI, 'src', 'ventesAnnulees.js'), 'utf8');
let regle = fs.readFileSync(path.join(ICI, 'api', '_lib', 'ventes-regle.js'), 'utf8');
const muter = (quoi, a, b) => { const t = quoi === 'src' ? src : regle; if (!t.includes(a)) { console.error('ancre absente :', a); process.exit(2); } if (quoi === 'src') src = t.replace(a, b); else regle = t.replace(a, b); };
if (mut === 'role-lbc') muter('src', 'if (v.isSeller !== true) {', 'if (v.isSeller === false) {');
if (mut === 'passu-zero') muter('src', "if (c.etat !== 'lu') {", 'if (false) {');
if (mut === 'retour-taux') muter('src', "if (l.sorte === 'retour') g.retours += 1; else g.annulees += 1;", 'g.annulees += 1;');
if (mut === 'titre-identite') muter('src', "if (tx == null || tx === '' || !garde('vinted:' + tx)) continue;", "if (tx == null || tx === '' || !garde('vinted:' + o.title)) continue;");
if (mut === 'motif-devine') muter('src', "  if (!s.trim()) return 'passu';", "  if (!s.trim()) return 'acheteur';");
if (mut === 'demandee-annulee') muter('src', "const annulee = !!e && (e.kind === 'cancelled' ||", "const annulee = !!e && (e.kind === 'cancelled' || e.kind === 'review' ||");
if (mut === 'devise') muter('src', "(!st.currency || txt(st.currency).toUpperCase() === 'EUR')", 'true');
if (mut === 'exclu') muter('src', "if (!v || !v.txId || excluAutre('leboncoin', v)) continue;", 'if (!v || !v.txId) continue;');
if (mut === 'argent-lbc') muter('regle', 'if (!v || v.isSeller !== true || !v.txId || lbcAnnulee(v)) continue;', 'if (!v || v.isSeller !== true || !v.txId) continue;');
if (mut === 'argent-vc') muter('regle', "if (!v || !v.id || vcVenteAnnulee(v) || (excluAutre && excluAutre('vestiaire', v)) || !garde('vestiaire:' + v.id)) continue;", "if (!v || !v.id || (excluAutre && excluAutre('vestiaire', v)) || !garde('vestiaire:' + v.id)) continue;");
if (mut === 'argent-vinted') muter('regle', "    if (classifyOrderStatus(o.status) === 'cancelled') continue;\n    const t = tsCommande(o); if (!t) continue;", '    const t = tsCommande(o); if (!t) continue;');
const tmp = path.join(ICI, 'src', `.audit-vannul-${process.pid}.mjs`);
const tmpR = path.join(ICI, 'api', '_lib', `.audit-vannul-regle-${process.pid}.mjs`);
fs.writeFileSync(tmp, src); fs.writeFileSync(tmpR, regle);
let ko = 0, n = 0;
const dit = (ok, l, d) => { n++; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${l}${!ok && d !== undefined ? ' — ' + d : ''}`); };
(async () => {
  try {
    const M = await import(pathToFileURL(tmp).href);
    const V = await import(pathToFileURL(tmpR).href);
    const E = await import(pathToFileURL(path.join(ICI, 'api', '_lib', 'ebay-etat-commande.js')).href);
    const VC = await import(pathToFileURL(path.join(ICI, 'api', '_lib', 'vestiaire-regle.js')).href);
    const R = { annuleeVinted: (o) => V.classifyOrderStatus(o.status) === 'cancelled', montantVinted: V.montantCommandeLu, lbcAnnulee: V.lbcAnnulee, etatEbay: E.etatCommandeEbay, vcVenteAnnulee: VC.vcVenteAnnulee, dateVenteVc: VC.dateVenteVc };
    const A = (uid, login) => ({ vinted_user_id: uid, login });
    const D = (j, m = 9) => new Date(2026, m, j, 12).toISOString();
    // Données INVENTÉES (aucune ligne réelle) — les FORMES sont celles mesurées en production le 22 nov.
    const vinted = [
      { transaction_id: 1, title: 'Nike Dunk 42', price: { amount: '40.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: D(2), _acc: A('111', 'atelier') },
      { transaction_id: 2, title: 'Nike Dunk 42', price: { amount: '35.0', currency_code: 'EUR' }, status: 'Remboursement effectué', date: D(5), _acc: A('111', 'atelier') },
      { transaction_id: 3, title: 'Samba 41', price: { amount: '50.0', currency_code: 'EUR' }, status: 'Le paiement a échoué', date: D(8), _acc: A('111', 'atelier') },
      { transaction_id: 4, title: 'Samba 41', price: { amount: '50.0', currency_code: 'EUR' }, status: "Commande non réclamée - Retournée à l'expéditeur.rice", date: D(9), _acc: A('111', 'atelier') },
      { transaction_id: 5, title: 'Puma 40', price: { amount: '20.0', currency_code: 'EUR' }, status: 'Retour initié', date: D(10), _acc: A('222', 'paris') },
      { transaction_id: 6, title: 'Puma 40', price: { amount: '20.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: D(11), _acc: A('222', 'paris') },
      { transaction_id: 7, title: 'Prix pas lu', status: 'Commande annulée', date: D(12), _acc: A('222', 'paris') },
      { transaction_id: 8, title: 'Livres', price: { amount: '20.0', currency_code: 'GBP' }, status: 'Commande annulée', date: D(12), _acc: A('222', 'paris') },
      { transaction_id: 9, title: 'Compte en panne', price: { amount: '20.0' }, status: 'Commande annulée', date: D(12), _acc: A('333', 'panne') },
      { transaction_id: 10, title: 'Compte exclu', price: { amount: '20.0' }, status: 'Commande annulée', date: D(12), _acc: A('444', 'exclu') },
      { transaction_id: 11, title: 'En cours', price: { amount: '30.0', currency_code: 'EUR' }, status: '', date: D(13), _acc: A('222', 'paris') },
    ];
    const lbc = [
      { txId: 'L1', isSeller: true, stepStatus: 'done', parcelStatus: 'delivered', price: 4500, dateVente: D(3), account: 'a1', accountName: 'boutique', title: 'Air Max' },
      { txId: 'L2', isSeller: true, stepStatus: 'cancelled', price: 6000, dateVente: D(4), account: 'a1', accountName: 'boutique', title: 'Air Max' },
      { txId: 'L3', stepStatus: 'cancelled', price: 7000, dateVente: D(4), account: 'a1', title: 'Rôle pas su' },                 // la forme réelle : `isSeller` absent
      { txId: 'L4', isSeller: false, stepStatus: 'cancelled', price: 7000, dateVente: D(4), account: 'a1', title: 'Achat annulé' },
      { txId: 'L5', isSeller: true, stepStatus: 'cancelled', price: 1000, dateVente: D(6), account: 'a9', title: 'Compte écarté' },
    ];
    const cmd = (id, pay, cancel, extra = {}) => ({ orderId: id, orderPaymentStatus: pay, orderFulfillmentStatus: 'NOT_STARTED', cancelStatus: cancel, creationDate: D(7), _compte: 'e1', _pseudo: 'ebay-atelier',
      pricingSummary: { priceSubtotal: { value: '80.00', currency: 'EUR' } }, paymentSummary: { totalDueSeller: { value: '70.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '8.00', currency: 'EUR' }, lineItems: [{ title: 'Jordan 1', legacyItemId: '900' + id }], ...extra });
    const ebay = [
      cmd('E1', 'PAID', { cancelState: 'NONE_REQUESTED' }),
      cmd('E2', 'PAID', { cancelState: 'CANCELED', cancelRequests: [{ cancelInitiator: 'BUYER', cancelReason: 'BUYER_CANCEL_ORDER', cancelCompletedDate: D(8) }] }),
      cmd('E3', 'FAILED', { cancelState: 'CANCELED', cancelRequests: [{ cancelInitiator: 'SELLER', cancelReason: 'BUYER_NO_PAYMENT' }] }),
      cmd('E4', 'PAID', { cancelState: 'CANCEL_REQUESTED', cancelRequests: [{ cancelInitiator: 'BUYER' }] }),
      cmd('E5', 'FULLY_REFUNDED', { cancelState: 'NONE_REQUESTED' }),
      cmd('E6', 'PAID', { cancelState: 'CANCELED' }, { pricingSummary: { priceSubtotal: { value: '60.00', currency: 'USD' } } }),
      cmd('E7', 'PAID', { cancelState: 'CANCEL_REJECTED' }),
    ];
    const vestiaire = [
      { id: 'V1', productId: '71', etat: 'IN_PROGRESS', date: D(5), prixVente: { valeur: 120, devise: 'EUR', cle: 'sellerPrice' }, montant: { valeur: 100, devise: 'EUR', cle: 'sellerEarning' }, compte: '37', titre: 'Sac' },
      { id: 'V2', productId: '72', etat: 'CANCELLED', date: D(6), prixVente: { valeur: 150, devise: 'EUR', cle: 'sellerPrice' }, montant: { valeur: 130, devise: 'EUR', cle: 'sellerEarning' }, compte: '37', titre: 'Sac' },
      { id: 'V3', productId: '73', etat: 'RETURNED', date: D(6), compte: '37', titre: 'Escarpins' },
    ];
    const args = { vinted, ko: ['333'], lbc, ebay, vestiaire, R, ecarteVinted: (u) => u === '444', excluAutre: (s, o) => s === 'leboncoin' && o.account === 'a9' };
    const X = M.ventesAnnulees(args);
    const L = (cle) => X.lignes.find((l) => l.cle === cle);
    const de = new Date(2026, 9, 1).getTime(), a = new Date(2026, 10, 1).getTime();
    const B = M.bilanAnnulees(X, { de, a });
    const P = (p) => B.plateformes.find((x) => x.plateforme === p) || {};

    // 1 — Vinted
    dit(L('vinted:2') && L('vinted:2').motif === 'remboursee' && L('vinted:2').sorte === 'annulee' && L('vinted:2').eur === 35, 'Vinted « Remboursement effectué » : annulée, motif « remboursée » (Vinted ne dit pas qui), 35 € annulés', JSON.stringify(L('vinted:2')));
    dit(L('vinted:3') && L('vinted:3').motif === 'non-payee', 'Vinted « Le paiement a échoué » : motif « non payée »', JSON.stringify(L('vinted:3') && L('vinted:3').motif));
    dit(L('vinted:4') && L('vinted:4').motif === 'non-reclamee' && L('vinted:4').sorte === 'retour' && L('vinted:5') && L('vinted:5').sorte === 'retour', 'Vinted « non réclamée — retournée » et « Retour initié » : des RETOURS, à part', JSON.stringify([L('vinted:4'), L('vinted:5')].map((x) => x && x.sorte)));
    dit(L('vinted:7') && L('vinted:7').eur === null && L('vinted:8') && L('vinted:8').eur === null, 'prix pas lu ou autre devise : montant annulé `null` (jamais 0, jamais converti)', JSON.stringify([L('vinted:7'), L('vinted:8')].map((x) => x && x.eur)));
    dit(!L('vinted:9') && !L('vinted:10') && !L('vinted:11') && !L('vinted:1'), 'compte pas lu, compte exclu, vente sans état, vente finalisée : aucune ligne « annulée »');
    dit(P('Vinted').annulees === 4 && P('Vinted').retours === 2 && P('Vinted').faites === 3 && P('Vinted').taux === 57.1 && P('Vinted').eurAnnule === 85 && P('Vinted').eurInconnus === 2,
      'Vinted : 4 annulées, 2 retours à part, 3 faites ⇒ taux 4 / 7 = 57,1 % ; 85 € annulés « au moins » (2 montants pas lus)', JSON.stringify({ a: P('Vinted').annulees, r: P('Vinted').retours, f: P('Vinted').faites, t: P('Vinted').taux, e: P('Vinted').eurAnnule, i: P('Vinted').eurInconnus }));
    dit((P('Vinted').manquants || []).join() === '333' && B.partiel === true, 'compte Vinted pas lu : nommé (`manquants`), le total est « partiel »', JSON.stringify(P('Vinted').manquants));
    // 2 — Leboncoin
    dit(L('lbc:L2') && L('lbc:L2').motif === 'passu' && L('lbc:L2').eur === 60 && !L('lbc:L3') && !L('lbc:L4') && !L('lbc:L5'), 'Leboncoin : annulée seulement s\'il est PROUVÉ vendeur ; « cancelled » seul ⇒ motif « pas su » ; compte écarté absent', JSON.stringify(X.lignes.filter((l) => l.plateforme === 'Leboncoin').map((l) => l.cle + ':' + l.motif)));
    dit(P('Leboncoin').roleInconnu === 1 && P('Leboncoin').annulees === 1 && P('Leboncoin').faites === 1 && P('Leboncoin').taux === 50, 'Leboncoin : l\'annulée sans rôle lu est comptée À PART (« rôle pas su » : 1), jamais dans le taux', JSON.stringify({ r: P('Leboncoin').roleInconnu, a: P('Leboncoin').annulees, f: P('Leboncoin').faites }));
    // 3 — eBay
    dit(L('ebay:E2') && L('ebay:E2').motif === 'acheteur' && L('ebay:E2').tsAnnulation === Date.parse(D(8)) && L('ebay:E2').eur === 80, 'eBay « CANCELED » par l\'acheteur : motif lu, date d\'annulation lue, 80 € annulés', JSON.stringify(L('ebay:E2')));
    dit(L('ebay:E3') && L('ebay:E3').motif === 'non-payee', 'eBay : annulée pour non-paiement ⇒ « non payée »', JSON.stringify(L('ebay:E3') && L('ebay:E3').motif));
    dit(!L('ebay:E4') && P('eBay').demandees === 1, 'eBay : annulation DEMANDÉE, pas tranchée ⇒ ni annulée ni faite, dite à part', JSON.stringify({ l: !!L('ebay:E4'), d: P('eBay').demandees }));
    dit(L('ebay:E5') && L('ebay:E5').motif === 'remboursee', 'eBay remboursée en entier : annulée, motif « remboursée »');
    dit(L('ebay:E6') && L('ebay:E6').eur === null && L('ebay:E6').motif === 'passu', 'eBay en dollars sans demande lisible : montant `null`, motif « pas su »', JSON.stringify(L('ebay:E6')));
    dit(!L('ebay:E7') && !L('ebay:E1') && P('eBay').faites === 2 && P('eBay').annulees === 4, 'eBay : annulation REFUSÉE = toujours une vente ; 4 annulées, 2 faites', JSON.stringify({ f: P('eBay').faites, a: P('eBay').annulees }));
    // 4 — Vestiaire
    dit(L('vestiaire:V2') && L('vestiaire:V2').motif === 'passu' && L('vestiaire:V2').eur === 150 && L('vestiaire:V3') && L('vestiaire:V3').sorte === 'retour' && L('vestiaire:V3').eur === null, 'Vestiaire « CANCELLED » : annulée, motif « pas su », 150 € ; « RETURNED » : retour à part, montant pas lu', JSON.stringify([L('vestiaire:V2'), L('vestiaire:V3')]));
    // 5 — L'ARGENT : les vrais totaux, sur les mêmes ventes.
    const F = V.ventesFaites({ vinted, lbc, ebay, vestiaire });
    const versements = {}; for (const o of vinted) versements[String(o.transaction_id)] = D(20);
    const Dd = V.ventesDeclarables({ vinted, lbc, ebay, vestiaire, versements });
    const tout = M.ventesAnnulees({ ...args, ko: [], ecarteVinted: () => false, excluAutre: () => false });
    const fF = M.annuleesDansArgent(tout, F.lignes), fD = M.annuleesDansArgent(tout, Dd.lignes);
    dit(F.lignes.length >= 5 && F.lignes.some((l) => l.plateforme === 'Vestiaire' && l.tx === 'V1') && fF.length === 0, `VENDU (\`ventesFaites\`, ${F.lignes.length} lignes) : aucune vente annulée dedans`, fF.join());
    dit(fD.length === 0, `REÇU / URSSAF (\`ventesDeclarables\`, ${Dd.lignes.length} lignes) : aucune vente annulée dedans`, fD.join());
    const sommeV = Math.round(F.lignes.filter((l) => l.plateforme === 'Vinted' || l.plateforme === 'Leboncoin').reduce((s, l) => s + l.eur, 0) * 100) / 100;
    dit(sommeV === 40 + 20 + 30 + 45, 'le Vendu Vinted + Leboncoin = les ventes FAITES seules (40 + 20 + 30, 45) — le montant annulé n\'y est jamais', String(sommeV));
    // 6 — « pas su » ≠ 0
    const B2 = M.bilanAnnulees(M.ventesAnnulees({ vinted, R, lbc: null, ebay: undefined, vestiaire: [] }), { de, a });
    const P2 = (p) => B2.plateformes.find((x) => x.plateforme === p) || {};
    dit(P2('Leboncoin').etat === 'passu' && P2('Leboncoin').annulees === null && P2('Leboncoin').taux === null && P2('eBay').etat === 'encours' && P2('eBay').annulees === null, 'plateforme pas lue ou en cours : AUCUN chiffre (`null`), jamais 0', JSON.stringify([P2('Leboncoin'), P2('eBay')].map((x) => [x.etat, x.annulees, x.taux])));
    dit(B2.partiel && B2.manquantes.join() === 'Leboncoin,eBay' && P2('Vestiaire').etat === 'lu' && P2('Vestiaire').annulees === 0 && P2('Vestiaire').taux === null, 'le total NOMME ce qui manque ; une plateforme LUE et vide : 0 annulée, taux « — » (rien à diviser)', JSON.stringify({ m: B2.manquantes, v: [P2('Vestiaire').annulees, P2('Vestiaire').taux] }));
    const B3 = M.bilanAnnulees(M.ventesAnnulees({ R }), {});
    dit(B3.etat === 'encours' && B3.total === null, 'rien de lu : état « en cours », total `null`', JSON.stringify([B3.etat, B3.total]));
    // 7 — 50 paires identiques
    const cinquante = Array.from({ length: 50 }, (_, i) => ({ transaction_id: 1000 + i, title: 'Nike Air Force 1 blanche 42', price: { amount: '60.0', currency_code: 'EUR' }, status: 'Commande annulée', date: D(15), _acc: A('111', 'atelier') }));
    const X50 = M.ventesAnnulees({ vinted: cinquante, R });
    dit(X50.lignes.length === 50 && new Set(X50.lignes.map((l) => l.cle)).size === 50, '50 ventes annulées au MÊME titre : 50 lignes, 50 identités (jamais fusionnées par ressemblance)', String(X50.lignes.length));
    const X2 = M.ventesAnnulees({ vinted: [cinquante[0], cinquante[0]], R });
    dit(X2.lignes.length === 1, 'la même transaction lue deux fois : comptée une fois', String(X2.lignes.length));
    // 8 — par mois, par compte
    const Bm = M.bilanAnnulees(X, {});
    dit(Bm.mois.length === 1 && Bm.mois[0].ym === '2026-10' && Bm.mois[0].annulees === B.total.annulees && B.total.annulees === 4 + 1 + 4 + 1 && B.total.retours === 3, 'par mois : octobre porte les 10 annulées et les 3 retours ; total = somme des plateformes', JSON.stringify({ m: Bm.mois.map((x) => [x.ym, x.annulees]), t: [B.total.annulees, B.total.retours] }));
    dit(P('Vinted').comptes.length === 2 && P('Vinted').comptes.every((c) => c.annulees + c.retours === c.liste.length), 'par compte : chaque compte porte SES annulations (liste = nombre)', JSON.stringify((P('Vinted').comptes || []).map((c) => [c.compte, c.annulees, c.retours, c.liste.length])));
    // 9 — le câblage (le texte de l'app, commentaires retirés)
    const sans = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const stats = sans(fs.readFileSync(path.join(ICI, 'src', 'ecrans', 'Stats.jsx'), 'utf8'));
    const app = sans(fs.readFileSync(path.join(ICI, 'src', 'App.jsx'), 'utf8'));
    dit(/from '\.\.\/ventesAnnulees\.js'/.test(stats) && /bilanAnnulees\(/.test(stats), 'Statistiques lit `bilanAnnulees` (src/ventesAnnulees.js)');
    dit(/ventesAnnulees\(/.test(app) && /data-toutes-annulees/.test(app), 'Ventes (tous les sites) lit `ventesAnnulees` et pose le groupe « Annulées »');
    dit(!/PLATEFORMES_NON_COUVERTES/.test(stats) && !/nonCouvertes/.test(stats), 'Statistiques ne dit plus « Leboncoin, eBay, Vestiaire : pas comptés »');
  } catch (e) { ko++; console.log('❌ exception : ' + ((e && e.stack) || e)); }
  finally { try { fs.unlinkSync(tmp); } catch (_) {} try { fs.unlinkSync(tmpR); } catch (_) {} }
  console.log(`\n${ko ? '❌' : '✅'} ${n - ko}/${n} — ventes annulées${mut ? ' (mutation ' + mut + ')' : ''}`);
  process.exit(ko ? 1 : 0);
})();
