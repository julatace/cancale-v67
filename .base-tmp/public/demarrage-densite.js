// Densité d'affichage (Réglages → Affichage), appliquée AVANT le chargement de
// l'app : sinon la page s'affiche à 100 % puis saute de taille.
// ⚠️ Fichier à part (aucun script en ligne : politique de sécurité, vercel.json).
try {
  var z = localStorage.getItem('vrm_zoom'), f = parseFloat(z);
  if (f && f !== 1 && !(matchMedia('(max-width: 767px)').matches && f < 1)) {
    var d = document.documentElement, w = d.clientWidth;
    d.style.zoom = z; d.style.setProperty('--vrm-zoom', String(f)); d.style.minWidth = Math.round(w / f) + 'px';
  }
} catch (e) {}
