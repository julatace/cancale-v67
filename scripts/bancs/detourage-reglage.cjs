// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE RÉGLAGE « DÉTOURER MES PHOTOS » DIT CE QUE LE SERVEUR DIT
//        node scripts/bancs/detourage-reglage.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Le détourage Photoroom coûte à chaque photo. Le panneau de Réglages ne doit
// donc rien promettre qu'il n'a pas mesuré : la phrase vient de la MÊME source
// que ce qui se passe (`/api/ai?mode=detourage&usage=1` : clé posée ? compte
// autorisé ? combien ce mois-ci ?). Aucune fixture : des réponses inventées.
//
// Ce que ce banc exige :
//   1. cinq états (prêt · autre jeu · sans clé · réservé · pas su) → cinq
//      rendus, et l'état PORTÉ par la carte est le bon ;
//   2. le compteur SUIT la donnée (deux jeux, deux rendus) ;
//   3. « pas su » n'affiche aucun nombre et n'accuse rien ;
//   4. réservé ⇒ les choix ne s'écrivent pas ;
//   5. prêt ⇒ cliquer écrit le réglage, et l'autre sens : sans extension dans ce
//      navigateur, la carte dit où ça se passe (jamais une promesse).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');   // ⚠️ JAMAIS un chemin absolu (§6.1)
const PORT = 4541;
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

const ETATS = {
  pret:    { attendu: 'pret',    rep: { ok: true, ready: true,  mois: '2026-10', n: 12, plafond: 150, autorise: true } },
  autre:   { attendu: 'pret',    rep: { ok: true, ready: true,  mois: '2026-10', n: 47, plafond: 300, autorise: true } },
  sanscle: { attendu: 'sanscle', rep: { ok: true, ready: false, mois: '2026-10', n: 0,  plafond: 150, autorise: true } },
  reserve: { attendu: 'reserve', rep: { ok: true, ready: true,  mois: '2026-10', n: 0,  plafond: 150, autorise: false } },
  pasSu:   { attendu: 'pasSu',   rep: null },   // 503 HTML : la vraie forme d'une panne
  // 503 JSON « compteur » : le serveur SAIT que son compteur est illisible — et
  // tant que ça dure, aucune photo ne sera détourée. Ce n'est pas un « pas su ».
  compteur: { attendu: 'compteur', rep: 'COMPTEUR' },
};

async function rendre(nav, etat, { mode = 'couverture', cliquer = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1512, height: 1100 } });
  const pg = await ctx.newPage();
  await pg.addInitScript(([s, m]) => {
    try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {}
    try { localStorage.setItem('vrm_detourage', JSON.stringify(m)); } catch (_) {}
  }, [SESSION, mode]);
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = metaVersData(r.request().url());
    if (/select=owner/.test(u) || /select=id&limit=1/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  // ⚠️ §6.6 : Playwright prend la DERNIÈRE route enregistrée en premier — le
  //    fourre-tout d'abord, la route précise ensuite.
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const vues = [];
  await pg.route('**/api/ai?mode=detourage*', (r) => {
    vues.push(r.request().url());
    const v = ETATS[etat].rep;
    if (v === null) return r.fulfill({ status: 503, contentType: 'text/html', body: '<html>503</html>' });
    if (v === 'COMPTEUR') return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'compteur', ready: true }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) });
  });
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  await pg.route('**://*.vinted.com/**', (r) => r.abort());
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4000);
  const carte = pg.locator('[data-detourage-etat]').first();
  const present = await carte.count() > 0;
  let ecrit;
  if (present && cliquer) {
    await pg.locator(`[data-detourage-choix="${cliquer}"]`).first().click({ force: true, timeout: 3000 }).catch(() => {});
    // ⚠️ `save()` attend 500 ms avant d'écrire : lire avant serait mesurer le vide.
    await pg.waitForTimeout(1200);
    ecrit = await pg.evaluate(() => localStorage.getItem('vrm_detourage'));
  }
  const r = present ? await carte.evaluate((el) => ({
    etat: el.getAttribute('data-detourage-etat'), mode: el.getAttribute('data-detourage-mode'),
    phrase: (el.querySelector('[data-detourage-phrase]') || {}).innerText || '',
    cap: (el.querySelector('[data-detourage-cap]') || { getAttribute: () => null }).getAttribute('data-detourage-cap'),
    desactives: Array.from(el.querySelectorAll('[data-detourage-choix]')).filter((b) => b.disabled).length,
    texte: el.innerText.replace(/\s+/g, ' '),
  })) : null;
  await ctx.close();
  return { r, erreurs, ecrit, vues, present };
}

