require('./_porte-banc.cjs');
// BANC — « Pourquoi le nuage en haut est barré ? » (Julien, 16 octobre).
//
// Le nuage barré = la dernière sauvegarde vers la base n'est pas partie. Avant :
// une icône, aucune raison, et AUCUNE reprise — il restait barré jusqu'à la
// saisie suivante, et ce qu'il venait de taper n'arrivait jamais en base.
// Ce banc (aucune donnée réelle) fait refuser l'envoi par la base (503), puis
// la rétablit, et exige :
//   · le nuage barré, et au clic un panneau qui DIT pourquoi (« 503 ») et que
//     rien n'est perdu ;
//   · une reprise TOUTE SEULE, sans nouvelle saisie : l'envoi repart et le
//     nuage redevient « sauvegardé » ;
//   · « Réessayer maintenant » renvoie tout de suite.
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4961;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'banc@exemple.fr' } };
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${det ? ' — ' + det : ''}`); };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
(async () => {
  try { await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }); }
  catch (e) { console.log(`❌ port ${PORT} pris — relance ce banc seul`); process.exit(1); }
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  try {
    const pg = await nav.newPage({ viewport: { width: 1512, height: 950 } });
    const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
    await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
    let enPanne = false, envois = 0, envoisOk = 0;
    await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
    await pg.route('**/rest/v1/**', (r) => {
      const u = r.request().url(), m = r.request().method();
      if (m === 'POST' && /app_data/.test(u) && /"id":"main"/.test(r.request().postData() || '')) {
        envois++;
        if (enPanne) return r.fulfill({ status: 503, contentType: 'text/html', body: '<html>503</html>' });
        envoisOk++; return r.fulfill({ status: 201, body: '' });
      }
      if (/id=eq\.main/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ data: { vrm_prenom: 'Banc' } }]) });
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
    });
    await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(3500);
    enPanne = true;
    // L'interrupteur « Mode sombre » de Réglages (16 oct. : une ligne à interrupteur).
    const bascule = pg.locator('[data-reglage-sombre]').first();
    await bascule.click().catch(() => {});
    await pg.waitForTimeout(2000);
    const etat1 = await pg.getAttribute('.vrm-sync-status', 'data-sync-etat').catch(() => null);
    dit(etat1 === 'error', 'la base refuse l’envoi : le nuage passe en erreur', String(etat1));
    await pg.click('.vrm-sync-status').catch(() => {});
    await pg.waitForTimeout(400);
    const pan = await pg.evaluate(() => { const p = document.querySelector('[data-sync-panneau]'); return p ? p.innerText : ''; });
    dit(/503/.test(pan), 'au clic, le panneau DIT pourquoi (la base a répondu 503)', pan.replace(/\n/g, ' ').slice(0, 140));
    dit(/rien n’est perdu/i.test(pan), 'et que rien n’est perdu (tout reste sur l’appareil)');
    dit(!!(await pg.$('[data-sync-reessayer]')), 'et propose « Réessayer maintenant »');
    // La base revient : la reprise doit partir TOUTE SEULE (5 s), sans saisie.
    enPanne = false;
    const avant = envoisOk;
    await pg.waitForTimeout(7000);
    const etat2 = await pg.getAttribute('.vrm-sync-status', 'data-sync-etat').catch(() => null);
    dit(envoisOk > avant && etat2 === 'synced', 'la base revenue, la sauvegarde repart TOUTE SEULE et le nuage redevient « sauvegardé »', `envois réussis ${avant}→${envoisOk}, état ${etat2}`);
    // « Réessayer maintenant » : une nouvelle panne, puis le clic.
    enPanne = true;
    await pg.keyboard.press('Escape').catch(() => {});
    await pg.mouse.click(5, 900).catch(() => {});        // referme le panneau
    await pg.waitForTimeout(300);
    await bascule.click().catch(() => {});
    await pg.waitForFunction(() => (document.querySelector('.vrm-sync-status') || {}).dataset?.syncEtat === 'error', null, { timeout: 6000 }).catch(() => {});
    enPanne = false;
    if (!(await pg.$('[data-sync-panneau]'))) await pg.click('.vrm-sync-status').catch(() => {});
    await pg.waitForTimeout(300);
    const n0 = envoisOk;
    await pg.click('[data-sync-reessayer]').catch((e) => console.log('    clic : ' + e.message.slice(0, 80)));
    await pg.waitForTimeout(2000);
    dit(envoisOk > n0, '« Réessayer maintenant » renvoie tout de suite', `${n0}→${envoisOk}`);
    dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | '));
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ nuage : ${ko} rouge(s)` : '\n✅ nuage : la raison est dite, la sauvegarde repart toute seule');
  process.exit(ko ? 1 : 0);
})();
