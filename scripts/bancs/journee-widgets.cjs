// ═══════════════════════════════════════════════════════════════════════════
// BANC : MA JOURNÉE EN WIDGETS (21-22 octobre)
//        npm run build && BANC_PORT=… node scripts/bancs/journee-widgets.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « organiser le premier onglet comme l'écran d'accueil d'Apple, avec
// des widgets ». Données INVENTÉES (le banc vit dans le dépôt, qui est public),
// base CLOISONNÉE comme en production (la sonde de schéma répond 200 : sans ça
// l'app n'envoie rien au nuage et « la disposition est gardée » ne mesure rien),
// à 1512 px (souris) et 390 px (doigt), en clair ET en sombre :
//   A. disposition jamais touchée ⇒ LES MÊMES CHIFFRES ET LES MÊMES ACTIONS que
//      le build d'avant (rendu côte à côte : le build de la base de fusion avec
//      origin/main, fabriqué une fois, ou BANC_DIST_AVANT), les mêmes blocs ;
//      la grille porte la disposition par défaut ; UN SEUL « Modifier » VISIBLE
//      (sur téléphone la tête de l'écran est cachée : il doit être ailleurs) ;
//      ordinateur : vendu | semaine et attente | stock sur une même rangée,
//      les photos sur toute la largeur ; téléphone : tout sur toute la largeur ;
//   B. « Modifier » (le bouton visible, l'appui long au doigt) : les widgets
//      tremblent ; « À faire » n'a pas de « − » (fixe) ; le bouton de LARGEUR
//      n'existe que sur ordinateur (sur téléphone il ne changerait rien) ;
//   C. glisser un widget (souris de côté / doigt immobile puis glissé) ⇒ il
//      change de place ET on reste sur Ma journée (le glisser de côté à la
//      souris faisait changer d'onglet : vu au banc, 22 oct.) ;
//   D. « − » retire ; E. « + » ajoute (« À envoyer » : le même nombre que la
//      barre) ; E2. ordinateur : la largeur change vraiment ;
//   F. « OK » ⇒ la disposition part dans la ligne synchronisée ; un appareil
//      NEUF la retrouve ;
//   G. disposition abîmée : widget inconnu, doublon, taille fausse ignorés,
//      « À faire » (fixe) remis ;
//   H. une alerte qui ne vivait que dans une CASE (colis en retard, colis hors
//      délai à retirer) remonte en tête dès qu'aucune case ne la montre — et
//      jamais en double tant qu'une case la montre ;
//   I. « réduire les animations » : aucun tremblement ;
//   J. base injoignable : pas de « Modifier », pas de case vide de la grille.
// Jugé sur des attributs (`data-widgets`, `data-widget`, `data-job`, `data-n`…)
// et des positions rendues, jamais sur un libellé (§6.5).
// BANC_DIST=… rend un autre build (preuve sur le code d'avant : rouge).
// EXPLORE=dossier : captures.
const path = require('path');
const fs = require('fs'), http = require('http'), os = require('os'), cp = require('child_process');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const RACINE = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4593;
const SHOTS = process.env.EXPLORE || '';
const TMP = process.env.BANC_TMP || os.tmpdir();

// ── Le build d'avant, pour comparer les chiffres ─────────────────────────────
// La base de fusion avec origin/main (BANC_REF_AVANT pour une autre référence).
function distAvant() {
  if (process.env.BANC_DIST_AVANT) return process.env.BANC_DIST_AVANT;
  let sha = '';
  try {
    sha = process.env.BANC_REF_AVANT
      ? cp.execSync('git rev-parse ' + process.env.BANC_REF_AVANT, { cwd: RACINE }).toString().trim()
      : cp.execSync('git merge-base HEAD origin/main', { cwd: RACINE }).toString().trim();
  } catch (_) { return null; }
  const dir = path.join(TMP, 'vrm-journee-avant-' + sha.slice(0, 12));
  if (fs.existsSync(path.join(dir, 'dist', 'index.html'))) return path.join(dir, 'dist');
  try {
    fs.mkdirSync(dir, { recursive: true });
    cp.execSync(`git archive ${sha} | tar -x -C "${dir}"`, { cwd: RACINE, stdio: 'ignore', shell: '/bin/bash' });
    const nm = fs.existsSync(path.join(RACINE, 'node_modules')) ? fs.realpathSync(path.join(RACINE, 'node_modules')) : '/home/user/cancale-v67/node_modules';
    if (!fs.existsSync(path.join(dir, 'node_modules'))) fs.symlinkSync(nm, path.join(dir, 'node_modules'));
    cp.execSync('npx vite build --logLevel error', { cwd: dir, stdio: 'ignore', timeout: 240000 });
    return path.join(dir, 'dist');
  } catch (e) { console.log('  ⚠️ build d’avant impossible : ' + String(e.message).slice(0, 120)); return null; }
}

