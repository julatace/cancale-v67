// ═══════════════════════════════════════════════════════════════════════════
// BANC : LA RECHERCHE EN PLACE (31 octobre)
//        (node scripts/bancs/recherche-en-place.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « quand on appuie sur la barre de recherche, ça fait un grand écran
// blanc ; je veux que ça reste sur la page et que ça permette juste d'écrire ».
// Deux tailles (390 px tactile, 1512 px), données INVENTÉES. On exige :
//   A. toucher la barre (ordinateur) / la loupe (téléphone) met le FOCUS dans un
//      champ de saisie, sans changer d'écran ;
//   B. aucun écran plein : rien de fixe ne couvre ≥ 85 % de la fenêtre, et le
//      contenu derrière (le titre de l'écran) reste visible, À SA PLACE
//      (défilement de la page inchangé) ;
//   C. les résultats arrivent À LA FRAPPE (une marque ⇒ des lignes ; un N° ⇒
//      le bloc « Tout sur le N° », par identité) ;
//   D. Échap ferme le panneau ; la page n'a pas bougé ;
//   E. un toucher dehors ferme le panneau (téléphone : « Fermer ») ;
// ⚠️ (3 nov., recherche unique, demande « au téléphone : plein écran ») : au
//    TÉLÉPHONE, dès qu'il tape, les résultats prennent tout l'écran sous l'en-tête
//    (champ vide : rien ne s'ouvre, jamais le grand écran blanc du 31 oct.) ; B et
//    E le jugent à cette règle au téléphone, inchangés sur ordinateur.
//   F. les lignes du panneau font ≥ 44 px ; aucun débordement ; aucune erreur.
// BANC_MUTATION=plein : le panneau redevient un écran plein (CSS) ⇒ B doit rougir.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 8432;
const MUT = process.env.BANC_MUTATION || '';
const SHOTS = process.env.SHOTS || os.tmpdir();

const IL_Y_A = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: IL_Y_A(1), created_at: '2026-07-01T00:00:00Z' }];
const FICHES = {
  5128: { numero: '128', title: 'Nike Air Max 1 noir taille 42', numberedAt: '2026-10-12T10:00:00Z' },
  5040: { numero: '40', title: 'Adidas Spezial noir taille 35,5', numberedAt: '2026-10-12T10:00:00Z' },
  5041: { numero: '41', title: 'Adidas Samba blanc taille 40', numberedAt: '2026-10-13T10:00:00Z' },
};
const item = (id, title) => ({ id: Number(id), title, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: Math.floor(Date.parse('2026-10-12T10:00:00Z') / 1000) });
const LISTINGS = Object.entries(FICHES).map(([id, f]) => item(id, f.title));
const VENTES = [{ transaction_id: 9040, title: FICHES[5040].title, status: 'Commande finalisée', price: { amount: '60.0', currency_code: 'EUR' }, date: IL_Y_A(100) }];
const MAIN = { vinted_annonce_numeros: FICHES, vinted_used_numeros: [40, 41, 128], vrm_numerotation: { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z', appliqueLe: '2026-10-11T14:58:07Z' } };
const ROWS = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: IL_Y_A(0.2), payload: { items: LISTINGS, pagination: { total_entries: LISTINGS.length } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: IL_Y_A(0.2), payload: { my_orders: VENTES } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
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
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};

async function rendre(b, vp) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data$/.test(sel) && sel !== 'data') ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || IL_Y_A(1), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);
  if (MUT === 'plein') await pg.addStyleTag({ content: '.vrm-global-search{position:fixed!important;inset:0!important;width:auto!important;max-height:none!important;top:0!important;z-index:999!important}' });
  return { ctx, pg, errs };
}

