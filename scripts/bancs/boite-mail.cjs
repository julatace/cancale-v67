require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  Banc — la boîte « E-mails » au VOLUME RÉEL (6 nov., v36 « boîte mail »)
//  Julien : « continue à améliorer la boîte mail de l'app, c'est pas ouf » ;
//  « je veux vraiment quelque chose de plus visuel, de beaucoup plus beau ».
//
//  La boîte servie : ~950 e-mails INVENTÉS (scripts/bancs/_fx-boite-mail.cjs,
//  proportions mesurées chez lui), ou une copie posée hors dépôt (`BANC_FX` :
//  un JSON de même forme — jamais commité). La route n'est PAS imitée : c'est
//  la VRAIE `lireJournalEmail` / `lireEmailBoite` (api/_lib/reception-email.js)
//  qui répond, sur une base servie dans sa forme (scripts/bancs/_minipgrest.cjs :
//  projection `select=`, `data->>`, `cs.`, `ilike`, `gt.`, `in.`, `order`,
//  `offset`) ; les écritures de l'app sur `vrm_emails_lus` (comparer-et-échanger
//  sur `data->>rev`) vont dans la même base.
//
//  Juge, à 390 px tactile et 1512 px, clair et sombre : zéro erreur JavaScript ni
//  console, aucun « undefined / NaN / null » à l'écran, rien qui dépasse la page,
//  cibles ≥ 44 px ; le temps d'ouverture de l'écran, de la liste ENTIÈRE
//  chargée et d'un e-mail, et les tâches longues pendant le défilement ; puis
//  les RÈGLES (section « règles », rouge sur l'arbre d'avant) : la ligne courte
//  tirée du résumé rangé, jamais du sujet ; le code de retrait sur la ligne
//  SEULEMENT s'il est lu, copiable d'un toucher ; lu / non lu (point, filtre,
//  « Tout marquer lu », relu par la route) ; la carte « ce qu'il faut savoir »
//  et les gestes PAR IDENTITÉ ; le message d'origine propre, sans aucune balise
//  ni script ; le mode stream qui cache les codes.
//  Captures dans CAPTURE_DIR. `BANC_SEUL=mesures` : captures + mesures seules
//  (l'arbre d'avant n'a pas les règles neuves : elles y sont rouges, c'est voulu).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { servir } = require('./_minipgrest.cjs');
const RACINE = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || 11710);
const CAPT = process.env.CAPTURE_DIR || path.join(os.tmpdir(), 'banc-boite-mail');
const SEUL = process.env.BANC_SEUL || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const FX = process.env.BANC_FX ? JSON.parse(fs.readFileSync(process.env.BANC_FX, 'utf8')) : require('./_fx-boite-mail.cjs').construire();
const OWNER = FX.owner, MAINTENANT = FX.maintenant;
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Math.max(Date.now(), MAINTENANT) + 24 * 3600e3, user: { id: OWNER, email: 'vendeuse@exemple.test' } };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); } };
const mesures = [];

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// La base : une copie par contexte (les écritures d'un contexte ne fuient pas dans l'autre).
const neuveBase = () => ({ rows: FX.rows.map((x) => ({ ...x, data: x.data })), comptes: FX.comptes.slice() });
const fetcherDe = (base) => async (u) => {
  const url = new URL(u);
  const table = url.pathname.split('/').pop();
  const rows = table === 'vinted_accounts' ? base.comptes.map((c) => ({ ...c, data: {} })) : base.rows;
  const { body } = servir(rows, u, {});
  // vinted_accounts : la projection lit des colonnes, pas `data`.
  const out = table === 'vinted_accounts' ? base.comptes.filter((c) => !url.searchParams.get('owner') || ('eq.' + c.owner) === url.searchParams.get('owner')).map((c) => ({ vinted_user_id: c.vinted_user_id, login: c.login })) : body;
  return { ok: true, status: 200, json: async () => out };
};

