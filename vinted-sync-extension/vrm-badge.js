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
  // 5.188 : le HTML de nos propres gabarits (valeurs passées par `esc`) est posé
  // par DOMParser plutôt que `innerHTML =` — même résultat, et c'est la forme que
  // les boutiques (Firefox, Edge) relisent sans avertissement.
  const poserHtml = (el, html) => { const d = new DOMParser().parseFromString('<body>' + String(html) + '</body>', 'text/html'); el.replaceChildren(...Array.from(d.body.childNodes)); };

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
  /* « VRM Noir » (§7) : UN seul accent bleu, rare ; le clair et le sombre
     suivent le système ; rayons 5 / 8 / 10 / 12 ; une seule forme de bouton. */
  :host { all: initial;
    --fond: #07090D; --carte: #10141B; --bord: #1E2530; --filet: #1A202A; --texte: #E8ECF2; --doux: #8A93A3; --pale: #6B7485;
    --accent: #3D7BFF; --ambre: #F5A524; --survol: #1A202A;
    --ombre: 0 1px 2px rgba(0,0,0,.4), 0 16px 40px rgba(0,0,0,.36); }
  @media (prefers-color-scheme: light) {
    :host { --carte: #FFFFFF; --bord: #DCE1EA; --filet: #E8ECF2; --texte: #10151B; --doux: #5B6577; --pale: #7A8494;
      --accent: #2458E6; --ambre: #A15C00; --survol: #EEF1F6;
      --ombre: 0 1px 2px rgba(16,21,27,.08), 0 16px 40px rgba(16,21,27,.14); }
  }
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif; }
  .btn { position: relative; width: 44px; height: 44px; padding: 0; border: 1px solid rgba(61,123,255,.38); border-radius: 12px;
    background: #07090D; cursor: pointer; display: block;
    box-shadow: 0 1px 2px rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.28); transition: transform .12s ease, box-shadow .12s ease; }
  .btn:hover { transform: translateY(-1px); box-shadow: 0 1px 2px rgba(0,0,0,.35), 0 12px 30px rgba(0,0,0,.34); }
  .btn:focus-visible, .b:focus-visible, .fermer:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .btn img { width: 100%; height: 100%; border-radius: 10px; display: block; }
  .btn .txt { color: #E8ECF2; font-weight: 800; font-size: 12px; letter-spacing: .04em; line-height: 42px; text-align: center; display: block; }
  .pt { position: absolute; top: -3px; right: -3px; width: 11px; height: 11px; border-radius: 999px; background: var(--ambre); border: 2px solid #07090D; display: none; }
  .pt.on { display: block; }
  .carte, .question { position: absolute; right: 0; bottom: 54px; width: min(300px, calc(100vw - 32px)); max-height: calc(100vh - 90px); overflow-y: auto; background: var(--carte); color: var(--texte); border: 1px solid var(--bord);
    border-radius: 12px; padding: 12px 14px; font-size: 13px; line-height: 1.45; box-shadow: var(--ombre); display: none; }
  .carte.on, .question.on { display: block; }
  .tete { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
  .tete b { font-size: 14px; font-weight: 700; letter-spacing: -.01em; }
  .ver { font-size: 11px; color: var(--pale); }
  .ligne { padding: 8px 0; border-top: 1px solid var(--filet); }
  .lib { font-size: 11px; color: var(--doux); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
  .val { margin-top: 2px; word-break: break-word; }
  .val.alerte { color: var(--ambre); }
  .val.gris { color: var(--doux); }
  .pied { margin-top: 8px; font-size: 12px; color: var(--doux); }
  .pied b { color: var(--texte); font-weight: 600; }
  .b { display: block; width: 100%; min-height: 44px; margin-top: 8px; padding: 0 14px; border: 1px solid transparent; border-radius: 8px;
    background: var(--accent); color: #fff; font-size: 13px; font-weight: 600; line-height: 1.2; cursor: pointer; text-align: center; }
  .b.sec { background: transparent; color: var(--texte); border-color: var(--bord); }
  .b.sec:hover { background: var(--survol); }
  .b:disabled { opacity: .6; cursor: default; }
  .q { font-size: 14px; font-weight: 600; margin: 2px 0 4px; }
  .q b { font-weight: 700; }
  .err { margin-top: 8px; font-size: 12px; color: var(--ambre); }
  .connexion { position: absolute; right: 0; bottom: 54px; width: min(300px, calc(100vw - 32px)); height: min(400px, calc(100vh - 90px)); border: 1px solid var(--bord); border-radius: 12px;
    overflow: hidden; background: var(--fond); box-shadow: var(--ombre); display: none; }
  @media (prefers-color-scheme: light) { .connexion { background: #F4F6FA; } }
  .connexion.on { display: block; }
  .connexion iframe { width: 100%; height: 100%; border: 0; display: block; background: transparent; }
  .fermer { position: absolute; top: 2px; right: 2px; width: 44px; height: 44px; border: 0; border-radius: 8px; background: transparent;
    color: var(--doux); font-size: 18px; cursor: pointer; line-height: 44px; padding: 0; }
  .fermer:hover { background: var(--survol); color: var(--texte); }
  .question .fermer, .carte .fermer { top: 4px; right: 4px; }
  .carte.doigt .tete { padding-right: 44px; }
  /* 19 octobre : au doigt (Firefox pour Android, Orion) — pas de survol, pas
     de surlignage gris du navigateur, et aucun double-tap qui zoome. */
  .btn, .b, .fermer { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
</style>
<div class="carte" part="carte"></div>
<div class="question" role="dialog" aria-label="Confirmer le compte Vinted"></div>
<div class="connexion"><button class="fermer" title="Fermer" aria-label="Fermer">×</button></div>
<button class="btn" title="VRM" aria-label="VRM"><span class="pt"></span></button>`;

  const btn = ombre.querySelector('.btn');
  const pt = ombre.querySelector('.pt');
  const carte = ombre.querySelector('.carte');
  const connexion = ombre.querySelector('.connexion');
  const question = ombre.querySelector('.question');

  // Le logo de l'app (le même qu'en haut de chaque écran de VRM). S'il ne
  // charge pas : « VRM » en texte, jamais une image cassée.
  const img = document.createElement('img');
  img.alt = 'VRM';
  img.addEventListener('error', () => { img.remove(); const t = document.createElement('span'); t.className = 'txt'; t.textContent = 'VRM'; btn.appendChild(t); });
  try { img.src = chrome.runtime.getURL('logo-vrm-96.png'); } catch (_) {}
  btn.appendChild(img);

  // ══ AU DOIGT (19 octobre, « l'extension pour iPhone et Samsung ») ═════════
  // Sur un téléphone il n'y a pas de SURVOL : la carte d'état (et le « Capter
  // ce compte » qui permet de revenir sur un « Non ») n'était joignable qu'à la
  // souris. On mesure l'ENTRÉE du geste (`pointerType`), jamais « c'est un
  // téléphone » : au doigt, toucher le logo OUVRE la carte, qui porte le geste
  // du logo dans un bouton (« Ouvrir VRM » / « Se connecter avec VRM »).
  let dernierPointeur = '';
  let doigt = false;    // la carte est ouverte au doigt : elle porte son bouton et sa croix
  const sansSurvol = () => { try { return matchMedia('(hover: none)').matches; } catch (_) { return false; } };
  const auDoigt = () => (dernierPointeur ? dernierPointeur !== 'mouse' : sansSurvol());

  let etat = null;      // null = pas encore su
  let pasSu = false;    // le service worker n'a pas répondu
  let perime = false;   // le code qui répond n'est pas celui du manifeste

  // ══ LE CODE PÉRIMÉ (11 octobre) ══════════════════════════════════════════
  // ⚠️⚠️ MESURÉ : sous un manifeste neuf, le service worker exécutait encore
  //    l'ancien code (⟳ jamais cliqué dans ce Chrome). Le logo disait alors
  //    « L'extension ne répond pas — recharge la page » : recharger ne change
  //    RIEN. Ce script, lui, est lu depuis le disque : il sait quelle version le
  //    manifeste annonce, et il compare avec le `code` que l'état renvoie
  //    (depuis la 5.171). Périmé ⇒ on pose UNE fois la page de réparation
  //    (`popup.html?mode=reparer`, qui vérifie elle-même avant de recharger), et
  //    on dit le geste exact s'il faut le faire à la main.
  const versionManif = (() => { try { return String(chrome.runtime.getManifest().version || ''); } catch (_) { return ''; } })();
  const vNum = (v) => String(v || '').split('.').map((x) => parseInt(x, 10) || 0);
  const auMoins = (v, ref) => { const a = vNum(v), b = vNum(ref); for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); } return true; };
  const jugeable = /^\d+\.\d+\.\d+$/.test(versionManif) && auMoins(versionManif, '5.171.0');
  let reparationPosee = false;
  function reparer() {
    if (reparationPosee) return;
    reparationPosee = true;
    try {
      const f = document.createElement('iframe');
      f.src = chrome.runtime.getURL('popup.html') + '?mode=reparer';
      f.setAttribute('aria-hidden', 'true');
      f.tabIndex = -1;
      f.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;top:-10px;border:0;opacity:0;pointer-events:none;';
      (document.body || document.documentElement).appendChild(f);
      setTimeout(() => { try { f.remove(); } catch (_) {} }, 15000);
    } catch (_) {}
  }

  const demander = () => new Promise((res) => {
    if (!vivant()) { res(undefined); return; }
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'etat' }, (r) => {
        let err = null; try { err = chrome.runtime && chrome.runtime.lastError; } catch (_) {}
        // ≤ 5.129 : ce service worker ne connaît pas la carte — le port se ferme.
        if (err && jugeable && /port closed/i.test(String(err.message || err))) { perime = true; reparer(); res(null); return; }
        if (r && r.ok && jugeable && String(r.code || '') !== versionManif) { perime = true; reparer(); }
        else if (r && r.ok) perime = false;
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
    if (e.site && e.site.choix === 'non' && e.plateforme === 'vinted') return false;   // un CHOIX n'est pas une panne
    const f = e.flux;
    if (f && f.koAt && (!f.okAt || f.koAt > f.okAt)) return true;            // dernier envoi refusé
    return false;
  };

  // POURQUOI un envoi a été refusé, d'après le CODE HTTP que la base a renvoyé
  // (`f.koStatut`, mesuré au point d'écriture depuis la 5.189). Un 4xx est un
  // refus DURABLE : recharger ou attendre ne change RIEN, donc on ne promet pas
  // « ça réessaie tout seul » (le défaut le plus coûteux du projet) — on dit le
  // geste. Seuls un 5xx / une coupure réseau gardent « ça réessaie ». Une
  // extension < 5.189 n'a pas `koStatut` : on retombe sur le message d'attente,
  // comme avant.
  function raisonRefus(f, v) {
    if (v && v.connecte === false) return ' — connecte-toi à VRM pour que ça reparte';
    const st = String((f && f.koStatut) || '');
    // 5.193 : rien n'est parti, faute de session VRM vivante (morte ou en pause
    // de renouvellement) — ce n'est ni une panne ni un refus de la base.
    if (st === 'sans_session') return ' — ta session VRM n’a pas pu être renouvelée : rien ne part en attendant. Si ça dure, clique le logo pour te reconnecter.';
    if (st === '403') return ' — ta base VRM refuse ce compte. Vérifie que ton abonnement VRM est actif, et que tu es connecté avec ton compte principal (celui qui ne paie pas). Rien ne partira tant que ce n’est pas réglé.';
    if (st === '401') return ' — la base a refusé ta session. Reconnecte-toi à VRM (clique le logo). Ça ne repartira pas tout seul.';
    if (st === '400') return ' — la base n’est pas dans l’état attendu. Rien ne part ; préviens le support VRM.';
    if (/^4\d\d$/.test(st)) return ` — la base a refusé l’envoi (code ${st}). Reconnecte-toi à VRM ; si ça persiste, préviens le support.`;
    return ' — la base n’a pas répondu, ça réessaie tout seul';
  }

  function rendre() {
    rendreCarte();
    rendreQuestion();
  }
  function rendreCarte() {
    const e = etat;
    pt.classList.toggle('on', aFaire(e) || perime);
    // Le code qui tourne n'est pas celui du manifeste : recharger la PAGE ne
    // change rien, c'est l'extension qu'il faut recharger (⟳) — et on le fait
    // nous-mêmes (page de réparation) ; le geste manuel n'est dit qu'en secours.
    // Firefox (5.188) n'a ni chrome://extensions ni ⟳ : on y désactive puis
    // réactive l'extension dans about:addons.
    const FIREFOX = (() => { try { return typeof browser !== 'undefined' && !!browser.runtime; } catch (_) { return false; } })();
    const SI_MUETTE = FIREFOX
      ? "L'extension ne répond pas pour l'instant. Si ça dure, ouvre about:addons, désactive puis réactive VRM (dans ce Firefox)."
      : "L'extension ne répond pas pour l'instant. Si ça dure, ouvre chrome://extensions et clique ⟳ sur VRM (dans ce navigateur).";
    const lignePerime = perime
      ? `<div class="ligne"><div class="lib">Extension</div><div class="val alerte">Elle tourne encore sur son ancienne version${e && e.code ? ' (' + esc(e.code) + ')' : ''} : je la redémarre sur la ${esc(versionManif)}. Si ce message reste, ouvre chrome://extensions et clique ⟳ sur VRM — dans ce Chrome.</div></div>`
      : '';
    if (!e) {
      carte.classList.toggle('doigt', doigt);
      poserHtml(carte, `${doigt ? '<button class="fermer" data-fermer-carte title="Fermer" aria-label="Fermer">×</button>' : ''}<div class="tete"><b>VRM</b></div>
        ${lignePerime || `<div class="ligne"><div class="val gris">${pasSu ? SI_MUETTE : 'Vérification…'}</div></div>`}`);
      const fermerV = carte.querySelector('[data-fermer-carte]');
      if (fermerV) fermerV.addEventListener('click', () => { doigt = false; carte.classList.remove('on'); });
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
    if (!e.capte && !e.mesure) compteSite = `<div class="val gris">VRM ne capte pas encore ${esc(nomSite)}.</div>`;
    else if (!e.capte) compteSite = '<div class="val gris">pas encore reconnu</div>';
    else if (e.site && e.site.nom && e.site.choix === 'non') compteSite = `<div class="val gris" data-compte-ignore>${esc(e.site.nom)} — ignoré dans ce navigateur (ton choix) : rien n'est capté pour lui.</div><button class="b sec" data-capter>Capter ce compte</button>`;
    else if (e.site && e.site.nom) compteSite = `<div class="val">${esc(e.site.nom)}${e.site.type === 'pro' ? ' · pro' : ''}</div>`;
    else if (e.site && e.site.id) compteSite = e.plateforme==='leboncoin' ? '<div class="val">Identifiant détecté · identité à confirmer</div>' : `<div class="val">compte n° ${esc(e.site.id)}</div>`;
    else if (e.plateforme === 'vestiaire') compteSite = (e.vcCapte && Object.keys(e.vcCapte).length)
      ? '<div class="val">connecté — VRM lit ton compte en passant</div>'
      : '<div class="val gris">pas encore lu — ouvre « Mon compte » sur Vestiaire (ventes, articles, messages)</div>';
    else if (e.plateforme === 'vinted') compteSite = '<div class="val gris">aucun compte Vinted connecté dans ce navigateur</div>';
    else compteSite = '<div class="val gris">pas encore reconnu</div>';

    let flux = '';
    const ignore = !!(e.site && e.site.choix === 'non' && e.plateforme === 'vinted');
    if (e.capte && ignore) flux = '<div class="val gris">Rien n’est capté pour ce compte — ton choix.</div>';
    else if (e.capte) {
      const f = e.flux || {};
      if (f.koAt && (!f.okAt || f.koAt > f.okAt)) {
        flux = `<div class="val alerte">Dernier envoi refusé ${esc(depuis(f.koAt))}${esc(raisonRefus(f, v))}</div>`;
      } else if (f.okAt) flux = e.plateforme === 'leboncoin' ? `<div class="val">Dernier échange enregistré ${esc(depuis(f.okAt))}</div><div class="val gris">Cet échange ne confirme pas la récupération des annonces et des photos.</div>` : `<div class="val">Envoyées à VRM ${esc(depuis(f.okAt))}</div>`;
      else flux = '<div class="val gris">Rien envoyé depuis ce navigateur pour l\'instant</div>';
    }

    // 5.243 : sur Vestiaire, ce qui est capté, famille par famille.
    if (e.plateforme === 'vestiaire' && e.vcCapte) {
      const noms = { ventes: 'Ventes', annonces: 'Annonces', messages: 'Messages', achats: 'Achats' };
      const lignes = Object.keys(noms).filter((k) => e.vcCapte[k]).map((k) => `<div class="val">${noms[k]} : lues ${esc(depuis(e.vcCapte[k].at))}</div>`);
      if (lignes.length) flux = lignes.join('') + flux.replace(/<div class="val gris">Rien envoyé[^<]*<\/div>/, '');
    }
    if(e.plateforme==='leboncoin'){
      const labels={annonces:'Annonces',transactions:'Transactions'};
      for(const famille of ['annonces','transactions']){
        const r=e.transport?.receptions?.[famille];
        if(!r){flux+=`<div class="val gris">${labels[famille]} : nouvelle intégration non confirmée dans cet onglet</div>`;continue;}
        const bon=r.etat==='enregistre';
        const texte=r.etat==='liste-vide'?'liste reçue vide, historique conservé':r.etat==='compte-non-confirme'?'compte non confirmé, aucune attribution faite':bon?`${r.nombre} ${r.nombre===1?'enregistrée':'enregistrées'}${famille==='annonces'?` · ${r.photos} avec photo`:''} ${depuis(r.at)}`:r.etat==='aucune-annonce-reconnue'||r.etat==='format-non-reconnu'?'réponse reçue, format non reconnu':r.etat==='partiel'?'réponse trop volumineuse, non intégrée':'enregistrement refusé, données précédentes conservées';
        flux+=`<div class="val ${bon?'':'alerte'}">${labels[famille]} : ${esc(texte)}</div>`;
      }
    }
    const diagnosticLbc=e.plateforme==='leboncoin'&&(e.transport?.erreurCapture||!e.site?.id||e.transport?.capteurVersion!==e.code)?`<div class="pied">${e.transport?.capteur===true&&e.transport?.capteurVersion!==e.code?'Le capteur de cet onglet n’a pas confirmé la dernière version. Recharge cet onglet Leboncoin après la mise à jour.':e.transport?.erreurCapture==='identite'?'VRM n’a pas confirmé l’enregistrement du compte. Les annonces restent bloquées pour éviter une mauvaise attribution.':e.transport?.erreurCapture==='taille'?'La capture dépasse la taille autorisée. Aucun gros message n’a été envoyé.':e.transport?.ambigue===true?'Plusieurs comptes ont répondu dans cet onglet. Aucune session courante n’est choisie. Recharge Leboncoin sur le compte voulu.':e.transport?.capteur===true?'Capteur actif. Ouvre ton espace compte Leboncoin, puis « Mes annonces », pour lire ton identité et tes annonces.':e.transport?'Le relais fonctionne, mais le capteur de la page ne répond pas. Recharge Leboncoin et vérifie les autorisations de l’extension sur ce site.':'Aucune réponse du capteur sur cet onglet. Recharge la page après la mise à jour de l’extension.'}</div>`:'';
    let bascule = '';
    if (e.bascule) {
      const b = e.bascule;
      const quand = (() => { try { return new Date(b.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } })();
      bascule = `<div class="ligne"><div class="lib">Attention</div><div class="val alerte">Le ${esc(quand)}, ce Chrome est passé du compte VRM ${esc(b.de || '?')} à ${esc(b.vers || '?')}. Les captures suivent le compte connecté : si ce n'est pas le tien, reconnecte-toi avec le bon.</div></div>`;
    }

    const pied = doigt
      ? (v && v.connecte ? '' : '<b>VRM s’ouvre et connecte l’extension</b> — rien à taper ici.')
      : v && v.connecte ? 'Clique sur le logo pour <b>ouvrir VRM</b>.' : 'Clique sur le logo : <b>VRM s’ouvre et connecte l’extension</b> — rien à taper ici.';
    // Julien, 27 oct. : « je veux pouvoir me connecter à mon compte VRM depuis
    // Vestiaire et Leboncoin aussi ». Les gestes sont dans la carte sur TOUS
    // les sites et à la souris comme au doigt ; « Changer de compte VRM » ouvre
    // VRM, qui relie l'extension au compte connecté DANS l'app (la session est
    // celle du navigateur : elle vaut pour Vinted, Leboncoin et Vestiaire).
    const gesteDoigt = v && v.connecte
      ? `<div class="gestes">${doigt ? '<button class="b" data-ouvrir-vrm>Ouvrir VRM</button>' : ''}<button class="b sec" data-changer-vrm>Changer de compte VRM</button></div>`
      : `<button class="b" data-ouvrir-vrm>Se connecter avec VRM</button>`;
    carte.classList.toggle('doigt', doigt);
    poserHtml(carte, `${doigt ? '<button class="fermer" data-fermer-carte title="Fermer" aria-label="Fermer">×</button>' : ''}<div class="tete"><b>VRM</b><span class="ver">${e.version ? 'extension ' + esc(e.version) : ''}</span></div>
      ${lignePerime}
      <div class="ligne"><div class="lib">Compte VRM utilisé</div>${compteVrm}</div>
      <div class="ligne"><div class="lib">Compte ${esc(nomSite)}</div>${compteSite}</div>
      ${e.capte ? `<div class="ligne"><div class="lib">Tes données</div>${flux}</div>` : ''}
      ${e.mesure ? `<div class="ligne"><div class="lib">Mesure</div><div class="val gris">VRM apprend à lire ${esc(nomSite)} : il relève la forme des pages, jamais leur contenu. Aucune vente ni annonce n'est encore captée.</div>${(() => { const f = e.flux || {}; return f.koAt && (!f.okAt || f.koAt > f.okAt) ? `<div class="val alerte">Dernier relevé refusé ${esc(depuis(f.koAt))}</div>` : f.okAt ? `<div class="val gris">Relevé envoyé ${esc(depuis(f.okAt))}</div>` : ''; })()}</div>` : ''}
      ${diagnosticLbc}
      ${bascule}
      ${pied ? `<div class="pied">${pied}</div>` : ''}
      ${gesteDoigt}`);
    const changer = carte.querySelector('[data-changer-vrm]');
    if (changer) changer.addEventListener('click', () => { carte.classList.remove('on'); lierVRM(); });
    const ouvrir = carte.querySelector('[data-ouvrir-vrm]');
    if (ouvrir) ouvrir.addEventListener('click', () => { carte.classList.remove('on'); actionLogo(); });
    const fermerC = carte.querySelector('[data-fermer-carte]');
    if (fermerC) fermerC.addEventListener('click', () => { doigt = false; carte.classList.remove('on'); });
    const capter = carte.querySelector('[data-capter]');
    if (capter) capter.addEventListener('click', () => { capter.disabled = true; envoyerChoix('oui'); });
  }

  // ══ CONFIRMER LE BON COMPTE VINTED (5.191, 19 octobre) ═══════════════════
  // Julien : « à l'installation de l'extension, confirmer le bon compte
  // Vinted ». Une fois par compte : seulement sur Vinted, seulement si on sait
  // NOMMER le compte (jamais « compte n° … » ni un login deviné), et seulement
  // tant qu'il n'a pas répondu dans ce Chrome. Pas répondu ⇒ la capture
  // continue comme avant : la question ne coupe rien.
  let questionFermee = '';   // « Plus tard » : plus de question sur cette page pour ce compte
  let questionErreur = '';
  const aDemander = (e) => !!(e && e.plateforme === 'vinted' && e.capte && e.site && e.site.id && e.site.nom
    && !e.site.choix && questionFermee !== String(e.site.id) && !(e.vrm && e.vrm.connecte === false));
  function envoyerChoix(choix) {
    const s = etat && etat.site;
    if (!s || !s.id) return;
    questionErreur = '';
    ombre.querySelectorAll('[data-choix]').forEach((b) => { b.disabled = true; });
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'choixCompte', uid: String(s.id), choix }, (r) => {
        let err = null; try { err = chrome.runtime.lastError; } catch (_) {}
        if (!err && r && r.ok) { s.choix = choix; questionErreur = ''; }
        else questionErreur = r && r.raison === 'compte'
          ? "Le compte Vinted ouvert a changé entre-temps — rien n'est noté. Recharge la page."
          : "Je n'ai pas pu le noter — rien n'a changé. Réessaie dans un moment.";
        rendre();
      });
    } catch (_) { questionErreur = "Je n'ai pas pu le noter — rien n'a changé."; rendre(); }
  }
  function rendreQuestion() {
    const e = etat;
    const montrer = aDemander(e);
    question.classList.toggle('on', montrer);
    if (!montrer) { if (question.childNodes.length) question.replaceChildren(); return; }
    const nom = e.site.nom;
    poserHtml(question, `<button class="fermer" data-plus-tard title="Plus tard" aria-label="Plus tard">×</button>
      <div class="tete"><b>VRM</b></div>
      <div class="q" data-question-login="${esc(nom)}">Tu es connecté sur <b>${esc(nom)}</b> — c'est bien un de tes comptes à capter ?</div>
      <div class="val gris">Oui : VRM range ses ventes, ses annonces et ses messages. Non : l'extension l'ignore dans ce navigateur (tu pourras revenir dessus depuis le logo VRM, en le touchant ou en passant la souris dessus).</div>
      <button class="b" data-choix="oui">Oui, capter ce compte</button>
      <button class="b sec" data-choix="non">Non, ignorer ce compte</button>
      ${questionErreur ? `<div class="err">${esc(questionErreur)}</div>` : ''}`);
    question.querySelector('[data-choix="oui"]').addEventListener('click', () => envoyerChoix('oui'));
    question.querySelector('[data-choix="non"]').addEventListener('click', () => envoyerChoix('non'));
    question.querySelector('[data-plus-tard]').addEventListener('click', () => { questionFermee = String(e.site.id); rendre(); });
    carte.classList.remove('on');
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
    // Au doigt : toucher le logo ouvre (ou referme) la carte — c'est elle qui
    // porte le geste « Ouvrir VRM », et le moyen de revenir sur un « Non ».
    if (auDoigt()) {
      if (carte.classList.contains('on')) { doigt = false; carte.classList.remove('on'); return; }
      doigt = true;
      if (question.classList.contains('on')) return;     // la question a déjà ses boutons
      carte.classList.add('on');
      await rafraichir();
      return;
    }
    await actionLogo();
  });
  async function actionLogo() {
    await rafraichir();
    const v = etat && etat.vrm;
    if (v && v.connecte) {
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'ouvrirVRM' }, () => { void chrome.runtime.lastError; }); } catch (_) {}
      return;
    }
    // ⚠️ 11 octobre (Julien : « quand j'appuie sur se connecter ça doit envoyer
    //    directement dans l'application VRM ») : le logo OUVRE VRM à chaque
    //    fois. Pas connecté, session expirée ou pas su : VRM s'ouvre avec
    //    l'identifiant de CETTE extension, et l'app (connectée, ou après sa
    //    connexion) lui adresse sa session. La carte de mot de passe ne revient
    //    qu'en secours, si le service worker ne sait pas faire la liaison
    //    (code périmé : il ne connaît pas ce message).
    lierVRM();
  }
  function lierVRM() {
    let repondu = false;
    const secours = setTimeout(() => { if (!repondu) ouvrirConnexion(); }, 2500);
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'lierAvecVRM' }, (r) => {
        let err = null; try { err = chrome.runtime.lastError; } catch (_) {}
        repondu = true; clearTimeout(secours);
        if (err || !r || !r.ok) ouvrirConnexion();
      });
    } catch (_) { repondu = true; clearTimeout(secours); ouvrirConnexion(); }
  }

  // Le type d'entrée du DERNIER geste (souris, doigt, stylet) : c'est lui qui
  // décide, pas la taille de l'écran (un portable tactile garde sa souris).
  hote.addEventListener('pointerdown', (e) => { dernierPointeur = String(e.pointerType || ''); }, true);
  // La carte d'état au SURVOL — à la souris seulement : au doigt, un toucher
  // déclenche aussi `pointerenter`, et la carte s'ouvrirait puis se fermerait
  // au même geste.
  let minuteur = null;
  hote.addEventListener('pointerenter', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (connexion.classList.contains('on') || question.classList.contains('on')) return;
    clearTimeout(minuteur);
    doigt = false;
    rafraichir();
    carte.classList.add('on');
  });
  hote.addEventListener('pointerleave', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (doigt) return;
    clearTimeout(minuteur); minuteur = setTimeout(() => carte.classList.remove('on'), 180);
  });
  // Au doigt, toucher ailleurs dans la page referme la carte (sans rien cliquer
  // à sa place : on n'empêche pas le geste du site).
  document.addEventListener('pointerdown', (e) => {
    if (!carte.classList.contains('on')) return;
    let dedans = false; try { dedans = e.composedPath().includes(hote); } catch (_) {}
    if (!dedans) { doigt = false; carte.classList.remove('on'); }
  }, true);

  // Une connexion réussie, un envoi noté, une bascule : la carte suit, sans
  // interroger qui que ce soit en boucle.
  try {
    chrome.storage.onChanged.addListener((ch, zone) => {
      if (zone !== 'local') return;
      if (ch.vrmSession || ch.vrmFlux || ch.vrmVcCapte || ch.vrmBascule || ch.vrmLbcCompte || ch.vrmChoixComptes || ch.vrmLoginsVus || ch.vrmLogins) rafraichir();
    });
  } catch (_) {}
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') rafraichir(); });

  (document.documentElement || document.body).appendChild(hote);
  rafraichir();
})();
