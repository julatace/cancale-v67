// Banc : « N°x supprimé de Vinted » dans Ma journée (3 nov., décision de Julien).
// Rend Ma journée à 390 px (tactile, clair) et 1512 px (sombre) sur des données
// INVENTÉES (le dépôt est public), et juge la RÈGLE par les data-* (§6.4) :
//   · UNE carte, pour la seule annonce vue en ligne puis absente d'une lecture
//     complète, sans vente : N°12 (7002) ;
//   · aucune carte pour : en ligne (11), jamais vue en ligne (B13), vendue prouvée
//     par sa transaction (14), déjà « Toujours chez moi » (15), retirée par VRM
//     (Republier, coffre, 16), masquée par Vinted (17), republiée sous le même N° (18) ;
//   · (9 nov., Ma journée v2) UNE carte « articles supprimés de Vinted », une RANGÉE par
//     article (`data-cycle-num`) et SA réponse dans un menu de 44 px : « Toujours chez moi »
//     · « Remise en ligne » · « Vendu en main propre » · « Je m'en sépare » (avant : trois
//     pilules par carte, une carte par article — la capture de Julien du 9 nov.) ;
//   · « Toujours chez moi » (390) / « Remise en ligne » (1512) range SA réponse
//     (`vrm_cycle_decisions`) et la rangée part ;
//     l'article n'est ni vendu ni sorti (`vinted_annonces_vendues`, `vinted_pairs_lost`
//     inchangés) ;
//   · MUTATION (CYCLE_MUTATION=1) : la vente de 7004 n'est plus servie ⇒ une
//     deuxième carte (N°14) doit apparaître — le banc DOIT passer au rouge.
// Lancer : node <construire> . && BANC_PORT=45xx node scripts/bancs/cycle-supprime.cjs
// Captures : SHOTS=<dossier>
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4471);
const SHOTS = process.env.SHOTS || '';
const MUTATION = process.env.CYCLE_MUTATION === '1';

const maintenant = new Date(2026, 10, 3, 10, 0, 0);
const iso = (minAvant) => new Date(maintenant.getTime() - minAvant * 60000).toISOString();
const A = '111';
const photo = (k) => `https://images1.vinted.net/t/b${k}/f800/${k}.jpeg?s=x`;
const fiche = (num, k, extra = {}) => ({ numero: num, accountId: A, title: `Nike Air Max ${k} taille 42`, photo: photo(k), photoK: `pk${k}`, price: '60', auto: true, numberedAt: iso(60 * 24 * 10), ...extra });
const FICHES = {
  7001: fiche('11', 1), 7002: fiche('12', 2), 7003: fiche('B13', 3), 7004: fiche('14', 4), 7005: fiche('15', 5),
  7006: fiche('16', 6), 7007: fiche('17', 7), 7008: fiche('18', 8), 7009: fiche('18', 9, { recreeDe: '7008' }),
};
const VUS = { 7001: iso(60 * 30), 7002: iso(60 * 48), 7004: iso(60 * 48), 7005: iso(60 * 48), 7006: iso(60 * 48), 7007: iso(60 * 48), 7008: iso(60 * 48), 7009: iso(60 * 30) };
const DECISIONS = { 7005: { choix: 'chez-moi', numero: '15', at: iso(60 * 20) } };
const item = (id, extra = {}) => ({ id: Number(id), title: FICHES[id].title, price: { amount: '60.0', currency_code: 'EUR' }, photo: { url: photo(Number(id) - 7000) }, is_closed: false, is_hidden: false, is_draft: false, user: { id: Number(A) }, created_at_ts: iso(60 * 24 * 5), ...extra });
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'boutique_test', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = iso(10);
const LIGNES = [
  { id: 'main', data: { vinted_annonce_numeros: FICHES, vrm_vus_en_ligne: VUS, vrm_cycle_decisions: DECISIONS, vinted_used_numeros: ['11', '12', 'B13', '14', '15', '16', '17', '18'] } },
  { id: `harvest_${A}_listings`, data: { capturedAt: cap, uid: A, payload: { items: [item(7001), item(7007, { is_hidden: true }), item(7009)], pagination: { total_entries: 3, total_pages: 1, current_page: 1 } } } },
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: [] } } },
  ...(MUTATION ? [] : [{ id: `harvest_${A}_txn_9004`, data: { capturedAt: cap, payload: { transaction: { id: 9004, item_id: 7004, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(60 * 30) } } } }]),
  { id: `coffre_${A}_7006`, data: { id: '7006', uid: A, versBrouillon: { etat: 'fait', supprimeLe: iso(60 * 40) } } },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

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
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#dfe3e8', '#e8e1d8', '#dfe5dd', '#e6dcdc'][k % 4]}"/><path d="M60 250 C80 190 150 175 190 200 C230 222 285 205 330 232 C352 246 346 282 306 284 L84 284 C62 284 52 268 60 250 Z" fill="rgba(30,34,40,.62)"/></svg>`;

