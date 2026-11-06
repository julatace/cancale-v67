require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  CHARGEMENT — ce que l'œil VOIT pendant qu'un écran s'ouvre (6 nov., Julien :
//  « Quand ça bug je ne veux pas que ça soit comme ça, les données apparaissent
//  de partout, je veux qu'il y ait de vrais écrans de chargement »).
//
//  Base INVENTÉE au volume de la sienne (`_base-volume.cjs`, aucune donnée réelle),
//  servie avec un aller-retour et un débit simulés ; les fichiers de l'app servis
//  compressés et passés par le réseau émulé de Chrome (4G, ou « lent »). Toutes les
//  100 ms, DANS la page, on note ce qui est à l'écran :
//    · le texte visible (innerText de #root — le texte `visibility:hidden` n'y est
//      pas) ; tant que l'écran de démarrage COUVRE la page, l'état est « démarrage » ;
//    · les décalages de mise en page (CLS, PerformanceObserver `layout-shift`) ;
//    · les lignes « lecture… / chargement » et « pas lu / pas su / non relevé ».
//  Par écran ouvert à froid on en tire :
//    · `changements` : combien de fois le texte visible a changé APRÈS le premier
//      contenu (une app qui arrive d'un bloc : 0 ou 1 ; des cartes qui arrivent une
//      à une : 10, 20…) ;
//    · `cls` : le décalage cumulé ;
//    · `pasLuTransitoires` : une ligne « pas lu / pas su / non relevé » vue puis
//      disparue (elle disait « pas su » d'une lecture qui n'avait PAS échoué : elle
//      était en cours) — doit être ZÉRO ; `lectureTransitoires` : les « lecture… /
//      chargement » vus puis disparus (imprimés) ;
//    · `stable` : l'instant du dernier changement visible (texte ou décalage),
//      depuis le début de la navigation ; `contenu` : le premier contenu montré.
//  Et « revenir sur un écran déjà vu » : Ma journée → Ventes → Ma journée par la
//  navigation ; au retour, aucun squelette et au plus un changement.
//
//  Lancer : npm run build && node scripts/bancs/chargement.cjs
//  `CHARGEMENT_COMBOS=390:4g:clair,1512:fibre:sombre` (largeur:réseau:thème ;
//  réseaux 4g · lent · fibre) ; `ECRANS=journee,ventes` ; `BANC_PORT` (11600) ;
//  `CHARGEMENT_JSON=fichier` écrit les mesures ; `CHARGEMENT_REFERENCE=fichier`
//  (les mesures d'AVANT) exige changements ÷ 3 et un écran stable pas plus tard ;
//  `CHARGEMENT_VIDEO=dossier` filme l'ouverture de Ma journée (390, 4G, clair) ;
//  `CHARGEMENT_SHOTS=dossier` garde la capture finale de chaque écran ;
//  `CHARGEMENT_PANNE=1` coupe aussi la lecture des ventes (503) : l'écran rend sa
//  panne UNE fois, jamais « pas su » puis contenu puis panne.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { fabriquer, repondre } = require('./_base-volume.cjs');
const DIST = process.env.CHARGEMENT_DIST ? path.resolve(process.env.CHARGEMENT_DIST) : path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 11600;
const UID_BANC = process.env.BANC_SESSION_UID || '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';

