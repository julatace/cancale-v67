// ════════════════════════════════════════════════════════════════════════════
//  BANC « CLAVIER + LECTEUR D'ÉCRAN » (10 nov., lot P — propositions 21 et 22).
//  Données INVENTÉES (un compte, quatre annonces, une vente, un achat), aucune fx/.
//
//  A. LECTEUR D'ÉCRAN (390 px tactile et 1512 px, clair et sombre), sur les écrans
//     principaux (Ma journée, Annonces, Ventes, Colis, Messages, Achats, Stock,
//     Argent, Paramètres). Les noms sont ceux que CHROME calcule (arbre
//     d'accessibilité, CDP `Accessibility.getFullAXTree`), pas une règle maison :
//      A1 aucun contrôle (bouton, lien, champ, case, onglet…) sans nom lu ;
//      A2 aucune image non décorative sans nom ;
//      A3 rien de focalisable caché au lecteur (`aria-hidden` au-dessus d'un focalisable) ;
//      A4 Annonces : chaque vignette se lit « N°, titre, prix » (son nom contient le prix) ;
//      A5 aucune erreur de page ;
//      A6 Ma journée : un widget se lit « libellé : valeur », « pas su » pour un « — ».
//  B. CLAVIER (1512 px) :
//      B1 « g » puis « a » ⇒ Annonces ; « g v » ⇒ Ventes ; « g c » ⇒ Colis ; « g j » ⇒ Ma journée ;
//      B2 dans un champ de saisie, « g a » s'écrit et ne change pas d'écran ;
//      B3 « ? » ouvre la feuille des raccourcis (role=dialog, aria-modal, titre) ;
//         le focus y entre, Tab et Maj+Tab tournent DEDANS (DA4), Échap la ferme
//         et rend le focus ;
//      B4 feuille ouverte : « g a » ne change pas d'écran ;
//      B5 « n » ⇒ Achats, « Nouvel achat » ouvert, RIEN d'écrit ;
//      B6 « / » ouvre la recherche ;
//      B7 aucun raccourci ne déclenche un geste irréversible (aucune écriture
//         pendant toute la séquence B, hors celles de l'app au chargement).
//  BANC_PORT (aléatoire si absent), BANC_DIST, BANC_CAPTURES.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { routeMain } = require('./_base-ecritures.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const CAPTURES = process.env.BANC_CAPTURES || path.join(require('os').tmpdir(), 'banc-clavier-voiceover');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}
const PNG = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'icon-512.png'));
const auj = new Date();
const ilYa = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const photo = (n) => `https://images1.vinted.net/t/01_banc${n}/f800/170000000${n}.jpeg`;
const ann = (id, title, heures, extra = {}) => ({ id, title, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', size: '42', status: 'Très bon état', view_count: 30, favourite_count: 13, created_at_ts: Math.floor((Date.now() - heures * 3600e3) / 1000), ...extra });
const ITEMS = [
  ann(9303, 'Nike Dunk Low Panda taille 42', 2, { photo: photo(3) }),
  ann(9202, 'Salomon XT-6 noir taille 41', 40, { brand_title: 'Salomon', photo: photo(2), favourite_count: 48 }),
  ann(9401, 'Adidas Handball Spezial taille 43', 90, { brand_title: 'Adidas', photo: photo(4), price: { amount: '65.0', currency_code: 'EUR' } }),
  ann(9402, 'Nike P-6000 noir taille 44', 150, { photo: photo(5), price: { amount: '59.0', currency_code: 'EUR' } }),
];
const VENTES = [{ transaction_id: 9301, title: 'Nike Banc vendue taille 42', price: { amount: '80', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYa(48) }];
const ACHATS = [{ transaction_id: 9501, title: 'Achat Vinted banc', price: { amount: '30', currency_code: 'EUR' }, status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: ilYa(96) }];
const MAIN = () => ({
  vinted_annonce_numeros: {
    '9202': { numero: '5', auto: false, manuelAt: ilYa(30), numberedAt: ilYa(40), buyPrice: '25' },
    '9401': { numero: '12', auto: true, numberedAt: ilYa(90) },
    '9402': { numero: '13', auto: true, numberedAt: ilYa(150) },
  },
  vinted_used_numeros: [5, 12, 13],
});
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const ECRANS = [
  ['journee', 'Ma journée'], ['annonces', 'Annonces'], ['ventes', 'Ventes'], ['cat_bord', 'Colis'], ['messages', 'Messages'],
  ['achats', 'Achats'], ['garage', 'Stock'], ['compta', 'Argent'], ['settings', 'Paramètres'],
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
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop().replace(/"/g, '');
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/"/g, '')];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function ouvrir(b, { largeur, sombre, tab }) {
  const base = { main: MAIN(), maj: new Date(Date.now() - 86400e3).toISOString(), ecritures: [] };
  const rows = [
    { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: VENTES } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: ACHATS } } },
    { id: 'vinted_item_details', data: {} },
  ];
  const mobile = largeur < 700;
  const ctx = await b.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = [];
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route(/images1\.vinted\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof d === 'string' ? d : JSON.stringify(d) });
    if (req.method() !== 'GET' && req.method() !== 'HEAD') ecrits.push({ meth: req.method(), u: u.slice(0, 160), at: Date.now() });
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'banc' }]);
    const mm = routeMain(req, base); if (mm) return j(mm.body, mm.status);
    if (req.method() !== 'GET') return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab || 'journee'}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5000);
  return { pg, ctx, errs, base, ecrits };
}
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };

