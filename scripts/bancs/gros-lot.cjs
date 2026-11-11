// ════════════════════════════════════════════════════════════════════════════
// BANC : LE MODE « GROS LOT » À L'ACHAT (lot gros-lot, 11 nov.)
//        node scripts/bancs/gros-lot.cjs   (après la construction ;
//        BANC_PORT, 7993 par défaut ; SHOTS=dossier pour garder les captures ;
//        BANC_DIST=dossier pour servir un autre build ; BANC_PASSES=390,1512…)
// ════════════════════════════════════════════════════════════════════════════
// Données INVENTÉES : un lot de 20 articles, 412,50 € + 17,30 € de port ; le
// pool sert déjà 1 à 7 et 44 (un trou 8-43 qui ne se comble jamais). Exigé,
// 390 tactile et 1512, clair et sombre :
//   L1. « Nouvel achat » ⇒ « Un article · Un lot » ; en lot, la tuile photo
//       unique et le N° unique disparaissent ; prix total, nombre, frais ;
//   L2. 20 lignes, les N° PROPOSÉS 45 à 64 (après le plus haut) ;
//   L3. parts égales : 20 × 21,49 € = 429,80 € au centime (somme rendue) ;
//   L4. prix visé : « Ajouter » éteint tant qu'un prix manque (l'article nommé) ;
//       tous tapés ⇒ chaque part à moins d'un centime de sa part exacte, somme juste ;
//   L5. à la main : 19 tapés + 1 vide ⇒ le reste dans la case vide ; une case
//       fausse ⇒ « il manque … », « Ajouter » éteint ;
//   L6. « Ajouter le lot » : UN achat (429,80 €, son lot de 20), 20 fiches
//       « À publier » reliées à SON lot, 20 coûts par N°, le pool 45 à 64 ; la
//       photo de l'article 1 dans SA ligne ;
//   L7. « Annuler » (la pilule, 5 s) : achat, fiches, coûts partis ; le pool
//       GARDE 45 à 64 (un N° servi ne se redonne jamais) ; la photo vidée ;
//   M.  « Je numérote moi-même » : N° tapés, « À la suite » ; un N° déjà servi
//       (N°7) ⇒ refusé, dit, RIEN écrit ;
//   + aucune erreur de page, aucun défilement horizontal.
// Mutation : BANC_MUTATION=1 attend le build d'une règle affaiblie (voir le récit).
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const sc = require('./_scenario-colis.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7993;
const SHOTS = process.env.SHOTS || '';
const U = sc.UID[0];
const N = 20, TOTAL = '412,50', FRAIS = '17,30', CIBLE = 42980;
const VISEES = Array.from({ length: N }, (_, i) => 20 + i * 3.5 + (i % 3) * 0.07);   // euros, inventés
const NUMEROS = { 93001: { numero: '7', title: 'Nike Air Force 1 blanc 42', price: 60 } };
const main = (sombre, moiMeme) => sc.ligneMain({ vinted_dark: sombre, vinted_annonce_numeros: NUMEROS, vinted_offvinted_buys: [], vinted_used_numeros: [1, 2, 3, 4, 5, 6, 7, 44], ...(moiMeme ? { vrm_numero_ecrit: { actif: true } } : {}) });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: false }); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
// Une clé de l'app lue dans le stockage local (là où ses écritures arrivent d'abord).
const cle = (pg, k) => pg.evaluate((k) => { try { const t = localStorage.getItem(k); return t == null ? null : JSON.parse(t); } catch (_) { return null; } }, k);
const attendre = async (fn, ms = 8000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 200)); } return v; };
const sansDebord = (pg) => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const lot = (pg) => pg.evaluate(() => {
  const t = document.querySelector('[data-lot-ok]');
  const parts = [...document.querySelectorAll('[data-lot-article]')].map((e) => e.getAttribute('data-lot-part'));
  const b = document.querySelector('[data-achat-hors-enregistrer]');
  return { n: document.querySelectorAll('[data-lot-article]').length, numeros: (document.querySelector('[data-lot-numeros]') || { getAttribute: () => '' }).getAttribute('data-lot-numeros'),
    ok: t ? t.getAttribute('data-lot-ok') : null, somme: t ? t.getAttribute('data-lot-somme') : null, cible: t ? t.getAttribute('data-lot-cible') : null, reste: t ? t.getAttribute('data-lot-reste') : null, resteSur: t ? t.getAttribute('data-lot-reste-sur') : null,
    parts: parts.map((p) => (p === '' ? null : Number(p))), pret: b ? b.getAttribute('data-lot-pret') : null, desactive: b ? b.disabled : null };
});
const taper = async (pg, sel, v) => { await pg.locator(sel).first().fill(v); };

