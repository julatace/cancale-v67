// ═══════════════════════════════════════════════════════════════════════════
// « MOIS BOUCLÉ » (10 nov., lot BK) — Argent → Déclarer
// ═══════════════════════════════════════════════════════════════════════════
// Julien (validé, peu de texte, du visuel) : pour le mois choisi, la liste de ce
// qui manque avant de déclarer — ventes sans date de versement, prix d'achat pas
// saisis des ventes du mois, comptes pas relus, frais inconnus —, chaque ligne
// avec son nombre et la porte qui ouvre l'endroit où le régler ; tout réglé :
// « Novembre est prêt à déclarer » + le montant à déclarer.
//
// AUCUNE RÈGLE ICI (§5 « une règle par notion ») — ce fichier RANGE ce que les
// propriétaires ont déjà dit, passés par l'app :
//   · le montant du mois  = `montantPeriodeUrssaf` (la ligne PUBLIÉE par Ventes,
//                           `vinted_urssaf_mois`, datée au VERSEMENT) sur une
//                           période d'UN mois — la règle de la carte « Prochaine
//                           déclaration », du rappel et du serveur ;
//   · « à dater »         = `ligne.aDater.n` (la même publication ; c'est ce qui
//                           fait de ce montant un minimum) — rien n'est décidé
//                           sur elles (choix de Julien en attente) ;
//   · prix d'achat, frais = `beneficeDesJours` sur `vrm_benefice_jours` (n − nCout,
//                           `fraisInconnus`), la publication du bénéfice ;
//   · comptes pas relus   = la ligne de fraîcheur unique (src/fraicheur.js,
//                           `fraicheurUnique`), publiée par son écran ;
//   · « déclaré »         = le registre `vrm_urssaf_declare` (`moisDeclare`),
//                           écrit sur SON clic seulement.
// « Pas su » ne vaut jamais « oui » (§5) : une source pas lue ⇒ la ligne dit « — »
// et le mois n'est JAMAIS « prêt ». Prêt = toutes les lignes lues à zéro ET le
// montant du mois lu complet (pas « au moins »).
// Exécuté par scripts/audit-mois-boucle.cjs.

export const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const nomMois = (ym) => { const m = Number(String(ym).slice(5, 7)); return MOIS[m - 1] || ''; };
export const NomMois = (ym) => { const n = nomMois(ym); return n.charAt(0).toUpperCase() + n.slice(1); };

// La période d'échéance d'UN mois (la forme de `nextUrssafDeadline`).
export const dueDuMois = (ym) => {
  if (!YM.test(String(ym || ''))) return null;
  const [y, m] = String(ym).split('-').map(Number);
  return { periodStart: new Date(y, m - 1, 1), periodEnd: new Date(y, m, 0), label: `${nomMois(ym)} ${y}` };
};
export const bornesDuMois = (ym) => { const [y, m] = String(ym).split('-').map(Number); return { de: new Date(y, m - 1, 1), a: new Date(y, m, 1) }; };
export const moisFini = (ym, maintenant = Date.now()) => maintenant >= bornesDuMois(ym).a.getTime();

// Les comptes que la ligne de fraîcheur nomme « pas relus » (ventes, annonces ;
// en panne). Trois états : undefined en cours · { etat:'passu' } · { etat:'lu', n }.
export function comptesDeFraicheur(f) {
  if (f === undefined || (f && f.etat === 'encours')) return { etat: 'encours', n: null, noms: [] };
  if (!f || typeof f !== 'object' || f.etat === 'cache') return { etat: 'passu', n: null, noms: [], raison: f && f.raison ? f.raison : 'pasSu' };
  if (Array.isArray(f.passu) && f.passu.includes('l’extension')) return { etat: 'passu', n: null, noms: [], raison: 'extension' };
  const vus = new Map();
  for (const r of (Array.isArray(f.retards) ? f.retards : [])) {
    if (!r || !(r.source === 'compte' || r.source === 'panne')) continue;
    if (String(r.cle || '').startsWith('achats:')) continue;   // les ACHATS d'un compte : pas le chiffre déclaré
    vus.set(`${r.plateforme}:${r.id}`, r.nom);
  }
  return { etat: 'lu', n: vus.size, noms: [...vus.values()] };
}

// Une ligne de la liste : { cle, etat:'ok'|'manque'|'passu'|'encours', n, raison }.
const ligneDe = (cle, n, extra = {}) => ({ cle, etat: n > 0 ? 'manque' : 'ok', n, raison: '', ...extra });
const pasLu = (cle, raison) => ({ cle, etat: 'passu', n: null, raison });
const enCours = (cle) => ({ cle, etat: 'encours', n: null, raison: '' });

