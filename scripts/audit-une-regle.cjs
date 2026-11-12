// ════════════════════════════════════════════════════════════════════════════
//  GARDIEN — FAMILLE « UNE RÈGLE PAR NOTION » (11 nov., familles de l'app)
//  §5 / §11 : une notion = une règle, un propriétaire. Trois doublons réglés :
//   A. « En attente » (Trésorerie) = l'argent à venir (src/argentAVenir.js, règle du
//      4 nov.) — plus la somme des statuts « en cours » (220 € de trop mesurés) ;
//   B. bénéfice Leboncoin / Vestiaire = `beneficePaire` (prix − achat − frais SAISIS),
//      comme Vinted : le total (`ventesAutresBenefice`) ET la carte d'une vente Leboncoin ;
//   C. bénéfice de la fiche d'une paire vendue sur Leboncoin = `beneficePaire`.
//    node scripts/audit-une-regle.cjs            → contrôle
//    node scripts/audit-une-regle.cjs --prouve   → chaque mutation doit faire rougir
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const vm = require('vm');
const { prouver, sansCommentaires, extraire } = require('./_mutations-gardien.cjs');

const R = process.env.VRM_RACINE || path.join(__dirname, '..');

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['trésorerie : somme des statuts « en cours »', 'src/App.jsx', "const val = useEscrow ? walletEscrow.total : aV.valeur;", "const val = useEscrow ? walletEscrow.total : (sales.items||[]).filter(o=>classifyOrderStatus(o.status)==='pending').reduce((t,o)=>t+Number(o.price?.amount||0),0);"],
    ['total Leboncoin : frais de la fiche oubliés', 'src/App.jsx', "frais: fraisDuNum(nL, 'Leboncoin')", "frais: 0"],
    ['carte Leboncoin : prix − achat', 'src/App.jsx', "    const benef = r ? r.benefice : null;", "    const benef = r && r.achat != null ? (prix - r.achat) : null;"],
    ['fiche : bénéfice Leboncoin sans frais', 'src/fichePaire.js', "const bilL = venteC != null ? beneficePaire(venteC / 100, entree || {}) : null;", "const bilL = venteC != null ? beneficePaire(venteC / 100, { buyPrice: entree && entree.buyPrice, fraisComplets: true }) : null;"],
  ];
  process.exit(prouver(__filename, MUT, R) ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const imp = async (f) => { try { return await import('file://' + path.join(R, f)); } catch (e) { return { __erreur: e.message }; } };

(async () => {
  const APP = require(path.join(R, 'scripts', '_source-app.cjs')).sourceApp(R);
  const APPc = sansCommentaires(APP);
  const BP = await imp('src/beneficePaire.js');

  console.log('── A · « En attente » de la Trésorerie = l’argent à venir (une règle)');
  {
    const i = APPc.indexOf('const treasury = useMemo(');
    const bloc = i >= 0 ? APPc.slice(i, APPc.indexOf('}, [', i)) : '';
    dit(bloc && !/'pending'/.test(bloc) && !/\battente\s*\+=/.test(bloc), 'le calcul de la Trésorerie ne somme plus les statuts « en cours »', bloc ? bloc.slice(0, 160) : 'introuvable');
    const j = APPc.indexOf('En attente (porte-monnaie Vinted)');
    const carte = j >= 0 ? APPc.slice(Math.max(0, j - 900), j) : '';
    dit(/aVenirPour\(\s*liveStats\s*&&\s*liveStats\.aVenir/.test(carte) && /aV\.valeur/.test(carte), 'la carte « En attente » lit `aVenirPour(liveStats.aVenir)` (src/argentAVenir.js)', carte.slice(-200));
  }

  console.log('\n── B · Bénéfice Leboncoin / Vestiaire = beneficePaire (frais saisis compris)');
  {
    const ctx = { Number, String, Math, isFinite, Array, Object, Set, Date, NaN };
    vm.createContext(ctx);
    const noms = ['cleNum', 'ficheUniqueDuNumero', 'lbcAnnulee', 'lbcFinalisee', 'ventesAutresBenefice'];
    const absents = [];
    for (const n of noms) { const t = extraire(APP, n); if (!t) { absents.push(n); continue; } try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (e) { absents.push(n + ' ' + e.message); } }
    Object.assign(ctx, { commandeEbayEngagee: () => false, montantRecuEbay: () => ({ eur: null }), vcVenteAnnulee: () => false, etapeMotVc: () => 'versee', montantRecuVc: (v) => ({ eur: v.eur }), dateVenteVc: () => 1 });
    dit(!absents.length, 'App.jsx : ventesAutresBenefice et ses règles se lisent', absents.join(', '));
    if (ctx.ventesAutresBenefice && !BP.__erreur) {
      const fiche = { numero: '12', buyPrice: '10', emballage: '2', transportVendeur: '3', commission: '4', fraisComplets: true };
      const chargesVente = (e) => BP.coutsVente(e).total;
      // La MÊME fonction que l'app passe (extraite de son appel).
      const m = /const fraisFicheAutres = ([^;]+);/.exec(APPc);
      let fraisApp = null; try { fraisApp = m ? vm.runInNewContext(`(${m[1]})`, { coutsVente: BP.coutsVente, chargesVente, Object }) : null; } catch (_) {}
      dit(typeof fraisApp === 'function', 'l’app passe les frais de la fiche à ventesAutresBenefice (`fraisFicheAutres`)', m ? m[0].slice(0, 120) : 'absent');
      const out = ctx.ventesAutresBenefice({ lbc: [{ isSeller: true, txId: 'T1', price: 3000, parcelColor: 'finished' }], ebay: [], vestiaire: [{ id: 'V1', num: '12', eur: 50 }],
        numeros: { a: fiche }, achat: (f) => Number(f.buyPrice), numLbc: () => '12', numEbayLigne: () => '', frais: fraisApp || undefined });
      const L = out.find((x) => x.plateforme === 'Leboncoin'), V = out.find((x) => x.plateforme === 'Vestiaire');
      const bpL = BP.beneficePaire(30, fiche);
      dit(L && L.frais === 9 && Math.abs((L.eur - L.achat - L.frais) - bpL.benefice) < 0.005, 'Leboncoin : prix − achat − frais saisis (emballage, port, commission) = beneficePaire', JSON.stringify(L));
      dit(V && V.frais === 5, 'Vestiaire : frais saisis SANS la commission (déjà retirée du versement)', JSON.stringify(V));
    }
    const i = APPc.indexOf('const infoVente = (o) => {');
    const bloc = i >= 0 ? APPc.slice(i, APPc.indexOf('return { num, benef', i)) : '';
    dit(bloc && /beneficeLigneVente\(/.test(bloc) && !/prix\s*-\s*[\w.]*achat/i.test(bloc), 'la carte d’une vente Leboncoin lit `beneficeLigneVente` (la règle du total), plus `prix − achat`', bloc.slice(0, 200));
  }

  console.log('\n── C · La fiche d’une paire vendue sur Leboncoin');
  {
    const F = await imp('src/fichePaire.js');
    if (F.__erreur) dit(false, 'src/fichePaire.js se charge', F.__erreur);
    else {
      const rn = { cle: '12', etat: 'trouve', annonces: [{ id: 'A1', title: 'Baskets inventées' }], ventes: { vinted: [], lbc: [{ txId: 'T1', price: 3000, title: 'Baskets inventées' }], ebay: [] }, manques: [] };
      let p = null; try { p = F.parcoursPaire(rn, { fiches: { A1: { numero: '12', buyPrice: '10', emballage: '2', fraisComplets: true } } }, { lbcAnnulee: () => false, lbcFinalisee: () => true }); } catch (e) { p = { erreur: e.message }; }
      const r = p && p.resume;
      dit(r && r.benefice === 1800 && r.benefPartiel === false, 'fiche : 30 € − 10 € − 2 € d’emballage = 18 € (beneficePaire), exact quand les frais sont confirmés', JSON.stringify(r || p));
      let q = null; try { q = F.parcoursPaire(rn, { fiches: { A1: { numero: '12', buyPrice: '10' } } }, { lbcAnnulee: () => false, lbcFinalisee: () => true }); } catch (e) { q = { erreur: e.message }; }
      dit(q && q.resume && q.resume.benefice === 2000 && q.resume.benefPartiel === true, 'fiche : frais pas confirmés ⇒ « au plus » (partiel), comme Vinted', JSON.stringify(q && q.resume));
    }
  }

  console.log(`\n${ko ? '❌' : '✅'} une règle par notion : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
