// ⚠️⚠️ BANC — LA PAGE « TAMPONS DES BORDEREAUX » REFAITE (17 nov., lot tampon-qr)
//
// Julien, 17 nov. (capture de Paramètres → Imprimante) : « ce ne sont pas les vrais bordereaux des transporteurs,
// améliore le visuel de cette page et ne donne pas la possibilité d'enlever créé par vrm ».
//
//  R. LA RÈGLE (src/impression/tampons.js, pur) : un réglage RANGÉ « sans mention » (pour tous, pour un type, l'ancien
//     mode « rien »), une place ou une taille de mention rangées ⇒ relus « mention : oui », au-dessus du code, taille M.
//  S. LE CODE (sources) : aucune case / taille / place de mention dans la page ; la mention VERROUILLÉE dans la scène
//     (jamais glissée) ; l'impression la pose toujours (`veutMention = true`) ; l'aperçu de chaque tuile ET de la
//     feuille passe par `rendreBordereau` ⇒ `poserBordereau` (LA fonction de l'impression), rien d'autre ne place.
//  A. L'APP CONSTRUITE (dist/), 390 tactile et 1512 souris, données INVENTÉES (dépôt public) :
//     A1 avec un réglage rangé « sans mention » partout : chaque tuile dessinée porte la mention (data-m) ;
//     A2 aucun contrôle de la page ne touche la mention ; dans la feuille elle est verrouillée (glissée ⇒ immobile,
//        rien d'écrit dans `vrm_tampons`) ;
//     A3 un bordereau Mondial Relay reçu (ligne `email_bord_*` inventée) ⇒ la tuile Mondial Relay montre CE bordereau
//        (data-source="reel"), sans « Exemple » ; les autres types, sans bordereau, montrent l'exemple marqué « Exemple » ;
//     A4 2 colonnes à 390, 4 à 1512 ; aucun nom tronqué ; le choix A4 · 4 par page · Thermique visible (rien dessus) ;
//     A5 rien ne déborde, aucune erreur d'app. Captures (SHOTS=dossier), regardées.
// `BANC_MUTATION=mentionOff|caseMention|apercuAutre|mentionLibre|appMention` (R et S) ⇒ rouge (§6.1).
// Lancer : construire dist/, puis node scripts/bancs/tampons-page.cjs   (TP_VUES=1512,390 ; TP_SOMBRE=1 ; TP_SEUL=R,S,A)
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
const PDFJS = path.join(NM, 'pdfjs-dist');
const DIST = path.join(RACINE, 'dist');
const MUT = process.env.BANC_MUTATION || '';
const SEUL = process.env.TP_SEUL || 'R,S,A';
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.TP_VUES ? process.env.TP_VUES.split(',') : ['1512', '390'];
const PORT = Number(process.env.BANC_PORT || (20000 + Math.floor(Math.random() * 20000)));
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const muter = (s, a, b) => { if (!s.includes(a)) { dit(false, `mutation « ${MUT} » applicable`, 'motif absent'); return s; } return s.split(a).join(b); };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

