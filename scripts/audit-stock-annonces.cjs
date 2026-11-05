#!/usr/bin/env node
// ── audit-stock-annonces — LE STOCK = TES ANNONCES ACTUELLES (5 nov.) ──────────
// Julien : « pour le stock onglet je veux que ça soit les annonces actuelles ».
// Exécute la VRAIE règle (src/stockAnnonces.js) sur des données INVENTÉES et
// vérifie dans App.jsx que l'écran Stock passe par elle et par la règle unique
// « en ligne » (une règle, un propriétaire — §11). Ce qu'il exige :
//   · une paire en ligne sur Vinted ET Leboncoin (même N°) compte UNE fois ;
//     deux annonces à la même photo exacte, une fois ; jamais par le titre ;
//   · en ligne + à confirmer + masquées = les annonces actuelles ; « à confirmer »
//     est compté à part et son compte NOMMÉ ;
//   · une lecture qui manque (compte Vinted, eBay, Leboncoin) ⇒ nommée et « au
//     moins » ; rien lu ⇒ `su: false` (jamais « aucune annonce ») ;
//   · une annonce eBay/Leboncoin d'un N° prouvé vendu n'est pas une annonce actuelle ;
//   · une paire RANGÉE qui n'est plus actuelle : vendue ⇒ « vendue », sinon
//     « plus en ligne » — seulement si toutes les lectures qui pourraient la
//     porter ont répondu, sinon « pas su » ; gardée à la main ⇒ « gardée ».
//   · (5 nov., « ce qui reste ») VESTIAIRE : ses annonces en ligne, jugées par la
//     règle de Vestiaire (`etatAnnonceVcBrut`, api/_lib/vestiaire-regle.js, la
//     VRAIE, exécutée ici), réunies aux autres par IDENTITÉ seulement (le N° —
//     y compris celui qu'IL a relié à Vinted, `vrm_vc_liens` —, l'identifiant,
//     la photo exacte ; jamais le titre) ; sans N° ⇒ pas comptée, NOMMÉE,
//     « au moins » ; lecture ratée, jamais faite, lue en partie ⇒ nommée ;
//     plus de 24 h ⇒ « à confirmer », nommée ; vendue (vente lue) ⇒ pas comptée.
//   node scripts/audit-stock-annonces.cjs                 la règle du dépôt
//   node scripts/audit-stock-annonces.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-stock-annonces.cjs --prouve        toutes les mutations : chacune doit rougir
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const REGLE = path.join(RACINE, 'src', 'stockAnnonces.js');
const APP = path.join(RACINE, 'src', 'App.jsx');

