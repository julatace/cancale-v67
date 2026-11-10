require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « PHOTO EN GRAND · ACHATS · FACTURE JOINTE » (10 nov., lot AN)
//
//  Julien (9 nov.) : « quand on clique sur la photo de l'article cela nous mette
//  la photo en grand, sur ordi ou tel, là c'est pour toute l'app » ; « dans les
//  achats je veux que la mise en page soit beaucoup mieux et plus belle » ; « je
//  veux que l'on puisse, si on veut, mettre une facture d'achat qui ne provient
//  pas de Vinted ».
//
//  Données INVENTÉES (dépôt public), photos dessinées par le banc (SVG). 390 px
//  tactile SOMBRE et 1512 px clair. Il juge des valeurs rendues (§6.4) :
//   V1 sur 5 écrans (Achats, Annonces, Ventes, Colis, Ma journée) : toucher une
//      vignette d'article ouvre LA visionneuse (`[data-visionneuse]`), fond noir,
//      plein écran, au-dessus de tout ; l'écran sous elle n'a pas changé ;
//   V2 une annonce à 3 photos : compteur « n/3 », flèche, clavier (←/→) ou
//      glisser changent de photo ; une photo seule : ni flèche ni compteur ;
//   V3 zoom : double toucher (téléphone) / double clic et molette (ordinateur) ;
//   V4 fermer : le RETOUR du navigateur (téléphone) ou Échap, la croix, un toucher
//      à côté de la photo (SUR elle : rien, le double toucher zoome) ; on
//      reste sur le même écran ;
//   V5 le reste de la rangée garde son geste : la vignette n'ouvre pas le menu
//      ⋯ d'un achat ; le ⋯ l'ouvre toujours ;
//   V6 image absente (404) ⇒ rien ne s'ouvre ;
//   A1 Achats : une rangée par achat, plus récent en haut parmi « Tous » d'une même
//      étape, vignette ≥ 56 px, prix calé à droite et tabulaire, l'état en UNE
//      pastille (fond rempli, rayon ≥ moitié de la hauteur), groupe rayon ≥ 22 ;
//   A2 aucune phrase de plus de 12 mots dans une rangée d'achat ;
//   F1 « Joindre une facture » (menu ⋯) : une photo part dans SA ligne
//      (`achat_facture_tx_<n°>`, owner = la session, id par identité), la rangée
//      dit « Facture jointe », la toucher l'ouvre dans la visionneuse ;
//   F2 un PDF : la rangée le dit (`data-achat-facture-jointe="pdf"`) ; un fichier
//      trop gros ou d'un autre type n'écrit RIEN et le dit ;
//   F3 la liste des factures ne rapatrie JAMAIS le contenu (pas de `select=data`,
//      ni `b64`) : les octets ne partent qu'au toucher ;
//   F4 « Ajouter un achat » (hors Vinted) : la facture se joint au formulaire et
//      apparaît sur l'achat saisi.
//  `SHOTS=dossier` range les captures (à REGARDER, §6.2). `BANC_DIST`, `BANC_PORT`, `PA_VUES`,
//  `BANC_SEUL=V,A,F`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4797;
const SHOTS = process.env.SHOTS || '';
const SEUL = (process.env.BANC_SEUL || 'V,A,F').split(',');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const MAINTENANT = Date.now();
const iso = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const PH = (n) => `http://localhost:${PORT}/ph/${n}.svg`;

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '  ✅ ' : '  ❌ '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 300) : ''}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0]); } };

