// ── BANC : CLICS DIRECTS (11 nov. 2026, lot clics-directs) ─────────────────────
//        npm run build && node scripts/bancs/clics-directs.cjs [dist]
//        SHOTS=dossier  BANC_PORT=4493
// Julien : « Dans Ma journée, quand je clique sur la pile de ventes, je ne veux pas que ça
// zoome : je veux que ça emmène sur les ventes. Dans les ventes, quand je clique sur les
// photos, je ne veux pas voir la loupe mais la photo en plus grand. »
// Données INVENTÉES (dépôt public), à la forme des lignes réelles (celles de journee-v2) ;
// une annonce du dressing porte la photo de la vente 9101 et une seconde (la galerie).
// Jugé sur les data-* et l'écran monté, jamais un libellé. On CLIQUE réellement :
//  J  Ma journée : toucher une PHOTO de la pile (le centre de la vignette du dessus) ⇒ Ventes,
//     aucune visionneuse ; au clavier (Entrée sur le bouton nommé) ⇒ Ventes. Gestes comptés.
//  V  Ventes · Vinted, la photo de la LIGNE puis celle du DÉTAIL de la vente (où vivait la loupe) :
//     aucune loupe (ni icône, ni curseur zoom) ; un toucher ouvre LA visionneuse de l'app
//     (data-visionneuse), pas l'ancien panneau (.vrm-photo-panel) ni le détail ; deux photos de
//     l'article ⇒ un balayage (doigt) / la flèche (souris) passe à la seconde ; Échap ferme et rend
//     le focus ; au clavier, Entrée ouvre.
require('./_porte-banc.cjs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4493);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-clics-directs');
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

