// Banc : LOT U (10 nov.) — ANNONCES « À COMPLÉTER » et L'AVIS SUR CHAQUE VENTE.
//
// Rend les VRAIS écrans Annonces et Ventes sur des données INVENTÉES (le dépôt est
// public), en 390 px tactile et 1512 px, clair et sombre. Jugé sur des data-* et des
// nombres rendus, jamais un libellé.
//   Annonces → vue « À compléter » (src/annoncesACompleter.js)
//   1. 901 complète ⇒ absente ; 902 (2 photos) ⇒ photos ; 903 (marque lue vide) ⇒ marque ;
//      904 (pas de prix d'achat) ⇒ achat, SANS lien Vinted ; 905 (photos jamais lues,
//      le reste complet) ⇒ absente, « pas su » dit (photos sur 1) ;
//   2. 50 annonces au MÊME titre (906…955) : seule 930 (1 photo) est listée ;
//   3. « Modifier ↗ » = /items/{id}/edit ; « Prix d'achat » ouvre la saisie (rien écrit sans OK) ;
//      chaque geste fait au moins 44 px ;
//   Ventes → récapitulatif (src/avisVente.js)
//   4. avis à la forme MESURÉE ({ id, rating, feedback }) ⇒ ligne « pas relié »
//      (data-avis-vente="nonRelie"), aucune note affichée ;
//   5. avis portant `transaction_id` (forme future) ⇒ 7101 relié, note 2 ; 7102 « aucun » ;
//   6. aucun avis capté ⇒ aucune ligne ;
//   7. aucun débordement horizontal, aucune erreur d'app.
// Lancer : npm run build && BANC_PORT=$((40000+RANDOM%20000)) node scripts/bancs/annonces-avis.cjs
// Captures : $BANC_CAPTURES (défaut : dossier temporaire)/annonces-avis-{390,1512}-{clair,sombre}-{acompleter,vente}.png
// `BANC_DIST=<dossier>` : un autre build (preuve sur le code d'avant).
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4467;
const CAP = process.env.BANC_CAPTURES || os.tmpdir();
const SHOTS_C10 = true;

const maintenant = new Date(2026, 10, 10, 15, 30, 0);
const iso = (h) => new Date(maintenant.getTime() - h * 3600e3).toISOString();
const A = '111';
const cap = maintenant.toISOString();
const vente = (id, titre, prix, h) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(h), photo: { url: `https://images1.vinted.net/t/b1/f800/${id}.jpeg?s=x` } });
const VENTES = [vente(7101, 'Nike Air Max 90 blanche 42', 120, 30), vente(7102, 'Adidas Samba OG noir 40', 90, 50)];
const annonce = (id, titre, o = {}) => ({ id, url: 'https://www.vinted.fr/items/' + id, title: titre, brand: 'Nike', size: '42', status: 'Très bon état', nPhotos: 6, price: { amount: '80.0', currency_code: 'EUR' },
  photo: { url: `https://images1.vinted.net/t/b${id % 4}/f800/${id}.jpeg` }, created_at_ts: Math.floor((maintenant.getTime() - (id % 30 + 1) * 86400e3) / 1000), is_closed: false, is_draft: false, is_hidden: false, favourite_count: 1, view_count: 12, ...o });
const ITEMS = [annonce(901, 'Nike Dunk Low panda 42'), annonce(902, 'Nike Air Force 1 42', { nPhotos: 2 }), annonce(903, 'Basket blanche 42', { brand: '' }),
  annonce(904, 'Nike Cortez blanche 42'), annonce(905, 'Nike Blazer Mid 42', { nPhotos: undefined })];
