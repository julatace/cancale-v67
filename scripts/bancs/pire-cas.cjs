// ════════════════════════════════════════════════════════════════════════════
//  BANC « PIRE CAS » (11 nov.) — essayer de CASSER les écrans avec des données
//  extrêmes. Données INVENTÉES (le dépôt est public), aucune fx/.
//
//  Trois jeux : `vide` (0 ligne), `un` (1 ligne de chaque) et `extreme` :
//   · 2 000 annonces, 2 000 ventes, 2 000 achats, 2 000 conversations ;
//   · titres de 200 caractères, texte allemand ~30 % plus long, emoji ;
//   · pseudo sans espace de 60 caractères (compte et acheteurs) ;
//   · prix 0,01 € et 99 999,99 € ; N° à lettres longs (B12345, 123456) ;
//   · champs manquants (photo, date, prix d'achat, prix) ;
//   · statistiques à des nombres très grands (2 000 × 99 999,99 €).
//  Écrans : Ma journée, Annonces, Ventes (hors bloc colis), Achats (hors bloc
//  colis), Stock, Argent, Statistiques, Messages, E-mails, Paramètres ; feuilles :
//  fiche d'annonce (Annonces → « Détails et gestes »), fiche de vente (Ventes →
//  une ligne), fiche du N° (`vrm:fiche-paire`).
//  Mesures (sur le DOM RENDU, jamais un libellé) :
//   P1 aucun débordement horizontal de la page (scrollWidth ≤ largeur) ;
//   P2 aucun texte visible qui déborde de l'écran à droite (hors rangées défilantes) ;
//   P3 aucun chevauchement de deux textes (rectangles des nœuds texte, visibles) ;
//   P4 aucun texte coupé (ellipse / line-clamp) sans moyen de le lire en entier
//      (`title`, `aria-label` ou un toucher qui ouvre : bouton, lien) ;
//   P5 aucun « NaN », « undefined », « Invalid Date », « null », « Infinity » ;
//   P6 jeu `extreme` : aucun « 0,00 € » à côté d'un prix d'achat ou d'un bénéfice
//      (le prix d'achat manque : « — », jamais 0) ;
//   P7 liste de 2 000 lignes : aucun gel > 200 ms au défilement (longtask) ;
//   P8 aucune erreur de page.
//  BANC_PORT (aléatoire si absent), BANC_DIST, BANC_CAPTURES, BANC_JEU, BANC_LARGEUR,
//  BANC_ECRAN (un seul écran), BANC_SOMBRE=0|1.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { routeMain } = require('./_base-ecritures.cjs');
const { repondre } = require('./_base-volume.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const CAPTURES = process.env.BANC_CAPTURES || path.join(require('os').tmpdir(), 'banc-pire-cas');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}
const PNG = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'icon-512.png'));

// ── Les données extrêmes ─────────────────────────────────────────────────────
const NOW = Date.now();
const ilYa = (h) => new Date(NOW - h * 3600e3).toISOString();
const PSEUDO = 'x_' + 'tresLongPseudoSansAucunEspace'.repeat(3).slice(0, 58);   // 60 caractères, sans espace
const ACHETEUR = (i) => ('acheteur' + i + '_' + 'unPseudoQuiNeSeCoupeJamais'.repeat(3)).slice(0, 60);
const TITRE_200 = ('Nike Air Max 1 ’86 OG Big Bubble « Lost Sketch » Sport Red / White édition limitée 2023 👟🔥 taille 42,5 EU — '
  + 'neuves jamais portées, boîte d’origine, facture, lacets de rechange et sac à poussière inclus ✨').padEnd(200, '.').slice(0, 200);
const ALLEMAND = 'Damen-Freizeitlaufschuhe wasserabweisend atmungsaktiv Größe 42 Sportschuhgrößenumtauschgarantie Originalverpackung';
const EMOJI = '👟🔥✨🧡 Jordan 1 🏀 Chicago 🇫🇷 💯';
const TITRES = [TITRE_200, ALLEMAND, EMOJI, 'A', 'Supercalifragilisticexpialidocious'.repeat(5)];
const PRIX = ['0.01', '99999.99', '49.0', '1234.5'];
const NUMS = ['B12345', '123456', 'B99999', '7', 'B1'];
const photo = (n) => `https://images1.vinted.net/t/01_pc${n}/f800/17${n}.jpeg`;

