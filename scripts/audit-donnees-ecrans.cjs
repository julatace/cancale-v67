// ⚠️⚠️ AUDIT DES DONNÉES — CHAQUE CHIFFRE AU BON ENDROIT (2 novembre)
//
// Julien : « audite le site : toutes les données qui sont à un tel endroit
// doivent correspondre à ce qui est attendu, il ne doit y avoir aucune erreur.
// Envisage tous les cas de figure de tous les utilisateurs. »
//
// Ce contrôle EXÉCUTE les vraies règles (§6) sur des données INVENTÉES à la
// vraie forme (commandes eBay `paymentSummary.totalDueSeller`, ventes Vestiaire
// rangées `{ etat, montant: { valeur, devise, cle } }`, ventes Leboncoin au prix
// en centimes, dates ISO) et juge ce qu'elles RENDENT :
//   G1  une commande eBay aux frais pas encore lus (ou dans une autre devise)
//       est VENDUE : elle sortait du « Vendu » de Ma journée, de Statistiques,
//       du widget et du bilan sans être dite (total partiel présenté complet) ;
//       au « reçu »/CA déclaré, elle n'était pas `manque` (carte URSSAF muette) ;
//   G2  « dimanche 1 novembre » en tête de Ma journée (« 1er ») ;
//   D1  « Finalisé par plateforme » (Statistiques) : Vestiaire écrit « pas encore
//       de vente captée » en dur alors que ses ventes au montant sûr comptent
//       partout ailleurs ; un prix Leboncoin inconnu y valait 0 € ;
//   D2  une date de vente illisible s'affichait « Invalid Date » ;
//   D3  la valeur des annonces devenait « NaN € » sur un prix illisible ;
//   D4  base lente : « Lie un compte Vinted » et « Aucun colis à envoyer »
//       affirmés avant que la liste des comptes et les ventes soient revenues ;
//   D5  la semaine de Ma journée traçait sept « 0 » quand aucune vente n'était lue ;
//   D6  clés de mois/jour en UTC (charge saisie le 1er à 0 h 30 datée du mois
//       d'avant ; objectif et jours de vente au jour UTC) ;
//   D7  « Finalisé sur Vinted » : un prix illisible comptait 0 € sans être dit.
// Et UNE règle pour un nombre : le miroir serveur des ventes est identique à
// l'app ; « vendu ce mois » de Ma journée = la coque = Statistiques.
//
//   node scripts/audit-donnees-ecrans.cjs              → le contrôle
//   node scripts/audit-donnees-ecrans.cjs --mutations  → chaque règle réaffaiblie
//        dans une copie : le contrôle doit passer au ROUGE (§6.1).
// Aucune donnée réelle : tout est inventé ici.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');

