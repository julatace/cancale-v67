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
//   · au doigt, que ses boutons font 44 px affichés.
//  Données inventées (reçus par email) + fixtures `fx/` (jamais dans le dépôt).
//  `SONDE=boutons TAB=… [SECTION=…] [TAILLE=390|1512]` : liste les boutons
//  visibles d'un écran (pour écrire un déclencheur).
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const { dressingsDuJour } = require('./_instantane.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist'), SC = __dirname;
if (!fs.existsSync(path.join(SC, 'fx', 'main.json'))) { console.log('⚠️ fixtures absentes (scripts/bancs/fx) — banc non lancé'); process.exit(0); }
const FX = f => JSON.parse(fs.readFileSync(path.join(SC, 'fx', f + '.json'), 'utf8'));
const main = FX('main');
// Les lignes de comptes portent le propriétaire de la copie : la session du
// banc en est un autre. Sans owner, la porte des bancs pose le sien.
const accounts = FX('accounts').map(a => { const { owner, ...r } = a; return r; });
// Reçus d'achat par email : INVENTÉS (aucun dans les fixtures), sans PDF, pour
// que l'app ouvre sa feuille « Reçu d'achat » et non un PDF.
const recus = [1, 2, 3].map(i => ({ id: 'email_achat_banc' + i, data: { article: 'Paire inventée ' + i, account: 'compte_banc', receivedAt: `2026-10-1${i}T10:00:00Z`, transaction: '99900000' + i, prix: '40,00 €', montant: '42,70 €', subject: 'Ton reçu' } }));
const rows = [...FX('sold'), ...FX('purch'), ...dressingsDuJour(FX('listings')), ...FX('inbox'), ...FX('track'), ...FX('bord'), ...FX('label'), ...FX('billing'), ...recus];
const txn = FX('txn');
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

