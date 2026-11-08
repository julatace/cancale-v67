// ── BANC : LA BEAUTÉ (8 nov. 2026) ────────────────────────────────────────────
//        npm run build && node scripts/bancs/beaute.cjs
//        BEAUTE_SEUL=J,C,T,S,A,P  (sections)   SHOTS=dossier  BANC_PORT=4471
// Données INVENTÉES (le dépôt est public), à la forme des lignes réelles — le jeu
// du banc `tournee` : 3 ventes Vinted à expédier (80 € chacune, vendues il y a 6,
// 3 et 1 jours), N° 117 · 42 · 73, bordereaux reçus pour 9101 et 9102, deux
// colis à retirer (Kusmi Tea, Tabac du Port) + l'achat 9401 au relais ; chaque
// vente porte une photo (servie par le banc, PNG de 2 × 2).
// Jugé sur les attributs (`data-*`) et les nombres rendus, jamais sur un libellé.
//  J  Ma journée : UNE grande carte « prochaine chose » (`data-prochain`), la
//     première ligne de « À faire » ; les autres en petites cartes ; la phrase du
//     jour dit les nombres PUBLIÉS (`vrm_colis_aposter` / `vrm_colis_retirer` =
//     les cases) — 390 tactile et 1512, clair et sombre (captures).
//  C  Colis au doigt : glisser à droite au-delà du seuil ⇒ « Déposé » écrit
//     (`vinted_ship_done`), la pilule « Annuler » le défait ; glisser court ⇒
//     rien ; défilement vertical ⇒ rien, la carte ne bouge pas ; diagonale
//     surtout verticale ⇒ rien ; au clic de souris, rien ne glisse.
//  T  Tournée de dépôt : progression « 0/2 », « Déposé » ⇒ « 1/2 », « Annuler » ⇒ « 0/2 ».
//  S  Statistiques façon Santé : 12 semaines, la semaine en cours = la somme faite
//     à la main des ventes de la semaine (80 € × k) ; toucher une barre ⇒ son détail
//     (montant = celui de la barre) ; ← au clavier ; tableau caché présent.
//  A  Apparence : « Le soir » à 21 h ⇒ sombre DÈS le premier estampillage (aucun
//     clair vu, aucun flash), à 12 h ⇒ clair ; « Automatique » + système sombre ⇒
//     sombre ; rien de choisi + `vinted_dark` ⇒ comme avant ; Réglages → Apparence
//     écrit `vrm_apparence`.
//  P  Photos : la vignette d'un colis est un carré rempli (`object-fit: cover`),
//     marquée `data-vu` une fois chargée, opacité 1 ; aucune image de vignette
//     laissée invisible.
require('../_source-app.cjs').brancher();
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 4471);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-beaute');
const SEUL = (process.env.BEAUTE_SEUL || 'J,C,T,S,A,P').split(',');
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const dans = (j) => new Date(MAINTENANT + j * 86400000).toISOString().slice(0, 10);
const AEXP = 'Le paiement a été validé';
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const PHOTO = (k) => `https://photos-banc.test/paire-${k}.png`;
const vente = (tx, titre, joursVente) => ({ transaction_id: tx, conversation_id: tx + 1000, title: titre, price: { amount: '80.00', currency_code: 'EUR' }, status: AEXP, transaction_user_status: 'needs_action', date: ilYa(joursVente), photo: { url: PHOTO(tx) } });
const JOURS = [6, 3, 1];
const VENTES = [vente(9101, 'Nike Air Max 90 taille 42', JOURS[0]), vente(9102, 'Adidas Samba OG taille 41', JOURS[1]), vente(9103, 'Nike Dunk Low taille 44', JOURS[2])];
// Une vente FINALISÉE il y a 10 jours (55 €) : une semaine passée porte une vente (le détail se touche).
const FINIE = { transaction_id: 9104, conversation_id: 10104, title: 'Asics Gel-Lyte III taille 43', price: { amount: '55.00', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYa(10), photo: { url: PHOTO(9104) } };
const ACHATS = [{ transaction_id: 9401, conversation_id: 7101, title: 'Adidas Gazelle taille 40', price: { amount: '40', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(3) }];
const bord = (tx, suivi) => ({ id: `email_bord_${tx}`, data: { transaction: String(tx), filename: `bordereau_${tx}.pdf`, suivi, receivedAt: ilYa(0.2), uid: '111', account: 'compte_banc', pdfB64: 'JVBERi0xLjQK' } });
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const OV = { '9101': { numero: '117' }, '9102': { numero: '42' }, '9103': { numero: '73' } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANBQEBR8b1WQAAAABJRU5ErkJggg==', 'base64');

function lignes() {
  return [
    { id: 'harvest_111_listings', data: { capturedAt: new Date(MAINTENANT - 60000).toISOString(), payload: { items: [] } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: ACHATS } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [...VENTES, FINIE] } } },
    bord(9101, '12345678'), bord(9102, 'VGS12345678'),
    { id: 'panel_colis_relais', data: { '9401': { code: 'B11111', lieu: 'Kusmi Tea, 13 Rue Saint-Vincent, 56000 Vannes, France', at: new Date(MAINTENANT).toISOString(), url: 'https://www.vinted.fr/inbox/7101' } } },
    { id: 'email_track_vinted_1790000000000001', data: { type: 'suivi', carrier: 'vinted', suivi: '1790000000000001', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: "Ton colis t'attend", receivedAt: ilYa(1), code: 'A22222', lieu: '*Consigne Vinted Go*, * Kusmi Tea *, * 13 Rue Saint-Vincent', limite: dans(4), consigne: true } },
    { id: 'email_track_mondialrelay_87654321', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '87654321', status: 'available', statusLabel: 'Disponible en Point Relais', subject: 'Votre colis est disponible', receivedAt: ilYa(1), code: '554433', lieu: 'Tabac du Port, 12 Quai Gambetta, 35260 Cancale', limite: dans(2) } },
  ];
}
const MAIN0 = { vinted_dark: false, vinted_sale_overrides: OV, vinted_bords_printed: {} };

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
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

