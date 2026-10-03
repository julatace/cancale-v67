// ════════════════════════════════════════════════════════════════════════════
//  BANC « DÉMARRAGE » — la base hoquette au moment où l'app s'ouvre.
//
//  Julien, 3 octobre : « dès que je vais sur VRM je reçois environ 300 notifs »
//  et « quand je me suis reconnecté, ça m'a redit d'installer l'extension,
//  comme si je débutais ». Une seule cause, mesurée :
//   · la sonde de démarrage (« la base est-elle cloisonnée ? ») rendait `false`
//     sur tout échec — 502, réseau, plus de 4 s — et l'app lisait alors avec la
//     clé PUBLIQUE, que RLS filtre en `[]` SANS ERREUR : boutique vide,
//     « installe l'extension » ;
//   · le centre de notifications mémorisait « 0 vente », puis à l'ouverture
//     suivante comptait TOUTES les ventes comme nouvelles.
//
//  Ce banc sert la VRAIE forme d'une base cloisonnée : avec le jeton du vendeur
//  on lit ses lignes, avec la clé publique on reçoit `[]` (200, pas d'erreur).
//  Aucune fixture : tout est synthétique.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');   // jamais un chemin absolu (§6.1)
const PORT = 4502;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.zip':'application/zip', '.webmanifest':'application/manifest+json' };

const JETON = 'jeton-de-banc';
const SESSION = { access_token: JETON, refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.fr' } };
const COMPTE = { vinted_user_id: '900000001', login: 'compte-de-banc', access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString() };
const vente = (i) => ({ transaction_id: 70000 + i, title: 'Paire ' + i, status: 'Commande finalisée', price: { amount: '40.0', currency_code: 'EUR' }, date: new Date(Date.now() - i * 3600e3).toISOString() });

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

// Une ouverture de l'app. `etat` : { sondeKO, ventesKO, nVentes }
async function ouvrir(ctx, { sondeKO = false, ventesKO = false, nVentes = 300 } = {}) {
  const pg = await ctx.newPage();
  const lus = { anonymes: 0 };
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: JETON, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = decodeURIComponent(r.request().url());
    const h = r.request().headers();
    const json = (d, extra) => r.fulfill({ status: 200, contentType: 'application/json', headers: Object.assign({ 'access-control-allow-origin': '*' }, extra || {}), body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return sondeKO ? r.fulfill({ status: 502, contentType: 'text/html', body: '<html>502</html>' }) : json([]);
    if (r.request().method() !== 'GET') return json([]);
    // ⚠️ LA VRAIE FORME D'UNE BASE CLOISONNÉE : la clé publique lit `[]`, sans erreur.
    const vendeur = String(h.authorization || '').includes(JETON);
    if (!vendeur) { lus.anonymes++; (lus.urls = lus.urls || []).push(u.replace(/^.*\/rest\/v1\//, '').slice(0, 90)); return json([]); }
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json([COMPTE]);
    if (/orders_/.test(u)) {
      if (ventesKO) return r.fulfill({ status: 502, contentType: 'text/html', body: '<html>502</html>' });
      const v = Array.from({ length: nVentes }, (_, i) => vente(i));
      return json([{ id: `harvest_${COMPTE.vinted_user_id}_orders_sold`, data: { capturedAt: new Date().toISOString(), payload: { my_orders: v } }, cap: new Date().toISOString() }]);
    }
    return json([], { 'content-range': '0-0/0' });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(sondeKO ? 9000 : 6000);
  const txt = await pg.evaluate(() => document.body.innerText);
  const etape = await pg.evaluate(() => { const e = document.querySelector('[data-etape]'); return e ? e.getAttribute('data-etape') : null; });
  const nouv = (/(\d+) nouvelles? ventes?/.exec(txt) || [])[1];
  const seen = await pg.evaluate(() => { try { return (JSON.parse(localStorage.getItem('vinted_notif_seen_ventes')||'null')||[]).length; } catch(_) { return -1; } }).catch(()=>-2);
  if (process.env.DEBUG) console.log('   [debug]', JSON.stringify(lus.urls||[]), 'seen', seen, (txt.match(/.*nouvelle.*/g)||[]).slice(0,3));
  await pg.close();
  return { txt, etape, nouv: nouv ? Number(nouv) : 0, erreurs, anonymes: lus.anonymes };
}

(async () => {
  try { await ecouter(); } catch (e) { console.log('  ❌ ' + e.message); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    // ── 1. La sonde de démarrage échoue (502), la session est bonne ─────────
    console.log('\n── La sonde de démarrage échoue : l\'app ne doit pas se croire vide');
    {
      const ctx = await nav.newContext({ viewport: { width: 1512, height: 950 } });
      await ctx.addInitScript((s) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
      const r = await ouvrir(ctx, { sondeKO: true });
      dit(r.etape == null, 'pas de carte « premiers pas / installe l\'extension » pour un vendeur qui a un compte', 'état rendu : ' + r.etape);
      { const m = /.*(Lie un compte Vinted|Aucun compte Vinted|Bienvenue).*/i.exec(r.txt); dit(!m, 'la boutique n\'est pas présentée comme vide', m ? m[0].slice(0, 120) : ''); }
      dit(r.anonymes === 0, 'aucune lecture faite SANS le jeton du vendeur', r.anonymes + ' lecture(s) anonyme(s)');
      dit(r.erreurs.length === 0, 'aucune erreur d\'app', r.erreurs.join(' | '));
      await ctx.close();
    }
    // ── 2. Trois ouvertures : pleine, lecture ratée, pleine ─────────────────
    console.log('\n── Une lecture ratée ne fabrique pas « 300 nouvelles ventes » à l\'ouverture suivante');
    {
      const ctx = await nav.newContext({ viewport: { width: 1512, height: 950 } });
      await ctx.addInitScript((s) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
      const a = await ouvrir(ctx, { nVentes: 300 });
      dit(a.nouv === 0, 'première ouverture : rien d\'annoncé (on mémorise en silence)', a.nouv + ' annoncée(s)');
      const b = await ouvrir(ctx, { ventesKO: true });
      dit(b.nouv === 0, 'ouverture où la lecture des ventes échoue : rien d\'annoncé', b.nouv + ' annoncée(s)');
      const c = await ouvrir(ctx, { nVentes: 300 });
      dit(c.nouv === 0, 'ouverture suivante, les mêmes 300 ventes : AUCUNE « nouvelle vente »', c.nouv + ' annoncée(s)');
      const d = await ouvrir(ctx, { nVentes: 301 });
      dit(d.nouv === 1, 'l\'autre sens : une vraie nouvelle vente est bien annoncée (1)', d.nouv + ' annoncée(s)');
      await ctx.close();
    }
    // ── 3. Une sonde lente au démarrage d'un appareil déjà connu ────────────
    console.log('\n── Appareil qui connaît déjà la base cloisonnée : la sonde ne bloque plus');
    {
      const ctx = await nav.newContext({ viewport: { width: 1512, height: 950 } });
      await ctx.addInitScript((s) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
      await ouvrir(ctx, {});                                   // la sonde réussit une fois…
      const r = await ouvrir(ctx, { sondeKO: true });          // …puis échoue
      dit(r.etape == null && r.anonymes === 0, 'la base reste connue comme cloisonnée, aucune lecture anonyme', `état ${r.etape} · ${r.anonymes} anonyme(s)`);
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ démarrage : ${ko} rouge(s)` : '\n✅ démarrage : tout est vert');
  process.exit(ko ? 1 : 0);
})();
