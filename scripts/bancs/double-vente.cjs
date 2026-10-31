// Banc : VENDUE SUR LEBONCOIN → À RETIRER DE VINTED (anti double vente, 4 octobre).
//
// Julien : « quand une paire est vendue sur une plateforme, elle doit disparaître
// des autres, pour éviter de vendre deux fois la même paire ». Sur des données
// INVENTÉES (il vit dans le dépôt), rendu à 390 et 1512 px, il exige :
//   · une vente Leboncoin reliée (lien posé à la main) à une paire encore en
//     vente sur Vinted ⇒ l'alerte, avec le N° et le LIEN vers l'annonce Vinted ;
//   · une vente NON reliée, dont le titre est IDENTIQUE à deux paires en ligne,
//     ne déclenche AUCUNE alerte toute seule : elle demande « quelle paire ? » et
//     PROPOSE les deux (c'est son clic qui relie, §5) ;
//   · un clic sur la bonne paire écrit le lien (`vrm_lbc_liens`) et l'alerte
//     apparaît pour celle-là — et pas pour sa jumelle ;
//   · son annonce jamais reliée, sur le compte dont il a VENDU une annonce, est
//     enfin listée ; celle d'un inconnu (étiquetée de son propre compte) non ;
//   · le tableau de bord dit la même chose (même règle, §11) ;
//   · aucun débordement, aucune erreur.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { monterTiroirs } = require('./_tiroirs.cjs');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4341;

