require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « OUVERTURE AUX CLIENTS » (12 nov., lot agent2-ouverture-clients) —
//  RENDU, 390 px tactile et 1512 px, clair et sombre :
//    P  Paramètres → « Ouvrir les paiements » (propriétaire) : la liste ✓ / À faire
//       / — lue par le VRAI api/compte.js dans un monde simulé (faux Stripe) ;
//       les vraies mentions du dépôt (vides) ⇒ « À faire » nommé ; toucher une
//       ligne dit où cliquer ; rien ne déborde ; un VENDEUR n'a pas l'entrée ;
//    F  le « ? » de Paramètres : « Les questions les plus posées » (10) ;
//    S  « Signaler un problème » : la case « Réponds-moi par e-mail » décochée,
//       « Ou écris à … ».
//  Aucune vraie clé, aucune donnée réelle (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { creerMonde, appeler, brancherEnv } = require(path.join(__dirname, '..', '_monde-paiement.cjs'));
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4549;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-ouverture-clients');
fs.mkdirSync(CAPTURES, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0].slice(0, 200)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

(async () => {
  const ex = await import('file://' + path.join(RACINE, 'src', 'exempleDonnees.js'));
  const exBase = await import('file://' + path.join(RACINE, 'src', 'exempleBase.js'));
  const jeu = ex.jeuExemple(Date.now());
  const main = jeu.lignes.find((l) => l.id === 'main');
  if (main) main.data.vrm_configuration = { etat: 'fait', at: new Date().toISOString(), statut: null, version: 1 };
  const M = creerMonde({ proprio: ex.UID_EXEMPLE, obligatoire: false });
  brancherEnv(M);
  global.fetch = M.fetch;
  const compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default;
  const jeton = (id, email) => { const j = `eyJhbGciOiJub25lIn0.${b64({ sub: id, email, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`; M.users[j] = { id, email, created_at: new Date().toISOString() }; return j; };
  const PROPRIO = { id: ex.UID_EXEMPLE, email: 'proprio@exemple.test' }; PROPRIO.jeton = jeton(PROPRIO.id, PROPRIO.email);
  const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const cgv = fs.readFileSync(path.join(RACINE, 'public', 'legal', 'cgv.html'), 'utf8');
  async function ouvrir({ qui = PROPRIO, largeur = 1512, sombre = false, vue = 'reglages', proprio = true }) {
    const mobile = largeur < 600;
    const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light' });
    const pg = await ctx.newPage();
    const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
    const session = { access_token: qui.jeton, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: qui.id, email: qui.email } };
    await pg.addInitScript(({ s, vue, sombre }) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_mfa_plus_tard_' + s.user.id, String(Date.now())); localStorage.setItem('vrm_reglages_vue', vue); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: new Date().toISOString() })); localStorage.setItem('vrm_parcours_plus_tard', JSON.stringify({ at: Date.now() })); } catch (_) {} }, { s: session, vue, sombre });
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue());
    await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: qui.jeton, refresh_token: 'r', expires_in: 3600, user: session.user }) }));
    await pg.route('**/rest/v1/**', async (r) => {
      const u = r.request().url(), m = r.request().method();
      if (/rpc\/vrm_acces/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ obligatoire: false, proprietaire: proprio, acces: true, lecture: true }) });
      if (/\/rpc\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
      const url = new URL(u), table = url.pathname.slice('/rest/v1/'.length).split('/')[0];
      const t = table === 'app_data' ? { lignes: jeu.lignes } : table === 'vinted_accounts' ? { lignes: jeu.comptes } : { lignes: [] };
      const x = exBase.servirTable(t, { methode: m, url: url.pathname + url.search, entetes: r.request().headers(), corps: r.request().postData(), owner: ex.UID_EXEMPLE });
      return r.fulfill({ status: x.status, headers: x.headers, body: x.status === 204 || x.body == null ? '' : (typeof x.body === 'string' ? x.body : JSON.stringify(x.body)) });
    });
    await pg.route('**/legal/cgv.html', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: cgv }));
    await pg.route('**/api/**', async (r) => {
      const q = r.request(), url = new URL(q.url());
      if (url.pathname === '/api/compte' && /^(abonnement|parrainage|factures)$/.test(url.searchParams.get('mode') || '')) {
        const res = await appeler(compte, { method: q.method(), query: Object.fromEntries(url.searchParams), headers: q.headers(), corps: q.postData() });
        const corps = res.corps || {};
        // Un VENDEUR : la base ne le dit pas propriétaire (rpc ci-dessus) ; la route non plus.
        return r.fulfill({ status: res.code || 200, contentType: 'application/json', body: JSON.stringify(proprio ? corps : { ...corps, proprietaire: false, ouverture: undefined }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(3800);
    return { ctx, pg, erreurs };
  }
  const tap = async (pg, sel, mobile) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (mobile) await l.tap(); else await l.click(); };
  const capture = (pg, nom) => pg.screenshot({ path: path.join(CAPTURES, nom + '.png') }).catch(() => {});

  try {
    console.log('\n── P · Ouvrir les paiements (propriétaire)');
    for (const [largeur, sombre] of [[1512, false], [390, true], [390, false], [1512, true]]) {
      await essaie(`P ${largeur}`, async () => {
        const { ctx, pg, erreurs } = await ouvrir({ largeur, sombre });
        const T = `${largeur}${sombre ? ' sombre' : ''}`;
        await tap(pg, '[data-reglage-paiements]', largeur < 600);
        await pg.locator('[data-ouvrir-paiements]:not([data-ouvrir-paiements="chargement"])').first().waitFor({ timeout: 15000 });
        const x = await pg.evaluate(() => {
          const w = document.querySelector('[data-ouvrir-paiements]');
          const l = [...document.querySelectorAll('[data-etape-paiement]')].map((e) => [e.getAttribute('data-etape-paiement'), e.getAttribute('data-etat')]);
          const btn = [...document.querySelectorAll('[data-etape-paiement] button')].map((b) => b.getBoundingClientRect().height);
          return { etat: w.getAttribute('data-ouvrir-paiements'), ok: w.getAttribute('data-paiements-ok'), total: w.getAttribute('data-paiements-total'), l, hMin: Math.min(...btn), texte: w.innerText, deborde: document.documentElement.scrollWidth - window.innerWidth };
        });
        const e = Object.fromEntries(x.l);
        dit(x.total === '10' && e.mentions === 'manque' && e.cle === 'ok' && e.secret === 'ok' && e.webhook === 'ok' && e.prixSolo === 'ok' && e.prixPro === 'ok' && e.cgv === 'ok' && e.modeReel === 'manque' && x.etat === 'ferme' && !erreurs.length,
          `${T} · 10 prérequis LUS : mentions (vraies, vides) et mode réel « À faire », le reste ✓`, JSON.stringify(e) + ' ' + erreurs.join('|'));
        dit(/Mentions légales/.test(x.texte) && /raison sociale/.test(x.texte) && /Paiements fermés/.test(x.texte) && /sur 10 prêts/.test(x.texte), '  le geste nomme les champs vides ; « Paiements fermés » ; « N sur 10 prêts »', x.texte.replace(/\n/g, ' · ').slice(0, 200));
        dit(x.hMin >= 44 && x.deborde <= 0, '  cibles ≥ 44 px, rien ne déborde', `${x.hMin} · ${x.deborde}`);
        await tap(pg, '[data-etape-paiement="webhook"] button', largeur < 600);
        const ou = await pg.locator('[data-etape-paiement="webhook"] [data-ou-cliquer]').innerText().catch(() => '');
        dit(/Stripe → Développeurs → Webhooks/.test(ou), '  toucher une ligne dit OÙ cliquer', ou);
        await pg.locator('[data-ouvrir-paiements]').scrollIntoViewIfNeeded();
        await capture(pg, `paiements-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }
    await essaie('P vendeur', async () => {
      const { ctx, pg } = await ouvrir({ proprio: false });
      dit((await pg.locator('[data-reglage-paiements]').count()) === 0, 'un VENDEUR n’a pas l’entrée « Ouvrir les paiements »');
      await ctx.close();
    });

    console.log('\n── F · la FAQ dans le « ? »');
    for (const [largeur, sombre] of [[390, false], [1512, true]]) {
      await essaie(`F ${largeur}`, async () => {
        const { ctx, pg, erreurs } = await ouvrir({ largeur, sombre });
        await tap(pg, '[data-aide-ouvrir="settings"]', largeur < 600);
        await pg.locator('[data-aide-faq]').first().waitFor({ timeout: 8000 });
        const n = await pg.locator('[data-aide-faq]').getAttribute('data-aide-faq');
        const q = await pg.locator('[data-aide-faq] summary').allInnerTexts();
        dit(n === '10' && /Combien coûte VRM/.test(q[0]) && q.some((t) => /Supprimer mon compte/.test(t)) && !erreurs.length, `${largeur} · « Les questions les plus posées » : 10, du prix à « J’ai un problème »`, q.map((t) => t.trim()).join(' | ').slice(0, 220));
        await pg.locator('[data-aide-faq] [data-aide-fiche="faq-prix"] summary').click();
        const t = await pg.locator('[data-aide-faq] [data-aide-fiche="faq-prix"]').innerText();
        dit(/16,99 €/.test(t) && /19,99 €/.test(t), '  « Combien coûte VRM ? » : Solo 16,99 €, Pro 19,99 €');
        await pg.locator('[data-aide-faq]').scrollIntoViewIfNeeded();
        await capture(pg, `faq-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }

    console.log('\n── S · « Signaler un problème »');
    for (const [largeur, sombre] of [[390, true], [1512, false]]) {
      await essaie(`S ${largeur}`, async () => {
        const { ctx, pg } = await ouvrir({ largeur, sombre });
        await tap(pg, '[data-reglage-signaler]', largeur < 600);
        await pg.locator('[data-feuille-signaler]').first().waitFor({ timeout: 8000 });
        const c = await pg.evaluate(() => ({ repondre: (document.querySelector('[data-signaler-repondre]') || {}).getAttribute && document.querySelector('[data-signaler-repondre]').getAttribute('data-signaler-repondre'), coche: !!(document.querySelector('[data-signaler-repondre] input') || {}).checked, contact: (document.querySelector('[data-signaler-contact]') || {}).innerText || '', ajouts: (document.querySelector('[data-signaler-ajouts]') || {}).innerText || '', h: (document.querySelector('[data-signaler-repondre]') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height }));
        dit(c.repondre === 'non' && !c.coche && /Ou écris à .+@.+/.test(c.contact) && /ni adresse e-mail/.test(c.ajouts) && c.h >= 44, `${largeur} · case « Réponds-moi par e-mail » décochée (44 px), « Ou écris à … »`, JSON.stringify(c));
        await pg.locator('[data-signaler-repondre]').click();
        const a = await pg.locator('[data-signaler-ajouts]').innerText();
        dit(/ton e-mail de connexion pour te répondre/.test(a), '  cochée : la feuille DIT que l’e-mail part avec', a);
        await capture(pg, `signaler-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }
  } finally {
    await nav.close(); srv.close();
    console.log(`\n  captures : ${CAPTURES}`);
    console.log(ko ? `\n❌ ouverture-clients : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ ouverture-clients : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
