require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « REFONTE D'ACHATS » (14 nov.) — ce qu'on MESURE sur l'écran rendu.
//
//  Julien (14 nov., captures d'Achats sur son iPhone) : « C'est moche. Continue à
//  améliorer le design, rien n'a changé » ; puis « il faut vraiment qu'on sorte
//  des classiques » ; puis « il faut que ça soit pratique, imagine si j'ai 1000
//  articles ». Récit : docs/passation/2026-11-14-refonte-achats.md.
//
//  Base INVENTÉE (dépôt public) : 10 comptes Vinted (dont un nom très long),
//  1 000 achats, 240 ventes dont 60 reliées à leur achat (prix d'achat saisi),
//  4 achats hors plateforme ; vignettes SVG dessinées par le banc.
//
//  FORME (Achats, « Compte choisi » posé ; 390 tactile clair ET sombre, 1512) :
//   F1 rien ne déborde de sa carte : chaque bouton d'une rangée d'achat ou d'une
//      rangée de compte tient DANS la liste (le « … » sortait à droite) ;
//   F2 les comptes en liste groupée iOS : en-tête d'une ligne, 13 px ; rangée de
//      compte 52–56 px, nom 17 px, le nombre calé à droite ;
//   F3 « Tes meilleures sources » : le titre HORS de la carte (aucun ancêtre du
//      titre n'est une surface arrondie) ;
//   F4 aucune phrase de plus d'une ligne VISIBLE dans la carte des sources sans
//      repli (les explications vivent dans « Comment c'est calculé ») ;
//   F5 des tuiles : au moins 3 chiffres ≥ 28 px par source ;
//   F6 aucun montant (€) à la couleur d'accent hors d'un lien ou d'un bouton ;
//   F7 la rangée d'achat : 64–76 px de haut au téléphone, vignette 48–56 px ;
//   F8 les chiffres d'Achats (`data-achats-hero`) en BANDE : ≥ 3 chiffres, ≤ 72 px, sans
//      carte sombre (AJOUT 3 : la carte sombre reste à Ma journée seulement) ;
//   F9 la liste d'abord : Achats ne pose qu'un quart d'écran au-dessus de sa 1re ligne (la position
//      dans l'écran entier est dite : la coque y ajoute titre, fraîcheur et choix du compte) ;
//   F10 au plus UN bouton plein à l'accent à l'écran.
//
//  À 1 000 ACHATS (390 tactile, aucun compte choisi : la liste à plat) :
//   P1 premier rendu de la liste (ms, de la navigation à la 1re rangée) ;
//   P2 défiler jusqu'en bas : CLS (décalages hors geste) ≤ 0,05 ;
//   P3 nœuds DOM de la liste ;
//   P4 au moins 8 achats ENTIERS visibles sur un écran de 390 × 844 ;
//   P5 taper un N° dans la recherche trouve la paire en < 300 ms.
//  `BANC_REF=fichier.json` : les mesures d'origin/main (écrites par `BANC_ECRIT=…`) ;
//  rouge si P1, P3 ou P2 font PIRE (P1 +50 % — machine partagée —, P3 +10 %, P2 +0,02).
//
//  `SHOTS=dossier` range les captures (à REGARDER, §6.2) ; `BANC_DIST`, `BANC_PORT`,
//  `BANC_SEUL=F,P` ; `DSF=2` pour les captures montrées à Julien.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const SHOTS = process.env.SHOTS || '';
const DSF = Number(process.env.DSF || 1);
const SEUL = (process.env.BANC_SEUL || 'F,P').split(',');
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
const N_ACHATS = Number(process.env.N_ACHATS || 1000);
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

