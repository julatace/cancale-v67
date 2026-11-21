// ════════════════════════════════════════════════════════════════════════════
//  LES PHOTOS ARRIVENT EN FONDU (8 nov. 2026, « beauté », point 2)
//  Une vignette de paire (Ventes, Colis, Annonces, Achats, Stock, Messages, la
//  loupe, Ma journée) apparaît par son OPACITÉ, jamais par un saut : sa place est
//  réservée (la vignette a sa taille, posée par son conteneur) et un fond neutre
//  la tient en attendant (`--d-case`, styles-beaute.css §2).
//
//  Comment : UNE écoute en phase de capture sur le document (l'événement `load`
//  d'une image ne remonte pas, la capture le voit) pose `data-vu` sur l'image
//  chargée ; la feuille de style ne cache (opacité 0) que les images d'une
//  vignette qui n'ont PAS encore `data-vu`, et les fait venir en 220 ms.
//  · une image déjà chargée au moment de l'installation est marquée tout de suite ;
//  · une image en erreur est marquée aussi (le composant de photo pose son repli) ;
//  · mouvement réduit : la feuille de style coupe la transition (l'image paraît) ;
//  · rien d'autre ne change : ni la source, ni la taille, ni l'ordre.
//  Aucun crochet React, aucun rendu en plus.
// ════════════════════════════════════════════════════════════════════════════
let installe = false;

const marquer = (img) => { try { if (img && img.tagName === 'IMG' && !img.hasAttribute('data-vu')) img.setAttribute('data-vu', ''); } catch (_) {} };

export function installerFonduPhotos(doc = typeof document !== 'undefined' ? document : null) {
  if (installe || !doc || !doc.addEventListener) return false;
  installe = true;
  const surEvenement = (e) => { const t = e && e.target; if (t && t.tagName === 'IMG') marquer(t); };
  doc.addEventListener('load', surEvenement, true);
  doc.addEventListener('error', surEvenement, true);
  // Une image qui a fini avant l'écoute (cache), ou dont la source change sans
  // nouvel élément : un filet, rarement utile, qui ne coûte qu'un balayage.
  const balayer = () => { try { doc.querySelectorAll('img:not([data-vu])').forEach((img) => { if (img.complete && img.naturalWidth > 0) marquer(img); }); } catch (_) {} };
  balayer();
  try { (doc.defaultView || window).addEventListener('pageshow', balayer); } catch (_) {}
  return true;
}