function jeu(nom) {
  const N = nom === 'vide' ? 0 : nom === 'un' ? 1 : 2000;
  const items = [], ventes = [], achats = [], convs = [], numeros = {}, used = [];
  for (let i = 0; i < N; i++) {
    const id = 70000000 + i;
    const sansPhoto = i % 7 === 3, sansPrix = i % 11 === 5, sansDate = i % 13 === 4;
    items.push({ id, title: TITRES[i % TITRES.length], price: sansPrix ? null : { amount: PRIX[i % PRIX.length], currency_code: 'EUR' },
      is_closed: false, is_draft: false, is_hidden: false, photo: sansPhoto ? null : { url: photo(i) },
      brand_title: i % 2 ? 'Nike' : 'Adidas Originals by Wales Bonner Collaboration Spéciale', size_title: i % 3 ? '42' : '42 ⅔ (UK 8,5 / US 9)', size: '42',
      status: 'Neuf avec étiquette', view_count: i % 5 ? 30 : 9999999, favourite_count: i % 5 ? 13 : 999999,
      created_at_ts: sansDate ? undefined : Math.floor((NOW - (i + 1) * 3600e3) / 1000) });
    const num = i < NUMS.length ? NUMS[i] : (i % 2 ? 'B' : '') + String(10000 + i);
    numeros[String(id)] = { numero: num, auto: i % 3 !== 0, numberedAt: ilYa(i + 1), ...(i % 4 === 0 ? {} : { buyPrice: i % 4 === 1 ? '0.01' : i % 4 === 2 ? '99999.99' : '35' }) };
    if (/^\d+$/.test(num)) used.push(Number(num));
    const tx = 90000000 + i;
    ventes.push({ transaction_id: tx, item_id: id, title: TITRES[(i + 1) % TITRES.length], price: sansPrix ? null : { amount: PRIX[(i + 1) % PRIX.length], currency_code: 'EUR' },
      status: i % 3 ? 'Commande finalisée' : "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed',
      date: sansDate ? undefined : ilYa(24 + i * 3), photo: sansPhoto ? null : { url: photo(i) }, opposite_user: { login: ACHETEUR(i) } });
    achats.push({ transaction_id: 95000000 + i, title: TITRES[(i + 2) % TITRES.length], price: sansPrix ? null : { amount: PRIX[(i + 2) % PRIX.length], currency_code: 'EUR' },
      status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: sansDate ? undefined : ilYa(30 + i * 3),
      photo: sansPhoto ? null : { url: photo(i + 1) }, opposite_user: { login: ACHETEUR(i) } });
    convs.push({ id: 80000000 + i, unread: i < 40, updated_at: sansDate ? undefined : ilYa(i), opposite_user: { id: 9000 + i, login: ACHETEUR(i), photo: null },
      item_count: 1, description: i % 2 ? TITRE_200 : ALLEMAND + ' ' + EMOJI });
  }
  const rows = [
    { id: 'harvest_111_listings', data: { capturedAt: new Date().toISOString(), nItems: items.length, payload: { items, pagination: { total_entries: items.length } } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: new Date().toISOString(), nItems: ventes.length, payload: { my_orders: ventes } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date().toISOString(), nItems: achats.length, payload: { my_orders: achats } } },
    { id: 'harvest_111_inbox', data: { capturedAt: new Date().toISOString(), payload: { conversations: convs, pagination: { current_page: 1 } } } },
    { id: 'harvest_111_profile', data: { capturedAt: new Date().toISOString(), payload: { user: { id: 111, login: PSEUDO, feedback_reputation: 1 } } } },
    { id: 'harvest_111_billing', data: { capturedAt: new Date().toISOString(), payload: { user_balance: { escrow_amount: { amount: N ? '99999.99' : '0.0' }, available_amount: { amount: N ? '0.01' : '0.0' } } } } },
    { id: 'harvest_111_enligne', data: { capturedAt: new Date().toISOString(), complet: true, n: items.length, ids: items.map((x) => x.id), items: items.map((x) => ({ id: x.id, title: x.title })) } },
    { id: 'vinted_item_details', data: {} },
  ];
  const main = { vinted_annonce_numeros: numeros, vinted_used_numeros: used, vinted_prenom: 'Maximilian-Alexander-Friedrich' };
  const emails = Array.from({ length: Math.min(N, 60) }, (_, i) => ({
    id: 'email_reception_' + String(i).padStart(4, '0') + 'p'.repeat(40), at: i % 13 === 4 ? null : ilYa(i), etat: 'integre', type: i % 2 ? 'vente' : 'suivi',
    subject: i % 2 ? TITRE_200 : ALLEMAND, from: `${PSEUDO} <${PSEUDO}@exemple-tres-long-domaine.test>`,
    resume: i % 2 ? { v: 1, t: 'vente', a: TITRES[i % TITRES.length], px: i % 4 === 1 ? '99999,99' : '0,01', n: 'B12345' } : { v: 1, t: 'suivi', tr: 'mondialrelay', s: 'XW' + '9'.repeat(30), st: 'available', code: '418205', lieu: ALLEMAND, lim: '09/11/2026' },
    pj: 0, adresses: [PSEUDO + '@exemple.test'], compte: { id: '1', nom: PSEUDO }, compteAmbigu: false, sourceDate: null,
  }));
  return { rows, main, emails, accounts: [{ id: 1, vinted_user_id: '111', login: PSEUDO, domain: 'www.vinted.fr', updated_at: new Date().toISOString() }] };
}

