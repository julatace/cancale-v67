// Banc : LES VENTES ET ACHATS FLOUTÉS, REGROUPÉS PAR COMPTE (11 nov., 22 h 10 — Julien : « les ventes ne
// sont pas regroupées et donc ce n'est pas très lisible : peux-tu regrouper ça mieux »).
//
// Données INVENTÉES (le dépôt est public) : 3 comptes Vinted (compte_a 111, compte_b 222, compte_c 333),
// 50 ventes et 12 achats mêlés dans le temps. L'extension (faux pont, vraie forme de `etat`) est connectée
// sur compte_a. Ce qui est jugé, sur l'app RENDUE (390 px tactile et 1512 px, clair et sombre) :
//   1. Ventes : l'en-tête du compte ouvert vient EN PREMIER (`data-groupe-compte="ouvert"`), ses lignes
//      nettes, rangées par date ; puis « Autres comptes » et UNE rangée REPLIÉE par autre compte ;
//      les nombres des en-têtes + les lignes nettes = toutes les ventes (rien ne disparaît) ; le nombre de
//      « N résultats » ne change pas ; déplier un compte montre SES lignes, estompées (flou), par date.
//   2. Achats : la même règle.
//   3. « Tous les comptes » (pas de compte mis en avant) : aucun en-tête, la liste comme avant.
//   4. Son choix (compte_b) ≠ le compte de Chrome (compte_a) : l'en-tête dit « Compte choisi : compte_b »
//      et propose « Chrome : compte_a » ; le flou et les groupes suivent la MÊME règle.
// Juge des `data-*` et des nombres rendus, jamais un libellé (sauf le nom du compte, une identité).
// `SHOTS=dossier` : les captures à regarder. `BANC_PORT` (défaut 5791). `BANC_DIST` : un autre dist/.
require('./_porte-banc.cjs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.env.BANC_DIST ? path.resolve(process.env.BANC_DIST) : path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 5791;
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : path.join(os.tmpdir(), 'regroupe-comptes');
fs.mkdirSync(SHOTS, { recursive: true });

const auj = Date.now();
const iso = (h) => new Date(auj - h * 3600e3).toISOString();
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 3, vinted_user_id: '333', login: 'compte_c', domain: 'www.vinted.fr', updated_at: iso(0) },
];
const UIDS = ['111', '222', '333'];
const MODELES = ['Nike Dunk Low', 'Adidas Samba', 'Asics Gel 1130', 'New Balance 550', 'Salomon XT-6', 'Puma Suede'];
// 50 ventes : le compte change d'une ligne à l'autre (mêlées), les heures toutes différentes.
const VENTES = { 111: [], 222: [], 333: [] };
for (let i = 0; i < 50; i++) {
  const uid = UIDS[(i * 7 + (i >> 2)) % 3];
  VENTES[uid].push({ transaction_id: 7000 + i, title: `${MODELES[i % 6]} banc ${i}`, price: { amount: String(20 + (i % 9) * 5) + '.0', currency_code: 'EUR' },
    status: 'Commande finalisée', date: iso(3 + i * 11) });
}
const ACHATS = { 111: [], 222: [], 333: [] };
for (let i = 0; i < 12; i++) {
  const uid = UIDS[(i * 5 + 1) % 3];
  ACHATS[uid].push({ transaction_id: 9000 + i, title: `Achat banc ${i}`, price: { amount: String(15 + i) + '.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: iso(5 + i * 13) });
}
const LIGNES = [
  ...UIDS.map((u) => ({ id: `harvest_${u}_orders_sold`, data: { capturedAt: iso(0), payload: { my_orders: VENTES[u] } } })),
  ...UIDS.map((u) => ({ id: `harvest_${u}_orders_purchased`, data: { capturedAt: iso(0), payload: { my_orders: ACHATS[u] } } })),
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (!c && d ? ' — ' + d : '')); };
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
    out[alias] = v == null ? null : v;
  }
  return out;
};
// Le pont, dans la vraie forme de `etat` (le cookie Vinted) et `authEtat` (la session VRM).
const PONT = ({ chrome }) => {
  const version = '5.163.0';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'authEtat') post({ __vmr: 'authEtat:result', reqId: d.reqId, etat: { ok: true, connecte: true, expiree: false, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', cloisonne: false } });
    if (d.__vmr === 'etat') {
      const lo = { 111: 'compte_a', 222: 'compte_b', 333: 'compte_c' };
      post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' },
        vinted: chrome ? { uid: String(chrome), login: lo[chrome] || '' } : null, cmds: {} } });
    }
  });
  post({ __vmr: 'ready', version });
};

async function rendre(b, { chrome = '111', tel = false, onglet = 'cat_ventes', sombre = false, choix = null } = {}) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ sombre, choix }) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
    if (choix) localStorage.setItem('vrm_choix_comptes', JSON.stringify({ vinted: { valeur: choix, at: Date.now() } }));
  } catch (_) {} }, { sombre, choix });
  await pg.addInitScript(PONT, { chrome });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/"/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"erreur":"pas-su"}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5000);
  return { ctx, pg, errs };
}

