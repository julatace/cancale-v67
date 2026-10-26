// Banc : L'ASSISTANT DU STOCK (26 octobre). Pièces et paires INVENTÉES (il vit
// dans le dépôt, aucune fixture). Julien : « le stock en 3D n'est pas pratique,
// on n'a pas d'agent qui aide pour créer la pièce et pour gérer comment on range ».
// Il exige, à 1512 px et à 390 px tactile :
//  A. pièce vide : « Créer ma pièce en 3 questions » ; le nombre d'articles est
//     pré-rempli avec le stock ; la proposition loge tout ; RIEN n'est créé avant
//     « Créer cette pièce » ; puis la taille donnée, les meubles proposés, une
//     porte, aucun meuble qui en traverse un autre ou sort de la pièce ;
//  B. « Tout ranger » : la feuille propose une place pour chaque article, les
//     numéros qui se suivent ensemble ; rien avant « Ranger » ; ensuite chaque
//     numéro rangé UNE fois, et aucun numéro de fiche changé ;
//  C. « Annuler » n'écrit rien ; dans une pièce déjà meublée l'assistant crée
//     une NOUVELLE pièce (l'ancienne ne bouge pas) ;
//  D. « Liste des cases » : le même « Tout ranger » ;
//  E. AU PAVÉ NUMÉRIQUE (ordinateur) : un chiffre tapé n'importe où ouvre la
//     saisie ; N° + Entrée range un article à la prochaine place libre ; un N°
//     déjà rangé est montré, pas rangé deux fois ; un N° hors stock n'est JAMAIS
//     rangé ; Échap ressort le dernier rangé.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7121;
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
const NUMS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const FICHES = Object.fromEntries(NUMS.map((n) => ['a' + n, { numero: n, title: 'Paire test ' + n + ' taille 42', numberedAt: +n }]));
const PRESENTS = { nums: NUMS, at: Date.now() };
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

