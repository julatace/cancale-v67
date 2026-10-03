// ════════════════════════════════════════════════════════════════════════════
//  LA PETITE CARTE VRM, EN BAS À DROITE — sur Vinted, Leboncoin, eBay et
//  Vestiaire Collective. Une seule, la même partout.
//
//  Julien, 2 octobre : « un tout petit écran en bas à droite où tu te connectes
//  à l'application VRM avec les identifiants, et après l'extension s'occupe de
//  tout le reste ; dès que tu appuies dessus, le site VRM s'ouvre. Il ne doit
//  pas y avoir d'informations autres que les moyens de connexion, le compte
//  utilisé, le compte connecté, et si les informations circulent bien. »
//  Et : le logo, c'est CELUI de l'app — jamais l'ancien bouton orange.
//
//  ⚠️ Ce que cette carte ne fait PAS, exprès :
//  - aucun formulaire dans la page. Le mot de passe se tape dans un iframe de
//    l'EXTENSION (popup.html?mode=carte) : les scripts du site ne peuvent ni lire
//    le champ ni écouter le clavier. Dans le DOM de vinted.fr, ils le pouvaient.
//  - aucune lecture de données, aucune requête vers le site : l'état vient du
//    service worker (session VRM, cookie du site, ce que les écritures ont noté).
//  - aucune couleur quand tout va bien (§7). L'ambre ne s'allume que s'il y a
//    quelque chose à faire, et « pas su » reste gris — jamais un faux vert.
// ════════════════════════════════════════════════════════════════════════════
(() => {
  if (window.top !== window) return;                 // une seule carte par onglet
  if (document.getElementById('vrm-badge')) return;  // déjà posée (SPA, double injection)
  const vivant = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; } };
  if (!vivant()) return;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const depuis = (t) => {
    const ms = Date.now() - Number(t || 0);
    if (!t || !isFinite(ms) || ms < 0) return '';
    const min = Math.round(ms / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    const h = Math.round(min / 60);
    if (h < 48) return `il y a ${h} h`;
    return `il y a ${Math.round(h / 24)} j`;
  };
  const NOM_SITE = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire Collective' };

  const hote = document.createElement('div');
  hote.id = 'vrm-badge';
  hote.style.cssText = 'all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483646;';
  const ombre = hote.attachShadow({ mode: 'closed' });
  ombre.innerHTML = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif; }
  .btn { position: relative; width: 44px; height: 44px; padding: 0; border: 1px solid rgba(61,123,255,.38); border-radius: 12px;
    background: #07090D; cursor: pointer; display: block;
    box-shadow: 0 1px 2px rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.28); transition: transform .12s ease, box-shadow .12s ease; }
  .btn:hover { transform: translateY(-1px); box-shadow: 0 1px 2px rgba(0,0,0,.35), 0 12px 30px rgba(0,0,0,.34); }
  .btn img { width: 100%; height: 100%; border-radius: 11px; display: block; }
  .btn .txt { color: #E8ECF2; font-weight: 800; font-size: 12px; letter-spacing: .04em; line-height: 42px; text-align: center; display: block; }
  .pt { position: absolute; top: -3px; right: -3px; width: 11px; height: 11px; border-radius: 999px; background: #F5A524; border: 2px solid #07090D; display: none; }
  .pt.on { display: block; }
  .carte { position: absolute; right: 0; bottom: 54px; width: 280px; background: #10141B; color: #E8ECF2; border: 1px solid #1E2530;
    border-radius: 12px; padding: 12px 14px; font-size: 12.5px; line-height: 1.45;
    box-shadow: 0 1px 2px rgba(0,0,0,.4), 0 16px 40px rgba(0,0,0,.36); display: none; }
  .carte.on { display: block; }
  .tete { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
  .tete b { font-size: 13px; letter-spacing: .02em; }
  .ver { font-size: 10.5px; color: #6B7485; }
  .ligne { padding: 6px 0; border-top: 1px solid #1A202A; }
  .lib { font-size: 10.5px; color: #8A93A3; text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
  .val { margin-top: 1px; word-break: break-word; }
  .val.alerte { color: #F5A524; }
  .val.gris { color: #8A93A3; }
  .pied { margin-top: 8px; font-size: 11px; color: #8A93A3; }
  .pied b { color: #3D7BFF; font-weight: 600; }
  .connexion { position: absolute; right: 0; bottom: 54px; width: 300px; height: 380px; border: 1px solid #1E2530; border-radius: 12px;
    overflow: hidden; background: #07090D; box-shadow: 0 1px 2px rgba(0,0,0,.4), 0 16px 40px rgba(0,0,0,.36); display: none; }
  .connexion.on { display: block; }
  .connexion iframe { width: 100%; height: 100%; border: 0; display: block; background: #07090D; }
  .fermer { position: absolute; top: 6px; right: 8px; width: 24px; height: 24px; border: 0; border-radius: 6px; background: transparent;
    color: #8A93A3; font-size: 16px; cursor: pointer; line-height: 24px; padding: 0; }
  .fermer:hover { background: #1A202A; color: #E8ECF2; }
</style>
<div class="carte" part="carte"></div>
<div class="connexion"><button class="fermer" title="Fermer" aria-label="Fermer">×</button></div>
<button class="btn" title="VRM" aria-label="VRM"><span class="pt"></span></button>`;

  const btn = ombre.querySelector('.btn');
  const pt = ombre.querySelector('.pt');
  const carte = ombre.querySelector('.carte');
  const connexion = ombre.querySelector('.connexion');

  // Le logo de l'app (le même qu'en haut de chaque écran de VRM). S'il ne
  // charge pas : « VRM » en texte, jamais une image cassée.
  const img = document.createElement('img');
  img.alt = 'VRM';
  img.addEventListener('error', () => { img.remove(); const t = document.createElement('span'); t.className = 'txt'; t.textContent = 'VRM'; btn.appendChild(t); });
  try { img.src = chrome.runtime.getURL('logo-vrm-96.png'); } catch (_) {}
  btn.appendChild(img);

  let etat = null;      // null = pas encore su
  let pasSu = false;    // le service worker n'a pas répondu

  const demander = () => new Promise((res) => {
    if (!vivant()) { res(undefined); return; }
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'etat' }, (r) => {
        void (chrome.runtime && chrome.runtime.lastError);
        res(r && r.ok ? r : null);
      });
    } catch (_) { res(null); }
  });

  // Ce qui demande un geste (et seulement ça) allume l'ambre.
  const aFaire = (e) => {
    if (!e) return false;
    const v = e.vrm;
    if (v && v.connecte === false) return true;                               // pas connecté, ou session expirée
    if (e.bascule) return true;                                               // une autre session VRM a été adoptée
    const f = e.flux;
    if (f && f.koAt && (!f.okAt || f.koAt > f.okAt)) return true;            // dernier envoi refusé
    return false;
  };

  function rendre() {
    const e = etat;
    pt.classList.toggle('on', aFaire(e));
    if (!e) {
      carte.innerHTML = `<div class="tete"><b>VRM</b></div>
        <div class="ligne"><div class="val gris">${pasSu ? "L'extension ne répond pas pour l'instant — recharge la page." : 'Vérification…'}</div></div>`;
      return;
    }
    const v = e.vrm;
    let compteVrm;
    if (!v) compteVrm = '<div class="val gris">pas su pour l\'instant</div>';
    else if (v.connecte) compteVrm = `<div class="val">${esc(v.email || 'connecté')}</div>`;
    else if (v.expiree) compteVrm = `<div class="val alerte">Session expirée${v.email ? ' (' + esc(v.email) + ')' : ''} — clique pour te reconnecter</div>`;
    else compteVrm = '<div class="val alerte">Pas connecté — clique pour te connecter</div>';

    const nomSite = NOM_SITE[e.plateforme] || 'ce site';
    let compteSite;
    if (!e.capte) compteSite = `<div class="val gris">VRM ne capte pas encore ${esc(nomSite)}.</div>`;
    else if (e.site && e.site.nom) compteSite = `<div class="val">${esc(e.site.nom)}${e.site.type === 'pro' ? ' · pro' : ''}</div>`;
    else if (e.site && e.site.id) compteSite = `<div class="val">compte n° ${esc(e.site.id)}</div>`;
    else if (e.plateforme === 'vinted') compteSite = '<div class="val gris">aucun compte Vinted connecté dans ce navigateur</div>';
    else compteSite = '<div class="val gris">pas encore reconnu</div>';

    let flux = '';
    if (e.capte) {
      const f = e.flux || {};
      if (f.koAt && (!f.okAt || f.koAt > f.okAt)) {
        const raison = v && v.connecte === false ? ' — connecte-toi à VRM pour que ça reparte' : ' — la base n\'a pas accepté l\'envoi, ça réessaie tout seul';
        flux = `<div class="val alerte">Dernier envoi refusé ${esc(depuis(f.koAt))}${esc(raison)}</div>`;
      } else if (f.okAt) flux = `<div class="val">Envoyées à VRM ${esc(depuis(f.okAt))}</div>`;
      else flux = '<div class="val gris">Rien envoyé depuis ce navigateur pour l\'instant</div>';
    }

    let bascule = '';
    if (e.bascule) {
      const b = e.bascule;
      const quand = (() => { try { return new Date(b.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } })();
      bascule = `<div class="ligne"><div class="lib">Attention</div><div class="val alerte">Le ${esc(quand)}, ce Chrome est passé du compte VRM ${esc(b.de || '?')} à ${esc(b.vers || '?')}. Les captures suivent le compte connecté : si ce n'est pas le tien, reconnecte-toi avec le bon.</div></div>`;
    }

    const pied = v && v.connecte ? 'Clique sur le logo pour <b>ouvrir VRM</b>.' : 'Clique sur le logo pour <b>te connecter</b>.';
    carte.innerHTML = `<div class="tete"><b>VRM</b><span class="ver">${e.version ? 'extension ' + esc(e.version) : ''}</span></div>
      <div class="ligne"><div class="lib">Compte VRM utilisé</div>${compteVrm}</div>
      <div class="ligne"><div class="lib">Compte ${esc(nomSite)}</div>${compteSite}</div>
      ${e.capte ? `<div class="ligne"><div class="lib">Tes données</div>${flux}</div>` : ''}
      ${bascule}
      <div class="pied">${pied}</div>`;
  }

  async function rafraichir() {
    if (!vivant()) { hote.remove(); return; }          // extension rechargée : cette carte est orpheline
    const r = await demander();
    if (r === undefined) { hote.remove(); return; }
    pasSu = r === null;
    if (r) etat = r;
    rendre();
    if (etat && etat.vrm && etat.vrm.connecte) fermerConnexion();
  }

  // ── La connexion : un iframe de l'EXTENSION, jamais un champ dans la page ──
  let iframe = null;
  function ouvrirConnexion() {
    carte.classList.remove('on');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.title = 'Connexion à VRM';
      try { iframe.src = chrome.runtime.getURL('popup.html') + '?mode=carte'; } catch (_) { return; }
      connexion.appendChild(iframe);
    }
    connexion.classList.add('on');
  }
  function fermerConnexion() {
    connexion.classList.remove('on');
    if (iframe) { iframe.remove(); iframe = null; }
  }
  ombre.querySelector('.fermer').addEventListener('click', fermerConnexion);

  btn.addEventListener('click', async () => {
    if (connexion.classList.contains('on')) { fermerConnexion(); return; }
    await rafraichir();
    const v = etat && etat.vrm;
    if (v && v.connecte) {
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'ouvrirVRM' }, () => { void chrome.runtime.lastError; }); } catch (_) {}
      return;
    }
    // Pas connecté, session expirée — ou pas su : on propose la connexion
    // sans insister (pas d'ambre tant qu'on ne sait pas).
    ouvrirConnexion();
  });

  // La carte d'état au survol ; elle se ferme quand on s'en va.
  let minuteur = null;
  hote.addEventListener('mouseenter', () => {
    if (connexion.classList.contains('on')) return;
    clearTimeout(minuteur);
    rafraichir();
    carte.classList.add('on');
  });
  hote.addEventListener('mouseleave', () => { clearTimeout(minuteur); minuteur = setTimeout(() => carte.classList.remove('on'), 180); });

  // Une connexion réussie, un envoi noté, une bascule : la carte suit, sans
  // interroger qui que ce soit en boucle.
  try {
    chrome.storage.onChanged.addListener((ch, zone) => {
      if (zone !== 'local') return;
      if (ch.vrmSession || ch.vrmFlux || ch.vrmBascule || ch.vrmLbcCompte) rafraichir();
    });
  } catch (_) {}
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') rafraichir(); });

  (document.documentElement || document.body).appendChild(hote);
  rafraichir();
})();
