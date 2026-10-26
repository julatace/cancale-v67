// Banc : LA PIÈCE DU STOCK — forme libre, meubles, non-traversée, gravité,
// vue du dessus, aperçu du meuble, bouton « Où sont ces paires » de Colis
// (17 octobre). Compagnon de `garage3d.cjs` (la souris), sur une pièce et des
// paires INVENTÉES (il vit dans le dépôt, aucune fixture). Il exige :
//   A. la 3D se monte avec les nouveaux meubles (étagère métal, table, portant) ;
//   B. toucher la place libre d'une étagère ouvre la feuille « Ranger » AVEC
//      l'aperçu du meuble (la case visée) ; choisir la paire l'écrit dans CETTE
//      case (la pile de la case grandit par le haut) ;
//   C. GRAVITÉ : sortir la boîte du DESSOUS fait descendre celle du dessus (la
//      donnée ET la 3D : elle tombe, et elle est plus bas à l'écran) ;
//   D. forme libre : « En L » donne une pièce à 6 coins, la 3D se remonte ;
//   E. NON-TRAVERSÉE : un meuble glissé (vue du dessus) sur un autre est poussé
//      à côté ; la pile posée sur la table SUIT la table ; et la 3D passe en vue
//      du dessus (« ↩ 3D » la ramène) ;
//   F. GRAVITÉ : la table retirée, la pile qui était dessus redescend au sol,
//      sans rien traverser ;
//   G. Colis : le bouton nomme les paires à expédier, ouvre le Stock, les
//      colore (contour) et dit où est chacune ;
//   H. à 390 px tactile : pas de débordement, la vue du dessus tient ;
//   et aucune erreur d'app.
// `--reaffaiblir=<nom>` n'existe pas ici : les preuves par réaffaiblissement
// des RÈGLES sont dans `audit-stock-plan.cjs --prouve` ; ce banc juge le RENDU.
// ⚠️ WebGL logiciel = lent : on juge des ÉTATS (sondes `data-*`, données
//    écrites), jamais des durées.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6311;
const CAPT = process.env.CAPTURES || os.tmpdir();

const PLAN = { rooms: [{ id: 'r1', name: 'Atelier test', room: { w: 8, h: 6, wallH: 3 }, items: [
  { id: 'm1', type: 'metal', name: 'Étagère métal test', x: 1, y: 0, w: 1.2, h: 0.5, rows: 5, cols: 2, h3d: 1.25, slots: { '4_0': ['401', '402'] } },
  { id: 't1', type: 'table', name: 'Table test', x: 1.5, y: 3.5, w: 2, h: 1, rows: 1, cols: 3, h3d: 0.5, slots: {} },
  { id: 'p2', type: 'pile', name: 'Pile sur table', x: 2.25, y: 3.75, w: 0.5, h: 0.5, rows: 3, cell: 0.5, nums: ['601', '602'], lift: 0.75 },
  { id: 'c1', type: 'cintres', name: 'Portant test', x: 5.5, y: 0.2, w: 1.5, h: 0.5, rows: 1, cols: 8, h3d: 1.1, slots: { '0_1': ['501'] } },
] }], active: 'r1' };
const FICHES = { a700: { numero: '700', title: 'Paire test 700 taille 42', numberedAt: 7 } };
const PRESENTS = { nums: ['700', '401', '402', '501', '601', '602'], at: Date.now() };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: new Date().toISOString() }];
const VENTES = [{ transaction_id: 9301, title: 'Vente test 402 taille 41', price: { amount: '60.0', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: new Date(Date.now() - 3600e3).toISOString() }];
const ROWS = [
  { id: 'vrm_room', data: PLAN },
  { id: 'main', data: { vinted_sale_overrides: { 9301: { numero: '402' } }, vinted_annonce_numeros: FICHES } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: new Date().toISOString(), payload: { my_orders: VENTES } } },
];

let ko = 0;
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

