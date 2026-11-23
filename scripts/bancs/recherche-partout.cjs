// ═══════════════════════════════════════════════════════════════════════════
// BANC : LA RECHERCHE PARTOUT (21 nov., choix n° 15 de Julien)
//        (node scripts/bancs/recherche-partout.cjs — après le build)
//        BANC_PORT=… · BANC_DIST=… · SHOTS=dossier des captures (à REGARDER)
// ═══════════════════════════════════════════════════════════════════════════
// L'app ENTIÈRE (dist/), une base INVENTÉE servie par le banc (la forme de `app_data` : `select=` projeté, `meta->>`,
// `id=eq.`/`like.`/`in.`, `Range`) : 2 000 ventes, 1 500 achats, 1 200 fiches N° (dont 50 au MÊME titre), 300 colis.
// À 390 px tactile et 1512 px, en clair et en sombre, il exige :
//   N  « 7 » : le N°7 (bloc « Tout sur le N° »), et AUCUNE autre paire par son N° (ni 70, ni 17, ni 107, ni 1007) ;
//      « 23 » parmi les 50 paires au même titre : le N°23 seul ;
//   F  « addidas » trouve les Adidas, chaque ligne « à une lettre près » ; « nkie dunk » trouve la Nike Dunk ; un code de
//      retrait à une lettre près ne trouve rien ;
//   L  chaque ligne d'une vente, d'un achat, d'une paire porte le logo de SON site (Vinted ici) ;
//   D  le design : rangées fines (aucun coin arrondi ni bordure de carte), intertitres sans capitales, lignes ≥ 44 px,
//      aucun débordement, aucune erreur de page ; ⌘K (ordinateur) ouvre la recherche, la loupe du haut (téléphone) aussi.
// Sur le build d'avant (origin, sans ce lot) il ROUGIT : « 7 » montre 70, 17, 107… ; « addidas » ne trouve rien ; aucun logo.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData, metaDe, filtreData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4795;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-recherche-partout');
fs.mkdirSync(SHOTS, { recursive: true });

