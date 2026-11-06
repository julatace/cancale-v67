// ════════════════════════════════════════════════════════════════════════════
// BANC : ACHATS → FOURNISSEURS, LES PERSONNES À QUI IL ACHÈTE EN GROS (5 nov.)
//        node scripts/bancs/fournisseurs.cjs        (BANC_PORT, défaut 8347)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « le fournisseur dans achat, c'est pas du tout ça c'est une personne
// à qui tu achètes en gros pas des vendeurs particuliers sur vinted ».
// L'app RENDUE (dist/) sur un scénario INVENTÉ (aucune donnée réelle) servi par
// le mini PostgREST : 2 comptes Vinted, des achats Vinted dont les transactions
// portent le pseudo du vendeur (vendeuse_x, grossiste_y), 6 fiches numérotées
// (N°1 vendue 90 €, N°2 au prix saisi À LA MAIN 35 €), un achat hors plateforme
// saisi « Fournisseur » (N°6, 60 €).
//   · la liste est vide et dit le geste ; aucun vendeur Vinted n'y apparaît ;
//   · créer « Karim » (nom + téléphone) ;
//   · depuis SA fiche, un achat en gros : 10 paires, 300 € ⇒ 30 € par paire ;
//   · relier 3 N° (son tap) : N°1 et N°3 reçoivent 30 €, le N°2 garde 35 € —
//     « Poser le prix d'achat » DEMANDE, « Garder 35 € » ne change rien ;
//     « 3 sur 10 reliées » ;
//   · la fiche : Dépensé 300 €, 10 paires, 30 € en moyenne, 1 revendue,
//     « au plus +60 € » (frais pas confirmés), « sur 1 vendue, prix d'achat
//     connu pour 1 » ; jamais « au moins » sur le bénéfice ;
//   · rattacher l'achat saisi « Fournisseur » (son tap) : 11 paires, 360 € ;
//   · rien n'est écrit avant son tap ; le registre part dans la ligne `main`.
// 390 tactile clair, 390 sombre, 1512 clair, 1512 sombre ; captures z-fo-*.png
// (CAPTURES=dossier pour les ranger ailleurs).
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { servir } = require('./_minipgrest.cjs');
const sc = require('./_scenario-colis.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const SC = process.env.CAPTURES || __dirname;
const PORT = Number(process.env.BANC_PORT) || 8347;
const J = 86400e3, U = sc.UID[0], NOW = Date.now(), iso = (ms) => new Date(ms).toISOString();
const sec = (ms) => Math.floor(ms / 1000);
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'camille.martin@exemple.test' } };

const achat = (tx, titre, prix, jours) => sc.ordre({ tx, titre, prix, statut: sc.STATUT_FINAL, dateMs: NOW - jours * J });
const ACHATS = [achat('9100001', 'Nike Dunk Low 43', 40, 25), achat('9100002', 'Adidas Samba 42', 30, 18), achat('9100003', 'Lot 3 paires', 90, 12)];
const txn = (tx, { vendeur, nb = 1, cote = 'buyer', item = null }) => {
  const t = { id: Number(tx), user_side: cote, seller: { login: vendeur || 'boutique_nord' }, items_count: nb, item_photo: null, item_id: item, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(NOW - J),
    shipment: { id: 1, status: 400, status_title: 'Commande livrée ! ', status_updated_at: iso(NOW - 3 * J) } };
  return { id: `harvest_${U}_txn_${tx}`, meta: { id: String(tx), item_id: item, status: '450', status_updated_at: t.status_updated_at, ship_status_title: t.shipment.status_title },
    data: { capturedAt: iso(NOW), payload: { code: 0, transaction: t } } };
};
const annonce = (id, titre, joursEnLigne) => ({ ...sc.annonce({ id, titre, prix: 80 }), created_at_ts: sec(NOW - joursEnLigne * J) });
const LISTINGS = [annonce('pa2', 'Adidas Samba 42', 6), annonce('pa3', 'Nike Blazer 42', 5), annonce('pa4', 'Nike Cortez 41', 4), annonce('pa5', 'Puma Suede 44', 3)];
const VENTES = [sc.ordre({ tx: '9300001', titre: 'Nike Dunk Low 43', prix: 90, statut: sc.STATUT_FINAL, dateMs: NOW - 2 * J, item: 'pa1' })];
const FICHES = {
  pa1: { numero: '1', title: 'Nike Dunk Low 43' },
  pa2: { numero: '2', title: 'Adidas Samba 42', buyPrice: '35' },
  pa3: { numero: '3', title: 'Nike Blazer 42' },
  pa4: { numero: '4', title: 'Nike Cortez 41' },
  pa5: { numero: '5', title: 'Puma Suede 44' },
  pa6: { numero: '6', title: 'Jordan 1 Mid 44', buyPrice: '60' },
};
const HORS = [{ id: 'ob1', title: 'Jordan 1 Mid 44', price: '60', source: 'Fournisseur', numero: '6', date: iso(NOW - 40 * J).slice(0, 10) }];
const rows = (sombre) => [
  ...sc.ligneMain({ vinted_dark: sombre, vinted_annonce_numeros: FICHES, vinted_offvinted_buys: HORS }),
  sc.ligneListings(U, LISTINGS), sc.lignePurch(U, ACHATS), sc.ligneSold(U, VENTES),
  txn('9100001', { vendeur: 'vendeuse_x' }), txn('9100002', { vendeur: 'vendeuse_x' }), txn('9100003', { vendeur: 'grossiste_y', nb: 3 }),
  txn('9300001', { cote: 'seller', item: 'pa1' }),
  sc.ligneListings(sc.UID[1], [annonce('pb1', 'Vans Old Skool 40', 30)]), sc.lignePurch(sc.UID[1], []), sc.ligneSold(sc.UID[1], []),
].map((r) => ({ meta: {}, ...r, owner: SESSION.user.id, updated_at: iso(NOW) }));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const capture = (pg, nom) => pg.screenshot({ path: path.join(SC, `z-fo-${nom}.png`) });
const fichesLS = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}') || {}; } catch (_) { return {}; } });
const registreLS = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_fournisseurs') || 'null'); } catch (_) { return null; } });
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

