// Banc : « CHANGER LE PRIX » EN UN GESTE (19 nov., extension 5.409 — `prixattente`).
// Décision de Julien (capture de son iPhone, N°134, 59 → 58) : « c'est à l'extension de baisser les
// prix, c'est pas à moi ». Données INVENTÉES, le vrai build (dist), un faux pont d'extension.
//   A. Extension à jour sur le bon compte : il tape 58, touche « Appliquer » ⇒ UNE commande
//      `baisserPrixVinted` (prix vu joint, confirmée), aucun second bouton, la feuille se FERME.
//   B. Pas d'extension ici (iPhone) : « Appliquer » range UNE ligne `cmd_prix_*` et la feuille se
//      ferme ; rouverte, la rangée dit « 58 € · En attente : partira dès que Vinted est ouvert sur
//      compte_un » avec « Annuler » (qui annule la ligne). Jamais de bouton de baisse.
//   C. Quelque chose à LIRE : le prix a changé sur Vinted (refus dit, prix lu) ; une hausse
//      (« Hausse à faire sur Vinted » + « Ouvrir », aucune commande) ⇒ la feuille RESTE ouverte,
//      le plein dit toujours « Appliquer ».
//   D. Quatre sites, prix à 4 chiffres et décimales : rien ne se chevauche, rien ne déborde.
//   Partout : un seul plein, cibles ≥ 44, contrastes ≥ 4,5:1, prix actuel → nouveau sur UNE ligne.
// 390 × 844 tactile et 1512 ; THEMES=clair,sombre ; SHOTS=dossier pour garder les captures.
// §6.1 : sur un build d'avant, la rangée Vinted passe « proposé » avec son second bouton ⇒ rouge.
require('../_source-app.cjs').brancher();
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4437;
const SHOTS = process.env.SHOTS || '';
const THEMES = (process.env.THEMES || 'clair,sombre').split(',');
const LARGEURS = (process.env.LARGEURS || '390,1512').split(',').map(Number);
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.409.0';
const M = Date.now(), iso = (t) => new Date(t).toISOString();
const FICHES = {
  6134: { numero: '134', title: 'Nike P-6000 noir taille 39', accountId: '111', price: '59', photo: '', numberedAt: iso(M - 15 * 864e5) },
  6311: { numero: '311', title: 'Asics Gel-Kayano 14 crème taille 42', accountId: '111', price: '95', photo: '', numberedAt: iso(M - 20 * 864e5) },
  6207: { numero: '207', title: 'New Balance 990v5 Made in USA grise taille 44,5 édition limitée', accountId: '111', price: '1250', photo: '', numberedAt: iso(M - 30 * 864e5) },
};
const ann = (id, titre, prix) => ({ id, title: titre, price: { amount: prix, currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: 'Nike', size_title: '39', status: 'Très bon état', view_count: 150, favourite_count: 14, created_at_ts: Math.floor(M / 1000) - 15 * 86400 });
const LISTINGS = [ann(6134, FICHES[6134].title, '59.0'), ann(6207, FICHES[6207].title, '1250.0'), ann(6311, FICHES[6311].title, '95.0')];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_un', domain: 'www.vinted.fr', updated_at: iso(M) }];
const basesDe = ({ relais = true } = {}) => ([
  // Le battement de l'extension de l'ordinateur (`relais_ext`) : sa version dit si elle sait relever les prix en attente.
  ...(relais ? [{ id: 'relais_ext', data: { at: iso(M), atMs: M, ver: VERSION, code: VERSION, vUid: '', vLogin: '', pauseJusqua: 0 } }] : []),
  { id: 'main', data: { vinted_annonce_numeros: FICHES, vinted_used_numeros: ['134', '207', '311'] } },
  { id: 'harvest_111_listings', data: { capturedAt: iso(M - 600e3), payload: { items: LISTINGS, pagination: { total_entries: LISTINGS.length } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(M), payload: { my_orders: [] } } },
  { id: 'ebay_listings', data: { capturedAt: iso(M), items: [{ itemId: '55207', sku: 'VRM-207', title: FICHES[6207].title, price: '1289.90', currency: 'EUR', depuis: iso(M - 4 * 864e5) }] } },
  { id: 'lbc_listings', data: { updatedAt: iso(M), items: { 2890011207: { subject: FICHES[6207].title, customRef: 'VRM-207', price: 1240, status: 'active', url: 'https://www.leboncoin.fr/ad/chaussures/2890011207' } } } },
  { id: 'vc_listings', data: { updatedAt: iso(M), items: { 55012207: { titre: FICHES[6207].title, statut: 'published', prix: { valeur: 1299.5, cle: 'price', devise: 'EUR' }, compte: 'vc1' } }, liens: { 55012207: '207' } } },
  // Le « format appris » (le corps que Vinted a accepté pour l'annonce) : 6134 et 6207 l'ont, 6311 jamais.
  { id: 'vrm_vinted_modele', data: { 6134: { corps: '{}', at: iso(M - 864e5), uid: '111' }, 6207: { corps: '{}', at: iso(M - 864e5), uid: '111' } } },
  { id: 'lbc_prix_recette', data: { appris: true, raison: '', at: iso(M) } },
  { id: 'vc_prix_recette', data: { appris: true, raison: '', at: iso(M) } },
]);
// Le faux pont : une extension à jour, connectée sur compte_un. `o.reponse` : ce que répond la baisse.
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.__cmds = [];
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_un' }, cmds: {} } });
    if (d.__vmr === 'cmd') {
      window.__cmds.push(JSON.parse(JSON.stringify(d)));
      let resp = { accepte: true, etape: 'recent' };
      if (d.cmd === 'baisserPrixVinted') resp = o.reponse === 'change' ? { accepte: false, code: 'prix-change', prixVu: 55, raison: 'sur Vinted le prix est maintenant 55 € : rien n’est parti' }
        : { accepte: true, etape: 'fait', ancien: d.prixAvant, voulu: d.prix, prixVu: d.prix, nouveau: d.prix };
      if (d.cmd === 'lbcPrix') resp = { accepte: true, etape: 'fait', prixVu: d.prix };
      if (d.cmd === 'vcPrix') resp = { accepte: false, code: 'vc-absent', raison: 'ouvre vestiairecollective.com' };
      setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp }), o.delai || 350);
    }
  });
  post({ __vmr: 'ready', version: o.version });
};
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg.replace(/^"|"$/g, '')];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};

