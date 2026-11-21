// ════════════════════════════════════════════════════════════════════════════
//  MODÈLE DE CHARGE À N VENDEURS (9 nov., chantier « charge-sauvegarde »)
//  Aucune lecture de la production : les coûts unitaires viennent du CODE,
//  mesurés au banc local (scripts/charge/banc-charge.cjs, base inventée au poids
//  de celle de Julien), les usages sont des HYPOTHÈSES écrites ici (à corriger
//  avec les vrais journaux quand ils existent). Quotas lus le 9 nov. 2026 sur
//  supabase.com/pricing, vercel.com/pricing, vercel.com/docs/limits,
//  vercel.com/docs/cron-jobs/usage-and-pricing.
//  Lancer : node scripts/charge/modele.cjs [--avant] [--json]
//    --avant : les coûts unitaires d'origin/main (avant ce chantier).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const AVANT = process.argv.includes('--avant');

// ── Coûts unitaires MESURÉS (Ko envoyés par la base, requêtes) — vendeur « gros »
//    (7 comptes, l'historique de Julien). Un vendeur « type » = `PART_TYPE` de ça.
const U = {
  ouvertureApp: { Ko: 2117, req: 89 },                         // 2e ouverture Ma journée (banc _app.cjs)
  widget: { Ko: AVANT ? 717 : 73, req: AVANT ? 23 : 21 },        // un rafraîchissement
  cronMatin: { Ko: AVANT ? 1290 : 560, req: 110 },               // hors lundi (bilan) ; lundi : +730 Ko
  cronLundiEnPlus: { Ko: 730 },
  cronSoir: { Ko: AVANT ? 886 : 161, req: 41 },
  email: { Ko: 7, req: 15, registreKoParVendeur: 0.37 },        // + 0,37 Ko × N par e-mail (ancienne voie)
  extensionJour: { Ko: 5000, req: 2600 },                       // ESTIMÉ (relais 30 s, battement 1 min, captures)
  appFondJour: { Ko: 6000, req: 2500 },                         // ESTIMÉ (relectures périodiques, src/rythmeLectures.js)
  stockageMo: 14 + 0.2 * 37,                                    // JSON hors PDF + 20 % des PDF (purge des finalisées)
};
// ── Usages (HYPOTHÈSES) par vendeur ACTIF et par jour.
const H = {
  PART_TYPE: 0.35,          // un vendeur type pèse ~1/3 de Julien (2-3 comptes)
  ouvertures: 6,            // téléphone + ordinateur
  partWidget: 0.5, rafraichissementsWidget: 48,
  emails: 15, partAncienneVoieEmail: process.argv.includes('--adresse-unique') ? 0 : 1,   // tant que DOMAINE_RECEPTION n'est pas posé : tous (--adresse-unique : aucun)
  invocationsApp: 120,      // /api/* depuis l'app et l'extension (mesures, push, relais, commandes léger…)
  cpuSecParInvocation: 0.04, cpuSecCronParVendeur: 0.6,
  compressionDisque: 0.6,   // TOAST (pglz) + index + gonflement : Mo disque / Mo JSON
};
// ── Quotas (lus le 9 nov. 2026).
const Q = {
  supabaseProDisqueGo: 8, supabaseProEgressGo: 250, supabaseFichiersGo: 100,
  vercelHobbyInvocations: 1e6, vercelHobbyCpuH: 4, vercelHobbyTransfertGo: 100,
  vercelProInvocations: null /* payé à l'usage, 0,60 $ / M */, cronBudgetS: 240, cronParVendeurS: 0.3,
};
const P = { supaPro: 25, disqueGo: 0.125, egressGo: 0.09, computeSmall: 15, vercelPro: 20, invocM: 0.6, cpuH: 0.128, brevo: 9 };

