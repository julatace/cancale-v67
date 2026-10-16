// Banc : L'ASSISTANT DE RANGEMENT (Stock → « Ranger », vue 2D).
//
// Julien : un assistant qui l'aide à RANGER ses paires (quelle paire dans quelle
// case), avec une vue 2D simple. Sur une pièce INVENTÉE et des paires INVENTÉES
// (le banc vit dans le dépôt, aucune fixture), rendu à 390 px et à 1512 px, il
// exige :
//   · la liste « À ranger » = les paires PRÉSENTES (`vinted_nums_physiques`)
//     qui ont un N° et aucune case — ni celle déjà rangée, ni celle partie ;
//   · la PREMIÈRE case libre proposée (gravité, comme la 3D) ;
//   · AUCUNE écriture avant le clic ; un clic « Ranger ici » écrit la paire dans
//     CETTE case de `vrm_room` (écriture vérifiée), sans toucher aucun numéro ;
//   · « Autre » : seules les cases où une boîte atterrit sont cliquables ;
//   · une paire partie dont la case est occupée est proposée « à libérer », et
//     la case n'est libérée qu'après SA confirmation ;
//   · « Où est la N° X ? » surligne la bonne case, sans rien écrire ;
//   · pas su (liste des paires présentes jamais publiée, ou plan illisible) ⇒
//     aucune proposition, et c'est dit ;
//   · ni débordement horizontal, ni erreur d'app, aux deux tailles.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4747;
const CAPT = process.env.CAPTURES || os.tmpdir();

const PLAN = { rooms: [{ id: 'r1', name: 'Garage test', room: { w: 8, h: 6, wallH: 3 }, items: [
  { id: 'g1', type: 'grille', name: 'Grille A', x: 1, y: 0, w: 1, h: 0.5, rows: 3, cols: 2, cell: 0.5, slots: { '2_0': ['1'], '2_1': ['9'] } },
  { id: 'e1', type: 'etagere', name: 'Étagère B', x: 4, y: 0, w: 3, h: 1, rows: 2, cols: 2, slots: {} },
  { id: 'p1', type: 'pile', name: 'Pile C', x: 6, y: 4, w: 0.5, h: 0.5, rows: 4, cell: 0.5, nums: ['50', '51'] },
  { id: 'd1', type: 'chaise', name: 'Chaise', x: 2, y: 4, w: 0.6, h: 0.6 },
] }], active: 'r1' };
const FICHES = {
  a1: { numero: '1', title: 'Nike Air Max 90 blanc taille 42', numberedAt: 1 },
  a2: { numero: '2', title: 'Adidas Samba noir taille 40', numberedAt: 2 },
  a3: { numero: '3', title: 'Salomon XT-6 gris taille 44', numberedAt: 3 },
  a9: { numero: '9', title: 'New Balance 550 (vendue)', numberedAt: 9 },
};
const TOUS_NUMS = (plan) => { const s = []; plan.rooms.forEach(r => r.items.forEach(it => { Object.values(it.slots || {}).forEach(a => a.forEach(v => s.push(String(v)))); (it.nums || []).forEach(v => s.push(String(v))); })); return s.sort(); };

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, String(e && e.message || e).slice(0, 160)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT=…)'); process.exit(1); });
srv.listen(PORT);

