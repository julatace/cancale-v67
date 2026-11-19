// ════════════════════════════════════════════════════════════════════════════
// BANC : « RELIER ACHATS ET VENTES » AU DOIGT, SUR IPHONE (17 nov., lot relier-tout-achat)
//        node scripts/bancs/relier-glisser-iphone.cjs                (Chromium, vrais évènements tactiles CDP)
//        NAVIGATEUR=webkit node scripts/bancs/relier-glisser-iphone.cjs   (WebKit : le moteur de Safari)
// ════════════════════════════════════════════════════════════════════════════
// Julien (capture iPhone) : « Ici ça bug de ouf quand je swipe ». Ce qu'on voyait : deux petites boîtes qui défilent
// chacune (« Tes achats libres 2002 », « Sans achat relié 1362 ») coupées au milieu d'une ligne, un grand vide en bas,
// des titres coupés « … », et le glisser qui se disputait le doigt avec le défilement.
// Jugé à 390 tactile, 200 achats et 150 annonces INVENTÉS (dépôt public), titres longs :
//   A  UN SEUL conteneur qui défile dans la feuille (aucune liste qui défile dans la page) ;
//   B  aucune bande vide : la feuille va jusqu'en bas, une ligne sous le doigt au bas de l'écran ;
//   C  titres jamais coupés (« adidas handball spezial bleu taille 40 » en entier) ;
//   D  un doigt qui file (achats, puis « Sans achat relié ») : ça DÉFILE, rien ne se soulève, aucune question, aucun lien ;
//   E  appui long (650 ms) puis glisser sur une annonce ⇒ la question ⇒ « Oui » ⇒ relié ;
//   F  toucher un achat puis une annonce ⇒ la question ⇒ « Oui » ⇒ relié ;
//   G  tirer vers le bas depuis la poignée ferme ; tirer vers le bas sur une liste ne ferme pas.
// Chromium : `Input.dispatchTouchEvent` (touch + pointer, défilement natif). WebKit (pas de CDP, ni molette ni toucher natif
// en mobile) : défilement demandé à la feuille (`scrollBy`), gestes par évènements de pointeur de type « touch ». `BANC_DIST=` le build ; `SHOTS=` les captures.
// Un banc ne meurt pas, il rapporte.
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const pw = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { lancer, NAVIGATEUR } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const sc = require('./_scenario-colis.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (21000 + Math.floor(Math.random() * 18000));
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-relier-glisser-iphone');
fs.mkdirSync(SHOTS, { recursive: true });
const J = 86400e3, U = sc.UID[0];
const MOD = ['adidas handball spezial bleu', 'adidas handball spezial noir', 'New balance 9060 vert et blanc', 'salomon XT-6 blanc', 'Nike Air Force 1 blanche', 'Asics Gel Kayano 14 argent'];
const NA = 150, NACH = 200;
const annonces = Array.from({ length: NA }, (_, i) => ({ ...sc.annonce({ id: 'pa' + i, titre: `${MOD[i % MOD.length]} taille ${38 + (i % 6)}`, prix: 50 + (i % 30), taille: 38 + (i % 6), marque: MOD[i % MOD.length].split(' ')[0] }), created_at_ts: Math.floor((sc.NOW - (5 + i) * J) / 1000) }));
const fiches = Object.fromEntries(annonces.map((a, i) => ['pa' + i, { numero: String(200 + i), title: a.title, price: 50 + (i % 30) }]));
const ACHATS = Array.from({ length: NACH }, (_, i) => sc.ordre({ tx: String(7500000 + i), conv: 'c' + i, titre: i % 3 ? `Adidas handball special burgundy et gomme taille ${36 + (i % 8)}` : 'Scarpe timberland Donna 37',
  prix: 11 + (i % 40), statut: sc.STATUT_FINAL, dateMs: sc.NOW - (40 + i) * J }));
const T1 = '7500000';
const rows = [{ ...sc.ligneListings(U, annonces), data: { capturedAt: new Date(sc.NOW - 60e3).toISOString(), payload: { items: annonces, pagination: null } } }, sc.lignePurch(U, ACHATS), sc.ligneSold(U, [])];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const W = NAVIGATEUR === 'webkit';

async function ouvrir(b) {
  const ctx = await b.newContext({ locale: 'fr-FR', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc.comptes());
    if (/id=eq\.main/.test(u)) return j(sc.ligneMain({ vinted_annonce_numeros: fiches }));
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) return j(rows.filter((r) => r.id === eq[1]));
    const m = /id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + m[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=achats&site=vinted`, { waitUntil: 'domcontentloaded' });
  const bouton = pg.locator('[data-glisser-ouvrir="achats"]').first();
  await bouton.waitFor({ timeout: 30000 }).catch(() => {});
  if (!(await bouton.count())) { await pg.screenshot({ path: path.join(SHOTS, 'iphone-ko.png'), fullPage: true }); return { ctx, pg, errs, ko: true }; }
  await bouton.click();
  await pg.locator(`[data-glisser-achat="${T1}"]`).waitFor({ timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(500);
  return { ctx, pg, errs };
}
const liens = (pg) => pg.evaluate(() => { try { const f = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); return Object.entries(f).filter(([, v]) => v && v.buyFromId).map(([k, v]) => `${k}:${v.buyFromId}`); } catch (_) { return null; } });
const centre = async (pg, sel) => { const bb = await pg.locator(sel).first().boundingBox(); return bb ? { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 } : null; };
// Les conteneurs qui DÉFILENT dans la feuille (overflow auto/scroll et contenu plus haut que la boîte).
const DEFILANTS = () => [...document.querySelectorAll('[data-relier-glisser] *')].filter((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1; }).map((e) => (e.getAttribute('data-glisser-defile') != null ? 'feuille' : (e.className || e.tagName) + ''));
// La position de défilement de ce qui défile (la feuille, sinon la liste visible).
const POS = () => { const f = document.querySelector('[data-glisser-defile]'); const l = [...document.querySelectorAll('[data-relier-glisser] .vrm-rg-liste')].map((x) => x.scrollTop); return (f ? f.scrollTop : 0) + l.reduce((a, b) => a + b, 0); };

(async () => {
  const b = await lancer(pw, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const nom = `390-${W ? 'webkit' : 'chromium'}`;
  console.log(`\n── ${nom}`);
  const o = await ouvrir(b);
  dit(!o.ko, `${nom} · Achats : « Relier achats et ventes » s'ouvre`);
  if (o.ko) { await b.close(); srv.close(); console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`); process.exit(1); }
  const { pg, ctx, errs } = o;
  const cdp = W ? null : await ctx.newCDPSession(pg);
  const pause = (ms) => pg.waitForTimeout(ms);
  // Le doigt : CDP (Chromium) ; sinon des évènements de pointeur « touch » (WebKit, pas de défilement natif).
  const doigt = async (type, x, y) => {
    if (cdp) return cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y), id: 1 }] });
    const t = { touchStart: 'pointerdown', touchMove: 'pointermove', touchEnd: 'pointerup' }[type];
    return pg.evaluate(([t, x, y]) => { window.__vrmDoigt = window.__vrmDoigt || { x: 0, y: 0 }; if (t !== 'pointerup') window.__vrmDoigt = { x, y }; const p = window.__vrmDoigt;
      const cible = document.elementFromPoint(p.x, p.y) || document.body; const e = new PointerEvent(t, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: p.x, clientY: p.y, button: 0, buttons: t === 'pointerup' ? 0 : 1 });
      (window.__vrmCible && t !== 'pointerdown' ? window.__vrmCible : cible).dispatchEvent(e); if (t === 'pointerdown') window.__vrmCible = cible; if (t === 'pointerup') { window.__vrmCible = null; } }, [t, x, y]);
  };
  const tap = async (sel) => { const c = await centre(pg, sel); if (!c) return false; await pg.touchscreen.tap(c.x, c.y); return true; };
  await pg.screenshot({ path: path.join(SHOTS, `iphone-${nom}-ouvert.png`) });

  // A · un seul défilement
  const D = await pg.evaluate(DEFILANTS);
  dit(D.length === 1 && D[0] === 'feuille', `${nom} · A un SEUL conteneur défile : la feuille (aucune liste qui défile dans la page)`, JSON.stringify(D));
  // B · aucune bande vide
  const B = await pg.evaluate(() => { const f = document.querySelector('[data-glisser-defile]') || document.querySelector('.vrm-rg-corps'); const r = f.getBoundingClientRect();
    // (19 nov.) Le doigt couvre ~40 px : une ligne sous l'un de ces points suffit (le point fixe tombait dans l'espace de 8 px entre deux cartes quand la recherche a décalé la liste — pas une « bande vide »).
    const ligne = [24, 32, 40, 48, 56].some((d) => { const sous = document.elementFromPoint(195, window.innerHeight - d); return !!(sous && sous.closest && sous.closest('[data-glisser-achat], [data-glisser-cible]')); });
    return { bas: Math.round(r.bottom), vh: window.innerHeight, ligne: !!ligne }; });
  dit(B.bas >= B.vh - 2 && B.ligne, `${nom} · B aucune bande vide : la feuille va jusqu'en bas, une ligne sous le doigt en bas de l'écran`, JSON.stringify(B));
  // C · titres entiers
  const C = await pg.evaluate(() => [...document.querySelectorAll('[data-relier-glisser] .vrm-rg-titre, [data-relier-glisser] .vrm-rg-sous')].filter((e) => { const r = e.getBoundingClientRect(); if (!r.width) return false; const cs = getComputedStyle(e); return cs.textOverflow === 'ellipsis' || e.scrollWidth > e.clientWidth + 1; }).map((e) => e.textContent.slice(0, 40)));
  dit(!C.length, `${nom} · C aucun titre coupé « … »`, C.slice(0, 3).join(' | '));

  // D · un doigt qui file : ça défile, rien ne se soulève
  const essaiDefile = async (quoi) => {
    const a = await centre(pg, quoi === 'achats' ? `[data-glisser-achat]` : '[data-glisser-cible]');
    const p0 = await pg.evaluate(POS); let leve = false;
    if (cdp) {
      await doigt('touchStart', a.x, a.y + 120);
      for (let i = 1; i <= 8; i++) { await doigt('touchMove', a.x, a.y + 120 - i * 40); await pause(16); if (await pg.locator('[data-glisser-flotte]').count()) leve = true; }
      await doigt('touchEnd'); await pause(600);
    } else {
      await doigt('touchStart', a.x, a.y + 120);
      for (let i = 1; i <= 8; i++) { await doigt('touchMove', a.x, a.y + 120 - i * 40); await pause(16); if (await pg.locator('[data-glisser-flotte]').count()) leve = true; }
      // WebKit mobile n'a ni molette ni toucher natif dans Playwright : le défilement est demandé à la feuille elle-même
      // (`scrollBy`) — on vérifie qu'ELLE défile (et pas une liste dedans), après un doigt synthétique qui n'a rien soulevé.
      await doigt('touchEnd'); await pg.evaluate(() => { const f = document.querySelector('[data-glisser-defile]'); if (f && getComputedStyle(f).overflowY !== 'visible') f.scrollBy(0, 400); }); await pause(600);
    }
    const p1 = await pg.evaluate(POS);
    dit(!leve && !(await pg.locator('[data-glisser-flotte]').count()), `${nom} · D ${quoi} : un doigt qui file ne soulève rien`);
    dit(p1 > p0 + 40, `${nom} · D ${quoi} : …et ça DÉFILE`, `${p0} → ${p1}`);
    dit(!(await pg.locator('[data-glisser-question]').count()) && JSON.stringify(await liens(pg)) === '[]', `${nom} · D ${quoi} : aucune question, aucun lien`);
  };
  await essaiDefile('achats');
  await pg.evaluate(() => { const f = document.querySelector('[data-glisser-defile]'); if (f) f.scrollTop = 0; });
  if (await pg.locator('[data-glisser-onglet="cibles"]').count()) await tap('[data-glisser-onglet="cibles"]'); await pause(300);
  await essaiDefile('sans achat relié');
  await pg.screenshot({ path: path.join(SHOTS, `iphone-${nom}-defile.png`) });
  if (await pg.locator('[data-glisser-onglet="achats"]').count()) await tap('[data-glisser-onglet="achats"]'); await pause(300);
  await pg.evaluate(() => { const f = document.querySelector('[data-glisser-defile]'); if (f) f.scrollTop = 0; });

  // G · tirer vers le bas sur une liste ne ferme pas (le doigt défile vers le haut de la liste)
  {
    const a = await centre(pg, `[data-glisser-achat="${T1}"]`);
    await doigt('touchStart', a.x, a.y); for (let i = 1; i <= 6; i++) { await doigt('touchMove', a.x, a.y + i * 30); await pause(16); } await doigt('touchEnd'); await pause(500);
    dit(await pg.locator('[data-relier-glisser]').count() === 1 && !(await pg.locator('[data-glisser-flotte]').count()), `${nom} · G tirer vers le bas sur la liste ne ferme pas la feuille`);
  }

  // E · appui long + glisser ⇒ la question ⇒ Oui ⇒ relié
  {
    const a = await centre(pg, `[data-glisser-achat="${T1}"]`);
    await doigt('touchStart', a.x, a.y); await pause(650);
    const leve = await pg.locator(`[data-glisser-flotte="${T1}"]`).count();
    dit(leve === 1, `${nom} · E appui long (650 ms) : l'achat se soulève`);
    await pause(250);
    const k = await pg.evaluate(() => { const c = [...document.querySelectorAll('[data-glisser-cible^="a:"]')].find((e) => { const r = e.getBoundingClientRect(); return r.top > 160 && r.bottom < window.innerHeight - 40 && r.width > 0; }); return c ? c.getAttribute('data-glisser-cible') : ''; });
    const c = k ? await centre(pg, `[data-glisser-cible="${k}"]`) : null;
    dit(!!c, `${nom} · E l'achat soulevé : les annonces sont sous le doigt`, k);
    if (c) { for (let i = 1; i <= 10; i++) { await doigt('touchMove', a.x + (c.x - a.x) * i / 10, a.y + (c.y - a.y) * i / 10); await pause(20); } await pause(150); }
    await pg.screenshot({ path: path.join(SHOTS, `iphone-${nom}-glisse.png`) });
    await doigt('touchEnd'); await pause(400);
    const q = await pg.locator('[data-glisser-question]').getAttribute('data-glisser-question').catch(() => null);
    dit(!!k && q === `${T1}>${k}`, `${nom} · E lâché sur l'annonce : la question porte CET achat et CETTE annonce`, String(q));
    dit(JSON.stringify(await liens(pg)) === '[]', `${nom} · E rien n'est écrit avant « Oui »`);
    if (await pg.locator('[data-glisser-oui]').count()) await tap('[data-glisser-oui]'); await pause(900);
    const L = await liens(pg);
    dit(!!k && (L || []).includes(`${k.slice(2)}:${T1}`), `${nom} · E « Oui » : relié (par le glisser)`, JSON.stringify(L));
  }
  // F · toucher + toucher ⇒ la question ⇒ Oui ⇒ relié
  {
    await pause(6500);   // la pilule « Achat relié » s'en va
    const T2 = await pg.evaluate(() => { const e = document.querySelector('[data-glisser-achat]'); return e ? e.getAttribute('data-glisser-achat') : ''; });
    await tap(`[data-glisser-achat="${T2}"]`); await pause(400);
    const k = await pg.evaluate(() => { const c = [...document.querySelectorAll('[data-glisser-cible^="a:"]')].find((e) => { const r = e.getBoundingClientRect(); return r.top > 160 && r.bottom < window.innerHeight - 40 && r.width > 0; }); return c ? c.getAttribute('data-glisser-cible') : ''; });
    if (k) await tap(`[data-glisser-cible="${k}"]`); await pause(400);
    const q = await pg.locator('[data-glisser-question]').getAttribute('data-glisser-question').catch(() => null);
    dit(!!k && q === `${T2}>${k}`, `${nom} · F toucher l'achat puis l'annonce : la question`, `${q} / ${T2}>${k}`);
    if (await pg.locator('[data-glisser-oui]').count()) await tap('[data-glisser-oui]'); await pause(900);
    const L = await liens(pg);
    dit(!!k && (L || []).includes(`${k.slice(2)}:${T2}`), `${nom} · F « Oui » : relié (en deux touchers)`, JSON.stringify(L));
  }
  // G · tirer vers le bas depuis la poignée ferme
  {
    await pause(6500);
    const p = await centre(pg, '[data-glisser-poignee]') || await centre(pg, '.vrm-rg-tete');
    if (p) { await doigt('touchStart', p.x, p.y + 4); for (let i = 1; i <= 6; i++) { await doigt('touchMove', p.x, p.y + 4 + i * 30); await pause(16); } await doigt('touchEnd'); await pause(500); }
    dit(!(await pg.locator('[data-relier-glisser]').count()), `${nom} · G tirer vers le bas depuis la poignée ferme la feuille`);
  }
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
  await b.close(); srv.close();
  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
