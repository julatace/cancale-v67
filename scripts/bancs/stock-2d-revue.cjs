// Banc : REVUE DU STOCK EN 2D (5 novembre, relecture en adversaire de v31-stock-2d)
//
// Trois défauts reproduits sur le rendu, sur des données INVENTÉES (dépôt public) :
//   A  « Remettre » une paire sortie toute seule dont la case est PRISE : elle
//      doit attendre dans « À ranger » (avant : elle disparaissait de l'écran —
//      plus de case, plus dans « À ranger », plus dans le journal) ;
//   B  « Voir l'état » d'une paire dont l'achat a été relié DEPUIS LA VENTE
//      (`vinted_sale_overrides`) : « achat relié » et la durée achat → vente
//      (avant : « saisi à la main » et « achat pas relié à cette paire » — faux) ;
//   C  Annonces → « Voir au stock » / « Ranger au stock » : une paire posée dans
//      une case est dite rangée, et le geste ARRIVE dans les étagères (recherche
//      du N°, ou la paire prise en main : il ne reste qu'à toucher la case) —
//      avant : « pas encore rangée » (l'ancienne grille) et un Stock sans demande ;
//   D  aucune erreur de page, aucun défilement horizontal.
// 390 tactile et 1512 souris, clair et sombre.
// Lancer : BANC_PORT=79xx node scripts/bancs/stock-2d-revue.cjs   (SHOT=prefixe pour les captures)
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7951;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const AUJ = Date.now();
const ts = (iso) => Math.floor(Date.parse(iso) / 1000);

