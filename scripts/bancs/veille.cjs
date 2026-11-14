// ═══════════════════════════════════════════════════════════════════════════
// BANC : LA VEILLE DANS MA JOURNÉE (11 nov., lot agent2-veille)
//        npm run build && BANC_PORT=$((20000+RANDOM%20000)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/veille.cjs
// ═══════════════════════════════════════════════════════════════════════════
// La VRAIE Ma journée sur une base INVENTÉE (aucune donnée réelle) : les lignes
// `vrm_veille_chiffres` (forme de src/veilleChiffres.js, fabriquée par ses propres
// fonctions) et `vrm_controle_nuit` / `vrm_controle_installation` (src/controleNuit.js).
//   A. Le stock passé de 180 à 120 en une nuit : une carte AMBRE, le titre, « Vérifie »,
//      le geste (44 px) ; « C'est vérifié » écrit `vus` en comparer-et-échanger
//      (`data->>rev=eq.`) et la carte s'en va ; contrôle tout lu à 0 ⇒ « Tout est en ordre ✓ ».
//   B. Le contrôle : deux paires sous le N°12 (ROUGE), un compte pas relu (ambre), un
//      contrôle pas lu ⇒ dit à part, et JAMAIS « Tout est en ordre ».
//   C. Rien (aucune ligne) ⇒ Ma journée ne montre rien de la veille.
//   D. La base refuse la ligne des chiffres (500) ⇒ aucune alerte, rien écrit (« pas su »).
//   E. Le CA d'octobre qui baisse : la carte du mois, son geste vers Argent.
//   F. (14 nov., lot dates-versement) 1 741 ventes à dater, 356 déjà datées, cause « détail
//      pas encore lu » : la ligne dit datées ✓, pourquoi, « environ 7 jours », ton NEUTRE.
// Jugé sur des data-* et des nombres. `BANC_CAPTURE=<dossier>` : captures 390 tactile et
// 1512, clair et sombre. `BANC_DIST=<dossier>` : un autre build (preuve §6.1).
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const RACINE = process.env.BANC_RACINE || path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4593;
const CAPT = process.env.BANC_CAPTURE || '';

const auj = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 20 * 86400e3), owner: null }];
let ROWS = [];
let PANNE = null;   // un id de ligne qui répond 500

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
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const TAILLES = [{ nom: '390', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { nom: '1512', vp: { width: 1512, height: 950 } }]
  .filter((t) => !process.env.BANC_TAILLE || t.nom === process.env.BANC_TAILLE);

async function page(b, T, { sombre = false } = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = [], ecrits = [], lus = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ sombre }) => { try { if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1'); localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, { sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (req.method() === 'PATCH' && eq && eq[1] === 'vrm_veille_chiffres') {
      const corps = JSON.parse(req.postData() || '{}');
      const rev = (/data->>rev=eq\.(\d+)/.exec(u) || [])[1];
      const row = ROWS.find((r) => r.id === 'vrm_veille_chiffres');
      ecrits.push({ u, data: corps.data });
      if (!row || String(row.data.rev) !== String(rev)) return j([]);
      row.data = corps.data; return j([{ id: row.id }]);
    }
    if (req.method() !== 'GET') { ecrits.push({ u, corps: (req.postData() || '').slice(0, 2000) }); return j([]); }
    lus.push(u);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (eq && PANNE && eq[1] === PANNE) return route.fulfill({ status: 500, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: { ...(sombre ? { vinted_dark: true } : {}) } }, sel)]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ecrits, lus };
}
const ouvrir = async (pg, attendre = true) => {
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  if (attendre) await pg.waitForSelector('[data-veille]', { timeout: 30000 }).catch(() => {});
  else await pg.waitForTimeout(6000);
  await pg.waitForTimeout(500);
};
const lire = (pg) => pg.evaluate(() => {
  const s = document.querySelector('[data-veille]'); if (!s) return null;
  const r = (e) => e ? e.getBoundingClientRect() : null;
  const coul = (e) => (e ? getComputedStyle(e).color : '');
  const jeton = (v) => { const t = document.createElement('i'); t.style.color = `var(${v})`; s.appendChild(t); const c = getComputedStyle(t).color; t.remove(); return c; };
  return {
    ambre: jeton('--vrm-warn'), rouge: jeton('--vrm-doublon'),
    controle: s.getAttribute('data-controle'),
    alertes: [...s.querySelectorAll('[data-veille-alerte]')].map((a) => ({ type: a.getAttribute('data-veille-alerte'), k: a.getAttribute('data-veille-cle'), titre: (a.querySelector('.vrm-veille-titre') || {}).innerText || '',
      bord: getComputedStyle(a).borderLeftColor, geste: r(a.querySelector('[data-veille-geste]')), vu: r(a.querySelector('[data-veille-vu]')) })),
    ok: !!s.querySelector('[data-controle-ok]'), texte: s.innerText.replace(/\s+/g, ' ').trim(),
    lignes: [...s.querySelectorAll('[data-controle-ligne]')].map((l) => ({ cle: l.getAttribute('data-controle-ligne'), ton: l.getAttribute('data-ton'), n: (l.querySelector('.vrm-veille-n') || {}).innerText, couleur: coul(l.querySelector('.vrm-veille-n')), btn: r(l.querySelector('[data-controle-geste]')), texte: l.innerText.replace(/\s+/g, ' ') })),
    passu: !!s.querySelector('[data-controle-passu]'),
    deb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});
const capture = async (pg, nom) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.waitForTimeout(300);
  const el = pg.locator('[data-veille]').first(); await el.scrollIntoViewIfNeeded().catch(() => {});
  await pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: false }).catch(() => {}); };

