// 5.406 : la feuille COMMUNE de l'extension (vrm-ui.js, chargé avant) sur la fenêtre
// (la carte du logo et la liste des comptes, qui chargent vrm-badge.js ici, s'en servent).
try { if (globalThis.VRM_UI) { globalThis.VRM_UI.monter(document.head); document.documentElement.classList.add('vu-racine'); } } catch (_) {}
// ════════════════════════════════════════════════════════════════════════════
//  popup.js — LA CONNEXION DE L'EXTENSION À VRM (refaite le 21 nov., 5.415.0)
//
//  Julien : « même l'extension, au moment de la connexion, ça doit s'améliorer,
//  ce n'est vraiment pas bien, le code est pourri ». Mesuré sur la 5.410.8 par
//  `scripts/bancs/connexion-extension.cjs` (vrai Chromium, vraie extension) :
//  deux champs et six choix à l'ouverture, aucun état lisible, « un instant »
//  affiché sans fin quand VRM ne répond pas, « Se déconnecter » défait en douce
//  par VRM ouvert, on restait sur VRM après la liaison, la fenêtre du menu
//  renvoyait sur VRM sans jamais dire quel compte était relié.
//
//  ⇒ UNE phrase d'état, UN bouton plein. Tout l'état vient d'UNE source :
//    `etatConnexion` du service worker (background.js), lui-même lu dans
//    `chrome.storage.local` (§4.9 : rien ne vit dans une variable de module) :
//      connecte · renouvellement · pause · attente · expiree · deconnecte.
//  « Se connecter » = la liaison existante, sûre : VRM s'ouvre avec
//  `lier-extension=<id>` ; l'app (connectée, ou après SA connexion) demande un
//  nonce à CETTE extension, fait fabriquer une session à elle par le serveur
//  et la lui ADRESSE (`externally_connectable`, ou le pont sur Orion). Aucun
//  jeton dans une adresse, aucun secret nouveau. Une fois reliée, on REVIENT
//  sur l'onglet du site d'où l'on est parti.
//  Le mot de passe VRM reste un recours (lien « Avec mon e-mail et mot de passe
//  VRM ») : il part UNE fois au service worker (`authLogin`), jamais gardé.
//
//  Trois façons d'arriver ici, le MÊME code :
//    · Orion (iPhone) : l'icône ouvre cette fenêtre (pas de menu) ;
//    · Chrome : clic droit sur l'icône → « Connexion à VRM » (`?mode=onglet&depuis=<onglet>`) ;
//      « État de l'extension » (`&vue=etat`) y ajoute la liste des comptes (vrm-badge.js) ;
//    · la carte du logo (`?mode=carte`, vrm-badge.js dans un cadre) et la
//      réparation d'un code périmé (`?mode=reparer`) — inchangées.
// ════════════════════════════════════════════════════════════════════════════
const Q = location.search || '';
const CARTE = /[?&]mode=carte\b/.test(Q);
const REPARER = /[?&]mode=reparer\b/.test(Q);
const FORCE = REPARER && /[?&]force=1\b/.test(Q);   // 5.371 : « Réparer » sur une extension muette
const ONGLET = /[?&]mode=onglet\b/.test(Q);
const VUE_ETAT = /[?&]vue=etat\b/.test(Q);
const DEPUIS = (() => { const m = /[?&]depuis=(\d{1,9})\b/.exec(Q); return m ? Number(m[1]) : null; })();
const APP = 'https://vrm.center';
if (CARTE) { document.body.classList.add('carte'); document.documentElement.classList.add('carte'); }
if (ONGLET) document.body.classList.add('onglet');

// 5.351 : la teinte CHOISIE dans VRM (recopiée par le pont dans `vrmApparence`) passe avant le système.
function poserTeinte(m) {
  let t = '';
  if (m === 'sombre' || m === 'clair') t = m;
  else if (m === 'soir') { const h = new Date().getHours(); t = h >= 19 || h < 7 ? 'sombre' : 'clair'; }
  if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
}
try { chrome.storage.local.get('vrmApparence', (g) => { try { if (chrome.runtime.lastError) return; } catch (_) { return; } poserTeinte(g && g.vrmApparence); }); } catch (_) {}

// Un texte saisi n'entre jamais dans du HTML sans être échappé ; nos gabarits passent par DOMParser.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const poserHtml = (el, html) => { const d = new DOMParser().parseFromString('<body>' + String(html) + '</body>', 'text/html'); el.replaceChildren(...Array.from(d.body.childNodes)); };