// ── R. LA RÈGLE ──────────────────────────────────────────────────────────────
async function regle() {
  console.log('\n── R. la règle (tampons.js)');
  let src = lire('src/impression/tampons.js');
  if (MUT === 'mentionOff') { src = muter(src, ' r.mention = true; return r; };', ' return r; };'); src = muter(src, "  const contenu = { ...(ex.contenu ? ex.contenu : (thermique ? r.th : r.a4)), mention: true };", '  const contenu = { ...(ex.contenu ? ex.contenu : (thermique ? r.th : r.a4)) };'); }
  const T = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  const range = { v: 1, a4: { num: true, titre: false, taille: false, mention: false }, th: { num: false, titre: false, taille: false, mention: false },
    texteMention: 'S', placeMention: 'bas', types: { mondialrelay: { contenu: { num: true, titre: true, taille: false, mention: false }, placeMention: 'hg', texteMention: 'L' } },
    formes: { 'mondialrelay·A4·portrait': { n: { vx: 0.1, vy: 0.1, vw: 0.2, v: 0 }, m: { vx: 0.5, vy: 0.9, vw: 0.1 } } } };
  const r = T.reglageTampons(range);
  for (const [fam, th] of [['autre', false], ['autre', true], ['mondialrelay', false], ['mondialrelay', true]]) {
    const x = T.resoudreTampon(r, { famille: fam, thermique: th });
    dit(x.contenu.mention === true && x.placeMention === 'qr' && x.kMention === 1, `R. réglage rangé « sans mention » (${fam}, ${th ? 'thermique' : 'A4'}) ⇒ mention oui, au-dessus du code, taille M`, JSON.stringify({ m: x.contenu.mention, p: x.placeMention, k: x.kMention }));
  }
  dit(T.placesDeForme(r, 'mondialrelay·A4·portrait').m === null && !!T.placesDeForme(r, 'mondialrelay·A4·portrait').n, 'R. une place de mention rangée « à la main » est ignorée (celle du N° gardée)');
  dit(T.contenuDuMode('rien').mention === true, 'R. l’ancien mode « rien » garde la mention');
  const x2 = T.avecChoix(r, 'tous', { contenu: { mention: false } }, { support: 'a4' });
  dit(T.resoudreTampon(x2, { famille: 'autre' }).contenu.mention === true, 'R. écrire « mention : non » ne l’enlève pas');
  const x3 = T.avecPlace(r, 'colissimo·A4·portrait', 'm', { vx: 0.2, vy: 0.2, vw: 0.1 });
  dit(T.placesDeForme(x3, 'colissimo·A4·portrait').m === null, 'R. poser la mention à la main ne s’enregistre pas');
}

