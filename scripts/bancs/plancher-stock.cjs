// Banc : LOT F (9 nov.) — le PLANCHER sous chaque offre, et « TU AS DÉJÀ N PAIRES
// DE CE MODÈLE EN STOCK » à la saisie d'un achat.
//
// Rend le VRAI écran Messages et le VRAI écran Achats sur des données INVENTÉES
// (le dépôt est public), en 390 px tactile SOMBRE puis 1512 px, et exige :
//   Messages
//   1. N°80 (achat 95 € + frais 8 € confirmés) : l'offre de 100 € dit « En dessous
//      de 103 € tu perds de l'argent » et « te ferait perdre 3 € », en AMBRE (C.warn,
//      jamais le rouge des doublons) ; la ligne de la liste porte « à perte » ;
//   2. N°81 (aucun prix d'achat) : AUCUN plancher, « Prix d'achat pas saisi » et la
//      porte « Saisir le prix d'achat » (qui DEMANDE, n'écrit rien si on annule) ;
//   3. N°82 (achat 70 €, frais pas confirmés, mini 60 €) : « au moins », l'offre
//      au-dessus n'est pas dite à perte, « Ton prix mini (60 €) est sous ce
//      plancher » — le mini n'est pas changé ;
//   4. aucune phrase ne dit à quel prix vendre ; rien n'est écrit (fiches intactes,
//      aucune action envoyée à l'extension).
//   Achats → « + Ajouter » (achat hors plateforme)
//   5. taper « Nike Air Max 90 blanc 42 » ⇒ « Tu as déjà 3 paires de ce modèle en
//      stock » (Air Max 90 en 42 : N°82, 83, 84 — ni la Samba ni l'Air Force 1) ;
//      toucher ⇒ les 3 paires (N°, photo, taille, en ligne depuis N j) ;
//      « Adidas Air Max 90 » (marque différente) ⇒ rien ; aucune écriture pendant la frappe.
// Captures : <tmp>/plancher-stock-{390,1512}-{fil,liste,achat}.png
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4397;
const CAP = process.env.BANC_CAPTURES || os.tmpdir();

const auj = Date.now();
const iso = (h) => new Date(auj - h * 3600e3).toISOString();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'boutique_test', domain: 'www.vinted.fr', updated_at: iso(0) }];
const conv = (id, login, desc, h) => ({ id, unread: true, updated_at: iso(h), description: desc, opposite_user: { id: 5000 + id, login } });
const fil = (id, item, titre, prix, h) => ({ id, opposite_user: { id: 5000 + id, login: 'acheteur_' + id }, transaction: { id: 9000 + id, item_id: item, status: 1, current_user_side: 'seller', item_title: titre },
  messages: [
    { id: 1, created_at_ts: iso(h + 0.2), entity_type: 'message', entity: { id: 1, user_id: 5000 + id, body: 'Bonjour, elle est toujours dispo ?' } },
    { id: 2, created_at_ts: iso(h), entity_type: 'offer_request_message', entity: { id: 2, user_id: 5000 + id, current: true, status: 10, status_title: '', price: { amount: prix }, transaction_id: 9000 + id, offer_request_id: 70 + id } },
  ] });
const SAL = 'Salomon XT-6 blanc', AM = 'Nike Air Max 90 blanche taille 42';
const FILS = { 501: fil(501, 801, SAL, '100.0', 2), 502: fil(502, 802, SAL, '90.0', 3), 503: fil(503, 803, AM, '110.0', 4) };
const annonce = (id, titre, brand, prix, joursEnLigne) => ({ id, url: 'https://www.vinted.fr/items/' + id, title: titre, brand, size: '42', price: { amount: prix, currency_code: 'EUR' },
  photo: { url: 'https://images1.vinted.net/t/' + id + '/f800/a.jpeg' }, created_at_ts: Math.floor((auj - joursEnLigne * 86400e3) / 1000), is_closed: false, is_draft: false, is_hidden: false, favourite_count: 2, view_count: 30 });
const ITEMS = [annonce(801, SAL, 'Salomon', '120.0', 5), annonce(802, SAL, 'Salomon', '130.0', 6), annonce(803, AM, 'Nike', '120.0', 40), annonce(804, AM, 'Nike', '115.0', 12),
  annonce(805, 'Nike Air Max 90 blanc 42', 'Nike', '110.0', 3), annonce(806, 'Adidas Samba noire 42', 'Adidas', '80.0', 9), annonce(807, 'Nike Air Force 1 blanche 42', 'Nike', '90.0', 7)];
