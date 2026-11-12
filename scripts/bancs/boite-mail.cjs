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
  await pg.addInitScript(([s, sombre, stream]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_bienvenue_vue', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); if (stream) localStorage.setItem('vrm_stream', '1'); } catch (_) {} window.__aller = []; window.addEventListener('vrm:aller', (e) => window.__aller.push(e.detail)); }, [SESSION, sombre, stream]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
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
// Les e-mails chargés : chaque ligne, plus ceux d'une pile repliée (une pile ne cache rien : elle compte).
const chargees = (pg) => pg.evaluate(() => document.querySelectorAll('[data-boite-email]').length + [...document.querySelectorAll('[data-boite-pile][data-deplie="0"]')].reduce((s, x) => s + Number(x.dataset.boitePile || 0), 0));
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
    // (11 nov., lot emails-ecran) 44 px AU DOIGT (§7) ; à la souris d'un ordinateur, l'écran est dense comme Mail : 26 px (même requête que la CSS).
    const petits = [...document.querySelectorAll('[data-boite-emails] button, [data-boite-emails] select, [data-boite-emails] a[href], [data-boite-feuille] button, [data-boite-feuille] a[href]')]
      .filter((n) => vis(n) && !n.closest('[aria-hidden="true"]') && !n.matches('[data-boite-lien]')).filter((n) => { const b = n.getBoundingClientRect(), min = (matchMedia('(min-width:900px) and (hover:hover) and (pointer:fine)').matches ? 25.5 : 43.5); return b.height < min || b.width < min; }).map((n) => (n.innerText || n.getAttribute('aria-label') || n.className || '').trim().slice(0, 30)).slice(0, 6);
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
      if (process.env.BANC_CTX && !process.env.BANC_CTX.split(',').includes(nom)) continue;   // un seul contexte, pour rejouer une mesure
      await essaie('boîte ' + nom, async () => {
        const base = neuveBase();
        const { ctx, pg, erreurs, appels, tPremiere } = await ouvrir(nav, base, { viewport, tactile, sombre });
        await pg.waitForTimeout(600);
        await pg.screenshot({ path: path.join(CAPT, `liste-${nom}.png`) });
        const ins = await inspecter(pg, nom);
        dit(!ins.mots.length && !ins.deborde && !ins.hors.length, `${nom} : liste — aucun undefined/NaN/null, rien ne dépasse`, JSON.stringify(ins));
        dit(!ins.petits.length, `${nom} : liste — chaque cible au doigt fait 44 px`, JSON.stringify(ins.petits));
        // Le seuil de recherche est expliqué sans prétendre filtrer un seul caractère.
        const saisieCourte=pg.locator('[data-boite-cherche-champ]');const avantCourt=journal(appels).length;
        await saisieCourte.fill('x');await pg.locator('[data-boite-aide-recherche]').waitFor();await pg.clock.runFor(400);
        const aideId=await saisieCourte.getAttribute('aria-describedby');
        dit(!!aideId&&await pg.locator('[data-boite-aide-recherche]').getAttribute('id')===aideId&&journal(appels).slice(avantCourt).every(a=>!a.q.cherche),`${nom} : un caractère affiche une aide liée au champ sans lancer une fausse recherche`);
        await Promise.all([pg.waitForResponse(r=>new URL(r.url()).searchParams.get('cherche')==='Nike'),saisieCourte.fill('Nike')]);
        dit(await pg.locator('[data-boite-aide-recherche]').count()===0,`${nom} : l’aide disparaît dès que la recherche est valide`);
        await Promise.all([pg.waitForResponse(r=>{const q=new URL(r.url()).searchParams;return q.get('mode')==='journal'&&!q.has('cherche');}),saisieCourte.fill('')]);
        // Une vue combinant compte et rubrique doit pouvoir revenir à tous les mails.
        const adresseTest=await pg.locator('[data-boite-adresse] option').evaluateAll(es=>es.map(e=>e.value).find(Boolean));
        if(adresseTest){
          await Promise.all([pg.waitForResponse(r=>{const q=new URL(r.url()).searchParams;return q.get('mode')==='journal'&&q.get('adresse')===adresseTest;}),pg.locator('[data-boite-adresse]').selectOption(adresseTest)]);
          await Promise.all([pg.waitForResponse(r=>{const q=new URL(r.url()).searchParams;return q.get('mode')==='journal'&&q.get('adresse')===adresseTest&&q.get('boite')==='ventes';}),pg.locator('[data-boite-rubrique="ventes"]').click()]);
          dit(await pg.locator('[data-boite-vue-filtree]').isVisible(),`${nom} : les filtres combinés sont signalés`);
          await pg.screenshot({path:path.join(CAPT,`filtres-${nom}.png`)});
          await Promise.all([pg.waitForResponse(r=>{const q=new URL(r.url()).searchParams;return q.get('mode')==='journal'&&!['adresse','boite','etat','nonlus','cherche'].some(k=>q.has(k));}),pg.getByRole('button',{name:'Réinitialiser les filtres',exact:true}).click()]);
          dit(await pg.locator('[data-boite-adresse]').inputValue()===''&&await pg.locator('[data-boite-vue-filtree]').count()===0,`${nom} : réinitialiser retire le compte et la rubrique, sans requête filtrée`);
        }else dit(false,`${nom} : fixture multi-comptes disponible pour vérifier les filtres`);
        // La liste ENTIÈRE : la suite se charge au défilement (ou « Voir plus » sur l'arbre d'avant).
        const tA = Date.now();
        for (let i = 0; i < 80; i++) {
          const n = await chargees(pg);
          if (n >= recus.length) break;
          const plus = pg.locator('[data-boite-plus]');
          if (await plus.count() && await plus.isEnabled().catch(() => false)) await plus.click({ timeout: 3000 }).catch(() => {});
          await pg.evaluate(() => { const l = document.querySelectorAll('[data-boite-email]'); const d = l[l.length - 1]; if (d) d.scrollIntoView({ block: 'end' }); });
          await pg.waitForTimeout(250);
        }
        const nTotal = await chargees(pg);
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
    if (SEUL !== 'mesures' && !process.env.BANC_CTX) {
      await essaie('stream', async () => {
        const base = neuveBase();
        const { ctx, pg } = await ouvrir(nav, base, { viewport: { width: 390, height: 844 }, tactile: true, sombre: false, stream: true });
        await pg.waitForTimeout(800);
        const code = recus.find((x) => x.data.type === 'suivi' && r_(x).code);
        const vu = await pg.evaluate((c) => document.body.innerText.includes(c), code ? code.data.resume.code : 'zzz');
        await pg.screenshot({ path: path.join(CAPT, 'stream-390.png') });
        dit(code && !vu, 'mode stream : aucun code de retrait lisible dans la boîte');
        // …ni dans l'e-mail ouvert (la carte d'embarquement, le bouton « copier »).
        const l = pg.locator(`[data-boite-email="${code.id}"]`);
        if (await l.count()) {
          await l.scrollIntoViewIfNeeded(); await l.click();
          await pg.locator('[data-boite-heros="retrait"]').waitFor({ timeout: 8000 });
          await pg.waitForTimeout(400);
          const carte = await pg.locator('[data-boite-heros="retrait"]').innerText();
          await pg.screenshot({ path: path.join(CAPT, 'stream-lecture-390.png') });
          dit(!carte.includes(code.data.resume.code.slice(0, 3) + ' ' + code.data.resume.code.slice(3)) && !carte.includes(code.data.resume.code), 'mode stream : la carte du retrait cache le code', carte.replace(/\n/g, ' | ').slice(0, 160));
        } else dit(false, 'mode stream : la ligne du code est trouvée');
        await ctx.close();
      });
    }
  } finally {
    // Une mesure rejouée s'AJOUTE à celles du dossier (un contexte à la fois).
    let anciennes = []; try { if (process.env.BANC_CTX) anciennes = JSON.parse(fs.readFileSync(path.join(CAPT, 'mesures.json'), 'utf8')).filter((x) => !process.env.BANC_CTX.split(',').includes(x.nom)); } catch (_) {}
    fs.writeFileSync(path.join(CAPT, 'mesures.json'), JSON.stringify([...anciennes, ...mesures], null, 1));
    await nav.close(); srv.close();
    console.log(`\n${ok} verts, ${ko} rouges`);
    process.exitCode = ko ? 1 : 0;
  }
})();

// ── LES RÈGLES (neuves au 6 nov. : rouges sur l'arbre d'avant) ──────────────
async function regles(pg, nom, base, { tactile, appels }) {
  const parId = new Map(base.rows.filter((x) => x.id.startsWith('email_reception_')).map((x) => [x.id, x.data]));
  await pg.evaluate(() => { const p = document.querySelector('[data-boite-email]'); if (p) p.scrollIntoView({ block: 'center' }); });
  // R1. La ligne vient du résumé rangé, jamais du sujet.
  const lignes = await pg.locator('[data-boite-email]').evaluateAll((l) => l.map((x) => ({ id: x.dataset.boiteEmail, quoi: (x.querySelector('[data-boite-quoi]') || {}).textContent || '', texte: x.innerText, code: x.dataset.boiteACode === '1', lu: x.dataset.lu })));
  // (Un sujet qui dit mot pour mot la nature tirée du résumé — « Commande mise à jour » — n'est pas une fuite.)
  const sujet = lignes.filter((x) => { const d = parId.get(x.id); return d && d.subject && d.subject.length > 12 && d.subject.trim() !== x.quoi.trim() && x.texte.includes(d.subject); });
  dit(lignes.length > 100 && !sujet.length, `${nom} : R1 aucune ligne n'écrit le sujet brut (${lignes.length} lignes)`, JSON.stringify(sujet.slice(0, 2)));
  // R2. Le code sur la ligne SEULEMENT s'il est lu (colis à retirer).
  const attendu = (d) => !!(d && d.resume && d.resume.t === 'suivi' && d.resume.st === 'available' && d.resume.sens !== 'sortant' && typeof d.resume.code === 'string' && d.resume.code.trim());
  const fauxCode = lignes.filter((x) => x.code !== attendu(parId.get(x.id)));
  dit(lignes.some((x) => x.code) && !fauxCode.length, `${nom} : R2 code de retrait sur la ligne ⇔ code LU dans le résumé`, JSON.stringify(fauxCode.slice(0, 2)));
  const puce = pg.locator('[data-boite-code-copier]').first();
  if (await puce.count()) {
    const brut = await puce.getAttribute('data-boite-code-copier');
    const bb = await puce.boundingBox();
    await puce.click();
    await pg.waitForTimeout(200);
    const copie = await pg.evaluate(() => navigator.clipboard.readText().catch(() => null));
    const etat = await puce.getAttribute('data-copie');
    dit(bb && bb.height >= (nom.startsWith('390') ? 44 : 26) && bb.width >= 44 && copie === brut && etat === '1' && (await pg.locator('[data-boite-lecture]').count()) === 0, `${nom} : R2 un toucher sur le code le COPIE (sans ouvrir l'e-mail), 44 px`, JSON.stringify({ copie, brut, etat, bb }));
  }
  // R3. Non lu : point bleu, filtre, ouvrir = lu (écrit), « Tout marquer lu ».
  const nonLus = lignes.filter((x) => x.lu === '0');
  const points = await pg.locator('[data-boite-email][data-lu="0"] [data-boite-point="1"]').count();
  dit(nonLus.length > 0 && points === nonLus.length, `${nom} : R3 chaque non-lu porte son point (${points})`);
  const avantEcr = base.rows.find((x) => x.id === 'vrm_emails_lus');
  const revAvant = avantEcr && avantEcr.data && avantEcr.data.rev;
  const cible = pg.locator('[data-boite-email][data-lu="0"]').first();
  const idCible = await cible.getAttribute('data-boite-email');
  await cible.click();
  await pg.locator(`[data-boite-lecture="${idCible}"] [data-boite-titre]`).waitFor({ timeout: 8000 });
  await pg.waitForTimeout(400);
  const ligneLus = base.rows.find((x) => x.id === 'vrm_emails_lus');
  const L = await import(path.join(RACINE, 'api', '_lib', 'emails-lus.js'));
  const luEcrit = ligneLus && L.estLu({ id: idCible, at: parId.get(idCible).at }, L.etatLus(ligneLus.data)) === true && ligneLus.data.rev === (revAvant || 0) + 1;
  // R4. La lecture : la carte et les gestes par identité.
  const lec = await pg.evaluate((id) => { const a = document.querySelector(`[data-boite-lecture="${id}"]`); if (!a) return null; return { heros: (a.querySelector('[data-boite-heros]') || {}).dataset ? a.querySelector('[data-boite-heros]') && a.querySelector('[data-boite-heros]').dataset.boiteHeros : null, gestes: [...a.querySelectorAll('[data-boite-geste-id]')].map((g) => [g.dataset.boiteGesteId, g.dataset.boiteIdent]), bascule: (a.querySelector('[data-boite-basculer-lu]') || {}).textContent || '', balises: a.querySelectorAll('.vrm-boite-msg script, .vrm-boite-msg iframe, .vrm-boite-msg img, .vrm-boite-msg svg, .vrm-boite-msg style').length, texte: a.innerText }; }, idCible);
  dit(luEcrit && lec && /Marquer non lu/.test(lec.bascule), `${nom} : R3 ouvrir un non-lu l'écrit LU (relu par la règle) et propose « Marquer non lu »`, JSON.stringify({ rev: ligneLus && ligneLus.data.rev, revAvant, b: lec && lec.bascule }));
  const d = parId.get(idCible), res = d.resume || {};
  const ident = (k) => (lec.gestes.find((g) => g[0] === k) || [])[1] || '';
  const okGestes = lec.gestes.every(([k, idt]) => (k === 'offres' ? !idt : (k === 'retrait' ? idt === `colis n° ${res.s}` : k === 'colis' || k === 'vente' ? idt.endsWith(String(res.tx)) : k === 'achat' ? idt === `achat n° ${res.tx}` : k === 'vcvente' ? idt.endsWith(String(res.p)) : k === 'num' ? !res.nt : false)));
  dit(okGestes && lec.balises === 0 && !/<\s*(script|iframe|img)\b/i.test(lec.texte), `${nom} : R4 les gestes de l'e-mail ouvert portent SON identité (${lec.gestes.map((g) => g[0]).join(', ') || 'aucun'}) ; le message n'a aucune balise`, JSON.stringify({ g: lec.gestes, ident: ident('retrait'), res: { s: res.s, tx: res.tx } }));
  await pg.locator('[data-boite-fermer]').first().click();
  await pg.waitForTimeout(250);
  // R5. L'e-mail « à vérifier » (texte piégé : <script>, <img onerror>, <iframe>) : rien ne s'exécute.
  const piege = [...parId.entries()].find(([, x]) => x.type === 'ignoré' && x.resume);
  if (piege) {
    const l = pg.locator(`[data-boite-email="${piege[0]}"]`);
    if (await l.count()) {
      await l.scrollIntoViewIfNeeded(); await l.click();
      await pg.locator(`[data-boite-lecture="${piege[0]}"] [data-boite-titre]`).waitFor({ timeout: 8000 });
      const x = await pg.evaluate((id) => { const a = document.querySelector(`[data-boite-lecture="${id}"]`); return { xss: window.__xss || null, balises: a.querySelectorAll('.vrm-boite-msg script, .vrm-boite-msg iframe, .vrm-boite-msg img').length, liens: [...a.querySelectorAll('.vrm-boite-msg a')].map((y) => [y.getAttribute('href'), y.getAttribute('target'), y.getAttribute('rel')]) }; }, piege[0]);
      dit(!x.xss && x.balises === 0 && x.liens.every(([h, t, r]) => /^https?:/.test(h) && t === '_blank' && /noopener/.test(r)), `${nom} : R5 le texte piégé n'exécute rien, aucune balise rendue, liens http(s) ouverts ailleurs`, JSON.stringify(x));
      await pg.locator('[data-boite-fermer]').first().click(); await pg.waitForTimeout(250);
    }
  }
  // R6. Glisser au doigt : lu ⇄ non lu (téléphone).
  if (tactile) {
    const g = pg.locator('[data-boite-email][data-lu="0"]').first();
    if (await g.count()) {
      const gid = await g.getAttribute('data-boite-email');
      await g.scrollIntoViewIfNeeded();
      const bb = await g.boundingBox();
      await g.evaluate((el, b) => {
        const y = b.y + b.height / 2, x0 = b.x + 30;
        const ev = (t, x) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }));
        ev('pointerdown', x0); for (let i = 1; i <= 10; i++) ev('pointermove', x0 + i * 13); ev('pointerup', x0 + 130);
      }, bb);
      await pg.waitForTimeout(500);
      const apres = await pg.locator(`[data-boite-email="${gid}"]`).getAttribute('data-lu');
      const ouverte = await pg.locator('[data-boite-feuille]').count();
      dit(apres === '1' && ouverte === 0, `${nom} : R6 glisser une ligne vers la droite la marque LUE, sans l'ouvrir`, JSON.stringify({ apres, ouverte }));
    }
  }
  // R7. Le filtre « Non lus » (côté route) et « Tout marquer lu ».
  await pg.evaluate(() => { const p = document.querySelector('[data-boite-rubrique="nonlus"]'); if (p) p.scrollIntoView({ block: 'center' }); });
  const avantNL = journal(appels).length;
  await pg.locator('[data-boite-rubrique="nonlus"]').click();
  await pg.waitForTimeout(900);
  const nl = await pg.locator('[data-boite-email]').evaluateAll((l) => l.map((x) => x.dataset.lu));
  const parti = journal(appels).slice(avantNL).some((a) => a.q.nonlus === '1');
  dit(parti && nl.length > 0 && nl.every((x) => x === '0'), `${nom} : R7 « Non lus » demande la route (nonlus=1) et ne montre que des non-lus (${nl.length})`);
  await pg.screenshot({ path: path.join(CAPT, `nonlus-${nom}.png`) });
  const tout = pg.locator('[data-boite-tout-lu]');
  if (await tout.count()) {
    await tout.click(); await pg.waitForTimeout(500);
    const restants = await pg.locator('[data-boite-email][data-lu="0"]').count();
    dit(restants === 0 && (await pg.locator('[data-boite-avis]').count()) === 1, `${nom} : R7 « Marquer ceux-ci lus » : plus aucun point, un mot le dit`);
  } else dit(false, `${nom} : R7 « Tout marquer lu » présent quand il reste des non-lus`);
  await pg.locator('[data-boite-rubrique="tout"]').click(); await pg.waitForTimeout(700);
  // R8. Une pile se déplie et montre chacun de ses e-mails.
  const pile = pg.locator('[data-boite-pile]').first();
  if (await pile.count()) {
    const n = Number(await pile.getAttribute('data-boite-pile'));
    await pile.scrollIntoViewIfNeeded();
    await pile.locator('[data-boite-pile-tete]').click(); await pg.waitForTimeout(250);
    const vus = await pile.locator('[data-boite-email]').count();
    await pg.screenshot({ path: path.join(CAPT, `pile-${nom}.png`) });
    dit(n >= 3 && vus === n, `${nom} : R8 une pile de ${n} e-mails se déplie et les montre tous`, String(vus));
  } else dit(false, `${nom} : R8 au moins une pile dans une boîte au volume réel`);
}