async function ouvrir(nav, { W, sombre, choisi }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ viewport: { width: W, height: tel ? 844 : 950 }, hasTouch: tel, isMobile: tel, deviceScaleFactor: DSF, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript(([sombre, choisi]) => { try { if (!sessionStorage.getItem('banc_init')) {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
    if (choisi) localStorage.setItem('vrm_compte_choisi', JSON.stringify({ vinted: choisi }));
    sessionStorage.setItem('banc_init', '1'); } } catch (_) {}
    // Les décalages de mise en page (CLS), comptés depuis le premier instant.
    try { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {}
  }, [sombre, choisi || '']);
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
  await pg.goto(`http://localhost:${PORT}/?tab=cat_achats&vue=achats`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, erreurs, tel, t0 };
}
const attendreListe = async (pg) => { await pg.waitForSelector('.vrm-achats .vrm-buy-row', { timeout: 30000 }); };
const capture = async (pg, nom, plein = false) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: plein }); };

// ── FORME ────────────────────────────────────────────────────────────────────
async function blocF(nav, W, sombre) {
  const T = `${W < 600 ? '📱' : '🖥️'}${sombre ? '🌙' : ''}`;
  const { ctx, pg, erreurs, tel } = await ouvrir(nav, { W, sombre, choisi: '9109' });
  try {
    await attendreListe(pg); await pg.waitForTimeout(2500);
    if (process.env.BANC_SONDE) console.log(await pg.evaluate(() => JSON.stringify(['vinted_sale_overrides', 'vinted_offvinted_buys', 'vinted_annonce_numeros', 'vrm_meilleures_sources'].map((k) => [k, (localStorage.getItem(k) || '').slice(0, 200)]))));
    if (process.env.BANC_SONDE2) console.log(await pg.evaluate(() => { for (const c of document.querySelectorAll('.vrm-main')) c.scrollTop = 0; const h = document.querySelector('[data-achats-hero]'); const out = []; for (let x = h; x && !x.classList.contains('vrm-main'); x = x.parentElement) { const r = x.getBoundingClientRect(); const cs = getComputedStyle(x); out.push(`${x.tagName}.${String(x.className).slice(0, 40)} top=${Math.round(r.top)} pt=${cs.paddingTop} mt=${cs.marginTop}`); let p = x.previousElementSibling; let k = 0; while (p && k < 4) { const q = p.getBoundingClientRect(); if (q.height > 0) out.push(`   ↑ ${p.tagName}.${String(p.className).slice(0, 40)} top=${Math.round(q.top)} h=${Math.round(q.height)} mb=${getComputedStyle(p).marginBottom}`); p = p.previousElementSibling; k++; } } return out.join('\n'); }));
    if (process.env.BANC_SONDE) console.log(await pg.evaluate(() => { const a = [...document.querySelectorAll('.vrm-achats')].find((x) => x.getBoundingClientRect().height > 0); const pa = a && a.parentElement; return [...(pa ? pa.children : [])].map((e) => `${e.tagName}.${String(e.className).slice(0, 50)} [${[...e.attributes].filter((x) => x.name.startsWith('data-')).map((x) => x.name).slice(0, 2)}] h=${Math.round(e.getBoundingClientRect().height)}`).join('\n') + '\n--- dans .vrm-achats\n' + [...(a ? a.children : [])].map((e) => `${e.tagName}.${String(e.className).slice(0, 50)} [${[...e.attributes].filter((x) => x.name.startsWith('data-')).map((x) => x.name).slice(0, 2)}] h=${Math.round(e.getBoundingClientRect().height)}`).join('\n'); }));
    if (process.env.BANC_SONDE) console.log(await pg.evaluate(() => { const r = [...document.querySelectorAll('.vrm-achats .vrm-buy-row')].find((x) => x.getBoundingClientRect().height > 0); if (!r) return 'pas de rangée'; const R = r.getBoundingClientRect(); return [r, ...r.querySelectorAll('*')].slice(0, 30).map((e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return `${e.tagName}.${String(e.className).slice(0, 30)} x=${Math.round(b.left - R.left)} y=${Math.round(b.top - R.top)} w=${Math.round(b.width)} h=${Math.round(b.height)} ga=${cs.gridArea} mw=${cs.maxWidth} d=${cs.display}`; }).join('\n'); }));
    const tag = `${W}${sombre ? '-sombre' : ''}`;
    await capture(pg, `haut-${tag}`);
    // Le haut de l'écran Achats lui-même (la carte de chiffres, les onglets, la recherche).
    await pg.evaluate(() => { const a = [...document.querySelectorAll('.vrm-achats')].find((x) => x.getBoundingClientRect().height > 0); if (a) a.scrollIntoView({ block: 'start' }); for (const c of document.querySelectorAll('.vrm-main')) c.scrollTop -= 70; });
    await pg.waitForTimeout(500);
    await capture(pg, `ecran-${tag}`);
    // La liste des comptes : amenée à l'écran.
    await pg.evaluate(() => { const e = document.querySelector('.vrm-achats [data-groupe-compte="ouvert"]'); if (e) e.scrollIntoView({ block: 'start' }); for (const c of document.querySelectorAll('.vrm-main')) c.scrollTop -= 120; });
    await pg.waitForTimeout(500);
    await capture(pg, `comptes-${tag}`);
    const m = await pg.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden'; };
      const out = {};
      // F1 — rien ne déborde de sa liste (ni ne touche son bord : 4 px de marge au moins).
      out.deborde = [];
      for (const liste of document.querySelectorAll('.vrm-achats .vrm-buy-list')) {
        const L = liste.getBoundingClientRect();
        for (const b of liste.querySelectorAll('button, a')) { if (!vis(b)) continue; const r = b.getBoundingClientRect(); /* une rangée pleine largeur EST la carte */ if (r.width > L.width * 0.8) continue; if (r.right > L.right - 4 || r.left < L.left + 4) out.deborde.push(`${(b.className || b.tagName).toString().slice(0, 40)} ${Math.round(r.right - L.right)} px`); }
      }
      // F2 — les comptes.
      const tete = [...document.querySelectorAll('.vrm-achats .vrm-gc-tete')].filter(vis);
      out.tetes = tete.map((t) => { const cs = getComputedStyle(t); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3; const n = t.querySelector('.vrm-gc-n'); const tr = t.getBoundingClientRect(); const nr = n ? n.getBoundingClientRect() : null;
        return { t: t.innerText.replace(/\s+/g, ' ').trim(), fs: parseFloat(cs.fontSize), lignes: Math.round((t.querySelector('.vrm-gc-titre') || t).getBoundingClientRect().height / lh), nADroite: nr ? (tr.right - nr.right) < 24 && (nr.left - tr.left) > tr.width / 2 : null }; });
      out.comptes = [...document.querySelectorAll('.vrm-achats .vrm-gc-compte')].filter(vis).map((b) => ({ h: Math.round(b.getBoundingClientRect().height), fs: parseFloat(getComputedStyle(b.querySelector('.vrm-gc-nom')).fontSize) }));
      // F3/F4/F5 — les sources.
      const carte = document.querySelector('.vrm-achats [data-stats-carte="meilleures-sources"]');
      out.sources = null;
      if (carte) {
        const h = carte.querySelector('h2');
        let dansSurface = false;
        for (let x = h && h.parentElement; x && x !== carte.parentElement; x = x.parentElement) {
          const cs = getComputedStyle(x); const bg = cs.backgroundColor; const plein = bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg);
          if (plein && parseFloat(cs.borderTopLeftRadius) >= 8) { dansSurface = true; break; }
        }
        const longues = [];
        const w = document.createTreeWalker(carte, NodeFilter.SHOW_ELEMENT);
        for (let el = w.nextNode(); el; el = w.nextNode()) {
          if (!vis(el) || el.closest('details:not([open])') || el.closest('[data-ms-feuille]')) continue;
          if (el.closest('button[aria-pressed]')) continue;
          const direct = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim().length > 2);
          if (!direct) continue;
          const cs = getComputedStyle(el); if (cs.display === 'inline') continue;
          const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.35;
          const n = Math.round(el.getBoundingClientRect().height / lh);
          if (n > 1 && (el.innerText || '').trim().split(/\s+/).length > 4) longues.push(`${n} lignes : « ${el.innerText.trim().slice(0, 60)} »`);
        }
        const tuiles = [...carte.querySelectorAll('.vrm-ms-ligne, [data-ms-source]')].slice(0, 1).map((src) => [...src.querySelectorAll('*')].filter((e) => vis(e) && /\d/.test(e.textContent || '') && e.children.length === 0 && parseFloat(getComputedStyle(e).fontSize) >= 28).length);
        out.sources = { titreDansCarte: dansSurface, longues, tuiles: tuiles[0] || 0 };
      }
      // F6 — l'accent sur un montant.
      // L'accent (bleu d'Apple, clair ou nuit), quelle que soit l'écriture de la couleur calculée.
      const rgb = (c) => { const m = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(c); if (m) return [m[1], m[2], m[3]].map((x) => +x * 255); const n = /rgba?\((\d+), (\d+), (\d+)/.exec(c); return n ? [+n[1], +n[2], +n[3]] : null; };
      const bleu = (c) => { const v = rgb(c); return !!v && v[2] - v[0] > 80 && v[2] > 150; };
      out.accent = [];
      const w2 = document.createTreeWalker([...document.querySelectorAll('.vrm-achats')].find(vis) || document.body, NodeFilter.SHOW_TEXT);
      for (let n = w2.nextNode(); n; n = w2.nextNode()) {
        if (!/€/.test(n.nodeValue || '')) continue; const el = n.parentElement; if (!el || !vis(el) || el.closest('a, summary, button:not([data-ms-source]):not(.vrm-fu-case)')) continue;
        if (bleu(getComputedStyle(el).color)) out.accent.push((el.innerText || '').trim().slice(0, 40));
      }
      // F7 — les rangées d'achat.
      out.rangees = [...document.querySelectorAll('.vrm-achats .vrm-buy-row')].filter(vis).slice(0, 6).map((r) => { const ph = r.querySelector('.vrm-buy-ph'); return { h: Math.round(r.getBoundingClientRect().height), ph: ph ? Math.round(ph.getBoundingClientRect().width) : 0 }; });
      // F8 — la carte héros.
      const hero = document.querySelector('.vrm-achats [data-achats-hero]');
      out.hero = hero ? { h: Math.round(hero.getBoundingClientRect().height), sombre: (() => { const av = getComputedStyle(hero, '::before'); const bg = getComputedStyle(hero).backgroundColor; return (av.content !== 'none' && /gradient|rgb/.test(av.backgroundImage + av.backgroundColor) && !/rgba\(0, 0, 0, 0\)/.test(av.backgroundColor + '')) || !/rgba\(0, 0, 0, 0\)|transparent/.test(bg); })(),
        chiffres: [...hero.querySelectorAll('b, .vrm-fu-grand')].filter((e) => vis(e) && /\d/.test(e.textContent || '')).length } : null;
      // F9 — la liste d'abord : sa 1re ligne (en-tête de groupe ou rangée) est sur le PREMIER écran, à mi-hauteur au plus.
      for (const c of document.querySelectorAll('.vrm-main')) c.scrollTop = 0;
      const liste = [...document.querySelectorAll('.vrm-achats .vrm-buy-list')].find((l) => l.querySelector('.vrm-buy-row') && vis(l));
      const prem = liste && [...liste.children].find(vis);
      out.premiere = prem ? Math.round(prem.getBoundingClientRect().top) : null;
      // Ce qu'Achats pose lui-même au-dessus de sa liste (depuis le haut de son écran) : un QUART de l'écran au plus — le
      // reste (grand titre, choix du compte, ligne de fraîcheur) appartient à la coque.
      const ecr = [...document.querySelectorAll('.vrm-achats')].find(vis);
      out.dansAchats = prem && ecr ? Math.round(prem.getBoundingClientRect().top - ecr.getBoundingClientRect().top) : null;
      // F10 — au plus UN bouton plein à l'accent visible.
      out.pleins = [...document.querySelectorAll('.vrm-main button, .vrm-main a')].filter((x) => { if (!vis(x)) return false; const r = x.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return false; return bleu(getComputedStyle(x).backgroundColor); }).map((x) => (x.innerText || x.getAttribute('aria-label') || '').trim().slice(0, 24));
      out.vh = innerHeight;
      return out;
    });
    dit(!m.deborde.length, `${T} F1 rien ne déborde de sa carte (rangées d'achat, comptes)`, m.deborde.slice(0, 4).join(' | '));
    const tetesOk = m.tetes.length >= 2 && m.tetes.every((t) => t.lignes <= 1 && t.fs <= 13.5 && t.nADroite !== false);
    dit(tetesOk, `${T} F2 en-têtes de groupe d'une ligne (13 px), le nombre calé à droite`, JSON.stringify(m.tetes));
    if (tel) dit(m.comptes.length >= 5 && m.comptes.every((c) => c.h >= 52 && c.h <= 56 && c.fs === 17), `${T} F2 rangées de compte 52–56 px, nom 17 px`, JSON.stringify(m.comptes.slice(0, 3)));
    dit(m.sources && !m.sources.titreDansCarte, `${T} F3 « Tes meilleures sources » : le titre est HORS de la carte`, JSON.stringify(m.sources && m.sources.titreDansCarte));
    dit(m.sources && !m.sources.longues.length, `${T} F4 aucune phrase de plus d'une ligne visible sans repli`, m.sources && m.sources.longues.slice(0, 3).join(' | '));
    dit(m.sources && m.sources.tuiles >= 3, `${T} F5 des tuiles : ≥ 3 chiffres d'au moins 28 px par source`, m.sources && m.sources.tuiles);
    dit(!m.accent.length, `${T} F6 aucun montant à la couleur d'accent`, m.accent.slice(0, 3).join(' | '));
    if (tel) dit(m.rangees.length >= 2 && m.rangees.every((r) => r.h >= 64 && r.h <= 76 && r.ph >= 48 && r.ph <= 56), `${T} F7 rangée d'achat 64–76 px, vignette 48–56 px`, JSON.stringify(m.rangees.slice(0, 3)));
    dit(!!m.hero && !m.hero.sombre && m.hero.h <= 72 && m.hero.chiffres >= 3, `${T} F8 une BANDE de chiffres (≥ 3), ≤ 72 px, sans carte sombre (AJOUT 3)`, JSON.stringify(m.hero));
    // F9 : Achats ne pose au-dessus de sa liste qu'un QUART de l'écran (bande + barre + recherche) ; l'écran entier vise la
    // mi-hauteur (AJOUT 3) — la part de la coque (titre, phrase, fraîcheur, comptes) est dite, pas jugée ici.
    if (tel) dit(m.dansAchats != null && m.dansAchats <= m.vh / 4, `${T} F9 la liste d'abord : Achats pose ≤ ${m.vh / 4} px au-dessus de sa 1re ligne (écran entier : ${m.premiere} px, visé ≤ ${m.vh / 2})`, m.dansAchats);
    dit(m.pleins.length <= 1, `${T} F10 au plus un bouton plein à l'accent à l'écran`, JSON.stringify(m.pleins));
    await pg.evaluate(() => { const e = document.querySelector('.vrm-achats [data-stats-carte="meilleures-sources"]'); if (e) e.scrollIntoView({ block: 'start' }); for (const c of document.querySelectorAll('.vrm-main')) c.scrollTop -= 110; });
    await pg.waitForTimeout(500);
    await capture(pg, `sources-${tag}`);
    await pg.evaluate(() => { const e = [...document.querySelectorAll('.vrm-achats .vrm-achats-recus-bas')].find((x) => x.getBoundingClientRect().height > 0); if (e) e.scrollIntoView({ block: 'end' }); });
    await pg.waitForTimeout(400);
    await capture(pg, `bas-${tag}`);
    await capture(pg, `plein-${tag}`, true);
    dit(!erreurs.length, `${T} aucune erreur`, erreurs.join(' | '));
  } finally { await ctx.close(); }
}

