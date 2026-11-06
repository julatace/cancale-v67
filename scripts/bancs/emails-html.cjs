require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  Banc — le MESSAGE D'ORIGINE mis en page comme dans Mail (6 nov., décision de
//  Julien : garder 30 jours le HTML ASSAINI des e-mails « à geste »).
//
//  La boîte servie : ~950 e-mails INVENTÉS (_fx-boite-mail.cjs) + trois e-mails à
//  HTML inventés (_fx-email-html.cjs) : une vente (600 px fixes, logo, photo,
//  pixels de suivi), un colis à retirer qui sait se mettre en sombre, et un e-mail
//  PIÉGÉ dont la ligne HTML porte les vecteurs connus BRUTS (comme si elle avait
//  été trafiquée en base : la lecture doit ré-assainir). La route n'est PAS
//  imitée : c'est la VRAIE `lireEmailBoite` (api/_lib/reception-email.js) sur une
//  base servie dans sa forme (_minipgrest.cjs). Les en-têtes de vercel.json (CSP)
//  sont posés sur chaque réponse de l'app (_vercel.cjs) et chaque violation compte.
//
//  Juge, à 390 px tactile et 1512 px, clair et sombre :
//   E1 la vente s'ouvre MISE EN PAGE (cadre isolé, son texte, son tableau), à la
//      largeur de l'écran (réduite à l'échelle si plus large), rien qui dépasse ;
//   E2 aucune image distante demandée avant le geste ; « Afficher les images » les
//      charge (une fois) ; les pixels de suivi ne partent JAMAIS ;
//   E3 la nuit : fond clair dans le cadre pour un e-mail sans thème sombre ; le
//      colis qui en a un suit le sombre ;
//   E4 l'e-mail piégé : rien ne s'exécute (`__xss` jamais appelé), rien de distant ;
//   E5 un vieil e-mail sans HTML : le texte remis en forme, comme avant ;
//   E6 mode stream : « Masqué en mode stream », aucun cadre, `html=1` jamais demandé.
//  Puis, hors de l'app, les TROIS barrières une à une (scripts permis dans le
//  harnais) : X0 les vecteurs bruts S'EXÉCUTENT (le harnais voit une exécution) ;
//  X1 assainis, plus rien ne s'exécute ; X2 bruts mais dans le `sandbox` du cadre,
//  rien ne s'exécute.
//  Captures dans CAPTURE_DIR (à regarder : c'est une partie du test).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { servir } = require('./_minipgrest.cjs');
const V = require('./_vercel.cjs');
const { VENTE_HTML, RETRAIT_HTML, VECTEURS } = require('./_fx-email-html.cjs');
const RACINE = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || 12310);
const CAPT = process.env.CAPTURE_DIR || path.join(os.tmpdir(), 'banc-emails-html');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const FX = require('./_fx-boite-mail.cjs').construire();
const OWNER = FX.owner, MAINTENANT = FX.maintenant;
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Math.max(Date.now(), MAINTENANT) + 24 * 3600e3, user: { id: OWNER, email: 'vendeuse@exemple.test' } };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); } };
// Un PNG de 1×1 (servi pour les images distantes inventées).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