async function ouvrir(nav, base, { viewport, tactile, sombre, reduit = false, stream = false }) {
  const ctx = await nav.newContext({ viewport, hasTouch: tactile, isMobile: tactile, reducedMotion: reduit ? 'reduce' : 'no-preference', colorScheme: sombre ? 'dark' : 'light', timezoneId: 'Europe/Paris', locale: 'fr-FR', permissions: ['clipboard-read', 'clipboard-write'] });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(12000);
  await pg.clock.setFixedTime(MAINTENANT);
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push('page: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/i.test(m.text())) erreurs.push('console: ' + m.text().slice(0, 200)); });
  await pg.addInitScript(([s, sombre, stream]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_bienvenue_vue', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); if (stream) localStorage.setItem('vrm_stream', 'true'); } catch (_) {} window.__aller = []; window.addEventListener('vrm:aller', (e) => window.__aller.push(e.detail)); }, [SESSION, sombre, stream]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  const ecritures = [];
  await pg.route('**/rest/v1/**', async (r) => {
    const q = r.request(), u = new URL(q.url()), m = q.method();
    const idp = u.searchParams.get('id') || '';
    if (/vrm_emails_lus/.test(idp) || (m === 'POST' && /vrm_emails_lus/.test(q.postData() || ''))) {
      if (m === 'GET') { const l = base.rows.find((x) => x.id === 'vrm_emails_lus'); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(l ? [{ id: l.id, data: l.data }] : []) }); }
      const corps = JSON.parse(q.postData() || 'null');
      if (m === 'POST') { const x = (Array.isArray(corps) ? corps : [corps])[0]; if (base.rows.some((y) => y.id === 'vrm_emails_lus')) return r.fulfill({ status: 409, body: '' }); base.rows.push({ owner: OWNER, id: 'vrm_emails_lus', data: x.data }); ecritures.push(x.data); return r.fulfill({ status: 201, body: '' }); }
      if (m === 'PATCH') { const l = base.rows.find((x) => x.id === 'vrm_emails_lus'); const g = u.searchParams.get('data->>rev'); const rev = l && l.data && l.data.rev != null ? String(l.data.rev) : null; const passe = l && (g === 'is.null' ? rev == null : g === 'eq.' + rev); if (!passe) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); l.data = corps.data; ecritures.push(corps.data); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: l.id }]) }); }
    }
    if (m !== 'GET') return r.fulfill({ status: 201, contentType: 'application/json', body: '' });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  const appels = [];
  const route = await import(path.join(RACINE, 'api', '_lib', 'reception-email.js'));
  await pg.route('**/api/**', async (r) => {
    const u = new URL(r.request().url());
    if (u.searchParams.get('mode') === 'confidentialite') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uid: OWNER }) });
    const q = Object.fromEntries(u.searchParams.entries());
    appels.push({ chemin: u.pathname, q });
    if (u.pathname === '/api/email-rattacher' && q.mode === 'journal') {
      try {
        const opts = { owner: OWNER, url: 'http://base.test', headers: {}, fetcher: fetcherDe(base) };
        const j = q.lire ? await route.lireEmailBoite({ ...opts, id: q.lire })
          : await route.lireJournalEmail({ ...opts, page: q.page, etat: q.etat || '', type: q.type || '', adresse: q.adresse || '', boite: q.boite || '', cherche: q.cherche || '', compteSeul: q.compte === '1', nonlus: q.nonlus === '1', parPage: Number.parseInt(q.parPage, 10) || undefined });
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
      } catch (e) { return r.fulfill({ status: e && e.message === 'rubrique' ? 400 : 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: String(e && e.message) }) }); }
    }
    if (q.mode === 'reception') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emails: [], adresses: [], collecteur: {}, limite: 100, plus: false }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  const t0 = Date.now();
  await pg.goto(`http://localhost:${PORT}/?tab=emails`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-boite-email]').first().waitFor({ timeout: 20000 });
  const tPremiere = Date.now() - t0;
  return { ctx, pg, erreurs, appels, ecritures, tPremiere };
}
const journal = (appels) => appels.filter((a) => a.chemin === '/api/email-rattacher' && a.q.mode === 'journal' && !a.q.lire);

// Ce qui se voit et ne doit jamais se voir.
async function inspecter(pg, nom, racine = '[data-boite-emails]') {
  return pg.evaluate(([sel]) => {
    const r = document.querySelector(sel) || document.body;
    const vis = (n) => { const b = n.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(n).visibility !== 'hidden'; };
    const txt = (r.innerText || '') + ' ' + [...document.querySelectorAll('[data-boite-feuille]')].map((x) => x.innerText).join(' ');
    const mots = (txt.match(/\b(undefined|NaN|null|\[object Object\]|currency_code)\b/g) || []);
    const largeur = document.documentElement.clientWidth;
    const deborde = document.scrollingElement.scrollWidth > largeur + 1;
    // Un élément qui dépasse la page SANS être rogné par un parent (overflow) se voit coupé.
    const rogne = (n) => { for (let p = n.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p); if (/hidden|clip|auto|scroll/.test(o.overflowX) && p.getBoundingClientRect().right <= largeur + 1) return true; } return false; };
    const feuille = document.querySelector('[data-boite-feuille]');
    const hors = [...document.querySelectorAll(feuille ? '[data-boite-feuille] *' : '[data-boite-emails] *')].filter((n) => vis(n) && n.getBoundingClientRect().right > largeur + 1 && !rogne(n)).map((n) => (n.className && String(n.className).slice(0, 40)) || n.tagName).slice(0, 5);
    const petits = [...document.querySelectorAll('[data-boite-emails] button, [data-boite-emails] select, [data-boite-emails] a[href], [data-boite-feuille] button, [data-boite-feuille] a[href]')]
      .filter((n) => vis(n) && !n.closest('[aria-hidden="true"]')).filter((n) => { const b = n.getBoundingClientRect(); return b.height < 43.5 || b.width < 43.5; }).map((n) => (n.innerText || n.getAttribute('aria-label') || n.className || '').trim().slice(0, 30)).slice(0, 6);
    return { mots, deborde, hors, petits };
  }, [racine]);
}

