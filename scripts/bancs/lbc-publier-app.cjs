// Banc : LA FICHE « PUBLIER SUR LEBONCOIN » DE L'APP (5.182).
//   node scripts/bancs/lbc-publier-app.cjs        (port fixe 4931)
//
// Julien, 16 octobre : « je veux que le poste d'annonce sur leboncoin se fasse
// comme pour eBay, pour tout gérer depuis VRM ». Sur des données INVENTÉES (il
// vit dans le dépôt, public), l'écran Leboncoin de l'app est RENDU (dist/,
// Chromium) à 390 px (téléphone tactile) et 1512 px, avec le VRAI dialogue du
// pont simulé (`ready` / `etat` / `cmd` / `evt`). Il exige :
//   A. la fiche s'ouvre depuis la ligne et MONTRE ce qui partira : le titre
//      Leboncoin (≤ 50), la description avec sa référence VRM-{n°}, le prix, les
//      photos captées (toutes cochées, la 1ʳᵉ en couverture), la catégorie, le
//      compte Vinted d'où vient la paire ;
//   B. on corrige (titre, prix, l'ordre des photos) et « Publier sur Leboncoin »
//      envoie `lbcPublier` avec l'annonce CORRIGÉE — le corps exact est jugé ;
//   C. l'avancement renvoyé par l'extension s'affiche en direct (photos posées
//      2/3, publication), puis « Publiée sur Leboncoin ✓ » ;
//   D. une fiche invalide (titre de 60 caractères) : bouton grisé, la raison
//      dite, et un clic n'envoie RIEN ;
//   E. un champ obligatoire que VRM ne devine pas : la fiche le NOMME ;
//   F. extension plus ancienne que la 5.182 : une fiche CORRIGÉE ne part pas
//      (grisé, la raison) ; non corrigée, elle part « tel quel » (l'identifiant
//      seul, l'extension publie sa version) — jamais de promesse de plus ;
//   G. aucun débordement horizontal, aucune erreur de page ; une capture par
//      taille, regardée (rangée dans le dossier temporaire).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), zlib = require('zlib'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4931;
const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8');
const EXT_ATTENDUE = (/const EXT_ATTENDUE = '([^']+)'/.exec(APP) || [])[1];
const SEUIL_FICHE = (/lbcfiche: '([^']+)'/.exec(APP) || [])[1] || '9.9.9';
const CODE_DANS_ETAT = (/const CODE_DANS_ETAT = '([0-9.]+)'/.exec(APP) || [])[1] || '5.171.0';
const auMoins = (v, s) => { const a = String(v || '').split('.').map(Number), b = String(s).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); } return true; };
const auj = new Date().toISOString();

// Trois photos captées, aux vraies adresses de Vinted (inventées).
const PH = [1, 2, 3].map((i) => `https://images1.vinted.net/t/0${i}_banc/f800/${i}.jpeg?s=sig${i}`);
const MAIN = { vinted_annonce_numeros: { '8001': { numero: '27', title: 'Salomon XT-6 blanc taille 40', mp: { lbc: true } } } };
const LISTINGS = { capturedAt: auj, payload: { items: [
  { id: 8001, title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', size_title: '40', status: 'Très bon état', price: { amount: '99.0', currency_code: 'EUR' }, photo: { url: PH[0] }, nPhotos: 3, is_closed: false, is_hidden: false, is_draft: false },
] } };
const DETAILS = { '8001': { photos: PH, description: 'Portées deux fois, semelle propre, boîte d’origine.' } };
const rows = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: LISTINGS },
  { id: 'vinted_item_details', data: DETAILS },
  { id: 'vinted_lbc_posted', data: { ids: [] } },
  { id: 'lbc_accounts', data: { accounts: { a1: { id: 'a1', name: 'Boutique test', seenAt: auj } } } },
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj }];

// Une image unie (PNG fabriqué ici, aucun réseau) pour les photos du CDN.
function png(r, g, b) {
  const w = 64, h = 64, ligne = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) { ligne[1 + x * 3] = r; ligne[2 + x * 3] = g; ligne[3 + x * 3] = b; }
  const brut = Buffer.concat(Array.from({ length: h }, () => ligne));
  const crc = (buf) => { let c = ~0; for (const o of buf) { c ^= o; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const bloc = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const t = Buffer.from(type); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([l, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ihdr), bloc('IDAT', zlib.deflateSync(brut)), bloc('IEND', Buffer.alloc(0))]);
}
const IMAGES = [png(222, 226, 232), png(190, 200, 214), png(160, 172, 190)];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 180)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