const MAIN = {
  vinted_annonce_numeros: {
    '1001': { numero: '1', title: 'Paire inventée une 42' },
    '1002': { numero: '2', title: 'Paire inventée deux 40' },
    '1003': { numero: '3', title: 'Paire inventée trois 43' },
    '1006': { numero: '6', title: 'Paire inventée six 44' },
    // N°7 : vendue ; son achat a été relié DEPUIS LA VENTE (la fiche n'en sait rien).
    '1007': { numero: '7', title: 'Paire inventée sept 41' },
  },
  vinted_sale_overrides: { '8801': { numero: '7', buyPrice: '30', buyFromId: '77700011', buyFrom: { title: 'Paire achetée', date: '2026-10-01T09:00:00Z', price: 30 } } },
  vrm_meubles: [{ id: 'mA', name: 'Étagère banc', cols: 3, rows: 2, planches: [1] }],
  // N°1 rangée 1 col 1 · N°7 rangée 1 col 2 · N°2 rangée 2 col 3 (la case de N°6 avant sa sortie).
  vrm_slots: { '1': { m: 'mA', i: 0 }, '7': { m: 'mA', i: 1 }, '2': { m: 'mA', i: 5 } },
  vrm_stock_vendus: { nums: ['6', '7'], at: AUJ },
  // N°6 vendue et PARTIE (absente des présents).
  // (N°7 vendue, colis finalisé : absente aussi — sur Annonces, la sortie automatique libère sa case.)
  vinted_nums_physiques: { nums: ['1', '2', '3'], at: AUJ },
  vrm_stock_sortis: { '6': { cle: '6', num: '6', titre: 'Paire inventée six 44', statut: 'Colis en cours d’acheminement', plateforme: 'Vinted', source: 'meubles', meubleId: 'mA', i: 5, itemName: 'Étagère banc', nom: 'rangée 2, colonne 3', at: AUJ - 3600000 } },
};
const ann = (id, title, cree) => ({ id, title, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, photo: null, brand_title: 'Marque', size_title: '42', status: 'Très bon état', created_at_ts: ts(cree) });
const ROWS = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: new Date(AUJ - 3600000).toISOString(), nItems: 3, payload: { items: [ann(1001, 'Paire inventée une 42', '2026-10-10T10:00:00Z'), ann(1002, 'Paire inventée deux 40', '2026-10-11T10:00:00Z'), ann(1003, 'Paire inventée trois 43', '2026-10-12T10:00:00Z')] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(AUJ - 3600000).toISOString(), payload: { my_orders: [{ transaction_id: 8801, title: 'Paire inventée sept 41', price: { amount: '70.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: '2026-10-20T10:00:00Z' }] } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
// La VRAIE forme : projection `select=` (alias:data->x->>y), sinon la ligne entière.
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

async function rendre(b, { tel, sombre, tab }) {
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data$|^data$/.test(sel) ? projette(r, sel) : { ...r, updated_at: new Date(AUJ).toISOString() });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.addInitScript(({ m, sombre }) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const k in m) localStorage.setItem(k, JSON.stringify(m[k])); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vinted_garage_view', JSON.stringify('meubles')); } catch (_) {} }, { m: MAIN, sombre });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
}
const shot = async (pg, nom) => { if (process.env.SHOT) await pg.screenshot({ path: `${process.env.SHOT}-${nom}.png`, fullPage: false }); };
const caseIci = (pg, ici) => pg.evaluate((ici) => { const el = document.querySelector(`[data-case-ici="${ici}"]`); return el ? (el.getAttribute('data-case-num') || '') : null; }, ici);
const toucher = async (pg, tel, sel) => { if (tel) await pg.tap(sel); else await pg.click(sel); };

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).split('\n')[0].slice(0, 300)); } };
  try {
    b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const tel of [false, true]) for (const sombre of [false, true]) {
      const t = `${tel ? '390 tactile' : '1512 souris'} ${sombre ? 'sombre' : 'clair'}`;
      // ── A et B : sur le Stock ───────────────────────────────────────────────
      await essaie(t + ' Stock', async () => {
        const { ctx, pg, errs } = await rendre(b, { tel, sombre, tab: 'garage' });
        await pg.waitForSelector('[data-meuble="mA"]', { timeout: 25000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        const theme = await pg.evaluate(() => document.documentElement.getAttribute('data-theme') || '');
        dit(theme === (sombre ? 'dark' : 'light'), `${t} : le thème demandé est rendu`, theme);
        // B — « Voir l'état » de N°7 (achat relié depuis la vente).
        await pg.evaluate(() => window.scrollTo(0, 0));
        await toucher(pg, tel, '[data-case-num="7"]');
        await pg.waitForTimeout(400);
        const ve = await pg.$('[data-fiche-voir-etat]');
        dit(!!ve, `${t} : B — la fiche de la case N°7 propose « Voir l'état »`);
        if (ve) {
          await ve.click();
          await pg.waitForSelector('[data-fiche-etat-article]', { timeout: 15000 }).catch(() => {});
          await pg.waitForFunction(() => { const el = document.querySelector('[data-etat-ligne="achat-vente"] b'); return el && el.textContent !== '…'; }, null, { timeout: 15000 }).catch(() => {});
          await pg.waitForTimeout(600);
          const et = await pg.evaluate(() => { const o = {}; document.querySelectorAll('[data-etat-ligne]').forEach((el) => { o[el.getAttribute('data-etat-ligne')] = { val: el.getAttribute('data-etat-val'), src: el.getAttribute('data-etat-source') || '', txt: el.innerText.replace(/\s+/g, ' ') }; }); return o; });
          const pa = et['prix-achat'] || {}, avt = et['achat-vente'] || {};
          dit(pa.val === '3000' && pa.src === 'relie' && /achat relié/.test(pa.txt) && !/saisi/.test(pa.txt), `${t} : B — prix d'achat 30 €, « achat relié » (relié depuis la vente), jamais « saisi à la main »`, JSON.stringify(pa));
          dit(avt.val === '19' && !/pas relié/.test(avt.txt), `${t} : B — achat (1 oct.) → vente (20 oct.) : 19 j`, JSON.stringify(avt));
          await shot(pg, (tel ? '390' : '1512') + (sombre ? '-sombre' : '-clair') + '-etat');
          await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
        }
        if (await pg.$('[data-stock-modale]')) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); }
        if (await pg.$('[data-stock-modale]')) await pg.click('[data-stock-modale] button[aria-label="Fermer"]').catch(() => {});
        await pg.evaluate(() => window.scrollTo(0, 0));
        // A — Remettre N°6 : sa case (rangée 2, colonne 3) est prise par N°2.
        const av = await pg.evaluate(() => !!document.querySelector('[data-a-ranger="6"]'));
        dit(!av, `${t} : A — N°6 (vendue et partie, sans case) n'est pas « à ranger » avant « Remettre »`, String(av));
        const btn = await pg.$('[data-stock-remettre-meuble="6"]');
        dit(!!btn, `${t} : A — la case libérée toute seule de N°6 est dite, avec « Remettre »`);
        if (btn) {
          await toucher(pg, tel, '[data-stock-remettre-meuble="6"]');
          await pg.waitForTimeout(600);
          const apres = await pg.evaluate(() => { const el = document.querySelector('[data-a-ranger="6"]'); return { la: !!el, prise: el ? el.getAttribute('aria-pressed') : null }; });
          dit(await caseIci(pg, 'mA:5') === '2', `${t} : A — N°2 garde sa case (rien n'est posé par-dessus)`, await caseIci(pg, 'mA:5'));
          dit(apres.la, `${t} : A — N°6 remise attend dans « À ranger » (jamais disparue de l'écran)`, JSON.stringify(apres));
          if (apres.la) {
            await toucher(pg, tel, '[data-case-ici="mA:2"]');
            await pg.waitForTimeout(600);
            dit(await caseIci(pg, 'mA:2') === '6', `${t} : A — puis toucher une case libre l'y range`, await caseIci(pg, 'mA:2'));
          }
        }
        await shot(pg, (tel ? '390' : '1512') + (sombre ? '-sombre' : '-clair') + '-stock');
        const large = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(large <= 1, `${t} : D — pas de défilement horizontal de la page (Stock)`, String(large));
        dit(errs.length === 0, `${t} : D — aucune erreur de page (Stock)`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      });
      // ── C : depuis Annonces ─────────────────────────────────────────────────
      for (const [num, attendu] of [['1', 'range'], ['3', 'a-ranger']]) {
        await essaie(`${t} Annonces N°${num}`, async () => {
          const { ctx, pg, errs } = await rendre(b, { tel, sombre, tab: 'cat_annonces' });
          await pg.waitForSelector(`[data-carte-annonce="100${num}"]`, { timeout: 25000 }).catch(() => {});
          await pg.waitForTimeout(2500);
          // Déplier « Plus d'actions » de CETTE carte si besoin.
          await pg.evaluate((id) => { const c = document.querySelector(`[data-carte-annonce="${id}"]`); const bt = c && c.querySelector('[data-fiche-plus-bouton][aria-expanded="false"]'); if (bt) bt.click(); }, '100' + num);
          await pg.waitForTimeout(400);
          const etat = await pg.evaluate((id) => { const c = document.querySelector(`[data-carte-annonce="${id}"]`); const g = c && c.querySelector('[data-fiche-stock]'); return g ? g.getAttribute('data-fiche-stock') : null; }, '100' + num);
          dit(etat === attendu, `${t} : C — Annonces dit N°${num} ${attendu === 'range' ? '« rangée » (posée dans une case)' : '« à ranger »'}`, String(etat));
          if (etat) {
            await pg.evaluate((id) => { document.querySelector(`[data-carte-annonce="${id}"] [data-fiche-stock]`).click(); }, '100' + num);
            await pg.waitForSelector('[data-meuble="mA"]', { timeout: 15000 }).catch(() => {});
            await pg.waitForTimeout(900);
            if (attendu === 'range') {
              // (6 nov., vague 3) La N°1 a sa case : « Voir au stock » la SÉLECTIONNE (et `CibleNotif` la
              // défile et l'éclaire) au lieu d'ouvrir la recherche — la règle jugée reste « N°1 visée ».
              const q = await pg.evaluate(() => { const i = document.querySelector('[data-stock-recherche] input'); return i ? i.value : null; });
              const res = await pg.evaluate(() => !!document.querySelector('[data-stock-res="1"]'));
              const vise = await pg.evaluate(() => !!document.querySelector('[data-case-num="1"][data-case-vise]'));
              dit((q === '1' && res) || vise, `${t} : C — « Voir au stock » arrive sur les étagères avec N°1 visée`, `${q} ${res} ${vise}`);
            } else {
              const pris = await pg.evaluate(() => { const el = document.querySelector('[data-a-ranger="3"]'); return el ? el.getAttribute('aria-pressed') : null; });
              dit(pris === 'true', `${t} : C — « Ranger au stock » arrive avec N°3 prise en main`, String(pris));
              await toucher(pg, tel, '[data-case-ici="mA:3"]');
              await pg.waitForTimeout(600);
              dit(await caseIci(pg, 'mA:3') === '3', `${t} : C — toucher une case range N°3`, await caseIci(pg, 'mA:3'));
              await shot(pg, (tel ? '390' : '1512') + (sombre ? '-sombre' : '-clair') + '-ranger');
            }
          }
          const large = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          dit(large <= 1, `${t} : D — pas de défilement horizontal de la page (Annonces → Stock)`, String(large));
          dit(errs.length === 0, `${t} : D — aucune erreur de page (Annonces → Stock)`, errs.join(' | ').slice(0, 300));
          await ctx.close();
        });
      }
    }
  } finally {
    if (b) await b.close();
    srv.close();
    console.log(ko ? `\n${ko} contrôle(s) rouge(s)` : '\nTout est vert');
    process.exit(ko ? 1 : 0);
  }
})();
