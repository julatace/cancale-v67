// ════════════════════════════════════════════════════════════════════════════
//  BANC « 1 000 ANNONCES LEBONCOIN ET VESTIAIRE » (16 nov., lot bancs-rouges-b, mission 56)
//
//  Un vendeur INVENTÉ (dépôt public, aucune fx/) qui a 1 000 annonces Leboncoin (`lbc_listings`, un
//  compte, lecture complète) et 1 000 annonces Vestiaire (`vc_listings`, lecture complète), aux formes
//  des bancs existants (_a11y.cjs, vestiaire-fiches.cjs). Annonces → Leboncoin, puis → Vestiaire, à
//  390 px tactile et 1512 px :
//   V1  les 1 000 sont COMPTÉES (aucune demi-liste présentée comme complète, §5) — jugé sur les data-*
//       du nombre de l'écran et sur les rangées (`data-fiche-ligne` du site) ;
//   V2  l'écran est utilisable dans un BUDGET raisonnable (machine partagée : plafonds larges, dits) :
//       première rangée visible, tâches longues du fil principal, nœuds du DOM ;
//   V3  la recherche trouve UNE annonce précise parmi 1 000 (par son titre unique), vite ;
//   V4  aucune lecture `select=data` d'une ligne entière autre que la liste du site elle-même, et la
//       liste lue UNE fois (pas de relecture en boucle) ;
//   V5  rien ne déborde, aucune erreur d'app.
//  Les mesures sont imprimées (« MESURE … ») pour relever les budgets en connaissance de cause.
//  Lancer : construire dist/, puis BANC_PORT=… node scripts/bancs/volume-lbc-vestiaire.cjs
//  (VOL_SITES=leboncoin,vestiaire · VOL_LARGEURS=390,1512 · SHOTS=dossier · VOL_N=1000)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const SHOTS = process.env.SHOTS || '';
const N = Number(process.env.VOL_N) || 1000;
const SITES = (process.env.VOL_SITES || 'leboncoin,vestiaire').split(',');
const LARGEURS = (process.env.VOL_LARGEURS || '390,1512').split(',').map(Number);
// Budgets (16 nov.) : la machine des bancs est partagée (4 cœurs, souvent très chargée) ; ces plafonds
// attrapent un écran qui s'effondre (rendu de 1 000 cartes lourdes, boucle de relecture), pas une lenteur
// de quelques centaines de ms. Chaque mesure est imprimée à côté.
const BUDGET = { premiereMs: 25000, longuesMs: 12000, facteur: 3, margeMs: 8000, noeuds: 60000, rechercheMs: 4000, lecturesLourdes: 4 };
const MAINTENANT = Date.now();
const ilYa = (h) => new Date(MAINTENANT - h * 3600e3).toISOString();
const LBC = 'bbbb2222-0000-4000-8000-00000000000b';
const MARQUES = ['Nike', 'Adidas', 'Asics', 'New Balance', 'Salomon', 'Puma', 'Vans', 'Converse', 'Reebok', 'Veja'];
const titre = (i) => `${MARQUES[i % MARQUES.length]} modèle ${100 + (i % 37)} taille ${36 + (i % 11)}${i === 777 ? ' Zébrure unique' : ''}`;
function donnees(n) {
  const lbcItems = {}; const vcItems = {};
  for (let i = 0; i < n; i++) {
    const id = String(4200000000 + i);
    lbcItems[id] = { id, subject: titre(i), price: 30 + (i % 70), ref: '', account: LBC, accountName: 'Compte_lbc', platform: 'leboncoin', status: 'active', seenAt: ilYa(0.1), images: [], stats: { favoris: i % 9, at: ilYa(1) } };
    vcItems[String(72000000 + i)] = { titre: titre(i), prix: { valeur: 40 + (i % 90), devise: 'EUR', cle: 'price' }, statut: 'ON_SALE', compte: 'compteVc', vuAt: ilYa(0.3), photo: '', favoris: i % 7, ref: '' };
  }
  return [
    { id: 'main', data: { vrm_ville: 'Cancale' } },
    { id: 'lbc_listings', data: { items: lbcItems, lectures: { [LBC]: { at: ilYa(0.1), total: n, n } } } },
    { id: 'lbc_accounts', data: { accounts: { [LBC]: { id: LBC, name: 'Compte_lbc', type: 'particulier', seenAt: ilYa(0.2), sessionAt: ilYa(0.2), source: 'session:messagerie' } } } },
    { id: 'lbc_ventes', data: { ventes: {} } },
    { id: 'vc_session', data: { id: 'compteVc', at: ilYa(0.3), source: 'users/me', comptes: { compteVc: ilYa(0.3) } } },
    { id: 'vc_listings', data: { capturedAt: ilYa(0.3), complet: true, total: n, liens: {}, items: vcItems } },
    { id: 'vc_ventes', data: { lectures: { ventes: { at: ilYa(0.3) } }, ventes: {} } },
  ];
}
const LISTE_DU_SITE = { leboncoin: 'lbc_listings', vestiaire: 'vc_listings' };

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
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
    if (src === 'updated_at') { out[alias] = ilYa(0); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};

