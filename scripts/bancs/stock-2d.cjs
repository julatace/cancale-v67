// ════════════════════════════════════════════════════════════════════════════
//  BANC « LE STOCK EN 2D » + « TES NUMÉROS DE RANGEMENT, ASSISTÉS » (15 octobre)
//
//  Julien : « pour l'onglet Stock, il faut révolutionner la manière dont on
//  représente le rangement : en 2D, avec au loin une vue du dessus, et quand on
//  clique à côté ça avance et ça nous met face à l'endroit où sont rangés les
//  articles » — et « tes numéros de rangement, ça ne va pas du tout : ce n'est
//  pas intuitif, ça doit être assisté ».
//
//  Une pièce INVENTÉE à la forme de la sienne (mesurée en lecture seule le
//  15 octobre : 17 × 10 m, 8 meubles — 2 tables, 1 pile de 26 cartons, 1 porte,
//  2 grilles, 1 étagère, 1 commode —, 29 cartons, tous des anciens « B »), et
//  aucun vrai numéro, aucun vrai titre : le banc vit dans le dépôt.
//   A. le Stock s'ouvre sur le PLAN, sans charger la 3D (aucune requête three) ;
//      chaque rangement est un bouton qui dit son nombre de paires ; le décor
//      n'en est pas un ;
//   B. toucher la pile ⇒ on se met EN FACE : ses 26 cartons dessinés avec leur
//      N°, et la liste de ce qu'elle contient (photo/titre si la fiche existe,
//      « N° inconnu » sinon — jamais un titre deviné) ;
//   C. › et ‹ passent au meuble voisin, dans l'ordre du tour de la pièce ;
//      « ‹ Plan » revient au plan ; toucher le SOL à côté d'un meuble y avance ;
//   D. chercher un N° : « Me mettre en face » ⇒ son carton surligné à l'ACCENT
//      (jamais le rouge, §7) ;
//   E. sortir une paire d'une case DEPUIS LA 2D l'écrit vraiment dans vrm_room
//      (la 3D jouait l'animation puis écrivait : sans elle, rien ne partait) ;
//   F. la 3D reste en option (1512 px), mémorisée par appareil ;
//   G. lecture de vrm_room RATÉE, appareil neuf : l'écran le dit, et AUCUN geste
//      n'écrit (lecture KO, écriture OK : le cas qui effaçait tout son stock) ;
//      « Réessayer » relit ;
//   H. l'assistant « Ajouter un rangement » : un dessin, niveaux × cases, ajouté
//      VIDE ; une pile dont un N° est déjà rangé ailleurs est refusée ;
//   I. Réglages → « Tes numéros de rangement » : la carte dit le PROCHAIN
//      carton (25, par LA règle de l'écran Annonces) ; l'assistant ne propose
//      pas « B » (les anciens) ; rien n'est enregistré avant « Enregistrer » ;
//      le pool ne bouge pas ; avant l'arrivée du nuage : « pas encore lu »,
//      jamais « 1 ».
//  Relecture du 15 octobre (chaque contrôle ci-dessous était ROUGE sur 38fac47) :
//   A. aucune étiquette du plan n'en chevauche une autre (« 26 » collé à « 2 ») ;
//   G. lecture ratée, appareil neuf : ni pièce vide affirmée, ni bouton qui ne
//      peut rien enregistrer, ni « Aucune case ne contient » ; G2 (copie locale)
//      un geste n'écrit toujours rien ; Gbis (lecture LENTE) : rien d'affirmé
//      pendant, et la recherche tapée est rejouée une fois la pièce lue ;
//   H. une pile ne porte que des N° DÉJÀ DONNÉS (22 → 26 refusée, 25 et 26 ne
//      l'ont jamais été) ; « S'arrêter au N°24 » ajoute 22, 23, 24 ;
//   I. le message d'enregistrement dit le prochain carton de LA règle (C3),
//      jamais « C1, C2… » écrit en dur ;
//   J. étagère et commode : la paire va sur le niveau TOUCHÉ, rien d'autre ne
//      bouge, les N° empilés restent ; seule la grille a de la gravité, et la
//      feuille annonce la case où la boîte TOMBE ;
//   K. « Modifier » sur la face : les réglages s'ouvrent À L'ÉCRAN (390 / 1512) ;
//   L. glisser une pile au-delà du mur sur le plan : elle reste dans la pièce ;
//      et le texte du mode déplacement ne parle pas de « tourner la vue » en 2D.
//  Deux tailles (390 px tactile, 1512 px), et une passe en sombre (captures).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');

