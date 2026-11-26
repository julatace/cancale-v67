// ══════════════════════════════════════════════════════════════════════════════
//  « BIEN DÉMARRER 3/5 » EN HAUT D'AUJOURD'HUI (21 nov., ux-reglages — Julien : « comme Bleam »)
// ══════════════════════════════════════════════════════════════════════════════
// Cinq étapes RÉELLES, chacune cochée SEULE quand c'est vrai — jamais un clic « fait » sans preuve :
//   extension  l'extension répond dans CE navigateur, ou un compte est relié (un compte ne se relie que par elle) ;
//   compte     un compte Vinted relié (la liste `vinted_accounts` LUE, non vide) ;
//   lecture    la première lecture faite (un dressing ou une liste de ventes LUS, non vides) ;
//   numeros    un premier N° de rangement posé (le pool ou une fiche porte un N°) ;
//   fiscal     le statut fiscal choisi (`regimeFiscal()` ≠ null : jamais deviné).
// Trois états par étape : 'fait' · 'afaire' · 'passu' (« pas su » ne vaut pas « oui » : jamais coché sur un silence).
// Montrée seulement à un compte NOUVEAU (inscrit à partir du jour de la mise en ligne, `DEBUT_BIEN_DEMARRER`), jamais
// au propriétaire de l'installation (Julien) ni dans l'exemple, tant qu'une étape reste, et jusqu'à son « × » (rangé
// dans `CLE_BIEN_DEMARRER`, synchronisé). Une date d'inscription pas sue ⇒ cachée. Module PUR (aucune lecture).
// ══════════════════════════════════════════════════════════════════════════════
export const ETAPES_BIEN_DEMARRER = Object.freeze(['extension', 'compte', 'lecture', 'numeros', 'fiscal']);
export const CLE_BIEN_DEMARRER = 'vrm_bien_demarrer';
export const DEBUT_BIEN_DEMARRER = '2026-11-21';

const etat = (v) => (v === true ? 'fait' : v === false ? 'afaire' : 'passu');

// Les preuves : { extension, comptes, lecture, numeros, fiscal } — chacune true · false · null/undefined (pas su).
// (23 nov., lot demarrage-guide) `autres` : un compte Leboncoin, Vestiaire ou eBay RELIÉ (lu) compte aussi — un vendeur qui
// ne vend pas sur Vinted réussit son démarrage. Vinted relié OU un autre site relié ⇒ fait ; les deux lus vides ⇒ à faire ;
// sinon pas su (jamais coché sur un silence).
const ouLu = (a, b) => (a === true || b === true ? true : a === false && b === false ? false : null);
export function etapesBienDemarrer(p = {}) {
  p = { ...p, comptes: p.autres === undefined ? p.comptes : ouLu(p.comptes, p.autres) };
  const compte = p.comptes === true;
  const extension = p.extension === true || compte ? true : p.extension;
  return ETAPES_BIEN_DEMARRER.map((cle) => ({ cle, etat: etat(cle === 'extension' ? extension : cle === 'compte' ? p.comptes : p[cle]) }));
}
export const nombreFaites = (etapes) => (etapes || []).filter((e) => e && e.etat === 'fait').length;
// La prochaine étape à faire (la première pas faite, dans l'ordre).
export const etapeCourante = (etapes) => ((etapes || []).find((e) => e && e.etat !== 'fait') || null);

const masqueDe = (v) => !!(v && typeof v === 'object' && v.masque);
const jourDe = (v) => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v || '')); return m ? m[1] : ''; };

export function bienDemarrerAMontrer({ etapes, reglage = null, proprietaire, inscritLe, exemple = false, debut = DEBUT_BIEN_DEMARRER } = {}) {
  if (exemple) return false;
  if (proprietaire !== false) return false;          // Julien (true) ou pas su (null) : rien
  const j = jourDe(inscritLe);
  if (!j || j < debut) return false;                  // un compte d'avant (ou date pas sue) : rien
  if (masqueDe(reglage)) return false;               // son « × »
  if (!Array.isArray(etapes) || etapes.length !== ETAPES_BIEN_DEMARRER.length) return false;
  return nombreFaites(etapes) < etapes.length;        // tout fait ⇒ elle part d'elle-même
}
export const reglageMasque = (at = new Date().toISOString()) => ({ masque: true, at });
