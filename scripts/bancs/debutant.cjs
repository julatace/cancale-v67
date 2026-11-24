require('./_porte-banc.cjs');
const { ecranPret } = require('./_ecran-pret.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « DÉBUTANT » (24 nov., lot debutant) — Julien : « tout doit être parfait,
//  imagine un débutant achat-revente qui ne connaît pas du tout le site ».
//  Un robot joue la PREMIÈRE semaine d'une personne qui n'a jamais vu VRM, sur un
//  compte NEUF (session au `created_at` du jour, comme Supabase la rend), à 390 px
//  tactile ET 1512 px, clair ET sombre. Aucune donnée réelle : la base est SERVIE
//  ici (forme réelle : `app_data` clé-valeur, `select=` projeté, `id=eq.`/`like.`),
//  les écritures de l'app restent en mémoire du banc.
//  Les étapes (chacune avec SA base) :
//   D1 la page publique et l'inscription ;
//   D2 le premier écran (Aujourd'hui, compte vide) : la liste « Ta première semaine »
//      en 3 étapes, UNE action pleine, aucune fenêtre imposée ;
//   D3 chaque écran VIDE : exactement une action pleine, une phrase, aucun « 0 » qui
//      veut dire « pas su », aucun mot interdit sans son explication ;
//   D4 l'extension (Chrome, Orion) : chaque étape dite ;
//   D5 Vinted relié, les premières annonces arrivent (sans prix d'achat, sans N°) ;
//   D6 la première vente, son bordereau, « À envoyer » ;
//   D7 le premier mois dans Argent (URSSAF, « recettes » expliquées ; jamais
//      « encaissé », le régime jamais deviné) ;
//   D8 Paramètres, l'aide, l'abonnement.
//  Partout : rien ne déborde, cibles ≥ 44 px au doigt, aucun NaN/undefined.
//  Les jugements portent sur des `data-*` et des nombres rendus (§6.4), jamais sur
//  une formulation — sauf la LISTE des mots interdits sans explication (le jargon).
//  SHOTS=dossier : une capture par écran (à REGARDER, §6.2). LARGEURS / THEMES /
//  ETAPES=D2,D3… restreignent. BANC_DIST : un autre build (preuve sur l'avant).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { lancer } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST ? path.resolve(process.env.BANC_DIST) : path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (15000 + Math.floor(Math.random() * 3000));
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const ETAPES = liste('ETAPES', 'D1,D2,D3,D4,D5,D6,D7,D8');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.zip': 'application/zip' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000db';
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
// Un compte NEUF : Supabase rend `created_at` (c'est lui qui ouvre « Bien démarrer » et la liste de la semaine).
const SESSION = { access_token: 'jeton-debutant', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: UID, email: 'debutante@exemple.test', created_at: iso(0.05) } };

