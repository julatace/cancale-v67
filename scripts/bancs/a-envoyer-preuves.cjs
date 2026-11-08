// Banc : « À ENVOYER » PROUVÉ (8 nov.) — api/_lib/depart-vente.js, la règle unique.
// Julien : « J'ai expédié des colis, c'est encore marqué qu'il faut que je les expédie. C'est
// inadmissible. » Ses listes Vinted figées (« Bordereau envoyé au vendeur ») ; l'e-mail de dépôt du n°
// de son bordereau existait.
// Données INVENTÉES (dépôt public), formes réelles : six ventes Vinted au MÊME titre, toutes encore
// « à expédier » chez Vinted (`needs_action`, statut figé), leurs bordereaux e-mail (`email_bord_{tx}`) :
//   9501 : e-mail « entre de bonnes mains » pour le n° de SON bordereau ⇒ partie ;
//   9502 + 9503 : le MÊME n° sur deux bordereaux, avec un e-mail ⇒ ambigu, les deux restent ;
//   9504 : un e-mail ENTRANT (« disponible », sens entrant) pour son n° ⇒ reste ;
//   9505 : aucun e-mail ⇒ reste ; 9506 : annulée (et un e-mail) ⇒ jamais « à envoyer ».
// Horloge figée (8 nov. 11 h). 390 tactile et 1512. Jugé sur data-* et nombres rendus (§6.4).
//  A. Colis → « À envoyer » : 9502, 9503, 9504, 9505 ;
//  E. Colis → « Envoyés » : 9501, preuve « email », la raison « E-mail de dépôt Chronopost du 7 nov. » ;
//  J. Ma journée : la tuile « envoyer » compte 4 ; C. la cloche (`vrm_colis_aposter` publié) : 4 ;
//  Z. aucune erreur, rien ne déborde.
// Lancer : construire dist/, puis node scripts/bancs/a-envoyer-preuves.cjs   (BANC_PORT 9063, SHOTS=dossier)
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 9063);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date(2026, 10, 8, 11, 0, 0);
const MS = maintenant.getTime(), J = 864e5, H = 36e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const TITRE = 'Nike Dunk Low Panda 42';
const V = [
  { tx: 9501, suivi: 'XW200000001TS', num: '51' }, { tx: 9502, suivi: 'XW200000002TS', num: '52' }, { tx: 9503, suivi: 'XW200000002TS', num: '53' },
  { tx: 9504, suivi: 'XW200000004TS', num: '54' }, { tx: 9505, suivi: 'XW200000005TS', num: '55' }, { tx: 9506, suivi: 'XW200000006TS', num: '56', annulee: true },
];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const DEPOT = Date.UTC(2026, 10, 7, 9, 0, 0);
const email = (n, o = {}) => ({ id: 'email_track_chronopost_' + n, data: { type: 'suivi', carrier: 'chronopost', suivi: n, status: 'transit', statusLabel: 'En transit', subject: 'Votre colis est entre de bonnes mains', receivedAt: iso(DEPOT), emailAt: iso(DEPOT), sens: 'sortant', ...o } });
const lignes = () => [
  { id: 'main', data: { vinted_used_numeros: V.map((v) => Number(v.num)), vinted_annonce_numeros: Object.fromEntries(V.map((v) => [`i${v.tx}`, { numero: v.num, title: TITRE, auto: false, numberedAt: ilYa(30) }])) } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS - 2 * J), payload: { my_orders: V.map((v) => ({ transaction_id: v.tx, title: TITRE, price: { amount: '80.0', currency_code: 'EUR' }, status: v.annulee ? 'Commande annulée' : 'Bordereau d’envoi envoyé au vendeur', transaction_user_status: v.annulee ? 'failed' : 'needs_action', date: ilYa(3) })) } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS - 2 * J), payload: { my_orders: [] } } },
  ...V.map((v) => ({ id: `harvest_111_txn_${v.tx}`, data: { capturedAt: ilYa(2.5), payload: { transaction: { id: v.tx, item_id: `i${v.tx}` } } } })),
  ...V.map((v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: '111', filename: `bordereau-${v.tx}.pdf`, modele: TITRE, article: TITRE, receivedAt: ilYa(2.8), pdfB64: PDF_B64, suivi: v.suivi } })),
  email('XW200000001TS'),
  email('XW200000002TS'),
  email('XW200000004TS', { status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis est disponible', sens: 'entrant' }),
  email('XW200000006TS'),
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
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
    if (src === 'updated_at') { out[alias] = iso(MS); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
async function ouvrir(b, vp, { tab = 'cat_bord' } = {}) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = [];
  const LIGNES = lignes();
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(({ m }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
      localStorage.setItem('vinted_annonce_numeros', JSON.stringify(m.vinted_annonce_numeros)); localStorage.setItem('vinted_used_numeros', JSON.stringify(m.vinted_used_numeros));
    } catch (_) {}
  }, { m: LIGNES[0].data });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const h = { 'access-control-allow-origin': '*' };
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecrits.push(String(req.postData() || '')); return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' }); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(MS), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, tel, ecrits };
}
const onglet = async (pg, v) => {
  await pg.click(`[data-colis-onglet-choix="${v}"]`).catch(() => {});
  await pg.waitForFunction((x) => { const e = document.querySelector('[data-colis-onglet]'); return e && e.getAttribute('data-colis-onglet') === x; }, v, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(700);
};
const shot = async (pg, nom) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: true }); };
const lireEnvoyer = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-bord-card]')].map((x) => x.getAttribute('data-colis-ident') || ('vc:' + (x.getAttribute('data-vc-colis') || ''))).filter(Boolean).sort());
const sain = async (pg, ecran) => {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const k = vp.width;
      console.log(`── ${k} px`);
      { const { ctx, pg, errs } = await ouvrir(b, vp);
        await essaie('Colis', async () => {
          await pg.waitForSelector('[data-colis-onglet-choix]', { timeout: 30000 });
          await onglet(pg, 'envoyer');
          await pg.waitForFunction(() => document.querySelectorAll('[data-bord-card]').length >= 3, null, { timeout: 20000 }).catch(() => {});
          await pg.waitForTimeout(2500);
          const A = await lireEnvoyer(pg);
          dit(A.join() === 'v:9502,v:9503,v:9504,v:9505', 'A. « À envoyer » : 9502, 9503 (n° partagé), 9504 (e-mail entrant), 9505 (aucune preuve) — 9501 (déposé) et 9506 (annulée) n’y sont pas', A.join());
          await shot(pg, `a-envoyer-preuves-envoyer-${k}`);
          await sain(pg, 'Colis → À envoyer');
          await onglet(pg, 'envoyes');
          const E = await pg.evaluate(() => [...document.querySelectorAll('[data-colis-envoye][data-depart-preuve]')].map((x) => ({ id: x.getAttribute('data-colis-envoye'), p: x.getAttribute('data-depart-preuve'), t: x.innerText })));
          dit(E.map((x) => x.id).join() === 'v:9501' && E[0].p === 'email', 'E. « Envoyés » : 9501, parti par l’e-mail de dépôt de SON n°', JSON.stringify(E.map((x) => [x.id, x.p])));
          dit(E.length === 1 && /E-mail de dépôt Chronopost du 7\snov\./.test(E[0].t), 'E. la raison est dite : « E-mail de dépôt Chronopost du 7 nov. »', E.map((x) => x.t.replace(/\n/g, ' ').slice(0, 140)).join(' | '));
          await shot(pg, `a-envoyer-preuves-envoyes-${k}`);
          await sain(pg, 'Colis → Envoyés');
        });
        dit(errs.length === 0, 'Z. aucune erreur de page (Colis)', errs.join(' | ').slice(0, 200));
        await ctx.close(); }
      { const { ctx, pg, errs } = await ouvrir(b, vp, { tab: 'cat_ventes' });
        await essaie('Ventes', async () => {
          await pg.waitForFunction(() => /Nike Dunk Low Panda 42/.test(document.body.innerText), null, { timeout: 30000 });
          await pg.waitForTimeout(3000);
          const t = await pg.evaluate(() => document.body.innerText);
          const envoyee = (t.match(/\bEnvoyée\b/g) || []).length;
          dit(envoyee >= 1, 'V. Ventes : la vente déposée dit « Envoyée » (plus « À envoyer »)', `« Envoyée » ×${envoyee}`);
          await shot(pg, `a-envoyer-preuves-ventes-${k}`);
          await sain(pg, 'Ventes');
        });
        dit(errs.length === 0, 'Z. aucune erreur de page (Ventes)', errs.join(' | ').slice(0, 200));
        await ctx.close(); }
      { const { ctx, pg, errs } = await ouvrir(b, vp, { tab: 'journee' });
        await essaie('Ma journée', async () => {
          await pg.waitForSelector('[data-tuile="envoyer"]', { timeout: 30000, state: 'attached' });
          await pg.waitForTimeout(4000);
          const t = await pg.evaluate(() => { const e = document.querySelector('[data-tuile="envoyer"]'); return e ? { n: e.getAttribute('data-n') } : null; });
          dit(t && t.n === '4', 'J. Ma journée : « à envoyer » = 4', JSON.stringify(t));
          const pub = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'); } catch (_) { return null; } });
          const cloche = pub && typeof pub === 'object' ? (pub.vinted != null ? pub.vinted : pub.total) : null;
          dit(cloche === 4, 'C. la cloche : `vrm_colis_aposter` publié = 4 colis Vinted', JSON.stringify(pub && { total: pub.total, vinted: pub.vinted }));
          await shot(pg, `a-envoyer-preuves-journee-${k}`);
          await sain(pg, 'Ma journée');
        });
        dit(errs.length === 0, 'Z. aucune erreur de page (Ma journée)', errs.join(' | ').slice(0, 200));
        await ctx.close(); }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ « à envoyer » prouvé : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ « à envoyer » prouvé : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
srv.listen(PORT);
