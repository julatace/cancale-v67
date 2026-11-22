#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — RELIER CE QUI EST CHEZ LUI · COLIS NON RETIRÉS · REMBOURSÉ HORS DÉPENSES (21 nov., lot relier-retires)
//        node scripts/audit-relier-retires.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// Julien (21 nov.) : « Quand je veux relier, ça me propose des paires que je n'ai pas retirées. » ; « statistiques des
// colis que je ne suis pas allé chercher » ; « ne compte pas dans les dépenses quand je suis remboursé ».
// EXÉCUTE src/achatChezMoi.js, la règle pondérée RÉELLE (src/liaisonAchat.js), la liste « Choisir un achat »
// (src/suggestionsAchat.js), src/coutAchatNet.js, le registre des achats (src/registres.js) et src/statsTransporteurs.js :
//   C  un achat AU POINT RELAIS (ou en route, payé, pas su) n'est JAMAIS proposé — ni par la règle pondérée, ni dans la
//      liste ; « Je l'ai retiré » (SON toucher) ou le transporteur qui le dit retiré le rend reliable ; la règle de l'app
//      (`isAtRelayStatus`) et celle du module sont le même texte ; l'app publie la règle et la passe à chaque feuille ;
//   D  remboursé (statut, transaction annulée lue, e-mail ≥ payé) ⇒ 0 compté ; PARTIEL ⇒ le reste seul ; pas lu
//      (non réclamé, retour) ⇒ compté et « en attente » DIT, jamais « remboursé » ; le registre et « Dépensé » suivent ;
//   S  colis non retirés : seulement PROUVÉS, la part, l'argent (payé / remboursé / en attente / pas su), le délai sur
//      dates LUES, en cours avec le risque sur la limite LUE (« — » sinon), « pas su » ⇒ null.
// Aucune donnée réelle : tout est inventé ici.
// --prouve : chaque mutation réaffaiblit une règle ⇒ l'audit DOIT rougir.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'au-point-chez': ['src/achatChezMoi.js', "if (auPointRelais(s) || auPointSuivi) return { chez: false, etat: 'au-point' };", "if (auPointRelais(s) || auPointSuivi) return { chez: true, etat: 'livre' };"],
  'en-route-chez': ['src/achatChezMoi.js', "if (RE_ROUTE.test(s)) return { chez: false, etat: 'en-route' };", "if (RE_ROUTE.test(s)) return { chez: true, etat: 'livre' };"],
  'clic-ignore': ['src/achatChezMoi.js', "if (retireClic) return { chez: true, etat: 'retire-clic' };", ''],
  'moteur-sans-chez': ['src/liaisonAchat.js', "  if (!A.chez && !(P.c.curTx && String(P.c.curTx) === A.tx)) return null;\n", ''],
  'liste-sans-chez': ['src/suggestionsAchat.js', "(!libre ? pris : chez ? out : auPoint)", "(!libre ? pris : out)"],
  'publication-ignoree': ['src/achatChezMoi.js', "if (tx && _publie && _publie.has(tx)) return _publie.get(tx);", ''],
  'partiel-tout': ['src/coutAchatNet.js', "return { etat: 'partiel', montant: m, reste: arrondi(p - m), raison: 'email' };", "return { etat: 'aucun', montant: m, reste: p, raison: '' };"],
  'attente-rembourse': ['src/coutAchatNet.js', "return { etat: 'attente', montant: null, reste: p, raison: RE_NON_RECLAME.test(str(e.ss)) ? 'non-reclame' : Number(e.s) === 440 ? 'retour' : 'litige' };", "return { etat: 'rembourse', montant: p, reste: 0, raison: 'annule' };"],
  'txn-annulee-ignoree': ['src/coutAchatNet.js', "  if (e && Number(e.s) >= 500) return { etat: 'rembourse', montant: p, reste: 0, raison: 'annule' };\n", ''],
  'registre-partiel': ['src/registres.js', "if (o._rembPartiel && montant != null", "if (false && o._rembPartiel && montant != null"],
  'fiche-tapee-touchee': ['src/coutAchatNet.js', "if (!e || e.buyPriceSource !== 'recu' || !(_publie instanceof Map)) return brut;", "if (!e || !(_publie instanceof Map)) return brut;"],
  'nr-sans-preuve': ['src/statsTransporteurs.js', 'const NR = F.filter((x) => x.nr);', 'const NR = F.filter((x) => x.nr || x.re);'],
  'risque-devine': ['src/statsTransporteurs.js', 'const reste = x.lim != null ? Math.floor((x.lim - maintenant) / JOUR) : null;', 'const reste = Math.floor(((x.lim ?? ((x.pt ?? maintenant) + 7 * JOUR)) - maintenant) / JOUR);'],
  'depense-brute': ['src/App.jsx', "const depS = lu ? sommeConnue(mois, (o) => coutAchatNet(o, montantCommandeLu)) : null;", "const depS = lu ? sommeConnue(mois, montantCommandeLu) : null;"],
  'grille-sans-regle': ['src/App.jsx', "chezMoiDe={chezMoiDe} onRetire={markPickupDone} prixDe={prixPayeAchat}", "recuDe={(a)=>achatStage(a, trackForBuy(a)).step === 4} prixDe={prixPayeAchat}"],
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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'relier-retires-'));
  process.on('exit', () => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} });
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true, filter: (s) => !/node_modules/.test(s) });
  fs.cpSync(path.join(R, 'api'), path.join(d, 'api'), { recursive: true, filter: (s) => !/node_modules/.test(s) });
  const [f, ...paires] = MUTS[MUT];
  const p = path.join(d, f); let s = fs.readFileSync(p, 'utf8');
  for (let i = 0; i < paires.length; i += 2) { if (!s.includes(paires[i])) { console.log('motif introuvable : ' + MUT + ' ' + i); process.exit(2); } s = s.replace(paires[i], paires[i + 1]); }
  fs.writeFileSync(p, s); SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const APP_BRUT = require('./_source-app.cjs').sourceAppCode(path.join(SRC, '..'));   // (22 nov., intégration) App.jsx + écrans découpés (Comptabilite), code brut
