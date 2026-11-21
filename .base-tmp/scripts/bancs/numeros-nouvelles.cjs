// ════════════════════════════════════════════════════════════════════════════
//  BANC « LES NOUVELLES ANNONCES SANS N° » (15 nov., src/numerosNouvelles.js)
//  Julien publie depuis l'app Vinted du téléphone, sans l'extension ; à la lecture
//  suivante du dressing :
//  A. « VRM numérote » (profil Sneakers, puis profil « autre » : une paire ET un sac,
//     numérotés pareil) — lecture COMPLÈTE ⇒ N°8 et N°9 posés tout seuls, marqués
//     « à écrire » ; Ma journée en tête : « 2 nouveaux articles numérotés · N°8, 9 »
//     (Ma journée dit « articles » pour tous, Julien 3 nov.) ; la feuille « Nouveaux N° à
//     écrire sur tes cartons » (photo, N°, titre ; « paires » pour Sneakers, « articles » sinon) ;
//     « C'est écrit » ⇒ la ligne sort, la marque part au nuage, le N° ne change pas.
//  P. La même lecture PARTIELLE (Vinted annonce 5 articles, 3 lus) ⇒ AUCUN N° neuf,
//     aucune ligne dans Ma journée.
//  B. « Je numérote moi-même » — le N° écrit (« N° 55 » dans le titre) est pris tel
//     quel ; l'autre article : « 1 article sans numéro · Donne-leur un N° » ⇒ la
//     feuille « Quel N° pour cette paire ? (1 sur 1) », photo, champ pré-rempli
//     avec 56 (le suivant), le rappel « Écris-le aussi à la fin de sa description » ;
//     « 60 » + Enregistrer ⇒ N°60 posé à la main ; la ligne disparaît.
//  R. Réglages → « Qui numérote ? VRM · Moi » et la phrase du choix.
//  390 px tactile et 1512 px, clair et sombre. Données INVENTÉES (dépôt public).
//  BANC_PORT (10480 par défaut), BANC_DIST (dist), BANC_CAPTURES, SCENARIOS=A,P,B,R, COMBOS=390:clair,…
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { routeMain, ecritesMain, attendre } = require('./_base-ecritures.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10480;
const CAPTURES = process.env.BANC_CAPTURES || path.join(require('os').tmpdir(), 'banc-numeros-nouvelles');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}
const auj = new Date();
const ilYa = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const ann = (id, title, heures, brand, size) => ({ id, title, price: { amount: '59.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: brand, size_title: size, status: 'Très bon état', view_count: 3, favourite_count: 0, created_at_ts: Math.floor((Date.now() - heures * 3600e3) / 1000) });
// 9301 : N°7, déjà numérotée. 9310 (une paire) et 9311 (un sac) : publiées depuis le téléphone, sans N°.
const ITEMS_VRM = [
  ann(9301, 'Salomon XT-6 noire taille 41', 400, 'Salomon', '41'),
  ann(9310, 'Adidas Samba noire taille 40', 3, 'Adidas', '40'),
  ann(9311, 'Sac Gucci Marmont cuir noir', 2, 'Gucci', 'Taille unique'),
];
// Mode « moi » : 9320 porte son N° dans le titre ; 9321 rien.
const ITEMS_MOI = [
  ann(9301, 'Salomon XT-6 noire taille 41', 400, 'Salomon', '41'),
  ann(9320, 'Nike Dunk Low blanche N° 55', 3, 'Nike', '42'),
  ann(9321, 'Bottes Dior cuir noir taille 39', 2, 'Dior', '39'),
];
const MAIN = ({ moi = false, vend = 'sneakers' } = {}) => ({
  vinted_annonce_numeros: { '9301': { numero: '7', auto: false, manuelAt: ilYa(300), numberedAt: ilYa(400), buyPrice: '25,00' } },
  vinted_buyprice_by_num: { 7: '25,00' },
  vinted_used_numeros: [1, 2, 3, 4, 5, 6, 7],
  vrm_numero_ecrit: moi ? { actif: true, ou: ['description', 'titre'], depuis: ilYa(48), choisi: ilYa(48) } : { actif: false, depuis: ilYa(48), choisi: ilYa(48) },
  vrm_je_vends: vend === 'sneakers' ? { choix: 'sneakers', categories: ['sneakers'], at: ilYa(48) } : { choix: 'autre', categories: ['sacs', 'vetements'], at: ilYa(48) },
});
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${d && !c ? ' — ' + d : ''}`); };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log(`  ❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); });
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

