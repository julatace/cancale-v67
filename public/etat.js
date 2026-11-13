// ── LA PAGE D'ÉTAT PUBLIQUE — vrm.center/etat (6 nov. ; 13 nov., lot 52) ────
// Lit /api/sante (api/compte.js, `etat` : base · e-mails · notifications, et
// l'heure de la vérification) et /etat-version.json (la version de l'extension
// servie, posée au build par vite.config.js). Rafraîchie toutes les 60 s, et
// SEULEMENT quand la page est visible (un onglet oublié ne sonde rien).
// Trois états par morceau : 'ok' · 'panne' · 'inconnu' — « pas vérifié » n'est
// ni une panne ni un feu vert.
// (13 nov., lot 52) PAS DE RÉPONSE ⇒ « ÉTAT INCONNU », jamais « tout va bien » —
// et pas « VRM est en panne » non plus : depuis cette page, une absence de
// réponse peut venir de la connexion du visiteur. Pareil pour une réponse dont
// la vérification a plus de `PERIME_MS` (une copie figée quelque part ne dit rien
// de maintenant). « Dernière vérification » est celle qui a RÉPONDU ; un essai
// sans réponse est dit à part, avec son heure. Plus de « nous sommes prévenus » :
// la page ne peut pas le savoir.
// Aucune donnée d'un vendeur n'est lue ni affichée ; des champs de /api/sante,
// seul `etat` (base, e-mails, notifications, heure) est lu.
// Fichier à part : la CSP de vercel.json n'autorise aucun script en ligne.
(function () {
  // Le thème AVANT le premier rendu : le choix fait dans l'app (`vinted_dark`,
  // même origine) s'il existe, sinon celui du système.
  var racine = document.documentElement;
  var sombre = null;
  try { var v = localStorage.getItem('vinted_dark'); if (v != null) sombre = JSON.parse(v) === true; } catch (_) {}
  var mq = null;
  try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch (_) {}
  var poserTheme = function () { racine.setAttribute('data-theme', (sombre != null ? sombre : !!(mq && mq.matches)) ? 'dark' : 'light'); };
  poserTheme();
  if (sombre == null && mq && mq.addEventListener) mq.addEventListener('change', poserTheme);

  var NOMS = { base: 'la base de données', emails: 'la réception des e-mails', notifications: 'les notifications' };
  var MOTS = { ok: 'Fonctionne', panne: 'En panne', inconnu: 'Pas vérifié' };
  var MORCEAUX = ['base', 'emails', 'notifications'];
  var PERIODE = 60000, DELAI = 8000, PERIME_MS = 10 * 60000;
  var derniere = 0, enCours = false, derniereReussie = null;

  var liste = function (noms) {
    if (noms.length < 2) return noms.join('');
    return noms.slice(0, -1).join(', ') + ' et ' + noms[noms.length - 1];
  };
  var heure = function (iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    try { return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (_) { return d.toISOString().slice(11, 19); }
  };
  var lire = function (url) {
    var c = typeof AbortController === 'function' ? new AbortController() : null;
    var t = c ? setTimeout(function () { c.abort(); }, DELAI) : null;
    return fetch(url, { cache: 'no-store', signal: c ? c.signal : undefined, headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .finally(function () { if (t) clearTimeout(t); });
  };

  var poserMorceau = function (id, etat, mot) {
    var li = document.querySelector('[data-etat-morceau="' + id + '"]');
    if (!li) return;
    li.setAttribute('data-etat', etat);
    li.querySelector('.mot').textContent = mot || MOTS[etat] || MOTS.inconnu;
  };
  var poserHeures = function (essaiSansReponse) {
    var h = document.getElementById('heure'), e = document.getElementById('essai');
    h.textContent = derniereReussie ? heure(derniereReussie) : '—';
    h.setAttribute('datetime', derniereReussie || '');
    if (e) e.textContent = essaiSansReponse ? ' · essai sans réponse à ' + heure(new Date().toISOString()) : '';
  };

  // La réponse de /api/sante → l'état de la page. PURE (l'audit l'exécute).
  //   { global: 'ok' | 'panne' | 'partiel' | 'inconnu', morceaux, raison }
  var juger = function (sante, maintenant) {
    var e = sante && sante.ok === true && sante.etat && typeof sante.etat === 'object' && !Array.isArray(sante.etat) ? sante.etat : null;
    var inconnus = { base: 'inconnu', emails: 'inconnu', notifications: 'inconnu' };
    if (!e) return { global: 'inconnu', morceaux: inconnus, raison: 'muet' };
    var t = Date.parse(String(e.verifieA || ''));
    if (!isFinite(t)) return { global: 'inconnu', morceaux: inconnus, raison: 'sans-heure' };
    if (maintenant - t > PERIME_MS) return { global: 'inconnu', morceaux: inconnus, raison: 'perime', verifieA: e.verifieA };
    var m = {};
    MORCEAUX.forEach(function (k) { m[k] = e[k] === 'ok' || e[k] === 'panne' ? e[k] : 'inconnu'; });
    var pannes = MORCEAUX.filter(function (k) { return m[k] === 'panne'; });
    var pasSu = MORCEAUX.filter(function (k) { return m[k] === 'inconnu'; });
    return { global: pannes.length ? 'panne' : pasSu.length ? 'partiel' : 'ok', morceaux: m, pannes: pannes, inconnus: pasSu, verifieA: e.verifieA };
  };

  var afficher = function (sante, version) {
    var main = document.querySelector('main');
    var titre = document.getElementById('titre'), phrase = document.getElementById('phrase');
    var j = juger(sante, Date.now());
    MORCEAUX.forEach(function (k) { poserMorceau(k, j.morceaux[k]); });
    poserMorceau('extension', version ? 'ok' : 'inconnu', version ? 'Version ' + version : MOTS.inconnu);
    main.setAttribute('data-etat-global', j.global);
    if (j.global === 'inconnu') {
      titre.textContent = 'État inconnu';
      phrase.textContent = j.raison === 'perime'
        ? 'La dernière vérification reçue date de plus de 10 minutes : elle ne dit rien de maintenant. Nouvel essai dans une minute.'
        : 'VRM n’a pas répondu à cette page. Ça peut venir de ta connexion comme de VRM : on ne sait pas. Nouvel essai dans une minute.';
      poserHeures(j.raison !== 'perime');
      return;
    }
    if (j.global === 'panne') {
      titre.textContent = 'Panne en cours sur ' + liste(j.pannes.map(function (k) { return NOMS[k]; }));
      phrase.textContent = 'Cette page se remet à jour toute seule, chaque minute.';
    } else if (j.global === 'partiel') {
      titre.textContent = 'Vérification incomplète';
      phrase.textContent = 'Aucune panne vue, mais pas vérifié pour l’instant : ' + liste(j.inconnus.map(function (k) { return NOMS[k]; })) + '.';
    } else {
      titre.textContent = 'Tout fonctionne';
      phrase.textContent = 'La base, la réception des e-mails et les notifications répondent normalement.';
    }
    derniereReussie = String(j.verifieA);
    poserHeures(false);
  };

  var verifier = function () {
    if (enCours) return;
    enCours = true; derniere = Date.now();
    Promise.all([
      lire('/api/sante').catch(function () { return null; }),
      lire('/etat-version.json').then(function (j) { return j && /^\d+\.\d+\.\d+$/.test(String(j.extension || '')) ? String(j.extension) : null; }).catch(function () { return null; }),
    ]).then(function (r) { afficher(r[0], r[1]); }).finally(function () { enCours = false; });
  };

  window.VRM_ETAT = { juger: juger, PERIME_MS: PERIME_MS };
  var demarrer = function () {
    verifier();
    setInterval(function () { if (document.visibilityState === 'visible' && Date.now() - derniere >= PERIODE - 500) verifier(); }, 5000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && Date.now() - derniere >= PERIODE) verifier(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
