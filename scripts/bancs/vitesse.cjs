require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  VITESSE — ce que coûte l'ouverture de chaque écran, MESURÉ (« app plus
//  rapide », retenue par Julien le 11 octobre).
//
//  Base INVENTÉE au volume de la sienne (`_base-volume.cjs`, aucune donnée
//  réelle, il vit dans le dépôt). Chaque requête à NOTRE base est servie avec
//  un aller-retour réseau simulé (RTT + débit), et notée : URL, octets, début,
//  fin. On en tire, par écran ouvert à froid :
//    · le temps jusqu'au premier écran UTILE (Ma journée : son héros rendu) ;
//    · le nombre de requêtes et d'octets ;
//    · les lectures IDENTIQUES faites plusieurs fois (même URL, même Range) ;
//    · les octets de PDF rapatriés (doit être ZÉRO à l'ouverture d'un écran) ;
//    · le « chemin critique » : combien d'allers-retours À LA SUITE.
//  ⚠️ Ce banc ne touche que NOTRE base. Les requêtes à Vinted ne passent jamais
//  par l'app, et §3 interdit de les paralléliser — rien ici n'y touche.
//
//  Lancer : npm run build && node scripts/bancs/vitesse.cjs
//  `VITESSE_DETAIL=1` imprime chaque requête ; `PORT=…` change le port.
//  `VITESSE_TEXTES=dir` écrit le texte rendu ; `VITESSE_REFERENCE=dir` le compare
//  à celui d'un autre build (chaque écran ouvert, 6 nov.).
//  `BANC_PORT` (ou `PORT`) change le port ; `VITESSE_VOLUME=ancien` sert la base
//  d'avant le 6 nov. (sans le poids réel des commandes et des fiches de page) ;
//  `VITESSE_MEMOIRE=0` ouvre comme sur un appareil neuf (aucun compte lié retenu).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { fabriquer, repondre } = require('./_base-volume.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4871;
const DETAIL = !!process.env.VITESSE_DETAIL;
const RTT = 150;            // ms — un aller-retour vers Supabase depuis la France (mesuré : 165–536 ms)
const DEBIT = 2_000_000;    // octets/s — une 4G correcte
const CPU = Number(process.env.VITESSE_CPU || 4);   // téléphone : processeur 4× plus lent qu'un ordinateur (émulation Chrome)

const base = fabriquer({ volumeReel: process.env.VITESSE_VOLUME !== 'ancien' });
// ── LES LIGNES LOURDES LUES POUR RIEN (6 nov., vague 2 « vitesse ») ──────────
// Mesuré sur sa base (lecture seule) : `vinted_item_details` ~349 Ko, lue
// ENTIÈRE à trois endroits pour ~60 fiches ; les commandes (~2,1 Mo) lues
// entières pour TOUS les comptes jamais captés, `orders_bought` et `wreq_*`
// compris, puis filtrées dans l'app. On note, par écran, les octets de ces deux
// familles, et ceux des lignes qu'aucun écran ne montre (ancien compte,
// `orders_bought`, `wreq_*`).
const UIDS_LIES = new Set(base.accounts.map((a) => String(a.vinted_user_id)));
const POIDS_FICHES = JSON.stringify((base.rows.find((r) => r.id === 'vinted_item_details') || {}).data || {}).length;
const UID_BANC = process.env.BANC_SESSION_UID || '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';
const MEMOIRE = process.env.VITESSE_MEMOIRE !== '0';
const horsEcran = (id) => { const m = /^harvest_(\d+)_(.*)$/.exec(String(id || '')); return !!(m && ((/orders/.test(m[2]) && (!UIDS_LIES.has(m[1]) || !/^orders_(sold|purchased)$/.test(m[2]))) || (m[2] === 'listings' && !UIDS_LIES.has(m[1])))); };
// (6 nov., vitesse 2) Les achats d'un ancien compte : ce que lisaient la cloche « où ranger », le registre et l'export.
const achatsHors_ = (id) => { const m = /^harvest_(\d+)_orders_purchased$/.exec(String(id || '')); return !!(m && !UIDS_LIES.has(m[1])); };
const visePoids = (u) => /vinted_item_details/.test(u) ? 'fiches' : (/harvest_[^&]*_orders_/.test(u) ? 'commandes' : (/harvest_[^&]*_listings/.test(u) ? 'dressings' : ''));
// Une lecture qui rapatrie la ligne ENTIÈRE : `select=` qui nomme `data` seul.
const selectEntier = (u) => { const m = /[?&]select=([^&]*)/.exec(u); return !!m && m[1].split(',').some((x) => /^(?:[^:]+:)?data$/.test(x.trim())); };
// La famille de commandes de TOUS les comptes en une lecture (le préchargement).
const estFamille = (u) => /id=like\.harvest_\*_orders_\*/.test(u) || /or=\(id\.like\.harvest_\*_orders_sold/.test(u) || new Set([...u.matchAll(/harvest_(\d+)_orders_/g)].map((m) => m[1])).size > 1;
// Les achats « déposés en point relais » de la base : les seuls dont Ma journée
// a besoin du n° de suivi (`vintedToPickup`).
const ACHATS_AU_RELAIS = base.rows.filter((r) => /_orders_purchased$/.test(r.id)).reduce((n, r) => n + (((r.data || {}).payload || {}).my_orders || []).filter((o) => /point relais/i.test(o.status || '')).length, 0);
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
// (6 nov., vitesse 2) Les fichiers de l'app servis COMPRESSÉS (gzip), comme par
// Vercel : un réseau « 4G » simulé ne doit pas transporter 3,9 Mo de JavaScript
// en clair. Chaque fichier servi est noté (chemin, octets compressés) : ce que
// coûte le PREMIER chargement d'un écran, morceau par morceau.
const zlib = require('zlib');
const _gz = new Map();
let servis = [];
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const ext = path.extname(p);
  if (/^\.(js|css|html|json|webmanifest|svg)$/.test(ext) && /gzip/.test(q.headers['accept-encoding'] || '')) {
    if (!_gz.has(p)) _gz.set(p, zlib.gzipSync(fs.readFileSync(p), { level: 9 }));
    const b = _gz.get(p);
    servis.push({ f, octets: b.length });
    r.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': b.length, 'cache-control': 'no-store' }); return r.end(b);
  }
  servis.push({ f, octets: fs.statSync(p).size });
  r.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
// `VITESSE_RESEAU=4g` : le téléphone sur un réseau 4G simulé (Chrome, CDP) — 150 ms
// d'aller-retour, 1,6 Mbit/s descendant, 750 kbit/s montant (le profil « 4G lente »
// de Lighthouse, celui des mesures mobiles). Seuls les fichiers de l'app passent
// par ce réseau : la base reste servie par le banc (RTT + débit simulés plus bas).
const RESEAU = process.env.VITESSE_RESEAU === '4g' ? { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 } : null;
const LARGEURS = process.env.VITESSE_LARGEURS ? process.env.VITESSE_LARGEURS.split(',').map(Number) : [390, 1512];
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

// ── LES RENDUS DE L'ÉCRAN AU DÉMARRAGE (17 octobre) ─────────────────────────
// Le composant qui porte Ma journée, Ventes, Achats et Annonces (`Comptabilite`,
// ~12 000 lignes) se rendait 14 à 19 fois à l'ouverture de Ma journée : une
// fois par arrivée de données, ET à chaque rendu de la coque — dont trois pour
// changer l'icône du nuage (« chargement / sauvegarde / synchronisé ») et deux
// pour « ventes arrivées » puis « chiffres calculés ». Le crochet des outils de
// développement (appelé par React à chaque commit, production comprise) compte
// les commits où CE composant a réellement exécuté sa fonction (drapeau
// `PerformedWork` sur une fibre neuve — une fibre reprise telle quelle n'a pas
// été rendue). On le reconnaît à ses props : `only` = l'écran, et `accounts`.
function crochetRendus(only) {
  const C = { rendus: 0, dernier: null };
  window.__vrmRendus = C;
  const trouver = (f) => { const pile = [f]; while (pile.length) { const x = pile.pop(); if (!x) continue; const p = x.memoizedProps; if (typeof x.type === 'function' && p && p.only === only && 'accounts' in p) return x; if (x.sibling) pile.push(x.sibling); if (x.child) pile.push(x.child); } return null; };
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, isDisabled: false, renderers: new Map(),
    inject(r) { const id = this.renderers.size + 1; this.renderers.set(id, r); return id; },
    checkDCE() {}, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      let f = null; try { f = trouver(root.current); } catch (_) {}
      if (!f || f === C.dernier) return;
      C.dernier = f;
      if (f.flags & 1) C.rendus++;
    },
  };
}