// L'arbre d'accessibilité de CHROME : les noms qu'un lecteur d'écran lira.
const ROLES_CONTROLE = new Set(['button', 'link', 'textbox', 'searchbox', 'checkbox', 'switch', 'radio', 'combobox', 'listbox', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'slider', 'spinbutton', 'option']);
async function auditLecteur(pg) {
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const sansNom = [], imagesSansNom = [];
  if (process.env.BANC_DUMP) for (const n of nodes) { if (!n.ignored && ROLES_CONTROLE.has(n.role && n.role.value)) console.log('     · ' + n.role.value + ' « ' + ((n.name && n.name.value) || '') + ' »'); }
  for (const n of nodes) {
    if (n.ignored) continue;
    const role = n.role && n.role.value; const nom = ((n.name && n.name.value) || '').trim();
    if (nom) continue;
    if (ROLES_CONTROLE.has(role)) sansNom.push({ role, id: n.backendDOMNodeId });
    else if (role === 'image' || role === 'img') imagesSansNom.push({ role, id: n.backendDOMNodeId });
  }
  const decrire = async (liste) => {
    const out = [];
    for (const x of liste.slice(0, 12)) {
      try {
        const { object } = await cdp.send('DOM.resolveNode', { backendNodeId: x.id });
        const { result } = await cdp.send('Runtime.callFunctionOn', { objectId: object.objectId, returnByValue: true,
          functionDeclaration: 'function(){ const r=this.getBoundingClientRect?this.getBoundingClientRect():{width:0}; const h=(this.outerHTML||"").replace(/\\s+/g," ").slice(0,170); return { h, vis: r.width>0 && r.height>0 }; }' });
        out.push(`${x.role}${result.value && !result.value.vis ? ' (invisible)' : ''}: ${result.value ? result.value.h : '?'}`);
      } catch (e) { out.push(x.role + ': ?'); }
    }
    return out;
  };
  // A3 : un focalisable sous `aria-hidden="true"` (le lecteur ne le voit pas, le Tab y va).
  const cachesFocalisables = await pg.evaluate(() => {
    const sel = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]';
    return [...document.querySelectorAll(sel)].filter((e) => e.tabIndex >= 0 && e.closest('[aria-hidden="true"]') && !e.closest('[inert]') && e.getClientRects().length)
      .map((e) => (e.outerHTML || '').replace(/\s+/g, ' ').slice(0, 140));
  });
  const res = { sansNom: await decrire(sansNom), nSansNom: sansNom.length, images: await decrire(imagesSansNom), nImages: imagesSansNom.length, cachesFocalisables };
  await cdp.detach().catch(() => {});
  return res;
}
// Le nom lu d'un élément (CDP), pour A4.
async function nomLu(pg, selecteur) {
  const cdp = await pg.context().newCDPSession(pg);
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: selecteur });
    if (!nodeId) return null;
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
    const n = nodes.find((x) => !x.ignored) || nodes[0];
    return n ? { role: n.role && n.role.value, nom: (n.name && n.name.value) || '' } : null;
  } finally { await cdp.detach().catch(() => {}); }
}
const ongletActif = (pg) => pg.evaluate(() => {
  const m = document.querySelector('main[data-ecran]'); return m ? m.getAttribute('data-ecran') : null;
});