async function ouvrir(b, largeur, lien, LIGNES) {
  const tel = largeur < 700;
  const ctx = await b.newContext({ locale: 'fr-FR', viewport: { width: largeur, height: tel ? 844 : 950 }, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const lectures = [];
  await pg.addInitScript(() => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {}
    window.__longues = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longues += e.duration; }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
  });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' })));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const h = { 'access-control-allow-origin': '*' };
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { ...h, 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: ilYa(0), cap: r.data.capturedAt });
    const ids = [];
    const inn = /id=in\.\(([^)]*)\)/.exec(u); const eq = /id=eq\.([^&]*)/.exec(u); const lk = /id=like\.([^&]*)/.exec(u);
    let rows = [];
    if (inn) { const l = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); rows = LIGNES.filter((r) => l.includes(r.id)); }
    else if (eq) rows = LIGNES.filter((r) => r.id === eq[1]);
    else if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); rows = LIGNES.filter((r) => re.test(r.id)); }
    for (const r of rows) ids.push(r.id);
    lectures.push({ sel: sel || '*', ids, entiere: !sel || sel === '*' || /(^|,)data(,|$)/.test(sel) || /^id,data/.test(sel) });
    return j(rows.map(forme));
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  const t0 = Date.now();
  await pg.goto(`http://localhost:${PORT}/${lien}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, lectures, t0, tel };
}

(async () => {
  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const site of SITES) for (const largeur of LARGEURS) {
      const T = `${site} · ${largeur}`;
      console.log(`\n— ${T}`);
      const ligne = `[data-fiche-ligne][data-fl-site="${site}"]`;
      // RÉFÉRENCE : le même écran avec 10 annonces, mesuré juste avant (la machine est partagée : les temps se jugent
      // RELATIVEMENT à elle, jamais en absolu).
      const ref = await (async () => { const r = await ouvrir(b, largeur, `?tab=annonces&site=${site}`, donnees(10));
        try { const v = await r.pg.waitForSelector(ligne, { state: 'visible', timeout: 90000 }).then(() => true).catch(() => false); const ms = Date.now() - r.t0; await new Promise((x) => setTimeout(x, 2500)); const longues = await r.pg.evaluate(() => Math.round(window.__longues || 0)).catch(() => null); return v && longues != null ? { ms, longues } : null; }
        catch (_) { return null; }
        finally { await r.ctx.close().catch(() => {}); } })();
      console.log(`  MESURE ${T} référence (10 annonces) : ${ref ? `première rangée ${ref.ms} ms · tâches longues ${ref.longues} ms` : 'pas de rangée'}`);
      const plafondMs = ref ? Math.max(ref.ms * BUDGET.facteur, ref.ms + BUDGET.margeMs) : BUDGET.premiereMs;
      const plafondLongues = ref ? Math.max(ref.longues * BUDGET.facteur, ref.longues + BUDGET.margeMs) : BUDGET.longuesMs;
      const o = await ouvrir(b, largeur, `?tab=annonces&site=${site}`, donnees(N));
      const { pg } = o;
      try {
        const vu = await pg.waitForSelector(ligne, { state: 'visible', timeout: 120000 }).then(() => true).catch(() => false);
        const premiereMs = Date.now() - o.t0;
        dit(vu, `${T} : V2 une rangée du site est visible`, vu ? '' : 'aucune rangée');
        if (!vu) { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `volume-${site}-${largeur}-vide.png`) }).catch(() => {}); continue; }
        await new Promise((r) => setTimeout(r, 2500));   // laisser finir le rendu (côté Node : l'horloge de la page n'est pas touchée)
        const m = await pg.evaluate((q) => {
          const nb = (s) => document.querySelectorAll(s).length;
          const nAttr = (() => { const e = document.querySelector('[data-vc-annonces-n]'); return e ? e.getAttribute('data-vc-annonces-n') : null; })();
          return { rangees: nb(q), noeuds: nb('*'), longues: Math.round(window.__longues || 0), nAttr, deb: document.documentElement.scrollWidth - document.documentElement.clientWidth, texte: (document.querySelector('.vrm-main') || document.body).innerText.slice(0, 4000) };
        }, ligne);
        console.log(`  MESURE ${T} première rangée ${premiereMs} ms · tâches longues ${m.longues} ms · nœuds ${m.noeuds} · rangées ${m.rangees}${m.nAttr != null ? ' · data-n ' + m.nAttr : ''}`);
        // V1 — les 1 000 comptées : toutes rendues, ou une liste qui DIT combien elle en montre sur 1 000.
        const ditN = new RegExp(`(^|\\D)${N.toLocaleString('fr-FR').replace(/\s/g, '[\\s\\u202f\\u00a0]?')}(\\D|$)`).test(m.texte) || new RegExp(`(^|\\D)${N}(\\D|$)`).test(m.texte);
        dit(m.rangees === N || (m.rangees > 0 && ditN), `${T} : V1 les ${N} annonces sont comptées (toutes rendues, ou le total dit)`, `${m.rangees} rangées · total dit : ${ditN}`);
        if (site === 'vestiaire') dit(m.nAttr === String(N), `${T} : V1 Vestiaire : data-vc-annonces-n = ${N}`, String(m.nAttr));
        dit(premiereMs <= plafondMs, `${T} : V2 première rangée : au plus ×${BUDGET.facteur} (ou +${BUDGET.margeMs / 1000} s) la référence à 10 annonces`, `${premiereMs} ms (plafond ${Math.round(plafondMs)} ms)`);
        dit(m.longues <= plafondLongues, `${T} : V2 tâches longues : au plus ×${BUDGET.facteur} (ou +${BUDGET.margeMs / 1000} s) la référence`, `${m.longues} ms (plafond ${Math.round(plafondLongues)} ms)`);
        dit(m.noeuds <= BUDGET.noeuds, `${T} : V2 nœuds du DOM ≤ ${BUDGET.noeuds}`, String(m.noeuds));
        // V3 — la recherche : le titre unique « Zébrure unique » (annonce n° 777).
        const champ = pg.locator(`[data-pf-outils="${site}"] input, .vrm-main input[type="search"]`).filter({ visible: true }).first();
        if (await champ.count()) {
          const tR = Date.now();
          await champ.fill('Zébrure unique');
          const un = await pg.waitForFunction((q) => { const l = [...document.querySelectorAll(q)].filter((e) => e.getClientRects().length); return l.length === 1 && /Zébrure unique/.test(l[0].textContent) ? 1 : 0; }, ligne, { timeout: 15000 }).then(() => true).catch(() => false);
          const rMs = Date.now() - tR;
          console.log(`  MESURE ${T} recherche ${rMs} ms`);
          dit(un, `${T} : V3 la recherche trouve L’annonce (une rangée, la bonne) parmi ${N}`);
          const plafondR = Math.max(BUDGET.rechercheMs, ref ? ref.ms : 0);
          dit(un && rMs <= plafondR, `${T} : V3 recherche en ${BUDGET.rechercheMs / 1000} s au plus (ou le temps d’ouverture de la référence, machine chargée)`, `${rMs} ms (plafond ${plafondR} ms)`);
          await champ.fill('');
        } else dit(false, `${T} : V3 un champ de recherche sur la liste du site`, 'introuvable');
        // V4 — lectures.
        // Une lecture LOURDE d'une liste : la ligne entière, ou sa projection `items` (les 1 000 annonces). Les petites
        // projections (`liens`, `capturedAt`, `id`) ne comptent pas.
        const liste = LISTE_DU_SITE[site];
        const lourde = (l, id) => l.ids.includes(id) && (l.entiere || /(^|,)[a-z]*:?data->items(,|$)/.test(l.sel));
        const entieres = o.lectures.filter((l) => l.entiere && l.ids.some((id) => id === 'lbc_listings' || id === 'vc_listings'));
        const nListe = o.lectures.filter((l) => lourde(l, liste)).length;
        console.log(`  MESURE ${T} lectures lourdes de ${liste} : ${nListe} · toutes les lectures : ${o.lectures.length}`);
        dit(!entieres.length, `${T} : V4 aucune lecture \`select=data\` ENTIÈRE d’une liste de 1 000 annonces (projection exigée, §4.4)`, entieres.map((l) => l.ids.join(',') + ' ← ' + l.sel).slice(0, 4).join(' | '));
        dit(nListe >= 1 && nListe <= BUDGET.lecturesLourdes, `${T} : V4 les 1 000 annonces du site lues ${BUDGET.lecturesLourdes} fois au plus (jamais en boucle)`, String(nListe));
        dit(m.deb <= 1, `${T} : V5 rien ne déborde`, String(m.deb));
        dit(o.errs.length === 0, `${T} : V5 aucune erreur d’app`, o.errs.slice(0, 2).join(' | '));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `volume-${site}-${largeur}.png`) }).catch(() => {});
      } catch (e) { dit(false, `${T} : le scénario s’exécute`, String(e && e.message).split('\n')[0].slice(0, 200)); }
      finally { await o.ctx.close().catch(() => {}); }
    }
  } finally { await b.close().catch(() => {}); srv.close(); }
  console.log(ko ? `\n❌ volume-lbc-vestiaire : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ volume-lbc-vestiaire : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
