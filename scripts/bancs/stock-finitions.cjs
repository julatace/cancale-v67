// Banc : FINITIONS DU STOCK (17 octobre, suite de `stock-piece.cjs`). Pièces et
// paires INVENTÉES (il vit dans le dépôt, aucune fixture). Il exige :
//   I. SANS WebGL, une pièce EN L se dessine vue du dessus avec SES six coins
//      (avant : un rectangle, des meubles dans un coin qui n'existe pas) ;
//      toucher un meuble le choisit ; et l'autre sens : une pièce RECTANGLE
//      garde sa vue en perspective ;
//  II. GRANDE PIÈCE, vue du dessus : les étiquettes ne se recouvrent JAMAIS,
//      elles ont la même taille à l'écran à deux zooms différents, et il y en
//      a de masquées (sinon le contrôle ne prouverait rien) ; zoomer en montre
//      davantage ;
// III. PORTANT : l'étiquette d'un cintre montre sa face NUMÉROTÉE de face (pas
//      sa tranche) ;
//  IV. ÉTAGÈRE À BACS : un bac par case ; ranger une paire dans un bac vide
//      l'écrit dans CETTE case ;
//   V. AU DOIGT (390 px, tactile) : poser (toucher une place libre, choisir la
//      paire), retirer la boîte du dessous (celle du dessus descend), déplacer
//      un meuble dans le plan (il ne traverse rien) ;
//   et aucune erreur d'app.
// `--reaffaiblir=<nom>` : non — la preuve par réaffaiblissement se fait en
// rebâtissant l'app avec la règle retirée (voir le rapport du chantier 11).
// ⚠️ WebGL logiciel = lent : on juge des ÉTATS (sondes, données), jamais des durées.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7111;
const CAPT = process.env.CAPTURES || os.tmpdir();
const CHROME = '/opt/pw-browsers/chromium';

const L = [[0, 0], [8, 0], [8, 3], [4.5, 3], [4.5, 6], [0, 6]];
const PLAN_L = { rooms: [{ id: 'r1', name: 'Atelier en L', room: { w: 8, h: 6, wallH: 3, poly: L }, items: [
  { id: 'm1', type: 'metal', name: 'Étagère coin', x: 6.5, y: 0.1, w: 1.2, h: 0.5, rows: 5, cols: 2, h3d: 1.25, slots: { '4_0': ['401'] } },
  { id: 't1', type: 'table', name: 'Table du bas', x: 0.5, y: 4.5, w: 2, h: 1, rows: 1, cols: 3, h3d: 0.5, slots: {} },
] }], active: 'r1' };
const PLAN_RECT = { rooms: [{ id: 'r1', name: 'Atelier', room: { w: 8, h: 6, wallH: 3 }, items: PLAN_L.rooms[0].items }], active: 'r1' };
// Une GRANDE pièce : 32 étagères serrées le long des murs.
const grand = [];
for (let i = 0; i < 16; i++) grand.push({ id: 'n' + i, type: 'metal', name: 'Étagère nord ' + (i + 1), x: 0.2 + i * 1.3, y: 0.1, w: 1.2, h: 0.5, rows: 5, cols: 2, h3d: 1.25, slots: { '4_0': [String(100 + i)] } });
for (let i = 0; i < 16; i++) grand.push({ id: 's' + i, type: 'metal', name: 'Étagère sud ' + (i + 1), x: 0.2 + i * 1.3, y: 13.3, w: 1.2, h: 0.5, rows: 5, cols: 2, h3d: 1.25, slots: {} });
const PLAN_GRAND = { rooms: [{ id: 'r1', name: 'Entrepôt', room: { w: 22, h: 14, wallH: 3.2 }, items: grand }], active: 'r1' };
const PLAN_NICHES = { rooms: [{ id: 'r1', name: 'Boutique', room: { w: 8, h: 6, wallH: 3 }, items: [
  { id: 'c1', type: 'cintres', name: 'Portant vestes', x: 1, y: 0.2, w: 1.5, h: 0.5, rows: 1, cols: 6, h3d: 1.1, slots: { '0_2': ['501'] } },
  { id: 'b1', type: 'bacs', name: 'Bacs bijoux', x: 4, y: 0.1, w: 1.2, h: 0.45, rows: 4, cols: 3, h3d: 1.25, slots: { '3_0': ['801'] } },
  { id: 'm1', type: 'metal', name: 'Étagère baskets', x: 6.3, y: 0.1, w: 1.2, h: 0.5, rows: 5, cols: 2, h3d: 1.25, slots: { '4_0': ['401', '402'] } },
  { id: 't1', type: 'table', name: 'Table', x: 2, y: 3.5, w: 2, h: 1, rows: 1, cols: 3, h3d: 0.5, slots: {} },
] }], active: 'r1' };
const PLAN_PILE = { rooms: [{ id: 'r1', name: 'Garage', room: { w: 6, h: 5, wallH: 3 }, items: [
  { id: 'p1', type: 'pile', name: 'Cartons au sol', x: 2, y: 2, w: 1.5, h: 0.5, rows: 3, cols: 3, cell: 0.5, h3d: 0.34, nums: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], lift: 0 },
] }], active: 'r1' };
// IX. Étagère métal 5 niveaux × 2 cases, N°601 et N°602 au 2ᵉ niveau depuis le haut.
const PLAN_PLATEAUX = { rooms: [{ id: 'r1', name: 'Garage', room: { w: 6, h: 5, wallH: 3 }, items: [
  { id: 'm1', type: 'metal', name: 'Étagère réglable', x: 2, y: 0.1, w: 1.2, h: 0.5, rows: 5, cols: 2, h3d: 1.25, slots: { '1_0': ['601'], '1_1': ['602'] } },
] }], active: 'r1' };
// X. Table 2 places, un plateau dessous (rows 3 = dessus + plateau + sol) : N°701 dessus, N°702 et N°703 sur le plateau du dessous.
const PLAN_TABLE = { rooms: [{ id: 'r1', name: 'Garage', room: { w: 6, h: 5, wallH: 3 }, items: [
  { id: 't1', type: 'table', name: 'Table à étagère', x: 2, y: 2, w: 2, h: 1, rows: 3, cols: 2, h3d: 0.5, slots: { '0_0': ['701'], '1_0': ['702'], '1_1': ['703'] } },
] }], active: 'r1' };
// XI. Portant 3 cintres, 2 barres : N°801 et N°802 en haut, N°803 en bas (sous le 802).
const PLAN_PORTANT = { rooms: [{ id: 'r1', name: 'Garage', room: { w: 6, h: 5, wallH: 3 }, items: [
  { id: 'p1', type: 'cintres', name: 'Portant', x: 2, y: 2, w: 0.8, h: 0.5, rows: 2, cols: 3, h3d: 1.15, slots: { '0_0': ['801'], '0_1': ['802'], '1_1': ['803'] } },
] }], active: 'r1' };
// XII. Étagère à bacs 3 niveaux × 2 cases : N°901 et N°902 en haut, N°903 au milieu (sous le 902).
const PLAN_BACS = { rooms: [{ id: 'r1', name: 'Garage', room: { w: 6, h: 5, wallH: 3 }, items: [
  { id: 'b1', type: 'bacs', name: 'Bacs', x: 2, y: 0.1, w: 1.2, h: 0.45, rows: 3, cols: 2, h3d: 1.25, slots: { '0_0': ['901'], '0_1': ['902'], '1_1': ['903'] } },
] }], active: 'r1' };
const FICHES = { a700: { numero: '700', title: 'Paire test 700 taille 42', numberedAt: 7 } };
const PRESENTS = { nums: ['700', '401', '402', '501', '801', '601', '602', '701', '702', '703', '801', '802', '803', '901', '902', '903'], at: Date.now() };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: new Date().toISOString() }];

