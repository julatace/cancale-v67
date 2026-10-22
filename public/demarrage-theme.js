// Thème AVANT le premier rendu (sinon l'app s'affiche en clair puis bascule).
// Lit le MÊME réglage que React (`vinted_dark`) et estampille la racine.
// ⚠️ Fichier à part, et non plus script en ligne d'index.html : la politique
// de sécurité du contenu (vercel.json) n'autorise aucun script en ligne.
try {
  var d = JSON.parse(localStorage.getItem('vinted_dark') || 'false') === true;
  document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light');
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', d ? '#07090D' : '#F4F3EF');
} catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
