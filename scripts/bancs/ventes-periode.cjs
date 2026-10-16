// Banc : écran Ventes — une période choisie donne VENDU · FINALISÉ · VERSÉ, et
// les écarts expliqués ; Ma journée — courbe à points reliés sur 7 ou 14 jours ;
// Statistiques — UNE carte mensuelle « Vendu et reçu » ; « Prix de revente » —
// des comparables vérifiables (demande de Julien du 15 octobre).
// Ventes INVENTÉES (aucune donnée réelle : il vit dans le dépôt, public). Il juge
// les NOMBRES rendus (`data-*`, en centimes) et la STRUCTURE (polylignes, points,
// boutons), jamais un libellé (§6.5) :
//   1. période J-20 → J-5 : vendu = ventes faites dans la période (en cours
//      comprises, annulée et masquée exclues, Leboncoin et eBay compris) ;
//      finalisé = leur part finalisée ; versé = versements dans la période ;
//      chaque écart (vendue avant, versée après, sans date, masquée) est rendu
//      avec son montant et Σ écarts = versé − finalisé, au centime ;
//      une finalisée sans date de versement ⇒ « au moins » ;
//   2. dates de versement illisibles (522) ⇒ versé « pas su », jamais 0 ;
//   3. Ma journée : 14 jours par défaut, 7 sur un clic, une polyligne par
//      série, un point par jour et par série, toucher un jour ouvre son détail ;
//      reçu illisible ⇒ AUCUNE polyligne « reçu » (pas une ligne à 0) ;
//   4. Statistiques : une seule carte mensuelle, le dernier point « vendu » =
//      « Vendu ce mois » ; reçu non publié sur l'appareil ⇒ dit, pas inventé ;
//   5. Prix de revente : seulement les comptes LIÉS (une ligne de ventes d'un
//      compte supprimé n'entre pas), fenêtre de 12 mois (une vente de 2 ans
//      n'entre que dans « Tout »), et chaque groupe montre ses ventes, dont la
//      médiane se recompte.
// Revue du 15 octobre (défauts reproduits sur c6f701e, vraies données) :
//   6. LE CALCUL TOMBE JUSTE À L'ÉCRAN : les trois chiffres et chaque écart sont
//      relus dans le TEXTE rendu (pas dans les `data-*`) — finalisé + Σ écarts
//      = versé, vendu − finalisé = en cours, au centime. Arrondis à l'euro,
//      « 3 776 € + 657,80 − 157 − 1 547 » ne donnait pas « 2 730 € » ;
//   7. RELECTURE DISCRÈTE RATÉE (un compte ne répond plus) : AUCUN des trois
//      totaux ne garde ses ventes — Vendu et Finalisé les gardaient, Versé les
//      retirait, sous « Sans X : ces totaux sont partiels » ;
//   8. Leboncoin et eBay dans le versé ⇒ la règle de date le dit (ils sont datés
//      à la vente : aucune date de versement captée) ; « sans date de versement »
//      écrit au plus une fois ; peu de lignes de texte à 390 px ;
//   9. Statistiques : « N ventes attendent leur date de versement » dit UNE fois
//      sur l'écran (la carte du mois le dit, avec le geste) ; le geste « Ventes »
//      n'est plus un bouton de 44 px DANS une phrase (téléphone) ;
//  10. Prix de revente : « +8 % au-dessus » dit au-dessus DE QUOI.
// Lancer : npm run build && node scripts/bancs/ventes-periode.cjs   (PORT=5951)
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.PORT) || 5951;
const CAPTURES = process.env.CAPTURES || '';

const maintenant = new Date();
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const cle = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const vente = (id, prix, statut, d, titre) => ({ transaction_id: id, title: titre || 'Paire ' + id, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString() });

