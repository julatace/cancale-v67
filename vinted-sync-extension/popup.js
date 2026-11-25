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
//  Pas reliée : les DEUX chemins à égalité (Julien, 21 nov. : « on peut faire les deux ») :
//    1. ICI (le plein) : e-mail + mot de passe VRM — il part UNE fois au service
//       worker (`authLogin`), jamais gardé — ou Google / Discord (PKCE, `oauthDepart`) ;
//    2. « Relier par vrm.center » (contour, juste dessous) : la liaison existante,
//       sûre : VRM s'ouvre avec `lier-extension=<id>` ; l'app (connectée, ou après SA
//       connexion) demande un nonce à CETTE extension, fait fabriquer une session à elle
//       par le serveur et la lui ADRESSE (`externally_connectable`, ou le pont sur
//       Orion). Aucun jeton dans une adresse. Une fois reliée, on REVIENT sur l'onglet
//       du site d'où l'on est parti.
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
const DEPUIS = (() => { const m = /[?&]depuis=(\d{1,15})\b/.exec(Q); const n = m ? Number(m[1]) : NaN; return Number.isSafeInteger(n) ? n : null; })();
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
  // 5.453 (25 nov., Julien : « améliore la page de connexion ») : pas encore reliée = UNE ligne courte sous « Connecte VRM ».
  p_deconnecte: { fr: 'Ton compte VRM, pas Vinted.', en: 'Your VRM account, not Vinted.', es: 'Tu cuenta VRM, no Vinted.', it: 'Il tuo account VRM, non Vinted.', de: 'Dein VRM-Konto, nicht Vinted.' },
  t_connecte: { fr: 'Connecte VRM', en: 'Connect VRM', es: 'Conecta VRM', it: 'Collega VRM', de: 'VRM verbinden' },
  sep_ou: { fr: 'ou', en: 'or', es: 'o', it: 'oppure', de: 'oder' },
  b_voir: { fr: 'Afficher le mot de passe', en: 'Show password', es: 'Mostrar la contraseña', it: 'Mostra la password', de: 'Passwort anzeigen' },
  b_cacher: { fr: 'Masquer le mot de passe', en: 'Hide password', es: 'Ocultar la contraseña', it: 'Nascondi la password', de: 'Passwort verbergen' },
  p_voulue: { fr: 'Tu as déconnecté l’extension de VRM.', en: 'You disconnected the extension from VRM.', es: 'Has desconectado la extensión de VRM.', it: 'Hai scollegato l’estensione da VRM.', de: 'Du hast die Erweiterung von VRM getrennt.' },
  p_avorte: { fr: 'La connexion n’a pas abouti.', en: 'The connection did not go through.', es: 'La conexión no se completó.', it: 'La connessione non è andata a buon fine.', de: 'Die Verbindung kam nicht zustande.' },
  b_connecter: { fr: 'Se connecter', en: 'Sign in', es: 'Conectarse', it: 'Accedi', de: 'Anmelden' },
  p_expiree: { fr: 'Ta session VRM a expiré.', en: 'Your VRM session has expired.', es: 'Tu sesión de VRM ha caducado.', it: 'La tua sessione VRM è scaduta.', de: 'Deine VRM-Sitzung ist abgelaufen.' },
  p_attente: { fr: 'VRM est ouvert : connecte-toi dans l’onglet VRM, l’extension se relie toute seule.', en: 'VRM is open: sign in in the VRM tab, the extension links itself.', es: 'VRM está abierto: inicia sesión en la pestaña de VRM, la extensión se vincula sola.', it: 'VRM è aperto: accedi nella scheda VRM, l’estensione si collega da sola.', de: 'VRM ist geöffnet: melde dich im VRM-Tab an, die Erweiterung verbindet sich selbst.' },
  pied_attente: { fr: 'J’attends jusqu’à {h}.', en: 'Waiting until {h}.', es: 'Espero hasta las {h}.', it: 'Attendo fino alle {h}.', de: 'Ich warte bis {h}.' },
  b_rouvrir: { fr: 'Revenir sur VRM', en: 'Back to VRM', es: 'Volver a VRM', it: 'Torna su VRM', de: 'Zurück zu VRM' },
  l_annuler: { fr: 'Annuler', en: 'Cancel', es: 'Cancelar', it: 'Annulla', de: 'Abbrechen' },
  p_connecte: { fr: 'Connecté à VRM', en: 'Connected to VRM', es: 'Conectado a VRM', it: 'Connesso a VRM', de: 'Mit VRM verbunden' },
  r_compte: { fr: 'Compte VRM', en: 'VRM account', es: 'Cuenta VRM', it: 'Account VRM', de: 'VRM-Konto' },
  r_vinted: { fr: 'Vinted', en: 'Vinted', es: 'Vinted', it: 'Vinted', de: 'Vinted' },
  v_vinted_aucun: { fr: 'pas connecté ici', en: 'not signed in here', es: 'sin sesión aquí', it: 'non connesso qui', de: 'hier nicht angemeldet' },
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
  l_mdp: { fr: 'Me connecter ici, sans ouvrir VRM', en: 'Sign in here, without opening VRM', es: 'Conectarme aquí, sin abrir VRM', it: 'Accedi qui, senza aprire VRM', de: 'Hier anmelden, ohne VRM zu öffnen' },
  b_fourn: { fr: 'Continuer avec {f}', en: 'Continue with {f}', es: 'Continuar con {f}', it: 'Continua con {f}', de: 'Weiter mit {f}' },
  p_fourn: { fr: '{f} s’ouvre dans un nouvel onglet. Connecte-toi : l’onglet se ferme tout seul et l’extension est reliée.', en: '{f} opens in a new tab. Sign in: the tab closes by itself and the extension is linked.', es: '{f} se abre en una pestaña nueva. Inicia sesión: la pestaña se cierra sola y la extensión queda vinculada.', it: '{f} si apre in una nuova scheda. Accedi: la scheda si chiude da sola e l’estensione è collegata.', de: '{f} öffnet sich in einem neuen Tab. Melde dich an: Der Tab schließt sich selbst und die Erweiterung ist verbunden.' },
  e_fourn: { fr: 'La connexion n’a pas pu démarrer. Réessaie, ou touche « Relier par vrm.center ».', en: 'The sign-in could not start. Try again, or tap “Link through vrm.center”.', es: 'No se pudo iniciar la conexión. Reinténtalo, o toca «Vincular con vrm.center».', it: 'Impossibile avviare l’accesso. Riprova, oppure tocca «Collega tramite vrm.center».', de: 'Die Anmeldung konnte nicht starten. Versuche es erneut oder tippe auf „Über vrm.center verbinden“.' },
  ou: { fr: 'Ou ici, avec :', en: 'Or here, with:', es: 'O aquí, con:', it: 'Oppure qui, con:', de: 'Oder hier, mit:' },
  g_mdp: { fr: 'Ton compte VRM, pas Vinted.', en: 'Your VRM account, not Vinted.', es: 'Tu cuenta VRM, no Vinted.', it: 'Il tuo account VRM, non Vinted.', de: 'Dein VRM-Konto, nicht Vinted.' },
  ph_mail: { fr: 'E-mail du compte VRM', en: 'VRM account e-mail', es: 'Correo de la cuenta VRM', it: 'E-mail dell’account VRM', de: 'E-Mail des VRM-Kontos' },
  ph_pw: { fr: 'Mot de passe VRM', en: 'VRM password', es: 'Contraseña de VRM', it: 'Password VRM', de: 'VRM-Passwort' },
  b_me_connecter: { fr: 'Me connecter', en: 'Sign me in', es: 'Iniciar sesión', it: 'Accedi', de: 'Anmelden' },
  b_connexion_cours: { fr: 'Connexion…', en: 'Signing in…', es: 'Conectando…', it: 'Accesso…', de: 'Anmeldung…' },
  l_oubli: { fr: 'Mot de passe oublié ?', en: 'Forgot password?', es: '¿Olvidaste la contraseña?', it: 'Password dimenticata?', de: 'Passwort vergessen?' },
  b_relier: { fr: 'Relier par vrm.center', en: 'Link through vrm.center', es: 'Vincular con vrm.center', it: 'Collega tramite vrm.center', de: 'Über vrm.center verbinden' },
  pied_relier: { fr: 'Déjà connecté sur vrm.center ? VRM s’ouvre, l’extension se relie seule et tu reviens sur Vinted.', en: 'Already signed in on vrm.center? VRM opens, the extension links itself and you come back to Vinted.', es: '¿Ya conectado en vrm.center? VRM se abre, la extensión se vincula sola y vuelves a Vinted.', it: 'Già connesso su vrm.center? Si apre VRM, l’estensione si collega da sola e torni su Vinted.', de: 'Schon auf vrm.center angemeldet? VRM öffnet sich, die Erweiterung verbindet sich selbst und du kehrst zu Vinted zurück.' },
  e_vides: { fr: 'Tape l’e-mail et le mot de passe de ton compte VRM.', en: 'Type the e-mail and password of your VRM account.', es: 'Escribe el correo y la contraseña de tu cuenta VRM.', it: 'Scrivi l’e-mail e la password del tuo account VRM.', de: 'Gib E-Mail und Passwort deines VRM-Kontos ein.' },
  e_mail: { fr: 'Tape l’e-mail de ton compte VRM.', en: 'Type the e-mail of your VRM account.', es: 'Escribe el correo de tu cuenta VRM.', it: 'Scrivi l’e-mail del tuo account VRM.', de: 'Gib die E-Mail deines VRM-Kontos ein.' },
  e_pw: { fr: 'Tape ton mot de passe VRM.', en: 'Type your VRM password.', es: 'Escribe tu contraseña de VRM.', it: 'Scrivi la tua password VRM.', de: 'Gib dein VRM-Passwort ein.' },
  e_forme: { fr: 'Cet e-mail n’a pas la bonne forme (exemple : prenom@exemple.fr).', en: 'This e-mail is not valid (example: name@example.com).', es: 'Este correo no es válido (ejemplo: nombre@ejemplo.es).', it: 'Questa e-mail non è valida (esempio: nome@esempio.it).', de: 'Diese E-Mail ist ungültig (Beispiel: name@beispiel.de).' },
  e_muet: { fr: 'L’extension n’a pas répondu. Réessaie dans un instant, ou touche « Relier par vrm.center ».', en: 'The extension did not answer. Try again in a moment, or tap “Link through vrm.center”.', es: 'La extensión no respondió. Reinténtalo en un momento, o toca «Vincular con vrm.center».', it: 'L’estensione non ha risposto. Riprova tra poco, oppure tocca «Collega tramite vrm.center».', de: 'Die Erweiterung hat nicht geantwortet. Versuche es gleich noch einmal oder tippe auf „Über vrm.center verbinden“.' },
  e_refus: { fr: 'Connexion refusée.', en: 'Sign-in refused.', es: 'Conexión rechazada.', it: 'Accesso rifiutato.', de: 'Anmeldung abgelehnt.' },
  e_captcha: { fr: 'VRM demande une vérification que cette fenêtre ne sait pas afficher : touche « Relier par vrm.center ».', en: 'VRM asks for a check this window cannot show: tap “Link through vrm.center”.', es: 'VRM pide una verificación que esta ventana no puede mostrar: toca «Vincular con vrm.center».', it: 'VRM chiede una verifica che questa finestra non può mostrare: tocca «Collega tramite vrm.center».', de: 'VRM verlangt eine Prüfung, die dieses Fenster nicht anzeigen kann: tippe auf „Über vrm.center verbinden“.' },
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
let etatCourant = null, renouvDepuis = 0, minuterie = null;
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
  // Le formulaire n'est jamais redessiné par une relecture du même état (le texte tapé serait
  // perdu) : seule la phrase change.
  if ((etat === 'deconnecte' || etat === 'expiree') && box.getAttribute('data-rendu') === etat && document.getElementById('mdpForm')) {
    const ph = box.querySelector('[data-etat-phrase]'); if (ph) ph.textContent = phraseDeconnecte(e);
    clearTimeout(minuterie);
    return;
  }
  box.setAttribute('data-rendu', etat);
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
  } else if (etat === 'deconnecte' || etat === 'expiree') {
    // 21 nov. (Julien : « on peut faire les deux ») : les DEUX chemins à égalité, rien de caché.
    //   1. ICI, dans l'extension : e-mail + mot de passe VRM (le plein), Google / Discord (PKCE) ;
    //   2. « Relier par vrm.center » (contour, juste dessous) : la liaison par le site, retour sur Vinted.
    // 5.453 : en tête, le logo centré, « Connecte VRM » et UNE ligne (l'état s'il y en a un, sinon « Ton compte VRM, pas Vinted »).
    const ph = phraseDeconnecte(e), simple = ph === T('p_deconnecte');
    html = `<div class="accueil"><img class="logo-grand" src="logo-vrm-96.png" alt=""><h2 class="accueil-t">${esc(T('t_connecte'))}</h2>
      <p class="accueil-p${etat === 'expiree' ? ' fort' : ''}" data-etat-phrase>${esc(ph)}</p>${simple ? '' : `<p class="accueil-p">${esc(T('g_mdp'))}</p>`}</div>${htmlFormulaire(e)}`;
  } else if (etat === 'muet') {
    html = `<div class="groupe">${phrase(T('p_muet'), 'geste')}</div>
      <button class="plein" id="lierBtn" data-se-connecter>${esc(T('b_connecter'))}</button>`;
  }
  if (e.message) html += `<p class="err" role="alert">${esc(e.message)}</p>`;
  poserHtml(box, html);
  brancher(box);
  if (box.querySelector('#mdpForm')) brancherFormulaire(box);
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
  // Pendant l'attente, « Me connecter ici » arrête l'attente et montre le formulaire.
  sur('[data-autre-moyen]', async () => { const r = await demander('annulerLiaison', null, 6000); rendre(r && r.ok ? r : { ok: true, etat: 'deconnecte' }); });
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
    const o = ch.vrmOAuthEtat && ch.vrmOAuthEtat.newValue;
    if (o && o.etat === 'erreur' && oauthEnCours) { oauthEnCours = ''; const err = document.getElementById('authErr'); if (err) { err.textContent = o.message || T('e_fourn'); err.hidden = false; err.classList.remove('info'); } }
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
  const b = box && box.querySelector('[data-se-connecter], [data-rouvrir]'); if (b) { b.disabled = true; b.textContent = T('p_ouvre'); }
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
function phraseDeconnecte(e) {
  return e.etat === 'expiree' ? T('p_expiree') : e.voulue ? T('p_voulue') : e.attenteExpiree ? T('p_avorte') : T('p_deconnecte');
}
// Le formulaire (chemin 1) et, juste dessous, « Relier par vrm.center » (chemin 2).
const OEIL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="barre" d="M4 4l16 16"/></svg>';
function htmlFormulaire(e) {
  // 5.453 : les champs (e-mail, mot de passe + l'œil), « Me connecter » (le plein) et SA phrase juste dessous (l'attente,
  //    puis l'erreur), « ou », « Relier par vrm.center » (contour ; l'explication en bulle), « Mot de passe oublié ? ».
  return `<div id="mdpForm">
      <div class="groupe">
        <input class="champ" id="mail" type="email" inputmode="email" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${esc(T('ph_mail'))}" placeholder="${esc(T('ph_mail'))}" autocomplete="username email" value="${esc(e.etat === 'expiree' && e.email ? e.email : '')}">
        <div class="champ-mdp"><input class="champ" id="pw" type="password" aria-label="${esc(T('ph_pw'))}" placeholder="${esc(T('ph_pw'))}" autocomplete="current-password" enterkeyhint="go">
          <button class="oeil" id="oeilBtn" type="button" aria-pressed="false" aria-controls="pw" aria-label="${esc(T('b_voir'))}" title="${esc(T('b_voir'))}">${OEIL}</button></div>
      </div>
      <button class="plein" id="inBtn" data-me-connecter>${esc(T('b_me_connecter'))}</button>
      <p class="err" id="authErr" role="alert" hidden></p>
      <p class="sep" aria-hidden="true"><span>${esc(T('sep_ou'))}</span></p>
      <button class="contour" id="lierBtn" type="button" data-se-connecter title="${esc(T('pied_relier'))}">${esc(T('b_relier'))}</button>
      <div id="oauthBox" hidden></div>
      <div class="actions"><a class="lien discret" id="oubliLien" href="${APP}/?connexion&mot-de-passe-oublie" target="_blank" rel="noreferrer">${esc(T('l_oubli'))}</a></div>
    </div>`;
}
function brancherFormulaire(box) {
  lireFournisseurs(rendreFournisseurs);
  box.querySelector('#oubliLien').addEventListener('click', (ev) => {
    ev.preventDefault();
    const url = ev.currentTarget.href;
    try { chrome.tabs.create({ url }, () => { try { void chrome.runtime.lastError; } catch (_) {} if (!ONGLET) { try { window.close(); } catch (_) {} } }); } catch (_) { ouvrirSansTabs(url); }
  });
  const mail = box.querySelector('#mail'), pw = box.querySelector('#pw'), btn = box.querySelector('#inBtn'), err = box.querySelector('#authErr');
  // 5.453 : l'œil — voir / masquer le mot de passe (rien n'est gardé ; le champ reste le même).
  const oeil = box.querySelector('#oeilBtn');
  if (oeil) oeil.addEventListener('click', () => { const voir = pw.type === 'password'; pw.type = voir ? 'text' : 'password'; oeil.setAttribute('aria-pressed', voir ? 'true' : 'false'); const l = T(voir ? 'b_cacher' : 'b_voir'); oeil.setAttribute('aria-label', l); oeil.title = l; try { pw.focus(); } catch (_) {} });
  // Pas de focus d'office : sur iPhone le clavier couvrirait les deux chemins.
  const dire = (t) => { err.textContent = t; err.hidden = false; };
  // Une connexion à la fois : Entrée répétée ouvrait plusieurs sessions (mesuré : 4 × Entrée ⇒ 2 à 3).
  let enVol = false;
  const go = () => {
    if (enVol) return;
    const email = String(mail.value || '').trim(), password = pw.value;
    if (!email || !password) { dire(!email && !password ? T('e_vides') : !email ? T('e_mail') : T('e_pw')); try { (!email ? mail : pw).focus(); } catch (_) {} return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { dire(T('e_forme')); return; }
    enVol = true; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = T('b_connexion_cours'); err.classList.add('info'); err.textContent = T('b_connexion_cours'); err.hidden = true;
    let fini = false;
    const finir = (r, muet) => {
      if (fini) return; fini = true; clearTimeout(attente);
      enVol = false; btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = T('b_me_connecter'); err.classList.remove('info');
      if (r && r.ok) { rendre({ ok: true, etat: 'connecte', email: r.email || email }); charger(); return; }
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

// ── 5.325 / 5.328 : « CONTINUER AVEC GOOGLE / DISCORD », DANS L'EXTENSION ──
// Julien (8 nov.) : « mets directement l'endroit de connexion avec le mot de passe, le
// Google, Discord ». Sous le mot de passe, seulement les fournisseurs que Supabase dit
// ACTIVÉS (`fournisseursConnexion`, lu par le service worker) ; pas su ⇒ aucun bouton.
// Le clic : `oauthDepart` (PKCE, vérificateur dans chrome.storage, 10 min, une fois) ;
// le code revient par `oauth-retour.js` ; aucun jeton dans une adresse. La réussite se
// voit par la session (le stockage relance `charger`), l'échec par `vrmOAuthEtat`.
const FOURNISSEURS = [
  { id: 'google', nom: 'Google', logo: '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.5 46 24 46z"/><path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5C3 17 2.1 20.4 2.1 24s.9 7 2.4 9.9l7.3-5.7z"/><path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.5 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"/></svg>' },
  { id: 'discord', nom: 'Discord', logo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true" focusable="false"><path d="M19.3 5.3A16.9 16.9 0 0 0 15.1 4l-.2.4a15.7 15.7 0 0 1 3.7 1.2 13.1 13.1 0 0 0-11.2 0A15.6 15.6 0 0 1 11.1 4.4L10.9 4a16.9 16.9 0 0 0-4.2 1.3C4 9.3 3.3 13.2 3.7 17a17 17 0 0 0 5.1 2.6l1-1.7a11 11 0 0 1-1.7-.8l.4-.3a12.1 12.1 0 0 0 10.4 0l.4.3a11 11 0 0 1-1.7.8l1 1.7a17 17 0 0 0 5.1-2.6c.5-4.4-.6-8.3-2.4-11.7ZM9.7 14.7c-1 0-1.8-.9-1.8-2.1 0-1.1.8-2.1 1.8-2.1s1.9 1 1.8 2.1c0 1.2-.8 2.1-1.8 2.1Zm4.6 0c-1 0-1.8-.9-1.8-2.1 0-1.1.8-2.1 1.8-2.1s1.9 1 1.8 2.1c0 1.2-.8 2.1-1.8 2.1Z"/></svg>' },
];
function lireFournisseurs(cb) { demander('fournisseursConnexion', null, 3000).then((r) => cb(r && r.ok === true ? r : null)); }
let oauthEnCours = '';
function rendreFournisseurs(r) {
  const box = document.getElementById('oauthBox');
  if (!box) return;
  const actifs = r ? FOURNISSEURS.filter((f) => r[f.id] === true) : [];
  try { document.body.setAttribute('data-fournisseurs', r ? (actifs.map((f) => f.id).join(',') || 'aucun') : 'pas-su'); } catch (_) {}
  if (!actifs.length) { box.hidden = true; return; }
  poserHtml(box, `<p class="ou">${esc(T('ou'))}</p>` + actifs.map((f) => `<button class="fourn" type="button" id="oauth-${f.id}" data-fournisseur="${f.id}">${f.logo}<span>${esc(T('b_fourn', { f: f.nom }))}</span></button>`).join(''));
  for (const f of actifs) box.querySelector('#oauth-' + f.id).addEventListener('click', () => connexionFournisseur(f));
  box.hidden = false;
}
async function connexionFournisseur(f) {
  if (oauthEnCours) return;
  oauthEnCours = f.id;
  const err = document.getElementById('authErr');
  const dire = (t, erreur) => { if (!err) return; err.textContent = t; err.hidden = !t; err.classList.toggle('info', !erreur); };
  dire(T('p_fourn', { f: f.nom }), false);
  const r = await demander('oauthDepart', { fournisseur: f.id }, 6000);
  if (!r || !r.ok) { oauthEnCours = ''; dire((r && r.message) || T('e_fourn'), true); return; }
  if (r.ouvrirIci && r.url) ouvrirSansTabs(r.url);
  if (!ONGLET && !globalThis.__vrmOrionCompat) { try { window.close(); } catch (_) {} }
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