const LIGNES = [
  { id: 'harvest_111_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(501, 'acheteur_501', 'Offre', 2), conv(502, 'acheteur_502', 'Offre', 3), conv(503, 'acheteur_503', 'Offre', 4)] } } },
  ...Object.entries(FILS).map(([id, c]) => ({ id: 'harvest_111_conv_' + id, data: { capturedAt: iso(0), payload: { conversation: c } } })),
  { id: 'harvest_111_listings', data: { uid: '111', type: 'listings', nItems: ITEMS.length, capturedAt: iso(0), payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(0), payload: { my_orders: [] } } },
];
const NUMEROS = {
  '801': { numero: '80', min: '105', buyPrice: '95', fees: '8', fraisComplets: true },
  '802': { numero: '81', min: '125' },
  '803': { numero: '82', min: '60', buyPrice: '70' },
  '804': { numero: '83' }, '805': { numero: '84' }, '806': { numero: '85' }, '807': { numero: '86' },
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
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : (Array.isArray(v) && /^-?\d+$/.test(seg) ? v[Number(seg) < 0 ? v.length + Number(seg) : Number(seg)] : v[seg]);
    out[alias] = v == null ? null : v;
  }
  return out;
};
const PONT = ({ version, fils }) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'boutique_test' }, cmds: {} } });
    if (d.__vmr === 'exec') {
      window.__exec && window.__exec(JSON.stringify({ method: d.method, endpoint: d.endpoint }));
      const idc = (/\/conversations\/(\d+)$/.exec(d.endpoint || '') || [])[1];
      setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data: d.method === 'GET' ? { conversation: fils[idc] || null } : {} }), 50);
    }
  });
  post({ __vmr: 'ready', version });
};

