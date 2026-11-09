require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// ⚠️⚠️ VESTIAIRE PARTOUT — L'ANTI DOUBLE VENTE, L'ARGENT ET LES COLIS (1er novembre)
//
// Julien : « fais tout comme un pro, il ne doit y avoir aucune erreur
// possible ». L'audit des parcours du 1er novembre (A1, A2, A4, A6, A10) :
//   A1  une vente Vestiaire ne disait « à retirer » nulle part ailleurs, ne
//       sortait pas la paire du Stock ; une vente ailleurs ne disait jamais « à
//       retirer de Vestiaire » ;
//   A2  « toutes plateformes » (CA, URSSAF, vendu, bénéfice, plafonds) sans
//       Vestiaire, sans le dire — un total partiel présenté comme complet (§5) ;
//   A4  les colis Leboncoin et Vestiaire à poster comptés dans Colis seulement ;
//   A6  « Vendus ailleurs » comparait les N° sans `cleNum` (« 007 » ≠ « 7 ») ;
//   A10 une vente Vinted au prix illisible comptait 0 € sans être dite.
//
// Ce contrôle EXÉCUTE les vraies règles (§6) : les modules partagés
// (api/_lib/vestiaire-regle.js, colis-sites.js, double-vente.js,
// bilan-semaine.js, ventes-regle.js — le miroir d'App.jsx jugé identique par
// audit-bilan-semaine.cjs —, urssaf-regle.js, widget.js), src/bilanSynchronisation.js,
// src/microEntreprise.js, et les fonctions d'App.jsx extraites telles quelles
// (`numerosDejaVendus`, `numerosVendusVc`). Il juge ce qu'elles RENDENT, jamais
// une orthographe (§6.4) ; quelques contrôles de BRANCHEMENT vérifient, sur le
// code sans ses commentaires, que l'écran appelle bien la règle.
//
//   node scripts/audit-vestiaire-partout.cjs              → le contrôle
//   node scripts/audit-vestiaire-partout.cjs --mutations  → chaque règle
//        réaffaiblie dans une copie : le contrôle doit passer au ROUGE (§6.1).
// Aucune donnée réelle : tout est inventé ici.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');

