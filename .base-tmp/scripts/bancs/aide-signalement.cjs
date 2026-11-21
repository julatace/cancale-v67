require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LE ? DE CHAQUE ÉCRAN, SIGNALER ENRICHI, LE CENTRE D'AIDE » (8 nov.)
//          node scripts/bancs/aide-signalement.cjs        (sur dist/, après build)
//  Tout se passe en MODE EXEMPLE (données inventées, src/exempleDonnees.js) :
//  aucune donnée réelle, aucune requête ne sort (§2.3).
//  Q1  sur chaque écran à phrase visité : un « ? » qui suit la phrase, 44 px au
//      doigt, la phrase garde son texte ; il ouvre UNE feuille : 3 questions,
//      l'article du centre d'aide (lien /aide/<slug>), « Signaler un problème » ;
//  S1  « Signaler » depuis le « ? » : la capture SCHÉMATIQUE est celle de
//      l'ÉCRAN (prise avant la feuille d'aide), des requêtes et l'appareil sont
//      dans l'aperçu ; le texte exact envoyé ne porte AUCUNE donnée de l'exemple
//      (pseudos, titres, montants, codes) — même tapés dans le message ;
//  C1  le centre d'aide servi comme Vercel le servira (/aide, /aide/<slug>) :
//      chaque page s'ouvre, la recherche filtre, aucune violation de CSP, rien ne
//      déborde, le thème de l'app est suivi ;
//  `SHOTS=dossier` range une capture par cas (à REGARDER, §6.2) ;
//  `CAPTURES_AIDE=1` (re)fait les captures du centre d'aide (public/aide/captures/).
//  `LARGEURS=390,1512` / `THEMES=clair,sombre` restreignent.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const RACINE = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 10131;
const SHOTS = process.env.SHOTS || '';
const CAPTURES = process.env.CAPTURES_AIDE === '1';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000cc';
const SESSION = { access_token: 'jeton-vendeur-banc', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeur.banc@exemple.test', totp: [] } };
// Ce qui n'existe QUE dans l'exemple (src/exempleDonnees.js) + ce qu'on tape.
const TRACES = ['vendeuse_a', 'vendeuse_b', 'acheteuse_lyon', 'exemple@vrm.invalid', '45,00', '87,50 €'];
const VERCEL = JSON.parse(fs.readFileSync(path.join(RACINE, 'vercel.json'), 'utf8'));
const CSP = (() => { for (const h of VERCEL.headers) for (const x of h.headers) if (x.key === 'Content-Security-Policy' && /default-src/.test(x.value)) return x.value; return ''; })();

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`); };

// Le serveur : les rewrites de vercel.json pour /aide, la CSP de production.
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/aide') f = '/aide/index.html';
  else if (/^\/aide\/[a-z-]+$/.test(f)) f = f + '.html';
  else if (f === '/' || !path.extname(f)) f = '/index.html';
  let p = path.join(DIST, f);
  // Les captures du centre d'aide, refaites APRÈS le build : lues dans public/.
  if (!fs.existsSync(p) && /^\/aide\/captures\/[\w.-]+$/.test(f)) p = path.join(RACINE, 'public', f);
  if (!(p.startsWith(DIST) || p.startsWith(path.join(RACINE, 'public'))) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', ...(CSP && /\.html$/.test(p) ? { 'content-security-policy': CSP } : {}) });
  r.end(fs.readFileSync(p));
});

async function contexte(nav, W, sombre) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  return { ctx, tel };
}
async function ouvrirApp(nav, W, sombre) {
  const { ctx, tel } = await contexte(nav, W, sombre);
  const pg = await ctx.newPage();
  const erreurs = [], csp = [];
  pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 240)));
  pg.on('console', (m) => { if (/Content.Security.Policy|Refused to/i.test(m.text())) csp.push(m.text().slice(0, 200)); });
  await pg.addInitScript(([s, sombre]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vrm_session', JSON.stringify(s));
        localStorage.setItem('vrm_local_owner', s.user.id);
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        sessionStorage.setItem('banc_init', '1');
        // Le MODE EXEMPLE demandé par l'onglet (src/modeExemple.js) : la base est
        // servie dans la page, rien ne sort.
        sessionStorage.setItem('vrm_mode_exemple', '1');
      }
    } catch (_) {}
  }, [SESSION, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-exemple-bandeau]', { timeout: 25000 }).catch(() => {});
  dit(!!(await pg.$('[data-exemple-bandeau]')), `[${W}px] le mode exemple est actif (données inventées)`);
  return { ctx, pg, tel, erreurs, csp };
}
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };
const aller = async (pg, tab) => { await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('[data-exemple-bandeau]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(2000); };

// Les écrans visités et la clé du « ? » attendue.
const ECRANS = [['journee', 'journee'], ['cat_annonces', 'annonces'], ['cat_ventes', 'ventes'], ['cat_bord', 'colis'], ['compta', 'compta'], ['garage', 'garage'], ['settings', 'settings']];

async function parcoursApp(nav, W, theme) {
  const T = `[app ${W}px ${theme}]`;
  const o = await ouvrirApp(nav, W, theme === 'sombre');
  for (const [tab, cle] of ECRANS) {
    await aller(o.pg, tab);
    const b = await o.pg.evaluate((c) => {
      const btn = [...document.querySelectorAll(`[data-aide-ouvrir="${c}"]`)].find((x) => x.getBoundingClientRect().width > 0);
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      const p = btn.closest('[data-phrase-ecran]');
      const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { w: r.width, h: r.height, dansPhrase: !!p, texte: p ? p.textContent : null, libelle: btn.getAttribute('aria-label'), dessus: x && (x === btn || btn.contains(x)) ? '' : (x ? String(x.className || x.tagName).slice(0, 60) : 'rien') };
    }, cle);
    dit(!!b, `${T} Q1 ${tab} : le « ? » de l'écran est là`);
    if (!b) continue;
    dit(b.dansPhrase && b.texte && !/\?$/.test(b.texte.trim()) && b.texte.trim().length > 10, `${T} Q1 ${tab} : il suit la phrase, qui garde son texte`, JSON.stringify(b));
    dit(!o.tel || (b.w >= 43.5 && b.h >= 43.5), `${T} Q1 ${tab} : 44 px au doigt`, `${b.w}×${b.h}`);
    dit(b.dessus === '', `${T} Q1 ${tab} : rien ne le couvre`, b.dessus);
    dit(/^Aide : /.test(b.libelle || ''), `${T} Q1 ${tab} : il a un nom pour le lecteur d'écran`, b.libelle);
    await o.pg.click(`[data-aide-ouvrir="${cle}"]:visible`).catch(() => {});
    await o.pg.waitForSelector(`[data-aide-feuille="${cle}"]`, { timeout: 5000 }).catch(() => {});
    await o.pg.waitForTimeout(450);
    const f = await o.pg.evaluate((c) => {
      const s = document.querySelector(`[data-aide-feuille="${c}"]`);
      if (!s) return null;
      const a = s.querySelector('[data-aide-article]');
      return { q: s.querySelectorAll('[data-aide-question]').length, ouverte: s.querySelectorAll('details[open]').length, article: a && a.getAttribute('href'), signaler: !!s.querySelector('[data-aide-signaler]'), feuilles: document.querySelectorAll('[data-aide-feuille]').length };
    }, cle);
    dit(f && f.q === 3 && f.ouverte === 1, `${T} Q1 ${tab} : la feuille a 3 questions (la première ouverte)`, JSON.stringify(f));
    dit(f && /^\/aide\/[a-z-]+$/.test(f.article || '') && fs.existsSync(path.join(DIST, f.article + '.html')), `${T} Q1 ${tab} : l'article du centre d'aide existe`, f && f.article);
    dit(f && f.signaler && f.feuilles === 1, `${T} Q1 ${tab} : « Signaler un problème », une seule feuille`, JSON.stringify(f));
    await capture(o.pg, `aide-${W}-${theme}-${tab}`);
    if (tab === 'cat_bord' || (tab === 'journee' && W === 390)) {
      // S1 : signaler depuis le « ? ».
      await o.pg.click('[data-aide-signaler]').catch(() => {});
      await o.pg.waitForSelector('[data-feuille-signaler]', { timeout: 5000 }).catch(() => {});
      await o.pg.fill('[data-signaler-texte]', 'Le colis de acheteuse_lyon à 45,00 € et 87,50 € ne s’affiche pas, écris-moi à exemple@vrm.invalid').catch(() => {});
      await o.pg.waitForTimeout(400);
      const s = await o.pg.evaluate(() => {
        const json = (document.querySelector('[data-apercu-json]') || {}).textContent || '';
        let o = null; try { o = JSON.parse(json); } catch (_) {}
        const plan = document.querySelector('[data-plan-ecran]');
        return { o, json, planN: plan ? Number(plan.getAttribute('data-plan-ecran')) : 0, lignes: [...document.querySelectorAll('[data-apercu-ligne]')].map((x) => x.getAttribute('data-apercu-ligne')) };
      });
      dit(s.o && s.o.plan && s.o.plan.b.length > 10 && s.planN === s.o.plan.b.length, `${T} S1 ${tab} : la capture schématique part (${s.planN} blocs) et se voit avant l'envoi`, JSON.stringify({ n: s.planN }));
      dit(s.o && s.o.etatEcran && s.o.etatEcran.feuilles === 0, `${T} S1 ${tab} : c'est l'ÉCRAN qui est capturé, pas la feuille d'aide`, JSON.stringify(s.o && s.o.etatEcran));
      dit(s.o && s.o.appareil && s.o.systeme && Array.isArray(s.o.lectures) && Array.isArray(s.o.plantages), `${T} S1 ${tab} : appareil, système, requêtes et erreurs sont dans l'aperçu`, JSON.stringify(s.o && { a: s.o.appareil, s: s.o.systeme }));
      const fuite = TRACES.filter((t) => s.json.includes(t));
      dit(s.json && !fuite.length, `${T} S1 ${tab} : aucune donnée (pseudo, montant, e-mail) dans le texte exact envoyé`, fuite.join(', ') + ' ¦ ' + (s.o && s.o.texte));
      dit(s.o && s.o.plan && s.o.plan.b.every((r) => r.length === 5 && r.every((x) => typeof x === 'number')), `${T} S1 ${tab} : la capture n'est faite que de nombres`);
      dit(['Capture de l’écran', 'Requêtes récentes', 'Erreurs de cet appareil', 'Appareil'].every((k) => s.lignes.includes(k)), `${T} S1 ${tab} : l'aperçu nomme chaque morceau`, s.lignes.join(' | '));
      await capture(o.pg, `signaler-${W}-${theme}-${tab}`);
      await o.pg.evaluate(() => { const d = document.querySelector('[data-plan-ecran]'); if (d) d.scrollIntoView({ block: 'center' }); });
      await o.pg.waitForTimeout(200);
      await capture(o.pg, `signaler-plan-${W}-${theme}-${tab}`);
      await o.pg.keyboard.press('Escape').catch(() => {});
    }
    await o.pg.keyboard.press('Escape').catch(() => {});
    await o.pg.waitForTimeout(300);
  }
  dit(!o.erreurs.length, `${T} aucune erreur JS`, o.erreurs.join(' ¦ '));
  await o.ctx.close();
}

