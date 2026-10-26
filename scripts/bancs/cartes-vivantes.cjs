require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « CARTES VIVANTES » — les cartes répondent SOUS LE DOIGT, pas seulement
//  jolies au repos (le même soin que les boutons, étendu aux cartes).
//
//  Demande de Julien (« quelque chose de parfait, très professionnel ») :
//    · OPTION 1 — page d'accueil : les cartes-questions et la carte Prix
//      s'élèvent au survol (sur SOURIS) ; la souris au repos ne change rien.
//    · OPTION 2 — primitive réutilisable `.vrm-card` (élévation au survol) et
//      `.vrm-stagger` (cascade d'entrée), appliquées à la carte d'accueil de
//      l'app (premier écran d'un nouveau vendeur, monté une seule fois).
//
//  ⚠️ ON JUGE LE COMPORTEMENT, PAS L'ORTHOGRAPHE (leçon répétée) : on SURVOLE
//     pour de vrai et on lit l'ombre/le transform CALCULÉS avant/après. Un
//     contrôle posé sur « la feuille contient .vrm-card:hover » serait vert le
//     jour où la règle est là mais ne fait rien.
//  ⚠️ RED-BEFORE (§6.1) : copié dans /tmp/avN et lancé DEPUIS l'arbre d'avant,
//     il doit ÉCHOUER — l'ancien code n'a ni `.vrm-card` ni survol de carte.
//  ⚠️ AUCUNE FIXTURE : l'accueil est public, le premier jour est une base vide.
//     Rien de réel ne transite — ce banc vit dans le dépôt.
//
//  Lancer :  node scripts/bancs/cartes-vivantes.cjs   (BANC_PORT=… si pris)
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');   // ⚠️ JAMAIS un chemin absolu (§6.1)
const PORT = Number(process.env.BANC_PORT) || 4531;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.zip':'application/zip', '.webmanifest':'application/manifest+json' };

const SESSION = {
  access_token: 'jeton-de-banc', refresh_token: 'r',
  expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'sophie@exemple.fr' },
};

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => {
  if (bon) { ok++; console.log(`  ✅ ${quoi}`); }
  else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); }
};

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
    ? new Error(`le port ${PORT} est déjà pris — relance ce banc seul, ou avec BANC_PORT=…`) : e));
  srv.listen(PORT, () => res());
});