const auj = new Date();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const annonce = (id, titre, prix, extra) => ({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: titre.split(' ')[0], size_title: (/taille (\d+)/.exec(titre) || [])[1] || '', is_closed: false, is_hidden: false, is_draft: false, photo: { url: 'https://img.test/v' + id + '.jpg' }, ...(extra || {}) });
const LISTINGS = { capturedAt: auj.toISOString(), payload: { items: [
  annonce(5001, 'Nike Air Max 1 olive taille 42', 80),
  annonce(5002, 'Salomon XT-6 blanc taille 40', 99),
  annonce(5003, 'Adidas Samba noir taille 39', 70),
  annonce(5004, 'Adidas Samba noir taille 39', 70),     // sa jumelle exacte
  // Trois paires POSTÉES sur Leboncoin dont l'annonce Vinted n'est plus en
  // ligne — removals à 3 états : 5010 fermée+prouvée vendue → « vendue » ;
  // 5011 masquée → « pause » (PAS vendue) ; 5012 fermée sans preuve → doute.
  annonce(5010, 'Reebok Club C taille 41', 60, { is_closed: true }),
  annonce(5011, 'Asics Gel taille 43', 55, { is_hidden: true }),
  annonce(5012, 'New Balance 550 taille 42', 90, { is_closed: true }),
  // (26 oct.) N°60 : EN LIGNE sur Vinted, VENDUE SUR eBAY, encore en ligne sur
  // Leboncoin (lbc6) ⇒ croisement eBay → Leboncoin « à retirer de Leboncoin ».
  annonce(5060, 'Reebok Nano X taille 44', 65),
] } };
const MAIN = {
  vinted_annonce_numeros: {
    '5001': { numero: '12', title: 'Nike Air Max 1 olive taille 42', mp: { lbc: true } },
    '5002': { numero: '13', title: 'Salomon XT-6 blanc taille 40', mp: { lbc: true } },
    '5003': { numero: '14', title: 'Adidas Samba noir taille 39', mp: { lbc: true } },
    '5004': { numero: '15', title: 'Adidas Samba noir taille 39', mp: { lbc: true } },
    '5010': { numero: '20', title: 'Reebok Club C taille 41' },
    '5011': { numero: '21', title: 'Asics Gel taille 43' },
    '5012': { numero: '22', title: 'New Balance 550 taille 42' },
    '5060': { numero: '60', title: 'Reebok Nano X taille 44' },
    // DEUX fiches portent le N°40 (prix d'achat ≠) → coût AMBIGU : la carte
    // Ventes ne doit PAS montrer de bénéfice (le total de la compta ne le fait
    // pas non plus — ficheUniqueDuNumero).
    '5040': { numero: '40', title: 'Puma Suede taille 41', buyPrice: '20' },
    '5041': { numero: '40', title: 'Puma Suede taille 41', buyPrice: '35' },
  },
  vrm_lbc_liens: { lbc1: '12' },
  // Prix d'achat SAISI par numéro : N°12 → bénéfice de la vente reliée ; N°40
  // existe mais est porté par deux fiches → ambigu, pas de bénéfice.
  vinted_buyprice_by_num: { '12': '30', '40': '20' },
};
const MON = 'acc9';
const ITEMS = {
  lbc1: { id: 'lbc1', subject: 'Nike Air Max 1 olive T42', price: 85, account: MON, platform: 'leboncoin', status: 'active', images: ['https://img.test/lbc1.jpg'] },
  lbc2: { id: 'lbc2', subject: 'Adidas Samba noir taille 39', price: 72, account: MON, platform: 'leboncoin', status: 'active', images: ['https://img.test/lbc2.jpg'] },
  lbc3: { id: 'lbc3', subject: 'Salomon XT-6 blanc T40', price: 105, account: MON, platform: 'leboncoin', status: 'active', images: ['https://img.test/lbc3.jpg'] },
  lbc4: { id: 'lbc4', subject: 'Chalet 8 personnes', price: 900, account: 'inconnu', platform: 'leboncoin', status: 'active', images: [] },
  lbc5: { id: 'lbc5', subject: 'Puma Suede T41', price: 50, account: MON, platform: 'leboncoin', status: 'active', ref: '40', images: ['https://img.test/lbc5.jpg'] },
  // (26 oct.) Reliée à la N°60 par sa référence : vendue sur eBay (ebay_orders,
  // SKU VRM-60), encore en ligne ici ⇒ « à retirer de Leboncoin ».
  lbc6: { id: 'lbc6', subject: 'Reebok Nano X taille 44', price: 65, account: MON, platform: 'leboncoin', status: 'active', ref: '60', images: ['https://img.test/lbc6.jpg'] },
};
const VENTES = {
  t1: { txId: 't1', itemId: 'lbc1', isSeller: true, stepStatus: 'action', stepLabel: 'Colis à envoyer', price: 8500, title: 'Nike Air Max 1 olive T42', at: auj.toISOString() },
  t2: { txId: 't2', itemId: 'lbc2', isSeller: true, stepStatus: 'validation', stepLabel: 'Paiement effectué', price: 7200, title: 'Adidas Samba noir taille 39', at: auj.toISOString() },
  // Reliée (lien → N°40) mais N°40 porté par DEUX fiches → coût ambigu → aucun bénéfice.
  t3: { txId: 't3', itemId: 'lbc5', isSeller: true, stepStatus: 'action', stepLabel: 'Colis à envoyer', price: 5000, title: 'Puma Suede T41', at: auj.toISOString() },
};
const rows = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: LISTINGS },
  { id: 'lbc_listings', data: { items: ITEMS } },
  { id: 'lbc_ventes', data: { ventes: VENTES } },
  // Trois paires postées sur Leboncoin (removals) ; 5010 a une transaction
  // finalisée ⇒ vente PROUVÉE (vendue), 5011 masquée (pause), 5012 fermée (doute).
  { id: 'vinted_lbc_posted', data: { ids: ['5010', '5011', '5012', '5060'] } },
  { id: 'harvest_111_txn_990010', data: { capturedAt: auj.toISOString(), payload: { transaction: { id: '990010', item_id: '5010', status: 450, status_title: 'Vendu', status_updated_at: auj.toISOString() } } } },
  // (26 oct.) Une commande eBay PAYÉE dont le SKU VRM-60 désigne la N°60, encore
  // en ligne sur Leboncoin (lbc6) : croisement eBay → Leboncoin.
  { id: 'ebay_orders', data: { orders: [ { orderId: 'EB-60', orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', lineItems: [{ sku: 'VRM-60', title: 'Reebok Nano X taille 44', legacyItemId: '220000000060' }], pricingSummary: { total: { value: '65.00', currency: 'EUR' } } } ], capturedAt: auj.toISOString() } },
];
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
// Projection PostgREST : `alias:data->champ` / `alias:data->>champ` (§6.3).
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

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      rows[0].data = JSON.parse(JSON.stringify(MAIN));   // chaque passe repart de la même base
      const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      let bloquerPush = false;   // (26 oct.) course §5.49 : simule un push non abouti (le nuage ne garde pas l'écriture)
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
      await pg.route('**/rest/v1/**', (route) => {
        const u = decodeURIComponent(metaVersData(route.request().url()));
        const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
        // Une écriture de `main` est GARDÉE, comme dans la vraie base : sans ça,
        // l'écran suivant relisait l'ancien `main` et le banc mesurait une
        // fiction (§6.3 — le lien posé « disparaissait » au rechargement).
        if (route.request().method() !== 'GET') {
          try {
            if (!bloquerPush) { const corps = JSON.parse(route.request().postData() || 'null'); for (const l of [].concat(corps || [])) if (l && l.id === 'main' && l.data) rows[0].data = l.data; }
          } catch (_) {}
          return j([]);
        }
        // (26 oct.) La base de PRODUCTION est cloisonnée (migration 004) : la sonde
        // de schéma doit répondre 200 avec une ligne `owner`, comme `_porte-banc`
        // le suppose depuis le 21 oct. Avant, ce banc répondait 400 → l'app se
        // croyait NON cloisonnée → `cloudPush` coupé → un lien posé à la main
        // n'était jamais sauvé au nuage et la boucle de restauration l'écrasait au
        // rechargement. C'était un artefact du banc, pas un défaut de l'app.
        if (/select=owner/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ owner: process.env.BANC_SESSION_UID || '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }]) });
        if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
        const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
        const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
        const eq = /id=eq\.([^&]*)/.exec(u);
        if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
        const lk = /id=like\.([^&]*)/.exec(u);
        if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
        return j([]);
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      await pg.goto(`http://localhost:${PORT}/?tab=leboncoin`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-lbc-doublons], [data-lbc-ventes-a-relier]', { timeout: 15000 }).catch(() => {});
      await pg.waitForTimeout(800);
      const lire = () => pg.evaluate(() => ({
        n: Number((document.querySelector('[data-lbc-doublons]') || {}).getAttribute ? document.querySelector('[data-lbc-doublons]').getAttribute('data-lbc-doublons') : 0),
        doublons: [...document.querySelectorAll('[data-doublon]')].map((e) => ({ num: e.getAttribute('data-doublon'), href: (e.querySelector('a[href*="vinted.fr/items/"]') || {}).href || '' })),
        aRelier: Number((document.querySelector('[data-lbc-ventes-a-relier]') || { getAttribute: () => 0 }).getAttribute('data-lbc-ventes-a-relier')),
        sugg: [...document.querySelectorAll('[data-lbc-suggestions="lbc2"] [data-suggestion]')].map((e) => e.getAttribute('data-suggestion')),
        relier: [...document.querySelectorAll('[data-lbc-relier]')].map((e) => e.getAttribute('data-lbc-relier')),
        // (16 oct., capture de Julien) Le champ N° et « Relier » sortaient de
        // l'écran sur téléphone. Le contrôle de page entière ne le voyait pas
        // (la carte coupe). On mesure CHAQUE élément d'une ligne « relier » :
        // rien ne doit dépasser le bord droit de la ligne.
        // (16 oct., capture de Julien) L'app ROGNE ce qui dépasse (overflow clip) :
        // le contrôle de défilement de page ne voit rien. On cherche tout bouton
        // ou champ visible dont le bord droit sort de l'écran.
        deborde: [...document.querySelectorAll('button,input')].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.right > document.documentElement.clientWidth + 1;
        }).map((e) => (e.getAttribute('aria-label') || e.textContent.trim().slice(0, 14) || e.tagName)),
        // L'agent qui conseille (parité eBay) : la liste rangée des priorités.
        conseils: [...document.querySelectorAll('[data-lbc-conseil]')].map((e) => e.getAttribute('data-lbc-conseil')),
        retirerTxt: (document.querySelector('[data-lbc-conseil="retirer"]') || { textContent: '' }).textContent.trim(),
        retirerEbay: Number((document.querySelector('[data-lbc-retirer-ebay]') || { getAttribute: () => 0 }).getAttribute('data-lbc-retirer-ebay')),
        retirerEbayN: [...document.querySelectorAll('[data-lbc-retirer="lbc6"]')].map((e) => e.getAttribute('data-lbc-retirer')),
      }));
      const v1 = await lire();
      await pg.screenshot({ path: path.join(require('os').tmpdir(), 'double-vente-' + vp.width + '.png'), fullPage: true });
      dit(v1.doublons.length === 1 && v1.doublons[0].num === '12', 'vendue sur Leboncoin, encore sur Vinted ⇒ alerte pour la N°12, et elle seule', JSON.stringify(v1.doublons.map((d) => d.num)));
      dit(v1.doublons[0] && /vinted\.fr\/items\/5001$/.test(v1.doublons[0].href), 'l’alerte mène à L’annonce Vinted de cette paire', v1.doublons[0] && v1.doublons[0].href);
      dit(v1.aRelier === 1, 'la vente non reliée demande « quel article ? »', String(v1.aRelier));
      // « À faire sur Leboncoin » (parité eBay) : rangé, l'urgent d'abord.
      dit(v1.conseils.length > 0, '« À faire sur Leboncoin » liste les priorités', JSON.stringify(v1.conseils));
      dit(['retirer', 'doublons'].includes(v1.conseils[0]), 'la première priorité est urgente (à retirer d’une plateforme)', v1.conseils[0] || '(aucune)');
      dit(v1.conseils.includes('doublons') && v1.conseils.includes('relier-ventes'), 'elle porte la double vente ET la vente à relier de cet écran', JSON.stringify(v1.conseils));
      // ⚠️ RÉGRESSION #718 : le conseil « à retirer » comptait les 3 removals
      //    (1 vendue + 1 pause + 1 doute) comme « vendues ». Il ne doit compter
      //    que la vente PROUVÉE (N°20). Rouge-avant : « 3 paires vendues… ».
      dit(/(^|[^0-9])1 paire vendue sur Vinted/.test(v1.retirerTxt), 'le conseil « à retirer » ne compte que la vente PROUVÉE (1), jamais les paires en pause/doute', v1.retirerTxt.slice(0, 60));
      dit(v1.relier.length > 0 && v1.deborde.length === 0, 'aucun bouton ni champ rogné par le bord de l’écran (N°, Relier, Actualiser…)', v1.deborde.join(', ') || (v1.relier.length ? '' : 'aucune ligne'));
      dit(v1.sugg.includes('14') && v1.sugg.includes('15'), 'et PROPOSE les deux paires identiques — sans en choisir une', JSON.stringify(v1.sugg));
      dit(v1.relier.includes('lbc3'), 'son annonce jamais reliée (compte prouvé par une vente) est listée', JSON.stringify(v1.relier));
      dit(!v1.relier.includes('lbc4'), 'l’annonce d’un inconnu ne l’est pas');
      dit(!v1.relier.includes('lbc1') && v1.relier.filter((x) => x === 'lbc2').length === 1,
        'une annonce vendue n’est pas présentée comme « en ligne non reliée » (elle n’est que dans « quelle paire ? »)', JSON.stringify(v1.relier));
      // ── CROISEMENT eBay → LEBONCOIN (26 oct.) ─────────────────────────────────
      // La N°60, vendue sur eBay (ebay_orders, SKU VRM-60) et encore en ligne sur
      // Leboncoin (lbc6, N°60 toujours en vente sur Vinted donc hors du contrôle
      // Vinted), a sa propre carte « à retirer de Leboncoin ».
      dit(v1.retirerEbay === 1 && v1.retirerEbayN.length === 1,
        'vendue sur eBay, encore en ligne sur Leboncoin ⇒ « à retirer de Leboncoin » (N°60, sa propre carte), et elle seule', `carte=${v1.retirerEbay} ligne=${JSON.stringify(v1.retirerEbayN)}`);
      dit(v1.conseils.includes('retirer-ebay'), '« À faire sur Leboncoin » le liste aussi (croisement eBay→Leboncoin)', JSON.stringify(v1.conseils));
      // ── BÉNÉFICE PAR VENTE (parité Vinted/eBay) : N° + bénéfice sur la carte,
      //    par identité seulement. t1 est reliée (lien → N°12, achat 30 €) → 55 € ;
      //    t2 n'est reliée à rien → ni N° ni bénéfice inventé (§5).
      await pg.click('[data-section="ventes"]').catch(() => {});
      await pg.waitForSelector('.vrm-sale-row', { timeout: 8000 }).catch(() => {});
      await pg.waitForTimeout(400);
      // Le N° est sur la carte compacte (titre) ; le bénéfice vit dans le tiroir
      // de détail (portail), comme pour une vente Vinted — même composant partagé.
      // (31 oct.) Ce tiroir n'est monté qu'à la première ouverture : on ouvre
      // chaque vente, comme une personne, avant de lire (`_tiroirs.cjs`).
      await monterTiroirs(pg, '[data-lbc-vente]');
      const ven = await pg.evaluate(() => ({
        titres: [...document.querySelectorAll('.vrm-ledger-sale-title')].map((e) => e.textContent.trim()),
        benefs: [...document.querySelectorAll('[data-lbc-benef]')].map((e) => e.getAttribute('data-lbc-benef')),
      }));
      // (29 oct.) Julien : « côté vente… enlève N° » — le titre d'une vente
      // Leboncoin ne porte plus le N° ; il reste dans le tiroir (« Fiche article N°… »).
      dit(ven.titres.some((t) => /Nike Air Max/.test(t)) && !ven.titres.some((t) => /N°/.test(t)), 'vente Leboncoin reliée : pas de « N° » dans le titre (demande du 29 oct.)', JSON.stringify(ven.titres));
      const tiroir = await pg.evaluate(async () => {
        const row = [...document.querySelectorAll('.vrm-sale-row, [data-lbc-vente]')].find((e) => /Nike Air Max/.test(e.textContent));
        const t = row && row.querySelector('.vrm-ledger-sale-toggle'); if (t) t.click();
        await new Promise((r) => setTimeout(r, 500));
        return [...document.querySelectorAll('.vrm-fiche-vente-acces button')].map((x) => x.textContent.trim());
      });
      dit(tiroir.some((x) => /N°12/.test(x)), '… le N° de la paire reste dans le tiroir de la vente', JSON.stringify(tiroir));
      dit(ven.benefs.length === 1 && ven.benefs[0] === '55.00', 'son bénéfice (85 € − 30 € d’achat saisi) = 55,00 €, et la vente NON reliée n’en a aucun', JSON.stringify(ven.benefs));
      dit(ven.titres.some((t) => /Adidas Samba/.test(t) && !/N°/.test(t)), 'vente NON reliée : aucun N° inventé', JSON.stringify(ven.titres));
      await pg.click('[data-section="annonces"]').catch(() => {});
      await pg.waitForSelector('[data-lbc-doublons], [data-lbc-ventes-a-relier]', { timeout: 8000 }).catch(() => {});
      await pg.waitForTimeout(300);
      try {
        await pg.click('[data-lbc-suggestions="lbc2"] [data-suggestion="15"]');
        await pg.waitForTimeout(2500);
      } catch (e) { dit(false, 'la suggestion se clique', String(e.message).slice(0, 100)); }
      const liens = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_lbc_liens') || 'null'); } catch (_) { return null; } });
      dit(liens && liens.lbc2 === '15', 'son clic écrit le lien : vrm_lbc_liens.lbc2 = "15"', JSON.stringify(liens));
      const v2 = await lire();
      const n2 = v2.doublons.map((d) => d.num).sort();
      dit(n2.join() === '12,15', 'l’alerte apparaît pour la N°15 — pas pour sa jumelle N°14', JSON.stringify(n2));
      dit(v2.aRelier === 0, 'plus rien à relier');
      const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
      // Ma journée : la MÊME règle, la même conclusion (§11). (16 oct.) Le tableau
      // de bord a été refondu en « Statistiques » et n'affiche plus les actions :
      // l'alerte vit sur l'écran qu'il ouvre le matin — et c'est là qu'on la juge.
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await pg.waitForFunction(() => /vendus? sur Leboncoin, encore en vente sur Vinted/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
      const txt = await pg.evaluate(() => document.body.innerText);
      const m = /(\d+) articles? vendus? sur Leboncoin, encore en vente sur Vinted/.exec(txt);
      dit(m && m[1] === '2', 'Ma journée annonce les mêmes 2 articles', m ? m[0] : 'absent');
      dit(!/vendues? sur Vinted\)/.test(txt), 'et ne dit « vendue sur Vinted » d’aucune paire non prouvée vendue');
      // (26 oct.) CLOCHE eBay→Leboncoin : la N°60, publiée sur LBC (posted) et
      // vendue sur eBay, encore en ligne ici ⇒ une ligne « à retirer de Leboncoin
      // (vendue sur eBay) » — le pendant de la ligne Vinted, visible dès l'accueil.
      dit(/1 à retirer de Leboncoin \(vendue sur eBay\)/.test(txt), 'Ma journée : « 1 à retirer de Leboncoin (vendue sur eBay) » (croisement eBay→LBC, cloche)', (txt.match(/\d+ à retirer de Leboncoin \([^)]*\)/g) || []).join(' | ') || 'absent');
      // (16 oct.) « Je me suis trompé, j'ai mal relié une paire » : le lien se
      // défait, et ça tient au rechargement (le nuage ne le rend pas).
      try {
        await pg.goto(`http://localhost:${PORT}/?tab=leboncoin`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-lbc-delier="lbc2"]', { timeout: 15000 });
        pg.once('dialog', (d) => d.accept());
        await pg.click('[data-doublon="15"] [data-lbc-delier="lbc2"]');
        await pg.waitForTimeout(2500);
      } catch (e) { dit(false, '« Pas le bon article » se clique sur la ligne de la N°15', String(e.message).slice(0, 100)); }
      const liens2 = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_lbc_liens') || 'null'); } catch (_) { return null; } });
      dit(liens2 && liens2.lbc2 === '' && liens2.lbc1 === '12', 'le lien de lbc2 est défait (les autres restent)', JSON.stringify(liens2));
      await pg.goto(`http://localhost:${PORT}/?tab=leboncoin`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-lbc-doublons], [data-lbc-ventes-a-relier]', { timeout: 15000 }).catch(() => {});
      await pg.waitForTimeout(1500);
      const v3 = await lire();
      dit(v3.doublons.map((d) => d.num).join() === '12' && v3.aRelier === 1, 'après rechargement : plus d’alerte pour la N°15, la vente redemande « quel article ? »', JSON.stringify(v3.doublons.map((d) => d.num)) + ' · ' + v3.aRelier);
      const nLiens = await pg.evaluate(() => (document.querySelector('[data-lbc-liens]') || {}).getAttribute ? document.querySelector('[data-lbc-liens]').getAttribute('data-lbc-liens') : null);
      dit(nLiens === '1', 'la liste « Paires que tu as reliées » ne garde que le lien restant (N°12)', String(nLiens));
      // (26 oct.) COURSE §5.49 : un lien posé puis un rechargement AVANT que le
      // push n'ait atteint le nuage ne doit PAS être perdu. On empêche le nuage
      // de garder l'écriture (`bloquerPush`), on relie lbc2 à la N°14, on
      // recharge : le lien doit SURVIVRE (fusion local-par-dessus-nuage,
      // CLES_FUSION_LIENS). Pré-correctif, la restauration le réécrit avec
      // l'ancien nuage → lien perdu, protection double-vente disparue en silence.
      bloquerPush = true;
      await pg.goto(`http://localhost:${PORT}/?tab=leboncoin`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-lbc-suggestions="lbc2"] [data-suggestion="14"]', { timeout: 15000 }).catch(() => {});
      await pg.click('[data-lbc-suggestions="lbc2"] [data-suggestion="14"]').catch(() => {});
      await pg.waitForTimeout(900);
      await pg.goto(`http://localhost:${PORT}/?tab=leboncoin`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(1500);
      const course = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_lbc_liens') || 'null'); } catch (_) { return null; } });
      dit(course && course.lbc2 === '14', 'un lien posé survit à un rechargement avant que le push n’ait atteint le nuage (course §5.49)', JSON.stringify(course));
      bloquerPush = false;
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ anti double vente : ${ko} rouge(s)` : '\n✅ anti double vente : tout est vert');
  process.exit(ko ? 1 : 0);
})();
