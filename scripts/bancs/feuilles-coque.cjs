// ════════════════════════════════════════════════════════════════════════════
//  Banc « FEUILLES PIÉGÉES SOUS LA BARRE DU BAS » (23 octobre).
//  Julien, sur iPhone : la feuille « Reçu d'achat » passe SOUS la barre de
//  navigation du bas, qui en cache la fin.
//
//  Cause mesurée (pas supposée) : sur iPhone, WebKit donne un z-index 0 — donc
//  un contexte d'empilement — à tout élément qui défile ET porte
//  `-webkit-overflow-scrolling: touch` (Source/WebCore/style/StyleAdjuster.cpp,
//  « Touch overflow scrolling creates a stacking context », actif seulement si
//  ENABLE_WEBKIT_OVERFLOW_SCROLLING_CSS_PROPERTY, c.-à-d. PLATFORM(IOS_FAMILY)).
//  `<main className="vrm-main">` le portait depuis la coque app-shell (28 sept.) :
//  TOUTE feuille rendue dans l'écran, quel que soit son z-index, était peinte
//  dans la couche 0 de `<main>`, et la barre du bas (z-index 60, sœur de
//  `<main>`) passait par-dessus. Chromium ne connaît pas cette propriété : sans
//  rien faire, le banc ne verrait jamais le défaut.
//  ⇒ En mode « iPhone », le banc APPLIQUE la règle de WebKit : chaque élément
//  qui porte `-webkit-overflow-scrolling: touch` (style en ligne posé par React
//  — Chromium le garde en propriété du style — ou règle de la feuille de style
//  livrée, lue dans dist/assets/*.css) et qui défile reçoit `isolation:isolate`
//  (un contexte d'empilement peint au niveau 0, ce que fait WebKit). Le mode
//  « navigateur » (1512, ordinateur) ne simule rien.
//
//  Pour chaque feuille ouverte, il mesure :
//   · aux coins et au milieu du bas du panneau, et en haut du voile, que le
//     point appartient à la feuille (elementFromPoint) — ni la barre du bas, ni
//     l'en-tête par-dessus ;
//   · que le bas du contenu est atteignable : défilé jusqu'au bout, le dernier
//     élément cliquable reste touchable ;
//   · au doigt, que ses boutons font 44 px affichés ;
//   · (revue du 23 oct.) en 390 « iPhone », la zone de la barre d'accueil
//     (safe-area, 34 px, posée par CDP) : le dernier élément finit au-dessus ;
//   · que « retour » ferme la feuille (une entrée d'historique à elle) sans
//     changer de section.
//  Et, à part (revue du 23 oct.) :
//   · la CONFIRMATION posée par « Tout imprimer » (N° porté par deux fiches,
//     N° réattribué pas encore écrit) passe au-dessus du lot et se touche ;
//   · un MESSAGE (toast) dit depuis une feuille se lit et se touche, sans
//     couvrir le pied de la feuille (« Supprimer des données… » qui échoue,
//     « Tout imprimer » sans PDF) ;
//   · les feuilles de l'EN-TÊTE (« Tous les écrans », l'état des actions) ne
//     passent plus sous la barre du bas en paysage (844×390) et sur iPad
//     (820×1180), et leur voile couvre la barre ;
//   · « Paires du lot » ouverte par-dessus le tiroir d'une vente prend le
//     clavier : Échap la ferme, elle, et le tiroir reste.
//  `PARTIES=feuilles,confirmation,messages,entete,clavier` (défaut : toutes).
//  Données inventées (reçus par email, à la forme mesurée en production le
//  23 oct. ; PDF fabriqués ici) + fixtures `fx/` (jamais dans le dépôt).
//  `SONDE=boutons TAB=… [SECTION=…] [TAILLE=390|1512]` : liste les boutons
//  visibles d'un écran (pour écrire un déclencheur).
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const { dressingsDuJour } = require('./_instantane.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist'), SC = __dirname;
const sc = require('./_scenario-colis.cjs');
const present = fs.existsSync(path.join(SC, 'fx', 'main.json'));
// ⚠️ fx/ absent (toute session hors la sienne) : on monte une base RICHE et
// cohérente (coqueScenario) — annonces en ligne numérotées, une vente en LOT de
// 2 articles, bordereaux prêts, une conversation, des comptes — pour que CHAQUE
// feuille s'ouvre vraiment. Aucune donnée réelle (§6.3). Avant, ce banc s'arrêtait
// en exit(0) sans fx (« non lancé ») : honnête, mais il ne tournait jamais ailleurs.
const CO = present ? null : sc.coqueScenario();
const FX = f => JSON.parse(fs.readFileSync(path.join(SC, 'fx', f + '.json'), 'utf8'));
const FXok = f => { try { return FX(f); } catch (_) { return []; } };
const main = present ? FX('main') : CO.main;
// Les lignes de comptes portent le propriétaire de la copie : la session du
// banc en est un autre. Sans owner, la porte des bancs pose le sien.
const accounts = present ? FX('accounts').map(a => { const { owner, ...r } = a; return r; }) : CO.accounts;
// Reçus d'achat par email : INVENTÉS (aucun dans les fixtures), sans PDF, pour
// que l'app ouvre sa feuille « Reçu d'achat » et non un PDF.
// ⚠️ (revue du 23 oct.) À LA FORME MESURÉE EN PRODUCTION (lecture seule, 117
// lignes `email_achat_*`) : `prix` est un montant SANS « € » (« 42,70 ») — la
// forme d'avant (« 40,00 € ») faisait écrire « 40,00 € € » à l'app —, il n'y a
// AUCUN champ `montant`, et `texte` porte les lignes que lit `parseReceiptFields`
// sous leur vraie forme (« *Vendeur* x », « Article 37,00 € », « Frais de port
// 2,88 € », « *Montant payé* 42,70 € », « *Date du paiement* 13/10/2026 10 h
// 00 »…). Sans texte, le reçu mesuré faisait 414 px au lieu de 589 : le bas
// du contenu était jugé sur une feuille 30 % plus courte que la vraie (§6.3).
// ⚠️ (fusion du 23 oct.) Et dans L'ORDRE mesuré : le détail vient APRÈS
// « Montant payé », avant « Mode de paiement » (81 reçus sur 81), avec « Frais
// Vinted » (la forme récente) — la règle du reçu lit ce bloc-là.
const texteRecu = (i) => [
  'Bonjour,', `Merci pour ta commande « Paire inventée ${i} ».`,
  `*Vendeur* vendeur_invente_${i}  `,
  '*Montant payé* 42,70 € ', 'Article 37,00 € ', 'Frais de port 2,88 € ', 'Frais Vinted 2,82 € ',
  '*Mode de paiement* Carte bancaire, **********', `*Date du paiement* 1${i}/10/2026 10 h 00 `,
  "L'équipe Vinted",
].join('\n');
const recus = [1, 2, 3].map(i => ({ id: 'email_achat_banc' + i, data: { type: 'achat', article: 'Paire inventée ' + i, account: 'compte_banc', uid: '', receivedAt: `2026-10-1${i}T10:00:00Z`, transaction: '99900000' + i, prix: '42,70', subject: 'Ton reçu pour ta commande', filename: '', texte: texteRecu(i) } }));
const rows = [...(present ? FX('sold') : CO.sold), ...(present ? FX('purch') : CO.purch), ...dressingsDuJour(present ? FX('listings') : CO.listings), ...FXok('inbox'), ...FXok('track'), ...(present ? FX('bord') : CO.bord), ...(present ? FX('label') : CO.label), ...FXok('billing'), ...(present ? [] : CO.conv), ...recus];
const txn = present ? FX('txn') : [];
function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const alias = m[1] || m[2].split('->').pop().replace(/^>/, ''); const src = m[2];
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (/^data(->|->>)/.test(src)) {
      let v = row.data;
      for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = (v == null ? null : v[seg]);
      out[alias] = v == null ? null : v; continue;
    }
    out[alias] = row[src];
  }
  return out;
}