async function rendre(b, tel, url) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}), colorScheme: tel ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const execs = [], ecrits = [];
  await pg.exposeFunction('__exec', (s) => execs.push(JSON.parse(s)));
  await pg.addInitScript(({ n, sombre }) => { try { if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1'); localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); } catch (_) {} }, { n: NUMEROS, sombre: tel });
  await pg.addInitScript(PONT, { version: '5.335.0', fils: FILS });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecrits.push({ m: req.method(), u, corps: req.postData() || '' }); return j([]); }
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
  await pg.goto(`http://localhost:${PORT}/${url}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, execs, ecrits };
}
const gestes = (r) => r.execs.filter((x) => x.method !== 'GET');
const fiches = (pg) => pg.evaluate(() => localStorage.getItem('vinted_annonce_numeros'));
const VENDRE = /vends?\s+(à|a)\s|prix conseill|conseill|mets-la\s+(à|a)/i;

async function messages(b, tel) {
  const T = tel ? '390 sombre' : '1512';
  const r = await rendre(b, tel, '?tab=cat_msg');
  const tap = async (sel) => { if (tel) await r.pg.locator(sel).first().tap(); else await r.pg.locator(sel).first().click(); };
  try {
    await r.pg.waitForSelector('[data-conv="501"]', { timeout: 20000 }).catch(() => {});
    await r.pg.waitForTimeout(1500);
    const avant = await fiches(r.pg);
    const ligne = await r.pg.evaluate(() => { const e = document.querySelector('[data-conv="501"] [data-offre-sous-plancher]'); return e ? { t: e.innerText, c: getComputedStyle(e).color } : null; });
    const ligne3 = await r.pg.evaluate(() => !!document.querySelector('[data-conv="503"] [data-offre-sous-plancher]') || !!document.querySelector('[data-conv="502"] [data-offre-sous-plancher]'));
    dit(ligne && /à perte/.test(ligne.t) && !ligne3 && (ligne.c === 'rgb(178, 80, 0)' || ligne.c === 'rgb(255, 179, 64)'), `${T} la liste : « à perte » en ambre sur l’offre de 100 € (N°80) seulement`, JSON.stringify(ligne));
    await r.pg.screenshot({ path: path.join(CAP, `plancher-stock-${tel ? 390 : 1512}-liste.png`) });

    await tap('[data-conv="501"]');
    await r.pg.waitForSelector('[data-plancher]', { timeout: 10000 }).catch(() => {});
    await r.pg.waitForTimeout(600);
    const p1 = await r.pg.evaluate(() => { const e = document.querySelector('.vrm-chat-offre [data-plancher]'); return e ? { etat: e.getAttribute('data-plancher'), cents: e.getAttribute('data-plancher-cents'), t: e.innerText, c: getComputedStyle(e).color } : null; });
    dit(p1 && p1.etat === 'sous' && p1.cents === '10300' && /En dessous de 103\s€ tu perds de l’argent/.test(p1.t) && /te ferait perdre 3\s€/.test(p1.t) && !/au moins/.test(p1.t), `${T} N°80 : « En dessous de 103 € tu perds de l’argent. Cette offre te ferait perdre 3 € »`, JSON.stringify(p1));
    const rouges = ['rgb(215, 0, 21)', 'rgb(255, 105, 97)'];
    dit(p1 && !rouges.includes(p1.c) && (p1.c === 'rgb(178, 80, 0)' || p1.c === 'rgb(255, 179, 64)'), `${T} en ambre, jamais rouge`, p1 && p1.c);
    dit(p1 && !VENDRE.test(p1.t), `${T} la ligne ne dit pas à quel prix vendre`);
    await r.pg.evaluate(() => { const h = document.querySelector('.vrm-chat-history'); if (h) h.scrollTop = h.scrollHeight; });
    await r.pg.screenshot({ path: path.join(CAP, `plancher-stock-${tel ? 390 : 1512}-fil.png`) });
    if (tel) { await tap('.vrm-chat-back'); await r.pg.waitForTimeout(500); }

    await tap('[data-conv="502"]');
    await r.pg.waitForSelector('[data-plancher="achat"]', { timeout: 10000 }).catch(() => {});
    await r.pg.waitForTimeout(400);
    const p2 = await r.pg.evaluate(() => { const e = document.querySelector('.vrm-chat-offre [data-plancher]'); return e ? { etat: e.getAttribute('data-plancher'), cents: e.getAttribute('data-plancher-cents'), t: e.innerText, lien: !!e.querySelector('[data-plancher-saisir]') } : null; });
    dit(p2 && p2.etat === 'achat' && !p2.cents && /Prix d’achat pas saisi/.test(p2.t) && p2.lien && !/\d+\s€/.test(p2.t), `${T} N°81 sans prix d’achat : aucun plancher, la porte « Saisir le prix d’achat »`, JSON.stringify(p2));
    await tap('[data-plancher-saisir]');
    await r.pg.waitForTimeout(500);
    const dlg = await r.pg.evaluate(() => /Prix d'achat/.test(document.body.innerText) && !!document.querySelector('input[inputmode="decimal"], input'));
    await r.pg.locator('button', { hasText: 'Annuler' }).last().click({ timeout: 2000 }).catch(() => {});
    await r.pg.waitForTimeout(400);
    dit(dlg && (await fiches(r.pg)) === avant, `${T} « Saisir le prix d’achat » DEMANDE ; annulé ⇒ rien d’écrit`);
    if (tel) { await tap('.vrm-chat-back'); await r.pg.waitForTimeout(500); }

    await tap('[data-conv="503"]');
    await r.pg.waitForSelector('.vrm-chat-offre [data-plancher]', { timeout: 10000 }).catch(() => {});
    await r.pg.waitForTimeout(400);
    const p3 = await r.pg.evaluate(() => { const e = document.querySelector('.vrm-chat-offre [data-plancher]'); return e ? { etat: e.getAttribute('data-plancher'), cents: e.getAttribute('data-plancher-cents'), partiel: e.getAttribute('data-plancher-partiel'), t: e.innerText, c: getComputedStyle(e).color } : null; });
    dit(p3 && p3.etat === 'au-dessus' && p3.cents === '7000' && p3.partiel === '1' && /En dessous de 70\s€ tu perds de l’argent \(au moins/.test(p3.t) && !/perdre/.test(p3.t), `${T} N°82 frais pas confirmés : « au moins », l’offre de 110 € n’est pas dite à perte`, JSON.stringify(p3));
    dit(p3 && /Ton prix mini \(60\s€\) est sous ce plancher/.test(p3.t), `${T} le prix mini (60 €) sous le plancher est DIT`);
    const n3 = JSON.parse((await fiches(r.pg)) || '{}')['803'] || {};
    dit(n3.min === '60' && n3.buyPrice === '70', `${T} … et pas changé (mini 60, achat 70)`, JSON.stringify(n3));
    if (!tel) await r.pg.screenshot({ path: path.join(CAP, 'plancher-stock-1512-fil-partiel.png') });
    dit(gestes(r).length === 0, `${T} aucune action envoyée à l’extension`, JSON.stringify(gestes(r)));
    dit((await fiches(r.pg)) === avant, `${T} les fiches sont intactes (rien d’écrit)`);
    dit(await r.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${T} aucun débordement horizontal`);
    dit(r.errs.length === 0, `${T} aucune erreur`, r.errs.join(' | '));
  } finally { await r.ctx.close(); }
}

