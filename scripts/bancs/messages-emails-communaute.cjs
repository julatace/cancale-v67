require('./_porte-banc.cjs');
// ═══════════════════════════════════════════════════════════════════════════
//  Banc de rendu — chantier G (5 nov.) : MESSAGES, E-MAILS, COMMUNAUTÉ
//        node scripts/bancs/messages-emails-communaute.cjs   (après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
//  Revue de cohérence (docs/passation/2026-11-05-revue-coherence.md), points
//  2.23, 2.24, 1.10, 3.8, et l'amélioration « Offres Vestiaire qui expirent ».
//  Données INVENTÉES (dépôt public), servies dans la vraie forme des lectures
//  (projections `select=`, `meta->>`, `like.`). 390 px tactile et 1512 px,
//  clair et sombre. Juge, par styles calculés et attributs (jamais un libellé
//  seul) :
//   G1  les filtres de Messages ont le dessin des AUTRES filtres de l'app
//       (`.vrm-filtres` : pilule pleine sans bordure, même fond, même hauteur,
//       même graisse ; l'actif comme l'actif des autres) ;
//   G2  UN style de lien en pied de liste (même couleur, taille, graisse ;
//       ≥ 44 px au doigt ; jamais l'aplat ni le texte bleu) ;
//   G3  à l'ordinateur, la colonne des conversations fait au moins 360 px et
//       AUCUN pseudo n'y est coupé ;
//   G4  le favori est l'ICÔNE de l'app (svg), plus le glyphe ♡ ;
//   G5  UN écran « E-mails » : Paramètres → E-mails mène à l'onglet
//       « Relier ma boîte » de l'écran E-mails, qui porte les adresses ; aucun
//       sous-écran d'e-mails ne reste dans Paramètres ;
//   G6  une panne d'E-mails et de Communauté se dit par `EtatPanne`
//       (`[data-etat-panne]`, UN bouton Réessayer) ;
//   G7  jamais « Actualiser » à côté de « Réessayer » (une panne n'a qu'un geste) ;
//   G8  une offre Vestiaire reçue, à toi de répondre, qui expire dans moins de
//       6 h : ambre UNE seule fois dans Messages, avec le temps restant ; une
//       offre à 20 h ne l'est pas ; Vinted : AUCUNE expiration, nulle part ;
//   G9  aucun débordement horizontal, aucune erreur JavaScript, cibles ≥ 44 px
//       au doigt pour les gestes jugés ; jamais de texte bleu en `C.accent`
//       (l'aplat) dans la zone.
//  `BANC_EXPLORE=1` : captures seulement (aucun jugement).
//  `BANC_CAPTURE=<dossier>` : où ranger les captures (défaut : <tmp>/banc-chantier-g).
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 9251);
const CAPT = process.env.BANC_CAPTURE || path.join(os.tmpdir(), 'banc-chantier-g');
const EXPLORE = process.env.BANC_EXPLORE === '1';
const SEUL = process.env.BANC_SEUL || '';   // « messages », « emails », « communaute »…
// `BANC_MUTATION=1` : les règles d'AVANT remises dans la page (filtres en contour, colonne de 300 px,
// lien de pied en bleu, temps restant sans ambre) — G1, G2, G3 et G8 doivent rougir.
const MUTATION = process.env.BANC_MUTATION === '1';
const MUTANT_CSS = [
  ':root:root body .vrm-app-shell .vrm-main .vrm-inbox-filters > button:not(#fu):not(#mu) { border: 1px solid #c7c7cc !important; background: transparent !important; min-height: 36px !important; height: 36px !important; }',
  ':root body .vrm-message-workspace:not(#_):not(#mu) { grid-template-columns: 300px minmax(0,1fr) 250px !important; }',
  ':root:root body .vrm-app-shell .vrm-main .vrm-pied-lien[data-pied-lien="suite"]:not(#_):not(#mu) { color: var(--vrm-accent) !important; }',
  'html body .vrm-of .vrm-of-reste.is-bientot:not(#mu) { color: var(--vrm-muted) !important; }',
].join('\n');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (EXPLORE) return; if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 240)); } };

const auj = Date.now();
const iso = (h) => new Date(auj - h * 3600e3).toISOString();
const dans = (h) => new Date(auj + h * 3600e3).toISOString();

