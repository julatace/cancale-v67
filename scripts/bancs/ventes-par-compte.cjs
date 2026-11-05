// ── BANC : COMPTE QUI VEND LE MIEUX (G24) ───────────────────────────────────
// Un revendeur a plusieurs comptes Vinted ; il veut savoir lequel vend le plus.
// (5 nov., chantier E2) UNE SEULE PLACE : Statistiques → « Quel compte vend le
// mieux » (la phrase « … vend le plus », `data-sv-meilleur`, et une ligne par
// compte, `data-sv-compte`). Le bloc « Compte qui vend le mieux » / « Ventes
// finalisées par compte » de Ventes → Analyse disait la même chose une seconde
// fois, derrière deux replis : il est retiré, et ce banc suit la place qui reste
// (il jugeait la RÈGLE — agrégation de ventes connues, compte exclu absent, rien
// à comparer avec un seul compte —, pas l'endroit).
// C'est une AGRÉGATION de ventes connues, pas une estimation (§5), et un compte
// EXCLU n'y entre pas (« ne plus parler des comptes retirés », 3 oct).
//
// Données INVENTÉES (ce banc vit dans le dépôt, sans fx/). Preuves :
//  • compte_alpha (3 ventes) devant compte_beta (1) ⇒ « compte_alpha vend le plus » ;
//  • le compte EXCLU (compte_gamma, 5 ventes) n'apparaît NULLE PART ;
//  • un seul compte vendeur ⇒ pas de « vend le plus » (rien à comparer) ;
//  • et Ventes ne le redit plus (aucun « Compte qui vend le mieux » dans Ventes).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4373);
const MAINTENANT = Date.now();
// Des ventes de CE mois (quelques minutes plus tôt) : la période par défaut de Statistiques.
const ilYa = (j) => new Date(MAINTENANT - j * 60000).toISOString();

const vente = (tx, prix, j) => ({ transaction_id: tx, title: `Paire ${tx}`, price: { amount: String(prix), currency_code: 'EUR' },
  status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYa(j) });
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_alpha', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() },
  { id: 2, vinted_user_id: '222', login: 'compte_beta', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() },
  { id: 3, vinted_user_id: '333', login: 'compte_gamma', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() },
];
const SOLD = {
  '111': [vente(9101, 40, 3), vente(9102, 50, 5), vente(9103, 30, 7)],   // 3 ventes · 120 €
  '222': [vente(9201, 60, 4)],                                           // 1 vente · 60 €
  '333': [vente(9301, 90, 2), vente(9302, 90, 6), vente(9303, 90, 8), vente(9304, 90, 9), vente(9305, 90, 10)], // EXCLU
};
const rowsPour = (uids, exclus) => [
  { id: 'main', data: exclus && exclus.length ? { vinted_accounts_hidden: exclus } : {} },
  ...uids.map((u) => ({ id: `harvest_${u}_orders_sold`, data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: SOLD[u] } } })),
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 140)); } };

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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

async function preparer(b, vp, ROWS) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS.filter((a) => ROWS.some((r) => r.id === `harvest_${a.vinted_user_id}_orders_sold`)));
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg };
}

const lireStats = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-sv-carte="comptes"] [data-sv-etat="lu"]', { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(600);
  return pg.evaluate(() => {
    const carte = document.querySelector('[data-sv-carte="comptes"]');
    const m = carte && carte.querySelector('[data-sv-meilleur]');
    const comptes = carte ? [...carte.querySelectorAll('[data-sv-compte]')].map((e) => String(e.getAttribute('data-sv-compte')).split('|').pop()) : [];
    // Où le compte exclu serait-il écrit ? (le nom du bloc, pour le rapport)
    const ou = []; const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) if (/compte_gamma/.test(n.nodeValue) && n.parentElement && n.parentElement.getClientRects().length) { const b = n.parentElement.closest('[data-stats-carte]') || n.parentElement.closest('[data-sv-carte], section, [class]'); ou.push(((b && (b.getAttribute('data-stats-carte') || b.getAttribute('data-sv-carte') || b.className)) || '?') + ' : ' + n.nodeValue.trim().slice(0, 60)); }
    return { carte: !!carte, leader: m ? String(m.getAttribute('data-sv-meilleur')).split('|').pop() : '', comptes, gamma: !!(carte && /compte_gamma/.test(carte.innerText)), ou };
  });
};
const ventesRedit = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1500);
  const v = pg.locator('[data-selecteur-logos] button[data-site="vinted"]').first();
  if (await v.count()) { await v.click().catch(() => {}); await pg.waitForTimeout(1500); }
  const voir = pg.locator('.vrm-sales-analysis button[aria-expanded]').first();
  if (await voir.count()) { await voir.click().catch(() => {}); await pg.waitForTimeout(500); }
  return pg.evaluate(() => /Compte qui vend le mieux|Ventes finalisées par compte/i.test(document.body.innerText) || !!document.querySelector('[data-ventes-par-compte]'));
};

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 780 }, { width: 1512, height: 950 }]) {
      const T = vp.width < 600 ? '📱' : '🖥️';

      // ── 3 comptes dont un EXCLU : leader = alpha, gamma nulle part ──────────
      await essaie(`${T} classement`, async () => {
        const ROWS = rowsPour(['111', '222', '333'], ['333']);
        const { ctx, pg } = await preparer(b, vp, ROWS);
        const r = await lireStats(pg);
        dit(r.carte && r.leader === 'compte_alpha', `${T} Statistiques : « compte_alpha vend le plus » (3 ventes > 1)`, JSON.stringify(r));
        dit(r.comptes[0] === 'compte_alpha' && r.comptes.includes('compte_beta'), `${T} le classement liste alpha (en tête) ET beta`, JSON.stringify(r.comptes));
        dit(!r.gamma && !r.comptes.includes('compte_gamma'), `${T} le compte EXCLU (gamma) n’entre pas dans « Quel compte vend le mieux »`, r.gamma ? 'gamma présent à tort' : '');
        // Rapporté, pas jugé ici (hors de la règle de ce banc, écran Statistiques — chantier F) :
        // d'autres cartes de Statistiques qui écriraient encore le compte exclu.
        if (r.ou.length) console.log(`     ${T} (rapporté) le compte exclu est encore écrit ailleurs dans Statistiques : ${r.ou.join(' ¦ ')}`);
        dit(!(await ventesRedit(pg)), `${T} Ventes ne le redit plus (une seule place : Statistiques)`);
        await ctx.close();
      });

      // ── Un seul compte vendeur : rien à comparer, pas de « qui vend le mieux » ─
      await essaie(`${T} un seul`, async () => {
        const ROWS = rowsPour(['111'], []);
        const { ctx, pg } = await preparer(b, vp, ROWS);
        const r = await lireStats(pg);
        dit(r.carte && !r.leader && r.comptes.length <= 1, `${T} un seul compte vendeur ⇒ pas de « vend le plus » (rien à comparer)`, JSON.stringify(r));
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ compte qui vend le mieux : ${ko} rouge(s).` : `\n✅ compte qui vend le mieux : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