// L'état de la page : l'écran, son titre, le défilement, le focus, et toute
// couche fixe qui couvrirait la fenêtre.
const etat = (pg) => pg.evaluate(() => {
  const main = document.querySelector('.vrm-main');
  const h1 = document.querySelector('.vrm-main h1');
  const ae = document.activeElement;
  const W = innerWidth, H = innerHeight;
  const couvrants = [...document.querySelectorAll('body *')].filter((e) => {
    const cs = getComputedStyle(e); if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = e.getBoundingClientRect(); return r.width * r.height >= 0.85 * W * H && parseFloat(cs.opacity || '1') > 0.05 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
  }).map((e) => e.className && String(e.className).slice(0, 60));
  const pan = document.querySelector('[data-recherche-panneau]');
  const pr = pan ? pan.getBoundingClientRect() : null;
  // Un point du contenu hors du panneau : ce qu'on y voit doit être la page.
  let derriere = null;
  if (h1) { const r = h1.getBoundingClientRect(); const x = Math.min(W - 4, Math.max(4, r.left + 6)); const y = Math.min(H - 4, Math.max(4, r.top + r.height / 2)); const el = document.elementFromPoint(x, y); derriere = el ? (h1.contains(el) || el === h1 ? 'titre' : (el.closest('[data-recherche-panneau]') ? 'panneau' : (el.className && String(el.className).slice(0, 40)) || el.tagName)) : null; }
  return {
    tab: (h1 && h1.textContent || '').trim(), defile: main ? Math.round(main.scrollTop) : null,
    champ: !!(ae && ae.matches && ae.matches('input[data-recherche-champ]')), saisie: ae && ae.tagName,
    panneau: !!pan, pH: pr ? Math.round(pr.height) : 0, pTop: pr ? Math.round(pr.top) : 0,
    couvrants, derriere,
    lignes: pan ? [...pan.querySelectorAll('button')].filter((x) => x.getClientRects().length).map((x) => ({ h: x.getBoundingClientRect().height, t: x.textContent.slice(0, 30) })) : [],
    tout: !!document.querySelector('[data-recherche-panneau] [data-tout-num]'),
    paires: pan ? pan.querySelectorAll('button').length : 0,
    txt: pan ? pan.innerText.slice(0, 400) : '',
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
});

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = `[${vp.width}]`; const tel = vp.width < 600;
      console.log(`── ${vp.width} px`);
      const { ctx, pg, errs } = await rendre(b, vp);
      await essaie('A-F', async () => {
        await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 120; });
        await pg.waitForTimeout(300);
        const e0 = await etat(pg);
        // A. ouvrir
        // Ordinateur : la touche « / » depuis le bas de la page (la barre reste
        // en haut), puis le clic dans la barre ; téléphone : la loupe.
        if (tel) await pg.locator('button[data-recherche-loupe]').first().tap();
        else await pg.keyboard.press('/');
        await pg.waitForTimeout(400);
        const e1 = await etat(pg);
        if (!tel) dit(e1.pTop > 0 && e1.pTop < vp.height * 0.5, `${T} A : la touche « / » ouvre le panneau DANS la fenêtre, page défilée`, String(e1.pTop));
        dit(e1.champ, `${T} A : le focus est dans un champ de saisie (le clavier peut monter)`, String(e1.saisie));
        dit(e1.tab === e0.tab && e0.tab !== '', `${T} A : l'écran n'a pas changé`, `${e0.tab} → ${e1.tab}`);
        // C. à la frappe
        await pg.keyboard.type('adid', { delay: 40 });
        await pg.waitForTimeout(500);
        const e2 = await etat(pg);
        dit(e2.panneau && /Adidas/.test(e2.txt), `${T} C : « adid » ⇒ les paires Adidas, à la frappe`, e2.txt.slice(0, 120).replace(/\n/g, ' · '));
        dit(!/Nike Air Max/.test(e2.txt), `${T} C : et pas la Nike`, '');
        // B. pas d'écran plein, contenu derrière
        if (!tel) dit(e2.couvrants.length === 0, `${T} B : aucune couche fixe ne couvre la fenêtre`, e2.couvrants.join(' | '));
        if (!tel) dit(e2.pH > 0 && e2.pH < vp.height * 0.8, `${T} B : le panneau est un déroulant (${e2.pH} px sur ${vp.height})`, String(e2.pH));
        else dit(e2.pH >= vp.height * 0.85, `${T} B : au téléphone, les résultats prennent l'écran sous l'en-tête (${e2.pH} px sur ${vp.height})`, String(e2.pH));
        dit(e2.defile === e0.defile, `${T} B : la page derrière n'a pas bougé (défilement ${e0.defile} → ${e2.defile})`);
        await pg.locator('[data-recherche-champ]').fill('');
        await pg.keyboard.type('128', { delay: 40 });
        for (let i = 0; i < 30; i++) { if ((await etat(pg)).tout) break; await pg.waitForTimeout(200); }
        const e3 = await etat(pg);
        dit(e3.tout, `${T} C : « 128 » ⇒ « Tout sur le N° » dans le panneau`);
        dit(e3.lignes.every((l) => l.h >= 43.5), `${T} F : lignes du panneau ≥ 44 px`, e3.lignes.filter((l) => l.h < 43.5).map((l) => l.t + ':' + Math.round(l.h)).join(' | '));
        dit(e3.sw <= e3.cw + 1, `${T} F : aucun débordement horizontal`, `${e3.sw} > ${e3.cw}`);
        await pg.screenshot({ path: path.join(SHOTS, `recherche-en-place-${vp.width}.png`) });
        // D. Échap
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
        const e4 = await etat(pg);
        dit(!e4.panneau, `${T} D : Échap ferme le panneau`);
        dit(e4.tab === e0.tab && e4.defile === e0.defile, `${T} D : même écran, même place`, `${e4.tab} · ${e4.defile}`);
        // E. dehors
        if (tel) await pg.locator('button[data-recherche-loupe]').first().tap(); else await pg.locator('[data-barre-recherche]').first().click();
        await pg.keyboard.type('nike', { delay: 30 }); await pg.waitForTimeout(400);
        const e5 = await etat(pg);
        dit(e5.panneau, `${T} E : rouvert`);
        const pt = tel ? { x: 20, y: vp.height - 120 } : { x: vp.width - 120, y: vp.height - 60 };
        if (tel) await pg.locator('button[aria-label="Fermer la recherche"]').first().tap(); else await pg.mouse.click(pt.x, pt.y);
        await pg.waitForTimeout(400);
        const e6 = await etat(pg);
        dit(!e6.panneau, `${T} E : ${tel ? '« Fermer »' : 'un toucher dehors'} ferme le panneau`);
      });
      dit(errs.length === 0, `${T} F : aucune erreur de page`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ recherche en place : ${ko} rouge(s)` : '\n✅ recherche en place : tout est vert');
  process.exit(ko ? 1 : 0);
})();
