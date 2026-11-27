// ════════════════════════════════════════════════════════════════════════════
//  Banc : LE MÊME COLIS DEUX FOIS AU MÊME POINT — « 978 216 » (27 nov., capture iPhone de Julien, Achats).
//  Point « Joubert Peintures » (Vinted Go) : la paire « Payé 13,36 € · shop_cancale » au code 978 216, deux fois —
//  « Au point · 20 nov. » comptée, puis sous « Pas compté dans à retirer » la MÊME paire, son QR, « Date limite
//  dépassée · à vérifier », « Au point · 19 nov. ».
//  Base SYNTHÉTIQUE de la forme MESURÉE (passation du 23 nov. : `email_track_vinted_{n°}`, « Relais Vinted Go, <commerce>,
//  <rue> », code, QR, arrivé le 19, limite LUE le 25 ; le rappel du 22 tombé sur la même ligne) + l'e-mail Vinted « Commande
//  mise à jour » de SA conversation (`source: 'vinted-commande'`, SANS code écrit, sans limite, arrivé le 20) + l'achat
//  (conversation lue : le code 978216) — aucune donnée réelle (dépôt public).
//  Témoin (§5, l'esprit d'audit-identite) : un AUTRE achat, MÊME titre, même point, mêmes jours, un autre code et une autre
//  commande ⇒ jamais réuni.
//  Exige, sur les boîtes rendues (data-*) : le colis 978216 = UNE rangée, « à vérifier » (limite lue et passée), datée du
//  19 nov. (le transporteur), avec son QR ; le témoin = une rangée à part ; « Retiré » sur la rangée réunie ⇒ plus aucune
//  rangée 978216 (la moitié Vinted ne revient pas seule) ; le compte publié (`vrm_colis_retirer`) n'a jamais le colis deux
//  fois. 390 tactile et 1512, clair et sombre. `BANC_PORT`, `BANC_DIST`, `SHOTS=dossier` (captures à regarder).
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path');
let chromium, PW;
try { PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')); }
catch (_) { PW = require('playwright'); }
({ chromium } = PW);
const { lancer, estWebkit } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4491);
const MATIN = new Date('2026-11-27T09:02:00+01:00');
const MS = MATIN.getTime();
const iso = (t) => new Date(t).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const cap = iso(MS - 3600e3);
const SHOTS = process.env.SHOTS || '';
const N = '1792000000000099';
const LIEU = 'Relais Vinted Go, Droguerie du Banc, 10 Rue Inventée';
const DEPOSE = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const conv = (id) => `0000aaaa-0000-4000-8000-${String(id).padStart(12, '0')}`;
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const TITRE = 'Nike Air Zoom Alphafly NEXT% Eliud Kipchoge 44';
const achat = (id, k) => ({ transaction_id: id, conversation_id: conv(id), title: TITRE, price: { amount: '13.36', currency_code: 'EUR' }, status: DEPOSE, transaction_user_status: 'needs_action', date: iso(MS - 12 * 864e5), photo: { url: url(k) } });
const QR = 'http://p.vintedgo.com/public/v1/qr_codes/0000aaaa.png';
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Saint-Malo' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [achat(9401, 1), achat(9402, 2)] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'panel_colis_relais', data: { 9401: { code: '978216', lieu: LIEU, transporteur: 'vinted', at: '2026-11-20T10:00:00.000Z' }, 9402: { code: '431907', lieu: LIEU, transporteur: 'vinted', at: '2026-11-20T10:00:00.000Z' } } },
  // L'e-mail Vinted Go (arrivée du 19, rappel du 22 sur la MÊME ligne), code écrit « 978 216 », QR, limite LUE le 25.
  { id: `email_track_vinted_${N}`, data: { type: 'suivi', carrier: 'vinted', suivi: N, status: 'available', statusLabel: 'Au point relais', subject: `Rappel : récupère ton colis avant le 25/11/2026 #${N}`,
    receivedAt: '2026-11-22T08:00:00.000Z', emailAt: '2026-11-22T08:00:00.000Z', arriveLe: '2026-11-19T08:00:00.000Z', code: '978 216', lieu: LIEU, limite: '2026-11-25', consigne: false, qrUrl: QR, account: 'compte_a' } },
  // La moitié Vinted : « Commande mise à jour » de SA conversation, SANS code écrit, sans limite, le 20.
  { id: `email_track_autre_conv-${conv(9401)}`, data: { type: 'suivi', carrier: 'autre', suivi: '', status: 'available', statusLabel: 'Arrivé au point relais (Vinted)', subject: `Commande mise à jour pour ${TITRE}`,
    receivedAt: '2026-11-20T09:00:00.000Z', emailAt: '2026-11-20T09:00:00.000Z', arriveLe: '2026-11-20T09:00:00.000Z', code: null, lieu: LIEU, limite: null, consigne: false, conv: conv(9401), source: 'vinted-commande', cleLigne: `email_track_autre_conv-${conv(9401)}`, account: 'compte_a' } },
  // Le témoin : MÊME titre, même point, mêmes jours — un autre code, une autre commande.
  { id: `email_track_autre_conv-${conv(9402)}`, data: { type: 'suivi', carrier: 'autre', suivi: '', status: 'available', statusLabel: 'Arrivé au point relais (Vinted)', subject: `Commande mise à jour pour ${TITRE}`,
    receivedAt: '2026-11-20T09:00:00.000Z', emailAt: '2026-11-20T09:00:00.000Z', arriveLe: '2026-11-20T09:00:00.000Z', code: '431907', lieu: LIEU, limite: null, consigne: false, conv: conv(9402), source: 'vinted-commande', cleLigne: `email_track_autre_conv-${conv(9402)}`, account: 'compte_a' } },
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d && !c ? ' — ' + d : '')); };
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
const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: MATIN });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/images1\.vinted\.net|vintedgo\.com/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#dfe3e8"/></svg>' });
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
  await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};
