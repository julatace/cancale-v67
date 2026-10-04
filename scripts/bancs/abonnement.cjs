// ════════════════════════════════════════════════════════════════════════════
//  BANC « ABONNEMENT » — la carte de Réglages et la porte, RENDUES.
//
//  Demande de Julien (4 octobre) : 9,99 € par mois, pour tout le monde sauf
//  lui. Le serveur décide (api/compte.js, vérifié par audit-abonnement.cjs) ;
//  ce banc vérifie que l'app DIT ce que le serveur sait, et rien de plus :
//    · chaque état du serveur donne SA carte (`data-abonnement`) — et un état
//      illisible n'affirme rien (« pas su » ≠ « pas abonné ») ;
//    · le propriétaire ne voit aucun bouton de paiement ;
//    · la porte ne se ferme QUE si la BASE dit « pas d'accès » (`acces`, la
//      règle `vrm_regle_acces` qui ferme aussi ses lignes) — jamais sur une
//      réponse illisible (on ne bloque pas un abonné sur un hoquet), et l'app
//      ne recalcule rien de son côté (§11) ;
//    · un prélèvement en échec depuis plus de 14 jours envoie mettre la carte à
//      jour (le portail), jamais repayer un second abonnement ;
//    · « S'abonner » envoie vers une page Stripe et rien d'autre.
//  Aucune fixture : comptes et statuts inventés ici (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4538;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeuse@exemple.test' } };
const PRIX = { montant: 9.99, devise: 'eur', intervalle: 'month' };
const base = { ok: true, proprietaire: false, configure: true, modeTest: true, obligatoire: false, prix: PRIX, statut: null, finPeriode: null, annuleFinPeriode: false, peutGerer: false, actif: false, acces: true };
const ETATS = {
  sans: { ...base },
  actif: { ...base, statut: 'active', finPeriode: '2026-11-04T10:00:00.000Z', peutGerer: true, actif: true },
  resilie: { ...base, statut: 'active', finPeriode: '2026-11-04T10:00:00.000Z', annuleFinPeriode: true, peutGerer: true, actif: true },
  impaye: { ...base, statut: 'past_due', peutGerer: true, actif: true },
  proprietaire: { ...base, proprietaire: true, actif: true },
  nonBranche: { ...base, configure: false, modeTest: null, prix: null },
};

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 160)); } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// `abo` : la réponse de /api/compte?mode=abonnement — un objet, ou 'panne' (503).
async function ouvrir(nav, { abo, tab = 'settings', checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_banc' }) {
  const ctx = await nav.newContext({ viewport: { width: 1512, height: 950 } });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    // ⚠️ Le faux site est SERVI : s'il ne répondait pas, Chromium afficherait
    //    une page d'erreur à une autre adresse, et le contrôle « jamais suivie »
    //    serait vert sur le défaut (vu sur le code réaffaibli).
    if (/checkout\.stripe\.com|billing\.stripe\.com|site-pirate\.example/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>stripe</body></html>' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = r.request().url();
    if (/select=owner/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  const appels = [];
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/\/api\/compte\?mode=abonnement/.test(u)) {
      return abo === 'panne' ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"erreur":"base-injoignable"}' })
        : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(abo) });
    }
    if (/\/api\/compte\?mode=(checkout|portail)/.test(u)) {
      appels.push({ mode: /checkout/.test(u) ? 'checkout' : 'portail', auth: r.request().headers().authorization || '' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: checkoutUrl }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  return { ctx, pg, erreurs, appels };
}
const etatCarte = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-abonnement]'); return e ? e.getAttribute('data-abonnement') : null; });
const texteCarte = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-abonnement]'); return e ? e.innerText : ''; });
const boutons = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-abonnement]'); return e ? [...e.querySelectorAll('button')].map((b) => b.innerText.trim()) : []; });

