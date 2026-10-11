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

// L'onglet actif (fenêtre de l'icône) : c'est lui qui décide l'onglet de VRM.
function ongletActif() {
  return new Promise((res) => {
    try { chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => res((tabs && tabs[0] && tabs[0].url) || '')); }
    catch (_) { res(''); }
  });
}
// « Se connecter avec VRM » : le service worker ouvre VRM TOUT DE SUITE (aucune
// attente avant), et l'app connectée lui adresse sa session.
async function lierAvecVRM() {
  const st = document.getElementById('lierEtat');
  if (st) { st.textContent = 'J’ouvre VRM…'; st.hidden = false; }
  const urlActive = CARTE ? '' : await ongletActif();
  try {
    chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'lierAvecVRM', urlActive }, () => {
      void chrome.runtime.lastError;
      if (!CARTE) window.close();
    });
  } catch (_) {}
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
    box.innerHTML = `<div class="who"><span class="dot"></span><span class="nom">${esc(e.email || 'connecté')}</span></div>
      <div class="muted" style="margin-top:4px">L'extension capte maintenant pour ce compte VRM. Tout se pilote depuis l'app.</div>
      <button id="vrmBtn">Ouvrir VRM</button>
      <button class="sec" id="outBtn">Se déconnecter</button>`;
    document.getElementById('vrmBtn').addEventListener('click', ouvrirVRM);
    document.getElementById('outBtn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'authLogout' }, () => chargerAuth(true));
    });
    return;
  }
  const expiree = e && e.expiree;
  box.innerHTML = `<div class="who"><span class="dot warn"></span><span class="nom">${expiree ? 'Session expirée' : 'Non connecté'}</span></div>
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
    <div class="muted">Pas encore de compte ? <a href="https://vrm.center/?inscription" target="_blank" rel="noreferrer">Ouvre vrm.center</a> et crée-le en une minute.</div>`;
  document.getElementById('lierBtn').addEventListener('click', lierAvecVRM);
  document.getElementById('mdpLien').addEventListener('click', (ev) => {
    ev.preventDefault();
    const f = document.getElementById('mdpForm');
    f.hidden = !f.hidden;
    if (!f.hidden) { const m = document.getElementById('mail'); if (m && !m.value) m.focus(); else { const p = document.getElementById('pw'); if (p) p.focus(); } }
  });
  const err = document.getElementById('authErr');
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
    } catch (_) { try { chrome.tabs.create({ url: cible }); } catch (_) {} window.close(); }
  };
  try { chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => aller(tabs && tabs[0] && tabs[0].url)); }
  catch (_) { aller(''); }
}
// `rester` : après une déconnexion, on montre la connexion au lieu de rouvrir.
function chargerAuth(rester) {
  chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'authEtat' }, (r) => {
    const e = r || {};
    if (e.connecte && !CARTE && !rester) { ouvrirVRM(); return; }
    document.body.classList.remove('decide');
    rendreAuth(e);
  });
}
if (REPARER) reparerSiPerime().then((r) => { try { document.body.setAttribute('data-reparation', r); } catch (_) {} });
else chargerAuth();
