// popup.js — la connexion à VRM, et rien d'autre.
//
// Trois endroits l'affichent, avec LE MÊME code (§11) :
// - l'icône de l'extension dans la barre de Chrome (fenêtre classique) ;
// - la petite carte en bas à droite de Vinted, Leboncoin, eBay… (`?mode=carte`,
//   dans un iframe de l'EXTENSION : rien ne passe par le DOM du site, que ses
//   scripts peuvent lire) ;
// - un cadre invisible posé par le pont quand le code qui tourne est périmé
//   (`?mode=reparer`, voir plus bas).
//
// 2 octobre (Julien) : « tout doit être centralisé dans VRM ». Les sections
// « Comptes captés », « Fraîcheur » et « Synchroniser » sont parties : leur
// place est dans l'app.
// 11 octobre (Julien) : « quand j'appuie sur se connecter ça doit envoyer
// directement dans l'application VRM ». Le bouton principal OUVRAIT VRM.
// ⚠️ 8 nov. (5.328, Julien sur son iPhone, Orion : « mets directement l'endroit
// de connexion avec le mot de passe, le Google, Discord, parce que "Se
// connecter" change de page VRM et ça ne se connecte pas ») : partout, dans cet
// ordre — e-mail + mot de passe VRM (« Me connecter », Entrée), « Mot de passe
// oublié ? », puis « Continuer avec Google / Discord » (seulement activés), puis
// « Se connecter avec VRM » en dernier recours. Le mot de passe part UNE fois au
// service worker (`authLogin`), jamais gardé, jamais dans une adresse.
const CARTE = /[?&]mode=carte\b/.test(location.search);
const REPARER = /[?&]mode=reparer\b/.test(location.search);
if (CARTE) { document.body.classList.add('carte'); document.documentElement.classList.add('carte'); }
// 5.328 : dans la carte du logo, le cadre dit à la carte qu'il s'affiche et sa
// hauteur (pour qu'elle le montre en entier, sans second défilement). Seulement
// ces deux messages : ni e-mail, ni mot de passe, ni état ne sortent d'ici.
function direALaCarte(quoi) {
  if (!CARTE || window.parent === window) return;
  try {
    const h = Math.ceil(document.documentElement.scrollHeight || document.body.scrollHeight || 0);
    window.parent.postMessage(quoi === 'hauteur' ? { __vrmCarte: 'hauteur', h } : { __vrmCarte: 'prete' }, '*');
  } catch (_) {}
}
if (CARTE) {
  try { new ResizeObserver(() => direALaCarte('hauteur')).observe(document.body); } catch (_) {}
}

// Un email est du texte saisi : il n'entre jamais dans du HTML sans être échappé.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 5.188 : le HTML de nos propres gabarits (valeurs passées par `esc`) est posé
// par DOMParser plutôt que `innerHTML =` — même résultat, et c'est la forme que
// les boutiques (Firefox, Edge) relisent sans avertissement.
const poserHtml = (el, html) => { const d = new DOMParser().parseFromString('<body>' + String(html) + '</body>', 'text/html'); el.replaceChildren(...Array.from(d.body.childNodes)); };


// ── LA RÉPARATION D'UN CODE PÉRIMÉ (11 octobre) ───────────────────────────
// ⚠️⚠️ MESURÉ : après le remplacement du dossier, Chrome garde l'ANCIEN service
//    worker tant qu'on n'a pas cliqué ⟳ dans chrome://extensions — et seulement
//    dans le Chrome où on le clique. Une page de l'extension, elle, est lue
//    depuis le disque : elle peut faire ce ⟳ (`chrome.runtime.reload()`).
//    Le pont la pose quand il juge le code périmé ; elle ne le CROIT pas sur
//    parole : elle redemande la version du code au service worker, et ne
//    recharge que si elle n'est pas celle du manifeste — UNE fois par version
//    (garde dans `chrome.storage.local`, une boucle de rechargements est
//    impossible). Un service worker simplement lent n'est pas rechargé : il
//    répond la bonne version.
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
  let deja = null;
  try { deja = (await chrome.storage.local.get(REPARATION_STORE))[REPARATION_STORE] || null; } catch (_) { return 'stockage'; }
  if (deja && deja.cle === manif && Date.now() - Number(deja.at || 0) < 24 * 3600e3) return 'deja';
  try { await chrome.storage.local.set({ [REPARATION_STORE]: { cle: manif, at: Date.now(), vu: code == null ? '' : String(code) } }); } catch (_) { return 'stockage'; }
  try { chrome.runtime.reload(); } catch (_) { return 'echec'; }
  return 'recharge';
}

