// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE RAPPEL URSSAF À L'ÉCHÉANCE (20 octobre)
//        (node scripts/bancs/rappel-urssaf.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Le rappel partait le 1er de chaque mois, sans date ni montant, quel que soit
// le rythme, même pour une période déjà notée « déclaré ». La règle est
// `rappelUrssaf` (une seule) ; Ma journée le rend comme une action
// (`data-job="urssaf"`, `data-urssaf-echeance`, `data-urssaf-apayer`).
// Ce banc rend Ma journée sur des données INVENTÉES (il vit dans le dépôt),
// horloge fixée, fuseau de Paris, aux deux tailles (390 px tactile, 1512 px) :
//   A. trimestriel, 27 octobre, T3 publié 600 € ⇒ action, échéance 31 octobre,
//      à payer 81 € (13,5 %), dite UNE fois ;
//   B. même jour, les trois mois de T3 notés « déclaré » ⇒ aucune action ;
//   C. trimestriel, 2 novembre (T4 en cours) ⇒ aucune action ;
//   D. aucun débordement, aucune erreur, aucun écran tombé.
// On juge les ATTRIBUTS et les nombres rendus, jamais une formulation.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4371;

const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: '2026-10-27T08:00:00Z' }];
const LIGNE = { at: '2026-10-27T07:00:00Z', mois: [{ ym: '2026-07', ca: 100, n: 1 }, { ym: '2026-08', ca: 200, n: 2 }, { ym: '2026-09', ca: 300, n: 3 }, { ym: '2026-10', ca: 999, n: 9 }] };
// (23 oct., intégration) Les VENTES qui donnent cette ligne. Depuis la revue
// URSSAF du 22 octobre, le rappel suit la DERNIÈRE ligne publiée : l'écran
// Ventes la republie à partir des ventes lues — un banc qui servait la ligne
// (600 € au T3) SANS aucune vente obtenait une republication à 0 €, juste, et
// mesurait son incohérence. Versées en juillet, août, septembre (T3) et
// octobre (hors T3, il ne doit pas compter).
const VENTES_T = [[9101, 100, '2026-06-20T10:00:00Z', '2026-07-15T10:00:00Z'], [9102, 200, '2026-07-25T10:00:00Z', '2026-08-14T10:00:00Z'], [9103, 300, '2026-08-25T10:00:00Z', '2026-09-15T10:00:00Z'], [9104, 999, '2026-10-01T10:00:00Z', '2026-10-15T10:00:00Z']];
const DECLARE = { '2026-07': { ids: ['vinted:9101'], n: 1, ca: 100 }, '2026-08': { ids: ['vinted:9102'], n: 1, ca: 200 }, '2026-09': { ids: ['vinted:9103'], n: 1, ca: 300 } };
const rowsDe = (declare) => [
  { id: 'main', data: { vinted_urssaf_freq: 'trimestriel', vinted_urssaf_mois: LIGNE, ...(declare ? { vrm_urssaf_declare: declare } : {}) } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: '2026-10-27T07:30:00Z', payload: { my_orders: VENTES_T.map(([tx, eur, vendu]) => ({ transaction_id: tx, id: tx, title: 'Baskets inventées ' + tx, price: { amount: String(eur), currency_code: 'EUR' }, status: 'Commande finalisée', date: vendu })) } } },
  ...VENTES_T.map(([tx, , , verse]) => ({ id: 'harvest_111_txn_' + tx, data: { capturedAt: '2026-10-27T07:30:00Z', payload: { transaction: { id: tx, status: 450, status_title: 'Commande finalisée', status_updated_at: verse } } } })),
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 140)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

async function rendre(b, vp, horloge, declare) {
  const ROWS = rowsDe(declare);
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: new Date(horloge) });
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || '2026-10-27T08:00:00Z', cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 24; i++) { await pg.clock.runFor(500); await pg.waitForTimeout(250); }
  return { ctx, pg, errs };
}
const lire = (pg) => pg.evaluate(() => {
  const els = [...document.querySelectorAll('[data-job="urssaf"], [data-job="a-faire-receipt"]')];
  return { n: els.length, echeance: els[0] && els[0].getAttribute('data-urssaf-echeance'), apayer: els[0] && els[0].getAttribute('data-urssaf-apayer'),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText };
});
const sain = (r, ecran) => {
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      await essaie('A', async () => {
        const { ctx, pg, errs } = await rendre(b, vp, '2026-10-27T10:00:00+01:00', null);
        const r = await lire(pg);
        dit(r.n === 1, 'A : le rappel URSSAF est sur Ma journée, UNE fois', `${r.n} fois`);
        dit(r.echeance === '2026-10-31', 'A : il porte l’échéance du T3 (31 octobre)', r.echeance);
        dit(r.apayer === '81', 'A : le montant vient de la ligne publiée, période T3 seulement (600 € × 13,5 % = 81 €)', r.apayer);
        sain(r, 'Ma journée');
        dit(errs.length === 0, 'A : aucune erreur de page', errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      await essaie('B', async () => {
        const { ctx, pg } = await rendre(b, vp, '2026-10-27T10:00:00+01:00', DECLARE);
        const r = await lire(pg);
        dit(r.n === 0, 'B : les trois mois de T3 notés « déclaré » ⇒ aucun rappel', `${r.n} fois`);
        await ctx.close();
      });
      await essaie('C', async () => {
        const { ctx, pg } = await rendre(b, vp, '2026-11-02T10:00:00+01:00', null);
        const r = await lire(pg);
        dit(r.n === 0, 'C : trimestriel, 2 novembre (T4 en cours) ⇒ aucun rappel le début du mois', `${r.n} fois`);
        sain(r, 'Ma journée (C)');
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ rappel URSSAF : ${ko} rouge(s)` : '\n✅ rappel URSSAF : tout est vert');
  process.exit(ko ? 1 : 0);
})();
