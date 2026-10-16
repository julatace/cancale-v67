// ⚠️⚠️ CONTRÔLE PERMANENT — LE RETRAIT AUTOMATIQUE D'eBAY EST LE PLUS STRICT
// (revue contradictoire des propositions 6, 8, 9, 10 — 6 octobre).
//
// Une annonce eBay terminée ne revient pas. L'alerte « à retirer d'eBay » peut
// se tromper sans dégât (c'est lui qui clique) ; le retrait AUTOMATIQUE, non.
// La revue l'a prouvé sur sa base, en exécutant le vrai code :
//   · une vente REMBOURSÉE comptait « prouvée vendue » : la ligne de
//     transaction gardait « Le paiement a été validé », la liste de ses ventes
//     (`orders_sold`) disait « Remboursement effectué » — 3 preuves sur 229
//     (N°198, 277, 382) ;
//   · un N° porté par DEUX fiches (13 N° hérités d'août) désignait la mauvaise
//     paire : l'annonce eBay de la paire NON vendue était retirée ;
//   · la coque ne lisait pas les annonces des comptes qu'il a écartés, et
//     retirait des « en vente » celles qu'un titre disait vendues ;
//   · la garde « nuage prêt » était regardée APRÈS les lectures, et
//     l'annulation du passage APRÈS l'appel à eBay ;
//   · cinq annonces déjà terminées prenaient les cinq places du passage, à
//     chaque ouverture : une vraie vente n'était jamais retirée.
//
// Ce contrôle EXÉCUTE les vraies fonctions extraites d'`App.jsx` dans un `vm`
// (les lectures de la base et l'appel à eBay sont simulés) et juge ce qu'elles
// RENDENT et ce qui PART vers `/api/ebay` (§6.5). Il complète le banc rendu
// `bancs/ebay-annonces.cjs`.
//
// `--prouve` réaffaiblit chaque garde tour à tour : chaque fois, au moins un
// contrôle doit passer au ROUGE. « La fonction n'existait pas avant » n'est pas
// une preuve (§6.1).
//
// ⚠️ (15 octobre) LA PREUVE DE VENTE A UN SEUL LECTEUR (§11) :
// `lirePreuvesVenteVinted`, dont `lireVentesVintedProuvees` n'est qu'une
// enveloppe. Le 13 octobre, le retrait automatique avait reçu un SECOND lecteur
// des transactions (sa propre règle, la liste des ventes lue par
// `fetchHarvestOrders`) : la coque retirait des paires que l'écran eBay jugeait
// « pas su ». La base simulée sert donc la forme que lit CE lecteur (lignes de
// transaction par leur identifiant, ventes par `id=in.(…orders_sold)` avec leur
// date de capture), et le contrôle « l'écran et la coque : le même verdict »
// juge les deux appelants sur la même base.
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = path.join(__dirname, '..');
const APP0 = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
let parser = null;
try { parser = require(path.join(R, 'node_modules', '@babel', 'parser')); } catch (_) {}