let ko = 0;
// `SEUL=VI,II` ne lance que ces sections (le banc complet prend plusieurs minutes).
const fait = (k) => !process.env.SEUL || process.env.SEUL.split(',').includes(k);
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi + ' — le contrôle a pu s’exécuter', String(e && e.message || e).split('\n')[0].slice(0, 160)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
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

async function ouvrir(b, vp, planObj) {
  const ROWS = [{ id: 'vrm_room', data: planObj }, { id: 'main', data: { vinted_annonce_numeros: FICHES } }];
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([f, pr]) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_garage_view', '"plan"');
    localStorage.setItem('vinted_annonce_numeros', JSON.stringify(f)); localStorage.setItem('vinted_nums_physiques', JSON.stringify(pr));
  } catch (_) {} }, [FICHES, PRESENTS]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel) && sel !== 'data,updated_at,cap:data->>capturedAt') ? projette(r, sel) : ({ ...r, updated_at: new Date().toISOString() });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
}
const plan = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_room_plan')); } catch (_) { return null; } });
const attendrePlan = async (pg, cond, ms = 9000) => { const t0 = Date.now(); let p = null; while (Date.now() - t0 < ms) { p = await plan(pg); try { if (p && cond(p)) return p; } catch (_) {} await pg.waitForTimeout(250); } return p; };
const item = (p, id) => p && p.rooms[0].items.find((o) => o.id === id);
const emp = (o) => { const odd = Math.abs(Math.round((o.rot || 0) / (Math.PI / 2))) % 2 === 1; return { cx: o.x + o.w / 2, cy: o.y + o.h / 2, w: odd ? o.h : o.w, h: odd ? o.w : o.h }; };
const chev = (a, b) => ((a.w + b.w) / 2 - Math.abs(a.cx - b.cx)) > 0.003 && ((a.h + b.h) / 2 - Math.abs(a.cy - b.cy)) > 0.003;
const attendre3D = async (pg) => pg.waitForFunction(() => { const e = document.querySelector('[data-stock3d]'); return e && e.dataset.camDist && document.querySelector('[data-stock3d] canvas'); }, null, { timeout: 40000 }).then(() => true).catch(() => false);
const sonde = (pg, fn, ...a) => pg.evaluate(([fn, a]) => { const el = document.querySelector('[data-stock3d] > div'); return el && el.__vrmProbe && el.__vrmProbe[fn] ? el.__vrmProbe[fn](...a) : null; }, [fn, a]);
const cliquerTexte = (pg, re) => pg.evaluate((src) => { const b = [...document.querySelectorAll('button')].reverse().find((x) => new RegExp(src).test(x.textContent) && x.getBoundingClientRect().width > 0); if (!b) return false; b.click(); return true; }, typeof re === 'string' ? re : re.source);
const cliquerSel = (pg, sel) => pg.evaluate((s) => { const b = document.querySelector(s); if (!b) return false; b.click(); return true; }, sel);

// Glisser une vignette « À ranger » (souris ou doigt) jusqu'à un point de l'écran.
const glisserVignette = (pg, num, x, y, type) => pg.evaluate(async ([num, x, y, type]) => {
  const attends = (ms) => new Promise((r) => setTimeout(r, ms));
  const el = document.querySelector(`[data-paire-a-ranger="${num}"]`); if (!el) return false;
  const r = el.getBoundingClientRect(); const a = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const ev = (t, cible, q) => cible.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: q.x, clientY: q.y, pointerId: 9, pointerType: type, isPrimary: true, button: 0, buttons: t === 'pointerup' ? 0 : 1 }));
  ev('pointerdown', el, a); await attends(60);
  for (let k = 1; k <= 8; k++) { ev('pointermove', document, { x: a.x + (x - a.x) * k / 8, y: a.y + (y - a.y) * k / 8 }); await attends(30); }
  ev('pointerup', document, { x, y }); return true;
}, [num, x, y, type]);
const visible = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel);
const chevRect = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

