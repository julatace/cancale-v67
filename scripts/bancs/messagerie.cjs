// Banc : LA MESSAGERIE INTÉGRÉE (3 octobre, extension 5.135).
//
// Julien : « il doit y avoir la messagerie intégrée des derniers comptes, avec
// la possibilité de répondre et de faire l'offre ». Ce banc rend le VRAI écran
// Messages sur des conversations INVENTÉES (aucune donnée réelle : il vit dans
// le dépôt, qui est public), rejoue le VRAI dialogue du pont (`ready`, `exec` →
// `result`) et exige :
//   1. la liste des conversations de TOUS les comptes, non lues d'abord, le
//      compte nommé sur chaque ligne (elle mélange ses comptes) ;
//   2. l'offre EN ATTENTE de l'acheteur lue dans le fil (status 10), avec son
//      montant, et « Accepter » qui demande confirmation puis envoie EXACTEMENT
//      `PUT …/transactions/{tx}/offer_requests/{oid}/accept` ;
//   3. « Faire une offre » qui envoie `POST …/transactions/{tx}/offers` au prix
//      saisi ;
//   4. un fil pas encore capté lu PAR L'EXTENSION (`GET …/conversations/{id}`) ;
//   5. une extension trop ancienne (5.134) : aucun geste d'offre proposé, la
//      raison dite — jamais un bouton qui ne peut pas marcher ;
//   6. (6 octobre) une BOÎTE FIGÉE se dit : la dernière vente de `compte_a`
//      est plus récente que sa dernière conversation captée ⇒ une ligne,
//      UNE fois, qui nomme ce compte (et pas `compte_b`, à jour) ; l'autre
//      sens : boîtes à jour ⇒ aucune ligne. Mesuré sur sa base : deux comptes
//      figés sur une page ancienne de leur messagerie (27 juillet / 2 octobre).
//   7. (19 octobre, « messages plus riches ») chaque ligne porte, PAR IDENTITÉ
//      (transaction de la conversation captée → vente du même n° / annonce du
//      même item_id → N° de CETTE annonce), le N°, le prix, l'état de la
//      transaction, qui a écrit en dernier (seulement si le résumé capté porte
//      bien le DERNIER message) et l'heure ; une conversation sans résumé capté
//      n'invente rien. Le fil ouvert commence par la carte de la paire et
//      groupe les messages par jour.
//   8. (19 octobre, « offres sur la liste ») une offre EN ATTENTE se voit sur
//      la LIGNE (« Offre 45 € en attente », le montant de l'OFFRE, jamais le
//      prix de l'annonce), jugée par LA règle du fil (`offreEnAttenteDe`) —
//      même quand l'offre n'est pas le dernier message ; pas de pastille pour
//      une offre acceptée, refusée ou expirée (statut 10 mais « Expirée »), ni
//      quand la lecture des offres échoue (pas su) ; le filtre « Offres ».
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4337;

const auj = Date.now();
const iso = (h) => new Date(auj - h * 3600e3).toISOString();
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(0) },
];
const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: iso(h), description: desc, opposite_user: { id: 5000 + id, login } });
// La forme MESURÉE d'une conversation captée (19 octobre, lecture seule) : la
// transaction porte item_id, status (1 = simple question), current_user_side,
// item_title, item_photo ; chaque message porte created_at_ts (ISO), le dernier
// est le plus récent.
const FIL_OFFRE = { id: 301, opposite_user: { id: 5301, login: 'acheteuse_1' }, transaction: { id: 9001, item_id: 444, status: 1, current_user_side: 'seller', item_title: 'Nike Air Max 1 blanc 42', item_photo: { url: 'https://images1.vinted.net/t/444/f800/a.jpeg' } }, description: 'Nike Air Max 1',
  messages: [
    { id: 1, created_at_ts: iso(54), entity_type: 'message', entity: { id: 1, user_id: 5301, body: 'Bonjour, vous feriez 45 € ?' } },
    { id: 2, created_at_ts: iso(31), entity_type: 'offer_request_message', entity: { id: 2, user_id: 5301, current: true, status: 10, status_title: '', price: { amount: '45.0' }, transaction_id: 9001, offer_request_id: 77 } },
    { id: 3, created_at_ts: iso(30), entity_type: 'message', entity: { id: 3, user_id: 5301, body: 'Je peux payer aujourd’hui' } },
  ] };
