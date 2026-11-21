// Banc : la mise en page TABLETTE (iPad), 11 novembre — récit docs/passation/2026-11-11-ipad.md.
//
// Mesuré sur origin/main avant le chantier : un iPad en PORTRAIT (744 à 1023 px,
// au doigt) recevait la coque TÉLÉPHONE étirée (barre du bas, une colonne de
// 820 px), et en PAYSAGE la coque ordinateur avec ses commandes de 32-36 px
// (trop petites pour un doigt) — et la rotation passait d'une coque à l'autre,
// ce qui remontait l'écran (fiche refermée, défilement perdu).
//
// Ce banc rend l'app aux tailles réelles des iPad (tactile, sans survol, avec
// l'agent utilisateur « Macintosh » d'iPadOS : le choix ne doit JAMAIS lire le
// nom de l'appareil) et juge la RÈGLE, pas un libellé :
//   · tablette (portrait comme paysage) : rail à gauche, pas de barre du bas,
//     `data-tablette` posé sur la racine ; rien ne déborde ; chaque commande du
//     rail, de l'île et de l'écran fait au moins 44 px ; rien n'est caché en
//     attendant un survol ;
//   · rotation : la coque n'est pas remontée (même nœud `.vrm-main`), la
//     conversation ouverte le reste, le défilement est gardé ;
//   · Magic Keyboard : « g » puis « p » ouvre Paramètres, « / » la recherche ;
//   · témoins : 390 et iPhone couché (932×430) au doigt gardent la coque
//     téléphone ; 1512 et 900 à la souris gardent la coque ordinateur SANS
//     les règles tablette.
//
// Lancer : npm run build && BANC_PORT=… node scripts/bancs/ipad.cjs
//   CAPTURES=dossier pour garder les images · SOMBRE=1 pour l'app en sombre
//   ONLY=ipad10-portrait,… pour une partie des tailles.
// Données INVENTÉES (aucun vrai pseudo), comme edge-tailles.cjs.
const path = require('path'), fs = require('fs'), http = require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');

const DIST = path.join(__dirname, '..', '..', 'dist');
const ISO = (ms) => new Date(Date.now() - ms).toISOString();
const SOMBRE = process.env.SOMBRE === '1';
const accounts = [
  { vinted_user_id: '111', login: 'boutique_test_a', domain: 'www.vinted.fr', updated_at: ISO(0), created_at: ISO(500 * 3600e3) },
  { vinted_user_id: '222', login: 'boutique_test_b', domain: 'www.vinted.fr', updated_at: ISO(0), created_at: ISO(500 * 3600e3) },
];
const main = [{ id: 'main', data: { vinted_dark: SOMBRE } }];
const INBOX = accounts.map((a, k) => ({ id: `harvest_${a.vinted_user_id}_inbox`, data: { capturedAt: ISO(60e3), payload: { conversations: Array.from({ length: 18 }, (_, i) => ({
  id: 900000 + k * 100 + i, description: 'Bonjour, est-elle toujours disponible ? ' + i, unread: i % 3 === 0, updated_at: ISO((i + 1) * 3600e3),
  opposite_user: { id: 70000 + i, login: 'acheteur_test_' + i, photo: null }, item_count: 1, item_photos: [],
})), pagination: { current_page: 1, total_pages: 1 } } } }));
const LISTV = accounts.map((a, k) => ({ id: `harvest_${a.vinted_user_id}_listings`, data: { capturedAt: ISO(60e3), payload: { items: Array.from({ length: 14 }, (_, i) => ({
  id: 5000000 + k * 100 + i, title: `Paire test ${k}-${i}`, brand_title: 'Nike', size_title: String(38 + (i % 8)), price: { amount: String(30 + i), currency_code: 'EUR' },
  is_closed: false, is_hidden: false, is_draft: false, photo: { url: '' }, created_at_ts: ISO((i + 2) * 86400e3),
})), pagination: null } } }));
const rows = [...LISTV, ...INBOX];