const ECRANS = [
  ['journee', 'Ma journée'], ['annonces', 'Annonces'], ['ventes', 'Ventes'], ['achats', 'Achats'], ['garage', 'Stock'],
  ['compta', 'Argent'], ['dashboard', 'Statistiques'], ['messages', 'Messages'], ['emails', 'E-mails'], ['settings', 'Paramètres'],
];
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 180)); } };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log(`  ❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); });

async function ouvrir(b, { largeur, sombre, tab, nomJeu }) {
  const J = jeu(nomJeu);
  const base = { main: J.main, maj: new Date(Date.now() - 86400e3).toISOString(), ecritures: [] };
  const mobile = largeur < 700;
  const ctx = await b.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_bienvenue_vue', '1'); localStorage.setItem('vrm_visite_vue', '1'); } catch (_) {}
    // P7 : les tâches longues (gel du fil principal).
    window.__longues = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longues.push({ t: e.startTime, d: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
  }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route(/images1\.vinted\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const j = (d, st = 200, h = {}) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...h }, body: typeof d === 'string' ? d : JSON.stringify(d) });
    const u = decodeURIComponent(req.url());
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'banc' }]);
    const mm = routeMain(req, base); if (mm) return j(mm.body, mm.status);
    if (req.method() !== 'GET') return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(J.accounts);
    const rep = repondre(req.url(), req.headers()['range'], { rows: J.rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), main: [], accounts: J.accounts });
    return j(rep.body, rep.status, rep.headers || {});
  });
  await pg.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    const f = (d) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (u.pathname === '/api/email-rattacher' && u.searchParams.get('mode') === 'journal') {
      if (u.searchParams.get('lire')) { const e = J.emails.find((x) => x.id === u.searchParams.get('lire')); return f({ ok: true, id: u.searchParams.get('lire'), email: e ? { ...e, receivedAt: e.at, pieces: [], texte: TITRE_200 + '\n' + ALLEMAND.repeat(8), texteCoupe: false } : null }); }
      const p = Number(u.searchParams.get('page') || 0);
      return f({ ok: true, page: p, parPage: 20, suite: J.emails.length > (p + 1) * 20, emails: J.emails.slice(p * 20, p * 20 + 20),
        compteurs: { sur: J.emails.length, plus: false, integre: J.emails.length, aVerifier: 0, erreur: 0, incompris: 0, parRubrique: { ventes: J.emails.length >> 1, achats: 0, codes: 0, colis: 0, offres: 0, autres: 0 } },
        adresses: J.emails.length ? [{ adresse: PSEUDO + '@exemple.test', nom: PSEUDO }] : [] });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(nomJeu === 'extreme' ? 7000 : 4500);
  return { pg, ctx, errs };
}
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };

// ── Les mesures, dans la page ────────────────────────────────────────────────
// La racine mesurée : la feuille ouverte si `racine` est donnée, sinon le document.
function mesurer(racineSel) {
  const W = document.documentElement.clientWidth;
  const H = window.innerHeight;
  const racine = (racineSel && document.querySelector(racineSel)) || document.body;
  const out = { W, pageScroll: document.scrollingElement.scrollWidth, deborde: [], chevauche: [], coupe: [], mots: [], zero: [] };
  const vis = (el) => { const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  const cache = (el) => !!el.closest('[hidden],[inert],[aria-hidden="true"]') || el.closest('[data-banc-ignorer]');
  // Rangées qui défilent d'elles-mêmes : un texte qui sort à droite y est voulu.
  const defilant = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll)/.test(s.overflowX) && a.scrollWidth > a.clientWidth + 1) return true; } return false; };
  // Le rectangle visible d'un élément : coupé par ses ancêtres `overflow` non visibles.
  const clip = (el, r) => {
    let x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible' || s.clipPath !== 'none') { const q = a.getBoundingClientRect(); x1 = Math.max(x1, q.left); y1 = Math.max(y1, q.top); x2 = Math.min(x2, q.right); y2 = Math.min(y2, q.bottom); }
      if (s.position === 'fixed') break;
    }
    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  };
  const desc = (el) => { const t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50); const c = (el.className && el.className.baseVal === undefined ? el.className : '') || ''; return `<${el.tagName.toLowerCase()}${c ? ' .' + String(c).split(' ').slice(0, 2).join('.') : ''}> « ${t} »`; };
  // Les nœuds texte visibles : un rectangle par nœud (Range), et leur élément.
  const textes = [];
  const tw = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  let n;
  while ((n = tw.nextNode())) {
    const el = n.parentElement; if (!el || cache(el) || !vis(el) || /^(SCRIPT|STYLE|NOSCRIPT|TITLE|OPTION)$/.test(el.tagName)) continue;
    if (el.closest('svg')) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const rs = [...rg.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
    if (!rs.length) continue;
    for (const r of rs) {
      if (r.bottom < 0 || r.top > H) continue;
      const c = clip(el, r); if (c.w <= 1 || c.h <= 1) continue;
      textes.push({ el, n, c, r });
    }
  }
  // P2 : un texte visible qui sort de l'écran à droite (ou à gauche).
  for (const t of textes) if ((t.c.x2 > W + 1 || t.c.x1 < -1) && !defilant(t.el) && getComputedStyle(t.el).position !== 'fixed') out.deborde.push(desc(t.el) + ` [${Math.round(t.c.x1)}→${Math.round(t.c.x2)}]`);
  // P3 : deux textes qui se recouvrent (au moins 30 % de la plus petite hauteur, 4 px de large).
  const empile = (el) => { for (let a = el; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (s.position === 'fixed' || s.position === 'sticky') return a; } return null; };
  for (let i = 0; i < textes.length && out.chevauche.length < 12; i++) for (let k = i + 1; k < textes.length; k++) {
    const a = textes[i], b = textes[k];
    if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ix = Math.min(a.c.x2, b.c.x2) - Math.max(a.c.x1, b.c.x1), iy = Math.min(a.c.y2, b.c.y2) - Math.max(a.c.y1, b.c.y1);
    if (ix < 4 || iy < 0.3 * Math.min(a.c.h, b.c.h) || iy < 3) continue;
    // Une couche posée (en-tête collant, île, feuille) au-dessus du contenu qui défile : pas un défaut de mise en page.
    if (empile(a.el) !== empile(b.el)) continue;
    // Le texte du dessus cache-t-il vraiment l'autre ? On demande au navigateur ce qu'il y a au point.
    const px = (Math.max(a.c.x1, b.c.x1) + Math.min(a.c.x2, b.c.x2)) / 2, py = (Math.max(a.c.y1, b.c.y1) + Math.min(a.c.y2, b.c.y2)) / 2;
    const pile = document.elementsFromPoint(px, py);
    if (!pile.some((e) => e === a.el || a.el.contains(e)) || !pile.some((e) => e === b.el || b.el.contains(e))) continue;
    out.chevauche.push(`${desc(a.el)} ⟷ ${desc(b.el)}`);
  }
  // P4 : texte coupé (ellipse ou line-clamp) sans moyen de le lire en entier.
  const vu = new Set();
  for (const t of textes) {
    for (let el = t.el, d = 0; el && d < 3; el = el.parentElement, d++) {
      if (vu.has(el)) break;
      const s = getComputedStyle(el);
      const ellipse = s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
      const clamp = s.webkitLineClamp && s.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 2;
      if (!ellipse && !clamp) continue;
      vu.add(el);
      const lisible = el.closest('[title],[aria-label],button,a[href],[role="button"],summary,label');
      const nom = lisible && (lisible.getAttribute('title') || lisible.getAttribute('aria-label') || '');
      const plein = (el.textContent || '').replace(/\s+/g, ' ').trim();
      // Un `title`/`aria-label` qui ne contient pas le texte ne le rend pas lisible ; un bouton (il ouvre la fiche) oui.
      const ok = lisible && (/^(BUTTON|A|SUMMARY|LABEL)$/.test(lisible.tagName) || lisible.getAttribute('role') === 'button' || (nom && nom.replace(/\s+/g, ' ').includes(plein.slice(0, 40))));
      if (!ok) out.coupe.push(desc(el));
      break;
    }
  }
  // P5 : les mots qui trahissent une valeur absente.
  const txt = racine.innerText || '';
  for (const m of txt.matchAll(/\b(NaN|undefined|Invalid Date|Infinity|null)\b|\[object Object\]/g)) out.mots.push(txt.slice(Math.max(0, m.index - 30), m.index + 20).replace(/\s+/g, ' '));
  // P6 : un « 0,00 € » à côté d'un prix d'achat, d'un coût ou d'un bénéfice.
  for (const m of txt.matchAll(/0,00\s?€/g)) { const ctx = txt.slice(Math.max(0, m.index - 60), m.index + 12).replace(/\s+/g, ' '); if (/achat|coût|cout|bénéf|benef|marge/i.test(ctx)) out.zero.push(ctx); }
  out.deborde = [...new Set(out.deborde)].slice(0, 8); out.coupe = [...new Set(out.coupe)].slice(0, 8); out.mots = [...new Set(out.mots)].slice(0, 6); out.zero = [...new Set(out.zero)].slice(0, 4);
  return out;
}

// P7 : défiler la liste (le conteneur qui défile vraiment) et relever les gels.
async function defiler(pg) {
  await pg.evaluate(() => { window.__longues = []; });
  const t0 = await pg.evaluate(() => performance.now());
  const box = await pg.evaluate(() => {
    const cands = [document.scrollingElement, ...document.querySelectorAll('main, [data-ecran], .vrm-main, .vrm-content')].filter(Boolean);
    let best = document.scrollingElement;
    for (const c of cands) if (c.scrollHeight - c.clientHeight > best.scrollHeight - best.clientHeight && /(auto|scroll)/.test(getComputedStyle(c).overflowY)) best = c;
    best.setAttribute && best.setAttribute('data-banc-defile', '');
    return { h: best.scrollHeight, c: best.clientHeight };
  });
  const vp = pg.viewportSize();
  await pg.mouse.move(vp.width / 2, vp.height / 2);
  for (let i = 0; i < 30; i++) { await pg.mouse.wheel(0, 900); await pg.waitForTimeout(60); }
  await pg.waitForTimeout(600);
  const r = await pg.evaluate((t0) => { const l = (window.__longues || []).filter((e) => e.t >= t0); return { max: Math.round(Math.max(0, ...l.map((e) => e.d))), n: l.length }; }, t0);
  return { ...r, hauteur: box.h };
}

async function juger(pg, T, nom, { racine, jeuNom, errs }) {
  const m = await pg.evaluate(mesurer, racine || null);
  if (!racine) dit(m.pageScroll <= m.W + 1, `${T} ${nom} · P1 aucun débordement horizontal de la page`, `${m.pageScroll} > ${m.W}`);
  dit(m.deborde.length === 0, `${T} ${nom} · P2 aucun texte hors de l'écran`, m.deborde.join(' ║ '));
  dit(m.chevauche.length === 0, `${T} ${nom} · P3 aucun chevauchement de textes`, m.chevauche.slice(0, 5).join(' ║ '));
  dit(m.coupe.length === 0, `${T} ${nom} · P4 aucun texte coupé sans moyen de le lire`, m.coupe.join(' ║ '));
  dit(m.mots.length === 0, `${T} ${nom} · P5 ni NaN, ni undefined, ni Invalid Date`, m.mots.join(' ║ '));
  if (jeuNom === 'extreme') dit(m.zero.length === 0, `${T} ${nom} · P6 aucun « 0,00 € » pour un prix d'achat absent`, m.zero.join(' ║ '));
  dit(errs.length === 0, `${T} ${nom} · P8 aucune erreur de page`, errs.slice(0, 2).join(' | '));
}