async function rendre(b, vp, { sombre = false, pont = null, relais = true } = {}) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', deviceScaleFactor: vp.width < 600 ? 2 : 1, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ROWS = basesDe({ relais });
  const ecrits = { posts: [], patchs: [] }; pg.ecrits = ecrits; pg.ROWS = ROWS;
  await pg.addInitScript(({ n, s }) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); if (s) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, { n: FICHES, s: sombre });
  if (pont) await pg.addInitScript(PONT, pont);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const rq = route.request(), u = decodeURIComponent(metaVersData(rq.url())), meth = rq.method();
    const j = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    // Les lignes `cmd_prix_*` : une base À ÉTAT (ce qui est écrit se relit, l'écriture conditionnelle tient).
    if (meth === 'POST') {
      let rows = []; try { rows = JSON.parse(rq.postData() || '[]'); } catch (_) {}
      for (const r of (Array.isArray(rows) ? rows : [])) if (r && /^cmd_prix_/.test(String(r.id))) { ecrits.posts.push(r.id); const i = ROWS.findIndex((x) => x.id === r.id); if (i >= 0) ROWS[i] = { id: r.id, data: r.data }; else ROWS.push({ id: r.id, data: r.data }); }
      return j([], 201);
    }
    if (meth === 'PATCH') {
      const r = eq && ROWS.find((x) => x.id === eq[1]);
      const cond = (/data->>etat=eq\.([^&]+)/.exec(u) || [])[1];
      let corps = {}; try { corps = JSON.parse(rq.postData() || '{}'); } catch (_) {}
      if (!r || !/^cmd_prix_/.test(r.id) || (cond && r.data.etat !== cond)) return j([]);
      ecrits.patchs.push({ id: r.id, etat: corps.data && corps.data.etat }); r.data = corps.data;
      return j([{ id: r.id }]);
    }
    if (meth !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data$/.test(sel) && sel !== 'data') ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(M), cap: r.data.capturedAt });
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const dans = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) {
      const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');
      let rows = ROWS.filter((r) => re.test(r.id));
      const cles = /data->>cle=in\.\(([^)]*)\)/.exec(u);
      if (cles) { const l = cles[1].split(',').map((x) => x.replace(/^"|"$/g, '')); rows = rows.filter((r) => l.includes(String(r.data.cle))); }
      const et = /data->>etat=eq\.([^&]+)/.exec(u); if (et) rows = rows.filter((r) => String(r.data.etat) === et[1]);
      return j(rows.sort((a, b) => b.id.localeCompare(a.id)).map(forme));
    }
    return j([]);
  });
  const corpsEbay = []; pg.corpsEbay = corpsEbay;
  await pg.route('**/api/**', (r) => {
    const u = r.request().url(); let bd = null; try { bd = JSON.parse(r.request().postData() || 'null'); } catch (_) {}
    if (/\/api\/ebay/.test(u) && bd && bd.action === 'revise') { corpsEbay.push(bd); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, regle: { lecture: { prix: Number(bd.price) } } }) }); }
    if (/\/api\/ebay/.test(u) && bd && bd.action === 'comptes') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, comptes: [{ id: 'principal' }] }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3000);
  return { ctx, pg, errs };
}
async function ouvrir(pg, num) {
  await pg.evaluate((n) => window.dispatchEvent(new CustomEvent('vrm:prix-partout', { detail: n })), num);
  await pg.waitForSelector('[data-prix-partout]', { timeout: 15000 });
  for (let i = 0; i < 80; i++) { if (!(await pg.$('[data-prix-lecture]'))) break; await pg.waitForTimeout(250); }
  await pg.waitForTimeout(400);
}
const ferme = async (pg) => { for (let i = 0; i < 60; i++) { if (!(await pg.$('[data-prix-partout]'))) return true; await pg.waitForTimeout(150); } return false; };
// La mesure de la feuille : géométrie, cibles, contrastes — jamais un libellé.
const mesurer = (pg) => pg.evaluate(() => {
  const f = document.querySelector('[role="dialog"][data-prix-partout]'); if (!f) return null;   // (19 nov.) la Feuille du natif porte l'attribut
  const R = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const croise = (a, b) => a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;
  // Les boîtes de TEXTE (au glyphe près : `Range`), par rangée.
  const boites = (el) => { const out = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) if (r.width > 0.5 && r.height > 0.5) out.push({ x: r.left, y: r.top, r: r.right, b: r.bottom, t: n.textContent.trim().slice(0, 24), p: n.parentElement }); } return out; };
  const chevauchements = [];
  const tous = boites(f);
  for (let i = 0; i < tous.length; i++) for (let k = i + 1; k < tous.length; k++) { const a = tous[i], b = tous[k]; if (a.p === b.p) continue; if (croise(a, b)) chevauchements.push(a.t + ' ⨯ ' + b.t); }
  const fr = R(f);
  const hors = tous.filter((a) => a.x < fr.x - 0.5 || a.r > fr.r + 0.5).map((a) => a.t);
  const cibles = [...f.querySelectorAll('button, a')].map((el) => ({ t: (el.textContent || el.getAttribute('aria-label') || el.className).trim().slice(0, 20), ...R(el) })).filter((c) => c.h > 0);
  const lum = (c) => { const m = /rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?/.exec(c) || []; const v = [m[1], m[2], m[3]].map((x) => { x = Number(x) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return { l: 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2], a: m[4] == null ? 1 : Number(m[4]) }; };
  const fondDe = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (lum(c).a > 0.95) return c; } return 'rgb(255, 255, 255)'; };
  const contrastes = [];
  for (const el of f.querySelectorAll('.pp-site, .pp-prix, .pp-prix b, .pp-etat, [data-prix-annuler], .pp-plein:not([aria-disabled]), .n-feuille-titre, .n-bouton-raison, .pp-champ > span:first-child, .pp-mini, .n-vide')) {
    if (!el.textContent.trim() || el.closest(':disabled') || el.closest('[aria-disabled]')) continue;
    const a = lum(getComputedStyle(el).color).l, b = lum(fondDe(el)).l;
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    contrastes.push({ t: el.textContent.trim().slice(0, 24), c: el.className, ratio: Math.round(ratio * 100) / 100 });
  }
  const lignes = [...f.querySelectorAll('[data-prix-site]')].map((li) => {
    const pl = li.querySelector('[data-prix-ligne]'), et = li.querySelector('.pp-etat'), si = li.querySelector('.pp-site');
    const rp = pl ? [...(() => { const rg = document.createRange(); rg.selectNodeContents(pl); return rg.getClientRects(); })()].filter((r) => r.width > 0.5) : [];
    const hautes = new Set(rp.map((r) => Math.round(r.top)));
    return { cle: li.getAttribute('data-prix-cle'), etat: li.getAttribute('data-prix-etat'), mode: li.getAttribute('data-prix-mode'), prix: pl ? pl.textContent : '', uneLigne: hautes.size <= 1,
      phrase: et ? et.textContent : '', sorte: et ? et.getAttribute('data-prix-phrase') : '', dessous: !et || !pl || R(et).y >= Math.max(R(pl).b, si ? R(si).b : 0) - 1,
      annuler: !!f.querySelector(`[data-prix-annuler-cle="${li.getAttribute('data-prix-cle')}"]`), lien: li.hasAttribute('data-prix-lien'), boutons: li.querySelectorAll('button').length };
  });
  const plein = [...f.querySelectorAll('.pp-plein')];
  return { chevauchements, hors, petites: cibles.filter((c) => c.h < 43.5 || c.w < 43.5).map((c) => c.t + ' ' + Math.round(c.w) + '×' + Math.round(c.h)), faibles: contrastes.filter((c) => c.ratio < 4.5),
    lignes, pleins: plein.length, pleinTexte: plein[0] ? plein[0].textContent.trim() : '', pleinH: plein[0] ? Math.round(R(plein[0]).h) : 0,
    proposer: f.querySelectorAll('[data-prix-proposer]').length, texte: f.innerText, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    feuilleDansEcran: fr.x >= -0.5 && fr.r <= window.innerWidth + 0.5 && fr.b <= window.innerHeight + 0.5 };
});
const commun = (T, m, quoi) => {
  if (!m) { dit(false, `${T} ${quoi} : la feuille est là`); return; }
  dit(m.chevauchements.length === 0, `${T} ${quoi} : aucun texte n’en chevauche un autre`, m.chevauchements.slice(0, 4).join(' | '));
  dit(m.hors.length === 0 && m.sw <= m.cw && m.feuilleDansEcran, `${T} ${quoi} : rien ne déborde de la feuille ni de l’écran`, m.hors.slice(0, 3).join(' | '));
  dit(m.petites.length === 0, `${T} ${quoi} : chaque cible fait au moins 44 × 44`, m.petites.join(' | '));
  dit(m.faibles.length === 0, `${T} ${quoi} : contrastes ≥ 4,5:1`, m.faibles.slice(0, 3));
  dit(m.pleins === 1 && m.pleinH >= 50, `${T} ${quoi} : UN seul plein (50 px)`, { n: m.pleins, h: m.pleinH });
  dit(m.proposer === 0 && m.lignes.every((l) => l.boutons <= 1), `${T} ${quoi} : aucun bouton de baisse sur une rangée (au plus « Annuler »)`);
  dit(m.lignes.every((l) => l.uneLigne && l.dessous), `${T} ${quoi} : prix actuel → nouveau prix sur UNE ligne, l’état DESSOUS`, m.lignes.filter((l) => !l.uneLigne || !l.dessous).map((l) => l.cle));
};
const shot = async (pg, nom) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); } };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const largeur of LARGEURS) for (const theme of THEMES) {
      const vp = largeur < 600 ? { width: 390, height: 844 } : { width: largeur, height: 950 };
      const sombre = theme === 'sombre';
      const T = `[${largeur} ${theme}]`, N = `${largeur}-${theme}`;
      console.log('── ' + T);
      // ── A. Extension à jour, bon compte : un geste, la feuille se ferme ──
      await essaie(T + ' A', async () => {
        const { ctx, pg, errs } = await rendre(b, vp, { sombre, pont: { version: VERSION, reponse: 'fait', delai: 900 } });
        await ouvrir(pg, '134');
        await pg.fill('[data-prix-champ]', '58');
        await pg.waitForTimeout(200);
        const av = await mesurer(pg);
        await shot(pg, `A-${N}-1-saisie`);
        commun(T, av, 'A saisie');
        const v = av && av.lignes.find((l) => l.cle === 'vinted:6134');
        dit(v && v.mode === 'ext' && /59\s€\s→\s58\s€/.test(v.prix), `${T} A la rangée Vinted dit « 59 € → 58 € » (par l’extension)`, v);
        await pg.click('[data-prix-appliquer]');
        await pg.waitForTimeout(250);
        const pendant = await mesurer(pg);
        await shot(pg, `A-${N}-2-envoi`);
        if (pendant) { commun(T, pendant, 'A envoi'); dit(pendant.lignes.some((l) => l.etat === 'envoi') && pendant.pleins === 1, `${T} A pendant l’envoi : la rangée dit « Envoi… », aucun second geste`, pendant.lignes.map((l) => l.etat)); }
        dit(await ferme(pg), `${T} A tout est fait ⇒ la feuille se FERME toute seule`);
        await pg.waitForTimeout(300);
        await shot(pg, `A-${N}-3-ferme`);
        const cmds = await pg.evaluate(() => (window.__cmds || []).filter((c) => /Prix|prix/.test(c.cmd)));
        const c = cmds[0] || {};
        dit(cmds.length === 1 && c.cmd === 'baisserPrixVinted' && c.uid === '111' && String(c.id) === '6134' && c.prix === 58 && c.prixAvant === 59 && c.confirme === true, `${T} A UNE commande \`baisserPrixVinted\` (58, prix vu 59, confirmée) — pas de second geste`, cmds);
        dit(pg.ecrits.posts.length === 0, `${T} A rien n’est rangé en attente quand l’extension a agi`, pg.ecrits.posts);
        dit(errs.length === 0, `${T} A aucune erreur de page`, errs.slice(0, 2));
        await ctx.close();
      });
      // ── B. Pas d'extension ici : la baisse ATTEND ──
      await essaie(T + ' B', async () => {
        const { ctx, pg, errs } = await rendre(b, vp, { sombre });
        await ouvrir(pg, '134');
        await pg.fill('[data-prix-champ]', '58');
        await pg.click('[data-prix-appliquer]');
        dit(await ferme(pg), `${T} B en attente ⇒ la feuille se ferme toute seule`);
        const p1 = pg.ecrits.posts.slice();
        const ligne = pg.ROWS.find((r) => /^cmd_prix_/.test(r.id)) || { data: {} };
        const d = ligne.data, a = d.args || {};
        dit(p1.length === 1 && d.etat === 'attente' && d.site === 'vinted' && d.confirme === true && a.uid === '111' && String(a.id) === '6134' && a.prix === 58 && a.prixAvant === 59 && d.expire - d.demandeLe === 24 * 3600000 && d.num === '134',
          `${T} B UNE ligne \`cmd_prix_*\` rangée : une annonce, 58, prix vu 59, confirmée, périmée à 24 h`, { n: p1.length, d });
        await pg.waitForTimeout(400);
        await shot(pg, `B-${N}-1-ferme`);
        await ouvrir(pg, '134');
        await pg.waitForFunction(() => !!document.querySelector('[data-prix-annuler]'), null, { timeout: 8000 }).catch(() => {});
        const m = await mesurer(pg);
        await shot(pg, `B-${N}-2-attente`);
        commun(T, m, 'B attente');
        const v = m && m.lignes.find((l) => l.cle === 'vinted:6134');
        dit(v && v.etat === 'attente' && v.annuler && /compte_un/.test(v.phrase) && /58/.test(v.phrase), `${T} B rouverte : « 58 € · en attente … sur compte_un », avec « Annuler » (aucun bouton de baisse)`, v);
        dit(m && m.pleinTexte.length > 0 && !/nouveau/i.test(m.pleinTexte), `${T} B le plein ne dit jamais « … à nouveau »`, m && m.pleinTexte);
        await pg.click('[data-prix-annuler]');
        await pg.waitForFunction(() => !document.querySelector('[data-prix-annuler]'), null, { timeout: 8000 }).catch(() => {});
        const m2 = await mesurer(pg);
        await shot(pg, `B-${N}-3-annulee`);
        dit(ligne.data.etat === 'annulee' && m2 && m2.lignes.find((l) => l.cle === 'vinted:6134').etat === '', `${T} B « Annuler » annule la ligne (un toucher), la rangée redevient neutre`, ligne.data.etat);
        dit(errs.length === 0, `${T} B aucune erreur de page`, errs.slice(0, 2));
        await ctx.close();
      });
      // ── B bis. Aucune extension connue qui sache relever l'attente : la phrase le DIT (jamais « partira dès que… » à tort) ──
      await essaie(T + ' B2', async () => {
        const { ctx, pg } = await rendre(b, vp, { sombre, relais: false });
        await ouvrir(pg, '134');
        await pg.fill('[data-prix-champ]', '58');
        await pg.click('[data-prix-appliquer]');
        await ferme(pg);
        await ouvrir(pg, '134');
        await pg.waitForFunction(() => !!document.querySelector('[data-prix-annuler]'), null, { timeout: 8000 }).catch(() => {});
        const m = await mesurer(pg);
        await shot(pg, `B2-${N}-attente-maj`);
        commun(T, m, 'B2 attente (extension à mettre à jour)');
        const v = m && m.lignes.find((l) => l.cle === 'vinted:6134');
        dit(v && v.etat === 'attente' && !/compte_un/.test(v.phrase) && v.annuler, `${T} B2 aucune extension 5.409 connue ⇒ la phrase dit de la mettre à jour (pas « partira dès que… »)`, v);
        await ctx.close();
      });
      // ── C. Quelque chose à LIRE : refus (prix changé), puis hausse ──
      await essaie(T + ' C', async () => {
        const { ctx, pg, errs } = await rendre(b, vp, { sombre, pont: { version: VERSION, reponse: 'change', delai: 300 } });
        await ouvrir(pg, '134');
        await pg.fill('[data-prix-champ]', '58');
        await pg.click('[data-prix-appliquer]');
        await pg.waitForFunction(() => { const l = document.querySelector('[data-prix-cle="vinted:6134"]'); return l && l.getAttribute('data-prix-etat') === 'refuse'; }, null, { timeout: 10000 }).catch(() => {});
        const m = await mesurer(pg);
        await shot(pg, `C-${N}-1-refus`);
        commun(T, m, 'C refus');
        const v = m && m.lignes.find((l) => l.cle === 'vinted:6134');
        dit(!!m && v && v.etat === 'refuse' && /55/.test(v.phrase) && v.lien, `${T} C le prix a changé sur Vinted ⇒ la feuille RESTE, la rangée dit le prix lu (55 €), rien n’est rangé`, v);
        dit(pg.ecrits.posts.length === 0 && m && !/nouveau/i.test(m.pleinTexte), `${T} C … le plein dit toujours la même chose, aucune ligne en attente`, m && m.pleinTexte);
        await pg.fill('[data-prix-champ]', '65');
        const n0 = await pg.evaluate(() => (window.__cmds || []).length);
        await pg.click('[data-prix-appliquer]');
        await pg.waitForFunction(() => { const l = document.querySelector('[data-prix-cle="vinted:6134"]'); return l && l.getAttribute('data-prix-etat') === 'hausse'; }, null, { timeout: 10000 }).catch(() => {});
        const h = await mesurer(pg);
        await shot(pg, `C-${N}-2-hausse`);
        commun(T, h, 'C hausse');
        const vh = h && h.lignes.find((l) => l.cle === 'vinted:6134');
        const n1 = await pg.evaluate(() => (window.__cmds || []).length);
        dit(vh && vh.etat === 'hausse' && vh.lien && !vh.annuler && n1 === n0 && pg.ecrits.posts.length === 0, `${T} C une hausse ⇒ « à faire sur Vinted » + « Ouvrir », AUCUNE commande, aucune ligne`, { vh, cmds: n1 - n0 });
        dit(errs.length === 0, `${T} C aucune erreur de page`, errs.slice(0, 2));
        await ctx.close();
      });
      // ── E. Une annonce dont VRM n'a jamais appris le format : dit AVANT d'appliquer, aucune commande ──
      await essaie(T + ' E', async () => {
        const { ctx, pg, errs } = await rendre(b, vp, { sombre, pont: { version: VERSION, reponse: 'fait', delai: 300 } });
        await ouvrir(pg, '311');
        await pg.waitForFunction(() => { const l = document.querySelector('[data-prix-cle="vinted:6311"]'); return l && l.getAttribute('data-prix-mode') === 'site'; }, null, { timeout: 8000 }).catch(() => {});
        await pg.fill('[data-prix-champ]', '89');
        await pg.waitForTimeout(200);
        const m = await mesurer(pg);
        await shot(pg, `E-${N}-format-jamais-appris`);
        commun(T, m, 'E format jamais appris');
        const v = m && m.lignes.find((l) => l.cle === 'vinted:6311');
        dit(v && v.mode === 'site' && v.sorte === 'a-faire' && v.lien && v.phrase.length > 10, `${T} E format jamais appris ⇒ la rangée le dit avant « Appliquer », avec « Ouvrir »`, v);
        await pg.click('[data-prix-appliquer]');
        await pg.waitForTimeout(600);
        const cmds = await pg.evaluate(() => (window.__cmds || []).filter((c) => /Prix|prix/.test(c.cmd)).length);
        dit(cmds === 0 && pg.ecrits.posts.length === 0 && !!(await pg.$('[data-prix-partout]')), `${T} E … « Appliquer » n’envoie rien et ne range rien pour elle ; la feuille reste (quelque chose à lire)`, { cmds, posts: pg.ecrits.posts.length });
        dit(errs.length === 0, `${T} E aucune erreur de page`, errs.slice(0, 2));
        await ctx.close();
      });
      // ── D. Quatre sites, prix longs : rien ne se chevauche ──
      await essaie(T + ' D', async () => {
        const { ctx, pg, errs } = await rendre(b, vp, { sombre, pont: { version: VERSION, reponse: 'fait', delai: 300 } });
        await ouvrir(pg, '207');
        await pg.fill('[data-prix-champ]', '1199,50');
        await pg.waitForTimeout(200);
        const m = await mesurer(pg);
        await shot(pg, `D-${N}-1-quatre-sites`);
        commun(T, m, 'D quatre sites');
        dit(m && m.lignes.length === 4 && ['vinted', 'ebay', 'leboncoin', 'vestiaire'].every((s) => m.lignes.some((l) => l.cle.startsWith(s + ':'))), `${T} D les quatre sites du N°207 (par identité)`, m && m.lignes.map((l) => l.cle + ':' + l.mode));
        await pg.click('[data-prix-appliquer]');
        await pg.waitForFunction(() => [...document.querySelectorAll('[data-prix-site]')].every((l) => { const e = l.getAttribute('data-prix-etat'); return e && e !== 'envoi'; }) || !document.querySelector('[data-prix-partout]'), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(300);
        const cmds = await pg.evaluate(() => (window.__cmds || []).filter((c) => /Prix|prix/.test(c.cmd)).map((c) => c.cmd));
        dit(cmds.filter((c) => c === 'baisserPrixVinted').length === 1 && cmds.filter((c) => c === 'lbcPrix').length === 1 && cmds.filter((c) => c === 'vcPrix').length === 1 && pg.corpsEbay.length === 1, `${T} D un clic : UNE commande par site (Vinted, Leboncoin, Vestiaire par l’extension ; eBay par sa route)`, { cmds, ebay: pg.corpsEbay.length });
        const vc = pg.ROWS.find((r) => /^cmd_prix_/.test(r.id) && r.data.site === 'vestiaire');
        dit(!!vc && pg.ecrits.posts.length === 1 && await ferme(pg), `${T} D Vestiaire pas ouvert ⇒ SA baisse attend (une ligne) ; tout est fait ou en attente ⇒ la feuille se ferme`, { posts: pg.ecrits.posts.length });
        await ouvrir(pg, '207');
        await pg.waitForFunction(() => !!document.querySelector('[data-prix-annuler]'), null, { timeout: 8000 }).catch(() => {});
        const m2 = await mesurer(pg);
        await shot(pg, `D-${N}-2-rouverte`);
        commun(T, m2, 'D rouverte');
        dit(errs.length === 0, `${T} D aucune erreur de page`, errs.slice(0, 2));
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a pu tourner', String(e && e.message).split('\n')[0]); }
  finally { try { if (b) await b.close(); } catch (_) {} srv.close(); }
  console.log(ko ? `\nKO  prix-sans-manuel : ${ko} contrôle(s) rouge(s)` : '\nOK  prix-sans-manuel : un geste, l’extension baisse ou la baisse attend ; rien ne se chevauche');
  process.exit(ko ? 1 : 0);
})();
