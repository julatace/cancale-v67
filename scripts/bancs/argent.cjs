// ═══════════════════════════════════════════════════════════════════════════
// BANC : ARGENT — Statistiques et Compta en UN endroit (10 nov.)
//        npm run build && BANC_PORT=9231 node scripts/bancs/argent.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (le jeu de `nouveau-vendeur` + deux versements lus et une
// vente finalisée sans date de versement, la forme réelle). Trois statuts :
//   A. jamais choisi · B. micro-entrepreneur, déclaration mensuelle · C. particulier.
// Deux tailles : 390 px tactile SOMBRE et 1512 px clair.
//
// 1. LES CHIFFRES AVANT = APRÈS. Le banc relève les data-* de Compta et de
//    Statistiques (bénéfice, son calcul, prévision URSSAF, résultat de l'année,
//    charges, vendu et reçu par période, bilan du mois, « Comparer »…) — les
//    MÊMES attributs, lus de la même façon sur l'ancien écran et sur le nouveau
//    (un segment caché reste dans la page). `BANC_JSON=f` les écrit ;
//    `BANC_REFERENCE=f` exige chaque valeur de la référence À L'IDENTIQUE.
//    Sur le build d'avant : `BANC_DIST=<dist d'avant> BANC_JSON=avant.json`.
// 2. LA NOUVELLE STRUCTURE (rouge sur le build d'avant) :
//   N1 le titre est « Argent » ; la colonne (1512) porte UNE entrée « Argent »,
//      ni « Statistiques » ni « Compta » ;
//   N2 quatre segments (Résumé · Statistiques · Déclarer · Factures), sous le
//      titre ; chacun montre son écran (data-argent-vue visible / Statistiques /
//      Factures) et le segment allumé est le bon ;
//   N3 les quatre réponses : vendu = « Comparer » (Statistiques, mois en cours),
//      bénéfice = le chiffre de la carte du bénéfice (`data-compta-chiffre`),
//      reçu = la case « reçu » de la carte, à déclarer = le chiffre d'affaires de
//      la prévision URSSAF (B), « — » + « choisis ton statut » (A), « Rien » (C) ;
//      jamais « encaissé », jamais « au moins 0 » ;
//   N4 toucher = le détail : Bénéfice ouvre « Ton bénéfice », Reçu ouvre « Vendu
//      et reçu », À déclarer ouvre « Déclarer », Vendu ouvre Statistiques ;
//   N5 les anciens liens : ?tab=dashboard · stats · prixmarche · invoices ·
//      argent · compta&section=declarer, et ?tab=argent_declarer (Ma journée) ;
//   N6 « Les dater » (Déclarer, B) mène au Résumé, « Vendu et reçu » ouvert ;
//   N7 au téléphone : 2 widgets par ligne, ≥ 44 px, rien ne déborde ; les
//      phrases des replis ≤ 12 mots ;
//   N8 aucune erreur JS.
// `SHOTS=<dossier>` : captures (Résumé, Statistiques, Déclarer, Factures).
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || '';
const SCEN = String(process.env.SCENARIOS || 'A,B,C').split(',');
const TAILLES = String(process.env.TAILLES || '390:sombre,1512:clair').split(',').map((x) => { const [w, t] = x.split(':'); return { W: Number(w), sombre: t === 'sombre' }; });
const JSON_OUT = process.env.BANC_JSON || '';
const REF = process.env.BANC_REFERENCE ? JSON.parse(fs.readFileSync(process.env.BANC_REFERENCE, 'utf8')) : null;
const STRUCTURE = process.env.BANC_STRUCTURE !== '0';
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };

const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const txn = (uid, tx, jVerse) => ({ id: `harvest_${uid}_txn_${tx}`, data: { capturedAt: iso(0.01), payload: { transaction: { id: tx, item_id: tx + 500000, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(jVerse) } } } });
const jeu = (scen) => {
  const L = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const v2 = L.find((r) => r.id === 'harvest_222_orders_sold');
  v2.data.payload.my_orders.push({ transaction_id: 62006, title: 'Asics Gel-1130 argent taille 42', price: { amount: '70', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(12), photo: null });
  L.push(txn(222, 62005, 6), txn(111, 62002, 4));
  const main = L.find((r) => r.id === 'main');
  if (scen === 'B') { main.data.vinted_regime = 'micro'; main.data.vinted_urssaf_freq = 'mensuel'; main.data.vrm_urssaf_declare = {}; }
  if (scen === 'C') main.data.vinted_regime = 'particulier';
  return { lignes: L, comptes: NV.JEU_COMPTES, ecritures: 0 };
};
const aller = async (pg, q, attente = 2600) => {
  await pg.goto(`http://localhost:${NV.PORT}/?${q.includes('=') ? q : 'tab=' + q}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(attente);
};
const capture = async (pg, nom) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.evaluate(() => { const m = document.scrollingElement; if (m) m.scrollTop = 0; for (const e of document.querySelectorAll('.vrm-main, .vrm-main *')) if (e.scrollTop) e.scrollTop = 0; });
  await pg.waitForTimeout(250);
  await pg.screenshot({ path: path.join(SHOTS, `${nom}.png`), fullPage: false });
};

// ── LES CHIFFRES DE COMPTA (les mêmes data-*, ancien et nouvel écran) ─────────
const lireCompta = (pg) => pg.evaluate(() => {
  const o = {};
  const a = (sel, attr, cle) => { const e = document.querySelector(sel); o[cle] = e ? e.getAttribute(attr) : null; };
  a('[data-compta-chiffre="gagne"]', 'data-eur', 'benefice');
  for (const k of ['n', 'ncout', 'brut', 'ventes-net', 'charges', 'cotis', 'net', 'raison', 'couverture', 'depenses']) a('[data-benef-etat]', `data-benef-${k}`, `benef.${k}`);
  for (const k of ['carte', 'label', 'ca', 'apayer', 'partiel', 'adater', 'encours']) a('[data-prevision-carte]', k === 'carte' ? 'data-prevision-carte' : `data-prevision-${k}`, `prevision.${k}`);
  a('[data-compta-resultat]', 'data-compta-resultat', 'resultat');
  a('[data-compta-resultat]', 'data-compta-ca', 'resultat.ca');
  a('[data-compta-resultat]', 'data-compta-charges', 'resultat.charges');
  for (const k of ['mois', 'annee', 'abo']) a(`[data-compta-kpi="${k}"]`, 'data-eur', `charges.${k}`);
  for (const k of ['vendu', 'recu']) a(`[data-ca-cur="${k}"]`, 'data-ca-eur', `ca.${k}`);
  a('[data-ca-periode]', 'data-ca-periode', 'ca.periode');
  for (const k of ['vendu', 'recu', 'paires', 'benefice']) a(`[data-bilan-ligne="${k}"]`, 'data-valeur', `bilan.${k}`);
  for (const k of ['declarer', 'urssaf', 'finalisees']) a(`[data-carte-page="compta"][data-carte-chiffre="${k}"]`, 'data-carte-valeur', `carte.${k}`);
  o.statut = (document.querySelector('[data-statut-actuel]') || { getAttribute: () => null }).getAttribute('data-statut-actuel');
  return o;
});
const lireStats = (pg) => pg.evaluate(() => {
  const o = {};
  for (const k of ['vendu', 'ventes', 'recu']) { const e = document.querySelector(`[data-comparer-ligne="${k}"]`); o[`comparer.${k}`] = e ? e.getAttribute('data-a') : null; }
  return o;
});

(async () => {
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const releve = {};
  try {
    for (const scen of SCEN) for (const { W, sombre } of TAILLES) {
      const T = `${scen} ${W}${sombre ? ' sombre' : ''}`, tel = W < 600;
      const o = await NV.ouvrir(nav, { W, sombre, base: jeu(scen), tab: 'journee' });
      const pg = o.pg;
      try {
        // L'écran Ventes, ouvert une fois, publie le CA déclaré et le bénéfice (le geste de la vraie vie).
        await aller(pg, 'cat_ventes', 4500);
        await aller(pg, 'dashboard', 3600);
        const st = await lireStats(pg);
        await aller(pg, 'compta', 3600);
        const cp = await lireCompta(pg);
        const chiffres = { ...cp, ...st };
        releve[T] = chiffres;
        // ── 1. AVANT = APRÈS ──
        if (REF && REF[T]) {
          const diff = Object.entries(REF[T]).filter(([k, v]) => chiffres[k] !== v).map(([k, v]) => `${k}: avant ${JSON.stringify(v)} / après ${JSON.stringify(chiffres[k])}`);
          const n = Object.values(REF[T]).filter((v) => v != null && v !== '').length;
          dit(!diff.length, `AVANT=APRÈS ${T} : les ${Object.keys(REF[T]).length} chiffres relevés (${n} renseignés) sont identiques`, diff.join(' ¦ '));
        }
        if (!STRUCTURE) { await o.ctx.close(); continue; }
        // ── 2. LA STRUCTURE ──
        const tete = await pg.evaluate(() => {
          const vis = (e) => !!e && e.getClientRects().length > 0 && e.getBoundingClientRect().height > 0;
          const h1 = [...document.querySelectorAll('.vrm-main h1')].find(vis);
          const navA = document.querySelector('[data-argent-nav]');
          const segs = navA ? [...navA.querySelectorAll('[data-section]')].map((b) => ({ id: b.getAttribute('data-section'), l: b.innerText.trim(), on: b.getAttribute('aria-current') === 'page', h: b.getBoundingClientRect().height })) : [];
          const entrees = [...document.querySelectorAll('[data-nav-entree]')].filter(vis).map((b) => ({ id: b.getAttribute('data-nav-entree'), l: (b.getAttribute('aria-label') || b.innerText || '').trim() }));
          const txt = document.querySelector('.vrm-main').innerText;
          const q = [...document.querySelectorAll('[data-argent-q]')].map((b) => { const r = b.getBoundingClientRect(); return { id: b.getAttribute('data-argent-q'), v: b.getAttribute('data-argent-valeur'), raison: b.getAttribute('data-argent-raison') || '', n: (b.querySelector('.vrm-argent-w-n') || {}).innerText || '', note: (b.querySelector('.vrm-argent-w-note') || {}).innerText || '', x: Math.round(r.left), y: Math.round(r.top), w: r.width, h: r.height }; });
          const resumes = [...document.querySelectorAll('[data-argent-vue="resume"] .vrm-compta-repli-resume')].map((e) => e.innerText.trim());
          const de = document.scrollingElement;
          return { h1: h1 ? h1.innerText.trim() : '', h1bas: h1 ? h1.getBoundingClientRect().bottom : 0, navHaut: navA ? navA.getBoundingClientRect().top : -1, segs, entrees, q, resumes,
            encaisse: /encaiss/i.test(txt), nan: /\bNaN\b|undefined|Invalid Date/.test(txt), auMoins0: /au moins 0[,\s]*0?0?\s*€/i.test(txt),
            deborde: de.scrollWidth > de.clientWidth + 1 || [...document.querySelectorAll('.vrm-argent-w')].some((b) => b.getBoundingClientRect().right > innerWidth + 1),
            vueResume: vis(document.querySelector('[data-argent-vue="resume"]')), vueDeclarer: vis(document.querySelector('[data-argent-vue="declarer"]')) };
        });
        dit(tete.h1 === 'Argent', `N1 ${T} : le titre est « Argent »`, tete.h1);
        if (!tel) {
          const ids = tete.entrees.map((e) => e.id);
          dit(ids.filter((x) => x === 'compta').length >= 1 && !ids.includes('dashboard') && tete.entrees.some((e) => e.id === 'compta' && /^Argent$/.test(e.l)), `N1 ${T} : la colonne porte UNE entrée « Argent » (ni Statistiques ni Compta)`, JSON.stringify(tete.entrees.filter((e) => /compta|dashboard/.test(e.id))));
        }
        dit(tete.segs.map((s) => s.l).join('·') === 'Résumé·Statistiques·Déclarer·Factures', `N2 ${T} : quatre segments`, JSON.stringify(tete.segs));
        dit(tete.navHaut >= tete.h1bas - 1, `N2 ${T} : les segments sont sous le titre`, `${tete.navHaut} / ${tete.h1bas}`);
        dit((tete.segs.find((s) => s.on) || {}).id === 'resume' && tete.vueResume && !tete.vueDeclarer, `N2 ${T} : ?tab=compta ⇒ le Résumé (seul)`, JSON.stringify({ on: tete.segs.find((s) => s.on), r: tete.vueResume, d: tete.vueDeclarer }));
        const Q = Object.fromEntries(tete.q.map((x) => [x.id, x]));
        dit(tete.q.map((x) => x.id).join(',') === 'vendu,recu,benefice,declarer', `N3 ${T} : les quatre réponses, dans l'ordre`, tete.q.map((x) => x.id).join(','));
        const cent = (v) => (v == null || v === '' ? '' : String(Math.round(Number(v) * 100)));
        dit(Q.vendu && Q.vendu.v === (st['comparer.vendu'] || ''), `N3 ${T} : vendu = « Comparer » de Statistiques (mois en cours)`, `${Q.vendu && Q.vendu.v} / ${st['comparer.vendu']}`);
        dit(Q.benefice && Q.benefice.v === cent(cp.benefice), `N3 ${T} : bénéfice = le chiffre de la carte du bénéfice`, `${Q.benefice && Q.benefice.v} / ${cent(cp.benefice)}`);
        const recuCarte = await pg.evaluate(() => { const e = document.querySelector('[data-carte-page="journee"][data-carte-chiffre="recu"], [data-carte-chiffre="recu"]'); return e ? e.getAttribute('data-carte-valeur') : null; });
        dit(recuCarte == null || (Q.recu && Q.recu.v === recuCarte), `N3 ${T} : reçu = la case « reçu » d'une carte (même règle)`, `${Q.recu && Q.recu.v} / ${recuCarte}`);
        if (scen === 'B') dit(Q.declarer && Q.declarer.v === cent(cp['prevision.ca']) && /avant le/.test(Q.declarer.note), `N3 ${T} : à déclarer = le CA de la prévision URSSAF, et sa date`, `${JSON.stringify(Q.declarer)} / ${cp['prevision.ca']}`);
        if (scen === 'A') dit(Q.declarer && Q.declarer.v === '' && /—/.test(Q.declarer.n) && /statut/.test(Q.declarer.note), `N3 ${T} : statut pas choisi ⇒ « — » et « choisis ton statut »`, JSON.stringify(Q.declarer));
        if (scen === 'C') dit(Q.declarer && Q.declarer.v === '' && Q.declarer.n === 'Rien' && /particulier/.test(Q.declarer.note), `N3 ${T} : particulier ⇒ « Rien » (pas d'URSSAF)`, JSON.stringify(Q.declarer));
        dit(!tete.encaisse && !tete.nan && !tete.auMoins0, `N3 ${T} : jamais « encaissé », NaN, undefined ni « au moins 0 »`, JSON.stringify({ e: tete.encaisse, n: tete.nan, z: tete.auMoins0 }));
        if (tel) {
          const rangs = [...new Set(tete.q.map((x) => x.y))];
          dit(rangs.length === 2 && tete.q.every((x) => x.h >= 44), `N7 ${T} : 2 widgets par ligne, ≥ 44 px`, JSON.stringify(tete.q.map((x) => [x.x, x.y, Math.round(x.h)])));
          dit(!tete.deborde, `N7 ${T} : rien ne déborde`);
        } else dit(new Set(tete.q.map((x) => x.y)).size === 1, `N7 ${T} : les 4 widgets sur une ligne`, JSON.stringify(tete.q.map((x) => [x.x, x.y])));
        const longues = tete.resumes.filter((t) => t.split(/\s+/).length > 12);
        dit(!longues.length, `N7 ${T} : les phrases des replis font ≤ 12 mots`, longues.join(' ¦ '));
        await capture(pg, `resume-${scen}-${W}`);
        // ── N4 : toucher = le détail ──
        await pg.locator('[data-argent-q="benefice"]').click();
        await pg.waitForTimeout(500);
        dit(await pg.evaluate(() => { const d = document.getElementById('compta-benefice'); return !!(d && d.open); }), `N4 ${T} : Bénéfice ouvre « Ton bénéfice »`);
        await pg.locator('[data-argent-q="recu"]').click();
        await pg.waitForTimeout(500);
        dit(await pg.evaluate(() => { const d = document.getElementById('compta-ca'); return !!(d && d.open); }), `N4 ${T} : Reçu ouvre « Vendu et reçu »`);
        await pg.locator('[data-argent-q="declarer"]').click();
        await pg.waitForTimeout(900);
        const dec = await pg.evaluate(() => { const vis = (e) => !!e && e.getClientRects().length > 0; return { d: vis(document.querySelector('[data-argent-vue="declarer"]')), r: vis(document.querySelector('[data-argent-vue="resume"]')), on: (document.querySelector('[data-argent-nav] [aria-current="page"]') || {}).getAttribute ? document.querySelector('[data-argent-nav] [aria-current="page"]').getAttribute('data-section') : '' }; });
        dit(dec.d && !dec.r && dec.on === 'declarer', `N4 ${T} : À déclarer ouvre « Déclarer »`, JSON.stringify(dec));
        await capture(pg, `declarer-${scen}-${W}`);
        // N6 : « Les dater » (Déclarer) ⇒ le Résumé, « Vendu et reçu » ouvert.
        if (scen === 'B') {
          const b = pg.locator('[data-urssaf-dater]');
          if (await b.count()) {
            await b.first().click(); await pg.waitForTimeout(1200);
            const r = await pg.evaluate(() => { const vis = (e) => !!e && e.getClientRects().length > 0; const d = document.getElementById('compta-ca'); return { r: vis(document.querySelector('[data-argent-vue="resume"]')), open: !!(d && d.open) }; });
            dit(r.r && r.open, `N6 ${T} : « Les dater » mène au Résumé, « Vendu et reçu » ouvert`, JSON.stringify(r));
          } else console.log(`·  N6 ${T} : pas de « Les dater » dans ce jeu (prévision « ${cp['prevision.carte']} ») — non jugé`);
        }
        await aller(pg, 'compta', 2600);
        await pg.locator('[data-argent-q="vendu"]').click();
        await pg.waitForTimeout(2200);
        const v = await pg.evaluate(() => ({ stats: !!document.querySelector('[data-comparer-ligne]') || !!document.querySelector('.vrm-stats-vitrine'), on: (document.querySelector('[data-argent-nav] [aria-current="page"]') || { getAttribute: () => '' }).getAttribute('data-section'), h1: ([...document.querySelectorAll('.vrm-main h1')].find((e) => e.getClientRects().length) || {}).innerText }));
        dit(v.stats && v.on === 'stats' && v.h1 === 'Argent', `N4 ${T} : Vendu ouvre Statistiques (dans Argent)`, JSON.stringify(v));
        await capture(pg, `stats-${scen}-${W}`);
        // Factures, par son segment.
        await pg.locator('[data-argent-nav] [data-section="factures"]').click();
        await pg.waitForTimeout(2200);
        const f = await pg.evaluate(() => ({ on: (document.querySelector('[data-argent-nav] [aria-current="page"]') || { getAttribute: () => '' }).getAttribute('data-section'), fx: !!document.querySelector('[data-argent-vue="factures"]:not([hidden])'), h1: ([...document.querySelectorAll('.vrm-main h1')].find((e) => e.getClientRects().length) || {}).innerText }));
        dit(f.on === 'factures' && f.fx && f.h1 === 'Argent', `N2 ${T} : le segment Factures`, JSON.stringify(f));
        await capture(pg, `factures-${scen}-${W}`);
        // ── N5 : les anciens liens ──
        if (scen === SCEN[0]) {
          for (const [q, seg, quoi] of [['tab=dashboard', 'stats', 'stats'], ['tab=stats', 'stats', 'stats'], ['tab=prixmarche', 'stats', 'prix'], ['tab=invoices', 'factures', 'factures'], ['tab=argent', 'resume', 'resume'], ['tab=compta&section=declarer', 'declarer', 'declarer'], ['tab=argent_declarer', 'declarer', 'declarer']]) {
            await aller(pg, q, 2400);
            const r = await pg.evaluate(() => ({ on: (document.querySelector('[data-argent-nav] [aria-current="page"]') || { getAttribute: () => '' }).getAttribute('data-section'),
              resume: !!document.querySelector('[data-argent-vue="resume"]:not([hidden])'), declarer: !!document.querySelector('[data-argent-vue="declarer"]:not([hidden])'), factures: !!document.querySelector('[data-argent-vue="factures"]:not([hidden])'),
              prix: !!document.querySelector('[data-section="prix"][aria-current="page"]'), stats: !!document.querySelector('[data-section="stats"][aria-current="page"]') }));
            dit(r.on === seg && r[quoi], `N5 ${T} : ?${q} ⇒ Argent · ${seg}`, JSON.stringify(r));
          }
        }
        dit(!o.journal.erreurs.length, `N8 ${T} : aucune erreur JS`, o.journal.erreurs.slice(0, 3).join(' ¦ '));
      } catch (e) { dit(false, `${T} : le parcours s'arrête`, e.message.split('\n')[0]); }
      await o.ctx.close();
    }
  } finally {
    if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(releve, null, 1));
    await nav.close(); NV.srv.close();
    console.log(ko ? `\n❌ argent : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ argent : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