if (process.argv.includes('--mutations')) {
  const MUT = [
    ['eBay aux frais pas lus tue dans « vendu » (app)', 'src/App.jsx', "if (eur == null && !vus.has('ebay:' + e.orderId)) nonComptees.push({ plateforme: 'eBay', raison: montantRecuEbay(e).raison, ts: t || null });", ''],
    ['eBay aux frais pas lus tue dans « vendu » (serveur)', 'api/_lib/ventes-regle.js', "if (eur == null && !vus.has('ebay:' + e.orderId)) nonComptees.push({ plateforme: 'eBay', raison: montantRecuEbay(e).raison, ts: t || null });", ''],
    ['eBay écartée du reçu sans `manque`', 'src/App.jsx', "ecartees.push({ id, plateforme: 'eBay', raison: recu.raison, titre: '', manque: true, ts: Date.parse(e.creationDate || '') || null })", "ecartees.push({ id, plateforme: 'eBay', raison: recu.raison, titre: '' })"],
    ['« 1 novembre »', 'src/App.jsx', "${d.getDate() === 1 ? '1er' : d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'long' })}`;\n// (2 nov., audit des données ; limites n°14)", "${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'long' })}`;\n// (2 nov., audit des données ; limites n°14)"],
    ['« Invalid Date »', 'src/App.jsx', ": 'date inconnue'; };\nconst dateLocaleISO", ": new Date(t).toLocaleDateString('fr-FR', opts); };\nconst dateLocaleISO"],
    ['Vestiaire « pas encore de vente captée » en dur', 'src/App.jsx', "{ nom:'Vestiaire Collective', ca:vc.ca, note:vc.note },", "{ nom:'Vestiaire Collective', ca:null, note:'pas encore de vente captée' },"],
    ['prix Leboncoin inconnu compté 0 €', 'src/App.jsx', "const caLbc = (lbcOk.length && !lbcSansPrix) ? lbcOk.reduce((s,o)=> s + lbcPrix(o), 0) : null;", "const caLbc = lbcOk.length ? lbcOk.reduce((s,o)=> s + (lbcPrix(o)||0), 0) : null;"],
    ['Statistiques : « vendu » sans les non comptées', 'src/App.jsx', 'const partielVendu = manque.length > 0 || ncPeriode.length > 0;', 'const partielVendu = manque.length > 0;'],
    // (5 nov.) « Lie un compte » avant la liste des comptes : plus de mutation, la phrase a été retirée le 3 nov. (voir D4 : absente = conforme).
    ['valeur des annonces NaN', 'src/App.jsx', 'if (Number.isFinite(p0)) { val += p0; valConnus++; }', 'val += p0; valConnus++;'],
    ['charge datée en UTC', 'src/App.jsx', '  const auj = dateLocaleISO();\n  const [dDate, setDDate]', '  const auj = new Date().toISOString().slice(0, 10);\n  const [dDate, setDDate]'],
    ['« Finalisé sur Vinted » : prix illisible = 0 € muet', 'src/App.jsx', "if(st==='completed' && amtLu==null){ prixPasLu++; if(cc) cc.nPrixPasLu++; }", ''],
    ['semaine en zéros sans ventes lues', 'src/App.jsx', 'if (actifsS>0 && nomsVentesKO.length>=actifsS) return (', 'if (false) return ('],
  ];
  let tues = 0;
  for (const [nom, fichier, de, vers] of MUT) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-mut-'));
    for (const d of ['api', 'src', 'scripts']) fs.cpSync(path.join(R, d), path.join(tmp, d), { recursive: true, filter: (s) => !/node_modules|\/fx\//.test(s) });
    try { fs.symlinkSync(path.join(R, 'node_modules'), path.join(tmp, 'node_modules')); } catch (_) {}
    fs.writeFileSync(path.join(tmp, 'package.json'), fs.readFileSync(path.join(R, 'package.json')));
    const f = path.join(tmp, fichier); const txt = fs.readFileSync(f, 'utf8');
    if (!txt.includes(de)) { console.log(`❌ mutation « ${nom} » : le texte à réaffaiblir est introuvable (mettre la mutation à jour)`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(f, txt.replace(de, vers));
    const r = spawnSync('node', [path.join(tmp, 'scripts', 'audit-donnees-ecrans.cjs')], { encoding: 'utf8', env: { ...process.env, VRM_RACINE: tmp } });
    const rouges = ((r.stdout || '').match(/^❌/mg) || []).length;
    console.log(`${rouges ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${rouges ? '' : ' — LA MUTATION SURVIT'}`);
    if (rouges) tues++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${tues}/${MUT.length} mutations tuées`);
  process.exit(tues === MUT.length ? 0 : 1);
}

// ── Sous-processus : la règle de date sous un fuseau donné (§ mois à cheval) ──
if (process.argv[2] === '--fuseau') {
  const ctx = JSON.parse(process.argv[3]);
  const out = {};
  const sb = { Date, Number, String, Math, isFinite };
  vm.createContext(sb);
  vm.runInContext(ctx.src + '\n;this.r = { dateLocaleISO: typeof dateLocaleISO === "function" ? dateLocaleISO : null, cleJourLocal: typeof cleJourLocal === "function" ? cleJourLocal : null };', sb);
  // 1er novembre 2026, 0 h 30 à Paris = 31 octobre 23 h 30 UTC.
  const RealDate = Date;
  const fixe = RealDate.parse('2026-10-31T23:30:00Z');
  class D extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixe); } static now() { return fixe; } }
  sb.Date = D; vm.runInContext('Date = this.Date;', sb);
  try { out.auj = sb.r.dateLocaleISO ? sb.r.dateLocaleISO() : null; } catch (e) { out.auj = 'ERR ' + e.message; }
  try { out.jour = sb.r.cleJourLocal ? sb.r.cleJourLocal(fixe) : null; } catch (e) { out.jour = 'ERR ' + e.message; }
  console.log(JSON.stringify(out));
  process.exit(0);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.message) || e).split('\n')[0]); } };
const imp = async (f) => { try { return await import('file://' + path.join(R, f)); } catch (e) { return { __erreur: e.message }; } };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const APP = require("./_source-app.cjs").sourceApp();
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const APPc = sansCommentaires(APP);
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
// Une fonction d'App.jsx exécutée telle quelle dans un bac à sable.
const charger = (noms, ctx) => {
  vm.createContext(ctx);
  for (const n of noms) { const t = extraire(APP, n); if (!t) continue; try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (_) {} }
  return ctx;
};

(async () => {
  const VR = await imp('api/_lib/ventes-regle.js');
  const VC = await imp('api/_lib/vestiaire-regle.js');
  const SV = await imp('src/statsVentes.js');
  const BS = await imp('api/_lib/bilan-semaine.js');
  const J = 86400000, now = Date.now(), iso = (t) => new Date(t).toISOString();

  // Commandes eBay à la vraie forme (Sell Fulfillment, rangées par l'extension/serveur).
  const ebPaye = { orderId: 'E1', orderPaymentStatus: 'PAID', creationDate: iso(now - 2 * 3600e3), paymentSummary: { totalDueSeller: { value: '100.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '12.00', currency: 'EUR' }, lineItems: [{ sku: 'VRM-12', title: 'Nike Dunk Low 42' }] };
  const ebSansFrais = { orderId: 'E2', orderPaymentStatus: 'PAID', creationDate: iso(now - 3600e3), paymentSummary: { totalDueSeller: { value: '80.00', currency: 'EUR' } }, lineItems: [{ sku: 'VRM-13', title: 'Nike Dunk Low 42' }] };
  const ebDollars = { orderId: 'E3', orderPaymentStatus: 'PAID', creationDate: iso(now - 3600e3), paymentSummary: { totalDueSeller: { value: '50.00', currency: 'USD' } }, totalMarketplaceFee: { value: '5.00', currency: 'USD' }, lineItems: [{ sku: 'VRM-B125' }] };

  console.log('── G1 · Une commande eBay aux frais pas encore lus est VENDUE, et dite');
  await essaie('ventesFaites (serveur)', async () => {
    const r = VR.ventesFaites({ vinted: [], lbc: [], ebay: [ebPaye, ebSansFrais, ebDollars], vestiaire: [] });
    const nc = r.nonComptees || [];
    dit(r.lignes.length === 1 && r.lignes[0].eur === 88, 'la commande lisible compte ce qui est reçu (100 − 12 = 88 €)', JSON.stringify(r.lignes.map((l) => l.eur)));
    dit(nc.filter((x) => x.plateforme === 'eBay').length === 2, 'frais pas lus et dollars : NOMMÉES dans `nonComptees` (le « vendu » dit « au moins »)', JSON.stringify(nc));
    dit(nc.every((x) => x.plateforme !== 'eBay' || (typeof x.ts === 'number' && x.ts > 0)), '… avec leur date de commande (le bon mois, le bon jour)', JSON.stringify(nc));
    dit(r.ecartees === 2, 'le compteur d’écartées reste (Compta)', String(r.ecartees));
    const deux = VR.ventesFaites({ vinted: [], lbc: [], ebay: [ebSansFrais, ebSansFrais], vestiaire: [] });
    dit((deux.nonComptees || []).length === 1, 'la même commande lue deux fois n’est dite qu’une fois', JSON.stringify(deux.nonComptees));
  });
  await essaie('ventesDeclarables (serveur)', async () => {
    const r = VR.ventesDeclarables({ vinted: [], lbc: [], ebay: [ebPaye, ebSansFrais], vestiaire: [], versements: {} });
    const e = (r.ecartees || []).find((x) => x.id === 'ebay:E2');
    dit(!!e && e.manque === true, 'au CA déclaré, elle est `manque` : la carte URSSAF, le widget et Compta disent « au moins »', JSON.stringify(r.ecartees));
  });
  await essaie('bilan de la semaine (serveur)', async () => {
    const lundi = Date.parse(BS.semaineCourante ? '' : '') || 0;
    const debut = now - 6 * J, fin = now + J;
    const b = BS.calculerBilan({ debut, fin, maintenant: now, comptes: [], commandes: {}, masquesTx: new Set(), masquesComptes: new Set(), panneau: {}, lbc: [], ebay: [ebPaye, ebSansFrais], vestiaire: [], versements: {} });
    dit(b.vendu.etat === 'partiel' && b.vendu.manque.some((m) => /eBay/.test(m)), 'le bilan du lundi dit « au moins » et nomme la vente eBay', JSON.stringify(b.vendu));
    void lundi;
  });
  await essaie('la phrase', async () => {
    const t = ['RAISON_NON_COMPTEE', 'phraseNonComptees', 'nonCompteesDe'].map((n) => extraire(APP, n)).join('\n');
    const c = vm.createContext({}); vm.runInContext(t.replace(/^const /mg, 'var ') + '\n;this.p = phraseNonComptees; this.d = nonCompteesDe;', c);
    const r = VR.ventesFaites({ ebay: [ebSansFrais] });
    const ph = c.p(r.nonComptees);
    dit(/1 vente eBay \(frais eBay pas encore lus\)/.test(ph), 'Ma journée et Statistiques la disent en clair', ph);
    dit(c.d(r.nonComptees, now - J).length === 1 && c.d(r.nonComptees, now + J).length === 0, 'elle n’appartient qu’à SA période (`nonCompteesDe`)');
  });

  console.log('\n── Une règle par nombre : le miroir serveur = l’app');
  {
    const norm = (t) => sansCommentaires(t).replace(/^export /, '').replace(/\s+/g, ' ').trim();
    for (const n of ['ventesFaites', 'ventesDeclarables', 'montantRecuEbay', 'commandeEbayEngagee', 'montantCommandeLu']) {
      const a = norm(extraire(APP, n)), s = norm(extraire(lire('api/_lib/ventes-regle.js').replace(/^export /mg, ''), n));
      dit(!!a && a === s, `${n} : identique dans App.jsx et api/_lib/ventes-regle.js`, !a ? 'absent de l’app' : !s ? 'absent du serveur' : 'le code diffère');
    }
  }

  console.log('\n── Vendu ce mois : Ma journée = la coque (widget) = Statistiques');
  await essaie('resumeVendu / venduPeriode', async () => {
    const c = charger(['resumeVendu'], { Date, Math, Number, Object, Array });
    const debutMois = new Date(); debutMois.setHours(0, 0, 0, 0); debutMois.setDate(1);
    const lignes = [
      { plateforme: 'Vinted', ts: debutMois.getTime() + 60e3, eur: 40 },
      { plateforme: 'eBay', ts: now - 3600e3, eur: 88 },
      { plateforme: 'Leboncoin', ts: debutMois.getTime() - 60e3, eur: 999 },   // la veille du 1er, à 23 h 59
    ];
    const r = c.resumeVendu(lignes, now);
    const b = SV.bornesPeriode('mois', now), v = SV.venduPeriode(lignes, b);
    let jn = 0, je = 0; for (const l of lignes) if (l.ts >= debutMois.getTime()) { jn++; je += l.eur; }
    dit(r && r.mois && r.mois.eur === 128 && v.eur === 128 && je === 128 && r.mois.n === v.n && v.n === jn, 'les trois disent 128 € · 2 ventes (minuit LOCAL du 1er)', JSON.stringify({ coque: r && r.mois, stats: v && { n: v.n, eur: v.eur }, journee: { n: jn, eur: je } }));
  });

  console.log('\n── D1 · « Finalisé par plateforme » lit les mêmes règles que le reste');
  await essaie('caParPlateforme', async () => {
    const c = charger(['commandeEbayEngagee', 'montantRecuEbay', 'caEbayPayees', 'etatCaEbay', 'NOTE_CA_EBAY', 'lbcAnnulee', 'lbcFinalisee', 'caVestiaireFinalise', 'caParPlateforme'],
      { Math, Number, String, Array, Object, JSON, isFinite, vcVenteAnnulee: VC.vcVenteAnnulee, etapeMotVc: VC.etapeMotVc, montantRecuVc: VC.montantRecuVc });
    const vcSur = [{ id: 'V1', etat: 'Payout sent', montant: { valeur: 150, devise: 'EUR', cle: 'sellerPayout' } }, { id: 'V2', etat: 'shipped', montant: { valeur: 99, devise: 'EUR', cle: 'sellerPayout' } }, { id: 'V3', etat: 'cancelled', montant: { valeur: 70, devise: 'EUR', cle: 'sellerPayout' } }];
    const vcPasSur = [...vcSur, { id: 'V4', etat: 'completed', montant: { valeur: 80, devise: 'EUR', cle: 'price.amount' } }];
    const lbcV = { ventes: [{ txId: 'L1', isSeller: true, parcelColor: 'finished', price: 4500 }, { txId: 'L2', isSeller: true, parcelColor: 'finished', price: null }] };
    const ligne = (vc, lbc) => { const l = c.caParPlateforme({ caEncaisse: 10 }, lbc || { ventes: [] }, null, [], vc); return { vc: l.find((x) => /Vestiaire/.test(x.nom)), lbc: l.find((x) => x.nom === 'Leboncoin') }; };
    const a = ligne(vcSur);
    dit(a.vc && a.vc.ca === 150, 'Vestiaire : la vente VERSÉE au montant sûr (150 €) ; envoyée pas encore finalisée, annulée hors', JSON.stringify(a.vc));
    const b = ligne(vcPasSur);
    dit(b.vc && b.vc.ca == null && /montant pas sûr/.test(b.vc.note), 'un montant pas sûr ⇒ « — » et la raison, jamais un total partiel', JSON.stringify(b.vc));
    const d = ligne(null);
    dit(d.vc && d.vc.ca == null && /pas lues/.test(d.vc.note), 'Vestiaire illisible ⇒ « pas lues », jamais « pas encore de vente »', JSON.stringify(d.vc));
    const e = ligne([], lbcV);
    dit(e.lbc && e.lbc.ca == null && /prix inconnu/.test(e.lbc.note), 'Leboncoin : un prix inconnu n’est plus 0 € (« — » et dit)', JSON.stringify(e.lbc));
    dit(/<Dashboard [^>]*ventesVc=\{ventesVcCoque\}/.test(APPc), 'la coque passe les ventes Vestiaire aux Statistiques');
  });

  console.log('\n── G2 / D2 · Les dates écrites');
  await essaie('dateJourFr / dateFr', async () => {
    // (11 nov.) dateJourFr garde ses deux formats créés une fois (`let _fmtJourSemaine…`, 9 nov., vitesse)
    const c = charger(['dateJourFr', 'dateFr'], { Date, Number, isFinite, Intl, _fmtJourSemaine: null, _fmtMoisLong: null });
    dit(typeof c.dateJourFr === 'function' && c.dateJourFr(new Date(2026, 10, 1, 9)) === 'dimanche 1er novembre', '« dimanche 1er novembre »', c.dateJourFr ? c.dateJourFr(new Date(2026, 10, 1, 9)) : 'absente');
    dit(typeof c.dateJourFr === 'function' && c.dateJourFr(new Date(2026, 10, 2, 9)) === 'lundi 2 novembre', '« lundi 2 novembre »');
    dit(/const dateStr = dateJourFr\(new Date\(\)\);/.test(APPc), 'Ma journée l’écrit par cette règle');
    dit(typeof c.dateFr === 'function' && c.dateFr('pas une date') === 'date inconnue' && c.dateFr(undefined) === 'date inconnue', 'une date illisible : « date inconnue », jamais « Invalid Date »', c.dateFr ? c.dateFr('x') : 'absente');
    dit(typeof c.dateFr === 'function' && /oct/.test(c.dateFr('2026-10-28T10:00:00Z', { day: 'numeric', month: 'short' })), 'une date lue s’écrit normalement');
    dit(!/new Date\(o\.date\)\.toLocaleDateString\(/.test(APPc.replace(/soldAt: o\.date \? new Date\(o\.date\)\.toLocaleDateString\('fr-FR'\)/g, '')), 'plus aucune date de vente écrite sans garde (hors `soldAt`, stocké, déjà gardé par `o.date ?`)');
  });

  console.log('\n── D6 · Les jours et les mois se comptent à l’heure de PARIS');
  {
    const src = ['cleJourLocal', 'dateLocaleISO'].map((n) => extraire(APP, n)).join('\n').replace(/^const /mg, 'var ');
    const r = spawnSync('node', [__filename, '--fuseau', JSON.stringify({ src })], { encoding: 'utf8', env: { ...process.env, TZ: 'Europe/Paris', VRM_RACINE: R } });
    let o = {}; try { o = JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch (_) {}
    dit(o.auj === '2026-11-01' && o.jour === '2026-11-01', 'le 1er novembre à 0 h 30 (Paris) est le 1er novembre, pas le 31 octobre', JSON.stringify(o));
    dit(/const auj = dateLocaleISO\(\);/.test(APPc), 'Comptabilité : une charge saisie s’y date par défaut (jour local)');
    dit(/const monthKey=dateLocaleISO\(\)\.slice\(0,7\);/.test(APPc), 'le récap mensuel se déclenche au 1er LOCAL');
    dit(!/joursVenteSet\.add\(d\.toISOString/.test(APPc) && /joursVenteSet\.add\(cleJourLocal\(/.test(APPc), '« jours où tu as vendu » au jour local');
    dit(!/const moisEnCours = new Date\(\)\.toISOString\(\)/.test(APPc), 'l’objectif proposé compare les mois au mois local');
  }

  console.log('\n── D3 / D7 · Un prix illisible n’empoisonne aucun total');
  {
    const m = /const annStats = useMemo\(\(\) => \{[\s\S]*?\n {2}\}, \[annBase/.exec(APPc);
    const corps = m ? m[0] : '';
    dit(/Number\.isFinite\(p0\)\) \{ val \+= p0; valConnus\+\+; \}/.test(corps), 'valeur des annonces : seuls les prix lisibles (« NaN € » impossible), et la couverture est comptée');
    dit(/annStats\.valConnus<annStats\.n\?'au moins '/.test(APPc), '… et l’écran dit « au moins » / « prix lu sur N »');
    dit(/const amtLu=montantCommandeLu\(o\), amt0=amtLu==null\?0:amtLu;/.test(APPc) && /if\(st==='completed' && amtLu==null\)(?: prixPasLu\+\+;|\{ prixPasLu\+\+;(?: if\(cc\) cc\.nPrixPasLu\+\+;)? \})/.test(APPc), '« Finalisé sur Vinted » : prix illisible compté à part'); // (5 nov.) a7f1fac4 (5 nov.) le compte aussi par compte : `{ prixPasLu++; if(cc) cc.nPrixPasLu++; }`
    dit(/data-finalise-prix-pas-lu=/.test(APPc) && /setLiveStats\(\{caMois,caEncaisse,prixPasLu,/.test(APPc), '… publié et dit (« au moins »)');
  }

  console.log('\n── D4 / D5 · Pas lu ne vaut pas rien');
  {
    // (3 nov.) la phrase « Lie un compte Vinted » de Ma journée a été retirée à la demande de Julien (textes explicatifs) : absente = conforme ; présente = doit rester gardée.
    dit(!/Lie un compte Vinted \(Paramètres/.test(APPc) || /\{accounts\.length===0 && accountsReady===true && !baseKO/.test(APPc), 'Ma journée : « Lie un compte Vinted » seulement quand la liste des comptes est revenue (base lente ≠ aucun compte)');
    dit(/if \(!ex\.length && \(accountsReady !== true \|\| \(accounts\.length > 0 && sales\.items == null\)\)\) return/.test(APPc), 'Colis : « Aucun colis à envoyer » seulement sur des ventes LUES');
    dit(/if \(actifsS>0 && nomsVentesKO\.length>=actifsS\) return \(/.test(APPc) && /data-semaine-pas-lue=""/.test(APPc), 'la semaine : aucun compte lu ⇒ « ce n’est pas zéro », jamais sept 0');
    dit(/data-semaine-partiel=\{nomsVentesKO\.length\?'1':undefined\}/.test(APPc), 'une partie des comptes lue ⇒ « au moins »');
    dit(/const partielVendu = manque\.length > 0 \|\| ncPeriode\.length > 0;/.test(APPc), 'Statistiques « Vendu » : des ventes de la période au montant pas lu ⇒ « au moins » et le nombre');
  }

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
