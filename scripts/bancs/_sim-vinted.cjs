// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  LE FAUX VINTED DE LA SIMULATION (24 nov.) — www.vinted.fr, api.vinted.fr, à la FORME MESURÉE
//
//  Une page unique (SPA) servie pour toute adresse HTML de www.vinted.fr : un en-tête avec la cloche, la liste de la
//  cloche lue sur `api.vinted.fr/inbox-notifications/v1/notifications` (forme mesurée : `notifications[]`,
//  `pagination`, chaque ligne `{id, body, link, photo, is_read, user_id, entry_type, photo_type, subject_id, updated_at,
//  small_photo_url}`, `link` = le lien d'APPLICATION `vintedfr://messaging?item_id=N&user_id=N&portal=fr`), une ligne
//  web par favori (`/inbox/want_it/new?receiver_id=&item_id=`), le clic qui ouvre la conversation par la page
//  (`POST api.vinted.fr/messaging/main/inquiries` 201 `{inquiry_id, transaction_id, conversation_id, read_after_write_token}`),
//  `/inbox/{uuid}` relue par `GET …/messaging/main/conversations/{uuid}` (nouvelle messagerie : `core_id_deprecated`,
//  `opposite_users[]`, `data.order_id`, `data.escrow_order_id`, PAS de `data.items`), la commande
//  `GET api.vinted.fr/escrow-orders/api/v2/escrow-orders/{id}` (`escrow_order.{id, items[], buyer_id, conversation_id,
//  current_user_side}`), l'offre (`POST /api/v2/transactions/{tx}/offers`) et le message
//  (`POST …/messaging/main/conversations/{uuid}/replies`), tous envoyés PAR LA PAGE quand VRM clique.
//  Le compte qui parle : le cookie `access_token_web` (domaine .vinted.fr). Chaque requête est NOTÉE.
//  Données INVENTÉES (dépôt public).
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
const crypto = require('crypto');

