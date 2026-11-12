import { moisParis } from './dateParis.js';
// ═══════════════════════════════════════════════════════════════════════════
// COMPARER DEUX MOIS (4 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : ce mois face au mois d'avant, ou au même mois l'an dernier (son
// choix) — ventes, CA vendu, reçu, bénéfice ; l'écart en € et en %.
//
// AUCUNE RÈGLE ICI (§11) : chaque chiffre vient de sa règle propriétaire,
// passée par l'app —
//   · ventes et CA vendu = les lignes de `ventesFaites` (date de la VENTE),
//     comptées par `bilanLignes` sur le mois (heure de l'appareil, la borne de
//     Ma journée et de Statistiques) ;
//   · reçu = la ligne publiée `vinted_urssaf_mois` (`ventesDeclarables`, date de
//     VERSEMENT), lue par `recuDe(ym)` ;
//   · bénéfice = `beneficePeriode` du mois + `chiffreBenefice`, lu par
//     `beneficeDe` (la colonne « Bénéfice » du récap mensuel) ; au même point,
//     les ventes jusqu'à la coupe (`jusqua`), les dépenses du mois entier.
// Trois états (§5) : `valeur: null` = pas su (« — ») ; `partiel` = un minimum
// (« au moins »), le manque NOMMÉ. L'écart ne se calcule que si les DEUX côtés
// sont complets : un écart contre un minimum serait un faux (« — »).
// Exécuté par scripts/audit-comparer-mois.cjs.

export const ymDe = (t) => moisParis(t);   // (11 nov.) mois de PARIS
export const ymDecale = (ym, k) => {
  const [y, m] = String(ym).split('-').map(Number);
  const d = new Date(y, m - 1 + k, 1);
  return ymDe(d.getTime());
};
// Le mois d'en face : « precedent » (le mois d'avant) ou « an » (le même mois l'an dernier).
export const ymEnFace = (ym, mode) => ymDecale(ym, mode === 'an' ? -12 : -1);
export const bornesMois = (ym) => {
  const [y, m] = String(ym).split('-').map(Number);
  return { de: new Date(y, m - 1, 1).getTime(), a: new Date(y, m, 1).getTime() };
};

// (10 nov., lot BL) L'ordre de Julien : vendu, reçu, bénéfice, ventes, achats.
const LIGNES = [
  { cle: 'vendu', nom: 'CA vendu', type: 'eur' },
  { cle: 'recu', nom: 'Reçu', type: 'eur' },
  { cle: 'benefice', nom: 'Bénéfice', type: 'eur' },
  { cle: 'ventes', nom: 'Ventes', type: 'n' },
  // (11 nov., décision C5 — Julien : « tranche ») Les PAIRES achetées (pièces), pas les achats :
  // un lot de 3 compte 3. Le nombre d'achats s'écrit en petit à côté (`achats`).
  { cle: 'paires', nom: 'Paires', type: 'n' },
];

const pasSu = (raison) => ({ valeur: null, partiel: false, manque: [], raison });

// Les deux côtés, AU MÊME POINT quand ce mois est en cours (la règle de
// Statistiques, `prevCoupe` : « un mois commencé ne se compare pas à un mois
// entier ») : du 1er à maintenant, face au 1er du mois d'en face → le même
// quantième, à la même heure (borné à la fin de ce mois-là).
export const bornesComparees = (ymA, ymB, maintenant = Date.now()) => {
  const A = bornesMois(ymA), B = bornesMois(ymB);
  if (maintenant < A.de || maintenant < B.de) return null;   // un mois à venir ne se compare pas
  const enCoursA = maintenant < A.a, enCoursB = maintenant < B.a;
  if (!enCoursA && !enCoursB) return { A: { ...A, complet: true }, B: { ...B, complet: true }, memePoint: false };
  // (10 nov., lot BL) Deux mois CHOISIS : celui qui est en cours (A ou B) coupe l'autre au même quantième.
  const t = new Date(maintenant);
  const couper = (ym, b) => { const [y, m] = String(ym).split('-').map(Number); const coupe = new Date(y, m - 1, t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds()).getTime(); return { de: b.de, a: Math.min(b.a, coupe), complet: coupe >= b.a }; };
  const cote = (ym, b, enCours) => (enCours ? { de: b.de, a: maintenant, complet: false } : couper(ym, b));
  return { A: cote(ymA, A, enCoursA), B: cote(ymB, B, enCoursB), memePoint: true };
};