async function ouvrir(b, vp, tab, attendre, frappe, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  // L'appareil de tous les jours : les comptes liés de la dernière ouverture sont
  // retenus (`vrm_comptes_lies`). Ignoré par un build qui ne le connaît pas.
  if (opts.memoire !== false && MEMOIRE) await pg.addInitScript(([qui, uids]) => { try { localStorage.setItem('vrm_comptes_lies', JSON.stringify({ qui, uids })); } catch (_) {} }, [UID_BANC, [...UIDS_LIES]]);
  if (opts.rendus) await pg.addInitScript(crochetRendus, opts.rendus);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  if (vp.width < 600 && (CPU > 1 || RESEAU)) { const cdp = await ctx.newCDPSession(pg); if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); if (RESEAU) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', RESEAU); } }
  servis = [];
  const req = [];
  let fige = false;   // après la mesure d'ouverture : les lectures du signal ne comptent pas dans le bilan
  const noter = (e) => { if (!fige) req.push(e); };
  const t0 = Date.now();
  // L'histoire du héros de Ma journée : à quel moment il apparaît, avec quelle
  // valeur (un héros qui apparaît tôt avec un FAUX chiffre ne compte pas).
  await pg.addInitScript((t0) => {
    window.__heros = [];
    const note = () => { const e = document.querySelector('[data-vendu-mois]'); const v = e ? e.getAttribute('data-vendu-mois') : null; const l = window.__heros[window.__heros.length - 1]; if (!l || l.v !== v) window.__heros.push({ t: Date.now() - t0, v }); };
    document.addEventListener('DOMContentLoaded', () => new MutationObserver(note).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-vendu-mois'] }));
  }, t0);
  await pg.addInitScript(() => { const voir = () => { if (!window.__vrmCoque && document.querySelector('.vrm-app-header')) window.__vrmCoque = Math.round(performance.now()); }; document.addEventListener('DOMContentLoaded', () => { voir(); new MutationObserver(voir).observe(document.body, { subtree: true, childList: true }); }); });
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request();
    const url = rq.url();
    const debut = Date.now() - t0;
    if (rq.method() !== 'GET') {
      noter({ m: rq.method(), url, debut, fin: debut + RTT, octets: 0, pdf: 0 });
      await new Promise((r) => setTimeout(r, RTT));
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    }
    const h = await rq.allHeaders();
    // `couperFamille` : la lecture de TOUTES les commandes en une fois (le
    // préchargement du démarrage) échoue — l'app doit retomber sur la lecture
    // par compte et rendre EXACTEMENT le même écran.
    if (opts.couperFamille && estFamille(decodeURIComponent(url))) {
      noter({ m: 'GET', url, range: h.range || '', debut, fin: debut + RTT, octets: 0, pdf: 0, coupe: true });
      await new Promise((r) => setTimeout(r, RTT));
      return route.fulfill({ status: 503, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>503</html>' });
    }
    const rep = repondre(url, h.range, base);
    const body = JSON.stringify(rep.body);
    const pdf = (body.match(/JVBERi0x*/g) || []).reduce((a, s) => a + s.length, 0);
    const delai = RTT + Math.round(body.length / DEBIT * 1000);
    const du = decodeURIComponent(url);
    const hors = Array.isArray(rep.body) ? rep.body.filter((x) => x && horsEcran(x.id)).reduce((a, x) => a + JSON.stringify(x).length, 0) : 0;
    const achatsHors = Array.isArray(rep.body) ? rep.body.filter((x) => x && achatsHors_(x.id)).reduce((a, x) => a + JSON.stringify(x).length, 0) : 0;
    const e = { m: 'GET', url, range: h.range || '', debut, fin: debut + delai, octets: body.length, pdf, poids: visePoids(du), entier: !!visePoids(du) && selectEntier(du), hors, achatsHors };
    noter(e);
    await new Promise((r) => setTimeout(r, delai));
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  let utile = null;
  try { await pg.waitForFunction(attendre, null, { timeout: RESEAU ? 120000 : 30000, polling: 50 }); utile = Date.now() - t0; } catch (_) {}
  // (6 nov., vitesse 2) La coque dessinée (le morceau `App` téléchargé, compilé, rendu) : mesurée dans la page.
  const coque = await pg.evaluate(() => window.__vrmCoque || null).catch(() => null);
  // Le calme : plus aucune requête GET pendant 3 s.
  for (let i = 0; i < 120; i++) {
    await pg.waitForTimeout(500);
    const dern = req.length ? Math.max(...req.map((x) => x.fin)) : 0;
    if (Date.now() - t0 - dern > 3000) break;
  }
  // ⚠️ Sauf la phrase des photos (`data-photos-bloquees`) : le banc coupe les
  // images, et elle apparaît au bout d'un délai — elle dit le temps écoulé.
  const lu = await pg.evaluate(() => { let t = document.body.innerText; for (const x of document.querySelectorAll('[data-photos-bloquees]')) t = t.replace(x.innerText, ''); return { tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText), texte: t, rendus: window.__vrmRendus ? window.__vrmRendus.rendus : null }; });
  // ── UN SIGNAL « vrm:colis » SANS RIEN DE NEUF NE RE-REND PAS L'ÉCRAN (22 oct.) ──
  // À l'ouverture, « à retirer » puis « à poster » publient chacun leur compte
  // et préviennent la cloche. C'était un compteur d'état de la coque : chaque
  // signal re-rendait toute la coque et l'écran ouvert, puis la cloche reposait
  // une liste identique (un tableau neuf) — deux rendus pour rien.
  // ⚠️ Le PREMIER signal peut légitimement changer la cloche : la numérotation
  // automatique a pu passer après son premier calcul (mesuré : « 84 annonces
  // sans numéro » puis plus rien). On en envoie donc un pour rattraper, puis on
  // compte les rendus que provoque le SECOND, quand plus rien n'a changé
  // (attendu : aucun ; le code d'avant en faisait deux).
  let rendusSignal = null;
  if (opts.signalColis && lu.rendus != null) {
    const nReq = req.length;
    const signal = async () => {
      const n0 = req.length;
      await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:colis')));
      for (let i = 0; i < 40; i++) {
        await pg.waitForTimeout(250);
        const nouv = req.slice(n0); const dern = nouv.length ? Math.max(...nouv.map((x) => x.fin)) : 0;
        if (i >= 8 && Date.now() - t0 - dern > 1500) break;
      }
    };
    await signal();
    const avant = await pg.evaluate(() => window.__vrmRendus ? window.__vrmRendus.rendus : null);
    await signal();
    rendusSignal = (await pg.evaluate(() => window.__vrmRendus ? window.__vrmRendus.rendus : null)) - avant;
    fige = true; req.length = nReq;
  }
  // Ce que coûte une FRAPPE dans la recherche de la liste : chaque lettre de
  // « salomon », jusqu'à l'image suivante peinte (deux rAF).
  let frappes = null;
  if (frappe) {
    frappes = await pg.evaluate(async (sel) => {
      const i = document.querySelector(sel); if (!i) return null;
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const peint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const t = [];
      let v = '';
      for (const c of 'salomon') {
        v += c; const t0 = performance.now();
        set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true }));
        await peint(); t.push(Math.round(performance.now() - t0));
        await new Promise((r) => setTimeout(r, 120));
      }
      await new Promise((r) => setTimeout(r, 400));
      const apres = document.body.innerText.length;
      set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true }));
      return { t, max: Math.max(...t), moy: Math.round(t.reduce((a, x) => a + x, 0) / t.length), apres };
    }, frappe);
  }
  // Les fichiers de l'app chargés jusqu'au premier écran utile (et après, jusqu'au calme).
  const fichiers = servis.slice(); servis = [];
  const heros = await pg.evaluate(() => window.__heros || []).catch(() => []);
  if (DETAIL) console.log('    héros :', JSON.stringify(heros));
  await ctx.close();
  return { req, utile, errs, lu, frappes, heros, rendusSignal, fichiers, coque };
}