// Les routes communes : auth OK, base migrée mais VIDE (premier jour), aucune
// image externe (déterminisme — un hoquet du CDN Vinted a déjà tué un banc).
async function cadrer(pg, { comptes = [] } = {}) {
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = r.request().url();
    if (/select=owner/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (/select=id&limit=1/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (/vinted_accounts/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(comptes) });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  await pg.route('**://*.vinted.com/**', (r) => r.abort());
}

// Survole un élément et rend l'ombre + le transform calculés avant/après.
async function survol(pg, sel) {
  const el = await pg.$(sel);
  if (!el) return null;
  const lire = () => el.evaluate((e) => { const s = getComputedStyle(e); return { ombre: s.boxShadow, tr: s.transform }; });
  const avant = await lire();
  await el.hover();
  await pg.waitForTimeout(320);
  const apres = await lire();
  return { avant, apres };
}
const bouge = (p) => !!p && (p.avant.ombre !== p.apres.ombre || p.avant.tr !== p.apres.tr);

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ dist/ absent — lance npm run build'); process.exit(1); }
  await ecouter();
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--disable-gpu-compositing'] });

  // ── OPTION 1 : LA PAGE D'ACCUEIL (publique, AUCUNE session) ────────────────
  console.log('── OPTION 1 · page d’accueil — les cartes s’élèvent au survol');
  {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } }); // souris → pointer:fine
    const pg = await ctx.newPage();
    const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
    await cadrer(pg);
    await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(1500);
    const q = await pg.$('.acc-q');
    dit(!!q, 'la page d’accueil rend ses cartes-questions (.acc-q)');
    const pq = await survol(pg, '.acc-q');
    dit(bouge(pq), 'une carte-question s’élève au survol (ombre/translation)',
      pq ? `avant ${pq.avant.ombre.slice(0,24)}… → après ${pq.apres.ombre.slice(0,24)}…` : 'carte introuvable');
    const pp = await survol(pg, '.acc-prix');
    dit(bouge(pp), 'la carte Prix s’élève au survol', pp ? `tr ${pp.avant.tr} → ${pp.apres.tr}` : 'carte Prix introuvable');
    dit(!erreurs.length, 'accueil : aucune erreur de page', erreurs[0]);
    await ctx.close();
  }

  // ── OPTION 2 : LA CARTE D’ACCUEIL DE L’APP (premier jour, base vide) ───────
  console.log('── OPTION 2 · premier écran de l’app — .vrm-card + .vrm-stagger');
  async function premierEcran(reduce) {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: reduce ? 'reduce' : 'no-preference' });
    const pg = await ctx.newPage();
    const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
    await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
    await cadrer(pg, { comptes: [] });
    await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(5000);
    return { ctx, pg, erreurs };
  }
  {
    const { ctx, pg, erreurs } = await premierEcran(false);
    const carte = await pg.$('[data-etape]');
    dit(!!carte, 'le premier écran rend la carte d’accueil (data-etape)');
    const aClasse = carte && await carte.evaluate((e) => e.classList.contains('vrm-card'));
    dit(!!aClasse, 'la carte d’accueil porte la primitive .vrm-card');
    const pc = await survol(pg, '[data-etape]');
    dit(bouge(pc), 'la carte d’accueil s’élève au survol (ombre/translation)',
      pc ? `ombre ${pc.avant.ombre.slice(0,20)}… → ${pc.apres.ombre.slice(0,20)}…` : 'carte introuvable');
    // La cascade d'entrée : les étapes portent l'animation `vrmMonte`.
    const anim = await pg.$$eval('.vrm-stagger > *', (els) => els.map((e) => getComputedStyle(e).animationName));
    dit(anim.length >= 2 && anim.every((a) => /vrmMonte/.test(a)),
      'les étapes entrent en cascade (.vrm-stagger → animation vrmMonte)', `noms = ${anim.join(', ') || '(aucun)'}`);
    const delais = await pg.$$eval('.vrm-stagger > *', (els) => els.map((e) => getComputedStyle(e).animationDelay));
    dit(new Set(delais).size >= 2, 'chaque étape a son propre délai (vraie cascade, pas un bloc)', `délais = ${delais.join(', ')}`);
    dit(!erreurs.length, 'premier écran : aucune erreur de page', erreurs[0]);
    await ctx.close();
  }
  {
    // « Réduire les animations » : la cascade est neutralisée, la carte ne
    // bondit pas au survol — mais le reste s'affiche (on ne casse rien).
    const { ctx, pg } = await premierEcran(true);
    const anim = await pg.$$eval('.vrm-stagger > *', (els) => els.map((e) => getComputedStyle(e).animationName)).catch(() => []);
    dit(anim.length === 0 || anim.every((a) => a === 'none'),
      'reduced-motion : aucune cascade (animation neutralisée)', `noms = ${anim.join(', ')}`);
    const pc = await survol(pg, '[data-etape]');
    const trBouge = pc && pc.avant.tr !== pc.apres.tr;
    dit(pc && !trBouge, 'reduced-motion : la carte ne se déplace pas au survol', pc ? `tr ${pc.avant.tr} → ${pc.apres.tr}` : 'carte introuvable');
    await ctx.close();
  }

  await nav.close();
  srv.close();
  console.log(`\n${ko === 0 ? '✅' : '❌'} cartes vivantes : ${ok} verts, ${ko} rouges`);
  process.exit(ko === 0 ? 0 : 1);
})().catch((e) => { console.log('❌ le banc a levé : ' + (e && e.message || e)); try { srv.close(); } catch (_) {} process.exit(1); });