// Le pont simulé : l'extension `version`, connectée à VRM. Sur `cmd`, il note le
// corps EXACT reçu, accepte, puis raconte l'avancement (`suite`).
const PONT = ({ version, etatCode, suite }) => {
  window.__cmds = [];
  const post = (m) => window.postMessage(m, '*');
  const jobs = {};
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: Object.assign({ ok: true, version, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_test' }, cmds: jobs }, etatCode || {}) });
    if (d.__vmr === 'cmd') {
      const corps = {}; for (const k of Object.keys(d)) if (!['__vmr', 'reqId'].includes(k)) corps[k] = d[k];
      window.__cmds.push(JSON.parse(JSON.stringify(corps)));
      const jobId = 'lbc:' + d.id;
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, jobId, etape: 'depot' } });
      const evt = (o, ms) => setTimeout(() => { jobs[jobId] = Object.assign({ type: 'cmd', jobId, at: Date.now() }, o); post({ __vmr: 'evt', evt: jobs[jobId] }); }, ms);
      const n = (d.annonce && d.annonce.photos && d.annonce.photos.length) || 3;
      evt({ etape: 'depot', progres: { etape: 'remplissage', champs: 2 } }, 300);
      evt({ etape: 'depot', progres: { etape: 'photos', champs: 3, photos: { posees: 1, total: n, confirmees: null, rates: 0 } } }, 700);
      if (suite === 'manque') { evt({ etape: 'depot', progres: { etape: 'champ-manquant', champs: 3, manque: ['Univers'], photos: { posees: n, total: n, confirmees: n, rates: 0 } } }, 1100); return; }
      evt({ etape: 'depot', progres: { etape: 'publication', champs: 4, photos: { posees: n, total: n, confirmees: n, rates: 0 } } }, 1100);
      if (suite === 'fait') evt({ etape: 'fait' }, 2600);
    }
  });
  post({ __vmr: 'ready', version });
};