async function passe(b, nom, ctxOpts, sombre) {
  console.log(`\n── ${nom}`);
  const ctx = await b.newContext({ ...ctxOpts, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  const ROWS = rows(sombre);
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([s, sb]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); if (sb) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, [SESSION, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  // GoTrue APRÈS le fourre-tout (Playwright prend la DERNIÈRE route en premier).
  await pg.route('**/auth/v1/**', (r) => {
    const chemin = new URL(r.request().url()).pathname.replace(/^.*\/auth\/v1\//, '');
    const corps = chemin === 'user' ? { id: SESSION.user.id, email: SESSION.user.email, aud: 'authenticated' } : { ...SESSION, expires_in: 3600 };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = req.url();
    const j = (d, h = {}) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...h }, body: JSON.stringify(d) });
    if (req.method() !== 'GET' && req.method() !== 'HEAD') { ecrits.push(String(req.postData() || '')); return j([]); }
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc.comptes().map((c) => ({ ...c, owner: SESSION.user.id })), { 'content-range': '0-1/2' });
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const s = servir(ROWS, decodeURIComponent(u).replace(/\+/g, ' ').replace(/#/g, '%23'), req.headers());
    return j(s.body, { 'content-range': s.range });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: /mode=confidentialite/.test(r.request().url()) ? JSON.stringify({ ok: true, uid: SESSION.user.id }) : '{"pret":true,"devices":1}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=achats&site=vinted`, { waitUntil: 'domcontentloaded' });
  pg.setDefaultTimeout(8000);
  // Un banc ne meurt pas, il rapporte : un geste introuvable (build d'avant) est un rouge, puis la passe suivante.
  try { await parcours(pg, nom, errs, ecrits); } catch (e) { dit(false, `${nom} · le parcours va jusqu'au bout`, String(e && e.message || e).split('\n')[0]); await capture(pg, `${nom}-ko`).catch(() => {}); }
  await ctx.close();
}

async function parcours(pg, nom, errs, ecrits) {
  const outils = pg.locator('[data-aso-outils]');
  // (6 nov., v36) Depuis la revue 2.16 (Achats), Fournisseurs · Délai · Lots sont derrière « … ».
  const plus = pg.locator('[data-achats-plus="ferme"]');
  await plus.waitFor({ timeout: 25000 }).catch(() => {});
  if (await plus.count()) await plus.first().click();
  await outils.waitFor({ timeout: 25000 }).catch(() => {});
  if (!(await outils.count())) { dit(false, `${nom} · l'écran Achats est rendu`); await pg.screenshot({ path: path.join(SC, `z-fo-${nom}-ko.png`), fullPage: true }); console.log(errs.slice(0, 3).join('\n')); return; }

  // 1. La liste : vide, elle dit le geste ; aucun vendeur Vinted.
  await pg.locator('[data-aso-ouvrir="fournisseurs"]').click();
  await pg.locator('[data-aso-feuille="fournisseurs"][data-aso-etat="lu"]').waitFor({ timeout: 20000 }).catch(() => {});
  const vide = await pg.locator('[data-fo-vide]').innerText().catch(() => '');
  const texte0 = await pg.locator('[data-aso-feuille="fournisseurs"]').innerText().catch(() => '');
  dit(/premier fournisseur/i.test(vide) && /en gros/i.test(vide) && !(await pg.locator('[data-fo-fournisseur]').count()), `${nom} · liste vide : « Ajoute ton premier fournisseur : la personne à qui tu achètes en gros »`, vide);
  dit(!/vendeuse_x|grossiste_y|boutique_nord/i.test(texte0), `${nom} · aucun vendeur Vinted (pseudos lus dans 4 transactions) dans la liste`, texte0.slice(0, 160));
  await capture(pg, `${nom}-1-vide`);

  // 2. Créer « Karim ».
  await pg.locator('[data-fo-ajouter]').click();
  await pg.locator('[data-fo-enregistrer="fournisseur"]').click();
  dit(/nom/i.test(await pg.locator('[data-fo-erreur]').innerText().catch(() => '')) && (await registreLS(pg)) == null, `${nom} · sans nom : refusé, rien d'écrit`);
  await pg.locator('[data-fo-champ="nom"]').fill('Karim');
  await pg.locator('[data-fo-champ="tel"]').fill('06 12 34 56 78');
  await pg.locator('[data-fo-champ="note"]').fill('Arrivage le mardi');
  await capture(pg, `${nom}-2-nouveau`);
  await pg.locator('[data-fo-enregistrer="fournisseur"]').click();
  await pg.locator('[data-fo-fiche]').waitFor({ timeout: 5000 }).catch(() => {});
  // `save` range la clé après un court délai (src/App.jsx) : on attend l'écriture, pas une durée.
  await pg.waitForFunction(() => /Karim/.test(localStorage.getItem('vrm_fournisseurs') || ''), null, { timeout: 5000 }).catch(() => {});
  const reg1 = await registreLS(pg);
  const idK = reg1 && Object.keys(reg1.personnes || {}).find((k) => reg1.personnes[k].nom === 'Karim');
  dit(!!idK && reg1.personnes[idK].tel === '06 12 34 56 78' && Object.keys(reg1.personnes).length === 1, `${nom} · Karim créé (nom, téléphone), seul fournisseur`, JSON.stringify(reg1));
  dit(await pg.locator(`[data-fo-fiche="${idK}"]`).count() === 1, `${nom} · sa fiche s'ouvre`);

  // 3. Un achat en gros : 10 paires, 300 €.
  await pg.locator('[data-fo-nouvel-achat]').click();
  await pg.locator('[data-fo-champ="date"]').fill('2026-10-12');
  await pg.locator('[data-fo-champ="paires"]').fill('10');
  await pg.locator('[data-fo-champ="total"]').fill('300');
  await capture(pg, `${nom}-3-achat`);
  await pg.locator('[data-fo-enregistrer="achat"]').click();
  await pg.locator('[data-fo-fiche-achat]').waitFor({ timeout: 5000 }).catch(() => {});
  const a0 = await pg.evaluate(() => { const f = document.querySelector('[data-fo-fiche-achat]'); const p = document.querySelector('[data-fo-part-egale]'); return f && { id: f.dataset.foFicheAchat, relies: f.dataset.foRelies, sur: f.dataset.foSur, part: p && p.dataset.foPartEgale, txt: (document.querySelector('[data-fo-relies-txt]') || {}).innerText }; });
  dit(a0 && a0.sur === '10' && a0.relies === '0' && a0.part === '3000' && /0 sur 10/.test(a0.txt), `${nom} · achat de 10 paires à 300 € : 30 € par paire, « 0 sur 10 reliée »`, JSON.stringify(a0));
  const avant = await fichesLS(pg);
  dit(!Object.values(avant).some((e) => e && e.buyGros), `${nom} · aucun N° relié avant son tap`);

  // 4. Relier N°1, N°2 (prix saisi à la main), N°3.
  for (const n of ['1', '2', '3']) {
    await pg.locator('[data-fo-relier]').click();
    await pg.locator(`[data-aso-relier-numero="${n}"]`).waitFor({ timeout: 5000 }).catch(() => {});
    if (n === '1') {
      const libres = await pg.$$eval('[data-aso-relier-numero]', (els) => els.map((e) => e.getAttribute('data-aso-relier-numero')));
      dit(libres.includes('1') && libres.includes('2') && !libres.includes('6'), `${nom} · N° proposés : sans achat relié (le N°6 tient à l'achat « Fournisseur »)`, libres.join());
      await capture(pg, `${nom}-4-relier`);
    }
    await pg.locator(`[data-aso-relier-numero="${n}"]`).click();
    // L'écriture rangée (et non un délai fixe) : la fiche porte son lien.
    await pg.waitForFunction((k) => { try { const f = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}')[k]; return !!(f && f.buyGros && f.buyGros.id); } catch (_) { return false; } }, 'pa' + n, { timeout: 5000 }).catch(() => {});
  }
  await pg.waitForTimeout(300);
  const f1 = await fichesLS(pg);
  dit(f1.pa1 && f1.pa1.buyGros && f1.pa1.buyGros.id === a0.id && f1.pa1.buyPrice === '30,00' && f1.pa3 && f1.pa3.buyPrice === '30,00', `${nom} · N°1 et N°3 reliés : 30 € posés (leur part égale)`, JSON.stringify([f1.pa1, f1.pa3]));
  dit(f1.pa2 && f1.pa2.buyGros && f1.pa2.buyGros.id === a0.id && f1.pa2.buyPrice === '35', `${nom} · N°2 relié : son prix saisi à la main (35 €) n'est PAS remplacé`, JSON.stringify(f1.pa2));
  const r3 = await pg.evaluate(() => ({ relies: (document.querySelector('[data-fo-fiche-achat]') || {}).dataset?.foRelies, txt: (document.querySelector('[data-fo-relies-txt]') || {}).innerText,
    lignes: [...document.querySelectorAll('[data-fo-relie]')].map((e) => [e.dataset.foRelie, e.dataset.foPart, e.dataset.foOrigine]) }));
  dit(r3.relies === '3' && /3 sur 10 reliées/.test(r3.txt), `${nom} · « 3 sur 10 reliées »`, JSON.stringify(r3));
  dit(JSON.stringify(r3.lignes) === JSON.stringify([['1', '3000', 'lot'], ['2', '3000', 'main'], ['3', '3000', 'lot']]), `${nom} · chaque ligne : sa part, d'où vient son prix (N°2 « saisi à la main »)`, JSON.stringify(r3.lignes));
  await capture(pg, `${nom}-5-relies`);

  // 5. « Poser le prix d'achat » : la question pour le N°2 ; « Garder 35 € ».
  const nPoser = await pg.locator('[data-fo-poser-prix]').getAttribute('data-fo-poser-prix');
  dit(nPoser === '1', `${nom} · un prix à décider (le N°2)`, nPoser);
  await pg.locator('[data-fo-poser-prix]').click();
  const garder = pg.locator('button', { hasText: /^Garder 35/ });
  await garder.last().waitFor({ timeout: 5000 }).catch(() => {});
  dit(await garder.count() >= 1 && await pg.locator('button', { hasText: /^Remplacer$/ }).count() >= 1, `${nom} · la question est posée : « Remplacer » ou « Garder 35 € »`);
  await capture(pg, `${nom}-6-question`);
  await garder.last().click().catch(() => {});
  await pg.waitForTimeout(500);
  const f2 = await fichesLS(pg);
  dit(f2.pa2 && f2.pa2.buyPrice === '35', `${nom} · « Garder » : le N°2 garde 35 €`, JSON.stringify(f2.pa2));
  await pg.waitForFunction(() => (document.querySelector('[data-fo-poser-prix]') || {}).dataset?.foPoserPrix === '0', null, { timeout: 5000 }).catch(() => {});
  const g2 = await pg.evaluate(() => ({ poser: (document.querySelector('[data-fo-poser-prix]') || {}).dataset?.foPoserPrix, garde: (document.querySelector('[data-fo-relie="2"]') || {}).dataset?.foGarde }));
  dit(g2.poser === '0' && g2.garde === '1', `${nom} · sa réponse est gardée : la question ne revient pas (« prix gardé : 35 € »)`, JSON.stringify(g2));
  await capture(pg, `${nom}-6b-garde`);

  // 6. La fiche du fournisseur.
  await pg.locator('[data-fo-retour]').click();
  await pg.locator('[data-fo-fiche]').waitFor({ timeout: 5000 }).catch(() => {});
  await pg.waitForFunction(() => { const f = document.querySelector('[data-fo-fiche]'); return f && f.dataset.foRevendues !== ''; }, null, { timeout: 15000 }).catch(() => {});
  const fi = await pg.evaluate(() => { const f = document.querySelector('[data-fo-fiche]'); const t = (k) => (document.querySelector(`[data-fo-stat="${k}"]`) || {}).innerText || ''; return f && { ...f.dataset, depT: t('depense'), benT: t('benefice'), moyT: t('moyen'), achat: (document.querySelector('[data-fo-achat]') || {}).innerText }; });
  dit(fi && fi.foDepense === '30000' && fi.foPaires === '10' && fi.foMoyen === '3000' && fi.foAuMoins === '' && /300\s€/.test(fi.depT) && !/au moins/.test(fi.depT), `${nom} · Dépensé 300 €, 10 paires, 30 € en moyenne`, JSON.stringify(fi));
  dit(fi && fi.foRevendues === '1' && fi.foBenefice === '6000' && /au plus \+60\s€/.test(fi.benT) && !/au moins/.test(fi.benT), `${nom} · 1 revendue (N°1 à 90 €), « au plus +60 € » (frais pas confirmés)`, fi && fi.benT);
  dit(fi && /sur 1 vendue, prix d’achat connu pour 1/.test(fi.benT), `${nom} · couverture « sur 1 vendue, prix d'achat connu pour 1 »`, fi && fi.benT);
  dit(fi && /3 sur 10 reliées/.test(fi.achat || ''), `${nom} · l'achat en gros dit « 3 sur 10 reliées » dans la fiche`, fi && fi.achat);
  await capture(pg, `${nom}-7-fiche`);
  dit(!(await deborde(pg)), `${nom} · aucun défilement horizontal`);

  // 7. Rattacher l'achat hors plateforme saisi « Fournisseur » (son tap).
  dit((await registreLS(pg)).hors && !Object.keys((await registreLS(pg)).hors).length, `${nom} · rien n'est rattaché tout seul`);
  await pg.locator('[data-fo-voir-rattachables]').click();
  await pg.locator('[data-fo-rattacher="ob1"]').click();
  await pg.waitForTimeout(400);
  const fr = await pg.evaluate(() => { const f = document.querySelector('[data-fo-fiche]'); return f && { dep: f.dataset.foDepense, paires: f.dataset.foPaires, hors: !!document.querySelector('[data-fo-hors="ob1"]') }; });
  dit(fr && fr.dep === '36000' && fr.paires === '11' && fr.hors, `${nom} · rattaché : 11 paires, 360 €`, JSON.stringify(fr));
  await capture(pg, `${nom}-8-rattache`);

  // 8. La liste : Karim, et lui seul.
  await pg.locator('[data-fo-retour]').click();
  await pg.locator('[data-fo-fournisseur]').first().waitFor({ timeout: 5000 }).catch(() => {});
  const noms = await pg.$$eval('[data-fo-fournisseur]', (els) => els.map((e) => e.dataset.foNom));
  const texte1 = await pg.locator('[data-aso-feuille="fournisseurs"]').innerText().catch(() => '');
  dit(noms.join() === 'Karim' && !/vendeuse_x|grossiste_y|boutique_nord/i.test(texte1), `${nom} · la liste : Karim seul, aucun vendeur Vinted`, noms.join());
  await capture(pg, `${nom}-9-liste`);
  const cibles = await pg.$$eval('[data-aso-feuille] button', (els) => els.filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height)));
  dit(cibles.every((h) => h >= 44), `${nom} · boutons de la feuille ≥ 44 px`, JSON.stringify(cibles));
  dit(ecrits.some((w) => /vrm_fournisseurs/.test(w) && /Karim/.test(w)), `${nom} · le registre part dans la ligne main (synchronisé)`);
  dit(!(await deborde(pg)), `${nom} · aucun défilement horizontal`);
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const tel = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
  await passe(b, '390', tel, false);
  await passe(b, '390-sombre', tel, true);
  await passe(b, '1512', { viewport: { width: 1512, height: 950 } }, false);
  await passe(b, '1512-sombre', { viewport: { width: 1512, height: 950 } }, true);
  await b.close(); srv.close();
  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