// ── La base inventée ────────────────────────────────────────────────────────
const COULEURS = ['#3a6ea5', '#c97b2a', '#4f8a5b', '#8a4f7d', '#a33b3b', '#2f2f2f', '#6b8e23', '#b0a090'];
const annonce = (i, n) => ({ id: 51000 + i, title: ['Nike Air Max 90 blanche', 'Adidas Samba OG noire', 'New Balance 550 crème', 'Asics Gel-1130 argent'][i % 4] + ' taille ' + (40 + i),
  price: { amount: String(60 + i * 5) + '.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false,
  photo: PH(`L${i}-0`), photos: Array.from({ length: n }, (_, k) => ({ url: PH(`L${i}-${k}`), full_size_url: PH(`L${i}-${k}`) })),
  brand_title: 'Nike', size_title: String(40 + i), status: 'Très bon état', view_count: 10, favourite_count: 1, created_at_ts: Math.floor((MAINTENANT - (i + 1) * 86400000) / 1000) });
const LISTINGS = [annonce(0, 3), annonce(1, 1), annonce(2, 2), annonce(3, 1)];
const vente = (i, statut, tus, j) => ({ transaction_id: 62000 + i, title: `Adidas Gazelle bleue taille ${41 + i}`, price: { amount: String(70 + i * 3), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: iso(j), photo: PH(`V${i}`) });
const VENTES = [vente(0, 'Bordereau envoyé au vendeur', 'needs_action', 0.3), vente(1, "Colis en cours d'acheminement", 'waiting', 2), vente(2, 'Commande finalisée', 'completed', 6)];
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const achat = (i, statut, tus, j, photo) => ({ transaction_id: 73000 + i, conversation_id: 84000 + i, title: ['Jordan 1 Mid chicago', 'Salomon XT-6 grise', 'Nike Dunk Low panda', 'Asics Gel-Kayano 14 argent', 'Puma Speedcat rouge'][i] + ' taille ' + (41 + i),
  price: { amount: String(35 + i * 6), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: iso(j), photo: photo === undefined ? PH(`A${i}`) : photo });
const ACHATS = [achat(0, RELAIS_ST, 'needs_action', 4), achat(1, 'Le vendeur a expédié la commande', 'waiting', 2), achat(2, 'Le vendeur a expédié la commande', 'waiting', 1),
  achat(3, 'Commande finalisée', 'completed', 20), achat(4, 'Commande finalisée', 'completed', 9, PH('absente'))];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'vendeuse_a', domain: 'www.vinted.fr', updated_at: iso(0), created_at: iso(30) }];
const base = () => [
  { id: 'main', data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, vinted_annonce_numeros: Object.fromEntries(LISTINGS.map((a, i) => [a.id, { numero: String(i + 1) }])) } },
  { id: 'harvest_111_listings', data: { capturedAt: iso(0.01), payload: { items: LISTINGS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0.01), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(0.01), payload: { my_orders: ACHATS } } },
  { id: 'email_bord_62000', data: { transaction: '62000', filename: 'bordereau-62000.pdf', pdfB64: 'JVBERi0x', modele: VENTES[0].title, account: 'vendeuse_a', receivedAt: iso(0.2), type: 'vinted' } },
  { id: 'panel_colis_relais', data: { 73000: { code: 'K48291', lieu: 'Le Fournil, 8 Rue de la Paix, 35000 Rennes, France', at: iso(0.5) } } },
];

