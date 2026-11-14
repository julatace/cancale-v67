// ── BANC : MESSAGES · TOUS — UN SEUL FIL PAR ACHETEUR ET PAR PAIRE (10 nov., lot AB)
// Données INVENTÉES (aucune donnée réelle), à la forme des lignes que lit l'app :
// boîtes Vinted `harvest_{uid}_inbox`, fils captés `harvest_{uid}_conv_{id}`,
// `lbc_fil_*` / `vc_fil_*` lus en scalaires `meta`, `vc_messages`, `vc_listings`.
//   A. « Tous » existe dans Messages ; (11 nov., C9) « Tous » par défaut, SON dernier choix retenu,
//      l'ancienne valeur posée à chaque visite (« vinted ») n'est plus lue, `site=vinted` reste Vinted ;
//   B. 301 et 302 : le MÊME acheteur (5301) sur la MÊME annonce (444) ⇒ UN fil ;
//      303 et 304 : deux acheteurs au MÊME pseudo, même paire ⇒ deux fils ;
//      Leboncoin et Vestiaire : un fil chacun (rien de fusionné seul) ;
//   C. chaque fil porte la marque de sa plateforme ;
//   D. VRM DEMANDE : 305 (même acheteur, aucune paire) ⇒ « Peut-être la même
//      paire ? » ; N°12 sur Vinted et Vestiaire ⇒ « Peut-être le même acheteur ? » ;
//   E. « Oui, même fil » relie (une ligne de moins, Vinted + Vestiaire) — rangé
//      dans `vrm_fils_relies` ; « Non » fait partir la proposition ;
//   F. le fil 301+302 montre les messages des DEUX conversations, dans l'ordre,
//      marqués Vinted ; « Répondre sur Vinted » ouvre LE fil Vinted ;
//   G. le fil relié Vinted + Vestiaire : dernier message sur Vestiaire ⇒ « Répondre
//      sur Vestiaire » ouvre le fil Vestiaire ; « délier » défait ;
//   H. un fil Leboncoin s'ouvre dans le fil Leboncoin ;
//   I. ouvrir, relier, lire : AUCUNE commande ni écriture Vinted ne part ;
//   J. 390 px tactile et 1512 px, clair ET sombre : rien ne déborde, 44 px au doigt.
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4471);
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
const conv = (id, qui, login, desc, h) => ({ id, unread: false, updated_at: iso(h), description: desc, opposite_user: { id: qui, login } });
const fil = (id, qui, login, tx, item, titre, msgs) => ({ id, opposite_user: { id: qui, login }, transaction: tx ? { id: tx, item_id: item, status: 1, current_user_side: 'seller', item_title: titre } : undefined,
  messages: msgs.map(([mid, h, de, body]) => ({ id: mid, created_at_ts: iso(h), entity_type: 'message', entity: { id: mid, user_id: de, body } })) });