// Les règles de la feuille de style LIVRÉE qui posent la propriété (Chromium
// la jette en lisant la feuille : on la relit dans le texte du fichier).
const SEL_TOUCH = [];
for (const f of fs.readdirSync(path.join(DIST, 'assets')).filter(x => x.endsWith('.css'))) {
  const css = fs.readFileSync(path.join(DIST, 'assets', f), 'utf8');
  for (const m of css.matchAll(/([^{}]+)\{[^{}]*-webkit-overflow-scrolling\s*:\s*touch[^{}]*\}/g)) SEL_TOUCH.push(m[1].trim());
}
// La règle de WebKit sur iPhone, appliquée dans Chromium (voir l'en-tête).
const REGLE_WEBKIT = `(() => {
  const SEL = ${JSON.stringify(SEL_TOUCH)};
  const defile = (cs) => /^(auto|scroll|overlay)$/.test(cs.overflowX) || /^(auto|scroll|overlay)$/.test(cs.overflowY);
  const passe = () => {
    const cands = new Set();
    for (const el of document.querySelectorAll('*')) { try { if (el.style && el.style.WebkitOverflowScrolling === 'touch') cands.add(el); } catch (_) {} }
    for (const s of SEL) { try { document.querySelectorAll(s).forEach((e) => cands.add(e)); } catch (_) {} }
    for (const el of cands) {
      const cs = getComputedStyle(el);
      if (el.dataset.bancWebkit === '1') continue;
      if (cs.zIndex !== 'auto' || !defile(cs)) continue;
      el.style.isolation = 'isolate'; el.dataset.bancWebkit = '1';
    }
  };
  window.__bancWebkit = passe;
  const lancer = () => { passe(); new MutationObserver(() => { clearTimeout(window.__bancWebkitT); window.__bancWebkitT = setTimeout(passe, 30); }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lancer); else lancer();
})();`;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const PORT = Number(process.env.BANC_PORT) || 9211;
srv.on('error', e => { console.log('⚠️ port ' + PORT + ' pris (' + e.code + ') — relance avec BANC_PORT'); process.exit(1); });
srv.listen(PORT);

// Un vrai PDF (fabriqué ici, pdf-lib) pour les lectures d'octets d'un bordereau :
// les fixtures n'en gardent que 4 caractères. Servi seulement quand le contexte
// le demande (`etat.pdf`) — sinon « Tout imprimer » dit « plus leur PDF ».
let PDF_B64 = null;
async function fabriquerPdf() {
  if (PDF_B64) return PDF_B64;
  const PL = require(path.join(__dirname, '..', '..', 'node_modules', 'pdf-lib', 'cjs', 'index.js'));
  const d = await PL.PDFDocument.create(); d.addPage([400, 600]);
  PDF_B64 = Buffer.from(await d.save()).toString('base64');
  return PDF_B64;
}

// `opts.pont` : une extension VRM qui répond dans cette page (le pont joue le
// vrai dialogue : `ready`, puis `etat`). Sur téléphone, c'est le cas de Firefox
// pour Android ; le panneau « État des actions » y porte ses lignes (extension,
// compte VRM, compte Vinted) et devient bien plus haut que « Lecture seule ».
const EXT_VERSION = (() => { const m = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8').match(/const EXT_ATTENDUE = '([\d.]+)'/); return m ? m[1] : '5.200.0'; })();
const PONT_MIN = (version) => {
  const post = (m) => window.postMessage(m, '*');
  const ext = 'a'.repeat(32);
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: ext });
    if (d.__vmr === 'etat' && d.reqId) post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '999999', login: 'compte_inconnu' }, cmds: {} } });
  });
  post({ __vmr: 'ready', version, id: ext });
};
// `opts.safeBas` : la zone de la barre d'accueil d'un iPhone en PWA (34 px),
// posée par CDP — `env(safe-area-inset-bottom)` vaut alors 34px dans la page.
async function contexte(b, W, H, tactile, sombre, iphone, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: tactile, hasTouch: tactile });
  const pg = await ctx.newPage();
  const etat = { pdf: false, echecSuppr: false };
  pg.__etat = etat;
  pg.__errs = [];
  pg.on('pageerror', e => pg.__errs.push(e.message.slice(0, 120)));
  ctx.on('page', (p2) => { if (p2 !== pg) p2.close().catch(() => {}); });   // l'onglet réservé à l'impression
  if (opts.safeBas) {
    const cdp = await ctx.newCDPSession(pg);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: opts.safeBas, left: 0, right: 0 } });
  }
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, !!sombre);
  if (iphone) await pg.addInitScript(REGLE_WEBKIT);
  if (opts.pont) await pg.addInitScript(PONT_MIN, EXT_VERSION);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r3) => {
    const t3 = r3.request().resourceType();
    if (t3 === 'image' || t3 === 'media' || t3 === 'font') return r3.abort();
    return r3.continue();
  });
  await pg.route('**://*.vinted.net/**', r4 => r4.abort());
  await pg.route('**/rest/v1/**', async route => {
    const u = metaVersData(route.request().url());
    const lu = decodeURIComponent(route.request().url());
    const j = d => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    // « Supprimer des données… » : sa lecture des lignes du compte échoue (le toast d'échec).
    if (etat.echecSuppr && /or=\(id\.like\.harvest_/.test(lu)) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    if (etat.pdf && /select=[^&]*b:data->>pdfB64/.test(lu)) return j([{ b: PDF_B64 }]);
    if (/select=owner(&|$)/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1]; const S = sel ? decodeURIComponent(sel) : null;
    if (/id=eq\.main/.test(u)) return j(main.map(r => projette(r, S)));
    if (/transaction->>id/.test(u)) return j(txn);
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) { const k = decodeURIComponent(eq[1]); return j([...rows, ...txn].filter(r => r.id === k).map(r => projette(r, S))); }
    const m = /id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + decodeURIComponent(m[1]).replace(/[*%]/g, '.*') + '$'); return j([...rows, ...(/_txn_/.test(m[1]) ? txn : [])].filter(r => re.test(r.id)).map(r => projette(r, S))); }
    return j([]);
  });
  await pg.route('**/api/**', r2 => r2.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  return { ctx, pg };
}

