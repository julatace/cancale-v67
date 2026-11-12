// ═══════════════════════════════════════════════════════════════════════════
// BANC : PARLER À LA LOUPE (11 novembre)
//        (node scripts/bancs/parler-loupe.cjs — après le build)
//        BANC_PORT=… pour un autre port · BANC_DIST=… pour un autre build
// ═══════════════════════════════════════════════════════════════════════════
// La reconnaissance vocale n'existe PAS dans le Chromium du banc (et n'est pas du
// code de VRM) : on injecte une FAUSSE `SpeechRecognition` que le banc pilote
// (`__voix.dire([[texte, final]])`, `__voix.erreur(code)`, `__voix.fin()`).
// Données INVENTÉES (le dépôt est public). Il exige, à 390 px tactile et 1512 px :
//   · un micro dans la loupe quand le navigateur sait reconnaître la voix ;
//   · fr-FR, transcription EN DIRECT : le champ et « J’entends : « … » » suivent la voix ;
//   · « cent vingt-quatre » ⇒ la FICHE N°124 s'ouvre directement (identité unique) ;
//   · « numéro B 125 » ⇒ la fiche B125 (pas la 125) ;
//   · « sept » (deux fiches : 7 et 007) ⇒ AUCUNE fiche, la loupe montre « Tout sur le N°7 » ;
//   · « Nike Dunk rouge quarante-deux » ⇒ « Nike Dunk rouge 42 », la recherche normale ;
//   · micro refusé ⇒ la phrase « Micro refusé… autorise… », le micro disparaît ;
//   · le « Pourquoi ? » de la voix (le navigateur, le service de son éditeur) ;
//   · 390 : un APPUI LONG sur la loupe ouvre la recherche et écoute ; relâcher ne la referme pas ;
//   · un champ de liste (Annonces) : en direct, puis le N° lu ; refus ⇒ la phrase sous le champ ;
//   · sans reconnaissance : AUCUN micro (loupe, champs), l'appui long n'écoute pas ;
//   · aucune erreur de page, aucun débordement.
// Captures : $TMPDIR/vrm-bancs/parler-loupe/*.png (À REGARDER).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 12391;
const SHOTS = path.join(os.tmpdir(), 'vrm-bancs', 'parler-loupe');
fs.mkdirSync(SHOTS, { recursive: true });

