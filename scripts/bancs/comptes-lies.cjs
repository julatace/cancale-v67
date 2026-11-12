require('./_porte-banc.cjs');
// ═══════════════════════════════════════════════════════════════════════════
// BANC : « COMPTES LIÉS » — toutes les plateformes (3 nov.)
//        node scripts/bancs/comptes-lies.cjs   (BANC_PORT, SHOTS=dossier)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Comptes liés : il doit y avoir les comptes Leboncoin, Vestiaire et
// eBay ; tout ce qui est fait pour Vinted doit être fait pour le reste ».
// Données INVENTÉES, servies sous leur vraie forme (projections `select=`,
// `id=like.`, mesurées sur sa base le 3 nov.), 390 px tactile clair/sombre et
// 1512 px :
//   A. quatre groupes (Vinted, Vestiaire Collective, Leboncoin, eBay), la MÊME
//      carte (`data-compte-lie`) ; Leboncoin : `8442…` et `lbc-account:8442…` =
//      UN compte, son nom tel que lu ; Vestiaire sans compte relevé ⇒ une carte
//      « non identifié » ; eBay déconnecté ⇒ « délié » + Relier ;
//   B. les états : ouvert (session < 12 h), à relire (> 24 h), jamais lu, lu ;
//   C. l'interrupteur « dans les totaux » sur un compte Leboncoin ⇒ le choix est
//      rangé (`vrm_comptes_exclus`) et Comptabilité → « Vendu » passe de 150 € à
//      100 € (la vente du compte écarté sort) ; rallumé ⇒ 150 € ;
//   D. aucune erreur, aucun débordement, cibles ≥ 44 px au doigt.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const fs = require('fs'), http = require('http'), path = require('path');
const { servir } = require('./_minipgrest.cjs');

