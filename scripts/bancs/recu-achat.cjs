// ═════════════════════════════════════════════════════════════════════════════
//  LE REÇU D'ACHAT (23 octobre)
//
//  Julien, capture iPhone (Vinted → Achats → ⋯ → « Reçu d'achat ») : « le reçu
//  s'affiche mal ». La feuille était rendue SOUS la barre du bas (« N° de
//  transaction » coupé, la fin du reçu inatteignable), et ses lignes ne
//  faisaient pas le total (24,93 € payés, 20,00 + 3,23 affichés : la ligne
//  « Frais Vinted 1,70 € » était perdue). Et des emails « Commande mise à jour
//  pour … » s'appelaient « Reçu d'achat ».
//
//  Base INVENTÉE à la forme mesurée (117 lignes `email_achat_*` en lecture
//  seule) : aucune vraie donnée, ce banc vit dans le dépôt. La requête de l'app
//  (`id=like.email_achat_*&select=id,data`) est servie avec SA projection.
//  390 px tactile clair, 390 px tactile sombre, 1512 px. Il juge :
//    A. la liste « Reçus d'achat par email » ne montre que les 4 vrais reçus,
//       et DIT combien d'autres emails n'en sont pas (sans les lister) ;
//    B. la feuille est hors de <main>, AU-DESSUS de la barre du bas : le point
//       au bas de la feuille est la feuille, pas la barre ;
//    C. on fait défiler le reçu jusqu'au bout : « N° de transaction » et la
//       dernière ligne se lisent, dans l'écran, sans la barre par-dessus ;
//    D. les lignes font le total (Frais Vinted, Protection acheteurs, Réduction
//       négative) ; une somme fausse est DITE ; la fenêtre PDF porte les MÊMES
//       lignes ;
//    E. le menu ⋯ d'un achat ne propose « Reçu d'achat (Vinted) » que pour un
//       vrai reçu, relié par le n° de transaction (jamais un email de statut ni
//       le reçu d'un autre achat au même titre) ;
//    F. « ‹ » et « PDF » font 44 px affichés ; Échap, « ‹ » et le retour du
//       navigateur ferment la feuille ; en sombre, la feuille est sombre et le
//       montant se lit.
//
//  Lancer : npm run build && NODE_OPTIONS="--require /tmp/claude-0/redir-pw.cjs" \
//           BANC_PORT=9201 node scripts/bancs/recu-achat.cjs
//  (ports réservés à ce banc : 9201 à 9210)
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9201;
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const auj = new Date();
const jour = (n) => new Date(auj.getTime() - n * 86400000).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const achat = (tx, titre, prix, d) => ({ transaction_id: tx, title: titre, price: { amount: String(prix), currency_code: 'EUR' },
  status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: jour(d) });
const ACHATS = [
  achat(23400000001, 'Basket banc taille 42', 24.93, 2),      // son reçu porte ce n° dans le texte
  achat(23400000002, 'Mocassin banc taille 41', 31, 3),       // un email « Commande mise à jour » à son titre, AUCUN reçu
  achat(23400000003, 'Sandale banc taille 38', 13.3, 4),      // un reçu au même titre… pour un AUTRE n° de transaction
];
// Un reçu à la forme MESURÉE (astérisques, espaces de fin, « *N° de transaction* »),
// avec le champ `transaction` vide — comme les 81 de la base.
const recu = (article, montant, lignes, tx, mode = 'Visa, **********4242') => [
  'E-mail Vinted', '', 'Bonjour compte_banc,', '', '*Ton paiement a été reçu. *', '', 'Voici les détails de ta commande :',
  '*Vendeur* vendeur_banc', '*Commande*', '', article,
  `*Montant payé* ${montant} € `, ...lignes,
  `*Mode de paiement* ${mode} (${montant} €) `, '*Date du paiement* 21/10/2026 10 h 47 ', `*N° de transaction* ${tx} `, '',
  "Nous t'enverrons un message dès que vendeur_banc aura expédié l'article.",
  "Le vendeur a jusqu'à 5 jours pour envoyer le colis.", ''].join('\n');
