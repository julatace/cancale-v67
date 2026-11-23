require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LARGEUR À L'ORDINATEUR » (23 nov., lot achats-ordi-casse).
//
//  Julien (23 nov., capture d'Achats sur son Mac, barre latérale ouverte) : la moitié gauche de la zone de contenu
//  VIDE, la liste des achats repoussée à droite, colonne article disparue, prix coupés (« …0 € »). Cause : la grille
//  à deux colonnes d'Achats (15 nov. : les codes « À retirer » à gauche, la liste à droite) s'applique dès que
//  « À retirer » est ouvert — TOUJOURS dans le design en service — et serrait le TABLEAU DE TRAVAIL (19 nov.) dans
//  la colonne de droite. Les autres bancs ne la voyaient pas : ils demandent le DOM d'avant (`vrm_banc_dom_ancien`) ;
//  celui-ci rend l'app TELLE QU'EN PRODUCTION (`BANC_DESIGN_V2=defaut`).
//
//  Base INVENTÉE (dépôt public) : celle de refonte-achats.cjs (10 comptes, N_ACHATS achats dont quelques-uns au
//  point relais, 240 ventes), vignettes SVG du banc.
//
//  À 1100, 1280, 1512, 1920 px (et 1280, 1512 barre latérale RÉDUITE), écrans Achats, Aujourd'hui, Annonces,
//  Ventes, Argent, Stock :
//   L1 aucun vide à gauche : en haut de l'écran PUIS après avoir défilé (voir les trois temps plus bas), le texte
//      visible commence à moins de 15 % de la largeur de contenu de son bord gauche (le bord : la barre du haut) ;
//   L2 (tableau de travail, Achats et Ventes) le tableau occupe toute la largeur de contenu (bord gauche à 24 px
//      près, ≥ 90 % de la largeur) ;
//   L3 (tableau) la colonne « Article » est visible ENTIÈRE dans le cadre du tableau ;
//   L4 (tableau) aucune cellule prix / date / statut coupée : elle tient dans le cadre et son texte dans la cellule ;
//   L5 le titre de l'écran n'est ni rogné en haut ni couvert (le point en son milieu le désigne).
//  `SHOTS=dossier` range les captures (à REGARDER, §6.2) ; `BANC_DIST`, `BANC_PORT`, `ECRANS=cat_achats,…`,
//  `LARGEURS=1280,…`, `N_ACHATS`. Trois temps : en haut, la liste amenée sous la barre, puis 700 px plus bas (là où
//  Julien a vu la moitié gauche vide : sous la courte colonne des codes).
// ════════════════════════════════════════════════════════════════════════════
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';   // l'app telle qu'en production (pas le DOM d'avant)
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const SHOTS = process.env.SHOTS || '';
const DSF = Number(process.env.DSF || 1);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp' };

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '  ✅ ' : '  ❌ '}${quoi}${det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0]); } };

