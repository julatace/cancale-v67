#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : agent2-argent-parrainage (11 nov.) — PRÉVISION DU MOIS, COÛT PAR SITE
//         ET PAR MOIS, LIEN DE PARRAINAGE COURT.
//         node scripts/audit-argent-parrainage.cjs [--mutation=…] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/previsionMois.js et src/coutPlateformes.js sur des données
// INVENTÉES (dépôt public) et lit le branchement des écrans :
//   P. la prévision = le vendu PROUVÉ du mois ÷ le temps écoulé, prolongé ; moins
//      de 5 jours ⇒ « pas encore su », aucun chiffre ; fourchette qui s'élargit
//      quand les jours sont irréguliers et se resserre avec les jours lus ; le bas
//      jamais sous le déjà-vendu ; un site pas lu / une vente au montant pas lu ⇒
//      partielle et NOMMÉE ; pas lu ⇒ « — » ; bénéfice brut prévu SEULEMENT si les
//      prix d'achat couvrent (≥ 5 ventes et 80 %), sinon la couverture « N/M »,
//      jamais « au moins » ; jamais le mot « objectif » ni « sûr ».
//   C. le coût d'un site sur un mois = `fraisParPlateforme` (la carte « Frais par
//      site ») + ses abonnements ; le détail (boost, étiquettes, commission) vient
//      de la fiche ([11] du relevé) et somme au total ; eBay : étiquette payée par
//      l'acheteur (§2.8), commission LUE, couverture dite ; Vestiaire : commission
//      « pas lue » nommée ; site pas lu ⇒ « — » ; un abonnement n'est rattaché que
//      par le début de SON nom.
//   E. écrans : Statistiques monte la prévision et la vue « mois par mois » (UNE
//      vue à la fois, la carte d'avant gardée) ; Ma journée une ligne ; le relevé
//      porte le détail des frais ; le lien court `/r/CODE` redirigé (vercel.json).
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUTS = {
  'jours-min': ['if (jours < PREVISION_JOURS_MIN) return', 'if (jours < 1) return'],
  'bas-sous-vendu': ['const bas = Math.max(rond(cumul, -1), rond(centreBrut - PREVISION_Z * sd));', 'const bas = rond(centreBrut - PREVISION_Z * sd);'],
  'sans-fourchette': ['const sd = Math.sqrt(', 'const sd = 0 * Math.sqrt('],
  'manque-tu': ['partiel: manques.length > 0, manques };', 'partiel: false, manques: [] };'],
  'non-comptees-tues': ['if (nc) manques.push(', 'if (false) manques.push('],
  'benef-sans-couverture': ['if (nConnu < PREVISION_BENEF_N_MIN || nConnu / n < PREVISION_BENEF_COUV || !(cV > 0))', 'if (!(cV > 0))'],
  'benef-achat-zero': ['if (ach == null) continue;\n    nConnu += 1;', 'nConnu += 1;'],
  'passu-zero': ["if (vendu === null || !Array.isArray(vendu)) return { ...base, etat: 'passu' };", "if (vendu === null || !Array.isArray(vendu)) vendu = [];"],
  'cout-ebay-etiquette': ["etiquettes: plat === 'eBay' ? 'acheteur' : 'fiche'", "etiquettes: 'fiche'", 'coutPlateformes.js'],
  'cout-ebay-port-charge': ["          cat.vente += c(S.commission);                                   // lu chez eBay", "          cat.vente += c(S.commission); cat.etiquettes += 850;", 'coutPlateformes.js'],
  'cout-vestiaire-tu': ["if (plat === 'Vestiaire' && S.commissionPasLue) { L.manques.push('commission Vestiaire pas lue'); L.partiel = true; }", '', 'coutPlateformes.js'],
  'cout-passu-zero': ['L.total = L.passu ? null : somme;', 'L.total = somme;', 'coutPlateformes.js'],
  'cout-detail-faux': ['if (det && det[0] + det[1] + det[2] + det[3] === tot)', 'if (det)', 'coutPlateformes.js'],
  'cout-abo-ressemblance': ['Vinted: /^vinted\\b/i', 'Vinted: /vinted/i', 'coutPlateformes.js'],
  'cout-ebay-couverture-tue': ['if (S.couverture && S.couverture.lus < S.couverture.n)', 'if (false)', 'coutPlateformes.js'],
  'ecran-prevision-absente': ['<PrevisionMoisCarte liveStats', '<div data-retire liveStats', 'ecrans/Stats.jsx'],
  'ecran-deux-vues': ["if (vue === 'periode') return <div className=\"vrm-ap-cout\" data-cout-vue=\"periode\">{bascule}{parPeriode}</div>;", '', 'ArgentPlus.jsx'],
  'journee-absente': ['<PrevisionLigne liveStats', '<div data-retire liveStats', 'App.jsx'],
  'releve-sans-detail': ['fraisDetail: (o) => detailFraisFiche(effEntry(o)),', '', 'App.jsx'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'argent-plus-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  const f = path.join(d, 'src', MUTS[MUT][2] || 'previsionMois.js'); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MUTS[MUT][0])) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(MUTS[MUT][0], MUTS[MUT][1]));
  SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const lire = (f) => { try { return fs.readFileSync(path.join(SRC, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const url = (f) => require('url').pathToFileURL(path.join(SRC, f)).href;

(async () => {
  let P, C;
  try { P = await import(url('previsionMois.js')); } catch (e) { dit(false, 'src/previsionMois.js existe et se charge', e.message); }
  try { C = await import(url('coutPlateformes.js')); } catch (e) { dit(false, 'src/coutPlateformes.js existe et se charge', e.message); }
  if (!P || !C) { console.log(`\n❌ ${ok} verts, ${ko} rouges`); process.exit(1); }
  const J = 864e5;
  const de = new Date(2026, 10, 1).getTime();           // 1er novembre 2026, minuit local
  const t = (j, h = 14) => new Date(2026, 10, 1 + j, h).getTime();
  const midi = (j) => new Date(2026, 10, 1 + j, 12).getTime();

  console.log('\n── P. La prévision du mois');
  // 18 jours pleins, 100 € par jour, régulier ⇒ vers 3 000 € (30 jours), fourchette serrée.
  const regulier = [];
  for (let j = 0; j < 18; j++) regulier.push({ plateforme: 'Vinted', ts: t(j), eur: 100 });
  regulier.push({ plateforme: 'Vinted', ts: t(-2), eur: 999 });                     // octobre : n'entre pas
  const p1 = P.previsionMois({ vendu: regulier, maintenant: t(18, 0) + 1 });           // le 19, juste après minuit
  dit(p1.etat === 'ok' && p1.jours === 18 && p1.cumul === 180000, 'P1 18 jours lus, 1 800 € déjà vendus (octobre n’entre pas)', JSON.stringify({ e: p1.etat, j: p1.jours, c: p1.cumul }));
  dit(p1.centre === 300000, 'P2 au rythme réel (100 €/jour) : vers 3 000 € sur 30 jours', String(p1.centre));
  dit(p1.bas >= p1.cumul && p1.bas <= p1.centre && p1.haut >= p1.centre && (p1.haut - p1.bas) <= 20000, 'P3 jours réguliers : fourchette serrée autour du centre, jamais sous le déjà-vendu', JSON.stringify({ b: p1.bas, h: p1.haut }));
  // Irrégulier : même total, concentré sur 3 jours ⇒ fourchette plus large.
  const irreg = [{ ts: t(1), eur: 600 }, { ts: t(7), eur: 600 }, { ts: t(15), eur: 600 }].map((x) => ({ plateforme: 'Vinted', ...x }));
  const p2 = P.previsionMois({ vendu: irreg, maintenant: t(18, 0) + 1 });
  dit(p2.centre === 300000 && (p2.haut - p2.bas) > 3 * (p1.haut - p1.bas) && p2.bas >= p2.cumul, 'P4 jours irréguliers : même centre, fourchette bien plus large (honnête)', JSON.stringify({ c: p2.centre, b: p2.bas, h: p2.haut }));
  // Peu de jours ⇒ plus large que beaucoup de jours, à dispersion égale.
  const alterne = (n) => { const L = []; for (let j = 0; j < n; j++) L.push({ plateforme: 'Vinted', ts: t(j), eur: j % 2 ? 150 : 50 }); return L; };
  const p6 = P.previsionMois({ vendu: alterne(6), maintenant: t(6, 0) + 1 }), p20 = P.previsionMois({ vendu: alterne(20), maintenant: t(20, 0) + 1 });
  dit(p6.etat === 'ok' && p20.etat === 'ok' && (p6.haut - p6.bas) > (p20.haut - p20.bas), 'P5 6 jours lus : fourchette plus large qu’avec 20 jours', JSON.stringify({ six: [p6.bas, p6.haut], vingt: [p20.bas, p20.haut] }));
  const p4 = P.previsionMois({ vendu: alterne(4), maintenant: t(4, 0) + 1 });
  const T4 = P.textePrevision(p4);
  dit(p4.etat === 'tot' && p4.centre == null && T4.grand === '—' && /Pas encore su/.test(T4.sous) && T4.ligne == null, 'P6 moins de 5 jours : « pas encore su », aucun chiffre, aucune ligne dans Ma journée', JSON.stringify(T4));
  const pu = P.previsionMois({ vendu: undefined, maintenant: t(18) }), pn = P.previsionMois({ vendu: null, maintenant: t(18) });
  dit(pu.etat === 'encours' && pn.etat === 'passu' && P.textePrevision(pn).grand === '—' && pn.centre == null, 'P7 trois états : lecture en cours · pas lu (« — ») · lu');
  const pm = P.previsionMois({ vendu: regulier, manque: ['Leboncoin', 'shop_b'], nonComptees: [{ plateforme: 'eBay', ts: t(3) }, { plateforme: 'eBay', ts: t(-5) }], maintenant: t(18, 0) + 1 });
  const Tm = P.textePrevision(pm);
  dit(pm.partiel && /Leboncoin pas lu/.test(Tm.manque) && /shop_b/.test(Tm.manque) && /1 vente au montant pas lu/.test(Tm.manque), 'P8 un site, un compte pas lus, une vente au montant pas lu : partielle et NOMMÉE', Tm.manque);
  dit(pm.n === p1.n + 1, '  la vente au montant pas lu compte en vente (pas dans le montant)');
  const T1 = P.textePrevision(p1);
  dit(/^À ce rythme, novembre finira vers 3[\s\u202f\u00a0]000[\s\u00a0]€$/.test(T1.ligne) && /sur 18 jours lus/.test(T1.sous), 'P9 la phrase : « À ce rythme, novembre finira vers 3 000 € » · « sur 18 jours lus »', JSON.stringify(T1));
  const tout = JSON.stringify([T1, Tm, T4]) + lire('ArgentPlus.jsx');
  dit(!/objectif|c’est sûr|garanti/i.test(sansCommentaires(tout)), 'P10 jamais présenté comme un objectif ni comme sûr');
  // Le bénéfice brut prévu.
  const rel = (n, nConnu) => { const L = []; for (let i = 0; i < n; i++) L.push(['Vinted', 'a', String(i), t(i % 18), 100, i < nConnu ? 60 : null, 0, 'x']); return L; };
  const pb = P.previsionMois({ vendu: regulier, releve: rel(10, 9), maintenant: t(18, 0) + 1 });
  dit(pb.benef.etat === 'ok' && pb.benef.centre === 120000, 'P11 prix d’achat connus sur 9/10 : bénéfice brut prévu (40 % de 3 000 € = 1 200 €)', JSON.stringify(pb.benef));
  const pc = P.previsionMois({ vendu: regulier, releve: rel(10, 5), maintenant: t(18, 0) + 1 });
  dit(pc.benef.etat === 'couverture' && pc.benef.centre == null && pc.benef.nConnu === 5 && pc.benef.n === 10, 'P12 prix connus sur 5/10 : pas de bénéfice prévu, la couverture dite', JSON.stringify(pc.benef));
  const pd = P.previsionMois({ vendu: regulier, releve: rel(4, 4), maintenant: t(18, 0) + 1 });
  dit(pd.benef.etat === 'couverture', 'P13 moins de 5 ventes au prix connu : pas de bénéfice prévu');
  dit(!/au moins/.test(sansCommentaires(lire('ArgentPlus.jsx'))), 'P14 jamais « au moins » devant un bénéfice (src/beneficeNoms.js)');

  console.log('\n── C. Ce que coûte chaque site, mois par mois');
  const RR = { commandeEbayEngagee: () => true };
  const releve = [
    ['Vinted', 'a', '1', t(2), 80, 40, 5.5, 'x', '', '', null, [300, 250, 0, 0]],      // boost 3 €, port 2,50 €
    ['Vinted', 'a', '2', t(3), 60, 30, 1.2, 'x'],                                     // relevé d'avant : sans détail
    ['Vinted', 'a', '3', t(-10), 60, 30, 9, 'x', '', '', null, [900, 0, 0, 0]],       // octobre
    ['Leboncoin', '', 'l1', t(4), 50, 20, 0, 'x'],
    ['Vestiaire', '', 'v1', t(5), 120, 60, null, 'x'],
  ];
  const ebay = [
    { orderId: 'e1', orderPaymentStatus: 'PAID', creationDate: new Date(t(6)).toISOString(), paymentSummary: { totalDueSeller: { value: '90.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '12.00', currency: 'EUR' } },
    { orderId: 'e2', orderPaymentStatus: 'PAID', creationDate: new Date(t(7)).toISOString(), paymentSummary: { totalDueSeller: { value: '50.00', currency: 'EUR' } } },
  ];
  const compta = {
    packs: [{ plateforme: 'Leboncoin', montant: 4.99, date: '2026-11-03' }, { plateforme: 'Vinted', montant: 2.3, date: '2026-10-12' }],
    abonnements: [{ libelle: 'Vinted Pro', montant: 10, periode: 'mois', debut: '2026-09-01', fin: '' }, { libelle: 'Mon Vinted coach', montant: 7, periode: 'mois', debut: '2026-09-01' }, { libelle: 'Canva', montant: 12, periode: 'mois', debut: '2026-01-01' }],
  };
  const chargeAbo = (a, ym) => (a.debut && a.debut.slice(0, 7) <= ym && (!a.fin || a.fin.slice(0, 7) >= ym) ? Number(a.montant) : 0);
  const M = C.coutParPlateforme({ releve, ebay, compta, mois: ['2026-11', '2026-10'], R: RR, chargeAbo });
  const S = (ym, p) => M.find((m) => m.ym === ym).sites.find((s) => s.plat === p);
  const v = S('2026-11', 'Vinted');
  dit(v.cat.boost === 300 && v.cat.etiquettes === 250 && v.cat.autres === 120 && v.cat.abonnements === 1000, 'C1 Vinted novembre : boost 3 €, étiquette 2,50 € (fiche), 1,20 € sans détail = « autres », Vinted Pro 10 €', JSON.stringify(v.cat));
  dit(v.total === 300 + 250 + 120 + 1000 && v.verif.frais === v.verif.detail, 'C2 le total = « Frais par site » du mois (même règle) + l’abonnement rattaché', JSON.stringify({ total: v.total, verif: v.verif }));
  dit(!JSON.stringify(M).includes('"abonnements":1700') && S('2026-11', 'Vinted').cat.abonnements === 1000, 'C3 « Mon Vinted coach », « Canva » : pas rattachés à Vinted (seul le début du nom compte)');
  const o = S('2026-10', 'Vinted');
  dit(o.cat.boost === 900 + 230 && o.cat.abonnements === 1000, 'C4 octobre à part : boost de la fiche + pack Vinted noté (2,30 €)', JSON.stringify(o.cat));
  const e = S('2026-11', 'eBay');
  dit(e.cat.vente === 1200 && e.cat.etiquettes === 0 && e.src.etiquettes === 'acheteur' && e.src.vente === 'lu', 'C5 eBay : commission LUE (12 €), étiquette payée par l’acheteur — jamais une charge (§2.8)', JSON.stringify(e));
  dit(e.partiel && e.manques.some((x) => /frais eBay lus sur 1\/2/.test(x)), 'C6 eBay : une commande aux frais pas lus ⇒ couverture dite', JSON.stringify(e.manques));
  const vc = S('2026-11', 'Vestiaire');
  dit(vc.partiel && vc.manques.includes('commission Vestiaire pas lue') && vc.src.vente === 'passu', 'C7 Vestiaire : « commission Vestiaire pas lue », nommée', JSON.stringify(vc));
  const lb = S('2026-11', 'Leboncoin');
  dit(lb.cat.boost === 499 && lb.total === 499, 'C8 Leboncoin : le pack photo noté dans Dépenses (4,99 €)', JSON.stringify(lb));
  const Mn = C.coutParPlateforme({ releve: null, ebay: null, compta, mois: ['2026-11'], R: RR, chargeAbo });
  dit(Mn[0].sites.filter((s) => s.plat !== 'Leboncoin').every((s) => s.total == null && s.passu), 'C9 relevé et eBay pas lus : « — », jamais 0', JSON.stringify(Mn[0].sites.map((s) => [s.plat, s.total])));
  dit(JSON.stringify(C.detailFraisFiche({ fees: '3', transportVendeur: '2,50', commission: '', emballage: '0,40' })) === '[300,250,0,40]' && C.detailFraisFiche({}) === null, 'C10 le détail de la fiche : [boost, port payé par lui, commission, reste] — rien noté ⇒ rien rangé');
  dit(C.moisAvant(t(10), 4).join(',') === '2026-11,2026-10,2026-09,2026-08', 'C11 quatre mois, le plus récent d’abord');

  console.log('\n── E. Les écrans');
  const stats = sansCommentaires(lire('ecrans/Stats.jsx')), app = sansCommentaires(lire('App.jsx')), ap = sansCommentaires(lire('ArgentPlus.jsx'));
  dit(/<PrevisionMoisCarte liveStats=\{liveStats\}/.test(stats), 'E1 Statistiques monte la prévision du mois (près de l’objectif)');
  dit(/<CoutSitesCarte periode=\{periodeStats\} ebayCommandes=\{ebayCommandes\} parPeriode=\{<FraisParSiteCarte/.test(stats) && /if \(vue === 'periode'\) return/.test(ap), 'E2 « Frais par site » gardé ; « Mois par mois » est une AUTRE vue (le même nombre jamais deux fois)');
  dit(/<PrevisionLigne liveStats=\{liveStats\}/.test(app) && /if \(P\.etat !== 'ok' \|\| !T\.ligne\) return null;/.test(ap), 'E3 Ma journée : une ligne, seulement quand la prévision est sue');
  dit(/fraisDetail: \(o\) => detailFraisFiche\(effEntry\(o\)\)/.test(app), 'E4 le relevé de Ventes porte le détail des frais de SA fiche ([11])');
  dit(!/beneficePaire|coutsVente\(/.test(ap + sansCommentaires(lire('coutPlateformes.js')).replace(/import[^\n]*\n/g, '')), 'E5 aucun second calcul de bénéfice ni de frais dans les écrans');
  dit(!/#D70015|#FF3B30|#ff3b30|red\b/i.test(lire('argent-plus.css')), 'E6 aucun rouge (§7)');
  let vj = null; try { vj = JSON.parse(fs.readFileSync(path.join(R, 'vercel.json'), 'utf8')); } catch (_) {}
  const red = vj && Array.isArray(vj.redirects) ? vj.redirects.find((x) => /^\/r\//.test(x.source)) : null;
  dit(!!red && red.destination === '/?parrain=:code' && red.permanent === false, 'E7 le lien court `/r/CODE` redirige vers `/?parrain=CODE` (vercel.json)', JSON.stringify(red));
  let E = {}; try { E = await import(url('abonnement/etatAbonnement.js')); } catch (_) {}
  dit(E.lienParrainage && E.lienParrainage('K7MQ4RZP') === 'https://vrm.center/r/K7MQ4RZP' && E.codeParrainDuChemin('/r/k7mq4rzp') === 'K7MQ4RZP' && E.codeParrainDuChemin('/r/K7MQ4RZ0') === '', 'E8 le lien partagé est `vrm.center/r/CODE`, relu aussi sans redirection (un 0 n’est pas un code)');
  console.log(`\n${ko ? '❌' : '✅'} audit-argent-parrainage : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