// ── Données inventées ───────────────────────────────────────────────────────
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, totp: [], user: { id: '33333333-3333-3333-3333-333333333333', email: 'vendeuse@exemple.test', factors: [] } };
const maintenant = new Date();
const iso = (d) => d.toISOString();
const ilYaJ = (j, h = 0) => new Date(maintenant.getTime() - j * 864e5 - h * 3600e3);
const jourLocal = (decalage) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + decalage); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const accounts = [
  { id: 1, vinted_user_id: '111', login: 'atelier_sneak', domain: 'www.vinted.fr', updated_at: iso(maintenant), created_at: iso(ilYaJ(150)), owner: null },
  { id: 2, vinted_user_id: '222', login: 'paris_kicks', domain: 'www.vinted.fr', updated_at: iso(maintenant), created_at: iso(ilYaJ(150)), owner: null },
];
// [compte, tx, prix, statut, date de vente, date de versement]
const VENTES = [
  ['111', '93001', 48.5, 'Commande finalisée', ilYaJ(9), ilYaJ(3)],
  ['111', '93002', 61, 'Commande finalisée', ilYaJ(6), ilYaJ(2)],
  ['222', '93003', 39.9, 'Commande finalisée', ilYaJ(4), ilYaJ(1)],
  ['222', '93004', 72.4, 'Le paiement a été validé', ilYaJ(14), null],   // en retard
  ['111', '93005', 55, 'Le paiement a été validé', ilYaJ(0, 2), null],   // à poster
];
const vente = (v) => ({ transaction_id: Number(v[1]), id: Number(v[1]), title: 'Baskets inventées ' + v[1], price: { amount: String(v[2]), currency_code: 'EUR' }, status: v[3], date: iso(v[4]) });
const annonce = (id, prix) => ({ id, title: 'Annonce inventée ' + id, price: { amount: String(prix), currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, is_reserved: false, item_closing_action: null, created_at_ts: iso(ilYaJ(20)), photo: null });
const rows = [];
for (const a of accounts) {
  const uid = a.vinted_user_id;
  rows.push({ id: `harvest_${uid}_orders_sold`, data: { capturedAt: iso(maintenant), payload: { my_orders: VENTES.filter((v) => v[0] === uid).map(vente) } } });
  rows.push({ id: `harvest_${uid}_listings`, data: { capturedAt: iso(new Date(maintenant.getTime() - 60000)), payload: { items: uid === '111' ? [annonce(8101, 50), annonce(8102, 65)] : [annonce(8201, 40)] } } });
}
for (const v of VENTES) if (v[5]) rows.push({ id: `harvest_${v[0]}_txn_${v[1]}`, data: { capturedAt: iso(maintenant), payload: { transaction: { id: Number(v[1]), item_id: Number(v[1]) + 500000, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(v[5]) } } } });
// Un colis à retirer HORS DÉLAI (la date limite était avant-hier) : dans Ma
// journée d'avant, il n'est dit QUE par la couleur de la case « À retirer ».
rows.push({ id: 'email_track_mondial_relay_MR777000222', data: { status: 'available', statusLabel: 'Arrivé au point de retrait', code: '4321', lieu: 'Tabac Inventé, Rennes', carrier: 'mondial_relay', suivi: 'MR777000222', artTitle: '', receivedAt: iso(ilYaJ(6)), limite: jourLocal(-2) } });
rows.push({ id: 'lbc_ventes', data: { ventes: {} } });
rows.push({ id: 'ebay_orders', data: { orders: [] } });

function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const alias = m[1] || m[2].split('->').pop().replace(/^>/, ''); const src = m[2];
    if (src === 'id' || src === 'updated_at' || src === 'owner') { out[alias] = row[src] == null ? null : row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (/^data(->|->>)/.test(src)) { const reste = src.replace(/^data(->>|->)/, ''); let v = row.data;
      for (const seg of reste.split(/->>|->/)) v = (v == null ? null : v[seg]); out[alias] = (v == null) ? null : v; continue; }
    out[alias] = row[src];
  }
  return out;
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.onnx': 'application/octet-stream', '.woff2': 'font/woff2' };
const serveur = (dist, port) => new Promise((res, rej) => {
  const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
    const p = path.join(dist, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
  srv.on('error', (e) => rej(new Error('le port ' + port + ' est pris (' + e.code + ') — relance avec BANC_PORT=…')));
  srv.listen(port, () => res(srv));
});

let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e.message || e).split('\n')[0].slice(0, 160)); } };

