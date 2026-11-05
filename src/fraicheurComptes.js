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
// « Chrome » en dur).
function gesteRelire(plateforme, dans) {
  if (plateforme === 'vinted') return `ouvre vinted.fr connecté sur ce compte ${dans}`;
  if (plateforme === 'leboncoin') return `ouvre « Mes annonces » sur leboncoin.fr connecté sur ce compte ${dans}`;
  if (plateforme === 'vestiaire') return `ouvre Vestiaire connecté sur ce compte ${dans}`;
  if (plateforme === 'ebay') return 'touche « Relire » dans Réglages → Comptes liés';
  return '';
}

// Une ligne : { plateforme, id, nom, etat, age, bloque, geste }.
//   · `c` : { plateforme, id, nom?, lu, ouvert?, delie?, banni?, masque?, horsTotaux? }
export function ligneFraicheur(c, { maintenant = Date.now(), dans = 'dans ce navigateur' } = {}) {
  const plateforme = c.plateforme;
  const etat = etatCompteLie({ banni: !!c.banni, delie: !!c.delie, ouvert: !!c.ouvert, lu: c.lu, maintenant });
  const age = ageLecture(c.lu, maintenant);
  const nom = plateforme === 'vinted' ? (c.nom || `n° ${c.id}`) : nomCompteLie(c);
  let bloque = '', geste = false;
  if (c.masque) bloque = 'masqué dans VRM — ton choix';
  else if (etat === 'banni') bloque = 'banni par Vinted (lu dans son profil)';
  else if (etat === 'delie') { bloque = 'délié — relie-le dans Réglages → Comptes liés'; geste = true; }
  else if (etat === 'ouvert') bloque = plateforme === 'vinted' ? 'ouvert ici : relu à chaque passage sur Vinted' : 'ouvert ici';
  else if (etat === 'jamais') { bloque = `jamais relu — ${gesteRelire(plateforme, dans)}`; geste = true; }
  else if (etat === 'a-relire') { bloque = plateforme === 'ebay' ? `eBay n’a rien rendu depuis — ${gesteRelire(plateforme, dans)}` : gesteRelire(plateforme, dans); geste = true; }
  if (c.horsTotaux && !c.masque) bloque = bloque ? `${bloque} · hors des totaux (ton choix)` : 'hors des totaux (ton choix)';
  return { plateforme, id: String(c.id), nom, etat, age, bloque, geste };
}

// Toutes les lignes, dans l'ordre : ce qui demande un geste d'abord, puis le
// reste (Vinted avant les autres sites), chaque groupe par nom.
export function lignesFraicheur(comptes, opts = {}) {
  const ordre = { vinted: 0, leboncoin: 1, vestiaire: 2, ebay: 3 };
  return (Array.isArray(comptes) ? comptes : []).filter((c) => c && c.plateforme && c.id != null && c.id !== '')
    .map((c) => ligneFraicheur(c, opts))
    .sort((a, b) => (b.geste - a.geste) || ((ordre[a.plateforme] ?? 9) - (ordre[b.plateforme] ?? 9)) || String(a.nom).localeCompare(String(b.nom), 'fr'));
}
