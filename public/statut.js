// ── LES INCIDENTS CONNUS — vrm.center/statut (8 nov., confiance) ─────────────
// La page d'état (/etat.js, 6 nov.) dit ce que le serveur sonde ; celle-ci y
// ajoute les incidents ÉCRITS À LA MAIN dans `public/statut-incidents.json`.
// Une page PUBLIQUE : aucune donnée d'un vendeur n'y entre. Deux barrières :
//   1. `scripts/audit-confiance.cjs` refuse un fichier qui en porte ;
//   2. ici, `incidentsSurs` ne garde que les champs connus, bornés, et retire
//      tout texte qui ressemble à une donnée personnelle (adresse e-mail,
//      téléphone, long numéro — commande, suivi —, pseudo en @, identifiant).
// Lit UN fichier, du même site, et rien d'autre (ni session, ni base).
(function () {
  var TOUCHE = { base: 'Base de données', emails: 'Réception des e-mails', notifications: 'Notifications', extension: 'Extension', autre: 'Autre' };
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

  var quand = function (t) {
    try { return new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }); } catch (_) { return new Date(t).toISOString().slice(0, 16).replace('T', ' '); }
  };
  var el = function (tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  function afficher(liste) {
    var ul = document.getElementById('incidents');
    if (!ul) return;
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    if (liste === null) { ul.setAttribute('data-incidents', 'pas-su'); ul.appendChild(el('li', 'vide', 'La liste des incidents n’a pas pu être lue. Réessaie dans un instant.')); return; }
    ul.setAttribute('data-incidents', String(liste.length));
    if (!liste.length) { ul.appendChild(el('li', 'vide', 'Aucun incident signalé ces 30 derniers jours.')); return; }
    liste.forEach(function (x) {
      var li = el('li'); li.setAttribute('data-incident', x.fin == null ? 'en-cours' : 'resolu');
      var tete = el('div', 'tete-inc');
      var gauche = el('span'); gauche.appendChild(el('b', null, x.titre));
      var periode = x.fin == null ? 'Depuis le ' + quand(x.debut) : quand(x.debut) + ' – ' + quand(x.fin);
      if (x.touche.length) periode += ' · ' + x.touche.map(function (k) { return TOUCHE[k]; }).join(', ');
      gauche.appendChild(el('span', 'quand', periode));
      tete.appendChild(gauche);
      tete.appendChild(el('span', 'mot', x.fin == null ? 'En cours' : 'Résolu'));
      li.appendChild(tete);
      if (x.texte) li.appendChild(el('p', null, x.texte));
      ul.appendChild(li);
    });
  }

  function lire() {
    var c = typeof AbortController === 'function' ? new AbortController() : null;
    var t = c ? setTimeout(function () { c.abort(); }, 8000) : null;
    return fetch('/statut-incidents.json', { cache: 'no-store', signal: c ? c.signal : undefined, headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { afficher(incidentsSurs(j)); }, function () { afficher(null); })
      .finally(function () { if (t) clearTimeout(t); });
  }

  if (typeof window !== 'undefined') window.VRM_STATUT = { incidentsSurs: incidentsSurs };
  var demarrer = function () {
    lire();
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') lire(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