const DIST = path.join(__dirname, '..', '..', 'dist');   // jamais un chemin absolu (§6.1)
const PORT = 5961;
const CAPT = process.env.CAPTURES || os.tmpdir();
// SECTIONS=AE,G,H,I,S : ne jouer que ces blocs (preuve par mutation, plus courte). Défaut : tout.
const SECTIONS = (process.env.SECTIONS || 'AE,F,G,H,I,J,K,L,S').split(',');
const veut = (x) => SECTIONS.includes(x);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const JETON = 'jeton-de-banc';
const SESSION = { access_token: JETON, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.fr' } };
const COMPTE = { vinted_user_id: '900000001', login: 'compte-de-banc', access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString() };

const MK = { version: 2, coupure: '2026-10-09T00:00:00.000Z', appliqueLe: '2026-10-11T14:58:07.000Z', archive: 'B', nouvelles: 24, renum: {}, lbcAnnonces: {}, ebayAnnonces: {} };
const PILE = Array.from({ length: 26 }, (_, i) => 'B' + (101 + i));          // B101 … B126
const planDe = () => ({ numerotation: 2, active: 'r1', rooms: [
  { id: 'r1', name: 'Garage de banc', room: { w: 17, h: 10, wallH: 4.6, wallColor: '#e4e8ee' }, items: [
    { id: 't1', type: 'table', name: 'Table', x: 5.5, y: 8, w: 3, h: 2, rot: Math.PI, wall: 'N', rows: 1, cols: 1, slots: {} },
    { id: 'p1', type: 'pile', name: 'Pile de boîtes', x: 3.5, y: 0, w: 3.5, h: 0.5, rot: 0, cell: 0.5, cols: 7, rows: 4, lift: 0, nums: PILE.slice() },
    { id: 'd1', type: 'porte', name: 'Porte', x: -0.33, y: 2.5, w: 1, h: 0.35, rot: Math.PI / 2, rows: 1, cols: 1 },
    { id: 't2', type: 'table', name: 'Table', x: 0.34, y: 1, w: 2, h: 2, rot: 0, rows: 1, cols: 1, slots: {} },
    { id: 'g1', type: 'grille', name: 'Grille de boîtes', x: 7, y: 0, w: 2, h: 0.5, rot: 0, cell: 0.5, cols: 4, rows: 9, slots: { '7_3': ['B201'], '8_3': ['B202'] } },
    { id: 'g2', type: 'grille', name: 'Grille du fond', x: 15, y: 9.5, w: 2, h: 0.5, rot: Math.PI, cell: 0.5, cols: 4, rows: 9, slots: {} },
    { id: 'e1', type: 'etagere', name: 'Étagère', x: 9.5, y: 0, w: 3, h: 1, rot: 0, rows: 4, cols: 3, slots: { '1_0': ['B301'] } },
    { id: 'c1', type: 'commode', name: 'Commode', x: 5.1, y: 2.1, w: 2, h: 1, rows: 3, cols: 1, slots: {} },
  ] },
  { id: 'r2', name: 'Pièce 2', room: { w: 10, h: 8, wallH: 3.4, wallColor: '#e4e8ee' }, items: null },
] });
const POOL = [...Array.from({ length: 40 }, (_, i) => 'B' + (i + 1)), ...PILE, 'B201', 'B202', 'B301', ...Array.from({ length: 24 }, (_, i) => i + 1)];
const mainDe = (extra = {}) => {
  const fiches = {};
  for (let i = 1; i <= 24; i++) fiches[String(5000 + i)] = { numero: String(i), title: 'Paire neuve ' + i, numberedAt: Date.now() - i * 1000 };
  fiches['4105'] = { numero: 'B105', title: 'Paire de banc 105', numberedAt: 1 };
  fiches['4201'] = { numero: 'B201', title: 'Paire de banc 201', numberedAt: 1 };
  return { vrm_numerotation: MK, vrm_num_prefixe: '', vinted_used_numeros: POOL.slice(), vinted_annonce_numeros: fiches, vinted_accounts_hidden: [], ...extra };
};

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String(e && e.message || e).slice(0, 180)); return null; } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const ecouter = () => new Promise((res, rej) => {
  srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est déjà pris — relance ce banc seul`) : e));
  srv.listen(PORT, () => res());
});
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// Une base à état : `etat.main`, `etat.room` (vrm_room) ; les écritures sont gardées.
async function page(ctx, etat) {
  const pg = await ctx.newPage();
  pg.setDefaultTimeout(10000);   // un geste introuvable rapporte en 10 s, il ne fige pas le banc
  pg.__requetes = []; pg.on('request', (q) => pg.__requetes.push(q.url()));
  pg.__erreurs = []; pg.on('pageerror', (e) => pg.__erreurs.push(String(e).slice(0, 160)));
  // ⚠️ Playwright prend la DERNIÈRE route enregistrée en premier (§6.6) : le
  //    fourre-tout des images externes passe donc AVANT les routes précises.
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.fulfill({ status: 404, body: '' })));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: JETON, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', async (r) => {
    const req = r.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, s = 200) => r.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return json([]);
    if (req.method() !== 'GET') {
      let rows = []; try { const b = JSON.parse(req.postData() || '[]'); rows = Array.isArray(b) ? b : [b]; } catch (_) {}
      for (const x of rows) {
        if (x && x.id === 'main' && x.data) { etat.ecritsMain.push(x.data); etat.main = { ...x.data, vrm_numerotation: etat.main.vrm_numerotation }; }
        if (x && x.id === 'vrm_room' && x.data) { etat.ecritsRoom.push(x.data); etat.room = x.data; }
      }
      return json([]);
    }
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json([COMPTE]);
    if (/id=eq\.vrm_room/.test(u)) {
      if (etat.roomDelai) await attendre(etat.roomDelai);
      if (etat.roomKO) return r.fulfill({ status: 522, contentType: 'text/html', body: '<html><body>522 Connection timed out</body></html>' });
      return json(etat.room ? [{ data: etat.room }] : []);
    }
    if (/id=eq\.main/.test(u) && /select=v:data->vrm_numerotation->>version/.test(u)) return json([{ v: String(MK.version) }]);
    if (/id=eq\.main/.test(u)) { if (etat.mainDelai) await attendre(etat.mainDelai); return json([{ id: 'main', data: etat.main }]); }
    return json([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  return pg;
}
const etatNeuf = (o = {}) => ({ main: mainDe(), room: planDe(), ecritsMain: [], ecritsRoom: [], ...o });
const local = (pg, k) => pg.evaluate((k) => localStorage.getItem(k), k);
const debordement = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const mort = (pg) => pg.evaluate(() => /n'a pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText));
// Une capture se prend POSÉE : les animations (fondu de la face, recul du plan) finies.
const pose = (pg) => pg.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5000 }).catch(() => null);
const charge3d = (pg) => pg.__requetes.filter((u) => /\/assets\/(Room3D|three\.module|OrbitControls)/.test(u)).length;

(async () => {
  try { await ecouter(); } catch (e) { console.log('  ❌ ' + e.message); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const contexte = async (taille, init = {}) => {
    const mobile = taille === 390;
    const ctx = await nav.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } });
    await ctx.addInitScript(([s, init]) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); Object.entries(init).forEach(([k, v]) => { if (localStorage.getItem(k) == null) localStorage.setItem(k, v); }); } catch (_) {} }, [SESSION, init]);
    return ctx;
  };
  const ouvrirStock = async (pg) => {
    await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-stock-plan], [data-stock-vide], [data-stock-pas-lu]', { timeout: 25000 }).catch(() => null);
    await pg.waitForTimeout(1200);
  };
  try {
    for (const taille of (veut('AE') ? [1512, 390] : [])) {
      console.log(`\n── A-E. Le plan, la face, la recherche, sortir une paire — ${taille} px`);
      const etat = etatNeuf();
      const ctx = await contexte(taille); const pg = await page(ctx, etat);
      await essaie('ouvrir le Stock', () => ouvrirStock(pg));
      await essaie('A', async () => {
        dit(!!(await pg.$('[data-stock-plan]')), 'le Stock s\'ouvre sur le PLAN de la pièce (vue du dessus)');
        dit(!(await pg.$('[data-stock3d] canvas')) && charge3d(pg) === 0, 'sans charger la 3D (aucune requête Room3D / three)', `${charge3d(pg)} requête(s) 3D`);
        const postes = await pg.$$eval('[data-plan-poste]', (l) => l.map((b) => ({ id: b.getAttribute('data-plan-poste'), lab: b.getAttribute('aria-label') })));
        dit(postes.length === 7, 'chaque RANGEMENT est un bouton (7 : 2 tables, 1 pile, 2 grilles, 1 étagère, 1 commode)', postes.map((p) => p.id).join(','));
        dit((await pg.$$('[data-plan-decor]')).length === 1 && !postes.some((p) => p.id === 'd1'), 'le décor (la porte) est dessiné, pas cliquable');
        const pile = postes.find((p) => p.id === 'p1');
        dit(!!pile && /26 paires/.test(pile.lab), 'la pile dit son nombre de paires (26)', pile && pile.lab);
        dit((await debordement(pg)) <= 1 && !(await mort(pg)), 'aucun débordement horizontal, écran vivant');
        // §7 : « on n'écrit rien par-dessus » — vu à 390 px : « Pile de boîtes · 26 » collé à « 2 », lu « 26 2 ».
        const ets = await pg.$$eval('[data-plan-etiquette]', (l) => l.map((e) => { const r = e.getBoundingClientRect(); return { t: e.innerText.replace(/\s+/g, ' '), l: r.left, r: r.right, h: r.top, b: r.bottom }; }));
        const chev = [];
        for (let i = 0; i < ets.length; i++) for (let j = i + 1; j < ets.length; j++) { const a = ets[i], b = ets[j]; if (a.l < b.r && b.l < a.r && a.h < b.b && b.h < a.b) chev.push(`« ${a.t} » / « ${b.t} »`); }
        dit(chev.length === 0 && ets.some((e) => /26/.test(e.t)), 'aucune étiquette du plan n\'en chevauche une autre', chev.join(' ; ') || `${ets.length} étiquette(s)`);
        await pose(pg); await pg.screenshot({ timeout: 30000, path: path.join(CAPT, `stock2d-plan-${taille}.png`) });
      });
      await essaie('B', async () => {
        await pg.click('[data-plan-poste="p1"]');
        await pg.waitForSelector('[data-stock-face="p1"]', { timeout: 4000 });
        const cartons = await pg.$$eval('[data-stock-face="p1"] [data-carton]', (l) => l.map((b) => b.getAttribute('data-carton')));
        dit(cartons.length === 26 && cartons.includes('B101') && cartons.includes('B126'), 'en FACE de la pile : ses 26 cartons, avec leur N°', `${cartons.length} carton(s)`);
        const lignes = await pg.$$eval('[data-face-ligne]', (l) => l.map((b) => ({ n: b.getAttribute('data-face-ligne'), t: b.innerText })));
        const l105 = lignes.find((x) => x.n === 'B105');
        dit(!!l105 && /Paire de banc 105/.test(l105.t), 'une paire connue : son titre (et sa photo), reliés par le N° (l\'identité, §5)', l105 && l105.t.replace(/\n/g, ' · '));
        dit(lignes.length === 1, 'la liste ne répète pas le dessin : seulement ce qu\'on sait en plus du N° (1 fiche sur 26)', `${lignes.length} ligne(s)`);
        // §7 : ce qui vaut pour toutes les lignes se dit UNE fois (le banc COMPTE).
        const resume = await pg.$eval('[data-face-resume]', (e) => e.innerText).catch(() => '');
        const repet = (re) => lignes.filter((x) => re.test(x.t)).length;
        dit(/Anciens numéros/.test(resume) && /25 sans fiche/.test(resume) && repet(/ancien/i) === 0,
          'ce qui vaut pour tout le meuble est dit UNE fois au-dessus (anciens, 25 sans fiche)', `« ${resume} » · « ancien » ×${repet(/ancien/i)}`);
        // Un N° sans fiche : touché, il dit « inconnu » — jamais un titre deviné.
        await pg.click('[data-stock-face="p1"] [data-carton="B110"]');
        const fiche = await pg.waitForSelector('[data-stock-fiche="B110"]', { timeout: 3000 }).then((e) => e.innerText()).catch(() => '');
        dit(/inconnu/.test(fiche) && !/Paire/.test(fiche) && /colonne 3 · 2ᵉ depuis le bas/.test(fiche), 'toucher un carton sans fiche : « N° inconnu », sa place exacte, aucun titre deviné', fiche.replace(/\n/g, ' · '));
        await pg.click('button:has-text("Fermer")').catch(() => {}); await pg.waitForTimeout(300);
        const tronques = await pg.$$eval('[data-stock-face="p1"] [data-carton] span', (l) => l.filter((s) => s.scrollWidth > s.clientWidth + 1).length);
        dit(tronques === 0, 'chaque N° se lit en entier sur sa case (vu au rendu : « B… » à 390 px)', `${tronques} N° coupé(s)`);
        dit((await debordement(pg)) <= 1 && !(await mort(pg)), 'la face tient dans l\'écran');
        await pose(pg);   // la face arrive en fondu (240 ms) : on la capture posée
        await pg.screenshot({ timeout: 30000, path: path.join(CAPT, `stock2d-face-${taille}.png`) });
      });
      await essaie('C', async () => {
        await pg.click('[data-face-voisin="suiv"]'); await pg.waitForTimeout(500);
        const apres = await pg.$eval('[data-stock-face]', (e) => e.getAttribute('data-stock-face'));
        dit(apres === 'g1', '› passe au meuble voisin, dans l\'ordre du tour de la pièce (pile → grille)', apres);
        await pg.click('[data-face-voisin="prec"]'); await pg.waitForTimeout(500);
        dit((await pg.$eval('[data-stock-face]', (e) => e.getAttribute('data-stock-face'))) === 'p1', '‹ revient à la pile');
        await pg.click('[data-face-plan]');
        // La pièce RECULE (≈ 340 ms) avant de se poser : on attend qu'elle soit posée.
        await pg.waitForFunction(() => { const p = document.querySelector('[data-stock-plan]'); return p && getComputedStyle(p).transform === 'none'; }, null, { timeout: 4000 }).catch(() => null);
        dit(!!(await pg.$('[data-stock-plan]')) && !(await pg.$('[data-stock-face]')), '« ‹ Plan » revient au plan');
        // Le SOL à côté de l'étagère (1,5 m devant elle) : on avance jusqu'à elle.
        const b = await pg.$eval('[data-stock-plan]', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + (11 / 17) * r.width, y: r.top + (2.0 / 10) * r.height }; });
        await pg.mouse.click(b.x, b.y); await pg.waitForTimeout(900);
        const f = await pg.$('[data-stock-face]');
        dit(!!f && (await f.getAttribute('data-stock-face')) === 'e1', 'toucher le SOL à côté d\'un meuble y avance (« clic à côté, ça avance »)', f ? await f.getAttribute('data-stock-face') : 'resté sur le plan');
        if (f) { await pg.click('[data-face-plan]'); await pg.waitForTimeout(700); }
      });
      await essaie('D', async () => {
        await pg.fill('input[placeholder^="Cherche un N° → le meuble"]', 'B112'); await pg.waitForTimeout(600);
        dit(!!(await pg.$('[data-plan-trouve="1"][data-plan-poste="p1"]')), 'la recherche surligne le meuble sur le plan');
        await pg.click('[data-stock-voir-face]'); await pg.waitForSelector('[data-stock-face="p1"]', { timeout: 4000 });
        const c = await pg.$('[data-carton="B112"][data-trouve="1"]');
        const coul = c ? await c.evaluate((e) => getComputedStyle(e).borderTopColor) : '';
        // L'accent est LU sur l'app (le bouton principal de l'onglet « Ma pièce ») :
        // la palette peut changer, la règle (§7 : jamais le rouge) non.
        const accent = await pg.$eval('.vrm-btn-primary', (e) => getComputedStyle(e).backgroundColor).catch(() => '?');
        dit(!!c && coul === accent && !/229, 72, 77/.test(coul), '« Me mettre en face » : SON carton surligné, à l\'accent (jamais au rouge)', `${coul || 'aucun carton surligné'} / accent ${accent}`);
        await pg.fill('input[placeholder^="Cherche un N° → le meuble"]', ''); await pg.waitForTimeout(300);
      });
      await essaie('E', async () => {
        await pg.click('[data-face-voisin="suiv"]'); await pg.waitForSelector('[data-stock-face="g1"]', { timeout: 3000 });
        const avant = etat.ecritsRoom.length;
        await pg.click('[data-stock-face="g1"] [data-case="8_3"]');
        await pg.waitForSelector('[data-stock-fiche="B202"]', { timeout: 3000 });
        await pg.click('[data-fiche-sortir]'); await pg.waitForTimeout(1600);
        const derniere = etat.ecritsRoom[etat.ecritsRoom.length - 1];
        const g1 = derniere && derniere.rooms && derniere.rooms[0].items.find((x) => x.id === 'g1');
        const reste = g1 ? Object.values(g1.slots || {}).flat() : null;
        dit(etat.ecritsRoom.length > avant && !!reste && !reste.includes('B202') && reste.includes('B201'), 'sortir une paire DEPUIS LA 2D l\'écrit vraiment (B202 sort, B201 reste)', reste ? JSON.stringify(reste) : 'aucune écriture de vrm_room');
        const p1 = derniere && derniere.rooms && derniere.rooms[0].items.find((x) => x.id === 'p1');
        dit(!!p1 && p1.nums.length === 26 && derniere.numerotation === 2, 'le reste de la pièce est intact, version de numérotation estampillée');
        dit(!(await pg.$('[data-stock-face="g1"] [data-case] >> text=B202')), 'la case est vide à l\'écran');
        dit(!pg.__erreurs.length, 'aucune erreur d\'app', pg.__erreurs.join(' | '));
      });
      if (taille === 1512 && veut('F')) await essaie('F', async () => {
        console.log('── F. La 3D en option');
        await pg.click('[data-face-plan]').catch(() => {}); await pg.waitForTimeout(400);
        await pg.click('[data-stock-rendu="3d"]');
        const ok3d = await pg.waitForSelector('[data-stock3d] canvas', { timeout: 30000 }).then(() => true).catch(() => false);
        dit(ok3d && (await local(pg, 'vrm_stock_rendu')) === '"3d"', 'la 3D reste disponible, en un geste, et mémorisée sur cet appareil');
        await pg.click('[data-stock-rendu="2d"]'); await pg.waitForTimeout(800);
        dit(!!(await pg.$('[data-stock-plan]')) && (await local(pg, 'vrm_stock_rendu')) === '"2d"', 'et le plan revient');
      });
      await ctx.close().catch(() => {});
    }

    if (veut('G')) console.log('\n── G. Lecture de vrm_room RATÉE, appareil neuf — 390 px');
    if (veut('G')) await essaie('G', async () => {
      const etat = etatNeuf({ roomKO: true });
      const ctx = await contexte(390); const pg = await page(ctx, etat);
      await essaie('ouvrir le Stock', () => ouvrirStock(pg));
      dit(!!(await pg.$('[data-stock-pas-lu]')), 'l\'écran DIT que le stock n\'a pas pu être lu');
      // « rien lu » ne vaut pas « rien » : ni la pièce vide par défaut présentée
      // comme la sienne, ni un bouton qui ne peut rien enregistrer.
      const corps = await pg.evaluate(() => document.body.innerText);
      dit(!(await pg.$('[data-stock-vide]')) && !/10 × 8 m/.test(corps) && !/Aucun rangement/.test(corps),
        'aucune pièce affirmée (ni « Ma pièce · 10 × 8 m », ni « Aucun rangement »)', /10 × 8 m/.test(corps) ? '« 10 × 8 m » affiché' : /Aucun rangement/.test(corps) ? '« Aucun rangement » affiché' : '');
      const ajouts = await pg.$$eval('[data-stock-ajouter]', (l) => l.filter((b) => !b.disabled && b.offsetParent).length);
      dit(ajouts === 0, 'aucun « Ajouter un rangement » actif tant que le stock n\'est pas lu', `${ajouts} bouton(s) actif(s)`);
      await pg.fill('input[placeholder^="Cherche un N° → le meuble"]', 'B110'); await pg.waitForTimeout(600);
      const c2 = await pg.evaluate(() => document.body.innerText);
      dit(!/Aucune case ne contient/.test(c2) && !!(await pg.$('[data-stock-recherche-pas-lu]')), 'chercher B110 ne dit pas « Aucune case ne contient » : je ne sais pas', (c2.match(/Aucune case[^\n]*|Je ne peux pas[^\n]*/) || [''])[0]);
      dit(etat.ecritsRoom.length === 0, 'rien n\'est écrit', `${etat.ecritsRoom.length} écriture(s) de vrm_room`);
      await pg.screenshot({ timeout: 30000, path: path.join(CAPT, 'stock2d-pas-lu-390.png') });
      etat.roomKO = false;
      const re = await pg.$('[data-stock-pas-lu] button');
      if (re) { await re.click(); await pg.waitForSelector('[data-stock-plan]', { timeout: 5000 }).catch(() => null); }
      await pg.waitForTimeout(500);
      dit(!!re && (await pg.$$('[data-plan-poste]')).length === 7 && !(await pg.$('[data-stock-pas-lu]')), '« Réessayer » relit : sa pièce revient, intacte');
      dit(!!(await pg.$('[data-stock-trouve="p1"]')), 'et la recherche tapée pendant la panne trouve B110 (dans la pile)');
      dit(etat.ecritsRoom.length === 0, 'et rien n\'a été écrit entre-temps');
      await ctx.close().catch(() => {});
    });
    if (veut('G')) console.log('\n── G2. Lecture RATÉE, mais une copie sur cet appareil — 390 px');
    if (veut('G')) await essaie('G2', async () => {
      const etat = etatNeuf({ roomKO: true });
      const ctx = await contexte(390, { vrm_room_plan: JSON.stringify(planDe()) }); const pg = await page(ctx, etat);
      await essaie('ouvrir le Stock', () => ouvrirStock(pg));
      dit(!!(await pg.$('[data-stock-pas-lu]')) && (await pg.$$('[data-plan-poste]')).length === 7, 'la dernière copie de l\'appareil s\'affiche, et l\'écran dit qu\'elle n\'est pas relue');
      const plus = await pg.$('button:has-text("＋ Pièce")');
      if (plus) { await plus.click(); await pg.waitForTimeout(1700); }
      dit(!!plus && etat.ecritsRoom.length === 0, 'un geste (＋ Pièce) n\'écrit RIEN : une copie non relue n\'écrase pas son stock', `${etat.ecritsRoom.length} écriture(s) de vrm_room`);
      await ctx.close().catch(() => {});
    });
    if (veut('G')) console.log('\n── Gbis. Lecture LENTE (6 s), appareil neuf — 390 px');
    if (veut('G')) await essaie('Gbis', async () => {
      const etat = etatNeuf({ roomDelai: 6000 });
      const ctx = await contexte(390); const pg = await page(ctx, etat);
      await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-stock-lecture]', { timeout: 6000 }).catch(() => null);
      const pendant = await pg.evaluate(() => document.body.innerText);
      dit(!!(await pg.$('[data-stock-lecture]')) && !(await pg.$('[data-stock-vide]')) && !/10 × 8 m/.test(pendant), 'pendant la lecture : « Lecture de ton stock… », jamais une pièce vide de 10 × 8 m', /10 × 8 m/.test(pendant) ? '« 10 × 8 m » affiché' : '');
      await pg.fill('input[placeholder^="Cherche un N° → le meuble"]', 'B110'); await pg.waitForTimeout(400);
      const c2 = await pg.evaluate(() => document.body.innerText);
      dit(!/Aucune case ne contient/.test(c2), 'chercher pendant la lecture ne dit pas « Aucune case »');
      await pg.screenshot({ timeout: 30000, path: path.join(CAPT, 'stock2d-lecture-390.png') });
      await pg.waitForSelector('[data-stock-plan]', { timeout: 15000 }).catch(() => null); await pg.waitForTimeout(500);
      dit((await pg.$$('[data-plan-poste]')).length === 7 && !!(await pg.$('[data-stock-trouve="p1"]')), 'la pièce lue arrive, et la recherche tapée entre-temps est rejouée (B110 → la pile)');
      dit(etat.ecritsRoom.length === 0, 'rien n\'est écrit');
      await ctx.close().catch(() => {});
    });

    if (veut('H')) console.log('\n── H. L\'assistant « Ajouter un rangement » — 390 px');
    if (veut('H')) await essaie('H', async () => {
      const etat = etatNeuf();
      const ctx = await contexte(390); const pg = await page(ctx, etat);
      await essaie('ouvrir le Stock', () => ouvrirStock(pg));
      await pg.click('button:has-text("Pièce 2")'); await pg.waitForSelector('[data-stock-vide]', { timeout: 4000 });
      await pg.click('[data-stock-ajouter="vide"]');
      await pg.waitForSelector('[data-ajout-rangement][data-etape="type"]', { timeout: 3000 });
      const types = await pg.$$eval('[data-ajout-type]', (l) => l.map((b) => b.getAttribute('data-ajout-type')));
      dit(types.length >= 6 && types.includes('etagere') && types.includes('pile'), 'on CHOISIT un dessin (étagère, grille, pile…), pas une liste de pastilles', types.join(','));
      await pg.screenshot({ timeout: 30000, path: path.join(CAPT, 'stock2d-ajout-type-390.png') });
      await pg.click('[data-ajout-type="etagere"]');
      await pg.click('[data-ajout-rangement] label:has-text("Cases par niveau") button[aria-label="Plus"]');
      await pg.fill('[aria-label="Nom du rangement"]', 'Étagère de banc');
      await pg.screenshot({ timeout: 30000, path: path.join(CAPT, 'stock2d-ajout-taille-390.png') });
      await pg.click('[data-ajout-valider]'); await pg.waitForTimeout(1700);
      const derniere = etat.ecritsRoom[etat.ecritsRoom.length - 1];
      const r2 = derniere && derniere.rooms && derniere.rooms.find((x) => x.id === 'r2');
      const e = r2 && (r2.items || []).find((x) => x.type === 'etagere');
      dit(!!e && e.rows === 4 && e.cols === 4 && Object.keys(e.slots || {}).length === 0 && e.name === 'Étagère de banc', 'l\'étagère est ajoutée (4 niveaux × 4 cases), VIDE : aucun N° inventé', e ? JSON.stringify({ rows: e.rows, cols: e.cols, slots: e.slots }) : 'rien d\'écrit');
      dit((await pg.$$('[data-stock-face] [data-case]')).length === 16, 'et on se retrouve en face d\'elle, ses 16 cases dessinées');
      // Une pile dont un N° est déjà rangé ailleurs (B110 est dans la pile du garage).
      await pg.click('[data-face-plan]'); await pg.waitForTimeout(500);
      await pg.click('summary:has-text("Aménager la pièce")'); await pg.waitForTimeout(300);
      await pg.click('[data-stock-ajouter="amenager"]'); await pg.click('[data-ajout-type="pile"]');
      await pg.fill('[aria-label="Numéro du carton du bas"]', 'B110'); await pg.waitForTimeout(300);
      const etatPile = await pg.$eval('[data-ajout-pile]', (e) => e.getAttribute('data-ajout-pile')).catch(() => '');
      const desactive = await pg.$eval('[data-ajout-valider]', (b) => b.disabled).catch(() => false);
      dit(etatPile === 'conflit' && desactive, 'une pile qui reprendrait un N° déjà rangé ailleurs (B110) est REFUSÉE', etatPile);
      // Un carton ne porte que le N° d'une paire DÉJÀ numérotée : 1…24 ont été
      // donnés, pas 25 ni 26. Hauteur 5 par défaut ⇒ 22 → 26, refusée.
      await pg.fill('[aria-label="Numéro du carton du bas"]', '22'); await pg.waitForTimeout(300);
      const e22 = await pg.$eval('[data-ajout-pile]', (e) => ({ etat: e.getAttribute('data-ajout-pile'), txt: e.innerText.replace(/\s+/g, ' ') })).catch(() => ({}));
      const des22 = await pg.$eval('[data-ajout-valider]', (b) => b.disabled).catch(() => false);
      dit(e22.etat === 'pas-donne' && des22 && /25/.test(e22.txt), 'une pile 22 → 26 est REFUSÉE : 25 et 26 n\'ont encore été donnés à aucune paire', `${e22.etat} — ${e22.txt}`);
      await pg.screenshot({ timeout: 30000, path: path.join(CAPT, 'stock2d-ajout-pile-pas-donne-390.png') });
      const arreter = await pg.$('[data-ajout-arreter]');
      if (arreter) { await arreter.click(); await pg.waitForTimeout(300); }
      const e24 = await pg.$eval('[data-ajout-pile]', (e) => e.getAttribute('data-ajout-pile')).catch(() => '');
      const nb = await pg.$eval('[data-ajout-nombre]', (e) => e.getAttribute('data-ajout-nombre')).catch(() => '');
      dit(!!arreter && e24 === 'ok' && nb === '3', '« S\'arrêter au N°24 » : 3 cartons, 22 → 24', `${e24} · ${nb} carton(s)`);
      const n0 = etat.ecritsRoom.length;
      await pg.click('[data-ajout-valider]').catch(() => {}); await pg.waitForTimeout(1700);
      const der2 = etat.ecritsRoom[etat.ecritsRoom.length - 1];
      const r2b = der2 && der2.rooms && der2.rooms.find((x) => x.id === 'r2');
      const pileAj = r2b && (r2b.items || []).find((x) => x.type === 'pile');
      dit(etat.ecritsRoom.length > n0 && !!pileAj && JSON.stringify(pileAj.nums) === '["22","23","24"]', 'la pile ajoutée porte 22, 23, 24 — aucun N° inventé', pileAj ? JSON.stringify(pileAj.nums) : 'rien d\'écrit');
      dit((await debordement(pg)) <= 1 && !pg.__erreurs.length, 'sans débordement ni erreur', pg.__erreurs.join(' | '));
      await ctx.close().catch(() => {});
    });

    for (const taille of (veut('I') ? [1512, 390] : [])) {
      console.log(`\n── I. Réglages → « Tes numéros de rangement », assisté — ${taille} px`);
      await essaie('I' + taille, async () => {
        const etat = etatNeuf();
        const ctx = await contexte(taille); const pg = await page(ctx, etat);
        await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-numeros-reglage]', { timeout: 20000 });
        await pg.waitForTimeout(2500);
        const R = pg.locator('[data-numeros-reglage]'); await R.scrollIntoViewIfNeeded();
        const prochain = await R.getAttribute('data-prochain');
        dit(prochain === '25', 'la carte dit le PROCHAIN carton : 25 (pool 1…24 + anciens B, la règle de l\'écran Annonces)', prochain);
        const txt = (await R.innerText()).replace(/\s+/g, ' ').trim();
        dit(txt.length <= 90, 'une carte, pas un paragraphe (≤ 90 caractères)', `${txt.length} : « ${txt} »`);
        await pg.click('[data-numeros-changer]');
        await pg.waitForSelector('[data-numeros-assistant][data-etape="forme"]', { timeout: 3000 });
        await pg.screenshot({ timeout: 30000, path: path.join(CAPT, `numeros-forme-${taille}.png`) });
        await pg.click('[data-choix="lettre"]');
        await pg.waitForSelector('[data-numeros-assistant][data-etape="lettre"]', { timeout: 3000 });
        dit(await pg.$eval('[data-lettre="B"]', (b) => b.disabled), '« B » (la lettre des anciens numéros) n\'est pas proposable');
        const p0 = await local(pg, 'vrm_num_prefixe');
        dit(p0 == null || p0 === '""', 'choisir « Une lettre devant » n\'enregistre RIEN tout seul', String(p0));
        await pg.screenshot({ timeout: 30000, path: path.join(CAPT, `numeros-lettre-${taille}.png`) });
        await pg.click('[data-lettre="C"]');
        await pg.waitForSelector('[data-numeros-assistant][data-etape="recap"]', { timeout: 3000 });
        const rp = await pg.getAttribute('[data-recap-prochain]', 'data-recap-prochain');
        dit(rp === 'C1', 'le récapitulatif montre le prochain carton de la série : C1', rp);
        await pg.waitForTimeout(1500);
        const p1 = await local(pg, 'vrm_num_prefixe');
        dit((p1 == null || p1 === '""') && !etat.ecritsMain.some((d) => d.vrm_num_prefixe === 'C'), 'toujours rien d\'enregistré avant « Enregistrer »', String(p1));
        await pg.screenshot({ timeout: 30000, path: path.join(CAPT, `numeros-recap-${taille}.png`) });
        await pg.click('[data-numeros-enregistrer]'); await pg.waitForTimeout(2200);
        dit((await local(pg, 'vrm_num_prefixe')) === '"C"' && etat.ecritsMain.some((d) => d.vrm_num_prefixe === 'C'), '« Enregistrer » enregistre la série C (appareil et nuage)');
        dit((await R.getAttribute('data-prochain')) === 'C1', 'la carte dit maintenant : prochain carton C1');
        const pools = etat.ecritsMain.map((d) => JSON.stringify(d.vinted_used_numeros));
        dit(pools.length > 0 && pools.every((p) => p === JSON.stringify(POOL)), 'le pool des numéros déjà donnés n\'a pas bougé (append-only, §5)');
        await pg.click('[data-numeros-changer]'); await pg.click('[data-choix="chiffres"]');
        await pg.waitForSelector('[data-recap-prochain="25"]', { timeout: 3000 });
        await pg.click('[data-numeros-enregistrer]'); await pg.waitForTimeout(1500);
        dit((await local(pg, 'vrm_num_prefixe')) === '""' && (await R.getAttribute('data-prochain')) === '25', 'retour aux chiffres : prochain carton 25');
        dit((await debordement(pg)) <= 1 && !pg.__erreurs.length, 'sans débordement ni erreur', pg.__erreurs.join(' | '));
        await ctx.close().catch(() => {});
      });
    }

    if (veut('I')) console.log('\n── I bis. Avant l\'arrivée du nuage : « pas encore lu », jamais « 1 » — 390 px');
    if (veut('I')) await essaie('Ibis', async () => {
      const etat = etatNeuf({ mainDelai: 7000 });
      const ctx = await contexte(390); const pg = await page(ctx, etat);
      await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-numeros-reglage]', { timeout: 6000 });
      const p = await pg.getAttribute('[data-numeros-reglage]', 'data-prochain');
      const t = await pg.innerText('[data-numeros-reglage]');
      dit(p === '' && /pas encore lu/.test(t), 'pas su ⇒ pas de numéro inventé', `prochain = « ${p} »`);
      await pg.waitForTimeout(8000);
      dit((await pg.getAttribute('[data-numeros-reglage]', 'data-prochain')) === '25', 'puis, le nuage arrivé : 25');
      await ctx.close().catch(() => {});
    });

    if (veut('I')) console.log('\n── I ter. C1 et C2 déjà donnés : la phrase vient de LA règle (C3), jamais « C1, C2… » — 390 px');
    if (veut('I')) await essaie('Iter', async () => {
      const etat = etatNeuf(); etat.main = mainDe({ vinted_used_numeros: [...POOL, 'C1', 'C2'] });
      const ctx = await contexte(390); const pg = await page(ctx, etat);
      await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-numeros-reglage]', { timeout: 20000 }); await pg.waitForTimeout(2500);
      await pg.click('[data-numeros-changer]'); await pg.click('[data-choix="lettre"]'); await pg.click('[data-lettre="C"]');
      await pg.waitForSelector('[data-recap-prochain]', { timeout: 3000 });
      const rp = await pg.getAttribute('[data-recap-prochain]', 'data-recap-prochain');
      await pg.click('[data-numeros-enregistrer]');
      let message = '';
      for (let i = 0; i < 20 && !message; i++) { message = await pg.evaluate(() => { const e = [...document.querySelectorAll('body *')].find((x) => x.children.length === 0 && /prochain(s)? carton/i.test(x.textContent) && !x.closest('[data-numeros-reglage]')); return e ? e.textContent.trim() : ''; }); if (!message) await pg.waitForTimeout(100); }
      dit(rp === 'C3' && /C3/.test(message) && !/C1/.test(message), 'le message dit le prochain carton calculé (C3), comme le récapitulatif', `récap ${rp} · message « ${message} »`);
      await pg.waitForTimeout(600);
      const carte = (await pg.innerText('[data-numeros-reglage]')).replace(/\s+/g, ' ');
      dit(/C3/.test(carte) && !/C1, C2/.test(carte), 'la carte ne juxtapose pas « C1, C2, C3… » au vrai prochain carton', carte);
      await ctx.close().catch(() => {});
    });

    if (veut('J')) console.log('\n── J. Ranger une paire sur une étagère, une commode, une grille — 390 px');
    if (veut('J')) await essaie('J', async () => {
      const etat = etatNeuf();
      etat.room.rooms[0].items.find((x) => x.id === 'e1').slots = { '1_0': ['B301', 'B302'] };
      const ctx = await contexte(390); const pg = await page(ctx, etat);
      await essaie('ouvrir le Stock', () => ouvrirStock(pg));
      const derniereDe = (id) => { const d = etat.ecritsRoom[etat.ecritsRoom.length - 1]; return d && d.rooms && d.rooms[0].items.find((x) => x.id === id); };
      const feuille = () => pg.evaluate(() => { const b = [...document.querySelectorAll('b')].find((x) => /depuis le bas/.test(x.textContent)); return b ? b.textContent : ''; });
      // Chaque meuble dans son propre bloc : un bloc qui lève (sur le code d'avant,
      // la case touchée reste vide) ne cache pas les suivants (« un banc ne meurt pas »).
      const auPlan = async () => { await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(300); if (await pg.$('[data-face-plan]')) { await pg.click('[data-face-plan]'); await pg.waitForTimeout(700); } };
      await essaie('J étagère', async () => {
        // Étagère : le niveau du HAUT (4ᵉ depuis le bas), colonne 3.
        await pg.click('[data-plan-poste="e1"]'); await pg.waitForSelector('[data-stock-face="e1"]', { timeout: 4000 }); await pg.waitForTimeout(300);
        await pg.click('[data-stock-face="e1"] [data-case="0_2"]');
        await pg.waitForSelector('text=Ranger une paire', { timeout: 4000 });
        const f1 = await feuille();
        await pg.click('button:has-text("N°7")'); await pg.waitForTimeout(1700);
        const e1 = derniereDe('e1');
        dit(/4ᵉ depuis le bas/.test(f1) && !!e1 && JSON.stringify(e1.slots) === JSON.stringify({ '1_0': ['B301', 'B302'], '0_2': ['7'] }),
          'étagère : N°7 va sur le niveau TOUCHÉ (4ᵉ), B301 et B302 (empilés au 3ᵉ) ne bougent pas', `feuille « ${f1} » · ${e1 ? JSON.stringify(e1.slots) : 'rien d\'écrit'}`);
        const entete = await pg.$eval('[data-stock-face="e1"]', (e) => e.innerText).catch(() => '');
        dit(/3 paires/.test(entete), 'l\'en-tête compte 3 paires (aucune effacée)');
        // Sortir N°7 : rien d'autre ne bouge.
        await pg.click('[data-stock-face="e1"] [data-case]:has-text("7")'); await pg.waitForSelector('[data-stock-fiche="7"]', { timeout: 3000 });
        await pg.click('[data-fiche-sortir]'); await pg.waitForTimeout(1700);
        const e1b = derniereDe('e1');
        dit(!!e1b && JSON.stringify(e1b.slots) === JSON.stringify({ '1_0': ['B301', 'B302'] }), 'sortir N°7 : les autres cases restent où elles sont', e1b ? JSON.stringify(e1b.slots) : '');
      });
      await essaie('J commode', async () => {
        // Commode : le tiroir du HAUT.
        await auPlan();
        await pg.click('[data-plan-poste="c1"]'); await pg.waitForSelector('[data-stock-face="c1"]', { timeout: 4000 }); await pg.waitForTimeout(300);
        await pg.click('[data-stock-face="c1"] [data-case="0_0"]'); await pg.waitForSelector('text=Ranger une paire', { timeout: 4000 });
        await pg.click('button:has-text("N°9")'); await pg.waitForTimeout(1700);
        const c1 = derniereDe('c1');
        dit(!!c1 && JSON.stringify(c1.slots) === JSON.stringify({ '0_0': ['9'] }), 'commode : N°9 va dans le tiroir du HAUT, pas dans celui du bas', c1 ? JSON.stringify(c1.slots) : '');
      });
      await essaie('J grille', async () => {
        // Grille : une boîte posée sur les autres — la feuille annonce où elle TOMBE.
        await auPlan();
        await pg.click('[data-plan-poste="g1"]'); await pg.waitForSelector('[data-stock-face="g1"]', { timeout: 4000 }); await pg.waitForTimeout(300);
        await pg.click('[data-stock-face="g1"] [data-case="0_3"]'); await pg.waitForSelector('text=Ranger une paire', { timeout: 4000 });
        const f3 = await feuille();
        await pg.click('button:has-text("N°8")'); await pg.waitForTimeout(1700);
        const g1 = derniereDe('g1');
        dit(/3ᵉ depuis le bas/.test(f3) && !!g1 && (g1.slots['6_3'] || [])[0] === '8' && (g1.slots['7_3'] || [])[0] === 'B201' && (g1.slots['8_3'] || [])[0] === 'B202',
          'grille : la boîte tombe sur les deux autres (3ᵉ), et la feuille le disait avant le choix', `feuille « ${f3} » · ${g1 ? JSON.stringify(g1.slots) : ''}`);
      });
      dit(!pg.__erreurs.length, 'aucune erreur d\'app', pg.__erreurs.join(' | '));
      await ctx.close().catch(() => {});
    });

    for (const taille of (veut('K') ? [390, 1512] : [])) {
      console.log(`\n── K. « Modifier » sur la face : les réglages s'ouvrent à l'écran — ${taille} px`);
      await essaie('K' + taille, async () => {
        const etat = etatNeuf();
        const ctx = await contexte(taille); const pg = await page(ctx, etat);
        await essaie('ouvrir le Stock', () => ouvrirStock(pg));
        await pg.click('[data-plan-poste="p1"]'); await pg.waitForSelector('[data-stock-face="p1"]', { timeout: 4000 }); await pg.waitForTimeout(400);
        await pg.click('[data-face-modifier]'); await pg.waitForTimeout(900);
        // La barre se trouve par son CONTENU (« 📦 Pile de boîtes »), pas seulement par
        // son attribut : sur le code d'avant elle existait déjà, hors de l'écran.
        const r = await pg.evaluate(() => {
          const e = document.querySelector('[data-barre-meuble]') || ([...document.querySelectorAll('span')].find((x) => /^📦 Pile de boîtes/.test(x.textContent.trim())) || {}).parentElement;
          if (!e) return null;
          const b = e.getBoundingClientRect(), t = e.firstElementChild.getBoundingClientRect();
          const hit = document.elementFromPoint(t.left + 12, t.top + t.height / 2);
          const sup = e.querySelector('[aria-label="Supprimer le meuble"]');
          return { top: Math.round(b.top), bas: Math.round(b.bottom), vh: innerHeight, vu: !!hit && e.contains(hit), dansLaFace: !!e.closest('[data-stock-face]'), sup: !!sup };
        }).catch(() => null);
        dit(!!r && r.vu && r.top >= 0 && r.top < r.vh - 80 && r.dansLaFace && r.sup, 'la barre du meuble (renommer, supprimer…) s\'ouvre SOUS « Modifier », visible sans chercher', r ? JSON.stringify(r) : 'aucune barre');
        await pg.screenshot({ timeout: 30000, path: path.join(CAPT, `stock2d-modifier-${taille}.png`) });
        await pg.click('[data-face-modifier]'); await pg.waitForTimeout(400);
        dit(!(await pg.$('[data-barre-meuble]')), 're-toucher « Modifier » la referme');
        dit((await debordement(pg)) <= 1 && !pg.__erreurs.length, 'sans débordement ni erreur', pg.__erreurs.join(' | '));
        await ctx.close().catch(() => {});
      });
    }

    if (veut('L')) console.log('\n── L. Glisser une pile au-delà du mur, sur le plan — 1512 px');
    if (veut('L')) await essaie('L', async () => {
      const etat = etatNeuf();
      const ctx = await contexte(1512); const pg = await page(ctx, etat);
      await essaie('ouvrir le Stock', () => ouvrirStock(pg));
      await pg.click('summary:has-text("Aménager la pièce")'); await pg.waitForTimeout(300);
      // La note se lit par son CONTENU aussi (le code d'avant n'avait pas l'attribut).
      const note = () => pg.evaluate(() => { const e = document.querySelector('[data-amenager-note]') || [...document.querySelectorAll('span')].find((x) => x.children.length === 0 && /verrouill/.test(x.textContent)); return e ? e.innerText : ''; });
      const note0 = await note();
      await pg.click('button:has-text("Déplacer les meubles")'); await pg.waitForTimeout(300);
      const note1 = await note();
      dit(!!note0 && !/tourner la vue/.test(note0 + note1), 'en vue Plan, le texte ne parle pas de « tourner la vue » (ça ne fait rien en 2D)', `« ${note0} » · « ${note1} »`);
      await pg.$eval('[data-stock-plan]', (e) => e.scrollIntoView({ block: 'center' })); await pg.waitForTimeout(300);
      const b = await pg.$eval('[data-plan-poste="p1"]', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await pg.mouse.move(b.x, b.y); await pg.mouse.down();
      for (let i = 1; i <= 20; i++) { await pg.mouse.move(b.x + i * 40, b.y + i * 2); await pg.waitForTimeout(20); }
      await pg.mouse.up(); await pg.waitForTimeout(1800);
      const der = etat.ecritsRoom[etat.ecritsRoom.length - 1];
      const p1 = der && der.rooms[0].items.find((x) => x.id === 'p1');
      dit(!!p1 && p1.x >= 0 && p1.x + p1.w <= 17 + 1e-6 && p1.y >= 0 && p1.y + p1.h <= 10 + 1e-6 && p1.x > 3.5, 'la pile glissée vers le mur s\'arrête AU mur (dans les 17 m de la pièce)', p1 ? JSON.stringify({ x: p1.x, y: p1.y, w: p1.w }) : 'rien d\'écrit');
      const ecran = await pg.$eval('[data-plan-poste="p1"] > span', (e) => e.getBoundingClientRect().right).catch(() => 0);
      const bord = await pg.$eval('[data-stock-plan]', (e) => e.getBoundingClientRect().right);
      dit(ecran <= bord + 1, 'et elle est dessinée DANS le plan', `${Math.round(ecran)} / ${Math.round(bord)} px`);
      await ctx.close().catch(() => {});
    });

    console.log('\n── Captures en sombre (plan, face, assistant)');
    for (const taille of (veut('S') ? [390, 1512] : [])) {
      await essaie('sombre' + taille, async () => {
        const etat = etatNeuf(); etat.main = mainDe({ vinted_dark: true });
        const ctx = await contexte(taille, { vinted_dark: 'true', vrm_bascule_mineral_v1: '1' }); const pg = await page(ctx, etat);
        await essaie('ouvrir le Stock', () => ouvrirStock(pg));
        await pg.screenshot({ timeout: 30000, path: path.join(CAPT, `stock2d-plan-sombre-${taille}.png`) });
        await pg.click('[data-plan-poste="g1"]'); await pg.waitForSelector('[data-stock-face="g1"]', { timeout: 4000 }); await pose(pg);
        await pg.screenshot({ timeout: 30000, path: path.join(CAPT, `stock2d-face-sombre-${taille}.png`) });
        dit((await debordement(pg)) <= 1 && !(await mort(pg)) && !pg.__erreurs.length, `sombre ${taille} px : rendu vivant, sans débordement`);
        await ctx.close().catch(() => {});
      });
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 200)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ stock 2D + numéros assistés : ${ko} rouge(s)` : '\n✅ stock 2D + numéros assistés : tout est vert');
  process.exit(ko ? 1 : 0);
})();
