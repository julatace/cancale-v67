// ════════════════════════════════════════════════════════════════════════════
//  Banc « ouverture légère » (10 nov., lot K, src/copieLignes.js).
//  node scripts/bancs/ouverture-legere.cjs [dist] [port]
//  Un appareil (un contexte de navigateur) ouvre VRM plusieurs fois sur Ventes, base
//  inventée au poids réel (_base-volume, aucune donnée réelle), et on COMPTE ce qui
//  part : lectures, octets, et surtout les lignes LOURDES (commandes, dressings,
//  boîtes de réception, projetées avec leur `payload`).
//   A  2e ouverture, rien changé ⇒ aucune ligne lourde téléchargée (versions seules)
//   R  une ligne changée (`data.rev`) ⇒ elle SEULE est relue, et l'écran la montre
//   K  lecture des versions ET des lignes en panne ⇒ « Vu à hh:mm · pas relu »,
//      la copie reste sur l'appareil, rien de la copie n'est montré comme frais,
//      aucune écriture n'en part
//   C  un autre compte VRM sur l'appareil ⇒ rien de l'autre : tout relu, copies à lui seul
//  Deux passes : 390 px tactile (clair) et 1512 px (sombre). Captures dans
//  scripts/bancs/captures/ouverture-legere-*.png. Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const DIST = process.argv[2] || path.join(RACINE, 'dist');
const PORT = +(process.argv[3] || process.env.BANC_PORT || 9640);
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
const LOURDE = /harvest_(\d+|\*)_(orders_(sold|purchased|\*d)|listings|inbox)\b/;
const estLourde = (u) => { const d = dec(u); return /[?&]id=/.test(d) && LOURDE.test(d.split('&select=')[0]) && /payload:data->payload/.test(d); };
const estVersion = (u) => /rev:data->>rev/.test(dec(u));
const idsDe = (u) => { const m = /[?&]id=in\.\(([^)]*)\)/.exec(dec(u)); return m ? m[1].split(',') : (/[?&]id=eq\.([^&]+)/.exec(dec(u)) || [])[1] ? [/[?&]id=eq\.([^&]+)/.exec(dec(u))[1]] : ['*motif*']; };
const UID_A = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', UID_B = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c';
const TITRE_NEUF = 'Paire REVCHANGEE 4242';

