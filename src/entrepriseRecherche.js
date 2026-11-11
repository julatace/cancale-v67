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

// ════════════════════════════════════════════════════════════════════════════
//  « C'EST BIEN TOI ? » (11 nov., lot DJ1)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « quand je remplis le numéro de SIRET, je veux que quand je valide ça
// cherche le RCS, je veux que le visuel soit mieux » ; « pareil lorsqu'on choisit le
// statut de l'entreprise ». La recherche part à la VALIDATION (Entrée, sortie du champ,
// ou « Rechercher »), jamais à chaque chiffre tapé ; elle s'arrête à 8 s
// (`DELAI_RECHERCHE_MS`, « pas trouvé à temps : remplis à la main ») ; puis UNE carte
// « C'est bien toi ? » : tout ce que le registre dit, « Oui, c'est moi » (écrit, tout
// reste modifiable) / « Non, corriger » (n'écrit rien).
// ⚠️ Rien n'est inventé : la ville du greffe n'est pas dans le registre public ⇒ le RCS
//    d'une société est « RCS <ville que TU recopies de ton Kbis> <SIREN> » ; sans ville,
//    rien n'est écrit pour le RCS. Un entrepreneur individuel : « pas de RCS au registre
//    public (EI au RNE) », rien écrit.
export const DELAI_RECHERCHE_MS = 8000;

// Les catégories juridiques INSEE en mots — libellés de la table officielle de
// l'Annuaire des entreprises (api-proxy `code-juridiques.ts`, relue le 9 nov.).
// Seulement pour les MONTRER ; la forme écrite sur la facture reste `formeDeNature`.
export const NATURE_EN_MOTS = {
  1000: 'Entrepreneur individuel (EI)', 5202: 'Société en nom collectif (SNC)', 5306: 'Société en commandite simple',
  5308: 'Société en commandite par actions', 5485: "Société d'exercice libéral à responsabilité limitée (SELARL)",
  5498: 'SARL unipersonnelle (EURL)', 5499: 'Société à responsabilité limitée (SARL)', 5599: "SA à conseil d'administration",
  5699: 'SA à directoire', 5710: 'Société par actions simplifiée (SAS)', 5720: 'SAS unipersonnelle (SASU)',
  6540: 'Société civile immobilière (SCI)', 6599: 'Société civile', 9220: 'Association déclarée',
};
export const natureEnMots = (code) => NATURE_EN_MOTS[String(code || '').trim()] || (code ? `Catégorie juridique ${code}` : '');
// Immatriculée au RCS : sociétés commerciales (5xxx) et « autre personne morale
// immatriculée au RCS » (6xxx, sociétés civiles) — les familles 5 et 6 de la table INSEE.
export const natureAuRcs = (code) => /^[56]\d{3}$/.test(String(code || '').trim());
export const sirenGroupe = (siren) => String(siren || '').replace(/\D/g, '').replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
// « RCS Rennes 123 456 789 » — seulement avec une ville (écrite par LUI) et un SIREN de 9 chiffres.
export function rcsDe(villeGreffe, siren) {
  const v = propre(villeGreffe).replace(/^rcs\s+/i, '');
  const s = sirenGroupe(siren);
  if (!v || !/^\d{3} \d{3} \d{3}$/.test(s) || /\d/.test(v)) return '';
  return `RCS ${v.replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase())} ${s}`;
}
// L'immatriculation que le registre permet de DIRE (jamais inventée).
//   'rcs' : immatriculée au RCS, ville du greffe à recopier · 'rm' : répertoire des métiers ·
//   'ei'  : entrepreneur individuel sans RCS au registre public · '' : pas su.
export function immatriculation(rep) {
  if (!rep || rep.etat !== 'trouve') return { cas: '', texte: '' };
  if (natureAuRcs(rep.nature)) return { cas: 'rcs', texte: `RCS · ${sirenGroupe(rep.siren)}`, aide: 'Ville du greffe : recopie-la de ton Kbis.' };
  if (rep.rm === true) return { cas: 'rm', texte: 'Répertoire des métiers (RM)', aide: 'Recopie ton n° RM de ton extrait D1.' };
  if (natureEI(rep)) return { cas: 'ei', texte: 'Pas de RCS au registre public (EI au RNE)' };
  return { cas: '', texte: '' };
}

