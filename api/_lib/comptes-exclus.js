// ══════════════════════════════════════════════════════════════════════════════
// LES COMPTES LEBONCOIN, VESTIAIRE ET eBAY ÉCARTÉS DES TOTAUX (3 novembre)
// ══════════════════════════════════════════════════════════════════════════════
// Julien : « Comptes liés : il doit y avoir les comptes Leboncoin, Vestiaire et
// eBay ; tout ce qui est fait pour Vinted doit être fait pour le reste ».
// Vinted a depuis le 3 octobre « les comptes sélectionnés » (`vinted_accounts_hidden`) :
// un compte écarté n'entre dans AUCUN total (CA déclaré, URSSAF, bénéfice, vendu).
// Les autres sites n'avaient rien : toutes leurs ventes comptaient, toujours.
//
// `vrm_comptes_exclus` = { leboncoin: [id], vestiaire: [id], ebay: [ref] } — un
// CHOIX, écrit seulement sur SON geste (Paramètres → Comptes liés), synchronisé.
// UNE règle, UN propriétaire (§11) : l'app (App.jsx) et le serveur (bilan de la
// semaine) l'importent d'ici, jamais une copie.
//
// ⚠️ Seulement les TOTAUX. Un compte écarté garde ses colis, ses annonces, ses
//    alertes de double vente : un colis caché est un colis perdu (§5).
// ⚠️ L'identité du compte d'une vente est celle que la vente PORTE (§5) :
//      · Leboncoin : `account` (`8442…` = `lbc-account:8442…`, une identité) ;
//      · eBay      : `_compte` posé à la lecture ('principal' ou la clé du compte) ;
//      · Vestiaire : `compte` (celui de l'onglet qui l'a lue) ; vide = la vente
//        n'a pas de compte relevé — elle appartient à la carte « compte non
//        identifié » (`SANS_COMPTE_VC`), jamais à un compte deviné.
//    Une vente Leboncoin ou eBay SANS compte n'est jamais écartée : « pas su »
//    ne vaut pas « oui » — elle compte, comme avant.
import { venteAutreHorsPlan, brideAutres } from './plan-regle.js';

export const CLE_COMPTES_EXCLUS = 'vrm_comptes_exclus';
export const PLATEFORMES_EXCLUABLES = Object.freeze(['leboncoin', 'vestiaire', 'ebay']);
export const SANS_COMPTE_VC = '-';

export const idCompteLbcExclu = (x) => String(x == null ? '' : x).trim().replace(/^lbc-account:/i, '');
const idDe = (plateforme, x) => (plateforme === 'leboncoin' ? idCompteLbcExclu(x) : String(x == null ? '' : x).trim());

// La forme rangée, relue sans confiance : un objet de tableaux de chaînes.
export function exclusNormes(v) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const r = {};
  for (const p of PLATEFORMES_EXCLUABLES) r[p] = new Set((Array.isArray(o[p]) ? o[p] : []).map((x) => idDe(p, x)).filter(Boolean));
  return r;
}

// Le compte d'une vente, tel qu'elle le porte. `null` = pas su (jamais écartée).
export function compteDeVente(plateforme, v) {
  if (!v || typeof v !== 'object') return null;
  if (plateforme === 'leboncoin') { const id = idCompteLbcExclu(v.account); return id || null; }
  if (plateforme === 'ebay') { const r = String(v._compte == null ? '' : v._compte).trim(); return r || null; }
  if (plateforme === 'vestiaire') { const c = String(v.compte == null ? '' : v.compte).trim(); return c || SANS_COMPTE_VC; }
  return null;
}

// Le prédicat que reçoivent `ventesFaites`, `ventesDeclarables` et
// `ventesAutresBenefice` (`excluAutre`). Rien d'écarté ⇒ `null` (les fonctions
// gardent exactement leur chemin d'avant).
// (9 nov., Solo par plateforme) `regle` (facultative) : l'offre du vendeur
// (`regleVentes`, api/_lib/plan-regle.js). En Solo, la vente d'un compte
// Leboncoin / eBay / Vestiaire qui n'est pas le compte vendeur CHOISI de sa
// plateforme sort des TOTAUX, comme un compte écarté (`venteAutreHorsPlan`).
// UN prédicat pour l'app (`useExcluAutre`) et le serveur (bilans) — jamais une
// copie. Sans `regle` (ou « pas su ») : exactement le choix d'avant.
export function excluAutreDe(v, regle) {
  const ex = exclusNormes(v);
  const bride = brideAutres(regle);
  if (!bride && PLATEFORMES_EXCLUABLES.every((p) => !ex[p].size)) return null;
  return (plateforme, vente) => {
    const c = compteDeVente(plateforme, vente);
    if (c == null) return false;
    const s = ex[plateforme];
    if (s && s.size && s.has(c)) return true;
    return bride && c !== SANS_COMPTE_VC && venteAutreHorsPlan(regle, plateforme, c);
  };
}

export function estExclu(v, plateforme, id) {
  const ex = exclusNormes(v);
  return !!(ex[plateforme] && ex[plateforme].has(idDe(plateforme, id)));
}

// Le geste : rend la NOUVELLE valeur à ranger (jamais une modification en place).
export function basculerExclu(v, plateforme, id) {
  const ex = exclusNormes(v);
  if (!ex[plateforme]) return v;
  const k = idDe(plateforme, id);
  if (!k) return v;
  if (ex[plateforme].has(k)) ex[plateforme].delete(k); else ex[plateforme].add(k);
  const out = {};
  for (const p of PLATEFORMES_EXCLUABLES) if (ex[p].size) out[p] = [...ex[p]].sort();
  return out;
}
