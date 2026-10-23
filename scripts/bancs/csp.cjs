require('./_porte-banc.cjs');   // l'« accès direct » est retiré de l'app (22 oct.) : session de banc
// ════════════════════════════════════════════════════════════════════════════
//  CSP — la politique de sécurité du contenu de vercel.json, servie POUR DE VRAI
//  (21 octobre). Un banc qui sert dist/ sans les en-têtes de Vercel ne voit
//  rien de ce que la production envoie : c'est pour ça que la CSP n'avait
//  jamais été posée (CLAUDE.md, « la facture exécutait… — Pas fait »).
//
//  Le serveur (`_vercel.cjs`) LIT vercel.json (headers + rewrites). Base
//  inventée (`_base-volume.cjs`, aucune donnée réelle, il vit dans le dépôt).
//  On rend, à 390 px (doigt) et 1512 px :
//    · chaque écran joignable (la liste de verif_visuel) ;
//    · la page d'accueil, la connexion, le film, les pages légales ;
//    · la fenêtre du REÇU d'achat (ses deux boutons, cliqués) — elle hérite de
//      la CSP de l'app, ses `onclick` en ligne étaient refusés ;
//    · une FACTURE imprimable (`ouvrirDocumentImprimable`) ;
//    · un bordereau PDF ouvert dans un onglet (blob:, sous `object-src 'none'`).
//  Et on exige ZÉRO violation (évènement `securitypolicyviolation` + console),
//  pour la politique en vigueur ET pour la Report-Only.
//  Contrôle positif : un `onerror` glissé dans la page DOIT être signalé —
//  sinon l'observation serait aveugle et le banc vert par accident.
//
//  ⚠️ (22 oct.) Les violations d'un WORKER et du SERVICE WORKER n'arrivent ni à
//  l'évènement de la page ni à sa console (mesuré dans Chromium) : le banc pose
//  `report-uri` sur la CSP qu'il sert (`_vercel.cjs`) et compte les RAPPORTS.
//  C'est ce qui voit les tuiles de la carte (MapLibre les charge depuis son
//  worker) et le QR de Ma journée hors ligne (le service worker). Deux contrôles
//  positifs de plus : un worker qui contacte une adresse interdite DOIT être
//  signalé, et la carte DOIT avoir demandé ses tuiles (sinon « zéro violation »
//  sur la carte ne prouverait rien).
//  Sont rendus aussi (22 oct.) : la carte de la Communauté avec son fond
//  OpenFreeMap (style, tuiles, sprites, polices — servis par le banc), la page
//  de nouveau mot de passe (/recuperation.html, qui appelle la base), et la
//  mise en réserve d'un QR hors ligne par le service worker.
//
//  (22 oct., revue du chantier) Ajoutés, chacun rouge sur cab152a :
//    · le reçu, ses deux boutons cliqués APRÈS un rechargement de l'onglet qui
//      l'a ouvert (l'app se recharge toute seule) — dans un contexte SANS route
//      (l'interception de Playwright suspend le script de la fenêtre) ;
//    · une violation DANS la fenêtre du reçu et dans la facture arrive au
//      journal des plantages (`vrm_plantages_attente`, écran « fenetre:… »), et
//      une violation de la page y est nommée par son écran (history.state) ;
//    · un colis Vinted Go à retirer, son QR en http (la forme de sa base) : il
//      est demandé en https, sans violation, et entre dans la réserve ;
//    · une NAVIGATION vers /hl-qr ne fait rien demander ni ranger, et la réserve
//      reste sous sa borne (QR_MAX de public/sw.js).
//  Lancer : npm run build && node scripts/bancs/csp.cjs
//    BANC_PORT=…                     (défaut 4993)
//    BANC_CSP_EN_VIGUEUR=1           la Report-Only servie EN VIGUEUR (ce que
//                                    donnerait la bascule) : écrans rendus, 0 violation
//    BANC_CSP_MUTATION=supabase|jsdelivr|vinted|openfreemap|tous
//                                    retire un hôte nécessaire ⇒ le banc DOIT rougir
//    BANC_CSP_MUTATION=swpolitique     remet le service worker SOUS la politique de
//                                    la page ⇒ la réserve des QR DOIT rougir
//    BANC_CSP_SANS_RAPPORTS=1          (`_vercel.cjs`) aucun rapport ⇒ les contrôles
//                                    positifs worker DOIVENT rougir
//    ECRANS=journee,cat_ventes       ne rendre que ces écrans
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const V = require('./_vercel.cjs');
const { fabriquer, repondre } = require('./_base-volume.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const RACINE = path.join(__dirname, '..', '..');
const PORT = Number(process.env.BANC_PORT || 4993);
const ORIGINE = `http://localhost:${PORT}`;
const EXE = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));