// ── LES MOTS (fr, en, es, it, de — la langue du navigateur, comme vrm-ui.js) ──
const MOTS = {
  p_deconnecte: { fr: 'L’extension n’est pas encore reliée à ton compte VRM.', en: 'The extension is not linked to your VRM account yet.', es: 'La extensión aún no está vinculada a tu cuenta VRM.', it: 'L’estensione non è ancora collegata al tuo account VRM.', de: 'Die Erweiterung ist noch nicht mit deinem VRM-Konto verbunden.' },
  p_voulue: { fr: 'Tu as déconnecté l’extension de VRM.', en: 'You disconnected the extension from VRM.', es: 'Has desconectado la extensión de VRM.', it: 'Hai scollegato l’estensione da VRM.', de: 'Du hast die Erweiterung von VRM getrennt.' },
  p_avorte: { fr: 'La connexion n’a pas abouti.', en: 'The connection did not go through.', es: 'La conexión no se completó.', it: 'La connessione non è andata a buon fine.', de: 'Die Verbindung kam nicht zustande.' },
  pied_connecter: { fr: 'VRM s’ouvre : connecte-toi si besoin, l’extension se relie toute seule et tu reviens ici.', en: 'VRM opens: sign in if needed, the extension links itself and you come back here.', es: 'VRM se abre: inicia sesión si hace falta, la extensión se vincula sola y vuelves aquí.', it: 'Si apre VRM: accedi se serve, l’estensione si collega da sola e torni qui.', de: 'VRM öffnet sich: melde dich bei Bedarf an, die Erweiterung verbindet sich selbst und du kommst hierher zurück.' },
  b_connecter: { fr: 'Se connecter', en: 'Sign in', es: 'Conectarse', it: 'Accedi', de: 'Anmelden' },
  b_reconnecter: { fr: 'Se reconnecter', en: 'Sign in again', es: 'Volver a conectarse', it: 'Accedi di nuovo', de: 'Erneut anmelden' },
  p_expiree: { fr: 'Ta session VRM a expiré.', en: 'Your VRM session has expired.', es: 'Tu sesión de VRM ha caducado.', it: 'La tua sessione VRM è scaduta.', de: 'Deine VRM-Sitzung ist abgelaufen.' },
  pied_expiree: { fr: 'Touche « Se reconnecter » : rien à retaper si tu es connecté à VRM.', en: 'Tap “Sign in again”: nothing to retype if you are signed in to VRM.', es: 'Toca «Volver a conectarse»: nada que reescribir si has iniciado sesión en VRM.', it: 'Tocca «Accedi di nuovo»: niente da riscrivere se sei connesso a VRM.', de: 'Tippe auf „Erneut anmelden“: nichts neu eintippen, wenn du bei VRM angemeldet bist.' },
  p_attente: { fr: 'VRM est ouvert : connecte-toi dans l’onglet VRM, l’extension se relie toute seule.', en: 'VRM is open: sign in in the VRM tab, the extension links itself.', es: 'VRM está abierto: inicia sesión en la pestaña de VRM, la extensión se vincula sola.', it: 'VRM è aperto: accedi nella scheda VRM, l’estensione si collega da sola.', de: 'VRM ist geöffnet: melde dich im VRM-Tab an, die Erweiterung verbindet sich selbst.' },
  pied_attente: { fr: 'J’attends jusqu’à {h}.', en: 'Waiting until {h}.', es: 'Espero hasta las {h}.', it: 'Attendo fino alle {h}.', de: 'Ich warte bis {h}.' },
  b_rouvrir: { fr: 'Revenir sur VRM', en: 'Back to VRM', es: 'Volver a VRM', it: 'Torna su VRM', de: 'Zurück zu VRM' },
  l_annuler: { fr: 'Annuler', en: 'Cancel', es: 'Cancelar', it: 'Annulla', de: 'Abbrechen' },
  p_connecte: { fr: 'Connecté à VRM', en: 'Connected to VRM', es: 'Conectado a VRM', it: 'Connesso a VRM', de: 'Mit VRM verbunden' },
  r_compte: { fr: 'Compte VRM', en: 'VRM account', es: 'Cuenta VRM', it: 'Account VRM', de: 'VRM-Konto' },
  r_vinted: { fr: 'Vinted', en: 'Vinted', es: 'Vinted', it: 'Vinted', de: 'Vinted' },
  v_vinted_aucun: { fr: 'pas connecté dans ce navigateur', en: 'not signed in on this browser', es: 'sin sesión en este navegador', it: 'non connesso in questo browser', de: 'in diesem Browser nicht angemeldet' },
  v_vinted_sans_nom: { fr: 'compte n° {n}', en: 'account no. {n}', es: 'cuenta n.º {n}', it: 'account n. {n}', de: 'Konto Nr. {n}' },
  b_ouvrir: { fr: 'Ouvrir VRM', en: 'Open VRM', es: 'Abrir VRM', it: 'Apri VRM', de: 'VRM öffnen' },
  l_deconnecter: { fr: 'Se déconnecter', en: 'Sign out', es: 'Cerrar sesión', it: 'Esci', de: 'Abmelden' },
  p_renouv: { fr: 'Connecté à VRM · session en cours de renouvellement…', en: 'Connected to VRM · renewing the session…', es: 'Conectado a VRM · renovando la sesión…', it: 'Connesso a VRM · rinnovo della sessione…', de: 'Mit VRM verbunden · Sitzung wird erneuert…' },
  p_pause: { fr: 'VRM ne répond pas pour l’instant. L’extension réessaie toute seule à {h} ; rien n’est perdu.', en: 'VRM is not responding right now. The extension retries by itself at {h}; nothing is lost.', es: 'VRM no responde por ahora. La extensión lo reintenta sola a las {h}; no se pierde nada.', it: 'VRM non risponde al momento. L’estensione riprova da sola alle {h}; non si perde nulla.', de: 'VRM antwortet gerade nicht. Die Erweiterung versucht es um {h} selbst erneut; nichts geht verloren.' },
  p_pause_sans: { fr: 'VRM ne répond pas pour l’instant. L’extension réessaie toute seule ; rien n’est perdu.', en: 'VRM is not responding right now. The extension retries by itself; nothing is lost.', es: 'VRM no responde por ahora. La extensión lo reintenta sola; no se pierde nada.', it: 'VRM non risponde al momento. L’estensione riprova da sola; non si perde nulla.', de: 'VRM antwortet gerade nicht. Die Erweiterung versucht es selbst erneut; nichts geht verloren.' },
  b_reessayer: { fr: 'Réessayer maintenant', en: 'Try again now', es: 'Reintentar ahora', it: 'Riprova ora', de: 'Jetzt erneut versuchen' },
  p_ouvre: { fr: 'J’ouvre VRM…', en: 'Opening VRM…', es: 'Abriendo VRM…', it: 'Apro VRM…', de: 'VRM wird geöffnet…' },
  p_muet: { fr: 'L’extension ne répond pas : ouvre chrome://extensions, clique ⟳ sur VRM, puis rouvre cette fenêtre.', en: 'The extension is not responding: open chrome://extensions, click ⟳ on VRM, then reopen this window.', es: 'La extensión no responde: abre chrome://extensions, pulsa ⟳ en VRM y vuelve a abrir esta ventana.', it: 'L’estensione non risponde: apri chrome://extensions, clicca ⟳ su VRM e riapri questa finestra.', de: 'Die Erweiterung antwortet nicht: öffne chrome://extensions, klicke bei VRM auf ⟳ und öffne dieses Fenster erneut.' },
  p_ancien: { fr: 'L’extension de ce navigateur tourne encore sur son ancien code : ouvre chrome://extensions et clique ⟳ sur VRM.', en: 'The extension in this browser still runs its old code: open chrome://extensions and click ⟳ on VRM.', es: 'La extensión de este navegador aún ejecuta su código antiguo: abre chrome://extensions y pulsa ⟳ en VRM.', it: 'L’estensione di questo browser usa ancora il vecchio codice: apri chrome://extensions e clicca ⟳ su VRM.', de: 'Die Erweiterung in diesem Browser läuft noch mit altem Code: öffne chrome://extensions und klicke bei VRM auf ⟳.' },
  l_mdp: { fr: 'Avec mon e-mail et mot de passe VRM', en: 'With my VRM e-mail and password', es: 'Con mi correo y contraseña de VRM', it: 'Con la mia e-mail e password VRM', de: 'Mit meiner VRM-E-Mail und meinem Passwort' },
  g_mdp: { fr: 'Ton compte VRM (pas Vinted)', en: 'Your VRM account (not Vinted)', es: 'Tu cuenta VRM (no Vinted)', it: 'Il tuo account VRM (non Vinted)', de: 'Dein VRM-Konto (nicht Vinted)' },
  ph_mail: { fr: 'E-mail du compte VRM', en: 'VRM account e-mail', es: 'Correo de la cuenta VRM', it: 'E-mail dell’account VRM', de: 'E-Mail des VRM-Kontos' },
  ph_pw: { fr: 'Mot de passe VRM', en: 'VRM password', es: 'Contraseña de VRM', it: 'Password VRM', de: 'VRM-Passwort' },
  b_me_connecter: { fr: 'Me connecter', en: 'Sign me in', es: 'Iniciar sesión', it: 'Accedi', de: 'Anmelden' },
  b_connexion_cours: { fr: 'Connexion…', en: 'Signing in…', es: 'Conectando…', it: 'Accesso…', de: 'Anmeldung…' },
  l_oubli: { fr: 'Mot de passe oublié ?', en: 'Forgot password?', es: '¿Olvidaste la contraseña?', it: 'Password dimenticata?', de: 'Passwort vergessen?' },
  l_retour: { fr: 'Revenir', en: 'Back', es: 'Volver', it: 'Indietro', de: 'Zurück' },
  e_vides: { fr: 'Tape l’e-mail et le mot de passe de ton compte VRM.', en: 'Type the e-mail and password of your VRM account.', es: 'Escribe el correo y la contraseña de tu cuenta VRM.', it: 'Scrivi l’e-mail e la password del tuo account VRM.', de: 'Gib E-Mail und Passwort deines VRM-Kontos ein.' },
  e_mail: { fr: 'Tape l’e-mail de ton compte VRM.', en: 'Type the e-mail of your VRM account.', es: 'Escribe el correo de tu cuenta VRM.', it: 'Scrivi l’e-mail del tuo account VRM.', de: 'Gib die E-Mail deines VRM-Kontos ein.' },
  e_pw: { fr: 'Tape ton mot de passe VRM.', en: 'Type your VRM password.', es: 'Escribe tu contraseña de VRM.', it: 'Scrivi la tua password VRM.', de: 'Gib dein VRM-Passwort ein.' },
  e_forme: { fr: 'Cet e-mail n’a pas la bonne forme (exemple : prenom@exemple.fr).', en: 'This e-mail is not valid (example: name@example.com).', es: 'Este correo no es válido (ejemplo: nombre@ejemplo.es).', it: 'Questa e-mail non è valida (esempio: nome@esempio.it).', de: 'Diese E-Mail ist ungültig (Beispiel: name@beispiel.de).' },
  e_muet: { fr: 'L’extension n’a pas répondu. Réessaie dans un instant, ou touche « Revenir » puis « Se connecter ».', en: 'The extension did not answer. Try again in a moment, or tap “Back” then “Sign in”.', es: 'La extensión no respondió. Reinténtalo en un momento, o toca «Volver» y luego «Conectarse».', it: 'L’estensione non ha risposto. Riprova tra poco, oppure tocca «Indietro» e poi «Accedi».', de: 'Die Erweiterung hat nicht geantwortet. Versuche es gleich noch einmal oder tippe auf „Zurück“ und dann „Anmelden“.' },
  e_refus: { fr: 'Connexion refusée.', en: 'Sign-in refused.', es: 'Conexión rechazada.', it: 'Accesso rifiutato.', de: 'Anmeldung abgelehnt.' },
  e_captcha: { fr: 'VRM demande une vérification que cette fenêtre ne sait pas afficher : touche « Revenir » puis « Se connecter ».', en: 'VRM asks for a check this window cannot show: tap “Back” then “Sign in”.', es: 'VRM pide una verificación que esta ventana no puede mostrar: toca «Volver» y luego «Conectarse».', it: 'VRM chiede una verifica che questa finestra non può mostrare: tocca «Indietro» e poi «Accedi».', de: 'VRM verlangt eine Prüfung, die dieses Fenster nicht anzeigen kann: tippe auf „Zurück“ und dann „Anmelden“.' },
};
const LANGUE = (() => { try { const l = globalThis.VRM_UI && globalThis.VRM_UI.langue(); if (['fr', 'en', 'es', 'it', 'de'].includes(l)) return l; } catch (_) {} return 'fr'; })();
const T = (cle, v) => { const m = MOTS[cle] || {}; let t = m[LANGUE] || m.fr || cle; for (const k of Object.keys(v || {})) t = t.split('{' + k + '}').join(String(v[k])); return t; };
const heure = (ms) => { try { return new Date(ms).toLocaleTimeString(LANGUE === 'en' ? 'en-GB' : LANGUE, { hour: '2-digit', minute: '2-digit' }); } catch (_) { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); } };