// Les captures du centre d'aide : mode exemple, 390 px, clair.
async function capturesAide(nav) {
  const o = await ouvrirApp(nav, 390, false);
  const dossier = path.join(RACINE, 'public', 'aide', 'captures');
  fs.mkdirSync(dossier, { recursive: true });
  const prendre = async (tab, nom, avant, descendre = 0) => {
    await aller(o.pg, tab);
    if (avant) { await avant(o.pg); await o.pg.waitForTimeout(1200); }
    await o.pg.evaluate((y) => { window.scrollTo(0, y); const m = document.querySelector('.vrm-main'); if (m && m.scrollHeight > m.clientHeight + 10) m.scrollTop = y; }, descendre);
    await o.pg.waitForTimeout(500);
    const fichier = path.join(dossier, nom);
    await o.pg.screenshot({ path: fichier, type: 'jpeg', quality: 72, scale: 'css' });
    dit(fs.statSync(fichier).size > 5000, `capture ${nom} (${Math.round(fs.statSync(fichier).size / 1024)} Ko)`);
  };
  await prendre('cat_annonces', 'annonces.jpg', null, 600);
  await prendre('cat_bord', 'colis.jpg');
  await prendre('cat_bord', 'a-retirer.jpg', async (pg) => { const b = await pg.$('[data-colis-onglet="retirer"], button:has-text("À retirer")'); if (b) await b.click().catch(() => {}); }, 560);
  await prendre('compta', 'compta.jpg');
  await o.ctx.close();
}

