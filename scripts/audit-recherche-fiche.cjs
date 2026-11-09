#!/usr/bin/env node
// ── audit-recherche-fiche — LA RECHERCHE UNIVERSELLE ET LA FICHE D'UNE PAIRE (9 nov.) ──
// Exécute les VRAIES règles (src/rechercheUnique.js, src/rechercheEcran.js,
// src/histoireArticle.js et ce qu'elles importent, src/rechercheNumero.js) sur des
// données INVENTÉES (le dépôt est public). Ce qu'il exige :
//   1. LA RECONNAISSANCE : « b125 », « 007 » (la clé du N° de l'app), un n° de
//      commande eBay, un n° de transaction, un n° de suivi, un code, un montant, un
//      pseudo, des mots — dit, jamais décidé à la place de l'index ;
//   2. LES NOUVELLES IDENTITÉS : une vente eBay / Leboncoin / Vestiaire se trouve par
//      SON n° de commande et ouvre SA vente (eBay : la commande ; Vestiaire : `vcvente`) ;
//      une conversation par SA transaction et SON interlocuteur, et ouvre CETTE
//      conversation (compte + n°) ; le N° d'une vente hors Vinted ne vient que de
//      l'identité (SKU, lien, référence), jamais du titre ;
//   3. 50 PAIRES AU MÊME TITRE : 50 commandes eBay, 50 conversations, 50 fiches restent
//      50 lignes ; la FICHE de l'une (achat, vente, bordereau, dépôt, livraison,
//      versement, bénéfice) n'emprunte RIEN à une autre ;
//   4. « PAS SU » N'EST PAS « RIEN » : bordereau ou suivi pas lus ⇒ « — » et la raison ;
//      bénéfice sans prix d'achat ⇒ le manque NOMMÉ, jamais 0 ;
//   5. LE CLAVIER : ↓ du champ va à la 1re ligne, ↑ de la 1re revient au champ ;
//      ⌘K / Ctrl+K branchés ; Entrée ouvre la 1re trouvaille ;
//   6. LES LECTURES de la loupe et de la fiche sont projetées (jamais `select=data`) et
//      faites à l'ouverture seulement (aucun coût au démarrage).
//   node scripts/audit-recherche-fiche.cjs [--mutation=NOM | --prouve]
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RAC = path.join(__dirname, '..');
const F = {
  regle: path.join(RAC, 'src', 'rechercheUnique.js'),
  ecran: path.join(RAC, 'src', 'rechercheEcran.js'),
  histoire: path.join(RAC, 'src', 'histoireArticle.js'),
  app: path.join(RAC, 'src', 'App.jsx'),
};

