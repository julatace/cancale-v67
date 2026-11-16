// api/_lib/masquees-regle.js — ⚠️ NE PAS MODIFIER À LA MAIN.
// Copie EXACTE du bloc `<masquees-regle>` de src/App.jsx (les annonces masquées par Vinted
// sont PRÉSENTES : la paire est toujours chez lui, §5), refabriquée par
// `node scripts/_recopie-masquees.cjs --recopie` ; `scripts/audit-fiabilite-auto.cjs` exige
// qu'elle soit identique et l'exécute à côté de l'originale.
import { cleNum } from './numerotation.js';
import { supprimeeApres } from './enligne-regle.js';
// <copie>
function masqueeSurVinted(it) { return !!(it && it.is_hidden && !it.is_closed && !it.is_draft); }
function masqueesDuCompte(fermees, suppIds, capDressing) {
  return (Array.isArray(fermees) ? fermees : []).filter((it) => masqueeSurVinted(it) && !supprimeeApres(suppIds, it.id, capDressing));
}
// ⚠️⚠️ 23 OCT. (relecture) — UNE MASQUÉE DÉCLARÉE PARTIE N'EST PLUS SUR L'ÉTAGÈRE.
// « Elle n'est plus là » (sur une ligne qui nomme la masquée) et « Retirer » (annonces
// disparues) rangent la déclaration dans `vinted_pairs_lost`. Sans ce jugement, la
// masquée qu'il venait de déclarer partie redevenait « toujours chez toi » : un
// numéro brûlé et un carton à réécrire pour rien (doublon réglé contre une paire
// absente). IDENTITÉ d'abord : une entrée qui porte l'identifiant d'annonce (`id`)
// ne vise QUE cette annonce, quelle que soit sa clé. Une entrée ANCIENNE (numéro
// seul) ne vaut pour elle que si AUCUNE autre fiche ne porte ce numéro : sinon on
// ne sait pas laquelle des deux est partie, et la garder présente est le sens sûr
// (deux paires sous un N° est le seul risque irréversible, §5). Fonctions PURES.
function annonceDeclareePartie(id, fiches, perdues) {
  if (!perdues || typeof perdues !== 'object') return false;
  const moi = String(id);
  for (const k in perdues) { const e = perdues[k]; if (e && e.id != null && String(e.id) === moi) return true; }
  const n = cleNum(fiches && fiches[moi] && fiches[moi].numero);
  if (!n) return false;
  let ancienne = false;
  for (const k in perdues) { const e = perdues[k]; if (e && e.id == null && cleNum(k) === n) { ancienne = true; break; } }
  if (!ancienne) return false;
  for (const autre in (fiches || {})) if (autre !== moi && cleNum((fiches[autre] || {}).numero) === n) return false;
  return true;
}
// La clé où ranger une déclaration : le numéro nu quand aucune autre fiche ne le
// porte (les lecteurs par NUMÉRO — files Leboncoin et eBay, retours, orphelines —
// le comprennent comme avant) ; sinon `N°@idAnnonce`, pour ne JAMAIS sortir des
// files l'AUTRE paire, qui garde ce numéro.
function cleDeclarationPartie(numero, id, fiches) {
  const n = cleNum(numero), moi = String(id), brut = String(numero == null ? '' : numero).trim();
  const autre = !!n && Object.keys(fiches || {}).some((k) => k !== moi && cleNum((fiches[k] || {}).numero) === n);
  return autre ? `${brut}@${moi}` : brut;
}
// Les masquées encore sur l'étagère : toutes, sauf celles déclarées parties.
function masqueesPresentes(masquees, fiches, perdues) {
  return (Array.isArray(masquees) ? masquees : []).filter((it) => it && !annonceDeclareePartie(it.id, fiches, perdues));
}
// </copie>
export { masqueeSurVinted, masqueesDuCompte, annonceDeclareePartie, masqueesPresentes };