// Les trois e-mails à HTML, en tête de la boîte (les plus récents), dans la forme de la base.
const at = (min) => new Date(MAINTENANT - min * 60000).toISOString();
const cle = (c) => (c.repeat(64)).slice(0, 64);
const ID = { vente: 'email_reception_' + cle('e1'), retrait: 'email_reception_' + cle('e2'), piege: 'email_reception_' + cle('e3') };
const lignesHtml = (H) => {
  const v = H.assainirHtml(VENTE_HTML), r = H.assainirHtml(RETRAIT_HTML);
  const recu = (id, min, type, resume, subject, from) => ({ owner: OWNER, id, data: { at: at(min), etat: 'integre', type, subject, from, adresses: ['une@exemple.test'], resume, pieces: [] } });
  return [
    recu(ID.vente, 1, 'vente', { v: 1, t: 'vente', a: 'Baskets Exemple Runner 42', px: '55,00' }, 'Ton article est vendu !', "\"L'équipe Vinted\" <no-reply@vinted.fr>"),
    { owner: OWNER, id: ID.vente.replace('reception', 'texte'), data: { at: at(1), texte: 'Ton article est vendu ! acheteur-invente a acheté ton article.' } },
    { owner: OWNER, id: ID.vente.replace('reception', 'html'), meta: { at: at(1) }, data: { v: 1, at: at(1), html: v.html, octets: v.octets, images: v.images, pixels: v.pixels, sombre: 0 } },
    recu(ID.retrait, 2, 'suivi', { v: 1, t: 'suivi', tr: 'mondialrelay', s: '00001111', st: 'available', code: '418205', lieu: "Relais de l'Exemple" }, 'Votre colis est disponible', 'Mondial Relay <noreply@mondialrelay.fr>'),
    { owner: OWNER, id: ID.retrait.replace('reception', 'html'), meta: { at: at(2) }, data: { v: 1, at: at(2), html: r.html, octets: r.octets, images: r.images, pixels: r.pixels, sombre: 1 } },
    recu(ID.piege, 3, 'offre', { v: 1, t: 'offre', mt: '40,00', a: 'Paire inventée' }, 'Nouvelle offre', "\"L'équipe Vinted\" <no-reply@vinted.fr>"),
    // La ligne PIÉGÉE : les vecteurs BRUTS, comme une ligne trafiquée (la lecture ré-assainit).
    { owner: OWNER, id: ID.piege.replace('reception', 'html'), meta: { at: at(3) }, data: { v: 1, at: at(3), html: '<p>Offre inventée</p>' + VECTEURS.map(([, h]) => h).join('\n') } },
  ];
};

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, base, route, { viewport, tactile, sombre, stream = false }) {
  const ctx = await nav.newContext({ viewport, hasTouch: tactile, isMobile: tactile, colorScheme: sombre ? 'dark' : 'light', timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  const csp = await V.cspBanc(ctx, `http://localhost:${PORT}`, `${viewport.width}${sombre ? ' sombre' : ''}${stream ? ' stream' : ''}`);
  const pg = await ctx.newPage(); pg.setDefaultTimeout(15000);
  await pg.clock.setFixedTime(MAINTENANT);
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push('page: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon|Content Security Policy/i.test(m.text())) erreurs.push('console: ' + m.text().slice(0, 200)); });
  await pg.addInitScript(([s, sombre, stream]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_bienvenue_vue', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); if (stream) localStorage.setItem('vrm_stream', '1'); } catch (_) {} window.__xssAppels = []; window.__xss = (n) => window.__xssAppels.push(String(n)); }, [SESSION, sombre, stream]);
  const distantes = [];
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/exemple\.test/.test(u)) { distantes.push(u); return r.fulfill({ status: 200, contentType: 'image/png', body: PNG }); }
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => (r.request().method() !== 'GET' ? r.fulfill({ status: 201, contentType: 'application/json', body: '' }) : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' })));
  const appels = [];
  const fetcher = async (u) => {
    const url = new URL(u);
    if (url.pathname.endsWith('/vinted_accounts')) return { ok: true, status: 200, json: async () => base.comptes.map((c) => ({ vinted_user_id: c.vinted_user_id, login: c.login })) };
    return { ok: true, status: 200, json: async () => servir(base.rows, u, {}).body };
  };
  await pg.route('**/api/**', async (r) => {
    const u = new URL(r.request().url());
    if (u.searchParams.get('mode') === 'confidentialite') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uid: OWNER }) });
    const q = Object.fromEntries(u.searchParams.entries());
    appels.push({ chemin: u.pathname, q });
    if (u.pathname === '/api/email-rattacher' && q.mode === 'journal') {
      try {
        const opts = { owner: OWNER, url: 'http://base.test', headers: {}, fetcher };
        const j = q.lire ? await route.lireEmailBoite({ ...opts, id: q.lire, html: q.html === '1', maintenant: MAINTENANT })
          : await route.lireJournalEmail({ ...opts, page: q.page, boite: q.boite || '', cherche: q.cherche || '', compteSeul: q.compte === '1', nonlus: q.nonlus === '1', parPage: Number.parseInt(q.parPage, 10) || undefined });
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
      } catch (e) { return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: String(e && e.message) }) }); }
    }
    if (q.mode === 'reception') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emails: [], adresses: [], collecteur: {}, limite: 100, plus: false }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=emails`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-boite-email]').first().waitFor({ timeout: 25000 });
  return { ctx, pg, erreurs, appels, distantes, csp };
}

async function ouvrirEmail(pg, id) {
  const l = pg.locator(`[data-boite-email="${id}"]`).first();
  await l.scrollIntoViewIfNeeded(); await l.click();
  await pg.locator(`[data-boite-lecture="${id}"] [data-boite-titre]`).first().waitFor({ timeout: 10000 });
}
async function fermer(pg) { const f = pg.locator('[data-boite-fermer]').first(); if (await f.count()) await f.click(); else await pg.keyboard.press('Escape'); await pg.waitForTimeout(250); }
// L'état du cadre ouvert, lu depuis la page (le cadre est de la même origine : sans scripts, il ne peut rien, l'écran le mesure).
const etatCadre = (pg) => pg.evaluate(() => {
  const f = document.querySelector('.vrm-boite-cadre-iframe');
  if (!f) return null;
  const d = f.contentDocument, b = d && d.body;
  const fb = f.getBoundingClientRect();
  const parent = f.closest('[data-boite-lecture]').getBoundingClientRect();
  const fond = b ? getComputedStyle(b).backgroundColor : '';
  const carte = d && d.querySelector('.carte');
  return { sandbox: f.getAttribute('sandbox'), echelle: f.getAttribute('data-cadre-echelle'), largeur: Math.round(fb.width), gauche: Math.round(fb.left), droite: Math.round(fb.right), parentDroite: Math.round(parent.right), hauteur: Math.round(fb.height), fond, carte: carte ? getComputedStyle(carte).backgroundColor : null, texte: b ? b.innerText.slice(0, 400) : '', tableau: d ? d.querySelectorAll('table').length : 0, imgs: d ? [...d.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src') || '', attente: i.getAttribute('data-vrm-src') || '', ok: i.complete && i.naturalWidth > 0 })) : [], liens: d ? [...d.querySelectorAll('a[href]')].map((a) => [a.getAttribute('target'), a.getAttribute('rel')]) : [], scripts: d ? d.querySelectorAll('script, iframe, object, embed, form, meta[http-equiv=refresh], base').length - d.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').length : -1, etat: f.closest('[data-cadre-email]').getAttribute('data-images'), largeurPage: document.documentElement.clientWidth, deborde: document.scrollingElement.scrollWidth > document.documentElement.clientWidth + 1, xss: window.__xssAppels.slice() };
});

(async () => {
  fs.mkdirSync(CAPT, { recursive: true });
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ dist/ absent : npm run build'); process.exit(1); }
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const H = await import(path.join(RACINE, 'api', '_lib', 'email-html.js'));
  const route = await import(path.join(RACINE, 'api', '_lib', 'reception-email.js'));
  const extra = lignesHtml(H);
  const neuveBase = () => ({ rows: [...extra, ...FX.rows].map((x) => ({ ...x })), comptes: FX.comptes.slice() });
  const vieux = FX.rows.filter((x) => x.id.startsWith('email_reception_') && x.data.type === 'vente').sort((a, b) => String(b.data.at).localeCompare(String(a.data.at)))[0];

  for (const [vw, tactile] of [[{ width: 390, height: 844 }, true], [{ width: 1512, height: 945 }, false]]) {
    for (const sombre of [false, true]) {
      const nom = `${vw.width}${sombre ? '-sombre' : '-clair'}`;
      console.log(`\n── ${nom}`);
      await essaie(nom, async () => {
        const { ctx, pg, erreurs, appels, distantes } = await ouvrir(nav, neuveBase(), route, { viewport: vw, tactile, sombre });
        // E1 · E2 — la vente
        await ouvrirEmail(pg, ID.vente);
        await pg.locator('.vrm-boite-cadre-iframe[data-cadre-echelle]').waitFor({ timeout: 10000 });
        await pg.locator('[data-cadre-email]').scrollIntoViewIfNeeded();
        await pg.waitForTimeout(300);
        let c = await etatCadre(pg);
        await pg.screenshot({ path: path.join(CAPT, `vente-bloquees-${nom}.png`) });
        dit(c && /Ton article est vendu/.test(c.texte) && /55,00/.test(c.texte) && c.tableau >= 3, `${nom} E1 la vente s'ouvre mise en page (son texte, ses tableaux)`, c && c.texte.slice(0, 80));
        dit(c && c.droite <= c.parentDroite + 1 && c.gauche >= 0 && !c.deborde && c.hauteur > 300, `${nom} E1 à la largeur de l'écran, sans défilement de côté (échelle ${c && c.echelle}, ${c && c.largeur}×${c && c.hauteur})`, JSON.stringify(c && { l: c.largeur, d: c.droite, p: c.parentDroite, deborde: c.deborde }));
        if (vw.width === 390) dit(c && Number(c.echelle) < 1, `${nom} E1 un e-mail de 600 px est réduit à l'échelle au téléphone`, c && c.echelle);
        dit(c && c.sandbox && !/allow-scripts/.test(c.sandbox) && c.scripts === 0, `${nom} E1 cadre isolé (sandbox sans scripts), aucun élément actif dedans`, c && c.sandbox);
        dit(c && c.liens.length >= 2 && c.liens.every(([t, r]) => t === '_blank' && /noopener/.test(r) && /noreferrer/.test(r)), `${nom} E1 les liens s'ouvrent ailleurs (noopener noreferrer)`);
        dit(c && c.etat === 'bloquees' && distantes.length === 0 && c.imgs.every((i) => !i.src && /^https:/.test(i.attente)), `${nom} E2 aucune image distante demandée avant le geste`, distantes.join(' | '));
        if (sombre) dit(c && /rgb\(255, 255, 255\)/.test(c.fond), `${nom} E3 la nuit, fond CLAIR dans le cadre (l'e-mail n'a pas de thème sombre)`, c && c.fond);
        await pg.locator('[data-cadre-afficher-images]').click();
        await pg.waitForFunction(() => { const f = document.querySelector('.vrm-boite-cadre-iframe'); const d = f && f.contentDocument; return d && [...d.querySelectorAll('img')].length && [...d.querySelectorAll('img')].every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(400);
        c = await etatCadre(pg);
        await pg.screenshot({ path: path.join(CAPT, `vente-images-${nom}.png`) });
        dit(c && c.etat === 'montrees' && c.imgs.length === 2 && c.imgs.every((i) => i.ok) && distantes.filter((u) => /images\.exemple\.test/.test(u)).length === 2, `${nom} E2 « Afficher les images » : les 2 images chargées, une fois`, distantes.join(' | '));
        dit(!distantes.some((u) => /suivi\.exemple\.test|cdn\.exemple\.test|fond\.png/.test(u)), `${nom} E2 aucun pixel de suivi, aucune feuille ni police distante, aucun fond CSS — même après le geste`, distantes.join(' | '));
        dit(appels.some((a) => a.q.lire === ID.vente && a.q.html === '1'), `${nom} E1 hors mode stream, l'écran demande la mise en page`);
        await fermer(pg);
        // E3 — le colis qui sait se mettre en sombre
        await ouvrirEmail(pg, ID.retrait);
        await pg.locator('.vrm-boite-cadre-iframe[data-cadre-echelle]').waitFor({ timeout: 10000 });
        await pg.locator('[data-cadre-email]').scrollIntoViewIfNeeded();
        await pg.waitForTimeout(300);
        c = await etatCadre(pg);
        await pg.screenshot({ path: path.join(CAPT, `retrait-${nom}.png`) });
        dit(c && /418205/.test(c.texte) && (sombre ? c.carte === 'rgb(28, 28, 30)' : c.carte === 'rgb(255, 255, 255)'), `${nom} E3 le colis à retirer suit ${sombre ? 'le sombre (il en a un)' : 'le clair'}`, c && c.carte);
        await fermer(pg);
        // E4 — l'e-mail piégé
        await ouvrirEmail(pg, ID.piege);
        await pg.locator('.vrm-boite-cadre-iframe[data-cadre-echelle]').waitFor({ timeout: 10000 });
        await pg.locator('[data-cadre-email]').scrollIntoViewIfNeeded();
        await pg.waitForTimeout(1500);
        c = await etatCadre(pg);
        await pg.screenshot({ path: path.join(CAPT, `piege-${nom}.png`) });
        dit(c && c.xss.length === 0 && c.scripts === 0, `${nom} E4 l'e-mail piégé (${VECTEURS.length} vecteurs bruts en base) : rien ne s'exécute`, c && c.xss.join(','));
        if (await pg.locator('[data-cadre-afficher-images]').count()) { await pg.locator('[data-cadre-afficher-images]').click(); await pg.waitForTimeout(1200); }
        c = await etatCadre(pg);
        dit(c && c.xss.length === 0 && !distantes.some((u) => /piege\.exemple\.test/.test(u)), `${nom} E4 même images affichées : rien ne s'exécute, rien du piège n'est chargé`, (c && c.xss.join(',')) + ' ' + distantes.filter((u) => /piege/.test(u)).join(' | '));
        await fermer(pg);
        // E5 — un vieil e-mail sans HTML
        if (vieux) {
          await ouvrirEmail(pg, vieux.id);
          await pg.waitForTimeout(400);
          const t = await pg.evaluate(() => ({ cadre: !!document.querySelector('.vrm-boite-cadre-iframe'), origine: [...document.querySelectorAll('[data-boite-origine]')].map((x) => x.getAttribute('data-boite-origine')), corps: !!document.querySelector('[data-boite-corps]') }));
          dit(!t.cadre && t.corps, `${nom} E5 un e-mail sans mise en page gardée : le texte remis en forme (${t.origine.join(',') || 'sans note'})`, JSON.stringify(t));
          await fermer(pg);
        }
        dit(erreurs.length === 0, `${nom} aucune erreur JavaScript ni console`, erreurs.slice(0, 3).join(' | '));
        await ctx.close();
      });
    }
  }

  // E6 — mode stream
  console.log('\n── mode stream');
  await essaie('stream', async () => {
    const { ctx, pg, erreurs, appels, distantes } = await ouvrir(nav, neuveBase(), route, { viewport: { width: 390, height: 844 }, tactile: true, sombre: false, stream: true });
    await ouvrirEmail(pg, ID.vente);
    await pg.waitForTimeout(500);
    const t = await pg.evaluate(() => ({ cadre: !!document.querySelector('.vrm-boite-cadre-iframe'), note: !!document.querySelector('[data-boite-origine="stream"]') }));
    await pg.locator('[data-boite-origine="stream"]').scrollIntoViewIfNeeded().catch(() => {});
    await pg.screenshot({ path: path.join(CAPT, 'stream-390.png') });
    dit(t.note && !t.cadre, 'E6 mode stream : « Masqué en mode stream », aucun cadre', JSON.stringify(t));
    dit(!appels.some((a) => a.q.html === '1') && distantes.length === 0, 'E6 mode stream : la mise en page n’est jamais demandée (ni rien de distant)', appels.filter((a) => a.q.html).map((a) => a.q.lire).join(','));
    dit(erreurs.length === 0, 'stream : aucune erreur', erreurs.slice(0, 3).join(' | '));
    await ctx.close();
  });

  // X0-X2 — les barrières une à une, dans un harnais où les scripts SONT permis.
  console.log('\n── les barrières, une à une');
  await essaie('harnais', async () => {
    const sb = /export const SANDBOX_CADRE = '([^']*)'/.exec(fs.readFileSync(path.join(RACINE, 'src', 'CadreEmail.jsx'), 'utf8'))[1];
    const ctx = await nav.newContext();
    const pg = await ctx.newPage();
    await pg.route(/^https?:\/\//i, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '' }));
    await pg.goto('about:blank');
    const essai = async (docs, sandbox) => pg.evaluate(async ([docs, sandbox]) => {
      window.__xssAppels = []; window.__xss = (n) => window.__xssAppels.push(String(n));
      document.body.innerHTML = '';
      for (const d of docs) { const f = document.createElement('iframe'); f.setAttribute('sandbox', sandbox); f.srcdoc = d; document.body.appendChild(f); }
      await new Promise((r) => setTimeout(r, 2500));
      return [...new Set(window.__xssAppels)];
    }, [docs, sandbox]);
    const bruts = VECTEURS.map(([, h]) => h);
    const x0 = await essai(bruts, 'allow-scripts allow-same-origin');
    dit(x0.length >= 10, `X0 le harnais voit une exécution : ${x0.length} vecteurs BRUTS s'exécutent, scripts permis`, x0.join(','));
    const assainis = VECTEURS.map(([, h]) => { const r = H.assainirHtml(h); return r.ok ? r.html : ''; });
    const x1 = await essai(assainis, 'allow-scripts allow-same-origin');
    dit(x1.length === 0, `X1 assainis, scripts PERMIS : plus aucun ne s'exécute (${VECTEURS.length} vecteurs)`, x1.join(','));
    const x2 = await essai(bruts, sb);
    dit(x2.length === 0, `X2 bruts, dans le sandbox du cadre (« ${sb} ») : aucun ne s'exécute`, x2.join(','));
    await ctx.close();
  });

  ko += V.bilanCsp();
  await nav.close(); srv.close();
  console.log(`\n${ok} verts / ${ko} rouges — captures : ${CAPT}`);
  process.exit(ko ? 1 : 0);
})();
