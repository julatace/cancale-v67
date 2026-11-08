// Centre d'aide VRM (8 nov.) — servi par VRM (la politique de contenu n'autorise
// aucun script en ligne). Deux choses :
//   1. le thème choisi dans l'app (`vinted_dark`), sinon celui du système ;
//   2. la recherche de la page d'accueil : dans le navigateur, sur
//      index-recherche.json (titre, résumé, texte des articles), sans accents ni
//      majuscules ; chaque mot tapé doit se trouver. Rien n'est envoyé nulle part.
(function () {
  try {
    var v = localStorage.getItem('vinted_dark');
    if (v === 'true' || v === 'false') document.documentElement.setAttribute('data-theme', v === 'true' ? 'dark' : 'light');
  } catch (e) {}

  var plat = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' '); };
  function brancher() {
    var champ = document.getElementById('q');
    var liste = document.getElementById('articles');
    if (!champ || !liste) return;
    var lignes = Array.prototype.slice.call(liste.querySelectorAll('li[data-article]'));
    var rien = document.getElementById('rien');
    var dit = document.getElementById('resultat');
    var index = null;
    fetch('/aide/index-recherche.json', { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (Array.isArray(j)) { index = {}; j.forEach(function (a) { index[a.slug] = plat(a.titre + ' ' + a.resume + ' ' + a.mots); }); filtrer(); }
    }).catch(function () {});
    function filtrer() {
      var mots = plat(champ.value).split(/\s+/).filter(function (m) { return m.length > 1; });
      var n = 0;
      lignes.forEach(function (li) {
        var texte = (index && index[li.getAttribute('data-article')]) || plat(li.textContent);
        var ok = mots.every(function (m) { return texte.indexOf(m) >= 0; });
        li.hidden = !ok; if (ok) n++;
      });
      if (rien) rien.hidden = n > 0;
      if (dit) dit.textContent = mots.length ? (n === 0 ? '' : n + (n > 1 ? ' articles' : ' article')) : '';
    }
    champ.addEventListener('input', filtrer);
    var form = champ.form;
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); var vus = lignes.filter(function (l) { return !l.hidden; }); if (vus.length === 1) { var a = vus[0].querySelector('a'); if (a) location.href = a.href; } });
    try { var q = new URLSearchParams(location.search).get('q'); if (q) { champ.value = q; filtrer(); } } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancher); else brancher();
})();
