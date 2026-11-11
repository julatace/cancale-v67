// Banc : eBAY → ACHATS, « NOUVELLES ANNONCES POUR TES RECHERCHES » (11 nov., lot alertes-ebay)
// Données INVENTÉES. Rend l'onglet à 390 px (tactile, clair) et 1512 px (sombre) et juge
// les `data-*` posés par l'écran et ce qui PART vers `/api/ebay` (action `alertes`) et
// `/api/compte?mode=operations` (`veille.alerte`) :
//   · la liste lue par la route : photo, prix, port (inconnu dit), lien eBay, 44 px ;
//   · la marge POSSIBLE avec SES chiffres : son prix de revente (120 € − 60 € port
//     compris = au plus 60 €), sinon la MÉDIANE de ses ventes Vinted du modèle
//     (80/90/150 ⇒ 90 €), port inconnu ⇒ « au plus » ; jamais « bonne affaire » ;
//   · « Retirer » envoie l'itemId et la ligne part ;
//   · « Me prévenir » sur une recherche du fil ⇒ `veille.alerte` (alerte, revente, site) ;
//   · route muette ⇒ « — » et la raison, un « Réessayer » ; aucun débordement.
//        BANC_PORT=9502 node -r ./scripts/bancs/_porte-banc.cjs -r ./scripts/bancs/_garde-reseau.cjs scripts/bancs/alertes-ebay.cjs
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9502;
const auj = new Date();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const il = (n) => new Date(auj.getTime() - n * 86400000);
const vente = (id, prix, titre) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande finalisée', date: il(3 + (id % 5)).toISOString() });
const rows = [
  { id: 'main', data: {} },
  { id: 'ebay_comptes', data: { comptes: [{ cle: 'aaaaaaaaaaaaaaa1', pseudo: 'paire_perso', principal: true }] } },
  { id: 'ebay_orders', data: { orders: [], capturedAt: Date.now() } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: [vente(9001, 80, 'Adidas Samba OG noir 42'), vente(9002, 90, 'Adidas Samba OG blanc 42'), vente(9003, 150, 'Adidas Samba OG vert 42')] } } },
];
const V = (id, titre, mots, x) => ({ id, titre, mots, pointure: '42', exclus: '', categorie: '', etatArticle: 'tous', minimum: null, maximum: 9000, pays: 'tous', achatImmediat: true, livraisonFR: true, etat: 'preparee', version: 1, cree: '2026-11-0' + (id.slice(-1)) + 'T10:00:00.000Z', evenements: [], ...x });
const V1 = V('00000000-0000-4000-8000-000000000001', 'Samba avec mon prix', 'adidas samba', { alerte: true, revente: 12000, reventeSite: 'vinted' });
const V2 = V('00000000-0000-4000-8000-000000000002', 'Samba médiane', 'samba og', { alerte: true, revente: null });
const V3 = V('00000000-0000-4000-8000-000000000003', 'Dunk sans alerte', 'nike dunk');
const n = (itemId, veille, recherche, prix, port, t) => ({ itemId, veille, recherche, titre: t, photo: null, url: 'https://www.ebay.fr/itm/' + itemId.replace(/\D/g, ''), prix, port, total: port == null ? null : prix + port, etat: 'Occasion', pays: 'FR', vueA: new Date(auj.getTime() - 3600e3).toISOString() });
const NOUVELLES = () => [
  n('v1|501|0', V1.id, V1.titre, 5500, 500, 'Adidas Samba OG noir taille 42'),
  n('v1|502|0', V2.id, V2.titre, 5500, 500, 'Adidas Samba OG blanc taille 42'),
  n('v1|503|0', V1.id, V1.titre, 7000, null, 'Adidas Samba OG gris taille 42'),
];
let ko = 0, routeKo = false, liste = NOUVELLES(), envois = [], ops = [];
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
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
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
let veillesBanc = [V1, V2, V3];
async function ouvrir(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (s) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString() });
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.route('**/api/compte?mode=operations**', (route) => {
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    const donnees = () => ({ version: 1, revision: 4 + ops.length, missions: [], reservations: [], lots: [], consommables: [], veilles: veillesBanc, receptions: [], dossiers: [], journal: [], commandes: [] });
    if (route.request().method() === 'POST') {
      let c = {}; try { c = JSON.parse(route.request().postData() || '{}'); } catch (_) {}
      ops.push(c);
      if (c.type === 'veille.alerte') veillesBanc = veillesBanc.map((v) => (v.id === c.donnees.cible ? { ...v, alerte: c.donnees.alerte, revente: c.donnees.revente, reventeSite: c.donnees.site } : v));
      return j({ ok: true, donnees: donnees(), equipe: [], serveur: new Date().toISOString(), confirmees: [c.id] });
    }
    return j({ ok: true, donnees: donnees(), equipe: [], serveur: new Date().toISOString(), confirmees: [] });
  });
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    if (body.action === 'alertes') {
      envois.push(body);
      if (routeKo) return j({ ok: false, reason: 'pas-su', error: 'Je n’ai pas pu lire tes alertes eBay — rien n’est perdu. Réessaie dans un moment.' }, 503);
      if (body.op === 'ecarter') liste = liste.filter((x) => !body.itemIds.includes(x.itemId));
      const at = new Date(auj.getTime() - 3600e3).toISOString();
      return j({ ok: true, lue: true, nouvelles: liste, recherches: { [V1.id]: { at, n: 12, echec: null, premiere: '2026-11-10T10:00:00.000Z', refus: null }, [V2.id]: { at, n: 3, echec: 'ebay', premiere: null, refus: null } }, dernier: { at, raison: null }, limites: { parHeure: 4, intervalleMin: 60, partAuto: 150, plafondJour: 200 } });
    }
    if (body.action === 'chercher') return j({ ok: true, items: [], total: 0, horsBudget: 0, exclus: 0, autreDevise: 0, criteres: body, appels: { aujourdhui: 1, plafond: 200 }, quotaEbay: null, plafondEbayDoc: 5000, octets: { ebay: 100, vrm: 100 }, lueA: new Date().toISOString() });
    if (body.action === 'status') return j({ ok: true, connected: true, comptes: [{ cle: 'aaaaaaaaaaaaaaa1', pseudo: 'paire_perso', principal: true, relie: true }] });
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}
const ouvrirAchats = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay&section=achats`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-alertes-ebay]', { timeout: 20000 });
};
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true]]) {
      console.log(`── ${vp.width} px${sombre ? ' · sombre' : ''}`);
      routeKo = false; liste = NOUVELLES(); envois = []; ops = []; veillesBanc = [V1, V2, V3];
      let { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      await essaie('la liste', async () => {
        await ouvrirAchats(pg);
        await pg.waitForSelector('[data-alerte-ebay="v1|501|0"]', { timeout: 15000 });
        await pg.waitForFunction(() => document.querySelector('[data-alertes-ebay]').getAttribute('data-alertes-allumees') === '2', null, { timeout: 15000 });
        dit(await pg.$eval('[data-alertes-ebay]', (e) => e.getAttribute('data-alertes-ebay')) === '3', 'la liste lue par la route : 3 nouvelles annonces');
        dit(envois[0] && envois[0].op === 'lire', 'la lecture part par l’action `alertes` (op lire)', JSON.stringify(envois[0]));
        // Les marges : la médiane exige les ventes lues (la coque les lit en même temps).
        await pg.waitForFunction(() => { const e = document.querySelector('[data-alerte-ebay="v1|502|0"] [data-alerte-marge]'); return e && e.getAttribute('data-alerte-marge') !== 'pas-su'; }, null, { timeout: 15000 }).catch(() => {});
        const m = await pg.$$eval('[data-alerte-ebay]', (l) => l.map((e) => { const x = e.querySelector('[data-alerte-marge]'); return { id: e.getAttribute('data-alerte-ebay'), m: x.getAttribute('data-alerte-marge'), b: x.getAttribute('data-alerte-borne'), t: x.innerText }; }));
        const g = Object.fromEntries(m.map((x) => [x.id, x]));
        dit(g['v1|501|0'].m === '6000' && g['v1|501|0'].b === 'au-plus' && /au plus 60[\s\u00a0]€/.test(g['v1|501|0'].t) && /ton prix/.test(g['v1|501|0'].t), 'son prix de revente : 120 € − 60 € port compris = au plus 60 €', JSON.stringify(g['v1|501|0']));
        dit(g['v1|502|0'].m === '3000' && /médiane de tes 3 ventes/.test(g['v1|502|0'].t), 'sans son prix : la médiane de ses 3 ventes du modèle (90 €) ⇒ au plus 30 €', JSON.stringify(g['v1|502|0']));
        dit(g['v1|503|0'].m === '5000' && g['v1|503|0'].b === 'au-plus', 'port inconnu : 120 € − 70 € = au plus 50 € (jamais gratuit)', JSON.stringify(g['v1|503|0']));
        const txt = await pg.innerText('[data-alertes-ebay]');
        dit(/port non indiqué/.test(txt) && /port compris|de port/.test(txt), 'le port est dit (inconnu nommé)');
        dit(!/bonne affaire|bon plan|à saisir/i.test(txt), 'aucun verdict « bonne affaire »');
        dit((txt.match(/L’emballage n’est pas compté/g) || []).length === 1, 'la phrase de la marge est dite UNE fois, sous la liste (§7)');
        const liens = await pg.$$eval('[data-alerte-ebay] [data-voir-ebay]', (l) => l.map((a) => ({ h: a.getAttribute('href'), haut: a.getBoundingClientRect().height })));
        dit(liens.length === 3 && liens.every((x) => /^https:\/\/www\.ebay\.fr\/itm\/\d+$/.test(x.h) && x.haut >= 44), '« Voir sur eBay » vers eBay, 44 px', JSON.stringify(liens[0]));
        const hb = await pg.$$eval('[data-alerte-retirer]', (l) => l.map((e) => e.getBoundingClientRect().height));
        dit(hb.length === 3 && hb.every((h) => h >= 44), '« Retirer » : 44 px', JSON.stringify(hb));
        await pg.click('[data-alertes-recherches] > summary');
        const etats = await pg.$$eval('[data-alerte-recherche]', (l) => l.map((e) => e.getAttribute('data-alerte-recherche-etat')));
        dit(etats.join(',') === 'echec,lue', 'tes alertes : l’état de chaque recherche, la plus récente d’abord (eBay n’a pas répondu, lue)', etats.join(','));
        dit((await deborde(pg)) <= 0, 'aucun débordement horizontal', String(await deborde(pg)));
        if (process.env.SHOT) await pg.screenshot({ path: path.join(process.env.SHOT, 'alertes-ebay-' + vp.width + '.png'), fullPage: false, clip: await pg.$eval('[data-alertes-ebay]', (e) => { e.scrollIntoView(); const r = e.getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top - 8), width: document.documentElement.clientWidth, height: Math.min(r.height + 16, 1400) }; }) });
      });
      await essaie('retirer', async () => {
        await pg.click('[data-alerte-ebay="v1|503|0"] [data-alerte-retirer]');
        await pg.waitForSelector('[data-alerte-ebay="v1|503|0"]', { state: 'detached', timeout: 10000 });
        const e = envois.find((x) => x.op === 'ecarter');
        dit(e && JSON.stringify(e.itemIds) === '["v1|503|0"]', '« Retirer » envoie l’itemId de CETTE annonce', JSON.stringify(e));
      });
      await essaie('me prévenir', async () => {
        const bouton = await pg.waitForSelector('[data-veille-alerte="eteinte"]', { timeout: 15000 });
        await bouton.click();
        await pg.waitForSelector('.ops-action', { timeout: 10000 });
        await pg.fill('.ops-action input[inputmode="decimal"]', '110');
        await pg.click('.ops-action .ops-primaire');
        await pg.waitForFunction(() => document.querySelector('[data-alertes-ebay]').getAttribute('data-alertes-allumees') === '3', null, { timeout: 10000 });
        const o = ops.find((x) => x.type === 'veille.alerte');
        dit(o && o.donnees.cible === V3.id && o.donnees.alerte === true && o.donnees.revente === 11000 && o.donnees.site === 'vinted', '« Me prévenir » ⇒ `veille.alerte` (alerte, SON prix 110 €, site)', JSON.stringify(o && o.donnees));
        dit(!!(await pg.$('[data-veille-alerte="allumee"]')), 'la recherche dit « Arrêter l’alerte » ensuite');
      });
      await ctx.close();
      await essaie('pas su', async () => {
        routeKo = true;
        ({ ctx, pg, errs } = await ouvrir(b, vp, sombre));
        await ouvrirAchats(pg);
        await pg.waitForSelector('[data-alertes-etat="pas-su"]', { timeout: 15000 });
        const t = await pg.innerText('[data-alertes-etat="pas-su"]');
        dit(/^—/.test(t.trim()) && /rien n’est perdu/.test(t) && /Réessayer/.test(t) && !(await pg.$('[data-alertes-liste]')), 'route muette : « — », la raison, un « Réessayer », aucune liste', t.replace(/\s+/g, ' '));
        routeKo = false;
        await pg.click('[data-alertes-etat="pas-su"] button');
        await pg.waitForSelector('[data-alertes-liste]', { timeout: 10000 });
        dit(true, '« Réessayer » relit la liste');
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a levé', String(e && e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} alertes-ebay : ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
