// Banc : MODE « DÉPÔT » AU POINT RELAIS (lot AU) et HORS LIGNE AU POINT RELAIS (lot AY) — 10 nov.
// Données INVENTÉES (dépôt public) de la forme réelle : 8 ventes Vinted au MÊME titre à expédier
// (`orders_sold`, prix objet `{amount}`), leurs bordereaux e-mail (`email_bord_{tx}`, `suivi`, PDF,
// `transporteurPdf` : 5 Mondial Relay, 3 Chronopost), achats au point relais (`orders_purchased`,
// `panel_colis_relais`), un e-mail de suivi (`email_track_*`).
// Exige (jugé sur data-* et sur ce qui est ÉCRIT, §6.4) :
//  EN LIGNE (Colis → À envoyer) :
//   D1 « Je dépose » (≥ 44 px) ouvre un écran plein écran (portail) ; ses colis = EXACTEMENT ceux de la
//      liste « À envoyer », dans son ordre ; chacun UNE fois ; groupés par transporteur (logo), chaque
//      groupe ne porte que SES colis, dans l'ordre de la liste ; « 0 sur 8 déposés » ; Wake Lock pris ;
//   D2 scanner le bordereau de 9203 ⇒ CE colis coché (« annulable »), rien d'écrit pendant 5 s, puis
//      `vinted_ship_done` + `vinted_bords_shipped` de 9203 SEULEMENT (même forme que la carte) ;
//   D3 un n° qui n'est pas dans la liste ⇒ « Pas dans tes colis à déposer », rien d'écrit ;
//   D4 le même bordereau rescanné ⇒ « Déjà déposé », rien de plus ;
//   D5 scanner puis « Annuler » ⇒ rien d'écrit, le colis redevient à déposer ;
//   D6 le n° tapé à la main (sans caméra) trouve le colis ;
//   D7 tout coché ⇒ « Tout est déposé » plein écran, les 8 écrits ; fermé ⇒ Wake Lock rendu ;
//   D8 sans caméra ⇒ « tape le n° », la saisie prend la main ;
//  HORS LIGNE (390-sombre, 1512-clair) — app rouverte À FROID réseau coupé (lot D) :
//   H1 la photo gardée porte le n° de suivi et le transporteur de chaque colis à envoyer, et le
//      verdict des codes (`id` publié) ;
//   H2 « Je dépose » hors ligne : les colis de la photo, « vue à hh:mm », aucune requête base//api/ ;
//   H3 scanner 9201 ⇒ coché « part au retour du réseau », « 1 dépôt à envoyer », gardé dans la file
//      d'envoi ; rescanné ⇒ « Déjà déposé » (rien ne double) ; hors liste ⇒ rien ;
//   H4 « Mode relais » hors ligne : les identités publiées (`vrm_colis_retirer`), « codes vus à », codes ;
//   H5 le réseau revient ⇒ le dépôt compte UNE fois (le colis sort de « À envoyer »), gardé dans la file
//      d'envoi jusqu'à ce que le nuage l'accepte (rien perdu, rien doublé) ;
//  PARTOUT : cibles ≥ 44 px, rien ne déborde, aucune erreur.
// Vues : 390 tactile sombre et clair, 1512 clair et sombre (MD_VUES=… pour en choisir).
// Lancer : construire dist/, puis node scripts/bancs/mode-depot.cjs   (BANC_PORT, SHOTS=dossier)
const path = require('path');
let PW;
try { PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')); }
catch (_) { PW = require('playwright'); }
const { lancer } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4593);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.MD_VUES ? process.env.MD_VUES.split(',') : null;
const MS = Date.now(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const jourDans = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;

// La session du banc : un jeton de la forme JWT (la porte hors ligne lit son `sub`).
const UID = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const JETON = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, aal: 'aal1', exp: Math.floor(MS / 1000) + 86400 })}.signature-de-banc`;
const SESSION = { access_token: JETON, refresh_token: 'r-mode-depot', expires_at: MS + J, totp: [], user: { id: UID, email: 'banc@vrm.test', totp: [] } };

const TITRE = 'Nike Air Max 90 blanche';
const vente = (id, k) => ({ transaction_id: id, title: TITRE, size_title: '42', user_login: `acheteur_${k}`, price: { amount: '50', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: iso(MS - J - k * 60000), photo: { url: url(k) } });
const VENTES = Array.from({ length: 8 }, (_, k) => vente(9201 + k, k + 1));
const SUIVI = Object.fromEntries(VENTES.map((v, k) => [v.transaction_id, `XA${100000001 + k}FR`]));
const TR = Object.fromEntries(VENTES.map((v, k) => [v.transaction_id, k % 3 === 2 ? 'Chronopost' : 'Mondial Relay']));
const CLE_TR = { 'Mondial Relay': 'mondialrelay', Chronopost: 'chronopost' };
const NUMS = Object.fromEntries(VENTES.map((v, k) => [String(v.transaction_id), { numero: String(31 + k) }]));
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const bord = (tx) => ({ id: 'email_bord_' + tx, data: { transaction: String(tx), uid: '111', filename: 'bordereau-' + tx + '.pdf', modele: TITRE, article: TITRE, receivedAt: iso(MS - 3600000), pdfB64: PDF_B64, suivi: SUIVI[tx], transporteurPdf: TR[tx] } });
const AU_RELAIS = 'Colis déposé en point relais';
const achat = (id, titre, k) => ({ transaction_id: id, conversation_id: 7000 + id % 1000, title: titre, size_title: '40', user_login: `vendeur_${k}`, price: { amount: '40', currency_code: 'EUR' }, status: AU_RELAIS, transaction_user_status: 'needs_action', date: iso(MS - 5 * J), photo: { url: url(20 + k) } });
const ACHATS = [achat(9302, 'New Balance 530 grise', 2), achat(9303, 'New Balance 530 grise', 3)];
const LIEU = 'Phone Cash, 12 rue du Port, 35260 Cancale';
const RELAIS = { 9302: { code: '555001', lieu: LIEU, transporteur: 'mondialrelay', at: iso(MS) }, 9303: { code: '555002', lieu: LIEU, transporteur: 'mondialrelay', at: iso(MS) } };
const TRACK = { id: 'email_track_mondialrelay_90000021', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '90000021', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis 90000021 est disponible', receivedAt: iso(MS - 0.3 * J), emailAt: iso(MS - 0.3 * J), arriveLe: iso(MS - 0.3 * J), code: '333333', lieu: 'TABAC DU QUAI, 12 Rue des Mouettes, 22000 Saint-Brieuc', limite: jourDans(4), consigne: false, account: 'compte_test', artTitle: 'Sac seau toile écrue' } };
const LIGNES = [
  { id: 'main', data: { rev: 1 } },
  ...VENTES.map((v) => bord(v.transaction_id)),
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS), payload: { my_orders: ACHATS } } },
  { id: 'panel_colis_relais', data: RELAIS },
  TRACK,
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
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${TEINTES[k % 6]}"/><text x="200" y="220" font-size="120" text-anchor="middle" fill="rgba(0,0,0,.35)" font-family="sans-serif">${k}</text></svg>`;

