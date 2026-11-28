// Banc : UNE VENTE EXPÉDIÉE NE RESTE PAS « À ENVOYER » SANS L'EXTENSION (28 nov.)
// Julien : « une paire vendue et déjà expédiée, VRM me proposait encore d'imprimer le bordereau ».
// Données INVENTÉES (dépôt public), formes réelles : la liste des ventes du compte lue il y a 40 h (figée,
// extension absente), trois ventes AU MÊME TITRE « à expédier » chez Vinted, leurs bordereaux e-mail
// (`email_bord_{tx}`, PDF + n°), et l'e-mail Vinted « Votre objet a été expédié » rangé par la route pour
// la 1re (`email_track_vinted_tx{tx}` : `transaction`, sens sortant, aucun n° de suivi).
// Le banc exige :
//  A. la vente dont le n° de TRANSACTION est prouvé parti n'est plus « à envoyer » ; les deux jumelles y restent ;
//  B. elle est dans « En route » (jamais cachée) ;
//  C. les deux qui restent disent « À confirmer » (liste de plus de 24 h) ;
//  D. aucune erreur, rien ne déborde ; captures 390 tactile + 1512, clair et sombre (SHOTS=dossier).
// Lancer : construire dist/, puis node scripts/bancs/expedie-sans-extension.cjs   (BANC_PORT, BANC_DIST)
const path = require('path');
const PW_NAV = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { lancer } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const NM = path.join(__dirname, '..', '..', 'node_modules');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4683);
const SHOTS = process.env.SHOTS || '';
const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const TITRE = 'Nike Dunk Low Panda taille 42';
const V = [{ tx: 9301, suivi: 'XW300000001TS', num: '31' }, { tx: 9302, suivi: 'XW300000002TS', num: '32' }, { tx: 9303, suivi: 'XW300000003TS', num: '33' }];

async function pdfInvente(code) {
  const { PDFDocument, StandardFonts } = require(path.join(NM, 'pdf-lib'));
  const d = await PDFDocument.create(); const p = d.addPage([288, 432]); const f = await d.embedFont(StandardFonts.Helvetica);
  p.drawText('ETIQUETTE ' + code, { x: 20, y: 400, size: 12, font: f });
  return Buffer.from(await d.save()).toString('base64');
}
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};

