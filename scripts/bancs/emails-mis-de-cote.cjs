// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES EMAILS MIS DE CÔTÉ SE LISENT PAR LA ROUTE (6 octobre)
//        node scripts/bancs/emails-mis-de-cote.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Base cloisonnée, un email non attribué vit sous un propriétaire NEUTRE que
// personne n'a : RLS ne le montre à AUCUN vendeur. L'app le lisait sous RLS —
// elle ne voyait donc plus rien, et le vendeur qui venait de déclarer son
// adresse ne retrouvait jamais l'email arrivé avant. Elle lit maintenant
// `/api/email-rattacher?mode=liste`, AVEC sa session.
//
// Le banc sert ce que voit vraiment un vendeur : la lecture RLS de la
// quarantaine rend `[]` (les lignes neutres lui sont invisibles), la route rend
// les emails qui sont À LUI. Trois états, jamais deux :
//   · lu        → les emails sont proposés, « C'est à moi » rejoue le BON ;
//   · pas su    → une phrase le dit (jamais « rien à réclamer ») ;
//   · lu, vide  → rien, aucune fausse alerte.
// Et Ma journée rattrape en fond ce que la route rend — rien quand elle ne
// répond pas.
// ⚠️ Données INVENTÉES : aucune fixture, le banc vit dans le dépôt.
const path = require('path'), http = require('http'), fs = require('fs');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4801;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '22222222-2222-2222-2222-222222222222', email: 'vendeuse@exemple.test' } };
const EMAILS = [
  { id: 'email_quarantaine_banc0001', sujet: 'Ton article est vendu ! (banc)', raison: 'adresse de réception inconnue', quand: '2026-10-05T09:00:00.000Z' },
  { id: 'email_quarantaine_banc0002', sujet: 'Bordereau de banc', raison: 'adresse de réception inconnue', quand: '2026-10-04T09:00:00.000Z' },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// `liste` : ce que rend la route — un tableau, ou 'panne' (503).
async function ouvrir(nav, { liste, tab = 'settings', viewport = { width: 1512, height: 950 } }) {
  const ctx = await nav.newContext({ viewport });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  const lecturesRls = [];
  await pg.route('**/rest/v1/**', (r) => {
    const u = decodeURIComponent(r.request().url());
    if (/email_quarantaine/.test(u)) lecturesRls.push(u.replace(/^.*\/rest\/v1\//, ''));
    // Le registre du vendeur : une adresse déclarée.
    if (/id=eq\.vrm_email_owners/.test(u) && r.request().method() === 'GET') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ data: { adresses: { 'vendeuse@exemple.test': { owner: SESSION.user.id, label: '' } } } }]) });
    }
    // Tout le reste — y compris la quarantaine lue sous RLS : `[]`, car les
    // lignes du propriétaire neutre sont invisibles à un vendeur.
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  const appels = [];
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/\/api\/email-rattacher/.test(u)) {
      const m = r.request().method();
      let corps = null; try { corps = JSON.parse(r.request().postData() || 'null'); } catch (_) {}
      appels.push({ m, liste: /mode=liste/.test(u), auth: r.request().headers().authorization || '', corps });
      if (m === 'GET') {
        return liste === 'panne' ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"base-injoignable"}' })
          : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emails: liste }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, resultat: { ok: true, type: 'vente' } }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  return { ctx, pg, erreurs, appels, lecturesRls };
}
// Le panneau « Mes adresses de réception », lu sur ce qui est RENDU.
const panneau = (pg) => pg.evaluate(() => {
  const t = [...document.querySelectorAll('div')].find((d) => d.firstElementChild && /^Mes adresses de réception$/.test((d.firstElementChild.innerText || '').trim()));
  if (!t) return null;
  return { texte: t.innerText, pasSu: !!t.querySelector('[data-mis-de-cote="pas-su"]'), boutons: [...t.querySelectorAll('button')].map((b) => b.innerText.trim()) };
});

