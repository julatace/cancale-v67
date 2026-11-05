// Banc : LA CARTE SOMBRE RÉGLABLE PAR PAGE (3 nov. — Julien : « je veux juste le
// CA, le bénéfice etc. dans cette case sombre sur chaque onglet », « réglable sur
// chaque page », « modifiable en fonction de ce qu'on a sélectionné »).
// Données INVENTÉES (le dépôt est public) : 6 ventes Vinted (3 en novembre, une
// annulée), 1 vente Leboncoin de novembre. Rendu à 390 px tactile (clair, sombre)
// et 1512 px. Il juge la RÈGLE (data-* et nombres), pas l'orthographe :
//   A. chaque page principale monte SA carte (Ma journée, Ventes Vinted / tous
//      les sites / Leboncoin, Colis, Compta, Annonces, Achats) ;
//   B. changer de SITE : le périmètre (« Novembre · Vinted » → « Novembre ») et les
//      chiffres suivent — vendu Vinted 257 € ; tous les sites 297 € (+ Leboncoin) ;
//      la case « vendu · mois » de Leboncoin 40 € ;
//   C. régler la carte de Ventes (« Modifier » → feuille : le grand chiffre devient
//      « Nombre de ventes », la case 1 « Panier moyen ») ⇒ la carte change ;
//      RECHARGER ⇒ le réglage est gardé ; Colis garde son défaut (une page ne
//      touche pas les autres) ; la feuille : portail, gestes de 44 px, « OK » ferme ;
//   D. aucun débordement, aucune erreur d'app, « — » jamais « 0 » quand pas su.
// Lancer : node <construire> && BANC_PORT=46xx node scripts/bancs/carte-stats.cjs
// Captures : SHOTS=<dossier> (cartes, feuille, écrans entiers).
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4612);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.CARTE_VUES ? process.env.CARTE_VUES.split(',') : null;

const maintenant = new Date(2026, 10, 2, 17, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const A = '111';
let nPhoto = 0;
const vente = (id, titre, prix, statut, d, tus) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` } });
const VENTES = [
  vente(8001, 'Salomon XT-6 noir taille 38,5', 70, 'Le paiement a été validé', il(0, 11), 'needs_action'),
  vente(8002, 'Adidas Samba OG noir gomme taille 40', 72, 'Le paiement a été validé', il(1, 9), 'needs_action'),
  vente(8003, 'New Balance 550 vert taille 42', 88, 'Le colis est en route', il(3, 10), 'waiting'),
  vente(8004, 'Nike Air Max 1 rouge taille 43', 115, 'Le colis a été livré', il(1, 10), 'waiting'),
  vente(8005, 'Asics Gel-Kayano 14 argent taille 44', 89, 'Commande finalisée', il(9), 'completed'),
  vente(8006, 'Nike Shox TL noir taille 41', 95, 'Commande annulée', il(1), 'failed'),
];
// Vendu de novembre, à la main : 70 + 72 + 115 (8003 et 8005 sont d'octobre, 8006 annulée).
const VINTED_NOV = 25700, LBC_NOV = 4000;
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'boutique_test', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const LIGNES = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${A}_listings`, data: { capturedAt: cap, payload: { items: [], pagination: null } } },
  { id: `harvest_${A}_txn_8005`, data: { capturedAt: cap, payload: { transaction: { id: 8005, item_id: 8905, status: 450, status_title: 'Commande finalisée', status_updated_at: il(6, 9).toISOString() } } } },
  { id: 'lbc_ventes', data: { ventes: { T77: { txId: 'T77', isSeller: true, title: 'Nike Air Max 90 blanche', price: 4000, dateVente: il(0, 10).toISOString(), status: 'paid', account: 'lbc_test', at: cap } } } },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
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
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#dfe3e8', '#e8e1d8', '#dfe5dd'][k % 3]}"/></svg>`;

