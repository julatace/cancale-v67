// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA REMISE À ZÉRO DES NUMÉROS » (migration 013) — l'app RENDUE.
//
//  Julien, 10 octobre : « les anciens c'est que les paires vendues, car je vais
//  tout republier — c'est pour ça que je veux de nouveaux numéros ». Après la
//  conversion, la ligne `main` porte le marqueur `vrm_numerotation`
//  ({version, coupure, archive: 'B', …}) et les anciens numéros sont en B.
//
//  Ce banc ouvre l'app sur une base inventée DÉJÀ convertie, et vérifie au rendu :
//   A. les annonces mises en ligne APRÈS la coupure reçoivent 1, 2, 3 dans
//      l'ordre de mise en ligne ; une annonce d'AVANT, ou sans date, n'en reçoit
//      pas ; et la paire republiée avec la PHOTO d'une ancienne fiche (B30)
//      prend un numéro NEUF — jamais B30 ;
//   B. la base change de version (une remise à zéro pendant que l'écran est
//      ouvert) : l'écran se couvre du bloc « Recharger » ;
//   C. la base REFUSE une écriture (`vrm_numeros_perimes`) : le bloc s'ouvre, et
//      plus rien n'est envoyé ;
//   D. « Recharger » garde ce qui a été tapé (un prix d'achat) et le rejoue sur
//      la ligne fraîche, par IDENTIFIANT — jamais le numéro de l'écran périmé.
//  Aucune fixture : tout est inventé.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');   // jamais un chemin absolu (§6.1)
const PORT = 4511;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
const JETON = 'jeton-de-banc';
const SESSION = { access_token: JETON, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.fr' } };
const UID = '900000001';
const COMPTE = { vinted_user_id: UID, login: 'compte-de-banc', access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString() };

const T = '2026-10-09T00:00:00.000Z', TS = Date.parse(T) / 1000;
const MK = { version: 2, coupure: T, appliqueLe: '2026-10-10T08:00:00.000Z', archive: 'B', nouvelles: 0, renum: {}, lbcAnnonces: [], ebayAnnonces: [] };
const PHOTO30 = 'https://images1.vinted.net/t/01_00abc_ancienne30/f800/1700000000.jpeg?s=x';
const mainDe = () => ({
  vrm_numerotation: MK, vrm_num_prefixe: '',
  vinted_used_numeros: Array.from({ length: 60 }, (_, i) => 'B' + (i + 1)),
  vinted_annonce_numeros: {
    1001: { numero: 'B7', title: 'Ancienne 7', auto: true },
    3000: { numero: 'B30', title: 'Ancienne 30', photo: PHOTO30, auto: true },
  },
  vinted_accounts_hidden: [],
});
const item = (id, ts, photo) => ({ id, title: 'Paire ' + id, price: { amount: '40.0', currency_code: 'EUR' }, is_closed: false, brand: 'Nike', size: '42',
  ...(ts != null ? { created_at_ts: ts } : {}),
  photo: photo ? { url: photo, high_resolution: ts != null ? { timestamp: ts } : {} } : null });
const ITEMS = [
  item(2003, TS - 3600, 'https://images1.vinted.net/t/01_x2003/f800/1.jpeg'),   // AVANT la coupure
  item(2005, TS + 10800, PHOTO30),                                                // après, avec la photo de la B30
  item(2002, TS + 7200, 'https://images1.vinted.net/t/01_x2002/f800/2.jpeg'),    // après (2e)
  item(2004, null, null),                                                         // sans date lisible
  item(2001, TS + 3600, 'https://images1.vinted.net/t/01_x2001/f800/3.jpeg'),    // après (1re)
];
const LISTINGS = { id: `harvest_${UID}_listings`, data: { capturedAt: new Date().toISOString(), payload: { items: ITEMS } } };

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const ecouter = () => new Promise((res, rej) => {
  srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est déjà pris — relance ce banc seul`) : e));
  srv.listen(PORT, () => res());
});

// Une base à état : `etat.main` est ce que le nuage garde ; `etat.refuse` fait
// refuser les écritures de `main` comme le garde-fou de la migration.
async function page(ctx, etat) {
  const pg = await ctx.newPage();
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: JETON, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const req = r.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, s = 200) => r.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return json([]);
    if (req.method() !== 'GET') {
      let rows = []; try { const b = JSON.parse(req.postData() || '[]'); rows = Array.isArray(b) ? b : [b]; } catch (_) {}
      const m = rows.find((x) => x && x.id === 'main' && x.data);
      if (m) {
        etat.tentatives.push(Date.now());
        if (etat.refuse) return json({ code: 'P0001', message: 'vrm_numeros_perimes', details: 'banc', hint: 'Recharge l\'app.' }, 400);
        // Le marqueur appartient au serveur : il est recopié (comme le garde-fou).
        etat.main = { ...m.data, vrm_numerotation: etat.main.vrm_numerotation };
        etat.ecrits.push(m.data);
      }
      return json([]);
    }
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json([COMPTE]);
    // La VERSION, lue en scalaire (la forme exacte de la requête de l'app).
    if (/id=eq\.main/.test(u) && /select=v:data->vrm_numerotation->>version/.test(u)) return json([{ v: etat.versionLue != null ? String(etat.versionLue) : (etat.main.vrm_numerotation ? String(etat.main.vrm_numerotation.version) : null) }]);
    if (/id=eq\.main/.test(u)) return json([{ id: 'main', data: etat.main }]);
    if (/_listings/.test(u)) return json([{ ...LISTINGS, cap: LISTINGS.data.capturedAt }]);
    return json([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  pg.__erreurs = []; pg.on('pageerror', (e) => pg.__erreurs.push(String(e).slice(0, 160)));
  return pg;
}
const numerosLocaux = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); } catch (_) { return null; } });
const poolLocal = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_used_numeros') || '[]'); } catch (_) { return null; } });
const bloc = (pg) => pg.evaluate(() => { const b = document.querySelector('[data-numeros-perimes]'); return b ? b.getAttribute('data-numeros-perimes') : null; });

(async () => {
  try { await ecouter(); } catch (e) { console.log('  ❌ ' + e.message); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const contexte = async () => {
    const ctx = await nav.newContext({ viewport: { width: 1512, height: 950 } });
    await ctx.addInitScript((s) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
    return ctx;
  };
  try {
    console.log('\n── A. Les annonces republiées après la coupure reçoivent 1, 2, 3 — jamais un ancien numéro');
    {
      const etat = { main: mainDe(), ecrits: [], tentatives: [] };
      const ctx = await contexte(); const pg = await page(ctx, etat);
      await pg.goto(`http://localhost:${PORT}/?tab=plat_vinted`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(9000);
      const n = (await numerosLocaux(pg)) || {};
      const num = (id) => (n[id] && n[id].numero) || '—';
      dit(num(2001) === '1' && num(2002) === '2' && num(2005) === '3', 'dans l\'ORDRE DE MISE EN LIGNE : 2001 → 1, 2002 → 2, 2005 → 3', `${num(2001)} / ${num(2002)} / ${num(2005)}`);
      dit(num(2005) !== 'B30', 'la paire republiée avec la PHOTO de l\'ancienne B30 ne reprend PAS B30');
      dit(!n[2003] && !n[2004], 'une annonce d\'AVANT la coupure, ou sans date lisible, ne reçoit rien toute seule', `${num(2003)} / ${num(2004)}`);
      const pool = ((await poolLocal(pg)) || []).map(String);
      dit(['1', '2', '3'].every((x) => pool.includes(x)) && pool.includes('B30') && pool.includes('B7'), 'le pool garde les anciens (B…) et brûle 1, 2, 3');
      const fautif = etat.ecrits.some((d) => Object.values(d.vinted_annonce_numeros || {}).some((e) => e && /^(30|7)$/.test(String(e.numero))));
      dit(!fautif && etat.ecrits.length > 0, 'ce qui repart au nuage ne porte aucun « 30 » ni « 7 » (un ancien numéro sans sa lettre)', `${etat.ecrits.length} écriture(s)`);
      dit(!(await bloc(pg)), 'aucun bloc « écran périmé » quand la version est la bonne');
      dit(!pg.__erreurs.length, 'aucune erreur d\'app', pg.__erreurs.join(' | '));
      await ctx.close();
    }

    console.log('\n── B. La base change de version pendant que l\'écran est ouvert');
    {
      const etat = { main: mainDe(), ecrits: [], tentatives: [] };
      const ctx = await contexte(); const pg = await page(ctx, etat);
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(6000);
      dit(!(await bloc(pg)), 'au chargement, version identique : rien ne s\'affiche');
      etat.versionLue = 3;                                            // une remise à zéro (ou un retour arrière) côté serveur
      await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await pg.waitForTimeout(1500);
      dit((await bloc(pg)) === 'version', 'retour au premier plan : la version relue a changé ⇒ le bloc « Recharger » couvre l\'écran', String(await bloc(pg)));
      const txt = await pg.evaluate(() => { const b = document.querySelector('[data-numeros-perimes]'); return b ? b.innerText : ''; });
      dit(/remise à zéro/i.test(txt) && /Recharger/.test(txt), 'il dit pourquoi (la remise à zéro) et le geste (Recharger)', txt.slice(0, 120).replace(/\n/g, ' '));
      await ctx.close();
    }

    console.log('\n── C. La base REFUSE une écriture (garde-fou) — puis D. « Recharger » garde la saisie');
    {
      const etat = { main: mainDe(), ecrits: [], tentatives: [], refuse: true };
      const ctx = await contexte(); const pg = await page(ctx, etat);
      await pg.goto(`http://localhost:${PORT}/?tab=plat_vinted`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(9000);
      dit((await bloc(pg)) === 'vrm_numeros_perimes', 'la base refuse (`vrm_numeros_perimes`) ⇒ le bloc s\'ouvre, avec la vraie cause', String(await bloc(pg)));
      const n1 = etat.tentatives.length;
      await pg.waitForTimeout(4000);
      dit(n1 >= 1 && etat.tentatives.length === n1, 'après le refus, l\'écran n\'envoie plus `main` (chaque envoi serait refusé de même)', `${n1} puis ${etat.tentatives.length}`);
      // D. Ce qu'il tape sur l'écran périmé : un prix d'achat, sur la paire 2001
      //    (numérotée ici, jamais arrivée au nuage) — et un « 999 » faux.
      await pg.evaluate(() => { const n = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); n['2001'] = { ...(n['2001'] || {}), buyPrice: '25', numero: '999' }; localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); });
      etat.refuse = false;
      await Promise.all([pg.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null), pg.click('[data-numeros-perimes] button')]);
      await pg.waitForTimeout(9000);
      const n = (await numerosLocaux(pg)) || {};
      const e = n['2001'] || {};
      dit(String(e.buyPrice) === '25', 'après « Recharger », le prix d\'achat tapé sur l\'écran périmé est GARDÉ (rejoué par l\'identifiant de l\'annonce)', JSON.stringify(e));
      dit(String(e.numero) !== '999', 'mais JAMAIS le numéro de l\'écran périmé (« 999 » n\'est pas rejoué)', String(e.numero));
      const parti = etat.ecrits.some((d) => d.vinted_annonce_numeros && d.vinted_annonce_numeros['2001'] && String(d.vinted_annonce_numeros['2001'].buyPrice) === '25');
      dit(parti, 'et la saisie gardée repart au nuage');
      dit(!(await bloc(pg)), 'l\'écran rechargé n\'est plus bloqué');
      dit(!pg.__erreurs.length, 'aucune erreur d\'app', pg.__erreurs.join(' | '));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 200)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ remise à zéro des numéros : ${ko} rouge(s)` : '\n✅ remise à zéro des numéros : tout est vert');
  process.exit(ko ? 1 : 0);
})();