async function achats(b, tel) {
  const T = tel ? '390 sombre' : '1512';
  const r = await rendre(b, tel, '?tab=cat_achats&vue=achats');
  const tap = async (sel) => { if (tel) await r.pg.locator(sel).first().tap(); else await r.pg.locator(sel).first().click(); };
  try {
    await r.pg.locator('[data-achat-hors-ajouter]').first().waitFor({ timeout: 15000 }).catch(() => {});
    await r.pg.waitForTimeout(1500);
    await tap('[data-achat-hors-ajouter]');
    await r.pg.waitForSelector('[data-achat-hors-form] [data-champ="titre"]', { timeout: 8000 });
    const nEcrits = r.ecrits.length;
    await r.pg.locator('[data-achat-hors-form] [data-champ="titre"]').fill('Adidas Air Max 90 blanc 42');
    await r.pg.waitForTimeout(300);
    dit(!(await r.pg.locator('[data-deja-stock]').count()), `${T} « Adidas Air Max 90 » (marque différente) ⇒ rien dit`);
    await r.pg.locator('[data-achat-hors-form] [data-champ="titre"]').fill('Nike Air Max 90 blanc 42');
    await r.pg.waitForSelector('[data-deja-stock]', { timeout: 5000 }).catch(() => {});
    const d = await r.pg.evaluate(() => { const e = document.querySelector('[data-deja-stock]'); return e ? { n: e.getAttribute('data-deja-stock'), t: (e.querySelector('[data-deja-stock-phrase]') || {}).innerText, h: Math.round(e.querySelector('summary').getBoundingClientRect().height) } : null; });
    dit(d && d.n === '3' && d.t === 'Tu as déjà 3 paires de ce modèle en stock' && d.h >= 44, `${T} « Tu as déjà 3 paires de ce modèle en stock » (cible ≥ 44 px)`, JSON.stringify(d));
    await tap('[data-deja-stock] summary');
    await r.pg.waitForTimeout(300);
    const liste = await r.pg.evaluate(() => [...document.querySelectorAll('[data-deja-stock-paire]')].map((x) => ({ id: x.getAttribute('data-deja-stock-paire'), num: x.getAttribute('data-deja-stock-num'), t: x.innerText, vis: x.getBoundingClientRect().height > 0 })));
    const ids = liste.map((x) => x.id).sort().join(',');
    dit(ids === '803,804,805' && liste.every((x) => x.vis && /Taille 42/.test(x.t) && /en ligne depuis \d+ j/.test(x.t)), `${T} toucher ⇒ N°82, 83, 84 (taille, en ligne depuis N j) — ni la Samba ni l’Air Force 1`, JSON.stringify(liste));
    dit(/N°82[\s\S]*40 j/.test(liste.map((x) => x.t).join('\n')) || liste.some((x) => x.num === '82' && /40 j/.test(x.t)), `${T} N°82 en ligne depuis 40 j`);
    dit(r.ecrits.length === nEcrits, `${T} aucune écriture pendant la frappe ni au toucher`, JSON.stringify(r.ecrits.slice(nEcrits)).slice(0, 200));
    await r.pg.screenshot({ path: path.join(CAP, `plancher-stock-${tel ? 390 : 1512}-achat.png`) });
    dit(await r.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${T} aucun débordement horizontal`);
    dit(r.errs.length === 0, `${T} aucune erreur`, r.errs.join(' | '));
  } finally { await r.ctx.close(); }
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const tel of [true, false]) { console.log(tel ? '── 390 px tactile, sombre' : '── 1512 px'); await messages(b, tel); await achats(b, tel); }
  } catch (e) {
    dit(false, 'le banc a tourné jusqu’au bout', e.message);
  } finally {
    if (b) await b.close();
    srv.close();
    console.log(ko ? `\n❌ plancher-stock : ${ko} rouge(s)` : '\n✅ plancher-stock : tout est vert');
    process.exitCode = ko ? 1 : 0;
  }
})();