function bilan(nom, r) {
  const gets = r.req.filter((x) => x.m === 'GET');
  const octets = gets.reduce((a, x) => a + x.octets, 0);
  const pdf = gets.reduce((a, x) => a + x.pdf, 0);
  const cle = (x) => x.url.replace(/^https?:\/\/[^/]+/, '') + '|' + x.range;
  const vus = new Map();
  for (const x of gets) vus.set(cle(x), (vus.get(cle(x)) || 0) + 1);
  const doublons = [...vus.entries()].filter(([, n]) => n > 1);
  const enDouble = doublons.reduce((a, [, n]) => a + n - 1, 0);
  // Profondeur : la plus longue chaîne de requêtes dont chacune démarre après la fin de la précédente.
  const tri = [...gets].sort((a, b) => a.debut - b.debut);
  const prof = new Array(tri.length).fill(1);
  for (let i = 0; i < tri.length; i++) for (let j = 0; j < i; j++) if (tri[j].fin <= tri[i].debut && prof[j] + 1 > prof[i]) prof[i] = prof[j] + 1;
  const profondeur = tri.length ? Math.max(...prof) : 0;
  const fin = gets.length ? Math.max(...gets.map((x) => x.fin)) : 0;
  const dec = (x) => decodeURIComponent(x.url);
  // La chaîne jusqu'aux VENTES (ce que le héros de Ma journée attend) : à quelle
  // profondeur part la lecture des commandes (par compte, ou toutes à la fois)
  // qui a servi. Avant le 16 octobre : sonde → comptes → commandes = 3.
  const estVentes = (x) => !x.coupe && /harvest_[^&]*_orders_(?:[%*]|sold)[^&]*&select=id,(?:data|updated_at)/.test(dec(x));
  const profVentes = tri.reduce((m, x, i) => (estVentes(x) && (r.utile == null || x.debut < r.utile) ? Math.max(m, prof[i]) : m), 0);
  // Balayages complets de la famille des transactions (la requête la plus
  // coûteuse de la base, `pg_stat_statements`) : on compte la PREMIÈRE page.
  const txn = gets.filter((x) => /id=like\.harvest_[%*]_txn_[%*]/.test(dec(x)) && (!x.range || /^0-/.test(x.range))).length;
  const supprParCompte = gets.filter((x) => /id=eq\.harvest_\d+_supprimees/.test(dec(x))).length;
  const fiches = gets.filter((x) => x.poids === 'fiches'), commandes = gets.filter((x) => x.poids === 'commandes');
  const octFiches = fiches.reduce((a, x) => a + x.octets, 0), octCommandes = commandes.reduce((a, x) => a + x.octets, 0);
  const entieres = gets.filter((x) => x.entier), octHors = gets.reduce((a, x) => a + (x.hors || 0), 0);
  const dressings = gets.filter((x) => x.poids === 'dressings'), octDressings = dressings.reduce((a, x) => a + x.octets, 0);
  const octAchatsHors = gets.reduce((a, x) => a + (x.achatsHors || 0), 0);
  const js = (r.fichiers || []).filter((x) => /\.(js|css)$/.test(x.f)), octJs = js.reduce((a, x) => a + x.octets, 0);
  // Les lignes jamais montrées que rapporte la lecture des COMMANDES de l'écran
  // (le préchargement, puis la lecture par compte) — celle que ce chantier juge.
  const octHorsCommandes = gets.filter(estVentes).reduce((a, x) => a + (x.hors || 0), 0);
  console.log(`  ${nom.padEnd(26)} utile ${String(r.utile ?? '—').padStart(6)} ms · calme ${String(fin).padStart(6)} ms · ${String(gets.length).padStart(3)} lectures · ${String(Math.round(octets / 1024)).padStart(6)} Ko · PDF ${Math.round(pdf / 1024)} Ko · en double ${enDouble} · ${profondeur} allers-retours à la suite · ${txn} balayage(s) des transactions`);
  console.log(`     fiches de page ${Math.round(octFiches / 1024)} Ko en ${fiches.length} lecture(s) · commandes ${Math.round(octCommandes / 1024)} Ko en ${commandes.length} lecture(s) · ${entieres.length} lecture(s) de ligne entière · ${Math.round(octHors / 1024)} Ko de lignes qu'aucun écran ne montre, dont ${Math.round(octHorsCommandes / 1024)} Ko par la lecture des commandes`);
  if (DETAIL) {
    for (const x of tri) console.log(`      ${String(x.debut).padStart(6)}→${String(x.fin).padStart(6)} ${String(Math.round(x.octets / 1024)).padStart(5)} Ko ${decodeURIComponent(x.url.replace(/^https?:\/\/[^/]+\/rest\/v1\//, '')).slice(0, 170)} ${x.range}`);
    for (const [k, n] of doublons) console.log(`      ×${n} ${decodeURIComponent(k).slice(0, 170)}`);
  }
  console.log(`     dressings ${Math.round(octDressings / 1024)} Ko en ${dressings.length} lecture(s) · achats d'anciens comptes lus ${Math.round(octAchatsHors / 1024)} Ko · fichiers de l'app ${Math.round(octJs / 1024)} Ko compressés en ${js.length} fichier(s)`);
  if (DETAIL) for (const x of js) console.log(`      ${String(Math.round(x.octets / 1024)).padStart(6)} Ko ${x.f}`);
  if (profVentes) console.log(`     ventes lues au ${profVentes}ᵉ aller-retour à la suite · héros ${JSON.stringify(r.heros || [])}`);
  return { utile: r.utile, fin, n: gets.length, octets, pdf, enDouble, profondeur, txn, supprParCompte, profVentes, octFiches, nFiches: fiches.length, octCommandes, nCommandes: commandes.length, entieres: entieres.map((x) => decodeURIComponent(x.url).replace(/^.*\/rest\/v1\//, '').slice(0, 120)), octHors, octHorsCommandes, octDressings, nDressings: dressings.length, octAchatsHors, octJs, fichiersJs: js.map((x) => x.f.replace(/-[\w-]{8}\.(js|css)$/, '.$1')) };
}

// ⚠️ PLAFONDS MESURÉS le 16 octobre (base inventée, 7 comptes). Avant les
// correctifs : Ma journée 72–77 lectures dont 16–21 identiques, Ventes 98–104
// (31–36), Colis 102–107 (31–36), Annonces 87–92 (32–37), Achats 97–102
// (31–36), Messages 95–100 (40–45), tableau de bord 63–68 (9–14), 2 à 7
// balayages de la famille des transactions et 7 lectures `_supprimees` (une
// par compte) par écran. Après : 47–69 lectures, aucune `_supprimees` par compte,
// 0 à 6 identiques (des relectures séparées par une écriture, voulues), un
// ou deux balayages (le pont + la preuve de vente, deux projections
// différentes). Les plafonds laissent une marge ; ils ne bloquent que le retour
// du défaut. Aucun plancher de TEMPS ici : la machine des bancs est partagée,
// un temps mesuré dessus varie du simple au double (`perfv.cjs` garde ceux de
// la frappe sur Ventes).
const DOUBLONS_MAX = 8;
// (6 nov., vitesse 2) LE PREMIER CHARGEMENT DE MA JOURNÉE : les fichiers de l'app
// (JavaScript + CSS, compressés) téléchargés pour l'ouvrir. Mesuré le 6 nov. :
// ~1 395 Ko avant (le morceau `App` seul : 1 194 Ko), ~1 290 Ko après le
// découpage des écrans qui ne sont pas l'écran d'ouverture. Le plafond ne bloque
// que le retour du défaut (un écran à la demande réimporté en statique).
const JS_JOURNEE_MAX = 1340 * 1024;
// Les morceaux chargés À LA DEMANDE : aucun ne doit partir à l'ouverture de Ma journée.
const MORCEAUX_A_LA_DEMANDE = /\/assets\/(FavorisVinted|FacturePro|AchatsOutils|ebayGestion|ebayRecherche|FichePaire|ModeEmballage|PublierAilleurs|Dac7Comptes|ScannerColis|OffresVestiaire|PrixPartout|ReceptionEmails|JournalEmails|qrcode|Room3D|StudioPhoto|Communaute|BoiteEmails|Operations|three\.module|maplibre-gl|jsQR)-/;
// Rendus de Ma journée au démarrage, téléphone ×4 (médiane de trois ouvertures
// à froid) : 14 à 19 avant le 17 octobre, 11 à 12 après (`BoutonSync`, lectures de la fin
// lancées avec les ventes). Le plafond ne bloque que le retour du défaut.
const RENDUS_JOURNEE_MAX = 13;
// 29 oct. : Messages lit UNE fois de plus trois sources voulues (28-29 oct.) —
// la relecture fiable des conversations (`inbox`/`notifications`/`favoris_archive`
// en une lecture, l'âge des ventes `orders_sold`) et la table « qui remplace qui »
// (`vinted_brouillon_*`, `coffre_*`, reprise du N°) — mesuré 65 (1512) et 67
// (390) contre 59 et 61 le 27 oct., chaque lecture UNE fois (aucun doublon neuf).
// La table était lue DEUX fois (relue à chaque référence neuve de la liste
// d'annonces) : corrigé dans l'app, Ma journée revient à 61.
const PLAFONDS = { journee: 62, cat_ventes: 82, cat_bord: 82, cat_annonces: 66, cat_achats: 78, cat_msg: 68, dashboard: 60 };
const ECRANS = [
  // (6 nov., vitesse 2) `data-vendu-mois` n'est plus rendu par l'écran actuel (rouge d'avant, voir la
  // passation du 6 nov.) : le premier écran UTILE est aussi « <montant> € · Vendu · mois » écrit.
  ['journee', () => !!document.querySelector('[data-vendu-mois],[data-vendu-pas-su]') || /\d\s?€\s*Vendu · mois/.test(document.body.innerText) || /pas pu s'afficher/.test(document.body.innerText)],
  ['cat_ventes', () => document.querySelectorAll('[data-vente],[data-tx]').length > 0 || /\d+ ventes/.test(document.body.innerText), 'input[aria-label="Rechercher dans les ventes Vinted"]'],
  ['cat_bord', () => /bordereau/i.test(document.body.innerText)],
  ['cat_annonces', () => /en ligne/i.test(document.body.innerText), 'input[aria-label="Rechercher une annonce"]'],
  ['cat_achats', () => /achat/i.test(document.body.innerText), 'input[placeholder^="Rechercher (titre, N°"]'],
  ['cat_msg', () => /message|offre/i.test(document.body.innerText)],
  ['dashboard', () => /annonces|vendu/i.test(document.body.innerText)],
  // (6 nov., vitesse 2) Achats, Stock et Comptabilité : les écrans dont la lecture des achats et
  // les morceaux chargés à la demande ont changé. Pas de plafond de lectures (imprimé seulement).
  ['achats', () => /achat/i.test(document.body.innerText)],
  ['garage', () => /stock|étagère|meuble|rang/i.test(document.body.innerText)],
  ['compta', () => /compta|bénéfice|déclar|URSSAF/i.test(document.body.innerText)],
];

// (6 nov., vitesse 2) `VITESSE_PREMIER=n` : seulement le PREMIER CHARGEMENT de Ma journée, n fois
// (avec `VITESSE_RESEAU=4g` : le téléphone en 4G) — coque dessinée, premier écran utile, fichiers.
if (process.env.VITESSE_PREMIER) {
  (async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--explicitly-allowed-ports=' + PORT] });
    const sortie = [];
    try {
      for (let i = 0; i < Number(process.env.VITESSE_PREMIER); i++) {
        const r = await ouvrir(b, { width: 390, height: 844 }, 'journee', ECRANS[0][1], null);
        const js = (r.fichiers || []).filter((x) => /\.(js|css)$/.test(x.f));
        sortie.push({ coque: r.coque, utile: r.utile, octJs: js.reduce((a, x) => a + x.octets, 0), fichiers: js.map((x) => x.f) });
        console.log(`  passage ${i + 1} : coque dessinée ${r.coque ?? '—'} ms · premier écran utile ${r.utile ?? '—'} ms · ${Math.round(sortie[i].octJs / 1024)} Ko de JS+CSS en ${js.length} fichiers`);
      }
    } finally { await b.close(); srv.close(); }
    if (process.env.VITESSE_JSON) fs.writeFileSync(process.env.VITESSE_JSON, JSON.stringify(sortie, null, 1));
    process.exit(0);
  })();
} else
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--explicitly-allowed-ports=' + PORT] });
  const res = {};
  try {
    const seuls = process.env.ECRANS ? process.env.ECRANS.split(',') : null;
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }].filter((v) => LARGEURS.includes(v.width))) {
      console.log(`\n── ${vp.width} px (RTT ${RTT} ms, ${DEBIT / 1e6} Mo/s)`);
      for (const [tab, att, frappe] of ECRANS) {
        if (seuls && !seuls.includes(tab)) continue;
        const r = await ouvrir(b, vp, tab, att, frappe, tab === 'journee' ? { rendus: 'journee', signalColis: true } : {});
        res[vp.width + ':' + tab] = { ...bilan(tab, r), tombe: r.lu.tombe, errs: r.errs, frappes: r.frappes };
        if (r.frappes) console.log(`     frappe « salomon » : ${r.frappes.t.join(' · ')} ms (max ${r.frappes.max})`);
        if (process.env.VITESSE_TEXTES) fs.writeFileSync(path.join(process.env.VITESSE_TEXTES, vp.width + '-' + tab + '.txt'), r.lu.texte);
        const m = res[vp.width + ':' + tab];
        const plafond = PLAFONDS[tab];
        dit(!r.lu.tombe && !r.errs.length, `${vp.width} px · ${tab} : l'écran s'affiche, sans erreur`, (r.errs.join(' | ') || (r.lu.tombe ? 'écran tombé' : '')).slice(0, 200));
        dit(m.pdf === 0, `${vp.width} px · ${tab} : aucun octet de PDF rapatrié à l'ouverture`, Math.round(m.pdf / 1024) + ' Ko');
        dit(m.enDouble <= DOUBLONS_MAX, `${vp.width} px · ${tab} : au plus ${DOUBLONS_MAX} lectures identiques refaites`, `${m.enDouble}`);
        if (plafond != null) dit(m.n <= plafond, `${vp.width} px · ${tab} : au plus ${plafond} lectures de la base`, `${m.n}`);
        // Deux lecteurs LÉGITIMES : le pont transaction → annonce + dates de versement
        // (une projection, partagée) et la preuve de vente (une autre). Avant : 2 à 7.
        dit(m.txn <= 2, `${vp.width} px · ${tab} : la famille des transactions balayée deux fois au plus`, `${m.txn}`);
        dit(m.supprParCompte === 0, `${vp.width} px · ${tab} : les suppressions lues en une lecture, pas une par compte`, `${m.supprParCompte}`);
        // (6 nov.) Ni `vinted_item_details`, ni une ligne de commandes lue ENTIÈRE (§4.4).
        dit(m.entieres.length === 0, `${vp.width} px · ${tab} : aucune fiche de page, ligne de commandes ni dressing lu entier (select=data)`, m.entieres.join(' | ') || 'aucune');
        // (6 nov., vitesse 2) Les achats d'un ancien compte (plus dans vinted_accounts) : ni la cloche
        // « où ranger », ni le registre, ni l'export ne les lisent plus (appareil de tous les jours).
        if (MEMOIRE) dit(m.octAchatsHors === 0, `${vp.width} px · ${tab} : aucun achat d'un ancien compte lu`, `${Math.round(m.octAchatsHors / 1024)} Ko`);
        // Les fiches de page : seulement celles des annonces montrées (au plus la moitié de la ligne).
        dit(m.octFiches <= POIDS_FICHES / 2, `${vp.width} px · ${tab} : au plus la moitié de vinted_item_details rapatriée`, `${Math.round(m.octFiches / 1024)} Ko sur ${Math.round(POIDS_FICHES / 1024)} Ko`);
        // Les commandes d'un ancien compte, `orders_bought` et `wreq_*` : jamais montrées, jamais lues
        // (sur l'appareil de tous les jours ; au premier passage, voir Ma journée « appareil neuf »).
        // ⚠️ Mesuré : d'AUTRES lectures, déjà projetées, lisent encore les achats de
        // tous les comptes (la cloche « où ranger », ~100 Ko ici) — chiffre imprimé,
        // hors de ce contrôle (voir la passation du 6 nov., « ce qui reste »).
        if (MEMOIRE) dit(m.octHorsCommandes === 0, `${vp.width} px · ${tab} : la lecture des commandes ne rapporte aucune ligne qu'aucun écran ne montre (ancien compte, orders_bought, wreq)`, `${Math.round(m.octHorsCommandes / 1024)} Ko`);
        if (process.env.VITESSE_REFERENCE && tab !== 'journee') {
          const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
          let ref = null; try { ref = fs.readFileSync(path.join(process.env.VITESSE_REFERENCE, vp.width + '-' + tab + '.txt'), 'utf8'); } catch (_) {}
          const a = norm(r.lu.texte), c = norm(ref);
          let i = 0; while (i < a.length && a[i] === c[i]) i++;
          dit(ref != null && a === c, `${vp.width} px · ${tab} : texte rendu identique à celui de l'autre build (${process.env.VITESSE_REFERENCE})`, ref == null ? 'pas de référence' : a === c ? `${a.length} caractères` : `écart au caractère ${i} : « ${a.slice(Math.max(0, i - 40), i + 60)} » ≠ « ${c.slice(Math.max(0, i - 40), i + 60)} »`);
        }
        if (tab === 'journee') {
          // ── (6 nov., vitesse 2) LE PREMIER CHARGEMENT : ni un morceau à la demande, ni plus que le plafond.
          const inutiles = (r.fichiers || []).map((x) => x.f).filter((x) => MORCEAUX_A_LA_DEMANDE.test(x));
          dit(!inutiles.length, `${vp.width} px · journee : aucun morceau chargé à la demande n'est téléchargé à l'ouverture`, inutiles.join(', ') || 'aucun');
          dit(m.octJs > 0 && m.octJs <= JS_JOURNEE_MAX, `${vp.width} px · journee : au plus ${Math.round(JS_JOURNEE_MAX / 1024)} Ko de JavaScript et CSS compressés au premier chargement`, `${Math.round(m.octJs / 1024)} Ko`);
          // ── CE QUE LES AJOUTS DU 21-22 OCTOBRE FAISAIENT LIRE ET RENDRE EN TROP (22 oct.) ──
          // Mesuré par bissection (une construction par fusion de `main`) : Ma
          // journée est passée de 54 à 64 lectures et de ~13 à 15-16 rendus. Les
          // causes, chacune jugée ici pour elle-même (le plafond global ne voit
          // pas laquelle revient) :
          const gj = r.req.filter((x) => x.m === 'GET'), dj = (x) => decodeURIComponent(x.url);
          //  1. #634 (21 oct.) : les n° de suivi de TOUS les achats (560, six lectures
          //     à la suite) pour n'en utiliser que les achats au point relais ;
          //     (23 oct.) ⇒ et plus AUCUNE transaction n'est lue pour un n° de suivi :
          //     mesuré, 0 transaction sur 1 290 n'en porte (lecture morte). Les n°
          //     viennent des lignes de suivi Vinted (`harvest_{uid}_suivi_{tx}`) et
          //     des n° ajoutés à la main, lus en SCALAIRES, une fois chacun.
          const txnPourSuivi = gj.filter((x) => /id=in\.\(harvest_[^)]*_txn_/.test(dj(x))).length;
          const lignesSuivi = gj.filter((x) => /id=like\.(harvest_\*_suivi_\*|colis_suivi_\*)/.test(dj(x)));
          dit(txnPourSuivi === 0 && lignesSuivi.length >= 2 && lignesSuivi.length <= 2 && lignesSuivi.every((x) => !/select=[^&]*\bdata\b(?!->)/.test(dj(x))),
            `${vp.width} px · journee : aucun achat dont la transaction est lue pour un n° de suivi ; les lignes de suivi lues en scalaires, une fois chacune`, `${txnPourSuivi} lecture(s) de transactions · ${lignesSuivi.length} lecture(s) de lignes de suivi · ${ACHATS_AU_RELAIS} achats au point relais`);
          //  2. #635 (21 oct.) : la liste noire lue à DEUX adresses (filtrée sur le
          //     vendeur, et pas) — deux lectures que le partage ne peut pas réunir ;
          const noirs = new Set(gj.filter((x) => /id=eq\.vrm_blocked_accounts/.test(dj(x))).map((x) => x.url));
          dit(noirs.size <= 1, `${vp.width} px · journee : la liste des comptes supprimés n'est lue qu'à une seule adresse`, [...noirs].map((u) => decodeURIComponent(u).replace(/^.*\?/, '')).join(' | ') || 'aucune');
          //  3. (18 oct., revenu au rendu) : les brouillons eBay lus pour le bloc
          //     « numéros à vérifier », qui ne s'affiche que sur Annonces ;
          dit(!gj.some((x) => /ebay_brouillons/.test(dj(x))), `${vp.width} px · journee : les brouillons eBay ne sont pas lus (le bloc qui s'en sert vit sur Annonces)`, `${gj.filter((x) => /ebay_brouillons/.test(dj(x))).length} lecture(s)`);
          //  4. le signal « vrm:colis » re-rendait toute la coque (`colisTick`) puis la
          //     cloche reposait une liste identique : deux rendus de l'écran pour rien.
          dit(r.rendusSignal === 0, `${vp.width} px · journee : un signal « vrm:colis » sans rien de neuf ne re-rend pas l'écran`, `${r.rendusSignal} rendu(s)`);
          // (5. f199b91, 22 oct. : `lbc_ventes` lue avec un `signal` sortait du partage
          //  des lectures — prouvé par scripts/tests/rafraichissement-leboncoin.test.mjs.)
          // ── LES RENDUS AU DÉMARRAGE (17 octobre) ──
          // Trois ouvertures à froid (la première est celle mesurée plus haut) :
          // le nombre de rendus dépend de l'ordre d'arrivée des lectures, on
          // juge la MÉDIANE. Avant : 14 à 19 (médiane 15-16). Après : 11-12.
          // ⚠️ Et le texte rendu ne doit pas bouger d'un caractère : un rendu de
          // moins qui laisserait un chiffre en arrière serait pire (§5).
          const ns = [r.lu.rendus];
          for (let k = 0; k < 2; k++) { const rk = await ouvrir(b, vp, tab, att, null, { rendus: 'journee' }); ns.push(rk.lu.rendus); }
          const tri = ns.filter((n) => n != null).sort((x, y) => x - y);
          const med = tri.length === ns.length ? tri[1] : null;
          console.log(`     rendus de Ma journée au démarrage : ${ns.join(' · ')} (médiane ${med ?? '—'})`);
          dit(med != null && med > 0, `${vp.width} px · journee : le compteur de rendus voit l'écran (sinon le contrôle suivant ne mesurerait rien)`, ns.join('/'));
          // Le plafond vaut pour le TÉLÉPHONE (processeur ×4) : c'est là que chaque
          // rendu coûte. Sur ordinateur, sans ralentissement, les lectures arrivent
          // plus éparpillées et React les regroupe moins (mesuré : 17-21 avant,
          // 13-16 après) — chiffre imprimé, pas jugé (trop proche pour un seuil).
          if (vp.width < 600) dit(med != null && med <= RENDUS_JOURNEE_MAX, `${vp.width} px · journee : au plus ${RENDUS_JOURNEE_MAX} rendus de l'écran au démarrage (médiane de 3, téléphone ×${CPU})`, ns.join('/'));
          if (process.env.VITESSE_REFERENCE) {
            const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
            let ref = null; try { ref = fs.readFileSync(path.join(process.env.VITESSE_REFERENCE, vp.width + '-' + tab + '.txt'), 'utf8'); } catch (_) {}
            const a = norm(r.lu.texte), c = norm(ref);
            let i = 0; while (i < a.length && a[i] === c[i]) i++;
            dit(ref != null && a === c, `${vp.width} px · journee : texte rendu identique à celui de l'autre build (${process.env.VITESSE_REFERENCE})`, ref == null ? 'pas de référence' : a === c ? `${a.length} caractères` : `écart au caractère ${i} : « ${a.slice(Math.max(0, i - 40), i + 60)} » ≠ « ${c.slice(Math.max(0, i - 40), i + 60)} »`);
          }
          // ── LE PREMIER ÉCRAN : la chaîne sonde → comptes → ventes (16 octobre) ──
          // Les ventes partent EN MÊME TEMPS que les comptes (le préchargement du
          // démarrage), plus après eux : au plus deux allers-retours à la suite
          // (la sonde de schéma, puis comptes + ventes). Avant : 3, et au
          // téléphone le rendu d'AppCoeur s'intercalait (~600 ms de processeur).
          dit(m.profVentes > 0 && m.profVentes <= 2, `${vp.width} px · journee : les ventes partent au plus au 2ᵉ aller-retour (sonde, puis comptes ET ventes)`, `${m.profVentes}ᵉ`);
          const h = r.heros.filter((x) => x.v != null);
          const finale = (r.lu.texte.match(/Vendu en [^\n]*\n+([^\n]+)/) || [])[1] || '';
          dit(h.length >= 1 && h.every((x) => x.v === h[0].v), `${vp.width} px · journee : le héros apparaît UNE fois, avec sa valeur finale (jamais un chiffre provisoire)`, JSON.stringify(r.heros));
          // Le même écran quand la lecture de toutes les commandes échoue : l'app
          // retombe sur la lecture par compte (le chemin d'avant) et doit rendre
          // EXACTEMENT le même texte — la preuve que la part servie à chaque
          // compte est celle qu'il aurait lue lui-même.
          const r2 = await ouvrir(b, vp, tab, att, null, { couperFamille: true });
          const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
          const a = norm(r.lu.texte), c = norm(r2.lu.texte);
          let i = 0; while (i < a.length && a[i] === c[i]) i++;
          dit(!r2.errs.length && !r2.lu.tombe && a === c, `${vp.width} px · journee : texte rendu IDENTIQUE, préchargement ou lecture par compte`, a === c ? `${a.length} caractères` : `écart au caractère ${i} : « ${a.slice(Math.max(0, i - 40), i + 60)} » ≠ « ${c.slice(Math.max(0, i - 40), i + 60)} »`);
          // (6 nov.) Le même écran sur un APPAREIL NEUF (aucun compte lié retenu) :
          // le préchargement lit ventes et achats de tous, jamais `orders_bought`.
          if (MEMOIRE) {
            const r3 = await ouvrir(b, vp, tab, att, null, { memoire: false });
            const m3 = bilan(tab + ' (appareil neuf)', r3);
            const t3 = norm(r3.lu.texte);
            dit(!r3.errs.length && !r3.lu.tombe && t3 === a, `${vp.width} px · journee : texte rendu IDENTIQUE sur un appareil neuf`, t3 === a ? `${a.length} caractères` : 'écart');
            dit(m3.entieres.length === 0, `${vp.width} px · journee (appareil neuf) : aucune ligne lue entière`, m3.entieres.join(' | ') || 'aucune');
            res[vp.width + ':journee-neuf'] = m3;
          }
          const h2 = r2.heros.filter((x) => x.v != null);
          dit(h.length && h2.length && h[h.length - 1].v === h2[h2.length - 1].v, `${vp.width} px · journee : même « vendu ce mois » par les deux chemins`, `${h.length ? h[h.length - 1].v : '—'} / ${h2.length ? h2[h2.length - 1].v : '—'}${finale ? ' · ' + finale.slice(0, 30) : ''}`);
        }
      }
    }
    if (process.env.VITESSE_JSON) fs.writeFileSync(process.env.VITESSE_JSON, JSON.stringify(res, null, 1));
  } finally { await b.close(); srv.close(); }
  process.exit(ko ? 1 : 0);
})();
