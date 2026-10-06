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
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4337;

const auj = Date.now();
const iso = (h) => new Date(auj - h * 3600e3).toISOString();
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(0) },
];
const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: iso(h), description: desc, opposite_user: { id: 5000 + id, login } });
const FIL_OFFRE = { id: 301, opposite_user: { id: 5301, login: 'acheteuse_1' }, transaction: { id: 9001, item_id: 444 }, description: 'Nike Air Max 1',
  messages: [
    { entity_type: 'message', entity: { user_id: 5301, body: 'Bonjour, vous feriez 45 € ?' } },
    { entity_type: 'offer_request_message', entity: { user_id: 5301, current: true, status: 10, status_title: '', price: { amount: '45.0' }, transaction_id: 9001, offer_request_id: 77 } },
  ] };
const FIL_EXT = { id: 402, opposite_user: { id: 5402, login: 'acheteur_2' }, transaction: { id: 9002 },
  messages: [{ entity_type: 'message', entity: { user_id: 5402, body: 'Message lu par extension' } }] };
// Les conversations de `compte_a` datent d'il y a 26-30 h ; ses ventes (servies
// à part) disent si sa boîte est figée.
const vente = (tx, h) => ({ transaction_id: tx, title: 'Vente ' + tx, price: { amount: '40.0', currency_code: 'EUR' }, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: iso(h) });
const rowsDe = ({ venteA = 3 } = {}) => [
  { id: 'harvest_111_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(301, 'acheteuse_1', 'Vous feriez 45 € ?', true, 30), conv(303, 'curieux', 'Merci !', false, 26)] } } },
  { id: 'harvest_222_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(402, 'acheteur_2', 'Toujours dispo ?', true, 5)] } } },
  { id: 'harvest_111_conv_301', data: { capturedAt: iso(0), payload: { conversation: FIL_OFFRE } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0), payload: { my_orders: [vente(8801, venteA)] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: iso(0), payload: { my_orders: [vente(8802, 10)] } } },
];
const rows = rowsDe();

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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

// Le pont simulé : `version` annoncée ; chaque `exec` est noté et répond comme l'extension.
const PONT = ({ version, filExt }) => {
  if (!version) return;
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_a' }, cmds: {} } });
    if (d.__vmr === 'exec') {
      window.__exec && window.__exec(JSON.stringify({ uid: d.uid, method: d.method, endpoint: d.endpoint, body: d.body }));
      const data = d.method === 'GET' ? { conversation: filExt } : {};
      setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data }), 50);
    }
  });
  post({ __vmr: 'ready', version });
};

async function rendre(b, { version, tel = false, lignes = rows }) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const execs = [];
  await pg.exposeFunction('__exec', (s) => execs.push(JSON.parse(s)));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.addInitScript(PONT, { version, filExt: FIL_EXT });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(lignes.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(lignes.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  const proxy = [];
  await pg.route('**/api/**', (r) => { proxy.push(r.request().url()); r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }); });
  await pg.goto(`http://localhost:${PORT}/?tab=cat_msg`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  return { ctx, pg, errs, execs, proxy };
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const tel of [false, true]) {
      console.log(`── extension à jour (5.135) · ${tel ? '390 px' : '1512 px'}`);
      const r = await rendre(b, { version: '5.135.0', tel });
      // 4 octobre : les messages vivent DANS l'onglet Vinted (4ᵉ section) ; l'ancien
      // lien `?tab=cat_msg` (cloche, bandeau) doit y mener.
      const porte = await r.pg.evaluate(() => { const b = document.querySelector('[data-section="messages"]'); return b ? b.getAttribute('aria-current') : 'absente'; });
      dit(porte === 'page', 'l’ancien lien mène aux Messages DANS l’onglet Vinted (section active)', String(porte));
      const liste = await r.pg.evaluate(() => [...document.querySelectorAll('[data-messagerie] [data-conv]')].map((x) => ({ id: x.getAttribute('data-conv'), txt: x.innerText })));
      dit(liste.length === 3, 'les conversations des DEUX comptes sont listées', JSON.stringify(liste.map((x) => x.id)));
      dit(liste.length === 3 && liste[2].id === '303', 'les non lues d’abord, la lue en dernier', JSON.stringify(liste.map((x) => x.id)));
      dit(liste.some((x) => /compte_a/.test(x.txt)) && liste.some((x) => /compte_b/.test(x.txt)), 'le compte est nommé sur chaque ligne (la liste mélange les comptes)');
      // 6. la boîte figée de compte_a (vente il y a 3 h, dernière conversation il y a 26 h)
      const fige = await r.pg.evaluate(() => { const e = document.querySelectorAll('[data-boites-perimees]'); return { n: e.length, uids: e[0] ? e[0].getAttribute('data-boites-perimees') : null, txt: e[0] ? e[0].innerText : '' }; });
      dit(fige.n === 1 && fige.uids === '111', 'une boîte figée se dit, UNE fois, pour le compte concerné seulement', JSON.stringify(fige));
      dit(/compte_a/.test(fige.txt) && !/compte_b/.test(fige.txt) && /messagerie Vinted/.test(fige.txt), 'elle nomme compte_a (pas compte_b, à jour) et dit le geste : ouvrir sa messagerie Vinted', fige.txt);
      // 2. l'offre en attente
      await r.pg.click('[data-conv="301"]');
      await r.pg.waitForTimeout(1200);
      const off = await r.pg.evaluate(() => { const e = document.querySelector('[data-offre]'); return e ? { etat: e.getAttribute('data-offre'), txt: e.innerText } : null; });
      dit(off && off.etat === 'attente' && /45,00/.test(off.txt), 'l’offre de l’acheteur (45 €) est lue dans le fil', JSON.stringify(off));
      await r.pg.getByRole('button', { name: 'Accepter', exact: true }).first().click();
      await r.pg.waitForTimeout(500);
      dit(r.execs.length === 0, 'accepter DEMANDE d’abord (vendre la paire à ce prix) — rien n’est parti', JSON.stringify(r.execs));
      await r.pg.locator('div[style*="z-index: 2000"] button', { hasText: 'Accepter' }).click();
      await r.pg.waitForTimeout(900);
      const acc = r.execs.find((x) => x.method === 'PUT');
      dit(acc && acc.endpoint === '/api/v2/transactions/9001/offer_requests/77/accept' && acc.uid === '111', 'puis envoie EXACTEMENT l’acceptation de CETTE offre, au nom de SON compte', JSON.stringify(acc));
      // 3. faire une offre
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
      const get = r.execs.find((x) => x.method === 'GET');
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