const ligneRecu = (id, d) => ({ id: `email_achat_${id}`, data: { type: 'achat', pdfB64: null, filename: null, account: '', uid: '', transaction: '', ...d } });
const ROWS = [
  { id: 'main', data: {} },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: ACHATS } } },
  // R1 — le cas de la capture : 20,00 + 3,23 + 1,70 = 24,93 €
  ligneRecu('r1', { subject: 'Ton reçu pour la commande « Basket banc taille 42 »', article: 'Basket banc taille 42', prix: '24,93', receivedAt: jour(2),
    texte: recu('Basket banc taille 42', '24,93', ['Article 20,00 € ', 'Frais de port 3,23 € ', 'Frais Vinted 1,70 € '], '23400000001') }),
  // R2 — l'ancienne forme : lignes vides, Protection acheteurs, Réduction négative
  ligneRecu('r2', { subject: 'Ton reçu pour la commande « Chaussure ancienne banc »', article: 'Chaussure ancienne banc', prix: '12,10', receivedAt: jour(60),
    texte: recu('Chaussure ancienne banc', '12,10', ['Article 9,00 € ', 'Frais de port 3,23 € ', '', 'Frais de Protection acheteurs 1,15 € ', '', 'Réduction -1,28 € ', ''], '23411112222', 'le porte-monnaie Vinted') }),
  // R3 — même titre que l'achat 23400000003, mais le reçu d'un AUTRE achat
  ligneRecu('r3', { subject: 'Ton reçu pour la commande « Sandale banc taille 38 »', article: 'Sandale banc taille 38', prix: '13,30', receivedAt: jour(8),
    texte: recu('Sandale banc taille 38', '13,30', ['Article 12,00 € ', 'Frais de port 3,79 € ', 'Frais Vinted 1,30 € ', 'Réduction -3,79 € '], '23499999999', 'MasterCard, **********0275') }),
  // R4 — une somme qui ne tombe pas juste (forme inventée) : la feuille doit le DIRE
  ligneRecu('r4', { subject: 'Ton reçu pour la commande « Botte banc ecart »', article: 'Botte banc ecart', prix: '30,00', receivedAt: jour(9),
    texte: recu('Botte banc ecart', '30,00', ['Article 20,00 € ', 'Frais de port 3,23 € '], '23455556666') }),
  // N1, N2 — des emails de STATUT rangés là par l'ancien tri : ce ne sont PAS des reçus
  ligneRecu('n1', { subject: 'Commande mise à jour pour Mocassin banc taille 41', article: 'Mocassin banc taille 41', prix: '', receivedAt: jour(70),
    texte: 'Bonjour,\n\nIl te reste 48 heures pour confirmer que tout est en ordre avec ta commande\n\nAller sur la commande\n' }),
  ligneRecu('n2', { subject: 'Mocassin banc taille 41 - Confirmation requise', article: 'est conforme à sa', prix: '', receivedAt: jour(71),
    texte: 'Bonjour compte_banc,\n\nIl a été indiqué que ta commande a été livrée.\n\nSi tu as bien reçu ta commande et que l’article est conforme à sa\ndescription, confirme-le.\n' }),
];

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
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=… (9201 à 9210)'); process.exit(1); });
srv.listen(PORT);

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 180)); } };

async function preparer(b, vp, sombre) {
  const mobile = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, !!sombre);
  // ⚠️ L'IPHONE, REJOUÉ. Sur iPhone (WebKit), `<main>` — qui défile, avec
  // `-webkit-overflow-scrolling:touch` — forme un contexte d'empilement : une
  // feuille `position:fixed` rendue DEDANS reste sous la barre du bas, quel que
  // soit son z-index (capture de Julien, et le commentaire du récap « Wrapped »).
  // Chromium ne le fait pas : sans cette ligne, le banc serait vert sur le
  // défaut. On impose donc à `<main>` le contexte d'empilement que WebKit lui
  // donne — sur téléphone seulement (sur ordinateur, il n'y a pas de barre).
  if (mobile) await pg.addInitScript(() => { const poser = () => { const st = document.createElement('style'); st.textContent = '.vrm-main{isolation:isolate}'; document.head.appendChild(st); }; if (document.head) poser(); else document.addEventListener('DOMContentLoaded', poser); });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await ctx.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel === 'data,updated_at,cap:data->>capturedAt') ? ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt }) : (sel ? projette(r, sel) : r);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-recus-email]').waitFor({ timeout: 20000 });
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs };
}

