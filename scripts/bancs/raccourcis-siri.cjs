// ── BANC : SIRI / RACCOURCIS (10 novembre, lot AH) ─────────────────────────────
// Deux liens profonds que l'app Raccourcis de l'iPhone ouvre (src/raccourcisSiri.js).
// Données INVENTÉES (aucune fx/). Aux deux tailles (390 tactile, 1512), clair et sombre :
//  • `?tab=achats&achat=1&titre=…&prix=45.50&ou=Brocante` : Achats, « Nouvel achat »
//    OUVERT, pré-rempli (titre, « 45,50 », Brocante, date du jour) ; l'adresse est
//    effacée ; RIEN n'est écrit tant qu'il ne touche pas « Ajouter l'achat » ; puis son
//    clic l'écrit dans `vinted_offvinted_buys` ;
//  • `?achat=1&titre=…` sans `tab` : la même saisie ;
//  • un prix illisible (« quarante ») laisse le champ VIDE ;
//  • `?tab=journee&q=cent vingt-quatre` : la loupe ouverte sur « 124 », adresse effacée ;
//  • Paramètres → « Siri et Raccourcis » : les deux liens exacts, 3 étapes chacun,
//    « Copier le lien » ≥ 44 px, aucun débordement.
// `BANC_PORT` (défaut 4683), `BANC_CAPTURES=dossier`.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4683);
const CAPTURES = process.env.BANC_CAPTURES || '';

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const ACHATS = [
  { transaction_id: 9401, title: 'Achat Vinted banc 41', price: { amount: '30', currency_code: 'EUR' },
    status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: ilYa(4) },
];
const VENTES = [
  { transaction_id: 9301, title: 'Nike Banc sans lien taille 42', price: { amount: '80', currency_code: 'EUR' },
    status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYa(2) },
];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const ROWS = [
  { id: 'main', data: {} },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: ACHATS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: VENTES } } },
];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

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

