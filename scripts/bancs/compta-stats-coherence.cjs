// ═══════════════════════════════════════════════════════════════════════════
// BANC : COMPTA ET STATISTIQUES, COHÉRENTES (5 novembre, chantier F)
//        npm run build && BANC_PORT=9211 node scripts/bancs/compta-stats-coherence.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (le jeu de `nouveau-vendeur` + trois transactions de la
// FORME réelle : deux versements lus, une vente finalisée sans date de
// versement). 390 px tactile et 1512 px, clair et sombre. Deux scénarios :
//   A. statut jamais choisi ; B. micro-entrepreneur, déclaration mensuelle.
// Ce que le banc MESURE (aucun libellé ne sert à juger une valeur) :
//   S1 (revue 2.25) le choix « Vue d'ensemble · Prix qui marche » est SOUS le
//      grand titre de Statistiques ;
//   S2 (2.25) une carte qui n'a rien à montrer est repliée en une ligne
//      (`data-sv-repliee`, ≤ 100 px de haut), et aucune carte « vide » n'est
//      dépliée ;
//   S3 (2.25) le nombre des annulations n'est écrit qu'UNE fois sur la carte ;
//   S4 (mots) « Vendu », jamais « CA vendu » ; le titre de Compta est « Compta » ;
//   C1 (2.26) aucun panneau vide (anneau sans données) dans Compta ;
//   C2 (2.27) le statut se choisit à UN endroit (question, ou « Changer ») ;
//      plus aucun choix de régime ailleurs dans Compta ;
//   C3 (2.27) le survol des cartes d'option n'existe que sous (hover:hover) ;
//   C4 (2.27) pas de date en surtitre au-dessus de « Compta » ;
//   C5 (1.7) « À déclarer » sans statut = « — » et la raison visible ;
//   C6 (1.7) le reçu de « Comparer » : jamais « 0 € » quand des ventes sont à
//      dater, la raison écrite sous le tableau ;
//   U1 « À recopier sur l'URSSAF » : le montant copié = le chiffre d'affaires
//      de la prévision, « Copier » ⇒ presse-papier ⇒ « Copié », 44 px au doigt,
//      les ventes à dater nommées, « J'ai déclaré » ;
//   B1 « Bilan du mois » : vendu et reçu = ceux de « Comparer » (même mois, même
//      règle), le PDF se télécharge (%PDF) ;
//   D1 « Délai de paiement » : la médiane Vinted et le nombre de ventes mesurées
//      = ceux des transactions servies (2 et 3 jours ⇒ 2,5 j sur 2).
// `SHOTS=<dossier>` : captures de Statistiques et de Compta (à regarder).
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { allerSegment } = require('./_compta.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || '';
const LARGEURS = String(process.env.LARGEURS || '390,1512').split(',').map(Number);
const THEMES = String(process.env.THEMES || 'clair,sombre').split(',');
const SCEN = String(process.env.SCENARIOS || 'A,B').split(',');
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 300) : ''}`); };

const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
// Les transactions (forme réelle : `payload.transaction`, statut 450 = « Commande finalisée »).
const txn = (uid, tx, jVerse) => ({ id: `harvest_${uid}_txn_${tx}`, data: { capturedAt: iso(0.01), payload: { transaction: { id: tx, item_id: tx + 500000, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(jVerse) } } } });
const jeu = (scen) => {
  const L = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  // Une vente finalisée de plus, jamais versée (« à dater »).
  const v2 = L.find((r) => r.id === 'harvest_222_orders_sold');
  v2.data.payload.my_orders.push({ transaction_id: 62006, title: 'Asics Gel-1130 argent taille 42', price: { amount: '70', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(12), photo: null });
  // Versements lus : 62005 vendue, versée 3 j après ; 62002 vendue, versée 2 j après.
  // (14 nov., bancs au vert) DANS LE MOIS PASSÉ, à midi UTC, quel que soit le jour où le banc tourne : U1 juge l'échéance
  // FINIE (mensuel ⇒ le mois passé). Avec « il y a 6 et 4 jours », un banc lancé après le 6 du mois ne mettait aucun
  // versement dans la période finie : la prévision était « pas su » (§5, jamais « au moins 0 € ») et U1 mesurait le calendrier.
  const moisPasse = (jour) => { const d = new Date(now); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, jour, 12)).toISOString(); };
  const dater = (uid, tx, vendue) => { const r = L.find((x) => x.id === `harvest_${uid}_orders_sold`); const o = r && r.data.payload.my_orders.find((x) => x.transaction_id === tx); if (o) o.date = moisPasse(vendue); };
  dater(222, 62005, 18); dater(111, 62002, 20);
  const txnLe = (uid, tx, jour) => { const t = txn(uid, tx, 0); t.data.payload.transaction.status_updated_at = moisPasse(jour); return t; };
  L.push(txnLe(222, 62005, 21), txnLe(111, 62002, 22));
  const main = L.find((r) => r.id === 'main');
  if (scen === 'B') { main.data.vinted_regime = 'micro'; main.data.vinted_urssaf_freq = 'mensuel'; main.data.vrm_urssaf_declare = {}; }
  return { lignes: L, comptes: NV.JEU_COMPTES, ecritures: 0 };
};
const aller = async (pg, tab, attente = 2600) => {
  await pg.goto(`http://localhost:${NV.PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(attente);
};
const capture = async (pg, nom) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  const info = await pg.evaluate(() => {
    let best = null;
    for (const e of [document.scrollingElement, ...document.querySelectorAll('.vrm-main, .vrm-main *, .vrm-app-shell > *')]) {
      if (!e) continue; const s = e === document.scrollingElement ? null : getComputedStyle(e);
      if (s && !/(auto|scroll)/.test(s.overflowY)) continue;
      const d = e.scrollHeight - e.clientHeight; if (d > 20 && e.clientHeight > innerHeight * 0.5 && (!best || d > best.d)) best = { e, d };
    }
    if (!best) return { n: 1 };
    window.__defile = best.e; best.e.scrollTop = 0;
    return { n: Math.min(8, Math.ceil(best.e.scrollHeight / (best.e.clientHeight * 0.85))), h: best.e.clientHeight };
  });
  for (let i = 0; i < info.n; i++) {
    if (i) { await pg.evaluate((y) => { window.__defile.scrollTop = y; }, Math.round(i * info.h * 0.85)); await pg.waitForTimeout(300); }
    await pg.screenshot({ path: path.join(SHOTS, `${nom}${info.n > 1 ? '-p' + (i + 1) : ''}.png`) });
  }
  if (info.n > 1) await pg.evaluate(() => { window.__defile.scrollTop = 0; });
};

