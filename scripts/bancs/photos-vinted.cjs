// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES PHOTOS DU CDN DE VINTED S'AFFICHENT, MÊME QUAND LE CDN REFUSE
//        (node scripts/bancs/photos-vinted.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 11 octobre : « je n'ai plus les photos de mes annonces, ni dans les
// bordereaux, ni dans les ventes ». Les données sont intactes ; c'est
// l'affichage HORS de vinted.fr qui échoue (cause supposée : CORP ou
// anti-hotlink sur le référent, ou un logiciel de protection — mesurée chez lui
// par la sonde de `src/photosVinted.js`, jamais devinée).
//
// ⚠️ LE FAUX CDN EST UN VRAI SERVEUR HTTPS. Mesuré avant d'écrire ce banc : une
//    image servie par `page.route()` avec `Cross-Origin-Resource-Policy:
//    same-site` S'AFFICHE dans le Chromium du banc (l'interception de Playwright
//    passe à côté du contrôle CORP du réseau) — un banc construit comme ça
//    serait vert sur le défaut. Le CDN est donc un serveur HTTPS local, résolu
//    sous le nom `images1.vinted.net` (`--host-resolver-rules`), avec un
//    certificat jetable fabriqué à chaque lancement (jamais dans le dépôt) :
//    là, CORP bloque pour de vrai (vérifié en tête de banc, sinon il le dit).
//
// Données INVENTÉES (aucune fixture : il vit dans le dépôt, qui est public).
// Le pont de l'extension est simulé avec le VRAI dialogue de `vmrPhoto`
// (`photo` → `photo:result` + `dataUrl`), et compte ses demandes.
//
// Il exige, aux deux tailles (390 px tactile et 1512 px) :
//   A. CDN qui refuse (CORP) + extension : Ventes, Annonces et Colis affichent
//      leurs photos par le secours (naturalWidth > 0) ; au plus 3 demandes en
//      vol ; aucune demande pour une photo hors écran ; aucune redemande quand
//      l'écran se redessine ; aucune phrase (tout s'affiche) ;
//   B. CDN qui refuse, SANS extension : aucune image cassée (le pictogramme),
//      la phrase UNE fois (« bloquée », et le geste qui suit l'appareil), le
//      bilan `diag_photos` écrit SANS adresse, signature ni titre ;
//      et une lecture ratée de `diag_photos` n'écrit rien ;
//   C. CDN qui marche : aucune demande au pont, aucune phrase ;
//   D. CDN qui refuse un RÉFÉRENT : les photos s'affichent sans secours
//      (`no-referrer`), aucune phrase ;
//   E. CDN qui répond une erreur (la sonde reçoit une réponse) : une AUTRE
//      phrase que « bloquée » — on n'affirme pas ce qu'on n'a pas mesuré.
// On juge les ÉLÉMENTS rendus (naturalWidth, `data-photo-vinted`,
// `data-photos-bloquees`), les demandes reçues par le pont et le corps envoyé à
// la base — pas une formulation.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), https = require('https'), path = require('path'), os = require('os'), cp = require('child_process');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 5741, PORT_CDN = 5742;

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const dansJ = (j) => { const d = new Date(MAINTENANT + j * 86400000); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
// La forme réelle d'une photo Vinted (mesurée) : /t/<jeton>/f800/<horodatage>.jpeg?s=<signature>.
// Jetons et signatures INVENTÉS.
const hex = (n, l) => (n * 2654435761 >>> 0).toString(16).padStart(8, '0').repeat(Math.ceil(l / 8)).slice(0, l);
const photoUrl = (k) => `https://images1.vinted.net/t/${hex(k, 46)}/f800/${1760000000 + k}.jpeg?s=${hex(k + 7, 40)}`;
const N_ANN = 40;
const ANNONCES = Array.from({ length: N_ANN }, (_, i) => ({
  id: 8100 + i, title: `Banc Annonce ${i + 1} taille 42`, price: { amount: String(40 + i), currency_code: 'EUR' },
  is_closed: false, is_draft: false, brand_title: 'Banc', size_title: '42', status: 'Très bon état', view_count: 3, favourite_count: 1,
  photo: { url: photoUrl(100 + i) }, nPhotos: 4, created_at_ts: Math.floor((MAINTENANT - (i + 1) * 86400000) / 1000),
}));
const VENTES = [
  { tx: 9301, titre: 'Banc Vente Alpha', status: 'Bordereau envoyé au vendeur', tus: 'needs_action', j: 1 },
  { tx: 9302, titre: 'Banc Vente Bravo', status: "Bordereau d'envoi commandé", tus: 'needs_action', j: 1.5 },
  { tx: 9303, titre: 'Banc Vente Charlie', status: "Commande expédiée et en cours d'acheminement ! ", tus: 'waiting', j: 2 },
  { tx: 9304, titre: 'Banc Vente Delta', status: "Commande finalisée - l'acheteur a validé la commande", tus: 'completed', j: 3 },
  { tx: 9305, titre: 'Banc Vente Echo', status: "Commande finalisée - l'acheteur a validé la commande", tus: 'completed', j: 4 },
].map((v, i) => ({ transaction_id: v.tx, title: v.titre, price: { amount: String(50 + i), currency_code: 'EUR' }, status: v.status,
  transaction_user_status: v.tus, date: ilYa(v.j), photo: { url: photoUrl(900 + i) } }));
const TITRES = [...ANNONCES.map((a) => a.title), ...VENTES.map((v) => v.title)];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const ROWS = [
  { id: 'main', data: {} },
  { id: 'harvest_111_listings', data: { uid: '111', capturedAt: new Date(MAINTENANT).toISOString(), nItems: N_ANN, payload: { items: ANNONCES, pagination: { total_entries: N_ANN, total_pages: 1 } } } },
  { id: 'harvest_111_orders_sold', data: { uid: '111', capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: VENTES } } },
  { id: 'email_bord_banc_bravo', data: { transaction: '9302', filename: 'bordereau-bravo.pdf', modele: 'Banc Vente Bravo', article: 'Banc Vente Bravo', receivedAt: ilYa(0.2), dateLimite: dansJ(6), pdfB64: PDF_B64 } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
// Un banc ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
// SEUL=« A 1512 » (par exemple) ne joue que les scénarios dont le nom commence ainsi — pour chercher, jamais pour prouver.
const SEUL = process.env.SEUL || '';
const essaie = async (nom, f) => { if (SEUL && !nom.startsWith(SEUL)) return; try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

// ── L'application ──
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  // Une page VIDE de la même origine que l'app (contrôle 0 : le faux CDN bloque-t-il ?).
  if (q.url === '/__banc-vide') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><title>banc</title>'); }
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });

// ── Le faux CDN : un VRAI serveur HTTPS, certificat jetable ──
// Une vraie image (PNG 2×2). Le pont rend une autre image (3×3) : on sait ainsi
// laquelle des deux voies a affiché la photo.
const PNG_CDN = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
const PNG_PONT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAEklEQVR4nGNgYGBgYmBgYGAAAAAgAAOpuFE0AAAAAElFTkSuQmCC';
const dirCert = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-cdn-'));
cp.execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dirCert, 'k.pem'), '-out', path.join(dirCert, 'c.pem'),
  '-days', '1', '-subj', '/CN=images1.vinted.net', '-addext', 'subjectAltName=DNS:images1.vinted.net'], { stdio: 'ignore' });