async function main() {
  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    // ── A. Lecteur d'écran ──────────────────────────────────────────────────
    // BANC_SEUL=A ou B, BANC_LARGEUR=390 ou 1512 : une partie seulement (pour aller vite).
    const SEUL = process.env.BANC_SEUL || '';
    for (const largeur of [390, 1512].filter((l) => !process.env.BANC_LARGEUR || String(l) === process.env.BANC_LARGEUR)) {
      if (SEUL === 'B') break;
      for (const sombre of [false, true]) {
        const T = `${largeur < 700 ? '📱' : '🖥️'}${sombre ? '🌙' : '☀️'}`;
        for (const [tab, nom] of ECRANS) {
          // Les écrans se rendent de la même façon en clair et en sombre : le sombre ne relit que trois écrans.
          if (sombre && !['journee', 'annonces', 'cat_bord'].includes(tab)) continue;
          await essaie(`${T} ${nom}`, async () => {
            const { pg, ctx, errs } = await ouvrir(b, { largeur, sombre, tab });
            await capture(pg, `${tab}-${largeur}-${sombre ? 'sombre' : 'clair'}`);
            const r = await auditLecteur(pg);
            dit(r.nSansNom === 0, `${T} ${nom} · A1 chaque contrôle a un nom lu`, `${r.nSansNom} sans nom : ${r.sansNom.join(' ║ ')}`);
            dit(r.nImages === 0, `${T} ${nom} · A2 chaque image a un nom (ou est décorative)`, `${r.nImages} : ${r.images.join(' ║ ')}`);
            dit(r.cachesFocalisables.length === 0, `${T} ${nom} · A3 rien de focalisable caché au lecteur`, r.cachesFocalisables.slice(0, 4).join(' ║ '));
            if (tab === 'journee') {
              // A6 : un widget se lit « libellé : valeur » et un « — » se dit « pas su » (§5).
              const n = await nomLu(pg, 'button[data-fu-case]');
              dit(!!n && /^[^:]+ : /.test(n.nom) && !/^—/.test(n.nom) && (!/pas su/.test(n.nom) || !/—/.test(n.nom)), `${T} Ma journée · A6 un widget se lit « libellé : valeur » (« pas su » pour —)`, JSON.stringify(n));
            }
            if (tab === 'annonces') {
              const n = await nomLu(pg, '[data-carte-annonce="9401"] [data-fiche-plus-bouton]');
              dit(!!n && /12/.test(n.nom) && /65/.test(n.nom) && /Adidas/i.test(n.nom), `${T} Annonces · A4 « Détails et gestes » dit sa paire « N°, titre, prix »`, JSON.stringify(n));
            }
            dit(errs.length === 0, `${T} ${nom} · A5 aucune erreur de page`, errs.slice(0, 2).join(' | '));
            await ctx.close();
          });
        }
      }
    }
    // ── B. Clavier (ordinateur) ─────────────────────────────────────────────
    for (const sombre of [false, true]) {
      if (SEUL === 'A') break;
      const T = `🖥️${sombre ? '🌙' : '☀️'}`;
      await essaie(`${T} clavier`, async () => {
        const { pg, ctx, errs, ecrits } = await ouvrir(b, { largeur: 1512, sombre, tab: 'journee' });
        await pg.mouse.click(5, 900).catch(() => {});
        await pg.evaluate(() => { try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (_) {} });
        const t0 = Date.now(); await pg.waitForTimeout(800);
        const ecritsAvant = ecrits.filter((e) => e.at >= t0).length;
        const titre = () => pg.evaluate(() => (document.title || ''));
        const ecran = async () => (await ongletActif(pg)) || (await titre());
        const seq = async (...k) => { for (const x of k) { await pg.keyboard.press(x); await pg.waitForTimeout(60); } await pg.waitForTimeout(900); };
        await seq('g', 'a'); const e1 = await ecran();
        dit(/annonces/i.test(e1), `${T} B1 « g a » ⇒ Annonces`, e1);
        await seq('g', 'v'); const e2 = await ecran();
        dit(/ventes/i.test(e2), `${T} B1 « g v » ⇒ Ventes`, e2);
        await seq('g', 'c'); const e3 = await ecran();
        dit(/cat_bord|colis/i.test(e3), `${T} B1 « g c » ⇒ Colis`, e3);
        await seq('g', 'j'); const e4 = await ecran();
        dit(/journee|journée/i.test(e4), `${T} B1 « g j » ⇒ Ma journée`, e4);
        // B2 : dans un champ, rien ne part.
        const champ = await pg.evaluate(() => { const i = document.createElement('input'); i.setAttribute('data-banc-champ', '1'); i.setAttribute('aria-label', 'banc'); i.style.cssText = 'position:fixed;top:4px;left:4px;z-index:99999'; document.body.appendChild(i); i.focus(); return document.activeElement === i; });
        await seq('g', 'a');
        const e5 = await ecran(); const val = await pg.evaluate(() => { const i = document.querySelector('[data-banc-champ]'); const v = i ? i.value : null; if (i) i.remove(); return v; });
        dit(champ && /journee|journée/i.test(e5) && val === 'ga', `${T} B2 dans un champ, « g a » s'écrit et ne change pas d'écran`, `${e5} · « ${val} »`);
        // B3 : « ? » ouvre la feuille ; focus dedans ; Tab tourne dedans ; Échap ferme.
        await pg.evaluate(() => { try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (_) {} });
        await pg.keyboard.press('Shift+?'); await pg.waitForTimeout(700);
        const f = await pg.evaluate(() => {
          const d = document.querySelector('[data-raccourcis-clavier]'); if (!d) return null;
          const dlg = d.closest('[role="dialog"]') || d.querySelector('[role="dialog"]');
          return { dlg: !!dlg, modal: dlg && dlg.getAttribute('aria-modal'), nomme: !!(dlg && (dlg.getAttribute('aria-labelledby') || dlg.getAttribute('aria-label'))), focusDedans: !!(dlg && dlg.contains(document.activeElement)), lignes: d.querySelectorAll('[data-raccourci]').length };
        });
        dit(!!f && f.dlg && f.modal === 'true' && f.nomme && f.lignes >= 8, `${T} B3 « ? » ouvre la feuille des raccourcis (dialog modal nommé, ≥ 8 raccourcis)`, JSON.stringify(f));
        dit(!!f && f.focusDedans, `${T} B3 le focus entre dans la feuille`, JSON.stringify(f));
        await capture(pg, `raccourcis-1512-${sombre ? 'sombre' : 'clair'}`);
        let dedans = true;
        for (let i = 0; i < 8; i++) { await pg.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab'); dedans = dedans && await pg.evaluate(() => { const d = document.querySelector('[data-raccourcis-clavier]'); const dlg = d && (d.closest('[role="dialog"]') || d.querySelector('[role="dialog"]')); return !!(dlg && dlg.contains(document.activeElement)); }); }
        dit(dedans, `${T} B3 Tab et Maj+Tab restent dans la feuille (DA4)`);
        // B4 : feuille ouverte, « g a » ne bouge pas.
        await seq('g', 'a'); const e6 = await ecran();
        dit(/journee|journée/i.test(e6), `${T} B4 feuille ouverte : « g a » ne change pas d'écran`, e6);
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(700);
        const ferme = await pg.evaluate(() => !document.querySelector('[data-raccourcis-clavier]'));
        dit(ferme, `${T} B3 Échap ferme la feuille`);
        // B6 : « / » ouvre la recherche.
        await pg.evaluate(() => { try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (_) {} });
        await pg.keyboard.press('/'); await pg.waitForTimeout(700);
        const rech = await pg.evaluate(() => { const a = document.activeElement; return !!(a && a.tagName === 'INPUT' && (a.type === 'search' || /cherch|recherch/i.test((a.getAttribute('placeholder') || '') + (a.getAttribute('aria-label') || '')))); });
        dit(rech, `${T} B6 « / » ouvre la recherche`);
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
        await pg.evaluate(() => { try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (_) {} });
        // B5 : « n » ⇒ Nouvel achat, rien d'écrit.
        await pg.keyboard.press('n'); await pg.waitForTimeout(1500);
        const e7 = await ecran();
        const form = await pg.evaluate(() => { const t = document.body.innerText || ''; return /Nouvel achat/i.test(t) && !!document.querySelector('input'); });
        dit(/achats/i.test(e7) && form, `${T} B5 « n » ⇒ Achats, « Nouvel achat » ouvert`, `${e7} · formulaire ${form}`);
        await capture(pg, `nouvel-achat-1512-${sombre ? 'sombre' : 'clair'}`);
        const ecritsMain = ecrits.filter((e) => e.at >= t0 && /app_data/.test(e.u) && /main/.test(e.u));
        dit(ecritsMain.length <= ecritsAvant, `${T} B7 aucun raccourci n'écrit dans la base`, ecritsMain.map((e) => e.meth + ' ' + e.u).slice(0, 3).join(' | '));
        dit(errs.length === 0, `${T} clavier · aucune erreur de page`, errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌ — captures : ${CAPTURES}`);
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