const PROFILS = {
  // Le profil « 4G lente » de Lighthouse (celui des mesures mobiles) ; la base : 150 ms, 2 Mo/s.
  '4g': { cdp: { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }, rtt: 150, debit: 2e6, max: 90000 },
  // Un réseau LENT (une 3G, un train) : 400 ms, 400 kbit/s ; la base 400 ms, 250 Ko/s.
  'lent': { cdp: { offline: false, latency: 400, downloadThroughput: 400e3 / 8, uploadThroughput: 400e3 / 8 }, rtt: 400, debit: 250e3, max: 180000 },
  // L'ordinateur sur une bonne ligne.
  'fibre': { cdp: null, rtt: 40, debit: 20e6, max: 60000 },
};
const COMBOS = (process.env.CHARGEMENT_COMBOS || '390:4g:clair,390:lent:sombre,1512:fibre:sombre,1512:4g:clair').split(',').map((s) => {
  const [w, reseau, theme] = s.split(':'); return { w: Number(w), reseau, theme, nom: s };
});
const ECRANS_TOUS = ['journee', 'ventes', 'annonces', 'cat_bord', 'achats', 'messages', 'garage', 'compta'];
const ECRANS = process.env.ECRANS ? process.env.ECRANS.split(',') : ECRANS_TOUS;
const REFERENCE = process.env.CHARGEMENT_REFERENCE ? JSON.parse(fs.readFileSync(process.env.CHARGEMENT_REFERENCE, 'utf8')) : null;
const VIDEO = process.env.CHARGEMENT_VIDEO || '';
const SHOTS = process.env.CHARGEMENT_SHOTS || '';
const PANNE = process.env.CHARGEMENT_PANNE === '1';

const base = fabriquer({ volumeReel: true });
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
const UIDS_LIES = base.accounts.map((a) => String(a.vinted_user_id));

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const _gz = new Map();
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const ext = path.extname(p);
  if (/^\.(js|css|html|json|webmanifest|svg)$/.test(ext) && /gzip/.test(q.headers['accept-encoding'] || '')) {
    if (!_gz.has(p)) _gz.set(p, zlib.gzipSync(fs.readFileSync(p), { level: 9 }));
    const b = _gz.get(p);
    r.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': b.length, 'cache-control': 'no-store' }); return r.end(b);
  }
  r.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

