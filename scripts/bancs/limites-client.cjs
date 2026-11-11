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
const SEUILS = { dom: 9000, longues: 6000 };

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
      await pg.waitForTimeout(1500);
      const m = await pg.evaluate(() => ({ dom: document.getElementsByTagName('*').length, longues: Math.round(window.__longues || 0), texte: (document.body.innerText || '').length })).catch(() => ({ dom: -1, longues: -1 }));
      const perf = await cdp.send('Performance.getMetrics');
      const tas = Math.round(((perf.metrics.find((x) => x.name === 'JSHeapUsedSize') || {}).value || 0) / 1048576);
      const r = { ecran: tab, largeur: vp.width, calme_ms: calme - t0, dom: m.dom, longues_ms: m.longues, tas_Mo: tas, lectures: base.lectures.length - n0 };
      resultats.push(r);
      console.log('   ', JSON.stringify(r));
      await pg.screenshot({ path: path.join(CAPT, `${tab}-${vp.width}.png`), timeout: 20000 }).catch(() => console.log('    (capture impossible : page figée)'));
      dit(m.dom > 0 && m.dom <= SEUILS.dom, `${tab} ${vp.width} px : au plus ${SEUILS.dom} éléments dans la page`, `${m.dom}`);
      dit(m.longues >= 0 && m.longues <= SEUILS.longues, `${tab} ${vp.width} px : tâches longues ≤ ${SEUILS.longues} ms`, `${m.longues} ms`);
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