// Navigateur sans API `tabs` utilisable (20 octobre, Orion iPhone : la fenêtre
// est une feuille) : on ouvre VRM comme une page le ferait. Sur Chrome on
// n'arrive jamais ici (`chrome.tabs.create` répond).
function ouvrirSansTabs(url) {
  try { const w = window.open(url, '_blank'); if (w) return true; } catch (_) {}
  try { window.location.href = url; return true; } catch (_) {}
  return false;
}
// L'onglet actif (fenêtre de l'icône) : c'est lui qui décide l'onglet de VRM.
function ongletActif() {
  return new Promise((res) => {
    try { chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => res((tabs && tabs[0] && tabs[0].url) || '')); }
    catch (_) { res(''); }
  });
}
// « Se connecter avec VRM » : le service worker ouvre VRM TOUT DE SUITE (aucune
// attente avant), et l'app connectée lui adresse sa session.
// ⚠️⚠️ Revue du 11 octobre : sur un code PÉRIMÉ (dossier remplacé, ⟳ jamais
//    cliqué — 5 de ses 6 Chrome), l'ancien service worker ne connaît pas
//    `lierAvecVRM` : le port se fermait, la fenêtre se fermait aussi, et RIEN ne
//    se passait (mesuré : aucun onglet VRM, code toujours ancien). Cette page,
//    elle, est lue depuis le disque : sans réponse, elle ouvre VRM elle-même
//    (avec l'identifiant de CETTE extension), répare le code (le ⟳), et si elle
//    ne peut pas, déplie le mot de passe VRM et dit le geste.
function ouvrirVRMPourLier(urlActive, connexion) {
  let id = ''; try { id = String(chrome.runtime.id || ''); } catch (_) {}
  const cible = ongletVRM(urlActive) + (id ? '&lier-extension=' + encodeURIComponent(id) + (connexion ? '&connexion=' + connexion : '') : '');
  return new Promise((res) => {
    const t = setTimeout(() => res(false), 3000);
    const fin = (ok) => { clearTimeout(t); res(ok); };
    try {
      chrome.tabs.query({ url: APP + '/*' }, (ouverts) => {
        const o = (ouverts || [])[0];
        if (o) chrome.tabs.update(o.id, { url: cible, active: true }, () => { try { chrome.windows.update(o.windowId, { focused: true }); } catch (_) {} fin(true); });
        else chrome.tabs.create({ url: cible }, () => fin(true));
      });
    } catch (_) { try { chrome.tabs.create({ url: cible }, () => fin(true)); } catch (_) { fin(ouvrirSansTabs(cible)); } }
  });
}
// `connexion` (5.325) : « Continuer avec Google / Discord » — un nom de la
// liste, sinon rien (un clic sur « Se connecter avec VRM » passe un événement).
async function lierAvecVRM(fournisseur) {
  const connexion = typeof fournisseur === 'string' && FOURNISSEURS.some((f) => f.id === fournisseur) ? fournisseur : '';
  const st = document.getElementById('lierEtat');
  if (st) { st.textContent = 'J’ouvre VRM…'; st.hidden = false; }
  const urlActive = CARTE ? '' : await ongletActif();
  const r = await new Promise((res) => {
    const t = setTimeout(() => res(null), 4000);
    try {
      chrome.runtime.sendMessage(Object.assign({ from: 'cancale-popup', action: 'lierAvecVRM', urlActive }, connexion ? { connexion } : {}), (x) => {
        clearTimeout(t);
        let e = null; try { e = chrome.runtime.lastError; } catch (_) { e = null; }
        res(e ? null : (x || null));
      });
    } catch (_) { clearTimeout(t); res(null); }
  });
  if (r && r.ok) { if (!CARTE) window.close(); return; }
  // Pas de réponse : le code qui tourne n'est pas celui de cette page.
  await ouvrirVRMPourLier(urlActive, connexion);
  const rep = await reparerSiPerime();          // 'recharge' : l'extension redémarre (et cette fenêtre avec)
  try { document.body.setAttribute('data-lier-secours', rep); } catch (_) {}
  if (rep === 'recharge') return;
  if (st) st.textContent = rep === 'a-jour'
    ? 'L’extension n’a pas répondu à temps. VRM est ouvert : si rien ne se passe, connecte-toi ici avec ton mot de passe VRM.'
    : 'L’extension de ce Chrome tourne encore sur son ancien code : ouvre chrome://extensions et clique ⟳ sur VRM — ou connecte-toi ici avec ton mot de passe VRM.';
  const f = document.getElementById('mdpForm');
  if (f) { f.hidden = false; const m = document.getElementById('mail'); if (m) m.focus(); }
}