// Une question au service worker : sa réponse, ou `null` (pas de réponse, erreur, délai).
function demander(action, extra, ms) {
  return new Promise((res) => {
    let fini = false;
    const fin = (v) => { if (!fini) { fini = true; res(v); } };
    const t = setTimeout(() => fin(null), ms || 6000);
    try {
      chrome.runtime.sendMessage(Object.assign({ from: 'cancale-popup', action }, extra || {}), (r) => {
        clearTimeout(t);
        let e = null; try { e = chrome.runtime.lastError; } catch (_) { e = null; }
        fin(e ? null : (r === undefined ? null : r));
      });
    } catch (_) { clearTimeout(t); fin(null); }
  });
}
// L'état (UNE source : `etatConnexion`). Un service worker d'avant la 5.415 (code
// périmé, ⟳ pas encore cliqué) ne le connaît pas : on lit son `authEtat`, ramené
// aux mêmes états. Rien du tout ⇒ `muet` (jamais « connecté » ni « déconnecté »).
async function lireEtat() {
  const r = await demander('etatConnexion', null, 7000);
  if (r && r.ok && typeof r.etat === 'string') return r;
  const a = await demander('authEtat', null, 5000);
  if (!a || typeof a !== 'object') return { etat: 'muet' };
  const etat = a.connecte === true ? 'connecte' : (a.incertain && !a.mort && (a.email || a.user_id)) ? 'renouvellement' : (a.mort || a.expiree) ? 'expiree' : 'deconnecte';
  return { ok: true, etat, email: a.email || '', ancien: true };
}