// ── Mutations / bascule ─────────────────────────────────────────────────────
const MUT = process.env.BANC_CSP_MUTATION || '';
const VIGUEUR = !!process.env.BANC_CSP_EN_VIGUEUR;
if (VIGUEUR || MUT) {
  V.vercelMute((cfg) => {
    // La politique complète vit dans SA règle (22 oct. : `/((?!sw\.js).*)`, le
    // service worker n'est pas sous elle) — on la cherche par sa clé.
    const regle = cfg.headers.find((x) => (x.headers || []).some((e) => e.key === 'Content-Security-Policy-Report-Only'));
    const h = regle.headers;
    const ro = h.find((e) => e.key === 'Content-Security-Policy-Report-Only');
    if (MUT === 'swpolitique') regle.source = '/(.*)';
    else if (MUT) {
      const retirer = { supabase: /\s(https|wss):\/\/lgonxzrzjcqthjtbdpzo\.supabase\.co/g, jsdelivr: /\shttps:\/\/cdn\.jsdelivr\.net/g, vinted: /\shttps:\/\/\*\.vinted\.net/g, openfreemap: /\shttps:\/\/tiles\.openfreemap\.org/g, tous: /\s(https|wss):\/\/[^\s;]+/g }[MUT];
      if (!retirer) { console.log('mutation inconnue : ' + MUT); process.exit(2); }
      ro.value = ro.value.split(';').map((d) => (/^\s*connect-src/.test(d) ? d.replace(retirer, '') : d)).join(';');
    }
    // La bascule, telle qu'elle se fera : la clé Report-Only de cette règle
    // devient `Content-Security-Policy` (elle passe après la règle générale :
    // c'est elle qui est servie ; elle porte aussi les directives structurelles).
    if (VIGUEUR) ro.key = 'Content-Security-Policy';
  });
}

const cfg = V.lireConfig();
const entetes = V.entetesPour('/', { brut: true });
const ro = entetes['Content-Security-Policy-Report-Only'] || '';
const en = entetes['Content-Security-Policy'] || '';
const SUPABASE_URL = (/const SUPABASE_URL = "([^"]+)"/.exec(fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8')) || [])[1] || '';
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

const TABS = (process.env.ECRANS ? process.env.ECRANS.split(',') : ['journee', 'plat_vinted', 'plat_leboncoin', 'plat_ebay', 'plat_vestiaire', 'prixmarche', 'dashboard', 'compta', 'cat_annonces', 'cat_ventes', 'cat_achats', 'cat_bord', 'cat_msg', 'garage', 'organisation', 'communaute', 'invoices', 'masques', 'settings', 'vintedaccounts', 'catalog', 'sales', 'leboncoin', 'stockvinted']);

// Extrait une déclaration d'App.jsx telle quelle (le VRAI code, jamais recopié).
const SRC = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
const extrait = (debut, fin = '\n};\n') => { const i = SRC.indexOf(debut); if (i < 0) return null; const j = SRC.indexOf(fin, i); return SRC.slice(i, j + fin.length); };