// ── L'ENREGISTREUR, DANS LA PAGE (avant tout script de l'app) ─────────────────
function enregistreur() {
  const R = window.__chg = { ech: [], cls: 0, shifts: [], textes: {}, lignes: {}, nav: [] };
  const PASLU = /\bpas (encore )?lu(e|es|s)?\b|\bpas su\b|non relev[ée]|n.a pas répondu|pas pu (le |la |les )?lire/i;
  const LECTURE = /\blecture\b.*(…|\.\.\.|en cours)|lecture en cours|en cours de lecture|\bchargement\b|\bje (lis|relis)\b/i;
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        R.cls += e.value;
        const src = (e.sources || []).slice(0, 2).map((s) => { const n = s.node; if (!n || !n.nodeType) return '?'; const el = n.nodeType === 1 ? n : n.parentElement; if (!el) return '#text'; return el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : '') + ' «' + String(el.textContent || '').trim().slice(0, 40) + '»'; });
        R.shifts.push({ t: Math.round(e.startTime), v: Math.round(e.value * 10000) / 10000, src });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (_) {}
  const h32 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const tick = () => {
    const t = Math.round(performance.now());
    let txt = '';
    const sp = document.getElementById('vrm-demarrage');
    let couvert = false;
    if (sp) { const cs = getComputedStyle(sp); couvert = cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5; }
    const root = document.getElementById('root');
    if (couvert) txt = '§démarrage';
    else if (root) {
      txt = root.innerText || '';
      for (const x of root.querySelectorAll('[data-photos-bloquees]')) { const s = x.innerText; if (s) txt = txt.replace(s, ''); }
      // L'heure qui passe n'est pas une donnée qui arrive.
      txt = txt.replace(/il y a \d+\s?(s|sec|secondes?)\b/gi, 'il y a Ns').replace(/\b\d{1,2}:\d{2}:\d{2}\b/g, 'hh:mm:ss');
    }
    txt = txt.trim();
    const h = h32(txt);
    const sq = !couvert && !!(root && [...root.querySelectorAll('.vrm-skeleton,[data-squelette]')].some((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'));
    const coque = !!document.querySelector('main.vrm-main');
    // L'attente de l'écran (src/AttenteEcran.jsx) : « attente » (et ce qui manque), « pret », « plafond ».
    const ae = document.querySelector('[data-attente]');
    const att = ae ? ae.getAttribute('data-attente') + (ae.getAttribute('data-attente-manque') ? ':' + ae.getAttribute('data-attente-manque') : '') : '';
    const d = R.ech[R.ech.length - 1];
    if (!d || d.h !== h || d.sq !== sq || d.coque !== coque || d.att !== att) {
      R.ech.push({ t, h, n: txt.length, sq, couvert, coque, att });
      if (!R.textes[h]) {
        R.textes[h] = txt.length > 20000 ? txt.slice(0, 20000) : txt;
        for (const l of txt.split('\n')) { const s = l.trim(); if (!s || s.length > 160) continue; if ((PASLU.test(s) || LECTURE.test(s)) && !(s in R.lignes)) R.lignes[s] = { t, pasLu: PASLU.test(s), lecture: LECTURE.test(s) }; }
      }
    }
    R.dernierTick = t;
  };
  const go = () => { tick(); setInterval(tick, 100); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
}

async function ouvrir(b, combo, tab, opts = {}) {
  const P = PROFILS[combo.reseau];
  const vp = combo.w < 600 ? { width: combo.w, height: 844 } : { width: combo.w, height: 950 };
  const ctxOpts = { viewport: vp, ...(combo.w < 600 ? { isMobile: true, hasTouch: true } : {}) };
  if (opts.video) ctxOpts.recordVideo = { dir: opts.video, size: vp };
  const ctx = await b.newContext(ctxOpts);
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([qui, uids, sombre]) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_comptes_lies', JSON.stringify({ qui, uids })); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); } catch (_) {}
  }, [UID_BANC, UIDS_LIES, combo.theme === 'sombre']);
  await pg.addInitScript(enregistreur);
  if (process.env.CHARGEMENT_SANS_ANIM) await pg.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '*{animation:none!important;transition:none!important}'; document.head.appendChild(st); }));
  // Les photos (CDN Vinted) : une vraie image, petite, après un aller-retour — couper les
  // images ferait apparaître, au bout d'un délai, la phrase « photos bloquées » (un décalage
  // que le vendeur ne voit jamais).
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, async (r) => {
    const t = r.request().resourceType();
    if (t === 'image') { await new Promise((x) => setTimeout(x, P.rtt)); return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PIXEL }).catch(() => {}); }
    return ['media', 'font'].includes(t) ? r.abort() : r.continue();
  });
  if (combo.w < 600 || P.cdp) {
    const cdp = await ctx.newCDPSession(pg);
    if (combo.w < 600) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    if (P.cdp) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', P.cdp); }
  }
  let enVol = 0, derniere = Date.now();
  const lectures = [];   // [début, fin] de chaque lecture de la base (ms depuis la navigation, horloge du banc)
  // Toute requête de la page (fichiers de l'app compris) : le calme attend aussi la fin des téléchargements.
  const vols = new Set();
  pg.on('request', (q) => vols.add(q)); const fin = (q) => { vols.delete(q); derniere = Date.now(); };
  pg.on('requestfinished', fin); pg.on('requestfailed', fin);
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request(); const url = rq.url();
    enVol++;
    try {
      if (rq.method() !== 'GET') { await new Promise((r) => setTimeout(r, P.rtt)); return await route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }); }
      const du = decodeURIComponent(url);
      if (opts.panne && /harvest_[^&]*_orders_sold|orders_\*|orders_sold/.test(du)) { await new Promise((r) => setTimeout(r, P.rtt)); return await route.fulfill({ status: 503, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>503</html>' }); }
      const h = await rq.allHeaders();
      const rep = repondre(url, h.range, base);
      const body = JSON.stringify(rep.body);
      const d0 = Date.now() - t0;
      await new Promise((r) => setTimeout(r, P.rtt + Math.round(body.length / P.debit * 1000)));
      lectures.push([d0, Date.now() - t0, du.replace(/^.*\/rest\/v1\//, '').slice(0, 150)]);
      return await route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body });
    } catch (_) { /* page fermée */ } finally { enVol--; derniere = Date.now(); }
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  var t0 = Date.now();
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'commit', timeout: P.max });
  // Le calme : aucune lecture de la base en vol ni finie depuis 3 s, et aucun
  // changement visible depuis 3 s (ou le plafond du profil).
  const calme = async (depuis) => {
    while (Date.now() - depuis < P.max) {
      await pg.waitForTimeout(500);
      const r = await pg.evaluate(() => { const R = window.__chg; if (!R) return null; const d = R.ech[R.ech.length - 1]; const s = R.shifts[R.shifts.length - 1]; return { dern: Math.max(d ? d.t : 0, s ? s.t : 0), now: Math.round(performance.now()), n: R.ech.length, couvert: d && d.couvert, coque: d && d.coque }; }).catch(() => null);
      if (!r || r.n < 2) continue;
      if (enVol === 0 && vols.size === 0 && Date.now() - derniere > 3000 && r.now - r.dern > 3000 && !r.couvert && r.coque) return true;
    }
    return false;
  };
  const fini = await calme(t0);
  const R = await pg.evaluate(() => window.__chg);
  const res = analyser(R);
  if (process.env.CHARGEMENT_TEXTES) { fs.mkdirSync(process.env.CHARGEMENT_TEXTES, { recursive: true }); fs.writeFileSync(path.join(process.env.CHARGEMENT_TEXTES, `${combo.nom.replace(/:/g, '-')}-${tab}.json`), JSON.stringify({ ech: R.ech, textes: R.textes }, null, 1)); }
  if (process.env.CHARGEMENT_DEBUG) {
    console.log('    [debug] fin de mesure à', await pg.evaluate(() => Math.round(performance.now())), 'ms');
    for (const e of R.ech) console.log(`    [debug] ${String(e.t).padStart(6)} n=${e.n}${e.couvert ? ' couvert' : ''}${e.coque ? ' coque' : ''}${e.sq ? ' squelette' : ''}${e.att ? ' [' + e.att + ']' : ''} ${JSON.stringify((R.textes[e.h] || '').replace(/\s+/g, ' ').slice(0, 140))}`);
    for (let i = 1; i < R.ech.length; i++) {
      const a = (R.textes[R.ech[i - 1].h] || '').split('\n').map((x) => x.trim()).filter(Boolean), b = (R.textes[R.ech[i].h] || '').split('\n').map((x) => x.trim()).filter(Boolean);
      const A = new Set(a), B = new Set(b);
      const moins = a.filter((x) => !B.has(x)).slice(0, 5), plus = b.filter((x) => !A.has(x)).slice(0, 5);
      if (moins.length || plus.length) console.log(`    [diff] ${R.ech[i].t} − ${JSON.stringify(moins).slice(0, 200)} + ${JSON.stringify(plus).slice(0, 200)}`);
    }
    for (const x of R.shifts) console.log(`    [debug] décalage ${x.t} ${x.v} ${x.src.join(' / ')}`);
  }
  res.calme = fini; res.erreurs = errs.slice(0, 3);
  const premiere = lectures.length ? Math.min(...lectures.map((x) => x[0])) : null, derniereL = lectures.length ? Math.max(...lectures.map((x) => x[1])) : null;
  const iCoque = R.ech.find((e) => e.coque);
  res.lectures = { n: lectures.length, premiere, derniere: derniereL, coque: iCoque ? iCoque.t : null };
  if (process.env.CHARGEMENT_LECTURES) for (const l of lectures.slice().sort((a, b) => a[0] - b[0])) console.log(`    [lecture] ${l[0]}→${l[1]} ${l[2]}`);
  if (process.env.CHARGEMENT_DEBUG) console.log(`    [debug] coque montée ${res.lectures.coque} ms · ${lectures.length} lectures de la base, de ${premiere} à ${derniereL} ms (horloge du banc)`);
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `${combo.nom.replace(/:/g, '-')}-${tab}.png`) }).catch(() => {}); }
  // ── Revenir sur un écran déjà vu : Ventes puis Ma journée, par la navigation.
  if (opts.retour) {
    const nav = (t) => pg.evaluate((t) => { const tel = innerWidth < 600; const b = document.querySelector((tel ? '.vrm-mobile-nav ' : '.vrm-sidebar ') + `[data-nav-entree="${t}"]`) || document.querySelector(`[data-nav-entree="${t}"]`); if (!b) return false; b.click(); return true; }, t);
    const ok1 = await nav('ventes'); await calme(Date.now());
    const avant = await pg.evaluate(() => window.__chg.ech.length);
    const tClic = await pg.evaluate(() => Math.round(performance.now()));
    const ok2 = await nav(tab); await calme(Date.now());
    const R2 = await pg.evaluate(() => window.__chg);
    const apres = R2.ech.slice(avant);
    let chg = 0; for (let i = 1; i < apres.length; i++) if (apres[i].h !== apres[i - 1].h || apres[i].sq !== apres[i - 1].sq) chg++;
    if (process.env.CHARGEMENT_DEBUG) for (let i = 1; i < apres.length; i++) {
      const a = (R2.textes[apres[i - 1].h] || '').split('\n').map((x) => x.trim()).filter(Boolean), b2 = (R2.textes[apres[i].h] || '').split('\n').map((x) => x.trim()).filter(Boolean);
      const A = new Set(a), B = new Set(b2);
      console.log(`    [retour] ${apres[i].t - tClic} ms${apres[i].sq ? ' squelette' : ''} − ${JSON.stringify(a.filter((x) => !B.has(x)).slice(0, 5)).slice(0, 200)} + ${JSON.stringify(b2.filter((x) => !A.has(x)).slice(0, 5)).slice(0, 200)}`);
    }
    res.retour = { nav: ok1 && ok2, changements: chg, squelette: apres.some((e) => e.sq), cls: Math.round(R2.shifts.filter((s) => s.t >= tClic).reduce((a, s) => a + s.v, 0) * 1000) / 1000 };
  }
  await ctx.close();
  return res;
}

