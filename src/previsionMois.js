// ════════════════════════════════════════════════════════════════════════════
//  LA PRÉVISION DU MOIS (11 nov., lot agent2-argent-parrainage — validé par Julien)
//  « À ce rythme, tu finiras novembre vers 1 900 € de ventes (sur 18 jours lus) ».
//  Module PUR : il ne lit rien, il range ce que le propriétaire a publié (§11) :
//    · VENDU = `liveStats.venduLignes` (`ventesFaites` : ventes PROUVÉES, date de la
//      vente, toutes plateformes, comptes sélectionnés) — la règle de « Vendu » ;
//      ce qui manque = `venduManque` (une plateforme / un compte pas lu) et
//      `venduNonComptees` (vendue, argent pas lu) : la prévision est alors
//      « partielle » et NOMME le manque — jamais présentée comme complète.
//    · LE RYTHME = le vendu du mois ÷ le temps écoulé depuis le 1er (minuit local),
//      prolongé jusqu'à la fin du mois. Rien d'autre : pas de saison, pas d'objectif.
//    · LA FOURCHETTE = la dispersion RÉELLE des jours pleins du mois (écart type des
//      sommes par jour) : incertitude des jours qui restent + celle du rythme lui-même
//      (qui diminue avec le nombre de jours lus). ±1,28 écart type (≈ 8 chances sur 10).
//      Le bas ne descend jamais sous ce qui est déjà vendu.
//    · MOINS DE 5 JOURS PLEINS ⇒ « pas encore su » (etat 'tot'), aucun chiffre.
//    · LE BÉNÉFICE BRUT (vente − prix d'achat, src/beneficeNoms.js) n'est prévu que si
//      les prix d'achat couvrent assez les ventes finalisées DU MOIS (relevé
//      `vrm_stats_ventes` de l'écran Ventes) : au moins 5 ventes ET 80 % au prix
//      connu. Sinon : la couverture « N sur M », jamais « au moins » devant un
//      bénéfice (une paire au prix inconnu peut être vendue à perte).
//  Exécuté par scripts/audit-prevision-mois.cjs (données inventées, --prouve).
// ════════════════════════════════════════════════════════════════════════════
const J = 86400000;
export const PREVISION_JOURS_MIN = 5;
export const PREVISION_BENEF_N_MIN = 5;
export const PREVISION_BENEF_COUV = 0.8;
export const PREVISION_Z = 1.28;
const AUTRES = new Set(['Leboncoin', 'eBay', 'Vestiaire']);
const cts = (x) => (x == null || String(x).trim() === '' || !isFinite(Number(x)) ? null : Math.round(Number(x) * 100));
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// Arrondi lisible (en centimes) : « vers 1 900 € », jamais « 1 873,42 € » — un rythme n'a pas de centimes.
export const pasArrondi = (c) => { const e = Math.abs(c) / 100; return (e < 200 ? 5 : e < 1000 ? 10 : e < 5000 ? 50 : 100) * 100; };
const rond = (c, sens = 0) => { const p = pasArrondi(c); return (sens < 0 ? Math.floor(c / p) : sens > 0 ? Math.ceil(c / p) : Math.round(c / p)) * p; };

// vendu : lignes `ventesFaites` ({ plateforme, ts, eur }) | null (pas lu) | undefined (lecture) ;
// manque : `venduManque` ; nonComptees : `venduNonComptees` ; releve : lignes de
// `vrm_stats_ventes` ([plateforme, compte, id, ts, vente, achat, frais, …]) | null.
export function previsionMois({ vendu, manque = [], nonComptees = [], releve = null, maintenant = Date.now() } = {}) {
  const d = new Date(maintenant);
  const de = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const a = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  const joursMois = Math.round((a - de) / J);
  const ecoule = Math.max(0, (maintenant - de) / J);
  const jours = Math.floor(ecoule + 1e-9);
  const base = { mois: MOIS[d.getMonth()], de, a, joursMois, jours, cumul: null, n: 0, centre: null, bas: null, haut: null,
    partiel: false, manques: [], nNonComptees: 0, benef: { etat: 'releve', centre: null, bas: null, haut: null, nConnu: 0, n: 0 } };
  if (vendu === undefined) return { ...base, etat: 'encours' };
  if (vendu === null || !Array.isArray(vendu)) return { ...base, etat: 'passu' };
  const man = (Array.isArray(manque) ? manque : []).map(String).filter((m) => m && m !== 'lecture en cours');
  const enCours = (Array.isArray(manque) ? manque : []).includes('lecture en cours');
  const manques = [];
  for (const m of man) manques.push(AUTRES.has(m) ? `${m} pas lu` : `compte ${m} pas lu`);
  if (enCours) manques.push('lecture en cours');
  const nc = (Array.isArray(nonComptees) ? nonComptees : []).filter((x) => x && Number.isFinite(x.ts) && x.ts >= de && x.ts < a).length;
  if (nc) manques.push(`${nc} vente${nc > 1 ? 's' : ''} au montant pas lu`);
  // Le vendu du mois, et par jour PLEIN (le jour en cours n'entre pas dans la dispersion).
  const parJour = new Array(jours).fill(0);
  let cumul = 0, n = 0;
  for (const l of vendu) {
    if (!l || !Number.isFinite(l.ts) || l.ts < de || l.ts >= Math.min(a, maintenant + 1)) continue;
    const c = cts(l.eur); if (c == null) continue;
    cumul += c; n += 1;
    const k = Math.floor((new Date(l.ts).getTime() - de) / J);
    // Le jour LOCAL (un passage à l'heure d'hiver ne déplace pas une vente de jour).
    const dl = new Date(l.ts); const kLocal = Math.round((new Date(dl.getFullYear(), dl.getMonth(), dl.getDate()).getTime() - de) / J);
    const j = Number.isFinite(kLocal) ? kLocal : k;
    if (j >= 0 && j < jours) parJour[j] += c;
  }
  const P = { ...base, cumul, n: n + nc, nNonComptees: nc, partiel: manques.length > 0, manques };
  if (jours < PREVISION_JOURS_MIN) return { ...P, etat: 'tot', joursManquants: PREVISION_JOURS_MIN - jours };
  if (cumul <= 0) return { ...P, etat: 'rien' };
  // Le rythme : ce qui est vendu ÷ le temps écoulé (jour en cours compris, à sa fraction).
  const rythme = cumul / ecoule;
  const reste = Math.max(0, joursMois - ecoule);
  const centreBrut = cumul + rythme * reste;
  // La dispersion des jours pleins (écart type corrigé).
  const moy = parJour.reduce((s, x) => s + x, 0) / jours;
  const v = jours > 1 ? parJour.reduce((s, x) => s + (x - moy) * (x - moy), 0) / (jours - 1) : 0;
  const sd = Math.sqrt(Math.max(0, reste * v + (reste * reste * v) / jours));
  const centre = rond(centreBrut);
  const bas = Math.max(rond(cumul, -1), rond(centreBrut - PREVISION_Z * sd));
  const haut = Math.max(centre, rond(centreBrut + PREVISION_Z * sd));
  const out = { ...P, etat: 'ok', centre, bas: Math.min(bas, centre), haut, rythmeJour: Math.round(rythme), sd: Math.round(sd) };
  out.benef = beneficePrevu(releve, de, a, { centre: centreBrut, bas: centreBrut - PREVISION_Z * sd, haut: centreBrut + PREVISION_Z * sd, cumul });
  return out;
}