for (let k = 0; k < 50; k++) ITEMS.push(annonce(906 + k, 'Nike Air Max 90 42', k === 24 ? { nPhotos: 1 } : {}));
const NUMEROS = {};
for (const it of ITEMS) NUMEROS[String(it.id)] = { numero: String(it.id - 880), ...(it.id === 904 ? {} : { buyPrice: '40' }) };
const AVIS_MESURE = [{ id: '9000000002', rating: 5, feedback: 'Parfait' }, { id: '9000000001', rating: 2, feedback: 'Bof' }];
const AVIS_TX = [{ id: '9000000002', rating: 5, feedback: 'Parfait', transaction_id: 6999 }, { id: '9000000001', rating: 2, feedback: 'Bof', transaction_id: 7101 }];
const lignes = (avis) => [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${A}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: `harvest_${A}_listings`, data: { uid: A, type: 'listings', nItems: ITEMS.length, capturedAt: cap, payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
  ...(avis ? [{ id: `harvest_${A}_feedbacks`, data: { type: 'feedbacks', uid: A, capturedAt: cap, nItems: avis.length, payload: { user_feedbacks: avis } } }] : []),
];
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'boutique_test', domain: 'www.vinted.fr', updated_at: cap }];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 220)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : (Array.isArray(v) && /^-?\d+$/.test(seg) ? v[Number(seg) < 0 ? v.length + Number(seg) : Number(seg)] : v[seg]);
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf'][k % 4]}"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 280 300 282 L90 282 C70 282 62 268 70 250 Z" fill="rgba(30,34,40,.55)"/></svg>`;

const ouvrir = async (b, tel, sombre, url, avis) => {
  const LIGNES = lignes(avis);
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = [], selects = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(({ s, n }) => { try {
    if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1');
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n));
  } catch (_) {} }, { s: !!sombre, n: NUMEROS });
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/_feedbacks/.test(u)) selects.push(sel || '');
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/${url}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, selects };
};
const toucher = async (pg, tel, loc) => { if (tel) await loc.tap(); else await loc.click(); };
const nomT = (tel, sombre) => `${tel ? 390 : 1512}-${sombre ? 'sombre' : 'clair'}`;

