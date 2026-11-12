// ── BANC : CENTRE D'AIDE INTÉGRÉ (11 nov., lot centre-aide) ────────────────────
// Données INVENTÉES (aucune fx/). Aux deux tailles (390 tactile, 1512), clair et sombre :
//  • le « ? » de 3 écrans (Ma journée, Colis, Paramètres) ouvre la feuille : l'animation
//    (une scène par geste, qui AVANCE), le geste en cours allumé, 3 à 5 fiches ;
//  • dans la feuille de Ma journée, « imprimer bordereau » ⇒ « Imprimer un bordereau » en
//    tête ⇒ « M'y emmener » ferme la feuille et ouvre Colis ;
//  • la loupe universelle : « imprimer bordereau » ⇒ le groupe « Comment faire » ⇒ la
//    feuille ouverte sur la fiche ⇒ « M'y emmener » ⇒ Colis ; « vacances » ⇒ Réglages,
//    panneau « Mode vacances » ouvert ;
//  • rien ne s'ouvre tout seul ; « réduire les animations » ⇒ immobile ; vendeur
//    « autre » ⇒ « article », jamais « paire » ; rien n'est écrit.
// `BANC_PORT` (défaut 4693), `BANC_CAPTURES=dossier`.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4693);
const CAPTURES = process.env.BANC_CAPTURES || '';
const MAINTENANT = Date.now();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const ROWS = [
  { id: 'main', data: {} },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } },
];
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  if (f === '/sw.js') { r.writeHead(404); return r.end(); }   // le banc pose lui-même la réserve
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

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

