// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE RÉGLAGE « DÉTOURER MES PHOTOS » N'EST PLUS DANS LES PARAMÈTRES
//        node scripts/bancs/detourage-reglage.cjs   (BANC_PORT pour changer de port)
// ═══════════════════════════════════════════════════════════════════════════
// 17 octobre — Julien : « le détourage de photo devra être présent QUE dans
// Vestiaire Collective, pas du tout pour Leboncoin ; ne mets pas cette
// fonctionnalité dans les paramètres ». Ce banc exige donc, sur l'écran
// Réglages rendu (390 et 1512 px) :
//   1. aucune carte ni ligne « Détourage » (ni `data-detourage-*`) ;
//   2. aucune requête vers `/api/ai?mode=detourage` (la carte interrogeait le
//      compteur du serveur à chaque ouverture) ;
//   3. même avec un ancien réglage `vrm_detourage = toutes` resté dans le
//      navigateur, rien ne réapparaît.
// L'autre sens (Réglages se rend, avec ses autres groupes) est vérifié : un
// écran mort passerait tous les contrôles d'absence.
// (29 oct.) L'onglet « Mon compte » porte la carte « Ta clé Photoroom » (une clé
// est un service de la personne) : elle range une clé, elle ne déclenche AUCUN
// détourage. Le banc rend aussi cet onglet et exige les mêmes absences — plus la
// carte elle-même (sinon « rien de détourage » serait vrai d'un écran vide).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');   // ⚠️ JAMAIS un chemin absolu (§6.1)
const PORT = Number(process.env.BANC_PORT) || 4541;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.zip':'application/zip', '.webmanifest':'application/manifest+json' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'sophie@exemple.fr' } };

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  r.end(fs.readFileSync(p));
});
const ecouter = () => new Promise((res, rej) => {
  srv.once('error', (e) => rej(e.code === 'EADDRINUSE'
    ? new Error(`le port ${PORT} est déjà pris — un autre banc tourne. Relance celui-ci seul.`) : e));
  srv.listen(PORT, () => res(srv));
});

async function rendre(nav, largeur, vue = '') {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: 1100 } });
  const pg = await ctx.newPage();
  await pg.addInitScript((s) => {
    try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {}
    try { localStorage.setItem('vrm_detourage', JSON.stringify('toutes')); } catch (_) {}
  }, SESSION);
  if (vue) await pg.addInitScript((v) => { try { localStorage.setItem('vrm_reglages_vue', v); } catch (_) {} }, vue);
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = metaVersData(r.request().url());
    if (/select=owner/.test(u) || /select=id&limit=1/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  // ⚠️ §6.6 : Playwright prend la DERNIÈRE route enregistrée en premier.
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const vues = [];
  await pg.route('**/api/ai?mode=detourage*', (r) => { vues.push(r.request().url()); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ready: true, autorise: true, n: 1, plafond: 100 }) }); });
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  await pg.route('**://*.vinted.com/**', (r) => r.abort());
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
  await pg.goto(`http://localhost:${PORT}/?tab=settings${vue ? '&vue=' + vue : ''}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4000);
  const r = await pg.evaluate(() => ({
    cartes: document.querySelectorAll('[data-detourage-etat],[data-detourage-choix],[data-detourage-mode]').length,
    texte: document.body.innerText,
    reglages: !!document.querySelector('[data-onglets-reglages]') || /Notifications/.test(document.body.innerText),
    cleCarte: !!document.querySelector('[data-photoroom-cle]'),
  }));
  await ctx.close();
  return { r, erreurs, vues };
}

(async () => {
  try { await ecouter(); } catch (e) { console.log('❌ ' + e.message); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const l of [390, 1512]) {
      const x = await rendre(nav, l);
      dit(!x.erreurs.length, `${l} px : Réglages se rend sans erreur`, x.erreurs[0] || '');
      dit(x.r.reglages, `${l} px : l'écran Réglages est bien rendu (l'autre sens)`);
      dit(x.r.cartes === 0, `${l} px : aucune carte « Détourage » dans les Paramètres`, `${x.r.cartes} élément(s)`);
      dit(!/D[ée]tourage des photos|D[ée]tourer mes photos/i.test(x.r.texte), `${l} px : le mot « Détourage » n'apparaît plus dans les Paramètres`);
      dit(x.vues.length === 0, `${l} px : aucune requête au compteur du détourage`, `${x.vues.length} requête(s)`);
      const c = await rendre(nav, l, 'compte');
      dit(!c.erreurs.length, `${l} px : Mon compte se rend sans erreur`, c.erreurs[0] || '');
      dit(c.r.cleCarte, `${l} px : Mon compte porte la carte « Ta clé Photoroom » (l'autre sens)`);
      dit(c.r.cartes === 0, `${l} px : Mon compte n'a aucun réglage de détourage`, `${c.r.cartes} élément(s)`);
      dit(!/D[ée]tourage des photos|D[ée]tourer mes photos/i.test(c.r.texte), `${l} px : Mon compte ne propose pas de « détourer mes photos »`);
      dit(c.vues.length === 0, `${l} px : ouvrir Mon compte n'interroge pas le compteur du détourage`, `${c.vues.length} requête(s)`);
    }
  } catch (e) { ko++; console.log('❌ le banc a levé — ' + (e && e.message)); }

  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge.' : '✅ Le détourage n\'est plus dans les Paramètres.'}`);
  process.exit(ko ? 1 : 0);
})();