// ── La mesure, dans la page ────────────────────────────────────────────────
// Le voile = l'élément `position:fixed` qui couvre l'écran, le plus haut peint
// (z-index), et qui n'est pas un simple « attrape-clic » transparent et vide.
// Le panneau = son plus grand enfant (ou son [role=dialog]).
const MESURE = `((cible) => {
  if (window.__bancWebkit) window.__bancWebkit();
  const W = innerWidth, H = innerHeight;
  const tous = [...document.querySelectorAll('body *')].filter((e) => {
    const cs = getComputedStyle(e); if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = e.getBoundingClientRect(); return r.width >= W * 0.95 && r.height >= H * 0.95 && r.top <= 2 && r.left <= 2;
  }).filter((e) => {
    const cs = getComputedStyle(e); const transp = /rgba\\(0, 0, 0, 0\\)|transparent/.test(cs.backgroundColor) && cs.backgroundImage === 'none';
    return !(transp && e.children.length === 0);
  }).filter((e) => !e.closest('.vrm-tabbar, .vrm-app-header, [data-banc-ignorer]'));
  // \`cible\` : un texte que porte la feuille voulue (quand une autre couche plein
  // écran est ouverte en même temps, comme le tiroir d'une vente).
  const cands = cible ? tous.filter((e) => (e.innerText || '').indexOf(cible) >= 0) : tous;
  if (!cands.length) return { voile: false };
  const voile = cands[cands.length - 1];
  const kids = [...voile.querySelectorAll(':scope > *')].filter((k) => { const r = k.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const panneau = voile.querySelector('[role=dialog]') || kids.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return rb.width * rb.height - ra.width * ra.height; })[0] || voile;
  const qui = (h) => !h ? 'rien' : voile.contains(h) ? 'ok' : h.closest('.vrm-tabbar') ? 'barre du bas' : h.closest('.vrm-app-header') ? 'en-tête' : (h.className && h.className.toString ? h.className.toString().slice(0, 30) : h.tagName);
  const points = () => {
    const rc = panneau.getBoundingClientRect();
    const b = Math.min(rc.bottom, H) - 3, t = Math.max(rc.top, 0) + 3, g = Math.max(rc.left, 0) + 3, d = Math.min(rc.right, W) - 3;
    return { 'coin bas gauche': [g, b], 'coin bas droit': [d, b], 'milieu du bas': [(g + d) / 2, b], 'coin haut gauche': [g, t], 'coin haut droit': [d, t], 'haut du voile': [W / 2, 3] };
  };
  const res = {};
  for (const [n, [x, y]] of Object.entries(points())) res[n] = qui(document.elementFromPoint(x, y));
  // Le bas du contenu : on défile chaque zone qui défile de la feuille jusqu'au bout.
  const zones = [panneau, ...panneau.querySelectorAll('*')].filter((e) => { const cs = getComputedStyle(e); return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2; });
  for (const z of zones) z.scrollTop = z.scrollHeight;
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  // Défilé jusqu'au bout : où finit le DERNIER élément (texte ou commande) à
  // l'écran — la zone de la barre d'accueil (safe-area) doit rester libre.
  let dernierBas = -1, dernierQui = '';
  for (const e of panneau.querySelectorAll('*')) {
    if (!vis(e) || !([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(e.tagName))) continue;
    const r = e.getBoundingClientRect();
    if (r.bottom <= H + 1 && r.bottom > dernierBas) { dernierBas = r.bottom; dernierQui = e.tagName + ' « ' + (e.innerText || e.value || '').trim().slice(0, 40) + ' »'; }
  }
  const cliquables = [...panneau.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary')].filter(vis);
  // Le dernier élément cliquable et le dernier texte du contenu : défilés jusqu'au bout,
  // ils doivent être à l'écran et touchables (rien par-dessus).
  const textes = [...panneau.querySelectorAll('*')].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const juge = (el) => {
    if (!el) return 'ok';
    el.scrollIntoView({ block: 'nearest' });
    const r = el.getBoundingClientRect(); const x = Math.min(Math.max(r.left + Math.min(r.width / 2, 20), 1), W - 1), y = Math.min(Math.max(r.top + r.height / 2, 1), H - 1);
    if (r.bottom > H + 1 || r.top < -1) return 'hors de l\\'écran';
    const h = document.elementFromPoint(x, y);
    return (h && (h === el || el.contains(h) || (voile.contains(h) && h.contains(el)))) ? 'ok' : qui(h);
  };
  const bc = juge(cliquables[cliquables.length - 1]), bt = juge(textes[textes.length - 1]);
  const bas = bc === 'ok' && bt === 'ok' ? 'ok' : (bc !== 'ok' ? 'dernier bouton : ' + bc : 'dernière ligne : ' + bt);
  const petits = cliquables.filter((e) => e.tagName === 'BUTTON' || e.tagName === 'A' || e.tagName === 'SUMMARY').filter((e) => { const r = e.getBoundingClientRect(); return r.height < 43.5; })
    .map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().height) + 'px');
  // Ce qui retient la feuille : le premier ancêtre qui crée un contexte d'empilement ou un référentiel.
  let piege = null;
  for (let e = voile.parentElement; e && e !== document.body; e = e.parentElement) {
    const cs = getComputedStyle(e);
    const pile = cs.isolation === 'isolate' || (cs.zIndex !== 'auto' && (cs.position !== 'static' || (e.parentElement && /flex|grid/.test(getComputedStyle(e.parentElement).display)))) || cs.transform !== 'none' || cs.filter !== 'none' || cs.opacity !== '1' || cs.willChange !== 'auto' || (cs.contain && cs.contain !== 'none') || cs.backdropFilter !== 'none';
    if (pile) { piege = e.tagName.toLowerCase() + (e.className && e.className.toString ? '.' + e.className.toString().split(' ')[0] : '') + (e.dataset.bancWebkit ? ' (-webkit-overflow-scrolling)' : ''); break; }
  }
  return { voile: true, points: res, bas, petits, piege, dansMain: !!voile.closest('main.vrm-main'), margeBas: Math.round(H - dernierBas), dernierQui, texte: (panneau.innerText || '').replace(/\\s+/g, ' ').slice(0, 2000) };
})`;
const mesurer = (pg, cible) => pg.evaluate(`(${MESURE})(${JSON.stringify(cible || '')})`);

