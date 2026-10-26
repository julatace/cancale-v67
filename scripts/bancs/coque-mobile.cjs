// BANC — la COQUE de l'app (en-tête, barre du bas, sous-onglets des
// plateformes, titre d'écran) sur téléphone (390 px) et ordinateur (1512 px),
// en clair ET en sombre — Ma journée, Vinted, Leboncoin, Paramètres, eBay. Demande de Julien (16 octobre) : « ça fait encore un
// peu trop vibe-codé… c'est pas encore optimal surtout sur téléphone ».
//
// Données INVENTÉES (aucune donnée réelle : ce banc vit dans le dépôt, public).
// Il juge ce qui est RENDU, jamais un libellé exact (§6.5) :
//   1. l'écran s'affiche, sans erreur, sans débordement horizontal ;
//   2. safe-area : la barre du bas ne recouvre pas le DERNIER contenu (on
//      défile au bout de la zone qui défile et on mesure) ;
//   3. cibles tactiles ≥ 44 px pour la coque (en-tête, barre du bas, sous-onglets) ;
//   4. l'onglet actif est signalé (`aria-current="page"`) et c'est le bon ;
//   5. l'en-tête téléphone porte le TITRE de l'écran courant.
// Captures : SHOTS=<dossier> BANC_PORT=54xx node scripts/bancs/coque-mobile.cjs
'use strict';
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 5431;
const SHOTS = process.env.SHOTS || '';

