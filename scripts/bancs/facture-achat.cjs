// ═════════════════════════════════════════════════════════════════════════════
//  « FACTURE REÇUE PAR EMAIL » SUR CHAQUE ACHAT (29 octobre)
//
//  Julien : « Essaie pour les achats de mettre en place les factures si tu les
//  reçois par mail. » Vinted envoie, pour chaque achat, un reçu par email
//  (« Ton reçu pour la commande « … » ») — mesuré : 81 reçus, tous avec leur
//  « *N° de transaction* … », aucun PDF joint. Le reçu n'était atteignable que
//  par le menu ⋯ de l'achat (ou l'archive en bas d'Achats).
//
//  Base INVENTÉE à la forme mesurée : aucune vraie donnée, ce banc vit dans le
//  dépôt. 390 px tactile (iPhone), 390 px tactile sombre, 1512 px. Il juge :
//    A. l'achat dont un reçu porte SON n° de transaction montre « Facture reçue
//       par email » SUR SA LIGNE (pas seulement dans le menu) ;
//    B. un reçu au MÊME TITRE mais sans n°, ou avec le n° d'un AUTRE achat, ne
//       se relie pas (§5) ; un achat sans reçu ne montre rien ;
//    C. un reçu qui porte un PDF joint est relié (« pdf »), et deux lignes pour
//       le MÊME n° (un email reçu deux fois) ne font qu'UN reçu relié ;
//    D. §4.4 : la liste ne rapatrie JAMAIS `pdfB64` (ni `select=data`) ; les
//       octets ne partent qu'au clic sur « PDF joint à l'email » ;
//    E. le clic ouvre SON reçu (n° de transaction lu dans la feuille) ;
//    F. le PDF joint s'ouvre dans la visionneuse (ordinateur) ou par un lien
//       (iPhone) ;
//    G. au doigt, « Facture reçue par email » fait 44 px affichés et ne déborde
//       pas ; aucun débordement horizontal ; aucune erreur ;
//    H. l'archive dit combien de reçus sont reliés à leur achat (et combien ne
//       le sont pas) ;
//    I. « pas su » : les reçus ne se lisent pas (503) ⇒ aucun « Facture reçue
//       par email » inventé, et l'archive le dit.
//
//  Lancer : npm run build && NODE_OPTIONS="--require /tmp/claude-0/redir-pw.cjs" \
//           BANC_PORT=9341 node scripts/bancs/facture-achat.cjs
//  `BANC_DIST` : un autre build (preuve §6.1 et mutations).
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
require('./_porte-banc.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9341;
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const auj = new Date();
const jour = (n) => new Date(auj.getTime() - n * 86400000).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const achat = (tx, titre, prix, d) => ({ transaction_id: tx, title: titre, price: { amount: String(prix), currency_code: 'EUR' },
  status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: jour(d) });
const ACHATS = [
  achat(99990000111, 'Basket facture banc', 24.93, 2),      // son reçu porte ce n° dans le texte (champ vide, comme les 117 d'avant)
  achat(99990000222, 'Sandale jumelle banc', 31, 3),        // deux reçus AU MÊME TITRE : l'un sans n°, l'autre d'un AUTRE achat
  achat(99990000333, 'Botte pdf banc', 45.5, 4),            // son reçu porte un PDF joint, et l'email est arrivé deux fois
  achat(99990000444, 'Mocassin sans recu banc', 18, 5),     // aucun reçu
];
// Un reçu à la forme MESURÉE (astérisques, espaces de fin, « *N° de transaction* »).
const recu = (article, montant, lignes, tx) => [
  'E-mail Vinted', '', 'Bonjour compte_banc,', '', '*Ton paiement a été reçu. *', '', 'Reçu pour ta commande Vinted :',
  '*Vendeur* vendeur_banc', '*Commande*', '', article,
  `*Montant payé* ${montant} € `, ...lignes,
  `*Mode de paiement* Visa, **********4242 (${montant} €) `, '*Date du paiement* 21/10/2026 10 h 47 ', ...(tx ? [`*N° de transaction* ${tx} `] : []), '',
  "Nous t'enverrons un message dès que vendeur_banc aura expédié l'article.", ''].join('\n');
// Un PDF minuscule (les quatre octets « %PDF » d'abord, comme un vrai).
const PDF_B64 = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n').toString('base64');
const ligneRecu = (id, d) => ({ id: `email_achat_${id}`, data: { type: 'achat', pdfB64: null, filename: null, account: '', uid: '', transaction: '', ...d } });
const ROWS = [
  { id: 'main', data: {} },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: ACHATS } } },
  ligneRecu('h1a2b3', { subject: 'Ton reçu pour la commande « Basket facture banc »', article: 'Basket facture banc', prix: '24,93', receivedAt: jour(2),
    texte: recu('Basket facture banc', '24,93', ['Article 20,00 € ', 'Frais de port 3,23 € ', 'Frais Vinted 1,70 € '], '99990000111') }),
  // Même titre que l'achat 99990000222, mais SANS n° de transaction (une forme future) : ne désigne aucun achat.
  ligneRecu('h4c5d6', { subject: 'Ton reçu pour la commande « Sandale jumelle banc »', article: 'Sandale jumelle banc', prix: '31,00', receivedAt: jour(3),
    texte: recu('Sandale jumelle banc', '31,00', ['Article 27,00 € ', 'Frais de port 3,00 € ', 'Frais Vinted 1,00 € '], '') }),
  // Même titre, mais le reçu d'un AUTRE achat (n° 99990000999).
  ligneRecu('99990000999', { subject: 'Ton reçu pour la commande « Sandale jumelle banc »', article: 'Sandale jumelle banc', prix: '31,00', transaction: '99990000999', receivedAt: jour(9),
    texte: recu('Sandale jumelle banc', '31,00', ['Article 27,00 € ', 'Frais de port 3,00 € ', 'Frais Vinted 1,00 € '], '99990000999') }),
  // Le reçu de la botte, rangé par le serveur corrigé (clé = n°, champ rempli) AVEC un PDF joint…
  ligneRecu('99990000333', { subject: 'Ton reçu pour la commande « Botte pdf banc »', article: 'Botte pdf banc', prix: '45,50', transaction: '99990000333', receivedAt: jour(4),
    filename: 'recu-botte.pdf', pdfB64: PDF_B64,
    texte: recu('Botte pdf banc', '45,50', ['Article 40,00 € ', 'Frais de port 3,79 € ', 'Frais Vinted 1,71 € '], '99990000333') }),
  // … et le même email, rangé une première fois par l'ancien serveur (clé hachée, champ vide, sans PDF).
  ligneRecu('k7e8f9', { subject: 'Ton reçu pour la commande « Botte pdf banc »', article: 'Botte pdf banc', prix: '45,50', receivedAt: jour(5),
    texte: recu('Botte pdf banc', '45,50', ['Article 40,00 € ', 'Frais de port 3,79 € ', 'Frais Vinted 1,71 € '], '99990000333') }),
];