const DIALOG = '[role="dialog"][aria-label="Reçu d\'achat"]';
// Ce que la feuille montre, lu dans le DOM (attributs, et repli sur le texte).
const lireFeuille = (pg) => pg.evaluate((sel) => {
  const d = document.querySelector(sel); if (!d) return null;
  const lignes = [...d.querySelectorAll('[data-recu-ligne]')].map((e) => ({ libelle: e.getAttribute('data-recu-ligne'), centimes: e.getAttribute('data-recu-centimes') === '' ? null : Number(e.getAttribute('data-recu-centimes')) }));
  const tot = d.querySelector('[data-recu-total]');
  const som = d.querySelector('[data-recu-somme]');
  const tx = d.querySelector('[data-recu-transaction]');
  return { texte: d.innerText, lignes, total: tot ? Number(tot.getAttribute('data-recu-total')) : null,
    somme: som ? som.getAttribute('data-recu-somme') : null, phraseVisible: !!(som && !som.hidden && som.offsetHeight > 0), phrase: som ? som.textContent : '',
    transaction: tx ? tx.getAttribute('data-recu-transaction') : null, dansMain: !!d.closest('main, .vrm-main') };
}, DIALOG);

// Un point est-il DANS la feuille (et pas dans la barre du bas) ?
const pointDans = (pg, x, y) => pg.evaluate(({ sel, x, y }) => {
  const d = document.querySelector(sel); const el = document.elementFromPoint(x, y);
  return { dans: !!(d && el && d.contains(el)), barre: !!(el && el.closest('.vrm-tabbar, .vrm-mobile-nav')), quoi: el ? (el.className && String(el.className).slice(0, 40)) || el.tagName : 'rien' };
}, { sel: DIALOG, x, y });