async function preparer(b, vp, { theme = 'light', local = {}, main = {}, heure = null, systeme = 'light' } = {}) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: systeme, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  if (heure != null) { const d = new Date(MAINTENANT); d.setHours(heure, 0, 0, 0); await pg.clock.setFixedTime(d); }
  const ROWS = lignes(); const MAIN = { ...MAIN0, ...main, vinted_dark: theme === 'dark' };
  await pg.addInitScript((loc) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const [k, v] of Object.entries(loc)) localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }, { vinted_dark: theme === 'dark', ...local });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/photos-banc\.test/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: { 'access-control-allow-origin': '*' } });
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"features":[]}' });
    if (/tiles\.openfreemap\.org/.test(u)) return r.abort();
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
const LS = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
const shot = (pg, nom) => pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {});

// Un glisser au doigt (CDP : de vrais événements tactiles ⇒ pointerType « touch »).
async function glisser(pg, sel, dx, dy, pas = 12, capture = '') {
  await pg.locator(sel).first().evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await pg.waitForTimeout(250);
  const box = await pg.locator(sel).first().boundingBox();
  if (!box) throw new Error('carte introuvable : ' + sel);
  const cdp = await pg.context().newCDPSession(pg);
  const x0 = box.x + Math.min(60, box.width / 4), y0 = box.y + Math.min(40, box.height / 3);
  const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(x0, y0) });
  for (let i = 1; i <= pas; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(x0 + (dx * i) / pas, y0 + (dy * i) / pas) }); await pg.waitForTimeout(16); }
  if (capture) await shot(pg, capture);
  const pendant = await pg.locator(sel).first().evaluate((el) => ({ tr: el.style.translate || '', pret: el.hasAttribute('data-glisse-pret') }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach().catch(() => {});
  return pendant;
}

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    // ── J. MA JOURNÉE ──────────────────────────────────────────────────────
    if (SEUL.includes('J')) for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const theme of ['light', 'dark']) {
      const T = `J ${vp.width}px ${theme === 'dark' ? 'sombre' : 'clair'}`;
      await essaie(T, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { theme });
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-barre-jour] .vrm-day-task').first().waitFor({ timeout: 30000 });
        await pg.waitForFunction(() => { const e = document.querySelector('[data-tuile="envoyer"]'); const r = document.querySelector('[data-tuile="retirer"]'); return e && r && e.getAttribute('data-n') && r.getAttribute('data-n'); }, null, { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const r = await pg.evaluate(() => {
          const L = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
          const liste = document.querySelector('[data-barre-jour]');
          const taches = [...liste.querySelectorAll('.vrm-day-task')];
          const pro = [...document.querySelectorAll('[data-prochain]')];
          const p = pro[0];
          const rp = p ? p.getBoundingClientRect() : null, rl = liste.getBoundingClientRect();
          const autres = taches.filter((t) => t !== p && !t.classList.contains('is-groupe')).map((t) => t.getBoundingClientRect().width);
          const act = p ? p.querySelector(':scope > .vrm-day-task-action') : null;
          const ph = document.querySelector('[data-phrase-jour]');
          const t = (id) => { const e = document.querySelector(`[data-tuile="${id}"]`); return e ? e.getAttribute('data-n') : null; };
          return { n: pro.length, premier: taches[0] === p, plein: rp ? Math.abs(rp.width - rl.width) < 2 : false, largeurPro: rp ? Math.round(rp.width) : 0, autres: autres.map(Math.round),
            pile: p ? (p.querySelector('.vrm-pile-v') || { getBoundingClientRect: () => ({ width: 0 }) }).getBoundingClientRect().width : 0,
            bleu: act ? getComputedStyle(act).backgroundColor : '', actH: act ? Math.round(act.getBoundingClientRect().height) : 0,
            phrase: ph ? ph.getAttribute('data-phrase-jour') : null, phEnv: ph ? ph.getAttribute('data-phrase-jour-env') : null, phRet: ph ? ph.getAttribute('data-phrase-jour-ret') : null,
            aposter: (L('vrm_colis_aposter') || {}).total, retirer: (L('vrm_colis_retirer') || {}).total, tEnv: t('envoyer'), tRet: t('retirer'),
            deb: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        dit(r.n === 1 && r.premier, `${T} UNE grande carte « prochaine chose », la première ligne de « À faire »`, JSON.stringify({ n: r.n, premier: r.premier }));
        dit(r.plein && r.autres.length > 0 && r.autres.every((w) => w < r.largeurPro * 0.7), `${T} la grande carte prend toute la largeur, les autres sont de petites cartes`, JSON.stringify({ pro: r.largeurPro, autres: r.autres }));
        dit(r.pile >= 70, `${T} sa photo en grand (≥ 70 px)`, String(r.pile));
        dit(/rgb\(0, 113, 227\)/.test(r.bleu) && r.actH >= 44, `${T} son geste en un tap : LE bouton bleu, 44 px`, `${r.bleu} ${r.actH}px`);
        dit(r.phrase && String(r.aposter) === r.phEnv && r.tEnv === r.phEnv && String(r.retirer) === r.phRet && r.tRet === r.phRet && r.phrase.startsWith(r.phEnv + ' colis'), `${T} la phrase du jour dit les nombres PUBLIÉS (à envoyer ${r.aposter}, à retirer ${r.retirer})`, JSON.stringify({ phrase: r.phrase, env: r.phEnv, ret: r.phRet, aposter: r.aposter, retirer: r.retirer, tEnv: r.tEnv, tRet: r.tRet }));
        dit(r.deb <= 1, `${T} aucun débordement`, String(r.deb));
        dit(!errs.length, `${T} aucune erreur`, errs.slice(0, 2).join(' | '));
        await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; });
        await shot(pg, `journee-${vp.width}-${theme}`);
        await pg.locator('[data-barre-jour]').first().evaluate((e) => e.scrollIntoView({ block: 'center' }));
        await pg.waitForTimeout(300);
        await shot(pg, `journee-afaire-${vp.width}-${theme}`);
        await ctx.close();
      });
    }
    // ── C. COLIS : « COLIS FAIT » AU GLISSER ────────────────────────────────
    if (SEUL.includes('C')) await essaie('C', async () => {
      const vp = { width: 390, height: 844 };
      const ouvrir = async () => {
        const o = await preparer(b, vp);
        await o.pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await o.pg.locator('[data-bord-card][data-tx-colis="9101"]').first().waitFor({ timeout: 30000 });
        await o.pg.waitForTimeout(1200);
        return o;
      };
      const SEL = '[data-bord-card][data-tx-colis="9101"]';
      const fait = async (pg) => { const s = await LS(pg, 'vinted_ship_done'); return !!(s && s['9101']); };
      // 1. glisser franc vers la droite
      let { ctx, pg, errs } = await ouvrir();
      dit(await pg.locator(SEL + '[data-glisse-fait]').count() === 1, 'C la carte « à envoyer » se glisse (data-glisse-fait)');
      const w = (await pg.locator(SEL).first().boundingBox()).width;
      const p1 = await glisser(pg, SEL, w * 0.6, 4, 12, 'colis-glisse-pendant-390');
      dit(p1.pret && /px/.test(p1.tr), 'C pendant le glisser : la carte suit le doigt, la coche est posée au seuil', JSON.stringify(p1));
      await pg.waitForTimeout(500);
      dit(await fait(pg), 'C relâchée après le seuil : « Déposé » écrit (vinted_ship_done[9101])');
      const pil = pg.locator('[data-pilule-annuler]').first();
      dit(await pil.isVisible().catch(() => false), 'C la pilule « Annuler » est là');
      await shot(pg, 'colis-glisse-annuler-390');
      await pil.click().catch(() => {});
      await pg.waitForTimeout(800);
      dit(!(await fait(pg)), 'C « Annuler » rétablit : plus rien dans vinted_ship_done[9101]');
      const tr = await pg.locator(SEL).first().evaluate((el) => el.style.translate || '');
      dit(!tr, 'C la carte est revenue en place', tr);
      dit(!errs.length, 'C aucune erreur', errs.slice(0, 2).join(' | '));
      await ctx.close();
      // 2. glisser court (sous le seuil) ⇒ rien
      ({ ctx, pg } = await ouvrir());
      const p2 = await glisser(pg, SEL, 50, 0);
      await pg.waitForTimeout(600);
      dit(!p2.pret && !(await fait(pg)) && !(await pg.locator('[data-pilule-annuler]').count()), 'C glisser court (50 px) : retour élastique, rien écrit', JSON.stringify(p2));
      await ctx.close();
      // 3. défilement vertical ⇒ rien, la carte ne bouge pas
      ({ ctx, pg } = await ouvrir());
      const p3 = await glisser(pg, SEL, 6, -260);
      await pg.waitForTimeout(600);
      dit(!p3.tr && !(await fait(pg)), 'C un défilement vertical ne déclenche rien (la carte ne bouge pas)', JSON.stringify(p3));
      await ctx.close();
      // 4. diagonale surtout verticale ⇒ rien
      ({ ctx, pg } = await ouvrir());
      const p4 = await glisser(pg, SEL, 200, -240);
      await pg.waitForTimeout(600);
      dit(!(await fait(pg)), 'C une diagonale surtout verticale ne déclenche rien', JSON.stringify(p4));
      await ctx.close();
      // 5. à la souris (ordinateur) : rien ne glisse
      const o5 = await preparer(b, { width: 1512, height: 950 });
      await o5.pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
      await o5.pg.locator(SEL).first().waitFor({ timeout: 30000 }); await o5.pg.waitForTimeout(800);
      const bx = await o5.pg.locator(SEL).first().boundingBox();
      await o5.pg.mouse.move(bx.x + 30, bx.y + 30); await o5.pg.mouse.down(); await o5.pg.mouse.move(bx.x + 500, bx.y + 34, { steps: 10 }); await o5.pg.mouse.up();
      await o5.pg.waitForTimeout(500);
      dit(!(await fait(o5.pg)), 'C à la souris : rien ne glisse (le texte reste sélectionnable)');
      await o5.ctx.close();
    });
    // ── T. LA TOURNÉE DE DÉPÔT ─────────────────────────────────────────────
    if (SEUL.includes('T')) await essaie('T', async () => {
      const { ctx, pg, errs } = await preparer(b, { width: 390, height: 844 });
      await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
      await pg.locator('[data-tournee-ouvrir]').first().waitFor({ timeout: 30000 }); await pg.waitForTimeout(800);
      await pg.locator('[data-tournee-ouvrir]').first().click();
      await pg.locator('[data-tournee-progres]').first().waitFor({ timeout: 8000 });
      const prog = () => pg.locator('[data-tournee-progres]').first().getAttribute('data-tournee-progres');
      dit(await prog() === '0/2', 'T progression au départ : 0 / 2 (deux colis avec bordereau)', await prog());
      const titre = await pg.locator('.vrm-tournee-comptoir .vrm-tournee-titre').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      const bouton = await pg.locator('[data-tournee-depose]').first().boundingBox();
      dit(titre >= 20 && bouton && bouton.height >= 56, 'T lisible debout : titre ≥ 20 px, « Déposé » ≥ 56 px', `${titre}px / ${bouton && bouton.height}px`);
      await shot(pg, 'tournee-390-avant');
      await pg.locator('[data-tournee-depose]').first().click();
      await pg.waitForTimeout(300);
      dit(await prog() === '1/2', 'T « Déposé » (le geste Colis fait) : 1 / 2', await prog());
      await shot(pg, 'tournee-390-depose');
      await pg.locator('[data-tournee-annuler]').first().click();
      await pg.waitForTimeout(300);
      dit(await prog() === '0/2', 'T « Annuler » : 0 / 2', await prog());
      dit(!errs.length, 'T aucune erreur', errs.slice(0, 2).join(' | '));
      await ctx.close();
    });
    // ── S. STATISTIQUES FAÇON SANTÉ ────────────────────────────────────────
    if (SEUL.includes('S')) for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const theme of ['light', 'dark']) {
      const T = `S ${vp.width}px ${theme === 'dark' ? 'sombre' : 'clair'}`;
      await essaie(T, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { theme });
        await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
        await pg.locator('.vrm-sante [data-sante-semaine]').first().waitFor({ timeout: 30000 }); await pg.waitForTimeout(1200);
        // À la main : lundi de cette semaine, les ventes de 80 € qui y tombent.
        const lundi = (() => { const d = new Date(MAINTENANT); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); })();
        const attenduSem = JOURS.filter((j) => MAINTENANT - j * 86400000 >= lundi).length * 8000 + (MAINTENANT - 10 * 86400000 >= lundi ? 5500 : 0);
        const r = await pg.evaluate(() => {
          const cols = [...document.querySelectorAll('.vrm-sante [data-sante-semaine]')];
          const m = document.querySelector('[data-sante-montant]');
          return { n: cols.length, eurs: cols.map((c) => Number(c.getAttribute('data-eur'))), montant: m ? Number(m.getAttribute('data-sante-montant')) : null, table: document.querySelectorAll('.vrm-sante table.vrm-sr-seul tbody tr').length,
            total: cols.reduce((s, c) => s + Number(c.getAttribute('data-eur')), 0), deb: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        dit(r.n === 12 && r.table === 12, `${T} 12 semaines dessinées, 12 lignes dans le tableau caché`, `${r.n} / ${r.table}`);
        dit(r.eurs[11] === attenduSem && r.montant === attenduSem, `${T} cette semaine = ${attenduSem / 100} € (à la main), le détail le dit`, JSON.stringify({ barre: r.eurs[11], detail: r.montant }));
        dit(r.total === 29500, `${T} les 12 semaines somment les 4 ventes (295 €, finalisée comprise) — la règle de « Vendu »`, String(r.total));
        const k = r.eurs.findIndex((v, i) => i < 11 && v > 0);
        if (k >= 0) {
          await pg.locator(`.vrm-sante [data-sante-semaine="${k}"]`).click();
          const d = await pg.evaluate(() => ({ m: Number(document.querySelector('[data-sante-montant]').getAttribute('data-sante-montant')), c: document.querySelector('.vrm-sante').getAttribute('data-sante-choisi') }));
          dit(d.c === String(k) && d.m === r.eurs[k], `${T} toucher la semaine ${k} : son détail (${r.eurs[k] / 100} €)`, JSON.stringify(d));
          await pg.keyboard.press('ArrowLeft');
          const c2 = await pg.locator('.vrm-sante').getAttribute('data-sante-choisi');
          dit(c2 === String(k - 1), `${T} ← au clavier : la semaine d’avant`, c2);
        } else dit(false, `${T} une semaine passée porte une vente`, JSON.stringify(r.eurs));
        dit(r.deb <= 1, `${T} aucun débordement`, String(r.deb));
        dit(!errs.length, `${T} aucune erreur`, errs.slice(0, 2).join(' | '));
        await pg.locator('.vrm-sante').scrollIntoViewIfNeeded().catch(() => {});
        await shot(pg, `stats-${vp.width}-${theme}`);
        await ctx.close();
      });
    }
    // ── A. APPARENCE (aucun flash) ─────────────────────────────────────────
    if (SEUL.includes('A')) {
      const cas = [
        { nom: '« Le soir » à 21 h', local: { vrm_apparence: 'soir' }, heure: 21, attendu: 'dark' },
        { nom: '« Le soir » à 12 h', local: { vrm_apparence: 'soir' }, heure: 12, attendu: 'light' },
        { nom: '« Automatique », système sombre', local: { vrm_apparence: 'auto' }, systeme: 'dark', attendu: 'dark' },
        { nom: '« Automatique », système clair', local: { vrm_apparence: 'auto' }, systeme: 'light', attendu: 'light' },
        { nom: 'rien de choisi, sombre d’avant', local: {}, theme: 'dark', heure: 12, attendu: 'dark' },
      ];
      for (const c of cas) await essaie('A ' + c.nom, async () => {
        const { ctx, pg, errs } = await preparer(b, { width: 390, height: 844 }, { local: c.local, heure: c.heure ?? null, systeme: c.systeme || 'light', theme: c.theme || 'light' });
        await pg.addInitScript(() => {
          window.__themes = [];
          const noter = () => { const t = document.documentElement.getAttribute('data-theme'); if (t && window.__themes[window.__themes.length - 1] !== t) window.__themes.push(t); };
          new MutationObserver(noter).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-theme'] });
        });
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.locator('.vrm-app-shell').first().waitFor({ timeout: 30000 }); await pg.waitForTimeout(1500);
        const r = await pg.evaluate(() => ({ vus: window.__themes, fond: getComputedStyle(document.querySelector('.vrm-app-shell')).backgroundColor, meta: (document.querySelector('meta[name="theme-color"]') || {}).content }));
        dit(r.vus.length >= 1 && r.vus.every((t) => t === c.attendu), `A ${c.nom} : ${c.attendu === 'dark' ? 'sombre' : 'clair'} dès le premier estampillage, jamais l’autre (aucun flash)`, JSON.stringify(r.vus));
        dit(c.attendu === 'dark' ? /rgb\(0, 0, 0\)/.test(r.fond) : !/rgb\(0, 0, 0\)/.test(r.fond), `A ${c.nom} : la coque suit (fond ${r.fond})`);
        dit(!errs.length, `A ${c.nom} : aucune erreur`, errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
      await essaie('A Réglages', async () => {
        const { ctx, pg } = await preparer(b, { width: 390, height: 844 }, { heure: 21 });
        await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-sous-ouvrir="apparence"]').first().waitFor({ timeout: 30000 });
        await pg.locator('[data-sous-ouvrir="apparence"]').first().click();
        await pg.locator('[data-apparence="soir"]').first().click();
        await pg.waitForTimeout(1800);
        const r = await pg.evaluate(() => ({ a: JSON.parse(localStorage.getItem('vrm_apparence') || 'null'), t: document.documentElement.getAttribute('data-theme') }));
        dit(r.a === 'soir' && r.t === 'dark', 'A Réglages → Apparence → « Le soir » (21 h) : écrit et sombre tout de suite', JSON.stringify(r));
        await shot(pg, 'reglages-apparence-390-soir');
        await pg.locator('[data-apparence="clair"]').first().click(); await pg.waitForTimeout(1800);
        const r2 = await pg.evaluate(() => ({ a: JSON.parse(localStorage.getItem('vrm_apparence') || 'null'), d: JSON.parse(localStorage.getItem('vinted_dark') || 'null'), t: document.documentElement.getAttribute('data-theme') }));
        dit(r2.a === 'clair' && r2.d === false && r2.t === 'light', 'A « Clair » : écrit (et `vinted_dark` faux), clair tout de suite', JSON.stringify(r2));
        await ctx.close();
      });
    }
    // ── P. PHOTOS ──────────────────────────────────────────────────────────
    if (SEUL.includes('P')) await essaie('P', async () => {
      const { ctx, pg } = await preparer(b, { width: 390, height: 844 });
      await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
      await pg.locator('.vrm-colis-photo img').first().waitFor({ timeout: 30000 }); await pg.waitForTimeout(2000);
      const r = await pg.evaluate(() => [...document.querySelectorAll('.vrm-colis-photo img')].map((img) => { const c = img.parentElement.getBoundingClientRect(), i = img.getBoundingClientRect(), cs = getComputedStyle(img), cc = getComputedStyle(img.parentElement);
        return { vu: img.hasAttribute('data-vu'), op: cs.opacity, fit: cs.objectFit, rempli: Math.abs(c.width - i.width) < 1.5 && Math.abs(c.height - i.height) < 1.5, carre: Math.abs(c.width - c.height) < 1.5, rayon: cc.borderTopLeftRadius }; }));
      dit(r.length >= 3, 'P les colis ont leur vignette', String(r.length));
      dit(r.every((x) => x.vu && x.op === '1'), 'P chaque vignette chargée est marquée (data-vu) et visible (opacité 1)', JSON.stringify(r.map((x) => [x.vu, x.op])));
      dit(r.every((x) => x.fit === 'cover' && x.rempli && x.carre), 'P un carré rempli, centré (object-fit: cover)', JSON.stringify(r.map((x) => [x.fit, x.rempli, x.carre])));
      dit(r.every((x) => x.rayon === '14px'), 'P le même rayon (14 px) partout', JSON.stringify(r.map((x) => x.rayon)));
      await ctx.close();
    });
  } finally { await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} échec(s) — captures : ${SHOTS}` : `\nTout est vert — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
}
main();
