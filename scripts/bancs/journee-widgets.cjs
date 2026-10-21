// ═══════════════════════════════════════════════════════════════════════════
// BANC : MA JOURNÉE EN WIDGETS (21 octobre)
//        npm run build && node scripts/bancs/journee-widgets.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « organiser le premier onglet comme l'écran d'accueil d'Apple, avec
// des widgets ». Données INVENTÉES (le banc vit dans le dépôt, qui est public),
// à 1512 px (clair, souris) et à 390 px (sombre, doigt) :
//   A. disposition jamais touchée ⇒ les blocs d'avant, dans le même ordre, et
//      LES MÊMES CHIFFRES que le build d'avant (rendu côte à côte : le build de
//      `origin/main`, fabriqué une fois, ou BANC_DIST_AVANT) ; les alertes
//      d'argent (colis en retard) en tête, HORS de la grille ;
//   B. « Modifier » (le bouton à la souris, l'appui long au doigt) : les widgets
//      tremblent (rien si « réduire les animations »), les alertes d'argent n'ont
//      aucun « − » ;
//   C. glisser un widget (souris / doigt immobile puis glissé) ⇒ il change de place ;
//   D. « − » retire un widget ; E. « + » en ajoute un (« À envoyer » : le même
//      nombre que la case de la barre) ; F. « OK », puis un appareil NEUF (la
//      disposition revient du nuage) ⇒ la disposition est gardée ;
//   G. un widget inconnu dans la disposition est ignoré ;
//   H. la barre retirée, les colis en retard restent dits en tête.
// Jugé sur des attributs (`data-widgets`, `data-widget`, `data-job`, `data-n`…),
// jamais sur un libellé (§6.5).
// BANC_DIST=… rend un autre build (preuve sur le code d'avant : il doit sortir rouge).
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

