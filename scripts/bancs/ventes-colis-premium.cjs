// Banc : Ventes et Colis « premium » sur téléphone (390 px) et ordinateur
// (1512 px), sur des données INVENTÉES et réalistes (aucune donnée réelle : ce
// banc vit dans le dépôt, qui est public). Demande de Julien (16 octobre) : sur
// iPhone l'app « ne fait pas premium et classe ».
//
// Il juge ce qui est RENDU, jamais un libellé exact (§6.5) :
//   1. l'écran s'affiche, sans erreur, sans débordement horizontal ;
//   2. aucun montant n'est coupé (ni rogné, ni cassé sur deux lignes) ;
//   3. au téléphone, aucune cible tactile (bouton, repli) sous 44 px de haut ;
//   4. les compteurs et totaux sont ceux des données inventées :
//      Ventes « Toutes » = 9 ventes (l'annulée n'y est pas), leur somme rendue
//      = 696,90 € ; « À expédier » = 4 ; Colis : 4 à envoyer, 3 prêts à
//      imprimer (PDF reçu par email, relié par la TRANSACTION), 1 en attente.
// Captures : SHOTS=<dossier> node scripts/bancs/ventes-colis-premium.cjs
// Lancer : npm run build && BANC_PORT=50xx node scripts/bancs/ventes-colis-premium.cjs
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 5071;
const SHOTS = process.env.SHOTS || '';

const maintenant = new Date(2026, 9, 15, 15, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const A = '111', B = '222';
let nPhoto = 0;
const vente = (id, titre, prix, statut, d, tus, extra = {}) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` }, ...extra });
const VENTES_A = [
  vente(7001, 'Nike Air Max 90 blanche taille 42', 65, 'Le paiement a été validé', il(0, 11), 'needs_action'),
  vente(7002, 'Adidas Samba OG noir gomme taille 40', 72, 'Le paiement a été validé', il(1, 9), 'needs_action'),
  vente(7003, 'Salomon XT-6 Advanced gris taille 43', 110, 'Le paiement a été validé', il(2), 'needs_action'),
  vente(7004, 'New Balance 550 crème taille 41', 58, 'Colis en cours d\'acheminement', il(3), 'waiting'),
  vente(7005, 'Asics Gel-Kayano 14 argent taille 44', 89, 'Commande finalisée', il(4), 'completed'),
  vente(7006, 'Nike Dunk Low panda taille 38', 61, 'Commande finalisée', il(8), 'completed'),
  vente(7007, 'Adidas Spezial bleu taille 39', 54, 'Commande finalisée', il(10), 'completed'),
  vente(7008, 'Converse Chuck 70 noir taille 42', 38, 'Commande finalisée', il(12), 'completed'),
  vente(7009, 'Nike Shox TL noir taille 41', 95, 'Commande annulée', il(1), 'failed'),
];
const VENTES_B = [
  vente(7010, 'Air Jordan 1 Retro High OG Chicago Lost and Found taille 44,5', 149.9, 'Le paiement a été validé', il(0, 8), 'needs_action'),
];
const ATTENDU = { toutes: 9, sommeToutes: 69690, aExpedier: 4, colis: 4, prets: 3, attente: 1 };

const ACCOUNTS = [
  { id: 1, vinted_user_id: A, login: 'julatace35260', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
  { id: 2, vinted_user_id: B, login: 'tomj606', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
];
const cap = maintenant.toISOString();
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const bord = (tx, uid, titre) => ({ id: 'email_bord_' + tx, data: { transaction: String(tx), uid, filename: 'bordereau-' + tx + '.pdf', modele: titre, article: titre, receivedAt: cap, pdfB64: PDF_B64 } });
const LIGNES = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES_A } } },
  { id: `harvest_${B}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES_B } } },
  bord(7001, A, VENTES_A[0].title), bord(7002, A, VENTES_A[1].title), bord(7010, B, VENTES_B[0].title),
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

// Projection PostgREST (§6.3) : une requête projetée reçoit la projection.
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};

