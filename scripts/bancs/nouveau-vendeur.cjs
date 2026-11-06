require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « NOUVEAU VENDEUR » — de l'inscription à un compte qui vit (2 nov.).
//  Julien : « tu te mets à la place d'une personne qui crée son compte, tu
//  simules des données pour voir si tout fonctionne parfaitement, il ne doit y
//  avoir aucune erreur possible ».
//  Aucune donnée réelle, aucune écriture en base : la base est SERVIE ici (forme
//  réelle : `app_data` clé-valeur, `select=` projeté, `meta->>`, `id=eq.` /
//  `id=like.`), la ligne `main` que l'app écrit est gardée en mémoire du banc.
//  Trois temps, à 390 px tactile (iPhone) ET 1512 px, clair ET sombre :
//   1. l'écran d'inscription ;
//   2. la première connexion d'un compte VIDE (Bienvenue, visite en bulles) puis
//      chaque écran vide ;
//   3. le même vendeur avec un petit jeu INVENTÉ : 2 comptes Vinted, 12 annonces,
//      des ventes (dont une à expédier, bordereau prêt), un achat au relais avec
//      son code, deux achats en route, un compte Leboncoin.
//  Sur chaque écran : aucun « NaN », « undefined », « Invalid Date », « null »,
//  « [object Object] » à l'écran ; aucune erreur JS ni console ; aucune requête
//  4xx/5xx non voulue ; rien ne déborde à l'horizontale ; au doigt, les boutons
//  font 44 px ; aucune phrase coupée par une ellipse sur un titre d'écran.
//  `SHOTS=dossier` y range une capture par écran (à REGARDER, §6.2).
//  `SCENARIOS=vide,jeu` / `LARGEURS=390,1512` / `THEMES=clair,sombre` restreignent.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { chromium } = PW;
// (6 nov., filet 6) `NAVIGATEUR=webkit` : le moteur de Safari (_navigateur.cjs).
const { lancer } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4983;
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const SCENARIOS = liste('SCENARIOS', 'vide,jeu');
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000aa';
const SESSION = { access_token: 'jeton-nouveau-vendeur', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: UID, email: 'nouvelle.vendeuse@exemple.test' } };

let ko = 0;
const defauts = [];
const dit = (bon, quoi, det) => { if (!bon) { ko++; defauts.push(quoi + (det ? ' — ' + det : '')); } console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };

// ── LE JEU INVENTÉ ──────────────────────────────────────────────────────────
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString(), ts = (j) => Math.floor((now - j * 86400000) / 1000);
const dansJ = (j) => new Date(now + j * 86400000).toISOString().slice(0, 10);
const MARQUES = ['Nike', 'Adidas', 'New Balance', 'Asics', 'Salomon'];
const MODELES = ['Air Max 90 blanche', 'Samba OG noire', '550 crème', 'Gel-1130 argent', 'XT-6 grise', 'Dunk Low panda'];
const annonce = (i) => ({ id: 51000 + i, title: `${MARQUES[i % 5]} ${MODELES[i % 6]} taille ${38 + (i % 7)}`, price: { amount: String(45 + i * 5) + '.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: MARQUES[i % 5], size_title: String(38 + (i % 7)), status: i % 3 ? 'Très bon état' : 'Bon état', view_count: 12 + i * 7, favourite_count: i % 4, created_at_ts: ts(1 + i * 3) });
const A1 = Array.from({ length: 8 }, (_, i) => annonce(i)), A2 = Array.from({ length: 4 }, (_, i) => annonce(10 + i));
const vente = (i, statut, tus, jours) => ({ transaction_id: 62000 + i, title: `${MARQUES[(i + 1) % 5]} ${MODELES[(i + 2) % 6]} taille ${40 + (i % 4)}`, price: { amount: String(60 + i * 4), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: iso(jours), photo: null });
const V1 = [vente(0, 'Bordereau envoyé au vendeur', 'needs_action', 0.3), vente(1, "Colis en cours d'acheminement", 'waiting', 2), vente(2, 'Commande finalisée', 'completed', 6)];
const V2 = [vente(5, 'Commande finalisée', 'completed', 9)];
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const achat = (i, statut, tus, jours) => ({ transaction_id: 73000 + i, conversation_id: 84000 + i, title: `${MARQUES[(i + 3) % 5]} ${MODELES[(i + 4) % 6]} taille ${41 + (i % 3)}`, price: { amount: String(35 + i * 6), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: iso(jours), photo: null });
const B1 = [achat(0, RELAIS_ST, 'needs_action', 4), achat(1, "Le vendeur a expédié la commande", 'waiting', 2), achat(2, "Le vendeur a expédié la commande", 'waiting', 1)];
const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: iso(h / 24), description: desc, opposite_user: { id: 5000 + id, login } });
const JEU_LIGNES = [
  { id: 'main', data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, vinted_annonce_numeros: Object.fromEntries([...A1, ...A2].slice(0, 9).map((a, i) => [a.id, { numero: String(i + 1) }])) } },
  { id: 'harvest_111_listings', data: { capturedAt: iso(0.01), payload: { items: A1 } } },
  { id: 'harvest_222_listings', data: { capturedAt: iso(0.02), payload: { items: A2 } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0.01), payload: { my_orders: V1 } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: iso(0.02), payload: { my_orders: V2 } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(0.01), payload: { my_orders: B1 } } },
  { id: 'harvest_111_inbox', data: { capturedAt: iso(0.01), payload: { conversations: [conv(301, 'acheteuse_lyon', 'Vous feriez 50 € ?', true, 3), conv(302, 'marc.b', 'Merci, bien reçu !', false, 30)] } } },
  { id: 'harvest_222_inbox', data: { capturedAt: iso(0.02), payload: { conversations: [conv(401, 'sneaker_fan', 'Toujours disponible en 42 ?', true, 6)] } } },
  { id: 'email_bord_62000', data: { transaction: '62000', filename: 'bordereau-62000.pdf', pdfB64: 'JVBERi0x', modele: V1[0].title, account: 'vendeuse_a', receivedAt: iso(0.2), dateLimite: new Date(now + 3 * 86400000).toLocaleDateString('fr-FR') + ' 10 h 00', type: 'vinted' } },
  { id: 'panel_colis_relais', data: { '73000': { code: 'K48291', lieu: 'Le Fournil, 8 Rue de la Paix, 35000 Rennes, France', at: iso(0.5), url: 'https://www.vinted.fr/inbox/84000' } } },
  { id: 'email_track_mondialrelay_40817263', data: { carrier: 'mondialrelay', status: 'disponible', suivi: '40817263', code: '582913', lieu: 'Le Fournil\n8 Rue de la Paix\n35000 Rennes', subject: 'Votre colis est disponible', receivedAt: iso(1), arriveLe: iso(1), dateLimite: new Date(now + 5 * 86400000).toISOString() } },
  { id: 'harvest_111_billing', data: { capturedAt: iso(0.01), payload: { user_balance: { available_amount: { amount: '64.0' }, escrow_amount: { amount: '120.0' } } } } },
  { id: 'lbc_accounts', data: { accounts: { lbcA: { id: 'lbcA', name: 'Ma boutique', sessionAt: iso(1) } } } },
  { id: 'lbc_listings', data: { items: { '3100000001': { id: '3100000001', ref: '2', customRef: 'VRM-2', subject: 'Adidas Samba OG noire T39', status: 'active', account: 'lbcA', seenAt: iso(0.5), price: 55 } } } },
  { id: 'lbc_ventes', data: { ventes: {} } },
];
const JEU_COMPTES = [
  { id: 1, vinted_user_id: '111', login: 'vendeuse_a', domain: 'www.vinted.fr', owner: UID, updated_at: iso(0), created_at: iso(30) },
  { id: 2, vinted_user_id: '222', login: 'vendeuse_b', domain: 'www.vinted.fr', owner: UID, updated_at: iso(0), created_at: iso(20) },
];

// ── LE SERVEUR (dist/) ──────────────────────────────────────────────────────
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
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

// Une page du vendeur : `base.lignes` (sa base), `base.comptes` (ses comptes Vinted).
async function ouvrir(nav, { W, sombre, base, tab = 'journee', bienvenue = true }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const journal = { erreurs: [], console: [], http: [] };
  pg.on('pageerror', (e) => journal.erreurs.push(String(e.message || e).slice(0, 240)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource: net::ERR_FAILED$/.test(m.text())) journal.console.push(m.text().slice(0, 240)); });
  pg.on('response', (r) => { const u = r.url(); if (r.status() >= 400 && /^http:\/\/localhost/.test(u) && !/favicon/.test(u)) journal.http.push(r.status() + ' ' + u.replace(/^http:\/\/localhost:\d+/, '').slice(0, 160)); });
  await pg.addInitScript(([s, bv, sombre]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        if (localStorage.getItem('vrm_visite_vue') === JSON.stringify({ at: 'banc' })) localStorage.removeItem('vrm_visite_vue');
        localStorage.setItem('vrm_session', JSON.stringify(s));
        localStorage.setItem('vrm_local_owner', s.user.id);
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        if (bv) { localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' })); }
        else { localStorage.setItem('vrm_banc_bienvenue', '1'); localStorage.setItem('vrm_banc_visite', '1'); localStorage.removeItem('vrm_bienvenue_vue'); localStorage.removeItem('vrm_visite_vue'); }
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
      // Les écritures de l'app restent dans la base du banc (jamais ailleurs).
      try {
        const b = JSON.parse(req.postData() || 'null');
        const rows = Array.isArray(b) ? b : b && b.id ? [b] : [];
        const eqm = /[?&]id=eq\.([^&]*)/.exec(u);
        if (m === 'PATCH' && eqm && b && b.data) rows.push({ id: eqm[1], data: b.data });
        for (const r of rows) { if (!r || !r.id) continue; const i = base.lignes.findIndex((x) => x.id === r.id); if (i >= 0) base.lignes[i] = { id: r.id, data: r.data }; else base.lignes.push({ id: r.id, data: r.data }); }
        base.ecritures++;
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
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return json(base.lignes.filter((r) => re.test(r.id)).map(forme)); }
    return json([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  return { ctx, pg, journal, tel };
}

// Ce que la personne VOIT : les défauts mesurables d'un écran.
const INSPECTE = (pg, tel) => pg.evaluate((tel) => {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  const texte = document.body.innerText || '';
  const mauvais = [];
  for (const re of [/\bNaN\b/, /\bundefined\b/, /Invalid Date/i, /\[object Object\]/, /(^|[\s:(«])null([\s).,»]|$)/m, /\bInfinity\b/]) { const m = re.exec(texte); if (m) mauvais.push(texte.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')); }
  // §5 : « au moins 0 € » ne se dit jamais (un minimum nul s'écrit « — ») ; et le français.
  const regles = [];
  for (const re of [/\b0 à (?:relire|vérifier) sur Vinted/, /au moins\s+0(?:,00)?\s*€/, /(^|\n)\s*0(?:,00)?\s*€\s*\n\s*au moins/, /Où sont cet\b/, /\.\s+ouvre\b/, /Bienvenue\s*👋/]) { const m = re.exec(texte); if (m) regles.push(texte.slice(Math.max(0, m.index - 30), m.index + 50).replace(/\s+/g, ' ')); }
  // Une ligne qui COMMENCE par « · » (un séparateur passé à la ligne) : le
  // caractère visible qui le PRÉCÈDE est sur une ligne au-dessus. Vaut pour le
  // texte et pour un « · » posé en CSS (::before).
  const pointsSeuls = [];
  const rectCar = (n, i) => { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); return r.getBoundingClientRect(); };
  const precedent = (n, i) => {
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); tw.currentNode = n;
    let t = n.nodeValue.slice(0, i), cur = n, pas = 0;
    for (;;) {
      for (let k = t.length - 1; k >= 0; k--) if (/\S/.test(t[k])) { const rc = rectCar(cur, k); if (rc.width) return rc; }
      cur = tw.previousNode(); if (!cur || ++pas > 60) return null;
      if (!vis(cur.parentElement)) { t = ''; continue; }
      t = cur.nodeValue;
    }
  };
  const ferme = (el) => !!el.closest('details:not([open])') && !el.closest('summary');   // un repli fermé ne se voit pas
  const premierTexte = (el) => { const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let n = tw.nextNode(); n; n = tw.nextNode()) if (/\S/.test(n.nodeValue)) return n; return null; };
  const juger = (rc, prec, quoi) => { if (rc && rc.width && prec && prec.bottom <= rc.top + 2 && pointsSeuls.length < 6) pointsSeuls.push(quoi); };
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n && pointsSeuls.length < 6; n = tw.nextNode()) {
    const t = n.nodeValue; if (t.indexOf('·') < 0 || !vis(n.parentElement) || ferme(n.parentElement)) continue;
    for (let i = t.indexOf('·'); i >= 0; i = t.indexOf('·', i + 1)) juger(rectCar(n, i), precedent(n, i), (t.slice(i, i + 40) + ' ' + ((n.nextSibling && n.nextSibling.textContent) || '').slice(0, 30)).trim() + (window.__bancSonde ? ' <' + (n.parentElement.parentElement || n.parentElement).outerHTML.slice(0, 400) + '>' : ''));
  }
  for (const el of document.querySelectorAll('.vrm-main *')) {
    if (pointsSeuls.length >= 6) break;
    if (!/·/.test(getComputedStyle(el, '::before').content || '') || !vis(el) || ferme(el)) continue;
    const n = premierTexte(el); if (!n) continue;
    const r0 = el.getClientRects()[0];
    juger(r0, precedent(n, 0), '(::before) ' + el.innerText.trim().slice(0, 40));
  }
  const debord = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  // Éléments visibles qui sortent de l'écran à droite (hors rangées défilantes).
  const dehors = [];
  for (const e of document.querySelectorAll('.vrm-main *')) {
    if (dehors.length > 6) break;
    const r = e.getBoundingClientRect();
    if (r.right > innerWidth + 1 && r.left < innerWidth && vis(e)) {
      let p = e.parentElement, defile = false;
      while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(s.overflowX)) { defile = true; break; } p = p.parentElement; }
      if (!defile) dehors.push((e.className && String(e.className).slice(0, 40)) || e.tagName);
    }
  }
  // Au doigt : cibles < 44 px (boutons, liens-boutons, cases).
  const petits = [];
  if (tel) for (const e of document.querySelectorAll('button, [role="button"], a[href], input[type="checkbox"], input[type="radio"], select, summary')) {
    // Hors jeu : un repli fermé (rien n'est dessiné), les contrôles de la carte, et
    // les barres d'un graphique (12 mois sur 390 px ne tiennent pas à 44 px chacun).
    if (!vis(e) || e.closest('.maplibregl-ctrl, [aria-hidden="true"], .vrm-sr, svg') || (e.closest('details:not([open])') && e.tagName !== 'SUMMARY')) continue;
    const r = e.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight * 3) continue;
    if (e.tagName === 'A' && getComputedStyle(e).display === 'inline') continue; // lien dans une phrase
    if (r.height < 43.5 || r.width < 43.5) petits.push(`${(e.innerText || e.getAttribute('aria-label') || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}` + (window.__bancSonde ? ' <' + e.outerHTML.slice(0, 220) + ' | parent ' + (e.parentElement && e.parentElement.className) + '>' : ''));
  }
  // Une carte « écran vide » collée à ce qui suit (aucun espace entre les deux).
  const colles = [];
  for (const c of document.querySelectorAll('.vrm-main .vrm-empty-state')) {
    if (!vis(c)) continue;
    let e = c, suiv = null;
    while (e && e !== document.body && !suiv) { suiv = e.nextElementSibling; while (suiv && !vis(suiv)) suiv = suiv.nextElementSibling; if (!suiv) e = e.parentElement; }
    if (!suiv) continue;
    const ecart = suiv.getBoundingClientRect().top - c.getBoundingClientRect().bottom;
    if (ecart > -1 && ecart < 4) colles.push(`${(c.innerText || '').trim().split('\n')[0].slice(0, 40)} ⇢ ${(suiv.innerText || suiv.className || '').trim().split('\n')[0].slice(0, 30)} (${Math.round(ecart)} px)`);
  }
  // Un texte qui touche le bord haut ou bas de son bandeau (astuce des numéros).
  for (const bd of document.querySelectorAll('[data-astuce-numeros]')) {
    const ph = bd.querySelector('[data-numero-phrase]'); if (!vis(bd) || !ph) continue;
    const a = bd.getBoundingClientRect(), t = ph.getBoundingClientRect();
    if (t.top - a.top < 4 || a.bottom - t.bottom < 4) colles.push(`astuce des numéros : le texte touche le bord (${Math.round(t.top - a.top)} px / ${Math.round(a.bottom - t.bottom)} px)`);
  }
  // La barre d'Annonces : « Republier… » aligné sur la recherche au-dessus.
  { const rech = document.querySelector('.vrm-ann-toolbar .vrm-ann-search'), rep = document.querySelector('.vrm-ann-toolbar [data-actions-ouvrir]');
    if (vis(rech) && vis(rep) && rep.getBoundingClientRect().top >= rech.getBoundingClientRect().bottom && Math.abs(rep.getBoundingClientRect().left - rech.getBoundingClientRect().left) > 1.5) colles.push(`« Republier… » décalé de ${Math.round(rep.getBoundingClientRect().left - rech.getBoundingClientRect().left)} px par rapport à la recherche`); }
  { const g = document.querySelector('.vrm-ann-toolbar > .vrm-ann-actions');
    if (vis(g)) { const cs = getComputedStyle(g); if (parseFloat(cs.paddingLeft) > 0 || parseFloat(cs.borderLeftWidth) > 0 || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) colles.push(`le groupe « Republier… » porte un fond ou un retrait de carte (${cs.paddingLeft}, ${cs.borderLeftWidth}, ${cs.backgroundColor})`); } }
  // Un bouton au libellé court (≤ 3 mots) dont le texte passe sur deux lignes.
  for (const bt of document.querySelectorAll('.vrm-main button')) {
    if (!vis(bt) || ferme(bt) || bt.closest('svg')) continue;
    const t = (bt.innerText || '').trim(); if (!t || /\n/.test(t) || t.split(/\s+/).length > 3) continue;
    // Les rectangles du TEXTE seul (pas l'icône), regroupés en lignes qui ne se chevauchent pas.
    const rects = [];
    const twb = document.createTreeWalker(bt, NodeFilter.SHOW_TEXT);
    for (let n = twb.nextNode(); n; n = twb.nextNode()) { if (!/\S/.test(n.nodeValue) || !vis(n.parentElement)) continue; const r = document.createRange(); r.selectNodeContents(n); for (const x of r.getClientRects()) if (x.width > 1 && x.height > 4) rects.push(x); }
    rects.sort((x, y) => x.top - y.top);
    let lignes = 0, bas = -Infinity;
    for (const x of rects) { if (x.top >= bas - 2) { lignes++; bas = x.bottom; } else bas = Math.max(bas, x.bottom); }
    if (lignes > 1 && colles.length < 8) colles.push(`bouton « ${t} » sur ${lignes} lignes`);
  }
  // Titres coupés par une ellipse.
  const coupes = [];
  for (const e of document.querySelectorAll('.vrm-main h1, .vrm-main h2, .vrm-main h3, [data-phrase-ecran]')) {
    if (vis(e) && e.scrollWidth > e.clientWidth + 1 && /ellipsis/.test(getComputedStyle(e).textOverflow)) coupes.push(e.innerText.trim().slice(0, 50));
  }
  return { mauvais, regles, pointsSeuls, colles, debord, dehors, petits, coupes, titre: (document.querySelector('.vrm-main h1, .vrm-main h2') || {}).innerText || '' };
}, tel);