const svg = (nom) => {
  const c = COULEURS[[...nom].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COULEURS.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><rect width="600" height="800" fill="${c}"/><circle cx="300" cy="360" r="170" fill="rgba(255,255,255,.18)"/><text x="300" y="420" font-family="sans-serif" font-size="120" font-weight="700" text-anchor="middle" fill="#fff">${nom}</text></svg>`;
};
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  const m = /^\/ph\/([A-Za-z0-9-]+)\.svg$/.exec(f);
  if (m) { if (m[1] === 'absente') { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' }); return r.end(svg(m[1])); }
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — BANC_PORT=…'); process.exit(1); });

async function ouvrir(nav, { W, sombre, tab }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ viewport: { width: W, height: tel ? 844 : 950 }, hasTouch: tel, isMobile: tel, deviceScaleFactor: SHOTS ? 2 : 1, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript((sombre) => { try { if (!sessionStorage.getItem('banc_init')) { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); sessionStorage.setItem('banc_init', '1'); } } catch (_) {} }, sombre);
  const lignes = base();
  const etat = { lignes, ecritures: [], lectures: [] };
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request(), m = req.method(); const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200, rg) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': rg || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(m === 'GET' ? ACCOUNTS : []);
    if (!/\/rest\/v1\/app_data/.test(u)) return json([]);
    if (m === 'POST' || m === 'PATCH') {
      let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {}
      for (const l of (Array.isArray(corps) ? corps : corps ? [corps] : [])) {
        if (!l || !l.id) continue;
        etat.ecritures.push({ id: l.id, owner: l.owner, taille: JSON.stringify(l.data || {}).length, data: l.data });
        if (/^achat_facture_/.test(l.id)) { const i = lignes.findIndex((x) => x.id === l.id); const ligne = { id: l.id, owner: l.owner, data: l.data }; if (i >= 0) lignes[i] = ligne; else lignes.push(ligne); }
      }
      return json([], 201);
    }
    if (m !== 'GET') return json([]);
    if (/achat_facture/.test(u)) etat.lectures.push(u);
    const r = servir(lignes.map((l) => ({ updated_at: iso(0), ...l })), u, req.headers()); return json(r.body, 200, r.range);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);
  return { ctx, pg, erreurs, etat, tel };
}
const capture = async (pg, nom, plein = false) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: plein }); };
const visionneuse = (pg) => pg.evaluate(() => {
  const v = document.querySelector('[data-visionneuse]'); if (!v) return null;
  const r = v.getBoundingClientRect(), s = getComputedStyle(v);
  const img = v.querySelector('img[data-visionneuse-img]');
  return { i: +v.getAttribute('data-visionneuse-index'), n: +v.getAttribute('data-visionneuse-n'), zoom: +v.getAttribute('data-visionneuse-zoom'),
    plein: r.left <= 0 && r.top <= 0 && r.width >= innerWidth - 1 && r.height >= innerHeight - 1, fond: s.backgroundColor, z: +s.zIndex,
    src: img ? (img.getAttribute('data-photo-origine') || img.getAttribute('src')) : '', charge: !!(img && img.naturalWidth > 0),
    compteur: (v.querySelector('[data-visionneuse-compteur]') || {}).textContent || '', fleches: v.querySelectorAll('[data-visionneuse-fleche]').length,
    dessus: (() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return !!(e && v.contains(e)); })() };
});
const ecran = (pg) => pg.evaluate(() => { const m = [...document.querySelectorAll('.vrm-main')].find((e) => e.getBoundingClientRect().width > 0); return m ? m.getAttribute('data-ecran') : null; });
// Toucher (téléphone) ou cliquer (ordinateur) la PREMIÈRE vignette chargée de l'écran, dans `sel`.
async function toucherVignette(pg, tel, sel = '.vrm-main', filtre = '') {
  // La première vignette d'article de l'écran : amenée au centre (les photos se chargent à la demande),
  // puis touchée À SA PLACE (un vrai toucher / clic aux coordonnées, comme un doigt).
  for (let essai = 0; essai < 8; essai++) {
    const pos = await pg.evaluate(async ([sel, filtre]) => {
      const zone = [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().width > 0) || document;
      const candidates = () => [...zone.querySelectorAll('img[data-vrm-vignette]')].filter((i) => { const r = i.getBoundingClientRect(); return r.width >= 32 && r.height >= 32 && !i.closest('.vrm-visionneuse') && (!filtre || (filtre[0] === '[' ? i.closest(filtre) != null : (i.getAttribute('src') || '').includes(filtre))); });
      const img = candidates()[0];
      if (!img) return null;
      img.scrollIntoView({ block: 'center' });
      await new Promise((ok) => setTimeout(ok, 700));
      // L'écran finit de se poser (instantané remplacé par l'écran vrai, ligne de fraîcheur…) : la
      // vignette a pu bouger ou passer sous la barre du haut. Un doigt ne touche que ce qu'il VOIT :
      // la première vignette chargée, à l'écran, que rien ne couvre en son centre.
      for (const i of candidates()) {
        if (!(i.naturalWidth > 0)) continue;
        const r = i.getBoundingClientRect();
        if (r.top < 0 || r.bottom > innerHeight) continue;
        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (at && (at === i || i.contains(at))) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      return { attendre: true };
    }, [sel, filtre]);
    if (!pos) return false;
    if (pos.attendre) { await pg.waitForTimeout(500); continue; }
    if (tel) await pg.touchscreen.tap(pos.x, pos.y); else await pg.mouse.click(pos.x, pos.y);
    await pg.waitForTimeout(400);
    return true;
  }
  return false;
}
async function allerOnglet(pg, tab) {
  await pg.evaluate((t) => { const u = new URL(location.href); u.searchParams.set('tab', t); history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate')); }, tab);
  await pg.waitForTimeout(1500);
}

async function blocV(nav, W, sombre) {
  const T = W < 600 ? '📱' : '🖥️';
  const ECRANS = [['cat_achats&vue=achats', 'Achats'], ['cat_annonces', 'Annonces'], ['cat_ventes', 'Ventes'], ['cat_bord', 'Colis'], ['journee', 'Ma journée']];
  for (const [tab, nom] of ECRANS) {
    await essaie(`${T} V1 ${nom}`, async () => {
      const { ctx, pg, erreurs, tel } = await ouvrir(nav, { W, sombre, tab });
      const avant = await ecran(pg);
      const a = await toucherVignette(pg, tel);
      dit(a, `${T} V1 ${nom} : une vignette d'article chargée est à l'écran`);
      if (!a) { await capture(pg, `V1-${nom}-${W}`); await ctx.close(); return; }
      const v = await visionneuse(pg);
      if (!v && process.env.BANC_SONDE) console.log(await pg.evaluate(() => { const i = [...document.querySelectorAll('.vrm-main img[data-vrm-vignette]')].find((x) => x.getBoundingClientRect().width >= 32 && x.naturalWidth > 0); const out = []; for (let e = i; e && out.length < 8; e = e.parentElement) { const r = e.getBoundingClientRect(); out.push(`${e.tagName}.${String(e.className || '').slice(0, 40)} ${Math.round(r.width)}x${Math.round(r.height)} ${e.getAttribute('role') || ''}`); } return out.join(' < '); }));
      dit(!!v && v.plein && /rgb\(0, 0, 0\)/.test(v.fond) && v.dessus && v.charge, `${T} V1 ${nom} : la photo s'ouvre en grand (plein écran, fond noir, au-dessus de tout)`, JSON.stringify(v));
      await capture(pg, `V1-${nom}-${W}${sombre ? '-sombre' : ''}`);
      if (tel) { await pg.goBack(); } else { await pg.keyboard.press('Escape'); }
      await pg.waitForTimeout(500);
      dit(!(await visionneuse(pg)) && (await ecran(pg)) === avant, `${T} V4 ${nom} : ${tel ? 'le retour' : 'Échap'} ferme, on reste sur ${nom}`, `${await ecran(pg)} / ${avant}`);
      dit(!erreurs.length, `${T} ${nom} : aucune erreur`, erreurs.join(' | '));
      await ctx.close();
    });
  }
  // V2, V3 : la galerie d'une annonce à trois photos.
  await essaie(`${T} V2`, async () => {
    const { ctx, pg, tel } = await ouvrir(nav, { W, sombre, tab: 'cat_annonces' });
    const el = await toucherVignette(pg, tel, '.vrm-main', '/ph/L0-0.svg');
    dit(el, `${T} V2 l'annonce à 3 photos est à l'écran`);
    if (!el) { await capture(pg, `V2-${W}`); await ctx.close(); return; }
    let v = await visionneuse(pg);
    dit(v && v.n === 3 && v.i === 0 && /1\/3/.test(v.compteur) && v.fleches === 2, `${T} V2 galerie : 3 photos, « 1/3 », deux flèches`, JSON.stringify(v));
    dit(await pg.locator('[data-visionneuse-lien]').count() === 1, `${T} V2 le lien de la photo (l'annonce sur Vinted) reste dans la visionneuse`);
    await pg.click('[data-visionneuse-fleche="apres"]'); await pg.waitForTimeout(300);
    v = await visionneuse(pg);
    dit(v && v.i === 1 && /L0-1/.test(v.src) && /2\/3/.test(v.compteur), `${T} V2 la flèche montre la photo 2/3`, JSON.stringify(v));
    if (!tel) { await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(300); v = await visionneuse(pg); dit(v && v.i === 2 && /L0-2/.test(v.src), `${T} V2 → au clavier : 3/3`, JSON.stringify(v)); }
    // Glisser vers la gauche ⇒ la suivante (souris : le même geste que le doigt, par pointeurs).
    const i0 = (await visionneuse(pg)).i;
    await pg.mouse.move(W * 0.75, 400); await pg.mouse.down(); await pg.mouse.move(W * 0.45, 405, { steps: 6 }); await pg.mouse.move(W * 0.2, 410, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(350);
    v = await visionneuse(pg);
    dit(v && v.i === (i0 + 1) % 3, `${T} V2 glisser change de photo`, JSON.stringify(v));
    await capture(pg, `V2-galerie-${W}${sombre ? '-sombre' : ''}`);
    // V3 zoom.
    if (tel) { await pg.touchscreen.tap(W / 2, 420); await pg.waitForTimeout(120); await pg.touchscreen.tap(W / 2, 420); await pg.waitForTimeout(450); }
    else { await pg.mouse.dblclick(W / 2, 450); await pg.waitForTimeout(450); }
    v = await visionneuse(pg);
    dit(v && v.zoom > 1.5, `${T} V3 ${tel ? 'double toucher' : 'double clic'} zoome`, JSON.stringify(v));
    if (!tel) {
      await pg.mouse.dblclick(W / 2, 450); await pg.waitForTimeout(300);
      await pg.mouse.move(W / 2, 450); await pg.mouse.wheel(0, -400); await pg.waitForTimeout(300);
      v = await visionneuse(pg); dit(v && v.zoom > 1.2, `${T} V3 la molette zoome`, JSON.stringify(v));
    }
    await capture(pg, `V3-zoom-${W}${sombre ? '-sombre' : ''}`);
    await pg.click('[data-visionneuse-fermer]'); await pg.waitForTimeout(400);
    dit(!(await visionneuse(pg)), `${T} V4 la croix ferme`);
    // Une photo seule : ni flèche, ni compteur.
    if (await toucherVignette(pg, tel, '.vrm-main', '/ph/L1-0.svg')) {
      v = await visionneuse(pg); dit(v && v.n === 1 && v.fleches === 0 && !v.compteur.trim(), `${T} V2 photo seule : ni flèche ni compteur`, JSON.stringify(v));
      // V4 : un toucher SUR la photo ne ferme rien ; à côté d'elle (le noir), il ferme.
      const tape = async (x, y) => { if (tel) await pg.touchscreen.tap(x, y); else await pg.mouse.click(x, y); await pg.waitForTimeout(450); };
      const H = await pg.evaluate(() => innerHeight);
      await tape(W / 2, H / 2);
      dit(!!(await visionneuse(pg)), `${T} V4 un toucher sur la photo ne la ferme pas`);
      await tape(20, tel ? H - 150 : H / 2);
      dit(!(await visionneuse(pg)), `${T} V4 un toucher à côté de la photo la ferme`);
    }
    await ctx.close();
  });
  // V5, V6 sur Achats.
  await essaie(`${T} V5`, async () => {
    const { ctx, pg, tel } = await ouvrir(nav, { W, sombre, tab: 'cat_achats&vue=achats' });
    await pg.click('[data-achats-onglet="all"]').catch(() => {}); await pg.waitForTimeout(500);
    const row = '[data-achat-tx="73001"]';
    dit(await toucherVignette(pg, tel, '.vrm-main', row), `${T} V5 la vignette de l'achat est à l'écran`);
    await pg.waitForTimeout(350);
    dit(!!(await visionneuse(pg)) && !(await pg.locator('[role="menu"].vrm-buy-menu').count()), `${T} V5 la vignette d'un achat ouvre la photo, pas le menu`);
    await pg.keyboard.press('Escape'); if (tel) await pg.click('[data-visionneuse-fermer]').catch(() => {}); await pg.waitForTimeout(300);
    await pg.locator(`${row} .vrm-buy-more`).evaluate((e) => e.scrollIntoView({ block: 'center' })); await pg.click(`${row} .vrm-buy-more`); await pg.waitForTimeout(300);
    dit(await pg.locator('[role="menu"].vrm-buy-menu').count() === 1 && !(await visionneuse(pg)), `${T} V5 le ⋯ de la rangée ouvre toujours son menu`);
    // Le menu se referme comme un doigt le referme : un toucher à côté, sur son fond (au milieu de
    // l'écran : en haut, la barre de l'app passe devant le fond) — sinon le fond couvre la rangée suivante.
    if (tel) await pg.touchscreen.tap(W / 2, 600); else await pg.mouse.click(5, 5);
    await pg.waitForTimeout(300);
    dit(!(await pg.locator('[role="menu"].vrm-buy-menu').count()), `${T} V5 le menu se referme`);
    // V6 : l'achat dont la photo est absente : rien ne s'ouvre.
    const vide = pg.locator('[data-achat-tx="73004"] .vrm-buy-ph').first();
    if (await vide.count()) { await vide.evaluate((e) => e.scrollIntoView({ block: 'center' })); if (tel) await vide.tap(); else await vide.click(); await pg.waitForTimeout(300); dit(!(await visionneuse(pg)), `${T} V6 photo absente : rien ne s'ouvre`); }
    else dit(false, `${T} V6 l'achat à la photo absente est rendu`);
    await ctx.close();
  });
}