// La colonne `meta` de la base (`public.vrm_meta`) : les scalaires de premier
// niveau ≤ 600 caractères, et `_pdf` quand la ligne porte un PDF.
const metaDe = (row) => {
  const m = {};
  for (const [k, v] of Object.entries(row.data || {})) if (['string', 'number', 'boolean'].includes(typeof v) && JSON.stringify(v).length <= 600) m[k] = v;
  if (row.data && row.data.pdfB64) m._pdf = true;
  return m;
};
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const mm = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!mm) continue;
    const src = mm[2], alias = mm[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'meta') { out[alias] = metaDe(row); continue; }
    const base = /^meta(->>|->)/.test(src) ? metaDe(row) : row.data;
    let v = base; for (const seg of src.replace(/^(data|meta)(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
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
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 180)); } };

async function preparer(b, V) {
  const mobile = V.vp.width < 600;
  const ctx = await b.newContext({ viewport: V.vp, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, !!V.sombre);
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const journal = { lectures: [], octetsPdf: 0 };
  await ctx.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(route.request().url());
    const j = (d) => { const body = JSON.stringify(d); if (body.includes(PDF_B64)) journal.octetsPdf += PDF_B64.length; return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body }); };
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/email_achat_/.test(u)) journal.lectures.push(u.replace(/^.*\/rest\/v1\//, ''));
    if (V.recusPasSu && /email_achat_/.test(u)) return route.fulfill({ status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
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
  const tous = pg.locator('button', { hasText: /^Tous$/ });
  if (await tous.count()) { await tous.first().click(); }
  await pg.locator('[data-achat-tx="99990000111"]').waitFor({ timeout: 15000 });
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs, journal };
}

const DIALOG = '[role="dialog"][aria-label="Reçu d\'achat"]';
const chip = (pg, tx) => pg.evaluate((tx) => {
  const row = document.querySelector(`[data-achat-tx="${tx}"]`); if (!row) return { row: false };
  const b = row.querySelector('[data-achat-facture]'); if (!b) return { row: true, chip: false };
  const q = b.getBoundingClientRect();
  return { row: true, chip: true, sorte: b.getAttribute('data-achat-facture'), tx: b.getAttribute('data-achat-facture-tx'), texte: (b.innerText || '').trim(), h: Math.round(q.height), w: Math.round(q.width), droite: Math.round(q.right) };
}, tx);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const VUES = [
      { nom: '390 tactile (iPhone) clair', vp: { width: 390, height: 760 } },
      { nom: '390 tactile (iPhone) sombre', vp: { width: 390, height: 760 }, sombre: true },
      { nom: '1512 clair', vp: { width: 1512, height: 950 } },
      { nom: '1512 — reçus illisibles (pas su)', vp: { width: 1512, height: 950 }, recusPasSu: true },
    ];
    for (const V of VUES) {
      console.log(`── ${V.nom}`);
      const { ctx, pg, errs, journal } = await preparer(b, V);
      const mobile = V.vp.width < 600;

      if (V.recusPasSu) {
        await essaie('I. pas su', async () => {
          const n = await pg.locator('[data-achat-facture]').count();
          dit(n === 0, 'I. les reçus ne se lisent pas : AUCUN « Facture reçue par email » inventé', String(n));
          const recus = pg.locator('[data-recus-email]');
          await recus.locator('summary').click();
          await pg.waitForTimeout(300);
          const t = await recus.innerText();
          dit(/n’ont pas pu être lus/.test(t) && !/reliés? à son achat/.test(t), 'I. l’archive dit que les reçus n’ont pas pu être lus (aucun compte de reçus reliés)', JSON.stringify(t.slice(0, 160)));
          dit(errs.length === 0, 'I. aucune erreur d’app', errs.join(' | ').slice(0, 200));
        });
        await ctx.close();
        continue;
      }

      // ── A, B, C. Les lignes ──────────────────────────────────────────────
      await essaie('A-C. lignes', async () => {
        const a = await chip(pg, 99990000111);
        dit(a.chip && a.texte === 'Facture reçue par email' && a.tx === '99990000111' && a.sorte === 'email',
          'A. l’achat 99990000111 montre « Facture reçue par email » sur sa ligne (n° lu dans le texte du reçu)', JSON.stringify(a));
        const bb = await chip(pg, 99990000222);
        dit(bb.row && !bb.chip, 'B. deux reçus AU MÊME TITRE (l’un sans n°, l’autre d’un autre achat) ne se relient PAS à l’achat 99990000222 (§5)', JSON.stringify(bb));
        const d = await chip(pg, 99990000444);
        dit(d.row && !d.chip, 'B. un achat sans reçu ne montre rien', JSON.stringify(d));
        const c = await chip(pg, 99990000333);
        dit(c.chip && c.sorte === 'pdf' && c.tx === '99990000333', 'C. le reçu avec PDF joint est relié (« pdf »), même si l’email a été rangé deux fois', JSON.stringify(c));
        const n333 = await pg.locator('[data-achat-tx="99990000333"] [data-achat-facture]').count();
        dit(n333 === 1, 'C. deux lignes pour le même n° : UN seul « Facture reçue par email »', String(n333));
        if (mobile) {
          dit(a.h >= 43, 'G. au doigt, « Facture reçue par email » fait 44 px affichés', JSON.stringify({ h: a.h, w: a.w }));
          dit(a.droite <= V.vp.width, 'G. « Facture reçue par email » ne sort pas de l’écran', String(a.droite));
        }
      });

      // ── D. §4.4 : rien de lourd avant le clic ────────────────────────────
      await essaie('D. lecture légère', async () => {
        const liste = journal.lectures.filter((l) => /id=like\.email_achat_/.test(l));
        dit(liste.length >= 1, 'D. la liste des reçus a bien été lue (le contrôle mesure quelque chose)', String(liste.length));
        dit(liste.every((l) => !/select=(id,)?data(,|&|$)/.test(l) && !/pdfB64/.test(l)), 'D. la liste des reçus ne demande ni `data` entière ni `pdfB64` (§4.4)', JSON.stringify(liste.map((l) => l.slice(0, 160))));
        dit(journal.octetsPdf === 0, 'D. aucun octet de PDF n’a traversé avant le clic', String(journal.octetsPdf));
      });

      // ── E. Le clic ouvre SON reçu ────────────────────────────────────────
      await essaie('E. ouvrir', async () => {
        await pg.locator('[data-achat-tx="99990000111"] [data-achat-facture]').click();
        await pg.locator(DIALOG).waitFor({ timeout: 8000 });
        await pg.waitForTimeout(300);
        const f = await pg.evaluate((sel) => { const d = document.querySelector(sel); const tx = d && d.querySelector('[data-recu-transaction]'); const tot = d && d.querySelector('[data-recu-total]'); return d ? { tx: tx && tx.getAttribute('data-recu-transaction'), total: tot && Number(tot.getAttribute('data-recu-total')), pj: !!d.querySelector('[data-recu-pj]') } : null; }, DIALOG);
        dit(f && f.tx === '99990000111' && f.total === 2493, 'E. « Facture reçue par email » ouvre SON reçu (n° 99990000111, 24,93 €)', JSON.stringify(f));
        dit(f && !f.pj, 'E. un reçu sans PDF ne propose pas de « PDF joint »', JSON.stringify(f));
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
        dit(await pg.locator(DIALOG).count() === 0, 'E. Échap referme le reçu');
      });

      // ── F. Le PDF joint, au clic seulement ───────────────────────────────
      await essaie('F. PDF joint', async () => {
        const avant = journal.octetsPdf;
        await pg.locator('[data-achat-tx="99990000333"] [data-achat-facture]').click();
        await pg.locator(DIALOG).waitFor({ timeout: 8000 });
        await pg.waitForTimeout(300);
        const tx = await pg.locator(`${DIALOG} [data-recu-transaction]`).getAttribute('data-recu-transaction').catch(() => null);
        dit(tx === '99990000333', 'F. c’est le reçu de la botte qui s’ouvre', String(tx));
        dit(journal.octetsPdf === avant, 'F. ouvrir le reçu ne télécharge pas encore le PDF', `${avant} → ${journal.octetsPdf}`);
        const bouton = pg.locator('[data-recu-pj-ouvrir]');
        dit(await bouton.count() === 1, 'F. le reçu propose « PDF joint à l’email »');
        if (mobile) {
          const h = await bouton.evaluate((e) => Math.round(e.getBoundingClientRect().height));
          dit(h >= 43, 'F. « PDF joint à l’email » fait 44 px affichés', String(h));
        }
        const lu = journal.lectures.length;
        await bouton.click();
        await pg.waitForTimeout(1200);
        const lecturesPdf = journal.lectures.slice(lu).filter((l) => /id=eq\.email_achat_99990000333/.test(l) && /pdfB64/.test(l));
        dit(lecturesPdf.length === 1 && journal.octetsPdf > avant, 'F. le clic lit les octets du PDF, une fois, pour CE reçu', JSON.stringify({ lectures: lecturesPdf.length, octets: journal.octetsPdf - avant }));
        const etat = await pg.locator('[data-recu-pj]').getAttribute('data-recu-pj').catch(() => null);
        dit(etat === 'pret', 'F. le PDF est prêt', String(etat));
        if (mobile) {
          dit(await pg.locator('[data-recu-pj-lien]').count() === 1, 'F. sur iPhone, un lien « Ouvrir le PDF » (un vrai geste, jamais une fenêtre bloquée)');
        } else {
          const v = await pg.evaluate(() => { const d = document.querySelector('[data-visionneuse-pdf]'); return d ? { etat: d.getAttribute('data-visionneuse-pdf'), titre: d.getAttribute('aria-label') } : null; });
          dit(v && v.etat === 'pret' && v.titre === 'Facture reçue par email', 'F. sur ordinateur, le PDF s’ouvre dans la visionneuse de VRM, titrée « Facture reçue par email »', JSON.stringify(v));
          await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
        }
        if (await pg.locator(DIALOG).count()) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(400); }
      });

      // ── H. L'archive ─────────────────────────────────────────────────────
      await essaie('H. archive', async () => {
        const recus = pg.locator('[data-recus-email]');
        if (!(await recus.evaluate((e) => e.open))) await recus.locator('summary').click();
        await pg.waitForTimeout(300);
        const r = await recus.locator('[data-recus-relies]').evaluate((e) => ({ relies: e.getAttribute('data-recus-relies'), sans: e.getAttribute('data-recus-sans-achat'), texte: e.innerText })).catch(() => null);
        dit(r && r.relies === '3' && r.sans === '2', 'H. l’archive dit 3 reçus reliés à leur achat (par le n°) et 2 sans achat correspondant', JSON.stringify(r));
        dit(r && /n° de transaction/.test(r.texte), 'H. … et dit par quoi ils sont reliés (le n° de transaction)', r && JSON.stringify(r.texte.slice(0, 120)));
      });

      await essaie('fin', async () => {
        const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        dit(r.sw <= r.cw + 1, 'G. aucun débordement horizontal', `${r.sw} > ${r.cw}`);
        dit(errs.length === 0, 'G. aucune erreur d’app', errs.join(' | ').slice(0, 200));
      });
      if (process.env.CAPTURES) {
        fs.mkdirSync(process.env.CAPTURES, { recursive: true });
        await pg.evaluate(() => { const e = document.querySelector('[data-achat-tx="99990000111"]'); if (e) e.scrollIntoView({ block: 'center' }); });
        await pg.waitForTimeout(300);
        await pg.screenshot({ path: path.join(process.env.CAPTURES, `facture-achat-${V.vp.width}${V.sombre ? '-sombre' : ''}.png`) });
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