async function ouvrir(b, vp, planObj, vue = 'plan') {
  const ROWS = [{ id: 'vrm_room', data: planObj }, { id: 'main', data: { vinted_annonce_numeros: FICHES } }];
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((v) => { window.__vue = v; }, vue);
  await pg.addInitScript(([f, pr]) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_garage_view', JSON.stringify(window.__vue || 'plan'));
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


const VIDE = { rooms: [{ id: 'r1', name: 'Ma pièce', room: { w: 10, h: 8, wallH: 3.4 }, items: [] }], active: 'r1' };
const UNE = { rooms: [{ id: 'r1', name: 'Atelier', room: { w: 6, h: 4, wallH: 3 }, items: [
  { id: 'm1', type: 'metal', name: 'Étagère A', x: 0.1, y: 0.1, w: 1.2, h: 0.5, rows: 5, cols: 2, h3d: 1.25, slots: {} },
  { id: 'm2', type: 'metal', name: 'Étagère B', x: 1.5, y: 0.1, w: 1.2, h: 0.5, rows: 5, cols: 2, h3d: 1.25, slots: {} },
] }], active: 'r1' };
const numsPoses = (p) => { const out = []; (p.rooms || []).forEach((r) => (r.items || []).forEach((it) => Object.values(it.slots || {}).forEach((a) => (a || []).forEach((v) => out.push(String(v)))))); return out; };
const vu = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? e : null; }, sel).then(Boolean);
const finFeuille = (pg) => pg.waitForFunction(() => document.getAnimations().filter((a) => a.animationName === 'cancaleSheet').every((a) => a.playState === 'finished'), null, { timeout: 8000 }).catch(() => {});
const attr = (pg, sel, a) => pg.evaluate(([s, a]) => { const e = document.querySelector(s); return e ? e.getAttribute(a) : null; }, [sel, a]);

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  for (const vp of [{ width: 1512, height: 900 }, { width: 390, height: 844 }]) {
    const T = ' [' + vp.width + ']';
    // ── A. Pièce vide → « Créer ma pièce en 3 questions » ──
    await essaie('A' + T, async () => {
      const { ctx, pg, errs } = await ouvrir(b, vp, VIDE);
      await pg.waitForSelector('[data-piece-vide]', { timeout: 30000 });
      dit(await vu(pg, '[data-piece-vide] [data-piece-assistant]'), 'pièce vide : le geste « Créer ma pièce en 3 questions » est proposé' + T);
      const auDessus = await pg.evaluate(() => { const b = document.querySelector('[data-piece-vide] [data-piece-assistant]').getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0; });
      dit(auDessus, 'pièce vide : le geste est visible SANS défiler (au-dessus de la 3D)' + T);
      const deb = await pg.evaluate(() => { const c = document.querySelector('[data-piece-vide]').getBoundingClientRect(); return [...document.querySelectorAll('[data-piece-vide] button')].filter((b) => b.getBoundingClientRect().right > c.right + 1).map((b) => b.textContent); });
      dit(deb.length === 0, 'pièce vide : aucun bouton ne sort de la carte' + T, deb.join(' | '));
      await cliquerSel(pg, '[data-piece-vide] [data-piece-assistant]');
      await pg.waitForSelector('[data-assistant-piece]', { timeout: 8000 });
      dit(await attr(pg, '[data-piece-nombre]', 'value') === '12', 'le nombre d’articles est pré-rempli avec le stock (12)' + T, await attr(pg, '[data-piece-nombre]', 'value'));
      await pg.fill('[data-piece-longueur]', '4'); await pg.fill('[data-piece-profondeur]', '3');
      await cliquerSel(pg, '[data-piece-meuble="metal"]');
      await pg.waitForTimeout(300); await finFeuille(pg);
      const nM = +(await attr(pg, '[data-piece-proposition]', 'data-piece-proposition')), places = +(await attr(pg, '[data-piece-proposition]', 'data-piece-places')), manque = +(await attr(pg, '[data-piece-proposition]', 'data-piece-manque'));
      dit(nM >= 1 && places >= 12 && manque === 0, 'la proposition loge les 12 articles' + T, `${nM} meubles · ${places} places · manque ${manque}`);
      if (process.env.CAPTURES) await pg.screenshot({ path: path.join(CAPT, 'stock-assistant-feuille-' + vp.width + '.png') });
      const ecran = (sel) => pg.evaluate((q) => { const e = document.querySelector(q); if (!e) return 'absent'; const r = e.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1 ? 'oui' : `${Math.round(r.top)}..${Math.round(r.bottom)} / ${innerHeight}`; }, sel);
      dit(await ecran('[data-piece-proposition] svg') === 'oui', 'la feuille et son aperçu sont À L’ÉCRAN (pas sous la page)' + T, await ecran('[data-piece-proposition] svg'));
      await pg.evaluate(() => { const b = document.querySelector('[data-piece-creer]'); b && b.scrollIntoView({ block: 'nearest' }); });
      dit(await ecran('[data-piece-creer]') === 'oui', '« Créer cette pièce » est à l’écran' + T, await ecran('[data-piece-creer]'));
      const avant = await plan(pg);
      dit(!avant || (avant.rooms[0].items || []).length === 0, 'rien n’est créé avant « Créer cette pièce »' + T);
      await cliquerSel(pg, '[data-piece-creer]');
      const p = await attendrePlan(pg, (q) => (q.rooms[0].items || []).length > 0);
      const its = p ? p.rooms[0].items : [];
      const meubles = its.filter((o) => o.type === 'metal'), portes = its.filter((o) => o.type === 'porte');
      dit(p && p.rooms[0].room.w === 4 && p.rooms[0].room.h === 3, 'la pièce prend la taille donnée (4 × 3 m)' + T, p && JSON.stringify(p.rooms[0].room));
      dit(meubles.length === nM && portes.length === 1, 'les meubles proposés et une porte sont posés' + T, `${meubles.length} étagères, ${portes.length} porte`);
      const fps = its.map(emp); let croise = 0, dehors = 0;
      for (let i = 0; i < fps.length; i++) { const f = fps[i]; if (f.cx - f.w / 2 < -1e-6 || f.cy - f.h / 2 < -1e-6 || f.cx + f.w / 2 > 4 + 1e-6 || f.cy + f.h / 2 > 3 + 1e-6) dehors++; for (let j = i + 1; j < fps.length; j++) if (chev(f, fps[j])) croise++; }
      dit(croise === 0 && dehors === 0, 'aucun meuble ne traverse un autre ni ne sort de la pièce' + T, `chevauchements ${croise}, dehors ${dehors}`);
      await pg.waitForSelector('[data-tout-ranger-ouvrir]', { timeout: 12000 }).catch(() => {});
      // ── B. « Tout ranger » → proposition, puis rangé sur son « oui » ──
      dit(await vu(pg, '[data-tout-ranger-ouvrir]'), 'après la création : « Tout ranger » est proposé' + T);
      await cliquerSel(pg, '[data-tout-ranger-ouvrir]');
      await pg.waitForSelector('[data-tout-ranger]', { timeout: 8000 });
      await finFeuille(pg);   // la feuille monte du bas (0,26 s)
      dit(await attr(pg, '[data-tout-ranger]', 'data-tout-ranger') === '12', 'la feuille propose une place pour les 12' + T, await attr(pg, '[data-tout-ranger]', 'data-tout-ranger'));
      const groupes = await pg.$$eval('[data-tout-ranger-groupe]', (els) => els.map((e) => e.textContent));
      dit(groupes.length >= 1 && /N°1 à N°/.test(groupes[0]), 'les numéros qui se suivent sont proposés ensemble' + T, groupes.slice(0, 2).join(' | '));
      if (process.env.CAPTURES) await pg.screenshot({ path: path.join(CAPT, 'stock-tout-ranger-' + vp.width + '.png') });
      dit(await pg.evaluate(() => { const e = document.querySelector('[data-tout-ranger-ok]'); if (!e) return false; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; }), '« Ranger les 12 » est à l’écran' + T);
      const avB = await plan(pg);
      dit(numsPoses(avB).length === 0, 'rien n’est rangé avant « Ranger les 12 »' + T);
      await cliquerSel(pg, '[data-tout-ranger-ok]');
      const pB = await attendrePlan(pg, (q) => numsPoses(q).length === 12);
      const poses = pB ? numsPoses(pB) : [];
      dit(poses.length === 12 && new Set(poses).size === 12 && NUMS.every((n) => poses.includes(n)), 'les 12 numéros sont rangés, chacun une fois' + T, poses.join(','));
      const fiches = await pg.evaluate(() => JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'));
      dit(Object.values(fiches).map((f) => f.numero).sort().join() === NUMS.slice().sort().join(), 'aucun numéro de fiche n’a changé' + T);
      dit(!(await vu(pg, '[data-tout-ranger-ouvrir]')), 'plus rien à ranger : le bouton s’en va' + T);
      dit(errs.length === 0, 'aucune erreur de page (A, B)' + T, errs.slice(0, 2).join(' | '));
      if (vp.width < 600) await pg.screenshot({ path: path.join(CAPT, 'stock-assistant-390.png') });
      await ctx.close();
    });
    // ── C. « Annuler » n'écrit rien ; la nouvelle pièce garde l'ancienne ──
    await essaie('C' + T, async () => {
      const { ctx, pg, errs } = await ouvrir(b, vp, UNE);
      await pg.waitForSelector('[data-tout-ranger-ouvrir]', { timeout: 30000 });
      await cliquerSel(pg, '[data-tout-ranger-ouvrir]');
      await pg.waitForSelector('[data-tout-ranger]', { timeout: 8000 });
      await cliquerTexte(pg, '^Annuler$');
      await pg.waitForTimeout(600);
      const p = await plan(pg);
      dit(!p || numsPoses(p).length === 0, '« Annuler » : rien n’est rangé' + T);
      await cliquerSel(pg, '[data-mode-stock="amenager"]');
      await pg.waitForSelector('[data-stock-barre] [data-piece-assistant]', { timeout: 8000 });
      await cliquerSel(pg, '[data-stock-barre] [data-piece-assistant]');
      await pg.waitForSelector('[data-assistant-piece]', { timeout: 8000 });
      await pg.fill('[data-piece-longueur]', '5'); await pg.fill('[data-piece-profondeur]', '4'); await pg.fill('[data-piece-nombre]', '30');
      await cliquerSel(pg, '[data-piece-meuble="bois"]'); await pg.waitForTimeout(200);
      await cliquerSel(pg, '[data-piece-creer]');
      const p2 = await attendrePlan(pg, (q) => q.rooms.length === 2);
      dit(p2 && p2.rooms.length === 2 && p2.rooms[0].items.length === 2 && p2.rooms[0].items.every((o) => o.type === 'metal'), 'pièce non vide : l’assistant crée une NOUVELLE pièce, l’ancienne ne bouge pas' + T, p2 && p2.rooms.map((r) => r.name + ':' + r.items.length).join(' · '));
      dit(p2 && p2.active === p2.rooms[1].id && p2.rooms[1].items.some((o) => o.type === 'bois'), 'la nouvelle pièce est ouverte, avec le meuble choisi' + T);
      dit(errs.length === 0, 'aucune erreur de page (C)' + T, errs.slice(0, 2).join(' | '));
      await ctx.close();
    });
    // ── D. « Liste des cases » : le même « Tout ranger » ──
    await essaie('D' + T, async () => {
      const { ctx, pg, errs } = await ouvrir(b, vp, UNE, 'ranger');
      await pg.waitForSelector('[data-rangement]', { timeout: 30000 });
      await pg.waitForSelector('[data-rangement] [data-tout-ranger-ouvrir]', { timeout: 12000 }).catch(() => {});
      dit(await vu(pg, '[data-rangement] [data-tout-ranger-ouvrir]'), 'Liste des cases : « Tout ranger d’un geste » est proposé' + T);
      await cliquerSel(pg, '[data-rangement] [data-tout-ranger-ouvrir]');
      await pg.waitForSelector('[data-tout-ranger-ok]', { timeout: 8000 });
      await cliquerSel(pg, '[data-tout-ranger-ok]');
      const p = await attendrePlan(pg, (q) => numsPoses(q).length === 12);
      dit(p && numsPoses(p).length === 12, 'Liste des cases : les 12 sont rangés' + T, p && numsPoses(p).join(','));
      dit(errs.length === 0, 'aucune erreur de page (D)' + T, errs.slice(0, 2).join(' | '));
      await ctx.close();
    });
    // ── E. Pavé numérique (ordinateur seulement) ──
    if (vp.width >= 1000) await essaie('E' + T, async () => {
      const { ctx, pg, errs } = await ouvrir(b, vp, UNE);
      await pg.waitForSelector('[data-stock-saisie]', { timeout: 30000 });
      await pg.waitForSelector('[data-tout-ranger-ouvrir]', { timeout: 12000 });
      await pg.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
      await pg.keyboard.press('Numpad5');
      const foc = await pg.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-stock-saisie') ? document.activeElement.value : null);
      dit(foc === '5', 'un chiffre du pavé tapé n’importe où ouvre la saisie du N°' + T, String(foc));
      await pg.keyboard.press('NumpadEnter');
      const p1 = await attendrePlan(pg, (q) => numsPoses(q).includes('5'), 6000);
      dit(p1 && numsPoses(p1).length === 1 && numsPoses(p1)[0] === '5', 'N°5 + Entrée : rangée, seule, à la prochaine place libre' + T, p1 && numsPoses(p1).join(','));
      dit(await vu(pg, '[data-stock-clavier="range"]'), 'la ligne dit où elle est rangée' + T);
      const suite = await pg.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-stock-saisie') && document.activeElement.value === '');
      dit(suite, 'la saisie reste prête pour le N° suivant' + T);
      for (const k of ['Numpad1', 'Numpad2', 'NumpadEnter', 'Numpad6', 'NumpadEnter']) await pg.keyboard.press(k);
      const p2 = await attendrePlan(pg, (q) => numsPoses(q).length === 3, 6000);
      dit(p2 && ['5', '12', '6'].every((n) => numsPoses(p2).includes(n)), 'à la suite : N°12 puis N°6, sans souris' + T, p2 && numsPoses(p2).join(','));
      for (const k of ['Numpad5', 'NumpadEnter']) await pg.keyboard.press(k);
      await pg.waitForTimeout(500);
      const p3 = await plan(pg);
      dit(numsPoses(p3).filter((n) => n === '5').length === 1, 'un N° déjà rangé est MONTRÉ, jamais rangé deux fois' + T, numsPoses(p3).join(','));
      await pg.evaluate(() => { const i = document.querySelector('[data-stock-saisie]'); i.focus(); });
      await pg.keyboard.press('Escape');
      for (const k of ['Numpad9', 'Numpad9', 'Numpad9', 'NumpadEnter']) await pg.keyboard.press(k);
      await pg.waitForTimeout(500);
      dit(!numsPoses(await plan(pg)).includes('999') && await vu(pg, '[data-stock-clavier="info"]'), 'un N° hors stock n’est JAMAIS rangé, et c’est dit' + T);
      await pg.keyboard.press('Escape');
      for (const k of ['Numpad7', 'NumpadEnter']) await pg.keyboard.press(k);
      await attendrePlan(pg, (q) => numsPoses(q).includes('7'), 6000);
      await pg.keyboard.press('Escape');
      const p4 = await attendrePlan(pg, (q) => !numsPoses(q).includes('7'), 6000);
      dit(p4 && !numsPoses(p4).includes('7') && numsPoses(p4).length === 3, 'Échap ressort le dernier rangé (et lui seul)' + T, p4 && numsPoses(p4).join(','));
      const fiches = await pg.evaluate(() => JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'));
      dit(Object.values(fiches).map((f) => f.numero).sort().join() === NUMS.slice().sort().join(), 'aucun numéro de fiche n’a changé (E)' + T);
      dit(errs.length === 0, 'aucune erreur de page (E)' + T, errs.slice(0, 2).join(' | '));
      await ctx.close();
    });
  }
  await b.close(); srv.close();
  console.log(ko ? `\n❌ assistant du stock : ${ko} rouge(s)` : '\n✅ assistant du stock : tout est vert');
  process.exit(ko ? 1 : 0);
})();
