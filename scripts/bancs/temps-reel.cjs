// ════════════════════════════════════════════════════════════════════════════
//  Banc « temps réel » (11 nov., src/tempsReel.js) — demande de Julien : « quand
//  l'extension capte de nouvelles infos, pas besoin de recharger VRM ».
//  node scripts/bancs/temps-reel.cjs [dist] [port]
//  L'app est ouverte et VISIBLE ; pendant ce temps, « l'extension » (le banc)
//  écrit une ligne dans la base inventée (_base-volume, aucune donnée réelle),
//  sans aucun signal dans la page (une extension d'un AUTRE navigateur). On juge :
//   V  Ventes : la vente neuve est à l'écran en < 30 s, sans rechargement ;
//   A  Annonces : l'annonce neuve est à l'écran en < 30 s ;
//   J  Ma journée : la ligne changée est relue en < 30 s (et la vente montrée
//      quand l'écran la montre) ;
//   B  budget : entre l'écriture et l'écran, seule la ligne du compte touché est
//      relue (pas toute la famille), et au calme la veille ne lit que des
//      versions (quelques Ko) ;
//   P  la pastille « Mis à jour à hh:mm » s'affiche, flottante (rien ne saute) ;
//   K  versions illisibles (503) ⇒ rien n'est vidé, l'écran garde ce qu'il montre.
//  Deux passes : 390 px tactile (clair) et 1512 px (sombre). Captures dans
//  scripts/bancs/captures/temps-reel-*.png. Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const DIST = process.argv[2] || path.join(RACINE, 'dist');
const PORT = +(process.argv[3] || process.env.BANC_PORT || 9650);
const CAPT = path.join(__dirname, 'captures'); try { fs.mkdirSync(CAPT, { recursive: true }); } catch (_) {}
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream'; const b = fs.readFileSync(p);
  if (/javascript|css|html|json|svg/.test(t)) { r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip' }); r.end(zlib.gzipSync(b)); }
  else { r.writeHead(200, { 'content-type': t }); r.end(b); }
}).listen(PORT);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let verts = 0, rouges = 0;
const juge = (ok, nom, detail = '') => { if (ok) verts++; else rouges++; console.log(`${ok ? '✓' : '✗ ROUGE'} ${nom}${detail ? ' — ' + detail : ''}`); };
const dec = (u) => { try { return decodeURIComponent(u); } catch (_) { return u; } };
const LOURDE = /harvest_(\d+|\*)_(orders_(sold|purchased|\*d|\*)|listings|inbox)\b/;
const estLourde = (u) => { const d = dec(u); return LOURDE.test(d.split('&select=')[0]) && /payload/.test(d.split('&select=')[1] || ''); };
const estVeille = (u) => /owner=eq\./.test(dec(u)) && /rev:meta->>rev/.test(dec(u));
const idsDe = (u) => { const d = dec(u); const m = /[?&]id=in\.\(([^)]*)\)/.exec(d); if (m) return m[1].split(','); const e = /[?&]id=(?:eq|like)\.([^&]+)/.exec(d); return e ? [e[1]] : ['*']; };
const UID_V = '3150000000';
const MAX_MS = 30000;

