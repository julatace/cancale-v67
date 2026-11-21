// ═══════════════════════════════════════════════════════════════════════════
// BANC : UNE VENTE RETOURNÉE REVIENT EN STOCK SOUS SON N°, SANS RIEN SAISIR
//        (13 nov., point 29 de Julien)
//        npm run build && BANC_PORT=… node scripts/bancs/retour-stock-auto.cjs
//        BANC_DIST=… pour un autre build · SHOTS=dossier pour les captures
// ═══════════════════════════════════════════════════════════════════════════
// Ventes INVENTÉES à la forme mesurée dans sa base le 13 nov. (transaction 440 « Retour
// initié », vente « Remboursement effectué » `failed` ; annulation 500 « article
// indisponible » remboursée elle aussi). Le dépôt est public : aucune vraie donnée.
//   9401  retour REMBOURSÉ, transaction → annonce i90 → N°90, jamais noté reçu
//         ⇒ en stock TOUT SEUL sous le N°90, « Retour du <date lue> — à vérifier et remettre
//           en ligne », « Remettre en ligne » (son clic) ; rien d'écrit ; N°90 présent
//   9402  retour EN ROUTE (colis déposé), annonce i91 → N°91
//         ⇒ « Retour en route », PAS en stock (N°91 absent des paires présentes)
//   9403  retour REMBOURSÉ sans annonce reliée, MÊME TITRE que 9401
//         ⇒ en stock « à numéroter », jamais le N°90 par le titre
//   9404  annulation « article indisponible » (500) remboursée ⇒ pas un retour : rien
//   9405  même titre que 9401, vente finalisée (annonce i92, N°92) ⇒ pas un retour
//   9406  retour REMBOURSÉ, annonce i93 → N°93 ; une AUTRE annonce EN LIGNE porte le N°93 (un N°
//         n'est jamais réattribué : c'est la paire, déjà remise en ligne) ⇒ pas en stock une 2e fois
// Puis le Stock (?tab=garage) : « Un/N articles revenus d'un retour » avec le N°90 et son
// libellé, le N°90 « À ranger » (marqué Retour), le sans-N° compté « à numéroter ».
// Jugé sur des data-* (jamais un libellé seul), 390 px tactile et 1512 px.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4391;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-retour-stock-auto');
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const T = 'Golf Retour taille 41';
const prix = (n) => ({ amount: String(n) + '.0', currency_code: 'EUR' });
const VENTES = [
  { transaction_id: 9401, title: T, status: 'Remboursement effectué', transaction_user_status: 'failed', date: ilYaH(240), price: prix(60), photo: { url: 'https://images1.vinted.net/t/x/f800/i90.jpeg' } },
  { transaction_id: 9402, title: 'Hotel Retour taille 42', status: 'Commande livrée ! ', transaction_user_status: 'needs_action', date: ilYaH(150), price: prix(70) },
  { transaction_id: 9403, title: T, status: 'Remboursement effectué', transaction_user_status: 'failed', date: ilYaH(260), price: prix(60) },
  { transaction_id: 9404, title: 'India Annulee taille 40', status: 'Remboursement effectué', transaction_user_status: 'failed', date: ilYaH(200), price: prix(50) },
  { transaction_id: 9405, title: T, status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: ilYaH(300), price: prix(60) },
  { transaction_id: 9406, title: 'Juliett Retour taille 43', status: 'Remboursement effectué', transaction_user_status: 'failed', date: ilYaH(230), price: prix(80) },
];
const SU_9401 = ilYaH(96);   // la date posée par Vinted sur la transaction de retour (lue)
const TXN = [
  { tx: 9401, item: 'i90', s: 440, ss: '', su: SU_9401 },
  { tx: 9402, item: 'i91', s: 440, ss: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais", su: ilYaH(60) },
  { tx: 9403, item: null, s: 440, ss: '', su: ilYaH(100) },
  { tx: 9404, item: 'i94', s: 500, ss: '', su: ilYaH(190) },
  { tx: 9405, item: 'i92', s: 450, ss: 'Commande livrée ! ', su: ilYaH(280) },
  { tx: 9406, item: 'i93', s: 440, ss: '', su: ilYaH(110) },
];
const NUMEROS = {
  i90: { numero: '90', title: T, auto: false }, i92: { numero: '92', title: T, auto: false },
  i91: { numero: '91', title: 'Hotel Retour taille 42' }, i93: { numero: '93', title: 'Juliett Retour taille 43' },
  a93b: { numero: '93', title: 'Juliett bis en ligne' }, i94: { numero: '94', title: 'India Annulee taille 40' },
};
const ITEMS = [
  { id: 'a93b', title: 'Juliett bis en ligne', price: prix(82), is_closed: false, is_hidden: false, is_draft: false, user: { id: 111 }, photo: { url: 'https://images1.vinted.net/t/x/f800/a93b.jpeg' } },
];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: NUMEROS, vinted_used_numeros: [90, 91, 92, 93, 94], vrm_meubles: [{ id: 'mA', name: 'Étagère banc', cols: 4, rows: 2 }], vrm_slots: {} } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
  ...TXN.map((t) => ({ id: `harvest_111_txn_${t.tx}`, data: { capturedAt: ilYaH(1), payload: { transaction: { id: t.tx, ...(t.item ? { item_id: t.item } : {}), status: t.s, status_updated_at: t.su, shipment: { status_title: t.ss } } } } })),
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 600)); } };

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

