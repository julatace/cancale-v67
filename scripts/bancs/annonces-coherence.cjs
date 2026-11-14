// Banc : ANNONCES — CHANTIER C (5 nov., revue de cohérence 2.5 à 2.10).
//
// Données INVENTÉES (le dépôt est public) ; 390 px tactile et 1512 px, clair et
// sombre ; un faux pont d'extension (onglet Vinted sur le compte 111). Il MESURE
// les règles du chantier, jamais un libellé de commentaire :
//   U. UNE feuille d'actions : « Republier… » (barre) et l'ancien chemin « Republier »
//      mènent à la vue « Republier » d'Annonces (lot AL, 9 nov. : plus d'entrée de menu) ;
//      « Sélectionner » garde la feuille « Actions » ; aucune autre feuille d'actions
//      (`[data-actions-menu]`) ; la feuille « Actions » porte QUATRE tuiles, dans
//      l'ordre : Republier · Modifier prix ou titre · Mettre en brouillon · Mettre
//      en ligne ; une raison commune est dite UNE fois (en tête), jamais sous
//      chaque tuile ; la raison propre d'une tuile reste sous elle ;
//   G. la carte : deux gestes visibles + « … » (≤ 3 commandes dans la rangée),
//      plus de « Baisser à » à part, « … » ouvre une feuille où sont les autres
//      gestes (≥ 44 px) ; aucun TEXTE bleu sur la carte (l'accent reste rare) ;
//      les cases chiffrées en mots (« Accepter dès », « Refuser sous »…), plus de
//      « refuse < » ni de minuscule en tête ;
//   P. le prix d'achat : UN bandeau « N/M » qui compte juste (données inventées :
//      2 connus sur 6), « Compléter » ouvre la saisie ; la case de la carte est
//      GRISE (ni bord ni libellé ambre) ;
//   N. `Numero` partout (carte, Sélectionner, feuille Actions), jamais une pastille
//      claire en sombre ; `PhotoVide` pour chaque annonce sans photo ;
//   B. la barre d'outils : la recherche partagée (`ChampRecherche`), les boutons
//      du MÊME dessin (fond, rayon, hauteur), 44 px au doigt ; au téléphone, sur
//      UNE rangée avec la recherche, rien hors de l'écran ; « Sélectionner »
//      entièrement visible au téléphone ;
//   S. « sélection » ne nomme plus le filtre (« N annonces affichées », « Tout
//      afficher ») ;
//   F. aucun débordement horizontal, aucune erreur de page.
// §6.1 : sur `claude/project-review-nsk5su` (git archive, build à part), rouge.
require('../_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9017;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'annonces-coherence');
fs.mkdirSync(SHOTS, { recursive: true });
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const auj = new Date(); const s = Math.floor(auj / 1000);
const ann = (id, o) => Object.assign({ id, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 40, favourite_count: 0, nPhotos: 5, descLen: 60, color1: 'Blanc', catalog_id: 1242, created_at_ts: s - 12 * 86400 }, o);
const ITEMS_111 = [
  ann(9101, { title: 'Nike Air Max 90 blanche taille 42' }),
  ann(9102, { title: 'Salomon XT-6 grise taille 41', brand_title: 'Salomon', price: { amount: '120.0', currency_code: 'EUR' }, created_at_ts: s - 45 * 86400 }),
  // Titre très long : rien ne doit déborder.
  ann(9103, { title: 'Adidas Samba OG noire et blanche semelle gomme édition limitée très longue taille 39', brand_title: 'Adidas', size_title: '39' }),
  ann(9104, { title: 'Asics Gel-Kayano 14 argent taille 43', brand_title: 'Asics' }),
];
const ITEMS_222 = [
  ann(9301, { title: 'New Balance 550 crème taille 40', brand_title: 'New Balance' }),
  ann(9302, { title: 'Puma Speedcat rouge taille 38', brand_title: 'Puma' }),
  ann(9303, { title: 'Brouillon du second compte', is_draft: true }),
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_essai', domain: 'www.vinted.fr', updated_at: auj.toISOString() }, { id: 2, vinted_user_id: '222', login: 'autre_essai', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
// Deux prix d'achat connus sur six annonces en ligne (9102, 9301). (12 nov.) Celui de la N°11 est passé à la
// N°12 : la paire qui dort a besoin de son prix d'achat pour qu'un conseil de baisse soit proposé.
const MAIN = { vinted_annonce_numeros: { 9101: { numero: '11' }, 9102: { numero: '12', buyPrice: '60' }, 9103: { numero: '13' }, 9301: { numero: '21', buyPrice: '25' }, 9302: { numero: '22' } } };
const ATTENDU_ACHATS = '2/6';
const lignes = () => [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS_111, pagination: { total_entries: ITEMS_111.length } } } },
  { id: 'harvest_222_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS_222, pagination: { total_entries: ITEMS_222.length } } } },
];
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.322.0';
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_essai' }, cmds: {} } });
    if (d.__vmr === 'cmd') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
  });
  post({ __vmr: 'ready', version: o.version });
};

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (!c) ko++; else ok++; console.log((c ? 'OK  ' : 'KO  ') + m + (d !== undefined && d !== '' && !c ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec un autre BANC_PORT'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^(data|meta)(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
async function contexte(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', sb ? 'true' : 'false'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: VERSION });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const t = r.request().resourceType();
    if (t === 'document') return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>vinted (banc)</title>' });
    if (['image', 'media', 'font'].includes(t)) return r.abort();
    return r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const rows = lignes();
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
const clic = async (pg, sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click({ timeout: 4000 }).catch(async () => { await pg.$eval(sel, (x) => x.click()); }); };
const fermer = async (pg) => { const x = pg.locator('[role="dialog"] button[aria-label="Fermer"]').last(); if (await x.count()) await x.click().catch(() => pg.keyboard.press('Escape')); else await pg.keyboard.press('Escape'); await pg.waitForTimeout(350); };
// Couleurs : le bleu d'accent (aplat et texte, clair et sombre) et l'ambre.
const BLEUS = ['rgb(0, 113, 227)', 'rgb(10, 132, 255)', 'rgb(0, 102, 204)', 'rgb(64, 156, 255)'];
const AMBRES = ['rgb(178, 80, 0)', 'rgb(255, 179, 64)', 'rgb(201, 52, 0)', 'rgb(255, 159, 10)'];
const TUILES = ['Republier', 'Modifier prix ou titre', 'Mettre en brouillon', 'Mettre en ligne'];

async function ouvrirAnnonces(pg) {
  await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-carte-annonce]').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  for (let i = 0; i < 30; i++) { if ((await pg.locator('[data-carte-annonce]').count()) >= 6) break; await pg.waitForTimeout(250); }
  // (9 nov.) Depuis l'attente d'écran (6 nov., src/AttenteEcran.jsx), les cartes sont MONTÉES
  // invisibles (`visibility:hidden`) avant que l'écran s'ouvre : « attachées » ne veut plus dire
  // « montrées ». On attend que l'écran de démarrage soit parti et que l'écran soit OUVERT.
  for (let i = 0; i < 80; i++) {
    const pret = await pg.evaluate(() => { const e = document.querySelector('[data-attente-ecran="cat_annonces"]'); return !document.getElementById('vrm-demarrage') && !!e && /pret|plafond/.test(e.getAttribute('data-attente') || ''); }).catch(() => false);
    if (pret) break; await pg.waitForTimeout(250);
  }
  await pg.waitForTimeout(600);
}
async function vueSelection(pg) {
  if (!(await pg.$('[data-selection-vue="tout"]'))) await clic(pg, '[data-vue-selection]');
  await pg.waitForSelector('[data-selection-vue]', { timeout: 6000 }).catch(() => {});
  for (let i = 0; i < 30; i++) { if (await pg.$('[data-selection-annonce="9301"]')) break; await pg.waitForTimeout(200); }
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const tel = vp.width < 600;
        const T = `${vp.width}${sombre ? ' sombre' : ' clair'}`;
        const nomF = (x) => path.join(SHOTS, `ac-${vp.width}-${sombre ? 'sombre' : 'clair'}-${x}.png`);
        console.log(`── ${T}`);
        const { ctx, pg, errs } = await contexte(b, vp, sombre);
        try {
          await ouvrirAnnonces(pg);
          const nCartes = await pg.locator('[data-carte-annonce]').count();
          dit(nCartes >= 6, `F ${T} les annonces inventées sont là`, String(nCartes));
          await pg.screenshot({ path: nomF('haut') });

          // ── B : la barre d'outils ──
          const barre = await pg.evaluate(() => {
            const t = document.querySelector('.vrm-ann-toolbar'); if (!t) return null;
            const vw = document.documentElement.clientWidth;
            const rech = t.querySelector('[data-champ-recherche]');
            const bts = [...t.querySelectorAll('button, label, select')].filter((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !x.closest('[data-champ-recherche]') && !x.closest('.vrm-menu-flottant') && !x.closest('[data-refaire-ouvrir]') && x.tagName !== 'SELECT' && !(x.tagName === 'BUTTON' && x.closest('label')); })
              .filter((x) => !x.closest('[data-compte-rendu]') && !x.hasAttribute('data-refaire-ouvrir'));
            const st = bts.map((x) => { const c = getComputedStyle(x), r = x.getBoundingClientRect(); return { t: (x.getAttribute('aria-label') || x.textContent || '').trim().slice(0, 18), bg: c.backgroundColor, rad: c.borderTopLeftRadius, h: Math.round(r.height), top: Math.round(r.top), right: Math.round(r.right), bord: c.borderTopWidth }; });
            const rr = rech && rech.getBoundingClientRect();
            return { rech: !!rech, rechTop: rr ? Math.round(rr.top) : null, rechH: rr ? Math.round(rr.height) : null, st, vw };
          });
          dit(barre && barre.rech, `B ${T} la recherche est le champ partagé (ChampRecherche)`);
          if (barre) {
            const formes = new Set(barre.st.map((x) => `${x.bg}|${x.rad}|${x.h}|${x.bord}`));
            dit(barre.st.length >= 3 && formes.size === 1, `B ${T} les ${barre.st.length} boutons de la barre ont UN dessin (fond, rayon, hauteur, bord)`, JSON.stringify(barre.st));
            dit(barre.st.every((x) => x.h >= (tel ? 43.5 : 35.5)), `B ${T} hauteur ${tel ? '44' : '36'} px`, barre.st.map((x) => x.h).join(','));
            dit(barre.st.every((x) => x.right <= barre.vw), `B ${T} aucun bouton de la barre hors de l'écran`, barre.st.map((x) => x.right).join(','));
            if (tel) dit(barre.st.every((x) => Math.abs(x.top - barre.rechTop) <= 2 + Math.abs(x.h - barre.rechH)), `B ${T} au téléphone : recherche et boutons sur UNE rangée`, JSON.stringify(barre.st.map((x) => x.top)) + ' / ' + barre.rechTop);
          }
          const selVis = await pg.evaluate(() => {
            const x = document.querySelector('[data-vue-selection]'); if (!x) return null;
            const r = x.getBoundingClientRect(); const vw = document.documentElement.clientWidth;
            let p = x.parentElement; let cont = null; while (p) { const c = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(c.overflowX)) { cont = p.getBoundingClientRect(); break; } p = p.parentElement; }
            return { gauche: r.left, droite: r.right, vw, cDroite: cont ? cont.right : vw, cGauche: cont ? cont.left : 0 };
          });
          dit(selVis && selVis.droite <= Math.min(selVis.vw, selVis.cDroite) + 0.5 && selVis.gauche >= selVis.cGauche - 0.5, `B ${T} « Sélectionner » entièrement visible`, JSON.stringify(selVis));

          // ── P : le prix d'achat ──
          // (9 nov.) Depuis « le prochain geste en tête » (6 nov., src/prochainGesteAnnonces.js) :
          // « Prix d'achat N/M » se dit UNE fois — dans la ligne du geste quand c'est lui
          // (`data-ann-prochain-geste="prix"`), sinon dans le bandeau `data-ann-achats`. On compte
          // les deux endroits : exactement un, qui dit 2/6 et porte « Compléter ».
          // (14 nov., refonte des listes — AJOUT 3) Au téléphone les alertes vivent dans la feuille « • À faire · N » : on l'ouvre comme lui.
          const aFaire = await pg.$('[data-ui-afaire]');
          if (aFaire) { await aFaire.click().catch(() => {}); await pg.waitForSelector('[data-ui-afaire-feuille] [data-ui-afaire-corps]', { timeout: 5000 }).catch(() => {}); await pg.waitForTimeout(300); }
          const achats = await pg.evaluate(() => [...document.querySelectorAll('[data-ann-achats], [data-ann-prochain-geste="prix"]')].filter((x) => x.getBoundingClientRect().height > 0).map((x) => (x.getAttribute('data-ann-achats') || 'geste') + '|' + x.innerText.replace(/\s+/g, ' ')));
          dit(achats.length === 1 && /(^|\D)2\/6(\D|$)/.test(achats[0]) && /Compléter/.test(achats[0]) && (achats[0].startsWith('2/6|') || achats[0].startsWith('geste|')), `P ${T} UN bandeau « Prix d'achat · ${'2/6'} → Compléter »`, JSON.stringify(achats));
          if (aFaire) { await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForSelector('[data-ui-afaire-feuille]', { state: 'detached', timeout: 5000 }).catch(() => {}); }
          if (achats.length === 1) {
            await clic(pg, achats[0].startsWith('geste|') ? '[data-ann-prochain-geste="prix"] [data-ann-prochain-geste-bouton]' : '[data-ann-achats-completer]');
            const saisie = await pg.waitForSelector('[data-fillbuy-feuille]', { timeout: 4000 }).then(() => true).catch(() => false);
            dit(saisie, `P ${T} « Compléter » ouvre la saisie des prix d'achat`);
            if (saisie) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(350); if (await pg.$('[data-fillbuy-feuille]')) await pg.$eval('[data-fillbuy-feuille]', (x) => x.click()).catch(() => {}); await pg.waitForTimeout(250); }
          }
          const caseAchat = await pg.evaluate(({ AMBRES }) => [...document.querySelectorAll('[data-carte-annonce] [data-fiche-achat="inconnu"]')].map((c) => { const cs = getComputedStyle(c); const lab = c.querySelector('.vrm-fiche-etat-haut > span'); return { bord: cs.borderTopColor, lab: lab ? getComputedStyle(lab).color : '', vis: c.getBoundingClientRect().height > 0 }; }).filter((x) => x.vis).filter((x) => AMBRES.some((a) => x.bord.startsWith(a.slice(0, -1)) || x.lab.startsWith(a.slice(0, -1)))), { AMBRES });
          dit(caseAchat.length === 0, `P ${T} la case « prix d'achat » de la carte est grise (ni bord ni libellé ambre)`, JSON.stringify(caseAchat.slice(0, 2)));

          // ── N : Numero et PhotoVide sur les cartes ──
          const nums = await pg.evaluate(() => [...document.querySelectorAll('[data-carte-annonce] [data-fiche-num]')].filter((x) => x.getAttribute('data-fiche-num')).map((x) => { const n = x.querySelector('.vrm-num'); if (!n) return { n: x.getAttribute('data-fiche-num'), num: false }; const c = getComputedStyle(n).backgroundColor; const m = c.match(/\d+(\.\d+)?/g).map(Number); const lum = (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; return { n: x.getAttribute('data-fiche-num'), num: true, lum: Math.round(lum * 100) / 100, rad: getComputedStyle(n).borderTopLeftRadius }; }));
          dit(nums.length >= 5 && nums.every((x) => x.num), `N ${T} chaque N° de carte est la pastille partagée Numero`, JSON.stringify(nums.slice(0, 3)));
          dit(nums.every((x) => !x.num || x.lum < 0.5), `N ${T} la pastille N° n'est jamais claire (encre en clair, gris élevé en sombre)`, JSON.stringify(nums.map((x) => x.lum)));
          const vides = await pg.evaluate(() => [...document.querySelectorAll('[data-carte-annonce] [data-fiche-photo]')].map((a) => !!a.querySelector('[data-photo-vide]') || !!a.querySelector('img')));
          dit(vides.length >= 6 && vides.every(Boolean), `N ${T} chaque carte sans photo porte PhotoVide`, JSON.stringify(vides));

          // ── G : la carte, deux gestes + « … » ──
          const g = await pg.evaluate(({ BLEUS }) => {
            const out = [];
            for (const c of document.querySelectorAll('[data-carte-annonce]')) {
              const rg = c.querySelector('[data-fiche-gestes]');
              const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(x).visibility !== 'hidden'; };
              const cmd = rg ? [...rg.querySelectorAll(':scope > button, :scope > a')] : [];
              let bleu = [];
              const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
              for (let n = w.nextNode(); n; n = w.nextNode()) { if (!/\S/.test(n.nodeValue) || !n.parentElement || !vis(n.parentElement)) continue; const col = getComputedStyle(n.parentElement).color; if (BLEUS.includes(col)) bleu.push(n.nodeValue.trim().slice(0, 20)); }
              out.push({ id: c.getAttribute('data-carte-annonce'), n: cmd.length, plus: !!(rg && rg.querySelector('[data-fiche-menu-ouvrir]')), baisser: /Baisser à/.test(c.innerText || c.textContent), bleu, libs: [...c.querySelectorAll('[data-chiffres] .vrm-fiche-cell > span:first-child')].map((x) => x.textContent.trim()) });
            }
            return out;
          }, { BLEUS });
          dit(g.length >= 6 && g.every((x) => x.n <= 3 && x.plus), `G ${T} chaque carte : deux gestes au plus, puis « … »`, JSON.stringify(g.map((x) => x.id + ':' + x.n + (x.plus ? '+…' : ''))));
          dit(g.every((x) => !x.baisser), `G ${T} « Baisser à » ne vit plus à part (un seul « Changer le prix »)`);
          dit(g.every((x) => !x.bleu.length), `G ${T} aucun texte bleu sur la carte`, JSON.stringify(g.filter((x) => x.bleu.length).map((x) => x.id + ':' + x.bleu.join('/'))));
          const libs = g[0] ? g[0].libs : [];
          dit(libs.length === 4 && libs.every((l) => /^[A-ZÀ-Ý]/.test(l) && !/[<>]/.test(l)), `G ${T} les cases chiffrées en mots (majuscule, sans « < »)`, JSON.stringify(libs));
          // « … » : la feuille des autres gestes.
          const carteTest = '9102';
          if (tel) await pg.evaluate((id) => { const c = document.querySelector(`[data-carte-annonce="${id}"]`); const bt = c && c.querySelector('[data-fiche-plus-bouton][aria-expanded="false"]'); if (bt) bt.click(); }, carteTest);
          await pg.waitForTimeout(250);
          const prixGeste = await pg.evaluate((id) => { const c = document.querySelector(`[data-carte-annonce="${id}"]`); const p = c && c.querySelector('[data-annonce-prix-partout], [data-annonce-prix-vinted]'); return p ? { t: p.innerText.replace(/\s+/g, ' '), conseil: (p.querySelector('[data-prix-conseille]') || {}).textContent || '' } : null; }, carteTest);
          // (12 nov., conseil mesuré) 120 €, 45 j, achat 60 € ⇒ « Baisser à 108 € ? » (−10 % au plus) et sa raison.
          dit(prixGeste && /Changer le prix/.test(prixGeste.t) && /^Baisser à 108\s€\s\?/.test(prixGeste.conseil) && /en ligne depuis 45 j/.test(prixGeste.conseil), `G ${T} la paire qui dort : « Changer le prix » propose « Baisser à 108 € ? · en ligne depuis 45 j », sans bouton à part`, JSON.stringify(prixGeste));
          await clic(pg, `[data-carte-annonce="${carteTest}"] [data-fiche-menu-ouvrir]`);
          await pg.waitForSelector('[data-fiche-menu]', { timeout: 4000 }).catch(() => {});
          const menu = await pg.evaluate(() => { const m = document.querySelector('[data-fiche-menu]'); if (!m) return null; const l = [...m.querySelectorAll('.vrm-fiche-menu > button, .vrm-fiche-menu > a')]; return { n: l.length, t: l.map((x) => x.textContent.trim()), h: l.map((x) => Math.round(x.getBoundingClientRect().height)), num: !!m.querySelector('.vrm-num') }; });
          dit(menu && menu.n >= 5 && menu.t.some((t) => /Relier un achat/.test(t)) && menu.t.some((t) => /Marquer vendue/.test(t)) && menu.t.some((t) => /Passeport/.test(t)), `G ${T} « … » ouvre une feuille avec les autres gestes`, JSON.stringify(menu));
          dit(menu && menu.h.every((h) => h >= 43.5), `G ${T} les gestes de la feuille font 44 px au moins`, menu ? menu.h.join(',') : '');
          dit(menu && menu.num, `N ${T} la feuille « … » nomme la paire par sa pastille Numero`);
          await pg.screenshot({ path: nomF('carte-menu') });
          await fermer(pg);
          if (!tel) { const carte = pg.locator(`[data-carte-annonce="${carteTest}"]`); await carte.scrollIntoViewIfNeeded().catch(() => {}); await carte.screenshot({ path: nomF('carte') }).catch(() => {}); }
          else { const carte = pg.locator(`[data-carte-annonce="${carteTest}"]`); await carte.scrollIntoViewIfNeeded().catch(() => {}); await pg.screenshot({ path: nomF('carte') }); }

          // ── S : le filtre ne s'appelle plus « sélection » ──
          await pg.evaluate(() => window.scrollTo(0, 0));
          await pg.selectOption('.vrm-ann-toolbar select', 'price_asc').catch(() => {});
          await pg.waitForTimeout(300);
          const recap = await pg.evaluate(() => { const r = document.querySelector('.vrm-filter-recap'); return r ? r.innerText.replace(/\s+/g, ' ') : ''; });
          dit(/affichée/.test(recap) && !/s[ée]lection/i.test(recap) && /Tout afficher/.test(recap), `S ${T} le filtre dit « N annonces affichées · Tout afficher »`, recap);
          await pg.screenshot({ path: nomF('filtre') });

          // ── U : « Republier… » mène à la vue « Republier » (lot AL) ; une seule feuille d'actions ──
          await clic(pg, '[data-actions-ouvrir]');
          await pg.waitForTimeout(500);
          const apres = await pg.evaluate(() => ({ vue: !!document.querySelector('[data-selection-vue="republier"]'), menu: !!document.querySelector('[data-actions-menu]') }));
          dit(apres.vue && !apres.menu, `U ${T} « Republier… » mène à la vue « Republier » (aucune autre feuille)`, JSON.stringify(apres));
          await vueSelection(pg);
          const selN = await pg.evaluate(() => { const l = [...document.querySelectorAll('[data-selection-annonce]')]; return { n: l.length, num: l.filter((x) => x.querySelector('.vrm-num')).length, vide: l.filter((x) => x.querySelector('[data-photo-vide]')).length, img: l.filter((x) => x.querySelector('img')).length }; });
          dit(selN.n >= 6 && selN.num >= 5 && selN.vide + selN.img === selN.n, `N ${T} Sélectionner : N° en Numero, PhotoVide sans photo`, JSON.stringify(selN));
          await pg.screenshot({ path: nomF('selection') });
          // Deux comptes mélangés : la raison UNE fois, en tête.
          await clic(pg, '[data-selection-annonce="9101"] input'); await clic(pg, '[data-selection-annonce="9301"] input');
          await clic(pg, '[data-actions-possibles]');
          await pg.waitForSelector('[data-actions-selection]', { timeout: 4000 }).catch(() => {});
          const f1 = await pg.evaluate(() => { const f = document.querySelector('[data-actions-selection]'); if (!f) return null; const d = f.closest('[role="dialog"]') || f; const t = d.innerText; return { tuiles: [...f.querySelectorAll('.vrm-act-choix')].map((x) => (x.querySelector('b') || x).textContent.trim()), oks: [...f.querySelectorAll('.vrm-act-choix')].map((x) => x.getAttribute('data-action-sel-ok')), raisons: (t.match(/2 comptes/g) || []).length, tete: !!f.querySelector('[data-actions-raison]'), titre: (d.querySelector('h2') || {}).textContent || '' }; });
          dit(f1 && JSON.stringify(f1.tuiles) === JSON.stringify(TUILES), `U ${T} QUATRE tuiles, dans l'ordre : ${TUILES.join(' · ')}`, f1 ? JSON.stringify(f1.tuiles) : 'pas de feuille');
          dit(f1 && f1.oks.every((x) => x === 'non') && f1.raisons === 1 && f1.tete, `U ${T} deux comptes : tout grisé, la raison dite UNE fois, en tête`, f1 ? `${f1.raisons} fois, tête ${f1.tete}` : '');
          dit(f1 && /Actions · 2 annonces/.test(f1.titre), `U ${T} le titre de la feuille : « Actions · 2 annonces »`, f1 && f1.titre);
          await pg.screenshot({ path: nomF('actions-raison') });
          await fermer(pg);
          // Un compte, deux annonces en ligne : trois tuiles possibles, « Mettre en ligne » garde SA raison.
          await clic(pg, '[data-selection-annonce="9301"] input'); await clic(pg, '[data-selection-annonce="9102"] input');
          await clic(pg, '[data-actions-possibles]');
          await pg.waitForSelector('[data-actions-selection="2"]', { timeout: 4000 }).catch(() => {});
          const f2 = await pg.evaluate(() => { const f = document.querySelector('[data-actions-selection]'); if (!f) return null; const tu = [...f.querySelectorAll('.vrm-act-choix')]; return { ok: Object.fromEntries(tu.map((x) => [x.getAttribute('data-action-sel'), x.getAttribute('data-action-sel-ok')])), sousEnLigne: ((f.querySelector('[data-action-sel="enLigne"] span') || {}).textContent || ''), tete: !!f.querySelector('[data-actions-raison]'), petits: [...f.closest('[role="dialog"]').querySelectorAll('button, a')].filter((x) => { const r = x.getBoundingClientRect(); return r.height > 0 && r.height < 43.5; }).map((x) => x.textContent.trim().slice(0, 20)), nums: f.querySelectorAll('[data-act-paire] .vrm-num').length }; });
          dit(f2 && f2.ok.recreer === 'oui' && f2.ok.modifier === 'oui' && f2.ok.versBrouillon === 'oui' && f2.ok.enLigne === 'non' && /brouillons/.test(f2.sousEnLigne) && !f2.tete, `U ${T} en ligne, un compte : trois possibles ; « Mettre en ligne » dit SA raison sous elle`, JSON.stringify(f2));
          dit(f2 && f2.nums === 2, `N ${T} « Avant de lancer » : chaque paire par sa pastille Numero`, f2 && String(f2.nums));
          dit(f2 && !f2.petits.length, `F ${T} cibles ≥ 44 px dans la feuille Actions`, f2 && f2.petits.join(' | '));
          await pg.screenshot({ path: nomF('actions') });
          await fermer(pg);

          // ── U : l'ancien chemin « Republier » (lot AL : plus une entrée du menu, un lien) ──
          await pg.goto(`http://localhost:${PORT}/?tab=republier`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('[data-selection-vue="republier"]', { timeout: 15000 }).catch(() => {});
          const viaMenu = await pg.evaluate(() => ({ vue: !!document.querySelector('[data-selection-vue="republier"]'), menu: !!document.querySelector('[data-actions-menu]'), entree: !!document.querySelector('[data-nav-entree="republier"]') }));
          dit(viaMenu.vue && !viaMenu.menu && !viaMenu.entree, `U ${T} l'ancien lien « Republier » mène à la vue « Republier » d'Annonces (plus d'entrée de menu)`, JSON.stringify(viaMenu));

          const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          dit(deb <= 1, `F ${T} aucun débordement horizontal`, String(deb));
          dit(!errs.length, `F ${T} aucune erreur de page`, errs.slice(0, 2).join(' | '));
        } catch (e) { dit(false, `${T} le parcours s'arrête`, e.message.split('\n')[0]); await pg.screenshot({ path: nomF('erreur') }).catch(() => {}); }
        await ctx.close();
      }
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\nKO  ${ko} rouge(s), ${ok} vert(s) — captures : ${SHOTS}` : `\nOK  annonces (chantier C) : ${ok} verts — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
