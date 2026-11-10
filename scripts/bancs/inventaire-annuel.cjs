// Banc : LOT W (10 nov.) — L'INVENTAIRE DE FIN D'ANNÉE (src/InventaireAnnuel.jsx, src/inventaireAnnuel.js)
//
// Rend les VRAIS écrans Annonces puis Stock sur des données INVENTÉES (le dépôt est public),
// en 390 px tactile et 1512 px, clair et sombre, et exige — data-* et nombres rendus :
//   1. Annonces publie `vrm_inventaire_annuel` : les 6 paires présentes (en ligne + masquée),
//      la MÊME valeur que `vrm_valeur_stock` (145,50 €), prix absent/illisible = `null` ;
//   2. Stock → « Inventaire de fin d'année » : « au moins 145,50 € », 6 lignes, N°15 et N°16
//      « — » (jamais 0), au 31/12/2026 et « … pas le 31/12/2026 » (la liste est celle
//      d'aujourd'hui, 10 nov.) ; pas encore vérifié ⇒ rien n'est « pas trouvé » ;
//   3. « Je vérifie mes cartons » ouvre l'inventaire : 11 au clavier ; « Scanner » ouvre la
//      caméra (flux factice, lecteur inventé) : « VRM-13 » est compté (la MÊME saisie que le
//      clavier), un n° de suivi est « Pas un N° » ; 99 au clavier ; on ferme ⇒ la fin
//      d'année revient : 2 trouvées sur 6, 4 pas trouvées (ambre), 99 hors liste ;
//   4. CSV et PDF téléchargés, datés (inventaire-2026-12-31.*) : « au moins », cellule
//      vide pour un prix absent, « trouvée » sur N°11 ; le PDF commence par %PDF ;
//   5. aucune écriture de N°, aucun débordement horizontal, aucune erreur ; cibles ≥ 44 px.
// Lancer : npm run build && BANC_PORT=$((40000+RANDOM%20000)) node scripts/bancs/inventaire-annuel.cjs
// Captures : <tmp>/inventaire-annuel-{390,1512}-{clair,sombre}-{feuille,scan,ecarts}.png
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.env.BANC_DIST ? path.resolve(process.env.BANC_DIST) : path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4398;
const CAP = process.env.BANC_CAPTURES || os.tmpdir();

const maintenant = new Date(2026, 10, 10, 15, 30, 0);
const iso = (h) => new Date(maintenant.getTime() - h * 3600e3).toISOString();
const A = '111';
let nPhoto = 0;
const vente = (id, titre, prix, statut, h, tus) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: iso(h), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` } });
const VENTES = [
  vente(7101, 'Nike Air Max 90 blanche taille 42', 120, 'Commande finalisée', 30, 'completed'),
  vente(7102, 'Adidas Samba OG noir taille 40', 90, 'Commande finalisée', 50, 'completed'),
  vente(7103, 'New Balance 550 blanc vert taille 43', 70, 'Commande finalisée', 70, 'completed'),
  vente(7104, 'Asics Gel-Lyte III gris taille 41', 40, 'Commande finalisée', 90, 'completed'),
];
const OV = {
  '7101': { buyPrice: '60', fees: '2', commission: '3', emballage: '0.80', fraisComplets: true },
  '7102': { buyPrice: '50', fraisComplets: true },
  '7104': { buyPrice: '55', fraisComplets: true },
};
const annonce = (id, titre, prix, cache = false) => ({ id, url: 'https://www.vinted.fr/items/' + id, title: titre, brand: 'Nike', size: '42', price: { amount: prix, currency_code: 'EUR' },
  photo: { url: `https://images1.vinted.net/t/b${id % 4}/f800/${id}.jpeg` }, created_at_ts: Math.floor((maintenant.getTime() - 5 * 86400e3) / 1000), is_closed: false, is_draft: false, is_hidden: cache, favourite_count: 1, view_count: 12 });
