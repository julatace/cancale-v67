// ════════════════════════════════════════════════════════════════════════════
//  POINTS 14 ET 15 DE JULIEN (13 nov.) — LE BÉNÉFICE « SI VENDUE » ET LES PAIRES
//  QUI DORMENT, CHACUNE AVEC UN GESTE — EXÉCUTÉ
//
//  Les règles PURES (src/dormantes.js, et `parcoursPaire` de src/fichePaire.js)
//  tournent sur des paires INVENTÉES (dépôt public) :
//    A  `beneficeSiVendue` = LA règle du bénéfice (`beneficePaire`) au centime, sur
//       un balayage ; frais saisis déduits (boost, port payé par lui, emballage) ;
//       frais pas confirmés ⇒ « au plus » ; achat pas saisi ⇒ null (jamais 0) ;
//       prix Vinted { amount } lu ; prix absent ⇒ rien ;
//    B  `gesteDormante` : UN geste, parmi ceux qui existent — baisse proposée d'abord
//       (seulement si `conseilBaisse` en donne une), puis favoris LUS, puis peu vue ⇒
//       Republier, puis Leboncoin s'il n'y est pas et qu'il l'affiche ; un geste bloqué
//       laisse sa place ; « pas lu » ne vaut jamais « peu » ; aucun libellé > 12 mots ;
//    C  `classerDormantes` : ce qui rapporte le plus d'abord ; bénéfice pas su jamais
//       rangé comme un 0 ; 50 paires au même titre restent 50 lignes ;
//    D  la fiche (`parcoursPaire`) : pas vendue ⇒ « si vendue » au prix LU de SON annonce
//       (celle de la fiche) ; deux annonces en ligne à deux prix ⇒ rien deviné ; vendue ⇒
//       pas de « si vendue » ; eBay ⇒ « Reçu » ; `idFiche` pour « Saisir » ;
//    E  l'app : la liste lit ces règles, la fiche reçoit « Saisir », la baisse proposée
//       s'ouvre sans « Varier ».
//  `--prouve` : chaque mutation des règles doit faire rougir au moins un contrôle.
//  `--racine <dir>` : jouer l'audit sur un autre arbre (git archive de la branche de départ).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const iR = process.argv.indexOf('--racine');
const R = iR > 0 ? path.resolve(process.argv[iR + 1]) : path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const { sourceApp } = require(fs.existsSync(path.join(R, 'scripts', '_source-app.cjs')) ? path.join(R, 'scripts', '_source-app.cjs') : './_source-app.cjs');

