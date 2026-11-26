// ── src/ventes/photosVentesPub.js — LA PHOTO D'UNE VENTE VINTED, publiée par Ventes (25 nov. 2026, lot ventes-rangee) ──────────
// Julien, capture iPhone de Ventes → « En route » : chaque vignette était un carré gris VIDE. Mesuré : la liste des ventes de Vinted
// (`orders_sold`, `my_orders[].photo`) n'a une photo que pour une vente sur quatre (772 sur ~3 500) ; la photo des autres vit
// ailleurs — l'annonce de CETTE transaction (`txnItem`), la transaction rangée (`order.items[0].photos[0]`), le coffre, la fiche N°
// de CETTE annonce (src/photosArticles.js `photosVenteVintedCandidates`, toujours par IDENTITÉ, jamais par titre — §5). L'ancienne
// liste de Ventes lisait déjà ces sources ; « À envoyer », « En route » et « Terminées » ne lisaient que la photo de la commande.
// Un seul propriétaire (§11) : l'écran qui a les sources (src/ecrans/Comptabilite.jsx) calcule la carte « transaction → photo » et la
// PUBLIE ici ; « Terminées » (src/App.jsx `VentesToutes`) la lit. Rien n'est écrit en base, rien n'est deviné : sans source, rien.
import React from 'react';

let carte = new Map();
let version = 0;
const abonnes = new Set();
const cle = (tx) => (tx == null || tx === '' ? '' : String(tx));

export function publierPhotosVentes(m) {
  const neuve = m instanceof Map ? m : new Map();
  if (neuve === carte) return;
  if (neuve.size === carte.size) { let pareil = true; for (const [k, v] of neuve) if (carte.get(k) !== v) { pareil = false; break; } if (pareil) return; }
  carte = neuve; version++;
  abonnes.forEach((f) => { try { f(); } catch (_) {} });
}

// La photo publiée de la vente `tx` (identifiant de transaction Vinted) ; rien de publié ⇒ null.
export function photoVentePubliee(tx) { const k = cle(tx); return k ? carte.get(k) || null : null; }

const abonner = (f) => { abonnes.add(f); return () => abonnes.delete(f); };
const lire = () => version;
// La version de la publication : un écran la met dans ses dépendances pour se redessiner quand une photo arrive.
export function useVersionPhotosVentes() { return React.useSyncExternalStore(abonner, lire, lire); }