const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const MARQUES = ['Nike', 'Adidas', 'Salomon', 'Asics', 'New Balance', 'Puma'];
const MODELES = ['Dunk Low', 'Samba OG', 'XT-6', 'Gel-Kayano 14', '550', 'Speedcat'];
const prix = (i) => ({ amount: String(60 + (i % 90)) + '.0', currency_code: 'EUR' });
const T = 'Nike Air Force 1 blanche taille 42';
const VENTES = Array.from({ length: 2000 }, (_, i) => ({ transaction_id: 22000000000 + i, title: `${MARQUES[i % 6]} ${MODELES[i % 6]} taille ${36 + (i % 10)}`, status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYaH(200 + i), price: prix(i) }));
const ACHATS = Array.from({ length: 1500 }, (_, i) => ({ transaction_id: 23000000000 + i, title: `Achat ${MARQUES[(i + 2) % 6]} ${MODELES[(i + 1) % 6]}`, status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYaH(300 + i), price: prix(i + 7) }));
const NUMEROS = {};
// Les N° 1 à 1 200 ; les N° 101 à 150 portent le MÊME titre (50 paires identiques).
for (let i = 1; i <= 1200; i++) NUMEROS['it' + i] = { numero: String(i), title: i > 100 && i <= 150 ? T : `${MARQUES[i % 6]} ${MODELES[i % 6]} taille ${36 + (i % 10)}`, price: String(30 + (i % 50)), accountId: '111' };
const ITEMS = [];
for (let i = 1; i <= 300; i++) ITEMS.push({ id: 'it' + i, title: NUMEROS['it' + i].title, brand: MARQUES[i % 6], size: String(36 + (i % 10)), price: { amount: String(30 + (i % 50)) + '.0' }, is_closed: false, is_hidden: false, is_draft: false });
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const EMAILS = [
  ...Array.from({ length: 300 }, (_, i) => ({ id: 'email_track_' + i, data: { type: 'suivi', suivi: 'MR' + (7000000 + i), code: String(500000 + i), status: i === 123 ? 'available' : 'delivered', sens: 'entrant', artTitle: `Colis ${MARQUES[i % 6]}`, carrier: 'mondialrelay', lieu: 'Tabac du port, 1 rue du Port, 35260 Cancale', receivedAt: ilYaH(i === 123 ? 3 : 100 + i) } })),
];
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: NUMEROS, vinted_used_numeros: Array.from({ length: 1200 }, (_, i) => i + 1), vinted_dark: false } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), nItems: VENTES.length, payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: ilYaH(0.2), nItems: ACHATS.length, payload: { my_orders: ACHATS } } },
  { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
  ...EMAILS,
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (!c) ko++; else ok++; console.log((c ? 'OK  ' : 'KO  ') + m + (!c && d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 300)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc avec BANC_PORT'); process.exit(1); });
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
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
const motif = (p) => new RegExp('^' + p.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');

async function preparer(b, vp, { sombre = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}) });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ s }) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (s) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, { s: sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
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
    if (lk) { const re = motif(lk[1]), garde = filtreData(u); let l = ROWS.filter((r) => re.test(r.id) && garde(r)); const rg = req.headers()['range']; if (rg) { const m = /(\d+)-(\d+)/.exec(rg); if (m) l = l.slice(+m[1], +m[2] + 1); } return j(l.map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/email-rattacher\?mode=journal/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: 0, parPage: 20, suite: false, emails: [], compteurs: { sur: 0, plus: false, integre: 0, aVerifier: 0, erreur: 0, incompris: 0, parRubrique: {} }, adresses: [], cherche: '' }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  return { ctx, pg, errs };
}
// La frappe, posée comme React la lit, puis l'attente du groupe voulu (ou 2,5 s).
const taper = async (pg, q, sel) => {
  await pg.evaluate((q) => { const el = document.querySelector('[data-recherche-champ]'); const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; poser.call(el, q); el.dispatchEvent(new Event('input', { bubbles: true })); }, q);
  try { await pg.waitForSelector(`[data-recherche-q="${q.trim().toLowerCase()}"] ${sel || ''}`.trim(), { timeout: 4000 }); } catch (_) {}
  await pg.waitForTimeout(450);
};
const lire = (pg) => pg.evaluate(() => {
  const L = [...document.querySelectorAll('[data-recherche-resultat]')].filter((x) => x.getClientRects().length);
  const cs = (e) => getComputedStyle(e);
  return {
    r: L.map((x) => ({ type: x.getAttribute('data-recherche-resultat'), par: x.getAttribute('data-recherche-par'), num: x.getAttribute('data-recherche-num'), cle: x.getAttribute('data-recherche-cle'),
      logo: (x.querySelector('[data-recherche-logo]') || {}).getAttribute ? x.querySelector('[data-recherche-logo]').getAttribute('data-recherche-logo') : null,
      approx: !!x.querySelector('[data-recherche-approx]'), h: Math.round(x.getBoundingClientRect().height), rayon: parseFloat(cs(x).borderTopLeftRadius) || 0, bord: parseFloat(cs(x).borderTopWidth) || 0 })),
    tout: document.querySelector('[data-tout-num]') ? document.querySelector('[data-tout-num]').getAttribute('data-tout-num') : null,
    capitales: [...document.querySelectorAll('[data-recherche-entete]')].filter((e) => cs(e).textTransform === 'uppercase').length,
    entetes: document.querySelectorAll('[data-recherche-entete]').length,
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
});
const ouvrirLoupe = async (pg, tel) => {
  if (tel) await pg.locator('button[data-recherche-loupe]').first().tap();
  else { await pg.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {}); await pg.keyboard.press('Meta+k'); }
  for (let i = 0; i < 60; i++) { if (await pg.evaluate(() => { const p = document.querySelector('[data-recherche-panneau]'); return !!(p && p.getAttribute('data-recherche-pret') === '1'); })) break; await pg.waitForTimeout(250); }
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const tours = [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false], [{ width: 1512, height: 950 }, true]];
    for (const [vp, sombre] of tours) {
      const tel = vp.width < 600; const TT = `[${vp.width}${sombre ? ' sombre' : ''}]`; const suf = `${vp.width}${sombre ? '-sombre' : ''}`;
      console.log(`── ${vp.width} px${sombre ? ' · sombre' : ''}`);
      const { ctx, pg, errs } = await preparer(b, vp, { sombre });
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(3000);
      await essaie('ouverture', async () => {
        await ouvrirLoupe(pg, tel);
        const pret = await pg.evaluate(() => !!document.querySelector('[data-recherche-panneau][data-recherche-pret="1"]'));
        dit(pret, `${TT} D la recherche s’ouvre (${tel ? 'la loupe du haut' : '⌘K'})`);
      });
      await essaie('N', async () => {
        await taper(pg, '7', '[data-tout-num]');
        let x = await lire(pg);
        const autres = x.r.filter((r) => r.type === 'paire' && r.par === 'numero' && r.num !== '7').map((r) => r.num);
        const contenant = x.r.filter((r) => r.type === 'paire' && /7/.test(r.num || '') && r.num !== '7').map((r) => r.num);
        dit(x.tout === '7' && autres.length === 0 && contenant.length === 0, `${TT} N « 7 » : le N°7, aucune autre paire (ni 70, 17, 107, 1007…)`, JSON.stringify({ tout: x.tout, autres: contenant.slice(0, 8) }));
        await pg.screenshot({ path: path.join(SHOTS, `recherche-7-${suf}.png`) });
        await taper(pg, '123', '[data-tout-num]');
        x = await lire(pg);
        const c123 = x.r.filter((r) => r.type === 'paire' && r.num !== '123' && /123/.test(r.num || '')).map((r) => r.num);
        dit(x.tout === '123' && c123.length === 0, `${TT} N « 123 » (parmi les 50 paires au même titre, N°101–150) : le N°123 seul, jamais 1123 ni 1230`, JSON.stringify(c123.slice(0, 6)));
      });
      await essaie('F', async () => {
        await taper(pg, 'addidas', '[data-recherche-resultat]');
        let x = await lire(pg);
        const p = x.r.filter((r) => r.type === 'paire' || r.type === 'vente' || r.type === 'achat');
        dit(p.length > 0 && p.every((r) => r.approx), `${TT} F « addidas » : ${p.length} résultats, chacun « à une lettre près »`, JSON.stringify(p.slice(0, 3)));
        await pg.screenshot({ path: path.join(SHOTS, `recherche-addidas-${suf}.png`) });
        dit(x.r.length > 0 && x.r.filter((r) => ['paire', 'vente', 'achat', 'annonce'].includes(r.type)).every((r) => r.logo === 'vinted'), `${TT} L chaque vente, achat, paire porte le logo de SON site`, JSON.stringify(x.r.filter((r) => r.logo !== 'vinted').slice(0, 3)));
        dit(x.capitales === 0 && x.entetes > 0, `${TT} D intertitres sans capitales (${x.entetes})`, String(x.capitales));
        dit(x.r.every((r) => r.rayon === 0 && r.bord === 0), `${TT} D rangées fines : aucun coin arrondi, aucune bordure de carte`, JSON.stringify(x.r.filter((r) => r.rayon || r.bord).slice(0, 2)));
        dit(x.r.every((r) => r.h >= 43.5) && x.sw <= x.cw + 1, `${TT} D lignes ≥ 44 px, aucun débordement`, JSON.stringify({ h: Math.min(...x.r.map((r) => r.h)), sw: x.sw, cw: x.cw }));
        await taper(pg, 'nkie dunk', '[data-recherche-resultat]');
        x = await lire(pg);
        dit(x.r.some((r) => (r.type === 'paire' || r.type === 'vente') && r.approx), `${TT} F « nkie dunk » ⇒ les Nike Dunk, à une lettre près`, JSON.stringify(x.r.slice(0, 2)));
        await taper(pg, '500124X', '');
        x = await lire(pg);
        dit(!x.r.some((r) => r.type === 'colis' || r.type === 'retrait'), `${TT} F un code de retrait mal tapé ne trouve AUCUN colis`, JSON.stringify(x.r.slice(0, 2)));
        await taper(pg, '500123', '[data-recherche-resultat]');
        x = await lire(pg);
        dit(x.r.some((r) => r.cle === 'colis:MR7000123' && r.par === 'code'), `${TT} le bon code de retrait ⇒ SON colis`, JSON.stringify(x.r.slice(0, 2)));
        await pg.screenshot({ path: path.join(SHOTS, `recherche-code-${suf}.png`) });
      });
      dit(errs.length === 0, `${TT} aucune erreur de page`, errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a pu tourner', String(e && e.message).slice(0, 300)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
