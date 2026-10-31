// Audit : STATISTIQUES DÉTAILLÉES (src/statsVentes.js, 31 octobre).
//
// On EXÉCUTE les règles pures sur des ventes INVENTÉES (forme réelle : lignes
// de `ventesFaites` { plateforme, ts, eur }, relevé de l'écran Ventes, âges de
// l'écran Annonces) et on compare à des chiffres CALCULÉS À LA MAIN :
//   · le rythme : aujourd'hui, moyenne des 28 jours d'avant (hier compris,
//     aujourd'hui exclu), 7 jours contre les 7 d'avant, panier sur 30 jours,
//     semaines du lundi — bornes à MINUIT LOCAL, y compris à travers le passage
//     à l'heure d'hiver du 25 octobre 2026 (une vente à 0 h 30 ce jour-là) ;
//   · quand tu vends : une date sans heure (minuit pile) n'est dans AUCUNE heure ;
//   · marges par groupe : un prix d'achat inconnu n'est pas 0 € (couverture
//     « sur N »), un frais pas su rend le net « — » (null), un groupe sans aucun
//     prix d'achat n'a ni marge ni bénéfice (null, jamais 0) ;
//   · délai de vente : sans date de mise en ligne, ou republiée après la vente,
//     hors du délai mais dans la couverture ;
//   · stock qui dort (seuils cumulés), rotation, taux de vente, annulations ;
//   · « pas su » : une liste illisible (null) rend null, jamais un zéro.
// `--prouve` rejoue l'audit sur des règles RÉAFFAIBLIES : chacune doit le faire
// passer au rouge.
process.env.TZ = 'Europe/Paris';
const fs = require('fs'), path = require('path'), os = require('os');
const SRC = path.join(__dirname, '..', 'src', 'statsVentes.js');

const MUTATIONS = {
  moyenne_avec_aujourdhui: (s) => s.replace('const avant = somme(L, depuisPremiere ? minuitLocal(premiere) : debut28, m0);', 'const avant = somme(L, depuisPremiere ? minuitLocal(premiere) : debut28, demain);'),
  minuit_en_ms: (s) => s.replace('export const minuitLocal = (ts, k = 0) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + k).getTime(); };', 'export const minuitLocal = (ts, k = 0) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime() + k * J; };'),
  minuit_dans_0h: (s) => s.replace("if (l.heureLue === false || (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0)) sansHeure += 1;", 'if (l.heureLue === false) sansHeure += 1;'),
  achat_inconnu_zero: (s) => s.replace('const connu = l.achat != null && isFinite(Number(l.achat));', 'const connu = true;'),
  frais_inconnu_zero: (s) => s.replace('if (l.frais == null || !isFinite(Number(l.frais))) g.fraisInconnus += 1; else g.frais', 'g.frais'),
  marge_sans_achat_zero: (s) => s.replace('const brut = g.nCout ? (g.caCouvert - g.cout) / 100 : null;', 'const brut = (g.caCouvert - g.cout) / 100;'),
  delai_republiee: (s) => s.replace('if (l.enLigne == null || !isFinite(e) || e <= 0 || l.ts < e) continue;', 'if (l.enLigne == null || !isFinite(e) || e <= 0) continue;'),
  dort_non_cumule: (s) => s.replace('if (Number(a.age) < s) continue;', 'if (Number(a.age) < s || Number(a.age) >= s + 30) continue;'),
  dort_cout_complet: (s) => s.replace("if (a.achat != null && isFinite(Number(a.achat))) { b.nCout += 1;", "{ b.nCout += 1;"),
  periode_entiere: (s) => s.replace('return { type: ty, de, a, prevDe, prevA: de, prevCoupe: Math.min(de, coupe) };', 'return { type: ty, de, a, prevDe, prevA: de, prevCoupe: de };'),
  barre_en_cours_decalee: (s) => s.replace('enCours: maintenant >= de && maintenant < a,', 'enCours: maintenant >= de && maintenant <= a + J,'),
  rapides_du_plus_lent: (s) => s.replace('.sort((a, b) => a.mediane - b.mediane ||', '.sort((a, b) => b.mediane - a.mediane ||'),
  semaine_dimanche: (s) => s.replace("if (ty === 'semaine') { de = minuitLocal(m0, -((d.getDay() + 6) % 7));", "if (ty === 'semaine') { de = minuitLocal(m0, -d.getDay());"),
  passu_zero: (s) => s.replace("export const rythmeVendu = (lignes, maintenant = Date.now()) => {\n  if (!Array.isArray(lignes)) return null;", "export const rythmeVendu = (lignes, maintenant = Date.now()) => {\n  lignes = Array.isArray(lignes) ? lignes : [];"),
};