// ── LE RENDU : une phrase d'état, UN plein ──────────────────────────────────
let etatCourant = null, formulaireOuvert = false, renouvDepuis = 0, minuterie = null;
const auth = () => document.getElementById('auth');
const phrase = (texte, point) => `<div class="rangee"><span class="point ${point || ''}"></span><span data-etat-phrase>${esc(texte)}</span></div>`;
const rangee = (lab, val, attr) => `<div class="rangee"><span class="lab">${esc(lab)}</span><span class="val" ${attr}>${esc(val)}</span></div>`;
function nomVinted(v) {
  if (!v || !v.uid) return T('v_vinted_aucun');
  return v.login ? v.login : T('v_vinted_sans_nom', { n: v.uid });
}
function rendre(e) {
  etatCourant = e;
  const box = auth(); if (!box) return;
  let etat = e.etat;
  // « En cours de renouvellement » ne s'affiche jamais plus de 12 s : au-delà, c'est
  // une panne passagère, dite comme telle (le service worker réessaie seul).
  if (etat === 'renouvellement') { if (!renouvDepuis) renouvDepuis = Date.now(); if (Date.now() - renouvDepuis > 12000) etat = 'pause'; }
  else renouvDepuis = 0;
  document.body.setAttribute('data-connexion', etat);
  const diag = document.getElementById('details-diag');
  if (diag) diag.hidden = etat !== 'connecte';
  if (formulaireOuvert && (etat === 'deconnecte' || etat === 'expiree')) { rendreFormulaire(); return; }
  formulaireOuvert = false;
  const compte = (e.email ? rangee(T('r_compte'), e.email, 'data-compte-vrm') : '') + rangee(T('r_vinted'), nomVinted(e.vinted), 'data-compte-vinted');
  let html = '';
  if (etat === 'connecte') {
    html = `<div class="groupe">${phrase(T('p_connecte'), 'ok')}${compte}</div>
      <div id="transpBox" hidden></div>
      <button class="plein" id="vrmBtn" data-ouvrir-vrm>${esc(T('b_ouvrir'))}</button>
      <div class="actions"><button class="lien" id="outBtn" data-se-deconnecter>${esc(T('l_deconnecter'))}</button></div>`;
  } else if (etat === 'renouvellement') {
    html = `<div class="groupe">${phrase(T('p_renouv'), 'ok')}${compte}</div>
      <button class="plein" id="vrmBtn" data-ouvrir-vrm>${esc(T('b_ouvrir'))}</button>`;
  } else if (etat === 'pause') {
    html = `<div class="groupe">${phrase(e.pauseJusqua ? T('p_pause', { h: heure(e.pauseJusqua) }) : T('p_pause_sans'), 'geste')}${compte}</div>
      <button class="plein" data-reessayer>${esc(T('b_reessayer'))}</button>
      <div class="actions"><button class="lien" id="vrmBtn" data-ouvrir-vrm>${esc(T('b_ouvrir'))}</button></div>`;
  } else if (etat === 'attente') {
    html = `<div class="groupe">${phrase(T('p_attente'), 'geste')}</div>
      ${e.attenteJusqua ? `<p class="pied">${esc(T('pied_attente', { h: heure(e.attenteJusqua) }))}</p>` : ''}
      <button class="plein" data-rouvrir>${esc(T('b_rouvrir'))}</button>
      <div class="actions"><button class="lien" data-annuler>${esc(T('l_annuler'))}</button><button class="lien" data-autre-moyen>${esc(T('l_mdp'))}</button></div>`;
  } else if (etat === 'muet') {
    html = `<div class="groupe">${phrase(T('p_muet'), 'geste')}</div>
      <button class="plein" id="lierBtn" data-se-connecter>${esc(T('b_connecter'))}</button>`;
  } else {
    const expiree = etat === 'expiree';
    const p = expiree ? T('p_expiree') : e.voulue ? T('p_voulue') : e.attenteExpiree ? T('p_avorte') : T('p_deconnecte');
    html = `<div class="groupe">${phrase(p, expiree ? 'geste' : '')}${expiree && e.email ? rangee(T('r_compte'), e.email, 'data-compte-vrm') : ''}</div>
      <p class="pied">${esc(expiree ? T('pied_expiree') : T('pied_connecter'))}</p>
      <button class="plein" id="lierBtn" data-se-connecter>${esc(expiree ? T('b_reconnecter') : T('b_connecter'))}</button>
      <div class="actions"><button class="lien" data-autre-moyen>${esc(T('l_mdp'))}</button></div>`;
  }
  if (e.message) html += `<p class="err" role="alert">${esc(e.message)}</p>`;
  poserHtml(box, html);
  brancher(box);
  if (etat === 'connecte') lirePermisTransp(rendreTranspPermis);
  // Tant qu'un état peut changer tout seul, on relit (la fenêtre reste ouverte).
  clearTimeout(minuterie);
  if (['renouvellement', 'pause', 'attente', 'muet'].includes(etat) || (etat === 'connecte' && !(e.vinted && e.vinted.login))) minuterie = setTimeout(() => charger(), etat === 'renouvellement' ? 2000 : 4000);
}
function brancher(box) {
  const sur = (sel, fn) => box.querySelectorAll(sel).forEach((b) => b.addEventListener('click', fn));
  sur('[data-se-connecter], [data-rouvrir]', seConnecter);
  sur('[data-ouvrir-vrm]', ouvrirVRM);
  sur('[data-se-deconnecter]', async () => { await demander('authLogout', null, 6000); charger(); });
  sur('[data-annuler]', async () => { const r = await demander('annulerLiaison', null, 6000); r && r.ok ? rendre(r) : charger(); });
  sur('[data-autre-moyen]', () => { formulaireOuvert = true; rendreFormulaire(); });
  sur('[data-reessayer]', async (ev) => {
    const b = ev.currentTarget; b.disabled = true;
    const r = await demander('renouvelerMaintenant', null, 12000);
    renouvDepuis = 0;
    if (r && r.ok && r.etat) rendre(r); else charger();
  });
}
async function charger() {
  const e = await lireEtat();
  if (e.etat === 'muet') {
    // Un service worker muet : la réparation d'un code périmé (le ⟳), UNE fois par version.
    const rep = await reparerSiPerime();
    try { document.body.setAttribute('data-lier-secours', rep); } catch (_) {}
    if (rep === 'recharge') return;
  }
  rendre(e);
}
try {
  chrome.storage.onChanged.addListener((ch, zone) => {
    if (zone !== 'local' || !ch) return;
    if (ch.vrmApparence) poserTeinte(ch.vrmApparence.newValue);
    if (REPARER || CARTE) return;
    if (ch.vrmSession || ch.vrmLiaison || ch.vrmRenouv || ch.vrmDeconnexionVoulue) { clearTimeout(minuterie); minuterie = setTimeout(() => charger(), 150); }
  });
} catch (_) {}