(async () => {
  await new Promise((res, rej) => { srv.once('error', (e) => rej(e)); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const viewport of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) {
      console.log(`\n── Réglages, ${viewport.width} px : la liste vient de la route`);
      await essaie('lu', async () => {
        const { ctx, pg, erreurs, appels, lecturesRls } = await ouvrir(nav, { liste: EMAILS, viewport });
        const p = await panneau(pg);
        dit(!!p, 'le panneau « Mes adresses de réception » est rendu', p ? '' : 'introuvable');
        // Regarder la capture fait partie du test (§6.2) : CAPTURE_DIR=… pour l'écrire.
        if (process.env.CAPTURE_DIR) {
          const el = pg.locator('div', { hasText: /^Mes adresses de réception/ }).last();
          await el.scrollIntoViewIfNeeded().catch(() => {});
          await pg.screenshot({ path: path.join(process.env.CAPTURE_DIR, `mis-de-cote-${viewport.width}.png`) }).catch(() => {});
        }
        const g = appels.filter((a) => a.liste);
        dit(g.length >= 1 && g.every((a) => a.auth === 'Bearer jeton-de-banc'),
          'la liste est demandée à la ROUTE, avec la session', JSON.stringify(g.map((a) => a.auth)));
        dit(p && /2 emails en attente/.test(p.texte) && /vendu ! \(banc\)/.test(p.texte) && /Bordereau de banc/.test(p.texte),
          'les deux emails que la route dit À LUI sont proposés (la lecture RLS, elle, ne voit rien)', p && p.texte.replace(/\n/g, ' ').slice(0, 220));
        dit(p && !p.pasSu, 'lu : aucune phrase de panne');
        dit(lecturesRls.length === 0, 'la quarantaine n’est plus lue sous RLS (les lignes neutres y sont invisibles)', lecturesRls.join(' · '));
        // « C'est à moi » rejoue CE email, avec la session.
        const avant = appels.length;
        const b = pg.locator('button', { hasText: "C'est à moi" }).first();
        if (await b.count()) { await b.click(); await pg.waitForTimeout(1500); }
        const post = appels.slice(avant).find((a) => a.m === 'POST');
        dit(!!post && post.corps && post.corps.id === EMAILS[0].id && post.auth === 'Bearer jeton-de-banc',
          '« C’est à moi » rejoue CET email-là, avec la session', JSON.stringify(post || null));
        const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
        dit(erreurs.length === 0, 'aucune erreur d’app', erreurs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      await essaie('pas su', async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { liste: 'panne', viewport });
        const p = await panneau(pg);
        dit(p && p.pasSu && !/en attente d'un propriétaire/.test(p.texte),
          'route muette : la phrase « pas pu vérifier » — jamais un silence qui se lit « rien à réclamer »', p && p.texte.replace(/\n/g, ' ').slice(-200));
        dit(erreurs.length === 0, 'aucune erreur d’app', erreurs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      await essaie('lu, vide', async () => {
        const { ctx, pg } = await ouvrir(nav, { liste: [], viewport });
        const p = await panneau(pg);
        dit(p && !p.pasSu && !/en attente d'un propriétaire/.test(p.texte), 'l’autre sens : rien à réclamer → ni bloc, ni fausse alerte', p && p.texte.replace(/\n/g, ' ').slice(-160));
        await ctx.close();
      });
    }

    console.log('\n── Ma journée : le rattrapage en fond rejoue ce que la ROUTE rend');
    await essaie('rattrapage', async () => {
      const { ctx, appels, lecturesRls } = await ouvrir(nav, { liste: EMAILS, tab: 'journee' });
      const posts = appels.filter((a) => a.m === 'POST');
      const ids = posts.map((a) => a.corps && a.corps.id).sort();
      dit(appels.some((a) => a.liste) && ids.join(',') === EMAILS.map((e) => e.id).sort().join(','),
        'les deux emails à lui sont rejoués, un par un', ids.join(', ') || 'aucun');
      dit(posts.length > 0 && posts.every((a) => a.corps && a.corps.silencieux === true && a.auth === 'Bearer jeton-de-banc'),
        'en silence (aucune notification pour un rattrapage), avec la session', JSON.stringify(posts.map((a) => [a.corps && a.corps.silencieux, a.auth])));
      dit(lecturesRls.length === 0, 'et pas une lecture de la quarantaine sous RLS', lecturesRls.join(' · '));
      await ctx.close();
    });
    await essaie('rattrapage, route muette', async () => {
      const { ctx, appels } = await ouvrir(nav, { liste: 'panne', tab: 'journee' });
      dit(appels.some((a) => a.liste) && !appels.some((a) => a.m === 'POST'), 'route muette : rien n’est rejoué (rien lu ne vaut pas « tout rattraper »)',
        JSON.stringify(appels.map((a) => a.m)));
      await ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ emails mis de côté : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ emails mis de côté : ${ok} contrôles — lus par la route, trois états`);
  process.exit(ko ? 1 : 0);
})();
