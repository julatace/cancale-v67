// ═══════════════════════════════════════════════════════════════════════════
// BANC : POINTS 14 ET 15 DE JULIEN (13 nov.) — LE BÉNÉFICE « SI VENDUE » SUR LA FICHE,
//        LES PAIRES QUI DORMENT RANGÉES PAR CE QU'ELLES RAPPORTENT, UN GESTE CHACUNE
//        npm run build && BANC_PORT=$((17000+RANDOM%1000)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/lot1415.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Le VRAI écran Annonces et la VRAIE fiche « Tout sur le N° », une base INVENTÉE (aucune
// donnée réelle), un faux pont d'extension 5.372 (onglet sur atelier_test) qui RETIENT
// toute commande (rien ne part : on le vérifie). Un compte, atelier_test (111) :
//   800006 Jordan 1 · 200 € · 90 j · N°66 · achat 30 € · 1 favori, 300 vues
//   800001 Nike Cortez · 100 € · 50 j · N°61 · achat 40 € · 2 favoris, 80 vues
//   800004 New Balance 550 · 150 € · 35 j · N°64 · sans achat · vues et favoris PAS lus
//   800002 Puma Suede · 70 € · 60 j · N°62 · sans achat · 3 favoris, 200 vues
//   800003 Asics Gel · 60 € · 40 j · N°63 · sans achat · 0 favori, 10 vues
//   800005 Vans · 40 € · 5 j · N°65 (ne dort pas)
// À LA MAIN :
//   A. Annonces → À relancer · Qui dorment : rangées par ce qui rapporte (bénéfice si vendue :
//      800006 +150 € à 180 €, 800001 +50 € à 90 €), puis sans achat par prix (150, 70, 60) ;
//      UN geste chacune : « Baisser à 180 € », « Baisser à 90 € » (la baisse MESURÉE), « Sur
//      Leboncoin » (vues/favoris pas lus ≠ peu), « Offre aux favoris » (3 lus), « Republier »
//      (peu vue) ; « Prix d'achat ? » sur les trois sans achat ; « … » ouvre le choix complet.
//   B. « Baisser à 90 € » ouvre la feuille « Baisser le prix » sur 800001 SEULE, 100 → 90,
//      sans « Varier » ; RIEN ne part avant SA confirmation.
//   C. « Prix d'achat ? » sur 800002 → la saisie existante → 20 € : la ligne passe à
//      « Baisser à 63 € » (+43 € au plus), et remonte au-dessus des sans-achat.
//   D. La fiche du N°61 (en ligne) : « En ligne à 100 € », « Si vendue +60 € » (au plus),
//      aucun « Bénéfice » inventé. N°62 : achat « — » + « Saisir » → « Combien tu l'avais
//      payée ? » → 25 € ⇒ la fiche relue : achat 25 €, si vendue +45 €.
//   E. Ma journée : le rappel discret « 5 … en ligne depuis 30 j ou plus » (data-n 5).
//   F. Cibles ≥ 44 px, aucun débordement, aucune erreur, aucune commande envoyée.
// Jugé sur des data-* et des nombres. `BANC_CAPTURE=<dossier>` : captures 390 tactile et
// 1512, clair et sombre. `BANC_DIST=<dossier>` : un autre build (preuve §6.1).
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 17415;
const CAPT = process.env.BANC_CAPTURE || '';

const auj = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const sec = (j) => Math.floor((auj - j * 86400e3) / 1000);
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 400 * 86400e3), owner: null }];
const ann = (id, titre, marque, prix, jours, fav, vues) => ({ id, title: titre, brand: marque, size: '42', price: { amount: String(prix), currency_code: 'EUR' }, created_at_ts: sec(jours),
  is_closed: false, is_draft: false, is_hidden: false, promoted: false, ...(fav == null ? {} : { favourite_count: fav }), ...(vues == null ? {} : { view_count: vues }), url: 'https://www.vinted.fr/items/' + id });
