// Banc : la mise en page aux tailles d'Edge sous Windows (revue du 30 octobre).
//
// Julien : « la mise en page est mauvaise sur Edge ». Mesuré sur origin/main
// (Chromium = moteur d'Edge, barre de défilement CLASSIQUE comme sous Windows) :
//  1. fenêtre basse (≥ 1024 de large, < ~775 de haut) : le bas du rail de gauche
//     (Communauté, Compta, Statistiques…) disparaît, et rien ne dit qu'il y a une
//     suite (barre de défilement invisible) ;
//  2. Messages : la PAGE défile en plus de la liste (un texte pour lecteur d'écran
//     posé en absolu, repéré sur <body>) ;
//  3. sous 1024 px de large, l'app passait en coque TÉLÉPHONE même à la souris
//     (Edge avec sa barre latérale, fenêtre en demi-écran).
// Ce banc rend Ma journée, Messages, Compta et Colis aux tailles réelles et juge :
// aucune entrée du rail invisible sans indice, pas de double défilement sur
// Messages, coque ordinateur à la souris dès 768, coque téléphone au doigt, pas de
// débordement horizontal ; plus la colonne des conversations (pas de défilement
// horizontal), une seule hauteur pour liste et panneau, et rien sous l'île.
// ⚠️ Le faux `vinted_accounts` porte `owner` (sans lui l'app dit « je n'arrive
// pas à joindre tes données » et le banc mesure un écran de panne).
//
// Lancer : BANC_PORT=… node scripts/bancs/edge-tailles.cjs   (CAPTURES=dossier
// pour garder les images). Le dist se déduit de l'emplacement DU BANC (§6.1).
const path = require('path'), fs = require('fs'), http = require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { dressingsDuJour } = require('./_instantane.cjs');