function parVendeurJour(N) {
  const k = H.PART_TYPE;
  const egressKo =
    k * (H.ouvertures * U.ouvertureApp.Ko + U.appFondJour.Ko + U.extensionJour.Ko + U.cronMatin.Ko + U.cronLundiEnPlus.Ko / 7 + U.cronSoir.Ko
      + H.partWidget * H.rafraichissementsWidget * U.widget.Ko)
    + H.emails * (U.email.Ko + H.partAncienneVoieEmail * U.email.registreKoParVendeur * N);
  const req = H.ouvertures * U.ouvertureApp.req + U.appFondJour.req + U.extensionJour.req + U.cronMatin.req + U.cronSoir.req
    + H.partWidget * H.rafraichissementsWidget * U.widget.req + H.emails * U.email.req;
  const invocations = H.partWidget * H.rafraichissementsWidget + H.emails + H.invocationsApp;
  const cpuS = invocations * H.cpuSecParInvocation + H.cpuSecCronParVendeur;
  return { egressKo, req, invocations, cpuS };
}
function bilan(N) {
  const v = parVendeurJour(N);
  const egressGoMois = (v.egressKo * N * 30) / 1024 / 1024;
  const disqueGo = (U.stockageMo * H.PART_TYPE * H.compressionDisque * N) / 1024 + 0.3;
  const invocMois = v.invocations * N * 30 + 144 * 30 /* sondes /statut */;
  const cpuHMois = (v.cpuS * N * 30) / 3600;
  const reqS = (v.req * N) / 86400;
  const cronS = N * Q.cronParVendeurS;
  const coutSupa = P.supaPro + Math.max(0, disqueGo - Q.supabaseProDisqueGo) * P.disqueGo + Math.max(0, egressGoMois - Q.supabaseProEgressGo) * P.egressGo + (reqS > 30 ? P.computeSmall : 0);
  const coutVercel = P.vercelPro + Math.max(0, invocMois / 1e6 * P.invocM + cpuHMois * P.cpuH - P.vercelPro);
  return { N, egressGoMois: +egressGoMois.toFixed(1), disqueGo: +disqueGo.toFixed(1), invocMois: Math.round(invocMois), cpuHMois: +cpuHMois.toFixed(1), reqS: +reqS.toFixed(1), cronS: Math.round(cronS),
    coutSupa: Math.round(coutSupa), coutVercel: Math.round(coutVercel), coutTotal: Math.round(coutSupa + coutVercel + (N >= 100 ? P.brevo : 0)) };
}
function seuil(f) { let n = 1; while (n < 100000 && !f(bilan(n))) n++; return n >= 100000 ? null : n; }
const seuils = {
  'Supabase Pro égress 250 Go/mois': seuil((b) => b.egressGoMois > Q.supabaseProEgressGo),
  'Supabase Pro disque 8 Go': seuil((b) => b.disqueGo > Q.supabaseProDisqueGo),
  'Supabase Micro (≈ 30 req/s soutenues)': seuil((b) => b.reqS > 30),
  'Vercel Hobby 1 M invocations/mois': seuil((b) => b.invocMois > Q.vercelHobbyInvocations),
  'Vercel Hobby 4 h CPU actif/mois': seuil((b) => b.cpuHMois > Q.vercelHobbyCpuH),
  'Cron (une fonction, 240 s de budget)': seuil((b) => b.cronS > Q.cronBudgetS),
};
const lignes = [100, 500, 1000].map(bilan);
if (process.argv.includes('--json')) console.log(JSON.stringify({ avant: AVANT, seuils, lignes }, null, 1));
else {
  console.log(`Modèle ${AVANT ? 'AVANT (origin/main)' : 'APRÈS ce chantier'} — vendeur type = ${H.PART_TYPE} × Julien`);
  for (const [k, n] of Object.entries(seuils)) console.log(`  casse à ≈ ${n ?? '> 100 000'} vendeurs : ${k}`);
  console.table(lignes);
}
module.exports = { bilan, seuils, U, H, Q };
