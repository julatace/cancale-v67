// Banc : TES MEILLEURES SOURCES (11 nov.) — où acheter ce qui se revend le mieux.
// Données INVENTÉES (le dépôt est public). 390 px tactile et 1512 px, clair et sombre.
// Il juge la RÈGLE (data-* et nombres rendus, styles calculés), pas l'orthographe :
//   · trois achats Vinted au MÊME titre et au même prix (7001, 7002, 7003) + un annulé (7004) :
//     Vinted = 3 achats ; seuls 7001 et 7002 (reliés par LEUR transaction) sont revendus ;
//   · la vente 8103 au même titre, reliée à rien : dans aucune source, comptée à part, DITE ;
//   · Brocante (deux achats hors plateforme, l'un sans prix) : « au moins 20 € » investi,
//     « 1 revendu sur 2 achetés · 1 sans prix d'achat » ; « Ebay » écrit à la main = eBay ;
//     un achat sans source : « Source pas saisie », en dernier ;
//   · classement par bénéfice puis par vitesse ; la ligne en tête à l'accent, aucun rouge ;
//   · une ligne ouvre la liste de SES achats (feuille, fermée par la croix) ;
//   · la carte dans Argent (Statistiques) ET dans Achats ; rien ne déborde ; cibles 44 px.
// Lancer : npm run build && BANC_PORT=96xx node scripts/bancs/meilleures-sources.cjs
// Captures : SHOTS=<dossier> ; BANC_DIST=<un autre dist/> pour juger une autre version.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4399);
const SHOTS = process.env.SHOTS || '';

