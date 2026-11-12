// BANC — LA FINITION « PREMIUM » (1er nov., Julien : « améliore le rendu visuel
// surtout, le site doit être beaucoup plus premium » — sans nouvelle palette ni
// dégradé : la finition seule).
//
// Données INVENTÉES (le dépôt est public). Il juge ce qui est RENDU, jamais un
// libellé (§6.4) :
//   A. la colonne de gauche (ordinateur, 1512×950 · 1440×800 · 1280×720) : chaque
//      entrée est ATTEIGNABLE en entier — visible, ou la colonne défile d'elle-même
//      jusqu'à elle — et aucune n'est coupée par le bas de l'écran ; hauteur ≥ 34 px ; Paramètres visible SANS défiler ;
//   B. le bouton Envoyer du fil (Messages · Vinted, 390 tactile et 1512, clair et
//      sombre) : champ vide ⇒ il SE LIT désactivé (pas un cobalt délavé : un fond
//      neutre, opacité pleine) et dit pourquoi (`title`) ; texte saisi ⇒ cobalt
//      PLEIN (la couleur d'accent, opacité 1), icône lisible (contraste ≥ 4,5:1) ;
//   C. le fil : chaque bulle garde au moins 12 px entre son texte et ses bords ;
//      le pied d'envoi (rapides, champ, micro, Envoyer) tient DANS le fil ;
//   D. huit écrans (Ma journée, Annonces, Ventes, Colis, Messages, Achats,
//      Statistiques, Paramètres), 390 tactile et 1512, clair et sombre : rendu sans
//      erreur, sans débordement horizontal ; captures `SHOTS=<dossier>`.
// Rien n'est envoyé (aucune écriture attendue : le pont simulé note chaque `exec`).
'use strict';
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const { getPath } = require('./_minipgrest.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 5471;
const SHOTS = process.env.SHOTS || '';
const SEUL = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
const fait = (x) => !SEUL.length || SEUL.includes(x);

const maintenant = new Date(2026, 9, 15, 15, 30, 0);
const iso = (h) => new Date(maintenant.getTime() - h * 3600e3).toISOString();
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const UID = '111';
let nPhoto = 0;
const vente = (id, titre, prix, statut, d, extra = {}) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/a.jpeg` }, ...extra });
const VENTES = [
  vente(7001, 'Nike Air Max 90 blanche taille 42', 65, 'Le paiement a été validé', il(0, 11), { transaction_user_status: 'needs_action' }),
  vente(7002, 'Adidas Samba OG noir taille 40', 72, 'Le paiement a été validé', il(0, 9), { transaction_user_status: 'needs_action' }),
  vente(7003, 'Salomon XT-6 gris taille 43', 110, 'Colis en cours d\'acheminement', il(1), { transaction_user_status: 'waiting' }),
  vente(7004, 'New Balance 550 crème taille 41', 58, 'Commande finalisée', il(3), { transaction_user_status: 'completed' }),
  vente(7005, 'Asics Gel-Kayano 14 argent taille 44', 89, 'Commande finalisée', il(2), { transaction_user_status: 'completed' }),
];
const TITRE = 'Salomon XT-6 blanc';
const annonce = (id, titre, prix, fav, vues) => ({ id, url: 'https://www.vinted.fr/items/' + id, title: titre, brand: titre.split(' ')[0], size: '42', price: { amount: String(prix), currency_code: 'EUR' },
  photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/a.jpeg` }, is_closed: false, is_draft: false, is_hidden: false, favourite_count: fav, view_count: vues });
const ANNONCES = [annonce(801, TITRE, '120.0', 11, 120),
  ...Array.from({ length: 7 }, (_, k) => annonce(6000 + k, ['Nike Dunk Low panda taille 38', 'Adidas Gazelle bleu taille 41', 'Salomon XT-4 noir taille 42', 'Asics Gel-1130 blanc taille 40'][k % 4], 40 + k * 7, k, 30 + k * 9))];
const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: iso(h), description: desc, opposite_user: { id: 5000 + id, login } });
const FIL_OFFRE = { id: 501, opposite_user: { id: 5501, login: 'acheteur_m' }, transaction: { id: 9501, item_id: 801, status: 1, current_user_side: 'seller', item_title: TITRE },
  messages: [
    { id: 1, created_at_ts: iso(3), entity_type: 'message', entity: { id: 1, user_id: 5501, body: 'Bonjour ! Elle taille comment ?' } },
    { id: 2, created_at_ts: iso(2.9), entity_type: 'message', entity: { id: 2, user_id: 111, body: 'Bonjour, taille normale. Elle est comme neuve, portée deux fois, avec sa boîte d’origine.' } },
    { id: 3, created_at_ts: iso(2.5), entity_type: 'offer_request_message', entity: { id: 3, user_id: 5501, current: true, status: 10, status_title: '', price: { amount: '100.0' }, transaction_id: 9501, offer_request_id: 71 } },
    { id: 4, created_at_ts: iso(2.4), entity_type: 'message', entity: { id: 4, user_id: 5501, body: 'Vous feriez 100 € ?' } },
  ] };
