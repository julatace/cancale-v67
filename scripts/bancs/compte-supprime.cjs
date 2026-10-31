// ── BANC : UN COMPTE SUPPRIMÉ DÉFINITIVEMENT DISPARAÎT VRAIMENT (16 oct.) ────
// Julien : « dans la recherche il y a les annonces de Shopcancale alors que
// j'avais demandé de supprimer ». Données INVENTÉES. Exige : ses lignes sont
// vidées (préfixe exact, jamais celles d'un autre compte), la recherche ne le
// montre plus (l'autre sens : un compte vivant reste trouvé), et la carte d'un
// compte ne dit que « Actif » (sans « Tester la connexion »).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4391);

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();

const A = '111', S = '199082413';
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'compte_vivant', domain: 'www.vinted.fr', refresh_token: 'r', updated_at: new Date(MAINTENANT).toISOString() }];
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: {
    '9001': { numero: 'B12', title: 'Nike Sacai blanche', accountId: S },
    '9002': { numero: '3', title: 'Adidas Spezial bleue', accountId: A },
  } } },
  { id: 'vrm_blocked_accounts', data: { uids: [S], logins: ['shop_cancale'] } },
  { id: 'panel_accounts_off', data: {} },
  { id: 'harvest_' + A + '_listings', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { items: [{ id: 9002, title: 'Adidas Spezial bleue', price: { amount: '40' } }], pagination: { total_entries: 1 } } } },
  { id: 'harvest_' + S + '_listings', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { items: [{ id: 9001, title: 'Nike Sacai blanche', price: { amount: '90' } }], pagination: { total_entries: 1 } } } },
  { id: 'harvest_' + S + '_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [{ transaction_id: 77, title: 'Nike Sacai vendue' }] } } },
];
const ECRITS = [];
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 140)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
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