const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
  } catch (_) {} }, !!sombre);
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
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => (r.data[k] == null) === !non);
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      console.log(`\n— Ma journée · ${nom}${MUTATION ? ' (MUTATION)' : ''}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      try {
        await pg.locator('.vrm-day-layout').first().waitFor({ timeout: 30000 });
        await pg.locator('[data-job="supprime-vinted"]').first().waitFor({ timeout: 25000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const m = await pg.evaluate(() => {
          const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
          const groupes = [...document.querySelectorAll('[data-job="supprime-vinted"]')].filter(vis);
          const cartes = groupes.flatMap((g) => [...g.querySelectorAll('[data-cycle-num]')]).filter(vis);
          return {
            groupes: groupes.length,
            nums: cartes.map((c) => c.getAttribute('data-cycle-num')).sort(),
            choix: cartes.map((c) => { const sel = c.querySelector('select[data-cycle-select]'); if (!sel || !vis(sel)) return []; const r = sel.getBoundingClientRect();
              return [...sel.querySelectorAll('option[data-cycle-choix]')].map((o) => ({ k: o.getAttribute('data-cycle-choix'), h: Math.round(r.height), r: Math.round(r.right) })); }),
            deb: document.documentElement.scrollWidth - window.innerWidth,
            vw: window.innerWidth,
            paire: cartes.some((c) => /\bpaires?\b/i.test(c.innerText)),
          };
        });
        dit(m.groupes === 1 && JSON.stringify(m.nums) === JSON.stringify(['12']), 'UNE carte, une seule rangée : N°12 (vue en ligne, absente d\'une lecture complète, sans vente)', JSON.stringify({ groupes: m.groupes, nums: m.nums }));
        const c0 = m.choix[0] || [];
        dit(c0.map((x) => x.k).join(',') === 'chez-moi,remise,vendu-main,separe', 'quatre réponses dans le menu de la rangée (« Remise en ligne » comprise)', c0.map((x) => x.k).join(','));
        dit(c0.length && c0.every((x) => x.h >= 44 && x.r <= m.vw + 1), 'menu de 44 px, dans l\'écran', JSON.stringify(c0));
        dit(m.deb <= 1, 'aucun débordement horizontal', String(m.deb));
        dit(!m.paire, 'jamais « paire » sur la carte');
        if (SHOTS) { const el = pg.locator('[data-job="supprime-vinted"]').first(); if (await el.count()) { await el.scrollIntoViewIfNeeded(); await pg.screenshot({ path: path.join(SHOTS, `cycle-${nom}.png`) }); await el.screenshot({ path: path.join(SHOTS, `cycle-carte-${nom}.png`) }); } }
        if (!MUTATION && m.nums.includes('12')) {
          const CH = nom.startsWith('390') ? 'chez-moi' : 'remise';
          await pg.locator('[data-cycle-num="12"] select[data-cycle-select]').selectOption(CH);
          await pg.waitForTimeout(800);
          const apres = await pg.evaluate(() => {
            const lire = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (_) { return d; } };
            return { carte: !!document.querySelector('[data-cycle-num="12"]'), dec: lire('vrm_cycle_decisions', {})['7002'] || null,
              vendus: lire('vinted_annonces_vendues', []), perdues: Object.values(lire('vinted_pairs_lost', {})).map((e) => e && e.id) };
          });
          dit(!apres.carte, `« ${CH} » : la rangée part`);
          dit(apres.dec && apres.dec.choix === CH && apres.dec.numero === '12', `sa réponse « ${CH} » est rangée (vrm_cycle_decisions)`, JSON.stringify(apres.dec));
          dit(!apres.vendus.includes('7002') && !apres.perdues.includes('7002'), 'l\'article n\'est ni vendu ni sorti du stock', JSON.stringify(apres));
        }
        dit(!errs.length, 'aucune erreur d\'app', errs.join(' | ').slice(0, 200));
      } catch (e) { dit(false, 'Ma journée', String(e.message || e).slice(0, 200)); }
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} cycle-supprime : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
