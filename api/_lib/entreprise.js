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
  };
}

// La route : { status, body }.
export async function routeEntreprise(saisi, fetchFn = fetch) {
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