const midi = new Date(); midi.setHours(12, 0, 0, 0);
const MAINTENANT = Date.now();
const ilYa = (j) => new Date(midi.getTime() - j * 86400000).toISOString();
const AEXP = 'Le paiement a été validé';
const PHOTO = (k) => `https://photos-banc.test/paire-${k}.png`;
const vente = (tx, titre, prix, jours) => ({ transaction_id: tx, conversation_id: tx + 1000, title: titre, price: { amount: prix.toFixed(2), currency_code: 'EUR' }, status: AEXP, transaction_user_status: 'needs_action', date: ilYa(jours), photo: { url: PHOTO(tx) } });
const VENTES = [vente(9101, 'Nike Air Max 90 taille 42', 80, 1), vente(9102, 'Adidas Samba OG taille 41', 45, 1), vente(9103, 'Nike Dunk Low Chronopost taille 44', 60, 3)];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const OV = { '9101': { numero: '117' }, '9102': { numero: '42' }, '9103': { numero: '73' } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANBQEBR8b1WQAAAABJRU5ErkJggg==', 'base64');
const bord = (tx, suivi, transporteur) => ({ id: `email_bord_${tx}`, data: { transaction: String(tx), filename: `bordereau_${tx}.pdf`, suivi, ...(transporteur ? { transporteur } : {}), receivedAt: ilYa(0.2), uid: '111', account: 'compte_banc', pdfB64: 'JVBERi0xLjQK' } });
function lignes() {
  return [
    { id: 'harvest_111_listings', data: { capturedAt: new Date(MAINTENANT - 60000).toISOString(), payload: { items: [{ id: 55101, title: 'Nike Air Max 90 taille 42', price: { amount: '80.00', currency_code: 'EUR' }, photos: [{ url: PHOTO(9101), full_size_url: PHOTO(9101) }, { url: PHOTO('9101-dos'), full_size_url: PHOTO('9101-dos') }] }] } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: VENTES } } },
    bord(9101, 'MR00099101', 'Mondial Relay'), bord(9102, 'ZZ9102'),
  ];
}
// Les attendus, faits À LA MAIN (jamais par le code de l'app).
const jourDe = (iso) => { const d = new Date(iso); d.setHours(0, 0, 0, 0); return d.getTime(); };
const isoJour = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const venduDu = (t0) => VENTES.filter((v) => jourDe(v.date) === t0).reduce((s, v) => s + Number(v.price.amount), 0);
const auj0 = jourDe(new Date().toISOString());
const J1 = auj0 - 86400000, J3 = auj0 - 3 * 86400000;
const lundiCourant = (() => { const d = new Date(auj0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); })();
const lundiPasse = (() => { const d = new Date(lundiCourant); d.setDate(d.getDate() - 7); return d.getTime(); })();
const venduSemaine = VENTES.filter((v) => { const t = Date.parse(v.date); return t >= lundiPasse && t < lundiCourant; }).reduce((s, v) => s + Number(v.price.amount), 0);

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = new Date(MAINTENANT).toISOString(); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
async function preparer(b, vp, { theme = 'light', reduit = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: theme, reducedMotion: reduit ? 'reduce' : 'no-preference', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ROWS = lignes(); const MAIN = { vinted_dark: theme === 'dark', vinted_sale_overrides: OV, vinted_bords_printed: {} };
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); localStorage.setItem('vinted_dark', JSON.stringify(sombre)); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair')); } catch (_) {} }, theme === 'dark');
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/photos-banc\.test/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: { 'access-control-allow-origin': '*' } });
    return ['media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: MAIN }, sel)]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
const shot = (pg, nom) => pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {});
const ecranMonte = (pg) => pg.evaluate(() => { const m = document.querySelector('.vrm-main'); return m ? m.getAttribute('data-ecran') : null; });
const visio = (pg) => pg.evaluate(() => { const v = document.querySelector('[data-visionneuse="ouverte"]'); return v ? { i: Number(v.getAttribute('data-visionneuse-index')), n: Number(v.getAttribute('data-visionneuse-n')), article: v.getAttribute('data-stream-article') } : null; });
const attendreEcran = (pg, re) => pg.waitForFunction((s) => { const m = document.querySelector('.vrm-main'); const d = m && m.getAttribute('data-ecran'); return d && new RegExp(s).test(d) ? d : null; }, re, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => null);

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }].filter((v) => !process.env.LARGEUR || String(v.width) === process.env.LARGEUR)) for (const theme of ['light', 'dark'].filter((t) => !process.env.THEME || t === process.env.THEME)) {
      const T = `${vp.width}px ${theme === 'dark' ? 'sombre' : 'clair'}`;
      const doigt = vp.width < 600;
      // ── J : la pile de Ma journée ──────────────────────────────────────────
      if (!process.env.SEUL || process.env.SEUL === 'J') await essaie('J ' + T, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { theme });
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-jv2-pile] .vrm-pile-v img', { timeout: 30000 });
        await pg.waitForFunction(() => [...document.querySelectorAll('[data-jv2-pile] .vrm-pile-v img')].some((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(900);   // l'éventail fini
        await shot(pg, `cd-journee-${vp.width}-${theme}`);
        // Le point touché : le centre de la vignette du DESSUS (z-index le plus haut), là où un doigt tombe.
        const pt = await pg.evaluate(() => { const v = [...document.querySelectorAll('[data-jv2-pile] .vrm-pile-v')].sort((a, c) => Number(getComputedStyle(c).zIndex) - Number(getComputedStyle(a).zIndex))[0]; const r = v.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const e = document.elementFromPoint(x, y); return { x, y, img: !!(e && e.closest('img[data-vrm-vignette]')), btn: !!(e && e.closest('[data-jv2-pile]')), w: Math.round(document.querySelector('[data-jv2-pile]').getBoundingClientRect().width), h: Math.round(document.querySelector('[data-jv2-pile]').getBoundingClientRect().height) }; });
        dit(pt.img && pt.btn, `J ${T} le point touché est bien une PHOTO de la pile`, JSON.stringify(pt));
        dit(pt.w >= 44 && pt.h >= 44, `J ${T} la pile se touche (44 px au moins)`, `${pt.w}×${pt.h}`);
        if (doigt) await pg.touchscreen.tap(pt.x, pt.y); else await pg.mouse.click(pt.x, pt.y);
        const ecran = await attendreEcran(pg, '^(?!journee$)');
        const v = await visio(pg);
        dit(/vente/.test(String(ecran)) && !v, `J ${T} UN toucher sur la photo de la pile ⇒ Ventes, aucune visionneuse (plus de zoom)`, JSON.stringify({ ecran, visionneuse: v }));
        await shot(pg, `cd-journee-apres-${vp.width}-${theme}`);
        // Clavier : le bouton nommé, Entrée ⇒ Ventes.
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-jv2-pile]', { timeout: 30000 }); await pg.waitForTimeout(600);
        const nom = await pg.getAttribute('[data-jv2-pile]', 'aria-label');
        await pg.focus('[data-jv2-pile]'); await pg.keyboard.press('Enter');
        const e2 = await attendreEcran(pg, '^(?!journee$)');
        dit(/vente/.test(String(e2)) && /vente/i.test(String(nom)) && !(await visio(pg)), `J ${T} au clavier : bouton nommé, Entrée ⇒ Ventes`, JSON.stringify({ nom, ecran: e2 }));
        dit(!errs.length, `J ${T} aucune erreur d'app`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      // ── V : la photo d'une vente ─────────────────────────────────────────
      if (!process.env.SEUL || process.env.SEUL === 'V') await essaie('V ' + T, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { theme });
        await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-selecteur-logos] button[data-site="vinted"]', { timeout: 30000 });
        await pg.locator('[data-selecteur-logos] button[data-site="vinted"]').first().click();
        const LIGNE = '.vrm-ventes-liste .vrm-sale-row:has(img[src*="paire-9101"])';
        await pg.waitForSelector(LIGNE + ' .vrm-ledger-photo-empty img', { timeout: 20000 });
        await pg.waitForFunction((L) => { const i = document.querySelector(L + ' .vrm-ledger-photo-empty img'); return i && i.complete && i.naturalWidth > 0; }, LIGNE, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(800);
        // Un toucher sur une photo, puis la visionneuse jugée : directe, deux photos, son article, balayer, Échap.
        const toucher = async (sel) => { await pg.locator(sel).first().scrollIntoViewIfNeeded(); await pg.waitForTimeout(300); const box = await pg.locator(sel).first().boundingBox(); if (doigt) await pg.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await pg.mouse.click(box.x + box.width / 2, box.y + box.height / 2); };
        const jugerVisionneuse = async (ou, selFocus, article) => {
          await pg.waitForSelector('[data-visionneuse="ouverte"]', { timeout: 5000 }).catch(() => {});
          await pg.waitForFunction(() => { const i = document.querySelector('[data-visionneuse-img]'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 }).catch(() => {});
          const v1 = await visio(pg);
          const ancien = await pg.evaluate(() => !!document.querySelector('.vrm-photo-panel, .vrm-photo-viewer'));
          dit(!!v1 && !ancien, `V ${T} ${ou} : UN toucher ⇒ la photo en grand, dans LA visionneuse de l'app (pas l'ancien panneau)`, JSON.stringify({ v1, ancien }));
          dit(!!v1 && v1.n === 2 && v1.i === 0, `V ${T} ${ou} : les deux photos de l'article sont dans la visionneuse (par fichier)`, JSON.stringify(v1));
          if (article) dit(!!v1 && /Air Max 90/.test(String(v1.article)), `V ${T} ${ou} : la visionneuse dit son article (mode stream)`, JSON.stringify(v1 && v1.article));
          await shot(pg, `cd-${ou}-visionneuse-${vp.width}-${theme}`);
          if (v1 && v1.n > 1) {
            if (doigt) {   // un vrai balayage au doigt (événements tactiles du navigateur)
              const sc = await pg.locator('.vrm-visionneuse-scene').boundingBox();
              const cdp = await ctx.newCDPSession(pg);
              const y = sc.y + sc.height / 2, x0 = sc.x + sc.width * 0.8, x1 = sc.x + sc.width * 0.2;
              await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
              for (let k = 1; k <= 8; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * k / 8, y }] }); await pg.waitForTimeout(16); }
              await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            } else await pg.locator('[data-visionneuse-fleche="apres"]').click();
            await pg.waitForTimeout(500);
            const v2 = await visio(pg);
            dit(!!v2 && v2.i === 1, `V ${T} ${ou} : ${doigt ? 'un balayage' : 'la flèche'} ⇒ la seconde photo`, JSON.stringify(v2));
          }
          await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
          const f = await pg.evaluate((sel) => ({ v: !!document.querySelector('[data-visionneuse="ouverte"]'), focus: !sel || !!(document.activeElement && document.activeElement.closest(sel)) }), selFocus);
          dit(!f.v && f.focus, `V ${T} ${ou} : Échap ferme${selFocus ? ' et rend le focus' : ''}`, JSON.stringify(f));
        };
        // 1) La photo de la LIGNE.
        await pg.locator(LIGNE + ' .vrm-ledger-photo-empty img').scrollIntoViewIfNeeded();
        if (!doigt) await pg.hover(LIGNE + ' .vrm-ledger-photo-empty img');
        const c1 = await pg.evaluate((L) => getComputedStyle(document.querySelector(L + ' .vrm-ledger-photo-empty img')).cursor, LIGNE);
        dit(!/zoom/.test(c1), `V ${T} ligne : aucune loupe au survol de la photo`, c1);
        await shot(pg, `cd-ventes-${vp.width}-${theme}`);
        if (process.env.DEBUG) console.log(await pg.evaluate((L) => { const i = document.querySelector(L + ' .vrm-ledger-photo-empty img'); const r = i.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const p = i.parentElement.closest('button'); const q = p.getBoundingClientRect(); return JSON.stringify({ r: [r.width, r.height], nat: i.naturalWidth, comp: i.complete, top: e && (e.tagName + '.' + e.className), sans: !!i.closest('[data-sans-visionneuse]'), porte: [q.width, q.height], ratio: (r.width * r.height) / (q.width * q.height), attrs: [...i.attributes].map((a) => a.name + '=' + a.value.slice(0, 60)) }); }, LIGNE));
        await toucher(LIGNE + ' .vrm-ledger-photo-empty img');
        const tiroir = await pg.evaluate(() => !!document.querySelector('.vrm-ledger-drawer-host:not([hidden])'));
        dit(!tiroir, `V ${T} ligne : toucher la photo n'ouvre pas le détail de la vente`, String(tiroir));
        await jugerVisionneuse('ligne', null, false);
        // 2) Le DÉTAIL de la vente (où vivait la loupe) : ouvert par le titre, puis la photo.
        await pg.locator(LIGNE + ' .vrm-ledger-sale-toggle').first().click({ position: { x: 200, y: 20 } });
        const PH = '.vrm-ledger-drawer-host:not([hidden]) .vrm-recap-photo .vrm-photo-open';
        await pg.waitForSelector(PH, { timeout: 10000 });
        await pg.waitForFunction((P) => { const i = document.querySelector(P + ' img'); return i && i.complete && i.naturalWidth > 0; }, PH, { timeout: 10000 }).catch(() => {});
        await pg.waitForTimeout(500);
        if (!doigt) await pg.hover(PH);
        const d = await pg.evaluate((P) => { const b0 = document.querySelector(P); const r = b0.getBoundingClientRect(); return { svgs: b0.querySelectorAll('svg').length, curseur: getComputedStyle(b0.querySelector('img')).cursor + ' ' + getComputedStyle(b0).cursor, nom: b0.getAttribute('aria-label'), r: [Math.round(r.width), Math.round(r.height)] }; }, PH);
        dit(d.svgs === 0 && !/zoom/.test(d.curseur), `V ${T} détail : aucune loupe (ni icône sur la photo, ni curseur « zoom »)`, JSON.stringify(d));
        dit(d.r[0] >= 44 && d.r[1] >= 44 && /en grand/.test(String(d.nom)), `V ${T} détail : la photo est un bouton nommé de 44 px au moins`, JSON.stringify(d));
        await shot(pg, `cd-detail-${vp.width}-${theme}`);
        await toucher(PH);
        await jugerVisionneuse('detail', '.vrm-recap-photo', true);
        // Clavier : Entrée sur la photo du détail l'ouvre en grand.
        await pg.focus(PH); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
        dit(!!(await visio(pg)), `V ${T} détail : au clavier, Entrée sur la photo l'ouvre en grand`);
        await pg.keyboard.press('Escape');
        dit(!errs.length, `V ${T} aucune erreur d'app`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} clics-directs : ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
}
main();
