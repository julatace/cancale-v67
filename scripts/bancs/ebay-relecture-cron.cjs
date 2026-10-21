// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE CRON DU MATIN RELIT eBAY AVANT DE COMPTER (node scripts/bancs/ebay-relecture-cron.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (20 octobre) : « pour eBay ça doit se relire tout seul […] je dois rien
// avoir à faire ». App fermée, seul le cron quotidien `api/ship-reminders.js`
// tourne : il doit relire les commandes eBay de CHAQUE vendeur, avec SON jeton
// (comptes actifs de SON registre), avant de calculer le rappel — une vente eBay
// de la nuit doit être dans le rappel du matin.
// §4.10 : la VRAIE route est exécutée (faux Supabase à état, faux eBay).
// Base CLOISONNÉE, deux vendeurs :
//   · A : une commande eBay neuve chez eBay, rien en base ⇒ relue avec le jeton
//     de A, rangée chez A, comptée dans SON rappel ;
//   · B : eBay refuse ses commandes ⇒ rien n'est écrit chez B (la capture
//     d'avant reste), et le rappel de B part quand même (sa vente eBay connue).
// Aucun jeton d'un vendeur ne sert pour l'autre. Données inventées.
// §6.1 : sur le code d'avant (pas de relecture), A n'a aucun colis eBay compté.
const path = require('path');
const RACINE = process.env.BANC_RACINE || path.join(__dirname, '..', '..');

process.env.EBAY_APP_ID = 'app-banc';
process.env.EBAY_CERT_ID = 'cert-banc';
process.env.SUPABASE_SERVICE_KEY = 'service-banc';

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const demain = new Date(Date.now() + 86400000).toISOString();
const cmd = (id) => ({ orderId: id, orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', creationDate: new Date().toISOString(),
  fulfillmentStartInstructions: [{ fulfillmentInstructionsType: 'SHIP_TO' }],
  lineItems: [{ lineItemId: 'L' + id, sku: 'VRM-1', title: 'Paire ' + id, lineItemFulfillmentInstructions: { shipByDate: demain } }],
  pricingSummary: { total: { value: '50.00', currency: 'EUR' } } });

