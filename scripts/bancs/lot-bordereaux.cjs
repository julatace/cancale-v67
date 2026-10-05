// Banc : « Tout imprimer » ne présente JAMAIS un lot partiel comme complet
// (revue contradictoire du 5 octobre).
//
// Un lot de trois bordereaux à imprimer, sur des ventes INVENTÉES (aucune
// donnée réelle : le banc vit dans le dépôt, qui est public) :
//   · 9001 — un vrai PDF : il part ;
//   · 9002 — des octets qui COMMENCENT par %PDF (le lecteur les accepte) mais
//     que pdf-lib refuse (PDF abîmé) : la fusion l'écarte ;
//   · 9003 — la ligne n'a plus son PDF.
// Avant : le message annonçait « 2 sur 3 imprimés — 1 sans PDF » alors qu'un
// seul était parti, et le PDF écarté par la fusion n'était nommé nulle part.
// Le banc juge les NOMBRES du message (§6.5) — le libellé reste libre.
// Lancer : npm run build && node scripts/bancs/lot-bordereaux.cjs
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
const VENTES = [vente(9001, 'Paire A taille 42'), vente(9002, 'Paire B taille 40'), vente(9003, 'Paire C taille 38')];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const ABIME_B64 = Buffer.from('%PDF-1.4\n' + 'ceci n’est pas un PDF lisible '.repeat(20)).toString('base64');
const bord = (tx, titre, pdf) => ({ id: 'email_bord_' + tx, data: { transaction: String(tx), uid: '111', filename: 'bordereau-' + tx + '.pdf', modele: titre, article: titre, receivedAt: auj.toISOString(), pdfB64: pdf } });
const rows = [
  bord(9001, 'Paire A taille 42', PDF_B64),
  bord(9002, 'Paire B taille 40', ABIME_B64),
  bord(9003, 'Paire C taille 38', null),
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
    ctx.on('page', (p) => p.close().catch(() => {}));      // l'onglet d'impression réservé au clic
    await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('button[data-imprime="1"]', { timeout: 20000 }).catch(() => {});
    await pg.waitForTimeout(1200);
    const bouton = await pg.$('button[data-imprime="1"]');
    dit(!!bouton, 'le bouton « Tout imprimer » est là', errs.join(' | ').slice(0, 120));
    if (bouton) {
      await bouton.click();
      // Le message du lot : celui qui dit « N sur M ».
      const msg = await pg.waitForFunction(() => {
        const t = document.body.innerText; const m = /(\d+) sur (\d+) imprimé[^\n]*/.exec(t); return m ? m[0] : null;
      }, null, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => null);
      dit(!!msg, 'un lot imprimé en partie le DIT', msg || '(aucun message « N sur M »)');
      const m = /(\d+) sur (\d+)/.exec(msg || '');
      dit(m && m[1] === '1' && m[2] === '3', 'il annonce le nombre RÉELLEMENT imprimé : 1 sur 3 (le PDF abîmé est écarté par la fusion)', msg || '');
      dit(/1 sans PDF/.test(msg || ''), 'il nomme le bordereau qui n’a plus son PDF', msg || '');
      const illisible = (msg || '').replace(/1 sur 3 imprimé[s]? — /, '').replace(/1 sans PDF/, '');
      dit(/\b1\b/.test(illisible), 'et celui que la fusion a écarté — compté, jamais passé sous silence', msg || '');
    }
    dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
    await ctx.close();
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 160)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\nKO lot-bordereaux : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK lot-bordereaux : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
