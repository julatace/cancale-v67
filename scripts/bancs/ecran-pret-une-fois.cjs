'use strict';
// ════════════════════════════════════════════════════════════════════════════
//  BANC « L'ÉCRAN ARRIVE UNE FOIS, NET » (26 nov., zero-rouge-bancs)
//
//  Règles jugées sur Ventes, Aujourd'hui, Annonces et Achats (390 et 1512 px), pendant les 8 premières secondes :
//   U1. l'écran (src/AttenteEcran.jsx) passe à « prêt » UNE fois : son hôte `.vrm-attente` n'est monté qu'une fois, et
//       l'hôte de l'écran vrai ne revient jamais à « caché » (`vrm-attente-cache`) quand d'autres données arrivent —
//       sinon l'écran clignote (squelette ou fondu rejoué) ;
//   U2. l'écran montré n'est JAMAIS posé sous 95 % d'opacité (une entrée en fondu tenait tout l'écran à 85 % pendant
//       0,7 à 1,5 s au téléphone occupé — l'en-tête du tableau à 4,25:1, sous AA : banc accessibilite, CI du 26 nov.).
//  Mesuré dans la page, à chaque image, dès la première (MutationObserver + requestAnimationFrame).
//  Données INVENTÉES (le socle des bancs d'accessibilité, _a11y.cjs), aucune requête réelle.
//  `BANC_PORT`, `BANC_LARGEURS=390,1512`, `BANC_ECRANS=ventes,journee,annonces,achats`, `BANC_DUREE` (ms, 8000).
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const A = require('./_a11y.cjs');

const LARGEURS = (process.env.BANC_LARGEURS || '390,1512').split(',').map(Number);
const ECRANS = (process.env.BANC_ECRANS || 'ventes,journee,annonces,achats').split(',');
const DUREE = Number(process.env.BANC_DUREE || 8000);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };

function sonde() {
  const t0 = performance.now(), j = window.__pret1 = { montes: [], cache: [], pret: [], minOp: 1, minOpEcran: '' };
  const ecranDe = (e) => (e && e.closest && e.closest('.vrm-attente') ? e.closest('.vrm-attente').getAttribute('data-attente-ecran') : '') || '';
  const dejaPret = new WeakSet(), vus = new WeakSet();   // un même nœud vu dans deux enregistrements (parent et enfant ajoutés) ne compte qu'une fois
  const voir = (racine) => {
    const l = racine.matches && racine.matches('.vrm-attente') ? [racine] : (racine.querySelectorAll ? [...racine.querySelectorAll('.vrm-attente')] : []);
    for (const x of l) { if (vus.has(x)) continue; vus.add(x); j.montes.push([x.getAttribute('data-attente-ecran'), Math.round(performance.now() - t0), x.parentElement ? x.parentElement.closest('.vrm-attente') ? 'imbriquee' : 'racine' : '?']); }
    // Un hôte d'écran vrai MONTÉ déjà « prêt » (l'écran remonté : une `key` qui change, un Suspense qui revient) compte aussi.
    const hotes = [...(racine.matches && racine.matches('.vrm-attente > .vrm-attente-pret:not([data-attente-instantane-cadre]):not([data-copie-contenu])') ? [racine] : []), ...(racine.querySelectorAll ? racine.querySelectorAll('.vrm-attente > .vrm-attente-pret:not([data-attente-instantane-cadre]):not([data-copie-contenu])') : [])];
    for (const h of hotes) { if (dejaPret.has(h)) continue; dejaPret.add(h); j.pret.push([ecranDe(h), Math.round(performance.now() - t0), 'monte']); }
  };
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'childList') { for (const n of m.addedNodes) if (n.nodeType === 1) voir(n); continue; }
      const e = m.target; if (!e.parentElement || !e.parentElement.classList.contains('vrm-attente')) continue;
      const avant = String(m.oldValue || ''), apres = String(e.className || '');
      if (/vrm-attente-pret/.test(apres) && !/vrm-attente-pret/.test(avant)) { j.pret.push([ecranDe(e), Math.round(performance.now() - t0)]); dejaPret.add(e); }
      if (/vrm-attente-cache/.test(apres) && dejaPret.has(e)) j.cache.push([ecranDe(e), Math.round(performance.now() - t0)]);
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  const image = () => {
    for (const h of document.querySelectorAll('.vrm-attente > .vrm-attente-pret')) {
      if (!h.getClientRects().length) continue;
      let op = 1; for (let e = h; e && e !== document.documentElement; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity) || 0;
      if (op < j.minOp) { j.minOp = op; j.minOpEcran = ecranDe(h); }
    }
    requestAnimationFrame(image);
  };
  requestAnimationFrame(image);
}

(async () => {
  A.srv.listen(A.PORT);
  const b = await A.lancerNavigateur();
  const nc = b.newContext.bind(b);
  b.newContext = async (o) => { const c = await nc(o); await c.addInitScript(sonde); return c; };
  try {
    for (const largeur of LARGEURS) for (const tab of ECRANS) {
      const T = `${largeur} ${tab}`;
      try {
        const { pg, ctx, errs } = await A.ouvrir(b, { largeur, sombre: false, tab });
        await pg.waitForFunction((d) => performance.now() > d, DUREE, { timeout: DUREE + 20000, polling: 250 }).catch(() => {});
        const j = await pg.evaluate(() => window.__pret1);
        const montes = j.montes.filter((x) => x[0] === tab), pret = j.pret.filter((x) => x[0] === tab);
        await A.capture(pg, `pret-une-fois-${tab}-${largeur}`);
        dit(montes.length === 1, `U1 ${T} : l'attente de l'écran est montée une fois`, JSON.stringify(montes));
        dit(pret.length === 1 && !j.cache.length, `U1 ${T} : l'écran passe à « prêt » une fois, jamais revenu à « caché »`, JSON.stringify({ pret, cache: j.cache }));
        dit(j.minOp >= 0.95, `U2 ${T} : l'écran montré n'est jamais sous 95 % d'opacité`, `${j.minOp.toFixed(3)} (${j.minOpEcran})`);
        dit(errs.length === 0, `${T} : aucune erreur de page`, errs.slice(0, 2).join(' | '));
        await ctx.close();
      } catch (e) { dit(false, `${T} : le contrôle a pu s'exécuter`, String(e.message || e).slice(0, 200)); }
    }
  } finally { await b.close(); A.srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exitCode = ko ? 1 : 0;
})();