// ── 5.325 (8 nov.) : « CONTINUER AVEC GOOGLE / DISCORD » ─────────────────
// Julien : « une personne qui a créé son compte avec Google ou Discord et qui
// veut se connecter à l'extension, il ne va pas pouvoir ». Elle n'a pas de mot
// de passe VRM. Deux boutons, SOUS « Se connecter avec VRM », affichés
// seulement pour un fournisseur que Supabase dit ACTIVÉ (le service worker lit
// `/auth/v1/settings`, `fournisseursConnexion`). Pas de réponse (code périmé,
// réseau) ⇒ aucun bouton : jamais un bouton qui mène à une erreur. Le clic
// ouvre VRM comme « Se connecter avec VRM », avec `connexion=<fournisseur>` :
// l'app part chez Google/Discord si personne n'y est connecté, puis ADRESSE sa
// session à CETTE extension. Aucun jeton ne passe par ici.
// Logos : le « G » aux quatre couleurs de Google, la manette de Discord en
// blurple — sur un bouton neutre (chartes « Sign in with Google » et Discord).
const FOURNISSEURS = [
  { id: 'google', nom: 'Google', logo: '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.5 46 24 46z"/><path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5C3 17 2.1 20.4 2.1 24s.9 7 2.4 9.9l7.3-5.7z"/><path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.5 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"/></svg>' },
  { id: 'discord', nom: 'Discord', logo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true" focusable="false"><path d="M19.3 5.3A16.9 16.9 0 0 0 15.1 4l-.2.4a15.7 15.7 0 0 1 3.7 1.2 13.1 13.1 0 0 0-11.2 0A15.6 15.6 0 0 1 11.1 4.4L10.9 4a16.9 16.9 0 0 0-4.2 1.3C4 9.3 3.3 13.2 3.7 17a17 17 0 0 0 5.1 2.6l1-1.7a11 11 0 0 1-1.7-.8l.4-.3a12.1 12.1 0 0 0 10.4 0l.4.3a11 11 0 0 1-1.7.8l1 1.7a17 17 0 0 0 5.1-2.6c.5-4.4-.6-8.3-2.4-11.7ZM9.7 14.7c-1 0-1.8-.9-1.8-2.1 0-1.1.8-2.1 1.8-2.1s1.9 1 1.8 2.1c0 1.2-.8 2.1-1.8 2.1Zm4.6 0c-1 0-1.8-.9-1.8-2.1 0-1.1.8-2.1 1.8-2.1s1.9 1 1.8 2.1c0 1.2-.8 2.1-1.8 2.1Z"/></svg>' },
];
// Trois états : `null` pas su (rien affiché) · `{google, discord}` lus.
function lireFournisseurs(cb) {
  let fini = false;
  const fin = (v) => { if (fini) return; fini = true; cb(v); };
  setTimeout(() => fin(null), 3000);
  try {
    chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'fournisseursConnexion' }, (r) => {
      let e = null; try { e = chrome.runtime.lastError; } catch (_) { e = null; }
      fin(!e && r && r.ok === true ? r : null);
    });
  } catch (_) { fin(null); }
}
// 5.328 : le clic lance l'OAuth DANS l'extension (`oauthDepart`) — Google ou
// Discord s'ouvre dans un onglet, revient sur la page de retour de
// l'extension, l'onglet se ferme : aucun écran de VRM à utiliser. Le service
// worker muet (code d'avant) ⇒ l'ancien chemin par VRM, dit comme tel.
let oauthEnCours = '';
function direOAuth(t, erreur) {
  const st = document.getElementById('lierEtat');
  if (!st) return;
  st.textContent = t; st.hidden = !t;
  st.classList.toggle('err', !!erreur);
  try { document.body.setAttribute('data-oauth', erreur ? 'erreur' : (t ? 'attente' : '')); } catch (_) {}
  direALaCarte('hauteur');
}
function connexionFournisseur(id) {
  const f = FOURNISSEURS.find((x) => x.id === id);
  if (!f) return;
  oauthEnCours = id;
  direOAuth(`${f.nom} s’ouvre dans un nouvel onglet. Connecte-toi : l’onglet se ferme tout seul et l’extension est connectée.`);
  let fini = false;
  const t = setTimeout(() => { if (!fini) { fini = true; lierAvecVRM(id); } }, 5000);
  try {
    chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'oauthDepart', fournisseur: id }, (r) => {
      let e = null; try { e = chrome.runtime.lastError; } catch (_) { e = null; }
      if (fini) return; fini = true; clearTimeout(t);
      if (e || !r) { lierAvecVRM(id); return; }
      if (!r.ok) { oauthEnCours = ''; direOAuth(r.message || 'La connexion n’a pas pu démarrer.', true); return; }
      if (r.ouvrirIci && r.url) ouvrirSansTabs(r.url);
      if (!CARTE && !globalThis.__vrmOrionCompat) { try { window.close(); } catch (_) {} }
    });
  } catch (_) { if (!fini) { fini = true; clearTimeout(t); lierAvecVRM(id); } }
}
// Le résultat arrive par le stockage (le service worker l'y écrit) : erreur dite,
// compte neuf dit ; la réussite, elle, se voit par la session (chargerAuth).
try {
  chrome.storage.onChanged.addListener((ch, zone) => {
    if (zone !== 'local') return;
    if (ch.vrmSession && !REPARER) chargerAuth(true);
    const v = ch.vrmOAuthEtat && ch.vrmOAuthEtat.newValue;
    if (v && v.etat === 'erreur' && oauthEnCours) { oauthEnCours = ''; direOAuth(v.message || 'La connexion n’a pas abouti.', true); }
    if (v && v.etat === 'ok' && v.neuf) { try { sessionStorage.setItem('vrmOAuthNeuf', '1'); } catch (_) {} }
  });
} catch (_) {}
function rendreFournisseurs(r) {
  const box = document.getElementById('oauthBox');
  if (!box) return;
  const actifs = r ? FOURNISSEURS.filter((f) => r[f.id] === true) : [];
  try { document.body.setAttribute('data-fournisseurs', r ? (actifs.map((f) => f.id).join(',') || 'aucun') : 'pas-su'); } catch (_) {}
  if (!actifs.length) { box.hidden = true; return; }
  poserHtml(box, actifs.map((f) => `<button class="sec fourn" id="oauth-${f.id}" data-fournisseur="${f.id}" aria-label="Continuer avec ${f.nom}">${f.logo}<span>Continuer avec ${f.nom}</span></button>`).join(''));
  for (const f of actifs) document.getElementById('oauth-' + f.id).addEventListener('click', () => connexionFournisseur(f.id));
  box.hidden = false;
  // Le formulaire du mot de passe le dit : un compte Google/Discord n'en a pas.
  const mot = document.getElementById('mdpOauthMot');
  if (mot) {
    const noms = actifs.map((f) => f.nom).join(' ou ');
    mot.textContent = `Compte créé avec ${noms} ? Utilise ${actifs.length > 1 ? 'les boutons' : 'le bouton'} au-dessus.`;
    box.after(mot);
    mot.hidden = false;
  }
}