const ouvrir = async (b, vp, sombre, { sansCamera = false } = {}) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const etat = { horsLigne: false, requetesHL: [], ecritures: [] };
  pg.on('request', (q) => { if (etat.horsLigne && /\/rest\/v1\/|\/api\//.test(q.url()) && !/mode=confidentialite|\/auth\/v1\/token|\/auth\/v1\/settings|app_data\?select=owner&limit=1$/.test(q.url())) etat.requetesHL.push(q.method() + ' ' + q.url().slice(0, 120)); });
  await pg.addInitScript(({ sombre: s, nums, sess, uid, sansCam }) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        sessionStorage.setItem('banc_init', '1');
        if (!localStorage.getItem('vrm_session')) { localStorage.setItem('vrm_session', JSON.stringify(sess)); localStorage.setItem('vrm_local_owner', uid); }
        localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
        localStorage.setItem('vinted_sale_overrides', JSON.stringify(nums));
      }
    } catch (_) {}
    window.__wl = { demandes: 0, rendus: 0 };
    try { Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async (t) => { window.__wl.demandes++; const v = { type: t, released: false, addEventListener() {}, release: async () => { if (!v.released) { v.released = true; window.__wl.rendus++; } } }; return v; } } }); } catch (_) {}
    window.__file = []; window.__scan = (v) => { window.__file.push(v); }; window.__pistes = { ouvertes: 0, coupees: 0 };
    window.BarcodeDetector = class { static async getSupportedFormats() { return ['code_128', 'qr_code']; } constructor(o) { this.o = o; }
      async detect() { const v = window.__file.shift(); return v == null ? [] : [{ rawValue: v, format: 'code_128' }]; } };
    const gum = async () => {
      if (sansCam) throw new Error('NotFoundError');
      const c = document.createElement('canvas'); c.width = 320; c.height = 240; const x = c.getContext('2d'); x.fillStyle = '#888'; x.fillRect(0, 0, 320, 240);
      const f = c.captureStream(5); window.__pistes.ouvertes++; f.getTracks().forEach((t) => { const st = t.stop.bind(t); t.stop = () => { window.__pistes.coupees++; st(); }; }); return f;
    };
    try { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: gum }, configurable: true }); } catch (_) { navigator.mediaDevices.getUserMedia = gum; }
    window.print = () => {};
  }, { sombre: !!sombre, nums: NUMS, sess: SESSION, uid: UID, sansCam: sansCamera });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const m = /images1\.vinted\.net\/t\/b(\d+)\//.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(Number(m[1])) });
    if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(/\/auth\/v1\/user/.test(u) ? SESSION.user : { access_token: JETON, refresh_token: SESSION.refresh_token, expires_in: 86400, user: SESSION.user }) });
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    return ['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const h = { 'access-control-allow-origin': '*' };
    if (route.request().method() !== 'GET') { etat.ecritures.push({ m: route.request().method(), u, corps: route.request().postData() || '' }); return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' }); }
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { ...h, 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
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
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: /mode=abonnement/.test(r.request().url()) ? JSON.stringify({ ok: true, acces: true, statut: 'active', configure: true }) : '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, etat };
};

const lire = (pg, k) => pg.evaluate((cle) => { try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch (_) { return 'illisible'; } }, k);
const cles = (o) => Object.keys(o || {}).sort();
const depot = (pg) => pg.evaluate(() => {
  const f = document.querySelector('[data-depot]'); if (!f) return null;
  const res = document.querySelector('[data-depot-resultat]');
  const lignes = [...f.querySelectorAll('[data-depot-colis]')].map((e) => ({ cle: e.getAttribute('data-depot-colis'), etat: e.getAttribute('data-depot-etat'), groupe: e.closest('[data-depot-groupe]').getAttribute('data-depot-groupe') }));
  return { ordre: f.getAttribute('data-depot-ordre'), progres: f.getAttribute('data-depot-progres'), hl: f.getAttribute('data-depot-hors-ligne'), veille: f.getAttribute('data-depot-veille'), camera: f.getAttribute('data-depot-camera'),
    portail: f.parentElement === document.body && getComputedStyle(f).position === 'fixed', lignes, groupes: [...f.querySelectorAll('[data-depot-groupe]')].map((g) => ({ g: g.getAttribute('data-depot-groupe'), logo: !!g.querySelector('.vrm-depot-logo svg, .vrm-depot-logo img') })),
    res: res ? { etat: res.getAttribute('data-depot-resultat'), cle: res.getAttribute('data-depot-res-cle'), n: Number(res.getAttribute('data-depot-n')), texte: res.textContent } : null,
    file: (f.querySelector('[data-depot-file]') || { getAttribute: () => null }).getAttribute('data-depot-file'), vue: (f.querySelector('[data-depot-vue]') || {}).textContent || '',
    tout: !!document.querySelector('[data-depot-tout]'), compte: (f.querySelector('[data-depot-compte]') || {}).textContent || '' };
});
const scanner = async (pg, v) => {
  const n0 = (await depot(pg)).res ? (await depot(pg)).res.n : 0;
  await pg.evaluate((x) => window.__scan(x), v);
  await pg.waitForFunction((n) => Number((document.querySelector('[data-depot-resultat]') || { getAttribute: () => 0 }).getAttribute('data-depot-n')) > n, n0, { timeout: 6000 }).catch(() => {});
  return depot(pg);
};
const ligne = (d, cle) => (d.lignes.find((x) => x.cle === cle) || {}).etat;
const cibles = (pg, racine) => pg.evaluate((r) => [...document.querySelectorAll(`${r} button, ${r} a, ${r} input`)].filter((e) => e.getBoundingClientRect().width > 0 && !e.disabled).map((e) => ({ q: (e.getAttribute('aria-label') || e.textContent || e.placeholder || '').slice(0, 24), h: Math.round(e.getBoundingClientRect().height) })), racine);
const deborde = (pg, racine) => pg.evaluate((r) => { const s = document.querySelector(r); const w = window.innerWidth; const hors = s ? [...s.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > w + 1 || b.left < -1); }).map((e) => String(e.className).slice(0, 30)) : []; return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, hors: hors.slice(0, 4) }; }, racine);