// ── « SE CONNECTER » : la liaison par VRM, en UN geste ──────────────────────
// L'onglet où revenir : celui du menu (`depuis`), sinon l'onglet actif sous l'icône.
function ongletDeDepart() {
  if (DEPUIS != null) return Promise.resolve({ id: DEPUIS, url: '' });
  if (ONGLET) return Promise.resolve(null);
  return new Promise((res) => {
    try { chrome.tabs.query({ active: true, currentWindow: true }, (t) => { try { void chrome.runtime.lastError; } catch (_) {} res(t && t[0] ? { id: t[0].id, url: t[0].url || '' } : null); }); }
    catch (_) { res(null); }
  });
}
function ongletVRM(url) {
  const u = String(url || '');
  const p = /leboncoin\.fr/i.test(u) ? 'plat_leboncoin' : /ebay\.(fr|com)/i.test(u) ? 'plat_ebay' : /vestiairecollective\./i.test(u) ? 'plat_vestiaire' : 'plat_vinted';
  return APP + '/?tab=' + p;
}
// Navigateur sans API `tabs` utilisable (Orion : la fenêtre est une feuille) : comme une page.
function ouvrirSansTabs(url) {
  try { const w = window.open(url, '_blank'); if (w) return true; } catch (_) {}
  try { window.location.href = url; return true; } catch (_) {}
  return false;
}
let lierEnVol = false;
async function seConnecter() {
  if (lierEnVol) return;
  lierEnVol = true;
  const box = auth();
  const b = box && box.querySelector('.plein'); if (b) { b.disabled = true; b.textContent = T('p_ouvre'); }
  const depart = await ongletDeDepart();
  const r = await demander('lierAvecVRM', { urlActive: (depart && depart.url) || '', retourTab: depart && Number.isInteger(depart.id) ? depart.id : null }, 5000);
  lierEnVol = false;
  if (r && r.ok) {
    // Fenêtre de l'icône (Chrome) : elle se ferme d'elle-même au changement d'onglet. Onglet du
    // menu, feuille d'Orion : elle reste et DIT qu'elle attend (relue par le stockage).
    if (!ONGLET && !globalThis.__vrmOrionCompat) { try { window.close(); } catch (_) {} }
    charger();
    return;
  }
  // ⚠️ Revue du 11 octobre, toujours vraie : un code PÉRIMÉ (dossier remplacé, ⟳ pas
  //    cliqué) ne connaît pas `lierAvecVRM`. Cette page, lue depuis le disque, ouvre VRM
  //    elle-même avec l'identifiant de CETTE extension, puis répare le code (⟳).
  let id = ''; try { id = String(chrome.runtime.id || ''); } catch (_) {}
  const cible = ongletVRM(depart && depart.url) + (id ? '&lier-extension=' + encodeURIComponent(id) : '');
  try { chrome.tabs.create({ url: cible }, () => { try { void chrome.runtime.lastError; } catch (_) {} }); } catch (_) { ouvrirSansTabs(cible); }
  const rep = await reparerSiPerime();
  try { document.body.setAttribute('data-lier-secours', rep); } catch (_) {}
  if (rep === 'recharge') return;
  rendre(Object.assign({}, etatCourant || { etat: 'deconnecte' }, { etat: etatCourant && etatCourant.etat !== 'muet' ? etatCourant.etat : 'deconnecte', message: T('p_ancien') }));
}