// ── VINTED : deux comptes, des pseudos longs, une offre ─────────────────────
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'boutique_test', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 2, vinted_user_id: '222', login: 'second_compte_sneakers', domain: 'www.vinted.fr', updated_at: iso(0) },
];
const PSEUDO_LONG = 'mathilde_sneakers_collection';   // 28 caractères : le plus long qu'on voit chez lui
const conv = (id, login, desc, unread, h, item) => ({ id, unread, updated_at: iso(h), description: desc, opposite_user: { id: 5000 + id, login }, ...(item ? { item_title: item } : {}) });
const TITRE = 'Salomon XT-6 blanc';
const FIL_OFFRE = { id: 501, opposite_user: { id: 5501, login: PSEUDO_LONG }, transaction: { id: 9501, item_id: 801, status: 1, current_user_side: 'seller', item_title: TITRE },
  messages: [
    { id: 1, created_at_ts: iso(3), entity_type: 'message', entity: { id: 1, user_id: 5501, body: 'Bonjour ! Elle taille comment ?' } },
    { id: 3, created_at_ts: iso(2.5), entity_type: 'offer_request_message', entity: { id: 3, user_id: 5501, current: true, status: 10, status_title: '', price: { amount: '100.0' }, transaction_id: 9501, offer_request_id: 71 } },
  ] };
const annonce = (id, prix, fav, vues) => ({ id, url: 'https://www.vinted.fr/items/' + id, title: TITRE, brand: 'Salomon', size: '42', price: { amount: prix, currency_code: 'EUR' },
  photo: { url: 'https://images1.vinted.net/t/' + id + '/f800/a.jpeg' }, is_closed: false, is_draft: false, is_hidden: false, favourite_count: fav, view_count: vues });
const INBOX_111 = [
  conv(501, PSEUDO_LONG, 'Vous feriez 100 € ?', true, 2.4, TITRE),
  conv(502, 'acheteuse_c', 'La boîte est incluse ?', true, 1, TITRE),
  conv(503, 'jean_pierre_du_quatorze', 'Merci, bien reçu !', false, 26, 'Nike Air Max 90 blanche taille 43 très bon état'),
  conv(504, 'x', 'Ok', false, 50, 'Adidas Samba'),
  conv(505, 'collectionneur.vintage.paris', 'Est-ce que vous pouvez envoyer demain matin avant 10 h ?', true, 5, 'New Balance 550'),
  // 45 conversations anciennes : la liste en montre 40, le pied propose la suite.
  ...Array.from({ length: 45 }, (_, i) => conv(700 + i, 'acheteur_ancien_' + i, 'Merci !', false, 100 + i * 5, 'Paire ancienne ' + i)),
];
const INBOX_222 = [conv(601, 'acheteur_du_second_compte', 'Toujours dispo ?', true, 8, 'Asics Gel-Lyte III')];
const LIGNES_VINTED = [
  { id: 'harvest_111_inbox', data: { capturedAt: iso(0), payload: { conversations: INBOX_111 } } },
  { id: 'harvest_222_inbox', data: { capturedAt: iso(0), payload: { conversations: INBOX_222 } } },
  { id: 'harvest_111_conv_501', data: { capturedAt: iso(0), payload: { conversation: FIL_OFFRE } } },
  { id: 'harvest_111_listings', data: { uid: '111', type: 'listings', nItems: 2, capturedAt: iso(0), payload: { items: [annonce(802, '130.0', 3, 40), annonce(801, '120.0', 11, 120)], pagination: { total_entries: 2 } } } },
];
const NUMEROS = { '801': { numero: '80', min: '105' }, '802': { numero: '81', min: '125' } };

// ── LEBONCOIN : deux comptes, deux fils lus ─────────────────────────────────
const LBC = {
  lbc_messages: [{ compteurs: { u1: { unread: 3, at: iso(0.2) }, u2: { unread: 0, at: iso(30) } }, comptes: { u1: { name: 'Compte particulier de Julien', pro: false, at: iso(0) }, u2: { name: 'Boutique pro', pro: true, at: iso(0) } } }],
  lbc_accounts: [{ a: {} }],
  lbc_envoi: [],
};
const LBC_FILS = [
  { id: 'lbc_fil_c1', n: '4', da: iso(1), ap: 'Bonjour, est-ce que la paire est toujours disponible ?', dm: 'false', compte: 'u1' },
  { id: 'lbc_fil_c2', n: '2', da: iso(6), ap: 'Parfait, merci', dm: 'true', compte: 'u1' },
];
// ── VESTIAIRE : trois conversations, trois offres (3 h, 20 h, envoyée) ──────
const VC = {
  vc_messages: [{ compteur: { messages: 2, at: iso(0.3) }, conversations: {
    C1: { productId: '900001', ref: '80', nonLu: true, date: iso(2), apercu: 'Vous faites 110 € ?', apercuDeMoi: false },
    C2: { productId: '900002', ref: '', nonLu: false, date: iso(9), apercu: 'La boîte est incluse ?', apercuDeMoi: false },
    C3: { productId: '900003', ref: '', nonLu: true, date: iso(4), apercu: 'Merci', apercuDeMoi: true } }, lecture: { at: iso(0), total: 3, complet: true, page: '/messages/' } }],
  vc_listings: [{ liens: {}, items: { 900001: { ref: '80', favoris: 11 }, 900002: { ref: '', favoris: 3 }, 900003: { ref: '', favoris: 0 } } }],
  vc_envoi: [],
  vc_offres: [{ capturedAt: iso(0.1), lecture: { at: iso(0.1) }, offres: {
    n1001: { id: '1001', produit: '900001', titre: 'Jordan 1 Mid Chicago', offre: 18000, net: 15300, initial: 22000, min: 15000, expire: dans(3), ouverte: true, aToi: true, dernier: { action: 'offer', par: 'acheteur', at: iso(1), cents: 18000 } },
    n1002: { id: '1002', produit: '900002', titre: 'Nike Dunk Low Panda', offre: 9000, net: 7650, initial: 11000, min: 8000, expire: dans(20), ouverte: true, aToi: true, dernier: { action: 'offer', par: 'acheteur', at: iso(2), cents: 9000 } },
    n1003: { id: '1003', produit: '900003', titre: 'Asics Gel-Kayano 14', offre: 7000, net: 6000, initial: 8000, min: 6000, expire: dans(2), ouverte: true, aToi: false, dernier: { action: 'offer', par: 'vendeur', at: iso(1), cents: 7500 } },
  } }],
  vc_offres_recette: [{}],
};
const VC_FILS = [];