async function enLigne(b, nom, vp, sombre) {
  console.log(`\n— Je dépose · en ligne · ${nom}`);
  const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
  const shot = async (q) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `mode-depot-${nom}-${q}.png`) }); };
  await essaie(`${nom} en ligne`, async () => {
    await pg.waitForFunction(() => document.querySelectorAll('[data-bord-card][data-tx-colis]').length >= 8, null, { timeout: 30000 }).catch(() => {});
    await pg.waitForSelector('[data-depot-ouvrir]', { timeout: 10000 }).catch(() => {});
    const ordreListe = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card][data-colis-ident]')].map((e) => e.getAttribute('data-colis-ident')));
    dit(ordreListe.length === 8, `${nom} : 8 colis à envoyer au même titre`, String(ordreListe.length));
    const bb = await pg.$('[data-depot-ouvrir]').then((e) => e && e.boundingBox());
    dit(bb && bb.height >= 44, `${nom} : D1 « Je dépose » est là (≥ 44 px)`, bb ? String(Math.round(bb.height)) : 'absent');
    await pg.click('[data-depot-ouvrir]');
    await pg.waitForSelector('[data-depot-colis]', { timeout: 8000 });
    await pg.waitForFunction(() => document.querySelector('[data-depot]').getAttribute('data-depot-camera') !== 'demarrage', null, { timeout: 6000 }).catch(() => {});
    let d = await depot(pg);
    dit(d.portail, `${nom} : D1 écran plein, en portail sur <body>`);
    dit(d.ordre === ordreListe.join(','), `${nom} : D1 les colis et leur ordre sont ceux de « À envoyer »`, JSON.stringify([d.ordre, ordreListe.join(',')]));
    const vus = d.lignes.map((x) => x.cle);
    dit(vus.length === 8 && new Set(vus).size === 8, `${nom} : D1 chaque colis UNE fois`, vus.join(','));
    const bonsGroupes = d.lignes.every((x) => x.groupe === CLE_TR[TR[Number(x.cle.slice(2))]]);
    const ordreGroupe = d.groupes.every((g) => { const L = d.lignes.filter((x) => x.groupe === g.g).map((x) => x.cle); return JSON.stringify(L) === JSON.stringify(ordreListe.filter((k) => L.includes(k))); });
    dit(d.groupes.length === 2 && bonsGroupes && ordreGroupe && d.groupes.every((g) => g.logo), `${nom} : D1 groupés par transporteur (logo), chaque groupe SES colis dans l'ordre de la liste`, JSON.stringify(d.groupes));
    dit(d.progres === '0/8' && /0 sur 8 déposés/.test(d.compte), `${nom} : D1 « 0 sur 8 déposés »`, d.compte);
    dit(d.veille === 'actif' && (await pg.evaluate(() => window.__wl.demandes)) === 1, `${nom} : D1 l'écran reste allumé (Wake Lock)`, d.veille);
    dit(d.camera === 'active', `${nom} : D1 la caméra lit les bordereaux`, d.camera);
    await shot('1-ouvert');
    // D2 : scanner 9203.
    d = await scanner(pg, SUIVI[9203]);
    dit(d.res && d.res.etat === 'trouve' && d.res.cle === 'v:9203' && ligne(d, 'v:9203') === 'attente' && d.progres === '1/8', `${nom} : D2 le bordereau de 9203 coche CE colis (annulable)`, JSON.stringify(d.res));
    dit(cles(await lire(pg, 'vinted_ship_done')).length === 0, `${nom} : D2 rien n'est écrit pendant les 5 s d'« Annuler »`);
    await shot('2-scan');
    // D3 : hors liste.
    d = await scanner(pg, 'XZ999999999FR');
    dit(d.res && d.res.etat === 'hors-liste' && /Pas dans tes colis à déposer/.test(d.res.texte), `${nom} : D3 un n° hors liste ⇒ « Pas dans tes colis à déposer »`, d.res && d.res.texte);
    await shot('3-hors-liste');
    await pg.waitForTimeout(5800);
    const sd = await lire(pg, 'vinted_ship_done'), bs = await lire(pg, 'vinted_bords_shipped');
    dit(JSON.stringify(cles(sd)) === '["9203"]' && cles(bs).length === 1 && cles(bs)[0].includes('9203'), `${nom} : D2/D3 écrit : la vente 9203 et son bordereau, rien d'autre`, JSON.stringify([sd, bs]));
    d = await depot(pg);
    dit(ligne(d, 'v:9203') === 'fait' && d.progres === '1/8', `${nom} : D2 le colis reste coché après ses 5 s`, JSON.stringify([ligne(d, 'v:9203'), d.progres]));
    // D4 : rescanné.
    await pg.waitForTimeout(2600);
    d = await scanner(pg, SUIVI[9203]);
    dit(d.res && d.res.etat === 'deja' && /Déjà déposé/.test(d.res.texte), `${nom} : D4 rescanné ⇒ « Déjà déposé »`, d.res && d.res.etat);
    // D5 : scanner 9204 puis Annuler.
    d = await scanner(pg, SUIVI[9204]);
    await pg.click('[data-depot-annuler="v:9204"]');
    await pg.waitForTimeout(5800);
    d = await depot(pg);
    dit(!cles(await lire(pg, 'vinted_ship_done')).includes('9204') && ligne(d, 'v:9204') === 'a-deposer' && d.progres === '1/8', `${nom} : D5 « Annuler » ⇒ rien d'écrit, le colis redevient à déposer`, JSON.stringify([cles(await lire(pg, 'vinted_ship_done')), ligne(d, 'v:9204')]));
    // D6 : saisie à la main.
    await pg.fill('[data-depot-saisie]', SUIVI[9206]); await pg.click('[data-depot-ok]');
    await pg.waitForTimeout(300); d = await depot(pg);
    dit(d.res && d.res.etat === 'trouve' && d.res.cle === 'v:9206', `${nom} : D6 le n° tapé à la main trouve le colis`, JSON.stringify(d.res));
    // D7 : tout le reste, touche par touche.
    for (const k of [9201, 9202, 9204, 9205, 9207, 9208]) { await pg.click(`[data-depot-deposer="v:${k}"]`); await pg.waitForTimeout(120); }
    d = await depot(pg);
    dit(d.tout && d.progres === '8/8', `${nom} : D7 tout coché ⇒ « Tout est déposé » plein écran`, d.progres);
    await shot('4-tout');
    const c = await cibles(pg, '[data-depot]');
    dit(c.length && c.every((x) => x.h >= 44), `${nom} : cibles ≥ 44 px`, JSON.stringify(c.filter((x) => x.h < 44)));
    const db = await deborde(pg, '[data-depot]');
    dit(db.page <= 1 && !db.hors.length, `${nom} : rien ne déborde`, JSON.stringify(db));
    await pg.waitForTimeout(5800);
    dit(cles(await lire(pg, 'vinted_ship_done')).length === 8, `${nom} : D7 les 8 colis sont écrits`, JSON.stringify(cles(await lire(pg, 'vinted_ship_done'))));
    await pg.click('[data-depot-fini]'); await pg.waitForTimeout(400);
    const wl = await pg.evaluate(() => ({ wl: window.__wl, p: window.__pistes }));
    dit(!(await pg.$('[data-depot]')) && wl.wl.rendus === 1 && wl.p.coupees >= 1, `${nom} : D7 fermé ⇒ Wake Lock rendu, caméra coupée`, JSON.stringify(wl));
  });
  dit(errs.length === 0, `${nom} : aucune erreur d'app`, errs.join(' | ').slice(0, 300));
  await ctx.close();
}