async function ouvrir(b, { url, largeur, sombre, main, items, total }) {
  const base = { main, maj: new Date(Date.now() - 86400e3).toISOString(), ecritures: [] };
  // La lecture du dressing : `total_entries` = ce que Vinted annonce (complète si tous lus).
  const rows = [
    { id: 'harvest_111_listings', data: { capturedAt: new Date(Date.now() - 60e3).toISOString(), payload: { items, pagination: { total_entries: total == null ? items.length : total, total_pages: 1, current_page: 1 } } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: [] } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: [] } } },
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
  await pg.waitForTimeout(6000);
  return { pg, ctx, errs, base };
}
const local = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
const fiches = async (pg) => (await local(pg, 'vinted_annonce_numeros')) || {};
const toucher = async (pg, sel, mobile) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {}); if (mobile) await l.tap({ timeout: 8000 }); else await l.click({ timeout: 8000 }); };
const pasDeCote = (pg) => pg.evaluate(() => (document.scrollingElement || document.documentElement).scrollWidth <= window.innerWidth + 1);
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
const petits = (pg, sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43.5).map((e) => (e.innerText || e.getAttribute('aria-label') || '').slice(0, 24)), sel);
const job = (pg, id) => pg.evaluate((id) => { const e = document.querySelector(`[data-job="${id}"]`); return e ? { n: e.getAttribute('data-n'), txt: (e.innerText || '').replace(/\s+/g, ' ').trim(), avant: [...document.querySelectorAll('[data-job]')].indexOf(e) } : null; }, id);