// Le fond OpenFreeMap servi par le banc : un style minimal mais de la MÊME FORME
// que les vrais `liberty`/`dark` (relus le 22 oct. dans hyperknot/openfreemap-styles :
// une source vectorielle par TileJSON `…/planet`, un fond raster
// `…/natural_earth/ne2sr/{z}/{x}/{y}.png`, un sprite, des polices — tout sur
// tiles.openfreemap.org). MapLibre va les chercher depuis la page ET son worker.
const OFM = { vus: [] };
const TILEJSON = JSON.stringify({ tilejson: '3.0.0', tiles: ['https://tiles.openfreemap.org/planet/banc/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14 });
const styleOfm = (nom) => JSON.stringify({ version: 8, name: nom,
  sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: { ne2_shaded: { type: 'raster', tileSize: 256, maxzoom: 6, tiles: ['https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png'] },
    openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': nom === 'dark' ? '#0e0e0e' : '#f8f4f0' } },
    { id: 'relief', type: 'raster', source: 'ne2_shaded', paint: { 'raster-opacity': 0.3 } },
    { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': '#9ec8ff' } },
    { id: 'place', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', layout: { 'text-field': '{name}', 'text-font': ['Noto Sans Regular'], 'icon-image': 'town' } }] });
// Un PNG RGBA 2×2 valide, et l'index de sprite qui le décrit : un sprite que
// MapLibre ne sait pas lire déclenche son évènement « error », et la carte
// passe en liste (mesuré : avec '{}' et un PNG gris, plus aucune tuile demandée).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAE0lEQVR4nGP4z8DwHwwZGP5DAABUvgr2vQeGRgAAAABJRU5ErkJggg==', 'base64');
const SPRITE = JSON.stringify({ town: { width: 2, height: 2, x: 0, y: 0, pixelRatio: 1 } });
const QR = { servis: 0 };
const VG = { http: 0, https: 0 };
const TIERS = { n: 0 };
const QR_VG = 'http://p.vintedgo.com/public/v1/qr_codes/BANC0000000000:C49341:BANC0000000000?v=1';
// Le journal des plantages (src/plantages.js) tel que l'app l'écrit : les
// entrées d'origine « csp » en attente d'envoi.
const journalCsp = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_plantages_attente') || '[]').filter((e) => e.origine === 'csp').map((e) => ({ message: e.message, ecran: e.ecran })); } catch (_) { return null; } }).catch(() => null);
// Le VRAI src/plantages.js, rendu évaluable dans une page (sans ses `export`).
const PLANTAGES = fs.readFileSync(path.join(RACINE, 'src', 'plantages.js'), 'utf8').replace(/^export /gm, '');

async function contexte(b, vp, acces = true, { sw = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}), serviceWorkers: sw ? 'allow' : 'block' });
  const vues = V.observer(ctx);
  if (acces) await ctx.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  // Rien d'extérieur n'est réellement servi (déterminisme) : la CSP est jugée
  // AVANT le réseau — une adresse refusée l'est avant d'atteindre cette route.
  await ctx.route(/^https?:\/\/(?!localhost)/i, (r) => r.abort());
  // Sauf le fond de carte OpenFreeMap (style, tuiles, sprites, polices) et les QR
  // des transporteurs : servis par le banc, pour que la carte et le service
  // worker FASSENT leurs requêtes (une requête jamais faite ne viole rien).
  await ctx.route(/^https:\/\/tiles\.openfreemap\.org\//, (r) => {
    const u = r.request().url();
    OFM.vus.push(u.replace(/^https:\/\/[^/]+/, '').split('?')[0]);
    const m = u.match(/\/styles\/([a-z]+)/);
    if (m) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: styleOfm(m[1]) });
    if (/\/planet$/.test(u.split('?')[0])) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: TILEJSON });
    if (/\.json$/.test(u.split('?')[0])) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: SPRITE });
    if (/\.png$/.test(u.split('?')[0])) return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG });
    return r.fulfill({ status: 200, contentType: 'application/x-protobuf', headers: { 'access-control-allow-origin': '*' }, body: Buffer.alloc(0) });
  });
  await ctx.route(/^https:\/\/qr\.exemple\.test\//, (r) => { QR.servis++; return r.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
  // (22 oct., revue) Les QR Vinted Go arrivent en http (15 sur 15 dans sa base) :
  // servis ici dans les deux schémas, et COMPTÉS par schéma (la page du banc est
  // en http, il n'y a pas de montée automatique en https comme sur vrm.center).
  await ctx.route(/^https?:\/\/p\.vintedgo\.com\//, (r) => { const u = r.request().url(); VG[u.startsWith('https:') ? 'https' : 'http']++; return r.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
  // Un site tiers (la navigation vers /hl-qr ne doit jamais aller le chercher).
  await ctx.route(/^https:\/\/autre-site\.exemple\.test\//, (r) => { TIERS.n++; return r.fulfill({ status: 200, contentType: 'text/html', body: '<b>tiers ' + 'x'.repeat(4000) + '</b>' }); });
  const base = fabriquer();
  // Un colis Vinted Go à retirer, son QR en http — la forme réelle de sa base.
  base.rows.push({ id: 'email_track_vinted_VGSBANC000001', data: { status: 'available', statusLabel: 'Arrivé au point de retrait', code: 'C49341', lieu: 'Consigne Vinted Go Laverie du Port', carrier: 'vinted', suivi: 'VGSBANC000001', artTitle: '', qrUrl: QR_VG, receivedAt: new Date(Date.now() - 3600e3).toISOString() } });
  await ctx.route('**/rest/v1/**', async (route) => {
    const rq = route.request();
    if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const h = await rq.allHeaders();
    const rep = repondre(rq.url(), h.range, base);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body: JSON.stringify(rep.body) });
  });
  await ctx.route(`${ORIGINE}/api/**`, (r) => {
    const u = new URL(r.request().url()), mode = u.searchParams.get('mode');
    // La Communauté ne dessine sa carte que sur une lecture réussie (une carte vide).
    if (u.pathname === '/api/compte' && mode === 'communaute' && r.request().method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, carte: { profils: [], groupes: [], moi: null }, conversations: [], discordConnexion: true }) });
    // La page de nouveau mot de passe lit l'adresse de la base ici, puis l'appelle.
    if (u.pathname === '/api/compte' && mode === 'configuration-auth') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, url: SUPABASE_URL, cle: 'cle-publique-de-banc' }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' });
  });
  return { ctx, vues };
}