// [ancre, remplacement] dans src/stockAnnonces.js
const MUTATIONS = {
  // Le N° n'unit plus : une paire sur deux sites compte deux fois.
  'deux-fois': ["    if (p.cle) cles.push('n:' + p.cle);\n", ''],
  // La photo exacte n'unit plus.
  'photo-ignoree': ["    if (ph) cles.push('p:' + ph);\n", ''],
  // Le TITRE unit (ressemblance interdite, §5).
  'par-titre': ["    if (ph) cles.push('p:' + ph);\n", "    if (ph) cles.push('p:' + ph);\n    if (p.titre) cles.push('t:' + p.titre.toLowerCase());\n"],
  // Les masquées ne comptent plus parmi les annonces actuelles.
  'masquees-oubliees': ["    arr(c.masquees).forEach((it) => pousse(it, 'masquee'));\n", ''],
  // Les « à confirmer » oubliées.
  'aconfirmer-oubliees': ["    arr(c.aConfirmer).forEach((it) => pousse(it, 'aconfirmer'));\n", ''],
  // Un compte pas lu traité comme vide (« rien lu » = « rien »).
  'ko-vide': ["    if (!c.ok) { manque.push({ plateforme: 'vinted', nom: String(c.nom || c.uid || ''), raison: 'lecture ratée' }); continue; }", "    if (!c.ok) { lus++; continue; }"],
  // Leboncoin pas lu traité comme vide.
  'lbc-vide': ["  if (lbc == null) manque.push({ plateforme: 'leboncoin', nom: 'Leboncoin', raison: 'pas lu' });\n  else { lus++; autres(lbc, 'leboncoin'); }", "  lus++; autres(lbc, 'leboncoin');"],
  // Plus de « au moins » quand une lecture manque.
  'au-moins-tu': ["    auMoins: su && (manque.length > 0 || sansNumero.ebay > 0 || sansNumero.leboncoin > 0) };", "    auMoins: false };"],
  // Une annonce eBay/Leboncoin d'un N° vendu refait une annonce actuelle.
  'vendu-revient': ["      if (vendus && vendus.has(k)) continue;\n", ''],
  // « Plus en ligne » dit sans que les lectures aient répondu.
  'passu-dit-parti': ["    else if (actuelles && jugeable && jugeable(k)) out[k] = 'plusenligne';", "    else if (actuelles) out[k] = 'plusenligne';"],
  // Une vendue rangée perd sa surbrillance quand une autre annonce de son N° est en ligne.
  'vendue-masquee': ["    if (vendus && vendus.has(k)) out[k] = 'vendue';\n    else if (actuelles && actuelles.has(k)) out[k] = 'actuelle';", "    if (actuelles && actuelles.has(k)) out[k] = 'actuelle';\n    else if (vendus && vendus.has(k)) out[k] = 'vendue';"],
  // « Elle est encore là » ignoré.
  'garde-ignoree': ["    else if (garder && garder[k]) out[k] = 'gardee';\n", ''],
  // ── Vestiaire ──
  // Vestiaire oublié : ses annonces ne comptent plus.
  'vc-oublie': ["  else if (vestiaire) {\n    lus++;", "  else if (vestiaire && false) {\n    lus++;"],
  // Une annonce Vestiaire SANS N° rapprochée par son TITRE (ressemblance interdite, §5).
  'vc-par-titre': ["    for (const a of arr(vestiaire.sansNumero)) { sansNumero.vestiaire += 1;", "    for (const a of arr(vestiaire.sansNumero)) { const t = parts.find((q) => q.titre && q.titre === String((a && a.titre) || '')); if (t) { parts.push({ ...t, id: 'vc:' + String(a.id), plat: 'vestiaire' }); continue; } sansNumero.vestiaire += 1;"],
  // Le N° qu'IL a relié à Vinted (`vrm_vc_liens`, via `auto`) ignoré.
  'vc-lien-ignore': ["    const numero = numVcAnnonce(id, it, lst.liens, auto);", "    const numero = numVcAnnonce(id, it, lst.liens, null);"],
  // Une annonce Vestiaire sans N° ne met plus « au moins ».
  'vc-sans-num-tu': [" || sansNumero.vestiaire > 0", ''],
  // Une lecture Vestiaire de plus de 24 h lue comme « en ligne ».
  'vc-vieille-en-ligne': ["    const etat = e === 'a-confirmer' || vieille ? 'aconfirmer' : 'enligne';", "    const etat = e === 'a-confirmer' ? 'aconfirmer' : 'enligne';"],
  // Vestiaire jamais lu traité comme « rien ».
  'vc-jamais-vide': ["  else if (vestiaire && !vestiaire.lue) manque.push({ plateforme: 'vestiaire', nom: 'Vestiaire', raison: 'jamais lu' });", "  else if (vestiaire && !vestiaire.lue) lus++;"],
  // Une lecture Vestiaire ratée traitée comme « rien ».
  'vc-ko-vide': ["  if (vestiaire === null) manque.push({ plateforme: 'vestiaire', nom: 'Vestiaire', raison: 'pas lu' });", "  if (vestiaire === null) lus++;"],
  // Une liste Vestiaire lue en partie présentée comme complète.
  'vc-partielle-tue': ["    if (!vestiaire.complet) manque.push({ plateforme: 'vestiaire', nom: 'Vestiaire', raison: 'lue en partie' });\n", ''],
  // Une vente Vestiaire lue ne prouve plus « vendue ».
  'vc-vendue-comptee': ["    const e = etatAnnonceVcBrut(it, vendus.has(String(id)), lst.capturedAt);", "    const e = etatAnnonceVcBrut(it, false, lst.capturedAt);"],
  // Un N° prouvé vendu revient par Vestiaire.
  'vc-vendu-revient': ["      if (vendus && vendus.has(k)) continue;\n      if (a.etat === 'aconfirmer') nAc++;", "      if (a.etat === 'aconfirmer') nAc++;"],
  // « En attente de validation » / état non dit compté en ligne.
  'vc-non-dites-en-ligne': ["    if (e !== 'en-ligne' && e !== 'a-confirmer') { nonJugees.push({ id: String(id), titre, numero }); continue; }\n", ''],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

(async () => {
  let fichier = REGLE;
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    const src = fs.readFileSync(REGLE, 'utf8');
    if (!src.includes(m[0])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-stock-annonces-'));
    fichier = path.join(dir, 'stockAnnonces.js');
    // La copie mutée lit la VRAIE règle de Vestiaire (chemin absolu).
    fs.writeFileSync(fichier, src.replace(m[0], m[1]).replace("'../api/_lib/vestiaire-regle.js'", JSON.stringify(pathToFileURL(path.join(RACINE, 'api', '_lib', 'vestiaire-regle.js')).href)));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  }
  let R;
  try { R = await import(pathToFileURL(fichier).href); } catch (e) { console.log('❌ la règle ne se charge pas : ' + e.message); process.exit(1); }
  let ko = 0, n = 0;
  const dit = (c, m, d) => { n++; if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && !c ? ' — ' + d : '')); };
  const essaie = (nom, f) => { try { f(); } catch (e) { dit(false, nom + ' : ' + e.message); } };
  const cle = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
  const clePhoto = (u) => (u ? String(u).split('?')[0] : '');
  const it = (id, title, photo = null) => ({ id, title, photo });
  const numeros = { 101: { numero: '1' }, 102: { numero: '2' }, 103: { numero: '3' }, 104: { numero: '04' }, 105: { numero: '5' }, 201: { numero: '21' } };

  essaie('annoncesActuelles — tout lu', () => {
    const r = R.annoncesActuelles({
      vinted: [
        { uid: '111', nom: 'alpha', ok: true, lu: Date.now(), enLigne: [it(101, 'Nike noire 42'), it(102, 'Adidas 40'), it(110, 'Sans numéro', 'https://x/p110.jpg'), it(111, 'Sans numéro bis', 'https://x/p110.jpg?s=2')], aConfirmer: [], masquees: [it(105, 'Masquée')] },
        { uid: '222', nom: 'beta', ok: true, lu: Date.now() - 3 * 864e5, enLigne: [], aConfirmer: [it(201, 'Nike noire 42')], masquees: [] },
      ],
      numeros, ebay: { liste: [{ numero: '4', title: 'Puma eBay' }, { numero: '', title: 'eBay sans N°' }], illisibles: [] },
      lbc: [{ numero: '2', title: 'Adidas LBC' }, { numero: '3', title: 'vendue, encore sur LBC' }, { numero: '31', title: 'seulement LBC' }],
      vendus: new Set(['3']), cle, clePhoto,
    });
    const parCle = Object.fromEntries(r.articles.filter((a) => a.cle).map((a) => [a.cle, a]));
    dit(r.su === true, 'tout lu : su');
    dit(!!parCle['2'] && parCle['2'].plateformes.join(',') === 'vinted,leboncoin' && r.articles.filter((a) => a.cle === '2').length === 1, 'N°2 sur Vinted ET Leboncoin : UNE fois, deux plateformes', JSON.stringify(parCle['2']));
    dit(r.articles.filter((a) => !a.cle).length === 1 && r.articles.find((a) => !a.cle).ids.length === 2, 'deux annonces sans N° à la même photo exacte : une paire', JSON.stringify(r.articles.filter((a) => !a.cle)));
    dit(!!parCle['1'] && !!parCle['21'] && parCle['1'] !== parCle['21'], 'deux titres identiques (« Nike noire 42 »), deux N° : deux paires (jamais le titre)');
    dit(!parCle['3'], 'N°3 prouvé vendu, encore sur Leboncoin : pas une annonce actuelle');
    dit(!!parCle['4'] && parCle['4'].plateformes.join(',') === 'ebay', 'N°4 seulement sur eBay : une annonce actuelle (« 04 » = « 4 »)');
    dit(!!parCle['31'], 'N°31 seulement sur Leboncoin : une annonce actuelle');
    dit(r.n === 7, '7 annonces actuelles (1, 2, 4, 5, 21, 31, la sans-N°)', String(r.n));
    dit(r.nMasquees === 1 && parCle['5'] && parCle['5'].etat === 'masquee', 'la masquée compte parmi les actuelles, état « masquee »');
    dit(r.nAConfirmer === 1 && parCle['21'].etat === 'aconfirmer' && r.aConfirmerComptes.length === 1 && r.aConfirmerComptes[0].nom === 'beta', '« à confirmer » compté à part, son compte NOMMÉ', JSON.stringify(r.aConfirmerComptes));
    dit(r.sansNumero.ebay === 1 && r.auMoins === true, 'une annonce eBay sans N° (on ne sait pas quelle paire) ⇒ « au moins »');
    dit(r.manque.length === 0, 'rien ne manque', JSON.stringify(r.manque));
  });
  essaie('annoncesActuelles — en ligne l\'emporte', () => {
    const r = R.annoncesActuelles({ vinted: [{ uid: '1', nom: 'a', ok: true, enLigne: [], aConfirmer: [it(101, 'x')], masquees: [] }], numeros, ebay: { liste: [], illisibles: [] }, lbc: [{ numero: '1', title: 'x' }], cle });
    dit(r.articles.length === 1 && r.articles[0].etat === 'enligne', 'à confirmer sur Vinted mais en vente sur Leboncoin : « en ligne », une fois', JSON.stringify(r.articles));
  });
  essaie('annoncesActuelles — lectures qui manquent', () => {
    const r = R.annoncesActuelles({ vinted: [{ uid: '1', nom: 'alpha', ok: true, enLigne: [it(101, 'x')], aConfirmer: [], masquees: [] }, { uid: '2', nom: 'beta', ok: false }], numeros, ebay: null, lbc: [], cle });
    dit(r.su && r.auMoins && r.n === 1, 'un compte pas lu ⇒ « au moins 1 »', JSON.stringify({ su: r.su, am: r.auMoins, n: r.n }));
    dit(r.manque.some((x) => x.nom === 'beta') && r.manque.some((x) => x.plateforme === 'ebay'), 'les lectures qui manquent sont NOMMÉES (beta, eBay)', JSON.stringify(r.manque));
    const z = R.annoncesActuelles({ vinted: [{ uid: '1', nom: 'a', ok: false }], numeros, ebay: null, lbc: null, cle });
    dit(z.su === false && z.n === 0 && z.manque.length === 3, 'rien lu ⇒ su: false (jamais « aucune annonce »)', JSON.stringify(z));
    const l = R.annoncesActuelles({ vinted: [], numeros, ebay: { liste: [], illisibles: [] }, lbc: null, cle });
    dit(l.auMoins && l.manque.some((x) => x.plateforme === 'leboncoin'), 'Leboncoin pas lu ⇒ nommé, « au moins »', JSON.stringify(l));
  });
  essaie('classerRangees', () => {
    const slots = { 1: { m: 'a', i: 0 }, 7: { m: 'a', i: 1 }, 8: { m: 'a', i: 2 }, 9: { m: 'a', i: 3 }, 10: { m: 'a', i: 4 }, 12: { m: 'a', i: 5 } };
    const actuelles = new Set(['1', '12']);
    const r = R.classerRangees({ slots, actuelles, vendus: new Set(['7', '12']), garder: { 10: 1 }, jugeable: (k) => k !== '9', cle });
    dit(r['1'] === 'actuelle', 'N°1 rangée et actuelle : « actuelle »');
    dit(r['7'] === 'vendue', 'N°7 rangée puis vendue : « vendue » (case allumée)');
    dit(r['12'] === 'vendue', 'N°12 vendue mais encore une annonce ailleurs : reste « vendue » (à sortir)');
    dit(r['8'] === 'plusenligne', 'N°8 rangée, plus actuelle, lectures complètes : « plus en ligne »');
    dit(r['9'] === 'passu', 'N°9 : une lecture qui pourrait la porter manque ⇒ « pas su », jamais « plus en ligne »');
    dit(r['10'] === 'gardee', 'N°10 : « Elle est encore là » ⇒ « gardée »');
    const z = R.classerRangees({ slots, actuelles: null, vendus: new Set(['7']), garder: {}, jugeable: () => true, cle });
    dit(z['8'] === 'passu' && z['7'] === 'vendue', 'annonces pas lues (null) : rien n\'est « plus en ligne », la vendue reste allumée', JSON.stringify(z));
  });
  // ── VESTIAIRE (5 nov.) : la VRAIE règle de Vestiaire, des données INVENTÉES ──
  const MAINT = Date.parse('2026-11-05T12:00:00Z');
  const ISO = (h) => new Date(MAINT - h * 3600e3).toISOString();
  const vcIt = (titre, statut = 'on_sale', extra = {}) => ({ titre, statut, vuAt: ISO(1), photo: 'https://images.vestiairecollective.com/produit/' + titre.replace(/\W+/g, '-') + '.jpg', ...extra });
  const lstVc = (items, extra = {}) => ({ items, liens: { vc302: '41' }, capturedAt: ISO(1), complet: true, ...extra });
  const autoVc = { vc301: { numero: '9', lie: true }, vc305: { numero: '60' } };   // vc301 : RELIÉE par son clic à la Vinted N°9 (vrm_vc_liens)
  const itemsVc = {
    vc301: vcIt('Titre Vestiaire tout autre'),                // reliée à Vinted N°9 : la MÊME paire
    vc302: vcIt('Seulement sur Vestiaire'),                   // lien de publication VRM : N°41
    vc303: vcIt('Nike noire 42'),                             // SANS N°, même titre que la Vinted N°1
    vc304: vcIt('Vendue sur Vestiaire', 'on_sale', { ref: '77' }), // une vente lue la prouve vendue
    vc305: vcIt('En attente', 'pending_review'),              // ni en ligne ni partie : non dite
    vc306: vcIt('Retirée', 'withdrawn', { ref: '78' }),
    vc307: vcIt('Vendue ailleurs, encore sur Vestiaire', 'on_sale', { ref: '3' }),   // N°3 prouvé vendu (vrm_stock_vendus)
  };
  const ventesVc = { v1: { productId: 'vc304', etat: 'payout done' } };
  const vinted1 = () => [{ uid: '111', nom: 'alpha', ok: true, lu: MAINT, enLigne: [it(101, 'Nike noire 42'), { id: 109, title: 'Vinted neuf' }], aConfirmer: [], masquees: [] }];
  const numeros9 = { ...numeros, 109: { numero: '9' } };
  essaie('Vestiaire — annoncesVcStock + annoncesActuelles', () => {
    if (typeof R.annoncesVcStock !== 'function') { dit(false, 'annoncesVcStock existe (src/stockAnnonces.js)'); return; }
    const vs = R.annoncesVcStock({ lst: lstVc(itemsVc), ventes: ventesVc, auto: autoVc, maintenant: MAINT });
    const r = R.annoncesActuelles({ vinted: vinted1(), numeros: numeros9, ebay: { liste: [], illisibles: [] }, lbc: [], vestiaire: vs, vendus: new Set(['3']), cle, clePhoto });
    const parCle = Object.fromEntries(r.articles.filter((a) => a.cle).map((a) => [a.cle, a]));
    dit(!!parCle['9'] && parCle['9'].plateformes.join(',') === 'vinted,vestiaire' && r.articles.filter((a) => a.cle === '9').length === 1, 'Vestiaire RELIÉE par son clic à la Vinted N°9 (titres différents) : UNE paire, deux plateformes', JSON.stringify(parCle['9']));
    dit(!!parCle['41'] && parCle['41'].plateformes.join(',') === 'vestiaire' && parCle['41'].etat === 'enligne', 'N°41 seulement sur Vestiaire : une annonce actuelle, « en ligne »', JSON.stringify(parCle['41']));
    dit(!!parCle['1'] && parCle['1'].plateformes.join(',') === 'vinted', 'une annonce Vestiaire SANS N° au même titre que la Vinted N°1 ne s’y rattache pas (jamais le titre)', JSON.stringify(parCle['1']));
    dit(r.sansNumero.vestiaire === 1 && (r.vcSansNumero || []).length === 1 && r.vcSansNumero[0].titre === 'Nike noire 42', 'l’annonce Vestiaire sans N° n’est pas comptée : elle est NOMMÉE', JSON.stringify(r.vcSansNumero));
    dit(!!r.auMoins, 'une annonce Vestiaire sans N° (ou à l’état non dit) ⇒ « au moins »');
    dit(!parCle['77'], 'N°77 : une vente Vestiaire lue la prouve vendue ⇒ pas une annonce actuelle');
    dit(!parCle['78'], 'N°78 retirée de Vestiaire : pas une annonce actuelle');
    dit(!parCle['3'], 'N°3 prouvé vendu (vrm_stock_vendus), encore sur Vestiaire : pas une annonce actuelle');
    dit(!parCle['60'] && (r.vcNonJugees || []).some((x) => x.cle === '60'), 'N°60 « en attente de validation » : ni en ligne ni partie, nommée à part', JSON.stringify(r.vcNonJugees));
    dit(r.n === 3, '3 annonces actuelles (1, 9 réunie, 41)', String(r.n));
    dit(r.manque.length === 0 && r.vcVieille == null, 'lecture Vestiaire fraîche et complète : rien de nommé comme manquant', JSON.stringify(r.manque));
    // Sans annonce sans N° ni état non dit : pas « au moins » (le seul manque est bien celui-là).
    const net = R.annoncesActuelles({ vinted: vinted1(), numeros: numeros9, ebay: { liste: [], illisibles: [] }, lbc: [], vestiaire: R.annoncesVcStock({ lst: lstVc({ vc301: itemsVc.vc301, vc302: itemsVc.vc302 }), ventes: {}, auto: autoVc, maintenant: MAINT }), vendus: new Set(), cle, clePhoto });
    dit(net.auMoins === false && net.n === 3, 'Vestiaire fraîche, complète, tout numéroté : ni « au moins » ni manque', JSON.stringify({ am: net.auMoins, n: net.n }));
    // Une SEULE annonce Vestiaire sans N° (rien d'autre ne manque) suffit à dire « au moins ».
    const sn = R.annoncesActuelles({ vinted: vinted1(), numeros: numeros9, ebay: { liste: [], illisibles: [] }, lbc: [], vestiaire: R.annoncesVcStock({ lst: lstVc({ vc302: itemsVc.vc302, vc303: itemsVc.vc303 }), ventes: {}, auto: autoVc, maintenant: MAINT }), vendus: new Set(), cle, clePhoto });
    dit(sn.auMoins === true && sn.n === 3 && sn.sansNumero.vestiaire === 1, 'une annonce Vestiaire sans N°, seule : pas comptée, total « au moins »', JSON.stringify({ am: sn.auMoins, n: sn.n }));
  });
  essaie('Vestiaire — lectures qui manquent ou vieilles', () => {
    if (typeof R.annoncesVcStock !== 'function') { dit(false, 'annoncesVcStock existe'); return; }
    const base = { vinted: vinted1(), numeros: numeros9, ebay: { liste: [], illisibles: [] }, lbc: [], vendus: new Set(), cle, clePhoto };
    const ko = R.annoncesActuelles({ ...base, vestiaire: R.annoncesVcStock({ lst: null }) });
    dit(ko.manque.some((x) => x.plateforme === 'vestiaire' && x.raison === 'pas lu') && ko.auMoins, 'lecture Vestiaire ratée ⇒ NOMMÉE, « au moins »', JSON.stringify(ko.manque));
    const jamais = R.annoncesActuelles({ ...base, vestiaire: R.annoncesVcStock({ lst: {} }) });
    dit(jamais.manque.some((x) => x.plateforme === 'vestiaire' && x.raison === 'jamais lu') && jamais.auMoins, 'Vestiaire jamais lu ⇒ NOMMÉ, « au moins » (jamais « rien sur Vestiaire »)', JSON.stringify(jamais.manque));
    const seul = R.annoncesActuelles({ vinted: [], numeros, ebay: null, lbc: null, vestiaire: R.annoncesVcStock({ lst: {} }), cle });
    dit(seul.su === false, 'rien lu, Vestiaire jamais lu non plus ⇒ su: false', JSON.stringify(seul));
    const vieux = R.annoncesVcStock({ lst: lstVc({ vc302: vcIt('Seulement sur Vestiaire', 'on_sale', { vuAt: ISO(72) }) }, { capturedAt: ISO(72) }), ventes: {}, auto: autoVc, maintenant: MAINT });
    const rv = R.annoncesActuelles({ ...base, vestiaire: vieux });
    const a41 = rv.articles.find((a) => a.cle === '41');
    dit(!!a41 && a41.etat === 'aconfirmer' && !!rv.vcVieille && rv.aConfirmerComptes.some((c) => c.plateforme === 'vestiaire' && c.vieille), 'lecture Vestiaire de 3 jours ⇒ « à confirmer », NOMMÉE (jamais « en ligne »)', JSON.stringify({ a41, v: rv.vcVieille, c: rv.aConfirmerComptes }));
    const partiel = R.annoncesActuelles({ ...base, vestiaire: R.annoncesVcStock({ lst: lstVc({ vc302: vcIt('Seulement sur Vestiaire') }, { complet: false }), ventes: {}, auto: autoVc, maintenant: MAINT }) });
    dit(partiel.manque.some((x) => x.plateforme === 'vestiaire' && x.raison === 'lue en partie') && partiel.auMoins, 'liste Vestiaire lue en partie ⇒ NOMMÉE, « au moins »', JSON.stringify(partiel.manque));
    const pasDemande = R.annoncesActuelles({ ...base });
    dit(!pasDemande.manque.some((x) => x.plateforme === 'vestiaire'), 'un appelant qui ne passe pas Vestiaire (undefined) : rien de dit sur lui');
  });
  essaie('App.jsx — Vestiaire', () => {
    const app = fs.readFileSync(APP, 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const lireVc = app.slice(app.indexOf('async function lireVcStock('), app.indexOf('async function lireAnnoncesStock('));
    const lire = app.slice(app.indexOf('async function lireAnnoncesStock('), app.indexOf('function StockMeubles('));
    const meubles = app.slice(app.indexOf('function StockMeubles('), app.indexOf('function ChoixPlanches('));
    dit(/id=eq\.vc_listings&select=items:data->items,liens:data->liens,capturedAt:data->>capturedAt,complet:data->complet/.test(lireVc) && !/select=data[&`,]/.test(lireVc) && /id=eq\.vc_ventes&select=ventes:data->ventes/.test(lireVc), 'le Stock lit vc_listings et vc_ventes PROJETÉS (jamais select=data)');
    dit(/lireVcStock\(/.test(lire), 'lireAnnoncesStock lit Vestiaire');
    dit(/annoncesVcStock\(\{[^}]*auto: vcLocStock\.auto/.test(meubles) && /const vcLocStock = useVcLocal\(\)/.test(meubles) && /vestiaire: vcStock/.test(meubles), 'le Stock juge Vestiaire avec les N° du moment (donnés et RELIÉS : useVcLocal → numerosVcEffectifs → vrm_vc_liens)');
    dit(/numerosVcAvecLiens\(vcCarte\('vrm_vc_numeros'\), vcCarte\('vrm_vc_liens'\)\)/.test(app), 'numerosVcEffectifs porte les liens qu’IL a posés (vrm_vc_liens)');
    dit(/aa\.manque\.some\(\(m\) => m\.plateforme === 'vestiaire'\)/.test(meubles), 'une lecture Vestiaire qui manque ⇒ aucune paire rangée dite « plus en ligne »');
  });
  essaie('App.jsx', () => {
    const app = fs.readFileSync(APP, 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const meubles = app.slice(app.indexOf('function StockMeubles('), app.indexOf('function ChoixPlanches('));
    const lire = app.slice(app.indexOf('async function lireAnnoncesStock('), app.indexOf('function StockMeubles('));
    dit(/annoncesActuelles\(/.test(meubles) && /classerRangees\(/.test(meubles), 'le Stock passe par annoncesActuelles et classerRangees');
    dit(/fetchVintedListings\(/.test(lire) && /lireEbayEnLigne\(/.test(lire) && /lireLbcEnVente\(/.test(lire), 'le Stock lit par les MÊMES lectures que l’écran Annonces (fetchVintedListings, eBay, Leboncoin)');
    dit(/masqueesPresentes\(/.test(meubles), 'les masquées déclarées parties sortent (masqueesPresentes)');
    dit(!/ajouterAutresPresents\(/.test(meubles) && !/numsPresents\(/.test(meubles), 'le Stock ne se fabrique plus depuis toutes les fiches numérotées ni la liste publiée');
    const comp = app.slice(app.indexOf('function Comptabilite('), app.indexOf('function Comptabilite(') + 400000);
    dit(/lireLbcEnVente\(/.test(comp) && /lireEbayEnLigne\(/.test(comp), 'l’écran Annonces lit eBay et Leboncoin par les mêmes fonctions (§11)');
  });
  console.log(`\n${n - ko}/${n} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
