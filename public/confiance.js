// ── vrm.center/confiance (13 nov., lot 50) — le thème, rien d'autre ─────────
// La CSP de vercel.json n'autorise aucun script en ligne : ce fichier pose le
// thème AVANT le premier rendu (le choix fait dans l'app, `vinted_dark`, même
// origine ; sinon celui du système). Il ne lit rien d'autre, n'envoie rien.
(function () {
  var racine = document.documentElement;
  var sombre = null;
  try { var v = localStorage.getItem('vinted_dark'); if (v != null) sombre = JSON.parse(v) === true; } catch (_) {}
  var mq = null;
  try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch (_) {}
  var poser = function () { racine.setAttribute('data-theme', (sombre != null ? sombre : !!(mq && mq.matches)) ? 'dark' : 'light'); };
  poser();
  if (sombre == null && mq && mq.addEventListener) mq.addEventListener('change', poser);
})();