let ko = 0;
const defauts = [];
const dit = (bon, quoi, det) => { if (!bon) { ko++; defauts.push(quoi + (det ? ' — ' + det : '')); } console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`); };

// ── LES BASES DU PARCOURS (inventées, jamais réelles) ─────────────────────────
const MAIN_VU = { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) } };
const annonce = (i) => ({ id: 91000 + i, title: ['Nike Air Max 90 blanche', 'Adidas Samba OG noire', 'New Balance 550 crème'][i] + ' taille ' + (40 + i), price: { amount: String(45 + i * 10) + '.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: ['Nike', 'Adidas', 'New Balance'][i], size_title: String(40 + i), status: 'Très bon état', view_count: 3 + i, favourite_count: i, created_at_ts: Math.floor((now - (1 + i) * 86400000) / 1000) });
const ANN = [annonce(0), annonce(1), annonce(2)];
const COMPTE = [{ id: 1, vinted_user_id: '9111', login: 'debutante_v', domain: 'www.vinted.fr', owner: UID, updated_at: iso(0), created_at: iso(0.04) }];
const VENTE = { transaction_id: 96000, title: ANN[0].title, price: { amount: '45', currency_code: 'EUR' }, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: iso(0.2), photo: null, item_id: ANN[0].id };
const BASES = {
  vide: () => ({ lignes: [{ id: 'main', data: { ...MAIN_VU } }], comptes: [] }),
  relie: () => ({ lignes: [{ id: 'main', data: { ...MAIN_VU } }, { id: 'harvest_9111_listings', data: { capturedAt: iso(0.01), complete: true, payload: { items: ANN } } }, { id: 'harvest_9111_orders_sold', data: { capturedAt: iso(0.01), payload: { my_orders: [] } } }, { id: 'harvest_9111_orders_purchased', data: { capturedAt: iso(0.01), payload: { my_orders: [] } } }], comptes: COMPTE }),
  // La feuille « debutante_v est reliée » a déjà été vue (le jour où elle a relié son compte, D5).
  vente: () => ({ lignes: [{ id: 'main', data: { ...MAIN_VU, vinted_annonce_numeros: { [ANN[0].id]: { numero: '1', buyPrice: '20' } } } }, { id: 'vrm_comptes_relies', data: { v: 1, rev: 1, bases: { vinted: now - 86400000 }, connus: { 'vinted:9111': { at: now - 86400000, accueilli: now - 86000000, notifie: now - 86000000 } } } }, { id: 'harvest_9111_listings', data: { capturedAt: iso(0.01), complete: true, payload: { items: ANN.slice(1) } } }, { id: 'harvest_9111_orders_sold', data: { capturedAt: iso(0.01), payload: { my_orders: [VENTE] } } }, { id: 'harvest_9111_orders_purchased', data: { capturedAt: iso(0.01), payload: { my_orders: [] } } },
    { id: 'email_bord_96000', data: { transaction: '96000', filename: 'bordereau-96000.pdf', pdfB64: 'JVBERi0x', modele: VENTE.title, account: 'debutante_v', receivedAt: iso(0.15), dateLimite: new Date(now + 4 * 86400000).toLocaleDateString('fr-FR') + ' 10 h 00', type: 'vinted' } }], comptes: COMPTE }),
};

// ── LE SERVEUR (dist/) ──────────────────────────────────────────────────────
const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const projette = (row, sel) => {
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], al = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[al] = row.id; continue; }
    if (src === 'owner') { out[al] = UID; continue; }
    if (src === 'updated_at') { out[al] = iso(0); continue; }
    if (src === 'data') { out[al] = row.data; continue; }
    let v = row.data; for (const s of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[s];
    out[al] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function contexte(nav, W, sombre) {
  const tel = W < 600;
  return nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', serviceWorkers: 'block', reducedMotion: 'reduce', locale: 'fr-FR', timezoneId: 'Europe/Paris', userAgent: tel ? undefined : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
}

// Une page de la débutante sur SA base (`base.lignes`, `base.comptes`).
async function ouvrir(nav, { W, sombre, base, tab = 'journee', bienvenue = true }) {
  const tel = W < 600;
  const ctx = await contexte(nav, W, sombre);
  const pg = await ctx.newPage();
  const journal = { erreurs: [], http: [] };
  pg.on('pageerror', (e) => journal.erreurs.push(String(e.message || e).slice(0, 240)));
  pg.on('response', (r) => { const u = r.url(); if (r.status() >= 400 && /^http:\/\/localhost/.test(u) && !/favicon/.test(u)) journal.http.push(r.status() + ' ' + u.replace(/^http:\/\/localhost:\d+/, '').slice(0, 160)); });
  await pg.addInitScript(([s, bv, sombre]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vrm_session', JSON.stringify(s));
        localStorage.setItem('vrm_local_owner', s.user.id);
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        if (bv) { localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' })); }
        else { localStorage.setItem('vrm_banc_bienvenue', '1'); localStorage.setItem('vrm_banc_visite', '1'); }
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [SESSION, bienvenue, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), m = req.method();
    const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(m === 'GET' ? base.comptes : []);
    if (!/\/rest\/v1\/app_data/.test(u)) return json([]);
    if (m === 'POST' || m === 'PATCH') {
      try {
        const b = JSON.parse(req.postData() || 'null');
        const rows = Array.isArray(b) ? b : b && b.id ? [b] : [];
        const eqm = /[?&]id=eq\.([^&]*)/.exec(u);
        if (m === 'PATCH' && eqm && b && b.data) rows.push({ id: eqm[1], data: b.data });
        for (const r of rows) { if (!r || !r.id) continue; const i = base.lignes.findIndex((x) => x.id === r.id); if (i >= 0) base.lignes[i] = { id: r.id, data: r.data }; else base.lignes.push({ id: r.id, data: r.data }); }
      } catch (_) {}
      return json(m === 'PATCH' ? [{ id: 'main' }] : [], m === 'POST' ? 201 : 200);
    }
    if (m === 'DELETE') return json([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== '*') ? projette(r, sel) : ({ ...r, owner: UID, updated_at: iso(0) });
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return json(base.lignes.filter((r) => r.id === eq[1]).map(forme));
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return json(base.lignes.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    const nonNuls = [...u.matchAll(/[?&]data->>(\w+)=not\.is\.null/g)].map((x) => x[1]);
    const garde = (r) => nonNuls.every((k) => r && r.data && r.data[k] != null);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return json(base.lignes.filter((r) => re.test(r.id) && garde(r)).map(forme)); }
    return json([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  return { ctx, pg, journal, tel };
}

// ── CE QUE LA DÉBUTANTE VOIT ────────────────────────────────────────────────
// Le jargon : chaque mot n'est permis que s'il porte son explication à côté (un élément
// `[data-mot-explique]` qui le contient, ou un « Pourquoi ? » / une bulle d'aide dans la
// même carte). Le mot seul, sans rien pour l'expliquer, est un défaut.
const JARGON = [
  ['bordereau', /\bbordereaux?\b/i], ['versement', /\bversements?\b/i], ['CA déclaré', /\bCA déclaré\b/i], ['DAC7', /\bDAC7\b/],
  ['prudence', /\bprudence\b/i], ['recette apprise', /\brecettes? apprises?\b/i], ['encaissé', /\bencaissée?s?\b/i],
  ['harvest', /\bharvest\b/i], ['payload', /\bpayload\b/i], ['token', /\btoken\b/i], ['sync', /\bsync\b/i], ['owner', /\bowner\b/i],
];
const INSPECTE = (pg, { tel, jargon }) => pg.evaluate(({ tel, jargon }) => {
  const rogne = (e) => { for (let p = e; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (s.clipPath === 'inset(50%)' || /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(s.clip)) { const r = p.getBoundingClientRect(); if (r.width <= 1 && r.height <= 1) return true; } } return false; };
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05 && !rogne(e) && !e.closest('[inert], [aria-hidden="true"], details:not([open]) > :not(summary)'); };
  const main = document.querySelector('.vrm-main') || document.body;
  const texte = main.innerText || '';
  const mauvais = [];
  for (const re of [/\bNaN\b/, /\bundefined\b/, /Invalid Date/i, /\[object Object\]/, /(^|[\s:(«])null([\s).,»]|$)/m, /\bInfinity\b/]) { const m = re.exec(texte); if (m) mauvais.push(texte.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')); }
  // Les actions PLEINES visibles (le bouton primaire, `data-n-variante="primaire"`), feuilles comprises.
  const pleins = [...document.querySelectorAll('[data-n-variante="plein"]')].filter(vis).map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40));
  // Un écran vide : sa carte d'écran vide (`.vrm-empty-state`, `[data-ecran-vide]`) et ses actions.
  const vides = [...main.querySelectorAll('.vrm-empty-state, [data-ecran-vide], .n-vide')].filter(vis).map((c) => ({
    t: (c.innerText || '').trim().split('\n')[0].slice(0, 60),
    n: [...c.querySelectorAll('button, a[href], [role="button"]')].filter((b) => vis(b) && !b.closest('[data-pourquoi], details')).length,
  }));
  // Le jargon sans explication.
  const jargonSeul = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n && jargonSeul.length < 8; n = tw.nextNode()) {
    const el = n.parentElement; if (!el || !vis(el) || el.closest('script, style, [data-glossaire], [data-mot-explique], [data-n-pourquoi], .n-pourquoi, details, [data-jargon-assume]')) continue;
    for (const [mot, src, fl] of jargon) {
      if (!new RegExp(src, fl).test(n.nodeValue)) continue;
      // Une explication dans la même carte (bulle d'aide, « Pourquoi ? ») suffit.
      const carte = el.closest('section, article, .vrm-card, [role="dialog"], li') || el.parentElement;
      if (carte && carte.querySelector('[data-glossaire], [data-mot-explique], [data-n-pourquoi], .n-pourquoi, [data-infopop], details')) continue;
      jargonSeul.push(`${mot} : « ${n.nodeValue.trim().slice(0, 60)} »`);
    }
  }
  // « 0 » qui veut dire « pas su » : un chiffre porté `data-pas-su` ne s'écrit jamais 0.
  const zeroPasSu = [...document.querySelectorAll('[data-pas-su="1"], [data-pas-su="true"]')].filter(vis).filter((e) => /(^|\s)0([,.]00)?(\s*€)?(\s|$)/.test((e.innerText || '').trim())).map((e) => e.innerText.trim().slice(0, 30));
  const debord = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const dehors = [];
  for (const e of document.querySelectorAll('.vrm-main *, [role="dialog"] *')) {
    if (dehors.length > 6) break;
    const r = e.getBoundingClientRect();
    if (r.right > innerWidth + 1 && r.left < innerWidth && vis(e)) {
      let p = e.parentElement, defile = false;
      while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(s.overflowX)) { defile = true; break; } p = p.parentElement; }
      if (!defile) dehors.push((e.className && String(e.className).slice(0, 40)) || e.tagName);
    }
  }
  const petits = [];
  if (tel) for (const e of document.querySelectorAll('button, [role="button"], a[href], input[type="checkbox"], input[type="radio"], select, summary')) {
    if (!vis(e) || e.closest('.maplibregl-ctrl, .vrm-sr, svg')) continue;
    const r = e.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight * 3) continue;
    if (e.tagName === 'A' && getComputedStyle(e).display === 'inline') continue;
    // (24 nov., lot debutant) La zone de toucher RÉELLE : un ::before / ::after posé en absolu qui déborde le bouton
    // (`inset: -8px -4px`) reçoit le toucher du bouton — elle compte (Ventes : « Relier », « + prix »).
    const zone = (el) => { const b = el.getBoundingClientRect(); let h = b.height, w = b.width; for (const ps of ['::before', '::after']) { const s = getComputedStyle(el, ps); if (s.content === 'none' || s.position !== 'absolute' || s.pointerEvents === 'none') continue; const px = (v) => (/px$/.test(v) ? parseFloat(v) : 0); const t = px(s.top), bo = px(s.bottom), l = px(s.left), ri = px(s.right); if (s.top !== 'auto' && s.bottom !== 'auto') h = Math.max(h, b.height - t - bo); if (s.left !== 'auto' && s.right !== 'auto') w = Math.max(w, b.width - l - ri); } return { height: h, width: w }; };
    const z = zone(e);
    if (z.height < 43.5 || z.width < 43.5) petits.push(`${(e.innerText || e.getAttribute('aria-label') || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  const anglais = [];
  for (const re of [/\bLoading\b/, /\bError\b/, /\bSettings\b/, /\bSubmit\b/, /\bCancel\b/, /\bDashboard\b/, /\blistings?\b/, /\borders?_\w+/]) { const m = re.exec(texte); if (m) anglais.push(texte.slice(Math.max(0, m.index - 20), m.index + 30).replace(/\s+/g, ' ')); }
  const feuille = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]:not([hidden]), .vrm-bienvenue, .vrm-visite-bulle, .vrm-conseil-bulle')].some(vis);
  return { mauvais, pleins, vides, jargonSeul, zeroPasSu, debord, dehors, petits, anglais, feuille, texte: texte.slice(0, 3000) };
}, { tel, jargon: jargon.map(([m, re]) => [m, re.source, re.flags]) });