const ITEMS = [
  ann(800006, 'Jordan 1 Mid', 'Jordan', 200, 90, 1, 300),
  ann(800001, 'Nike Cortez blanche', 'Nike', 100, 50, 2, 80),
  ann(800004, 'New Balance 550', 'New Balance', 150, 35, null, null),
  ann(800002, 'Puma Suede noire', 'Puma', 70, 60, 3, 200),
  ann(800003, 'Asics Gel Lyte', 'Asics', 60, 40, 0, 10),
  ann(800005, 'Vans Old Skool', 'Vans', 40, 5, 0, 4),
];
const ROWS = [
  { id: 'harvest_111_listings', data: { uid: '111', type: 'listings', nItems: ITEMS.length, capturedAt: iso(auj - 60000), payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(auj - 60000), payload: { my_orders: [] } } },
  { id: 'vinted_listing_dates', data: {} },
  { id: 'lbc_ventes', data: { ventes: {} } },
];
const NUMEROS = {
  800006: { numero: '66', buyPrice: '30', title: 'Jordan 1 Mid', accountId: '111' },
  800001: { numero: '61', buyPrice: '40', title: 'Nike Cortez blanche', accountId: '111' },
  800004: { numero: '64', title: 'New Balance 550', accountId: '111' },
  800002: { numero: '62', title: 'Puma Suede noire', accountId: '111' },
  800003: { numero: '63', title: 'Asics Gel Lyte', accountId: '111' },
  800005: { numero: '65', title: 'Vans Old Skool', accountId: '111' },
};
// « Mes plateformes » : il affiche Vinted, Leboncoin, eBay et Vestiaire (sinon Leboncoin n'est jamais proposé, B6 de l'audit).
const PLATEFORMES = { sites: ['vinted', 'leboncoin', 'ebay', 'vestiaire'], at: iso(auj - 86400e3) };
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>[^>]*$/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

// Le faux pont : `ready`, `etat` (onglet sur 111) ; toute commande est RETENUE et notée.
const PONT = ({ version }) => {
  const post = (m) => window.postMessage(m, '*');
  window.__cmds = [];
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'atelier_test' }, cmds: {} } });
    if (d.__vmr === 'cmd') window.__cmds.push({ cmd: d.cmd, id: d.id });
  });
  post({ __vmr: 'ready', version });
};

let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 220)); } };
const TAILLES = [{ nom: '390', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { nom: '1512', vp: { width: 1512, height: 950 } }]
  .filter((t) => !process.env.BANC_TAILLE || t.nom === process.env.BANC_TAILLE);

async function page(b, T, { sombre = false, version = '5.372.0' } = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, colorScheme: sombre ? 'dark' : 'light', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ n, sombre, PL }) => { try { if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1'); localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); localStorage.setItem('vrm_plateformes_affichees', JSON.stringify(PL)); } catch (_) {} }, { n: NUMEROS, sombre, PL: PLATEFORMES });
  await pg.addInitScript(PONT, { version });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: { vinted_annonce_numeros: NUMEROS, vrm_plateformes_affichees: PLATEFORMES, ...(sombre ? { vinted_dark: true } : {}) } }, sel)]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