// Le vendu entre deux instants (nombre et montant), par la règle de « Vendu ».
const venduEntre = (V, b, R) => {
  if (!V || V.enAttente || !Array.isArray(V.lignes)) return { ventes: pasSu('pasSu'), vendu: pasSu('pasSu') };
  const r = R.bilanLignes(V.lignes, b.de, b.a - 1);
  const nc = (V.nonComptees || []).filter((x) => x && x.ts != null && x.ts >= b.de && x.ts < b.a);
  const manque = [...new Set([...(V.manque || []), ...nc.map((x) => x.plateforme)])];
  const partiel = manque.length > 0;
  // « Au moins 0 » ne se dit jamais (§5).
  const un = (v) => (partiel && !(v > 0) ? pasSu('partiel') : { valeur: v, partiel, manque, raison: '' });
  return { ventes: un(r.n), vendu: un(r.eur) };
};

const cote = (x) => (x && typeof x === 'object' ? { valeur: x.valeur == null ? null : x.valeur, partiel: !!x.partiel, manque: x.manque || [], raison: x.valeur == null ? (x.raison || 'pasSu') : '',
  ...(x.n != null ? { n: x.n, nCout: x.nCout } : {}) } : pasSu('pasSu'));

// (10 nov., lot BL) Les ACHATS entre deux instants : les lignes du REGISTRE DES ACHATS du mois
// (`registreDesAchats`, src/registres.js — la carte « Registres » et l'export comptable : achats
// Vinted hors annulés, achats hors plateforme, achats en gros ; comptes écartés exclus), datées.
// Rien de recompté : on garde celles de l'intervalle. Achats Vinted pas lus ⇒ « au moins » (jamais
// « au moins 0 ») ; des achats SANS date (dans aucun mois) ⇒ « au moins » aussi, nommés.
export const achatsEntre = (reg, b) => {
  if (reg === undefined) return pasSu('encours');
  if (!reg || !Array.isArray(reg.lignes)) return pasSu('pasSu');
  const n = reg.lignes.filter((l) => l && l.ts != null && l.ts >= b.de && l.ts < b.a).length;
  const sansDate = Array.isArray(reg.horsPeriode) ? reg.horsPeriode.length : 0;
  const manque = [...(reg.manque || []).filter((m) => m !== 'reçus d’achat'), ...(sansDate ? [`${sansDate} achat${sansDate > 1 ? 's' : ''} sans date`] : [])];
  const partiel = manque.length > 0;
  return partiel && !(n > 0) ? { ...pasSu('partiel'), manque } : { valeur: n, partiel, manque, raison: '' };
};

// (11 nov., décision C5) LES PAIRES d'une ligne du registre des achats :
//   · achat en gros : SON nombre de paires (saisi par lui, `paires`) ;
//   · achat hors plateforme : une fiche = une paire ;
//   · achat Vinted : `nombreDe(ligne)` — la règle des lots de l'écran Achats (src/achatsSourcing.js :
//     `estLot`/`nombreLot` — titre « Lot 3 … », `items_count` de SA transaction, lot déclaré par lui).
//     Un lot dont le nombre n'est écrit nulle part ⇒ `null` : compté pour 1 (le minimum sûr), et
//     le total devient « au moins », le manque nommé (« 1 lot sans nombre »). Jamais deviné.
export const pairesDeLigne = (l, nombreDe = null) => {
  if (!l) return null;
  if (l.gros) { const n = parseInt(String(l.paires || ''), 10); return Number.isInteger(n) && n >= 1 ? n : null; }
  if (l.plateforme === 'Vinted') { if (typeof nombreDe !== 'function') return 1; const n = nombreDe(l); return n == null ? null : Number.isInteger(n) && n >= 1 ? n : null; }
  return 1;
};
export const pairesEntre = (reg, b, nombreDe = null) => {
  const A = achatsEntre(reg, b);
  if (A.valeur == null) return { ...A, achats: null };
  const lignes = reg.lignes.filter((l) => l && l.ts != null && l.ts >= b.de && l.ts < b.a);
  let p = 0, sansNombre = 0;
  for (const l of lignes) { const n = pairesDeLigne(l, nombreDe); if (n == null) { sansNombre += 1; p += 1; } else p += n; }
  const manque = [...A.manque, ...(sansNombre ? [`${sansNombre} lot${sansNombre > 1 ? 's' : ''} sans nombre`] : [])];
  return { valeur: p, partiel: manque.length > 0, manque, raison: '', achats: A.valeur };
};

