// ── BANC : FICHE À L'ARRIVÉE D'UN ACHAT (G11) ───────────────────────────────
// Quand une paire ACHETÉE arrive (reçue), elle est prête à remettre en vente.
// Le seul pont honnête vers la revente est de reporter le PRIX PAYÉ vers le
// numérotage (G1 le redemande à ce moment-là) : le menu ⋯ d'un achat ARRIVÉ
// porte « Copier le prix payé ». Mesuré avant de coder : un achat ne porte NI
// taille NI (le plus souvent) photo — la fiche, c'est la carte existante ; le
// manque était le report du prix. On ne relie RIEN automatiquement (§5).
//
// Données INVENTÉES (ce banc vit dans le dépôt, sans fx/). Preuves :
//  • un achat ARRIVÉ → le menu ⋯ porte « Copier le prix payé » = le prix payé ;
//  • cliquer copie VRAIMENT (clavier autorisé → toast de succès avec le prix) ;
//  • ⚠️ une promesse rejetée ne passe PAS par catch : clavier refusé → toast
//    « Copie impossible », jamais « copié » (réaffaiblir à try{writeText}catch
//    le ferait mentir — c'est la preuve qui compte, pas « la fonction est neuve ») ;
//  • un achat ANNULÉ/remboursé → PAS d'entrée « Copier le prix payé » (gated).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4372);

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();

// Un achat ARRIVÉ (finalisé = reçu) à 42,00 € et un achat ANNULÉ à 55,00 €.
const ACHATS = [
  { transaction_id: 9201, title: 'Mike Arrivee taille 42', price: { amount: '42', currency_code: 'EUR' },
    status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: ilYa(5) },
  { transaction_id: 9202, title: 'Bob Annulee taille 41', price: { amount: '55', currency_code: 'EUR' },
    status: 'Remboursement effectué', transaction_user_status: 'failed', date: ilYa(6) },
];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const ROWS = [
  { id: 'main', data: {} },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: ACHATS } } },
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

async function preparer(b, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}), permissions: opts.clavierRefuse ? [] : ['clipboard-read', 'clipboard-write'] });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (opts.clavierRefuse) await pg.addInitScript(() => { try { Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => ({ writeText: () => Promise.reject(new DOMException('refusé', 'NotAllowedError')) }) }); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}

// Va sur Achats, onglet « Tous », et ouvre le menu ⋯ de la carte (par tx).
async function ouvrirMenu(pg, tx) {
  await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  // onglet « Tous » (un achat finalisé = « Reçu », pas sous « À retirer »)
  const tous = pg.locator('button', { hasText: /^Tous$/ });
  await tous.first().waitFor({timeout:10000});await tous.first().click();
  const carte = pg.locator(`[data-achat-tx="${tx}"]`);
  await carte.waitFor({timeout:10000});
  if (!(await carte.count())) return false;
  await carte.locator('button[title="Actions rapides"]').first().click();
  await pg.waitForTimeout(250);
  return true;
}
// Valeur de « Copier le prix payé » DANS la carte donnée (null si absente).
const prixDe = (pg, tx) => pg.evaluate((t) => {
  const c = document.querySelector(`[data-achat-tx="${t}"]`);
  const el = c && c.querySelector('[data-copier-prix]');
  return el ? el.getAttribute('data-copier-prix') : null;
}, tx);

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 780 }, { width: 1512, height: 950 }]) {
      const T = vp.width < 600 ? '📱' : '🖥️';

      // ── Achat ARRIVÉ : le menu porte « Copier le prix payé » = le prix payé ──
      await essaie(`${T} arrivé`, async () => {
        const { ctx, pg } = await preparer(b, vp);
        const ok = await ouvrirMenu(pg, 9201);
        dit(ok, `${T} la carte de l’achat arrivé et son menu ⋯ s’ouvrent`);
        const prix = await prixDe(pg, 9201);
        dit(prix === '42,00', `${T} le menu ⋯ d’un achat arrivé porte « Copier le prix payé » = le prix payé`, prix == null ? 'entrée absente' : prix);
        // cliquer copie VRAIMENT (clavier autorisé) → toast de succès avec le prix
        if (prix != null) {
          await pg.locator('[data-achat-tx="9201"] [data-copier-prix]').first().click();
          await pg.waitForTimeout(300);
          const toasts = await pg.evaluate(() => [...document.querySelectorAll('[role="status"], button')].map(e => e.textContent).filter(Boolean));
          const succes = toasts.some(t => /copié/i.test(t) && t.includes('42,00'));
          dit(succes, `${T} cliquer « Copier le prix payé » copie vraiment (toast « copié … 42,00 »)`, succes ? '' : 'pas de toast de succès');
          let presse = ''; try { presse = await pg.evaluate(() => navigator.clipboard.readText()); } catch (_) {}
          dit(presse === '42,00', `${T} le presse-papier porte « 42,00 »`, presse || '(illisible)');
        }
        await ctx.close();
      });

      // ── Clavier REFUSÉ : jamais « copié » (une promesse rejetée ≠ catch) ─────
      await essaie(`${T} refusé`, async () => {
        const { ctx, pg } = await preparer(b, vp, { clavierRefuse: true });
        const ok = await ouvrirMenu(pg, 9201);
        if (ok) {
          await pg.locator('[data-achat-tx="9201"] [data-copier-prix]').first().click();
          await pg.waitForTimeout(300);
          const toasts = await pg.evaluate(() => [...document.querySelectorAll('button')].map(e => e.textContent).filter(Boolean));
          const ment = toasts.some(t => /copié/i.test(t));
          const avoue = toasts.some(t => /impossible/i.test(t));
          dit(!ment && avoue, `${T} clavier refusé : « Copie impossible », jamais « copié »`, ment ? 'il a menti « copié »' : (avoue ? '' : 'aucun toast'));
        } else dit(false, `${T} refusé : menu introuvable`);
        await ctx.close();
      });

      // ── Achat ANNULÉ : PAS de « Copier le prix payé » (gated sur l’arrivée) ──
      await essaie(`${T} annulé`, async () => {
        const { ctx, pg } = await preparer(b, vp);
        const ok = await ouvrirMenu(pg, 9202);
        dit(ok, `${T} la carte de l’achat annulé et son menu ⋯ s’ouvrent`);
        const prix = await prixDe(pg, 9202);
        dit(prix == null, `${T} un achat annulé/remboursé n’a PAS « Copier le prix payé »`, prix == null ? '' : 'présent à tort : ' + prix);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ fiche à l'arrivée : ${ko} rouge(s).` : `\n✅ fiche à l'arrivée : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
