// Banc : « ACHETÉS MAIS PAS ENCORE EN LIGNE » (11 nov., lot pas-en-ligne) — src/pasEnLigne.js,
// src/PasEnLigne.jsx, la carte de Ma journée et l'entrée de l'écran Achats.
// Données INVENTÉES (dépôt public) : 50 achats hors plateforme AU MÊME TITRE, N°101 à N°150,
// achetés il y a 1 à 50 jours ; compte_alpha (111) relu il y a 1 h montre la N°117 en ligne
// (et une annonce au MÊME titre, N°1, qui n'est aucun d'eux).
// Aux deux tailles (390 tactile, 1512 souris), en clair et en sombre, il exige :
//   A  (frais) Ma journée : UNE carte « 36 articles achetés pas en ligne » (≥ 14 j, sans N°117) ;
//   B  la feuille : 36 lignes, la plus ancienne d'abord (N°150 … N°114), jamais N°117, chacune
//      avec son prix d'achat, son âge et sa case (N°150 rangée dans « Étagère banc ») ;
//   C  seuil 30 j ⇒ 21 lignes (N°150 … N°130) ;
//   D  « Ouvrir l'achat » ouvre CET achat en modification sur l'écran Achats ;
//   E  (vieux) compte_beta relu il y a 3 j : AUCUNE carte dans Ma journée ; Achats dit
//      « 36 à confirmer », le manque NOMMÉ (« compte_beta pas relu depuis 3 j ») ;
//   F  (rien) les annonces ne répondent pas : ni carte, ni entrée, rien d'inventé ;
//   G  aucune erreur de page, aucun défilement horizontal.
// Lancer : BANC_PORT=84xx node scripts/bancs/pas-en-ligne.cjs   (SHOT=prefixe pour les captures)
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8437;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const AUJ = Date.now();
const J = 86400000;
const jour = (n) => { const d = new Date(AUJ - n * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const TITRE = 'Paire inventée identique 42';

const HORS = Array.from({ length: 50 }, (_, i) => ({ id: 'ob_banc' + (i + 1), title: TITRE, price: String(30 + i), date: jour(i + 1), source: 'Brocante', numero: String(101 + i), createdAt: new Date(AUJ - (i + 1) * J).toISOString() }));
// La N°117 est en ligne : sa fiche porte le N° de l'achat (il l'a relié par SON N°).
const MAIN = {
  vinted_offvinted_buys: HORS,
  vinted_annonce_numeros: {
    '1001': { numero: '1', title: TITRE, accountId: '111' },
    '1117': { numero: '117', title: TITRE, accountId: '111' },
  },
  vrm_meubles: [{ id: 'mA', name: 'Étagère banc', cols: 3, rows: 2, planches: [1] }],
  vrm_slots: { '150': { m: 'mA', i: 0 } },
};
const ann = (id, title, extra = {}) => ({ id, title, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, photo: null, brand_title: 'Marque', size_title: '42', status: 'Très bon état', ...extra });
const lignes = (scenario) => {
  const L = [{ id: 'harvest_111_listings', data: { capturedAt: new Date(AUJ - 3600000).toISOString(), payload: { items: [ann(1001, TITRE), ann(1117, TITRE)], pagination: { total_entries: 2 } } } }];
  if (scenario === 'vieux') L.push({ id: 'harvest_222_listings', data: { capturedAt: new Date(AUJ - 3 * J - 3600000).toISOString(), payload: { items: [], pagination: { total_entries: 0 } } } });
  return L;
};
const comptes = (scenario) => [
  { id: 1, vinted_user_id: '111', login: 'compte_alpha', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ...(scenario === 'vieux' ? [{ id: 2, vinted_user_id: '222', login: 'compte_beta', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] : []),
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
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
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function rendre(b, { tel, sombre, scenario, tab }) {
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  const rows = [{ id: 'main', data: MAIN }, ...lignes(scenario)];
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(comptes(scenario));
    if (scenario === 'rien' && /id=eq\.(harvest_\d+_listings|lbc_listings|lbc_ventes|ebay_comptes|ebay_listings|vc_listings|vc_ventes)/.test(u)) return j({ message: 'panne inventée' }, 500);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data$|^data$/.test(sel) ? projette(r, sel) : { ...r, updated_at: new Date(AUJ).toISOString() });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.addInitScript(({ m, sombre }) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const k in m) localStorage.setItem(k, JSON.stringify(m[k])); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); } catch (_) {} }, { m: MAIN, sombre });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
}
const shot = async (pg, nom) => { if (process.env.SHOT) await pg.screenshot({ path: `${process.env.SHOT}-${nom}.png` }); };
const toucher = async (pg, tel, sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); if (tel) await l.tap(); else await l.click(); };
const finPage = async (pg, errs, t, quoi) => {
  const large = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  dit(large <= 1, `${t} : G — pas de défilement horizontal (${quoi})`, String(large));
  dit(errs.length === 0, `${t} : G — aucune erreur de page (${quoi})`, errs.join(' | ').slice(0, 300));
};
const lignesFeuille = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-pel-liste] [data-pel-ligne]')].map((el) => ({ n: el.getAttribute('data-pel-num'), j: el.getAttribute('data-pel-jours'), t: el.innerText.replace(/\s+/g, ' '), ou: !!el.querySelector('[data-pel-ou]') })));

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).split('\n')[0].slice(0, 300)); } };
  try {
    b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const tel of [false, true]) for (const sombre of [false, true]) {
      const t = `${tel ? '390 tactile' : '1512 souris'} ${sombre ? 'sombre' : 'clair'}`;
      const nomShot = (tel ? '390' : '1512') + (sombre ? '-sombre' : '-clair');
      await essaie(t + ' frais', async () => {
        const { ctx, pg, errs } = await rendre(b, { tel, sombre, scenario: 'frais', tab: 'journee' });
        await pg.waitForSelector('[data-pas-en-ligne]', { timeout: 30000 }).catch(() => {});
        const carte = await pg.evaluate(() => { const el = document.querySelector('[data-pas-en-ligne]'); return el ? { n: el.getAttribute('data-n'), t: el.innerText.replace(/\s+/g, ' '), nb: document.querySelectorAll('[data-pas-en-ligne]').length } : null; });
        dit(!!carte && carte.n === '36' && carte.nb === 1 && /36/.test(carte.t), `${t} : A — une carte « 36 achetés pas en ligne » (≥ 14 j, sans N°117)`, JSON.stringify(carte));
        await shot(pg, nomShot + '-journee');
        if (carte) {
          await toucher(pg, tel, '[data-pas-en-ligne]');
          await pg.waitForSelector('[data-feuille-pas-en-ligne] [data-pel="lu"]', { timeout: 15000 }).catch(() => {});
          const L = await lignesFeuille(pg);
          const nums = L.map((x) => x.n);
          dit(L.length === 36 && nums[0] === '150' && nums[35] === '114' && !nums.includes('117'), `${t} : B — 36 lignes, la plus ancienne d'abord, jamais N°117 (en ligne, même titre que toutes)`, `${L.length} : ${nums[0]} … ${nums[nums.length - 1]}`);
          const l150 = L.find((x) => x.n === '150') || {}, l120 = L.find((x) => x.n === '120') || {};
          dit(l150.ou && /Étagère banc/.test(l150.t) && /79/.test(l150.t) && l150.j === '50', `${t} : B — N°150 : sa case, son prix d'achat (79 €), 50 jours`, l150.t);
          dit(/49/.test(l120.t) && !l120.ou && l120.j === '20', `${t} : B — N°120 : 49 € et 20 jours, pas d'emplacement inventé`, l120.t);
          await shot(pg, nomShot + '-feuille');
          await toucher(pg, tel, '[data-pel-seuil="30"]');
          await pg.waitForFunction(() => { const el = document.querySelector('[data-pel="lu"]'); return el && el.getAttribute('data-pel-n') === '21'; }, null, { timeout: 8000 }).catch(() => {});
          const L30 = await lignesFeuille(pg);
          dit(L30.length === 21 && L30[0].n === '150' && L30[20].n === '130', `${t} : C — seuil 30 j : 21 lignes (N°150 … N°130)`, `${L30.length}`);
          await toucher(pg, tel, '[data-pel-liste] [data-pel-ligne] [data-pel-ouvrir="hors"]');
          await pg.waitForSelector('[data-achat-hors-form]', { timeout: 20000 }).catch(() => {});
          const form = await pg.evaluate(() => { const f = document.querySelector('[data-achat-hors-form]'); return f ? { edit: !!f.querySelector('[data-achat-hors-supprimer]'), num: [...f.querySelectorAll('input')].map((i) => i.value).join('|') } : null; });
          dit(!!form && form.edit && /\b150\b/.test(form.num), `${t} : D — « Ouvrir l'achat » ouvre CET achat (N°150) en modification`, JSON.stringify(form));
          await shot(pg, nomShot + '-achat-ouvert');
          // Seuil remis (réglage synchronisé : la passe suivante repart de 14).
          await pg.evaluate(() => { try { localStorage.removeItem('vrm_pas_en_ligne_seuil'); } catch (_) {} });
        }
        await finPage(pg, errs, t, 'frais');
        await ctx.close();
      });
      await essaie(t + ' vieux', async () => {
        const { ctx, pg, errs } = await rendre(b, { tel, sombre, scenario: 'vieux', tab: 'journee' });
        await pg.waitForSelector('[data-fu-gestes]', { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(3000);
        dit(!(await pg.$('[data-pas-en-ligne]')), `${t} : E — compte_beta pas relu : aucune carte dans Ma journée (rien de prouvé)`);
        await finPage(pg, errs, t, 'vieux journée');
        await ctx.close();
        const r2 = await rendre(b, { tel, sombre, scenario: 'vieux', tab: 'cat_achats' });
        await r2.pg.waitForSelector('[data-pel-entree]', { timeout: 30000 }).catch(() => {});
        const e = await r2.pg.evaluate(() => { const el = document.querySelector('[data-pel-entree]'); return el ? { n: el.getAttribute('data-pel-entree'), t: el.innerText.replace(/\s+/g, ' ') } : null; });
        dit(!!e && e.n === '0' && /36/.test(e.t), `${t} : E — Achats : l'entrée dit « 36 à confirmer », 0 prouvé`, JSON.stringify(e));
        if (e) {
          await toucher(r2.pg, tel, '[data-pel-entree]');
          await r2.pg.waitForSelector('[data-feuille-pas-en-ligne] [data-pel-confirmer]', { timeout: 15000 }).catch(() => {});
          const c = await r2.pg.evaluate(() => { const el = document.querySelector('[data-pel="lu"]'); const m = [...document.querySelectorAll('[data-pel-manque]')].map((x) => x.getAttribute('data-pel-manque') + ':' + x.innerText); return el ? { n: el.getAttribute('data-pel-n'), ac: el.getAttribute('data-pel-a-confirmer'), m } : null; });
          dit(!!c && c.n === '0' && c.ac === '36' && c.m.some((x) => /^vieille:.*compte_beta.*3/.test(x)), `${t} : E — 36 à confirmer, « compte_beta pas relu depuis 3 j » nommé`, JSON.stringify(c));
          await shot(r2.pg, nomShot + '-a-confirmer');
        }
        await finPage(r2.pg, r2.errs, t, 'vieux achats');
        await r2.ctx.close();
      });
      await essaie(t + ' rien', async () => {
        const { ctx, pg, errs } = await rendre(b, { tel, sombre, scenario: 'rien', tab: 'cat_achats' });
        await pg.waitForSelector('[data-achats-hors]', { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(3000);
        dit(!(await pg.$('[data-pel-entree]')), `${t} : F — annonces pas lues : aucune entrée (rien d'inventé)`);
        await finPage(pg, errs, t, 'rien');
        await ctx.close();
      });
    }
  } finally {
    if (b) await b.close();
    srv.close();
    console.log(ko ? `\n${ko} contrôle(s) rouge(s)` : '\nTout est vert');
    process.exit(ko ? 1 : 0);
  }
})();
