// Banc : COLIS → « SCANNER » POUR DÉPOSER (3 nov., choix de Julien n° 1).
// Données INVENTÉES (dépôt public) de la forme réelle : ventes Vinted à expédier (`orders_sold`), leurs
// bordereaux e-mail (`email_bord_{tx}`, champ `suivi`), un colis déjà coché « Colis fait »
// (`vinted_ship_done`). La caméra et le détecteur sont FAUX : `navigator.mediaDevices.getUserMedia` rend
// le flux d'un canvas, `window.BarcodeDetector` rend la valeur posée par le banc (`__scan(valeur)`).
// Exige (jugé sur data-* et sur ce qui est ÉCRIT dans `vinted_ship_done`, §6.4) :
//  A. n° connu (forme Chronopost) ⇒ « Déposé », SON colis (data-scan-cle), la barre « Annuler » ;
//  B. deux colis au MÊME titre : seul celui du n° scanné est déposé (l'autre jamais écrit) ;
//  C. code-barres InPost/Mondial Relay à 26 chiffres ⇒ le colis du n° imprimé (chiffres 3 à 10) ;
//  D. « Annuler » dans les 5 s ⇒ rien n'est écrit ;
//  E. colis déjà coché ⇒ « Déjà déposé », rien de plus écrit ; n° inconnu ⇒ « Pas trouvé », rien écrit ;
//  F. scans en série : la caméra reste ouverte (même feuille, même flux) ; une lecture répétée ne compte qu'une fois ;
//  G. clavier : n° tapé avec espaces ⇒ « Déposé » ;
//  H. un second scan pendant l'attente écrit le premier (geste existant `useDeposeDiffere`) ;
//  I. aucune erreur ; rien ne déborde ; cible ≥ 44 px ; captures 390 tactile + 1512.
// Lancer : construire dist/, puis node scripts/bancs/colis-scan.cjs   (BANC_PORT, SHOTS=dossier)
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4471);
const SHOTS = process.env.SHOTS || '';
const auj = new Date();
const vente = (id, titre) => ({ transaction_id: id, title: titre, price: { amount: '50', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: new Date(auj.getTime() - 86400000).toISOString() });
const VENTES = [vente(9101, 'Nike Air Max 90 blanche taille 42'), vente(9102, 'Nike Air Max 90 blanche taille 42'), vente(9103, 'Adidas Samba noire taille 40'), vente(9104, 'Asics Gel 1130 taille 41'), vente(9105, 'New Balance 530 taille 39')];
const SUIVI = { 9101: 'XA123456789FR', 9102: 'XB223456789FR', 9103: '41234567', 9104: 'XC323456789FR', 9105: '' };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const bord = (tx, titre) => ({ id: 'email_bord_' + tx, data: { transaction: String(tx), uid: '111', filename: 'bordereau-' + tx + '.pdf', modele: titre, article: titre, receivedAt: auj.toISOString(), pdfB64: PDF_B64, suivi: SUIVI[tx] } });
const rows = [...VENTES.map((v) => bord(v.transaction_id, v.title)),
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: VENTES } } }];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
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
    out[alias] = v == null ? null : v;
  }
  return out;
};

