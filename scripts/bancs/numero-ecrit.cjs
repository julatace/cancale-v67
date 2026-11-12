// ════════════════════════════════════════════════════════════════════════════
//  BANC « JE NUMÉROTE MOI-MÊME DANS MES ANNONCES » (7 nov.).
//  Julien, 7 novembre : « la personne met son numéro d'étiquetage à la fin de sa
//  description […] capter ce numéro-là […] et n'attribuer donc pas de numéro
//  automatiquement ».
//
//  A. Réglages → Numéros : la carte « Je numérote moi-même » est ÉTEINTE par
//     défaut, avec l'exemple « N° 123 » et le pas-à-pas ; l'aperçu Vinted dit
//     « pas encore lu » tant que les annonces n'ont pas été lues ; la bascule
//     (44 px) l'allume et le réglage part au NUAGE (`vrm_numero_ecrit`).
//  B. Réglage allumé, Annonces : 9201 (« N°12 » dans le titre) reçoit 12 ; 9204
//     (« N° 21 » en FIN de description) reçoit 21 ; 9205 (rien d'écrit) et 9206
//     (« #3 #4 », ambigu) ne reçoivent RIEN ; 9203 (VRM : 3, écrit : 8) garde 3 et
//     va « à vérifier » ; « Prendre N°8 » le change sur SON clic. Puis Réglages :
//     l'aperçu Vinted compte et nomme (lus · sans N° · ambigu · à vérifier).
//  Clair et sombre, 390 px tactile et 1512 px. Aucune fixture, tout est inventé.
//  BANC_PORT (7971 par défaut), BANC_DIST (dist par défaut), BANC_CAPTURES.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { routeMain, ecritesMain, attendre } = require('./_base-ecritures.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7971;
const CAPTURES = process.env.BANC_CAPTURES || path.join(require('os').tmpdir(), 'banc-numero-ecrit');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}
const auj = new Date();
const ilYa = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const ann = (id, title, heures) => ({ id, title, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 3, favourite_count: 0, created_at_ts: Math.floor((Date.now() - heures * 3600e3) / 1000) });
const ITEMS = [
  ann(9201, 'Nike Air Max 90 blanc taille 42 N°12', 3),
  ann(9202, 'Salomon XT-6 noir taille 41', 40),
  ann(9203, 'Adidas Samba vert taille 40 N°8', 72),
  ann(9204, 'Asics Gel 1130 argent taille 43', 5),
  ann(9205, 'Nike Air Max 90 blanc taille 42', 2),
  ann(9206, 'New Balance 550 #3 #4', 2),
];
// La description lue sur la page (`vinted_item_details`) : seule 9204 porte son N° à la fin.
const DETAILS = { 9204: { description: 'Très bon état, pointure 43, 45 €.\nEnvoi rapide.\nN° 21', photos: [] }, 9205: { description: 'Très bon état, pointure 42.', photos: [] } };
const MAIN = (extra = {}) => ({
  vinted_annonce_numeros: {
    '9202': { numero: '5', auto: false, manuelAt: ilYa(30), numberedAt: ilYa(40) },
    '9203': { numero: '3', auto: true, numberedAt: ilYa(72) },
  },
  vinted_used_numeros: [1, 2, 3, 4, 5], ...extra,
});
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log(`  ❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=… ou relance le banc seul`); process.exit(1); });
// La projection PostgREST (`a:data->x`, `data->"9204"` : la clé entre guillemets).
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop().replace(/"/g, '');
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/"/g, '')];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function ouvrir(b, { main, url, largeur, sombre }) {
  const base = { main, maj: new Date(Date.now() - 86400e3).toISOString(), ecritures: [] };
  const rows = [
    { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS } } },
    { id: 'vinted_item_details', data: DETAILS },
  ];
  const mobile = largeur < 700;
  const ctx = await b.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof d === 'string' ? d : JSON.stringify(d) });
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'banc' }]);
    const mm = routeMain(req, base); if (mm) return j(mm.body, mm.status);
    if (req.method() !== 'GET') return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5500);
  return { pg, ctx, errs, base };
}
const local = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
const toucher = async (pg, sel, mobile) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {}); if (mobile) await l.tap({ timeout: 8000 }); else await l.click({ timeout: 8000 }); };
const pasDeCote = (pg) => pg.evaluate(() => (document.scrollingElement || document.documentElement).scrollWidth <= window.innerWidth + 1);
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
const ouvrirNumeros = async (pg, mobile) => {
  await pg.waitForSelector('[data-sous-ouvrir="numeros"]', { timeout: 20000 });
  await toucher(pg, '[data-sous-ouvrir="numeros"]', mobile);
  return pg.waitForSelector('[data-numero-ecrit]', { timeout: 8000 }).then(() => true).catch(() => false);
};
const fiches = async (pg) => (await local(pg, 'vinted_annonce_numeros')) || {};

