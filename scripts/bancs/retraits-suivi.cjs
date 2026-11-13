// Banc : RETRAITS — LE SUIVI LU SORT UN COLIS DE « À RETIRER » EN LE DISANT ; JAMAIS LU DIT POURQUOI (8 nov.)
// Julien (8 nov.) : « Améliore ça pour les colis pour le retrait parce que je vois qu'il y a encore des
// erreurs, l'application doit pouvoir lire les informations de suivi afin de pouvoir enlever si nécessaire. »
// (docs/passation/2026-11-08-retraits-suivi.md). Colis → À retirer, données INVENTÉES de la VRAIE forme
// (`email_track_*`, `transp_*`, `email_bord_*`, `harvest_{uid}_suivi_{tx}`, achats `my_orders`), jugées
// sur les data-* et `vrm_colis_retirer.total` (§6.4) :
//   R1  e-mail Mondial Relay « disponible » + le transporteur dit « retiré » le 5 ⇒ hors de « à retirer »,
//       DIT dans « Sortis de « à retirer » » (transporteur, retiré, 5 nov.)
//   R2  la ligne d'e-mail réécrite « retiré » (arrivée gardée) ⇒ dite sortie (source e-mail)
//   R3  achat Vinted « déposé » dont le n° est retiré chez Vinted Go ⇒ dit sorti (achat)
//   R4  un n° de SES bordereaux que le transporteur dit « disponible » ⇒ JAMAIS à retirer
//   R5  Colissimo (sans clé La Poste) ⇒ à retirer, « Colissimo : suivi lu par e-mail seulement » + le geste
//   R6  e-mail rangé « vinted » (expéditeur par défaut) à n° de 8 chiffres ⇒ Mondial Relay nommé, « pas encore lu »
//   R7  deux lignes `transp_` (Vinted Go jamais lue servie d'abord, Chronopost lue) ⇒ la carte dit Chronopost lu
//   R8  Chronopost abandonné (introuvable 3 fois) ⇒ « VRM ne le relit plus » + le geste
//   R9  retiré le 30 oct. (plus de 3 jours) ⇒ ni à retirer, ni dans les sortis
// 390 tactile clair/sombre + 1512. BANC_PORT, SHOTS=<dossier>, DIST=<build>, JR_VUES=390-clair,…
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
// (11 nov., webkit-fiable) `NAVIGATEUR=webkit` : le même banc sous le moteur de Safari (_navigateur.cjs).
const { lancer, estWebkit } = require('./_navigateur.cjs');
const PW_NAV = { chromium, webkit: (() => { try { return require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')).webkit; } catch (_) { return require('playwright').webkit; } })() };
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 12151);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.JR_VUES ? process.env.JR_VUES.split(',') : null;
const maintenant = new Date('2026-11-06T09:00:00Z');   // 10 h à Paris
const MS = maintenant.getTime();
const iso = (t) => new Date(t).toISOString();
const Z = (s) => `2026-${s}:00.000Z`;
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const cap = iso(MS - 3600e3);
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const MAISON = 'MAISON DE LA PRESSE, 40 RUE DU PORT, 35260 CANCALE';
const ligne = (carrier, suivi, o) => ({ id: `email_track_${carrier}_${suivi}`, data: { type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, code2: null, qrB64: null, qrUrl: null, qrType: null, consigne: false, account: 'compte_a', artTitle: null, lieu: MAISON, ...o } });
const transp = (carrier, suivi, o) => ({ id: `transp_${carrier}_${suivi}`, data: { v: 1, rev: 1, carrier, suivi, etat: null, detail: null, etatAt: null, libelle: '', lieuNom: '', lieuVille: '', lieuCp: '', lieuRue: '', limite: null, limiteSure: false, lu: null, source: 'serveur', essai: iso(MS - 600e3), essaiRes: 'ok', essais: 0, voie: carrier === 'mondialrelay' ? 'mr-fr-mvc' : carrier === 'chronopost' ? 'cp-ws2' : 'vg-v3', fini: false, evenements: [], ...o } });
const DEPOSE = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const ACHATS = [
  { transaction_id: 9200003, conversation_id: '01a0aaaa-bbbb-7ccc-8ddd-000000000203', title: 'Achat Vinted Go R3', price: { amount: '30.0', currency_code: 'EUR' }, status: DEPOSE, transaction_user_status: 'needs_action', date: Z('11-01T10:00'), photo: null },
];
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Cancale' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: ACHATS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  // R1 — disponible le 4, retiré le 5 chez Mondial Relay.
  ligne('mondialrelay', '82000001', { code: '800001', emailAt: Z('11-04T09:00'), receivedAt: Z('11-04T09:01'), arriveLe: Z('11-04T09:00'), limite: '2026-11-12' }),
  transp('mondialrelay', '82000001', { etat: 'retire', fini: true, etatAt: Z('11-05T15:00'), lu: Z('11-05T16:00'), libelle: 'Colis livré au destinataire', cp: '35260' }),
  // R2 — la ligne d'e-mail réécrite « retiré » (la route garde l'arrivée).
  ligne('chronopost', 'XW200000002TS', { status: 'delivered', statusLabel: 'Livré / retiré', subject: 'Votre colis a été remis', code: '800002', emailAt: Z('11-05T17:00'), receivedAt: Z('11-05T17:01'), arriveLe: Z('11-03T09:00'), retireLe: Z('11-05T17:01') }),
  // R3 — achat Vinted « déposé » ; Vinted Go dit retiré.
  { id: 'harvest_111_suivi_9200003', data: { v: 1, n: 2, tx: '9200003', uid: '111', suivi: '1789000000000203', transporteur: 'vinted', capturedAt: cap, source: 'extension', dernier: { t: 'Disponible pour retrait', at: Z('11-03T09:58') }, etapes: [{ t: 'Disponible pour retrait', at: Z('11-03T09:58') }] } },
  transp('vinted', '1789000000000203', { etat: 'retire', fini: true, etatAt: Z('11-05T11:00'), lu: Z('11-05T12:00'), libelle: 'Colis récupéré', lieuNom: 'Kusmi Test', lieuRue: '13 Rue Saint-Vincent', lieuVille: 'Vannes' }),
  // R4 — SON bordereau, au point relais de son acheteur.
  { id: 'email_bord_9300004', data: { type: 'bordereau', suivi: '82000004', transaction: '9300004', filename: 'bordereau.pdf', receivedAt: Z('11-02T10:00'), modele: 'Vente R4' } },
  transp('mondialrelay', '82000004', { etat: 'disponible', etatAt: Z('11-05T10:00'), lu: Z('11-06T08:00'), libelle: '5 jours restants pour retirer le colis en Point Relais', limite: '2026-11-10', limiteSure: false, cp: '29200' }),
  // R5 — Colissimo.
  ligne('colissimo', '6A20000000005', { code: '800005', emailAt: Z('11-05T09:00'), receivedAt: Z('11-05T09:01'), arriveLe: Z('11-05T09:00'), limite: '2026-11-15' }),
  // R6 — e-mail de shipping@relay.vinted.com rangé « vinted » avec un n° Mondial Relay.
  ligne('vinted', '82000006', { code: '800006', emailAt: Z('11-05T10:00'), receivedAt: Z('11-05T10:01'), arriveLe: Z('11-05T10:00'), limite: '2026-11-12' }),
  // R7 — n° Chronopost : la ligne Vinted Go (jamais lue) servie AVANT la ligne Chronopost (lue).
  ligne('chronopost', 'XW200000007TS', { code: '800007', emailAt: Z('11-05T11:00'), receivedAt: Z('11-05T11:01'), arriveLe: Z('11-05T11:00'), limite: '2026-11-12' }),
  transp('vinted', 'XW200000007TS', { essaiRes: 'passu', essais: 4, essai: Z('11-06T08:30') }),
  transp('chronopost', 'XW200000007TS', { etat: 'disponible', etatAt: Z('11-05T10:50'), lu: Z('11-06T08:20'), libelle: 'Colis disponible en relais Pickup', limite: '2026-11-12', limiteSure: true }),
  // R8 — Chronopost abandonné.
  ligne('chronopost', 'XW200000008TS', { code: '800008', emailAt: Z('11-05T12:00'), receivedAt: Z('11-05T12:01'), arriveLe: Z('11-05T12:00'), limite: '2026-11-12' }),
  transp('chronopost', 'XW200000008TS', { essaiRes: 'introuvable', essais: 3, fini: true, essai: Z('11-06T02:00') }),
  // R9 — retiré le 30 oct.
  ligne('mondialrelay', '82000009', { code: '800009', emailAt: Z('10-28T09:00'), receivedAt: Z('10-28T09:01'), arriveLe: Z('10-28T09:00'), limite: '2026-11-04' }),
  transp('mondialrelay', '82000009', { etat: 'retire', fini: true, etatAt: Z('10-30T15:00'), lu: Z('10-30T16:00'), libelle: 'Colis livré au destinataire', cp: '35260' }),
];

// ── Le serveur et la base (PostgREST minimal : projection, id eq/like/in, is.null) ──
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
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
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
  }
  return out;
};
const ouvrir = async (b, vp, sombre, tab) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    // (12 nov.) le géocodage de l'app retombe sur Nominatim quand l'API Adresse ne trouve rien : servi vide aussi (garde réseau).
    if (/nominatim\.openstreetmap\.org/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data && r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => ((r.data || {})[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lks = [...u.matchAll(/[?&]id=like\.([^&]*)/g)];
    if (lks.length) { const res = lks.map((lk) => new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$')); return j(LIGNES.filter((r) => res.every((re) => re.test(r.id)) && passe(r)).map(forme)); }
    const ors = /[?&]or=\(([^&]*)\)/.exec(u);
    if (ors) { const pats = [...ors[1].matchAll(/id\.like\.([^,)]*)/g)].map((m) => new RegExp('^' + m[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$')); if (pats.length) return j(LIGNES.filter((r) => pats.some((re) => re.test(r.id)) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};

// ── Ce que l'écran montre, colis par colis ──────────────────────────────────────
const lireEcran = (pg) => pg.evaluate(() => {
  for (const d of document.querySelectorAll('details[data-rp-section]')) d.open = true;
  const pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null');
  const lignes = [...document.querySelectorAll('.vrm-rpf [data-cc-carte]')].map((l) => {
    const pt = l.closest('[data-relais-point],[data-relais-point-suite]');
    return { cle: l.getAttribute('data-cc-carte'), section: (l.closest('[data-rp-section]') || { getAttribute: () => '' }).getAttribute('data-rp-section'),
      point: pt ? (pt.getAttribute('data-relais-point') || pt.getAttribute('data-relais-point-suite')) : '', tr: l.getAttribute('data-transporteur') || '', raison: l.getAttribute('data-a-verifier-raison') || '',
      hors: l.hasAttribute('data-hors-compte'), code: ((l.querySelector('[data-code-retrait]') || { getAttribute: () => '' }).getAttribute('data-code-retrait')) || '', titre: ((l.querySelector('[data-rp-titre]') || {}).textContent || '').trim() };
  });
  const noms = Object.fromEntries([...document.querySelectorAll('[data-relais-point]')].map((p) => [p.getAttribute('data-relais-point'), ((p.querySelector('.vrm-rpf-nom') || {}).textContent || '').trim()]));
  return { pub, lignes, noms, repartis: [...document.querySelectorAll('[data-reparti-suivi],[data-reparti-tx]')].map((e) => e.getAttribute('data-reparti-suivi') || e.getAttribute('data-reparti-tx')),
    doubleExpl: (document.querySelector('[data-double-explication]') || { textContent: '' }).textContent, deb: document.documentElement.scrollWidth - window.innerWidth,
    sortisN: (document.querySelector('[data-retraits-sortis]') || { getAttribute: () => null }).getAttribute('data-retraits-sortis'),
    sortis: [...document.querySelectorAll('[data-sorti]')].map((e) => ({ cle: e.getAttribute('data-sorti'), source: e.getAttribute('data-sorti-source'), etat: e.getAttribute('data-sorti-etat'), at: e.getAttribute('data-sorti-at'), texte: ((e.querySelector('[data-sorti-texte]') || {}).textContent || '').trim() })) };
});
const detail = async (pg, sousCle) => {
  const l = pg.locator(`.vrm-rpf [data-cc-carte*="${sousCle}"]`).first();
  if (!(await l.count())) return null;
  const ouvert = await l.getAttribute('data-ouvert');
  if (!ouvert) await l.locator('.vrm-rpf-ouvrir').first().click({ timeout: 5000 }).catch(() => {});
  await pg.waitForTimeout(250);
  return l.evaluate((e) => { const d = e.querySelector('[data-rp-detail]') || e;
    const tr = d.querySelector('[data-transp]'); const lim = d.querySelector('[data-colis-limite]');
    return { transp: tr ? tr.getAttribute('data-transp') : null, transpEtat: tr ? tr.getAttribute('data-transp-etat') : null, transpTexte: tr ? tr.textContent : '', limite: lim ? lim.getAttribute('data-colis-limite') : null, estimee: lim ? lim.getAttribute('data-colis-limite-estimee') : null, limTexte: lim ? lim.textContent : '',
      pasLu: (d.querySelector('[data-transp-pas-lu]') || { getAttribute: () => null }).getAttribute('data-transp-pas-lu'), pasLuTexte: ((d.querySelector('[data-transp-pas-lu]') || {}).textContent || ''),
      codeSms: (d.querySelector('[data-colis-code-sms]') || { getAttribute: () => null }).getAttribute('data-colis-code-sms'), texte: d.innerText.replace(/\s+/g, ' ').slice(0, 600) }; });
};

(async () => {
  srv.listen(PORT);
  const b = await lancer(PW_NAV, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch((e) => { if (estWebkit) throw e; return chromium.launch(); });
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair']]) {
      if (VUES && !VUES.includes(nom)) continue;
      console.log(`\n— Colis → À retirer, le suivi lu · ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'cat_bord');
      await essaie('retirer', async () => {
        await pg.locator('[data-colis-section]').first().waitFor({ timeout: 40000 });
        await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return false; } }, null, { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' }))); /* (11 nov., lot DJ3) « À retirer » est en tête d'Achats */ await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
        await pg.waitForTimeout(2500);
        await pg.evaluate(() => { for (const d of document.querySelectorAll('details[data-retraits-sortis]')) d.open = true; });
        await pg.waitForTimeout(200);
        const m = await lireEcran(pg);
        const L = (s) => m.lignes.filter((l) => l.cle.includes(s));
        const S = (s) => m.sortis.filter((x) => x.cle.includes(s) || x.texte.includes(s));
        const J = (o) => JSON.stringify(o);
        // R1
        { const s = S('82000001'); dit(L('82000001').length === 0 && s.length === 1 && s[0].source === 'transporteur' && s[0].etat === 'retire' && s[0].at === '2026-11-05' && /^Mondial Relay : retiré le 5 nov\./.test(s[0].texte),
          'R1 retiré chez Mondial Relay ⇒ hors de « à retirer », DIT sorti (« Mondial Relay : retiré le 5 nov. »)', J({ lignes: L('82000001'), sortis: s })); }
        // R2
        { const s = S('XW200000002TS'); dit(L('XW200000002TS').length === 0 && s.length === 1 && s[0].source === 'email' && s[0].etat === 'retire', 'R2 e-mail réécrit « retiré » ⇒ dit sorti (source e-mail)', J(s)); }
        // R3
        { const s = S('1789000000000203'); dit(L('9200003').length === 0 && s.length === 1 && s[0].source === 'transporteur' && s[0].etat === 'retire', 'R3 achat Vinted « déposé » retiré chez Vinted Go ⇒ dit sorti', J({ lignes: L('9200003'), sortis: s })); }
        // R4
        dit(L('82000004').length === 0 && S('82000004').length === 0, 'R4 un n° de SES bordereaux « disponible » chez le transporteur ⇒ jamais à retirer', J(L('82000004')));
        // R9
        dit(L('82000009').length === 0 && S('82000009').length === 0, 'R9 retiré il y a plus de 3 jours ⇒ ni à retirer, ni dans les sortis', J(S('82000009')));
        dit(m.sortisN === '3', 'la section « Sortis de « à retirer » » compte 3 colis (R1, R2, R3)', String(m.sortisN));
        // Le nombre : R5 R6 R7 R8 = 4.
        dit(m.pub && m.pub.total === 4, 'vrm_colis_retirer.total = 4 (ni les sortis, ni SON bordereau)', J(m.pub && { total: m.pub.total }));
        dit(m.deb <= 1, 'rien ne déborde', `${m.deb}px`);
        if (SHOTS) { await pg.screenshot({ path: path.join(SHOTS, `retraits-suivi-${nom}.png`) });
          await pg.evaluate(() => { const e = document.querySelector('[data-retraits-sortis]'); if (e) e.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(300);
          await pg.screenshot({ path: path.join(SHOTS, `retraits-suivi-sortis-${nom}.png`) }); }
        { const d = await detail(pg, '6A20000000005'); dit(!!d && d.pasLu === 'non-lu' && /Colissimo/.test(d.pasLuTexte) && /site/.test(d.pasLuTexte), 'R5 Colissimo ⇒ « suivi lu par e-mail seulement » + le geste', J(d && { pasLu: d.pasLu, t: d.pasLuTexte })); }
        { const d = await detail(pg, '82000006'); // (12 nov., finitions) « pas encore lu — VRM le lit tant que l'app est ouverte » ne demande rien à Julien : la ligne ne
        // l'écrit plus (seules les raisons qui ont un geste restent, `RaisonPasLu`).
        dit(!!d && d.pasLu == null, 'R6 n° de 8 chiffres d’un e-mail « vinted » : « pas encore lu » (rien à faire) n’est plus écrit sur la ligne', J(d && { pasLu: d.pasLu, t: d.pasLuTexte, tr: d.transp }));
          if (SHOTS && d) await pg.screenshot({ path: path.join(SHOTS, `retraits-suivi-detail-r6-${nom}.png`) }); }
        { const d = await detail(pg, 'XW200000007TS'); dit(!!d && d.transp === 'lu' && d.transpEtat === 'disponible' && /Chronopost/.test(d.transpTexte), 'R7 deux lignes du transporteur ⇒ la lue (Chronopost), jamais « Vinted Go n’a pas répondu »', J(d && { transp: d.transp, t: d.transpTexte })); }
        { const d = await detail(pg, 'XW200000008TS'); dit(!!d && d.pasLu === 'abandonne' && /ne le relit plus/.test(d.pasLuTexte), 'R8 introuvable 3 fois ⇒ « VRM ne le relit plus » + le geste', J(d && { pasLu: d.pasLu, t: d.pasLuTexte }));
          if (SHOTS && d) await pg.screenshot({ path: path.join(SHOTS, `retraits-suivi-detail-r8-${nom}.png`) }); }
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
