// Banc : le registre annuel ne fait pas disparaître en silence le reçu d'un
// compte dont la lecture a échoué (revue contradictoire du 5 octobre).
//
// Deux comptes INVENTÉS (le banc vit dans le dépôt, qui est public) :
//   · 111 — son reçu officiel Vinted est capté : il est listé ;
//   · 222 — la base ne répond pas sur son reçu (522 + HTML, la vraie forme).
// Avant : dès qu'un compte avait un reçu, la liste s'affichait seule et la
// mention « la base n'a pas répondu » n'apparaissait que si AUCUN reçu n'était
// lu — le reçu du second compte manquait sans un mot (§5 : un total partiel ne
// se présente pas comme complet). Le banc juge l'attribut `data-recus-pas-lus`.
// Lancer : npm run build && node scripts/bancs/recus.cjs
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4349;

const auj = new Date();
const vente = (id, titre) => ({ transaction_id: id, title: titre, price: { amount: '50', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: new Date(auj.getTime() - 86400000).toISOString() });
const VENTES = [vente(9001, 'Paire A taille 42')];
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() },
  { id: 2, vinted_user_id: '222', login: 'compte_deux', domain: 'www.vinted.fr', updated_at: auj.toISOString() },
];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const rows = [
  { id: 'harvest_111_receipt_latest', data: { uid: '111', capturedAt: auj.toISOString(), pdfB64: PDF_B64 } },
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
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
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
      // Le reçu du compte 222 : la base ne répond pas (la vraie forme d'une panne).
      if (/harvest_222_receipt_latest/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
      const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
      const forme = (r) => (sel && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
      const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z]+)=(not\.)?is\.null/g)].map((m) => ({ k: m[1], non: !!m[2] }));
      const passe = (r) => filtres.every((f) => (f.non ? r.data[f.k] != null : r.data[f.k] == null));
      const eq = /id=eq\.([^&]*)/.exec(u);
      if (eq) return j(rows.filter((r) => r.id === eq[1] && passe(r)).map(forme));
      const lk = /id=like\.([^&]*)/.exec(u);
      if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
      return j([]);
    });
    await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
    await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(2500);
    try {
      await pg.getByText('Outils', { exact: false }).first().click({ timeout: 8000 });
      await pg.getByText('Registre annuel', { exact: true }).first().click({ timeout: 8000 });
    } catch (e) { dit(false, 'le registre annuel s’ouvre depuis Outils', String(e.message || e).slice(0, 120)); }
    await pg.waitForFunction(() => /Reçus officiels Vinted/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(1500);
    const lu = await pg.evaluate(() => {
      const t = document.body.innerText;
      const bloc = t.slice(t.indexOf('Reçus officiels Vinted'), t.indexOf('Reçus officiels Vinted') + 600);
      const e = document.querySelector('[data-recus-pas-lus]');
      return { bloc, pasLus: e ? e.getAttribute('data-recus-pas-lus') : null, telecharger: (bloc.match(/Télécharger/g) || []).length };
    });
    dit(lu.telecharger === 1, 'le reçu du compte lu est listé', `${lu.telecharger} bouton(s) « Télécharger »`);
    dit(lu.pasLus === '1', 'et le compte dont la lecture a échoué est DIT, sous la liste — pas avalé en silence', `data-recus-pas-lus=${lu.pasLus} · « ${lu.bloc.replace(/\s+/g, ' ').slice(0, 160)} »`);
    dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
    await ctx.close();
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 160)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\nKO recus : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK recus : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