async function annonces(b, tel, sombre) {
  const T = nomT(tel, sombre);
  const r = await ouvrir(b, tel, sombre, '?tab=cat_annonces', AVIS_MESURE);
  try {
    const bouton = r.pg.locator('[data-vue-a-completer]').first();
    await bouton.waitFor({ timeout: 30000 });
    await r.pg.waitForTimeout(800);
    dit(await bouton.getAttribute('data-vue-a-completer') === '4', `${T} la vue « À compléter » compte 4 annonces`, await bouton.getAttribute('data-vue-a-completer'));
    // (11 nov., décision C10) Outils : l'ancien bloc « Annonces à compléter » est FONDU — une ligne
    // (le même nombre) mène à la vue ; plus aucun second bloc au même nom.
    await toucher(r.pg, tel, r.pg.locator('button[aria-label="Outils des annonces"]').first());
    const ligneOutils = r.pg.locator('[data-outils-a-completer]').first();
    await ligneOutils.waitFor({ timeout: 8000 });
    const hO = await ligneOutils.evaluate((e) => Math.round(e.getBoundingClientRect().height));
    dit(await ligneOutils.getAttribute('data-outils-a-completer') === '4' && await r.pg.locator('[data-annonces-completer]').count() === 0 && hO >= 44, `${T} (C10) Outils : une ligne « À compléter · 4 » (44 px), plus l’ancien bloc`, String(hO));
    if (SHOTS_C10) await r.pg.screenshot({ path: path.join(CAP, `annonces-outils-c10-${T}.png`) });
    await toucher(r.pg, tel, ligneOutils);
    await r.pg.waitForSelector('[data-a-completer="lu"]', { timeout: 15000 });
    dit(await r.pg.locator('[data-vue-a-completer][aria-pressed="true"]').count() >= 1, `${T} (C10) la ligne ouvre la vue « À compléter » (un seul endroit)`);
    await r.pg.waitForSelector('[data-a-completer="lu"]', { timeout: 15000 });
    await r.pg.waitForTimeout(400);
    const v = await r.pg.evaluate(() => {
      const s = document.querySelector('[data-a-completer]');
      const lignes = [...s.querySelectorAll('[data-ac-annonce]')].map((li) => {
        const m = li.querySelector('[data-ac-modifier]'), p = li.querySelector('[data-ac-prix-achat]');
        const h = (e) => (e ? Math.round(e.getBoundingClientRect().height) : null);
        return { id: li.getAttribute('data-ac-annonce'), manques: li.getAttribute('data-ac-manques'), lien: m ? m.getAttribute('href') : null, prix: !!p, hM: h(m), hP: h(p) };
      });
      return { n: s.getAttribute('data-a-completer-n'), total: s.getAttribute('data-a-completer-total'), pasSu: (s.querySelector('[data-ac-pas-su]') || {}).getAttribute ? s.querySelector('[data-ac-pas-su]').getAttribute('data-ac-pas-su') : null, lignes };
    });
    const par = Object.fromEntries(v.lignes.map((l) => [l.id, l]));
    dit(v.n === '4' && v.total === '55' && Object.keys(par).sort().join(',') === '902,903,904,930', `${T} 4 annonces listées sur 55 (902, 903, 904, 930) — 901 complète et 905 pas lue absentes`, JSON.stringify(v));
    dit(par['902'] && par['902'].manques === 'photos' && par['903'] && par['903'].manques === 'marque' && par['904'] && par['904'].manques === 'achat' && par['930'] && par['930'].manques === 'photos',
      `${T} chaque annonce porte SON manque (50 au même titre : seule 930)`, JSON.stringify(v.lignes));
    dit(v.pasSu === 'photos', `${T} « pas su » dit : photos jamais lues (905), pas un manque`, v.pasSu);
    dit(par['902'] && par['902'].lien === 'https://www.vinted.fr/items/902/edit' && par['904'] && par['904'].lien == null && par['904'].prix && !par['902'].prix,
      `${T} « Modifier ↗ » par identifiant ; prix d'achat = geste VRM seul`, JSON.stringify([par['902'], par['904']]));
    dit(v.lignes.every((l) => (l.hM == null || l.hM >= 44) && (l.hP == null || l.hP >= 44)), `${T} gestes ≥ 44 px`, JSON.stringify(v.lignes.map((l) => [l.hM, l.hP])));
    dit(await r.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${T} Annonces : aucun débordement horizontal`);
    await r.pg.locator('[data-a-completer]').first().scrollIntoViewIfNeeded().catch(() => {});
    await r.pg.screenshot({ path: path.join(CAP, `annonces-avis-${T}-acompleter.png`) });
    await essaie(`${T} prix d'achat`, async () => {
      await toucher(r.pg, tel, r.pg.locator('[data-ac-prix-achat="904"]'));
      const dlg = await r.pg.waitForSelector('[role="dialog"] input, [role="alertdialog"] input', { timeout: 8000 }).then(() => true).catch(() => false);
      const ecrit = await r.pg.evaluate(() => (JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}')['904'] || {}).buyPrice || null);
      dit(dlg && ecrit == null, `${T} « Prix d'achat » ouvre la saisie, rien écrit sans OK`, JSON.stringify({ dlg, ecrit }));
      await r.pg.keyboard.press('Escape').catch(() => {});
    });
    dit(r.errs.length === 0, `${T} Annonces : aucune erreur`, r.errs.join(' | '));
  } finally { await r.ctx.close(); }
}