async function reglages(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`, nom = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\n── A. Réglages → Numéros (${tag})`);
  const { pg, ctx, errs, base } = await ouvrir(b, { main: MAIN(), url: '/?tab=settings', largeur, sombre });
  try {
    const vu = await ouvrirNumeros(pg, mobile);
    dit(vu, `${tag} : « Je numérote moi-même dans mes annonces » est dans le réglage des numéros`);
    if (!vu) { await capture(pg, `A-${nom}-absent`); return; }
    dit(await pg.getAttribute('[data-numero-ecrit]', 'data-numero-ecrit') === 'eteint', `${tag} : éteint par défaut`);
    dit(await pg.locator('[data-numero-ecrit-exemple]').count() === 1 && /N° 123/.test(await pg.locator('[data-numero-ecrit-exemple]').innerText()), `${tag} : l'exemple « Termine ta description par : N° 123 »`);
    dit(await pg.locator('[data-numero-ecrit-passu="vinted"]').count() === 1, `${tag} : annonces Vinted pas encore lues ⇒ « pas encore lu », jamais « 0 »`);
    const h = await pg.evaluate(() => { const e = document.querySelector('[data-numero-ecrit-bascule]'); return e ? e.getBoundingClientRect().height : 0; });
    dit(h >= 43.5, `${tag} : la bascule fait au moins 44 px`, String(h));
    await pg.locator('[data-numero-ecrit]').scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `A-${nom}-eteint`);
    await toucher(pg, '[data-numero-ecrit-bascule]', mobile);
    dit(await pg.getAttribute('[data-numero-ecrit]', 'data-numero-ecrit') === 'actif', `${tag} : la bascule l'allume`);
    await attendre(() => !!(base.main && base.main.vrm_numero_ecrit && base.main.vrm_numero_ecrit.actif === true), 10000);
    dit(ecritesMain(base).length > 0 && base.main && base.main.vrm_numero_ecrit && base.main.vrm_numero_ecrit.actif === true, `${tag} : le réglage part au nuage (vrm_numero_ecrit)`, JSON.stringify((base.main || {}).vrm_numero_ecrit || null));
    dit(await pasDeCote(pg), `${tag} : aucune page qui défile de côté`);
    await capture(pg, `A-${nom}-allume`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario A a tourné jusqu'au bout`, String(e && e.message).slice(0, 200)); await capture(pg, `A-${nom}-erreur`); }
  finally { await ctx.close(); }
}

