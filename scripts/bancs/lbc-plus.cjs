// Banc : LEBONCOIN — TROIS OUTILS DE PLUS (11 nov., lot lbc-plus, extension 5.363).
//   1. « Baisser le prix » : la porte dit combien sont proposées (0 favori en 30 j) ;
//      la feuille coche les proposées SEULEMENT, −5 % par défaut ; sans recette apprise
//      ⇒ rien ne part et le geste est dit ; apprise ⇒ UNE commande par annonce, prix
//      d'avant = l'aperçu, prix RELU écrit.
//   2. Remise en main propre : « Organiser la remise » sur une vente à remettre ;
//      jour/heure/lieu ⇒ « Remise · … » sur la vente ; « Remis » ⇒ fiche sortie du
//      stock (vendu en main propre), vente datée.
//   3. Republier : la limite (une fois tous les 30 j) grise une annonce republiée il y
//      a 5 j ; ordre ↑↓ ; espacement ; « à la main » : fiche copiable, photos, « C'est
//      fait » ⇒ registre ; « par l'extension » : le coffre est écrit AVANT la suppression.
//   390 tactile et 1512 ; aucun débordement ; aucune erreur. Données INVENTÉES.
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6342;
const SORTIE = process.env.BANC_SORTIE || os.tmpdir();
const auj = new Date();
const ilYa = (j) => new Date(Date.now() - j * 864e5).toISOString();
const MON = '8442aaaa-0000-4000-8000-000000000001';
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const annonce = (id, titre, prix) => ({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: titre.split(' ')[0], size_title: (/taille (\d+)/.exec(titre) || [])[1] || '', is_closed: false, is_hidden: false, is_draft: false, photo: { url: 'https://img.test/v' + id + '.jpg' }, photos: [{ url: 'https://img.test/v' + id + 'a.jpg' }, { url: 'https://img.test/v' + id + 'b.jpg' }], description: 'Très bon état, portées deux fois. Boîte d’origine.' });
const LISTINGS = { capturedAt: auj.toISOString(), payload: { items: [
  annonce(5002, 'Nike air max 1 Treeline taille 42', 100),
  annonce(5004, 'Salomon XT-6 blanc taille 40', 99),
  annonce(5005, 'Asics gel kayano 14 argent taille 43', 85),
], pagination: { total_entries: 3 } } };
const MAIN = {
  vinted_annonce_numeros: {
    '5002': { numero: '13', title: 'Nike air max 1 Treeline taille 42', mp: { lbc: true } },
    '5004': { numero: '15', title: 'Salomon XT-6 blanc taille 40', mp: { lbc: true } },
    '5005': { numero: '16', title: 'Asics gel kayano 14 argent taille 43', mp: { lbc: true } },
  },
  vrm_lbc_repub_journal: { '15': ilYa(5) },
};
const stats = (fav, j) => ({ favoris: fav, vues: 12, messages: 0, jours: 30, at: ilYa(1) });
const ITEMS = {
  '3290000002': { id: '3290000002', subject: 'Nike air max 1 Treeline T42', price: 100, ref: '13', account: MON, platform: 'leboncoin', status: 'active', seenAt: auj.toISOString(), publieeLe: ilYa(41), stats: stats(0), images: ['https://img.test/l2.jpg'] },
  '3290000005': { id: '3290000005', subject: 'Salomon XT-6 blanc T40', price: 99, ref: '15', account: MON, platform: 'leboncoin', status: 'active', seenAt: auj.toISOString(), publieeLe: ilYa(5), stats: stats(3), images: [] },
  '3290000007': { id: '3290000007', subject: 'Asics gel kayano 14 T43', price: 85, ref: '16', account: MON, platform: 'leboncoin', status: 'active', seenAt: auj.toISOString(), publieeLe: ilYa(60), images: [] },
};
const VENTES = { ventes: {
  L1: { txId: '70010001', itemId: '3290000002', isSeller: true, price: 9500, stepLabel: 'Paiement effectué', deliveryLabel: 'Remise en main propre', title: 'Nike air max 1 Treeline T42', account: MON },
} };
const construire = (o = {}) => [
  { id: 'main', data: Object.assign({}, MAIN, o.main || {}) },
  { id: 'harvest_111_listings', data: LISTINGS },
  { id: 'vinted_item_details', data: Object.fromEntries(['5002', '5004', '5005'].map((id) => [id, { photos: [1, 2, 3].map((k) => `https://images1.vinted.net/t/banc/f800/${id}-${k}.jpeg`), description: 'Très bon état, portées deux fois. Boîte d’origine.', nPhotos: 3 }])) },
  { id: 'vinted_lbc_posted', data: { ids: ['5002', '5004', '5005'], updatedAt: ilYa(3) } },
  { id: 'lbc_listings', data: { items: Object.assign({}, ITEMS, o.items || {}), lectures: { [MON]: { at: ilYa(0.05), total: 3, n: 3 } } } },
  { id: 'lbc_accounts', data: { accounts: { [MON]: { id: MON, name: 'Totomondu', sessionAt: auj.toISOString(), source: 'session:messagerie' } } } },
  { id: 'lbc_ventes', data: o.remise ? VENTES : { ventes: {} } },
  ...(o.appris ? [{ id: 'lbc_prix_recette', data: { appris: true, raison: '', at: ilYa(1) } }] : []),
];
const ECRITS = [];
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT=…)'); process.exit(1); });
srv.listen(PORT);
// Projection PostgREST : `alias:data->champ` / `alias:data->>champ` (§6.3).
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/^"|"$/g, '')];
    out[alias] = v == null ? null : v;
  }
  return out;
};
// Le pont simulé : une extension 5.363 (elle sait supprimer, mettre en pause, changer un prix).
const PONT = ({ mode }) => {
  window.__cmds = [];
  if (mode === 'absente') return;
  const version = mode === 'vieille' ? '5.344.0' : '5.368.0';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {}, lbcPause: true, lbcSupprime: true, lbcPrix: mode !== 'vieille' } });
    if (d.__vmr === 'cmd') {
      window.__cmds.push(JSON.stringify(Object.assign({ t: Date.now() }, Object.fromEntries(Object.entries(d).filter(([k]) => !['__vmr', 'reqId'].includes(k))))));
      const R = (resp, ms = 120) => setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp }), ms);
      if (d.cmd === 'lbcPrix') return R({ accepte: true, etape: 'fait', statut: 200, prixVu: d.prix });
      if (d.cmd === 'lbcRelire') return R({ accepte: true, relu: { fait: true }, annonces: {}, parRef: {} });
      if (d.cmd === 'lbcSupprime') return R({ accepte: true, etape: 'fait', statut: 200, note: true });
      if (d.cmd === 'lbcMarque') return R({ accepte: true });
      if (d.cmd === 'lbcPublier') return R({ accepte: true, etape: 'depot', jobId: 'lbc:' + d.id });
      return R({ accepte: false, code: 'inconnue', raison: 'commande inconnue' });
    }
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};

