// ════════════════════════════════════════════════════════════════════════════
//  Banc « ouverture légère 2 » (11 nov., src/copieLignes.js `lireFamilleAvecCopie`,
//  src/annoncesInstantanee.js).
//  node scripts/bancs/ouverture-legere-2.cjs [dist] [port]
//  Un appareil ouvre VRM plusieurs fois sur Annonces, base inventée au poids réel
//  (_base-volume, aucune donnée réelle). On compte ce qui part pour les deux
//  FAMILLES gardées : les transactions (`like.harvest_%_txn_%`) et la fraîcheur des
//  comptes (`like.harvest_*`) — lecture ENTIÈRE (sans `or=` ni `limit=1`) ou version
//  (le nombre + les lignes écrites depuis).
//   1  1re ouverture : les deux familles gardées pour CE compte, sans PDF
//   A  2e ouverture, rien changé ⇒ aucune lecture entière, versions seules ; et
//      l'instantané d'Annonces montré pendant l'attente (inerte, sans photo ni
//      lien), puis remplacé par l'écran vrai
//   R  une transaction réécrite ⇒ reçue dans les lignes écrites, la copie la garde fraîche
//   D  une transaction partie ⇒ famille relue entière (le nombre ne tombe pas juste)
//   K  versions ET lectures en panne ⇒ « Vu à hh:mm · pas relu », copie gardée,
//      jamais servie, aucune écriture
//   C  un autre compte VRM ⇒ tout relu, copies à lui seul, l'instantané de l'autre jamais montré
//  Passes : 390 px tactile clair, 1512 px sombre. Captures : scripts/bancs/captures/ouverture-legere-2-*.png.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const DIST = process.argv[2] || path.join(RACINE, 'dist');
const PORT = +(process.argv[3] || process.env.BANC_PORT || 9641);
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
const requete = (u) => dec(u).replace(/^.*\/rest\/v1\/app_data\?/, '');
// La famille d'une lecture : 'txn', 'captures' ou null.
const familleDe = (u) => { const q = requete(u); if (/^id=like\.harvest_%_txn_%&/.test(q) && !/country_code/.test(q)) return 'txn'; if (/^id=like\.harvest_\*&meta->>supprime=is\.null/.test(q)) return 'captures'; return null; };
const genre = (u) => { const q = requete(u); return /&limit=1(&|$)/.test(q) ? 'compte' : /&or=\(updated_at\.gte\./.test(q) ? 'depuis' : 'entiere'; };
const UID_A = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', UID_B = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c';
const TX_CIBLE = 'harvest_3150000000_txn_22000000001';

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
      const rq = route.request(); const rec = { t: Date.now() - t0, m: rq.method(), u: rq.url(), o: 0, f: familleDe(rq.url()) };
      reqs.push(rec);
      if (rq.method() !== 'GET') { rec.corps = rq.postData() || ''; return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
      if (etat.panne && rec.f) { rec.panne = true; return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"banc : panne"}' }); }
      const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
      const body = JSON.stringify(rep.body); rec.o = Buffer.byteLength(body); rec.corpsRep = rec.f ? body : '';
      await attendre(40);
      return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body });
    });
    await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    if (avant) await avant(pg);
    await pg.goto(`http://localhost:${PORT}/?tab=annonces`, { waitUntil: 'commit' });
    const fin = Date.now() + 60000; let pret = null; let inst = null;
    while (Date.now() < fin) {
      const e = await pg.evaluate(() => {
        const ae = document.querySelector('[data-attente]'); const i = document.querySelector('[data-inst-ecran="annonces"]');
        return { a: (document.getElementById('vrm-demarrage') ? 'D' : '') + (ae ? ae.getAttribute('data-attente') : '-'),
          i: i ? { n: i.querySelectorAll('[data-inst-annonce]').length, inert: i.hasAttribute('inert'), img: i.querySelectorAll('img').length, liens: i.querySelectorAll('a[href]').length, bg: /url\(/.test(i.innerHTML), mention: !!i.querySelector('[data-inst-mention]'), texte: i.innerText.slice(0, 400) } : null };
      }).catch(() => ({ a: '?', i: null }));
      if (e.i && !inst) { inst = e.i; if (etiquette === '2e') await pg.screenshot({ path: path.join(CAPT, `ouverture-legere-2-${nom}-instantane.png`) }).catch(() => {}); }
      if (e.a === 'pret' || e.a === 'plafond') { pret = Date.now() - t0; break; }
      await attendre(60);
    }
    let n = reqs.length, calme = Date.now();
    while (Date.now() - calme < 3000 && Date.now() < fin + 20000) { await attendre(250); if (reqs.length !== n) { n = reqs.length; calme = Date.now(); } }
    const lec = reqs.filter((r) => r.m === 'GET');
    const fam = lec.filter((r) => r.f);
    const par = (f, g) => fam.filter((r) => r.f === f && genre(r.u) === g);
    const res = { etiquette, pret, inst, Ko: Math.round(lec.reduce((a, r) => a + r.o, 0) / 1024), famKo: Math.round(fam.reduce((a, r) => a + r.o, 0) / 1024),
      entieres: { txn: par('txn', 'entiere'), captures: par('captures', 'entiere') }, comptes: fam.filter((r) => genre(r.u) === 'compte'), depuis: fam.filter((r) => genre(r.u) === 'depuis'),
      ecritures: reqs.filter((r) => r.m !== 'GET') };
    console.log(`  [${nom}] ${etiquette} : prêt ${pret} ms · ${lec.length} lectures · ${res.Ko} Ko · familles ${fam.length} lectures ${res.famKo} Ko (entières txn ${res.entieres.txn.length}, captures ${res.entieres.captures.length} ; nombres ${res.comptes.length} ; écrites depuis ${res.depuis.length})`);
    return { pg, res };
  }
  const copiesIdb = (pg) => pg.evaluate(() => new Promise((ok) => { try { const rq = indexedDB.open('vrm_copies'); rq.onsuccess = () => { const db = rq.result; if (!db.objectStoreNames.contains('lignes')) { db.close(); return ok([]); } const t = db.transaction('lignes', 'readonly').objectStore('lignes').getAll(); t.onsuccess = () => { const v = (t.result || []).map((e) => ({ uid: e.uid, f: e.f, id: e.id, n: e.row && Array.isArray(e.row.rows) ? e.row.rows.length : null, rows: e.f === 'txn' ? e.row.rows : null, pdf: /pdfB64/.test(JSON.stringify(e.row || {})) })); db.close(); ok(v); }; t.onerror = () => { db.close(); ok(null); }; }; rq.onerror = () => ok(null); } catch (_) { ok(null); } }));
  const familles = (idb) => (Array.isArray(idb) ? idb.filter((e) => e.id === '*') : []);
  const instantaneLS = (pg) => pg.evaluate(() => { const k = Object.keys(localStorage).filter((x) => x.startsWith('vrm_annonces_instantane:')); return k.map((x) => ({ k: x, v: localStorage.getItem(x) })); });

  // 1 — première ouverture sur l'appareil.
  const o1 = await ouvrir('1re');
  let ls1 = []; for (let i = 0; i < 40 && !ls1.length; i++) { ls1 = await instantaneLS(o1.pg); if (!ls1.length) await attendre(500); }
  const idb1 = await copiesIdb(o1.pg);
  const f1 = familles(idb1);
  juge(f1.length === 2 && f1.every((e) => e.uid === UID_A) && f1.some((e) => e.f === 'txn' && e.n > 1000) && f1.some((e) => e.f === 'captures' && e.n > 1000), `[${nom}] 1 : les deux familles gardées pour CE compte`, f1.map((e) => `${e.f}:${e.n}`).join(' '));
  juge(f1.length > 0 && !f1.some((e) => e.pdf), `[${nom}] 1 : aucune copie de famille ne porte de PDF`);
  juge(o1.res.entieres.txn.length >= 1 && o1.res.entieres.captures.length >= 1, `[${nom}] 1 : 1re ouverture, familles lues entières (rien sur l'appareil)`);
  juge(ls1.length === 1 && ls1[0].k === 'vrm_annonces_instantane:' + UID_A, `[${nom}] 1 : l'instantané d'Annonces est rangé pour CE compte (clé vrm_)`, ls1.map((x) => x.k).join(','));
  const v1 = ls1[0] ? ls1[0].v : '';
  juge(!!v1 && !/vinted\.net|https?:|"photo|items\/7\d{9}|vendeur_\d/.test(v1), `[${nom}] 1 : l'instantané ne range ni photo, ni lien, ni identifiant, ni nom de compte`);
  await o1.pg.close();

  // A — 2e ouverture, rien n'a changé.
  const o2 = await ouvrir('2e');
  juge(o2.res.entieres.txn.length === 0 && o2.res.entieres.captures.length === 0, `[${nom}] A : aucune famille relue entière`, `txn ${o2.res.entieres.txn.length}, captures ${o2.res.entieres.captures.length}`);
  juge(o2.res.comptes.length >= 2 && o2.res.depuis.length >= 2, `[${nom}] A : la version est lue (nombre + lignes écrites depuis)`, `${o2.res.comptes.length} nombres, ${o2.res.depuis.length} lectures « depuis »`);
  juge(o2.res.famKo <= 40 && o1.res.famKo >= 400, `[${nom}] A : familles ${o1.res.famKo} Ko → ${o2.res.famKo} Ko`);
  juge(!o2.res.ecritures.some((w) => /harvest_/.test(w.u) || /harvest_/.test(w.corps || '')), `[${nom}] A : aucune écriture de moisson ne part de la copie`);
  const I = o2.res.inst;
  juge(!!I && I.n >= 6, `[${nom}] A : l'instantané d'Annonces est montré pendant l'attente`, I ? `${I.n} annonces` : 'jamais vu');
  juge(!!I && I.inert && I.img === 0 && I.liens === 0 && !I.bg && I.mention, `[${nom}] A : inerte, sans photo ni lien, « Mis à jour … » dit`, I ? JSON.stringify({ inert: I.inert, img: I.img, liens: I.liens, bg: I.bg, mention: I.mention }) : '');
  const apres = await o2.pg.evaluate(() => ({ inst: !!document.querySelector('[data-inst-ecran="annonces"]:not(.vrm-attente-cache *)') && !!document.querySelector('.vrm-attente:not(.vrm-attente-cache) [data-inst-ecran="annonces"]'), vrai: document.querySelectorAll('[data-attente-ecran="annonces"] [data-carte-annonce]').length }));
  juge(!apres.inst && apres.vrai > 0, `[${nom}] A : puis l'écran vrai prend la place`, JSON.stringify(apres));
  await o2.pg.screenshot({ path: path.join(CAPT, `ouverture-legere-2-${nom}-2e.png`) });
  await o2.pg.close();

  // R — une transaction réécrite par l'extension (capture neuve, état « Annulée »).
  const cible = base.rows.find((r) => r.id === TX_CIBLE);
  cible.data = { ...cible.data, capturedAt: new Date().toISOString(), payload: { transaction: { ...cible.data.payload.transaction, status: 520, status_title: 'Annulée' } } };
  const o3 = await ouvrir('txn réécrite');
  const recue = o3.res.depuis.some((r) => r.f === 'txn' && r.corpsRep.includes(TX_CIBLE));
  juge(o3.res.entieres.txn.length === 0 && recue, `[${nom}] R : la transaction réécrite arrive seule (lignes écrites depuis), pas de relecture entière`);
  const idb3 = await copiesIdb(o3.pg);
  const rowR = (familles(idb3).find((e) => e.f === 'txn') || { rows: [] }).rows.find((r) => r.id === TX_CIBLE);
  juge(!!rowR && String(rowR.s) === '520', `[${nom}] R : la copie la garde fraîche (état 520)`, rowR ? String(rowR.s) : 'absente');
  await o3.pg.close();

  // D — une transaction partie (supprimée en base) : le nombre ne tombe pas juste ⇒ relue entière.
  const iD = base.rows.findIndex((r) => /^harvest_3150001111_txn_/.test(r.id));
  const ID_PARTIE = iD >= 0 ? base.rows[iD].id : '?';
  if (iD >= 0) base.rows.splice(iD, 1);
  const o4 = await ouvrir('txn partie');
  juge(o4.res.entieres.txn.length >= 1, `[${nom}] D : une ligne partie ⇒ la famille est relue entière`, `${o4.res.entieres.txn.length} lectures entières`);
  const idb4 = await copiesIdb(o4.pg);
  const fD = familles(idb4).find((e) => e.f === 'txn');
  juge(!!fD && !fD.rows.some((r) => r.id === ID_PARTIE), `[${nom}] D : la copie n'a plus la ligne partie`);
  await o4.pg.close();

  // K — versions ET lectures en panne.
  etat.panne = true;
  const o5 = await ouvrir('lecture KO');
  await o5.pg.waitForSelector('[data-copie-pas-relu]', { timeout: 8000 }).catch(() => {});
  const mention = await o5.pg.evaluate(() => { const e = document.querySelector('[data-copie-pas-relu]'); return e ? e.innerText : null; });
  juge(!!mention && /pas relu/.test(mention) && /Vu à \d{2}:\d{2}/.test(mention), `[${nom}] K : « Vu à hh:mm · pas relu » dit`, mention || 'absente');
  const fK = familles(await copiesIdb(o5.pg));
  juge(fK.length === 2, `[${nom}] K : la copie reste sur l'appareil (jamais vidée)`, fK.map((e) => e.f).join(','));
  juge(o5.res.entieres.txn.length >= 1, `[${nom}] K : version illisible ⇒ la lecture d'avant est tentée (jamais la copie)`);
  juge(!o5.res.ecritures.some((w) => /harvest_/.test(w.u) || /harvest_/.test(w.corps || '')), `[${nom}] K : aucune écriture ne part de la copie`);
  await o5.pg.screenshot({ path: path.join(CAPT, `ouverture-legere-2-${nom}-pas-relu.png`) });
  await o5.pg.close();
  etat.panne = false;

  // C — un autre compte VRM sur le même appareil.
  const o6 = await ouvrir('autre compte', async (pg) => {
    await pg.addInitScript((uid) => { try { if (!sessionStorage.getItem('__autre')) { sessionStorage.setItem('__autre', '1'); const s = JSON.parse(localStorage.getItem('vrm_session') || 'null'); if (s && s.user) { s.user = { ...s.user, id: uid, email: 'autre@vrm.test' }; Storage.prototype.setItem.call(localStorage, 'vrm_session', JSON.stringify(s)); } } } catch (_) {} }, UID_B);
  });
  juge(o6.res.entieres.txn.length >= 1 && o6.res.entieres.captures.length >= 1, `[${nom}] C : autre compte ⇒ familles relues entières (aucune copie de l'autre)`);
  const f6 = familles(await copiesIdb(o6.pg));
  juge(f6.length > 0 && f6.every((e) => e.uid === UID_B), `[${nom}] C : sur l'appareil, les copies du compte connecté seulement`);
  juge(!o6.res.inst, `[${nom}] C : l'instantané de l'autre compte n'est jamais montré`);
  await o6.pg.close();
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