(async () => {
  try { await ecouter(); } catch (e) { console.log('❌ ' + e.message); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const vus = {};
  try {
    for (const etat of Object.keys(ETATS)) {
      const x = await rendre(nav, etat);
      vus[etat] = x;
      dit(!x.erreurs.length, `${etat} : l'écran se rend sans erreur`, x.erreurs[0] || '');
      dit(x.present, `${etat} : le réglage est dans Réglages`);
      dit(x.r && x.r.etat === ETATS[etat].attendu, `${etat} : la carte porte l'état « ${ETATS[etat].attendu} »`, x.r ? x.r.etat : '(absente)');
      dit(x.vues.some((u) => /usage=1/.test(u)), `${etat} : l'état vient du SERVEUR (usage=1 demandé)`);
    }
    for (const k of Object.keys(vus)) console.log(`     ${k} ─ « ${vus[k].r ? vus[k].r.phrase : '(rien)'} »`);
    const ph = (k) => (vus[k].r ? vus[k].r.phrase : '');

    console.log('\n── LE COMPTEUR SUIT LA DONNÉE');
    const porte = (t, rep) => new RegExp(`\\b${rep.n}\\b`).test(t) && new RegExp(`\\b${rep.plafond}\\b`).test(t);
    dit(porte(ph('pret'), ETATS.pret.rep), `prêt : ${ETATS.pret.rep.n} sur ${ETATS.pret.rep.plafond} est écrit`, ph('pret'));
    dit(porte(ph('autre'), ETATS.autre.rep), `autre jeu : ${ETATS.autre.rep.n} sur ${ETATS.autre.rep.plafond} est écrit`, ph('autre'));
    dit(ph('pret') !== ph('autre'), 'les deux rendus diffèrent : le texte n\'est pas figé');

    console.log('\n── CINQ ÉTATS, AUCUN NE SE FAIT PASSER POUR UN AUTRE');
    const distinctes = new Set(['pret', 'sanscle', 'reserve', 'pasSu', 'compteur'].map(ph));
    dit(distinctes.size === 5, 'prêt · sans clé · réservé · pas su · compteur illisible ⇒ cinq phrases différentes', `${distinctes.size}/5`);
    dit(!/rien n.est cass/i.test(ph('pasSu')), '« pas su » n\'affirme pas que tout va bien (il ne le sait pas)', ph('pasSu'));
    dit(/aucune photo/i.test(ph('compteur')), 'compteur illisible : il sait qu\'aucune photo ne sera détourée', ph('compteur'));
    dit(!/\d/.test(ph('pasSu')), '« pas su » : AUCUN nombre affiché', ph('pasSu'));
    dit(!/cl[ée] photoroom|r[ée]serv/i.test(ph('pasSu')), '« pas su » n\'accuse rien (ni clé manquante, ni réservé)');
    dit(!/\b150\b/.test(ph('sanscle')), 'sans clé : pas de compteur présenté comme s\'il tournait', ph('sanscle'));
    dit(/cl[ée]/i.test(ph('sanscle')) && /telles quelles/i.test(ph('sanscle')), 'sans clé + réglage allumé : il sait que ses photos partent telles quelles');

    console.log('\n── RÉSERVÉ : RIEN NE S\'ÉCRIT');
    dit(vus.reserve.r && vus.reserve.r.desactives === 3, 'les trois choix sont grisés', vus.reserve.r ? String(vus.reserve.r.desactives) : '');
    const rz = await rendre(nav, 'reserve', { mode: 'eteint', cliquer: 'toutes' });
    dit(rz.ecrit === JSON.stringify('eteint'), 'un clic sur « Toutes » n\'écrit rien', String(rz.ecrit));

    console.log('\n── PRÊT : LE CLIC ÉCRIT LE RÉGLAGE, ET DIT OÙ ÇA SE PASSE');
    const rc = await rendre(nav, 'pret', { mode: 'eteint', cliquer: 'toutes' });
    dit(rc.ecrit === JSON.stringify('toutes'), '« Toutes les photos » est enregistré', String(rc.ecrit));
    const ra = await rendre(nav, 'pret', { mode: 'eteint' });
    dit(ra.r && ra.r.cap === null, 'éteint : aucune ligne sur l\'extension (rien à dire)');
    // Le banc n'a pas d'extension : c'est le cas du téléphone.
    dit(vus.pret.r && vus.pret.r.cap === 'absente', 'allumé, sans extension dans ce navigateur ⇒ la carte dit que ça se passe dans Chrome', vus.pret.r ? String(vus.pret.r.cap) : '');
  } catch (e) { ko++; console.log('❌ le banc a levé — ' + (e && e.message)); }

  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge.' : '✅ Le réglage du détourage dit ce que le serveur dit.'}`);
  process.exit(ko ? 1 : 0);
})();