async function capture(pg, nom) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: true, timeout: 60000 }).catch(() => pg.screenshot({ path: path.join(SHOTS, nom + '.png'), timeout: 60000 }).catch(() => {}));
}

// Les règles de CHAQUE écran du parcours.
function juger(T, nom, r, { vide = false, pleinsMax = 1 } = {}) {
  dit(!r.mauvais.length, `${T} ${nom} : aucun NaN / undefined / null`, r.mauvais.join(' ¦ '));
  dit(r.pleins.length <= pleinsMax, `${T} ${nom} : au plus ${pleinsMax} action pleine (${r.pleins.length})`, r.pleins.join(' ¦ '));
  if (vide) {
    dit(r.vides.length > 0 || r.pleins.length === 1, `${T} ${nom} : l'écran vide dit quoi faire (une carte d'écran vide ou une action)`, r.texte.slice(0, 200));
    for (const v of r.vides) dit(v.n === 1, `${T} ${nom} : l'écran vide « ${v.t} » porte exactement une action (${v.n})`);
  }
  dit(!r.jargonSeul.length, `${T} ${nom} : aucun mot technique sans son explication`, r.jargonSeul.join(' ¦ '));
  dit(!r.zeroPasSu.length, `${T} ${nom} : « pas su » ne s'écrit jamais 0`, r.zeroPasSu.join(' ¦ '));
  dit(!r.anglais.length, `${T} ${nom} : aucun mot anglais ni interne`, r.anglais.join(' ¦ '));
  dit(!r.debord && !r.dehors.length, `${T} ${nom} : rien ne déborde`, JSON.stringify(r.dehors));
  if (r.petits) dit(!r.petits.length, `${T} ${nom} : chaque cible au doigt fait 44 px`, r.petits.slice(0, 8).join(' ¦ '));
}

