require('./_porte-banc.cjs');
// ═══════════════════════════════════════════════════════════════════════════
// BANC : CHERCHER PAR PHOTO (6 nov.) — l'app RENDUE, données et photos INVENTÉES
//        (BANC_PORT=10352 node scripts/bancs/recherche-photo.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Julien a une paire en main, il la photographie : VRM propose les annonces dont
// la photo lui ressemble le plus, il choisit. Les « photos » sont dessinées ICI
// dans la page (formes et couleurs : semelle, tige, col, bande, lacets), servies
// comme le CDN Vinted les sert (sans en-tête CORS : le banc ne l'ajoute pas).
// La « prise de photo » est un FICHIER posé dans le champ de l'appareil photo.
// Deux tailles (390 px tactile, 1512 px souris). On exige :
//   A. l'appareil photo est dans la loupe (ordinateur : la barre ; téléphone :
//      l'en-tête de recherche) et dans le Stock ; il ouvre la feuille ;
//   B. une photo « à la main » de la N°13 (autre fond, autre lumière, recadrée,
//      un bout de main) ⇒ 5 propositions au plus, la N°13 EN TÊTE, chacune avec
//      sa photo affichée, son N°, son compte, son état, un mot (jamais « c'est
//      elle ») ; la N°99 sans photo n'est pas classée (comptée « sans photo ») ;
//   C. deux annonces au MÊME titre (N°14 et N°15) : la photo de la N°15 la met
//      en tête ; la N°14, si elle est proposée, est une AUTRE ligne, son N° à elle ;
//   D. rien n'est relié : aucune écriture (POST/PATCH/DELETE) pendant la recherche ;
//      le clic sur une ligne ouvre « Tout sur le N° » de CE numéro ;
//   E. aucune requête vers un tiers : seulement l'app, sa base, sa route photo
//      (`/api/compte?mode=photo`, l'extension étant absente) et le CDN Vinted
//      pour AFFICHER les vignettes ; aucun script ni modèle chargé d'ailleurs ;
//   F. l'index est GARDÉ sur l'appareil : la 2e recherche ne relit aucune photo,
//      et après un RECHARGEMENT de la page non plus (IndexedDB) ;
//   G. une photo que la route refuse (503) est COMPTÉE « pas lue », jamais classée ;
//   H. lignes ≥ 44 px, aucun débordement horizontal, aucune erreur de page.
// Captures : SHOTS=dossier (feuille avec résultats, aux deux tailles).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10352;
const SHOTS = process.env.SHOTS || '';
// BANC_MUTATION=sans-index : l'index de l'appareil est effacé avant le rechargement ⇒ F doit rougir.
const MUT = process.env.BANC_MUTATION || '';
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const AUJ = Date.now();
const CDN = (id) => `https://images1.vinted.net/t/banc/f800/${id}.jpeg?s=banc`;

