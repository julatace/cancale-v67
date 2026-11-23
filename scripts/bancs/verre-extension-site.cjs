// ════════════════════════════════════════════════════════════════════════════
//  BANC « VERRE DÉPOLI » — la carte et la fenêtre de l'extension, le site public
//  (Julien, 15 nov. : « J'aime la 9 » — panneaux de verre dépoli sur un bleu profond
//  dégradé, le chiffre/titre en blanc sur le fond, tout le reste se lit sur le verre).
//
//  Il juge la RÈGLE sur ce que le navigateur CALCULE et PEINT (jamais un libellé) :
//   C1. la carte du logo est un panneau au dégradé BLEU PROFOND : son fond, contenu caché,
//       est bleu (b − r ≥ 50, luminance < 0,25) et varie du haut vers le bas (dégradé) ;
//   C2. ses lignes sont des plaques de VERRE (flou + fond translucide) posées sur ce bleu ;
//   C3. OPAQUE : la même carte posée sur une page BLANCHE et sur une page NOIRE donne les
//       mêmes pixels dans la carte (la page ne se voit jamais à travers) ;
//   C4. contraste AA de CHAQUE texte de la carte, mesuré sur les PIXELS (le texte rendu
//       transparent, le fond lu sous chaque ligne de texte) : 4,5:1 (3:1 en grand) ;
//   C5. transparence réduite (prefers-reduced-transparency) ⇒ verre opaque, sans flou ;
//   C6. connexion : le formulaire dans l'IFRAME de l'extension (Chrome/Edge/Firefox,
//       popup.html?mode=carte) ET la carte DESSINÉE (Orion) — sur du verre, lisibles (AA) ;
//   F.  la fenêtre de l'extension (popup.html) : dégradé, verre, AA ;
//   S.  le site public (accueil, tarifs, une page légale, l'aide, la confiance) : fond
//       dégradé bleu, plaques de verre, le titre phare en blanc sur le bleu, un seul plein
//       à l'écran, AA de chaque texte visible (en défilant toute la page), 390 et 1512,
//       clair et sombre.
//  Captures : `scripts/bancs/captures/verre-extension-site/` (ou BANC_CAPTURES) — à REGARDER.
//
//  Preuve (§6.1) : `BANC_RACINE=<arbre d'avant>` dessine l'ancienne extension et sert ses
//  pages statiques ; `BANC_DIST=<build d'avant>` sert l'ancien site. Rouge attendu.
//  `--carte`, `--fenetre`, `--site` : une partie seulement (machine chargée : une à la fois).
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ICI = path.join(__dirname, '..', '..');
const RACINE = process.env.BANC_RACINE ? path.resolve(process.env.BANC_RACINE) : ICI;
const EXT = path.join(RACINE, 'vinted-sync-extension');
const DIST = process.env.BANC_DIST ? path.resolve(process.env.BANC_DIST) : path.join(ICI, 'dist');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const VERSION = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
const LOGO = fs.readFileSync(path.join(ICI, 'vinted-sync-extension', 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'verre-extension-site') : path.join(__dirname, 'captures', 'verre-extension-site');
const PARTIES = ['--carte', '--fenetre', '--site'].filter((p) => process.argv.includes(p));
const fait = (p) => !PARTIES.length || PARTIES.includes(p);

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 600) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && (e.stack || e.message)).slice(0, 400)}`); return null; } };
const ARGS = ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'];

// ── LA MESURE DU CONTRASTE, SUR LES PIXELS ────────────────────────────────────
// Dans la page (ou le cadre) : chaque bout de texte VISIBLE (ni flouté, ni inert, ni
// transparent par opacité — un bouton éteint n'est pas jugé, WCAG 1.4.3), son rectangle,
// sa couleur calculée, sa taille. Puis le texte est rendu transparent, on photographie, et
// l'atelier lit les pixels SOUS chaque texte.
const COLLECTER = (racineSel) => {
  const racine = racineSel === 'document' ? document : (window.__racine || (document.getElementById('vrm-badge') || {}).shadowRoot);
  if (!racine) return [];
  const out = [];
  const tw = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  let n;
  const opacite = (el) => { let o = 1, e = el; while (e) { const cs = getComputedStyle(e); o *= Number(cs.opacity); if (cs.filter && /blur/.test(cs.filter)) return 0; e = e.parentElement || (e.getRootNode && e.getRootNode().host) || null; } return o; };
  while ((n = tw.nextNode())) {
    const t = n.textContent.replace(/\s+/g, ' ').trim();
    if (!t || !/[\p{L}\p{N}]/u.test(t)) continue;
    const el = n.parentElement;
    if (!el || el.closest('[inert], script, style, noscript, svg, [hidden], option')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.display === 'none') continue;
    if (opacite(el) < 0.98) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    for (const q of rg.getClientRects()) {
      if (q.width < 4 || q.height < 7) continue;
      if (q.top < 0 || q.bottom > innerHeight || q.left < 0 || q.right > innerWidth) continue;
      // Coupé par un conteneur qui défile (la carte, une liste) : seulement la partie visible ;
      // une ligne coupée à plus de 30 % n'est pas lue (on la lira en défilant).
      let v = { l: q.left, t: q.top, r: q.right, b: q.bottom };
      for (let a = el.parentElement || (el.getRootNode && el.getRootNode().host); a; a = a.parentElement || (a.getRootNode && a.getRootNode().host) || null) {
        const ca = getComputedStyle(a);
        if (ca.overflowX === 'visible' && ca.overflowY === 'visible') continue;
        const ra = a.getBoundingClientRect();
        v = { l: Math.max(v.l, ra.left), t: Math.max(v.t, ra.top), r: Math.min(v.r, ra.right), b: Math.min(v.b, ra.bottom) };
      }
      if (v.r - v.l < q.width * 0.7 || v.b - v.t < q.height * 0.7) continue;
      const cx = q.left + q.width / 2, cy = q.top + q.height / 2;
      // Caché sous autre chose (une barre collante, un recouvrement) : le haut, le centre ET le bas du texte
      // doivent être le texte lui-même — une ligne à moitié sous la barre du haut n'est pas jugée.
      const ici = (x, yy) => { const h = racine.elementFromPoint ? racine.elementFromPoint(x, yy) : document.elementFromPoint(x, yy); return !!h && (el.contains(h) || h.contains(el)); };
      if (!ici(cx, cy) || !ici(cx, Math.max(v.t, q.top) + 1.5) || !ici(cx, Math.min(v.b, q.bottom) - 1.5)) continue;
      out.push({ x: v.l, y: v.t, w: v.r - v.l, h: v.b - v.t, c: cs.color, fs: parseFloat(cs.fontSize), fw: Number(cs.fontWeight) || 400, t: t.slice(0, 48) });
    }
  }
  return out;
};
const CACHER = ({ racineSel, oui }) => {
  const racine = racineSel === 'document' ? document : (window.__racine || (document.getElementById('vrm-badge') || {}).shadowRoot);
  if (!racine) return;
  const ici = racineSel === 'document' ? document.head : racine;
  let s = ici.querySelector('style[data-banc-cache]');
  if (!oui) { if (s) s.remove(); return; }
  if (s) return;
  s = document.createElement('style'); s.setAttribute('data-banc-cache', '');
  s.textContent = '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; text-decoration-color: transparent !important; transition: none !important; animation: none !important; } ::placeholder { color: transparent !important; }';
  ici.appendChild(s);
};
// L'atelier : une page vide qui décode une capture (PNG) et lit les pixels sous chaque texte.
async function analyser(atelier, png, runs, dpr) {
  return atelier.evaluate(async ({ b64, runs, dpr }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const coul = (s) => { const m = /rgba?\(([\d.]+),? ([\d.]+),? ([\d.]+)(?:,? ?\/? ?([\d.]+))?/.exec(s) || /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?/.exec(s); if (!m) return null; let [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]; if (/srgb/.test(s)) { r *= 255; g *= 255; b *= 255; } return { r, g, b, a: m[4] == null ? 1 : Number(m[4]) }; };
    return runs.map((u) => {
      const tc = coul(u.c); if (!tc) return Object.assign({}, u, { ratio: null });
      // La boîte d'une ligne porte l'interligne au-dessus et au-dessous : on lit son cœur (70 % de la hauteur).
      const x0 = Math.max(0, Math.floor(u.x * dpr)), y0 = Math.max(0, Math.floor((u.y + u.h * 0.15) * dpr)), w = Math.max(1, Math.floor(u.w * dpr)), h = Math.max(1, Math.floor(u.h * 0.7 * dpr));
      const d = cx.getImageData(x0, y0, Math.min(w, cv.width - x0), Math.min(h, cv.height - y0)).data;
      const pas = Math.max(1, Math.floor(Math.sqrt((d.length / 4) / 300)));
      const rs = [];
      const W = Math.min(w, cv.width - x0);
      for (let yy = 0; yy < d.length / 4 / W; yy += pas) for (let xx = 0; xx < W; xx += pas) {
        const i = (yy * W + xx) * 4; const pr = d[i], pg = d[i + 1], pb = d[i + 2];
        const r = tc.r * tc.a + pr * (1 - tc.a), g = tc.g * tc.a + pg * (1 - tc.a), b = tc.b * tc.a + pb * (1 - tc.a);
        const a = L(r, g, b), f = L(pr, pg, pb);
        rs.push((Math.max(a, f) + 0.05) / (Math.min(a, f) + 0.05));
      }
      rs.sort((a, b) => a - b);
      const ratio = rs.length ? rs[Math.floor(rs.length * 0.05)] : null;
      const grand = u.fs >= 24 || (u.fs >= 18.66 && u.fw >= 700);
      return Object.assign({}, u, { ratio: ratio && Math.round(ratio * 100) / 100, seuil: grand ? 3 : 4.5 });
    });
  }, { b64: png.toString('base64'), runs, dpr });
}
// Mesure une vue : la racine (`document` ou la shadow root de la carte), et les cadres posés dedans.
async function mesurer(pg, atelier, { racine = 'carte', dpr = 1, cadres = [] } = {}) {
  let runs = await pg.evaluate(COLLECTER, racine === 'document' ? 'document' : 'carte');
  for (const fr of cadres) {
    const dec = await fr.el.boundingBox();
    if (!dec) continue;
    const r = await fr.frame.evaluate(COLLECTER, 'carte').catch(() => []);
    runs = runs.concat(r.map((u) => Object.assign(u, { x: u.x + dec.x, y: u.y + dec.y, cadre: true })));
  }
  await pg.evaluate(CACHER, { racineSel: racine === 'document' ? 'document' : 'carte', oui: true });
  for (const fr of cadres) await fr.frame.evaluate(CACHER, { racineSel: 'carte', oui: true }).catch(() => {});
  // Le texte caché doit être PEINT avant la photo (machine chargée : deux images, puis un temps).
  const deuxImages = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await pg.evaluate(deuxImages);
  for (const fr of cadres) await fr.frame.evaluate(deuxImages).catch(() => {});
  await pg.waitForTimeout(700);
  const png = await pg.screenshot({ animations: 'disabled', timeout: 120000 });
  await pg.evaluate(CACHER, { racineSel: racine === 'document' ? 'document' : 'carte', oui: false });
  for (const fr of cadres) await fr.frame.evaluate(CACHER, { racineSel: 'carte', oui: false }).catch(() => {});
  const res = await analyser(atelier, png, runs, dpr);
  return { png, n: res.length, faibles: res.filter((u) => u.ratio != null && u.ratio < u.seuil), min: res.reduce((m, u) => (u.ratio != null && u.ratio < m ? u.ratio : m), 99) };
}
const resumeFaibles = (f) => f.slice(0, 8).map((u) => `« ${u.t} » ${u.ratio}:1 < ${u.seuil} (${u.c}, ${u.fs}px)`).join(' · ');

// Lire des pixels d'une capture (pour le dégradé et l'opacité).
async function lirePixels(atelier, png, points) {
  return atelier.evaluate(async ({ b64, points }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
    return points.map(([x, y]) => Array.from(cx.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)));
  }, { b64: png.toString('base64'), points });
}
const lumi = ([r, g, b]) => { const l = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * l(r) + 0.7152 * l(g) + 0.0722 * l(b); };
// Un BLEU (le bleu domine nettement) et profond (sombre). `bleuVif` : au moins un point du
// dégradé est un vrai bleu saturé (b − r ≥ 60) — le bleu-nuit presque noir d'avant ne l'est pas.
const bleuProfond = (p) => p[2] - p[0] >= 30 && p[2] > p[1] && lumi(p) < 0.25;
const bleuVif = (p) => p[2] - p[0] >= 60;

// ══ LA CARTE DU LOGO ════════════════════════════════════════════════════════
// Le monde : le vrai background.js (scripts/_fond-vm.cjs) fabrique les listes, comme
// carte-extension.cjs ; données INVENTÉES.
function listesInventees() {
  const { faireFond } = require(path.join(ICI, 'scripts', '_fond-vm.cjs'));
  const T0 = Date.now(), MIN = 60000, J = 86400000;
  const TITRES = ['Asics Gel-Nimbus 25 bleu turquoise et vert fluo taille 42', 'Nike Air Max 1 blanc et bleu 43', 'Autry Reelwind Low noir et blanc 41', 'Adidas Handball Spezial gomme 44'];
  const ventes = TITRES.map((t, i) => ({ transaction_id: 91000000 + i, conversation_id: 77000000 + i, title: t, price: { amount: String(36 + i * 9) + '.0' }, item_id: 600000 + i, date: new Date(T0 - (4 + i) * J).toISOString(), status: 'Colis en route', transaction_user_status: 'waiting', status_title: 'Commande' }));
  const items = TITRES.map((t, i) => ({ id: 700000 + i, title: t, price: { amount: String(50 + i) }, created_at_ts: Math.floor((T0 - (i + 1) * J) / 1000), favourite_count: i, is_closed: false, is_hidden: false, is_reserved: false, is_draft: false, can_edit: true }));
  const lignes = {
    main: { vinted_annonce_numeros: { 700000: { numero: '124', accountId: '111' } }, vinted_buyprice_by_num: {} },
    vinted_listing_dates: {},
    harvest_111_listings: { type: 'listings', capturedAt: new Date(T0 - 20 * MIN).toISOString(), nItems: 4, payload: { items } },
    harvest_111_orders_sold: { type: 'orders_sold', capturedAt: new Date(T0 - MIN).toISOString(), nItems: 214, payload: { my_orders: ventes } },
  };
  const f = faireFond({ src: path.join(EXT, 'background.js'), connecte: '111', lignes, comptes: [{ vinted_user_id: '111', login: 'shop_banc', domain: 'www.vinted.fr' }] });
  f.ctx.compteConnecte = async () => '111';
  return f;
}
const etatConnecte = (version) => ({ ok: true, plateforme: 'vinted', capte: true, version, code: version, vrm: { ok: true, connecte: true, email: 'banc@exemple.fr', cloisonne: true },
  site: { id: '111', nom: 'shop_banc', choix: 'oui', jauge: { h: 3, maxH: 50, j: 7, maxJ: 200, complet: true }, favoris: null },
  flux: { okAt: Date.now() - 60000 }, liens: [{ cle: 'messages', url: 'https://www.vinted.fr/inbox', libelle: 'Messages' }, { cle: 'dressing', url: 'https://www.vinted.fr/member/111', libelle: 'Mon dressing' }], capteCoupe: false,
  secu: { niveau: 'ok', texte: 'Calme · 0 gestes de VRM aujourd’hui', arrete: false },
  mois: { ca: '1 340 €', ventes: 42, aExpedier: 3 },
  capture: { k: 'ok', n: 0, phrase: 'Bordereaux : tous récupérés', geste: '' } });
const etatDeconnecte = (version) => ({ ok: true, plateforme: 'vinted', capte: false, version, code: version, vrm: { ok: true, connecte: false }, site: { id: '111', nom: 'shop_banc', choix: 'oui' }, liens: [], capteCoupe: false });

const PAGE = (fond, texte) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:${fond};color:${texte};font-family:sans-serif"><header style="height:64px;border-bottom:1px solid #888;padding:20px">vinted.fr (banc)</header><main style="padding:20px;height:2000px"><p>Annonces…</p><div style="width:100%;height:600px;background:repeating-linear-gradient(45deg,${texte} 0 8px,${fond} 8px 16px)"></div></main></body></html>`;
const EXT_FICHIERS = { 'popup.html': 'text/html', 'popup.js': 'text/javascript', 'vrm-badge.js': 'text/javascript', 'parcours-popup.js': 'text/javascript', 'logo-vrm-96.png': 'image/png' };