// Une page de l'app, sur la pièce inventée. `opts.presents` null ⇒ la liste des
// paires présentes n'a jamais été publiée ; `opts.roomKO` ⇒ la base ne rend pas
// le plan (522 HTML, la vraie forme d'une panne).
async function ouvrir(b, largeur, opts = {}) {
  const mobile = largeur < 600;
  const ctx = await b.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecritures = [];
  const presents = opts.presents === undefined ? ['1', '2', '3'] : opts.presents;
  await pg.addInitScript(([fiches, presents]) => { try {
    localStorage.setItem('vrm_acces_direct', '1');
    localStorage.setItem('vinted_garage_view', '"ranger"');
    localStorage.setItem('vinted_annonce_numeros', JSON.stringify(fiches));
    if (presents) localStorage.setItem('vinted_nums_physiques', JSON.stringify({ nums: presents, at: Date.now() }));
  } catch (_) {} }, [FICHES, presents]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {}
      (Array.isArray(corps) ? corps : [corps]).forEach(c => { if (c && c.id === 'vrm_room') ecritures.push(c.data); });
      return j([]);
    }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/id=eq\.vrm_room&/.test(u)) {
      if (opts.roomKO) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
      return j([{ data: JSON.parse(JSON.stringify(PLAN)) }]);
    }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
  const monte = await pg.waitForSelector('[data-rangement]', { timeout: 25000 }).then(() => true).catch(() => false);
  return { ctx, pg, errs, ecritures, monte };
}
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--no-proxy-server'] });

    for (const L of [390, 1512]) {
      console.log(`\n── ${L} px ──`);
      const { ctx, pg, errs, ecritures, monte } = await ouvrir(b, L);
      dit(monte, `${L} : l'assistant de rangement s'affiche (Stock → Ranger)`);
      if (!monte) { await pg.screenshot({ path: path.join(CAPT, `rangement-${L}-absent.png`) }); await ctx.close(); continue; }
      await pg.waitForSelector('[data-rgt-liste]', { timeout: 8000 }).catch(() => {});

      // ── 1. LA LISTE « À RANGER » ET LA PREMIÈRE CASE LIBRE ────────────────
      await essaie('liste', async () => {
        const liste = await pg.$$eval('[data-a-ranger]', els => els.map(e => e.getAttribute('data-a-ranger')));
        dit(JSON.stringify(liste) === '["2","3"]', `${L} : « À ranger » propose les 2 paires présentes sans case (ni la N°1 rangée, ni la N°9 partie)`, JSON.stringify(liste));
        const pro = await pg.$eval('[data-prochaine]', e => ({ k: e.getAttribute('data-prochaine'), t: e.textContent })).catch(() => null);
        dit(!!pro && pro.k === 'g1:1_0', `${L} : la première case libre proposée est Grille A, colonne 1, juste au-dessus de la N°1`, pro ? `${pro.k} « ${pro.t} »` : 'aucune');
        dit(!!pro && /Grille A/.test(pro.t) && /colonne 1/.test(pro.t) && /2ᵉ depuis le bas/.test(pro.t), `${L} : elle est dite en clair (meuble · colonne · rang)`, pro && pro.t);
        dit((await pg.$$('[data-prochaine]')).length === 1, `${L} : la destination est écrite UNE fois, pas sur chaque ligne (§7)`);
        dit(!!(await pg.$('[data-case="g1:1_0"][data-prochaine-case="1"]')), `${L} : et la case est montrée sur la vue 2D`);
        const lib = await pg.$$eval('[data-a-liberer]', els => els.map(e => e.getAttribute('data-a-liberer')));
        dit(JSON.stringify(lib) === '["9"]', `${L} : la case de la N°9 (partie) est proposée « à libérer » — pas les cartons de la pile`, JSON.stringify(lib));
        await pg.waitForTimeout(1200);
        dit(ecritures.length === 0, `${L} : aucune écriture avant un clic`, `${ecritures.length} écriture(s)`);
        const d = await deborde(pg); dit(d <= 1, `${L} : aucun débordement horizontal`, `${d} px`);
        await pg.screenshot({ path: path.join(CAPT, `rangement-${L}.png`), fullPage: true });
      });

      // ── 2. LA RECHERCHE : UNE LECTURE QUI SURLIGNE ─────────────────────────
      await essaie('recherche', async () => {
        await pg.fill('[data-rgt-cherche]', '9'); await pg.waitForTimeout(400);
        const hi = await pg.$$eval('[data-hi="1"]', els => els.map(e => e.getAttribute('data-case')));
        dit(JSON.stringify(hi) === '["g1:2_1"]', `${L} : « Où est la N°9 ? » surligne SA case, et elle seule`, JSON.stringify(hi));
        const t = await pg.$eval('[data-rgt-trouve]', e => e.textContent).catch(() => '');
        dit(/Grille A/.test(t) && /colonne 2/.test(t), `${L} : et dit où elle est`, t);
        await pg.fill('[data-rgt-cherche]', '77'); await pg.waitForTimeout(300);
        dit((await pg.$$('[data-hi="1"]')).length === 0 && /Aucune case/.test(await pg.$eval('[data-rgt-trouve]', e => e.textContent).catch(() => '')), `${L} : un N° absent n'est surligné nulle part, et c'est dit`);
        if (L === 1512) { await pg.fill('[data-rgt-cherche]', '9'); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(CAPT, `rangement-${L}-recherche.png`) }); }
        await pg.fill('[data-rgt-cherche]', ''); await pg.waitForTimeout(300);
        await pg.waitForTimeout(1000);
        dit(ecritures.length === 0, `${L} : chercher n'écrit rien`);
      });

      // ── 3. « RANGER ICI » : SON CLIC, LA BONNE CASE, AUCUN NUMÉRO CHANGÉ ──
      await essaie('ranger', async () => {
        await pg.click('[data-ranger-ici="2"]');
        await pg.waitForTimeout(1600);   // l'envoi au nuage est regroupé (800 ms)
        const last = ecritures[ecritures.length - 1];
        const g1 = last && last.rooms && last.rooms[0].items.find(i => i.id === 'g1');
        dit(!!g1 && JSON.stringify(g1.slots['1_0']) === '["2"]', `${L} : le clic écrit la N°2 dans la case proposée de vrm_room (écriture vérifiée)`, g1 ? JSON.stringify(g1.slots) : `${ecritures.length} écriture(s)`);
        const avant = TOUS_NUMS(PLAN).concat('2').sort();
        dit(!!last && JSON.stringify(TOUS_NUMS(last)) === JSON.stringify(avant), `${L} : aucun autre numéro n'a bougé ni changé`, last ? TOUS_NUMS(last).join(',') : '');
        const fiches = await pg.evaluate(() => JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'));
        dit(Object.values(fiches).map(f => f.numero).join(',') === '1,2,3,9', `${L} : les numéros des paires ne sont pas touchés`);
        const liste = await pg.$$eval('[data-a-ranger]', els => els.map(e => e.getAttribute('data-a-ranger')));
        dit(JSON.stringify(liste) === '["3"]', `${L} : la N°2 sort de « À ranger »`, JSON.stringify(liste));
        const pro = await pg.$eval('[data-prochaine]', e => e.getAttribute('data-prochaine')).catch(() => null);
        dit(pro === 'g1:0_0', `${L} : la proposition suivante monte d'une case`, pro);
      });

      // ── 4. « AUTRE » : SEULES LES CASES OÙ UNE BOÎTE ATTERRIT ──────────────
      await essaie('autre case', async () => {
        await pg.click('[data-autre-case="3"]'); await pg.waitForTimeout(300);
        const cli = await pg.$$eval('[data-cliquable="1"]', els => els.map(e => e.getAttribute('data-case')).sort());
        dit(JSON.stringify(cli) === '["e1:1_0","e1:1_1","g1:0_0","g1:1_1"]', `${L} : seules les cases basses libres sont proposées au toucher`, JSON.stringify(cli));
        const n0 = ecritures.length;
        await pg.click('[data-case="e1:0_0"]', { force: true }); await pg.waitForTimeout(1200);
        dit(ecritures.length === n0, `${L} : toucher une case en l'air ne range rien`);
        await pg.click('[data-case="e1:1_1"]'); await pg.waitForTimeout(1600);
        const last = ecritures[ecritures.length - 1];
        const e1 = last && last.rooms[0].items.find(i => i.id === 'e1');
        dit(!!e1 && JSON.stringify(e1.slots['1_1']) === '["3"]', `${L} : la N°3 est rangée dans la case touchée (Étagère B, colonne 2, en bas)`, e1 ? JSON.stringify(e1.slots) : '');
        dit((await pg.$$('[data-a-ranger]')).length === 0, `${L} : plus rien à ranger`);
      });

      // ── 5. « LIBÉRER » : SEULEMENT APRÈS SA CONFIRMATION ──────────────────
      await essaie('libérer', async () => {
        const n0 = ecritures.length;
        await pg.click('[data-a-liberer="9"] button'); await pg.waitForTimeout(500);
        await pg.click('button:has-text("Annuler")'); await pg.waitForTimeout(1200);
        dit(ecritures.length === n0, `${L} : « Annuler » ne libère rien`);
        await pg.click('[data-a-liberer="9"] button'); await pg.waitForTimeout(500);
        await pg.click('button:has-text("Libérer la case")'); await pg.waitForTimeout(1600);
        const last = ecritures[ecritures.length - 1];
        const nums = last ? TOUS_NUMS(last) : [];
        dit(ecritures.length > n0 && !nums.includes('9') && nums.includes('1') && nums.includes('2') && nums.includes('3'), `${L} : confirmé, seule la N°9 sort de sa case`, nums.join(','));
        if (L === 390) await pg.screenshot({ path: path.join(CAPT, `rangement-${L}-apres.png`), fullPage: true });
      });

      const d = await deborde(pg); dit(d <= 1, `${L} : toujours aucun débordement après les gestes`, `${d} px`);
      dit(errs.length === 0, `${L} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }

    // ── 6. PAS SU ⇒ AUCUNE PROPOSITION, ET C'EST DIT ──────────────────────────
    for (const [nom, opts] of [['liste des paires présentes jamais publiée', { presents: null }], ['plan illisible (522)', { roomKO: true }]]) {
      await essaie('pas su : ' + nom, async () => {
        const { ctx, pg, errs, ecritures, monte } = await ouvrir(b, 390, opts);
        dit(monte, `pas su (${nom}) : l'écran s'affiche quand même`);
        await pg.waitForTimeout(1500);
        dit(!!(await pg.$('[data-rgt-passu]')), `pas su (${nom}) : la raison est dite`, await pg.$eval('[data-rgt-passu]', e => e.textContent.slice(0, 90)).catch(() => 'rien'));
        dit((await pg.$$('[data-a-ranger]')).length === 0 && (await pg.$$('[data-ranger-ici]')).length === 0 && (await pg.$$('[data-a-liberer]')).length === 0, `pas su (${nom}) : aucune proposition`);
        dit(ecritures.length === 0, `pas su (${nom}) : aucune écriture`);
        dit(errs.length === 0, `pas su (${nom}) : aucune erreur d'app`, errs.join(' | ').slice(0, 160));
        if (opts.presents === null) await pg.screenshot({ path: path.join(CAPT, 'rangement-390-passu.png'), fullPage: true });
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ assistant de rangement : ${ko} rouge(s)` : '\n✅ assistant de rangement : tout est vert');
  process.exit(ko ? 1 : 0);
})();