async function controles(SRC, APP, parler) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (parler) console.log((c ? 'OK  ' : 'KO  ') + m + (d && !c ? ' — ' + d : '')); };
  const charge = async (f) => { try { return await import(pathToFileURL(path.join(SRC, f)).href + '?v=' + Math.random()); } catch (e) { dit(false, `src/${f} se charge`, e.message); return null; } };
  const M = await charge('dormantes.js'), BP = await charge('beneficePaire.js'), FP = await charge('fichePaire.js');
  if (M && BP) {
    const S = (p, e) => { try { return M.beneficeSiVendue(p, e); } catch (e2) { return { etat: 'leve', benefice: null, err: e2.message }; } };
    // A
    const a1 = S('60', { buyPrice: '37' });
    dit(a1.benefice === 2300 && a1.etat === 'partiel' && a1.prix === 6000, 'A1 60 € affichés, achat 37 € ⇒ +23 €, « au plus » (frais pas confirmés)', JSON.stringify(a1));
    const a2 = S('60', { buyPrice: '37', fees: '3', emballage: '1,50', transportVendeur: '2', fraisComplets: true });
    dit(a2.benefice === 1650 && a2.etat === 'ok', 'A2 boost 3 € + emballage 1,50 € + port payé 2 € déduits, frais confirmés ⇒ +16,50 €', JSON.stringify(a2));
    for (const [nom, e] of [['absent', {}], ['vide', { buyPrice: '' }], ['null', { buyPrice: null }]]) {
      const r = S('60', e);
      dit(r.benefice === null && r.etat === 'achat', `A3 achat ${nom} ⇒ « — » (null), jamais 0`, JSON.stringify(r));
    }
    dit(S({ amount: '49.90', currency_code: 'EUR' }, { buyPrice: '20' }).benefice === 2990, 'A4 prix à la forme Vinted { amount: "49.90" } lu ⇒ +29,90 €', JSON.stringify(S({ amount: '49.90' }, { buyPrice: '20' })));
    dit(S(null, { buyPrice: '20' }).etat === 'prix' && S('0', { buyPrice: '20' }).benefice === null, 'A5 prix absent ou nul ⇒ rien');
    dit(S('30', { buyPrice: '37' }).benefice === -700, 'A6 une perte se dit (−7 €), jamais remontée à 0', JSON.stringify(S('30', { buyPrice: '37' })));
    let ecarts = 0, n = 0;
    for (let pc = 150; pc <= 40000; pc += 173) for (const ar of [0.1, 0.45, 0.9, 1.3]) for (const fr of [{}, { fees: '2.5' }, { emballage: '1', fraisComplets: true }, { transportVendeur: '4.2', commission: '1' }]) {
      const prix = (pc / 100).toFixed(2), e = { buyPrice: (pc * ar / 100).toFixed(2), ...fr };
      const b = BP.beneficePaire(prix, e); const s = S(prix, e); n++;
      if (!(s.benefice === Math.round(b.benefice * 100))) ecarts++;
    }
    dit(ecarts === 0 && n > 3000, `A7 ${n} tirages : « si vendue » = la règle du bénéfice (beneficePaire) au centime`, `${ecarts} écarts`);
    dit(M.texteBeneficeSiVendue(a1) === 'au plus +23\u00a0€' && M.texteBeneficeSiVendue(a2) === '+16,50\u00a0€' && M.texteBeneficeSiVendue(S('60', {})) === '', 'A8 le texte : « au plus +23 € », « +16,50 € », rien quand pas su', `${M.texteBeneficeSiVendue(a1)} / ${M.texteBeneficeSiVendue(a2)}`);

    // B
    const ok = () => 'ok';
    const G = (o) => { try { return M.gesteDormante({ cap: ok, version: () => '5.372.0', numero: '12', url: 'https://www.vinted.fr/items/1', ...o }); } catch (e) { return { k: 'leve:' + e.message }; } };
    const b1 = G({ conseil: { sugg: 45, prix: 49.9 }, favoris: 3, vues: 10 });
    dit(b1 && b1.k === 'baisser' && b1.sugg === 45 && /^Baisser à 45\u00a0€$/.test(b1.t), 'B1 une baisse proposée par conseilBaisse ⇒ « Baisser à 45 € »', JSON.stringify(b1));
    dit(G({ conseil: null, favoris: 3, vues: 10 }).k === 'favoris', 'B2 pas de baisse, 3 favoris LUS ⇒ « Offre aux favoris »', JSON.stringify(G({ favoris: 3, vues: 10 })));
    dit(G({ conseil: { sugg: null }, favoris: 0, vues: 10 }).k === 'republier', 'B3 conseil sans prix ⇒ pas de baisse ; 0 favori, 10 vues ⇒ « Republier »');
    dit(G({ favoris: null, vues: null }).k === 'lbc', 'B4 vues et favoris PAS lus ⇒ jamais « peu vue » : « Sur Leboncoin »', JSON.stringify(G({ favoris: null, vues: null })));
    dit(G({ favoris: 0, vues: 300, surLbc: true }).k === 'republier', 'B5 déjà sur Leboncoin, beaucoup vue ⇒ « Republier »');
    dit(G({ favoris: 0, vues: 300, sites: ['vinted'] }).k === 'republier', 'B6 Leboncoin pas affiché (« Mes plateformes ») ⇒ jamais proposé');
    const capFav = (c) => (c === 'favoris' ? 'retard' : 'ok');
    dit(G({ favoris: 3, vues: 10, cap: capFav }).k === 'republier', 'B7 « Offre aux favoris » bloquée (extension) ⇒ le geste suivant', JSON.stringify(G({ favoris: 3, vues: 10, cap: capFav })));
    const tout = G({ favoris: 3, vues: 10, cap: () => 'absente', url: '', numero: '' });
    dit(tout && tout.bloque && tout.k === 'favoris', 'B8 tous bloqués ⇒ le premier, AVEC sa raison (dite au toucher)', JSON.stringify(tout));
    const libs = [b1, G({ favoris: 3 }), G({ favoris: 0, vues: 1 }), G({ favoris: null }), G({ favoris: 0, vues: 300, surLbc: true })].map((g) => g && g.t || '');
    dit(libs.every((t) => t && t.split(/\s+/).length <= 4), 'B9 chaque geste tient en 4 mots au plus', libs.join(' / '));
    dit(!['prix', 'vinted'].includes(G({ favoris: null, vues: null, surLbc: true, sites: ['vinted'] }).k), 'B10 jamais « Baisser le prix » sans proposition mesurée');

    // C
    const L = (id, benefice, prix, age) => ({ id, prix, age, valeur: benefice === undefined ? null : { benefice, etat: benefice == null ? 'achat' : 'partiel' } });
    const c1 = M.classerDormantes([L('a', 500, 50, 40), L('b', null, 90, 40), L('c', 2000, 80, 40), L('d', -500, 20, 40), L('e', null, 120, 35), L('f', 2000, 80, 90)]);
    dit(c1 && c1.map((x) => x.id).join() === 'f,c,a,d,e,b', 'C1 bénéfice connu d’abord (le plus grand ; à égalité le plus ancien), puis pas su par prix', c1 && c1.map((x) => x.id).join());
    dit(c1 && c1.map((x) => x.id).indexOf('e') > c1.map((x) => x.id).indexOf('d'), 'C2 un bénéfice pas su n’est jamais rangé comme un 0 (après la perte connue, pas avant)');
    const cinquante = Array.from({ length: 50 }, (_, i) => ({ id: String(900 + i), titre: 'Nike Dunk Low Panda 42', prix: 70, age: 40, valeur: { benefice: 3000, etat: 'partiel' } }));
    const c3 = M.classerDormantes(cinquante);
    dit(c3 && c3.length === 50 && new Set(c3.map((x) => x.id)).size === 50, 'C3 50 paires au même titre ⇒ 50 lignes, 50 identifiants');
    dit(M.classerDormantes(null) === null, 'C4 pas lu ⇒ null (jamais [])');
  }

  // D — la fiche
  if (FP) {
    const rnDe = (annonces, ventes = {}) => ({ cle: '118', etat: 'present', annonces, ventes: { vinted: [], lbc: [], ebay: [], ...ventes }, manques: [], bordereaux: [] });
    const fiches = { 6118: { numero: '118', buyPrice: '37', title: 'NB 990' }, 6119: { numero: '118', title: 'NB 990' } };
    const P = (rn, d = {}, o = {}) => { try { return FP.parcoursPaire(rn, { fiches, ...d }, o); } catch (e) { return { err: e.message, resume: {} }; } };
    const d1 = P(rnDe([{ id: '6118', price: { amount: '60.0', currency_code: 'EUR' }, etat: 'en-ligne' }]));
    const sv1 = d1.resume.siVendue || {};
    dit(sv1.benefice === 2300 && sv1.prix === 6000 && sv1.etat === 'partiel' && d1.resume.benefice == null, 'D1 pas vendue : « si vendue » +23 € au prix affiché (60 €), aucun « bénéfice »', JSON.stringify(d1.resume));
    const d2 = P(rnDe([{ id: '6118', price: '60', etat: 'en-ligne' }]), { stats: { 6118: { prix: { amount: '55', currency_code: 'EUR' } } } });
    dit((d2.resume.siVendue || {}).prix === 5500, 'D2 le prix LU dans le dressing passe avant celui de la fiche', JSON.stringify(d2.resume.siVendue));
    const d3 = P(rnDe([{ id: '7001', price: '60', etat: 'en-ligne' }, { id: '7002', price: '80', etat: 'en-ligne' }]), { fiches: { 7001: { numero: '118' }, 7002: { numero: '118' } } });
    dit(d3.resume.siVendue && d3.resume.siVendue.benefice == null && d3.resume.siVendue.prix == null && /deux prix/.test(d3.resume.siVendue.raison), 'D3 deux annonces en ligne à deux prix ⇒ rien deviné, la raison dite', JSON.stringify(d3.resume.siVendue));
    const d4 = P(rnDe([{ id: '6119', price: '60', etat: 'en-ligne' }]), { fiches: { 6119: { numero: '118' } } });
    dit(d4.resume.siVendue && d4.resume.siVendue.benefice == null && /prix d.achat pas saisi/.test(d4.resume.siVendue.raison) && d4.idFiche === '6119', 'D4 achat pas saisi ⇒ « — » et « prix d’achat pas saisi », la fiche nommée pour « Saisir »', JSON.stringify([d4.resume.siVendue, d4.idFiche]));
    const vV = { transaction_id: 9, _tx: '9', _item: '6118', price: { amount: '95', currency_code: 'EUR' }, date: '2026-11-01T10:00:00Z' };
    const d5 = P(rnDe([{ id: '6118', price: '60', etat: 'en-ligne' }], { vinted: [vV] }), {}, { etapeVente: () => ({ label: '', step: 4 }) });
    dit(d5.resume.siVendue == null && d5.resume.benefice === 5800, 'D5 vendue (même si le dressing la lit encore en ligne) ⇒ pas de « si vendue », le vrai bénéfice (+58 €)', JSON.stringify(d5.resume));
    const cE = { orderId: 'E1', lineItems: [{ title: 'x' }], creationDate: '2026-11-02T10:00:00Z' };
    const d6 = P(rnDe([], { ebay: [cE] }), {}, { commandeEbayEngagee: () => true, montantRecuEbay: () => ({ eur: 71.4, raison: '' }) });
    dit(d6.resume.venteLib === 'Reçu' && d6.resume.vente === 7140 && d6.resume.siVendue == null, 'D6 eBay : la tuile dit « Reçu » (l’argent reçu, frais eBay déduits)', JSON.stringify(d6.resume));
    const d7 = P({ ...rnDe([{ id: '6118', price: '60', etat: 'en-ligne' }]), manques: ['tes ventes Vinted'] });
    dit(d7.resume.siVendue == null, 'D7 ventes pas lues ⇒ pas de « si vendue » (on ne sait pas si elle est vendue)', JSON.stringify(d7.resume.siVendue));
  }

  // E — l'app (jouée même sans les règles : sur la branche de départ, elle dit ce qui manquait)
  const sans = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  const A = sans(APP);
  dit(/from "\.\/dormantes\.js"/.test(APP) && /classerDormantes\(l\)/.test(A) && /gesteDormante\(\{ conseil/.test(A), 'E1 « Qui dorment » est rangée et reçoit son geste par src/dormantes.js');
  dit(/const conseil = conseilsPrix\.get\(String\(it\.id\)\) \|\| null;/.test(A), 'E2 la baisse proposée vient de la MÊME carte que la fiche et le repricing (`conseilsPrix`)');
  dit(/liste=\{listings\.items==null \? null : listeDormantes\}/.test(A) && /onGeste=\{/.test(A) && /onPrixAchat=\{\(a\)=>saisirPrixAnnonce\(a\.it\)\}/.test(A), 'E3 la vue reçoit la liste, le geste et « Prix d’achat ? » (la saisie existante)');
  dit(/onPrixAchat=\{\(pp\)=>\{ if \(pp && pp\.idFiche\) setAchatFiche/.test(A) && /<FeuillePrixAchat ventes=\{\[achatFiche\]\} onEnregistrer=\{poserPrixAchatVente\}/.test(A), 'E4 la fiche : « Saisir » ouvre « Combien tu l’avais payée ? » sur SA fiche (même écriture que la saisie rapide)');
  dit(/baisseInitiale=\{baisseSelInit\} varierDefaut=\{!baisseSelInit\}/.test(A), 'E5 « Baisser à X € » ouvre la feuille de baisse pré-remplie, sans « Varier » (bornes gardées)');
  dit(/fusionEntreeVente\(e, null, buyByNum\)/.test(A.slice(A.indexOf('const listeDormantes'), A.indexOf('const listeDormantes') + 3000)), 'E6 le prix d’achat de la liste est lu comme partout (`fusionEntreeVente`)');
  return ko;
}

const MUTATIONS = [
  ['dormantes.js', 'favoris avant la baisse', "if (conseil && Number.isFinite(Number(conseil.sugg)) && Number(conseil.sugg) > 0) cand.push(", "if (false) cand.push("],
  ['dormantes.js', 'pas su rangé comme 0', "const b = (l) => (l && l.valeur && Number.isFinite(l.valeur.benefice) ? l.valeur.benefice : null);", "const b = (l) => (l && l.valeur && Number.isFinite(l.valeur.benefice) ? l.valeur.benefice : 0);"],
  ['dormantes.js', 'pas lu = peu vue', 'const v = compteurLu(vues);', 'const v = compteurLu(vues) ?? 0;'],
  ['dormantes.js', 'geste bloqué gardé', 'const g = uniques.find((x) => !x.bloque) || uniques[0] || null;', 'const g = uniques[0] || null;'],
  ['dormantes.js', 'bénéfice sans les frais', "const r = beneficeLigneVente(String(v).replace(',', '.'), entree || {});", "const r = beneficeLigneVente(String(v).replace(',', '.'), { buyPrice: (entree || {}).buyPrice });"],
  ['dormantes.js', 'achat pas saisi = 0', "if (r.benefice == null) return { etat: r.etat, prix: pc, benefice: null };", "if (r.benefice == null) return { etat: r.etat, prix: pc, benefice: pc };"],
  ['dormantes.js', 'Leboncoin même s’il y est', 'if (!surLbc && de(\'lbc\')) cand.push(de(\'lbc\'));', "if (de('lbc')) cand.push(de('lbc'));"],
  ['fichePaire.js', 'deux prix : le premier', "(enL.length > 1 && enL.every((a) => String(prixA(a)) === String(prixA(enL[0]))) ? (enL.find((a) => a.id === idFiche) || enL[0]) : null)", "(enL.length > 1 ? (enL.find((a) => a.id === idFiche) || enL[0]) : null)"],
  ['fichePaire.js', 'prix de la fiche seulement', "return st && st.prix != null && st.prix !== '' ? st.prix : (a ? a.price : null);", "return a ? a.price : null;"],
  ['fichePaire.js', '« si vendue » sur une vendue', 'if (!siteVendu && !ventesInconnues) {', 'if (!ventesInconnues) {'],
  ['fichePaire.js', 'ventes pas lues ignorées', 'if (!siteVendu && !ventesInconnues) {', 'if (!siteVendu) {'],
];

(async () => {
  const SRC = path.join(R, 'src');
  let APP = '';
  try { APP = sourceApp(R); } catch (_) { APP = fs.existsSync(path.join(SRC, 'App.jsx')) ? fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8') : ''; }
  const ko = await controles(SRC, APP, true);
  let koM = 0;
  if (PROUVE && fs.existsSync(path.join(SRC, 'dormantes.js'))) {
    // Une copie des modules (les .js de src/, tels quels) par mutation — un dossier neuf chaque fois :
    // le cache des modules d'une copie ne sert jamais à la suivante. UN fichier muté à la fois.
    for (const [fichier, nom, a, bb] of MUTATIONS) {
      const orig = fs.readFileSync(path.join(SRC, fichier), 'utf8');
      if (!orig.includes(a)) { console.log(`KO  mutation « ${nom} » : texte introuvable`); koM++; continue; }
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dormantes-'));
      fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
      for (const f of fs.readdirSync(SRC)) if (/\.js$/.test(f)) fs.copyFileSync(path.join(SRC, f), path.join(dir, f));
      fs.writeFileSync(path.join(dir, fichier), orig.replace(a, bb));
      const k = await controles(dir, APP, false);
      fs.rmSync(dir, { recursive: true, force: true });
      console.log((k > 0 ? 'OK  ' : 'KO  ') + `mutation « ${nom} » ⇒ ${k} contrôle(s) rouge(s)`);
      if (!k) koM++;
    }
  }
  console.log(ko || koM ? `\n${ko} contrôle(s) rouge(s)${PROUVE ? `, ${koM} mutation(s) non vue(s)` : ''}` : '\nTout est vert.');
  process.exit(ko || koM ? 1 : 0);
})();
