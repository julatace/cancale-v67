// ── BANC : ALERTE ARNAQUE DANS LES MESSAGES (11 nov., lot anti-arnaque)
// Données INVENTÉES (aucune donnée réelle), à la forme des lignes que lit l'app
// (boîte et fils Vinted `harvest_*`, `lbc_fil_*`/`vc_fil_*` en scalaires `meta`).
//   A. Messages · Vinted : « 1 conversation à surveiller », la pastille sur 301 SEULE
//      (302 : C'EST LUI qui écrit WhatsApp + un 06 ; 303 : acheteur normal) ;
//   B. 301 ouverte : bannière ambre « Attention · arnaque possible », motif codeSms en
//      tête, horsPlateforme gardé, le geste et « Signale-le sur Vinted » ;
//   C. 302 et 303 ouvertes : AUCUNE bannière (ses messages, messages normaux) ;
//   D. Messages · Tous : compteur 1 (Leboncoin ; l'aperçu Vinted de la boîte n'a pas d'auteur ⇒ pas compté), le fil Leboncoin ouvert
//      porte la bannière paiementHors ;
//   E. aucune commande ni écriture (jamais d'action automatique) ;
//   F. 390 px tactile et 1512 px, clair ET sombre : rien ne déborde ; captures.
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4473);
const CAP = process.env.SHOTS || path.join(require('os').tmpdir(), 'vrm-bancs');
const auj = Date.now();
const iso = (h) => new Date(auj - h * 3600e3).toISOString();
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

const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0) }];
const conv = (id, qui, login, desc, h) => ({ id, unread: true, updated_at: iso(h), description: desc, opposite_user: { id: qui, login } });
const fil = (id, qui, login, tx, item, titre, msgs) => ({ id, opposite_user: { id: qui, login }, transaction: tx ? { id: tx, item_id: item, status: 1, current_user_side: 'seller', item_title: titre } : undefined,
  messages: msgs.map(([mid, h, de, body]) => ({ id: mid, created_at_ts: iso(h), entity_type: 'message', entity: { id: mid, user_id: de, body } })) });
// 301 : l'acheteur demande le code reçu par SMS (arnaque) ; 302 : C'EST LUI qui écrit WhatsApp et un 06 (jamais une alerte) ;
// 303 : un acheteur normal (« je paie via Vinted », n° de suivi, point relais).
const ARNAQUE = 'Pour valider envoie-moi le code que tu as reçu par SMS, et ajoute-moi sur WhatsApp';
const LIGNES = [
  { id: 'harvest_111_inbox', data: { capturedAt: iso(0), payload: { conversations: [
    conv(301, 5301, 'acheteuse_1', ARNAQUE, 2), conv(302, 5302, 'acheteur_2', 'Mon WhatsApp : 06 12 34 56 78', 3), conv(303, 5303, 'acheteur_3', 'Je paie via Vinted tout de suite', 4),
  ] } } },
  { id: 'harvest_111_conv_301', data: { capturedAt: iso(0), payload: { conversation: fil(301, 5301, 'acheteuse_1', 9001, 444, 'Nike Air Max 1 blanc 42', [[1, 3, 5301, 'Bonjour, toujours dispo ?'], [2, 2, 5301, ARNAQUE]]) } } },
  { id: 'harvest_111_conv_302', data: { capturedAt: iso(0), payload: { conversation: fil(302, 5302, 'acheteur_2', 9002, 555, 'Adidas Gazelle bleu 40', [[3, 4, 5302, 'Vous faites 35 € ?'], [4, 3, 111, 'Mon WhatsApp : 06 12 34 56 78']]) } } },
  { id: 'harvest_111_conv_303', data: { capturedAt: iso(0), payload: { conversation: fil(303, 5303, 'acheteur_3', 9003, 666, 'New Balance 550 43', [[5, 5, 5303, 'Mon point relais : Tabac du Centre, 12 rue de la Paix, 75002 Paris'], [6, 4, 5303, 'Je paie via Vinted tout de suite, numéro de suivi 6A12345678901 ?']]) } } },
  { id: 'harvest_111_listings', data: { uid: '111', type: 'listings', nItems: 3, capturedAt: iso(0), payload: { items: [
    { id: 444, url: 'https://www.vinted.fr/items/444', title: 'Nike Air Max 1 blanc 42', price: { amount: '59.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false },
    { id: 555, url: 'https://www.vinted.fr/items/555', title: 'Adidas Gazelle bleu 40', price: { amount: '40.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false },
    { id: 666, url: 'https://www.vinted.fr/items/666', title: 'New Balance 550 43', price: { amount: '70.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false },
  ] } } },
  { id: 'lbc_fil_c0c0c0c0-1111-4222-8333-944455556666', data: { v: 1, conv: 'c0c0c0c0-1111-4222-8333-944455556666', compte: 'L1', n: 2, dernierAt: iso(3), apercu: 'Je te paie par PayPal entre proches', dernierDeMoi: false,
    messages: [{ id: 'l1', t: 'Toujours dispo ?', deMoi: false, at: iso(4) }, { id: 'l2', t: 'Je te paie par PayPal entre proches', deMoi: false, at: iso(3) }] } },
  { id: 'lbc_messages', data: { compteurs: {}, comptes: { L1: { name: 'Totomondu' } } } },
  { id: 'vc_fil_vc-777', data: { v: 1, conv: 'vc-777', compte: 'V1', productId: '9988', ref: '', n: 1, dernierAt: iso(1), apercu: 'Elle est toujours là ?', dernierDeMoi: false,
    messages: [{ id: 'v1', t: 'Elle est toujours là ?', deMoi: false, at: iso(1) }] } },
  { id: 'vc_messages', data: { conversations: { 'vc-777': { productId: '9988', titre: 'Gazelle bleu', nonLu: true, compte: 'V1' } } } },
  { id: 'vc_listings', data: { liens: { 9988: '12' }, items: {} } },
];
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : (Array.isArray(v) && /^-?\d+$/.test(seg) ? v[Number(seg) < 0 ? v.length + Number(seg) : Number(seg)] : v[seg]);
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const PONT = ({ version }) => {
  window.__cmds = [];
  if (!version) return;
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_a' }, cmds: {} } });
    if (d.__vmr === 'cmd' || (d.__vmr === 'exec' && d.method !== 'GET')) window.__cmds.push(JSON.stringify({ v: d.__vmr, cmd: d.cmd, method: d.method, endpoint: d.endpoint }));
    if (d.__vmr === 'exec') setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: false, status: 0, data: null }), 30);
  });
  post({ __vmr: 'ready', version });
};
async function ouvrir(b, vp, { sombre = false, url = '/?tab=messages&site=toutes', relies = null } = {}) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecritures = [];
  await pg.addInitScript(({ s, relies }) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false');
    localStorage.setItem('vinted_annonce_numeros', JSON.stringify({ '444': { numero: '7' }, '555': { numero: '12' }, '666': { numero: '13' } }));
    if (relies) localStorage.setItem('vrm_fils_relies', JSON.stringify(relies));
  } catch (_) {} }, { s: sombre, relies });
  await pg.addInitScript(PONT, { version: '5.335.0' });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') { ecritures.push(u); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, ecritures };
}