async function charger(src) {
  const f = path.join(os.tmpdir(), `statsVentes-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

const D = (m, j, h = 12, mi = 0) => new Date(2026, m - 1, j, h, mi).getTime();
const MAINTENANT = D(10, 31, 15);       // samedi 31 octobre 2026, 15 h (heure de Paris)
// Ventes faites (forme de `ventesFaites`).
const VENDU = [
  { plateforme: 'Vinted', ts: D(10, 31, 10), eur: 40 },
  { plateforme: 'Vinted', ts: D(10, 31, 14), eur: 60 },
  { plateforme: 'Vinted', ts: D(10, 30, 9, 30), eur: 50 },
  { plateforme: 'eBay', ts: D(10, 26, 18), eur: 30 },
  { plateforme: 'Vinted', ts: D(10, 25, 0, 30), eur: 10 },        // dimanche du passage à l'heure d'hiver, 0 h 30
  { plateforme: 'Vinted', ts: D(10, 24, 12), eur: 80 },
  { plateforme: 'Leboncoin', ts: D(10, 20, 0), eur: 20 },          // date sans heure (minuit pile)
  { plateforme: 'Vinted', ts: D(10, 5, 11), eur: 70 },
  { plateforme: 'Vinted', ts: D(9, 1, 16), eur: 100 },
  { plateforme: 'Vinted', ts: NaN, eur: 999 },                      // sans date : dans aucune période
];
// Relevé de l'écran Ventes (finalisées).
const RELEVE = [
  { plateforme: 'Vinted', compte: 'atelier', ts: D(10, 2), eur: 60, achat: 20, frais: 2, marque: 'Nike', modele: 'Air Max 90', taille: '42' },
  { plateforme: 'Vinted', compte: 'paris', ts: D(10, 3), eur: 50, achat: null, frais: 0, marque: 'Nike', modele: 'Air Max 90', taille: '43' },
  { plateforme: 'Leboncoin', compte: '', ts: D(10, 4), eur: 70, achat: 30, frais: 0, marque: 'Adidas', modele: 'Samba', taille: '42' },
  { plateforme: 'eBay', compte: '', ts: D(10, 5), eur: 45.5, achat: 25, frais: null, marque: 'Adidas', modele: 'Samba', taille: '41' },
  { plateforme: 'Vinted', compte: 'atelier', ts: D(10, 6), eur: 40, achat: 10, frais: 0, marque: '', modele: '', taille: '' },
];
const DELAIS = [
  { ts: D(10, 11), enLigne: D(10, 1), eur: 25 },
  { ts: D(10, 4), enLigne: D(10, 2), eur: 45 },
  { ts: D(10, 9), enLigne: D(10, 3), eur: 50 },
  { ts: D(10, 9), enLigne: null, eur: 120 },
  { ts: D(10, 9), enLigne: D(10, 15), eur: 50 },                      // republiée après la vente
];
const ANNONCES = [
  { age: 95, prix: 80, achat: 30 }, { age: 65, prix: 50, achat: null }, { age: 31, prix: 40, achat: 15 },
  { age: 10, prix: 60, achat: 20 }, { age: null, prix: 100, achat: 10 },
];

async function audit(M, dire) {
  let ko = 0;
  const ok = (c, msg, vu) => { if (!c) ko += 1; if (dire) console.log(`${c ? '✅' : '❌'} ${msg}${c ? '' : `  → ${JSON.stringify(vu)}`}`); };
  const R = M.rythmeVendu(VENDU, MAINTENANT);
  ok(R && R.jour.n === 2 && R.jour.eur === 100, "aujourd'hui : 2 ventes, 100 €", R && R.jour);
  ok(R && R.moyenne && R.moyenne.jours === 28 && R.moyenne.eur === 9.29 && Math.abs(R.moyenne.n - 6 / 28) < 1e-9 && !R.moyenne.depuisPremiere, 'moyenne : 260 € ÷ 28 jours = 9,29 €/j (aujourd’hui exclu)', R && R.moyenne);
  ok(R && R.j7.n === 5 && R.j7.eur === 190, '7 derniers jours : 5 ventes, 190 € (la vente de 0 h 30 le 25 oct. comprise)', R && R.j7);
  ok(R && R.j7av.n === 2 && R.j7av.eur === 100, '7 jours d’avant : 2 ventes, 100 €', R && R.j7av);
  ok(M.ecartPct(R.j7.eur, R.j7av.eur) === 90, 'semaine contre semaine : +90 %', M.ecartPct(R.j7.eur, R.j7av.eur));
  ok(M.ecartPct(R.jour.eur, R.moyenne.eur) === 976, "aujourd'hui contre la moyenne : +976 %", M.ecartPct(R.jour.eur, R.moyenne.eur));
  ok(R && R.panier30.n === 8 && R.panier30.eur === 360 && R.panier30.moyen === 45, 'panier moyen 30 j : 360 € ÷ 8 = 45 €', R && R.panier30);
  const s = R ? R.semaines : [];
  ok(s.length === 12 && s[11].enCours && s[11].n === 4 && s[11].eur === 180 && s[10].n === 3 && s[10].eur === 110, 'semaines du lundi : en cours 4 / 180 €, la précédente 3 / 110 €', s.slice(-2));
  ok(M.ecartPct(10, 0) === null && M.ecartPct(10, null) === null, 'sans référence : aucun écart (jamais « + ∞ % »)');
  // Moyenne sur moins de 28 jours : dite.
  const R2 = M.rythmeVendu([{ ts: D(10, 28), eur: 30 }, { ts: D(10, 30), eur: 30 }], MAINTENANT);
  ok(R2 && R2.moyenne && R2.moyenne.jours === 3 && R2.moyenne.depuisPremiere && R2.moyenne.eur === 20, 'première vente il y a 3 jours : moyenne sur 3 jours, et dite', R2 && R2.moyenne);
  ok(M.rythmeVendu([{ ts: D(10, 31, 9), eur: 10 }], MAINTENANT).moyenne === null, 'rien avant aujourd’hui : pas de moyenne (null)');

  const Q = M.quandTuVends(VENDU, MAINTENANT);
  const jn = Q ? Q.jours.map((x) => x.n).join(',') : '';
  ok(Q && Q.n === 9 && jn === '2,2,0,0,1,3,1', 'jours de la semaine (lundi → dimanche) : 2,2,0,0,1,3,1', jn);
  ok(Q && Q.jours[5].eur === 180 && Q.jours[1].eur === 120, 'samedi 180 €, mardi 120 €', Q && Q.jours);
  ok(Q && Q.sansHeure === 1 && Q.avecHeure === 8 && Q.heures[0].n === 1, 'la date sans heure n’est dans aucune heure ; 0 h 30 est bien dans « 0 h »', Q && { sansHeure: Q.sansHeure, h0: Q.heures[0] });

  const parMarque = M.margesPar(RELEVE, (l) => l.marque);
  const nike = parMarque && parMarque.groupes.find((g) => g.k === 'Nike');
  const adidas = parMarque && parMarque.groupes.find((g) => g.k === 'Adidas');
  ok(parMarque && parMarque.n === 5 && parMarque.nCout === 4 && parMarque.sansCle === 1, 'couverture : 4 ventes sur 5 avec prix d’achat, 1 sans marque', parMarque && { n: parMarque.n, nCout: parMarque.nCout, sansCle: parMarque.sansCle });
  ok(nike && nike.n === 2 && nike.nCout === 1 && nike.ca === 110 && nike.brut === 40 && nike.net === 38 && nike.marge === 66.7 && nike.parPaire === 40, 'Nike : brut 40 €, net 38 €, marge 66,7 % sur 1 vente au prix connu (sur 2)', nike);
  ok(adidas && adidas.brut === 60.5 && adidas.net === null && adidas.marge === 52.4 && adidas.parPaire === 30.25, 'Adidas : brut 60,50 €, net « — » (frais eBay pas sus), marge 52,4 %', adidas);
  const parTaille = M.margesPar(RELEVE, (l) => l.taille);
  const t42 = parTaille.groupes.find((g) => g.k === '42'), t43 = parTaille.groupes.find((g) => g.k === '43');
  ok(t42 && t42.brut === 80 && t42.net === 78 && t42.marge === 61.5, 'taille 42 : brut 80 €, net 78 €, marge 61,5 %', t42);
  ok(t43 && t43.brut === null && t43.marge === null && t43.parPaire === null && t43.net === null, 'taille 43, aucun prix d’achat : ni bénéfice ni marge (null, jamais 0)', t43);

  const Dl = M.delaisPar(DELAIS, (l) => M.tranchePrix(l.eur));
  const t3060 = Dl && Dl.groupes.find((g) => g.k === '30 à 60 €'), t100 = Dl && Dl.groupes.find((g) => g.k === '100 € et plus');
  ok(Dl && Dl.n === 5 && Dl.nDelai === 3 && Dl.moyenne === 6 && Dl.mediane === 6, 'délai : 3 ventes datées sur 5, moyenne 6 j, médiane 6 j', Dl && { n: Dl.n, nDelai: Dl.nDelai, moyenne: Dl.moyenne, mediane: Dl.mediane });
  ok(t3060 && t3060.n === 3 && t3060.nDelai === 2 && t3060.moyenne === 4, '30 à 60 € : 2 datées sur 3 (une republiée après la vente), 4 j', t3060);
  ok(t100 && t100.nDelai === 0 && t100.moyenne === null, '100 € et plus : aucune date, délai « — »', t100);

  const S = M.stockQuiDort(ANNONCES);
  ok(S && S.total === 5 && S.datesConnues === 4, 'stock : 4 dates connues sur 5 annonces', S && { total: S.total, datesConnues: S.datesConnues });
  ok(S && S.seuils[30].n === 3 && S.seuils[30].valeur === 170 && S.seuils[30].nCout === 2 && S.seuils[30].cout === 45, '≥ 30 j : 3 paires, 170 € affichés, coût connu 45 € sur 2', S && S.seuils[30]);
  ok(S && S.seuils[60].n === 2 && S.seuils[60].valeur === 130 && S.seuils[60].nCout === 1 && S.seuils[90].n === 1 && S.seuils[90].valeur === 80, '≥ 60 j : 2 paires, 130 € ; ≥ 90 j : 1, 80 €', S && S.seuils);
  ok(M.rotationStock(45, 15) === 90 && M.rotationStock(45, 0) === null && M.rotationStock(null, 3) === null, 'rotation : 45 annonces à 15 ventes / 30 j = 90 j ; sans vente : null');
  ok(M.tauxVenteMois(10, 40) === 20 && M.tauxVenteMois(null, 40) === null, 'taux de vente du mois : 10 ÷ (10 + 40) = 20 % ; pas su : null');
  const A = M.tauxAnnulation(['completed', 'completed', 'cancelled', 'pending']);
  ok(A && A.taux === 25 && A.n === 4 && A.annulees === 1, 'annulations : 1 sur 4 = 25 %', A);

  // ── LA PÉRIODE DE LA PAGE (maquette du 31 oct.) — samedi 31 oct. 2026, 15 h ──
  // Mois : octobre 40+60+50+30+10+80+20+70 = 360 € (8) ; septembre AU MÊME JOUR
  //   (jusqu'au 1er oct. 0 h, borne de fin) : 100 € (1) ⇒ +260 %.
  // Semaine : lundi 26 → 30+50+40+60 = 180 € (4) ; la précédente jusqu'au
  //   samedi 24, 15 h : 20 + 80 = 100 € (2) — le 10 € du dimanche 25 n'y est PAS ⇒ +80 %.
  // Année : 460 € (9) ; 2025 rien ⇒ pas d'écart (null).
  const pm = M.venduPeriode(VENDU, M.bornesPeriode('mois', MAINTENANT));
  ok(pm && pm.n === 8 && pm.eur === 360 && pm.prec.n === 1 && pm.prec.eur === 100 && pm.ecart === 260, 'période mois : 360 € (8), septembre 100 € ⇒ +260 %', pm);
  const ps = M.venduPeriode(VENDU, M.bornesPeriode('semaine', MAINTENANT));
  ok(ps && ps.n === 4 && ps.eur === 180 && ps.prec.n === 2 && ps.prec.eur === 100 && ps.ecart === 80, 'période semaine : 180 € (4) contre 100 € au même point (samedi 15 h) ⇒ +80 %', ps);
  const pa = M.venduPeriode(VENDU, M.bornesPeriode('annee', MAINTENANT));
  ok(pa && pa.n === 9 && pa.eur === 460 && pa.prec.n === 0 && pa.ecart === null, 'période année : 460 € (9), 2025 vide ⇒ pas d’écart', pa);
  ok(M.bornesPeriode('n_importe', MAINTENANT).type === 'mois' && M.venduPeriode(null, M.bornesPeriode('mois', MAINTENANT)) === null, 'type inconnu ⇒ mois ; pas lu ⇒ null');
  const bs = M.barresPeriode(VENDU, 'semaine', MAINTENANT);
  ok(bs && bs.map((x) => x.eur).join(',') === '30,0,0,0,50,100,0' && bs.findIndex((x) => x.enCours) === 5 && bs[6].avenir && !bs[5].avenir, 'barres semaine : lun 30 · ven 50 · sam 100 (en cours) · dim à venir', bs && bs.map((x) => [x.eur, x.enCours, x.avenir]));
  const bm = M.barresPeriode(VENDU, 'mois', MAINTENANT);
  ok(bm && bm.length === 8 && bm.map((x) => x.eur).join(',') === '0,0,0,0,70,0,110,180' && bm[7].enCours && bm.filter((x) => x.enCours).length === 1 && bm.map((x) => x.semaine).join(',') === '37,38,39,40,41,42,43,44', 'barres mois : 8 semaines s37→s44, 70 · 110 (dont 0 h 30 du 25) · 180 en cours', bm && bm.map((x) => [x.semaine, x.eur]));
  const ba = M.barresPeriode(VENDU, 'annee', MAINTENANT);
  ok(ba && ba.length === 12 && ba[8].eur === 100 && ba[9].eur === 360 && ba[9].enCours && ba.filter((x) => x.enCours).length === 1 && ba[10].avenir && ba[11].avenir, 'barres année : sept. 100, oct. 360 (en cours), nov.-déc. à venir', ba && ba.map((x) => x.eur));
  ok(M.semaineIso(new Date(2026, 0, 1).getTime()) === 1 && M.semaineIso(new Date(2026, 11, 31).getTime()) === 53 && M.semaineIso(new Date(2027, 0, 3).getTime()) === 53 && M.semaineIso(new Date(2027, 0, 4).getTime()) === 1, 'semaine ISO : 1er janv. 2026 = s1, 31 déc. 2026 et 3 janv. 2027 = s53, 4 janv. 2027 = s1');
  const vp = M.ventesPar(VENDU, (l) => l.plateforme);
  ok(vp && vp.groupes.map((g) => `${g.k}:${g.n}:${g.eur}`).join(' ') === 'Vinted:7:410 eBay:1:30 Leboncoin:1:20' && vp.groupes.reduce((a, g) => a + g.n, 0) === 9, 'par compte/plateforme : Vinted 7 (410 €), eBay 1, Leboncoin 1 — la somme = les 9 ventes datées', vp);
  const rap = M.plusRapides(Dl, 5);
  ok(rap && rap.map((g) => `${g.k}:${g.mediane}`).join(' | ') === '30 à 60 €:4 | moins de 30 €:10', 'ce qui part vite : 4 j puis 10 j ; un groupe sans date n’y est pas', rap);

  ok(M.rythmeVendu(null) === null && M.quandTuVends(null) === null && M.margesPar(null, (l) => l.marque) === null && M.delaisPar(null, () => '') === null && M.stockQuiDort(null) === null && M.tauxAnnulation(null) === null, '« pas su » : une liste illisible rend null partout, jamais 0');
  return ko;
}

(async () => {
  const src = fs.readFileSync(SRC, 'utf8');
  const ko = await audit(await charger(src), true);
  console.log(ko ? `\n❌ audit-stats-ventes : ${ko} rouge(s)` : '\n✅ audit-stats-ventes : tout est vert');
  if (process.argv.includes('--prouve')) {
    let tenus = 0;
    for (const [nom, mut] of Object.entries(MUTATIONS)) {
      const m = mut(src);
      if (m === src) { console.log(`❌ mutation « ${nom} » : le texte visé n'existe plus`); tenus = -999; continue; }
      const k = await audit(await charger(m), false);
      console.log(`${k ? '✅' : '❌'} mutation « ${nom} » ${k ? `rougit l'audit (${k})` : 'PASSE — le contrôle ne la voit pas'}`);
      if (k) tenus += 1;
    }
    const n = Object.keys(MUTATIONS).length;
    console.log(tenus === n ? `\n✅ --prouve : ${n}/${n} mutations rougissent l'audit` : `\n❌ --prouve : ${Math.max(0, tenus)}/${n}`);
    process.exit(ko || tenus !== n ? 1 : 0);
  }
  process.exit(ko ? 1 : 0);
})();