async function ouvrirDepuisListe(pg, motif) {
  const recus = pg.locator('[data-recus-email]');
  if (!(await recus.evaluate((e) => e.open))) await recus.locator('summary').click();
  await recus.getByRole('button', { name: motif }).first().click();
  await pg.locator(DIALOG).waitFor({ timeout: 8000 });
  await pg.waitForTimeout(400);
}
async function fermerParEchap(pg) {
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(500);
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const VUES = [
      // 390 × 560 : l'écran visible d'un petit iPhone, barres de Safari
      // affichées — le reçu y DOIT défiler (sinon le contrôle « jusqu'au bout »
      // ne mesurerait rien). 390 × 700 en sombre.
      { nom: '390 tactile clair', vp: { width: 390, height: 560 }, sombre: false, defile: true },
      { nom: '390 tactile sombre', vp: { width: 390, height: 700 }, sombre: true },
      { nom: '1512 clair', vp: { width: 1512, height: 950 }, sombre: false },
    ];
    for (const V of VUES) {
      console.log(`── ${V.nom}`);
      const { ctx, pg, errs } = await preparer(b, V.vp, V.sombre);
      const mobile = V.vp.width < 600;

      // ── A. La liste ──────────────────────────────────────────────────────
      await essaie('A. liste', async () => {
        const recus = pg.locator('[data-recus-email]');
        await recus.locator('summary').click();
        await pg.waitForTimeout(400);
        const noms = await recus.locator('li > button strong').allInnerTexts();
        dit(noms.length === 4 && noms.every((n) => !/Mocassin|est conforme/.test(n)), 'A. la liste montre les 4 vrais reçus — aucun email « Commande mise à jour » / « Confirmation requise »', JSON.stringify(noms));
        const autres = await recus.getAttribute('data-recus-autres').catch(() => null) || await recus.locator('[data-recus-autres]').getAttribute('data-recus-autres').catch(() => null);
        dit(autres === '2', 'A. la liste DIT que 2 autres emails ne sont pas des reçus (ils ne disparaissent pas en silence)', String(autres));
      });

      // ── B, C, D, F. Le reçu de la capture (R1) ───────────────────────────
      await essaie('B-F. reçu de la capture', async () => {
        await ouvrirDepuisListe(pg, /Basket banc taille 42/);
        const f = await lireFeuille(pg);
        dit(f && !f.dansMain, 'B. la feuille n’est PAS dans <main> (portée sur <body>)');
        const r = await pg.locator(DIALOG).boundingBox();
        const barre = await pg.evaluate(() => { const n = [...document.querySelectorAll('.vrm-tabbar')].find((e) => e.offsetHeight > 0); if (!n) return null; const q = n.getBoundingClientRect(); return { top: q.top, bottom: q.bottom }; });
        if (mobile) dit(!!barre, 'B. la barre du bas est bien là sur téléphone (sinon le contrôle ne mesure rien)', JSON.stringify(barre));
        const bas = await pointDans(pg, r.x + r.width / 2, Math.min(r.y + r.height, V.vp.height) - 6);
        dit(bas.dans && !bas.barre, 'B. le bas de la feuille est la feuille, pas la barre du bas', JSON.stringify(bas));
        // D. les lignes
        dit(f && JSON.stringify(f.lignes.map((l) => l.libelle)) === JSON.stringify(['Article', 'Frais de port', 'Frais Vinted']), 'D. les 3 lignes du reçu, « Frais Vinted » comprise', f && JSON.stringify(f.lignes));
        const somme = f ? f.lignes.reduce((s, l) => s + (l.centimes || 0), 0) : -1;
        dit(f && f.total === 2493 && somme === 2493 && f.somme === 'juste', 'D. 20,00 + 3,23 + 1,70 = 24,93 € (les lignes font le Montant payé)', f && `total=${f.total} somme=${somme} ${f.somme}`);
        dit(f && /Frais Vinted/.test(f.texte) && /1,70/.test(f.texte), 'D. « Frais Vinted 1,70 € » se lit dans la feuille', '');
        dit(f && !f.phraseVisible, 'D. aucune phrase d’écart quand tout tombe juste');
        dit(f && /Visa •••• 4242/.test(f.texte) && !/Visa, 4242/.test(f.texte), 'la carte se lit « Visa •••• 4242 » (plus « Visa, 4242 »)');
        // C. défiler jusqu'au bout
        const fin = await pg.evaluate((sel) => {
          const d = document.querySelector(sel); if (!d) return null;
          const sc = [...d.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
          if (sc) sc.scrollTop = sc.scrollHeight;
          return !!sc;
        }, DIALOG);
        await pg.waitForTimeout(300);
        const cibles = await pg.evaluate((sel) => {
          const d = document.querySelector(sel); if (!d) return null;
          const trouver = (re) => [...d.querySelectorAll('div,span')].filter((e) => re.test(e.textContent || '') && !e.children.length).pop();
          const tx = trouver(/^N° de transaction$/); const der = trouver(/Reçu reconstruit depuis l/);
          const box = (e) => { if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, bas: q.bottom }; };
          return { tx: box(tx), der: box(der), h: innerHeight };
        }, DIALOG);
        if (V.defile) dit(fin === true, 'C. sur téléphone le reçu dépasse l’écran : il défile (le contrôle suivant mesure quelque chose)', String(fin));
        for (const [nom, c] of [['« N° de transaction »', cibles && cibles.tx], ['la dernière ligne du reçu', cibles && cibles.der]]) {
          const p = c ? await pointDans(pg, c.x, c.y) : null;
          dit(c && c.bas <= cibles.h + 1 && p && p.dans && !p.barre, `C. ${nom} se lit en faisant défiler, sans la barre par-dessus`, JSON.stringify({ c, p, defile: fin }));
        }
        // F. les cibles
        const tailles = await pg.evaluate((sel) => {
          const d = document.querySelector(sel); if (!d) return null;
          const btn = [...d.querySelectorAll('button')];
          const r = (e) => e ? (({ width, height }) => ({ w: Math.round(width), h: Math.round(height) }))(e.getBoundingClientRect()) : null;
          return { retour: r(btn.find((e) => e.getAttribute('aria-label') === 'Retour')), pdf: r(btn.find((e) => /PDF/.test(e.textContent || ''))) };
        }, DIALOG);
        dit(tailles && tailles.retour && tailles.retour.w >= 44 && tailles.retour.h >= 44, 'F. « ‹ » fait 44 px affichés', JSON.stringify(tailles && tailles.retour));
        dit(tailles && tailles.pdf && tailles.pdf.h >= 44, 'F. « PDF » fait 44 px affichés', JSON.stringify(tailles && tailles.pdf));
        if (V.sombre) {
          const c = await pg.evaluate((sel) => {
            const d = document.querySelector(sel); const lum = (s) => { const m = String(s).match(/\d+(\.\d+)?/g); if (!m) return 1; const [r, g, b] = m.slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
            const tot = d.querySelector('[data-recu-total] span:last-child');
            const fond = (e) => { while (e) { const bg = getComputedStyle(e).backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg; e = e.parentElement; } return 'rgb(255,255,255)'; };
            const L1 = lum(getComputedStyle(tot).color), L2 = lum(fond(tot));
            return { fond: lum(getComputedStyle(d).backgroundColor), contraste: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05) };
          }, DIALOG);
          dit(c.fond < 0.08, 'F. en sombre, la feuille est sombre', JSON.stringify(c));
          dit(c.contraste >= 4.5, 'F. en sombre, le montant payé se lit (contraste ≥ 4,5)', c.contraste.toFixed(2));
        }
        // D. la fenêtre PDF porte les MÊMES lignes
        const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }), pg.locator(DIALOG).getByRole('button', { name: /PDF/ }).click()]);
        await popup.waitForLoadState('domcontentloaded').catch(() => {});
        await popup.waitForTimeout(400);
        const pdf = await popup.evaluate(() => ({ lignes: [...document.querySelectorAll('[data-recu-ligne]')].map((e) => ({ libelle: e.getAttribute('data-recu-ligne'), centimes: e.getAttribute('data-recu-centimes') === '' ? null : Number(e.getAttribute('data-recu-centimes')) })), somme: (document.querySelector('[data-recu-somme]') || {}).getAttribute ? document.querySelector('[data-recu-somme]').getAttribute('data-recu-somme') : null, texte: document.body.innerText }));
        dit(JSON.stringify(pdf.lignes) === JSON.stringify(f && f.lignes) && pdf.somme === 'juste', 'D. la fenêtre PDF porte les MÊMES lignes que la feuille (§11)', JSON.stringify(pdf.lignes) + ' ' + pdf.somme);
        dit(/Frais Vinted/.test(pdf.texte) && /1,70/.test(pdf.texte), 'D. « Frais Vinted 1,70 € » est dans la fenêtre PDF');
        if (process.env.CAPTURES) { fs.mkdirSync(process.env.CAPTURES, { recursive: true }); await popup.screenshot({ path: path.join(process.env.CAPTURES, `recu-pdf-${V.vp.width}${V.sombre ? '-sombre' : ''}.png`) }).catch(() => {}); }
        await popup.close();
        // F. fermer : Échap
        await pg.bringToFront();
        await pg.locator(DIALOG).focus().catch(() => {});
        await fermerParEchap(pg);
        dit(await pg.locator(DIALOG).count() === 0, 'F. Échap ferme la feuille');
      });

      // F. « ‹ » et le retour du navigateur
      await essaie('F. fermer', async () => {
        await ouvrirDepuisListe(pg, /Basket banc taille 42/);
        await pg.locator(DIALOG).getByRole('button', { name: 'Retour', exact: true }).click();
        await pg.waitForTimeout(500);
        dit(await pg.locator(DIALOG).count() === 0, 'F. « ‹ » ferme la feuille');
        await pg.waitForTimeout(400);
        await ouvrirDepuisListe(pg, /Basket banc taille 42/);
        await pg.goBack().catch(() => {});
        await pg.waitForTimeout(800);
        dit(await pg.locator(DIALOG).count() === 0 && await pg.locator('[data-recus-email]').count() === 1, 'F. le retour du navigateur ferme la feuille, et reste sur Achats');
      });

      // ── D. L'ancienne forme (R2) et la somme fausse (R4) ─────────────────
      await essaie('D. ancienne forme', async () => {
        await ouvrirDepuisListe(pg, /Chaussure ancienne banc/);
        const f = await lireFeuille(pg);
        dit(f && JSON.stringify(f.lignes) === JSON.stringify([{ libelle: 'Article', centimes: 900 }, { libelle: 'Frais de port', centimes: 323 }, { libelle: 'Frais de Protection acheteurs', centimes: 115 }, { libelle: 'Réduction', centimes: -128 }]) && f.somme === 'juste' && f.total === 1210,
          'D. l’ancienne forme : Protection acheteurs ET Réduction négative, la somme tombe juste', f && JSON.stringify(f.lignes) + ' ' + f.somme);
        dit(f && /−1,28/.test(f.texte), 'D. la réduction s’écrit « −1,28 € »');
        await fermerParEchap(pg);
      });
      await essaie('D. somme fausse', async () => {
        await ouvrirDepuisListe(pg, /Botte banc ecart/);
        const f = await lireFeuille(pg);
        dit(f && f.somme === 'ecart' && f.phraseVisible && /regarde l'email de Vinted/.test(f.phrase), 'D. des lignes qui ne font pas le total : la feuille le DIT', f && `${f.somme} ${JSON.stringify(f.phrase)}`);
        await fermerParEchap(pg);
      });

      // ── E. Le menu ⋯ d'un achat ─────────────────────────────────────────
      await essaie('E. menu', async () => {
        const tous = pg.locator('button', { hasText: /^Tous$/ });
        await tous.first().click();
        await pg.waitForTimeout(500);
        const libelleMenu = async (tx) => {
          const carte = pg.locator(`[data-achat-tx="${tx}"]`);
          await carte.waitFor({ timeout: 8000 });
          await carte.locator('button[title="Actions rapides"]').first().click();
          await pg.waitForTimeout(250);
          const items = await carte.locator('[role="menuitem"]').allInnerTexts();
          return items;
        };
        // Le menu se ferme par son voile (le frère qui le précède), comme au doigt.
        const fermerMenu = async () => { await pg.evaluate(() => { const m = document.querySelector('[role="menu"].vrm-buy-menu'); if (m && m.previousElementSibling) m.previousElementSibling.click(); }); await pg.waitForTimeout(300); };
        const m1 = await libelleMenu(23400000001);
        dit(m1.some((t) => /Reçu d'achat \(Vinted\)/.test(t)), 'E. l’achat dont le reçu porte son n° de transaction propose « Reçu d’achat (Vinted) »', JSON.stringify(m1));
        const item = pg.locator('[data-achat-tx="23400000001"] [role="menuitem"]', { hasText: /Reçu d'achat \(Vinted\)/ });
        if (await item.count()) {
          await item.first().click();
          await pg.locator(DIALOG).waitFor({ timeout: 8000 });
          const f = await lireFeuille(pg);
          dit(f && /23400000001/.test(f.texte) && f.somme === 'juste', 'E. … et c’est SON reçu qui s’ouvre (n° 23400000001)', f && (f.transaction || ''));
          await fermerParEchap(pg);
        }
        await fermerMenu();
        const m2 = await libelleMenu(23400000002);
        dit(!m2.some((t) => /Reçu d'achat/.test(t)), 'E. un email « Commande mise à jour pour … » au titre de l’achat n’est PAS proposé comme reçu', JSON.stringify(m2));
        await fermerMenu();
        const m3 = await libelleMenu(23400000003);
        dit(!m3.some((t) => /Reçu d'achat/.test(t)), 'E. le reçu d’un AUTRE achat au même titre (autre n° de transaction) n’est pas proposé (§5)', JSON.stringify(m3));
        await fermerMenu();
      });

      await essaie('fin', async () => {
        const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 200));
      });
      if (process.env.CAPTURES) {
        fs.mkdirSync(process.env.CAPTURES, { recursive: true });
        await ouvrirDepuisListe(pg, /Basket banc taille 42/).catch(() => {});
        await pg.screenshot({ path: path.join(process.env.CAPTURES, `recu-${V.vp.width}${V.sombre ? '-sombre' : ''}.png`) });
        await pg.evaluate((sel) => { const d = document.querySelector(sel); const sc = d && [...d.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)); if (sc) sc.scrollTop = sc.scrollHeight; }, DIALOG).catch(() => {});
        await pg.waitForTimeout(300);
        await pg.screenshot({ path: path.join(process.env.CAPTURES, `recu-${V.vp.width}${V.sombre ? '-sombre' : ''}-bas.png`) });
      }
      await ctx.close();
    }
  } catch (e) {
    ko++; console.log('  ❌ le banc a levé : ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' '));
  } finally {
    if (b) await b.close().catch(() => {});
    srv.close();
    console.log(`\n${ok} ✅ · ${ko} ❌`);
    process.exit(ko ? 1 : 0);
  }
})();