async function ouvrir(b, vp, tab) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([f, pr]) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_garage_view', '"plan"');
    localStorage.setItem('vinted_annonce_numeros', JSON.stringify(f)); localStorage.setItem('vinted_nums_physiques', JSON.stringify(pr));
    localStorage.setItem('vinted_sale_overrides', JSON.stringify({ 9301: { numero: '402' } }));
  } catch (_) {} }, [FICHES, PRESENTS]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel) && sel !== 'data,updated_at,cap:data->>capturedAt') ? projette(r, sel) : ({ ...r, updated_at: (r.data && r.data.capturedAt) || new Date().toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
}
const plan = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_room_plan')); } catch (_) { return null; } });
// `save()` écrit le navigateur 500 ms après le dernier changement (et une page
// en WebGL logiciel tient mal ses minuteries) : on attend que la donnée arrive.
const attendrePlan = async (pg, cond, ms = 8000) => { const t0 = Date.now(); let p = null; while (Date.now() - t0 < ms) { p = await plan(pg); try { if (p && cond(p)) return p; } catch (_) {} await pg.waitForTimeout(250); } return p; };
const item = (p, id) => p && p.rooms[0].items.find((o) => o.id === id);
const emp = (o) => { const odd = Math.abs(Math.round((o.rot || 0) / (Math.PI / 2))) % 2 === 1; return { cx: o.x + o.w / 2, cy: o.y + o.h / 2, w: odd ? o.h : o.w, h: odd ? o.w : o.h }; };
const chev = (a, b) => ((a.w + b.w) / 2 - Math.abs(a.cx - b.cx)) > 0.003 && ((a.h + b.h) / 2 - Math.abs(a.cy - b.cy)) > 0.003;
const attendre3D = async (pg) => pg.waitForFunction(() => { const e = document.querySelector('[data-stock3d]'); return e && e.dataset.camDist && document.querySelector('[data-stock3d] canvas'); }, null, { timeout: 40000 }).then(() => true).catch(() => false);
const sonde = (pg, fn, ...a) => pg.evaluate(([fn, a]) => { const el = document.querySelector('[data-stock3d] > div'); return el && el.__vrmProbe ? el.__vrmProbe[fn](...a) : null; }, [fn, a]);
// Les feuilles floutent la scène : en rendu logiciel le clic attend longtemps un bouton « stable ».
// ⚠️ On déclenche le clic DANS la page : la feuille floute une scène WebGL en
//    rendu logiciel et Playwright attendait un bouton « stable » qui ne l'est
//    jamais à 1,5 image/s (mesuré : 20 s puis abandon). C'est la logique de
//    l'app qu'on juge ici, pas la cadence de l'émulateur.
const cliquerTexte = (pg, re) => pg.evaluate((src) => { const b = [...document.querySelectorAll('button')].reverse().find((x) => new RegExp(src).test(x.textContent) && x.getBoundingClientRect().width > 0); if (!b) return false; b.click(); return true; }, typeof re === 'string' ? re : re.source);
const cliquerSel = (pg, sel) => pg.evaluate((s) => { const b = document.querySelector(s); if (!b) return false; b.click(); return true; }, sel);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--no-proxy-server'] });

    // ── 1512 px ─────────────────────────────────────────────────────────────
    {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, 'garage');
      const pret = await attendre3D(pg);
      dit(pret, 'A. la 3D se monte avec l’étagère métal, la table, le portant et la pile');
      await pg.waitForTimeout(1500);
      dit(!!(await sonde(pg, 'project', 'm1', {})) && !!(await sonde(pg, 'project', 'c1', {})) && !!(await sonde(pg, 'project', 't1', {})), 'A. les trois nouveaux meubles sont à l’écran');

      await essaie('B. ranger avec l’aperçu', async () => {
        // Toucher une BOÎTE choisit l'étagère (une place libre, elle, se range d'un geste
        // depuis le chantier 11 : on choisit donc par la boîte 401).
        let p = await sonde(pg, 'project', 'm1', { cell: '4_0', num: '401', avant: true }) || await sonde(pg, 'project', 'm1', { cell: '4_0', num: '401' }); await pg.mouse.click(p.x, p.y); await pg.waitForTimeout(800);   // choisit l'étagère
        p = await sonde(pg, 'project', 'm1', { cell: '4_1' });
        if (!p) throw new Error('place libre 4_1 introuvable');
        await pg.mouse.click(p.x, p.y);
        const ouvert = await pg.waitForSelector('[data-apercu-meuble]', { timeout: 8000 }).then(() => true).catch(() => false);
        const ap = ouvert ? await pg.evaluate(() => { const e = document.querySelector('[data-apercu-meuble]'); return { id: e.getAttribute('data-apercu-meuble'), c: e.getAttribute('data-apercu-case') }; }) : null;
        dit(!!ap && ap.id === 'm1' && ap.c === '4_1', 'B. la feuille « Ranger » montre l’aperçu du meuble, la case visée', JSON.stringify(ap));
        await pg.waitForTimeout(1500); await pg.screenshot({ path: path.join(CAPT, 'stock-piece-ranger-1512.png') });
        dit(await cliquerTexte(pg, 'N°700'), 'B. la paire N°700 est proposée dans la feuille');
        const s4 = (item(await attendrePlan(pg, (p) => (item(p, 'm1').slots || {})['4_1']), 'm1') || {}).slots || {};
        dit(JSON.stringify(s4['4_1']) === '["700"]' && JSON.stringify(s4['4_0']) === '["401","402"]', 'B. la paire choisie est écrite dans CETTE case, rien d’autre ne bouge', JSON.stringify(s4));
      });

      await essaie('C. gravité dans une case', async () => {
        // De FACE (le geste qu'on fait pour ranger) : vue de haut, la boîte du
        // dessus cache le centre de celle du dessous.
        await cliquerSel(pg, '[data-stock3d] button[aria-label="Se mettre en face du meuble"]'); await pg.waitForTimeout(2000);
        const avant = await sonde(pg, 'project', 'm1', { cell: '4_0', num: '402' });
        const p = await sonde(pg, 'project', 'm1', { cell: '4_0', num: '401' });
        await pg.mouse.click(p.x, p.y);
        const feuille = await pg.waitForFunction(() => /Numéro de cette boîte/.test(document.body.innerText), null, { timeout: 8000 }).then(() => true).catch(() => false);
        const val = feuille ? await pg.$eval('form input', (i) => i.value) : '';
        dit(feuille && val === '401', 'C. toucher la boîte du dessous ouvre SA feuille (N°401 : changer ou sortir)', val);
        await pg.evaluate(() => { const i = document.querySelector('form input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); i.form.requestSubmit(); });
        const s4 = (item(await attendrePlan(pg, (p) => ((item(p, 'm1').slots || {})['4_0'] || []).length === 1), 'm1') || {}).slots || {};
        dit(JSON.stringify(s4['4_0']) === '["402"]', 'C. sortie : la boîte du dessus est descendue à sa place (donnée)', JSON.stringify(s4['4_0']));
        const chute = await pg.evaluate(() => Number((document.querySelector('[data-stock3d]') || {}).dataset?.chute || 0));
        dit(chute >= 1, 'C. et dans la 3D elle TOMBE (animation de chute lancée)', String(chute));
        await pg.waitForTimeout(800);
        const apres = await sonde(pg, 'project', 'm1', { cell: '4_0', num: '402' });
        dit(avant && apres && apres.y > avant.y + 2, 'C. la boîte 402 est plus BAS à l’écran qu’avant', avant && apres ? `${avant.y.toFixed(0)} → ${apres.y.toFixed(0)} px` : 'introuvable');
      });

      // ouvre « Aménager la pièce »
      await pg.evaluate(() => { const d = document.querySelector('[data-amenager]'); if (d) d.open = true; });
      dit(await pg.waitForSelector('[data-plan-svg]', { timeout: 8000 }).then(() => true).catch(() => false), 'D. « Aménager la pièce » montre la pièce VUE DU DESSUS');

      await essaie('D. forme libre', async () => {
        await pg.click('[data-forme="L"]');
        const r = (await attendrePlan(pg, (p) => (p.rooms[0].room.poly || []).length === 6)).rooms[0].room;
        dit(Array.isArray(r.poly) && r.poly.length === 6, 'D. « En L » : la pièce a six coins', JSON.stringify(r.poly));
        const pts = await pg.$eval('[data-plan-forme]', (e) => e.getAttribute('points').split(' ').length);
        dit(pts === 6, 'D. la vue du dessus dessine la forme', String(pts));
        dit(await attendre3D(pg), 'D. la 3D se remonte sur la nouvelle forme');
        await pg.waitForTimeout(1500);
        await pg.screenshot({ path: path.join(CAPT, 'stock-piece-L-1512.png') });
      });

      await essaie('E. non-traversée et vue du dessus', async () => {
        const avant = await plan(pg); const t0 = item(avant, 't1'), p0 = item(avant, 'p2'), m = item(avant, 'm1');
        // glisser la table (vue du dessus) jusque SUR l'étagère
        const pos = await pg.evaluate(([tx, ty, mx, my]) => {
          const svg = document.querySelector('[data-plan-svg]'); const ctm = svg.getScreenCTM();
          const v = (x, y) => { const p = svg.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(ctm); return { x: q.x, y: q.y }; };
          return { de: v(tx, ty), a: v(mx, my) };
        }, [t0.x + 0.25, t0.y + 0.2, m.x + 0.25, m.y + 0.2]);   // on saisit la table par un coin (la pile posée au milieu est au-dessus)
        await pg.mouse.move(pos.de.x, pos.de.y); await pg.mouse.down();
        await pg.mouse.move((pos.de.x + pos.a.x) / 2, (pos.de.y + pos.a.y) / 2, { steps: 4 });
        await pg.mouse.move(pos.a.x, pos.a.y, { steps: 4 }); await pg.mouse.up();
        const ap = await attendrePlan(pg, (p) => item(p, 't1').x !== t0.x || item(p, 't1').y !== t0.y); const t1 = item(ap, 't1'), p1 = item(ap, 'p2'), m1 = item(ap, 'm1');
        dit(t1.x !== t0.x || t1.y !== t0.y, 'E. la table a bougé', `${t0.x},${t0.y} → ${t1.x},${t1.y}`);
        dit(!chev(emp(t1), emp(m1)), 'E. lâchée SUR l’étagère, la table est poussée à côté — elle ne la traverse pas', JSON.stringify(emp(t1)));
        dit(Math.abs((p1.x - p0.x) - (t1.x - t0.x)) < 0.02 && Math.abs((p1.y - p0.y) - (t1.y - t0.y)) < 0.02 && p1.lift > 0, 'E. la pile posée sur la table l’a SUIVIE', `pile ${p0.x},${p0.y} → ${p1.x},${p1.y}`);
        await pg.evaluate(() => document.querySelector('[data-stock3d]').scrollIntoView({ block: 'start' }));
        const dessus = await pg.waitForFunction(() => (document.querySelector('[data-stock3d]') || {}).dataset?.vue === 'dessus', null, { timeout: 15000 }).then(() => true).catch(() => false);
        dit(dessus, 'E. après le changement de disposition, la 3D est passée en vue du DESSUS');
        await pg.screenshot({ path: path.join(CAPT, 'stock-piece-dessus-1512.png') });
        const bt = await pg.$('[data-revenir-3d]');
        dit(!!bt, 'E. un bouton « ↩ 3D » ramène la vue en 3D');
        if (bt) { await bt.click(); const r3 = await pg.waitForFunction(() => (document.querySelector('[data-stock3d]') || {}).dataset?.vue === '3d', null, { timeout: 15000 }).then(() => true).catch(() => false); dit(r3, 'E. « ↩ 3D » ramène bien la vue en 3D'); }
      });

      await essaie('F. table retirée, la pile redescend', async () => {
        await pg.evaluate(() => { const g = document.querySelector('[data-plan-meuble="t1"] rect'); const r = g.getBoundingClientRect(); const o = { bubbles: true, clientX: r.left + 6, clientY: r.top + 6, pointerId: 1 }; g.dispatchEvent(new PointerEvent('pointerdown', o)); g.ownerSVGElement.dispatchEvent(new PointerEvent('pointerup', o)); });
        await pg.waitForTimeout(600);
        dit(await cliquerSel(pg, 'button[aria-label="Supprimer le meuble"]'), 'F. la table choisie dans le plan propose « Supprimer »');
        await pg.waitForTimeout(500); await cliquerTexte(pg, '^Confirmer$');
        const ap = await attendrePlan(pg, (p) => !item(p, 't1')); const p = item(ap, 'p2');
        dit(!item(ap, 't1'), 'F. la table est retirée');
        dit(p && !(p.lift > 0), 'F. la pile qui était posée dessus est redescendue au SOL', p ? `lift ${p.lift}` : 'pile perdue');
        const autres = ap.rooms[0].items.filter((o) => o.id !== 'p2');
        dit(p && !autres.some((o) => chev(emp(o), emp(p))), 'F. et elle ne traverse aucun meuble', p ? JSON.stringify(emp(p)) : '');
      });

      await pg.screenshot({ path: path.join(CAPT, 'stock-piece-1512.png'), fullPage: false });
      dit(errs.length === 0, 'aucune erreur d’app (1512 px)', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }

    // ── G. COLIS → STOCK ────────────────────────────────────────────────────
    await essaie('G. bouton Colis', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, 'cat_bord');
      const bt = await pg.waitForSelector('[data-colis-stock]', { timeout: 30000 }).catch(() => null);
      dit(!!bt, 'G. l’onglet Colis propose « Où sont ces paires dans le stock »');
      if (!bt) { await ctx.close(); return; }
      dit(await bt.getAttribute('data-colis-stock') === '1', 'G. il compte la paire À FAIRE (N°402)');
      await bt.click();
      const ok3d = await attendre3D(pg);
      dit(ok3d, 'G. le Stock s’ouvre');
      const l = await pg.waitForSelector('[data-cherche="402"]', { timeout: 15000 }).then(() => pg.$eval('[data-cherche="402"]', (e) => ({ t: e.getAttribute('data-trouve'), x: e.innerText }))).catch(() => null);
      dit(l && l.t === '1' && /Étagère métal test/.test(l.x), 'G. il dit où est la N°402 (le meuble et la case)', l ? l.x : 'rien');
      await pg.waitForTimeout(2500);
      const n = await pg.evaluate(() => Number((document.querySelector('[data-stock3d]') || {}).dataset?.cibles || 0));
      dit(n >= 1, 'G. et la colore dans la 3D (contour sur SON carton)', String(n));
      await pg.screenshot({ path: path.join(CAPT, 'stock-piece-colis-1512.png') });
      dit(errs.length === 0, 'aucune erreur d’app (Colis → Stock)', errs.join(' | ').slice(0, 200));
      await ctx.close();
    });

    // ── H. 390 px ───────────────────────────────────────────────────────────
    await essaie('H. 390 px', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, 'garage');
      dit(await attendre3D(pg), 'H. la 3D se monte à 390 px');
      await pg.evaluate(() => { const d = document.querySelector('[data-amenager]'); if (d) d.open = true; });
      if (!(await pg.waitForSelector('[data-plan-svg]', { timeout: 8000 }).then(() => true).catch(() => false))) throw new Error('aucune vue du dessus');
      await pg.waitForTimeout(1200);
      const r = await pg.evaluate(() => ({ deb: document.documentElement.scrollWidth - document.documentElement.clientWidth, w: document.querySelector('[data-plan-svg]').getBoundingClientRect().width }));
      dit(r.deb <= 1, 'H. aucun débordement horizontal', `${r.deb} px`);
      dit(r.w > 250 && r.w <= 390, 'H. la vue du dessus tient dans l’écran', `${Math.round(r.w)} px`);
      await pg.evaluate(() => document.querySelector('[data-plan-svg]').scrollIntoView({ block: 'center' }));
      await pg.screenshot({ path: path.join(CAPT, 'stock-piece-plan-390.png') });
      dit(errs.length === 0, 'aucune erreur d’app (390 px)', errs.join(' | ').slice(0, 200));
      await ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ pièce du stock : ${ko} rouge(s)` : '\n✅ pièce du stock : tout est vert');
  process.exit(ko ? 1 : 0);
})();
