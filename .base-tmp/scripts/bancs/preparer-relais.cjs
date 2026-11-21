// Banc : « PRÉPARER MES COLIS » PAS À PAS (Colis → À envoyer) et MODE RELAIS (À retirer) — lot AD, 9 nov.
// Julien a validé les propositions 46 et 48 (« fais tout »).
// Données INVENTÉES (dépôt public) de la forme réelle : ventes Vinted à expédier (`orders_sold`, prix
// objet `{amount}`), leurs bordereaux e-mail (`email_bord_{tx}`, `suivi`, PDF), achats Vinted au point
// relais (`orders_purchased`, `panel_colis_relais` : code, QR), e-mails de suivi (`email_track_*`).
// Exige (jugé sur data-* et sur ce qui est ÉCRIT, §6.4) :
//  PRÉPARER — 8 ventes au MÊME titre, chacune son n° de transaction, son N°, sa photo :
//   P1 « Préparer mes colis » (≥ 44 px) ouvre une feuille plein écran en portail ;
//   P2 l'ordre est celui de la liste « À envoyer » (les cartes, dans l'ordre du DOM) ;
//   P3 chaque étape montre LA paire de SA vente (clé, N°, photo b{k}, titre) — jamais une autre au même
//      titre ; « k sur 8 » ; ‹ › ; rien n'est écrit en naviguant ;
//   P4 « Colis fait » ⇒ « Annuler » 5 s, puis `vinted_ship_done` + `vinted_bords_shipped` de CETTE vente
//      seulement — la même forme que le bouton « Déposé » de la carte ;
//   P5 « Colis fait » puis « Annuler » ⇒ rien n'est écrit ;
//   P6 fermer au milieu puis rouvrir ⇒ reprise sur le même colis ;
//   P7 « Scanner » depuis l'étape ⇒ le scanner dit « Pas ce colis » pour le bordereau d'une autre vente
//      (aucun bouton), « C'est le bon bordereau » pour le sien ;
//  MODE RELAIS — Colis → À retirer :
//   R1 « Mode relais » ouvre une feuille plein écran, fond BLANC même en mode sombre, code ≥ 56 px ;
//   R2 la liste = EXACTEMENT les identités publiées dans `vrm_colis_retirer.colis` (ni un « à vérifier »,
//      ni un retiré) ;
//   R3 le Wake Lock est demandé à l'ouverture et RENDU à la fermeture ; la luminosité est dite ;
//   R4 glisser (390 tactile) ou › (1512) passe au suivant ;
//   R5 rien n'est écrit sans geste ; « Retiré » ⇒ `vinted_pickup_done[tx]` de CET achat (deux achats au
//      même titre : le bon), la même forme que « J'ai retiré » de sa carte ; « Annuler » offert ;
//      « Retiré » puis « Annuler » sur un e-mail ⇒ `vrm_colis_collected` inchangé ;
//   R6 hors ligne (base injoignable) : « Mode relais » des codes gardés sur l'appareil, seulement ceux
//      comptés « à retirer » (390-sombre) ;
//  PARTOUT : cibles ≥ 44 px, rien ne déborde, aucune erreur.
// Vues : 390 tactile sombre et clair, 1512 clair (PR_VUES=390-sombre,… pour en choisir).
// Lancer : construire dist/, puis node scripts/bancs/preparer-relais.cjs   (BANC_PORT, SHOTS=dossier)
const path = require('path');
let PW;
try { PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')); }
catch (_) { PW = require('playwright'); }
const { lancer } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4491);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.PR_VUES ? process.env.PR_VUES.split(',') : null;
const MS = Date.now(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const jourDans = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;

// ── 8 ventes au MÊME titre (9201-9208), chacune son n° de suivi, son N° (31-38), sa photo (b1-b8). ──
const TITRE = 'Nike Air Max 90 blanche';
const vente = (id, k) => ({ transaction_id: id, title: TITRE, size_title: '42', user_login: `acheteur_${k}`, price: { amount: '50', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: iso(MS - J - k * 60000), photo: { url: url(k) } });
const VENTES = Array.from({ length: 8 }, (_, k) => vente(9201 + k, k + 1));
const SUIVI = Object.fromEntries(VENTES.map((v, k) => [v.transaction_id, `XA${100000001 + k}FR`]));
const NUMS = Object.fromEntries(VENTES.map((v, k) => [String(v.transaction_id), { numero: String(31 + k) }]));
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const bord = (tx) => ({ id: 'email_bord_' + tx, data: { transaction: String(tx), uid: '111', filename: 'bordereau-' + tx + '.pdf', modele: TITRE, article: TITRE, receivedAt: iso(MS - 3600000), pdfB64: PDF_B64, suivi: SUIVI[tx] } });

// ── ACHATS au point relais : deux au MÊME titre (9302, 9303), un autre (9301, avec QR), un déjà retiré (9304). ──
const AU_RELAIS = 'Colis déposé en point relais';
const achat = (id, titre, k) => ({ transaction_id: id, conversation_id: 7000 + id % 1000, title: titre, size_title: '40', user_login: `vendeur_${k}`, price: { amount: '40', currency_code: 'EUR' }, status: AU_RELAIS, transaction_user_status: 'needs_action', date: iso(MS - 5 * J), photo: { url: url(20 + k) } });
const ACHATS = [achat(9301, 'Adidas Samba noire', 1), achat(9302, 'New Balance 530 grise', 2), achat(9303, 'New Balance 530 grise', 3), achat(9304, 'Puma Suede bleue', 4)];
const LIEU = 'Phone Cash, 12 rue du Port, 35260 Cancale';
const QR_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAAAAADhZOFXAAAAGUlEQVR4nGNgYPj/n4GBgQEEGBkZGBgZAAAZBAH/2Bk3SQAAAABJRU5ErkJggg==';
const RELAIS = {
  9301: { code: '012345', lieu: LIEU, transporteur: 'mondialrelay', at: iso(MS), qrB64: QR_PNG, qrType: 'image/png' },
  9302: { code: '555001', lieu: LIEU, transporteur: 'mondialrelay', at: iso(MS) },
  9303: { code: '555002', lieu: LIEU, transporteur: 'mondialrelay', at: iso(MS) },
  9304: { code: '555003', lieu: LIEU, transporteur: 'mondialrelay', at: iso(MS) },
};
const track = (suivi, lieu, code, extra = {}) => ({ id: `email_track_mondialrelay_${suivi}`, data: Object.assign({ type: 'suivi', carrier: 'mondialrelay', suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, receivedAt: iso(MS - 0.3 * J), emailAt: iso(MS - 0.3 * J), arriveLe: iso(MS - 0.3 * J), code, lieu, limite: jourDans(4), consigne: false, account: 'compte_test' }, extra) });
const TRACKS = [
  track('90000021', 'TABAC DU QUAI, 12 Rue des Mouettes, 22000 Saint-Brieuc', '333333', { artTitle: 'Sac seau toile écrue' }),
  // Délai dépassé il y a longtemps : « à vérifier », JAMAIS dans le mode relais.
  track('90000099', 'POINT PRESSE, 3 Rue Haute, 56000 Vannes', '999111', { artTitle: 'Bottines en cuir', limite: jourDans(-6), arriveLe: iso(MS - 14 * J), receivedAt: iso(MS - 14 * J), emailAt: iso(MS - 14 * J) }),
];
const LIGNES = [
  ...VENTES.map((v) => bord(v.transaction_id)),
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS), payload: { my_orders: ACHATS } } },
  { id: 'panel_colis_relais', data: RELAIS },
  ...TRACKS,
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 220)); } };
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = iso(MS); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const TEINTES = ['#dfe3e8', '#e8e1d8', '#dfe5dd', '#e6dcdc', '#e2dfe8', '#e8e4d6'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${TEINTES[k % 6]}"/><path d="M60 250 C80 190 150 175 190 200 C230 222 285 205 330 232 C352 246 346 282 306 284 L84 284 C62 284 52 268 60 250 Z" fill="rgba(30,34,40,.62)"/><path d="M60 284 L330 284 L326 300 L66 300 Z" fill="rgba(255,255,255,.85)"/><text x="200" y="120" font-size="90" text-anchor="middle" fill="rgba(0,0,0,.35)" font-family="sans-serif">${k}</text></svg>`;

const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const etat = { baseKO: false };
  await pg.addInitScript(({ sombre: s, nums, retire }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
      if (!sessionStorage.getItem('banc_init')) { sessionStorage.setItem('banc_init', '1'); localStorage.setItem('vinted_sale_overrides', JSON.stringify(nums)); localStorage.setItem('vinted_pickup_done', JSON.stringify(retire)); }
    } catch (_) {}
    // Le Wake Lock du navigateur, compté : demandé à l'ouverture, rendu à la fermeture.
    window.__wl = { demandes: 0, rendus: 0 };
    try { Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async (t) => { window.__wl.demandes++; const v = { type: t, released: false, addEventListener() {}, release: async () => { if (!v.released) { v.released = true; window.__wl.rendus++; } } }; return v; } } }); } catch (_) {}
    // Le scanner : faux détecteur et fausse caméra (comme scanner-colis-achats).
    window.__file = []; window.__scan = (v) => { window.__file.push(v); };
    window.BarcodeDetector = class { static async getSupportedFormats() { return ['code_128', 'qr_code']; } constructor(o) { this.o = o; }
      async detect() { const v = window.__file.shift(); return v == null ? [] : [{ rawValue: v, format: 'code_128' }]; } };
    const gum = async () => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const x = c.getContext('2d'); x.fillStyle = '#888'; x.fillRect(0, 0, 320, 240); return c.captureStream(5); };
    try { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: gum }, configurable: true }); } catch (_) { navigator.mediaDevices.getUserMedia = gum; }
    // L'impression : comptée, jamais lancée.
    window.__impr = 0; window.print = () => { window.__impr++; };
  }, { sombre: !!sombre, nums: NUMS, retire: { 9304: iso(MS - 3600000) } });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const m = /images1\.vinted\.net\/t\/b(\d+)\//.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(Number(m[1])) });
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    return ['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    if (etat.baseKO) return route.fulfill({ status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"indisponible"}' });
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(MS), cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => (r.data[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, etat };
};

