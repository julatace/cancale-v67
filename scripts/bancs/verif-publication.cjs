// Banc : VÉRIFIER UNE ANNONCE AVANT DE LA PUBLIER (3 nov., choisie par Julien).
//   node scripts/bancs/verif-publication.cjs        (port 4937, BANC_PORT pour changer)
//
// Sur des données INVENTÉES (dépôt public), l'écran Leboncoin de l'app est RENDU
// (dist/, Chromium) à 390 px et 1512 px SOMBRE, avec le pont simulé. Exige :
//   A. un article à défauts (2 photos, ni taille ni marque, catégorie
//      introuvable, 30 € pour un achat de 45 €) : « Publier sur Leboncoin »
//      ouvre la feuille de vérification — une ligne par problème (photos,
//      taille, prix, marque, catégorie), chacune avec son geste — et RIEN n'est
//      envoyé à l'extension ;
//   B. aucun prix conseillé : les seuls montants de la feuille sont le prix de
//      l'annonce et SON prix d'achat ;
//   C. « Corriger » ferme sans rien envoyer ;
//   D. « Publier quand même » envoie `lbcPublier` (une fois, pour CET article) ;
//   E. un article propre (8002) : aucune feuille, l'envoi part directement ;
//   F. aucun débordement, aucune erreur ; captures regardées
//      (<tmp>/verif-publication-*.png).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), zlib = require('zlib'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4937;
const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8');
const EXT_ATTENDUE = (/const EXT_ATTENDUE = '([^']+)'/.exec(APP) || [])[1];
const SEUIL_FICHE = (/lbcfiche: '([^']+)'/.exec(APP) || [])[1] || '9.9.9';
const CODE_DANS_ETAT = (/const CODE_DANS_ETAT = '([0-9.]+)'/.exec(APP) || [])[1] || '5.171.0';
const auMoins = (v, s) => { const a = String(v || '').split('.').map(Number), b = String(s).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); } return true; };
const auj = new Date().toISOString();

// Trois photos captées, aux vraies adresses de Vinted (inventées).
const PH = [1, 2, 3].map((i) => `https://images1.vinted.net/t/0${i}_banc/f800/${i}.jpeg?s=sig${i}`);
// L'article 8001 a TOUS les défauts : 2 photos, ni taille, ni marque, un titre
// qui ne dit pas le type (catégorie Leboncoin introuvable), 30 € pour un prix
// d'achat saisi de 45 €. Le 8002 est propre (le contrôle « rien à dire »).
const MAIN = { vinted_annonce_numeros: {
  '8001': { numero: '27', title: 'Article vintage rare', mp: { lbc: true }, buyPrice: '45' },
  '8002': { numero: '28', title: 'Salomon XT-6 blanc taille 40', mp: { lbc: true }, buyPrice: '40' } } };
const LISTINGS = { capturedAt: auj, payload: { items: [
  { id: 8001, title: 'Article vintage rare', status: 'Très bon état', price: { amount: '30.0', currency_code: 'EUR' }, photo: { url: 'https://images1.vinted.net/t/01_banc/f800/autre1.jpeg?s=b1' }, nPhotos: 2, is_closed: false, is_hidden: false, is_draft: false },
  { id: 8002, title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', size_title: '40', status: 'Très bon état', price: { amount: '99.0', currency_code: 'EUR' }, photo: { url: PH[0] }, nPhotos: 3, is_closed: false, is_hidden: false, is_draft: false },
] } };
const DETAILS = { '8001': { photos: [1, 2].map((i) => `https://images1.vinted.net/t/0${i}_banc/f800/autre${i}.jpeg?s=b${i}`), description: 'Très bel objet, peu servi.' }, '8002': { photos: PH, description: 'Portées deux fois, semelle propre, boîte d’origine.' } };
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
const PH_B = [1, 2].map((i) => `https://images1.vinted.net/t/0${i}_banc/f800/autre${i}.jpeg?s=b${i}`);
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
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, !!vp.sombre);
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

