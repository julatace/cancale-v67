// Banc : UN SIGNAL DE L'EXTENSION NE FAIT JAMAIS PARTIR LE RELAIS SERVEUR
// (revue de la 5.165, 11 octobre).
//
// Depuis la 5.165, l'extension prévient l'app (« maj · annonces ») à chaque
// suppression rangée et à chaque dressing rangé. Julien supprimait ~41 annonces
// une par une. Reproduit au rendu par un relecteur : chaque signal relançait les
// lectures de l'écran Annonces ET du calcul de la coque — et, pour un compte lié
// SANS ligne moissonnée, ces lectures retombaient sur `/api/vinted-proxy`, c'est-
// à-dire le SERVEUR qui lit Vinted depuis l'IP de Vercel, au nom d'un autre
// compte : 0 appel avant la 5.165, 24 après 6 suppressions (48 quand les ventes
// et la boîte manquent aussi). C'est le motif « multi-comptes piloté par un
// robot depuis l'IP du serveur » que le code nomme lui-même (§3).
// Sur des données INVENTÉES (il vit dans le dépôt, qui est public), il exige :
//   1. après le chargement, N signaux « maj · annonces » ⇒ ZÉRO appel au relais,
//      sur l'écran Annonces, sur le tableau de bord, et quand les ventes et la
//      boîte de comptes liés manquent aussi ;
//   2. les signaux rapprochés sont REGROUPÉS : la moisson du compte signalé
//      n'est pas relue une fois par signal (6 signaux en 9 s : 3 relectures, 6 avant) ;
//      et un signal sur le compte SANS moisson ne relit rien chez Vinted ;
//   3. l'autre sens : la suppression signalée sort bien de l'écran, sans
//      rechargement — et la dernière d'une rafale n'est pas perdue ;
//   4. aucune erreur d'app.
// Ce qui est jugé : les requêtes réseau (le relais, la ligne relue) et les
// cartes rendues (`data-carte-annonce`) — pas une formulation.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 5733;

const now = Date.now();
const iso = (h) => new Date(now - h * 3600e3).toISOString();
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(0) },
  // lié, jamais visité : AUCUNE ligne moissonnée
  { id: 3, vinted_user_id: '333', login: 'compte_neuf', domain: 'www.vinted.fr', updated_at: iso(0) },
];
const ann = (id, title) => ({ id, title, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false,
  photo: null, brand_title: 'Marque', size_title: '42', status: 'Très bon état', view_count: 3, favourite_count: 0, nPhotos: 4 });
const ITEMS_111 = [ann(7001, 'Zeta Alpha'), ann(7002, 'Zeta Beta'), ann(7003, 'Zeta Gamma'), ann(7004, 'Zeta Delta')];
const lignesDe = ({ sansVentes = false } = {}) => [
  { id: 'main', data: { vinted_annonce_numeros: { '7001': { numero: '11' }, '7002': { numero: '12' }, '7003': { numero: '13' }, '7004': { numero: '14' }, '8001': { numero: '21' } } } },
  { id: 'harvest_111_listings', data: { uid: '111', capturedAt: iso(1), nItems: 4, payload: { items: ITEMS_111, pagination: { total_entries: 4, total_pages: 1 } } } },
  { id: 'harvest_222_listings', data: { uid: '222', capturedAt: iso(0.05), nItems: 1, payload: { items: [ann(8001, 'Zeta Epsilon')], pagination: { total_entries: 1, total_pages: 1 } } } },
  ...(sansVentes ? [] : ['111', '222'].flatMap((u) => [
    { id: `harvest_${u}_orders_sold`, data: { uid: u, capturedAt: iso(0.1), nItems: 1, payload: { my_orders: [{ transaction_id: Number(u) * 10, title: 'Vente ' + u, status: 'Commande finalisée', price: { amount: '30.0', currency_code: 'EUR' }, date: iso(30) }], pagination: { total_pages: 1 } } } },
    { id: `harvest_${u}_inbox`, data: { uid: u, capturedAt: iso(0.1), nItems: 1, payload: { conversations: [{ id: Number(u) * 100, updated_at: iso(2), unread: false }], pagination: { current_page: 1 } } } },
  ])),
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
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
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
const PONT = () => {
  const version = '5.166.0';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' /* la session de banc (_porte-banc.cjs) */ }, vinted: null, cmds: {} } });
  });
  post({ __vmr: 'ready', version });
};