// ── Les ventes inventées (compte 111) ────────────────────────────────────────
// La période jugée : du J-20 au J-5 (inclus).
const DEBUT = il(20), FIN = il(5);
const V = {
  A: { o: vente(7001, 50, 'Commande finalisée', il(10)), verse: il(6) },          // vendue et versée dans la période
  B: { o: vente(7002, 80, 'Commande finalisée', il(12)), verse: il(2) },          // vendue dedans, versée APRÈS
  C: { o: vente(7003, 30, 'Commande finalisée', il(25)), verse: il(15) },         // vendue AVANT, versée dedans
  D: { o: vente(7004, 45, 'Paiement validé', il(8)), verse: null },               // en cours
  E: { o: vente(7005, 65, 'Commande finalisée', il(9)), verse: null, sansDate: true }, // finalisée sans date de versement
  F: { o: vente(7006, 90, 'Commande annulée', il(11)), verse: null },             // annulée : nulle part
  G: { o: vente(7007, 25.5, 'Commande finalisée', il(14)), verse: il(7), masquee: true }, // masquée d'un ✕
  H: { o: vente(7008, 35, 'Commande finalisée', il(30)), verse: null },          // vendue AVANT, finalisée, sans date : peut tomber dans la période (« au moins »)
};
const LBC = { L1: { txId: 'L1', isSeller: true, price: 4000, stepLabel: 'Paiement effectué', dateVente: il(13).toISOString(), title: 'lbc' } };
const EBAY = [{ orderId: 'E1', orderPaymentStatus: 'PAID', creationDate: il(16).toISOString(), pricingSummary: { total: { value: '60.00', currency: 'EUR' } }, lineItems: [{ title: 'ebay' }] }];
// Ce que le banc ATTEND, calculé ici depuis les définitions — jamais lu dans l'app.
const c = (x) => Math.round(Number(x.o.price.amount) * 100);
const ATT = {
  vendu: c(V.A) + c(V.B) + c(V.D) + c(V.E) + 4000 + 6000,
  fin: c(V.A) + c(V.B) + c(V.E) + 4000 + 6000,
  enCours: c(V.D),
  verse: c(V.A) + c(V.C) + c(V.G) + 4000 + 6000,
  ecart: { avant: c(V.C), apres: -c(V.B), sansDate: -c(V.E), masquees: c(V.G) },
};

// « Prix de revente » : deux comptes liés (111, 222) + un compte SUPPRIMÉ (999,
// encore des ventes en base) ; une vente vieille de 2 ans.
const ancien = new Date(maintenant); ancien.setFullYear(ancien.getFullYear() - 2);
const PQM_111 = [
  vente(8001, 70, 'Commande finalisée', il(30), 'Nike Air Max 1 blanche taille 42'),
  vente(8002, 80, 'Commande finalisée', il(60), 'Nike Air Max 1 noire taille 42'),
  vente(8003, 200, 'Commande finalisée', ancien, 'Nike Air Max 1 rouge taille 42'),   // hors fenêtre de 12 mois
];
const PQM_222 = [vente(8101, 60, 'Commande finalisée', il(40), 'Nike Air Max 1 grise taille 42')];
const PQM_999 = [vente(8901, 999, 'Commande finalisée', il(20), 'Nike Air Max 1 verte taille 42'), vente(8902, 999, 'Commande finalisée', il(21), 'Nike Air Max 1 verte taille 42')];