// ── La base inventée (déterministe) ─────────────────────────────────────────
const midi = new Date(); midi.setHours(12, 0, 0, 0); if (midi.getTime() > Date.now()) midi.setDate(midi.getDate() - 1);
const NOW = midi.getTime();
const iso = (j) => new Date(NOW - j * 86400000).toISOString();
let graine = 7; const alea = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
const PH = (n) => `http://localhost:${PORT}/ph/${n}.svg`;
const NOMS = ['atelier_paires', 'shop_rennes', 'loladupuis35260', 'jujuf38', 'angeled92', 'tomj606', 'tomj683', 'boutique_sneakers_vintage_rennes_35', 'lloollllaa', 'arthuror2'];
const ACCOUNTS = NOMS.map((login, i) => ({ id: i + 1, vinted_user_id: String(9100 + i), login, domain: 'www.vinted.fr', updated_at: iso(0), created_at: iso(300) }));
const MODELES = ['Nike Dunk Low panda', 'Adidas Samba OG noire', 'New Balance 550 crème', 'Asics Gel-1130 argent', 'Salomon XT-6 grise', 'Nike Sacai LDWaffle Fragment Blue Void', 'Jordan 1 Mid Chicago', 'Puma Speedcat rouge', 'Adidas Gazelle bleue', 'Nike Air Max 90 blanche'];
const STATUTS = [['Commande finalisée', 'completed'], ['Commande finalisée', 'completed'], ['Commande finalisée', 'completed'], ['Le vendeur a expédié la commande', 'waiting'], ["La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais", 'needs_action'], ['Remboursement effectué', 'completed']];
const N_ACHATS = Number(process.env.N_ACHATS || 300);
// Les achats : le compte choisi (arthuror2) en a 2, les autres se partagent le reste.
const ACHATS = [];
for (let i = 0; i < N_ACHATS; i++) {
  const c = i < 2 ? 9 : (i % 9);
  // Quelques colis au point relais (un par 150 achats), le reste arrivé, en route ou remboursé.
  const s = STATUTS[i < 12 ? (i % 2 ? 3 : 0) : i % 150 === 7 ? 4 : [0, 1, 2, 3, 5][Math.floor(alea() * 5)]];
  ACHATS.push({ uid: ACCOUNTS[c].vinted_user_id, o: { transaction_id: 7300000 + i, conversation_id: 8400000 + i, title: MODELES[i % MODELES.length] + ' taille ' + (38 + (i % 9)),
    price: { amount: (28 + Math.round(alea() * 90) + 0.8).toFixed(2), currency_code: 'EUR' }, status: s[0], transaction_user_status: s[1], date: iso(1 + i * 0.4), photo: PH('A' + (i % 40)) } });
}
const VENTES = [];
for (let i = 0; i < 240; i++) VENTES.push({ uid: ACCOUNTS[i % 9].vinted_user_id, o: { transaction_id: 6200000 + i, title: MODELES[(i + 3) % MODELES.length] + ' taille ' + (39 + (i % 7)),
  price: { amount: String(80 + (i % 50)), currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(i * 0.5), photo: PH('V' + (i % 30)) } });
// 60 ventes reliées à LEUR achat (identité : le n° de transaction de l'achat), prix d'achat saisi.
const SALE_OV = {};
for (let i = 0; i < 60; i++) SALE_OV[String(6200000 + i)] = { buyFromId: String(7300000 + 20 + i * 3), buyPrice: String(40 + (i % 25)) };
// Des N° de rangement sur des paires reliées à un achat (la recherche par N° les trouve).
const NUMEROS = {};
for (let i = 0; i < 40; i++) NUMEROS['5100' + i] = { numero: String(120 + i), buyFromId: String(7300000 + 300 + i) };
const HORS = [
  { id: 'ob_1', title: 'Nike Air Force 1 blanche', price: '25', date: iso(40).slice(0, 10), source: 'Brocante', createdAt: iso(40) },
  { id: 'ob_2', title: 'Lot Adidas Campus', price: '180', date: iso(70).slice(0, 10), source: 'Fournisseur', createdAt: iso(70) },
  { id: 'ob_3', title: 'New Balance 2002R', price: '35', date: iso(12).slice(0, 10), source: 'Vide-grenier', createdAt: iso(12) },
  { id: 'ob_4', title: 'Vans Old Skool', price: '12', date: iso(5).slice(0, 10), source: 'Particulier', createdAt: iso(5) },
];
const base = () => [
  { id: 'main', data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, vinted_sale_overrides: SALE_OV, vinted_annonce_numeros: NUMEROS, vinted_offvinted_buys: HORS } },
  ...ACCOUNTS.map((a) => ({ id: `harvest_${a.vinted_user_id}_orders_purchased`, data: { capturedAt: iso(0.001), payload: { my_orders: ACHATS.filter((x) => x.uid === a.vinted_user_id).map((x) => x.o) } } })),
  ...ACCOUNTS.map((a) => ({ id: `harvest_${a.vinted_user_id}_orders_sold`, data: { capturedAt: iso(0.001), payload: { my_orders: VENTES.filter((x) => x.uid === a.vinted_user_id).map((x) => x.o) } } })),
];

