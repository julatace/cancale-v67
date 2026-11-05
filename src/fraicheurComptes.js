// ══════════════════════════════════════════════════════════════════════════════
// TES COMPTES, UN PAR LIGNE : QUAND RELUS, ET CE QUI BLOQUE (5 novembre)
// ══════════════════════════════════════════════════════════════════════════════
// Julien : « être mieux informé de la connexion et de la récupération des
// données dans VRM (côté automatique) — il faut impérativement améliorer cette
// partie ». Le panneau de l'indicateur (en haut de chaque écran) dit, compte
// par compte et toutes plateformes : la dernière relecture, et — s'il y en a —
// LE geste qui la débloque, en une ligne.
// Ce module ne lit rien : il range ce que l'écran a lu, avec les règles de
// « Comptes liés » (`etatCompteLie`, `ageLecture`, §11) — jamais une seconde.
// Une couleur seulement s'il y a un geste (`geste: true`, §7) ; un choix
// (compte masqué, hors des totaux) ou un état sans geste ici (banni) se dit en
// gris. « Pas su » (une lecture ratée) est rendu par l'écran, une ligne par
// plateforme — jamais « jamais relu ».
import { etatCompteLie, ageLecture, nomCompteLie } from './comptesLies.js';

const NOM_PLATEFORME = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire', ebay: 'eBay' };
export const nomPlateforme = (p) => NOM_PLATEFORME[p] || p;

// Le geste qui fait relire un compte, par plateforme. `dans` : « dans ce
// Chrome », « dans Orion », « dans ce navigateur » (motsNavigateur, jamais
// « Chrome » en dur) — ou, quand l'extension n'est PAS dans ce navigateur
// (téléphone, autre navigateur), « sur l'ordinateur où est l'extension VRM » :
// ouvrir Vinted ici ne relirait rien (revue du 5 nov.).
function gesteRelire(plateforme, dans) {
  if (plateforme === 'vinted') return `ouvre vinted.fr connecté sur ce compte ${dans}`;
  if (plateforme === 'leboncoin') return `ouvre « Mes annonces » sur leboncoin.fr connecté sur ce compte ${dans}`;
  if (plateforme === 'vestiaire') return `ouvre Vestiaire connecté sur ce compte ${dans}`;
  if (plateforme === 'ebay') return 'touche « Relire » dans Réglages → Comptes liés';
  return '';
}

// Une ligne : { plateforme, id, nom, etat, age, quand, bloque, geste }.
//   · `c` : { plateforme, id, nom?, lu, ouvert?, delie?, banni?, masque?, horsTotaux? }
//   · `quand` : la relecture, telle qu'écrite (« ouvert ici », « relu il y a 3 h »,
//     « jamais relu ») ; `bloque` : ce qui bloque et le geste, ou '' — l'écran
//     les écrit TELS QUELS (aucune retouche de texte côté écran, §11).
// ⚠️ Revue du 5 nov. : « ouvert ici » ne se dit que de VINTED (le compte de
//    l'onglet de CE navigateur, lu par l'extension d'ici). Pour Leboncoin et
//    Vestiaire, « ouvert » = la dernière session relevée par l'extension, sur
//    n'importe quel ordinateur (`compteLbcOuvert`, 12 h) : ce n'est pas « ici »,
//    et l'écran affichait « ouvert ici · » suivi de rien. On y dit l'âge de la
//    dernière relecture, sans geste.
export function ligneFraicheur(c, { maintenant = Date.now(), dans = 'dans ce navigateur' } = {}) {
  const plateforme = c.plateforme;
  const ouvertIci = !!c.ouvert && plateforme === 'vinted';
  // (Leboncoin : `lu` porte déjà la session relevée — `comptesLbcLies` —, un
  // compte « ouvert » y est donc relu il y a moins de 12 h.)
  const etat = etatCompteLie({ banni: !!c.banni, delie: !!c.delie, ouvert: ouvertIci, lu: c.lu, maintenant });
  const age = ageLecture(c.lu, maintenant);
  const nom = plateforme === 'vinted' ? (c.nom || `n° ${c.id}`) : nomCompteLie(c);
  const quand = etat === 'ouvert' ? 'ouvert ici' : age ? `relu ${age}` : 'jamais relu';
  let bloque = '', geste = false;
  if (c.masque) bloque = 'masqué dans VRM — ton choix';
  else if (etat === 'banni') bloque = 'banni par Vinted (lu dans son profil)';
  else if (etat === 'delie') { bloque = 'délié — relie-le dans Réglages → Comptes liés'; geste = true; }
  else if (etat === 'ouvert') bloque = 'relu à chaque passage sur Vinted';
  else if (etat === 'jamais' || etat === 'a-relire') {
    bloque = etat === 'a-relire' && plateforme === 'ebay' ? `eBay n’a rien rendu depuis — ${gesteRelire(plateforme, dans)}` : gesteRelire(plateforme, dans);
    geste = true;
  }
  if (c.horsTotaux && !c.masque) bloque = bloque ? `${bloque} · hors des totaux (ton choix)` : 'hors des totaux (ton choix)';
  return { plateforme, id: String(c.id), nom, etat, age, quand, bloque, geste };
}

// Toutes les lignes, dans l'ordre : ce qui demande un geste d'abord, puis le
// reste (Vinted avant les autres sites), chaque groupe par nom.
export function lignesFraicheur(comptes, opts = {}) {
  const ordre = { vinted: 0, leboncoin: 1, vestiaire: 2, ebay: 3 };
  return (Array.isArray(comptes) ? comptes : []).filter((c) => c && c.plateforme && c.id != null && c.id !== '')
    .map((c) => ligneFraicheur(c, opts))
    .sort((a, b) => (b.geste - a.geste) || ((ordre[a.plateforme] ?? 9) - (ordre[b.plateforme] ?? 9)) || String(a.nom).localeCompare(String(b.nom), 'fr'));
}