const teintes = ['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf', '#d8d0d6', '#d3d8de', '#ddd8cc', '#cdd2d8', '#d6d1c8', '#d0d4dc'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${teintes[k % teintes.length]}"/><ellipse cx="200" cy="300" rx="150" ry="22" fill="rgba(0,0,0,.08)"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 280 300 282 L90 282 C70 282 62 268 70 250 Z" fill="rgba(30,34,40,.55)"/></svg>`;

const ouvrir = async (b, vp, tab) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    // Les filtres `data->>X=not.is.null` / `is.null` (comme colis.cjs).
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => (r.data[k] == null) === !non);
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};

// Mesures communes : débordement, montants coupés, cibles tactiles.
const mesurer = (pg) => pg.evaluate(() => {
  const main = document.querySelector('.vrm-main') || document.body;
  const vw = window.innerWidth;
  const visible = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('details:not([open]) > :not(summary)') && !e.closest('[aria-hidden="true"]'); };
  const hors = [];
  for (const e of main.querySelectorAll('*')) {
    if (!visible(e) || e.closest('svg')) continue;
    const r = e.getBoundingClientRect();
    if (r.right > vw + 1 && !e.closest('.vrm-rangee')) hors.push((e.className && String(e.className).slice(0, 30)) || e.tagName);
  }
  // Un montant « 65 € », « 149,90 € », « +12,40€ » : rogné ou cassé sur deux lignes.
  const RE = /^[+−-]?\s?\d[\d  .]*(,\d{1,2})?\s?€$/;
  const coupes = [];
  for (const e of main.querySelectorAll('*')) {
    if (!visible(e) || e.children.length) continue;
    const t = (e.textContent || '').trim();
    if (!t || t.length > 16 || !RE.test(t)) continue;
    const rg = document.createRange(); rg.selectNodeContents(e);
    const lignes = new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)));
    const s = getComputedStyle(e);
    if (lignes.size > 1 || (e.scrollWidth > e.clientWidth + 1 && s.overflow !== 'visible')) coupes.push(t);
  }
  const petites = [];
  for (const e of main.querySelectorAll('button, summary, [role="button"]')) {
    if (!visible(e) || e.getAttribute('role') === 'switch') continue;
    const r = e.getBoundingClientRect();
    if (r.height < 43.5) petites.push(`${Math.round(r.height)}px « ${(e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 28)} »`);
  }
  return {
    deb: document.documentElement.scrollWidth - vw, hors: hors.slice(0, 6), coupes, petites,
    tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
  };
});

const capture = async (pg, vp, nom) => {
  if (!SHOTS) return;
  await pg.screenshot({ path: path.join(SHOTS, `${nom}-${vp.width}-ecran.png`) });
  await pg.setViewportSize({ width: vp.width, height: vp.width < 600 ? 2600 : 1900 }); await pg.waitForTimeout(500);
  await pg.screenshot({ path: path.join(SHOTS, `${nom}-${vp.width}.png`) });
  await pg.setViewportSize(vp); await pg.waitForTimeout(300);
};

const communs = (m, vp, errs) => {
  dit(!m.tombe && errs.length === 0, 'l’écran s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
  dit(m.deb <= 1 && m.hors.length === 0, 'aucun débordement horizontal', `${m.deb} px ${m.hors.join(' | ')}`);
  dit(m.coupes.length === 0, 'aucun montant coupé', m.coupes.join(' | '));
  if (vp.width < 600) dit(m.petites.length === 0, 'aucune cible tactile sous 44 px', m.petites.slice(0, 6).join(' | '));
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`\n── Ventes, ${vp.width} px`);
      await essaie(`Ventes ${vp.width}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, 'cat_ventes');
        await pg.waitForFunction(() => document.querySelectorAll('.vrm-sale-row').length > 0 || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        await pg.locator('button[aria-pressed]', { hasText: /^Toutes$/ }).first().click({ timeout: 4000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const lu = await pg.evaluate(() => {
          const rows = [...document.querySelectorAll('.vrm-sale-row[data-tx]')];
          // (21 oct., refonte d5cc962) Le détail d'une vente vit dans un TIROIR, un
          // portail hors de la ligne : on lit le prix dans la ligne OU dans le
          // tiroir que son bouton commande (aria-controls).
          const prix = rows.map((r) => { const tg = r.querySelector('.vrm-ledger-sale-toggle'); const tir = tg && tg.getAttribute('aria-controls') ? document.getElementById(tg.getAttribute('aria-controls')) : null;
            const el = r.querySelector('[data-prix-vente]') || (tir && tir.querySelector('[data-prix-vente]')); const t = el ? el.getAttribute('data-prix-vente') : null; return t == null ? null : Number(t); });
          return { n: rows.length, prix };
        });
        dit(lu.n === ATTENDU.toutes, `« Toutes » rend ${ATTENDU.toutes} ventes (l’annulée n’y est pas)`, `${lu.n}`);
        const somme = lu.prix.reduce((s, x) => s + (x || 0), 0);
        dit(lu.prix.every((x) => x != null) && somme === ATTENDU.sommeToutes, 'la somme des prix rendus est 696,90 €', `${somme / 100} € ${JSON.stringify(lu.prix)}`);
        communs(await mesurer(pg), vp, errs);
        await capture(pg, vp, 'ventes');
        await pg.locator('button[aria-pressed]', { hasText: /^À expédier$/ }).first().click({ timeout: 4000 });
        await pg.waitForTimeout(800);
        const nA = await pg.evaluate(() => document.querySelectorAll('.vrm-sale-row[data-tx]').length);
        dit(nA === ATTENDU.aExpedier, `« À expédier » rend ${ATTENDU.aExpedier} ventes`, `${nA}`);
        const m2 = await mesurer(pg);
        dit(m2.coupes.length === 0 && m2.deb <= 1, 'À expédier : rien de coupé ni de débordant', `${m2.deb} px ${m2.coupes.join(' | ')}`);
        if (vp.width < 600) dit(m2.petites.length === 0, 'À expédier : aucune cible sous 44 px', m2.petites.slice(0, 6).join(' | '));
        await capture(pg, vp, 'ventes-aexpedier');
        await ctx.close();
      });
      console.log(`\n── Colis, ${vp.width} px`);
      await essaie(`Colis ${vp.width}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, 'cat_bord');
        await pg.waitForFunction(() => document.querySelector('[data-colis-recap]') && document.querySelector('[data-groupe="pret"]'), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const lu = await pg.evaluate(() => {
          const r = document.querySelector('[data-colis-recap]');
          const n = (g) => document.querySelectorAll(`[data-bord-card][data-groupe-carte="${g}"]`).length;
          return { recap: r ? r.getAttribute('data-colis-recap') : null, cartes: document.querySelectorAll('[data-bord-card]').length, pret: n('pret'), attente: n('attente'), lot: !!document.querySelector('[data-lot-ouvrir]'), lotTxt: (document.querySelector('[data-lot-ouvrir]') || {}).innerText || '' };
        });
        dit(lu.recap === String(ATTENDU.colis), `le récapitulatif compte ${ATTENDU.colis} colis à envoyer`, lu.recap);
        dit(lu.cartes === ATTENDU.colis, `${ATTENDU.colis} cartes de colis`, `${lu.cartes}`);
        dit(lu.pret === ATTENDU.prets && lu.attente === ATTENDU.attente, `${ATTENDU.prets} prêts à imprimer, ${ATTENDU.attente} en attente`, `${lu.pret} · ${lu.attente}`);
        dit(lu.lot && new RegExp(`\\b${ATTENDU.prets}\\b`).test(lu.lotTxt), `« Tout imprimer » annonce ${ATTENDU.prets} bordereaux`, lu.lotTxt.replace(/\s+/g, ' '));
        communs(await mesurer(pg), vp, errs);
        await capture(pg, vp, 'colis');
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'banc', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
