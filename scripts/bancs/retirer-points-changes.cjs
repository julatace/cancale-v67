// ════════════════════════════════════════════════════════════════════════════
//  Banc : LES COLIS QUI CHANGENT DE POINT RELAIS, UNE FOIS CHACUN (13 nov., capture de Julien, 08:39).
//  Julien : « ici ça doit être dans les Mondial Relay ». Avant : une carte à part « 5 colis changent de point
//  relais → INTERMARCHE, LE PORTAIL… » (titre ambre) en plus des listes. Règle « un colis = une fois ».
//  Base SYNTHÉTIQUE de la même forme que la production (dépôt public, aucune donnée réelle) :
//   · 3 « Votre colis a changé de plan » sans nouveau point lu (en route) ;
//   · 1 « changé de plan » vers INTERMARCHE, LE PORTAIL, 35350 ST MELOIR DES ONDES (en route) ;
//   · 1 rangé « retiré » puis « changé de plan », code 794657, que le TRANSPORTEUR dit disponible ;
//   · 1 « Où vous livrer en cas de point indisponible ? » (pas un changement de point : il roule) ;
//   · 1 colis retiré ; 1 colis arrivé à Intermarché avec son code.
//  Exige (boîtes rendues, 390 tactile et 1512, clair et sombre) : aucune carte « changent de point relais » ;
//  chaque n° au plus UNE ligne ; les redirigés sont des lignes de la forme commune (« Colis Mondial Relay »,
//  logo MR) sous LEUR point dans « En route » (« Intermarché », « Le Portail, 35350 St Meloir des Ondes » ; sans
//  point lu : « Nouveau point pas encore lu »), avec la mention neutre « En route · point changé » (jamais ambre) ;
//  le « Où vous livrer » et le retiré nulle part. `BANC_PORT`, `BANC_DIST`, `SHOTS=dossier`.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium, PW;
try { PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')); }
catch (_) { PW = require('playwright'); }
({ chromium } = PW);
const { lancer, estWebkit } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4473);
const MATIN = new Date('2026-11-13T09:39:00+01:00');
const MS = MATIN.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const jourDans = (j) => new Date(MS + j * J).toISOString().slice(0, 10);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const cap = iso(MS);
const SHOTS = process.env.SHOTS || '';
const INTER = 'INTERMARCHE, LE PORTAIL, 35350 ST MELOIR DES ONDES';
const PLAN = 'Votre colis a changé de plan 📍';
const track = (suivi, extra = {}) => ({ id: `email_track_mondialrelay_${suivi}`, data: Object.assign({ type: 'suivi', carrier: 'mondialrelay', suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible 📦`, receivedAt: ilYa(1), emailAt: ilYa(1), arriveLe: ilYa(1), code: null, lieu: null, limite: jourDans(4), consigne: false, account: 'compte_a' }, extra) });
const REDIR = ['91000001', '91000002', '91000003'];
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Cancale' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  ...REDIR.map((n, i) => track(n, { status: 'transit', statusLabel: 'Point relais changé', relaisChange: true, subject: PLAN, limite: null, arriveLe: null, emailAt: ilYa(0.9 - i * 0.01), receivedAt: ilYa(0.9 - i * 0.01) })),
  track('91000004', { status: 'transit', statusLabel: 'Point relais changé', relaisChange: true, subject: PLAN, lieu: INTER, limite: null, arriveLe: null, emailAt: ilYa(0.3), receivedAt: ilYa(0.3) }),
  track('91000005', { status: 'delivered', statusLabel: 'Livré / retiré', subject: PLAN, lieu: INTER, code: '794657', retireLe: ilYa(3.4), emailAt: ilYa(3), receivedAt: ilYa(3) }),
  track('91000006', { status: 'available', subject: 'Où vous livrer en cas de point indisponible ?', lieu: null, emailAt: ilYa(1), receivedAt: ilYa(1) }),
  track('91000007', { status: 'delivered', statusLabel: 'Colis retiré', subject: 'Votre colis 91000007 a été retiré', lieu: INTER, code: '111222', retireLe: ilYa(0.5) }),
  track('91000008', { lieu: INTER, code: '333444' }),
  { id: 'transp_mondialrelay_91000005', data: { suivi: '91000005', carrier: 'mondialrelay', etat: 'disponible', etatAt: ilYa(3.01), lu: ilYa(0.1), source: 'mondialrelay' } },
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
// La colonne `meta` (migration 004) : les champs SCALAIRES de premier niveau de moins de 600 caractères.
const metaDe = (d) => Object.fromEntries(Object.entries(d || {}).filter(([, v]) => v !== null && typeof v !== 'object' && String(v).length <= 600));
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'meta') { out[alias] = metaDe(row.data); continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const ouvrir = async (b, vp, sombre, quand) => {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: quand });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    if (/nominatim\.openstreetmap\.org/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
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
      console.log(`\n— Points changés · ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre, MATIN);
      await essaie(nom, async () => {
        await pg.locator('[data-colis-section]').first().waitFor({ timeout: 30000 });
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' })));
        await pg.waitForFunction(() => document.querySelectorAll('.vrm-rpf .vrm-rpf-ligne[data-cc-carte]').length >= 1, null, { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        await pg.evaluate(() => { document.querySelectorAll('.vrm-rpf details[data-rp-section="route"]').forEach((d) => { d.open = true; }); });
        await pg.waitForTimeout(400);
        const r = await pg.evaluate(() => {
          const lignes = [...document.querySelectorAll('[data-cc-carte]')].map((l) => ({ cle: l.getAttribute('data-cc-carte'), dans: l.getAttribute('data-cc-dans'), redir: l.getAttribute('data-rp-redirige') === '1',
            titre: ((l.querySelector('.vrm-rpf-titre') || {}).textContent || '').trim(), marque: (l.querySelector('[data-rp-vignette-logo]') || { getAttribute: () => '' }).getAttribute('data-rp-vignette-logo'),
            code: (l.querySelector('[data-code-retrait]') || { getAttribute: () => '' }).getAttribute('data-code-retrait'),
            mention: ((l.querySelector('[data-rp-l4]') || {}).textContent || '').trim(), mentionAmbre: !!l.querySelector('[data-rp-l4] [data-rp-delai-ambre="1"], [data-rp-l4] .is-ambre'),
            point: (() => { const p = l.closest('.vrm-rpf-point'); return p ? ((p.querySelector('.vrm-rpf-nom') || {}).textContent || '').trim() + ' | ' + ((p.querySelector('.vrm-rpf-adr') || {}).textContent || '').trim() : ''; })() }));
          return { lignes, carteAPart: document.querySelectorAll('[data-relais-change], [data-relais-change-groupe]').length, texte: document.body.innerText };
        });
        if (SHOTS) {
          fs.mkdirSync(SHOTS, { recursive: true });
          const el = await pg.$('.vrm-rpf details[data-rp-section="route"]');
          if (el) await el.screenshot({ path: path.join(SHOTS, `points-changes-${nom}.png`) }).catch(() => {});
        }
        const su = (l) => (/(91\d{6})/.exec(l.cle) || [])[1] || '';
        const parSu = {}; for (const l of r.lignes) { const s = su(l); if (s) parSu[s] = (parSu[s] || 0) + 1; }
        dit(r.carteAPart === 0 && !/changent de point relais|change de point relais/.test(r.texte), `${nom} : plus de carte à part « … changent de point relais »`, String(r.carteAPart));
        dit(Object.values(parSu).every((n) => n === 1), `${nom} : chaque colis une seule fois`, JSON.stringify(parSu));
        const red = r.lignes.filter((l) => l.redir);
        dit(red.length === 4 && red.every((l) => l.dans === 'route' && /^Colis Mondial Relay$/.test(l.titre) && l.marque === 'mondialrelay'), `${nom} : les 4 redirigés sont des lignes « Colis Mondial Relay » (logo MR) dans « En route »`, JSON.stringify(red.map((l) => [su(l), l.titre, l.marque, l.dans])));
        dit(red.length === 4 && red.every((l) => l.mention === 'En route · point changé' && !l.mentionAmbre), `${nom} : la mention « En route · point changé », neutre`, JSON.stringify(red.map((l) => [l.mention, l.mentionAmbre])));
        const d4 = red.find((l) => su(l) === '91000004'), sans = red.filter((l) => REDIR.includes(su(l)));
        dit(!!d4 && /^Intermarché \| Le Portail, 35350 St Meloir des Ondes( · Itinéraire)?$/.test(d4.point), `${nom} : sous son nouveau point, écrit « Intermarché · Le Portail, 35350 St Meloir des Ondes »`, d4 && d4.point);
        dit(sans.length === 3 && sans.every((l) => /^Nouveau point pas encore lu/.test(l.point)), `${nom} : sans point lu ⇒ sous « Nouveau point pas encore lu »`, JSON.stringify(sans.map((l) => l.point)));
        dit(!parSu['91000006'] && !parSu['91000007'], `${nom} : « Où vous livrer… » et le retiré ne sont nulle part`, JSON.stringify(parSu));
        const e5 = r.lignes.filter((l) => su(l) === '91000005');
        dit(e5.length === 1 && !e5[0].redir && e5[0].dans === 'retirer' && e5[0].code === '794657' && /^Intermarché \|/.test(e5[0].point), `${nom} : le « retiré puis changé de plan » que Mondial Relay dit disponible : à retirer, sous Intermarché, code 794657, une fois`, JSON.stringify(e5));
        dit((parSu['91000008'] || 0) === 1, `${nom} : le colis arrivé à Intermarché reste à retirer, une fois`);
      });
      dit(!errs.length, `${nom} : aucune erreur`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} retirer-points-changes : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