async function annonces(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`, nom = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\n── B. Allumé : Annonces puis l'aperçu (${tag})`);
  const { pg, ctx, errs, base } = await ouvrir(b, { main: MAIN({ vrm_numero_ecrit: { actif: true, depuis: ilYa(1) } }), url: '/?tab=cat_annonces', largeur, sombre });
  try {
    await attendre(async () => String(((await fiches(pg))['9204'] || {}).numero || '') === '21', 15000);
    let f = await fiches(pg);
    dit(String((f['9201'] || {}).numero) === '12' && (f['9201'] || {}).ecrit === 'titre', `${tag} : « N°12 » dans le titre ⇒ la paire reçoit 12 (lu, pas inventé)`, JSON.stringify(f['9201'] || null));
    dit(String((f['9204'] || {}).numero) === '21' && (f['9204'] || {}).ecrit === 'description', `${tag} : « N° 21 » en fin de description ⇒ 21`, JSON.stringify(f['9204'] || null));
    dit(!String((f['9205'] || {}).numero || '').trim(), `${tag} : rien d'écrit ⇒ AUCUN numéro donné (« pointure 42 » n'en est pas un)`, JSON.stringify(f['9205'] || null));
    dit(!String((f['9206'] || {}).numero || '').trim(), `${tag} : « #3 #4 » (deux numéros) ⇒ rien`, JSON.stringify(f['9206'] || null));
    dit(String((f['9203'] || {}).numero) === '3', `${tag} : VRM connaît 3, l'annonce dit 8 ⇒ rien n'est changé tout seul`, JSON.stringify(f['9203'] || null));
    const bloc = await pg.waitForSelector('[data-numero-ecrit-bloc]', { timeout: 8000 }).then(() => true).catch(() => false);
    dit(bloc, `${tag} : « numéros écrits à vérifier » sous les annonces`);
    if (bloc) {
      // (9 nov., lot AI) Le bloc est une PUCE : ses lignes et ses boutons vivent dans SA pop-up.
      await toucher(pg, '[data-numero-ecrit-bloc] [data-popup-ouvrir]', mobile);
      await pg.waitForSelector('[data-popup-corps="numero-ecrit"] [data-numero-ecrit-ligne]', { timeout: 8000 }).catch(() => {});
      const etats = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-numero-ecrit-ligne]')].map((e) => [e.getAttribute('data-numero-ecrit-ligne'), e.getAttribute('data-numero-ecrit-etat')])));
      dit(etats['9203'] === 'contredit' && etats['9206'] === 'ambigu' && !etats['9201'] && !etats['9204'], `${tag} : 9203 « contredit », 9206 « ambigu », les N° lus n'y sont pas`, JSON.stringify(etats));
      dit(await pg.getAttribute('[data-numero-ecrit-bloc]', 'data-numero-ecrit-sans') === '1', `${tag} : 1 annonce sans N° écrit, nommée à part`);
      await pg.locator('[data-numero-ecrit-bloc]').scrollIntoViewIfNeeded().catch(() => {});
      await capture(pg, `B-${nom}-a-verifier`);
      await toucher(pg, '[data-numero-ecrit-prendre="9203"]', mobile);
      await attendre(async () => String(((await fiches(pg))['9203'] || {}).numero) === '8', 6000);
      f = await fiches(pg);
      dit(String((f['9203'] || {}).numero) === '8' && !!(f['9203'] || {}).manuelAt && (f['9203'].reattribue || {}).de === '3', `${tag} : « Prendre N°8 » ⇒ 8, sur SON clic, « N°3 → N°8 » à écrire sur le carton`, JSON.stringify(f['9203'] || null));
      const pool = ((await local(pg, 'vinted_used_numeros')) || []).map(String);
      dit(['3', '8', '12', '21'].every((x) => pool.includes(x)), `${tag} : le pool garde 3 et prend 8, 12, 21 (append-only)`, pool.join(','));
    } else await capture(pg, `B-${nom}-sans-bloc`);
    // L'aperçu de Réglages lit ce que l'écran Annonces vient de publier (sans recharger).
    await pg.evaluate(() => { history.pushState({ vrmTab: 'settings' }, '', '/?tab=settings'); window.dispatchEvent(new PopStateEvent('popstate', { state: { vrmTab: 'settings' } })); });
    const vu = await ouvrirNumeros(pg, mobile);
    dit(vu, `${tag} : Réglages s'ouvre sans recharger`);
    if (vu) {
      const v = await pg.evaluate(() => { const e = document.querySelector('[data-numero-ecrit-site="vinted"]'); return e ? ['lus', 'rien', 'ambigus', 'contredits'].map((k) => e.getAttribute('data-numero-ecrit-' + k)) : null; });
      dit(v && v[0] === '3' && v[1] === '2' && v[2] === '1' && v[3] === '0', `${tag} : aperçu Vinted = 3 N° lus (12, 21, 8 choisi) · 2 sans N° écrit (9202 garde son 5, 9205) · 1 ambigu · 0 à vérifier`, JSON.stringify(v));
      dit(await pg.locator('[data-numero-ecrit-site]').count() === 4, `${tag} : les quatre sites sont dits (Vinted, Leboncoin, Vestiaire, eBay)`);
      await pg.locator('[data-numero-ecrit-apercu]').scrollIntoViewIfNeeded().catch(() => {});
      await capture(pg, `B-${nom}-apercu`);
    }
    dit(await pasDeCote(pg), `${tag} : aucune page qui défile de côté`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario B a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 600)); await capture(pg, `B-${nom}-erreur`); }
  finally { await ctx.close(); }
}

(async () => {
  let b;
  await new Promise((res) => srv.listen(PORT, res));
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [largeur, sombre] of [[390, false], [1512, true]]) {
      await reglages(b, largeur, sombre);
      await annonces(b, largeur, sombre);
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\nCaptures : ${CAPTURES}`);
  console.log(ko ? `\n❌ N° écrit : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ N° écrit : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