// → { ymA, ymB, memePoint, bornes, lignes: [{ cle, nom, type, a, b, ecart, pct }] }
//   a = ce mois, b = le mois d'en face. `recuDe({ de, a, ym, complet })` et
//   `beneficeDe({ ym, jusqua })` (jusqua : null = le mois entier).
export function comparerMois({ ymA, mode = 'precedent', ...reste } = {}) {
  const K = comparerDeuxMois({ ymA, ymB: ymEnFace(ymA, mode), ...reste });
  return K ? { ...K, mode } : null;
}
// (10 nov., lot BL) Deux mois CHOISIS par lui (deux sélecteurs) ; `achatsDe({ de, a, ym, complet })`
// rend le registre des achats du mois (facultatif : sans lui, « — »).
// `nombreDe(ligne)` (facultatif) : le nombre de paires d'un achat Vinted (null = lot sans nombre).
export function comparerDeuxMois({ ymA, ymB, maintenant = Date.now(), vendu, recuDe, beneficeDe, achatsDe, nombreDe = null, R } = {}) {
  const bornes = bornesComparees(ymA, ymB, maintenant);
  if (!bornes) return null;
  const vA = venduEntre(vendu, bornes.A, R), vB = venduEntre(vendu, bornes.B, R);
  const recu = (ym, b) => cote(recuDe && recuDe({ de: b.de, a: b.a, ym, complet: b.complet }));
  const benef = (ym, b) => cote(beneficeDe && beneficeDe({ ym, jusqua: b.complet ? null : b.a }));
  const paires = (ym, b) => (typeof achatsDe === 'function' ? pairesEntre(achatsDe({ de: b.de, a: b.a, ym, complet: b.complet }), b, nombreDe) : { ...pasSu('pasSu'), achats: null });
  const val = {
    ventes: [vA.ventes, vB.ventes],
    vendu: [vA.vendu, vB.vendu],
    recu: [recu(ymA, bornes.A), recu(ymB, bornes.B)],
    benefice: [benef(ymA, bornes.A), benef(ymB, bornes.B)],
    paires: [paires(ymA, bornes.A), paires(ymB, bornes.B)],
  };
  const lignes = LIGNES.map((L) => {
    const [a, b] = val[L.cle];
    const complets = a.valeur != null && b.valeur != null && !a.partiel && !b.partiel;
    const ecart = complets ? (L.type === 'eur' ? Math.round((a.valeur - b.valeur) * 100) / 100 : a.valeur - b.valeur) : null;
    // Un pourcentage contre zéro ou contre un négatif ne veut rien dire : « — ».
    const pct = complets && b.valeur > 0 ? Math.round(((a.valeur - b.valeur) / b.valeur) * 1000) / 10 : null;
    // La flèche (neutre) : seulement avec un écart, donc deux côtés sus ET complets.
    const sens = ecart == null ? null : ecart > 0 ? 'hausse' : ecart < 0 ? 'baisse' : 'egal';
    return { ...L, a, b, ecart, pct, sens };
  });
  const mode = ymB === ymEnFace(ymA, 'precedent') ? 'precedent' : ymB === ymEnFace(ymA, 'an') ? 'an' : 'libre';
  return { ymA, ymB, mode, memePoint: bornes.memePoint, bornes, lignes };
}