async function ouvrirCarte(nav, { etat, listes = null, scheme = 'light', largeur = 1512, hauteur = 900, mobile = false, fond = '#ffffff', orion = false, transparenceReduite = false }) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur }, reducedMotion: 'reduce' }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  if (transparenceReduite) { const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }, { name: 'prefers-color-scheme', value: scheme }] }); }
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  const texte = fond === '#ffffff' ? '#222222' : '#e8e8e8';
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (/^https:\/\/ext\.test\//.test(u)) {
      const nom = new URL(u).pathname.slice(1);
      if (EXT_FICHIERS[nom]) return r.fulfill({ status: 200, contentType: EXT_FICHIERS[nom], body: nom === 'logo-vrm-96.png' ? LOGO : fs.readFileSync(path.join(EXT, nom)) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE(fond, texte) });
  });
  await ctx.addInitScript(({ e, js, L, orion, version }) => {
    const ext = location.hostname === 'ext.test';
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { const r = orig.call(this, o); if (this.id === 'vrm-badge') window.__racine = r; return r; };
    let stock = {};
    window.chrome = {
      runtime: { id: 'ext', getURL: (p) => 'https://ext.test/' + p, getManifest: () => ({ version, manifest_version: 3 }), lastError: null,
        sendMessage: (msg, cb) => {
          let rep = { ok: true };
          if (msg.action === 'etat') rep = copie(e);
          else if (msg.action === 'authEtat') rep = { ok: true, connecte: !!(e.vrm && e.vrm.connecte) };
          else if (msg.action === 'carteListes') rep = L ? copie(L) : { ok: false };
          else if (msg.action === 'capteLot') rep = { ok: true, lot: null };
          else if (msg.action === 'fournisseursConnexion') rep = { ok: true, google: true, discord: true };
          else if (msg.action === 'favorisCarte') rep = { ok: true, uid: '111', apercu: { etat: 'bloque', raison: 'reglages', lus: [], totalLus: 0 } };
          setTimeout(() => cb && cb(rep), 0);
        } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb(copie(stock)), 0); return Promise.resolve(copie(stock)); }, set: (o, cb) => { stock = Object.assign(stock, o); if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } },
      permissions: { contains: (q, cb) => cb && cb(true) },
    };
    if (ext) return;
    if (orion) window.__vrmOrionCompat = true;
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s); });
  }, { e: etat, js: BADGE, L: listes, orion, version: VERSION });
  await pg.goto('https://www.vinted.fr/catalog');
  await pg.waitForTimeout(350);
  return { ctx, pg, erreurs };
}
const toucherLogo = async (pg, mobile) => {
  const b = await pg.evaluate(() => { const x = window.__racine.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(450);
};
const clicCarte = async (pg, sel) => { await pg.evaluate((s) => { const b = window.__racine.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(350); };
const boiteCarte = (pg) => pg.evaluate(() => { const c = window.__racine.querySelector('.carte.on, .question.on') || window.__racine.querySelector('.carte'); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, vis: getComputedStyle(c).display !== 'none' }; });
const lireVerre = (pg) => pg.evaluate(() => {
  const r = window.__racine; const alpha = (s) => { const m = /rgba?\([^)]*?([\d.]+)\)$/.exec(s.replace(/\s/g, '')); if (/^rgba/.test(s.replace(/\s/g, ''))) { const p = s.replace(/[^\d.,]/g, '').split(','); return Number(p[3]); } return /^rgb\(/.test(s.replace(/\s/g, '')) ? 1 : (m ? Number(m[1]) : 1); };
  const plaques = Array.from(r.querySelectorAll('.contenu > *, .carte > .connexion')).filter((el) => el.getClientRects().length && getComputedStyle(el).display !== 'none');
  const v = plaques.map((el) => { const cs = getComputedStyle(el); const f = cs.backdropFilter || cs.webkitBackdropFilter || 'none'; return { cls: el.className, flou: /blur/.test(f), a: alpha(cs.backgroundColor), fond: cs.backgroundColor }; });
  return { verre: v.filter((x) => x.flou && x.a > 0.3 && x.a < 1).length, opaques: v.filter((x) => !x.flou && x.a >= 0.999).length, total: v.length, detail: v };
});

async function partieCarte(nav, atelier) {
  console.log('\n══ La carte du logo (vinted.fr) ══');
  const f = listesInventees();
  const L = await f.envoyer({ from: 'vrm-badge', action: 'carteListes' }, { tab: { id: 7, url: 'https://www.vinted.fr/catalog' } });
  for (const [largeur, hauteur, mobile] of [[390, 844, true], [1512, 900, false]]) for (const scheme of ['light', 'dark']) {
    const T = `${largeur} ${scheme === 'light' ? 'clair' : 'sombre'}`;
    await essaie(T + ' carte connectée', async () => {
      const prises = {};
      for (const fond of ['#ffffff', '#000000']) {
        const t = await ouvrirCarte(nav, { etat: etatConnecte(VERSION), listes: L, scheme, largeur, hauteur, mobile, fond });
        await toucherLogo(t.pg, mobile);
        await clicCarte(t.pg, '[data-onglet-b="ventes"]');
        const b = await boiteCarte(t.pg);
        const dpr = mobile ? 2 : 1;
        prises[fond] = { png: await t.pg.screenshot({ timeout: 120000 }), b, dpr };
        const nomFond = fond === '#ffffff' ? 'page-blanche' : 'page-noire';
        fs.writeFileSync(path.join(SORTIE, `carte-${largeur}-${scheme === 'light' ? 'clair' : 'sombre'}-${nomFond}.png`), prises[fond].png);
        if (fond === '#ffffff') {
          const v = await lireVerre(t.pg);
          dit(v.verre >= 3, `${T} : C2 les lignes de la carte sont des plaques de VERRE (flou + fond translucide) : ${v.verre} sur ${v.total}`, JSON.stringify(v.detail.slice(0, 6)));
          const m = await mesurer(t.pg, atelier, { dpr });
          dit(m.n >= 12 && m.faibles.length === 0, `${T} : C4 contraste AA de chaque texte de la carte (${m.n} textes, le plus faible ${m.min}:1)`, resumeFaibles(m.faibles));
          // C1 : le fond, contenu caché.
          await t.pg.evaluate(() => { const s = document.createElement('style'); s.setAttribute('data-banc-fond', ''); s.textContent = '.carte > *, .question > * { visibility: hidden !important; }'; window.__racine.appendChild(s); });
          await t.pg.waitForTimeout(50);
          const nu = await t.pg.screenshot({ timeout: 120000 });
          await t.pg.evaluate(() => { const s = window.__racine.querySelector('[data-banc-fond]'); if (s) s.remove(); });
          const cxm = (b.x + b.w / 2) * dpr;
          const [hautP, basP] = await lirePixels(atelier, nu, [[cxm, (b.y + 14) * dpr], [cxm, (b.y + b.h - 14) * dpr]]);
          const ecart = Math.abs(hautP[0] - basP[0]) + Math.abs(hautP[1] - basP[1]) + Math.abs(hautP[2] - basP[2]);
          dit(bleuProfond(hautP) && bleuProfond(basP) && (bleuVif(hautP) || bleuVif(basP)) && ecart >= 12, `${T} : C1 la carte est un dégradé BLEU PROFOND (haut ${hautP}, bas ${basP})`, JSON.stringify({ hautP, basP, ecart, lh: lumi(hautP).toFixed(3), lb: lumi(basP).toFixed(3) }));
          dit(t.erreurs.length === 0, `${T} : aucune erreur de page`, t.erreurs.join(' | '));
        }
        await t.ctx.close();
      }
      // C3 : les mêmes pixels dans la carte, page blanche ou noire.
      const A = prises['#ffffff'], B = prises['#000000'];
      const pts = [];
      for (let i = 1; i < 12; i++) for (let j = 1; j < 8; j++) pts.push([(A.b.x + 26 + (A.b.w - 52) * j / 8) * A.dpr, (A.b.y + 26 + (A.b.h - 52) * i / 12) * A.dpr]);
      const pa = await lirePixels(atelier, A.png, pts), pb = await lirePixels(atelier, B.png, pts);
      const diff = pa.reduce((m, p, i) => Math.max(m, Math.abs(p[0] - pb[i][0]), Math.abs(p[1] - pb[i][1]), Math.abs(p[2] - pb[i][2])), 0);
      dit(A.b.vis && diff <= 3, `${T} : C3 la carte est OPAQUE : posée sur une page blanche ou noire, mêmes pixels (écart max ${diff})`, `${pts.length} points`);
    });
  }
  // C5 : transparence réduite ⇒ verre opaque.
  await essaie('transparence réduite', async () => {
    const t = await ouvrirCarte(nav, { etat: etatConnecte(VERSION), listes: L, scheme: 'light', transparenceReduite: true });
    await toucherLogo(t.pg, false);
    const v = await lireVerre(t.pg);
    dit(v.verre === 0 && v.opaques >= 3, `C5 transparence réduite : plus de flou, verre opaque (${v.opaques} plaques opaques)`, JSON.stringify(v.detail.slice(0, 5)));
    await t.ctx.close();
  });
  // C6 : la connexion — l'iframe de l'extension (Chrome) et la carte dessinée (Orion).
  for (const [orion, nom] of [[false, 'chrome-iframe'], [true, 'orion-dessinee']]) for (const scheme of ['light', 'dark']) {
    const T = `${nom} ${scheme === 'light' ? 'clair' : 'sombre'}`;
    await essaie(T, async () => {
      const t = await ouvrirCarte(nav, { etat: etatDeconnecte(VERSION), scheme, largeur: 390, hauteur: 844, mobile: true, fond: '#000000', orion });
      await toucherLogo(t.pg, true);
      await clicCarte(t.pg, '[data-montrer-connexion]');
      if (!orion) await t.pg.waitForFunction(() => { const c = window.__racine.querySelector('.connexion'); return c && /pret|repli/.test(c.getAttribute('data-cadre') || ''); }, null, { timeout: 5000 }).catch(() => {});
      await t.pg.waitForTimeout(500);
      const etatCx = await t.pg.evaluate(() => { const c = window.__racine.querySelector('.connexion'); const f = c && c.querySelector('iframe'); return { cadre: c && c.getAttribute('data-cadre'), iframe: !!(f && getComputedStyle(f).visibility === 'visible'), form: !!window.__racine.querySelector('form[data-connexion-carte]') }; });
      dit(orion ? etatCx.form && !etatCx.iframe : etatCx.iframe && etatCx.cadre === 'pret', `${T} : C6 ${orion ? 'la carte DESSINÉE (Orion) porte le formulaire' : 'le formulaire vit dans l’iframe de l’extension (popup.html?mode=carte)'}`, JSON.stringify(etatCx));
      const v = await lireVerre(t.pg);
      const cx = v.detail.find((d) => /connexion/.test(d.cls));
      dit(!!cx && cx.flou && cx.a < 1, `${T} : C6 la connexion est posée sur une plaque de verre`, JSON.stringify(cx));
      const cadres = [];
      if (!orion) { const el = await t.pg.evaluateHandle(() => window.__racine.querySelector('.connexion iframe')); const fr = t.pg.frames().find((x) => /ext\.test\/popup\.html\?mode=carte/.test(x.url())); if (fr && el) cadres.push({ el: el.asElement(), frame: fr }); }
      const m = await mesurer(t.pg, atelier, { dpr: 2, cadres });
      dit(m.n >= 5 && m.faibles.length === 0, `${T} : C6 contraste AA du formulaire (${m.n} textes${cadres.length ? ', cadre compris' : ''}, le plus faible ${m.min}:1)`, resumeFaibles(m.faibles));
      fs.writeFileSync(path.join(SORTIE, `connexion-${nom}-${scheme === 'light' ? 'clair' : 'sombre'}.png`), await t.pg.screenshot({ timeout: 120000 }));
      await t.ctx.close();
    });
  }
}

// ══ LA FENÊTRE DE L'EXTENSION (popup.html) ═══════════════════════════════════
async function partieFenetre(nav, atelier) {
  console.log('\n══ La fenêtre de l’extension ══');
  for (const scheme of ['light', 'dark']) {
    const T = `fenêtre ${scheme === 'light' ? 'clair' : 'sombre'}`;
    await essaie(T, async () => {
      const t = await ouvrirCarte(nav, { etat: etatDeconnecte(VERSION), scheme, largeur: 360, hauteur: 760, orion: false });
      await t.pg.addInitScript(() => { window.__vrmOrionCompat = true; });
      await t.pg.goto('https://ext.test/popup.html');
      await t.pg.waitForFunction(() => !document.body.classList.contains('decide') && document.querySelector('#auth') && document.querySelector('#auth').children.length > 0, null, { timeout: 5000 }).catch(() => {});
      await t.pg.waitForTimeout(300);
      // (21 nov., ext. 5.415) la fenêtre est passée au design « VRM natif » (le seul depuis le 19 nov., CLAUDE.md §3
      // « Palette ») : fond uni gris système (#F2F2F7 / noir), UN groupe blanc / gris foncé, sans dégradé ni verre.
      const fond = await t.pg.evaluate(() => { const b = getComputedStyle(document.body); const g = document.querySelector('#auth .groupe'); return { img: b.backgroundImage, bg: b.backgroundColor, groupe: g ? getComputedStyle(g).backgroundColor : '' }; });
      dit(fond.img === 'none' && !!fond.groupe && fond.groupe !== fond.bg, `${T} : F « VRM natif » — fond uni, la connexion dans UN groupe`, JSON.stringify(fond));
      const nu = await t.pg.screenshot({ timeout: 120000 });
      const [p] = await lirePixels(atelier, nu, [[8, 8]]);
      const attendu = scheme === 'light' ? [242, 242, 247] : [0, 0, 0];
      dit(Array.isArray(p) && p.slice(0, 3).every((v, i) => Math.abs(v - attendu[i]) <= 3), `${T} : F le fond est le gris système natif (${p})`);
      const m = await mesurer(t.pg, atelier, { racine: 'document', dpr: 1 });
      dit(m.n >= 6 && m.faibles.length === 0, `${T} : F contraste AA de chaque texte (${m.n} textes, le plus faible ${m.min}:1)`, resumeFaibles(m.faibles));
      fs.writeFileSync(path.join(SORTIE, `fenetre-${scheme === 'light' ? 'clair' : 'sombre'}.png`), nu);
      await t.ctx.close();
    });
  }
}

// ══ LE SITE PUBLIC ══════════════════════════════════════════════════════════
async function partieSite(nav, atelier) {
  console.log('\n══ Le site public ══');
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { dit(false, `le site n'est pas construit (${DIST}) : npm run build`); return; }
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
  // Les pages statiques viennent de l'arbre jugé (BANC_RACINE) ; l'app construite, de DIST.
  const PUB = path.join(RACINE, 'public');
  const srv = http.createServer((q, r) => {
    let f = decodeURIComponent(q.url.split('?')[0]);
    if (f === '/' || f === '/tarifs' || /^\/pa\//.test(f)) f = '/index.html';
    const cands = /^\/(legal|aide)\/|^\/confiance/.test(f) ? [path.join(PUB, f), path.join(PUB, f + '.html')] : [path.join(DIST, f)];
    const p = cands.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
    if (!p) { r.writeHead(404); return r.end('nope'); }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
  });
  await new Promise((res) => srv.listen(0, res));
  const PORT = srv.address().port;
  const PAGES = [
    { url: '/', nom: 'accueil', pret: '[data-accueil] h1', phare: '[data-accueil] h1', plaques: '.av-tuile, .av-panneau, .av-offre-solo, .av-fin-plaque, .av-tg, .av-faq-texte' },
    { url: '/tarifs', nom: 'tarifs', pret: '[data-tarifs] h1', phare: '[data-tarifs] h1', plaques: '.vt-offre:not(.vt-offre-pro), .vt-tableau, .vt-frise li, .vt-carte' },
    { url: '/legal/cgv.html', nom: 'legal', pret: 'main h1', phare: 'header a', plaques: 'main' },
    { url: '/aide/index.html', nom: 'aide', pret: 'main h1', phare: null, plaques: 'main' },
    { url: '/confiance.html', nom: 'confiance', pret: 'main h1', phare: 'main h1', plaques: 'ul' },
  ];
  try {
    const SEULES = (process.env.BANC_PAGES || '').split(',').filter(Boolean);
    for (const P of PAGES.filter((x) => !SEULES.length || SEULES.includes(x.nom))) for (const [largeur, hauteur, mobile] of [[390, 844, true], [1512, 900, false]]) for (const scheme of ['light', 'dark']) {
      if (P.nom !== 'accueil' && P.nom !== 'tarifs' && largeur === 1512 && scheme === 'dark') continue;   // les pages statiques : 390 clair/sombre et 1512 clair
      const T = `${P.nom} ${largeur} ${scheme === 'light' ? 'clair' : 'sombre'}`;
      await essaie(T, async () => {
        const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, colorScheme: scheme, reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'fr-FR' });
        await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (rt) => rt.abort());
        await ctx.route(/supabase\.co|\/api\//, (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
        const pg = await ctx.newPage();
        const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
        await pg.goto(`http://localhost:${PORT}${P.url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await pg.waitForSelector(P.pret, { timeout: 45000 }).catch(() => {});
        await pg.evaluate(() => document.fonts && document.fonts.ready);
        await pg.waitForTimeout(700);
        // S1 : le fond est le bleu profond (pixel du coin, sous rien).
        const png0 = await pg.screenshot({ timeout: 120000 });
        const [coin, coinBas] = await lirePixels(atelier, png0, [[2, 2], [2, hauteur - 3]]);
        const v = await pg.evaluate(({ plaques, phare }) => {
          const els = Array.from(document.querySelectorAll(plaques)).filter((e) => e.getClientRects().length);
          const verre = els.filter((e) => { const cs = getComputedStyle(e); return /blur/.test(cs.backdropFilter || cs.webkitBackdropFilter || ''); }).length;
          const h = phare && document.querySelector(phare);
          return { plaques: els.length, verre, phare: h ? getComputedStyle(h).color : null };
        }, { plaques: P.plaques, phare: P.phare });
        dit(bleuProfond(coin) && bleuProfond(coinBas) && (bleuVif(coin) || bleuVif(coinBas)), `${T} : S le fond de la page est le bleu profond (haut ${coin}, bas ${coinBas})`);
        dit(v.plaques >= 1 && v.verre === v.plaques, `${T} : S les sections sont des plaques de verre (${v.verre}/${v.plaques})`);
        if (P.phare) dit(v.phare === 'rgb(255, 255, 255)', `${T} : S le titre phare est BLANC sur le bleu (${v.phare})`);
        if (P.nom === 'accueil') {
          const pleins = await pg.evaluate((H) => {
            const lumDe = (s) => { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/.exec(s || ''); if (!m) return null; return { l: (Number(m[1]) * 0.2126 + Number(m[2]) * 0.7152 + Number(m[3]) * 0.0722) / 255, a: m[4] == null ? 1 : Number(m[4]) }; };
            const page = lumDe(getComputedStyle(document.querySelector('[data-accueil]')).backgroundColor) || { l: 1 };
            return [...document.querySelectorAll('[data-accueil] a, [data-accueil] button')].filter((b) => { const r = b.getBoundingClientRect(), cs = getComputedStyle(b); if (!r.width || !r.height || r.bottom <= 0 || r.top >= H || Number(cs.opacity) < 0.5 || cs.visibility === 'hidden') return false; const f = lumDe(cs.backgroundColor); if (!f || f.a < 0.9) return false; return Math.abs(f.l - page.l) > 0.5; }).map((b) => b.getAttribute('data-cta') || b.innerText.trim().slice(0, 30));
          }, hauteur);
          dit(pleins.length === 1 && pleins[0] === 'inscription', `${T} : S un seul bouton plein au premier écran : « Essayer gratuitement »`, JSON.stringify(pleins));
        }
        // S : AA de chaque texte, écran par écran, toute la page.
        const Ht = await pg.evaluate(() => document.documentElement.scrollHeight);
        let faibles = [], n = 0, min = 99, ecrans = 0;
        for (let y = 0; y < Ht && ecrans < 14; y += Math.round(hauteur * 0.85), ecrans++) {
          await pg.evaluate((y) => window.scrollTo(0, y), y); await pg.waitForTimeout(160);
          const m = await mesurer(pg, atelier, { racine: 'document', dpr: 1 });
          if (m.faibles.length && process.env.BANC_DEBUG) fs.writeFileSync(path.join(SORTIE, `debug-${P.nom}-${largeur}-${scheme}-${y}.png`), m.png), console.log('     debug', y, JSON.stringify(m.faibles.slice(0, 3).map((u) => [u.t, u.x, u.y, u.w, u.h, u.ratio])));
          n += m.n; min = Math.min(min, m.min); faibles = faibles.concat(m.faibles.map((u) => Object.assign(u, { t: u.t + ` @${y}` })));
          if (y === 0) fs.writeFileSync(path.join(SORTIE, `site-${P.nom}-${largeur}-${scheme === 'light' ? 'clair' : 'sombre'}.png`), await pg.screenshot({ timeout: 120000 }));
        }
        // Dédoublonné (un texte vu sur deux écrans).
        const vus = new Set(); faibles = faibles.filter((u) => { const k = u.t.replace(/ @\d+$/, ''); if (vus.has(k)) return false; vus.add(k); return true; });
        dit(n >= 10 && faibles.length === 0, `${T} : S contraste AA de chaque texte visible (${n} mesures sur ${ecrans} écrans, le plus faible ${min}:1)`, resumeFaibles(faibles));
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        dit(deb <= 1 && erreurs.length === 0, `${T} : rien ne déborde, aucune erreur de page`, `${deb} px · ${erreurs.join(' | ')}`);
        await ctx.close();
      });
    }
  } finally { srv.close(); }
}

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ARGS });
  const atelier = await (await nav.newContext()).newPage();
  try {
    if (fait('--carte')) await partieCarte(nav, atelier);
    if (fait('--fenetre')) await partieFenetre(nav, atelier);
    if (fait('--site')) await partieSite(nav, atelier);
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ verre-extension-site : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ verre-extension-site : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