async function scenario(b, nom, vue, LIGNES, sombre) {
  const ctx = await b.newContext({ ...vue, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const mainData = LIGNES.find((r) => r.id === 'main').data;
  await pg.addInitScript(([m, sb]) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', 'true');
      if (sb) localStorage.setItem('vinted_dark', 'true'); else localStorage.setItem('vinted_dark', 'false');
      if (!sessionStorage.getItem('banc_init')) { sessionStorage.setItem('banc_init', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(m.vinted_annonce_numeros)); localStorage.setItem('vinted_used_numeros', JSON.stringify(m.vinted_used_numeros)); }
    } catch (_) {}
  }, [mainData, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z]+)=(not\.)?is\.null/g)].map((m) => ({ k: m[1], non: !!m[2] }));
    const passe = (r) => filtres.every((f) => (f.non ? r.data[f.k] != null : r.data[f.k] == null));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await srvPret;
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  const vu = await pg.waitForFunction(() => {
    const r = [...document.querySelectorAll('[data-vn-rang], [data-bord-card][data-tx-colis]')].map((e) => (e.getAttribute('data-vn-rang') || 'v:' + e.getAttribute('data-tx-colis')));
    return r.includes('v:9302') && r.includes('v:9303') && !r.includes('v:9301');
  }, null, { timeout: 25000 }).then(() => true).catch(() => false);
  await pg.waitForTimeout(600);
  const rangs = await pg.evaluate(() => [...document.querySelectorAll('[data-vn-rang], [data-bord-card][data-tx-colis]')].map((e) => ({ cle: e.getAttribute('data-vn-rang') || 'v:' + e.getAttribute('data-tx-colis'), conf: e.getAttribute('data-vn-a-confirmer') || (e.querySelector('[data-colis-a-confirmer]') ? '1' : '') })));
  dit(vu, `${nom} : A la vente prouvée partie (n° de transaction de l'e-mail) n'est plus « à envoyer », ses deux jumelles y restent`, JSON.stringify(rangs));
  const conf = rangs.filter((x) => x.cle === 'v:9302' || x.cle === 'v:9303');
  dit(conf.length >= 2 && conf.every((x) => x.conf === '1'), `${nom} : C les deux qui restent disent « À confirmer » (liste des ventes de plus de 24 h)`, JSON.stringify(conf));
  const txt = await pg.evaluate(() => document.body.innerText);
  dit(/À confirmer/.test(txt), `${nom} : C le mot est écrit (« À confirmer : Vinted pas relu »)`);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `expedie-${nom}${sombre ? '-sombre' : ''}-a-envoyer.png`) });
  // B : « En route ».
  const route = await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-vn-onglet], [role="tab"], button')].find((x) => /En route|Envoy/i.test(x.innerText || '') && x.offsetParent); if (b) { b.click(); return true; } return false; });
  await pg.waitForTimeout(1200);
  const enRoute = await pg.evaluate(() => [...document.querySelectorAll('[data-vn-route], [data-vn-rang], [data-colis-ident]')].map((e) => e.getAttribute('data-vn-route') || e.getAttribute('data-vn-rang') || e.getAttribute('data-colis-ident')));
  dit(route && enRoute.includes('v:9301'), `${nom} : B elle est dans « En route » (jamais cachée)`, JSON.stringify(enRoute).slice(0, 200));
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `expedie-${nom}${sombre ? '-sombre' : ''}-en-route.png`) });
  const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  dit(deb <= 1, `${nom} : D rien ne déborde`, String(deb));
  dit(errs.length === 0, `${nom} : D aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
let srvPret;
(async () => {
  let b;
  try {
    srvPret = new Promise((r) => srv.listen(PORT, r));
    const LIGNES = [
      { id: 'main', data: { vinted_used_numeros: [31, 32, 33], vinted_annonce_numeros: Object.fromEntries(V.map((v) => [`i${v.tx}`, { numero: v.num, title: TITRE, auto: false, numberedAt: ilYaH(200) }])) } },
      { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(40), payload: { my_orders: V.map((v, i) => ({ transaction_id: v.tx, title: TITRE, size_title: '42', price: { amount: '60', currency_code: 'EUR' }, status: 'Bordereau d’envoi envoyé au vendeur', transaction_user_status: 'needs_action', date: ilYaH(44 + i) })) } } },
      ...V.map((v) => ({ id: `harvest_111_txn_${v.tx}`, data: { capturedAt: ilYaH(40), payload: { transaction: { id: v.tx, item_id: `i${v.tx}` } } } })),
      ...await Promise.all(V.map(async (v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: '111', filename: `bordereau-${v.tx}.pdf`, modele: TITRE, article: TITRE, receivedAt: ilYaH(43), pdfB64: await pdfInvente(String(v.tx)), suivi: v.suivi } }))),
      { id: 'email_track_vinted_tx9301', data: { type: 'suivi', carrier: 'vinted', suivi: '', status: 'transit', statusLabel: 'En transit', subject: 'Votre objet a été expédié', transaction: '9301', sens: 'sortant', receivedAt: ilYaH(3), emailAt: ilYaH(3), account: 'compte_a' } },
    ];
    b = await lancer(PW_NAV, { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const sombre of [false, true]) {
      await scenario(b, '390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, LIGNES, sombre);
      await scenario(b, '1512', { viewport: { width: 1512, height: 950 } }, LIGNES, sombre);
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\nKO expedie-sans-extension : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK expedie-sans-extension : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
