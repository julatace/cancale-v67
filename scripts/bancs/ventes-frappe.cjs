// ════════════════════════════════════════════════════════════════════════════
//  VENTES — UNE FRAPPE DANS LA RECHERCHE, SUR TÉLÉPHONE (16 octobre)
//
//  Mesuré : chaque lettre tapée dans « Rechercher » de l'écran Ventes recréait
//  les 60 lignes DEUX fois — au rendu urgent (le champ) ET au rendu différé
//  (la liste filtrée, `useDeferredValue`) : 200 à 300 ms par lettre sur un
//  téléphone (processeur ralenti ×4).
//
//  Base INVENTÉE au volume de la sienne (`_base-volume.cjs`, aucune donnée
//  réelle : ce banc vit dans le dépôt). 390 px tactile, processeur ×4.
//  Il juge :
//    1. le travail du PROCESSEUR jusqu'à l'image peinte (deux rAF), médiane de
//       21 lettres (3 × « salomon ») — mesuré en temps de fil (`threadTicks`),
//       pas à l'horloge : la machine des bancs est partagée (charge 40 à 50 le
//       16 octobre), l'horloge y variait du simple au décuple. L'horloge est
//       imprimée à côté ;
//    2. combien de lignes de vente React a RECRÉÉES au rendu urgent de chaque
//       frappe (compté par le crochet des outils de développement de React,
//       que la version de production appelle aussi : aucune instrumentation
//       dans l'app, donc le même compte sur le build d'avant) ;
//    3. que le texte rendu est EXACTEMENT celui d'une page ouverte à froid avec
//       la même recherche (une ligne figée par la mémoïsation se verrait ici),
//       que vider la recherche rend tout l'écran d'origine, que « Voir plus »
//       ouvre la suite sans changer le reste de l'écran.
//  `VENTES_TEXTES=dossier` écrit les textes rendus ; `VENTES_REFERENCE=dossier`
//  exige qu'ils soient identiques à ceux d'un autre build (avant/après).
//
//  Lancer : npm run build && PORT=4961 node scripts/bancs/ventes-frappe.cjs
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { fabriquer, repondre } = require('./_base-volume.cjs');
// ⚠️ Jamais un chemin absolu (§6.1) : le dist se déduit de l'emplacement du banc.
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4961;
const CPU = Number(process.env.VENTES_CPU || 4);
const TEXTES = process.env.VENTES_TEXTES || '';
const REFERENCE = process.env.VENTES_REFERENCE || ''; // textes écrits par un autre build : ils doivent être identiques
const MOT = 'salomon';
// ⚠️ PLANCHERS. Mesurés le 16 octobre sur cette base, ×4 : voir CLAUDE.md
// (« App plus rapide »). Le temps varie sur une machine partagée : le plancher
// est large ; le compte des lignes recréées, lui, ne dépend pas de la machine.
const CPU_IMAGE_MED_MS = 90;   // processeur jusqu'à l'image, médiane de 21 lettres (avant : 145 ms)
const LIGNES_URGENT_MAX = 0;   // lignes recréées par le rendu urgent d'une frappe

const base = fabriquer();
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

// Le crochet des outils de développement : React (production comprise)
// l'appelle à chaque commit. On compte les lignes `vrm-sale-row` RECRÉÉES
// (nouvel objet de props = l'élément a été refabriqué par son propriétaire),
// en sautant les sous-arbres que React n'a pas touchés (`child` identique à
// celui du commit d'avant : bailout) — comme le font les outils eux-mêmes.
function crochet() {
  const compte = { actif: false, commits: [] };
  window.__vrmCompteLignes = compte;
  const visiter = (f, n) => {
    for (let x = f; x; x = x.sibling) {
      const p = x.memoizedProps;
      if (typeof x.type === 'string' && p && typeof p.className === 'string' && /(^| )vrm-sale-row( |$)/.test(p.className)) {
        if (!x.alternate || x.alternate.memoizedProps !== p) n.lignes++;
        n.vues++;
      }
      if (x.child && !(x.alternate && x.alternate.child === x.child)) visiter(x.child, n);
    }
  };
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, isDisabled: false, renderers: new Map(),
    inject(r) { const id = this.renderers.size + 1; this.renderers.set(id, r); return id; },
    checkDCE() {}, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      if (!compte.actif) return;
      const n = { lignes: 0, vues: 0 };
      try { visiter(root.current.child, n); } catch (_) {}
      compte.commits.push(n);
    },
  };
}

