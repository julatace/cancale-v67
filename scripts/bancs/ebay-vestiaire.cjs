// BANC « un clic dans le flux eBay ne mène JAMAIS à Vestiaire Collective »
// (15 octobre). Plainte de Julien : « quand je publie sur eBay et que j'appuie
// sur n'importe quel bouton, des fois ça m'a publié sur Vestiaire Collective ».
//
// MESURÉ AVANT D'ÉCRIRE CE BANC (voir CLAUDE.md, section du 15 octobre) :
//   · AUCUN chemin de code ne publie ni ne prépare quoi que ce soit sur
//     Vestiaire (app, extension, api/) — et la base ne porte AUCUNE ligne
//     `vc_*` ni « vestiaire ». Ce qu'il a vu, c'est l'ÉCRAN Vestiaire.
//   · La cause : le balayage entre onglets (`slideTab` — doigt, souris,
//     flèches ← →) parcourait `BOTTOM_TABS` BRUT, où Vestiaire est rangé JUSTE
//     AVANT eBay — alors que toutes les navigations visibles le cachent dans
//     « Autres plateformes ». Depuis eBay, le moindre geste « vers la gauche »
//     menait donc sur Vestiaire : faire défiler au doigt la rangée des sections
//     (6 pastilles, elle déborde sur téléphone) ou la rangée de photos du
//     formulaire, presser un bouton à la souris en glissant, sélectionner du
//     texte, ou ← après un clic (le bouton garde le focus). Et le formulaire
//     eBay en cours, démonté, perdait tout ce qui avait été tapé.
//
// Ce que le banc exige (données INVENTÉES, aucune fixture — il vit dans le dépôt) :
//   A (390 px, doigt) · B (1512 px, souris et clavier) : aucun geste parti du
//     flux eBay ne mène à Vestiaire ; un défilement de rangée n'est jamais une
//     navigation ; un formulaire eBay ouvert n'est jamais quitté par un geste ;
//     et l'AUTRE SENS : un vrai balayage depuis une zone neutre navigue
//     toujours, vers le voisin VISIBLE (Leboncoin).
//   C : chaque bouton du flux eBay cliqué (simple au doigt, double à la
//     souris, deux comptes eBay, réponses lentes) — l'écran reste hors de
//     Vestiaire, et RIEN ne part vers Vestiaire (requête, écriture en base,
//     message au pont de l'extension).
//   D : l'autre sens — le bouton « Vestiaire » de « Autres plateformes » ouvre
//     bien Vestiaire, et cet écran ne porte aucun bouton qui publierait.
//
// Lancement : `npm run build`, puis `node scripts/bancs/ebay-vestiaire.cjs`
// (PORT=5841 par défaut). `SECTIONS=A,B` ne joue que ces sections.
const fs = require('fs'), http = require('http'), path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.PORT) || 5841;
const SECTIONS = (process.env.SECTIONS || 'A,B,C,D').split(',');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGNk+M+ADzCOKgAAV7wDA8mm/lgAAAAASUVORK5CYII=', 'base64');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
// Un banc ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };

// ── Les données (inventées) ───────────────────────────────────────────────────
const PHOTOS = Array.from({ length: 8 }, (_, i) => `https://img.example/p${i + 1}.jpg`);
const NUMS = { '111': { numero: '401', title: 'Nike Air Max 1 Aquatone Bleu Taille 44', photo: PHOTOS[0], numberedAt: Date.now() } };
const ROWS = () => [
  { id: 'main', data: { vinted_annonce_numeros: NUMS } },
  { id: 'harvest_u1_listings', data: { capturedAt: new Date().toISOString(), payload: { items: [{ id: '111', title: NUMS['111'].title, is_closed: false, nPhotos: 8, price: { amount: '80.0', currency_code: 'EUR' } }] } } },
  { id: 'vinted_item_details', data: { '111': { description: 'Basket Nike inventée', photos: PHOTOS } } },
  // DEUX comptes eBay reliés : le sélecteur de compte apparaît.
  { id: 'ebay_comptes', data: { comptes: [{ principal: true, pseudo: 'boutique_a' }, { cle: '0123456789abcdef', pseudo: 'boutique_b', ajouteLe: Date.now() - 86400000 }] } },
  { id: 'ebay_listings', data: { items: [
    { itemId: '110000000001', title: 'Adidas Samba OG blanc taille 43', price: '80.0', sku: 'VRM-402', observateurs: 2, photo: 'https://img.example/e1.jpg', url: 'https://www.ebay.fr/itm/110000000001' },
    { itemId: '110000000002', title: 'Puma Suede rouge taille 42', price: '70.0', sku: '', observateurs: 0, photo: 'https://img.example/e2.jpg', url: 'https://www.ebay.fr/itm/110000000002' },
  ], capturedAt: Date.now() } },
  { id: 'ebay_listings_0123456789abcdef', data: { items: [
    { itemId: '120000000001', title: 'New Balance 550 blanc taille 43', price: '90.0', sku: '', observateurs: 1, photo: 'https://img.example/e3.jpg', url: 'https://www.ebay.fr/itm/120000000001' },
  ], capturedAt: Date.now() } },
  { id: 'ebay_orders', data: { orders: [
    { orderId: '01-001', orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', creationDate: new Date().toISOString(), lineItems: [{ sku: 'VRM-403', title: 'Asics Gel 1130 argent taille 39', legacyItemId: '110000000005' }], pricingSummary: { total: { value: '80.00', currency: 'EUR' } } },
  ], capturedAt: Date.now() } },
];
const ACCOUNTS = [{ vinted_user_id: 'u1', login: 'compte_vinted' }];

// Projection PostgREST : `alias:data->champ` / `alias:data->>champ` (§6.3).
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

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });

// Tout ce qui pourrait « partir vers Vestiaire », relevé pour TOUTE la séance.
const vestiaire = { requetes: [], ecritures: [], messages: [] };
const VC = /vestiaire|plat_vestiaire|\bvc_|"vc"/i;

