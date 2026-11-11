// ── BANC : ACHATS LUS DANS LES E-MAILS (11 nov., lot achats-auto) ────────────
// Données INVENTÉES. Les lignes que la route `api/email-inbound.js` écrit
// (`achat_email_{site}_{n°}`, `achat_email_verif_*`), servies dans la projection
// réelle (`SELECT_ACHATS_EMAIL`). Preuves, à 390 px tactile et 1512 px :
//  • la carte « Achats lus dans tes e-mails » dit 3 lus · 1 à vérifier ;
//  • nouveau (eBay) ⇒ « Ajouter à mes achats » ; son toucher écrit UNE entrée dans
//    `vinted_offvinted_buys` (ref = n° de commande, prix lu « 51,50 », prixSource email) ;
//  • Vestiaire déjà saisi à la main avec le même n° ⇒ « relié », « Compléter » ne
//    remplit que ses vides (son prix reste) ;
//  • remboursé (Leboncoin) ⇒ dit, aucun bouton ;
//  • « à vérifier » dit sa raison ; cibles ≥ 44 px ; aucun débordement.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4472);
const CAPTURES = process.env.BANC_CAPTURES || '';
const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const prix = (article, port, protection, total) => ({ article, port, protection, total, devise: 'EUR', source: 'email' });
const ROWS = [
  { id: 'main', data: { vinted_offvinted_buys: [{ id: 'ob_main1', title: '', price: '130,00', date: '', source: '', ref: '55512345' }] } },
  { id: 'achat_email_ebay_123456789012', data: { site: 'ebay', commande: '12-34567-89012', cle: '123456789012', titre: 'Baskets cuir blanc pointure 42 (banc)', date: ilYa(1), prix: prix(45, 6.5, null, 51.5), photo: '', suivi: '6A12345678901', annule: '', rembourse: '', desaccords: [], emails: [] } },
  { id: 'achat_email_vestiaire_55512345', data: { site: 'vestiaire', commande: '55512345', cle: '55512345', titre: 'Sac en toile beige (banc)', date: ilYa(3), prix: prix(120, 9, 15, 144), photo: '', suivi: '', annule: '', rembourse: '', desaccords: [], emails: [] } },
  { id: 'achat_email_leboncoin_lbc9876543', data: { site: 'leboncoin', commande: 'LBC9876543', cle: 'lbc9876543', titre: 'Sneakers montantes noires (banc)', date: ilYa(5), prix: prix(80, 4.99, 4.7, 89.69), photo: '', suivi: '', annule: '', rembourse: ilYa(2), desaccords: [], emails: [] } },
  { id: 'achat_email_verif_leboncoin_abc', data: { site: 'leboncoin', famille: 'confirmation', raison: 'aucun n° de commande lisible : VRM ne rapproche jamais par le titre', lecture: { site: 'leboncoin', famille: 'confirmation', numeros: [], titre: 'Nike banc à vérifier' }, emailAt: ilYa(0), aVerifier: true } },
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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

async function preparer(b, vp) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = []; // chaque ligne écrite : { id, data }
  const rows = ROWS.map((r) => ({ id: r.id, data: JSON.parse(JSON.stringify(r.data)) }));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      if (/\/rest\/v1\/app_data/.test(u) && req.method() === 'POST') {
        try {
          let corps = JSON.parse(req.postData() || '[]'); if (!Array.isArray(corps)) corps = [corps];
          for (const l of corps) {
            if (!l || !l.id) continue;
            ecrits.push({ id: l.id, data: l.data });
            const ex = rows.find((r) => r.id === l.id); if (ex) ex.data = l.data; else rows.push({ id: l.id, data: l.data });
          }
        } catch (_) {}
      }
      // (2 nov.) Depuis « Données sûres » (1er nov., `src/fusionNuage.js`), une
      // ligne `main` qui EXISTE s'écrit par PATCH conditionnel sur `data.rev`
      // (`return=representation` : la ligne écrite, [] = devancé). Le banc ne
      // gardait que les POST : il ne voyait plus rien de ce qu'écrit l'app.
      if (/\/rest\/v1\/app_data/.test(u) && req.method() === 'PATCH') {
        const id = (/[?&]id=eq\.([^&]*)/.exec(u) || [])[1];
        let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {}
        const ex = id && rows.find((r) => r.id === id);
        if (ex && corps && corps.data !== undefined) {
          ecrits.push({ id, data: corps.data });
          ex.data = corps.data;
          return j([{ id }]);
        }
      }
      return j([]);
    }
    // (2 nov.) La base de production est CLOISONNÉE, et depuis « Données sûres »
    // (1er nov.) l'app n'écrit la ligne `main` que sur une base cloisonnée : la
    // sonde de schéma (`select=owner&limit=1`) répond donc comme la production.
    if (/select=owner&limit=1/.test(u)) return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  const dernierMain = () => { const m = ecrits.filter((e) => e.id === 'main'); return m.length ? m[m.length - 1].data || {} : null; };
  return { ctx, pg, errs, ecrits, dernierMain };
}
const hauteur = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : 0; }, sel);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const capture = async (pg, nom) => { if (!CAPTURES) return; try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width < 600 ? '📱' : '🖥️';
      const tap = async (pg, sel) => { if (vp.width < 600) await pg.locator(sel).first().tap(); else await pg.locator(sel).first().click(); };
      await essaie(`${T} achats lus dans les e-mails`, async () => {
        const { ctx, pg, errs, ecrits, dernierMain } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats&vue=achats`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-achats-email="lu"]').first().waitFor({ timeout: 15000 });
        const carte = pg.locator('[data-achats-email="lu"]').first();
        dit((await carte.getAttribute('data-nouveaux')) === '1' && (await carte.getAttribute('data-a-verifier')) === '1', `${T} la carte : 1 nouveau, 1 à vérifier`);
        await tap(pg, '[data-achats-email="lu"] button[aria-expanded]');
        await pg.locator('[data-achat-email]').first().waitFor({ timeout: 4000 });
        const etat = async (id) => pg.locator(`[data-achat-email="${id}"]`).getAttribute('data-etat');
        dit(await etat('achat_email_ebay_123456789012') === 'nouveau' && await etat('achat_email_vestiaire_55512345') === 'relie' && await etat('achat_email_leboncoin_lbc9876543') === 'annule', `${T} états : nouveau · relié par le n° · remboursé`);
        dit((await pg.locator('[data-achat-email="achat_email_leboncoin_lbc9876543"] button').count()) === 0, `${T} remboursé : aucun bouton (hors dépenses)`);
        dit((await pg.locator('[data-a-verifier-ligne]').count()) === 1, `${T} l’e-mail à vérifier est dit avec sa raison`);
        dit((await hauteur(pg, '[data-ajouter]')) >= 44 && (await hauteur(pg, '[data-completer]')) >= 44, `${T} boutons ≥ 44 px`);
        dit((await deborde(pg)) <= 0, `${T} aucun débordement horizontal`);
        await pg.locator('[data-achats-email="lu"]').scrollIntoViewIfNeeded();
        await capture(pg, 'achats-email-' + vp.width);
        await tap(pg, '[data-completer]');
        await pg.waitForTimeout(400);
        let l = (dernierMain() || {}).vinted_offvinted_buys || [];
        const v = l.find((x) => x.id === 'ob_main1');
        dit(!!v && v.price === '130,00' && v.title === 'Sac en toile beige (banc)' && v.achatEmail === 'achat_email_vestiaire_55512345', `${T} « Compléter » : ses vides remplis, SON prix reste`, JSON.stringify(v || null).slice(0, 200));
        await tap(pg, '[data-ajouter]');
        await pg.waitForTimeout(400);
        l = (dernierMain() || {}).vinted_offvinted_buys || [];
        const e = l.find((x) => x.ref === '12-34567-89012');
        dit(!!e && e.price === '51,50' && e.prixSource === 'email' && e.source === 'eBay' && l.length === 2, `${T} « Ajouter » : UNE entrée, prix lu 51,50 marqué e-mail`, JSON.stringify(e || null).slice(0, 200));
        dit(await etat('achat_email_ebay_123456789012') === 'relie', `${T} après l’ajout, l’achat lu est « relié » (jamais en double)`);
        await capture(pg, 'achats-email-apres-' + vp.width);
        dit(!errs.length, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} KO` : '\nOK achats-email : tout est vert');
  process.exit(ko ? 1 : 0);
}
main();
