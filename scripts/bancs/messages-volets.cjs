// Banc : MESSAGES EN VOLETS (31 oct., maquettes choisies par Julien —
// fil au téléphone, trois volets sur ordinateur).
//
// Rend le VRAI écran Messages sur des données INVENTÉES (le dépôt est public),
// avec le VRAI dialogue du pont (`ready`, `etat`, `exec` → `result`), et exige :
//   1. 1512 px : trois volets côte à côte — la liste, le fil, la fiche de la
//      paire ; la fiche n'existe pas au téléphone (390 px), où la liste puis le
//      fil prennent tout l'écran, avec un retour ;
//   2. la fiche est reliée par IDENTITÉ seulement (§5) : l'annonce du même
//      `item_id` que la transaction. Deux annonces portent le MÊME titre
//      (« Salomon XT-6 blanc ») à des prix, N° et favoris différents : la fiche
//      montre CELLE du fil (N°80, 120 €, 11 favoris · 120 vues, Meuble C), jamais
//      l'autre ; une conversation SANS item_id, au même titre, dit « Pas reliée »
//      et ne montre aucun N° ;
//   3. la carte d'offre : « Offre de 100 € — ton mini : 105 € » (le mini posé à
//      côté du N°), Refuser · 110 € · Accepter, dans cet ordre ;
//   4. aucun envoi sans clic : ouvrir, la contre-offre (qui REMPLIT le prix),
//      une réponse rapide (qui REMPLIT le champ), et Accepter (qui DEMANDE) —
//      aucune requête autre qu'une lecture ne part ; annuler la confirmation
//      n'envoie rien ;
//   5. le pied : pastilles de réponses rapides, champ « Écris ta réponse… »,
//      micro de dictée (reconnaissance du navigateur), Envoyer rond.
// Captures : <tmp>/messages-volets-1512.png, -390-liste.png, -390-fil.png.
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4391;

const auj = Date.now();
const iso = (h) => new Date(auj - h * 3600e3).toISOString();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'boutique_test', domain: 'www.vinted.fr', updated_at: iso(0) }];
const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: iso(h), description: desc, opposite_user: { id: 5000 + id, login } });
const TITRE = 'Salomon XT-6 blanc';
// 501 : l'offre de 100 € sur l'annonce 801 (N°80, 120 €, mini 105 €).
const FIL_OFFRE = { id: 501, opposite_user: { id: 5501, login: 'acheteur_m' }, transaction: { id: 9501, item_id: 801, status: 1, current_user_side: 'seller', item_title: TITRE },
  messages: [
    { id: 1, created_at_ts: iso(3), entity_type: 'message', entity: { id: 1, user_id: 5501, body: 'Bonjour ! Elle taille comment ?' } },
    { id: 2, created_at_ts: iso(2.9), entity_type: 'message', entity: { id: 2, user_id: 111, body: 'Bonjour, taille normale.' } },
    { id: 3, created_at_ts: iso(2.5), entity_type: 'offer_request_message', entity: { id: 3, user_id: 5501, current: true, status: 10, status_title: '', price: { amount: '100.0' }, transaction_id: 9501, offer_request_id: 71 } },
    { id: 4, created_at_ts: iso(2.4), entity_type: 'message', entity: { id: 4, user_id: 5501, body: 'Vous feriez 100 € ?' } },
  ] };
// 502 : une conversation au MÊME titre, mais Vinted n'y rattache AUCUN article
// (pas d'item_id) — la fiche ne doit rien deviner.
const FIL_SANS = { id: 502, opposite_user: { id: 5502, login: 'acheteuse_c' }, transaction: { id: 9502, status: 1, current_user_side: 'seller', item_title: TITRE },
  messages: [{ id: 11, created_at_ts: iso(1), entity_type: 'message', entity: { id: 11, user_id: 5502, body: 'La boîte est incluse ?' } }] };
const annonce = (id, prix, fav, vues) => ({ id, url: 'https://www.vinted.fr/items/' + id, title: TITRE, brand: 'Salomon', size: '42', price: { amount: prix, currency_code: 'EUR' },
  photo: { url: 'https://images1.vinted.net/t/' + id + '/f800/a.jpeg' }, is_closed: false, is_draft: false, is_hidden: false, favourite_count: fav, view_count: vues });
