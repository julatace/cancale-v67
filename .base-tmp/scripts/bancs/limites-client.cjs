// ════════════════════════════════════════════════════════════════════════════
//  UN CLIENT ÉNORME NE RALENTIT PAS L'APP (11 nov., lot « limites-client »)
//
//  Julien : « un client qui a 5 000 annonces ne doit pas ralentir l'app pour
//  les autres ». Ce banc ouvre les écrans principaux pour un vendeur INVENTÉ
//  de 10 comptes, 5 000 annonces, 20 000 ventes, 3 000 e-mails
//  (`_gros-client.cjs`) et mesure, écran par écran :
//    · le temps jusqu'au calme (plus aucune lecture 2,5 s) ;
//    · le nombre d'éléments du DOM (une liste non bornée en rend des dizaines
//      de milliers) ;
//    · le tas JavaScript utilisé ;
//    · le total des tâches longues (> 50 ms) du fil principal.
//  Seuils (`SEUILS`) posés sur les chiffres MESURÉS après le lot ; un écran qui
//  rend toute sa liste les dépasse.
//
//  Lancer : BANC_PORT=9431 node scripts/bancs/limites-client.cjs
//           (BANC_SEUL=cat_annonces,cat_ventes · BANC_MESURE=1 : chiffres seuls,
//            jamais rouge · BANC_ECHELLE=0.1 : un vendeur dix fois plus petit)
// ════════════════════════════════════════════════════════════════════════════
require('./_meta.cjs');
const H = require('./_base-ecritures.cjs');
const { fabriquerGros } = require('./_gros-client.cjs');
const fs = require('node:fs'), path = require('node:path');
const CAPT = process.env.BANC_CAPTURES || path.join(require('node:os').tmpdir(), 'vrm-bancs', 'limites-client');
fs.mkdirSync(CAPT, { recursive: true });
let ko = 0, ok = 0;
const MESURE = !!process.env.BANC_MESURE;
const dit = (c, m, d) => { if (c || MESURE) ok++; else ko++; console.log((c ? 'OK  ' : (MESURE ? '..  ' : 'KO  ')) + m + (d ? ' — ' + d : '')); };
const SEUL = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
const ECH = Number(process.env.BANC_ECHELLE || 1);

const ECRANS = ['journee', 'cat_annonces', 'cat_ventes', 'stockvinted', 'cat_achats', 'cat_msg'].filter((t) => !SEUL.length || SEUL.includes(t));
// Seuils par écran : éléments du DOM et tâches longues cumulées (ms).
const SEUILS = { dom: 9000 };   // (mesuré avant : Annonces 451 000 éléments, 38 s de tâches longues)