// ── E-MAILS : la boîte (route `mode=journal`) ───────────────────────────────
const idE = (i) => 'email_reception_' + String(i).padStart(4, '0') + 'g'.repeat(60);
const EMAILS = [
  { id: idE(1), at: iso(1), etat: 'integre', type: 'suivi', subject: 'Votre colis 12345678 est disponible', from: 'Mondial Relay <noreply@mondialrelay.fr>', resume: { v: 1, t: 'suivi', tr: 'mondialrelay', s: '12345678', st: 'available', code: '418205', lieu: 'Relais Tabac du Port', lim: '09/11/2026' }, pj: 0 },
  { id: idE(2), at: iso(3), etat: 'integre', type: 'vente', subject: 'Ton article est vendu !', from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'vente', a: 'Adidas Samba', px: '55', n: '17' }, pj: 0 },
];
EMAILS.forEach((e) => { e.adresses = ['vendeuse@exemple.test']; e.compte = { id: '1', nom: 'boutique_test' }; e.compteAmbigu = false; e.sourceDate = null; });
const COMPTEURS = { sur: EMAILS.length, plus: false, integre: 2, aVerifier: 0, erreur: 0, incompris: 0, parRubrique: { ventes: 1, achats: 0, codes: 1, colis: 1, autres: 0 } };

// ── COMMUNAUTÉ ──────────────────────────────────────────────────────────────
const CARTE = { ok: true, carte: { profils: [{ pid: 'p1', pseudo: 'revendeur_un', ville: 'Rennes', pays: 'FR', lat: 48.11, lon: -1.68 }, { pid: 'p2', pseudo: 'revendeuse_deux', ville: 'Lyon', pays: 'FR', lat: 45.76, lon: 4.83 }], moi: null, groupes: [] }, conversations: [], discordConnexion: false };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT'); process.exit(1); });

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};
// Le pont simulé : extension à jour, connectée au compte 111, qui sait répondre aux offres Vestiaire.
const PONT = ({ version }) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'boutique_test' }, cmds: {} } });
    if (d.__vmr === 'exec') setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data: {} }), 50);
    if (d.__vmr === 'cmd') setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'banc', raison: 'banc' } }), 50);
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};