function rendreAuth(e) {
  const box = document.getElementById('auth');
  if (!box) return;
  // ⚠️⚠️ QUEL MOT DE PASSE ? On arrive ici juste après avoir été sur Vinted, on
  //    voit « Email / Mot de passe »… et on tape son mot de passe VINTED. La
  //    fenêtre le dit, et les placeholders aussi (c'est eux qu'on lit en tapant).
  // 5.328 : une phrase — ceux de vrm.center, pas ceux de Vinted.
  const quelCompte = "Ton email et ton mot de passe <b>VRM</b> (ceux de vrm.center) — pas ton mot de passe Vinted.";
  const titre = document.querySelector('h1');
  if (titre) titre.textContent = e && e.connecte ? 'VRM' : 'Connexion à VRM';
  if (e && e.connecte) {
    // Connecté dans la carte : on NOMME le compte (c'est ce qui permet de voir
    // qu'on s'est trompé), et le geste suivant est d'ouvrir VRM.
    poserHtml(box, `<div class="who"><span class="dot"></span><span class="nom">${esc(e.email || 'connecté')}</span></div>
      <div class="muted" style="margin-top:4px">L’extension est connectée : tes données partent quand tu ouvres Vinted, Leboncoin ou Vestiaire.</div>
      ${(() => { let n = false; try { n = sessionStorage.getItem('vrmOAuthNeuf') === '1'; } catch (_) {} return n ? '<div class="err" data-compte-neuf>Ce compte n’était relié à aucun compte VRM : un compte VRM neuf vient d’être créé. Si tu as déjà un compte VRM, clique « Se déconnecter » et connecte-toi avec son email et son mot de passe.</div>' : ''; })()}
      <div id="transpBox" hidden></div>
      <button id="vrmBtn">Ouvrir VRM</button>
      <button class="sec" id="outBtn">Se déconnecter</button>`);
    document.getElementById('vrmBtn').addEventListener('click', ouvrirVRM);
    rendreTranspPermis(e.transp);
    direALaCarte('prete'); direALaCarte('hauteur');
    document.getElementById('outBtn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'authLogout' }, () => chargerAuth(true));
    });
    return;
  }
  const expiree = e && e.expiree;
  poserHtml(box, `<div class="who deco"><span class="dot warn"></span><span class="nom">${expiree ? 'Session expirée' : 'Non connecté'}</span></div>
    <div class="muted" style="margin-top:6px">${quelCompte}</div>
    <div id="mdpForm">
      <label class="lab" for="mail">Email de ton compte VRM</label>
      <input id="mail" type="email" inputmode="email" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Email de ton compte VRM" autocomplete="username" value="${esc(expiree && e.email ? e.email : '')}">
      <label class="lab" for="pw">Mot de passe VRM</label>
      <input id="pw" type="password" placeholder="Mot de passe VRM" autocomplete="current-password" enterkeyhint="go">
      <button id="inBtn">Me connecter</button>
      <div class="err" id="authErr" role="alert" hidden></div>
      <div class="muted" style="margin-top:4px"><a href="${APP}/?connexion&mot-de-passe-oublie" target="_blank" rel="noreferrer" id="oubliLien">Mot de passe oublié ?</a></div>
    </div>
    <div id="captchaBox" hidden>
      <div class="err" id="captchaMsg"></div>
      <button id="captchaLierBtn">Se connecter avec VRM</button>
    </div>
    <div class="ou" id="ouSep"><span>ou</span></div>
    <div id="oauthBox" hidden></div>
    <div class="muted" id="mdpOauthMot" hidden></div>
    <div class="muted" id="lierEtat" role="status" hidden></div>
    <button class="lien" id="lierBtn">Rien ne marche ? Se connecter en passant par le site VRM</button>
    <div class="muted">Pas encore de compte ? <a href="https://vrm.center/?inscription" target="_blank" rel="noreferrer">Ouvre vrm.center</a> et crée-le en une minute.</div>`);
  document.getElementById('lierBtn').addEventListener('click', lierAvecVRM);
  // « Mot de passe oublié ? » : VRM s'ouvre sur la récupération. Fenêtre de
  // l'icône sans `target` utilisable (Orion : une feuille) ⇒ comme une page.
  document.getElementById('oubliLien').addEventListener('click', (ev) => {
    const url = ev.currentTarget.href;
    if (CARTE) return;                       // l'iframe ouvre un onglet de lui-même
    ev.preventDefault();
    try { chrome.tabs.create({ url }, () => { void chrome.runtime.lastError; try { window.close(); } catch (_) {} }); } catch (_) { ouvrirSansTabs(url); }
  });
  const mailVide = !document.getElementById('mail').value;
  if (!CARTE) { try { document.getElementById(mailVide ? 'mail' : 'pw').focus(); } catch (_) {} }
  lireFournisseurs(rendreFournisseurs);
  const err = document.getElementById('authErr');
  // ⚠️ CAPTCHA (21 oct.) : Supabase peut exiger une vérification anti-robot
  //    (Turnstile) que cette fenêtre ne sait pas afficher. Le refus se traduit
  //    en UN geste qui marche : « Se connecter avec VRM ». On reconnaît aussi
  //    le refus brut (« captcha protection… ») d'un service worker plus ancien.
  const refusCaptcha = (r) => !!(r && (r.captcha || /captcha/i.test(String(r.error || ''))));
  const montrerRefusCaptcha = () => {
    document.getElementById('mdpForm').hidden = true;
    const box = document.getElementById('captchaBox');
    document.getElementById('captchaMsg').textContent = 'La connexion par mot de passe n’est plus possible depuis l’extension : utilise « Se connecter avec VRM ».';
    box.hidden = false;
    try { document.body.setAttribute('data-captcha', 'refus'); } catch (_) {}
  };
  document.getElementById('captchaLierBtn').addEventListener('click', lierAvecVRM);
  // ⚠️ Une connexion à la fois : Entrée répétée (ou clic + Entrée) ouvrait
  //    plusieurs sessions pour une seule connexion (mesuré : 4 × Entrée ⇒ 2 à 3
  //    sessions, dont les autres restent orphelines).
  let enVol = false;
  const dire = (t) => { err.textContent = t; err.hidden = false; direALaCarte('hauteur'); };
  const go = () => {
    if (enVol) return;
    const email = document.getElementById('mail').value, password = document.getElementById('pw').value;
    // 5.328 : les champs vides se disent ici, sans rien envoyer.
    if (!String(email).trim() || !password) {
      dire(!String(email).trim() && !password ? 'Tape l’email et le mot de passe de ton compte VRM.' : !String(email).trim() ? 'Tape l’email de ton compte VRM.' : 'Tape ton mot de passe VRM.');
      try { document.getElementById(!String(email).trim() ? 'mail' : 'pw').focus(); } catch (_) {}
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) { dire('Cet email n’a pas la bonne forme (exemple : prenom@exemple.fr).'); return; }
    const btn = document.getElementById('inBtn');
    enVol = true; btn.textContent = 'Connexion…'; btn.disabled = true; err.hidden = true;
    let fini = false;
    const finir = (r, muet) => {
      if (fini) return; fini = true; clearTimeout(attente);
      enVol = false; btn.textContent = 'Me connecter'; btn.disabled = false;
      if (r && r.ok) { rendreAuth({ connecte: true, email: r.email || email.trim() }); direALaCarte('hauteur'); }
      else if (refusCaptcha(r)) montrerRefusCaptcha();
      else if (muet) dire('L’extension n’a pas répondu. Réessaie dans un instant ; si ça dure, utilise « Se connecter avec VRM » plus bas.');
      else dire((r && r.error) || 'Connexion refusée.');
    };
    // iOS peut suspendre le service worker en route : jamais un bouton figé.
    const attente = setTimeout(() => finir(null, true), 20000);
    // Rester sur la plateforme après le mot de passe : la capture repart
    // depuis la session conservée par le moteur, sans ouvrir un onglet VRM.
    try {
      chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'authLogin', email, password, ouvrir: false }, (r) => {
        let e2 = null; try { e2 = chrome.runtime.lastError; } catch (_) { e2 = null; }
        finir(e2 ? null : r, !!e2 || r === undefined);
      });
    } catch (_) { finir(null, true); }
  };
  document.getElementById('inBtn').addEventListener('click', go);
  // Entrée depuis le champ mot de passe : sinon il faut viser le bouton.
  document.getElementById('pw').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
  document.getElementById('mail').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); const p = document.getElementById('pw'); if (p && !p.value) p.focus(); else go(); } });
  direALaCarte('prete');
  direALaCarte('hauteur');
}

