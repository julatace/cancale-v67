// ── BANC : RANGER UN ACHAT À SON ARRIVÉE (11 nov., lot rangement-guide) ──────
// Julien : quand un achat est RETIRÉ, une feuille « Ranger cet achat » : sa photo,
// le PROCHAIN N° (après le plus haut, jamais un trou, jamais un ancien), une case
// LIBRE proposée, la fiche pré-remplie depuis l'achat, UN geste « Rangé », tout
// annulable 5 s ; rien n'est numéroté ni rangé sans son geste.
//
// Données INVENTÉES (dépôt public) : un achat Vinted au point relais (tx 9301,
// 38 €), un meuble « Étagère A » 3 × 2 dont deux cases sont prises (dont une par
// un ancien N° « B230 »), le pool 1…7, 9, 12 (des TROUS en 8, 10, 11). Exigé, à
// 390 px tactile et à 1512 px :
//   R1 « J'ai retiré » ⇒ la feuille, N°13 (jamais 8, 10, 11), case 3 du niveau 1
//      (la première libre), titre et prix LUS de l'achat ; RIEN d'écrit avant « Rangé » ;
//   R2 un toucher sur une autre case libre la donne à la ligne ; une case prise ne réagit pas ;
//   R3 « Rangé » ⇒ fiche N°13 liée à la transaction 9301, case posée, coût 38, N°13 au pool ;
//   R4 « Annuler » ⇒ fiche, case et coût défaits ; le N°13 RESTE servi (il a pu être écrit sur le carton) ;
//   R5 Ma journée : « 1 achat à ranger » ⇒ la feuille propose N°14 (13 n'est jamais redonné) ;
//   + aucune erreur de page, aucun défilement horizontal ; captures (SHOTS=dossier).
// `RANGER_ATTENDU=8` : ce qu'un code qui comble les trous proposerait (mutation : le banc rougit).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData, metaDe, filtreData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4391);
const SHOTS = process.env.SHOTS || '';
const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();

const ACHATS = [
  { transaction_id: 9301, conversation_id: 7001, title: 'Nike Air Max 90 blanche taille 43', price: { amount: '38', currency_code: 'EUR' },
    photo: { url: 'https://images1.vinted.net/t/9301_d/f800/9301.jpeg' }, status: 'Colis déposé en point relais', transaction_user_status: 'needs_action', date: ilYa(4) },
];
const RELAIS = { '9301': { code: '012345', lieu: 'Phone Cash, 12 rue du Port, 35260 Cancale', transporteur: 'mondialrelay', at: new Date(MAINTENANT).toISOString() } };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const MEUBLES = [{ id: 'mA', name: 'Étagère A', cols: 3, rows: 2 }];
const SLOTS = { B230: { m: 'mA', i: 0 }, 7: { m: 'mA', i: 1 } };
const POOL = [1, 2, 3, 4, 5, 6, 7, 9, 12];
const mainData = (sombre) => ({ vinted_dark: !!sombre, vinted_pickup_done: {}, vrm_colis_collected: [], vrm_colis_collected_at: {}, vrm_meubles: MEUBLES, vrm_slots: SLOTS, vinted_used_numeros: POOL });
const rows = (sombre) => [
  { id: 'main', data: mainData(sombre) },
  { id: 'panel_colis_relais', data: RELAIS },
  { id: 'panel_num_reserves', data: {} },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: ACHATS } } },
];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (!c && d !== undefined ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'meta') { out[alias] = metaDe(row.data); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};
const lireLocal = (pg) => pg.evaluate(() => { const j = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
  return { fiches: j('vrm_fiches_neuves') || {}, slots: j('vrm_slots') || {}, pool: (j('vinted_used_numeros') || []).map(String), couts: j('vinted_buyprice_by_num') || {} }; });
const attendre = async (fn, ms = 8000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 200)); } return v; };
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };

async function passe(b, vp, sombre) {
  const T = `${vp.width}px${sombre ? ' sombre' : ''}`;
  const tactile = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tactile ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(!!sb)); } catch (_) {} }, sombre);
  await pg.route('**/images1.vinted.net/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)(?!.*\/rest\/v1\/)(?!.*images1\.vinted)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const R = rows(sombre);
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(R.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(R.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(R.filter((r) => re.test(r.id) && filtreData(u)(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));

  await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-cc-colonne="retirer"] .vrm-rpf-ouvrir, .vrm-pickup-collect').first().waitFor({ timeout: 30000 });
  if (!(await pg.locator('.vrm-pickup-collect').count())) await pg.locator('[data-cc-colonne="retirer"] .vrm-rpf-ouvrir').first().click();
  await pg.locator('.vrm-pickup-collect').first().waitFor({ timeout: 12000 });
  const avant = await lireLocal(pg);
  await pg.locator('.vrm-pickup-collect').first().click();

  // R1 — la feuille, ce qu'elle propose, rien d'écrit.
  const prop = await attendre(() => pg.evaluate(() => { const l = document.querySelector('[data-ranger-feuille] [data-ranger-ligne="0"]'); if (!l) return null;
    const q = (s) => l.querySelector(s);
    return { tx: (document.querySelector('[data-ranger-tx]') || {}).getAttribute && document.querySelector('[data-ranger-tx]').getAttribute('data-ranger-tx'), num: l.getAttribute('data-ranger-num'), m: l.getAttribute('data-ranger-case-m'), i: l.getAttribute('data-ranger-case-i'),
      titre: q('[data-ranger-titre]') && q('[data-ranger-titre]').value, prix: q('[data-ranger-prix]') && q('[data-ranger-prix]').value, photo: !!document.querySelector('.vrm-ra-photo img'),
      ok: !!document.querySelector('[data-ranger-ok]:not([disabled])') }; }), 15000);
  const attendu = process.env.RANGER_ATTENDU || '13';
  dit(!!prop, `${T} R1 · « J’ai retiré » ouvre « Ranger cet achat »`);
  if (!prop) { await capture(pg, `rangement-${vp.width}${sombre ? '-sombre' : ''}-echec`); dit(!errs.length, `${T} aucune erreur de page`, errs[0]); await ctx.close(); return; }
  dit(prop.num === attendu, `${T} R1 · le N° proposé est ${attendu} : après le plus haut (12), jamais un trou (8, 10, 11)`, prop.num);
  dit(prop.m === 'mA' && prop.i === '2', `${T} R1 · la case proposée est la première LIBRE (niveau 1 · case 3) — B230 et N°7 occupent les deux premières`, `${prop.m}:${prop.i}`);
  dit(prop.tx === '9301' && prop.titre === 'Nike Air Max 90 blanche taille 43' && prop.prix === '38' && prop.photo, `${T} R1 · la fiche part de l’achat 9301 (titre, prix lu 38, photo)`, prop);
  const pendant = await lireLocal(pg);
  dit(!Object.keys(pendant.fiches).length && !pendant.slots['13'] && !pendant.pool.includes('13') && JSON.stringify(pendant.slots) === JSON.stringify(avant.slots), `${T} R1 · rien n’est numéroté ni rangé avant SON geste`, pendant);
  dit(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${T} aucun défilement horizontal`);
  await capture(pg, `rangement-${vp.width}${sombre ? '-sombre' : ''}-1-feuille`);

  // R2 — une case prise ne réagit pas ; une libre se prend.
  await pg.locator('[data-ranger-case="0"]').click({ force: true }).catch(() => {});
  const apresPrise = await pg.getAttribute('[data-ranger-ligne="0"]', 'data-ranger-case-i');
  await pg.locator('[data-ranger-case="4"]').click();
  const apresLibre = await pg.getAttribute('[data-ranger-ligne="0"]', 'data-ranger-case-i');
  dit(apresPrise === '2' && apresLibre === '4', `${T} R2 · toucher une case prise ne change rien, une libre (niveau 2 · case 2) se prend`, [apresPrise, apresLibre]);
  await pg.fill('[data-ranger-taille="0"]', '43');

  // R3 — « Rangé ».
  await pg.locator('[data-ranger-ok]').click();
  const ecrit = await attendre(async () => { const l = await lireLocal(pg); const f = Object.values(l.fiches)[0]; return f && l.slots['13'] ? { l, f } : null; }, 8000);
  dit(!!ecrit && ecrit.f.numero === '13' && ecrit.f.achat && ecrit.f.achat.tx === '9301' && ecrit.f.taille === '43' && ecrit.f.prixAchat === 38 && ecrit.f.case && ecrit.f.case.i === 4,
    `${T} R3 · « Rangé » : fiche N°13 liée à la transaction 9301 (taille tapée, prix lu), case niveau 2 · case 2`, ecrit && ecrit.f);
  dit(!!ecrit && ecrit.l.slots['13'] && ecrit.l.slots['13'].m === 'mA' && ecrit.l.slots['13'].i === 4 && ecrit.l.pool.includes('13') && String(ecrit.l.couts['13']) === '38'
    && ecrit.l.slots.B230 && ecrit.l.slots['7'], `${T} R3 · la case est posée, N°13 entre au pool, le coût suit le N° ; les autres cases intactes`, ecrit && ecrit.l);
  const ferme = await attendre(() => pg.evaluate(() => !document.querySelector('[data-ranger-feuille]')), 5000);
  dit(!!ferme, `${T} R3 · la feuille se referme`);
  const pil = await attendre(() => pg.evaluate(() => { const p = document.querySelector('[data-pilule-annuler]'); return p ? p.getAttribute('aria-label') : null; }), 4000);
  dit(!!pil && /13/.test(pil), `${T} R3 · la pilule dit « N°13 rangé » et offre « Annuler »`, pil);
  await capture(pg, `rangement-${vp.width}${sombre ? '-sombre' : ''}-2-range`);

  // R4 — « Annuler » : tout se défait, sauf le N° servi.
  await pg.locator('[data-pilule-annuler]').first().click();
  const defait = await attendre(async () => { const l = await lireLocal(pg); return !Object.keys(l.fiches).length && !l.slots['13'] ? l : null; }, 8000);
  dit(!!defait && defait.pool.includes('13') && defait.couts['13'] == null && defait.slots.B230 && defait.slots['7'],
    `${T} R4 · « Annuler » défait fiche, case et coût ; N°13 reste servi (jamais redonné)`, defait);

  // R5 — Ma journée : la carte, et le N° suivant.
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  const carte = await attendre(() => pg.evaluate(() => { const c = document.querySelector('[data-job="achats-a-ranger"]'); return c ? c.getAttribute('data-n') : null; }), 25000);
  dit(carte === '1', `${T} R5 · Ma journée : « 1 achat à ranger »`, carte);
  await capture(pg, `rangement-${vp.width}${sombre ? '-sombre' : ''}-3-journee`);
  if (carte) {
    await pg.locator('[data-job="achats-a-ranger"]').first().click();
    const n2 = await attendre(() => pg.evaluate(() => { const l = document.querySelector('[data-ranger-feuille] [data-ranger-ligne="0"]'); return l && l.getAttribute('data-ranger-num'); }), 15000);
    const suivant = String(Number(attendu) + 1);
    dit(n2 === suivant, `${T} R5 · la feuille propose N°${suivant} : le N°${attendu} annulé n’est jamais redonné`, n2);
    await capture(pg, `rangement-${vp.width}${sombre ? '-sombre' : ''}-4-suivant`);
  }
  dit(!errs.length, `${T} aucune erreur de page`, errs[0]);
  await ctx.close();
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true]]) await essaie(`${vp.width}px`, () => passe(b, vp, sombre));
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ rangement guidé : ${ko} rouge(s), ${ok} vert(s).` : `\n✅ rangement guidé : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