// ── S. LE CODE ───────────────────────────────────────────────────────────────
function code() {
  console.log('\n── S. le code (sources)');
  let page = lire('src/parametres/TamponsBordereaux.jsx'), scene = lire('src/impression/SceneTampons.jsx');
  let app = require('../_source-app.cjs').sourceApp ? require('../_source-app.cjs').sourceApp() : lire('src/App.jsx');
  if (MUT === 'caseMention') page = muter(page, "{['num', 'titre', 'taille'].map((k) => (", "{['num', 'titre', 'taille', 'mention'].map((k) => (");
  if (MUT === 'apercuAutre') page = muter(page, '  const r = await poserBordereau(PL, out, src, {', '  const r = await placerAutrement(PL, out, src, {');
  if (MUT === 'mentionLibre') scene = muter(scene, "if (!quoi || quoi === 'm' || !ref.current.boites[quoi]) {", 'if (!quoi || !ref.current.boites[quoi]) {');
  if (MUT === 'appMention') app = muter(app, 'const T = tampon || {}, veutMention = true;', 'const T = tampon || {}, veutMention = T.mention !== false;');
  const p = sansCommentaires(page), sc = sansCommentaires(scene), a = sansCommentaires(app);
  dit(!/['"]mention['"]\s*\]\s*\.map/.test(p) && !/data-tampons-place-mention|data-tampons-texte-mention|texteMention:\s*v|placeMention:\s*e\.target/.test(p), 'S. aucune case, taille ou place de « Créé par vrm.center » dans la page');
  // L'aperçu : tuiles et feuille appellent `rendreBordereau`, qui passe par `poserBordereau` (l'impression) ; rien d'autre ne place.
  const corps = (nom) => { const i = p.indexOf(`async function ${nom}(`); if (i < 0) return ''; let d = 0, j = p.indexOf('{', i); for (let k = j; k < p.length; k++) { if (p[k] === '{') d++; else if (p[k] === '}' && !--d) return p.slice(i, k + 1); } return ''; };
  const rb = corps('rendreBordereau');
  dit(/await poserBordereau\(PL, out, src,/.test(rb), 'S. l’aperçu passe par `poserBordereau` (la fonction de l’impression)');
  dit((p.match(/rendreBordereau\(fam, support, tampons\)/g) || []).length >= 2 && !/placerMention|chercherPlaceTampon|tamponnerBordereau/.test(p), 'S. la tuile ET la feuille rendent par `rendreBordereau`, aucune autre règle de place');
  dit(/quoi === 'm' \|\| !ref\.current\.boites\[quoi\]/.test(sc) && /data-verrou="1"/.test(sc), 'S. la mention est verrouillée dans la scène (jamais glissée)');
  dit(/veutMention = true;/.test(a) && !/veutMention = T\.mention/.test(a), 'S. l’impression pose toujours la mention (`veutMention = true`)');
  dit(/k: 1, place: 'qr', libre: null, codes: zi\.codes/.test(a), 'S. l’impression ignore taille, place et place à la main de la mention');
}

// ── A. L'APP ─────────────────────────────────────────────────────────────────
const MAINTENANT = Date.now(), H = 3600000, ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
async function lignes(avecReel) {
  const rows = [{ id: 'main', data: { vinted_used_numeros: [], vinted_annonce_numeros: {} } }];
  if (!avecReel) return rows;
  const PL = require(path.join(NM, 'pdf-lib')), qr = require(path.join(NM, 'qrcode-generator'));
  const { fabriquerBordereau } = await import(pathToFileURL(path.join(RACINE, 'src', 'impression', 'bordereauExemple.js')).href);
  // Un « vrai » bordereau INVENTÉ : la forme Mondial Relay, marqué d'un texte que l'exemple n'a pas (« ETIQUETTE RECUE »).
  const d = await PL.PDFDocument.load(await fabriquerBordereau(PL, qr, 'a4-notice', { transporteur: 'Mondial Relay', service: 'Point Relais · 24R', suivi: '98765432109876' }));
  const f = await d.embedFont(PL.StandardFonts.Helvetica); d.getPages()[0].drawText('ETIQUETTE RECUE', { x: 40, y: 800, size: 12, font: f });
  rows.push({ id: 'email_bord_77001', data: { transaction: '77001', uid: '111', filename: 'bordereau-77001.pdf', transporteur: 'Mondial Relay', transporteurPdf: 'mondialrelay', receivedAt: ilYaH(3), pdfB64: Buffer.from(await d.save()).toString('base64'), suivi: '98765432109876' } });
  return rows;
}
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^(data|meta)(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = f.startsWith('/__pdfjs/') ? path.join(PDFJS, 'build', path.basename(f)) : path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const RANGE_SANS = { v: 1, a4: { num: true, titre: true, taille: false, mention: false }, th: { num: true, titre: false, taille: false, mention: false }, texte: 'M', texteMention: 'S', place: 'auto', placeMention: 'bas', types: {}, formes: {} };
async function ouvrir(b, { tactile, LIGNES }) {
  const vue = tactile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: IPHONE } : { viewport: { width: 1512, height: 950 } };
  const ctx = await b.newContext({ ...vue, locale: 'fr-FR', colorScheme: process.env.TP_SOMBRE ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ t, sombre }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', 'true');
      if (sombre) { localStorage.setItem('vrm_apparence', JSON.stringify('sombre')); localStorage.setItem('vinted_dark', 'true'); }
      if (!sessionStorage.getItem('banc_init')) { sessionStorage.setItem('banc_init', '1'); localStorage.setItem('vrm_imprimante', JSON.stringify('normale')); localStorage.setItem('vrm_tampons', JSON.stringify(t)); }
    } catch (_) {}
  }, { t: RANGE_SANS, sombre: !!process.env.TP_SOMBRE });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**://cdn.jsdelivr.net/npm/pdfjs-dist@*/**', (r) => {
    const n = path.basename(new URL(r.request().url()).pathname), f = path.join(PDFJS, 'build', n.replace(/\.js$/, '.mjs'));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) });
  });
  await pg.addInitScript((port) => { import(`http://localhost:${port}/__pdfjs/pdf.min.mjs`).then((m) => { m.GlobalWorkerOptions.workerSrc = `http://localhost:${port}/__pdfjs/pdf.worker.min.mjs`; window.pdfjsLib = m; }).catch(() => {}); }, PORT);
  const { metaVersData } = require('./_meta.cjs');
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u); if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u); if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await pg.goto(`http://localhost:${PORT}/?tab=settings&reglage=imprimante`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, tactile };
}
const attendre = (pg, f, arg, ms = 30000) => pg.waitForFunction(f, arg, { timeout: ms }).then(() => true).catch(() => false);
const IDS = ['mondialrelay', 'relaiscolis', 'chronopost', 'colissimo', 'vintedgo', 'ups', 'dpd', 'international', 'leboncoin', 'vestiaire', 'retour'];
async function vueApp(b, vue, avecReel) {
  const tactile = vue === '390', nom = `${vue}${tactile ? ' tactile' : ''}${avecReel ? '' : ' · sans bordereau reçu'}`;
  const o = await ouvrir(b, { tactile, LIGNES: await lignes(avecReel) }), { pg } = o;
  const shot = async (n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `tampons-page-${vue}${process.env.TP_SOMBRE ? '-sombre' : ''}-${n}.png`), timeout: 60000 }).catch(() => {}); } };
  try {
    await pg.waitForSelector('[data-tampons-galerie]', { timeout: 90000 });
    await pg.locator('[data-tampons-reglage]').scrollIntoViewIfNeeded();
    for (const id of IDS) { await pg.locator(`[data-tampons-vignette="${id}"]`).scrollIntoViewIfNeeded().catch(() => {}); await attendre(pg, (i) => { const e = document.querySelector(`[data-tampons-vignette="${i}"]`); return e && e.getAttribute('data-etat') !== 'charge'; }, id, 60000); }
    const t = await pg.evaluate(() => [...document.querySelectorAll('[data-tampons-vignette]:not([data-tampons-vignette="ebay"])')].map((e) => ({ id: e.getAttribute('data-tampons-vignette'), etat: e.getAttribute('data-etat'), m: e.getAttribute('data-m'), src: e.getAttribute('data-source'), ex: !!e.querySelector('[data-tampons-exemple]'), x: Math.round(e.getBoundingClientRect().x), y: Math.round(e.getBoundingClientRect().y),
      coupe: [...e.querySelectorAll('.vrm-tampons-vignette-nom,.vrm-tampons-vignette-statut')].some((n) => n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1) })));
    const dessinees = t.filter((x) => x.etat === 'ok');
    dit(dessinees.length === IDS.length, `${nom} : chaque type dessiné`, t.map((x) => `${x.id}:${x.etat}`).join(' '));
    dit(dessinees.every((x) => x.m), `${nom} : A1 réglage rangé « sans mention » ⇒ « Créé par vrm.center » sur CHAQUE tuile`, dessinees.filter((x) => !x.m).map((x) => x.id).join(',') || 'toutes');
    if (avecReel) {
      const mr = t.find((x) => x.id === 'mondialrelay');
      dit(mr && mr.src === 'reel' && !mr.ex, `${nom} : A3 Mondial Relay montre SON bordereau reçu, sans « Exemple »`, JSON.stringify(mr && { src: mr.src, ex: mr.ex }));
    }
    const autres = t.filter((x) => !(avecReel && x.id === 'mondialrelay'));
    dit(autres.every((x) => x.src === 'exemple' && x.ex), `${nom} : A3 sans bordereau reçu ⇒ l’exemple, marqué « Exemple »`, autres.filter((x) => !(x.src === 'exemple' && x.ex)).map((x) => x.id).join(',') || 'tous');
    const ligne1 = t.filter((x) => Math.abs(x.y - t[0].y) < 4).length;
    dit(ligne1 === (tactile ? 2 : 4), `${nom} : A4 ${tactile ? 2 : 4} tuiles par rangée`, `${ligne1}`);
    dit(t.every((x) => !x.coupe), `${nom} : A4 aucun nom ni état tronqué`, t.filter((x) => x.coupe).map((x) => x.id).join(','));
    dit(await pg.evaluate(() => !document.querySelector('[data-tampons-reglage] [data-tampons-contenu="mention"],[data-tampons-reglage] [data-tampons-place-mention],[data-tampons-reglage] [data-tampons-texte-mention]')), `${nom} : A2 aucun contrôle de la page n’enlève ni ne déplace la mention`);
    await pg.locator('[data-tampons-reglage]').evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await pg.waitForTimeout(300);
    const fmt = await pg.evaluate(() => { const s = document.querySelector('.vrm-tampons-formats'); const r = s.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { dessus: !!el && s.contains(el), y: Math.round(r.y), h: Math.round(r.height) }; });
    dit(fmt.dessus, `${nom} : A4 le choix A4 · 4 par page · Thermique se voit (rien dessus)`, JSON.stringify(fmt));
    await shot(`haut${avecReel ? '' : '-sans'}`);
    await pg.locator('[data-tampons-galerie]').scrollIntoViewIfNeeded(); await shot(`galerie${avecReel ? '' : '-sans'}`);
    if (avecReel) {
      const tap = async (sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (tactile) await l.tap(); else await l.click(); };
      await tap('[data-tampons-vignette="mondialrelay"]');
      dit(await attendre(pg, () => !!document.querySelector('[data-tampons-editeur] [data-tampons-scene][data-pret="1"] [data-tampon-el="m"]'), null, 60000), `${nom} : la feuille s’ouvre, la mention montrée`);
      const m0 = await pg.evaluate(() => { const e = document.querySelector('[data-tampons-editeur] [data-tampon-el="m"]'); return e ? { v: e.getAttribute('data-verrou'), x: e.getAttribute('data-x'), y: e.getAttribute('data-y') } : null; });
      await shot('feuille');
      const l = pg.locator('[data-tampons-editeur] [data-tampon-el="m"]'); const bb = await l.boundingBox();
      if (bb) { const x0 = bb.x + bb.width / 2, y0 = bb.y + bb.height / 2; await pg.mouse.move(x0, y0); await pg.mouse.down(); for (let i = 1; i <= 8; i++) await pg.mouse.move(x0 - 6 * i, y0 - 8 * i); await pg.mouse.up(); }
      await pg.waitForTimeout(600);
      const m1 = await pg.evaluate(() => { const e = document.querySelector('[data-tampons-editeur] [data-tampon-el="m"]'); let t = null; try { t = JSON.parse(localStorage.getItem('vrm_tampons') || 'null'); } catch (_) {} return { x: e && e.getAttribute('data-x'), y: e && e.getAttribute('data-y'), formesM: !!(t && t.formes && Object.values(t.formes).some((f) => f && f.m)) }; });
      dit(m0 && m0.v === '1' && m1.x === m0.x && m1.y === m0.y && !m1.formesM, `${nom} : A2 la mention est verrouillée (glissée ⇒ immobile, rien d’enregistré)`, JSON.stringify({ m0, m1 }));
      await pg.locator('[data-tampons-editeur] [data-tampons-fini]').click();
    }
    dit((await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, `${nom} : A5 rien ne déborde`);
    dit(o.errs.length === 0, `${nom} : A5 aucune erreur d’app`, o.errs.join(' | ').slice(0, 300));
  } catch (e) { dit(false, `${nom} : la page s’exécute`, String(e.message).slice(0, 300)); await shot('erreur'); }
  await o.ctx.close();
}

(async () => {
  if (SEUL.includes('R')) await regle();
  if (SEUL.includes('S')) code();
  if (SEUL.includes('A') && !MUT) {
    console.log('\n── A. l’app construite');
    const { lancer } = require('./_navigateur.cjs'); const PW = require(path.join(NM, 'playwright'));
    await new Promise((r) => srv.listen(PORT, r));
    const b = await lancer(PW, { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    try { for (const v of VUES) { await vueApp(b, v, true); await vueApp(b, v, false); } } catch (e) { dit(false, 'le banc tourne', String(e.stack || e).slice(0, 300)); }
    await b.close().catch(() => {}); srv.close();
  }
  console.log(`\n${ko ? '❌' : '✅'} tampons-page : ${ok} verts, ${ko} rouges${MUT ? ` (mutation ${MUT})` : ''}`);
  process.exit(ko ? 1 : 0);
})();