const contexte = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addInitScript((s) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
    localStorage.setItem('vinted_sale_overrides', JSON.stringify({ '8004': { buyPrice: '45', numero: '23' }, '8005': { buyPrice: '30', numero: '61' }, '8001': { numero: '99', buyPrice: '28' } }));
    if (!localStorage.getItem('vrm_benefice_jours')) {
      const j = (n, ca, nCout, cout, caCouvert, frais) => [n, ca, frais, nCout, cout, caCouvert, frais, 0, 0, 0, 0, 0];
      localStorage.setItem('vrm_benefice_jours', JSON.stringify({ v: 2, jours: { '2026-10-03': j(3, 22800, 3, 10200, 22800, 0), '2026-11-01': j(2, 17800, 2, 7500, 17800, 0) } }));
      localStorage.setItem('vrm_compta', JSON.stringify({ sansDepenses: { at: Date.now() } }));
      localStorage.setItem('vinted_regime', JSON.stringify('micro'));
    }
  } catch (_) {} }, !!sombre);
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
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
    const dans = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
};
const aller = async (pg, tab, attend) => {
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.locator(attend).first().waitFor({ timeout: 30000 });
  await pg.waitForTimeout(2200);
};
// La carte d'une page, lue dans le DOM (data-* et nombres rendus).
const carte = (pg, page) => pg.evaluate((page) => {
  const c = document.querySelector(`[data-carte-stats="${page}"]`);
  if (!c) return null;
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const g = c.querySelector('.vrm-fu-grand');
  const m = c.querySelector('[data-carte-modifier]');
  return {
    perimetre: c.getAttribute('data-carte-perimetre'), defaut: c.getAttribute('data-carte-defaut'), visible: vis(c),
    grand: g ? { id: g.getAttribute('data-carte-chiffre'), p: g.getAttribute('data-carte-p'), v: g.getAttribute('data-carte-valeur'), t: g.innerText.trim() } : null,
    cases: [...c.querySelectorAll('.vrm-fu-case')].map((x) => ({ id: x.getAttribute('data-carte-chiffre'), p: x.getAttribute('data-carte-p'), v: x.getAttribute('data-carte-valeur'), t: x.innerText.replace(/\n/g, ' · ') })),
    modifier: m ? Math.round(m.getBoundingClientRect().height) : 0,
    zeroMenteur: [...c.querySelectorAll('[data-carte-valeur=""]')].some((x) => /(^|\s)0(,00)?\s?€?$/.test((x.querySelector('b') || x).innerText.trim())),
  };
}, page);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair']]) {
      if (VUES && !VUES.includes(nom)) continue;
      console.log(`\n══ ${nom}`);
      const { ctx, pg, errs } = await contexte(b, vp, sombre);
      const shot = async (sel, f) => { if (!SHOTS) return; const l = pg.locator(sel).first(); if (await l.count()) { await l.scrollIntoViewIfNeeded().catch(() => {}); await l.screenshot({ path: path.join(SHOTS, `${f}-${nom}.png`) }).catch(() => {}); } };

      await essaie('B. Ventes · Vinted', async () => {
        console.log('── A/B. Ventes : Vinted, puis tous les sites, puis Leboncoin');
        await aller(pg, 'cat_ventes', '[data-carte-stats="ventes"]');
        const v = await carte(pg, 'ventes');
        dit(!!v && v.visible && v.defaut === '1', 'Ventes · Vinted : la carte de la page est là (défaut)');
        dit(v && v.perimetre === 'Novembre · Vinted', 'le périmètre dit « Novembre · Vinted »', v && v.perimetre);
        dit(v && v.grand && v.grand.id === 'vendu' && v.grand.p === 'mois' && v.grand.v === String(VINTED_NOV), 'grand chiffre : le vendu Vinted de novembre (257 €, à la main)', JSON.stringify(v && v.grand));
        dit(v && v.cases.map((x) => x.id).join() === 'aposter,enroute,apayer', 'cases par défaut : à poster · en route · à payer (la maquette)', JSON.stringify(v && v.cases));
        dit(v && v.modifier >= 44, '« Modifier » : 44 px au doigt', String(v && v.modifier));
        dit(v && !v.zeroMenteur, 'aucun « 0 » là où la valeur n’est pas sue');
        await shot('[data-carte-stats="ventes"]', 'carte-ventes-vinted');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `ecran-ventes-${nom}.png`) });

        await pg.locator('[data-filtre-site="ventes"] [data-site="toutes"]').first().click();
        await pg.locator('[data-carte-stats="ventes-toutes"]').first().waitFor({ timeout: 15000 });
        await pg.waitForTimeout(1200);
        const t = await carte(pg, 'ventes-toutes');
        dit(t && t.perimetre === 'Novembre', 'tous les sites : le périmètre suit (« Novembre »)', t && t.perimetre);
        dit(t && t.grand && t.grand.v === String(VINTED_NOV + LBC_NOV), 'tous les sites : le vendu suit (257 € + 40 € Leboncoin = 297 €)', JSON.stringify(t && t.grand));
        await shot('[data-carte-stats="ventes-toutes"]', 'carte-ventes-toutes');

        await pg.locator('[data-filtre-site="ventes"] [data-site="leboncoin"]').first().click();
        await pg.locator('[data-carte-stats="leboncoin"]').first().waitFor({ timeout: 15000 });
        await pg.waitForTimeout(1200);
        const l = await carte(pg, 'leboncoin');
        const vm = l && l.cases.find((x) => x.id === 'vendu');
        dit(l && /Leboncoin/.test(l.perimetre), 'Leboncoin : le périmètre suit', l && l.perimetre);
        dit(!!vm && vm.v === String(LBC_NOV), 'Leboncoin : la case « vendu · mois » = 40 € (sa seule vente)', JSON.stringify(vm));
        dit(await pg.locator('[data-ventes-kpi="leboncoin"] [data-kpi="encours"]').count() > 0, 'Leboncoin : ses cases propres gardent leurs data-kpi');
        await shot('[data-carte-stats="leboncoin"]', 'carte-leboncoin');
        await pg.locator('[data-filtre-site="ventes"] [data-site="vinted"]').first().click();
        await pg.locator('[data-carte-stats="ventes"]').first().waitFor({ timeout: 15000 });
        await pg.waitForTimeout(800);
      });

      await essaie('C. régler la carte', async () => {
        console.log('── C. Régler la carte de Ventes, recharger');
        await pg.locator('[data-carte-modifier="ventes"]').first().click();
        const f = pg.locator('[data-carte-feuille="ventes"]');
        await f.waitFor({ timeout: 8000 });
        const fe = await pg.evaluate(() => {
          const d = document.querySelector('[data-carte-feuille]');
          const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
          return { portail: !!d && (d.closest('[data-feuille-cadre]') || d).parentElement === document.body, petits: [...d.querySelectorAll('button')].filter(vis).filter((x) => x.getBoundingClientRect().height < 43.5).map((x) => x.innerText.trim().slice(0, 20)),
            choix: [...d.querySelectorAll('[data-carte-choix]')].map((x) => x.getAttribute('data-carte-choix')) };
        });
        dit(fe.portail, 'la feuille passe par un portail (document.body)');
        dit(!fe.petits.length, 'tous les gestes de la feuille font 44 px', fe.petits.join(' | '));
        dit(fe.choix.includes('vendu') && fe.choix.includes('enroute') && !fe.choix.includes('benefice') && !fe.choix.includes('urssaf'), 'Vinted seul : le bénéfice et l’URSSAF ne sont pas proposés (pas de sens par site)', fe.choix.join(','));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `feuille-ventes-${nom}.png`) });
        await pg.locator('[data-carte-place="0"]').click();
        await pg.locator('[data-carte-choix="ventes"]').click();
        await pg.locator('[data-carte-place="1"]').click();
        await pg.locator('[data-carte-choix="panier"]').click();
        await pg.locator('[data-carte-feuille] [data-feuille-croix]').click();
        await pg.waitForTimeout(500);
        dit(await pg.locator('[data-carte-feuille]').count() === 0, 'la croix ferme la feuille');
        const r1 = await carte(pg, 'ventes');
        dit(r1 && r1.grand.id === 'ventes' && r1.grand.v === '3' && r1.cases[0].id === 'panier', 'la carte change sous ses yeux : 3 ventes en grand, le panier moyen en case 1', JSON.stringify(r1 && { g: r1.grand, c: r1.cases[0] }));
        const range = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_carte_stats')); } catch (_) { return null; } });
        dit(range && range.pages && range.pages.ventes && range.pages.ventes.g.id === 'ventes' && !range.pages.colis, 'le réglage est rangé pour Ventes seulement (`vrm_carte_stats`, synchronisé)', JSON.stringify(range));
        // Recharger l'app (un chargement complet, la même adresse qu'à l'ouverture).
        await aller(pg, 'cat_ventes', '[data-carte-stats="ventes"]');
        const r2 = await carte(pg, 'ventes');
        dit(r2 && r2.grand.id === 'ventes' && r2.cases[0].id === 'panier' && r2.defaut === '0', 'après rechargement : le réglage est gardé', JSON.stringify(r2 && { g: r2.grand.id, c: r2.cases.map((x) => x.id) }));
        await shot('[data-carte-stats="ventes"]', 'carte-ventes-reglee');
      });

      await essaie('D. le calendrier de la carte (plage libre)', async () => {
        // (3 nov., Julien : « fais un calendrier ») La période d'un chiffre se choisit dans LE calendrier de
        // l'app (raccourcis + plage libre) ; une plage du 30 oct. au 1er nov. ⇒ la valeur = la règle sur ces
        // dates : 8003 (30 oct.), 8002 et 8004 (1er nov.) — 3 ventes ; 8001 (2 nov.) et 8005 (24 oct.) dehors.
        console.log('── D. Le calendrier : une plage libre');
        await pg.locator('[data-carte-modifier="ventes"]').first().click();
        await pg.locator('[data-carte-feuille="ventes"]').waitFor({ timeout: 8000 });
        await pg.locator('[data-carte-place="0"]').click();
        const cal = pg.locator('[data-carte-calendrier] [data-periode-ouvrir]');
        dit(await cal.count() === 1, 'la période du grand chiffre se choisit par UN bouton « calendrier » (plus de rangée qui défile)');
        dit(await pg.locator('[data-carte-feuille] .vrm-carte-periodes').count() === 0, 'plus de rangée de pilules de période pour ce chiffre');
        const h = await cal.evaluate((e) => e.getBoundingClientRect().height).catch(() => 0);
        dit(h >= 43.5, 'le bouton de période fait 44 px', String(h));
        await cal.click();
        const raccourcis = await pg.evaluate(() => [...document.querySelectorAll('[data-periode-raccourci]')].map((b) => b.getAttribute('data-periode-raccourci')).join(','));
        dit(raccourcis === 'jour,semaine,mois,dernier,trimestre,annee', 'raccourcis : Aujourd’hui · Cette semaine · Ce mois · Mois dernier · Ce trimestre · Cette année', raccourcis);
        const dessus = await pg.evaluate(() => { const c = document.querySelector('.vrm-cal-feuille, .vrm-cal-pop'); if (!c) return false; const r = c.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return !!e && !!e.closest('.vrm-cal-feuille, .vrm-cal-pop'); });
        dit(dessus, 'le calendrier passe AU-DESSUS de la feuille de la carte');
        await pg.locator('[data-jour="2026-10-30"]').first().click();
        await pg.locator('[data-jour="2026-11-01"]').first().click();
        await pg.locator('[data-periode-appliquer]').first().click();
        await pg.waitForTimeout(400);
        await pg.locator('[data-carte-feuille] [data-feuille-croix]').click();
        await pg.waitForTimeout(500);
        const r3 = await carte(pg, 'ventes');
        dit(r3 && r3.grand && r3.grand.id === 'ventes' && r3.grand.p === 'plage' && r3.grand.v === '3', 'plage du 30 oct. au 1er nov. : 3 ventes (la règle sur ces dates, à la main)', JSON.stringify(r3 && r3.grand));
        dit(r3 && /^30 oct\.–1 nov\. · Vinted$/.test(r3.perimetre), 'la plage se lit en tête de carte : « 30 oct.–1 nov. · Vinted »', r3 && r3.perimetre);
        const range = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_carte_stats')); } catch (_) { return null; } });
        const gp = range && range.pages && range.pages.ventes && range.pages.ventes.g && range.pages.ventes.g.p;
        dit(gp && typeof gp === 'object' && gp.a - gp.de === 3 * 864e5, 'la plage est rangée (bornes [30 oct., 2 nov.), jours entiers)', JSON.stringify(gp));
        // Le raccourci « Ce mois » redonne la période nommée (calculée par les règles de l'app).
        await pg.locator('[data-carte-modifier="ventes"]').first().click();
        await pg.locator('[data-carte-place="0"]').click();
        await pg.locator('[data-carte-calendrier] [data-periode-ouvrir]').click();
        await pg.locator('[data-periode-raccourci="mois"]').first().click();
        await pg.waitForTimeout(300);
        await pg.locator('[data-carte-feuille] [data-feuille-croix]').click();
        await pg.waitForTimeout(500);
        const r4 = await carte(pg, 'ventes');
        dit(r4 && r4.grand.p === 'mois' && r4.grand.v === '3' && r4.perimetre === 'Novembre · Vinted', '« Ce mois » : la période nommée revient (3 ventes en novembre, « Novembre · Vinted »)', JSON.stringify(r4 && { p: r4.grand.p, v: r4.grand.v, per: r4.perimetre }));
      });
      await essaie('A. les autres pages', async () => {
        console.log('── A. Les autres pages montent leur carte (défaut gardé)');
        await aller(pg, 'cat_bord', '[data-carte-stats="colis"]');
        const c = await carte(pg, 'colis');
        dit(c && c.defaut === '1' && c.grand.id === 'aposter', 'Colis : sa carte, au défaut (le réglage de Ventes ne la touche pas)', JSON.stringify(c && { d: c.defaut, g: c.grand }));
        await shot('[data-carte-stats="colis"]', 'carte-colis');
        await aller(pg, 'journee', '[data-carte-stats="journee"]');
        const j = await carte(pg, 'journee');
        dit(j && j.grand.id === 'vendu' && j.grand.p === 'jour' && j.grand.v === '11000', 'Ma journée : vendu aujourd’hui en grand, tous les sites (70 € Vinted + 40 € Leboncoin)', JSON.stringify(j && j.grand));
        dit(await pg.locator('[data-carte-stats="journee"] [data-journee-benef][data-benef-notion="benefice"]').count() === 1, 'Ma journée : la case bénéfice porte la règle unique (`chiffreBenefice`)');
        await shot('.vrm-fu-tete', 'carte-journee');
        await aller(pg, 'compta', '[data-carte-stats="compta"]');
        const k = await carte(pg, 'compta');
        dit(k && k.grand.id === 'benefice' && k.cases.map((x) => x.id).join() === 'declarer,urssaf,finalisees', 'Compta : bénéfice en grand, à déclarer · URSSAF · finalisées', JSON.stringify(k && { g: k.grand, c: k.cases.map((x) => x.id) }));
        dit(await pg.locator('[data-carte-stats="compta"] [data-compta-chiffre="gagne"]').count() === 1, 'Compta : le grand chiffre garde `data-compta-chiffre="gagne"`');
        await shot('[data-compta-q="gagne"] .vrm-compta-carte', 'carte-compta');
        await aller(pg, 'annonces', '[data-carte-stats="annonces"]');
        const a = await carte(pg, 'annonces');
        dit(a && a.grand.id === 'enligne' && /Vinted/.test(a.perimetre), 'Annonces : annonces en ligne, sur Vinted', JSON.stringify(a && { p: a.perimetre, g: a.grand }));
        await shot('[data-carte-stats="annonces"]', 'carte-annonces');
        await aller(pg, 'achats', '[data-carte-stats="achats"]');
        const h = await carte(pg, 'achats');
        // (3 nov.) La carte d'Achats parle d'achats : Dépensé du mois en grand, jamais « Vendu · mois ».
        dit(!!h && h.grand.id === 'depense' && h.cases.map((c) => c.id).join(',') === 'enroute,retirer,recus', 'Achats : dépensé en grand, en route · à retirer · reçus', JSON.stringify(h && { g: h.grand, c: h.cases.map((c) => c.id) }));
        dit(!!h && !/vendu/i.test(JSON.stringify(h.cases.map((c) => c.t))), 'Achats : aucune case « Vendu »');
        await shot('[data-carte-stats="achats"]', 'carte-achats');
        // (3 nov.) Rien de rogné dans une case, jamais « ≥ » sur un chiffre de case.
        const rog = await pg.evaluate(() => [...document.querySelectorAll('.vrm-fu-case:not(.is-jour)')].flatMap((c) => [...c.querySelectorAll('b, :scope > span')].filter((e) => e.scrollWidth > e.clientWidth + 1 || /≥/.test(e.textContent)).map((e) => e.textContent)));
        dit(!rog.length, 'cases : aucun libellé ni chiffre rogné, aucun « ≥ »', rog.join(' | '));
        const d = await deborde(pg);
        dit(d <= 1, 'aucun débordement horizontal', `${d}px`);
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