async function preparer(b, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}), permissions: opts.clavierRefuse ? [] : ['clipboard-read', 'clipboard-write'] });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (opts.clavierRefuse) await pg.addInitScript(() => { try { Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => ({ writeText: () => Promise.reject(new DOMException('refusé', 'NotAllowedError')) }) }); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') { try { ECRITS.push(...JSON.parse(route.request().postData() || '[]')); } catch (_) {} return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    // 5.181 : l'état actif / banni évalué par l'extension (`panel_comptes_etat`).
    if (eq && eq[1] === 'panel_comptes_etat') {
      if (opts.etatKO) return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
      return j(opts.etatExt ? [{ data: { comptes: opts.etatExt } }] : []);
    }
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const ors = [...u.matchAll(/id\.like\.([^,)]+)/g)].map((m) => m[1]);
    if (ors.length) { const res = ors.map((x) => new RegExp('^' + x.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$')); return j(ROWS.filter((r) => res.some((re) => re.test(r.id))).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}


async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 780 }, { width: 1512, height: 950 }]) {
      const T = vp.width + 'px';
      await essaie(T, async () => {
        ECRITS.length = 0;
        const { ctx, pg, errs } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=vintedaccounts`, { waitUntil: 'domcontentloaded' });
        await pg.getByText('compte_vivant').first().waitFor({ timeout: 12000 });
        // La purge part à l'arrivée du nuage (onCloudReady) : on attend qu'elle ait
        // ÉCRIT (jusqu'à 12 s), jamais un délai fixe — il était trop court depuis
        // que le démarrage lit davantage (vu le 29 oct. : écriture à ~2 s).
        for (let t = 0; t < 40 && !ECRITS.some((e) => e && /^harvest_199082413_/.test(e.id)); t++) await pg.waitForTimeout(300);
        await pg.waitForTimeout(300);
        const vides = ECRITS.filter((e) => e && /^harvest_199082413_/.test(e.id) && e.data && e.data.supprime === true).map((e) => e.id).sort();
        dit(vides.join(',') === 'harvest_199082413_listings,harvest_199082413_orders_sold', `${T} les lignes du compte supprimé sont VIDÉES (préfixe exact)`, vides.join(','));
        dit(!ECRITS.some((e) => e && /^harvest_111_/.test(e.id) && e.data && e.data.supprime), `${T} et jamais celles du compte vivant`);
        const ec = await pg.evaluate(() => ({ etat: [...document.querySelectorAll('[data-etat-compte]')].map((e) => e.getAttribute('data-etat-compte')).join(','), test: /Tester la connexion/.test(document.body.innerText) }));
        dit(ec.etat === 'actif' && !ec.test, `${T} la carte du compte dit « Actif », sans « Tester la connexion »`, JSON.stringify(ec));
        // La recherche.
        await pg.locator('[aria-label="Rechercher une paire"]').first().click();
        const champ = pg.locator('input[placeholder^="N°, nom du modèle"]');
        await champ.fill('nike'); await pg.waitForTimeout(900);
        const nike = await pg.evaluate(() => document.body.innerText);
        dit(!/Nike Sacai/.test(nike), `${T} la recherche ne montre plus les paires du compte supprimé`, (nike.match(/[^\n]*Nike[^\n]*/g) || []).join(' | '));
        await champ.fill('adidas'); await pg.waitForTimeout(600);
        const adi = await pg.evaluate(() => document.body.innerText);
        dit(/Adidas Spezial/.test(adi), `${T} l'autre sens : la paire du compte vivant est trouvée`);
        // MODE STREAM : allumé dans Réglages, les noms de comptes sont floutés.
        await pg.keyboard.press('Escape').catch(() => {});
        await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
        const inter = pg.locator('[data-stream-reglage] button[role="switch"]');
        await inter.waitFor({ timeout: 12000 }); await inter.scrollIntoViewIfNeeded(); await inter.click();
        const pastille = await pg.locator('[data-stream-pastille]').count();
        await pg.goto(`http://localhost:${PORT}/?tab=vintedaccounts`, { waitUntil: 'domcontentloaded' });
        await pg.getByText('compte_vivant').first().waitFor({ timeout: 12000 });
        const flou = await pg.evaluate(() => { const e = document.querySelector('.vrm-sensible'); return e ? getComputedStyle(e).filter : ''; });
        dit(pastille === 1 && /blur/.test(flou), `${T} mode stream : la pastille apparaît et le nom du compte est flouté (même après rechargement)`, `pastille ${pastille} · ${flou}`);
        await pg.locator('[data-stream-pastille]').first().click();
        const net = await pg.evaluate(() => { const e = document.querySelector('.vrm-sensible'); return e ? getComputedStyle(e).filter : ''; });
        dit(!/blur/.test(net), `${T} un clic sur la pastille arrête le flou`, net);
        dit(!errs.length, `${T} aucune erreur d’app`, errs[0]);
        await ctx.close();
      });
    }
    // 5.181 — l'EXTENSION a lu `is_account_banned: true` dans le profil : la carte
    // dit « Banni par Vinted » ; une lecture ratée de cette ligne ne bannit rien.
    for (const [nom, opts, attendu] of [
      ['l\'extension dit banni', { etatExt: { '111': { etat: 'banni', at: new Date(MAINTENANT).toISOString(), preuve: 'champ profil is_account_banned' } } }, 'banni'],
      ['ligne illisible (522)', { etatKO: true }, 'actif'],
      ['l\'extension dit passu', { etatExt: { '111': { etat: 'passu', at: new Date(MAINTENANT).toISOString(), preuve: 'champ profil is_account_banned absent' } } }, 'actif'],
    ]) {
      await essaie(nom, async () => {
        const { ctx, pg, errs } = await preparer(b, { width: 1512, height: 950 }, opts);
        await pg.goto(`http://localhost:${PORT}/?tab=vintedaccounts`, { waitUntil: 'domcontentloaded' });
        await pg.getByText('compte_vivant').first().waitFor({ timeout: 12000 });
        await pg.waitForTimeout(1200);
        const ec = await pg.evaluate(() => [...document.querySelectorAll('[data-etat-compte]')].map((e) => e.getAttribute('data-etat-compte') + ':' + e.getAttribute('data-etat-source')).join(','));
        dit(ec.split(':')[0] === attendu, `${nom} ⇒ « ${attendu} »`, ec);
        dit(!errs.length, `${nom} : aucune erreur d’app`, errs[0]);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ compte supprimé : ${ko} rouge(s).` : `\n✅ compte supprimé : effacé pour de vrai, absent de la recherche`);
  process.exit(ko ? 1 : 0);
}
main();
