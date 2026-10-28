// Navigation des paramètres : recherche et aller-retour à 390 et 1512 px.
// Données synthétiques, aucune connexion ou mutation réelle.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4341 + 7;   // 4348

const auj = new Date();
const vente = (id, titre) => ({ transaction_id: id, title: titre, price: { amount: '50', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: new Date(auj.getTime() - 86400000).toISOString() });
// (16 oct.) 9004 : une vente d'il y a UN MOIS que Vinted dit encore « à
// expédier » (le compte n'a pas été relu) — la plainte de Julien : « Tout
// imprimer m'a donné des bordereaux d'il y a un mois ». Elle doit être dans
// l'aperçu, DÉCOCHÉE avec la raison, et ne pas partir à l'impression.
const VENTES = [vente(9001, 'Paire A taille 42'), vente(9002, 'Paire B taille 40'), vente(9003, 'Paire C taille 38'),
  { ...vente(9004, 'Paire ancienne taille 41'), date: new Date(auj.getTime() - 31 * 86400000).toISOString() }];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const ABIME_B64 = Buffer.from('%PDF-1.4\n' + 'ceci n’est pas un PDF lisible '.repeat(20)).toString('base64');
const bord = (tx, titre, pdf) => ({ id: 'email_bord_' + tx, data: { transaction: String(tx), uid: '111', filename: 'bordereau-' + tx + '.pdf', modele: titre, article: titre, receivedAt: auj.toISOString(), pdfB64: pdf } });
const rows = [
  bord(9001, 'Paire A taille 42', PDF_B64),
  bord(9002, 'Paire B taille 40', ABIME_B64),
  bord(9003, 'Paire C taille 38', null),
  bord(9004, 'Paire ancienne taille 41', PDF_B64),
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: VENTES } } },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
// Projection PostgREST (§6.3) : une requête projetée reçoit la projection.
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

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const ctx = await b.newContext({ viewport: { width: 1512, height: 950 }, acceptDownloads: true });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
    await pg.route('**/rest/v1/**', (route) => {
      const u = decodeURIComponent(metaVersData(route.request().url()));
      const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
      if (route.request().method() !== 'GET') return j([]);
      if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
      if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
      const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
      const forme = (r) => (sel && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
      // Filtres PostgREST `data->>x=not.is.null` / `is.null` (une ligne sans PDF n'est pas « prête »).
      const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z]+)=(not\.)?is\.null/g)].map((m) => ({ k: m[1], non: !!m[2] }));
      const passe = (r) => filtres.every((f) => (f.non ? r.data[f.k] != null : r.data[f.k] == null));
      const eq = /id=eq\.([^&]*)/.exec(u);
      if (eq) return j(rows.filter((r) => r.id === eq[1] && passe(r)).map(forme));
      const lk = /id=like\.([^&]*)/.exec(u);
      if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
      return j([]);
    });
    await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
    for (const largeur of [390, 1512]) {
      await pg.setViewportSize({width:largeur,height:950});
      await pg.goto(`http://localhost:${PORT}/?tab=settings`, {waitUntil:'domcontentloaded'});
      await pg.waitForSelector('[data-sous-ouvrir="numeros"]',{timeout:20000});
      dit(await pg.locator('[data-sous-ouvrir="numeros"]').isVisible(), `${largeur} : liste compacte des réglages`);
      dit(!(await pg.locator('[data-numeros-reglage]').isVisible()), `${largeur} : les détails ne sont pas dépliés dans la liste`);
      await pg.locator('[aria-label="Rechercher dans les paramètres"]').fill('numero');
      dit(await pg.locator('[data-sous-ouvrir="numeros"]').isVisible() && !(await pg.locator('[data-sous-ouvrir="imprimante"]').count()), `${largeur} : recherche sans accent`);
      await pg.locator('[data-sous-ouvrir="numeros"]').click();
      dit(await pg.locator('[data-numeros-reglage]').isVisible(), `${largeur} : ouverture du réglage`);
      dit(await pg.locator('[data-sous-retour]').isVisible(), `${largeur} : retour explicite`);
      await pg.locator('[data-sous-retour]').click();
      dit(await pg.locator('[data-sous-ouvrir="numeros"]').isVisible(), `${largeur} : retour à la recherche conservée`);
      await pg.locator('[aria-label="Rechercher dans les paramètres"]').fill('');
      await pg.screenshot({path:`/tmp/vrm-parametres-liste-${largeur}.png`,fullPage:true});
      await pg.locator('[data-sous-ouvrir="imprimante"]').click();
      dit(await pg.locator('[data-imprimante-reglage]').isVisible(), `${largeur} : impression accessible sans défilement dans les emails`);
      dit(await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1), `${largeur} : aucun débordement horizontal`);
      await pg.screenshot({path:`/tmp/vrm-parametres-${largeur}.png`,fullPage:true});
      await pg.evaluate(()=>window.dispatchEvent(new Event('vrm:ouvrir-adresses')));
      await pg.waitForSelector('[data-reglage-adresses]',{state:'visible'});
      dit(await pg.locator('[data-reglages-disposition]').getAttribute('data-sous-ecran-ouvert')==='adresses', `${largeur} : un raccourci ouvre les adresses au lieu de défiler vers un panneau caché`);
    }
    dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
    await ctx.close();
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 160)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\nKO paramètres : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK paramètres : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
