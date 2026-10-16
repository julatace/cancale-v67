// Banc : AU RÉEL, LES EXPORTS NE CHIFFRENT AUCUNE COTISATION (16 octobre).
//        node scripts/bancs/fiscal-rapports.cjs        (port 5983, rendu de dist/)
//
// Reproduit par la relecture du lot fiscal : pour une société au réel, l'ÉCRAN
// du rapport comptable et du bilan annuel disait « Cotisations — · au réel :
// pas un % du CA »… et les QUATRE exports (CSV + PDF, mensuel + annuel)
// écrivaient encore « Estimation cotisations (13,5%) » avec un montant — le
// document qui part chez le comptable portait un chiffre que l'écran refuse
// d'afficher. Ce banc rend Ventes → Outils sur des ventes INVENTÉES (aucune
// donnée réelle), télécharge les quatre exports et JUGE leur contenu, dans les
// deux sens : au réel rien n'est estimé ; en micro l'estimation reste (tout
// retirer partout passerait sinon). Les textes des PDF sont lus en décompressant
// les flux (§6 : on juge ce qui est RENDU, pas le code).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), zlib = require('zlib');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.PORT_BANC || 5983);

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le banc a levé : ' + String(e && e.message || e).slice(0, 220)); } };

const auj = new Date();
const jour = (d) => new Date(auj.getFullYear(), auj.getMonth(), d, 12).toISOString();
const J = Math.min(auj.getDate(), 28);
const vente = (id, titre, prix, statut, d) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: jour(d) });
const VENTES = [
  vente(9001, 'Nike Air Max 1 olive taille 42', 80, 'Commande finalisée', Math.max(1, J - 3)),
  vente(9002, 'Salomon XT-6 blanc taille 40', 99.5, 'Commande finalisée', Math.max(1, J - 2)),
  vente(9003, 'Adidas Spezial noir taille 38', 45, 'Commande finalisée', Math.max(1, J - 1)),
  vente(9004, 'Asics Gel-Kayano taille 41', 60, 'Paiement validé', J),        // en cours : hors CA
];
const VERS = { 9001: jour(Math.max(1, J - 1)), 9002: jour(J) };
const ACHATS = [{ transaction_id: 7001, title: 'Lot Nike Air Max', price: { amount: '35', currency_code: 'EUR' }, status: 'Commande finalisée', date: jour(1), seller: 'vendeur_test' }];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const PROFIL_SOC = { v: 1, forme: 'societe', tva: 'assujetti', marge: false, vl: null, siren: '123456782', nom: 'Exemple SAS', adresse: '1 rue', cp: '35260', ville: 'Cancale', tvaIntra: 'FR11123456782', formeJuridique: 'SAS', capital: '1000', rcs: 'Saint-Malo' };
const PROFIL_MICRO = { v: 1, forme: 'micro', tva: 'franchise', marge: null, vl: false, siren: '123456782', nom: 'Julie Exemple', adresse: '1 rue', cp: '35260', ville: 'Cancale' };
const lignes = (main) => [
  { id: 'main', data: main },
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: VENTES } } },
  ...Object.entries(VERS).map(([tx, d]) => ({ id: 'harvest_111_txn_' + tx, data: { capturedAt: auj.toISOString(), payload: { transaction: { id: Number(tx), status: 450, status_updated_at: d } } } })),
  { id: 'harvest_111_txn_9003', data: { capturedAt: auj.toISOString(), payload: { transaction: { id: 9003, status: 450, status_updated_at: jour(Math.max(1, J - 1)) } } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: ACHATS } } },
];

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

// pdf-lib écrit son texte dans des flux compressés, en hexadécimal ou en
// chaînes : on les décompresse et on lit les deux formes (leçon de §6.3).
const txtPdf = (buf) => {
  const s = buf.toString('latin1'); let out = '';
  const re = /stream\r?\n([\s\S]*?)endstream/g; let m;
  while ((m = re.exec(s))) {
    let c = Buffer.from(m[1], 'latin1'); try { c = zlib.inflateSync(c); } catch (_) {}
    const t = c.toString('latin1');
    for (const x of t.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out += Buffer.from(x[1], 'hex').toString('latin1') + '\n';
    for (const x of t.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g)) out += x[1] + '\n';
  }
  return out;
};

const brancher = async (pg, rows) => {
  await pg.route('**/rest/v1/**', async (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) }).catch(() => {});
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z]+:data->[a-z]+$/i.test(sel)) { const [al, src] = sel.split(':'); return { [al]: (r.data || {})[src.split('->')[1]] }; }
      if (/^[a-z]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) { const m = /^([a-z]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; }
        return o;
      }
      return { ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
};