// ── LE RECOURS : e-mail et mot de passe VRM ────────────────────────────────
// ⚠️ QUEL MOT DE PASSE ? On arrive souvent ici depuis Vinted : le groupe le dit
//    (« Ton compte VRM (pas Vinted) »), les champs aussi.
function rendreFormulaire() {
  const box = auth(); if (!box) return;
  const e = etatCourant || {};
  poserHtml(box, `<div id="mdpForm">
      <p class="titre-groupe">${esc(T('g_mdp'))}</p>
      <div class="groupe">
        <input class="champ" id="mail" type="email" inputmode="email" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${esc(T('ph_mail'))}" placeholder="${esc(T('ph_mail'))}" autocomplete="username" value="${esc(e.etat === 'expiree' && e.email ? e.email : '')}">
        <input class="champ" id="pw" type="password" aria-label="${esc(T('ph_pw'))}" placeholder="${esc(T('ph_pw'))}" autocomplete="current-password" enterkeyhint="go">
      </div>
      <p class="err" id="authErr" role="alert" hidden></p>
      <button class="plein" id="inBtn">${esc(T('b_me_connecter'))}</button>
      <div class="actions"><a class="lien" id="oubliLien" href="${APP}/?connexion&mot-de-passe-oublie" target="_blank" rel="noreferrer">${esc(T('l_oubli'))}</a><button class="lien" data-revenir>${esc(T('l_retour'))}</button></div>
    </div>`);
  box.querySelector('[data-revenir]').addEventListener('click', () => { formulaireOuvert = false; rendre(etatCourant || { etat: 'deconnecte' }); });
  box.querySelector('#oubliLien').addEventListener('click', (ev) => {
    ev.preventDefault();
    const url = ev.currentTarget.href;
    try { chrome.tabs.create({ url }, () => { try { void chrome.runtime.lastError; } catch (_) {} if (!ONGLET) { try { window.close(); } catch (_) {} } }); } catch (_) { ouvrirSansTabs(url); }
  });
  const mail = box.querySelector('#mail'), pw = box.querySelector('#pw'), btn = box.querySelector('#inBtn'), err = box.querySelector('#authErr');
  try { (mail.value ? pw : mail).focus(); } catch (_) {}
  const dire = (t) => { err.textContent = t; err.hidden = false; };
  // Une connexion à la fois : Entrée répétée ouvrait plusieurs sessions (mesuré : 4 × Entrée ⇒ 2 à 3).
  let enVol = false;
  const go = () => {
    if (enVol) return;
    const email = String(mail.value || '').trim(), password = pw.value;
    if (!email || !password) { dire(!email && !password ? T('e_vides') : !email ? T('e_mail') : T('e_pw')); try { (!email ? mail : pw).focus(); } catch (_) {} return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { dire(T('e_forme')); return; }
    enVol = true; btn.disabled = true; btn.textContent = T('b_connexion_cours'); err.hidden = true;
    let fini = false;
    const finir = (r, muet) => {
      if (fini) return; fini = true; clearTimeout(attente);
      enVol = false; btn.disabled = false; btn.textContent = T('b_me_connecter');
      if (r && r.ok) { formulaireOuvert = false; rendre({ ok: true, etat: 'connecte', email: r.email || email }); charger(); return; }
      if (r && (r.captcha || /captcha/i.test(String(r.error || '')))) { dire(T('e_captcha')); return; }
      dire(muet ? T('e_muet') : ((r && r.error) || T('e_refus')));
    };
    // iOS peut suspendre le service worker en route : jamais un bouton figé.
    const attente = setTimeout(() => finir(null, true), 20000);
    try {
      chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'authLogin', email, password, ouvrir: false }, (r) => {
        let e2 = null; try { e2 = chrome.runtime.lastError; } catch (_) { e2 = null; }
        finir(e2 ? null : r, !!e2 || r === undefined);
      });
    } catch (_) { finir(null, true); }
  };
  btn.addEventListener('click', go);
  pw.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
  mail.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); if (!pw.value) pw.focus(); else go(); } });
}

// ── OUVRIR VRM (connecté) ──────────────────────────────────────────────────
function ouvrirVRM() {
  const aller = (url) => {
    const cible = ongletVRM(url);
    const fermer = () => { if (!ONGLET && !globalThis.__vrmOrionCompat) { try { window.close(); } catch (_) {} } };
    try {
      chrome.tabs.query({ url: APP + '/*' }, (ouverts) => {
        const t = (ouverts || [])[0];
        if (t) chrome.tabs.update(t.id, { url: cible, active: true }, () => { try { chrome.windows.update(t.windowId, { focused: true }); } catch (_) {} fermer(); });
        else chrome.tabs.create({ url: cible }, fermer);
      });
    } catch (_) { ouvrirSansTabs(cible); }
  };
  ongletDeDepart().then((d) => {
    if (d && d.url) return aller(d.url);
    if (d && Number.isInteger(d.id)) { try { chrome.tabs.get(d.id, (t) => { try { void chrome.runtime.lastError; } catch (_) {} aller(t && t.url); }); return; } catch (_) {} }
    aller('');
  });
}