const COULEURS = ['#3a6ea5', '#c97b2a', '#4f8a5b', '#8a4f7d', '#a33b3b', '#2f2f2f', '#6b8e23', '#b0a090'];
const svg = (nom) => {
  const c = COULEURS[[...nom].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COULEURS.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#ECE8E1"/><path d="M60 250 C80 200 130 190 160 170 L200 150 C220 175 250 185 300 190 C330 195 345 215 340 245 L340 266 L60 266 Z" fill="${c}"/><path d="M60 266 L340 266 L340 280 L60 280 Z" fill="#fff"/></svg>`;
};
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  const m = /^\/ph\/([A-Za-z0-9-]+)\.svg$/.exec(f);
  if (m) { r.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'max-age=3600' }); return r.end(svg(m[1])); }
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — BANC_PORT=…'); process.exit(1); });

async function ouvrir(nav, { W, sombre, choisi, ecran, reduite }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ viewport: { width: W, height: tel ? 844 : 950 }, hasTouch: tel, isMobile: tel, deviceScaleFactor: DSF, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript(([sombre, choisi, reduite]) => { try { if (!sessionStorage.getItem('banc_init')) {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
    if (choisi) localStorage.setItem('vrm_compte_choisi', JSON.stringify({ vinted: choisi }));
    if (reduite) localStorage.setItem('vrm_laterale_reduite', '1');
    sessionStorage.setItem('banc_init', '1'); } } catch (_) {}
    // Les décalages de mise en page (CLS), comptés depuis le premier instant.
    try { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {}
  }, [sombre, choisi || '', !!reduite]);
  const lignes = base();
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request(), m = req.method(); const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200, rg) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': rg || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(m === 'GET' ? ACCOUNTS : []);
    if (!/\/rest\/v1\/app_data/.test(u)) return json([]);
    if (process.env.BANC_SONDE && /main/.test(u)) console.log('  · ' + m + ' ' + u.slice(0, 220));
    if (m !== 'GET') {
      // Une écriture ACCEPTÉE rend ses lignes (`return=representation`, `select=id`) : sans elles, l'app y lit un
      // conflit et empile « N changements en attente d'envoi » sur l'écran (rien n'est gardé : base de banc).
      let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {}
      const id = (/[?&]id=eq\.([^&]+)/.exec(u) || [])[1];
      const rows = Array.isArray(corps) ? corps.map((l) => ({ id: l && l.id })) : [{ id: (corps && corps.id) || id || 'main' }];
      return json(rows, m === 'POST' ? 201 : 200);
    }
    // Base non cloisonnée : toutes les lignes sont au vendeur de la session (la porte de banc pose l'owner).
    const r = servir(lignes.map((l) => ({ updated_at: iso(0), ...l })), u.replace(/([?&])owner=eq\.[^&]*&?/, '$1'), req.headers()); return json(r.body, 200, r.range);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const t0 = Date.now();
  await pg.goto(`http://localhost:${PORT}/?tab=${ecran}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, erreurs, tel, t0 };
}

const ECRANS = (process.env.ECRANS || 'cat_achats,journee,cat_annonces,cat_ventes,compta,garage').split(',');
const LARGEURS = (process.env.LARGEURS || '1100,1280,1512,1920').split(',').map(Number);
const REDUITES = [1280, 1512].filter((w) => LARGEURS.includes(w));

// Mesures DANS la page. `etape` : 'haut' (écran ouvert) ou 'defile' (la liste amenée en haut de la fenêtre).
const mesurer = () => {
  const main = document.querySelector('.vrm-main');
  const barre = [...document.querySelectorAll('.vrm-main > .vrm-barre-haut')].find((x) => x.getBoundingClientRect().width > 0);
  const M = main.getBoundingClientRect(); const cs = getComputedStyle(main);
  const gauche = barre ? barre.getBoundingClientRect().left : M.left + parseFloat(cs.paddingLeft);
  const droite = barre ? barre.getBoundingClientRect().right : M.right - parseFloat(cs.paddingRight);
  const largeur = droite - gauche;
  const hautVisible = barre ? barre.getBoundingClientRect().bottom : M.top;
  const H = window.innerHeight;
  // L1 — le texte visible (feuilles de texte), sous la barre du haut, dans la fenêtre, hors éléments fixes.
  const fixe = (el) => { for (let x = el; x && x !== main; x = x.parentElement) { const p = getComputedStyle(x).position; if (p === 'fixed') return true; } return false; };
  let minG = Infinity, n = 0;
  const w = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    if (!t.nodeValue.trim()) continue; const el = t.parentElement; if (!el || (barre && barre.contains(el)) || fixe(el)) continue;
    const r = document.createRange(); r.selectNodeContents(t); const q = r.getBoundingClientRect();
    if (q.width < 2 || q.height < 2 || q.bottom <= hautVisible || q.top >= H || q.right <= M.left || q.left >= M.right) continue;
    const st = getComputedStyle(el); if (st.visibility === 'hidden' || +st.opacity === 0) continue;
    // Un texte dans un cadre qui le coupe (défilement de côté) n'est pas « visible » s'il est hors du cadre.
    let coupe = false; for (let x = el.parentElement; x && x !== main; x = x.parentElement) { const o = getComputedStyle(x); if (/auto|hidden|scroll|clip/.test(o.overflowX)) { const c = x.getBoundingClientRect(); if (q.right <= c.left + 1 || q.left >= c.right - 1) { coupe = true; break; } } }
    if (coupe) continue;
    n++; if (q.left < minG) minG = q.left;
  }
  const out = { gauche: Math.round(gauche), largeur: Math.round(largeur), textes: n, minGauche: Math.round(minG), vide: Math.round(minG - gauche) };
  // L2–L4 — le tableau de travail.
  const tt = [...document.querySelectorAll('.vrm-main .n-tt-ordi')].find((x) => x.getBoundingClientRect().width > 0);
  if (tt) {
    const T = tt.getBoundingClientRect(); out.tt = { gauche: Math.round(T.left - gauche), largeur: Math.round(T.width) };
    const table = tt.querySelector('.n-tt-table');
    let cadre = table ? table.parentElement : null; while (cadre && cadre !== tt && !/auto|hidden|scroll|clip/.test(getComputedStyle(cadre).overflowX)) cadre = cadre.parentElement;
    const C = (cadre || tt).getBoundingClientRect();
    const art = tt.querySelector('.n-tt-th-article'); const A = art ? art.getBoundingClientRect() : null;
    out.article = A ? { dedans: A.left >= C.left - 1 && A.right <= C.right + 1 && A.width > 40, g: Math.round(A.left - C.left), w: Math.round(A.width) } : null;
    out.coupees = [];
    for (const td of tt.querySelectorAll('td[data-tt-col="prix"], td[data-tt-col="date"], td[data-tt-col="statut"]')) {
      const q = td.getBoundingClientRect(); if (q.bottom <= Math.max(C.top, hautVisible) || q.top >= H || !td.textContent.trim()) continue;
      if (q.left < C.left - 1 || q.right > C.right + 1 || td.scrollWidth > td.clientWidth + 1) out.coupees.push(`${td.dataset.ttCol} « ${td.textContent.trim()} » ${Math.round(q.left - C.left)}/${Math.round(C.width)}`);
      if (out.coupees.length > 3) break;
    }
  }
  // L5 — le titre de l'écran.
  const titre = [...main.querySelectorAll('h1, .vrm-screen-head-titre, [data-tache-tete] h2, .n-tb-tete h1, .n-tb-tete h2')].find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  if (titre) { const r = titre.getBoundingClientRect(); const cx = r.left + Math.min(r.width / 2, 40), cy = r.top + r.height / 2; const e = document.elementFromPoint(cx, cy);
    out.titre = { texte: titre.textContent.trim().slice(0, 30), haut: Math.round(r.top - hautVisible), libre: !!e && (titre.contains(e) || e.contains(titre)) , sous: e ? `${e.tagName}.${String(e.className).slice(0, 40)}` : '' }; }
  return out;
};

const amenerListe = () => {
  const main = document.querySelector('.vrm-main');
  const cible = document.querySelector('.vrm-main .n-tt-table, .vrm-main .vrm-buy-list, .vrm-main [data-tt]') || [...main.querySelectorAll('section, ul, ol')].sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
  if (!cible) return false;
  main.scrollTop += cible.getBoundingClientRect().top - main.getBoundingClientRect().top - 120;
  return true;
};

async function un(nav, ecran, W, reduite) {
  const T = `${ecran} ${W}${reduite ? ' réduite' : ''}`;
  const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: false, ecran, reduite });
  try {
    await pg.waitForSelector('.vrm-main > .vrm-barre-haut, .vrm-main [data-tache-tete]', { timeout: 30000 }).catch(() => {});
    if (/achats|ventes/.test(ecran)) await pg.waitForSelector('.vrm-main .n-tt-ordi[data-tt-etat="lu"]', { timeout: 30000 }).catch(() => {});
    await pg.waitForTimeout(2500);
    const tag = `${ecran}-${W}${reduite ? '-reduite' : ''}`;
    const capt = async (n) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `${tag}-${n}.png`) }); };
    for (const etape of ['haut', 'defile', 'bas']) {
      if (etape === 'defile') { const ok = await pg.evaluate(amenerListe); if (!ok) continue; await pg.waitForTimeout(700); }
      if (etape === 'bas') { const ok = await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); const avant = m.scrollTop; m.scrollTop += 700; return m.scrollTop > avant; }); if (!ok) continue; await pg.waitForTimeout(700); }
      await capt(etape);
      const m = await pg.evaluate(mesurer);
      const S = `${T} [${etape}]`;
      dit(m.textes > 0 && m.vide <= m.largeur * 0.15, `${S} L1 aucun vide à gauche`, `le texte commence à ${m.vide} px du bord (largeur ${m.largeur}, ${m.textes} textes)`);
      if (m.tt) {
        dit(Math.abs(m.tt.gauche) <= 24 && m.tt.largeur >= m.largeur * 0.9, `${S} L2 le tableau occupe toute la largeur`, `bord gauche ${m.tt.gauche} px, ${m.tt.largeur} / ${m.largeur} px`);
        if (m.article || /achats/.test(ecran)) dit(!!(m.article && m.article.dedans), `${S} L3 la colonne Article est visible`, JSON.stringify(m.article));
        dit(!m.coupees.length, `${S} L4 aucune cellule prix / date / statut coupée`, m.coupees.join(' | '));
      } else if (/achats/.test(ecran)) dit(false, `${S} L2 le tableau de travail est rendu`, 'aucun .n-tt-ordi');
      if (etape === 'haut') { if (m.titre) dit(m.titre.haut >= -2 && m.titre.libre, `${S} L5 le titre « ${m.titre.texte} » n'est ni rogné ni couvert`, `haut ${m.titre.haut} px sous la barre, au point : ${m.titre.sous}`);
        else console.log(`  · ${S} pas de titre trouvé`); }
    }
    dit(!erreurs.length, `${T} aucune erreur`, erreurs.join(' | '));
  } finally { await ctx.close(); }
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const e of ECRANS) { for (const W of LARGEURS) await essaie(`${e} ${W}`, () => un(nav, e, W, false)); for (const W of REDUITES) await essaie(`${e} ${W} réduite`, () => un(nav, e, W, true)); }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} largeur-ordi : ${ok} bons, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