const ouvrirVente = async (pg, tx) => {
  const t = pg.locator(`.vrm-sale-row[data-tx="${tx}"] .vrm-ledger-sale-toggle`).first();
  if (await t.getAttribute('aria-expanded') !== 'true') {
    const croix = pg.locator('.vrm-ledger-drawer-host:not([hidden]) .vrm-recap-fermer');
    if (await croix.count()) { await croix.first().click(); await pg.locator('.vrm-ledger-drawer-host:not([hidden])').first().waitFor({ state: 'detached', timeout: 4000 }).catch(() => {}); await pg.waitForTimeout(150); }
  }
  await t.scrollIntoViewIfNeeded();
  if (await t.getAttribute('aria-expanded') !== 'true') await t.click();
  const id = await t.getAttribute('aria-controls');
  await pg.locator(`[id="${id}"]`).waitFor({ state: 'visible', timeout: 8000 });
  await pg.waitForTimeout(700);
  return id;
};
const lireAvis = (pg, id) => pg.evaluate((id) => { const d = document.getElementById(id); const e = d && d.querySelector('[data-avis-vente]'); if (!e) return null;
  const n = e.querySelector('[data-avis-vente-note]'); return { etat: e.getAttribute('data-avis-vente'), note: n ? n.getAttribute('data-avis-vente-note') : null, deb: d.scrollWidth - d.clientWidth }; }, id);

async function ventes(b, tel, sombre) {
  const T = nomT(tel, sombre);
  for (const [cas, avis] of [['mesure', AVIS_MESURE], ['tx', AVIS_TX], ['aucun', null]]) {
    const r = await ouvrir(b, tel, sombre, '?tab=cat_ventes', avis);
    try {
      await r.pg.locator('.vrm-sale-row[data-tx] .vrm-ledger-sale-toggle').first().waitFor({ timeout: 30000 });
      await r.pg.waitForTimeout(1000);
      await essaie(`${T} ${cas}`, async () => {
        const id = await ouvrirVente(r.pg, 7101); const a = await lireAvis(r.pg, id);
        if (cas === 'mesure') {
          dit(a && a.etat === 'nonRelie' && a.note == null, `${T} forme mesurée : « pas relié », aucune note devinée`, JSON.stringify(a));
          dit(r.selects.length > 0 && r.selects.every((s) => s && s !== 'data' && !/(^|,)data(,|$)/.test(s)), `${T} les avis sont lus par projection (jamais select=data)`, JSON.stringify(r.selects));
          await r.pg.locator(`[id="${id}"] [data-avis-vente]`).first().scrollIntoViewIfNeeded().catch(() => {});
          await r.pg.screenshot({ path: path.join(CAP, `annonces-avis-${T}-vente.png`) });
        } else if (cas === 'tx') {
          const id2 = await ouvrirVente(r.pg, 7102); const a2 = await lireAvis(r.pg, id2);
          dit(a && a.etat === 'relie' && a.note === '2' && a2 && a2.etat === 'aucun', `${T} avis avec n° de transaction : 7101 relié (2/5), 7102 aucun`, JSON.stringify([a, a2]));
          const id3 = await ouvrirVente(r.pg, 7101);
          await r.pg.locator(`[id="${id3}"] [data-avis-vente]`).first().scrollIntoViewIfNeeded().catch(() => {});
          await r.pg.screenshot({ path: path.join(CAP, `annonces-avis-${T}-vente-relie.png`) });
        } else {
          dit(a == null, `${T} aucun avis capté : aucune ligne`, JSON.stringify(a));
        }
      });
      dit(await r.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${T} Ventes (${cas}) : aucun débordement horizontal`);
      dit(r.errs.length === 0, `${T} Ventes (${cas}) : aucune erreur`, r.errs.join(' | '));
    } finally { await r.ctx.close(); }
  }
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [tel, sombre] of [[true, false], [true, true], [false, false], [false, true]]) {
      console.log(`── ${tel ? '390 px tactile' : '1512 px'}, ${sombre ? 'sombre' : 'clair'}`);
      await annonces(b, tel, sombre); await ventes(b, tel, sombre);
    }
  } catch (e) {
    dit(false, 'le banc a tourné jusqu’au bout', e.message);
  } finally {
    if (b) await b.close(); srv.close();
  }
  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