async function scenarioA(b, largeur, sombre, vend) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'} · ${vend}`, cap = `${largeur}-${sombre ? 'sombre' : 'clair'}-${vend}`;
  console.log(`\n── A. « VRM numérote » : les nouvelles annonces reçoivent leur N° et c'est dit (${tag})`);
  const { pg, ctx, errs, base } = await ouvrir(b, { url: '/', largeur, sombre, main: MAIN({ vend }), items: ITEMS_VRM });
  try {
    await pg.waitForSelector('[data-job="numeros-nouveaux"]', { timeout: 25000 }).catch(() => {});
    const f = await fiches(pg);
    dit((f['9310'] || {}).numero === '8' && (f['9311'] || {}).numero === '9', `${tag} : lecture complète ⇒ la paire N°8, le sac N°9 (le plus haut + 1, dans l'ordre de mise en ligne, sans catégorie)`, JSON.stringify({ a: f['9310'], b: f['9311'] }).slice(0, 200));
    dit(!!((f['9310'] || {}).nouveau && (f['9311'] || {}).nouveau) && (f['9301'] || {}).numero === '7' && !(f['9301'] || {}).nouveau, `${tag} : les deux sont « à écrire », la N°7 n'est pas touchée`);
    const j = await job(pg, 'numeros-nouveaux');
    // Ma journée dit « articles » pour tous (Julien, 3 nov.) — la forme écrite en entier, accordée.
    dit(j && j.n === '2' && /^2 nouveaux articles numérotés · N°8, 9/.test(j.txt), `${tag} : Ma journée : « 2 nouveaux articles numérotés · N°8, 9 » (accordé, jamais « nouvelles articles »)`, JSON.stringify(j));
    dit(!!j && !/paire|nouvelles articles|numérotées/i.test(j.txt), `${tag} : aucun mot remplacé dans la phrase`, j && j.txt);
    dit(!!j && j.avant <= 1, `${tag} : la ligne est en tête d'« À faire »`, j && String(j.avant));
    dit(!(await job(pg, 'sans-numero')), `${tag} : pas de seconde ligne « annonces sans numéro » (le même sujet, une fois)`);
    await pg.locator('[data-job="numeros-nouveaux"]').first().scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `A-${cap}-journee`);
    await toucher(pg, '[data-job="numeros-nouveaux"] button, button[data-job="numeros-nouveaux"]', mobile);
    const feuille = await pg.waitForSelector('[data-nn-feuille]', { timeout: 8000 }).then(() => true).catch(() => false);
    dit(feuille, `${tag} : « Écrire » ouvre « Nouveaux N° à écrire sur tes cartons »`);
    if (feuille) {
      const l = await pg.evaluate(() => [...document.querySelectorAll('[data-nn-ligne]')].map((e) => [e.getAttribute('data-nn-ligne'), e.getAttribute('data-nn-num')]));
      dit(JSON.stringify(l) === JSON.stringify([['9310', '8'], ['9311', '9']]), `${tag} : une ligne par article (N°8 la paire, N°9 le sac)`, JSON.stringify(l));
      const sous = await pg.locator('[data-nn-feuille]').innerText();
      dit(vend === 'sneakers' ? /paires/.test(sous) : (/articles/.test(sous) && !/paire/i.test(sous)), `${tag} : la feuille parle de ${vend === 'sneakers' ? 'paires' : 'articles'}`);
      const p = await petits(pg, '[data-nn-feuille] button');
      dit(!mobile || p.length === 0, `${tag} : boutons de la feuille à 44 px`, p.join(' | '));
      await pg.waitForTimeout(700);   // la feuille a fini de monter
      await capture(pg, `A-${cap}-feuille`);
      await toucher(pg, '[data-nn-ecrit="9310"]', mobile);
      await pg.waitForTimeout(900);
      const reste = await pg.evaluate(() => [...document.querySelectorAll('[data-nn-ligne]')].map((e) => e.getAttribute('data-nn-ligne')));
      const f2 = await fiches(pg);
      dit(JSON.stringify(reste) === '["9311"]' && !!((f2['9310'] || {}).nouveau || {}).ecrit && (f2['9310'] || {}).numero === '8', `${tag} : « C'est écrit » ⇒ la ligne sort, la marque est posée, le N°8 ne change pas`, JSON.stringify({ reste, f: f2['9310'] }).slice(0, 200));
      await attendre(() => !!((((base.main || {}).vinted_annonce_numeros || {})['9310'] || {}).nouveau || {}).ecrit, 12000);
      const n = (base.main || {}).vinted_annonce_numeros || {};
      dit(ecritesMain(base).length > 0 && (n['9310'] || {}).numero === '8' && !!((n['9310'] || {}).nouveau || {}).ecrit && (n['9311'] || {}).numero === '9', `${tag} : le nuage garde N°8 (écrit) et N°9 (à écrire)`, JSON.stringify({ a: n['9310'], b: n['9311'] }).slice(0, 200));
      const pool = (base.main || {}).vinted_used_numeros || [];
      dit(pool.includes(8) && pool.includes(9), `${tag} : 8 et 9 au pool du nuage (jamais redonnés)`, JSON.stringify(pool));
    }
    dit(await pasDeCote(pg), `${tag} : aucune page qui défile de côté`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario A a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 600)); await capture(pg, `A-${cap}-erreur`); }
  finally { await ctx.close(); }
}

