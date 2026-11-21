// ════════════════════════════════════════════════════════════════════════════
// BANC : L'ATELIER DANS ORGANISATION (10 nov., lot N)
//        npm run build && BANC_PORT=$((20000+RANDOM%20000)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/atelier-organisation.cjs
// ════════════════════════════════════════════════════════════════════════════
// La VRAIE app (dist/), une base INVENTÉE (aucune donnée réelle), la route
// Organisation jouée par le VRAI `appliquer` (src/operations/metier.js).
// Un compte (111), trois achats : 9501 et 9503 portent le MÊME titre (deux paires
// identiques, deux cartes), 9502 est déjà à « Nettoyée » depuis 9 jours.
// À LA MAIN :
//   A. Organisation ouverte d'abord (rien publié sur l'appareil) : l'Atelier est la
//      première section ; 4 colonnes ; « Nettoyée » 1, la carte 9502 en ambre ;
//      « + Ajouter une paire » dit « — » (achats pas lus ici), jamais « 0 ».
//   B. Ma journée : UNE ligne ambre « 1 paire à « Nettoyée » depuis plus de 7 j »,
//      qui ouvre Organisation ; les achats sont publiés pour l'atelier.
//   C. Organisation : « Ajouter » 9501 ⇒ « Reçue » ; 9503 (même titre) reste
//      proposée ; « → Nettoyée » avance 9501 et elle seule ; un N° tapé (« 007 »)
//      devient n:7 ; à l'ordinateur, glisser 9501 vers « Photographiée ».
//   D. Aucun défilement de côté, cibles 44 px au doigt ; captures clair/sombre.
// Jugé sur des data-*. `BANC_CAPTURE=<dossier>` : captures. `BANC_DIST=<dossier>` :
// un autre build (preuve §6.1).
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { pathToFileURL } = require('url');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const METIER = process.env.BANC_METIER || path.join(__dirname, '..', '..', 'src', 'operations', 'metier.js');
const PORT = Number(process.env.BANC_PORT) || 4637;
const CAPT = process.env.BANC_CAPTURE || '';

const auj = Date.now(), J = 86400e3;
const iso = (ms) => new Date(ms).toISOString();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 400 * J), owner: null }];
const achat = (tx, titre, jours) => ({ transaction_id: tx, conversation_id: 7000 + tx, title: titre, price: { amount: '40', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(auj - jours * J) });
const ACHATS = [achat(9501, 'Nike Cortez blanche 42', 3), achat(9502, 'Puma Suede noire 41', 12), achat(9503, 'Nike Cortez blanche 42', 2)];
const ROWS = [
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(auj - 60000), nItems: ACHATS.length, payload: { my_orders: ACHATS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(auj - 60000), payload: { my_orders: [] } } },
  { id: 'harvest_111_listings', data: { uid: '111', type: 'listings', nItems: 0, capturedAt: iso(auj - 60000), payload: { items: [], pagination: { total_entries: 0 } } } },
];

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>[^>]*$/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).split('\n')[0].slice(0, 200)); } };
const TAILLES = [{ nom: '390', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { nom: '1512', vp: { width: 1512, height: 950 } }]
  .filter((t) => !process.env.BANC_TAILLE || t.nom === process.env.BANC_TAILLE);
const capture = async (pg, nom) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: false }).catch(() => {}); };

