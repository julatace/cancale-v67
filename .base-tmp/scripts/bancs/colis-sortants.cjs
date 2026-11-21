// Banc : COLIS VENDUS PARTIS D'APRÈS LE TRANSPORTEUR (8 nov.).
// Julien : « J'ai une commande qui est marquée comme non envoyée car je n'ai pas réactualisé
// Vestiaire Collective, mais tu as le numéro de suivi donc tu peux très bien regarder le statut du
// colis et voir qu'il a été expédié. Je te laisse faire ça pour tous les colis. »
// Données INVENTÉES (dépôt public), formes réelles : deux ventes Vinted « à expédier » (`needs_action`)
// au MÊME titre, leurs bordereaux e-mail (`email_bord_{tx}`, n° Chronopost) ; deux ventes Vestiaire
// « à expédier » (`vc_ventes`, n° Chronopost, même titre) ; les lignes `depart_chronopost_{n°}` que le
// serveur range (scalaires lus par `meta->>`) : 9401 et VC1 pris en charge, 9402 et VC2 sans ligne.
// Horloge figée (8 nov. 11 h). 390 tactile et 1512. Jugé sur data-* et nombres rendus (§6.4).
//  A. « À envoyer » : seuls 9402 et VC2 (le jumeau au même titre reste, par SON n°) ;
//  E. « Envoyés » : 9401 et VC1, chacun avec la raison lue (`data-depart-lu`, « … l’a pris en charge le … ») ;
//  R. « À retirer » : aucun des quatre n° (un colis vendu n'est jamais « à retirer ») ;
//  J. Ma journée : la tuile « envoyer » compte 2 (1 Vinted + 1 Vestiaire) ;
//  P. « pas su » (la lecture des départs en 503) : les 4 restent « à envoyer », rien n'est deviné ;
//  Z. aucune erreur, rien ne déborde.
// Lancer : construire dist/, puis node scripts/bancs/colis-sortants.cjs   (BANC_PORT 9061, SHOTS=dossier)
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 9061);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date(2026, 10, 8, 11, 0, 0);
const MS = maintenant.getTime(), J = 864e5, H = 36e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const TITRE = 'Nike Dunk Low Panda 42';
const V = [{ tx: 9401, suivi: 'XW100000001TS', num: '41' }, { tx: 9402, suivi: 'XW100000002TS', num: '42' }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const depart = (n, priseMs) => ({ id: 'depart_chronopost_' + n, data: { v: 1, sens: 'sortant', suivi: n, carrier: 'chronopost', etat: 'disponible', etatAt: iso(MS - 2 * H), priseAt: iso(priseMs), lu: iso(MS - H), essai: iso(MS - H), essaiRes: 'ok', essais: 0, fini: true } });
const lignes = () => [
  { id: 'main', data: { vinted_used_numeros: V.map((v) => Number(v.num)), vinted_annonce_numeros: Object.fromEntries(V.map((v) => [`i${v.tx}`, { numero: v.num, title: TITRE, auto: false, numberedAt: ilYa(30) }])) } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: V.map((v) => ({ transaction_id: v.tx, title: TITRE, price: { amount: '80.0', currency_code: 'EUR' }, status: 'Bordereau d’envoi envoyé au vendeur', transaction_user_status: 'needs_action', date: ilYa(2) })) } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [] } } },
  ...V.map((v) => ({ id: `harvest_111_txn_${v.tx}`, data: { capturedAt: ilYa(0.5), payload: { transaction: { id: v.tx, item_id: `i${v.tx}` } } } })),
  ...V.map((v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: '111', filename: `bordereau-${v.tx}.pdf`, modele: TITRE, article: TITRE, receivedAt: ilYa(1.8), pdfB64: PDF_B64, suivi: v.suivi } })),
  { id: 'vc_ventes', data: { ventes: {
    VC1: { productId: '900101', ref: '501', etat: 'awaiting_shipping', aExpedier: true, limite: iso(MS + 2 * J), etiquette: true, transporteur: 'Chronopost', suivi: 'XW100000003TS', date: ilYa(2), titre: TITRE },
    VC2: { productId: '900102', ref: '502', etat: 'awaiting_shipping', aExpedier: true, limite: iso(MS + 2 * J), etiquette: true, transporteur: 'Chronopost', suivi: 'XW100000004TS', date: ilYa(2), titre: TITRE },
  } } },
  { id: 'vc_listings', data: { liens: {} } },
  depart('XW100000001TS', MS - 20 * H),
  depart('XW100000003TS', MS - 20 * H),
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
async function ouvrir(b, vp, { panne = false, tab = 'cat_bord' } = {}) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
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
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (panne && /id=like\.depart_/.test(u)) return route.fulfill({ status: 503, contentType: 'text/html', headers: h, body: '<html>503</html>' });
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
  return { ctx, pg, errs, tel };
}
const onglet = async (pg, v) => {
  // (11 nov., revue colis) « À retirer » n'est plus un onglet de Colis : c'est la section de tête d'Achats (lot DJ3).
  // Sans ce passage, le contrôle R lisait l'écran Ventes resté ouvert (ses colis ENVOYÉS) et rougissait à tort.
  if (v === 'retirer') { await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' }))); await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(1500); return; }
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
          await pg.waitForFunction(() => document.querySelectorAll('[data-bord-card]').length >= 2, null, { timeout: 20000 }).catch(() => {});
          await pg.waitForTimeout(1500);
          const A = await lireEnvoyer(pg);
          dit(A.join() === 'v:9402,vc:VC2', 'A. « À envoyer » : seuls 9402 et VC2 (leurs jumeaux au même titre, pris en charge, sont sortis par LEUR n°)', A.join());
          await shot(pg, `colis-sortants-envoyer-${k}`);
          await sain(pg, 'Colis → À envoyer');
          await onglet(pg, 'envoyes');
          const E = await pg.evaluate(() => [...document.querySelectorAll('[data-colis-envoye][data-depart-lu]')].map((x) => ({ id: x.getAttribute('data-colis-envoye'), c: x.getAttribute('data-depart-lu'), t: x.innerText })));
          dit(E.map((x) => x.id).sort().join() === 'v:9401,vc:VC1' && E.every((x) => x.c === 'chronopost'), 'E. « Envoyés » : 9401 et VC1, partis d’après Chronopost', JSON.stringify(E.map((x) => [x.id, x.c])));
          dit(E.length === 2 && E.every((x) => /Chronopost l’a pris en charge le 7 nov\./.test(x.t)), 'E. la raison est dite : « Chronopost l’a pris en charge le 7 nov. »', E.map((x) => x.t.replace(/\n/g, ' ').slice(0, 120)).join(' | '));
          await shot(pg, `colis-sortants-envoyes-${k}`);
          await sain(pg, 'Colis → Envoyés');
          await onglet(pg, 'retirer');
          const R = await pg.evaluate(() => { const t = document.body.innerText + ' ' + [...document.querySelectorAll('[data-colis-ident],[data-suivi]')].map((x) => (x.getAttribute('data-colis-ident') || '') + (x.getAttribute('data-suivi') || '')).join(' '); return ['XW100000001TS', 'XW100000002TS', 'XW100000003TS', 'XW100000004TS', '9401', 'VC1'].filter((n) => t.includes(n)); });
          dit(R.length === 0, 'R. « À retirer » : aucun colis vendu (jamais « à retirer » chez lui)', R.join(','));
          await shot(pg, `colis-sortants-retirer-${k}`);
        });
        dit(errs.length === 0, 'Z. aucune erreur de page (Colis)', errs.join(' | ').slice(0, 200));
        await ctx.close(); }
      { const { ctx, pg, errs } = await ouvrir(b, vp, { tab: 'journee' });
        await essaie('Ma journée', async () => {
          await pg.waitForSelector('[data-tuile="envoyer"]', { timeout: 30000, state: 'attached' });
          await pg.waitForTimeout(3500);
          const t = await pg.evaluate(() => { const e = document.querySelector('[data-tuile="envoyer"]'); return e ? { n: e.getAttribute('data-n'), vc: e.getAttribute('data-vestiaire') } : null; });
          dit(t && t.n === '2', 'J. Ma journée : « à envoyer » = 2 (1 Vinted + 1 Vestiaire)', JSON.stringify(t));
          await shot(pg, `colis-sortants-journee-${k}`);
          await sain(pg, 'Ma journée');
        });
        dit(errs.length === 0, 'Z. aucune erreur de page (Ma journée)', errs.join(' | ').slice(0, 200));
        await ctx.close(); }
      { const { ctx, pg, errs } = await ouvrir(b, vp, { panne: true });
        await essaie('pas su', async () => {
          await pg.waitForSelector('[data-colis-onglet-choix]', { timeout: 30000 });
          await onglet(pg, 'envoyer');
          await pg.waitForFunction(() => document.querySelectorAll('[data-bord-card]').length >= 4, null, { timeout: 20000 }).catch(() => {});
          await pg.waitForTimeout(1500);
          const A = await lireEnvoyer(pg);
          dit(A.join() === 'v:9401,v:9402,vc:VC1,vc:VC2', 'P. départs illisibles : les 4 restent « à envoyer » (« pas su » ne vaut pas « oui »)', A.join());
        });
        dit(errs.length === 0, 'Z. aucune erreur de page (pas su)', errs.join(' | ').slice(0, 200));
        await ctx.close(); }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ colis sortants : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ colis sortants : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
srv.listen(PORT);
