// popup.js — la connexion à VRM, et rien d'autre.
//
// Deux endroits l'affichent, avec LE MÊME code (§11) :
// - l'icône de l'extension dans la barre de Chrome (fenêtre classique) ;
// - la petite carte en bas à droite de Vinted, Leboncoin, eBay… (`?mode=carte`,
//   dans un iframe de l'EXTENSION : le mot de passe ne passe jamais par le DOM
//   du site, que ses scripts peuvent lire).
//
// 2 octobre (Julien) : « tout doit être centralisé dans VRM ». Les sections
// « Comptes captés », « Fraîcheur » et « Synchroniser » sont parties : leur
// place est dans l'app.
const CARTE = /[?&]mode=carte\b/.test(location.search);
if (CARTE) document.body.classList.add('carte');

// Un email est du texte saisi : il n'entre jamais dans du HTML sans être échappé.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
    <div class="muted" style="margin-top:2px">${expiree ? 'Ta session a expiré — retape le mot de passe de ton compte VRM.' : quelCompte}</div>
    <input id="mail" type="email" placeholder="Email de ton compte VRM" autocomplete="username" value="${esc(expiree && e.email ? e.email : '')}">
    <input id="pw" type="password" placeholder="Mot de passe VRM" autocomplete="current-password">
    <button id="inBtn">Se connecter</button>
    <div class="err" id="authErr" hidden></div>
    <div class="muted">Pas encore de compte ? <a href="https://vrm.center" target="_blank" rel="noreferrer">Ouvre vrm.center</a> et crée-le en une minute.</div>`;
  const err = document.getElementById('authErr');
  const go = () => {
    const email = document.getElementById('mail').value, password = document.getElementById('pw').value;
    const btn = document.getElementById('inBtn');
    btn.textContent = 'Connexion…'; btn.disabled = true; err.hidden = true;
    chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'authLogin', email, password }, (r) => {
      btn.textContent = 'Se connecter'; btn.disabled = false;
      if (r && r.ok) ouvrirVRM();
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
chargerAuth();