const ECRANS = [['journee', 'Ma journée'], ['annonces', 'Annonces'], ['ventes', 'Ventes'], ['cat_bord', 'Colis'], ['cat_bord:retirer', 'Colis · À retirer'], ['messages', 'Messages'], ['garage', 'Stock'], ['achats', 'Achats'], ['dashboard', 'Statistiques'], ['compta', 'Comptabilité'], ['settings', 'Paramètres']];

async function capture(pg, nom) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: true });
}

async function tournee(nav, { W, sombre, scenario, base }) {
  const T = `[${scenario} ${W}px ${sombre ? 'sombre' : 'clair'}]`;
  const o = await ouvrir(nav, { W, sombre, base, tab: 'journee' });
  for (const [ecran, nom] of ECRANS) {
    const [tab, sous] = ecran.split(':');
    await o.pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
    await o.pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
    await o.pg.waitForTimeout(2800);
    if (sous) {
      const choix = o.pg.locator(`[data-colis-onglet-choix="${sous}"]`).first();
      if (await choix.count()) { await choix.click(); await o.pg.waitForTimeout(1500); }
      else if (scenario === 'jeu') dit(false, `${T} ${nom} : l'onglet existe`, sous);
    }
    if (process.env.BANC_SONDE) await o.pg.evaluate(() => { window.__bancSonde = 1; });
    const r = await INSPECTE(o.pg, o.tel);
    await capture(o.pg, `nv-${scenario}-${W}-${sombre ? 'sombre' : 'clair'}-${ecran.replace(':', '-')}`);
    dit(!r.mauvais.length, `${T} ${nom} : aucun NaN / undefined / Invalid Date / null à l'écran`, r.mauvais.join(' ¦ '));
    dit(!r.regles.length, `${T} ${nom} : aucun zéro creux ni « au moins 0 € », et un français juste`, r.regles.join(' ¦ '));
    dit(!r.pointsSeuls.length, `${T} ${nom} : aucune ligne qui commence par « · »`, r.pointsSeuls.join(' ¦ '));
    dit(!r.colles.length, `${T} ${nom} : rien n'est collé ni cassé (carte vide et ce qui suit, texte et son bandeau, bouton sur deux lignes)`, r.colles.join(' ¦ '));
    dit(!r.debord && !r.dehors.length, `${T} ${nom} : rien ne déborde à droite`, JSON.stringify(r.dehors));
    if (scenario === 'vide' && tab === 'compta') {
      // Sans compte Vinted, « ouvre Ventes » ne mène nulle part : la vraie cause et son geste.
      const t = await o.pg.evaluate(() => document.body.innerText);
      dit(!/ouvre Ventes une fois|ouvre-le une fois/.test(t) && /aucun compte Vinted n’est encore relié/.test(t), `${T} ${nom} : sans compte, la cause vraie (aucun compte relié), pas « ouvre Ventes »`, (/Pas encore calculé[^\n]*/.exec(t) || [''])[0]);
    }
    if (o.tel) dit(!r.petits.length, `${T} ${nom} : chaque cible au doigt fait 44 px`, r.petits.slice(0, 8).join(' ¦ '));
    dit(!r.coupes.length, `${T} ${nom} : aucun titre coupé`, r.coupes.join(' ¦ '));
  }
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  dit(!o.journal.console.length, `${T} aucune erreur dans la console`, [...new Set(o.journal.console)].slice(0, 6).join(' ¦ '));
  dit(!o.journal.http.length, `${T} aucune requête refusée (4xx/5xx)`, [...new Set(o.journal.http)].slice(0, 6).join(' ¦ '));
  await o.ctx.close();
}

