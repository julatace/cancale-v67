// ═══════════════════════════════════════════════════════════════════════════
// BANC : « COCHÉ POSTÉ » MAIS VINTED NE L'A PAS VU PARTIR (6 octobre)
//        (node scripts/bancs/poste-sans-depart.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré le 6 octobre sur sa base : deux ventes (65 € et 75 €) cochées
// « posté » il y a 159 h et 92 h, que Vinted disait TOUJOURS « Bordereau
// envoyé au vendeur » dans une capture faite APRÈS la coche — et aucune alerte
// nulle part : cocher sort la vente de « à envoyer » partout. Deux autres,
// cochées le 29 septembre, ne sont connues que par une capture du 20 : on ne
// sait pas, on ne les accuse pas.
//
// La règle est `posteSansDepart` (une seule), la liste `cochesNonPartis` (un
// propriétaire), Colis ET Ma journée la lisent. Ce banc rend l'app sur des
// ventes INVENTÉES (il vit dans le dépôt, qui est public) :
//   9201  « Bordereau envoyé au vendeur », coché il y a 159 h  ⇒ ALERTE
//   9202  idem, autre compte, coché il y a 92 h                ⇒ ALERTE
//   9203  idem, coché il y a 5 h, limite dans 6 j             ⇒ rien (trop tôt)
//   9204  « Le paiement a été validé », coché il y a 10 h, vendu il y a 9 j
//         (date limite dépassée)                               ⇒ ALERTE
//   9205  coché il y a 100 h, Vinted dit « en cours d'acheminement » ⇒ rien
//   9206  coché il y a 100 h, mais le compte n'a pas été recapté depuis la
//         coche (capture d'il y a 150 h)                       ⇒ rien (pas su)
//   9207  pas coché, à envoyer                                 ⇒ rien (« à envoyer »)
// Il exige, aux deux tailles (390 px tactile, 1512 px) :
//   1. Colis : l'alerte nomme EXACTEMENT 9201, 9202, 9204 (`data-tx`), 9204
//      marquée « date limite dépassée », le geste dit UNE fois ;
//   2. Ma journée : l'action « Vérifier N colis » porte le MÊME nombre (§11) ;
//   3. « ↺ Pas encore posté » remet la vente dans « à envoyer » et la sort de
//      l'alerte ;
//   4. l'autre sens : 9203, 9205, 9206, 9207 n'y sont jamais ;
//   5. aucun débordement, aucune erreur, aucun écran tombé.
// On juge les ATTRIBUTS (`data-poste-sans-depart`, `data-tx`, `data-job`,
// `data-n`) et les nombres rendus, jamais une formulation.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4361;

const MAINTENANT = Date.now();
const H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const V = {
  9201: { acc: '111', titre: 'Alpha Poste taille 42', status: 'Bordereau envoyé au vendeur', tus: 'needs_action', venteH: 150, cocheH: 159, prix: '65.0' },
  9202: { acc: '222', titre: 'Bravo Poste taille 41', status: 'Bordereau envoyé au vendeur', tus: 'needs_action', venteH: 130, cocheH: 92, prix: '75.0' },
  9203: { acc: '111', titre: 'Charlie Poste taille 40', status: 'Bordereau envoyé au vendeur', tus: 'needs_action', venteH: 24, cocheH: 5, prix: '50.0' },
  9204: { acc: '111', titre: 'Delta Poste taille 43', status: 'Le paiement a été validé', tus: 'needs_action', venteH: 9 * 24, cocheH: 10, prix: '86.0' },
  9205: { acc: '111', titre: 'Echo Poste taille 39', status: "Commande expédiée et en cours d'acheminement ! ", tus: 'waiting', venteH: 140, cocheH: 100, prix: '44.0' },
  9206: { acc: '333', titre: 'Foxtrot Poste taille 44', status: 'Bordereau envoyé au vendeur', tus: 'needs_action', venteH: 160, cocheH: 100, prix: '79.0' },
  9207: { acc: '111', titre: 'Golf Poste taille 38', status: 'Bordereau envoyé au vendeur', tus: 'needs_action', venteH: 20, cocheH: null, prix: '55.0' },
};
const ALERTES = ['9201', '9202', '9204'];
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: ilYaH(0) },
  { id: 3, vinted_user_id: '333', login: 'compte_c', domain: 'www.vinted.fr', updated_at: ilYaH(0) },
];
const CAPTURE = { 111: ilYaH(0.2), 222: ilYaH(0.5), 333: ilYaH(150) };   // 333 : capturé AVANT la coche
const ventesDe = (acc) => Object.entries(V).filter(([, v]) => v.acc === acc).map(([tx, v]) => ({
  transaction_id: Number(tx), title: v.titre, price: { amount: v.prix, currency_code: 'EUR' }, status: v.status, transaction_user_status: v.tus, date: ilYaH(v.venteH),
}));
const SHIP_DONE = Object.fromEntries(Object.entries(V).filter(([, v]) => v.cocheH != null).map(([tx, v]) => [tx, MAINTENANT - v.cocheH * H]));
const ROWS = [
  { id: 'main', data: { vinted_ship_done: SHIP_DONE } },
  ...['111', '222', '333'].map((a) => ({ id: `harvest_${a}_orders_sold`, data: { capturedAt: CAPTURE[a], payload: { my_orders: ventesDe(a) } } })),
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 140)); } };
const memes = (a, b) => a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
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