const ITEMS = [annonce(901, 'Nike Dunk Low panda 42', '95.0'), annonce(902, 'Nike Air Force 1 blanche 42', '80.0'), annonce(903, 'Nike Air Max 1 rouge 42', '110.0'),
  annonce(904, 'Nike Cortez blanche 42', '60.0'), annonce(905, 'Nike Blazer Mid 42', '70.0'), annonce(906, 'Nike Air Max 97 argent 42', '130.0', true)];
const NUMEROS = {
  '901': { numero: '11', buyPrice: '45' }, '902': { numero: '12', buyPrice: '30,50' }, '903': { numero: '13', buyPrice: '70' },
  '904': { numero: '14', buyPrice: '0' }, '905': { numero: '15' }, '906': { numero: '16', buyPrice: 'beaucoup' },
};
const cap = maintenant.toISOString();
const LIGNES = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${A}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: `harvest_${A}_listings`, data: { uid: A, type: 'listings', nItems: ITEMS.length, capturedAt: cap, payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
];
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'boutique_test', domain: 'www.vinted.fr', updated_at: cap }];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 220)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : (Array.isArray(v) && /^-?\d+$/.test(seg) ? v[Number(seg) < 0 ? v.length + Number(seg) : Number(seg)] : v[seg]);
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf'][k % 4]}"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 280 300 282 L90 282 C70 282 62 268 70 250 Z" fill="rgba(30,34,40,.55)"/></svg>`;

const ouvrir = async (b, tel, sombre, url) => {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, acceptDownloads: true, permissions: ['camera'], ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(({ s, ov, n }) => { try {
    if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1');
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    localStorage.setItem('vinted_sale_overrides', JSON.stringify(ov)); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n));
  } catch (_) {} }, { s: !!sombre, ov: OV, n: NUMEROS });
  // La caméra : le flux factice de Chromium ; le LECTEUR est un BarcodeDetector inventé qui rend,
  // un appel à la fois, les codes posés dans `window.__codes` (un carton « VRM-13 », un bordereau).
  await pg.addInitScript(() => { window.__codes = []; window.BarcodeDetector = class { static async getSupportedFormats() { return ['code_128', 'qr_code']; } async detect() { const c = window.__codes.shift(); return c ? [{ rawValue: c }] : []; } }; });
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/${url}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};
const toucher = async (pg, tel, loc) => { if (tel) await loc.tap(); else await loc.click(); };
const ouvrirVente = async (pg, tx) => {
  const t = pg.locator(`.vrm-sale-row[data-tx="${tx}"] .vrm-ledger-sale-toggle`).first();
  if (await t.getAttribute('aria-expanded') !== 'true') {
    const croix = pg.locator('.vrm-ledger-drawer-host:not([hidden]) .vrm-recap-fermer');
    if (await croix.count()) { await croix.first().click(); await pg.locator('.vrm-ledger-drawer-host:not([hidden])').first().waitFor({ state: 'detached', timeout: 4000 }).catch(() => {}); await pg.waitForTimeout(150); }
  }
  await t.scrollIntoViewIfNeeded();
  if (await t.getAttribute('aria-expanded') !== 'true') await t.click();
  const id = await t.getAttribute('aria-controls');
  await pg.locator(`[id="${id}"]`).waitFor({ state: 'visible', timeout: 8000 });
  await pg.waitForTimeout(400);
  return id;
};
const lireVente = (pg, id) => pg.evaluate((id) => {
  const d = document.getElementById(id); if (!d) return null;
  const at = (sel, a) => { const e = d.querySelector(sel); return e ? e.getAttribute(a) : null; };
  const porte = d.querySelector('[data-cv-emballage-saisir]');
  const pr = porte ? porte.getBoundingClientRect() : null;
  return {
    barre: at('[data-cv-barre]', 'data-cv-barre'), perte: at('[data-cv-barre]', 'data-cv-perte'),
    emb: at('[data-recap-emballage]', 'data-recap-emballage'), embTxt: (d.querySelector('[data-recap-emballage] dd') || {}).innerText || '',
    benef: at('[data-recap-benef-etat]', 'data-benef-vente'), benefEtat: at('[data-recap-benef-etat]', 'data-recap-benef-etat'),
    frais: at('[data-recap-frais]', 'data-recap-frais'), achat: at('[data-recap-achat]', 'data-recap-achat'),
    porte: porte ? { c: getComputedStyle(porte).color, h: Math.round(pr.height), t: porte.innerText } : null,
    saisirAchat: !!d.querySelector('[data-cout-vente-saisir]'),
    deb: d.scrollWidth - d.clientWidth,
  };
}, id);
const AMBRES = ['rgb(178, 80, 0)', 'rgb(255, 179, 64)', 'rgb(255, 159, 10)', 'rgb(201, 52, 0)'];
const ROUGES = ['rgb(215, 0, 21)', 'rgb(255, 59, 48)', 'rgb(255, 69, 58)', 'rgb(255, 105, 97)'];