// ── L'ICÔNE OUVRE VRM (Julien, 30 septembre) ──────────────────────────────
// Connecté : on ouvre (ou on réutilise) l'onglet vrm.center, sur l'onglet de la
// plateforme où l'on est, et la fenêtre se ferme. Dans la carte (iframe d'un
// site), c'est le service worker qui ouvre : il connaît l'onglet du site.
const APP = 'https://vrm.center';
function ongletVRM(url) {
  const u = String(url || '');
  const p = /leboncoin\.fr/i.test(u) ? 'plat_leboncoin'
    : /ebay\.(fr|com)/i.test(u) ? 'plat_ebay'
    : /vestiairecollective\./i.test(u) ? 'plat_vestiaire'
    : 'plat_vinted';
  return APP + '/?tab=' + p;
}
function ouvrirVRM() {
  if (CARTE) {
    try { chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'ouvrirVRM' }, () => { void chrome.runtime.lastError; }); } catch (_) {}
    return;
  }
  const aller = (url) => {
    const cible = ongletVRM(url);
    try {
      chrome.tabs.query({ url: APP + '/*' }, (ouverts) => {
        const t = (ouverts || [])[0];
        if (t) chrome.tabs.update(t.id, { url: cible, active: true }, () => { try { chrome.windows.update(t.windowId, { focused: true }); } catch (_) {} window.close(); });
        else chrome.tabs.create({ url: cible }, () => window.close());
      });
    } catch (_) { try { chrome.tabs.create({ url: cible }); } catch (_) { ouvrirSansTabs(cible); } window.close(); }
  };
  try { chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => aller(tabs && tabs[0] && tabs[0].url)); }
  catch (_) { aller(''); }
}
// ── LE SUIVI DES TRANSPORTEURS (5.290) ─────────────────────────────────────
// L'extension lit le statut d'un colis sur le site du transporteur (Mondial
// Relay, Chronopost, Vinted Go) depuis CE navigateur. Chrome accorde ces sites
// à l'installation ; Firefox peut les laisser NON accordés (permissions d'hôte
// MV3) : sans elles, le fond se tait. Le bouton ne s'affiche QUE dans ce cas
// (le fond a mesuré `permissions.contains` = faux), et seulement si ce
// navigateur sait les demander. `chrome.permissions.request` doit partir DANS
// le geste (Firefox refuse une demande faite après une attente) : la liste des
// sites est connue AVANT le clic.
function lirePermisTransp(cb) {
  let fini = false;
  const fin = (v) => { if (fini) return; fini = true; cb(v); };
  setTimeout(() => fin(null), 1500);
  try {
    chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'transpPermis' }, (r) => {
      try { void chrome.runtime.lastError; } catch (_) {}
      fin(r && r.ok ? r : null);
    });
  } catch (_) { fin(null); }
}
const peutDemanderPermis = () => { try { return !!(chrome.permissions && typeof chrome.permissions.request === 'function'); } catch (_) { return false; } };
// Le cas utile : la permission manque (mesuré faux, jamais « pas su ») ET ce
// navigateur sait la demander.
const PERMIS_MANQUE = (t) => !!(t && t.permis === false && Array.isArray(t.origines) && t.origines.length && peutDemanderPermis());
function rendreTranspPermis(t) {
  const box = document.getElementById('transpBox');
  if (!box) return;
  if (!PERMIS_MANQUE(t)) { box.hidden = true; return; }
  box.hidden = false;
  // Dans la petite carte (un cadre posé dans le site) : une ligne, pas le
  // bouton. La demande se fait depuis la fenêtre de l'icône — une page de
  // l'extension, le seul endroit mesuré où le geste vaut — et la carte n'a pas
  // la place d'un second bouton.
  if (CARTE) {
    box.setAttribute('data-transp-permis', 'manque-carte');
    poserHtml(box, '<div class="muted">Pour lire le suivi de tes colis chez les transporteurs, clique l’icône VRM de la barre du navigateur et autorise-le.</div>');
    return;
  }
  box.setAttribute('data-transp-permis', 'manque');
  poserHtml(box, `<div class="muted">Pour lire le suivi de tes colis sur les sites des transporteurs (Mondial Relay, Chronopost, Vinted Go), ce navigateur doit d'abord l'autoriser. VRM n'y lit que le statut des colis que tu attends.</div>
    <button id="transpPermisBtn">Autoriser VRM à lire le suivi des transporteurs</button>
    <div class="muted" id="transpPermisEtat" hidden></div>`);
  const origines = t.origines.slice();
  document.getElementById('transpPermisBtn').addEventListener('click', () => {
    const btn = document.getElementById('transpPermisBtn');
    const etat = document.getElementById('transpPermisEtat');
    const dire = (ok) => {
      box.setAttribute('data-transp-permis', ok ? 'accorde' : 'refuse');
      if (etat) {
        etat.hidden = false;
        etat.textContent = ok
          ? 'C’est autorisé : l’extension peut maintenant lire le suivi de tes colis sur ces sites.'
          : 'Ce n’est pas autorisé : rien n’est lu sur ces sites depuis ce navigateur. VRM lit ce qu’il peut de son côté.';
      }
      // `hidden` ne suffit pas : la règle `button { display: block }` l'emporte.
      if (btn && ok) btn.remove();
    };
    let fini = false;
    const fin = (v) => { if (fini) return; fini = true; dire(v === true); };
    try {
      // Appelé TOUT DE SUITE, dans le geste : aucune attente avant.
      const r = chrome.permissions.request({ origins: origines }, (v) => { try { void chrome.runtime.lastError; } catch (_) {} fin(v); });
      if (r && typeof r.then === 'function') r.then(fin, () => fin(false));
    } catch (_) { fin(false); }
  });
}

// `rester` : après une déconnexion, on montre la connexion au lieu de rouvrir.
// Connecté : l'icône ouvre VRM — SAUF quand une permission des transporteurs
// manque et peut se demander ici (le seul endroit où le geste est possible).
function chargerAuth(rester) {
  chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'authEtat' }, (r) => {
    const e = r || {};
    if (!e.connecte) { document.body.classList.remove('decide'); rendreAuth(e); return; }
    lirePermisTransp((t) => {
      if (!CARTE && !rester && !globalThis.__vrmOrionCompat && !PERMIS_MANQUE(t)) { ouvrirVRM(); return; }
      document.body.classList.remove('decide');
      rendreAuth(Object.assign({}, e, { transp: t }));
    });
  });
}
if (REPARER) reparerSiPerime().then((r) => { try { document.body.setAttribute('data-reparation', r); } catch (_) {} });
else chargerAuth();