async function ouvrir(b, vp, pont, o = {}) {
  const rows = construire(o);
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} window.__VRM_BAISSE_PAUSE = 0; });
  if (o.init) await pg.addInitScript(o.init);
  await pg.addInitScript(PONT, pont);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') { try { ECRITS.push({ u, corps: route.request().postData() || '', at: Date.now() }); } catch (_) {} return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: (r.data || {}).capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${o.tab || 'leboncoin'}${o.query || ''}`, { waitUntil: 'domcontentloaded' });
  if (o.tab && o.tab !== 'leboncoin') { await pg.waitForTimeout(2500); return { ctx, pg, errs }; }
  await pg.waitForSelector('[data-lbc-baisse-porte], [data-repub-lbc-porte]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs };
}
const deborde = (pg) => pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  rognes: [...document.querySelectorAll('button,input,a')].filter((e) => { const d = e.closest('details:not([open])'); if (d && !e.closest('summary')) return false;   // contenu d'un repli FERMÉ : pas affiché (Chromium lui garde une géométrie)
    const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0 && r.right > document.documentElement.clientWidth + 1)) return false;
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth) return p.getBoundingClientRect().right > document.documentElement.clientWidth + 1; }
    return true; }).map((e) => { const ch = []; for (let p = e.parentElement, i = 0; p && i < 8; p = p.parentElement, i++) { const at = [...p.attributes].map((x) => x.name).filter((n) => /^data-|role|class/.test(n)).map((n) => n === 'class' ? '.' + String(p.className).split(' ')[0] : n).join(''); if (at) ch.push(at); } const r = e.getBoundingClientRect(); return (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 24) + ` x=${Math.round(r.left)}..${Math.round(r.right)} ` + ch.join(' < '); }) }));