function analyser(R) {
  const E = R.ech;
  const iContenu = E.findIndex((e) => !e.couvert && e.n > 0);
  const contenu = iContenu >= 0 ? E[iContenu].t : null;
  const suite = iContenu >= 0 ? E.slice(iContenu) : [];
  // Un changement = un nouvel état de texte (ou un squelette qui part/arrive) après le premier contenu.
  let changements = 0;
  for (let i = 1; i < suite.length; i++) if (suite[i].h !== suite[i - 1].h || suite[i].sq !== suite[i - 1].sq) changements++;
  const final = E.length ? (R.textes[E[E.length - 1].h] || '') : '';
  const lignesFinales = new Set(final.split('\n').map((s) => s.trim()));
  const trans = Object.entries(R.lignes).filter(([s]) => !lignesFinales.has(s));
  const pasLu = trans.filter(([, v]) => v.pasLu).map(([s]) => s);
  const lecture = trans.filter(([, v]) => v.lecture && !v.pasLu).map(([s]) => s);
  const dernTexte = E.length ? E[E.length - 1].t : 0;
  const dernShift = R.shifts.length ? R.shifts[R.shifts.length - 1].t : 0;
  return {
    contenu, stable: Math.max(dernTexte, dernShift), changements,
    cls: Math.round(R.cls * 1000) / 1000, gros: R.shifts.filter((s) => s.v >= 0.01).slice(0, 4),
    pasLuTransitoires: pasLu.length, pasLu: pasLu.slice(0, 6),
    lectureTransitoires: lecture.length, lecture: lecture.slice(0, 6),
    squelette: E.some((e) => e.sq), etats: E.length,
    vide: !final || /pas pu s'afficher|Cannot access|is not defined/.test(final),
  };
}