const lire = (pg, k) => pg.evaluate((cle) => { try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch (_) { return 'illisible'; } }, k);
const cles = (o) => Object.keys(o || {}).sort();
const cliquer = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const etape = (pg) => pg.evaluate(() => {
  const f = document.querySelector('[data-preparer]'); if (!f) return null;
  const e = document.querySelector('[data-preparer-cle]'); const img = e && e.querySelector('.vrm-prep-photo img');
  return { pos: f.getAttribute('data-preparer-position'), ordre: f.getAttribute('data-preparer-ordre'), cle: e && e.getAttribute('data-preparer-cle'), num: e && e.getAttribute('data-preparer-num'),
    paire: e && e.getAttribute('data-preparer-paire'), etat: e && e.getAttribute('data-preparer-etat'), titre: (document.querySelector('[data-preparer-titre]') || {}).textContent || '',
    photo: img ? { src: img.getAttribute('src'), ok: img.complete && img.naturalWidth > 0 } : null,
    fait: !!document.querySelector('[data-preparer-fait]'), annuler: !!document.querySelector('[data-preparer-annuler]'), imprimer: !!document.querySelector('[data-preparer-imprimer]'), scanner: !!document.querySelector('[data-preparer-scanner]') };
});
const relais = (pg) => pg.evaluate(() => {
  const f = document.querySelector('[data-relais]'); if (!f) return null;
  const c = document.querySelector('[data-relais-cle]'); const code = document.querySelector('[data-relais-code]');
  return { pos: f.getAttribute('data-relais-position'), idents: (f.getAttribute('data-relais-idents') || '').split(',').filter(Boolean), veille: f.getAttribute('data-relais-veille'), hl: f.getAttribute('data-relais-hors-ligne'),
    cle: c && c.getAttribute('data-relais-cle'), ident: c && c.getAttribute('data-relais-ident'), etat: c && c.getAttribute('data-relais-etat'), code: code && code.getAttribute('data-relais-code'),
    codePx: code ? parseFloat(getComputedStyle(code).fontSize) : 0, qr: !!document.querySelector('[data-relais-qr]'), fond: getComputedStyle(f).backgroundColor, encre: getComputedStyle(f).color,
    lum: !!document.querySelector('[data-relais-luminosite]'), retirer: !!document.querySelector('[data-relais-retirer]'), annuler: !!document.querySelector('[data-relais-annuler]'),
    portail: f.parentElement === document.body && getComputedStyle(f).position === 'fixed' };
});
const cibles = (pg, racine) => pg.evaluate((r) => [...document.querySelectorAll(`${r} button, ${r} a`)].filter((e) => e.getBoundingClientRect().width > 0 && !e.disabled).map((e) => ({ q: (e.getAttribute('aria-label') || e.textContent || '').slice(0, 24), h: Math.round(e.getBoundingClientRect().height) })), racine);
const deborde = (pg, racine) => pg.evaluate((r) => { const s = document.querySelector(r); const w = window.innerWidth; const hors = s ? [...s.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > w + 1 || b.left < -1) && !e.closest('.vrm-relais-points'); }).map((e) => String(e.className).slice(0, 30)) : []; return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, hors: hors.slice(0, 4) }; }, racine);
const glisser = (pg, dx) => pg.evaluate((d) => {
  const el = document.querySelector('[data-relais-cle]'); if (!el) return false;
  const r = el.getBoundingClientRect(); const x0 = r.left + r.width / 2 + (d < 0 ? 80 : -80), y = r.top + 120;
  const t = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
  el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(x0)], changedTouches: [t(x0)], bubbles: true, cancelable: true }));
  el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(x0 + d)], bubbles: true, cancelable: true }));
  return true;
}, dx);

