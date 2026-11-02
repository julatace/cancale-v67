// Banc : les CHIFFRES de Ma journée (1er novembre) — Julien : « je n'aime pas le
// graphique, il n'est pas beau ; pareil pour le CA, le bénéfice : il y a des
// écritures partout qui gâchent tout ».
//
// Données INVENTÉES (le dépôt est public). Il juge ce qui est RENDU (§6.4) :
//   1. la semaine est en BARRES : 7 jours, 7 colonnes `[data-barre]`, aucun
//      tracé lissé (`path` avec une courbe « C »/« S »/« Q ») ni seconde série ;
//   2. une barre par jour PASSÉ seulement (rien d'inventé après aujourd'hui) et
//      sa hauteur suit le montant du jour (`data-vendu`) ;
//   3. aucun texte ne sort de sa boîte (ni des cartes, ni du graphique) ;
//   4. le bloc des chiffres (cartes « Vendu », « Cette semaine », « Tendances »)
//      tient en au plus SEUIL_LIGNES lignes de texte rendues (390 et 1512 px) ;
//   5. UN seul grand chiffre dans le bloc (le reste plus petit) ;
//   6. les nombres publiés sont toujours là (data-vendu-mois, data-recu-mois,
//      data-ca-annee, data-total-semaine, chaque jour avec data-vendu/data-recu).
// Captures (clair et sombre) : CAPTURES=<dossier> node scripts/bancs/journee-chiffres.cjs
// Lancer : npm run build && NODE_OPTIONS="--require $PWD/scripts/bancs/_porte-banc.cjs" BANC_PORT=98xx node scripts/bancs/journee-chiffres.cjs
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || Number(process.env.PORT) || 4863;
const CAPT = process.env.CAPTURES || '';
// Mesuré sur le code d'avant (68c9fe12) : 35 lignes à 390 px, 45 à 1512 px ; après : 29 et 32.
const SEUIL_LIGNES = { 390: 30, 1512: 34 };

