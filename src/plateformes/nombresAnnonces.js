// ── LE NOMBRE D'ANNONCES DE CHAQUE SITE, POUR LE SÉLECTEUR D'ANNONCES (15 nov.) ──
// Julien : « fais en sorte que c'est plus pratique » — chaque touche de site d'Annonces
// dit combien d'annonces il y a de ce côté (« V 36 », « VC 3 »).
// Une seule règle par notion (§5) : ce module ne COMPTE rien. Chaque site publie le
// nombre que SA liste montre, calculé par SA règle (Vinted : `online` des chiffres de
// l'app, la même valeur que « en ligne » de la bande ; Vestiaire : les annonces « En
// ligne » de sa liste ; Leboncoin, eBay : leur écran quand il les a comptées). Le
// sélecteur lit. « Pas su » ⇒ rien écrit (jamais un 0 deviné) ; une lecture ratée
// remet le site à « pas su ». En mémoire seulement (rien n'est écrit en base) ; vidé à
// la déconnexion (`viderNombresAnnonces`).
import { compterVcEnLigneRegle } from '../enLigneVc.js';

const etat = { v: Object.freeze({}), auditeurs: new Set() };

export function poserNombreAnnonces(site, n) {
  const s = String(site || ''); if (!s) return;
  const val = Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  const avant = Object.prototype.hasOwnProperty.call(etat.v, s) ? etat.v[s] : undefined;
  if (avant === val) return;
  const u = { ...etat.v };
  if (val == null) delete u[s]; else u[s] = val;
  etat.v = Object.freeze(u);
  for (const f of etat.auditeurs) { try { f(); } catch (_) {} }
}
export function viderNombresAnnonces() { etat.v = Object.freeze({}); for (const f of etat.auditeurs) { try { f(); } catch (_) {} } }
export const lireNombresAnnonces = () => etat.v;
export function abonnerNombresAnnonces(f) { etat.auditeurs.add(f); return () => etat.auditeurs.delete(f); }

// Vestiaire : le nombre d'annonces « En ligne » de SA liste (src/ecrans/Vestiaire.jsx) — LA règle de
// src/enLigneVc.js (26 nov.) : une vente lue ET pas annulée la dit vendue, une lecture de plus de 24 h
// ne compte plus rien « en ligne » (« à confirmer »). Liste jamais lue ⇒ null (pas su), jamais 0.
export function compterVcEnLigne(lst, ventes, maintenant = Date.now()) {
  return compterVcEnLigneRegle(lst, ventes, maintenant);
}