(async () => {
  const srv = await H.serveur(process.env.BANC_PORT || process.env.PORT || 0);
  const nav = await H.lancer();
  const base = H.creerBase(fabriquerGros({ annonces: Math.round(5000 * ECH), ventes: Math.round(20000 * ECH), emails: Math.round(3000 * ECH), txn: Math.round(2000 * ECH) }));
  console.log(`base : ${base.lignes.size} lignes, ${Math.round(JSON.stringify([...base.lignes.values()]).length / 1024)} Ko`);
  const resultats = [];
  for (const vp of [{ width: 1512, height: 900 }, { width: 390, height: 844 }]) {
    const A = await H.appareil(nav, base, { nom: 'A', vp });
    await A.ctx.addInitScript(() => {
      window.__longues = 0;
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longues += e.duration; }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
    });
    const { pg, errs } = await A.ouvrir('A');
    const cdp = await A.ctx.newCDPSession(pg);
    await cdp.send('Performance.enable');
    for (const tab of ECRANS) {
      const n0 = base.lectures.length;
      const t0 = Date.now();
      await pg.goto(srv.url + '/?tab=' + tab, { waitUntil: 'domcontentloaded' });
      let n = base.lectures.length, calme = Date.now();
      while (Date.now() - calme < 2500 && Date.now() - t0 < 60000) { await pg.waitForTimeout(250); if (base.lectures.length !== n) { n = base.lectures.length; calme = Date.now(); } }
      // Annonces : on mesure la grille RENDUE (sinon on mesurerait l'écran d'attente).
      if (tab === 'cat_annonces') await H.attendre(() => pg.evaluate(() => document.querySelectorAll('[data-fiche-num]').length > 0), 90000, 250);
      await pg.waitForTimeout(1500);
      const m =await pg.evaluate(() => ({ dom: document.getElementsByTagName('*').length, longues: Math.round(window.__longues || 0), texte: (document.body.innerText || '').length })).catch(() => ({ dom: -1, longues: -1 }));
      const perf = await cdp.send('Performance.getMetrics');
      const tas = Math.round(((perf.metrics.find((x) => x.name === 'JSHeapUsedSize') || {}).value || 0) / 1048576);
      const r = { ecran: tab, largeur: vp.width, calme_ms: calme - t0, dom: m.dom, longues_ms: m.longues, tas_Mo: tas, lectures: base.lectures.length - n0 };
      resultats.push(r);
      console.log('   ', JSON.stringify(r));
      await pg.screenshot({ path: path.join(CAPT, `${tab}-${vp.width}.png`), timeout: 20000 }).catch(() => console.log('    (capture impossible : page figée)'));
      dit(m.dom > 0 && m.dom <= SEUILS.dom, `${tab} ${vp.width} px : au plus ${SEUILS.dom} éléments dans la page`, `${m.dom}`);
      console.log(`..  ${tab} ${vp.width} px : tâches longues ${m.longues} ms (chiffre seul : trop sensible à la machine pour un seuil)`);
      if (tab === 'cat_annonces') {
        // Rien n'est caché : le total est dit, la suite vient en descendant, la recherche voit tout.
        const etat = () => pg.evaluate(() => { const s = document.querySelector('[data-suite-paquets]'); return { cartes: document.querySelectorAll('[data-fiche-num]').length, montres: s ? Number(s.getAttribute('data-suite-paquets')) : null, total: s ? Number(s.getAttribute('data-suite-total')) : null }; }).catch(() => ({}));
        const e1 = await etat();
        const N = Math.round(5000 * ECH);
        dit(e1.total === N && e1.montres > 0 && e1.montres < N, `A1 ${vp.width} px : une partie des ${N} annonces, le total écrit`, JSON.stringify(e1));
        await pg.evaluate(() => { const s = document.querySelector('[data-suite-paquets]'); if (s) s.scrollIntoView({ block: 'center' }); }).catch(() => {});
        await H.attendre(async () => ((await etat()).montres || 0) > (e1.montres || 0), 8000);
        const e2 = await etat();
        dit((e2.montres || 0) > (e1.montres || 0), `A2 ${vp.width} px : en descendant, la suite arrive toute seule`, JSON.stringify(e2));
        await pg.evaluate(() => { const s = document.querySelector('[data-suite-paquets]'); if (s) s.scrollIntoView({ block: 'end' }); }).catch(() => {});
        await pg.waitForTimeout(400);
        await pg.screenshot({ path: path.join(CAPT, `${tab}-${vp.width}-suite.png`), timeout: 20000 }).catch(() => {});
        const champ = pg.getByLabel('Rechercher une annonce (titre, marque, N°)').first();
        const dernier = String(N - 1);
        await champ.fill(dernier).catch(() => {});
        await H.attendre(async () => pg.evaluate((n) => !!document.querySelector(`[data-fiche-num="${n}"]`), dernier), 10000);
        const trouve = await pg.evaluate((n) => !!document.querySelector(`[data-fiche-num="${n}"]`), dernier).catch(() => false);
        await pg.screenshot({ path: path.join(CAPT, `${tab}-${vp.width}-recherche.png`), timeout: 20000 }).catch(() => {});
        dit(trouve, `A3 ${vp.width} px : la recherche trouve l'annonce N°${dernier} (au bout de la liste)`);
        await champ.fill('').catch(() => {});
        // A4 : sans IntersectionObserver (vieux navigateur), le bouton donne la suite — capture sombre.
        const p2 = await A.ctx.newPage();
        await p2.addInitScript(() => { try { delete window.IntersectionObserver; window.IntersectionObserver = undefined; } catch (_) {} });
        await p2.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"pret":true}' }));
        await H.brancher(p2, base, { nom: 'A4' });
        await p2.emulateMedia({ colorScheme: 'dark' });
        await p2.goto(srv.url + '/?tab=cat_annonces', { waitUntil: 'domcontentloaded' });
        await H.attendre(() => p2.evaluate(() => !!document.querySelector('[data-suite-paquets]')), 90000, 250);
        const avant4 = await p2.evaluate(() => Number((document.querySelector('[data-suite-paquets]') || {}).getAttribute?.('data-suite-paquets') || 0)).catch(() => 0);
        await p2.evaluate(() => document.querySelector('[data-suite-paquets]')?.scrollIntoView({ block: 'end' })).catch(() => {});
        await p2.waitForTimeout(500);
        await p2.screenshot({ path: path.join(CAPT, `${tab}-${vp.width}-suite-sombre.png`), timeout: 20000 }).catch(() => {});
        await p2.getByRole('button', { name: /Voir les \d+ suivantes/ }).first().click().catch(() => {});
        await p2.waitForTimeout(800);
        const apres4 = await p2.evaluate(() => Number((document.querySelector('[data-suite-paquets]') || {}).getAttribute?.('data-suite-paquets') || 0)).catch(() => 0);
        dit(avant4 > 0 && apres4 === avant4 + 72, `A4 ${vp.width} px : sans observateur, « Voir les 72 suivantes » les ajoute`, `${avant4} → ${apres4}`);
        await p2.close();
      }
    }
    const jsErr = errs.filter((x) => !/ResizeObserver|Failed to fetch|NetworkError/.test(x));
    dit(jsErr.length === 0, `aucune erreur JS (${vp.width} px)`, jsErr.slice(0, 3).join(' | '));
    await A.fermer();
  }
  if (process.env.BANC_JSON) fs.writeFileSync(process.env.BANC_JSON, JSON.stringify(resultats, null, 1));
  console.log(`\n${ok} OK, ${ko} KO`);
  await nav.close(); srv.fermer();
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