// ── À 1 000 ACHATS ───────────────────────────────────────────────────────────
async function blocP(nav) {
  const T = '📱⏱';
  const { ctx, pg, erreurs, t0 } = await ouvrir(nav, { W: 390, sombre: false, choisi: '' });
  const mes = {};
  try {
    await attendreListe(pg);
    mes.p1 = Date.now() - t0;
    await pg.waitForTimeout(2500);
    // P4 : la première rangée en haut de l'écran, sous la barre du haut ; combien d'achats ENTIERS se voient.
    mes.p4 = await pg.evaluate(async () => {
      const rows = [...document.querySelectorAll('.vrm-achats .vrm-buy-row')];
      if (!rows.length) return 0;
      // Le haut utile : sous ce qui est COLLÉ en haut (barre, recherche…), au-dessus de la barre d'onglets.
      rows[0].scrollIntoView({ block: 'start' }); await new Promise((r) => setTimeout(r, 300));
      const couvre = (y) => { const e = document.elementFromPoint(195, y); return e && !e.closest('.vrm-buy-list'); };
      let haut = 0; while (haut < innerHeight / 2 && couvre(haut + 1)) haut += 4;
      rows[0].scrollIntoView({ block: 'start' }); for (const c of document.querySelectorAll('.vrm-main')) c.scrollTop -= haut; await new Promise((r) => setTimeout(r, 300));
      let bas = innerHeight; while (bas > innerHeight / 2 && couvre(bas - 1)) bas -= 4;
      return rows.filter((r) => { const b = r.getBoundingClientRect(); return b.top >= haut - 1 && b.bottom <= bas + 1; }).length;
    });
    await capture(pg, 'mille-liste-390');
    if (process.env.BANC_SONDE) console.log(await pg.evaluate(() => { const r = [...document.querySelectorAll('.vrm-achats .vrm-buy-row')].find((x) => x.getBoundingClientRect().height > 0); const R = r.getBoundingClientRect(); return [r, ...r.querySelectorAll('*')].slice(0, 22).map((e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return `${e.tagName}.${String(e.className).slice(0, 30)} x=${Math.round(b.left - R.left)} y=${Math.round(b.top - R.top)} w=${Math.round(b.width)} h=${Math.round(b.height)} ga=${cs.gridArea} gtr=${cs.gridTemplateRows} pad=${cs.padding} minh=${cs.minHeight} rg=${cs.rowGap} pr=${cs.paddingRight}`; }).join('\n'); }));
    mes.p3 = await pg.evaluate(() => { const r = document.querySelector('.vrm-achats .vrm-buy-row'); const l = r && r.closest('.vrm-buy-list'); return l ? l.querySelectorAll('*').length : 0; });
    // P2 : défiler jusqu'en bas, par pas d'un écran.
    const cls0 = await pg.evaluate(() => window.__cls || 0);
    for (let i = 0; i < 80; i++) {
      const fin = await pg.evaluate(() => { const se = [...document.querySelectorAll('.vrm-main'), document.scrollingElement].find((x) => x && x.scrollHeight > x.clientHeight + 40 && x.getClientRects().length); if (!se) return true; const avant = se.scrollTop; se.scrollTop = avant + Math.round(se.clientHeight * 0.9); return se.scrollTop === avant; });
      await pg.waitForTimeout(60);
      if (fin) break;
    }
    await pg.waitForTimeout(500);
    mes.p2 = Math.round(((await pg.evaluate(() => window.__cls || 0)) - cls0) * 1000) / 1000;
    // P5 : taper un N° dans la recherche.
    await pg.evaluate(() => { for (const c of [...document.querySelectorAll('.vrm-main'), document.scrollingElement]) if (c) c.scrollTop = 0; });
    const champ = pg.locator('.vrm-achats input[type="search"]').first();
    await champ.waitFor({ timeout: 5000 });
    // Le temps se mesure DANS la page (performance.now) : de la frappe (l'événement « input ») à la rangée
    // trouvée dans le DOM (MutationObserver) — sans les allers-retours du pilote.
    mes.p5 = await pg.evaluate(() => new Promise((fini) => {
      const champ = [...document.querySelectorAll('.vrm-achats input[type="search"]')].find((x) => x.getBoundingClientRect().height > 0);
      const trouve = () => { const r = [...document.querySelectorAll('.vrm-achats .vrm-buy-row')].filter((x) => x.getBoundingClientRect().height > 0); return r.length >= 1 && r.length <= 3 && r.some((x) => /N°133\b/.test(x.innerText)); };
      const t0 = performance.now();
      const mo = new MutationObserver(() => { if (trouve()) { mo.disconnect(); fini(Math.round(performance.now() - t0)); } });
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
      setTimeout(() => { mo.disconnect(); fini(9999); }, 5000);
      const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      poser.call(champ, '133'); champ.dispatchEvent(new Event('input', { bubbles: true }));
    }));
    await pg.waitForTimeout(300);
    mes.p5ok = await pg.evaluate(() => [...document.querySelectorAll('.vrm-achats .vrm-buy-row')].some((x) => /N°133\b/.test(x.innerText)));
    await capture(pg, 'mille-recherche-390');
  } finally { await ctx.close(); }
  console.log(`  ⏱ P1 ${mes.p1} ms · P2 CLS ${mes.p2} · P3 ${mes.p3} nœuds · P4 ${mes.p4} achats visibles · P5 ${mes.p5} ms`);
  dit(mes.p2 <= 0.05, `${T} P2 défiler jusqu'en bas sans saut (CLS ≤ 0,05)`, mes.p2);
  dit(mes.p4 >= 8, `${T} P4 au moins 8 achats entiers sur un écran de 390`, mes.p4);
  dit(mes.p5ok && mes.p5 < 300, `${T} P5 le N° tapé trouve la paire en < 300 ms`, `${mes.p5} ms`);
  dit(!erreurs.length, `${T} aucune erreur`, erreurs.join(' | '));
  if (process.env.BANC_ECRIT) fs.writeFileSync(process.env.BANC_ECRIT, JSON.stringify(mes));
  if (process.env.BANC_REF && fs.existsSync(process.env.BANC_REF)) {
    const ref = JSON.parse(fs.readFileSync(process.env.BANC_REF, 'utf8'));
    dit(mes.p1 <= ref.p1 * 1.5 + 500, `${T} P1 premier rendu pas plus lent que origin/main`, `${mes.p1} ms contre ${ref.p1} ms`);
    dit(mes.p3 <= ref.p3 * 1.1, `${T} P3 pas plus de nœuds DOM que origin/main`, `${mes.p3} contre ${ref.p3}`);
    dit(mes.p2 <= ref.p2 + 0.02, `${T} P2 pas plus de sauts que origin/main`, `${mes.p2} contre ${ref.p2}`);
  }
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    if (SEUL.includes('F')) {
      for (const [W, sombre] of [[390, false], [390, true], [1512, false]]) await essaie(`F ${W}`, () => blocF(nav, W, sombre));
    }
    if (SEUL.includes('P')) await essaie('P', () => blocP(nav));
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} refonte-achats : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
