// Banc : eBay → Annonces · « Vendre une paire sur eBay » — LES PHOTOS D'UNE
// PAIRE PUBLIÉE SUR VINTED IL Y A 2 MINUTES (15 octobre). L'écran RENDU, sur des
// données INVENTÉES (il vit dans le dépôt, qui est public : aucune fixture).
// Port 5831 (`PORT=…` pour un autre).
//
// Julien : « j'ai publié une paire sur Vinted et 2 min après j'ai voulu la
// mettre sur eBay, VRM n'a pas capté les photos ». Mesuré : une annonce neuve
// n'a, dans le dressing, que sa COUVERTURE et le nombre réel (`nPhotos`) ; le
// formulaire lisait les photos UNE fois, à l'ouverture, et partait avec ce
// qu'il avait. Le banc rejoue le vrai dialogue du pont (`postMessage`, une
// extension simulée) et juge les `data-*` posés par l'écran (§6.5) et ce qui
// PART (vers l'extension, vers `/api/ebay`) :
//   A. (1512 px) choisir la N°31 (0 photo captée sur 14) DEMANDE à
//      l'extension de lire CETTE annonce (`cmd: 'photos'`, id + nombre voulu),
//      l'écran dit « lecture » pendant qu'elle lit, puis le formulaire porte
//      les 14 photos rangées — sans recharger ;
//   B. une photo retirée à la main pendant la lecture n'est PAS remise d'office :
//      « Reprendre les 14 photos » est proposé (une personnalisation n'est pas
//      écrasée) ;
//   C. la N°32, déjà complète : AUCUNE demande ;
//   D. une extension qui ne connaît pas la commande (« commande inconnue ») :
//      « 0 photo captée sur 14 », la raison (mettre à jour), le lien vers
//      l'annonce Vinted — et « Publier » DEMANDE avant de partir avec 1 photo
//      sur 14 (Annuler n'envoie rien ; « Publier quand même » publie) ;
//   A bis. (390 px, téléphone) rien n'est demandé, le geste est dit ;
//   E. sans extension dans ce navigateur : rien n'est demandé, l'écran le dit.
//   Aucun débordement horizontal, aucune erreur de page.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.PORT) || 5831;
const MAINTENANT = Date.parse('2026-10-15T12:00:00.000Z');
const EXT_ID = 'abcdefghijklmnopabcdefghijklmnop';

const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const img = (id, i) => `https://images1.vinted.net/t/banc/f800/${id}_${i}.jpeg?s=x`;
// N°31 : publiée sur Vinted il y a 2 minutes — 14 photos chez Vinted, AUCUNE captée.
// N°32 : déjà complète (3 sur 3).
const LISTINGS = { capturedAt: new Date(MAINTENANT).toISOString(), payload: { items: [
  { id: 7031, title: 'Nike Air Max 1 blanc taille 43', price: { amount: '90', currency_code: 'EUR' }, brand_title: 'Nike', is_closed: false, is_hidden: false, is_draft: false, nPhotos: 14, photo: { url: img(7031, 0) } },
  { id: 7032, title: 'Adidas Samba noir taille 41', price: { amount: '70', currency_code: 'EUR' }, brand_title: 'Adidas', is_closed: false, is_hidden: false, is_draft: false, nPhotos: 3, photo: { url: img(7032, 0) } },
] } };
const FICHES = { '7031': { numero: '31', title: 'Nike Air Max 1 blanc taille 43', photo: img(7031, 0) }, '7032': { numero: '32', title: 'Adidas Samba noir taille 41', photo: img(7032, 0) } };
const DETAILS0 = () => ({ '7032': { photos: [0, 1, 2].map((i) => img(7032, i)), description: 'Très bon état' } });

let rows = [], envois = [];
const remettre = () => {
  rows = [
    { id: 'main', data: { vinted_annonce_numeros: FICHES } },
    { id: 'harvest_111_listings', data: LISTINGS },
    { id: 'vinted_item_details', data: DETAILS0() },
    { id: 'ebay_listings', data: { items: [], capturedAt: MAINTENANT } },
    { id: 'ebay_orders', data: { orders: [], capturedAt: MAINTENANT } },
    { id: 'ebay_brouillons', data: { items: {}, majAt: MAINTENANT } },
    { id: 'ebay_programmees', data: { items: [], enLigne: [], complet: true, capturedAt: MAINTENANT } },
  ];
  envois = [];
};
// Ce que l'extension (simulée) range quand elle a lu la page de l'annonce.
const ranger = (id, n) => {
  const r = rows.find((x) => x.id === 'vinted_item_details');
  r.data = Object.assign({}, r.data, { [String(id)]: { photos: Array.from({ length: n }, (_, i) => img(id, i)), description: 'Neuve' } });
};

