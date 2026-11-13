// ════════════════════════════════════════════════════════════════════════════
//  Banc : UN COLIS = UNE LIGNE, QUELLES QUE SOIENT SES SOURCES (13 nov.).
//  Julien : « le colis ne doit apparaître qu'une seule fois ».
//  Base SYNTHÉTIQUE (dépôt public, aucune donnée réelle), la forme rangée par la vraie route après :
//  e-mail d'arrivée, 2 rappels (« Le temps file… »), un SMS, un changement de point, pour le MÊME n° 81555001 —
//  une seule ligne `email_track_mondialrelay_81555001` (audit-rappels-colis le prouve côté serveur) —, PLUS :
//   · l'e-mail d'expédition Vinted du même n° (`email_track_vinted_81555001`, mesuré : 7 n° en double en base) ;
//   · la lecture chez Mondial Relay (disponible) ;
//   · l'achat Vinted relié par son n° de suivi (`harvest_111_suivi_9401`), son relais lu (même code) ;
//   · l'e-mail Vinted « Commande mise à jour » de SA conversation (même code).
//  Témoin : un AUTRE achat Vinted sans n° ni code au même point (§5 : jamais fusionné par ressemblance, mais
//  montré UNE fois, jamais compté deux fois).
//  Exige, dans tout « À retirer » (sections, replis, En route) : le n° 81555001 et l'achat 9401 = UNE ligne en tout,
//  au nom de l'article ; le témoin = une ligne ; le compte publié (`vrm_colis_retirer.total`) = lignes comptées.
//  390 tactile et 1512, clair et sombre. `BANC_PORT`, `BANC_DIST`, `SHOTS=dossier`.
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
const PORT = Number(process.env.BANC_PORT || 4475);
const MATIN = new Date('2026-11-13T10:00:00+01:00');
const MS = MATIN.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const jourDans = (j) => new Date(MS + j * J).toISOString().slice(0, 10);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const cap = iso(MS - 3600e3);
const SHOTS = process.env.SHOTS || '';
const N = '81555001';
const LIEU = 'TABAC DU NOUVEAU PORT, 3 Rue Inventée, 35260 Cancale';
const DEPOSE = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const conv = (id) => `0000aaaa-0000-4000-8000-${String(id).padStart(12, '0')}`;
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const achat = (id, titre, k) => ({ transaction_id: id, conversation_id: conv(id), title: titre, price: { amount: '30', currency_code: 'EUR' }, status: DEPOSE, transaction_user_status: 'needs_action', date: ilYa(5), photo: { url: url(k) } });
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Cancale' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [achat(9401, 'Baskets cuir camel 42', 1), achat(9402, 'Pull marin écru L', 2)] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_111_suivi_9401', data: { tx: '9401', uid: '111', suivi: N, transporteur: 'MONDIAL', capturedAt: cap, dernier: { t: 'Disponible pour retrait', at: ilYa(0.6) }, etapes: [{ t: 'Disponible pour retrait', at: ilYa(0.6) }] } },
  { id: 'panel_colis_relais', data: { 9401: { code: '555001', lieu: LIEU, transporteur: 'mondialrelay', at: ilYa(0.2) } } },
  { id: `email_track_mondialrelay_${N}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi: N, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Le temps file : votre colis vous attend avec impatience ⏳',
    receivedAt: ilYa(0.1), emailAt: ilYa(0.1), arriveLe: ilYa(1.5), code: '555001', lieu: LIEU, ancienLieu: 'BAR DE L’ANCIEN QUAI, 1 Rue Ancienne, 35260 Cancale', limite: jourDans(4), consigne: false, account: 'compte_a',
    sms: { at: ilYa(0.3), forme: 'mondialrelay' } } },
  { id: `email_track_vinted_${N}`, data: { type: 'suivi', carrier: 'vinted', suivi: N, status: 'info', statusLabel: 'Info', subject: 'Ton colis est en route', receivedAt: ilYa(3), emailAt: ilYa(3), account: 'compte_a' } },
  { id: `transp_mondialrelay_${N}`, data: { v: 1, suivi: N, carrier: 'mondialrelay', etat: 'disponible', fini: false, libelle: '4 jours restants pour retirer', etatAt: ilYa(1.5), lu: ilYa(0.05), source: 'serveur', evenements: [] } },
  { id: `email_track_autre_conv-${conv(9401)}`, data: { type: 'suivi', carrier: 'autre', suivi: '', status: 'available', statusLabel: 'Arrivé au point relais (Vinted)', subject: 'Commande mise à jour pour Baskets cuir camel 42', receivedAt: ilYa(1.4), emailAt: ilYa(1.4), arriveLe: ilYa(1.4), code: '555001', lieu: LIEU, limite: null, consigne: false, conv: conv(9401), source: 'vinted-commande', cleLigne: `email_track_autre_conv-${conv(9401)}`, account: 'compte_a' } },
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
    if (/images1\.vinted\.net/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#dfe3e8"/></svg>' });
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
      console.log(`\n— Un colis, une ligne · ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre, MATIN);
      await essaie(nom, async () => {
        await pg.locator('[data-colis-section]').first().waitFor({ timeout: 30000 });
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' })));
        await pg.waitForFunction(() => document.querySelectorAll('.vrm-rpf .vrm-rpf-ligne[data-cc-carte]').length >= 1, null, { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(2500);
        await pg.evaluate(() => { document.querySelectorAll('.vrm-rpf details').forEach((d) => { d.open = true; }); });
        await pg.waitForTimeout(400);
        const r = await pg.evaluate(() => {
          const lignes = [...document.querySelectorAll('.vrm-rpf [data-cc-carte], .vrm-rpf [data-en-route-achat]')].map((l) => ({ cle: l.getAttribute('data-cc-carte') || ('route:' + l.getAttribute('data-en-route-achat')),
            titre: ((l.querySelector('.vrm-rpf-titre') || {}).textContent || '').trim(), code: (l.querySelector('[data-code-retrait]') || { getAttribute: () => '' }).getAttribute('data-code-retrait') || '',
            suivi: (l.querySelector('[data-rp-suivi-ligne]') || { getAttribute: () => '' }).getAttribute('data-rp-suivi-ligne') || '',
            section: (l.closest('[data-rp-section]') || { getAttribute: () => '' }).getAttribute('data-rp-section') }));
          let pub = null; try { pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) {}
          return { lignes, pub };
        });
        if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); const el = await pg.$('.vrm-rpf'); if (el) await el.screenshot({ path: path.join(SHOTS, `un-colis-${nom}.png`) }).catch(() => {}); }
        const deCeColis = r.lignes.filter((l) => l.cle.includes(N) || l.cle.includes('9401') || l.suivi.includes(N) || /camel/i.test(l.titre) || l.code === '555001');
        dit(deCeColis.length === 1, `${nom} : le colis (arrivée + 2 rappels + SMS + point changé + e-mail Vinted + achat relié + « Commande mise à jour ») = UNE ligne`, JSON.stringify(deCeColis));
        dit(deCeColis.length === 1 && /Baskets cuir camel 42/.test(deCeColis[0].titre) && deCeColis[0].code === '555001', `${nom} : au nom de l'article relié, avec son code`, JSON.stringify(deCeColis[0] || null));
        const temoin = r.lignes.filter((l) => l.cle.includes('9402') || /Pull marin/.test(l.titre));
        dit(temoin.length === 1, `${nom} : l'achat sans n° ni code au même point : montré une fois (jamais fusionné par ressemblance)`, JSON.stringify(temoin));
        const comptees = r.lignes.filter((l) => ['aujourdhui', 'prets', 'avenir', 'lieu'].includes(l.section)).length;
        dit(!!r.pub && Number.isFinite(r.pub.total) && r.pub.total === comptees, `${nom} : le compte publié (Ma journée, widget) = les lignes comptées`, JSON.stringify({ pub: r.pub && r.pub.total, comptees }));
      });
      dit(!errs.length, `${nom} : aucune erreur`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} retirer-un-colis : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