// Ce que l'écran montre : les en-têtes de groupe, les lignes (identité + flou), dans l'ordre du document.
const lire = (pg, attrLigne) => pg.evaluate((attr) => {
  const out = [];
  const flou = (el) => { for (let x = el; x && x !== document.body; x = x.parentElement) if (/blur/.test(getComputedStyle(x).filter)) return true; return false; };
  for (const el of document.querySelectorAll(`[data-groupe-compte], [${attr}]`)) {
    if (el.hasAttribute('data-groupe-compte')) out.push({ g: el.getAttribute('data-groupe-compte'), n: Number(el.getAttribute('data-groupe-n')), id: el.getAttribute('data-groupe-compte-id'), ouvert: el.getAttribute('aria-expanded'), txt: el.innerText.replace(/\s+/g, ' ').trim(), h: el.getBoundingClientRect().height });
    else out.push({ l: el.getAttribute(attr), flou: flou(el) });
  }
  const res = document.querySelector('.vrm-mobile-resultats, [data-fu-resultats]');
  return { out, resultats: res ? res.innerText : '', large: document.documentElement.scrollWidth, vue: window.innerWidth };
}, attrLigne);
const deplier = (pg) => pg.evaluate(() => { const bs = [...document.querySelectorAll('[data-groupe-compte="compte"][aria-expanded="false"]')]; bs.forEach((b) => b.click()); return bs.length; });
const uidDe = (tx, T) => UIDS.find((u) => T[u].some((o) => String(o.transaction_id) === String(tx)));
const dateDe = (tx, T) => { for (const u of UIDS) { const o = T[u].find((x) => String(x.transaction_id) === String(tx)); if (o) return Date.parse(o.date); } return NaN; };
const decroissant = (txs, T) => txs.every((t, i) => i === 0 || dateDe(txs[i - 1], T) >= dateDe(t, T));

