// Banc : eBay → ANNONCES « de ouf » (5 octobre) — l'écran RENDU, sur des
// données INVENTÉES (il vit dans le dépôt, qui est public : aucune fixture).
//
// Julien : « pour eBay je ne sais pas pourquoi le site est si peu développé, tu
// as accès à mon compte et tu ne fais rien de ouf ». Mesuré le jour même : ses
// 2 annonces eBay n'étaient reliées à AUCUNE paire. Ce banc rend l'écran à 390
// et 1512 px et exige, en jugeant les `data-*` posés par l'écran (§6.5 — le
// texte reste libre) et ce qui PART vers `/api/ebay` :
//   · une annonce reliée par son SKU affiche son N° ; une annonce sans SKU dit
//     « pas reliée » et propose « Relier à une paire » — et une annonce dont le
//     titre est identique à une paire n'est JAMAIS reliée toute seule (§5) ;
//   · VENDUE SUR VINTED et encore en vente sur eBay ⇒ l'alerte et « Retirer
//     d'eBay ». ⚠️ (11 octobre) La vente est servie sous la forme qu'elle a
//     VRAIMENT chez lui : un BORDEREAU (`harvest_*_label_{tx}`, qui porte
//     l'annonce) et la vente dans `orders_sold` — SANS ligne de transaction.
//     Le banc servait une ligne `harvest_*_txn_*` : il était vert sur le défaut
//     de la N°553 (§6.3). Et les deux autres sens : un bordereau de vente
//     ANNULÉE, et une paire REVENUE (une autre annonce du même N° en ligne) ne
//     déclenchent rien ; une vente en cours sans aucune preuve est dite UNE fois
//     (« pas encore reliée »), son compte nommé. L'interrupteur du retrait
//     automatique dit son état en un mot, et JAMAIS « éteint » avant d'avoir lu
//     le réglage (il était allumé chez lui, il le croyait éteint). Derrière une
//     confirmation qui dit « sans retour » ; Annuler n'envoie RIEN, Oui envoie
//     `{action:'retirer', itemId, confirme:true}` — et une conversation (état
//     vide) ou une vente annulée ne déclenchent rien ;
//   · VENDUE SUR eBAY et encore en vente sur Vinted ⇒ l'alerte avec le LIEN
//     vers l'annonce Vinted ; une commande annulée, ou sans SKU mais au titre
//     identique, ne déclenche rien ;
//   · l'offre aux observateurs : le bouton n'existe QUE sur l'annonce qu'eBay
//     déclare éligible ; « pas d'observateur » est dit UNE fois ; la remise
//     donne le prix résultant ; Annuler n'envoie rien ; Oui envoie exactement
//     `{action:'offre', listingId, remise, confirme:true}` ; une remise hors
//     5–50 n'envoie rien ;
//   · relier : un N° inconnu ou déjà porté par une autre annonce eBay est
//     refusé sans rien envoyer ; un N° choisi, confirmé, envoie `{action:'sku'}`
//     et la carte affiche le N° ; la paire à la MÊME photo est proposée en tête ;
//   · le tableau de bord dit les deux mêmes alertes (même règle, §11) ;
//   · « pas su » : ventes Vinted, ventes eBay et éligibilité illisibles ⇒ UNE
//     ligne qui le dit, AUCUNE alerte, AUCUN bouton d'offre, aucun « pas
//     d'observateur » inventé ;
//   · aucun débordement horizontal, aucune erreur de page.
//   · (revue du 11 octobre) la vente « pas encore reliée » est NOMMÉE (son
//     titre), avec le lien vers SA conversation et, à poster, son bouton
//     « Générer le bordereau » ; le geste suit la version du pont : une 5.168.0
//     PUBLIÉE (sans `capterPreuvesVente`) rend « retard », jamais la promesse ;
//     une extension à jour dit le CHIFFRE (3 par visite, « au fil de tes
//     visites » au-delà) ; et l'interrupteur éteint dans le nuage n'affiche
//     jamais ALLUMÉ parce que l'appareil gardait « true ».
//   · (relecture croisée de la 5.174) « ou génère son bordereau (bouton
//     ci-dessous) » et le bouton ne sont là QUE si l'extension de ce navigateur
//     peut recevoir la commande : ni avec deux extensions (« je n'en envoie
//     aucune » dans le même paragraphe), ni code périmé, ni sa 5.164 d'aujourd'hui
//     (périmée ou muette), ni pas connectée / autre compte VRM, ni absente — et
//     l'autre sens : une 5.170 connectée (commande possible) les garde.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
// Une extension ≥ CODE_DANS_ETAT (5.171) porte dans son état la version du CODE
// qui tourne (\`code\`) : sans lui, l'app la dit « périmée » (chantier connexion du
// 11 octobre). Le seuil est LU dans l'app, jamais recopié (§11).
const CODE_DANS_ETAT_BANC = (require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8').match(/const CODE_DANS_ETAT = '([0-9.]+)'/) || [])[1] || '5.171.0';
const auMoinsBanc = (v, s) => { const a = String(v || '').split('.').map(Number), b = String(s).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); } return true; };
const codeEtat = (v) => auMoinsBanc(v, CODE_DANS_ETAT_BANC) ? { code: v, ext: 'banc-ext' } : {};
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4711;
const EXT_ATTENDUE = (/const EXT_ATTENDUE = '([^']+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '?';
// Le pont simulé (le VRAI dialogue `ready` / `etat`), injecté AVANT l'app.
// `o.vieux` : une seconde copie (elle répond au ping) · `o.muette` : le code qui
// tourne ne connaît pas « état » (5.95–5.128 sous un manifeste 5.164) ·
// `o.extra` : des clés de plus dans l'état (une clé d'un ancien code).
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') { post({ __vmr: 'ready', version: o.version }); if (o.vieux) post({ __vmr: 'ready', version: o.vieux }); }
    if (d.__vmr === 'etat' && !o.muette) post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, ...(o.etatCode || {}), ...(o.extra || {}), vrm: o.vrm || { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_test' }, cmds: {} } });
    if (d.__vmr === 'cmd' && d.cmd === 'ventes') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
    // Comme le VRAI background.js quand le PDF est déjà rangé (mesuré dans le vm) :
    // « fait », sans rien demander à Vinted — et sans relier la vente.
    if (d.__vmr === 'cmd' && d.cmd === 'bordereau') { (window.__cmds = window.__cmds || []).push(d.cmd + ':' + (d.tx || '')); post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, jobId: `bord:${d.uid}:${d.tx}`, etape: 'fait', deja: true } }); }
  });
  post({ __vmr: 'ready', version: o.version });
};
// Des ventes en cours SANS preuve de plus (sur le même compte), pour juger le
// rythme dit par l'écran (« 3 par visite »).
let ventesEnPlus = 0;

