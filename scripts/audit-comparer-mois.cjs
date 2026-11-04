// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : COMPARER DEUX MOIS — CHAQUE CHIFFRE PAR SA RÈGLE, AU MÊME POINT
//         node scripts/audit-comparer-mois.cjs [--mutation=coupe|partiel|pct0|jours|jusqua]
// ═══════════════════════════════════════════════════════════════════════════
// Julien (4 nov.) : ce mois face au mois d'avant ou au même mois l'an dernier —
// ventes, CA vendu, reçu, bénéfice, écart en € et en %, « — » si un côté n'est
// pas su. Statistiques l'a déjà dit (31 oct.) : « un mois commencé ne se compare
// pas à un mois entier » — un mois en cours se compare AU MÊME POINT.
//
// L'audit EXÉCUTE src/comparerMois.js avec les vraies fonctions d'App.jsx
// (`bilanLignes`, `beneficePeriode` et ses dépendances, `beneficeDuMoisPub`) et
// la lecture du reçu publié (`recuPublieEntre`, src/design/carteChiffres.js), sur
// des ventes INVENTÉES, et compare à un calcul fait ici à la main.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!c || process.env.BAVARD) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
let APP = lire('src/App.jsx');
let MODULE = lire('src/comparerMois.js');
let CARTE = lire('src/design/carteChiffres.js');
const muter = (quoi, avant, apres) => {
  const src = quoi === 'app' ? APP : quoi === 'carte' ? CARTE : MODULE;
  if (!src.includes(avant)) { console.log('❌ mutation impossible : motif absent — ' + avant.slice(0, 90)); process.exit(2); }
  if (quoi === 'app') APP = APP.replace(avant, apres); else if (quoi === 'carte') CARTE = CARTE.replace(avant, apres); else MODULE = MODULE.replace(avant, apres);
};
if (MUT === 'coupe') muter('m', "if (!(maintenant < A.a)) return { A: { ...A, complet: true }, B: { ...B, complet: true }, memePoint: false };", "return { A: { ...A, complet: true }, B: { ...B, complet: true }, memePoint: false };");
else if (MUT === 'partiel') muter('m', 'const complets = a.valeur != null && b.valeur != null && !a.partiel && !b.partiel;', 'const complets = a.valeur != null && b.valeur != null;');
else if (MUT === 'pct0') muter('m', 'const pct = complets && b.valeur > 0 ?', 'const pct = complets ?');
else if (MUT === 'jours') muter('carte', "valeur = Object.entries(publie.recuJours).reduce((t, [k, v]) => (k >= k0 && k <= k1 ? t + Math.round(Number(v) * 100) : t), 0) / 100;", "valeur = Number((publie.recu || {})[ym] || 0);");
else if (MUT === 'jusqua') muter('app', "const v = beneficeDesJours(jours, de, finJ && finJ < a ? finJ : a);", "const v = beneficeDesJours(jours, de, a);");
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
function extraire(src, nom) {
  const m = new RegExp(`^(?:export )?(?:async )?function ${nom}\\(|^(?:export )?const ${nom}\\s*=\\s*`, 'm').exec(src);
  if (!m) return '';
  const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}
const charger = async (texte, nom) => {
  const tmp = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, texte.replace(/from '\.\.\/([^']+)'/g, (m, f) => `from 'file://${path.join(R, 'src', f)}'`).replace(/from '\.\/([^']+)'/g, (m, f) => `from 'file://${path.join(R, 'src', f)}'`));
  try { return await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
};
const proche = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.005);

