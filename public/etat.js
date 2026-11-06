// ── LA PAGE D'ÉTAT PUBLIQUE — vrm.center/etat (6 nov.) ──────────────────────
// Lit /api/sante (api/compte.js, `etat` : base · e-mails · notifications, et
// l'heure de la vérification) et /etat-version.json (la version de l'extension
// servie, posée au build par vite.config.js). Rafraîchie toutes les 60 s, et
// SEULEMENT quand la page est visible (un onglet oublié ne sonde rien).
// Trois états par morceau : 'ok' · 'panne' · 'inconnu' — « pas vérifié » n'est
// ni une panne ni un feu vert. Si /api/sante ne répond pas : « VRM ne répond
// pas ». Aucune donnée d'un vendeur n'est lue ni affichée.
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
  var PERIODE = 60000, DELAI = 8000;
  var derniere = 0, enCours = false;

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

  var afficher = function (sante, version) {
    var main = document.querySelector('main');
    var titre = document.getElementById('titre'), phrase = document.getElementById('phrase');
    var e = sante && sante.ok === true && sante.etat && typeof sante.etat === 'object' ? sante.etat : null;
    if (!e) {
      main.setAttribute('data-etat-global', 'injoignable');
      titre.textContent = 'VRM ne répond pas';
      phrase.textContent = 'Nous sommes prévenus. Réessaie dans quelques minutes : tes données ne sont pas touchées.';
      ['base', 'emails', 'notifications'].forEach(function (k) { poserMorceau(k, 'inconnu'); });
      poserMorceau('extension', version ? 'ok' : 'inconnu', version ? 'Version ' + version : MOTS.inconnu);
      document.getElementById('heure').textContent = heure(new Date().toISOString());
      return;
    }
    var etats = {};
    ['base', 'emails', 'notifications'].forEach(function (k) {
      var x = e[k] === 'ok' || e[k] === 'panne' ? e[k] : 'inconnu';
      etats[k] = x; poserMorceau(k, x);
    });
    poserMorceau('extension', version ? 'ok' : 'inconnu', version ? 'Version ' + version : MOTS.inconnu);
    var pannes = Object.keys(etats).filter(function (k) { return etats[k] === 'panne'; });
    var inconnus = Object.keys(etats).filter(function (k) { return etats[k] === 'inconnu'; });
    if (pannes.length) {
      main.setAttribute('data-etat-global', 'panne');
      titre.textContent = 'Panne en cours sur ' + liste(pannes.map(function (k) { return NOMS[k]; }));
      phrase.textContent = 'Nous sommes prévenus. Le reste fonctionne, et rien de ce qui est déjà enregistré n’est perdu.';
    } else if (inconnus.length) {
      main.setAttribute('data-etat-global', 'partiel');
      titre.textContent = 'Rien ne signale de panne';
      phrase.textContent = 'Pas vérifié pour l’instant : ' + liste(inconnus.map(function (k) { return NOMS[k]; })) + '.';
    } else {
      main.setAttribute('data-etat-global', 'ok');
      titre.textContent = 'Tout fonctionne';
      phrase.textContent = 'La base, la réception des e-mails et les notifications répondent normalement.';
    }
    document.getElementById('heure').textContent = heure(e.verifieA);
    document.getElementById('heure').setAttribute('datetime', String(e.verifieA || ''));
  };

  var verifier = function () {
    if (enCours) return;
    enCours = true; derniere = Date.now();
    Promise.all([
      lire('/api/sante').catch(function () { return null; }),
      lire('/etat-version.json').then(function (j) { return j && /^\d+\.\d+\.\d+$/.test(String(j.extension || '')) ? String(j.extension) : null; }).catch(function () { return null; }),
    ]).then(function (r) { afficher(r[0], r[1]); }).finally(function () { enCours = false; });
  };

  var demarrer = function () {
    verifier();
    setInterval(function () { if (document.visibilityState === 'visible' && Date.now() - derniere >= PERIODE - 500) verifier(); }, 5000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && Date.now() - derniere >= PERIODE) verifier(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