async function ouvrir(b, vp, pont) {
  // 390 px : une fenêtre ÉTROITE d'ordinateur (l'extension y tourne). Un vrai
  // téléphone (sans souris) ne publie pas : il a son propre contrôle (H).
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, ...(vp.width < 600 ? { deviceScaleFactor: 2 } : {}), ...(vp.tactile ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (pont) await pg.addInitScript(PONT, Object.assign({}, pont, { etatCode: auMoins(pont.version, CODE_DANS_ETAT) ? { code: pont.version, ext: 'banc-ext' } : {} }));
  else await pg.addInitScript(() => { window.__cmds = []; });   // aucune extension ici (un iPhone)
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (rt) => {
    const u = rt.request().url();
    const m = /images1\.vinted\.net\/t\/0(\d)_banc/.exec(u);
    if (m) return rt.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: IMAGES[Number(m[1]) - 1] });
    return ['image', 'media', 'font'].includes(rt.request().resourceType()) ? rt.abort() : rt.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=leboncoin`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('[data-bouton-publier]'), null, { timeout: 20000 });
  await pg.waitForFunction(() => { const e = document.querySelector('[data-bouton-publier]'); return e && e.getAttribute('data-bouton-publier') !== 'grise'; }, null, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(800);
  return { ctx, pg, errs };
}
const lireFiche = (pg) => pg.evaluate(() => {
  const f = document.querySelector('[data-fiche-lbc]');
  if (!f) return null;
  const v = (k) => (f.querySelector(`[data-fiche-champ="${k}"]`) || {}).value;
  return {
    etat: f.getAttribute('data-fiche-etat'), corrigee: f.getAttribute('data-fiche-corrigee'),
    titre: v('titre'), prix: v('prix'), etatLbc: v('etat'), desc: v('description'),
    photos: [...f.querySelectorAll('[data-fiche-photo]')].map((e) => Number(e.getAttribute('data-fiche-photo'))),
    publier: (f.querySelector('[data-fiche-publier]') || {}).getAttribute ? f.querySelector('[data-fiche-publier]').getAttribute('data-fiche-publier') : null,
    publierTxt: (f.querySelector('[data-fiche-publier]') || {}).innerText || '',
    bloque: (f.querySelector('[data-fiche-bloque]') || null) && f.querySelector('[data-fiche-bloque]').getAttribute('data-fiche-bloque'),
    bloqueTxt: (f.querySelector('[data-fiche-bloque]') || {}).innerText || '',
    progres: (f.querySelector('[data-fiche-progres]') || null) && f.querySelector('[data-fiche-progres]').getAttribute('data-fiche-progres'),
    photosProgres: (f.querySelector('[data-fiche-photos-progres]') || {}).innerText || '',
    fin: (f.querySelector('[data-fiche-fin]') || null) && f.querySelector('[data-fiche-fin]').getAttribute('data-fiche-fin'),
    manque: (f.querySelector('[data-fiche-manque]') || null) && f.querySelector('[data-fiche-manque]').getAttribute('data-fiche-manque'),
    infos: Object.fromEntries([...f.querySelectorAll('[data-fiche-info]')].map((e) => [e.getAttribute('data-fiche-info'), e.innerText])),
    texte: f.innerText,
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    feuilleLarge: (() => { const r = f.parentElement.getBoundingClientRect(); return r.right <= window.innerWidth + 1 && r.left >= -1; })(),
  };
});

(async () => {
  srv.listen(PORT);
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px · extension ${EXT_ATTENDUE} (à jour)`);
      await essaie(`${vp.width} A-C`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, { version: EXT_ATTENDUE, suite: 'fait' });
        await pg.click('[data-bouton-publier] button');
        await pg.waitForSelector('[data-fiche-lbc]', { timeout: 5000 });
        await pg.waitForTimeout(500);
        const a = await lireFiche(pg);
        // A
        dit(a && a.titre === 'Salomon XT-6 blanc taille 40' && a.titre.length <= 50, 'A · la fiche s’ouvre depuis la ligne et montre le TITRE Leboncoin (≤ 50)', a && a.titre);
        dit(a && /^📦 Réf\. VRM-27/.test(a.desc) && /Réf\. VRM-27$/.test(a.desc) && /Portées deux fois/.test(a.desc) && /Marque : Salomon/.test(a.desc), 'A · la description proposée, avec la référence VRM-27 en haut et en bas', a && a.desc.slice(0, 80));
        dit(a && a.prix === '99,00' && a.etatLbc === 'Très bon état', 'A · le prix et l’état de l’annonce Vinted', a && `${a.prix} · ${a.etatLbc}`);
        dit(a && JSON.stringify(a.photos) === '[1,2,3]', 'A · les 3 photos captées, toutes choisies, dans l’ordre (la 1ʳᵉ = couverture)', a && JSON.stringify(a.photos));
        dit(a && a.infos['Catégorie'] === 'Chaussures' && /celui ouvert dans ce Chrome/.test(a.infos['Compte Leboncoin'] || '') && /compte_test/.test(a.texte), 'A · la catégorie (Chaussures), le compte Leboncoin et le compte Vinted d’où vient la paire', a && JSON.stringify(a.infos));
        dit(a && a.publier === 'pret' && a.corrigee === '0', 'A · non corrigée, « Publier sur Leboncoin » est prêt', a && a.publier);
        await pg.screenshot({ path: path.join(os.tmpdir(), `lbc-fiche-${vp.width}.png`), fullPage: false });
        // B : corriger le titre, le prix, l'ordre des photos (retirer la 1, la remettre ⇒ 2,3,1).
        await pg.fill('[data-fiche-champ="titre"]', 'Salomon XT-6 « Wings » blanc taille 40');
        await pg.fill('[data-fiche-champ="prix"]', '87,50');
        await pg.click('[data-fiche-photo="1"]');
        await pg.click('[data-fiche-photo="0"] >> nth=0');
        await pg.waitForTimeout(200);
        const bb = await lireFiche(pg);
        dit(bb && bb.corrigee === '1' && JSON.stringify(bb.photos) === '[3,1,2]', 'B · retirer la couverture puis la reprendre la met en DERNIER (l’ordre suit les touches)', bb && JSON.stringify(bb.photos));
        await pg.screenshot({ path: path.join(os.tmpdir(), `lbc-fiche-${vp.width}-corrigee.png`), fullPage: false });
        await pg.click('[data-fiche-publier]');
        await pg.waitForTimeout(400);
        const cmds = await pg.evaluate(() => window.__cmds);
        const c = cmds[0] || {};
        dit(cmds.length === 1 && c.cmd === 'lbcPublier' && c.id === '8001', 'B · un seul envoi, `lbcPublier` pour CETTE paire', JSON.stringify(cmds.map((x) => x.cmd + ':' + x.id)));
        dit(c.annonce && c.annonce.title === 'Salomon XT-6 « Wings » blanc taille 40' && c.annonce.price === '87.5', 'B · l’annonce CORRIGÉE part : le titre et le prix tapés', JSON.stringify(c.annonce && { t: c.annonce.title, p: c.annonce.price }));
        dit(c.annonce && JSON.stringify(c.annonce.photos) === JSON.stringify([PH[1], PH[2], PH[0]]), 'B · les photos dans l’ordre choisi (2, 3, 1), des URL captées de Vinted', JSON.stringify(c.annonce && c.annonce.photos));
        dit(c.annonce && /Réf\. VRM-27/.test(c.annonce.description) && c.annonce.etat === 'Très bon état', 'B · la description garde sa référence, l’état part', c.annonce && c.annonce.etat);
        dit(Object.keys(c).sort().join(',') === 'annonce,cmd,id', 'B · rien d’autre dans la commande (ni titre ni prix glissés à côté de l’annonce)', Object.keys(c).sort().join(','));
        // C : l'avancement en direct.
        await pg.waitForTimeout(1000);
        const p1 = await lireFiche(pg);
        dit(p1 && p1.progres === 'publication' && /3\/3 confirmées/.test(p1.photosProgres) && p1.etat === 'encours', 'C · l’avancement s’affiche en direct : photos posées 3/3 (confirmées), publication en cours', p1 && `${p1.progres} · ${p1.photosProgres}`);
        await pg.screenshot({ path: path.join(os.tmpdir(), `lbc-fiche-${vp.width}-progres.png`), fullPage: false });
        await pg.waitForTimeout(1800);
        const p2 = await lireFiche(pg);
        dit(p2 && p2.etat === 'publiee' && p2.fin === 'publiee' && /Publiée sur Leboncoin ✓/.test(p2.publierTxt) && /« sur Leboncoin »/.test(p2.texte), 'C · puis « Publiée sur Leboncoin ✓ », la paire marquée « sur Leboncoin »', p2 && `${p2.etat} · ${p2.publierTxt}`);
        await pg.screenshot({ path: path.join(os.tmpdir(), `lbc-fiche-${vp.width}-publiee.png`), fullPage: false });
        dit(p2 && p2.sw <= p2.cw + 1 && p2.feuilleLarge, `G · ${vp.width} px : aucun débordement horizontal, la feuille tient dans l’écran`, p2 && `${p2.sw}/${p2.cw}`);
        dit(!errs.length, `G · ${vp.width} px : aucune erreur de page`, errs[0]);
        await ctx.close();
      });
      await essaie(`${vp.width} D`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { version: EXT_ATTENDUE, suite: 'fait' });
        await pg.click('[data-bouton-publier] button');
        await pg.waitForSelector('[data-fiche-lbc]', { timeout: 5000 });
        await pg.fill('[data-fiche-champ="titre"]', 'x'.repeat(60));
        await pg.waitForTimeout(200);
        const d = await lireFiche(pg);
        dit(d && d.publier === 'grise' && d.bloque === 'fiche' && /titre dépasse 50/.test(d.bloqueTxt), 'D · titre de 60 caractères : bouton GRISÉ, la raison dite', d && `${d.publier} · ${d.bloqueTxt}`);
        await pg.click('[data-fiche-publier]', { force: true });
        await pg.waitForTimeout(300);
        dit((await pg.evaluate(() => window.__cmds.length)) === 0, 'D · et un clic n’envoie RIEN à l’extension');
        await ctx.close();
      });
    }
    console.log('── 1512 px · champ obligatoire que VRM ne devine pas');
    await essaie('E', async () => {
      const { ctx, pg } = await ouvrir(b, { width: 1512, height: 950 }, { version: EXT_ATTENDUE, suite: 'manque' });
      await pg.click('[data-bouton-publier] button');
      await pg.waitForSelector('[data-fiche-lbc]', { timeout: 5000 });
      await pg.click('[data-fiche-publier]');
      await pg.waitForTimeout(1600);
      const e = await lireFiche(pg);
      dit(e && e.manque === 'Univers' && /« Univers » reste à choisir/.test(e.texte), 'E · la fiche NOMME le champ qui manque (« Univers »)', e && e.manque);
      await ctx.close();
    });
    console.log('── 390 px · téléphone (sans souris)');
    await essaie('H', async () => {
      // ⚠️ (20 octobre) Depuis la 5.188, un téléphone dont l'extension RÉPOND
      //    (Firefox pour Android) agit ici : le téléphone qui ne publie pas est
      //    celui SANS extension (un iPhone), et c'est lui que H rend. L'autre
      //    sens (H2) : avec l'extension qui répond, la fiche s'ouvre.
      const { ctx, pg } = await ouvrir(b, { width: 390, height: 844, tactile: true }, null);
      const etat = await pg.evaluate(() => document.querySelector('[data-bouton-publier]').getAttribute('data-bouton-publier'));
      await pg.click('[data-bouton-publier] button', { force: true });
      await pg.waitForTimeout(400);
      const h = await pg.evaluate(() => ({ fiche: !!document.querySelector('[data-fiche-lbc]'), refus: (document.querySelector('[data-refus-publier]') || {}).innerText || '', cmds: window.__cmds.length }));
      dit(etat === 'grise' && !h.fiche && /ordinateur/.test(h.refus) && h.cmds === 0, 'H · sur un téléphone SANS extension : bouton grisé, « depuis ton ordinateur » — aucune fiche qui ne pourrait pas partir, rien n’est envoyé', JSON.stringify({ etat, ...h }));
      await ctx.close();
    });
    await essaie('H2', async () => {
      const { ctx, pg } = await ouvrir(b, { width: 390, height: 844, tactile: true }, { version: EXT_ATTENDUE, suite: 'fait' });
      const etat = await pg.evaluate(() => document.querySelector('[data-bouton-publier]').getAttribute('data-bouton-publier'));
      const vus = await pg.evaluate(() => [...document.querySelectorAll('[data-bouton-publier] button')].map((x) => !!x.offsetParent));
      console.log('   H2 boutons (visibles) :', JSON.stringify(vus));
      await pg.locator('[data-bouton-publier] button:visible').first().click({ timeout: 5000 });
      await pg.waitForSelector('[data-fiche-lbc]', { timeout: 5000 }).catch(() => {});
      const fiche = await pg.evaluate(() => !!document.querySelector('[data-fiche-lbc]'));
      dit(etat !== 'grise' && fiche, 'H2 · téléphone dont l’extension répond (Firefox pour Android) : le bouton agit, la fiche s’ouvre', JSON.stringify({ etat, fiche }));
      await ctx.close();
    });
    const ancienne = '5.181.0';
    console.log(`── 1512 px · extension ${ancienne} (plus ancienne que ${SEUIL_FICHE})`);
    await essaie('F', async () => {
      const { ctx, pg } = await ouvrir(b, { width: 1512, height: 950 }, { version: ancienne, suite: 'fait' });
      await pg.click('[data-bouton-publier] button');
      await pg.waitForSelector('[data-fiche-lbc]', { timeout: 5000 });
      const f0 = await lireFiche(pg);
      dit(f0 && f0.publier === 'pret' && /publiera sa propre version/.test(f0.texte), 'F · non corrigée : publiable, et la fiche DIT que l’extension publiera sa propre version', f0 && f0.publier);
      await pg.fill('[data-fiche-champ="prix"]', '80');
      await pg.waitForTimeout(200);
      const f1 = await lireFiche(pg);
      dit(f1 && f1.publier === 'grise' && f1.bloque === 'fiche-retard' && new RegExp(SEUIL_FICHE.replace(/\./g, '\\.')).test(f1.bloqueTxt), `F · corrigée : GRISÉE, « mets-la à jour (${SEUIL_FICHE}) » — tes corrections ne partiraient pas`, f1 && f1.bloqueTxt);
      await pg.click('[data-fiche-publier]', { force: true });
      await pg.waitForTimeout(300);
      dit((await pg.evaluate(() => window.__cmds.length)) === 0, 'F · et un clic n’envoie rien');
      await pg.fill('[data-fiche-champ="prix"]', '99,00');
      await pg.waitForTimeout(150);
      await pg.click('[data-fiche-publier]');
      await pg.waitForTimeout(400);
      const cmds = await pg.evaluate(() => window.__cmds);
      dit(cmds.length === 1 && !cmds[0].annonce && cmds[0].id === '8001', 'F · revenue à l’origine : elle part « tel quel » — l’identifiant SEUL, comme avant', JSON.stringify(cmds));
      await ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  if (b) await b.close(); srv.close();
  console.log(`\nCaptures : ${os.tmpdir()}/lbc-fiche-*.png`);
  console.log(`${ko ? '❌' : '✅'} fiche Leboncoin : ${ko ? ko + ' rouge(s)' : 'tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