async function blocA(nav, W, sombre) {
  const T = W < 600 ? '📱' : '🖥️';
  await essaie(`${T} A`, async () => {
    const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre, tab: 'cat_achats&vue=achats' });
    await capture(pg, `A-achats-defaut-${W}${sombre ? '-sombre' : ''}`);
    await pg.click('[data-achats-onglet="all"]').catch(() => {}); await pg.waitForTimeout(600);
    await pg.evaluate(() => { const l = document.querySelector('.vrm-buy-list'); if (l) l.scrollIntoView({ block: 'start' }); });
    await pg.waitForTimeout(300);
    await capture(pg, `A-achats-liste-${W}${sombre ? '-sombre' : ''}`);
    const m = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll('.vrm-buy-list > [data-achat-tx]')];
      const liste = document.querySelector('.vrm-buy-list');
      const mots = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
      return {
        txs: rows.map((r) => r.getAttribute('data-achat-tx')),
        groupeRayon: liste ? parseFloat(getComputedStyle(liste).borderTopLeftRadius) : 0,
        lignes: rows.map((r) => {
          const ph = r.querySelector('.vrm-buy-ph'), px = r.querySelector('.vrm-buy-price'), st = r.querySelector('.vrm-buy-statut');
          const rr = r.getBoundingClientRect(), pr = px ? px.getBoundingClientRect() : null, phr = ph ? ph.getBoundingClientRect() : null;
          const sts = st ? getComputedStyle(st) : null, sr = st ? st.getBoundingClientRect() : null;
          const fond = sts ? sts.backgroundColor : '';
          // Les phrases RENDUES dans la rangée : chaque élément feuille porteur de texte.
          const textes = [...r.querySelectorAll('*')].filter((e) => !e.children.length && e.getBoundingClientRect().width > 0 && !e.closest('[role="menu"]')).map((e) => e.textContent.trim()).filter(Boolean);
          return { tx: r.getAttribute('data-achat-tx'), ph: phr ? Math.round(Math.min(phr.width, phr.height)) : 0,
            prixDroite: pr ? Math.round(rr.right - pr.right) : null, prixGauche: pr && phr ? pr.left > phr.right : false, tab: px ? getComputedStyle(px).fontVariantNumeric : '',
            pastille: sts ? { fond, rayon: parseFloat(sts.borderTopLeftRadius), h: sr.height } : null,
            plusLongue: Math.max(0, ...textes.map(mots)), phrase: textes.sort((a, b) => mots(b) - mots(a))[0] || '' };
        }),
      };
    });
    const uniq = new Set(m.txs);
    dit(m.txs.length === 5 && uniq.size === 5, `${T} A1 une rangée par achat`, m.txs.join(','));
    dit(m.groupeRayon >= 22, `${T} A1 groupe arrondi (rayon ≥ 22)`, m.groupeRayon);
    for (const l of m.lignes) {
      dit(l.ph >= 56, `${T} A1 ${l.tx} grande vignette (≥ 56 px)`, l.ph);
      dit(l.prixDroite != null && l.prixDroite <= 72 && l.prixGauche && /tabular/.test(l.tab), `${T} A1 ${l.tx} prix calé à droite, tabulaire`, JSON.stringify(l));
      const p = l.pastille; const rempli = p && !/rgba\(0, 0, 0, 0\)|transparent/.test(p.fond);
      dit(!!p && rempli && p.rayon >= p.h / 2 - 1, `${T} A1 ${l.tx} l'état en une pastille`, JSON.stringify(p));
      dit(l.plusLongue <= 12, `${T} A2 ${l.tx} aucune phrase de plus de 12 mots`, `${l.plusLongue} : « ${l.phrase} »`);
    }
    dit(!erreurs.length, `${T} A aucune erreur`, erreurs.join(' | '));
    await ctx.close();
  });
}