const cap = maintenant.toISOString();
const LIGNES = [
  { id: `harvest_${UID}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: `harvest_${UID}_listings`, data: { uid: UID, type: 'listings', nItems: ANNONCES.length, capturedAt: cap, payload: { items: ANNONCES, pagination: { total_entries: ANNONCES.length } } } },
  { id: `harvest_${UID}_inbox`, data: { capturedAt: cap, payload: { conversations: [conv(501, 'acheteur_m', 'Vous feriez 100 € ?', true, 2.4), conv(502, 'acheteuse_c', 'La boîte est incluse ?', true, 1)] } } },
  { id: `harvest_${UID}_conv_501`, data: { capturedAt: cap, payload: { conversation: FIL_OFFRE } } },
  { id: `harvest_${UID}_billing`, data: { capturedAt: cap, payload: { escrow: { amount: '420.00', currency_code: 'EUR' }, main: { amount: '96.50', currency_code: 'EUR' } } } },
];
const ACCOUNTS = [{ id: 1, vinted_user_id: UID, login: 'boutique_demo', domain: 'www.vinted.fr', updated_at: cap }];
const NUMEROS = { '801': { numero: '80', min: '105' } };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
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

// Le pont simulé (extension à jour, connectée au compte 111) : chaque `exec` est noté.
const PONT = ({ version, fils }) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'boutique_demo' }, cmds: {} } });
    if (d.__vmr === 'exec') {
      window.__exec && window.__exec(JSON.stringify({ method: d.method, endpoint: d.endpoint }));
      const idc = (/\/conversations\/(\d+)$/.exec(d.endpoint || '') || [])[1];
      setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data: d.method === 'GET' ? { conversation: fils[idc] || null } : {} }), 50);
    }
  });
  post({ __vmr: 'ready', version });
};

const ouvrir = async (b, vp, sombre, tab) => {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const execs = [];
  await pg.exposeFunction('__exec', (s) => execs.push(JSON.parse(s)));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(({ d, n }) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); localStorage.setItem('vinted_dark', JSON.stringify(d)); localStorage.setItem('vrm_bascule_mineral_v1', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); } catch (_) {} }, { d: sombre, n: NUMEROS });
  await pg.addInitScript(PONT, { version: '5.296.0', fils: { 501: FIL_OFFRE } });
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
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
        // (6 nov.) chemin JSON lu comme PostgREST (getPath : `->>` = texte, absent ⇒ null) ; `alias:data->>x` était lu comme la clé « >x », toujours absente (§6.3).
        for (const champ of sel.split(',')) { const m = /^([a-z_]+):(data->.+)$/i.exec(champ); if (!m) continue; o[m[1]] = getPath(r, m[2]); }
        return o;
      }
      return { ...r, updated_at: cap, cap: r.data.capturedAt };
    };
    // Les quatre sites présents (comme chez lui) : la colonne porte « Plateformes »
    // (eBay, Leboncoin, Vestiaire) — 16 entrées et 6 groupes, le cas qui déborde.
    if (/id=in\.\(lbc_listings/.test(u) && /select=id(&|$)/.test(u)) return j([{ id: 'lbc_listings' }, { id: 'vc_listings' }, { id: 'ebay_listings' }]);
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
  return { ctx, pg, errs, execs };
};
const nom = (vp, sombre, quoi) => `${quoi}-${vp.width}x${vp.height}-${sombre ? 'sombre' : 'clair'}.png`;
const shot = async (pg, n) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, n) }); };

// Contraste WCAG entre deux couleurs CSS calculées (rgb/rgba sur un fond opaque).
const CONTRASTE = `(() => {
  const rgb = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  window.__contraste = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
})()`;

const ECRANS = [
  { tab: 'journee' }, { tab: 'annonces' }, { tab: 'ventes' }, { tab: 'cat_bord' },
  { tab: 'cat_msg' }, { tab: 'achats' }, { tab: 'dashboard' }, { tab: 'settings' },
];

(async () => {
  let b;
  try {
    await new Promise((res) => srv.listen(PORT, res));
    b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    // Sonde de mise au point : `SONDE='<expression JS>' SONDE_TAB=dashboard SONDE_VP=390x844 [SONDE_SOMBRE=1]`.
    if (process.env.SONDE) {
      const [w, h] = (process.env.SONDE_VP || '1512x950').split('x').map(Number);
      const { ctx, pg } = await ouvrir(b, { width: w, height: h }, !!process.env.SONDE_SOMBRE, process.env.SONDE_TAB || 'journee');
      if (process.env.SONDE_AVANT) { await pg.evaluate(process.env.SONDE_AVANT); await pg.waitForTimeout(1200); }
      console.log(JSON.stringify(await pg.evaluate(process.env.SONDE), null, 1));
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'sonde.png') });
      await ctx.close(); return;
    }

    // ── A. La colonne de gauche tient, à trois hauteurs d'écran ────────────
    if (fait('A')) for (const vp of [{ width: 1512, height: 950 }, { width: 1440, height: 800 }, { width: 1280, height: 720 }]) {
      console.log(`\n── A. colonne · ${vp.width}×${vp.height}`);
      await essaie(`A ${vp.width}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, false, 'journee');
        const avant = await pg.evaluate(() => {
          const rail = document.querySelector('.vrm-atelier-rail');
          if (!rail) return null;
          const bs = [...rail.querySelectorAll('.vrm-rail-button')].filter((e) => e.getClientRects().length);
          // Le conteneur qui défile (la colonne elle-même ou un de ses enfants).
          const defilant = [rail, ...rail.querySelectorAll('*')].find((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1; }) || null;
          const r = rail.getBoundingClientRect();
          return { n: bs.length, railBas: Math.round(r.bottom), railH: Math.round(r.height), defile: !!defilant,
            coupees: bs.filter((e) => { const x = e.getBoundingClientRect(); return x.bottom > innerHeight + .5 || x.bottom > r.bottom + .5; }).map((e) => e.innerText.trim()),
            // (6 nov.) Le plancher suit la densité de la colonne (3012b3df, 1er nov. après-midi,
            // styles-finition.css : « 1-2 : les entrées gardent 34 px ; 3-4 : 30 puis 28 px — seulement
            // quand, sinon, une ligne serait coupée »). Hors densité 3-4, 34 px reste exigé.
            densite: rail.getAttribute('data-rail-densite') || '0',
            petites: bs.filter((e) => e.getBoundingClientRect().height < ({ 3: 29.5, 4: 27.5 }[rail.getAttribute('data-rail-densite')] || 33.5)).map((e) => e.innerText.trim() + ' ' + Math.round(e.getBoundingClientRect().height)) };
        });
        await shot(pg, nom(vp, false, 'colonne'));
        dit(!!avant && avant.n >= 10 && avant.railH <= vp.height + 1, 'la colonne est rendue et ne dépasse pas la hauteur de l’écran', JSON.stringify(avant));
        dit(!!avant && !avant.coupees.some((t) => /Paramètres|Communauté/.test(t)), 'Paramètres et Communauté visibles EN ENTIER sans rien défiler', avant && avant.coupees.join(' · '));
        // Chaque entrée coupée doit pouvoir être amenée en entier dans la colonne.
        const atteintes = await pg.evaluate(() => {
          const rail = document.querySelector('.vrm-atelier-rail');
          const out = [];
          for (const e of rail.querySelectorAll('.vrm-rail-button')) {
            if (!e.getClientRects().length) continue;
            e.scrollIntoView({ block: 'nearest' });
            const x = e.getBoundingClientRect(); const r = rail.getBoundingClientRect();
            if (x.bottom > innerHeight + .5 || x.top < -.5 || x.bottom > r.bottom + .5) out.push(e.innerText.trim() + ` ${Math.round(x.top)}–${Math.round(x.bottom)}`);
          }
          return out;
        });
        dit(atteintes.length === 0, 'chaque entrée (Paramètres compris) s’atteint EN ENTIER, sans être coupée par le bas', atteintes.join(' · '));
        dit(avant && avant.petites.length === 0, 'aucune entrée sous 34 px de haut (30/28 px seulement en densité 3/4, quand sinon une ligne serait coupée)', avant && `densité ${avant.densite}${avant.petites.length ? ' — ' + avant.petites.join(' · ') : ''}`);
        dit(errs.length === 0, 'aucune erreur', errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
    }

    // ── B/C. Le fil de Messages : Envoyer, bulles, pied ─────────────────────
    if (fait('B')) for (const vp of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) {
      for (const sombre of [false, true]) {
        const tel = vp.width < 600;
        console.log(`\n── B. fil · ${vp.width} px · ${sombre ? 'sombre' : 'clair'}`);
        await essaie(`B ${vp.width} ${sombre}`, async () => {
          const { ctx, pg, errs, execs } = await ouvrir(b, vp, sombre, 'cat_msg');
          await pg.evaluate(CONTRASTE);
          await pg.waitForSelector('[data-conv="501"]', { timeout: 15000 });
          await pg.click('[data-conv="501"]');
          await pg.waitForSelector('.vrm-chat-panel .vrm-chat-send', { timeout: 10000 });
          await pg.waitForTimeout(900);
          if (!tel) await pg.evaluate(() => { const w = document.querySelector('.vrm-message-workspace'); if (w) w.scrollIntoView({ block: 'end' }); });
          await pg.waitForTimeout(300);
          const accent = await pg.evaluate(() => { const d = document.createElement('span'); d.style.color = 'var(--vrm-accent)'; document.querySelector('.vrm-chat-panel').appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; });
          const lireEnvoyer = () => pg.evaluate(() => {
            const e = document.querySelector('.vrm-chat-panel .vrm-chat-send'); const s = getComputedStyle(e); const ic = e.querySelector('svg');
            return { disabled: e.disabled, bg: s.backgroundColor, op: Number(s.opacity), ic: ic ? getComputedStyle(ic).color : s.color, title: e.getAttribute('title') || '', cur: s.cursor };
          });
          const vide = await lireEnvoyer();
          await shot(pg, nom(vp, sombre, 'fil-vide'));
          dit(vide.disabled && vide.bg !== accent && vide.op > .99 && /\S{3,}/.test(vide.title) && vide.title !== 'Envoyer', 'champ vide : Envoyer SE LIT désactivé (fond neutre, pas un cobalt délavé) et dit pourquoi', JSON.stringify({ ...vide, accent }));
          await pg.locator('.vrm-chat-compose textarea').fill('Oui, toujours disponible.');
          await pg.waitForTimeout(250);
          const plein = await lireEnvoyer();
          const c = await pg.evaluate(([a, b]) => window.__contraste(a, b), [plein.ic, plein.bg]);
          dit(!plein.disabled && plein.bg === accent && plein.op > .99 && c >= 4.5, 'texte saisi : Envoyer en cobalt PLEIN, opacité 1, icône lisible', JSON.stringify({ ...plein, accent, contraste: c.toFixed(2) }));
          await pg.locator('.vrm-chat-compose textarea').focus();
          await shot(pg, nom(vp, sombre, 'fil-saisi'));
          // C. Les bulles : du souffle autour du texte.
          const bulles = await pg.evaluate(() => [...document.querySelectorAll('.vrm-chat-panel .vrm-bulle')].map((x) => {
            const r = x.getBoundingClientRect(); const t = x.querySelector('.vrm-bulle-t'); const rt = t ? t.getBoundingClientRect() : r;
            return { g: Math.round(rt.left - r.left), d: Math.round(r.right - rt.right), h: Math.round(rt.top - r.top) };
          }));
          dit(bulles.length >= 3 && bulles.every((x) => x.g >= 12 && x.d >= 12 && x.h >= 8), 'chaque bulle garde ≥ 12 px entre son texte et ses bords', JSON.stringify(bulles));
          const pied = await pg.evaluate(() => {
            const p = document.querySelector('.vrm-chat-panel').getBoundingClientRect();
            const els = ['.vrm-chat-rapides', '.vrm-chat-compose textarea', '.vrm-chat-send'].map((s) => document.querySelector('.vrm-chat-panel ' + s));
            return els.map((e) => { if (!e) return 'absent'; const r = e.getBoundingClientRect(); return (r.top >= p.top - .5 && r.bottom <= p.bottom + .5 && r.left >= p.left - .5 && r.right <= p.right + .5) ? 'ok' : `hors ${Math.round(r.top)}-${Math.round(r.bottom)} / ${Math.round(p.top)}-${Math.round(p.bottom)}`; });
          });
          dit(pied.every((x) => x === 'ok'), 'le pied (rapides, champ, Envoyer) tient dans le fil', pied.join(' · '));
          dit(execs.filter((x) => x.method !== 'GET').length === 0 && errs.length === 0, 'aucun envoi, aucune erreur', JSON.stringify({ x: execs.filter((x) => x.method !== 'GET'), errs }));
          await ctx.close();
        });
      }
    }

    // ── D. Les écrans principaux ─────────────────────────────────────────────
    if (fait('D')) for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        for (const e of ECRANS) {
          await essaie(`D ${e.tab} ${vp.width} ${sombre}`, async () => {
            const { ctx, pg, errs } = await ouvrir(b, vp, sombre, e.tab);
            await shot(pg, nom(vp, sombre, e.tab));
            const lu = await pg.evaluate(() => ({ tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText), deb: document.documentElement.scrollWidth - innerWidth }));
            dit(!lu.tombe && errs.length === 0 && lu.deb <= 1, `${e.tab} · ${vp.width} · ${sombre ? 'sombre' : 'clair'} : rendu, sans erreur ni débordement`, JSON.stringify({ ...lu, errs }).slice(0, 200));
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