// Les déclarations de PREMIER NIVEAU portant ces noms, dans l'ordre du fichier.
function decls(APP, noms) {
  const want = new Set(noms), trouve = new Set(), out = [];
  const ast = parser.parse(APP, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  for (const n of ast.program.body) {
    let names = [];
    if (n.type === 'FunctionDeclaration' && n.id) names = [n.id.name];
    else if (n.type === 'VariableDeclaration') names = n.declarations.map((d) => d.id && d.id.name).filter(Boolean);
    if (names.some((x) => want.has(x))) { out.push(APP.slice(n.start, n.end)); names.forEach((x) => trouve.add(x)); }
  }
  return { src: out.join('\n'), manquants: noms.filter((x) => !trouve.has(x)) };
}
const NOMS = ['cleNum', 'NUM_OK', 'numDeSkuEbay','skuEbayDe','traductionAnnonce','numeroExterne','numEbayLu','numLigneEbay', 'CLE_COMPTE_EBAY', 'corpsCompteEbay', 'commandeEbayEngagee', 'doublesVenteEbay', 'PAS_UNE_VENTE',
  // (15 octobre) LE lecteur de la preuve (§11) : le bloc partagé avec
  // l'extension, le détail du retrait automatique, et l'enveloppe.
  'PREUVE_RECENTE_MS', 'venteVivante', 'venteEnCoursPreuve', 'ETAT_TXN_TERMINAL', 'preuvesParTransaction', 'preuvesParBordereau', 'comptesAJuger', 'ventesParCompteDe',
  'PAS_UN_RETOUR', 'etatRevient', 'capturesParCompte', 'detailPreuvesVinted', 'uidsDeComptes', 'lirePreuvesVenteVinted', 'lireVentesVintedProuvees', 'isOnlineListing', 'prixVinted', 'lireAnnoncesVintedEnLigne',
  'retraitsEbayAutoPermis', 'passageRetraitEbayAuto', 'EBAY_DEJA_TERMINEE', '__retraitEbayAutoEnVol', '__retraitEbayAutoTentes',
  'retirerEbayAuto', 'resultatReviseEbay', 'prixAchatDe', 'LISTE_VENTES_FRAICHE_MS', 'noterRetraitAutoIncertain'];

// Un contexte NEUF par scénario : `retirerEbayAuto` garde en mémoire, par
// ouverture de l'app, les annonces déjà tentées.
function charger(APP, env, dit) {
  const { src, manquants } = decls(APP, NOMS);
  const ctx = {archiveNumeros:()=>'',marqueurNumerotation:()=>null,coupureNumerotation:()=>null, console, Promise, Date, Math, JSON, Set, Map, Object, String, Number, Array, ...env };
  vm.createContext(ctx);
  try { vm.runInContext(src, ctx); } catch (e) { dit(false, 'les règles se chargent', String(e && e.message).slice(0, 140)); return null; }
  const R2 = {};
  for (const n of NOMS) { try { R2[n] = vm.runInContext(`typeof ${n} === 'undefined' ? undefined : ${n}`, ctx); } catch (_) { R2[n] = undefined; } }
  R2.manquants = manquants;
  return R2;
}

// ── LES DONNÉES (inventées, la FORME mesurée : §6.3) ───────────────────────
// (15 octobre) LA forme que lit LE lecteur (`lirePreuvesVenteVinted`) : la
// transaction par l'identifiant de sa ligne (`harvest_{uid}_txn_{tx}`) et ses
// scalaires de `meta` (`it`, `ti`, `at`, `cap`) ; la liste des ventes par
// `id=in.(harvest_{uid}_orders_sold)` (`v` = `my_orders`, `cap` = sa capture).
// Les comptes sont des uids NUMÉRIQUES, comme chez lui (la règle les lit dans
// l'identifiant de ligne). Le compte 222 n'a AUCUNE liste de ventes captée.
const UA = '111', UB = '222';
const txnL = (uid, tx, it, ti, at, cap) => ({ id: `harvest_${uid}_txn_${tx}`, it, ti, at, ...(cap ? { cap } : {}) });
const TXN = [
  txnL(UA, '501', 'I1', 'Le paiement a été validé', '2026-09-20T10:00:00+02:00'),            // REMBOURSÉE selon orders_sold
  txnL(UA, '502', 'I2', 'Commande annulée - article indisponible ', '2026-09-21T10:00:00+02:00'), // l'acheteur qui a perdu la course…
  txnL(UA, '503', 'I2', 'Commande finalisée - l\'acheteur a validé la commande', '2026-09-22T10:00:00+02:00'), // …et la vraie vente
  txnL(UA, '504', 'I3', '', null),                                                            // une conversation
  txnL(UB, '505', 'I4', 'Le paiement a été validé', '2026-09-23T10:00:00+02:00'),            // compte sans liste captée : pas confirmée
  txnL(UA, '506', 'I5', '', null),                                                            // captée en conversation, VENDUE depuis
  // La transaction relue APRÈS la liste des ventes (une conversation rouverte) :
  // c'est elle qui fait foi — elle dit « Remboursement effectué ».
  txnL(UA, '507', 'I6', 'Remboursement effectué', '2026-09-25T10:00:00+02:00', '2026-10-05T10:00:00.000Z'),
  // La liste relue après la transaction dit la vente finalisée — mais la
  // transaction « retour initié » ne prouve pas la vente (la règle partagée).
  txnL(UA, '508', 'I7', 'Retour initié', '2026-09-26T10:00:00+02:00', '2026-09-27T10:00:00.000Z'),
  // Une transaction relue APRÈS la liste, finalisée : la liste (plus ancienne)
  // ne la CONFIRME pas — c'est la transaction qui fait foi.
  txnL(UA, '509', 'I8', 'Commande finalisée', '2026-09-28T10:00:00+02:00', '2026-10-05T10:00:00.000Z'),
];
const VENTES_A = [
  { transaction_id: 501, status: 'Remboursement effectué', date: '2026-09-20T09:00:00+02:00' },
  { transaction_id: 503, status: 'Commande finalisée - l\'acheteur a validé la commande', date: '2026-09-21T12:00:00+02:00' },
  { transaction_id: 506, status: 'Commande finalisée - l\'acheteur a validé la commande', date: '2026-09-24T12:00:00+02:00' },
  { transaction_id: 507, status: 'Le paiement a été validé', date: '2026-09-25T10:00:00+02:00' },
  { transaction_id: 508, status: 'Commande finalisée - l\'acheteur a validé la commande', date: '2026-09-26T10:00:00+02:00' },
  { transaction_id: 509, status: 'Commande finalisée', date: '2026-09-28T10:00:00+02:00' },
];
// La liste des ventes du compte 111 a été captée le 1er octobre.
const CAP_A = Date.parse('2026-10-01T10:00:00.000Z');
// La fausse base, telle que `lireTout` la rend : chaque famille selon SA
// requête (§6.3). `ventes` : { uid: { v: [my_orders], cap: ISO } } — un compte
// absent n'a pas de liste captée.
const base = ({ txn = [], bords = [], ventes = {} } = {}, lus = null) => async (q) => {
  if (lus) lus.push(q);
  if (/_txn_/.test(q)) return txn.map((r) => ({ ...r }));
  if (/_label_/.test(q)) return bords.map((r) => ({ ...r }));
  const dans = /id=in\.\(([^)]*)\)/.exec(q);
  if (/orders_sold/.test(q) && dans) return dans[1].split(',').map((id) => { const u = (/^harvest_(\d+)_orders_sold$/.exec(id) || [])[1]; return u && ventes[u] ? { id, v: ventes[u].v, cap: ventes[u].cap } : null; }).filter(Boolean);
  return [];
};