// Une petite photo PNG (1×1) et un PDF minimal, fabriqués ici.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
async function blocF(nav, W, sombre) {
  const T = W < 600 ? '📱' : '🖥️';
  await essaie(`${T} F`, async () => {
    const { ctx, pg, erreurs, etat, tel } = await ouvrir(nav, { W, sombre, tab: 'cat_achats&vue=achats' });
    await pg.click('[data-achats-onglet="all"]').catch(() => {}); await pg.waitForTimeout(600);
    const joindre = async (tx, fichier) => {
      await pg.locator(`[data-achat-tx="${tx}"] .vrm-buy-more`).evaluate((e) => e.scrollIntoView({ block: 'center' })); await pg.click(`[data-achat-tx="${tx}"] .vrm-buy-more`); await pg.waitForTimeout(250);
      const [fc] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 5000 }), pg.click(`[data-achat-joindre-facture="${tx}"]`)]);
      await fc.setFiles(fichier); await pg.waitForTimeout(1500);
    };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-facture-'));
    const fPng = path.join(dir, 'facture-brocante.png'); fs.writeFileSync(fPng, PNG);
    const fPdf = path.join(dir, 'facture-fournisseur.pdf'); fs.writeFileSync(fPdf, PDF);
    const fGros = path.join(dir, 'enorme.pdf'); fs.writeFileSync(fGros, Buffer.concat([PDF, Buffer.alloc(6 * 1024 * 1024, 32)]));
    const fTxt = path.join(dir, 'notes.txt'); fs.writeFileSync(fTxt, 'pas une facture');
    await joindre('73003', fPng);
    const e1 = etat.ecritures.find((e) => e.id === 'achat_facture_tx_73003');
    dit(!!e1 && e1.owner && e1.data && /^data:image\//.test(e1.data.b64 || '') && e1.data.type && e1.data.nom, `${T} F1 la photo part dans SA ligne (achat_facture_tx_73003, owner, type, nom)`, JSON.stringify(e1 && { id: e1.id, owner: e1.owner, type: e1.data && e1.data.type, nom: e1.data && e1.data.nom }));
    const chip = pg.locator('[data-achat-tx="73003"] [data-achat-facture-jointe]');
    dit(await chip.count() === 1 && (await chip.getAttribute('data-achat-facture-jointe')) === 'image', `${T} F1 la rangée dit « Facture jointe »`);
    await capture(pg, `F1-facture-jointe-${W}${sombre ? '-sombre' : ''}`);
    const avantLect = etat.lectures.length;
    if (await chip.count()) { if (tel) await chip.tap(); else await chip.click(); await pg.waitForTimeout(900); }
    const v = await visionneuse(pg);
    dit(!!v && /^data:image\//.test(v.src) && v.charge, `${T} F1 toucher « Facture jointe » l'ouvre en grand`, JSON.stringify(v && { ...v, src: String(v.src).slice(0, 30) }));
    dit(etat.lectures.slice(avantLect).some((u) => /id=eq\.achat_facture_tx_73003/.test(u)), `${T} F3 les octets ne partent qu'au toucher (lecture par id)`);
    await capture(pg, `F1-facture-en-grand-${W}${sombre ? '-sombre' : ''}`);
    await pg.click('[data-visionneuse-fermer]').catch(() => {}); await pg.waitForTimeout(300);
    await joindre('73001', fPdf);
    const e2 = etat.ecritures.find((e) => e.id === 'achat_facture_tx_73001');
    dit(!!e2 && /^data:application\/pdf;base64,JVBER/.test(e2.data.b64 || ''), `${T} F2 un PDF part tel quel`, e2 && String(e2.data.b64).slice(0, 40));
    dit((await pg.locator('[data-achat-tx="73001"] [data-achat-facture-jointe="pdf"]').count()) === 1, `${T} F2 la rangée dit « Facture jointe » (PDF)`);
    const n0 = etat.ecritures.length;
    await joindre('73002', fGros);
    await joindre('73002', fTxt);
    dit(etat.ecritures.length === n0 && !etat.ecritures.some((e) => e.id === 'achat_facture_tx_73002'), `${T} F2 trop gros ou autre type : rien n'est écrit`, etat.ecritures.slice(n0).map((e) => e.id).join(','));
    const refus = await pg.evaluate(() => document.body.innerText);
    dit(/trop lourd|PDF ou une photo/i.test(refus), `${T} F2 le refus est dit`);
    dit(!etat.lectures.some((u) => /select=data(&|$)|select=\*|b64/.test(u) && !/id=eq\./.test(u)), `${T} F3 la liste ne rapatrie jamais le contenu`, etat.lectures.filter((u) => !/id=eq\./.test(u)).join(' | ').slice(0, 300));
    // F4 : « Ajouter un achat » hors Vinted, avec sa facture.
    const ouvrirForm = pg.locator('[data-achat-hors-ajouter]').first();
    if (await ouvrirForm.count()) {
      await ouvrirForm.click(); await pg.waitForTimeout(400);
      await pg.fill('[data-achat-hors-form] [data-champ="titre"]', 'Paire de brocante');
      await pg.fill('[data-achat-hors-form] [data-champ="prix"]', '20');
      const inp = pg.locator('[data-achat-hors-facture-input]');
      dit(await inp.count() === 1, `${T} F4 le formulaire propose de joindre une facture`);
      if (await inp.count()) await inp.setInputFiles(fPng);
      await pg.waitForTimeout(300);
      await pg.click('[data-achat-hors-enregistrer]'); await pg.waitForTimeout(1500);
      dit(etat.ecritures.some((e) => /^achat_facture_hors_/.test(e.id) && /^data:image\//.test((e.data || {}).b64 || '')), `${T} F4 la facture de l'achat saisi est rangée dans SA ligne`, etat.ecritures.map((e) => e.id).join(','));
      await capture(pg, `F4-hors-${W}${sombre ? '-sombre' : ''}`);
    } else dit(false, `${T} F4 « Ajouter » un achat hors Vinted est rendu`);
    dit(!erreurs.length, `${T} F aucune erreur`, erreurs.join(' | '));
    fs.rmSync(dir, { recursive: true, force: true });
    await ctx.close();
  });
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    // `PA_VUES=390-clair,1512-sombre` (ou 390-sombre, 1512-clair…) : les autres vues ; par défaut 390 sombre + 1512 clair.
    const VUES = process.env.PA_VUES ? process.env.PA_VUES.split(',').map((x) => { const [w, t] = x.split('-'); return [Number(w), t === 'sombre']; }) : [[390, true], [1512, false]];
    for (const [W, sombre] of VUES) {
      console.log(`\n── ${W} px${sombre ? ' sombre' : ''} ──`);
      if (SEUL.includes('V')) await blocV(nav, W, sombre);
      if (SEUL.includes('A')) await blocA(nav, W, sombre);
      if (SEUL.includes('F')) await blocF(nav, W, sombre);
    }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
