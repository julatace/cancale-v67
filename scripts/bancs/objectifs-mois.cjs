// Banc : L'OBJECTIF DU MOIS (11 nov., lot objectifs-mois). Données INVENTÉES (dépôt
// public). 390 px tactile et 1512 px, clair et sombre. Il juge la RÈGLE (data-*) :
//   A. Ma journée, le 3 nov. à 15 h, objectif « 2 000 € vendus » posé en octobre :
//      la barre dit 700 € (vendu du mois, tous sites), fine (≤ 6 px), dans la carte ;
//      « encore 1 300 € en 28 jours » ; en avance de 525 € (attendu 175 €) ;
//   B. le bilan d'octobre (1 700 € sur 2 000 €, objectif d'ALORS) : « il a manqué
//      300 € » ; « OK » ⇒ disparaît, `bilanVu` rangé, rechargé ⇒ ne revient pas ;
//   C. « Modifier » → Objectif : « Viser 1 830 € » (moyenne août-oct. : 1 800,
//      2 000, 1 700) ⇒ UN geste pose 1 830 € ; Bénéfice : aucune publication ⇒
//      « Pas assez d’historique », rien d'inventé ;
//   D. Argent : le détail (même valeur, même rythme, les 3 mois, « visé 2 000 »
//      en octobre seulement) ; aucun débordement, aucune erreur d'app.
// Lancer : npm run build && BANC_PORT=47xx node scripts/bancs/objectifs-mois.cjs  (SHOTS=<dossier>)
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4763);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.VUES ? process.env.VUES.split(',') : null;

const maintenant = new Date(2026, 10, 3, 15, 0, 0);
const le = (m, j, h = 12) => new Date(2026, m, j, h, 0, 0);
const A = '111';
let nPhoto = 0;
const vente = (id, prix, d) => ({ transaction_id: id, conversation_id: 50000 + id, title: 'Paire ' + id, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` } });
const VENTES = [
  vente(9001, 50, le(6, 20)),                                                     // juillet : l'historique commence avant août
  vente(9002, 600, le(7, 3)), vente(9003, 600, le(7, 12)), vente(9004, 600, le(7, 25)),   // août 1 800
  vente(9005, 1000, le(8, 4)), vente(9006, 1000, le(8, 18)),                     // septembre 2 000
  vente(9007, 900, le(9, 8)), vente(9008, 800, le(9, 22)),                       // octobre 1 700
  vente(9009, 400, le(10, 1, 10)), vente(9010, 300, le(10, 2, 18)),              // novembre 700
];
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'boutique_test', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const LIGNES = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${A}_listings`, data: { capturedAt: cap, payload: { items: [], pagination: null } } },
  { id: 'lbc_ventes', data: { ventes: {} } },
];
const OBJECTIF = { v: 1, type: 'ca', valeur: 2000, cache: {}, parMois: { '2026-10': { type: 'ca', valeur: 2000 } } };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#dfe3e8', '#e8e1d8', '#dfe5dd'][k % 3]}"/></svg>`;

// eBay : deux annonces (SKU VRM-80 et VRM-81), 3 questions + un message de transaction.
const EBAY_ANNONCES = [
  { itemId: '2001', sku: 'VRM-80', title: 'Salomon XT-6 blanc', price: '120.00', currency: 'EUR', photo: 'https://i.ebayimg.com/images/g/a/s-l500.jpg', observateurs: 11 },
  { itemId: '2002', sku: 'VRM-81', title: 'Adidas Samba T40', price: '90.00', currency: 'EUR', photo: 'https://i.ebayimg.com/images/g/b/s-l500.jpg', observateurs: 2 },
];
const ih = (h) => new Date(maintenant.getTime() - h * 3600e3).toISOString();
const EBAY_MESSAGES = [
  { id: 'q1', itemId: '2001', titre: 'Salomon XT-6 blanc', sender: 'acheteur_a', subject: 'Taille', body: 'Elle taille grand ?', responses: [], status: 'Unanswered', date: ih(20), type: 'AskSellerQuestion' },
  { id: 'q2', itemId: '2001', titre: 'Salomon XT-6 blanc', sender: 'acheteur_b', subject: 'Envoi', body: 'Envoi demain possible ?', responses: [], status: 'Unanswered', date: ih(3), type: 'AskSellerQuestion' },
  { id: 'q3', itemId: '2002', titre: 'Adidas Samba T40', sender: 'acheteur_c', subject: 'Prix', body: 'Dernier prix ?', responses: ['85 € ferme'], status: 'Answered', date: ih(30), type: 'AskSellerQuestion' },
  { id: 'q4', itemId: '2002', titre: 'Adidas Samba T40', sender: 'acheteur_d', subject: 'Commande', body: 'Bien reçu, merci', responses: [], status: 'Unanswered', date: ih(1), type: 'ContactTransactionPartner' },
];