const attendre = async (pg, sel, ms = 15000) => pg.waitForSelector(sel, { timeout: ms }).catch(() => null);
(async () => {
  fs.mkdirSync(CAP, { recursive: true });
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/opt/pw-browsers/chromium'), args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre, nom] of [[{ width: 1512, height: 950 }, false, '1512-clair'], [{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 950 }, true, '1512-sombre']]) {
      const principal = nom === '1512-clair' || nom === '390-clair';
      // A — la liste Vinted
      const r = await ouvrir(b, vp, { sombre, url: '/?tab=messages&site=vinted' });
      await attendre(r.pg, '[data-conv="301"]');
      await r.pg.waitForTimeout(1200);
      const cpt = await r.pg.$eval('[data-arnaque-compteur]', (x) => x.getAttribute('data-arnaque-compteur')).catch(() => null);
      dit(cpt === '1', `A · ${nom} : « 1 conversation à surveiller »`, String(cpt));
      const pastilles = await r.pg.$$eval('[data-conv] [data-arnaque-ligne]', (l) => l.map((x) => x.closest('[data-conv]').getAttribute('data-conv') + ':' + x.getAttribute('data-arnaque-ligne')));
      dit(pastilles.length === 1 && pastilles[0] === '301:codeSms', `A · ${nom} : la pastille sur 301 seule (302 = ses messages, 303 normal)`, pastilles.join(',') + ' · sources ' + JSON.stringify(await r.pg.$$eval('[data-conv]', (l) => l.map((x) => x.getAttribute('data-conv') + ':' + ((x.querySelector('[data-conv-extrait-source]') || {}).getAttribute ? x.querySelector('[data-conv-extrait-source]').getAttribute('data-conv-extrait-source') : '?')))));
      await r.pg.screenshot({ path: path.join(CAP, 'anti-arnaque-liste-' + nom + '.png') });
      // B — 301 ouverte
      await r.pg.click('[data-conv="301"]');
      const ban = await attendre(r.pg, '.vrm-chat-panel [data-arnaque]', 10000);
      const info = ban ? await ban.evaluate((x) => ({ m: x.getAttribute('data-arnaque'), ms: x.getAttribute('data-arnaque-motifs'), n: x.getAttribute('data-arnaque-n'), sig: (x.querySelector('[data-arnaque-signaler]') || {}).getAttribute ? x.querySelector('[data-arnaque-signaler]').getAttribute('href') : null, bord: getComputedStyle(x).borderTopColor })) : null;
      dit(info && info.m === 'codeSms' && /horsPlateforme/.test(info.ms) && info.n === '1', `B · ${nom} : 301 ⇒ bannière codeSms en tête, horsPlateforme gardé`, JSON.stringify(info));
      dit(info && /vinted\.fr\/inbox\/301/.test(info.sig || ''), `B · ${nom} : « Signale-le sur Vinted » mène à la conversation sur Vinted`, info && info.sig);
      dit(info && /rgb\((178, 80, 0|255, 179, 64)\)/.test(info.bord), `B · ${nom} : ambre (geste à faire)`, info && info.bord);
      await r.pg.waitForTimeout(300);
      await r.pg.screenshot({ path: path.join(CAP, 'anti-arnaque-fil-' + nom + '.png') });
      if (principal) {
        // C — 302 (ses messages) et 303 (normal) : aucune bannière
        for (const id of ['302', '303']) {
          if (vp.width < 600) { await r.pg.click('.vrm-chat-panel .vrm-chat-back').catch(() => {}); await attendre(r.pg, `[data-conv="${id}"]`); await r.pg.waitForTimeout(500); }
          await r.pg.click(`[data-conv="${id}"]`).catch(() => {});
          await attendre(r.pg, `.vrm-chat-panel .vrm-bulle`, 10000);
          await r.pg.waitForTimeout(500);
          const ouverte = await r.pg.$eval('[data-conv-ouverte]', (x) => x.getAttribute('data-conv-ouverte')).catch(() => null);
          const n = await r.pg.$$eval('.vrm-chat-panel [data-arnaque]', (l) => l.length);
          dit(n === 0 && (vp.width < 600 || ouverte === id), `C · ${nom} : ${id} ouverte ⇒ aucune bannière`, `ouverte ${ouverte}, ${n} bannière(s)`);
        }
      }
      const deborde = await r.pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      dit(deborde <= 1, `F · ${nom} : rien ne déborde (Vinted)`, String(deborde));
      dit(!r.errs.length, `F · ${nom} : aucune erreur (Vinted)`, r.errs.join(' | '));
      const cmds = await r.pg.evaluate(() => window.__cmds || []);
      dit(!cmds.length && !r.ecritures.some((u) => /harvest_|lbc_|vc_|signal/.test(u)), `E · ${nom} : aucune commande ni écriture`, cmds.join(' | ') + ' ' + r.ecritures.join(' | '));
      await r.ctx.close();
      // D — Tous
      const t = await ouvrir(b, vp, { sombre, url: '/?tab=messages&site=toutes' });
      await t.pg.waitForFunction(() => { const e = document.querySelector('[data-fils-tous]'); return e && e.getAttribute('data-fils-tous') !== 'charge' && document.querySelectorAll('[data-fil]').length >= 4; }, null, { timeout: 20000 }).catch(() => {});
      await t.pg.waitForTimeout(600);
      const ct = await t.pg.$eval('[data-fils-tous] [data-arnaque-compteur]', (x) => x.getAttribute('data-arnaque-compteur')).catch(() => null);
      // La ligne Vinted de « Tous » porte l'aperçu de la BOÎTE (auteur pas su, filUnique `deMoi: null`) : jamais comptée.
      dit(ct === '1', `D · ${nom} : Tous ⇒ « 1 conversation à surveiller » (Leboncoin, auteur prouvé ; l'aperçu Vinted de la boîte n'a pas d'auteur)`, String(ct));
      await t.pg.screenshot({ path: path.join(CAP, 'anti-arnaque-tous-' + nom + '.png') });
      const lb = await t.pg.$('[data-fil][data-fil-sites="leboncoin"]');
      if (lb) await lb.click();
      const bl = await attendre(t.pg, '[data-lbc-fil-ouvert] [data-arnaque]', 10000);
      const ml = bl ? await bl.getAttribute('data-arnaque') : null;
      dit(ml === 'paiementHors', `D · ${nom} : le fil Leboncoin porte la bannière paiementHors`, String(ml));
      await t.pg.waitForTimeout(300);
      await t.pg.screenshot({ path: path.join(CAP, 'anti-arnaque-lbc-' + nom + '.png') });
      const d2 = await t.pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      dit(d2 <= 1, `F · ${nom} : rien ne déborde (Tous)`, String(d2));
      dit(!t.errs.length, `F · ${nom} : aucune erreur (Tous)`, t.errs.join(' | '));
      await t.ctx.close();
    }
  } catch (e) { ko++; console.log('KO  le banc a planté — ' + (e && e.stack || e)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} contrôle(s) rouge(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