const LIGNES = [
  { id: 'harvest_111_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(501, 'acheteur_m', 'Vous feriez 100 € ?', true, 2.4), conv(502, 'acheteuse_c', 'La boîte est incluse ?', true, 1)] } } },
  { id: 'harvest_111_conv_501', data: { capturedAt: iso(0), payload: { conversation: FIL_OFFRE } } },
  { id: 'harvest_111_conv_502', data: { capturedAt: iso(0), payload: { conversation: FIL_SANS } } },
  // L'annonce 802 porte le MÊME titre (et la même taille) : 130 €, N°81, 3 favoris.
  { id: 'harvest_111_listings', data: { uid: '111', type: 'listings', nItems: 2, capturedAt: iso(0), payload: { items: [annonce(802, '130.0', 3, 40), annonce(801, '120.0', 11, 120)], pagination: { total_entries: 2 } } } },
];
const NUMEROS = { '801': { numero: '80', min: '105' }, '802': { numero: '81', min: '125' } };
const MEUBLES = [{ id: 'm1', name: 'Meuble C', cols: 3, rows: 2 }, { id: 'm2', name: 'Meuble D', cols: 2, rows: 2 }];
const SLOTS = { '80': { m: 'm1', i: 0 }, '81': { m: 'm2', i: 3 } };

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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : (Array.isArray(v) && /^-?\d+$/.test(seg) ? v[Number(seg) < 0 ? v.length + Number(seg) : Number(seg)] : v[seg]);
    out[alias] = v == null ? null : v;
  }
  return out;
};
const contient = (a, b) => {
  if (Array.isArray(b)) return Array.isArray(a) && b.every((x) => a.some((y) => contient(y, x)));
  if (b && typeof b === 'object') return !!a && typeof a === 'object' && !Array.isArray(a) && Object.keys(b).every((k) => contient(a[k], b[k]));
  return a === b;
};
// Le pont simulé (extension à jour, connectée au compte 111) : chaque `exec` est noté.
const PONT = ({ version, fils }) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'boutique_test' }, cmds: {} } });
    if (d.__vmr === 'exec') {
      window.__exec && window.__exec(JSON.stringify({ uid: d.uid, method: d.method, endpoint: d.endpoint, body: d.body }));
      const idc = (/\/conversations\/(\d+)$/.exec(d.endpoint || '') || [])[1];
      setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data: d.method === 'GET' ? { conversation: fils[idc] || null } : {} }), 50);
    }
  });
  post({ __vmr: 'ready', version });
};