const auj = new Date();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const SESSION = { access_token: 'jeton-de-l-app', refresh_token: 'jeton-de-renouvellement-de-l-app', expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.test' } };
const annonce = (id, titre, prix, ferme) => ({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: titre.split(' ')[0], size_title: (/taille (\d+)/.exec(titre) || [])[1] || '', is_closed: !!ferme, is_hidden: false, is_draft: false, photo: { url: 'https://img.test/v' + id + '.jpg' } });
const LISTINGS = { capturedAt: auj.toISOString(), payload: { items: [
  annonce(7001, 'Nike Dunk Low panda taille 42', 95),
  annonce(7002, 'Adidas Gazelle bleu taille 40', 80, true),     // vendue sur Vinted (fermée)
  annonce(7003, 'Salomon XT-6 noir taille 41', 120),
  annonce(7004, 'New Balance 550 blanc taille 43', 90),
  annonce(7005, 'Asics Gel 1130 argent taille 39', 70),
  annonce(7006, 'Puma Suede rouge taille 42', 60, true),          // N°26 : vendue (bordereau)…
  annonce(7007, 'Puma Suede rouge taille 42', 65),                // … mais REVENUE : republiée sous le même N°
] } };
const fiche = (numero, title, id) => ({ numero, title, photo: 'https://img.test/v' + id + '.jpg' });
const MAIN = { vinted_annonce_numeros: {
  '7001': fiche('21', 'Nike Dunk Low panda taille 42', 7001),
  '7002': fiche('22', 'Adidas Gazelle bleu taille 40', 7002),
  '7003': fiche('23', 'Salomon XT-6 noir taille 41', 7003),
  '7004': fiche('24', 'New Balance 550 blanc taille 43', 7004),
  '7005': fiche('25', 'Asics Gel 1130 argent taille 39', 7005),
  '7006': fiche('26', 'Puma Suede rouge taille 42', 7006),
  '7007': fiche('26', 'Puma Suede rouge taille 42', 7007),
} };
const txn = (tx, item, statut, titre) => ({ id: `harvest_111_txn_${tx}`, data: { payload: { transaction: { id: tx, item_id: item, status: statut, status_title: titre } } } });
const TXN = [
  // ⚠️ (11 octobre) PLUS de ligne de transaction pour la N°22 : sa preuve est
  //    son BORDEREAU, comme la N°553 du 10 octobre (voir l'en-tête).
  txn(9002, 7005, 1, ''),                       // N°25 : une conversation, pas une vente
  txn(9003, 7003, 300, 'Commande annulée'),     // N°23 : la paire est revenue
];
const recent = (h) => new Date(Date.now() - h * 3600000).toISOString();
const VENTES = { capturedAt: auj.toISOString(), payload: { my_orders: [
  { transaction_id: 9001, title: 'Adidas Gazelle bleu taille 40', status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: recent(20) },   // N°22 : bordereau seul ⇒ PROUVÉE
  { transaction_id: 9003, title: 'Salomon XT-6 noir taille 41', status: 'Commande annulée', transaction_user_status: 'failed', date: recent(30) },                    // N°23 : bordereau, vente annulée ⇒ rien
  { transaction_id: 9006, title: 'Puma Suede rouge taille 42', status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: recent(10) },       // N°26 : bordereau, mais revenue ⇒ rien
  { transaction_id: 9010, conversation_id: 88010, title: 'Vans Old Skool noir taille 41', status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: recent(2) },     // aucune preuve ⇒ « pas encore reliée »
] } };
const bordereau = (tx, item) => ({ id: `harvest_111_label_${tx}`, data: { uid: '111', url: 'https://s3.test/l.pdf', tx: String(tx), item: String(item), items: [String(item)], capturedAt: auj.toISOString(), pdfB64: 'JVBERi0x' } });
const BORDEREAUX = [bordereau(9001, 7002), bordereau(9003, 7003), bordereau(9006, 7006)];
const EBAY_ANNONCES = () => [
  { itemId: '110000000001', title: 'Adidas Gazelle bleu taille 40', price: '80.0', sku: 'VRM-22', depuis: recent(100), observateurs: 1, photo: 'https://img.test/e1.jpg', url: 'https://www.ebay.fr/itm/110000000001' },
  // Pas de SKU, et SA photo est exactement celle de la paire N°21 (une identité).
  { itemId: '110000000002', title: 'Nike Dunk Low panda taille 42', price: '100.0', sku: '', observateurs: 3, photo: 'https://img.test/v7001.jpg', url: 'https://www.ebay.fr/itm/110000000002' },
  { itemId: '110000000003', title: 'Salomon XT-6 noir taille 41', price: '120.0', sku: 'VRM-23', observateurs: null, photo: 'https://img.test/e3.jpg' },
  { itemId: '110000000005', title: 'Asics Gel 1130 argent taille 39', price: '75.0', sku: 'VRM-25', observateurs: 0, photo: 'https://img.test/e5.jpg' },
  { itemId: '110000000006', title: 'Puma Suede rouge taille 42', price: '70.0', sku: 'VRM-26', observateurs: 0, photo: 'https://img.test/e6.jpg' },
];
const EBAY_COMMANDES = [
  { orderId: '01-001', orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', lineItems: [{ sku: 'VRM-24', title: 'New Balance 550 blanc taille 43', legacyItemId: '110000000004' }], pricingSummary: { total: { value: '90.00', currency: 'EUR' } } },
  { orderId: '01-002', orderPaymentStatus: 'PAID', cancelStatus: { cancelState: 'CANCELED' }, lineItems: [{ sku: 'VRM-21', title: 'Nike Dunk Low panda taille 42' }], pricingSummary: { total: { value: '95.00', currency: 'EUR' } } },
  // Sans SKU, au titre IDENTIQUE à la paire N°23 encore en ligne : ne désigne rien.
  { orderId: '01-003', orderPaymentStatus: 'PAID', lineItems: [{ sku: '', title: 'Salomon XT-6 noir taille 41' }], pricingSummary: { total: { value: '120.00', currency: 'EUR' } } },
];
let rows = [];
const remettre = () => {
  rows = [
    { id: 'main', data: JSON.parse(JSON.stringify(MAIN)) },
    { id: 'harvest_111_listings', data: LISTINGS },
    { id: 'harvest_111_orders_sold', data: { ...VENTES, payload: { my_orders: [...VENTES.payload.my_orders, ...Array.from({ length: ventesEnPlus }, (_, i) => ({ transaction_id: 9100 + i, title: 'Paire en plus ' + (i + 1), status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: recent(3) }))] } } },
    ...TXN,
    ...BORDEREAUX,
    { id: 'ebay_listings', data: { items: EBAY_ANNONCES(), capturedAt: Date.now() } },
    { id: 'ebay_orders', data: { orders: EBAY_COMMANDES, capturedAt: Date.now() } },
    // (5 octobre) Deux annonces PROGRAMMÉES : la N°22, prouvée vendue sur
    // Vinted ⇒ « programmée sur eBay — à annuler » ; la N°25 (une simple
    // conversation, pas une vente) ⇒ rien.
    // (6 octobre) + la N°24, VENDUE SUR eBAY (commande 01-001), et la N°21,
    // VENDUE SUR LEBONCOIN : « à annuler » aussi — toutes plateformes, par le N°.
    { id: 'ebay_programmees', data: { items: [
      { itemId: '110000000922', sku: 'VRM-22', title: 'Adidas Gazelle bleu taille 40', price: '85.0', debut: new Date(Date.now() + 2 * 86400000).toISOString(), photo: '' },
      { itemId: '110000000925', sku: 'VRM-25', title: 'Asics Gel 1130 argent taille 39', price: '75.0', debut: new Date(Date.now() + 3 * 86400000).toISOString(), photo: '' },
      { itemId: '110000000924', sku: 'VRM-24', title: 'New Balance 550 blanc taille 43', price: '90.0', debut: new Date(Date.now() + 4 * 86400000).toISOString(), photo: '' },
      { itemId: '110000000921', sku: 'VRM-21', title: 'Nike Dunk Low panda taille 42', price: '95.0', debut: new Date(Date.now() + 5 * 86400000).toISOString(), photo: '' },
    ], enLigne: [{ itemId: '110000000966', sku: 'VRM-22' }], complet: true, capturedAt: Date.now() } },
    { id: 'lbc_ventes', data: { ventes: { vl21: { isSeller: true, itemId: 6021, title: 'Nike Dunk Low panda n21', stepStatus: 'finished' } } } },
    // (6 octobre) Trois brouillons « programmee » : la N°22 (celle de la liste
    // d'eBay, 922) ; une N°25 (955) qu'eBay ne liste PLUS, relue complète une
    // heure après sa programmation (annulée dans le Seller Hub, ou terminée) ;
    // une N°22 (966) passée EN LIGNE. Les deux dernières ne doivent plus
    // revenir comme « programmées » — ni lever l'alerte « à annuler ».
    { id: 'ebay_brouillons', data: { items: {
      'b-22p': { id: 'b-22p', numero: '22', pairId: '7002', titre: 'Adidas Gazelle bleu taille 40', prix: '85', etatBrouillon: 'programmee', uuid: 'A'.repeat(32), programme: { itemId: '110000000922', sku: 'VRM-22', debut: new Date(Date.now() + 2 * 86400000).toISOString(), at: Date.now() - 3600000 } },
      'b-25z': { id: 'b-25z', numero: '25', pairId: '7005', titre: 'Asics Gel 1130 argent taille 39', prix: '75', etatBrouillon: 'programmee', programme: { itemId: '110000000955', sku: 'VRM-25', debut: new Date(Date.now() - 1800000).toISOString(), at: Date.now() - 3600000 } },
      'b-22e': { id: 'b-22e', numero: '22', pairId: '7002', titre: 'Adidas Gazelle bleu taille 40', prix: '85', etatBrouillon: 'programmee', programme: { itemId: '110000000966', sku: 'VRM-22', debut: new Date(Date.now() - 1800000).toISOString(), at: Date.now() - 3600000 } },
    }, majAt: Date.now() } },
  ];
};
const brouillonsEnBase = () => ((rows.find((r) => r.id === 'ebay_brouillons') || {}).data || {}).items || {};

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
// Un banc ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 140)); if (process.env.BANC_DEBUG) console.log(String(e && e.message)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
// Projection PostgREST : `alias:data->champ` / `alias:data->>champ` (§6.3).
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

// `opts.mainLent` (ms) : la ligne `main` (les réglages synchronisés) arrive en
// retard — l'écran se monte AVANT le nuage, comme sur un appareil neuf (§5.49).
// `opts` sert aussi à relever chaque état pris par l'interrupteur du retrait
// automatique pendant le chargement (`window.__etatsAuto`).
async function ouvrir(b, vp, panne, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const envois = [];
  // `opts.session` : une vraie session VRM (le compte de l'app est alors CONNU —
  // sans elle, « l'extension écrit dans un autre compte » ne peut pas se juger).
  if (opts.session) await pg.addInitScript((sess) => { try { localStorage.setItem('vrm_session', JSON.stringify(sess)); } catch (_) {} }, SESSION);
  else await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (opts.pont) await pg.addInitScript(PONT, Object.assign({}, opts.pont, { etatCode: opts.pont.etatCode !== undefined ? opts.pont.etatCode : codeEtat(opts.pont.version) }));
  if (opts.local) await pg.addInitScript((l) => { try { for (const [k, v] of Object.entries(l)) localStorage.setItem(k, v); } catch (_) {} }, opts.local);
  await pg.addInitScript(() => {
    window.__etatsAuto = [];
    setInterval(() => { const e = document.querySelector('[data-ebay-retrait-auto]'); const v = e && e.getAttribute('data-ebay-retrait-auto'); if (v && window.__etatsAuto[window.__etatsAuto.length - 1] !== v) window.__etatsAuto.push(v); }, 25);
  });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  // Le faux GoTrue, enregistré APRÈS le fourre-tout des hôtes externes (qui
  // laisse passer vers le vrai réseau) : Playwright prend la DERNIÈRE route en
  // premier (§6.6). Posé avant, il n'était jamais atteint — invisible tant que
  // rien ne lisait GoTrue au démarrage, rouge depuis la double vérification
  // (`PorteMfa` relit `GET /user` pour une session qui ne dit pas `totp`).
  // `GET /user` rend la VRAIE forme : la fiche utilisateur (`factors` absent
  // quand il n'y en a aucun), pas une session (§6.3).
  if (opts.session) await pg.route('**/auth/v1/**', (r) => {
    const chemin = new URL(r.request().url()).pathname.replace(/^.*\/auth\/v1\//, '');
    const corps = chemin === 'user' ? { id: SESSION.user.id, email: SESSION.user.email, aud: 'authenticated' } : { ...SESSION, expires_in: 3600 };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
  });
  await pg.route('**/rest/v1/**', async (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (opts.mainLent && /id=eq\.main(&|$)/.test(u) && route.request().method() === 'GET') await new Promise((r) => setTimeout(r, opts.mainLent));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    // `opts.casse(u)` : cette lecture ne répond pas (522, du HTML — la vraie forme d'une panne).
    if (opts.casse && route.request().method() === 'GET' && opts.casse(u)) return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
    if (route.request().method() !== 'GET') {
      // Toute écriture est GARDÉE (§6.3) : `main`, et les brouillons eBay que
      // l'écran remet en état après une annulation.
      try { for (const l of [].concat(JSON.parse(route.request().postData() || 'null') || [])) { if (!l || !l.id || !l.data) continue; const i = rows.findIndex((r) => r.id === l.id); if (i >= 0) rows[i] = { id: l.id, data: l.data }; else rows.push({ id: l.id, data: l.data }); } } catch (_) {}
      return j([]);
    }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    // « Pas su » : les ventes Vinted (preuve) et les commandes eBay ne répondent pas.
    if (panne && (/_txn_/.test(u) || /ebay_orders/.test(u))) return j({ message: 'timeout' }, 500);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // ⚠️ enregistré APRÈS le fourre-tout → Playwright le prend en PREMIER (§6.6).
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    if (['offre', 'retirer', 'sku', 'publish', 'deprogrammer'].includes(body.action)) envois.push(body);
    if (body.action === 'deprogrammer') {
      const P = rows.find((r) => r.id === 'ebay_programmees'); P.data.items = P.data.items.filter((a) => a.itemId !== body.itemId);
      return j({ ok: true, verifie: true });
    }
    if (body.action === 'status') return j({ ok: true, connected: true });
    if (body.action === 'offreinfo') return panne ? j({ ok: false, error: 'eBay injoignable' }, 503) : j({ ok: true, eligibles: ['110000000002'], complet: true });
    if (body.action === 'offre') return j({ ok: true, remise: body.remise, envoyees: 3 });
    if (body.action === 'retirer') {
      // Ce que ferait la synchro suivante : l'annonce terminée sort de la liste.
      const L = rows.find((r) => r.id === 'ebay_listings'); L.data.items = L.data.items.filter((a) => a.itemId !== body.itemId);
      return j({ ok: true });
    }
    if (body.action === 'sku') {
      const L = rows.find((r) => r.id === 'ebay_listings'); const a = L.data.items.find((x) => x.itemId === body.itemId);
      if (a) a.sku = 'VRM-' + body.numero;
      return j({ ok: true, sku: 'VRM-' + body.numero });
    }
    if (body.action === 'finances') return j({ ok: false, reason: 'scope', error: 'x' });
    return j({ ok: true });
  });
  return { ctx, pg, errs, envois };
}
async function versAnnoncesEbay(pg) {
  await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1500);
  await pg.getByRole('button', { name: 'Annonces', exact: true }).first().click({ timeout: 8000 });
  await pg.waitForSelector('[data-ebay-annonce]', { timeout: 15000 }).catch(() => {});
  await pg.waitForSelector('[data-ebay-retirer-vinted]', { timeout: 6000 }).catch(() => {});
  await pg.waitForTimeout(1200);
}
// ⚠️ Une feuille de confirmation se pose sur un voile FLOUTÉ (backdrop-filter) :
//    en rendu logiciel (swiftshader), à 1512 px sur une page longue, chaque
//    image coûte cher et Playwright met plusieurs secondes à la juger « stable ».
//    Mesuré : le bouton est immobile 300 ms après l'ouverture ; c'est l'attente
//    du banc qui était trop courte (5 s), pas l'écran. On attend 20 s.
const feuille = (pg) => pg.locator('div[style*="z-index: 2000"]');
const lire = (pg) => pg.evaluate(() => {
  const a = (sel, at) => [...document.querySelectorAll(sel)].map((e) => e.getAttribute(at));
  const relie = {}; for (const e of document.querySelectorAll('[data-ebay-annonce]')) { const r = e.querySelector('[data-relie]'); relie[e.getAttribute('data-ebay-annonce')] = r ? r.getAttribute('data-relie') : null; }
  const txt = document.body.innerText;
  return {
    relie,
    doublons: a('[data-ebay-doublon]', 'data-ebay-doublon'),
    retirer: a('[data-retirer-ebay]', 'data-retirer-ebay'),
    vendues: [...document.querySelectorAll('[data-ebay-vendue]')].map((e) => ({ num: e.getAttribute('data-ebay-vendue'), href: (e.querySelector('a[href*="vinted.fr/items/"]') || {}).href || '' })),
    offres: [...document.querySelectorAll('[data-offre-ouvrir]')].map((e) => ({ id: e.getAttribute('data-offre-ouvrir'), t: e.textContent })),
    relierBtn: a('[data-relier-ouvrir]', 'data-relier-ouvrir'),
    sansObs: document.querySelectorAll('[data-ebay-sans-observateur]').length,
    sansObsTxt: (txt.match(/pas d.observateur à qui l.envoyer/g) || []).length,
    pasSu: [...document.querySelectorAll('[data-ebay-pas-su]')].map((e) => e.textContent),
    pasReliee: (txt.match(/pas reliée/g) || []).length,
    sansPreuve: [...document.querySelectorAll('[data-ebay-ventes-sans-preuve]')].map((e) => ({ n: e.getAttribute('data-ebay-ventes-sans-preuve'), geste: e.getAttribute('data-ebay-sans-preuve-geste'), t: e.textContent,
      promesse: e.getAttribute('data-ebay-sans-preuve-promesse'), blocage: e.getAttribute('data-ebay-sans-preuve-blocage'),
      captes: [...e.querySelectorAll('[data-ebay-sans-preuve-bord-capte]')].map((x) => x.getAttribute('data-ebay-sans-preuve-bord-capte')),
      ventes: [...e.querySelectorAll('[data-ebay-sans-preuve-vente]')].map((v) => ({ tx: v.getAttribute('data-ebay-sans-preuve-vente'), t: v.textContent, liens: [...v.querySelectorAll('a[href]')].map((a) => a.href), bord: !!v.querySelector('[data-bouton-bord][data-tx="' + v.getAttribute('data-ebay-sans-preuve-vente') + '"]') })) })),
    autoEtat: (document.querySelector('[data-ebay-retrait-etat]') || {}).textContent || null,
  };
});
const deborde = (pg) => pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      remettre();
      const { ctx, pg, errs, envois } = await ouvrir(b, vp, false);
      // ── Le tableau de bord d'abord : la MÊME règle, la même conclusion (§11).
      await essaie('tableau de bord', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
        dit(await pg.locator('[data-ebay-a-retirer]').count() === 0, 'les alertes détaillées restent dans eBay pour garder un accueil compact');
      });
      await essaie('écran Annonces eBay', async () => {
        await versAnnoncesEbay(pg);
        const v = await lire(pg);
        await pg.screenshot({ path: path.join(os.tmpdir(), 'ebay-annonces-' + vp.width + '.png'), fullPage: true });
        dit(v.relie['110000000001'] === '22' && v.relie['110000000003'] === '23' && v.relie['110000000005'] === '25',
          'une annonce eBay reliée par son SKU affiche le N° de sa paire', JSON.stringify(v.relie));
        dit(v.relie['110000000002'] === '' && v.relierBtn.includes('110000000002') && v.relierBtn.length === 1,
          "l'annonce sans SKU dit « pas reliée » et propose « Relier à une paire » — même au titre identique à une paire en ligne", JSON.stringify(v.relierBtn));
        dit(JSON.stringify(v.doublons) === '["22"]' && JSON.stringify(v.retirer) === '["110000000001"]',
          'vendue sur Vinted, prouvée par son SEUL bordereau (aucune ligne de transaction, le cas de la N°553) ⇒ « Retirer d\'eBay » pour la N°22, et elle seule (pas la conversation N°25, pas la vente annulée N°23, pas la N°26 revenue)', JSON.stringify(v.doublons));
        dit(v.sansPreuve.length === 1 && v.sansPreuve[0].n === '1',
          'la vente en cours qu\'aucune preuve ne relie est dite UNE fois : « 1 vente Vinted en cours pas encore reliée » (les ventes prouvées, annulée et revenue n\'y sont pas)', JSON.stringify(v.sansPreuve.map((x) => x.n)));
        dit(v.sansPreuve.length === 1 && /compte_test/.test(v.sansPreuve[0].t) && v.sansPreuve[0].geste === 'absente' && /ordinateur où l.extension/.test(v.sansPreuve[0].t),
          'elle nomme le compte, et le geste suit l\'extension de CE navigateur (absente ici : « sur l\'ordinateur où l\'extension est installée », aucune promesse)', v.sansPreuve[0] ? v.sansPreuve[0].geste + ' · ' + v.sansPreuve[0].t.slice(0, 160) : 'absente');
        const vv = (v.sansPreuve[0] && v.sansPreuve[0].ventes) || [];
        dit(vv.length === 1 && vv[0].tx === '9010' && /Vans Old Skool noir taille 41/.test(vv[0].t),
          '(revue du 11 octobre) la vente est NOMMÉE (son titre) — on sait laquelle ouvrir', JSON.stringify(vv.map((x) => x.t)));
        dit(vv.length === 1 && vv[0].liens.length === 1 && /vinted\.fr\/inbox\/88010$/.test(vv[0].liens[0]),
          'avec le lien vers SA conversation sur vinted.fr — une fois (le bouton du bordereau ne le répète pas, §7)', JSON.stringify(vv[0] && vv[0].liens));
        // (revue du 11 octobre, défaut 13 ; relecture croisée de la 5.174) Pas
        // d'extension ICI : le bouton ne pourrait rien commander — pas de bouton
        // grisé et muet dans cette ligne (le texte dit où agir ; l'écran Ventes
        // garde le sien, grisé avec sa raison). Le bouton, quand la commande est
        // possible : voir « génère son bordereau » plus bas.
        dit(vv.length === 1 && !vv[0].bord && !/génère (son|leur) bordereau/.test(v.sansPreuve[0].t), `${vp.width > 600 ? 'sans extension ici' : 'au doigt (téléphone)'} : PAS de bouton « Bordereau » qui ne peut rien commander, ni « génère son bordereau »`, JSON.stringify(vv[0] && vv[0].bord));
        dit(v.autoEtat === 'ÉTEINT', 'le retrait automatique dit son état en un mot : ÉTEINT', String(v.autoEtat));
        dit(v.vendues.length === 1 && v.vendues[0].num === '24' && /vinted\.fr\/items\/7004$/.test(v.vendues[0].href),
          'vendue sur eBay ⇒ l\'alerte pour la N°24 mène à SON annonce Vinted (pas la commande annulée N°21, pas la commande sans SKU au titre identique)', JSON.stringify(v.vendues));
        dit(v.offres.length === 1 && v.offres[0].id === '110000000002' && /3 observateurs/.test(v.offres[0].t),
          'le bouton d\'offre n\'existe QUE sur l\'annonce qu\'eBay déclare éligible, avec son nombre d\'observateurs', JSON.stringify(v.offres));
        dit(v.sansObs === 1 && v.sansObsTxt === 1, '« pas d\'observateur à qui l\'envoyer » est dit UNE fois, pas sur chaque carte', `bloc ×${v.sansObs} · phrase ×${v.sansObsTxt}`);
        dit(v.pasSu.length === 0, 'en marche normale, aucune ligne « je n\'ai pas pu lire »');
      });
      // ── L'OFFRE AUX OBSERVATEURS ────────────────────────────────────────
      await essaie('offre', async () => {
        await pg.click('[data-offre-ouvrir="110000000002"]');
        await pg.waitForSelector('[data-offre-panneau="110000000002"]', { timeout: 5000 });
        await pg.fill('[data-offre-remise="110000000002"]', '60');
        const desactive = await pg.$eval('[data-offre-envoyer="110000000002"]', (e) => e.disabled);
        dit(desactive, 'une remise de 60 % (hors 5–50) ne peut pas partir');
        await pg.fill('[data-offre-remise="110000000002"]', '15');
        await pg.locator('[data-ebay-annonce="110000000002"]').screenshot({ path: path.join(os.tmpdir(), 'ebay-annonces-offre-' + vp.width + '.png') }).catch(() => {});
        const prix = await pg.$eval('[data-offre-prix]', (e) => e.getAttribute('data-offre-prix'));
        dit(prix === '85.00', 'la remise de 15 % donne le prix résultant (100 € → 85,00 €)', prix);
        await pg.click('[data-offre-envoyer="110000000002"]');
        await feuille(pg).getByRole('button', { name: 'Oui, envoyer' }).waitFor({ timeout: 5000 });
        await feuille(pg).getByRole('button', { name: 'Annuler' }).click();
        await pg.waitForTimeout(400);
        dit(!envois.some((e) => e.action === 'offre'), 'Annuler la confirmation n\'envoie RIEN');
        await pg.click('[data-offre-envoyer="110000000002"]');
        await feuille(pg).getByRole('button', { name: 'Oui, envoyer' }).click({ timeout: 20000 });
        await pg.waitForSelector('[data-ebay-info="110000000002"]', { timeout: 5000 });
        const e = envois.filter((x) => x.action === 'offre');
        const attendu = { action: 'offre', listingId: '110000000002', remise: 15, confirme: true };
        dit(e.length === 1 && JSON.stringify(e[0]) === JSON.stringify(attendu), 'Oui envoie exactement {action:offre, listingId, remise:15, confirme:true}', JSON.stringify(e));
        const info = await pg.$eval('[data-ebay-info="110000000002"]', (x) => x.textContent);
        dit(/envoyée à 3/.test(info), 'la carte dit à combien de personnes l\'offre est partie', info);
      });
      // ── PROGRAMMÉE sur eBay, VENDUE sur Vinted : à annuler (5 octobre) ─────
      await essaie('à annuler', async () => {
        const nums = await pg.$$eval('[data-ebay-a-annuler-paire]', (els) => els.map((e) => e.getAttribute('data-ebay-a-annuler-paire') + ':' + ((e.querySelector('[data-ebay-a-annuler-ou]') || {}).getAttribute ? e.querySelector('[data-ebay-a-annuler-ou]').getAttribute('data-ebay-a-annuler-ou') : '?')));
        dit(JSON.stringify(nums) === '["22:Vinted","24:eBay","21:Leboncoin"]', 'programmée sur eBay + déjà vendue AILLEURS ⇒ « à annuler » : N°22 (Vinted), N°24 (eBay), N°21 (Leboncoin) — pas la N°25 (une conversation), et pas deux fois la N°22 (sa programmée passée en ligne ne revient pas)', JSON.stringify(nums));
        const zombies = await pg.$$eval('[data-prog]', (els) => els.map((e) => e.getAttribute('data-prog')));
        dit(!zombies.includes('110000000955') && !zombies.includes('110000000966') && zombies.includes('110000000922'),
          'un brouillon « programmée » qu\'eBay ne liste plus (relu complet APRÈS) ou passé en ligne ne revient plus dans les programmées', JSON.stringify(zombies));
        await pg.click('[data-annuler-ebay="110000000922"]');
        await feuille(pg).getByRole('button', { name: "Oui, demander l'annulation" }).waitFor({ timeout: 5000 });
        const t = await feuille(pg).innerText();
        dit(/Seller Hub/.test(t) && /N°22/.test(t), 'la confirmation nomme la paire et dit où annuler si eBay refuse', t.replace(/\s+/g, ' ').slice(0, 120));
        await feuille(pg).getByRole('button', { name: 'Non' }).click();
        await pg.waitForTimeout(300);
        dit(!envois.some((x) => x.action === 'deprogrammer'), '« Non » n\'envoie RIEN à eBay');
        await pg.click('[data-annuler-ebay="110000000922"]');
        await feuille(pg).getByRole('button', { name: "Oui, demander l'annulation" }).click({ timeout: 20000 });
        await pg.waitForFunction(() => !document.querySelector('[data-ebay-a-annuler-paire="22"]'), null, { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        const d = envois.filter((x) => x.action === 'deprogrammer');
        dit(d.length === 1 && JSON.stringify(d[0]) === JSON.stringify({ action: 'deprogrammer', itemId: '110000000922', confirme: true }) && !(await pg.$('[data-ebay-a-annuler-paire="22"]')),
          'Oui envoie {action:deprogrammer, itemId, confirme:true} ; eBay a annulé ⇒ l\'alerte disparaît — et NE REVIENT PAS depuis le brouillon', JSON.stringify(d));
        const b22 = brouillonsEnBase()['b-22p'] || {};
        dit(b22.etatBrouillon === 'brouillon' && !b22.programme && !b22.uuid, 'son brouillon redevient un brouillon (nouvel identifiant d\'envoi au prochain essai)', JSON.stringify({ etat: b22.etatBrouillon, programme: b22.programme || null }));
      });
      // ── RETIRER D'eBAY la paire vendue sur Vinted ───────────────────────
      await essaie('retirer', async () => {
        await pg.click('[data-retirer-ebay="110000000001"]');
        await feuille(pg).getByRole('button', { name: "Oui, retirer d'eBay" }).waitFor({ timeout: 5000 });
        const texte = await feuille(pg).innerText();
        dit(/sans retour/.test(texte) && /N°22/.test(texte), 'la confirmation nomme la paire et dit que c\'est sans retour côté eBay', texte.replace(/\s+/g, ' ').slice(0, 120));
        await feuille(pg).getByRole('button', { name: 'Annuler' }).click();
        await pg.waitForTimeout(400);
        dit(!envois.some((x) => x.action === 'retirer'), 'Annuler n\'envoie RIEN à eBay');
        await pg.click('[data-retirer-ebay="110000000001"]');
        await feuille(pg).getByRole('button', { name: "Oui, retirer d'eBay" }).click({ timeout: 20000 });
        await pg.waitForFunction(() => !document.querySelector('[data-retirer-ebay="110000000001"]'), null, { timeout: 8000 }).catch(() => {});
        const r = envois.filter((x) => x.action === 'retirer');
        dit(r.length === 1 && JSON.stringify(r[0]) === JSON.stringify({ action: 'retirer', itemId: '110000000001', confirme: true }),
          'Oui envoie exactement {action:retirer, itemId, confirme:true}', JSON.stringify(r));
        const reste = await pg.$$('[data-ebay-doublon]');
        dit(reste.length === 0, 'une fois retirée, l\'alerte disparaît');
      });
      // ── RELIER À UNE PAIRE ──────────────────────────────────────────────
      await essaie('relier', async () => {
        await pg.click('[data-relier-ouvrir="110000000002"]');
        await pg.waitForSelector('[data-relier-panneau="110000000002"]', { timeout: 5000 });
        await pg.locator('[data-ebay-annonce="110000000002"]').screenshot({ path: path.join(os.tmpdir(), 'ebay-annonces-relier-' + vp.width + '.png') }).catch(() => {});
        const premiere = await pg.$eval('[data-relier-panneau="110000000002"] [data-relier-paire]', (e) => ({ n: e.getAttribute('data-relier-paire'), t: e.textContent }));
        dit(premiere.n === '21' && /même photo/.test(premiere.t), 'la paire à la MÊME photo est proposée en tête (une identité, pas un titre)', JSON.stringify(premiere));
        const proposees = await pg.$$eval('[data-relier-panneau="110000000002"] [data-relier-paire]', (els) => els.map((e) => e.getAttribute('data-relier-paire')));
        dit(!proposees.includes('23') && !proposees.includes('25') && proposees.includes('24'),
          'une paire déjà reliée à une AUTRE annonce eBay n\'est pas proposée (une paire, une annonce)', JSON.stringify(proposees));
        await pg.fill('[data-relier-num="110000000002"]', '999');
        await pg.click('[data-relier-valider="110000000002"]');
        await pg.waitForTimeout(300);
        let info = await pg.$eval('[data-ebay-info="110000000002"]', (x) => x.textContent).catch(() => '');
        dit(/Aucun article/.test(info) && !envois.some((x) => x.action === 'sku'), 'un N° que VRM ne connaît pas est refusé, rien n\'est envoyé', info);
        await pg.fill('[data-relier-num="110000000002"]', '23');
        await pg.click('[data-relier-valider="110000000002"]');
        await pg.waitForTimeout(300);
        info = await pg.$eval('[data-ebay-info="110000000002"]', (x) => x.textContent).catch(() => '');
        dit(/déjà relié/.test(info) && !envois.some((x) => x.action === 'sku'), 'un N° déjà porté par une autre annonce eBay est refusé (un article, une annonce)', info);
        await pg.fill('[data-relier-num="110000000002"]', '21');
        await pg.click('[data-relier-valider="110000000002"]');
        await feuille(pg).getByRole('button', { name: 'Oui, relier' }).click({ timeout: 20000 });
        await pg.waitForFunction(() => { const e = document.querySelector('[data-ebay-annonce="110000000002"] [data-relie]'); return e && e.getAttribute('data-relie') === '21'; }, null, { timeout: 8000 }).catch(() => {});
        const s = envois.filter((x) => x.action === 'sku');
        dit(s.length === 1 && JSON.stringify(s[0]) === JSON.stringify({ action: 'sku', itemId: '110000000002', numero: '21' }), 'son clic confirmé envoie {action:sku, itemId, numero:"21"}', JSON.stringify(s));
        const relie = await pg.$eval('[data-ebay-annonce="110000000002"] [data-relie]', (e) => e.getAttribute('data-relie')).catch(() => null);
        dit(relie === '21', 'la carte affiche désormais la N°21', String(relie));
        // Un lien posé se CHANGE (la confirmation le promet) : depuis le détail.
        await pg.click('[data-ebay-annonce="110000000003"] [role="button"]');
        await pg.click('[data-relier-changer="110000000003"]', { timeout: 5000 });
        const panneau = await pg.$('[data-relier-panneau="110000000003"]');
        dit(!!panneau && !envois.some((x) => x.action === 'sku' && x.itemId === '110000000003'),
          'une annonce déjà reliée peut changer de paire (depuis son détail), sans rien envoyer avant son choix');
      });
      await essaie('mise en page', async () => {
        const r = await deborde(pg);
        dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }
    // ── « PAS SU » : rien n'est inventé, et c'est dit UNE fois ─────────────
    console.log('── pas su (390 px)');
    remettre();
    const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, true);
    await essaie('pas su', async () => {
      await versAnnoncesEbay(pg);
      await pg.waitForSelector('[data-ebay-pas-su]', { timeout: 8000 }).catch(() => {});
      const v = await lire(pg);
      dit(v.pasSu.length === 1 && /ventes Vinted/.test(v.pasSu[0]) && /ventes eBay/.test(v.pasSu[0]),
        'ventes Vinted et ventes eBay illisibles ⇒ UNE ligne qui le dit, avec ce que ça empêche', JSON.stringify(v.pasSu).slice(0, 220));
      dit(v.doublons.length === 0 && v.retirer.length === 0 && v.vendues.length === 0, 'et AUCUNE alerte, aucun « Retirer d\'eBay » sur une preuve absente');
      dit(v.sansPreuve.length === 0, 'et pas de « ventes pas encore reliées » inventé sur une lecture ratée (la ligne « pas pu lire » le dit déjà)', JSON.stringify(v.sansPreuve.map((x) => x.n)));
      const ou = await pg.$$eval('[data-ebay-a-annuler-ou]', (els) => els.map((e) => e.getAttribute('data-ebay-a-annuler-ou')));
      dit(!ou.includes('Vinted') && !ou.includes('eBay'), 'ni « programmée sur eBay — à annuler » sur une preuve absente (ventes Vinted et eBay illisibles)', JSON.stringify(ou));
      dit(ou.includes('Leboncoin'), 'mais ce qui EST su est dit : la N°21, vendue sur Leboncoin (ventes lues), reste « à annuler »', JSON.stringify(ou));
      dit(v.offres.length === 0 && v.sansObs === 0 && v.sansObsTxt === 0, 'éligibilité illisible ⇒ aucun bouton d\'offre, et pas de « pas d\'observateur » inventé');
      dit(v.relie['110000000002'] === '' && v.relierBtn.includes('110000000002'), 'le lien, lui, reste lisible (il vient du SKU déjà capté)');
      const r = await deborde(pg);
      dit(r.sw <= r.cw + 1 && errs.length === 0, 'aucun débordement, aucune erreur', errs.join(' | ').slice(0, 160));
    });
    await ctx.close();
    // ── RETRAIT AUTOMATIQUE (proposition 8, 6 octobre) ─────────────────────
    //    Éteint ⇒ rien ne part tout seul. Allumé (confirmation d'abord) ⇒ à la
    //    réouverture, la paire PROUVÉE vendue part, et elle seule ; « pas su »
    //    sur la preuve ⇒ rien.
    console.log('── retrait automatique (1512 px)');
    {
      remettre();
      const o = await ouvrir(b, { width: 1512, height: 950 }, false);
      await essaie('retrait automatique', async () => {
        const auto = () => o.envois.filter((x) => x.action === 'retirer' && x.auto === true);
        await o.pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
        await o.pg.waitForTimeout(6000);
        dit(auto().length === 0 && !o.envois.some((x) => x.action === 'retirer'), 'éteint (le défaut) : rien ne part tout seul', JSON.stringify(o.envois));
        await versAnnoncesEbay(o.pg);
        dit((await o.pg.getAttribute('[data-ebay-retrait-auto]', 'data-ebay-retrait-auto')) === 'eteint', 'l’interrupteur est sur l’écran eBay → Annonces, éteint');
        await o.pg.click('[data-ebay-retrait-auto-bouton]');
        await o.pg.waitForTimeout(300);
        dit((await o.pg.getAttribute('[data-ebay-retrait-auto]', 'data-ebay-retrait-auto')) === 'eteint', 'allumer DEMANDE d’abord (une annonce terminée ne revient pas)');
        await feuille(o.pg).locator('button', { hasText: 'Allumer' }).click();
        await o.pg.waitForTimeout(900);
        const memo = await o.pg.evaluate(() => localStorage.getItem('vrm_ebay_retrait_auto'));
        dit(memo === 'true', 'confirmé, le réglage est gardé', String(memo));
        const mot = await o.pg.textContent('[data-ebay-retrait-etat]').catch(() => null);
        const expl = await o.pg.textContent('[data-ebay-retrait-auto]').catch(() => '');
        dit(mot === 'ALLUMÉ' && /TOUT SEUL/.test(expl) && /sans te demander/.test(expl), 'allumé, il le DIT en un mot (ALLUMÉ) et dit ce qu\'il fait en son nom (« tout seul, sans te demander »)', `${mot} · ${String(expl).slice(0, 120)}`);
        await o.pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
        await o.pg.waitForFunction(() => true, null, { timeout: 1000 });
        for (let i = 0; i < 20 && !auto().length; i++) await o.pg.waitForTimeout(500);
        const a = auto();
        dit(a.length === 1 && a[0].itemId === '110000000001' && a[0].sku === 'VRM-22' && a[0].confirme === true,
          'allumé : la paire N°22, PROUVÉE vendue sur Vinted, est retirée d’eBay — elle seule, avec son SKU', JSON.stringify(a));
        dit(!o.envois.some((x) => x.action === 'retirer' && /11000000000[35]/.test(x.itemId)), 'ni la N°23 (vente annulée), ni la N°25 (une conversation)');
        await o.pg.reload({ waitUntil: 'domcontentloaded' });
        await o.pg.waitForTimeout(5000);
        dit(auto().length === 1, 'une annonce retirée ne repart pas (la synchro l’a sortie de la liste)', `${auto().length} envoi(s)`);
      });
      await o.ctx.close();
      remettre();
      const p2 = await ouvrir(b, { width: 1512, height: 950 }, true);
      await essaie('retrait automatique, preuve illisible', async () => {
        await p2.pg.addInitScript(() => { try { localStorage.setItem('vrm_ebay_retrait_auto', 'true'); } catch (_) {} });
        rows[0].data.vrm_ebay_retrait_auto = true;
        await p2.pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
        await p2.pg.waitForTimeout(7000);
        dit(!p2.envois.some((x) => x.action === 'retirer'), 'allumé mais ventes Vinted illisibles ⇒ « pas su » ne retire RIEN', JSON.stringify(p2.envois));
      });
      await p2.ctx.close();
      // ── SON CAS (11 octobre) : allumé dans le NUAGE, appareil neuf, l'écran
      //    se monte avant que le réglage n'arrive. Il ne doit JAMAIS lire
      //    « éteint » : d'abord « … » (pas encore lu), puis ALLUMÉ.
      remettre();
      rows[0].data.vrm_ebay_retrait_auto = true;
      const p3 = await ouvrir(b, { width: 390, height: 844 }, false, { mainLent: 4500 });
      await essaie('retrait automatique allumé dans le nuage', async () => {
        await p3.pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
        await p3.pg.waitForTimeout(1200);
        await p3.pg.getByRole('button', { name: 'Annonces', exact: true }).first().click({ timeout: 8000 }).catch(() => {});
        await p3.pg.waitForFunction(() => { const e = document.querySelector('[data-ebay-retrait-auto]'); return e && e.getAttribute('data-ebay-retrait-auto') === 'allume'; }, null, { timeout: 15000 }).catch(() => {});
        const etats = await p3.pg.evaluate(() => window.__etatsAuto || []);
        const fin = await p3.pg.getAttribute('[data-ebay-retrait-auto]', 'data-ebay-retrait-auto').catch(() => null);
        dit(fin === 'allume', 'allumé dans son compte (nuage) ⇒ l\'écran dit ALLUMÉ, même sur un appareil neuf', String(fin));
        dit(etats.length > 0 && !etats.includes('eteint'), 'et il n\'a JAMAIS affiché « éteint » en attendant le réglage (« pas su » ≠ « éteint »)', JSON.stringify(etats));
        dit(etats[0] === 'pas-lu', 'l\'écran s\'est bien monté AVANT le réglage (sinon ce contrôle ne mesure rien)', JSON.stringify(etats));
      });
      await p3.ctx.close();
      // ── (revue du 11 octobre) ÉTEINT dans le nuage, mais l'appareil gardait
      //    « true » : l'écran ne doit JAMAIS finir sur ALLUMÉ (le retrait
      //    automatique, lui, lit le réglage du nuage et ne fait rien).
      remettre();
      rows[0].data.vrm_ebay_retrait_auto = false;
      const p4 = await ouvrir(b, { width: 390, height: 844 }, false, { mainLent: 3000, local: { vrm_ebay_retrait_auto: 'true' } });
      await essaie('retrait automatique éteint dans le nuage', async () => {
        await p4.pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
        await p4.pg.waitForTimeout(1200);
        await p4.pg.getByRole('button', { name: 'Annonces', exact: true }).first().click({ timeout: 8000 }).catch(() => {});
        await p4.pg.waitForFunction(() => { const e = document.querySelector('[data-ebay-retrait-auto]'); return e && e.getAttribute('data-ebay-retrait-auto') !== 'pas-lu'; }, null, { timeout: 15000 }).catch(() => {});
        await p4.pg.waitForTimeout(1500);
        const fin = await p4.pg.getAttribute('[data-ebay-retrait-auto]', 'data-ebay-retrait-auto').catch(() => null);
        const mot = await p4.pg.textContent('[data-ebay-retrait-etat]').catch(() => null);
        dit(fin === 'eteint' && mot === 'ÉTEINT', 'éteint dans le nuage, « true » sur l\'appareil ⇒ l\'écran dit ÉTEINT (le réglage du nuage, celui qu\'applique le retrait automatique)', `${fin} · ${mot}`);
      });
      await p4.ctx.close();
    }
    // ── (revue du 11 octobre) LE GESTE SUIT LA VERSION DU PONT, ET DIT LE CHIFFRE
    console.log('── ventes pas reliées · version du pont et rythme (1512 px)');
    for (const [version, enPlus, attendu] of [['5.170.0', 0, 'retard'], ['5.168.0', 0, 'retard'], ['5.167.0', 0, 'retard'], [EXT_ATTENDUE, 0, 'ok'], [EXT_ATTENDUE, 4, 'ok']]) {
      remettre(); ventesEnPlus = enPlus; remettre();
      const o = await ouvrir(b, { width: 1512, height: 950 }, false, { pont: { version } });
      await essaie('pont ' + version, async () => {
        await versAnnoncesEbay(o.pg);
        await o.pg.waitForFunction(() => { const e = document.querySelector('[data-ebay-ventes-sans-preuve]'); return e && e.getAttribute('data-ebay-sans-preuve-geste') !== 'absente'; }, null, { timeout: 15000 }).catch(() => {});
        const v = await lire(o.pg);
        const l = v.sansPreuve[0] || {};
        dit(l.geste === attendu, `pont ${version} : le geste est « ${attendu} »${version !== EXT_ATTENDUE ? ' (version PUBLIÉE sans la lecture des transactions : aucune promesse)' : ''}`, `${l.geste} · ${String(l.t || '').slice(0, 200)}`);
        if (attendu === 'retard') dit(!/toute seule sur vinted\.fr/.test(l.t || '') && new RegExp('mets-la à jour \\(' + EXT_ATTENDUE.replace(/\./g, '\\.') + '\\)').test(l.t || ''), `pont ${version} : « mets-la à jour (${EXT_ATTENDUE}) », jamais « elle lit toute seule »`, String(l.t || '').slice(0, 220));
        dit(attendu === 'ok' ? l.promesse === '1' : l.promesse === '0', `pont ${version} : la promesse « elle lit toute seule » ${attendu === 'ok' ? 'est faite (connectée à ce compte VRM)' : 'n\'est PAS faite'}`, String(l.promesse));
        if (attendu === 'ok') {
          const n = Number(l.n);
          dit(/3 par visite/.test(l.t || ''), `pont à jour, ${n} vente(s) : le CHIFFRE est dit (3 par visite)`, String(l.t || '').slice(0, 220));
          dit(n > 3 ? /au fil de tes visites/.test(l.t || '') && !/prochaine visite/.test(l.t || '') : /prochaine visite/.test(l.t || ''), `pont à jour, ${n} vente(s) sur un compte : ${n > 3 ? '« au fil de tes visites », pas « à ta prochaine visite »' : '« à ta prochaine visite »'}`, String(l.t || '').slice(0, 220));
          dit((l.ventes || []).length === n, 'chaque vente est nommée, une ligne chacune', `${(l.ventes || []).length} ligne(s) pour ${n}`);
        }
        dit(o.errs.length === 0, 'aucune erreur de page', o.errs.join(' | ').slice(0, 160));
      });
      await o.ctx.close();
      ventesEnPlus = 0;
    }
    // ── (revue du 11 octobre, défauts 7 et 9) « ELLE LIT TOUTE SEULE » N'EST
    //    PROMIS QU'À UNE EXTENSION CONNECTÉE À CE COMPTE VRM. Sans session, sa
    //    visite s'arrête avant de lire (`visite_sans_session`) ; connectée à un
    //    AUTRE compte, elle écrit ailleurs. La phrase dit alors ce qui bloque
    //    (la phrase de l'indicateur, §11), jamais la promesse.
    console.log('── ventes pas reliées · extension à jour mais pas connectée à ce compte VRM (1512 px)');
    for (const [nom, vrm, session, code] of [
      ['pas connectée', { ok: true, connecte: false, email: '' }, false, 'vrm'],
      ['autre compte VRM', { ok: true, connecte: true, email: 'quelquun@ailleurs.test', user_id: '99999999-8888-7777-6666-555555555555' }, true, 'autre-vrm'],
    ]) {
      remettre();
      const o = await ouvrir(b, { width: 1512, height: 950 }, false, { pont: { version: EXT_ATTENDUE, vrm }, session });
      await essaie('connexion ' + nom, async () => {
        await versAnnoncesEbay(o.pg);
        await o.pg.waitForFunction(() => { const e = document.querySelector('[data-ebay-ventes-sans-preuve]'); return e && e.getAttribute('data-ebay-sans-preuve-geste') === 'ok' && e.getAttribute('data-ebay-sans-preuve-blocage') !== ''; }, null, { timeout: 15000 }).catch(() => {});
        await o.pg.waitForTimeout(1500);
        const l = (await lire(o.pg)).sansPreuve[0] || {};
        dit(l.geste === 'ok' && l.promesse === '0' && !/toute seule/.test(l.t || ''), `${nom} : extension à jour, mais AUCUNE promesse « elle lit toute seule »`, `${l.geste} · ${l.promesse} · ${String(l.t || '').slice(0, 220)}`);
        dit(l.blocage === code, `${nom} : la ligne dit ce qui bloque (« ${code} », la raison de l'indicateur)`, String(l.blocage));
        if (code === 'autre-vrm') dit(/quelquun@ailleurs\.test/.test(l.t || ''), 'autre compte : la ligne nomme l\'adresse sous laquelle l\'extension écrit', String(l.t || '').slice(0, 260));
        dit(/ouvre la vente sur vinted\.fr/.test(l.t || ''), `${nom} : et le geste qui marche quand même (ouvrir la vente)`, String(l.t || '').slice(0, 260));
        dit(o.errs.length === 0, 'aucune erreur de page', o.errs.join(' | ').slice(0, 160));
      });
      await o.ctx.close();
    }
    // ── (relecture croisée de la 5.174) « OU GÉNÈRE SON BORDEREAU (BOUTON
    //    CI-DESSOUS) » NE S'ÉCRIT QU'AU-DESSUS D'UN BOUTON QUI MARCHE. Sur
    //    0caff0d : avec deux extensions, le même paragraphe disait « je n'en
    //    envoie aucune » puis « génère son bordereau (bouton ci-dessous) », et le
    //    bouton était grisé ; idem périmé, autre compte, pas connectée, et sa
    //    5.164 d'aujourd'hui. C'est la règle de l'indicateur qui juge (§11).
    console.log('── ventes pas reliées · « génère son bordereau » seulement si le bouton peut commander (1512 px)');
    for (const [nom, pont, session, bouton] of [
      ['deux extensions (5.174 + 5.164)', { version: EXT_ATTENDUE, vieux: '5.164.0' }, true, false],
      ['code périmé (5.174 sans `code`)', { version: EXT_ATTENDUE, etatCode: {} }, true, false],
      ['5.164 au code d’avant la 5.159', { version: '5.164.0', extra: { offresAutoLocal: false } }, true, false],
      ['5.164 au code 5.95–5.128 (muette)', { version: '5.164.0', muette: true }, true, false],
      ['5.174 pas connectée', { version: EXT_ATTENDUE, vrm: { ok: true, connecte: false, email: '' } }, false, false],
      ['5.174 sur un autre compte VRM', { version: EXT_ATTENDUE, vrm: { ok: true, connecte: true, email: 'quelquun@ailleurs.test', user_id: '99999999-8888-7777-6666-555555555555' } }, true, false],
      ['5.170 connectée (commande possible, lecture des transactions pas encore)', { version: '5.170.0' }, false, true],
    ]) {
      remettre();
      const o = await ouvrir(b, { width: 1512, height: 950 }, false, { pont, session });
      await essaie('génère · ' + nom, async () => {
        await versAnnoncesEbay(o.pg);
        await o.pg.waitForFunction(() => { const e = document.querySelector('[data-ebay-ventes-sans-preuve]'); return e && e.getAttribute('data-ebay-sans-preuve-geste') !== 'absente'; }, null, { timeout: 15000 }).catch(() => {});
        await o.pg.waitForTimeout(2500);
        const l = (await lire(o.pg)).sansPreuve[0] || {};
        const vv = l.ventes || [];
        const t = String(l.t || '');
        if (bouton) dit(vv.length === 1 && vv[0].bord && /génère son bordereau depuis VRM/.test(t), `${nom} : le bouton ET « ou génère son bordereau » (il peut commander)`, JSON.stringify({ bord: vv.map((x) => x.bord), t: t.slice(0, 200) }));
        else dit(vv.length === 1 && !vv[0].bord && !/génère (son|leur) bordereau/.test(t), `${nom} : ni bouton, ni « ou génère son bordereau » (il ne pourrait rien commander)`, JSON.stringify({ bord: vv.map((x) => x.bord), t: t.slice(0, 260) }));
        dit(/ouvre la vente sur vinted\.fr|passe sur vinted\.fr/.test(t), `${nom} : le geste qui marche quand même (ouvrir la vente sur vinted.fr)`, t.slice(0, 220));
        dit(!/n'en envoie aucune[\s\S]*génère/.test(t), `${nom} : jamais « je n'en envoie aucune » puis « génère » dans le même paragraphe`, t.slice(0, 220));
        dit(o.errs.length === 0, 'aucune erreur de page', o.errs.join(' | ').slice(0, 160));
      });
      await o.ctx.close();
    }
    // ── (revue du 11 octobre, défaut 10) LES VENTES D'UN AUTRE COMPTE NE SE
    //    LISENT PAS : la ligne « pas encore reliées » ne peut pas être écrite —
    //    l'écran le DIT (les comptes nommés), au lieu d'être celui où tout est
    //    relié. La preuve, elle, tient (N°22 toujours « à retirer »).
    console.log('── ventes d\'un autre compte illisibles (1512 px)');
    for (const casse of [false, true]) {
      remettre();
      ACCS.push({ id: 2, vinted_user_id: '222', login: 'compte_deux', domain: 'www.vinted.fr', updated_at: auj.toISOString() });
      const v111 = rows.find((r) => r.id === 'harvest_111_orders_sold'); v111.data = { ...v111.data, payload: { my_orders: v111.data.payload.my_orders.filter((o) => o.transaction_id !== 9010) } };
      rows.push({ id: 'harvest_222_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: [{ transaction_id: 9020, conversation_id: 88020, title: 'Jordan 4 noir taille 44', status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: recent(1) }] } } });
      rows.push({ id: 'harvest_222_listings', data: { capturedAt: auj.toISOString(), payload: { items: [] } } });
      const o = await ouvrir(b, { width: 1512, height: 950 }, false, { casse: casse ? (u) => /id=in\./.test(u) && /harvest_222_orders_sold/.test(u) : null });
      await essaie('autre compte ' + (casse ? 'illisible' : 'lu'), async () => {
        await versAnnoncesEbay(o.pg);
        await o.pg.waitForTimeout(2500);
        const v = await lire(o.pg);
        if (!casse) {
          dit(v.sansPreuve.length === 1 && v.sansPreuve[0].n === '1' && /compte_deux/.test(v.sansPreuve[0].t), 'lu : la vente pas reliée de compte_deux est dite (l\'autre sens)', JSON.stringify(v.sansPreuve.map((x) => x.n)));
          dit(v.pasSu.length === 0, 'lu : aucune ligne « pas pu lire »', JSON.stringify(v.pasSu));
        } else {
          dit(v.sansPreuve.length === 0, 'illisible : pas de « ventes pas reliées » inventé', JSON.stringify(v.sansPreuve.map((x) => x.n)));
          dit(v.pasSu.length === 1 && /compte_deux/.test(v.pasSu[0]) && /pas encore reliées/.test(v.pasSu[0]), 'illisible : UNE ligne « pas pu lire » qui NOMME compte_deux et dit ce que ça empêche (rien lu ne vaut pas tout relié)', JSON.stringify(v.pasSu).slice(0, 300));
          dit(JSON.stringify(v.doublons) === '["22"]', 'et la preuve tient : la N°22 reste « à retirer d\'eBay »', JSON.stringify(v.doublons));
        }
        dit(o.errs.length === 0, 'aucune erreur de page', o.errs.join(' | ').slice(0, 160));
      });
      await o.ctx.close();
      ACCS.splice(1);
    }
    // ── (revue du 11 octobre, défaut 11) UN BORDEREAU DÉJÀ CAPTÉ (au
    //    téléchargement, sans l'annonce) : « Générer » répondrait « déjà fait »
    //    sans rien relier. Pas de bouton sur cette vente, et on ne promet pas
    //    qu'un bordereau capté la relie.
    console.log('── vente au bordereau déjà capté, sans annonce (1512 px)');
    for (const version of ['5.164.0', EXT_ATTENDUE]) {
      remettre();
      rows.push({ id: 'harvest_111_label_9010', data: { uid: '111', url: 'https://s3.test/l.pdf', tx: '9010', capturedAt: auj.toISOString(), pdfB64: 'JVBERi0xLjQK' } });
      const o = await ouvrir(b, { width: 1512, height: 950 }, false, { pont: { version } });
      await essaie('bordereau capté ' + version, async () => {
        await versAnnoncesEbay(o.pg);
        await o.pg.waitForFunction(() => { const e = document.querySelector('[data-ebay-ventes-sans-preuve]'); return e && e.getAttribute('data-ebay-sans-preuve-geste') !== 'absente'; }, null, { timeout: 15000 }).catch(() => {});
        await o.pg.waitForTimeout(1200);
        const l = (await lire(o.pg)).sansPreuve[0] || {};
        const vv = l.ventes || [];
        dit(vv.length === 1 && vv[0].tx === '9010' && !vv[0].bord, `pont ${version} : la vente 9010 (bordereau déjà capté) n'a PAS de bouton « Générer le bordereau »`, JSON.stringify(vv.map((x) => x.bord)));
        dit(JSON.stringify(l.captes) === '["9010"]', `pont ${version} : la ligne dit que son bordereau est déjà là`, JSON.stringify(l.captes));
        dit(!/bordereau capté relie/.test(l.t || '') && !/génère (son|leur) bordereau/.test(l.t || ''), `pont ${version} : on ne lui dit ni de générer un bordereau, ni qu'un bordereau capté relie la vente`, String(l.t || '').slice(0, 260));
        dit(o.errs.length === 0, 'aucune erreur de page', o.errs.join(' | ').slice(0, 160));
      });
      await o.ctx.close();
    }
    // ── (revue du 11 octobre, défaut 4) LA PREUVE ARRIVE PENDANT QUE VRM EST
    //    OUVERT. Retrait automatique allumé ; la vente de la N°22 n'a pas encore
    //    son bordereau ; l'extension le range, prévient l'app (maj label /
    //    preuves / ventes) : l'annonce eBay part SANS rechargement — une fois.
    console.log('── retrait automatique : la preuve arrive en cours de session (1512 px)');
    {
      remettre();
      rows[0].data.vrm_ebay_retrait_auto = true;
      const bord9001 = rows.find((r) => r.id === 'harvest_111_label_9001');
      rows = rows.filter((r) => r.id !== 'harvest_111_label_9001');
      const o = await ouvrir(b, { width: 1512, height: 950 }, false, { local: { vrm_ebay_retrait_auto: 'true' } });
      await essaie('preuve en cours de session', async () => {
        const auto = () => o.envois.filter((x) => x.action === 'retirer' && x.auto === true);
        await o.pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
        await o.pg.waitForTimeout(8000);
        dit(auto().length === 0, 'à l\'ouverture, pas encore de preuve ⇒ rien ne part (sinon ce contrôle ne mesure rien)', JSON.stringify(auto()));
        rows.push(bord9001);
        for (const quoi of ['label', 'preuves', 'ventes']) await o.pg.evaluate((q) => window.postMessage({ __vmr: 'evt', evt: { type: 'maj', quoi: q, uid: '111', tx: '9001' } }, '*'), quoi);
        for (let i = 0; i < 30 && !auto().length; i++) await o.pg.waitForTimeout(500);
        const a = auto();
        dit(a.length === 1 && a[0].itemId === '110000000001' && a[0].sku === 'VRM-22', 'la preuve rangée en cours de session ⇒ la N°22 est retirée d\'eBay SANS rechargement', JSON.stringify(a));
        for (const quoi of ['label', 'preuves', 'ventes']) await o.pg.evaluate((q) => window.postMessage({ __vmr: 'evt', evt: { type: 'maj', quoi: q, uid: '111' } }, '*'), quoi);
        await o.pg.waitForTimeout(8000);
        dit(auto().length === 1, 'd\'autres signaux ensuite ne la retirent pas une seconde fois', `${auto().length} envoi(s)`);
        dit(o.errs.length === 0, 'aucune erreur de page', o.errs.join(' | ').slice(0, 160));
      });
      await o.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ eBay → Annonces : ${ko} rouge(s)` : '\n✅ eBay → Annonces : reliées par identité, double vente dite dans les deux sens, offre et retrait derrière confirmation, « pas su » jamais inventé');
  process.exit(ko ? 1 : 0);
})();