const calme = async (pg, ms = 3200) => { await pg.waitForTimeout(ms); };
const nouvelles = (vues, depuis) => vues.slice(depuis);

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ dist/ absent — npm run build'); process.exit(2); }
  const srv = V.servir(DIST, PORT);
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  console.log(`\n── la politique servie (lue dans ${process.env.BANC_VERCEL_JSON ? 'une copie' : 'vercel.json'}${VIGUEUR ? ', Report-Only servie EN VIGUEUR' : ''}${MUT ? ', MUTATION ' + MUT : ''})`);
  const r0 = await fetch(ORIGINE + '/?tab=journee');
  dit(!!r0.headers.get('content-security-policy'), 'la page porte une Content-Security-Policy EN VIGUEUR', r0.headers.get('content-security-policy') || 'absente');
  dit(VIGUEUR || !!r0.headers.get('content-security-policy-report-only'), 'et la politique complète en Report-Only', (r0.headers.get('content-security-policy-report-only') || '').slice(0, 90));
  const complete = VIGUEUR ? en : ro;
  dit(/frame-ancestors 'none'/.test(en) && /base-uri 'self'/.test(en) && /object-src 'none'/.test(en) && /form-action 'self'/.test(en), "en vigueur : frame-ancestors 'none', base-uri, object-src 'none', form-action");
  const scriptSrc = (/(?:^|;)\s*script-src([^;]*)/.exec(complete) || [])[1] || '';
  dit(!!scriptSrc && !/'unsafe-inline'|'unsafe-eval'/.test(scriptSrc), "script-src sans 'unsafe-inline' ni 'unsafe-eval'", scriptSrc.trim());
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const enLigne = (html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi) || []).filter((s) => !/type="application\/(ld\+)?json"/.test(s));
  dit(enLigne.length === 0, "index.html n'a plus aucun script en ligne", enLigne.map((s) => s.slice(0, 60)).join(' | '));
  const xfo = r0.headers.get('x-frame-options');
  dit(/^deny$/i.test(xfo || ''), 'X-Frame-Options DENY (cohérent avec frame-ancestors none)', xfo);
  // (22 oct.) Le service worker n'est PAS sous la politique de la page : il va
  // chercher les QR des transporteurs (hôtes variables) pour Ma journée hors
  // ligne. Le worker de la carte (/assets/…), lui, l'est : ses tuiles doivent
  // être permises par connect-src.
  const rsw = await fetch(ORIGINE + '/sw.js');
  const swPol = rsw.headers.get('content-security-policy-report-only') || '';
  dit(!/connect-src/.test(swPol) && !/connect-src/.test(rsw.headers.get('content-security-policy') || ''), "/sw.js n'est pas sous la politique complète (il va chercher les QR des transporteurs)", swPol ? 'il la reçoit : ' + swPol.slice(0, 60) : 'directives structurelles seulement');
  const assetJs = (fs.readdirSync(path.join(DIST, 'assets')).find((f) => /^maplibre-gl-worker.*\.js$/.test(f)) || fs.readdirSync(path.join(DIST, 'assets')).find((f) => /\.js$/.test(f)));
  const rw = await fetch(ORIGINE + '/assets/' + assetJs);
  const cs = (/(?:^|;)\s*connect-src([^;]*)/.exec(rw.headers.get('content-security-policy-report-only') || rw.headers.get('content-security-policy') || '') || [])[1] || '';
  dit(/https:\/\/tiles\.openfreemap\.org/.test(cs), `le worker de la carte (/assets/${assetJs}) peut joindre tiles.openfreemap.org (connect-src)`, cs.trim().slice(0, 120));
  const api = await fetch(ORIGINE + '/api/sante');
  dit(api.status === 404, "les réécritures de vercel.json sont appliquées (/api/sante → /api/compte?mode=sante, servi par Vercel, 404 ici)");

  for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
    console.log(`\n── ${vp.width} px — chaque écran`);
    const { ctx, vues } = await contexte(b, vp);
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    for (const tab of TABS) {
      const n0 = vues.length;
      try { await pg.goto(`${ORIGINE}/?tab=${tab}`, { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch (e) { dit(false, tab, e.message.split('\n')[0]); continue; }
      await calme(pg);
      const tombe = await pg.evaluate(() => /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText) || document.body.innerText.trim().length < 20).catch(() => true);
      const v = nouvelles(vues, n0);
      dit(!tombe && v.length === 0, `${tab}`, tombe ? 'écran tombé ou vide' : v.map((x) => x.texte).join(' | '));
    }
    dit(errs.length === 0, 'aucune erreur de page', errs.slice(0, 3).join(' | '));

    // ── La carte de la Communauté : le fond OpenFreeMap, demandé ET dessiné ──
    // (22 oct.) Une carte qui n'a rien demandé ne viole rien : on exige qu'elle
    // ait demandé son style, ses tuiles (depuis le worker de MapLibre) et ses
    // polices ou son sprite, puis ZÉRO violation — rapports des workers compris.
    console.log(`── ${vp.width} px — carte de la Communauté (OpenFreeMap)`);
    // ⚠️ Dans un contexte NEUF : les violations d'un contexte sont dédoublonnées,
    // et celles déjà vues pendant la tournée des écrans rendaient ce contrôle
    // vert par accident sur le code d'avant (vu le 22 oct.).
    {
      const c2 = await contexte(b, vp); const pgc = await c2.ctx.newPage();
      const vuesC = c2.vues, n0 = 0, o0 = OFM.vus.length;
      const pg = pgc, vues = vuesC;
      await pg.goto(`${ORIGINE}/?tab=communaute`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await pg.waitForSelector('[data-cm-fond="openfreemap"]', { timeout: 20000 }).catch(() => {});
      for (let i = 0; i < 40 && !OFM.vus.slice(o0).some((u) => /\/planet\//.test(u)); i++) await pg.waitForTimeout(250);
      await calme(pg, 2500);
      const fond = await pg.evaluate(() => { const c = document.querySelector('[data-cm-carte]'); return c ? c.getAttribute('data-cm-fond') + ' · ' + c.getAttribute('data-cm-carte') + ' · canvas ' + !!document.querySelector('.maplibregl-canvas, .vrm-cm-carte canvas') : 'pas de carte'; }).catch(() => '?');
      const demandes = OFM.vus.slice(o0);
      dit(/^openfreemap/.test(fond), 'la carte dessine son fond OpenFreeMap (MapLibre)', fond);
      dit(demandes.some((u) => /\/styles\//.test(u)) && demandes.some((u) => /\/planet$/.test(u)) && demandes.some((u) => /\/planet\//.test(u)) && demandes.some((u) => /\/natural_earth\//.test(u)) && demandes.some((u) => /\/(fonts|sprites)\//.test(u)), 'elle a demandé son style, sa TileJSON, ses tuiles vectorielles ET raster, et ses polices/sprite (sinon « zéro violation » ne prouverait rien)', [...new Set(demandes.map((u) => u.split('/').slice(0, 3).join('/')))].join(' '));
      const v = nouvelles(vues, n0);
      dit(v.length === 0, 'carte : aucune violation (page ET worker de MapLibre)', v.map((x) => x.texte).join(' | '));
      await c2.ctx.close();
    }
    // Contrôle positif WORKER : une violation DANS un worker doit être vue (par
    // les rapports — ni l'évènement ni la console de la page ne la voient).
    {
      const n0 = vues.length;
      await pg.evaluate((jeton) => { try { const w = new Worker(URL.createObjectURL(new Blob([`fetch('https://interdit-worker.exemple.test/${jeton}').catch(() => {});`], { type: 'text/javascript' }))); setTimeout(() => w.terminate(), 3000); } catch (_) {} }, String(Date.now()));
      let v = [];
      for (let i = 0; i < 40; i++) { v = nouvelles(vues, n0); if (v.some((x) => /interdit-worker/.test(x.texte))) break; await pg.waitForTimeout(100); }
      dit(v.some((x) => /interdit-worker/.test(x.texte)), 'contrôle positif : une adresse interdite contactée DEPUIS UN WORKER est signalée', v.map((x) => x.texte).join(' | ') || 'rien vu — les workers seraient invisibles');
      await pg.waitForTimeout(300);
      vues.splice(n0);
    }

    // ── La fenêtre du reçu d'achat : le VRAI `openReceipt`, ses deux boutons ──
    console.log(`── ${vp.width} px — reçu, facture, bordereau`);
    await pg.goto(`${ORIGINE}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' }); await calme(pg, 1500);
    // (22 oct., revue) Le QR Vinted Go (http dans sa base) part en https, et ne
    // fait signaler aucune violation (la tournée des écrans juge les violations).
    dit(VG.https > 0 && VG.http === 0, 'le QR Vinted Go (http dans les emails) est demandé en https, jamais en http', `https ${VG.https} · http ${VG.http}`);
    // (22 oct., revue) Le journal dit QUEL écran a parlé : l'app retire `?tab=`
    // de l'adresse, l'écran se lit dans `history.state` (une violation de la
    // page, provoquée exprès, doit porter « cat_achats »).
    {
      const n0 = vues.length;
      await pg.evaluate(() => { fetch('https://interdit-page.exemple.test/journal').catch(() => {}); });
      let j = null;
      for (let i = 0; i < 30; i++) { j = await journalCsp(pg); if (j && j.some((e) => /interdit-page/.test(e.message))) break; await pg.waitForTimeout(100); }
      const e = (j || []).find((x) => /interdit-page/.test(x.message));
      dit(!!e && /^cat_achats/.test(e.ecran || ''), 'le journal nomme l\'écran d\'une violation de la page (history.state, pas l\'adresse)', e ? `écran « ${e.ecran} »` : 'rien au journal');
      await pg.waitForTimeout(300);
      vues.splice(n0);
    }
    const codeRecu = [extrait('const parseReceiptFields = (a) => {'), extrait('const b64ToBytes = (b64) => {'), extrait('const openReceipt = (a) => {')];
    // Le journal des fenêtres (22 oct.) : présent sur le code d'après, absent avant.
    const codeJournal = [PLANTAGES, "const BUILD_ISO = 'banc';", extrait('const ecouterFenetreCsp = (w, nom) => {') || ''].join('\n');
    const RECU = { article: 'Nike Air Max 1', prix: '42.50', transaction: '123', account: 'vendeur_1', vendeur: 'x', texte: 'Montant payé : 42,50 €\nFrais de port 3,00 €' };
    const ouvrirRecu = (p) => Promise.all([p.context().waitForEvent('page', { timeout: 8000 }).catch(() => null),
      p.evaluate(`(() => { ${codeJournal}\n${codeRecu.join('\n')}; openReceipt(${JSON.stringify(RECU)}); })()`)]).then(([pop]) => pop);
    // ⚠️ Le reçu se juge dans un contexte SANS AUCUNE route : mesuré le 22 oct.,
    // l'interception de Playwright (`ctx.route`) laisse en suspens la requête du
    // script que la fenêtre `about:blank` charge (`/recu-boutons.js`) — jamais
    // partie, alors qu'elle part sans interception (et chez lui). L'ouvreur est
    // une page statique de VRM (/legal/cgv.html, même politique) : ce qui compte
    // est que SON contexte disparaisse au rechargement, comme l'onglet de l'app.
    // Rien d'extérieur n'est demandé par ces pages.
    const cR = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}), serviceWorkers: 'block' });
    const vuesR = V.observer(cR);
    const pgR = await cR.newPage();
    await pgR.goto(`${ORIGINE}/legal/cgv.html`, { waitUntil: 'load' }).catch(() => {});
    if (codeRecu.some((x) => !x)) dit(false, 'le code du reçu se retrouve dans App.jsx');
    else {
      const pg = pgR, vues = vuesR;
      // (a) l'onglet de VRM intact, (b) RECHARGÉ entre l'ouverture et le clic —
      // ce que l'app fait toute seule (version vérifiée chaque minute, nouveau
      // service worker après un déploiement). Sur cab152a, (b) ne faisait plus rien.
      for (const recharge of [false, true]) {
        const n0 = vues.length;
        const pop = await ouvrirRecu(pg);
        dit(!!pop, `le reçu s'ouvre dans une fenêtre${recharge ? ' (puis l\'onglet de VRM se recharge)' : ''}`);
        if (pop) {
          await pop.waitForLoadState('load').catch(() => {});
          await pop.waitForTimeout(300);
          if (recharge) { await pg.reload({ waitUntil: 'load' }).catch(() => {}); await calme(pg, 800); }
          await pop.evaluate(() => { window.__imprime = 0; window.print = () => { window.__imprime++; }; });
          await pop.click('#vrm-recu-imprimer').catch(() => {});
          await pop.waitForTimeout(300);
          const imprime = await pop.evaluate(() => window.__imprime).catch(() => 0);
          dit(imprime === 1, `« Imprimer » du reçu lance l'impression, une fois${recharge ? ' — onglet de VRM RECHARGÉ' : ''}`, `print() appelé ${imprime} fois`);
          const fermee = pop.waitForEvent('close', { timeout: 4000 }).then(() => true).catch(() => false);
          await pop.click('#vrm-recu-fermer').catch(() => {});
          dit(await fermee, `« Fermer » ferme la fenêtre du reçu${recharge ? ' — onglet de VRM RECHARGÉ' : ''}`);
        }
        const v = nouvelles(vues, n0);
        dit(v.length === 0, `reçu${recharge ? ' (onglet rechargé)' : ''} : aucune violation`, v.map((x) => x.texte).join(' | '));
      }
      // (c) une violation DANS la fenêtre du reçu arrive au journal, nommée.
      {
        const n0 = vues.length;
        const pop = await ouvrirRecu(pg);
        if (pop) {
          await pop.waitForLoadState('load').catch(() => {});
          await pop.evaluate(() => { const bt = document.createElement('button'); bt.setAttribute('onclick', 'window.__xssRecu=1'); document.body.appendChild(bt); bt.click(); bt.remove(); }).catch(() => {});
          let j = null;
          for (let i = 0; i < 30; i++) { j = await journalCsp(pg); if (j && j.some((e) => /^fenetre:recu/.test(e.ecran || ''))) break; await pg.waitForTimeout(100); }
          const e = (j || []).find((x) => /^fenetre:recu/.test(x.ecran || ''));
          dit(!!e, 'une violation DANS la fenêtre du reçu arrive au journal des plantages (écran « fenetre:recu »)', e ? e.message : 'rien au journal : ' + JSON.stringify(j));
          await pop.close().catch(() => {});
        } else dit(false, 'le reçu s\'ouvre (journal)');
        await pg.waitForTimeout(300);
        vues.splice(n0);
      }
    }
    await cR.close();

    // ── Une facture imprimable (le VRAI `ouvrirDocumentImprimable`) ──
    const codeFact = [SRC.match(/^const CSP_DOCUMENT = .*$/m)?.[0], extrait('function ouvrirDocumentImprimable(html) {', '\n}\n')];
    if (codeFact.some((x) => !x)) dit(false, 'le code de la facture imprimable se retrouve dans App.jsx');
    else {
      const n0 = vues.length;
      const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Facture FA-2026-0001</title><style>body{font-family:Arial;color:#222}.t{font-weight:800}</style></head><body><div class="t" style="color:#111">Facture</div><img alt="" src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%2710%27/%3E"><table style="width:100%"><tr><td>Nike</td><td>42,50 €</td></tr></table></body></html>';
      const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null),
        pg.evaluate(`(() => { ${codeJournal}\n${codeFact.join('\n')}; const w = ouvrirDocumentImprimable(${JSON.stringify(html)}); if (w) w.print = () => {}; })()`)]);
      dit(!!pop, 'la facture s\'ouvre');
      if (pop) {
        await pop.waitForTimeout(800);
        const ok = await pop.evaluate(() => ({ t: document.body.innerText, style: getComputedStyle(document.querySelector('.t')).fontWeight })).catch(() => null);
        dit(!!ok && /Facture/.test(ok.t) && /42,50/.test(ok.t) && String(ok.style) === '800', 'la facture est rendue, avec ses styles', ok ? `poids ${ok.style}` : 'illisible');
        const v = nouvelles(vues, n0);
        dit(v.length === 0, 'facture : aucune violation', v.map((x) => x.texte).join(' | '));
        // (22 oct., revue) Une violation DANS la facture arrive au journal, nommée.
        const n1 = vues.length;
        await pop.evaluate(() => { const bt = document.createElement('button'); bt.setAttribute('onclick', 'window.__xssFacture=1'); document.body.appendChild(bt); bt.click(); bt.remove(); }).catch(() => {});
        let j = null;
        for (let i = 0; i < 30; i++) { j = await journalCsp(pg); if (j && j.some((e) => /^fenetre:facture/.test(e.ecran || ''))) break; await pg.waitForTimeout(100); }
        const e = (j || []).find((x) => /^fenetre:facture/.test(x.ecran || ''));
        dit(!!e, 'une violation DANS la facture arrive au journal des plantages (écran « fenetre:facture »)', e ? e.message : 'rien au journal');
        await pop.close().catch(() => {});
        await pg.waitForTimeout(300);
        vues.splice(n1);
      } else {
        const v = nouvelles(vues, n0);
        dit(v.length === 0, 'facture : aucune violation', v.map((x) => x.texte).join(' | '));
      }
    }

    // ── Un bordereau PDF dans un onglet (blob:, `object-src 'none'` en vigueur) ──
    {
      const n0 = vues.length;
      const b64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
      const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null),
        pg.evaluate(`(() => { const bin = atob(${JSON.stringify(b64)}); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); window.open(URL.createObjectURL(new Blob([u], { type: 'application/pdf' })), '_blank'); })()`)]);
      dit(!!pop, 'le bordereau s\'ouvre dans un onglet');
      if (pop) { await pop.waitForTimeout(1500); dit(/^blob:/.test(pop.url()), 'l\'onglet porte le PDF (blob:)', pop.url().slice(0, 40)); await pop.close().catch(() => {}); }
      const v = nouvelles(vues, n0);
      dit(v.length === 0, 'bordereau : aucune violation', v.map((x) => x.texte).join(' | '));
    }

    // ── Contrôle positif : l'observation n'est pas aveugle ──
    {
      const n0 = vues.length;
      // Un gestionnaire en ligne déclenché de façon SYNCHRONE (un clic) : pas de chargement
      // d'image à attendre, et un texte unique par passage (Chromium peut fusionner deux
      // rapports identiques dans un même document).
      await pg.evaluate((jeton) => { const bt = document.createElement('button'); bt.setAttribute('onclick', 'window.__xssBanc=' + jeton); document.body.appendChild(bt); bt.click(); bt.remove(); }, Date.now());
      let v = [];
      for (let i = 0; i < 30; i++) { v = nouvelles(vues, n0); if (v.some((x) => /script-src/.test(x.texte))) break; await pg.waitForTimeout(100); }
      dit(v.some((x) => /script-src/.test(x.texte)), 'contrôle positif : un gestionnaire en ligne glissé dans la page EST signalé', v.map((x) => x.texte).join(' | ') || 'rien vu — observation aveugle');
      if (VIGUEUR) dit(!(await pg.evaluate(() => window.__xssBanc)), 'en vigueur : il ne s\'exécute PAS');
      vues.splice(n0);
    }
    await ctx.close();

    // ── Sans session : accueil, connexion, film, pages légales ──
    console.log(`── ${vp.width} px — pages publiques`);
    const pub = await contexte(b, vp, false);
    const p2 = await pub.ctx.newPage();
    for (const u of ['/', '/?connexion', '/?inscription', '/?film', '/legal/cgv.html', '/legal/mentions-legales.html', '/legal/confidentialite.html', '/recuperation.html#type=recovery&access_token=en.tete.banc']) {
      const n0 = pub.vues.length;
      await p2.goto(ORIGINE + u, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await calme(p2, 2500);
      // Le film est une animation dessinée (aucun texte) : on compte ce qui est rendu.
      const t = await p2.evaluate(() => document.body.innerText.trim().length + (document.querySelector('#root [data-film-plan]') ? 100 : 0)).catch(() => 0);
      const v = nouvelles(pub.vues, n0);
      dit(t > 20 && v.length === 0, `page ${u}`, t <= 20 ? 'vide' : v.map((x) => x.texte).join(' | '));
    }
    await pub.ctx.close();
  }

  // ── Ma journée hors ligne : le QR d'un colis à retirer mis en réserve ──
  // (22 oct.) Le VRAI `rechaufferQr` d'App.jsx, service worker en marche. Avant,
  // la PAGE allait chercher le QR chez le transporteur (connect-src le refuse :
  // ces hôtes varient — six mesurés dans sa base) ; c'est le service worker, hors
  // de la politique, qui le fait. On exige : la réserve remplie, et ZÉRO
  // violation — ni de la page, ni du service worker (rapports).
  console.log('\n── service worker — QR de Ma journée hors ligne mis en réserve');
  {
    const { ctx, vues } = await contexte(b, { width: 390, height: 844 }, true, { sw: true });
    const pg = await ctx.newPage();
    await pg.goto(`${ORIGINE}/?tab=journee`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await pg.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready).catch(() => {});
    if (!(await pg.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)).catch(() => false))) await pg.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await calme(pg, 1500);
    const HL = fs.readFileSync(path.join(RACINE, 'src', 'journeeHorsLigne.js'), 'utf8');
    const decl = [/^export const CACHE_QR = .*$/m, /^export const adresseQrLocale = .*$/m].map((re) => ((HL.match(re) || [])[0] || '').replace(/^export /, ''));
    const code = extrait('const rechaufferQr = async (photo) => {');
    const controle = await pg.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)).catch(() => false);
    dit(controle, 'le service worker de VRM commande la page');
    if (!code || decl.some((x) => !x)) dit(false, 'le code de la réserve des QR se retrouve dans App.jsx / journeeHorsLigne.js');
    else {
      const n0 = vues.length, q0 = QR.servis;
      const qr = 'https://qr.exemple.test/api/barcode/AztecCode?d=PICKUPPASS:BANC' + Date.now();
      await pg.evaluate(`(async () => { ${decl.join('\n')}\n${code}\n await rechaufferQr({ retirer: [{ qr: ${JSON.stringify(qr)} }] }); })()`).catch((e) => dit(false, 'rechaufferQr s\'exécute', String(e).slice(0, 120)));
      let n = 0;
      for (let i = 0; i < 30 && !n; i++) { n = await pg.evaluate(async (u) => (await (await caches.open('vrm-hl-qr')).match('/hl-qr?u=' + encodeURIComponent(u))) ? 1 : 0, qr).catch(() => 0); if (!n) await pg.waitForTimeout(200); }
      dit(n === 1 && QR.servis > q0, 'le QR est dans la réserve (allé chercher une fois)', `réserve ${n} · demandes au transporteur ${QR.servis - q0}`);
      // (22 oct., revue) Le QR Vinted Go — http dans les emails — passe par le
      // VRAI qrImage (comme la photo de Ma journée) puis la réserve. Sur cab152a
      // il n'y entrait JAMAIS (rechaufferQr et le service worker ne prennent
      // que https://).
      const declQr = [/^const URL_PAS_UN_QR = .*$/m, /^const URL_QR_CERTAIN = .*$/m, /^const qrEnHttps = .*$/m].map((re) => (SRC.match(re) || [])[0] || '');
      const fnQr = extrait('const qrImage = (t) => {');
      if (!fnQr || !declQr[0] || !declQr[1]) dit(false, 'le code de qrImage se retrouve dans App.jsx');
      else {
        const k = await pg.evaluate(`(async () => { ${decl.join('\n')}\n${declQr.join('\n')}\n${fnQr}\n${code}\n const q = qrImage({ qrUrl: ${JSON.stringify(QR_VG)} }); await rechaufferQr({ retirer: [{ qr: q }] }); return q; })()`).catch((e) => 'ERR ' + String(e).slice(0, 80));
        let m = 0;
        for (let i = 0; i < 30 && !m; i++) { m = await pg.evaluate(async (u) => (await (await caches.open('vrm-hl-qr')).match('/hl-qr?u=' + encodeURIComponent(u))) ? 1 : 0, String(k)).catch(() => 0); if (!m) await pg.waitForTimeout(200); }
        dit(/^https:\/\/p\.vintedgo\.com\//.test(String(k)) && m === 1 && VG.https > 0 && VG.http === 0, 'le QR Vinted Go (http dans les emails) est rendu en https ET mis en réserve (demandé en https seulement)', `qrImage → ${String(k).slice(0, 40)} · réserve ${m} · https ${VG.https} · http ${VG.http}`);
      }
      await calme(pg, 1500);
      const v = nouvelles(vues, n0);
      dit(v.length === 0, 'réserve des QR : aucune violation (page ET service worker)', v.map((x) => x.texte).join(' | '));
      // (22 oct., revue) Une NAVIGATION vers /hl-qr (un lien posé par un autre
      // site) : rien n'est demandé au site visé, rien n'est rangé. Sur cab152a,
      // trois clics rangeaient trois pages tierces dans le stockage de vrm.center.
      const avantNav = await pg.evaluate(async () => (await (await caches.open('vrm-hl-qr')).keys()).length).catch(() => -1);
      const t0 = TIERS.n;
      for (let i = 1; i <= 3; i++) {
        const p3 = await ctx.newPage();
        await p3.goto(`${ORIGINE}/hl-qr?u=` + encodeURIComponent('https://autre-site.exemple.test/page-' + i), { waitUntil: 'load' }).catch(() => {});
        await p3.waitForTimeout(500); await p3.close().catch(() => {});
      }
      const apresNav = await pg.evaluate(async () => (await (await caches.open('vrm-hl-qr')).keys()).length).catch(() => -1);
      dit(apresNav === avantNav && TIERS.n === t0, 'une navigation vers /hl-qr ne fait rien demander ni ranger (lien posé par un autre site)', `réserve ${avantNav} → ${apresNav} · demandes au site tiers ${TIERS.n - t0}`);
      // Et la réserve est bornée : ce que la page demande au-delà de la borne
      // fait partir les plus anciennes.
      const QR_MAX = Number((/const QR_MAX = (\d+)/.exec(fs.readFileSync(path.join(RACINE, 'public', 'sw.js'), 'utf8')) || [])[1] || 0);
      if (!QR_MAX) dit(false, 'la réserve des QR a une borne (QR_MAX dans public/sw.js)');
      else {
        await pg.evaluate(async (n) => { for (let i = 0; i < n; i++) { try { await fetch('/hl-qr?u=' + encodeURIComponent('https://qr.exemple.test/api/barcode/AztecCode?d=BORNE' + i), { credentials: 'omit', headers: { 'x-vrm-hl-qr': '1' } }); } catch (_) {} } }, QR_MAX + 5);
        const nb = await pg.evaluate(async () => (await (await caches.open('vrm-hl-qr')).keys()).length).catch(() => -1);
        dit(nb > 0 && nb <= QR_MAX, `la réserve des QR reste sous sa borne (${QR_MAX})`, `${nb} entrée(s)`);
      }
    }
    await ctx.close();
  }

  await b.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) en échec' : '✅ tout est vert'}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc est tombé : ' + (e && e.stack || e)); process.exit(1); });