async function rendre(b, { etat, onglet }) {
  const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.addInitScript(PONT);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const journal = { relais: [], lectures111: [] };
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    if (/id=eq\.harvest_111_listings/.test(u)) journal.lectures111.push(Date.now());
    const L = etat.lignes;
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(L.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(L.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    if (/vinted-proxy/.test(r.request().url())) {
      let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (_) {}
      journal.relais.push({ uid: body.uid, endpoint: String(body.endpoint || '').replace(/\?.*/, ''), t: Date.now() });
      // Le relais répond comme Vinted pour le compte neuf : profil et dressing d'une annonce.
      if (/users\/current/.test(body.endpoint)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 200, ok: true, data: { user: { id: 9333 } } }) });
      if (/wardrobe/.test(body.endpoint)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 200, ok: true, data: { items: [ann(9001, 'Zeta Neuf')], pagination: { total_pages: 1, total_entries: 1 } } }) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 404, ok: false }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(6000);
  return { ctx, pg, errs, journal };
}
const cartes = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-carte-annonce]')].map((x) => x.getAttribute('data-carte-annonce')).sort());
const signaler = (pg, uid) => pg.evaluate((u) => window.postMessage({ __vmr: 'evt', evt: { type: 'maj', quoi: 'annonces', uid: u } }, '*'), uid);
const SUPP = (ids) => ({ id: 'harvest_111_supprimees', data: { uid: '111', ids: Object.fromEntries(ids.map((id) => [String(id), new Date().toISOString()])) } });

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); } };
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

    for (const [onglet, sansVentes] of [['cat_annonces', false], ['dashboard', false], ['cat_annonces', true]]) {
      const nom = `${onglet}${sansVentes ? ' (ventes et boîte absentes aussi)' : ''}`;
      console.log(`── 1. ${nom} — il supprime 6 annonces sur compte_a, l'extension prévient 6 fois`);
      await essaie('1 ' + nom, async () => {
        const etat = { lignes: lignesDe({ sansVentes }) };
        const r = await rendre(b, { etat, onglet });
        const p0 = r.journal.relais.length, l0 = r.journal.lectures111.length;
        const supprimees = [];
        for (let i = 0; i < 6; i++) {
          // la suppression i rangée, puis le signal (une seconde et demie entre deux suppressions)
          if (i < 3) { supprimees.push(7001 + i); etat.lignes = [...lignesDe({ sansVentes }), SUPP(supprimees)]; }
          await signaler(r.pg, '111');
          await r.pg.waitForTimeout(1500);
        }
        await r.pg.waitForTimeout(6000);
        const apres = r.journal.relais.slice(p0);
        dit(apres.length === 0, `${nom} : 6 signaux « maj · annonces » ⇒ AUCUN appel au relais serveur (Vinted lu depuis l'IP de Vercel)`,
          `${apres.length} appel(s) : ${apres.slice(0, 6).map((x) => x.uid + ' ' + x.endpoint).join(' · ')}`);
        const relues = r.journal.lectures111.length - l0;
        dit(relues <= 4, `${nom} : les signaux rapprochés sont regroupés (la moisson de compte_a n'est pas relue une fois par signal et par lecteur)`, `${relues} relecture(s) de harvest_111_listings pour 6 signaux`);
        if (onglet === 'cat_annonces') {
          const c = await cartes(r.pg);
          dit(!c.includes('7001') && !c.includes('7002') && !c.includes('7003') && c.includes('7004'),
            `${nom} : l'autre sens — les 3 suppressions signalées sont sorties de l'écran, la dernière comprise, sans rechargement`, JSON.stringify(c));
        }
        // Une suppression sur le compte JAMAIS moissonné (sa ligne `supprimees`
        // existe, son dressing non) : le signal porte son uid.
        const p1 = r.journal.relais.length;
        await signaler(r.pg, '333');
        await r.pg.waitForTimeout(7000);
        const neuf = r.journal.relais.slice(p1);
        dit(neuf.length === 0, `${nom} : un signal sur le compte sans moisson ne fait pas non plus partir le relais`, `${neuf.length} appel(s) : ${neuf.slice(0, 6).map((x) => x.uid + ' ' + x.endpoint).join(' · ')}`);
        dit(r.errs.length === 0, `${nom} : aucune erreur d'app`, r.errs.join(' | ').slice(0, 160));
        await r.ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ signal-annonces : ${ko} rouge(s)` : '\n✅ signal-annonces : tout est vert');
  process.exit(ko ? 1 : 0);
})();
