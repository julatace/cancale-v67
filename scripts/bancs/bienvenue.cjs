require('./_porte-banc.cjs');
// BANC — la présentation d'arrivée et le mouvement entre écrans (27 oct.).
// Julien : « quand une personne arrive, un univers personnalisable en un clic,
// avec une voix si possible, une démonstration » et « des effets entre les pages ».
// Aucune donnée réelle : base vide (compte neuf) ou un compte Vinted inventé.
// Exige :
//   · compte neuf ⇒ la présentation s'ouvre sur « Choisis ton univers » ;
//   · un clic sur « Nuit » met l'app en sombre (le même réglage que Réglages) ;
//   · la démonstration a cinq écrans, chacun marqué « exemple » ;
//   · « Écouter la visite » fait parler le navigateur en français, et la fin de
//     la lecture passe à l'écran suivant ;
//   · « Commencer » la ferme et la note vue : rechargée, elle ne revient pas ;
//   · Réglages ne la propose plus (27 oct., sa demande) ;
//   · l'autre sens : un vendeur qui a déjà un compte Vinted ne la voit pas ;
//   · changer d'écran rejoue une entrée en fondu, et rien si « réduire les animations ».
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4961;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'banc@exemple.fr' } };
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + det : ''}`); };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
async function page(nav, { telephone, comptes = [], reduit = false, tab = 'journee' }) {
  const ctx = await nav.newContext({ ...(telephone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), reducedMotion: reduit ? 'reduce' : 'no-preference' });
  const pg = await ctx.newPage();
  await pg.addInitScript((s) => {
    try { if (!sessionStorage.getItem('banc_init')) { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_banc_bienvenue', '1'); localStorage.removeItem('vrm_bienvenue_vue'); localStorage.setItem('vrm_prenom', JSON.stringify('Léa')); sessionStorage.setItem('banc_init', '1'); } } catch (_) {}
    // La voix du navigateur, observée : chaque phrase dite est notée, et sa fin arrive 300 ms après.
    window.__dit = [];
    try {
      window.speechSynthesis.speak = (u) => { window.__dit.push({ texte: u.text, lang: u.lang }); setTimeout(() => { try { u.onend && u.onend(); } catch (_) {} }, 300); };
      window.speechSynthesis.cancel = () => {};
    } catch (_) {}
  }, SESSION);
  let main = null;
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = decodeURIComponent(r.request().url()); const m = r.request().method();
    if (/vinted_accounts/.test(u) && m === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(comptes) });
    if (/id=eq\.main/.test(u) && m === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(main ? [{ id: 'main', owner: SESSION.user.id, data: main }] : []) });
    if (/app_data/.test(u) && m === 'POST') { try { const b = JSON.parse(r.request().postData() || '{}'); const row = Array.isArray(b) ? b.find((x) => x.id === 'main') : (b.id === 'main' ? b : null); if (row) main = row.data; } catch (_) {} }
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  return { ctx, pg };
}
(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium' });
  try {
    for (const telephone of [true, false]) {
      const W = telephone ? 390 : 1512;
      console.log(`── ${W} px`);
      const { ctx, pg } = await page(nav, { telephone });
      const etat = () => pg.evaluate(() => { const b = document.querySelector('[data-bienvenue]'); return b ? b.getAttribute('data-bienvenue') : null; });
      dit(await etat() === 'univers', `[${W}] compte neuf : la présentation s'ouvre sur « Choisis ton univers »`, String(await etat()));
      if (process.env.BANC_CAPTURES) { fs.mkdirSync(process.env.BANC_CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(process.env.BANC_CAPTURES, 'bienvenue-univers-' + W + '.png') }); }
      dit(/Bienvenue, Léa/.test(await pg.locator('.vrm-bienvenue').innerText().catch(() => '')), `[${W}] elle accueille par le prénom`);
      await pg.click('[data-univers="nuit"]');
      await pg.waitForTimeout(400);
      const theme = await pg.evaluate(() => document.documentElement.getAttribute('data-theme'));
      dit(theme === 'dark' && await pg.getAttribute('[data-univers="nuit"]', 'aria-checked') === 'true', `[${W}] « Nuit » en un clic : l'app passe en sombre`, String(theme));
      const tailles = await pg.evaluate(() => [...document.querySelectorAll('.vrm-bienvenue button')].filter((b) => b.offsetParent).map((b) => [b.innerText.trim().slice(0, 20), Math.round(b.getBoundingClientRect().height)]).filter(([, h]) => h < 44));
      dit(tailles.length === 0, `[${W}] chaque bouton fait au moins 44 px`, JSON.stringify(tailles));
      await pg.click('[data-bienvenue-suivant]');
      const vus = [];
      for (let i = 0; i < 5; i++) {
        await pg.waitForTimeout(250);
        const e = await etat(); vus.push(e);
        const exemple = await pg.locator('.vrm-bienvenue-exemple').count();
        if (!exemple) dit(false, `[${W}] l'écran « ${e} » dit « exemple »`);
        if (i < 4) await pg.click('[data-bienvenue-suivant]');
      }
      if (process.env.BANC_CAPTURES) await pg.screenshot({ path: path.join(process.env.BANC_CAPTURES, 'bienvenue-demo-' + W + '.png') });
      dit(vus.join(',') === 'journee,plateformes,numeros,compta,extension', `[${W}] la démonstration a cinq écrans, dans l'ordre`, vus.join(','));
      const sw = await pg.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      dit(sw[0] <= sw[1] + 1, `[${W}] aucun débordement horizontal`, sw.join(' > '));
      // La voix : retour au premier écran, on l'allume, la fin de la lecture fait avancer.
      for (let i = 0; i < 4; i++) await pg.click('.vrm-bienvenue-second >> text=Retour');
      dit(await etat() === 'journee', `[${W}] « Retour » revient en arrière`, String(await etat()));
      const voix = pg.locator('[data-bienvenue-voix]');
      dit(await voix.count() === 1, `[${W}] « Écouter la visite » est proposé quand le navigateur sait parler`);
      if (await voix.count()) {
        await voix.click();
        await pg.waitForTimeout(1500);
        const dits = await pg.evaluate(() => window.__dit);
        dit(dits.length >= 2 && dits.every((d) => d.lang === 'fr-FR') && /Ma journée/.test(dits[0].texte), `[${W}] la voix lit l'écran, en français`, JSON.stringify(dits.slice(0, 2)));
        const apres = await etat();
        dit(apres !== 'journee', `[${W}] la fin de la lecture passe à l'écran suivant`, apres);
        await voix.click().catch(() => {});
      }
      // Fin : « Terminer » puis « Commencer ».
      while (await pg.locator('[data-bienvenue-suivant]').count()) { await pg.click('[data-bienvenue-suivant]'); await pg.waitForTimeout(150); }
      await pg.click('[data-bienvenue-commencer]');
      await pg.waitForTimeout(600);
      dit(await pg.locator('.vrm-bienvenue').count() === 0, `[${W}] « Commencer » ferme la présentation`);
      const vue = await pg.evaluate(() => localStorage.getItem('vrm_bienvenue_vue'));
      dit(!!vue, `[${W}] elle est notée vue`, String(vue));
      await pg.waitForTimeout(1500);
      await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3500);
      dit(await pg.locator('.vrm-bienvenue').count() === 0, `[${W}] rechargée, elle ne revient pas`);
      // 27 oct. — Julien : « supprime Présentation de VRM dans les paramètres ».
      await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3000);
      dit(await pg.locator('[data-reglage-bienvenue]').count() === 0 && !/Présentation de VRM/.test(await pg.evaluate(() => document.body.innerText)), `[${W}] Réglages ne propose plus « Présentation de VRM »`);
      await ctx.close();
      // L'autre sens : un vendeur qui a déjà un compte Vinted.
      const b = await page(nav, { telephone, comptes: [{ vinted_user_id: '777', login: 'vendeuse', owner: SESSION.user.id }] });
      dit(await b.pg.locator('.vrm-bienvenue').count() === 0, `[${W}] l'autre sens : un vendeur déjà branché ne la voit pas`);
      // Le mouvement entre écrans.
      const anim = async (p) => {
        await p.evaluate(() => { const m = document.querySelector('.vrm-main'); window.__anim = []; m && m.addEventListener('animationstart', (e) => { if (e.target === m) window.__anim.push(e.animationName); }); });
        const lien = p.locator('nav').getByRole('button', { name: 'Vinted', exact: true }).first();
        await lien.click(); await p.waitForTimeout(500);
        return p.evaluate(() => window.__anim);
      };
      const a = await anim(b.pg);
      dit(a.includes('vrm-ecran-entree'), `[${W}] changer d'écran : le contenu entre en fondu`, JSON.stringify(a));
      await b.ctx.close();
      const c = await page(nav, { telephone, comptes: [{ vinted_user_id: '777', login: 'vendeuse', owner: SESSION.user.id }], reduit: true });
      const a2 = await anim(c.pg);
      dit(a2.length === 0, `[${W}] « réduire les animations » : aucun mouvement`, JSON.stringify(a2));
      await c.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e.message).slice(0, 200)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ bienvenue : ${ko} défaut(s)` : '\n✅ bienvenue : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