let ko = 0, okN = 0;
const dit = (c, m, d) => { if (!c) ko++; else okN++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
// Un banc ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul, ou PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};

// ── L'EXTENSION, SIMULÉE DANS LA PAGE (le vrai dialogue du pont : `ready`,
//    `ping`, `etat`, `cmd`, puis les évènements). `mode` : 'ok' (elle lit et
//    range) · 'inconnue' (une version qui ne connaît pas la commande) ·
//    'absente' (rien). `delai` : quand la lecture finit (ms).
const PONT = ({ mode, version, extId, delai }) => {
  window.__cmds = [];
  if (mode === 'absente') return;
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: extId });
    if (d.__vmr === 'etat' && d.reqId) post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: extId,
      vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_test' }, cmds: {} } });
    if (d.__vmr !== 'cmd' || !d.reqId) return;
    window.__cmds.push(JSON.parse(JSON.stringify(Object.assign({}, d, { reqId: undefined, __vmr: undefined }))));
    if (d.cmd === 'ventes') { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } }); return; }
    if (d.cmd !== 'photos') { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'inconnue', raison: 'commande inconnue' } }); return; }
    if (mode === 'inconnue') { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'inconnue', raison: 'commande inconnue' } }); return; }
    const jobId = 'photos:' + d.id;
    post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, jobId, etape: 'file' } });
    setTimeout(async () => {
      const n = Number(d.voulu) || 0;
      try { await window.__rangerPhotos(String(d.id), n); } catch (_) {}
      post({ __vmr: 'evt', evt: { type: 'cmd', jobId, etape: 'fait', n, voulu: n, at: Date.now() } });
      post({ __vmr: 'evt', evt: { type: 'maj', quoi: 'photos', id: String(d.id), n } });
    }, delai);
  });
  post({ __vmr: 'ready', version, id: extId });
};

async function ouvrir(b, vp, { mode = 'ok', delai = 2500 } = {}) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([fiches]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(fiches)); } catch (_) {} }, [FICHES]);
  await pg.exposeFunction('__rangerPhotos', (id, n) => { ranger(id, n); return true; });
  await pg.addInitScript(PONT, { mode, version: '5.177.0', extId: EXT_ID, delai });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // ⚠️ enregistré APRÈS le fourre-tout → Playwright le prend en PREMIER (§6.6).
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    envois.push(JSON.parse(JSON.stringify(body)));
    if (body.action === 'status') return j({ ok: true, connected: true });
    if (body.action === 'offreinfo') return j({ ok: true, eligibles: [], complet: true });
    if (body.action === 'finances') return j({ ok: false, reason: 'scope' });
    if (body.action === 'limites') return j({ ok: true, quantite: 10, montant: 500, devise: 'EUR', inscrit: true });
    if (body.action === 'programmees') return j({ ok: true, items: [], enLigne: [], complet: true, capturedAt: MAINTENANT });
    if (body.action === 'pubinfo') return j({ ok: true, categorie: { categoryId: '15709', suggeree: { categoryId: '15709', categoryName: 'Baskets' } }, categories: [{ categoryId: '15709', categoryName: 'Baskets' }], conditions: [{ id: '3000', label: "D'occasion" }], attributs: [{ nom: 'Marque', requis: true, mode: 'SELECTION_ONLY', valeurs: ['Nike', 'Adidas'] }], attributsObligatoires: ['Marque'] });
    if (body.action === 'publish') return j({ ok: true, itemId: '110000000777', url: 'https://www.ebay.fr/itm/110000000777', sku: body.item && body.item.numero ? 'VRM-' + body.item.numero : null });
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}
const feuille = (pg) => pg.locator('div[style*="z-index: 2000"]');
const deborde = (pg) => pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const etatPhotos = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-ebay-photos]'); return e ? { etat: e.getAttribute('data-ebay-photos'), capt: e.getAttribute('data-ebay-photos-capt'), voulu: e.getAttribute('data-ebay-photos-voulu'), raison: e.getAttribute('data-ebay-photos-raison'), txt: e.innerText } : null; });
const vignettes = (pg) => pg.$$eval('button[aria-label="Retirer"]', (els) => els.length);
const cmdsPhotos = (pg) => pg.evaluate(() => (window.__cmds || []).filter((c) => c.cmd === 'photos'));
const photo = async (pg, nom) => { try { const e = await pg.$('[data-ebay-photos]'); if (e) await e.evaluate((x) => x.scrollIntoView({ block: 'center' })); await pg.waitForTimeout(200); await pg.screenshot({ path: path.join(os.tmpdir(), nom + '.png') }); } catch (_) {} };

