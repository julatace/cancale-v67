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
  const titre = `${MODELES[i % MODELES.length]} ${COULEURS[i % COULEURS.length]}${tailleTitre}`;
  const statut = EXCLUS.get(i) || sc.STATUT_FINAL;
  const o = sc.ordre({ tx, conv: 'c' + tx, titre, prix: 20 + (i % 61) + (i % 2 ? 0.5 : 0), statut, dateMs: sc.NOW - 3 * J - i * 5 * H });
  (compte === U1 ? achats1 : achats0).push(o);
  tous.push({ i, tx, compte, titre, statut, prix: 20 + (i % 61) + (i % 2 ? 0.5 : 0), dateMs: sc.NOW - 3 * J - i * 5 * H });
  if (AVEC_DETAIL.has(i)) txns.push({ id: `harvest_${compte}_txn_${tx}`, data: { type: 'transaction', uid: compte, capturedAt: new Date(sc.NOW - 2 * J).toISOString(),
    payload: { transaction: { id: Number(tx), user_side: 'buyer', status: 450, status_title: sc.STATUT_FINAL, items_count: 1, seller: { id: 900 + i, login: `atelier_${i}` },
      order: { items: [{ id: 9300000 + i, title: titre, size_title: String(38 + (i % 9)), status: 'Très bon état', price: { amount: '40.0', currency_code: 'EUR' } }] } } } } });
}
const exclusTx = [...EXCLUS.keys()].map(txDe);
const reliesTx = [...RELIES.keys()].map(txDe);
const reliables = tous.filter((x) => !EXCLUS.has(x.i)).map((x) => x.tx);
// La vente à relier (et son annonce numérotée N°1) ; trois fiches portent déjà un achat (N°7, N°8, N°9).
const VENTE_TX = '7200001';
const vente = sc.ordre({ tx: VENTE_TX, titre: 'Adidas Spezial noir 42', prix: 70, statut: sc.STATUT_FINAL, dateMs: sc.NOW - 2 * J, item: 'pa0' });
const listing = { ...sc.annonce({ id: 'pa0', titre: 'Adidas Spezial noir 42', prix: 70, taille: 42, marque: 'Adidas' }), created_at_ts: Math.floor((sc.NOW - 20 * J) / 1000) };
const fiches = { pa0: { numero: '1', title: 'Adidas Spezial noir 42', price: 70, size: '42' } };
for (const [i, num] of RELIES) fiches['f' + num] = { numero: num, title: tous[i].titre, price: 80, buyFromId: txDe(i), buyPrice: '40', buyFrom: { title: tous[i].titre, price: 40 } };
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
  const errs = [], ecritures = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sb) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { if (/app_data/.test(u) && req.method() !== 'HEAD') { let ids = ''; try { const bd = JSON.parse(req.postData() || 'null'); ids = (Array.isArray(bd) ? bd : [bd]).map((x) => x && x.id).filter(Boolean).join('+'); } catch (_) {} if (/(^|\+)(main|vinted_annonce_numeros|vinted_sale_overrides|vinted_buyprice_by_num)(\+|$)/.test(ids)) ecritures.push(req.method() + ' ' + ids); } return j([]); }
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
      recherche: !!(t && t.querySelector('[data-tous-achats-recherche]')), filtres: ['compte', 'mois', 'taille'].filter((k) => t && t.querySelector(`[data-filtre-${k}]`)),
      verrou: getComputedStyle(document.documentElement).overflow === 'hidden' || getComputedStyle(document.body).overflow === 'hidden' };
  });
  dit(!!S, `${nom} · la feuille « Relier un achat » s'ouvre`);
  const s = S || {};
  dit(s.sug && s.dit, `${nom} · « Suggestions » en haut (la liste, ou « Aucune suggestion » dit en clair)`, JSON.stringify(s));
  dit(s.tous && s.ordre, `${nom} · « Tous mes achats » est affiché sous les suggestions, sans rien toucher`, JSON.stringify({ tous: s.tous, ordre: s.ordre }));
  dit(s.nLibres + s.nPris === reliables.length && s.nPris === reliesTx.length, `${nom} · « Tous mes achats » compte les ${reliables.length} achats qu'on peut relier (dont ${reliesTx.length} déjà reliés)`, `${s.nLibres} + ${s.nPris}`);
  dit(s.nMasques === exclusTx.length && /5 achats/.test(s.masques) && /masqu/.test(s.masques), `${nom} · « 5 achats retournés, en litige, remboursés ou annulés masqués » est dit`, s.masques);
  dit(s.recherche && s.filtres.length === 3, `${nom} · une recherche et les filtres rapides compte, mois, taille`, JSON.stringify(s.filtres));
  dit(s.verrou, `${nom} · la page derrière ne défile plus tant que la feuille est ouverte`);
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
    const box = (f.querySelector('.vrm-relier-feuille-boite') || corps).getBoundingClientRect();
    const x = box.left + box.width / 2, y = box.bottom - 6;
    const dessus = document.elementFromPoint(x, y);
    return { petits, coupes, hDoc: document.documentElement.scrollWidth > window.innerWidth + 1, hCorps: corps ? corps.scrollWidth > corps.clientWidth + 1 : true,
      dansEcran: box.top >= -1 && box.bottom <= window.innerHeight + 1, basVisible: !!(dessus && f.contains(dessus)), haut: Math.round(box.top), bas: Math.round(box.bottom), vh: window.innerHeight };
  });
  dit(!V.petits.length, `${nom} · chaque bouton, champ et filtre fait au moins 44 px`, V.petits.slice(0, 4).join(' | '));
  dit(!V.coupes.length, `${nom} · rien n'est coupé par « … »`, V.coupes.slice(0, 3).join(' | '));
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
  const manquent = reliables.filter((t) => !dansTous.has(t));
  dit(!manquent.length, `${nom} · en défilant, les ${reliables.length} achats qu'on peut relier sont tous atteignables`, `${manquent.length} manquent (ex. ${manquent.slice(0, 3).join(',')}) · ${dansTous.size} vus`);
  dit(L.every((x) => !exclusTx.includes(x.tx)), `${nom} · aucun achat retourné, en litige, remboursé ou annulé n'apparaît`, JSON.stringify(L.filter((x) => exclusTx.includes(x.tx))));
  const pris = L.filter((x) => x.pris).map((x) => x.tx);
  dit(JSON.stringify([...pris].sort()) === JSON.stringify([...reliesTx].sort()), `${nom} · les 3 achats déjà reliés sont dans la liste, marqués comme tels`, JSON.stringify(pris));
  const P = await pg.evaluate((tx) => {
    const l = document.querySelector(`[data-relier-feuille] [data-achat-pris="${tx}"]`); if (!l) return null;
    const d = l.querySelector('[data-relier-deja]'), b = l.querySelector('[data-relier-deplacer]');
    let op = 1; for (let e = l.querySelector('[data-relier-prix]'); e && e !== l; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
    return { deja: d ? d.textContent : '', bouton: b ? b.textContent : '', relier: !!l.querySelector('[data-relier-achat]'), op };
  }, txDe(5));
  dit(!!P && /Déjà relié à N°7/.test(P.deja) && P.op < 0.8, `${nom} · un achat déjà relié est grisé et dit « Déjà relié à N°7 »`, JSON.stringify(P));
  dit(!!P && /Relier quand même/.test(P.bouton) && !P.relier, `${nom} · son seul bouton est « Relier quand même »`, JSON.stringify(P));
  await pg.evaluate((tx) => { const e = document.querySelector(`[data-achat-pris="${tx}"]`); if (e) e.scrollIntoView({ block: 'center' }); }, txDe(5));
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: path.join(SHOTS, `relier-tout-${nom}-deja-relie.png`) });

  // 4 · « Relier quand même » DEMANDE d'abord ; « Annuler » n'écrit rien.
  await pg.locator(`[data-relier-deplacer="${txDe(5)}"]`).click().catch(() => {});
  const conf = pg.locator('.vrm-confirmation');
  await conf.first().waitFor({ timeout: 5000 }).catch(() => {});
  const C1 = await pg.evaluate(() => { const c = document.querySelector('.vrm-confirmation'); return c ? c.textContent : ''; });
  dit(/Déjà relié à N°7/.test(C1) && /délié/.test(C1) && /Relier quand même/.test(C1), `${nom} · « Relier quand même » ouvre une confirmation qui dit qu'il sera délié de N°7`, C1.slice(0, 160));
  await pg.screenshot({ path: path.join(SHOTS, `relier-tout-${nom}-confirmation.png`) });
  await pg.evaluate(() => { const c = document.querySelector('.vrm-confirmation'); const b = c && [...c.querySelectorAll('button')].find((x) => /Annuler/.test(x.textContent)); if (b) b.click(); });
  await pg.waitForTimeout(600);
  dit(!ecritures.length, `${nom} · « Annuler » : rien n'est relié ni délié`, ecritures.slice(0, 2).join(' | '));

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
  const rt = await cherche('taille 43');
  dit(rt.includes(t43Titre.tx) && (!t43Lue || rt.includes(t43Lue.tx)), `${nom} · chercher « taille 43 » trouve un 43 écrit dans le titre ET un 43 lu chez Vinted (titre muet)`, `${rt.length} · ${t43Lue ? t43Lue.tx : '—'}`);
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