async function main() {
  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const JEUX = (process.env.BANC_JEU || 'extreme,un,vide').split(',');
  const LARGEURS = [390, 1512].filter((l) => !process.env.BANC_LARGEUR || String(l) === process.env.BANC_LARGEUR);
  const SOMBRES = process.env.BANC_SOMBRE === '1' ? [true] : process.env.BANC_SOMBRE === '0' ? [false] : [false, true];
  try {
    for (const jeuNom of JEUX) for (const largeur of LARGEURS) for (const sombre of SOMBRES) {
      // Le sombre ne change pas la mise en page : il relit le jeu extrême seulement (captures regardées).
      if (sombre && jeuNom !== 'extreme') continue;
      const T = `[${jeuNom}] ${largeur < 700 ? '📱' : '🖥️'}${sombre ? '🌙' : '☀️'}`;
      for (const [tab, nom] of ECRANS) {
        if (process.env.BANC_ECRAN && process.env.BANC_ECRAN !== tab) continue;
        await essaie(`${T} ${nom}`, async () => {
          const { pg, ctx, errs } = await ouvrir(b, { largeur, sombre, tab, nomJeu: jeuNom });
          const fichier = `${jeuNom}-${tab}-${largeur}-${sombre ? 'sombre' : 'clair'}`;
          await capture(pg, fichier);
          await juger(pg, T, nom, { jeuNom, errs });
          if (jeuNom === 'extreme' && !sombre && ['annonces', 'ventes', 'achats', 'garage', 'messages'].includes(tab)) {
            const d = await defiler(pg);
            dit(d.max <= 200, `${T} ${nom} · P7 2 000 lignes : aucun gel > 200 ms au défilement`, `gel le plus long ${d.max} ms (${d.n} tâches longues)`);
            await capture(pg, fichier + '-defile');
            await pg.evaluate(() => { const e = document.querySelector('[data-banc-defile]') || document.scrollingElement; e.scrollTop = 0; window.scrollTo(0, 0); });
            await pg.waitForTimeout(300);
          }
          // Les feuilles.
          if (jeuNom !== 'vide' && tab === 'annonces') {
            const bt = pg.locator('[data-fiche-plus-bouton]').first();
            if (await bt.count()) {
              await bt.click(); await pg.waitForTimeout(900);
              await capture(pg, fichier + '-fiche-annonce');
              await juger(pg, T, 'fiche d’annonce', { jeuNom, errs });
            } else dit(false, `${T} fiche d’annonce · le bouton « Détails et gestes » existe`);
          }
          if (jeuNom !== 'vide' && tab === 'ventes') {
            const bt = pg.locator('.vrm-ledger-sale-toggle').first();
            if (await bt.count()) {
              await bt.click(); await pg.waitForTimeout(900);
              await capture(pg, fichier + '-fiche-vente');
              await juger(pg, T, 'fiche de vente', { jeuNom, errs, racine: '.vrm-ledger-drawer-host:not([hidden])' });
              await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
            } else dit(false, `${T} fiche de vente · une ligne de vente existe`);
            await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: 'B12345' })));
            await pg.waitForTimeout(1500);
            if (await pg.locator('[data-fiche-paire]').count()) {
              await capture(pg, fichier + '-fiche-numero');
              await juger(pg, T, 'fiche du N° B12345', { jeuNom, errs, racine: '[data-fiche-paire]' });
            } else dit(false, `${T} fiche du N° · « vrm:fiche-paire » l’ouvre`);
          }
          await ctx.close();
        });
      }
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌ — captures : ${CAPTURES}`);
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