const feuille = (pg) => pg.evaluate(() => {
  const f = document.querySelector('[data-verif-sheet]');
  if (!f) return null;
  return { site: f.getAttribute('data-verif-sheet'), n: Number(f.getAttribute('data-verif-n')),
    codes: [...f.querySelectorAll('[data-verif-probleme]')].map((e) => e.getAttribute('data-verif-probleme')),
    lignes: [...f.querySelectorAll('[data-verif-probleme]')].map((e) => e.innerText.replace(/\s+/g, ' ')),
    texte: f.innerText, publier: !!f.querySelector('[data-verif-publier]'), corriger: !!f.querySelector('[data-verif-corriger]'),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
});
const cmds = (pg) => pg.evaluate(() => (window.__cmds || []).filter((c) => c.cmd === 'lbcPublier'));
const ouvrirFiche = async (pg, num) => {
  await pg.click(`[data-apub="${num}"] [data-bouton-publier] button`);
  await pg.waitForSelector('[data-fiche-lbc]', { timeout: 5000 });
  await pg.waitForTimeout(400);
};

(async () => {
  srv.listen(PORT);
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844, sombre: true }, { width: 1512, height: 950, sombre: true }]) {
      console.log(`── ${vp.width} px · sombre`);
      await essaie(`${vp.width}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, { version: EXT_ATTENDUE, suite: 'fait' });
        // A — l'article à défauts.
        await ouvrirFiche(pg, '27');
        await pg.click('[data-fiche-publier]');
        await pg.waitForSelector('[data-verif-sheet]', { timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(300);
        let f = await feuille(pg);
        const attendu = ['photos', 'taille', 'prix', 'marque', 'categorie'];
        dit(f && f.site === 'lbc' && attendu.every((c) => f.codes.includes(c)) && f.codes.length === attendu.length && f.n === attendu.length, 'A · la feuille dit les 5 problèmes (photos, taille, prix, marque, catégorie), une ligne chacun', JSON.stringify(f && f.codes));
        dit(f && f.lignes.every((l) => l.length > 12) && /2 photos/.test(f.texte) && /Taille absente/.test(f.texte) && /Marque absente/.test(f.texte) && /Catégorie absente/.test(f.texte), 'A · chaque ligne porte le problème ET son geste', JSON.stringify(f && f.lignes));
        dit((await cmds(pg)).length === 0, 'A · rien n’est envoyé à l’extension tant qu’il n’a pas répondu');
        // B — aucun prix conseillé.
        const montants = f ? [...f.texte.matchAll(/(\d+(?:,\d+)?)\s?€/g)].map((m) => m[1]) : [];
        dit(montants.length === 2 && montants.includes('30') && montants.includes('45'), 'B · aucun prix conseillé : seuls le prix (30 €) et SON prix d’achat (45 €) sont écrits', JSON.stringify(montants));
        dit(f && f.sw <= f.cw + 1, 'F · aucun débordement horizontal', f && `${f.sw}/${f.cw}`);
        await pg.screenshot({ path: path.join(os.tmpdir(), `verif-publication-${vp.width}.png`) });
        // C — Corriger.
        await pg.click('[data-verif-corriger]');
        await pg.waitForTimeout(300);
        dit(!(await feuille(pg)) && (await cmds(pg)).length === 0, 'C · « Corriger » ferme la feuille, rien n’est parti');
        // D — Publier quand même.
        await pg.click('[data-fiche-publier]');
        await pg.waitForSelector('[data-verif-sheet]', { timeout: 5000 }).catch(() => {});
        await pg.click('[data-verif-publier]');
        await pg.waitForTimeout(700);
        const c1 = await cmds(pg);
        dit(c1.length === 1 && c1[0].id === '8001', 'D · « Publier quand même » envoie `lbcPublier` une fois, pour CET article', JSON.stringify(c1.map((c) => c.id)));
        // E — l'article propre : aucune feuille.
        await pg.keyboard.press('Escape').catch(() => {});
        await pg.evaluate(() => { const x = [...document.querySelectorAll('[data-fiche-lbc] button')].find((e) => /Fermer|✕/.test(e.innerText || e.getAttribute('aria-label') || '')); if (x) x.click(); });
        await pg.waitForTimeout(400);
        if (await pg.$('[data-fiche-lbc]')) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); }
        await ouvrirFiche(pg, '28');
        await pg.click('[data-fiche-publier]');
        await pg.waitForTimeout(700);
        const c2 = await cmds(pg);
        dit(!(await feuille(pg)) && c2.length === 2 && c2[1].id === '8002', 'E · un article propre : aucune feuille, l’envoi part directement', JSON.stringify(c2.map((c) => c.id)));
        dit(errs.length === 0, 'F · aucune erreur de page', errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', e.message); }
  finally {
    if (b) await b.close();
    srv.close();
    console.log(ko ? `\n❌ verif-publication : ${ko} rouge(s)` : '\n✅ verif-publication : tout est vert');
    process.exitCode = ko ? 1 : 0;
  }
})();