let store, appelsEbay, jetonsVus, ecritures, appelsTrading;
function poser({ ebayKO = new Set() } = {}) {
  store = new Map();
  appelsEbay = []; jetonsVus = []; ecritures = []; appelsTrading = [];
  const put = (o, id, data) => store.set(o + '|' + id, data);
  // A : registre implicite (principal), jeton RT-A, aucune commande en base.
  put(A, 'ebay_tokens', { refresh_token: 'RT-A' });
  put(A, 'main', {});
  // B : jeton RT-B, une commande déjà connue (capture d'hier).
  put(B, 'ebay_tokens', { refresh_token: 'RT-B' });
  put(B, 'ebay_orders', { orders: [cmd('B-OLD')], capturedAt: Date.now() - 86400000, rev: 1 });
  put(B, 'main', {});
  const ebayCmd = { 'AT-RT-A': { orders: [cmd('A-NUIT')], total: 1, limit: 50, offset: 0 }, 'AT-RT-B': { orders: [cmd('B-NUIT')], total: 1, limit: 50, offset: 0 } };
  const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    const meth = (opts.method || 'GET').toUpperCase();
    if (/^https:\/\/push\//.test(u)) return new Response('', { status: 201 });
    if (u.includes('identity/v1/oauth2/token')) {
      const rt = (/refresh_token=([^&]+)/.exec(String(opts.body || '')) || [])[1];
      return J({ access_token: 'AT-' + rt, expires_in: 7200 });
    }
    if (u.includes('/auth/v1/user')) return J({ id: A, email: 'a@banc.test' });
    if (u.includes('/rpc/vrm_acces_pour')) return J(true);
    if (u.includes('/ws/api.dll')) {
      const nom = String((opts.headers || {})['X-EBAY-API-CALL-NAME'] || '');
      appelsTrading.push(nom);
      // (21 oct.) La page 1 des messages : 1 sans réponse récent, 1 répondu, 1 trop vieux (> 7 j).
      if (nom === 'GetMemberMessages') {
        const ex = (id, st, jours, rep) => `<MemberMessageExchange><Item><ItemID>900</ItemID><Title>Paire 900</Title></Item><Question><MessageID>${id}</MessageID><SenderID>acheteur_secret</SenderID><Subject>Dispo ?</Subject><Body>Texte privé</Body></Question>${rep ? '<Response>Oui</Response>' : ''}<MessageStatus>${st}</MessageStatus><CreationDate>${new Date(Date.now() - jours * 86400000).toISOString()}</CreationDate></MemberMessageExchange>`;
        return new Response(`<GetMemberMessagesResponse><Ack>Success</Ack><MemberMessage>${ex('M1', 'Unanswered', 1)}${ex('M2', 'Answered', 1, true)}${ex('M3', 'Unanswered', 10)}</MemberMessage><PaginationResult><TotalNumberOfPages>1</TotalNumberOfPages></PaginationResult></GetMemberMessagesResponse>`, { status: 200 });
      }
      if (nom === 'AddMemberMessageRTQ') return new Response('<AddMemberMessageRTQResponse><Ack>Success</Ack></AddMemberMessageRTQResponse>', { status: 200 });
      return new Response('<GetMyeBaySellingResponse><Ack>Success</Ack><ActiveList><Item><ItemID>900</ItemID><Title>Paire 900</Title><SKU>VRM-1</SKU><SellingStatus><CurrentPrice>50.00</CurrentPrice></SellingStatus></Item><PaginationResult><TotalNumberOfPages>1</TotalNumberOfPages></PaginationResult></ActiveList></GetMyeBaySellingResponse>', { status: 200 });
    }
    if (u.includes('/sell/fulfillment/v1/order')) {
      const tok = String((opts.headers || {}).Authorization || '').replace('Bearer ', '');
      appelsEbay.push(tok); jetonsVus.push(tok);
      const owner = tok === 'AT-RT-A' ? A : tok === 'AT-RT-B' ? B : null;
      if (owner && ebayKO.has(owner)) return new Response('<html>503</html>', { status: 503 });
      return ebayCmd[tok] ? J(ebayCmd[tok]) : J({ errors: [{ message: 'jeton inconnu' }] }, 401);
    }
    if (!u.includes('/rest/v1/')) return J([]);
    if (/select=owner&limit=1/.test(u)) return J([{ owner: A }]);
    if (meth === 'GET' && /id=eq\.main/.test(u) && /select=owner/.test(u) && !/owner=eq\./.test(u)) return J([{ owner: A }, { owner: B }]);
    const o = (/owner=eq\.([^&]+)/.exec(u) || [])[1] || null;
    if (meth === 'POST') {
      let rows = []; try { rows = JSON.parse(opts.body || '[]'); } catch (_) {}
      for (const r of (Array.isArray(rows) ? rows : [rows])) { if (r && r.id) { ecritures.push({ owner: r.owner, id: r.id }); store.set((r.owner || '') + '|' + r.id, r.data); } }
      return new Response('', { status: 201 });
    }
    if (meth === 'PATCH') {
      const id = (/id=eq\.([^&]+)/.exec(u) || [])[1];
      const k = o + '|' + id;
      if (!store.has(k)) return J([]);
      const body = JSON.parse(opts.body || '{}');
      ecritures.push({ owner: o, id }); store.set(k, body.data);
      return J([{ id }]);
    }
    if (!o) return J([]);
    const eq = (/[?&]id=eq\.([^&]+)/.exec(u) || [])[1];
    const like = (/[?&]id=like\.([^&]+)/.exec(u) || [])[1];
    const sel = (/select=([^&]+)/.exec(u) || [])[1] || 'data';
    const projette = (id, d) => {
      if (sel === 'data') return { data: d };
      const out = {};
      for (const part of sel.split(',')) {
        const [alias, chemin] = part.includes(':') ? part.split(':') : [part, part];
        if (chemin === 'id') { out[alias] = id; continue; }
        const m = /^data->>?(.+)$/.exec(chemin);
        if (m) out[alias] = d ? d[m[1].split('->')[0]] : undefined;
      }
      return out;
    };
    if (eq) { const d = store.get(o + '|' + eq); return J(d === undefined ? [] : [projette(eq, d)]); }
    if (like) {
      const pre = like.replace(/[%*]+$/, '');
      const rows = [];
      for (const [k, d] of store) { const [ow, id] = k.split('|'); if (ow === o && id.startsWith(pre)) rows.push(projette(id, d)); }
      return J(rows);
    }
    return J([]);
  };
}

