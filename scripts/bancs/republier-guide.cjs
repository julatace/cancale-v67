// Banc : « REPUBLIER À LA MAIN » ET « PUBLIER À LA MAIN », GUIDÉS (15 nov.).
// Julien (15 nov.) : « tout doit être beaucoup mieux, accompagné, même la publication tout court ;
// […] une fois que l'application a modifié les photos, envoie directement dans la galerie les
// photos à l'utilisateur en lui disant que tout a été envoyé ».
// Données INVENTÉES (dépôt public). 390 px tactile = iPhone (`navigator.share`/`canShare` simulés,
// chaque partage noté avec ses fichiers et l'activation de l'utilisateur au moment de l'appel) et
// 1512 px (aucun partage ⇒ téléchargement), clair et sombre. Il exige :
//   R1 « À la main · 1 » ouvre LA FEUILLE GUIDÉE tout de suite (plus le kit), quatre étapes
//      photos · supprimer · créer · fini, la première à l'écran ;
//   R2 les photos sont PRÉPARÉES D'AVANCE (aucun toucher) puis UN toucher les envoie : iPhone ⇒
//      UN partage, dans le geste (activation vraie), avec les 2 fichiers réglés VRM-42-01/02.jpg ;
//      ordinateur ⇒ 2 téléchargements ; puis « 2 photos prêtes dans ta galerie : tout a été
//      envoyé » (ordinateur : « téléchargements ») et l'étape cochée ;
//   R3 « Supprimer » : le lien de l'ANCIENNE annonce (vinted.fr/items/9102), rien n'est envoyé ;
//      « encore en ligne » tant que la lecture la porte ; de retour (premier plan), VRM relit ⇒
//      « n'est plus dans la dernière lecture » ;
//   R4 « Créer » : « Ouvrir Vinted · Vendre » (items/new) copie le titre ; chaque champ a son
//      « Copier » (ordre du formulaire Vinted) ; la description copiée finit par « N°42 » ;
//   R5 « Fini » : la nouvelle annonce lue (9201) est proposée, SON clic + la confirmation
//      d'avant ⇒ le N°42 passe dessus (relu : `vinted_annonce_numeros`), « C'est republié »,
//      une ligne dans « Ce que VRM a fait » (`vrm_suivi_travaux`) ;
//   P  « À publier » : « À la main » ⇒ la feuille guidée (photos · créer · fini), UN toucher
//      pour la photo, la description avec le N°45 de la fiche, aucun N° neuf donné ; une
//      annonce qui porte le N°45 ⇒ « C'est publié » + « Ce que VRM a fait » ;
//   F  un seul plein visible par étape, cibles ≥ 44 px, aucun débordement, aucune erreur,
//      rien parti chez Vinted ; touchers comptés (rapportés).
// §6.1 : sur le code d'avant, « À la main · 1 » ouvre le kit (pas de feuille guidée) ⇒ rouge.
require('../_source-app.cjs').brancher();
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9941;
const SHOTS = process.env.SHOTS || os.tmpdir();
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const auj = new Date(); const s = Math.floor(auj / 1000);
const PNG = (() => {
  const zlib = require('zlib'); const W = 40, H = 50;
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const bloc = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const brut = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { brut[y * (W * 3 + 1)] = 0; for (let x = 0; x < W; x++) { const o = y * (W * 3 + 1) + 1 + x * 3; const haut = y < H * 0.6; brut[o] = haut ? 214 : 60; brut[o + 1] = haut ? 222 : 64; brut[o + 2] = haut ? 230 : 72; } }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ihdr), bloc('IDAT', zlib.deflateSync(brut)), bloc('IEND', Buffer.alloc(0))]);
})();
const ann = (id, o) => Object.assign({ id, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 10, favourite_count: 1, nPhotos: 2, descLen: 60, color1: 'Blanc', catalog_id: 1242, created_at_ts: s - 40 * 86400 }, o);
const ANCIENNE = ann(9102, { title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', size_title: '40' });
// (15 nov., capture de Julien : « on me propose qu'une seule photo ») Une annonce de 8 photos jamais passée
// par l'atelier : pas de coffre, la vignette seule dans le dressing, les 8 dans la fiche lue sur sa page.
const HUIT = Array.from({ length: 8 }, (_, i) => `https://images1.vinted.net/t/h/f800/${i + 1}.jpeg`);
const OCTO = ann(9104, { title: 'Nike Air Max 1 blanc rouge taille 43', brand_title: 'Nike', size_title: '43', photo: HUIT[0], photoCount: 8 });
const AUTRE = ann(9103, { title: 'Adidas Spezial noir taille 38', brand_title: 'Adidas', size_title: '38', photo: 'https://images1.vinted.net/t/b/f800/1.jpeg', price: { amount: '60.0', currency_code: 'EUR' } });
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const FICHE = { id: 'fiche-banc-1', numero: '45', titre: 'Asics Gel-1130 argent taille 41', prix: 70, description: 'Neuves, jamais portées.', marque: 'Asics', taille: '41', etat: 'Neuf avec étiquette', couleur: 'Argent', photos: ['https://images1.vinted.net/t/c/f800/1.jpeg'], creeAt: auj.toISOString(), origine: 'dupliquer' };
const MAIN = { vinted_annonce_numeros: { 9102: { numero: '42' }, 9103: { numero: '43' } }, vinted_used_numeros: [42, 43, 45], vrm_num_vinted: { place: 'desc_fin', forme: 'numero' }, vrm_fiches_neuves: { [FICHE.id]: FICHE } };
// L'état du serveur : la vraie suite chez lui. Phase 'avant' : l'ancienne en ligne ; 'apres' : il l'a
// supprimée sur Vinted et publié la nouvelle (9201, lue par l'extension, encore sans N°).
const etat = { phase: 'avant' };
const items = () => (etat.phase === 'avant' ? [ANCIENNE, AUTRE, OCTO] : [AUTRE, OCTO, ann(9201, { title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', size_title: '40', created_at_ts: Math.floor(Date.now() / 1000) - 30 })]);
const lignes = () => [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: new Date().toISOString(), payload: { items: items(), pagination: { total_entries: items().length } } } },
  { id: 'vinted_item_details', data: { 9104: { description: 'Air Max 1 portées trois fois.', photos: HUIT } } },
  { id: 'coffre_111_9102', data: { title: 'Salomon XT-6 blanc taille 40', desc: 'Salomon XT-6 portées deux fois, boîte d’origine.', brand: 'Salomon', size: '40', etat: 'Très bon état', price: 49, photos: ['https://images1.vinted.net/t/a/f800/1.jpeg', 'https://images1.vinted.net/t/a/f800/2.jpeg'] } },
];
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.322.0';
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.__envois = [];
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_test' }, cmds: {} } });
    if (d.__vmr === 'photo') post({ __vmr: 'photo:result', reqId: d.reqId, dataUrl: o.png });
    if (d.__vmr === 'cmd') {
      window.__envois.push({ cmd: d.cmd, id: d.id || d.draftId || d.itemId });
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
    }
  });
  post({ __vmr: 'ready', version: o.version });
};

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d !== undefined && d !== '' ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec un autre BANC_PORT'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
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
  const ctx = await b.newContext({ acceptDownloads: true, viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` }).catch(() => {});
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sb && !localStorage.getItem('vinted_dark')) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: VERSION, png: 'data:image/png;base64,' + PNG.toString('base64') });
  // 390 tactile = iPhone : le menu de partage avec FICHIERS, chaque appel noté (noms + activation du geste).
  await pg.addInitScript((tel) => {
    window.__partages = [];
    if (tel) {
      navigator.canShare = (o) => !!(o && Array.isArray(o.files) && o.files.length);
      navigator.share = async (o) => { window.__partages.push({ noms: (o.files || []).map((f) => f.name), types: (o.files || []).map((f) => f.type), geste: !!(navigator.userActivation && navigator.userActivation.isActive) }); };
    } else { try { delete Navigator.prototype.share; delete Navigator.prototype.canShare; } catch (_) {} }
  }, vp.width < 600);
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const t = r.request().resourceType();
    if (t === 'document') return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>vinted (banc)</title>' });
    if (t === 'image' && /vinted\.net/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (['image', 'media', 'font'].includes(t)) return r.abort();
    return r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const rows = lignes();
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date().toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
let touchers = 0;
const clic = async (pg, sel, compte = true) => { if (compte) touchers++; const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click({ timeout: 4000 }).catch(async () => { await pg.$eval(sel, (x) => x.click()).catch(() => {}); }); };
const clicPopup = async (pg, sel) => { const [pop] = await Promise.all([pg.context().waitForEvent('page', { timeout: 5000 }).catch(() => null), clic(pg, sel)]); if (pop) await pop.close().catch(() => {}); return pop; };
const attendre = async (pg, f, ms = 8000) => { const t = Date.now(); let v; while (Date.now() - t < ms) { v = await pg.evaluate(f).catch(() => null); if (v) return v; await pg.waitForTimeout(200); } return v; };
const pressePapier = (pg) => pg.evaluate(async () => { try { return await navigator.clipboard.readText(); } catch (_) { return null; } });
const petitsDans = (pg, sel) => pg.$$eval(`${sel} button, ${sel} a[href], ${sel} summary`, (l) => l.filter((x) => { if (x.closest('[hidden]')) return false; const r = x.getBoundingClientRect(); return r.height && r.height < 43.5; }).map((x) => (x.getAttribute('aria-label') || x.textContent || x.tagName).trim().slice(0, 24)));
// Les pleins VISIBLES dans la feuille (Studio : un par écran au plus).
const pleins = (pg, sel) => pg.$$eval(`${sel} .vrm-b-primaire`, (l) => l.filter((x) => !x.closest('[hidden]') && !x.closest('details:not([open])') && x.getBoundingClientRect().height > 0).map((x) => x.textContent.trim().slice(0, 30)));
const poseeLa = (pg, sel) => attendre(pg, `(() => { const f = document.querySelector(${JSON.stringify(sel)}); if (!f) return null; const r = f.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight - 150 && !document.getAnimations().some((a) => a.playState === 'running') ? 1 : null; })()`, 12000);
const ls = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
const premierPlan = (pg) => pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const T = `${vp.width}${sombre ? ' sombre' : ' clair'}`;
        if (process.env.VUES && !process.env.VUES.split(',').includes(T.replace(' ', '-'))) continue;
        const tel = vp.width < 600;
        const nomF = (x) => path.join(SHOTS, `republier-guide-${vp.width}-${sombre ? 'sombre' : 'clair'}-${x}.png`);
        console.log(`── ${T}`);
        etat.phase = 'avant'; touchers = 0;
        const { ctx, pg, errs } = await contexte(b, vp, sombre);
        const dl = []; pg.on('download', (d) => dl.push(d.suggestedFilename()));
        const F = '[data-repub-main="9102"]';
        try {
          // ── R1 : la feuille guidée, tout de suite ──
          await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces&vue=republier`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('[data-selection-vue="republier"]', { timeout: 20000 });
          for (let i = 0; i < 40; i++) { if (await pg.$('[data-selection-annonce="9102"]')) break; await pg.waitForTimeout(250); }
          await clic(pg, '[data-selection-annonce="9102"] input');
          // Sous charge, la liste se redessine encore : la case est recochée tant que « À la main » n'est pas là (un toucher compté).
          for (let k = 0; k < 3 && !(await attendre(pg, () => (document.querySelector('[data-republier-main-lancer]') ? 1 : null), 4000)); k++) await clic(pg, '[data-selection-annonce="9102"] input', false);
          await clic(pg, '[data-republier-main-lancer]');
          const ouvre = await attendre(pg, () => (document.querySelector('[data-repub-main="9102"]') ? 'guide' : document.querySelector('[data-kit-main]') ? 'kit' : null), 8000);
          dit(ouvre === 'guide', `R1 ${T} « À la main · 1 » ouvre la feuille guidée tout de suite (pas le kit)`, ouvre);
          if (ouvre !== 'guide') throw new Error('pas de feuille guidée');
          await poseeLa(pg, F);
          const et = await pg.getAttribute(`${F} [data-rg-etapes]`, 'data-rg-etapes');
          dit(et === 'photos,supprimer,creer,fini' && (await pg.getAttribute(F, 'data-main-etape')) === 'photos', `R1 ${T} quatre étapes (photos · supprimer · créer · fini), la première à l’écran`, et);
          // ── R2 : préparées d'avance, UN toucher ──
          const pretes = await attendre(pg, () => { const x = document.querySelector('[data-main-telecharger]'); return x && x.getAttribute('data-rg-photos-pretes') === '2' ? 2 : null; }, 12000);
          dit(pretes === 2, `R2 ${T} les 2 photos sont préparées d’avance, sans aucun toucher`, String(pretes));
          const lib = await pg.evaluate(() => (document.querySelector('[data-main-telecharger]') || {}).textContent || '');
          dit(tel ? /Enregistrer les 2 photos/.test(lib) : /Télécharger les 2 photos/.test(lib), `R2 ${T} le bouton dit ce qu’il fait (« ${tel ? 'Enregistrer' : 'Télécharger'} les 2 photos »)`, lib);
          dit((await pleins(pg, F)).length === 1, `F ${T} un seul plein à l’étape Photos`, (await pleins(pg, F)).join(' | '));
          await pg.screenshot({ path: nomF('1-photos') });
          await clic(pg, `${F} [data-main-telecharger]`);
          const apres = await attendre(pg, () => { const a = document.querySelector('[data-repub-main] [data-acc-apres="republier.main"]'); return a ? a.textContent : null; });
          const parts = await pg.evaluate(() => window.__partages);
          if (tel) dit(parts.length === 1 && parts[0].noms.join(',') === 'VRM-42-01.jpg,VRM-42-02.jpg' && parts[0].types.every((t) => t === 'image/jpeg') && parts[0].geste, `R2 ${T} iPhone : UN partage, DANS le geste, avec les 2 photos réglées (JPEG)`, parts);
          else { await pg.waitForTimeout(500); dit(dl.join(',') === 'VRM-42-01.jpg,VRM-42-02.jpg' && !parts.length, `R2 ${T} ordinateur : les 2 photos réglées téléchargées d’un toucher`, dl); }
          dit(apres && (tel ? /2 photos dans ta galerie/.test(apres) : /2 photos téléchargées/.test(apres)), `R2 ${T} après : le message le dit (${tel ? 'galerie' : 'téléchargements'}) — court depuis le 23 nov.`, apres);
          dit((await pg.getAttribute(`${F} [data-main-aller="photos"]`, 'data-rg-etat')) === 'fait', `R2 ${T} l’étape Photos est cochée`);
          const suivPlein = await pg.evaluate(() => (document.querySelector('[data-repub-main] [data-main-suivant]') || {}).className || '');
          dit(/vrm-b-primaire/.test(suivPlein) && (await pleins(pg, F)).length === 1, `F ${T} fait : « Suivant » devient LE plein (un seul)`, (await pleins(pg, F)).join(' | '));
          await pg.screenshot({ path: nomF('2-photos-envoyees') });
          // ── R3 : supprimer l'ancienne, sur SON clic, chez Vinted ──
          await clic(pg, `${F} [data-main-suivant="supprimer"]`);
          await attendre(pg, () => (document.querySelector('[data-repub-main]').getAttribute('data-main-etape') === 'supprimer' ? 1 : null));
          const href = await pg.getAttribute(`${F} [data-rg-ouvrir-ancienne]`, 'href');
          dit(href === 'https://www.vinted.fr/items/9102', `R3 ${T} « Ouvrir l’ancienne annonce » mène à SON annonce sur Vinted`, href);
          dit((await pg.getAttribute(`${F} [data-rg-ancienne]`, 'data-rg-ancienne')) === 'en-ligne', `R3 ${T} « encore en ligne » tant que la lecture la porte`);
          dit(!(await pg.$(`${F} [data-rg-garde="photos"]`)), `R3 ${T} les photos sont enregistrées : aucune mise en garde « photos d’abord »`);
          await clicPopup(pg, `${F} [data-rg-ouvrir-ancienne]`);
          await pg.screenshot({ path: nomF('3-supprimer') });
          // Il supprime sur Vinted et publie la nouvelle ; l'extension relit. Retour dans VRM : relu tout seul.
          etat.phase = 'apres';
          await premierPlan(pg);
          const partie = await attendre(pg, () => { const x = document.querySelector('[data-repub-main] [data-rg-ancienne]'); return x && x.getAttribute('data-rg-ancienne') === 'partie' ? x.textContent : null; }, 12000);
          dit(partie && /Supprimée/.test(partie), `R3 ${T} de retour dans VRM, relu sans toucher : l’ancienne n’est plus en ligne (« Supprimée »)`, partie);
          dit((await pg.evaluate(() => window.__envois.filter((e) => /suppr|delete|recreer|republier|publier/i.test(e.cmd)).length)) === 0, `R3 ${T} VRM n’a rien supprimé ni publié (c’est lui, sur Vinted)`);
          // ── R4 : créer la nouvelle, chaque champ « Copier » ──
          await clic(pg, `${F} [data-main-suivant="creer"]`);
          const champs = await pg.evaluate(() => [...document.querySelectorAll('[data-repub-main] [data-main-section="creer"] [data-main-champ]')].map((x) => x.getAttribute('data-main-champ')).join(','));
          dit(/^titre,description,.*prix$/.test(champs) && /marque/.test(champs) && /taille/.test(champs) && /etat/.test(champs), `R4 ${T} les champs dans l’ordre du formulaire Vinted, chacun son « Copier »`, champs);
          const hrefN = await pg.getAttribute(`${F} [data-main-ouvrir-vinted]`, 'href');
          await clicPopup(pg, `${F} [data-main-ouvrir-vinted]`); await pg.waitForTimeout(250);
          const cTitre = await pressePapier(pg);
          dit(hrefN === 'https://www.vinted.fr/items/new' && cTitre === 'Salomon XT-6 blanc taille 40', `R4 ${T} « Ouvrir Vinted · Vendre » (items/new) copie le titre`, { hrefN, cTitre });
          await clic(pg, `${F} [data-main-copier="description"]`); await pg.waitForTimeout(250);
          const cD = await pressePapier(pg);
          dit(/boîte d’origine\.\n\nN°42$/.test(cD || ''), `R4 ${T} la description copiée finit par le N°42 (Paramètres → Numéros)`, cD);
          await clic(pg, `${F} [data-main-copier="prix"]`); await pg.waitForTimeout(250);
          dit((await pressePapier(pg)) === '49', `R4 ${T} le prix copié : « 49 »`);
          dit((await pleins(pg, F)).length === 1, `F ${T} un seul plein à l’étape Créer`, (await pleins(pg, F)).join(' | '));
          await pg.screenshot({ path: nomF('4-creer') });
          // ── R5 : c'est republié, relu ──
          await clic(pg, `${F} [data-main-suivant="fini"]`);
          await premierPlan(pg);
          const cand = await attendre(pg, () => (document.querySelector('[data-repub-main] [data-main-lier="9201"]') ? 1 : null), 12000);
          dit(cand === 1, `R5 ${T} la nouvelle annonce lue (9201) est proposée`);
          await clic(pg, `${F} [data-main-lier="9201"]`);
          await attendre(pg, () => (document.querySelector('.vrm-confirmation .vrm-b-primaire') ? 1 : null));
          await clic(pg, '.vrm-confirmation .vrm-b-primaire');
          const num = await attendre(pg, () => { try { const v = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); return v['9201'] && String(v['9201'].numero) === '42' ? '42' : null; } catch (_) { return null; } }, 15000);
          dit(num === '42', `R5 ${T} la paire GARDE son N° : le N°42 passe sur la nouvelle annonce (par SON clic, relu)`, num);
          const fin = await attendre(pg, () => { const x = document.querySelector('[data-repub-main] [data-rg-fin]'); return x && x.getAttribute('data-rg-fin') === 'fait' ? x.textContent : null; }, 15000);
          dit(fin && /C’est republié · N°42/.test(fin), `R5 ${T} « C’est republié · N°42 », relu`, fin);
          const trav = await attendre(pg, () => { try { const l = JSON.parse(localStorage.getItem('vrm_suivi_travaux') || '[]'); const x = l.find((t) => t && t.id === 'm-republier-main-9201'); return x ? { titre: x.titre, sorte: x.sorte, ok: x.articles[0].etat } : null; } catch (_) { return null; } });
          dit(trav && trav.sorte === 'republier-main' && trav.ok === 'ok' && /N°42/.test(trav.titre), `R5 ${T} noté dans « Ce que VRM a fait »`, trav);
          const pasTouchesRepub = touchers;
          console.log(`    touchers (vue Republier → « C’est republié ») : ${pasTouchesRepub}${tel ? ' + 1 du système (« Enregistrer 2 images »)' : ''}`);
          await pg.screenshot({ path: nomF('5-republie') });
          const p1 = await petitsDans(pg, F);
          if (tel) dit(!p1.length, `F ${T} cibles au doigt ≥ 44 px (feuille guidée)`, p1.join(" | "));
          await clic(pg, `${F} [data-main-terminer]`, false);
          await pg.waitForTimeout(400);
          // ── G : TOUTES les photos (8), le même réglage sur les 8, en retirer une ⇒ 7 ──
          touchers = 0;
          await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces&vue=republier`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('[data-selection-annonce="9104"]', { timeout: 20000 });
          await clic(pg, '[data-selection-annonce="9104"] input');
          await attendre(pg, () => (document.querySelector('[data-republier-main-lancer]') ? 1 : null));
          await clic(pg, '[data-republier-main-lancer]');
          const FG = '[data-repub-main="9104"]';
          await pg.waitForSelector(FG, { timeout: 8000 }); await poseeLa(pg, FG);
          const huit = await attendre(pg, () => { const x = document.querySelector('[data-repub-main] [data-main-telecharger]'); return x && x.getAttribute('data-rg-photos-pretes') === '8' ? 8 : null; }, 90000);
          const grille = await pg.evaluate(() => { const g = document.querySelector('[data-repub-main] [data-main-photos]'); return g ? { n: g.getAttribute('data-main-photos'), ch: g.getAttribute('data-rg-photos-choisies'), srcs: [...g.querySelectorAll('img')].map((i) => i.getAttribute('src') || '').map((u) => (u.match(/\/(\d)\.jpeg/) || [])[1] || u.slice(0, 20)).join(','), couv: /Couverture/.test((g.querySelector('[data-rg-photo="0"] .rg2-rang') || {}).textContent || '') } : null; });
          dit(huit === 8 && grille && grille.n === '8' && grille.ch === '8' && grille.couv, `G ${T} une annonce de 8 photos (vignette seule au dressing) : les 8, la 1re en couverture, toutes préparées`, grille);
          dit(!(await pg.$(`${FG} [data-rg-photos-manque]`)), `G ${T} rien ne manque : aucune mise en garde`);
          // Le même réglage pour toutes : la barre « Luminosité », puis « Recadrer ».
          await clic(pg, `${FG} [data-main-reglages] > summary`, false);
          const poser = (cle, v) => pg.evaluate(([cle, v]) => { const i = document.querySelector(`[data-repub-main] [data-main-reglage="${cle}"]`); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, String(v)); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, [cle, v]);
          await poser('bright', 1.1); await poser('zoom', 1.25); await pg.waitForTimeout(300);
          const styles = await pg.evaluate(() => [...document.querySelectorAll('[data-repub-main] [data-main-photos] img')].map((i) => `${i.style.filter}|${i.style.transform}`));
          const valeurs = await pg.evaluate(() => ({ b: (document.querySelector('[data-repub-main] [data-rg-valeur="bright"]') || {}).textContent, z: (document.querySelector('[data-repub-main] [data-rg-valeur="zoom"]') || {}).textContent, couv: ((document.querySelector('[data-repub-main] .vrm-rg-pres-couv img') || {}).style || {}).transform }));
          dit(styles.length === 8 && new Set(styles).size === 1 && /brightness\(1\.1\)/.test(styles[0]) && /scale\(1\.25\)/.test(styles[0]) && /scale\(1\.25\)/.test(valeurs.couv || ''), `G ${T} le MÊME réglage sur les 8 (aperçu de la grille et de la couverture)`, { s: styles[0], n: new Set(styles).size, couv: valeurs.couv });
          dit(valeurs.b === '+10 %' && valeurs.z === '×1,25', `G ${T} chaque barre dit sa valeur en clair (« +10 % », « ×1,25 »)`, valeurs);
          const pouces = await pg.$$eval('[data-repub-main] [data-main-reglage]', (l) => l.map((x) => Math.round(x.getBoundingClientRect().height)));
          dit(pouces.length === 5 && pouces.every((h) => h >= 44), `G ${T} cinq barres, chacune une prise de 44 px`, pouces);
          await pg.dblclick(`${FG} [data-main-reglage="bright"]`).catch(() => {}); await pg.waitForTimeout(250);
          dit((await pg.evaluate(() => (document.querySelector('[data-repub-main] [data-rg-valeur="bright"]') || {}).textContent)) === '0 %', `G ${T} double-toucher une barre la remet à zéro`);
          await pg.screenshot({ path: nomF('8-huit-photos-reglage') });
          await clic(pg, `${FG} [data-main-reglages] > summary`, false);
          await attendre(pg, () => { const x = document.querySelector('[data-repub-main] [data-main-telecharger]'); return x && x.getAttribute('data-rg-photos-pretes') === '8' ? 1 : null; }, 90000);
          const avG = await pg.evaluate(() => window.__partages.length), dG = dl.length;
          await clic(pg, `${FG} [data-main-telecharger]`);
          await attendre(pg, () => (document.querySelector("[data-repub-main] [data-acc-apres=\"republier.main\"]") ? 1 : null), 30000); await pg.waitForTimeout(500);
          const p8 = await pg.evaluate(() => window.__partages.slice(-1)[0] || null);
          if (tel) dit((await pg.evaluate(() => window.__partages.length)) === avG + 1 && p8 && p8.noms.length === 8 && /-08\.jpg$/.test(p8.noms[7]) && p8.geste, `G ${T} UN toucher : le partage avec les 8 fichiers, dans le geste`, p8);
          else dit(dl.length - dG === 8, `G ${T} UN toucher : les 8 photos téléchargées`, dl.slice(dG));
          // Retirer la 3e : 7 photos partent, renommées dans l'ordre.
          await clic(pg, `${FG} [data-rg-photo-choix="2"]`);
          const sept = await attendre(pg, () => { const x = document.querySelector('[data-repub-main] [data-main-telecharger]'); return x && x.getAttribute('data-rg-photos-pretes') === '7' ? 7 : null; }, 90000);
          dit(sept === 7 && (await pg.getAttribute(`${FG} [data-rg-photo-choix="2"]`, 'aria-pressed')) === 'false' && (await pg.getAttribute(`${FG} [data-main-photos]`, 'data-rg-photos-choisies')) === '7', `G ${T} une photo retirée d’un toucher ⇒ 7 prêtes`);
          const avG2 = await pg.evaluate(() => window.__partages.length), dG2 = dl.length;
          await clic(pg, `${FG} [data-main-telecharger]`);
          await attendre(pg, () => (document.querySelector("[data-repub-main] [data-acc-apres=\"republier.main\"]") ? 1 : null), 30000); await pg.waitForTimeout(500);
          const p7 = await pg.evaluate(() => window.__partages.slice(-1)[0] || null);
          if (tel) dit((await pg.evaluate(() => window.__partages.length)) === avG2 + 1 && p7 && p7.noms.length === 7 && p7.geste, `G ${T} le partage suivant porte 7 fichiers`, p7);
          else dit(dl.length - dG2 === 7, `G ${T} 7 photos téléchargées`, dl.slice(dG2));
          const ap7 = await attendre(pg, () => { const a = document.querySelector('[data-repub-main] [data-acc-apres="republier.main"]'); return a ? a.textContent : null; });
          dit(ap7 && /7 photos/.test(ap7), `G ${T} après : « 7 photos … »`, ap7);
          await pg.screenshot({ path: nomF('9-sept-photos') });
          await clic(pg, `${FG} button[aria-label="Fermer"]`, false); await pg.waitForTimeout(300);
          // Une annonce dont VRM n'a que la vignette (9103) : dit, avec le lien de l'annonce et « Relire ».
          await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces&vue=republier`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('[data-selection-annonce="9103"]', { timeout: 20000 });
          await clic(pg, '[data-selection-annonce="9103"] input', false);
          await attendre(pg, () => (document.querySelector('[data-republier-main-lancer]') ? 1 : null));
          await clic(pg, '[data-republier-main-lancer]', false);
          const couvSeule = await attendre(pg, () => { const x = document.querySelector('[data-repub-main="9103"] [data-rg-photos-manque]'); return x ? { m: x.getAttribute('data-rg-photos-manque'), lien: (x.querySelector('[data-rg-ouvrir-annonce]') || {}).getAttribute ? x.querySelector('[data-rg-ouvrir-annonce]').getAttribute('href') : null, relire: !!x.querySelector('[data-rg-relire-photos]') } : null; }, 12000);
          dit(couvSeule && couvSeule.lien === 'https://www.vinted.fr/items/9103' && !couvSeule.relire && (couvSeule.m === 'couverture' || Number(couvSeule.m) > 0), `G ${T} VRM n’a pas toutes les photos : il le dit, avec le lien de l’annonce (plus de « Relire les photos » : il relit seul au retour)`, couvSeule);
          await pg.screenshot({ path: nomF('10-photos-manquent') });
          await clic(pg, '[data-repub-main] button[aria-label="Fermer"]', false); await pg.waitForTimeout(300);
          // ── P : publier à la main, une fiche « À publier » ──
          touchers = 0;
          const poolAvant = JSON.stringify(await ls(pg, 'vinted_used_numeros'));
          await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
          const bt = await attendre(pg, () => (document.querySelector('[data-fiche-neuve-main="45"]') ? 1 : null), 20000);
          dit(bt === 1, `P ${T} « À publier » : la fiche N°45 a « À la main »`);
          if (bt !== 1) throw new Error('pas de bouton À la main sur la fiche');
          await clic(pg, '[data-fiche-neuve-main="45"]');
          const FP = '[data-publier-main="45"]';
          await pg.waitForSelector(FP, { timeout: 8000 }); await poseeLa(pg, FP);
          dit((await pg.getAttribute(`${FP} [data-rg-etapes]`, 'data-rg-etapes')) === 'photos,creer,fini', `P ${T} trois étapes (photos · créer · fini)`);
          await attendre(pg, () => { const x = document.querySelector('[data-publier-main] [data-main-telecharger]'); return x && x.getAttribute('data-rg-photos-pretes') === '1' ? 1 : null; }, 12000);
          const avP = (await pg.evaluate(() => window.__partages.length)), avD = dl.length;
          await clic(pg, `${FP} [data-main-telecharger]`);
          await attendre(pg, () => (document.querySelector('[data-publier-main] [data-acc-apres="republier.main"]') ? 1 : null));
          const p2 = await pg.evaluate(() => window.__partages.slice(-1)[0] || null);
          if (tel) dit((await pg.evaluate(() => window.__partages.length)) === avP + 1 && p2 && p2.noms.join(',') === 'VRM-45-01.jpg' && p2.geste, `P ${T} iPhone : UN toucher, la photo de la fiche partagée dans le geste`, p2);
          else { await pg.waitForTimeout(400); dit(dl.slice(avD).join(',') === 'VRM-45-01.jpg', `P ${T} ordinateur : la photo téléchargée d’un toucher`, dl.slice(avD)); }
          await clic(pg, `${FP} [data-main-suivant="creer"]`);
          await clic(pg, `${FP} [data-main-copier="description"]`); await pg.waitForTimeout(250);
          const dP = await pressePapier(pg);
          dit(/^Neuves, jamais portées\.\n\nN°45$/.test(dP || ''), `P ${T} la description copiée porte le N°45 de la fiche`, dP);
          dit((await pg.$$eval(`${FP} [data-main-section="creer"] [data-main-champ]`, (l) => l.map((x) => x.getAttribute('data-main-champ')).join(','))) === 'titre,description,categorie,marque,taille,etat,couleur,prix', `P ${T} tous les champs de la fiche à copier, dans l’ordre de Vinted`);
          await pg.screenshot({ path: nomF('6-publier-creer') });
          await clic(pg, `${FP} [data-main-suivant="fini"]`);
          dit((await pg.getAttribute(`${FP} [data-rg-fin]`, 'data-rg-fin')) === 'pas-su', `P ${T} pas encore vue ⇒ « pas encore vue », jamais devinée`);
          // Une annonce lue porte maintenant le N°45 (la preuve qui sort la fiche de « À publier »).
          await pg.evaluate(() => { const v = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); v['9301'] = { numero: '45' }; localStorage.setItem('vinted_annonce_numeros', JSON.stringify(v)); window.dispatchEvent(new CustomEvent('vrm:save', { detail: { k: 'vinted_annonce_numeros' } })); });
          const finP = await attendre(pg, () => { const x = document.querySelector('[data-publier-main] [data-rg-fin]'); return x && x.getAttribute('data-rg-fin') === 'fait' ? x.textContent : null; }, 8000);
          dit(finP && /C’est publié · N°45/.test(finP), `P ${T} « C’est publié · N°45 », relu par le N° de la fiche`, finP);
          const travP = await attendre(pg, () => { try { const l = JSON.parse(localStorage.getItem('vrm_suivi_travaux') || '[]'); return l.some((t) => t && t.id === 'm-publier-main-fiche-banc-1') ? 1 : null; } catch (_) { return null; } });
          dit(travP === 1, `P ${T} noté dans « Ce que VRM a fait »`);
          const poolApres = JSON.stringify(await ls(pg, 'vinted_used_numeros'));
          dit(poolAvant === poolApres, `P ${T} aucun N° neuf donné par la publication (le N° de la fiche, une fois)`, { poolAvant, poolApres });
          console.log(`    touchers (« À la main » → « C’est publié ») : ${touchers}`);
          await pg.screenshot({ path: nomF('7-publie') });
          const p3 = await petitsDans(pg, FP);
          if (tel) dit(!p3.length, `F ${T} cibles au doigt ≥ 44 px (publier)`, p3.join(" | "));
          const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          dit(deb <= 1, `F ${T} aucun débordement horizontal`, deb);
          dit(!errs.length, `F ${T} aucune erreur de page`, errs.slice(0, 2).join(' | '));
        } catch (e) { dit(false, `${T} le parcours s’arrête`, e.message.split('\n')[0]); await pg.screenshot({ path: nomF('erreur') }).catch(() => {}); }
        await ctx.close();
      }
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\nKO  ${ko} contrôle(s) rouge(s) — captures : ${SHOTS}` : `\nOK  republier et publier à la main, guidés — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
