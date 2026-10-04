// Banc : LE STOCK EN 3D À LA SOURIS (4 octobre).
//
// Julien : « améliore le stock en 3D pour que ce soit facile à la souris, mets-toi
// à la place de l'utilisateur ». Sur une pièce INVENTÉE (il vit dans le dépôt :
// une pile de cartons, une grille de cases), rendu dans un vrai Chromium (WebGL
// logiciel), il exige :
//   · le SURVOL dit ce qu'on vise : curseur « main » sur un carton, « attraper »
//     dans le vide, et une bulle qui nomme le N° (une donnée, jamais devinée) ;
//   · un clic DROIT sur un carton d'une pile choisie n'ouvre PAS la saisie qui
//     le retire (c'est le début d'un déplacement de vue) — le clic gauche, si ;
//   · le meuble choisi et le carton CHERCHÉ sont surlignés (le surlignage ne
//     touchait jamais les cartons : leur matériau est un tableau) — et c'est le
//     CARTON précis qui l'est, pas toute la pile ;
//   · la molette avance VRAIMENT (5 crans ⇒ au moins 40 % plus près) et vers le
//     point visé (il reste sous le curseur) ;
//   · ← → tournent la vue (aucune touche ne faisait rien) ;
//   · un double-clic sur une case met en face sans ouvrir la case ;
//   · aucune erreur.
// ⚠️ WebGL logiciel = lent : on juge des ÉTATS finaux (la sonde `data-cam-*`
//    posée par l'app), jamais des durées.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4343;