const cdnEtat = { mode: 'corp', vues: [] };
const cdn = https.createServer({ key: fs.readFileSync(path.join(dirCert, 'k.pem')), cert: fs.readFileSync(path.join(dirCert, 'c.pem')) }, (q, r) => {
  cdnEtat.vues.push({ url: q.url, ref: q.headers.referer || '', dest: q.headers['sec-fetch-dest'] || '' });
  const m = cdnEtat.mode;
  if (m === 'erreur') { r.writeHead(404, { 'content-type': 'text/html' }); return r.end('<html>introuvable</html>'); }
  if (m === 'referent' && q.headers.referer) { r.writeHead(403, { 'content-type': 'text/plain' }); return r.end('hotlink'); }
  const h = { 'content-type': 'image/png', 'cache-control': 'no-store' };
  if (m === 'corp') h['cross-origin-resource-policy'] = 'same-site';
  r.writeHead(200, h); r.end(PNG_CDN);
});
cdn.on('error', (e) => { console.log('KO  le port ' + PORT_CDN + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });

// ── Projection PostgREST minimale (§6.3) ──
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

// ── Le pont de l'extension : le VRAI dialogue de vmrPhoto, et ses compteurs ──
const PONT = ({ dataUrl, delai }) => {
  window.__pont = { enVol: 0, max: 0, total: 0, parUrl: {} };
  const version = '5.164.0';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: 'vendeur@exemple.test', user_id: 'u1' }, vinted: null, cmds: {} } });
    if (d.__vmr === 'photo') {
      const p = window.__pont;
      p.enVol++; p.total++; p.max = Math.max(p.max, p.enVol); p.parUrl[d.url] = (p.parUrl[d.url] || 0) + 1;
      setTimeout(() => { p.enVol--; post({ __vmr: 'photo:result', reqId: d.reqId, dataUrl }); }, delai);
    }
  });
  post({ __vmr: 'ready', version, id: 'banc' });
};

