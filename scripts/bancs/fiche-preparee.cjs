// Banc : « PRÉPARER UNE FICHE À L'AVANCE » ET « BOOSTS DU MOIS » (21 nov., ext. 5.429 — points 61 à 64).
// Données INVENTÉES (dépôt public). L'app BUILDÉE (dist/), 390 px tactile et 1512 px, clair et sombre. Il exige :
//   A1 « À publier » : la fiche porte « Préparer » ; un toucher ouvre la feuille de préparation ;
//   A2 les 3 photos du studio, la 1re en couverture ★ ; la description VIDE reçoit le modèle le plus précis (« pour Nike »,
//      pas le défaut), une variable sans valeur ({colis}) reste écrite et est NOMMÉE ; « Pour publier, il manque » la dit ;
//   A3 « Petit » choisi ⇒ « Utiliser ce modèle » remplit {colis} ; plus rien ne manque ;
//   A4 l'étoile sur la photo 3 ⇒ elle passe en 1re, les autres gardent leur ordre ;
//   A5 « Enregistrer » ⇒ la fiche rangée (photos dans SON ordre, couverture, modèle, préparée le) ; « Prête à déposer » ;
//      « Déposer 1 sur Vinted » ouvre le panneau de l'extension (lien `action=deposer&ids=<la fiche>`), rien ne part d'ici ;
//   A6 un texte qu'il a écrit n'est JAMAIS remplacé par un modèle ;
//   B1 Statistiques → « Boosts du mois » : le boost relevé (vues ×5 pendant) « a servi », coût saisi dit ;
//   F  cibles ≥ 44 px dans la feuille (téléphone), aucun débordement, aucune erreur.
require('../_source-app.cjs').brancher();
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4795;
const SHOTS = process.env.SHOTS || os.tmpdir();
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const auj = new Date(); const s = Math.floor(auj / 1000), J = 86400000;
const PNG = (() => {
  const zlib = require('zlib'); const W = 30, H = 40;
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const bloc = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const brut = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { brut[y * (W * 3 + 1)] = 0; for (let x = 0; x < W; x++) { const o = y * (W * 3 + 1) + 1 + x * 3; brut[o] = 180; brut[o + 1] = 190 + (y % 30); brut[o + 2] = 200; } }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ihdr), bloc('IDAT', zlib.deflateSync(brut)), bloc('IEND', Buffer.alloc(0))]);
})();
const IMG = 'data:image/png;base64,' + PNG.toString('base64');
const jour = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`; };
// Un boost de 5 jours qui finit hier : 10 jours à 2 vues/jour avant, 10 vues/jour pendant.
const t0 = Date.UTC(auj.getUTCFullYear(), auj.getUTCMonth(), auj.getUTCDate()) - 16 * J;
const SERIE = [...Array.from({ length: 10 }, (_, k) => `${jour(t0 + k * J)},${2 * k},0,0`), ...Array.from({ length: 5 }, (_, k) => `${jour(t0 + (10 + k) * J)},${18 + 10 * (k + 1)},${k + 1},1`), `${jour(t0 + 15 * J)},70,5,0`].join(';');
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const FICHE = { id: 'fiche-banc-2', numero: '46', titre: 'Nike Air Max 90 blanches 42', prix: 65, description: '', marque: 'Nike', modele: 'Air Max 90', taille: '42', etat: 'Très bon état', couleur: 'Blanc', categorie: 'Hommes > Chaussures > Baskets', creeAt: auj.toISOString(), origine: 'dupliquer' };
const MODELES = [{ id: 'm1', nom: 'Défaut', texte: 'Paire {marque} en {taille}.', portee: 'defaut' }, { id: 'm2', nom: 'Nike', texte: '{marque} {modele} pointure {pointure_eu}, {etat}. Couleur {couleur}, colis {colis}.', portee: 'marque', marque: 'Nike' }];
const MAIN = { vinted_annonce_numeros: { 9102: { numero: '42', fees: '1,95' } }, vinted_used_numeros: [42, 46], vrm_fiches_neuves: { [FICHE.id]: FICHE }, vrm_modeles_desc: MODELES };
const ann = { id: 9102, title: 'Salomon XT-6 blanc taille 40', price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, brand_title: 'Salomon', size_title: '40', status: 'Très bon état', view_count: 70, favourite_count: 5, promoted: false, created_at_ts: s - 40 * 86400 };
const lignes = () => [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: [ann], pagination: { total_entries: 1 } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: [] } } },
  { id: 'studio_photos_46', data: { numero: '46', photos: ['a', 'b', 'c'].map((k) => ({ id: 'sp' + k, img: IMG, at: auj.toISOString() })) } },
  { id: 'vinted_suivi_111', data: { v: 1, uid: '111', items: { i9102: SERIE }, boostes: { i9102: jour(t0 + 14 * J) } } },
];
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.429.0';
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => { const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_test' }, cmds: {} } });
    if (d.__vmr === 'cmd') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'banc' } }); });
  post({ __vmr: 'ready', version: o.version });
  window.__ouverts = []; const o0 = window.open; window.open = (u) => { window.__ouverts.push(String(u)); return { closed: false, close() {} }; };
};
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d !== undefined && d !== '' && !c ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^(data|meta)(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/^"|"$/g, '')];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
async function contexte(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sb && !localStorage.getItem('vinted_dark')) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: VERSION });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => { const t = r.request().resourceType(); if (t === 'document') return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>banc</title>' }); if (['image', 'media', 'font'].includes(t)) return r.abort(); return r.continue(); });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const rows = lignes();
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
const attendre = async (pg, f, ms = 10000) => { const t = Date.now(); let v; while (Date.now() - t < ms) { v = await pg.evaluate(f).catch(() => null); if (v) return v; await pg.waitForTimeout(200); } return v; };
const clic = async (pg, sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click({ timeout: 4000 }).catch(async () => { await pg.$eval(sel, (x) => x.click()).catch(() => {}); }); await pg.waitForTimeout(250); };
const ls = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const sombre of [false, true]) {
      const T = `${vp.width}${sombre ? ' sombre' : ' clair'}`; const tel = vp.width < 600;
      const nomF = (x) => path.join(SHOTS, `fiche-preparee-${vp.width}-${sombre ? 'sombre' : 'clair'}-${x}.png`);
      console.log(`── ${T}`);
      const { ctx, pg, errs } = await contexte(b, vp, sombre);
      try {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
        const p0 = await attendre(pg, () => (document.querySelector('[data-fiche-preparer="46"]') ? 1 : null), 25000);
        dit(p0 === 1, `A1 ${T} « À publier » : la fiche N°46 porte « Préparer »`);
        await clic(pg, '[data-fiche-preparer="46"]');
        const ouvre = await attendre(pg, () => (document.querySelector('[data-preparer="fiche-banc-2"] [data-prep-photos="3"]') ? 1 : null), 12000);
        dit(ouvre === 1, `A1 ${T} un toucher ouvre la feuille de préparation, les 3 photos du studio lues`);
        const a2 = await pg.evaluate(() => { const F = document.querySelector('[data-preparer]'); return { ordre: F.querySelector('[data-prep-ordre]').getAttribute('data-prep-ordre'), couv: (F.querySelector('[data-prep-couverture]') || {}).getAttribute && F.querySelector('[data-prep-couverture]').getAttribute('data-prep-photo'), desc: F.querySelector('textarea[data-prep-champ="description"]').value, propose: F.querySelector('[data-prep-propose]').getAttribute('data-prep-propose'), manque: F.querySelector('[data-prep-manque]').getAttribute('data-prep-manque'), etat: F.querySelector('[data-prep-manque]').textContent }; });
        dit(a2.ordre === 'spa,spb,spc' && a2.couv === 'spa' && a2.propose === 'marque' && a2.desc === 'Nike Air Max 90 pointure 42, Très bon état. Couleur Blanc, colis {colis}.' && /colis/.test(a2.manque) && /description/.test(a2.manque) && /\{colis\}/.test(a2.etat), `A2 ${T} couverture = photo 1 ; la description vide reçoit le modèle « pour Nike » ; {colis} reste écrit et est nommé`, a2);
        await pg.screenshot({ path: nomF('1-preparer') });
        await clic(pg, '[data-prep-colis="petit"]');
        await clic(pg, '[data-prep-utiliser]');
        const a3 = await pg.evaluate(() => { const F = document.querySelector('[data-preparer]'); return { desc: F.querySelector('textarea[data-prep-champ="description"]').value, manque: F.querySelector('[data-prep-manque]').getAttribute('data-prep-manque') }; });
        dit(a3.desc === 'Nike Air Max 90 pointure 42, Très bon état. Couleur Blanc, colis petit.' && a3.manque === '', `A3 ${T} « Petit » puis « Utiliser ce modèle » : {colis} rempli, plus rien ne manque`, a3);
        await clic(pg, '[data-prep-etoile="spc"]');
        const ord = await pg.getAttribute('[data-prep-ordre]', 'data-prep-ordre');
        dit(ord === 'spc,spa,spb', `A4 ${T} l’étoile sur la photo 3 : elle passe en 1re, les autres gardent leur ordre`, ord);
        // A6 : son texte à lui n'est jamais remplacé (changer la marque ne réécrit rien).
        await pg.fill('textarea[data-prep-champ="description"]', 'Mon texte à moi, écrit à la main.');
        await pg.fill('[data-prep-champ="marque"]', 'Nike ');
        const a6 = await pg.$eval('textarea[data-prep-champ="description"]', (x) => x.value);
        dit(a6 === 'Mon texte à moi, écrit à la main.', `A6 ${T} un texte qu’il a écrit n’est jamais remplacé par un modèle`, a6);
        await pg.fill('[data-prep-champ="marque"]', 'Nike');
        await clic(pg, '[data-prep-utiliser]');
        await pg.screenshot({ path: nomF('2-pret') });
        if (tel) { const petits = await pg.$$eval('[data-preparer] button, [data-preparer] input, [data-preparer] textarea', (l) => l.filter((x) => { const r = x.getBoundingClientRect(); return r.height && r.height < 43.5 && !x.classList.contains('n-lu-seul') && x.type !== 'checkbox'; }).map((x) => (x.getAttribute('aria-label') || x.textContent || x.tagName).trim().slice(0, 24))); dit(!petits.length, `F ${T} cibles ≥ 44 px dans la feuille`, petits); }
        await clic(pg, '[data-prep-enregistrer]');
        await attendre(pg, () => (!document.querySelector('[data-preparer]') ? 1 : null), 6000);
        const f = ((await ls(pg, 'vrm_fiches_neuves')) || {})['fiche-banc-2'] || {};
        const d = f.depot || {};
        dit(JSON.stringify(d.photos) === '["spc","spa","spb"]' && d.couverture === 'spc' && d.modele === 'm2' && !!d.prepareeAt && f.colis === 'petit' && f.description === 'Nike Air Max 90 pointure 42, Très bon état. Couleur Blanc, colis petit.', `A5 ${T} « Enregistrer » range la fiche : photos dans SON ordre, couverture, modèle, préparée le`, f);
        const etat = await attendre(pg, () => { const x = document.querySelector('[data-fiche-neuve-num="46"] [data-fiche-prep]'); return x ? x.getAttribute('data-fiche-prep') : null; });
        const lien = await pg.getAttribute('[data-fiche-deposer]', 'data-vrm-panneau-lien').catch(() => null);
        dit(etat === 'prete' && /vinted\.fr\/\?vrm=panneau&page=publier&ids=fiche-banc-2&action=deposer$/.test(lien || ''), `A5 ${T} « Prête à déposer » ; « Déposer 1 sur Vinted » ouvre le panneau sur CETTE fiche (rien ne part d’ici)`, { etat, lien });
        await pg.screenshot({ path: nomF('3-liste') });
        // B1 : Statistiques → « Boosts du mois ».
        await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
        const bm = await attendre(pg, () => { const x = document.querySelector('[data-boosts-mois]'); return x && !['cours'].includes(x.getAttribute('data-boosts-mois')) ? { n: x.getAttribute('data-boosts-mois'), v: [...x.querySelectorAll('[data-boost-mois-verdict]')].map((y) => y.getAttribute('data-boost-mois-verdict')), t: x.textContent } : null; }, 30000);
        dit(bm && bm.n === '1' && bm.v.join() === 'a-servi' && /1,95/.test(bm.t), `B1 ${T} « Boosts du mois » : 1 boost relevé, « a servi » (vues/jour ×5), le coût saisi dit`, bm);
        await pg.evaluate(() => { const x = document.querySelector('[data-boosts-mois]'); if (x) x.scrollIntoView({ block: 'center' }); });
        await pg.waitForTimeout(300);
        await pg.screenshot({ path: nomF('4-boosts') });
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(deb <= 1, `F ${T} aucun débordement horizontal`, deb);
        dit(!errs.length, `F ${T} aucune erreur de page`, errs.slice(0, 2).join(' | '));
      } catch (e) { dit(false, `${T} le parcours s’arrête`, e.message.split('\n')[0]); await pg.screenshot({ path: nomF('erreur') }).catch(() => {}); }
      await ctx.close();
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\nKO  ${ko} contrôle(s) rouge(s) — captures : ${SHOTS}` : `\nOK  fiche préparée et boosts du mois — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