// Le voile (couche plein écran) qui porte un texte donné — ou la dernière peinte.
const VOILE_OUVERT = `((cible) => {
  const W = innerWidth, H = innerHeight;
  const v = [...document.querySelectorAll('body *')].filter((e) => { const cs = getComputedStyle(e); if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width >= W * 0.95 && r.height >= H * 0.95 && r.top <= 2 && r.left <= 2; })
    .filter((e) => !e.closest('.vrm-tabbar, .vrm-app-header, [data-banc-ignorer], .vrm-ledger-drawer-host'))
    .filter((e) => { const cs = getComputedStyle(e); return !(/rgba\\(0, 0, 0, 0\\)|transparent/.test(cs.backgroundColor) && cs.backgroundImage === 'none' && e.children.length === 0); });
  const c = cible ? v.filter((e) => (e.innerText || '').indexOf(cible) >= 0) : v;
  return c.length ? (c[c.length - 1].innerText || '').trim().slice(0, 40).replace(/\\n/g, ' ') : null;
})`;
const voileOuvert = (pg, cible) => pg.evaluate(`(${VOILE_OUVERT})(${JSON.stringify(cible || '')})`);
const histo = (pg) => pg.evaluate(() => { const st = history.state || {}; return { sub: st.vrmSub == null ? null : st.vrmSub, tab: st.vrmTab == null ? null : st.vrmTab, feuille: st.vrmFeuille || null }; });
// Ce qui est peint au centre d'un élément : lui-même, ou quoi ?
const TOUCHABLE = `((sel, texte) => {
  if (window.__bancWebkit) window.__bancWebkit();
  const cands = [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (!texte || (e.innerText || '').trim() === texte); });
  const el = cands[cands.length - 1]; if (!el) return { trouve: false };
  const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const ok = !!(h && (h === el || el.contains(h)));
  return { trouve: true, ok, dessus: ok ? '' : (h ? ((h.closest('[data-lot]') ? 'le lot « Bordereaux à imprimer » · ' : '') + (h.innerText || h.getAttribute('aria-label') || h.tagName).trim().replace(/\\s+/g, ' ').slice(0, 50)) : 'rien'), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] };
})`;
const touchable = (pg, sel, texte) => pg.evaluate(`(${TOUCHABLE})(${JSON.stringify(sel)}, ${JSON.stringify(texte || '')})`);
const attendre = async (pg, fn, arg, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await pg.evaluate(fn, arg).catch(() => null); if (v) return v; await pg.waitForTimeout(250); } return null; };