const res = () => ({ code: null, corps: null, status(n) { this.code = n; return this; }, json(c) { this.corps = c; return this; }, setHeader() {}, end() { return this; } });

(async () => {
  poser({ ebayKO: new Set([B]) });
  const mod = await import('file://' + path.join(RACINE, 'api', 'ship-reminders.js'));
  const r = res();
  await mod.default({ method: 'GET', headers: {}, query: {} }, r);
  const bil = (o) => ((r.corps && r.corps.bilans) || []).find((b) => b.owner === o) || {};
  const ordA = store.get(A + '|ebay_orders');
  const ordB = store.get(B + '|ebay_orders');
  dit(jetonsVus.includes('AT-RT-A'), 'A : ses commandes eBay relues avec SON jeton, sans aucun geste', 'jetons=' + jetonsVus.join(','));
  dit(jetonsVus.includes('AT-RT-B'), 'B : relu aussi, avec SON jeton (chacun sa synchro)');
  dit(!!(ordA && Array.isArray(ordA.orders) && ordA.orders.some((x) => x.orderId === 'A-NUIT')), 'A : la vente eBay de la nuit est rangée chez A', ordA ? ordA.orders.map((x) => x.orderId).join(',') : 'rien');
  dit(!!(ordB && ordB.orders.length === 1 && ordB.orders[0].orderId === 'B-OLD'), 'B : eBay en panne ⇒ rien n\'est écrit, la capture d\'hier reste (rien n\'est vidé)', ordB ? ordB.orders.map((x) => x.orderId).join(',') : 'absente');
  dit(!ecritures.some((e) => e.id === 'ebay_orders' && e.owner === A && ordA && ordA.orders.some((x) => x.orderId.startsWith('B'))), 'aucune commande de B rangée chez A');
  const dA = store.get(A + '|ship_reminder_dedup');
  const dB = store.get(B + '|ship_reminder_dedup');
  dit(!!(dA && dA.total === 1), 'A : le rappel du matin compte la vente eBay de la nuit', 'total=' + (dA && dA.total));
  dit(!!(dB && dB.total === 1), 'B : l\'échec de SA relecture ne bloque pas SON rappel (sa vente connue est comptée)', 'total=' + (dB && dB.total));
  dit(bil(A).ebayRelu && bil(A).ebayRelu.ok === 1, 'le bilan de A dit la relecture faite', JSON.stringify(bil(A).ebayRelu));
  dit(bil(B).ebayRelu && bil(B).ebayRelu.ko === 1, 'le bilan de B dit la relecture ratée', JSON.stringify(bil(B).ebayRelu));
  dit(r.code === 200, 'la réponse du cron reste 200 (une relecture ratée n\'est pas une panne du rappel)', 'code=' + r.code);

  // ── 2. L'ACTION `relire` DE api/ebay.js (celle que l'app appelle sans geste) ─
  //    Deux lectures seulement (commandes + GetMyeBaySelling), le détail d'une
  //    annonce déjà rangé est GARDÉ, aucune GetItem.
  poser();
  store.set(A + '|ebay_listings', { items: [{ itemId: '900', title: 'Paire 900', detail: { description: 'desc gardée', photos: ['p1'] } }], capturedAt: 1 });
  const eb = await import('file://' + path.join(RACINE, 'api', 'ebay.js'));
  const r2 = res();
  await eb.default({ method: 'POST', headers: { authorization: 'Bearer a.b.c' }, query: {}, body: { action: 'relire' } }, r2);
  const lst = store.get(A + '|ebay_listings');
  dit(r2.code === 200 && r2.corps && r2.corps.ok === true, 'action relire : 200 ok', 'code=' + r2.code + ' ' + JSON.stringify(r2.corps).slice(0, 160));
  dit(!!(store.get(A + '|ebay_orders') || {}).orders, 'action relire : commandes rangées chez A');
  dit(!!(lst && lst.items && lst.items[0] && lst.items[0].detail && lst.items[0].detail.description === 'desc gardée'), 'action relire : le détail déjà rangé de l\'annonce est gardé');
  dit(appelsTrading.filter((x) => x !== 'GetMemberMessages').join(',') === 'GetMyeBaySelling' && !appelsTrading.includes('GetItem'), 'action relire : GetMyeBaySelling + la page 1 des messages, aucune GetItem', appelsTrading.join(','));
  // (21 oct.) Le résumé des messages SANS RÉPONSE est rangé chez A — sans
  // aucune donnée personnelle — pour que Ma journée le lise sans appeler eBay.
  const msg = store.get(A + '|ebay_messages');
  dit(appelsTrading.includes('GetMemberMessages') && msg && msg.nonLus === 1 && Array.isArray(msg.ids) && msg.ids.join(',') === 'M1' && msg.complet === true,
    'action relire : le résumé des messages est rangé (1 sans réponse de moins de 7 j ; le répondu et le vieux ne comptent pas)', JSON.stringify(msg));
  dit(msg && !/acheteur_secret|Texte privé|Dispo/.test(JSON.stringify(msg)), 'action relire : le résumé ne porte ni nom, ni texte, ni sujet', JSON.stringify(msg));
  dit(!ecritures.some((e) => e.id === 'ebay_messages' && e.owner !== A), 'action relire : le résumé est rangé chez A seulement');
  // Une réponse acceptée par eBay sort l'échange du compte, sans relire eBay.
  const r3 = res();
  await eb.default({ method: 'POST', headers: { authorization: 'Bearer a.b.c' }, query: {}, body: { action: 'repondre', itemId: '900', messageId: 'M1', body: 'Oui, dispo', confirme: true } }, r3);
  const msg2 = store.get(A + '|ebay_messages');
  dit(r3.code === 200 && msg2 && msg2.nonLus === 0 && msg2.ids.length === 0, 'repondre : la réponse acceptée sort l\'échange du résumé (0 sans réponse)', 'code=' + r3.code + ' ' + JSON.stringify(msg2));
  // Une page 1 ILLISIBLE n'écrit rien : le résumé d'avant reste.
  poser();
  store.set(A + '|ebay_messages', { nonLus: 4, ids: ['X1', 'X2', 'X3', 'X4'], complet: true, capturedAt: 1 });
  const fetchAvant = global.fetch;
  global.fetch = async (url, opts = {}) => (String(url).includes('/ws/api.dll') && String((opts.headers || {})['X-EBAY-API-CALL-NAME']) === 'GetMemberMessages') ? new Response('<html>503</html>', { status: 503 }) : fetchAvant(url, opts);
  const r4 = res();
  await eb.default({ method: 'POST', headers: { authorization: 'Bearer a.b.c' }, query: {}, body: { action: 'relire' } }, r4);
  const msg3 = store.get(A + '|ebay_messages');
  dit(r4.code === 200 && msg3 && msg3.nonLus === 4, 'messages illisibles chez eBay : rien n\'est écrit, le résumé d\'avant reste (jamais « 0 »)', JSON.stringify(msg3));
  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTous les contrôles passent — le cron relit eBay pour chaque vendeur, avec son jeton, avant le rappel.');
  process.exit(ko ? 1 : 0);
})();