async function versFormulaire(pg, num) {
  await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);                    // le pont répond, l'état de l'extension est lu
  await pg.getByRole('button', { name: 'Annonces', exact: true }).first().click({ timeout: 8000 });
  await pg.waitForSelector('[data-poster="ebay"]', { timeout: 15000 });
  await pg.click('[data-poster="ebay"]');
  await pg.locator('button', { hasText: 'N°' + num }).first().click({ timeout: 8000 });
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 1512, height: 950 }]) {
      console.log(`── A. la paire publiée il y a 2 min (0 sur 14) — ${vp.width} px`);
      remettre();
      const { ctx, pg, errs } = await ouvrir(b, vp, { mode: 'ok', delai: 2500 });
      await essaie('A ' + vp.width, async () => {
        await versFormulaire(pg, 31);
        await pg.waitForTimeout(600);
        const c = await cmdsPhotos(pg);
        dit(c.length === 1 && String(c[0].id) === '7031' && Number(c[0].voulu) === 14, 'choisir la N°31 DEMANDE à l\'extension de lire CETTE annonce (id 7031, 14 voulues)', JSON.stringify(c));
        const e1 = await etatPhotos(pg);
        dit(!!(e1 && e1.etat === 'lecture' && e1.capt === '0' && e1.voulu === '14'), 'pendant la lecture, l\'écran le dit (« lecture », 0 sur 14)', JSON.stringify(e1));
        await photo(pg, 'ebay-photos-lecture-' + vp.width);
        await pg.waitForFunction(() => { const e = document.querySelector('[data-ebay-photos]'); return e && e.getAttribute('data-ebay-photos') === 'toutes'; }, null, { timeout: 12000 }).catch(() => {});
        const e2 = await etatPhotos(pg);
        const nv = await vignettes(pg);
        dit(!!(e2 && e2.etat === 'toutes' && e2.capt === '14'), 'la lecture finie, l\'écran dit « toutes » (14 sur 14) — sans recharger', JSON.stringify(e2));
        dit(nv === 14, 'le formulaire porte les 14 photos rangées (il SUIT la paire tant qu\'on n\'y touche pas)', `${nv} vignette(s)`);
        await photo(pg, 'ebay-photos-toutes-' + vp.width);
        const d = await deborde(pg);
        dit(d.sw <= d.cw + 1, 'aucun débordement horizontal', `${d.sw} / ${d.cw}`);
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }

    // A bis. SUR TÉLÉPHONE (390 px, sans souris) l'extension tourne sur
    // l'ordinateur : rien n'est demandé ici, et l'écran dit OÙ ça se passe —
    // même si un pont répondait (un vrai téléphone n'en a pas).
    console.log('── A bis. sur téléphone (390 px) : rien n\'est demandé, le geste est dit');
    {
      remettre();
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, { mode: 'ok' });
      await essaie('A bis', async () => {
        await versFormulaire(pg, 31);
        await pg.waitForTimeout(800);
        const c = await cmdsPhotos(pg);
        const e = await etatPhotos(pg);
        dit(c.length === 0, 'aucune commande envoyée depuis un téléphone', JSON.stringify(c));
        dit(!!(e && e.etat === 'manque' && e.raison === 'telephone' && e.capt === '0' && e.voulu === '14'), 'l\'écran dit 0 sur 14 et que les autres se lisent depuis l\'ordinateur', JSON.stringify(e));
        await photo(pg, 'ebay-photos-telephone-390');
        const d = await deborde(pg);
        dit(d.sw <= d.cw + 1, 'aucun débordement horizontal à 390 px', `${d.sw} / ${d.cw}`);
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }

    console.log('── B. une photo retirée à la main pendant la lecture n\'est pas remise d\'office (1512 px)');
    {
      remettre();
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, { mode: 'ok', delai: 3000 });
      await essaie('B', async () => {
        await versFormulaire(pg, 31);
        await pg.waitForTimeout(300);
        await pg.locator('button[aria-label="Retirer"]').first().click({ timeout: 3000 });
        await pg.waitForFunction(() => document.querySelector('[data-ebay-photos-reprendre]') || (document.querySelector('[data-ebay-photos]') || {}).getAttribute && document.querySelector('[data-ebay-photos]').getAttribute('data-ebay-photos') === 'toutes', null, { timeout: 12000 }).catch(() => {});
        await pg.waitForTimeout(400);
        const nv = await vignettes(pg);
        const rep = await pg.$('[data-ebay-photos-reprendre]');
        dit(nv === 0 && !!rep, 'le formulaire retouché n\'est PAS remplacé : « Reprendre les 14 photos » est proposé', `${nv} vignette(s), bouton ${rep ? 'présent' : 'absent'}`);
        if (rep) await rep.click();
        await pg.waitForTimeout(300);
        dit((await vignettes(pg)) === 14, 'un clic sur « Reprendre » remet les 14', `${await vignettes(pg)} vignette(s)`);
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }

    console.log('── C. la N°32, déjà complète : aucune demande (1512 px)');
    {
      remettre();
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, { mode: 'ok' });
      await essaie('C', async () => {
        await versFormulaire(pg, 32);
        await pg.waitForTimeout(800);
        const c = await cmdsPhotos(pg);
        const e = await etatPhotos(pg);
        dit(c.length === 0, 'aucune lecture demandée pour une paire dont les 3 photos sont déjà là', JSON.stringify(c));
        dit(!!(e && e.etat === 'toutes' && e.capt === '3'), 'l\'écran dit « toutes » (3)', JSON.stringify(e));
        dit((await vignettes(pg)) === 3, 'ses 3 photos sont dans le formulaire', `${await vignettes(pg)}`);
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }

    console.log('── D. une extension qui ne connaît pas la commande ; « Publier » demande (1512 px)');
    {
      remettre();
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, { mode: 'inconnue' });
      await essaie('D', async () => {
        await versFormulaire(pg, 31);
        await pg.waitForFunction(() => { const e = document.querySelector('[data-ebay-photos]'); return e && e.getAttribute('data-ebay-photos') === 'manque'; }, null, { timeout: 8000 }).catch(() => {});
        const e = await etatPhotos(pg);
        dit(!!(e && e.etat === 'manque' && e.raison === 'retard' && e.capt === '0' && e.voulu === '14'), 'l\'écran dit ce qui manque (0 sur 14) et la raison (« en retard »), sans rien promettre', JSON.stringify(e));
        const href = await pg.$eval('[data-ebay-photos-vinted]', (a) => a.getAttribute('href')).catch(() => '');
        dit(/\/items\/7031$/.test(href), 'le geste : l\'annonce sur Vinted, celle-là', href || 'aucun lien');
        await photo(pg, 'ebay-photos-retard-1512');
        await pg.getByRole('button', { name: 'Trouver la catégorie eBay' }).click({ timeout: 5000 });
        await pg.waitForSelector('text=Catégorie eBay', { timeout: 8000 });
        await pg.fill('input[placeholder="ex. 74"]', '90');
        await pg.waitForTimeout(300);
        await pg.click('[data-publier-ebay]');
        const vue = await feuille(pg).getByRole('button', { name: 'Publier quand même' }).waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
        const texte = vue ? await feuille(pg).innerText() : '';
        dit(vue && /1 photo sur 14/.test(texte), '« Publier » DEMANDE avant de partir avec 1 photo sur 14', texte.replace(/\s+/g, ' ').slice(0, 140) || 'aucune question posée');
        if (vue) await feuille(pg).getByRole('button', { name: 'Annuler' }).click();
        await pg.waitForTimeout(400);
        const p1 = envois.filter((x) => x.action === 'publish').length;
        dit(vue && p1 === 0, '« Annuler » n\'envoie RIEN chez eBay', `${p1} publication(s)`);
        await pg.click('[data-publier-ebay]');
        await feuille(pg).getByRole('button', { name: 'Publier quand même' }).click({ timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const pub = envois.filter((x) => x.action === 'publish');
        dit(pub.length === 1 && pub[0].item && pub[0].item.photos.length === 1, '« Publier quand même » publie, avec la photo qu\'il a', `${pub.length} publication(s)`);
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }

    console.log('── E. sans extension dans ce navigateur (1512 px)');
    {
      remettre();
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, { mode: 'absente' });
      await essaie('E', async () => {
        await versFormulaire(pg, 31);
        await pg.waitForTimeout(800);
        const e = await etatPhotos(pg);
        dit(!!(e && e.etat === 'manque' && e.raison === 'absente' && e.capt === '0'), 'rien n\'est demandé, l\'écran dit qu\'il en manque et pourquoi (extension absente ici)', JSON.stringify(e));
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }
  } catch (e) { dit(false, 'banc', String((e && e.message) || e).slice(0, 200)); }
  finally { try { if (b) await b.close(); } catch (_) {} srv.close(); }
  console.log(`\n${ko ? 'KO  ' + ko + ' rouge(s)' : 'OK  tout vert'} · ${okN} contrôle(s) au vert`);
  process.exit(ko ? 1 : 0);
})();