function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const alias = m[1] || m[2].split('->').pop().replace(/^>/, ''); const src = m[2];
    if (src === 'id' || src === 'updated_at' || src === 'owner') { out[alias] = row[src]; continue; }
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
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9473;
const CAPT = process.env.CAPTURES || '';
if (CAPT) fs.mkdirSync(CAPT, { recursive: true });

// iPadOS envoie l'agent utilisateur d'un Mac : c'est exprès qu'on le sert.
const UA_IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_PC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const CONFIGS = [
  { id: 'ipad10-portrait', w: 820, h: 1180, tablette: 'etroite', tourne: 'ipad10-paysage' },
  { id: 'ipad10-paysage', w: 1180, h: 820, tablette: 'large' },
  { id: 'tactile-768', w: 768, h: 1024, tablette: 'etroite' },
  { id: 'mini-portrait', w: 744, h: 1133, tablette: 'etroite', tourne: 'mini-paysage' },
  { id: 'mini-paysage', w: 1133, h: 744, tablette: 'large' },
  { id: 'pro-portrait', w: 1024, h: 1366, tablette: 'large' },
  { id: 'pro-paysage', w: 1366, h: 1024, tablette: 'large' },
  { id: 'iphone-390', w: 390, h: 844, telephone: true },
  { id: 'iphone-couche', w: 932, h: 430, telephone: true },
  { id: 'souris-1512', w: 1512, h: 945, souris: true },
  { id: 'souris-900', w: 900, h: 760, souris: true },
].filter((c) => !process.env.ONLY || process.env.ONLY.split(',').includes(c.id));
const PAR = Object.fromEntries(CONFIGS.map((c) => [c.id, c]));
const ECRANS = ['journee', 'cat_annonces', 'cat_ventes', 'cat_msg', 'cat_bord', 'compta', 'cat_achats', 'garage', 'settings'];

let ok = 0, ko = 0;
const dit = (c, l, d) => { if (c) { ok++; console.log('  ✅ ' + l); } else { ko++; console.log('  ❌ ' + l + (d ? ' — ' + d : '')); } };