async function controles(APP, journal) {
  let ko = 0;
  const dit = (ok, nom, det) => { if (!ok) ko++; if (journal) console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
  const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).slice(0, 160)); return null; } };
  if (!parser) { dit(false, '@babel/parser est disponible (node_modules)'); return ko; }

  // ── 1. LA PREUVE DE VENTE LIT L'ÉTAT LE PLUS FRAIS ─────────────────────────
  // Sur le code d'avant aussi : `lireVentesVintedProuvees` existait.
  await essaie('preuve de vente', async () => {
    const lus = [];
    const env = { lireTout: base({ txn: TXN, ventes: { [UA]: { v: VENTES_A, cap: new Date(CAP_A).toISOString() } } }, lus) };   // 222 : aucune liste captée
    const F = charger(APP, env, dit); if (!F) return;
    const v = await F.lireVentesVintedProuvees([{ vinted_user_id: UA }, { vinted_user_id: UB }]);
    const has = (x) => !!(v && typeof v.has === 'function' && v.has(x));
    dit(v && !has('I1'), 'une vente REMBOURSÉE selon la liste de ses ventes n\'est PAS « prouvée vendue » (la ligne de transaction était périmée)', JSON.stringify(v && [...v]));
    dit(has('I2'), '« annulée — article indisponible » à côté d\'une vente finalisée : la paire EST vendue (l\'acheteur qui a perdu la course)');
    dit(!has('I3'), 'une conversation (état vide) n\'est pas une vente');
    dit(has('I4'), 'un compte sans liste des ventes captée : sa transaction garde son état (rien n\'est retiré de la preuve)');
    // ⚠️ (15 octobre) La preuve est UNE règle, celle de l'extension et de l'écran
    // eBay (§11) : la liste des ventes CONFIRME ou DÉFAIT une preuve, elle n'en
    // crée pas à partir d'une conversation ou d'un « retour initié ». Le second
    // lecteur du 13 octobre les comptait vendues — la coque disait « à retirer »
    // une paire que l'écran eBay et l'extension ne disaient pas vendue.
    dit(v && !has('I5') && !has('I7'), 'une transaction captée en conversation, ou « retour initié », ne prouve pas la vente même quand la liste la dit faite — la MÊME règle que l\'extension et l\'écran eBay (§11)', JSON.stringify(v && [...v]));
    dit(v && !has('I6'), 'la transaction relue APRÈS la liste des ventes fait foi : elle dit « remboursée », la paire n\'est pas vendue (l\'état le plus frais, pas toujours celui de la liste)', JSON.stringify(v && [...v]));
    const rv = v && v.revenues;
    dit(!!(rv && typeof rv.has === 'function') && rv.has('I1') && rv.has('I7') && !rv.has('I2') && !rv.has('I5'),
      'la preuve dit quelles annonces sont revenues AU MOINS UNE FOIS, d\'après l\'une ou l\'autre source (remboursée, retour) — pas l\'acheteur qui a perdu la course', JSON.stringify(rv && [...rv]));
    const p = v && v.preuves;
    dit(!!(p && typeof p.get === 'function'), 'la preuve porte son détail (`.preuves`) — le retrait automatique en a besoin');
    if (p && typeof p.get === 'function') {
      const i2 = (p.get('I2') || []).find((x) => x.frais);
      dit((p.get('I4') || []).length > 0 && (p.get('I4') || []).every((x) => !x.frais) && !!i2 && i2.compte === UA && i2.cap === CAP_A,
        'et dit d\'où vient chaque état : confirmé par la liste des ventes (son compte, sa date de capture), ou de la seule transaction', JSON.stringify({ I2: p.get('I2'), I4: p.get('I4') }).slice(0, 240));
      dit(has('I8') && (p.get('I8') || []).length > 0 && (p.get('I8') || []).every((x) => !x.frais),
        'une transaction relue APRÈS la liste : la liste, plus ancienne, ne la CONFIRME pas (c\'est la transaction qui fait foi)', JSON.stringify(p.get('I8')));
    }
    const qTxn = lus.find((q) => /_txn_/.test(q)) || '', qVentes = lus.find((q) => /orders_sold/.test(q)) || '';
    dit(/select=id,/.test(qTxn) && /cap:meta->>capturedAt/.test(qTxn) && !/select=[^&]*\bdata\b(?!->)/.test(qTxn), 'la lecture des transactions projette leur identifiant (le n° de transaction) et leur date de capture (§4.4 : des scalaires, jamais `data`)', qTxn);
    dit(/cap:meta->>capturedAt/.test(qVentes) && /v:data->payload->my_orders/.test(qVentes), 'et celle des ventes, la liste ET sa date de capture (le retrait automatique exige une liste récente)', qVentes);
    const F2 = charger(APP, { lireTout: async () => null }, dit);
    if (F2) dit((await F2.lireVentesVintedProuvees([{ vinted_user_id: UA }])) === null, 'transactions illisibles ⇒ `null` (« pas su »), jamais un ensemble vide');
    // La liste des ventes dont une preuve DÉPEND (une transaction à un état non
    // terminal) ne répond pas : « pas su », jamais une demi-preuve.
    const F3 = charger(APP, { lireTout: async (q) => (/orders_sold/.test(q) ? null : base({ txn: TXN })(q)) }, dit);
    if (F3) dit((await F3.lireVentesVintedProuvees([{ vinted_user_id: UA }])) === null, 'liste des ventes à juger illisible ⇒ `null` (« pas su »)');
  });

  await essaie('bordereaux confirmés par le même compte', async () => {
    const bords = [{id:'harvest_111_label_10',tx:'10',it:'100'}, {id:'harvest_222_label_10',tx:'10',it:'200'}, {id:'harvest_111_label_11',tx:'12',it:'300'}, {id:'harvest_111_label_12',tx:'12',it:'400'}, {id:'harvest_111_label_13',tx:'13',it:'500'},
      // La N°600 : un acheteur a perdu la course (« article indisponible »,
      // classée `failed`), l'autre l'a achetée — elle n'est PAS revenue.
      {id:'harvest_111_label_14',tx:'14',it:'600'}, {id:'harvest_111_label_15',tx:'15',it:'600'}];
    const F = charger(APP, {
      lireTout: base({ bords, ventes: { 111: { cap: new Date().toISOString(), v: [{transaction_id:10,status:'Le paiement a été validé',date:new Date().toISOString()},{transaction_id:12,status:'Commande annulée',date:new Date().toISOString()},{transaction_id:13,status:'Le paiement a été validé',transaction_user_status:'failed',date:new Date().toISOString()},{transaction_id:14,status:'Commande annulée - article indisponible',transaction_user_status:'failed',date:new Date().toISOString()},{transaction_id:15,status:'Le paiement a été validé',date:new Date().toISOString()}] } } }),   // 222 : aucune liste captée
    }, dit);
    const v = await F.lireVentesVintedProuvees([{vinted_user_id:'111'},{vinted_user_id:'222'}]);
    dit(v.has('100') && v.preuves.get('100')[0].frais && v.preuves.get('100')[0].compte === '111', 'bordereau seul et vente récente du même compte : preuve stricte');
    dit(!v.has('200'), 'même transaction sur un autre compte (sans liste captée) : aucune preuve');
    dit(!v.has('300'), 'transaction du bordereau contradictoire : aucune preuve');
    dit(!v.has('500') && v.revenues.has('500'), 'vente classée en échec malgré son titre : aucun retrait');
    dit(!v.has('400') && v.revenues.has('400'), 'vente annulée : la paire est revenue, aucun retrait');
    dit(v.has('600') && !v.revenues.has('600'), 'l\'acheteur qui a perdu la course (« article indisponible », même classé `failed`) ne fait pas revenir une paire vendue à un autre', JSON.stringify({ vendue: v.has('600'), revenue: v.revenues.has('600') }));
  });

  // ── 2. LES ANNONCES EN VENTE : TOUS SES COMPTES, ÉCARTÉS COMPRIS ──────────
  await essaie('annonces en vente', async () => {
    const LIST = {
      A: { items: [{ id: 101, is_closed: false, price: { amount: '49.0', currency_code: 'EUR' } }, { id: 102, is_closed: true }] },
      X: { items: [{ id: 901, is_closed: false }] },   // un compte qu'il a EXCLU : la paire y est en vente
    };
    const F = charger(APP, { fetchHarvest: async (uid) => LIST[uid] || null }, dit); if (!F || !F.lireAnnoncesVintedEnLigne) { dit(false, '`lireAnnoncesVintedEnLigne` existe (une lecture partagée par l\'écran eBay et la coque, §11)'); return; }
    const r = await F.lireAnnoncesVintedEnLigne([{ vinted_user_id: 'A' }, { vinted_user_id: 'X' }]);
    dit(r && r.enLigne && r.enLigne.has('101') && r.enLigne.has('901') && !r.enLigne.has('102') && r.toutesLues === true,
      'une paire en vente sur un compte EXCLU est en vente (l\'exclusion règle l\'affichage) ; une fermée ne l\'est pas', JSON.stringify(r && { e: [...(r.enLigne || [])], t: r.toutesLues }));
    // (15 octobre) la même lecture rend le prix de l'annonce en vente (l'écran
    // eBay le reprend) — `prixVinted`, la règle de prix de l'extension (§11).
    if (r && r.prix) dit(r.prix['101'] === 49 && !('102' in r.prix), 'le prix d\'une annonce en vente est lu (49 €) ; une fermée n\'en a pas', JSON.stringify(r.prix));
    const r2 = await F.lireAnnoncesVintedEnLigne([{ vinted_user_id: 'A' }, { vinted_user_id: 'Y' }]);
    dit(r2 && r2.enLigne && r2.enLigne.has('101') && r2.toutesLues === false, 'un compte illisible ⇒ `toutesLues` faux (le retrait automatique ne partira pas)', JSON.stringify(r2 && { t: r2.toutesLues }));
  });

  // ── 3. LA RÈGLE LA PLUS STRICTE, ET LE PASSAGE ─────────────────────────────
  const D_VENTE = '2026-10-01T12:00:00+02:00';
  const numeros = {
    '7022': { numero: '22' },                          // vendue, confirmée, eBay mis en ligne AVANT ⇒ part
    '7026': { numero: '26' },                          // vente REMBOURSÉE
    '7027': { numero: '27' },                          // eBay mis en ligne APRÈS la vente
    '7028': { numero: '28' }, '8028': { numero: '28' }, // N° porté par DEUX fiches
    '7029': { numero: '29' },                          // vente pas confirmée par la liste des ventes
    '7030': { numero: '30' },                          // date de mise en ligne eBay inconnue
    '7031': { numero: '31' },                          // eBay la dit déjà terminée
    '7032': { numero: '32' },                          // une seconde vente sûre (passage annulé en cours)
    '7033': { numero: '33' },                          // revenue une fois (retour), revendue ensuite
  };
  const txn = [
    txnL(UA, '622', '7022', 'Commande finalisée', D_VENTE),
    txnL(UA, '626', '7026', 'Le paiement a été validé', D_VENTE),
    txnL(UA, '627', '7027', 'Commande finalisée', D_VENTE),
    txnL(UA, '628', '7028', 'Commande finalisée', D_VENTE),
    txnL(UA, '629', '7029', 'Le paiement a été validé', D_VENTE),
    txnL(UA, '630', '7030', 'Commande finalisée', D_VENTE),
    txnL(UA, '631', '7031', 'Commande finalisée', D_VENTE),
    txnL(UA, '632', '7032', 'Commande finalisée', D_VENTE),
    // La N°33 : vendue, RETOURNÉE (« retour initié »), puis revendue.
    txnL(UA, '633', '7033', 'Retour initié', D_VENTE),
    txnL(UA, '634', '7033', 'Commande finalisée', D_VENTE),
  ];
  const fini = { status: 'Commande finalisée', date: D_VENTE };
  const ventes = [622, 627, 628, 630, 631, 632, 634].map((t) => ({ transaction_id: t, ...fini })).concat([{ transaction_id: 626, status: 'Remboursement effectué', date: D_VENTE }, { transaction_id: 633, status: 'Retour initié', date: D_VENTE }]);
  const avant = '2026-09-15T10:00:00.000Z', apres = '2026-10-02T10:00:00.000Z';
  const annonce = (n, depuis, fin) => ({ itemId: '1100000000' + n, sku: 'VRM-' + n, title: 'Paire ' + n, depuis, ...(fin ? { fin } : {}) });
  const ANNONCES = [annonce(22, avant), annonce(26, avant), annonce(27, apres), annonce(28, avant), annonce(29, avant), annonce(30, ''), annonce(31, avant, '2026-10-03T00:00:00.000Z'), annonce(32, avant), annonce(33, avant)];
  const MAINTENANT = Date.parse('2026-10-06T12:00:00Z');
  const scenario = async (quoi, opts) => {
    const appels = [], toasts = [];
    const env = {
      // (revue du 8 octobre) La liste des ventes du compte 111 a été captée il y
      // a 2 h — sauf scénario « liste ancienne ».
      lireTout: base({ txn, ventes: { [UA]: { v: ventes, cap: new Date(opts.capListe != null ? opts.capListe : MAINTENANT - 2 * 3600000).toISOString() } } }),
      enTeteSession: () => ({}), toast: (m) => toasts.push(String(m)),
      fetch: async (u, o) => { const b = JSON.parse(o.body); appels.push(b); if (opts.apresAppel) opts.apresAppel(appels); return {ok:true,status:200,json: async () => (opts.reponse ? opts.reponse(b) : { ok: true }) }; },
    };
    const F = charger(APP, env, dit); if (!F) return null;
    if (!F.passageRetraitEbayAuto) { dit(false, `${quoi} : \`passageRetraitEbayAuto\` existe (le passage de la coque, exécutable)`); return null; }
    const vendus = await F.lireVentesVintedProuvees([{ vinted_user_id: UA }]);
    const res = await F.passageRetraitEbayAuto({
      nuageAuDepart: opts.nuage !== false, continuer: opts.continuer || (() => true),
      annonces: opts.annonces || ANNONCES, commandes: [], enLigne: new Set(), toutesLues: opts.toutesLues !== false,
      vendusVinted: vendus, lireNumeros: () => opts.numeros || numeros, maintenant: MAINTENANT,
      ...('bloques' in opts ? (opts.bloques === undefined ? {} : { comptesBloques: opts.bloques }) : { comptesBloques: new Set() }),
    });
    return { res, appels, toasts };
  };
  // ── 3 avant. (15 octobre) L'ÉCRAN eBAY ET LA COQUE : LE MÊME VERDICT (§11).
  //    La coque lisait la preuve par SON lecteur (avec le détail), l'écran par
  //    `lirePreuvesVenteVinted` (sans) : l'écran disait « je n'ai pas pu tout
  //    vérifier » sur chaque paire pendant que la coque retirait. Les deux
  //    lectures, telles que chacun les fait, doivent rendre le même verdict.
  await essaie('écran et coque : le même verdict', async () => {
    const F = charger(APP, { lireTout: base({ txn, ventes: { [UA]: { v: ventes, cap: new Date(MAINTENANT - 2 * 3600000).toISOString() } } }) }, dit);
    if (!F || !F.lirePreuvesVenteVinted) return;
    const verdict = (vendus) => {
      const dv = F.doublesVenteEbay({ annonces: ANNONCES, commandes: [], numeros, enLigne: new Set(), vendusVinted: vendus, programmees: [], ventes: null });
      const r = F.retraitsEbayAutoPermis({ aRetirerEbay: dv.aRetirerEbay, numeros, vendusVinted: vendus, toutesLues: true, comptesBloques: new Set(), maintenant: MAINTENANT });
      return JSON.stringify({ permis: r.permis.map((d) => d.numero).sort(), ecartes: r.ecartes.map((e) => `${e.numero}:${e.raison}`).sort() });
    };
    const coque = verdict(await F.lireVentesVintedProuvees([{ vinted_user_id: UA }]));
    // L'écran : les comptes non écartés pour « pas reliées », TOUS pour confirmer.
    const p = await F.lirePreuvesVenteVinted({ comptes: [UA], confirmer: [{ vinted_user_id: UA }] });
    const ecran = verdict(p ? p.vendus : null);
    dit(coque === ecran && /"22"/.test(ecran), 'l\'écran eBay et la coque rendent le MÊME verdict de retrait automatique (une lecture, une règle)', `coque ${coque} · écran ${ecran}`);
  });
  await essaie('passage normal', async () => {
    const s = await scenario('passage normal', {});
    if (!s) return;
    const ids = s.appels.map((b) => b.itemId);
    dit(JSON.stringify(ids) === '["110000000022","110000000032"]',
      'ne partent QUE les paires sûres : vendue, confirmée par la liste des ventes, N° porté par une seule fiche, annonce eBay mise en ligne AVANT la vente', JSON.stringify(ids));
    dit(!ids.includes('110000000026'), 'une vente REMBOURSÉE ne retire rien');
    dit(!ids.includes('110000000028'), 'un N° porté par DEUX fiches ne retire rien (il désignerait peut-être l\'autre paire)');
    dit(!ids.includes('110000000027'), 'une annonce eBay mise en ligne APRÈS la vente (remise en vente voulue) ne se retire pas toute seule');
    dit(!ids.includes('110000000029'), 'une vente que la liste des ventes ne confirme pas ne retire rien');
    dit(!ids.includes('110000000030'), 'une date de mise en ligne eBay inconnue ne retire rien');
    dit(!ids.includes('110000000031'), 'une annonce qu\'eBay dit déjà terminée ne prend pas de place');
    dit(!ids.includes('110000000033'), 'une paire revenue au moins une fois (une transaction « retour initié »), puis revendue, ne se retire pas toute seule');
    dit(s.appels.every((b) => b.action === 'retirer' && b.auto === true && b.confirme === true && /^VRM-\d+$/.test(b.sku)), 'chaque envoi : {action:retirer, auto:true, confirme:true, sku VRM-n°}', JSON.stringify(s.appels[0]));
    const raisons = (s.res && s.res.ecartes || []).map((e) => `${e.numero}:${e.raison}`).sort().join(',');
    dit(/27:ebay-apres-vente/.test(raisons) && /28:numero-partage/.test(raisons) && /29:vente-non-confirmee/.test(raisons) && /30:date-pas-sue/.test(raisons) && /31:deja-terminee/.test(raisons) && /33:revenue-une-fois/.test(raisons),
      'chaque paire écartée l\'est pour SA raison', raisons);
  });
  // ── 3 bis. (revue du 8 octobre) UNE LISTE DE VENTES ANCIENNE, UN COMPTE
  //    BLOQUÉ : la « confirmation » ne confirme plus rien. Reproduit par la
  //    revue : une liste captée il y a 60 jours sur un compte que Vinted a
  //    bloqué (capture figée) terminait l'annonce eBay. ─────────────────────
  await essaie('liste des ventes ancienne', async () => {
    const s = await scenario('liste ancienne', { capListe: MAINTENANT - 60 * 86400000 }); if (!s) return;
    dit(s.appels.length === 0, 'une liste de ventes captée il y a 60 jours ne confirme rien : rien ne part (elle ne sait pas si la vente a été remboursée depuis)', JSON.stringify(s.appels.map((b) => b.itemId)));
    const r = (s.res && s.res.ecartes || []).filter((e) => e.numero === '22' || e.numero === '32').map((e) => e.raison);
    dit(r.length === 2 && r.every((x) => x === 'liste-perimee'), 'et la raison est dite : « liste-perimee »', JSON.stringify(r));
    const s2 = await scenario('liste de 47 h', { capListe: MAINTENANT - 47 * 3600000 }); if (!s2) return;
    dit(s2.appels.length === 2, 'l\'autre sens : une liste relue il y a 47 h confirme (la borne est 48 h)', `${s2.appels.length} envoi(s)`);
  });
  await essaie('compte bloqué par Vinted', async () => {
    const s = await scenario('compte bloqué', { bloques: new Set([UA]) }); if (!s) return;
    dit(s.appels.length === 0, 'une vente sur un compte que Vinted a BLOQUÉ (capture figée pour toujours) ne retire rien', JSON.stringify(s.appels.map((b) => b.itemId)));
    const r = (s.res && s.res.ecartes || []).filter((e) => e.numero === '22').map((e) => e.raison);
    dit(r[0] === 'compte-bloque', 'et la raison est dite : « compte-bloque »', JSON.stringify(r));
    const s2 = await scenario('comptes bloqués inconnus', { bloques: undefined }); if (!s2) return;
    dit(s2.appels.length === 0, 'la liste des comptes bloqués pas fournie (pas su) ⇒ rien ne part', `${s2.appels.length} envoi(s)`);
    const s3 = await scenario('un AUTRE compte bloqué', { bloques: new Set(['Z']) }); if (!s3) return;
    dit(s3.appels.length === 2, 'l\'autre sens : un autre compte bloqué n\'empêche rien ici', `${s3.appels.length} envoi(s)`);
  });
  await essaie('nuage pas prêt', async () => {
    const s = await scenario('nuage pas prêt', { nuage: false }); if (!s) return;
    dit(s.appels.length === 0, 'le nuage n\'était pas là au DÉPART du passage ⇒ rien ne part', `${s.appels.length} envoi(s)`);
  });
  await essaie('passage annulé', async () => {
    const s = await scenario('passage annulé', { continuer: () => false }); if (!s) return;
    dit(s.appels.length === 0, 'passage annulé (ou interrupteur éteint) avant le premier appel ⇒ rien ne part', `${s.appels.length} envoi(s)`);
    let arret = false;
    const s2 = await scenario('passage annulé en cours', { continuer: () => !arret, apresAppel: () => { arret = true; } }); if (!s2) return;
    dit(s2.appels.length === 1, 'annulé APRÈS le premier appel ⇒ le second ne part pas (relu avant CHAQUE appel)', `${s2.appels.length} envoi(s)`);
  });
  await essaie('annonces pas toutes lues', async () => {
    const s = await scenario('annonces pas toutes lues', { toutesLues: false }); if (!s) return;
    dit(s.appels.length === 0, 'une annonce Vinted illisible (un compte n\'a pas répondu) ⇒ rien ne part', `${s.appels.length} envoi(s)`);
  });
  await essaie('fiches relues', async () => {
    const s = await scenario('fiches relues', { numeros: { ...numeros, '9022': { numero: '22' }, '9032': { numero: '32' } } }); if (!s) return;
    dit(s.appels.length === 0, 'les fiches RELUES juste avant (un N° donné à une seconde paire pendant le passage) ⇒ rien ne part', `${s.appels.length} envoi(s)`);
  });
  await essaie('déjà terminées', async () => {
    // Six paires sûres ; eBay dit les cinq premières déjà closes (la synchro ne
    // les a pas encore sorties). La sixième, une vraie vente, doit partir.
    const nums = {}, tx = [], vts = [], ann = [];
    for (let k = 41; k <= 46; k++) { nums['70' + k] = { numero: String(k) }; tx.push({ tx: '6' + k, it: '70' + k, ti: 'Commande finalisée', at: D_VENTE }); vts.push({ transaction_id: Number('6' + k), ...fini }); ann.push(annonce(k, avant)); }
    const appels = [], toasts = [];
    const F = charger(APP, {
      lireTout: async () => tx, fetchHarvestOrders: async () => ({ my_orders: vts }), enTeteSession: () => ({}), toast: (m) => toasts.push(String(m)),
      fetch: async (u, o) => { const b = JSON.parse(o.body); appels.push(b.itemId); const k = Number(String(b.itemId).slice(-2)); return {ok:true,status:200,json: async () => (k <= 45 ? { ok: false, error: 'eBay : The auction has already been closed.' } : { ok: true, journal: false }) }; },
    }, dit);
    if (!F || !F.retirerEbayAuto) return;
    const liste = ann.map((a) => ({ annonce: a, numero: numDe(a.sku) }));
    await F.retirerEbayAuto(liste, () => true);
    dit(appels.includes('110000000046'), 'cinq annonces qu\'eBay dit déjà terminées ne prennent pas les cinq places : la vraie vente part', JSON.stringify(appels));
    dit(toasts.some((t) => /historique/.test(t)), 'un retrait fait mais pas noté dans l\'historique (journal:false) : c\'est dit', JSON.stringify(toasts));
  });
  // ── 3 ter. (revue du 8 octobre) UN RETRAIT PEUT-ÊTRE FAIT EN SON NOM SE DIT.
  //    eBay répond 504 « incertain » (ou la connexion coupe) : l'annonce a pu
  //    être terminée. Avant : aucune trace, ni message ni note. ───────────────
  await essaie('retrait incertain', async () => {
    const issues = [
      ['504 « incertain »', async () => ({ status: 504, json: async () => ({ ok: false, reason: 'incertain', error: 'eBay n\'a pas répondu — je ne sais pas si l\'annonce a été retirée.' }) })],
      ['page d\'erreur (HTML)', async () => ({ status: 504, json: async () => { throw new Error('pas du JSON'); } })],
      ['coupure', async () => { throw new Error('Failed to fetch'); }],
    ];
    for (const [quoi, rep] of issues) {
      const toasts = [], store = {};
      const F = charger(APP, {
        enTeteSession: () => ({}), toast: (m) => toasts.push(String(m)),
        load: (k, d) => (k in store ? store[k] : d), localStorage: { setItem: (k, v) => { store[k] = JSON.parse(v); }, getItem: (k) => (k in store ? JSON.stringify(store[k]) : null) },
        fetch: rep,
      }, dit);
      if (!F || !F.retirerEbayAuto) return;
      await F.retirerEbayAuto([{ annonce: annonce(22, avant), numero: '22' }], () => true);
      dit(toasts.some((t) => /N°22/.test(t) && /je ne sais pas/.test(t) && /regarde sur eBay/.test(t)), `${quoi} : un message dit qu'on ne sait pas si l'annonce a été retirée, et quoi faire`, JSON.stringify(toasts));
      const note = store.vrm_ebay_auto_incertains && store.vrm_ebay_auto_incertains['110000000022'];
      dit(!!(note && note.numero === '22' && Number.isFinite(note.at)), `${quoi} : et c'est noté sur l'appareil (l'écran eBay le redit sur sa ligne)`, JSON.stringify(store));
    }
    const toasts = [];
    const F = charger(APP, { enTeteSession: () => ({}), toast: (m) => toasts.push(String(m)), load: (k, d) => d, localStorage: { setItem: () => {} },
      fetch: async () => ({ ok:false,status:409,json: async () => ({ ok: false, reason: 'sku-change', error: 'Le SKU de cette annonce a changé chez eBay.' }) }) }, dit);
    if (!F || !F.retirerEbayAuto) return;
    await F.retirerEbayAuto([{ annonce: annonce(22, avant), numero: '22' }], () => true);
    dit(toasts.some((t) => /N°22/.test(t) && /pas été retirée/.test(t) && /SKU/.test(t) && /à retirer/.test(t)), 'un refus CERTAIN se dit aussi, avec sa raison (elle reste dans « à retirer »)', JSON.stringify(toasts));
    // (8 octobre, vérification de la reprise) Un refus qui vient de VRM et pas
    // d'eBay — réglage éteint côté serveur, « rien n'a été envoyé à eBay » —
    // ne s'attribue pas à eBay : le message se contredisait (« eBay a refusé
    // (… rien n'a été envoyé à eBay) »).
    const t2 = [];
    const F2 = charger(APP, { enTeteSession: () => ({}), toast: (m) => t2.push(String(m)), load: (k, d) => d, localStorage: { setItem: () => {} },
      fetch: async () => ({ ok:false,status:403,json: async () => ({ ok: false, reason: 'auto-eteint', error: 'Le retrait automatique est éteint — rien n\'a été envoyé à eBay.' }) }) }, dit);
    if (!F2 || !F2.retirerEbayAuto) return;
    await F2.retirerEbayAuto([{ annonce: annonce(22, avant), numero: '22' }], () => true);
    dit(t2.some((t) => /N°22/.test(t) && /éteint/.test(t)) && !t2.some((t) => /eBay a refusé/i.test(t)),
      'un refus venu de VRM (réglage éteint, rien envoyé à eBay) dit SA raison, sans l\'attribuer à eBay', JSON.stringify(t2));
  });

  // ── 4. CHANGER UN PRIX SUR eBAY : TROIS ISSUES (proposition 9) ─────────────
  await essaie('changer un prix', async () => {
    const F = charger(APP, {}, dit); if (!F || !F.resultatReviseEbay) { dit(false, '`resultatReviseEbay` existe (une règle pour les deux endroits qui changent un prix)'); return; }
    const a = F.resultatReviseEbay({ code: 504, j: { ok: false, reason: 'incertain', error: 'eBay n\'a pas répondu clairement — je ne sais pas si le prix a changé.' } });
    const b = F.resultatReviseEbay({ code: 504, j: null });   // la page d'erreur de Vercel, en HTML
    const c = F.resultatReviseEbay({ code: 0, j: null });     // réseau coupé : la requête a pu arriver
    const d = F.resultatReviseEbay({ code: 422, j: { ok: false, error: 'Prix refusé par eBay' } });
    dit(a.etat === 'incertain' && b.etat === 'incertain' && c.etat === 'incertain', 'une réponse « incertain », illisible ou coupée ⇒ « je ne sais pas si le prix a changé », jamais « rien n\'a changé »', JSON.stringify([a.etat, b.etat, c.etat]));
    dit(!/rien n.a chang/.test(a.msg + b.msg + c.msg) && /je ne sais pas/.test(b.msg), 'et le message ne promet rien', b.msg);
    dit(d.etat === 'ko' && /Prix refusé/.test(d.msg), 'un VRAI refus d\'eBay reste un refus, avec la raison d\'eBay', JSON.stringify(d));
    dit(F.prixAchatDe({ numero: '385' }, { 385: '15' }) === 15 && F.prixAchatDe({ numero: '385', buyPrice: '12,5' }, { 385: '15' }) === 12.5 && F.prixAchatDe({ numero: '9' }, {}) === null,
      'le prix d\'achat : celui de la fiche, sinon celui saisi par N° (la lecture de la carte, §11) ; inconnu ⇒ rien d\'inventé');
  });

  // ── 5. LE BRANCHEMENT DANS LA COQUE ET L'ÉCRAN eBAY (§11) ──────────────────
  // Le comportement est jugé au-dessus ; ici, que les deux appelants passent
  // bien par ces règles, avec TOUS ses comptes.
  const sansCommentaires = APP.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  const iCoque = sansCommentaires.indexOf('const nuageAuDepart = isCloudReady();');
  const iEffet = sansCommentaires.lastIndexOf('let cancelled=false;', iCoque);
  const premierAwait = iEffet >= 0 ? sansCommentaires.indexOf('await ', iEffet) : -1;
  dit(iCoque > 0 && iEffet > 0 && iCoque < premierAwait, 'la coque note si le nuage était là AVANT toute lecture du passage (`nuageAuDepart`, avant le premier `await`)');
  dit(/passageRetraitEbayAuto\(\{\s*nuageAuDepart,\s*continuer:\(\)=>!cancelled && load\('vrm_ebay_retrait_auto',false\)===true/.test(sansCommentaires),
    'la coque lance LE passage, avec l\'annulation du passage et l\'interrupteur relus avant chaque appel');
  dit(/lireAnnoncesVintedEnLigne\(vintedAccounts\)/.test(sansCommentaires) && /lireVentesVintedProuvees\(vintedAccounts\)/.test(sansCommentaires),
    'la coque lit les annonces en vente et la preuve sur TOUS ses comptes (écartés compris), comme l\'écran eBay');
  dit(/lirePreuvesVenteVinted\(/.test(sansCommentaires) && /await lireAnnoncesVintedEnLigne\(comptes\)/.test(sansCommentaires),
    'l\'écran eBay lit avec les MÊMES fonctions (une règle, deux lecteurs)');
  // (15 octobre) Et il CONFIRME la preuve avec tous ses comptes liés, comme la
  // coque : sans le détail, il jugeait le retrait automatique « pas su » sur
  // chaque paire pendant que la coque, elle, retirait.
  {
    // L'appel de l'écran est celui qui demande aussi la ligne « pas reliées »
    // (`comptes:`) : celui-là doit demander le détail (`confirmer:`).
    const appels = [...sansCommentaires.matchAll(/lirePreuvesVenteVinted\(\{([^}]*)\}\)/g)].map((m) => m[1]);
    const ecran = appels.filter((c) => /\bcomptes\s*:/.test(c));
    dit(ecran.length > 0 && ecran.every((c) => /\bconfirmer\s*:/.test(c)) && /uidsDeComptes\(comptes\)/.test(sansCommentaires),
      'l\'écran eBay demande le détail de la preuve (`confirmer`) sur tous ses comptes liés, comme la coque (§11)', JSON.stringify(ecran));
  }
  dit(!/retirerEbayAuto\(dvE\./.test(sansCommentaires), 'plus aucun retrait automatique lancé directement sur la liste de l\'alerte (sans la règle stricte)');
  dit(/comptesBloques:comptesBloquesVinted\(\)/.test(sansCommentaires), 'la coque passe les comptes que Vinted a bloqués (`vinted_accounts_blocked`) au passage');
  return ko;
}
const numDe = (sku) => (/^VRM-(\d+)$/.exec(sku) || [])[1] || '';

const PROUVE = process.argv.includes('--prouve');
(async () => {
  if (!PROUVE) {
    const ko = await controles(APP0, true);
    console.log(ko ? `\n❌ retrait automatique d'eBay : ${ko} rouge(s)` : '\n✅ retrait automatique d\'eBay : seulement les paires sûres — vente confirmée et pas remboursée, N° d\'une seule fiche, annonce eBay antérieure, tout lu, nuage là au départ, passage pas annulé');
    process.exit(ko ? 1 : 0);
  }
  const MUTATIONS = [
    ['la preuve sans la liste des ventes (état périmé)', 'const parTx = preuvesParTransaction(rows, parCompte);', 'const parTx = preuvesParTransaction(rows);'],
    ['la confirmation sans la liste des ventes', 'const lu = tx ? lues.get(tx) : null;', 'const lu = null;'],
    ['une vente « failed » pas comptée revenue', "(etatRevient(s) || String(o.transaction_user_status || '') === 'failed')", 'etatRevient(s)'],
    ['l\'écran sans le détail de la preuve', ", confirmer: avecSku ? comptesConfirmer : null }).then(", " }).then("],
    ['N° porté par plusieurs fiches accepté', "if (ids.length !== 1) { ecarte('numero-partage'); continue; }", ''],
    ['vente non confirmée acceptée', '.filter((v) => v && v.frais);', '.filter((v) => v);'],
    ['annonce eBay postérieure à la vente acceptée', "if (!(tEbay < tVente)) { ecarte('ebay-apres-vente'); continue; }", ''],
    ['date inconnue acceptée', "if (!Number.isFinite(tVente) || !Number.isFinite(tEbay)) { ecarte('date-pas-sue'); continue; }", ''],
    ['nuage pas prêt ignoré', "if (!nuageAuDepart) return { lance: false, raison: 'nuage'", "if (false) return { lance: false, raison: 'nuage'"],
    ['annulation relue seulement au départ', "if (typeof continuer === 'function' && !continuer()) break;", ''],
    ['un compte illisible compté « lu »', 'toutesLues: okAny && toutes', 'toutesLues: okAny'],
    ['« déjà terminée » prend une place', '/* déjà close : ne prend pas une des 5 places */', 'n += 1;'],
    ['la transaction plus fraîche ignorée (la liste gagne toujours)', 'if (Number.isFinite(capTx) && Number.isFinite(cap) && capTx > cap) return null;', ''],
    ['une paire revenue une fois acceptée', "if (revenues.has(ids[0])) { ecarte('revenue-une-fois'); continue; }", ''],
    ['« article indisponible » compté comme un retour', 'const PAS_UN_RETOUR = /indisponible|[ée]chou/i;', 'const PAS_UN_RETOUR = /(?!)/;'],
    ['« incertain » lu comme un refus', "if (code === 0 || !j || code === 504 || (j && j.reason === 'incertain')) {", 'if (false) {'],
    // (revue du 8 octobre)
    ['une liste de ventes ancienne confirme', 'const fraiches = confirmees.filter((v) => Number.isFinite(v.cap) && maintenant - v.cap <= LISTE_VENTES_FRAICHE_MS);', 'const fraiches = confirmees;'],
    ['un compte bloqué accepté', "if (confirmees.some((v) => v.compte && bloques.has(String(v.compte)))) { ecarte('compte-bloque'); continue; }", ''],
    ['comptes bloqués inconnus lus « aucun »', "const bloques = comptesBloques && typeof comptesBloques.has === 'function' ? comptesBloques : null;", 'const bloques = comptesBloques && typeof comptesBloques.has === \'function\' ? comptesBloques : new Set();'],
    ['un retrait incertain tu', 'const incertain = () => {', 'const incertain = () => { return;'],
    ['un refus de VRM attribué à eBay', "toast(`N°${d.numero} n'a pas été retirée automatiquement${", "toast(`N°${d.numero} : eBay a refusé le retrait automatique, pas été retirée${"],
    ['la preuve sans la date de sa liste', 'return { etat, cap: Number.isFinite(cap) ? cap : null, compte: lu.uid,', 'return { etat, cap: null, compte: lu.uid,'],
  ];
  let nonPris = 0;
  for (const [nom, de, vers] of MUTATIONS) {
    if (APP0.indexOf(de) < 0) { console.log(`❌ mutation « ${nom} » : texte introuvable`); nonPris++; continue; }
    const ko = await controles(APP0.replace(de, vers), false);
    console.log(`${ko ? '✅' : '❌'} mutation « ${nom} » ⇒ ${ko} contrôle(s) rouge(s)`);
    if (!ko) nonPris++;
  }
  console.log(nonPris ? `\n❌ ${nonPris} réaffaiblissement(s) que l'audit ne voit pas` : '\n✅ chaque réaffaiblissement est attrapé');
  process.exit(nonPris ? 1 : 0);
})();