const TAILLES = [
  { nom: '1512 clair (souris)', vp: { width: 1512, height: 950 }, sombre: false },
  { nom: '390 sombre (doigt)', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true, sombre: true },
  { nom: '1512 sombre (souris)', vp: { width: 1512, height: 950 }, sombre: true, seulementA: true },
  { nom: '390 clair (doigt)', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true, sombre: false, seulementA: true },
];
async function page(b, T, port, opts = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, reducedMotion: opts.reduit ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  // Une vraie session (inventée) : depuis le 21 octobre, plus aucun accès
  // direct sans compte. La porte de confidentialité répond « vérifié ».
  await pg.addInitScript(([sombre, s]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); localStorage.setItem('vrm_bascule_mineral_v1', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); } catch (_) {} }, [!!T.sombre, SESSION]);
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(/\/auth\/v1\/user/.test(r.request().url()) ? SESSION.user : { access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const etat = opts.etat || { main: {} };
  await pg.route('**/rest/v1/**', (route) => {
    // La vraie forme d'une base injoignable : 522 de Cloudflare, en HTML.
    if (opts.panne) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html><body>522: Connection timed out</body></html>' });
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      // La ligne `main` écrite par l'app est GARDÉE (§6.3) : c'est elle que
      // l'appareil neuf relit.
      try { const corps = JSON.parse(route.request().postData() || 'null'); for (const x of [].concat(corps || [])) if (x && x.id === 'main' && x.data && typeof x.data === 'object') { etat.main = x.data; etat.ecrit = (etat.ecrit || 0) + 1; } } catch (_) {}
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    }
    // La sonde de schéma (sans filtre de vendeur) : base cloisonnée, comme en
    // production. Les lectures filtrées sur le vendeur reçoivent son owner
    // (crochet commun `_porte-banc`).
    if (/select=owner/.test(u) && !/owner=eq\./.test(u)) return j([]);
    const S = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: etat.main || {} }, S)]);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, S)));
    const lk = /[?&]id=like\.([^&]*)/.exec(u); if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, S))); }
    return j([]);
  });
  await pg.route('**/api/**', (r2) => r2.request().url().includes('mode=confidentialite')
    ? r2.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uid: SESSION.user.id }) })
    : r2.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  await pg.goto(`http://localhost:${port}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  if (opts.panne) { await pg.waitForTimeout(9000); return { ctx, pg, errs, etat }; }
  await pg.waitForFunction(() => document.querySelector('[data-vendu-mois]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 25000 }).catch(() => {});
  await pg.waitForFunction(() => document.querySelector('[data-courbe-semaine]') && document.querySelector('[data-stock-en-ligne]') && (document.querySelector('[data-tuile="envoyer"][data-n="2"]') || !document.querySelector('[data-barre-jour]')), null, { timeout: 10000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs, etat };
}
// Ce que montre Ma journée, en attributs et en positions.
const lire = (pg) => pg.evaluate(() => {
  const a = (s, at) => { const e = document.querySelector(s); return e ? e.getAttribute(at) : null; };
  const vu = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const grille = document.querySelector('.vrm-widgets');
  const alertes = document.querySelector('[data-alertes-argent]');
  const g = grille ? grille.getBoundingClientRect() : null;
  const rect = (id) => { const e = document.querySelector(`.vrm-widgets > [data-widget="${id}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + window.scrollY), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) }; };
  const ids = ['barre', 'afaire', 'vendu', 'semaine', 'attente', 'stock', 'recentes', 'envoyer', 'retirer', 'jours14'];
  const R = {}; for (const id of ids) R[id] = rect(id);
  return {
    tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
    journee: !!document.querySelector('.vrm-day-layout'),
    deb: document.documentElement.scrollWidth - window.innerWidth,
    tuiles: [...document.querySelectorAll('[data-barre-jour] [data-tuile]')].map((e) => e.getAttribute('data-tuile') + '=' + e.getAttribute('data-n')).join(','),
    venduMois: a('[data-vendu-mois]', 'data-vendu-mois'), recuMois: a('[data-recu-mois]', 'data-recu-mois'),
    semaine: a('[data-total-semaine]', 'data-total-semaine'), attente: a('[data-argent-attente]', 'data-argent-attente'),
    stock: a('[data-stock-en-ligne]', 'data-stock-en-ligne'),
    jobs: [...document.querySelectorAll('[data-job]')].map((e) => e.getAttribute('data-job') + '=' + (e.getAttribute('data-n') || '')).sort().join(','),
    // Les blocs de Ma journée, quels qu'en soient l'ordre et le rangement.
    blocs: [...new Set([...document.querySelectorAll('[data-barre-jour], .vrm-day-task-list:not([data-alertes-argent]), .vrm-day-money, [data-carte-jours], [data-argent-attente], .vrm-day-recent, .vrm-day-stock')]
      .map((e) => e.matches('[data-barre-jour]') ? 'barre' : e.matches('.vrm-day-task-list') ? 'afaire' : e.matches('.vrm-day-money') ? 'vendu' : e.matches('[data-carte-jours]') ? 'semaine' : e.matches('[data-argent-attente]') ? 'attente' : e.matches('.vrm-day-recent') ? 'recentes' : 'stock'))].sort().join(','),
    dispo: grille ? grille.getAttribute('data-widgets') : null,
    rendus: [...document.querySelectorAll('.vrm-widgets > [data-widget]')].map((e) => e.getAttribute('data-widget')).join(','),
    vides: document.querySelectorAll('.vrm-widgets > [data-widget][data-vide]').length,
    stockCarte: !!document.querySelector('.vrm-day-stock'),
    edition: !!(grille && grille.hasAttribute('data-edition')),
    sansBalayage: !!(grille && grille.getAttribute('data-noswipe')),
    alertesJobs: alertes ? [...alertes.querySelectorAll('[data-job]')].map((e) => e.getAttribute('data-job')).sort().join(',') : '',
    alertesHorsGrille: !!(alertes && !alertes.closest('.vrm-widgets')),
    retirerAfaire: document.querySelectorAll('[data-widget-retirer="afaire"]').length,
    retirerSurAlertes: alertes ? alertes.querySelectorAll('[data-widget-retirer]').length : 0,
    modifierVisibles: [...document.querySelectorAll('[data-widgets-modifier]')].filter(vu).length,
    tailleVisibles: [...document.querySelectorAll('[data-widget-taille-btn]')].filter(vu).length,
    anim: (() => { const e = document.querySelector('.vrm-widgets > [data-widget] .vrm-widget-in'); return e ? getComputedStyle(e).animationName : ''; })(),
    envoyerW: a('[data-widget-tuile="envoyer"]', 'data-n'),
    inconnu: !!document.querySelector('[data-widget="inconnu"]'),
    grilleL: g ? Math.round(g.width) : null, R,
    texte: document.body.innerText,
  };
});
const centre = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 40), w: r.width, h: r.height }; }, sel);
const touchSeq = async (cdp, pts, tenir) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0].x, y: pts[0].y }] });
  await new Promise((r) => setTimeout(r, tenir));
  for (const p of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y }] }); await new Promise((r) => setTimeout(r, 30)); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
