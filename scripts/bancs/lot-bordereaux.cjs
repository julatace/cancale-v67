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
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4341 + 7);   // 4348

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
    const securite=require('./_vercel.cjs');await securite.brancher(ctx,`http://localhost:${PORT}`);const violations=securite.observer(ctx);
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
    if(process.env.VRM_PDFJS_DIR) await pg.route('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/*',route=>{
      const name=route.request().url().split('/').pop();
      return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(process.env.VRM_PDFJS_DIR,name))});
    });
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
    await pg.waitForSelector('button[data-lot-ouvrir="1"]', { timeout: 20000 }).catch(() => {});
    await pg.waitForTimeout(1200);
    const ouvrir = await pg.$('button[data-lot-ouvrir="1"]');
    dit(!!ouvrir, 'le bouton « Tout imprimer » est là', errs.join(' | ').slice(0, 120));
    if (ouvrir) await ouvrir.click();
    await pg.waitForTimeout(500);
    // L'APERÇU : le plus récent en haut, l'ancienne décochée avec sa raison.
    const ap = await pg.evaluate(() => [...document.querySelectorAll('[data-lot-ligne]')].map((e) => ({ cle: e.getAttribute('data-lot-ligne'), coche: e.getAttribute('data-coche') === '1', ancienne: !!e.querySelector('[data-lot-ancienne]') })));
    dit(ap.length === 4, 'l’aperçu liste les 4 bordereaux prêts, aucun caché', JSON.stringify(ap.map((x) => x.cle)));
    // (3 nov., choix de Julien n° 2) L'aperçu suit l'ordre des GROUPES de l'écran (le plus pressé d'abord, par
    // transporteur) — avant, la date de vente (la plus récente en haut). Jugé contre les cartes rendues.
    const ecran = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card][data-tx-colis]')].map((e) => e.getAttribute('data-tx-colis')).filter((x, i, a) => a.indexOf(x) === i));
    // (11 nov., lot DJ3) « Tout imprimer » en trois temps : « Ce qui part » d'abord, « À vérifier » à part (décochés) — l'ordre
    // de chaque groupe reste celui de l'écran.
    const ordre = (L) => JSON.stringify(L.map((x) => x.cle)) === JSON.stringify(ecran.filter((c) => L.some((x) => x.cle === c)));
    dit(ap.length && ordre(ap.filter((x) => x.coche)) && ordre(ap.filter((x) => !x.coche)), 'l’aperçu suit l’ordre des colis de l’écran', JSON.stringify({ apercu: ap.map((x) => x.cle), ecran }));
    const v4 = ap.find((x) => x.cle === '9004');
    dit(v4 && !v4.coche && v4.ancienne, 'la vente d’il y a un mois est DÉCOCHÉE et dit pourquoi (pas d’impression silencieuse d’archives)', JSON.stringify(v4));
    dit(ap.filter((x) => x.coche).length === 3, 'les trois ventes récentes sont cochées', JSON.stringify(ap));
    const bouton = await pg.$('[data-lot] button[data-lot-imprimer]');   // (5 nov., chantier D) la feuille est un portail : le premier « data-imprime » de la page est une carte
    dit(!!bouton && (await bouton.getAttribute('data-lot-imprimer')) === '3', 'le bouton imprime EXACTEMENT les cochés (3)', bouton ? await bouton.getAttribute('data-lot-imprimer') : 'absent');
    if (bouton) {
      // (16 nov., portage sur « Imprimer en un toucher », docs/passation/2026-11-14-impression-simple.md) L'aperçu A4,
      // la feuille du tampon d'office et le message « N sur M imprimés » n'existent plus. La RÈGLE du 5 octobre reste
      // jugée sur ce qui la porte aujourd'hui : la feuille d'après (« Tout est sorti ? ») compte les bordereaux
      // RÉELLEMENT dans le PDF (`data-impr-n`, une vignette chacun) et NOMME chaque absent avec SA raison
      // (`absentsDuLot` : sans PDF · PDF illisible) ; seul ce qui est parti est noté imprimé ; les échecs restent
      // cochés dans « Choisir » pour être relancés.
      await bouton.click();
      // Papier jamais choisi : la question vient une fois (le toucher sur un papier imprime aussitôt).
      const papier = await pg.waitForSelector('[data-impr-papier-feuille="premiere"]', { timeout: 15000 }).then(() => true).catch(() => false);
      if (papier) await pg.click('[data-impr-papier-choix="normale"]');
      dit(!(await pg.getByRole('button',{name:'Préparer quand même les PDF',exact:true}).count()), 'aucune question « contrôlé » entre « Imprimer » et le PDF');
      // (4 nov.) Le type de ces bordereaux n'a pas de place gardée : la feuille du tampon s'ouvre UNE fois, « Imprimer ».
      // (16 nov., lot tampons-parametres) La sélection ouvre l'APERÇU AVANT IMPRESSION (une feuille, chaque bordereau en
      // vignette, le tampon réglable) ; son « Imprimer » lance le PDF.
      const feuille = await pg.waitForSelector('[data-impr-apercu="pret"] [data-impr-apercu-imprimer]:not([disabled])', { timeout: 60000 }).then(() => true).catch(() => false);
      const nFeuilles = await pg.evaluate(() => document.querySelectorAll('[data-impr-apercu]').length);
      dit(feuille && nFeuilles === 1, 'l’aperçu avant impression s’ouvre, une fois', String(nFeuilles));
      if (feuille) await pg.click('[data-impr-apercu-imprimer]');
      const vis = await pg.waitForSelector('[data-visionneuse-pdf="pret"]', { timeout: 30000 }).then(() => true).catch(() => false);
      dit(vis, 'le PDF des bordereaux lisibles s’ouvre (visionneuse de l’ordinateur)');
      if (vis) await pg.click('[data-visionneuse-fermer]');
      await pg.waitForSelector('[data-impr-feuille="question"]', { timeout: 15000 }).catch(() => {});
      const f = await pg.evaluate(() => { const r = document.querySelector('[data-impr-feuille]'); if (!r) return null;
        return { n: r.getAttribute('data-impr-n'), vign: [...r.querySelectorAll('[data-impr-vignette]')].map((e) => e.getAttribute('data-impr-vignette')),
          absents: [...r.querySelectorAll('[data-impr-absent]')].map((e) => ({ cle: e.getAttribute('data-impr-absent'), raison: e.getAttribute('data-impr-absent-raison'), txt: e.innerText.replace(/\s+/g, ' ') })),
          nAbsents: (r.querySelector('[data-impr-absents]') || { getAttribute: () => null }).getAttribute('data-impr-absents') }; });
      dit(f && f.n === '1' && f.vign.join(',') === '9001', 'la feuille compte le nombre RÉELLEMENT dans le PDF : 1 (le PDF abîmé est écarté par la fusion)', JSON.stringify(f && { n: f.n, vign: f.vign }));
      const ab = (cle) => (f && f.absents.find((a) => a.cle === cle)) || null;
      dit(ab('9003') && ab('9003').raison === 'sansPdf' && /Paire C/.test(ab('9003').txt), 'elle nomme le bordereau qui n’a plus son PDF (titre + raison)', JSON.stringify(ab('9003')));
      dit(ab('9002') && ab('9002').raison === 'illisible', 'et celui que la fusion a écarté (PDF illisible) — compté, jamais passé sous silence', JSON.stringify(ab('9002')));
      dit(f && f.nAbsents === '2' && f.absents.length === 2, 'les deux absents, exactement (ni la vente d’il y a un mois, restée décochée)', JSON.stringify(f && f.absents.map((a) => a.cle)));
      await pg.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('vinted_bords_printed') || '{}')).length >= 1, null, { timeout: 10000 }).catch(() => {});
      const imprimes = await pg.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('vinted_bords_printed') || '{}')).sort());
      dit(JSON.stringify(imprimes) === '["9001"]', 'seul le bordereau PARTI est noté imprimé', JSON.stringify(imprimes));
      if (await pg.$('[data-impr-oui]')) await pg.click('[data-impr-oui]');
      await pg.waitForFunction(() => !document.querySelector('[data-impr-feuille]'), null, { timeout: 8000 }).catch(() => {});
      await pg.click('button[data-lot-ouvrir="1"]').catch(() => {});
      await pg.waitForSelector('[data-lot-etape="choix"]', { timeout: 15000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 600));
      const reprise = await pg.evaluate(() => { const b = document.querySelector('[data-lot] button[data-lot-imprimer]'); return b ? b.getAttribute('data-lot-imprimer') : null; });
      const cochesRestantes = await pg.locator('[data-lot-ligne][data-coche="1"]').evaluateAll(nodes => nodes.map(n=>n.getAttribute('data-lot-ligne')).sort());
      dit(JSON.stringify(cochesRestantes) === JSON.stringify(['9002','9003']) && reprise === '2', 'le PDF réussi est décoché ; les deux échecs restent visibles et sélectionnés, prêts à relancer (2)', JSON.stringify({ cochesRestantes, reprise }));
    }
    dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
    dit(violations.filter(v=>!v.texte.startsWith('[Report-Only]')).length===0,'le parcours PDF respecte la politique de sécurité de production',violations.map(v=>v.texte).join(' | ').slice(0,250));
    await ctx.close();
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 160)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\nKO lot-bordereaux : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK lot-bordereaux : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