(async () => {
  // Les lignes, fabriquées par les VRAIES fonctions de l'app (aucune forme recopiée à la main).
  const V = await import(pathToFileURL(path.join(RACINE, 'src/veilleChiffres.js')).href);
  const C = await import(pathToFileURL(path.join(RACINE, 'src/controleNuit.js')).href);
  const t0 = auj - 22 * 3600e3, t1 = auj - 3600e3;
  const rel = (t, s, urssaf = null) => ({ maintenant: t, stock: s, comptes: ['111'], ventes: [], suppressions: [], urssaf, selection: ['[]'] });
  const ligneStock = () => { const A = V.pointDuJour(rel(t0, 180)); let d = V.ajouterPoint(null, A); d = V.ajouterPoint(d, V.pointDuJour(rel(t1, 120), A)); return { id: 'vrm_veille_chiffres', data: { ...d, rev: 3 } }; };
  const U = (oct) => ({ at: 1, sources: { Vinted: 'lu' }, mois: [{ ym: '2026-09', ca: 500, n: 6 }, { ym: '2026-10', ca: oct, n: oct > 1000 ? 12 : 9 }] });
  const ligneMois = () => {
    const ta = Date.parse('2026-11-09T18:00:00Z'), tb = Date.parse('2026-11-10T18:00:00Z');
    const A = V.pointDuJour(rel(ta, 150, U(1240))); let d = V.ajouterPoint(null, A); d = V.ajouterPoint(d, V.pointDuJour(rel(tb, 150, U(980)), A));
    d.alertes = d.alertes.map((a) => ({ ...a, at: auj - 3600e3 }));
    return { id: 'vrm_veille_chiffres', data: { ...d, rev: 1 } };
  };
  const ctlOk = () => ({ id: C.CLE_CONTROLE, data: C.resultatControle({ 'numeros-double': [], 'versement-30j': 0, 'comptes-48h': [] }, {}, auj - 2 * 3600e3) });
  const ctlPb = () => ({ id: C.CLE_CONTROLE, data: C.resultatControle({ 'numeros-double': ['12'], 'versement-30j': null, 'comptes-48h': ['111'] }, { 'versement-30j': 'ouvre Ventes pour le compter' }, auj - 2 * 3600e3) });
  // (14 nov.) Le contrôle tel que le cron le range (src/controleNuit.js, `detailVersement`).
  const ctlVers = () => {
    const aDater = { n: 1741, plus30: { n: 1741, ca: 1 }, datees: { n: 356, releve: 0 }, raisons: [{ cle: 'vinted-detail', n: 1741, ca: 1, comptes: [{ uid: '111', nom: 'atelier_test', n: 1741 }] }] };
    return { id: C.CLE_CONTROLE, data: C.resultatControle({ 'numeros-double': [], 'versement-30j': C.versementsEnRetard(aDater), 'comptes-48h': [] }, {}, auj - 2 * 3600e3, { 'versement-30j': C.detailVersement(aDater) }) };
  };
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const T of TAILLES) {
      for (const sombre of CAPT ? [false, true] : [T.nom === '390']) {
        const suf = `${T.nom}${sombre ? '-sombre' : '-clair'}`;
        console.log(`\n══ ${T.nom} px${T.hasTouch ? ' (tactile)' : ''}${sombre ? ' · sombre' : ' · clair'}`);
        await essaie('A' + suf, async () => {
          ROWS = [ligneStock(), ctlOk()]; PANNE = null;
          const { ctx, pg, errs, ecrits, lus } = await page(b, T, { sombre });
          await ouvrir(pg);
          const s = await lire(pg);
          const a = s && s.alertes[0];
          dit(s && s.alertes.length === 1 && a.type === 'stock' && /Ton stock est passé de 180 à 120 en une nuit/.test(a.titre), 'A1 la carte du stock : « Ton stock est passé de 180 à 120 en une nuit »', s && JSON.stringify(s.alertes.map((x) => x.titre)));
          dit(a && a.bord === s.ambre && s.ambre !== s.rouge, 'A2 son bord est AMBRE, le jeton --vrm-warn (un geste à faire, pas une alarme rouge)', a && `${a.bord} / ${s.ambre}`);
          dit(s && /Vérifie tes annonces Vinted/.test(s.texte), 'A3 le geste est dit (« Vérifie tes annonces Vinted »)', s && s.texte.slice(0, 160));
          dit(a && a.geste && a.geste.height >= 43.5 && a.vu && a.vu.height >= 43.5, 'A4 « Voir mes annonces » et « C’est vérifié » : 44 px', a && JSON.stringify([a.geste && a.geste.height, a.vu && a.vu.height]));
          dit(s && s.ok && s.controle === 'ok', 'A5 contrôle de nuit tout lu à 0 ⇒ « Tout est en ordre ✓ »', s && s.controle);
          dit(s && s.deb <= 0, 'A6 aucun défilement horizontal', s && s.deb);
          await capture(pg, `journee-stock-${suf}`);
          await pg.locator('[data-veille-vu]').first().click();
          await pg.waitForFunction(() => !document.querySelector('[data-veille-alerte]'), null, { timeout: 8000 }).catch(() => {});
          const s2 = await lire(pg);
          const patch = ecrits.find((e) => /vrm_veille_chiffres/.test(e.u) && e.data);
          dit(patch && /data->>rev=eq\.3/.test(patch.u) && patch.data.vus && patch.data.vus[a.k] && patch.data.rev === 4, 'A8 « C’est vérifié » écrit `vus` en comparer-et-échanger (rev 3 → 4)', patch && patch.u.slice(-80));
          dit(s2 && s2.alertes.length === 0 && s2.ok, 'A9 la carte s’en va, « Tout est en ordre ✓ » reste', s2 && JSON.stringify(s2.alertes));
          dit(!errs.length, 'A10 aucune erreur de page', errs.join(' | ').slice(0, 200));
          await ctx.close();
        });
        await essaie('B' + suf, async () => {
          ROWS = [ctlPb(), { id: C.CLE_CONTROLE_INSTALLATION, data: C.resultatControle({ 'emails-quarantaine': ['email_quarantaine_a'], stripe: [] }, {}, auj - 3600e3) }]; PANNE = null;
          const { ctx, pg, errs } = await page(b, T, { sombre });
          await ouvrir(pg);
          const s = await lire(pg);
          const L = s ? Object.fromEntries(s.lignes.map((l) => [l.cle, l])) : {};
          dit(s && s.controle === 'probleme' && !s.ok, 'B1 des problèmes ⇒ jamais « Tout est en ordre »', s && s.controle);
          dit(L['numeros-double'] && L['numeros-double'].ton === 'rouge' && L['numeros-double'].couleur === s.rouge && /N°12/.test(L['numeros-double'].texte), 'B2 deux paires sous le N°12 : en ROUGE, le N° nommé', L['numeros-double'] && JSON.stringify([L['numeros-double'].couleur, L['numeros-double'].texte]));
          dit(L['comptes-48h'] && L['comptes-48h'].ton === 'geste' && L['comptes-48h'].n === '1' && L['comptes-48h'].couleur === s.ambre, 'B3 un compte pas relu depuis 48 h : ambre, « 1 »', L['comptes-48h'] && JSON.stringify(L['comptes-48h']));
          dit(L['emails-quarantaine'] && L['emails-quarantaine'].n === '1', 'B4 la quarantaine (ligne de l’installation) est dite à qui la lit', JSON.stringify(Object.keys(L)));
          dit(s && s.passu && /ventes sans versement \(ouvre Ventes pour le compter\)/.test(s.texte) && !L['versement-30j'], 'B5 le contrôle pas lu est dit à part avec sa raison, jamais compté 0', s && s.texte.slice(-160));
          dit(s && s.lignes.every((l) => l.btn && l.btn.height >= 43.5), 'B6 chaque geste fait 44 px', s && JSON.stringify(s.lignes.map((l) => l.btn && l.btn.height)));
          dit(s && s.deb <= 0, 'B7 aucun défilement horizontal', s && s.deb);
          dit(!errs.length, 'B8 aucune erreur de page', errs.join(' | ').slice(0, 200));
          await capture(pg, `journee-controle-${suf}`);
          await pg.locator('[data-controle-geste="comptes-48h"]').click();
          await pg.waitForFunction(() => /tab=vintedaccounts|vintedaccounts/.test(location.search) || !!document.querySelector('[data-ecran="vintedaccounts"],[data-comptes-lies]'), null, { timeout: 8000 }).catch(() => {});
          const ici = await pg.evaluate(() => !document.querySelector('[data-veille]'));
          dit(ici, 'B9 « Mes comptes » quitte Ma journée vers Comptes liés');
          await ctx.close();
        });
        await essaie('F' + suf, async () => {
          ROWS = [ctlVers()]; PANNE = null;
          const { ctx, pg, errs } = await page(b, T, { sombre });
          await ouvrir(pg);
          const s = await lire(pg);
          const l = s && s.lignes.find((x) => x.cle === 'versement-30j');
          const d = await pg.evaluate(() => { const e = document.querySelector('[data-controle-ligne="versement-30j"]'); if (!e) return null;
            const q = (k) => e.querySelector(k); return { cause: e.getAttribute('data-versement-cause'), datees: q('[data-versement-datees]') && q('[data-versement-datees]').getAttribute('data-versement-datees'),
              jours: q('[data-versement-jours]') ? q('[data-versement-jours]').innerText : '', pourquoi: q('[data-versement-pourquoi]') ? q('[data-versement-pourquoi]').innerText : '' }; });
          dit(l && l.n === '1741' && d && d.cause === 'vinted-detail', 'F1 la ligne des ventes à dater : 1741, cause « pas encore lue »', JSON.stringify(d));
          dit(l && l.ton === 'info' && l.couleur !== s.ambre && l.couleur !== s.rouge, 'F2 ton NEUTRE (ni ambre ni rouge) : rien n’est en faute, la lecture est en cours', l && `${l.ton} ${l.couleur} / ${s.ambre}`);
          dit(d && d.datees === '356' && /356 déjà datées ✓/.test(l.texte), 'F3 elle dit combien sont DÉJÀ datées', l && l.texte);
          dit(d && /ouvrant chaque vente/.test(d.pourquoi) && /vinted\.fr est ouvert sur ce compte/.test(d.pourquoi) && /aucune n’est devinée/.test(d.pourquoi), 'F4 elle dit POURQUOI et le geste (Vinted ouvert sur ce compte), jamais devinée', d && d.pourquoi);
          dit(d && /Environ 7 jours/.test(d.jours), 'F5 et combien de temps : « environ 7 jours »', d && d.jours);
          dit(l && !/sans date de versement depuis 30 jours/.test(l.texte) && /Voir le détail/.test(l.texte) && l.btn && l.btn.height >= 43.5, 'F6 plus l’ancienne phrase alarmante ; « Voir le détail » à 44 px', l && l.texte.slice(0, 120));
          dit(s && s.deb <= 0 && !errs.length, 'F7 aucun défilement horizontal, aucune erreur', `${s && s.deb} ${errs.join(' | ').slice(0, 120)}`);
          await capture(pg, `journee-versement-${suf}`);
          await ctx.close();
        });
        await essaie('C' + suf, async () => {
          ROWS = []; PANNE = null;
          const { ctx, pg, errs } = await page(b, T, { sombre });
          await ouvrir(pg, false);
          const s = await lire(pg);
          dit(s === null, 'C1 aucune ligne ⇒ rien de la veille sur Ma journée', s && s.texte);
          dit(!errs.length, 'C2 aucune erreur de page', errs.join(' | ').slice(0, 200));
          await ctx.close();
        });
        await essaie('D' + suf, async () => {
          ROWS = [ligneStock()]; PANNE = 'vrm_veille_chiffres';
          const { ctx, pg, ecrits } = await page(b, T, { sombre });
          await ouvrir(pg, false);
          const s = await lire(pg);
          dit(s === null, 'D1 ligne des chiffres illisible (500) ⇒ aucune alerte (« pas su » ne sonne pas)', s && s.texte);
          dit(!ecrits.some((e) => /vrm_veille_chiffres/.test(e.u)), 'D2 et rien n’est écrit sur une lecture ratée');
          await ctx.close();
        });
        await essaie('E' + suf, async () => {
          ROWS = [ligneMois(), ctlOk()]; PANNE = null;
          const { ctx, pg } = await page(b, T, { sombre });
          await ouvrir(pg);
          const s = await lire(pg);
          const a = s && s.alertes[0];
          dit(a && a.type === 'mois' && /Ton CA d’octobre 2026 est passé de 1.240.€ à 980.€/.test(a.titre), 'E1 le CA d’octobre (mois passé) qui baisse : sa carte', a && a.titre);
          await capture(pg, `journee-mois-${suf}`);
          await pg.locator('[data-veille-geste="mois"]').click();
          await pg.waitForFunction(() => !document.querySelector('[data-veille]'), null, { timeout: 8000 }).catch(() => {});
          dit(await pg.evaluate(() => !document.querySelector('[data-veille]')), 'E2 « Voir le mois » quitte Ma journée vers Argent');
          await ctx.close();
        });
      }
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc veille : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