async function contexte(b, W, H, tactile, sombre, iphone) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: tactile, hasTouch: tactile });
  const pg = await ctx.newPage();
  pg.__errs = [];
  pg.on('pageerror', e => pg.__errs.push(e.message.slice(0, 120)));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, !!sombre);
  if (iphone) await pg.addInitScript(REGLE_WEBKIT);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r3) => {
    const t3 = r3.request().resourceType();
    if (t3 === 'image' || t3 === 'media' || t3 === 'font') return r3.abort();
    return r3.continue();
  });
  await pg.route('**://*.vinted.net/**', r4 => r4.abort());
  await pg.route('**/rest/v1/**', async route => {
    const u = metaVersData(route.request().url());
    const j = d => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
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
  return { voile: true, points: res, bas, petits, piege, dansMain: !!voile.closest('main.vrm-main') };
})`;
const mesurer = (pg, cible) => pg.evaluate(`(${MESURE})(${JSON.stringify(cible || '')})`);

(async () => {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const aller = async (pg, tab, attente = 4500) => { await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(attente); };
  const section = async (pg, nom) => { await pg.locator('.vrm-seg-btn', { hasText: nom }).first().click({ timeout: 5000 }); await pg.waitForTimeout(2500); };

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
  const SCENARIOS = [
    { nom: "Achats · Reçu d'achat", tab: 'plat_vinted', section: 'Achats', etapes: async (pg) => { await clic(pg, '.vrm-recus-email > summary', 700); await clic(pg, '.vrm-recus-email li button'); } },
    { nom: 'Achats · Note interne', tab: 'plat_vinted', section: 'Achats', etapes: async (pg) => { await clic(pg, '.vrm-seg-btn:has-text("Tous")', 1500); await clic(pg, '.vrm-buy-more', 600); await clic(pg, '[role=menuitem]:has-text("note interne")'); } },
    { nom: 'Annonces · Répartir un lot', tab: 'plat_vinted', section: 'Annonces', etapes: outil('Répartir un lot') },
    { nom: 'Annonces · Inventaire physique', tab: 'plat_vinted', section: 'Annonces', etapes: outil('Inventaire physique') },
    { nom: 'Annonces · Audit du stock', tab: 'plat_vinted', section: 'Annonces', etapes: outil('Audit du stock') },
    { nom: "Annonces · Compléter les prix d'achat", tab: 'plat_vinted', section: 'Annonces', etapes: outil("Compléter les prix d'achat") },
    { nom: 'Annonces · Studio photo', tab: 'plat_vinted', section: 'Annonces', etapes: outil('Studio photo') },
    { nom: 'Annonces · Passeport de la paire', tab: 'plat_vinted', section: 'Annonces', etapes: async (pg) => { await clic(pg, 'summary:has-text("Gérer l’annonce")', 700); await clic(pg, 'button:has-text("Passeport de la paire")'); } },
    { nom: 'Ventes · Rapport comptable', tab: 'plat_vinted', section: 'Ventes', etapes: outilVentes('Rapport comptable') },
    { nom: 'Ventes · Registre annuel', tab: 'plat_vinted', section: 'Ventes', etapes: outilVentes('Registre annuel') },
    { nom: 'Ventes · Paires du lot', tab: 'plat_vinted', section: 'Ventes', cible: 'Paires du lot', etapes: async (pg) => {
      await clic(pg, '.vrm-ledger-sale-toggle:has-text("Lot 2 articles")', 1500);
      const ok = await pg.evaluate(() => { const b = [...document.querySelectorAll('button[aria-label="Voir les paires du lot"]')].find((x) => x.getBoundingClientRect().width > 0 && !x.closest('[hidden]')); if (b) b.click(); return !!b; });
      if (!ok) throw new Error('bouton « Voir les paires du lot » introuvable');
      await pg.waitForTimeout(1500);
    } },
    { nom: 'Colis · Tout imprimer', tab: 'cat_bord', etapes: async (pg) => { await clic(pg, 'button:has-text("Tout imprimer")'); } },
    { nom: 'Compta · Nouvelle facture', tab: 'compta', etapes: async (pg) => { await clic(pg, '.vrm-seg-btn:has-text("Factures")', 1500); await clic(pg, 'button:has-text("Nouvelle facture")'); } },
    { nom: 'Réglages · Supprimer un compte Vinted', tab: 'vintedaccounts', etapes: async (pg) => { await clic(pg, 'summary:has-text("Gérer ce compte")', 700); await clic(pg, 'button:has-text("Supprimer ce compte")'); } },
    { nom: 'Messages · Conversation (témoin)', tab: 'plat_vinted', section: 'Messages', tactile: true, etapes: async (pg) => { await clic(pg, '.vrm-inbox-row', 2000); } },
  ];
  const filtre = process.env.SCENARIOS ? new RegExp(process.env.SCENARIOS, 'i') : null;
  // 390 tactile : l'iPhone (règle de WebKit appliquée), clair. 1512 : ordinateur, sombre.
  const TAILLES = [[390, 844, true, false, true, 'iPhone 390'], [1512, 950, false, true, false, 'ordinateur 1512']].filter((t) => !process.env.TAILLE || String(t[0]) === process.env.TAILLE);
  for (const [W, H, tactile, sombre, iphone, tag] of TAILLES) {
    const { ctx, pg } = await contexte(b, W, H, tactile, sombre, iphone);
    if (iphone) {
      // Le banc s'assure d'abord qu'il applique bien la règle de WebKit : sinon il ne mesurerait rien.
      await aller(pg, 'journee', 3500);
      const temoin = await pg.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'overflow:auto;height:10px'; d.style.WebkitOverflowScrolling = 'touch'; document.body.appendChild(d); window.__bancWebkit(); const v = getComputedStyle(d).isolation; d.remove(); return v; });
      dit(temoin === 'isolate', `[${tag}] le banc applique la règle de WebKit (-webkit-overflow-scrolling: touch ⇒ contexte d'empilement)`, temoin);
    }
    for (const sc of SCENARIOS) {
      if (filtre && !filtre.test(sc.nom)) continue;
      if (sc.tactile && !tactile) continue; // sur ordinateur la conversation s'ouvre dans l'écran, pas en feuille
      let r = null;
      try {
        await aller(pg, sc.tab);
        if (sc.section) await section(pg, sc.section);
        await sc.etapes(pg);
        r = await mesurer(pg, sc.cible);
      } catch (e) { dit(false, `[${tag}] ${sc.nom} : la feuille s'ouvre`, e.message.split('\n')[0].slice(0, 140)); continue; }
      if (!r || !r.voile) { dit(false, `[${tag}] ${sc.nom} : la feuille s'ouvre`, 'aucune feuille plein écran'); continue; }
      const couverts = Object.entries(r.points).filter(([, v]) => v !== 'ok').map(([k, v]) => `${k} : ${v}`);
      dit(couverts.length === 0, `[${tag}] ${sc.nom} : rien ne passe par-dessus (barre du bas, en-tête)`, couverts.join(' · ') + (r.piege ? ` — retenue par ${r.piege}` : ''));
      dit(r.bas === 'ok', `[${tag}] ${sc.nom} : le bas du contenu est atteignable`, r.bas);
      if (tactile) dit(r.petits.length === 0, `[${tag}] ${sc.nom} : ses boutons font 44 px affichés`, r.petits.slice(0, 4).join(' · '));
      if (process.env.CAPTURES) { fs.mkdirSync(process.env.CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(process.env.CAPTURES, `${W}-${sc.nom.replace(/[^\w]+/g, '_')}.png`) }).catch(() => {}); }
    }
    if (pg.__errs.length) console.log(`erreurs de page (${tag})`, [...new Set(pg.__errs)].slice(0, 3));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(ko ? `\n${ko} contrôle(s) rouge(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
