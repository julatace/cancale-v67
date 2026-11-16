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
//   B. (15 nov., fiabilite-auto) 1 741 ventes à dater + la quarantaine : RIEN dans Ma journée (le contrôle vit dans
//      « Tout va bien ? », banc fiabilite-auto ; « à dater » n'est dit nulle part). Avant : deux paires sous le N°12 (ROUGE), un compte pas relu (ambre), un
//      contrôle pas lu ⇒ dit à part, et JAMAIS « Tout est en ordre ».
//   C. Rien (aucune ligne) ⇒ Ma journée ne montre rien de la veille.
//   D. La base refuse la ligne des chiffres (500) ⇒ aucune alerte, rien écrit (« pas su »).
//   E. Le CA d'octobre qui baisse : la carte du mois, son geste vers Argent.
//   F. (14 nov., lot dates-versement) 1 741 ventes à dater, 356 déjà datées, cause « détail
//      pas encore lu » : la ligne dit datées ✓, pourquoi, « environ 146 h avec vinted.fr ouvert » (15 nov. : en heures, plus des jours de 24 h), ton NEUTRE.
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
  // (16 nov., intégration vague B) Le parcours de premier lancement (« Tu vends quoi ? ») est déjà fait : il couvrirait
  // tout l'écran (comme scripts/bancs/fiabilite-auto.cjs).
  await pg.addInitScript(({ sombre }) => { try { if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1'); localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_je_vends', JSON.stringify({ choix: 'sneakers', at: '2026-11-01T10:00:00Z', vu: 'banc' })); localStorage.setItem('vrm_configuration', JSON.stringify({ etat: 'fait', at: '2026-11-01T10:00:00.000Z', statut: null, version: 1 })); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: new Date().toISOString() })); { const t = new Date().toISOString(); localStorage.setItem('vrm_parcours_plus_tard', JSON.stringify({ extension: t, emails: t, vinted: t, premiere: t, configuration: t, at: Date.now() })); } if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, { sombre });
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
  const document_a_dater = (t) => /à dater|ventes sans versement|Voir le détail/.test(String(t || ''));
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const T of TAILLES) {
      for (const sombre of CAPT ? [false, true] : [T.nom === '390']) {
        const suf = `${T.nom}${sombre ? '-sombre' : '-clair'}`;
        // (14 nov.) La règle de la passe design : 44 px au doigt, 36 px à la souris (CLAUDE.md §9).
        const CIBLE = T.hasTouch ? 43.5 : 35.5;
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
          dit(a && a.geste && a.geste.height >= CIBLE && a.vu && a.vu.height >= CIBLE, 'A4 « Voir mes annonces » et « C’est vérifié » : 44 px', a && JSON.stringify([a.geste && a.geste.height, a.vu && a.vu.height]));
          // (15 nov., lot fiabilite-auto) Le contrôle de nuit ne s'affiche PLUS dans Ma journée (Julien :
          // « encombrée de cases ») : il vit dans Paramètres → Tout va bien ? (banc fiabilite-auto).
          dit(s && !s.ok && !s.controle && !s.lignes.length, 'A5 Ma journée ne porte plus le contrôle de nuit (il vit dans « Tout va bien ? »)', s && s.controle);
          dit(s && s.deb <= 0, 'A6 aucun défilement horizontal', s && s.deb);
          await capture(pg, `journee-stock-${suf}`);
          await pg.locator('[data-veille-vu]').first().click();
          await pg.waitForFunction(() => !document.querySelector('[data-veille-alerte]'), null, { timeout: 8000 }).catch(() => {});
          const s2 = await lire(pg);
          const patch = ecrits.find((e) => /vrm_veille_chiffres/.test(e.u) && e.data);
          dit(patch && /data->>rev=eq\.3/.test(patch.u) && patch.data.vus && patch.data.vus[a.k] && patch.data.rev === 4, 'A8 « C’est vérifié » écrit `vus` en comparer-et-échanger (rev 3 → 4)', patch && patch.u.slice(-80));
          dit(s2 === null || s2.alertes.length === 0, 'A9 la carte s’en va (rien d’autre de la veille dans Ma journée)', s2 && JSON.stringify(s2.alertes));
          dit(!errs.length, 'A10 aucune erreur de page', errs.join(' | ').slice(0, 200));
          await ctx.close();
        });
        await essaie('B' + suf, async () => {
          // (15 nov., lot fiabilite-auto) Deux paires sous le N°12, un compte pas relu, 1 741 ventes à dater :
          // RIEN dans Ma journée (le contrôle vit dans « Tout va bien ? », « à dater » n'est dit nulle part).
          ROWS = [ctlVers(), { id: C.CLE_CONTROLE_INSTALLATION, data: C.resultatControle({ 'emails-quarantaine': ['email_quarantaine_a'], stripe: [] }, {}, auj - 3600e3) }]; PANNE = null;
          const { ctx, pg, errs } = await page(b, T, { sombre });
          await ouvrir(pg, false);
          const s = await lire(pg);
          const texte = await pg.locator('main').innerText().catch(() => '');
          dit(s === null, 'B1 des écarts cette nuit ⇒ aucune carte de contrôle dans Ma journée', s && s.texte);
          dit(!/à dater|1\s?741|sans date de versement/i.test(texte), 'B2 « ventes à dater » n’est écrit nulle part dans Ma journée', texte.slice(0, 160));
          dit(!errs.length, 'B3 aucune erreur de page', errs.join(' | ').slice(0, 200));
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