// ── LA RÉPARATION D'UN CODE PÉRIMÉ (11 octobre) ───────────────────────────
// ⚠️⚠️ MESURÉ : après le remplacement du dossier, Chrome garde l'ANCIEN service
//    worker tant qu'on n'a pas cliqué ⟳ dans chrome://extensions — et seulement
//    dans le Chrome où on le clique. Une page de l'extension, elle, est lue depuis
//    le disque : elle peut faire ce ⟳ (`chrome.runtime.reload()`). Elle ne CROIT
//    personne sur parole : elle redemande la version du code au service worker, et
//    ne recharge que si elle n'est pas celle du manifeste — UNE fois par version
//    (garde dans `chrome.storage.local`, une boucle de rechargements est impossible).
const REPARATION_STORE = 'vrmReparation';
async function reparerSiPerime() {
  let manif = ''; try { manif = String(chrome.runtime.getManifest().version || ''); } catch (_) { return 'manifeste'; }
  if (!/^\d+\.\d+\.\d+$/.test(manif)) return 'manifeste';
  const code = await new Promise((res) => {
    const t = setTimeout(() => res(undefined), 6000);
    try {
      chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'codeVersion' }, (r) => {
        clearTimeout(t);
        const e = chrome.runtime.lastError;
        res(e ? null : ((r && r.code) || null));
      });
    } catch (_) { clearTimeout(t); res(null); }
  });
  if (code === manif) return 'a-jour';
  // 5.371 : « Réparer » touché sur la carte alors que le service worker NE RÉPOND
  //    PLUS (6 s sans rien) : on le relance — jamais si une republication a posé son
  //    témoin il y a moins de 10 min, une fois par 10 min au plus.
  if (code === undefined && typeof FORCE !== 'undefined' && FORCE === true) {   // (la fonction est aussi exécutée seule par audit-robustesse J4)
    let g = {};
    try { g = await chrome.storage.local.get(['vrmRepubVivante', 'vrmReparationForcee']); } catch (_) { return 'stockage'; }
    const t = Date.now();
    if (Number(g.vrmRepubVivante) > 0 && t - Number(g.vrmRepubVivante) < 10 * 60000) return 'republication';
    if (Number(g.vrmReparationForcee) > 0 && t - Number(g.vrmReparationForcee) < 10 * 60000) return 'deja';
    try { await chrome.storage.local.set({ vrmReparationForcee: t }); } catch (_) { return 'stockage'; }
    try { chrome.runtime.reload(); } catch (_) { return 'echec'; }
    return 'recharge';
  }
  // ⚠️ 5.356 : un service worker LENT (réveil, republication en cours) ne répondait pas
  //    en 6 s ⇒ rechargement : l'opération était coupée. On ne recharge que sur une
  //    version REÇUE et différente — sans réponse, rien (« pas su » ne vaut pas « périmé »).
  if (typeof code !== 'string' || !/^\d+\.\d+\.\d+$/.test(code)) return 'pas-su';
  let deja = null;
  try { deja = (await chrome.storage.local.get(REPARATION_STORE))[REPARATION_STORE] || null; } catch (_) { return 'stockage'; }
  if (deja && deja.cle === manif && Date.now() - Number(deja.at || 0) < 24 * 3600e3) return 'deja';
  try { await chrome.storage.local.set({ [REPARATION_STORE]: { cle: manif, at: Date.now(), vu: code == null ? '' : String(code) } }); } catch (_) { return 'stockage'; }
  try { chrome.runtime.reload(); } catch (_) { return 'echec'; }
  return 'recharge';
}

// ── LE SUIVI DES TRANSPORTEURS (5.290) ─────────────────────────────────────
// Firefox peut laisser NON accordés les sites des transporteurs (permissions d'hôte
// MV3) : le bouton ne s'affiche QUE dans ce cas, et seulement si ce navigateur sait
// les demander. `chrome.permissions.request` doit partir DANS le geste.
function lirePermisTransp(cb) {
  let fini = false;
  const fin = (v) => { if (fini) return; fini = true; cb(v); };
  setTimeout(() => fin(null), 1500);
  try { chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'transpPermis' }, (r) => { try { void chrome.runtime.lastError; } catch (_) {} fin(r && r.ok ? r : null); }); } catch (_) { fin(null); }
}
const peutDemanderPermis = () => { try { return !!(chrome.permissions && typeof chrome.permissions.request === 'function'); } catch (_) { return false; } };
const PERMIS_MANQUE = (t) => !!(t && t.permis === false && Array.isArray(t.origines) && t.origines.length && peutDemanderPermis());
function rendreTranspPermis(t) {
  const box = document.getElementById('transpBox');
  if (!box) return;
  if (!PERMIS_MANQUE(t)) { box.hidden = true; return; }
  box.hidden = false;
  box.setAttribute('data-transp-permis', 'manque');
  poserHtml(box, `<p class="pied">Pour lire le suivi de tes colis sur les sites des transporteurs (Mondial Relay, Chronopost, Vinted Go), ce navigateur doit d'abord l'autoriser. VRM n'y lit que le statut des colis que tu attends.</p>
    <div class="actions"><button class="lien" id="transpPermisBtn">Autoriser VRM à lire le suivi des transporteurs</button></div>
    <p class="pied" id="transpPermisEtat" hidden></p>`);
  const origines = t.origines.slice();
  document.getElementById('transpPermisBtn').addEventListener('click', () => {
    const btn = document.getElementById('transpPermisBtn');
    const etat = document.getElementById('transpPermisEtat');
    const dire = (ok) => {
      box.setAttribute('data-transp-permis', ok ? 'accorde' : 'refuse');
      if (etat) { etat.hidden = false; etat.textContent = ok ? 'C’est autorisé : l’extension peut maintenant lire le suivi de tes colis sur ces sites.' : 'Ce n’est pas autorisé : rien n’est lu sur ces sites depuis ce navigateur. VRM lit ce qu’il peut de son côté.'; }
      if (btn && ok) btn.remove();
    };
    let fini = false;
    const fin = (v) => { if (fini) return; fini = true; dire(v === true); };
    try {
      const r = chrome.permissions.request({ origins: origines }, (v) => { try { void chrome.runtime.lastError; } catch (_) {} fin(v); });
      if (r && typeof r.then === 'function') r.then(fin, () => fin(false));
    } catch (_) { fin(false); }
  });
}