// Un navigateur fermé en cours de route (machine partagée) est relancé : le banc rapporte, il ne meurt pas.
let NAVIGATEUR = null;
const lancer = () => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
async function navigateur() { if (!NAVIGATEUR || !NAVIGATEUR.isConnected()) NAVIGATEUR = await lancer(); return NAVIGATEUR; }
async function ouvrir(_nav, { largeur, sombre, chemin, panne = {}, avant }) {
  const tel = largeur < 600;
  const nav = await navigateur();
  const ctx = await nav.newContext({ viewport: { width: largeur, height: tel ? 844 : 950 }, isMobile: tel, hasTouch: tel, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(({ n, sombre }) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_bienvenue_vue', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); } catch (_) {} }, { n: NUMEROS, sombre });
  await pg.addInitScript(PONT, { version: '5.322.0' });
  if (MUTATION) await pg.addInitScript((css) => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }); }, MUTANT_CSS);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/supabase\.co\//.test(r.request().url()) ? r.fallback() : ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.fulfill({ status: 404, body: '' })));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, h) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(h || {}) }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    if (panne.vinted && /harvest_\d+_inbox|harvest_%25|harvest_\*/.test(u)) return route.fulfill({ status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
    if (/id=in\.\(lbc_listings/.test(u) && /select=id(&|$)/.test(u)) return j([{ id: 'lbc_accounts' }, { id: 'vc_listings' }]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/id=like\.lbc_fil_/.test(u)) return j(LBC_FILS);
    if (/id=like\.vc_fil_/.test(u)) return j(VC_FILS);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && LBC[eq[1]]) return j(LBC[eq[1]]);
    if (eq && VC[eq[1]]) return j(VC[eq[1]]);
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: r.data.capturedAt });
    if (eq) return j(LIGNES_VINTED.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES_VINTED.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    const u = new URL(r.request().url()); const mode = u.searchParams.get('mode');
    const j = (d, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });
    if (mode === 'confidentialite') return r.fallback();
    // Messages · Vinted en panne : la copie captée ET le relais du serveur ne répondent pas.
    if (panne.vinted) return j({ ok: false }, 503);
    if (u.pathname === '/api/email-rattacher' && mode === 'journal') {
      if (panne.emails) return j({ ok: false }, 503);
      if (u.searchParams.get('lire')) { const e = EMAILS.find((x) => x.id === u.searchParams.get('lire')); return j({ ok: true, id: e && e.id, email: e ? { ...e, pieces: [], texte: 'Bonjour.' } : null }); }
      return j({ ok: true, page: 0, parPage: 20, suite: false, emails: EMAILS, compteurs: COMPTEURS, adresses: [{ adresse: 'vendeuse@exemple.test', nom: 'boutique_test' }] });
    }
    if (u.pathname === '/api/email-rattacher' && mode === 'reception') {
      if (panne.reception) return j({ ok: false }, 503);
      return j({ ok: true, emails: [], adresses: [{ adresse: 'vendeuse@exemple.test', declaree: true, comptes: [{ id: '1', nom: 'boutique_test' }] }], collecteur: { dernierSucces: iso(0.1), dernierPassage: iso(0.1), etat: 'succes' }, dernierEmail: iso(1), limite: 100, plus: false });
    }
    if (u.pathname === '/api/email-rattacher' && mode === 'liste') return j({ ok: true, emails: [] });
    if (u.pathname === '/api/email-rattacher' && mode === 'preuves') return j({ ok: true, cloisonnee: false, adresses: {} });
    if (u.pathname === '/api/compte' && mode === 'communaute') {
      let corps = null; try { corps = r.request().postData() ? JSON.parse(r.request().postData()) : null; } catch (_) {}
      if (panne.communaute) return r.fulfill({ status: 503, contentType: 'text/html', body: '<p>panne</p>' });
      if (corps && corps.action === 'classement') return panne.classement ? r.fulfill({ status: 503, contentType: 'text/html', body: '' }) : j({ ok: true, classement: { lignes: [], n: 0, inscrit: false, visible: false } });
      if (corps && corps.action === 'discord-compte') return j({ ok: true });
      return j(CARTE);
    }
    return j({ ok: true, pret: true });
  });
  if (avant) await avant(pg);
  await pg.goto(`http://localhost:${PORT}/${chemin}`, { waitUntil: 'domcontentloaded' });
  // Machine chargée : on attend l'écran monté (la porte « Vérification de ta boutique » passée), pas un délai fixe.
  await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  return { ctx, pg, erreurs };
}