async function passe(b, { nom, largeur, hauteur, mobile, sombre }) {
  const base = fabriquer({ volumeReel: true });
  const etat = { panne: false };
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: largeur, height: hauteur }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light' });
  await ctx.addInitScript((sombre) => {
    try { if (!localStorage.getItem('vrm_acces_direct')) localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {}
  }, !!sombre);
  async function ouvrir(etiquette, avant) {
    const pg = await ctx.newPage();
    const reqs = []; const t0 = Date.now();
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    await pg.route('**/rest/v1/**', async (route) => {
      const rq = route.request(); const rec = { t: Date.now() - t0, m: rq.method(), u: rq.url(), o: 0 };
      reqs.push(rec);
      if (rq.method() !== 'GET') { rec.corps = rq.postData() || ''; return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
      if (etat.panne && LOURDE.test(dec(rq.url()).split('&select=')[0])) { rec.panne = true; return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"banc : panne"}' }); }
      const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
      const body = JSON.stringify(rep.body); rec.o = Buffer.byteLength(body);
      await attendre(40);
      return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body });
    });
    await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    if (avant) await avant(pg);
    await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'commit' });
    const fin = Date.now() + 60000; let pret = null;
    while (Date.now() < fin) {
      const e = await pg.evaluate(() => { const ae = document.querySelector('[data-attente]'); return (document.getElementById('vrm-demarrage') ? 'D' : '') + (ae ? ae.getAttribute('data-attente') : '-'); }).catch(() => '?');
      if (e === 'pret' || e === 'plafond') { pret = Date.now() - t0; break; }
      await attendre(100);
    }
    let n = reqs.length, calme = Date.now();
    while (Date.now() - calme < 3000 && Date.now() < fin + 20000) { await attendre(250); if (reqs.length !== n) { n = reqs.length; calme = Date.now(); } }
    const lec = reqs.filter((r) => r.m === 'GET');
    const lourdes = lec.filter((r) => estLourde(r.u));
    const res = { etiquette, pret, lectures: lec.length, Ko: Math.round(lec.reduce((a, r) => a + r.o, 0) / 1024),
      lourdesN: lourdes.length, lourdesKo: Math.round(lourdes.reduce((a, r) => a + r.o, 0) / 1024),
      versionsN: lec.filter((r) => estVersion(r.u)).length, versionsKo: Math.round(lec.filter((r) => estVersion(r.u)).reduce((a, r) => a + r.o, 0) / 1024),
      idsLourds: [...new Set(lourdes.flatMap((r) => idsDe(r.u)))], ecritures: reqs.filter((r) => r.m !== 'GET') };
    console.log(`  [${nom}] ${etiquette} : prêt ${pret} ms · ${res.lectures} lectures · ${res.Ko} Ko · lourdes ${res.lourdesN} (${res.lourdesKo} Ko) · versions ${res.versionsN} (${res.versionsKo} Ko)`);
    return { pg, res };
  }
  const copiesIdb = (pg) => pg.evaluate(() => new Promise((ok) => { try { const rq = indexedDB.open('vrm_copies'); rq.onsuccess = () => { const db = rq.result; if (!db.objectStoreNames.contains('lignes')) { db.close(); return ok([]); } const t = db.transaction('lignes', 'readonly').objectStore('lignes').getAll(); t.onsuccess = () => { const v = (t.result || []).map((e) => ({ uid: e.uid, id: e.id, k: e.k, pdf: /pdfB64/.test(JSON.stringify(e.row || {})) })); db.close(); ok(v); }; t.onerror = () => { db.close(); ok(null); }; }; rq.onerror = () => ok(null); } catch (_) { ok(null); } }));
  const texteEcranVrai = (pg) => pg.evaluate(() => { const c = [...document.querySelectorAll('.vrm-attente > div')].find((d) => !d.hasAttribute('data-attente-instantane-cadre') && !d.classList.contains('vrm-attente-cache')); return c ? c.innerText : ''; });

  // 1 — première ouverture sur l'appareil.
  const o1 = await ouvrir('1re');
  const idb1 = await copiesIdb(o1.pg);
  juge(Array.isArray(idb1) && idb1.length > 0 && idb1.every((e) => e.uid === UID_A), `[${nom}] 1re ouverture : les listes lourdes sont gardées pour CE compte`, `${idb1 ? idb1.length : 'illisible'} lignes`);
  juge(Array.isArray(idb1) && !idb1.some((e) => e.pdf), `[${nom}] aucune copie ne porte de PDF`);
  await o1.pg.close();

  // A — 2e ouverture, rien n'a changé.
  const o2 = await ouvrir('2e');
  juge(o2.res.lourdesKo === 0 && o2.res.lourdesN === 0, `[${nom}] A : 2e ouverture, versions identiques ⇒ aucune ligne lourde téléchargée`, `${o2.res.lourdesN} lectures lourdes, ${o2.res.lourdesKo} Ko`);
  juge(o2.res.versionsN >= 1 && o2.res.versionsKo <= 20, `[${nom}] A : seules les versions sont demandées (scalaires)`, `${o2.res.versionsN} lectures, ${o2.res.versionsKo} Ko`);
  juge(o2.res.Ko < o1.res.Ko - 1000, `[${nom}] A : la 2e ouverture lit au moins 1 Mo de moins`, `${o1.res.Ko} → ${o2.res.Ko} Ko`);
  juge(!o2.res.ecritures.some((w) => /harvest_/.test(w.u) || /harvest_/.test(w.corps || '')), `[${nom}] A : aucune écriture de moisson ne part de la copie`);
  const t2 = await texteEcranVrai(o2.pg);
  juge(/Nike samba/i.test(t2), `[${nom}] A : Ventes montre les ventes (servies par la copie confirmée)`);
  await o2.pg.screenshot({ path: path.join(CAPT, `ouverture-legere-${nom}-2e.png`) });
  await o2.pg.close();

  // R — une ligne change chez le serveur (`data.rev` + 1, une vente de plus).
  const cible = base.rows.find((r) => r.id === 'harvest_3150000000_orders_sold');
  const v0 = JSON.parse(JSON.stringify(cible.data.payload.my_orders[0]));
  cible.data = { ...cible.data, rev: (Number(cible.data.rev) || 0) + 1, payload: { ...cible.data.payload, my_orders: [{ ...v0, transaction_id: 22099999999, item_id: 7099999999, title: TITRE_NEUF, date: new Date().toISOString(), status: 'Commande finalisée' }, ...cible.data.payload.my_orders] } };
  const o3 = await ouvrir('rev changée');
  juge(o3.res.idsLourds.length === 1 && o3.res.idsLourds[0] === cible.id, `[${nom}] R : seule la ligne changée est relue`, o3.res.idsLourds.join(','));
  const t3 = await texteEcranVrai(o3.pg);
  juge(t3.includes(TITRE_NEUF), `[${nom}] R : la vente neuve est à l'écran`);
  await o3.pg.close();

  // K — lecture ratée (versions ET lignes) : la copie reste, « pas relu », rien de frais.
  etat.panne = true;
  const o4 = await ouvrir('lecture KO');
  await o4.pg.waitForSelector('[data-copie-pas-relu]', { timeout: 8000 }).catch(() => {});
  const mention = await o4.pg.evaluate(() => { const e = document.querySelector('[data-copie-pas-relu]'); return e ? { t: e.innerText, n: +e.getAttribute('data-copie-pas-relu'), vu: e.getAttribute('data-copie-vu') } : null; });
  juge(!!mention && /pas relu/.test(mention.t) && /Vu à \d{2}:\d{2}/.test(mention.t), `[${nom}] K : « Vu à hh:mm · pas relu » dit`, mention ? mention.t : 'absente');
  const idb4 = await copiesIdb(o4.pg);
  juge(Array.isArray(idb4) && idb4.length >= idb1.length, `[${nom}] K : la copie reste sur l'appareil (jamais vidée)`, `${idb4 ? idb4.length : '?'} lignes`);
  const t4 = await texteEcranVrai(o4.pg);
  juge(!t4.includes(TITRE_NEUF), `[${nom}] K : rien de la copie n'est présenté comme frais (la vente gardée n'est pas montrée comme lue)`);
  juge(!o4.res.ecritures.some((w) => (w.corps || '').includes('REVCHANGEE') || /harvest_/.test(w.u)), `[${nom}] K : aucune écriture ne part de la copie`);
  await o4.pg.screenshot({ path: path.join(CAPT, `ouverture-legere-${nom}-pas-relu.png`) });
  await o4.pg.close();
  etat.panne = false;

  // C — un autre compte VRM se connecte sur le même appareil.
  const o5 = await ouvrir('autre compte', async (pg) => {
    await pg.addInitScript((uid) => { try { if (!sessionStorage.getItem('__autre')) { sessionStorage.setItem('__autre', '1'); const s = JSON.parse(localStorage.getItem('vrm_session') || 'null'); if (s && s.user) { s.user = { ...s.user, id: uid, email: 'autre@vrm.test' }; Storage.prototype.setItem.call(localStorage, 'vrm_session', JSON.stringify(s)); } } } catch (_) {} }, UID_B);
  });
  juge(o5.res.lourdesKo > 500, `[${nom}] C : autre compte ⇒ aucune copie de l'autre servie (tout relu)`, `${o5.res.lourdesKo} Ko lourds relus`);
  const idb5 = await copiesIdb(o5.pg);
  juge(Array.isArray(idb5) && idb5.length > 0 && idb5.every((e) => e.uid === UID_B), `[${nom}] C : sur l'appareil, seulement les copies du compte connecté`, idb5 ? [...new Set(idb5.map((e) => e.uid.slice(0, 4)))].join(',') : '?');
  const m5 = await o5.pg.$('[data-copie-pas-relu]');
  juge(!m5, `[${nom}] C : aucune mention « pas relu » héritée`);
  await o5.pg.close();
  await ctx.close();
  return { o1: o1.res, o2: o2.res };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const passes = (process.env.PASSES || '390,1512').split(',');
  for (const p of passes) {
    if (p === '390') await passe(b, { nom: '390', largeur: 390, hauteur: 844, mobile: true, sombre: false });
    if (p === '1512') await passe(b, { nom: '1512', largeur: 1512, hauteur: 945, mobile: false, sombre: true });
  }
  await b.close(); srv.close();
  console.log(`\n${verts} verts, ${rouges} rouges`);
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.error(e); try { srv.close(); } catch (_) {} process.exit(2); });
