// ════════════════════════════════════════════════════════════════════════════
//  BANC : LEBONCOIN, LE N° ÉCRIT À LA FIN DE LA DESCRIPTION DANS « RELIER MES ANNONCES » (24 nov., lot lbc-numero-ecrit)
//  Rend le VRAI build (dist/) sur une base INVENTÉE (aucune donnée réelle), à 390 × 844 tactile et 1512, clair.
//  Mesure par data-* et couleurs rendues (jamais un libellé).
//   E1  l'annonce qui finit par « N°132 » (une paire 132) est RELIÉE, preuve `numero-ecrit` — sans aucun toucher,
//       et rien n'est écrit dans `vrm_lbc_liens` ;
//   E2  « N°300 » (deux paires 300) ⇒ à relier, raison `deux-paires` ; « N°999 » ⇒ `inconnu` ; la phrase est
//       NEUTRE (la couleur des faits de l'annonce, jamais ambre/orange), contraste ≥ 4,5:1 ;
//   E3  « N°124 » dans le TITRE seul ⇒ pas reliée, aucune raison « N° écrit » ;
//   E4  « Délier » l'annonce 5001 ⇒ le journal note « pas la même (N°132) », aucun lien posé ; elle revient à relier.
//  `BANC_DIST=<dist>` : un autre build.  `BANC_SEUL=390|1512`, `CAPTURES=<dossier>`.
//    BANC_PORT=$((20000+RANDOM%40000)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/lbc-numero-ecrit.cjs
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs'), http = require('http');
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const RACINE = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 9686;
const CAPT = process.env.CAPTURES || '';
if (CAPT) fs.mkdirSync(CAPT, { recursive: true });

const maintenant = new Date(2026, 10, 24, 15, 30, 0);
const MS = maintenant.getTime();
const iso = (h) => new Date(MS - h * 3600e3).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte-alpha', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).split('\n')[0].slice(0, 300)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = (row.data && row.data.capturedAt) || maintenant.toISOString(); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : (/->>/.test(src) ? String(v) : v));
  }
  return out;
};

// ── Le monde inventé : des paires toutes pareilles, des annonces Leboncoin toutes pareilles ──────────
const TITRE = 'Adidas Spezial noire taille 38';
function scenario() {
  const vinted = [[9001, '124'], [9002, '125'], [9003, '132'], [9004, '300'], [9005, '300']];
  const numeros = Object.fromEntries(vinted.map(([id, n]) => [String(id), { numero: n, title: TITRE, accountId: '111', numberedAt: iso(500), size: '38', price: '60' }]));
  const items = vinted.map(([id]) => ({ id, title: TITRE, photo: { url: '' }, url: `https://www.vinted.fr/items/${id}-inventee`, price: { amount: '60.0', currency_code: 'EUR' }, size_title: '38', brand_title: 'Adidas', is_closed: false, is_hidden: false, is_draft: false, created_at_ts: iso(300), user_id: 111 }));
  const DEBUT = 'Très bon état, portée deux fois. Envoi rapide.';
  const lbcAd = (id, fin, o = {}) => ({ id, account: 'lbc-account:987', accountName: 'boutique-lbc', subject: TITRE, body: fin ? `${DEBUT}\n\n${fin}` : DEBUT, status: 'active', price: 60, images: [], seenAt: iso(1), publieeLe: iso(48), url: 'https://www.leboncoin.fr/ad/chaussures/' + id, ...o });
  const lbc = { 5001: lbcAd(5001, 'N°132'), 5002: lbcAd(5002, 'N°300'), 5003: lbcAd(5003, 'N°999'), 5004: lbcAd(5004, null), 5005: lbcAd(5005, null, { subject: TITRE + ' N°124' }) };
  const LIGNES = [
    { id: 'harvest_111_listings', data: { capturedAt: iso(1), uid: '111', payload: { items, pagination: { total_entries: items.length } } } },
    { id: 'lbc_listings', data: { items: lbc, lectures: { 'lbc-account:987': { at: iso(1), complet: true } } } },
    { id: 'lbc_accounts', data: { accounts: { 987: { id: 'lbc-account:987', name: 'boutique-lbc', sessionAt: iso(1) } } } },
    { id: 'lbc_ventes', data: { ventes: {} } },
    { id: 'ebay_listings', data: { capturedAt: MS - 3600e3, complet: true, items: [] } },
    { id: 'vc_listings', data: { capturedAt: iso(1), complet: true, items: {}, liens: {} } },
  ];
  const main = { vinted_annonce_numeros: numeros, vrm_lbc_liens: {}, vrm_ebay_liens: {}, vrm_vc_liens: {}, vinted_used_numeros: [124, 125, 132, 300] };
  return { LIGNES, main };
}