async function preparer(b, vp) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { try { ecrits.push(req.postData() || ''); } catch (_) {} return j([]); }
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ecrits };
}
async function sain(pg, ecran) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
}
const lire = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-retours-encours] [data-retour]')].map((x) => ({
  cle: x.getAttribute('data-retour'), etape: x.getAttribute('data-retour-etape'), num: x.getAttribute('data-retour-num'),
  auto: x.getAttribute('data-retour-auto'), aNum: x.getAttribute('data-retour-a-numeroter'), date: x.getAttribute('data-retour-date'),
  lib: (x.querySelector('[data-retour-libelle]') || {}).innerText || '', enLigne: !!x.querySelector('[data-remettre-en-ligne]'), txt: x.innerText })));
const cartes = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-retour-carte]')].map((x) => ({ cle: x.getAttribute('data-retour-carte'), num: x.getAttribute('data-retour-num'), etape: x.getAttribute('data-retour-etape') })));
const lu = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
const ouvrirEnvoyes = async (pg) => { await pg.waitForSelector('[data-colis-onglet-choix="envoyes"]', { timeout: 15000 }).catch(() => {}); await pg.click('[data-colis-onglet-choix="envoyes"]').catch(() => {}); await pg.waitForTimeout(800); };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const { ctx, pg, errs, ecrits } = await preparer(b, vp);
      await essaie('Colis', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await ouvrirEnvoyes(pg);
        await pg.waitForSelector('[data-retours-encours]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(2500);
        const L = await lire(pg); const g = (c) => L.find((l) => l.cle === c) || null;
        const l1 = g('9401');
        dit(l1 && l1.etape === 'remis' && l1.num === '90' && l1.auto === '1', '9401 remboursé : en stock TOUT SEUL sous SON N° (90)', JSON.stringify(l1));
        dit(l1 && l1.date === SU_9401.slice(0, 10) && /^Retour du /.test(l1.lib) && /à vérifier et remettre en ligne/.test(l1.lib), '9401 : « Retour du <date lue> — à vérifier et remettre en ligne »', JSON.stringify(l1 && { d: l1.date, lib: l1.lib }));
        dit(l1 && l1.enLigne, '9401 : le geste « Remettre en ligne »', JSON.stringify(l1));
        const cs = await cartes(pg);
        dit(cs.some((c) => c.cle === '9402' && c.etape === 'en-route') && !g('9402'), '9402 en route : « Retour en route », pas en stock', JSON.stringify({ cs, l: g('9402') }));
        const l3 = g('9403');
        dit(l3 && l3.etape === 'remis' && l3.aNum === '1' && l3.num === '', '9403 sans annonce reliée (même titre que 9401) : en stock « à numéroter », aucun N° deviné', JSON.stringify(l3));
        dit(!g('9404') && !cs.some((c) => c.cle === '9404'), '9404 annulation remboursée (500) : pas un retour, rien');
        dit(!g('9405') && !cs.some((c) => c.cle === '9405'), '9405 finalisée au même titre : pas un retour');
        // Un N° n'est jamais réattribué (§5) : l'annonce EN LIGNE qui porte le N°93 est cette paire, déjà remise en ligne.
        const l6 = g('9406');
        const envoyes = await pg.evaluate(() => [...document.querySelectorAll('[data-colis-envoye]')].map((x) => x.getAttribute('data-colis-envoye') + ' ' + (x.getAttribute('data-colis-ident') || '')));
        dit(!envoyes.some((c) => /940[1-6]/.test(String(c))), 'aucune vente retournée n’est redite dans la liste des colis envoyés', JSON.stringify(envoyes));
        dit(!l6 && !cs.some((c) => c.cle === '9406'), '9406 : son N°93 est déjà porté par une annonce EN LIGNE (la paire remise en ligne) ⇒ pas « en stock » une seconde fois', JSON.stringify(l6));
        await pg.waitForTimeout(1500);
        const phys = await lu(pg, 'vinted_nums_physiques');
        const nums = phys && Array.isArray(phys.nums) ? phys.nums.map(String) : [];
        dit(nums.includes('90') && !nums.includes('91') && !nums.includes('92') && !nums.includes('94'), 'paires présentes : le N°90 revenu y est, ni le 91 (en route), ni le 92 (finalisée), ni le 94 (annulée)', JSON.stringify(nums));
        dit(phys && Array.isArray(phys.retours) && phys.retours.map((a) => a.numero).join(',') === '90' && phys.retoursANumeroter === 1, 'publié pour le Stock : le N°90 revenu, et un « à numéroter »', JSON.stringify(phys && { r: phys.retours, n: phys.retoursANumeroter }));
        const remis = await lu(pg, 'vinted_retours_remis'), recus = await lu(pg, 'vinted_retours_recus');
        dit((!remis || !Object.keys(remis).length) && (!recus || !Object.keys(recus).length), 'rien n’a été saisi ni écrit (ni « reçu », ni « remis ») : la règle suffit', JSON.stringify({ remis, recus }));
        const nm = await lu(pg, 'vinted_annonce_numeros') || {};
        const changes = Object.keys(NUMEROS).filter((id) => !nm[id] || String(nm[id].numero) !== NUMEROS[id].numero);
        const used = (await lu(pg, 'vinted_used_numeros')) || [];
        dit(!changes.length && used.map(String).every((n) => ['90', '91', '92', '93', '94'].includes(n)), 'aucun N° changé, aucun N° neuf pris', JSON.stringify({ changes, used }));
        await pg.screenshot({ path: path.join(SHOTS, `colis-${vp.width}.png`), fullPage: true }).catch(() => {});
        await sain(pg, 'Colis');
      });
      await essaie('Remettre en ligne', async () => {
        await pg.click('[data-remettre-en-ligne="9401"]');
        await pg.waitForSelector('[data-main-annulee]', { timeout: 8000 }).catch(() => {});
        const r = await pg.evaluate(() => { const el = document.querySelector('[data-main-annulee]'); return el ? { tx: el.getAttribute('data-main-annulee'), t: el.innerText } : null; });
        dit(r && r.tx === '9401' && /vente retournée/.test(r.t), '« Remettre en ligne » ouvre « Republier à la main » pour CETTE vente (ancienne annonce fermée : vente retournée)', JSON.stringify(r));
        const but = await pg.evaluate(() => { const el = document.querySelector('[data-main-but]'); return el ? el.innerText : ''; });
        dit(/N°90/.test(but), 'le N°90 passera sur la nouvelle annonce (le même rangement)', but);
        await pg.screenshot({ path: path.join(SHOTS, `remettre-${vp.width}.png`) }).catch(() => {});
        await pg.keyboard.press('Escape').catch(() => {});
      });
      await essaie('Stock', async () => {
        await pg.waitForTimeout(800);
        try { await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' }); }
        catch (_) { await pg.waitForTimeout(1200); await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' }); }
        await pg.waitForSelector('[data-stock-retours]', { state: 'visible', timeout: 20000 }).catch(() => {});
        dit(await pg.isVisible('[data-stock-retours]'), 'Stock : le bloc des retours est VISIBLE (pas seulement dans le DOM)');
        await pg.waitForTimeout(1500);
        const s = await pg.evaluate(() => { const el = document.querySelector('[data-stock-retours]'); if (!el) return null;
          return { n: el.getAttribute('data-stock-retours'), an: el.getAttribute('data-stock-retours-a-numeroter'), en: [...el.querySelectorAll('[data-stock-remettre-en-ligne]')].map((x) => x.getAttribute('data-stock-remettre-en-ligne')),
            lib: [...el.querySelectorAll('[data-stock-retour-libelle]')].map((x) => x.innerText), t: el.innerText }; });
        dit(s && s.n === '1' && s.en.join(',') === '90', 'Stock : le N°90 revenu d’un retour, avec « Remettre en ligne »', JSON.stringify(s));
        dit(s && s.lib.length === 1 && /^Retour du .+ — à vérifier et remettre en ligne$/.test(s.lib[0]), 'Stock : « Retour du <date> — à vérifier et remettre en ligne »', JSON.stringify(s && s.lib));
        dit(s && s.an === '1', 'Stock : le revenu sans N° est compté « à numéroter »', JSON.stringify(s && s.an));
        const band = await pg.evaluate(() => { const el = document.querySelector('[data-a-ranger="90"]'); return el ? { retour: !!el.querySelector('[data-a-ranger-retour]') } : null; });
        dit(band && band.retour, 'Stock : le N°90 attend « À ranger », marqué Retour', JSON.stringify(band));
        await pg.evaluate(() => { const el = document.querySelector("[data-stock-retours]"); if (el) el.scrollIntoView({ block: "center" }); }).catch(() => {}); await pg.waitForTimeout(500);
        await pg.screenshot({ path: path.join(SHOTS, `stock-${vp.width}.png`) }).catch(() => {});
        await pg.evaluate(() => { const el = document.querySelector("[data-bande-a-ranger]"); if (el) el.scrollIntoView({ block: "center" }); }).catch(() => {}); await pg.waitForTimeout(400);
        await pg.screenshot({ path: path.join(SHOTS, `stock-ranger-${vp.width}.png`) }).catch(() => {});
        await sain(pg, 'Stock');
      });
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ retour → stock sans rien saisir : ${ko} rouge(s)` : '\n✅ retour → stock sans rien saisir : tout est vert');
  process.exit(ko ? 1 : 0);
})();