async function preparer(b, vp, { pont = false, diagKO = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, ignoreHTTPSErrors: true, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = [];
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (pont) await pg.addInitScript(PONT, { dataUrl: PNG_PONT, delai: 700 });
  // Tout le reste d'Internet est coupé (déterminisme) — sauf le faux CDN, qui
  // passe par le VRAI réseau de Chromium (c'est là que CORP s'applique).
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|images1\.vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecrits.push({ url: u, body: req.postData() || '' }); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/id=eq\.diag_photos/.test(u)) return diagKO ? route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' }) : j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ecrits };
}

// Ce que l'écran montre : les photos Vinted (adresse du CDN ou URL objet du
// secours), à l'écran ou pas, affichées ou cassées, et les pictogrammes.
const mesurer = (pg) => pg.evaluate(() => {
  // « À l'écran » = dans la fenêtre ET dans la zone visible du conteneur qui
  // défile (`<main data-defile>` : la barre du bas est hors de lui) — sinon une
  // vignette cachée sous la barre compterait comme visible.
  // Et pareil pour tout ancêtre qui ROGNE (un groupe replié à hauteur nulle).
  const dansEcran = (el) => {
    let r = el.getBoundingClientRect();
    let t = r.top, bo = r.bottom, l = r.left, ri = r.right;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) {
        const ar = a.getBoundingClientRect();
        t = Math.max(t, ar.top); bo = Math.min(bo, ar.bottom); l = Math.max(l, ar.left); ri = Math.min(ri, ar.right);
      }
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      // Un `<details>` FERMÉ garde une boîte à son contenu, mais ne le peint pas.
      if (a.tagName === 'DETAILS' && !a.open && !(el.closest('summary') && a.contains(el.closest('summary')))) return false;
    }
    t = Math.max(t, 0); bo = Math.min(bo, window.innerHeight); l = Math.max(l, 0); ri = Math.min(ri, window.innerWidth);
    return bo - t > 2 && ri - l > 2;
  };
  const imgs = [...document.querySelectorAll('img')].filter((i) => /images1\.vinted\.net|^blob:/.test(i.currentSrc || i.src));
  const out = { total: imgs.length, ecran: 0, affichees: 0, cassees: 0, cassesEcran: 0, secours: 0, picto: 0, pictoEcran: 0, pasAffichees: [] };
  for (const i of imgs) {
    const e = dansEcran(i);
    if (e) out.ecran++;
    if (i.complete && i.naturalWidth > 0 && e) out.affichees++;
    else if (e) {
      const r = i.getBoundingClientRect();
      const ch = []; for (let a = i.parentElement, k = 0; a && k < 6; a = a.parentElement, k++) { const cs = getComputedStyle(a); ch.push(`${a.tagName.toLowerCase()}${a.hasAttribute('data-parti') ? '[parti]' : ''}${a.tagName === 'DETAILS' ? (a.open ? '[open]' : '[ferme]') : ''}:${cs.display}/${cs.overflow}/${Math.round(a.getBoundingClientRect().height)}`); }
      out.pasAffichees.push({ src: (i.src || '').slice(0, 40), complete: i.complete, nw: i.naturalWidth, loading: i.loading, etat: i.getAttribute('data-photo-vinted'), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], chemin: ch.join(' < ') });
    }
    if (i.complete && i.naturalWidth === 0) { out.cassees++; if (e) out.cassesEcran++; }
    if (/^blob:/.test(i.src) && i.naturalWidth > 0) out.secours++;
  }
  for (const s of document.querySelectorAll('[data-photo-vinted="attente"],[data-photo-vinted="perdue"]')) { out.picto++; if (dansEcran(s)) out.pictoEcran++; }
  const ph = [...document.querySelectorAll('[data-photos-bloquees]')];
  out.phrases = ph.length;
  out.sonde = ph[0] ? ph[0].getAttribute('data-photos-bloquees') : null;
  out.geste = ph[0] ? ph[0].getAttribute('data-photos-geste') : null;
  out.texte = ph[0] ? ph[0].innerText : '';
  const t = document.body.innerText;
  out.garde = (/n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(t) || [null])[0];
  out.sw = document.documentElement.scrollWidth; out.cw = document.documentElement.clientWidth;
  return out;
});
const pont = (pg) => pg.evaluate(() => window.__pont ? { ...window.__pont, parUrl: { ...window.__pont.parUrl } } : null);
const ouvrir = async (pg, onglet, ms = 6000) => { await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(ms); };
const section = async (pg, id, ms = 4000) => { await pg.click(`[data-section="${id}"]`, { timeout: 5000 }); await pg.waitForTimeout(ms); };
// Amène la première photo en haut de la zone qui défile (sur téléphone, le
// résumé du haut occupe presque tout l'écran), puis laisse le secours arriver.
const versPhotos = async (pg, ms = 4500) => {
  await pg.evaluate(() => {
    const el = document.querySelector('[data-photo-vinted], img[src*="images1.vinted.net"]');
    const m = document.querySelector('main[data-defile]');
    if (el && m) { const r = el.getBoundingClientRect(), mr = m.getBoundingClientRect(); m.scrollTop += r.top - mr.top - 60; }
  });
  await pg.waitForTimeout(ms);
};
const detail = (m) => JSON.stringify({ ecran: m.ecran, affichees: m.affichees, cassees: m.cassesEcran, picto: m.pictoEcran, secours: m.secours, pasAffichees: m.pasAffichees.slice(0, 3) });
const defiler = (pg, y) => pg.evaluate((y) => { const m = document.querySelector('main[data-defile]'); if (m) m.scrollTop = y === 'bas' ? m.scrollHeight : y; else window.scrollTo(0, y === 'bas' ? document.body.scrollHeight : y); }, y);
const sain = (m, nom) => {
  dit(!m.garde, `${nom} : l'écran n'est pas tombé sur le garde-fou`, m.garde || '');
  dit(m.sw <= m.cw + 1, `${nom} : aucun débordement horizontal`, `${m.sw} > ${m.cw}`);
};
const capture = (pg, nom) => pg.screenshot({ path: path.join(os.tmpdir(), `photos-vinted-${nom}.png`), fullPage: false }).catch(() => {});