const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4593;
const SHOTS = process.env.SHOTS || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'camille.martin@exemple.test' } };
const H = 3600e3, maintenant = Date.now(), iso = (t) => new Date(t).toISOString();
const ajd = new Date(); ajd.setHours(10, 0, 0, 0);
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'vinted_frais_banc', domain: 'www.vinted.fr', created_at: iso(maintenant - 60 * 24 * H), updated_at: iso(maintenant) },
  { id: 2, vinted_user_id: '222', login: 'vinted_vieux_banc', domain: 'www.vinted.fr', created_at: iso(maintenant - 60 * 24 * H), updated_at: iso(maintenant) },
];
const ligne = (id, data, meta) => ({ id, owner: SESSION.user.id, updated_at: iso(maintenant), data, meta: meta || {} });
const ROWS = [
  ligne('harvest_111_orders_sold', { capturedAt: iso(maintenant - H), payload: { my_orders: [] } }, { capturedAt: iso(maintenant - H) }),
  ligne('harvest_222_orders_sold', { capturedAt: iso(maintenant - 72 * H), payload: { my_orders: [] } }, { capturedAt: iso(maintenant - 72 * H) }),
  ligne('lbc_accounts', { accounts: {
    '8442aaaa-0000-4000-8000-000000000001': { id: '8442aaaa-0000-4000-8000-000000000001', name: 'atelier_lbc_banc', type: 'particulier', seenAt: iso(maintenant - 3 * H), sessionAt: iso(maintenant - 3 * H) },
    'lbc-account:8442aaaa-0000-4000-8000-000000000001': { id: 'lbc-account:8442aaaa-0000-4000-8000-000000000001', name: 'atelier_lbc_banc', type: 'particulier', sessionAt: iso(maintenant - 2 * H) },
    'faf3bbbb-0000-4000-8000-000000000002': { id: 'faf3bbbb-0000-4000-8000-000000000002', name: 'pro_lbc_banc', type: 'pro', seenAt: iso(maintenant - 5 * 24 * H) },
  }, updatedAt: iso(maintenant) }),
  ligne('lbc_listings', { items: {}, lectures: { 'faf3bbbb-0000-4000-8000-000000000002': { at: iso(maintenant - 50 * H), total: 3, n: 3 } } }),
  ligne('lbc_ventes', { ventes: {
    T1: { txId: 'T1', isSeller: true, price: 10000, dateVente: iso(ajd), parcelColor: 'finished', account: 'lbc-account:8442aaaa-0000-4000-8000-000000000001', title: 'Article A', at: iso(ajd) },
    T2: { txId: 'T2', isSeller: true, price: 5000, dateVente: iso(ajd), parcelColor: 'finished', account: 'faf3bbbb-0000-4000-8000-000000000002', title: 'Article B', at: iso(ajd) },
  } }),
  ligne('vc_listings', { items: {}, liens: {}, capturedAt: iso(maintenant - 30 * 60e3) }),
  ligne('vc_ventes', { ventes: {}, lectures: {}, capturedAt: iso(maintenant - 30 * 60e3) }),
  ligne('ebay_comptes', { comptes: [
    { principal: true, cle: 'aaaaaaaaaaaaaaaa', pseudo: 'shop_ebay_banc', type: 'pro', site: 'FR', ajouteLe: maintenant - 30 * 24 * H },
    { cle: 'bbbbbbbbbbbbbbbb', pseudo: 'ancien_ebay_banc', type: 'particulier', site: 'FR', ajouteLe: maintenant - 30 * 24 * H, deconnecteLe: maintenant - 24 * H },
  ] }),
  ligne('ebay_orders', { orders: [], capturedAt: maintenant - 2 * H }),
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

async function lireCartes(pg) {
  return pg.evaluate(() => {
    const out = {};
    for (const g of document.querySelectorAll('[data-comptes-groupe]')) out[g.getAttribute('data-comptes-groupe')] = [...g.querySelectorAll('[data-compte-lie]')].map((c) => ({
      id: c.getAttribute('data-compte-id'), etat: c.getAttribute('data-compte-etat'), inclus: c.getAttribute('data-compte-inclus'),
      nom: (c.querySelector('.vrm-cl-nom') || {}).innerText || '', actions: [...c.querySelectorAll('[data-compte-action]')].map((a) => a.getAttribute('data-compte-action')),
      type: (c.querySelector('[data-type-compte]') || { getAttribute: () => null }).getAttribute('data-type-compte'),
    }));
    return { groupes: [...document.querySelectorAll('[data-comptes-groupe]')].map((g) => g.getAttribute('data-comptes-groupe')), out, tombe: /pas pu s'afficher|is not defined|Cannot read/.test(document.body.innerText) };
  });
}

async function venduCompta(nav, vp, exclus) {
  const { ctx, pg } = await ouvrir(nav, vp, false, 'compta');
  if (exclus) await pg.evaluate((e) => { try { localStorage.setItem('vrm_comptes_exclus', JSON.stringify(e)); } catch (_) {} }, exclus);
  if (exclus) await pg.reload({ waitUntil: 'domcontentloaded' });
  let v = null;
  for (let i = 0; i < 40 && v == null; i++) {
    await pg.waitForTimeout(500);
    v = await pg.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); const e = document.querySelector('[data-ca-cur="vendu"]'); const x = e && e.getAttribute('data-ca-eur'); return x ? Number(x) : null; });
  }
  await ctx.close();
  return v;
}