const contexte = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addInitScript(({ s, o }) => { try { if (sessionStorage.getItem('banc_deja')) return; sessionStorage.setItem('banc_deja', '1');
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
    localStorage.setItem('vrm_objectif_mois', JSON.stringify(o));
  } catch (_) {} }, { s: !!sombre, o: OBJECTIF });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ebayEcrits = [];
  await pg.clock.install({ time: maintenant });
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/i\.ebayimg\.com\//i, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(/\/g\/b\//.test(r.request().url()) ? 1 : 2) }));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net|i\.ebayimg\.com)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/id=in\.\(lbc_listings/.test(u) && /select=id(&|$)/.test(u)) return j([{ id: 'ebay_listings' }]);
    if (/id=eq\.ebay_listings/.test(u)) return j([{ items: EBAY_ANNONCES, capturedAt: cap }]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const dans = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/ebay', async (r) => {
    const body = r.request().method() === 'POST' ? (r.request().postDataJSON() || {}) : {};
    const a = body.action;
    if (!['messages', 'message', 'status', 'agent'].includes(a)) ebayEcrits.push(body);
    let j = { ok: true, connected: true, ready: true };
    if (a === 'status') j = { ok: true, connected: true, comptes: [{ cle: '', ref: 'principal', principal: true, pseudo: 'Compte de banc', relie: true }] };
    if (a === 'messages') j = { ok: true, messages: EBAY_MESSAGES, page: 1, totalPages: 1 };
    if (a === 'repondre') j = { ok: true, avertissements: [] };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
  });
  await pg.route('**/api/**', (r) => (/\/api\/ebay/.test(r.request().url()) ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' })));
  return { ctx, pg, errs, ebayEcrits };
};
const aller = async (pg, url, attend) => {
  await pg.goto(`http://localhost:${PORT}/?${url}`, { waitUntil: 'domcontentloaded' });
  await pg.locator(attend).first().waitFor({ timeout: 30000 });
  await pg.waitForTimeout(2000);
};
const lireBarre = (pg, page) => pg.evaluate((page) => {
  const c = document.querySelector(`[data-carte-stats="${page}"]`); if (!c) return 'carte-absente';
  const o = c.querySelector('[data-objectif]'); if (!o) return null;
  const boite = (e) => { let x = e; while (x && x.getBoundingClientRect().width === 0) x = x.parentElement; return x; };
  const r = o.getBoundingClientRect(), p = o.querySelector('.vrm-fu-objectif-piste').getBoundingClientRect(), cr = boite(c).getBoundingClientRect();
  const g = (k) => o.getAttribute('data-objectif' + k);
  const b = c.querySelector('[data-objectif-bilan]');
  return { type: g(''), cible: g('-cible'), valeur: g('-valeur'), pct: g('-pct'), partiel: g('-partiel'), reste: g('-reste'), jours: g('-jours'), rythme: g('-rythme'), ecart: g('-ecart'), h: Math.round(p.height), dedans: r.left >= cr.left - 0.5 && r.right <= cr.right + 0.5, rr: [Math.round(r.left), Math.round(r.right), Math.round(cr.left), Math.round(cr.right), boite(c).className],
    bas: (o.querySelector('.vrm-fu-objectif-bas') || {}).scrollWidth - (o.querySelector('.vrm-fu-objectif-bas') || {}).clientWidth,
    bilan: b ? { ym: b.getAttribute('data-objectif-bilan'), atteint: b.getAttribute('data-objectif-bilan-atteint'), ecart: b.getAttribute('data-objectif-bilan-ecart') } : null, txt: o.innerText.replace(/\n/g, ' · ') };
}, page);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const range = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_objectif_mois')); } catch (_) { return null; } });

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      if (VUES && !VUES.includes(nom)) continue;
      console.log(`\n══ ${nom}`);
      const { ctx, pg, errs } = await contexte(b, vp, sombre);
      const shot = async (sel, f) => { if (!SHOTS) return; const l = pg.locator(sel).first(); if (await l.count()) { await l.scrollIntoViewIfNeeded().catch(() => {}); await l.screenshot({ path: path.join(SHOTS, `${f}-${nom}.png`) }).catch(() => {}); } };

      await essaie('A. barre', async () => {
        console.log('── A. Ma journée : la barre, le reste, le rythme');
        await aller(pg, 'tab=journee', '[data-carte-stats="journee"] [data-objectif]');
        const o = await lireBarre(pg, 'journee');
        dit(o && o.type === 'ca' && o.cible === '200000' && o.valeur === '70000' && o.pct === '35' && !o.partiel, '2 000 € visés : 700 € vendus ce mois (tous sites) ⇒ 35 %', JSON.stringify(o));
        dit(o && o.h <= 6 && o.dedans && o.bas <= 0, 'une barre FINE, dans la carte, rien de coupé', JSON.stringify(o && { h: o.h, d: o.dedans, bas: o.bas, rr: o.rr }));
        dit(o && o.reste === '130000' && o.jours === '28', 'encore 1 300 € en 28 jours', JSON.stringify(o && { r: o.reste, j: o.jours }));
        dit(o && o.rythme === 'avance' && o.ecart === '52500', 'en avance de 525 € sur le rythme (175 € attendus le 3 à 15 h)', JSON.stringify(o && { ry: o.rythme, e: o.ecart }));
        dit(o && /2\s000\s€ vendus ce mois/.test(o.txt) && /En avance de 525\s€/.test(o.txt), 'la phrase dit l’objectif et le rythme', o && o.txt);
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `journee-objectif-${nom}.png`) });
      });

      await essaie('B. bilan', async () => {
        console.log('── B. Le bilan d’octobre, une fois');
        let o = await lireBarre(pg, 'journee');
        dit(o && o.bilan && o.bilan.ym === '2026-10' && o.bilan.atteint === '0' && o.bilan.ecart === '30000', 'octobre : 1 700 € sur 2 000 € ⇒ il a manqué 300 €', JSON.stringify(o && o.bilan));
        await pg.locator('[data-carte-stats="journee"] [data-objectif-bilan-vu]').first().click();
        await pg.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('vrm_objectif_mois')).bilanVu === '2026-10'; } catch (_) { return false; } }, null, { timeout: 8000 }).catch(() => {});
        o = await lireBarre(pg, 'journee');
        const r = await range(pg);
        dit(o && !o.bilan && r && r.bilanVu === '2026-10' && r.valeur === 2000 && r.parMois && r.parMois['2026-10'], '« OK » ⇒ le bilan part, `bilanVu` rangé, rien d’autre ne change', JSON.stringify({ r, bilan: o && o.bilan }));
        await aller(pg, 'tab=journee', '[data-carte-stats="journee"] [data-objectif]');
        o = await lireBarre(pg, 'journee');
        dit(o && !o.bilan, 'rechargé : le bilan ne revient pas');
      });

      await essaie('C. proposition', async () => {
        console.log('── C. « Viser … » : ses 3 derniers mois');
        await pg.locator('[data-carte-stats="journee"] [data-objectif-ouvrir]').first().click();
        await pg.locator('[data-carte-objectif-type="ca"]').first().waitFor({ timeout: 8000 });
        const p = await pg.evaluate(() => { const e = document.querySelector('[data-carte-feuille] [data-objectif-proposition]'); return e ? { v: e.getAttribute('data-objectif-proposition'), m: e.getAttribute('data-objectif-moyenne'), t: e.innerText.replace(/\n/g, ' · ') } : null; });
        dit(p && p.v === '183000' && p.m === '183333', 'moyenne août-oct. 1 833 € ⇒ « Viser 1 830 € »', JSON.stringify(p));
        const petits = await pg.evaluate(() => [...document.querySelectorAll('[data-carte-feuille] .vrm-carte-objectif button, [data-carte-feuille] .vrm-carte-objectif input')].filter((x) => x.getBoundingClientRect().height > 0 && x.getBoundingClientRect().height < 43.5).map((x) => x.innerText || x.tagName));
        dit(!petits.length, 'chaque geste : 44 px au doigt', petits.join(' | '));
        if (SHOTS) { const l = pg.locator("[data-carte-feuille] .vrm-carte-objectif").first(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.screenshot({ path: path.join(SHOTS, `feuille-proposition-${nom}.png`) }).catch(() => {}); }
        await pg.locator('[data-carte-objectif-type="benefice"]').first().click();
        const pb = await pg.evaluate(() => { const e = document.querySelector('[data-carte-feuille] [data-objectif-proposition]'); return e ? { v: e.getAttribute('data-objectif-proposition'), t: e.innerText } : null; });
        dit(pb && pb.v === '' && /Pas assez d’historique/.test(pb.t), 'bénéfice sans publication des prix ⇒ aucune proposition inventée', JSON.stringify(pb));
        await pg.locator('[data-carte-objectif-type="ca"]').first().click();
        await pg.locator('[data-carte-feuille] [data-objectif-viser]').first().click();
        await pg.waitForTimeout(300);
        await pg.locator('[data-carte-feuille] [data-feuille-croix]').first().click().catch(() => {});
        await pg.waitForTimeout(400);
        const o = await lireBarre(pg, 'journee');
        const r = await range(pg);
        dit(o && o.cible === '183000' && r && r.parMois['2026-11'] && r.parMois['2026-11'].valeur === 1830 && r.parMois['2026-10'].valeur === 2000, 'UN geste pose 1 830 € ; octobre garde ses 2 000 €', JSON.stringify(r && r.parMois));
      });

      await essaie('D. Argent', async () => {
        console.log('── D. Argent : le détail');
        await aller(pg, 'tab=dashboard', '[data-objectif-bloc]');
        await pg.locator('[data-objectif-bloc]').first().scrollIntoViewIfNeeded();
        const d = await pg.evaluate(() => { const e = document.querySelector('[data-objectif-bloc]'); const v = e.querySelector('[data-objectif-valeur]');
          return { t: e.getAttribute('data-objectif-bloc'), v: v && v.getAttribute('data-objectif-valeur'), p: v && v.getAttribute('data-objectif-pct'), ry: v && v.getAttribute('data-objectif-rythme'),
            passes: [...e.querySelectorAll('[data-objectif-passe]')].map((x) => [x.getAttribute('data-objectif-passe'), x.getAttribute('data-objectif-passe-valeur'), x.getAttribute('data-objectif-passe-atteint') || '', x.innerText.replace(/\n/g, ' ')]) }; });
        dit(d.t === 'ca' && d.v === '70000' && d.p === '38' && d.ry === 'avance', 'le MÊME objectif (1 830 €), la MÊME valeur que la carte, le rythme', JSON.stringify(d));
        dit(d.passes.map((x) => x[0] + '=' + x[1]).join(',') === '2026-08=180000,2026-09=200000,2026-10=170000', 'ses 3 derniers mois par la même règle', JSON.stringify(d.passes));
        dit(/visé 2\s000/.test(d.passes[2] && d.passes[2][3]) && /sans objectif/.test(d.passes[0] && d.passes[0][3]), 'octobre : « visé 2 000 € » ; août : aucun objectif supposé', JSON.stringify(d.passes));
        await shot('[data-objectif-bloc]', 'argent-objectif');
        dit(await deborde(pg) <= 0, 'Argent : aucun débordement', String(await deborde(pg)));
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} objectifs-mois : ${ko} rouge(s), ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