async function aller(o, tab) {
  await o.pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await ecranPret(o.pg, '', { max: 20000 });
}
const INSP = (o) => INSPECTE(o.pg, { tel: o.tel, jargon: JARGON });

async function parcours(nav, W, theme) {
  const sombre = theme === 'sombre', tel = W < 600;
  const T = (d) => `[${d} ${W}px ${theme}]`;
  const nomCap = (d, x) => `${d}-${W}-${theme}-${x}`;
  // D1 — la page publique, puis l'inscription.
  if (ETAPES.includes('D1')) {
    const ctx = await contexte(nav, W, sombre); const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.addInitScript((s) => { try { localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, sombre);
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    await pg.route('**/auth/v1/settings**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"external":{},"mailer_autoconfirm":false}' }));
    await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pg.waitForFunction(() => { const r = document.getElementById('root'); return r && r.innerText.trim().length > 40; }, null, { timeout: 45000 }).catch(() => {});
    await pg.waitForTimeout(900);
    const pub = await pg.evaluate(() => {
      const vis = (e) => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
      const h1 = document.querySelector('h1'); const t = document.body.innerText || '';
      return { h1: h1 ? h1.innerText : '', prix: /16,99|19,99/.test(t), essai: [...document.querySelectorAll('a[href*="inscription"], button')].filter(vis).some((a) => /essayer|commencer|créer/i.test(a.innerText || '')), debord: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
    });
    await capture(pg, nomCap('D1', 'public'));
    dit(!!pub.h1, `${T('D1')} page publique : un titre dit ce que fait VRM`, pub.h1);
    dit(pub.prix, `${T('D1')} page publique : le prix est dit`);
    dit(pub.essai, `${T('D1')} page publique : un bouton pour commencer`);
    dit(!pub.debord, `${T('D1')} page publique : rien ne déborde`);
    await pg.goto(`http://localhost:${PORT}/?inscription`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('#vrm-cx-titre-formulaire', { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(600);
    const r = await INSPECTE(pg, { tel, jargon: JARGON });
    await capture(pg, nomCap('D1', 'inscription'));
    const nEnvoi = await pg.evaluate(() => [...document.querySelectorAll('form button[type="submit"]')].filter((b) => b.getClientRects().length).length);
    dit(nEnvoi === 1, `${T('D1')} inscription : une seule action pleine (${nEnvoi})`);
    dit(!r.debord, `${T('D1')} inscription : rien ne déborde`);
    dit(!errs.length, `${T('D1')} aucune erreur JS`, errs.join(' ¦ '));
    await ctx.close();
  }
  // D2 — la toute première connexion : rien d'imposé au-delà de la Bienvenue ; Aujourd'hui.
  if (ETAPES.includes('D2')) {
    const o = await ouvrir(nav, { W, sombre, base: BASES.vide(), tab: 'journee' });
    await ecranPret(o.pg, '', { max: 20000 });
    await o.pg.waitForSelector('[data-premiere-semaine]', { timeout: 8000 }).catch(() => {});
    const r = await INSP(o);
    await capture(o.pg, nomCap('D2', 'aujourdhui'));
    juger(T('D2'), 'Aujourd’hui (compte neuf)', r, { vide: false });
    dit(!r.feuille, `${T('D2')} aucune fenêtre imposée au démarrage (§3)`);
    const sem = await o.pg.evaluate(() => {
      const c = document.querySelector('[data-premiere-semaine]'); if (!c) return null;
      const et = [...c.querySelectorAll('[data-semaine-etape]')];
      return { n: et.length, faites: et.filter((e) => e.getAttribute('data-etat') === 'fait').length, gestes: c.querySelectorAll('[data-n-variante="plein"]').length, cartesGuides: document.querySelectorAll('[data-guide-demarrage], [data-bien-demarrer], [data-reprendre-configuration]').length };
    });
    dit(!!sem, `${T('D2')} « Ta première semaine » est sur Aujourd’hui`);
    if (sem) {
      dit(sem.n === 3, `${T('D2')} « Ta première semaine » : 3 étapes (${sem.n})`);
      dit(sem.gestes === 1, `${T('D2')} « Ta première semaine » : un seul geste plein, sur l'étape à faire (${sem.gestes})`);
      dit(sem.cartesGuides === 0, `${T('D2')} une seule carte de démarrage (pas trois guides qui se disputent) (${sem.cartesGuides})`);
    }
    dit(!o.journal.erreurs.length, `${T('D2')} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
  // D3 — chaque écran VIDE.
  if (ETAPES.includes('D3')) {
    const o = await ouvrir(nav, { W, sombre, base: BASES.vide(), tab: 'journee' });
    for (const [tab, nom] of [['annonces', 'Annonces'], ['ventes', 'Ventes'], ['achats', 'Achats'], ['messages', 'Messages'], ['garage', 'Stock'], ['dashboard', 'Statistiques'], ['compta', 'Argent']]) {
      await aller(o, tab);
      const r = await INSP(o);
      await capture(o.pg, nomCap('D3', tab));
      juger(T('D3'), nom + ' (vide)', r, { vide: true });
    }
    dit(!o.journal.erreurs.length, `${T('D3')} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
  // D4 — l'extension. L'écran des connexions est le chantier `claude/connexions-extension` : ici les règles communes
  // (débordement, cibles, jargon) sont jugées ; ce qui manque à l'installation est NOTÉ (« NOTE »), pas jugé.
  if (ETAPES.includes('D4')) {
    const o = await ouvrir(nav, { W, sombre, base: BASES.vide(), tab: 'extension' });
    await ecranPret(o.pg, '', { max: 20000 });
    await o.pg.waitForFunction(() => !/regarde si l.extension|on regarde/i.test((document.querySelector('.vrm-main') || document.body).innerText), null, { timeout: 10000 }).catch(() => {});
    const r = await INSP(o);
    await capture(o.pg, nomCap('D4', 'extension'));
    juger(T('D4'), 'Extension', r, {});
    const ext = await o.pg.evaluate(() => {
      const t = (document.querySelector('.vrm-main') || document.body).innerText;
      return { attente: /regarde si l.extension|on regarde/i.test(t), installer: !!document.querySelector('.vrm-main a[href*="VRM-extension"], .vrm-main a[href*="Orion"], .vrm-main a[href*="chromewebstore"], .vrm-main a[href*="microsoftedge"], .vrm-main a[download]') };
    });
    if (ext.attente) console.log(`NOTE ${T('D4')} l'écran Extension dit encore « on regarde… » après 10 s, extension absente`);
    if (!ext.installer) console.log(`NOTE ${T('D4')} l'écran Extension ne montre aucun lien de téléchargement à une débutante sans extension`);
    await o.ctx.close();
  }
  // D5 — Vinted relié, les premières annonces : le prix d'achat et le N°.
  if (ETAPES.includes('D5')) {
    const o = await ouvrir(nav, { W, sombre, base: BASES.relie(), tab: 'journee' });
    await ecranPret(o.pg, '', { max: 20000 });
    let r = await INSP(o);
    await capture(o.pg, nomCap('D5', 'aujourdhui'));
    juger(T('D5'), 'Aujourd’hui (annonces arrivées)', r, {});
    await aller(o, 'annonces');
    r = await INSP(o);
    await capture(o.pg, nomCap('D5', 'annonces'));
    juger(T('D5'), 'Annonces (3 premières)', r, {});
    const num = await o.pg.evaluate(() => !!document.querySelector('[data-mot-explique="numero"]'));
    dit(num, `${T('D5')} Annonces : « N° » expliqué (ce que c'est, pourquoi l'écrire sur la boîte)`);
    await o.ctx.close();
  }
  // D6 — la première vente, son bordereau, « À envoyer ».
  if (ETAPES.includes('D6')) {
    const o = await ouvrir(nav, { W, sombre, base: BASES.vente(), tab: 'ventes' });
    await ecranPret(o.pg, '', { max: 20000 });
    const r = await INSP(o);
    await capture(o.pg, nomCap('D6', 'ventes'));
    juger(T('D6'), 'Ventes (première vente)', r, { pleinsMax: 2 });
    await o.ctx.close();
  }
  // D7 — le premier mois dans Argent.
  if (ETAPES.includes('D7')) {
    const o = await ouvrir(nav, { W, sombre, base: BASES.vente(), tab: 'compta' });
    await ecranPret(o.pg, '', { max: 20000 });
    const r = await INSP(o);
    await capture(o.pg, nomCap('D7', 'argent'));
    juger(T('D7'), 'Argent (premier mois)', r, {});
    dit(!/encaiss/i.test(r.texte), `${T('D7')} Argent : jamais « encaissé »`);
    await o.ctx.close();
  }
  // D8 — Paramètres, l'aide (le « ? » d'Aujourd'hui), l'abonnement.
  if (ETAPES.includes('D8')) {
    const o = await ouvrir(nav, { W, sombre, base: BASES.vide(), tab: 'settings' });
    await ecranPret(o.pg, '', { max: 20000 });
    let r = await INSP(o);
    await capture(o.pg, nomCap('D8', 'parametres'));
    juger(T('D8'), 'Paramètres', r, { pleinsMax: 1 });
    await aller(o, 'journee');
    const aide = o.pg.locator('[data-aide-ouvrir="journee"]').first();
    if (await aide.count()) {
      await aide.click().catch(() => {});
      await o.pg.waitForSelector('[data-aide-feuille]', { timeout: 6000 }).catch(() => {});
      await o.pg.waitForTimeout(500);
      r = await INSP(o);
      await capture(o.pg, nomCap('D8', 'aide'));
      dit(await o.pg.locator('[data-aide-feuille]').count() > 0, `${T('D8')} le « ? » d'Aujourd’hui ouvre l'aide`);
      juger(T('D8'), 'Aide', r, { pleinsMax: 1 });
    } else dit(false, `${T('D8')} Aujourd’hui porte un « ? »`);
    await o.pg.goto(`http://localhost:${PORT}/?tab=settings&section=abonnement`, { waitUntil: 'domcontentloaded' });
    await ecranPret(o.pg, '', { max: 20000 });
    r = await INSP(o);
    await capture(o.pg, nomCap('D8', 'abonnement'));
    juger(T('D8'), 'Abonnement', r, { pleinsMax: 1 });
    dit(/16,99/.test(r.texte) || /19,99/.test(r.texte) || !/€/.test(r.texte), `${T('D8')} Abonnement : le prix dit est celui des offres (16,99 € / 19,99 €)`, (r.texte.match(/\d+,\d\d\s*€/g) || []).slice(0, 4).join(' '));
    dit(!o.journal.erreurs.length, `${T('D8')} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
}

module.exports = { ouvrir, INSPECTE, BASES, JARGON };
if (require.main === module) (async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await lancer(PW, { executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) await parcours(nav, W, theme);
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e && e.stack).slice(0, 400)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ débutant : ${ko} défaut(s)` : '\n✅ débutant : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