async function ouvrir(b, vp, sc) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: vp, deviceScaleFactor: tel ? 2 : 1, timezoneId: 'Europe/Paris', locale: 'fr-FR', ...(tel ? { isMobile: true, hasTouch: true } : {}), colorScheme: 'light' });
  const pg = await ctx.newPage();
  const errs = [], ecritures = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); localStorage.setItem('vinted_dark', 'false'); localStorage.setItem('vrm_apparence', JSON.stringify('clair')); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : /api-adresse|openfreemap/.test(r.request().url()) ? r.abort() : r.continue()));
  const main = { ...sc.main, vinted_dark: false };
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET' && req.method() !== 'HEAD') { ecritures.push({ m: req.method(), u: u.slice(0, 160), corps: String(req.postData() || '') }); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: main }, sel)]);
    if (eq) return j(sc.LIGNES.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const dans = /id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(sc.LIGNES.filter((r) => ids.includes(r.id)).map((r) => projette(r, sel))); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*').replace(/_/g, '.') + '$'); return j(sc.LIGNES.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-app-shell, .vrm-main, [data-tout-a-jour]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 40000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  return { ctx, pg, errs, ecritures };
}
const ouvrirSur = async (pg, id) => {
  await pg.evaluate((i) => window.dispatchEvent(new CustomEvent('vrm:liaison-ouvrir', { detail: { site: 'Leboncoin', id: i } })), id);
  return pg.waitForSelector(`[data-liaison-annonce="Leboncoin:${id}"], [data-liaison-fiche="Leboncoin:${id}"]`, { timeout: 15000 }).then(() => true).catch(() => false);
};
const fermer = async (pg) => { await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(400); };
const stock = (pg, k) => pg.evaluate((cle) => { try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch (_) { return null; } }, k);
// La phrase « N° écrit » : sa raison, sa couleur rendue, celle des faits voisins, son contraste.
const lireEcrit = (pg) => pg.evaluate(() => {
  const e = document.querySelector('[data-liaison-ecrit]'); if (!e) return null;
  const f = document.querySelector('.n-lia-annonce-faits');
  const rgb = (c) => (/rgba?\(([^)]+)\)/.exec(c) || [, '0,0,0'])[1].split(',').map((x) => parseFloat(x));
  const fondDe = (x) => { while (x && x.nodeType === 1) { const c = rgb(getComputedStyle(x).backgroundColor); if (c.length < 4 || c[3] > 0.9) { if (!(c[0] === 0 && c[1] === 0 && c[2] === 0 && c.length > 3 && c[3] === 0)) return c; } x = x.parentElement; } return [255, 255, 255]; };
  const L = (c) => { const g = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * g(c[0]) + 0.7152 * g(c[1]) + 0.0722 * g(c[2]); };
  const t = rgb(getComputedStyle(e).color), b = fondDe(e);
  const contraste = (Math.max(L(t), L(b)) + 0.05) / (Math.min(L(t), L(b)) + 0.05);
  const r = e.getBoundingClientRect();
  return { raison: e.getAttribute('data-liaison-ecrit'), numero: e.getAttribute('data-numero') || '', couleur: getComputedStyle(e).color, faits: f ? getComputedStyle(f).color : '', fond: getComputedStyle(e).backgroundColor, contraste: Math.round(contraste * 100) / 100, visible: r.width > 0 && r.height > 0, deborde: r.right > innerWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1 };
});
// Ambre / orange : rouge dominant, vert moyen, bleu bas.
const chaud = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return false; const [r, g, b] = m[1].split(',').map((x) => parseFloat(x)); return r > 150 && g > 60 && g < 210 && b < 90 && r - b > 100; };

