// ════════════════════════════════════════════════════════════════════════════
//  MODÈLES DE DESCRIPTION → LA DESCRIPTION D'UNE FICHE (14 nov., idée 156)
// ════════════════════════════════════════════════════════════════════════════
// Julien écrit son texte UNE fois avec des cases ({taille}, {etat}, {numero},
// {boite}, {modele}, {marque}, {titre}, {prix}) — Paramètres → Annonces →
// « Mes modèles » (src/ModelesDescription.jsx, rangés dans `vrm_modeles_desc`,
// synchronisés par compte VRM). Ici : le texte se REMPLIT pour UNE fiche « À
// publier » (depuis la fiche de la paire, ou à la création d'une fiche dans une
// autre taille).
//
// ⚠️ Une case se remplit SEULEMENT par un champ ÉCRIT : celui de la fiche (taille,
//    marque, état, titre, prix, N°) ou SA réponse dans la feuille. Rien n'est
//    déduit d'un titre ({modele} n'est jamais « reconnu ») ; une case sans valeur
//    est DEMANDÉE, et tant qu'il n'a pas répondu elle reste écrite « {boite} » :
//    le trou se voit avant l'envoi (la règle de `remplirModele`).
// ⚠️ LE N° : écrit selon LA règle de « Créer sur Vinted » (`texteAnnonceVinted`,
//    src/annonceVinted.js) — l'étiquette de ses réglages (`vrm_num_vinted`) et, s'il
//    numérote lui-même à la fin de la description (`vrm_numero_ecrit`), « N°41 » en
//    dernière ligne. Un AUTRE N° écrit dans le texte ⇒ refus nommé (jamais deux N°).
// Module PUR : la feuille (./RemplirModele.jsx) et scripts/audit-idees-paires.cjs.
// ════════════════════════════════════════════════════════════════════════════
import { remplirModele, lireModeles } from '../modelesDescription.js';
import { texteAnnonceVinted } from '../annonceVinted.js';

const str = (v) => String(v == null ? '' : v).trim();
// Les noms d'une case (accents et synonymes) ⇒ la clé de la valeur.
const CLE = { taille: 'taille', marque: 'marque', titre: 'titre', prix: 'prix', etat: 'etat', 'état': 'etat', modele: 'modele', 'modèle': 'modele', boite: 'boite', 'boîte': 'boite', 'n°': 'numero', numero: 'numero', 'numéro': 'numero' };
export const CASES_DEMANDEES = ['modele', 'boite', 'etat', 'taille', 'marque'];

// Les valeurs ÉCRITES d'une fiche (`vrm_fiches_neuves` : titre, marque, taille, etat, prix, numero, modele, boite).
export function valeursFiche(fiche) {
  const f = fiche || {};
  const out = {};
  for (const k of ['taille', 'marque', 'titre', 'etat', 'modele', 'boite', 'numero']) if (str(f[k])) out[k] = str(f[k]);
  const p = Number(String(f.prix == null ? '' : f.prix).replace(',', '.'));
  if (Number.isFinite(p) && p > 0) out.prix = p;
  return out;
}

// Les cases d'un texte qui n'ont PAS de valeur (à demander), sans doublon, dans l'ordre du texte.
export function casesVides(texte, valeurs = {}) {
  const out = [];
  String(texte == null ? '' : texte).replace(/\{\s*([^{}\s]{1,10})\s*\}/g, (tout, nom) => {
    const k = CLE[String(nom).toLowerCase()];
    if (k && k !== 'numero' && !str(valeurs[k]) && !out.includes(k)) out.push(k);
    return tout;
  });
  return out;
}

// Le texte rempli pour CETTE fiche : { ok, description, vides } ou { ok:false, raison }.
// `reponses` : ce qu'il a tapé pour les cases vides. `reglages` : { etiquette, numeroEcrit }.
export function descriptionDepuisModele(modele, fiche, { reponses = {}, reglages = {} } = {}) {
  const m = modele && typeof modele === 'object' ? modele : null;
  if (!m || !str(m.texte)) return { ok: false, raison: 'modele-vide' };
  const vals = { ...valeursFiche(fiche) };
  for (const [k, v] of Object.entries(reponses || {})) if (CASES_DEMANDEES.includes(k) && str(v)) vals[k] = str(v);
  const rempli = remplirModele(m.texte, vals).replace(/\r/g, '');
  const vides = casesVides(m.texte, vals);
  if (!str(vals.numero)) return { ok: true, description: rempli.trim(), vides };
  // Le N° selon LA règle de « Créer sur Vinted » (on n'en garde que la description).
  const t = texteAnnonceVinted({ numero: vals.numero, titre: 'x', description: rempli }, reglages);
  if (!t.ok) return { ok: false, raison: t.raison };
  return { ok: true, description: t.description, vides };
}

// Les modèles rangés, nettoyés (la règle d'avant).
export const modelesRanges = (brut) => lireModeles(brut);
