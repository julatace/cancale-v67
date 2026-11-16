// Banc : LE PLAN DU STOCK, LISIBLE AU TÉLÉPHONE (16 nov. 2026, lot stock-mieux)
//
// Julien, sur deux captures iPhone du Stock : « Tu peux faire mieux. » Mesuré à 390 px : un meuble = une grille de
// cases vides en pointillés avec un « + » dans CHACUNE ; les cases pleines portent « V j… / N… » (logo + pseudo coupé +
// N° coupé) ; la tête « Meuble · 0/32 · 4×8 » gris-bleu sur le fond bleu ; ↑ ↓ et le crayon sans mot.
// Récit : docs/passation/2026-11-16-stock-mieux.md. Données INVENTÉES (dépôt public) : un « Garage » 4×8 à moitié vide
// (12 paires, dont N°3 et N°7 vendues, N°9 plus en ligne) et un « Bureau » 8×10 (30 paires, N°1024 compris), un compte
// au long pseudo. Aux quatre variantes (390 tactile / 1512 souris, clair / sombre) il exige :
//   P  au repos, AUCUN « + » dessiné dans les cases vides (texte ou ::before/::after) — au plus un seul « + » par meuble ;
//   N  chaque case pleine VUE écrit son N° EN ENTIER (jamais « N… »), en ≥ 16 px, contraste ≥ 4,5:1 mesuré AUX PIXELS
//      (le texte effacé, le fond photographié sous lui : photo, verre, dégradé compris) ;
//   T  aucun texte coupé dans une case (aucun pseudo tronqué « vanessa… ») ;
//   S  la case d'une vendue rangée est en surbrillance (règle #1197) et rien d'autre ne l'est ;
//   H  la tête du meuble : nom et « 12 / 32 » lisibles (≥ 4,5:1 aux pixels), chaque bouton visible porte un MOT
//      (sauf la poignée de glisser) ; « Comment ça marche ? » ≥ 4,5:1 ;
//   R  chercher « 118 » (dans le Bureau, hors de l'écran) : sa case est en surbrillance ET défilée dans l'écran ;
//   G  44 px au doigt (cases, boutons de la tête), aucune page plus large que l'écran, aucune erreur ;
//   M  rapporté : hauteur de la section « Mes meubles », « + » dessinés, contraste mini, taille du N°.
// MUTATION=num (N° réduit et coupé) ou MUTATION=plus (« + » dans chaque case vide) : CSS injectée ⇒ le banc DOIT rougir.
// BANC_DIST=<dist> (l'arbre d'avant doit être ROUGE), BANC_PORT, CAPTURES=dossier, VARIANTES=390c,390s,1512c,1512s.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7000 + Math.floor(Math.random() * 900);
const CAPT = process.env.CAPTURES || '';
const VARIANTES = (process.env.VARIANTES || '390c,390s,1512c,1512s').split(',');
const MUTATION = process.env.MUTATION || '';
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const AUJ = Date.now();
const fiches = {}, enLigne = [], slots = {};
const ajoute = (num, m, i, { vendue = false, horsLigne = false } = {}) => {
  const id = String(700000 + Number(String(num).replace(/\D/g, '')));
  const photo = `http://localhost:${PORT}/banc-photo/${String(num).replace(/\D/g, '')}.svg`;
  fiches[id] = { numero: String(num), title: `Basket inventée ${num} taille ${36 + (Number(String(num).replace(/\D/g, '')) % 10)}`, accountId: '111', photo };
  if (!horsLigne) enLigne.push({ id: Number(id), title: fiches[id].title, is_closed: false, is_hidden: false, is_draft: false, price: { amount: '65.0' }, photo: { url: photo }, photos: [{ url: photo }] });
  if (m) slots[String(num)] = { m, i };
};
// Garage 4×8 : 12 paires éparses (le vide domine, comme chez lui).
[[1, 0], [2, 1], [3, 2], [4, 5], [5, 6], [6, 9], [7, 12], [8, 13], [9, 18], [10, 21], [11, 26], [12, 30]].forEach(([n, i]) => ajoute(n, 'mA', i, { vendue: n === 3 || n === 7, horsLigne: n === 9 }));
// Bureau 8×10 : 30 paires (N°101…129 et N°1024).
for (let k = 0; k < 29; k++) ajoute(101 + k, 'mB', k * 2 + (k > 14 ? 1 : 0));
ajoute(1024, 'mB', 79);
const MAIN = {
  vinted_annonce_numeros: fiches,
  vinted_used_numeros: Object.values(fiches).map((f) => f.numero),
  vrm_meubles: [{ id: 'mA', name: 'Garage', cols: 4, rows: 8 }, { id: 'mB', name: 'Bureau', cols: 8, rows: 10 }],
  vrm_slots: slots,
  vrm_stock_vendus: { nums: ['3', '7'], at: AUJ },
  vinted_nums_physiques: { nums: Object.values(fiches).map((f) => f.numero), at: AUJ },
};
const LIGNES = { harvest_111_listings: { id: 'harvest_111_listings', data: { capturedAt: new Date(AUJ - 3600000).toISOString(), complet: true, nItems: enLigne.length, payload: { items: enLigne } } } };
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d !== undefined ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const TEINTES = ['#E8EEF5', '#F3E7DA', '#E3EFE6', '#ECECEA', '#F6EED8', '#1E2733'];
const COULS = ['#2E5E9E', '#B4532A', '#3E7D55', '#5B5F66', '#C08A1E', '#F2F2F2'];
const basket = (k) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="${TEINTES[k % 6]}"/><path d="M14 78c0-6 4-10 10-11l22-4 14-16c3-3 8-4 12-1l10 8c4 3 9 5 14 5h4c6 0 10 5 10 11v8H14z" fill="${COULS[k % 6]}"/><rect x="12" y="86" width="98" height="9" rx="4" fill="#FFFFFF" stroke="#C9D2DC"/><path d="M52 62l6-7M60 64l6-7M68 66l6-7" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/></svg>`;
const srv = http.createServer((q, r) => {
  const bp = /^\/banc-photo\/(\d+)\.svg/.exec(q.url);
  if (bp) { r.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'max-age=3600' }); return r.end(basket(Number(bp[1]))); }
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });

const CSS_MUTATION = {
  num: '.vrm-s2d-case * { font-size: 9px !important; } .vrm-s2d-case > span { max-width: 14px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }',
  plus: '.vrm-s2d-case.is-vide::after { content: "+" !important; display: block !important; position: absolute; inset: 0; display: grid !important; place-items: center; font-size: 22px; opacity: .6; color: #445; }',
};

async function rendre(b, tel, sombre) {
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR' });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([{ id: 1, vinted_user_id: '111', login: 'vanessa_shop_paris_vintage', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    if (/id=eq\.main/.test(u)) return j([{ id: 'main', data: MAIN }]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const proj = (row) => (sel && !/^id,data$|^data$/.test(sel) ? projette(row, sel) : row);
    if (/id=like\.harvest_\*_listings/.test(u)) return j(Object.values(LIGNES).map(proj));
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && LIGNES[eq[1]]) return j([proj(LIGNES[eq[1]])]);
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.addInitScript(([m, sombre]) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const k in m) localStorage.setItem(k, JSON.stringify(m[k])); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.removeItem('vrm_meubles_zoom'); } catch (_) {} }, [MAIN, sombre]);
  await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-meuble="mA"] [data-case-num="1"]', { timeout: 60000 }).catch(() => {});
  if (MUTATION && CSS_MUTATION[MUTATION]) await pg.addStyleTag({ content: CSS_MUTATION[MUTATION] });
  await pg.waitForTimeout(1800);
  return { ctx, pg, errs };
}

// Le contraste AUX PIXELS : la couleur du texte (calculée), puis le texte effacé et la zone photographiée — le pire
// fond (10e centile du contraste) fait foi. Un fond photo, verre ou dégradé est donc mesuré tel qu'il est vu.
async function contrastePixels(pg, el) {
  const info = await el.evaluate((e) => {
    const couleur = getComputedStyle(e).color; const r = e.getBoundingClientRect();   // lue AVANT d'effacer le texte (le style calculé est vivant)
    const garde = e.getAttribute('style') || '';
    e.setAttribute('data-banc-style', garde);
    e.style.setProperty('transition', 'none', 'important'); e.style.setProperty('color', 'transparent', 'important'); e.style.setProperty('text-shadow', 'none', 'important'); e.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
    return { couleur, x: r.left, y: r.top, w: r.width, h: r.height };
  });
  if (!info || info.w < 2 || info.h < 2) { await el.evaluate((e) => { e.setAttribute('style', e.getAttribute('data-banc-style') || ''); e.removeAttribute('data-banc-style'); }); return null; }
  await pg.waitForTimeout(60);
  let buf = null;
  try { buf = await pg.screenshot({ clip: { x: Math.max(0, info.x), y: Math.max(0, info.y), width: Math.max(2, info.w), height: Math.max(2, info.h) }, animations: 'disabled' }); } catch (_) {}
  await el.evaluate((e) => { const g = e.getAttribute('data-banc-style'); if (g) e.setAttribute('style', g); else e.removeAttribute('style'); e.removeAttribute('data-banc-style'); });
  if (!buf) return null;
  return pg.evaluate(async ({ b64, couleur }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const m = /rgba?\(([^)]+)\)/.exec(couleur); const p = m ? m[1].split(/[\s,\/]+/).filter(Boolean).map(Number) : [0, 0, 0, 1];
    const a = p.length > 3 ? p[3] : 1;
    const ct = [];
    for (let i = 0; i < d.length; i += 4) {
      const fond = [d[i], d[i + 1], d[i + 2]];
      const t = [0, 1, 2].map((k) => p[k] * a + fond[k] * (1 - a));
      const l1 = L(...t), l2 = L(...fond);
      ct.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
    }
    ct.sort((u, v) => u - v);
    return Math.round(ct[Math.floor(ct.length * 0.1)] * 100) / 100;
  }, { b64: buf.toString('base64'), couleur: info.couleur });
}

(async () => {
  srv.listen(PORT);
  let b;
  try {
    b = await chromium.launch({ executablePath: fs.existsSync(CHROMIUM) ? CHROMIUM : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
    for (const v of VARIANTES) {
      const tel = v.startsWith('390'), sombre = v.endsWith('s'); const t = v;
      const r = await rendre(b, tel, sombre); const { pg } = r;
      const present = await pg.$('[data-meuble="mA"] [data-case-num="1"]');
      dit(!!present, `${t} · le Stock et ses deux meubles sont rendus`);
      if (!present) { if (CAPT) await pg.screenshot({ path: path.join(CAPT, `sm-${v}-absent.png`) }); await r.ctx.close(); continue; }
      await pg.evaluate(() => { const m = document.querySelector('[data-meuble="mA"]'); if (m) m.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
      await pg.waitForTimeout(500);
      if (CAPT) await pg.screenshot({ path: path.join(CAPT, `sm-${v}-1-garage.png`) });
      if (CAPT) { await pg.evaluate(() => { const b = document.querySelector('[data-stock-barre-plan]') || document.querySelector('[data-stock-legende]'); if (b) b.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(CAPT, `sm-${v}-0-barre.png`) });
        await pg.evaluate(() => { const b = document.querySelector('[data-stock-section="plus"]'); if (b) b.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); }); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(CAPT, `sm-${v}-4-plus.png`) });
        await pg.evaluate(() => { const m = document.querySelector('[data-meuble="mA"]'); if (m) m.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); }); await pg.waitForTimeout(300); }

      // ── P : les « + » au repos ──
      const plus = await pg.evaluate(() => {
        const vu = (e) => { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false; const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0; };
        const parMeuble = {};
        for (const sec of document.querySelectorAll('section[data-meuble]')) {
          let n = 0;
          for (const c of sec.querySelectorAll('.vrm-s2d-case')) {
            if (c.hasAttribute('data-case-num') || c.hasAttribute('data-case-notee')) continue;
            for (const e of [c, ...c.querySelectorAll('*')]) {
              if (e !== c && e.children.length === 0 && (e.textContent || '').trim() === '+' && vu(e)) n++;
              for (const ps of ['::before', '::after']) { const k = getComputedStyle(e, ps); if (/^["']\+["']$/.test(k.content) && k.display !== 'none' && Number(k.opacity) >= 0.05) n++; }
            }
          }
          parMeuble[sec.getAttribute('data-meuble')] = n;
        }
        return parMeuble;
      });
      dit(Object.values(plus).every((n) => n <= 1), `${t} · P : au repos, aucun « + » dans les cases vides (au plus un par meuble)`, plus);

      // ── N / T : les N° des cases pleines vues ──
      const cases = await pg.$$('[data-meuble="mA"] .vrm-s2d-case[data-case-num]');
      const nums = []; let cmin = 99, pxMin = 99; const fautes = [];
      for (const c of cases) {
        const vue = await c.evaluate((e) => { const q = e.getBoundingClientRect(); return q.top >= 60 && q.bottom <= innerHeight - 70; });
        if (!vue) continue;
        const d = await c.evaluate((e) => {
          const num = e.getAttribute('data-case-num'); const q = e.getBoundingClientRect();
          const feuilles = [...e.querySelectorAll('*')].filter((x) => x.children.length === 0 && (x.textContent || '').trim());
          const norm = (s) => String(s || '').replace(/\s+/g, '').replace(/^N°/i, '').toUpperCase();
          const el = feuilles.find((x) => norm(x.textContent) === norm(num)) || null;
          const coupes = feuilles.filter((x) => { const cs = getComputedStyle(x); const r = x.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && r.width > 0 && (x.scrollWidth > x.clientWidth + 1 || r.right > q.right + 0.5 || r.left < q.left - 0.5); }).map((x) => x.textContent.trim());
          if (el) el.setAttribute('data-banc-num', '');
          const cs = el ? getComputedStyle(el) : null; const r = el ? el.getBoundingClientRect() : null;
          const visible = !!(el && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5 && r.width > 0);
          return { num, trouve: !!el, visible, px: cs ? parseFloat(cs.fontSize) : 0, entier: !!el && el.scrollWidth <= el.clientWidth + 1 && r.right <= q.right + 0.5 && r.left >= q.left - 0.5, coupes };
        });
        let ct = null;
        if (d.trouve && d.visible) { const h = await c.$('[data-banc-num]'); ct = h ? await contrastePixels(pg, h) : null; }
        await c.evaluate((e) => { const x = e.querySelector('[data-banc-num]'); if (x) x.removeAttribute('data-banc-num'); });
        nums.push(d.num);
        if (ct != null) cmin = Math.min(cmin, ct);
        if (d.px) pxMin = Math.min(pxMin, d.px);
        const court = d.num.replace(/^N°/, '').length <= 4;
        if (!d.trouve || !d.visible || !d.entier || (court && d.px < 16) || ct == null || ct < 4.5) fautes.push({ sorte: 'num', ...d, ct });
        if (d.coupes.length) fautes.push({ sorte: 'coupe', num: d.num, coupes: d.coupes });
      }
      dit(nums.length >= 8 && fautes.filter((f) => f.sorte === 'num').length === 0, `${t} · N : chaque case pleine vue écrit son N° en entier, ≥ 16 px, ≥ 4,5:1 aux pixels (${nums.length} cases ; mini ${pxMin} px, ${cmin}:1)`, fautes.filter((f) => f.sorte === 'num'));
      dit(fautes.filter((f) => f.sorte === 'coupe').length === 0, `${t} · T : aucun texte coupé dans une case (pseudo, N°)`, fautes.filter((f) => f.sorte === 'coupe'));

      // ── S : la surbrillance des vendues ──
      const allumees = await pg.evaluate(() => [...document.querySelectorAll('.vrm-s2d-case.is-vendue')].map((c) => c.getAttribute('data-case-num')).sort().join(','));
      dit(allumees === '3,7', `${t} · S : seules les cases des vendues rangées (N°3, N°7) sont en surbrillance`, allumees);

      // ── H : la tête du meuble ──
      const tete = await pg.$('[data-meuble="mA"] .vrm-s2d-tete');
      const textesTete = tete ? await tete.$$(':scope *') : [];
      let ctTete = 99; const teteFautes = [];
      for (const e of textesTete) {
        const ok = await e.evaluate((x) => { if ([...x.childNodes].every((n) => n.nodeType !== 3 || !n.textContent.trim())) return false; if (x.closest('button')) return false; const cs = getComputedStyle(x); const q = x.getBoundingClientRect(); return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 && q.width > 0; });
        if (!ok) continue;
        const ct = await contrastePixels(pg, e); const tx = await e.evaluate((x) => x.textContent.trim().slice(0, 30));
        if (ct != null) ctTete = Math.min(ctTete, ct);
        if (ct == null || ct < 4.5) teteFautes.push({ tx, ct });
      }
      dit(textesTete.length > 0 && teteFautes.length === 0, `${t} · H : nom et compte du meuble lisibles (mini ${ctTete}:1 aux pixels)`, teteFautes);
      const boutons = await pg.evaluate((mini) => [...document.querySelectorAll('[data-meuble="mA"] .vrm-s2d-tete button')].filter((x) => { const q = x.getBoundingClientRect(); return q.width > 0 && getComputedStyle(x).visibility !== 'hidden'; }).map((x) => { const q = x.getBoundingClientRect(); return { a: [...x.attributes].map((y) => y.name).filter((n) => n.startsWith('data-meuble')).join(' '), mot: (x.innerText || '').trim(), petit: q.width < mini || q.height < mini }; }), tel ? 43.5 : 39.5);
      const sansMot = boutons.filter((x) => !/data-meuble-glisser/.test(x.a) && x.mot.replace(/[^\p{L}]/gu, '').length < 3);
      dit(boutons.length > 0 && sansMot.length === 0, `${t} · H : chaque bouton de la tête porte un mot (sauf la poignée)`, boutons);
      dit(boutons.every((x) => !x.petit), `${t} · G : boutons de la tête ≥ ${tel ? 44 : 40} px`, boutons.filter((x) => x.petit));
      const lien = await pg.$('[data-stock-explication-ouvrir]');
      if (lien) { await lien.scrollIntoViewIfNeeded(); await pg.waitForTimeout(200); const ct = await contrastePixels(pg, lien); dit(ct != null && ct >= 4.5, `${t} · H : « Comment ça marche ? » lisible (${ct}:1)`); }
      else dit(!!(await pg.$('[data-stock-aide]')), `${t} · H : « Comment ça marche ? » rangé sous l'aide « ? »`);

      // ── G : cibles et largeur ──
      const petites = await pg.evaluate((mini) => [...document.querySelectorAll('.vrm-s2d-case')].map((x) => x.getBoundingClientRect()).filter((q) => q.width > 0 && (q.width < mini || q.height < mini)).length, tel ? 43.5 : 39.5);
      dit(petites === 0, `${t} · G : chaque case fait ${tel ? 44 : 40} px au moins`, petites);
      const larg = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(larg.sw <= larg.cw + 1, `${t} · G : aucune page plus large que l'écran`, larg);

      // ── M : les mesures ──
      const mes = await pg.evaluate(() => { const s = document.querySelector('[data-stock-section="meubles"]'); const a = document.querySelector('[data-meuble="mA"]'), bb = document.querySelector('[data-meuble="mB"]'); return { section: s ? Math.round(s.getBoundingClientRect().height) : null, garage: a ? Math.round(a.getBoundingClientRect().height) : null, bureau: bb ? Math.round(bb.getBoundingClientRect().height) : null }; });
      console.log(`    M ${t} : section « Mes meubles » ${mes.section} px (Garage ${mes.garage}, Bureau ${mes.bureau}) · « + » ${JSON.stringify(plus)} · N° mini ${pxMin} px · contraste N° mini ${cmin}:1 · tête mini ${ctTete}:1`);
      if (CAPT) { await pg.evaluate(() => { const m = document.querySelector('[data-meuble="mB"]'); if (m) m.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); }); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(CAPT, `sm-${v}-2-bureau.png`) }); }

      // ── R : chercher « 118 » ──
      await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(200);
      const inp = await pg.$('[data-stock-recherche] input');
      if (inp) {
        await inp.fill('118');
        await pg.waitForSelector('[data-stock-res="118"]', { timeout: 8000 }).catch(() => {});
        if (await pg.$('[data-stock-res="118"]')) await pg.click('[data-stock-res="118"]'); else await inp.press('Enter');
        await pg.waitForTimeout(1200);
        const vise = await pg.evaluate(() => { const c = document.querySelector('[data-case-num="118"]'); if (!c) return null; const q = c.getBoundingClientRect(); const dans = q.top >= 0 && q.bottom <= innerHeight && q.left >= 0 && q.right <= innerWidth; return { allume: c.classList.contains('vrm-case-flash') || c.hasAttribute('data-case-vise'), dans }; });
        dit(!!vise && vise.allume && vise.dans, `${t} · R : chercher « 118 » allume SA case et la fait venir dans l'écran`, vise);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `sm-${v}-3-recherche.png`) });
      } else dit(false, `${t} · R : la recherche du Stock est là`);
      dit(r.errs.length === 0, `${t} · G : aucune erreur d'app`, r.errs.join(' | '));
      await r.ctx.close();
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} échec(s)` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