async function preparer(b, vp, sombre, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}), ...(opts.reduit ? { reducedMotion: 'reduce' } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = [];
  const rows = (opts.rows || ROWS).map((r) => ({ id: r.id, data: JSON.parse(JSON.stringify(r.data)) }));
  await pg.addInitScript(([s, v]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); localStorage.setItem('vrm_je_vends', JSON.stringify({ choix: v, at: '2026-11-01T10:00:00Z' })); } catch (_) {} }, [!!sombre, opts.vend || 'sneakers']);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      if (/\/rest\/v1\/app_data/.test(u) && req.method() === 'POST') {
        try {
          let corps = JSON.parse(req.postData() || '[]'); if (!Array.isArray(corps)) corps = [corps];
          for (const l of corps) {
            if (!l || !l.id) continue;
            ecrits.push({ id: l.id, data: l.data });
            const ex = rows.find((r) => r.id === l.id); if (ex) ex.data = l.data; else rows.push({ id: l.id, data: l.data });
          }
        } catch (_) {}
      }
      if (/\/rest\/v1\/app_data/.test(u) && req.method() === 'PATCH') {
        const id = (/[?&]id=eq\.([^&]*)/.exec(u) || [])[1];
        let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {}
        const ex = id && rows.find((r) => r.id === id);
        if (ex && corps && corps.data !== undefined) { ecrits.push({ id, data: corps.data }); ex.data = corps.data; return j([{ id }]); }
      }
      return j([]);
    }
    if (/select=owner&limit=1/.test(u)) return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ecrits };
}
const hauteur = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : 0; }, sel);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const capture = async (pg, nom) => { if (!CAPTURES) return; try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
const ECRANS = [['journee', '?tab=journee'], ['colis', '?tab=cat_bord'], ['settings', '?tab=settings']];
// L'app publie d'elle-même au chargement (widget, comptes reliés, « à retirer », `main`) : hors de ça,
// et sans aucune clé d'aide dans `main`, rien n'a été écrit par l'aide.
const ecritsUtiles = (ecrits) => ecrits.filter((e) => !/^(ext_|vrm_vu|vrm_presence|vrm_lecture|perf_|vrm_session|widget_stats$|vrm_comptes_relies$|lbc_a_retirer$|main$)/.test(e.id) || (e.id === 'main' && Object.keys(e.data || {}).some((k) => /aide/i.test(k))));

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const T = (vp.width < 600 ? '📱' : '🖥️') + (sombre ? '🌙' : '☀️');
        const tap = async (pg, sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (vp.width < 600) await l.tap(); else await l.click(); };
        const suffixe = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;

        // ── Le « ? » de trois écrans ─────────────────────────────────────────────
        for (const [cle, lien] of ECRANS) await essaie(`${T} aide ${cle}`, async () => {
          const { ctx, pg, errs } = await preparer(b, vp, sombre);
          await pg.goto(`http://localhost:${PORT}/${lien}`, { waitUntil: 'domcontentloaded' });
          await pg.locator(`[data-aide-ouvrir="${cle}"]`).first().waitFor({ timeout: 20000 });
          await pg.waitForTimeout(800);
          dit((await pg.locator('[data-aide-feuille]').count()) === 0, `${T} ${cle} : aucune aide ouverte toute seule`);
          await tap(pg, `[data-aide-ouvrir="${cle}"]`);
          await pg.locator('[data-aide-animation]').first().waitFor({ timeout: 5000 });
          const nScenes = Number(await pg.locator('[data-aide-animation]').getAttribute('data-aide-animation-scenes'));
          const nGestes = await pg.locator('[data-aide-etapes] [data-aide-etape]').count();
          dit(nScenes >= 3 && nScenes === nGestes, `${T} ${cle} : une scène par geste`, `${nScenes}/${nGestes}`);
          const s1 = await pg.locator('[data-aide-animation]').getAttribute('data-aide-animation-scene');
          await pg.waitForTimeout(1150);
          const s2 = await pg.locator('[data-aide-animation]').getAttribute('data-aide-animation-scene');
          dit(s1 !== s2 && /^\d$/.test(s2), `${T} ${cle} : l’animation avance`, `${s1} → ${s2}`);
          dit((await pg.locator(`[data-aide-etape="${Number(s2) + 1}"][data-aide-etape-actif]`).count()) === 1, `${T} ${cle} : le geste en cours est allumé`);
          await capture(pg, `aide-${cle}-${suffixe}`);
          const nf = Number(await pg.locator('[data-aide-fiches]').getAttribute('data-aide-fiches'));
          dit(nf >= 3 && nf <= 5, `${T} ${cle} : ${nf} fiches « Comment faire »`);
          dit((await hauteur(pg, '[data-aide-animation-bouton]')) >= 44 && (await hauteur(pg, '[data-aide-cherche]')) >= 44, `${T} ${cle} : pause et champ ≥ 44 px`);
          await tap(pg, '[data-aide-animation-bouton]');
          const p1 = await pg.locator('[data-aide-animation]').getAttribute('data-aide-animation-scene');
          await pg.waitForTimeout(1200);
          dit((await pg.locator('[data-aide-animation]').getAttribute('data-aide-animation-pause')) === '1' && (await pg.locator('[data-aide-animation]').getAttribute('data-aide-animation-scene')) === p1, `${T} ${cle} : la pause arrête l’animation`);
          dit((await deborde(pg)) <= 1, `${T} ${cle} : aucun débordement horizontal`);
          dit(errs.length === 0, `${T} ${cle} : aucune erreur de page`, errs.join(' | ').slice(0, 160));
          await ctx.close();
        });

        // ── Dans la feuille : « imprimer bordereau » ⇒ M'y emmener ⇒ Colis ─────
        await essaie(`${T} feuille → colis`, async () => {
          const { ctx, pg, errs, ecrits } = await preparer(b, vp, sombre);
          await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
          await pg.locator('[data-aide-ouvrir="journee"]').first().waitFor({ timeout: 20000 });
          await tap(pg, '[data-aide-ouvrir="journee"]');
          await pg.locator('[data-aide-champ]').first().waitFor({ timeout: 5000 });
          await pg.locator('[data-aide-champ]').first().fill('imprimer bordreau');
          await pg.locator('[data-aide-liste="recherche"]').first().waitFor({ timeout: 3000 });
          const premiere = await pg.locator('[data-aide-fiches] [data-aide-fiche]').first().getAttribute('data-aide-fiche');
          dit(premiere === 'colis-bordereau', `${T} « imprimer bordreau » (faute comprise) ⇒ « Imprimer un bordereau »`, premiere);
          dit((await pg.locator('[data-aide-fiche="colis-bordereau"][open]').count()) === 1, `${T} la fiche trouvée est dépliée`);
          await capture(pg, `aide-recherche-${suffixe}`);
          await tap(pg, '[data-aide-emmener="colis-bordereau"]');
          await pg.locator('[data-aide-feuille]').first().waitFor({ state: 'detached', timeout: 5000 });
          await pg.locator('[data-aide-ouvrir="colis"]').first().waitFor({ timeout: 15000 });
          dit(true, `${T} « M’y emmener » ferme la feuille et ouvre Colis`);
          dit(ecritsUtiles(ecrits).length === 0, `${T} rien n’est écrit`, ecritsUtiles(ecrits).map((e) => e.id).join(','));
          dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 160));
          await ctx.close();
        });

        // ── La loupe universelle : « Comment faire » ─────────────────────────────
        await essaie(`${T} loupe`, async () => {
          const { ctx, pg, errs } = await preparer(b, vp, sombre);
          await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
          await pg.locator('[data-aide-ouvrir="journee"]').first().waitFor({ timeout: 20000 });
          const ouvrirLoupe = async () => {
            if (vp.width < 600) { const l = pg.locator('[data-recherche-loupe]').first(); if (await l.count() && !(await pg.locator('[data-recherche-champ]:visible').count())) await l.tap(); }
            await pg.locator('[data-recherche-champ]:visible').first().waitFor({ timeout: 5000 });
            await pg.locator('[data-recherche-champ]:visible').first().click();
          };
          await ouvrirLoupe();
          await pg.locator('[data-recherche-champ]:visible').first().fill('imprimer bordereau');
          await pg.locator('[data-recherche-aide-fiche="colis-bordereau"]').first().waitFor({ timeout: 6000 });
          const ordre = await pg.evaluate(() => [...document.querySelectorAll('[data-recherche-groupe="aide"] [data-recherche-aide-fiche]')].map((e) => e.dataset.rechercheAideFiche));
          dit(ordre[0] === 'colis-bordereau' && ordre.length <= 3, `${T} loupe : « Comment faire » ⇒ « Imprimer un bordereau » en tête`, ordre.join(','));
          await capture(pg, `loupe-aide-${suffixe}`);
          await tap(pg, '[data-recherche-aide-fiche="colis-bordereau"]');
          await pg.locator('[data-aide-fiche="colis-bordereau"][open]').first().waitFor({ timeout: 5000 });
          dit((await pg.locator('[data-aide-feuille="colis"]').count()) === 1, `${T} loupe : la feuille d’aide de Colis, la fiche dépliée`);
          await tap(pg, '[data-aide-emmener="colis-bordereau"]');
          await pg.locator('[data-aide-ouvrir="colis"]').first().waitFor({ timeout: 15000 });
          dit((await pg.locator('[data-aide-feuille]').count()) === 0, `${T} loupe : « M’y emmener » ⇒ Colis`);
          // « vacances » ⇒ Réglages, le panneau ouvert
          await ouvrirLoupe();
          await pg.locator('[data-recherche-champ]:visible').first().fill('vacances');
          await pg.locator('[data-recherche-aide-fiche="reglages-vacances"]').first().waitFor({ timeout: 6000 });
          await tap(pg, '[data-recherche-aide-fiche="reglages-vacances"]');
          await tap(pg, '[data-aide-emmener="reglages-vacances"]');
          await pg.locator('[data-sous-ecran-ouvert="vacances"]').first().waitFor({ timeout: 15000 });
          dit(true, `${T} loupe : « vacances » ⇒ Réglages, « Mode vacances » ouvert`);
          await capture(pg, `aide-vacances-${suffixe}`);
          dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 160));
          await ctx.close();
        });
      }
    }

    // ── Réduire les animations · vendeur « autre » (une fois) ──────────────────
    await essaie('réduit + autre', async () => {
      const vp = { width: 390, height: 844 };
      const { ctx, pg, errs } = await preparer(b, vp, false, { reduit: true, vend: 'autre' });
      await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
      await pg.locator('[data-aide-ouvrir="garage"]').first().waitFor({ timeout: 20000 });
      await pg.locator('[data-aide-ouvrir="garage"]').first().tap();
      await pg.locator('[data-aide-animation]').first().waitFor({ timeout: 5000 });
      dit((await pg.locator('[data-aide-animation]').getAttribute('data-aide-animation-scene')) === 'immobile' && (await pg.locator('[data-aa-doigt]').count()) === 0 && (await pg.locator('.vrm-aa-repere').count()) >= 3, '« réduire les animations » : immobile, chaque cible numérotée');
      const texte = await pg.locator('[data-aide-feuille]').first().innerText();
      dit(!/\bpaires?\b|chaussure/i.test(texte) && /article/.test(texte), 'vendeur « autre » : « article », jamais « paire »', (texte.match(/.{0,30}paire.{0,30}/i) || [''])[0]);
      await capture(pg, 'aide-garage-autre-reduit-390');
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });
  } catch (e) { dit(false, 'banc', e && e.message); } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ ${ko} KO` : '\n✅ tout est vert');
  process.exit(ko ? 1 : 0);
}
main();