(async () => {
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ ' + e.message); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const [vp, sombre] of [[{ width: 390, height: 900 }, false], [{ width: 390, height: 900 }, true], [{ width: 1512, height: 1000 }, false]]) {
      const T = `${vp.width} px${sombre ? ' sombre' : ''} :`;
      const { ctx, pg, erreurs } = await ouvrir(nav, vp, sombre, 'vintedaccounts');
      await attendreComptes(pg); await pg.waitForTimeout(800);
      const r = await lireCartes(pg);
      dit(!erreurs.length && !r.tombe, `${T} l'écran se rend sans erreur`, erreurs[0] || '');
      dit(['vinted', 'vestiaire', 'leboncoin', 'ebay'].every((p) => r.groupes.includes(p)), `${T} quatre groupes : Vinted, Vestiaire, Leboncoin, eBay`, r.groupes.join(','));
      const lbc = r.out.leboncoin || [], vc = r.out.vestiaire || [], eb = r.out.ebay || [], vi = r.out.vinted || [];
      dit(lbc.length === 2, `${T} Leboncoin : « 8442… » et « lbc-account:8442… » = UN compte (2 cartes)`, JSON.stringify(lbc.map((c) => c.id)));
      const a = lbc.find((c) => c.id.startsWith('8442')), b = lbc.find((c) => c.id.startsWith('faf3'));
      dit(a && a.etat === 'ouvert' && /atelier_lbc_banc/.test(a.nom), `${T} Leboncoin : le compte de la session (< 12 h) est « ouvert », nommé tel que lu`, JSON.stringify(a));
      dit(b && b.etat === 'a-relire' && b.type === 'pro', `${T} Leboncoin : liste lue il y a 50 h ⇒ « à relire » ; « Pro » tel que lu`, JSON.stringify(b));
      dit(vc.length === 1 && vc[0].id === '-' && vc[0].etat === 'lu', `${T} Vestiaire sans compte relevé ⇒ une carte « non identifié », lue il y a 30 min`, JSON.stringify(vc));
      const e1 = eb.find((c) => c.id === 'principal'), e2 = eb.find((c) => c.id === 'bbbbbbbbbbbbbbbb');
      dit(e1 && e1.etat === 'lu' && e1.actions.includes('relire') && e1.actions.includes('delier') && e1.inclus === '1', `${T} eBay relié : « lu », Relire + Délier, dans les totaux`, JSON.stringify(e1));
      dit(e2 && e2.etat === 'delie' && e2.actions.join() === 'relier' && e2.inclus === '', `${T} eBay déconnecté : « délié », seulement « Relier », hors interrupteur`, JSON.stringify(e2));
      const v1 = vi.find((c) => c.id === '111'), v2 = vi.find((c) => c.id === '222');
      dit(v1 && v1.etat === 'lu' && v2 && v2.etat === 'a-relire', `${T} Vinted : capté il y a 1 h ⇒ « lu », il y a 72 h ⇒ « à relire » (même carte)`, JSON.stringify(vi.map((c) => [c.id, c.etat])));
      const geo = await pg.evaluate((mobile) => {
        const large = document.documentElement.scrollWidth > window.innerWidth + 1;
        const petits = mobile ? [...document.querySelectorAll('.vrm-cl-carte button, .vrm-cl-carte a, .vrm-cl-inclus')].filter((x) => { const b = x.getBoundingClientRect(); return b.width && b.height < 43.5; }).map((x) => x.outerHTML.slice(0, 60)) : [];
        const debord = [...document.querySelectorAll('.vrm-cl-carte')].filter((c) => c.scrollWidth > c.clientWidth + 1).length;
        return { large, petits, debord };
      }, vp.width < 600);
      dit(!geo.large && !geo.debord, `${T} aucun débordement (page, cartes)`, JSON.stringify(geo));
      if (vp.width < 600) dit(!geo.petits.length, `${T} cibles au doigt ≥ 44 px`, geo.petits.slice(0, 3).join(' | '));
      // C. l'interrupteur range le choix (Leboncoin, compte « pro »)
      if (!sombre && vp.width < 600) {
        await pg.locator('[data-compte-lie="leboncoin"][data-compte-id^="faf3"] [data-compte-inclus-bouton]').click();
        await pg.waitForTimeout(900);
        const rangé = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_comptes_exclus') || '{}'); } catch (_) { return null; } });
        const etatCarte = await pg.getAttribute('[data-compte-lie="leboncoin"][data-compte-id^="faf3"]', 'data-compte-inclus');
        dit(rangé && Array.isArray(rangé.leboncoin) && rangé.leboncoin.includes('faf3bbbb-0000-4000-8000-000000000002') && etatCarte === '0', `${T} interrupteur ⇒ le compte Leboncoin sort des totaux (rangé dans vrm_comptes_exclus)`, JSON.stringify(rangé) + ' ' + etatCarte);
      }
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `comptes-lies-${vp.width}${sombre ? '-sombre' : ''}.png`), fullPage: true }); }
      await ctx.close();
    }
    // C (suite). Le chiffre suit : Comptabilité → « Vendu » de la période.
    const vp = { width: 1512, height: 1000 };
    const avant = await venduCompta(nav, vp, null);
    const apres = await venduCompta(nav, vp, { leboncoin: ['faf3bbbb-0000-4000-8000-000000000002'] });
    dit(avant === 150 && apres === 100, 'Comptabilité → Vendu : 150 € avec les deux comptes Leboncoin, 100 € une fois le second écarté', `${avant} → ${apres}`);
  } catch (e) { ko++; console.log('❌ le banc a levé — ' + (e && e.message)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge.' : '✅ Comptes liés : quatre plateformes, une carte, et le choix « dans les totaux » suit jusqu\'au chiffre.'}`);
  process.exit(ko ? 1 : 0);
})();
