// ── SIRET → le nom de l'entreprise (17 octobre, Julien) ──────────────────────
// « Quand on remplit son SIRET, le nom de l'entreprise s'affiche en haut à
// gauche à côté du logo — l'utilisateur n'a pas besoin de taper son nom
// d'entreprise, il met son numéro de SIRET. »
//
// Source : l'API publique « Recherche d'entreprises » de l'État
// (recherche-entreprises.api.gouv.fr), gratuite, SANS clé — aucune fonction
// payante sur la clé de Julien (§2.9). Appelée par le SERVEUR (pas le
// navigateur) : elle ne dépend pas de l'en-tête CORS de l'API, et la route
// exige une session (VRM n'est pas un relais ouvert).
//
// ⚠️ UNE IDENTITÉ, JAMAIS UNE RESSEMBLANCE (§5) : on ne garde un résultat que
//    si son SIREN est EXACTEMENT celui du numéro saisi (les 9 premiers chiffres),
//    et l'établissement que si son SIRET est exactement celui saisi. La
//    recherche plein texte de l'API rendrait sinon « l'entreprise qui
//    ressemble » — un nom faux sur ses factures.
// ⚠️ TROIS ÉTATS : `trouve` · `inconnu` (l'API a répondu, aucun SIREN égal) ·
//    pas su (l'API n'a pas répondu ⇒ 503, jamais « inconnu »).
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai
const API = 'https://recherche-entreprises.api.gouv.fr/search';

export function chiffresSiret(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

const propre = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

// Le nom à montrer : la raison sociale, sinon le nom complet (entrepreneur
// individuel : « PRÉNOM NOM »). Jamais un sigle seul quand le nom existe.
function nomDe(r) {
  return propre(r.nom_raison_sociale) || propre(r.nom_complet) || '';
}

// Pure : la réponse de l'API → ce que la route rend. Exporté pour l'audit.
export function lireReponseEntreprise(json, saisi) {
  const ch = chiffresSiret(saisi);
  const siren = ch.slice(0, 9);
  const res = json && Array.isArray(json.results) ? json.results : null;
  if (!res) return null;                                   // forme inattendue = pas su
  const r = res.find((x) => x && String(x.siren || '') === siren);
  if (!r) return { etat: 'inconnu' };
  const nom = nomDe(r);
  if (!nom) return { etat: 'inconnu' };
  const etabs = [...(Array.isArray(r.matching_etablissements) ? r.matching_etablissements : []), r.siege].filter(Boolean);
  const etab = ch.length === 14 ? etabs.find((e) => String(e.siret || '') === ch) : (r.siege || null);
  return {
    etat: 'trouve',
    siren,
    siret: etab && etab.siret ? String(etab.siret) : (ch.length === 14 ? ch : ''),
    nom,
    // L'adresse n'est rendue que pour l'établissement EXACT (sinon blanc).
    adresse: etab ? propre(etab.adresse) : '',
    codePostal: etab ? propre(etab.code_postal) : '',
    ville: etab ? propre(etab.libelle_commune) : '',
    etabTrouve: !!etab,
    ferme: r.etat_administratif === 'C' || (etab && etab.etat_administratif === 'F') || false,
    // (9 nov., soir — « Ma facture » et « Ma configuration » : la carte « Vérifie ces
    // informations », src/entrepriseRecherche.js) Ce que le registre DIT, tel quel ;
    // chaque champ absent de la réponse reste `null` (« pas su », jamais deviné).
    // Forme documentée de l'API (open-api.yml du dépôt search-api, lu le 9 nov.) :
    //   nature_juridique (code INSEE), etat_administratif (A / C), tva (n° actifs,
    //   DGFiP), complements.est_entrepreneur_individuel, siege / établissement :
    //   etat_administratif (A / F), activite_principale_registre_metier.
    fermeUnite: r.etat_administratif === 'C',
    etabFerme: !!(etab && etab.etat_administratif === 'F'),
    nature: typeof r.nature_juridique === 'string' || typeof r.nature_juridique === 'number' ? String(r.nature_juridique) : '',
    ei: r.complements && typeof r.complements.est_entrepreneur_individuel === 'boolean' ? r.complements.est_entrepreneur_individuel : null,
    tva: Array.isArray(r.tva) ? r.tva.filter((x) => typeof x === 'string').map((x) => x.replace(/\s/g, '').toUpperCase()) : null,
    rm: etab && Object.prototype.hasOwnProperty.call(etab, 'activite_principale_registre_metier') ? !!etab.activite_principale_registre_metier : null,
    // (11 nov., lot DJ1 — la carte « C'est bien toi ? ») Pour VÉRIFIER, tels que le registre
    // les dit (forme documentée, open-api.yml : etablissement.nom_commercial,
    // etablissement.liste_enseignes[], etablissement.activite_principale = code APE/NAF,
    // result.activite_principale) ; absent ⇒ '' (rien montré, rien deviné).
    nomCommercial: etab ? (propre(etab.nom_commercial) || (Array.isArray(etab.liste_enseignes) ? propre(etab.liste_enseignes.find((x) => propre(x)) || '') : '')) : '',
    ape: propre((etab && etab.activite_principale) || r.activite_principale || ''),
  };
}

// La route : { status, body }.
export async function routeEntreprise(saisi, fetchFn = fetchAvecDelai) {
  const ch = chiffresSiret(saisi);
  if (ch.length !== 9 && ch.length !== 14) return { status: 400, body: { erreur: 'Un SIREN a 9 chiffres, un SIRET 14.' } };
  let rep;
  try {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const minuteur = ctl ? setTimeout(() => ctl.abort(), 6000) : null;
    rep = await fetchFn(`${API}?q=${ch}&per_page=5&page=1`, { headers: { accept: 'application/json' }, signal: ctl ? ctl.signal : undefined });
    if (minuteur) clearTimeout(minuteur);
  } catch (_) { return { status: 503, body: { erreur: "Le registre des entreprises ne répond pas — réessaie dans un moment.", code: 'pas-su' } }; }
  if (!rep || !rep.ok) return { status: 503, body: { erreur: "Le registre des entreprises ne répond pas — réessaie dans un moment.", code: 'pas-su' } };
  let json; try { json = await rep.json(); } catch (_) { json = null; }
  const lu = lireReponseEntreprise(json, ch);
  if (!lu) return { status: 503, body: { erreur: "Le registre des entreprises a répondu d'une façon que je ne sais pas lire — rien n'est changé.", code: 'pas-su' } };
  return { status: 200, body: lu };
}