// ── LA CARTE DU LOGO ET LA LISTE DES COMPTES : vrm-badge.js, inchangé ────────
// 5.332 : dans la carte d'un site, cette page charge le formulaire de la carte
// (vrm-badge.js en mode « cadre ») à l'origine de l'extension.
function lancerCadre() {
  try { document.body.replaceChildren(); } catch (_) {}
  globalThis.__vrmCadre = true;
  const s = document.createElement('script');
  s.src = 'vrm-badge.js';
  (document.head || document.documentElement).appendChild(s);
}
// 5.377 : « État de l'extension » (clic droit sur l'icône) montre aussi Favoris · Annonces ·
// Ventes du compte Vinted de ce navigateur (vrm-badge.js en mode « listes », lecture seule).
// 5.415 : seulement là (`vue=etat`) — « Connexion à VRM » ne montre que la connexion.
function lancerListes() {
  try {
    globalThis.__vrmListes = true;
    const s = document.createElement('script');
    s.src = 'vrm-badge.js';
    (document.head || document.documentElement).appendChild(s);
  } catch (_) {}
}
// ⚠️ 5.362 (revue, moyenne 68) — QUI PEUT M'ENCADRER. `popup.html` est accessible aux
//    pages de vinted, leboncoin, ebay, vestiaire et vrm.center : la carte et la
//    réparation ne s'affichent que posées par la PAGE PRINCIPALE (`parent === top`,
//    un seul ancêtre) d'un de ces sites — sinon rien.
const HOTES_CADRE = /^https:\/\/(?:vrm\.center|(?:[a-z0-9-]+\.)*(?:vinted\.(?:fr|com|it|de)|leboncoin\.fr|ebay\.(?:fr|com)|vestiairecollective\.com))$/;
function cadreAutorise() {
  try {
    if (window.parent === window) return true;                 // pas encadré
    if (window.parent !== window.top) return false;             // un cadre DANS un cadre
    const anc = location.ancestorOrigins;
    if (anc && typeof anc.length === 'number') return anc.length === 1 && HOTES_CADRE.test(String(anc[0]));
    // Firefox : pas d'`ancestorOrigins` ; le référent dit qui nous a posés.
    let o = ''; try { o = new URL(document.referrer).origin; } catch (_) { o = ''; }
    return HOTES_CADRE.test(o);
  } catch (_) { return false; }
}

// ── 5.371 : « NOUVELLE VERSION DISPONIBLE » DANS LA FENÊTRE ───────────────────
// Installée À LA MAIN et plus ancienne que celle que sert vrm.center ⇒ « Télécharger »
// + 3 étapes ; venue d'une BOUTIQUE ⇒ rien (elle se met à jour seule).
const LIENS_PAQUET_FENETRE = ['https://vrm.center/VRM-extension.zip', 'https://vrm.center/VRM-Orion.xpi'];
function montrerMiseAJour() {
  try {
    chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'miseAJour' }, (m) => {
      try { void chrome.runtime.lastError; } catch (_) {}
      if (!m || !m.ok || m.nouvelle !== true || m.origine === 'boutique' || !LIENS_PAQUET_FENETRE.includes(String(m.lien || ''))) return;
      const orion = m.moteur === 'firefox';
      const bloc = document.createElement('section');
      bloc.className = 'maj';
      bloc.setAttribute('data-maj', String(m.servie || ''));
      const t = document.createElement('div'); t.style.fontWeight = '600'; t.textContent = 'Nouvelle version disponible · ' + String(m.servie || '');
      const a = document.createElement('a');
      a.href = m.lien; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('download', ''); a.setAttribute('data-maj-telecharger', '');
      a.textContent = 'Télécharger';
      const ol = document.createElement('ol');
      for (const x of (orion ? ['Touche « Télécharger ».', 'Orion → Extensions → + → ce fichier.', 'Rouvre cette fenêtre.'] : ['Ouvre le fichier téléchargé : il se dézippe.', 'Remplace l’ancien dossier VRM par le nouveau.', 'chrome://extensions → ⟳ sur VRM.'])) { const li = document.createElement('li'); li.textContent = x; ol.appendChild(li); }
      bloc.append(t, a, ol);
      const tete = document.getElementById('tete');
      if (tete && tete.parentNode) tete.parentNode.insertBefore(bloc, tete.nextSibling); else document.body.prepend(bloc);
    });
  } catch (_) {}
}

if ((REPARER || CARTE) && !cadreAutorise()) { try { document.body.setAttribute('data-cadre', 'refuse'); document.body.replaceChildren(); } catch (_) {} }
else if (REPARER) reparerSiPerime().then((r) => { try { document.body.setAttribute('data-reparation', r); } catch (_) {} });
else if (CARTE) lancerCadre();
else { charger(); montrerMiseAJour(); if (VUE_ETAT) lancerListes(); }