async function ouvrir(b, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  let pg = null;
  ctx.on('page', (p) => { if (pg && p !== pg) p.close().catch(() => {}); });   // window.open (ebay.fr…) : refermé
  pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  let rows = ROWS();
  await pg.addInitScript((nums) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(nums)); localStorage.setItem('vinted_nums_physiques', JSON.stringify(['401'])); } catch (_) {}
    // Ce que l'app envoie au pont de l'extension (postMessage), gardé pour le banc.
    window.__msgs = [];
    const pm = window.postMessage.bind(window);
    window.postMessage = function (d, ...a) { try { window.__msgs.push(JSON.stringify(d).slice(0, 600)); } catch (_) {} return pm(d, ...a); };
  }, NUMS);
  // Ce qui PART : toute requête vers le site de Vestiaire, et toute requête qui
  // ÉCRIT (POST/PUT/PATCH/DELETE) en parlant de Vestiaire. Une LECTURE de
  // `vc_recon` n'est pas un envoi : c'est l'écran Vestiaire qui s'affiche —
  // ce que « aucun clic ne mène à Vestiaire » juge à part.
  pg.on('request', (r) => {
    const u = r.url(), m = r.method();
    if (/vestiairecollective/i.test(u) || (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && (VC.test(u) || VC.test((r.postData() || '').slice(0, 4000))))) vestiaire.requetes.push(m + ' ' + u.slice(0, 160));
  });
  // Rien ne sort vers le vrai Internet (ni eBay, ni Vinted, ni Vestiaire).
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (r.request().resourceType() === 'image' ? r.fulfill({ status: 200, contentType: 'image/png', body: PNG }) : r.abort()));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      const corps = req.postData() || '';
      if (VC.test(u) || VC.test(corps.slice(0, 4000).replace(/"tab":"[^"]*"/g, ''))) vestiaire.ecritures.push(req.method() + ' ' + u.slice(0, 120));
      try { for (const l of [].concat(JSON.parse(corps || 'null') || [])) { if (!l || !l.id || !l.data) continue; const i = rows.findIndex((r) => r.id === l.id); if (i >= 0) rows[i] = { id: l.id, data: l.data }; else rows.push({ id: l.id, data: l.data }); } } catch (_) {}
      return j([]);
    }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => projette(r, sel);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"pret":true}' }));
  // ⚠️ enregistré APRÈS le fourre-tout → Playwright le prend en PREMIER (§6.6).
  await pg.route('**/api/ebay**', async (route) => {
    const req = route.request();
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (opts.lent) await new Promise((r) => setTimeout(r, opts.lent));   // « états asynchrones »
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    if (VC.test(JSON.stringify(body))) vestiaire.requetes.push('POST /api/ebay ' + JSON.stringify(body).slice(0, 160));
    if (body.action === 'status') return j({ ok: true, connected: true });
    if (body.action === 'pubverify') return j({ ok: true, fees: '0.35', frais: { total: 0.35, parNom: { ListingFee: 0.35 } }, avertissements: [] });
    if (body.action === 'publish') return j({ ok: true, itemId: '110000000099', url: 'https://www.ebay.fr/itm/110000000099', sku: 'VRM-401', avertissements: [] });
    if (body.action === 'pubinfo') return j({ ok: true, categorie: { categoryId: '15709', suggeree: { categoryId: '15709', categoryName: 'Baskets' } }, categories: [{ categoryId: '15709', categoryName: 'Baskets' }], conditions: [{ id: '3000', label: "D'occasion" }], attributs: [{ nom: 'Marque', requis: true, mode: 'SELECTION_ONLY', valeurs: ['Nike', 'Adidas'] }], attributsObligatoires: ['Marque'] });
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}

// Où est-on ? (lu dans le RENDU, jamais dans une variable de l'app)
const ecran = (pg) => pg.evaluate(() => {
  if (document.querySelector('section[aria-label="eBay"]')) return 'ebay';
  if (document.querySelector('section[aria-label="Leboncoin"]')) return 'leboncoin';
  const t = document.body.innerText || '';
  if (/Ce que VRM sait de Vestiaire|Vestiaire Collective n.est pas encore reli/.test(t)) return 'vestiaire';
  const h = document.querySelector('main h1, main h2, h1, h2');
  return 'autre:' + ((h && h.textContent) || '').trim().slice(0, 30) + '@' + location.href.slice(0, 60);
});
const allerEbay = async (pg, section) => {
  await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('section[aria-label="eBay"]', { timeout: 15000 });
  await pg.waitForTimeout(1500);
  if (section) { await pg.click(`section[aria-label="eBay"] [data-section="${section}"]`, { timeout: 5000 }); await pg.waitForTimeout(1200); }
};
// Ouvre le formulaire « Vendre une paire sur eBay », choisit la N°401, et rend
// le titre rempli (ce qu'un balayage ne doit JAMAIS faire perdre).
const ouvrirFormulaire = async (pg) => {
  await allerEbay(pg, 'annonces');
  await pg.click('[data-poster="ebay"]', { timeout: 8000 });
  await pg.waitForTimeout(500);
  await pg.click('text=N°401', { timeout: 8000 });
  await pg.waitForTimeout(800);
  const inp = 'input[placeholder^="Nike Air Max"]';
  await pg.fill(inp, 'Titre tapé à la main');
  return inp;
};
const valeur = (pg, sel) => pg.$eval(sel, (e) => e.value).catch(() => null);
const centre = (pg, sel) => pg.evaluate((s) => { const e = typeof s === 'string' ? document.querySelector(s) : null; if (!e) return null; e.scrollIntoView({ block: 'center', inline: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, w: r.width }; }, sel);
// Un doigt qui glisse. ⚠️ Les événements tactiles du PROTOCOLE Chrome
// déclenchent aussi le « retour arrière par balayage » du navigateur (la page
// repartait sur about:blank, mesuré) : on émet donc les événements tactiles
// DANS la page, sur l'élément touché — c'est ce que la coque de l'app écoute.
const glisserDoigt = async (pg, cdp, x0, y, dx) => {
  await pg.evaluate(async ([x0, y, dx]) => {
    const cible = document.elementFromPoint(x0, y) || document.body;
    const t = (x) => new Touch({ identifier: 1, target: cible, clientX: x, clientY: y, pageX: x, pageY: y });
    const ev = (type, x, fin) => cible.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, composed: true, touches: fin ? [] : [t(x)], targetTouches: fin ? [] : [t(x)], changedTouches: [t(x)] }));
    ev('touchstart', x0);
    for (let i = 1; i <= 8; i++) { ev('touchmove', x0 + (dx * i) / 8); await new Promise((r) => setTimeout(r, 16)); }
    ev('touchend', x0 + dx, true);
  }, [x0, y, dx]);
  await pg.waitForTimeout(500);
};
// La souris qui presse puis glisse de côté (un clic de pavé tactile qui dérape).
const glisserSouris = async (pg, x0, y, dx) => {
  await pg.mouse.move(x0, y); await pg.mouse.down();
  for (let i = 1; i <= 10; i++) { await pg.mouse.move(x0 + (dx * i) / 10, y); await pg.waitForTimeout(12); }
  await pg.mouse.up(); await pg.waitForTimeout(500);
};

