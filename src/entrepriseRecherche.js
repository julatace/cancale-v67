// ── LA RECHERCHE D'ENTREPRISE PAR SON SIRET — LA RÈGLE PARTAGÉE (9 nov., soir) ──
// Julien : « Sur la facture, quand on remplit le SIRET, le nom, le RCS, le nom de
// l'entreprise se remplissent automatiquement ; ça fait une animation recherche et
// après on demande à la personne de vérifier si les infos sont bonnes. Je veux aussi
// que ce soit pareil lorsqu'on choisit le statut de l'entreprise. »
//
// UNE règle, deux endroits : « Ma facture » (src/FacturePro.jsx) et l'étape statut de
// « Ma configuration » (src/ConfigurationDepart.jsx), par le composant partagé
// src/RechercheEntreprise.jsx. Ce module est PUR (aucun réseau, aucun DOM) :
// scripts/audit-config-facture.cjs l'exécute.
//
// LA SOURCE : celle déjà utilisée depuis le 17 oct. — l'API publique et gratuite, sans
// clé, « Recherche d'entreprises » de l'État (recherche-entreprises.api.gouv.fr),
// appelée par le SERVEUR (`/api/compte?mode=entreprise`, api/_lib/entreprise.js : la
// session d'abord, le SIREN EXACT seulement). Aucune fonction payante (§2.9).
//
// ⚠️ RIEN N'EST ÉCRIT SANS SON GESTE : ce module ne fait que des PROPOSITIONS ; chaque
//    champ porte son cas — `vide` (C'est bon / Modifier), `egal` (déjà juste, rien à
//    faire) ou `ecart` (il a écrit autre chose : Remplacer / Garder la mienne, jamais
//    écrasé sans son accord).
// ⚠️ AUCUNE DONNÉE INVENTÉE :
//    · la forme vient du code de catégorie juridique INSEE (`nature_juridique`) —
//      seulement les codes dont la forme est sûre (1000 EI, 5498 SARL unipersonnelle =
//      EURL, 5499 SARL, 5710 SAS, 5720 SASU ; libellés vérifiés le 9 nov. dans la table
//      officielle de l'Annuaire des entreprises, api-proxy `code-juridiques.ts`) ;
//      micro-entreprise ou réel : le registre ne le dit PAS (c'est un régime, pas une
//      forme) — jamais deviné ;
//    · le n° de TVA intracommunautaire est CALCULÉ depuis le SIREN (clé =
//      (12 + 3 × (SIREN mod 97)) mod 97) et proposé SEULEMENT si le registre (champ
//      `tva`, source DGFiP) porte ce numéro parmi les n° actifs : l'entreprise est
//      assujettie. Liste vide ⇒ rien proposé, et la mention « TVA non applicable,
//      art. 293 B du CGI » est expliquée ; champ absent ⇒ « pas su », rien proposé ;
//    · l'immatriculation (« RCS <ville du greffe> <SIREN> ») : l'API ne donne PAS la
//      ville du greffe ⇒ jamais proposée, la carte dit où la recopier (extrait Kbis) ;
//      inscrite au répertoire des métiers (`activite_principale_registre_metier`) ⇒ dit
//      « RM », sans numéro inventé ;
//    · entreprise introuvable, fermée (cessée) ou établissement fermé ⇒ RIEN proposé, dit.

import { verifierSiret, FORMES, MENTION_FRANCHISE } from './facturePro/regle.js';

export { verifierSiret };

// ── LE N° DE TVA INTRACOMMUNAUTAIRE CALCULÉ (FR + clé + SIREN) ──────────────────
export function cleTvaIntra(siren) {
  const s = String(siren || '').replace(/\D/g, '');
  if (!/^\d{9}$/.test(s)) return '';
  const cle = (12 + 3 * (Number(s) % 97)) % 97;
  return `FR${String(cle).padStart(2, '0')}${s}`;
}