const ouvrirQD = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=vinted_annonces`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-vue-relancer]', { timeout: 30000 }).catch(() => {});
  await pg.locator('[data-vue-relancer]').first().click().catch(() => {});
  await pg.waitForSelector('[data-qui-dorment]', { timeout: 15000 }).catch(() => {});
  if (await pg.locator('[data-qd-mode-choix="dort"]').count()) await pg.locator('[data-qd-mode-choix="dort"]').first().click();
  await pg.waitForSelector('[data-qd-ligne]', { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(500);
};
const lireQD = (pg) => pg.evaluate(() => { const s = document.querySelector('[data-qui-dorment]'); if (!s) return null;
  return { lignes: [...s.querySelectorAll('[data-qd-ligne]')].map((e) => { const g = e.querySelector('[data-qd-geste]'); const bf = e.querySelector('[data-qd-benef]');
    return { id: e.getAttribute('data-qd-ligne'), geste: g ? g.getAttribute('data-qd-geste') : null, sugg: g ? g.getAttribute('data-qd-geste-sugg') : null, gTxt: g ? g.textContent : '',
      benef: bf ? bf.getAttribute('data-qd-benef') : null, benefTxt: bf ? bf.innerText.replace(/\s+/g, ' ') : '', saisir: !!e.querySelector('[data-qd-saisir]'), plus: !!e.querySelector('[data-qd-agir]') }; }),
    petits: [...s.querySelectorAll('[data-qd-geste], [data-qd-agir], [data-qd-saisir]')].filter((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && (r.height < 43.5 || r.width < 43.5); }).map((x) => x.textContent.slice(0, 24) + ':' + Math.round(x.getBoundingClientRect().height)),
    deb: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
const lireFiche = (pg) => pg.evaluate(() => { const el = document.querySelector('[data-fiche-paire]'); if (!el) return null;
  const at = (s, a) => { const x = el.querySelector(s); return x ? x.getAttribute(a) : null; };
  return { num: el.getAttribute('data-fiche-paire'), lecture: el.getAttribute('data-fiche-lecture-en-cours'), achat: at('[data-fiche-resume-achat]', 'data-fiche-resume-achat'), affiche: at('[data-fiche-prix-affiche]', 'data-fiche-prix-affiche'),
    si: at('[data-fiche-si-vendue]', 'data-fiche-si-vendue'), siEtat: at('[data-fiche-si-vendue]', 'data-fiche-si-vendue-etat'), benef: at('[data-fiche-resume-benefice]', 'data-fiche-resume-benefice'),
    saisir: !!el.querySelector('[data-fiche-saisir-achat]'), tuiles: (el.querySelector('.vrm-fp-tuiles') || {}).innerText || '',
    petits: [...el.querySelectorAll('.vrm-fp-tuiles button')].filter((x) => x.getBoundingClientRect().height < 43.5).length,
    deb: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
async function ouvrirFiche(pg, n) {
  await pg.evaluate(() => { const b = document.querySelector('[data-fiche-fermer]'); if (b) b.click(); });
  await pg.waitForTimeout(150);
  await pg.evaluate((n) => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: n })), n);
  await pg.waitForSelector('[data-fiche-paire]', { timeout: 8000 });
  await pg.waitForFunction(() => (document.querySelector('[data-fiche-paire]') || { getAttribute: () => '1' }).getAttribute('data-fiche-lecture-en-cours') === '0', null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(300);
  return lireFiche(pg);
}
const capture = async (pg, sel, nom) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.waitForTimeout(250);
  if (sel) { const el = pg.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => {}); await el.screenshot({ path: path.join(CAPT, nom + '.png') }).catch((e) => console.log('   (capture ' + nom + ' : ' + e.message.slice(0, 80) + ')')); }
  else await pg.screenshot({ path: path.join(CAPT, nom + '.png') }).catch(() => {}); };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const T of TAILLES) {
      for (const sombre of CAPT ? [false, true] : [false]) {
        const suf = `${T.nom}${sombre ? '-sombre' : '-clair'}`;
        console.log(`\n══ ${T.nom} px${T.hasTouch ? ' (tactile)' : ''}${sombre ? ' · sombre' : ' · clair'}`);
        await essaie('ABC' + suf, async () => {
          const { ctx, pg, errs } = await page(b, T, { sombre });
          await ouvrirQD(pg);
          let q = await lireQD(pg);
          const ordre = q ? q.lignes.map((x) => x.id).join(',') : '';
          dit(ordre === '800006,800001,800004,800002,800003', 'A1 rangées par ce qui rapporte : +150 €, +50 €, puis sans achat par prix (150, 70, 60) ; la paire de 5 j n’y est pas', ordre);
          const L = Object.fromEntries((q ? q.lignes : []).map((x) => [x.id, x]));
          const g = (id) => (L[id] || {}).geste;
          dit(g('800006') === 'baisser' && L['800006'].sugg === '180' && g('800001') === 'baisser' && L['800001'].sugg === '90' && /Baisser à 90/.test(L['800001'].gTxt),
            'A2 la baisse MESURÉE (−10 %, achat connu) : « Baisser à 180 € », « Baisser à 90 € »', JSON.stringify([L['800006'], L['800001']].map((x) => x && [x.geste, x.sugg, x.gTxt])));
          dit(g('800004') === 'lbc' && g('800002') === 'favoris' && g('800003') === 'republier',
            'A3 un geste chacune : vues/favoris pas lus ⇒ « Sur Leboncoin » ; 3 favoris ⇒ « Offre aux favoris » ; peu vue ⇒ « Republier »', ['800004', '800002', '800003'].map((id) => id + ':' + g(id)).join(' '));
          dit(L['800006'] && L['800006'].benef === '15000' && /au plus \+150/.test(L['800006'].benefTxt) && L['800001'].benef === '5000',
            'A4 le bénéfice si vendue au prix du geste : « au plus +150 € », +50 € (frais pas confirmés)', JSON.stringify([L['800006'], L['800001']].map((x) => x && [x.benef, x.benefTxt])));
          dit(['800004', '800002', '800003'].every((id) => L[id] && L[id].benef === '' && L[id].saisir && !/0\s?€/.test(L[id].benefTxt)), 'A5 sans achat : « Prix d’achat ? » (la porte), jamais « 0 € »', ['800004', '800002', '800003'].map((id) => L[id] && L[id].benefTxt).join(' / '));
          dit(q && q.lignes.every((x) => x.plus), 'A6 « … » garde le choix complet sur chaque ligne');
          dit(q && !q.petits.length, 'F1 chaque geste, « … » et « Prix d’achat ? » font 44 px au moins', q && q.petits.join(' | '));
          dit(q && q.deb <= 0, 'F2 aucun défilement horizontal', q && q.deb);
          await capture(pg, '[data-qui-dorment]', `dorment-${suf}`);
          // « … » : le choix complet existe toujours
          await pg.locator('[data-qd-agir="800001"]').click(); await pg.waitForSelector('[data-qd-menu]', { timeout: 5000 }).catch(() => {});
          const menu = await pg.evaluate(() => [...document.querySelectorAll('[data-qd-choix-geste]')].map((e) => e.getAttribute('data-qd-choix-geste')));
          dit(menu.includes('republier') && menu.includes('lbc'), 'A7 « … » ouvre le choix complet (Republier, Leboncoin…)', menu.join(','));
          await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
          if (await pg.locator('[data-qd-menu]').count()) { await pg.locator('.vrm-qd-fermer').first().click().catch(() => {}); await pg.waitForTimeout(400); }
          // B. « Baisser à 90 € » : la feuille pré-remplie, rien ne part
          await pg.locator('[data-qd-geste-id="800001"]').click();
          await pg.waitForSelector('[data-baisse-serie]', { timeout: 15000 }).catch(() => {});
          await pg.waitForTimeout(400);
          const bp = await pg.evaluate(() => { const s = document.querySelector('[data-baisse-serie]'); if (!s) return null;
            return { lignes: [...s.querySelectorAll('[data-bp-ligne]')].map((e) => [e.getAttribute('data-bp-ligne'), e.getAttribute('data-bp-ancien'), e.getAttribute('data-bp-nouveau'), e.getAttribute('data-bp-coche')]),
              varier: (s.querySelector('[data-bp-varier]') || {}).checked, phase: s.getAttribute('data-bp-phase') }; });
          dit(bp && bp.lignes.length === 1 && bp.lignes[0][0] === '800001' && bp.lignes[0][2] === '90' && bp.varier === false && bp.phase === 'choix',
            'B1 « Baisser à 90 € » : la feuille sur CETTE annonce seule, 100 → 90, sans « Varier », à confirmer', JSON.stringify(bp));
          await capture(pg, null, `baisse-proposee-${suf}`);
          const c1 = await pg.evaluate(() => window.__cmds.filter((c) => c.cmd === 'baisserPrixVinted').length);
          dit(c1 === 0, 'B2 rien n’est parti vers Vinted avant SA confirmation', String(c1));
          await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
          if (await pg.locator('[data-baisse-serie]').count()) { await pg.goBack().catch(() => {}); await pg.waitForTimeout(500); }
          if (await pg.locator('[data-baisse-serie]').count()) await ouvrirQD(pg);
          // C. « Prix d'achat ? » sur 800002 → 20 € ⇒ baisse proposée et nouveau rang
          await pg.locator('[data-qd-saisir="800002"]').click();
          const champ = pg.locator('input[aria-label="Prix d\'achat"]').first();
          await champ.waitFor({ timeout: 8000 });
          await champ.fill('20'); await champ.press('Enter');
          await pg.waitForFunction(() => { const e = document.querySelector('[data-qd-ligne="800002"] [data-qd-benef]'); return e && e.getAttribute('data-qd-benef') !== ''; }, null, { timeout: 10000 }).catch(() => {});
          q = await lireQD(pg);
          const L2 = Object.fromEntries((q ? q.lignes : []).map((x) => [x.id, x]));
          dit(L2['800002'] && L2['800002'].geste === 'baisser' && L2['800002'].sugg === '63' && L2['800002'].benef === '4300',
            'C1 prix d’achat saisi (20 €) ⇒ « Baisser à 63 € », +43 € au plus', JSON.stringify(L2['800002']));
          const ordre2 = q ? q.lignes.map((x) => x.id).join(',') : '';
          dit(ordre2 === '800006,800001,800002,800004,800003', 'C2 elle remonte au-dessus des paires sans achat', ordre2);
          const c2 = await pg.evaluate(() => window.__cmds.filter((c) => /baisser|republier|recreer|favori/i.test(c.cmd || '')).length);
          dit(c2 === 0, 'F3 aucune commande envoyée à l’extension', String(c2));
          dit(!errs.length, 'F4 aucune erreur d’app', errs.join(' | ').slice(0, 200));
          await ctx.close();
        });
        await essaie('D' + suf, async () => {
          const { ctx, pg, errs } = await page(b, T, { sombre });
          await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('[data-job]', { timeout: 30000 }).catch(() => {});
          await pg.waitForTimeout(1500);
          let f = await ouvrirFiche(pg, '61');
          dit(f && f.affiche === '10000' && f.si === '6000' && f.siEtat === 'partiel' && f.benef === '' && /En ligne à/.test(f.tuiles) && /Si vendue/.test(f.tuiles) && !/Bénéfice/.test(f.tuiles),
            'D1 N°61 en ligne : « En ligne à 100 € », « Si vendue +60 € » (au plus), aucun « Bénéfice » inventé', f && JSON.stringify(f));
          await capture(pg, '[data-fiche-paire] .vrm-fp-cadre', `fiche-61-${suf}`);
          f = await ouvrirFiche(pg, '62');
          dit(f && f.achat === '' && f.saisir && f.si === '' && /prix d.achat pas saisi/.test(f.tuiles), 'D2 N°62 sans achat : « — », « Saisir », le manque NOMMÉ', f && JSON.stringify(f));
          dit(f && !f.petits, 'F5 « Saisir » fait 44 px au moins', f && String(f.petits));
          await capture(pg, '[data-fiche-paire] .vrm-fp-cadre', `fiche-62-avant-${suf}`);
          await pg.locator('[data-fiche-saisir-achat]').first().click();
          await pg.waitForSelector('[data-prix-achat-feuille]', { timeout: 8000 }).catch(() => {});
          const feuille = await pg.evaluate(() => { const s = document.querySelector('[data-prix-achat-feuille]'); return s ? { n: s.getAttribute('data-prix-achat-feuille'), num: (s.querySelector('[data-prix-achat-num]') || { getAttribute: () => null }).getAttribute('data-prix-achat-num'), texte: s.innerText.replace(/\s+/g, ' ') } : null; });
          dit(feuille && feuille.n === '1' && feuille.num === '62' && !/vendu/.test(feuille.texte), 'D3 « Saisir » ouvre « Combien tu l’avais payée ? » sur le N°62 (jamais « vendu »)', JSON.stringify(feuille));
          await capture(pg, null, `fiche-62-saisie-${suf}`);
          await pg.locator('[data-prix-achat-feuille] input').first().fill('25');
          await pg.locator('[data-prix-achat-valider]').first().click();
          await pg.waitForFunction(() => { const e = document.querySelector('[data-fiche-paire] [data-fiche-resume-achat]'); return e && e.getAttribute('data-fiche-resume-achat') === '2500'; }, null, { timeout: 10000 }).catch(() => {});
          f = await lireFiche(pg);
          dit(f && f.achat === '2500' && f.si === '4500', 'D4 enregistré ⇒ la fiche relue : achat 25 €, si vendue +45 €', f && JSON.stringify([f.achat, f.si]));
          const ecrit = await pg.evaluate(() => { try { return [JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}')['800002'].buyPrice, (JSON.parse(localStorage.getItem('vinted_buyprice_by_num') || '{}'))['62']]; } catch (_) { return null; } });
          const eu = (v) => Number(String(v == null ? '' : v).replace(',', '.'));
          dit(ecrit && eu(ecrit[0]) === 25 && eu(ecrit[1]) === 25, 'D5 écrit sur LA fiche de l’annonce 800002 et le miroir du N°62 (rien ailleurs)', JSON.stringify(ecrit));
          await capture(pg, '[data-fiche-paire] .vrm-fp-cadre', `fiche-62-apres-${suf}`);
          dit(f && f.deb <= 0, 'F6 la fiche ne déborde pas', f && f.deb);
          // E. Ma journée : le rappel discret
          await pg.evaluate(() => { const b = document.querySelector('[data-fiche-fermer]'); if (b) b.click(); });
          await pg.waitForSelector('[data-job="paires-dorment"]', { timeout: 15000 }).catch(() => {});
          const job = await pg.evaluate(() => { const e = document.querySelector('[data-job="paires-dorment"]'); return e ? e.getAttribute('data-n') : null; });
          dit(job === '5', 'E1 Ma journée : le rappel « 5 en ligne depuis 30 j ou plus »', String(job));
          dit(!errs.length, 'F7 aucune erreur d’app', errs.join(' | ').slice(0, 200));
          await ctx.close();
        });
      }
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\n❌ lot 14-15 : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ lot 14-15 : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