async function sansCamera(b, nom, vp, sombre) {
  console.log(`\n— Je dépose · sans caméra · ${nom}`);
  const { ctx, pg, errs } = await ouvrir(b, vp, sombre, { sansCamera: true });
  await essaie(`${nom} sans caméra`, async () => {
    await pg.waitForSelector('[data-depot-ouvrir]', { timeout: 30000 });
    await pg.click('[data-depot-ouvrir]');
    await pg.waitForSelector('[data-depot-sans-camera]', { timeout: 8000 }).catch(() => {});
    const r = await pg.evaluate(() => ({ sans: !!document.querySelector('[data-depot-sans-camera]'), focus: document.activeElement && document.activeElement.hasAttribute('data-depot-saisie') }));
    dit(r.sans && r.focus, `${nom} : D8 sans caméra ⇒ « tape le n° », la saisie prend la main`, JSON.stringify(r));
    if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `mode-depot-${nom}-5-sans-camera.png`) });
  });
  dit(errs.length === 0, `${nom} : aucune erreur d'app (sans caméra)`, errs.join(' | ').slice(0, 300));
  await ctx.close();
}

async function horsLigne(b, nom, vp, sombre) {
  console.log(`\n— Je dépose · hors ligne · ${nom}`);
  const { ctx, pg, errs, etat } = await ouvrir(b, vp, sombre);
  const shot = async (q) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `mode-depot-${nom}-${q}.png`) }); };
  await essaie(`${nom} hors ligne`, async () => {
    const clePhoto = 'vrm_hl_photo_' + UID;
    await pg.waitForFunction((k) => { try { const p = JSON.parse(localStorage.getItem(k) || 'null'); return p && p.envoyer && p.envoyer.length >= 8 && p.retirer && p.retirer.length >= 1; } catch (_) { return false; } }, clePhoto, { timeout: 30000 }).catch(() => {});
    const photo = await lire(pg, clePhoto);
    const env = (photo && photo.envoyer) || [];
    dit(env.length === 8 && env.every((e) => e.suivi === SUIVI[Number(e.tx)] && e.tr === CLE_TR[TR[Number(e.tx)]]), `${nom} : H1 la photo gardée porte le n° de suivi et le transporteur de chaque colis`, JSON.stringify(env.map((e) => [e.tx, e.suivi, e.tr])));
    await pg.waitForFunction(() => { try { const p = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); return p && Array.isArray(p.colis) && p.colis.length >= 3; } catch (_) { return false; } }, null, { timeout: 15000 }).catch(() => {});
    const pub = await lire(pg, 'vrm_colis_retirer'); const identsPub = (pub && pub.colis ? pub.colis.map((t) => t[3]) : []).sort();
    dit(identsPub.length === 3 && JSON.stringify((photo.retirer || []).map((r) => r.id).sort()) === JSON.stringify(identsPub), `${nom} : H1 la photo porte l'identité publiée de chaque colis à retirer`, JSON.stringify([identsPub, (photo.retirer || []).map((r) => r.id)]));
    await pg.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
    await pg.waitForFunction((u) => !!localStorage.getItem('vrm_porte_ok_' + u) && !!localStorage.getItem('vrm_abo_dernier_' + u), UID, { timeout: 15000 }).catch(() => {});
    // Une ouverture SOUS le service worker (il garde les fichiers de l'app qu'il sert), comme sur l'iPhone.
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-depot-ouvrir]', { timeout: 30000 }).catch(() => {});
    await pg.waitForTimeout(1500);
    // À FROID, réseau coupé.
    etat.horsLigne = true;
    await ctx.setOffline(true);
    await pg.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await pg.waitForSelector('[data-depot-ouvrir="hors-ligne"]', { timeout: 20000 }).catch(() => {});
    const froid = await pg.evaluate(() => !!document.querySelector('[data-hors-ligne-froid]'));
    dit(froid, `${nom} : H2 l'app rouverte à froid, en lecture seule (lot D)`);
    dit(!!(await pg.$('[data-depot-ouvrir="hors-ligne"]')), `${nom} : H2 « Je dépose » est offert hors ligne`);
    await pg.click('[data-depot-ouvrir="hors-ligne"]');
    await pg.waitForSelector('[data-depot-colis]', { timeout: 8000 });
    let d = await depot(pg);
    const hh = new Date(photo.at); const vueAttendue = `vue à ${String(hh.getHours()).padStart(2, '0')}:${String(hh.getMinutes()).padStart(2, '0')}`;
    dit(d.hl === '1' && d.lignes.length === 8 && d.vue.includes(vueAttendue) && /Hors ligne/.test(d.vue), `${nom} : H2 les colis de la photo, datés « ${vueAttendue} », jamais frais`, JSON.stringify([d.hl, d.lignes.length, d.vue]));
    await shot('6-hors-ligne');
    // H3 : scanner 9201.
    d = await scanner(pg, SUIVI[9201]);
    await pg.waitForTimeout(800); d = await depot(pg);
    const sd = await lire(pg, 'vinted_ship_done'); const file = await lire(pg, 'vrm_file_envoi');
    dit(d.res && d.res.etat === 'trouve' && ligne(d, 'v:9201') === 'attente' && d.file === '1' && d.progres === '1/8', `${nom} : H3 scanné ⇒ coché, « 1 dépôt à envoyer »`, JSON.stringify([d.res, ligne(d, 'v:9201'), d.file]));
    dit(sd && JSON.stringify(cles(sd)) === '["9201"]' && file && file.cles && file.cles.vinted_ship_done, `${nom} : H3 gardé sur l'appareil, dans la file d'envoi (clé = n° de transaction)`, JSON.stringify([sd, file && Object.keys(file.cles || {})]));
    await shot('7-hors-ligne-coche');
    await pg.waitForTimeout(2600);
    d = await scanner(pg, SUIVI[9201]);
    dit(d.res && d.res.etat === 'deja' && JSON.stringify(cles(await lire(pg, 'vinted_ship_done'))) === '["9201"]', `${nom} : H3 rescanné ⇒ « Déjà déposé », rien ne double`, d.res && d.res.etat);
    d = await scanner(pg, 'XZ999999999FR');
    dit(d.res && d.res.etat === 'hors-liste' && JSON.stringify(cles(await lire(pg, 'vinted_ship_done'))) === '["9201"]', `${nom} : H3 hors liste ⇒ rien d'écrit`, d.res && d.res.etat);
    const c = await cibles(pg, '[data-depot]');
    dit(c.length && c.every((x) => x.h >= 44), `${nom} : cibles ≥ 44 px (hors ligne)`, JSON.stringify(c.filter((x) => x.h < 44)));
    await pg.click('[data-depot-fermer]'); await pg.waitForTimeout(300);
    // H4 : le mode relais hors ligne, depuis la photo.
    await pg.waitForSelector('[data-relais-ouvrir="photo"]', { timeout: 6000 }).catch(() => {});
    if (await pg.$('[data-relais-ouvrir="photo"]')) {
      await pg.click('[data-relais-ouvrir="photo"]'); await pg.waitForSelector('[data-relais]', { timeout: 6000 });
      const r = await pg.evaluate(() => { const f = document.querySelector('[data-relais]'); return { hl: f.getAttribute('data-relais-hors-ligne'), idents: (f.getAttribute('data-relais-idents') || '').split(',').filter(Boolean).sort(), vue: (document.querySelector('[data-relais-vue]') || {}).textContent || '', code: (document.querySelector('[data-relais-code]') || { getAttribute: () => '' }).getAttribute('data-relais-code'), veille: f.getAttribute('data-relais-veille') }; });
      dit(r.hl === '1' && JSON.stringify(r.idents) === JSON.stringify(identsPub) && /codes vus à/.test(r.vue) && /^\d{6}$/.test(r.code) && r.veille === 'actif', `${nom} : H4 mode relais hors ligne : les identités publiées, « codes vus à », le code, écran allumé`, JSON.stringify(r));
      await shot('8-relais-hors-ligne');
      await pg.click('[data-relais-fermer]');
    } else dit(false, `${nom} : H4 « Mode relais » offert hors ligne`);
    dit(etat.requetesHL.length === 0, `${nom} : H2-H4 aucune requête vers la base ni /api/ hors ligne`, etat.requetesHL.slice(0, 3).join(' | '));
    // H5 : le réseau revient. L'app vérifie, se REMONTE (lot D) et relit tout : le dépôt noté hors ligne
    // compte (le colis sort de « À envoyer »), une seule fois (clé = n° de transaction) ; il reste dans la
    // file d'envoi tant que le nuage ne l'a pas ACCEPTÉ (« pas su » ≠ « envoyé » — src/fileEnvoi.js, banc
    // file-envoi.cjs) : rien n'est perdu, rien ne double.
    etat.horsLigne = false;
    await ctx.setOffline(false);
    await pg.evaluate(() => window.dispatchEvent(new Event('online'))).catch(() => {});
    const apres = async () => { try { return await pg.evaluate(() => ({ froid: !!document.querySelector('[data-hors-ligne-froid]'), cartes: [...document.querySelectorAll('[data-bord-card][data-tx-colis]')].map((e) => e.getAttribute('data-tx-colis')) })); } catch (_) { return null; } };
    let a = null;
    for (let t = 0; t < 60; t++) { a = await apres(); if (a && !a.froid && a.cartes.length >= 7) break; await new Promise((r) => setTimeout(r, 500)); }
    await pg.waitForTimeout(1000); a = await apres();
    const sdApres = await lire(pg, 'vinted_ship_done').catch(() => null); const fileApres = await lire(pg, 'vrm_file_envoi').catch(() => null);
    const garde = !!(fileApres && fileApres.cles && fileApres.cles.vinted_ship_done);
    dit(a && !a.froid && a.cartes.length === 7 && !a.cartes.includes('9201') && JSON.stringify(cles(sdApres)) === '["9201"]',
      `${nom} : H5 le réseau revient ⇒ le dépôt compte une fois (9201 sort de « À envoyer »), ${garde ? 'gardé dans la file jusqu’à l’accord du nuage' : 'envoyé'}`, JSON.stringify({ a, sd: cles(sdApres), file: fileApres && Object.keys(fileApres.cles || {}) }));
  });
  dit(errs.filter((e) => !/Failed to fetch|NetworkError|vrm-hors-ligne/.test(e)).length === 0, `${nom} : aucune erreur d'app (hors ligne)`, errs.join(' | ').slice(0, 300));
  await ctx.close();
}

(async () => {
  let b;
  try {
    b = await lancer(PW, { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [nom, vp, sombre] of [['390-sombre', { width: 390, height: 844 }, true], ['390-clair', { width: 390, height: 844 }, false], ['1512-clair', { width: 1512, height: 950 }, false], ['1512-sombre', { width: 1512, height: 950 }, true]]) {
      if (VUES && !VUES.includes(nom)) continue;
      await enLigne(b, nom, vp, sombre);
      if (nom === '1512-clair') await sansCamera(b, nom, vp, sombre);
      if (nom === '390-sombre' || nom === '1512-clair') await horsLigne(b, nom, vp, sombre);
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\nKO mode-depot : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK mode-depot : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