// ── LA FORME, DEPUIS LA CATÉGORIE JURIDIQUE INSEE ───────────────────────────────
// Seulement les codes dont la forme est SÛRE et que la facture connaît (FORMES).
export const FORME_DE_NATURE = { 1000: 'EI', 5498: 'EURL', 5499: 'SARL', 5710: 'SAS', 5720: 'SASU' };
const LIBELLE_NATURE = {
  1000: 'Entrepreneur individuel', 5498: 'SARL unipersonnelle (EURL)', 5499: 'SARL', 5710: 'SAS', 5720: 'SASU',
};
export function formeDeNature(code) {
  const v = FORME_DE_NATURE[String(code || '').trim()];
  return v && FORMES.some((f) => f.v === v) ? v : '';
}
// Le libellé d'une forme (celui de la facture) ; '' si inconnue.
export const libelleForme = (v) => ((FORMES.find((f) => f.v === v) || {}).l) || '';
// Société (personne morale) ? Les codes INSEE 5xxx sont les sociétés commerciales.
export const natureSociete = (code) => /^5\d{3}$/.test(String(code || '').trim());
export const natureEI = (rep) => !!rep && (String(rep.nature || '') === '1000' || rep.ei === true);

// L'adresse du registre est entière (« 8 RUE X 75011 PARIS ») : la rue seule.
export function rueDe(adresse, codePostal) {
  const a = String(adresse || '').replace(/\s+/g, ' ').trim();
  if (!a) return '';
  if (codePostal && a.includes(codePostal)) { const r = a.slice(0, a.lastIndexOf(codePostal)).trim().replace(/[,\s]+$/, ''); return r || a; }
  return a;
}

// ── L'ÉTAT D'UNE RECHERCHE (ce que la carte dit) ────────────────────────────────
// `rep` : la réponse de chercherEntreprise ({ etat: 'trouve'|'inconnu'|'passu'|'invalide', … })
// → 'trouve' | 'inconnu' | 'passu' | 'ferme' | 'etab-ferme' | 'etab-inconnu'.
export function etatRecherche(rep) {
  if (!rep || rep.etat === 'passu' || rep.etat === 'invalide') return 'passu';
  if (rep.etat === 'inconnu') return 'inconnu';
  if (rep.etat !== 'trouve') return 'passu';
  if (rep.fermeUnite === true || (rep.fermeUnite == null && rep.ferme === true && !rep.etabFerme)) return 'ferme';
  if (rep.etabFerme === true) return 'etab-ferme';
  return 'trouve';
}

const propre = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const meme = (a, b) => propre(a).toLowerCase() === propre(b).toLowerCase();

