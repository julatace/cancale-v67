// ════════════════════════════════════════════════════════════════════════════
//  Banc « une seule copie des commandes pour tous les moteurs » (13 nov., source unique)
//  node scripts/bancs/source-unique.cjs [dist] [port]
//
//  Ventes monte deux `Comptabilite` (la liste et « À expédier »), Achats trois. Chacun
//  lisait, fusionnait et gardait SA copie des commandes ; un signal de l'extension
//  (« ventes rangées », « achats rangés », sans compte) faisait relire TOUTES les lignes
//  de commandes par CHAQUE moteur monté. Depuis le magasin partagé (src/magasinPartage.js),
//  une lecture en cours est rejointe par les autres moteurs.
//
//  Scénario (base inventée `_base-volume`, aucune donnée réelle) :
//   A  Ventes ouverte, montage fini : le signal « ventes » (sans compte) ⇒ chaque ligne
//      `harvest_{uid}_orders_sold` relue AU PLUS une fois (pas une fois par moteur) ;
//   K  « LECTURE KO, ÉCRITURE OK » (§5 : le cas qui détruit) : les lectures de commandes
//      répondent 500, les écritures 201 ; le même signal ⇒ les ventes montrées avant
//      restent à l'écran (rien effacé, pas de « 0 »), les lectures ratées ont bien eu lieu,
//      et aucune écriture ne publie un compte de ventes plus petit qu'avant ;
//   H  Achats ouverte (trois moteurs) : le signal « achats » (sans compte) ⇒ chaque ligne
//      `harvest_{uid}_orders_purchased` relue au plus une fois.
//  Deux passes : 1512 clair, 390 tactile sombre. Un banc ne meurt pas, il rapporte.
//  SHOTS=<dossier> : captures après la phase K.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
let chromium;
try { ({ chromium } = require(path.join(RACINE, 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const DIST = process.argv[2] || process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = +(process.argv[3] || process.env.BANC_PORT || 9671);
const SHOTS = process.env.SHOTS || '';
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream'; const b = fs.readFileSync(p);
  if (/javascript|css|html|json|svg/.test(t)) { r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip' }); r.end(zlib.gzipSync(b)); }
  else { r.writeHead(200, { 'content-type': t }); r.end(b); }
});
srv.on('error', (e) => { console.log('✗ ROUGE le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let verts = 0, rouges = 0;
const juge = (ok, nom, detail = '') => { if (ok) verts++; else rouges++; console.log(`${ok ? '✓' : '✗ ROUGE'} ${nom}${detail ? ' — ' + detail : ''}`); };
const dec = (u) => { try { return decodeURIComponent(u); } catch (_) { return u; } };
// Une lecture du CONTENU d'une ligne de commandes (pas un scalaire `n:`/`cap:`).
const lectureCommandes = (u, sorte) => {
  const d = dec(u); const [a, s = ''] = d.split('&select=');
  if (!new RegExp(`harvest_(\\d+|\\*)_orders_(${sorte}|\\*)\\b`).test(a)) return false;
  return /payload|data(,|$)|^data/.test(s);
};
const idsDe = (u) => { const d = dec(u); const m = /[?&]id=in\.\(([^)]*)\)/.exec(d); if (m) return m[1].split(','); const e = /[?&]id=(?:eq|like)\.([^&]+)/.exec(d); return e ? [e[1]] : ['*']; };
// Combien de fois chaque ligne a été relue (une lecture `like.*` compte pour toutes).
const parLigne = (liste, sorte, uids) => {
  const n = Object.fromEntries(uids.map((u) => [u, 0]));
  for (const r of liste) for (const id of idsDe(r.u)) {
    const m = new RegExp(`harvest_(\\d+)_orders_(${sorte}|\\*)`).exec(id);   // la ligne d'un compte (« _orders_*d » : ventes et achats)
    if (m) { if (m[1] in n) n[m[1]]++; continue; }
    for (const u of uids) n[u]++;                                              // une lecture de toutes les lignes
  }
  return n;
};
// Un nombre de ventes publié dans une écriture (`ventes`, `nVentes`, `nbVentes`…), le plus grand.
const ventesPubliees = (corps) => {
  let max = null;
  const re = /"(?:n_?ventes|nb_?ventes|ventes_?n|nVentes|ventesN|sold)"\s*:\s*(\d+)/gi; let m;
  while ((m = re.exec(corps))) max = Math.max(max == null ? 0 : max, Number(m[1]));
  return max;
};

// Le compteur d'exécutions posé par l'app (`performance.mark('vrm:commandes:<sorte>')`, une par fusion).
const fusions = (pg, sorte) => pg.evaluate((s) => performance.getEntriesByName(`vrm:commandes:${s}`).length, sorte);

async function ouvrir(b, { largeur, hauteur, mobile, sombre }, tab, base, etat) {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: largeur, height: hauteur }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light' });
  await ctx.addInitScript((sombre) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {}
  }, !!sombre);
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const reqs = [];
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request(); const rec = { t: Date.now(), m: rq.method(), u: rq.url(), st: 0, corps: '' };
    reqs.push(rec);
    if (rq.method() !== 'GET') { rec.corps = rq.postData() || ''; rec.st = 201; return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }   // ÉCRITURE OK
    if (etat.ko && (lectureCommandes(rq.url(), 'sold') || lectureCommandes(rq.url(), 'purchased'))) { rec.st = 500; await attendre(20); return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"panne simulée"}' }); }   // LECTURE KO
    const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
    rec.st = rep.status;
    await attendre(20);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'commit' });
  await pg.waitForSelector('.vrm-main', { timeout: 60000 }).catch(() => {});
  const calme = async (ms = 3000, max = 90000) => { const fin = Date.now() + max; let n = reqs.length, t = Date.now(); while (Date.now() - t < ms && Date.now() < fin) { await attendre(250); if (reqs.length !== n) { n = reqs.length; t = Date.now(); } } };
  await calme();
  return { ctx, pg, reqs, errs, calme };
}

async function passe(b, vue) {
  const nom = vue.nom;
  // ── Ventes : A puis K ──
  {
    const base = fabriquer({ volumeReel: true });
    const uids = base.accounts.map((a) => String(a.vinted_user_id));
    const etat = { ko: false };
    const { ctx, pg, reqs, errs, calme } = await ouvrir(b, vue, 'ventes', base, etat);
    const texte = () => pg.evaluate(() => document.body.innerText || '');
    const signal = (quoi) => pg.evaluate((quoi) => window.dispatchEvent(new CustomEvent('vrm:ext', { detail: { type: 'maj', quoi } })), quoi);
    const m0 = await fusions(pg, 'sold');
    juge(m0 === 1, `[${nom}] M au montage, les ventes sont fusionnées UNE fois pour les deux moteurs`, `${m0} fusion(s)`);
    await pg.waitForTimeout(4500);
    let t1 = Date.now();
    await signal('ventes');
    await pg.waitForTimeout(1500); await calme();
    const m1 = await fusions(pg, 'sold');
    juge(m1 - m0 === 1, `[${nom}] A signal « ventes » : une fusion pour les deux moteurs`, `${m1 - m0} fusion(s)`);
    const lusA = reqs.filter((r) => r.m === 'GET' && r.t >= t1 && lectureCommandes(r.u, 'sold'));
    const nA = parLigne(lusA, 'sold', uids);
    const maxA = Math.max(...Object.values(nA));
    juge(lusA.length > 0 && maxA <= 1, `[${nom}] A signal « ventes » : chaque ligne de ventes relue une fois pour tous les moteurs`, `${lusA.length} lecture(s), au plus ${maxA} par ligne`);
    // Ce qui est montré avant la panne.
    const titres = [...new Set(base.rows.filter((r) => /_orders_sold$/.test(r.id)).flatMap((r) => ((r.data && r.data.payload && r.data.payload.my_orders) || []).slice(0, 30).map((o) => o.title)))];
    const avant = await texte();
    const vus = titres.filter((t) => avant.includes(t));
    const ventesAvant = Math.max(0, ...reqs.filter((r) => r.m !== 'GET').map((r) => ventesPubliees(r.corps) || 0));
    // ── K : lecture KO, écriture OK ──
    await pg.waitForTimeout(4500);
    etat.ko = true;
    t1 = Date.now();
    await signal('ventes');
    await pg.waitForTimeout(2000); await calme();
    const m2 = await fusions(pg, 'sold');
    juge(m2 - m1 === 1, `[${nom}] K lecture ratée : une seule tentative pour les deux moteurs`, `${m2 - m1} fusion(s)`);
    const ratees = reqs.filter((r) => r.m === 'GET' && r.t >= t1 && r.st === 500);
    juge(ratees.length > 0, `[${nom}] K les lectures de commandes ont bien échoué (le cas est servi)`, `${ratees.length} lecture(s) en 500`);
    const apres = await texte();
    const perdus = vus.filter((t) => !apres.includes(t));
    juge(vus.length > 0 && perdus.length === 0, `[${nom}] K lecture ratée : rien n'est effacé de l'écran`, `${vus.length - perdus.length}/${vus.length} ventes encore montrées`);
    const ecritures = reqs.filter((r) => r.m !== 'GET' && r.t >= t1);
    const baisses = ecritures.filter((r) => { const v = ventesPubliees(r.corps); return v != null && v < ventesAvant; });
    juge(baisses.length === 0, `[${nom}] K aucune écriture ne publie moins de ventes qu'avant`, `${ecritures.length} écriture(s), ${baisses.length} en baisse`);
    juge(errs.length === 0, `[${nom}] Ventes : aucune erreur`, errs.slice(0, 2).join(' | '));
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `source-unique-ventes-ko-${nom}.png`) }); }
    await ctx.close();
  }
  // ── Achats : H ──
  {
    const base = fabriquer({ volumeReel: true });
    const uids = base.accounts.map((a) => String(a.vinted_user_id));
    const { ctx, pg, reqs, errs, calme } = await ouvrir(b, vue, 'achats', base, { ko: false });
    const p0 = await fusions(pg, 'purchased');
    juge(p0 === 1, `[${nom}] M au montage d'Achats, les achats sont fusionnés UNE fois pour les trois moteurs`, `${p0} fusion(s)`);
    await pg.waitForTimeout(4500);
    const t1 = Date.now();
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:ext', { detail: { type: 'maj', quoi: 'achats' } })));
    await pg.waitForTimeout(1500); await calme();
    const lus = reqs.filter((r) => r.m === 'GET' && r.t >= t1 && lectureCommandes(r.u, 'purchased'));
    const p1 = await fusions(pg, 'purchased');
    juge(p1 - p0 === 1, `[${nom}] H signal « achats » : une fusion pour les trois moteurs`, `${p1 - p0} fusion(s)`);
    const n = parLigne(lus, 'purchased', uids);
    const max = Math.max(...Object.values(n));
    juge(lus.length > 0 && max <= 1, `[${nom}] H signal « achats » : chaque ligne d'achats relue une fois pour les trois moteurs`, `${lus.length} lecture(s), au plus ${max} par ligne`);
    juge(errs.length === 0, `[${nom}] Achats : aucune erreur`, errs.slice(0, 2).join(' | '));
    if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `source-unique-achats-${nom}.png`) });
    await ctx.close();
  }
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const p of (process.env.PASSES || '1512c,390s').split(',')) {
      try {
        if (p === '1512c') await passe(b, { nom: '1512-clair', largeur: 1512, hauteur: 982, mobile: false, sombre: false });
        if (p === '390s') await passe(b, { nom: '390-sombre', largeur: 390, hauteur: 844, mobile: true, sombre: true });
      } catch (e) { juge(false, `[${p}] le banc a pu s'exécuter`, String(e && e.message).split('\n')[0].slice(0, 200)); }
    }
  } finally { await b.close(); srv.close(); }
  console.log(rouges ? `\n✗ ${rouges} rouge(s), ${verts} vert(s)` : `\n✓ une copie des commandes pour tous les moteurs : ${verts} verts`);
  process.exit(rouges ? 1 : 0);
})();