async function passe(b, { nom, largeur, hauteur, mobile, sombre }) {
  const base = fabriquer({ volumeReel: true });
  const etat = { panneVeille: false };
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: largeur, height: hauteur }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light' });
  await ctx.addInitScript((sombre) => {
    try { if (!localStorage.getItem('vrm_acces_direct')) localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {}
  }, !!sombre);
  async function ouvrir(onglet) {
    const pg = await ctx.newPage();
    const reqs = []; const t0 = Date.now();
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    await pg.route('**/rest/v1/**', async (route) => {
      const rq = route.request(); const rec = { t: Date.now(), m: rq.method(), u: rq.url(), o: 0 };
      reqs.push(rec);
      if (rq.method() !== 'GET') { rec.corps = rq.postData() || ''; return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
      if (etat.panneVeille && estVeille(rq.url())) { rec.panne = true; return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"banc : panne"}' }); }
      const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
      const body = JSON.stringify(rep.body); rec.o = Buffer.byteLength(body);
      await attendre(30);
      return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body });
    });
    await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'commit' });
    const fin = Date.now() + 60000;
    while (Date.now() < fin) {
      const e = await pg.evaluate(() => { const ae = document.querySelector('[data-attente]'); return ae ? ae.getAttribute('data-attente') : '-'; }).catch(() => '?');
      if (e === 'pret' || e === 'plafond') break;
      await attendre(100);
    }
    // Calme : plus aucune lecture pendant 3 s (le montage est fini).
    let n = reqs.length, calme = Date.now();
    while (Date.now() - calme < 3000 && Date.now() < fin + 20000) { await attendre(250); if (reqs.length !== n) { n = reqs.length; calme = Date.now(); } }
    await pg.waitForTimeout(4500);   // la veille a fait sa 1re lecture (base)
    return { pg, reqs, navs: await pg.evaluate(() => performance.getEntriesByType('navigation').length) };
  }
  const texte = (pg) => pg.evaluate(() => document.body.innerText || '');
  const bilan = (reqs, depuis) => { const l = reqs.filter((r) => r.m === 'GET' && r.t >= depuis); const lourdes = l.filter((r) => estLourde(r.u)); return { n: l.length, Ko: Math.round(l.reduce((a, r) => a + r.o, 0) / 1024), lourdes, lourdesKo: Math.round(lourdes.reduce((a, r) => a + r.o, 0) / 1024), veille: l.filter((r) => estVeille(r.u)) }; };
  // « L'extension » écrit : la ligne change de version (rev + 1, capture maintenant).
  const ecrireLigne = (id, f) => { const row = base.rows.find((r) => r.id === id); const now = new Date().toISOString(); row.data = f({ ...row.data, rev: (Number(row.data.rev) || 0) + 1, capturedAt: now }); row.updated_at = now; return row; };
  const attendreTexte = async (pg, t, depuis) => { while (Date.now() - depuis < MAX_MS + 5000) { if ((await texte(pg)).includes(t)) return Date.now() - depuis; await attendre(250); } return null; };

  // ── V : Ventes ──────────────────────────────────────────────────────────
  {
    const TITRE = `Vente NEUVE ${nom} 4242`;
    const o = await ouvrir('ventes');
    juge(!(await texte(o.pg)).includes(TITRE), `[${nom}] V : la vente n'est pas là avant l'écriture`);
    // Au calme : la veille ne lit que des versions.
    const tCalme = Date.now(); await o.pg.waitForTimeout(28000); const calme = bilan(o.reqs, tCalme);
    juge(calme.veille.length >= 1 && calme.lourdes.length === 0, `[${nom}] B : au calme (28 s), la veille ne lit que des versions`, `${calme.veille.length} lecture(s) de versions, ${calme.n} lectures, ${calme.Ko} Ko, ${calme.lourdes.length} lourde(s)`);
    const t1 = Date.now();
    ecrireLigne(`harvest_${UID_V}_orders_sold`, (d) => { const v0 = d.payload.my_orders[0]; return { ...d, payload: { ...d.payload, my_orders: [{ ...v0, transaction_id: 22099999901, item_id: 7099999901, title: TITRE, date: new Date().toISOString(), status: 'Le paiement a été validé' }, ...d.payload.my_orders] } }; });
    // La pastille, saisie à son apparition (elle s'efface après 6 s).
    const vuPastille = o.pg.waitForSelector('[data-temps-reel-neuf]', { timeout: MAX_MS + 5000 }).then(async () => { const info = await o.pg.evaluate(() => { const e = document.querySelector('[data-temps-reel-neuf]'); if (!e) return null; const s = getComputedStyle(e.parentElement); return { t: e.innerText, pos: s.position }; }); await o.pg.screenshot({ path: path.join(CAPT, `temps-reel-${nom}-pastille.png`) }); return info; }).catch(() => null);
    const ms = await attendreTexte(o.pg, TITRE, t1);
    const pastille = await vuPastille;
    juge(ms != null && ms < MAX_MS, `[${nom}] V : la vente neuve est à l'écran sans recharger`, ms != null ? `${(ms / 1000).toFixed(1)} s` : 'jamais (35 s)');
    const navs = await o.pg.evaluate(() => performance.getEntriesByType('navigation').length);
    juge(navs === o.navs, `[${nom}] V : aucun rechargement de la page`);
    juge(!!pastille && /^Mis à jour à \d{2}:\d{2}$/.test(pastille.t) && pastille.pos === 'fixed', `[${nom}] P : pastille « Mis à jour à hh:mm », flottante`, pastille ? `${pastille.t} · ${pastille.pos}` : 'absente');
    await o.pg.screenshot({ path: path.join(CAPT, `temps-reel-${nom}-ventes.png`) });
    const apres = bilan(o.reqs, t1);
    const ids = [...new Set(apres.lourdes.flatMap((r) => idsDe(r.u)))];
    juge(apres.lourdes.length > 0 && ids.every((i) => i.includes(UID_V)), `[${nom}] B : seules les lignes du compte touché sont relues`, `${apres.lourdes.length} lecture(s) lourde(s) : ${ids.join(',')} · ${apres.lourdesKo} Ko lourds, ${apres.Ko} Ko en tout`);
    juge(apres.Ko < 600, `[${nom}] B : pas d'explosion (< 600 Ko entre l'écriture et l'écran)`, `${apres.n} lectures, ${apres.Ko} Ko`);
    // K : versions illisibles ⇒ rien n'est vidé.
    etat.panneVeille = true;
    const tk = Date.now(); await o.pg.waitForTimeout(30000);
    const k = bilan(o.reqs, tk);
    juge(k.veille.some((r) => r.panne) && (await texte(o.pg)).includes(TITRE), `[${nom}] K : versions en panne ⇒ l'écran garde ce qu'il montre`, `${k.veille.length} lecture(s) en panne`);
    juge(!o.reqs.some((r) => r.m !== 'GET' && /harvest_/.test(r.u + (r.corps || ''))), `[${nom}] aucune écriture de moisson ne part de la veille`);
    etat.panneVeille = false;
    await o.pg.close();
  }

  // ── A : Annonces ────────────────────────────────────────────────────────
  {
    const TITRE = `Annonce NEUVE ${nom} 777`;
    const o = await ouvrir('annonces');
    juge(!(await texte(o.pg)).includes(TITRE), `[${nom}] A : l'annonce n'est pas là avant l'écriture`);
    const t1 = Date.now();
    ecrireLigne(`harvest_${UID_V}_listings`, (d) => { const i0 = d.payload.items[0]; const items = [{ ...i0, id: 7099999902, title: TITRE, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: new Date().toISOString() }, ...d.payload.items]; return { ...d, nItems: items.length, payload: { ...d.payload, items, pagination: { ...(d.payload.pagination || {}), total_entries: items.length } } }; });
    const ms = await attendreTexte(o.pg, TITRE, t1);
    juge(ms != null && ms < MAX_MS, `[${nom}] A : l'annonce neuve est à l'écran sans recharger`, ms != null ? `${(ms / 1000).toFixed(1)} s` : 'jamais (35 s)');
    const apres = bilan(o.reqs, t1);
    const ids = [...new Set(apres.lourdes.flatMap((r) => idsDe(r.u)))];
    juge(ids.every((i) => i.includes(UID_V)), `[${nom}] B : Annonces relit la seule ligne touchée`, `${ids.join(',') || '—'} · ${apres.Ko} Ko`);
    await o.pg.screenshot({ path: path.join(CAPT, `temps-reel-${nom}-annonces.png`) });
    await o.pg.close();
  }

  // ── J : Ma journée ──────────────────────────────────────────────────────
  {
    const TITRE = `Vente JOURNEE ${nom} 5151`;
    const o = await ouvrir('journee');
    const t1 = Date.now();
    ecrireLigne(`harvest_${UID_V}_orders_sold`, (d) => { const v0 = d.payload.my_orders[0]; return { ...d, payload: { ...d.payload, my_orders: [{ ...v0, transaction_id: 22099999903, item_id: 7099999903, title: TITRE, date: new Date().toISOString(), status: 'Le paiement a été validé' }, ...d.payload.my_orders] } }; });
    let relue = null;
    while (Date.now() - t1 < MAX_MS + 5000) { const l = bilan(o.reqs, t1).lourdes.filter((r) => idsDe(r.u).some((i) => i.includes(UID_V))); if (l.length) { relue = l[0].t - t1; break; } await attendre(250); }
    juge(relue != null && relue < MAX_MS, `[${nom}] J : Ma journée relit la ligne changée sans recharger`, relue != null ? `${(relue / 1000).toFixed(1)} s` : 'jamais');
    await o.pg.waitForTimeout(2500);
    const vu = (await texte(o.pg)).includes(TITRE);
    console.log(`  [${nom}] J : la vente ${vu ? 'est montrée' : "n'est pas listée par Ma journée (l'écran montre des compteurs)"}`);
    await o.pg.screenshot({ path: path.join(CAPT, `temps-reel-${nom}-journee.png`) });
    await o.pg.close();
  }
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const passes = (process.env.PASSES || '390,1512').split(',');
  for (const p of passes) {
    if (p === '390') await passe(b, { nom: '390', largeur: 390, hauteur: 844, mobile: true, sombre: false });
    if (p === '1512') await passe(b, { nom: '1512', largeur: 1512, hauteur: 945, mobile: false, sombre: true });
    if (p === '390s') await passe(b, { nom: '390s', largeur: 390, hauteur: 844, mobile: true, sombre: true });
    if (p === '1512c') await passe(b, { nom: '1512c', largeur: 1512, hauteur: 945, mobile: false, sombre: false });
  }
  await b.close(); srv.close();
  console.log(`\n${verts} verts, ${rouges} rouges`);
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.error(e); try { srv.close(); } catch (_) {} process.exit(2); });