(async () => {
  await new Promise((res, rej) => { srv.once('error', (e) => rej(e)); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    console.log('\n── La carte suit ce que le serveur sait');
    const attendus = { sans: 'sans', actif: 'actif', resilie: 'actif', impaye: 'impaye', proprietaire: 'proprietaire', nonBranche: 'non-branche' };
    for (const [nom, rendu] of Object.entries(attendus)) {
      await essaie(nom, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { abo: ETATS[nom] });
        const e = await etatCarte(pg), b = await boutons(pg), t = await texteCarte(pg);
        dit(e === rendu && erreurs.length === 0, `serveur « ${nom} » → carte « ${rendu} »`, `rendu ${e} ${erreurs.join(' | ')}`);
        if (nom === 'sans') dit(b.some((x) => /abonner/i.test(x)) && /9,99/.test(t), '  sans abonnement : le prix et le bouton pour s’abonner', b.join(' · '));
        if (nom === 'actif') dit(b.some((x) => /gérer|résilier/i.test(x)) && !b.some((x) => /abonner/i.test(x)) && /4 novembre 2026/.test(t), '  abonné : la date du prochain prélèvement et « gérer », jamais un second « s’abonner »', t.replace(/\n/g, ' ').slice(0, 120));
        if (nom === 'resilie') dit(/accès jusqu'au 4 novembre 2026/.test(t), '  résilié : jusqu’à quand l’accès reste ouvert', t.replace(/\n/g, ' ').slice(0, 120));
        if (nom === 'proprietaire') dit(b.length === 0 && /gratuit/i.test(t), '  propriétaire : gratuit, et AUCUN bouton de paiement', b.join(' · '));
        if (nom === 'nonBranche') dit(b.length === 0, '  paiement pas branché : aucun bouton qui mènerait nulle part', b.join(' · '));
        if (nom === 'sans' || nom === 'actif') dit(/mode test/i.test(t), '  le mode test est dit (aucune vraie carte débitée)');
        await ctx.close();
      });
    }
    await essaie('panne', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: 'panne' });
      const e = await etatCarte(pg), b = await boutons(pg);
      dit(e === 'pas-su' && b.length === 0, 'statut illisible → « pas su », ni « abonné » ni « s’abonner »', `rendu ${e} · ${b.join(' · ')}`);
      await ctx.close();
    });

    console.log('\n── « S’abonner » mène à Stripe, avec la session');
    await essaie('clic', async () => {
      const { ctx, pg, appels } = await ouvrir(nav, { abo: ETATS.sans });
      await pg.locator('[data-abonnement] button', { hasText: /abonner/i }).first().click();
      await pg.waitForURL(/checkout\.stripe\.com/, { timeout: 6000 }).catch(() => {});
      dit(appels.some((a) => a.mode === 'checkout' && a.auth === 'Bearer jeton-de-banc'), 'le serveur reçoit la demande AVEC le jeton de session (c’est lui qui sait qui paie)', JSON.stringify(appels));
      dit(/checkout\.stripe\.com/.test(pg.url()), 'la page s’ouvre chez Stripe', pg.url());
      await ctx.close();
    });
    await essaie('url hostile', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: ETATS.sans, checkoutUrl: 'https://site-pirate.example/payer' });
      await pg.locator('[data-abonnement] button', { hasText: /abonner/i }).first().click();
      await pg.waitForTimeout(1200);
      dit(!/site-pirate/.test(pg.url()), 'une adresse de paiement qui n’est pas Stripe n’est jamais suivie', pg.url());
      await ctx.close();
    });

    console.log('\n── La porte');
    await essaie('porte fermée', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: { ...ETATS.sans, obligatoire: true, acces: false }, tab: 'journee' });
      const porte = await pg.evaluate(() => !!document.querySelector('[data-abonnement-requis]'));
      const appVisible = await pg.evaluate(() => /Bonjour|Bonsoir|Bon après-midi/.test(document.body.innerText));
      dit(porte && !appVisible, 'obligatoire + pas abonné → l’écran d’abonnement, pas l’app');
      const t = await pg.evaluate(() => (document.querySelector('[data-abonnement-requis]') || {}).innerText || '');
      dit(/9,99/.test(t) && /déconnecter/i.test(t), '  il dit le prix et laisse se déconnecter', t.replace(/\n/g, ' ').slice(0, 120));
      await ctx.close();
    });
    await essaie('impayé 14 jours', async () => {
      const { ctx, pg, appels } = await ouvrir(nav, { abo: { ...ETATS.impaye, obligatoire: true, acces: false }, tab: 'journee' });
      const porte = await pg.evaluate(() => !!document.querySelector('[data-abonnement-requis]'));
      const t = await pg.evaluate(() => (document.querySelector('[data-abonnement-requis]') || {}).innerText || '');
      dit(porte && /14 jours/.test(t) && /intactes/.test(t), 'impayé depuis plus de 14 jours → la porte, qui dit pourquoi et que rien n’est perdu', t.replace(/\n/g, ' ').slice(0, 140));
      await pg.locator('[data-abonnement-requis] button', { hasText: /carte/i }).first().click();
      await pg.waitForTimeout(1200);
      dit(appels.some((a) => a.mode === 'portail') && !appels.some((a) => a.mode === 'checkout'), '  le bouton met la CARTE à jour (portail) — jamais un second abonnement', JSON.stringify(appels));
      await ctx.close();
    });
    await essaie('la base décide', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: { ...ETATS.actif, obligatoire: true, acces: false }, tab: 'journee' });
      const porte = await pg.evaluate(() => !!document.querySelector('[data-abonnement-requis]'));
      dit(porte, 'la porte suit la réponse de la BASE (`acces`), pas un recalcul à partir du statut');
      await ctx.close();
    });
    for (const [nom, abo] of [
      ['obligatoire + abonné', { ...ETATS.actif, obligatoire: true }],
      ['obligatoire + impayé (Stripe réessaie)', { ...ETATS.impaye, obligatoire: true }],
      ['obligatoire + propriétaire', { ...ETATS.proprietaire, obligatoire: true }],
      ['pas obligatoire + pas abonné', ETATS.sans],
      ['statut illisible', 'panne'],
    ]) {
      await essaie(nom, async () => {
        const { ctx, pg } = await ouvrir(nav, { abo, tab: 'journee' });
        const porte = await pg.evaluate(() => !!document.querySelector('[data-abonnement-requis]'));
        dit(!porte, `${nom} → l’app reste ouverte`);
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e && e.message || e).slice(0, 160)); }
  finally {
    await nav.close(); srv.close();
    console.log(ko ? `\n❌ abonnement (rendu) : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ abonnement (rendu) : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
