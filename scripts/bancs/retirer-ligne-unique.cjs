// ════════════════════════════════════════════════════════════════════════════
//  Banc : ACHATS → « À RETIRER » — UNE SEULE FORME DE LIGNE (12 nov., finitions).
//  Julien, sur deux captures de production : « regarde comment rien n'est cohérent » — le titre tantôt
//  l'article, tantôt le n° de suivi ; le gros chiffre tantôt le code, tantôt absent ; le logo du
//  transporteur au coin de la photo, à côté du code, à côté du nom du point ou nulle part ; la barre
//  « encore N j » sur certaines lignes seulement ; « 3 colis · 1 code à venir » ici, « 3 colis » là.
//  Données INVENTÉES (dépôt public), UN point mélangé : un achat Vinted relié (photo, code) ; un colis
//  Mondial Relay avec code et n° ; un Mondial Relay au code à venir ; un achat « t'attend au point »
//  (titre lu dans l'e-mail, ni code ni n°) ; un Chronopost avec code et QR (Pickup Pass) ; un Vinted Go.
//  Le logo de chaque ligne est vérifié par sa SOURCE (la clé de la marque dessinée) ; Chronopost Pickup sur le jaune Pickup.
//  Exige, sur les BOÎTES rendues (§6.4) : chaque ligne a la même géométrie — vignette 56 px au même
//  endroit, le logo du transporteur au même coin de la vignette, 1 titre · 2 code / « Code à venir » ·
//  3 n° de suivi ou ligne vide · 4 barre du délai, aux mêmes écarts ; « J'ai retiré » à la même place ;
//  un titre n'est jamais un n° de suivi (« Colis Mondial Relay », « Colis Chronopost Pickup ») ; aucune
//  ligne « sans n° de suivi » ; l'en-tête « N colis · K codes à venir » dès K > 0 ; le QR se touche depuis
//  sa ligne (44 px) ; le DÉPLI est une fiche étiquetée (valeurs alignées), ses gestes d'une seule forme (44 px), sans
//  phrase ambre quand rien n'est urgent. 390 tactile clair/sombre, 1512 clair/sombre. `BANC_PORT`, `BANC_DIST`, `SHOTS=dossier`.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium, PW;
try { PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')); }
catch (_) { PW = require('playwright'); }
({ chromium } = PW);
// (6 nov., filet 6) `NAVIGATEUR=webkit` : le moteur de Safari (_navigateur.cjs).
const { lancer, estWebkit } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4433);
const maintenant = new Date(2026, 10, 3, 10, 19, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J), dans = (j) => iso(MS + j * J);
// Une date limite rangée a la forme d'un JOUR (« 2026-11-07 », la forme réelle des lignes).
const jourDans = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(MS) },
];
const cap = iso(MS);
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const achat = (id, titre, statut, k, extra = {}) => ({ transaction_id: id, conversation_id: 7000 + id % 1000, title: titre, price: { amount: '40', currency_code: 'EUR' }, status: statut, date: ilYa(5), photo: { url: url(k) }, ...extra });
const SHOTS = process.env.SHOTS || '';
const LIEU = 'Phone Cash, 12 rue du Port, 35260 Cancale';
const AU_RELAIS = 'Colis déposé en point relais';
const track = (carrier, suivi, code, extra = {}) => ({ id: `email_track_${carrier}_${suivi}`, data: Object.assign({ type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, receivedAt: ilYa(1), emailAt: ilYa(1), arriveLe: ilYa(1), code, lieu: LIEU, limite: jourDans(5), consigne: false, account: 'compte_a' }, extra) });
const ACHATS_A = [achat(9301, 'Nike Dunk Low panda taille 38', AU_RELAIS, 9, { transaction_user_status: 'needs_action' })];
const RELAIS = { 9301: { code: '012345', lieu: LIEU, transporteur: 'mondialrelay', at: ilYa(0) } };
const TRACKS = [
  track('mondialrelay', '90000031', '313131'),
  track('vinted', 'VG0001234567', '565656', { limite: jourDans(3) }),                  // Vinted Go, code + n°
  // Le serveur le vérifie chez le transporteur (agent2-restes, api/_lib/suivi-colis.js) : mention neutre, rien à faire.
  track('mondialrelay', '90000041', '414141', { aVerifierTransporteur: 'Retiré puis « changé de plan » : VRM le vérifie chez le transporteur' }),                                         // code + n°, sans article
  track('mondialrelay', '90000021', null, { limite: null }),                           // code à venir, sans date limite
  track('chronopost', 'XW123456789FR', '454545', { qrB64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', qrType: 'image/png', limite: jourDans(2) }),   // code + QR (Pickup Pass)
  // « Ton achat t'attend au point relais » : l'article LU dans l'e-mail, ni code, ni n° de suivi.
  { id: 'email_track_vinted_commande_cmd01', data: { type: 'suivi', carrier: 'autre', suivi: '', status: 'available', statusLabel: 'Arrivé au point relais (Vinted)', subject: 'Ton achat t’attend au point relais', receivedAt: ilYa(0.2), emailAt: ilYa(0.2), arriveLe: ilYa(0.2), code: null, code2: null, artTitle: 'Sac seau toile écrue', lieu: LIEU, limite: null, consigne: false, conv: '', source: 'vinted-commande', forme: 'relais', cleLigne: 'cmd01', account: 'compte_a' } },
];
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Cancale' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: ACHATS_A } } },
  { id: 'harvest_222_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'panel_colis_relais', data: RELAIS },
  ...TRACKS,
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
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
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const TEINTES = ['#dfe3e8', '#e8e1d8', '#dfe5dd', '#e6dcdc', '#e2dfe8', '#e8e4d6'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${TEINTES[k % 6]}"/><path d="M60 250 C80 190 150 175 190 200 C230 222 285 205 330 232 C352 246 346 282 306 284 L84 284 C62 284 52 268 60 250 Z" fill="rgba(30,34,40,.62)"/><path d="M60 284 L330 284 L326 300 L66 300 Z" fill="rgba(255,255,255,.85)"/><text x="200" y="120" font-size="90" text-anchor="middle" fill="rgba(0,0,0,.35)" font-family="sans-serif">${k}</text></svg>`;
const sacSvg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#efe9df"/><rect x="110" y="150" width="180" height="170" rx="18" fill="${c}"/><path d="M150 150 C150 80 250 80 250 150" stroke="${c}" stroke-width="16" fill="none"/></svg>`;

const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const m = /images1\.vinted\.net\/t\/b(\d+)\//.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(Number(m[1])) });
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    // (12 nov.) le géocodage de l'app retombe sur Nominatim quand l'API Adresse ne trouve rien : servi vide aussi (garde réseau).
    if (/nominatim\.openstreetmap\.org/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (/\/favicon\.ico$/i.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="4" y="4" width="24" height="24" rx="5" fill="#8e8e93"/></svg>' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
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
  return { ctx, pg, errs };
};

(async () => {
  const b = await lancer(PW, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch((e) => { if (estWebkit) throw e; return chromium.launch(); });
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      console.log(`\n— Achats → À retirer · ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      await essaie(nom, async () => {
        await pg.locator('[data-colis-section]').first().waitFor({ timeout: 30000 });
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' })));
        await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
        await pg.waitForFunction(() => document.querySelectorAll('.vrm-rpf-point .vrm-rpf-ligne[data-cc-carte]').length >= 6, null, { timeout: 30000 }).catch(() => {});
        await pg.evaluate(() => { const p = document.querySelector('.vrm-rpf-point'); if (p) p.scrollIntoView({ block: 'start' }); });
        await pg.waitForTimeout(600);
        const m = await pg.evaluate(() => {
          const R = (e) => (e ? e.getBoundingClientRect() : null);
          // Le point mélangé (5 colis) et les autres lignes de la liste : UNE forme pour toutes, d'un point à l'autre.
          const pt = [...document.querySelectorAll('.vrm-rpf-point')].find((p) => p.querySelectorAll(".vrm-rpf-ligne[data-cc-carte]").length >= 6);
          if (!pt) return { dbg: [...document.querySelectorAll('.vrm-rpf-point')].map((p) => p.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]').length).join(' | ') };
          const tete = pt.querySelector('.vrm-rpf-n');
          const lignes = [...document.querySelectorAll('.vrm-rpf .vrm-rpf-ligne[data-cc-carte]')].filter((l) => l.getBoundingClientRect().height > 0).map((l) => {
            const r0 = R(l), vg = R(l.querySelector('.vrm-rpf-vignette')), bd = R(l.querySelector('.vrm-rpf-vignette .vrm-colis-logo-transp'));
            const t = l.querySelector('.vrm-rpf-titre'), rt = R(t);
            const rg = document.createRange(); if (t) rg.selectNodeContents(t); const lt = t ? new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size : 0;
            const c = R(l.querySelector('.vrm-rpf-comptoir')), s = R(l.querySelector('.vrm-rpf-suivi-ligne')), d = R(l.querySelector('[data-rp-l4] .vrm-rpf-delai'));
            const btn = R(l.querySelector('[data-colis-retire]')), rang = R(l.querySelector('.vrm-rpf-rang'));
            const qr = l.querySelector('[data-rp-qr-ligne]'), rq = R(qr);
            const visibles = [...l.querySelectorAll('.vrm-rpf-rang *')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3) ? e.textContent : '').join(' ');
            const n = (v) => (v == null ? null : Math.round(v));
            return {
              cle: l.getAttribute('data-cc-carte'), titre: t ? t.innerText.trim() : '', lignesTitre: lt, hauteur: n(r0.height),
              vignette: vg && [n(vg.left - r0.left), n(vg.width), n(vg.height)].join(','), logo: bd && vg ? [n(bd.left - vg.left), n(bd.top - vg.top)].join(',') : null,
              z2: c && rt ? n(c.top - rt.bottom) : null, z3: s && c ? n(s.top - c.bottom) : null, z4: d && s ? n(d.top - s.bottom) : null,
              h2: c ? n(c.height) : null, h3: s ? n(s.height) : null,
              bouton: btn && rang ? [n(r0.right - btn.right), n(Math.abs((btn.top + btn.height / 2) - (rang.top + rang.height / 2)))].join(',') : null,
              code: !!l.querySelector('.vrm-rpf-comptoir [data-rp-code-visible], .vrm-rpf-comptoir [data-rp-code-a-venir]'),
              sansSuiviDit: /sans n° de suivi/.test(visibles), qr: rq ? [n(rq.width), n(rq.height)].join('x') : null,
              qrAttendu: !!l.querySelector('[data-code-retrait="454545"]'),
              marque: (l.querySelector('.vrm-rpf-vignette [data-colis-logo-transp]') || { getAttribute: () => null }).getAttribute('data-colis-logo-transp'),
              fondMarque: (() => { const e = l.querySelector('.vrm-rpf-vignette [data-colis-logo-transp] [data-marque]'); return e ? getComputedStyle(e).backgroundColor : null; })(),
              l3: (l.querySelector('.vrm-rpf-suivi-ligne') || {}).textContent || '',
              verif: (() => { const v = l.querySelector('[data-rp-verif-transporteur] [data-rp-delai]'); return v ? { txt: v.textContent.trim(), titre: (v.querySelector('[role="progressbar"]') || { getAttribute: () => '' }).getAttribute('aria-valuetext'), ambre: v.getAttribute('data-rp-delai-ambre'), couleur: getComputedStyle(v.querySelector('.vrm-rpf-delai-txt')).color } : null; })(),
            };
          });
          return { lignes, tete: tete ? tete.innerText : '', sansCode: tete && tete.querySelector('[data-relais-sans-code]') ? tete.querySelector('[data-relais-sans-code]').getAttribute('data-relais-sans-code') : null };
        });
        if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `retirer-ligne-${nom}.png`) }); }
        // ── LE DÉPLI (12 nov., Julien : « c'est moche l'affichage ») : une fiche étiquetée, des gestes d'une forme ──
        const ouvert = await pg.evaluate(async () => {
          const l = [...document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]')].find((x) => x.querySelector('[data-code-retrait="313131"]'));
          if (!l) return null; l.querySelector('.vrm-rpf-ouvrir').click(); await new Promise((r) => setTimeout(r, 400)); l.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); await new Promise((r) => setTimeout(r, 300));
          const d = l.querySelector('[data-rp-detail]'); if (!d) return { ouvert: false };
          const R = (e) => e.getBoundingClientRect();
          const ks = [...d.querySelectorAll('.vrm-rpf-fiche-k')].filter((e) => R(e).height > 0);
          const vs = [...d.querySelectorAll('.vrm-rpf-fiche-v')].filter((e) => R(e).height > 0);
          const g = [...d.querySelectorAll('.vrm-rp-gestes :is(button, a)')].filter((e) => R(e).height > 0);
          const ambre = [...d.querySelectorAll('*')].filter((e) => R(e).height > 0 && e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).filter((e) => { const c = getComputedStyle(e).color.match(/\d+/g).map(Number); return c[0] > 150 && c[1] > 60 && c[1] < 140 && c[2] < 60; }).map((e) => e.textContent.trim().slice(0, 60));
          return { ouvert: true, etiquettes: ks.map((e) => e.textContent.trim()), kLeft: [...new Set(ks.map((e) => Math.round(R(e).left)))], vLeft: [...new Set(vs.map((e) => Math.round(R(e).left)))],
            gestes: g.map((e) => ({ t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30), h: Math.round(R(e).height), r: getComputedStyle(e).borderRadius, bg: getComputedStyle(e).backgroundColor })), ambre };
        });
        if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `retirer-depli-${nom}.png`) }); }
        dit(!!ouvert && ouvert.ouvert && ['Arrivé', 'À retirer avant'].every((k) => ouvert.etiquettes.includes(k)) && ouvert.kLeft.length === 1 && ouvert.vLeft.length === 1, `${nom} : le dépli est une fiche (« Arrivé », « À retirer avant »… étiquetés, valeurs alignées)`, JSON.stringify(ouvert && { e: ouvert.etiquettes, k: ouvert.kLeft, v: ouvert.vLeft }));
        dit(!!ouvert && ouvert.gestes.length >= 1 && new Set(ouvert.gestes.map((x) => `${x.h}|${x.r}|${x.bg}`)).size === 1 && ouvert.gestes.every((x) => x.h >= 44) && !ouvert.gestes.some((x) => /J.ai retiré/.test(x.t)), `${nom} : les gestes du dépli ont UNE forme (44 px, même fond, même rayon), « J'ai retiré » pas redit`, JSON.stringify(ouvert && ouvert.gestes));
        dit(!!ouvert && !ouvert.ambre.length, `${nom} : aucune phrase ambre dans le dépli d'un colis sans geste urgent (§7)`, JSON.stringify(ouvert && ouvert.ambre));
        await pg.evaluate(() => { const l = [...document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]')].find((x) => x.querySelector('[data-code-retrait="313131"]')); if (l && l.querySelector('[data-rp-detail]')) l.querySelector('.vrm-rpf-ouvrir').click(); });
        await pg.waitForTimeout(300);
        await pg.evaluate(() => { const p = document.querySelector('.vrm-rpf-point'); if (p) p.scrollIntoView({ block: 'start' }); });
        await pg.waitForTimeout(300);
        if (m && m.dbg) console.log('DBG', m.dbg);
        dit(!!m && !!m.lignes && m.lignes.length >= 6, `${nom} : les colis du point mélangé, une ligne chacun`, m && m.lignes.map((l) => l.titre).join(' | '));
        if (!m || !m.lignes) return;
        const L = m.lignes, egal = (k) => new Set(L.map((l) => l[k])).size === 1 && L[0][k] != null;
        dit(egal('vignette'), `${nom} : la vignette au même endroit, de la même taille, sur chaque ligne`, L.map((l) => l.vignette).join(' / '));
        dit(egal('logo'), `${nom} : le logo du transporteur au MÊME coin de la vignette sur chaque ligne`, L.map((l) => l.logo).join(' / '));
        dit(egal('z2') && egal('h2'), `${nom} : la ligne 2 (code ou « Code à venir ») au même écart, même hauteur`, L.map((l) => `${l.z2}/${l.h2}`).join(' · '));
        dit(egal('z3') && egal('h3'), `${nom} : la ligne 3 (n° de suivi ou vide) au même écart, même hauteur`, L.map((l) => `${l.z3}/${l.h3}`).join(' · '));
        dit(egal('z4'), `${nom} : la ligne 4 (barre du délai) sur CHAQUE ligne, au même écart`, L.map((l) => l.z4).join(' · '));
        dit(egal('bouton'), `${nom} : « J'ai retiré » à la même place (bord droit, centré)`, L.map((l) => l.bouton).join(' / '));
        const un = L.filter((l) => l.lignesTitre === 1);
        dit(un.length >= 2 && new Set(un.map((l) => l.hauteur)).size === 1, `${nom} : les lignes au titre d'une ligne ont la même hauteur (${un.length})`, un.map((l) => `${l.titre}:${l.hauteur}`).join(' · '));
        dit(L.every((l) => l.code), `${nom} : chaque ligne dit son code ou « Code à venir »`);
        dit(L.every((l) => !/^(N°\d+ · )?n°/i.test(l.titre)) && L.some((l) => /Colis Mondial Relay/.test(l.titre)) && L.some((l) => /Colis Chronopost Pickup/.test(l.titre)), `${nom} : jamais le n° de suivi en titre (« Colis Mondial Relay », « Colis Chronopost Pickup »)`, L.map((l) => l.titre).join(' | '));
        dit(L.some((l) => /Nike Dunk Low/.test(l.titre)), `${nom} : l'article relié garde son nom`);
        // Le BON logo, vérifié par sa source (la clé de la marque dessinée), et le nom écrit en clair.
        const attendu = [[/Colis Chronopost Pickup/, 'chronopost'], [/Colis Mondial Relay/, 'mondialrelay'], [/Colis Vinted Go/, 'vinted'], [/Nike Dunk Low/, 'mondialrelay']];
        const mauvais = L.filter((l) => { const a = attendu.find(([re]) => re.test(l.titre)); return !a || l.marque !== a[1]; });
        dit(!mauvais.length && L.some((l) => /Vinted Go/.test(l.titre)), `${nom} : chaque logo est celui de SON transporteur (Chronopost, Mondial Relay, Vinted Go), aucun cube générique`, L.map((l) => `${l.titre}=${l.marque}`).join(' | '));
        const chrono = L.find((l) => l.marque === 'chronopost');
        dit(!!chrono && chrono.fondMarque === 'rgb(255, 210, 0)', `${nom} : Chronopost Pickup sur le jaune Pickup (pas un cube noir sur blanc)`, chrono && chrono.fondMarque);
        const vt = L.filter((l) => l.verif);
        dit(vt.length === 1 && /^Vérification en cours$/.test(vt[0].verif.txt) && /Mondial Relay/.test(vt[0].verif.titre) && vt[0].verif.ambre === '0' && !/\?/.test(vt[0].verif.txt), `${nom} : le colis que VRM vérifie chez le transporteur le dit, neutre, à la place du délai (rien à faire)`, JSON.stringify(vt.map((l) => l.verif)));
        const nike = L.find((l) => /Nike Dunk Low/.test(l.titre));
        dit(!!nike && /^Mondial Relay/.test(nike.l3), `${nom} : sous un article relié, le transporteur écrit en clair (« Mondial Relay »)`, nike && nike.l3);
        dit(L.every((l) => !l.sansSuiviDit), `${nom} : « sans n° de suivi » n'est répété sur aucune ligne`);
        dit(m.sansCode === '1' && /1 code à venir/.test(m.tete) && /^6 colis/.test(m.tete), `${nom} : l'en-tête du point « 6 colis · 1 code à venir »`, m.tete);
        const q = L.find((l) => l.qrAttendu);
        dit(!!q && !!q.qr && q.qr.split('x').every((v) => Number(v) >= 44), `${nom} : le QR (Pickup Pass) se touche depuis sa ligne, 44 px`, q ? String(q.qr) : 'ligne absente');
      });
      dit(!errs.length, `${nom} : aucune erreur`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} retirer-ligne-unique : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