require('./_source-app.cjs').brancher();
const APP = fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8');
const APPs = sansCommentaires(APP);
const bout = (debut, fin) => { const a = APP.indexOf(debut); const b = APP.indexOf(fin, a); if (a < 0 || b < 0) throw new Error('introuvable : ' + debut); return APP.slice(a, b + fin.length); };
const ctx = {};
vm.runInNewContext([bout('const KNOWN_BRANDS=[', '];'), bout('function extractBrand(text){', '\n}'), bout('const COULEURS = {', '\n};'),
  bout('function extractColors(text){', '\n}'), bout('const KNOWN_MODELS = [', '];'), bout('function extractModel(text){', '\n}'), bout('function contientModele(t,k){', '\n}'),
  'this.extractBrand=extractBrand; this.extractColors=extractColors; this.extractModel=extractModel;'].join('\n'), ctx);
const regles = { marqueDe: ctx.extractBrand, couleursDe: ctx.extractColors, modeleDe: ctx.extractModel };
const J = 86400e3, T0 = Date.parse('2026-10-01T10:00:00Z');
const iso = (t) => new Date(t).toISOString();
const FINI = "Transaction finalisée - L'acheteur a validé la commande";
const AU_POINT = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const EN_ROUTE = "Commande expédiée et en cours d'acheminement ! ";
const achat = (tx, title, t, status = FINI, prix = '35.0', extra = {}) => ({ transaction_id: tx, title, date: iso(t), price: { amount: prix, currency_code: 'EUR' }, status, ...extra });