// Un jeudi après-midi : la semaine a quatre jours passés, trois à venir.
const maintenant = new Date(2026, 9, 15, 15, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const UID = '111';
const vente = (id, titre, prix, statut, d, extra = {}) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString(), ...extra });
const VENTES = [
  vente(7001, 'Nike Air Max 90 blanche taille 42', 65, 'Le paiement a été validé', il(0, 11), { transaction_user_status: 'needs_action' }),
  vente(7002, 'Adidas Samba OG noir taille 40', 72, 'Le paiement a été validé', il(0, 9), { transaction_user_status: 'needs_action' }),
  vente(7003, 'Salomon XT-6 gris taille 43', 110, 'Colis en cours d\'acheminement', il(1), { transaction_user_status: 'waiting' }),
  vente(7005, 'Asics Gel-Kayano 14 argent taille 44', 89, 'Commande finalisée', il(3), { transaction_user_status: 'completed' }),
  vente(7006, 'Nike Dunk Low panda taille 38', 61, 'Commande finalisée', il(8), { transaction_user_status: 'completed' }),
  vente(7007, 'Adidas Spezial bleu taille 39', 54, 'Commande finalisée', il(10), { transaction_user_status: 'completed' }),
  vente(7008, 'Converse Chuck 70 noir taille 42', 38, 'Commande finalisée', il(12), { transaction_user_status: 'completed' }),
  vente(7009, 'Nike Shox TL noir taille 41', 95, 'Commande annulée', il(1)),
];
// Mardi (il(2)) : aucune vente — la barre du « 0 ».
const VERSE = { 7005: il(0, 10), 7006: il(5), 7007: il(7) }; // 7008 : finalisée sans date ⇒ « à dater »
const ANNONCES = Array.from({ length: 6 }, (_, k) => ({ id: 6000 + k, title: 'Annonce ' + k, price: { amount: String(40 + k * 7), currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: il(30 + k).toISOString(), favourite_count: 0, view_count: 3 }));
const ACCOUNTS = [{ id: 1, vinted_user_id: UID, login: 'atelier_sneak', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const LIGNES = [
  { id: `harvest_${UID}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: `harvest_${UID}_listings`, data: { capturedAt: cap, payload: { items: ANNONCES, pagination: { total_entries: ANNONCES.length } } } },
  { id: `harvest_${UID}_billing`, data: { capturedAt: cap, payload: { escrow: { amount: '1759.40', currency_code: 'EUR' }, main: { amount: '227.54', currency_code: 'EUR' } } } },
  ...Object.entries(VERSE).map(([tx, d]) => ({ id: `harvest_${UID}_txn_${tx}`, data: { capturedAt: cap, payload: { transaction: { id: Number(tx), status: 450, status_title: 'Commande finalisée', status_updated_at: d.toISOString() } } } })),
  { id: `harvest_${UID}_txn_7008`, data: { capturedAt: cap, payload: { transaction: { id: 7008, status: 450, status_title: 'Commande finalisée' } } } },
];
// Prix d'achat connus pour 2 des ventes finalisées : le bénéfice existe, partiel.
const MAIN = { vinted_sale_overrides: { '7005': { buyPrice: '40' }, '7006': { buyPrice: '25' } }, vinted_urssaf_regime: 'micro_achat_revente' };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

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
    const alias = m[1] || m[2].split('->').pop().replace(/^>/, ''); const src = m[2];
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src] || cap; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (/^data(->|->>)/.test(src)) { let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg]; out[alias] = (v != null && /->>/.test(src) && typeof v !== 'object') ? String(v) : (v == null ? null : v); continue; }
    out[alias] = row[src];
  }
  return out;
};

const ouvrir = async (b, vp, sombre) => {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { deviceScaleFactor: 2 }) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); if (s) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const main = { ...MAIN, ...(sombre ? { vinted_dark: true } : {}) };
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: main }, sel)]);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // Le bénéfice se publie en lisant les ventes (écran Ventes), Ma journée le lit.
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_benefice_jours') || 'null'); } catch (_) { return false; } }, null, { timeout: 20000 }).catch(() => {});
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('[data-vendu-mois]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForFunction(() => document.querySelector('[data-courbe-semaine] [data-jour]') && document.querySelector('[data-widget-tendances]'), null, { timeout: 8000 }).catch(() => {});
  await pg.evaluate(() => document.fonts && document.fonts.ready);
  await pg.waitForTimeout(1200);
  return { ctx, pg, errs };
};

const BLOC = '.vrm-day-money, [data-carte-jours], [data-widget-tendances]';
const lire = (pg) => pg.evaluate((BLOC) => {
  const svg = document.querySelector('[data-courbe-semaine]');
  const chemins = svg ? [...svg.querySelectorAll('path')].map((p) => p.getAttribute('d') || '') : [];
  const jours = svg ? [...svg.querySelectorAll('[data-jour]')].map((g) => {
    const r = g.querySelector('[data-barre]');
    return { cle: g.getAttribute('data-jour'), vendu: g.getAttribute('data-vendu'), recu: g.getAttribute('data-recu'), h: r ? Number(r.getAttribute('height')) : null };
  }) : [];
  const cartes = [...document.querySelectorAll(BLOC)];
  // Une ligne de texte = une ligne rendue d'un BLOC de texte (le plus proche
  // ancêtre qui n'est pas « inline ») : ses fragments sont regroupés par hauteur
  // (même ligne si leurs milieux sont à moins de 10 px — un « € » plus petit
  // reste sur la ligne de son nombre). Deux cases côte à côte comptent chacune.
  let lignes = 0; const deborde = [];
  const blocDe = (el) => { let e = el; while (e && getComputedStyle(e).display.startsWith('inline') && !/inline-(block|flex|grid)/.test(getComputedStyle(e).display)) e = e.parentElement; return e; };
  for (const c of cartes) {
    const rc = c.getBoundingClientRect();
    const parBloc = new Map();
    const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.textContent.trim() || n.parentElement.closest('svg')) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const bl = blocDe(n.parentElement);
      for (const q of rg.getClientRects()) {
        if (q.width < 1 || q.height < 1) continue;
        if (!parBloc.has(bl)) parBloc.set(bl, []);
        parBloc.get(bl).push((q.top + q.bottom) / 2);
        if (q.right > rc.right + 1 || q.left < rc.left - 1) deborde.push(n.textContent.trim().slice(0, 30));
      }
    }
    for (const ys of parBloc.values()) { ys.sort((a, b) => a - b); let k = 0, der = -1e9; for (const y of ys) { if (y - der > 10) { k++; der = y; } } lignes += k; }
    for (const e of c.querySelectorAll('*')) {
      if (e.closest('svg') || e.children.length) continue;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || !e.textContent.trim()) continue;
      if (e.scrollWidth > e.clientWidth + 1 && cs.overflow === 'visible' && cs.display !== 'inline') deborde.push(e.textContent.trim().slice(0, 30));
    }
  }
  if (svg) {
    const rs = svg.getBoundingClientRect();
    for (const t of svg.querySelectorAll('text')) { const q = t.getBoundingClientRect(); if (q.width && (q.left < rs.left - 1 || q.right > rs.right + 1 || q.top < rs.top - 14)) deborde.push('svg:' + t.textContent); }
  }
  // Les grands chiffres : la taille de police des nombres du bloc.
  const grands = [];
  for (const c of cartes) for (const e of c.querySelectorAll('*')) {
    if (e.closest('svg')) continue;
    const propre = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
    const cs = getComputedStyle(e); if (cs.display === 'none') continue;
    if (/\d/.test(propre) && parseFloat(cs.fontSize) >= 30 && e.getBoundingClientRect().width > 0) grands.push(e.textContent.trim().slice(0, 20));
  }
  const a = (s, at) => { const e = document.querySelector(s); return e ? e.getAttribute(at) : null; };
  return {
    chemins, jours, lignes, deborde, grands,
    vMois: a('[data-vendu-mois]', 'data-vendu-mois'), rMois: a('[data-recu-mois]', 'data-recu-mois'), ca: a('[data-ca-annee]', 'data-ca-annee'), sem: a('[data-total-semaine]', 'data-total-semaine'),
    tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
    deb: document.documentElement.scrollWidth - window.innerWidth,
    texte: cartes.map((c) => c.innerText).join(' | '),
  };
}, BLOC);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    if (CAPT) fs.mkdirSync(CAPT, { recursive: true });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false], [{ width: 1512, height: 950 }, true]]) {
      const nom = `${vp.width}${sombre ? '-sombre' : ''}`;
      console.log(`\n── Ma journée, ${nom}`);
      await essaie(nom, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
        const lu = await lire(pg);
        if (CAPT) {
          await pg.screenshot({ path: path.join(CAPT, `journee-${nom}-ecran.png`) });
          // Chaque carte des chiffres, telle qu'elle se voit (la planche les pose côte à côte).
          let k = 0;
          for (const sel of ['.vrm-day-money', '[data-carte-jours]', '[data-widget-tendances]']) {
            const l = pg.locator(sel).first();
            if (await l.count()) { await l.scrollIntoViewIfNeeded(); await pg.waitForTimeout(200); await l.screenshot({ path: path.join(CAPT, `journee-${nom}-carte${++k}.png`) }); }
          }
          await pg.setViewportSize(vp); await pg.waitForTimeout(300);
        }
        dit(!lu.tombe && errs.length === 0, 'l’écran s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
        dit(lu.deb <= 1, 'aucun débordement horizontal de la page', `${lu.deb} px`);
        const lisse = lu.chemins.filter((d) => /[CcSsQqTt]/.test(d));
        dit(lu.jours.length === 7, 'la semaine a ses 7 jours', String(lu.jours.length));
        dit(lisse.length === 0, 'aucun tracé lissé (des barres, pas une courbe)', lisse.map((d) => d.slice(0, 30)).join(' | '));
        dit(lu.chemins.length === 0, 'une seule série : aucun trait « reçu » par-dessus', `${lu.chemins.length} tracé(s)`);
        const passes = lu.jours.filter((j) => j.vendu !== ''), futurs = lu.jours.filter((j) => j.vendu === '');
        dit(lu.jours.length === 7 && passes.every((j) => j.h != null) && futurs.every((j) => j.h == null), '7 colonnes : une barre par jour passé, rien d’inventé après aujourd’hui', JSON.stringify(lu.jours.map((j) => j.h)));
        const avecVente = passes.filter((j) => Number(j.vendu) > 0);
        const croit = avecVente.every((x) => avecVente.every((y) => Number(x.vendu) <= Number(y.vendu) ? x.h <= y.h + 0.5 : x.h >= y.h - 0.5));
        dit(avecVente.length >= 2 && croit, 'la hauteur de chaque barre suit le montant du jour', JSON.stringify(avecVente.map((j) => [j.vendu, Math.round(j.h)])));
        dit(passes.length === 4 && passes.every((j) => j.recu !== null), 'chaque jour passé garde son « vendu » et son « reçu » publiés (data-*)', JSON.stringify(passes.map((j) => [j.vendu, j.recu])));
        dit(lu.deborde.length === 0, 'aucun texte ne sort de sa boîte', lu.deborde.join(' | '));
        const seuil = SEUIL_LIGNES[vp.width];
        dit(lu.lignes <= seuil, `au plus ${seuil} lignes de texte dans le bloc des chiffres`, `${lu.lignes} lignes`);
        dit(lu.grands.length === 1, 'un seul grand chiffre dans le bloc', JSON.stringify(lu.grands));
        dit(!!lu.vMois && lu.rMois !== null && lu.ca !== null && !!lu.sem, 'les nombres publiés restent portés (vendu, reçu, CA, semaine)', JSON.stringify([lu.vMois, lu.rMois, lu.ca, lu.sem]));
        dit(!/encaiss/i.test(lu.texte), 'jamais « encaissé »');
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'banc', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