const lire = (pg) => pg.evaluate(() => {
  const rangs = [...document.querySelectorAll('[data-rp-point] [data-rp-colis]')].map((li) => ({
    cle: li.getAttribute('data-rp-colis') || '', code: (li.getAttribute('data-rp-code') || li.getAttribute('data-v2-code') || '').replace(/\s+/g, ''),
    verif: li.getAttribute('data-rp-verif') || '', qr: li.getAttribute('data-v2-qr-dispo') || '',
    etapes: [...li.querySelectorAll('[data-rp-etape][data-rp-etape-lue="1"]')].map((e) => [e.getAttribute('data-rp-etape'), (e.getAttribute('data-rp-etape-at') || '').slice(0, 10)]),
    texte: li.innerText.replace(/\s+/g, ' ').slice(0, 160) }));
  let pub = null; try { pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) {}
  return { rangs, pub };
});

(async () => {
  const b = await lancer(PW, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch((e) => { if (estWebkit) throw e; return chromium.launch(); });
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      console.log(`\n— 978 216 au même point · ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      await essaie(nom, async () => {
        await pg.waitForFunction(() => document.querySelectorAll('[data-rp-point] [data-rp-colis]').length >= 2, null, { timeout: 40000 }).catch(() => {});
        await pg.waitForTimeout(2500);
        const r = await lire(pg);
        if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); const el = await pg.$('[data-rp-point]'); if (el) { await el.scrollIntoViewIfNeeded().catch(() => {}); await el.screenshot({ path: path.join(SHOTS, `double-code-${nom}.png`) }).catch(() => {}); } }
        const ceColis = r.rangs.filter((x) => x.code === '978216');
        dit(ceColis.length === 1, `${nom} : le colis 978 216 (e-mail Vinted Go + moitié Vinted) = UNE rangée`, JSON.stringify(r.rangs));
        const x = ceColis[0] || {};
        dit(x.verif === 'depasse', `${nom} : sa limite LUE (25 nov.) est passée ⇒ « Date limite dépassée · à vérifier »`, JSON.stringify(x));
        dit(x.qr === '1', `${nom} : il garde le QR de l'e-mail du transporteur`, JSON.stringify(x));
        const auPoint = (x.etapes || []).find((e) => e[0] === 'point');
        dit(!auPoint || auPoint[1] === '2026-11-19', `${nom} : « Au point » daté du 19 nov. (le transporteur), jamais du 20 (Vinted)`, JSON.stringify(x.etapes));
        const temoin = r.rangs.filter((y) => y.code === '431907');
        dit(temoin.length === 1, `${nom} : le témoin (même titre, même point, autre code, autre commande) : une rangée à part, jamais réunie`, JSON.stringify(r.rangs));
        const pubIds = r.pub ? JSON.stringify([...(r.pub.colis || []), ...(r.pub.verif || [])]) : '';
        dit(!!r.pub && (pubIds.match(new RegExp(N, 'g')) || []).length <= 1 && !(r.pub.colis || []).some((c) => String(c[3] || '').includes('9401')), `${nom} : le compte publié (Ma journée, widget) n'a jamais ce colis deux fois`, JSON.stringify(r.pub && { total: r.pub.total, colis: r.pub.colis, verif: r.pub.verif }));
        if (vp.width < 600 && !sombre) {
          const bouton = pg.locator('[data-rp-colis] [data-rp-verif-geste="retire"]').first();
          if (await bouton.count()) { await bouton.click(); await pg.waitForTimeout(2500); }
          const apres = await lire(pg);
          if (SHOTS) { const el = await pg.$('[data-rp-point]'); if (el) await el.screenshot({ path: path.join(SHOTS, `double-code-${nom}-apres-retire.png`) }).catch(() => {}); }
          const restes = apres.rangs.filter((y) => y.code === '978216' && !/gris|retir/i.test(y.verif));
          dit(restes.length === 0, `${nom} : « Retiré » sur la rangée réunie ⇒ plus aucune rangée 978 216 (la moitié Vinted ne revient pas seule)`, JSON.stringify(apres.rangs));
          dit(apres.rangs.filter((y) => y.code === '431907').length === 1, `${nom} : le témoin reste`, JSON.stringify(apres.rangs));
        }
      });
      dit(!errs.length, `${nom} : aucune erreur`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} retrait-double-code : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