const MESURE = () => {
  const vis = (e) => { if (!e) return false; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const de = document.documentElement, mainEl = document.querySelector('.vrm-main') || document.querySelector('main');
  const racine = document.querySelector('.vrm-app-shell');
  const out = { mainDroite: mainEl ? Math.round(mainEl.getBoundingClientRect().right) : 0, vw: de.clientWidth, vh: innerHeight, docSw: de.scrollWidth, mainSw: mainEl ? mainEl.scrollWidth : 0, mainCw: mainEl ? mainEl.clientWidth : 0,
    sidebar: vis(document.querySelector('.vrm-sidebar')), tabbar: vis(document.querySelector('.vrm-tabbar')),
    tablette: (racine && racine.getAttribute('data-tablette')) || '', coarse: matchMedia('(pointer: coarse)').matches,
    mort: /n'a pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText || ''),
    railL: (() => { const s = document.querySelector('.vrm-sidebar'); return s && vis(s) ? Math.round(s.getBoundingClientRect().width) : 0; })() };
  out.libelles = (() => { const bs = [...document.querySelectorAll('.vrm-sidebar .vrm-rail-button')].filter(vis); return bs.length > 0 && bs.every((b) => vis(b.querySelector('.vrm-rail-lib'))); })();
  // La barre du haut : la recherche, les filtres de site et l'île ne se chevauchent pas.
  out.chevauche = (() => {
    const boites = [document.querySelector('.vrm-barre-recherche'), document.querySelector('.vrm-barre-haut-droite .vrm-filtre-site'), document.querySelector('header.vrm-app-header')].filter(vis).map((e) => e.getBoundingClientRect());
    for (let i = 0; i < boites.length; i++) for (let j = i + 1; j < boites.length; j++) { const a = boites[i], b = boites[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) return `${Math.round(a.left)}–${Math.round(a.right)} / ${Math.round(b.left)}–${Math.round(b.right)}`; }
    return '';
  })();
  // Ce qui se touche : rail, île et écran. Une feuille ouverte n'est pas mesurée ici.
  const zones = [document.querySelector('.vrm-sidebar'), document.querySelector('header.vrm-app-header'), mainEl].filter(Boolean);
  const SEL = 'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="checkbox"], select, summary, input:not([type="hidden"]):not([type="file"])';
  const petits = [], fantomes = []; let n = 0;
  // L'opacité vue, et si elle est en train de changer (un fondu d'arrivée n'est pas un survol).
  const opaciteVisible = (el) => { let o = 1, anime = false; for (let e = el; e && e !== document.body; e = e.parentElement) { const op = Number(getComputedStyle(e).opacity); if (op < 1 && e.getAnimations && e.getAnimations().length) anime = true; o *= op; } return { o, anime }; };
  for (const z of zones) for (const el of z.querySelectorAll(SEL)) {
    if (el.closest('.vrm-sr, [inert], [aria-hidden="true"]')) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none') continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;   // hors de la vue : mesuré quand on y défile
    // Un champ caché derrière son libellé (case maison) : c'est le libellé qu'on touche.
    if (el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type) && (cs.opacity === '0' || r.width < 6)) continue;
    // Un <select> natif transparent posé SUR son libellé visible (le doigt ouvre la liste du système) : c'est le libellé qu'on voit.
    if (el.tagName === 'SELECT' && cs.opacity === '0' && el.closest('label') && el.closest('label') !== el) continue;
    // Un lien DANS une phrase se touche comme la phrase (WCAG 2.5.8, exception « en ligne »).
    if (el.tagName === 'A' && el.parentElement && (el.parentElement.tagName === 'P' || (/inline/.test(cs.display) && /^(SPAN|LI|DIV|SMALL)$/.test(el.parentElement.tagName) && (el.parentElement.innerText || '').length > (el.innerText || '').length + 12))) continue;
    n++;
    const op = opaciteVisible(el); if (op.anime) continue;
    if (cs.visibility === 'hidden' || op.o < 0.15) { fantomes.push((el.getAttribute('aria-label') || el.innerText || el.tagName).trim().slice(0, 28)); continue; }
    if (r.height < 43.5 || r.width < 43.5) petits.push(`${(el.getAttribute('aria-label') || el.innerText || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 26)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  out.nCibles = n; out.petits = petits; out.fantomes = fantomes;
  return out;
};

async function nouvelleVue(b, cf) {
  const tactile = !cf.souris;
  const ctx = await b.newContext({ viewport: { width: cf.w, height: cf.h }, deviceScaleFactor: 1, isMobile: tactile, hasTouch: tactile,
    userAgent: cf.telephone ? UA_IPHONE : tactile ? UA_IPAD : UA_PC });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, SOMBRE);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r3) => { const t3 = r3.request().resourceType(); if (t3 === 'image' || t3 === 'media' || t3 === 'font') return r3.abort(); return r3.continue(); });
  await pg.route('**/rest/v1/**', (route) => {
    const u = metaVersData(route.request().url());
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) { const ow = (/owner=eq\.([^&]*)/.exec(u) || [])[1]; return j(accounts.map((a) => ({ ...a, owner: ow ? decodeURIComponent(ow) : a.owner }))); }
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1]; const S = sel ? decodeURIComponent(sel) : null;
    if (/id=eq\.main/.test(u)) return j(main.map((r) => projette(r, S)));
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) { const k = decodeURIComponent(eq[1]); return j(rows.filter((r) => r.id === k).map((r) => projette(r, S))); }
    const m = /id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + decodeURIComponent(m[1]).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, S))); }
    return j([]);
  });
  await pg.route('**/api/**', (r2) => r2.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  return { ctx, pg, errs };
}
const aller = async (pg, t) => {
  await pg.goto(`http://localhost:${PORT}/?tab=${t}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-app-shell', { timeout: 20000 }).catch(() => {});
  if (t === 'cat_msg') await pg.waitForSelector('[data-messagerie] .vrm-msg-bar', { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(2400);
};

(async () => {
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch(() => { console.log('❌ port ' + PORT + ' pris — relance avec BANC_PORT=…'); process.exit(1); });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  for (const cf of CONFIGS) {
    console.log(`\n── ${cf.id} ${cf.w}×${cf.h} (${cf.souris ? 'souris' : 'doigt'})${SOMBRE ? ' · sombre' : ''}`);
    const { ctx, pg, errs } = await nouvelleVue(b, cf);
    for (const t of ECRANS) {
      await aller(pg, t);
      const r = await pg.evaluate(MESURE);
      if (CAPT) { try { await pg.screenshot({ path: path.join(CAPT, `${cf.id}-${t}${SOMBRE ? '-sombre' : ''}.png`) }); } catch (_) {} }
      const nom = `${cf.id} ${t}`;
      dit(!r.mort, `${nom} : l'écran s'affiche`);
      dit(r.docSw <= r.vw + 1 && r.mainSw <= r.mainCw + 1 && r.mainDroite <= r.vw + 1, `${nom} : aucun débordement horizontal`, `page ${r.docSw}/${r.vw}, main ${r.mainSw}/${r.mainCw}, bord droit de main ${r.mainDroite}`);
      if (cf.tablette) dit(!r.chevauche, `${nom} : recherche, filtres de site et île ne se chevauchent pas`, r.chevauche);
      if (cf.tablette) {
        dit(r.coarse, `${nom} : le banc sert bien un pointeur au doigt`);
        dit(r.sidebar && !r.tabbar, `${nom} : coque tablette (rail à gauche, pas de barre du bas)`, `rail ${r.sidebar} · barre du bas ${r.tabbar}`);
        dit(r.tablette === cf.tablette, `${nom} : disposition « ${cf.tablette} » posée sur la racine`, `data-tablette="${r.tablette}"`);
        if (cf.w <= 1199) dit(r.railL > 0 && r.railL <= 104 && r.libelles, `${nom} : ≤ 1199 px, rail étroit et libellé (icône + mot)`, `${r.railL} px · libellés ${r.libelles}`);
        dit(r.petits.length === 0, `${nom} : chaque commande fait au moins 44 px (${r.nCibles} mesurées)`, `${r.petits.length} trop petites : ${r.petits.slice(0, 6).join(' | ')}`);
        dit(r.fantomes.length === 0, `${nom} : rien n'attend un survol pour se montrer`, r.fantomes.slice(0, 6).join(' | '));
      } else if (cf.telephone) {
        dit(!r.sidebar && r.tabbar && !r.tablette, `${nom} : coque téléphone au doigt, sans règle tablette`, `rail ${r.sidebar} · barre ${r.tabbar} · tablette "${r.tablette}"`);
      } else {
        dit(r.sidebar && !r.tabbar && !r.tablette, `${nom} : coque ordinateur à la souris, sans règle tablette`, `rail ${r.sidebar} · barre ${r.tabbar} · tablette "${r.tablette}"`);
      }
    }
    if (cf.tablette) {
      // Magic Keyboard : les raccourcis de l'ordinateur répondent.
      await aller(pg, 'journee');
      await pg.mouse.click(Math.round(cf.w * 0.6), Math.round(cf.h * 0.5)).catch(() => {});
      await pg.keyboard.press('Escape');
      await pg.evaluate(() => { try { document.activeElement && document.activeElement.blur(); } catch (_) {} });
      await pg.keyboard.press('g'); await pg.keyboard.press('p'); await pg.waitForTimeout(1500);
      const reglages = await pg.evaluate(() => !!document.querySelector('.vrm-nav-compte[aria-current="page"], [data-nav-entree="settings"][aria-current="page"]') || /tab=settings/.test(location.search));
      dit(reglages, `${cf.id} clavier : « g » puis « p » ouvre Paramètres`);
      await pg.keyboard.press('/'); await pg.waitForTimeout(600);
      const cherche = await pg.evaluate(() => { const a = document.activeElement; return !!(a && (a.matches('input[type="search"], [role="combobox"], [data-recherche-champ], input') )); });
      dit(cherche, `${cf.id} clavier : « / » ouvre la recherche (le champ a le focus)`);
    }
    if (cf.tourne && PAR[cf.tourne] !== undefined) {
      const vers = PAR[cf.tourne];
      // Rotation 1 : la conversation ouverte reste ouverte.
      await aller(pg, 'cat_msg');
      const conv = pg.locator('.vrm-inbox-column button.vrm-inbox-row[data-conv]').nth(2);
      const voulue = await conv.getAttribute('data-conv', { timeout: 4000 }).catch(() => '');
      await conv.click({ timeout: 4000 }).catch(() => {});
      await pg.waitForTimeout(1200);
      const lire = () => { const c = document.querySelector('.vrm-chat-column'); return { sel: (c && c.getAttribute('data-conv-ouverte')) || '', meme: window.__vrmMain === document.querySelector('.vrm-main'), tablette: (document.querySelector('.vrm-app-shell') || {}).getAttribute?.('data-tablette') || '' }; };
      const avant = await pg.evaluate(() => { window.__vrmMain = document.querySelector('.vrm-main'); const c = document.querySelector('.vrm-chat-column'); return { sel: (c && c.getAttribute('data-conv-ouverte')) || '' }; });
      await pg.setViewportSize({ width: vers.w, height: vers.h }); await pg.waitForTimeout(1500);
      const apres = await pg.evaluate(lire);
      if (CAPT) { try { await pg.screenshot({ path: path.join(CAPT, `${cf.id}-rotation-messages${SOMBRE ? '-sombre' : ''}.png`) }); } catch (_) {} }
      dit(apres.meme, `${cf.id} → ${vers.id} : la rotation ne remonte pas l'écran (même nœud)`);
      dit(apres.tablette === vers.tablette, `${cf.id} → ${vers.id} : la disposition suit la rotation`, `data-tablette="${apres.tablette}"`);
      dit(!!voulue && avant.sel === voulue && apres.sel === voulue, `${cf.id} → ${vers.id} : la conversation ouverte le reste`, `touchée ${voulue} · avant ${avant.sel} · après ${apres.sel}`);
      // Rotation 2 (retour) : le défilement est gardé.
      await pg.setViewportSize({ width: cf.w, height: cf.h }); await aller(pg, 'cat_annonces');
      const pos = await pg.evaluate(() => {
        window.__vrmMain = document.querySelector('.vrm-main');
        const zone = [document.scrollingElement, ...document.querySelectorAll('.vrm-main, .vrm-main *')].find((e) => e && e.scrollHeight > e.clientHeight + 300 && /auto|scroll/.test(getComputedStyle(e).overflowY) || e === document.scrollingElement && e.scrollHeight > innerHeight + 300);
        if (!zone) return { y: -1 }; zone.scrollTop = 300; window.__vrmZone = zone; return { y: zone.scrollTop };
      });
      await pg.setViewportSize({ width: vers.w, height: vers.h }); await pg.waitForTimeout(1500);
      const pos2 = await pg.evaluate(() => ({ y: window.__vrmZone ? window.__vrmZone.scrollTop : -1, meme: window.__vrmMain === document.querySelector('.vrm-main') }));
      dit(pos.y > 0 && pos2.y > 0 && pos2.meme, `${cf.id} → ${vers.id} (Annonces) : le défilement est gardé à la rotation`, `avant ${pos.y} · après ${pos2.y} · même nœud ${pos2.meme}`);
    }
    if (errs.length) console.log('  (erreurs de page : ' + errs.slice(0, 3).join(' | ') + ')');
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(`\n${ok} conformes · ${ko} non conformes`);
  process.exit(ko ? 1 : 0);
})();