// [fichier, avant, après] — chaque défaut, remis exprès : il faut du ROUGE.
const MUTATIONS = {
  'commande-par-titre': ['regle', "const cle = 'vente:' + x.site + ':' + str(x.id);", "const cle = 'vente:' + x.site + ':' + normaliser(x.titre);"],
  'conversation-par-titre': ['regle', "const cle = 'message:' + str(m.uid) + '_' + str(m.conv);", "const cle = 'message:' + normaliser(m.titre);"],
  'commande-courte': ['regle', "if (e.par0 === 'commande') { if (qa.length >= 5) {", "if (e.par0 === 'commande') { if (qa.length >= 1) {"],
  'ebay-sans-commande': ['regle', "if (e.type === 'vente' && e.site === 'ebay') return { tab: 'ebay_ventes', ebay: { compte: e.compte || null, orderId: e.id } };", "if (e.type === 'vente' && e.site === 'ebay') return { tab: 'ebay_ventes' };"],
  'num-ebay-par-titre': ['ecran', "let numero = ''; try { numero = str(numEbay(c, li) || ''); } catch (_) {}", "let numero = str(li.title).match(/\\d+/) ? str(li.title).match(/\\d+/)[0] : '';"],
  'colis-autre-vente': ['histoire', "(d.colisVente[String(e.tx)] || {})", "(Object.values(d.colisVente)[0] || {})"],
  'suivi-ressemblance': ['histoire', ".filter((t) => t && k(t.suivi) === k(b.suivi))", ".filter((t) => t && k(t.suivi).slice(0, 4) === k(b.suivi).slice(0, 4))"],
  'colis-pas-su-tu': ['histoire', "} else if (cv === null) detailColis = [detailColis, 'bordereau et suivi pas lus'].filter(Boolean).join(' · ');", "}"],
  'benefice-zero': ['histoire', "} else if (vendue === 'fait') pose('benefice', 'passu', 'Bénéfice', [], r.raisonBenef || 'pas calculable');", "} else if (vendue === 'fait') pose('benefice', 'fait', 'Bénéfice +0 €', [], '');"],
  'clavier-haut': ['ecran', "if (touche === 'ArrowUp') return i <= 0 ? -1 : i - 1;", "if (touche === 'ArrowUp') return i <= 0 ? 0 : i - 1;"],
  'sans-cmdk': ['app', "(e.key === 'k' || e.key === 'K')", "(e.key === 'j')"],
  'sans-commandes-dans-index': ['app', 'factures, numerosTx, autres, messages: gsData ? gsData.messages : null });', 'factures, numerosTx });'],
  'conv-entieres': ['app', "lireTout('id=like.harvest_*_conv_*&select=id,tx:data->payload->conversation->transaction->>id,", "lireTout('id=like.harvest_*_conv_*&select=id,data,tx:data->payload->conversation->transaction->>id,"],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ancre = /ancre de mutation introuvable/.test(r.stdout || '');
    const pris = r.status !== 0 && rouges && !ancre;
    console.log(`${pris ? '✅' : '❌'} mutation « ${m} » : ${ancre ? 'ANCRE INTROUVABLE' : rouges + ' rouge(s)'}`);
    if (pris) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

// Retire les commentaires sans toucher aux chaînes (on juge le code, pas sa prose).
function sansCommentaires(t) {
  let o = '', i = 0, q = null;
  while (i < t.length) {
    const c = t[i], n = t[i + 1];
    if (q) { o += c; if (c === '\\') { o += n || ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; o += c; i++; continue; }
    if (c === '/' && n === '/' && t[i - 1] !== ':') { while (i < t.length && t[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { const f = t.indexOf('*/', i + 2); i = f < 0 ? t.length : f + 2; continue; }
    o += c; i++;
  }
  return o;
}

(async () => {
  for (const f of Object.values(F)) if (!fs.existsSync(f)) { console.log('❌ ' + path.relative(RAC, f) + ' absent'); process.exit(1); }
  const src = Object.fromEntries(Object.entries(F).map(([k, f]) => [k, fs.readFileSync(f, 'utf8')]));
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!src[m[0]].includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    src[m[0]] = src[m[0]].replace(m[1], m[2]);
  }
  // Une copie de src/*.js (les imports relatifs de la fiche), api/ en lien : la mutation
  // touche la COPIE, jamais le dépôt.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recherche-fiche-'));
  fs.mkdirSync(path.join(dir, 'src'));
  for (const f of fs.readdirSync(path.join(RAC, 'src'))) if (/\.js$/.test(f)) fs.copyFileSync(path.join(RAC, 'src', f), path.join(dir, 'src', f));
  fs.symlinkSync(path.join(RAC, 'api'), path.join(dir, 'api'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(dir, 'src', 'rechercheUnique.js'), src.regle);
  fs.writeFileSync(path.join(dir, 'src', 'rechercheEcran.js'), src.ecran);
  fs.writeFileSync(path.join(dir, 'src', 'histoireArticle.js'), src.histoire);
  let R, E, H, N;
  try {
    R = await import(pathToFileURL(path.join(dir, 'src', 'rechercheUnique.js')).href);
    E = await import(pathToFileURL(path.join(dir, 'src', 'rechercheEcran.js')).href);
    H = await import(pathToFileURL(path.join(dir, 'src', 'histoireArticle.js')).href);
    N = await import(pathToFileURL(path.join(dir, 'src', 'rechercheNumero.js')).href);
  } catch (e) { console.log('❌ les règles ne se chargent pas : ' + e.message); process.exit(1); }
  const manque = ['reconnaitreRequete', 'GENRES_REQUETE'].filter((x) => !R[x]).concat(['ventesAutresPourRecherche', 'messagesPourRecherche', 'voisinClavier'].filter((x) => !E[x])).concat(['colisDesVentes'].filter((x) => !H[x]));
  if (manque.length) { console.log('❌ la recherche universelle et la fiche ne savent pas encore : ' + manque.join(', ')); process.exit(1); }

  let ko = 0, n = 0;
  const dit = (c, msg, det) => { n++; if (c) console.log('✅ ' + msg); else { ko++; console.log('❌ ' + msg + (det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 300) : '')); } };
  const essaie = (nom, fn) => { try { fn(); } catch (e) { ko++; n++; console.log('❌ ' + nom + ' a levé : ' + (e && e.stack || e).toString().split('\n').slice(0, 2).join(' ')); } };
  const cleNum = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
  const kNum = (q) => N.lireNumeroCherche(q, { cleNum }, ['', 'B']);

  // ── 1. LA RECONNAISSANCE ─────────────────────────────────────────────────
  essaie('reconnaissance', () => {
    const g = (q) => R.reconnaitreRequete(q, { numero: kNum(q) }).genres;
    dit(kNum('b125') === 'B125' && g('b125').includes('numero'), '« b125 » est le N° B125 (clé de l’app)', [kNum('b125'), g('b125')]);
    dit(kNum('007') === '7' && g('007').includes('numero'), '« 007 » est le N°7', [kNum('007'), g('007')]);
    dit(g('12-34567-89012')[0] === 'commande-ebay', '« 12-34567-89012 » : un n° de commande eBay', g('12-34567-89012'));
    dit(JSON.stringify(g('52 €')) === '["montant"]' && JSON.stringify(g('52,00')) === '["montant"]', '« 52 € », « 52,00 » : un montant, rien d’autre', [g('52 €'), g('52,00')]);
    dit(g('48291312').includes('transaction'), '« 48291312 » : un n° de transaction', g('48291312'));
    dit(g('6A12345678901').includes('suivi') && !g('6A12345678901').includes('code'), '« 6A12345678901 » : un n° de suivi', g('6A12345678901'));
    dit(g('K7X2').includes('code'), '« K7X2 » : un code de retrait', g('K7X2'));
    dit(g('tom.kicks').includes('pseudo'), '« tom.kicks » : un pseudo', g('tom.kicks'));
    dit(g('nike dunk').includes('mots') && !g('nike dunk').includes('pseudo'), '« nike dunk » : des mots du titre', g('nike dunk'));
    dit(R.reconnaitreRequete('', {}).genres.length === 0, 'rien tapé : rien reconnu');
    dit(Object.keys(R.GENRES_REQUETE).every((k) => typeof R.GENRES_REQUETE[k] === 'string' && R.GENRES_REQUETE[k].length), 'chaque genre a SA phrase');
  });

  // ── 2. LES DONNÉES (inventées) ───────────────────────────────────────────
  const TITRE = 'Nike Dunk Low Panda taille 42';
  const fiches = {}; for (let i = 0; i < 50; i++) fiches[7200 + i] = { numero: String(201 + i), title: TITRE, buyPrice: String(10 + i), numberedAt: '2026-10-22T10:00:00Z' };
  fiches[7300] = { numero: 'B125', title: 'Asics Gel-Kayano 14', buyPrice: '40' };
  fiches[7301] = { numero: '125', title: 'Asics Gel-Kayano 14', buyPrice: '41' };
  // 50 commandes eBay au MÊME titre ; seules celles qui portent un SKU VRM-{n°} ont un N°.
  const ebay = Array.from({ length: 50 }, (_, i) => ({ orderId: `12-${String(34500 + i).padStart(5, '0')}-${String(89000 + i).padStart(5, '0')}`, creationDate: `2026-11-0${1 + (i % 8)}T10:00:00Z`, buyer: { username: 'ach' + i }, _compte: 'ebay1', lineItems: [{ title: TITRE, sku: i < 10 ? 'VRM-' + (201 + i) : '' }] }));
  const lbc = [{ _id: '3001234567', isSeller: true, itemId: '2700001', title: TITRE, price: 6500, dateVente: '2026-11-03T10:00:00Z' }, { _id: '3001234999', isSeller: false, title: 'Un achat', price: 100 }];
  const vc = [{ id: '55001', productId: '91000777', num: '230', titre: TITRE, montant: '80', date: '2026-11-02' }];
  const numEbay = (c, li) => { const m = /^VRM-(\w+)$/.exec(String((li && li.sku) || '')); return m ? cleNum(m[1]) : ''; };
  const autres = E.ventesAutresPourRecherche({ ebay, lbc, vc }, { numEbay, numLbc: (v) => (v.itemId === '2700001' ? '240' : '') });
  const convs = Array.from({ length: 50 }, (_, i) => ({ id: `harvest_111_conv_${80000 + i}`, tx: String(9000000 + i), titre: TITRE, login: 'pseudo' + i }));
  convs.push({ id: 'harvest_222_conv_99', tx: '9100000', titre: 'Autre', login: 'retire' });
  const messages = E.messagesPourRecherche(convs, (u) => u !== '222');
  const ventes = Array.from({ length: 3 }, (_, i) => ({ transaction_id: 9226 + i, title: TITRE, status: 'Commande finalisée', price: { amount: '70', currency_code: 'EUR' }, date: '2026-11-0' + (4 + i) + 'T10:00:00Z' }));
  const idx = R.indexRecherche({ fiches, ventes, autres, messages });

  essaie('commandes', () => {
    dit(autres.filter((x) => x.site === 'ebay').length === 50, '50 commandes eBay au même titre ⇒ 50 entrées', autres.filter((x) => x.site === 'ebay').length);
    dit(idx.entrees.filter((e) => e.site === 'ebay').length === 50 && new Set(idx.entrees.filter((e) => e.site === 'ebay').map((e) => e.cle)).size === 50, 'l’index garde 50 ventes eBay distinctes (une clé par n° de commande)');
    dit(autres.filter((x) => x.site === 'leboncoin').length === 1, 'Leboncoin : seule la VENTE prouvée (isSeller) entre — un achat n’est pas une vente', autres.filter((x) => x.site === 'leboncoin').length);
    const r = R.chercherPartout(idx, '12-34507-89007');
    const v = r.groupes.vente;
    dit(v.length === 1 && v[0].e.site === 'ebay' && v[0].par === 'commande' && v[0].exact && v[0].e.id === '12-34507-89007', 'un n° de commande eBay tapé avec ses tirets ⇒ CETTE commande, exacte', v.map((x) => [x.e.id, x.par]));
    const r2 = R.chercherPartout(idx, '123450789007');
    dit(r2.groupes.vente.length === 1 && r2.groupes.vente[0].e.id === '12-34507-89007', 'le même n° sans tirets ⇒ la même commande', r2.groupes.vente.map((x) => x.e.id));
    const d = R.destinationResultat(v[0]);
    dit(d && d.tab === 'ebay_ventes' && d.ebay && d.ebay.orderId === '12-34507-89007' && d.ebay.compte === 'ebay1', 'elle ouvre SA commande dans eBay → Ventes (compte + n°)', d);
    dit(v[0].e.numero === '208', 'son N° vient de SON SKU (VRM-208)', v[0].e.numero);
    const sansSku = idx.entrees.find((e) => e.site === 'ebay' && e.id === '12-34530-89030');
    dit(sansSku && sansSku.numero === '', 'une commande sans SKU n’a AUCUN N° (même titre qu’une fiche numérotée)', sansSku && sansSku.numero);
    const l = R.chercherPartout(idx, '3001234567').groupes.vente;
    dit(l.length === 1 && l[0].e.site === 'leboncoin' && l[0].e.numero === '240', 'la vente Leboncoin par SON id, son N° par SON lien', l.map((x) => [x.e.site, x.e.numero]));
    const dl = R.destinationResultat(l[0]);
    dit(dl && dl.tab === 'ventes' && dl.sub === 'leboncoin', 'elle ouvre Ventes → Leboncoin', dl);
    const c = R.chercherPartout(idx, '91000777').groupes.vente;
    dit(c.length === 1 && c[0].e.site === 'vestiaire' && c[0].e.numero === '230', 'la vente Vestiaire par la réf. de SON produit, son N° lu par identité', c.map((x) => [x.e.site, x.e.numero]));
    const dc = R.destinationResultat(c[0]);
    dit(dc && dc.cible && dc.cible.type === 'vcvente' && dc.cible.vc === '55001', 'elle ouvre CETTE vente Vestiaire (`vcvente`)', dc);
    dit(!R.chercherPartout(idx, '345').groupes.vente.some((x) => x.par === 'commande'), 'trois chiffres ne sont jamais un n° de commande');
  });

  essaie('conversations', () => {
    dit(messages.length === 50, 'les conversations d’un compte retiré ne sont pas lues', messages.length);
    const r = R.chercherPartout(idx, '9000017');
    const m = r.groupes.message;
    dit(m.length === 1 && m[0].par === 'transaction' && m[0].e.id === '80017', 'une conversation par SA transaction', m.map((x) => [x.e.id, x.par]));
    const d = R.destinationResultat(m[0]);
    dit(d && d.tab === 'cat_msg' && d.cible && d.cible.type === 'conv' && d.cible.conv === '80017' && d.cible.compte === '111', 'elle ouvre CETTE conversation (compte + n°)', d);
    const p = R.chercherPartout(idx, 'pseudo42').groupes.message;
    dit(p.length === 1 && p[0].par === 'pseudo' && p[0].e.id === '80042', 'une conversation par SON interlocuteur', p.map((x) => x.e.id));
    const t = R.chercherPartout(idx, 'dunk panda', { max: 500 });
    dit(t.totaux.message === 50 && new Set(t.groupes.message.map((x) => x.e.cle)).size === 50, '50 conversations au même titre ⇒ 50 lignes, jamais fusionnées', t.totaux.message);
    dit(t.totaux.paire === 50 && new Set(t.groupes.paire.map((x) => x.e.numero)).size === 50, '50 paires au même titre ⇒ 50 N° différents', t.totaux.paire);
    dit(t.groupes.vente.every((x) => x.par === 'titre'), 'le titre ne fait que PROPOSER (« trouvé par le titre »), jamais une identité');
  });

  essaie('numeros', () => {
    const r = R.chercherPartout(idx, 'b125', { numero: kNum('b125') });
    const ex = r.groupes.paire.filter((x) => x.exact);
    dit(ex.length === 1 && ex[0].e.numero === 'B125', '« b125 » ⇒ la paire B125, pas la 125', ex.map((x) => x.e.numero));
    const r7 = R.chercherPartout(R.indexRecherche({ fiches: { 1: { numero: '7', title: 'x' }, 2: { numero: '70', title: 'x' } } }), '007', { numero: kNum('007') });
    dit(r7.groupes.paire.filter((x) => x.exact).map((x) => x.e.numero).join() === '7', '« 007 » ⇒ la paire 7 (exacte), la 70 n’est pas exacte', r7.groupes.paire.map((x) => [x.e.numero, x.exact]));
  });

  // ── 3. LE CLAVIER ────────────────────────────────────────────────────────
  essaie('clavier', () => {
    const v = E.voisinClavier;
    dit(v(5, -1, 'ArrowDown') === 0 && v(5, 0, 'ArrowDown') === 1 && v(5, 4, 'ArrowDown') === 4, '↓ : du champ à la 1re ligne, puis ligne à ligne, s’arrête à la dernière');
    dit(v(5, 0, 'ArrowUp') === -1 && v(5, 3, 'ArrowUp') === 2, '↑ : ligne à ligne, de la 1re on revient au champ');
    dit(v(5, 2, 'Home') === 0 && v(5, 2, 'End') === 4 && v(5, -1, 'Home') === null, 'Début / Fin dans les lignes (pas dans le champ)');
    dit(v(0, -1, 'ArrowDown') === null, 'aucune ligne : ↓ ne fait rien');
  });

  // ── 4. LA FICHE : 50 paires au même titre, trois vendues ─────────────────
  const shipDone = { 9226: Date.parse('2026-11-05T09:00:00Z'), 9227: true };
  const bords = [
    { tx: '9226', suivi: '6A11111111111', at: '2026-11-04T12:00:00Z' },
    { tx: '9227', suivi: '6A22222222222', at: '2026-11-05T12:00:00Z' },
    { tx: '9228', suivi: '6A33333333333', at: '2026-11-06T12:00:00Z' },
  ];
  // Le suivi qui RESSEMBLE vient en premier : une règle « à peu près » le prendrait.
  const track = [
    { suivi: '6A1111111111X', status: 'delivered', at: '2026-11-01T08:00:00Z' },
    { suivi: '6A11111111111', status: 'available', at: '2026-11-06T08:00:00Z' },
    { suivi: '6A11111111111', status: 'delivered', at: '2026-11-07T08:00:00Z', retire: '2026-11-07T07:30:00Z' },
    { suivi: '6A22222222222', status: 'available', at: '2026-11-08T08:00:00Z' },
  ];
  const txnItem = { 9226: '7226', 9227: '7210', 9228: '7240' };
  const rnDe = (q, sur = {}) => N.toutSurLeNumero(q, { fiches, ventes: sur.ventesKO ? null : ventes, txnItem, bordereaux: bords.map((b) => ({ tx: b.tx, pdf: true })), enLigne: new Set(['7228']), pool: Object.values(fiches).map((f) => f.numero), plan: {}, lbcVentes: [], ebayCommandes: [], ebayAnnonces: [] },
    { cleNum, conflits: () => [], ouStock: () => null, aPoster: () => false, expediee: () => true, revenue: () => false }, ['', 'B']);
  const regles = { etapeVente: (o) => ({ label: 'Commande finalisée', step: 4 }), venteAnnulee: () => false };
  const fiche = (q, sur = {}) => {
    const rn = rnDe(q, sur);
    // La carte du colis porte TOUTES les ventes lues : la fiche doit y prendre la SIENNE.
    const txs = ventes.map((v) => String(v.transaction_id));
    const colisVente = sur.colisKO ? null : H.colisDesVentes({ txs, bords, track: sur.trackKO ? null : track, shipDone });
    return H.histoireArticle(rn, { fiches, saleOv: {}, buyByNum: {}, stats: {}, versements: { 9226: '2026-11-08T10:00:00Z' }, nomCompte: () => 'compte_banc', coffres: {}, offres: [], recus: new Set(), autresEnLigne: [], journalPrix: [], prixVinted: [], colisVente }, regles);
  };
  const etape = (p, k) => (p.etapes || []).find((e) => e.cle === k) || {};
  const evs = (p, k) => (etape(p, k).evenements || []);
  essaie('fiche 227', () => {
    const p = fiche('227');
    dit(!!p && p.num === '227', 'la fiche du N°227 s’ouvre');
    dit(p.resume.achat === 3600, 'SON achat : 36 € (le prix saisi sur SA fiche)', p.resume.achat);
    dit(evs(p, 'vente').map((e) => e.tx).join() === '9226', 'SA vente : la transaction 9226, aucune autre', evs(p, 'vente').map((e) => e.tx));
    const c = evs(p, 'colis');
    const b = c.find((e) => e.cle === 'bordereau');
    dit(b && /6A11111111111/.test(b.texte) && b.at === '2026-11-04T12:00:00.000Z', 'SON bordereau : SON n° de suivi, daté par SON e-mail', b);
    const d = c.find((e) => e.cle === 'depose');
    dit(d && d.at === '2026-11-05T09:00:00.000Z', 'déposé : SON clic « Colis fait », daté', d);
    const l = c.find((e) => e.cle === 'livre');
    dit(l && l.at === '2026-11-07T07:30:00.000Z' && /6A11111111111/.test(l.preuve), 'retiré par l’acheteur : l’e-mail du transporteur de CE suivi (date de retrait)', l);
    dit(!c.some((e) => e.at === '2026-11-01T08:00:00.000Z'), 'un suivi qui RESSEMBLE (6A1111111111X) n’entre jamais', c.map((e) => e.at));
    const bn = etape(p, 'benefice');
    dit(bn.etat === 'fait' && bn.montant === 3400 && /vente 70/.test(bn.detail) && /achat 36/.test(bn.detail), 'le bénéfice en dernière étape : +34 € = vente 70 € − achat 36 €', bn);
    dit((p.etapes || []).slice(-1)[0].cle === 'benefice', 'la frise se termine par le bénéfice', (p.etapes || []).map((e) => e.cle));
    dit(etape(p, 'argent').etat === 'fait', 'versement reçu : la transaction finalisée, datée', etape(p, 'argent'));
    dit(etape(p, 'vente').source && etape(p, 'vente').source.cible && etape(p, 'vente').source.cible.tx === '9226', '« Ouvrir dans Ventes » vise SA vente', etape(p, 'vente').source);
    dit(etape(p, 'colis').source && etape(p, 'colis').source.cible.tx === '9226', '« Ouvrir dans Colis » vise SON colis', etape(p, 'colis').source);
  });
  essaie('fiche 211 et 228', () => {
    const p = fiche('211');
    const c = evs(p, 'colis');
    dit(evs(p, 'vente').map((e) => e.tx).join() === '9227' && c.some((e) => /6A22222222222/.test(e.texte)) && !c.some((e) => /6A111/.test(e.texte + e.preuve)), 'le N°211 (même titre) : SA vente 9227, SON suivi, rien du N°227', c);
    const dep = c.find((e) => e.cle === 'depose');
    dit(dep && dep.at === null, 'un « Colis fait » sans date écrite : déposé, sans date inventée', dep);
    dit(!c.some((e) => e.cle === 'livre'), 'pas d’e-mail « retiré » pour CE suivi ⇒ pas de « retiré »');
    const q = fiche('228');
    dit(!evs(q, 'vente').length && !evs(q, 'colis').length && etape(q, 'colis').etat === 'absent', 'le N°228 (même titre, pas vendu) : aucune vente, aucun colis empruntés', [evs(q, 'vente'), evs(q, 'colis')]);
    dit(etape(q, 'benefice').etat === 'absent' && /rien de vendu/.test(etape(q, 'benefice').detail), 'pas vendue : bénéfice grisé (« rien de vendu »), jamais 0', etape(q, 'benefice'));
  });
  essaie('pas su', () => {
    const p = fiche('227', { colisKO: true });
    dit(/bordereau et suivi pas lus/.test(etape(p, 'colis').detail || ''), 'bordereaux illisibles ⇒ « bordereau et suivi pas lus », jamais « rien »', etape(p, 'colis'));
    const t = fiche('227', { trackKO: true });
    dit(/transporteur pas lus/.test(etape(t, 'colis').detail || '') && !evs(t, 'colis').some((e) => e.cle === 'livre'), 'e-mails du transporteur illisibles ⇒ dit, aucun « retiré » inventé', etape(t, 'colis'));
    const v = fiche('227', { ventesKO: true });
    dit(etape(v, 'benefice').etat === 'passu', 'ventes illisibles ⇒ bénéfice « pas su »', etape(v, 'benefice'));
    const fs2 = { ...fiches, 7226: { ...fiches[7226], buyPrice: '' } };
    const rn = N.toutSurLeNumero('227', { fiches: fs2, ventes, txnItem, bordereaux: [], enLigne: new Set(), pool: [], plan: {}, lbcVentes: [], ebayCommandes: [], ebayAnnonces: [] }, { cleNum, conflits: () => [], ouStock: () => null }, ['', 'B']);
    const s = H.histoireArticle(rn, { fiches: fs2, saleOv: {}, buyByNum: {}, stats: {}, versements: {}, colisVente: {} }, regles);
    dit(etape(s, 'benefice').etat === 'passu' && /prix d.achat pas saisi/.test(etape(s, 'benefice').detail), 'vendue sans prix d’achat ⇒ bénéfice « — » et le manque NOMMÉ', etape(s, 'benefice'));
  });

  // ── 5. LE BRANCHEMENT DANS L'APP (le code, sans ses commentaires) ────────
  essaie('app', () => {
    const a = sansCommentaires(src.app);
    dit(/factures, numerosTx, autres, messages: gsData \? gsData\.messages : null \}\)/.test(a), 'la loupe indexe les ventes hors Vinted et les conversations');
    dit(/\(e\.metaKey \|\| e\.ctrlKey\) && !e\.altKey && !e\.shiftKey && \(e\.key === 'k' \|\| e\.key === 'K'\)/.test(a), '⌘K / Ctrl+K ouvrent la loupe');
    dit(/clavierChamp\(e\)/.test(a) && /onKeyDown=\{clavierPanneau\}/.test(a), 'le champ et le panneau ont leur clavier (↑ ↓ Entrée)');
    dit(/colisVente: ex \? ex\.colisVente : undefined/.test(a) && /onSource=\{/.test(a), 'la fiche reçoit le colis de la vente et ouvre l’écran source');
    const conv = /lireTout\('id=like\.harvest_\*_conv_\*&select=([^']*)'/.exec(a);
    dit(conv && !/(^|,)data(,|$)/.test(conv[1]), 'les conversations de la loupe sont lues PROJETÉES (jamais `select=data`)', conv && conv[1]);
    const lc = /async function lireColisDesVentes[\s\S]*?\n\}/.exec(a);
    dit(lc && !/select=data|select=id,data/.test(lc[0]) && /meta->>transaction=in\./.test(lc[0]) && /meta->>suivi=in\./.test(lc[0]), 'le colis de la fiche : lu par SA transaction et SON suivi, en scalaires', lc && lc[0].slice(0, 120));
    const lecture = /useEffect\(\(\)=>\{ if\(!gsOpen \|\| gsData\) return;/.test(a);
    dit(lecture, 'la loupe ne lit qu’à son ouverture (aucun coût au démarrage)');
    dit(/data-recherche-compris=/.test(a) && /data-recherche-aide=/.test(a), 'le panneau dit ce qu’il a compris et ce qu’on peut taper');
  });

  console.log(`\n${ko ? '❌' : '✅'} ${n - ko}/${n} contrôles verts.`);
  process.exit(ko ? 1 : 0);
})();
