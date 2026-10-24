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
// directement dans l'application VRM ». Le bouton principal OUVRE VRM, qui
// connecte l'extension tout seul (session adressée à CETTE extension) ; le
// mot de passe VRM ne se tape plus ici que si on le demande exprès.
const CARTE = /[?&]mode=carte\b/.test(location.search);
const REPARER = /[?&]mode=reparer\b/.test(location.search);
if (CARTE) document.body.classList.add('carte');

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
function ouvrirVRMPourLier(urlActive) {
  let id = ''; try { id = String(chrome.runtime.id || ''); } catch (_) {}
  const cible = ongletVRM(urlActive) + (id ? '&lier-extension=' + encodeURIComponent(id) : '');
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
async function lierAvecVRM() {
  const st = document.getElementById('lierEtat');
  if (st) { st.textContent = 'J’ouvre VRM…'; st.hidden = false; }
  const urlActive = CARTE ? '' : await ongletActif();
  const r = await new Promise((res) => {
    const t = setTimeout(() => res(null), 4000);
    try {
      chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'lierAvecVRM', urlActive }, (x) => {
        clearTimeout(t);
        let e = null; try { e = chrome.runtime.lastError; } catch (_) { e = null; }
        res(e ? null : (x || null));
      });
    } catch (_) { clearTimeout(t); res(null); }
  });
  if (r && r.ok) { if (!CARTE) window.close(); return; }
  // Pas de réponse : le code qui tourne n'est pas celui de cette page.
  await ouvrirVRMPourLier(urlActive);
  const rep = await reparerSiPerime();          // 'recharge' : l'extension redémarre (et cette fenêtre avec)
  try { document.body.setAttribute('data-lier-secours', rep); } catch (_) {}
  if (rep === 'recharge') return;
  if (st) st.textContent = rep === 'a-jour'
    ? 'L’extension n’a pas répondu à temps. VRM est ouvert : si rien ne se passe, connecte-toi ici avec ton mot de passe VRM.'
    : 'L’extension de ce Chrome tourne encore sur son ancien code : ouvre chrome://extensions et clique ⟳ sur VRM — ou connecte-toi ici avec ton mot de passe VRM.';
  const f = document.getElementById('mdpForm');
  if (f) { f.hidden = false; const m = document.getElementById('mail'); if (m) m.focus(); }
}

function rendreAuth(e) {
  const box = document.getElementById('auth');
  if (!box) return;
  // ⚠️⚠️ QUEL MOT DE PASSE ? On arrive ici juste après avoir été sur Vinted, on
  //    voit « Email / Mot de passe »… et on tape son mot de passe VINTED. La
  //    fenêtre le dit, et les placeholders aussi (c'est eux qu'on lit en tapant).
  const quelCompte = "C'est ton compte <b>VRM</b> — le même email et le même mot de passe que sur vrm.center. Ce n'est pas ton mot de passe Vinted, l'extension n'en a jamais besoin.";
  const titre = document.querySelector('h1');
  if (titre) titre.textContent = e && e.connecte ? 'VRM' : 'Connexion à VRM';
  if (e && e.connecte) {
    // Connecté dans la carte : on NOMME le compte (c'est ce qui permet de voir
    // qu'on s'est trompé), et le geste suivant est d'ouvrir VRM.
    poserHtml(box, `<div class="who"><span class="dot"></span><span class="nom">${esc(e.email || 'connecté')}</span></div>
      <div class="muted" style="margin-top:4px">L'extension capte maintenant pour ce compte VRM. Tout se pilote depuis l'app.</div>
      <div id="transpBox" hidden></div>
      <button id="vrmBtn">Ouvrir VRM</button>
      <button class="sec" id="outBtn">Se déconnecter</button>`);
    document.getElementById('vrmBtn').addEventListener('click', ouvrirVRM);
    rendreTranspPermis(e.transp);
    document.getElementById('outBtn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'authLogout' }, () => chargerAuth(true));
    });
    return;
  }
  const expiree = e && e.expiree;
  poserHtml(box, `<div class="who"><span class="dot warn"></span><span class="nom">${expiree ? 'Session expirée' : 'Non connecté'}</span></div>
    <div class="muted" style="margin-top:2px">${expiree
      ? 'Reconnecte l’extension à ton compte VRM : un clic, VRM s’ouvre et la reconnecte tout seul.'
      : 'Connecte l’extension à ton compte VRM : un clic, VRM s’ouvre et la connecte tout seul. Rien à taper ici.'}</div>
    <button id="lierBtn">Se connecter avec VRM</button>
    <div class="muted" id="lierEtat" hidden></div>
    <div class="muted" style="margin-top:12px"><a href="#" id="mdpLien">avec mon mot de passe VRM</a></div>
    <div id="mdpForm" hidden>
      <div class="muted" style="margin-top:6px">${quelCompte}</div>
      <input id="mail" type="email" placeholder="Email de ton compte VRM" autocomplete="username" value="${esc(expiree && e.email ? e.email : '')}">
      <input id="pw" type="password" placeholder="Mot de passe VRM" autocomplete="current-password">
      <button class="sec" id="inBtn">Me connecter</button>
      <div class="err" id="authErr" hidden></div>
    </div>
    <div id="captchaBox" hidden>
      <div class="err" id="captchaMsg"></div>
      <button id="captchaLierBtn">Se connecter avec VRM</button>
    </div>
    <div class="muted">Pas encore de compte ? <a href="https://vrm.center/?inscription" target="_blank" rel="noreferrer">Ouvre vrm.center</a> et crée-le en une minute.</div>`);
  document.getElementById('lierBtn').addEventListener('click', lierAvecVRM);
  document.getElementById('mdpLien').addEventListener('click', (ev) => {
    ev.preventDefault();
    const f = document.getElementById('mdpForm');
    f.hidden = !f.hidden;
    if (!f.hidden) { const m = document.getElementById('mail'); if (m && !m.value) m.focus(); else { const p = document.getElementById('pw'); if (p) p.focus(); } }
  });
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
  const go = () => {
    if (enVol) return;
    const email = document.getElementById('mail').value, password = document.getElementById('pw').value;
    const btn = document.getElementById('inBtn');
    enVol = true; btn.textContent = 'Connexion…'; btn.disabled = true; err.hidden = true;
    // Dans la carte, c'est le SERVICE WORKER qui ouvre VRM après la connexion
    // (`ouvrir`) : la carte se referme dès que la session change, avant d'avoir
    // reçu la réponse — elle n'ouvrait VRM que 45 fois sur 50.
    chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'authLogin', email, password, ouvrir: CARTE }, (r) => {
      enVol = false; btn.textContent = 'Me connecter'; btn.disabled = false;
      if (r && r.ok) { if (!CARTE) ouvrirVRM(); }
      else if (refusCaptcha(r)) montrerRefusCaptcha();
      else { err.textContent = (r && r.error) || 'Connexion refusée.'; err.hidden = false; }
    });
  };
  document.getElementById('inBtn').addEventListener('click', go);
  // Entrée depuis le champ mot de passe : sinon il faut viser le bouton.
  document.getElementById('pw').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
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
// ── LE SUIVI DES TRANSPORTEURS (5.217) ─────────────────────────────────────
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
      if (!CARTE && !rester && !PERMIS_MANQUE(t)) { ouvrirVRM(); return; }
      document.body.classList.remove('decide');
      rendreAuth(Object.assign({}, e, { transp: t }));
    });
  });
}
if (REPARER) reparerSiPerime().then((r) => { try { document.body.setAttribute('data-reparation', r); } catch (_) {} });
else chargerAuth();