(async () => {
  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--explicitly-allowed-ports=' + PORT] });
  const sortie = {};
  try {
    for (const combo of COMBOS) {
      if (!PROFILS[combo.reseau]) { console.log('profil inconnu : ' + combo.reseau); continue; }
      console.log(`\n── ${combo.nom} (${combo.w} px, réseau ${combo.reseau}, ${combo.theme})`);
      sortie[combo.nom] = {};
      for (const tab of ECRANS) {
        const video = VIDEO && combo.w < 600 && combo.reseau === '4g' && combo.theme === 'clair' && tab === 'journee' ? VIDEO : '';
        const r = await ouvrir(b, combo, tab, { retour: tab === 'journee', video, panne: PANNE });
        sortie[combo.nom][tab] = r;
        console.log(`  ${tab.padEnd(9)} contenu ${String(r.contenu ?? '—').padStart(6)} ms · stable ${String(r.stable).padStart(6)} ms · ${String(r.changements).padStart(3)} changements · CLS ${r.cls.toFixed(3)} · pas-lu transitoires ${r.pasLuTransitoires} · lecture transitoires ${r.lectureTransitoires}${r.squelette ? ' · squelette vu' : ''}${r.calme ? '' : ' · ⚠ jamais calme'}${r.retour ? ` · retour : ${r.retour.changements} chgt, CLS ${r.retour.cls}${r.retour.squelette ? ', squelette' : ''}` : ''}`);
        if (r.pasLu.length) console.log('      pas-lu vus : ' + r.pasLu.map((s) => JSON.stringify(s)).join(' · '));
        if (r.lecture.length) console.log('      lecture vus : ' + r.lecture.map((s) => JSON.stringify(s)).join(' · '));
        if (r.gros.length) console.log('      décalages : ' + r.gros.map((s) => `${s.t} ms ${s.v} ${s.src.join(' / ')}`).join(' | '));
        if (r.erreurs.length) console.log('      erreurs : ' + r.erreurs.join(' | '));
        const ref = REFERENCE && REFERENCE[combo.nom] && REFERENCE[combo.nom][tab];
        dit(!r.vide, `${combo.nom} ${tab} : l'écran est rendu`);
        dit(r.cls <= 0.01, `${combo.nom} ${tab} : CLS ≈ 0`, String(r.cls));
        dit(r.pasLuTransitoires === 0, `${combo.nom} ${tab} : aucun « pas lu / pas su » qui devient une valeur`, r.pasLu.join(' · '));
        if (ref) {
          dit(r.changements <= Math.max(1, Math.floor(ref.changements / 3)), `${combo.nom} ${tab} : changements visibles divisés au moins par 3`, `${ref.changements} → ${r.changements}`);
          dit(r.stable <= ref.stable * 1.15 + 400, `${combo.nom} ${tab} : écran stable pas plus tard qu'avant`, `${ref.stable} → ${r.stable} ms`);
        }
        if (r.retour) {
          dit(r.retour.nav, `${combo.nom} ${tab} : la navigation Ventes → ${tab} a eu lieu`);
          dit(!r.retour.squelette && r.retour.changements <= 1 && r.retour.cls <= 0.01, `${combo.nom} ${tab} : un écran déjà vu revient sans squelette ni clignotement`, `${r.retour.changements} changement(s), CLS ${r.retour.cls}${r.retour.squelette ? ', squelette' : ''}`);
        }
      }
    }
  } finally { await b.close(); srv.close(); }
  if (process.env.CHARGEMENT_JSON) fs.writeFileSync(process.env.CHARGEMENT_JSON, JSON.stringify(sortie, null, 1));
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ tout est vert');
  process.exit(ko ? 1 : 0);
})();