async function rendre(b, tel) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const execs = [];
  await pg.exposeFunction('__exec', (s) => execs.push(JSON.parse(s)));
  await pg.addInitScript(({ n, m, s }) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); localStorage.setItem('vrm_meubles', JSON.stringify(m)); localStorage.setItem('vrm_slots', JSON.stringify(s)); } catch (_) {} }, { n: NUMEROS, m: MEUBLES, s: SLOTS });
  await pg.addInitScript(PONT, { version: '5.291.0', fils: { 501: FIL_OFFRE, 502: FIL_SANS } });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: r.data.capturedAt });
    const cs = /[?&](data(?:->[^=&]+)+)=cs\.([^&]*)/.exec(u);
    const garde = cs ? (r) => { let v = r.data; for (const seg of cs[1].replace(/^data->/, '').split('->')) v = v == null ? null : v[seg]; try { return contient(v, JSON.parse(cs[2])); } catch (_) { return false; } } : () => true;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && garde(r)).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && garde(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_msg`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-conv="501"]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs, execs };
}
const gestes = (r) => r.execs.filter((x) => x.method !== 'GET');
const boite = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { l: b.left, r: b.right, t: b.top, w: b.width, h: b.height, vis: cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 && b.height > 0 }; }, sel);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/opt/pw-browsers/chromium'), args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

    // ── Ordinateur ────────────────────────────────────────────────────
    console.log('── 1512 px');
    let r = await rendre(b, false);
    try {
      const ligne = await r.pg.evaluate(() => { const e = document.querySelector('[data-conv="501"]'); return e ? e.innerText : null; });
      dit(!!ligne && /Salomon XT-6/.test(ligne) && /N°80/.test(ligne) && !/N°81/.test(ligne), 'la ligne dit « modèle · N° » — le N° de SON annonce (item_id), jamais celui de l’autre au même titre', (ligne || '').replace(/\n/g, ' | '));
      await r.pg.click('[data-conv="501"]');
      await r.pg.waitForSelector('[data-offre-geste="accepter"]', { timeout: 10000 }).catch(() => {});
      await r.pg.waitForTimeout(800);
      const L = await boite(r.pg, '.vrm-inbox-column'), F = await boite(r.pg, '.vrm-message-workspace .vrm-chat-panel'), D = await boite(r.pg, '.vrm-msg-fiche');
      dit(L && F && D && L.vis && F.vis && D.vis && L.r <= F.l + 1 && F.r <= D.l + 1 && Math.abs(L.t - F.t) < 4 && Math.abs(F.t - D.t) < 4 && D.w >= 240, 'trois volets côte à côte : la liste, le fil, la fiche de la paire', JSON.stringify({ L, F, D }));
      const fiche = await r.pg.evaluate(() => { const e = document.querySelector('.vrm-msg-fiche'); return e ? { etat: e.getAttribute('data-fiche-conv'), item: e.getAttribute('data-fiche-item'), num: e.getAttribute('data-fiche-num'), txt: e.innerText } : null; });
      dit(fiche && fiche.etat === 'reliee' && fiche.item === '801' && fiche.num === '80', 'la fiche est celle de l’annonce du fil (item_id 801, N°80)', JSON.stringify(fiche));
      const t = (fiche && fiche.txt) || '';
      dit(/N°80/.test(t) && /120\s?€/.test(t) && /11 favoris/.test(t) && /120 vues/.test(t) && /Meuble C/.test(t) && /42/.test(t) && /boutique_test/.test(t), 'elle porte son prix, sa taille, le compte, le N°, sa place dans « Mes meubles » et favoris · vues', t.replace(/\n/g, ' | '));
      dit(!/N°81|130\s?€|3 favoris|Meuble D/.test(t), 'rien de l’autre annonce au même titre (N°81, 130 €, 3 favoris, Meuble D)');
      const offre = await r.pg.evaluate(() => { const e = document.querySelector('.vrm-chat-offre-traiter'); if (!e) return null; const bs = [...e.querySelectorAll('.vrm-chat-offre-actions button')].map((x) => ({ g: x.getAttribute('data-offre-geste'), t: x.innerText.trim(), l: x.getBoundingClientRect().left, y: x.getBoundingClientRect().top }));
        return { mini: e.getAttribute('data-offre-mini'), contre: e.getAttribute('data-offre-contre'), tete: (e.querySelector('.vrm-chat-offre-tete') || {}).innerText || '', bs }; });
      dit(offre && /Offre de 100,00/.test(offre.tete) && /ton mini\s*:\s*105,00/.test(offre.tete) && offre.mini === '105', 'la carte d’offre : « Offre de 100 € — ton mini : 105 € »', JSON.stringify(offre && offre.tete));
      const ordre = offre ? offre.bs.map((x) => x.g).join(',') : '';
      dit(ordre === 'refuser,contre,accepter' && offre.bs.every((x) => Math.abs(x.y - offre.bs[0].y) < 2) && offre.bs[0].l < offre.bs[1].l && offre.bs[1].l < offre.bs[2].l && /110,00/.test(offre.bs[1].t) && offre.contre === '110', 'Refuser · 110 € · Accepter, côte à côte et dans cet ordre', JSON.stringify(offre && offre.bs));
      const pied = await r.pg.evaluate(() => ({ rapides: document.querySelectorAll('.vrm-chat-panel .vrm-chat-rapides button').length, ph: (document.querySelector('.vrm-chat-compose textarea') || {}).placeholder, mic: !!document.querySelector('.vrm-chat-compose [data-mic-dictee]'), dicteeOk: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window, send: (() => { const s = document.querySelector('.vrm-chat-send'); if (!s) return null; const b = s.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), bg: getComputedStyle(s).backgroundColor, label: s.getAttribute('aria-label') }; })() }));
      dit(pied.rapides >= 3 && pied.ph === 'Écris ta réponse…' && (pied.mic || !pied.dicteeOk) && pied.send && Math.abs(pied.send.w - pied.send.h) <= 1 && pied.send.label === 'Envoyer', 'le pied : pastilles de réponses rapides, « Écris ta réponse… », micro de dictée, Envoyer rond', JSON.stringify(pied));
      // Aucun envoi sans clic.
      dit(gestes(r).length === 0, 'ouvrir le fil n’envoie rien (seules des lectures)', JSON.stringify(gestes(r)));
      await r.pg.click('[data-offre-geste="contre"]');
      await r.pg.waitForTimeout(300);
      const prixVal = await r.pg.locator('input[aria-label="Prix de l\'offre"]').inputValue().catch(() => null);
      dit(prixVal === '110' && gestes(r).length === 0, 'la contre-offre REMPLIT le prix (110) — rien ne part avant « Envoyer l’offre »', JSON.stringify({ prixVal, g: gestes(r) }));
      await r.pg.locator('.vrm-chat-rapides button').first().click();
      await r.pg.waitForTimeout(200);
      const rep = await r.pg.locator('.vrm-chat-compose textarea').inputValue();
      dit(rep.trim().length > 0 && gestes(r).length === 0, 'une réponse rapide remplit le champ, sans rien envoyer', rep);
      await r.pg.click('[data-offre-geste="accepter"]');
      await r.pg.waitForTimeout(500);
      const dlg = await r.pg.locator('div[style*="z-index: 2000"]').count();
      dit(dlg > 0 && gestes(r).length === 0, 'Accepter DEMANDE d’abord — rien n’est parti', JSON.stringify(gestes(r)));
      await r.pg.locator('div[style*="z-index: 2000"] button', { hasText: 'Annuler' }).first().click().catch(() => {});
      await r.pg.waitForTimeout(400);
      dit(gestes(r).length === 0, 'annuler la confirmation n’envoie rien');
      await r.pg.locator('.vrm-chat-compose textarea').fill('');
      await r.pg.evaluate(() => { if (document.activeElement) document.activeElement.blur(); const d = document.querySelector('details.vrm-chat-negociation'); if (d) d.open = false; window.scrollTo(0, 0); document.querySelectorAll('*').forEach((e) => { if (e.scrollTop && !e.closest('.vrm-chat-history')) e.scrollTop = 0; }); });
      await r.pg.waitForTimeout(300);
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'messages-volets-1512.png') });
      // 502 : même titre, aucun item_id ⇒ pas reliée.
      await r.pg.click('[data-conv="502"]');
      await r.pg.waitForFunction(() => document.querySelector('.vrm-msg-fiche')?.getAttribute('data-fiche-conv') === 'non-reliee', null, { timeout: 8000 }).catch(() => {});
      const f2 = await r.pg.evaluate(() => { const e = document.querySelector('.vrm-msg-fiche'); return e ? { etat: e.getAttribute('data-fiche-conv'), item: e.getAttribute('data-fiche-item'), txt: e.innerText } : null; });
      dit(f2 && f2.etat === 'non-reliee' && !f2.item && /Pas reliée/.test(f2.txt) && !/N°8\d/.test(f2.txt), 'une conversation au même titre SANS item_id : la fiche dit qu’elle n’est pas reliée, aucun N° deviné', JSON.stringify(f2));
      const l502 = await r.pg.evaluate(() => (document.querySelector('[data-conv="502"]') || {}).innerText || '');
      dit(!/N°8\d/.test(l502), 'et sa ligne ne porte aucun N°', l502.replace(/\n/g, ' | '));
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'messages-volets-1512-nonreliee.png') });
      dit(await r.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'aucun débordement horizontal');
      dit(gestes(r).length === 0 && r.errs.length === 0, 'aucun geste envoyé, aucune erreur', JSON.stringify({ g: gestes(r), e: r.errs }));
    } finally { await r.ctx.close(); }

    // ── Téléphone ─────────────────────────────────────────────────────
    console.log('── 390 px');
    r = await rendre(b, true);
    try {
      const row = await boite(r.pg, '[data-conv="501"]');
      dit(row && row.vis && row.w >= 330, 'la liste prend toute la largeur', JSON.stringify(row));
      dit(!(await boite(r.pg, '.vrm-msg-fiche') || {}).vis, 'pas de volet de fiche au téléphone');
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'messages-volets-390-liste.png') });
      await r.pg.click('[data-conv="501"]');
      await r.pg.waitForSelector('[data-offre-geste="accepter"]', { timeout: 10000 }).catch(() => {});
      await r.pg.waitForTimeout(800);
      const P = await boite(r.pg, '.vrm-chat-panel');
      dit(P && P.vis && P.w >= 389 && P.h >= 800 && P.t <= 1, 'le fil prend tout l’écran', JSON.stringify(P));
      const carte = await r.pg.evaluate(() => { const c = document.querySelector('[data-fil-paire]'); return c ? { item: c.getAttribute('data-fil-paire'), txt: c.innerText } : null; });
      dit(carte && carte.item === '801' && /Salomon XT-6/.test(carte.txt) && /42/.test(carte.txt) && /120\s?€/.test(carte.txt) && /Vinted/.test(carte.txt) && /boutique_test/.test(carte.txt) && /Meuble C/.test(carte.txt) && /N°80/.test(carte.txt) && !/N°81|Meuble D/.test(carte.txt), 'en tête du fil : la paire (titre · taille, prix · site · compte · rangement, N°80)', JSON.stringify(carte));
      const ordre = await r.pg.evaluate(() => [...document.querySelectorAll('.vrm-chat-offre-actions button')].map((x) => x.getAttribute('data-offre-geste')).join(','));
      dit(ordre === 'refuser,contre,accepter', 'la carte d’offre au téléphone : Refuser · 110 € · Accepter', ordre);
      const bulles = await r.pg.evaluate(() => [...document.querySelectorAll('.vrm-chat-panel .vrm-bulle')].map((x) => ({ moi: x.getAttribute('data-bulle'), bg: getComputedStyle(x).backgroundColor, h: !!x.querySelector('time') })));
      const moi = bulles.find((x) => x.moi === 'moi'), eux = bulles.find((x) => x.moi === 'acheteur');
      // « Encre pleine » : le fond de SA bulle est la couleur du texte de l'app.
      const encre = await r.pg.evaluate(() => { const d = document.createElement('span'); d.style.color = 'var(--vrm-ink)'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; });
      dit(moi && eux && moi.bg === encre && eux.bg !== encre && bulles.every((x) => x.h), 'les bulles : lui en encre pleine, l’acheteur en surface, chacune avec son heure', JSON.stringify({ bulles, encre }));
      await r.pg.screenshot({ path: path.join(os.tmpdir(), 'messages-volets-390-fil.png') });
      await r.pg.click('.vrm-chat-back');
      await r.pg.waitForTimeout(500);
      dit(!(await boite(r.pg, '.vrm-chat-panel') || {}).vis && (await boite(r.pg, '[data-conv="501"]') || {}).vis, 'le retour ramène à la liste');
      dit(await r.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'aucun débordement horizontal');
      dit(gestes(r).length === 0 && r.errs.length === 0, 'aucun geste envoyé, aucune erreur', JSON.stringify({ g: gestes(r), e: r.errs }));
    } finally { await r.ctx.close(); }
  } catch (e) {
    dit(false, 'le banc a tourné jusqu’au bout', e.message);
  } finally {
    if (b) await b.close();
    srv.close();
    console.log(ko ? `\n❌ messages-volets : ${ko} rouge(s)` : '\n✅ messages-volets : tout est vert');
    process.exitCode = ko ? 1 : 0;
  }
})();