// Lancé seul : le parcours. Requis par un autre script : ses outils (pour sonder un écran).
module.exports = { ouvrir, INSPECTE, JEU_LIGNES, JEU_COMPTES, srv, PORT };
if (require.main === module) (async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await lancer(PW, { executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const sombre = theme === 'sombre';
      if (SCENARIOS.includes('vide')) {
        // 1. L'inscription.
        const ctx = await nav.newContext({ ...(W < 600 ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR' });
        const pg = await ctx.newPage(); const errs = [];
        pg.on('pageerror', (e) => errs.push(e.message));
        await pg.addInitScript((s) => { try { localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, sombre);
        await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
        await pg.route('**/auth/v1/settings**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"external":{},"mailer_autoconfirm":false}' }));
        await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
        await pg.goto(`http://localhost:${PORT}/?inscription`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('#vrm-cx-titre-formulaire', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(800);
        // La sonde de schéma n'a PAS répondu (réseau coupé) : « pas su » ne vaut
        // pas « non » — rien ne dit que ses données seront partagées.
        const pasSu = await pg.evaluate(() => document.body.innerText);
        dit(!/MÊME boutique|pas encore activée en base/.test(pasSu), `[inscription ${W}px ${theme}] sonde pas su : aucune annonce de données partagées`, (/Attention[^\n]*/.exec(pasSu) || [''])[0]);
        // La sonde répond (base cloisonnée, comme la production) : la promesse est dite.
        await pg.route(/\/rest\/v1\/app_data\?select=owner/, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }));
        await pg.goto(`http://localhost:${PORT}/?inscription`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('#vrm-cx-titre-formulaire', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const su = await pg.evaluate(() => document.body.innerText);
        dit(/visibles que par toi/.test(su) && !/MÊME boutique/.test(su), `[inscription ${W}px ${theme}] base cloisonnée : « tes données ne seront visibles que par toi »`, su.slice(0, 160));
        const r = await INSPECTE(pg, W < 600);
        await capture(pg, `nv-inscription-${W}-${theme}`);
        dit(!r.mauvais.length && !r.debord, `[inscription ${W}px ${theme}] l'écran d'inscription est propre`, JSON.stringify(r));
        dit(!errs.length, `[inscription ${W}px ${theme}] aucune erreur JS`, errs.join(' ¦ '));
        await ctx.close();
        // 2. La première connexion : Bienvenue, puis la visite.
        const base0 = { lignes: [], comptes: [], ecritures: 0 };
        const p = await ouvrir(nav, { W, sombre, base: base0, bienvenue: false });
        await p.pg.waitForTimeout(3000);
        await capture(p.pg, `nv-bienvenue-${W}-${theme}`);
        const b = await p.pg.evaluate(() => !!document.querySelector('.vrm-bienvenue'));
        dit(b, `[premier jour ${W}px ${theme}] la Bienvenue s'ouvre à la première connexion`);
        const rb = await INSPECTE(p.pg, W < 600);
        dit(!rb.mauvais.length && !rb.debord, `[premier jour ${W}px ${theme}] la Bienvenue est propre`, JSON.stringify(rb));
        if (b) {
          await p.pg.click('[data-bienvenue-passer]').catch(() => {});
          const bulle = await p.pg.waitForSelector('.vrm-visite-bulle[data-cote]:not([data-cote="mesure"])', { timeout: 6000 }).then(() => true).catch(() => false);
          dit(bulle, `[premier jour ${W}px ${theme}] la visite prend la suite`);
          for (let k = 0; bulle && k < 8; k++) {
            await capture(p.pg, `nv-visite-${W}-${theme}-${k + 1}`);
            const sv = p.pg.locator('[data-visite-suivant]'); if (!(await sv.count())) break;
            const fin = /Terminer/.test(await sv.innerText()); await sv.click(); await p.pg.waitForTimeout(450); if (fin) break;
          }
        }
        dit(!p.journal.erreurs.length, `[premier jour ${W}px ${theme}] aucune erreur JS`, p.journal.erreurs.join(' ¦ '));
        await p.ctx.close();
        // 3. Chaque écran d'un compte vide (Bienvenue et visite déjà vues).
        await tournee(nav, { W, sombre, scenario: 'vide', base: { lignes: [{ id: 'main', data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) } } }], comptes: [], ecritures: 0 } });
      }
      if (SCENARIOS.includes('jeu')) {
        await tournee(nav, { W, sombre, scenario: 'jeu', base: { lignes: JSON.parse(JSON.stringify(JEU_LIGNES)), comptes: JEU_COMPTES, ecritures: 0 } });
      }
    }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e && e.message).slice(0, 300)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ nouveau vendeur : ${ko} défaut(s)` : '\n✅ nouveau vendeur : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