// Entrées (celles de l'écran ; rien n'est relu ici) :
//   ym          le mois choisi (AAAA-MM)
//   ligne       `vinted_urssaf_mois` | null (pas publiée) | undefined (en cours)
//   declare     le registre `vrm_urssaf_declare` | undefined (pas encore lu)
//   joursBenef  `vrm_benefice_jours` | null | undefined
//   fraicheur   le résultat publié de `fraicheurUnique` | undefined
//   taux        le taux URSSAF (pour `montantPeriodeUrssaf`)
//   R           { montantPeriodeUrssaf, moisDeclare, beneficeDesJours, moisCouvert }
export function moisBoucle({ ym, maintenant = Date.now(), ligne, declare, joursBenef, fraicheur, taux, R } = {}) {
  const due = dueDuMois(ym);
  if (!due) return null;
  const lignes = [];
  // 1. Les ventes sans date de versement (dans AUCUN mois tant qu'elles ne sont pas datées).
  if (ligne === undefined) lignes.push(enCours('adater'));
  else if (!ligne || !Array.isArray(ligne.mois)) lignes.push(pasLu('adater', 'absente'));
  else lignes.push(ligneDe('adater', ligne.aDater && Number(ligne.aDater.n) > 0 ? Number(ligne.aDater.n) : 0));
  // 2 et 4. Les prix d'achat et les frais des ventes du mois (la publication du bénéfice).
  let B = null;
  if (joursBenef === undefined) { lignes.push(enCours('prix')); }
  else if (!joursBenef || !joursBenef.jours) lignes.push(pasLu('prix', 'publication'));
  else if (typeof R.moisCouvert === 'function' && !R.moisCouvert(ym, maintenant)) lignes.push(pasLu('prix', 'mois pas couvert'));
  else {
    const b = bornesDuMois(ym);
    B = R.beneficeDesJours(joursBenef.jours, b.de, b.a);
    lignes.push(ligneDe('prix', Math.max(0, (Number(B.n) || 0) - (Number(B.nCout) || 0)), { sur: Number(B.n) || 0 }));
  }
  // 3. Les comptes pas relus récemment (la ligne de fraîcheur).
  const C = comptesDeFraicheur(fraicheur);
  if (C.etat === 'encours') lignes.push(enCours('comptes'));
  else if (C.etat === 'passu') lignes.push(pasLu('comptes', C.raison));
  else lignes.push(ligneDe('comptes', C.n, { noms: C.noms }));
  // 4. Les frais inconnus (la même publication que les prix).
  if (joursBenef === undefined) lignes.push(enCours('frais'));
  else if (!B) lignes.push(pasLu('frais', lignes.find((l) => l.cle === 'prix').raison));
  else lignes.push(ligneDe('frais', Number(B.fraisInconnus) || 0));

  // Le montant du mois, par la règle de la déclaration.
  const fini = moisFini(ym, maintenant);
  let montant = null;
  if (ligne && Array.isArray(ligne.mois)) {
    const M = R.montantPeriodeUrssaf(due, ligne, taux);
    montant = { ca: M.ca, partiel: !!M.partiel };
  }
  if (!fini) lignes.push({ cle: 'fini', etat: 'manque', n: null, raison: '', jusqua: due.periodEnd.getTime() });
  else if (ligne && Array.isArray(ligne.mois)) {
    // Un montant pas su, ou un minimum que les lignes au-dessus n'expliquent pas
    // (ventes au montant pas lu, calcul fait avant la fin du mois) : dit, jamais tu.
    const ad = lignes.find((l) => l.cle === 'adater');
    if (montant.ca == null) lignes.push(pasLu('montant', 'absente'));
    else if (montant.partiel && !(ad && ad.n > 0)) {
      const nc = ligne.nonComptees && Number(ligne.nonComptees.n) > 0 ? Number(ligne.nonComptees.n) : 0;
      lignes.push({ cle: 'montant', etat: 'manque', n: nc || null, raison: nc ? 'nonComptees' : 'avantFin' });
    }
  }

  const deja = declare && typeof declare === 'object' ? R.moisDeclare(declare, ym) : false;
  let etat;
  if (declare === undefined) etat = 'encours';
  else if (deja) etat = 'declare';
  else if (lignes.some((l) => l.etat === 'encours')) etat = 'encours';
  else if (lignes.some((l) => l.etat === 'passu')) etat = 'passu';
  else if (lignes.some((l) => l.etat === 'manque')) etat = 'manque';
  else if (montant && montant.ca != null && !montant.partiel) etat = 'pret';
  else etat = 'passu';
  const aRegler = lignes.filter((l) => l.etat === 'manque').length;
  return { ym, nom: NomMois(ym), etat, lignes, aRegler, fini, montant: etat === 'pret' || etat === 'declare' ? montant : null };
}

// Les mois qu'on peut choisir : le mois en cours et les 12 d'avant (le plus récent d'abord).
export const moisChoisissables = (maintenant = Date.now(), n = 13) => {
  const out = []; const d = new Date(maintenant); d.setDate(1);
  for (let i = 0; i < n; i++) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); d.setMonth(d.getMonth() - 1); }
  return out;
};
// Le mois proposé d'abord : le dernier mois FINI (celui qu'on déclare).
export const moisParDefaut = (maintenant = Date.now()) => moisChoisissables(maintenant, 2)[1];