// ── Le build d'avant, pour comparer les chiffres ─────────────────────────────
function distAvant() {
  if (process.env.BANC_DIST_AVANT) return process.env.BANC_DIST_AVANT;
  // Le dernier `main` avant les widgets (BANC_REF_AVANT pour un autre).
  let sha = '';
  try { sha = cp.execSync('git rev-parse ' + (process.env.BANC_REF_AVANT || 'dc6ac10fbadb'), { cwd: RACINE }).toString().trim(); } catch (_) { return null; }
  const dir = path.join(os.tmpdir(), 'vrm-journee-avant-' + sha.slice(0, 12));
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
rows.push({ id: 'lbc_ventes', data: { ventes: {} } });
rows.push({ id: 'ebay_orders', data: { orders: [] } });

function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const alias = m[1] || m[2].split('->').pop().replace(/^>/, ''); const src = m[2];
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
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
  { nom: '1512 clair', vp: { width: 1512, height: 950 }, sombre: false },
  { nom: '390 sombre (tactile)', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true, sombre: true },
];
async function page(b, T, port, opts = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, reducedMotion: opts.reduit ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  // Une vraie session (inventée) : depuis le 21 octobre, plus aucun accès
  // direct sans compte. La porte de confidentialité répond « vérifié ».
  await pg.addInitScript(([sombre, s]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); } catch (_) {} }, [!!T.sombre, SESSION]);
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const etat = opts.etat || { main: {} };
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      // La ligne `main` écrite par l'app est GARDÉE (§6.3) : c'est elle que
      // l'appareil neuf relit.
      try { const corps = JSON.parse(route.request().postData() || 'null'); for (const x of [].concat(corps || [])) if (x && x.id === 'main' && x.data && typeof x.data === 'object') { etat.main = x.data; etat.ecrit = (etat.ecrit || 0) + 1; } } catch (_) {}
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    const S = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: etat.main || {} }, S)]);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, S)));
    const lk = /id=like\.([^&]*)/.exec(u); if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, S))); }
    return j([]);
  });
  await pg.route('**/api/**', (r2) => r2.request().url().includes('mode=confidentialite')
    ? r2.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uid: SESSION.user.id }) })
    : r2.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  await pg.goto(`http://localhost:${port}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('[data-vendu-mois]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 25000 }).catch(() => {});
  await pg.waitForFunction(() => document.querySelector('[data-courbe-semaine]') && document.querySelector('[data-stock-en-ligne]') && document.querySelector('[data-barre-jour] [data-n="2"]'), null, { timeout: 10000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  return { ctx, pg, errs, etat };
}
// Ce que montre Ma journée, en attributs.
const lire = (pg) => pg.evaluate(() => {
  const a = (s, at) => { const e = document.querySelector(s); return e ? e.getAttribute(at) : null; };
  const grille = document.querySelector('.vrm-widgets');
  const alertes = document.querySelector('[data-alertes-argent]');
  return {
    tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
    deb: document.documentElement.scrollWidth - window.innerWidth,
    tuiles: [...document.querySelectorAll('[data-barre-jour] [data-tuile]')].map((e) => e.getAttribute('data-tuile') + '=' + e.getAttribute('data-n')).join(','),
    venduMois: a('[data-vendu-mois]', 'data-vendu-mois'), recuMois: a('[data-recu-mois]', 'data-recu-mois'),
    semaine: a('[data-total-semaine]', 'data-total-semaine'), attente: a('[data-argent-attente]', 'data-argent-attente'),
    stock: a('[data-stock-en-ligne]', 'data-stock-en-ligne'),
    jobs: [...document.querySelectorAll('[data-job]')].map((e) => e.getAttribute('data-job') + '=' + (e.getAttribute('data-n') || '')).sort().join(','),
    // L'ordre des BLOCS d'avant, tels qu'ils apparaissent dans la page.
    blocs: [...document.querySelectorAll('[data-barre-jour], .vrm-day-task-list:not([data-alertes-argent]), .vrm-day-money, [data-carte-jours], [data-argent-attente], .vrm-day-recent, .vrm-day-stock')]
      .map((e) => e.matches('[data-barre-jour]') ? 'barre' : e.matches('.vrm-day-task-list') ? 'afaire' : e.matches('.vrm-day-money') ? 'vendu' : e.matches('[data-carte-jours]') ? 'semaine' : e.matches('[data-argent-attente]') ? 'attente' : e.matches('.vrm-day-recent') ? 'recentes' : 'stock').join(','),
    dispo: grille ? grille.getAttribute('data-widgets') : null,
    rendus: [...document.querySelectorAll('.vrm-widgets > [data-widget]')].map((e) => e.getAttribute('data-widget')).join(','),
    edition: !!(grille && grille.hasAttribute('data-edition')),
    retard: !!(alertes && alertes.querySelector('[data-job="colis-en-retard"]')),
    retardHorsGrille: !!(alertes && !alertes.closest('.vrm-widgets')),
    retirerSurAlertes: alertes ? alertes.querySelectorAll('[data-widget-retirer]').length : -1,
    modifier: document.querySelectorAll('[data-widgets-modifier]').length,
    anim: (() => { const e = document.querySelector('.vrm-widgets > [data-widget] .vrm-widget-in'); return e ? getComputedStyle(e).animationName : ''; })(),
    envoyerW: a('[data-widget-tuile="envoyer"]', 'data-n'),
    inconnu: !!document.querySelector('[data-widget="inconnu"]'),
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

(async () => {
  let b, srv, srvAv;
  try {
    const avant = process.env.BANC_DIST ? null : distAvant();
    srv = await serveur(DIST, PORT);
    if (avant) srvAv = await serveur(avant, PORT + 1);
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    for (const T of TAILLES) {
      console.log(`\n══ ${T.nom}`);
      const tag = T.vp.width;
      console.log('── A. Disposition jamais touchée : comme avant');
      let ref = null;
      if (avant) await essaie('A-avant' + tag, async () => {
        const { ctx, pg } = await page(b, T, PORT + 1); ref = await lire(pg); await ctx.close();
      });
      await essaie('A' + tag, async () => {
        const { ctx, pg, errs } = await page(b, T, PORT);
        const l = await lire(pg);
        if (SHOTS) { await pg.setViewportSize({ width: T.vp.width, height: 2200 }); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(SHOTS, `widgets-${tag}-defaut.png`) }); await pg.setViewportSize(T.vp); }
        dit(!l.tombe && errs.length === 0, 'l’écran s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
        dit(l.deb <= 1, 'aucun débordement horizontal', `${l.deb} px`);
        dit(l.dispo === 'barre,afaire,vendu,semaine,attente,recentes,stock', 'la grille porte la disposition d’origine', String(l.dispo));
        dit(!!l.rendus && l.rendus.startsWith('barre') && l.rendus.includes('vendu') && l.rendus.includes('stock'), 'les widgets sont rendus dans la grille', l.rendus);
        dit(l.modifier === 1, 'un bouton « Modifier », discret, en haut', `${l.modifier}`);
        dit(l.retard && l.retardHorsGrille, 'les colis en retard sont dits EN TÊTE, hors de la grille', JSON.stringify({ retard: l.retard, hors: l.retardHorsGrille }));
        if (ref) {
          dit(l.blocs === ref.blocs, 'les blocs d’avant, dans le même ordre', `${l.blocs} | avant ${ref.blocs}`);
          for (const k of ['tuiles', 'venduMois', 'recuMois', 'semaine', 'attente', 'stock']) dit(l[k] === ref[k], `même chiffre qu’avant : ${k}`, `${l[k]} | avant ${ref[k]}`);
          const sansRetard = (s) => s.split(',').filter((x) => x && !x.startsWith('colis-en-retard=')).join(',');
          dit(sansRetard(l.jobs) === sansRetard(ref.jobs), 'mêmes actions qu’avant (plus l’alerte « colis en retard »)', `${l.jobs} | avant ${ref.jobs}`);
        } else dit(!!process.env.BANC_DIST, 'le build d’avant a pu être rendu pour comparer');
        await ctx.close();
      });

      console.log('── B à F. Modifier, glisser, retirer, ajouter, garder');
      const etat = { main: {} };
      await essaie('BF' + tag, async () => {
        const { ctx, pg, errs } = await page(b, T, PORT, { etat });
        const cdp = T.hasTouch ? await ctx.newCDPSession(pg) : null;
        // B. Entrer en mode « Modifier ».
        if (T.hasTouch) {
          const c = await centre(pg, '[data-widget="vendu"]');
          if (c) await touchSeq(cdp, [c], 700);
          await pg.waitForTimeout(400);
        } else await appuyer(pg, T, '[data-widgets-modifier]');
        await pg.waitForTimeout(300);
        let l = await lire(pg);
        dit(l.edition, T.hasTouch ? 'l’appui long passe en mode « Modifier »' : '« Modifier » passe en mode « Modifier »');
        dit(l.anim === 'vrm-w-tremble', 'les widgets tremblent', l.anim);
        dit(l.retirerSurAlertes === 0 && l.retard, 'les alertes d’argent n’ont aucun « − » (non retirables)', `${l.retirerSurAlertes}`);
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `widgets-${tag}-edition.png`) });
        // C. Glisser « Cette semaine » sur « Vendu et reçu » (les deux à l'écran).
        await pg.evaluate(() => { const e = document.querySelector('[data-widget="vendu"]'); if (e) e.scrollIntoView({ block: 'start' }); });
        await pg.waitForTimeout(300);
        const pt = (id, haut) => pg.evaluate(([i, h]) => { const e = document.querySelector(`[data-widget="${i}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: h ? r.top + 24 : r.top + r.height / 2 }; }, [id, haut]);
        const de2 = await pt('semaine', true), vers2 = await pt('vendu', false);
        if (de2 && vers2) {
          if (T.hasTouch) await touchSeq(cdp, pas(de2, vers2, 14), 350);
          else { await pg.mouse.move(de2.x, de2.y); await pg.mouse.down(); for (const p of pas(de2, vers2, 14).slice(1)) await pg.mouse.move(p.x, p.y); await pg.mouse.up(); }
        }
        await pg.waitForTimeout(500);
        l = await lire(pg);
        const o = (l.dispo || '').split(',');
        dit(o.indexOf('semaine') >= 0 && o.indexOf('semaine') < o.indexOf('vendu'), (T.hasTouch ? 'au doigt (immobile puis glissé)' : 'à la souris') + ', glisser « Cette semaine » sur « Vendu » la place avant', l.dispo);
        // D. Retirer « semaine ».
        await appuyer(pg, T, '[data-widget-retirer="semaine"]');
        await pg.waitForTimeout(400);
        l = await lire(pg);
        dit(!(l.dispo || '').split(',').includes('semaine') && !l.rendus.includes('semaine'), '« − » retire « Cette semaine »', l.dispo);
        // E. Ajouter « À envoyer ».
        await appuyer(pg, T, '[data-widgets-ajouter]');
        await pg.waitForSelector('[data-widget-ajout="envoyer"]', { timeout: 4000 });
        dit(await pg.locator('[data-widget-ajout="semaine"]').count() === 1 && await pg.locator('[data-widget-ajout="barre"]').count() === 0, 'la feuille propose ce qui n’est pas sur l’écran (et seulement ça)');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `widgets-${tag}-ajout.png`) });
        await appuyer(pg, T, '[data-widget-ajout="envoyer"]');
        await pg.waitForTimeout(500);
        l = await lire(pg);
        dit((l.dispo || '').endsWith('envoyer'), '« + » ajoute « À envoyer » à la fin', l.dispo);
        const nBarre = (/envoyer=([^,]*)/.exec(l.tuiles) || [])[1];
        dit(l.envoyerW != null && l.envoyerW === nBarre, 'le widget « À envoyer » dit le même nombre que la barre', `${l.envoyerW} | barre ${nBarre}`);
        // F. OK, puis la disposition repart au nuage.
        await appuyer(pg, T, '[data-widgets-ok]');
        await pg.waitForTimeout(300);
        l = await lire(pg);
        dit(!l.edition, '« OK » quitte le mode « Modifier »');
        const attendu = l.dispo;
        await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_journee_widgets') || 'null'); } catch (_) { return false; } }, null, { timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(2500);
        const nuage = etat.main && etat.main.vrm_journee_widgets;
        dit(!!nuage && Array.isArray(nuage.w) && nuage.w.map((w) => w.id).join(',') === attendu, 'la disposition part dans la ligne synchronisée', JSON.stringify(nuage || null).slice(0, 160));
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
        // L'appareil NEUF : rien dans le navigateur, la disposition vient du nuage.
        const neuf = await page(b, T, PORT, { etat: { main: { ...etat.main } } });
        const l2 = await lire(neuf.pg);
        dit(l2.dispo === attendu, 'sur un appareil neuf, la disposition revient (rechargée du nuage)', `${l2.dispo} | attendu ${attendu}`);
        dit(!l2.rendus.includes('semaine') && l2.rendus.includes('envoyer'), 'le widget retiré reste retiré, l’ajouté reste là', l2.rendus);
        dit(l2.retard && l2.retardHorsGrille, 'les colis en retard restent en tête', '');
        if (SHOTS) { await neuf.pg.setViewportSize({ width: T.vp.width, height: 2200 }); await neuf.pg.waitForTimeout(400); await neuf.pg.screenshot({ path: path.join(SHOTS, `widgets-${tag}-garde.png`) }); }
        await neuf.ctx.close();
      });

      console.log('── G. Widget inconnu ignoré · H. barre retirée : le retard reste dit');
      await essaie('GH' + tag, async () => {
        const { ctx, pg, errs } = await page(b, T, PORT, { etat: { main: { vrm_journee_widgets: { v: 1, w: [{ id: 'inconnu', t: 'grand' }, { id: 'vendu', t: 'moyen' }, { id: 'vendu', t: 'grand' }, { id: 'stock', t: 'enorme' }] } } } });
        const l = await lire(pg);
        dit(!l.inconnu && l.dispo === 'vendu,stock', 'un widget inconnu (et un doublon) est ignoré', String(l.dispo));
        dit(!l.tuiles, 'sans la barre, aucune case de la barre', l.tuiles);
        dit(l.retard && l.retardHorsGrille, 'barre retirée : les colis en retard sont toujours dits en tête');
        dit(errs.length === 0 && !l.tombe, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      console.log('── I. « Réduire les animations » : aucun tremblement');
      await essaie('I' + tag, async () => {
        const { ctx, pg } = await page(b, T, PORT, { reduit: true });
        await pg.evaluate(() => { const e = document.querySelector('[data-widgets-modifier]'); if (e) e.click(); });
        await pg.waitForTimeout(300);
        const l = await lire(pg);
        dit(l.edition && (l.anim === 'none' || l.anim === ''), 'mode « Modifier » sans tremblement', l.anim);
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'banc', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); if (srv) srv.close(); if (srvAv) srvAv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