const PLAN = { rooms: [{ id: 'r1', name: 'Garage test', room: { w: 8, h: 6, wallH: 3 }, items: [
  { id: 'p1', type: 'pile', name: 'Pile test', x: 1, y: 2, w: 0.5, h: 0.5, rows: 4, cell: 0.5, nums: ['201', '202', '203', '204', '205'] },
  { id: 'g1', type: 'grille', name: 'Grille test', x: 4, y: 0, w: 2, h: 0.5, rows: 3, cols: 4, cell: 0.5, slots: { '0_0': ['301'], '2_3': ['302'] } },
] }], active: 'r1' };

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, String(e && e.message || e).slice(0, 140)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_garage_view', '"plan"'); } catch (_) {} });
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
    await pg.route('**/rest/v1/**', (route) => {
      const u = decodeURIComponent(metaVersData(route.request().url()));
      const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
      if (route.request().method() !== 'GET') return j([]);
      if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
      if (/id=eq\.vrm_room&/.test(u)) return j([{ data: PLAN }]);
      return j([]);
    });
    await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
    await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
    const pret = await pg.waitForFunction(() => { const e = document.querySelector('[data-stock3d]'); return e && e.dataset.camDist && document.querySelector('[data-stock3d] canvas'); }, null, { timeout: 30000 }).then(() => true).catch(() => false);
    dit(pret, 'la 3D se monte (et la sonde de caméra répond)');
    if (!pret) throw new Error('3D absente');
    await pg.waitForTimeout(1500);
    const sonde = (fn, ...a) => pg.evaluate(([fn, a]) => { const el = document.querySelector('[data-stock3d] > div'); return el && el.__vrmProbe ? el.__vrmProbe[fn](...a) : null; }, [fn, a]);
    const etat = () => pg.evaluate(() => { const e = document.querySelector('[data-stock3d]'); const c = e && e.querySelector('canvas'); const bu = e && e.querySelector('[data-bulle-3d]');
      return { dist: e ? Number(e.dataset.camDist) : NaN, az: e ? Number(e.dataset.camAz) : NaN, hover: e ? e.dataset.hover || '' : '', cur: c ? getComputedStyle(c).cursor : '', bulle: bu && bu.style.display !== 'none' ? bu.textContent : '' }; });
    const dialogue = (re) => pg.evaluate((src) => new RegExp(src).test(document.body.innerText), re.source);
    const fermer = async () => { await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); for (const t of ['Annuler', 'Fermer']) { const bt = await pg.$(`button:has-text("${t}")`); if (bt) { try { await bt.click({ timeout: 1000 }); } catch (_) {} } } await pg.waitForTimeout(300); };

    // ── 1. LE SURVOL ─────────────────────────────────────────────────────────
    await essaie('survol', async () => {
      // ⚠️ La grille range ses cartons par « gravité » : la case 0_0 de la donnée
      //    n'est pas forcément celle qui porte le carton à l'écran. On vise donc un
      //    carton de la PILE, dont le rang est sûr (et la bulle doit le nommer).
      const p = await sonde('project', 'p1', { pileIdx: 1 });
      if (!p) throw new Error('carton introuvable à l’écran');
      await pg.mouse.move(p.x - 8, p.y - 8); await pg.mouse.move(p.x, p.y, { steps: 3 }); await pg.waitForTimeout(500);
      const e = await etat();
      dit(e.hover.startsWith('p1|'), 'au survol, le carton visé est reconnu', e.hover);
      dit(e.cur === 'pointer', 'le curseur devient une main sur un carton', e.cur);
      dit(/N°20\d/.test(e.bulle), 'une bulle nomme le N° du carton visé (donnée, pas une supposition)', e.bulle);
      const g = await sonde('project', 'g1', {});
      await pg.mouse.move(g.x, g.y, { steps: 3 }); await pg.waitForTimeout(500);
      const eg = await etat();
      dit(/Grille test/.test(eg.bulle) && !/N°\d/.test(eg.bulle.replace(/N°30[12]/, '')), 'sur la grille, la bulle nomme le meuble — et n’invente aucun numéro', eg.bulle);
      const box = await pg.$eval('[data-stock3d] canvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.right - 30, y: r.top + 70 }; });
      await pg.mouse.move(box.x, box.y, { steps: 3 }); await pg.waitForTimeout(500);
      const v = await etat();
      dit(v.cur === 'grab' && !v.bulle, 'dans le vide : curseur « attraper », plus de bulle', `${v.cur} « ${v.bulle} »`);
    });

    // ── 2. CLIC DROIT : JAMAIS LA SAISIE QUI RETIRE UN CARTON ────────────────
    await essaie('clic droit', async () => {
      const p = await sonde('project', 'p1', { pileIdx: 0 });
      await pg.mouse.click(p.x, p.y); await pg.waitForTimeout(700);          // 1er clic : choisit la pile
      dit(!!(await sonde('contour', 'sel')), 'la pile choisie est SURLIGNÉE (elle ne l’était jamais : matériau en tableau)');
      await pg.mouse.click(p.x, p.y, { button: 'right' }); await pg.waitForTimeout(700);
      dit(!(await dialogue(/Numéro de cette boîte/)), 'un clic DROIT sur un carton de la pile n’ouvre PAS la saisie qui le retire');
      // (pas d'Échap ici : sur la 3D, Échap DÉSÉLECTIONNE — c'est voulu.)
      await pg.mouse.click(p.x, p.y); await pg.waitForTimeout(800);
      dit(await dialogue(/Numéro de cette boîte/), 'le clic GAUCHE, lui, l’ouvre toujours (rien de perdu)');
      await fermer();
    });

    // ── 3. LA RECHERCHE SURLIGNE LE CARTON, PAS TOUTE LA PILE ────────────────
    await essaie('recherche', async () => {
      await pg.fill('input[placeholder^="Cherche un N° → le meuble"]', '203'); await pg.waitForTimeout(1500);
      const hi = await sonde('contour', 'hi'), sel = await sonde('contour', 'sel');
      dit(!!hi && hi.sy < 0.7, 'le N° cherché est surligné sur SON carton (hauteur ≈ une boîte)', hi ? `hauteur ${hi.sy.toFixed(2)} m` : 'aucun contour');
      dit(!!hi && !!sel && sel.sy > hi.sy * 1.5, 'et pas sur toute la pile', sel && hi ? `pile ${sel.sy.toFixed(2)} m / carton ${hi.sy.toFixed(2)} m` : '');
      await pg.fill('input[placeholder^="Cherche un N° → le meuble"]', ''); await pg.waitForTimeout(400);
    });

    // ── 4. LA MOLETTE : PLUS VITE, ET VERS LE POINT VISÉ ─────────────────────
    await essaie('molette', async () => {
      const home = await pg.$('[data-stock3d] button[aria-label="Voir toute la pièce"]'); if (home) await home.click(); await pg.waitForTimeout(1200);
      const p = await sonde('project', 'g1', { cell: '0_0' });
      await pg.mouse.move(p.x, p.y); await pg.waitForTimeout(300);
      const d0 = (await etat()).dist;
      for (let i = 0; i < 5; i++) { await pg.mouse.wheel(0, -100); await pg.waitForTimeout(120); }
      await pg.waitForTimeout(1500);
      const e = await etat();
      dit(e.dist <= d0 * 0.6, '5 crans de molette rapprochent d’au moins 40 %', `${d0.toFixed(1)} → ${e.dist.toFixed(1)} m`);
      await pg.mouse.move(p.x + 1, p.y + 1); await pg.waitForTimeout(500);
      dit((await etat()).hover.startsWith('g1|'), 'le meuble visé reste sous le curseur après le zoom', (await etat()).hover || 'plus rien sous le curseur');
    });

    // ── 5. LE CLAVIER : ← → TOURNENT, ET NE QUITTENT PAS L'ÉCRAN ────────────
    await essaie('clavier', async () => {
      const box = await pg.$eval('[data-stock3d] canvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.right - 30, y: r.top + 70 }; });
      await pg.mouse.click(box.x, box.y); await pg.waitForTimeout(400);
      const a0 = (await etat()).az;
      await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(250); await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(800);
      // ⚠️ Pas de contrôle « ← ne quitte pas l'écran » : le Stock n'est pas dans
      //    les onglets du bas, ← ne l'a jamais quitté — un tel contrôle ne
      //    pourrait pas échouer (prouvé en retirant la garde : il restait vert).
      const a1 = (await etat()).az;
      dit(Math.abs(((a1 - a0 + 540) % 360) - 180) >= 15, '← tourne la vue (avant : aucune touche ne faisait rien)', `${a0}° → ${a1}°`);
    });

    // ── 6. DOUBLE-CLIC : EN FACE, SANS OUVRIR LA CASE ────────────────────────
    await essaie('double-clic', async () => {
      if (!(await pg.$('[data-stock3d]'))) throw new Error('écran quitté');
      const home = await pg.$('[data-stock3d] button[aria-label="Voir toute la pièce"]'); if (home) await home.click(); await pg.waitForTimeout(1200);
      let p = await sonde('project', 'g1', { cell: '2_3' });
      await pg.mouse.click(p.x, p.y); await pg.waitForTimeout(700);          // choisit la grille
      p = await sonde('project', 'g1', { cell: '2_3' });
      const d0 = (await etat()).dist;
      await pg.mouse.dblclick(p.x, p.y); await pg.waitForTimeout(2500);
      dit(!(await dialogue(/N° de la boîte \(laisse vide/)) && !(await dialogue(/Ranger une paire/)), 'un double-clic n’ouvre pas la case');
      const d1 = (await etat()).dist;
      dit(d1 < d0 * 0.6 && d1 > 1, 'il se met EN FACE de la case (la caméra s’approche)', `${d0.toFixed(1)} → ${d1.toFixed(1)} m`);
      await fermer();
    });

    await pg.screenshot({ path: path.join(require('os').tmpdir(), 'garage3d-1512.png') });
    dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 200));
    await ctx.close();
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ stock 3D à la souris : ${ko} rouge(s)` : '\n✅ stock 3D à la souris : tout est vert');
  process.exit(ko ? 1 : 0);
})();
