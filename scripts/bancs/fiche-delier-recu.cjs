// ── BANC : DÉLIER UN ACHAT ET OUVRIR SON REÇU DEPUIS LA FICHE (16 nov., lot relier-fiable) ─────────
// Julien (fiche N°215, onglet « Argent ») : « ici j'ai mal relié un achat, je veux pouvoir l'enlever, et tu peux mettre
// le justificatif d'achat à côté ». Données INVENTÉES (dépôt public), forme des lignes réelles :
//   A. N°117 relié à l'achat 81170001 (52 €), dont le reçu e-mail est rangé : à côté de « Achetée », « Reçu » et
//      « Délier » visibles (44 px) ; « Reçu » ouvre la feuille du reçu de CET achat (son n° de transaction) ;
//   B. « Délier » : une phrase de confirmation ; « Annuler » n'écrit rien ; confirmé ⇒ « Achetée » « — » (jamais 0),
//      le lien part de la fiche, le couple est rangé dans « Ce n'est pas lui » (`vrm_liaison_refus`) ;
//   C. N°119 relié à un achat dont rien n'est lisible (ni achat lu, ni copie, ni reçu) ⇒ « Pas de reçu », jamais un lien mort.
// 390 tactile et 1512 ; captures regardées.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || (21000 + Math.floor(Math.random() * 18000)));
const SHOTS = process.env.SHOTS || os.tmpdir();