const maintenant = new Date(2026, 9, 15, 15, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const UID = '111';
let nPhoto = 0;
const vente = (id, titre, prix, statut, d, extra = {}) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` }, ...extra });
const VENTES = [
  vente(7001, 'Nike Air Max 90 blanche taille 42', 65, 'Le paiement a été validé', il(0, 11), { transaction_user_status: 'needs_action' }),
  vente(7002, 'Adidas Samba OG noir taille 40', 72, 'Le paiement a été validé', il(0, 9), { transaction_user_status: 'needs_action' }),
  vente(7003, 'Salomon XT-6 gris taille 43', 110, 'Colis en cours d\'acheminement', il(1), { transaction_user_status: 'waiting' }),
  vente(7004, 'New Balance 550 crème taille 41', 58, 'Commande finalisée', il(3), { transaction_user_status: 'completed' }),
  vente(7005, 'Asics Gel-Kayano 14 argent taille 44', 89, 'Commande finalisée', il(2), { transaction_user_status: 'completed' }),
];
const ANNONCES = Array.from({ length: 8 }, (_, k) => ({ id: 6000 + k, title: ['Nike Dunk Low panda taille 38', 'Adidas Gazelle bleu taille 41', 'Salomon XT-4 noir taille 42', 'Asics Gel-1130 blanc taille 40'][k % 4], price: { amount: String(40 + k * 7), currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: il(30 + k).toISOString(), favourite_count: k, view_count: 3 + k, photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/a${k}.jpeg?s=x` } }));
const CONVS = [1, 2].map((k) => ({ id: 9000 + k, unread: true, updated_at: il(k - 1, 10).toISOString(), opposite_user: { login: 'acheteur' + k }, description: 'Bonjour, toujours dispo ?' }));
const ACCOUNTS = [{ id: 1, vinted_user_id: UID, login: 'boutique_demo', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const LIGNES = [
  { id: `harvest_${UID}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: `harvest_${UID}_listings`, data: { capturedAt: cap, payload: { items: ANNONCES, pagination: { total_entries: ANNONCES.length } } } },
  { id: `harvest_${UID}_inbox`, data: { capturedAt: cap, payload: { conversations: CONVS } } },
  { id: `harvest_${UID}_billing`, data: { capturedAt: cap, payload: { escrow: { amount: '420.00', currency_code: 'EUR' }, main: { amount: '96.50', currency_code: 'EUR' } } } },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });

const teintes = ['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf', '#d8d0d6', '#d3d8de', '#ddd8cc', '#cdd2d8', '#d6d1c8'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${teintes[k % teintes.length]}"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 280 300 282 L90 282 C70 282 62 268 70 250 Z" fill="rgba(30,34,40,.55)"/></svg>`;

const ECRANS = [
  { tab: 'journee', bar: 'Accueil', titre: /journée|accueil|bonjour|bon après-midi|bonsoir/i },
  { tab: 'plat_vinted', bar: 'Vinted', titre: /vinted/i },
  { tab: 'plat_leboncoin', bar: 'Leboncoin', titre: /leboncoin/i },
  { tab: 'settings', bar: 'Gestion', titre: /réglages|paramètres/i },
  { tab: 'plat_ebay', bar: 'eBay', titre: /ebay/i },
];

const ouvrir = async (b, vp, sombre, tab) => {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((d) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); localStorage.setItem('vinted_dark', JSON.stringify(d)); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z_]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) { const m = /^([a-z_]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; }
        return o;
      }
      return { ...r, updated_at: cap, cap: r.data.capturedAt };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-main') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(2600);
  return { ctx, pg, errs };
};

// Ce que la coque rend, mesuré.
const lire = (pg, tel) => pg.evaluate((tel) => {
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const petits = [];
  const mesure = (e, ou) => { const r = e.getBoundingClientRect(); if (!vis(e)) return; if (Math.min(r.width, r.height) < 43.5) petits.push(`${ou}:${(e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 18)} ${Math.round(r.width)}×${Math.round(r.height)}`); };
  const header = document.querySelector('.vrm-app-header');
  const nav = document.querySelector('.vrm-mobile-nav');
  if (tel) {
    header && header.querySelectorAll('button').forEach((b) => mesure(b, 'en-tête'));
    nav && nav.querySelectorAll(':scope > button, :scope > * > button').forEach((b) => mesure(b, 'barre'));
    document.querySelectorAll('[data-segment] button, [role="tablist"] [role="tab"]').forEach((b) => { if (!b.closest('.vrm-app-header') && !b.closest('.vrm-mobile-nav')) mesure(b, 'onglets'); });
  }
  const actifBarre = tel
    ? [...(nav ? nav.querySelectorAll('[aria-current="page"]') : [])].map((e) => (e.getAttribute('aria-label') || e.innerText || '').trim())
    : [...document.querySelectorAll('.vrm-sidebar [aria-current="page"]')].map((e) => (e.innerText || '').trim());
  const titreTete = tel && header ? ((header.querySelector('[data-titre-ecran]') || {}).innerText || '').trim() : '';
  return {
    petits, actifBarre, titreTete,
    navVisible: vis(nav), navH: nav ? Math.round(nav.getBoundingClientRect().height) : 0,
    headerH: header ? Math.round(header.getBoundingClientRect().height) : 0,
    tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
    deb: document.documentElement.scrollWidth - window.innerWidth,
  };
}, tel);

// La barre du bas ne doit jamais couvrir le dernier contenu : on défile au
// bout de `.vrm-main` et on compare le bas du dernier élément visible au haut
// de la barre.
const finDePage = (pg) => pg.evaluate(async () => {
  const main = document.querySelector('.vrm-main');
  const nav = document.querySelector('.vrm-mobile-nav');
  if (!main || !nav) return { ok: true, det: 'pas de barre' };
  main.scrollTop = main.scrollHeight; await new Promise((r) => setTimeout(r, 400));
  const haut = nav.getBoundingClientRect().top;
  // Le bas VISIBLE d'un élément : on retranche ce que ses ancêtres coupent
  // (un repli fermé, une rangée qui défile, une carte `overflow:hidden`).
  const basVisible = (e) => {
    const r = e.getBoundingClientRect(); let bottom = r.bottom, top = r.top;
    for (let a = e.parentElement; a && a !== main; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.overflow !== 'visible' || s.overflowY !== 'visible') { const ra = a.getBoundingClientRect(); bottom = Math.min(bottom, ra.bottom); top = Math.max(top, ra.top); }
    }
    return bottom > top ? bottom : -1;
  };
  let bas = 0, quoi = '';
  for (const e of main.querySelectorAll('*')) {
    if (e.children.length) continue;
    if (e.checkVisibility && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    if (r.height < 4 || r.width < 4 || s.position === 'fixed') continue;
    const b = basVisible(e);
    if (b > bas && r.top < innerHeight) { bas = b; quoi = (e.innerText || e.tagName).trim().slice(0, 30); }
  }
  return { ok: bas <= haut + 0.5, det: `dernier contenu ${Math.round(bas)} px · barre ${Math.round(haut)} px (${quoi})` };
});

(async () => {
  let b;
  try {
    await new Promise((res) => srv.listen(PORT, res));
    b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const tel = vp.width < 600;
      for (const sombre of [false, true]) {
        for (const e of ECRANS) {
          console.log(`\n── ${e.tab} · ${vp.width} px · ${sombre ? 'sombre' : 'clair'}`);
          await essaie(`${e.tab} ${vp.width} ${sombre}`, async () => {
            const { ctx, pg, errs } = await ouvrir(b, vp, sombre, e.tab);
            const lu = await lire(pg, tel);
            if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `coque-${e.tab}-${vp.width}-${sombre ? 'sombre' : 'clair'}.png`) });
            dit(!lu.tombe && errs.length === 0, 'l’écran s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
            dit(lu.deb <= 1, 'aucun débordement horizontal', `${lu.deb} px`);
            const actif = lu.actifBarre.join(' | ');
            if (tel) {
              dit(lu.actifBarre.length === 1 && lu.actifBarre[0].includes(e.bar), 'la barre du bas signale le bon onglet (aria-current)', `« ${actif} »`);
              dit(lu.petits.length === 0, 'cibles tactiles de la coque ≥ 44 px', lu.petits.join(' · '));
              dit(lu.navVisible && lu.navH >= 49, 'la barre du bas est là, à hauteur native', `${lu.navH} px`);
              dit(e.titre.test(lu.titreTete), 'l’en-tête porte le titre de l’écran courant', `« ${lu.titreTete} »`);
              const fin = await finDePage(pg);
              dit(fin.ok, 'la barre du bas ne recouvre pas le dernier contenu', fin.det);
              if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `coque-${e.tab}-${vp.width}-${sombre ? 'sombre' : 'clair'}-fin.png`) });
              if (e.tab === 'plat_vinted') {
                await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); m.scrollTop = 400; });
                await pg.waitForTimeout(500);
                const t = await pg.evaluate(() => { const h = document.querySelector('.vrm-app-header'); const t = h && h.querySelector('[data-titre-ecran]'); return t ? Number(getComputedStyle(t).opacity) : -1; });
                dit(t > 0.9, 'au défilement, le titre court apparaît dans l’en-tête', `opacité ${t}`);
                if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `coque-${e.tab}-${vp.width}-${sombre ? 'sombre' : 'clair'}-defile.png`) });
                await pg.locator('.vrm-mobile-nav').getByRole('button', { name: 'Gestion', exact: true }).tap();
                await pg.waitForTimeout(600);
                const menu = await pg.evaluate(() => { const m = document.querySelector('[role="menu"]'); if (!m) return null; const r = m.getBoundingClientRect(); return { items: m.querySelectorAll('[role="menuitem"]').length, bas: Math.round(r.bottom), h: innerHeight, petits: [...m.querySelectorAll('[role="menuitem"]')].filter((b) => b.getBoundingClientRect().height < 43.5).length }; });
                dit(menu && menu.items >= 5 && menu.petits === 0 && menu.bas <= menu.h + 1, 'la feuille « Ton espace » s’ouvre, rangées ≥ 44 px, dans l’écran', JSON.stringify(menu));
                if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `coque-menu-${vp.width}-${sombre ? 'sombre' : 'clair'}.png`) });
              }
            } else {
              dit(lu.actifBarre.length >= 1, 'la barre latérale signale l’écran courant (aria-current)', `« ${actif} »`);
            }
            await ctx.close();
          });
        }
      }
    }
  } catch (e) { dit(false, 'banc', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