async function scenario(b, nom, vue) {
  const ctx = await b.newContext(vue);
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ deja }) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); if (!sessionStorage.getItem('banc_init')) { sessionStorage.setItem('banc_init', '1'); localStorage.setItem('vinted_ship_done', JSON.stringify(deja)); } } catch (_) {}
    // Faux détecteur : rend la file posée par le banc, une valeur à la fois.
    window.__file = []; window.__detections = 0;
    window.__scan = (v) => { window.__file.push(v); };
    window.BarcodeDetector = class { static async getSupportedFormats() { return ['code_128', 'qr_code']; } constructor(o) { this.o = o; }
      async detect() { window.__detections++; const v = window.__file.shift(); return v == null ? [] : [{ rawValue: v, format: 'code_128' }]; } };
    // Fausse caméra : le flux d'un canvas animé.
    window.__flux = 0;
    const gum = async () => { window.__flux++; const c = document.createElement('canvas'); c.width = 640; c.height = 480; const x = c.getContext('2d');
      setInterval(() => { x.fillStyle = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); x.fillRect(0, 0, 640, 480); }, 100);
      return c.captureStream(10); };
    try { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: gum }, configurable: true }); } catch (_) { navigator.mediaDevices.getUserMedia = gum; }
  }, { deja: { 9104: Date.now() - 3600000 } });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z]+)=(not\.)?is\.null/g)].map((m) => ({ k: m[1], non: !!m[2] }));
    const passe = (r) => filtres.every((f) => (f.non ? r.data[f.k] != null : r.data[f.k] == null));
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-colis-scanner]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  const ecrits = () => pg.evaluate(() => { try { return Object.keys(JSON.parse(localStorage.getItem('vinted_ship_done') || '{}')).sort(); } catch (_) { return null; } });
  const res = () => pg.evaluate(() => { const e = document.querySelector('[data-scan-resultat]'); return e ? { etat: e.getAttribute('data-scan-resultat'), cle: e.getAttribute('data-scan-cle'), n: Number(e.getAttribute('data-scan-n')) } : null; });
  const attendre = async (n) => { for (let i = 0; i < 40; i++) { const r = await res(); if (r && r.n >= n) return r; await pg.waitForTimeout(100); } return res(); };
  const bouton = await pg.$('[data-colis-scanner]');
  dit(!!bouton, `${nom} : le bouton « Scanner » est dans Colis → À envoyer`);
  if (!bouton) { await ctx.close(); return; }
  const bb = await bouton.boundingBox();
  dit(bb && bb.height >= 44, `${nom} : « Scanner » fait au moins 44 px`, bb ? String(Math.round(bb.height)) : '');
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `scan-${nom}-colis.png`) });
  await bouton.click();
  await pg.waitForSelector('[data-scan-sheet][data-scan-camera="active"]', { timeout: 8000 }).catch(() => {});
  const cam = await pg.getAttribute('[data-scan-sheet]', 'data-scan-camera').catch(() => null);
  dit(cam === 'active', `${nom} : la caméra s'ouvre et le détecteur du navigateur lit`, String(cam));
  const avant = await ecrits();
  dit(JSON.stringify(avant) === '["9104"]', `${nom} : avant tout scan, seul le colis déjà coché est écrit`, JSON.stringify(avant));
  // A + B : le premier « Nike Air Max 90 blanche taille 42 » (n° Chronopost connu).
  await pg.evaluate(() => window.__scan('XA123456789FR'));
  let r = await attendre(1);
  dit(r && r.etat === 'depose' && r.cle === 'v:9101', `${nom} : A n° connu ⇒ « Déposé », SON colis`, JSON.stringify(r));
  const barre = await pg.$('[data-scan-sheet] [data-depose-annuler="v:9101"]');
  dit(!!barre, `${nom} : A la barre « Annuler » (5 s) est là`);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `scan-${nom}-depose.png`) });
  // F : la même lecture répétée tout de suite ne compte pas.
  await pg.evaluate(() => { window.__scan('XA123456789FR'); });
  await pg.waitForTimeout(700);
  r = await res();
  dit(r && r.n === 1, `${nom} : F une lecture répétée (le code reste dans le cadre) ne compte qu'une fois`, JSON.stringify(r));
  // C + H : code-barres InPost / Mondial Relay (26 chiffres) ; écrit le premier.
  await pg.evaluate(() => window.__scan('56412345670101402623166859'));
  r = await attendre(2);
  dit(r && r.etat === 'depose' && r.cle === 'v:9103', `${nom} : C code à 26 chiffres ⇒ le colis du n° imprimé (41234567)`, JSON.stringify(r));
  await pg.waitForTimeout(1600);
  let e = await ecrits();
  dit(JSON.stringify(e) === '["9101","9104"]', `${nom} : H le second scan a écrit le premier (et SEULEMENT lui : jamais 9102, même titre)`, JSON.stringify(e));
  // D : « Annuler » sur 9103 ⇒ rien.
  await pg.click('[data-depose-annuler="v:9103"]').catch(() => {});
  await pg.waitForTimeout(5800);
  e = await ecrits();
  dit(JSON.stringify(e) === '["9101","9104"]', `${nom} : D « Annuler » ⇒ 9103 jamais écrit`, JSON.stringify(e));
  // E : déjà coché ; déjà déposé par ce scan ; inconnu.
  await pg.evaluate(() => window.__scan('XC323456789FR'));
  r = await attendre(3);
  dit(r && r.etat === 'deja' && r.cle === 'v:9104', `${nom} : E colis déjà coché ⇒ « Déjà déposé »`, JSON.stringify(r));
  await pg.evaluate(() => window.__scan('XZ999999999FR'));
  r = await attendre(4);
  dit(r && r.etat === 'inconnu' && !r.cle, `${nom} : E n° inconnu ⇒ « Pas trouvé »`, JSON.stringify(r));
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `scan-${nom}-pas-trouve.png`) });
  await pg.waitForTimeout(5600);
  e = await ecrits();
  dit(JSON.stringify(e) === '["9101","9104"]', `${nom} : E « Déjà déposé » et « Pas trouvé » n'écrivent rien`, JSON.stringify(e));
  // E' : un titre identique n'est pas un n° : taper le titre ⇒ « Pas trouvé ».
  await pg.fill('[data-scan-saisie]', 'Nike Air Max 90 blanche taille 42');
  await pg.click('[data-scan-ok]');
  r = await attendre(5);
  dit(r && r.etat !== 'depose' && !r.cle, `${nom} : un titre n'est jamais une identité`, JSON.stringify(r));
  // G : clavier.
  await pg.fill('[data-scan-saisie]', 'xb 223 456 789 fr');
  await pg.click('[data-scan-ok]');
  r = await attendre(6);
  dit(r && r.etat === 'depose' && r.cle === 'v:9102', `${nom} : G n° tapé (espaces, minuscules) ⇒ « Déposé »`, JSON.stringify(r));
  const flux = await pg.evaluate(() => window.__flux);
  dit(flux === 1, `${nom} : F scans en série, la caméra n'a été ouverte qu'une fois`, String(flux));
  await pg.waitForTimeout(5800);
  e = await ecrits();
  dit(JSON.stringify(e) === '["9101","9102","9104"]', `${nom} : G écrit après 5 s`, JSON.stringify(e));
  const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  dit(deb <= 1, `${nom} : rien ne déborde`, String(deb));
  await pg.click('[data-scan-fermer]');
  await pg.waitForTimeout(300);
  dit(!(await pg.$('[data-scan-sheet]')), `${nom} : la feuille se ferme`);
  // La vente déposée a quitté « À envoyer » (le geste existant) : elle est dans « Envoyés ».
  const reste = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card][data-tx-colis]')].map((x) => x.getAttribute('data-tx-colis')));
  dit(!reste.includes('9101') && !reste.includes('9102') && reste.includes('9103'), `${nom} : les colis déposés ont quitté « À envoyer », 9103 (annulé) y reste`, JSON.stringify(reste));
  dit(errs.length === 0, `${nom} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  await ctx.close();
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    await scenario(b, '390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await scenario(b, '1512', { viewport: { width: 1512, height: 950 } });
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\nKO colis-scan : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK colis-scan : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