async function vue(b, nom, vp, sombre) {
  console.log(`\n— Préparer & relais · ${nom}`);
  const { ctx, pg, errs, etat } = await ouvrir(b, vp, sombre);
  const shot = async (q) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `preparer-relais-${nom}-${q}.png`) }); };
  // ════════════ PRÉPARER ════════════
  await essaie(`${nom} préparer`, async () => {
    await pg.waitForFunction(() => document.querySelectorAll('[data-bord-card][data-tx-colis]').length >= 8, null, { timeout: 30000 }).catch(() => {});
    await pg.waitForSelector('[data-preparer-ouvrir]', { timeout: 10000 }).catch(() => {});
    const ordreListe = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card][data-colis-ident]')].map((e) => e.getAttribute('data-colis-ident')));
    dit(ordreListe.length === 8, `${nom} : 8 colis à envoyer au même titre`, String(ordreListe.length));
    const bb = await pg.$('[data-preparer-ouvrir]').then((e) => e && e.boundingBox());
    dit(bb && bb.height >= 44, `${nom} : P1 « Préparer mes colis » est là (≥ 44 px)`, bb ? String(Math.round(bb.height)) : 'absent');
    await pg.click('[data-preparer-ouvrir]');
    await pg.waitForSelector('[data-preparer-cle]', { timeout: 8000 });
    const portail = await pg.evaluate(() => { const s = document.querySelector('[data-preparer]'); return !!s && s.parentElement === document.body && getComputedStyle(s).position === 'fixed'; });
    dit(portail, `${nom} : P1 feuille plein écran, en portail sur <body>`);
    let e = await etape(pg);
    dit(e && e.ordre === ordreListe.join(','), `${nom} : P2 l'ordre est celui de « À envoyer »`, JSON.stringify([e && e.ordre, ordreListe.join(',')]));
    // P3 : chaque étape, la paire de SA vente.
    const vus = [];
    for (let k = 0; k < 8; k++) {
      await pg.waitForTimeout(250); e = await etape(pg);
      const tx = e && e.cle ? Number(e.cle.slice(2)) : 0; const kk = tx - 9200;
      const bon = e && e.cle === ordreListe[k] && e.num === String(30 + kk) && e.paire === 'sure' && e.titre === TITRE && e.photo && new RegExp(`/b${kk}/`).test(e.photo.src) && e.pos === `${k + 1}/8`;
      vus.push(bon ? 1 : 0);
      if (!bon) dit(false, `${nom} : P3 étape ${k + 1}`, JSON.stringify(e));
      if (k === 0) await shot('1-preparer');
      if (k < 7) await pg.click('[data-preparer-suivant]');
    }
    dit(vus.every(Boolean), `${nom} : P3 les 8 étapes montrent chacune LA paire de SA vente (clé, N°, photo, « k sur 8 »)`, vus.join(''));
    await pg.waitForTimeout(400);
    const photosOk = await pg.evaluate(() => { const i = document.querySelector('.vrm-prep-photo img'); return !!i && i.complete && i.naturalWidth > 0; });
    dit(photosOk, `${nom} : P3 la photo est chargée`);
    await pg.click('[data-preparer-precedent]'); e = await etape(pg);
    dit(e && e.pos === '7/8' && e.cle === ordreListe[6], `${nom} : P3 ‹ revient au colis d'avant`, e && e.pos);
    dit(cles(await lire(pg, 'vinted_ship_done')).length === 0 && cles(await lire(pg, 'vinted_bords_shipped')).length === 0, `${nom} : P3 rien n'est écrit en naviguant`);
    // P4 : « Colis fait » sur la 3ᵉ.
    for (let k = 0; k < 4; k++) await pg.click('[data-preparer-precedent]');
    e = await etape(pg); const cible = e.cle; const txC = cible.slice(2);
    dit(e.pos === '3/8' && e.fait && e.imprimer && e.scanner, `${nom} : P4 l'étape 3 offre « Colis fait », « Imprimer ce bordereau », « Scanner »`, JSON.stringify(e));
    await pg.click('[data-preparer-fait]');
    e = await etape(pg);
    dit(e.annuler && !e.fait && e.etat === 'fait', `${nom} : P4 « Colis fait » ⇒ « Annuler » (5 s) dans la feuille`, JSON.stringify(e));
    dit(cles(await lire(pg, 'vinted_ship_done')).length === 0, `${nom} : P4 rien n'est écrit pendant les 5 s d'« Annuler »`);
    await shot('2-colis-fait');
    await pg.waitForTimeout(6000);
    const sd = await lire(pg, 'vinted_ship_done'), bs = await lire(pg, 'vinted_bords_shipped');
    dit(JSON.stringify(cles(sd)) === JSON.stringify([txC]) && cles(bs).length === 1 && cles(bs)[0].includes(txC), `${nom} : P4 écrit : la vente ${txC} et son bordereau, rien d'autre`, JSON.stringify([sd, bs]));
    e = await etape(pg);
    dit(e && e.cle === cible && e.etat === 'fait' && !e.annuler, `${nom} : P4 la séance garde le colis, montré fait`, JSON.stringify(e && { cle: e.cle, etat: e.etat }));
    // P5 : « Colis fait » puis « Annuler » sur la 4ᵉ.
    await pg.click('[data-preparer-suivant]'); e = await etape(pg); const txA = e.cle.slice(2);
    await pg.click('[data-preparer-fait]'); await pg.waitForTimeout(600); await pg.click('[data-preparer-annuler]');
    await pg.waitForTimeout(6000);
    e = await etape(pg);
    dit(!cles(await lire(pg, 'vinted_ship_done')).includes(txA) && e.etat === 'a-faire' && e.fait, `${nom} : P5 « Annuler » ⇒ rien n'est écrit, le colis redevient à faire`, JSON.stringify({ sd: cles(await lire(pg, 'vinted_ship_done')), etat: e.etat }));
    // P6 : fermer au milieu, rouvrir ⇒ reprise.
    const ici = e.cle;
    await pg.click('[data-preparer-fermer]'); await pg.waitForTimeout(300);
    dit(!(await pg.$('[data-preparer]')), `${nom} : P6 la feuille se ferme à tout moment`);
    await pg.click('[data-preparer-ouvrir]'); await pg.waitForSelector('[data-preparer-cle]', { timeout: 8000 });
    e = await etape(pg);
    dit(e && e.cle === ici && e.pos === '4/8', `${nom} : P6 rouverte, elle reprend où il en était`, JSON.stringify(e && { cle: e.cle, pos: e.pos }));
    // P7 : le scanner depuis l'étape (le bordereau d'une autre vente, puis le sien).
    if (e && e.scanner) {
      await pg.click('[data-preparer-scanner]');
      await pg.waitForSelector('[data-scan-sheet][data-scan-attendu]', { timeout: 8000 });
      const autreTx = ici === 'v:9201' ? 9202 : 9201;
      await pg.evaluate((v) => window.__scan(v), SUIVI[autreTx]);
      await pg.waitForFunction(() => Number((document.querySelector('[data-scan-resultat]') || { getAttribute: () => 0 }).getAttribute('data-scan-n')) >= 1, null, { timeout: 6000 }).catch(() => {});
      let r = await pg.evaluate(() => ({ etat: document.querySelector('[data-scan-resultat]').getAttribute('data-scan-resultat'), m: (document.querySelector('[data-scan-message]') || {}).textContent || '', bouton: !!document.querySelector('[data-scan-confirmer]') }));
      dit(r.etat === 'autre' && /Pas ce colis/.test(r.m) && !r.bouton, `${nom} : P7 le bordereau d'une autre vente ⇒ « Pas ce colis », aucun bouton`, JSON.stringify(r));
      await shot('3-scan-autre');
      await pg.waitForTimeout(2700);
      await pg.evaluate((v) => window.__scan(v), SUIVI[Number(ici.slice(2))]);
      await pg.waitForFunction(() => Number((document.querySelector('[data-scan-resultat]') || { getAttribute: () => 0 }).getAttribute('data-scan-n')) >= 2, null, { timeout: 6000 }).catch(() => {});
      r = await pg.evaluate(() => ({ etat: document.querySelector('[data-scan-resultat]').getAttribute('data-scan-resultat'), cle: document.querySelector('[data-scan-resultat]').getAttribute('data-scan-cle'), bon: !!document.querySelector('[data-scan-bon]'), bouton: (document.querySelector('[data-scan-confirmer]') || { getAttribute: () => '' }).getAttribute('data-scan-confirmer') }));
      dit(r.etat === 'trouve' && r.cle === ici && r.bon && r.bouton === ici, `${nom} : P7 son bordereau ⇒ « C'est le bon bordereau » et le geste`, JSON.stringify(r));
      await pg.click('[data-scan-fermer]'); await pg.waitForTimeout(300);
    } else dit(false, `${nom} : P7 « Scanner » est offert`);
    dit(cles(await lire(pg, 'vinted_ship_done')).length === 1, `${nom} : P7 le scan n'écrit rien sans toucher`);
    const c = await cibles(pg, '[data-preparer]');
    dit(c.length && c.every((x) => x.h >= 44), `${nom} : cibles ≥ 44 px (préparer)`, JSON.stringify(c.filter((x) => x.h < 44)));
    const d = await deborde(pg, '[data-preparer]');
    dit(d.page <= 1 && !d.hors.length, `${nom} : rien ne déborde (préparer)`, JSON.stringify(d));
    await pg.click('[data-preparer-liste]'); await pg.waitForTimeout(200); await shot('4-recap');
    await pg.click('[data-preparer-fermer]'); await pg.waitForTimeout(300);
    // P4' : la même écriture que le bouton « Déposé » de la carte (sur une autre vente).
    const autre = ordreListe.map((x) => x.slice(2)).find((t) => t !== txC && t !== txA);
    const clic = await cliquer(pg, `[data-bord-card][data-tx-colis="${autre}"] [data-geste="fait"]`);
    await pg.waitForTimeout(1500);
    const sd2 = await lire(pg, 'vinted_ship_done'), bs2 = await lire(pg, 'vinted_bords_shipped');
    const kC = cles(bs2).find((k) => k.includes(txC)), kO = cles(bs2).find((k) => k.includes(autre));
    dit(clic && typeof sd2[txC] === 'number' && typeof sd2[autre] === 'number' && kC && kO && bs2[kC] === bs2[kO] && kO.replace(autre, 'X') === kC.replace(txC, 'X'),
      `${nom} : P4 la même écriture que « Déposé » de la carte (mêmes clés, même forme)`, JSON.stringify({ clic, sd: [sd2[txC], sd2[autre]], bs: [kC, kO] }));
  });
  // ════════════ MODE RELAIS ════════════
  await essaie(`${nom} relais`, async () => {
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' }))); /* (11 nov., lot DJ3) « À retirer » est en tête d'Achats */ await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
    await pg.waitForSelector('[data-relais-ouvrir]', { timeout: 10000 }).catch(() => {});
    await pg.waitForTimeout(800);
    const pub = await lire(pg, 'vrm_colis_retirer');
    const identsPub = (pub && Array.isArray(pub.colis) ? pub.colis.map((t) => t[3]) : []).sort();
    dit(identsPub.length === 4 && pub.total === 4, `${nom} : la publication compte 4 colis à retirer (3 achats + 1 e-mail)`, JSON.stringify({ total: pub && pub.total, identsPub, aVerifier: pub && pub.aVerifier }));
    const avant = { pd: await lire(pg, 'vinted_pickup_done'), co: await lire(pg, 'vrm_colis_collected') };
    const bb = await pg.$('[data-relais-ouvrir]').then((e) => e && e.boundingBox());
    dit(bb && bb.height >= 44, `${nom} : R1 « Mode relais » est là (≥ 44 px)`, bb ? String(Math.round(bb.height)) : 'absent');
    await pg.click('[data-relais-ouvrir]');
    await pg.waitForSelector('[data-relais]', { timeout: 8000 });
    await pg.waitForTimeout(400);
    let r = await relais(pg);
    dit(r && r.portail, `${nom} : R1 feuille plein écran, en portail sur <body>`);
    dit(r && r.fond === 'rgb(255, 255, 255)' && r.encre === 'rgb(0, 0, 0)', `${nom} : R1 fond blanc plein, encre noire${sombre ? ' — même en mode sombre' : ''}`, JSON.stringify(r && [r.fond, r.encre]));
    dit(r && r.code && r.codePx >= 56, `${nom} : R1 le code de retrait en très grand (≥ 56 px)`, JSON.stringify(r && [r.code, r.codePx]));
    dit(r && JSON.stringify([...r.idents].sort()) === JSON.stringify(identsPub), `${nom} : R2 la liste = EXACTEMENT les identités publiées dans vrm_colis_retirer`, JSON.stringify(r && r.idents));
    dit(r && !r.idents.includes('e:90000099') && !r.idents.some((x) => /9304$/.test(x)), `${nom} : R2 ni le colis « à vérifier », ni l'achat déjà retiré`);
    const wl = await pg.evaluate(() => window.__wl);
    dit(wl.demandes === 1 && r.veille === 'actif' && r.lum, `${nom} : R3 Wake Lock demandé, l'écran reste allumé ; la luminosité est dite`, JSON.stringify({ wl, veille: r.veille }));
    await shot('5-relais');
    // R4 : suivant.
    const pos0 = r.pos;
    if (vp.width < 600) await glisser(pg, -160); else await pg.click('[data-relais-suivant]');
    await pg.waitForTimeout(250); r = await relais(pg);
    dit(pos0 === '1/4' && r.pos === '2/4', `${nom} : R4 ${vp.width < 600 ? 'glisser' : '›'} passe au suivant`, JSON.stringify([pos0, r.pos]));
    if (vp.width < 600) { await glisser(pg, 160); await pg.waitForTimeout(200); r = await relais(pg); dit(r.pos === '1/4', `${nom} : R4 glisser dans l'autre sens revient`, r.pos); }
    // R5 : rien sans geste ; « Retiré » sur 9303 (deux achats « New Balance 530 grise »).
    dit(JSON.stringify(await lire(pg, 'vinted_pickup_done')) === JSON.stringify(avant.pd), `${nom} : R5 rien n'est écrit sans geste`);
    for (let k = 0; k < 4; k++) { r = await relais(pg); if (r.ident === 'v:111:9303') break; await pg.click('[data-relais-suivant]'); await pg.waitForTimeout(150); }
    dit(r.ident === 'v:111:9303' && r.code === '555002', `${nom} : R5 le colis 9303 porte SON code (555002)`, JSON.stringify(r && [r.ident, r.code]));
    await pg.click('[data-relais-retirer]'); await pg.waitForTimeout(1500);
    r = await relais(pg);
    let pd = await lire(pg, 'vinted_pickup_done');
    dit(JSON.stringify(cles(pd)) === '["9303","9304"]' && typeof pd['9303'] === 'string', `${nom} : R5 « Retiré » ⇒ vinted_pickup_done[9303] seulement (jamais 9302)`, JSON.stringify(pd));
    dit(r.etat === 'retire' && r.annuler, `${nom} : R5 « Retiré ✓ » et « Annuler » sous le code`, JSON.stringify(r && { etat: r.etat, annuler: r.annuler }));
    await shot('6-retire');
    // « Retiré » puis « Annuler » sur l'e-mail 90000021.
    for (let k = 0; k < 4; k++) { await cliquer(pg, '[data-relais-precedent]:not([disabled])'); await pg.waitForTimeout(100); }
    for (let k = 0; k < 4; k++) { r = await relais(pg); if (r.ident === 'e:90000021') break; await cliquer(pg, '[data-relais-suivant]:not([disabled])'); await pg.waitForTimeout(150); }
    dit(r.ident === 'e:90000021', `${nom} : R5 l'e-mail est dans la séance`, r.ident);
    await pg.click('[data-relais-retirer]'); await pg.waitForTimeout(500);
    await pg.click('[data-relais-annuler]'); await pg.waitForTimeout(2500);
    const co = await lire(pg, 'vrm_colis_collected');
    r = await relais(pg);
    dit(!(Array.isArray(co) && co.length) && r.retirer, `${nom} : R5 « Retiré » puis « Annuler » ⇒ vrm_colis_collected inchangé, « Retiré » revient`, JSON.stringify({ co, retirer: r.retirer }));
    const c = await cibles(pg, '[data-relais]');
    dit(c.length && c.every((x) => x.h >= 44), `${nom} : cibles ≥ 44 px (relais)`, JSON.stringify(c.filter((x) => x.h < 44)));
    const d = await deborde(pg, '[data-relais]');
    dit(d.page <= 1 && !d.hors.length, `${nom} : rien ne déborde (relais)`, JSON.stringify(d));
    await pg.click('[data-relais-fermer]'); await pg.waitForTimeout(400);
    dit(!(await pg.$('[data-relais]')) && (await pg.evaluate(() => window.__wl.rendus)) === 1, `${nom} : R3 fermé ⇒ le Wake Lock est rendu`, JSON.stringify(await pg.evaluate(() => window.__wl)));
    // La même forme que « J'ai retiré » de la carte (9302).
    const clic = await cliquer(pg, '[data-cc-carte="r:v:9302"] [data-colis-retire]');
    await pg.waitForTimeout(1500);
    pd = await lire(pg, 'vinted_pickup_done');
    dit(clic && typeof pd['9302'] === typeof pd['9303'] && JSON.stringify(cles(pd)) === '["9302","9303","9304"]', `${nom} : R5 la même écriture que « J'ai retiré » de la carte (même clé, même forme)`, JSON.stringify({ clic, pd }));
  });
  // ════════════ HORS LIGNE (390-sombre) ════════════
  if (nom === '390-sombre') await essaie(`${nom} hors ligne`, async () => {
    const hl = await lire(pg, 'vrm_codes_hors_ligne');
    dit(hl && hl.codes && hl.codes.some((x) => x.compte === true) && hl.codes.some((x) => x.compte === false), `${nom} : R6 les codes gardés portent « compté » ou non`, JSON.stringify(hl && hl.codes.map((x) => [x.id, x.compte])));
    const pub = await lire(pg, 'vrm_colis_retirer'); const identsPub = new Set((pub.colis || []).map((t) => t[3]));
    etat.baseKO = true;
    await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-relais-ouvrir="hors-ligne"]', { timeout: 20000 }).catch(() => {});
    const ok1 = !!(await pg.$('[data-relais-ouvrir="hors-ligne"]'));
    dit(ok1, `${nom} : R6 base injoignable : « Mode relais » des codes gardés`);
    if (ok1) {
      await pg.click('[data-relais-ouvrir="hors-ligne"]'); await pg.waitForSelector('[data-relais]', { timeout: 6000 });
      const r = await relais(pg);
      dit(r && r.hl === '1' && r.idents.length > 0 && r.idents.every((x) => identsPub.has(x)) && !r.idents.includes('e:90000099') && !r.retirer, `${nom} : R6 hors ligne : seulement les colis comptés « à retirer », aucun « Retiré »`, JSON.stringify(r && r.idents));
      await shot('7-hors-ligne');
      await pg.click('[data-relais-fermer]');
    }
    etat.baseKO = false;
  });
  dit(errs.length === 0, `${nom} : aucune erreur d'app`, errs.join(' | ').slice(0, 300));
  await ctx.close();
}

(async () => {
  let b;
  try {
    b = await lancer(PW, { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [nom, vp, sombre] of [['390-sombre', { width: 390, height: 844 }, true], ['390-clair', { width: 390, height: 844 }, false], ['1512-clair', { width: 1512, height: 950 }, false]]) {
      if (VUES && !VUES.includes(nom)) continue;
      await vue(b, nom, vp, sombre);
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\nKO preparer-relais : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK preparer-relais : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