async function passe(b, nom, ctxOpts, sombre, moiMeme) {
  console.log(`── ${nom}${moiMeme ? ' · je numérote moi-même' : ''}`);
  const ctx = await b.newContext({ ...ctxOpts });
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(!!sb)); } catch (_) {} }, sombre);
  await pg.route('**/images1.vinted.net/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecrits.push(String(req.postData() || '')); return j([], 201); }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc.comptes());
    if (/id=eq\.main/.test(u)) return j(main(sombre, moiMeme));
    if (/id=eq\.panel_num_reserves/.test(u)) return j([]);
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  const tactile = !!ctxOpts.hasTouch;

  await pg.goto(`http://localhost:${PORT}/?tab=achats&achat=1`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-achat-hors-form]').first().waitFor({ timeout: 30000 }).catch(() => {});
  const choix = pg.locator('[data-achat-mode="lot"]').first();
  await choix.waitFor({ timeout: 10000 }).catch(() => {});
  dit(await choix.count() > 0, `${nom} · L1 · « Un article · Un lot » en tête du formulaire`);
  if (!(await choix.count())) { await capture(pg, `gros-lot-${nom}-echec`); await ctx.close(); return; }
  await choix.evaluate((x) => x.click());
  await pg.locator('[data-gros-lot]').first().waitFor({ timeout: 5000 }).catch(() => {});
  const l1 = await pg.evaluate(() => ({ bloc: !!document.querySelector('[data-gros-lot]'), photo: !!document.querySelector('[data-achat-hors-photo]'), num: !!document.querySelector('[data-champ="numero"]') }));
  dit(l1.bloc && !l1.photo && !l1.num, `${nom} · L1 · en lot : plus de photo unique ni de N° unique`, JSON.stringify(l1));
  await taper(pg, '[data-champ="titre"]', 'Déstockage banc');
  await taper(pg, '[data-champ="prix"]', TOTAL);
  await taper(pg, '[data-lot-champ="frais"]', FRAIS);
  await taper(pg, '[data-lot-champ="n"]', String(N));
  await pg.waitForTimeout(400);
  let s = await lot(pg);
  const attendus = Array.from({ length: N }, (_, i) => (moiMeme ? '' : String(45 + i))).join(moiMeme ? '' : ',');
  dit(s.n === N, `${nom} · L2 · ${N} lignes d'articles`, String(s.n));
  if (!moiMeme) dit(s.numeros === attendus, `${nom} · L2 · N° proposés 45 à 64 (après le plus haut, jamais le trou)`, s.numeros);
  dit(s.ok === '1' && Number(s.somme) === CIBLE && Number(s.cible) === CIBLE && s.parts.every((p) => p === 2149), `${nom} · L3 · parts égales : 20 × 21,49 € = 429,80 € au centime`, JSON.stringify({ ok: s.ok, somme: s.somme, p: s.parts.slice(0, 3) }));
  await capture(pg, `gros-lot-${nom}-egal`);

  if (!moiMeme) {
    await pg.locator('[data-lot-mode-choix="revente"]').first().evaluate((x) => x.click());
    for (let i = 0; i < N - 1; i++) await taper(pg, `[data-lot-visee="${i + 1}"]`, String(VISEES[i]).replace('.', ','));
    s = await lot(pg);
    const nomme = await pg.evaluate(() => (document.querySelector('[data-lot-ok]') || {}).textContent || '');
    dit(s.ok === '0' && s.desactive === true && /20/.test(nomme), `${nom} · L4 · un prix visé manque ⇒ « Ajouter » éteint, l'article 20 nommé`, JSON.stringify({ ok: s.ok, d: s.desactive, t: nomme.slice(0, 80) }));
    await taper(pg, `[data-lot-visee="${N}"]`, String(VISEES[N - 1]).replace('.', ','));
    s = await lot(pg);
    const vc = VISEES.map((v) => Math.round(v * 100)); const sv = vc.reduce((a, x) => a + x, 0);
    const proches = s.parts.every((p, i) => p != null && Math.abs(p - (CIBLE * vc[i]) / sv) < 1);
    dit(s.ok === '1' && Number(s.somme) === CIBLE && s.parts.reduce((a, x) => a + x, 0) === CIBLE && proches, `${nom} · L4 · au prorata : chaque part à < 1 ct de l'exacte, somme 429,80 €`, JSON.stringify({ ok: s.ok, somme: s.somme, p: s.parts.slice(0, 4) }));
    dit(s.resteSur === '' ? Number(s.reste) === 0 : s.resteSur.split(',').length === Number(s.reste), `${nom} · L4 · le reste dit, un centime par article nommé`, JSON.stringify({ r: s.reste, sur: s.resteSur }));
    await capture(pg, `gros-lot-${nom}-revente`);

    await pg.locator('[data-lot-mode-choix="main"]').first().evaluate((x) => x.click());
    for (let i = 0; i < N - 1; i++) await taper(pg, `[data-lot-main="${i + 1}"]`, '20');
    s = await lot(pg);
    dit(s.ok === '1' && s.parts[N - 1] === CIBLE - 2000 * (N - 1) && s.resteSur === String(N), `${nom} · L5 · à la main : le reste (49,80 €) dans la case vide`, JSON.stringify({ ok: s.ok, last: s.parts[N - 1], sur: s.resteSur }));
    await taper(pg, `[data-lot-main="${N}"]`, '40');
    s = await lot(pg);
    dit(s.ok === '0' && s.desactive === true, `${nom} · L5 · une case fausse ⇒ « il manque 9,80 € », « Ajouter » éteint`, JSON.stringify({ ok: s.ok, d: s.desactive }));
    await capture(pg, `gros-lot-${nom}-main`);
    await pg.locator('[data-lot-mode-choix="egal"]').first().evaluate((x) => x.click());
  } else {
    // M. Je numérote moi-même : N° tapés ; N°7 déjà servi ⇒ refusé, rien écrit.
    await taper(pg, '[data-lot-num-tape="1"]', '45');
    await pg.locator('[data-lot-suite]').first().evaluate((x) => x.click()).catch(() => {});
    const tapes = await pg.evaluate(() => [...document.querySelectorAll('[data-lot-num-tape]')].map((e) => e.value).join(','));
    dit(tapes === Array.from({ length: N }, (_, i) => String(45 + i)).join(','), `${nom} · M1 · « À la suite » remplit 45 à 64`, tapes);
    await taper(pg, '[data-lot-num-tape="3"]', '7');
    const avant = ecrits.length;
    await pg.locator('[data-achat-hors-enregistrer]').first().evaluate((x) => x.click());
    const err = await attendre(() => pg.evaluate(() => (document.querySelector('[data-lot-num-erreur]') || { getAttribute: () => null }).getAttribute('data-lot-num-erreur')), 8000);
    const achats = await cle(pg, 'vinted_offvinted_buys');
    dit(err === 'pris' && !(Array.isArray(achats) && achats.some((x) => x && x.lot)), `${nom} · M2 · N°7 déjà servi ⇒ refusé, dit, aucun achat écrit`, JSON.stringify({ err, n: Array.isArray(achats) ? achats.length : null }));
    dit(!ecrits.slice(avant).some((w) => /achat_lot_photo_|vinted_offvinted_buys/.test(w)), `${nom} · M2 · rien n'est parti vers la base`);
    await capture(pg, `gros-lot-${nom}-moi-meme-refus`);
    await taper(pg, '[data-lot-num-tape="3"]', '47');
  }

  // L6. Une photo sur l'article 1, puis « Ajouter le lot ».
  await pg.locator('[data-lot-article="1"] input[type="file"]').first().setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG }).catch(() => {});
  await attendre(() => pg.evaluate(() => (document.querySelector('[data-lot-photo="1"]') || { getAttribute: () => '' }).getAttribute('data-lot-photo-pleine') === '1'), 5000);
  await taper(pg, '[data-lot-titre="1"]', 'Adidas Gazelle bleu');
  await taper(pg, '[data-lot-titre="2"]', 'Adidas Gazelle bleu');
  s = await lot(pg);
  dit(s.pret === '1' && s.desactive === false, `${nom} · L6 · « Ajouter le lot » allumé quand le total tombe juste`, JSON.stringify({ pret: s.pret, d: s.desactive }));
  await pg.locator('[data-achat-hors-enregistrer]').first().evaluate((x) => x.click());
  const achat = await attendre(async () => { const a = await cle(pg, 'vinted_offvinted_buys'); return Array.isArray(a) ? a.find((x) => x && x.lot) : null; }, 10000);
  dit(!!achat && achat.price === '429,80' && achat.lot.n === N && achat.lot.prix === 41250 && achat.lot.frais === 1730, `${nom} · L6 · UN achat : 429,80 €, son lot de 20`, JSON.stringify(achat && { p: achat.price, l: achat.lot && achat.lot.n }));
  const fiches = (await cle(pg, 'vrm_fiches_neuves')) || {};
  const dulot = Object.values(fiches).filter((f) => f && achat && f.achat === achat.id).sort((a, b) => a.rang - b.rang);
  dit(dulot.length === N && dulot.every((f, i) => f.numero === String(45 + i) && f.rang === i + 1) && dulot[0].titre === dulot[1].titre && dulot[0].numero !== dulot[1].numero, `${nom} · L6 · 20 fiches reliées à SON lot (id, rang), N°45 à 64 ; même titre, deux identités`, JSON.stringify(dulot.slice(0, 2).map((f) => [f.numero, f.rang, f.titre])));
  const couts = (await cle(pg, 'vinted_buyprice_by_num')) || {};
  const sc_ = Array.from({ length: N }, (_, i) => couts[String(45 + i)]);
  const cent = (t) => { const [a, b = '0'] = String(t || '').split(','); return Number(a) * 100 + Number(b.padEnd(2, '0')); };
  dit(sc_.every((x) => x != null) && sc_.reduce((a, x) => a + cent(x), 0) === CIBLE, `${nom} · L6 · 20 coûts par N°, somme 429,80 € (la compta lit le coût réparti)`, JSON.stringify(sc_.slice(0, 3)));
  const pool = (await cle(pg, 'vinted_used_numeros')) || [];
  const dansPool = () => Array.from({ length: N }, (_, i) => 45 + i).every((n) => pool.some((x) => String(x) === String(n)));
  dit(dansPool(), `${nom} · L6 · N°45 à 64 réservés au pool`, JSON.stringify(pool.slice(-3)));
  dit(ecrits.some((w) => /achat_lot_photo_/.test(w) && /data:image/.test(w)), `${nom} · L6 · la photo de l'article 1 dans SA ligne (jamais main)`);
  dit(!ecrits.some((w) => /"id":"main"/.test(w) && /data:image/.test(w)), `${nom} · L6 · aucune photo dans main`);
  await capture(pg, `gros-lot-${nom}-ajoute`);

  // L7. « Annuler » : tout part, sauf les N° du pool.
  const annuler = pg.locator('[data-pilule-annuler]').first();
  await annuler.waitFor({ timeout: 4000 }).catch(() => {});
  dit(await annuler.count() > 0, `${nom} · L7 · la pilule « Annuler » est là`);
  if (await annuler.count()) {
    await annuler.evaluate((x) => x.click());
    const parti = await attendre(async () => { const a = await cle(pg, 'vinted_offvinted_buys'); return Array.isArray(a) && !a.some((x) => x && x.lot) ? 1 : 0; }, 8000);
    const f2 = (await cle(pg, 'vrm_fiches_neuves')) || {};
    const c2 = (await cle(pg, 'vinted_buyprice_by_num')) || {};
    const p2 = (await cle(pg, 'vinted_used_numeros')) || [];
    dit(!!parti && !Object.values(f2).some((f) => f && f.achat === achat.id) && c2['45'] == null, `${nom} · L7 · « Annuler » : achat, fiches et coûts retirés`, JSON.stringify({ parti, f: Object.keys(f2).length, c: c2['45'] }));
    dit(Array.from({ length: N }, (_, i) => 45 + i).every((n) => p2.some((x) => String(x) === String(n))), `${nom} · L7 · le pool GARDE 45 à 64 (jamais redonnés)`);
    const vide = await attendre(() => ecrits.some((w) => /achat_lot_photo_/.test(w) && /"supprime":true/.test(w)), 5000);
    dit(!!vide, `${nom} · L7 · la photo de l'article est vidée`);
  }
  if (tactile) { const h = await pg.evaluate(() => Math.min(...[...document.querySelectorAll('[data-lot-photo], [data-lot-mode-choix], [data-achat-mode]')].map((e) => e.getBoundingClientRect().height).filter((x) => x > 0))); dit(!isFinite(h) || h >= 43.5, `${nom} · cibles ≥ 44 px`, String(h)); }
  dit(await sansDebord(pg), `${nom} · aucun défilement horizontal`);
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

(async () => {
  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    const seul = (process.env.BANC_PASSES || '').split(',').filter(Boolean);
    const T = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'fr-FR' }, D = { viewport: { width: 1512, height: 950 }, locale: 'fr-FR' };
    const passes = [['390', T, false, false], ['390-sombre', { ...T, colorScheme: 'dark' }, true, false], ['1512', D, false, false], ['1512-sombre', { ...D, colorScheme: 'dark' }, true, false], ['390-moi', T, false, true], ['1512-moi', D, false, true]];
    for (const [n, o, s, m] of passes) if (!seul.length || seul.includes(n)) await passe(b, n, o, s, m);
  } catch (e) { ko++; console.log('❌ le banc a levé — ' + (e && e.message)); }
  await b.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge' : '✅ Gros lot : une saisie, répartition au centime, N° consécutifs, annulable'} (${ok} verts)`);
  process.exit(ko ? 1 : 0);
})();