const pas = (a, b, n = 10) => Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }));
// `force` : en mode « Modifier » les widgets tremblent (animation infinie) ;
// Playwright attendrait sinon qu'ils soient immobiles.
const appuyer = async (pg, T, sel) => { const l = pg.locator(sel).first(); await l.evaluate((e) => e.scrollIntoView({ block: 'center' })); if (T.hasTouch) await l.tap({ force: true }); else await l.click({ force: true }); };
// Le bouton « Modifier » que l'on VOIT (il y en a un par largeur d'écran).
const modifierVisible = (pg) => pg.evaluate(() => {
  const e = [...document.querySelectorAll('[data-widgets-modifier]')].find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(x).display !== 'none'; });
  if (!e) return false; e.scrollIntoView({ block: 'center' }); e.setAttribute('data-banc-cible', '1'); return true;
});
const sansRetard = (s) => (s || '').split(',').filter((x) => x).join(',');
const egaux = (x, y) => Math.abs(x - y) <= 3;

module.exports = { page, lire, serveur, centre, touchSeq, pas, appuyer, TAILLES, DIST, PORT, chromium };
if (require.main === module) (async () => {
  let b, srv, srvAv;
  try {
    const avant = process.env.BANC_DIST && !process.env.BANC_DIST_AVANT ? null : distAvant();
    srv = await serveur(DIST, PORT);
    if (avant) srvAv = await serveur(avant, PORT + 1);
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    for (const T of TAILLES) {
      console.log(`\n══ ${T.nom}`);
      const tag = `${T.vp.width}-${T.sombre ? 'sombre' : 'clair'}`;
      const ordi = T.vp.width >= 1024;
      console.log('── A. Disposition jamais touchée : les mêmes chiffres, les mêmes actions');
      let ref = null;
      if (avant) await essaie('A-avant' + tag, async () => {
        const { ctx, pg } = await page(b, T, PORT + 1); ref = await lire(pg);
        if (SHOTS) { await pg.setViewportSize({ width: T.vp.width, height: 2200 }); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(SHOTS, `avant-${tag}.png`) }); }
        await ctx.close();
      });
      await essaie('A' + tag, async () => {
        const { ctx, pg, errs } = await page(b, T, PORT);
        const l = await lire(pg);
        if (SHOTS) { await pg.setViewportSize({ width: T.vp.width, height: 2200 }); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(SHOTS, `widgets-${tag}-defaut.png`) }); await pg.setViewportSize(T.vp); }
        dit(!l.tombe && errs.length === 0, 'l’écran s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
        dit(l.deb <= 1, 'aucun débordement horizontal', `${l.deb} px`);
        dit(l.dispo === 'barre,afaire,vendu,semaine,attente,stock,recentes', 'la grille porte la disposition par défaut', String(l.dispo));
        dit(l.rendus === 'barre,afaire,vendu,semaine,attente,stock,recentes', 'chaque widget par défaut est rendu dans la grille', l.rendus);
        dit(l.vides === 0, 'aucune case vide dans la grille', `${l.vides}`);
        dit(l.modifierVisibles === 1, 'UN bouton « Modifier », et on le voit', `${l.modifierVisibles} visible(s)`);
        dit(l.tailleVisibles === 0, 'aucun bouton de largeur hors du mode « Modifier »', `${l.tailleVisibles}`);
        const R = l.R;
        if (ordi) {
          dit(!!(R.vendu && R.semaine && egaux(R.vendu.top, R.semaine.top) && R.semaine.left > R.vendu.left), 'ordinateur : « Vendu » et « Cette semaine » côte à côte', JSON.stringify([R.vendu, R.semaine]));
          dit(!!(R.attente && R.stock && egaux(R.attente.top, R.stock.top)), 'ordinateur : « En attente » et « Stock » côte à côte', JSON.stringify([R.attente, R.stock]));
          dit(!!(R.recentes && egaux(R.recentes.w, l.grilleL)) && !!(R.barre && egaux(R.barre.w, l.grilleL)), 'ordinateur : la barre et les photos sur toute la largeur', JSON.stringify([R.barre && R.barre.w, R.recentes && R.recentes.w, l.grilleL]));
        } else {
          const pleins = ['barre', 'afaire', 'vendu', 'semaine', 'attente', 'stock', 'recentes'].filter((id) => R[id] && egaux(R[id].w, l.grilleL));
          dit(pleins.length === 7, 'téléphone : chaque widget prend toute la largeur', pleins.join(','));
        }
        if (ref) {
          dit(l.blocs === ref.blocs, 'les mêmes blocs qu’avant', `${l.blocs} | avant ${ref.blocs}`);
          for (const k of ['tuiles', 'venduMois', 'recuMois', 'semaine', 'attente', 'stock']) dit(l[k] === ref[k] && l[k] != null && l[k] !== '', `même chiffre qu’avant : ${k}`, `${l[k]} | avant ${ref[k]}`);
          dit(sansRetard(l.jobs) === sansRetard(ref.jobs) && !!l.jobs, 'exactement les mêmes actions qu’avant (rien en double avec la barre)', `${l.jobs} | avant ${ref.jobs}`);
        } else dit(!!process.env.BANC_DIST, 'le build d’avant a pu être rendu pour comparer');
        await ctx.close();
      });
      if (T.seulementA) continue;

      console.log('── B à F. Modifier, glisser, retirer, ajouter, largeur, garder');
      const etat = { main: {} };
      await essaie('BF' + tag, async () => {
        const { ctx, pg, errs } = await page(b, T, PORT, { etat });
        const cdp = T.hasTouch ? await ctx.newCDPSession(pg) : null;
        // B. Entrer en mode « Modifier » : par le bouton VISIBLE (et, au doigt,
        // par l'appui long, vérifié plus bas sur un second écran).
        const bouton = await modifierVisible(pg);
        dit(bouton, 'un « Modifier » visible à cette largeur');
        if (bouton) { await appuyer(pg, T, '[data-banc-cible]'); await pg.waitForTimeout(400); }
        let l = await lire(pg);
        dit(l.edition, '« Modifier » passe en mode « Modifier »');
        dit(l.anim === 'vrm-w-tremble', 'les widgets tremblent', l.anim);
        dit(l.sansBalayage, 'en mode « Modifier », glisser ne change pas d’onglet (data-noswipe)');
        dit(l.retirerAfaire === 0 && l.R.afaire, '« À faire » (fixe) n’a pas de « − »', `${l.retirerAfaire}`);
        dit(ordi ? l.tailleVisibles > 0 : l.tailleVisibles === 0, ordi ? 'ordinateur : le bouton de largeur est proposé' : 'téléphone : aucun bouton de largeur (il ne changerait rien)', `${l.tailleVisibles}`);
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `widgets-${tag}-edition.png`) });
        // C. Glisser « Cette semaine » sur « Vendu et reçu » (les deux à l'écran).
        // Sur ordinateur ils sont côte à côte : le geste part DE CÔTÉ, celui qui
        // faisait changer d'onglet.
        await pg.evaluate(() => { const e = document.querySelector('[data-widget="vendu"]'); if (e) e.scrollIntoView({ block: 'center' }); });
        await pg.waitForTimeout(300);
        const pt = (id, haut) => pg.evaluate(([i, h]) => { const e = document.querySelector(`[data-widget="${i}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: h ? r.top + 40 : r.top + r.height / 2 }; }, [id, haut]);
        const de2 = await pt('semaine', true), vers2 = await pt('vendu', false);
        if (de2 && vers2) {
          if (T.hasTouch) await touchSeq(cdp, pas(de2, vers2, 14), 350);
          else { await pg.mouse.move(de2.x, de2.y); await pg.mouse.down(); for (const p of pas(de2, vers2, 14).slice(1)) await pg.mouse.move(p.x, p.y); await pg.mouse.up(); }
        }
        await pg.waitForTimeout(700);
        l = await lire(pg);
        dit(l.journee && !!l.dispo, 'après le glisser, on est toujours sur Ma journée', l.journee ? '' : l.texte.slice(0, 80).replace(/\n/g, ' '));
        const o = (l.dispo || '').split(',');
        dit(o.indexOf('semaine') >= 0 && o.indexOf('semaine') < o.indexOf('vendu'), (T.hasTouch ? 'au doigt (immobile puis glissé)' : 'à la souris, de côté') + ', glisser « Cette semaine » sur « Vendu » la place avant', l.dispo);
        // D. Retirer « semaine ».
        await appuyer(pg, T, '[data-widget-retirer="semaine"]');
        await pg.waitForTimeout(400);
        l = await lire(pg);
        dit(!(l.dispo || '').split(',').includes('semaine') && !l.rendus.includes('semaine'), '« − » retire « Cette semaine »', l.dispo);
        // E. Ajouter « À envoyer ».
        await appuyer(pg, T, '[data-widgets-ajouter]');
        await pg.waitForSelector('[data-widget-ajout="envoyer"]', { timeout: 4000 });
        dit(await pg.locator('[data-widget-ajout="semaine"]').count() === 1 && await pg.locator('[data-widget-ajout="barre"]').count() === 0 && await pg.locator('[data-widget-ajout="afaire"]').count() === 0, 'la feuille propose ce qui n’est pas sur l’écran (et seulement ça)');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `widgets-${tag}-ajout.png`) });
        await appuyer(pg, T, '[data-widget-ajout="envoyer"]');
        await pg.waitForTimeout(500);
        l = await lire(pg);
        dit((l.dispo || '').endsWith('envoyer'), '« + » ajoute « À envoyer » à la fin', l.dispo);
        const nBarre = (/envoyer=([^,]*)/.exec(l.tuiles) || [])[1];
        dit(l.envoyerW != null && l.envoyerW === nBarre, 'le widget « À envoyer » dit le même nombre que la barre', `${l.envoyerW} | barre ${nBarre}`);
        dit(!!(l.R.envoyer && l.R.envoyer.w < l.grilleL * 0.6), 'la petite case prend une seule colonne', JSON.stringify(l.R.envoyer));
        // E2. Ordinateur : la largeur change pour de vrai.
        if (ordi) {
          const avantL = l.R.vendu ? l.R.vendu.w : 0;
          await appuyer(pg, T, '[data-widget-taille-btn="vendu"]');
          await pg.waitForTimeout(500);
          l = await lire(pg);
          dit(!!(l.R.vendu && egaux(l.R.vendu.w, l.grilleL) && avantL < l.grilleL * 0.6), 'ordinateur : « largeur » passe « Vendu » de la moitié à toute la largeur', `${avantL} → ${l.R.vendu && l.R.vendu.w} / ${l.grilleL}`);
        }
        // F. OK, puis la disposition repart au nuage.
        await appuyer(pg, T, '[data-widgets-ok]');
        await pg.waitForTimeout(300);
        l = await lire(pg);
        dit(!l.edition, '« OK » quitte le mode « Modifier »');
        const attendu = l.dispo;
        await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_journee_widgets') || 'null'); } catch (_) { return false; } }, null, { timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(2500);
        const nuage = etat.main && etat.main.vrm_journee_widgets;
        dit(!!nuage && Array.isArray(nuage.w) && nuage.w.map((w) => w.id).join(',') === attendu, 'la disposition part dans la ligne synchronisée', JSON.stringify(nuage || null).slice(0, 200));
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
        // L'appareil NEUF : rien dans le navigateur, la disposition vient du nuage.
        const neuf = await page(b, T, PORT, { etat: { main: { ...etat.main } } });
        const l2 = await lire(neuf.pg);
        dit(l2.dispo === attendu, 'sur un appareil neuf, la disposition revient (rechargée du nuage)', `${l2.dispo} | attendu ${attendu}`);
        dit(!l2.rendus.includes('semaine') && l2.rendus.includes('envoyer'), 'le widget retiré reste retiré, l’ajouté reste là', l2.rendus);
        if (ordi) dit(!!(l2.R.vendu && egaux(l2.R.vendu.w, l2.grilleL)), 'la largeur choisie est gardée', JSON.stringify(l2.R.vendu));
        if (SHOTS) { await neuf.pg.setViewportSize({ width: T.vp.width, height: 2200 }); await neuf.pg.waitForTimeout(400); await neuf.pg.screenshot({ path: path.join(SHOTS, `widgets-${tag}-garde.png`) }); }
        await neuf.ctx.close();
      });

      if (T.hasTouch) {
        console.log('── B2. L’appui long au doigt');
        await essaie('B2' + tag, async () => {
          const { ctx, pg } = await page(b, T, PORT);
          const cdp = await ctx.newCDPSession(pg);
          const c = await centre(pg, '[data-widget="vendu"]');
          if (c) await touchSeq(cdp, [c], 700);
          await pg.waitForTimeout(500);
          const l = await lire(pg);
          dit(l.edition && l.journee, 'l’appui long passe en mode « Modifier » (sans quitter l’écran)');
          await ctx.close();
        });
      }

      console.log('── G. Disposition abîmée');
      await essaie('G' + tag, async () => {
        const { ctx, pg, errs } = await page(b, T, PORT, { etat: { main: { vrm_journee_widgets: { v: 1, w: [{ id: 'inconnu', t: 'grand' }, { id: 'vendu', t: 'moyen' }, { id: 'vendu', t: 'grand' }, { id: 'stock', t: 'enorme' }, { id: 'barre', t: 'petit' }] } } } });
        const l = await lire(pg);
        dit(!l.inconnu && l.dispo === 'vendu,stock,barre,afaire', 'inconnu et doublon ignorés, « À faire » (fixe) remis après la barre', String(l.dispo));
        dit(errs.length === 0 && !l.tombe, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      console.log('── H. Les alertes qui ne vivaient que dans une case');
      await essaie('H' + tag, async () => {
        // Barre, « À envoyer » et « À retirer » absents : les deux remontent.
        let s = await page(b, T, PORT, { etat: { main: { vrm_journee_widgets: { v: 1, w: [{ id: 'afaire', t: 'grand' }, { id: 'vendu', t: 'moyen' }] } } } });
        let l = await lire(s.pg);
        dit(/colis-en-retard/.test(l.alertesJobs) && /retrait-hors-delai/.test(l.alertesJobs) && l.alertesHorsGrille, 'sans aucune case : colis en retard ET hors délai dits en tête, hors grille', l.alertesJobs || '(aucune)');
        dit(l.retirerSurAlertes === 0, 'ces alertes n’ont pas de « − »');
        if (SHOTS) await s.pg.screenshot({ path: path.join(SHOTS, `widgets-${tag}-sans-cases.png`) });
        await s.ctx.close();
        // La petite case « À envoyer » est là, pas « À retirer » : seul le hors délai remonte.
        s = await page(b, T, PORT, { etat: { main: { vrm_journee_widgets: { v: 1, w: [{ id: 'afaire', t: 'grand' }, { id: 'envoyer', t: 'petit' }] } } } });
        l = await lire(s.pg);
        dit(!/colis-en-retard/.test(l.jobs) && /retrait-hors-delai/.test(l.alertesJobs), 'case « À envoyer » présente : le retard n’est pas dit deux fois ; le hors délai, lui, remonte', `${l.alertesJobs} | ${l.jobs}`);
        await s.ctx.close();
      });

      console.log('── I. « Réduire les animations » : aucun tremblement');
      await essaie('I' + tag, async () => {
        const { ctx, pg } = await page(b, T, PORT, { reduit: true });
        if (await modifierVisible(pg)) await appuyer(pg, T, '[data-banc-cible]');
        await pg.waitForTimeout(300);
        const l = await lire(pg);
        dit(l.edition && (l.anim === 'none' || l.anim === ''), 'mode « Modifier » sans tremblement', l.anim);
        await ctx.close();
      });

      console.log('── J. Base injoignable');
      await essaie('J' + tag, async () => {
        const { ctx, pg, errs } = await page(b, T, PORT, { panne: true });
        const l = await lire(pg);
        dit(l.modifierVisibles === 0, 'pendant une panne, aucun « Modifier »', `${l.modifierVisibles}`);
        dit(l.vides === 0, 'aucune case vide de la grille pendant la panne', `${l.vides}`);
        dit(!l.stockCarte, 'la panne n’est pas redite par la carte du stock (le bloc de la coque la dit, §7)');
        dit(!l.tombe && errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `widgets-${tag}-panne.png`) });
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'banc', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); if (srv) srv.close(); if (srvAv) srvAv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