// La conversation 303 (compte_a) : une VENTE en cours (status 230), tx 8811 — la
// même que la vente servie plus bas (40 €) ; l'annonce 555 porte le N°12 ; le
// dernier message est de LUI, au même instant que la boîte (26 h).
const FIL_VENTE = { id: 303, opposite_user: { id: 5303, login: 'curieux' }, transaction: { id: 8811, item_id: 555, status: 230, current_user_side: 'seller', item_title: 'Adidas Gazelle bleu 40' },
  messages: [
    { id: 11, created_at_ts: iso(27), entity_type: 'message', entity: { id: 11, user_id: 5303, body: 'Merci pour l’envoi' } },
    { id: 12, created_at_ts: iso(26), entity_type: 'message', entity: { id: 12, user_id: 111, body: 'Merci !' } },
  ] };
const FIL_EXT = { id: 402, opposite_user: { id: 5402, login: 'acheteur_2' }, transaction: { id: 9002 },
  messages: [{ entity_type: 'message', entity: { user_id: 5402, body: 'Message lu par extension' } }] };
// Les conversations de `compte_a` datent d'il y a 26-30 h ; ses ventes (servies
// à part) disent si sa boîte est figée.
const vente = (tx, h) => ({ transaction_id: tx, title: 'Vente ' + tx, price: { amount: '40.0', currency_code: 'EUR' }, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: iso(h) });
const rowsDe = ({ venteA = 3 } = {}) => [
  { id: 'harvest_111_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(301, 'acheteuse_1', 'Vous feriez 45 € ?', true, 30), conv(303, 'curieux', 'Merci !', false, 26)] } } },
  { id: 'harvest_222_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(402, 'acheteur_2', 'Toujours dispo ?', true, 1)] } } },
  { id: 'harvest_111_conv_301', data: { capturedAt: iso(0), payload: { conversation: FIL_OFFRE } } },
  { id: 'harvest_111_conv_303', data: { capturedAt: iso(0), payload: { conversation: FIL_VENTE } } },
  // 402 : un résumé capté PLUS ANCIEN que la boîte (dernier message capté il y a
  // 5 h, la boîte dit 1 h) et sans transaction — il ne doit rien faire dire.
  { id: 'harvest_222_conv_402', data: { capturedAt: iso(5), payload: { conversation: { id: 402, opposite_user: { id: 5402, login: 'acheteur_2' }, messages: [
    { id: 21, created_at_ts: iso(5), entity_type: 'message', entity: { id: 21, user_id: 5402, body: 'Ancien message' } } ] } } } },
  { id: 'harvest_111_listings', data: { uid: '111', type: 'listings', nItems: 1, capturedAt: iso(0), payload: { items: [
    { id: 444, url: 'https://www.vinted.fr/items/444', title: 'Nike Air Max 1 blanc 42', brand: 'Nike', size: '42', price: { amount: '59.0', currency_code: 'EUR' }, photo: { url: 'https://images1.vinted.net/t/444/f800/a.jpeg' }, is_closed: false, is_draft: false, is_hidden: false },
  ] } } },
  // Proposition 6 (6 octobre) : les offres reçues PAR EMAIL, en tête de Messages.
  //  · O1 : récente, sur compte_a → à trancher ;
  //  · O2 : vieille de 20 jours → hors sujet ;
  //  · O3 : sur compte_b, et une vente au MÊME titre UNIQUE sur CE compte, APRÈS
  //    l'offre → réglée, mise de côté (la règle `offresAtraiter`).
  { id: 'email_offer_o1', data: { type: 'offre', receivedAt: iso(2), article: 'Adidas Samba OG blanc 42', montant: '45,00', qui: 'acheteuse_9', uid: '111', account: 'compte_a' } },
  { id: 'email_offer_o2', data: { type: 'offre', receivedAt: iso(24 * 20), article: 'Vieille offre', montant: '10,00', qui: 'ancien', uid: '111', account: 'compte_a' } },
  { id: 'email_offer_o3', data: { type: 'offre', receivedAt: iso(5), article: 'Nike Dunk Low panda 43', montant: '60,00', qui: 'acheteur_3', uid: '222', account: 'compte_b' } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: iso(0), payload: { my_orders: [
    { transaction_id: 8801, title: 'Nike Dunk Low panda 43', price: { amount: '62.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: iso(3) },
  ] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0), payload: { my_orders: [
    { transaction_id: 8701, title: 'Adidas Samba noir 41', price: { amount: '50.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: iso(300) },
    { transaction_id: 8702, title: 'Samba OG 40', price: { amount: '55.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: iso(400) },
    { transaction_id: 8703, title: 'adidas samba 43', price: { amount: '60.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: iso(500) },
    // 5.162 : la dernière vente de compte_a (il y a `venteA` h) — plus récente que
    // sa dernière conversation captée (26 h) ⇒ sa boîte est figée.
    vente(8811, venteA),
  ] } } },
];
const rows = rowsDe();
// 8. Trois conversations dont l'offre n'est PLUS en attente (compte_b) :
//    acceptée (statut 30), refusée (40), et « Expirée » au statut 10 — la base
//    la rend au filtre `cs` (statut 10), c'est la RÈGLE du fil qui l'écarte.
const filOffre = (id, st, titre, px) => ({ id, opposite_user: { id: 5000 + id, login: 'ach_' + id }, transaction: { id: 9100 + id, item_id: 700 + id, status: 1, current_user_side: 'seller', item_title: 'Paire ' + id },
  messages: [
    { id: id * 10 + 1, created_at_ts: iso(10), entity_type: 'offer_request_message', entity: { id: id * 10 + 1, user_id: 5000 + id, current: true, status: st, status_title: titre, price: { amount: px }, transaction_id: 9100 + id, offer_request_id: 800 + id } },
    { id: id * 10 + 2, created_at_ts: iso(9), entity_type: 'message', entity: { id: id * 10 + 2, user_id: 5000 + id, body: 'ok' } },
  ] });
const rowsOffres = () => {
  const r = rowsDe();
  const inbox = r.find((x) => x.id === 'harvest_222_inbox');
  inbox.data.payload.conversations.push(conv(405, 'ach_405', 'Offre acceptée', false, 9), conv(406, 'ach_406', 'Offre refusée', false, 9), conv(407, 'ach_407', 'Offre expirée', false, 9));
  r.push({ id: 'harvest_222_conv_405', data: { capturedAt: iso(0), payload: { conversation: filOffre(405, 30, 'Acceptée', '30.0') } } });
  r.push({ id: 'harvest_222_conv_406', data: { capturedAt: iso(0), payload: { conversation: filOffre(406, 40, 'Refusée', '31.0') } } });
  r.push({ id: 'harvest_222_conv_407', data: { capturedAt: iso(0), payload: { conversation: filOffre(407, 10, 'Expirée', '32.0') } } });
  return r;
};
// jsonb @> : un tableau contient chaque élément de l'autre ; un objet, chaque clé ;
// un scalaire, la même valeur DU MÊME TYPE (10 ≠ "10").
const contient = (a, b) => {
  if (Array.isArray(b)) return Array.isArray(a) && b.every((x) => a.some((y) => contient(y, x)));
  if (b && typeof b === 'object') return !!a && typeof a === 'object' && !Array.isArray(a) && Object.keys(b).every((k) => contient(a[k], b[k]));
  return a === b;
};

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    // Un index de tableau (`->-1` : le dernier) se lit comme PostgREST le lit.
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : (Array.isArray(v) && /^-?\d+$/.test(seg) ? v[Number(seg) < 0 ? v.length + Number(seg) : Number(seg)] : v[seg]);
    out[alias] = v == null ? null : v;
  }
  return out;
};

// Le pont simulé : `version` annoncée ; chaque `exec` est noté et répond comme l'extension.
const PONT = ({ version, filExt, fils }) => {
  if (!version) return;
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_a' }, cmds: {} } });
    if (d.__vmr === 'exec') {
      window.__exec && window.__exec(JSON.stringify({ uid: d.uid, method: d.method, endpoint: d.endpoint, body: d.body }));
      const idc = (/\/conversations\/(\d+)$/.exec(d.endpoint || '') || [])[1];
      const data = d.method === 'GET' ? { conversation: (fils && fils[idc]) || filExt } : {};
      setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data }), 50);
    }
  });
  post({ __vmr: 'ready', version });
};

async function rendre(b, { version, tel = false, lignes = rows, offresKO = false }) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const execs = [];
  await pg.exposeFunction('__exec', (s) => execs.push(JSON.parse(s)));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify({ '444': { numero: '7' }, '555': { numero: '12' } })); } catch (_) {} });
  await pg.addInitScript(PONT, { version, filExt: FIL_EXT, fils: { 301: FIL_OFFRE, 303: FIL_VENTE, 402: FIL_EXT } });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: r.data.capturedAt });
    // Un filtre `chemin=cs.{json}` sur `data` (jsonb @>), comme PostgREST.
    const cs = /[?&](data(?:->[^=&]+)+)=cs\.([^&]*)/.exec(u);
    if (cs && offresKO) return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"panne"}' });
    const garde = cs ? (r) => { let v = r.data; for (const seg of cs[1].replace(/^data->/, '').split('->')) v = v == null ? null : v[seg]; try { return contient(v, JSON.parse(cs[2])); } catch (_) { return false; } } : () => true;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(lignes.filter((r) => r.id === eq[1] && garde(r)).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(lignes.filter((r) => re.test(r.id) && garde(r)).map(forme)); }
    return j([]);
  });
  const proxy = [];
  await pg.route('**/api/**', (r) => { proxy.push(r.request().url()); r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }); });
  await pg.goto(`http://localhost:${PORT}/?tab=cat_msg`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  // ⚠️ Depuis le 9 octobre, le compte ouvert dans Chrome (ici compte_a) est
  //    choisi D'OFFICE et les autres sont estompés, inertes — la demande de
  //    Julien du 7 octobre, qui ne s'allumait jamais (`filtre-compte.cjs`).
  //    Ce banc juge la messagerie de TOUS les comptes : il fait le geste de
  //    Julien pour tout voir, « Tous les comptes ».
  if (await pg.$('#vrm-sel-compte')) { await pg.selectOption('#vrm-sel-compte', '*'); await pg.waitForTimeout(400); }
  return { ctx, pg, errs, execs, proxy };
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH||'/usr/bin/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const tel of [false, true]) {
      console.log(`── extension à jour (5.135) · ${tel ? '390 px' : '1512 px'}`);
      const r = await rendre(b, { version: '5.135.0', tel });
      // 4 octobre : les messages vivent DANS l'onglet Vinted (4ᵉ section) ; l'ancien
      // lien `?tab=cat_msg` (cloche, bandeau) doit y mener.
      const porte = await r.pg.evaluate(() => { const b = document.querySelector('[data-section="messages"]'); return b ? b.getAttribute('aria-current') : 'absente'; });
      dit(porte === 'page', 'l’ancien lien mène aux Messages DANS l’onglet Vinted (section active)', String(porte));
      const liste = await r.pg.evaluate(() => [...document.querySelectorAll('[data-messagerie] [data-conv]')].map((x) => ({ id: x.getAttribute('data-conv'), txt: x.innerText })));
      dit(liste.length === 3, 'les conversations des DEUX comptes sont listées', JSON.stringify(liste.map((x) => x.id)));
      // ⚠️ (16 octobre) L'ordre est : le compte ouvert dans Chrome d'abord (là
      //    où VRM peut répondre — `messages-priorite.cjs`), puis les plus
      //    récentes. Ce banc sert un pont qui RÉPOND aussi à 390 px tactile :
      //    depuis la 5.188 (Firefox pour Android), un téléphone dont l'extension
      //    répond agit ICI — la même priorité vaut donc aux deux tailles (le
      //    téléphone SANS extension est jugé par `pont.cjs`). (L'ancien contrôle
      //    « non lues d'abord » était rouge depuis longtemps : l'app trie par date.)
      //    (19 octobre) Dans chaque groupe, une offre en attente passe devant (301).
      const attendu = ['301', '303', '402'];
      dit(JSON.stringify(liste.map((x) => x.id)) === JSON.stringify(attendu), 'le compte de Chrome d’abord (s’il peut agir), puis les offres en attente, puis les plus récentes', JSON.stringify(liste.map((x) => x.id)));
      dit(liste.some((x) => /compte_a/.test(x.txt)) && liste.some((x) => /compte_b/.test(x.txt)), 'le compte est nommé sur chaque ligne (la liste mélange les comptes)');
      // 7. (19 oct.) la paire, l'état, le dernier auteur, l'heure — sur chaque ligne.
      await r.pg.waitForTimeout(900);
      const rich = await r.pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-messagerie] [data-conv]')].map((x) => [x.getAttribute('data-conv'), {
        num: x.getAttribute('data-conv-num'), prix: x.getAttribute('data-conv-prix'), etat: x.getAttribute('data-conv-etat'), auteur: x.getAttribute('data-conv-auteur'),
        quand: x.getAttribute('data-conv-quand'), compte: x.getAttribute('data-conv-compte'), txt: x.innerText }])));
      const r301 = rich['301'] || {}, r303 = rich['303'] || {}, r402 = rich['402'] || {};
      dit(r301.num === '7' && r301.prix === '59' && r301.etat === 'question', 'une question : le N° et le prix de SON annonce (par item_id), l’état « question »', JSON.stringify(r301));
      dit(r303.num === '12' && r303.prix === '40' && r303.etat === 'vendue', 'une vente : le prix de LA vente (même n° de transaction), son N°, « vendue · en cours »', JSON.stringify(r303));
      dit(/N°12/.test(r303.txt || '') && /40/.test(r303.txt || '') && /Vendue/.test(r303.txt || '') && /Gazelle/.test(r303.txt || ''), 'et c’est écrit sur la ligne (N°, titre, prix, état)', (r303.txt || '').replace(/\n/g, ' | '));
      dit(r303.auteur === 'toi' && /Toi :/.test(r303.txt || '') && r301.auteur === 'eux' && !/Toi :/.test(r301.txt || ''), 'qui a écrit en dernier : « Toi : » sur la sienne, rien sur celle de l’acheteuse', JSON.stringify({ a303: r303.auteur, a301: r301.auteur }));
      dit(!r402.num && !r402.prix && !r402.etat && !r402.auteur, 'un résumé sans transaction ET plus ancien que la boîte : rien d’inventé (ni N°, ni prix, ni état, ni l’auteur d’un AUTRE message)', JSON.stringify(r402));
      dit(!!r301.quand && Math.abs(Date.parse(r301.quand) - (auj - 30 * 3600e3)) < 2000 && /\d{1,2}:\d{2}/.test(r301.txt || ''), 'la date ET l’heure du dernier message', JSON.stringify({ q: r301.quand, t: (r301.txt || '').slice(0, 60) }));
      dit(r301.compte === '111' && r402.compte === '222', 'le compte de chaque conversation est porté par la ligne', JSON.stringify({ c301: r301.compte, c402: r402.compte }));
      // 8. l'offre en attente, sur la LIGNE (elle n'est pas le dernier message du fil)
      const offL = await r.pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-messagerie] [data-conv]')].map((x) => [x.getAttribute('data-conv'), { o: x.getAttribute('data-conv-offre'), p: (x.querySelector('[data-offre-liste]') || {}).innerText || null }])));
      dit(offL['301'] && offL['301'].o === '45' && /Offre 45\s?€ en attente/.test(offL['301'].p || ''), 'la ligne dit « Offre 45 € en attente » — le montant de l’OFFRE (l’annonce est à 59 €)', JSON.stringify(offL['301']));
      dit(offL['303'] && !offL['303'].o && !offL['303'].p && offL['402'] && !offL['402'].o, 'aucune pastille sur une conversation sans offre en attente', JSON.stringify({ a: offL['303'], b: offL['402'] }));
      // (19 oct.) l'offre en attente passe DEVANT une conversation plus récente du même compte.
      const ordre = await r.pg.evaluate(() => [...document.querySelectorAll('[data-messagerie] [data-conv]')].map((x) => ({ id: x.getAttribute('data-conv'), c: x.getAttribute('data-conv-compte'), q: x.getAttribute('data-conv-quand') })));
      const i301 = ordre.findIndex((x) => x.id === '301'), i303 = ordre.findIndex((x) => x.id === '303');
      dit(i301 >= 0 && i303 >= 0 && i301 < i303, 'une conversation avec une offre en attente passe devant une plus récente sans offre', JSON.stringify(ordre));
      // 6. la boîte figée de compte_a (vente il y a 3 h, dernière conversation il y a 26 h)
      const fige = await r.pg.evaluate(() => { const e = document.querySelectorAll('[data-boites-perimees]'); return { n: e.length, uids: e[0] ? e[0].getAttribute('data-boites-perimees') : null, txt: e[0] ? e[0].innerText : '' }; });
      dit(fige.n === 1 && fige.uids === '111', 'une boîte figée se dit, UNE fois, pour le compte concerné seulement', JSON.stringify(fige));
      dit(/compte_a/.test(fige.txt) && !/compte_b/.test(fige.txt) && /messagerie Vinted/.test(fige.txt), 'elle nomme compte_a (pas compte_b, à jour) et dit le geste : ouvrir sa messagerie Vinted', fige.txt);
      // 24 octobre : retrait explicite de l'historique email, même lorsque les données existent.
      dit(await r.pg.locator('[data-offres-messages], [data-offre-email]').count() === 0, 'aucun bloc des offres email au-dessus des conversations');
      // 2. l'offre en attente
      await r.pg.click('[data-conv="301"]');
      await r.pg.waitForTimeout(1200);
      const off = await r.pg.evaluate(() => { const e = document.querySelector('[data-offre]'); return e ? { etat: e.getAttribute('data-offre'), txt: e.innerText } : null; });
      dit(off && off.etat === 'attente' && /45,00/.test(off.txt), 'l’offre de l’acheteur (45 €) est lue dans le fil', JSON.stringify(off));
      // 7 bis. Le fil commence par la carte de la paire, et se groupe par jour.
      const fil = await r.pg.evaluate(() => { const c = document.querySelector('[data-fil-paire]'); const seps = [...document.querySelectorAll('[data-jour-sep]')].map((x) => x.getAttribute('data-jour-sep'));
        return { carte: c ? { item: c.getAttribute('data-fil-paire'), num: c.getAttribute('data-fil-num'), prix: c.getAttribute('data-fil-prix'), etat: c.getAttribute('data-fil-etat'), txt: c.innerText } : null, seps }; });
      dit(fil.carte && fil.carte.item === '444' && fil.carte.num === '7' && fil.carte.prix === '59' && fil.carte.etat === 'question' && /Air Max 1/.test(fil.carte.txt), 'en tête du fil : la carte de la paire (titre, N°7, 59 €, état)', JSON.stringify(fil.carte));
      dit(fil.seps.length === 2 && new Set(fil.seps).size === 2, 'les messages sont groupés par jour (deux jours, deux séparateurs)', JSON.stringify(fil.seps));
      await r.pg.screenshot({ path: path.join(require('os').tmpdir(), 'messagerie-fil-' + (tel ? 390 : 1512) + '.png') });
      await r.pg.getByRole('button', { name: 'Accepter', exact: true }).first().click();
      await r.pg.waitForTimeout(500);
      // Ouvrir un fil le relit par l'extension (une LECTURE, `GET`) : seul un
      // GESTE compte ici.
      dit(r.execs.filter((x) => x.method !== 'GET').length === 0, 'accepter DEMANDE d’abord (vendre la paire à ce prix) — rien n’est parti', JSON.stringify(r.execs));
      await r.pg.locator('div[style*="z-index: 2000"] button', { hasText: 'Accepter' }).click();
      await r.pg.waitForTimeout(900);
      const acc = r.execs.find((x) => x.method === 'PUT');
      dit(acc && acc.endpoint === '/api/v2/transactions/9001/offer_requests/77/accept' && acc.uid === '111', 'puis envoie EXACTEMENT l’acceptation de CETTE offre, au nom de SON compte', JSON.stringify(acc));
      // 3. faire une offre
      await r.pg.getByText('Proposer un autre prix',{exact:true}).click();
      await r.pg.fill('input[aria-label="Prix de l\'offre"]', '50');
      await r.pg.getByRole('button', { name: 'Envoyer l\'offre' }).click();
      await r.pg.waitForTimeout(900);
      const of = r.execs.find((x) => x.method === 'POST' && /offers$/.test(x.endpoint));
      dit(of && of.endpoint === '/api/v2/transactions/9001/offers' && of.body && of.body.offer && of.body.offer.price === '50', 'faire une offre envoie le prix saisi sur la bonne transaction', JSON.stringify(of));
      const txt = await r.pg.evaluate(() => document.body.innerText);
      dit(/Offre de 50,00 € envoyée/.test(txt), 'et le dit');
      // 4. un fil pas encore capté : lu par l'extension
      await r.pg.keyboard.press('Escape');
      await r.pg.evaluate(() => { const o = [...document.querySelectorAll('div')].find((d) => d.style && d.style.position === 'fixed' && d.style.zIndex === '1000'); if (o) o.click(); });
      await r.pg.waitForTimeout(400);
      await r.pg.click('[data-conv="402"]');
      await r.pg.waitForTimeout(1200);
      const get = r.execs.find((x) => x.method === 'GET' && /\/402$/.test(x.endpoint));
      const txt2 = await r.pg.evaluate(() => document.body.innerText);
      dit(get && get.endpoint === '/api/v2/conversations/402' && get.uid === '222', 'un fil pas encore capté est lu PAR L’EXTENSION, au nom du bon compte', JSON.stringify(get));
      dit(/Message lu par extension/.test(txt2), 'et ses messages s’affichent');
      dit(!r.proxy.some((u) => /conversations/.test(u)), 'aucun passage par le serveur pour le lire', JSON.stringify(r.proxy.filter((u) => /conversations/.test(u))));
      const sw = await r.pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(sw.sw <= sw.cw + 1, 'aucun débordement horizontal', `${sw.sw} > ${sw.cw}`);
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.pg.screenshot({ path: path.join(require('os').tmpdir(), 'messagerie-' + (tel ? 390 : 1512) + '.png') });
      await r.ctx.close();
    }
    for (const tel of [false, true]) {
      console.log(`── offres sur la liste : acceptée, refusée, expirée · ${tel ? '390 px' : '1512 px'}`);
      const r = await rendre(b, { version: '5.135.0', tel, lignes: rowsOffres() });
      await r.pg.waitForTimeout(900);
      const o = await r.pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-messagerie] [data-conv]')].map((x) => [x.getAttribute('data-conv'), x.getAttribute('data-conv-offre')])));
      await r.pg.screenshot({ path: path.join(require('os').tmpdir(), 'messagerie-liste-offres-' + (tel ? 390 : 1512) + '.png') });
      dit(Object.keys(o).length === 6, 'les six conversations sont listées', JSON.stringify(Object.keys(o)));
      dit(o['301'] === '45', 'l’offre en attente garde sa pastille', JSON.stringify(o));
      dit(!o['405'] && !o['406'] && !o['407'], 'aucune pastille pour une offre acceptée, refusée ou EXPIRÉE (même au statut 10)', JSON.stringify({ 405: o['405'], 406: o['406'], 407: o['407'] }));
      const f = await r.pg.evaluate(() => { const bt = document.querySelector('[data-filtre-offres]'); return bt ? bt.getAttribute('data-filtre-offres') : null; });
      dit(f === '1', 'le filtre « Offres » compte UNE offre en attente', String(f));
      if (f) {
        await r.pg.click('[data-filtre-offres]');
        await r.pg.waitForTimeout(400);
        const ids = await r.pg.evaluate(() => [...document.querySelectorAll('[data-messagerie] [data-conv]')].map((x) => x.getAttribute('data-conv')));
        dit(JSON.stringify(ids) === '["301"]', 'et ne montre qu’elle', JSON.stringify(ids));
      }
      dit(r.execs.filter((x) => x.method !== 'GET').length === 0, 'aucun geste n’est parti tout seul', JSON.stringify(r.execs));
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.ctx.close();
    }
    for (const tel of [false, true]) {
      console.log(`── lecture des offres EN ÉCHEC (pas su) · ${tel ? '390 px' : '1512 px'}`);
      const r = await rendre(b, { version: '5.135.0', tel, offresKO: true });
      await r.pg.waitForTimeout(900);
      const o = await r.pg.evaluate(() => ({ n: document.querySelectorAll('[data-messagerie] [data-conv]').length, off: [...document.querySelectorAll('[data-conv-offre],[data-offre-liste],[data-filtre-offres]')].length }));
      dit(o.n === 3 && o.off === 0, 'la liste reste, et aucune pastille ni filtre « Offres » sur une lecture ratée', JSON.stringify(o));
      await r.ctx.close();
    }
    // 9. (22 oct.) Une offre arrivée PAR EMAIL et vue dans SA conversation captée
    //    ne s'écrit qu'une fois — par identité (même compte, même acheteur, même
    //    montant, même fenêtre ; le titre de la paire en plus), jamais par
    //    ressemblance. L'offre de 301 (compte_a, acheteuse_1, 45 €, il y a 31 h,
    //    « Nike Air Max 1 blanc 42 ») :
    //     · o5 : la même, l'email porte l'acheteuse → pas réécrite, et c'est DIT ;
    //     · o6 : même compte, même montant, même heure, même titre — mais SANS
    //       acheteur (la forme mesurée sur ses 248 offres) → rien ne prouve que
    //       c'est la même : elle RESTE ;
    //     · o7 : la même acheteuse, 46 € → une autre offre : elle reste.
    for (const tel of [false, true]) {
      console.log(`── une offre vue par email ET dans sa conversation · ${tel ? '390 px' : '1512 px'}`);
      const lignes = rowsDe();
      lignes.push({ id: 'email_offer_o5', data: { type: 'offre', receivedAt: iso(30), article: 'Nike Air Max 1 blanc 42', montant: '45,00', qui: 'acheteuse_1', uid: '111', account: 'compte_a' } });
      lignes.push({ id: 'email_offer_o6', data: { type: 'offre', receivedAt: iso(30), article: 'Nike Air Max 1 blanc 42', montant: '45,00', qui: '', uid: '111', account: 'compte_a' } });
      lignes.push({ id: 'email_offer_o7', data: { type: 'offre', receivedAt: iso(30), article: 'Nike Air Max 1 blanc 42', montant: '46,00', qui: 'acheteuse_1', uid: '111', account: 'compte_a' } });
      const r = await rendre(b, { version: '5.135.0', tel, lignes });
      await r.pg.waitForTimeout(1200);
      const ofs = await r.pg.evaluate(() => { const b = document.querySelector('[data-offres-messages]'); return b ? { n: b.getAttribute('data-offres-messages'), conv: (b.querySelector('[data-offres-dans-conversation]') || {}).getAttribute?.('data-offres-dans-conversation') || null, txt: b.innerText, ids: [...b.querySelectorAll('[data-offre-email]')].map((x) => x.getAttribute('data-offre-email')).sort() } : null; });
      dit(ofs === null, 'les offres email restent absentes, même avec une offre déjà présente dans sa conversation');
      const pastille = await r.pg.evaluate(() => { const x = document.querySelector('[data-messagerie] [data-conv="301"]'); return x ? x.getAttribute('data-conv-offre') : null; });
      dit(pastille === '45', 'la conversation garde sa pastille « Offre 45 € en attente » (c’est là qu’on la tranche)', String(pastille));
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.ctx.close();
    }
    console.log('── boîtes à jour (l’autre sens)');
    {
      // La vente de compte_a est plus ANCIENNE que sa dernière conversation captée.
      const r = await rendre(b, { version: '5.135.0', lignes: rowsDe({ venteA: 40 }) });
      const n = await r.pg.evaluate(() => document.querySelectorAll('[data-boites-perimees]').length);
      const liste = await r.pg.evaluate(() => document.querySelectorAll('[data-messagerie] [data-conv]').length);
      dit(liste === 3 && n === 0, 'boîtes à jour : aucune ligne « n’est plus à jour »', `liste=${liste} · lignes=${n}`);
      await r.ctx.close();
    }
    console.log('── extension TROP ANCIENNE (5.134)');
    {
      const r = await rendre(b, { version: '5.134.0' });
      await r.pg.click('[data-conv="301"]');
      await r.pg.waitForTimeout(1200);
      const off = await r.pg.evaluate(() => { const e = document.querySelector('[data-offre]'); return e ? { etat: e.getAttribute('data-offre'), txt: e.innerText } : null; });
      const boutons = await r.pg.getByRole('button', { name: 'Accepter', exact: true }).count();
      dit(off && off.etat === 'indisponible' && boutons === 0, 'aucun bouton d’offre qui ne peut pas marcher', JSON.stringify(off));
      dit(off && /5\.135\.0/.test(off.txt), 'et la raison est dite (la version qui sait le faire)', off && off.txt);
      await r.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ messagerie : ${ko} rouge(s)` : '\n✅ messagerie : tout est vert');
  process.exit(ko ? 1 : 0);
})();