const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_un', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
  { id: 2, vinted_user_id: '222', login: 'compte_deux', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
];
const txn = (uid, id, d) => ({ id: `harvest_${uid}_txn_${id}`, data: { capturedAt: maintenant.toISOString(), payload: { transaction: { id, status: 450, status_updated_at: d.toISOString() } } } });
const lignes = (versementsLisibles) => [
  { id: 'harvest_111_listings', data: { capturedAt: maintenant.toISOString(), payload: { items: [{ id: 5001, title: 'Nike Air Max 1 bleue taille 42', price: { amount: '75.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false }] } } },
  { id: 'harvest_222_listings', data: { capturedAt: maintenant.toISOString(), payload: { items: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: maintenant.toISOString(), payload: { my_orders: [...Object.values(V).map((x) => x.o), ...PQM_111] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: maintenant.toISOString(), payload: { my_orders: PQM_222 } } },
  { id: 'harvest_999_orders_sold', data: { capturedAt: maintenant.toISOString(), payload: { my_orders: PQM_999 } } },
  { id: 'lbc_ventes', data: { ventes: LBC } },
  { id: 'ebay_orders', data: { orders: EBAY } },
  ...(versementsLisibles ? [...Object.values(V).filter((x) => x.verse).map((x) => txn('111', x.o.transaction_id, x.verse)),
    ...PQM_111.map((o) => txn('111', o.transaction_id, new Date(Date.parse(o.date) + 3 * 86400e3))), ...PQM_222.map((o) => txn('222', o.transaction_id, new Date(Date.parse(o.date) + 3 * 86400e3)))] : []),
];

let ko = 0, ok = 0;
const dit = (cond, m, d) => { if (cond) ok++; else ko++; console.log((cond ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

const ouvrir = async (b, vp, { versements = true, onglet = 'cat_ventes', sombre = false, publie = null, panne = null } = {}) => {
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([s, pub, masq]) => { try {
    localStorage.setItem('vrm_acces_direct', '1');
    localStorage.setItem('vinted_dark', s ? 'true' : 'false');
    localStorage.setItem('vrm_bascule_mineral_v1', '1');
    localStorage.setItem('vinted_sales_hidden', JSON.stringify(masq));
    if (pub) localStorage.setItem('vinted_urssaf_mois', JSON.stringify(pub));
  } catch (_) {} }, [sombre, publie, [String(V.G.o.transaction_id)]]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const L = lignes(versements);
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (!versements && /_txn_/.test(u) && /like\./.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    // Une panne posée APRÈS le chargement (relecture discrète ratée) : 522 + HTML, la vraie forme.
    if (panne && [...panne].some((p) => u.includes(p))) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z]+:data->[a-z]+$/i.test(sel)) { const [al, src] = sel.split(':'); return { [al]: (r.data || {})[src.split('->')[1]] }; }
      if (/^[a-z]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) { const m = /^([a-z]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; }
        return o;
      }
      return { ...r, updated_at: maintenant.toISOString(), cap: r.data.capturedAt };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(L.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(L.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};
const tombe = (pg) => pg.evaluate(() => /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText));
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
// Choisit la période J-20 → J-5 dans le sélecteur de l'écran Ventes.
const choisirPeriode = async (pg) => {
  await pg.waitForSelector('.vrm-period button', { timeout: 20000 });
  await pg.locator('.vrm-period .vrm-rangee button').first().click();
  await pg.locator('.vrm-period-panel button[aria-pressed]', { hasText: /dates/i }).click();
  await pg.fill('input[aria-label="Début de la période"]', cle(DEBUT));
  await pg.fill('input[aria-label="Fin de la période"]', cle(FIN));
  await pg.locator('.vrm-period-panel button.vrm-button').click();
  await pg.waitForTimeout(400);
};
// Un montant tel qu'il est ÉCRIT (« 4 224,77 € », « −157 € », « +25,50 € ») → centimes.
const ecritEnCts = (t) => { const m = /([+−-]?)\s*([\d\s\u202f\u00a0]+)(?:,(\d{1,2}))?\s*€/.exec(String(t || '')); if (!m) return null;
  const v = Number(m[2].replace(/[\s\u202f\u00a0]/g, '')) * 100 + (m[3] ? Number(m[3].padEnd(2, '0')) : 0); return (m[1] === '−' || m[1] === '-') ? -v : v; };
const lireBilan = (pg) => pg.evaluate(() => {
  const e = document.querySelector('[data-bilan-periode]'); if (!e) return null;
  const ec = {}, ecTexte = {};
  for (const x of e.querySelectorAll('[data-ecart-cts]')) { ec[x.getAttribute('data-ecart')] = Number(x.getAttribute('data-ecart-cts')); ecTexte[x.getAttribute('data-ecart')] = x.textContent; }
  const bloc = e.lastElementChild; const lh = bloc ? parseFloat(getComputedStyle(bloc).lineHeight) : 0;
  return { vendu: e.getAttribute('data-vendu'), fin: e.getAttribute('data-finalise'), enCours: e.getAttribute('data-en-cours'), verse: e.getAttribute('data-verse'),
    etat: e.getAttribute('data-verse-etat'), auMoins: e.getAttribute('data-au-moins'), ec, ecTexte, texte: e.innerText,
    affiches: [...e.querySelectorAll('.vrm-display')].map((x) => x.textContent),
    coupes: [...e.querySelectorAll('.vrm-display')].filter((x) => { const r = document.createRange(); r.selectNodeContents(x); return r.getBoundingClientRect().width > x.clientWidth + 0.5; }).map((x) => x.textContent),
    dates: (e.querySelector('[data-bilan-dates]') || {}).getAttribute ? e.querySelector('[data-bilan-dates]').getAttribute('data-bilan-dates') : null,
    sans: (e.querySelector('[data-bilan-sans]') || {}).getAttribute ? e.querySelector('[data-bilan-sans]').getAttribute('data-bilan-sans') : null,
    lignesTexte: bloc && lh ? Math.round((bloc.getBoundingClientRect().height - parseFloat(getComputedStyle(bloc).paddingTop)) / lh) : null };
});

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    // ── 1. Ventes : la période ─────────────────────────────────────────────
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const sombre of [false, true]) {
      console.log(`\n── Ventes, période J-20 → J-5, ${vp.width} px, ${sombre ? 'sombre' : 'clair'}`);
      await essaie(`ventes ${vp.width}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, { sombre });
        await choisirPeriode(pg);
        await pg.waitForFunction(() => { const e = document.querySelector('[data-bilan-periode]'); return e && e.getAttribute('data-verse-etat') === 'lu'; }, null, { timeout: 15000 }).catch(() => {});
        const r = await lireBilan(pg);
        if (CAPTURES) { await pg.evaluate(() => { const e = document.querySelector('[data-bilan-periode]'); if (e) e.scrollIntoView({ block: 'center' }); }); await pg.screenshot({ path: path.join(CAPTURES, `ventes-periode-${vp.width}-${sombre ? 'sombre' : 'clair'}.png`) }); }
        dit(!(await tombe(pg)) && errs.length === 0, 'l’écran s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
        dit((await deborde(pg)) <= 1, 'aucun débordement horizontal', `${await deborde(pg)} px`);
        dit(!!r, 'une période choisie affiche son bilan');
        if (!r) { await ctx.close(); return; }
        dit(r.vendu === String(ATT.vendu), 'VENDU = ventes faites dans la période (en cours comprises, annulée et masquée exclues, Leboncoin et eBay compris)', `${r.vendu} · attendu ${ATT.vendu}`);
        dit(r.fin === String(ATT.fin), 'FINALISÉ = leur part finalisée', `${r.fin} · attendu ${ATT.fin}`);
        dit(Number(r.vendu) - Number(r.fin) === Number(r.enCours) && r.enCours === String(ATT.enCours), 'vendu − finalisé = en cours, dit à côté', `${r.enCours} · attendu ${ATT.enCours}`);
        dit(r.etat === 'lu' && r.verse === String(ATT.verse), 'VERSÉ = argent versé dans la période (dont une vente d’avant, et la masquée)', `${r.verse} · attendu ${ATT.verse}`);
        for (const [k, v] of Object.entries(ATT.ecart)) dit(r.ec[k] === v, `écart « ${k} » rendu avec son montant`, `${r.ec[k]} · attendu ${v}`);
        const somme = Object.values(r.ec).reduce((a, x) => a + x, 0);
        dit(somme === Number(r.verse) - Number(r.fin), 'Σ écarts = versé − finalisé, au centime', `${somme} · ${Number(r.verse) - Number(r.fin)}`);
        dit(r.auMoins === '1', 'une finalisée sans date de versement ⇒ le versé est un MINORANT (« au moins »)');
        // ── 6. Le calcul tombe juste À L'ÉCRAN, au centime (revue du 15 octobre)
        const [aV, aF, aVe] = r.affiches.map(ecritEnCts);
        dit(aV === Number(r.vendu) && aF === Number(r.fin) && aVe === Number(r.verse), 'les trois chiffres sont ÉCRITS au centime (ceux qu’on recompte)', r.affiches.join(' · '));
        const ecEcrits = Object.values(r.ecTexte).map(ecritEnCts);
        dit(ecEcrits.every((x) => x != null) && aF + ecEcrits.reduce((t, x) => t + x, 0) === aVe, 'finalisé + Σ écarts ÉCRITS = versé ÉCRIT, au centime', `${aF} + (${ecEcrits.join(' ')}) · versé ${aVe}`);
        dit(r.coupes.length === 0, 'aucun chiffre coupé', r.coupes.join(' · '));
        // ── 8. La règle de date et le peu de texte
        dit(r.dates === 'Leboncoin,eBay', 'Leboncoin et eBay dans le versé ⇒ la règle de date dit qu’ils sont datés à la vente', `« ${r.dates} »`);
        const sd = (r.texte.match(/sans date de versement/g) || []).length;
        dit(sd <= 1, '« sans date de versement » écrit au plus une fois', `${sd} fois`);
        if (vp.width < 600) dit(r.lignesTexte != null && r.lignesTexte <= 5, 'le texte sous les chiffres tient en 5 lignes au plus à 390 px', `${r.lignesTexte} lignes`);
        await ctx.close();
      });
    }

    // ── 7. Relecture discrète ratée : un compte ne répond plus ─────────────
    console.log('\n── Ventes, relecture discrète ratée (compte_un ne répond plus)');
    await essaie('relecture ratée', async () => {
      const panne = new Set();
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, { panne });
      await choisirPeriode(pg);
      await pg.waitForFunction(() => { const e = document.querySelector('[data-bilan-periode]'); return e && e.getAttribute('data-verse-etat') === 'lu'; }, null, { timeout: 15000 }).catch(() => {});
      const r0 = await lireBilan(pg);
      await pg.waitForTimeout(4500);   // l'écran regroupe deux signaux à moins de 4 s
      panne.add('harvest_111_');
      await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:ext', { detail: { type: 'maj', quoi: 'ventes' } })));
      await pg.waitForFunction(() => !!document.querySelector('[data-bilan-sans]'), null, { timeout: 15000 }).catch(() => {});
      await pg.waitForTimeout(800);
      const r = await lireBilan(pg);
      // Sans compte_un, il ne reste que Leboncoin et eBay (4000 + 6000), tous finalisés et versés.
      const hors = 4000 + 6000;
      dit(!(await tombe(pg)) && errs.length === 0, 'l’écran s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
      dit(r0 && r0.vendu === String(ATT.vendu), 'avant la panne : le bilan complet', r0 && r0.vendu);
      dit(r && /111|compte_un/.test(r.sans || ''), 'le compte qui n’a pas répondu est nommé (« Sans compte_un »)', r && r.sans);
      dit(r && r.vendu === String(hors), 'VENDU ne garde pas les ventes du compte qui n’a pas répondu', r && `${r.vendu} · attendu ${hors}`);
      dit(r && r.fin === String(hors), 'FINALISÉ non plus', r && `${r.fin} · attendu ${hors}`);
      dit(r && r.verse === String(hors), 'VERSÉ non plus — les trois sur les mêmes comptes', r && `${r.verse} · attendu ${hors}`);
      dit(r && !('nonLus' in r.ec), 'aucun écart « comptes non lus » (il venait de deux listes différentes)', r && JSON.stringify(r.ec));
      await ctx.close();
    });
    console.log('\n── Ventes, dates de versement illisibles (522)');
    await essaie('versements illisibles', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, { versements: false });
      await choisirPeriode(pg);
      await pg.waitForFunction(() => { const e = document.querySelector('[data-bilan-periode]'); return e && e.getAttribute('data-verse-etat') !== 'encours'; }, null, { timeout: 15000 }).catch(() => {});
      const r = await lireBilan(pg);
      dit(!(await tombe(pg)) && errs.length === 0, 'l’écran s’affiche', errs.join(' | ').slice(0, 160));
      dit(r && r.etat === 'passu' && r.verse === '', 'versé « pas su » : aucun montant, jamais 0', r && `${r.etat} « ${r.verse} »`);
      dit(r && r.vendu === String(ATT.vendu), 'le vendu reste juste (il ne dépend pas des versements)', r && r.vendu);
      await ctx.close();
    });

    // ── 2. Ma journée : la courbe à points reliés ───────────────────────────
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const sombre of [false, true]) {
      console.log(`\n── Ma journée, courbe, ${vp.width} px, ${sombre ? 'sombre' : 'clair'}`);
      await essaie(`courbe ${vp.width}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, { onglet: 'journee', sombre });
        await pg.waitForSelector('[data-vendu-recu]', { state: 'attached', timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        // Sur téléphone le bloc est replié : on l'ouvre comme lui.
        await pg.evaluate(() => { const d = document.querySelector('[data-vendu-recu]'); const det = d && d.closest('details'); if (det && !det.open) det.querySelector('summary').click(); });
        await pg.waitForTimeout(300);
        const lit = () => pg.evaluate(() => {
          const c = document.querySelector('[data-vendu-recu]'); if (!c) return null;
          return { jours: c.querySelectorAll('[data-jour]').length, polyV: c.querySelectorAll('polyline[data-serie="vendu"]').length, polyR: c.querySelectorAll('polyline[data-serie="recu"]').length,
            ptsV: c.querySelectorAll('[data-point="vendu"]').length, ptsR: c.querySelectorAll('[data-point="recu"]').length,
            bascule: [...c.querySelectorAll('button[aria-pressed]')].filter((x) => /jours/.test(x.textContent)).length };
        });
        let r = await lit();
        dit(!(await tombe(pg)) && errs.length === 0, 'l’écran s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
        dit((await deborde(pg)) <= 1, 'aucun débordement horizontal', `${await deborde(pg)} px`);
        dit(r && r.jours === 14, '14 jours par défaut', r && r.jours);
        dit(r && r.polyV >= 1 && r.polyR >= 1, 'des points RELIÉS : une ligne « vendu » et une ligne « reçu »', r && `${r.polyV}/${r.polyR}`);
        dit(r && r.ptsV === 14 && r.ptsR === 14, 'un point par jour et par série', r && `${r.ptsV}/${r.ptsR}`);
        dit(r && r.bascule === 2, 'une bascule 7 / 14 jours', r && r.bascule);
        await pg.locator('[data-vendu-recu] button[aria-pressed]', { hasText: '7 jours' }).click();
        r = await lit();
        dit(r && r.jours === 7 && r.ptsV === 7, '« 7 jours » : 7 jours, 7 points', r && `${r.jours}/${r.ptsV}`);
        // Toucher un jour : son détail (date + montants) s'ouvre.
        const j = cle(il(6));
        await pg.locator(`[data-vendu-recu] [data-jour="${j}"]`).click();
        const bulle = await pg.evaluate((k) => { const e = document.querySelector(`[data-infobulle="${k}"]`); return e ? e.innerText : null; }, j);
        dit(!!bulle && /€/.test(bulle), 'toucher un jour ouvre son détail (date, montants)', (bulle || '').replace(/\s+/g, ' ').slice(0, 80));
        if (CAPTURES) { await pg.evaluate(() => { const e = document.querySelector('[data-vendu-recu]'); if (e) e.scrollIntoView({ block: 'center' }); }); await pg.screenshot({ path: path.join(CAPTURES, `journee-courbe-${vp.width}-${sombre ? 'sombre' : 'clair'}.png`) }); }
        await ctx.close();
      });
    }
    console.log('\n── Ma journée, reçu illisible');
    await essaie('courbe reçu illisible', async () => {
      const { ctx, pg } = await ouvrir(b, { width: 1512, height: 950 }, { onglet: 'journee', versements: false });
      await pg.waitForSelector('[data-vendu-recu]', { state: 'attached', timeout: 20000 }).catch(() => {});
      await pg.waitForTimeout(1500);
      const r = await pg.evaluate(() => { const c = document.querySelector('[data-vendu-recu]'); return c && { polyR: c.querySelectorAll('polyline[data-serie="recu"]').length, ptsR: c.querySelectorAll('[data-point="recu"]').length, recus: [...c.querySelectorAll('[data-jour]')].map((x) => x.getAttribute('data-recu')) }; });
      dit(r && r.polyR === 0 && r.ptsR === 0, 'aucune ligne ni point « reçu » — jamais une ligne à 0', r && `${r.polyR}/${r.ptsR}`);
      dit(r && r.recus.every((x) => x === ''), 'aucun montant « reçu » inventé', r && r.recus.slice(-3).join(','));
      await ctx.close();
    });

    // ── 3. Statistiques : une seule carte mensuelle ─────────────────────────
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`\n── Statistiques, ${vp.width} px`);
      await essaie(`stats ${vp.width}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, { onglet: 'dashboard' });
        await pg.waitForFunction(() => document.querySelector('[data-dash-stat="caMois"]'), null, { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const r = await pg.evaluate(() => {
          const cartes = document.querySelectorAll('[data-courbe-mois]');
          const m = document.querySelector('[data-mois]');
          const pts = m ? [...m.querySelectorAll('[data-jour]')] : [];
          const der = pts[pts.length - 1];
          const barres = [...document.querySelectorAll('[role="img"]')].filter((x) => /par mois/.test(x.getAttribute('aria-label') || '')).length;
          return { dates: document.querySelectorAll('input[type="date"]').length, porte: !!document.querySelector('[data-porte-periode]'), cartes: cartes.length, mois: pts.length, dernierVendu: der ? der.getAttribute('data-vendu') : null, caMois: (document.querySelector('[data-dash-stat="caMois"]') || {}).getAttribute ? document.querySelector('[data-dash-stat="caMois"]').getAttribute('data-dash-cents') : null,
            polyV: m ? m.querySelectorAll('polyline[data-serie="vendu"]').length : 0, recuAbsent: !!document.querySelector('[data-recu-absent]'), polyR: m ? m.querySelectorAll('polyline[data-serie="recu"]').length : 0, barres };
        });
        if (CAPTURES) { await pg.evaluate(() => { const e = document.querySelector('[data-courbe-mois]'); if (e) e.scrollIntoView({ block: 'center' }); }); await pg.screenshot({ path: path.join(CAPTURES, `stats-mois-${vp.width}.png`) }); }
        dit(!(await tombe(pg)) && errs.length === 0, 'l’écran s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
        dit((await deborde(pg)) <= 1, 'aucun débordement horizontal', `${await deborde(pg)} px`);
        dit(r.cartes === 1 && r.barres === 0, 'UNE carte mensuelle (plus de seconde courbe sous un autre nom)', `${r.cartes} carte(s), ${r.barres} graphique(s) en barres`);
        dit(r.mois === 12 && r.polyV >= 1, '12 mois, en points reliés', `${r.mois} · ${r.polyV}`);
        dit(r.dernierVendu != null && r.dernierVendu === r.caMois, 'le dernier point « vendu » = « Vendu ce mois »', `${r.dernierVendu} · ${r.caMois}`);
        dit(r.recuAbsent && r.polyR === 0, 'reçu pas encore publié sur cet appareil : dit, aucune ligne inventée', `${r.recuAbsent} · ${r.polyR}`);
        // « CA entre deux dates » sommait l'archive vide : 0,00 € sur toute période.
        dit(r.dates === 0 && r.porte, 'plus de « CA entre deux dates » à zéro : une porte vers la période de Ventes', `${r.dates} champ(s) date · porte ${r.porte}`);
        // ── 9. Un bouton DANS une phrase ne doit pas casser l'interligne (téléphone : 44 px).
        const casse = await pg.evaluate(() => {
          const c = document.querySelector('[data-courbe-mois]'); const carte = c && c.parentElement; if (!carte) return null;
          return [...carte.querySelectorAll('button')].filter((bt) => { const p = bt.parentElement;
            const dansPhrase = [...p.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
            return dansPhrase && bt.getBoundingClientRect().height > 1.5 * parseFloat(getComputedStyle(p).lineHeight || '0'); }).map((bt) => `${bt.textContent} ${Math.round(bt.getBoundingClientRect().height)} px`);
        });
        dit(casse && casse.length === 0, 'aucun bouton haut de 44 px au milieu d’une phrase (l’interligne tient)', casse && casse.join(' · '));
        dit(await pg.evaluate(() => { const z = document.querySelector('[data-recu-absent]'); return !!(z && z.querySelector('button')); }), 'le geste « ouvrir Ventes » reste là, en vrai bouton');
        if (vp.width > 600) {
          await pg.locator('[data-porte-periode]').click();
          await pg.waitForSelector('.vrm-period', { timeout: 15000 }).catch(() => {});
          dit(await pg.evaluate(() => !!document.querySelector('.vrm-period')), 'la porte mène au sélecteur de période de Ventes');
        }
        await ctx.close();
      });
    }
    console.log('\n── Statistiques après l’écran Ventes (reçu publié)');
    await essaie('stats publiées', async () => {
      const { ctx, pg } = await ouvrir(b, { width: 1512, height: 950 }, { onglet: 'cat_ventes' });
      await pg.waitForFunction(() => { try { const v = JSON.parse(localStorage.getItem('vinted_urssaf_mois') || 'null'); return v && Array.isArray(v.mois); } catch (_) { return false; } }, null, { timeout: 20000 }).catch(() => {});
      await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
      await pg.waitForFunction(() => document.querySelector('[data-mois]'), null, { timeout: 20000 }).catch(() => {});
      await pg.waitForTimeout(1200);
      const r = await pg.evaluate(() => { const m = document.querySelector('[data-mois]'); const pts = m ? [...m.querySelectorAll('[data-jour]')] : [];
        return { polyR: m ? m.querySelectorAll('polyline[data-serie="recu"]').length + m.querySelectorAll('[data-point="recu"]').length : 0, recu: pts.map((p) => [p.getAttribute('data-jour'), p.getAttribute('data-recu')]), pub: JSON.parse(localStorage.getItem('vinted_urssaf_mois') || 'null') }; });
      const pub = r.pub && Object.fromEntries(r.pub.mois.map((m) => [m.ym, Math.round((m.recu || 0) * 100)]));
      dit(r.polyR > 0, 'la série « reçu » apparaît une fois publiée par l’écran Ventes');
      dit(pub && r.recu.every(([k, v]) => String(pub[k] || 0) === v), 'chaque point « reçu » = le reçu publié du mois (consommé, pas recalculé)', JSON.stringify(r.recu.slice(-3)));
      // ── 9. Une cause, une phrase : la vente finalisée sans date de versement est
      //    dite par la carte du mois (avec le geste), pas une seconde fois au-dessus.
      const dits = await pg.evaluate(() => (document.body.innerText.match(/[^\n]*(sans date de versement|attend\w* encore (?:leur|sa) date de versement)[^\n]*/g) || []));
      dit(dits.length === 1, '« ventes sans date de versement » dit UNE fois sur l’écran Statistiques', `${dits.length} : ${dits.map((x) => x.slice(0, 70)).join(' | ')}`);
      await ctx.close();
    });

    // ── 4. Prix de revente ───────────────────────────────────────────────────
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`\n── Prix de revente, ${vp.width} px`);
      await essaie(`pqm ${vp.width}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, { onglet: 'prixmarche' });
        await pg.waitForFunction(() => document.querySelector('[data-pqm-groupe]') || /pas pu s'afficher|Pas encore|Aucun modèle/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const lit = () => pg.evaluate(() => [...document.querySelectorAll('[data-pqm-groupe]')].map((g) => ({ k: g.getAttribute('data-pqm-groupe'), n: Number(g.getAttribute('data-pqm-n')), med: Number(g.getAttribute('data-pqm-med')), ventes: [...g.querySelectorAll('[data-pqm-vente]')].map((v) => Number(v.getAttribute('data-pqm-vente'))) })));
        let g = await lit();
        const am = g.find((x) => /air max 1\|42/i.test(x.k));
        const med = (a) => { const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
        dit(!(await tombe(pg)) && errs.length === 0, 'l’écran s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
        dit((await deborde(pg)) <= 1, 'aucun débordement horizontal', `${await deborde(pg)} px`);
        dit(!!am && am.n === 3, '12 mois : les 3 ventes des comptes LIÉS (ni le compte supprimé, ni la vente de 2 ans)', am && `${am.n} · ${am.ventes.join(',')}`);
        dit(!!am && !am.ventes.includes(99900), 'aucune vente du compte supprimé', am && am.ventes.join(','));
        dit(!!am && am.ventes.length === am.n && med(am.ventes) === am.med, 'chaque groupe montre ses ventes, et sa médiane se recompte', am && `${am.ventes.join(',')} → ${am.med}`);
        // ── 10. « +8 % au-dessus. » — au-dessus de QUOI ? La comparaison nomme sa référence.
        const comp = await pg.evaluate(() => (document.body.innerText.match(/Tu les affiches[^\n]*/) || [''])[0]);
        dit(/(%\s*(au-dessus|en dessous) du prix de revente|au niveau du prix de revente)/.test(comp), 'la comparaison au prix de revente nomme sa référence', comp.slice(0, 120));
        if (CAPTURES) { await pg.evaluate(() => { const d = document.querySelector('[data-pqm-groupe]'); if (d) d.open = true; }); await pg.screenshot({ path: path.join(CAPTURES, `prix-revente-${vp.width}.png`), fullPage: true }); }
        await pg.locator('button[aria-pressed]', { hasText: 'Tout' }).click();
        await pg.waitForTimeout(300);
        g = await lit();
        const am2 = g.find((x) => /air max 1\|42/i.test(x.k));
        dit(!!am2 && am2.n === 4 && am2.ventes.includes(20000), '« Tout » ajoute la vente de 2 ans — la fenêtre porte', am2 && `${am2.n}`);
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'banc', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