(async () => {
  const imp = (f) => import(require('url').pathToFileURL(path.join(SRC, f)).href);
  let CM, L, S, CN, RG, ST;
  try { CM = await imp('achatChezMoi.js'); L = await imp('liaisonAchat.js'); S = await imp('suggestionsAchat.js'); CN = await imp('coutAchatNet.js'); RG = await imp('registres.js'); ST = await imp('statsTransporteurs.js'); }
  catch (e) { dit(false, 'les modules se chargent (src/achatChezMoi.js, src/coutAchatNet.js…)', e.message); console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(1); }
  const etat = (status, o = {}) => CM.etatChezMoi({ transaction_id: 1, status, ...(o.tus ? { transaction_user_status: o.tus } : {}) }, o).etat;

  // ── C : la règle « chez moi » ──
  dit(etat(FINI) === 'finalise', 'C1 commande finalisée ⇒ chez lui');
  dit(etat(AU_POINT) === 'au-point', 'C2 « colis déposé en … point relais » (l’acheteur n’est pas passé) ⇒ AU POINT, pas chez lui', etat(AU_POINT));
  dit(etat(EN_ROUTE) === 'en-route' && etat('Paiement validé') === 'en-cours' && etat('Bordereau envoyé au vendeur') !== 'finalise' && !CM.etatChezMoi({ transaction_id: 1, status: 'Bordereau envoyé au vendeur' }).chez,
    'C3 en route, payé, bordereau envoyé ⇒ pas chez lui');
  dit(etat(AU_POINT, { retireClic: true }) === 'retire-clic' && etat(AU_POINT, { finiSuivi: true }) === 'retire', 'C4 au point + SON « Je l’ai retiré » (ou le transporteur : retiré) ⇒ chez lui');
  dit(etat(EN_ROUTE, { auPointSuivi: true }) === 'au-point', 'C5 Vinted dit « en route », le transporteur « disponible au point » ⇒ au point');
  dit(etat('Commande livrée ! ') === 'livre' && etat('Terminé') === 'finalise', 'C6 « Commande livrée ! » (après le « Délivré » du transporteur, mesuré) et Leboncoin « Terminé » ⇒ chez lui');
  dit(etat('Remboursement validé') === 'hors' && etat('') === 'pas-su' && !CM.etatChezMoi(null).chez, 'C7 remboursé ⇒ hors relier ; statut vide ⇒ pas su (jamais chez lui)');
  // La règle de l'app (`isAtRelayStatus`) = celle du module, au caractère près.
  const mApp = /^const isAtRelayStatus = (\(s\) => [^\n]*?);$/m.exec(APP);
  const mMod = /^export const auPointRelais = (\(s\) => [^\n]*?);$/m.exec(fs.readFileSync(path.join(SRC, 'achatChezMoi.js'), 'utf8'));
  dit(!!mApp && !!mMod && mApp[1] === mMod[1], 'C8 « au point relais » : la règle de l’app (`isAtRelayStatus`) et src/achatChezMoi.js sont le même texte (§11)');

  // La règle pondérée : la paire PARFAITE est au point relais ⇒ jamais proposée ; « Je l'ai retiré » ⇒ proposée.
  const cible = { key: 'v:9001', titre: 'Adidas Handball Spezial bleu marine taille 42', taille: '42', marque: 'adidas', dateRef: iso(T0 + 20 * J), prix: { amount: '80.0' } };
  const auPoint = achat(1001, 'Adidas handball spezial bleu marine 42', T0, AU_POINT, '30.0');
  const enRoute = achat(1002, 'Adidas handball spezial bleu marine 42', T0 - J, EN_ROUTE, '30.0');
  const voisins = [achat(1003, 'Adidas samba beige 42', T0 - 30 * J), achat(1004, 'Nike Air Force 1 blanc 42', T0 - 10 * J)];
  const tous = (a) => [...L.propositionsArticle({ cible, achats: a, liens: new Map(), ...regles }), ...L.pistesArticle({ cible, achats: a, liens: new Map(), ...regles })].map((p) => String(p.achat.transaction_id));
  CM.publierChezMoi(null);
  const t1 = tous([auPoint, enRoute, ...voisins]);
  dit(!t1.includes('1001') && !t1.includes('1002'), 'C9 la règle pondérée ne propose JAMAIS un achat au point relais ni en route (même la paire parfaite)', t1.join(','));
  CM.publierChezMoi(new Map([['1001', CM.etatChezMoi(auPoint, { retireClic: true })]]));
  const t2 = tous([auPoint, enRoute, ...voisins]);
  dit(t2.includes('1001') && !t2.includes('1002'), 'C10 après SON « Je l’ai retiré » (publié par l’écran) ⇒ proposé ; l’autre reste écarté', t2.join(','));
  CM.publierChezMoi(null);
  // 50 paires identiques au point : aucune n'est proposée, aucune « très probable ».
  const id50 = Array.from({ length: 50 }, (_, i) => achat(2000 + i, 'Adidas handball spezial bleu marine 42', T0 - i * J, AU_POINT, '30.0'));
  dit(tous(id50).length === 0, 'C11 50 achats identiques au point relais ⇒ rien n’est proposé');
  // Déjà relié à CET article (curTx) : reste montré, même au point.
  const curT = L.propositionsArticle({ cible: { ...cible, curTx: '1001' }, achats: [auPoint], liens: new Map(), ...regles }).concat(L.pistesArticle({ cible: { ...cible, curTx: '1001' }, achats: [auPoint], liens: new Map(), ...regles }));
  dit(curT.some((p) => String(p.achat.transaction_id) === '1001'), 'C12 l’achat déjà relié à CET article reste montré (on ne cache pas un lien existant)');
  // La liste « Choisir un achat » (et la grille) : au point ⇒ « Pas encore retirés » ; en route ⇒ compté ; finalisé ⇒ liste.
  const fini = achat(1005, 'Nike Dunk low panda 43', T0 - 5 * J);
  const d = S.tousAchatsLibresDetail({ achats: [auPoint, enRoute, fini], liens: new Map() });
  dit(d.liste.map((a) => String(a.transaction_id)).join() === '1005' && (d.auPoint || []).map((a) => String(a.transaction_id)).join() === '1001' && d.pasChez === 1,
    'C13 « Choisir un achat » : seul le finalisé est reliable ; le colis au point est rangé à part ; l’en-route est compté', JSON.stringify({ l: d.liste.length, p: (d.auPoint || []).length, r: d.pasChez }));
  const sv = S.suggestionsAchat({ cible: { titre: cible.titre, marque: 'adidas', taille: '42', dateRef: cible.dateRef, curTx: '' }, achats: [auPoint], liens: new Map(), ...regles });
  dit(sv.length === 0, 'C14 l’ancienne suggestion (`suggestionsAchat`) ne propose pas non plus un achat au point');
  // L'app : la règle publiée, passée à chaque feuille, le geste « Je l'ai retiré ».
  dit(/publierChezMoi\(m\)/.test(APPs) && /etatChezMoi\(o, \{ retireClic: !!\(pickupDone\[tx\]/.test(APPs) && /finiSuivi: !!\(pickupUnion\.txFinis/.test(APPs),
    'C15 l’écran Achats PUBLIE la règle avec SES preuves (toucher « Je l’ai retiré », retrait prouvé par le suivi)');
  dit(/<LierAchatGrille[\s\S]{0,400}chezMoiDe=\{chezMoiDe\} onRetire=\{markPickupDone\}/.test(APPs) && /<RelierAchatCorps[\s\S]{0,900}chezMoiDe=\{chezMoiDe\} chezMoiCle=\{chezMoiParTx\} onRetire=\{markPickupDone\}/.test(APPs)
    && /recuDe=\{\(a\)=>chezMoiDe\(a\)\.chez\}/.test(APPs), 'C16 « Lier à un achat », « Relier un achat » et « Relier achats et ventes » reçoivent la règle et « Je l’ai retiré »');
  const G = sansCommentaires(fs.readFileSync(path.join(SRC, 'natif/ecrans/LierAchatGrille.jsx'), 'utf8'));
  dit(/data-la-point=/.test(G) && /onRetire\(a\)/.test(G) && /pointOuvert \?/.test(G), 'C17 la grille : « Pas encore retirés · N » replié, « Je l’ai retiré » par achat, rien de reliable dedans');

  // ── D : le coût net ──
  const ach = (status, extra = {}) => ({ transaction_id: 77, status, price: { amount: '40.0' }, ...extra });
  const paye = 40;
  const r = (o, x = {}) => CN.remboursementAchat(o, { paye, ...x });
  dit(r(ach('Remboursement validé')).reste === 0, 'D1 statut « Remboursement validé » ⇒ 0 compté');
  dit(r(ach('Paiement validé'), { txn: () => ({ s: 520, ss: 'Bordereau envoyé au vendeur' }) }).etat === 'rembourse', 'D2 la transaction lue dit ANNULÉE (520) ⇒ remboursé, 0 compté');
  const rembE = (m) => new Map([['77', { montant: m }]]);
  dit(r(ach(FINI), { remb: rembE(40) }).reste === 0, 'D3 e-mail de remboursement ≥ payé ⇒ 0 compté');
  const part = r(ach(FINI), { remb: rembE(15) });
  dit(part.etat === 'partiel' && part.reste === 25, 'D4 remboursement PARTIEL (15 € sur 40) ⇒ seul le reste (25 €) compte', JSON.stringify(part));
  const att = r(ach('Paiement validé'), { txn: () => ({ s: 230, ss: "Commande non réclamée - Retournée à l'expéditeur.rice" }) });
  dit(att.etat === 'attente' && att.reste === 40, 'D5 non réclamé, aucun remboursement lu ⇒ « en attente », COMPTÉ (pas su ≠ remboursé)', JSON.stringify(att));
  dit(r(ach('Paiement validé'), { txn: () => ({ s: 440, ss: '' }) }).etat === 'attente' && r(ach(FINI)).etat === 'aucun', 'D6 retour initié ⇒ en attente ; rien ⇒ rien');
  const L2 = CN.avecRemboursements([ach(FINI, { transaction_id: 1 }), ach(FINI, { transaction_id: 2 }), ach('Paiement validé', { transaction_id: 3 })],
    { remb: new Map([['1', { montant: 40 }], ['2', { montant: 10 }]]), txn: (tx) => (tx === '3' ? { s: 230, ss: 'Commande non réclamée' } : null), montantDe: () => 40 });
  const nets = L2.map((o) => CN.coutAchatNet(o, () => 40));
  dit(nets.join() === '0,30,40', 'D7 la liste des achats : remboursé 0 · partiel 30 · en attente 40 (le coût qui compte)', nets.join());
  dit(RG.achatAnnule(L2[0]) && !RG.achatAnnule(L2[1]) && !RG.achatAnnule(L2[2]), 'D8 le remboursé sort par la règle de « Dépensé » (`achatAnnule`) ; partiel et en attente restent');
  const ea = CN.enAttenteDe(L2, () => 40);
  dit(ea.n === 1 && ea.eur === 40, 'D9 « remboursement en attente » est COMPTÉ à part pour être dit');
  // Le registre des achats : partiel ⇒ la ligne vaut le reste.
  CN.publierRemboursements(L2);
  const pub = CN.avecRemboursementsPublies([{ transaction_id: 1, status: FINI, title: 'a', date: '2026-10-05T10:00:00Z', price: { amount: '40.0', currency_code: 'EUR' } },
    { transaction_id: 2, status: FINI, title: 'b', date: '2026-10-06T10:00:00Z', price: { amount: '40.0', currency_code: 'EUR' } }]);
  const reg = RG.registreDesAchats({ achats: pub, fiches: {}, periode: '2026-10' });
  const mont = reg ? reg.lignes.map((l) => l.montant) : [];
  dit(reg && reg.lignes.length === 1 && mont[0] === 30, 'D10 le registre des achats : le remboursé n’y est plus, le partiel vaut le reste (30 €)', JSON.stringify(mont));
  // Le bénéfice d'une paire : un prix posé DEPUIS LE REÇU d'un achat remboursé ⇒ le reste ; un prix TAPÉ n'est jamais touché.
  dit(CN.coutFicheNet({ buyPriceSource: 'recu', buyPriceRecuTx: '2' }, 40) === 30 && CN.coutFicheNet({ buyFromId: '2' }, 40) === 40 && CN.coutFicheNet({ buyPriceSource: 'recu', buyPriceRecuTx: '1' }, 40) === 0,
    'D11 bénéfice : prix du reçu d’un achat remboursé ⇒ 0 / le reste ; prix TAPÉ par lui ⇒ jamais touché');
  CN.publierRemboursements(null);
  // L'app : « Dépensé » et la publication jour par jour comptent le coût net ; la liste des achats passe par la règle.
  dit(/avecRemboursements\(\(buys\.items \|\| \[\]\)\.filter\(o => !acctOffOf\(o\)\), \{ remb: rembAchatsParTx, txn: etatTxn, montantDe: montantCommandeLu \}\)/.test(APPs)
    && /const depS = lu \? sommeConnue\(mois, \(o\) => coutAchatNet\(o, montantCommandeLu\)\) : null;/.test(APPs) && /j\[1\] \+= Math\.round\(\(coutAchatNet\(o, montantCommande\) \|\| 0\) \* 100\)/.test(APPs)
    && /'Dépensé', texteSomme\(sommeConnue\(vrais, \(o\)=>coutAchatNet\(o, M\)\)/.test(APPs),
    'D12 Achats « Dépensé du mois », la case « Dépensé » et `vrm_achats_jours` comptent le coût NET (une règle : src/coutAchatNet.js)');
  dit(/tr\('rr\.rembAttente'/.test(APP_BRUT), 'D13 « remboursement en attente » est DIT à côté de « Dépensé »');

  // ── S : colis non retirés ──
  const NOW = Date.parse('2026-11-21T12:00:00Z');
  const lgn = (o) => ST.ligneNonRetire({ t: 'mondialrelay', nom: 'Mondial Relay', payeAt: NOW - 20 * J, prix: 30, ...o });
  const A = [
    lgn({ nonReclame: true, pointAt: NOW - 15 * J, limiteAt: NOW - 7 * J, point: 'Relais A', remb: { etat: 'rembourse', montant: 30 } }),
    lgn({ nonReclame: true, pointAt: NOW - 14 * J, limiteAt: NOW - 6 * J, point: 'Relais A', remb: { etat: 'attente' } }),
    lgn({ nonReclame: true, pointAt: NOW - 13 * J, limiteAt: NOW - 5 * J, point: 'Relais B', prix: null, remb: null, t: 'chronopost', nom: 'Chronopost' }),
    lgn({ remb: { etat: 'attente' } }),                                   // retour d'un autre genre : PAS un non-réclamé
    lgn({}), lgn({}), lgn({}),
    lgn({ auPoint: true, pointAt: NOW - 6 * J, limiteAt: NOW - 1 * J }), // au point, limite passée
    lgn({ auPoint: true, pointAt: NOW - 2 * J, limiteAt: NOW + 0.5 * J }),
    lgn({ auPoint: true, pointAt: NOW - 1 * J }),                       // limite pas lue
  ];
  const X = ST.statsNonRetires({ achats: A, de: NOW - 30 * J, a: NOW + J, maintenant: NOW });
  dit(X.n === 3 && X.total === 10 && X.part === 30, 'S1 non retirés : seulement les PROUVÉS (3 sur 10, 30 %)', JSON.stringify({ n: X.n, t: X.total, p: X.part }));
  dit(X.argent.paye.c === 6000 && X.argent.paye.connus === 2 && X.argent.paye.sur === 3, 'S2 prix payé : 60 € « lu pour 2 sur 3 » (un prix pas lu n’est pas 0)', JSON.stringify(X.argent.paye));
  dit(X.argent.rembourse.c === 3000 && X.argent.rembourse.n === 1 && X.argent.attente.n === 1 && X.argent.pasSu === 1, 'S3 remboursé lu 30 € · 1 en attente · 1 pas su', JSON.stringify(X.argent));
  dit(X.transporteurs.length === 2 && X.transporteurs[0].cle === 'mondialrelay' && X.transporteurs[0].n === 2 && X.points[0].nom === 'Relais A' && X.points[0].n === 2, 'S4 par transporteur et par point relais');
  dit(X.garde.jours === 8 && X.garde.n === 3, 'S5 le délai qu’il avait (arrivée → limite LUES) : 8 j', JSON.stringify(X.garde));
  const risques = X.enCours.map((x) => x.risque);
  dit(X.enCours.length === 3 && risques[0] === 'depasse' && risques[1] === 'proche' && risques[2] === null && X.enCours[2].reste === null,
    'S6 au point en ce moment : « limite passée », « bientôt », et « — » quand la limite n’est pas lue (jamais devinée)', JSON.stringify(X.enCours.map((x) => [x.risque, x.reste, x.depuis])));
  dit(ST.statsNonRetires({ achats: null }) === null && ST.statsNonRetires({ achats: A, maintenant: NOW }).total === 10, 'S7 pas publié ⇒ null (« — »), jamais 0 ; « Tout » prend tous ses achats');
  dit(/save\(CLE_PUB_NON_RETIRES,/.test(APPs) && /some\(\(u\) => !acctOff\(u\)\)/.test(APPs), 'S8 l’écran Achats publie TOUS ses achats lus ; un compte pas relu ⇒ rien n’est écrit');

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