const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const T = 'Nike Dunk Low Panda taille 42';
const NUMEROS = {};
for (let i = 0; i < 50; i++) NUMEROS['p' + (201 + i)] = { numero: String(201 + i), title: T, price: '80', accountId: '111' };
NUMEROS['9124'] = { numero: '124', title: 'Asics Gel-Kayano 14 argent', price: '90', accountId: '111' };
NUMEROS.b125 = { numero: 'B125', title: 'Adidas Samba OG blanche', price: '70', accountId: '111' };
NUMEROS.n125 = { numero: '125', title: 'Puma Speedcat rouge', price: '75', accountId: '111' };
NUMEROS.n7 = { numero: '7', title: 'Salomon XT-6 noire', price: '60', accountId: '111' };
NUMEROS.n007 = { numero: '007', title: 'Salomon XT-6 grise', price: '60', accountId: '111' };
const ITEMS = [{ id: 9124, title: 'Asics Gel-Kayano 14 argent', brand_title: 'Asics', price: { amount: '90.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, size_title: '42', status: 'Très bon état', view_count: 3, favourite_count: 0, created_at_ts: MAINTENANT - 3 * 86400000, nPhotos: 2 }];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: NUMEROS, vinted_dark: false } },
  { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: ITEMS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), nItems: 0, payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: ilYaH(0.2), nItems: 0, payload: { my_orders: [] } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (!c && d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 300)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
const motif = (p) => new RegExp('^' + p.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');

// La fausse reconnaissance, pilotée par le banc.
const FAUSSE = () => {
  const V = window.__voix = { vues: [], derniere: null };
  class FausseSR {
    constructor() { V.vues.push(this); V.derniere = this; }
    start() { this.demarree = true; }
    stop() { setTimeout(() => this.onend && this.onend(), 0); }
    abort() { this.onend && this.onend(); }
  }
  V.dire = (tr) => { const r = V.derniere; r && r.onresult && r.onresult({ results: tr.map(([t, f]) => Object.assign([{ transcript: t }], { isFinal: f })) }); };
  V.fin = () => { const r = V.derniere; r && r.onend && r.onend(); };
  V.erreur = (c) => { const r = V.derniere; r && r.onerror && r.onerror({ error: c }); r && r.onend && r.onend(); };
  window.webkitSpeechRecognition = FausseSR;
  window.SpeechRecognition = FausseSR;
};

async function preparer(b, vp, { sombre = false, voix = true, onglet = 'journee' } = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ s }) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (s) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, { s: sombre });
  if (voix) await pg.addInitScript(FAUSSE);
  else await pg.addInitScript(() => { try { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = motif(lk[1]); let l = ROWS.filter((r) => re.test(r.id)); const rg = req.headers()['range']; if (rg) { const m = /(\d+)-(\d+)/.exec(rg); if (m) l = l.slice(+m[1], +m[2] + 1); } return j(l.map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2200);
  return { ctx, pg, errs };
}
const attendre = (pg, f, arg, ms = 6000) => pg.waitForFunction(f, arg, { timeout: ms }).then(() => true).catch(() => false);
const pret = async (pg, tel) => {
  const sel = tel ? 'button[data-recherche-loupe]' : '[data-barre-recherche]';
  for (let i = 0; i < 80; i++) { const ok = await pg.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); if (!r.width) return false; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(t && (e === t || e.contains(t))); }, sel); if (ok) return true; await pg.waitForTimeout(250); }
  return false;
};
const ouvrirLoupe = async (pg, tel) => {
  await pret(pg, tel);
  if (tel) await pg.locator('button[data-recherche-loupe]').first().tap();
  else { await pg.locator('body').click({ position: { x: 5, y: 400 } }).catch(() => {}); await pg.keyboard.press('ControlOrMeta+k'); }
  await attendre(pg, () => { const p = document.querySelector('[data-recherche-panneau]'); return p && p.getAttribute('data-recherche-pret') === '1'; });
};
const micLoupe = (tel) => tel ? '.vrm-hdr-recherche [data-mic-dictee]' : '[data-barre-recherche] [data-mic-dictee]';
const champ = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-recherche-champ]'); return e ? e.value : null; });
const fermerFiche = async (pg) => { await pg.keyboard.press('Escape'); await attendre(pg, () => !document.querySelector('[data-fiche-paire]'), null, 3000); };
const debord = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true]]) {
      const tel = vp.width < 600; const TT = `[${vp.width}${sombre ? ' sombre' : ''}]`; const suf = `${vp.width}${sombre ? '-sombre' : ''}`;
      console.log(`── ${vp.width} px${sombre ? ' · sombre' : ''}`);
      const { ctx, pg, errs } = await preparer(b, vp, { sombre });
      await essaie('micro + pourquoi', async () => {
        await ouvrirLoupe(pg, tel);
        const mic = await pg.$(micLoupe(tel));
        dit(!!mic, `${TT} la loupe a son micro (le navigateur sait reconnaître la voix)`);
        const aide = await pg.evaluate(() => { const a = document.querySelector('[data-voix-aide]'); return a ? { txt: a.innerText, pq: !!a.querySelector('[data-pourquoi]'), pqTxt: (a.querySelector('.vrm-pourquoi-texte') || {}).textContent || '' } : null; });
        dit(aide && aide.pq && /éditeur/.test(aide.pqTxt) && /aucun son/i.test(aide.pqTxt), `${TT} « À la voix… » et son « Pourquoi ? » (le navigateur, le service de son éditeur ; VRM n’envoie aucun son)`, JSON.stringify(aide));
        await pg.screenshot({ path: path.join(SHOTS, `aide-${suf}.png`) });
      });
      await essaie('direct + N° unique', async () => {
        await pg.locator(micLoupe(tel)).first().click();
        const sr = await pg.evaluate(() => { const r = window.__voix.derniere; return r ? { lang: r.lang, interim: r.interimResults, demarree: r.demarree } : null; });
        dit(sr && sr.lang === 'fr-FR' && sr.interim === true && sr.demarree, `${TT} toucher le micro : reconnaissance du navigateur, fr-FR, en direct`, JSON.stringify(sr));
        const ecoute = await attendre(pg, () => !!document.querySelector('[data-voix-ecoute="1"]'));
        dit(ecoute, `${TT} « J’écoute… » s’affiche`);
        await pg.evaluate(() => window.__voix.dire([['cent vingt', false]]));
        const vu = await attendre(pg, () => { const e = document.querySelector('[data-voix-entendu]'); return e && e.textContent === 'cent vingt'; });
        dit(vu && (await champ(pg)) === 'cent vingt', `${TT} la transcription s’affiche EN DIRECT (champ et « J’entends : « cent vingt » »)`, String(await champ(pg)));
        await pg.screenshot({ path: path.join(SHOTS, `direct-${suf}.png`) });
        await pg.evaluate(() => { window.__voix.dire([['cent vingt-quatre', true]]); window.__voix.fin(); });
        const fiche = await attendre(pg, () => { const f = document.querySelector('[data-fiche-paire]'); return f && f.getAttribute('data-fiche-paire'); });
        const n = await pg.evaluate(() => { const f = document.querySelector('[data-fiche-paire]'); return f ? f.getAttribute('data-fiche-paire') : null; });
        dit(fiche && n === '124', `${TT} « cent vingt-quatre » ⇒ la fiche N°124 s’ouvre directement (identité unique)`, String(n));
        await pg.screenshot({ path: path.join(SHOTS, `fiche-124-${suf}.png`) });
        await fermerFiche(pg);
      });
      await essaie('B125', async () => {
        await ouvrirLoupe(pg, tel);
        await pg.locator(micLoupe(tel)).first().click();
        await pg.evaluate(() => { window.__voix.dire([['numéro B 125', true]]); window.__voix.fin(); });
        await attendre(pg, () => !!document.querySelector('[data-fiche-paire]'));
        const n = await pg.evaluate(() => { const f = document.querySelector('[data-fiche-paire]'); return f ? f.getAttribute('data-fiche-paire') : null; });
        dit(n === 'B125', `${TT} « numéro B 125 » ⇒ la fiche B125 (pas la 125)`, String(n));
        await fermerFiche(pg);
      });
      await essaie('doublon', async () => {
        await ouvrirLoupe(pg, tel);
        await pg.locator(micLoupe(tel)).first().click();
        await pg.evaluate(() => { window.__voix.dire([['sept', true]]); window.__voix.fin(); });
        await attendre(pg, () => { const p = document.querySelector('[data-recherche-panneau]'); return p && p.getAttribute('data-recherche-q') === '7'; });
        const x = await pg.evaluate(() => ({ fiche: !!document.querySelector('[data-fiche-paire]'), q: (document.querySelector('[data-recherche-panneau]') || { getAttribute: () => null }).getAttribute('data-recherche-q'), tout: !!document.querySelector('[data-recherche-panneau] [data-tout-num]') }));
        dit(!x.fiche && x.q === '7', `${TT} « sept » (deux fiches : 7 et 007) ⇒ AUCUNE fiche ouverte, la loupe cherche « 7 »`, JSON.stringify(x));
        dit(x.tout, `${TT} … et montre « Tout sur le N°7 » (la liste, à lui de choisir)`, JSON.stringify(x));
        await pg.screenshot({ path: path.join(SHOTS, `doublon-7-${suf}.png`) });
      });
      await essaie('texte', async () => {
        await pg.locator(micLoupe(tel)).first().click();
        await pg.evaluate(() => { window.__voix.dire([['Nike Dunk rouge quarante-deux', true]]); window.__voix.fin(); });
        await attendre(pg, () => { const p = document.querySelector('[data-recherche-panneau]'); return p && p.getAttribute('data-recherche-q') === 'nike dunk rouge 42'; });
        const x = await pg.evaluate(() => ({ fiche: !!document.querySelector('[data-fiche-paire]'), v: (document.querySelector('[data-recherche-champ]') || {}).value }));
        dit(!x.fiche && x.v === 'Nike Dunk rouge 42', `${TT} « Nike Dunk rouge quarante-deux » ⇒ « Nike Dunk rouge 42 », la recherche normale`, JSON.stringify(x));
        dit((await debord(pg)) <= 1, `${TT} aucun débordement`);
        await pg.screenshot({ path: path.join(SHOTS, `texte-${suf}.png`) });
      });
      await essaie('refus', async () => {
        await pg.locator(micLoupe(tel)).first().click();
        await pg.evaluate(() => window.__voix.erreur('not-allowed'));
        const vu = await attendre(pg, () => { const e = document.querySelector('[data-recherche-panneau] [data-voix-erreur="refus"]'); return e && /autorise/.test(e.innerText); });
        dit(vu, `${TT} micro refusé ⇒ la phrase « Micro refusé… autorise le micro… » dans la loupe`);
        const reste = await pg.$(micLoupe(tel));
        dit(!reste, `${TT} … et le micro disparaît (jamais un bouton mort)`);
        await pg.screenshot({ path: path.join(SHOTS, `refus-${suf}.png`) });
      });
      dit(!errs.length, `${TT} aucune erreur de page`, errs.join(' | ').slice(0, 300));
      await ctx.close();

      // ── Appui long sur la loupe (téléphone) ──────────────────────────────
      if (tel) {
        const { ctx: c2, pg: p2, errs: e2 } = await preparer(b, vp, {});
        await essaie('appui long', async () => {
          await pret(p2, true);
          const voixAttr = await p2.evaluate(() => (document.querySelector('button[data-recherche-loupe]') || { getAttribute: () => null }).getAttribute('data-recherche-loupe-voix'));
          const n0 = await p2.evaluate(() => window.__voix.vues.length);
          const loupe = p2.locator('button[data-recherche-loupe]').first();
          await loupe.dispatchEvent('pointerdown', { button: 0, pointerType: 'touch', isPrimary: true });
          const ecoute = await attendre(p2, (n) => window.__voix.vues.length > n && !!document.querySelector('[data-voix-ecoute="1"]'), n0, 3000);
          await loupe.dispatchEvent('pointerup', { button: 0, pointerType: 'touch', isPrimary: true });
          await loupe.dispatchEvent('click');
          await p2.waitForTimeout(250);
          const ouvert = await p2.evaluate(() => !!document.querySelector('[data-recherche-panneau]') && !!document.querySelector('[data-voix-ecoute="1"]'));
          dit(voixAttr === '1' && ecoute, `${TT} appui long sur la loupe ⇒ la recherche s’ouvre et écoute`, JSON.stringify({ voixAttr, ecoute }));
          dit(ouvert, `${TT} relâcher le doigt ne referme pas la loupe (elle écoute toujours)`);
          await p2.evaluate(() => window.__voix.dire([['cent vingt-quatre', true]]));
          await p2.evaluate(() => window.__voix.fin());
          const n = await attendre(p2, () => document.querySelector('[data-fiche-paire]') && document.querySelector('[data-fiche-paire]').getAttribute('data-fiche-paire') === '124');
          dit(n, `${TT} … puis « cent vingt-quatre » ⇒ la fiche N°124`);
          // Un toucher COURT reste un toucher : ouvre sans écouter.
          await fermerFiche(p2);
          const n1 = await p2.evaluate(() => window.__voix.vues.length);
          if (await p2.$('[data-recherche-panneau]')) await p2.locator('.vrm-hdr-recherche-fermer').first().tap().catch(() => {});
          await p2.waitForTimeout(200);
          await p2.locator('button[data-recherche-loupe]').first().tap();
          await p2.waitForTimeout(800);
          const court = await p2.evaluate((n) => ({ ouvert: !!document.querySelector('[data-recherche-panneau]'), ecoute: window.__voix.vues.length > n }), n1);
          dit(court.ouvert && !court.ecoute, `${TT} un toucher court ouvre la loupe sans écouter`, JSON.stringify(court));
        });
        dit(!e2.length, `${TT} appui long : aucune erreur de page`, e2.join(' | ').slice(0, 300));
        await c2.close();
      }

      // ── Un champ de liste : Annonces ─────────────────────────────────────
      const { ctx: c3, pg: p3, errs: e3 } = await preparer(b, vp, { onglet: 'cat_annonces' });
      await essaie('champ Annonces', async () => {
        const sel = '[data-ann-recherche] [data-champ-recherche-micro]';
        await p3.waitForSelector(sel, { timeout: 10000 }).catch(() => {});
        dit(!!(await p3.$(sel)), `${TT} Annonces : le champ de recherche a son micro`);
        await p3.locator(sel).first().click();
        await p3.evaluate(() => window.__voix.dire([['numéro cent', false]]));
        await attendre(p3, () => document.querySelector('[data-ann-recherche] input').value === 'numéro cent', null, 3000);
        const v1 = await p3.$eval('[data-ann-recherche] input', (e) => e.value);
        dit(v1 === 'numéro cent', `${TT} Annonces : la transcription en direct s’écrit dans le champ`, JSON.stringify(v1));
        dit(await p3.evaluate(() => document.querySelector('[data-ann-recherche]').getAttribute('data-voix-ecoute') === '1'), `${TT} Annonces : le champ dit qu’il écoute`);
        await p3.evaluate(() => { window.__voix.dire([['numéro cent vingt-quatre', true]]); window.__voix.fin(); });
        await p3.waitForTimeout(200);
        const v2 = await p3.$eval('[data-ann-recherche] input', (e) => e.value);
        dit(v2 === '124', `${TT} Annonces : « numéro cent vingt-quatre » ⇒ « 124 »`, JSON.stringify(v2));
        await p3.screenshot({ path: path.join(SHOTS, `annonces-124-${suf}.png`) });
        await p3.locator(sel).first().click();
        await p3.evaluate(() => window.__voix.erreur('not-allowed'));
        const phr = await attendre(p3, () => { const e = document.querySelector('[data-ann-recherche] [data-voix-erreur="refus"]'); return e && /autorise/.test(e.innerText); });
        dit(phr && !(await p3.$(sel)), `${TT} Annonces : refusé ⇒ la phrase sous le champ, plus de micro`);
        await p3.screenshot({ path: path.join(SHOTS, `annonces-refus-${suf}.png`) });
      });
      dit(!e3.length, `${TT} Annonces : aucune erreur de page`, e3.join(' | ').slice(0, 300));
      await c3.close();

      // ── Sans reconnaissance : aucun micro ───────────────────────────────
      const { ctx: c4, pg: p4, errs: e4 } = await preparer(b, vp, { voix: false });
      await essaie('sans API', async () => {
        await ouvrirLoupe(p4, tel);
        const x = await p4.evaluate(() => ({ mic: document.querySelectorAll('[data-mic-dictee],[data-champ-recherche-micro]').length, aide: !!document.querySelector('[data-voix-aide]'), voix: (document.querySelector('button[data-recherche-loupe]') || { getAttribute: () => null }).getAttribute('data-recherche-loupe-voix') }));
        dit(x.mic === 0 && !x.aide, `${TT} sans reconnaissance (Firefox, certains Safari) : AUCUN micro, aucune promesse de voix`, JSON.stringify(x));
        if (tel) dit(x.voix === '0', `${TT} sans reconnaissance : l’appui long sur la loupe n’écoute pas`, String(x.voix));
        await p4.screenshot({ path: path.join(SHOTS, `sans-voix-${suf}.png`) });
      });
      dit(!e4.length, `${TT} sans API : aucune erreur de page`, e4.join(' | ').slice(0, 300));
      await c4.close();
    }
  } catch (e) { dit(false, 'le banc a pu tourner', String(e && e.message).slice(0, 300)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\nCaptures : ${SHOTS}`);
  console.log(ko ? `\n❌ parler à la loupe : ${ko} rouge(s).` : `\n✅ parler à la loupe : tout est vert`);
  process.exit(ko ? 1 : 0);
})();
