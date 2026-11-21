// ════════════════════════════════════════════════════════════════════════════
//  PARCOURS DE TOUS LES ÉCRANS, À LA RECHERCHE D'UNE ERREUR (19 nov. — Julien : « la chose la plus importante est que
//  l'app ne bug plus »).
//
//    node scripts/bancs/parcours-erreurs.cjs [dist] [port]
//    BASES=volume,vide,panne (défaut : les trois) · TAILLES=390,1512 · ECRANS=journee,ventes (défaut : tous)
//    SHOTS=<dossier> (une capture par écran fautif) · JSON=<fichier>
//
//  Ouvre CHAQUE écran et sous-écran que `?tab=` sait ouvrir (la liste `ONGLETS_LIENS` de src/App.jsx, lue dans la
//  source — un écran ajouté demain est parcouru sans toucher ce banc), puis les segments et sous-écrans joignables
//  d'un toucher (les boutons `[data-seg]`, `[role="tab"]` et les sections de Paramètres), sur trois bases :
//    · volume : la base inventée au poids de la sienne (_base-volume) ;
//    · vide   : un vendeur NEUF (aucun compte, aucune ligne) ;
//    · panne  : toutes les lectures de la base répondent 503.
//  et relève, par écran : erreur JavaScript, promesse rejetée, erreur console (dont les erreurs React minifiées),
//  garde-fou d'erreur affiché (`[data-garde-ecran]`), écran BLANC (zone principale sans texte ni image après le calme),
//  requête EN BOUCLE (la même adresse plus de 6 fois sur l'écran, ou des lectures qui ne s'arrêtent jamais).
//  Le bruit connu n'est pas une erreur : photos coupées par le banc, `vrm-hors-ligne`, requêtes abandonnées en
//  quittant un écran. Rien de réel ; aucune écriture ne sort. Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const DIST = process.argv[2] || path.join(RACINE, 'dist'), PORT = +(process.argv[3] || process.env.BANC_PORT || (22000 + Math.floor(Math.random() * 6000)));
const BASES = (process.env.BASES || 'volume,vide,panne').split(',');
const TAILLES = (process.env.TAILLES || '390,1512').split(',');
const SHOTS = process.env.SHOTS || '';
// Les écrans : `ONGLETS_LIENS` de la source (les clés de CHEMINS_ARGENT comprises), sans les alias purs.
function ecransDeLaSource() {
  const src = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = src.match(/const ONGLETS_LIENS=\[([^\]]*)\]/); const l = m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : [];
  let argent = []; try { const a = fs.readFileSync(path.join(RACINE, 'src', 'argent.js'), 'utf8'); const c = a.match(/CHEMINS_ARGENT\s*=\s*\{([\s\S]*?)\}/); if (c) argent = [...c[1].matchAll(/['"]?([a-z_]+)['"]?\s*:/g)].map((x) => x[1]); } catch (_) {}
  return [...new Set([...l, ...argent])];
}
const ECRANS = process.env.ECRANS ? process.env.ECRANS.split(',') : ecransDeLaSource();
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.json': 'application/json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const gz = new Map();
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream';
  if (/javascript|css|html|json|svg/.test(t)) { if (!gz.has(p)) gz.set(p, zlib.gzipSync(fs.readFileSync(p))); r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip' }); r.end(gz.get(p)); }
  else { r.writeHead(200, { 'content-type': t }); r.end(fs.readFileSync(p)); }
}).listen(PORT);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const BRUIT = /net::ERR_(ABORTED|FAILED|BLOCKED_BY_CLIENT|INTERNET_DISCONNECTED)|Failed to load resource|vrm-hors-ligne|favicon|ResizeObserver loop|the server responded with a status of 503|Failed to fetch|Load failed|NetworkError/i;
const baseVolume = fabriquer({ volumeReel: true, qr: true });
const trouvailles = [];
const noter = (t) => { trouvailles.push(t); console.log(`  ❌ [${t.base} · ${t.taille}] ${t.ecran}${t.sous ? ' › ' + t.sous : ''} — ${t.sorte} : ${String(t.detail).slice(0, 300)}`); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  console.log(`${ECRANS.length} écrans × ${BASES.length} base(s) × ${TAILLES.length} taille(s) — build ${DIST}`);
  for (const nomBase of BASES) for (const taille of TAILLES) {
    const tel = taille === '390';
    const ctx = await b.newContext({ serviceWorkers: 'block', viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, isMobile: tel, hasTouch: tel });
    await ctx.addInitScript(() => { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
      window.__rejets = []; window.addEventListener('unhandledrejection', (e) => { try { window.__rejets.push(String((e.reason && (e.reason.stack || e.reason.message)) || e.reason).slice(0, 400)); } catch (_) {} }); });
    const pg = await ctx.newPage();
    let ici = { ecran: '(démarrage)', sous: '' };
    const reqs = [];
    pg.on('pageerror', (e) => noter({ base: nomBase, taille, ...ici, sorte: 'erreur JavaScript', detail: (e.stack || e.message || '').split('\n').slice(0, 3).join(' ⏎ ') }));
    pg.on('console', (m) => { if (m.type() !== 'error') return; const t = m.text(); if (BRUIT.test(t)) return; noter({ base: nomBase, taille, ...ici, sorte: 'erreur console', detail: t }); });
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/\.(jpe?g|png|webp)(\?|$)/i.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }) : r.abort()));
    await pg.route('**/rest/v1/**', async (route) => {
      const rq = route.request(); reqs.push({ t: Date.now(), m: rq.method(), u: decodeURIComponent(rq.url()).replace(/^.*\/rest\/v1\//, '') });
      if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
      if (nomBase === 'panne') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"panne du banc"}' });
      if (nomBase === 'vide') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' });
      const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, baseVolume);
      return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) });
    });
    await pg.route('**/api/**', (r) => (nomBase === 'panne' ? r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })));
    // Le calme : aucune lecture depuis `ms` (borné) ; rend le nombre de lectures de la fenêtre et si elles continuaient.
    const calme = async (ms = 1500, max = 20000) => { const f = Date.now() + max; let n = reqs.length, tc = Date.now(); while (Date.now() - tc < ms && Date.now() < f) { await attendre(200); if (reqs.length !== n) { n = reqs.length; tc = Date.now(); } } return Date.now() >= f; };
    const juger = async (i0) => {
      const sansFin = await calme();
      const e = await pg.evaluate(() => {
        const m = document.querySelector('.vrm-app-shell > .vrm-main') || document.querySelector('.vrm-main') || document.body;
        const garde = [...document.querySelectorAll('[data-garde-ecran]')].filter((x) => x.getClientRects().length).map((x) => (x.getAttribute('data-garde-ecran') || '') + ' : ' + (x.innerText || '').replace(/\s+/g, ' ').slice(0, 160));
        const texte = (m.innerText || '').replace(/\s+/g, ' ').trim();
        const images = [...m.querySelectorAll('img, svg, canvas')].filter((x) => x.getClientRects().length).length;
        const r = window.__rejets.splice(0);
        return { coque: !!document.querySelector('.vrm-app-shell'), demarrage: !!document.getElementById('vrm-demarrage'), garde, texte: texte.length, images, rejets: r, connexion: !!document.querySelector('input[type="password"]') };
      }).catch((x) => ({ erreur: String(x) }));
      const lot = reqs.slice(i0).filter((r) => r.m === 'GET');
      const par = new Map(); for (const r of lot) par.set(r.u, (par.get(r.u) || 0) + 1);
      const boucles = [...par].filter(([, n]) => n > 6).map(([u, n]) => n + '× ' + u.slice(0, 140));
      return { e, sansFin, boucles, lectures: lot.length };
    };
    const rapporter = async (v, nom) => {
      const { e, sansFin, boucles } = v;
      if (!e || e.erreur) { noter({ base: nomBase, taille, ...ici, sorte: 'page morte', detail: e && e.erreur }); return; }
      for (const g of e.garde) noter({ base: nomBase, taille, ...ici, sorte: 'garde-fou d’erreur affiché', detail: g });
      for (const r of e.rejets) if (!BRUIT.test(r)) noter({ base: nomBase, taille, ...ici, sorte: 'promesse rejetée', detail: r });
      if (!e.coque || e.demarrage || (e.texte < 12 && e.images < 1)) noter({ base: nomBase, taille, ...ici, sorte: 'écran blanc', detail: JSON.stringify({ coque: e.coque, demarrage: e.demarrage, texte: e.texte, images: e.images, connexion: e.connexion }) });
      for (const x of boucles) noter({ base: nomBase, taille, ...ici, sorte: 'requête en boucle', detail: x });
      if (sansFin && nomBase !== 'panne') noter({ base: nomBase, taille, ...ici, sorte: 'lectures sans fin (20 s)', detail: [...new Set(reqs.slice(-12).map((r) => r.u.slice(0, 90)))].join(' | ') });
      if (SHOTS && trouvailles.length && trouvailles[trouvailles.length - 1].ecran === ici.ecran) { try { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `${nomBase}-${taille}-${nom.replace(/[^a-z0-9_-]/gi, '_')}.png`) }); } catch (_) {} }
    };
    const t0 = Date.now(); let n = 0;
    for (const ecran of ECRANS) {
      ici = { ecran, sous: '' }; const i0 = reqs.length;
      // Le premier écran charge la page ; les suivants passent par le lien interne (`vrm:aller`), comme une notification.
      if (!n) { await pg.goto(`http://localhost:${PORT}/?tab=${ecran}`, { waitUntil: 'commit' }).catch(() => {}); const f = Date.now() + 120000; while (Date.now() < f && !(await pg.evaluate(() => !!document.querySelector('.vrm-app-shell') && !document.getElementById('vrm-demarrage')).catch(() => false))) await attendre(250); }
      else await pg.evaluate((t) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=' + t })), ecran).catch(() => {});
      n++; await attendre(700);
      await rapporter(await juger(i0), ecran);
      // Les sous-écrans d'un toucher : segments et onglets internes (bornés, sans geste qui écrit).
      const sous = await pg.evaluate(() => { const m = document.querySelector('.vrm-app-shell > .vrm-main'); if (!m) return []; const vus = new Set(); const l = [];
        for (const el of m.querySelectorAll('[role="tab"]:not([aria-selected="true"]), [data-seg]:not([aria-pressed="true"]):not([aria-current]), .vrm-segmente button:not([aria-pressed="true"]):not([aria-selected="true"])')) { if (!el.getClientRects().length || el.disabled) continue; const t = (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40); if (!t || vus.has(t)) continue; vus.add(t); el.setAttribute('data-banc-sous', String(l.length)); l.push(t); if (l.length >= 8) break; }
        return l; }).catch(() => []);
      for (let k = 0; k < sous.length; k++) {
        ici = { ecran, sous: sous[k] }; const i1 = reqs.length;
        const el = pg.locator(`[data-banc-sous="${k}"]`).first();
        if (!(await el.count().catch(() => 0))) continue;
        await el.click({ timeout: 3000 }).catch(() => {});
        await attendre(500);
        await rapporter(await juger(i1), ecran + '-' + k);
        await pg.keyboard.press('Escape').catch(() => {});
      }
    }
    console.log(`[${nomBase} · ${taille}] ${n} écrans parcourus en ${Math.round((Date.now() - t0) / 1000)} s · ${reqs.length} requêtes`);
    await ctx.close();
  }
  await b.close(); srv.close();
  // Le bilan : par sorte et par message (un même défaut sur 40 écrans est UN défaut).
  const par = new Map();
  for (const t of trouvailles) { const k = t.sorte + ' — ' + String(t.detail).replace(/\d+/g, 'N').slice(0, 140); const o = par.get(k) || { n: 0, ou: new Set() }; o.n++; o.ou.add(`${t.base}/${t.taille}/${t.ecran}${t.sous ? '›' + t.sous : ''}`); par.set(k, o); }
  console.log(`\n══ BILAN : ${trouvailles.length} relevé(s), ${par.size} défaut(s) distinct(s)`);
  for (const [k, o] of [...par].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${o.n}× ${k}\n      où : ${[...o.ou].slice(0, 8).join(' · ')}${o.ou.size > 8 ? ' … (' + o.ou.size + ')' : ''}`);
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(trouvailles, null, 1));
  process.exit(trouvailles.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