async function scenarioP(b, largeur, sombre) {
  const tag = `${largeur}${sombre ? ' sombre' : ' clair'}`;
  console.log(`\n── P. Lecture PARTIELLE : aucun N° neuf (${tag})`);
  const { pg, ctx, errs } = await ouvrir(b, { url: '/', largeur, sombre, main: MAIN(), items: ITEMS_VRM, total: 5 });
  try {
    await pg.waitForTimeout(3000);
    const f = await fiches(pg);
    dit(!(f['9310'] || {}).numero && !(f['9311'] || {}).numero, `${tag} : Vinted annonce 5 articles, 3 lus ⇒ aucun N° neuf`, JSON.stringify({ a: f['9310'], b: f['9311'] }).slice(0, 160));
    dit(!(await job(pg, 'numeros-nouveaux')), `${tag} : rien dans Ma journée`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario P a tourné jusqu'au bout`, String(e && e.message).slice(0, 300)); }
  finally { await ctx.close(); }
}

async function scenarioB(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`, cap = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\n── B. « Je numérote moi-même » : l'app DEMANDE (${tag})`);
  const { pg, ctx, errs, base } = await ouvrir(b, { url: '/', largeur, sombre, main: MAIN({ moi: true }), items: ITEMS_MOI });
  try {
    await pg.waitForSelector('[data-job="numeros-a-donner"]', { timeout: 25000 }).catch(() => {});
    let f = await fiches(pg);
    dit((f['9320'] || {}).numero === '55' && !(f['9320'] || {}).nouveau, `${tag} : le N° écrit (« N° 55 ») est pris tel quel`, JSON.stringify(f['9320']).slice(0, 160));
    dit(!(f['9321'] || {}).numero, `${tag} : rien d'écrit ⇒ VRM n'attribue RIEN`, JSON.stringify(f['9321']));
    const j = await job(pg, 'numeros-a-donner');
    dit(j && j.n === '1' && /1 article sans numéro/.test(j.txt) && /Donne-leur un N°/.test(j.txt), `${tag} : Ma journée : « 1 article sans numéro · Donne-leur un N° »`, JSON.stringify(j));
    dit(!(await job(pg, 'numeros-nouveaux')), `${tag} : aucune ligne « numérotées par VRM »`);
    dit(!(await job(pg, 'sans-numero')), `${tag} : pas de seconde ligne « annonces sans numéro » (le même nombre, une fois)`);
    await pg.locator('[data-job="numeros-a-donner"]').first().scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `B-${cap}-journee`);
    await toucher(pg, '[data-job="numeros-a-donner"] button, button[data-job="numeros-a-donner"]', mobile);
    const ch = await pg.waitForSelector('[data-ask-champ="numero-demande"]', { timeout: 8000 }).then(() => true).catch(() => false);
    dit(ch, `${tag} : la feuille « Quel N° pour cette paire ? (1 sur 1) » s'ouvre`);
    if (ch) {
      const e = await pg.evaluate(() => { const i = document.querySelector('[data-ask-champ="numero-demande"]'); const sh = i.closest('form').parentElement; return { v: i.value, im: i.getAttribute('inputmode'), photo: !!sh.querySelector('[data-ask-photo]'), txt: sh.innerText.replace(/\s+/g, ' ') }; });
      dit(e.v === '56', `${tag} : le champ propose 56 (le suivant), qu'il peut changer`, JSON.stringify(e).slice(0, 200));
      dit(e.photo && /Quel N° pour cette paire \? \(1 sur 1\)/.test(e.txt) && /Bottes Dior/.test(e.txt), `${tag} : photo, titre de l'article, « 1 sur 1 »`, e.txt.slice(0, 200));
      dit(/Écris-le aussi à la fin de sa description/.test(e.txt), `${tag} : le rappel « écris-le aussi à la fin de sa description »`);
      dit(e.im === 'numeric', `${tag} : clavier chiffres`, String(e.im));
      await pg.waitForTimeout(700);   // la feuille a fini de monter
      await capture(pg, `B-${cap}-feuille`);
      await pg.fill('[data-ask-champ="numero-demande"]', '60');
      const bt = pg.locator('div:has(> form [data-ask-champ="numero-demande"])').last().locator('button', { hasText: /^Enregistrer$/ }).first();
      await bt.click({ timeout: 4000 }).catch(async () => { await bt.focus().catch(() => {}); await pg.keyboard.press('Enter'); });
      await pg.waitForTimeout(1500);
      // Le prix d'achat est demandé au numérotage (sa règle du 6 nov.) : « Plus tard ».
      if (await pg.locator('[data-ask-champ="prix-numerotage"]').count()) {
        const pt = pg.locator('div:has(> form [data-ask-champ="prix-numerotage"])').last().locator('button', { hasText: /^Plus tard$/ }).first();
        await pt.click({ timeout: 4000 }).catch(() => {});
        await pg.waitForTimeout(600);
      }
      f = await fiches(pg);
      dit((f['9321'] || {}).numero === '60' && !!(f['9321'] || {}).manuelAt && !(f['9321'] || {}).nouveau, `${tag} : « 60 » + Enregistrer ⇒ N°60 posé à la main`, JSON.stringify(f['9321']).slice(0, 200));
      await pg.waitForTimeout(800);
      dit(!(await job(pg, 'numeros-a-donner')), `${tag} : la ligne « sans numéro » disparaît`);
      await attendre(() => ((((base.main || {}).vinted_annonce_numeros || {})['9321']) || {}).numero === '60', 12000);
      dit(((((base.main || {}).vinted_annonce_numeros || {})['9321']) || {}).numero === '60', `${tag} : le nuage garde le N°60`);
    }
    dit(await pasDeCote(pg), `${tag} : aucune page qui défile de côté`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario B a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 600)); await capture(pg, `B-${cap}-erreur`); }
  finally { await ctx.close(); }
}

