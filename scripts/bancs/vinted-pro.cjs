require('./_porte-banc.cjs');
// ═══════════════════════════════════════════════════════════════════════════
// BANC : COMPTES VINTED PRO (11 nov., lot vinted-pro)
//        node scripts/bancs/vinted-pro.cjs   (BANC_PORT, SHOTS=dossier)
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES, sous leur vraie forme (profil `users/current`, transaction
// `offer.price` / `service_fee` / `total_amount_without_tax`, relevé `lignes[]`
// avec `tx`, e-mail `pro:true` + `uid`), 390 px tactile clair/sombre et 1512 px :
//   A. 111 profil Pro ⇒ pastille « Pro » + phrase « lu sur ton profil » ;
//      222 profil particulier ⇒ « Particulier », aucune phrase Pro ;
//      333 aucun profil, aucun e-mail ⇒ aucune pastille, « — · profil pas encore lu » ;
//      444 aucun profil, un e-mail Vinted Pro ⇒ « Pro » (lu dans un e-mail).
//   B. 111 : « L'argent de tes ventes Pro » lu à l'OUVERTURE : prix des articles
//      40 + 29 = 69 € (sur 2), protection acheteurs 2,70 + 2,15 = 4,85 €, commission
//      2,00 € (sur 1 : seul le relevé de la vente 9001 la dit), reçu 38,00 € (sur 1).
//   C. aucune erreur, aucun débordement, cibles ≥ 44 px au doigt.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const fs = require('fs'), http = require('http'), path = require('path');
const { servir } = require('./_minipgrest.cjs');

const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4597;
const SHOTS = process.env.SHOTS || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'camille.martin@exemple.test' } };
const H = 3600e3, maintenant = Date.now(), iso = (t) => new Date(t).toISOString();
const compte = (id, uid, login) => ({ id, vinted_user_id: uid, login, domain: 'www.vinted.fr', created_at: iso(maintenant - 60 * 24 * H), updated_at: iso(maintenant) });
const ACCOUNTS = [compte(1, '111', 'boutique_pro_banc'), compte(2, '222', 'perso_banc'), compte(3, '333', 'inconnu_banc'), compte(4, '444', 'pro_par_mail_banc')];
const ligne = (id, data, meta) => ({ id, owner: SESSION.user.id, updated_at: iso(maintenant), data, meta: meta || {} });
const prix = (a) => ({ amount: a, currency_code: 'EUR' });
const txn = (uid, tx, p, f, tot, side) => ligne(`harvest_${uid}_txn_${tx}`, { type: 'transaction', uid, capturedAt: iso(maintenant - H), payload: { transaction: { id: Number(tx), user_side: side || 'seller', status: 450, status_title: 'Commande finalisée', offer: { price: prix(p) }, service_fee: prix(f), total_amount_without_tax: prix(tot) } } }, { id: tx, status: '450', capturedAt: iso(maintenant - H) });
const ROWS = [
  ...['111', '222', '333', '444'].map((u) => ligne(`harvest_${u}_orders_sold`, { capturedAt: iso(maintenant - H), payload: { my_orders: [] } }, { capturedAt: iso(maintenant - H) })),
  ligne('harvest_111_profile', { uid: '111', capturedAt: iso(maintenant - H), payload: { user: { id: 111, login: 'boutique_pro_banc', business: true, business_account: { id: 7 }, business_account_id: 7 } } }),
  ligne('harvest_222_profile', { uid: '222', capturedAt: iso(maintenant - H), payload: { user: { id: 222, login: 'perso_banc', business: false, business_account: null, business_account_id: null } } }),
  txn('111', '9001', '40.0', '2.7', '42.7'), txn('111', '9002', '29.0', '2.15', '31.15'), txn('111', '9003', '12.0', '1.3', '13.3', 'buyer'),
  ligne('harvest_111_releve_2026-10', { type: 'releve', uid: '111', mois: '2026-10', capturedAt: iso(maintenant - H), nLignes: 2, lignes: [{ id: 'a1', date: '2026-10-12', montant: 38, devise: 'EUR', tx: '9001' }, { id: 'a2', date: '2026-10-20', montant: -50, devise: 'EUR', quoi: 'payout' }] }),
  ligne('email_sale_banc_1', { type: 'sale', uid: '444', account: 'pro_par_mail_banc', pro: true, transaction: '8000001', designation: 'Article inventé', prix: '20,00', receivedAt: iso(maintenant - 2 * H) }),
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, vp, sombre, tab) {
  const mobile = vp.width < 600;
  const ctx = await nav.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(([s, d]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); if (d) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, [SESSION, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const q = r.request();
    if (q.method() !== 'GET' && q.method() !== 'HEAD') return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    const u = q.url();
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-1/2` }, body: JSON.stringify(ACCOUNTS) });
    if (!/\/rest\/v1\/app_data/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    const s = servir(ROWS, decodeURIComponent(u).replace(/\+/g, ' ').replace(/#/g, '%23'), q.headers());
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': s.range }, body: JSON.stringify(s.body) });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, erreurs };
}
const attendreComptes = (pg) => pg.waitForFunction(() => ['vinted', 'vestiaire', 'leboncoin', 'ebay'].every((p) => document.querySelector(`[data-comptes-groupe="${p}"] [data-compte-lie], [data-comptes-groupe="${p}"] [data-comptes-vide]`)) || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});


(async () => {
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ ' + e.message); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const [vp, sombre] of [[{ width: 390, height: 900 }, false], [{ width: 390, height: 900 }, true], [{ width: 1512, height: 1000 }, false]]) {
      const T = `${vp.width} px${sombre ? ' sombre' : ''} :`;
      const { ctx, pg, erreurs } = await ouvrir(nav, vp, sombre, 'vintedaccounts');
      await pg.waitForFunction(() => document.querySelectorAll('[data-comptes-groupe="vinted"] [data-compte-lie]').length >= 4 && document.querySelector('[data-compte-id="444"] [data-vpro-phrase]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
      await pg.waitForTimeout(600);
      const lire = () => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-compte-lie="vinted"]')].map((c) => [c.getAttribute('data-compte-id'), {
        type: (c.querySelector('[data-type-compte]') || { getAttribute: () => null }).getAttribute('data-type-compte'),
        phrase: (c.querySelector('[data-vpro-phrase]') || { getAttribute: () => null }).getAttribute('data-vpro-phrase'),
        source: (c.querySelector('[data-vpro-phrase]') || { getAttribute: () => null }).getAttribute('data-vpro-source'),
        argent: !!c.querySelector('[data-vpro-argent]'),
      }])));
      const r = await lire();
      dit(!erreurs.length, `${T} l'écran se rend sans erreur`, erreurs[0] || '');
      dit(r['111'] && r['111'].type === 'pro' && r['111'].phrase === 'pro' && r['111'].source === 'profil' && r['111'].argent, `${T} 111 : profil Pro ⇒ « Pro », phrase, l'argent des ventes Pro`, JSON.stringify(r['111']));
      dit(r['222'] && r['222'].type === 'particulier' && !r['222'].phrase && !r['222'].argent, `${T} 222 : particulier, aucune phrase Pro`, JSON.stringify(r['222']));
      dit(r['333'] && !r['333'].type && r['333'].phrase === 'passu', `${T} 333 : rien lu ⇒ aucune pastille, « pas su » dit`, JSON.stringify(r['333']));
      dit(r['444'] && r['444'].type === 'pro' && r['444'].source === 'email', `${T} 444 : e-mail Vinted Pro ⇒ « Pro » (lu dans un e-mail)`, JSON.stringify(r['444']));
      // B. l'argent, lu à l'ouverture
      await pg.locator('[data-vpro-argent="111"] > summary').click();
      await pg.waitForFunction(() => { const e = document.querySelector('[data-vpro-argent="111"] [data-vpro-etat]'); return e && /^(lu|vide|passu)$/.test(e.getAttribute('data-vpro-etat')); }, null, { timeout: 10000 }).catch(() => {});
      const a = await pg.evaluate(() => { const g = (k) => { const e = document.querySelector(`[data-vpro-argent="111"] [data-vpro-ligne="${k}"]`); return e ? [e.getAttribute('data-vpro-c'), e.getAttribute('data-vpro-n')] : null; };
        return { etat: (document.querySelector('[data-vpro-argent="111"] [data-vpro-etat]') || {}).getAttribute?.('data-vpro-etat'), ca: g('ca'), pr: g('protection'), com: g('commission'), recu: g('recu') }; });
      dit(a.etat === 'lu' && a.ca && a.ca[0] === '6900' && a.ca[1] === '2', `${T} prix des articles : 69,00 € sur 2 ventes (l'achat n'y est pas)`, JSON.stringify(a));
      dit(a.pr && a.pr[0] === '485', `${T} protection acheteurs : 4,85 € (payée par les acheteurs)`, JSON.stringify(a.pr));
      dit(a.com && a.com[0] === '200' && a.com[1] === '1' && a.recu && a.recu[0] === '3800' && a.recu[1] === '1', `${T} commission 2,00 € et reçu 38,00 €, sur 1 (le relevé seul)`, JSON.stringify([a.com, a.recu]));
      const geo = await pg.evaluate((mobile) => {
        const large = document.documentElement.scrollWidth > window.innerWidth + 1;
        const petits = mobile ? [...document.querySelectorAll('.vrm-cl-carte button, .vrm-cl-carte a, .vrm-cl-carte summary')].filter((x) => { const b = x.getBoundingClientRect(); return b.width && b.height < 43.5; }).map((x) => x.outerHTML.slice(0, 80)) : [];
        const debord = [...document.querySelectorAll('.vrm-cl-carte')].filter((c) => c.scrollWidth > c.clientWidth + 1).length;
        return { large, petits, debord };
      }, vp.width < 600);
      dit(!geo.large && !geo.debord, `${T} aucun débordement`, JSON.stringify(geo));
      if (vp.width < 600) dit(!geo.petits.length, `${T} cibles au doigt ≥ 44 px`, geo.petits.slice(0, 3).join(' | '));
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.locator('[data-compte-lie="vinted"][data-compte-id="111"]').scrollIntoViewIfNeeded(); await pg.screenshot({ path: path.join(SHOTS, `vinted-pro-${vp.width}${sombre ? '-sombre' : ''}.png`), fullPage: true }); }
      await ctx.close();
    }
  } catch (e) { ko++; console.log('❌ le banc a levé — ' + (e && e.message)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge.' : '✅ Comptes Vinted Pro : reconnus seulement s\'ils sont lus, leur argent dit avec sa couverture.'}`);
  process.exit(ko ? 1 : 0);
})();