const ls = (pg, cle) => pg.evaluate((k) => { for (let i = 0; i < localStorage.length; i++) { const n = localStorage.key(i); if (n === k || n.endsWith(':' + k) || n.endsWith('_' + k) && false) { try { return JSON.parse(localStorage.getItem(n)); } catch (_) { return localStorage.getItem(n); } } } return null; }, cle);
const cmds = (pg, re) => pg.evaluate((s) => window.__cmds.filter((x) => new RegExp(s).test(x)).map((x) => JSON.parse(x)), re);
const capture = (pg, nom, vp) => pg.screenshot({ path: path.join(SORTIE, `lbc-plus-${nom}-${vp.width}.png`), fullPage: false });

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }].filter((v) => !process.env.BANC_LARGEUR || String(v.width) === process.env.BANC_LARGEUR)) {
      // ── 1. Baisser le prix ────────────────────────────────────────────────
      console.log(`── ${vp.width} px · baisser le prix (recette pas apprise)`);
      let o = await ouvrir(b, vp, { mode: 'ok' });
      await o.pg.waitForSelector('[data-lbc-baisse-porte]', { timeout: 15000 }).catch(() => {});
      const porte = await o.pg.evaluate(() => { const e = document.querySelector('[data-lbc-baisse-porte]'); return e ? { n: e.getAttribute('data-lbc-baisse-porte'), t: e.innerText } : null; });
      dit(porte && porte.n === '1' && /1 annonce sans favori en 30 jours/.test(porte.t) && /1 sans statistiques lues/.test(porte.t), 'la porte : 1 proposée (0 favori en 30 j), 1 sans statistiques — dits', JSON.stringify(porte));
      await o.pg.click('[data-lbc-baisse-ouvrir]').catch(() => {});
      await o.pg.waitForSelector('[data-baisse-serie]', { timeout: 8000 }).catch(() => {});
      await o.pg.waitForTimeout(700);
      const f0 = await o.pg.evaluate(() => ({ lignes: [...document.querySelectorAll('[data-bp-ligne]')].map((e) => e.getAttribute('data-bp-ligne') + ':' + e.getAttribute('data-bp-coche') + ':' + e.getAttribute('data-bp-nouveau')),
        ext: (document.querySelector('[data-bp-ext]') || {}).innerText || '', lancer: (document.querySelector('[data-bp-lancer]') || {}).disabled, propose: (document.querySelector('[data-bp-propose]') || {}).innerText || '' }));
      dit(f0.lignes[0] === '3290000002:1:95' && f0.lignes.filter((x) => /:1:/.test(x)).length === 1, 'la feuille : la proposée en tête, SEULE cochée, −5 % (100 € → 95 €)', JSON.stringify(f0.lignes));
      dit(/0 favori en 41 jours/.test(f0.propose), 'la raison est écrite sur la ligne (« 0 favori en 41 jours »)', f0.propose);
      dit(/Change UN prix toi-même sur leboncoin\.fr/.test(f0.ext) && f0.lancer === true, 'sans recette apprise : le geste est dit, et rien ne peut partir', f0.ext);
      await capture(o.pg, 'baisse-pas-appris', vp);
      const d0 = await deborde(o.pg); dit(d0.rognes.length === 0 && d0.sw <= d0.cw + 1, 'aucun débordement', JSON.stringify(d0));
      await o.ctx.close();
      console.log(`── ${vp.width} px · baisser le prix (recette apprise)`);
      o = await ouvrir(b, vp, { mode: 'ok' }, { appris: true });
      await o.pg.waitForSelector('[data-lbc-baisse-ouvrir]', { timeout: 15000 }).catch(() => {});
      await o.pg.click('[data-lbc-baisse-ouvrir]').catch(() => {});
      await o.pg.waitForSelector('[data-bp-lancer]', { timeout: 8000 }).catch(() => {});
      await o.pg.waitForTimeout(800);
      await o.pg.click('[data-bp-lancer]').catch(() => {});
      await o.pg.waitForSelector('[data-bp-confirmer]', { timeout: 4000 }).catch(() => {});
      const conf = await o.pg.evaluate(() => (document.querySelector('[data-bp-confirmation]') || {}).innerText || '');
      dit(/sur Leboncoin \?/.test(conf) && /onglet Leboncoin/.test(conf), 'la confirmation parle de Leboncoin (pas de Vinted)', conf || await o.pg.evaluate(() => ((document.querySelector('[data-bp-ext]') || {}).innerText || '') + ' | lancer=' + ((document.querySelector('[data-bp-lancer]') || {}).disabled)));
      await o.pg.click('[data-bp-confirmer]').catch(() => {});
      await o.pg.waitForSelector('[data-bp-bilan]', { timeout: 15000 }).catch(() => {});
      await o.pg.waitForTimeout(600);
      const c1 = await cmds(o.pg, 'lbcPrix');
      dit(c1.length === 1 && c1[0].id === '3290000002' && c1[0].prixAvant === 100 && c1[0].prix === 95 && c1[0].confirme === true, 'UNE commande : l’annonce, le prix d’avant (l’aperçu), le nouveau, confirmée', JSON.stringify(c1));
      const vu = await o.pg.evaluate(() => { const e = document.querySelector('[data-bp-ligne="3290000002"]'); return e ? { pv: e.getAttribute('data-bp-prix-vu'), etat: e.getAttribute('data-bp-etat'), t: e.innerText } : null; });
      dit(vu && vu.pv === '95' && vu.etat === 'fait' && /relu sur Leboncoin/.test(vu.t), 'le prix RELU s’écrit (« 95 € relu sur Leboncoin »)', JSON.stringify(vu));
      await capture(o.pg, 'baisse-fini', vp);
      dit(o.errs.length === 0, 'aucune erreur d’app', o.errs.join(' | ').slice(0, 200));
      await o.ctx.close();

      // ── 2. Remise en main propre ─────────────────────────────────────────
      console.log(`── ${vp.width} px · remise en main propre`);
      o = await ouvrir(b, vp, { mode: 'ok' }, { tab: 'ventes', query: '&site=leboncoin', remise: true });
      await o.pg.waitForSelector('[data-lbc-vente="70010001"]', { timeout: 15000 }).catch(() => {});
      await o.pg.click('[data-lbc-vente="70010001"]').catch(() => {});
      await o.pg.waitForSelector('[data-remise-organiser]', { timeout: 8000 }).catch(() => {});
      const avantR = await o.pg.$('[data-remise-organiser]');
      dit(!!avantR, '« Organiser la remise » sur la vente à remettre (ouverte)', await o.pg.evaluate(() => [...document.querySelectorAll('[data-lbc-vente]')].map((e) => e.getAttribute('data-lbc-vente')).join(',') + ' | ' + document.body.innerText.slice(0, 300)));
      await o.pg.click('[data-remise-organiser]').catch(() => {});
      await o.pg.waitForSelector('[data-remise-feuille]', { timeout: 5000 }).catch(() => {});
      await capture(o.pg, 'remise-feuille', vp);
      await o.pg.click('[data-remise-enregistrer]').catch(() => {});
      const e1 = await o.pg.evaluate(() => (document.querySelector('[data-remise-erreur]') || {}).innerText || '');
      dit(/Choisis l’heure/.test(e1), 'sans heure : rien n’est noté, c’est dit', e1);
      const demain = new Date(Date.now() + 864e5); const j = `${demain.getFullYear()}-${String(demain.getMonth() + 1).padStart(2, '0')}-${String(demain.getDate()).padStart(2, '0')}`;
      await o.pg.fill('[data-remise-jour]', j, { timeout: 3000 }).catch(() => {}); await o.pg.fill('[data-remise-heure]', '15:00', { timeout: 3000 }).catch(() => {}); await o.pg.fill('[data-remise-lieu]', 'Gare, sortie nord', { timeout: 3000 }).catch(() => {});
      await o.pg.click('[data-remise-enregistrer]').catch(() => {});
      await o.pg.waitForSelector('[data-remise-quand]', { timeout: 5000 }).catch(() => {});
      const q = await o.pg.evaluate(() => { const e = document.querySelector('[data-remise-quand]'); return e ? { at: e.getAttribute('data-remise-quand'), t: e.innerText } : null; });
      const carte = await ls(o.pg, 'vrm_remises'); const fin = await ls(o.pg, 'vrm_remise_fin');
      dit(q && q.at === `${j}T15:00` && /Gare, sortie nord/.test(q.t) && carte && Object.values(carte).length === 1 && Object.values(carte)[0].tx === '70010001' && typeof fin === 'string' && fin.length > 10, 'la remise est notée (jour, heure, lieu, la vente par sa transaction) et `vrm_remise_fin` posé', JSON.stringify({ q, carte, fin }));
      await capture(o.pg, 'remise-prevue', vp);
      await o.pg.click('[data-remise-remis]').catch(() => {});
      await o.pg.waitForTimeout(500);
      await o.pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Remis' && !x.hasAttribute('data-remise-remis')); if (b) b.click(); });
      // Les écritures du geste partent clé par clé (sauvegarde différée) : on attend la dernière.
      await o.pg.waitForFunction(() => { try { return (JSON.parse(localStorage.getItem('vinted_annonces_vendues') || '[]') || []).includes('5002'); } catch (_) { return false; } }, null, { timeout: 10000 }).catch(() => {});
      const dec = await ls(o.pg, 'vrm_cycle_decisions'); const dates = await ls(o.pg, 'vrm_lbc_dates'); const vend = await ls(o.pg, 'vinted_annonces_vendues');
      dit(dec && dec['5002'] && dec['5002'].choix === 'vendu-main' && dec['5002'].numero === '13' && dec['5002'].montant === 95 && Array.isArray(vend) && vend.includes('5002'), '« Remis » : la fiche du N°13 sort du stock (vendue en main propre, 95 €), N° gardé', JSON.stringify({ dec, vend }));
      dit(dates && /^\d{4}-\d{2}-\d{2}$/.test(dates['70010001'] || ''), '… et la vente est datée pour la compta (`vrm_lbc_dates`)', JSON.stringify(dates));
      await capture(o.pg, 'remise-faite', vp);
      const d2 = await deborde(o.pg); dit(d2.rognes.length === 0 && d2.sw <= d2.cw + 1, 'aucun débordement', JSON.stringify(d2));
      dit(o.errs.length === 0, 'aucune erreur d’app', o.errs.join(' | ').slice(0, 200));
      await o.ctx.close();

      // ── 3. Republier ─────────────────────────────────────────────────────
      console.log(`── ${vp.width} px · republier (à la main)`);
      o = await ouvrir(b, vp, { mode: 'ok' });
      await o.pg.waitForSelector('[data-repub-lbc-ouvrir]', { timeout: 15000 }).catch(() => {});
      await o.pg.click('[data-repub-lbc-ouvrir]').catch(() => {});
      await o.pg.waitForSelector('[data-repub-lbc-ligne]', { timeout: 8000 }).catch(() => {});
      const l0 = await o.pg.evaluate(() => [...document.querySelectorAll('[data-repub-lbc-ligne]')].map((e) => e.getAttribute('data-num') + ':' + e.getAttribute('data-repub-lbc-permis') + ':' + (e.querySelector('[data-repub-lbc-trop-tot]') ? e.querySelector('[data-repub-lbc-trop-tot]').innerText : '')));
      dit(l0.some((x) => /^15:0:Republiée le .* · à nouveau le /.test(x)) && l0.some((x) => /^13:1:/.test(x)), 'la limite : la N°15 republiée il y a 5 jours est grisée, la date de la prochaine dite ; la N°13 libre', JSON.stringify(l0));
      const lim = await o.pg.evaluate(() => (document.querySelector('[data-repub-lbc-limite]') || {}).innerText || '');
      dit(/une fois tous les 30 jours par annonce/.test(lim), 'la limite est dite (30 jours par défaut, réglable)', lim);
      await capture(o.pg, 'repub-choix', vp);
      await o.pg.click('[data-repub-lbc-ligne="3290000002"] input').catch(() => {});
      await o.pg.click('[data-repub-lbc-ligne="3290000007"] input').catch(() => {});
      await o.pg.click('[data-repub-lbc-suivant]').catch(() => {});
      await o.pg.waitForSelector('[data-repub-lbc-ordre]', { timeout: 5000 }).catch(() => {});
      const ord0 = await o.pg.evaluate(() => document.querySelector('[data-repub-lbc-ordre]').getAttribute('data-repub-lbc-ordre'));
      await o.pg.click('[data-repub-lbc-monter="3290000002"]').catch(() => {});
      const ord1 = await o.pg.evaluate(() => document.querySelector('[data-repub-lbc-ordre]').getAttribute('data-repub-lbc-ordre'));
      dit(ord1 === ord0.split(',').reverse().join(',') && ord1.startsWith('3290000002'), 'l’ordre : « monter » met la N°13 en premier', `${ord0} → ${ord1}`);
      const esp = await o.pg.evaluate(() => ({ e: !!document.querySelector('[data-repub-lbc-esp="alea"]'), att: (document.querySelector('[data-repub-lbc-attente]') || {}).innerText || '' }));
      dit(esp.e && /Environ 3 min/.test(esp.att), 'l’espacement : fixe ou au hasard, l’attente totale dite', JSON.stringify(esp));
      await capture(o.pg, 'repub-regler', vp);
      await o.pg.click('[data-repub-lbc-par-choix="main"]').catch(() => {});
      await o.pg.click('[data-repub-lbc-suivant]').catch(() => {});
      await o.pg.waitForSelector('[data-repub-lbc-main]', { timeout: 5000 }).catch(() => {});
      const m0 = await o.pg.evaluate(() => [...document.querySelectorAll('[data-repub-lbc-main]')].map((e) => ({ id: e.getAttribute('data-repub-lbc-main'), copier: e.querySelectorAll('[data-repub-lbc-copier]').length, photos: (e.querySelector('[data-repub-lbc-photos]') || { getAttribute: () => '0' }).getAttribute('data-repub-lbc-photos') })));
      dit(m0.length === 2 && m0[0].id === '3290000002' && m0.every((x) => x.copier === 3), 'à la main : une fiche par annonce, dans SON ordre, titre/description/prix à copier', JSON.stringify(m0));
      await capture(o.pg, 'repub-main', vp);
      await o.pg.click('[data-repub-lbc-fait="3290000007"]').catch(() => {});
      await o.pg.waitForTimeout(400);
      await o.pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Oui, c’est fait'); if (b) b.click(); });
      await o.pg.waitForTimeout(600);
      const jr = await ls(o.pg, 'vrm_lbc_repub_journal');
      const coche = await o.pg.$('[data-repub-lbc-main="3290000007"] [data-repub-lbc-coche]');
      dit(jr && jr['16'] && jr['15'] && !!coche, '« C’est fait » : cochée, et le registre note la N°16 (la limite compte d’aujourd’hui)', JSON.stringify(jr));
      const sansCmd = await cmds(o.pg, 'lbcSupprime|lbcPublier');
      dit(sansCmd.length === 0, 'à la main : aucune commande envoyée à l’extension', JSON.stringify(sansCmd));
      const d3 = await deborde(o.pg); dit(d3.rognes.length === 0 && d3.sw <= d3.cw + 1, 'aucun débordement', JSON.stringify(d3));
      await o.ctx.close();
      console.log(`── ${vp.width} px · republier (par l'extension)`);
      ECRITS.length = 0;
      o = await ouvrir(b, vp, { mode: 'ok' });
      await o.pg.waitForSelector('[data-repub-lbc-ouvrir]', { timeout: 15000 }).catch(() => {});
      await o.pg.click('[data-repub-lbc-ouvrir]').catch(() => {});
      await o.pg.waitForSelector('[data-repub-lbc-ligne]', { timeout: 8000 }).catch(() => {});
      await o.pg.click('[data-repub-lbc-ligne="3290000002"] input').catch(() => {});
      await o.pg.click('[data-repub-lbc-suivant]').catch(() => {});
      await o.pg.waitForSelector('[data-repub-lbc-ordre]', { timeout: 5000 }).catch(() => {});
      await o.pg.click('[data-repub-lbc-suivant]').catch(() => {});
      await o.pg.waitForSelector('[data-repub-lbc-lancer]', { timeout: 5000 }).catch(() => {});
      await o.pg.click('[data-repub-lbc-lancer]').catch(() => {});
      await o.pg.waitForTimeout(500);
      await o.pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Oui, republier'); if (b) b.click(); });
      await o.pg.waitForTimeout(2500);
      const sup = await cmds(o.pg, 'lbcSupprime');
      const coffre = ECRITS.find((e) => /lbc_coffre_3290000002/.test(e.corps || ''));
      dit(!!coffre && sup.length === 1 && coffre.at <= sup[0].t, 'le coffre (sa fiche) est écrit AVANT la suppression', JSON.stringify({ coffre: !!coffre, sup }));
      const cf = coffre ? JSON.parse(coffre.corps) : null; const cd = cf && (Array.isArray(cf) ? cf[0] : cf).data;
      dit(cd && cd.num === '13' && cd.annonce && /VRM-13/.test(cd.annonce.description || '') && Array.isArray(cd.annonce.photos), 'le coffre porte la fiche entière (titre, description avec VRM-13, prix, photos) et le N°', JSON.stringify(cd && { num: cd.num, t: cd.annonce && cd.annonce.title }));
      await capture(o.pg, 'repub-extension', vp);
      dit(o.errs.length === 0, 'aucune erreur d’app', o.errs.join(' | ').slice(0, 200));
      await o.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a levé', String(e && e.stack || e).slice(0, 400)); }
  finally { try { if (b) await b.close(); } catch (_) {} srv.close(); }
  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