async function scenarioR(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`, cap = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\n── R. Réglages : « Qui numérote ? » (${tag})`);
  const { pg, ctx, errs, base } = await ouvrir(b, { url: '/?tab=settings', largeur, sombre, main: MAIN(), items: ITEMS_VRM });
  try {
    await pg.waitForSelector('[data-sous-ouvrir="numeros"]', { timeout: 20000 });
    await toucher(pg, '[data-sous-ouvrir="numeros"]', mobile);
    const vu = await pg.waitForSelector('[data-qui-numerote]', { timeout: 8000 }).then(() => true).catch(() => false);
    dit(vu, `${tag} : « Qui numérote ? VRM · Moi » est dans le réglage des numéros`);
    if (vu) {
      dit(await pg.getAttribute('[data-qui-numerote]', 'data-qui-numerote') === 'vrm' && /lu en entier/.test(await pg.locator('[data-qui-numerote-phrase]').innerText()), `${tag} : « VRM » choisi, et sa phrase`);
      const p = await petits(pg, '[data-qui-numerote-choix]');
      dit(p.length === 0, `${tag} : deux choix de 44 px`, p.join(' | '));
      await pg.locator('[data-qui-numerote]').scrollIntoViewIfNeeded().catch(() => {});
      await capture(pg, `R-${cap}-vrm`);
      await toucher(pg, '[data-qui-numerote-choix="moi"]', mobile);
      await pg.waitForTimeout(500);
      dit(await pg.getAttribute('[data-qui-numerote]', 'data-qui-numerote') === 'moi' && /te demande un N°/.test(await pg.locator('[data-qui-numerote-phrase]').innerText()), `${tag} : « Moi » ⇒ la phrase change`);
      await attendre(() => !!(base.main && base.main.vrm_numero_ecrit && base.main.vrm_numero_ecrit.actif === true), 10000);
      dit(!!(base.main && base.main.vrm_numero_ecrit && base.main.vrm_numero_ecrit.actif === true), `${tag} : le choix part au nuage (synchronisé entre appareils)`);
      await capture(pg, `R-${cap}-moi`);
    }
    dit(await pasDeCote(pg), `${tag} : aucune page qui défile de côté`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario R a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 400)); await capture(pg, `R-${cap}-erreur`); }
  finally { await ctx.close(); }
}

(async () => {
  let b;
  await new Promise((res) => srv.listen(PORT, res));
  const seuls = (process.env.SCENARIOS || 'A,P,B,R').split(',');
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const combos = (process.env.COMBOS || '390:clair,1512:clair,390:sombre,1512:sombre').split(',').map((c) => c.split(':')).map(([l, t]) => [Number(l), t === 'sombre']);
    for (const [largeur, sombre] of combos) {
      if (seuls.includes('A')) { await scenarioA(b, largeur, sombre, 'sneakers'); if (!sombre) await scenarioA(b, largeur, sombre, 'autre'); }
      if (seuls.includes('P') && largeur === 390 && !sombre) await scenarioP(b, largeur, sombre);
      if (seuls.includes('B')) await scenarioB(b, largeur, sombre);
      if (seuls.includes('R')) await scenarioR(b, largeur, sombre);
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\nCaptures : ${CAPTURES}`);
  console.log(ko ? `\n❌ Nouvelles annonces sans N° : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ Nouvelles annonces sans N° : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