(async () => {
  let b;
  await new Promise((ok) => srv.listen(PORT, ok));
  await new Promise((ok) => cdn.listen(PORT_CDN, '127.0.0.1', ok));
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', `--host-resolver-rules=MAP images1.vinted.net 127.0.0.1:${PORT_CDN}`] });

    // ── 0. Le banc mesure-t-il ce qu'il croit mesurer ? ───────────────────────
    await essaie('0', async () => {
      const ctx = await b.newContext({ ignoreHTTPSErrors: true });
      const pg = await ctx.newPage();
      await pg.goto(`http://localhost:${PORT}/__banc-vide`);
      const essai = async (mode) => { cdnEtat.mode = mode; return pg.evaluate((u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth); i.onerror = () => ok(0); i.src = u + '&e=' + Math.random(); }), photoUrl(1)); };
      const avecCorp = await essai('corp'), sans = await essai('ok');
      dit(avecCorp === 0 && sans > 0, 'le faux CDN est un vrai serveur : CORP same-site BLOQUE l’image dans ce Chromium, et sans CORP elle s’affiche', `avec CORP ${avecCorp} px · sans ${sans} px`);
      await ctx.close();
    });

    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const L = vp.width;
      console.log(`\n══ ${L} px`);

      // ── A. CDN qui refuse (CORP) + extension ──────────────────────────────
      console.log('── A. le CDN refuse (CORP), l’extension est là');
      cdnEtat.mode = 'corp';
      await essaie(`A ${L}`, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { pont: true });
        await ouvrir(pg, 'plat_vinted', 6000);                     // Vinted s'ouvre sur les Ventes
        await versPhotos(pg);
        let m = await mesurer(pg);
        await capture(pg, `A-ventes-${L}`);
        dit(m.ecran >= 2 && m.affichees === m.ecran && m.cassesEcran === 0 && m.pictoEcran === 0,
          `A ${L} Ventes : les photos à l'écran s'affichent (par le secours)`, detail(m));
        sain(m, `A ${L} Ventes`);
        await section(pg, 'annonces', 6000);
        await versPhotos(pg);
        m = await mesurer(pg);
        await capture(pg, `A-annonces-${L}`);
        let p = await pont(pg);
        dit(m.ecran >= 2 && m.affichees === m.ecran && m.cassesEcran === 0 && m.pictoEcran === 0,
          `A ${L} Annonces : les photos à l'écran s'affichent (par le secours)`, detail(m));
        dit(!!p && p.total > 0 && p.total < N_ANN, `A ${L} Annonces : seules les photos à l'écran sont demandées à l'extension (pas les ${N_ANN})`, p ? `${p.total} demande(s)` : 'pont muet');
        const avant = p ? p.total : 0;
        // L'écran se redessine (on change de section et on revient) : rien n'est redemandé.
        await section(pg, 'ventes', 2500);
        await section(pg, 'annonces', 4000);
        p = await pont(pg);
        const doublons = p ? Object.values(p.parUrl).filter((n) => n > 1).length : -1;
        dit(!!p && p.total === avant && doublons === 0, `A ${L} : l'écran redessiné ne redemande rien (cache par photo)`, p ? `${avant} → ${p.total} demande(s), ${doublons} photo(s) demandée(s) deux fois` : 'pont muet');
        m = await mesurer(pg);
        dit(m.affichees === m.ecran && m.ecran > 0, `A ${L} : après le retour, les photos sont toujours là`, JSON.stringify({ ecran: m.ecran, affichees: m.affichees }));
        // On fait défiler : les photos suivantes sont demandées, jamais plus de 3 à la fois.
        for (let y = 600; y < 12000; y += 700) { await defiler(pg, y); await pg.waitForTimeout(450); }
        await defiler(pg, 'bas'); await pg.waitForTimeout(4000);
        p = await pont(pg);
        dit(!!p && p.total > avant, `A ${L} : en faisant défiler, les photos suivantes sont demandées`, p ? `${avant} → ${p.total}` : 'pont muet');
        dit(!!p && p.max >= 1 && p.max <= 3, `A ${L} : au plus 3 demandes en vol à la fois`, p ? `max ${p.max}` : 'pont muet');
        m = await mesurer(pg);
        dit(m.cassees === 0, `A ${L} : aucune image cassée nulle part`, `${m.cassees} cassée(s)`);
        dit(m.phrases === 0, `A ${L} : aucune phrase (tout s'affiche)`, `${m.phrases} phrase(s) : ${m.texte.slice(0, 100)}`);
        // Colis (rechargement : nouvelle ouverture de l'app).
        await ouvrir(pg, 'cat_bord', 6000);
        await versPhotos(pg);
        m = await mesurer(pg);
        await capture(pg, `A-colis-${L}`);
        dit(m.ecran >= 1 && m.affichees === m.ecran && m.cassesEcran === 0,
          `A ${L} Colis : les photos des bordereaux s'affichent (par le secours)`, detail(m));
        sain(m, `A ${L} Colis`);
        dit(errs.length === 0, `A ${L} : aucune erreur d'app`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      // ── B. CDN qui refuse, SANS extension ─────────────────────────────────
      console.log('── B. le CDN refuse, AUCUNE extension ici');
      cdnEtat.mode = 'corp';
      await essaie(`B ${L}`, async () => {
        const { ctx, pg, errs, ecrits } = await preparer(b, vp, { pont: false });
        await ouvrir(pg, 'plat_vinted', 3000);
        await section(pg, 'annonces', 9000);                       // > 7 s : l'extension ne s'est pas manifestée
        await capture(pg, `B-haut-${L}`);
        await versPhotos(pg, 2500);
        const m = await mesurer(pg);
        await capture(pg, `B-annonces-${L}`);
        dit(m.cassees === 0, `B ${L} Annonces : aucune image cassée — le pictogramme à la place`, `${m.cassees} cassée(s), ${m.picto} pictogramme(s)`);
        dit(m.pictoEcran >= 2, `B ${L} Annonces : les photos qui ne s'affichent pas gardent leur place (pictogramme)`, `${m.pictoEcran} à l'écran`);
        dit(m.phrases === 1, `B ${L} : la phrase est dite UNE fois`, `${m.phrases} phrase(s)`);
        dit(m.sonde === 'bloquee', `B ${L} : la sonde a mesuré « bloquée par le navigateur »`, String(m.sonde));
        dit(m.geste === (L < 600 ? 'telephone' : 'chrome'), `B ${L} : le geste suit l'appareil (${L < 600 ? 'sur le téléphone : l’ordinateur' : 'le Chrome où l’extension est installée'})`, String(m.geste) + ' · ' + m.texte.slice(0, 140));
        sain(m, `B ${L} Annonces`);
        await section(pg, 'ventes', 3000);
        const mv = await mesurer(pg);
        dit(mv.cassees === 0 && mv.phrases === 1, `B ${L} Ventes : aucune image cassée, et la phrase toujours UNE fois`, `${mv.cassees} cassée(s), ${mv.phrases} phrase(s)`);
        // Le bilan dans SA base : écrit, et sans rien qui désigne une photo.
        await pg.waitForTimeout(2000);
        const diag = ecrits.filter((e) => /diag_photos/.test(e.body));
        dit(diag.length >= 1, `B ${L} : le bilan diag_photos est écrit`, `${diag.length} écriture(s)`);
        if (diag.length) {
          const corps = diag[diag.length - 1].body;
          const fuites = [/vinted\.net\/t\//i, /f800/, /\?s=/, /\.jpeg/i, /Banc /].filter((r) => r.test(corps)).map(String);
          dit(fuites.length === 0, `B ${L} : le bilan ne porte ni adresse, ni signature, ni titre`, fuites.join(' '));
          let d = null; try { d = JSON.parse(corps)[0].data.dernier; } catch (_) {}
          dit(!!d && d.sonde === 'bloquee' && d.hote === 'images1.vinted.net' && d.ext === 'absente' && d.ko > 0 && d.ok === 0 && typeof d.ecran === 'string',
            `B ${L} : le bilan dit ce qui a été mesuré (sonde, hôte, extension, nombres)`, JSON.stringify(d).slice(0, 220));
        }
        dit(errs.length === 0, `B ${L} : aucune erreur d'app`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      // ── C. CDN qui marche ─────────────────────────────────────────────────
      console.log('── C. le CDN marche');
      cdnEtat.mode = 'ok';
      await essaie(`C ${L}`, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { pont: true });
        await ouvrir(pg, 'plat_vinted', 3000);
        await section(pg, 'annonces', 5000);
        await versPhotos(pg, 2500);
        const m = await mesurer(pg); const p = await pont(pg);
        dit(m.ecran >= 2 && m.affichees === m.ecran, `C ${L} : les photos s'affichent directement`, JSON.stringify({ ecran: m.ecran, affichees: m.affichees }));
        dit(!!p && p.total === 0, `C ${L} : aucune demande à l'extension`, p ? `${p.total} demande(s)` : 'pont muet');
        dit(m.phrases === 0, `C ${L} : aucune phrase`, `${m.phrases}`);
        dit(errs.length === 0, `C ${L} : aucune erreur d'app`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      // ── D. CDN qui refuse un référent ─────────────────────────────────────
      console.log('── D. le CDN refuse les requêtes qui portent un référent');
      cdnEtat.mode = 'referent'; cdnEtat.vues = [];
      await essaie(`D ${L}`, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { pont: false });
        await ouvrir(pg, 'plat_vinted', 3000);
        await section(pg, 'annonces', 7000);
        await versPhotos(pg, 3000);
        const m = await mesurer(pg);
        const avecRef = cdnEtat.vues.filter((v) => v.ref).length;
        dit(m.ecran >= 2 && m.affichees === m.ecran && m.cassees === 0, `D ${L} : les photos s'affichent sans secours (aucun référent envoyé)`, JSON.stringify({ ecran: m.ecran, affichees: m.affichees, cassees: m.cassees, demandesAvecReferent: avecRef }));
        dit(m.phrases === 0, `D ${L} : aucune phrase`, `${m.phrases}`);
        dit(errs.length === 0, `D ${L} : aucune erreur d'app`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
    }

    // ── E. Le serveur RÉPOND (une erreur) : une autre phrase que « bloquée » ──
    console.log('\n── E. le CDN répond une erreur (la sonde reçoit une réponse) — 1512 px');
    cdnEtat.mode = 'erreur';
    await essaie('E', async () => {
      const { ctx, pg, errs } = await preparer(b, { width: 1512, height: 950 }, { pont: false });
      await ouvrir(pg, 'plat_vinted', 3000);
      await section(pg, 'annonces', 12000);
      const m = await mesurer(pg);
      dit(m.phrases === 1 && m.sonde === 'reponse', 'E : la sonde a mesuré « le serveur a répondu », et la phrase est dite une fois', `${m.phrases} phrase(s), sonde ${m.sonde}`);
      dit(m.phrases === 1 && !/bloque/i.test(m.texte), 'E : la phrase n’affirme pas un blocage du navigateur qu’on n’a pas mesuré', m.texte.slice(0, 160));
      dit(m.cassees === 0, 'E : aucune image cassée', `${m.cassees}`);
      dit(errs.length === 0, 'E : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });

    // ── F. La lecture de diag_photos rate : rien n'est écrit ─────────────────
    console.log('\n── F. la base ne rend pas diag_photos (522) — 1512 px');
    cdnEtat.mode = 'corp';
    await essaie('F', async () => {
      const { ctx, pg, ecrits } = await preparer(b, { width: 1512, height: 950 }, { pont: false, diagKO: true });
      await ouvrir(pg, 'plat_vinted', 3000);
      await section(pg, 'annonces', 13000);
      const diag = ecrits.filter((e) => /diag_photos/.test(e.body));
      dit(diag.length === 0, 'F : lecture ratée de diag_photos ⇒ aucune écriture (« rien lu » ne vaut pas « rien »)', `${diag.length} écriture(s)`);
      await ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally {
    if (b) await b.close();
    srv.close(); cdn.close();
    try { fs.rmSync(dirCert, { recursive: true, force: true }); } catch (_) {}
  }
  console.log(ko ? `\n❌ photos-vinted : ${ko} rouge(s)` : '\n✅ photos-vinted : tout est vert');
  process.exit(ko ? 1 : 0);
})();