async function ouvrir(b, recherche) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.addInitScript(crochet);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request();
    if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const h = await rq.allHeaders();
    const rep = repondre(rq.url(), h.range, base);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body: JSON.stringify(rep.body) });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelectorAll('.vrm-sale-row').length >= 60 || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 60000, polling: 100 });
  // Le calme : la liste ne bouge plus pendant 3 s (données qui arrivent encore).
  let avant = '';
  for (let i = 0; i < 60; i++) {
    const t = await pg.evaluate(() => (document.querySelector('.vrm-ventes-liste') || {}).innerText || '');
    if (t === avant && i > 5) break; avant = t; await pg.waitForTimeout(500);
  }
  if (recherche) await taper(pg, recherche, 0);
  const cdp = await ctx.newCDPSession(pg);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  // Le temps PROCESSEUR du fil principal (« threadTicks ») : il ne compte que
  // le travail de la page, pas l'attente quand la machine des bancs est
  // partagée (charge 40 à 50 mesurée le 16 octobre : le temps d'horloge y
  // variait du simple au décuple d'un passage à l'autre).
  await cdp.send('Performance.enable', { timeDomain: 'threadTicks' });
  return { ctx, pg, errs, cdp };
}

const SEL = 'input[aria-label="Rechercher dans les ventes Vinted"]';
async function taper(pg, mot, pause) {
  return pg.evaluate(async ({ sel, mot, pause }) => {
    const i = document.querySelector(sel); if (!i) return null;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const peint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const t = [];
    let v = '';
    for (const c of mot) {
      v += c; const t0 = performance.now();
      set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true }));
      await peint(); t.push(Math.round(performance.now() - t0));
      if (pause) await new Promise((r) => setTimeout(r, pause));
    }
    return t;
  }, { sel: SEL, mot, pause });
}
async function vider(pg) {
  await pg.evaluate((sel) => { const i = document.querySelector(sel); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); }, SEL);
}
// Le calme : rien ne bouge à l'écran pendant 2 s (cinq lectures identiques).
// ⚠️ Deux lectures à 300 ms ne suffisaient pas : sur un téléphone ×4, le rendu
// différé d'une recherche vidée arrive ~1 s après la frappe, et le banc
// comparait la liste d'AVANT à elle-même.
async function calme(pg) {
  let avant = null, pareil = 0;
  for (let i = 0; i < 80; i++) {
    await pg.waitForTimeout(400);
    const t = await lire(pg);
    if (avant && JSON.stringify(t) === JSON.stringify(avant)) { if (++pareil >= 5) return t; } else pareil = 0;
    avant = t;
  }
  return avant;
}
const lire = (pg) => pg.evaluate(() => {
  const L = document.querySelector('.vrm-ventes-liste');
  const b = [...document.querySelectorAll('button')].find((x) => /Voir plus/.test(x.textContent));
  // Tout l'écran hors de la liste (en-tête, totaux, filtres, analyse) : il ne
  // doit pas dépendre de la façon dont la recherche a été tapée.
  // ⚠️ Sauf la phrase des photos (`data-photos-bloquees`) : le banc coupe les
  // images, et elle apparaît au bout de quelques secondes quel que soit l'écran
  // — elle dit le temps écoulé, pas la recherche.
  let corps = (document.body.innerText || '').replace(L ? L.innerText : '', '\u2063LISTE\u2063');
  for (const x of document.querySelectorAll('[data-photos-bloquees]')) corps = corps.replace(x.innerText, '');
  corps = corps.replace(/\n{2,}/g, '\n');
  return { liste: L ? L.innerText : null, lignes: document.querySelectorAll('.vrm-sale-row').length,
    voirPlus: b ? b.textContent.trim() : null, corps,
    tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText) };
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    console.log(`\n── Ventes · 390 px tactile · processeur ×${CPU} · « ${MOT} »`);
    // A. La page, puis les frappes.
    const A = await ouvrir(b, '');
    const t0 = await lire(A.pg);
    dit(!t0.tombe && t0.lignes >= 60, "l'écran Ventes s'affiche avec sa liste", `${t0.lignes} lignes · ${t0.voirPlus || 'pas de « Voir plus »'}`);
    // 1) Le temps, compteur éteint (le parcours de l'arbre coûterait lui-même).
    const t = [], cpuImage = [], cpuTout = [];
    const travail = async () => (await A.cdp.send('Performance.getMetrics')).metrics.find((x) => x.name === 'TaskDuration').value * 1000;
    for (let k = 0; k < 3; k++) {
      let v = '';
      for (const c of MOT) {
        v += c;
        const w0 = await travail();
        const ms = await A.pg.evaluate(({ sel, v }) => new Promise((ok) => {
          const i = document.querySelector(sel); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          const t0 = performance.now(); set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true }));
          requestAnimationFrame(() => requestAnimationFrame(() => ok(Math.round(performance.now() - t0))));
        }), { sel: SEL, v });
        const w1 = await travail();
        await A.pg.waitForTimeout(900);
        const w2 = await travail();
        t.push(ms); cpuImage.push(Math.round(w1 - w0)); cpuTout.push(Math.round(w2 - w0));
      }
      await calme(A.pg); if (k < 2) { await vider(A.pg); await calme(A.pg); }
    }
    const median = (l) => { const x = [...l].sort((a, b) => a - b); return x.length ? x[Math.floor(x.length / 2)] : Infinity; };
    const somme = (l) => l.reduce((a, x) => a + x, 0);
    console.log(`     horloge jusqu'à l'image : ${t.join(' · ')} ms (médiane ${median(t)})`);
    console.log(`     processeur jusqu'à l'image : ${cpuImage.join(' · ')} ms (médiane ${median(cpuImage)})`);
    console.log(`     processeur par lettre, tout compris (0,9 s) : ${cpuTout.join(' · ')} ms (médiane ${median(cpuTout)}, total ${somme(cpuTout)})`);
    const tA = await calme(A.pg);
    dit(median(cpuImage) <= CPU_IMAGE_MED_MS, `une lettre tapée coûte ${CPU_IMAGE_MED_MS} ms de processeur (médiane) au plus avant d'être peinte`, `médiane ${median(cpuImage)} ms · horloge ${median(t)} ms`);
    // 2) Le compte des lignes recréées, frappe par frappe (après avoir vidé).
    await vider(A.pg); const tV = await calme(A.pg);
    dit(tV.liste === t0.liste && tV.voirPlus === t0.voirPlus, 'vider la recherche rend exactement la liste du départ', tV.liste === t0.liste ? '' : 'texte différent');
    await A.pg.evaluate(() => { window.__vrmCompteLignes.commits = []; window.__vrmCompteLignes.actif = true; });
    const par = [];
    for (const c of MOT.slice(0, 4)) {
      await A.pg.evaluate(() => { window.__vrmCompteLignes.commits = []; });
      await A.pg.evaluate(({ sel, c }) => { const i = document.querySelector(sel); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(i, i.value + c); i.dispatchEvent(new Event('input', { bubbles: true })); }, { sel: SEL, c });
      await A.pg.waitForTimeout(1200);
      par.push(await A.pg.evaluate(() => window.__vrmCompteLignes.commits.slice()));
    }
    await A.pg.evaluate(() => { window.__vrmCompteLignes.actif = false; });
    const crochetVu = par.some((cs) => cs.some((n) => n.vues > 0 || n.lignes > 0));
    const urgent = par.map((cs) => (cs[0] ? cs[0].lignes : null));
    const total = par.map((cs) => cs.reduce((a, n) => a + n.lignes, 0));
    console.log(`     lignes recréées par frappe — rendu urgent : ${urgent.join(' · ')} ; tous rendus : ${total.join(' · ')} (commits ${par.map((cs) => cs.length).join(' · ')})`);
    dit(crochetVu, 'le compteur voit les commits de React (sinon le contrôle suivant ne mesurerait rien)');
    dit(crochetVu && urgent.every((n) => n != null && n <= LIGNES_URGENT_MAX), `le rendu urgent d'une frappe ne recrée aucune ligne de vente`, `urgent ${urgent.join('/')}`);
    // 3) Le texte : identique à une page ouverte à froid avec la même recherche.
    await vider(A.pg); await calme(A.pg);
    await taper(A.pg, MOT, 0); const tA2 = await calme(A.pg);
    const B = await ouvrir(b, MOT);
    const tB = await calme(B.pg);
    dit(!!tA.liste && tA.liste === tB.liste && tA.voirPlus === tB.voirPlus && tA.corps === tB.corps,
      'après « salomon » tapé lettre par lettre, la liste est celle d\'une page ouverte à froid avec cette recherche',
      `${tA.lignes} vs ${tB.lignes} lignes · reste de l'écran ${tA.corps === tB.corps ? 'identique' : 'DIFFÉRENT'}`);
    dit(tA2.liste === tA.liste, 'taper vite (sans pause) donne la même liste', `${tA2.lignes} vs ${tA.lignes} lignes`);
    // 4) Les totaux du haut et « Voir plus » ne dépendent pas de la frappe.
    dit(tV.corps === t0.corps, "tout l'écran (totaux du haut compris) est le même avant et après une recherche vidée", tV.corps === t0.corps ? `${t0.corps.length} caractères` : 'DIFFÉRENT');
    await vider(A.pg); await calme(A.pg);
    await A.pg.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => /Voir plus/.test(y.textContent)); if (x) x.click(); });
    const tP = await calme(A.pg);
    const sansBouton = (c) => c.replace(/Voir plus — \d+ affichées sur \d+/, '');
    dit(tP.lignes > t0.lignes && sansBouton(tP.corps) === sansBouton(t0.corps), '« Voir plus » ouvre la suite sans changer les totaux', `${t0.lignes} → ${tP.lignes} lignes`);
    dit(!A.errs.length && !B.errs.length, 'aucune erreur de page', [...A.errs, ...B.errs].join(' | ').slice(0, 200));
    if (TEXTES) {
      fs.mkdirSync(TEXTES, { recursive: true });
      for (const [k, v] of Object.entries({ depart: t0, salomon: tA, froid: tB, vide: tV, voirplus: tP })) fs.writeFileSync(path.join(TEXTES, k + '.json'), JSON.stringify(v, null, 1));
    }
    if (REFERENCE) {
      const ecarts = Object.entries({ depart: t0, salomon: tA, froid: tB, vide: tV, voirplus: tP })
        .filter(([k, v]) => { try { return fs.readFileSync(path.join(REFERENCE, k + '.json'), 'utf8') !== JSON.stringify(v, null, 1); } catch (_) { return true; } }).map(([k]) => k);
      dit(!ecarts.length, `le texte rendu est identique à celui de l'autre build (${REFERENCE})`, ecarts.join(', '));
    }
    await A.ctx.close(); await B.ctx.close();
  } finally { await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} contrôle(s) non conforme(s).` : '\nLa recherche des ventes reste fluide sur téléphone.');
  process.exit(ko ? 1 : 0);
})();