const capture = async (pg, nom) => { try { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: false }); } catch (_) {} };
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
// Les textes visibles d'une zone écrits dans la couleur de l'APLAT d'accent (`--vrm-accent`).
const texteAccent = (pg, sel) => pg.evaluate((sel) => {
  const z = document.querySelector(sel); if (!z) return ['zone absente : ' + sel];
  const d = document.createElement('i'); d.style.color = 'var(--vrm-accent)'; document.body.appendChild(d); const A = getComputedStyle(d).color; d.remove();
  return [...z.querySelectorAll('*')].filter((x) => x.offsetParent && [...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && getComputedStyle(x).color === A)
    .map((x) => x.textContent.trim().slice(0, 40));
}, sel);

// Le dessin d'un bouton, en styles calculés (jamais son libellé).
const DESSIN = `(b) => { const s = getComputedStyle(b), r = b.getBoundingClientRect(); return { fond: s.backgroundColor, couleur: s.color, bord: s.borderTopWidth + ' ' + s.borderTopStyle, rayon: parseFloat(s.borderTopLeftRadius) >= r.height / 2 - 1 ? 'pilule' : s.borderTopLeftRadius, graisse: s.fontWeight, taille: s.fontSize, h: Math.round(r.height) }; }`;

// La référence : une rangée `.vrm-filtres` posée dans l'écran (le même parent que l'app donne aux autres).
const referenceFiltres = (pg) => pg.evaluate((DESSIN) => {
  const f = eval(DESSIN);
  const main = document.querySelector('.vrm-main') || document.body;
  const d = document.createElement('div'); d.className = 'vrm-filtres'; d.setAttribute('data-banc-reference', '');
  d.innerHTML = '<button type="button" aria-pressed="false">Autre</button><button type="button" aria-pressed="true">Actif</button>';
  main.appendChild(d);
  const out = { off: f(d.children[0]), on: f(d.children[1]) };
  d.remove(); return out;
}, DESSIN);

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  fs.mkdirSync(CAPT, { recursive: true });
  const nav = null; await navigateur();
  try {
    for (const sombre of [false, true]) for (const largeur of [390, 1512]) {
      const tel = largeur < 600, suf = `${largeur}-${sombre ? 'sombre' : 'clair'}`;

      // ── MESSAGES · VINTED ───────────────────────────────────────────────
      if (!SEUL || SEUL === 'messages') await essaie('messages vinted ' + suf, async () => {
        console.log(`── Messages · Vinted ${suf}`);
        const { ctx, pg, erreurs } = await ouvrir(nav, { largeur, sombre, chemin: '?tab=messages&site=vinted' });
        await pg.waitForSelector('[data-conv="501"]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        await capture(pg, `messages-vinted-${suf}`);
        // G1 — les filtres au dessin des autres filtres.
        const ref = await referenceFiltres(pg);
        const filtres = await pg.evaluate((DESSIN) => { const f = eval(DESSIN); return [...document.querySelectorAll('[data-messagerie] .vrm-inbox-filters > button')].map((b) => ({ actif: b.getAttribute('aria-pressed') === 'true', ...f(b) })); }, DESSIN);
        const memes = (a, b) => a && b && a.fond === b.fond && a.couleur === b.couleur && a.bord === b.bord && a.rayon === b.rayon && a.graisse === b.graisse && a.taille === b.taille && a.h === b.h;
        dit(filtres.length >= 3 && filtres.every((x) => memes(x, x.actif ? ref.on : ref.off)), `${suf} : G1 les filtres de Messages ont le dessin des autres filtres (pilule pleine, même fond, même hauteur)`,
          JSON.stringify({ ref, f: filtres.slice(0, 2) }));
        // G3 — à l'ordinateur, une colonne assez large et aucun pseudo coupé.
        if (!tel) {
          const col = await pg.evaluate(() => { const c = document.querySelector('[data-messagerie]')?.closest('.vrm-inbox-column') || document.querySelector('.vrm-message-workspace > .vrm-inbox-column'); return c ? Math.round(c.getBoundingClientRect().width) : 0; });
          const coupes = await pg.evaluate(() => [...document.querySelectorAll('[data-messagerie] .vrm-msg-name')].filter((n) => n.offsetParent && n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent));
          dit(col >= 360 && coupes.length === 0, `${suf} : G3 la colonne des conversations fait ≥ 360 px et aucun pseudo n'est coupé`, `${col} px · coupés : ${coupes.join(', ') || 'aucun'}`);
        }
        // G4 — le favori : l'icône, plus le glyphe.
        const fav = await pg.evaluate(() => { const b = [...document.querySelectorAll('.vrm-messages-sections > button')][1]; return b ? { svg: !!b.querySelector('svg'), glyphe: /♡|♥/.test(b.textContent) } : null; });
        dit(fav && fav.svg && !fav.glyphe, `${suf} : G4 « Favoris reçus » porte l'icône de l'app, pas le glyphe ♡`, JSON.stringify(fav));
        // G8 (Vinted) — aucune expiration d'offre, nulle part.
        const vintedExpire = await pg.evaluate(() => { const t = (document.querySelector('[data-messagerie]') || {}).innerText || ''; return { attr: document.querySelectorAll('[data-messagerie] [data-offre-expire], [data-messagerie] [data-expire-bientot]').length, mot: /expire|reste \d/i.test(t) }; });
        dit(vintedExpire.attr === 0 && !vintedExpire.mot, `${suf} : G8 Vinted — aucune offre ne « expire » (Julien : les offres Vinted n'expirent pas)`, JSON.stringify(vintedExpire));
        // G2 — un seul style de lien en pied (le repli « Réponses rapides » ouvert : son « Modifier » en fait partie).
        await pg.evaluate(() => document.querySelectorAll('details.vrm-quick-settings').forEach((d) => { d.open = true; })); await pg.waitForTimeout(200);
        const pieds = await pg.evaluate(() => [...document.querySelectorAll('[data-pied-lien]')].filter((x) => x.offsetParent && x.checkVisibility()).map((x) => { const s = getComputedStyle(x), r = x.getBoundingClientRect(); return { k: x.getAttribute('data-pied-lien'), c: s.color, t: s.fontSize, g: s.fontWeight, fond: s.backgroundColor, h: Math.round(r.height) }; }));
        const sig = (x) => x.c + '|' + x.t + '|' + x.g + '|' + x.fond;
        dit(pieds.length >= 2 && new Set(pieds.map(sig)).size === 1 && pieds.every((x) => !tel || x.h >= 44), `${suf} : G2 un seul style de lien en pied de Messages (≥ 2 liens, une signature, ≥ 44 px au doigt)`, JSON.stringify(pieds));
        // G9 — aucun texte écrit dans l'aplat d'accent (le bleu reste rare : un point, un bouton plein).
        const bleus = await texteAccent(pg, '[data-messagerie]');
        dit(bleus.length === 0, `${suf} : G9 aucun texte de Messages · Vinted dans l'aplat bleu (C.accent)`, bleus.join(' | '));
        // Le fil ouvert (capture).
        await pg.locator('[data-conv="501"]').first().click().catch(() => {});
        await pg.waitForTimeout(900);
        await capture(pg, `messages-vinted-fil-${suf}`);
        dit(!(await deborde(pg)), `${suf} : G9 Messages · Vinted sans débordement horizontal`);
        dit(erreurs.length === 0, `${suf} : G9 Messages · Vinted sans erreur JavaScript`, erreurs.join(' | ').slice(0, 200));
        await ctx.close();
      });

      // ── MESSAGES · VINTED EN PANNE ───────────────────────────────────────
      if (!SEUL || SEUL === 'messages') await essaie('messages panne ' + suf, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { largeur, sombre, chemin: '?tab=messages&site=vinted', panne: { vinted: true } });
        await pg.waitForTimeout(1500);
        await capture(pg, `messages-vinted-panne-${suf}`);
        const g = await pg.evaluate(() => { const z = document.querySelector('[data-tache="messages"]') || document.body; const vis = [...z.querySelectorAll('button')].filter((b) => b.offsetParent && b.checkVisibility()); const nom = (b) => (b.getAttribute('aria-label') || '') + ' ' + b.textContent; return { reessayer: vis.filter((b) => /Réessayer/.test(nom(b))).length, actualiser: vis.filter((b) => /Actualiser/i.test(nom(b))).length, noms: vis.filter((b) => /Actualiser/i.test(nom(b))).map((b) => nom(b).trim().slice(0, 60)) }; });
        dit(g.reessayer >= 1 && g.actualiser === 0, `${suf} : G7 Messages en panne — « Réessayer », jamais « Actualiser » à côté`, JSON.stringify(g));
        dit(erreurs.length === 0, `${suf} : Messages en panne sans erreur JavaScript`, erreurs.join(' | ').slice(0, 200));
        await ctx.close();
      });

      // ── MESSAGES · LEBONCOIN ─────────────────────────────────────────────
      if (!SEUL || SEUL === 'messages') await essaie('messages leboncoin ' + suf, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { largeur, sombre, chemin: '?tab=messages&site=leboncoin' });
        await pg.waitForSelector('[data-messagerie-site="leboncoin"]', { timeout: 12000 }).catch(() => {});
        await pg.waitForTimeout(500);
        await capture(pg, `messages-leboncoin-${suf}`);
        const fav = await pg.evaluate(() => { const b = document.querySelector('[data-lbc-zone-favoris]'); return b ? { svg: !!b.querySelector('svg'), glyphe: /♡|♥/.test(b.textContent) } : null; });
        dit(fav && fav.svg && !fav.glyphe, `${suf} : G4 Leboncoin — « Favoris reçus » porte l'icône, pas le glyphe ♡`, JSON.stringify(fav));
        if (!tel) {
          const coupes = await pg.evaluate(() => [...document.querySelectorAll('[data-messagerie-site="leboncoin"] .vrm-msg-name')].filter((n) => n.offsetParent && n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent));
          dit(coupes.length === 0, `${suf} : G3 Leboncoin — aucun nom de compte coupé dans la colonne`, coupes.join(', '));
        }
        await pg.locator('[data-lbc-zone-favoris]').click().catch(() => {});
        await pg.waitForTimeout(600);
        await capture(pg, `messages-leboncoin-favoris-${suf}`);
        dit(!(await deborde(pg)) && erreurs.length === 0, `${suf} : Leboncoin sans débordement ni erreur`, erreurs.join(' | ').slice(0, 200));
        await ctx.close();
      });

      // ── MESSAGES · VESTIAIRE (les offres qui expirent) ───────────────────
      if (!SEUL || SEUL === 'messages') await essaie('messages vestiaire ' + suf, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { largeur, sombre, chemin: '?tab=messages&site=vestiaire' });
        await pg.waitForSelector('[data-vc-offre]', { timeout: 12000 }).catch(() => {});
        await pg.waitForTimeout(500);
        await capture(pg, `messages-vestiaire-${suf}`);
        const o = await pg.evaluate(() => {
          const ambre = getComputedStyle(document.documentElement).getPropertyValue('--vrm-warn').trim();
          const toRgb = (c) => { const d = document.createElement('i'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; };
          const A = toRgb(ambre || '#B25000');
          // Tout ce qui est écrit en ambre (texte) dans la zone Vestiaire de Messages.
          const zone = document.querySelector('[data-messagerie-site="vestiaire"]');
          const ambres = zone ? [...zone.querySelectorAll('*')].filter((x) => x.offsetParent && x.childNodes.length && [...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && getComputedStyle(x).color === A) : [];
          const de = (id) => ambres.filter((x) => x.closest(`[data-vc-offre="${id}"]`) || x.closest(`[data-vc-conv-offre="${id}"]`) || (x.getAttribute('data-vc-conv-offre') === id)).map((x) => x.textContent.trim());
          const carte = (id) => { const c = document.querySelector(`[data-vc-offre="${id}"]`); return c ? { bientot: c.getAttribute('data-vc-offre-bientot'), reste: (c.querySelector('[data-vc-offre-reste]') || {}).textContent || '' } : null; };
          return { A, n1: de('1001'), n2: de('1002'), c1: carte('1001'), c2: carte('1002') };
        });
        dit(o.c1 && o.c1.bientot === '1' && o.n1.length === 1 && /\d\s?h|\d+\s?min/.test(o.n1[0]), `${suf} : G8 l'offre qui expire dans 3 h est ambre UNE fois, avec le temps restant lu`, JSON.stringify({ c1: o.c1, n1: o.n1 }));
        dit(o.c2 && o.c2.bientot !== '1' && o.n2.length === 0, `${suf} : G8 l'offre qui expire dans 20 h n'est pas ambre`, JSON.stringify({ c2: o.c2, n2: o.n2 }));
        dit(!(await deborde(pg)) && erreurs.length === 0, `${suf} : Vestiaire sans débordement ni erreur`, erreurs.join(' | ').slice(0, 200));
        await ctx.close();
      });

      // ── E-MAILS : la boîte, puis « Relier ma boîte » ─────────────────────
      if (!SEUL || SEUL === 'emails') await essaie('emails ' + suf, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { largeur, sombre, chemin: '?tab=emails' });
        await pg.waitForSelector('[data-boite-email]', { timeout: 12000 }).catch(() => {});
        await capture(pg, `emails-boite-${suf}`);
        await pg.locator('[data-boite-vue="relier"]').click().catch(() => {});
        await pg.waitForTimeout(1500);
        await capture(pg, `emails-relier-${suf}`);
        const rel = await pg.evaluate(() => ({ adresses: !!document.querySelector('[data-boite-emails] [data-reglage-adresses]'), espace: !!document.querySelector('[data-boite-emails] [data-espace-emails]') }));
        dit(rel.adresses, `${suf} : G5 l'onglet « Relier ma boîte » de l'écran E-mails porte les adresses de réception`, JSON.stringify(rel));
        dit(!(await deborde(pg)) && erreurs.length === 0, `${suf} : E-mails sans débordement ni erreur`, erreurs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      if (!SEUL || SEUL === 'emails') await essaie('paramètres → e-mails ' + suf, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { largeur, sombre, chemin: '?tab=settings' });
        await pg.waitForTimeout(800);
        await capture(pg, `parametres-${suf}`);
        const entree = pg.locator('[data-sous-ouvrir="adresses"], [data-reglage-emails]').first();
        const vu = await entree.isVisible().catch(() => false);
        if (vu) { await entree.click(); await pg.waitForTimeout(1500); }
        await capture(pg, `parametres-emails-${suf}`);
        const ou = await pg.evaluate(() => ({ boite: !!document.querySelector('[data-boite-emails]'), vue: (document.querySelector('[data-boite-emails]') || { getAttribute: () => '' }).getAttribute('data-vue'), espaceDansReglages: [...document.querySelectorAll('[data-espace-emails]')].some((x) => !x.closest('[data-boite-emails]')) }));
        dit(vu && ou.boite && ou.vue === 'relier' && !ou.espaceDansReglages, `${suf} : G5 Paramètres → E-mails mène à l'écran E-mails, onglet « Relier ma boîte » (plus de sous-écran)`, JSON.stringify({ vu, ...ou }));
        dit(erreurs.length === 0, `${suf} : Paramètres sans erreur JavaScript`, erreurs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      if (!SEUL || SEUL === 'emails') await essaie('emails panne ' + suf, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { largeur, sombre, chemin: '?tab=emails', panne: { emails: true, reception: true } });
        await pg.waitForSelector('[data-boite-emails] [data-etat-panne], [data-boite-etat="panne"]', { timeout: 12000 }).catch(() => {}); await pg.waitForTimeout(300);
        await capture(pg, `emails-panne-${suf}`);
        const p = await pg.evaluate(() => { const z = document.querySelector('[data-boite-emails]'); if (!z) return null; const vis = [...z.querySelectorAll('button')].filter((b) => b.offsetParent && b.checkVisibility()); const nom = (b) => (b.getAttribute('aria-label') || '') + ' ' + b.textContent; return { panne: z.querySelectorAll('[data-etat-panne]').length, reessayer: vis.filter((b) => /Réessayer/.test(nom(b))).length, actualiser: vis.filter((b) => /Actualiser/i.test(nom(b))).length }; });
        dit(p && p.panne === 1 && p.reessayer === 1, `${suf} : G6 E-mails en panne — EtatPanne, UN « Réessayer »`, JSON.stringify(p));
        dit(p && p.actualiser === 0, `${suf} : G7 E-mails en panne — jamais « Actualiser » à côté de « Réessayer »`, JSON.stringify(p));
        await pg.locator('[data-boite-vue="relier"]').click().catch(() => {});
        await pg.waitForTimeout(1200);
        await capture(pg, `emails-relier-panne-${suf}`);
        const q = await pg.evaluate(() => { const z = document.querySelector('[data-boite-emails]'); if (!z) return null; const vis = [...z.querySelectorAll('button')].filter((b) => b.offsetParent && b.checkVisibility()); const nom = (b) => (b.getAttribute('aria-label') || '') + ' ' + b.textContent; return { panne: z.querySelectorAll('[data-etat-panne]').length, reessayer: vis.filter((b) => /Réessayer/.test(nom(b))).length, actualiser: vis.filter((b) => /Actualiser/i.test(nom(b))).length }; });
        dit(q && q.panne >= 1 && q.actualiser === 0, `${suf} : G6/G7 « Relier ma boîte » en panne — EtatPanne, jamais « Actualiser » à côté de « Réessayer »`, JSON.stringify(q));
        dit(erreurs.length === 0, `${suf} : E-mails en panne sans erreur JavaScript`, erreurs.join(' | ').slice(0, 200));
        await ctx.close();
      });

      // ── COMMUNAUTÉ ───────────────────────────────────────────────────────
      if (!SEUL || SEUL === 'communaute') await essaie('communauté ' + suf, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { largeur, sombre, chemin: '?tab=communaute', panne: { communaute: true } });
        await pg.waitForSelector('[data-communaute-etat]:not([data-communaute-etat="charge"])', { timeout: 12000 }).catch(() => {});
        await pg.waitForTimeout(400);
        await capture(pg, `communaute-panne-${suf}`);
        const p = await pg.evaluate(() => { const z = document.querySelector('[data-communaute-etat]'); if (!z) return null; const vis = [...z.querySelectorAll('button')].filter((b) => b.offsetParent && b.checkVisibility()); return { etat: z.getAttribute('data-communaute-etat'), panne: z.querySelectorAll('[data-etat-panne]').length, reessayer: vis.filter((b) => /Réessayer/.test(b.textContent)).length }; });
        dit(p && p.panne === 1 && p.reessayer === 1, `${suf} : G6 Communauté en panne — EtatPanne, UN « Réessayer »`, JSON.stringify(p));
        dit(erreurs.length === 0, `${suf} : Communauté en panne sans erreur JavaScript`, erreurs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      if (!SEUL || SEUL === 'communaute') await essaie('communauté classement ' + suf, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { largeur, sombre, chemin: '?tab=communaute', panne: { classement: true } });
        await pg.waitForSelector('[data-cm-vue="classement"]', { timeout: 12000 }).catch(() => {});
        await capture(pg, `communaute-carte-${suf}`);
        await pg.locator('[data-cm-vue="classement"]').click().catch(() => {});
        await pg.waitForTimeout(900);
        await capture(pg, `communaute-classement-panne-${suf}`);
        const p = await pg.evaluate(() => { const z = document.querySelector('[data-cm-classement]'); return z ? { panne: z.querySelectorAll('[data-etat-panne]').length + (z.matches('[data-etat-panne]') ? 1 : 0) } : null; });
        dit(p && p.panne === 1, `${suf} : G6 Classement en panne — EtatPanne`, JSON.stringify(p));
        dit(!(await deborde(pg)) && erreurs.length === 0, `${suf} : Communauté sans débordement ni erreur`, erreurs.join(' | ').slice(0, 200));
        await ctx.close();
      });
    }
  } finally { try { if (NAVIGATEUR) await NAVIGATEUR.close(); } catch (_) {} srv.close(); }
  if (EXPLORE) { console.log('Captures : ' + CAPT); return; }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