// Le bénéfice BRUT prévu : la marge brute des ventes finalisées du mois AU PRIX CONNU,
// appliquée au vendu prévu — seulement si la couverture suffit.
export function beneficePrevu(releve, de, a, v) {
  if (!Array.isArray(releve)) return { etat: 'releve', centre: null, bas: null, haut: null, nConnu: 0, n: 0 };
  let n = 0, nConnu = 0, cV = 0, cB = 0;
  for (const l of releve) {
    if (!Array.isArray(l)) continue;
    const t = Number(l[3]);
    if (!Number.isFinite(t) || t < de || t >= a) continue;
    const e = cts(l[4]); if (e == null) continue;
    n += 1;
    const ach = cts(l[5]);
    if (ach == null) continue;
    nConnu += 1; cV += e; cB += e - ach;
  }
  if (!n) return { etat: 'aucune', centre: null, bas: null, haut: null, nConnu, n };
  if (nConnu < PREVISION_BENEF_N_MIN || nConnu / n < PREVISION_BENEF_COUV || !(cV > 0)) return { etat: 'couverture', centre: null, bas: null, haut: null, nConnu, n, brut: nConnu ? cB : null };
  const taux = cB / cV;
  const f = (x) => rond(x * taux);
  const lo = f(Math.max(v.cumul, v.bas)), hi = f(v.haut);
  return { etat: 'ok', taux: Math.round(taux * 1000) / 10, centre: f(v.centre), bas: Math.min(lo, hi), haut: Math.max(lo, hi), nConnu, n };
}

// « 1 900 € » (centimes ronds) ; null ⇒ « — ».
export const eurosRonds = (c) => (c == null || !Number.isFinite(c) ? '—' : `${Math.round(c / 100).toLocaleString('fr-FR')} €`);

// Ce que les écrans écrivent (une seule source pour Ma journée et Statistiques).
export function textePrevision(P) {
  if (!P) return { ligne: null, titre: '', grand: '—', sous: '', manque: '' };
  const titre = `Fin de ${P.mois}, à ce rythme`;
  const manque = P.manques.length ? `sans ${P.manques.join(', ')}` : '';
  if (P.etat === 'encours') return { ligne: null, titre, grand: '—', sous: 'Je lis tes ventes…', manque: '' };
  if (P.etat === 'passu') return { ligne: null, titre, grand: '—', sous: 'Tes ventes n’ont pas pu être lues.', manque: '' };
  if (P.etat === 'tot') return { ligne: null, titre, grand: '—', sous: `Pas encore su : il faut ${PREVISION_JOURS_MIN} jours de ventes.`, manque };
  if (P.etat === 'rien') return { ligne: null, titre, grand: '—', sous: 'Aucune vente lue ce mois-ci.', manque };
  const jours = `sur ${P.jours} jour${P.jours > 1 ? 's' : ''} lus`;
  const fourchette = P.bas < P.haut ? `entre ${eurosRonds(P.bas).replace(/ €$/, '')} et ${eurosRonds(P.haut)}` : '';
  return {
    titre, grand: `vers ${eurosRonds(P.centre)}`, sous: [fourchette, jours].filter(Boolean).join(' · '), manque,
    ligne: `À ce rythme, ${P.mois} finira vers ${eurosRonds(P.centre)}`,
  };
}
