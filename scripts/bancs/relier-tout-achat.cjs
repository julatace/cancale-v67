// ════════════════════════════════════════════════════════════════════════════
// BANC : RELIER — CHOISIR PARMI TOUS SES ACHATS (17 nov., lot relier-tout-achat)
//        node scripts/bancs/relier-tout-achat.cjs
// ════════════════════════════════════════════════════════════════════════════
// Julien : « je veux que quand je relie les paires on me laisse choisir autre chose que les articles achetés choisis
// par VRM ».
// Ventes · une vente « Adidas Spezial noir 42 » sans prix d'achat · « Relier un achat », avec 3 000 achats INVENTÉS
// sur deux comptes : 5 hors relier (2 remboursés, 1 annulé, 1 retour, 1 litige), 3 déjà reliés à N°7, N°8, N°9,
// 40 avec un détail de transaction (taille, vendeur) rangé côté acheteur.
// Contrôles :
//   · la feuille a « Suggestions » (ou la phrase « Aucune suggestion ») PUIS « Tous mes achats » — sans toucher rien ;
//   · « Tous mes achats » compte les 2 995 achats qu'on peut relier, et CHACUN est atteignable en défilant ;
//   · la recherche trouve un achat par son n°, son vendeur (lu), sa taille, son prix, sa date, son compte ;
//   · les 5 achats hors relier n'apparaissent jamais (ni en défilant, ni en cherchant leur n°) et la feuille dit
//     « 5 achats … masqués » ;
//   · un achat déjà relié est grisé, dit « Déjà relié à N°7 », et « Relier quand même » DEMANDE d'abord ; « Annuler »
//     n'écrit rien ;
//   · rien n'est écrit sans son toucher ;
//   · cibles ≥ 44 px, rien de coupé (« … »), aucun défilement horizontal, la feuille dans l'écran (pas sous la barre),
//     la page derrière ne défile plus.
// 390 tactile (clair, sombre) et 1512 (clair, sombre). `BANC_DIST=` le build jugé ; `SHOTS=` les captures.
// Un banc ne meurt pas, il rapporte.
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const sc = require('./_scenario-colis.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (21000 + Math.floor(Math.random() * 18000));
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-relier-tout-achat');
fs.mkdirSync(SHOTS, { recursive: true });
const J = 86400e3, H = 3600e3, [U0, U1] = sc.UID;

// ── Les 3 000 achats (inventés) ─────────────────────────────────────────────
const MODELES = ['Nike Air Max 90', 'Adidas Samba OG', 'New Balance 550', 'Asics Gel Lyte III', 'Puma Suede Classic', 'Nike Dunk Low', 'Salomon XT-6', 'Adidas Gazelle'];
const COULEURS = ['noir', 'blanc', 'gris', 'bleu marine', 'vert', 'beige'];
const N = 3000;
const txDe = (i) => String(8100000 + i);
const achats0 = [], achats1 = [], tous = [];
const EXCLUS = new Map([[17, 'Commande remboursée'], [911, 'Remboursement effectué'], [1404, 'Commande annulée'], [2222, 'Retour en cours'], [2718, 'Litige en cours']]);
const RELIES = new Map([[5, '7'], [1200, '8'], [2950, '9']]);
const AVEC_DETAIL = new Set(Array.from({ length: 40 }, (_, k) => 100 + k * 61));
const txns = [];
for (let i = 0; i < N; i++) {
  const tx = txDe(i), compte = i % 3 === 0 ? U1 : U0;
  const tailleTitre = i % 4 === 0 ? '' : ` taille ${38 + (i % 9)}`;
  // N°8 porte la seule paire qui ressemble à la vente (« Adidas Spezial noir 42 ») : déjà reliée, elle ne doit JAMAIS être proposée.
  const titre = i === 1200 ? 'Adidas Spezial noir taille 42' : `${MODELES[i % MODELES.length]} ${COULEURS[i % COULEURS.length]}${tailleTitre}`;
  const statut = EXCLUS.get(i) || sc.STATUT_FINAL;
  const o = sc.ordre({ tx, conv: 'c' + tx, titre, prix: 20 + (i % 61) + (i % 2 ? 0.5 : 0), statut, dateMs: sc.NOW - 3 * J - i * 5 * H });
  (compte === U1 ? achats1 : achats0).push(o);
  tous.push({ i, tx, compte, titre, statut, prix: 20 + (i % 61) + (i % 2 ? 0.5 : 0), dateMs: sc.NOW - 3 * J - i * 5 * H });
  if (AVEC_DETAIL.has(i)) txns.push({ id: `harvest_${compte}_txn_${tx}`, data: { type: 'transaction', uid: compte, capturedAt: new Date(sc.NOW - 2 * J).toISOString(),
    payload: { transaction: { id: Number(tx), user_side: 'buyer', status: 450, status_title: sc.STATUT_FINAL, items_count: 1, seller: { id: 900 + i, login: `atelier_${i}` },
      order: { items: [{ id: 9300000 + i, title: titre, size_title: String(38 + (i % 9)), status: 'Très bon état', price: { amount: '40.0', currency_code: 'EUR' } }] } } } } });
}
// Deux LOTS de 2 articles (titre muet : seul le détail de la transaction dit `items_count` 2, la forme mesurée le 17 nov.) :
// LOT1 a 1 article relié (N°10) ⇒ encore proposé ; LOT2 a ses 2 articles reliés (N°11, N°12) ⇒ plus proposé.
const LOT1 = '8200001', LOT2 = '8200002';
const lotTxn = (tx, compte, arts) => ({ id: `harvest_${compte}_txn_${tx}`, data: { type: 'transaction', uid: compte, capturedAt: new Date(sc.NOW - 2 * J).toISOString(),
  payload: { transaction: { id: Number(tx), user_side: 'buyer', status: 450, status_title: sc.STATUT_FINAL, items_count: arts.length, seller: { id: 77, login: 'grenier_lot' },
    order: { items: arts.map((t, k) => ({ id: Number(tx) * 10 + k, title: t[0], size_title: t[1], status: 'Bon état', photos: [{ url: `https://images.invalid/lot-${tx}-${k}.jpg` }] })) } } } } });
achats0.push(sc.ordre({ tx: LOT1, conv: 'c' + LOT1, titre: 'Nike Dunk Low et Air Max 90', prix: 80, statut: sc.STATUT_FINAL, dateMs: sc.NOW - 40 * J }));
achats0.push(sc.ordre({ tx: LOT2, conv: 'c' + LOT2, titre: 'Asics Gel Lyte et Puma Suede', prix: 70, statut: sc.STATUT_FINAL, dateMs: sc.NOW - 41 * J }));
txns.push(lotTxn(LOT1, U0, [['Nike Dunk Low blanc', '41'], ['Nike Air Max 90 noir', '42']]), lotTxn(LOT2, U0, [['Asics Gel Lyte III gris', '43'], ['Puma Suede vert', '44']]));
const exclusTx = [...EXCLUS.keys()].map(txDe);
const reliesTx = [...RELIES.keys()].map(txDe);
const prisTx = [...reliesTx, LOT2];                                                   // « Déjà reliés »
const libresTx = [...tous.filter((x) => !EXCLUS.has(x.i) && !RELIES.has(x.i)).map((x) => x.tx), LOT1];   // « Tous mes achats »
// La vente à relier (et son annonce numérotée N°1) ; trois fiches portent déjà un achat (N°7, N°8, N°9).
const VENTE_TX = '7200001';
const vente = sc.ordre({ tx: VENTE_TX, titre: 'Adidas Spezial noir 42', prix: 70, statut: sc.STATUT_FINAL, dateMs: sc.NOW - 2 * J, item: 'pa0' });
const listing = { ...sc.annonce({ id: 'pa0', titre: 'Adidas Spezial noir 42', prix: 70, taille: 42, marque: 'Adidas' }), created_at_ts: Math.floor((sc.NOW - 20 * J) / 1000) };
const fiches = { pa0: { numero: '1', title: 'Adidas Spezial noir 42', price: 70, size: '42' } };
for (const [i, num] of RELIES) fiches['f' + num] = { numero: num, title: tous[i].titre, price: 80, buyFromId: txDe(i), buyPrice: '40', buyFrom: { title: tous[i].titre, price: 40 } };
fiches.f10 = { numero: '10', title: 'Nike Dunk Low blanc 41', price: 90, buyFromId: LOT1, buyPrice: '35', buyFrom: { title: 'Nike Dunk Low et Air Max 90', price: 35, lot: true } };
fiches.f11 = { numero: '11', title: 'Asics Gel Lyte III gris 43', price: 90, buyFromId: LOT2, buyPrice: '30', buyFrom: { title: 'Asics Gel Lyte et Puma Suede', price: 30, lot: true } };
fiches.f12 = { numero: '12', title: 'Puma Suede vert 44', price: 90, buyFromId: LOT2, buyPrice: '40', buyFrom: { title: 'Asics Gel Lyte et Puma Suede', price: 40, lot: true } };
const main = (sombre) => sc.ligneMain({ vinted_dark: sombre, vinted_annonce_numeros: fiches });
const rows = [sc.ligneListings(U0, [listing]), sc.lignePurch(U0, achats0), sc.lignePurch(U1, achats1), sc.ligneSold(U0, [vente]), ...txns];

// La projection PostgREST (`alias:data->a->>b`, `id`, `data`) et ses filtres de chemin JSON.
const projette = (row, sel) => {
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (/^meta->>id$/.test(src)) { out[alias] = (/_txn_(\d+)$/.exec(row.id) || [])[1] || null; continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};
const filtresJson = (u) => [...u.matchAll(/[?&](data(?:->[A-Za-z0-9_]+)*->>[A-Za-z0-9_]+)=eq\.([^&]*)/g)].map((m) => ({ chemin: m[1], v: m[2] }));
const valeurChemin = (row, chemin) => { let x = row.data; for (const seg of chemin.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg]; return x == null ? null : String(x); };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };

// Les lignes d'achat rendues dans la feuille : leur n°, et si elles sont « déjà reliées ».
const LIRE_LIGNES = () => {
  const f = document.querySelector('[data-relier-feuille]'); if (!f) return null;
  return [...f.querySelectorAll('[data-achat-libre], [data-achat-pris], [data-suggestion-achat], [data-piste-achat]')].map((l) => ({
    tx: l.getAttribute('data-achat-libre') || l.getAttribute('data-achat-pris') || l.getAttribute('data-suggestion-achat') || l.getAttribute('data-piste-achat'),
    pris: l.hasAttribute('data-achat-pris'), tous: !!l.closest('[data-relier-section="tous"]') || l.hasAttribute('data-achat-libre') || l.hasAttribute('data-achat-pris') }));
};

async function passe(b, nom, ctxOpts, sombre) {
  if (process.env.PASSE && process.env.PASSE !== nom) return;
  console.log(`\n── ${nom}`);
  const ctx = await b.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', ...ctxOpts });
  const pg = await ctx.newPage();
  const errs = [], ecritures = [], corps = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sb) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { if (/app_data/.test(u) && req.method() !== 'HEAD') { let ids = ''; try { const bd = JSON.parse(req.postData() || 'null'); ids = (Array.isArray(bd) ? bd : [bd]).map((x) => x && x.id).filter(Boolean).join('+'); for (const x of (Array.isArray(bd) ? bd : [bd])) if (x && x.id) corps.push(x); } catch (_) {} if (/(^|\+)(main|vinted_annonce_numeros|vinted_sale_overrides|vinted_buyprice_by_num)(\+|$)/.test(ids)) ecritures.push(req.method() + ' ' + ids); } return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc.comptes());
    if (/id=eq\.main/.test(u)) return j(main(sombre));
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => (sel && sel !== 'data' ? projette(r, sel) : r);
    const fj = filtresJson(u);
    const passeFiltres = (r) => fj.every((f) => valeurChemin(r, f.chemin) === f.v);
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) { const k = eq[1]; return j(rows.filter((r) => r.id === k && passeFiltres(r)).map(forme)); }
    const inn = /id=in\.\(([^)]*)\)/.exec(u); if (inn) { const ids = new Set(inn[1].split(',')); return j(rows.filter((r) => ids.has(r.id) && passeFiltres(r)).map(forme)); }
    const m = /id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + m[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id) && passeFiltres(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=ventes&site=vinted`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-ventes-seg-choix="toutes"]', { timeout: 20000 }).catch(() => {});
  await pg.evaluate(() => { const bt = document.querySelector('[data-ventes-seg-choix="toutes"]'); if (bt) bt.click(); });
  const puce = pg.locator('[data-cout-vente="ligne"] [data-cout-vente-saisir]').first();
  await puce.waitFor({ timeout: 25000 }).catch(() => {});
  if (await puce.count()) await puce.click().catch(() => {});
  const bouton = pg.locator('[data-cout-vente-relier]').first();
  await bouton.waitFor({ timeout: 25000 }).catch(() => {});
  dit(await bouton.count() > 0, `${nom} · « Relier un achat » visible sur la vente sans prix`);
  if (!(await bouton.count())) { await pg.screenshot({ path: path.join(SHOTS, `relier-tout-${nom}-ko.png`), fullPage: true }); await ctx.close(); return; }
  await pg.waitForTimeout(400);
  await bouton.evaluate((e) => e.click());
  await pg.locator('[data-relier-feuille] [data-achat-libre], [data-relier-feuille] [data-suggestion-achat], [data-relier-feuille] [data-voir-tous-achats]').first().waitFor({ timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(600);

  // 1 · Les deux parties, sans rien toucher : « Suggestions » (ou la phrase) puis « Tous mes achats ».
  const S = await pg.evaluate(() => {
    const f = document.querySelector('[data-relier-feuille]'); if (!f) return null;
    const sug = f.querySelector('[data-relier-section="suggestions"]'), t = f.querySelector('[data-relier-section="tous"]');
    return { sug: !!sug, tous: !!t, ordre: !!(sug && t && (sug.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING)),
      dit: !!(sug && (sug.querySelector('[data-suggestions-achat]') || sug.querySelector('[data-suggestions-aucune]'))),
      nLibres: t ? Number(t.getAttribute('data-tous-achats')) : -1, nPris: t ? Number(t.getAttribute('data-tous-achats-pris')) : -1,
      masques: (f.querySelector('[data-relier-masques]') || {}).textContent || '', nMasques: f.querySelector('[data-relier-masques]') ? Number(f.querySelector('[data-relier-masques]').getAttribute('data-relier-masques')) : -1,
      recherche: !!(t && t.querySelector('[data-tous-achats-recherche]')) && (() => { const a = t.querySelector('[data-relier-recherche-aide]'); const r = a && a.getBoundingClientRect(); return !!(r && r.height > 8 && /vendeur/.test(a.textContent)); })(), filtres: ['compte', 'mois', 'taille'].filter((k) => t && t.querySelector(`[data-filtre-${k}]`)),
      sugTx: [...f.querySelectorAll('[data-suggestion-achat], [data-piste-achat]')].map((e) => e.getAttribute('data-suggestion-achat') || e.getAttribute('data-piste-achat')) };
  });
  dit(!!S, `${nom} · la feuille « Relier un achat » s'ouvre`);
  const s = S || {};
  dit(s.sug && s.dit, `${nom} · « Suggestions » en haut (la liste, ou « Aucune suggestion » dit en clair)`, JSON.stringify(s));
  dit(s.tous && s.ordre, `${nom} · « Tous mes achats » est affiché sous les suggestions, sans rien toucher`, JSON.stringify({ tous: s.tous, ordre: s.ordre }));
  dit(s.nLibres === libresTx.length && s.nPris === prisTx.length, `${nom} · « Tous mes achats » compte les ${libresTx.length} achats qu'on peut relier, « Déjà reliés » les ${prisTx.length} autres`, `${s.nLibres} + ${s.nPris}`);
  dit(!(s.sugTx || []).some((t) => prisTx.includes(t)), `${nom} · un achat déjà relié (la seule « Adidas Spezial noir 42 », N°8) n'est JAMAIS suggéré`, JSON.stringify(s.sugTx));
  dit(s.nMasques === exclusTx.length && /5 achats/.test(s.masques) && /masqu/.test(s.masques), `${nom} · « 5 achats retournés, en litige, remboursés ou annulés masqués » est dit`, s.masques);
  dit(s.recherche && s.filtres.length === 3, `${nom} · une recherche (ce qu'elle lit est écrit dessous, visible) et les filtres rapides compte, mois, taille`, JSON.stringify(s.filtres));
  dit(!ecritures.length, `${nom} · rien n'est écrit en ouvrant la feuille`, ecritures.slice(0, 2).join(' | '));
  await pg.screenshot({ path: path.join(SHOTS, `relier-tout-${nom}-ouverte.png`) });

  // 2 · La présentation : cibles ≥ 44 px, rien de coupé, pas de débord, la feuille dans l'écran.
  const V = await pg.evaluate(() => {
    const f = document.querySelector('[data-relier-feuille]'); const boite = f && f.querySelector('.vrm-relier-feuille-boite, [data-relier-achat-corps]');
    const corps = f && f.querySelector('[data-relier-achat-corps]');
    const petits = [], coupes = [];
    for (const e of f.querySelectorAll('button, select, input, a[href]')) {
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
      if (r.height < 43.5 || r.width < 43.5) petits.push((e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 30) + ` ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    for (const e of f.querySelectorAll('*')) {
      const cs = getComputedStyle(e); if (cs.textOverflow !== 'ellipsis' && cs.webkitLineClamp === 'none') continue;
      if (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) coupes.push((e.textContent || '').trim().slice(0, 30));
    }
    // Un menu ou un champ dont le texte (l'option choisie, l'invite) dépasse sa largeur est coupé sans « … » visible au DOM :
    // on MESURE le texte dans la police du champ.
    const cv = document.createElement('canvas').getContext('2d');
    for (const e of f.querySelectorAll('select, input[placeholder]')) {
      const r = e.getBoundingClientRect(); if (!r.width) continue;
      const cs = getComputedStyle(e); cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const txt = e.tagName === 'SELECT' ? ((e.options[e.selectedIndex] || {}).text || '') : e.placeholder;
      const dispo = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (e.tagName === 'SELECT' ? 22 : 0);
      if (cv.measureText(txt).width > dispo + 0.5) coupes.push(`${e.tagName.toLowerCase()} « ${txt} » ${Math.round(cv.measureText(txt).width)}>${Math.round(dispo)}`);
    }
    const box = (f.querySelector('.vrm-relier-feuille-boite') || corps).getBoundingClientRect();
    const x = box.left + box.width / 2, y = box.bottom - 6;
    const dessus = document.elementFromPoint(x, y);
    return { petits, coupes, hDoc: document.documentElement.scrollWidth > window.innerWidth + 1, hCorps: corps ? corps.scrollWidth > corps.clientWidth + 1 : true,
      dansEcran: box.top >= -1 && box.bottom <= window.innerHeight + 1, basVisible: !!(dessus && f.contains(dessus)), haut: Math.round(box.top), bas: Math.round(box.bottom), vh: window.innerHeight };
  });
  dit(!V.petits.length, `${nom} · chaque bouton, champ et filtre fait au moins 44 px`, V.petits.slice(0, 4).join(' | '));
  dit(!V.coupes.length, `${nom} · rien n'est coupé (« … », menus, invite de la recherche)`, V.coupes.slice(0, 3).join(' | '));
  dit(!V.hDoc && !V.hCorps, `${nom} · aucun défilement horizontal`);
  dit(V.dansEcran && V.basVisible, `${nom} · la feuille est entière dans l'écran, rien ne la recouvre en bas (barre d'onglets)`, JSON.stringify(V));

  // 3 · Chaque achat qu'on peut relier est atteignable EN DÉFILANT ; les hors relier jamais.
  for (let k = 0; k < 120; k++) {
    const fin = await pg.evaluate(() => {
      const c = document.querySelector('[data-relier-feuille] [data-relier-achat-corps]'); if (!c) return true;
      c.scrollTop = c.scrollHeight;
      return !document.querySelector('[data-relier-feuille] [data-tous-achats-plus]');
    });
    if (fin) break;
    await pg.waitForTimeout(120);
  }
  await pg.waitForTimeout(200);
  const L = (await pg.evaluate(LIRE_LIGNES)) || [];
  const dansTous = new Set(L.filter((x) => x.tous).map((x) => x.tx));
  const manquent = libresTx.filter((t) => !dansTous.has(t));
  dit(!manquent.length, `${nom} · en défilant, les ${libresTx.length} achats qu'on peut relier sont tous atteignables (le lot à moitié relié compris)`, `${manquent.length} manquent (ex. ${manquent.slice(0, 3).join(',')}) · ${dansTous.size} vus`);
  dit(L.every((x) => !exclusTx.includes(x.tx)), `${nom} · aucun achat retourné, en litige, remboursé ou annulé n'apparaît`, JSON.stringify(L.filter((x) => exclusTx.includes(x.tx))));
  dit(L.every((x) => !prisTx.includes(x.tx)), `${nom} · aucun achat déjà relié (ni le lot complet) dans la liste par défaut`, JSON.stringify(L.filter((x) => prisTx.includes(x.tx)).map((x) => x.tx)));
  const LT1 = await pg.evaluate((tx) => { const l = document.querySelector(`[data-achat-libre="${tx}"]`); if (!l) return null; const a = l.querySelector('[data-relier-lot-articles]');
    return { lot: l.getAttribute('data-relier-lot'), etat: (l.querySelector('[data-relier-lot-etat]') || {}).textContent || '', arts: a ? a.textContent : '', nArts: a ? Number(a.getAttribute('data-relier-lot-articles')) : 0, prix: (l.querySelector('[data-relier-lot-prix]') || {}).textContent || '' }; }, LOT1);
  dit(!!LT1 && /Lot · 2 articles · 1 relié/.test(LT1.etat) && LT1.nArts === 2 && /Nike Dunk Low blanc/.test(LT1.arts) && /Nike Air Max 90 noir/.test(LT1.arts), `${nom} · le lot à moitié relié : « Lot · 2 articles · 1 relié » et le titre de chaque article`, JSON.stringify(LT1));
  dit(!!LT1 && /Lot de 2 · 80\s?€ — prix par paire à saisir/.test(LT1.prix), `${nom} · « Lot de 2 · 80 € — prix par paire à saisir » (jamais un prix partagé)`, LT1 && LT1.prix);
  await pg.evaluate((tx) => { const e = document.querySelector(`[data-achat-libre="${tx}"]`); if (e) e.scrollIntoView({ block: 'center' }); }, LOT1);
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: path.join(SHOTS, `relier-tout-${nom}-lot.png`) });

  // 3b · « Déjà reliés » : les reliés, chacun « Relié à N°… », choisis EXPRÈS.
  await pg.evaluate(() => { const c = document.querySelector('[data-relier-feuille] [data-relier-achat-corps]'); if (c) c.scrollTop = 0; });
  await pg.locator('[data-relier-feuille] [data-relier-vue="relies"]').click().catch(() => {});
  await pg.waitForTimeout(300);
  const R = await pg.evaluate(() => [...document.querySelectorAll('[data-relier-feuille] [data-achat-pris]')].map((l) => ({ tx: l.getAttribute('data-achat-pris'), deja: (l.querySelector('[data-relier-deja]') || {}).textContent || '', bouton: (l.querySelector('[data-relier-deplacer]') || {}).textContent || '', libre: !!l.querySelector('[data-relier-achat]') })));
  dit(JSON.stringify(R.map((x) => x.tx).sort()) === JSON.stringify([...prisTx].sort()), `${nom} · « Déjà reliés » liste les ${prisTx.length} achats reliés (le lot complet compris)`, JSON.stringify(R.map((x) => x.tx)));
  const r7 = R.find((x) => x.tx === txDe(5)), rl = R.find((x) => x.tx === LOT2);
  dit(!!r7 && /Relié à N°7/.test(r7.deja) && /Choisir/.test(r7.bouton) && !r7.libre, `${nom} · chacun dit « Relié à N°7 » et se choisit par « Choisir »`, JSON.stringify(r7));
  dit(!!rl && /N°11/.test(rl.deja) && /N°12/.test(rl.deja), `${nom} · le lot complet dit ses deux paires (N°11, N°12)`, JSON.stringify(rl));
  await pg.screenshot({ path: path.join(SHOTS, `relier-tout-${nom}-deja-relie.png`) });

  // 4 · Choisir un achat déjà relié DEMANDE (« Le détacher de N°7 ? ») ; « Annuler » n'écrit rien.
  await pg.locator(`[data-relier-deplacer="${txDe(5)}"]`).click().catch(() => {});
  const conf = pg.locator('.vrm-confirmation');
  await conf.first().waitFor({ timeout: 5000 }).catch(() => {});
  const C1 = await pg.evaluate(() => { const c = document.querySelector('.vrm-confirmation'); return c ? c.textContent : ''; });
  dit(/Le détacher de N°7/.test(C1) && /Détacher et relier ici/.test(C1), `${nom} · choisir un achat relié ouvre « Le détacher de N°7 ? »`, C1.slice(0, 160));
  await pg.screenshot({ path: path.join(SHOTS, `relier-tout-${nom}-confirmation.png`) });
  await pg.evaluate(() => { const c = document.querySelector('.vrm-confirmation'); const b = c && [...c.querySelectorAll('button')].find((x) => /Annuler/.test(x.textContent)); if (b) b.click(); });
  await pg.waitForTimeout(600);
  dit(!ecritures.length, `${nom} · « Annuler » : rien n'est relié ni détaché`, ecritures.slice(0, 2).join(' | '));
  // Le lot complet : il demande QUEL article détacher (un seul), puis confirme ; « Annuler » n'écrit rien.
  await pg.locator(`[data-relier-deplacer="${LOT2}"]`).click().catch(() => {});
  await pg.locator('.vrm-confirmation [data-ask-choix]').first().waitFor({ timeout: 5000 }).catch(() => {});
  const CH = await pg.evaluate(() => [...document.querySelectorAll('.vrm-confirmation [data-choix]')].map((b) => b.textContent));
  dit(CH.length === 2 && CH.some((t) => /N°11/.test(t)) && CH.some((t) => /N°12/.test(t)), `${nom} · un lot complet : « quel article détacher ? » N°11 ou N°12 (jamais les deux)`, JSON.stringify(CH));
  await pg.evaluate(() => { const c = document.querySelector('.vrm-confirmation'); const b = c && [...c.querySelectorAll('button')].find((x) => /Annuler/.test(x.textContent)); if (b) b.click(); });
  await pg.waitForTimeout(500);
  dit(!ecritures.length, `${nom} · « Annuler » : le lot n'est pas touché`, ecritures.slice(0, 2).join(' | '));
  await pg.locator('[data-relier-feuille] [data-relier-vue="tous"]').click().catch(() => {});
  await pg.waitForTimeout(300);

  // 5 · La recherche trouve chaque sorte de fait ; un achat hors relier, jamais.
  const corpsHaut = async () => pg.evaluate(() => { const c = document.querySelector('[data-relier-feuille] [data-relier-achat-corps]'); if (c) c.scrollTop = 0; });
  await corpsHaut();
  const champ = pg.locator('[data-relier-feuille] [data-tous-achats-recherche]');
  const cherche = async (q) => { await champ.fill(q); await pg.waitForTimeout(250); return (await pg.evaluate(LIRE_LIGNES) || []).filter((x) => x.tous).map((x) => x.tx); };
  const cible = tous[2401];   // 2401 % 3 ≠ 0 ⇒ compte U0, taille écrite, prix ,5
  const pj = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date(cible.dateMs)).map((x) => [x.type, x.value]));
  const jj = pj.day, mm = pj.month, aa = pj.year;
  const essais = [
    ['son n°', txDe(2999), [txDe(2999)]],
    ['le vendeur lu chez Vinted', 'atelier_161', [txDe(161)]],
    ['un n° pris au hasard (le plus ancien)', txDe(2998), [txDe(2998)]],
  ];
  for (const [quoi, q, attendu] of essais) { const r = await cherche(q); dit(attendu.every((t) => r.includes(t)) && r.length === attendu.length, `${nom} · chercher ${quoi} (« ${q} ») le trouve`, `${r.length} : ${r.slice(0, 4).join(',')}`); }
  const prixTxt = cible.prix.toFixed(2).replace('.', ',');
  const rp = await cherche(`${prixTxt} ${jj}/${mm}/${aa}`);
  dit(rp.includes(txDe(2401)) && rp.length <= 3, `${nom} · chercher un prix et une date (« ${prixTxt} ${jj}/${mm}/${aa} ») trouve l'achat`, rp.slice(0, 4).join(','));
  const rc = await cherche(`boutique_sud ${txDe(2997)}`);
  dit(rc.length === 1 && rc[0] === txDe(2997), `${nom} · chercher le compte (« boutique_sud ») avec le n°`, rc.join(','));
  // Une taille : celle écrite dans un titre, et celle LUE chez Vinted d'un achat dont le titre n'en dit rien.
  const t43Titre = tous.find((x) => / taille 43$/.test(x.titre) && !EXCLUS.has(x.i));
  const t43Lue = tous.find((x) => AVEC_DETAIL.has(x.i) && x.i % 4 === 0 && 38 + (x.i % 9) === 43);
  // (le modèle et la couleur avec : moins de 60 réponses, toutes rendues d'un coup)
  const mc = (x) => x.titre.replace(/ taille \d+$/, '');
  const rt1 = await cherche(`taille 43 ${mc(t43Titre)}`), rt2 = await cherche(`taille 43 ${mc(t43Lue)}`);
  dit(rt1.includes(t43Titre.tx) && rt2.includes(t43Lue.tx) && [...rt1, ...rt2].every((t) => { const x = tous[Number(t) - 8100000]; return / taille 43$/.test(x.titre) || (AVEC_DETAIL.has(x.i) && 38 + (x.i % 9) === 43); }),
    `${nom} · chercher « taille 43 » trouve un 43 écrit dans le titre ET un 43 lu chez Vinted (titre muet), et rien d'autre`, `${rt1.length}/${rt2.length} · ${t43Lue.tx} · hors 43 : ${[...rt1, ...rt2].filter((t) => { const x = tous[Number(t) - 8100000]; return !x || !(/ taille 43$/.test(x.titre) || (AVEC_DETAIL.has(x.i) && 38 + (x.i % 9) === 43)); }).slice(0, 4).join(',')}`);
  for (const t of exclusTx) {
    const r = await cherche(t);
    if (r.length) { dit(false, `${nom} · chercher le n° d'un achat hors relier (${t}) ne le montre pas`, r.join(',')); break; }
  }
  dit(true, `${nom} · chercher le n° des 5 achats hors relier : aucun ne sort`);
  const vide = await pg.evaluate(() => !!document.querySelector('[data-relier-feuille] [data-tous-achats-vide]'));
  dit(vide, `${nom} · une recherche sans résultat le dit (« Aucun achat ne correspond »)`);
  // Filtre rapide « taille » : seulement des 42.
  await champ.fill('');
  await pg.waitForTimeout(200);
  const fT = pg.locator('[data-relier-feuille] [data-filtre-taille]');
  if (await fT.count()) {
    await fT.selectOption('42').catch(() => {});
    await pg.waitForTimeout(250);
    const r = (await pg.evaluate(LIRE_LIGNES) || []).filter((x) => x.tous).map((x) => tous[Number(x.tx) - 8100000]);
    dit(r.length > 0 && r.every((x) => /taille 42$/.test(x.titre) || AVEC_DETAIL.has(x.i)), `${nom} · le filtre « taille 42 » ne garde que des 42`, `${r.length}`);
    await fT.selectOption('').catch(() => {});
  } else dit(false, `${nom} · le filtre taille est là`);
  await champ.fill('Salomon');
  await pg.waitForTimeout(250);
  await pg.screenshot({ path: path.join(SHOTS, `relier-tout-${nom}-recherche.png`) });
  dit(!ecritures.length, `${nom} · toujours rien d'écrit sans son toucher « Relier »`, ecritures.slice(0, 2).join(' | '));
  // 6 · Relier le 2e article du lot : aucune confirmation de détachement, le prix DEMANDÉ vide (jamais partagé), laissé vide
  //     ⇒ relié, coût « à saisir » ; N°10 garde son lien.
  await champ.fill(LOT1);
  await pg.waitForTimeout(300);
  await pg.locator(`[data-relier-feuille] [data-relier-achat="${LOT1}"]`).click().catch(() => {});
  await pg.locator('.vrm-confirmation input, [data-ask-texte] input, input[data-ask-text]').first().waitFor({ timeout: 5000 }).catch(() => {});
  const Q = await pg.evaluate(() => { const c = document.querySelector('.vrm-confirmation') || document.querySelector('[role="dialog"]:last-of-type');
    const i = c && c.querySelector('input'); return { texte: c ? c.textContent : '', valeur: i ? i.value : null, detacher: /détacher/i.test(c ? c.textContent : '') }; });
  dit(Q.valeur === '' && /Lot de 2 · 80\s?€ — prix par paire à saisir/.test(Q.texte), `${nom} · relier un article du lot DEMANDE son prix, champ vide (« Lot de 2 · 80 € — prix par paire à saisir »), jamais 40 € tout seul`, JSON.stringify(Q).slice(0, 200));
  dit(!Q.detacher, `${nom} · relier un article du lot ne demande pas d'en détacher un autre`);
  await pg.screenshot({ path: path.join(SHOTS, `relier-tout-${nom}-lot-prix.png`) });
  await pg.evaluate(() => { const c = document.querySelector('.vrm-confirmation'); const b = c && c.querySelector('button[type="submit"]'); if (b) b.click(); });
  await pg.waitForTimeout(7500);
  const dernier = (id) => { for (let k = corps.length - 1; k >= 0; k--) if (corps[k].id === id) return corps[k].data; return null; };
  const mainW = dernier('main'), ficW = dernier('vinted_annonce_numeros') || (mainW && mainW.vinted_annonce_numeros), venW = dernier('vinted_sale_overrides') || (mainW && mainW.vinted_sale_overrides);
  const tousW = { ...(ficW || {}), ...(venW || {}) };
  const ici = Object.entries(tousW).filter(([k, e]) => e && String(e.buyFromId) === LOT1 && k !== 'f10');
  dit(ici.length === 1 && ici[0][1].buyPrice === '', `${nom} · le 2e article du lot est relié, son prix laissé « à saisir » (rien de partagé)`, JSON.stringify(ici).slice(0, 200) + ' · ' + ecritures.slice(-3).join(' | '));
  dit(!ficW || !ficW.f10 || String(ficW.f10.buyFromId) === LOT1, `${nom} · N°10 garde son article du lot (relier un article n'en délie jamais un autre)`, JSON.stringify(ficW && ficW.f10));
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const tel = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
  await passe(b, '390', tel, false);
  await passe(b, '390-sombre', { ...tel, colorScheme: 'dark' }, true);
  await passe(b, '1512', { viewport: { width: 1512, height: 950 } }, false);
  await passe(b, '1512-sombre', { viewport: { width: 1512, height: 950 }, colorScheme: 'dark' }, true);
  await b.close(); srv.close();
  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
