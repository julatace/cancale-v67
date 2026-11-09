// ── vrm.center/statut (8 nov., confiance ; 9 nov., sondes automatiques) ─────
// La page lit TROIS fichiers du même site, rien d'autre (ni session, ni base) :
//   /api/sante             `statut` : l'état rangé par les sondes automatiques
//                          (api/_lib/statut-sondes.js, toutes les 10 min) — six
//                          morceaux, 30 jours, incidents ouverts/fermés — et
//                          `etat` : la sonde en direct (base, e-mails, notifs) ;
//   /etat-version.json     la version de l'extension servie ;
//   /statut-incidents.json les incidents ÉCRITS À LA MAIN.
// Trois états partout : 'ok' · 'degrade' · 'pas_su'. « Pas su » est GRIS,
// jamais un feu vert ; un état rangé il y a plus de 45 min est « pas su »
// (le serveur le dit déjà, la page le revérifie sur l'heure).
// Une page PUBLIQUE : aucune donnée d'un vendeur n'y entre. Deux barrières :
//   1. `scripts/audit-confiance.cjs` refuse un fichier qui en porte ;
//   2. ici, `incidentsSurs` ne garde que les champs connus, bornés, et retire
//      tout texte qui ressemble à une donnée personnelle (adresse e-mail,
//      téléphone, long numéro — commande, suivi —, pseudo en @, identifiant) ;
//      `statutSur` ne garde que des mots connus, des dates et des nombres.
// Fichier à part : la CSP de vercel.json n'autorise aucun script en ligne.
(function () {
  var TOUCHE = { base: 'Base de données', emails: 'Réception des e-mails', notifications: 'Notifications', extension: 'Extension', autre: 'Autre', connexion: 'Connexion', envoi: 'Envoi des e-mails' };
  var COMPOSANTS = ['base', 'connexion', 'emails', 'envoi', 'notifications', 'extension'];
  var ETATS = ['ok', 'degrade', 'pas_su'];
  var RAISONS = ['repond', 'configure', 'recent', 'erreur-http', 'cle-absente', 'silence', 'collecteur-arrete', 'identifiants-refuses', 'reponse-illisible', 'sans-reponse', 'dependance', 'historique-court', 'jamais-vu', 'non-configure', 'pas-sonde', 'sondes-arretees'];
  var PERIME_MS = 45 * 60000;
  var RESOLUS_JOURS = 30;
  var PERSO = [
    /[^\s@]+@[^\s@]+\.[^\s@]+/,                 // une adresse e-mail
    /(^|[^\w])@[A-Za-z0-9_.-]{2,}/,              // un pseudo « @quelqu'un »
    /(\+33|0)[1-9](?:[\s.-]?\d{2}){4}/,          // un téléphone
    /\d{7,}/,                                    // un long numéro (commande, suivi, transaction)
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, // un identifiant
    /\bFR\d{2}[\s\d]{10,}/,                      // un IBAN
  ];
  var RETIRE = 'Texte retiré : il contenait une information personnelle.';
  var perso = function (t) { for (var i = 0; i < PERSO.length; i++) if (PERSO[i].test(t)) return true; return false; };
  var texte = function (v, max) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''; };
  var date = function (v) { var t = typeof v === 'string' ? Date.parse(v) : NaN; return isFinite(t) ? t : null; };
  var dans = function (l, v) { return l.indexOf(v) >= 0; };
  var nombre = function (v) { return typeof v === 'number' && isFinite(v) ? Math.max(0, Math.round(v)) : null; };

  // Le fichier → la liste affichable (en cours d'abord, puis le plus récent).
  // `null` = fichier illisible (« pas su », jamais « aucun incident »). Pure :
  // l'audit l'exécute.
  function incidentsSurs(j, maintenant) {
    var now = typeof maintenant === 'number' ? maintenant : Date.now();
    var l = j && Array.isArray(j.incidents) ? j.incidents : null;
    if (!l) return null;
    var out = [];
    for (var i = 0; i < l.length && out.length < 20; i++) {
      var x = l[i] || {};
      var debut = date(x.debut);
      if (debut == null) continue;
      var fin = x.fin == null ? null : date(x.fin);
      if (x.fin != null && fin == null) continue;
      if (fin != null && now - fin > RESOLUS_JOURS * 86400000) continue;
      var titre = texte(x.titre, 120), corps = texte(x.texte, 600);
      if (!titre) continue;
      if (perso(titre)) titre = 'Incident';
      if (perso(corps)) corps = RETIRE;
      var touche = (Array.isArray(x.touche) ? x.touche : []).filter(function (k) { return Object.prototype.hasOwnProperty.call(TOUCHE, k); });
      out.push({ debut: debut, fin: fin, titre: titre, texte: corps, touche: touche });
    }
    out.sort(function (a, b) { return ((b.fin == null) - (a.fin == null)) || b.debut - a.debut; });
    return out;
  }

  // L'état des sondes (`/api/sante` → `statut`) → ce que la page affiche.
  // Seulement des mots connus, des dates, des nombres ; un champ inconnu ne sort
  // pas. Rangé il y a plus de 45 min ⇒ tout « pas su ». Absent ⇒ null. Pure.
  function statutSur(s, maintenant) {
    var now = typeof maintenant === 'number' ? maintenant : Date.now();
    if (!s || typeof s !== 'object') return null;
    var at = date(s.at);
    if (at == null) return null;
    var perime = s.perime === true || now - at > PERIME_MS;
    var src = s.composants && typeof s.composants === 'object' ? s.composants : {};
    var composants = {};
    COMPOSANTS.forEach(function (c) {
      var x = src[c] && typeof src[c] === 'object' ? src[c] : {};
      var etat = !perime && dans(ETATS, x.etat) ? x.etat : 'pas_su';
      var raison = perime ? 'sondes-arretees' : (dans(RAISONS, x.raison) ? x.raison : 'pas-sonde');
      composants[c] = { etat: etat, raison: raison, silenceH: perime ? null : nombre(x.silenceH), seuilH: perime ? null : nombre(x.seuilH) };
    });
    var jours = [];
    (Array.isArray(s.jours) ? s.jours : []).slice(-30).forEach(function (j) {
      if (!j || typeof j.jour !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(j.jour)) return;
      var l = { jour: j.jour };
      COMPOSANTS.forEach(function (c) { l[c] = dans(ETATS, j[c]) ? j[c] : 'pas_su'; });
      jours.push(l);
    });
    var incidents = [];
    (Array.isArray(s.incidents) ? s.incidents : []).forEach(function (x) {
      if (!x || !dans(COMPOSANTS, x.composant)) return;
      var debut = date(x.debut); if (debut == null) return;
      var fin = x.fin == null ? null : date(x.fin);
      if (x.fin != null && fin == null) return;
      if (fin != null && now - fin > RESOLUS_JOURS * 86400000) return;
      incidents.push({ composant: x.composant, debut: debut, fin: fin, dureeMin: nombre(x.dureeMin) });
    });
    return { at: at, perime: perime, composants: composants, jours: jours, incidents: incidents.slice(0, 40) };
  }

  if (typeof window !== 'undefined') window.VRM_STATUT = { incidentsSurs: incidentsSurs, statutSur: statutSur };
  if (typeof document === 'undefined' || !document.documentElement) return;

  // ── Le thème AVANT le premier rendu : le choix de l'app (`vinted_dark`), sinon le système.
  var racine = document.documentElement;
  var sombre = null;
  try { var v = localStorage.getItem('vinted_dark'); if (v != null) sombre = JSON.parse(v) === true; } catch (_) {}
  var mq = null;
  try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch (_) {}
  var poserTheme = function () { racine.setAttribute('data-theme', (sombre != null ? sombre : !!(mq && mq.matches)) ? 'dark' : 'light'); };
  poserTheme();
  if (sombre == null && mq && mq.addEventListener) mq.addEventListener('change', poserTheme);

  // Les PHRASES d'un incident automatique : celles du serveur (api/_lib/statut-sondes.js PHRASES), recopiées.
  var PHRASES = {
    base: 'La base de données répond mal : l’app peut ne pas afficher tes données. Rien de ce qui est enregistré n’est perdu.',
    connexion: 'La connexion à VRM est perturbée : tu peux ne pas réussir à te connecter.',
    emails: 'Les e-mails arrivent en retard : ventes, bordereaux et codes de retrait peuvent tarder à apparaître.',
    envoi: 'Les e-mails envoyés par VRM ne partent pas pour l’instant.',
    notifications: 'Les notifications ne partent pas pour l’instant.',
    extension: 'Aucune extension ne donne signe de vie : les lectures de Vinted peuvent être en retard.',
  };
  var NOMS = { base: 'la base de données', connexion: 'la connexion', emails: 'la réception des e-mails', envoi: 'l’envoi des e-mails', notifications: 'les notifications', extension: 'l’extension' };
  var MOT_OK = { base: 'Fonctionne', connexion: 'Fonctionne', emails: 'Fonctionne', envoi: 'Fonctionne', notifications: 'Configurées', extension: 'Active' };
  var MOT_PAS_SU = { 'non-configure': 'Pas en service', 'historique-court': 'Pas encore jugé', 'jamais-vu': 'Pas encore vu' };
  var DETAIL = {
    'erreur-http': 'Le service a répondu par une erreur.',
    'reponse-illisible': 'Le service a répondu, mais pas ce qu’on attend.',
    'cle-absente': 'Un réglage du serveur manque : rien ne peut partir.',
    'collecteur-arrete': 'Le relais qui apporte les e-mails ne passe plus.',
    'identifiants-refuses': 'Le serveur d’envoi refuse la connexion de VRM.',
    'sans-reponse': 'La vérification n’a pas eu de réponse : ni panne ni feu vert.',
    dependance: 'Pas vérifiable tant que la base ne répond pas.',
    'non-configure': 'L’envoi d’e-mails n’est pas encore branché.',
    'pas-sonde': 'Pas encore vérifié.',
    'sondes-arretees': 'Les vérifications automatiques ne sont pas passées depuis plus de 45 minutes.',
    'historique-court': 'Moins de 3 jours d’historique : pas encore de comparaison.',
    'jamais-vu': 'Rien vu encore.',
  };

  var el = function (tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  var quand = function (t) {
    try { return new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }); } catch (_) { return new Date(t).toISOString().slice(0, 16).replace('T', ' '); }
  };
  var duree = function (min) {
    if (min == null) return '';
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    if (h < 48) return h + ' h' + (m ? ' ' + (m < 10 ? '0' : '') + m : '');
    return Math.round(h / 24) + ' jours';
  };
  var ilYa = function (t) {
    var min = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (min < 1) return 'à l’instant';
    if (min < 60) return 'il y a ' + min + ' min';
    var h = Math.round(min / 60);
    return h < 48 ? 'il y a ' + h + ' h' : 'il y a ' + Math.round(h / 24) + ' jours';
  };
  var liste = function (noms) { return noms.length < 2 ? noms.join('') : noms.slice(0, -1).join(', ') + ' et ' + noms[noms.length - 1]; };
  var lire = function (url) {
    var c = typeof AbortController === 'function' ? new AbortController() : null;
    var t = c ? setTimeout(function () { c.abort(); }, 8000) : null;
    return fetch(url, { cache: 'no-store', signal: c ? c.signal : undefined, headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .finally(function () { if (t) clearTimeout(t); });
  };

  var detailDe = function (c, x) {
    if (x.raison === 'silence' || (x.raison === 'recent' && x.etat === 'ok' && (c === 'emails' || c === 'extension'))) {
      if (x.silenceH == null) return '';
      var quoi = c === 'emails' ? 'Dernier e-mail rangé' : 'Dernier signe de vie';
      var depuis = x.silenceH < 1 ? 'il y a moins d’une heure' : 'il y a ' + x.silenceH + ' h';
      return quoi + ' ' + depuis + (x.raison === 'silence' && x.seuilH ? ' — d’habitude moins de ' + x.seuilH + ' h.' : '.');
    }
    return DETAIL[x.raison] || '';
  };

  function poserComposants(st, direct) {
    COMPOSANTS.forEach(function (c) {
      var li = document.querySelector('[data-statut-morceau="' + c + '"]');
      if (!li) return;
      var x = st ? st.composants[c] : { etat: 'pas_su', raison: 'pas-sonde' };
      // La sonde EN DIRECT (/api/sante → etat) peut dire une panne de la base que l'état rangé n'a pas pu écrire.
      if (c === 'base' && direct === 'panne') x = { etat: 'degrade', raison: 'erreur-http' };
      li.setAttribute('data-etat', x.etat);
      li.querySelector('.mot').textContent = x.etat === 'ok' ? MOT_OK[c] : x.etat === 'degrade' ? 'Dégradé' : (MOT_PAS_SU[x.raison] || 'Pas vérifié');
      var d = li.querySelector('.detail'); if (d) d.textContent = detailDe(c, x);
      var barres = li.querySelector('.barres');
      if (!barres) return;
      while (barres.firstChild) barres.removeChild(barres.firstChild);
      var jours = st ? st.jours : [];
      var n = 0;
      for (var i = 0; i < 30; i++) {
        var j = jours[jours.length - 30 + i];
        var b = el('span', 'barre');
        var e = j ? j[c] : 'pas_su';
        b.setAttribute('data-etat', e);
        if (j) b.setAttribute('data-jour', j.jour);
        b.title = (j ? j.jour.split('-').reverse().join('/') : 'jour') + ' : ' + (e === 'ok' ? 'normal' : e === 'degrade' ? 'incident' : 'pas vérifié');
        barres.appendChild(b);
        if (e === 'degrade') n++;
      }
      barres.setAttribute('aria-label', '30 derniers jours : ' + (n ? n + ' jour' + (n > 1 ? 's' : '') + ' avec incident' : 'aucun incident'));
    });
  }

  function poserTete(st, sante) {
    var main = document.querySelector('main');
    var titre = document.getElementById('titre'), phrase = document.getElementById('phrase'), maj = document.getElementById('maj');
    if (!sante) {
      main.setAttribute('data-etat-global', 'injoignable');
      titre.textContent = 'VRM ne répond pas';
      phrase.textContent = 'Nous sommes prévenus. Réessaie dans quelques minutes : tes données ne sont pas touchées.';
      maj.textContent = 'La page n’a pas pu joindre VRM.';
      return;
    }
    var direct = sante.etat && sante.etat.base;
    var degrades = st ? COMPOSANTS.filter(function (c) { return st.composants[c].etat === 'degrade'; }) : [];
    if (direct === 'panne' && !dans(degrades, 'base')) degrades.unshift('base');
    var vus = st ? COMPOSANTS.filter(function (c) { return st.composants[c].etat !== 'pas_su'; }) : [];
    if (degrades.length) {
      main.setAttribute('data-etat-global', 'panne');
      titre.textContent = 'Incident en cours sur ' + liste(degrades.map(function (c) { return NOMS[c]; }));
      phrase.textContent = degrades.length === 1 ? PHRASES[degrades[0]] + ' On s’en occupe.' : 'On s’en occupe. Le reste fonctionne, et rien de ce qui est déjà enregistré n’est perdu.';
    } else if (!st || !vus.length) {
      main.setAttribute('data-etat-global', 'partiel');
      titre.textContent = 'État pas vérifié';
      phrase.textContent = st && st.perime ? 'Les vérifications automatiques ne sont pas passées récemment : on ne peut pas dire que tout va bien.' : 'Les vérifications automatiques n’ont encore rien rangé.';
    } else if (vus.length < COMPOSANTS.length) {
      main.setAttribute('data-etat-global', 'partiel');
      titre.textContent = 'Aucun incident en cours';
      phrase.textContent = 'Pas vérifié pour l’instant : ' + liste(COMPOSANTS.filter(function (c) { return !dans(vus, c); }).map(function (c) { return NOMS[c]; })) + '.';
    } else {
      main.setAttribute('data-etat-global', 'ok');
      titre.textContent = 'Tout fonctionne';
      phrase.textContent = 'Les six morceaux de VRM répondent normalement.';
    }
    if (st) {
      maj.textContent = 'Mis à jour ' + ilYa(st.at) + ' · vérifié automatiquement toutes les 10 minutes.';
      maj.setAttribute('data-maj', String(Math.max(0, Math.round((Date.now() - st.at) / 60000))));
    } else { maj.textContent = 'Pas encore de vérification automatique rangée.'; maj.setAttribute('data-maj', 'pas-su'); }
  }

  function afficherIncidents(auto, mains) {
    var ul = document.getElementById('incidents');
    if (!ul) return;
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    var tous = [];
    (auto || []).forEach(function (x) {
      tous.push({ debut: x.debut, fin: x.fin, titre: (x.fin == null ? 'Incident sur ' : 'Incident résolu sur ') + NOMS[x.composant], texte: PHRASES[x.composant], touche: [x.composant], dureeMin: x.dureeMin, auto: true });
    });
    (mains || []).forEach(function (x) { tous.push({ debut: x.debut, fin: x.fin, titre: x.titre, texte: x.texte, touche: x.touche, auto: false }); });
    tous.sort(function (a, b) { return ((b.fin == null) - (a.fin == null)) || b.debut - a.debut; });
    if (mains === null && !tous.length) { ul.setAttribute('data-incidents', 'pas-su'); ul.appendChild(el('li', 'vide', 'La liste des incidents n’a pas pu être lue. Réessaie dans un instant.')); return; }
    ul.setAttribute('data-incidents', String(tous.length));
    if (!tous.length) { ul.appendChild(el('li', 'vide', 'Aucun incident ces 30 derniers jours.')); return; }
    tous.slice(0, 30).forEach(function (x) {
      var li = el('li'); li.setAttribute('data-incident', x.fin == null ? 'en-cours' : 'resolu'); li.setAttribute('data-incident-source', x.auto ? 'auto' : 'main');
      var tete = el('div', 'tete-inc');
      var gauche = el('span'); gauche.appendChild(el('b', null, x.titre));
      var periode = x.fin == null ? 'Depuis le ' + quand(x.debut) : quand(x.debut) + ' – ' + quand(x.fin);
      if (x.auto && x.dureeMin != null) periode += ' · ' + (x.fin == null ? 'depuis ' : 'durée ') + duree(x.dureeMin);
      if (!x.auto && x.touche.length) periode += ' · ' + x.touche.map(function (k) { return TOUCHE[k]; }).join(', ');
      gauche.appendChild(el('span', 'quand', periode));
      tete.appendChild(gauche);
      tete.appendChild(el('span', 'mot', x.fin == null ? 'En cours' : 'Résolu'));
      li.appendChild(tete);
      if (x.texte) li.appendChild(el('p', null, x.texte));
      if (!x.auto) li.appendChild(el('span', 'source', 'Écrit par l’équipe de VRM'));
      ul.appendChild(li);
    });
  }

  var derniere = 0, enCours = false, etatAffiche = null;
  function verifier() {
    if (enCours) return;
    enCours = true; derniere = Date.now();
    Promise.all([
      lire('/api/sante').then(function (j) { return j && j.ok === true ? j : null; }).catch(function () { return null; }),
      fetch('/statut-incidents.json', { cache: 'no-store', headers: { Accept: 'application/json' } }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) { return incidentsSurs(j); }, function () { return null; }),
      lire('/etat-version.json').then(function (j) { return j && /^\d+\.\d+\.\d+$/.test(String(j.extension || '')) ? String(j.extension) : null; }).catch(function () { return null; }),
    ]).then(function (r) {
      var sante = r[0], st = sante ? statutSur(sante.statut) : null;
      etatAffiche = { st: st, sante: sante };
      poserComposants(st, sante && sante.etat ? sante.etat.base : null);
      poserTete(st, sante);
      afficherIncidents(st ? st.incidents : [], r[1]);
      var ver = document.getElementById('version-ext');
      if (ver) ver.textContent = r[2] ? 'Version de l’extension à installer : ' + r[2] + '.' : '';
    }).finally(function () { enCours = false; });
  }
  var demarrer = function () {
    verifier();
    setInterval(function () {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - derniere >= 59500) verifier();
      else if (etatAffiche) poserTete(etatAffiche.st, etatAffiche.sante);   // « il y a N min » avance
    }, 15000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && Date.now() - derniere >= 60000) verifier(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
