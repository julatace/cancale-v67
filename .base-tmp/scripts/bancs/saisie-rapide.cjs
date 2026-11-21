// BANC : SAISIE RAPIDE (11 nov.) — node scripts/bancs/saisie-rapide.cjs après le build (BANC_PORT=…).
// Données INVENTÉES. 390 tactile et 1512, clair et sombre : la carte « Vendu 80 € · N°130 » de Ma journée
// (vente PROUVÉE par sa transaction, sans prix d'achat), le serveur prévenu une fois, la feuille à UN champ
// qui écrit le prix sur la fiche VENDUE ; « Vendu ailleurs » sur la fiche N°124 (date du jour, sortie du
// stock, « Annuler ») ; « vendues en octobre » à la voix ⇒ Ventes sur octobre ; sans reconnaissance, aucun micro.
// Captures : $TMPDIR/vrm-bancs/saisie-rapide/*.png (À REGARDER).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 12417;
const SHOTS = path.join(os.tmpdir(), 'vrm-bancs', 'saisie-rapide');
fs.mkdirSync(SHOTS, { recursive: true });

const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const T = 'Nike Dunk Low Panda taille 42';
const NUMEROS = {};
for (let i = 0; i < 50; i++) NUMEROS['p' + (201 + i)] = { numero: String(201 + i), title: T, price: '80', accountId: '111' };
NUMEROS['9124'] = { numero: '124', title: 'Asics Gel-Kayano 14 argent', price: '90', accountId: '111' };
NUMEROS.b125 = { numero: 'B125', title: 'Adidas Samba OG blanche', price: '70', accountId: '111' };
NUMEROS.n125 = { numero: '125', title: 'Puma Speedcat rouge', price: '75', accountId: '111' };
NUMEROS.n7 = { numero: '7', title: 'Salomon XT-6 noire', price: '60', accountId: '111' };
NUMEROS.n007 = { numero: '007', title: 'Salomon XT-6 grise', price: '60', accountId: '111' };
const ITEMS = [{ id: 9124, title: 'Asics Gel-Kayano 14 argent', brand_title: 'Asics', price: { amount: '90.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, size_title: '42', status: 'Très bon état', view_count: 3, favourite_count: 0, created_at_ts: MAINTENANT - 3 * 86400000, nPhotos: 2 }];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: NUMEROS, vinted_dark: false } },
  { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: ITEMS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), nItems: 0, payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: ilYaH(0.2), nItems: 0, payload: { my_orders: [] } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (!c && d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 300)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
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
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
const motif = (p) => new RegExp('^' + p.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');

// La fausse reconnaissance, pilotée par le banc.
const FAUSSE = () => {
  const V = window.__voix = { vues: [], derniere: null };
  class FausseSR {
    constructor() { V.vues.push(this); V.derniere = this; }
    start() { this.demarree = true; }
    stop() { setTimeout(() => this.onend && this.onend(), 0); }
    abort() { this.onend && this.onend(); }
  }
  V.dire = (tr) => { const r = V.derniere; r && r.onresult && r.onresult({ results: tr.map(([t, f]) => Object.assign([{ transcript: t }], { isFinal: f })) }); };
  V.fin = () => { const r = V.derniere; r && r.onend && r.onend(); };
  V.erreur = (c) => { const r = V.derniere; r && r.onerror && r.onerror({ error: c }); r && r.onend && r.onend(); };
  window.webkitSpeechRecognition = FausseSR;
  window.SpeechRecognition = FausseSR;
};

async function preparer(b, vp, { sombre = false, voix = true, onglet = 'journee' } = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ s }) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (s) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, { s: sombre });
  if (voix) await pg.addInitScript(FAUSSE);
  else await pg.addInitScript(() => { try { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = motif(lk[1]); let l = ROWS.filter((r) => re.test(r.id)); const rg = req.headers()['range']; if (rg) { const m = /(\d+)-(\d+)/.exec(rg); if (m) l = l.slice(+m[1], +m[2] + 1); } return j(l.map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => { try { const c = r.request().postData(); if (c) POSTS.push(JSON.parse(c)); } catch (_) {} return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"ok":true}' }); });
  await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2200);
  return { ctx, pg, errs };
}
const attendre = (pg, f, arg, ms = 6000) => pg.waitForFunction(f, arg, { timeout: ms }).then(() => true).catch(() => false);
const pret = async (pg, tel) => {
  const sel = tel ? 'button[data-recherche-loupe]' : '[data-barre-recherche]';
  for (let i = 0; i < 80; i++) { const ok = await pg.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); if (!r.width) return false; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(t && (e === t || e.contains(t))); }, sel); if (ok) return true; await pg.waitForTimeout(250); }
  return false;
};
const ouvrirLoupe = async (pg, tel) => {
  await pret(pg, tel);
  if (tel) await pg.locator('button[data-recherche-loupe]').first().tap();
  else { await pg.locator('body').click({ position: { x: 5, y: 400 } }).catch(() => {}); await pg.keyboard.press('ControlOrMeta+k'); }
  await attendre(pg, () => { const p = document.querySelector('[data-recherche-panneau]'); return p && p.getAttribute('data-recherche-pret') === '1'; });
};
const micLoupe = (tel) => tel ? '.vrm-hdr-recherche [data-mic-dictee]' : '[data-barre-recherche] [data-mic-dictee]';
const champ = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-recherche-champ]'); return e ? e.value : null; });
const fermerFiche = async (pg) => { await pg.keyboard.press('Escape'); await attendre(pg, () => !document.querySelector('[data-fiche-paire]'), null, 3000); };
const debord = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ── Saisie rapide : les données (inventées) et les scénarios ─────────────────
NUMEROS['9500'] = { numero: '130', title: 'New Balance 550 blanche', price: '80', accountId: '111' };
ROWS[2].data.payload.my_orders = [{ transaction_id: 7001, title: 'New Balance 550 blanche', price: { amount: '80.0', currency_code: 'EUR' }, date: ilYaH(2), status: 'Bordereau envoyé', transaction_user_status: 'needs_action', _acc: { vinted_user_id: '111' } }];
ROWS[2].data.nItems = 1;
ROWS.push({ id: 'harvest_111_txn_7001', data: { capturedAt: ilYaH(1), payload: { transaction: { id: 7001, item_id: 9500, status: 300, status_title: 'Bordereau envoyé' } } } });
const POSTS = [];

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false], [{ width: 1512, height: 950 }, true]]) {
      const tel = vp.width < 600; const TT = `[${vp.width}${sombre ? ' sombre' : ''}]`; const suf = `${vp.width}${sombre ? '-sombre' : ''}`;
      console.log(`── ${vp.width} px${sombre ? ' · sombre' : ' · clair'}`);
      POSTS.length = 0;
      const { ctx, pg, errs } = await preparer(b, vp, { sombre });
      await essaie('carte Ma journée', async () => {
        await attendre(pg, () => !document.getElementById('vrm-demarrage'), null, 60000);   // l'écran de démarrage parti
        const vu = await attendre(pg, () => !!document.querySelector('[data-job="prix-achat-vente"]'), null, 45000);
        const txt = await pg.evaluate(() => { const e = document.querySelector('[data-job="prix-achat-vente"]'); return e ? e.innerText : ''; });
        dit(vu && /N°130/.test(txt) && /80/.test(txt), `${TT} Ma journée : « Vendu 80 € · N°130 » (vente PROUVÉE sans prix d’achat)`, txt);
        const nuit = await pg.evaluate(() => { const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).find((x) => x.type === 'hour').value); return h >= 22 || h < 8; });
        const p = POSTS.filter((x) => x && x.action === 'prixachat');
        if (nuit) dit(p.length === 0, `${TT} la nuit à Paris : rien n’est demandé au serveur`, JSON.stringify(p));
        else dit(p.length === 1 && p[0].ventes.length === 1 && p[0].ventes[0].tx === '7001' && p[0].ventes[0].num === '130', `${TT} le serveur est prévenu UNE fois, de CETTE vente (tx 7001, N°130)`, JSON.stringify(p));
        const el = await pg.$('[data-job="prix-achat-vente"]'); if (el) await el.scrollIntoViewIfNeeded();
        await pg.screenshot({ path: path.join(SHOTS, `journee-${suf}.png`) });
      });
      await essaie('feuille prix', async () => {
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:prix-achat-ouvrir', { detail: ['7001'] })));
        const ok = await attendre(pg, () => !!document.querySelector('[data-prix-achat-tx="7001"] input'));
        const champs = await pg.evaluate(() => document.querySelectorAll('[data-prix-achat-feuille] input').length);
        dit(ok && champs === 1, `${TT} la feuille : UN champ prix, rien d’autre`, String(champs));
        const h = await pg.evaluate(() => { const i = document.querySelector('[data-prix-achat-tx="7001"] input'); const r = i.closest('label').getBoundingClientRect(); return r.height; });
        dit(h >= 44, `${TT} cible au doigt ≥ 44 px`, String(h));
        await pg.screenshot({ path: path.join(SHOTS, `feuille-${suf}.png`) });
        await pg.locator('[data-prix-achat-tx="7001"] input').fill('25');
        await pg.locator('[data-prix-achat-valider]').click();
        const ecrit = await attendre(pg, () => { try { const f = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); return f['9500'] && parseFloat(String(f['9500'].buyPrice).replace(',', '.')) === 25; } catch (_) { return false; } });
        dit(ecrit, `${TT} « Enregistrer » ⇒ 25 € sur la fiche de l’annonce VENDUE (identité 9500)`);
        const parti = await attendre(pg, () => !document.querySelector('[data-job="prix-achat-vente"]'), null, 8000);
        dit(parti, `${TT} la carte de Ma journée s’en va`);
        await pg.screenshot({ path: path.join(SHOTS, `apres-prix-${suf}.png`) });
      });
      await essaie('vendu ailleurs', async () => {
        await ouvrirLoupe(pg, tel);
        await pg.locator(micLoupe(tel)).first().click();
        await pg.evaluate(() => { window.__voix.dire([['cent vingt-quatre', true]]); window.__voix.fin(); });
        const f = await attendre(pg, () => !!document.querySelector('[data-vendu-ailleurs-ouvrir]'), null, 10000);
        dit(f, `${TT} fiche N°124 (en stock) : « Vendu ailleurs »`);
        await pg.locator('[data-vendu-ailleurs-ouvrir]').scrollIntoViewIfNeeded();
        await pg.locator('[data-vendu-ailleurs-ouvrir]').click();
        await pg.locator('[data-vendu-ailleurs-prix]').fill('45');
        const date = await pg.evaluate(() => document.querySelector('[data-vendu-ailleurs-date]').value);
        const auj = await pg.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
        dit(date === auj, `${TT} la date : aujourd’hui par défaut`, date);
        await pg.screenshot({ path: path.join(SHOTS, `vendu-ailleurs-${suf}.png`) });
        await pg.locator('[data-vendu-ailleurs-valider]').click();
        const ok = await attendre(pg, () => { try { const d = JSON.parse(localStorage.getItem('vrm_cycle_decisions') || '{}'); const v = JSON.parse(localStorage.getItem('vinted_annonces_vendues') || '[]'); return d['9124'] && d['9124'].choix === 'vendu-main' && d['9124'].montant === 45 && v.includes('9124'); } catch (_) { return false; } });
        dit(ok, `${TT} « Valider » ⇒ vendue en main propre 45 €, sortie du stock (identité 9124)`);
        const fait = await attendre(pg, () => !!document.querySelector('[data-vendu-ailleurs-fait]'));
        const pil = await pg.evaluate(() => /Annuler/.test(document.body.innerText));
        dit(fait && pil, `${TT} la fiche dit « Vendu ailleurs · 45 € » et « Annuler » est offert`);
        dit((await debord(pg)) <= 1, `${TT} aucun débordement`);
        await pg.screenshot({ path: path.join(SHOTS, `vendu-fait-${suf}.png`) });
        await fermerFiche(pg);
      });
      await essaie('voix mois', async () => {
        await ouvrirLoupe(pg, tel);
        await pg.locator(micLoupe(tel)).first().click();
        await pg.evaluate(() => { window.__voix.dire([['vendues en octobre', true]]); window.__voix.fin(); });
        const ok = await attendre(pg, () => [...document.querySelectorAll('[data-periode-libelle]')].some((e) => /Octobre/.test(e.textContent)), null, 10000);
        const lib = await pg.evaluate(() => [...document.querySelectorAll('[data-periode-libelle]')].map((e) => e.textContent).join(' | '));
        dit(ok, `${TT} « vendues en octobre » ⇒ Ventes, période octobre`, lib);
        await pg.screenshot({ path: path.join(SHOTS, `octobre-${suf}.png`) });
      });
      dit(!errs.length, `${TT} aucune erreur de page`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // Sans reconnaissance : aucun micro.
    const { ctx, pg } = await preparer(b, { width: 390, height: 844 }, { voix: false });
    await ouvrirLoupe(pg, true);
    dit(!(await pg.$('[data-mic-dictee]')), '[390 sans voix] aucun micro (Firefox, certains iOS)');
    await ctx.close();
  } catch (e) { dit(false, 'le banc a pu tourner', String(e && e.stack || e).slice(0, 400)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} contrôle(s) en échec — captures : ${SHOTS}` : `\nTout est vert — captures (À REGARDER) : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