(async () => {
  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--overscroll-history-navigation=0'] });
  try {
    // ── A. TÉLÉPHONE (390 px, au doigt) ─────────────────────────────────────
    if (SECTIONS.includes('A')) {
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 });
      const cdp = null;
      await essaie('A1 · balayer au doigt depuis un bouton de section eBay', async () => {
        await allerEbay(pg);
        const nav = 'section[aria-label="eBay"] nav[aria-label="Sections de la plateforme"]';
        const r = await pg.$eval(nav, (n) => { n.scrollLeft = n.scrollWidth; const b = n.querySelector('[data-section="ventes"]').getBoundingClientRect(); return { deborde: n.scrollWidth > n.clientWidth + 2, x: b.left + 8, y: b.top + b.height / 2 }; });
        await glisserDoigt(pg, cdp, r.x, r.y, 220);
        const e = await ecran(pg);
        dit(e !== 'vestiaire', 'A1 · balayer depuis un bouton de section eBay ne mène PAS à Vestiaire', 'écran=' + e);
        // Rangée qui déborde : le doigt la fait défiler, il ne change pas d'écran.
        // Rangée qui tient (grille à 390 px) : un vrai balayage, vers le voisin VISIBLE.
        dit(r.deborde ? e === 'ebay' : e === 'leboncoin', r.deborde ? 'A1 · … la rangée défile, l\'écran reste eBay' : 'A1 · … la rangée tient sur l\'écran : le balayage mène au voisin VISIBLE, Leboncoin', 'écran=' + e);
      });
      await essaie('A2 · faire défiler au doigt les photos du formulaire eBay', async () => {
        const inp = await ouvrirFormulaire(pg);
        const rangee = '[data-publier-brouillon-id] .vrm-rangee';
        const info = await pg.evaluate((s) => { const n = [...document.querySelectorAll(s)].find((x) => x.querySelector('img')); if (!n) return null; n.scrollLeft = n.scrollWidth; n.scrollIntoView({ block: 'center' }); const r = n.getBoundingClientRect(); return { deborde: n.scrollWidth > n.clientWidth + 2, l: r.left, y: r.top + r.height / 2 }; }, rangee);
        dit(!!info && info.deborde, 'A2 · la rangée de 8 photos déborde à 390 px', JSON.stringify(info));
        if (info) await glisserDoigt(pg, cdp, info.l + 30, info.y, 220);
        const e = await ecran(pg);
        dit(e !== 'vestiaire', 'A2 · faire défiler les photos du formulaire eBay ne mène PAS à Vestiaire', 'écran=' + e);
        dit(e === 'ebay' && (await valeur(pg, inp)) === 'Titre tapé à la main', 'A2 · … le formulaire reste ouvert, le titre tapé est gardé', 'écran=' + e);
      });
      await essaie('A3 · balayer au doigt DANS le formulaire eBay', async () => {
        const inp = await ouvrirFormulaire(pg);
        const c = await pg.evaluate(() => { const f = document.querySelector('[data-publier-brouillon-id]'); const s = f && [...f.querySelectorAll('span')].find((x) => /^N°401$/.test((x.textContent || '').trim())); if (!s) return null; s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return { x: r.left + 4, y: r.top + r.height / 2 }; });
        dit(!!c, 'A3 · le texte « N°401 » du formulaire est trouvé');
        if (c) await glisserDoigt(pg, cdp, c.x, c.y, 230);
        const e = await ecran(pg);
        dit(e !== 'vestiaire', 'A3 · un balayage parti du formulaire eBay ne mène PAS à Vestiaire', 'écran=' + e);
        dit(e === 'ebay' && (await valeur(pg, inp)) === 'Titre tapé à la main', 'A3 · … le formulaire en cours n\'est jamais quitté par un geste (titre gardé)', 'écran=' + e);
      });
      await essaie('A4 · un vrai balayage depuis l\'en-tête eBay (formulaire fermé)', async () => {
        await allerEbay(pg);
        const c = await pg.evaluate(() => { const h = document.querySelector('section[aria-label="eBay"] .vrm-market-heading'); if (!h) return null; h.scrollIntoView({ block: 'center' }); const r = h.getBoundingClientRect(); return { x: r.left + Math.min(150, r.width / 2), y: r.top + r.height / 2 }; });
        if (c) await glisserDoigt(pg, cdp, c.x - 60, c.y, 200);
        const e = await ecran(pg);
        dit(e !== 'vestiaire', 'A4 · balayer vers la droite depuis eBay ne mène PAS à Vestiaire', 'écran=' + e);
        dit(e === 'leboncoin', 'A4 · … il mène au voisin VISIBLE dans la barre : Leboncoin (le balayage marche toujours)', 'écran=' + e);
      });
      dit(errs.length === 0, 'A · aucune erreur de page', errs.slice(0, 2).join(' | '));
      await ctx.close();
    }

    // ── B. ORDINATEUR (1512 px, souris et clavier) ──────────────────────────
    if (SECTIONS.includes('B')) {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 });
      await essaie('B1 · presser un bouton de section eBay et glisser', async () => {
        await allerEbay(pg, 'annonces');
        const c = await centre(pg, 'section[aria-label="eBay"] [data-section="ventes"]');
        await glisserSouris(pg, c.x, c.y, 240);
        const e = await ecran(pg);
        dit(e !== 'vestiaire', 'B1 · presser un bouton eBay en glissant ne mène PAS à Vestiaire', 'écran=' + e);
        dit(e === 'ebay', 'B1 · … presser un bouton n\'est jamais changer d\'onglet', 'écran=' + e);
      });
      await essaie('B2 · sélectionner du texte dans le formulaire eBay', async () => {
        const inp = await ouvrirFormulaire(pg);
        const c = await pg.evaluate(() => { const f = document.querySelector('[data-publier-brouillon-id]'); const s = f && [...f.querySelectorAll('span')].find((x) => /^N°401$/.test((x.textContent || '').trim())); if (!s) return null; s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return { x: r.left + 2, y: r.top + r.height / 2 }; });
        if (c) await glisserSouris(pg, c.x, c.y, 260);
        const e = await ecran(pg);
        dit(e !== 'vestiaire', 'B2 · sélectionner du texte dans le formulaire eBay ne mène PAS à Vestiaire', 'écran=' + e);
        dit(e === 'ebay' && (await valeur(pg, inp)) === 'Titre tapé à la main', 'B2 · … le formulaire reste ouvert, le titre gardé', 'écran=' + e);
      });
      await essaie('B3 · flèche ← pendant que le formulaire eBay est ouvert', async () => {
        const inp = await ouvrirFormulaire(pg);
        // Le clic sur un bouton du formulaire (retirer une photo) : le focus
        // retombe sur la page, puis ← — le geste le plus banal au clavier.
        await pg.click('[data-publier-brouillon-id] button[aria-label="Retirer"]', { timeout: 5000 });
        await pg.waitForTimeout(200);
        await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(500);
        const e = await ecran(pg);
        dit(e !== 'vestiaire', 'B3 · ← avec le formulaire eBay ouvert ne mène PAS à Vestiaire', 'écran=' + e);
        dit(e === 'ebay' && (await valeur(pg, inp)) === 'Titre tapé à la main', 'B3 · … et ne fait pas perdre le formulaire', 'écran=' + e);
      });
      await essaie('B4 · flèche ← après un clic sur une section eBay (formulaire fermé)', async () => {
        await allerEbay(pg, 'ventes');
        await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(500);
        const e = await ecran(pg);
        dit(e !== 'vestiaire', 'B4 · ← depuis eBay ne mène PAS à Vestiaire', 'écran=' + e);
      });
      await essaie('B5 · glisser la souris depuis l\'en-tête eBay (formulaire fermé)', async () => {
        await allerEbay(pg);
        const c = await pg.evaluate(() => { const h = document.querySelector('section[aria-label="eBay"] .vrm-market-heading'); if (!h) return null; h.scrollIntoView({ block: 'center' }); const r = h.getBoundingClientRect(); return { x: r.left + Math.min(200, r.width / 3), y: r.top + r.height / 2 }; });
        if (c) await glisserSouris(pg, c.x, c.y, 260);
        const e = await ecran(pg);
        dit(e !== 'vestiaire', 'B5 · glisser à la souris depuis eBay ne mène PAS à Vestiaire', 'écran=' + e);
        dit(e === 'leboncoin', 'B5 · … il mène au voisin VISIBLE : Leboncoin (le geste demandé en septembre marche toujours)', 'écran=' + e);
      });
      await essaie('B6 · flèches depuis Leboncoin et au bout de la barre', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=plat_leboncoin`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('section[aria-label="Leboncoin"]', { timeout: 15000 }); await pg.waitForTimeout(800);
        await pg.evaluate(() => { try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (_) {} });
        await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(500);
        const e1 = await ecran(pg);
        dit(e1 === 'ebay', 'B6 · → depuis Leboncoin mène à eBay, son voisin visible (jamais Vestiaire)', 'écran=' + e1);
        await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(500);
        const e2 = await ecran(pg);
        dit(e2 === 'ebay', 'B6 · → depuis eBay (dernier de la barre) reste sur eBay', 'écran=' + e2);
      });
      dit(errs.length === 0, 'B · aucune erreur de page', errs.slice(0, 2).join(' | '));
      await ctx.close();
    }

    // ── C. CHAQUE BOUTON DU FLUX eBay (deux comptes, réponses lentes) ────────
    if (SECTIONS.includes('C')) {
      vestiaire.requetes.length = 0; vestiaire.ecritures.length = 0; vestiaire.messages.length = 0;
      for (const [vp, mode, max] of [[{ width: 1512, height: 950 }, 'double', 30], [{ width: 390, height: 844 }, 'simple', 18]]) {
        const { ctx, pg, errs } = await ouvrir(b, vp, { lent: 350 });
        let n = 0; const sorties = []; const parSection = {};
        // `formulaire` : le formulaire « Vendre une paire sur eBay » OUVERT, la
        // paire choisie — c'est le flux de la plainte. On y clique chaque bouton.
        for (const section of ['ventes', 'annonces', 'formulaire', 'messages', 'offres', 'agent', 'compte']) {
          const zone = section === 'formulaire' ? '[data-publier-brouillon-id]' : 'section[aria-label="eBay"]';
          const revenir = async () => { if (section === 'formulaire') await ouvrirFormulaire(pg); else await allerEbay(pg, section); };
          await essaie(`C · section ${section} (${vp.width} px)`, async () => {
            await revenir();
            const total = await pg.$$eval(`${zone} button:not([disabled])`, (l) => l.length);
            parSection[section] = 0;
            for (let i = 0; i < Math.min(total, max); i++) {
              const ok = await pg.evaluate(([i, z]) => {
                const l = [...document.querySelectorAll(`${z} button:not([disabled])`)];
                const el = l[i]; if (!el) return false;
                // La navigation des sections n'est pas « le flux » : sautée.
                if (el.closest('nav[aria-label="Sections de la plateforme"]')) return false;
                el.setAttribute('data-banc-cible', '1'); el.scrollIntoView({ block: 'center' }); return true;
              }, [i, zone]);
              if (!ok) continue;
              try {
                if (mode === 'double') await pg.dblclick('[data-banc-cible]', { timeout: 1500 });
                else await pg.tap('[data-banc-cible]', { timeout: 1500 });
              } catch (_) {}
              n++; parSection[section]++;
              await pg.waitForTimeout(450);
              const e = await ecran(pg);
              if (e === 'vestiaire') sorties.push(`${section}#${i}`);
              // On referme ce qui a pu s'ouvrir (confirmation, menu) et on revient.
              await pg.keyboard.press('Escape').catch(() => {});
              const annuler = await pg.$('button:has-text("Annuler")'); if (annuler) await annuler.click({ timeout: 800 }).catch(() => {});
              await pg.evaluate(() => { const c = document.querySelector('[data-banc-cible]'); if (c) c.removeAttribute('data-banc-cible'); });
              if (e !== 'ebay' || !(await pg.$(zone))) await revenir();
            }
          });
        }
        dit(n >= 20 && parSection.formulaire >= 6, `C · ${n} boutons du flux eBay cliqués (${mode === 'double' ? 'double clic, souris' : 'au doigt'}, ${vp.width} px, 2 comptes eBay, réponses lentes)`, JSON.stringify(parSection));
        dit(sorties.length === 0, `C · aucun de ces clics ne mène à Vestiaire (${vp.width} px)`, sorties.slice(0, 5).join(', '));
        const msgs = await pg.evaluate(() => (window.__msgs || []).filter((m) => /vestiaire|plat_vestiaire|"vc"/i.test(m))).catch(() => []);
        vestiaire.messages.push(...msgs);
        dit(errs.length === 0, `C · aucune erreur de page (${vp.width} px)`, errs.slice(0, 2).join(' | '));
        await ctx.close();
      }
      dit(vestiaire.requetes.length === 0, 'C · AUCUNE requête n\'est partie vers Vestiaire', vestiaire.requetes.slice(0, 3).join(' | '));
      dit(vestiaire.ecritures.length === 0, 'C · AUCUNE écriture en base ne parle de Vestiaire', vestiaire.ecritures.slice(0, 3).join(' | '));
      dit(vestiaire.messages.length === 0, 'C · AUCUN message au pont de l\'extension ne parle de Vestiaire', vestiaire.messages.slice(0, 2).join(' | '));
    }

    // ── D. L'AUTRE SENS : Vestiaire s'ouvre par SON bouton, et ne publie rien ─
    if (SECTIONS.includes('D')) {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 });
      await essaie('D · le bouton « Vestiaire » de « Autres plateformes »', async () => {
        await allerEbay(pg);
        await pg.click('nav.vrm-sidebar summary:has-text("Autres plateformes")', { timeout: 5000 });
        await pg.click('nav.vrm-sidebar button:has-text("Vestiaire")', { timeout: 5000 });
        await pg.waitForTimeout(1200);
        const e = await ecran(pg);
        dit(e === 'vestiaire', 'D · cliquer « Vestiaire » ouvre bien l\'écran Vestiaire Collective', 'écran=' + e);
        const pub = await pg.evaluate(() => [...document.querySelectorAll('main button')].filter((x) => /publi|mettre en vente|vendre|pr[ée]parer/i.test(x.textContent || '')).map((x) => x.textContent.trim().slice(0, 40)));
        dit(pub.length === 0, 'D · l\'écran Vestiaire ne porte AUCUN bouton qui publierait ou préparerait une annonce', pub.join(' | '));
      });
      dit(errs.length === 0, 'D · aucune erreur de page', errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
  } finally {
    await b.close();
    srv.close();
  }
  console.log(`\n${ko === 0 ? 'OK' : 'KO'} — ${ko} contrôle(s) en échec`);
  process.exit(ko ? 1 : 0);
})();