// Les paires inventées : [tige, col, semelle, bande, lacets].
const PAIRES = {
  7011: { n: '11', c: ['#c8102e', '#111111', '#f4f4f2', '#f4f4f2', '#111111'], t: 'Paire inventée rouge 41', acc: '111' },
  7012: { n: '12', c: ['#1d4ed8', '#1d4ed8', '#f4f4f2', '#fde047', '#f4f4f2'], t: 'Paire inventée bleue 42', acc: '111' },
  7013: { n: '13', c: ['#15803d', '#a16207', '#f4f4f2', '#111111', '#f4f4f2'], t: 'Paire inventée verte 43', acc: '222' },
  7014: { n: '14', c: ['#f4f4f2', '#f4f4f2', '#f4f4f2', '#c8102e', '#f4f4f2'], t: 'Nike Air Force 1 blanc taille 42', acc: '111' },
  7015: { n: '15', c: ['#f4f4f2', '#1d4ed8', '#a16207', '#1d4ed8', '#111111'], t: 'Nike Air Force 1 blanc taille 42', acc: '222' },
  7016: { n: '16', c: ['#111111', '#111111', '#f4f4f2', '#f4f4f2', '#111111'], t: 'Paire inventée noire 40', acc: '222' },
  7017: { n: '17', c: ['#f59e0b', '#78350f', '#111111', '#f4f4f2', '#78350f'], t: 'Paire inventée orange 44', acc: '111', horsLigne: true },
  7018: { n: '', c: ['#7c3aed', '#7c3aed', '#f4f4f2', '#ec4899', '#f4f4f2'], t: 'Paire inventée violette sans N°', acc: '111' },
};
const MAIN = {
  vinted_annonce_numeros: Object.fromEntries([
    ...Object.entries(PAIRES).filter(([, p]) => p.n).map(([id, p]) => [id, { numero: p.n, title: p.t, photo: CDN(id), accountId: p.acc, numberedAt: '2026-10-20T10:00:00Z' }]),
    ['7099', { numero: '99', title: 'Fiche inventée sans photo', photo: null, accountId: '111', numberedAt: '2026-10-20T10:00:00Z' }],
  ]),
  vinted_used_numeros: [11, 12, 13, 14, 15, 16, 17, 99],
  vrm_numerotation: { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z', appliqueLe: '2026-10-11T14:58:07Z' },
};
const ann = (id, p) => ({ id: Number(id), title: p.t, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, photo: { url: CDN(id) }, brand_title: 'Marque', size_title: '42' });
const enLigne = (acc) => Object.entries(PAIRES).filter(([, p]) => p.acc === acc && !p.horsLigne).map(([id, p]) => ann(id, p));
const LIGNES = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: new Date(AUJ - 3600e3).toISOString(), payload: { items: enLigne('111'), pagination: { total_entries: enLigne('111').length } } } },
  { id: 'harvest_222_listings', data: { capturedAt: new Date(AUJ - 3600e3).toISOString(), payload: { items: enLigne('222'), pagination: { total_entries: enLigne('222').length } } } },
];
const COMPTES = [
  { id: 1, vinted_user_id: '111', login: 'compte_alpha', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, vinted_user_id: '222', login: 'compte_beta', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

// Le dessin d'une paire, dans la page (canvas) : rend un JPEG en base64.
// v : { fond:[mur,sol], zoom, dx, dy, filtre, main }
const DESSIN = `(c, v) => {
  const W = 480, H = 640, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  x.fillStyle = v.fond[0]; x.fillRect(0, 0, W, H * 0.58); x.fillStyle = v.fond[1]; x.fillRect(0, H * 0.58, W, H);
  x.save(); x.translate(W / 2 + (v.dx || 0) * W, H / 2 + (v.dy || 0) * H); x.scale(v.zoom || 1, v.zoom || 1); x.translate(-W / 2, -H / 2);
  if (v.filtre) x.filter = v.filtre;
  const ell = (cx, cy, rx, ry, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); };
  ell(W * 0.48, H * 0.53, W * 0.36, H * 0.12, c[0]);
  ell(W * 0.24, H * 0.46, W * 0.1, H * 0.09, c[1]);
  x.fillStyle = c[2]; x.fillRect(W * 0.1, H * 0.62, W * 0.8, H * 0.065);
  x.strokeStyle = c[3]; x.lineWidth = W * 0.045; x.lineCap = 'round'; x.beginPath(); x.moveTo(W * 0.28, H * 0.6); x.quadraticCurveTo(W * 0.5, H * 0.6, W * 0.7, H * 0.5); x.stroke();
  x.fillStyle = c[4]; for (let j = 0; j < 5; j++) x.fillRect(W * (0.5 + j * 0.05), H * (0.43 + j * 0.006), W * 0.03, H * 0.025);
  x.restore();
  if (v.main) { x.fillStyle = '#d8a07a'; x.beginPath(); x.ellipse(W * 0.86, H * 0.5, W * 0.16, H * 0.07, -0.5, 0, Math.PI * 2); x.fill(); }
  return cv.toDataURL('image/jpeg', 0.85).split(',')[1];
}`;

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT'); process.exit(1); });
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
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function rendre(b, { tel, images, refus = new Set() }) {
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  if (process.env.BANC_DEBUG) pg.on('console', (m) => console.log('   [console] ' + m.type() + ' ' + m.text().slice(0, 200)));
  // Chaque requête : l'hôte, le chemin, la méthode ; pour une ÉCRITURE en base, ce
  // qu'elle écrit (les identifiants de lignes et les clés de `main` touchées).
  const ecrit = (r) => { if (r.method() === 'GET' || !/\/rest\/v1\//.test(r.url())) return undefined; try { const d = JSON.parse(r.postData() || 'null'); const l = Array.isArray(d) ? d : [d]; return l.filter(Boolean).map((x) => String(x.id || '?') + (x.data && typeof x.data === 'object' ? '{' + Object.keys(x.data).slice(0, 8).join(',') + '}' : '')); } catch (_) { return ['?']; } };
  const req = []; pg.on('request', (r) => { try { const u = new URL(r.url()); req.push({ hote: u.host, chemin: u.pathname + (u.search || ''), methode: r.method(), type: r.resourceType(), ecrit: ecrit(r) }); } catch (_) {} });
  const photosRoute = { n: 0 };
  // Tout ce qui sort vers un hôte inconnu est COUPÉ (et compté par `req`).
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  // Le CDN Vinted, pour AFFICHER les vignettes (sans en-tête CORS, comme le vrai).
  await pg.route(/^https:\/\/images1\.vinted\.net\//, (r) => { const id = (/\/(\d+)\.jpeg/.exec(r.request().url()) || [])[1]; const o = images[id]; return o ? r.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from(o, 'base64') }) : r.fulfill({ status: 404, body: '' }); });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(COMPTES);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data$|^data$/.test(sel) ? projette(r, sel) : { ...r, updated_at: new Date(AUJ).toISOString() });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // La route photo de VRM (l'extension est absente dans le banc) : enregistrée
  // APRÈS la générale — Playwright prend la dernière en premier.
  await pg.route(/\/api\/compte\?mode=photo/, async (r) => {
    photosRoute.n++;
    let url = ''; try { url = JSON.parse(r.request().postData() || '{}').url || ''; } catch (_) {}
    const id = (/\/(\d+)\.jpeg/.exec(url) || [])[1];
    if (!id || !images[id] || refus.has(id)) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"erreur":"photo indisponible"}' });
    return r.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from(images[id], 'base64') });
  });
  await pg.addInitScript(({ m }) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const k in m) localStorage.setItem(k, JSON.stringify(m[k])); } catch (_) {} }, { m: MAIN });
  await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs, req, photosRoute };
}
// Une capture à REGARDER (§6.2) : un échec est dit, il n'arrête pas le scénario.
const capture = async (pg, nom) => { if (!SHOTS) return; try { await pg.screenshot({ path: path.join(SHOTS, nom), timeout: 60000, animations: 'disabled' }); } catch (e) { dit(false, 'capture ' + nom, String(e && e.message).split('\n')[0].slice(0, 120)); } };
const toucher = async (pg, tel, sel) => { if (tel) await pg.tap(sel); else await pg.click(sel); };
const etatFeuille = (pg) => pg.evaluate(() => {
  const f = document.querySelector('[data-recherche-photo]');
  if (!f) return null;
  const lignes = [...f.querySelectorAll('[data-rp-resultat]')].map((el) => {
    const img = el.querySelector('img'); const r = el.getBoundingClientRect();
    return { score: el.getAttribute('data-rp-score'), cle: el.getAttribute('data-rp-resultat'), rang: el.getAttribute('data-rp-rang'), niveau: el.getAttribute('data-rp-niveau'), num: el.getAttribute('data-rp-num'), mot: (el.querySelector('[data-rp-mot]') || {}).textContent || '', etat: (el.querySelector('[data-rp-etat-annonce]') || {}).textContent || '', h: Math.round(r.height), w: Math.round(r.width), photo: !!(img && img.complete && img.naturalWidth > 0) };
  });
  const bilan = f.querySelector('[data-rp-bilan]');
  return { etat: f.getAttribute('data-rp-etat'), lignes, indexees: bilan && bilan.getAttribute('data-rp-indexees'), illisibles: bilan && bilan.getAttribute('data-rp-illisibles'), texte: (f.innerText || '').replace(/\s+/g, ' ').slice(0, 900), fw: Math.round(f.getBoundingClientRect().width), sw: f.scrollWidth, cw: f.clientWidth };
});
// « Prendre la photo » : un fichier posé dans le champ de l'appareil photo.
const photographier = async (pg, b64, nom = 'paire.jpg') => {
  await pg.setInputFiles('[data-rp-fichier="camera"]', { name: nom, mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
  await pg.waitForFunction(() => { const f = document.querySelector('[data-recherche-photo]'); const e = f && f.getAttribute('data-rp-etat'); return e && e !== 'calcul' && e !== 'attente'; }, null, { timeout: Number(process.env.BANC_ATTENTE) || 60000 }).catch(() => {});
};
const ouvrirDepuisLoupe = async (pg, tel) => {
  if (tel) { await pg.tap('[data-recherche-loupe]'); await pg.waitForSelector('.vrm-hdr-recherche [data-recherche-photo-ouvrir]', { timeout: 8000 }); await pg.tap('.vrm-hdr-recherche [data-recherche-photo-ouvrir]'); }
  else await pg.click('[data-barre-recherche] [data-recherche-photo-ouvrir]');
  await pg.waitForSelector('[data-recherche-photo]', { timeout: 15000 });
};

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).split('\n')[0].slice(0, 300)); } };
  try {
    b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    // Les photos inventées : celles des annonces, et deux photos « à la main ».
    const atelier = await b.newPage();
    const dessiner = (c, v) => atelier.evaluate(([d, c2, v2]) => (0, eval)(d)(c2, v2), [DESSIN, c, v]);
    const ANNONCE = { fond: ['#eeeae4', '#d9d2c7'] };
    const images = {};
    for (const [id, p] of Object.entries(PAIRES)) images[id] = await dessiner(p.c, ANNONCE);
    const aLaMain = (id) => dessiner(PAIRES[id].c, { fond: ['#3b3f46', '#6b4f35'], zoom: 1.18, dx: -0.06, dy: 0.04, filtre: 'brightness(0.78) sepia(0.15)', main: true });
    const q13 = await aLaMain(7013), q15 = await aLaMain(7015);
    await atelier.close();

    for (const tel of [false, true]) {
      const T = tel ? '[390]' : '[1512]';
      await essaie(T, async () => {
        const { ctx, pg, errs, req, photosRoute } = await rendre(b, { tel, images });
        // A. L'appareil photo : dans le Stock, et dans la loupe.
        const stock = await pg.$('[data-stock-recherche-photo]');
        dit(!!stock, `${T} A. le Stock porte « Trouver par photo »`);
        await ouvrirDepuisLoupe(pg, tel);
        let f = await etatFeuille(pg);
        dit(!!f && f.etat === 'attente', `${T} A. l'appareil photo de la loupe ouvre « Chercher par photo »`, f && f.etat);
        const avant = req.length;
        // B. Une photo à la main de la N°13.
        await photographier(pg, q13);
        await pg.waitForTimeout(600);
        f = await etatFeuille(pg);
        if (process.env.BANC_DEBUG) console.log(JSON.stringify(req.slice(avant).map((r) => r.methode + ' ' + r.hote + r.chemin.slice(0, 120))));
        const L = (f && f.lignes) || [];
        dit(!!f && f.etat === 'resultats' && L.length >= 1 && L.length <= 5, `${T} B. des propositions (5 au plus)`, f && `${f.etat} · ${L.length}`);
        dit(L[0] && L[0].num === '13', `${T} B. la N°13 photographiée à la main est EN TÊTE`, JSON.stringify(L.map((x) => x.num + ':' + x.niveau + ':' + x.score)));
        dit(L.length && L.every((x) => x.photo), `${T} B. chaque proposition montre sa photo`, JSON.stringify(L.map((x) => x.photo)));
        dit(L.length && L.every((x) => /^(Très proche|Proche|Peu sûr)$/.test(x.mot.trim())), `${T} B. chaque proposition dit un mot de ressemblance (jamais « c'est elle »)`, JSON.stringify(L.map((x) => x.mot)));
        dit(!/c['’]est elle\s*[.!]?$/im.test(L.map((x) => x.mot).join('\n')), `${T} B. aucun « c'est elle »`);
        const l13 = L.find((x) => x.num === '13') || {};
        dit(/En ligne/.test(l13.etat) && /compte_beta/.test(l13.etat), `${T} B. la ligne dit l'état et le compte`, l13.etat);
        dit(!L.some((x) => x.num === '99') && /1 fiche sans photo/.test(f.texte), `${T} B. la fiche N°99 sans photo n'est pas classée, elle est comptée`, f && f.texte.slice(-260));
        dit(f && f.indexees === '8' && f.illisibles === '0', `${T} B. 8 photos d'annonces comparées, aucune pas lue`, f && `${f.indexees}/${f.illisibles}`);
        const lSans = L.find((x) => x.cle === '7018');
        if (lSans) dit(lSans.num === '' , `${T} B. l'annonce sans N° est dite « Sans N° »`);
        await capture(pg, `recherche-photo-${tel ? 390 : 1512}.png`);
        // E. Aucune requête vers un tiers pendant la recherche.
        const pendant = req.slice(avant);
        const app = (h) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h);
        const base = (h) => /\.supabase\.co$/.test(h);
        const cdnAffichage = pendant.filter((r) => r.hote === 'images1.vinted.net');
        const tiers = pendant.filter((r) => !app(r.hote) && !base(r.hote) && r.hote !== 'images1.vinted.net');
        dit(!tiers.length, `${T} E. aucune requête vers un tiers pendant la recherche`, JSON.stringify(tiers.slice(0, 5)));
        dit(cdnAffichage.every((r) => r.type === 'image'), `${T} E. le CDN Vinted n'est appelé que pour AFFICHER des vignettes (balises image)`, JSON.stringify(cdnAffichage.filter((r) => r.type !== 'image').slice(0, 3)));
        dit(!pendant.some((r) => /\.(onnx|wasm|bin)(\?|$)|tfjs|onnxruntime|jsdelivr|unpkg|cdnjs/i.test(r.chemin + r.hote)), `${T} E. aucun modèle ni moteur chargé`);
        dit(photosRoute.n === 8, `${T} E. les 8 photos lues par la route de VRM (l'extension absente), une fois chacune`, String(photosRoute.n));
        // D. Rien n'est relié : aucune écriture.
        const ecritures = pendant.filter((r) => /\/rest\/v1\//.test(r.chemin) && r.methode !== 'GET');
        dit(!ecritures.length, `${T} D. aucune écriture en base pendant la recherche`, JSON.stringify(ecritures.slice(0, 3)));
        // H. Les lignes, la largeur.
        dit(L.every((x) => x.h >= 44), `${T} H. lignes ≥ 44 px`, JSON.stringify(L.map((x) => x.h)));
        dit(f.sw <= f.cw + 1, `${T} H. la feuille ne déborde pas`, `${f.sw}/${f.cw}`);
        // F. L'index est gardé : une 2e recherche (la N°15, au même titre que la N°14) ne relit aucune photo.
        const n1 = photosRoute.n;
        await photographier(pg, q15, 'autre.jpg');
        await pg.waitForTimeout(400);
        f = await etatFeuille(pg);
        const L2 = (f && f.lignes) || [];
        dit(photosRoute.n === n1, `${T} F. 2e recherche : aucune photo relue (index gardé sur l'appareil)`, `${photosRoute.n - n1} relue(s)`);
        // C. Même titre, deux paires.
        dit(L2[0] && L2[0].num === '15', `${T} C. la photo de la N°15 la met en tête (la N°14 a le même titre)`, JSON.stringify(L2.map((x) => x.num + ':' + x.niveau + ':' + x.score)));
        const l14 = L2.find((x) => x.num === '14');
        dit(!l14 || (l14.cle === '7014' && l14.cle !== L2[0].cle), `${T} C. la N°14, si proposée, est une AUTRE ligne avec SON N°`, l14 ? JSON.stringify(l14) : 'pas proposée');
        dit(new Set(L2.map((x) => x.cle)).size === L2.length, `${T} C. chaque annonce une seule fois`);
        await capture(pg, `recherche-photo-${tel ? 390 : 1512}-n15.png`);
        // D. Le clic ouvre « Tout sur le N° » de CE numéro.
        await toucher(pg, tel, '[data-rp-resultat][data-rp-rang="1"]');
        await pg.waitForSelector('[data-tout-num]', { timeout: 10000 }).catch(() => {});
        const tout = await pg.evaluate(() => { const el = document.querySelector('[data-tout-num]'); return { num: el && el.getAttribute('data-tout-num'), feuille: !!document.querySelector('[data-recherche-photo]') }; });
        dit(tout.num === '15' && !tout.feuille, `${T} D. le clic ouvre « Tout sur le N°15 » (la feuille se ferme)`, JSON.stringify(tout));
        await capture(pg, `recherche-photo-${tel ? 390 : 1512}-tout.png`);
        // Après le clic, l'app peut publier ses RÉSUMÉS calculés (ex. `lbc_a_retirer`,
        // §11) comme sur n'importe quel écran : on exige qu'AUCUNE écriture ne touche
        // une identité ou un lien (fiches N°, ventes reliées, liens Leboncoin/Vestiaire,
        // pool des numéros) — rien n'est relié par la recherche.
        const ecr2 = req.filter((r) => /\/rest\/v1\//.test(r.chemin) && r.methode !== 'GET');
        const IDENT = /^main\b|numero|override|lien|buy|achat|relie|vinted_annonce|used_num|fiche/i;
        const liees = ecr2.filter((r) => (r.ecrit || ['?']).some((x) => IDENT.test(x) || x === '?'));
        dit(!liees.length, `${T} D. après le clic, aucune écriture d'identité ni de lien (rien n'est relié)`, liees.length ? JSON.stringify(liees.slice(0, 3)) : 'écrit ailleurs : ' + (ecr2.flatMap((r) => r.ecrit || []).join(' ') || 'rien'));
        // A (Stock) : le bouton du Stock ouvre la même feuille — après un RECHARGEMENT
        // (la mémoire de la page est perdue ; seul l'IndexedDB de l'appareil reste).
        if (MUT === 'sans-index') await pg.evaluate(() => new Promise((ok) => { const r = indexedDB.deleteDatabase('vrm_empreintes_photos'); r.onsuccess = r.onerror = r.onblocked = () => ok(); }));
        const n2 = photosRoute.n;
        await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-stock-recherche-photo]', { timeout: 20000 }).catch(() => {});
        await toucher(pg, tel, '[data-stock-recherche-photo]');
        await pg.waitForSelector('[data-recherche-photo]', { timeout: 15000 }).catch(() => {});
        f = await etatFeuille(pg);
        dit(!!f && f.etat === 'attente', `${T} A. « Trouver par photo » du Stock ouvre la même feuille`, f && f.etat);
        // F. Après le rechargement, l'index est relu de l'APPAREIL : aucune photo relue.
        await photographier(pg, q13, 'encore.jpg');
        f = await etatFeuille(pg);
        dit(!!f && f.etat === 'resultats' && f.lignes[0] && f.lignes[0].num === '13' && photosRoute.n === n2, `${T} F. après rechargement, l'index vient de l'appareil (IndexedDB) : aucune photo relue, la N°13 toujours en tête`, `${photosRoute.n - n2} relue(s) · ${f && f.lignes.map((x) => x.num).join(',')}`);
        const large = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(large <= 1, `${T} H. pas de défilement horizontal de la page`, String(large));
        dit(!errs.length, `${T} H. aucune erreur de page`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      });
      // G. Une photo refusée par la route : comptée « pas lue », jamais classée.
      await essaie(T + ' refus', async () => {
        const { ctx, pg, errs } = await rendre(b, { tel, images, refus: new Set(['7013']) });
        await toucher(pg, tel, '[data-stock-recherche-photo]');
        await pg.waitForSelector('[data-recherche-photo]', { timeout: 15000 });
        await photographier(pg, q13);
        const f = await etatFeuille(pg);
        dit(!!f && f.illisibles === '1' && !f.lignes.some((x) => x.num === '13') && /pas pu être lue/.test(f.texte), `${T} G. la photo refusée (N°13) est comptée « pas lue », jamais classée`, f && `${f.illisibles} · ${f.lignes.map((x) => x.num).join(',')}`);
        dit(!errs.length, `${T} G. aucune erreur de page`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTout est vert');
  process.exitCode = ko ? 1 : 0;
})();
