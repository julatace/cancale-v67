// Banc : eBAY → ACHATS, LA RECHERCHE ET LE FIL (29 octobre) — données INVENTÉES.
// Julien : « Pour le côté achat je comprends pas à quoi ça sert ; je pense que
// tu peux faire la recherche comme pour Vinted, avec un feed ; tout dépend si
// ça utilisera beaucoup de données. »
// Il rend l'onglet eBay → Achats à 390 px (tactile, clair) et 1512 px (sombre),
// avec une horloge pilotée, et juge les `data-*` posés par l'écran et ce qui
// PART vers `/api/ebay` (action `chercher`) :
//   · la recherche part avec les bons critères (mots, pointure, prix max en
//     centimes, achat immédiat, livrable en France) et affiche ses annonces,
//     le port non indiqué dit comme tel, le repère du MODÈLE (ses ventes) dit
//     « le modèle, pas cette paire », « Voir sur eBay » vers eBay, 44 px ;
//   · le fil lit les recherches enregistrées ; première lecture : rien n'est
//     « nouveau » ; à la visite suivante, seule l'annonce jamais vue l'est ;
//   · relecture BORNÉE : rien avant 15 min, une fois après, rien quand la page
//     est cachée ;
//   · plafond atteint ⇒ le fil s'arrête et le dit, plus aucun appel ;
//   · sans session (401) et eBay injoignable (502) ⇒ « pas pu chercher »,
//     jamais « aucune annonce » ;
//   · les achats gagnés sont repliés et ne sont lus qu'à l'ouverture ;
//   · aucun débordement, aucune erreur de page.
//        BANC_PORT=9501 node scripts/bancs/ebay-achats-recherche.cjs
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9501;
const auj = new Date();
// L'horloge de la page ne doit jamais franchir minuit (heure de Paris) pendant le
// banc : le plafond du jour repart à minuit, et un banc lancé à 23 h 50 voyait
// une recherche légitime « après 30 min ». Près de minuit, on part 4 h plus tôt.
const heureParis = parseInt(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }).format(auj), 10);
const DEPART = auj.getTime() - (heureParis >= 22 || heureParis < 1 ? 4 * 3600000 : 0);
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const vente = (id, prix, d) => ({ transaction_id: id, title: 'Salomon XT-6 noir taille ' + (40 + (id % 4)), price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande finalisée', date: d.toISOString() });
const il = (n) => new Date(auj.getTime() - n * 86400000);
const rows = [
  { id: 'main', data: {} },
  { id: 'ebay_comptes', data: { comptes: [{ cle: 'aaaaaaaaaaaaaaa1', pseudo: 'paire_perso', principal: true }] } },
  { id: 'ebay_orders', data: { orders: [], capturedAt: Date.now() } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: [vente(9001, 80, il(3)), vente(9002, 90, il(5)), vente(9003, 100, il(9))] } } },
];
const VEILLE = { id: '00000000-0000-4000-8000-000000000001', titre: 'XT-6 en 43', mots: 'salomon xt-6', pointure: '43', exclus: '', categorie: '', etatArticle: 'tous', minimum: null, maximum: 9000, pays: 'FR', achatImmediat: true, livraisonFR: true, etat: 'preparee', version: 1, cree: '2026-10-20T10:00:00.000Z', evenements: [] };
const item = (id, titre, prix, port) => ({ itemId: id, titre, prix, port, total: port == null ? null : prix + port, etat: 'Occasion', vendeur: 'vendeur_' + id.slice(-1), avis: 99.1, photo: null, url: 'https://www.ebay.fr/itm/' + id.replace(/\D/g, ''), achatImmediat: true, enchere: false, date: auj.toISOString(), pays: 'FR' });
// L'horloge du SERVEUR est en avance de 2 h sur celle de l'appareil (lueA) :
// la borne des 15 min doit se juger sur l'horloge de l'appareil.
let mode = 'normal', appels = [], visite = 1, autres = [];
// (30 oct., revue) Les recherches enregistrées servies, et l'espace qui échoue.
let veillesBanc = [VEILLE], opsKo = false;
const veilleN = (i, extra) => ({ ...VEILLE, id: '00000000-0000-4000-8000-' + String(100 + i).padStart(12, '0'), titre: 'Recherche ' + i, mots: 'salomon xt-6 ' + i, cree: new Date(Date.UTC(2026, 9, 1, 10, i)).toISOString(), ...(extra || {}) });
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
let ko = 0;
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
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
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const reponseChercher = (body) => {
  // La route refuse des critères (400) sans les compter : la règle d'Organisation est la même depuis le 30 oct.
  if (body.categorie && !/^\d{1,10}$/.test(String(body.categorie))) return [400, { ok: false, reason: 'criteres', error: 'Identifiant de catégorie eBay : des chiffres seulement (ex. 15709), ou laisse vide. Rien n’a été envoyé à eBay.' }];
  if (mode === 'ecartees') return [200, { ok: true, items: [], total: 30, horsBudget: 30, exclus: 0, autreDevise: 0, criteres: body, appels: { aujourdhui: appels.length, plafond: 200 }, quotaEbay: null, plafondEbayDoc: 5000, octets: { ebay: 9000, vrm: 400 }, lueA: new Date().toISOString() }];
  if (mode === 'session') return [401, { ok: false, error: 'Ta session VRM a expiré : reconnecte-toi (rien n’a été envoyé à eBay).' }];
  if (mode === 'ebay') return [502, { ok: false, reason: 'ebay', appels: { aujourdhui: appels.length, plafond: 200 }, error: 'Je n’ai pas pu chercher sur eBay (pas de réponse) — ce n’est pas « aucun résultat ». Réessaie dans un moment.' }];
  if (mode === 'plafond') return [429, { ok: false, reason: 'plafond', appels: { aujourdhui: 200, plafond: 200 }, error: 'Tu as fait tes 200 recherches eBay du jour : le fil s’arrête jusqu’à minuit (heure de Paris).' }];
  const base = [item('v1|5001|0', 'Salomon XT-6 noir taille 43', 6000, 650), item('v1|5002|0', 'Salomon XT-6 gris taille 43', 7000, null)];
  let items = visite >= 2 ? [item('v1|5009|0', 'Salomon XT-6 bleu taille 43 neuve', 7500, 500), ...base] : base;
  // La recherche à la main rend aussi un accessoire et une taille enfant : aucun repère de revente dessous.
  if (body.maximum === 7990) items = [...items, item('v1|5101|0', 'Lacets de rechange Salomon XT-6 noirs', 900, 300), item('v1|5102|0', 'Salomon XT-6 enfant taille 30', 3500, 500)];
  return [200, { ok: true, items, total: items.length, horsBudget: 1, exclus: 0, autreDevise: 0, criteres: body, appels: { aujourdhui: appels.length, plafond: 200, jour: '2026-10-29' }, quotaEbay: null, plafondEbayDoc: 5000, octets: { ebay: 18432, vrm: 2150 }, lueA: new Date(Date.now() + 2 * 3600000).toISOString() }];
};
async function ouvrir(b, vp, sombre, etat) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}), ...(etat ? { storageState: etat } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: DEPART });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (s) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
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
    if (opsKo) return j({ ok: false, message: 'erreur' }, 500);
    const donnees = { version: 1, revision: 4, missions: [], reservations: [], lots: [], consommables: [], veilles: veillesBanc, receptions: [], dossiers: [], journal: [], commandes: [] };
    if (route.request().method() === 'POST') { let c = {}; try { c = JSON.parse(route.request().postData() || '{}'); } catch (_) {} autres.push(c); veillesBanc = [...veillesBanc, { ...c.donnees, id: c.id, etat: 'preparee', version: 1, cree: new Date().toISOString(), evenements: [] }]; return j({ ok: true, donnees: { ...donnees, revision: 5, veilles: veillesBanc }, equipe: [], serveur: new Date().toISOString(), confirmees: [c.id] }); }
    return j({ ok: true, donnees, equipe: [], serveur: new Date().toISOString(), confirmees: [] });
  });
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    if (body.action === 'chercher') { appels.push(body); const [st, d] = reponseChercher(body); return j(d, st); }
    autres.push(body);
    if (body.action === 'status') return j({ ok: true, connected: true, comptes: [{ cle: 'aaaaaaaaaaaaaaa1', pseudo: 'paire_perso', principal: true, relie: true }] });
    if (body.action === 'achats') return j({ ok: true, achats: [{ itemId: '4001', titre: 'Achat test Converse', vendeur: 'vendeur_x', prix: '42.00', devise: 'EUR', date: '2026-10-01T10:00:00.000Z' }] });
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}
const ouvrirAchats = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
  await pg.getByRole('button', { name: 'Achats', exact: true }).first().click({ timeout: 15000 });
  await pg.waitForSelector('[data-ebay-recherche]', { timeout: 15000 });
};
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const tic = (pg, ms) => pg.clock.runFor(ms);
(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true]]) {
      console.log(`── ${vp.width} px${sombre ? ' · sombre' : ''}`);
      mode = 'normal'; appels = []; autres = []; visite = 1; veillesBanc = [VEILLE]; opsKo = false;
      let { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      await essaie('le fil, première lecture', async () => {
        await ouvrirAchats(pg);
        await pg.waitForSelector('[data-ebay-fil-recherche] [data-ebay-liste]', { timeout: 15000 });
        const n = await pg.$eval('[data-ebay-fil]', (e) => e.getAttribute('data-ebay-fil'));
        dit(n === '1', 'le fil lit la recherche enregistrée', n);
        dit(appels.length === 1 && appels[0].mots === 'salomon xt-6' && appels[0].pointure === '43' && appels[0].maximum === 9000 && appels[0].achatImmediat === true && appels[0].livraisonFR === true, 'la recherche enregistrée part avec ses critères', JSON.stringify(appels[0] || {}));
        const nv = await pg.$$eval('[data-ebay-fil-recherche] [data-nouveau="oui"]', (l) => l.length);
        dit(nv === 0, 'première lecture : rien n’est marqué « nouveau »', String(nv));
        const txt = await pg.$eval('[data-ebay-fil-recherche]', (e) => e.innerText);
        dit(/port non indiqué/.test(txt), 'un port inconnu est dit « port non indiqué », jamais gratuit');
        dit(!/Achat test Converse/.test(await pg.innerText('body')) && !autres.some((x) => x.action === 'achats'), 'les achats gagnés ne sont pas lus tant que le repli est fermé');
        const don = await pg.$eval('[data-ebay-donnees]', (e) => e.innerText);
        dit(/1 recherche sur 200/.test(don) && /Ko reçus d’eBay/.test(don) && /5 000/.test(don), 'les données : recherches du jour sur le plafond, Ko reçus et envoyés, plafond d’eBay', don.replace(/\s+/g, ' ').slice(0, 220));
        // (30 oct., revue) Le total du jour en Ko sur cet appareil (sa question sur les données).
        dit(!!(await pg.$('[data-ebay-octets-jour]')) && /Aujourd’hui sur cet appareil : 1 recherche/.test(don), 'les données : le total du jour sur cet appareil, en Ko', don.replace(/\s+/g, ' ').slice(0, 260));
        // §7 : deux annonces du même modèle ⇒ le repère est dit UNE fois au-dessus de la liste.
        const nr = await pg.$$eval('[data-ebay-fil-recherche] [data-ebay-repere]', (l) => l.length);
        dit(nr === 1, 'le repère du modèle est dit une fois au-dessus de la liste (pas sur chaque ligne)', nr + ' fois');
        // La pastille « Dans le fil » de l'espace plus bas est lisible (texte et fond contrastés, sombre compris).
        const ct = await pg.$eval('.ops-statut', (e) => { const rgb = (c) => (c.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number); const L = (c) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }; const cs = getComputedStyle(e); const a = L(cs.color), b = L(cs.backgroundColor); return { t: e.textContent, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), c: cs.color, f: cs.backgroundColor }; });
        dit(ct.t === 'Dans le fil' && ct.ratio >= 3, 'la pastille « Dans le fil » est lisible', JSON.stringify(ct));
      });
      await essaie('relecture bornée', async () => {
        const avant = appels.length;
        await tic(pg, 5 * 60 * 1000); await pg.waitForTimeout(300);
        dit(appels.length === avant, 'rien n’est relu avant 15 min', `${appels.length - avant} appel(s)`);
        await pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); });
        await tic(pg, 12 * 60 * 1000); await pg.waitForTimeout(300);
        dit(appels.length === avant, 'page cachée : rien n’est relu, même après 15 min', `${appels.length - avant} appel(s)`);
        await pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
        await pg.waitForTimeout(600);
        dit(appels.length === avant + 1, 'visible et 15 min passées : relue une fois', `${appels.length - avant} appel(s)`);
      });
      await essaie('chercher à la main', async () => {
        const avant = appels.length;
        await pg.fill('[aria-label="Mots à chercher"]', 'salomon xt-6');
        await pg.fill('[aria-label="Pointure"]', '43');
        await pg.fill('[aria-label="Prix maximum"]', '79,90');
        await pg.click('[data-geste="chercher"]');
        await pg.waitForSelector('[data-ebay-liste="manuel"]', { timeout: 10000 });
        const a = appels[avant] || {};
        dit(a.action === 'chercher' && a.mots === 'salomon xt-6' && a.pointure === '43' && a.maximum === 7990 && a.achatImmediat === true && a.livraisonFR === true, 'la recherche part avec mots, pointure, prix max en centimes, achat immédiat, France', JSON.stringify(a));
        const rp = await pg.$$eval('[data-ebay-liste="manuel"] [data-ebay-repere]', (l) => l.map((e) => e.innerText));
        dit(rp.length >= 1 && /xt 6/.test(rp[0]) && /90,00/.test(rp[0]) && /3 de tes ventes/.test(rp[0]) && /le modèle, pas cette paire/.test(rp[0]), 'le repère du MODÈLE (moyenne de ses ventes), dit « le modèle, pas cette paire »', rp[0]);
        const lien = await pg.$eval('[data-ebay-liste="manuel"] [data-voir-ebay]', (e) => ({ href: e.getAttribute('href'), h: e.getBoundingClientRect().height }));
        dit(/^https:\/\/www\.ebay\.fr\/itm\//.test(lien.href) && lien.h >= 44, '« Voir sur eBay » mène à eBay, 44 px au doigt', JSON.stringify(lien));
        const lac = await pg.$$eval('[data-ebay-liste="manuel"] [data-ebay-resultat="v1|5101|0"] [data-ebay-repere], [data-ebay-liste="manuel"] [data-ebay-resultat="v1|5102|0"] [data-ebay-repere]', (l) => l.length);
        const liste = await pg.$$eval('[data-ebay-liste="manuel"] [data-ebay-repere-liste]', (l) => l.length);
        const sous = await pg.$$eval('[data-ebay-liste="manuel"] [data-ebay-resultat="v1|5001|0"] [data-ebay-repere]', (l) => l.length);
        dit(lac === 0 && liste === 0 && sous === 1, 'aucun repère de revente sous des lacets ni une taille enfant (ni au-dessus d’une liste qui en contient)', `lacets/enfant ${lac} · liste ${liste} · paire ${sous}`);
        // (30 oct., revue) Sur téléphone, le contenu d'une annonce prend la largeur (avant : 84 px, ~260 px de haut).
        const g = await pg.$eval('[data-ebay-liste="manuel"] [data-ebay-resultat="v1|5001|0"]', (e) => ({ main: e.querySelector('.vrm-buy-main').getBoundingClientRect().width, h: e.getBoundingClientRect().height, row: e.getBoundingClientRect().width }));
        dit(g.main >= Math.min(200, g.row * 0.55) && g.h <= 200, 'une annonce trouvée se lit : contenu large, ligne basse', JSON.stringify(g));
        if (process.env.SHOT) await pg.locator('[data-ebay-recherche]').screenshot({ path: path.join(process.env.SHOT, 'recherche-' + vp.width + '.png') });
        dit(!autres.some((x) => /achat|acheter|bid|offre/.test(String(x.action || '')) && x.action !== 'achats'), 'rien n’est acheté ni proposé par VRM');
      });
      await essaie('ajouter au fil', async () => {
        const avantAjout = appels.length;
        await pg.click('[data-geste="ajouter-fil"]'); await pg.waitForTimeout(1500);
        const c = autres.find((x) => x.type === 'veille.creer');
        dit(appels.length === avantAjout, '« Ajouter au fil » ne relance pas chez eBay la recherche qu’il vient de faire', `${appels.length - avantAjout} appel(s)`);
        dit(!!c && c.donnees.mots === 'salomon xt-6' && c.donnees.maximum === 7990 && c.donnees.pointure === '43' && c.revision === 4, 'ajouter au fil enregistre une recherche (la même liste que l’espace Organisation)', JSON.stringify(c || {}).slice(0, 200));
      });
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      dit((await deborde(pg)) <= 1, 'aucun débordement horizontal');
      // ── La visite suivante : une annonce jamais vue est « nouvelle » ─────────
      await essaie('visite suivante', async () => {
        const etat = await ctx.storageState();
        await ctx.close(); visite = 2; appels = [];
        ({ ctx, pg, errs } = await ouvrir(b, vp, sombre, etat));
        await ouvrirAchats(pg);
        await pg.waitForSelector('[data-ebay-fil-recherche="' + VEILLE.id + '"] [data-ebay-liste]', { timeout: 15000 });
        const nv = await pg.$$eval('[data-ebay-fil-recherche="' + VEILLE.id + '"] [data-nouveau="oui"]', (l) => l.map((e) => e.getAttribute('data-ebay-resultat')));
        dit(nv.length === 1 && nv[0] === 'v1|5009|0', 'visite suivante : seule l’annonce jamais vue est « nouvelle » (par itemId)', JSON.stringify(nv));
        const badge = await pg.$eval('[data-ebay-fil]', (e) => e.getAttribute('data-ebay-fil-nouveaux'));
        dit(Number(badge) >= 1, 'le fil dit combien sont nouvelles', badge);
      });
      // ── Plafond atteint ───────────────────────────────────────────────────
      await essaie('plafond', async () => {
        await ctx.close(); mode = 'plafond'; appels = []; visite = 1; veillesBanc = [VEILLE, veilleN(1), veilleN(2)];
        ({ ctx, pg, errs } = await ouvrir(b, vp, sombre));
        await ouvrirAchats(pg);
        await pg.waitForSelector('[data-ebay-plafond]', { timeout: 15000 });
        const t = await pg.$$eval('[data-ebay-fil-recherche]', (l) => l.map((e) => e.getAttribute('data-etat')));
        dit(t.length === 3 && t.every((x) => x === 'plafond'), 'plafond atteint : chaque recherche dit « pas lue »', JSON.stringify(t));
        const nbP = ((await pg.innerText('[data-ebay-recherche]')).match(/recherches eBay du jour/g) || []).length;
        dit(nbP === 1, 'plafond atteint : la cause est dite UNE fois', nbP + ' fois');
        const avant = appels.length;
        await tic(pg, 31 * 60 * 1000); await pg.waitForTimeout(400);
        dit(appels.length === avant, 'plafond atteint : plus aucun appel, même après 30 min', `${appels.length - avant} appel(s)`);
        dit(await pg.$eval('[data-geste="chercher"]', (e) => e.disabled), '« Chercher » est grisé jusqu’à minuit');
      });
      // ── Sans session, eBay injoignable ⇒ jamais « aucune annonce » ─────────
      for (const m of ['session', 'ebay']) {
        await essaie(m, async () => {
          await ctx.close(); mode = m; appels = []; veillesBanc = [VEILLE, veilleN(1), veilleN(2)];
          ({ ctx, pg, errs } = await ouvrir(b, vp, sombre));
          await ouvrirAchats(pg);
          await pg.waitForSelector('[data-ebay-fil-recherche][data-etat="pas-su"]', { timeout: 15000 });
          await pg.waitForTimeout(800);
          const nom = m === 'session' ? 'sans session (401)' : 'eBay injoignable';
          const fil = await pg.$eval('[data-ebay-fil]', (e) => e.innerText);
          dit(m === 'session' ? /session VRM a expiré/.test(fil) : /pas pu chercher/.test(fil) && /pas « aucun résultat »/.test(fil), nom + ' : la raison est dite', fil.replace(/\s+/g, ' ').slice(0, 160));
          dit(!(await pg.$('[data-ebay-vide]')) && !/aucune annonce/i.test(await pg.innerText('[data-ebay-recherche]')), nom + ' : jamais « aucune annonce »');
          // (30 oct., revue) Une cause, une phrase ; et une panne commune arrête le fil entier.
          const nbM = (fil.match(m === 'session' ? /session VRM a expiré/g : /pas pu chercher/g) || []).length;
          dit(nbM === 1, nom + ' : dit une fois pour les 3 recherches', nbM + ' fois');
          dit(appels.length === 1, nom + ' : une seule recherche part, pas une par recherche', appels.length + ' appel(s)');
          // (30 oct., revue) Un échec attend comme une lecture : rien avant 15 min.
          const avant = appels.length;
          for (let i = 0; i < 5; i++) { await tic(pg, 60 * 1000); await pg.waitForTimeout(150); }
          dit(appels.length === avant, nom + ' : rien n’est relancé pendant 5 min (avant : une relance par minute)', `${appels.length - avant} appel(s) en 5 min`);
          await tic(pg, 11 * 60 * 1000); await pg.waitForTimeout(400);
          dit(appels.length === avant + 1, nom + ' : un seul nouvel essai après 15 min', `${appels.length - avant} appel(s)`);
        });
      }
      // ── (30 oct., revue) Trois recherches lues pour la première fois ⇒ UNE phrase.
      await essaie('première lecture', async () => {
        await ctx.close(); mode = 'normal'; appels = []; visite = 1; veillesBanc = [VEILLE, veilleN(1), veilleN(2)];
        ({ ctx, pg, errs } = await ouvrir(b, vp, sombre));
        await ouvrirAchats(pg);
        await pg.waitForFunction(() => document.querySelectorAll('[data-ebay-fil-recherche][data-etat="lu"]').length === 3, null, { timeout: 15000 });
        const n = ((await pg.innerText('[data-ebay-fil]')).match(/Première lecture/g) || []).length;
        dit(n === 1, 'première lecture de 3 recherches : dit une fois', n + ' fois');
      });
      // ── 11 recherches actives : la 11ᵉ n'est pas relue, et l'espace plus bas le dit.
      await essaie('hors du fil', async () => {
        await ctx.close(); appels = []; veillesBanc = Array.from({ length: 11 }, (_, i) => veilleN(i + 1));
        ({ ctx, pg, errs } = await ouvrir(b, vp, sombre));
        await ouvrirAchats(pg);
        await pg.waitForSelector('[data-ebay-hors-fil]', { timeout: 15000 });
        await pg.waitForSelector('.ops-statut', { timeout: 15000 });
        const t = await pg.innerText('[data-ebay-achats-onglet]');
        const dans = (t.match(/Dans le fil/g) || []).length, hors = await pg.$$eval('[data-ops-fil="hors"]', (l) => l.map((e) => e.closest('article') && e.closest('article').querySelector('h3') && e.closest('article').querySelector('h3').textContent));
        dit(dans === 10 && hors.length === 1 && hors[0] === 'Recherche 1', '« Dans le fil » pour les 10 relues, « Hors du fil » pour la plus ancienne', `dans ${dans} · hors ${JSON.stringify(hors)}`);
        dit(/1 autre recherche active n’est pas relue/.test(t) && !/ne est/.test(t), 'la phrase dit « n’est pas relue »');
        dit(appels.length <= 10, 'le fil ne relit que 10 recherches', appels.length + ' appel(s)');
      });
      // ── Une recherche aux critères refusés par la route : dit, et jamais relancée.
      await essaie('critères refusés', async () => {
        await ctx.close(); appels = []; veillesBanc = [VEILLE, veilleN(1, { categorie: 'baskets' })];
        ({ ctx, pg, errs } = await ouvrir(b, vp, sombre));
        await ouvrirAchats(pg);
        await pg.waitForSelector('[data-ebay-fil-recherche][data-etat="criteres"]', { timeout: 15000 });
        const t = await pg.$eval('[data-ebay-fil-recherche][data-etat="criteres"]', (e) => e.innerText);
        dit(/Critères refusés/.test(t) && /Modifie/.test(t), 'critères refusés : dit, avec le geste', t.replace(/\s+/g, ' ').slice(0, 160));
        const avant = appels.length;
        for (let i = 0; i < 5; i++) { await tic(pg, 60 * 1000); await pg.waitForTimeout(150); }
        dit(appels.length === avant, 'critères refusés : jamais relancée', `${appels.length - avant} appel(s) en 5 min`);
      });
      // ── Annonces toutes écartées par VRM : eBay EN AVAIT.
      await essaie('écartées', async () => {
        await ctx.close(); mode = 'ecartees'; appels = []; veillesBanc = [];
        ({ ctx, pg, errs } = await ouvrir(b, vp, sombre));
        await ouvrirAchats(pg);
        await pg.fill('[aria-label="Mots à chercher"]', 'salomon xt-6'); await pg.fill('[aria-label="Prix maximum"]', '40');
        await pg.click('[data-geste="chercher"]');
        await pg.waitForSelector('[data-ebay-vide]', { timeout: 10000 });
        const t = await pg.$eval('[data-ebay-vide]', (e) => e.innerText);
        dit(!/aucune annonce pour ces critères/.test(t) && /eBay en avait 30/.test(t), 'tout écarté par le budget : la phrase ne dit pas « eBay n’a aucune annonce »', t);
      });
      // ── L'espace des recherches illisible : UNE phrase, UN « Réessayer ».
      await essaie('espace illisible', async () => {
        await ctx.close(); mode = 'normal'; appels = []; veillesBanc = [VEILLE]; opsKo = true;
        ({ ctx, pg, errs } = await ouvrir(b, vp, sombre));
        await ouvrirAchats(pg);
        await pg.waitForSelector('[data-ebay-fil="pas-su"]', { timeout: 15000 });
        await pg.waitForTimeout(1500);
        const t = await pg.innerText('[data-ebay-achats-onglet]');
        const nb = await pg.$$eval('[data-ebay-achats-onglet] button', (l) => l.filter((e) => e.textContent.trim() === 'Réessayer').length);
        dit(nb === 1 && !/Organisation/.test(t) && (t.match(/rien n’est perdu/g) || []).length === 1, 'espace illisible : une phrase, un « Réessayer »', `Réessayer ×${nb} · ${t.replace(/\s+/g, ' ').slice(0, 200)}`);
        opsKo = false;
        await pg.click('[data-ebay-achats-onglet] button:text-is("Réessayer")');
        await pg.waitForSelector('[data-ebay-fil-recherche]', { timeout: 15000 });
        dit(true, 'espace illisible : « Réessayer » relit le fil');
      });
      // ── Les achats gagnés, repliés ─────────────────────────────────────────
      await essaie('achats gagnés', async () => {
        mode = 'normal';
        await pg.click('[data-ebay-achats-gagnes] > summary');
        await pg.waitForSelector('[data-ebay-achat="4001"]', { timeout: 10000 });
        dit(autres.some((x) => x.action === 'achats'), 'ouvrir le repli lit les achats gagnés (WonList)');
      });
      if (process.env.SHOT) await pg.screenshot({ path: path.join(process.env.SHOT, 'achats-' + vp.width + '.png'), fullPage: true });
      dit(errs.length === 0, 'aucune erreur de page (fin)', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a levé', String(e && e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} ebay-achats-recherche : ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