(async () => {
  console.log('── Le module, les règles d’App.jsx, la lecture du reçu');
  let M = null; try { M = await charger(MODULE, 'comparer'); if (typeof M.comparerMois !== 'function') M = null; } catch (_) { M = null; }
  dit(!!M, 'src/comparerMois.js exporte `comparerMois`');
  let K = null; try { K = await charger(CARTE, 'carte'); } catch (_) { K = null; }
  dit(!!(K && typeof K.recuPublieEntre === 'function'), 'la carte des chiffres lit le reçu entre deux instants (`recuPublieEntre`)');
  const N = await charger(lire('src/beneficeNoms.js'), 'noms');
  const NOMS = ['BENEF_CHAMPS', 'beneficeVide', 'ajouterVenteBenefice', 'jourBeneficeEnTableau', 'cumulerBenefice', 'resumeBenefice', 'jourClef', 'beneficeDesJours',
    'ymCourant', 'debutPeriode', 'decalerPeriode', 'MOIS_COMPTA', 'libellePeriodeCa', 'echeancesAbonnement', 'chargeAbonnement', 'comptaChargesMois', 'comptaChargesAnnee',
    'caVintedDuMois', 'caBeneficeDuMois', 'aPayerUrssaf', 'depensesEtat', 'beneficePeriode', 'bilanLignes', 'beneficeDuMoisPub'];
  const ctx = { Date, Math, Number, String, Object, Array, JSON, isFinite, parseFloat, isNaN, tauxUrssaf: () => 12.4, urssafConcerne: () => true, console,
    moisCouvertParPublication: N.moisCouvertParPublication, finDuMois: N.finDuMois };
  vm.createContext(ctx);
  const absents = [];
  for (const n of NOMS) { const t = extraire(APP, n); if (!t) { absents.push(n); continue; } try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (e) { absents.push(n + ' (' + e.message + ')'); } }
  dit(!absents.length, 'les règles se lisent dans App.jsx', absents.join(', '));

  if (M && K && !absents.length) {
    // ── Données inventées : maintenant = mercredi 4 novembre 2026, 10 h (heure de l'appareil).
    const MAINT = new Date(2026, 10, 4, 10).getTime();
    const T = (y, m, j, h = 12) => new Date(y, m, j, h).getTime();
    const lignes = [
      { plateforme: 'Vinted', ts: T(2026, 10, 1), eur: 60 }, { plateforme: 'eBay', ts: T(2026, 10, 3), eur: 40 }, { plateforme: 'Vinted', ts: T(2026, 10, 4, 8), eur: 25 },
      { plateforme: 'Vinted', ts: T(2026, 9, 2), eur: 50 }, { plateforme: 'Vinted', ts: T(2026, 9, 4, 9), eur: 30 }, { plateforme: 'Vinted', ts: T(2026, 9, 4, 18), eur: 90 }, { plateforme: 'Vinted', ts: T(2026, 9, 20), eur: 200 },
      { plateforme: 'Vinted', ts: T(2025, 10, 2), eur: 45 }, { plateforme: 'Vinted', ts: T(2025, 10, 15), eur: 80 },
    ];
    const vendu = { lignes, manque: [], nonComptees: [] };
    // Le reçu publié (forme de `vinted_urssaf_mois`) : par mois ET par jour.
    const recuJours = { '2026-11-02': 38, '2026-11-04': 12, '2026-10-01': 20, '2026-10-04': 15, '2026-10-05': 70, '2026-10-25': 100, '2025-11-03': 33 };
    const ligneU = { mois: [], recu: { '2026-11': 50, '2026-10': 205, '2025-11': 33 }, recuJours, sources: { vinted: 'lu', leboncoin: 'lu', ebay: 'lu', vestiaire: 'lu' }, at: MAINT - 3600000 };
    // Le bénéfice publié (forme de `vrm_benefice_jours`) : vente, achat, frais par jour.
    const jours = {};
    const vend = (t, eur, achat) => { const k = ctx.jourClef(new Date(t)); const acc = jours[k] ? null : ctx.beneficeVide(); const a = acc || ctx.beneficeVide(); if (jours[k]) { ctx.cumulerBenefice(a, jours[k]); } ctx.ajouterVenteBenefice(a, eur, achat, 0); jours[k] = ctx.jourBeneficeEnTableau(a); };
    vend(T(2026, 10, 1), 60, 20); vend(T(2026, 10, 3), 40, 10); vend(T(2026, 9, 2), 50, 20); vend(T(2026, 9, 4), 30, 10); vend(T(2026, 9, 20), 200, 100);
    const pub = { v: 2, jours };
    const compta = { depenses: [{ date: '2026-10-10', montant: 15 }, { date: '2026-11-02', montant: 5 }], fixes: [], packs: [], abonnements: [] };
    const RG = { bilanLignes: ctx.bilanLignes };
    const recuDe = (b) => K.recuPublieEntre(ligneU, b, MAINT);
    const beneficeDe = ({ ym, jusqua }) => { const B = ctx.beneficeDuMoisPub({ pub, compta, ligneUrssaf: ligneU, regime: 'micro' }, ym, jusqua); return B ? N.chiffreBenefice(B, 'lu') : { valeur: null }; };
    // beneficePeriode borne « maintenant » au vrai Date.now : le vm le prend du monde réel ; on fige Date.now.
    const vraiNow = Date.now; ctx.Date = class extends Date { static now() { return MAINT; } };
    vm.runInContext('this.Date = Date', ctx);
    Date.now = () => MAINT;

    console.log('── Un mois en cours, face au mois d’avant : au même point');
    const C1 = M.comparerMois({ ymA: '2026-11', mode: 'precedent', maintenant: MAINT, vendu, recuDe, beneficeDe, R: RG });
    const L = (C, cle) => C.lignes.find((x) => x.cle === cle);
    dit(C1.memePoint === true && C1.ymB === '2026-10', 'novembre en cours ⇒ comparé à octobre au même point');
    dit(L(C1, 'ventes').a.valeur === 3 && L(C1, 'ventes').b.valeur === 2, 'ventes : 3 (1er→4 nov. 10 h) face à 2 (1er→4 oct. 10 h — pas la vente de 18 h, pas le 20)', `${L(C1, 'ventes').a.valeur} / ${L(C1, 'ventes').b.valeur}`);
    dit(proche(L(C1, 'vendu').a.valeur, 125) && proche(L(C1, 'vendu').b.valeur, 80), 'CA vendu : 125 € face à 80 €', `${L(C1, 'vendu').a.valeur} / ${L(C1, 'vendu').b.valeur}`);
    dit(proche(L(C1, 'vendu').ecart, 45) && L(C1, 'vendu').pct === 56.3, 'écart : +45 € et +56,3 %', `${L(C1, 'vendu').ecart} / ${L(C1, 'vendu').pct}`);
    dit(proche(L(C1, 'recu').a.valeur, 50) && proche(L(C1, 'recu').b.valeur, 35), 'reçu (date de versement) : 50 € (2 et 4 nov.) face à 35 € (1er→4 oct.)', `${L(C1, 'recu').a.valeur} / ${L(C1, 'recu').b.valeur}`);
    // À la main : novembre = (60−20)+(40−10) − 5 € de dépenses − 12,4 % de 100 € ; octobre au 4 = (50−20)+(30−10) − 15 € − 12,4 % de 80 €.
    const bA = Math.round(((60 - 20) + (40 - 10) - 5 - 12.4) * 100) / 100, bB = Math.round(((50 - 20) + (30 - 10) - 15 - 9.92) * 100) / 100;
    dit(proche(L(C1, 'benefice').a.valeur, bA) && proche(L(C1, 'benefice').b.valeur, bB), `bénéfice : ${bA} € face à ${bB} € (octobre coupé au 4, ses dépenses du mois comptées)`, `${L(C1, 'benefice').a.valeur} / ${L(C1, 'benefice').b.valeur}`);

    console.log('── Le même mois l’an dernier');
    const C2 = M.comparerMois({ ymA: '2026-11', mode: 'an', maintenant: MAINT, vendu, recuDe, beneficeDe, R: RG });
    dit(C2.ymB === '2025-11' && L(C2, 'ventes').b.valeur === 1 && proche(L(C2, 'vendu').b.valeur, 45), 'novembre 2025 au 4 : 1 vente, 45 € (pas celle du 15)');
    dit(proche(L(C2, 'recu').b.valeur, 33), 'reçu de novembre 2025 au 4 : 33 €');
    dit(L(C2, 'benefice').b.valeur == null && L(C2, 'benefice').ecart == null, 'bénéfice de novembre 2025 : la publication ne le couvre pas ⇒ « — », pas d’écart');

    console.log('── Deux mois entiers');
    const MDEC = new Date(2026, 11, 15, 10).getTime();
    const C3 = M.comparerMois({ ymA: '2026-11', mode: 'precedent', maintenant: MDEC, vendu, recuDe: (b) => K.recuPublieEntre({ ...ligneU, at: MDEC - 1000 }, b, MDEC), beneficeDe: () => null, R: RG });
    dit(C3.memePoint === false && L(C3, 'ventes').b.valeur === 4 && proche(L(C3, 'vendu').b.valeur, 370), 'novembre fini face à octobre entier : 4 ventes, 370 €');
    dit(proche(L(C3, 'recu').b.valeur, 205), 'reçu d’octobre entier = la ligne publiée du mois (205 €)');

    console.log('── Trois états');
    const C4 = M.comparerMois({ ymA: '2026-11', mode: 'precedent', maintenant: MAINT, vendu: { ...vendu, manque: ['eBay'] }, recuDe, beneficeDe, R: RG });
    dit(L(C4, 'vendu').a.partiel && L(C4, 'vendu').ecart == null && L(C4, 'vendu').pct == null, 'eBay pas lu ⇒ « au moins », et aucun écart contre un minimum');
    const C5 = M.comparerMois({ ymA: '2026-11', mode: 'precedent', maintenant: MAINT, vendu: null, recuDe: () => null, beneficeDe, R: RG });
    dit(L(C5, 'vendu').a.valeur == null && L(C5, 'recu').a.valeur == null, 'ventes pas lues, reçu pas publié ⇒ « — », jamais 0');
    const vZero = { lignes: lignes.filter((l) => !(l.ts >= T(2026, 9, 1) && l.ts < T(2026, 9, 5))), manque: [], nonComptees: [] };
    const C6 = M.comparerMois({ ymA: '2026-11', mode: 'precedent', maintenant: MAINT, vendu: vZero, recuDe, beneficeDe, R: RG });
    dit(L(C6, 'vendu').b.valeur === 0 && L(C6, 'vendu').pct == null && proche(L(C6, 'vendu').ecart, 125), 'face à 0 € : l’écart en €, pas de % (contre zéro, un % ne veut rien dire)');
    dit(K.recuPublieEntre({ ...ligneU, recuJours: undefined }, { de: T(2026, 10, 1, 0), a: MAINT, ym: '2026-11', complet: false }, MAINT).valeur == null, 'publication sans reçu par jour (app plus ancienne) ⇒ « — » au même point');
    dit(K.recuPublieEntre({ ...ligneU, at: MAINT - 5 * 86400000 }, { de: 0, a: 1, ym: '2026-10', complet: true }, MAINT).valeur == null, 'publication de plus de 3 jours ⇒ « — »');
    Date.now = vraiNow;
  }

  console.log('── Le branchement');
  const A0 = sansCommentaires(APP);
  dit(/<ComparerMoisCarte liveStats=\{liveStats\}\/>/.test(A0), 'Statistiques monte « Comparer » sous le choix de période');
  dit(/recuDe: \(b\) => recuPublieEntre\(ligneUrssaf, b, maintenant\)/.test(A0) && /beneficeDuMoisPub\(\{ pub, compta, ligneUrssaf, regime \}, ym, jusqua\)/.test(A0) && /R: \{ bilanLignes \}/.test(A0), 'avec les règles propriétaires (reçu publié, bénéfice du mois, bilanLignes)');
  dit((A0.match(/beneficeDuMoisPub\(\{ pub: pubB, compta: comptaB, ligneUrssaf: v, regime: regimeB \}, ym\)/g) || []).length === 2, 'le récap mensuel lit le bénéfice par la MÊME fonction');
  dit(/recuJours\[k\] = r2\(\(recuJours\[k\] \|\| 0\) \+ l\.eur\)/.test(A0) && /recu, recuJours, nonComptees \}/.test(A0), 'Ventes publie le reçu jour par jour, des mêmes lignes');
  console.log(`\n${ko ? '❌' : '✅'} audit-comparer-mois : ${ok} vert(s), ${ko} rouge(s)${MUT ? ' [mutation ' + MUT + ']' : ''}`);
  process.exit(ko ? 1 : 0);
})();