async function juger(b, { nom, onglet, attr, T, total, tel, sombre }) {
  const r = await rendre(b, { onglet, tel, sombre });
  const a = await lire(r.pg, attr);
  const tetes = a.out.filter((x) => x.g);
  const lignes = a.out.filter((x) => x.l);
  const ouvert = tetes.find((x) => x.g === 'ouvert');
  const comptes = tetes.filter((x) => x.g === 'compte');
  dit(a.out[0] && a.out[0].g === 'ouvert' && /compte_a/.test(ouvert.txt), `${nom} : l'en-tête du compte ouvert (compte_a) vient EN PREMIER`, JSON.stringify(a.out.slice(0, 2)));
  const nA = T['111'].length;
  dit(ouvert && ouvert.n === nA && lignes.length === nA && lignes.every((x) => uidDe(x.l, T) === '111' && !x.flou), `${nom} : ses ${nA} lignes, nettes, sous son en-tête`, `${ouvert && ouvert.n} / ${lignes.length}`);
  dit(decroissant(lignes.map((x) => x.l), T), `${nom} : ordre par date gardé dans le groupe`);
  dit(comptes.length === 2 && comptes.every((x) => x.ouvert === 'false') && comptes.map((x) => x.id).sort().join() === '222,333', `${nom} : un groupe REPLIÉ par autre compte`, JSON.stringify(comptes));
  const autres = tetes.find((x) => x.g === 'autres');
  dit(autres && autres.n === total - nA && comptes.reduce((s, x) => s + x.n, 0) + nA === total, `${nom} : les nombres couvrent toutes les lignes (${total}) — rien ne disparaît`, JSON.stringify({ autres: autres && autres.n, comptes: comptes.map((x) => x.n) }));
  if (tel) dit(comptes.every((x) => x.h >= 44), `${nom} : rangées de compte ≥ 44 px au doigt`, JSON.stringify(comptes.map((x) => x.h)));
  dit(a.large <= a.vue + 1, `${nom} : aucun débordement`, `${a.large} > ${a.vue}`);
  const tag = `${onglet}-${tel ? 390 : 1512}-${sombre ? 'sombre' : 'clair'}`;
  const voir = (sel) => r.pg.evaluate((q) => { const e = document.querySelector(q) || document.querySelector('.vrm-ventes-liste, .vrm-buy-list'); if (e) e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); }, sel);
  await voir('[data-groupe-compte="ouvert"]'); await r.pg.waitForTimeout(300);
  await r.pg.screenshot({ path: path.join(SHOTS, `${tag}-replie.png`), fullPage: false });
  await voir('[data-groupe-compte="autres"]'); await r.pg.waitForTimeout(300);
  await r.pg.screenshot({ path: path.join(SHOTS, `${tag}-replie-bas.png`), fullPage: false });
  await deplier(r.pg); await r.pg.waitForTimeout(400);
  const d = await lire(r.pg, attr);
  const toutes = d.out.filter((x) => x.l);
  dit(toutes.length === total && new Set(toutes.map((x) => x.l)).size === total, `${nom} : déplié, ${total} lignes, aucune en double`, String(toutes.length));
  const parCompte = (u) => toutes.filter((x) => uidDe(x.l, T) === u);
  dit(['222', '333'].every((u) => parCompte(u).every((x) => x.flou) && decroissant(parCompte(u).map((x) => x.l), T)), `${nom} : les autres comptes, estompés, par date`);
  // Chaque ligne d'un autre compte sous l'en-tête de SON compte.
  let cur = null, bien = true;
  for (const x of d.out) { if (x.g === 'compte') cur = x.id; else if (x.g === 'ouvert') cur = '111'; else if (x.l && cur && uidDe(x.l, T) !== cur) bien = false; }
  dit(bien, `${nom} : chaque ligne sous l'en-tête de SON compte`);
  await voir('[data-groupe-compte="autres"]'); await r.pg.waitForTimeout(300);
  await r.pg.screenshot({ path: path.join(SHOTS, `${tag}-deplie.png`), fullPage: false });
  dit(r.errs.length === 0, `${nom} : aucune erreur d'app`, r.errs.join(' | ').slice(0, 200));
  await r.ctx.close();
}

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); } };
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const totV = UIDS.reduce((s, u) => s + VENTES[u].length, 0), totA = UIDS.reduce((s, u) => s + ACHATS[u].length, 0);
    for (const [tel, sombre] of [[false, false], [true, false], [true, true], [false, true]]) {
      console.log(`── Ventes · ${tel ? '390 tactile' : '1512'} · ${sombre ? 'sombre' : 'clair'}`);
      await essaie('ventes', () => juger(b, { nom: 'Ventes', onglet: 'cat_ventes', attr: 'data-tx', T: VENTES, total: totV, tel, sombre }));
    }
    for (const [tel, sombre] of [[false, false], [true, true]]) {
      console.log(`── Achats · ${tel ? '390 tactile' : '1512'} · ${sombre ? 'sombre' : 'clair'}`);
      await essaie('achats', () => juger(b, { nom: 'Achats', onglet: 'achats', attr: 'data-achat-tx', T: ACHATS, total: totA, tel, sombre }));
    }
    console.log('── « Tous les comptes » : aucun regroupement, la liste comme avant');
    await essaie('tous', async () => {
      const r = await rendre(b, { chrome: null });
      const a = await lire(r.pg, 'data-tx');
      const lignes = a.out.filter((x) => x.l);
      dit(!a.out.some((x) => x.g) && lignes.length === totV && lignes.every((x) => !x.flou) && decroissant(lignes.map((x) => x.l), VENTES), 'pas de compte mis en avant (pas su) ⇒ aucun en-tête, 50 lignes par date, rien d’estompé', JSON.stringify({ g: a.out.filter((x) => x.g).length, n: lignes.length }));
      await r.ctx.close();
    });
    console.log('── Son choix (compte_b) ≠ le compte de Chrome (compte_a)');
    await essaie('choix', async () => {
      const r = await rendre(b, { chrome: '111', choix: '222' });
      // Le choix est mémorisé par site : on le pose par la rangée de puces, comme lui.
      await r.pg.evaluate(() => { const p = document.querySelector('[data-compte-puce="222"]'); if (p) p.click(); });
      await r.pg.waitForTimeout(800);
      const a = await lire(r.pg, 'data-tx');
      const t = a.out.find((x) => x.g === 'ouvert');
      const lignes = a.out.filter((x) => x.l);
      dit(t && /compte_b/.test(t.txt) && lignes.length === VENTES['222'].length && lignes.every((x) => uidDe(x.l, VENTES) === '222' && !x.flou), 'le groupe de tête est celui que le flou laisse net (compte_b), et le dit', JSON.stringify(t));
      const g = await r.pg.evaluate(() => { const x = document.querySelector('[data-groupe-chrome]'); return x ? x.getAttribute('data-groupe-chrome') : null; });
      dit(g === '111', 'l’en-tête propose le compte ouvert dans Chrome (compte_a)', String(g));
      await r.pg.screenshot({ path: path.join(SHOTS, 'choix-different-1512.png') });
      await r.pg.evaluate(() => document.querySelector('[data-groupe-chrome]') && document.querySelector('[data-groupe-chrome]').click());
      await r.pg.waitForTimeout(800);
      const a2 = await lire(r.pg, 'data-tx');
      const t2 = a2.out.find((x) => x.g === 'ouvert');
      dit(t2 && /compte_a/.test(t2.txt), 'un toucher passe au compte de Chrome', JSON.stringify(t2));
      await r.ctx.close();
    });
  } finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} regroupe-comptes : ${ko} rouge(s) · captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