async function parcoursAide(nav, W, theme) {
  const T = `[aide ${W}px ${theme}]`;
  const { ctx, tel } = await contexte(nav, W, theme === 'sombre');
  const pg = await ctx.newPage();
  const erreurs = [], csp = [];
  pg.on('pageerror', (e) => erreurs.push(String(e.message || e)));
  pg.on('console', (m) => { if (/Content.Security.Policy|Refused to/i.test(m.text())) csp.push(m.text().slice(0, 200)); });
  await pg.addInitScript((s) => { try { localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, theme === 'sombre');
  await pg.goto(`http://localhost:${PORT}/aide`, { waitUntil: 'load' });
  const n = await pg.$$eval('[data-article]', (l) => l.length);
  dit(n >= 9, `${T} C1 l'accueil liste les articles (${n})`);
  const th = await pg.evaluate(() => document.documentElement.getAttribute('data-theme'));
  dit(th === (theme === 'sombre' ? 'dark' : 'light'), `${T} C1 le thème de l'app est suivi`, th);
  await capture(pg, `centre-${W}-${theme}-accueil`);
  await pg.fill('#q', 'code retrait');
  await pg.waitForTimeout(300);
  const vus = await pg.$$eval('[data-article]:not([hidden])', (l) => l.map((x) => x.getAttribute('data-article')));
  dit(vus.includes('retirer-colis') && vus.length < n, `${T} C1 la recherche filtre (« code retrait » ⇒ ${vus.join(', ')})`);
  await pg.fill('#q', 'urssaf');
  await pg.waitForTimeout(200);
  const u = await pg.$$eval('[data-article]:not([hidden])', (l) => l.map((x) => x.getAttribute('data-article')));
  dit(u.includes('compta-urssaf'), `${T} C1 « urssaf » trouve Compta et URSSAF`, u.join(','));
  await pg.fill('#q', 'zzzqqq');
  await pg.waitForTimeout(200);
  dit(await pg.$eval('#rien', (e) => !e.hidden), `${T} C1 rien trouvé : la page le dit`);
  await capture(pg, `centre-${W}-${theme}-recherche-vide`);
  const slugs = await pg.$$eval('[data-article]', (l) => l.map((x) => x.getAttribute('data-article')));
  for (const s of slugs) {
    const r = await pg.goto(`http://localhost:${PORT}/aide/${s}`, { waitUntil: 'load' });
    const info = await pg.evaluate(() => ({ h1: (document.querySelector('h1') || {}).textContent || '', deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, images: [...document.images].map((i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 })) }));
    await pg.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((ok) => { i.onload = i.onerror = ok; })))));
    const imgs = await pg.evaluate(() => [...document.images].map((i) => ({ src: i.getAttribute('src'), ok: i.naturalWidth > 0 })));
    dit(r && r.status() === 200 && info.h1.length > 5 && !info.deborde, `${T} C1 /aide/${s} s'ouvre, rien ne déborde`, JSON.stringify(info).slice(0, 200));
    dit(imgs.every((i) => i.ok), `${T} C1 /aide/${s} : chaque capture se charge`, JSON.stringify(imgs.filter((i) => !i.ok)));
    if (['extension', 'retirer-colis', 'compta-urssaf'].includes(s)) { await capture(pg, `centre-${W}-${theme}-${s}`); }
  }
  const cibles = await (async () => { await pg.goto(`http://localhost:${PORT}/aide`, { waitUntil: 'load' }); return pg.$$eval('.groupe a, .liens a', (l) => l.map((a) => a.getBoundingClientRect().height).filter((h) => h > 0 && h < 43.5).length); })();
  dit(!tel || cibles === 0, `${T} C1 chaque lien fait 44 px au doigt`, cibles);
  dit(!csp.length, `${T} C1 aucune violation de la politique de contenu`, csp.join(' ¦ '));
  dit(!erreurs.length, `${T} C1 aucune erreur JS`, erreurs.join(' ¦ '));
  await ctx.close();
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('KO  dist/ absent : npm run build d’abord'); process.exit(1); }
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  try {
    if (CAPTURES) await capturesAide(nav);
    for (const W of LARGEURS) for (const th of THEMES) { await parcoursAide(nav, W, th); await parcoursApp(nav, W, th); }
  } catch (e) { dit(false, 'le banc a levé', e && e.stack); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ tout vert');
  process.exit(ko ? 1 : 0);
})();