(async () => {
  let b;
  srv.listen(PORT);
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 945 }].filter((v) => !process.env.BANC_SEUL || String(v.width) === process.env.BANC_SEUL)) {
      const nomVp = vp.width < 600 ? '390' : '1512', T = `${nomVp} clair`;
      const shot = async (pg, nom) => { if (CAPT) await pg.screenshot({ path: path.join(CAPT, `lbc-numero-ecrit-${nomVp}-${nom}.png`) }); };
      console.log(`\n── ${T}`);
      await essaie(`E ${T}`, async () => {
        const { ctx, pg, errs, ecritures } = await ouvrir(b, vp, scenario());
        // E1 — reliée par le N° écrit, sans toucher.
        let vu = await ouvrirSur(pg, '5001'); await pg.waitForTimeout(800);
        const f1 = await pg.evaluate(() => { const f = document.querySelector('[data-liaison-fiche="Leboncoin:5001"]'); const p = f && f.querySelector('[data-liaison-preuve]'); return f ? { etat: f.getAttribute('data-etat'), preuve: p ? p.getAttribute('data-liaison-preuve') : '', delier: !!f.querySelector('[data-liaison-delier]') } : null; });
        await shot(pg, '1-reliee');
        dit(vu && f1 && f1.etat === 'relie' && f1.preuve === 'numero-ecrit' && f1.delier, `${T} E1 « N°132 » à la fin ⇒ reliée, preuve « N° écrit », « Délier » proposé`, JSON.stringify(f1));
        const liens0 = await stock(pg, 'vrm_lbc_liens');
        dit(!(liens0 && liens0['5001']) && !ecritures.some((e) => /vrm_lbc_liens/.test(e.corps) && /5001/.test(e.corps)), `${T} E1 rien d’écrit dans les liens (une identité lue, jamais recopiée)`, JSON.stringify(liens0));
        await fermer(pg);
        // E2 — deux paires, inconnu.
        for (const [id, raison, nom] of [['5002', 'deux-paires', '2-deux-paires'], ['5003', 'inconnu', '3-inconnu']]) {
          vu = await ouvrirSur(pg, id); await pg.waitForTimeout(800);
          const m = await lireEcrit(pg);
          await shot(pg, nom);
          dit(vu && m && m.raison === raison && m.visible && !m.deborde, `${T} E2 annonce ${id} : à relier, raison « ${raison} » dite`, JSON.stringify(m));
          dit(m && !chaud(m.couleur) && m.couleur === m.faits && m.contraste >= 4.5, `${T} E2 annonce ${id} : phrase neutre (gris des faits, jamais ambre), contraste ≥ 4,5:1`, JSON.stringify(m));
          await fermer(pg);
        }
        // E3 — titre seul.
        vu = await ouvrirSur(pg, '5005'); await pg.waitForTimeout(800);
        const f3 = await pg.evaluate(() => ({ fiche: !!document.querySelector('[data-liaison-fiche="Leboncoin:5005"][data-etat="relie"]'), ecrit: !!document.querySelector('[data-liaison-ecrit]'), annonce: !!document.querySelector('[data-liaison-annonce="Leboncoin:5005"]') }));
        dit(vu && !f3.fiche && !f3.ecrit && f3.annonce, `${T} E3 « N°124 » dans le TITRE seul ⇒ pas reliée, aucune raison « N° écrit »`, JSON.stringify(f3));
        await fermer(pg);
        // E4 — Délier.
        vu = await ouvrirSur(pg, '5001'); await pg.waitForTimeout(600);
        const l = pg.locator('[data-liaison-delier]').first();
        if (vp.width < 600) await l.tap(); else await l.click();
        await pg.waitForTimeout(1500);
        const J = await stock(pg, 'vrm_liaison_sites'), L2 = await stock(pg, 'vrm_lbc_liens');
        const non = J && J['nonEcrit:Leboncoin:5001'];
        dit(non && non.numero === '132' && !(L2 && Object.prototype.hasOwnProperty.call(L2, '5001')), `${T} E4 « Délier » : le journal retient « pas la même (N°132) », aucun lien posé`, JSON.stringify({ non, L2 }));
        await fermer(pg);
        vu = await ouvrirSur(pg, '5001'); await pg.waitForTimeout(1200);
        const m4 = await lireEcrit(pg);
        await shot(pg, '4-deliee');
        dit(vu && m4 && m4.raison === 'delie', `${T} E4 rouverte : à relier, « tu as dit que ce n’est pas la même paire »`, JSON.stringify(m4));
        dit(!errs.length, `${T} aucune erreur de page`, errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc lbc-numero-ecrit : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