function fauxVinted({ jetonVinted, lireJwt }) {
  const st = {
    req: [],              // { h, m, p, q, uid, corps, status, t, origine }
    comptes: {},          // uid → { login, annonces:[{id,titre,prix}] , favoris:[{nid,itemId,userId,login}] }
    convs: new Map(),     // uuid → { uuid, core, itemId, buyer, seller, tx, order, messages:[], offres:[] }
    forcer: [],           // [{ h:'api', m:'POST', re, status, corps, fois }]
    captchaSur: null,     // RegExp de chemin : la page montre un captcha DataDome quand elle y arrive
    commande: {},         // réglages de la commande servie (désaccords) : { buyer, item, conv, cote }
    ancienneConv: 200,    // GET www /api/v2/conversations/{core} pour une conversation de la nouvelle messagerie
    lienWeb: 'receiver_id',
    n: 0,
  };
  const cookieUid = (req) => {
    const m = /(?:^|;\s*)access_token_web=([^;]+)/.exec(String(req.headers.cookie || ''));
    const pl = m && lireJwt(m[1]);
    return pl && pl.account_id ? String(pl.account_id) : null;
  };
  const uuid = () => { const h = crypto.randomBytes(16).toString('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-7${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
  const rep = (req, res, code, corps, en = {}) => {
    if (res.writableEnded) return;
    const o = String(req.headers.origin || '');
    const html = typeof corps === 'string' && /^\s*</.test(corps);
    res.writeHead(code, Object.assign({ 'content-type': html ? 'text/html; charset=utf-8' : 'application/json',
      ...(o ? { 'access-control-allow-origin': o, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type,x-csrf-token,x-anon-id,accept,x-banc-site', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' } : {}) }, en));
    res.end(typeof corps === 'string' ? corps : JSON.stringify(corps));
  };
  const notifs = (uid) => {
    const c = st.comptes[uid]; if (!c) return [];
    return (c.favoris || []).map((f, i) => ({
      id: f.nid, body: `${f.login} a ajouté ton article à ses favoris`, link: lienNotif(f),
      photo: { id: Number(f.itemId) * 10, url: `https://images1.vinted.net/t/${f.itemId}/f800/photo.jpeg` }, is_read: false, user_id: Number(f.userId),
      entry_type: 20, photo_type: 'item', subject_id: Number(f.itemId), updated_at: new Date(Date.now() - (i + 1) * 600000).toISOString(),
      small_photo_url: `https://images1.vinted.net/t/${f.itemId}/f100/photo.jpeg`,
    }));
  };
  // Les deux formes MESURÉES du lien d'une notification de favori : le lien d'application (angeled92 depuis le 23 nov.)
  // et l'adresse web d'avant (les autres comptes).
  const lienNotif = (f) => f.forme === 'web' ? `/items/${f.itemId}/want_it/new?offering_id=${f.userId}` : `vintedfr://messaging?item_id=${f.itemId}&user_id=${f.userId}&portal=fr`;
  st.lienNotif = lienNotif;
  const convJson = (cv) => ({ conversation: {
    id: cv.uuid, core_id_deprecated: cv.core, conversation_type: 'inquiry', allow_reply: true, is_read: true, opposite_users: [{ id: Number(cv.buyer), login: cv.login, photo: null }],
    data: { id: 'd-' + cv.core, order_id: cv.order, escrow_order_id: cv.order, transaction_id: cv.tx },
    messages: cv.messages.map((m) => ({ id: m.id, entity_type: 'message', data: { body: m.texte }, sender_id: Number(m.de), created_at: m.at })),
  } });
  const commandeJson = (cv) => {
    const k = st.commande || {};
    return { escrow_order: { id: cv.order, items: [{ item_id: Number(k.item || cv.itemId), title: 'Article', price: { amount: '60.0', currency_code: 'EUR' } }],
      buyer_id: Number(k.buyer || cv.buyer), conversation_id: k.conv || cv.uuid, current_user_side: k.cote || 'seller', status: 'pending' } };
  };

  async function servir(req, res, url, corps, host) {
    const p = url.pathname, m = req.method;
    if (m === 'OPTIONS') return rep(req, res, 204, '');
    if (p === '/banc/connexion') {
      const uid = url.searchParams.get('uid');
      res.writeHead(302, { location: url.searchParams.get('vers') || '/', 'set-cookie': [`access_token_web=${jetonVinted(uid)}; Domain=.vinted.fr; Path=/; Secure; HttpOnly; SameSite=Lax`, `refresh_token_web=rt-${uid}; Domain=.vinted.fr; Path=/; Secure; HttpOnly; SameSite=Lax`, 'anon_id=anon-sim; Domain=.vinted.fr; Path=/; Secure; SameSite=Lax'] });
      return res.end();
    }
    const uid = cookieUid(req);
    const e = { h: host, m, p, q: url.search, uid, corps: corps || '', t: Date.now(), origine: String(req.headers.origin || '') };
    if (host === 'www.vinted.fr' && !p.startsWith('/api/') && !/\.(js|png|svg|json|ico)$/.test(p)) { e.page = true; st.req.push(e); return rep(req, res, 200, PAGE(st, uid)); }
    st.req.push(e);
    const fin = (code, c) => { e.status = code; return rep(req, res, code, c); };
    await new Promise((r) => setTimeout(r, 30));
    const f = st.forcer.find((x) => (!x.h || host.startsWith(x.h)) && x.m === m && x.re.test(p) && x.fois > 0);
    if (f) { f.fois--; return fin(f.status, f.corps || { code: f.status, message: 'Too Many Requests' }); }
    const c = uid && st.comptes[uid];
    if (!c) return fin(401, { code: 100, message: 'Token is invalid' });
    if (host === 'api.vinted.fr') {
      if (p === '/inbox-notifications/v1/notifications' && m === 'GET') { const l = notifs(uid); return fin(200, { notifications: l, pagination: { current_page: 1, total_pages: 1, total_entries: l.length, per_page: 20 } }); }
      if (p === '/inbox-notifications/v1/notifications/unread_count') return fin(200, { unread_count: (c.favoris || []).length });
      if (p === '/messaging/main/inquiries' && m === 'POST') {
        let b = {}; try { b = JSON.parse(corps || '{}'); } catch (_) {}
        const itemId = String(b.item_id || ''), buyer = String(b.receiver_id || b.user_id || '');
        const fav = (c.favoris || []).find((x) => x.itemId === itemId && x.userId === buyer);
        if (!fav) return fin(404, { code: 404, message: 'not found' });
        let cv = [...st.convs.values()].find((x) => x.itemId === itemId && x.buyer === buyer && x.seller === uid);
        if (!cv) { const n = ++st.n; cv = { uuid: uuid(), core: 1900000000 + n, itemId, buyer, login: fav.login, seller: uid, tx: 15000000000 + n, order: 26000000 + n, messages: [], offres: [] }; st.convs.set(cv.uuid, cv); }
        return fin(201, { inquiry_id: 'inq-' + cv.core, transaction_id: cv.tx, conversation_id: cv.uuid, read_after_write_token: 'rawt-' + cv.core });
      }
      let mm = /^\/messaging\/main\/conversations\/([0-9a-f-]{36})(\/replies)?$/.exec(p);
      if (mm) {
        const cv = st.convs.get(mm[1]); if (!cv || cv.seller !== uid) return fin(404, { code: 404 });
        if (mm[2] && m === 'POST') { let b = {}; try { b = JSON.parse(corps || '{}'); } catch (_) {} const id = 'm-' + (++st.n); const at = new Date().toISOString(); cv.messages.push({ id, texte: String(b.content || b.body || ''), de: uid, at }); return fin(201, { id, data: { id, content: String(b.content || '') }, sender_id: Number(uid), created_at: at, message_type: 'text', conversation_id: cv.uuid }); }
        return fin(200, convJson(cv));
      }
      mm = /^\/escrow-orders\/api\/v2\/escrow-orders\/(\d+)$/.exec(p);
      if (mm) { const cv = [...st.convs.values()].find((x) => String(x.order) === mm[1] && x.seller === uid); return cv ? fin(200, commandeJson(cv)) : fin(404, { code: 404 }); }
      return fin(404, { code: 404, message: 'not found' });
    }
    // www.vinted.fr/api/v2
    if (p === '/api/v2/users/current') return fin(200, { user: { id: Number(uid), login: c.login, business: false, item_count: (c.annonces || []).length } });
    let mm = /^\/api\/v2\/conversations\/(\d+)$/.exec(p);
    if (mm) { const cv = [...st.convs.values()].find((x) => String(x.core) === mm[1]);
      if (cv && st.ancienneConv !== 200) return fin(st.ancienneConv, { code: st.ancienneConv, message: 'not found' });
      // La forme mesurée de l'ancienne relecture (tête : code, conversation.{id, messages, allow_reply, subtitle…}), complétée des
      // champs que l'extension lit déjà depuis toujours (opposite_user, transaction).
      if (cv) { const a = (c.annonces || []).find((x) => String(x.id) === cv.itemId); return fin(200, { code: 0, conversation: { id: cv.core, subtitle: a ? a.titre : '', translated: false, allow_reply: true, localization: 'fr', is_suspicious: false, read_by_current_user: true, read_by_opposite_user: false, is_deletion_restricted: false,
        opposite_user: { id: Number(cv.buyer), login: cv.login }, transaction: { id: cv.tx, item_id: Number(cv.itemId), item_title: a ? a.titre : '', item: { id: Number(cv.itemId), price: { amount: String(a ? a.prix : 60), currency_code: 'EUR' }, is_closed: false } },
        messages: cv.messages.map((m2) => ({ id: m2.id, entity_type: 'message', entity: { body: m2.texte, user_id: Number(m2.de) }, created_at_ts: m2.at })) } }); } }
    mm = /^\/api\/v2\/transactions\/(\d+)\/offers$/.exec(p);
    if (mm && m === 'POST') {
      const cv = [...st.convs.values()].find((x) => String(x.tx) === mm[1] && x.seller === uid); if (!cv) return fin(404, { code: 404 });
      let b = {}; try { b = JSON.parse(corps || '{}'); } catch (_) {}
      const prix = String((b.offer && b.offer.price) || b.price || ''); cv.offres.push(prix);
      return fin(200, { code: 0, offer: { id: 7700 + st.n, price: { amount: prix, currency_code: 'EUR' }, status: 'pending' } });
    }
    mm = /^\/api\/v2\/transactions\/(\d+)$/.exec(p);
    if (mm) { const cv = [...st.convs.values()].find((x) => String(x.tx) === mm[1] && x.seller === uid); const a = cv && (c.annonces || []).find((x) => String(x.id) === cv.itemId);
      return cv ? fin(200, { transaction: { id: cv.tx, item_id: Number(cv.itemId), item_title: a ? a.titre : 'Article', item: { id: Number(cv.itemId), title: a ? a.titre : '', price: { amount: String(a ? a.prix : 60), currency_code: 'EUR' }, is_closed: false, is_reserved: false, is_hidden: false }, offer: { price: { amount: String(a ? a.prix : 60), currency_code: 'EUR' } } } }) : fin(404, { code: 404 }); }
    mm = /^\/api\/v2\/wardrobe\/(\d+)\/items$/.exec(p);
    if (mm) { const cible = st.comptes[mm[1]]; const items = cible ? (cible.annonces || []).map((a) => ({ id: a.id, title: a.titre, price: { amount: String(a.prix), currency_code: 'EUR' }, brand_title: 'Nike', size_title: '42', status: 'Très bon état', is_closed: false, is_hidden: false, is_draft: false, is_reserved: false, url: `https://www.vinted.fr/items/${a.id}-a`, favourite_count: 2, view_count: 10, photos: [{ id: a.id * 10, url: `https://images1.vinted.net/t/${a.id}/f800/photo.jpeg`, full_size_url: `https://images1.vinted.net/t/${a.id}/f800/photo.jpeg`, is_main: true }], user: { id: Number(mm[1]), login: cible.login }, created_at_ts: Math.floor(Date.now() / 1000) - 86400 })) : [];
      return fin(200, { items, pagination: { current_page: 1, total_pages: 1, total_entries: items.length, per_page: 200 } }); }
    if (p === '/api/v2/my_orders') return fin(200, { my_orders: [], pagination: { current_page: 1, total_pages: 1, total_entries: 0, per_page: 100 } });
    if (p === '/api/v2/inbox') return fin(200, { conversations: [], pagination: { current_page: 1, total_pages: 1, total_entries: 0 } });
    return fin(200, {});
  }
  return { st, servir };
}

// ── LA PAGE (une SPA minimale qui fait ce que fait Vinted quand on clique) ────────────────────────────────────
function PAGE(st, uid) {
  const O = { lienWeb: st.lienWeb, captcha: st.captchaSur ? st.captchaSur.source : '' };
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Vinted (simulation)</title><style>
body{margin:0;font-family:system-ui,sans-serif;background:#f6f6f6;color:#111}header{display:flex;gap:14px;align-items:center;height:60px;padding:0 20px;background:#fff;border-bottom:1px solid #ddd}
header .logo{color:#09b1ba;font-weight:700;font-size:24px;margin-right:auto}header button,header a{min-width:44px;height:44px;display:inline-grid;place-items:center;background:none;border:0;color:#111;text-decoration:none;font-size:15px}
#pan{position:absolute;top:60px;right:20px;width:380px;background:#fff;border:1px solid #ccc;box-shadow:0 6px 20px #0002;display:none;z-index:5}#pan.on{display:block}
.rang{display:block;padding:12px;border-bottom:1px solid #eee;color:#111;text-decoration:none}main{padding:20px;max-width:760px}#fil p{background:#fff;border-radius:8px;padding:8px 12px;margin:6px 0}
textarea{width:420px;min-height:44px;display:block;margin:8px 0}.btn{height:44px;padding:0 16px;border-radius:6px;border:1px solid #09b1ba;background:#09b1ba;color:#fff}
[role=dialog]{position:fixed;top:120px;left:50%;transform:translateX(-50%);background:#fff;border:1px solid #999;padding:20px;width:320px;z-index:9}
</style></head><body>
<header><span class="logo">Vinted</span><a href="/inbox" aria-label="Messages">✉</a><button type="button" id="cloche" aria-label="Notifications" aria-expanded="false" aria-haspopup="true"><svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 2a5 5 0 0 0-5 5v4l-2 2v1h14v-1l-2-2V7a5 5 0 0 0-5-5z"/></svg></button><a href="/member/${uid || 0}">Moi</a></header>
<div id="pan"><div id="lignes"></div><a class="rang" href="/member/notifications">Voir tout</a></div>
<main id="m"><h1>Accueil</h1></main>
<script>(() => {
  const O = ${JSON.stringify(O)};
  const api = (p, o) => fetch('https://api.vinted.fr' + p, Object.assign({ credentials: 'include' }, o || {}));
  const m = document.getElementById('m'), pan = document.getElementById('pan'), cl = document.getElementById('cloche');
  const captcha = () => { if (O.captcha && new RegExp(O.captcha).test(location.pathname) && !document.getElementById('ddc')) { const f = document.createElement('iframe'); f.id = 'ddc'; f.src = 'https://geo.captcha-delivery.com/captcha/?initialCid=sim'; f.style.cssText = 'position:fixed;top:80px;left:40px;width:400px;height:300px;border:2px solid #c00;background:#fff;z-index:99'; document.body.appendChild(f); } };
  const rendreFil = async (u) => {
    const r = await api('/messaging/main/conversations/' + u); const j = await r.json(); const c = j.conversation || {};
    m.innerHTML = '<h1>Conversation</h1><div id="fil"></div><button type="button" class="btn" id="offreB">Faire une offre</button><form id="f"><textarea data-testid="conversation-message-input" placeholder="Écris un message"></textarea><button type="submit" class="btn" aria-label="Envoyer">Envoyer</button></form>';
    const fil = document.getElementById('fil'); for (const x of c.messages || []) { const p = document.createElement('p'); p.textContent = (x.data && x.data.body) || ''; fil.appendChild(p); }
    document.getElementById('offreB').onclick = () => {
      const d = document.createElement('div'); d.setAttribute('role', 'dialog'); d.innerHTML = '<h2>Faire une offre</h2><input type="text" inputmode="decimal" aria-label="Prix" name="price"><div style="margin-top:12px"><button type="button" class="btn" id="prop">Proposer</button></div>';
      document.body.appendChild(d);
      d.querySelector('#prop').onclick = async () => {
        const prix = String(d.querySelector('input').value).replace(',', '.').replace(/[^0-9.]/g, '');
        const r2 = await fetch('/api/v2/transactions/' + c.data.transaction_id + '/offers', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offer: { price: prix, currency: 'EUR' } }) });
        d.remove(); if (r2.ok) { const p = document.createElement('p'); p.textContent = 'Offre : ' + Number(prix).toFixed(2).replace('.', ',') + ' €'; fil.appendChild(p); }
      };
    };
    document.getElementById('f').onsubmit = async (e) => {
      e.preventDefault(); const t = m.querySelector('textarea').value;
      const r3 = await api('/messaging/main/conversations/' + u + '/replies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: t }) });
      if (r3.ok) { const p = document.createElement('p'); p.textContent = t; fil.appendChild(p); m.querySelector('textarea').value = ''; }
    };
  };
  const route = () => {
    captcha();
    const u = (location.pathname.match(/^\\/inbox\\/([0-9a-f-]{36})/) || [])[1];
    if (u) return rendreFil(u);
    if (/^\\/member\\/notifications/.test(location.pathname)) { m.innerHTML = '<h1>Notifications</h1><div id="tout"></div>'; return lireNotifs(document.getElementById('tout')); }
    if (/^\\/inbox/.test(location.pathname)) m.innerHTML = '<h1>Messages</h1><p>Choisis une conversation.</p>';
  };
  const lireNotifs = async (dans) => {
    const r = await api('/inbox-notifications/v1/notifications?page=1&per_page=20'); if (!r.ok) return; const j = await r.json();
    dans.innerHTML = (j.notifications || []).map((n) => { const q = /item_id=(\\d+)&user_id=(\\d+)/.exec(n.link); const href = q ? '/inbox/want_it/new?' + O.lienWeb + '=' + q[2] + '&item_id=' + q[1] : n.link; return '<a class="rang" data-testid="notification-item" href="' + href + '">' + n.body.replace(/</g, '') + '</a>'; }).join('');
  };
  cl.addEventListener('click', async () => { const on = !pan.classList.contains('on'); if (on) await lireNotifs(document.getElementById('lignes')); pan.classList.toggle('on', on); cl.setAttribute('aria-expanded', on ? 'true' : 'false'); });
  document.addEventListener('click', async (e) => {
    const a = e.target.closest && e.target.closest('a'); if (!a || a.target) return;
    const u = new URL(a.href); if (u.origin !== location.origin) return;
    e.preventDefault(); pan.classList.remove('on'); cl.setAttribute('aria-expanded', 'false');
    if (/want_it/.test(u.pathname)) {
      const iw = (u.pathname.match(/^\\/items\\/(\\d+)\\//) || [])[1];
      const r = await api('/messaging/main/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: iw || u.searchParams.get('item_id'), receiver_id: u.searchParams.get('receiver_id') || u.searchParams.get('user_id') || u.searchParams.get('offering_id') }) });
      if (!r.ok) return; const j = await r.json(); history.pushState({}, '', '/inbox/' + j.conversation_id); return route();
    }
    history.pushState({}, '', u.pathname + u.search); route();
  }, true);
  addEventListener('popstate', route); route();
})();</script></body></html>`;
}

module.exports = { fauxVinted };