(async () => {
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const scen of SCEN) for (const W of LARGEURS) for (const th of THEMES) {
      const T = `${scen} ${W} ${th}`, tel = W < 600;
      const o = await NV.ouvrir(nav, { W, sombre: th === 'sombre', base: jeu(scen), tab: 'dashboard' });
      const pg = o.pg;
      try {
        // L'écran Ventes, ouvert une fois, publie le CA déclaré et le bénéfice (le geste de la vraie vie).
        await aller(pg, 'cat_ventes', 4500);
        // ── STATISTIQUES ──
        await aller(pg, 'dashboard', 3600);
        const st = await pg.evaluate(() => {
          const vis = (e) => !!e && e.getClientRects().length > 0 && e.getBoundingClientRect().height > 0;
          const h1 = [...document.querySelectorAll('.vrm-main h1')].find(vis);
          const nav = document.querySelector('[data-stats-sous-nav]') || document.querySelector('.vrm-rubriques');
          const cartes = [...document.querySelectorAll('.vrm-stats-vitrine [data-stats-carte]')].filter(vis);
          // Une carte « sans données » : repliée, ou qui ne porte qu'un texte vide (aucune liste, barre, table, chiffre lu).
          const vides = cartes.filter((c) => c.hasAttribute('data-sv-repliee') || (c.querySelector('.vrm-sv-vide, .vrm-cr-vide, [data-of-etat="encours"]') && !c.querySelector('.vrm-sv-lignes, .vrm-cr-liste, .vrm-of-table, .vrm-sv-barres, .vrm-sv-boost-table'))
            || (c.matches('.vrm-of') && ![...c.querySelectorAll('.vrm-of-tuile b, .vrm-of-ligne:not(.vrm-of-entete) [role=cell]:not(.vrm-of-nom)')].some((x) => /\d/.test(x.innerText)))
            || (!!c.querySelector('[data-sv-notes-compte]') && ![...c.querySelectorAll('[data-sv-notes-compte]')].some((x) => x.getAttribute('data-etat') === 'lu')));
          const deplies = vides.filter((c) => !c.hasAttribute('data-sv-repliee')).map((c) => c.getAttribute('data-stats-carte'));
          const hauts = vides.filter((c) => c.getBoundingClientRect().height > 100).map((c) => `${c.getAttribute('data-stats-carte')} ${Math.round(c.getBoundingClientRect().height)}px`);
          const an = document.querySelector('[data-sv-carte="annulations"]');
          let repetes = [];
          if (an) {
            const t = an.innerText;
            const nums = [...t.matchAll(/(\d+)\s*(?:\/|sur)\s*(\d+)/g)].map((m) => `${m[1]}/${m[2]}`);
            const c = {}; for (const n of nums) c[n] = (c[n] || 0) + 1;
            repetes = Object.entries(c).filter(([, k]) => k > 1).map(([n, k]) => `${n}×${k}`);
          }
          const txt = document.querySelector('.vrm-main') ? document.querySelector('.vrm-main').innerText : '';
          return {
            h1: h1 ? { t: h1.innerText, bas: h1.getBoundingClientRect().bottom } : null,
            nav: nav && vis(nav) ? { haut: nav.getBoundingClientRect().top, dans: !!nav.closest('[data-stats-sous-nav]') } : null,
            nCartes: cartes.length, nVides: vides.length, deplies, hauts, repetes, annul: !!an,
            caVendu: /\bCA vendu\b/.test(txt),
          };
        });
        dit(!!st.h1 && !!st.nav && st.nav.haut >= st.h1.bas - 1, `S1 ${T} : « Vue d'ensemble · Prix qui marche » est sous le titre`, JSON.stringify({ h1: st.h1, nav: st.nav }));
        dit(st.nVides > 0 && !st.deplies.length, `S2 ${T} : les ${st.nVides} cartes sans données sont repliées en une ligne`, `dépliées : ${st.deplies.join(', ')}`);
        dit(!st.hauts.length, `S2 ${T} : une carte repliée fait au plus 100 px`, st.hauts.join(' ¦ '));
        dit(st.annul && !st.repetes.length, `S3 ${T} : le nombre des annulations n'est écrit qu'une fois`, st.repetes.join(', '));
        dit(!st.caVendu, `S4 ${T} : « Vendu », jamais « CA vendu »`);
        // C6 — Comparer : le reçu.
        const cmp = await pg.evaluate(() => {
          const r = document.querySelector('[data-comparer-ligne="recu"]');
          if (!r) return null;
          const cells = [...r.children].slice(1, 3).map((c) => c.innerText.replace(/\s+/g, ' ').trim());
          const v = document.querySelector('[data-comparer-ligne="vendu"]');
          return { a: r.getAttribute('data-a'), b: r.getAttribute('data-b'), raisonA: r.getAttribute('data-a-raison'), cells, pourquoi: (document.querySelector('[data-comparer-pourquoi-ligne="recu"]') || {}).innerText || '', venduA: v ? v.getAttribute('data-a') : null, venduNom: v ? v.children[0].innerText : '' };
        });
        dit(!!cmp && !cmp.cells.some((c) => /^0\s?€$/.test(c)), `C6 ${T} : le reçu de « Comparer » n'écrit jamais « 0 € » quand des ventes sont à dater`, JSON.stringify(cmp));
        dit(!!cmp && cmp.cells.every((c) => c === '—' || /au moins/.test(c)) && /1 vente sans date de versement/.test(cmp.pourquoi), `C6 ${T} : « — » ou « au moins », et la raison (« 1 vente sans date de versement ») sous le tableau`, JSON.stringify(cmp));
        dit(!!cmp && cmp.venduNom === 'Vendu', `S4 ${T} : la ligne de « Comparer » s'appelle « Vendu »`, cmp && cmp.venduNom);
        if (scen === 'A') await capture(pg, `stats-${W}-${th}`);

        // ── COMPTA ──
        await aller(pg, 'compta', 3600);
        const cp = await pg.evaluate(() => {
          const vis = (e) => !!e && e.getClientRects().length > 0 && e.getBoundingClientRect().height > 0;
          const main = document.querySelector('.vrm-main');
          const h1 = [...main.querySelectorAll('h1')].find(vis);
          // (10 nov., lot AO) Un panneau dans un repli FERMÉ n'est pas à l'écran (Chrome lui garde une boîte, sans texte rendu).
          const panneauxVides = [...main.querySelectorAll('.vrm-fu-panneau, .vrm-compta-carte, .vrm-sv-carte, .vrm-repartition-anneau')].filter(vis).filter((e) => !e.closest('details:not([open])'))
            .filter((e) => !e.innerText.trim() && !e.querySelector('svg circle[stroke-dasharray], svg rect, .vrm-fu-barre')).map((e) => e.className);
          // Les endroits où le statut se choisit (même replié : un endroit caché reste un endroit).
          const places = [];
          if (main.querySelector('[data-statut-choix]')) places.push('question');
          if (main.querySelector('[data-statut-changer]')) places.push('changer');
          if (main.querySelector('[data-regime-choix]')) places.push('profil');
          if (main.querySelector('[data-prevision-geste="statut"]')) places.push('prevision');
          // (10 nov., lot AO) « À déclarer » se lit en tête du Résumé (le widget `data-argent-q`, sa raison en note) ;
          // la carte sombre est rangée dans le repli « Ton bénéfice ». On juge celle qui est À L'ÉCRAN.
          const w = main.querySelector('[data-argent-q="declarer"]');
          const declarer = w && vis(w) ? w.querySelector('.vrm-argent-w-n') : main.querySelector('[data-carte-chiffre="declarer"]');
          const raison = w && vis(w) ? w.querySelector('.vrm-argent-w-note') : main.querySelector('[data-declarer-raison]');
          return {
            h1: h1 ? h1.innerText.trim() : '', date: !!main.querySelector('[data-date-tete]'),
            panneauxVides, places, regimeFiscal: /Régime fiscal/.test(main.textContent),
            declarer: declarer ? declarer.innerText.replace(/\s+/g, ' ').trim() : null, raison: raison && vis(raison) ? raison.innerText : '',
            hover: (() => {
              const bad = [];
              const voir = (rules, dansHover) => { for (const r of rules) { if (r.cssRules && r.media) voir(r.cssRules, dansHover || /hover\s*:\s*hover/.test(r.media.mediaText)); else if (r.selectorText && /vrm-statut-option[^,]*:hover/.test(r.selectorText) && !dansHover) bad.push(r.selectorText); } };
              for (const sh of document.styleSheets) { try { voir(sh.cssRules, false); } catch (_) {} }
              return bad;
            })(),
          };
        });
        // (10 nov.) Compta et Statistiques sont devenues « Argent » (src/argent.js).
        dit(cp.h1 === 'Argent', `S4 ${T} : le titre est « Argent »`, cp.h1);
        dit(!cp.date, `C4 ${T} : pas de date en surtitre au-dessus de « Compta »`);
        dit(!cp.panneauxVides.length, `C1 ${T} : aucun panneau vide (anneau sans données)`, cp.panneauxVides.join(' ¦ '));
        dit(cp.places.length === 1, `C2 ${T} : le statut se choisit à UN endroit`, cp.places.join(', '));
        dit(!cp.regimeFiscal, `C2 ${T} : plus « Régime fiscal » dans Compta (le mot est « Statut »)`);
        dit(!cp.hover.length, `C3 ${T} : le survol des cartes d'option seulement sous (hover:hover)`, cp.hover.join(' ¦ '));
        if (scen === 'A') {
          dit(cp.places[0] === 'question', `C2 ${T} : statut jamais choisi ⇒ la question`, cp.places.join(','));
          dit(cp.declarer != null && /—/.test(cp.declarer) && !/\d\s?€/.test(cp.declarer), `C5 ${T} : « À déclarer » sans statut = « — »`, cp.declarer);
          dit(!!cp.raison, `C5 ${T} : la raison est écrite sous la carte`, cp.raison);
          await capture(pg, `compta-A-${W}-${th}`);
        } else {
          dit(cp.places[0] === 'changer', `C2 ${T} : statut choisi ⇒ seulement « Changer »`, cp.places.join(','));
          // U1 — « À recopier sur l'URSSAF » (segment « Déclarer » d'Argent).
          await allerSegment(pg, 'declarer');
          await pg.evaluate(() => { window.__copie = null; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__copie = String(t); } } }); } catch (_) {} });
          const u = await pg.evaluate(() => {
            const c = document.querySelector('[data-urssaf-geste="recopier"]');
            if (!c) return null;
            const b = c.querySelector('[data-urssaf-copier="ca"]');
            const r = b ? b.getBoundingClientRect() : null;
            return { ca: c.getAttribute('data-prevision-ca'), adater: c.getAttribute('data-prevision-adater'), texte: b ? b.getAttribute('data-urssaf-texte') : null, h: r ? r.height : 0,
              manque: (c.querySelector('[data-urssaf-manque]') || {}).innerText || '', declare: !!c.querySelector('[data-urssaf-cest-declare]'), site: !!c.querySelector('[data-urssaf-site]'), encaisse: /encaiss/i.test(c.innerText) };
          });
          dit(!!u, `U1 ${T} : la période finie, la carte « À recopier sur l'URSSAF » est là`);
          if (u) {
            const attendu = u.ca === '' ? null : (Math.round(Number(u.ca) * 100) / 100).toFixed(2).replace(/\.00$/, '').replace('.', ',');
            dit(u.texte != null && u.texte === attendu, `U1 ${T} : le montant à copier = le chiffre d'affaires de la prévision`, `${u.texte} / ${attendu}`);
            dit(!tel || u.h >= 44, `U1 ${T} : « Copier » fait 44 px au doigt`, String(u.h));
            dit(/(^|\D)1 vente sans date( de versement)?\b/.test(u.manque), `U1 ${T} : la vente à dater est nommée (1 vente sans date)`, u.manque);
            dit(u.declare && u.site, `U1 ${T} : « Ouvrir l'URSSAF » et « J'ai déclaré »`);
            dit(!u.encaisse, `U1 ${T} : jamais « encaissé »`);
            await pg.locator('[data-urssaf-copier="ca"]').first().click();
            await pg.waitForTimeout(300);
            const apres = await pg.evaluate(() => ({ copie: window.__copie, txt: (document.querySelector('[data-urssaf-copier="ca"]') || {}).innerText || '' }));
            dit(apres.copie === u.texte && /Copié/.test(apres.txt), `U1 ${T} : « Copier » met le montant dans le presse-papier et dit « Copié »`, JSON.stringify(apres));
          }
          if (W === LARGEURS[0] || !tel) await capture(pg, `compta-B-${W}-${th}`);
          // B1 — Bilan du mois (ouvert d'un geste), dans le Résumé.
          await allerSegment(pg, 'resume');
          await pg.evaluate(() => { const d = document.getElementById('compta-bilan'); if (d) d.open = true; });
          await pg.waitForTimeout(500);
          const bilan = await pg.evaluate(() => {
            const v = (k) => { const e = document.querySelector(`[data-bilan-ligne="${k}"]`); return e ? e.getAttribute('data-valeur') : null; };
            return { vendu: v('vendu'), recu: v('recu'), paires: v('paires'), benefice: v('benefice'), meilleur: v('meilleur'), mois: (document.querySelector('[data-bilan-mois]') || {}).getAttribute ? document.querySelector('[data-bilan-mois]').getAttribute('data-bilan-mois') : null };
          });
          // Le vendu du mois par « Comparer » (Statistiques) : la même règle, le même mois.
          const ref = await (async () => {
            await aller(pg, 'dashboard', 3000);
            return pg.evaluate(() => { const g = (k, c) => { const e = document.querySelector(`[data-comparer-ligne="${k}"]`); return e ? e.getAttribute(c) : null; }; return { vendu: g('vendu', 'data-a'), ventes: g('ventes', 'data-a'), recu: g('recu', 'data-a') }; });
          })();
          await aller(pg, 'compta', 3000);
          await pg.evaluate(() => { const d = document.getElementById('compta-bilan'); if (d) d.open = true; });
          await pg.waitForTimeout(400);
          dit(bilan.vendu != null && ref.vendu != null && Math.round(Number(bilan.vendu) * 100) === Number(ref.vendu), `B1 ${T} : le vendu du bilan = celui de « Comparer »`, `${bilan.vendu} / ${ref.vendu}`);
          dit(bilan.paires != null && bilan.paires === ref.ventes, `B1 ${T} : les paires vendues = les ventes de « Comparer »`, `${bilan.paires} / ${ref.ventes}`);
          dit((bilan.recu === '' && ref.recu === '') || (bilan.recu !== '' && Math.round(Number(bilan.recu) * 100) === Number(ref.recu)), `B1 ${T} : le reçu du bilan = celui de « Comparer » (« — » des deux côtés si pas su)`, `${bilan.recu} / ${ref.recu}`);
          if (!tel) {
            const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }).catch(() => null), pg.locator('[data-bilan-pdf]').first().click()]);
            let pdf = '';
            if (dl) { const p = await dl.path().catch(() => null); if (p) pdf = fs.readFileSync(p).slice(0, 5).toString('latin1'); }
            dit(pdf === '%PDF-' && dl && /Bilan-\d{4}-\d{2}\.pdf/.test(dl.suggestedFilename()), `B1 ${T} : « Télécharger en PDF » rend un PDF`, `${pdf} ${dl ? dl.suggestedFilename() : 'aucun téléchargement'}`);
          }
          if (SHOTS) { await pg.locator('#compta-bilan').first().scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `bilan-${W}-${th}.png`) }); }
          // D1 — Délai de paiement.
          await pg.evaluate(() => { const d = document.getElementById('compta-delai'); if (d) d.open = true; });
          await pg.waitForTimeout(800);
          const de = await pg.evaluate(() => { const e = document.querySelector('[data-delai-site="Vinted"]'); return e ? { m: e.getAttribute('data-delai-mediane'), n: e.getAttribute('data-delai-n'), txt: e.innerText.replace(/\s+/g, ' ') } : null; });
          dit(!!de && de.m === '2.5' && de.n === '2', `D1 ${T} : délai Vinted = médiane de 2 et 3 jours sur 2 ventes versées`, JSON.stringify(de));
          dit(!!de && /2,5 jours/.test(de.txt) && /2 ventes versées/.test(de.txt), `D1 ${T} : écrit « 2,5 jours », « sur 2 ventes versées »`, de && de.txt);
          if (SHOTS) { await pg.locator('#compta-delai').first().scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `delai-${W}-${th}.png`) }); }
        }
        dit(!o.journal.erreurs.length, `${T} : aucune erreur JS`, o.journal.erreurs.slice(0, 3).join(' ¦ '));
      } catch (e) { dit(false, `${T} : le parcours s'arrête`, e.message); }
      await o.ctx.close();
    }
  } finally {
    await nav.close(); NV.srv.close();
    console.log(ko ? `\n❌ compta-stats-coherence : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ compta-stats-coherence : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