const LIGNES = [
  { id: 'harvest_111_inbox', data: { capturedAt: iso(0), payload: { conversations: [
    conv(301, 5301, 'acheteuse_1', 'Je peux payer aujourd’hui', 30), conv(302, 5301, 'acheteuse_1', 'Encore dispo ?', 6),
    conv(303, 5303, 'curieux', 'Merci !', 8), conv(304, 5304, 'curieux', 'Taille 40 ?', 9), conv(305, 5301, 'acheteuse_1', 'Bonjour', 12),
  ] } } },
  { id: 'harvest_111_conv_301', data: { capturedAt: iso(0), payload: { conversation: fil(301, 5301, 'acheteuse_1', 9001, 444, 'Nike Air Max 1 blanc 42', [[1, 31, 5301, 'Bonjour, vous feriez 45 € ?'], [2, 30, 111, 'Non désolé']]) } } },
  { id: 'harvest_111_conv_302', data: { capturedAt: iso(0), payload: { conversation: fil(302, 5301, 'acheteuse_1', 9005, 444, 'Nike Air Max 1 blanc 42', [[3, 6, 5301, 'Encore dispo ?']]) } } },
  { id: 'harvest_111_conv_303', data: { capturedAt: iso(0), payload: { conversation: fil(303, 5303, 'curieux', 8811, 555, 'Adidas Gazelle bleu 40', [[4, 8, 5303, 'Merci !']]) } } },
  { id: 'harvest_111_conv_304', data: { capturedAt: iso(0), payload: { conversation: fil(304, 5304, 'curieux', 8812, 555, 'Adidas Gazelle bleu 40', [[5, 9, 5304, 'Taille 40 ?']]) } } },
  { id: 'harvest_111_listings', data: { uid: '111', type: 'listings', nItems: 2, capturedAt: iso(0), payload: { items: [
    { id: 444, url: 'https://www.vinted.fr/items/444', title: 'Nike Air Max 1 blanc 42', price: { amount: '59.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false },
    { id: 555, url: 'https://www.vinted.fr/items/555', title: 'Adidas Gazelle bleu 40', price: { amount: '40.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false },
  ] } } },
  { id: 'lbc_fil_c0c0c0c0-1111-4222-8333-944455556666', data: { v: 1, conv: 'c0c0c0c0-1111-4222-8333-944455556666', compte: 'L1', n: 2, dernierAt: iso(3), apercu: 'Envoi en point relais ?', dernierDeMoi: false,
    messages: [{ id: 'l1', t: 'Toujours dispo ?', deMoi: false, at: iso(4) }, { id: 'l2', t: 'Envoi en point relais ?', deMoi: false, at: iso(3) }] } },
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
    localStorage.setItem('vinted_annonce_numeros', JSON.stringify({ '444': { numero: '7' }, '555': { numero: '12' } }));
    if (relies) localStorage.setItem('vrm_fils_relies', JSON.stringify(relies));
  } catch (_) {} }, { s: sombre, relies });
  await pg.addInitScript(PONT, { version: '5.335.0' });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
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
const lignes = (pg) => pg.$$eval('[data-fil]', (l) => l.map((x) => ({ cle: x.getAttribute('data-fil'), n: x.getAttribute('data-fil-convs'), sites: x.getAttribute('data-fil-sites'), num: x.getAttribute('data-fil-num') })));
const attendreFils = async (pg) => { await pg.waitForFunction(() => { const e = document.querySelector('[data-fils-tous]'); return e && e.getAttribute('data-fils-tous') !== 'charge' && document.querySelectorAll('[data-fil]').length >= 5; }, null, { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(400); };

// (14 nov., refonte Messages · E-mails · Stock — AJOUT 3) Les questions « Peut-être la même paire ? » vivent
// dans la ligne « À relier · N › » au-dessus de la liste : la feuille s'ouvre avant de les lire. La RÈGLE jugée
// (une question à la fois, ses deux gestes, rien relié sans son clic) est la même.
const ouvrirAFaire = async (pg) => { if (await pg.$('[data-fil-proposition]')) return; if (await pg.$('[data-msg-afaire]')) { await pg.$eval('[data-msg-afaire]', (b) => b.click()); await pg.waitForTimeout(350); } };   // un clic DOM : au téléphone le fil ouvert couvre la liste
(async () => {
  fs.mkdirSync(CAP, { recursive: true });
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/opt/pw-browsers/chromium'), args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    // A — défaut et filtre
    {
      const r = await ouvrir(b, { width: 1512, height: 950 }, { url: '/?tab=messages' });
      await r.pg.waitForSelector('[data-filtre-site="messages"]', { timeout: 15000 }).catch(() => {});
      await r.pg.waitForTimeout(1500);
      dit(await r.pg.$('[data-filtre-site="messages"] [data-site="toutes"]') != null, 'A · Messages porte « Tous »');
      await attendreFils(r.pg);
      dit(await r.pg.$('[data-fils-tous]') != null && await r.pg.$('[data-filtre-site="messages"] [data-site="toutes"][aria-pressed="true"]') != null, 'A · (C9) `?tab=messages` ouvre « Tous » par défaut (les fils)');
      // L'ancienne mémoire (posée à chaque visite, « vinted » chez tous) ne compte plus ; SON toucher, si.
      await r.pg.evaluate(() => { localStorage.setItem('vrm_filtre_site', JSON.stringify({ messages: 'vinted' })); });
      await r.pg.goto(r.pg.url().replace(/\?.*$/, '') + '?tab=messages', { waitUntil: 'domcontentloaded' });
      await r.pg.waitForSelector('[data-filtre-site="messages"]', { timeout: 15000 }).catch(() => {}); await attendreFils(r.pg);
      dit(await r.pg.$('[data-filtre-site="messages"] [data-site="toutes"][aria-pressed="true"]') != null, 'A · (C9) l’ancienne valeur automatique « vinted » n’est plus lue : « Tous »');
      await r.pg.click('[data-filtre-site="messages"] [data-site="vinted"]');
      await r.pg.waitForTimeout(600);
      await r.pg.goto(r.pg.url().replace(/\?.*$/, '') + '?tab=messages', { waitUntil: 'domcontentloaded' });
      await r.pg.waitForSelector('[data-filtre-site="messages"]', { timeout: 15000 }).catch(() => {}); await r.pg.waitForTimeout(1500);
      dit(await r.pg.$('[data-fils-tous]') == null && await r.pg.$('[data-filtre-site="messages"] [data-site="vinted"][aria-pressed="true"]') != null, 'A · (C9) son dernier choix (Vinted, touché) est retenu');
      await r.pg.click('[data-filtre-site="messages"] [data-site="toutes"]');
      await attendreFils(r.pg);
      dit(await r.pg.$('[data-fils-tous]') != null, 'A · « Tous » ouvre les fils');
      dit(!r.errs.length, 'A · aucune erreur', r.errs.join(' | '));
      await r.ctx.close();
    }
    {
      // (11 nov., C9) Un lien qui vise Vinted (notification, Favoris) reste sur Vinted, et n'écrit pas de choix.
      const r = await ouvrir(b, { width: 390, height: 844 }, { url: '/?tab=messages&site=vinted' });
      await r.pg.waitForSelector('[data-filtre-site="messages"]', { timeout: 15000 }).catch(() => {}); await r.pg.waitForTimeout(1500);
      dit(await r.pg.$('[data-filtre-site="messages"] [data-site="vinted"][aria-pressed="true"]') != null, 'A · (C9) `site=vinted` (notifications) reste sur Vinted');
      const m = await r.pg.evaluate(() => JSON.parse(localStorage.getItem('vrm_filtre_site') || '{}'));
      dit(!m['messages:choix'], 'A · (C9) un lien n’est pas un choix : rien retenu', JSON.stringify(m));
      await r.ctx.close();
    }
    for (const [vp, sombre, nom] of [[{ width: 1512, height: 950 }, false, '1512-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 390, height: 844 }, false, '390-clair'], [{ width: 1512, height: 950 }, true, '1512-sombre']]) {
      const r = await ouvrir(b, vp, { sombre });
      await attendreFils(r.pg);
      const L = await lignes(r.pg);
      const principal = nom === '1512-clair';
      if (principal) {
        const f301 = L.find((x) => x.cle && x.cle.includes(':301'));
        dit(f301 && f301.n === '2' && L.some((x) => x.cle === f301.cle) && !L.some((x) => /:302$/.test(x.cle) && x.cle !== f301.cle), 'B · 301 + 302 (même acheteur, même annonce) ⇒ un fil', JSON.stringify(L));
        dit(L.filter((x) => /:30[34]$/.test(x.cle)).length === 2, 'B · deux acheteurs au même pseudo ⇒ deux fils');
        dit(L.length === 6, 'B · six fils (Vinted ×4, Leboncoin, Vestiaire)', String(L.length));
        dit(L.some((x) => x.sites === 'leboncoin') && L.some((x) => x.sites === 'vestiaire' && x.num === '12'), 'C · Leboncoin et Vestiaire marqués, le N° de Vestiaire par sa référence');
        dit(await r.pg.$$eval('[data-fil] [data-fil-marques] [data-logo-site]', (l) => l.length) >= 6, 'C · chaque ligne porte la marque de sa plateforme');
        // Une question à la fois : on lit chacune en répondant « Non » sur une copie, puis on recharge.
        const props = [];
        await ouvrirAFaire(r.pg);
        dit(await r.pg.$$eval('[data-fil-proposition]', (l) => l.length) === 1 && await r.pg.$('[data-fil-propositions-autres="2"]') != null, 'D · une question à la fois (« encore 2 »)');
        for (let i = 0; i < 3; i++) { const s = await r.pg.$('[data-fil-proposition]'); if (!s) break; props.push(await s.getAttribute('data-fil-proposition')); await r.pg.click('[data-fil-proposition] [data-fil-refuser]'); await r.pg.waitForTimeout(200); }
        await r.pg.evaluate(() => localStorage.removeItem('vrm_fils_relies')); await r.pg.reload(); await attendreFils(r.pg);
        dit(props.includes('paire'), 'D · « Peut-être la même paire ? » (305, même acheteur, aucune paire)', props.join(','));
        dit(props.includes('acheteur'), 'D · « Peut-être le même acheteur ? » (N°12 Vinted + Vestiaire)');
        dit(props.length === 3 && !props.includes(null), 'D · Leboncoin (sans identité) jamais proposé (trois questions seulement)', props.join(','));
        // F — le fil 301 + 302
        await r.pg.click(`[data-fil="${f301.cle}"]`);
        await r.pg.waitForSelector('[data-fil-fusionne] [data-fil-msg]', { timeout: 10000 }).catch(() => {});
        const msgs = await r.pg.$$eval('[data-fil-fusionne] [data-fil-msg]', (l) => l.map((x) => x.getAttribute('data-fil-msg') + ':' + x.textContent));
        dit(msgs.length === 3 && msgs.every((m) => m.startsWith('vinted:')) && /45/.test(msgs[0]) && /Encore dispo/.test(msgs[2]), 'F · les messages des deux conversations, dans l\'ordre, marqués Vinted', JSON.stringify(msgs));
        await r.pg.screenshot({ path: path.join(CAP, 'fil-unique-fusionne-' + nom + '.png') });
        dit(await r.pg.$('[data-fil-repondre="vinted"]') != null, 'F · « Répondre sur Vinted » (le dernier message est sur Vinted)');
        await r.pg.click('[data-fil-repondre="vinted"]');
        await r.pg.waitForTimeout(1500);
        dit(await r.pg.$('[data-fil-fusionne]') == null && await r.pg.$('.vrm-chat-panel') != null, 'F · Répondre ouvre LE fil Vinted');
        // E — relier Vinted N°12 + Vestiaire
        const avant = (await lignes(r.pg)).length;
        await ouvrirAFaire(r.pg);
        const sel = '[data-fil-proposition="acheteur"]';
        if (process.env.DEBUG) console.log("DBG E", await r.pg.evaluate(() => JSON.stringify({ p: [...document.querySelectorAll("[data-fil-proposition]")].map((x) => x.getAttribute("data-fil-proposition")), af: (document.querySelector("[data-msg-afaire]") || {}).outerHTML ? document.querySelector("[data-msg-afaire]").getAttribute("data-msg-afaire") : null, feuille: !!document.querySelector("[data-ui-afaire-feuille]"), chat: !!document.querySelector(".vrm-chat-panel") })));
        const a = await r.pg.$eval(sel, (x) => x.getAttribute('data-fil-a') + '|' + x.getAttribute('data-fil-b'));
        await r.pg.click(sel + ' [data-fil-relier]');
        await r.pg.waitForTimeout(500);
        await r.pg.keyboard.press('Escape'); await r.pg.waitForTimeout(200);   // la feuille « À relier » se ferme (la question suivante y attend)
        const L2 = await lignes(r.pg);
        const relie = L2.find((x) => x.sites === 'vinted,vestiaire');
        dit(L2.length === avant - 1 && relie && relie.n === '2', 'E · « Oui, même fil » relie (une ligne de moins, Vinted + Vestiaire)', a);
        const range = await r.pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_fils_relies') || '{}'); } catch (_) { return null; } });
        dit(range && range.liens && Object.keys(range.liens).length === 1, 'E · le lien est rangé dans `vrm_fils_relies`');
        // G — le fil relié : le dernier message est sur Vestiaire
        await r.pg.click(`[data-fil="${relie.cle}"]`);
        await r.pg.waitForSelector('[data-fil-fusionne] [data-fil-msg]', { timeout: 10000 }).catch(() => {});
        const m2 = await r.pg.$$eval('[data-fil-fusionne] [data-fil-msg]', (l) => l.map((x) => x.getAttribute('data-fil-msg')));
        dit(m2.includes('vinted') && m2[m2.length - 1] === 'vestiaire', 'G · Vinted puis Vestiaire, chacun marqué', m2.join(','));
        await r.pg.screenshot({ path: path.join(CAP, 'fil-unique-relie-' + nom + '.png') });
        dit(await r.pg.$('[data-fil-repondre="vestiaire"]') != null, 'G · « Répondre sur Vestiaire » (plateforme du dernier message)');
        await r.pg.click('[data-fil-repondre="vestiaire"]');
        await r.pg.waitForSelector('[data-vc-fil-ouvert="vc-777"]', { timeout: 8000 }).catch(() => {});
        dit(await r.pg.$('[data-vc-fil-ouvert="vc-777"]') != null, 'G · Répondre ouvre le fil Vestiaire (ses règles d\'envoi)');
        await r.pg.click(`[data-fil="${relie.cle}"]`);
        await r.pg.waitForSelector('[data-fil-delier]', { timeout: 8000 }).catch(() => {});
        await r.pg.click('[data-fil-delier]');
        await r.pg.waitForTimeout(400);
        dit((await lignes(r.pg)).length === avant, 'G · « délier » défait');
        // « Non » : chaque réponse fait partir SA question
        await ouvrirAFaire(r.pg);
        let n0 = await r.pg.$$eval('[data-fil-proposition]', (l) => l.length), nNon = 0;
        while (await r.pg.$('[data-fil-proposition]') && nNon < 5) { await r.pg.click('[data-fil-proposition] [data-fil-refuser]'); await r.pg.waitForTimeout(200); nNon++; }
        dit(n0 === 1 && await r.pg.$('[data-fil-proposition]') == null, 'E · « Non » fait partir la proposition', String(nNon));
        // H — Leboncoin
        const lb = (await lignes(r.pg)).find((x) => x.sites === 'leboncoin');
        await r.pg.click(`[data-fil="${lb.cle}"]`);
        await r.pg.waitForSelector('[data-lbc-fil-ouvert]', { timeout: 8000 }).catch(() => {});
        dit(await r.pg.$('[data-lbc-fil-ouvert]') != null, 'H · un fil Leboncoin s\'ouvre dans le fil Leboncoin');
        // I
        const cmds = await r.pg.evaluate(() => window.__cmds || []);
        dit(!cmds.length, 'I · aucune commande ni écriture Vinted', cmds.join(' | '));
        dit(!r.ecritures.some((u) => /vrm_fils|lbc_|vc_|harvest_/.test(u)), 'I · aucune écriture de messages en base', r.ecritures.filter((u) => /lbc_|vc_|harvest_/.test(u)).join(' | '));
      } else {
        dit(L.length === 6, `J · ${nom} : six fils`, String(L.length));
      }
      // J — rendu
      const deborde = await r.pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      dit(deborde <= 1, `J · ${nom} : rien ne déborde`, String(deborde));
      if (vp.width < 600) {
        await ouvrirAFaire(r.pg);
        const petits = await r.pg.$$eval('[data-fil-proposition] button, [data-fil]', (l) => l.filter((x) => x.getBoundingClientRect().height < 43.5).map((x) => x.textContent.slice(0, 20) + ':' + Math.round(x.getBoundingClientRect().height)));
        dit(!petits.length, `J · ${nom} : 44 px au doigt`, petits.join(' | '));
        await r.pg.keyboard.press('Escape'); await r.pg.waitForTimeout(200);   // referme « À relier » (ouverte pour mesurer ses boutons)
      }
      await r.pg.screenshot({ path: path.join(CAP, 'fil-unique-' + nom + '.png'), fullPage: false });
      if (vp.width < 600) {
        const f = (await lignes(r.pg)).find((x) => x.n === '2');
        if (f) { await r.pg.click(`[data-fil="${f.cle}"]`); await r.pg.waitForSelector('[data-fil-fusionne] [data-fil-msg]', { timeout: 8000 }).catch(() => {}); await r.pg.waitForTimeout(300); await r.pg.screenshot({ path: path.join(CAP, 'fil-unique-fusionne-' + nom + '.png') }); dit(await r.pg.$('[data-fil-fusionne] [data-fil-msg]') != null, `J · ${nom} : le fil fusionné s'ouvre`); }
      }
      dit(!r.errs.length, `J · ${nom} : aucune erreur`, r.errs.join(' | '));
      await r.ctx.close();
    }
  } catch (e) { ko++; console.log('KO  le banc a planté — ' + (e && e.stack || e)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} contrôle(s) rouge(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