(async () => {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
  await fabriquerPdf();
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const aller = async (pg, tab, attente = 4500) => { await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(attente); };
  const section = async (pg, nom) => { await pg.locator('.vrm-seg-btn', { hasText: nom }).first().click({ timeout: 5000 }); await pg.waitForTimeout(2500); };
  const PARTIES = (process.env.PARTIES || 'feuilles,confirmation,messages,entete,clavier').split(',');
  const partie = (n) => PARTIES.includes(n);

  if (process.env.SONDE === 'boutons') {
    const t = process.env.TAILLE === '1512' ? [1512, 950, false, true, false] : [390, 844, true, false, true];
    const { ctx, pg } = await contexte(b, ...t);
    await aller(pg, process.env.TAB || 'journee');
    if (process.env.SECTION) await section(pg, process.env.SECTION);
    for (const c of (process.env.CLIC || '').split('||').filter(Boolean)) { await pg.locator(c).first().click({ timeout: 5000 }); await pg.waitForTimeout(1500); }
    if (process.env.MESURE) console.log(JSON.stringify(await mesurer(pg, process.env.CIBLE), null, 1));
    const r = await pg.evaluate(() => [...document.querySelectorAll('button, summary, [role=menuitem]')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height; }).map(e => `${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).split(' ')[0] : ''} « ${(e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50)} »`));
    console.log(r.join('\n'));
    if (process.env.CAPTURE) await pg.screenshot({ path: process.env.CAPTURE });
    await b.close(); srv.close(); process.exit(0);
  }
  // ── Les feuilles joignables, ouvertes comme Julien les ouvre ──────────────
  // (Les feuilles déjà sorties dans document.body — conversation sur
  //  téléphone, retouche de photo, widgets, communauté, « Mon compte »… — ne
  //  sont pas piégées : la conversation est gardée ici comme témoin.)
  const clic = async (pg, sel, attente = 1200) => { await pg.locator(sel).first().click({ timeout: 6000 }); await pg.waitForTimeout(attente); };
  const outil = (texte) => async (pg) => { await clic(pg, 'button:text-is("⋯")', 700); await clic(pg, `button:has-text("${texte}")`); };
  const outilVentes = (texte) => async (pg) => { await clic(pg, 'button:text-is("⋯ Outils")', 700); await clic(pg, `button:has-text("${texte}")`); };
  // Comme Julien : le tiroir de la vente, puis « Modifier » (le bouton du lot
  // vit dans ce repli — fermé, il n'est ni visible ni joignable au clavier),
  // puis le bouton. Le bouton est cliqué SANS lui donner le focus, comme
  // Safari : c'est le cas qui exige que l'app retienne d'où vient la feuille.
  const ouvrirLotDuTiroir = async (pg) => {
    await clic(pg, '.vrm-ledger-sale-toggle:has-text("Lot 2 articles")', 1500);
    const det = pg.locator('.vrm-ledger-drawer-host:not([hidden]) details.vrm-sale-details:has(button[aria-label="Voir les paires du lot"])').first();
    await det.locator(':scope > summary').click({ timeout: 6000 });
    await pg.waitForTimeout(500);
    const ok = await det.evaluate((d) => { const b = d.querySelector('button[aria-label="Voir les paires du lot"]'); if (!d.open || !b || !b.checkVisibility()) return false; b.click(); return true; });
    if (!ok) throw new Error('bouton « Voir les paires du lot » pas visible après « Modifier »');
    await pg.waitForTimeout(1500);
  };
  const SCENARIOS = [
    { nom: "Achats · Reçu d'achat", tab: 'plat_vinted', section: 'Achats', recu: true, etapes: async (pg) => { await clic(pg, '.vrm-recus-email > summary', 700); await clic(pg, '.vrm-recus-email li button'); } },
    { nom: 'Achats · Note interne', tab: 'plat_vinted', section: 'Achats', etapes: async (pg) => { await clic(pg, '.vrm-seg-btn:has-text("Tous")', 1500); await clic(pg, '.vrm-buy-more', 600); await clic(pg, '[role=menuitem]:has-text("note interne")'); } },
    { nom: 'Annonces · Répartir un lot', tab: 'plat_vinted', section: 'Annonces', etapes: outil('Répartir un lot') },
    { nom: 'Annonces · Inventaire physique', tab: 'plat_vinted', section: 'Annonces', etapes: outil('Inventaire physique') },
    { nom: 'Annonces · Audit du stock', tab: 'plat_vinted', section: 'Annonces', etapes: outil('Audit du stock') },
    { nom: "Annonces · Compléter les prix d'achat", tab: 'plat_vinted', section: 'Annonces', etapes: outil("Compléter les prix d'achat") },
    { nom: 'Annonces · Studio photo', tab: 'plat_vinted', section: 'Annonces', etapes: outil('Studio photo') },
    // ⚠️ Le bouton rend « Passeport de l'article » avec une apostrophe DROITE
    //    (App.jsx) ; `has-text` ne normalise pas les apostrophes. On vise une
    //    sous-chaîne sans apostrophe (§6.5, le texte rendu).
    { nom: 'Annonces · Passeport de l’article', tab: 'plat_vinted', section: 'Annonces', etapes: async (pg) => { await clic(pg, 'summary:has-text("Gérer l’annonce")', 700); await clic(pg, 'button:has-text("Passeport de l")'); } },
    { nom: 'Ventes · Rapport comptable', tab: 'plat_vinted', section: 'Ventes', etapes: outilVentes('Rapport comptable') },
    { nom: 'Ventes · Registre annuel', tab: 'plat_vinted', section: 'Ventes', etapes: outilVentes('Registre annuel') },
    { nom: 'Ventes · Paires du lot', tab: 'plat_vinted', section: 'Ventes', cible: 'Paires du lot', etapes: ouvrirLotDuTiroir },
    { nom: 'Colis · Tout imprimer', tab: 'cat_bord', etapes: async (pg) => { await clic(pg, 'button:has-text("Tout imprimer")'); } },
    { nom: 'Compta · Nouvelle facture', tab: 'compta', section: 'Factures', etapes: async (pg) => { await clic(pg, 'button:has-text("Nouvelle facture")'); } },
    { nom: 'Réglages · Supprimer un compte Vinted', tab: 'vintedaccounts', etapes: async (pg) => { await clic(pg, 'summary:has-text("Gérer ce compte")', 700); await clic(pg, 'button:has-text("Supprimer des données…")'); } },
    // ⚠️ TÉMOIN, et il exige une CONVERSATION CAPTÉE qui traverse tout le
    //    pipeline de la messagerie (résumés + offres + favoris + sélection de
    //    compte). Une conversation synthétique n'y suffit pas (l'écran tombe en
    //    « Réessayer »). On ne prétend donc PAS qu'il passe sans fx : il reste
    //    actif sur la vraie base (fx présent), et il est sauté — avec raison
    //    loggée — en mode synthétique. Ce n'est pas un test de feuille piégée
    //    (la conversation sort dans document.body, hors de la coque).
    { nom: 'Messages · Conversation (témoin)', tab: 'plat_vinted', section: 'Messages', tactile: true, fxSeul: true, etapes: async (pg) => { await clic(pg, '.vrm-inbox-row', 2000); } },
  ];
  const filtre = process.env.SCENARIOS ? new RegExp(process.env.SCENARIOS, 'i') : null;
  // 390 tactile : l'iPhone (règle de WebKit appliquée, barre d'accueil de 34 px), clair.
  // 1512 : ordinateur, sombre.
  const SAFE = 34;
  const TAILLES = [[390, 844, true, false, true, 'iPhone 390'], [1512, 950, false, true, false, 'ordinateur 1512']].filter((t) => !process.env.TAILLE || String(t[0]) === process.env.TAILLE);
  for (const [W, H, tactile, sombre, iphone, tag] of TAILLES) {
    if (!partie('feuilles')) break;
    const { ctx, pg } = await contexte(b, W, H, tactile, sombre, iphone, { safeBas: iphone ? SAFE : 0 });
    if (iphone) {
      // Le banc s'assure d'abord qu'il applique bien la règle de WebKit : sinon il ne mesurerait rien.
      await aller(pg, 'journee', 3500);
      const temoin = await pg.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'overflow:auto;height:10px'; d.style.WebkitOverflowScrolling = 'touch'; document.body.appendChild(d); window.__bancWebkit(); const v = getComputedStyle(d).isolation; d.remove(); return v; });
      dit(temoin === 'isolate', `[${tag}] le banc applique la règle de WebKit (-webkit-overflow-scrolling: touch ⇒ contexte d'empilement)`, temoin);
      // …et la zone de la barre d'accueil : sinon la mesure du bas ne mesure rien.
      const sa = await pg.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom)'; document.body.appendChild(d); const h = d.getBoundingClientRect().height; d.remove(); return h; });
      dit(sa === SAFE, `[${tag}] le banc pose la zone de la barre d'accueil (env(safe-area-inset-bottom) = ${SAFE} px)`, String(sa));
    }
    for (const sc of SCENARIOS) {
      if (filtre && !filtre.test(sc.nom)) continue;
      if (sc.fxSeul && !present) { console.log(`-- [${tag}] ${sc.nom} : témoin ignoré sans fx/ (conversation captée réelle requise)`); continue; }
      if (sc.tactile && !tactile) continue; // sur ordinateur la conversation s'ouvre dans l'écran, pas en feuille
      let r = null, avant = null, ouvert = null;
      try {
        await aller(pg, sc.tab);
        if (sc.section) await section(pg, sc.section);
        avant = await histo(pg);
        await sc.etapes(pg);
        ouvert = await histo(pg);
        r = await mesurer(pg, sc.cible);
      } catch (e) { dit(false, `[${tag}] ${sc.nom} : la feuille s'ouvre`, e.message.split('\n')[0].slice(0, 140)); continue; }
      if (!r || !r.voile) { dit(false, `[${tag}] ${sc.nom} : la feuille s'ouvre`, 'aucune feuille plein écran'); continue; }
      const couverts = Object.entries(r.points).filter(([, v]) => v !== 'ok').map(([k, v]) => `${k} : ${v}`);
      dit(couverts.length === 0, `[${tag}] ${sc.nom} : rien ne passe par-dessus (barre du bas, en-tête)`, couverts.join(' · ') + (r.piege ? ` — retenue par ${r.piege}` : ''));
      dit(r.bas === 'ok', `[${tag}] ${sc.nom} : le bas du contenu est atteignable`, r.bas);
      if (tactile) dit(r.petits.length === 0, `[${tag}] ${sc.nom} : ses boutons font 44 px affichés`, r.petits.slice(0, 4).join(' · '));
      if (iphone) dit(r.margeBas >= SAFE, `[${tag}] ${sc.nom} : le bas du contenu finit au-dessus de la barre d'accueil (${SAFE} px)`, `dernier élément à ${r.margeBas} px du bas — ${r.dernierQui}`);
      if (sc.recu) {
        // Le reçu servi a la forme réelle : la feuille porte le détail (port,
        // vendeur…) et jamais « € € » (un prix rangé avec son « € »).
        dit(/Frais de port/.test(r.texte) && /Vendeur/.test(r.texte) && /42,70 €/.test(r.texte) && !/€\s*€/.test(r.texte), `[${tag}] ${sc.nom} : le reçu servi a la forme réelle (détail, vendeur, « 42,70 € », jamais « € € »)`, r.texte.slice(0, 160));
      }
      if (process.env.CAPTURES) { fs.mkdirSync(process.env.CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(process.env.CAPTURES, `${W}-${sc.nom.replace(/[^\w]+/g, '_')}.png`) }).catch(() => {}); }
      // « Retour » ferme la feuille (une entrée d'historique à elle) sans changer de section.
      dit(!!(ouvert && ouvert.feuille) && ouvert.feuille !== (avant && avant.feuille), `[${tag}] ${sc.nom} : la feuille pose son entrée d'historique (« retour » la ferme)`, JSON.stringify(ouvert));
      await pg.goBack({ waitUntil: 'commit' }).catch(() => {}); await pg.waitForTimeout(1300);
      const apres = await histo(pg); const reste = await voileOuvert(pg, sc.cible);
      dit(!reste && apres.sub === avant.sub && apres.tab === avant.tab, `[${tag}] ${sc.nom} : « retour » ferme la feuille et garde la section`, `avant ${JSON.stringify(avant)} · après ${JSON.stringify(apres)}${reste ? ' · encore ouverte : ' + reste : ''}`);
    }
    if (pg.__errs.length) console.log(`erreurs de page (${tag})`, [...new Set(pg.__errs)].slice(0, 3));
    await ctx.close();
  }

  // ── LA CONFIRMATION AU-DESSUS DE « TOUT IMPRIMER » (revue du 23 oct.) ──────
  // Le lot « Bordereaux à imprimer » (z 9000) reste ouvert pendant que
  // `confirmerNumerosAVerifier` pose sa question : avant, la confirmation
  // (z 2000) passait DESSOUS — grisée, et le toucher fermait la liste.
  // Deux causes : un N° porté par DEUX fiches (§5, le seul risque
  // irréversible) et un N° réattribué pas encore écrit sur le carton.
  const TAILLES2 = [[390, 844, true, false, true, 'iPhone 390'], [1512, 950, false, false, false, 'ordinateur 1512']].filter((t) => !process.env.TAILLE || String(t[0]) === process.env.TAILLE);
  const ouvrirLotImpression = async (pg) => {
    await aller(pg, 'cat_bord', 5000);
    await clic(pg, 'button:has-text("Tout imprimer")', 1500);
    // Coche la première ligne qui porte un N° (les fixtures sont anciennes : rien n'est coché d'office).
    const num = await pg.evaluate(() => { const l = [...document.querySelectorAll('[data-lot-ligne]')].find((x) => /N°\s*([A-Z]{0,3}\d+)/.test(x.innerText)); if (!l) return null; if (l.dataset.coche !== '1') l.querySelector('input[type=checkbox]').click(); return /N°\s*([A-Z]{0,3}\d+)/.exec(l.innerText)[1]; });
    await pg.waitForTimeout(600);
    // (29-30 oct.) « Article contrôlé » sur chaque ligne cochée, comme lui —
    // sinon « Imprimer » ouvre d'abord la question « Vérifier les articles ».
    for (const c of await pg.locator('[data-lot-ligne][data-coche="1"] input[aria-label^="Article contrôlé"]').all()) await c.check({ force: true }).catch(() => {});
    await pg.waitForTimeout(300);
    return num;
  };
  // ⚠️ La confirmation ne se déclenche QUE si un N° imprimé est ambigu (porté par
  //    deux fiches, ou réattribué non écrit). Le banc l'injecte sur le N° que la
  //    LIGNE du lot affiche — qui, sur la vraie base, correspond à une vraie fiche
  //    (poke → vrai doublon). En synthétique, la numérotation auto donne à la paire
  //    un N° sans fiche jumelle : le doublon ne peut pas se former fidèlement. On
  //    garde donc cette partie sur fx réel (comme le témoin Messages), sans
  //    prétendre qu'elle passe en synthétique — les 13 feuilles, elles, tournent
  //    partout (c'est l'objet du banc : aucune feuille sous la barre).
  if (partie('confirmation') && !present) console.log('-- [confirmation] ignorée sans fx/ : exige une paire au N° ambigu dans un lot imprimable réel');
  for (const [W, H, tactile, sombre, iphone, tag] of TAILLES2) {
    if (!partie('confirmation') || !present) break;
    for (const cas of [
      { nom: 'N° porté par deux fiches', ok: "C'est le bon article, imprimer", poser: (n) => { const k = 'vinted_annonce_numeros'; const f = JSON.parse(localStorage.getItem(k) || '{}'); f.banc_doublon_invente = { numero: n, title: 'Paire inventée (doublon)' }; localStorage.setItem(k, JSON.stringify(f)); } },
      { nom: 'N° réattribué pas encore écrit', ok: "Oui, c'est écrit", poser: (n) => { const k = 'vinted_annonce_numeros'; const f = JSON.parse(localStorage.getItem(k) || '{}'); for (const x of Object.values(f)) { if (x && String(x.numero) === String(n)) x.reattribue = { de: '9' + n, vers: String(n), at: '2026-10-20T08:00:00Z' }; } localStorage.setItem(k, JSON.stringify(f)); } },
    ]) {
      const { ctx, pg } = await contexte(b, W, H, tactile, sombre, iphone);
      pg.__etat.pdf = true;
      try {
        const num = await ouvrirLotImpression(pg);
        if (!num) { dit(false, `[${tag}] Tout imprimer · ${cas.nom} : une ligne porte un N°`, 'aucune'); await ctx.close(); continue; }
        await pg.evaluate(cas.poser, num);
        await clic(pg, '[data-lot-imprimer]', 300);
        const vu = await attendre(pg, (t) => [...document.querySelectorAll('button')].some((x) => (x.innerText || '').trim() === t), cas.ok);
        if (!vu) { dit(false, `[${tag}] Tout imprimer · ${cas.nom} : la confirmation est posée`, 'aucune confirmation en 8 s'); await ctx.close(); continue; }
        await pg.waitForTimeout(500);
        const lotOuvert = await pg.evaluate(() => !!document.querySelector('[data-lot]'));
        const t1 = await touchable(pg, 'button', cas.ok);
        const t2 = await touchable(pg, 'button', 'Annuler');
        dit(lotOuvert && t1.ok && t2.ok, `[${tag}] Tout imprimer · ${cas.nom} : la confirmation passe au-dessus du lot ouvert, « ${cas.ok} » et « Annuler » se touchent`, `lot ouvert : ${lotOuvert} · « ${cas.ok} » : ${t1.ok ? 'ok' : 'sous ' + t1.dessus} · « Annuler » : ${t2.ok ? 'ok' : 'sous ' + t2.dessus}`);
        if (process.env.CAPTURES) { fs.mkdirSync(process.env.CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(process.env.CAPTURES, `${W}-confirmation-${cas.nom.replace(/[^\w]+/g, '_')}.png`) }).catch(() => {}); }
      } catch (e) { dit(false, `[${tag}] Tout imprimer · ${cas.nom}`, e.message.split('\n')[0].slice(0, 140)); }
      await ctx.close();
    }
  }

  // ── UN MESSAGE DIT DEPUIS UNE FEUILLE SE LIT (revue du 23 oct.) ────────────
  // Le Toaster vit sur la coque : à 210, une feuille à 1000+ passait dessus et
  // l'échec n'était pas dit. Il doit être touchable, et, sur téléphone, ne pas
  // couvrir le pied de la feuille.
  for (const [W, H, tactile, sombre, iphone, tag] of TAILLES2) {
    if (!partie('messages')) break;
    // 1. « Supprimer des données… » : la lecture des lignes du compte échoue.
    {
      const { ctx, pg } = await contexte(b, W, H, tactile, sombre, iphone);
      pg.__etat.echecSuppr = true;
      try {
        await aller(pg, 'vintedaccounts');
        await clic(pg, 'summary:has-text("Gérer ce compte")', 700);
        await clic(pg, 'button:has-text("Supprimer des données…")');
        await clic(pg, 'button:text-is("Supprimer")', 300);
        const vu = await attendre(pg, () => !!document.querySelector('.vrm-toast'));
        if (!vu) dit(false, `[${tag}] Supprimer des données… (échec) : un message est dit`, 'aucun toast');
        else {
          const feuille = await voileOuvert(pg, 'Supprimer les données de');
          const t = await touchable(pg, '.vrm-toast');
          const pied = await touchable(pg, 'button', 'Annuler');
          const txt = await pg.evaluate(() => (document.querySelector('.vrm-toast').innerText || '').trim().slice(0, 60));
          dit(!!feuille && t.ok, `[${tag}] Supprimer des données… (échec) : le message se lit et se touche au-dessus de la feuille`, `« ${txt} » · ${t.ok ? 'touchable' : 'sous ' + t.dessus}${feuille ? '' : ' · feuille fermée'}`);
          dit(pied.ok, `[${tag}] Supprimer des données… (échec) : le message ne couvre pas le pied de la feuille (« Annuler »)`, pied.ok ? '' : 'sous ' + pied.dessus);
        }
        if (process.env.CAPTURES) { fs.mkdirSync(process.env.CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(process.env.CAPTURES, `${W}-message-suppression.png`) }).catch(() => {}); }
      } catch (e) { dit(false, `[${tag}] Supprimer des données… (échec)`, e.message.split('\n')[0].slice(0, 140)); }
      await ctx.close();
    }
    // 2. « Tout imprimer » sur des bordereaux sans PDF lisible.
    {
      const { ctx, pg } = await contexte(b, W, H, tactile, sombre, iphone);
      try {
        const num = await ouvrirLotImpression(pg);
        await clic(pg, '[data-lot-imprimer]', 300);
        const vu = await attendre(pg, () => !!document.querySelector('.vrm-toast'));
        if (!vu) dit(false, `[${tag}] Tout imprimer sans PDF : un message est dit`, 'aucun toast' + (num ? '' : ' (aucune ligne cochée)'));
        else {
          const lot = await pg.evaluate(() => !!document.querySelector('[data-lot]'));
          const t = await touchable(pg, '.vrm-toast');
          const txt = await pg.evaluate(() => (document.querySelector('.vrm-toast').innerText || '').trim().slice(0, 60));
          dit(lot && t.ok, `[${tag}] Tout imprimer sans PDF : le message se lit et se touche au-dessus du lot`, `« ${txt} » · ${t.ok ? 'touchable' : 'sous ' + t.dessus}${lot ? '' : ' · lot fermé'}`);
        }
      } catch (e) { dit(false, `[${tag}] Tout imprimer sans PDF`, e.message.split('\n')[0].slice(0, 140)); }
      await ctx.close();
    }
  }

  // ── LES FEUILLES DE L'EN-TÊTE (revue du 23 oct.) ───────────────────────────
  // « Tous les écrans » et l'état des actions vivaient DANS l'en-tête (sticky,
  // z 50) : en paysage et sur iPad, la barre du bas (z 60) passait dessus et
  // leur voile la laissait claire et touchable.
  // (Le petit téléphone n'a pas la variante haute de « Tous les écrans » : son
  //  menu est dans « Gestion », en bas. On n'y juge que l'état des actions.)
  const TAILLES3 = [[844, 390, 'téléphone en paysage 844×390', true], [568, 320, 'petit téléphone en paysage 568×320', false], [820, 1180, 'iPad 820×1180', true]];
  const BAS_DE = `((sel) => {
    if (window.__bancWebkit) window.__bancWebkit();
    const W = innerWidth, H = innerHeight;
    const el = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().height > 0).pop(); if (!el) return { trouve: false };
    const zones = [el, ...el.querySelectorAll('*')].filter((e) => { const cs = getComputedStyle(e); return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2; });
    for (const z of zones) z.scrollTop = z.scrollHeight;
    const rc = el.getBoundingClientRect();
    // Ce qui compte : que la barre du bas (ou l'en-tête) ne passe pas par-dessus.
    // Les points sont pris à 24 px des bords : ces feuilles ont des coins
    // arrondis en bas, et un point dans l'arrondi tombe sur ce qu'il y a dessous.
    const qui = (h) => !h ? 'rien' : el.contains(h) ? 'ok' : h.closest('.vrm-tabbar') ? 'barre du bas' : h.closest('.vrm-app-header') ? 'en-tête' : (h.className && h.className.toString ? h.tagName + '.' + h.className.toString().slice(0, 30) : h.tagName);
    const b = Math.min(rc.bottom, H) - 3, g = Math.max(rc.left, 0) + 24, d = Math.min(rc.right, W) - 24;
    const pts = { 'bas gauche': [g, b], 'bas milieu': [(g + d) / 2, b], 'bas droit': [d, b] };
    const res = {}; for (const [n, [x, y]] of Object.entries(pts)) res[n] = qui(document.elementFromPoint(x, y));
    const tb = document.querySelector('.vrm-tabbar'); let barre = null;
    if (tb) { const r = tb.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); barre = h && h.closest('.vrm-tabbar') ? 'la barre du bas, à nu' : 'couverte'; }
    return { trouve: true, points: res, horsEcran: rc.bottom > H + 1 ? Math.round(rc.bottom - H) : 0, barre };
  })`;
  // Deux passages par taille : sans extension (« Lecture seule ») puis avec une
  // extension qui répond ici (le panneau porte alors ses lignes, et il est haut).
  for (const [W, H, tag0, menuHaut] of TAILLES3) for (const avecExt of [false, true]) {
    if (!partie('entete')) break;
    const tag = avecExt ? `${tag0} · extension présente` : tag0;
    const { ctx, pg } = await contexte(b, W, H, true, false, true, { pont: avecExt });
    try {
      await aller(pg, 'journee');
      // 1. « Tous les écrans » (une fois par taille : il ne dépend pas de l'extension)
      if (!avecExt && menuHaut) {
      await clic(pg, 'button[aria-label="Tous les écrans"]', 900);
      const m = await pg.evaluate(`(${BAS_DE})('.vrm-sheet-haut')`);
      if (!m.trouve) dit(false, `[${tag}] « Tous les écrans » : la feuille s'ouvre`, 'introuvable');
      else {
        const couverts = Object.entries(m.points).filter(([, v]) => v !== 'ok').map(([k, v]) => `${k} : ${v}`);
        dit(couverts.length === 0 && !m.horsEcran, `[${tag}] « Tous les écrans » : le bas de la feuille n'est pas sous la barre du bas`, couverts.join(' · ') + (m.horsEcran ? ` · ${m.horsEcran} px hors de l'écran` : ''));
        dit(m.barre === 'couverte', `[${tag}] « Tous les écrans » : son voile couvre la barre du bas (rien ne s'y touche derrière)`, m.barre);
      }
      if (process.env.CAPTURES) { fs.mkdirSync(process.env.CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(process.env.CAPTURES, `${W}x${H}-tous-les-ecrans.png`) }).catch(() => {}); }
      await pg.keyboard.press('Escape'); await pg.waitForTimeout(600);
      }
      // 2. L'état des actions (« Lecture seule » / « Actions possibles »)
      const btn = await pg.$('[data-etat-actions]');
      if (!btn) dit(false, `[${tag}] État des actions : le bouton existe`, 'introuvable');
      else {
        await btn.click(); await pg.waitForTimeout(900);
        const e = await pg.evaluate(`(${BAS_DE})('[data-etat-panneau]')`);
        if (avecExt) { const nv = await pg.evaluate(() => { const p = document.querySelector('[data-etat-panneau]'); return p ? Math.round(p.getBoundingClientRect().height) + ' px · ' + (p.innerText || '').split('\n')[0].slice(0, 40) : ''; }); dit(/Actions|ordinateur|extension/i.test(nv) || parseInt(nv, 10) > 0, `[${tag}] le banc sert une extension qui répond (panneau de ${nv})`, nv); }
        if (!e.trouve) dit(false, `[${tag}] État des actions : le panneau s'ouvre`, 'introuvable');
        else {
          const couverts = Object.entries(e.points).filter(([, v]) => v !== 'ok').map(([k, v]) => `${k} : ${v}`);
          dit(couverts.length === 0 && !e.horsEcran, `[${tag}] État des actions : le bas du panneau n'est pas sous la barre du bas, et tient dans l'écran`, couverts.join(' · ') + (e.horsEcran ? ` · ${e.horsEcran} px hors de l'écran` : ''));
        }
        // Toucher DANS le panneau ne le ferme pas (il vit ailleurs que son bouton).
        const resteOuvert = await pg.evaluate(() => { const p = document.querySelector('[data-etat-panneau]'); if (!p) return false; const r = p.getBoundingClientRect(); const ev = (t) => p.dispatchEvent(new (t === 'touchstart' ? Event : MouseEvent)(t, { bubbles: true, clientX: r.left + 10, clientY: r.top + 10 })); ev('mousedown'); ev('touchstart'); return true; });
        await pg.waitForTimeout(400);
        const encore = await pg.evaluate(() => !!document.querySelector('[data-etat-panneau]'));
        dit(resteOuvert && encore, `[${tag}] État des actions : toucher dans le panneau ne le ferme pas`, encore ? '' : 'refermé');
      }
      if (process.env.CAPTURES) await pg.screenshot({ path: path.join(process.env.CAPTURES, `${W}x${H}${avecExt ? '-ext' : ''}-etat-actions.png`) }).catch(() => {});
    } catch (e) { dit(false, `[${tag}] feuilles de l'en-tête`, e.message.split('\n')[0].slice(0, 140)); }
    if (pg.__errs.length) console.log(`erreurs de page (${tag})`, [...new Set(pg.__errs)].slice(0, 3));
    await ctx.close();
  }

  // ── « PAIRES DU LOT » PAR-DESSUS LE TIROIR : LE CLAVIER (revue du 23 oct.) ──
  // Montée au-dessus du tiroir d'une vente, la feuille doit aussi en prendre le
  // clavier : Échap ferme ce qu'on voit (la feuille), le tiroir reste, et un
  // seul « retour » ferme ensuite le tiroir.
  if (partie('clavier') && (!process.env.TAILLE || process.env.TAILLE === '1512')) {
    const { ctx, pg } = await contexte(b, 1512, 950, false, true, false);
    try {
      await aller(pg, 'plat_vinted'); await section(pg, 'Ventes');
      await ouvrirLotDuTiroir(pg);
      const etat = () => pg.evaluate(() => ({ lot: !!document.querySelector('[data-lot-paires]') || [...document.querySelectorAll('div')].some((d) => getComputedStyle(d).position === 'fixed' && /Paires du lot/.test(d.innerText || '')), tiroir: !!document.querySelector('.vrm-ledger-drawer-host:not([hidden])') }));
      const e0 = await etat();
      dit(e0.lot && e0.tiroir, '[ordinateur 1512] Paires du lot : ouverte par-dessus le tiroir de la vente', JSON.stringify(e0));
      await pg.keyboard.press('Escape');
      await pg.waitForTimeout(900);
      const e1 = await etat();
      dit(!e1.lot && e1.tiroir, '[ordinateur 1512] Paires du lot : Échap ferme la feuille du lot, le tiroir reste', JSON.stringify(e1));
      const focus = await pg.evaluate(() => (document.activeElement && (document.activeElement.getAttribute('aria-label') || document.activeElement.innerText || document.activeElement.tagName) || '').slice(0, 40));
      dit(focus === 'Voir les paires du lot', '[ordinateur 1512] Paires du lot : le clavier revient au bouton qui l\'a ouverte', focus);
      await pg.goBack({ waitUntil: 'commit' }).catch(() => {}); await pg.waitForTimeout(1100);
      const e2 = await etat();
      dit(!e2.lot && !e2.tiroir, '[ordinateur 1512] Paires du lot : puis un seul « retour » ferme le tiroir', JSON.stringify(e2));
    } catch (e) { dit(false, '[ordinateur 1512] Paires du lot : le clavier', e.message.split('\n')[0].slice(0, 140)); }
    await ctx.close();
  }

  await b.close(); srv.close();
  console.log(ko ? `\n${ko} contrôle(s) rouge(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