// Les CHAMPS proposés (ceux de `vrm_pro_facture`). `actuel` : la fiche telle qu'elle est.
// Rend { etat, lignes: [{ champ, label, valeur, affiche, actuel, cas }], notes: [{ cle, texte }] }.
//   cas : 'vide' (le champ est vide) · 'egal' (déjà juste) · 'ecart' (il a écrit autre chose).
export const LIBELLES_CHAMPS = {
  siret: 'SIRET', nom: 'Nom ou raison sociale', forme: 'Forme', adresse: 'Adresse', codePostal: 'Code postal', ville: 'Ville', tva: 'N° de TVA intracommunautaire',
};
export function propositionsEntreprise(rep, actuel = {}, { avecSiret = false, saisi = '' } = {}) {
  const etat = etatRecherche(rep);
  const notes = [];
  if (etat !== 'trouve') return { etat, lignes: [], notes };
  const a = actuel && typeof actuel === 'object' ? actuel : {};
  const prop = [];
  const pousse = (champ, valeur, affiche) => { if (propre(valeur)) prop.push({ champ, valeur: propre(valeur), affiche: affiche || propre(valeur) }); };
  if (avecSiret) pousse('siret', String(saisi || rep.siret || rep.siren || '').replace(/\D/g, ''));
  pousse('nom', rep.nom);
  const forme = formeDeNature(rep.nature);
  if (forme) pousse('forme', forme, libelleForme(forme));
  else if (rep.nature) notes.push({ cle: 'forme', texte: `Forme : catégorie juridique ${rep.nature}${LIBELLE_NATURE[rep.nature] ? ` (${LIBELLE_NATURE[rep.nature]})` : ''}, que la facture ne connaît pas — choisis-la à la main.` });
  if (rep.etabTrouve !== false && propre(rep.adresse)) {
    pousse('adresse', rueDe(rep.adresse, rep.codePostal));
    if (/^\d{5}$/.test(propre(rep.codePostal))) pousse('codePostal', rep.codePostal);
    pousse('ville', rep.ville);
  } else notes.push({ cle: 'adresse', texte: 'Adresse : cet établissement n’est pas dans la réponse du registre — écris-la à la main.' });
  // TVA : seulement si le registre (DGFiP) porte le n° calculé parmi les n° actifs.
  const calc = cleTvaIntra(rep.siren);
  if (Array.isArray(rep.tva)) {
    const actifs = rep.tva.map((x) => String(x || '').replace(/\s/g, '').toUpperCase());
    if (calc && actifs.includes(calc)) pousse('tva', calc);
    else if (actifs.length) notes.push({ cle: 'tva', texte: 'TVA : le registre porte un n° de TVA qui ne correspond pas au calcul depuis ton SIREN — recopie-le de ton espace impots.gouv.' });
    else notes.push({ cle: 'tva', texte: `TVA : aucun n° de TVA actif au registre. Si tu es en franchise, ta facture porte « ${MENTION_FRANCHISE} » (choisis « Franchise de TVA »).` });
  } else notes.push({ cle: 'tva', texte: 'TVA : le registre ne l’a pas dit — VRM ne remplit rien.' });
  // L'immatriculation : jamais proposée (la ville du greffe n'est pas dans le registre public).
  if (rep.rm === true) notes.push({ cle: 'rcs', texte: 'Immatriculation : ton entreprise est inscrite au répertoire des métiers (RM). Recopie ton n° RM tel qu’il est sur ton extrait D1.' });
  else if (natureSociete(rep.nature)) notes.push({ cle: 'rcs', texte: `Immatriculation : le registre public ne donne pas la ville de ton greffe. Recopie « RCS <ville> ${String(rep.siren || '').replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')} » de ton extrait Kbis.` });
  else if (natureEI(rep)) notes.push({ cle: 'rcs', texte: 'Immatriculation : à écrire seulement si tu es inscrit au RCS ou au RM (ton extrait le dit). Sinon, laisse vide.' });
  if (natureEI(rep)) notes.push({ cle: 'regime', texte: 'Entrepreneur individuel : micro-entreprise ou réel, le registre ne le dit pas.' });
  const lignes = prop.map((p) => {
    const av = propre(a[p.champ]);
    const egal = p.champ === 'siret' ? av.replace(/\D/g, '') === p.valeur : p.champ === 'tva' ? av.replace(/\s/g, '').toUpperCase() === p.valeur : meme(av, p.valeur);
    return { ...p, label: LIBELLES_CHAMPS[p.champ] || p.champ, actuel: av, cas: !av ? 'vide' : egal ? 'egal' : 'ecart' };
  });
  return { etat, lignes, notes };
}

// Ce qu'un geste écrit : seulement le champ touché (jamais les autres).
// `decision` : 'ok' (vide → valeur) · 'remplacer' (écart → valeur) · 'garder' / 'modifier' (rien).
export function ecritureDecision(ligne, decision) {
  if (!ligne) return null;
  if (decision === 'ok' && ligne.cas === 'vide') return { [ligne.champ]: ligne.valeur };
  if (decision === 'remplacer' && ligne.cas === 'ecart') return { [ligne.champ]: ligne.valeur };
  return null;
}
// « Tout est bon » : SEULEMENT les champs vides (un écart demande toujours son geste à lui).
export function ecritureToutVide(lignes) {
  const out = {};
  for (const l of lignes || []) if (l && l.cas === 'vide') out[l.champ] = l.valeur;
  return out;
}

// ── POUR « MA CONFIGURATION » : le statut que le registre permet de PROPOSER ─────
// Société (catégorie 5xxx) ⇒ « Société » proposé (jamais posé sans son « C'est bon »).
// Entrepreneur individuel ⇒ rien proposé : micro ou réel, le registre ne le dit pas.
// Rend { statut: 'societe' | null, forme, texte }.
export function statutProposeEntreprise(rep) {
  if (etatRecherche(rep) !== 'trouve') return { statut: null, forme: '', texte: '' };
  const forme = formeDeNature(rep.nature);
  if (natureSociete(rep.nature)) return { statut: 'societe', forme, texte: `Le registre dit : ${forme ? libelleForme(forme) : `société (catégorie ${rep.nature})`}.` };
  if (natureEI(rep)) return { statut: null, forme: 'EI', texte: 'Le registre dit : entrepreneur individuel. Micro-entreprise ou réel, il ne le dit pas : c’est toi qui choisis.' };
  return { statut: null, forme: '', texte: '' };
}