const M = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ilYa = (j) => iso(M - j * 86400000);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(M) }];
const TITRE50 = 'Nike Dunk Low Panda taille 42';
const FICHES = {
  6117: { numero: '117', title: 'Adidas Samba OG taille 41', numberedAt: '2026-10-20T10:00:00Z', auto: false, buyPrice: '52', buyFromId: '81170001',
    buyFrom: { title: 'Adidas Samba OG 41', date: ilYa(30), price: 52, seller: 'tom.kicks', account: 'compte_banc' } },
  6118: { numero: '118', title: 'New Balance 990 taille 43', numberedAt: '2026-10-21T10:00:00Z', auto: false },
  6119: { numero: '119', title: 'Puma Suede noir taille 42', numberedAt: '2026-10-21T10:00:00Z', auto: false, buyPrice: '30', buyFromId: '81190001' },
};
for (let i = 0; i < 50; i++) FICHES[7200 + i] = { numero: String(201 + i), title: TITRE50, numberedAt: '2026-10-22T10:00:00Z', auto: false, buyPrice: String(10 + i) };
const item = (id, title, extra) => ({ id: Number(id), title, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, ...extra });
const LISTINGS = [item(6118, FICHES[6118].title, { favourite_count: 14, view_count: 150 }), ...Array.from({ length: 50 }, (_, i) => item(7200 + i, TITRE50, { favourite_count: i, view_count: 100 + i })).filter((x) => ![7226, 7210, 7240].includes(x.id))];
const vente = (tx, title, status, j, prix) => ({ transaction_id: tx, title, status, transaction_user_status: /finalis/i.test(status) ? 'completed' : 'needs_action', price: { amount: prix, currency_code: 'EUR' }, date: ilYa(j) });
const VENTES = [
  vente(9117, FICHES[6117].title, 'Commande finalisée', 10, '95'),
  // Trois des cinquante paires identiques sont vendues : même titre, même prix.
  vente(9226, TITRE50, 'Commande finalisée', 5, '70'),
  vente(9210, TITRE50, 'Commande finalisée', 6, '70'),
  vente(9240, TITRE50, 'Commande finalisée', 7, '70'),
];
const txn = (tx, it, s, su) => ({ id: `harvest_111_txn_${tx}`, data: { capturedAt: iso(M), payload: { transaction: { id: tx, item_id: it, status: s, status_title: 'x', status_updated_at: su } } } });
const MEUBLES = [{ id: 'mB', name: 'Meuble B', cols: 4, rows: 3 }];
const SLOTS = { 117: { m: 'mB', i: 6 } };
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: FICHES, vrm_meubles: MEUBLES, vrm_slots: SLOTS, vinted_used_numeros: Object.values(FICHES).map((f) => f.numero) } },
  { id: 'harvest_111_listings', data: { capturedAt: iso(M - 600e3), payload: { items: LISTINGS, pagination: { total_entries: LISTINGS.length } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(M), payload: { my_orders: VENTES } } },
  txn(9117, 6117, 450, ilYa(3)), txn(9226, 7226, 450, ilYa(1)), txn(9210, 7210, 450, ilYa(2)), txn(9240, 7240, 450, ilYa(2)),
  { id: 'email_achat_r117', data: { subject: 'Ton reçu pour « Adidas Samba OG 41 »', article: 'Adidas Samba OG 41', prix: '52,00', transaction: '81170001', receivedAt: ilYa(29), texte: 'Reçu de commande\nAdidas Samba OG 41\nN° de transaction : 81170001\nMontant payé : 52,00 €' } },
  { id: 'email_bord_9117', data: { transaction: '9117', filename: 'b9117.pdf', pdfB64: 'JVBERi0x', receivedAt: ilYa(9) } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    if (/pdfB64$/.test(src)) x = x ? 'true' : null;
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};

async function rendre(b, vp, { ventesKO = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ n, m, s }) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); localStorage.setItem('vrm_meubles', JSON.stringify(m)); localStorage.setItem('vrm_slots', JSON.stringify(s)); } catch (_) {} }, { n: FICHES, m: MEUBLES, s: SLOTS });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (ventesKO && /orders_sold|_txn_/.test(u)) return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"panne"}' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data$/.test(sel) && sel !== 'data') ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(M), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);
  return { ctx, pg, errs };
}
// Ouvre la fiche (l'événement que posent « Tout sur le N° » et le mode emballage)
// et attend la fin de la lecture — jamais un délai fixe sur le résultat.
async function fiche(pg, n) {
  await pg.evaluate(() => { const b = document.querySelector('[data-fiche-fermer]'); if (b) b.click(); });
  await pg.waitForTimeout(150);
  await pg.evaluate((n) => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: n })), n);
  await pg.waitForSelector('[data-fiche-paire]', { timeout: 8000 });
  for (let i = 0; i < 60; i++) { const l = await pg.evaluate(() => (document.querySelector('[data-fiche-paire]') || { getAttribute: () => '1' }).getAttribute('data-fiche-lecture-en-cours')); if (l === '0') break; await pg.waitForTimeout(250); }
  return lire(pg);
}
const lire = (pg) => pg.evaluate(() => {
  const el = document.querySelector('[data-fiche-paire]'); if (!el) return null;
  const at = (s, a) => { const x = el.querySelector(s); return x ? x.getAttribute(a) : null; };
  return {
    num: el.getAttribute('data-fiche-paire'), grand: (el.querySelector('[data-fiche-grand-num]') || {}).textContent || '',
    achat: at('[data-fiche-resume-achat]', 'data-fiche-resume-achat'), vente: at('[data-fiche-resume-vente]', 'data-fiche-resume-vente'),
    benef: at('[data-fiche-resume-benefice]', 'data-fiche-resume-benefice'), partiel: at('[data-fiche-resume-benefice]', 'data-fiche-benefice-partiel'),
    benefTxt: (el.querySelector('[data-fiche-resume-benefice]') || {}).innerText || '',
    etapes: Object.fromEntries([...el.querySelectorAll('[data-fiche-etape]')].map((x) => [x.getAttribute('data-fiche-etape'), { etat: x.getAttribute('data-fiche-etat'), txt: x.innerText.replace(/\n/g, ' | '), raison: !!x.querySelector('[data-fiche-raison]') }])),
    ordre: [...el.querySelectorAll('[data-fiche-etape]')].map((x) => x.getAttribute('data-fiche-etape')),
    txs: [...el.querySelectorAll('[data-fiche-tx]')].map((x) => x.getAttribute('data-fiche-tx')),
    // (14 nov., système de design) 44 px au doigt, 36 à la souris (DESIGN.md §6 : une hauteur de contrôle par pointeur).
    seuil: matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)').matches ? 36 : 44,
    petits: [...el.querySelectorAll('button')].filter((x) => { const r = x.getBoundingClientRect(); return r.height > 0 && r.height < (matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)').matches ? 36 : 44) - 0.5; }).map((x) => x.textContent.slice(0, 30)),
    pastille: (() => { const p = el.querySelector('[data-fiche-etat="fait"] .vrm-fp-pastille'); return p ? getComputedStyle(p).backgroundColor : null; })(),
    gris: (() => { const p = el.querySelector('[data-fiche-etat="absent"] .vrm-fp-ligne1 b'); return p ? getComputedStyle(p).color : null; })(),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
});

const lireArgent = (pg) => pg.evaluate(() => {
  const el = document.querySelector('[data-fiche-paire]'); if (!el) return null;
  const g = el.querySelector('[data-fd-achat-relie]'); const h = (x) => (x ? Math.round(x.getBoundingClientRect().height) : 0);
  const a = el.querySelector('[data-fiche-resume-achat]');
  return { achat: a ? a.getAttribute('data-fiche-resume-achat') : null, achatTxt: a ? a.innerText.replace(/\n/g, ' | ') : '', relie: g ? g.getAttribute('data-fd-achat-relie') : null,
    recu: el.querySelector('[data-fd-recu]') ? el.querySelector('[data-fd-recu]').getAttribute('data-fd-recu') : null, pasRecu: !!el.querySelector('[data-fd-pas-recu]'),
    delier: el.querySelector('[data-fd-delier]') ? el.querySelector('[data-fd-delier]').getAttribute('data-fd-delier') : null, hRecu: h(el.querySelector('[data-fd-recu]')), hDelier: h(el.querySelector('[data-fd-delier]')),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
});
async function versArgent(pg) {
  await pg.evaluate(() => { const b = document.querySelector('[data-fd-seg="argent"]'); if (b && b.getAttribute('aria-selected') !== 'true') b.click(); });
  for (let i = 0; i < 40; i++) { const r = await lireArgent(pg); if (r && r.relie && (r.recu || r.pasRecu)) return r; await pg.waitForTimeout(250); }
  return lireArgent(pg);
}
const fichesLocales = (pg) => pg.evaluate(() => { try { return { f: JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'), r: JSON.parse(localStorage.getItem('vrm_liaison_refus') || '{}') }; } catch (_) { return { f: {}, r: {} }; } });

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width + 'px';
      console.log('── ' + T);
      const { ctx, pg, errs } = await rendre(b, vp);
      await essaie('A', async () => {
        await fiche(pg, '117');
        const r = await versArgent(pg);
        await pg.screenshot({ path: path.join(SHOTS, `fiche-delier-${vp.width}-117.png`) });
        dit(!!r && r.achat === '5200' && r.relie === '81170001' && r.recu === '81170001' && r.delier === '81170001', `A ${T} à côté de « Achetée 52 € » : « Reçu » et « Délier » (achat 81170001)`, JSON.stringify(r));
        const seuil = vp.width < 600 ? 44 : 36;
        dit(!!r && r.hRecu >= seuil && r.hDelier >= seuil && r.sw <= r.cw + 1, `A ${T} gestes ≥ ${seuil} px, aucun débordement`, r && `${r.hRecu}/${r.hDelier} ${r.sw}>${r.cw}`);
        await pg.evaluate(() => document.querySelector('[data-fd-recu]').click());
        await pg.waitForSelector('[data-recu-feuille]', { timeout: 8000 }).catch(() => {});
        const f = await pg.evaluate(() => { const x = document.querySelector('[data-recu-feuille]'); if (!x) return null; const r = x.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + 30); return { txt: x.innerText, dessus: !!(top && x.contains(top)) }; });
        await pg.screenshot({ path: path.join(SHOTS, `fiche-delier-${vp.width}-recu.png`) });
        dit(!!f && /81170001|Adidas Samba OG 41/.test(f.txt) && f.dessus, `A ${T} « Reçu » ouvre la feuille du reçu de CET achat, au-dessus de la fiche`, f && f.txt.slice(0, 120));
        await pg.evaluate(() => { const b = document.querySelector('[data-recu-retour]'); if (b) b.click(); });
        await pg.waitForTimeout(400);
      });
      await essaie('B', async () => {
        await pg.evaluate(() => document.querySelector('[data-fd-delier]').click());
        await pg.waitForTimeout(500);
        const dlg = await pg.evaluate(() => { const t = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].map((x) => x.innerText).join(' | '); return t; });
        dit(/Délier cet achat/.test(dlg) && /ne sera plus relié au N°117/.test(dlg), `B ${T} « Délier » demande d'abord, en une phrase`, dlg.slice(0, 160));
        await pg.screenshot({ path: path.join(SHOTS, `fiche-delier-${vp.width}-confirmer.png`) });
        // Annuler n'écrit rien.
        await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Annuler$/.test((x.innerText || '').trim())); if (b) b.click(); });
        await pg.waitForTimeout(500);
        const l0 = await fichesLocales(pg);
        dit(l0.f['6117'] && l0.f['6117'].buyFromId === '81170001', `B ${T} « Annuler » : le lien reste`);
        await pg.evaluate(() => document.querySelector('[data-fd-delier]').click());
        await pg.waitForTimeout(500);
        await pg.evaluate(() => { const b = [...document.querySelectorAll('[role="dialog"] button, [role="alertdialog"] button')].reverse().find((x) => /^Délier$/.test((x.innerText || '').trim())); if (b) b.click(); });
        let l = null; for (let i = 0; i < 40; i++) { l = await fichesLocales(pg); if (l.f['6117'] && !l.f['6117'].buyFromId && Object.keys(l.r).length) break; await pg.waitForTimeout(250); }
        dit(l.f['6117'] && (l.f['6117'].buyFromId == null || l.f['6117'].buyFromId === '') && !l.f['6117'].buyPrice, `B ${T} délié : le lien et le prix posé par lui partent de la fiche`, JSON.stringify(l.f['6117'] || {}).slice(0, 140));
        dit(Object.keys(l.r).some((k) => k === 'a:6117>81170001'), `B ${T} le couple est rangé dans « Ce n'est pas lui » : la proposition ne revient pas`, JSON.stringify(l.r));
        let r = null; for (let i = 0; i < 30; i++) { r = await lireArgent(pg); if (r && !r.relie) break; await pg.waitForTimeout(250); }
        await pg.screenshot({ path: path.join(SHOTS, `fiche-delier-${vp.width}-delie.png`) });
        dit(!!r && !r.relie && (r.achat === '' || r.achat == null) && !/\b0,00\b|\b0 €/.test(r.achatTxt), `B ${T} la fiche : plus d'achat relié, prix d'achat « manquant » (jamais 0)`, JSON.stringify(r));
      });
      await essaie('C', async () => {
        await fiche(pg, '119');
        const r = await versArgent(pg);
        await pg.screenshot({ path: path.join(SHOTS, `fiche-delier-${vp.width}-119.png`) });
        dit(!!r && r.relie === '81190001' && r.pasRecu && !r.recu && r.delier === '81190001', `C ${T} achat relié illisible ⇒ « Pas de reçu », jamais un lien mort ; « Délier » reste`, JSON.stringify(r));
      });
      dit(!errs.length, `F ${T} aucune erreur d'app`, errs[0]);
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ délier / reçu depuis la fiche : ${ko} rouge(s)` : '\n✅ délier / reçu depuis la fiche : tout est vert');
  process.exit(ko ? 1 : 0);
})();