async function parcours(b, tel, sombre) {
  const T = `${tel ? 390 : 1512} ${sombre ? 'sombre' : 'clair'}`;
  const C = (n) => path.join(CAP, `inventaire-annuel-${tel ? 390 : 1512}-${sombre ? 'sombre' : 'clair'}-${n}.png`);
  const r = await ouvrir(b, tel, sombre, '?tab=cat_annonces');
  const ecrituresNum = [];
  r.pg.on('request', (q) => { if (q.method() !== 'GET' && /vinted_annonce_numeros|vinted_used_numeros/.test(decodeURIComponent(q.postData() || '') + q.url())) ecrituresNum.push(q.url()); });
  const aller = (q) => r.pg.evaluate((q) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: q })), q);
  try {
    await r.pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_inventaire_annuel') || 'null'); } catch (_) { return false; } }, null, { timeout: 30000 }).catch(() => {});
    const pub = await r.pg.evaluate(() => ({ ia: JSON.parse(localStorage.getItem('vrm_inventaire_annuel') || 'null'), vs: JSON.parse(localStorage.getItem('vrm_valeur_stock') || 'null') }));
    const l = pub.ia && pub.ia.l ? pub.ia.l : [];
    dit(pub.ia && pub.vs && pub.ia.v.c === 14550 && pub.vs.c === 14550 && l.length === 6 && l.filter((x) => x[4] == null).map((x) => x[1]).sort().join(',') === '15,16',
      `${T} Annonces publie la liste : 6 paires, la MÊME valeur que « Valeur du stock », N°15 et N°16 sans prix (null)`, JSON.stringify(pub.ia && { v: pub.ia.v, l }));
    await aller('?tab=garage');
    const entree = r.pg.locator('[data-ia-ouvrir]').first();
    await entree.waitFor({ timeout: 20000 });
    const hEntree = await entree.evaluate((e) => Math.round(e.getBoundingClientRect().height));
    dit(hEntree >= 44, `${T} l’entrée « Inventaire de fin d’année » fait ≥ 44 px`, String(hEntree));
    await entree.scrollIntoViewIfNeeded();
    await toucher(r.pg, tel, entree);
    await r.pg.waitForSelector('[data-inventaire-annuel] [data-ia-valeur]', { timeout: 10000 });
    await r.pg.waitForTimeout(500);
    const f = await r.pg.evaluate(() => {
      const d = document.querySelector('[data-inventaire-annuel]'); const v = d.querySelector('[data-ia-valeur]'); const p = d.querySelector('[data-ia-saisir]');
      const lignes = [...d.querySelectorAll('[data-ia-ligne]')].map((e) => ({ id: e.getAttribute('data-ia-ligne'), prix: e.getAttribute('data-ia-ligne-prix'), t: e.querySelector('.vrm-ia-l-prix').textContent }));
      return { v: v.getAttribute('data-ia-valeur'), auMoins: v.getAttribute('data-ia-au-moins'), t: v.innerText.replace(/\s+/g, ' '), date: d.querySelector('[data-ia-date]').value, lue: d.querySelector('[data-ia-lue]').textContent,
        verif: d.querySelector('[data-ia-verif]').getAttribute('data-ia-verif'), lignes, porte: p ? { c: getComputedStyle(p).color, h: Math.round(p.getBoundingClientRect().height) } : null,
        exports: [...d.querySelectorAll('[data-ia-export]')].map((e) => Math.round(e.getBoundingClientRect().height)) };
    });
    dit(f.v === '14550' && f.auMoins === '1' && /au moins 145,50\s€/.test(f.t) && /sur 6 paires/.test(f.t) && /2 sans prix/.test(f.t), `${T} la feuille : « au moins 145,50 € · sur 6 paires · 2 sans prix »`, JSON.stringify(f));
    dit(f.lignes.length === 6 && f.lignes.filter((x) => x.prix === 'sans').length === 2 && f.lignes.filter((x) => x.prix === 'sans').every((x) => x.t === '—'), `${T} 6 lignes ; un prix absent ou illisible s’écrit « — » (jamais 0)`, JSON.stringify(f.lignes));
    dit(f.date === '2026-12-31' && /pas le 31\/12\/2026/.test(f.lue), `${T} au 31/12/2026 par défaut, et la liste dit qu’elle est d’aujourd’hui`, f.lue);
    dit(f.verif === 'non', `${T} pas encore vérifié ⇒ rien n’est dit « pas trouvé »`);
    dit(f.porte && AMBRES.includes(f.porte.c) && f.porte.h >= 44 && f.exports.length === 2 && f.exports.every((h) => h >= 44), `${T} « 2 sans prix » porte ambre, exports ≥ 44 px`, JSON.stringify(f.porte) + ' ' + f.exports);
    await r.pg.screenshot({ path: C('feuille') });

    // ── la vérification dans les cartons
    await toucher(r.pg, tel, r.pg.locator('[data-ia-verifier]').first());
    await r.pg.waitForSelector('[data-inventaire] [data-inv-commencer]:not([disabled])', { timeout: 15000 });
    await toucher(r.pg, tel, r.pg.locator('[data-inv-commencer]').first());
    const champ = r.pg.locator('[data-inv-champ]').first(); await champ.waitFor({ timeout: 8000 });
    const tape = async (n) => { await champ.fill(n); await toucher(r.pg, tel, r.pg.locator('[data-inv-valider]').first()); await r.pg.waitForTimeout(250); };
    await tape('11');
    await toucher(r.pg, tel, r.pg.locator('[data-inv-scanner]').first());
    const cam = await r.pg.waitForSelector('[data-inv-scan="active"]', { timeout: 15000 }).then(() => true).catch(() => false);
    dit(cam, `${T} « Scanner » ouvre la caméra (lecteur du lot V)`);
    await r.pg.evaluate(() => { window.__codes.push('VRM-13'); });
    const v13 = await r.pg.waitForSelector('[data-inv-ligne="13"]', { timeout: 8000 }).then(() => true).catch(() => false);
    dit(v13, `${T} un carton « VRM-13 » scanné est compté comme N°13 (la même saisie que le clavier)`);
    await r.pg.evaluate(() => { window.__codes.push('XK123456789FR'); });
    const ill = await r.pg.waitForSelector('[data-inv-retour="illisible"]', { timeout: 8000 }).then(() => true).catch(() => false);
    const nVus = await r.pg.evaluate(() => { const e = document.querySelector('[data-inv-vue="saisie"]'); return e && e.getAttribute('data-inv-n'); });
    dit(ill && nVus === '2', `${T} un n° de suivi scanné : « Pas un N° », rien compté`, nVus);
    await r.pg.screenshot({ path: C('scan') });
    await toucher(r.pg, tel, r.pg.locator('[data-inv-scanner]').first());
    await tape('99');
    await toucher(r.pg, tel, r.pg.locator('[data-inventaire] [data-feuille-croix]').first());
    await r.pg.waitForSelector('[data-inventaire-annuel] [data-ia-verif="oui"]', { timeout: 15000 }).catch(() => {});
    await r.pg.waitForTimeout(500);
    const e = await r.pg.evaluate(() => {
      const d = document.querySelector('[data-inventaire-annuel]'); if (!d) return null;
      const n = (id) => { const s = d.querySelector(`[data-ia-ecart="${id}"]`); return s ? { n: s.getAttribute('data-ia-ecart-n'), c: getComputedStyle(s.querySelector('h4 b')).color, l: [...s.querySelectorAll('[data-ia-ecart-ligne]')].map((x) => x.getAttribute('data-ia-ecart-ligne')) } : null; };
      const m = d.querySelector('[data-ia-trouvees]');
      return { verif: d.querySelector('[data-ia-verif]').getAttribute('data-ia-verif'), trouvees: m && m.getAttribute('data-ia-trouvees'), cochables: m && m.getAttribute('data-ia-cochables'),
        pas: n('pas-trouvees'), hors: n('hors-liste'), dbl: n('doublons'),
        coches: [...d.querySelectorAll('[data-ia-ligne-trouvee="1"]')].map((x) => x.getAttribute('data-ia-ligne')).sort().join(',') };
    });
    dit(e && e.verif === 'oui' && e.trouvees === '2' && e.cochables === '6' && e.coches === '901,903', `${T} de retour : 2 trouvées sur 6 (N°11, N°13), cochées par leur N°`, JSON.stringify(e));
    dit(e && e.pas && e.pas.n === '4' && e.pas.l.sort().join(',') === '12,14,15,16' && AMBRES.includes(e.pas.c) && !ROUGES.includes(e.pas.c), `${T} 4 pas trouvées, compte en ambre (jamais rouge)`, JSON.stringify(e && e.pas));
    dit(e && e.hors && e.hors.n === '1' && e.hors.l.join(',') === '99' && !e.dbl, `${T} N°99 trouvé hors liste ; aucun doublon inventé`, JSON.stringify(e && e.hors));
    await r.pg.locator('[data-ia-ecart="pas-trouvees"]').first().scrollIntoViewIfNeeded().catch(() => {});
    await r.pg.screenshot({ path: C('ecarts') });

    // ── les exports
    const telecharge = async (q) => { const [dl] = await Promise.all([r.pg.waitForEvent('download', { timeout: 15000 }), toucher(r.pg, tel, r.pg.locator(`[data-ia-export="${q}"]`).first())]); const p = await dl.path(); return { nom: dl.suggestedFilename(), o: fs.readFileSync(p) }; };
    await essaie(`${T} exports`, async () => {
      const csv = await telecharge('csv'); const t = csv.o.toString('utf8');
      const l11 = t.split('\r\n').find((x) => x.startsWith('11;')) || ''; const l15 = t.split('\r\n').find((x) => x.startsWith('15;')) || '';
      dit(csv.nom === 'inventaire-2026-12-31.csv' && /au moins 145,50 €/.test(t) && l11.split(';')[3] === '45,00' && l11.split(';')[4] === 'trouvée' && l15.split(';')[3] === '' && /\r\n99;;;;hors liste/.test(t),
        `${T} CSV daté : « au moins », N°11 45,00 trouvée, N°15 sans prix = vide, 99 hors liste`, csv.nom + ' | ' + l11 + ' | ' + l15);
      const pdf = await telecharge('pdf');
      dit(pdf.nom === 'inventaire-2026-12-31.pdf' && pdf.o.slice(0, 5).toString() === '%PDF-' && pdf.o.length > 1500, `${T} PDF daté téléchargé`, pdf.nom + ' ' + pdf.o.length);
    });

    dit(ecrituresNum.length === 0, `${T} aucune écriture de N° ni de pool`, ecrituresNum.join(' | '));
    dit(await r.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${T} aucun débordement horizontal`);
    dit(r.errs.length === 0, `${T} aucune erreur`, r.errs.join(' | '));
  } finally { await r.ctx.close(); }
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    for (const [tel, sombre] of [[true, false], [true, true], [false, false], [false, true]]) {
      console.log(`── ${tel ? '390 px tactile' : '1512 px'}, ${sombre ? 'sombre' : 'clair'}`);
      await essaie(`${tel ? 390 : 1512} ${sombre ? 'sombre' : 'clair'} parcours`, () => parcours(b, tel, sombre));
    }
  } catch (e) {
    dit(false, 'le banc a tourné jusqu’au bout', e.message);
  } finally {
    if (b) await b.close(); srv.close();
  }
  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