async function preparer(b, vp) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
async function sain(pg, ecran) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
}
const lireAlerte = (pg) => pg.evaluate(() => {
  const el = document.querySelector('[data-poste-sans-depart]');
  if (!el) return null;
  return { n: Number(el.getAttribute('data-poste-sans-depart')), txs: [...el.querySelectorAll('[data-tx]')].map((x) => ({ tx: x.getAttribute('data-tx'), limite: x.getAttribute('data-limite') })),
    txt: el.innerText };
});
const aEnvoyer = (pg) => pg.evaluate(() => { const m = /(\d+)\s*colis à envoyer/.exec(document.body.innerText); return m ? Number(m[1]) : 0; });

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const { ctx, pg, errs } = await preparer(b, vp);
      let nColis = null;
      await essaie('Colis', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(4500);
        const a = await lireAlerte(pg);
        const txs = a ? a.txs.map((x) => x.tx) : [];
        dit(!!a && a.n === 3 && memes(txs, ALERTES), 'Colis : l’alerte nomme EXACTEMENT les trois ventes cochées que Vinted n’a pas vues partir', a ? JSON.stringify(txs) : 'aucune alerte');
        dit(!!a && (a.txs.find((x) => x.tx === '9204') || {}).limite === 'depassee', 'Colis : 9204 (vendue il y a 9 j) porte « date limite dépassée »', a && JSON.stringify(a.txs));
        dit(!!a && ['9203', '9205', '9206', '9207'].every((t) => !txs.includes(t)), 'Colis : ni 9203 (trop tôt), ni 9205 (partie), ni 9206 (pas recaptée depuis la coche), ni 9207 (pas cochée)', JSON.stringify(txs));
        nColis = a ? a.n : 0;
        const gestes = a ? (a.txt.match(/Vérifie que le colis a bien été déposé/g) || []).length : 0;
        dit(gestes === 1, 'le geste est dit UNE fois pour tout le groupe (§7)', `${gestes} fois`);
        await pg.screenshot({ path: path.join(os.tmpdir(), 'poste-sans-depart-colis-' + vp.width + '.png'), fullPage: true }).catch(() => {});
        await sain(pg, 'Colis');
      });
      await essaie('Ma journée', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(4500);
        const job = await pg.evaluate(() => { const e = document.querySelector('[data-job="poste-sans-depart"]'); return e ? Number(e.getAttribute('data-n')) : null; });
        dit(job === 3 && job === nColis, 'Ma journée : « Vérifier N colis » porte le MÊME nombre que Colis (une règle, un propriétaire)', `journée=${job} · colis=${nColis}`);
        await sain(pg, 'Ma journée');
      });
      await essaie('Pas encore posté', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(4500);
        const avant = await aEnvoyer(pg);
        await pg.click('[data-annuler-poste="9201"]', { timeout: 5000 });
        await pg.waitForTimeout(900);
        const a = await lireAlerte(pg);
        const apres = await aEnvoyer(pg);
        dit(!!a && a.n === 2 && !a.txs.some((x) => x.tx === '9201'), '« ↺ Pas encore posté » sort 9201 de l’alerte', a ? JSON.stringify(a.txs.map((x) => x.tx)) : 'alerte disparue');
        dit(apres === avant + 1, 'et la remet dans « à envoyer »', `avant ${avant} · après ${apres}`);
      });
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ coché posté, jamais vu partir : ${ko} rouge(s)` : '\n✅ coché posté, jamais vu partir : tout est vert');
  process.exit(ko ? 1 : 0);
})();