// Les lignes de la carte. Chaque ligne : { cle, label, affiche, champ?, valeur?, cas? }.
//   `champ` absent ⇒ ligne pour vérifier seulement (rien n'est écrit : nom commercial, APE…).
//   cas : 'vide' · 'egal' · 'ecart' (il a écrit autre chose : par défaut on GARDE le sien).
export function ficheIdentite(rep, actuel = {}, { avecSiret = false, saisi = '', villeGreffe = '' } = {}) {
  const etat = etatRecherche(rep);
  if (etat !== 'trouve') return { etat, lignes: [], imm: { cas: '', texte: '' }, tvaNote: '' };
  const a = actuel && typeof actuel === 'object' ? actuel : {};
  const L = [];
  const champ = (cle, label, valeur, affiche) => {
    const v = propre(valeur); if (!v) return;
    const av = propre(a[cle]);
    const egal = cle === 'siret' ? av.replace(/\D/g, '') === v : cle === 'tva' ? av.replace(/\s/g, '').toUpperCase() === v : meme(av, v);
    L.push({ cle, champ: cle, label, valeur: v, affiche: affiche || v, actuel: av, cas: !av ? 'vide' : egal ? 'egal' : 'ecart' });
  };
  const info = (cle, label, affiche) => { if (propre(affiche)) L.push({ cle, label, affiche: propre(affiche) }); };
  if (avecSiret) champ('siret', 'SIRET', String(saisi || rep.siret || rep.siren || '').replace(/\D/g, ''));
  champ('nom', 'Dénomination', rep.nom);
  if (rep.nomCommercial && !meme(rep.nomCommercial, rep.nom)) info('nomCommercial', 'Nom commercial', rep.nomCommercial);
  const forme = formeDeNature(rep.nature);
  if (forme) champ('forme', 'Forme juridique', forme, natureEnMots(rep.nature));
  else info('forme', 'Forme juridique', natureEnMots(rep.nature));
  if (rep.etabTrouve !== false && propre(rep.adresse)) {
    champ('adresse', 'Adresse', rueDe(rep.adresse, rep.codePostal));
    if (/^\d{5}$/.test(propre(rep.codePostal))) champ('codePostal', 'Code postal', rep.codePostal);
    champ('ville', 'Ville', rep.ville);
  }
  const imm = immatriculation(rep);
  if (imm.cas === 'rcs') {
    const r = rcsDe(villeGreffe, rep.siren);
    if (r) champ('rcs', 'Immatriculation', r);
  }
  info('ape', 'Code APE', rep.ape);
  const calc = cleTvaIntra(rep.siren);
  let tvaNote = '';
  if (Array.isArray(rep.tva)) {
    const actifs = rep.tva.map((x) => String(x || '').replace(/\s/g, '').toUpperCase());
    if (calc && actifs.includes(calc)) champ('tva', 'N° de TVA', calc);
    else if (actifs.length) tvaNote = 'TVA : le n° du registre ne correspond pas à ton SIREN. Recopie-le de impots.gouv.';
    else tvaNote = `Pas de TVA au registre : « ${MENTION_FRANCHISE} ».`;
  } else tvaNote = 'TVA : le registre ne le dit pas.';
  return { etat, lignes: L, imm, tvaNote };
}
// « Oui, c'est moi » : les champs VIDES, et chaque écart qu'il a choisi de remplacer
// (`prendre[champ] === true`) — un champ qu'il avait écrit autrement est GARDÉ par défaut.
export function ecritureOui(lignes, prendre = {}) {
  const out = {};
  for (const l of lignes || []) {
    if (!l || !l.champ) continue;
    if (l.cas === 'vide' || (l.cas === 'ecart' && prendre && prendre[l.champ] === true)) out[l.champ] = l.valeur;
  }
  return out;
}

// ── LE STATUT CHOISI ⇒ LES MENTIONS QUI VONT AVEC ───────────────────────────────
// « Pareil lorsqu'on choisit le statut de l'entreprise » : choisir la forme montre, dans
// la MÊME carte de vérification, ce que SA facture doit porter (Code de commerce L441-9,
// R123-237 ; L526-22 et décret 2022-725 pour « EI » ; CGI 293 B) — chaque mention
// « en place » ou « à remplir » (le doigt sur le champ). Une seule écriture proposée,
// sur son clic : le régime « Franchise de TVA » pour une EI qui n'en a pas choisi.
// Rend { titre, lignes: [{ cle, texte, ok, champ? }], proposition: { champ, valeur, texte } | null }.
const texteRegime = (v) => (v === 'franchise' ? MENTION_FRANCHISE : v === 'marge' ? 'TVA sur la marge (biens d’occasion)' : v === 'normal' ? 'TVA classique' : '');
export function mentionsDeForme(forme, cfg = {}) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const f = FORMES.find((x) => x.v === forme);
  if (!f) return { titre: '', lignes: [], proposition: null };
  const L = [];
  const nom = propre(c.nom);
  const siretOk = verifierSiret(c.siret).etat === 'ok';
  if (!f.societe) {
    L.push({ cle: 'nom', champ: 'nom', ok: !!nom, texte: nom ? `${nom} EI` : 'Ton nom et prénom, suivis de « EI »' });
    L.push({ cle: 'siret', champ: 'siret', ok: siretOk, texte: 'Ton SIRET' });
    L.push({ cle: 'rcs', champ: 'rcs', ok: true, texte: propre(c.rcs) || 'RCS ou RM : seulement si tu es inscrit' });
    L.push({ cle: 'capital', ok: true, texte: 'Pas de capital social' });
  } else {
    L.push({ cle: 'nom', champ: 'nom', ok: !!nom, texte: nom ? `${nom} · ${f.v}` : `La raison sociale, et « ${f.v} »` });
    L.push({ cle: 'siret', champ: 'siret', ok: siretOk, texte: 'Ton SIRET' });
    L.push({ cle: 'rcs', champ: 'rcs', ok: !!propre(c.rcs), texte: propre(c.rcs) || 'RCS + ville du greffe + SIREN (ton Kbis)' });
    L.push({ cle: 'capital', champ: 'capital', ok: !!propre(c.capital), texte: propre(c.capital) ? `Capital social : ${propre(c.capital)} €` : 'Le capital social' });
  }
  const regime = texteRegime(c.tva_regime);
  L.push({ cle: 'tva_regime', champ: 'tva_regime', ok: !!regime, texte: regime || 'Ton régime de TVA' });
  const proposition = !f.societe && !regime ? { champ: 'tva_regime', valeur: 'franchise', texte: `Micro sous le seuil de TVA ? « ${MENTION_FRANCHISE} »` } : null;
  return { titre: f.societe ? `Pour une ${f.v}, ta facture porte :` : 'En entreprise individuelle, ta facture porte :', lignes: L, proposition };
}