async function preparer(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = []; // chaque ligne écrite : { id, data }
  const rows = ROWS.map((r) => ({ id: r.id, data: JSON.parse(JSON.stringify(r.data)) }));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
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
const achatsEcrits = (ecrits) => ecrits.filter((e) => e.id === 'main' && Array.isArray((e.data || {}).vinted_offvinted_buys) && e.data.vinted_offvinted_buys.length);

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const T = (vp.width < 600 ? '📱' : '🖥️') + (sombre ? '🌙' : '☀️');
        const tap = async (pg, sel) => { if (vp.width < 600) await pg.locator(sel).first().tap(); else await pg.locator(sel).first().click(); };
        const suffixe = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;

        // ── « Ajouter un achat » pré-rempli ───────────────────────────────────
        await essaie(`${T} achat pré-rempli`, async () => {
          const { ctx, pg, errs, ecrits, dernierMain } = await preparer(b, vp, sombre);
          await pg.goto(`http://localhost:${PORT}/?tab=achats&achat=1&titre=${encodeURIComponent('Nike Dunk Low banc 42')}&prix=45.50&ou=Brocante`, { waitUntil: 'domcontentloaded' });
          await pg.locator('[data-achat-hors-form]').first().waitFor({ timeout: 15000 });
          dit(true, `${T} le lien ouvre « Nouvel achat » sur Achats`);
          dit((await pg.inputValue('[data-champ="titre"]')) === 'Nike Dunk Low banc 42', `${T} titre pré-rempli`);
          dit((await pg.inputValue('[data-champ="prix"]')) === '45,50', `${T} prix « 45.50 » ⇒ « 45,50 »`, await pg.inputValue('[data-champ="prix"]'));
          dit((await pg.inputValue('[data-champ="lieu"]')) === 'Brocante', `${T} lieu pré-rempli`);
          const auj = await pg.evaluate(() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); });
          dit((await pg.inputValue('[data-champ="date"]')) === auj, `${T} date du jour`);
          dit((await pg.evaluate(() => window.location.search)) === '', `${T} l’adresse est effacée après lecture`);
          await pg.waitForTimeout(2200);
          dit(achatsEcrits(ecrits).length === 0, `${T} rien n’est écrit sans son clic`);
          const vu = await pg.evaluate(() => { const f = document.querySelector('[data-achat-hors-form]'); if (!f) return null; const r = f.getBoundingClientRect(); return { top: Math.round(r.top), h: window.innerHeight }; });
          dit(!!vu && vu.top >= 0 && vu.top < vu.h * 0.7, `${T} le formulaire est en vue, sans défiler`, JSON.stringify(vu));
          dit((await deborde(pg)) <= 1, `${T} aucun débordement horizontal`);
          await capture(pg, `achat-${suffixe}`);
          await tap(pg, '[data-achat-hors-enregistrer]');
          await pg.locator('[data-achat-hors-id]').first().waitFor({ timeout: 6000 });
          await pg.waitForTimeout(1800);
          const rec = (((dernierMain() || {}).vinted_offvinted_buys) || [])[0];
          dit(!!rec && rec.title === 'Nike Dunk Low banc 42' && rec.price === '45,50' && rec.source === 'Brocante' && rec.date === auj, `${T} son clic l’écrit (titre, 45,50, Brocante)`, JSON.stringify(rec || null).slice(0, 140));
          dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 160));
          await ctx.close();
        });

        if (!sombre) {
          // ── sans `tab`, et prix illisible ─────────────────────────────────
          await essaie(`${T} achat sans tab`, async () => {
            const { ctx, pg, ecrits } = await preparer(b, vp, sombre);
            await pg.goto(`http://localhost:${PORT}/?achat=1&titre=Samba&prix=quarante`, { waitUntil: 'domcontentloaded' });
            await pg.locator('[data-achat-hors-form]').first().waitFor({ timeout: 15000 });
            dit((await pg.inputValue('[data-champ="titre"]')) === 'Samba', `${T} sans \`tab\` : la saisie s’ouvre aussi`);
            dit((await pg.inputValue('[data-champ="prix"]')) === '', `${T} prix illisible ⇒ champ vide (jamais deviné)`);
            dit((await pg.evaluate(() => window.location.search)) === '', `${T} adresse effacée (sans \`tab\`)`);
            await pg.waitForTimeout(1500);
            dit(achatsEcrits(ecrits).length === 0, `${T} rien n’est écrit`);
            await ctx.close();
          });
        }

        // ── « Où est le N° » ─────────────────────────────────────────────────
        await essaie(`${T} où est le N°`, async () => {
          const { ctx, pg, errs } = await preparer(b, vp, sombre);
          await pg.goto(`http://localhost:${PORT}/?tab=journee&q=${encodeURIComponent('cent vingt-quatre')}`, { waitUntil: 'domcontentloaded' });
          await pg.waitForFunction(() => { const c = document.querySelector('[data-recherche-champ]'); return c && c.value === '124'; }, null, { timeout: 15000 });
          dit(true, `${T} la loupe s’ouvre sur « 124 » (dictée lue)`);
          dit((await pg.locator('[data-recherche-zone][data-recherche-ouverte="1"], [data-recherche-loupe][aria-expanded="true"]').count()) >= 1, `${T} la recherche est ouverte`);
          dit((await pg.evaluate(() => window.location.search)) === '', `${T} l’adresse est effacée après lecture`);
          dit((await deborde(pg)) <= 1, `${T} aucun débordement horizontal`);
          await pg.waitForTimeout(800);
          await capture(pg, `numero-${suffixe}`);
          dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 160));
          await ctx.close();
        });

        // ── Paramètres → Siri et Raccourcis ───────────────────────────────────
        await essaie(`${T} aide Paramètres`, async () => {
          const { ctx, pg, errs } = await preparer(b, vp, sombre);
          await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
          await pg.locator('[data-sous-ouvrir="raccourcis-siri"]').first().waitFor({ timeout: 15000 });
          await tap(pg, '[data-sous-ouvrir="raccourcis-siri"]');
          await pg.locator('[data-raccourcis-siri]').first().waitFor({ timeout: 5000 });
          const l1 = await pg.locator('[data-raccourci-lien="achat"]').innerText();
          const l2 = await pg.locator('[data-raccourci-lien="numero"]').innerText();
          dit(l1.trim() === 'https://vrm.center/?tab=achats&achat=1', `${T} lien « Ajouter un achat » exact`, l1);
          dit(l2.trim() === 'https://vrm.center/?tab=journee&q=', `${T} lien « Où est le N° » exact`, l2);
          dit((await pg.locator('[data-raccourci-etapes="achat"] li').count()) === 3 && (await pg.locator('[data-raccourci-etapes="numero"] li').count()) === 3, `${T} trois étapes par raccourci`);
          dit((await hauteur(pg, '[data-raccourci-copier="achat"]')) >= 44, `${T} « Copier le lien » ≥ 44 px`);
          dit((await deborde(pg)) <= 1, `${T} aucun débordement horizontal`);
          await capture(pg, `aide-${suffixe}`);
          dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 160));
          await ctx.close();
        });
      }
    }
  } finally {
    if (b) await b.close();
    srv.close();
  }
  console.log(ko ? `\n❌ raccourcis-siri : ${ko} rouge(s)` : '\n✅ raccourcis-siri : tout vert');
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.log('KO  ' + (e && e.message)); process.exit(1); });