(async () => {
  fs.mkdirSync(CAPT, { recursive: true });
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const recus = FX.rows.filter((x) => x.id.startsWith('email_reception_')).sort((a, b) => String(b.data.at).localeCompare(String(a.data.at)));
  console.log(`Boîte servie : ${recus.length} e-mails (${process.env.BANC_FX ? 'copie hors dépôt' : 'inventés'})`);
  // Un e-mail de chaque nature (le plus récent), pour les captures de lecture.
  const r_ = (x) => x.data.resume || {};
  const NATURES = [
    ['vente', (x) => x.data.type === 'vente'], ['bordereau', (x) => x.data.type === 'bordereau'], ['code', (x) => x.data.type === 'suivi' && r_(x).code],
    ['offre', (x) => x.data.type === 'offre' && r_(x).mt], ['achat', (x) => x.data.type === 'achat' && r_(x).tx], ['commande', (x) => /commande mise à jour/.test(r_(x).f || '')],
    ['leboncoin', (x) => /leboncoin/i.test(x.data.from)], ['ebay', (x) => /ebay/i.test(x.data.from)], ['vestiaire', (x) => /vestiaire/i.test(x.data.from)],
    ['averifier', (x) => x.data.etat === 'a-verifier' && x.data.type === 'ignoré'], ['ancien', (x) => !x.data.resume],
  ].map(([k, f]) => [k, recus.find(f)]).filter(([, x]) => x);
  try {
    for (const sombre of [false, true]) for (const [viewport, tactile] of [[{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false]]) {
      const w = viewport.width, nom = `${w}-${sombre ? 'sombre' : 'clair'}`;
      await essaie('boîte ' + nom, async () => {
        const base = neuveBase();
        const { ctx, pg, erreurs, appels, tPremiere } = await ouvrir(nav, base, { viewport, tactile, sombre });
        await pg.waitForTimeout(600);
        await pg.screenshot({ path: path.join(CAPT, `liste-${nom}.png`) });
        const ins = await inspecter(pg, nom);
        dit(!ins.mots.length && !ins.deborde && !ins.hors.length, `${nom} : liste — aucun undefined/NaN/null, rien ne dépasse`, JSON.stringify(ins));
        dit(!ins.petits.length, `${nom} : liste — chaque cible au doigt fait 44 px`, JSON.stringify(ins.petits));
        // La liste ENTIÈRE : la suite se charge au défilement (ou « Voir plus » sur l'arbre d'avant).
        const tA = Date.now();
        for (let i = 0; i < 80; i++) {
          const n = await pg.locator('[data-boite-email]').count();
          if (n >= recus.length) break;
          const plus = pg.locator('[data-boite-plus]');
          if (await plus.count() && await plus.isEnabled().catch(() => false)) await plus.click({ timeout: 3000 }).catch(() => {});
          await pg.evaluate(() => { const l = document.querySelectorAll('[data-boite-email]'); const d = l[l.length - 1]; if (d) d.scrollIntoView({ block: 'end' }); });
          await pg.waitForTimeout(250);
        }
        const nTotal = await pg.locator('[data-boite-email]').count();
        const tToute = Date.now() - tA;
        // Défilement de haut en bas : les tâches longues (> 50 ms) mesurées par la page.
        const def = await pg.evaluate(async () => {
          const longues = []; let obs;
          try { obs = new PerformanceObserver((l) => { for (const e of l.getEntries()) longues.push(e.duration); }); obs.observe({ type: 'longtask', buffered: false }); } catch (_) {}
          // Le conteneur qui défile vraiment (la coque fait défiler son <main>, pas la page).
          const premier = document.querySelector('[data-boite-email]');
          let s = document.scrollingElement;
          for (let p = premier && premier.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if (/auto|scroll/.test(o) && p.scrollHeight > p.clientHeight + 4) { s = p; break; } }
          s.scrollTop = 0;
          const t0 = performance.now(); let images = 0;
          await new Promise((fin) => { const pas = () => { images++; const avant = s.scrollTop; s.scrollTop += 120; if (s.scrollTop === avant) return fin(); if (images > 2400) return fin(); requestAnimationFrame(pas); }; requestAnimationFrame(pas); });
          const dt = performance.now() - t0; if (obs) obs.disconnect();
          return { ms: Math.round(dt), images, imgParS: Math.round(images / (dt / 1000)), longues: longues.length, longuesMs: Math.round(longues.reduce((a, b) => a + b, 0)), noeuds: document.querySelectorAll('[data-boite-emails] *').length };
        });
        mesures.push({ nom, tPremiere, nTotal, tToute, ...def });
        console.log(`  ⏱  ${nom} : 1re ligne ${tPremiere} ms · ${nTotal} lignes chargées en ${tToute} ms · défilement ${def.images} images en ${def.ms} ms (${def.imgParS}/s), ${def.longues} tâches longues (${def.longuesMs} ms), ${def.noeuds} nœuds`);
        dit(nTotal >= Math.min(recus.length, 900), `${nom} : la boîte entière se charge (${nTotal}/${recus.length})`);
        await pg.evaluate(() => { const p = document.querySelector('[data-boite-email]'); if (p) p.scrollIntoView({ block: 'center' }); });
        await pg.waitForTimeout(300);
        // Un e-mail de chaque nature, ouvert.
        for (const [k, x] of NATURES) {
          const l = pg.locator(`[data-boite-email="${x.id}"]`).first();
          if (!(await l.count())) { dit(false, `${nom} : ${k} — ligne trouvée`); continue; }
          await l.scrollIntoViewIfNeeded();
          const t1 = Date.now();
          await l.click();
          await pg.locator(`[data-boite-lecture="${x.id}"] [data-boite-titre], [data-boite-lecture="${x.id}"] [data-boite-lecture-etat]`).first().waitFor({ timeout: 8000 });
          const tOuvre = Date.now() - t1;
          await pg.waitForTimeout(450);
          await pg.screenshot({ path: path.join(CAPT, `lecture-${k}-${nom}.png`) });
          const insL = await inspecter(pg, nom);
          dit(!insL.mots.length && !insL.deborde && !insL.hors.length && !insL.petits.length, `${nom} : ${k} ouvert en ${tOuvre} ms — propre (aucun undefined/NaN/null, rien ne dépasse, 44 px)`, JSON.stringify(insL));
          mesures.push({ nom, ouvrir: k, ms: tOuvre });
          const f = pg.locator('[data-boite-fermer]').first();
          if (await f.count()) await f.click(); else await pg.keyboard.press('Escape');
          await pg.waitForTimeout(250);
        }
        dit(erreurs.length === 0, `${nom} : aucune erreur JavaScript ni console`, erreurs.slice(0, 3).join(' | '));
        if (SEUL !== 'mesures') await regles(pg, nom, base, { tactile, appels });
        await ctx.close();
      });
    }
    if (SEUL !== 'mesures') {
      await essaie('stream', async () => {
        const base = neuveBase();
        const { ctx, pg } = await ouvrir(nav, base, { viewport: { width: 390, height: 844 }, tactile: true, sombre: false, stream: true });
        await pg.waitForTimeout(800);
        const code = recus.find((x) => x.data.type === 'suivi' && r_(x).code);
        const vu = await pg.evaluate((c) => document.body.innerText.includes(c), code ? code.data.resume.code : 'zzz');
        await pg.screenshot({ path: path.join(CAPT, 'stream-390.png') });
        dit(code && !vu, 'mode stream : aucun code de retrait lisible dans la boîte');
        await ctx.close();
      });
    }
  } finally {
    fs.writeFileSync(path.join(CAPT, 'mesures.json'), JSON.stringify(mesures, null, 1));
    await nav.close(); srv.close();
    console.log(`\n${ok} verts, ${ko} rouges`);
    process.exitCode = ko ? 1 : 0;
  }
})();

// ── LES RÈGLES (neuves au 6 nov. : rouges sur l'arbre d'avant) ──────────────
async function regles(pg, nom, base, { tactile, appels }) {
  // Rempli plus bas, une fois l'écran construit.
  void pg; void nom; void base; void tactile; void appels;
}