const ouvrirVentes = async (b, vp, main) => {
  const ctx = await b.newContext({ viewport: vp, acceptDownloads: true, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((m) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const [k, v] of Object.entries(m)) localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }, main);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await brancher(pg, lignes(main));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  return { ctx, pg, errs };
};
const ouvrirRapport = async (pg) => {
  await pg.getByText('Outils', { exact: false }).first().click({ timeout: 6000 });
  await pg.getByText('Rapport comptable', { exact: true }).first().click({ timeout: 6000 });
  await pg.waitForTimeout(1800);
};
const ouvrirAnnuel = async (pg) => {
  await pg.evaluate(() => { const x = [...document.querySelectorAll('button[aria-label="Fermer"]')].pop(); if (x) x.click(); });
  await pg.waitForTimeout(500);
  await pg.getByText('Outils', { exact: false }).first().click({ timeout: 6000 });
  await pg.getByText('Registre annuel', { exact: true }).first().click({ timeout: 6000 });
  await pg.waitForTimeout(1800);
};
const telecharger = async (pg, clic, t = 10000) => {
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: t }), clic()]);
  return fs.readFileSync(await dl.path());
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const MAIN_REEL = { vinted_regime: 'reel', vinted_tva: 20, vrm_profil_entreprise: PROFIL_SOC };
  const MAIN_MICRO = { vinted_regime: 'micro', vrm_profil_entreprise: PROFIL_MICRO };

  // ── A. Société au réel, 1512 px : écran + les QUATRE exports ─────────────
  console.log('── A. Au réel (1512 px) : l\'écran dit « — », et les exports disent la MÊME chose');
  await essaie('A', async () => {
    const o = await ouvrirVentes(b, { width: 1512, height: 950 }, MAIN_REEL);
    const { pg } = o;
    await ouvrirRapport(pg);
    const ecran = await pg.evaluate(() => document.body.innerText);
    dit(/au réel : pas un % du CA/.test(ecran) && !/Estimation cotisations/i.test(ecran), 'écran du rapport : « Cotisations — · au réel : pas un % du CA », rien d\'estimé');
    const csv = (await telecharger(pg, () => pg.getByText('⬇️ CSV', { exact: true }).first().click())).toString('utf8');
    dit(!/Estimation cotisations/i.test(csv), 'CSV du rapport : AUCUNE « Estimation cotisations » (il part chez le comptable)', (csv.split('\n').find((l) => /cotisation/i.test(l)) || 'aucune ligne cotisations'));
    dit(/Cotisations.;.au reel : pas un % du CA/i.test(csv), 'et il DIT pourquoi (« au reel : pas un % du CA - non estimees »)');
    const pdf = txtPdf(await telecharger(pg, () => pg.getByText('📄 PDF').first().click(), 15000));
    dit(!/Estimation cotisations/i.test(pdf) && /au reel : pas un % du CA/i.test(pdf), 'PDF du rapport : même règle que l\'écran', (pdf.match(/[^\n]*[Cc]otisations[^\n]*/) || [''])[0]);
    await ouvrirAnnuel(pg);
    const ecran2 = await pg.evaluate(() => document.body.innerText);
    dit(/au réel : pas un % du CA/.test(ecran2) && !/Estimation cotisations/i.test(ecran2), 'écran du bilan annuel : « Cotisations — », rien d\'estimé');
    const csv2 = (await telecharger(pg, () => pg.getByText('⬇️ CSV (registre détaillé)').first().click())).toString('utf8');
    dit(!/Estimation cotisations/i.test(csv2) && /Cotisations.;.au reel : pas un % du CA/i.test(csv2), 'CSV annuel : aucune estimation, la raison écrite', (csv2.split('\n').find((l) => /cotisation/i.test(l)) || ''));
    const pdf2 = txtPdf(await telecharger(pg, () => pg.getByText('📄 PDF').last().click(), 15000));
    dit(!/Estimation cotisations/i.test(pdf2) && /au reel : pas un % du CA/i.test(pdf2), 'PDF annuel : aucune estimation, la raison écrite', (pdf2.match(/[^\n]*[Cc]otisations[^\n]*/) || [''])[0]);
    dit(o.errs.length === 0, 'aucune erreur d\'app', o.errs.slice(0, 2).join(' | '));
    await o.ctx.close();
  });

  // ── B. Société au réel, 390 px : l'écran (les exports sont les mêmes) ────
  console.log('\n── B. Au réel (390 px) : l\'écran du rapport');
  await essaie('B', async () => {
    const o = await ouvrirVentes(b, { width: 390, height: 844 }, MAIN_REEL);
    await ouvrirRapport(o.pg);
    const ecran = await o.pg.evaluate(() => document.body.innerText);
    dit(/au réel : pas un % du CA/.test(ecran) && !/Estimation cotisations/i.test(ecran), 'à 390 px aussi : « Cotisations — », rien d\'estimé');
    await o.ctx.close();
  });

  // ── C. L'AUTRE SENS : en micro, l'estimation RESTE ───────────────────────
  // Sans ce contrôle, retirer la ligne de cotisations pour tout le monde
  // passerait le banc — « tout retirer partout » n'est pas la correction.
  console.log('\n── C. Micro (1512 px) : l\'estimation reste dans le CSV et le PDF');
  await essaie('C', async () => {
    const o = await ouvrirVentes(b, { width: 1512, height: 950 }, MAIN_MICRO);
    const { pg } = o;
    await ouvrirRapport(pg);
    const csv = (await telecharger(pg, () => pg.getByText('⬇️ CSV', { exact: true }).first().click())).toString('utf8');
    dit(/Estimation cotisations \(13,5%\)/.test(csv), 'CSV du rapport en micro : « Estimation cotisations (13,5%) » toujours là', (csv.split('\n').find((l) => /cotisation/i.test(l)) || ''));
    const pdf = txtPdf(await telecharger(pg, () => pg.getByText('📄 PDF').first().click(), 15000));
    dit(/Estimation cotisations/.test(pdf), 'PDF du rapport en micro : l\'estimation reste');
    await o.ctx.close();
  });

  await b.close(); srv.close();
  console.log(ko ? `\n${ko} contrôle(s) non conforme(s).` : '\nExports du rapport et du bilan : le régime est respecté.');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('KO  le banc est tombé :', e && e.message); process.exit(1); });