// ── --mutations : chaque mutation dans une copie, elle doit rendre du rouge ──
if (process.argv.includes('--mutations')) {
  const MUT = [
    ['montant Vestiaire compté sans que la clé dise « versé »', 'api/_lib/vestiaire-regle.js', "if (!CLE_RECU_VC.test(String(m.cle || ''))) return { eur: null, raison: 'montant pas sûr' };", ''],
    ['vente Vestiaire annulée comptée', 'api/_lib/vestiaire-regle.js', "export const vcVenteAnnulee = (v) => !!v && v.aExpedier !== true && etapeMotVc(v) === 'annulee';", 'export const vcVenteAnnulee = () => false;'],
    ['identité Vestiaire par le titre', 'api/_lib/vestiaire-regle.js', "export const numVcVente = (v, liens) => cleNum((v && v.productId && objet(liens) && liens[v.productId]) || (v && v.ref) || '');", "export const numVcVente = (v, liens) => cleNum((v && v.productId && objet(liens) && liens[v.productId]) || (v && v.ref) || (v && v.titre && (globalThis.__parTitre || {})[v.titre]) || '');"],
    ['prix Vinted illisible compté 0 €', 'api/_lib/ventes-regle.js', "  if (p == null) return null;\n  const v = (typeof p === 'object') ? (p.amount ?? p.value) : p;\n  if (v == null || String(v).trim() === '') return null;", "  if (p == null) return 0;\n  const v = (typeof p === 'object') ? (p.amount ?? p.value) : p;\n  if (v == null || String(v).trim() === '') return 0;"],
    ['colis Leboncoin « fait » encore compté', 'api/_lib/colis-sites.js', '!(o.txId != null && (objet(fait) || {})[o.txId])', 'true'],
    ['annonce Vestiaire d’une lecture périmée dite en ligne', 'api/_lib/vestiaire-regle.js', '  if (vieille) return { parNum: out, vieille: true, lue: true };\n', ''],
    ['« Vendus ailleurs » sans cleNum', 'src/bilanSynchronisation.js', '      const n = cleNum(e.numero);', '      const n = String(e.numero).trim().toLowerCase();'],
    ['date limite Vestiaire jamais en retard', 'api/_lib/vestiaire-regle.js', 'if (x.jours < 0) overdue++;', 'if (x.jours < 0) today++;'],
    ['Vestiaire hors du verdict « déjà vendue »', 'src/App.jsx', "if (k) pose(k, 'Vestiaire'); else vcSansPaire++;", 'vcSansPaire++;'],
  ];
  let tues = 0;
  for (const [nom, fichier, de, vers] of MUT) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-mut-'));
    for (const d of ['api', 'src', 'scripts']) fs.cpSync(path.join(R, d), path.join(tmp, d), { recursive: true, filter: (s) => !/node_modules|\/fx\//.test(s) });
    try { fs.symlinkSync(path.join(R, 'node_modules'), path.join(tmp, 'node_modules')); } catch (_) {}
    const f = path.join(tmp, fichier); const txt = fs.readFileSync(f, 'utf8');
    if (!txt.includes(de)) { console.log(`❌ mutation « ${nom} » : le texte à réaffaiblir est introuvable (la règle a changé : mettre la mutation à jour)`); continue; }
    fs.writeFileSync(f, txt.replace(de, vers));
    const r = spawnSync('node', [path.join(tmp, 'scripts', 'audit-vestiaire-partout.cjs')], { encoding: 'utf8', env: { ...process.env, VRM_RACINE: tmp } });
    const rouges = ((r.stdout || '').match(/^❌/mg) || []).length;
    console.log(`${rouges ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${rouges ? '' : ' — LA MUTATION SURVIT : le contrôle ne protège rien'}`);
    if (rouges) tues++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${tues}/${MUT.length} mutations tuées`);
  process.exit(tues === MUT.length ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.message) || e).split('\n')[0]); } };
const imp = async (f) => { try { return await import('file://' + path.join(R, f)); } catch (e) { return { __erreur: e.message }; } };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const APP = require("./_source-app.cjs").sourceApp();
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const APPc = sansCommentaires(APP);
// Une déclaration de haut niveau d'App.jsx, jusqu'à sa fin réelle.
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

(async () => {
  const VC = await imp('api/_lib/vestiaire-regle.js');
  const CS = await imp('api/_lib/colis-sites.js');
  const DV = await imp('api/_lib/double-vente.js');
  const VR = await imp('api/_lib/ventes-regle.js');
  const UR = await imp('api/_lib/urssaf-regle.js');
  const BS = await imp('api/_lib/bilan-semaine.js');
  const NUM = await imp('api/_lib/numerotation.js');
  const BSync = await imp('src/bilanSynchronisation.js');
  const ME = await imp('src/microEntreprise.js');
  const W = await imp('api/widget.js');
  const J = 86400000, now = Date.now(), iso = (t) => new Date(t).toISOString();

  // Les données : la FORME rangée par l'extension (background.js `rangerVcVentes`,
  // `rangerVcAnnonces`) — `vc_ventes.ventes` objet clé = id ; `vc_listings.liens`
  // = { id Vestiaire : N° } posé quand VRM crée l'annonce.
  const liens = { P12: '12', P30: '30' };
  const ventesVcBrutes = {
    V1: { productId: 'P12', etat: 'shipped', date: iso(now - 2 * J), montant: { valeur: 150, devise: 'EUR', cle: 'price.amount' } },   // identité par le lien VRM
    V2: { productId: 'PX', ref: 'B7', etat: 'cancelled', date: iso(now - J), montant: { valeur: 80, devise: 'EUR', cle: 'sellerPayout' } }, // annulée
    V3: { productId: 'PY', ref: '', etat: 'shipped', titre: 'Nike Air Max 90 blanc 42', date: iso(now - J) },                          // AUCUNE identité
    V4: { productId: 'PZ', ref: '40', aExpedier: true, limite: iso(now - J), date: iso(now - 3 * J), montant: { valeur: 95.5, devise: 'EUR', cle: 'sellerPayout.amount' } }, // à poster, limite passée
  };

  console.log('── A1 · L’identité d’une vente Vestiaire (jamais le titre, §5)');
  await essaie('ventesVcDe', async () => {
    const l = VC.ventesVcDe({ ventes: ventesVcBrutes, liens });
    const par = Object.fromEntries(l.map((v) => [v.id, v.num]));
    dit(par.V1 === '12' && par.V4 === '40' && par.V2 === 'B7', 'le N° vient du lien posé par VRM, sinon de la référence VRM-n° de l’article', JSON.stringify(par));
    // LES 50 PAIRES IDENTIQUES : une vente sans identité, au titre exact d'une paire, ne désigne RIEN.
    globalThis.__parTitre = { 'Nike Air Max 90 blanc 42': '17' };
    const l2 = VC.ventesVcDe({ ventes: ventesVcBrutes, liens });
    dit((l2.find((v) => v.id === 'V3') || {}).num === '', '50 paires identiques : une vente Vestiaire sans référence n’est reliée à aucune (pas par le titre)', JSON.stringify((l2.find((v) => v.id === 'V3') || {}).num));
    dit(VC.ventesVcDe(null) === null && VC.ventesVcDe(undefined) === undefined && Array.isArray(VC.ventesVcDe({ ventes: null })), 'trois états : pas su ⇒ null, en cours ⇒ undefined, aucune ligne ⇒ []');
  });

  console.log('\n── A1 · « Déjà vendue » (toutes plateformes) compte Vestiaire');
  await essaie('numerosDejaVendus', async () => {
    const src = ['numerosDejaVendus', 'numerosVendusVc'].map((n) => extraire(APP, n)).join('\n');
    const ctx = { cleNum: NUM.cleNum, commandeEbayEngagee: () => false, numLigneEbay: () => '', lbcAnnulee: () => false, clesAnnonceLbc: () => [], vcVenteAnnulee: VC.vcVenteAnnulee };
    vm.createContext(ctx);
    vm.runInContext(src + '\n;this.ndv = numerosDejaVendus; this.nvv = typeof numerosVendusVc === "function" ? numerosVendusVc : null;', ctx);
    const fiches = {}; for (let i = 1; i <= 50; i++) fiches['a' + i] = { numero: String(i), title: 'Nike Air Max 90 blanc 42' };
    const lv = VC.ventesVcDe({ ventes: ventesVcBrutes, liens });
    const r = ctx.ndv({ numeros: fiches, enLigne: new Set(), vendusVinted: new Set(), commandes: [], ventesLbc: {}, itemsLbc: {}, liensLbc: {}, ventesVc: lv });
    dit(r.vendus.get('12') === 'Vestiaire' && r.vendus.get('40') === 'Vestiaire', 'une vente Vestiaire reliée fait « déjà vendue » sa paire (N°12, N°40) — elle n’est plus reproposée, eBay dit « à retirer »', JSON.stringify([...r.vendus]));
    dit(!r.vendus.has('B7') && !r.vendus.has('7'), 'une vente Vestiaire ANNULÉE ne vend rien');
    dit(r.vcSansPaire === 1 && [...r.vendus.keys()].filter((k) => r.vendus.get(k) === 'Vestiaire').length === 2, 'la vente sans identité n’est rapprochée d’AUCUNE des 50 paires identiques, et elle est comptée pour être dite', `sans paire ${r.vcSansPaire}`);
    const p = ctx.ndv({ numeros: fiches, enLigne: new Set(), vendusVinted: new Set(), commandes: [], ventesLbc: {}, itemsLbc: {}, liensLbc: {}, ventesVc: null });
    dit(p.pasSu.some((x) => /Vestiaire/.test(x)), 'Vestiaire illisible ⇒ « pas su » nommé (le planificateur ne conclut pas « pas vendue »)', JSON.stringify(p.pasSu));
    const s = ctx.nvv ? ctx.nvv(lv) : null;
    dit(!!s && s.has('12') && s.has('40') && !s.has('B7') && ctx.nvv(null) === null, 'les N° vendus sur Vestiaire (à retirer de Leboncoin) : par identité, annulée exclue, pas su ⇒ null');
  });

  console.log('\n── A1/A6 · « Vendus ailleurs · annonces à retirer », dans les deux sens');
  await essaie('retraitsVestiaire + articlesVendusAilleurs', async () => {
    const lst = { capturedAt: iso(now - 3600e3), liens, items: {
      P12: { statut: 'on_sale', vuAt: iso(now - 3600e3), titre: 'Paire 12' },       // la paire vendue SUR Vestiaire (V1) : « vendue », pas à retirer
      P30: { statut: 'on_sale', vuAt: iso(now - 3600e3), titre: 'Paire 30' },       // vendue sur Vinted, encore en ligne ici
      PQ: { statut: 'on_sale', vuAt: iso(now - 3600e3), titre: 'Nike Air Max 90 blanc 42' }, // sans identité : jamais rapprochée
    } };
    const rv = VC.retraitsVestiaire({ lst, ventes: ventesVcBrutes, maintenant: now });
    const numeros = { v12: { numero: '12' }, v30: { numero: '30' }, v40: { numero: '40' }, v7: { numero: '007' } };
    const annonces = [
      ...rv.annonces,
      { id: 'v12', numero: '12', plateforme: 'Vinted', compte: 'A', active: true },
      { id: 'v40', numero: '40', plateforme: 'Vinted', compte: 'A', active: true },
      { id: 'v7', numero: '007', plateforme: 'Vinted', compte: 'A', active: true },
    ];
    const ventes = [...rv.ventes, { id: 'v30', numero: '30', plateforme: 'Vinted', engagee: true }, { id: 'L1', numero: '7', plateforme: 'Leboncoin', engagee: true }];
    const out = BSync.articlesVendusAilleurs({ numeros, ventes, annonces });
    const cles = out.lignes.map((l) => `${l.plateforme}:${l.id}`).sort();
    dit(cles.includes('Vinted:v12') && cles.includes('Vinted:v40'), 'vendue sur Vestiaire ⇒ son annonce Vinted (et toute autre) est « à retirer »', JSON.stringify(cles));
    dit(cles.includes('Vestiaire:P30'), 'vendue sur Vinted ⇒ « à retirer de Vestiaire » (annonce prouvée en ligne, par le lien VRM)', JSON.stringify(cles));
    dit(!cles.includes('Vestiaire:P12') && !cles.includes('Vestiaire:PQ'), 'ni l’annonce vendue sur Vestiaire même, ni une annonce sans identité');
    dit(cles.includes('Vinted:v7'), 'A6 · « 007 » saisi à la main et « VRM-7 » de Leboncoin désignent la même paire (`cleNum`)', JSON.stringify(cles));
    dit(rv.manques.some((m) => /1 vente Vestiaire sans référence/.test(m)), 'la vente Vestiaire sans identité est NOMMÉE dans « vérification partielle »', JSON.stringify(rv.manques));
    const vieux = VC.retraitsVestiaire({ lst: { ...lst, capturedAt: iso(now - 3 * J) }, ventes: {}, maintenant: now });
    dit(vieux.annonces.every((a) => a.active !== true) && vieux.manques.some((m) => /24 h/.test(m)), 'une lecture Vestiaire de plus de 24 h ne prouve pas « en ligne » : non confirmé, et dit', JSON.stringify(vieux.manques));
  });

  console.log('\n── A1 · Le Stock : une vente Vestiaire partie libère sa place');
  await essaie('stockVestiaire', async () => {
    const s = VC.stockVestiaire(VC.ventesVcDe({ ventes: { ...ventesVcBrutes, V5: { ref: '55', etat: 'paid' } }, liens }));
    dit(s.sorties.map((x) => x.cle).join() === '12' && s.aPoster.has('40'), 'partie (le mot de Vestiaire le prouve) ⇒ sort du Stock ; à expédier ⇒ reste ; annulée, « paid » seul, sans identité ⇒ rien', JSON.stringify({ sorties: s.sorties.map((x) => x.cle), aPoster: [...s.aPoster] }));
    dit(VC.stockVestiaire(null).sorties.length === 0, 'Vestiaire pas lu ⇒ rien ne sort');
  });

  console.log('\n── A1 · Le serveur (app fermée) : vendue sur Vinted, encore en ligne sur Vestiaire');
  await essaie('double-vente serveur', async () => {
    const lst = { capturedAt: iso(now - 3600e3), liens, items: { P30: { statut: 'on_sale', vuAt: iso(now - 3600e3), titre: 'Paire 30' } } };
    const vc = DV.annoncesVcEnLigne(lst, {}).parNum;
    const hits = DV.doubleVenteApprise('30', null, null, vc);
    const n = DV.notificationDoubleVente(hits, 'Air Max');
    dit(hits.length === 1 && hits[0].plateforme === 'vestiaire' && n && /Vestiaire/.test(n.title) && /site=vestiaire/.test(n.url), 'la vente Vinted de la N°30 pousse « encore en vente sur Vestiaire », vers l’écran Vestiaire', n ? n.title + ' · ' + n.url : 'aucune');
    const vieux = DV.annoncesVcEnLigne({ ...lst, capturedAt: iso(now - 2 * J) }, {}).parNum;
    dit(DV.doubleVenteApprise('30', null, null, vieux).length === 0, 'lecture Vestiaire périmée (> 24 h) ⇒ le serveur ne dit RIEN (une notification se reçoit sans contexte)');
  });

  console.log('\n── A10 · Vinted seul (sans aucune règle Vestiaire) : un prix illisible n’est pas 0 €');
  await essaie('A10 Vinted seul', async () => {
    const v = [{ transaction_id: 9, status: 'Commande finalisée', date: iso(now - J), price: { amount: '' }, _acc: { vinted_user_id: '1' } }];
    const vf = VR.ventesFaites({ vinted: v });
    dit(vf.lignes.length === 0 && (vf.nonComptees || []).length === 1, 'vendu : la vente au prix vide n’est pas une ligne à 0 €, elle est mise à part', JSON.stringify({ lignes: vf.lignes, nc: vf.nonComptees }));
    const vd = VR.ventesDeclarables({ vinted: v, versements: { 9: iso(now) } });
    dit(vd.lignes.length === 0 && vd.ecartees.length === 1 && vd.ecartees[0].manque === true, 'CA déclaré : écartée et marquée manque', JSON.stringify(vd));
  });
  console.log('\n── A6 · « Vendus ailleurs » sans aucune règle Vestiaire : « 007 » = « 7 »');
  await essaie('A6 seul', async () => {
    const out = BSync.articlesVendusAilleurs({ numeros: { v7: { numero: '007' }, b: { numero: 'B 125' } },
      annonces: [{ id: 'v7', numero: '007', plateforme: 'Vinted', compte: 'A', active: true }, { id: 'b', numero: 'B 125', plateforme: 'Vinted', compte: 'A', active: true }],
      ventes: [{ id: 'L1', numero: '7', plateforme: 'Leboncoin', engagee: true }, { id: 'E1', numero: 'B125', plateforme: 'eBay', engagee: true }] });
    dit(out.lignes.length === 2, 'les deux annonces Vinted sont « à retirer » (le N° comparé par `cleNum`)', JSON.stringify(out.lignes.map((l) => l.id)));
  });

  console.log('\n── A2/A10 · L’argent : compté s’il est SÛR, NOMMÉ sinon');
  await essaie('ventesFaites / ventesDeclarables', async () => {
    const vinted = [
      { transaction_id: 1, status: 'Commande finalisée', date: iso(now - 2 * J), price: { amount: '40' }, _acc: { vinted_user_id: '1' } },
      { transaction_id: 2, status: 'Commande finalisée', date: iso(now - 2 * J), price: null, _acc: { vinted_user_id: '1' } },
    ];
    const versements = { 1: iso(now - J), 2: iso(now - J) };
    const vestiaire = VC.ventesVcDe({ ventes: { ...ventesVcBrutes, V6: { ref: '61', etat: 'payout_done', date: iso(now - 3 * J), verseLe: iso(now - J), montant: { valeur: 70, devise: 'EUR', cle: 'sellerPayout' } } }, liens });
    const vf = VR.ventesFaites({ vinted, vestiaire });
    const eurV = vf.lignes.filter((l) => l.plateforme === 'Vinted').map((l) => l.eur);
    dit(eurV.length === 1 && eurV[0] === 40 && (vf.nonComptees || []).some((x) => x.plateforme === 'Vinted' && x.raison === 'prix pas lu'), 'A10 · une vente Vinted au prix illisible n’est jamais 0 € dans « vendu » : mise à part et dite', JSON.stringify({ eurV, nc: vf.nonComptees }));
    const vcL = vf.lignes.filter((l) => l.plateforme === 'Vestiaire');
    dit(vcL.length === 2 && vcL.some((l) => l.eur === 95.5) && vcL.some((l) => l.eur === 70), 'Vestiaire au montant SÛR (la clé dit « ce que tu reçois », en euros) compte dans « vendu »', JSON.stringify(vcL));
    const ncVc = (vf.nonComptees || []).filter((x) => x.plateforme === 'Vestiaire');
    dit(ncVc.length === 2 && ncVc.some((x) => x.raison === 'montant pas sûr') && !vf.lignes.some((l) => l.eur === 150), 'Vestiaire au montant pas sûr (« price ») : hors du total, NOMMÉ ; l’annulée nulle part', JSON.stringify(ncVc));
    const vd = VR.ventesDeclarables({ vinted, vestiaire, versements });
    dit(!vd.lignes.some((l) => l.plateforme === 'Vinted' && l.eur === 0) && vd.ecartees.some((x) => x.plateforme === 'Vinted' && x.manque && x.raison === 'prix pas lu'), 'A10 · le CA déclaré : la vente au prix illisible est écartée ET marquée manque (jamais 0 €)', JSON.stringify(vd.ecartees));
    dit(vd.lignes.some((l) => l.plateforme === 'Vestiaire' && l.eur === 70) && vd.ecartees.filter((x) => x.plateforme === 'Vestiaire' && x.manque).length === 2, 'Vestiaire dans le CA déclaré : versée, au montant sûr ⇒ comptée au mois du versement ; montant pas sûr ⇒ écartée et NOMMÉE', JSON.stringify(vd.ecartees.map((x) => x.plateforme + ':' + x.raison)));
  });

  console.log('\n── A2 · Chaque lecteur d’un total « toutes plateformes » dit « au moins »');
  await essaie('publication lue', async () => {
    const ym = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }).slice(0, 7);
    const pub = { mois: [{ ym, n: 1, ca: 40 }], aDater: { n: 0, ca: 0, par: {} }, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'lu' }, recu: { [ym]: 40 }, nonComptees: { n: 2, par: { 'Vestiaire|montant pas sûr': 2 } }, at: now };
    const r = W.recuDuMoisPublie(pub, ym, now);
    dit(r.received === null && r.receivedAuMoins === 40 && (r.receivedManque || []).includes('Vestiaire'), 'le widget : « reçu ce mois » devient un minimum, Vestiaire nommé', JSON.stringify(r));
    const a = ME.caAnnee(pub, Number(ym.slice(0, 4)));
    dit(a && a.partiel && a.raisons.some((x) => /Vestiaire/.test(x)), 'les seuils (TVA, plafond micro) : le CA de l’année est un minimum, dit', JSON.stringify(a && a.raisons));
    const due = UR.nextUrssafDeadline('mensuel', new Date(now));
    const yms = UR.moisPeriodeUrssaf(due);
    const pubP = { ...pub, mois: [{ ym: yms[0], n: 1, ca: 40 }], at: now + 60 * J };
    const m = UR.montantPeriodeUrssaf(due, pubP, 12.4), m0 = UR.montantPeriodeUrssaf(due, { ...pubP, nonComptees: { n: 0, par: {} } }, 12.4);
    dit(m.partiel === true && m0.partiel === false, 'le rappel URSSAF (Ma journée, notification du 1er) : le montant de l’échéance est un minimum', JSON.stringify(m));
    const b = BS.calculerBilan({ comptes: [], commandes: {}, masquesTx: new Set(), masquesComptes: new Set(), panneau: {}, lbc: [], ebay: [],
      vestiaire: VC.ventesVcDe({ ventes: { V1: ventesVcBrutes.V1 }, liens }), versements: {}, debut: now - 7 * J, fin: now });
    dit(b.vendu.etat === 'partiel' && b.vendu.manque.some((x) => /Vestiaire/.test(x)), 'le bilan de la semaine : « au moins », la vente Vestiaire au montant pas sûr nommée', JSON.stringify(b.vendu));
  });

  console.log('\n── A4 · Les colis Leboncoin et Vestiaire à poster : la règle de Colis, pour tous');
  await essaie('colis-sites', async () => {
    const lbc = {
      T1: { txId: 'T1', isSeller: true, title: 'A', stepLabel: 'Paiement reçu' },                                   // à poster
      T2: { txId: 'T2', isSeller: true, title: 'B', stepLabel: 'Paiement reçu' },                                   // coché « Colis fait »
      T3: { txId: 'T3', isSeller: true, title: 'C', parcelStatus: 'in_transit' },                                   // parti
      T4: { txId: 'T4', isSeller: false, title: 'D' },                                                              // un achat
      T5: { txId: 'T5', isSeller: true, title: 'E', stepStatus: 'cancelled' },                                      // annulée
    };
    const l = CS.colisLbcAPoster(lbc, { T2: 1 });
    dit(Array.isArray(l) && l.map((x) => x.txId).join() === 'T1', 'Leboncoin : vendeur prouvé, ni annulé, ni parti, ni coché « fait » — et jamais un achat', JSON.stringify(l && l.map((x) => x.txId)));
    dit(CS.colisLbcAPoster(null) === null && CS.colisLbcAPoster(undefined) === undefined, 'Leboncoin pas su ⇒ null (jamais 0)');
    const r = CS.resumeColisSites({ lbc, fait: { T2: 1 }, vc: { ventes: ventesVcBrutes, liens }, maintenant: now });
    dit(r.leboncoin && r.leboncoin.total === 1 && r.leboncoin.overdue === 0, 'Leboncoin n’écrit aucune date limite : compté, jamais « en retard »', JSON.stringify(r.leboncoin));
    dit(r.vestiaire && r.vestiaire.total === 1 && r.vestiaire.overdue === 1, 'Vestiaire : la date limite LUE passée ⇒ « en retard », comme Vinted', JSON.stringify(r.vestiaire));
    const t = CS.totalColis({ vinted: { total: 2 }, leboncoin: null, vestiaire: r.vestiaire });
    dit(t.total === 3 && t.auMoins && t.manque.join() === 'leboncoin', 'un site illisible : le total est « au moins », le site NOMMÉ', JSON.stringify(t));
  });

  console.log('\n── Branchements (le code sans ses commentaires)');
  const appelle = (re) => re.test(APPc);
  dit(appelle(/const aExpedier\s*=\s*colis\.filter\(\s*o\s*=>\s*lbcColisAPoster\(/), 'l’écran Colis Leboncoin compte avec LA règle (`lbcColisAPoster`)');
  dit(appelle(/colisAutres\.leboncoin/) && appelle(/save\('vrm_colis_aposter'/) && /leboncoin:\s*lb \? lb\.length/.test(APPc), 'la cloche (`vrm_colis_aposter`) porte Leboncoin et Vestiaire');
  dit(appelle(/retraitsVestiaire\(\{\s*lst/), '« Vendus ailleurs » (chargerRetraitsMulti) lit Vestiaire par `retraitsVestiaire`');
  dit(appelle(/stockVestiaire\(ventesVc\)/), 'la sortie du Stock lit Vestiaire par `stockVestiaire`');
  dit(appelle(/ventesVc:\s*ventesVcDv/) && appelle(/ventesVc:ventesVcN/), 'le verdict « déjà vendue » reçoit Vestiaire (écrans eBay, publication, cloche)');
  dit(appelle(/vestiaire:\s*ventesVc \|\| \[\]/), 'Ma journée et Compta passent Vestiaire aux règles du vendu et du reçu');
  dit(/resumeColisSites/.test(sansCommentaires(lire('api/widget.js'))) && /resumeColisSites/.test(sansCommentaires(lire('api/ship-reminders.js'))), 'le widget et les rappels (matin, soir, bilan) comptent avec la même règle');
  dit(/annoncesVcEnLigne/.test(sansCommentaires(lire('api/email-inbound.js'))), 'la double vente app fermée (email entrant) lit Vestiaire');

  console.log(`\n${ko ? `❌ ${ko} contrôle(s) rouge(s)` : `✅ ${ok} contrôles verts`}`);
  process.exit(ko ? 1 : 0);
})();