const maintenant = new Date(2026, 10, 10, 15, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const A = '111';
let nPhoto = 0;
const vente = (id, titre, prix, statut, d, tus, extra = {}) => ({ transaction_id: id, conversation_id: 60000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` }, ...extra });
const DUNK = 'Nike Dunk Low Retro Panda 42';
const VENTES = [
  vente(8101, DUNK, 90, 'Commande finalisée', il(5), 'completed'),
  vente(8102, DUNK, 80, 'Commande finalisée', il(3), 'completed'),
  vente(8103, DUNK, 85, 'Commande finalisée', il(4), 'completed'),
  vente(8104, 'Nike Air Force 1 blanche 41', 60, 'Commande finalisée', il(8), 'completed'),
  vente(8105, 'Adidas Samba OG noir 40', 70, 'Commande finalisée', il(6), 'completed'),
];
const ACHATS = [
  vente(7001, DUNK, 40, 'Commande finalisée', il(30), 'completed'),
  vente(7002, DUNK, 40, 'Commande finalisée', il(30), 'completed'),
  vente(7003, DUNK, 40, 'Commande finalisée', il(30), 'completed'),
  vente(7004, DUNK, 40, 'Commande annulée', il(30), 'completed'),
];
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'vendeur_banc', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const LIGNES = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${A}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: ACHATS } } },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 300)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
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
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf'][k % 4]}"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 280 300 282 L90 282 C70 282 62 268 70 250 Z" fill="rgba(30,34,40,.55)"/></svg>`;

const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    // 8004 : relié à SON achat Vinted (transaction), prix saisi, frais confirmés ⇒ 89 − 30 = 59 € ;
    // 8009 : relié à un achat Vinted, prix d'achat pas saisi ⇒ bénéfice inconnu ;
    // 8007 : le N° H1, écrit sur un achat hors plateforme « Magasin » ⇒ 60 − 20 = 40 €.
    localStorage.setItem('vinted_sale_overrides', JSON.stringify({
      '8101': { buyFromId: '7001', buyPrice: '40', fraisComplets: true },
      '8102': { buyFromId: '7002', buyPrice: '40', fraisComplets: true },
      '8104': { numero: 'H1', buyPrice: '20', fraisComplets: true },
      '8105': { numero: 'H2', buyPrice: '25', fraisComplets: true },
    }));
    localStorage.setItem('vinted_offvinted_buys', JSON.stringify([
      { id: 'ob_h1', title: 'Air Force 1 blanche', price: '20', date: '2026-10-01', source: 'Brocante', numero: 'H1' },
      { id: 'ob_h2', title: 'Samba OG', price: '25', date: '2026-10-05', source: 'Ebay', numero: 'H2' },
      { id: 'ob_h3', title: 'Jordan 1 Mid', price: '', date: '2026-09-20', source: 'brocante', numero: 'H3' },
      { id: 'ob_h4', title: 'Gazelle', price: '15', date: '2026-10-25', source: '', numero: 'H4' },
    ]));
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
    const dans = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
};
const ROUGE = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c || ''); if (!m) return false; const [r, g, b] = m.slice(1).map(Number); return r > 180 && g < 80 && b < 80; };
const lireCarte = (carte) => carte.evaluate((c) => {
  const vw = window.innerWidth;
  return {
    lignes: [...c.querySelectorAll('[data-ms-source]')].map((l) => ({ k: l.getAttribute('data-ms-source'), rang: +l.getAttribute('data-ms-rang'), tete: l.hasAttribute('data-ms-tete'),
      benef: l.getAttribute('data-ms-benefice'), delai: l.getAttribute('data-ms-delai'), articles: +l.getAttribute('data-ms-articles'), revendus: +l.getAttribute('data-ms-revendus'), sansPrix: +l.getAttribute('data-ms-sans-prix'),
      h: l.getBoundingClientRect().height, txt: l.innerText.replace(/\s+/g, ' '), couleur: getComputedStyle(l.querySelector('.vrm-ms-chiffre')).color })),
    hors: [...c.querySelectorAll('[data-ms-hors]')].map((p) => p.innerText),
    txt: c.innerText, deb: Math.max(document.documentElement.scrollWidth - vw, 0),
    dehors: [...c.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > c.getBoundingClientRect().right + 1; }).length,
    rouge: [...c.querySelectorAll('*')].some((e) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(getComputedStyle(e).color + getComputedStyle(e).backgroundColor); return m && +m[1] > 180 && +m[2] < 80 && +m[3] < 80; }),
    boutons: [...c.querySelectorAll('button')].map((x) => Math.round(x.getBoundingClientRect().height)),
  };
});
const juger = async (pg, carte, nom, ou) => {
  await carte.scrollIntoViewIfNeeded(); await pg.waitForTimeout(600);
  const r = await lireCarte(carte);
  const L = (k) => r.lignes.find((l) => l.k === k) || {};
  const v = L('vinted'), br = L('brocante'), eb = L('ebay'), ns = L('non-saisie');
  dit(v.articles === 3 && v.revendus === 2 && /2 revendus sur 3 achetés/.test(v.txt), `${ou}1 Vinted : 3 achats (l’annulé n’en est pas un), 2 revendus — reliés par LEUR transaction`, JSON.stringify(v));
  dit(br.articles === 2 && br.revendus === 1 && br.sansPrix === 1 && /au moins 20\s?€/.test(br.txt) && /1 revendu sur 2 achetés · 1 sans prix d’achat/.test(br.txt), `${ou}2 Brocante : « au moins 20 € » investi, la couverture dite`, br.txt);
  dit(eb.articles === 1 && eb.revendus === 1 && /^eBay/.test(eb.txt), `${ou}3 « Ebay » écrit à la main : la source eBay`, eb.txt);
  dit(r.lignes.length && r.lignes[r.lignes.length - 1].k === 'non-saisie' && ns.articles === 1, `${ou}4 « Source pas saisie » comptée, en dernier`, r.lignes.map((l) => l.k).join(','));
  dit(r.hors.some((t) => /1 vente sans achat relié/.test(t)), `${ou}5 la vente sans achat relié : dans aucune source, DITE`, JSON.stringify(r.hors));
  const benefs = r.lignes.filter((l) => l.benef !== '').map((l) => +l.benef);
  dit(r.lignes[0].k === 'vinted' && benefs.length >= 3 && benefs.every((b, i) => !i || b <= benefs[i - 1]), `${ou}6 par bénéfice : le plus haut d’abord`, r.lignes.map((l) => l.k + ':' + l.benef).join(','));
  const tetes = r.lignes.filter((l) => l.tete);
  dit(tetes.length === 1 && tetes[0].rang === 1 && tetes[0].couleur !== r.lignes[1].couleur && !r.rouge, `${ou}7 la source en tête seule à l’accent, aucun rouge`, tetes.map((t) => t.couleur).join(',') + ' / ' + (r.lignes[1] || {}).couleur);
  dit(r.deb <= 1 && r.dehors === 0, `${ou}8 rien ne déborde`, `${r.deb}px · ${r.dehors}`);
  dit(r.boutons.every((h) => h >= 44), `${ou}9 cibles au doigt ≥ 44 px`, r.boutons.join(','));
  dit(!/NaN|undefined|Invalid Date|null/.test(r.txt), `${ou}10 ni NaN, ni undefined, ni null à l’écran`);
  if (SHOTS) await carte.screenshot({ path: path.join(SHOTS, `ms-${ou}-${nom}.png`) });
  // Par vitesse.
  await carte.locator('[data-ms-classer="vitesse"]').click(); await pg.waitForTimeout(300);
  const r2 = await lireCarte(carte);
  const d = r2.lignes.filter((l) => l.delai !== '').map((l) => +l.delai);
  const premierSans = r2.lignes.findIndex((l) => l.delai === '');
  dit(d.length >= 2 && d.every((x, i) => !i || x >= d[i - 1]) && (premierSans < 0 || r2.lignes.slice(premierSans).every((l) => l.delai === '')), `${ou}11 par vitesse : le délai le plus court d’abord, une source sans revente jamais classée dessus`, r2.lignes.map((l) => l.k + ':' + l.delai).join(','));
  await carte.locator('[data-ms-classer="benefice"]').click(); await pg.waitForTimeout(200);
  // Une ligne ouvre SES achats.
  await carte.locator('[data-ms-source="vinted"]').click();
  const f = pg.locator('[data-ms-feuille] [role="dialog"]');
  await f.waitFor({ timeout: 5000 });
  const a = await f.evaluate((x) => [...x.querySelectorAll('[data-ms-achat]')].map((l) => ({ id: l.getAttribute('data-ms-achat'), rev: l.getAttribute('data-ms-revendus'), txt: l.innerText.replace(/\s+/g, ' ') })));
  const rev = a.filter((l) => l.rev === '1').map((l) => l.id).sort().join(',');
  dit(a.length === 3 && rev === 'vinted:7001,vinted:7002' && a.some((l) => l.id === 'vinted:7003' && /pas encore revendu · depuis/.test(l.txt)), `${ou}12 la ligne Vinted ouvre SES 3 achats : 7001 et 7002 revendus, 7003 « pas encore revendu · depuis … »`, JSON.stringify(a));
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `ms-${ou}-feuille-${nom}.png`) });
  await pg.locator('[data-ms-fermer]').click(); await pg.waitForTimeout(300);
  dit(!(await pg.locator('[data-ms-feuille]').count()), `${ou}13 la croix ferme la feuille`);
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      console.log(`\n— ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      await essaie('Achats', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'domcontentloaded' });
        await pg.waitForFunction(() => { try { const p = JSON.parse(localStorage.getItem('vrm_meilleures_sources') || 'null'); return !!(p && p.r && p.r.sources.length); } catch (_) { return false; } }, null, { timeout: 40000 });
        const carte = pg.locator('[data-stats-carte="meilleures-sources"][data-ms-ici="achats"]');
        await carte.waitFor({ timeout: 20000 });
        await juger(pg, carte, nom, 'A');
      });
      await essaie('Argent', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
        const carte = pg.locator('[data-stats-carte="meilleures-sources"][data-ms-ici="argent"]');
        await carte.waitFor({ timeout: 30000 });
        await juger(pg, carte, nom, 'G');
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
