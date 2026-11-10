// ── vrm.center/f/<adresse> : la page PUBLIQUE d'un formateur (10 nov., lot AR) ─
// Lit UNE route, sans session : /api/compte?mode=formateur&f=<adresse>
// (api/_lib/formateur.js → la fonction `vrm_form_page` de la migration 031, qui
// ne rend que ce que le formateur a PUBLIÉ). Trois états : la page · « pas en
// ligne » (inconnue, dépubliée, formateur sans abonnement : la même phrase,
// rien n'est deviné) · « pas pu lire » (réseau, base) avec « Réessayer ».
// Tout est posé en TEXTE (textContent) : rien d'écrit par le formateur n'est
// interprété. « Demander à rejoindre » ouvre VRM (connexion d'abord) sur
// Communauté → Groupes, où l'élève voit le groupe, choisit ce qu'il partage
// (« rien » coché) et DEMANDE : le formateur valide (règle de la 025).
// Fichier à part : la CSP de vercel.json n'autorise aucun script en ligne.
(function () {
  var racine = document.documentElement;
  var sombre = null;
  try { var v = localStorage.getItem('vinted_dark'); sombre = v === 'true' ? true : v === 'false' ? false : null; } catch (_) {}
  var mq = null;
  try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch (_) {}
  var poserTheme = function () { racine.setAttribute('data-theme', (sombre != null ? sombre : !!(mq && mq.matches)) ? 'dark' : 'light'); };
  poserTheme();
  try { if (mq && mq.addEventListener) mq.addEventListener('change', poserTheme); } catch (_) {}

  var ADRESSE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var adresseDe = function () {
    var m = /^\/f\/([^/?#]+)\/?$/.exec(location.pathname || '');
    var brut = m ? m[1] : (new URLSearchParams(location.search).get('f') || '');
    try { brut = decodeURIComponent(brut); } catch (_) {}
    var a = String(brut).trim().toLowerCase();
    return ADRESSE_RE.test(a) && a.indexOf('--') < 0 ? a : '';
  };
  // Le lien qui ouvre VRM sur le groupe (Communauté → Groupes) : seulement des
  // valeurs vérifiées (adresse de la forme permise, identifiant uuid).
  var lienRejoindre = function (adresse, id) {
    return '/?tab=communaute&formateur=' + encodeURIComponent(adresse) + '&g=' + encodeURIComponent(id);
  };

  var $ = function (id) { return document.getElementById(id); };
  var etat = function (quoi, titre, phrase, reessayer) {
    var main = document.querySelector('main');
    main.setAttribute('data-formateur-etat', quoi);
    $('page').hidden = quoi !== 'lu';
    $('etat').hidden = quoi === 'lu';
    if (titre != null) $('etat-titre').textContent = titre;
    if (phrase != null) $('etat-phrase').textContent = phrase;
    $('reessayer').hidden = !reessayer;
  };

  var montrer = function (p) {
    $('nom').textContent = p.nom;
    $('presentation').textContent = p.presentation || '';
    document.title = p.nom + ' · Formateur sur VRM';
    var ul = $('groupes');
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    var gs = (p.groupes || []).filter(function (g) { return g && UUID_RE.test(String(g.id || '')); });
    gs.forEach(function (g) {
      var li = document.createElement('li');
      li.className = 'groupe';
      li.setAttribute('data-formateur-groupe', g.id);
      var b = document.createElement('b'); b.textContent = String(g.nom || '');
      var d = document.createElement('p'); d.textContent = String(g.description || '');
      var a = document.createElement('a');
      a.className = 'rejoindre'; a.href = lienRejoindre(p.adresse, g.id);
      a.textContent = 'Demander à rejoindre';
      a.setAttribute('data-formateur-rejoindre', g.id);
      li.appendChild(b); li.appendChild(d); li.appendChild(a);
      ul.appendChild(li);
    });
    ul.hidden = gs.length === 0;
    $('aucun').hidden = gs.length > 0;
    $('note').hidden = gs.length === 0;
    etat('lu');
  };

  var lire = function () {
    var adresse = adresseDe();
    if (!adresse) { etat('introuvable', 'Page introuvable', 'Cette page n’existe pas, ou n’est plus en ligne.', false); return; }
    etat('chargement', 'Un instant…', 'On lit la page.', false);
    fetch('/api/compte?mode=formateur&f=' + encodeURIComponent(adresse), { headers: { accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { return r.json().catch(function () { return null; }).then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (x) {
        var j = x.j || {};
        if (x.status === 200 && j.ok === true && j.page && typeof j.page.nom === 'string') return montrer(j.page);
        if (x.status === 404 || j.erreur === 'page' || j.erreur === 'non-installe') return etat('introuvable', 'Page introuvable', 'Cette page n’existe pas, ou n’est plus en ligne.', false);
        etat('pas-su', 'Page pas lue', 'Je n’ai pas pu lire la page. Réessaie dans un instant.', true);
      })
      .catch(function () { etat('pas-su', 'Page pas lue', 'Je n’ai pas pu lire la page. Réessaie dans un instant.', true); });
  };

  document.addEventListener('DOMContentLoaded', function () {
    $('reessayer').addEventListener('click', lire);
    lire();
  });
})();