const DIST = path.join(__dirname, '..', '..', 'dist'), SC = __dirname;
const FXok = (f) => { try { return JSON.parse(fs.readFileSync(path.join(SC, 'fx', f + '.json'), 'utf8')); } catch (_) { return []; } };
const OWNER = '00000000-0000-4000-8000-0000000000e1';
const ISO = (ms) => new Date(Date.now() - ms).toISOString();
const accFx = FXok('accounts');
const accounts = (accFx.length ? accFx : [
  { vinted_user_id: '111', login: 'boutique_test_a', domain: 'www.vinted.fr', updated_at: ISO(0), created_at: ISO(500 * 3600e3) },
  { vinted_user_id: '222', login: 'boutique_test_b', domain: 'www.vinted.fr', updated_at: ISO(0), created_at: ISO(500 * 3600e3) },
]);
const mainFx = FXok('main');
const main = mainFx.length ? mainFx : [{ id: 'main', data: { vinted_dark: false } }];
// Des conversations INVENTÉES (aucun vrai pseudo) quand fx/ n'en a pas : sans
// liste, la colonne des conversations ne se mesure pas.
const INBOX = accounts.slice(0, 2).map((a, k) => ({ id: `harvest_${a.vinted_user_id}_inbox`, data: { capturedAt: ISO(60e3), payload: { conversations: Array.from({ length: 14 }, (_, i) => ({
  id: 900000 + k * 100 + i, description: 'Bonjour, est-elle toujours disponible ? ' + i, unread: i % 3 === 0, updated_at: ISO((i + 1) * 3600e3),
  opposite_user: { id: 70000 + i, login: 'acheteur_test_' + i, photo: null }, item_count: 1, item_photos: [],
})), pagination: { current_page: 1, total_pages: 1 } } } }));
const LISTV = accounts.map((a, i) => ({ id: `harvest_${a.vinted_user_id}_listings`, data: { capturedAt: ISO(60e3), payload: { items: [{ id: `syn_${a.vinted_user_id}_${i}`, title: 'Paire test ' + (i + 1), brand_title: 'Nike', size_title: '42', price: { amount: '40', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, photo: { url: '' } }], pagination: null } } }));
const inboxFx = FXok('inbox');
const rows = [...FXok('sold'), ...FXok('purch'), ...dressingsDuJour(FXok('listings')), ...LISTV, ...(inboxFx.length ? inboxFx : INBOX), ...FXok('track'), ...FXok('bord'), ...FXok('label'), ...FXok('billing')];
const txn = FXok('txn');

function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const alias = m[1] || m[2].split('->').pop().replace(/^>/, ''); const src = m[2];
    if (src === 'id' || src === 'updated_at' || src === 'owner') { out[alias] = row[src] ?? (src === 'owner' ? OWNER : undefined); continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (/^data(->|->>)/.test(src)) {
      let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = (v == null ? null : v[seg]);
      out[alias] = v == null ? null : v; continue;
    }
    out[alias] = row[src];
  }
  return out;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9471;
const CAPT = process.env.CAPTURES || '';
if (CAPT) fs.mkdirSync(CAPT, { recursive: true });

const CONFIGS = [
  { id: '1536x730@125', w: 1536, h: 730, dsf: 1.25, souris: true },
  { id: '1366x630', w: 1366, h: 630, dsf: 1, souris: true },
  { id: '1280x600@150', w: 1280, h: 600, dsf: 1.5, souris: true },
  { id: '1024x700', w: 1024, h: 700, dsf: 1.25, souris: true },
  { id: '1000x700', w: 1000, h: 700, dsf: 1.25, souris: true },
  { id: '960x900', w: 960, h: 900, dsf: 1, souris: true },
  { id: '768-tactile', w: 768, h: 1024, dsf: 2, souris: false },
  { id: '390-tactile', w: 390, h: 844, dsf: 3, souris: false },
];
const ECRANS = ['journee', 'cat_msg', 'compta', 'cat_bord'];
// L'île flotte au-dessus de TOUS les écrans : aux deux tailles les plus serrées
// à la souris, on rend aussi les autres (île + débordement seulement).
const ECRANS_ILE = ['cat_ventes', 'cat_annonces', 'cat_achats', 'plat_leboncoin', 'plat_ebay', 'garage', 'dashboard', 'organisation', 'settings', 'communaute'];
const CONFIGS_ILE = ['1366x630', '1024x700', '960x900'];

let ok = 0, ko = 0;
const dit = (c, l, d) => { if (c) { ok++; console.log('  ✅ ' + l); } else { ko++; console.log('  ❌ ' + l + (d ? ' — ' + d : '')); } };

const MESURE = () => {
  const vis = (e) => { if (!e) return false; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const de = document.documentElement, mainEl = document.querySelector('.vrm-main') || document.querySelector('main');
  const out = { vw: de.clientWidth, vh: innerHeight, docSh: de.scrollHeight, docSw: de.scrollWidth, bodySh: document.body.scrollHeight,
    mainSw: mainEl ? mainEl.scrollWidth : 0, mainCw: mainEl ? mainEl.clientWidth : 0,
    sidebar: vis(document.querySelector('.vrm-sidebar')), tabbar: vis(document.querySelector('.vrm-tabbar')),
    mort: /n'a pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText || '') };
  // Le rail : chaque entrée doit être visible, ou la zone qui défile doit DIRE
  // qu'il y a une suite (un fondu, `data-rail-suite`).
  const sc = document.querySelector('.vrm-rail-scroll'); out.railCaches = []; out.railIndice = false; out.railActifVu = null;
  if (sc && vis(sc)) {
    const rs = sc.getBoundingClientRect(); const cs = getComputedStyle(sc);
    const masque = (cs.maskImage && cs.maskImage !== 'none') || (cs.webkitMaskImage && cs.webkitMaskImage !== 'none');
    out.railIndice = !!(masque && sc.getAttribute('data-rail-suite'));
    const bas = Math.min(rs.bottom, innerHeight), haut = Math.max(rs.top, 0);
    sc.querySelectorAll('.vrm-rail-button').forEach((b) => {
      const r = b.getBoundingClientRect(); const dedans = r.top >= haut - 1 && r.bottom <= bas + 1;
      if (!dedans) out.railCaches.push(b.getAttribute('aria-label') || '?');
      if (b.getAttribute('aria-current') === 'page') out.railActifVu = dedans;
    });
    out.railDeborde = sc.scrollHeight > sc.clientHeight + 1;
  }
  // Messages : colonne des conversations et panneau.
  out.msgBarre = !!document.querySelector('[data-messagerie] .vrm-msg-bar');
  // Ma journée, « À faire » : aucune ligne ne laisse une case vide à droite.
  out.trous = [];
  const tl = document.querySelector('.vrm-day-task-list');
  if (vis(tl)) {
    const lr = tl.getBoundingClientRect(); const lignes = new Map();
    for (const k of tl.children) { if (!vis(k)) continue; const r = k.getBoundingClientRect(); const cle = Math.round(r.top / 4); lignes.set(cle, Math.max(lignes.get(cle) || 0, r.right)); }
    for (const [, droite] of lignes) if (lr.right - droite > 24) out.trous.push(Math.round(lr.right - droite));
  }
  const ib = document.querySelector('.vrm-inbox-column'), ch = document.querySelector('.vrm-chat-column');
  if (vis(ib)) { out.ibCw = ib.clientWidth; out.ibSw = ib.scrollWidth; out.ibH = Math.round(ib.getBoundingClientRect().height); out.ibW = Math.round(ib.getBoundingClientRect().width); }
  if (vis(ch)) { out.chH = Math.round(ch.getBoundingClientRect().height); }
  // L'île : rien d'interactif dessous quand elle flotte.
  const h = document.querySelector('header.vrm-app-header'); out.sousIle = [];
  if (vis(h) && /absolute|fixed/.test(getComputedStyle(h).position)) {
    const b = h.getBoundingClientRect();
    // Tout ce qui se lit ou se touche : les boutons, et chaque texte (une feuille
    // qui porte des lettres) — le résumé « CA finalisé · Disponible » d'une
    // plateforme passait sous l'île sans être un bouton.
    const feuillesTexte = [...document.querySelectorAll('main *')].filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1));
    // Pour un texte on mesure les LETTRES (une plage sur ses nœuds texte), pas
    // la boîte : un paragraphe en bloc s'étend sous l'île sans y écrire un mot.
    const rectTexte = (el) => { const rg = document.createRange(); let L = 1e9, T = 1e9, R = -1e9, B = -1e9; for (const n of el.childNodes) { if (n.nodeType !== 3 || !n.textContent.trim()) continue; rg.selectNodeContents(n); for (const q of rg.getClientRects()) { L = Math.min(L, q.left); T = Math.min(T, q.top); R = Math.max(R, q.right); B = Math.max(B, q.bottom); } } return R < L ? null : { left: L, top: T, right: R, bottom: B, width: R - L, height: B - T }; };
    const touche = new Set(document.querySelectorAll('main button, main a, main input, main select, main h1, main h2'));
    [...touche, ...feuillesTexte.filter((el) => !touche.has(el))].forEach((el) => {
      if (!vis(el)) return; const r = touche.has(el) ? el.getBoundingClientRect() : rectTexte(el); if (!r || r.width < 6 || r.height < 6) return;
      if (el.closest('.vrm-sr')) return;
      if (r.right > b.left - 4 && r.left < b.right + 4 && r.bottom > b.top - 4 && r.top < b.bottom + 4) out.sousIle.push((el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30));
    });
  }
  return out;
};

(async () => {
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ port ' + PORT + ' pris — relance avec BANC_PORT=…'); process.exit(1); });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  for (const cf of CONFIGS) {
    console.log(`\n── ${cf.id} (${cf.souris ? 'souris' : 'doigt'})`);
    const ctx = await b.newContext({ viewport: { width: cf.w, height: cf.h }, deviceScaleFactor: cf.dsf, isMobile: !cf.souris, hasTouch: !cf.souris,
      userAgent: cf.souris ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0'
        : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
    await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r3) => { const t3 = r3.request().resourceType(); if (t3 === 'image' || t3 === 'media' || t3 === 'font') return r3.abort(); return r3.continue(); });
    await pg.route('**://*.vinted.net/**', (r4) => r4.abort());
    await pg.route('**/rest/v1/**', (route) => {
      const u = metaVersData(route.request().url());
      const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
      if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
      if (/\/rest\/v1\/vinted_accounts/.test(u)) { const ow = (/owner=eq\.([^&]*)/.exec(u) || [])[1]; return j(accounts.map((a) => ({ ...a, owner: ow ? decodeURIComponent(ow) : a.owner }))); }
      const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1]; const S = sel ? decodeURIComponent(sel) : null;
      if (/id=eq\.main/.test(u)) return j(main.map((r) => projette(r, S)));
      if (/transaction->>id/.test(u)) return j(txn);
      const eq = /id=eq\.([^&]*)/.exec(u); if (eq) { const k = decodeURIComponent(eq[1]); return j(rows.filter((r) => r.id === k).map((r) => projette(r, S))); }
      const m = /id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + decodeURIComponent(m[1]).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, S))); }
      return j([]);
    });
    await pg.route('**/api/**', (r2) => r2.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
    for (const t of [...ECRANS, ...(CONFIGS_ILE.includes(cf.id) ? ECRANS_ILE : [])]) {
      await pg.goto(`http://localhost:${PORT}/?tab=${t}`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('.vrm-app-shell', { timeout: 20000 }).catch(() => {});
      // Messages : on attend que la LISTE soit rendue (sa tête porte le texte pour
      // lecteur d'écran qui rallongeait la page) — sinon on mesure un chargement.
      if (t === 'cat_msg') await pg.waitForSelector('[data-messagerie] .vrm-msg-bar', { timeout: 15000 }).catch(() => {});
      await pg.waitForTimeout(2600);
      const r = await pg.evaluate(MESURE);
      if (CAPT) { try { await pg.screenshot({ path: path.join(CAPT, `${t}-${cf.id}.png`) }); } catch (_) {} }
      const nom = `${cf.id} ${t}`;
      dit(!r.mort, `${nom} : l'écran s'affiche`);
      dit(r.docSw <= r.vw + 1 && r.mainSw <= r.mainCw + 1, `${nom} : aucun débordement horizontal`, `page ${r.docSw}/${r.vw}, main ${r.mainSw}/${r.mainCw}`);
      if (cf.souris) dit(r.sidebar && !r.tabbar, `${nom} : coque ordinateur à la souris (rail, pas de barre du bas)`, `rail ${r.sidebar} · barre du bas ${r.tabbar}`);
      else dit(!r.sidebar && r.tabbar, `${nom} : coque téléphone au doigt`, `rail ${r.sidebar} · barre du bas ${r.tabbar}`);
      if (t === 'journee' && cf.souris) dit(r.trous.length === 0, `${nom} : « À faire » ne laisse aucune case vide`, `vide de ${r.trous.join(', ')} px`);
      if (r.sidebar) {
        dit(r.railCaches.length === 0 || r.railIndice, `${nom} : aucune entrée du rail cachée sans indice`, `cachées : ${r.railCaches.join(', ')}`);
        if (r.railActifVu !== null) dit(r.railActifVu, `${nom} : l'entrée active du rail est dans la vue`);
        dit(r.sousIle.length === 0, `${nom} : rien sous l'île d'actions`, r.sousIle.join(' | '));
      }
      if (t === 'cat_msg' && cf.w >= 768) {
        dit(r.msgBarre, `${nom} : la liste des conversations est rendue`);
        dit(r.docSh <= r.vh + 1, `${nom} : une seule zone défile (la page ne défile pas en plus de la liste)`, `document ${r.docSh} pour ${r.vh} de haut`);
        if (cf.souris && cf.w >= 1024 && r.ibCw) {
          dit(r.ibSw <= r.ibCw + 2, `${nom} : la colonne des conversations ne défile pas en largeur`, `${r.ibSw}/${r.ibCw}`);
          dit(r.ibW >= 330, `${nom} : la colonne des conversations fait au moins 330 px`, `${r.ibW} px`);
          if (r.chH) dit(Math.abs(r.ibH - r.chH) <= 4, `${nom} : liste et panneau ont la même hauteur (pas de vide sous la liste)`, `liste ${r.ibH} · panneau ${r.chH}`);
        }
      }
    }
    if (errs.length) console.log('  (erreurs de page : ' + errs.slice(0, 3).join(' | ') + ')');
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(`\n${ok} conformes · ${ko} non conformes`);
  process.exit(ko ? 1 : 0);
})();