(async () => {
  const M = await import(pathToFileURL(METIER).href);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  for (const T of TAILLES) for (const sombre of [false, true]) {
    const suf = `${T.nom}-${sombre ? 'sombre' : 'clair'}`;
    console.log(`\n── ${suf}`);
    // L'espace Organisation de ce passage : 9502 à « Nettoyée » depuis 9 jours.
    let OPS = M.VIDE();
    OPS.atelier = { etapes: [{ id: 'recue', nom: 'Reçue' }, { id: 'nettoyee', nom: 'Nettoyée' }, { id: 'photographiee', nom: 'Photographiée' }, { id: 'en_ligne', nom: 'Mise en ligne' }],
      paires: [{ id: 'a:9502', titre: 'Puma Suede noire 41', photo: '', etape: 'nettoyee', depuis: iso(auj - 9 * J), ajoute: iso(auj - 10 * J), evenements: [] }] };
    const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, colorScheme: sombre ? 'dark' : 'light' });
    const pg = await ctx.newPage();
    const errs = [], versVinted = []; pg.on('pageerror', (e) => errs.push(e.message));
    pg.on('request', (q) => { if (/vinted\.fr/.test(q.url())) versVinted.push(q.url()); });
    await pg.addInitScript(({ sombre }) => { try { if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1'); localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, { sombre });
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
    await pg.route('**/rest/v1/**', (route) => {
      const req = route.request();
      const u = decodeURIComponent(metaVersData(req.url()));
      const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
      if (req.method() !== 'GET') return j([]);
      if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
      if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
      const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
      const eq = /id=eq\.([^&]*)/.exec(u);
      if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: { ...(sombre ? { vinted_dark: true } : {}) } }, sel)]);
      if (eq && eq[1] === 'vrm_operations_v1') { if (sel === 'data') { pg.__selectData = true; } return j([projette({ id: 'vrm_operations_v1', data: OPS }, sel)]); }
      if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
      const lk = /id=like\.([^&]*)/.exec(u);
      if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
      return j([]);
    });
    await pg.route('**/api/**', async (r) => {
      const u = new URL(r.request().url());
      if (u.pathname === '/api/compte' && u.searchParams.get('mode') === 'operations') {
        if (r.request().method() === 'POST') {
          const c = r.request().postDataJSON();
          try { OPS = M.appliquer(OPS, c, { acteur: 'banc', maintenant: new Date().toISOString(), empreinte: JSON.stringify(c.donnees) }); }
          catch (e) { return r.fulfill({ status: e.status || 400, contentType: 'application/json', body: JSON.stringify({ ok: false, message: e.message }) }); }
        }
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, donnees: OPS, confirmees: OPS.commandes.map((x) => x.id), equipe: [], serveur: new Date().toISOString() }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
    });
    const lire = () => pg.evaluate(() => {
      const a = document.querySelector('[data-atelier]'); if (!a) return null;
      const c = {}; for (const e of a.querySelectorAll('[data-atelier-compte]')) c[e.getAttribute('data-atelier-compte')] = e.getAttribute('data-n');
      const p = {}; for (const e of a.querySelectorAll('[data-atelier-paire]')) p[e.getAttribute('data-atelier-paire')] = { col: e.closest('[data-atelier-colonne]').getAttribute('data-atelier-colonne'), retard: e.getAttribute('data-atelier-retard') };
      const aj = a.querySelector('[data-atelier-achats]');
      return { c, p, section: document.querySelector('[data-ops-section]')?.getAttribute('data-ops-section'), achats: aj ? aj.getAttribute('data-atelier-achats') : null,
        proposes: [...a.querySelectorAll('[data-atelier-achat]')].map((e) => e.getAttribute('data-atelier-achat')),
        deb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        petites: [...a.querySelectorAll('button, select, input')].filter((x) => !x.disabled && x.getBoundingClientRect().width > 0).map((x) => x.getBoundingClientRect()).map((r) => Math.min(r.width, r.height)).filter((h) => h < 44).length,
        ambre: (() => { const e = a.querySelector('[data-atelier-retard="1"] .atl-ambre-texte'); return e ? getComputedStyle(e).color : null; })() };
    });
    const attendreOps = (f) => pg.waitForFunction(f, null, { timeout: 10000 }).catch(() => {});

    await essaie('A ' + suf, async () => {
      await pg.goto(`http://localhost:${PORT}/?tab=organisation`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-atelier]', { timeout: 30000 }).catch(async () => { if (CAPT) { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, `echec-A-${suf}.png`) }); } throw Error('Atelier absent : ' + errs.join(' | ').slice(0, 300) + ' · ' + (await pg.evaluate(() => document.body.innerText.slice(0, 120).replace(/\s+/g, ' ')))); });
      let s = await lire();
      dit(s && s.section === 'atelier', 'A1 Organisation s’ouvre sur l’Atelier', s && s.section);
      dit(s && s.c.recue === '0' && s.c.nettoyee === '1' && s.c.photographiee === '0' && s.c.en_ligne === '0', 'A2 le nombre par étape (0 · 1 · 0 · 0)', s && JSON.stringify(s.c));
      dit(s && s.p['a:9502'] && s.p['a:9502'].col === 'nettoyee' && s.p['a:9502'].retard === '1', 'A3 9502 à « Nettoyée », plus de 7 j : ambre', s && JSON.stringify(s.p));
      dit(s && s.ambre && /rgb\((178, 80, 0|235, 192, 128)\)/.test(s.ambre), 'A4 la couleur est l’ambre (geste), pas le rouge', s && s.ambre);
      await pg.locator('[data-atelier-ajouter]').click();
      s = await lire();
      dit(s && s.achats === 'pas-su', 'A5 achats pas lus sur l’appareil : « — », jamais 0', s && s.achats);
      await capture(pg, `organisation-vide-${suf}`);
      await pg.locator('[data-atelier-ajouter]').click();
    });
    await essaie('B ' + suf, async () => {
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-job="atelier-attente"]', { timeout: 30000 });
      const l = await pg.evaluate(() => { const e = document.querySelector('[data-job="atelier-attente"]'); return e ? { n: e.getAttribute('data-n'), t: (e.getAttribute('aria-label') || e.innerText).replace(/\s+/g, ' ') } : null; });
      dit(l && l.n === '1' && /^1 \S+ à « Nettoyée » depuis plus de 7 j/.test(l.t), 'B1 Ma journée : une ligne « 1 paire à « Nettoyée » depuis plus de 7 j »', l && JSON.stringify(l));
      dit(!pg.__selectData, 'B2 Ma journée ne relit pas toute la ligne (jamais select=data)');
      await pg.waitForFunction(() => { try { const v = JSON.parse(localStorage.getItem('vrm_atelier_achats') || 'null'); return v && v.l && v.l.length === 3; } catch (_) { return false; } }, null, { timeout: 20000 }).catch(() => {});
      const pub = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_atelier_achats')); } catch (_) { return null; } });
      dit(pub && pub.l && pub.l.map((x) => x.id).sort().join() === 'a:9501,a:9502,a:9503', 'B3 les achats lus sont publiés pour l’atelier, par n° de transaction', pub && JSON.stringify(pub.l && pub.l.map((x) => x.id)));
      await capture(pg, `journee-${suf}`);
      await pg.locator('[data-job="atelier-attente"]').first().click();
      await pg.waitForSelector('[data-atelier]', { timeout: 20000 });
      dit(true, 'B4 la ligne ouvre l’Atelier');
    });
    await essaie('C ' + suf, async () => {
      await pg.locator('[data-atelier-ajouter]').click();
      let s = await lire();
      dit(s && [...s.proposes].sort().join() === 'a:9501,a:9503', 'C1 proposés : 9501 et 9503 (même titre, deux paires) ; 9502 déjà là', s && s.proposes.join());
      await capture(pg, `organisation-ajout-${suf}`);
      await pg.locator('[data-atelier-achat="a:9501"] button').click();
      await attendreOps(() => document.querySelector('[data-atelier-paire="a:9501"]'));
      s = await lire();
      dit(s && s.p['a:9501'] && s.p['a:9501'].col === 'recue' && s.proposes.join() === 'a:9503' && OPS.atelier.paires.length === 2, 'C2 « Ajouter » 9501 ⇒ « Reçue » ; 9503 reste proposée', s && JSON.stringify(s.p));
      await pg.locator('.atl-num input').fill('007');
      await pg.locator('.atl-num button').click();
      await attendreOps(() => document.querySelector('[data-atelier-paire="n:7"]'));
      s = await lire();
      dit(s && s.p['n:7'] && s.p['n:7'].col === 'recue', 'C3 un N° tapé « 007 » ⇒ la carte n:7', s && Object.keys(s.p).join());
      await pg.locator('[data-atelier-ajouter]').click();
      await pg.locator('[data-atelier-paire="a:9501"] [data-atelier-avancer]').click();
      await attendreOps(() => document.querySelector('[data-atelier-colonne="nettoyee"] [data-atelier-paire="a:9501"]'));
      s = await lire();
      dit(s && s.p['a:9501'].col === 'nettoyee' && s.p['n:7'].col === 'recue' && s.p['a:9502'].col === 'nettoyee' && s.c.nettoyee === '2', 'C4 « → Nettoyée » avance 9501, et elle seule', s && JSON.stringify(s.c));
      dit(s && s.p['a:9501'].retard === '0', 'C5 une paire qui vient d’avancer n’est pas en ambre');
      if (!T.hasTouch) {
        await pg.locator('[data-atelier-paire="a:9501"]').dragTo(pg.locator('[data-atelier-colonne="photographiee"]'));
        await attendreOps(() => document.querySelector('[data-atelier-colonne="photographiee"] [data-atelier-paire="a:9501"]'));
        s = await lire();
        dit(s && s.p['a:9501'].col === 'photographiee' && s.c.photographiee === '1', 'C6 glisser 9501 vers « Photographiée »', s && JSON.stringify(s.c));
      }
      dit(s && s.deb <= 0, 'D1 aucun défilement de côté', s && s.deb);
      if (T.hasTouch) dit(s && s.petites === 0, 'D2 au doigt : chaque bouton, liste et champ fait 44 px ou plus', s && s.petites);
      await capture(pg, `organisation-${suf}`);
      dit(versVinted.length === 0, 'D3 rien n’est envoyé à Vinted', versVinted.join(' ').slice(0, 200));
      dit(errs.length === 0, 'D4 aucune erreur d’app', errs.join(' | ').slice(0, 200));
    });
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