(async () => {
  let b, bSans;
  try {
    // ── I. SANS WebGL ───────────────────────────────────────────────────────
    bSans = await chromium.launch({ executablePath: CHROME, args: ['--disable-3d-apis', '--disable-webgl', '--disable-gpu', '--no-sandbox', '--no-proxy-server'] });
    if (fait('I')) await essaie('I. pièce en L sans WebGL', async () => {
      const { ctx, pg, errs } = await ouvrir(bSans, { width: 1512, height: 950 }, PLAN_L);
      const ok = await pg.waitForSelector('[data-plan-secours]', { timeout: 40000 }).then(() => true).catch(() => false);
      dit(ok, 'I. sans WebGL, une pièce en L se dessine VUE DU DESSUS');
      const n = ok ? await pg.$eval('[data-plan-secours-forme]', (e) => e.getAttribute('points').split(' ').length) : 0;
      dit(n === 6, 'I. avec SES six coins (pas un rectangle)', String(n));
      const m = ok ? await pg.$('[data-plan-secours-meuble="m1"]') : null;
      dit(!!m, 'I. l’étagère est dessinée à sa place');
      if (m) { await m.click(); const choisi = await pg.waitForSelector('[data-meuble-choisi="m1"]', { timeout: 8000 }).then(() => true).catch(() => false); dit(choisi, 'I. la toucher la choisit (sa barre s’ouvre)'); }
      await pg.evaluate(() => { const e = document.querySelector('[data-plan-secours]'); e && e.scrollIntoView({ block: 'center' }); });
      await pg.screenshot({ path: path.join(CAPT, 'stock-finitions-sans-webgl-L.png') });
      dit(errs.length === 0, 'aucune erreur d’app (sans WebGL)', errs.join(' | ').slice(0, 200));
      await ctx.close();
    });
    if (fait('I')) await essaie('I. pièce rectangle sans WebGL (l’autre sens)', async () => {
      const { ctx, pg } = await ouvrir(bSans, { width: 1512, height: 950 }, PLAN_RECT);
      await pg.waitForFunction(() => /Vue depuis l'entrée|Vue du dessus · touche/.test(document.body.innerText), null, { timeout: 40000 }).catch(() => {});
      const r = await pg.evaluate(() => ({ plan: !!document.querySelector('[data-plan-secours]'), persp: /Vue depuis l'entrée/.test(document.body.innerText) }));
      dit(!r.plan && r.persp, 'I. une pièce rectangle garde sa vue en perspective', JSON.stringify(r));
      await ctx.close();
    });
    await bSans.close(); bSans = null;

    b = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--no-proxy-server'] });

    // ── II. GRANDE PIÈCE, VUE DU DESSUS ─────────────────────────────────────
    if (fait('II')) await essaie('II. étiquettes lisibles', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, PLAN_GRAND);
      dit(await attendre3D(pg), 'II. la 3D de la grande pièce se monte');
      await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'center' }));
      await cliquerSel(pg, '[data-stock3d] button[aria-label="Vue de dessus"]');
      await pg.waitForTimeout(2500);
      const e1 = await sonde(pg, 'etiquettes');
      dit(!!e1 && e1.total === 32, 'II. les 32 étagères ont leur étiquette', e1 ? `${e1.visibles}/${e1.total}` : 'sonde absente');
      if (e1) {
        const chevauche = e1.rects.some((a, i) => e1.rects.some((c, j) => j > i && chevRect(a, c)));
        dit(!chevauche, 'II. aucune étiquette visible n’en recouvre une autre', `${e1.visibles} visibles`);
        dit(e1.visibles < e1.total && e1.visibles > 0, 'II. celles qui se recouvriraient sont masquées (il y en a)', `${e1.visibles}/${e1.total}`);
        dit(e1.puces > 0, 'II. un meuble dont l’étiquette est masquée montre encore son nombre de paires (puce)', `${e1.puces} puce(s)`);
        dit(e1.rects.every((r) => Math.abs(r.h - e1.px) < 1), 'II. chacune fait la même hauteur à l’écran', e1.rects.map((r) => r.h.toFixed(1)).slice(0, 4).join(','));
      }
      await pg.screenshot({ path: path.join(CAPT, 'stock-finitions-grand-dessus.png') });
      for (let i = 0; i < 4; i++) { await cliquerSel(pg, '[data-stock3d] button[aria-label="Zoom avant"]'); await pg.waitForTimeout(400); }
      await pg.waitForTimeout(1500);
      const e2 = await sonde(pg, 'etiquettes');
      if (e1 && e2) {
        dit(e2.rects.length > 0 && e2.rects.every((r) => Math.abs(r.h - e1.px) < 1), 'II. après un zoom, la taille à l’écran ne change pas', `${e1.px} px`);
        const chev2 = e2.rects.some((a, i) => e2.rects.some((c, j) => j > i && chevRect(a, c)));
        dit(!chev2, 'II. et toujours aucun chevauchement après le zoom', `${e2.visibles} visibles`);
      }
      await pg.screenshot({ path: path.join(CAPT, 'stock-finitions-grand-zoom.png') });
      dit(errs.length === 0, 'aucune erreur d’app (grande pièce)', errs.join(' | ').slice(0, 200));
      await ctx.close();
    });

    // ── III & IV. PORTANT ET BACS (1512) ────────────────────────────────────
    if (fait('III')) await essaie('III/IV. portant et bacs', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, PLAN_NICHES);
      dit(await attendre3D(pg), 'III. la 3D de la boutique se monte');
      await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'center' }));
      await pg.waitForTimeout(1500);
      let p = await sonde(pg, 'project', 'c1', { cell: '0_2', num: '501' }); await pg.mouse.click(p.x, p.y); await pg.waitForTimeout(900);
      dit(await pg.waitForSelector('[data-meuble-choisi="c1"]', { timeout: 8000 }).then(() => true).catch(() => false), 'III. toucher le vêtement choisit le portant');
      await cliquerSel(pg, '[data-stock3d] button[aria-label="Se mettre en face du meuble"]'); await pg.waitForTimeout(2200);
      const f = await sonde(pg, 'faceNum', 'c1', { cell: '0_2', num: '501' });
      dit(!!f && f.dot > 0.5, 'III. de face, l’étiquette du cintre montre sa face NUMÉROTÉE', f ? `orientation ${f.dot.toFixed(2)}` : 'introuvable');
      dit(!!f && f.lg >= 15, 'III. et elle est assez large pour se lire', f ? `${Math.round(f.lg)} px` : '');
      await pg.screenshot({ path: path.join(CAPT, 'stock-finitions-portant.png') });
      // bacs
      await cliquerSel(pg, '[data-stock3d] button[aria-label="Voir toute la pièce"]'); await pg.waitForTimeout(1200);
      p = await sonde(pg, 'project', 'b1', { cell: '3_0', num: '801' }); await pg.mouse.click(p.x, p.y); await pg.waitForTimeout(900);
      dit(await pg.waitForSelector('[data-meuble-choisi="b1"]', { timeout: 8000 }).then(() => true).catch(() => false), 'IV. toucher un bac choisit l’étagère à bacs');
      await cliquerSel(pg, '[data-stock3d] button[aria-label="Se mettre en face du meuble"]'); await pg.waitForTimeout(2200);
      const fb = await sonde(pg, 'faceNum', 'b1', { cell: '3_0', num: '801' });
      dit(!!fb && fb.dot > 0.5, 'IV. le bac rangé montre son numéro en façade', fb ? fb.dot.toFixed(2) : 'introuvable');
      await pg.screenshot({ path: path.join(CAPT, 'stock-finitions-bacs.png') });
      p = await sonde(pg, 'project', 'b1', { cell: '1_1' });
      if (!p) throw new Error('bac vide 1_1 introuvable');
      await pg.mouse.click(p.x, p.y);
      const ouvert = await pg.waitForSelector('[data-apercu-meuble="b1"]', { timeout: 8000 }).then(() => true).catch(() => false);
      dit(ouvert, 'IV. toucher un bac vide ouvre « Ranger » avec l’aperçu de l’étagère');
      dit(await cliquerTexte(pg, 'N°700'), 'IV. la paire N°700 est proposée');
      const sb = (item(await attendrePlan(pg, (q) => (item(q, 'b1').slots || {})['1_1']), 'b1') || {}).slots || {};
      dit(JSON.stringify(sb['1_1']) === '["700"]' && JSON.stringify(sb['3_0']) === '["801"]', 'IV. elle est écrite dans CE bac, l’autre bac n’a pas bougé', JSON.stringify(sb));
      dit(errs.length === 0, 'aucune erreur d’app (portant, bacs)', errs.join(' | ').slice(0, 200));
      await ctx.close();
    });

    // ── VI. PILE DE CARTONS : RETIRER CELUI DU BAS (« ça décolle tout ») ────
    if (fait('VI')) await essaie('VI. pile : retirer le carton du bas', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, PLAN_PILE);
      dit(await attendre3D(pg), 'VI. la 3D de la pile se monte');
      await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'center' }));
      await pg.waitForTimeout(1500);
      let p = await sonde(pg, 'boite', 'p1', '5'); await pg.mouse.click(p.x, p.y); await pg.waitForTimeout(900);   // choisit la pile
      p = await sonde(pg, 'boite', 'p1', '1'); await pg.mouse.click(p.x, p.y);
      const feuille = await pg.waitForFunction(() => /Numéro de cette boîte/.test(document.body.innerText), null, { timeout: 8000 }).then(() => true).catch(() => false);
      const val = feuille ? await pg.$eval('form input', (i) => i.value) : '';
      dit(feuille && val === '1', 'VI. toucher le carton du BAS ouvre SA feuille (N°1)', val);
      const nums = ['2', '3', '4', '5', '6', '7', '8', '9'];
      const avant = {}; for (const n of nums) avant[n] = await sonde(pg, 'boite', 'p1', n);
      // On vide le champ, on valide, puis on relève les positions PENDANT l'animation.
      await pg.evaluate(() => { const i = document.querySelector('form input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); i.form.requestSubmit(); });
      const montee = await pg.evaluate(async ([liste, av]) => {
        const el = document.querySelector('[data-stock3d] > div'); const pire = {};
        for (let t = 0; t < 40; t++) { for (const n of liste) { const q = el.__vrmProbe.boite('p1', n); if (q && av[n]) { const d = q.yMonde - av[n].yMonde; if (!(n in pire) || d > pire[n]) pire[n] = d; } } await new Promise((r) => setTimeout(r, 25)); }
        return pire;
      }, [nums, avant]);
      const sauts = Object.entries(montee).filter(([, d]) => d > 0.01).map(([n, d]) => `N°${n} +${d.toFixed(2)} m`);
      dit(sauts.length === 0, 'VI. pendant l’animation, AUCUN carton ne monte', sauts.join(', '));
      const ap = await attendrePlan(pg, (q) => (item(q, 'p1').nums || []).indexOf('1') < 0);
      dit(JSON.stringify(item(ap, 'p1').nums) === '["2","3","","4","5","6","7","8","9"]', 'VI. donnée : seule la colonne du carton retiré a bougé', JSON.stringify(item(ap, 'p1').nums));
      await pg.waitForTimeout(900);
      const apres = {}; for (const n of nums) apres[n] = await sonde(pg, 'boite', 'p1', n);
      const bouges = ['4', '5', '6', '7', '8', '9'].filter((n) => !apres[n] || !avant[n] || Math.abs(apres[n].x - avant[n].x) > 1.5 || Math.abs(apres[n].yMonde - avant[n].yMonde) > 0.005);
      dit(bouges.length === 0, 'VI. les autres colonnes n’ont pas bougé d’un pixel', bouges.join(','));
      const desc = ['2', '3'].every((n) => apres[n] && avant[n] && avant[n].yMonde - apres[n].yMonde > 0.3 && avant[n].yMonde - apres[n].yMonde < 0.7);
      dit(desc, 'VI. les deux cartons du dessus sont descendus d’UN cran', ['2', '3'].map((n) => apres[n] && avant[n] ? (avant[n].yMonde - apres[n].yMonde).toFixed(2) : '?').join(', '));
      await pg.screenshot({ path: path.join(CAPT, 'stock-finitions-pile.png') });
      dit(errs.length === 0, 'aucune erreur d’app (pile)', errs.join(' | ').slice(0, 200));
      await ctx.close();
    });

    // ── VII. LA BARRE DU STOCK : deux modes, la recherche, les dimensions ───
    if (fait('VII')) await essaie('VII. barre et modes', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, PLAN_NICHES);
      dit(await attendre3D(pg), 'VII. la 3D se monte');
      dit(await visible(pg, '[data-stock-barre]'), 'VII. une barre au-dessus de la pièce (mode + recherche)');
      dit(await pg.evaluate(() => { const b = document.querySelector('[data-mode-stock="ranger"]'); return !!b && b.getAttribute('aria-pressed') === 'true'; }), 'VII. on arrive en mode « Ranger »');
      dit(!(await visible(pg, '[data-amenager]')), 'VII. en mode Ranger, les outils d’aménagement sont rangés');
      await cliquerSel(pg, '[data-mode-stock="amenager"]'); await pg.waitForTimeout(400);
      dit(await pg.evaluate(() => { const d = document.querySelector('[data-amenager]'); return !!d && d.open && d.getBoundingClientRect().height > 0; }), 'VII. « Aménager » ouvre les outils de la pièce');
      dit(!(await visible(pg, '[data-bande-a-ranger]')), 'VII. en mode Aménager, la bande « À ranger » se tait');
      // dimensions de l'étagère (mode Aménager)
      await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(900);
      let p = await sonde(pg, 'project', 'm1', { cell: '4_0', num: '401' }); await pg.mouse.click(p.x, p.y);
      await pg.waitForSelector('[data-reglage="niveau"]', { timeout: 8000 });
      const av = item(await plan(pg), 'm1');
      await cliquerSel(pg, '[data-reglage="niveau"] button[aria-label$="plus"]');
      let q = await attendrePlan(pg, (x) => item(x, 'm1').h3d !== av.h3d);
      const niv = (o) => o.h3d * 1.5 / o.rows;
      dit(Math.abs(niv(item(q, 'm1')) - 0.425) < 0.002, 'VII. « Hauteur d’un niveau + » monte chaque niveau de 5 cm', `${(niv(av) * 100).toFixed(1)} → ${(niv(item(q, 'm1')) * 100).toFixed(1)} cm`);
      for (let k = 0; k < 6; k++) { await cliquerSel(pg, '[data-reglage="niveau"] button[aria-label$="moins"]'); await pg.waitForTimeout(250); }
      q = await plan(pg); const m = item(q, 'm1');
      dit(JSON.stringify((m.slots || {})['4_0']) === '["401","402"]', 'VII. un niveau trop bas pour les boîtes déjà rangées est REFUSÉ (rien n’est caché ni retiré)', `niveau ${(niv(m) * 100).toFixed(1)} cm · ${JSON.stringify(m.slots)}`);
      dit(await pg.evaluate(() => /ne tient plus toutes les boîtes/.test(document.body.innerText)), 'VII. et le refus est DIT');
      const w0 = m.w, h0 = m.h;
      await cliquerSel(pg, '[data-reglage="largeur"] button[aria-label$="plus"]'); await pg.waitForTimeout(300);
      await cliquerSel(pg, '[data-reglage="profondeur"] button[aria-label$="plus"]');
      q = await attendrePlan(pg, (x) => item(x, 'm1').h !== h0);
      dit(Math.abs(item(q, 'm1').w - (w0 + 0.1)) < 0.011 && Math.abs(item(q, 'm1').h - (h0 + 0.05)) < 0.011, 'VII. largeur +10 cm, profondeur +5 cm', `${w0}×${h0} → ${item(q, 'm1').w}×${item(q, 'm1').h}`);
      await pg.screenshot({ path: path.join(CAPT, 'stock-finitions-amenager.png') });
      await cliquerSel(pg, '[data-mode-stock="ranger"]'); await pg.waitForTimeout(400);
      dit(!(await visible(pg, '[data-reglage="niveau"]')) && !(await visible(pg, '[data-amenager]')), 'VII. revenu en Ranger : plus aucun réglage de meuble à l’écran');
      // recherche
      await pg.fill('[data-stock-barre] input', '402');
      dit(await pg.waitForSelector('[data-trouve-num="402"]', { timeout: 6000 }).then(() => true).catch(() => false), 'VII. chercher « 402 » dit le meuble et la case');
      dit(await pg.evaluate(() => /Étagère baskets/.test((document.querySelector('[data-trouve-num]') || {}).textContent || '')), 'VII. … en nommant le bon meuble');
      dit(errs.length === 0, 'aucune erreur d’app (barre)', errs.join(' | ').slice(0, 200));
      await ctx.close();
    });

    // ── IX. LES PLATEAUX D'UNE ÉTAGÈRE, COLONNE PAR COLONNE ─────────────────
    if (fait('IX')) for (const vp of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) await essaie('IX. plateaux ' + vp.width, async () => {
      const t = 'IX. ' + vp.width + ' px';
      const { ctx, pg, errs } = await ouvrir(b, vp, PLAN_PLATEAUX);
      dit(await attendre3D(pg), t + ' : la 3D se monte');
      const pl0 = await sonde(pg, 'plateaux', 'm1');
      dit(pl0 && pl0.length === 6 && pl0.every((x) => x.w > 1.0), t + ' : sans réglage, les 6 plateaux sont pleins (comme avant)', JSON.stringify(pl0));
      await cliquerSel(pg, '[data-mode-stock="amenager"]'); await pg.waitForTimeout(400);
      await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(900);
      const p = await sonde(pg, 'project', 'm1', { cell: '1_0', num: '601' });
      if (vp.width < 600) await pg.touchscreen.tap(p.x, p.y); else await pg.mouse.click(p.x, p.y);
      await pg.waitForSelector('[data-plateaux-3d]', { timeout: 8000, state: 'attached' });
      await pg.evaluate(() => { const d = document.querySelector('[data-plateaux-3d]'); d.open = true; });
      // Retirer le plateau sous la rangée 2, colonne 1 seulement.
      await cliquerSel(pg, '[data-plateaux-3d] [data-planche-case-choix="2:1"]');
      let q = await attendrePlan(pg, (x) => Array.isArray(item(x, 'm1').planches));
      const m = item(q, 'm1');
      dit(JSON.stringify(m.planches) === '[1,"2:2",3,4]', t + ' : le plateau retiré n\'est retiré que sous la colonne 1', JSON.stringify(m.planches));
      dit(JSON.stringify(m.slots['2_0']) === '["601"]' && !m.slots['1_0'] && JSON.stringify(m.slots['1_1']) === '["602"]', t + ' : N°601 tombe d\'un niveau, N°602 (colonne 2, plateau gardé) ne bouge pas', JSON.stringify(m.slots));
      await pg.waitForTimeout(1200);
      await pg.evaluate(() => document.querySelector('[data-plateaux-3d]').scrollIntoView({ block: 'center' })).catch(() => {});
      await pg.screenshot({ path: path.join(CAPT, 'stock-plateaux-reglage-' + vp.width + '.png') }).catch(() => {});
      const pl1 = await sonde(pg, 'plateaux', 'm1');
      dit(pl1 && pl1.filter((x) => x.w < 0.7).length === 1 && pl1.length === 6, t + ' : la 3D dessine un plateau de moitié', JSON.stringify(pl1));
      // « Aucun » : tout tombe en bas de sa colonne.
      await cliquerTexte(pg, '^Aucune$');
      q = await attendrePlan(pg, (x) => JSON.stringify(item(x, 'm1').planches) === '[]');
      const m2 = item(q, 'm1');
      dit(JSON.stringify(m2.slots['4_0']) === '["601"]' && JSON.stringify(m2.slots['4_1']) === '["602"]', t + ' : sans plateau, les boîtes descendent tout en bas, numéros inchangés', JSON.stringify(m2.slots));
      await pg.screenshot({ path: path.join(CAPT, 'stock-plateaux-' + vp.width + '.png') });
      const x = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(x.sw <= x.cw + 1, t + ' : aucun débordement', `${x.sw} > ${x.cw}`);
      dit(errs.length === 0, t + ' : aucune erreur d’app', errs.join(' | ').slice(0, 200));
      await ctx.close();
    });

    // ── X. LES PLATEAUX SOUS UNE TABLE, PLACE PAR PLACE ─────────────────────
    if (fait('X')) for (const vp of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) await essaie('X. table ' + vp.width, async () => {
      const t = 'X. ' + vp.width + ' px';
      const { ctx, pg, errs } = await ouvrir(b, vp, PLAN_TABLE);
      dit(await attendre3D(pg), t + ' : la 3D se monte');
      const pl0 = await sonde(pg, 'plateaux', 't1');
      dit(pl0 && pl0.length === 1 && pl0[0].w > 1.5, t + ' : sans réglage, le plateau sous la table est plein', JSON.stringify(pl0));
      await cliquerSel(pg, '[data-mode-stock="amenager"]'); await pg.waitForTimeout(400);
      await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(900);
      const p = await sonde(pg, 'project', 't1', { cell: '0_0', num: '701' });
      if (vp.width < 600) await pg.touchscreen.tap(p.x, p.y); else await pg.mouse.click(p.x, p.y);
      await pg.waitForSelector('[data-plateaux-3d]', { timeout: 8000, state: 'attached' });
      dit(await pg.evaluate(() => (document.querySelector('[data-reglage="sous-table"] b') || {}).textContent === '2'), t + ' : « Niveaux sous la table » dit 2 (le plateau et le sol)');
      await pg.evaluate(() => { const d = document.querySelector('[data-plateaux-3d]'); d.open = true; });
      dit(await pg.evaluate(() => !!document.querySelector('[data-plateaux-3d] [data-plateau-fixe="1"]') && !document.querySelector('[data-plateaux-3d] [data-planche-case-choix="1:1"]')), t + ' : le dessus de la table ne s\'enlève pas');
      await cliquerSel(pg, '[data-plateaux-3d] [data-planche-case-choix="2:1"]');
      const q = await attendrePlan(pg, (x) => Array.isArray(item(x, 't1').planches));
      const m = item(q, 't1');
      dit(JSON.stringify(m.planches) === '[1,"2:2"]', t + ' : le plateau sous la table n\'est retiré que sous la place 1', JSON.stringify(m.planches));
      dit(JSON.stringify(m.slots['2_0']) === '["702"]' && JSON.stringify(m.slots['1_1']) === '["703"]' && JSON.stringify(m.slots['0_0']) === '["701"]', t + ' : N°702 tombe au sol, N°703 reste sur son plateau, N°701 reste sur la table', JSON.stringify(m.slots));
      await pg.waitForTimeout(1200);
      const pl1 = await sonde(pg, 'plateaux', 't1');
      dit(pl1 && pl1.length === 1 && pl1[0].w < 1.0, t + ' : la 3D dessine un plateau de moitié sous la table', JSON.stringify(pl1));
      await pg.screenshot({ path: path.join(CAPT, 'stock-table-' + vp.width + '.png') });
      const x = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(x.sw <= x.cw + 1, t + ' : aucun débordement', `${x.sw} > ${x.cw}`);
      dit(errs.length === 0, t + ' : aucune erreur d’app', errs.join(' | ').slice(0, 200));
      await ctx.close();
    });

    // ── XI. LES BARRES D'UN PORTANT, CINTRE PAR CINTRE ───────────────────────
    if (fait('XI')) for (const vp of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) await essaie('XI. portant ' + vp.width, async () => {
      const t = 'XI. ' + vp.width + ' px';
      const { ctx, pg, errs } = await ouvrir(b, vp, PLAN_PORTANT);
      dit(await attendre3D(pg), t + ' : la 3D se monte');
      const pl0 = await sonde(pg, 'plateaux', 'p1');
      dit(pl0 && pl0.length === 2, t + ' : sans réglage, les deux barres sont entières', JSON.stringify(pl0));
      await cliquerSel(pg, '[data-mode-stock="amenager"]'); await pg.waitForTimeout(400);
      await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(900);
      const p = await sonde(pg, 'project', 'p1', { cell: '0_0', num: '801' });
      if (vp.width < 600) await pg.touchscreen.tap(p.x, p.y); else await pg.mouse.click(p.x, p.y);
      await pg.waitForSelector('[data-plateaux-3d]', { timeout: 8000, state: 'attached' });
      dit(await pg.evaluate(() => (document.querySelector('[data-reglage="barres"] b') || {}).textContent === '2'), t + ' : « Barres » dit 2');
      await pg.evaluate(() => { const d = document.querySelector('[data-plateaux-3d]'); d.open = true; });
      await cliquerSel(pg, '[data-plateaux-3d] [data-planche-case-choix="1:1"]');
      const q = await attendrePlan(pg, (x) => Array.isArray(item(x, 'p1').planches));
      const m = item(q, 'p1');
      dit(JSON.stringify(m.planches) === '["1:2","1:3"]', t + ' : la barre du haut n\'est retirée qu\'au cintre 1', JSON.stringify(m.planches));
      dit(JSON.stringify(m.slots['1_0']) === '["801"]' && JSON.stringify(m.slots['0_1']) === '["802"]' && JSON.stringify(m.slots['1_1']) === '["803"]' && !m.slots['0_0'], t + ' : N°801 descend sur la barre du bas, N°802 et N°803 ne bougent pas', JSON.stringify(m.slots));
      await pg.waitForTimeout(1200);
      const pl1 = await sonde(pg, 'plateaux', 'p1');
      dit(pl1 && pl1.length === 2 && Math.min(...pl1.map(v => v.w)) < Math.max(...pl1.map(v => v.w)) * 0.8, t + ' : la 3D dessine une barre du haut raccourcie', JSON.stringify(pl1));
      await pg.screenshot({ path: path.join(CAPT, 'stock-portant-' + vp.width + '.png') });
      const x = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(x.sw <= x.cw + 1, t + ' : aucun débordement', `${x.sw} > ${x.cw}`);
      dit(errs.length === 0, t + ' : aucune erreur d’app', errs.join(' | ').slice(0, 200));
      await ctx.close();
    });

    // ── XII. LES PLATEAUX D'UNE ÉTAGÈRE À BACS, COLONNE PAR COLONNE ─────────
    if (fait('XII')) for (const vp of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) await essaie('XII. bacs ' + vp.width, async () => {
      const t = 'XII. ' + vp.width + ' px';
      const { ctx, pg, errs } = await ouvrir(b, vp, PLAN_BACS);
      dit(await attendre3D(pg), t + ' : la 3D se monte');
      const pl0 = await sonde(pg, 'plateaux', 'b1');
      dit(pl0 && pl0.length === 4 && pl0.every((x) => x.w > 1.0), t + ' : sans réglage, les 4 plateaux sont pleins (comme avant)', JSON.stringify(pl0));
      await cliquerSel(pg, '[data-mode-stock="amenager"]'); await pg.waitForTimeout(400);
      await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(900);
      const p = await sonde(pg, 'project', 'b1', { cell: '0_0', num: '901' });
      if (vp.width < 600) await pg.touchscreen.tap(p.x, p.y); else await pg.mouse.click(p.x, p.y);
      await pg.waitForSelector('[data-plateaux-3d]', { timeout: 8000, state: 'attached' });
      await pg.evaluate(() => { const d = document.querySelector('[data-plateaux-3d]'); d.open = true; });
      dit(await pg.evaluate(() => /bac descend/.test((document.querySelector('[data-plateaux-3d]') || {}).textContent || '')), t + ' : l\'explication parle du bac');
      await cliquerSel(pg, '[data-plateaux-3d] [data-planche-case-choix="1:1"]');
      const q = await attendrePlan(pg, (x) => Array.isArray(item(x, 'b1').planches));
      const m = item(q, 'b1');
      dit(JSON.stringify(m.planches) === '["1:2",2]', t + ' : le plateau n\'est retiré que sous la colonne 1', JSON.stringify(m.planches));
      dit(JSON.stringify(m.slots['1_0']) === '["901"]' && !m.slots['0_0'] && JSON.stringify(m.slots['0_1']) === '["902"]' && JSON.stringify(m.slots['1_1']) === '["903"]', t + ' : le bac N°901 descend d\'un niveau, N°902 et N°903 ne bougent pas', JSON.stringify(m.slots));
      await pg.waitForTimeout(1200);
      const pl1 = await sonde(pg, 'plateaux', 'b1');
      dit(pl1 && pl1.length === 4 && pl1.filter((x) => x.w < 0.7).length === 1, t + ' : la 3D dessine un plateau de moitié', JSON.stringify(pl1));
      await pg.screenshot({ path: path.join(CAPT, 'stock-bacs-' + vp.width + '.png') });
      const x = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(x.sw <= x.cw + 1, t + ' : aucun débordement', `${x.sw} > ${x.cw}`);
      dit(errs.length === 0, t + ' : aucune erreur d’app', errs.join(' | ').slice(0, 200));
      await ctx.close();
    });

    // ── VIII. RANGER EN MOINS DE GESTES ─────────────────────────────────────
    if (fait('VIII')) await essaie('VIII. ranger : un geste', async () => {
      let { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, PLAN_NICHES);
      dit(await attendre3D(pg), 'VIII. la 3D se monte');
      await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(1500);
      // a) une place libre d'un meuble PAS choisi : un seul toucher ouvre « Ranger »
      let p = await sonde(pg, 'project', 'm1', { cell: '4_1' }); await pg.mouse.click(p.x, p.y);
      dit(await pg.waitForSelector('[data-apercu-meuble="m1"]', { timeout: 6000 }).then(() => true).catch(() => false), 'VIII. une place libre se touche d’UN geste, sans choisir le meuble avant');
      await ctx.close();
      // b) une boîte occupée d'un meuble pas choisi : le premier toucher ne fait que choisir
      ({ ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, PLAN_NICHES));
      await attendre3D(pg); await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(1500);
      p = await sonde(pg, 'project', 'b1', { cell: '3_0', num: '801' }); await pg.mouse.click(p.x, p.y); await pg.waitForTimeout(900);
      dit(!(await pg.evaluate(() => /Numéro de cette boîte|N° de la boîte/.test(document.body.innerText))), 'VIII. l’autre sens : une boîte déjà rangée ne s’ouvre pas d’un toucher (on ne change pas un numéro par mégarde)');
      // c) la vignette N°700 + « Ranger ici » (prochaine place libre)
      dit(await visible(pg, '[data-paire-a-ranger="700"]'), 'VIII. la bande « À ranger » montre la paire N°700');
      dit(await pg.evaluate(() => !document.querySelector('[data-paire-a-ranger="401"]')), 'VIII. une paire déjà rangée (401) n’y est pas');
      await pg.click('[data-paire-a-ranger="700"]');
      dit(await pg.waitForSelector('[data-paire-prete="700"]', { timeout: 4000 }).then(() => true).catch(() => false), 'VIII. toucher la vignette la prépare et propose la prochaine place');
      const avant = await plan(pg);
      await pg.click('[data-ranger-prochaine]');
      const q = await attendrePlan(pg, (x) => JSON.stringify(x).includes('"700"'));
      const ou = q.rooms[0].items.flatMap((o) => Object.entries(o.slots || {}).filter(([, a]) => (a || []).includes('700')).map(([k]) => o.id + ':' + k));
      dit(ou.length === 1 && ou[0] === 'b1:3_1', 'VIII. « Ranger ici » la pose à la prochaine place libre du meuble choisi — le bac à côté', ou.join(','));
      const autres = (x) => JSON.stringify(x.rooms[0].items.map((o) => ({ id: o.id, s: Object.fromEntries(Object.entries(o.slots || {}).map(([k, a]) => [k, (a || []).filter((v) => v !== '700')]).filter(([, a]) => a.length)) })));
      dit(autres(q) === autres(avant), 'VIII. rien d’autre n’a bougé');
      await ctx.close();
      // d) glisser-déposer À LA SOURIS sur une place de l'étagère
      ({ ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, PLAN_NICHES));
      await attendre3D(pg); await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(1500);
      p = await sonde(pg, 'project', 'm1', { cell: '4_1' });
      dit(await glisserVignette(pg, '700', p.x, p.y, 'mouse'), 'VIII. la vignette se prend à la souris');
      let s2 = (item(await attendrePlan(pg, (x) => (item(x, 'm1').slots || {})['4_1']), 'm1') || {}).slots || {};
      dit(JSON.stringify(s2['4_1']) === '["700"]', 'VIII. glisser-déposer à la SOURIS : posée là où on la lâche', JSON.stringify(s2));
      dit(errs.length === 0, 'aucune erreur d’app (ranger 1512)', errs.join(' | ').slice(0, 200));
      await ctx.close();
      // e) au DOIGT, 390 px : glisser jusque sur la table
      ({ ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, PLAN_NICHES));
      await attendre3D(pg); await pg.waitForTimeout(800);
      await pg.evaluate(() => document.querySelector('[data-bande-a-ranger]').scrollIntoView({ block: 'start' })); await pg.waitForTimeout(600);
      p = await sonde(pg, 'project', 't1', { cell: '0_1' });
      const dansEcran = p && p.y > 0 && p.y < 844;
      if (!dansEcran) { await pg.evaluate(() => window.scrollBy(0, 200)); await pg.waitForTimeout(500); p = await sonde(pg, 'project', 't1', { cell: '0_1' }); }
      dit(await glisserVignette(pg, '700', p.x, p.y, 'touch'), 'VIII. la vignette se prend au doigt (390 px)');
      s2 = (item(await attendrePlan(pg, (x) => JSON.stringify(item(x, 't1').slots || {}).includes('700')), 't1') || {}).slots || {};
      dit(JSON.stringify(s2).includes('"700"'), 'VIII. glisser-déposer au DOIGT : posée sur la table', JSON.stringify(s2));
      await pg.screenshot({ path: path.join(CAPT, 'stock-finitions-ranger-390.png') });
      const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      dit(deb <= 1, 'VIII. aucun débordement horizontal à 390 px (bande « À ranger » comprise)', `${deb} px`);
      dit(errs.length === 0, 'aucune erreur d’app (ranger 390)', errs.join(' | ').slice(0, 200));
      await ctx.close();
      // f) toucher la vignette puis une place : posée SANS feuille
      ({ ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, PLAN_NICHES));
      await attendre3D(pg); await pg.waitForTimeout(800);
      await pg.evaluate(() => document.querySelector('[data-bande-a-ranger]').scrollIntoView({ block: 'start' })); await pg.waitForTimeout(500);
      await pg.tap('[data-paire-a-ranger="700"]'); await pg.waitForSelector('[data-paire-prete="700"]', { timeout: 4000 });
      await pg.evaluate(() => document.querySelector('[data-stock-barre]').scrollIntoView({ block: 'start' })); await pg.waitForTimeout(400);
      await pg.screenshot({ path: path.join(CAPT, 'stock-finitions-barre-390.png') });
      await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(600);
      p = await sonde(pg, 'project', 'c1', { cell: '0_4' }); await pg.touchscreen.tap(p.x, p.y);
      s2 = (item(await attendrePlan(pg, (x) => (item(x, 'c1').slots || {})['0_4']), 'c1') || {}).slots || {};
      dit(JSON.stringify(s2['0_4']) === '["700"]', 'VIII. vignette touchée puis un cintre libre : le N° y est accroché, sans feuille à remplir', JSON.stringify(s2));
      dit(!(await pg.evaluate(() => !!document.querySelector('[data-apercu-meuble]'))), 'VIII. … et aucune feuille ne s’est ouverte');
      dit(errs.length === 0, 'aucune erreur d’app (vignette puis place)', errs.join(' | ').slice(0, 200));
      await ctx.close();
    });

    // ── V. AU DOIGT, 390 px ─────────────────────────────────────────────────
    if (fait('V')) await essaie('V. au doigt', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, PLAN_NICHES);
      dit(await attendre3D(pg), 'V. la 3D se monte à 390 px');
      await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'center' }));
      await pg.waitForTimeout(1500);
      let p = await sonde(pg, 'project', 'm1', { cell: '4_0', num: '401', avant: true }); await pg.touchscreen.tap(p.x, p.y); await pg.waitForTimeout(900);
      dit(await pg.waitForSelector('[data-meuble-choisi="m1"]', { timeout: 8000 }).then(() => true).catch(() => false), 'V. toucher l’étagère la choisit');
      await cliquerSel(pg, '[data-stock3d] button[aria-label="Se mettre en face du meuble"]'); await pg.waitForTimeout(2200);
      await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(500);
      p = await sonde(pg, 'project', 'm1', { cell: '4_1' });
      await pg.touchscreen.tap(p.x, p.y);
      dit(await pg.waitForSelector('[data-apercu-meuble="m1"]', { timeout: 8000 }).then(() => true).catch(() => false), 'V. toucher la place libre ouvre « Ranger »');
      dit(await cliquerTexte(pg, 'N°700'), 'V. la paire N°700 est proposée');
      let s = (item(await attendrePlan(pg, (q) => (item(q, 'm1').slots || {})['4_1']), 'm1') || {}).slots || {};
      dit(JSON.stringify(s['4_1']) === '["700"]', 'V. POSER : écrite dans la case touchée', JSON.stringify(s));
      await pg.waitForTimeout(1200);
      await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(500);
      p = await sonde(pg, 'project', 'm1', { cell: '4_0', num: '401', avant: true });
      await pg.touchscreen.tap(p.x, p.y);
      const feuille = await pg.waitForFunction(() => /Numéro de cette boîte/.test(document.body.innerText), null, { timeout: 8000 }).then(() => true).catch(() => false);
      const valF = feuille ? await pg.$eval('form input', (i) => i.value) : '';
      dit(feuille && valF === '401', 'V. toucher la boîte du dessous ouvre SA feuille (N°401)', valF);
      if (feuille) await pg.evaluate(() => { const i = document.querySelector('form input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); i.form.requestSubmit(); });
      s = (item(await attendrePlan(pg, (q) => ((item(q, 'm1').slots || {})['4_0'] || []).length === 1), 'm1') || {}).slots || {};
      dit(JSON.stringify(s['4_0']) === '["402"]', 'V. RETIRER : la boîte du dessus est descendue', JSON.stringify(s['4_0']));
      await pg.waitForTimeout(800);
      const e3 = await sonde(pg, 'etiquettes');
      dit(!!e3 && e3.rects.length > 0 && e3.rects.every((r) => Math.abs(r.h - e3.px) < 1), 'V. après deux reconstructions (poser, retirer), les étiquettes gardent leur taille à l’écran', e3 ? e3.rects.map((r) => r.h.toFixed(1)).join(',') : 'sonde absente');
      await pg.screenshot({ path: path.join(CAPT, 'stock-finitions-doigt-390.png') });
      // déplacer la table dans le plan, au doigt, jusque sur le portant
      dit(await cliquerSel(pg, '[data-mode-stock="amenager"]'), 'V. le mode « Aménager » se choisit au doigt');
      await pg.waitForSelector('[data-plan-svg]', { timeout: 8000 });
      const avant = await plan(pg); const t0 = item(avant, 't1'), c = item(avant, 'c1');
      // Un doigt qui glisse (événements « touch » espacés : React doit voir la
      // prise avant le mouvement, comme dans la vraie vie).
      await pg.evaluate(async ([tx, ty, cx, cy]) => {
        const attends = (ms) => new Promise((r) => setTimeout(r, ms));
        const svg = document.querySelector('[data-plan-svg]'); const ctm = svg.getScreenCTM();
        const v = (x, y) => { const p = svg.createSVGPoint(); p.x = x; p.y = y; return p.matrixTransform(ctm); };
        const g = document.querySelector('[data-plan-meuble="t1"] rect'); const a = v(tx, ty), z = v(cx, cy);
        const ev = (t, el, q) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: q.x, clientY: q.y, pointerId: 7, pointerType: 'touch', isPrimary: true }));
        ev('pointerdown', g, a); await attends(80);
        for (let k = 1; k <= 6; k++) { ev('pointermove', svg, { x: a.x + (z.x - a.x) * k / 6, y: a.y + (z.y - a.y) * k / 6 }); await attends(50); }
        ev('pointerup', svg, z);
      }, [t0.x + 0.25, t0.y + 0.2, c.x + 0.4, c.y + 0.2]);
      const ap = await attendrePlan(pg, (q) => item(q, 't1').x !== t0.x || item(q, 't1').y !== t0.y); const t1 = item(ap, 't1');
      dit(t1.x !== t0.x || t1.y !== t0.y, 'V. DÉPLACER au doigt : la table a bougé', `${t0.x},${t0.y} → ${t1.x},${t1.y}`);
      dit(!ap.rooms[0].items.filter((o) => o.id !== 't1').some((o) => chev(emp(o), emp(t1))), 'V. lâchée sur le portant, elle ne traverse aucun meuble', JSON.stringify(emp(t1)));
      const chevB = await pg.evaluate(() => { const bs = [...document.querySelectorAll('[data-stock3d] button')].map((b) => ({ t: b.getAttribute('aria-label') || b.textContent, r: b.getBoundingClientRect() })).filter((x) => x.r.width > 0); const out = []; bs.forEach((a, i) => bs.forEach((c, j) => { if (j > i && a.r.left < c.r.right - 1 && c.r.left < a.r.right - 1 && a.r.top < c.r.bottom - 1 && c.r.top < a.r.bottom - 1) out.push(a.t + ' × ' + c.t); })); return out; });
      dit(chevB.length === 0, 'V. les commandes de la vue 3D ne se chevauchent pas (390 px, « De face » affiché)', chevB.join(' ; '));
      const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      dit(deb <= 1, 'V. aucun débordement horizontal à 390 px', `${deb} px`);
      dit(errs.length === 0, 'aucune erreur d’app (390 px)', errs.join(' | ').slice(0, 200));
      await ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (bSans) await bSans.close(); if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ finitions du stock : ${ko} rouge(s)` : '\n✅ finitions du stock : tout est vert');
  process.exit(ko ? 1 : 0);
})();
