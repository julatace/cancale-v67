// (21 nov., 5.410.6) Une vérification n'est VRAIE que si elle est AFFICHÉE : visible, assez grande pour être faite
// (vinted.fr porte en permanence un cadre reCAPTCHA invisible, qui faisait dire « fais la vérification » à tort).
function vrmVerifVisible(sel) {
  try {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 60) continue;
      if (r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) continue;
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.1) continue;
      if (el.closest && el.closest('[data-vrm-hote], #vrm-action-gel')) continue;
      return el;
    }
  } catch (_) {}
  return null;
}
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
//  - aucun onglet, aucune redirection pour se connecter. 5.329 (Julien, 8 nov.,
//    22 h, iPhone Orion : « je veux avoir les outils de connexion directement
//    là, et que ça n'ouvre AUCUN autre onglet ») : la 5.328 posait un iframe de
//    l'extension (popup.html?mode=carte) ; Orion ne l'affichait pas, et au bout
//    de 6 s la carte proposait « Se connecter avec VRM », qui OUVRAIT VRM.
//    Le formulaire (e-mail + mot de passe VRM) est maintenant DESSINÉ ICI, dans
//    la shadow root FERMÉE de la carte : la page ne peut ni lire les champs
//    (`hote.shadowRoot` vaut null pour elle) ni les retrouver dans son DOM ; les
//    événements du clavier et de saisie sont arrêtés à la frontière de la carte
//    (`bouclier`) ; le mot de passe part UNE fois au service worker
//    (`authLogin`), jamais gardé, jamais dans une adresse, jamais `postMessage`.
//    « Se connecter avec VRM » n'existe plus dans la carte.
//    5.330 (Julien : « certains ont créé leur compte avec Google ou Discord » —
//    sans mot de passe) : d'abord « Me connecter avec un code » (un code reçu
//    par e-mail, `authCodeDemande` / `authCodeVerif`, jamais rangé), puis
//    « J'ai un mot de passe », puis Google / Discord — petite fenêtre sur
//    ordinateur, CET onglet sur Orion (il revient sur la page, connecté).
//    Jamais `chrome.tabs.create`, jamais `window.open`.
//  - aucune lecture de données, aucune requête vers le site : l'état vient du
//    service worker (session VRM, cookie du site, ce que les écritures ont noté).
//  - aucune couleur quand tout va bien (§7). L'ambre ne s'allume que s'il y a
//    quelque chose à faire, et « pas su » reste gris — jamais un faux vert.
// ════════════════════════════════════════════════════════════════════════════
(function demarrerBadge() {
  // 5.332 (défaut #6, décision de Julien du 9 nov.) : sur Chrome / Edge /
  // Firefox, le formulaire de connexion vit dans un IFRAME de l'extension
  // (`popup.html?mode=carte`) — l'origine de l'extension, que la page du site ne
  // peut ni lire ni écouter (ses écouteurs de clavier, même posés en capture
  // AVANT nous, n'entendent rien). Cette page-là charge CE fichier en mode
  // « cadre » (`__vrmCadre`, posé par popup.js — une variable que la page d'un
  // site ne peut pas écrire dans le monde de l'extension) : le formulaire seul,
  // sans logo ni état (la carte du site les montre).
  const CADRE = (() => { try { return globalThis.__vrmCadre === true && window.top !== window; } catch (_) { return false; } })();
  const MDP_PERMIS = CADRE;
  // 5.377 : la fenêtre de l'extension (popup.html?mode=onglet) charge CE fichier en mode
  // « listes » : Favoris · Annonces · Ventes du compte connecté, sans logo ni carte flottante.
  const LISTES = (() => { try { return globalThis.__vrmListes === true && /^(chrome|moz|safari-web)-extension:$/.test(location.protocol); } catch (_) { return false; } })();   // 5.362 (moyenne 69) : le mot de passe seulement dans l'iframe de l'extension
  if (window.top !== window && !CADRE) return;       // une seule carte par onglet
  // 5.410.2 (Julien, 20 nov. : « parfois l'extension se ferme toute seule sur Vinted ») : une carte déjà posée (double
  // injection, ou la carte ORPHELINE d'une extension rechargée) — on attend qu'elle parte, puis on se pose. Absente
  // 1,5 s de suite (la carte vivante se replace en moins d'une seconde quand la page la retire) ⇒ on démarre.
  if (document.getElementById('vrm-badge')) {
    try { let t = null; const mo = new MutationObserver(() => { if (document.getElementById('vrm-badge')) { clearTimeout(t); t = null; return; } if (!t) t = setTimeout(() => { if (!document.getElementById('vrm-badge')) { mo.disconnect(); demarrerBadge(); } else t = null; }, 1500); }); mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
    return;
  }
  const vivant = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; } };
  if (!vivant()) return;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 5.406 : la feuille et les pièces COMMUNES de l'extension (vrm-ui.js, chargé avant ce fichier) ;
  // `U.T(clé, vars)` : les textes neufs, en cinq langues. Absent (ancien manifeste) ⇒ le français.
  const U = globalThis.VRM_UI || { T: (k, v) => k, raisonFileFav: (o) => String((o && (o.texte || o.raison)) || ''), duree: (ms) => Math.round(ms / 60000) + ' min', etiquette: () => '', barre: () => '', monter: () => {}, esc };
  const TU = (k, v) => U.T(k, v);
  // 5.188 : le HTML de nos propres gabarits (valeurs passées par `esc`) est posé
  // par DOMParser plutôt que `innerHTML =` — même résultat, et c'est la forme que
  // les boutiques (Firefox, Edge) relisent sans avertissement.
  // 22 nov. (audit, mesuré au banc `panneau-saisie-gardee`) : chaque rendu REMPLACE les enfants ; le champ où il tapait
  //    perdait le curseur (un état qui change, une réponse qui arrive, la souris qui revient sur le panneau) — les lettres
  //    suivantes partaient dans le vide. Le champ en cours de saisie est retrouvé (même balise, mêmes attributs data-*,
  //    même rang) : il reprend le curseur et sa sélection.
  const cleChamp = (f) => f.tagName + '|' + (f.id || '') + '|' + (f.getAttribute('name') || '') + '|' + (f.getAttribute('type') || '') + '|' + Array.from(f.attributes).filter((a) => /^data-/.test(a.name)).map((a) => a.name + '=' + a.value).sort().join(',');
  const memes = (el, cle, tag) => Array.from(el.querySelectorAll(tag)).filter((x) => cleChamp(x) === cle);
  const poserHtml = (el, html) => {
    let garde = null;
    try {
      const r = el.getRootNode(), f = r && r.activeElement;
      if (f && el.contains(f) && /^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName)) {
        const cle = cleChamp(f);
        garde = { cle, tag: f.tagName, rang: memes(el, cle, f.tagName).indexOf(f), v: f.value, texte: f.tagName === 'TEXTAREA' || (f.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|file|range|color)$/i.test(f.type || '')) };
        try { garde.deb = f.selectionStart; garde.fin = f.selectionEnd; } catch (_) {}
      }
    } catch (_) { garde = null; }
    const d = new DOMParser().parseFromString('<body>' + String(html) + '</body>', 'text/html'); el.replaceChildren(...Array.from(d.body.childNodes));
    if (!garde || garde.rang < 0) return;
    try {
      const n = memes(el, garde.cle, garde.tag)[garde.rang];
      if (!n || n.disabled) return;
      n.focus({ preventScroll: true });
      // La VALEUR n'est jamais reposée : c'est l'état du panneau qui la rend (un champ vidé exprès après un envoi doit
      // rester vide — sur Orion, toucher « Envoyer » ne retire pas le curseur du champ). La sélection, seulement si le
      // texte rendu est bien celui qu'il tapait.
      if (garde.texte && n.value === garde.v) { try { if (garde.deb != null) n.setSelectionRange(garde.deb, garde.fin); } catch (_) {} }
    } catch (_) {}
  };

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
  // 5.379 : la marque du disjoncteur Leboncoin (lbc-relay.js), lue telle quelle — 30 min au plus.
  const deCoteLbc = () => { try { if (!/(^|\.)leboncoin\.fr$/i.test(String(location.hostname || ''))) return null; const v = JSON.parse(sessionStorage.getItem('vrm_lbc_de_cote') || 'null'); const age = Date.now() - Number(v && v.t); return v && typeof v === 'object' && age >= 0 && age < 1800000 ? v : null; } catch (_) { return null; } };
  const NOM_SITE = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire Collective' };

  const hote = document.createElement('div');
  hote.id = 'vrm-badge';
  hote.style.cssText = CADRE || LISTES ? 'all:initial;display:block;' : 'all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483646;';
  const ombre = hote.attachShadow({ mode: 'closed' });
  ombre.innerHTML = `
<style>
  /* 5.379 — « Studio bleu clair » (src/design/studio.css, Julien 14 nov.) : un fond bleu
     clair OPAQUE (nuit : bleu-nuit), lumière du haut ; porcelaine (touches, plans), encre,
     UNE diode bleue rare ; ambre = un geste, jamais violet. Les mêmes noms de jetons
     qu'avant (5.328) : toute la carte suit. Avant : un verre blanc à 88 % posé sur la page
     sombre de Vinted, qui la rendait GRISE (capture de Julien, 15 nov.). */
  :host { all: initial;
    --fond: #000000; --carte: #1C1C1E; --bord: rgba(255,255,255,.10); --filet: rgba(255,255,255,.08); --texte: #F2F2F7; --doux: #98989F; --pale: #8E8E93;
    --accent: #3FD49A; --ambre: #F2B65E; --survol: rgba(255,255,255,.06); --remplir: rgb(28 28 30 / .9); --verre: #1C1C1E;
    --champ: rgb(0 0 0 / .22); --anneau: rgba(63,212,154,.35);
    --ombre: inset 0 .5px 0 rgb(255 255 255 / .12), 0 0 0 .5px rgb(0 0 0 / .5), 0 34px 60px -22px rgb(0 0 0 / .95);
    --fond-carte: linear-gradient(180deg, #1C1C1E 0%, #141416 100%);
    --plan: rgb(28 28 30 / .9); --plan-ombre: inset 0 .5px 0 rgb(255 255 255 / .09), 0 0 0 .5px rgb(0 0 0 / .5), 0 12px 26px -12px rgb(0 0 0 / .8);
    --touche-fond: linear-gradient(180deg, #2C2C2E, #242426); --touche-ombre: inset 0 .5px 0 rgb(255 255 255 / .12), 0 0 0 .5px rgb(0 0 0 / .55), 0 4px 10px -5px rgb(0 0 0 / .8);
    --enfonce: inset 0 1px 3px rgb(0 0 0 / .7), inset 0 0 0 .5px rgb(0 0 0 / .5);
    --plein-fond: radial-gradient(120% 90% at 50% 0%, #FFFFFF 0%, #F2F2F7 60%); --plein-encre: #111114; --plein-ombre: inset 0 .5px 0 #FFFFFF, 0 1px 2px rgb(0 0 0 / .5), 0 12px 24px -10px rgb(0 0 0 / .9); }
  /* 5.351 : la teinte CHOISIE dans VRM (Réglages → Apparence, recopiée par le pont
     de vrm.center : data-theme sur l'hôte) passe avant celle du système ; sans
     choix connu, le système décide, comme avant. */
  @media (prefers-color-scheme: light) {
    :host(:not([data-theme="sombre"])) { --carte: #FFFFFF; --bord: rgba(60,60,67,.12); --filet: rgba(60,60,67,.10); --texte: #111114; --doux: #3C3C43; --pale: #6C6C70;
      --accent: #0F6B4C; --ambre: #764300; --survol: rgba(60,60,67,.05); --remplir: rgb(255 255 255 / .82); --verre: #F2F2F7;
      --champ: #FFFFFF; --anneau: rgba(15,107,76,.25);
      --ombre: inset 0 1px 0 #FFFFFF, 0 0 0 .5px rgb(60 60 67 / .10), 0 2px 5px rgb(60 60 67 / .08), 0 34px 60px -26px rgb(60 60 67 / .48);
      --fond-carte: linear-gradient(180deg, #F7F7F8 0%, #EDEDF0 100%);
      --plan: rgb(255 255 255 / .82); --plan-ombre: inset 0 1px 0 #FFFFFF, 0 0 0 .5px rgb(60 60 67 / .07), 0 1px 2px rgb(60 60 67 / .07), 0 12px 26px -14px rgb(60 60 67 / .30);
      --touche-fond: linear-gradient(180deg, #FFFFFF, #F7F7F8); --touche-ombre: inset 0 1px 0 #FFFFFF, 0 0 0 .5px rgb(60 60 67 / .14), 0 1px 1.5px rgb(60 60 67 / .08), 0 4px 9px -5px rgb(60 60 67 / .26);
      --enfonce: inset 0 1px 2px rgb(60 60 67 / .20), inset 0 0 0 .5px rgb(60 60 67 / .12);
      --plein-fond: radial-gradient(120% 90% at 50% 0%, #2C2C2E 0%, #111114 55%); --plein-encre: #FFFFFF; --plein-ombre: inset 0 .5px 0 rgb(255 255 255 / .25), 0 1px 2px rgb(60 60 67 / .25), 0 12px 22px -10px rgb(60 60 67 / .6); }
  }
  :host([data-theme="clair"]) { --carte: #FFFFFF; --bord: rgba(60,60,67,.12); --filet: rgba(60,60,67,.10); --texte: #111114; --doux: #3C3C43; --pale: #6C6C70;
      --accent: #0F6B4C; --ambre: #764300; --survol: rgba(60,60,67,.05); --remplir: rgb(255 255 255 / .82); --verre: #F2F2F7;
      --champ: #FFFFFF; --anneau: rgba(15,107,76,.25);
      --ombre: inset 0 1px 0 #FFFFFF, 0 0 0 .5px rgb(60 60 67 / .10), 0 2px 5px rgb(60 60 67 / .08), 0 34px 60px -26px rgb(60 60 67 / .48);
      --fond-carte: linear-gradient(180deg, #F7F7F8 0%, #EDEDF0 100%);
      --plan: rgb(255 255 255 / .82); --plan-ombre: inset 0 1px 0 #FFFFFF, 0 0 0 .5px rgb(60 60 67 / .07), 0 1px 2px rgb(60 60 67 / .07), 0 12px 26px -14px rgb(60 60 67 / .30);
      --touche-fond: linear-gradient(180deg, #FFFFFF, #F7F7F8); --touche-ombre: inset 0 1px 0 #FFFFFF, 0 0 0 .5px rgb(60 60 67 / .14), 0 1px 1.5px rgb(60 60 67 / .08), 0 4px 9px -5px rgb(60 60 67 / .26);
      --enfonce: inset 0 1px 2px rgb(60 60 67 / .20), inset 0 0 0 .5px rgb(60 60 67 / .12);
      --plein-fond: radial-gradient(120% 90% at 50% 0%, #2C2C2E 0%, #111114 55%); --plein-encre: #FFFFFF; --plein-ombre: inset 0 .5px 0 rgb(255 255 255 / .25), 0 1px 2px rgb(60 60 67 / .25), 0 12px 22px -10px rgb(60 60 67 / .6); }
  * { box-sizing: border-box; font-family: "Inter VRM", Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .btn { position: relative; width: 44px; height: 44px; padding: 0; border: .5px solid rgba(255,255,255,.14); border-radius: 12px;
    background: #000; cursor: pointer; display: block;
    box-shadow: 0 6px 16px rgba(0,0,0,.18), 0 16px 36px rgba(0,0,0,.22); transition: transform .15s cubic-bezier(.23,1,.32,1), box-shadow .15s cubic-bezier(.23,1,.32,1); }
  .btn:active { transform: scale(.94); }
  .btn:hover { transform: translateY(-1px); box-shadow: 0 1px 2px rgba(0,0,0,.35), 0 12px 30px rgba(0,0,0,.34); }
  .btn:focus-visible, .b:focus-visible, .fermer:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .btn img { width: 100%; height: 100%; border-radius: 10px; display: block; -webkit-user-drag: none; user-select: none; pointer-events: none; }
  .btn .txt { color: #E8ECF2; font-weight: 800; font-size: 12px; letter-spacing: .04em; line-height: 42px; text-align: center; display: block; }
  .pt { position: absolute; top: -3px; right: -3px; width: 11px; height: 11px; border-radius: 999px; background: var(--ambre); border: 2px solid #000; display: none; }
  .pt.on { display: block; }
  /* 5.328 : verre (clair et sombre), une colonne ; la connexion y est posée. */
  .carte, .question { position: absolute; right: 0; bottom: 54px; width: min(320px, calc(100vw - 32px)); max-height: calc(100vh - 90px); overflow-y: auto; background: var(--verre); color: var(--texte); border: 1px solid var(--bord);
    -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);
    border-radius: 14px; padding: 12px 14px; font-size: 13px; line-height: 1.45; box-shadow: var(--ombre); display: none; }
  .carte.on, .question.on { display: block; }
  .tete { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
  .tete b { font-size: 17px; font-weight: 600; letter-spacing: -.012em; }
  .ver { font-size: 11px; color: var(--pale); }
  .ligne { padding: 8px 0; border-top: 1px solid var(--filet); }
  .lib { font-size: 12px; color: var(--doux); font-weight: 500; }
  .val { margin-top: 2px; word-break: break-word; }
  .val.alerte { color: var(--ambre); }
  .val.gris { color: var(--doux); }
  /* 5.335 : Leboncoin en trois lignes ; « ✓ » discret (pas de couleur : §7), un seul geste. */
  .val .coche { color: var(--doux); margin-left: 4px; }
  .geste { margin-top: 8px; padding: 10px 12px; border-radius: 12px; background: var(--remplir); font-size: 13px; }
  .geste b { font-weight: 600; }
  .refus { margin-top: 4px; font-size: 11px; color: var(--doux); }
  .refus summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; }
  .refus ul { margin: 0; padding-left: 16px; }
  .refus li { margin: 2px 0; word-break: break-word; }
  /* 5.344 : l'historique de départ — une barre fine, neutre (l'accent reste rare, §7). */
  .imp { margin-top: 6px; }
  .imp-l { display: flex; justify-content: space-between; gap: 8px; font-variant-numeric: tabular-nums; }
  .barre { height: 4px; margin-top: 4px; border-radius: 999px; background: var(--remplir); overflow: hidden; }
  .barre > i { display: block; height: 100%; border-radius: 999px; background: var(--texte); opacity: .55; }
  .pied { margin-top: 8px; font-size: 12px; color: var(--doux); }
  .pied b { color: var(--texte); font-weight: 600; }
  .b { display: block; width: 100%; min-height: 44px; margin-top: 8px; padding: 0 14px; border: 1px solid transparent; border-radius: 12px;
    background: var(--accent); color: #fff; font-size: 15px; font-weight: 600; line-height: 1.2; cursor: pointer; text-align: center;
    transition: transform .15s cubic-bezier(.23,1,.32,1); }
  .b:active:not(:disabled) { transform: scale(.98); }
  .b.sec { background: var(--remplir); color: var(--texte); border-color: transparent; }
  .b.sec:hover { background: var(--survol); }
  .b:disabled { opacity: .6; cursor: default; }
  .q { font-size: 14px; font-weight: 600; margin: 2px 0 4px; }
  .q b { font-weight: 700; }
  .err { margin-top: 8px; font-size: 12px; color: var(--ambre); }
  /* 5.329 : le formulaire est DANS la carte (shadow root fermée), sous l'état. */
  .connexion { margin: 4px -14px -12px; border-top: 1px solid var(--filet); padding: 12px 14px 14px; }
  .connexion[hidden] { display: none; }
  .cx .lab { display: block; font-size: 12px; color: var(--doux); font-weight: 500; margin: 10px 0 4px; }
  .cx .lab:first-child { margin-top: 0; }
  .cx input { display: block; width: 100%; min-height: 44px; padding: 0 12px; margin: 0; border-radius: 10px; border: 1px solid var(--bord);
    background: var(--champ); color: var(--texte); font-size: 16px; line-height: 1.2; outline: none; -webkit-appearance: none; appearance: none; }
  .cx input::placeholder { color: var(--pale); }
  .cx input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--anneau); }
  .cx .aide { font-size: 12px; color: var(--doux); margin-top: 8px; }
  .cx .b { margin-top: 12px; }
  .cx .b + .b { margin-top: 8px; }
  .cx .oubli { display: inline-flex; align-items: center; min-height: 44px; color: var(--accent); font-size: 13px; text-decoration: none; }
  .cx .ou { display: flex; align-items: center; gap: 10px; color: var(--pale); font-size: 12px; margin: 12px 0 0; }
  .cx .ou::before, .cx .ou::after { content: ''; flex: 1; height: 1px; background: var(--filet); }
  .cx .fourn { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .cx .etat { margin-top: 8px; font-size: 12px; color: var(--doux); }
  .cx .err { margin-top: 10px; }
  /* 5.330 : le code reçu par e-mail — un vrai champ posé sur des cases. */
  .cx .envoye { font-size: 14px; line-height: 1.4; color: var(--texte); margin-bottom: 2px; word-break: break-word; }
  .cx .envoye b { font-weight: 600; }
  .cx .cases { position: relative; display: flex; gap: 6px; }
  .cx .case { flex: 1 1 0; min-width: 0; height: 52px; border-radius: 10px; border: 1px solid var(--bord); background: var(--champ);
    display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--texte); }
  .cx .case.cur { border-color: var(--accent); box-shadow: 0 0 0 3px var(--anneau); }
  .cx .cases input#vrm-cx-code { position: absolute; inset: 0; width: 100%; height: 100%; min-height: 52px; padding: 0; border: 0; border-radius: 10px;
    background: transparent; color: transparent; caret-color: transparent; box-shadow: none; font-size: 16px; letter-spacing: 0; }
  .cx .cases input#vrm-cx-code:focus { box-shadow: none; }
  .cx .cases input#vrm-cx-code::selection { background: transparent; }
  .cx .lien { display: inline-flex; align-items: center; min-height: 44px; padding: 0; border: 0; background: transparent; color: var(--accent); font-size: 13px; cursor: pointer; }
  .cx .lien:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
  .cx [hidden] { display: none; }
  /* 5.351 (lot extension-visuel) — UN message principal en tête, le détail replié.
     Le point dit l'état sans couleur quand tout va bien (§7) : gris ; ambre = un geste. */
  .resume { display: flex; align-items: center; gap: 8px; min-height: 28px; font-size: 14px; font-weight: 600; letter-spacing: -.006em; margin: 0 0 2px; }
  .resume .t { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .resume .d { width: 8px; height: 8px; border-radius: 999px; background: var(--pale); flex-shrink: 0; }
  .resume[data-resume="geste"] .d { background: var(--ambre); }
  .resume[data-resume="geste"] .t { color: var(--ambre); }
  .resume[data-resume="pause"] .d { background: transparent; box-shadow: inset 0 0 0 2px var(--doux); }
  .resume .coche { color: var(--doux); font-weight: 600; }
  .progres { font-size: 12px; margin: 0 0 4px 16px; }
  .raccourcis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 6px; }
  .raccourcis .b { margin-top: 0; padding: 0 6px; font-size: 13px; }
  .detail { margin-top: 8px; border-top: 1px solid var(--filet); }
  .detail > summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; min-height: 44px; font-size: 13px; color: var(--doux); font-weight: 500; }
  .detail > summary::-webkit-details-marker { display: none; }
  .detail > summary::after { content: ''; width: 7px; height: 7px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg) translate(-2px, -2px); transition: transform .2s cubic-bezier(.23,1,.32,1); }
  .detail[open] > summary::after { transform: rotate(-135deg) translate(-2px, -2px); }
  .detail > summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
  .detail .ligne:first-of-type { border-top: 0; padding-top: 0; }
  .lbc-tete { border-top: 0; padding-top: 2px; }
  .outils { display: flex; flex-wrap: wrap; gap: 0 14px; margin-top: 4px; }
  /* 5.354 : le mini-résumé du mois, replié sous une ligne discrète (les styles de « Détails »). */
  .mois .mois-l { margin-top: 0; line-height: 1.45; }
  .mois .mois-l b { font-weight: 600; color: var(--texte); }
  .mois .mois-l .seg { white-space: nowrap; }   /* coupé aux « · », jamais « 3 à / expédier » */
  .mois .outils { margin-top: 0; }
  .outils .lien { display: inline-flex; align-items: center; min-height: 44px; padding: 0; border: 0; background: transparent; color: var(--accent); font-size: 13px; cursor: pointer; }
  .outils .lien:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
  /* Le logo se DÉPLACE (glisser) et se RÉDUIT en pastille ; la carte s'ouvre du
     côté où il y a la place (haut/bas, gauche/droite). */
  .btn { touch-action: none; }
  .btn.glisse { cursor: grabbing; transform: scale(1.04); }
  /* 5.371 : au téléphone (doigt, écran étroit), le logo est plus petit. */
  @media (max-width: 480px) and (pointer: coarse) { .btn { width: 38px; height: 38px; border-radius: 11px; } .btn .txt { line-height: 36px; font-size: 11px; } .carte, .question { bottom: 48px; } }
  :host([data-mini]) .btn { width: 30px; height: 30px; border-radius: 9px; opacity: .78; }
  :host([data-mini]) .btn:hover, :host([data-mini]) .btn:focus-visible { opacity: 1; }
  :host([data-mini]) .btn img { border-radius: 8px; }
  :host([data-mini]) .btn .txt { font-size: 9px; line-height: 28px; }
  :host([data-mini]) .carte, :host([data-mini]) .question { bottom: 40px; }
  :host([data-haut]) .carte, :host([data-haut]) .question { bottom: auto; top: 54px; }
  :host([data-haut][data-mini]) .carte, :host([data-haut][data-mini]) .question { top: 40px; }
  :host([data-gauche]) .carte, :host([data-gauche]) .question { right: auto; left: 0; }
  .carte.on, .question.on { animation: vrm-entree .18s cubic-bezier(.23,1,.32,1); transform-origin: bottom right; }
  :host([data-haut]) .carte.on, :host([data-haut]) .question.on { transform-origin: top right; }
  @keyframes vrm-entree { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }   /* 5.379 : sans mise à l’échelle (les cibles gardent leurs 44 px pendant l’entrée) */
  @media (prefers-reduced-motion: reduce) { .carte.on, .question.on { animation: none; } .detail > summary::after { transition: none; } .btn.glisse { transform: none; } }
  @media (prefers-reduced-motion: reduce) { .b, .btn { transition: none; } }
  /* 5.371 : la carte en 4 lignes (compte · lu · jauge · état) — neutre, l'ambre seulement pour un geste. */
  .q4 { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 10px; margin: 0 0 2px; font-size: 13px; line-height: 1.4; }
  .q4 .k { color: var(--doux); font-size: 11px; font-weight: 500; align-self: baseline; }
  .q4 [data-q4="jauge"] { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .carte:has(.q4) { width: min(352px, calc(100vw - 32px)); }
  .q4 .v { min-width: 0; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; align-self: baseline; }
  .q4 .v.nom { font-weight: 600; }
  .q4 .v.gris { color: var(--doux); }
  .q4 [data-q4-etat="geste"] { color: var(--ambre); font-weight: 600; }
  .q4 .coche { color: var(--doux); margin-left: 4px; }
  .maj { margin-top: 8px; padding: 10px 12px; border-radius: 12px; background: var(--remplir); }
  .maj-t { font-weight: 600; font-size: 13px; }
  .maj a.b { text-decoration: none; display: flex; align-items: center; justify-content: center; }
  .maj ol { margin: 8px 0 0; padding-left: 18px; font-size: 12px; color: var(--doux); }
  .maj li { margin: 2px 0; }
  .rep { margin-top: 4px; font-size: 12px; color: var(--doux); }
  .rep[data-rep="reste"], .rep[data-rep="refus"] { color: var(--ambre); }
  /* 5.376 : les liens du site (jamais VRM) — des rangées iOS, chevron fin, texte à l'encre. */
  .liens { margin-top: 8px; border-radius: 12px; background: var(--remplir); overflow: hidden; }
  .lien-site { display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding: 0 12px; color: var(--texte); text-decoration: none; font-size: 15px; -webkit-tap-highlight-color: transparent; }
  .lien-site + .lien-site { border-top: 1px solid var(--filet); }
  .lien-site:hover { background: var(--survol); }
  .lien-site:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: 12px; }
  .lien-site i { width: 7px; height: 7px; border-right: 1.5px solid var(--pale); border-top: 1.5px solid var(--pale); transform: rotate(45deg); flex-shrink: 0; margin-left: 8px; }
  /* 5.376 : les messages aux favoris — un bloc calme ; le seul bouton plein est « Lancer ». */
  .fav { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--filet); }
  .fav-t { font-size: 12px; color: var(--doux); font-weight: 500; }
  .fav-l { margin-top: 2px; font-size: 14px; font-variant-numeric: tabular-nums; }
  .fav-l b { font-weight: 600; }
  .fav .barre { margin-top: 6px; }
  .fav-ligne { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 44px; padding: 0; border: 0; background: transparent; color: var(--texte); font-size: 15px; text-align: left; cursor: pointer; }
  .fav-ligne b { font-weight: 600; }
  .fav-go { color: var(--accent); font-size: 15px; }
  .fav-ligne:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 8px; }
  .carte:has(.apercu) { width: min(368px, calc(100vw - 32px)); }
  .ap-tete { display: flex; align-items: center; gap: 2px; margin: -4px 40px 6px -8px; }
  .ap-tete b { flex: 1; min-width: 0; font-size: 17px; font-weight: 600; letter-spacing: -.012em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ap-retour, .ap-aide-b { width: 44px; height: 44px; flex-shrink: 0; border: 0; border-radius: 10px; background: transparent; color: var(--accent); font-size: 24px; line-height: 44px; padding: 0; cursor: pointer; }
  .ap-aide-b { border-radius: 999px; background: radial-gradient(circle, var(--remplir) 0 15px, transparent 15.5px); color: var(--texte); font-size: 15px; font-weight: 600; }   /* un rond de 30 px dans une cible de 44 px */
  .ap-retour:focus-visible, .ap-aide-b:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .ap-aide { margin: 0 0 8px; padding: 10px 12px 10px 28px; border-radius: 12px; background: var(--remplir); font-size: 12.5px; color: var(--doux); }
  .ap-aide li { margin: 2px 0; }
  .ap-phrase { margin: 0 0 8px; font-size: 14px; }
  .ap-lbl { margin: 10px 0 4px; font-size: 12px; color: var(--doux); font-weight: 500; }
  .bulle { padding: 10px 12px; border-radius: 16px 16px 16px 6px; background: var(--remplir); font-size: 14px; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 140px; overflow-y: auto; }
  .ap-liste { list-style: none; margin: 8px 0 4px; padding: 0; border-radius: 12px; background: var(--remplir); max-height: 220px; overflow-y: auto; }
  .ap-liste li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0 8px; padding: 8px 12px; font-size: 13px; }
  .ap-liste li + li { border-top: 1px solid var(--filet); }
  .ap-liste .qui { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ap-liste .quoi { grid-column: 1; color: var(--doux); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ap-liste .px { grid-column: 2; grid-row: 1 / span 2; align-self: center; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .ap-liste .px s { color: var(--pale); margin-right: 4px; }
  .fermer { position: absolute; top: 2px; right: 2px; width: 44px; height: 44px; border: 0; border-radius: 8px; background: transparent;
    color: var(--doux); font-size: 18px; cursor: pointer; line-height: 44px; padding: 0; }
  .fermer:hover { background: var(--survol); color: var(--texte); }
  .question .fermer, .carte .fermer { top: 4px; right: 4px; }
  .carte.doigt .tete { padding-right: 44px; }
  /* 19 octobre : au doigt (Firefox pour Android, Orion) — pas de survol, pas
     de surlignage gris du navigateur, et aucun double-tap qui zoome. */
  .btn, .b, .fermer, .fav-ligne, .ap-retour, .ap-aide-b, .lien-site { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  /* 5.351 : le logo se glisse au doigt aussi (sans faire défiler la page). */
  .btn { touch-action: none; }
  /* 5.377 : Favoris · Annonces · Ventes — la direction « bleu clair, porcelaine » (Julien, 14 nov.) :
     quatre formes de bouton (ici la TOUCHE et le LIEN ; un seul plein, « Envoyer le message ») ;
     l'actif est ENFONCÉ + DIODE, jamais une autre couleur de fond ; une rangée n'a pas de bouton. */
  :host { --porc1: #1C1C1E; --porc2: #1C1C1E; --creux: #000000; --diode: #3FD49A; --o: 0 0 0; --plaque-t: #F2F2F7; }
  @media (prefers-color-scheme: light) { :host(:not([data-theme="sombre"])) { --porc1: #FFFFFF; --porc2: #F7F7F8; --creux: #E5E5EA; --diode: #0F6B4C; --o: 18 52 96; --plaque-t: #111114; } }
  :host([data-theme="clair"]) { --porc1: #FFFFFF; --porc2: #F7F7F8; --creux: #E5E5EA; --diode: #0F6B4C; --o: 18 52 96; --plaque-t: #111114; }
  .listes { margin-top: 8px; }
  .seg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 6px; margin-top: 8px; }
  .touche { position: relative; min-height: 44px; padding: 0 10px; border: 0; border-radius: 13px; color: var(--texte); font-size: 14px; font-weight: 600; cursor: pointer;
    background: linear-gradient(180deg, var(--porc1), var(--porc2)); box-shadow: inset 0 1px 0 rgb(255 255 255 / .9), 0 0 0 .5px rgb(var(--o) / .10), 0 1px 2px rgb(var(--o) / .10);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: transform 90ms cubic-bezier(.2,.9,.25,1); -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .touche:active { transform: translateY(1px); }
  .touche[data-actif] { background: var(--creux); box-shadow: inset 0 1px 2px rgb(var(--o) / .22), inset 0 0 0 .5px rgb(var(--o) / .10); }
  .touche[data-actif]::after { content: ''; position: absolute; left: 50%; bottom: 6px; width: 4px; height: 4px; margin-left: -2px; border-radius: 50%; background: var(--diode); box-shadow: 0 0 6px var(--diode); }
  .touche:focus-visible { outline: 2px solid var(--diode); outline-offset: 2px; }
  .portee .touche { font-weight: 500; }
  .panneau { margin-top: 8px; }
  .lu { font-size: 12px; color: var(--doux); margin: 2px 0 4px; font-variant-numeric: tabular-nums; }
  .rangs { list-style: none; margin: 0; padding: 0; max-height: 300px; overflow-y: auto; border-radius: 12px; }
  .rang { display: grid; grid-template-columns: 46px 40px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 56px; padding: 6px 4px; color: var(--texte); text-decoration: none; font-size: 13px;
    content-visibility: auto; contain-intrinsic-size: 56px; -webkit-tap-highlight-color: transparent; }
  a.rang:active { opacity: .55; }
  a.rang:focus-visible { outline: 2px solid var(--diode); outline-offset: -2px; border-radius: 10px; }
  .vig { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; background: var(--remplir); display: block; }
  .plaque { display: inline-flex; align-items: baseline; justify-content: center; gap: 2px; min-width: 46px; height: 22px; padding: 0 4px; border-radius: 6px; background: var(--creux); color: var(--plaque-t);
    font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 22px; box-shadow: inset 0 .5px 1px rgb(var(--o) / .26), inset 0 0 0 .5px rgb(var(--o) / .08); overflow: hidden; }
  .plaque i { font-style: normal; font-size: 9.5px; color: var(--doux); }
  .plaque.vide { color: var(--doux); }
  .mil { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ti { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .me { font-size: 12px; color: var(--doux); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .me .ambre { color: var(--ambre); font-weight: 600; }
  .rang .px { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
  /* Les autres comptes : lisibles en gros, floutés dans le détail, « inert » (aucune action). */
  .autres { margin-top: 10px; display: grid; gap: 8px; }
  .autre { padding: 8px 10px; border-radius: 12px; background: var(--remplir); }
  .autre-t { font-size: 13px; overflow-wrap: anywhere; }
  .autre-t b { font-weight: 600; }
  .autre .flou { filter: blur(5px); opacity: .7; user-select: none; pointer-events: none; max-height: 140px; overflow: hidden; }
  .autre-a { font-size: 12px; color: var(--doux); margin-top: 4px; }
  /* L'aperçu des favoris : on coche (la rangée entière), « Tout cocher », un seul plein. */
  .ap-liste li.coche-l { grid-template-columns: 24px 40px minmax(0, 1fr) auto; align-items: center; gap: 0 10px; min-height: 56px; cursor: pointer; }
  .ap-liste li.coche-l input { width: 20px; height: 20px; margin: 0; accent-color: var(--diode); }
  .ap-liste li.coche-l .qui, .ap-liste li.coche-l .quoi { grid-column: 3; }
  .ap-liste li.coche-l .px { grid-column: 4; grid-row: 1 / span 2; }
  .ap-liste li.coche-l .vig { grid-column: 2; grid-row: 1 / span 2; }
  .ap-liste li.coche-l input { grid-column: 1; grid-row: 1 / span 2; }
  .ap-tout { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .ap-tout .lien { display: inline-flex; align-items: center; min-height: 44px; padding: 0; border: 0; background: transparent; color: var(--accent); font-size: 14px; font-weight: 600; cursor: pointer; }
  @media (prefers-reduced-motion: reduce) { .touche { transition: none; } }
  /* 5.377 : « VRM a capté » — une bulle de verre près du logo, neutre (le lien seul est bleu, §7). */
  .capte { position: absolute; width: max-content; max-width: min(320px, calc(100vw - 72px)); min-width: 200px; padding: 9px 36px 0 14px; border-radius: 14px;
    background: var(--verre); color: var(--texte); border: 1px solid var(--bord); box-shadow: var(--ombre); font-size: 13px; line-height: 1.35;
    -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); cursor: default; -webkit-tap-highlight-color: transparent; }
  .capte[hidden] { display: none; }
  .capte.on { animation: vrm-entree .18s cubic-bezier(.23,1,.32,1); }
  .capte-t { font-size: 12px; color: var(--doux); font-weight: 500; overflow-wrap: anywhere; }
  .capte-nom { color: var(--texte); font-weight: 600; }
  .capte-l .seg { white-space: nowrap; }
  .capte-r { display: flex; align-items: center; gap: 12px; min-height: 44px; }
  .capte-l { flex: 1; min-width: 0; padding: 4px 0 8px; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .capte-voir { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; margin-right: -22px; padding: 0 8px; color: var(--accent); font-size: 14px; font-weight: 600; text-decoration: none; }
  .capte-voir i { width: 7px; height: 7px; border-right: 1.5px solid currentColor; border-top: 1.5px solid currentColor; transform: rotate(45deg); }
  .capte-voir:active { opacity: .55; }
  .capte-voir:focus-visible, .capte-x:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 8px; }
  .capte-x { position: absolute; top: 0; right: 0; width: 44px; height: 44px; border: 0; border-radius: 12px; background: transparent; color: var(--doux); font-size: 18px; line-height: 44px; padding: 0; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
  .capte-x:hover { background: var(--survol); color: var(--texte); }
  @media (prefers-reduced-motion: reduce) { .capte.on { animation: none; } }
  @media (prefers-reduced-transparency: reduce) { .capte { -webkit-backdrop-filter: none; backdrop-filter: none; background: var(--carte); } }
  /* ══ 5.379 — L'HABILLAGE « STUDIO BLEU CLAIR » (capture de Julien, 15 nov.) ══════════
     Quatre formes de bouton, aucune autre : le PLEIN (rond d'encre, un seul à l'écran :
     « Envoyer le message »), la TOUCHE (porcelaine en relief ; l'active ENFONCÉE + diode),
     le ROND (×), le LIEN (texte bleu). Une rangée se touche entière. Titres sur deux lignes. */
  .carte, .question { background: var(--fond-carte); border: 0; border-radius: 22px; padding: 14px 16px 12px;
    -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: var(--ombre); font-size: 13.5px; }
  .carte:has(.q4), .carte:has(.listes) { width: min(380px, calc(100vw - 32px)); }
  .tete b { font-size: 18px; font-weight: 700; letter-spacing: -.02em; }
  .ver { font-variant-numeric: tabular-nums; }
  .ligne { border-top-color: var(--filet); }
  .lib { font-size: 11.5px; letter-spacing: .01em; }
  /* Le PLEIN : un rond d'encre (le seul de la carte quand il est là). */
  .b { min-height: 48px; border: 0; border-radius: 999px; background: var(--plein-fond); color: var(--plein-encre); box-shadow: var(--plein-ombre);
    font-size: 15px; font-weight: 600; letter-spacing: -.005em; }
  .b:active:not(:disabled) { transform: translateY(1px) scale(.99); }
  .b:disabled { opacity: .45; box-shadow: none; }
  /* La TOUCHE : porcelaine en relief (« Réessayer », « Réparer », « Tout récupérer »…). */
  .b.sec, .touche { background: var(--touche-fond); color: var(--texte); box-shadow: var(--touche-ombre); border: 0; border-radius: 13px; min-height: 44px; }
  .b.sec { font-size: 14px; font-weight: 600; }
  .b.sec:hover { background: var(--touche-fond); filter: brightness(1.02); }
  .b.sec:active:not(:disabled), .touche:active { transform: translateY(1px); box-shadow: var(--enfonce); }
  .touche[data-actif] { background: var(--creux); box-shadow: var(--enfonce); }
  /* Un lien de VRM (« Écris d'abord ton message dans VRM ») : une rangée de plan, le texte en bleu. */
  .liens, .rangs, .ap-liste { background: var(--plan); box-shadow: var(--plan-ombre); border-radius: 16px; }
  .lien-site { min-height: 48px; padding: 0 14px; font-size: 15px; font-weight: 500; }
  .lien-site.lien-vrm { color: var(--accent); font-weight: 600; border-radius: 16px; background: var(--plan); box-shadow: var(--plan-ombre); margin-top: 8px; }
  .lien-site.lien-vrm i { border-color: currentColor; }
  .ecrire { margin-top: 10px; }
  /* Les listes : rangées sur un plan, photo + titre sur DEUX lignes + méta + prix. */
  .lu { font-size: 12px; margin: 8px 2px 6px; letter-spacing: .005em; }
  .rangs { max-height: min(360px, calc(100vh - 380px)); min-height: 120px; padding: 0 2px; }
  .rangs > li + li { border-top: 1px solid var(--filet); }
  .rang { grid-template-columns: 44px minmax(0, 1fr) auto; gap: 12px; min-height: 64px; padding: 10px 12px; contain-intrinsic-size: 64px; }
  .rangs.avec-n .rang { grid-template-columns: 46px 44px minmax(0, 1fr) auto; }
  .sans-n { display: block; width: 46px; }
  .vig { width: 44px; height: 44px; border-radius: 11px; }
  .ti { white-space: normal; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; line-height: 1.3; font-size: 14px; font-weight: 600; letter-spacing: -.006em; }
  .me { white-space: normal; overflow: visible; text-overflow: clip; line-height: 1.35; }
  .rang .px { font-size: 14px; }
  a.rang:hover { background: var(--survol); }
  .seg { gap: 8px; }
  .touche { font-size: 14.5px; }
  /* Sécurité du compte : une ligne d'état, « Tout arrêter » en TOUCHE à droite (sous les listes). */
  .ligne.secu { display: flex; align-items: center; gap: 12px; margin-top: 10px; padding-top: 10px; }
  .secu-t { flex: 1; min-width: 0; }
  .secu-b { flex-shrink: 0; padding: 0 14px; font-weight: 600; }
  /* Favoris à cocher : case · photo · titre (2 lignes) / qui · quand · prix. */
  .ap-liste { margin: 0 0 6px; max-height: min(360px, calc(100vh - 420px)); min-height: 120px; }
  .ap-liste li.coche-l { grid-template-columns: 22px 44px minmax(0, 1fr) auto; gap: 2px 12px; min-height: 64px; padding: 10px 12px; }
  .ap-liste li.coche-l .quoi { grid-column: 3; grid-row: 1; color: var(--texte); font-weight: 600; font-size: 14px; white-space: normal; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; line-height: 1.3; }
  .ap-liste li.coche-l .qui { grid-column: 3; grid-row: 2; color: var(--doux); font-weight: 400; font-size: 12px; white-space: normal; }
  .ap-liste li.coche-l .vig { width: 44px; height: 44px; }
  .ap-liste .quand { color: var(--doux); white-space: nowrap; }
  .sg { white-space: nowrap; }
  .mois .mois-l .seg { display: inline; margin: 0; }   /* le résumé du mois garde ses « · » en ligne (la grille .seg est celle des touches) */
  span.vig { background: var(--creux); box-shadow: inset 0 0 0 .5px rgb(var(--o) / .08); }
  .ap-tout { margin: 0 2px 4px; }
  .ap-tout .ap-lbl { margin: 0; }
  .ap-tout .lu { margin: 0; }
  .bulle { background: var(--plan); box-shadow: var(--plan-ombre); }
  .fav { border-top: 0; padding-top: 0; }
  .fav .b { margin-top: 12px; }
  .plaque { box-shadow: inset 0 .5px 1px rgb(var(--o) / .26), inset 0 0 0 .5px rgb(var(--o) / .08), 0 .5px 0 rgb(255 255 255 / .6); }
  .autre { background: var(--plan); box-shadow: var(--plan-ombre); border-radius: 16px; padding: 10px 12px; }
  .autre .rangs { background: transparent; box-shadow: none; min-height: 0; }
  .detail > summary { min-height: 44px; }
  .capte { background: var(--fond-carte); border: 0; -webkit-backdrop-filter: none; backdrop-filter: none; }
  @media (max-width: 480px) { .carte, .question { max-height: calc(100vh - 80px); } .rangs, .ap-liste { max-height: min(340px, calc(100vh - 360px)); } }
  /* ══ 5.386 — « VERRE DÉPOLI » (Julien, 15 nov. : « J'aime la 9 ») ═══════════════════
     La carte est un petit panneau au dégradé BLEU PROFOND, OPAQUE (jamais la page du site
     à travers : elle se pose sur n'importe quelle page, blanche ou noire) ; ses lignes
     vivent sur des plaques de VERRE posées sur CE dégradé. Le titre se lit en blanc sur le
     bleu ; tout le reste se lit sur le verre (encre la journée, clair la nuit). Contraste AA
     mesuré sur les couleurs calculées, sur la partie la plus sombre du dégradé pour le verre
     et la plus claire pour le blanc (banc verre-extension-site). Accent rare, ambre = geste,
     jamais violet ni rouge. Sans flou possible (ou transparence réduite) : verre opaque. */
  :host { --vb-fond-uni: #000000;
    --vb-fond: radial-gradient(120% 60% at 12% 0%, rgb(0 0 0 / 0) 0%, rgb(0 0 0 / 0) 60%), linear-gradient(170deg, #141416 0%, #000000 50%, #000000 100%);
    --vb-verre: rgb(28 28 30 / .72); --vb-verre-o: #1C1C1E; --vb-verre-bord: rgb(255 255 255 / .12);
    --vb-verre-ombre: inset 0 .5px 0 rgb(255 255 255 / .10), 0 10px 24px -14px rgb(0 0 0 / .85);
    --vb-sur: #FFFFFF; --vb-sur-2: #C7C7CC; --pale: #8E8E93;
    --plan: rgb(255 255 255 / .05); --plan-ombre: inset 0 0 0 .5px rgb(255 255 255 / .07);
    --vb-plein-sur-bleu: #FFFFFF; --vb-plein-sur-bleu-t: #111114; }
  @media (prefers-color-scheme: light) {
    :host(:not([data-theme="sombre"])) { --vb-fond-uni: #F2F2F7;
      --vb-fond: radial-gradient(120% 60% at 12% 0%, rgb(0 0 0 / 0) 0%, rgb(0 0 0 / 0) 55%), radial-gradient(70% 45% at 100% 38%, rgb(0 0 0 / 0) 0%, rgb(0 0 0 / 0) 70%), linear-gradient(170deg, #F2F2F7 0%, #F2F2F7 45%, #E5E5EA 100%);
      --vb-verre: rgb(255 255 255 / .9); --vb-verre-o: #E5E5EA; --vb-verre-bord: rgb(255 255 255 / .75);
      --vb-verre-ombre: inset 0 1px 0 rgb(255 255 255 / .9), 0 12px 26px -16px rgb(0 0 0 / .6);
      --vb-sur: #111114; --vb-sur-2: #6C6C70; --pale: #6C6C70;
      --plan: rgb(255 255 255 / .55); --plan-ombre: inset 0 0 0 .5px rgb(60 60 67 / .08); }
  }
  :host([data-theme="clair"]) { --vb-fond-uni: #F2F2F7;
      --vb-fond: radial-gradient(120% 60% at 12% 0%, rgb(0 0 0 / 0) 0%, rgb(0 0 0 / 0) 55%), radial-gradient(70% 45% at 100% 38%, rgb(0 0 0 / 0) 0%, rgb(0 0 0 / 0) 70%), linear-gradient(170deg, #F2F2F7 0%, #F2F2F7 45%, #E5E5EA 100%);
      --vb-verre: rgb(255 255 255 / .9); --vb-verre-o: #E5E5EA; --vb-verre-bord: rgb(255 255 255 / .75);
      --vb-verre-ombre: inset 0 1px 0 rgb(255 255 255 / .9), 0 12px 26px -16px rgb(0 0 0 / .6);
      --vb-sur: #111114; --vb-sur-2: #6C6C70; --pale: #6C6C70;
      --plan: rgb(255 255 255 / .55); --plan-ombre: inset 0 0 0 .5px rgb(60 60 67 / .08); }
  /* Le panneau : le dégradé, opaque (une couleur unie dessous, au cas où). */
  .carte, .question { background-color: var(--vb-fond-uni); background-image: var(--vb-fond); border: 1px solid rgb(255 255 255 / .14); padding: 14px 12px 12px; }
  .carte .tete, .question .tete { padding: 0 4px; margin-bottom: 4px; min-height: 30px; }
  .carte .tete b, .question .tete b { color: var(--vb-sur); font-size: 20px; letter-spacing: -.03em; }
  .carte .tete .ver { color: var(--vb-sur-2); }
  .fermer { color: var(--vb-sur-2); }
  .fermer:hover { color: var(--vb-sur); background: rgb(255 255 255 / .12); }
  /* Les plaques de verre : chaque ligne de la carte, posée sur le bleu. */
  .contenu > :not(.tete):not(.fermer):not(.b):not(style), .carte > .connexion, .question > .err {
    margin: 8px 0 0; padding: 10px 12px; border: 1px solid var(--vb-verre-bord); border-radius: 18px;
    background: var(--vb-verre); -webkit-backdrop-filter: blur(26px) saturate(1.4); backdrop-filter: blur(26px) saturate(1.4); box-shadow: var(--vb-verre-ombre); color: var(--texte); }
  .contenu > .ligne { border-top: 1px solid var(--vb-verre-bord); padding-top: 10px; }
  .contenu > .liens { padding: 0; overflow: hidden; }
  .contenu > .liens .lien-site.lien-vrm { background: transparent; box-shadow: none; margin: 0; }
  .contenu > .detail { padding-top: 0; padding-bottom: 0; }
  .contenu > .detail[open] { padding-bottom: 8px; }
  .contenu > .mois { padding-top: 0; }
  .contenu > .ligne.secu { margin-top: 8px; }
  .gestes > .listes:first-child, .gestes > .fav:first-child { margin-top: 0; }
  .carte > .connexion { margin-top: 8px; }
  .carte > .connexion[hidden] { display: none; }
  /* Sur le bleu : le plein est blanc (l'encre ne se verrait pas) ; la touche, du verre. */
  .contenu > .b:not(.sec), .question > .b:not(.sec) { background: var(--vb-plein-sur-bleu); color: var(--vb-plein-sur-bleu-t); box-shadow: 0 1px 2px rgb(0 0 0 / .25), 0 12px 22px -12px rgb(0 0 0 / .7); }
  .contenu > .b.sec, .question > .b.sec { background: var(--vb-verre); color: var(--texte); border: 1px solid var(--vb-verre-bord); box-shadow: var(--vb-verre-ombre); -webkit-backdrop-filter: blur(26px) saturate(1.4); backdrop-filter: blur(26px) saturate(1.4); }
  /* La question « c'est bien un de tes comptes ? » : une phrase en blanc sur le bleu. */
  .question .q, .question > .val { color: var(--vb-sur); padding: 0 4px; }
  .question > .val.gris { color: var(--vb-sur-2); }
  /* « VRM a capté » : une plaque de verre posée sur le même dégradé (jamais la page derrière). */
  .capte { background-color: var(--vb-verre-o); background-image: linear-gradient(var(--vb-verre), var(--vb-verre)), var(--vb-fond); border: 1px solid var(--vb-verre-bord); }
  /* Sans flou (ou transparence réduite) : le verre devient opaque, la lecture ne change pas. */
  @supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
    .contenu > :not(.tete):not(.fermer):not(.b):not(style), .carte > .connexion, .question > .err, .contenu > .b.sec, .question > .b.sec { background: var(--vb-verre-o); }
    .capte { background-image: none; }
  }
  @media (prefers-reduced-transparency: reduce) {
    .contenu > :not(.tete):not(.fermer):not(.b):not(style), .carte > .connexion, .question > .err, .contenu > .b.sec, .question > .b.sec { background: var(--vb-verre-o); -webkit-backdrop-filter: none; backdrop-filter: none; }
    .capte { background-image: none; }
  }
  /* ══ 5.406 — LA CARTE « DESIGN V2 » (Julien, 17 nov. : « je veux que ça soit bcp plus clair et plus
     beau ») : la coque bleue (vrm-ui.js), UNE ligne de tête (compte · point · état), UNE ligne
     principale (ce qui se passe maintenant, un trait de progression), UN plein, une ligne secondaire
     (jauge, capté), un bandeau fin pour la version, un contrôle segmenté. Les plaques de porcelaine
     remplacent les quatre boîtes grises. Les jetons sont ceux de vrm-ui.js (--vu-*). */
  .carte, .question { background-color: var(--vu-coque-uni); background-image: var(--vu-coque); color: var(--vu-sur); border: 1px solid rgb(255 255 255/.14);
    border-radius: 22px; padding: 12px; width: min(380px, calc(100vw - 24px)); box-shadow: 0 1px 2px rgb(0 0 0/.2), 0 30px 60px -24px rgb(0 0 0/.75); }
  .carte:has(.q4), .carte:has(.listes), .carte:has(.apercu) { width: min(380px, calc(100vw - 24px)); }
  .contenu > :not(.tete):not(.fermer):not(.b):not(style), .carte > .connexion, .question > .err {
    background: var(--vu-plaque); color: var(--vu-encre); border: 0; border-radius: 18px; box-shadow: var(--vu-ombre); -webkit-backdrop-filter: none; backdrop-filter: none; margin: 8px 0 0; }
  .contenu > .t5, .contenu > .vu-sous, .contenu > .maj5, .contenu > .fermer { background: transparent !important; box-shadow: none !important; padding: 0; border-radius: 0; color: var(--vu-sur) !important; }
  .contenu > .principal { padding: 14px; }
  .t5 { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 44px 0 6px !important; margin: 0 !important; }
  .t5 .nom { flex: 0 1 auto; max-width: 62%; font: 700 18px/1.2 var(--vu-police); letter-spacing: -.02em; color: var(--vu-sur); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .t5 .et { flex: 1 1 0; min-width: 0; font: 600 13px/1.25 var(--vu-police); color: var(--vu-sur-2); }
  .t5 [data-q4-etat="geste"] { color: #FFE2A8; }
  .t5 .nom-b { appearance: none; border: 0; background: transparent; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 6px; margin-left: -6px; border-radius: 10px; -webkit-tap-highlight-color: transparent; }
  .t5 .nom-b:hover { background: rgb(255 255 255/.10); }
  .t5 .nom-b:focus-visible { outline: none; box-shadow: var(--vu-anneau); }
  .t5 .nom-b i { width: 7px; height: 7px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(45deg) translate(-2px, -2px); flex: none; opacity: .85; }
  .t5 .nom-b[aria-expanded="true"] i { transform: rotate(-135deg) translate(-2px, -2px); }
  .contenu > .menu5 { padding: 4px !important; display: grid; gap: 2px; }
  .contenu > .menu5[hidden] { display: none; }
  .menu5 button { appearance: none; border: 0; background: transparent; display: flex; align-items: baseline; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 12px; color: var(--vu-encre); font: 600 15px/1.2 var(--vu-police); text-align: left; cursor: pointer; }
  .menu5 button small { font-size: 13px; font-weight: 500; color: var(--vu-muet); }
  .menu5 button[data-actif] { background: var(--vu-teinte); color: var(--vu-teinte-encre); }
  .menu5 button[data-actif]::after { content: '✓'; margin-left: auto; }
  .menu5 button:focus-visible { outline: none; box-shadow: var(--vu-anneau); }
  .t5 .vu-point { color: var(--vu-sur-2); }
  .contenu > .vu-sous { padding: 2px 6px 0 !important; margin: 6px 0 0 !important; font-size: 13px; }
  .lu, .fav-t, .lib, .ligne.secu .val { font-size: 13px; }
  .vu-sous .sep { opacity: .7; padding: 0 2px; }
  .vu-sous [data-capture] a { color: var(--vu-sur); }
  .maj5 { margin: 8px 0 0 !important; }
  .maj5 .vu-bandeau a.vu-btn { min-height: 44px; padding: 0 14px; font-size: 13px; background: var(--vu-plein); color: var(--vu-plein-encre); border-radius: 11px; position: relative; }
  .maj5 .vu-bandeau a.vu-btn::after { content: ''; position: absolute; inset: -4px 0; }
  .maj5 details > summary { list-style: none; display: inline-flex; align-items: center; min-height: 44px; padding: 0 6px; color: var(--vu-sur); font: 600 13px/1.2 var(--vu-police); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .maj5 details > summary::-webkit-details-marker { display: none; }
  .maj5 ol { margin: 0 0 4px; padding-left: 26px; font-size: 12.5px; color: var(--vu-sur-2); }
  .principal .p-t { display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 6px; font: 600 15px/1.35 var(--vu-police); color: var(--vu-encre); }
  .principal .p-t { justify-content: space-between; }
  .principal .p-t .p-n { font-size: 17px; font-feature-settings: "tnum" 1; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .principal .p-l2 { margin-top: 8px; font: 600 14px/1.35 var(--vu-police); color: var(--vu-encre); font-variant-numeric: tabular-nums; }
  .principal .p-l2:empty { display: none; }
  .principal .p-l2::first-letter { text-transform: uppercase; }
  .principal .p-l2 .p-dans { color: var(--vu-encre); font-weight: 600; }
  .principal .p-pour { margin-top: 2px; }
  .principal .p-t b { font-weight: 700; }
  .principal .p-t .p-dans { color: var(--vu-muet); font-weight: 500; }
  .principal .vu-barre { margin-top: 10px; }
  .principal .p-pour { margin-top: 6px; font: 500 13px/1.4 var(--vu-police); color: var(--vu-muet); }
  .principal .p-pour.ambre { color: var(--vu-ambre); font-weight: 600; }
  .principal .vu-btn { margin-top: 12px; }
  .principal .p-item { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
  .principal .p-item img, .principal .p-item .vig { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; }
  .principal .outils { margin-top: 4px; }
  .contenu > .gestes { padding: 10px !important; }
  .lbc5 > .ligne { padding: 8px 0; }
  .lbc5 > .ligne:first-child { padding-top: 0; border-top: 0; }
  .lbc5 .q4 { margin-top: 8px; }
  .contenu > .gestes > .listes5 { margin-top: 0; }
  .maj5 details:not([open]) > summary { margin-bottom: -4px; }
  .listes5 .vu-seg + .vu-seg { margin-top: 8px; }
  .listes5 .panneau { margin-top: 10px; }
  .listes5 .seg-portee button { font-size: 13px; }
  .fav-t, .lib, .lu, .me, .val.gris, .ap-lbl, .refus, .pied, .detail > summary { color: var(--vu-muet); }
  .val.alerte, .me .ambre, .err { color: var(--vu-ambre); }
  .contenu .b, .connexion .b { min-height: 50px; border-radius: 14px; background: var(--vu-plein-sur-plaque); color: var(--vu-plein-sur-plaque-encre); box-shadow: 0 1px 2px rgb(0 0 0/.18); font: 600 16px/1.2 var(--vu-police); }
  .contenu .b.sec, .contenu .touche, .connexion .b.sec { background: var(--vu-teinte); color: var(--vu-teinte-encre); box-shadow: none; border-radius: 14px; }
  .contenu > .b:not(.sec) { background: var(--vu-plein); color: var(--vu-plein-encre); }
  .contenu > .b.sec { background: rgb(255 255 255/.16); color: var(--vu-sur); border: 0; }
  .outils .lien, .ap-tout .lien, .cx .lien, .cx .oubli, .fav-go, .lien-site.lien-vrm { color: var(--vu-lien); }
  .liens, .rangs, .ap-liste, .bulle, .autre { background: var(--vu-plaque-2); box-shadow: none; }
  .lien-site { color: var(--vu-encre); }
  .plaque { position: relative; height: 24px; padding: 3px 8px 0 13px; background: var(--vu-kraft); color: var(--vu-kraft-encre); border-radius: 3px; line-height: 18px;
    clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%); box-shadow: inset 0 0 0 .5px var(--vu-kraft-bord); font-weight: 700; }
  .plaque::before { content: ''; position: absolute; left: 5px; top: 50%; width: 4px; height: 4px; margin-top: -2px; border-radius: 50%; background: var(--vu-plaque); }
  .plaque i { color: var(--vu-kraft-doux); font-weight: 600; }
  .fermer { color: var(--vu-sur); }
  .fermer:hover { background: rgb(255 255 255/.14); color: var(--vu-sur); }
  .ligne { border-top-color: var(--vu-filet); }
  .detail > summary { padding: 0 2px; }
  .ligne.secu { display: flex; }
  .capte { background: var(--vu-plaque); color: var(--vu-encre); background-image: none; border: 0; box-shadow: var(--vu-ombre); }
  .capte-t { color: var(--vu-muet); }
  .capte-voir { color: var(--vu-lien); }
  @media (prefers-reduced-transparency: reduce) { .carte, .question { background-image: none; } }
  /* ══ 5.407 — LA LISTE DES FAVORIS À COCHER (Julien, 17 nov. : « il faut une liste avec les favoris
     pour pouvoir les sélectionner ») : case 44 px · photo + étiquette N° kraft · titre (2 lignes) /
     qui · quand / état · prix. Une rangée se touche entière ; un favori déjà contacté est grisé
     (la case seulement), sa raison écrite en clair. 300 rangées : content-visibility les saute. */
  .fl-tete { display: flex; align-items: center; gap: 0 8px; flex-wrap: wrap; margin: 2px 2px 6px; }
  .fl-tete .fl-outils { display: flex; gap: 4px; margin-left: auto; }
  .fl-n { font: 600 14px/1.3 var(--vu-police); color: var(--vu-encre); font-variant-numeric: tabular-nums; }
  .fl-suite { display: flex; justify-content: center; padding: 6px 0; content-visibility: visible; }
  .fl-max { font: 500 13px/1.3 var(--vu-police); color: var(--vu-muet); flex: 1 1 auto; min-width: 0; }
  .fl-tete .vu-lien { padding: 0 6px; }
  .fl-filtres { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 8px; }
  .fl-filtres select { flex: 1 1 190px; min-width: 0; min-height: 44px; padding: 0 10px; border: 0; border-radius: 12px; background: var(--vu-plaque-2); color: var(--vu-encre);
    font: 500 14px/1.2 var(--vu-police); text-overflow: ellipsis; cursor: pointer; }
  .fl-puce { flex: 1 0 auto; appearance: none; min-height: 44px; padding: 0 12px; border: 0; border-radius: 12px; background: var(--vu-plaque-2); color: var(--vu-encre);
    font: 600 13px/1.2 var(--vu-police); cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .fl-puce[aria-pressed="true"] { background: var(--vu-teinte); color: var(--vu-teinte-encre); box-shadow: inset 0 0 0 1.5px currentColor; }
  .fl-filtres select:focus-visible, .fl-puce:focus-visible, .fl-case input:focus-visible { outline: none; box-shadow: var(--vu-anneau); }
  .fl-liste { list-style: none; margin: 0 0 8px; padding: 0 2px; border-radius: 16px; background: var(--vu-plaque-2); overflow-y: auto; overscroll-behavior: contain;
    max-height: min(420px, calc(100vh - 620px)); min-height: 150px; }
  .fl-liste > li + li { border-top: 1px solid var(--vu-filet); }
  .fl-l { display: grid; grid-template-columns: 44px 56px minmax(0, 1fr) auto; align-items: center; gap: 0 10px; min-height: 76px; padding: 8px 10px 8px 2px; cursor: pointer;
    content-visibility: auto; contain-intrinsic-size: auto 76px; -webkit-tap-highlight-color: transparent; }
  .fl-l[data-fav-off] { cursor: default; }
  .fl-case { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; cursor: pointer; }
  .fl-case input { width: 22px; height: 22px; margin: 0; accent-color: var(--vu-barre); cursor: pointer; }
  .fl-case input:disabled { cursor: default; }
  .fl-photo { position: relative; width: 56px; height: 56px; }
  .fl-photo .vig, .fl-photo img { display: block; width: 56px; height: 56px; border-radius: 12px; object-fit: cover; background: var(--vu-socle); }
  .fl-l[data-fav-off] .fl-photo .vig, .fl-l[data-fav-off] .fl-photo img { opacity: .6; }
  .fl-photo .vu-n { position: absolute; left: -4px; bottom: -6px; height: 20px; padding: 2px 6px 0 11px; font-size: 12px; line-height: 16px; }
  .fl-photo .vu-n small { font-size: 9px; }
  .fl-photo .vu-n::before { left: 4px; width: 3px; height: 3px; margin-top: -1.5px; }
  .fl-mil { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .fl-ti { font: 600 14px/1.3 var(--vu-police); color: var(--vu-encre); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }
  .fl-me { font: 400 12.5px/1.35 var(--vu-police); color: var(--vu-muet); overflow-wrap: anywhere; }
  .fl-etat { font: 600 12.5px/1.35 var(--vu-police); color: var(--vu-muet); overflow-wrap: anywhere; }
  .fl-px { font: 600 14px/1.3 var(--vu-police); color: var(--vu-encre); text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .fl-mini { display: block; margin-top: 2px; font: 500 12px/1.3 var(--vu-police); color: var(--vu-muet); }
  .fl-sans-mini { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 0; }
  .fl-etat.ambre { color: var(--vu-ambre); }
  .fl-alerte { margin: 0 2px 10px; padding: 10px 12px; border-radius: 14px; background: var(--vu-plaque-2); font: 600 13.5px/1.4 var(--vu-police); color: var(--vu-ambre); }
  .fl-alerte-g { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
  .fl-px s { display: block; font-weight: 400; font-size: 12px; color: var(--vu-muet); }
  .fl-note { margin: 2px 2px 8px; font: 500 13px/1.4 var(--vu-police); color: var(--vu-muet); }
  .fl-note.ambre { color: var(--vu-ambre); font-weight: 600; }
  .fl-vide { padding: 16px 12px; font: 500 14px/1.4 var(--vu-police); color: var(--vu-muet); }
  /* Le récapitulatif : par annonce, le message, la durée au vrai rythme, « Confirmer l'envoi ». */
  .fl-r-t { font: 700 17px/1.25 var(--vu-police); color: var(--vu-encre); letter-spacing: -.01em; margin: 2px 2px 8px; }
  .fl-r-l { list-style: none; margin: 0 0 10px; padding: 0 10px; border-radius: 16px; background: var(--vu-plaque-2); max-height: 220px; overflow-y: auto; }
  .fl-r-l > li { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 0 10px; align-items: center; min-height: 60px; padding: 8px 0; }
  .fl-r-l > li + li { border-top: 1px solid var(--vu-filet); }
  .fl-r-l .vig, .fl-r-l img { width: 44px; height: 44px; border-radius: 10px; object-fit: cover; background: var(--vu-socle); }
  .fl-lbl { margin: 0 2px 4px; font: 600 12.5px/1.35 var(--vu-police); color: var(--vu-muet); }
  .fl-duree { margin: 10px 2px 2px; font: 600 14px/1.4 var(--vu-police); color: var(--vu-encre); font-variant-numeric: tabular-nums; }
  .fl-recap .vu-plein { margin-top: 10px; }
  /* « Envoyer à N favoris » en vue dès l'ouverture : la liste prend la hauteur qui reste (elle défile seule). */
  .fl-pied { padding-top: 2px; }
  .fl-pied .fl-note { margin-top: 0; }
  .fl-recap .fl-retour { display: flex; justify-content: center; margin-top: 2px; }
  /* 5.419 : la feuille « Confirmer l'envoi » — le taux (5/10/15/20 % ou un autre), le message pré-rempli modifiable. */
  .env6-taux { margin: 2px 0 12px; }
  .env6-l { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .env6-seg { flex: 1 1 240px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .env6-seg button { min-height: 44px; font: 600 15px/1 -apple-system, Inter, system-ui, sans-serif; font-variant-numeric: tabular-nums; }
  .env6-libre { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; font: 500 15px/1 -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2, var(--vu-muet)); }
  .env6-libre input { width: 76px; min-height: 44px; box-sizing: border-box; padding: 0 10px; border-radius: 10px; border: 1px solid var(--n-trait, var(--vu-filet)); background: var(--n-carte, var(--vu-plaque)); color: var(--n-encre, var(--vu-encre)); font: 600 16px/1 -apple-system, Inter, system-ui, sans-serif; text-align: right; }
  .env6-libre b { color: var(--n-encre, var(--vu-encre)); font-weight: 600; }
  .env6-taux .fl-note { margin: 6px 2px 0; }
  .env6-msg { margin-top: 4px; }
  .env6-msg .bulle { margin: 0 0 6px; max-height: 180px; background: var(--n-carte, var(--vu-plaque)); color: var(--n-encre, var(--vu-encre)); border: 1px solid var(--n-trait, var(--vu-filet)); border-radius: 14px 14px 14px 6px; padding: 10px 14px; font-size: 15px; line-height: 21px; }
  .env6-msg textarea { display: block; width: 100%; box-sizing: border-box; min-height: 96px; resize: vertical; margin-top: 6px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--n-trait, var(--vu-filet)); background: var(--n-carte, var(--vu-plaque)); color: var(--n-encre, var(--vu-encre)); font: 400 16px/22px -apple-system, Inter, system-ui, sans-serif; }
  .env6-msg > .vu-lien { min-height: 44px; }
  .env6-g { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin-top: 4px; }
  .env6-g .vu-btn, .env6-g .vu-lien { min-height: 44px; }
  .fl-r-l .fl-px s { color: var(--n-encre-2, var(--vu-muet)); font-weight: 400; margin-right: 2px; }
  .fl-r-l .fl-etat.ambre { color: var(--n-ambre, var(--vu-ambre)); }

  /* ══ 5.409 — LE GRAND PANNEAU (Julien, 19 nov. : « je veux que l'extension prenne tout l'écran, ou une très
     grosse partie de l'écran sur Vinted, beaucoup plus visuel et compréhensible ») : sur vinted.fr, connecté,
     la carte devient un panneau de 76 % de la largeur (1100 px au plus) à l'ordinateur, PLEIN ÉCRAN au
     téléphone ; design natif (docs/design/NATIF.md : fond #F2F2F7 / #000, cartes blanches / #1C1C1E, accent
     accent rare). 5.419 : accent vert sapin (#0F6B4C / nuit #3FD49A), plein = encre, plus aucun bleu. Les jetons --vu-* sont redéfinis DANS le panneau : les pièces existantes le suivent. */
  .carte[data-grand] { --n-fond:#F2F2F7; --n-carte:#FFFFFF; --n-carte-2:#F2F2F7; --n-trait:rgb(60 60 67/.18); --n-encre:#111114; --n-encre-2:#6C6C70; --n-accent:#0F6B4C; --n-teinte:rgb(15 107 76/.10); --n-neutre:rgb(118 118 128/.12); --n-vert:#1F7A3A; --n-vert-fond:#E6F4EA; --n-teal:#2C6E73; --n-teal-fond:#E3F1F1;
    --vu-coque-uni:var(--n-fond); --vu-coque:none; --vu-sur:var(--n-encre); --vu-sur-2:var(--n-encre-2); --vu-plaque:var(--n-carte); --vu-plaque-2:var(--n-carte-2); --vu-encre:var(--n-encre); --vu-muet:var(--n-encre-2);
    --vu-filet:var(--n-trait); --vu-ombre:none; --vu-plein:#111114; --vu-plein-appui:#2C2C2E; --vu-plein-encre:#FFFFFF; --vu-plein-sur-plaque:#111114; --vu-plein-sur-plaque-encre:#FFFFFF;
    --vu-teinte:var(--n-neutre); --vu-teinte-encre:var(--n-encre); --vu-lien:var(--n-encre); --vu-socle:#E5E5EA; --vu-barre:var(--n-accent); --vu-ambre:#8A4B00;
    position: fixed; top: 4vh; bottom: 4vh; right: 2vw; left: auto; width: min(1100px, 76vw) !important; max-height: none; height: auto; border-radius: 16px; border: 0;
    padding: 12px 20px 20px; background: var(--n-fond) !important; color: var(--n-encre); box-shadow: 0 8px 30px rgb(0 0 0/.12), 0 0 0 100vmax rgb(0 0 0/.28); overflow-y: auto; overscroll-behavior: contain; }
  @media (prefers-color-scheme: dark) { :host(:not([data-theme="clair"])) .carte[data-grand] { --n-fond:#000000; --n-carte:#1C1C1E; --n-carte-2:#2C2C2E; --n-trait:rgb(84 84 88/.6); --n-encre:#FFFFFF; --n-encre-2:#98989F; --n-accent:#3FD49A; --n-teinte:rgb(63 212 154/.16); --n-neutre:rgb(118 118 128/.24); --n-vert:#7FD39A; --n-vert-fond:rgb(48 209 88/.16); --n-teal:#7CC9CE; --n-teal-fond:rgb(124 201 206/.16); --vu-plein:#F2F2F7; --vu-plein-appui:#D1D1D6; --vu-plein-encre:#111114; --vu-plein-sur-plaque:#F2F2F7; --vu-plein-sur-plaque-encre:#111114; --vu-teinte-encre:var(--n-encre); --vu-lien:var(--n-encre); --vu-socle:#2C2C2E; --vu-barre:var(--n-accent); --vu-ambre:#FFB340; } }
  :host([data-theme="sombre"]) .carte[data-grand] { --n-fond:#000000; --n-carte:#1C1C1E; --n-carte-2:#2C2C2E; --n-trait:rgb(84 84 88/.6); --n-encre:#FFFFFF; --n-encre-2:#98989F; --n-accent:#3FD49A; --n-teinte:rgb(63 212 154/.16); --n-neutre:rgb(118 118 128/.24); --n-vert:#7FD39A; --n-vert-fond:rgb(48 209 88/.16); --n-teal:#7CC9CE; --n-teal-fond:rgb(124 201 206/.16); --vu-plein:#F2F2F7; --vu-plein-appui:#D1D1D6; --vu-plein-encre:#111114; --vu-plein-sur-plaque:#F2F2F7; --vu-plein-sur-plaque-encre:#111114; --vu-teinte-encre:var(--n-encre); --vu-lien:var(--n-encre); --vu-socle:#2C2C2E; --vu-barre:var(--n-accent); --vu-ambre:#FFB340; }
  @media (max-width: 760px) { .carte[data-grand] { top: 0; bottom: 0; right: 0; left: 0; width: 100vw !important; height: 100dvh; border-radius: 0; padding: max(8px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); box-shadow: none; } }
  /* 5.410.2 : l'ambre (un geste à faire) défini dans les deux teintes — en sombre, #8A4B00 sur #1C1C1E ne se lisait pas. */
  .carte[data-grand] { --n-ambre: #8A4B00; --n-ambre-fond: #FFF4DD; }
  @media (prefers-color-scheme: dark) { :host(:not([data-theme="clair"])) .carte[data-grand] { --n-ambre: #FFB340; --n-ambre-fond: rgb(255 159 10 / .18); } }
  :host([data-theme="sombre"]) .carte[data-grand] { --n-ambre: #FFB340; --n-ambre-fond: rgb(255 159 10 / .18); }
  .carte[data-grand] .t5 { min-height: 52px; }
  .carte.on[data-grand] ~ .btn { display: none !important; }   /* 5.410.2 : le rond VRM ne recouvre plus le coin du panneau (son × ferme) */
  .carte[data-grand] .t5 .nom { font: 700 28px/34px -apple-system, "SF Pro Display", Inter, system-ui, sans-serif; max-width: 70%; color: var(--n-encre); }
  .carte[data-grand] .fermer { position: sticky; float: right; top: 0; width: 44px; height: 44px; border-radius: 22px; background: var(--n-carte-2); color: var(--n-encre); font-size: 22px; z-index: 2; }
  .carte[data-grand] .contenu > :not(.tete):not(.fermer):not(.b):not(style) { border-radius: 12px; }
  .carte[data-grand] .contenu > .gestes { background: transparent !important; padding: 0 !important; }
  .carte[data-grand] .listes5 { background: transparent; }
  .carte[data-grand] .seg5 { position: sticky; top: 0; z-index: 1; background: var(--vu-socle); grid-template-columns: repeat(4, minmax(0,1fr)) 52px; grid-auto-flow: row; }
  .carte[data-grand] .seg5 button { font-size: 15px; }
  .carte[data-grand] .reg5 { display: flex; align-items: center; justify-content: center; }
  .carte[data-grand] .panneau { margin-top: 12px; background: var(--n-carte); border-radius: 12px; padding: 4px 0; }
  .carte[data-grand] .panneau > .lu, .carte[data-grand] .panneau > .val { padding: 10px 16px; }
  .carte[data-grand] .rangs { max-height: none !important; overflow: visible; margin: 0; padding: 0; }
  .carte[data-grand] .rangs > li + li { border-top: .5px solid var(--n-trait); }
  .carte[data-grand] .rang { min-height: 72px; padding: 8px 16px; width: 100%; text-align: left; background: transparent; border: 0; font: inherit; color: inherit; cursor: pointer; display: flex; align-items: center; gap: 12px; text-decoration: none; }
  .carte[data-grand] .rang .vig { width: 56px; height: 56px; border-radius: 10px; flex: none; object-fit: cover; background: var(--n-carte-2); }
  .carte[data-grand] .rang .ti { font: 600 17px/22px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); }
  .carte[data-grand] .rang .me { font: 400 15px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .carte[data-grand] .rang .px { font: 600 17px/22px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); font-variant-numeric: tabular-nums; }
  .carte[data-grand] .rang .px.quand { font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  .carte[data-grand] .rang.nonlu .ti { font-weight: 700; }
  .pt5 { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--n-accent, #0F6B4C); margin-right: 6px; vertical-align: middle; }
  .carte[data-grand] li[data-ouverte] > .rang { background: var(--n-neutre); }
  .fiche5 { padding: 4px 16px 16px; }
  .ph5 { display: flex; gap: 8px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 8px 0; }
  .ph5 img { flex: none; height: 240px; max-width: 80%; border-radius: 12px; object-fit: cover; scroll-snap-align: start; background: var(--n-carte-2); }
  @media (max-width: 760px) { .ph5 img { height: 200px; } }
  .g5 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 1px; background: var(--n-trait); border-radius: 12px; overflow: hidden; margin-top: 8px; }
  @media (max-width: 760px) { .g5 { grid-template-columns: repeat(2, minmax(0,1fr)); } }
  .f5 { background: var(--n-carte-2); padding: 10px 12px; min-height: 60px; }
  .f5 span { display: block; font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  .f5 b { display: block; font: 600 17px/22px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .desc5 { margin: 12px 0 0; font: 400 15px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); white-space: pre-line; }
  .ge5 { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .ge5 .vu-btn { min-height: 44px; padding: 0 16px; border-radius: 12px; text-decoration: none; font: 600 15px/1 -apple-system, Inter, system-ui, sans-serif; }
  .par5 { padding: 4px 16px 12px; }
  .grp5 + .grp5, .par5 > .detail { margin-top: 18px; }
  .grp5 h3 { margin: 8px 0 4px; font: 600 13px/18px -apple-system, Inter, system-ui, sans-serif; text-transform: uppercase; letter-spacing: .02em; color: var(--n-encre-2); }
  .note5 { margin: 0 0 4px; font: 400 15px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  .rg5 { display: flex; align-items: center; justify-content: space-between; min-height: 44px; color: var(--n-encre); text-decoration: none; font: 400 17px/22px -apple-system, Inter, system-ui, sans-serif; border-top: .5px solid var(--n-trait); }
  .rg5 i { color: var(--n-encre-2); font-style: normal; font-size: 22px; }
  .etapes5 { display: flex; gap: 6px; list-style: none; margin: 4px 16px 8px; padding: 0; counter-reset: e5; }
  .etapes5 li { flex: 1; min-width: 0; font: 600 12px/16px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); border-top: 3px solid var(--vu-socle); padding-top: 6px; }
  .etapes5 li::before { counter-increment: e5; content: counter(e5) " · "; }
  .etapes5 li[data-fait] { border-color: var(--n-accent); }
  .etapes5 li[aria-current] { color: var(--n-encre); border-color: var(--n-accent); }
  .guide5 { margin: 0 16px 8px; font: 600 17px/22px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); }

  /* 5.409 — à l'ordinateur, le grand panneau prend la forme de l'outil de référence : les onglets en BARRE LATÉRALE à
     gauche, la liste au centre ; Messages en deux volets (liste · conversation). Au téléphone : la liste empilée. */
  @media (min-width: 1024px) {
    .carte[data-grand] .listes5 { display: grid; grid-template-columns: 210px minmax(0,1fr); gap: 16px; align-items: start; }
    .carte[data-grand] .seg5 { grid-template-columns: none; grid-auto-flow: row; grid-auto-rows: 44px; background: transparent; padding: 0; gap: 2px; top: 0; }
    .carte[data-grand] .seg5 button { justify-content: flex-start; text-align: left; padding: 0 12px; border-radius: 10px; color: var(--n-encre); display: flex; align-items: center; }
    .carte[data-grand] .seg5 button[aria-selected="true"] { background: var(--n-carte); color: var(--n-encre); box-shadow: 0 1px 2px rgb(0 0 0/.12); }
    .carte[data-grand] .panneau { margin-top: 0; }
    .carte[data-grand] .reg5 { justify-content: flex-start !important; }
    .deux5 { display: grid; grid-template-columns: minmax(280px, 380px) minmax(0,1fr); min-height: 60vh; }
    .gauche5 { border-right: .5px solid var(--n-trait); }
    .conv5-sous { display: none; }
  }
  @media (max-width: 1023px) { .volet5 { display: none; } }
  .outils5 { display: flex; gap: 8px; padding: 8px 12px; align-items: center; }
  .cherche5 { flex: 1; min-width: 0; min-height: 44px; border-radius: 10px; border: 0; background: var(--n-carte-2); color: var(--n-encre); padding: 0 12px; font: 400 17px/22px -apple-system, Inter, system-ui, sans-serif; }
  .filtre5 { min-height: 44px; padding: 0 12px; border-radius: 10px; border: 0; background: var(--n-carte-2); color: var(--n-encre); font: 600 15px/1 -apple-system, Inter, system-ui, sans-serif; white-space: nowrap; cursor: pointer; }
  .filtre5[aria-pressed="true"] { background: var(--n-neutre); color: var(--n-encre); box-shadow: inset 0 0 0 1px var(--n-trait); }
  .volet5 { padding: 16px; }
  .vide5 { display: grid; place-content: center; text-align: center; gap: 6px; min-height: 50vh; color: var(--n-encre-2); font: 400 15px/20px -apple-system, Inter, system-ui, sans-serif; }
  .vide5 b { color: var(--n-encre); font: 600 17px/22px -apple-system, Inter, system-ui, sans-serif; }
  .conv5 { padding: 8px 0; }
  .conv5-ph { width: 120px; height: 120px; border-radius: 12px; object-fit: cover; }
  .rr5 { margin: 8px 0; display: grid; gap: 6px; }
  .rr5 small, .rr5-ia { color: var(--n-encre-2, #6E6E73); font-size: 12px; line-height: 16px; }
  .rr5-t { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .rr5-t b { font-size: 13px; color: var(--n-encre, #111114); }
  .rr5-p { border-top: 1px solid var(--n-trait, rgb(60 60 67/.18)); padding: 8px 0 2px; }
  .rr5-p p { margin: 2px 0 6px; font-size: 14px; line-height: 19px; color: var(--n-encre, #111114); white-space: pre-wrap; }
  .rr5-c { display: block; font-size: 12px; color: var(--n-encre-2, #6E6E73); }
  .lot5 { margin: 0 16px 12px; }
  .carte .lot5 .rang .me, .carte [data-rel] .rang .me, .carte [data-ag-decisions] .rang .me { white-space: normal; overflow: visible; text-overflow: clip; }
  .lot5-t { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin: 4px 0; }
  .lot5 [data-ambre], .rangs [data-ambre], .note5[data-ambre] { color: var(--n-ambre, #8A4B00); }
  .ag5-g { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 6px 0 10px; }
  @media (max-width: 520px) { .ag5-g { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .ag5-t { border: 1px solid var(--n-trait, rgb(60 60 67/.18)); border-radius: 10px; padding: 8px 10px; display: grid; }
  .ag5-t b { font: 600 20px/24px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre, #111114); }
  .ag5-t span { font-size: 12px; color: var(--n-encre-2, #6E6E73); }
  .conv5-t { display: flex; align-items: baseline; gap: 8px; margin: 8px 0; color: var(--n-encre); }
  .conv5-t b { font: 600 17px/22px -apple-system, Inter, system-ui, sans-serif; }
  .conv5-t span { color: var(--n-encre-2); font-size: 13px; }
  .conv5 .bulle { background: var(--n-carte-2); color: var(--n-encre); border-radius: 16px; padding: 10px 14px; font: 400 17px/22px -apple-system, Inter, system-ui, sans-serif; max-width: 520px; }
  .conv5-sous { padding: 0 16px 12px; }
  /* 5.412 : le fil Vestiaire (bulles de la personne à gauche, les tiennes à droite, la plus récente en bas). */
  .fil5 { display: flex; flex-direction: column; gap: 8px; max-height: 360px; overflow-y: auto; padding: 4px 0; }
  .fil5 .bulle { max-height: none; align-self: flex-start; }
  .fil5 .bulle.moi { align-self: flex-end; }
  .fil5 .bulle small { display: block; color: var(--n-encre-2); font-size: 12px; line-height: 16px; margin-bottom: 2px; }

  .carte[data-grand] .reg5 .lib5 { display: none; }
  @media (min-width: 1024px) { .carte[data-grand] .reg5 { gap: 10px; } .carte[data-grand] .reg5 .lib5 { display: inline; } }
  @media (max-width: 760px) { .carte[data-grand] .seg5 button { font-size: 13px; padding: 0 2px; } .carte[data-grand] .seg5 { grid-template-columns: repeat(4, minmax(0,1fr)) 44px; } }
  /* Le grand panneau a ses onglets : les liens « Messages › » de la petite carte n'y sont pas redits. */
  .carte[data-grand] .contenu > .liens { display: none; }

  @media (max-width: 760px) { .etapes5 li:not([aria-current]) { font-size: 0; } .etapes5 li:not([aria-current])::before { font-size: 12px; content: counter(e5); } }

  /* 5.409 — Annonces (barre d'action, statuts, colonnes, liste / grille), Automatisations, Notifications, réponse. */
  .barre5 { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 12px; }
  .act5 { min-height: 44px; border-radius: 10px; border: 0; background: var(--n-carte-2); color: var(--n-encre); padding: 0 12px; font: 600 15px/1 -apple-system, Inter, system-ui, sans-serif; max-width: 100%; }
  .act5:disabled { color: var(--n-encre-2); }
  .barre5 .cherche5 { flex: 1 1 200px; }
  .vue5 { min-width: 160px; }
  .vue5 button { font-size: 14px; }
  .cols5 { position: relative; }
  .cols5 > summary { list-style: none; min-height: 44px; display: inline-flex; align-items: center; padding: 0 12px; border-radius: 10px; background: var(--n-carte-2); color: var(--n-encre); font: 600 15px/1 -apple-system, Inter, system-ui, sans-serif; cursor: pointer; }
  .cols5 > summary::-webkit-details-marker { display: none; }
  .cols5 > summary::after { content: '▾'; margin-left: 6px; font-size: 12px; opacity: .7; }
  .cols5-l { position: absolute; z-index: 3; right: 0; top: 48px; min-width: 200px; background: var(--n-carte); border-radius: 12px; box-shadow: 0 8px 30px rgb(0 0 0/.18); padding: 6px; display: grid; }
  .cols5-l label { min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 10px; color: var(--n-encre); font: 400 15px/1 -apple-system, Inter, system-ui, sans-serif; }
  .chips5 { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 12px 8px; }
  .chip5 { min-height: 36px; padding: 0 12px; border-radius: 18px; border: 0; background: var(--n-carte-2); color: var(--n-encre); font: 600 14px/1 -apple-system, Inter, system-ui, sans-serif; cursor: pointer; position: relative; }
  .chip5::after { content: ''; position: absolute; inset: -4px 0; }
  .chip5[aria-pressed="true"] { background: var(--n-neutre); color: var(--n-encre); box-shadow: inset 0 0 0 1px var(--n-trait); }
  .tr5 { display: grid; grid-template-columns: 44px minmax(220px, 2fr) minmax(0, 5fr); align-items: center; gap: 0 8px; padding: 0 8px; }
  .tr5 .cels5 { display: grid; grid-template-columns: repeat(var(--n5, 4), minmax(56px, 1fr)); gap: 0 8px; align-items: center; }
  .th5 { min-height: 36px; font: 600 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); border-bottom: .5px solid var(--n-trait); }
  .case5 { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; }
  .case5 input, .tout5 input, .cols5-l input { width: 20px; height: 20px; accent-color: var(--n-accent); }
  .tout5 { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; color: var(--n-encre); }
  .carte[data-grand] .art5 { padding: 8px 0; min-height: 72px; }
  .cel5 { font: 400 15px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); font-variant-numeric: tabular-nums; }
  .lc5 { display: none; }
  .st5 { display: inline-block; padding: 2px 8px; border-radius: 6px; background: var(--n-carte-2); color: var(--n-encre-2); font: 600 13px/18px -apple-system, Inter, system-ui, sans-serif; }
  .st5[data-statut="nouveau"] { background: var(--n-ambre-fond, #FFF4DD); color: var(--n-ambre, #8A4B00); }
  li[data-coche] > .tr5, li[data-coche] > .case5 { background: var(--n-neutre); }
  @media (max-width: 760px) {
    .th5 { display: none; }
    .tr5 { grid-template-columns: 44px minmax(0, 1fr); }
    .tr5 .cels5 { grid-column: 2; display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 0 0 10px 68px; }
    .lc5 { display: inline; font-style: normal; color: var(--n-encre-2); font-size: 13px; margin-right: 4px; }
    .cel5 { font-size: 14px; }
    .carte[data-grand] .seg5 { display: flex; overflow-x: auto; scrollbar-width: none; }
    .carte[data-grand] .seg5 button { flex: 0 0 auto; padding: 0 12px; }
  }
  .grille5 { list-style: none; margin: 0; padding: 8px 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
  .grille5 li { position: relative; }
  .grille5 .case5 { position: absolute; top: 4px; left: 4px; z-index: 1; background: rgb(255 255 255/.85); border-radius: 10px; }
  .carte5 { appearance: none; border: 0; width: 100%; padding: 0; background: var(--n-carte-2); border-radius: 12px; overflow: hidden; text-align: left; color: var(--n-encre); cursor: pointer; display: grid; }
  .carte5 img, .carte5 .vig { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
  .carte5 .ti { padding: 8px 10px 0; font: 600 15px/20px -apple-system, Inter, system-ui, sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .carte5 .me { padding: 2px 10px 10px; font: 400 14px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  .au5 { background: var(--n-carte); border-radius: 12px; padding: 4px 0 12px; }
  .au5 + .au5 { margin-top: 16px; }
  .au5-t { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .au5-t h3 { margin: 8px 0; font: 600 17px/22px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); text-transform: none; letter-spacing: 0; }
  .et5 { padding: 2px 10px; border-radius: 6px; font: 600 13px/20px -apple-system, Inter, system-ui, sans-serif; background: var(--n-carte-2); color: var(--n-encre-2); }
  .et5[data-etat="on"] { background: var(--n-vert-fond); color: var(--n-vert); }
  .rg5-l b { font-weight: 600; color: var(--n-encre); text-align: right; }
  .rg5-l span { color: var(--n-encre); }
  .trn5 { grid-template-columns: minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 1fr) 24px; min-height: 52px; text-decoration: none; color: var(--n-encre); }
  .trn5 .ti { font: 600 15px/20px -apple-system, Inter, system-ui, sans-serif; }
  .chev5 { color: var(--n-encre-2); }
  @media (max-width: 760px) { .trn5 { grid-template-columns: minmax(0, 1fr) auto auto 16px; } .notif5 .th5 { display: none; } }
  .rep5 textarea { width: 100%; box-sizing: border-box; margin-top: 12px; min-height: 88px; border-radius: 12px; border: 0; background: var(--n-carte-2); color: var(--n-encre); padding: 10px 12px; font: 400 17px/22px -apple-system, Inter, system-ui, sans-serif; resize: vertical; }
  .rep5 .err, .rep5 .val { margin-top: 8px; }

  /* 5.420 : le parcours en étapes des favoris, Favoris → Statistiques, la santé des comptes, l'automatique. */
  .et10 { list-style: none; display: flex; gap: 4px; margin: 0 0 6px; padding: 0; counter-reset: none; }
  .et10 li { flex: 1 1 0; display: flex; align-items: center; gap: 6px; min-width: 0; padding: 8px 6px; border-bottom: 2px solid var(--n-trait, #E5E5EA); color: var(--n-encre-2, #6E6E73); font: 600 13px/16px -apple-system, Inter, system-ui, sans-serif; }
  .et10 li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .et10 li i { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--n-carte-2, #F2F2F7); font-style: normal; font-size: 12px; }
  .et10 li[aria-current="step"] { color: var(--n-encre, #111114); border-bottom-color: var(--n-encre, #111114); }
  .et10 li[aria-current="step"] i { background: var(--n-encre, #111114); color: var(--n-fond, #fff); }
  .et10 li[data-fait] i { background: var(--n-accent, #0F6B4C); color: #fff; }
  @media (max-width: 560px) { .et10 li:not([aria-current]) { flex: 0 0 auto; } .et10 li:not([aria-current]) span { display: none; } .et10 li[aria-current] { flex: 1 1 auto; } }
  .et10-n { margin: 0 0 10px; color: var(--n-encre-2, #6E6E73); font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; }
  .et10-pied { display: flex; gap: 8px; justify-content: space-between; margin-top: 12px; }
  .et10-pied .vu-btn { min-height: 44px; padding: 0 16px; border-radius: 12px; }
  .et10-pied .vu-plein { flex: 1 1 auto; }
  .et10-sel li { display: flex; align-items: center; gap: 10px; }
  .et10-sel .vu-lien, .et10-v .pu6, .et10-v .vu-lien { min-height: 44px; }
  .et10-qui { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 8px; font: 600 14px/18px -apple-system, Inter, system-ui, sans-serif; }
  .et10-qui .rond6 { min-width: 44px; min-height: 44px; }
  .et10-v { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
  .et10-v .pu6 { padding: 0 14px; border-radius: 22px; border: 1px solid var(--n-trait, #E5E5EA); background: var(--n-carte, #fff); color: var(--n-encre, #111114); font: 600 14px/1 -apple-system, Inter, system-ui, sans-serif; }
  .et10-v .pu6[aria-pressed="true"] { background: var(--n-carte-2, #F2F2F7); border-color: var(--n-encre, #111114); }
  .et10-r { list-style: none; margin: 0 0 10px; padding: 0; }
  .et10-r li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--n-trait, #E5E5EA); font: 400 15px/20px -apple-system, Inter, system-ui, sans-serif; }
  .et10-r li span { color: var(--n-encre-2, #6E6E73); flex: none; }
  .et10-r li b { text-align: right; font-weight: 600; overflow-wrap: anywhere; }
  .et10-sautes { margin-top: 8px; font: 400 14px/20px -apple-system, Inter, system-ui, sans-serif; }
  .et10-sautes summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; color: var(--n-encre-2, #6E6E73); }
  .st10 { padding: 0 16px 16px; }
  .st10 .tuiles6 { margin: 10px 0; }
  .st10 .st10-l { display: grid; grid-template-columns: 1fr repeat(4, auto); gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--n-trait, #E5E5EA); font: 400 14px/18px -apple-system, Inter, system-ui, sans-serif; }
  .st10 .st10-l .lc5 { display: block; font-style: normal; font-size: 11px; color: var(--n-encre-2, #6E6E73); }
  .st10 .seg6 button { min-height: 44px; }
  .auto10 { margin: 0 0 8px; padding: 6px 16px; }
  .auto10 .vu-btn, .sa10 .vu-btn { min-height: 44px; }
  /* 5.455.8 : l'agent des favoris — un interrupteur (la rangée entière se touche), la ligne en direct, le journal. */
  .rg6.ag6, .carte .rg6.ag6 { display: block !important; padding: 8px 16px; }
  .ag6-int { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 8px 0; background: none; border: 0; text-align: left; color: inherit; font: inherit; cursor: pointer; }
  .ag6-t { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .ag6-t small { color: var(--n-encre-2, #6C6C70); overflow-wrap: anywhere; }
  .ag6-i { flex: none; position: relative; width: 51px; height: 31px; border-radius: 16px; background: var(--n-neutre, rgb(118 118 128/.24)); transition: background .2s; }
  .ag6-i::after { content: ''; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgb(0 0 0/.2); transition: transform .2s; }
  .ag6-int[aria-checked="true"] .ag6-i { background: var(--n-accent, #0F6B4C); }
  .ag6-int[aria-checked="true"] .ag6-i::after { transform: translateX(20px); }
  .ag6-conf { margin: 4px 0 8px; padding: 10px 12px; border-radius: 12px; background: var(--n-carte-2, #F2F2F7); }
  .ag6-conf p { margin: 0 0 8px; }
  .ag6-b { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0; }
  .ag6-l { margin: 6px 0 2px; } .ag6-l b { display: inline; }
  .ag6-j summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; }
  .ag6-j ul { margin: 0; padding-left: 18px; }
  .ag6-j li { margin: 4px 0; overflow-wrap: anywhere; }
  @media (prefers-reduced-motion: reduce) { .ag6-i, .ag6-i::after { transition: none; } }
  .conf5 { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 12px 8px; padding: 10px 12px; border-radius: 12px; background: var(--n-carte-2); color: var(--n-encre); font: 600 15px/20px -apple-system, Inter, system-ui, sans-serif; }
  .conf5 span { flex: 1 1 200px; }
  .conf5 .vu-btn { min-height: 44px; padding: 0 16px; border-radius: 12px; }

  /* ══ 5.410 — LE GRAND PANNEAU (Julien, 20 nov. : « tu fais pareil que [l’outil qu’il cite] ») : presque plein écran à
     l'ordinateur, barre latérale fixe 232 px (réductible à 64), en-tête 56, la page en tableau sur fond blanc, filets fins,
     étiquettes douces neutres (ambre = à faire), accent bleu rare. Jamais de rouge, de vert vif ni de violet. */
  .carte[data-grand] { top: 12px !important; bottom: 12px !important; left: 12px !important; right: 12px !important; width: auto !important; padding: 0 !important; overflow: hidden !important; border-radius: 14px; }
  .carte[data-grand] .contenu { height: 100%; }
  .carte[data-grand] .contenu > .vx6 { background: transparent !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; border-radius: 0 !important; height: 100%; }
  .vx6 { display: grid; grid-template-columns: 232px minmax(0, 1fr); height: 100%; color: var(--n-encre); font: 400 15px/20px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif; }
  .vx6[data-reduit] { grid-template-columns: 64px minmax(0, 1fr); }
  .side6 { display: flex; flex-direction: column; gap: 2px; padding: 14px 10px; background: var(--n-fond); border-right: .5px solid var(--n-trait); overflow-y: auto; }
  .marque6 { display: flex; align-items: center; gap: 8px; padding: 2px 10px 12px; font: 700 17px/22px -apple-system, Inter, system-ui, sans-serif; }
  .marque6 img { border-radius: 6px; }
  .grp6 { padding: 14px 12px 4px; font: 600 12px/16px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  .nav6 { appearance: none; border: 0; background: transparent; display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 0 12px; border-radius: 10px; color: var(--n-encre); font: 500 15px/20px -apple-system, Inter, system-ui, sans-serif; cursor: pointer; text-align: left; width: 100%; }
  .nav6:hover { background: rgb(127 127 127 / .08); }
  .nav6[aria-current="page"] { background: var(--n-teinte); color: var(--n-accent); font-weight: 600; }
  .nav6:focus-visible, .th6:focus-visible, .rond6:focus-visible, .maj6:focus-visible { outline: 2px solid var(--n-accent); outline-offset: 1px; }
  .ico6 { flex: none; }
  .bas6 { margin-top: auto; padding-top: 10px; border-top: .5px solid var(--n-trait); }
  .vx6[data-reduit] .nav6 span, .vx6[data-reduit] .grp6, .vx6[data-reduit] .marque6 b { display: none; }
  .vx6[data-reduit] .nav6 { justify-content: center; padding: 0; }
  .main6 { display: flex; flex-direction: column; min-width: 0; background: var(--n-carte); }
  .tete6 { display: flex; align-items: center; gap: 10px; min-height: 56px; padding: 8px 16px; border-bottom: .5px solid var(--n-trait); }
  .tete6 h1 { margin: 0; font: 700 20px/26px -apple-system, "SF Pro Display", Inter, system-ui, sans-serif; color: var(--n-encre); }
  .compte6 { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 4px; border-radius: 999px; border: .5px solid var(--n-trait); font: 500 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  .compte6 i { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--n-teinte); color: var(--n-accent); font: 700 11px/1 -apple-system, Inter, system-ui, sans-serif; font-style: normal; }
  .esp6 { flex: 1; }
  .rond6 { appearance: none; border: 0; background: transparent; width: 44px; height: 44px; border-radius: 10px; display: inline-grid; place-items: center; color: var(--n-encre-2); cursor: pointer; font-size: 22px; position: static !important; float: none !important; }
  .rond6:hover { background: rgb(127 127 127 / .10); }
  .maj6 { appearance: none; display: inline-flex; align-items: center; gap: 8px; min-height: 44px; min-width: 44px; justify-content: center; padding: 0 14px; border-radius: 10px; border: .5px solid var(--n-trait); background: var(--n-carte); color: var(--n-encre); font: 500 14px/1 -apple-system, Inter, system-ui, sans-serif; cursor: pointer; }
  .corps6 { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 0 0 24px; }
  .corps6 .gestes, .corps6 .listes5, .corps6 .panneau { background: transparent !important; padding: 0 !important; margin: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
  .corps6 .seg5 { display: none !important; }
  .vx6 input[type=checkbox] { accent-color: var(--n-accent); }
  @media (prefers-color-scheme: dark) { .vx6 { color-scheme: dark; } }
  .corps6 .listes5 { display: block !important; grid-template-columns: none !important; }
  .corps6 .listes5 > .panneau { width: auto !important; max-width: none !important; }
  .vx6 { grid-template-rows: minmax(0, 1fr); }
  .vx6 > .side6, .vx6 > .main6 { min-height: 0; }
  .main6 { overflow: hidden; }
  .ext6 { margin: 12px 16px 0; }
  .ext6 > * { margin: 0 !important; border-radius: 12px; }
  .barre6 { padding: 14px 16px; border-bottom: .5px solid var(--n-trait); gap: 10px; }
  .barre6 .act5 { min-width: 200px; }
  .barre6 .cherche5 { max-width: 420px; }
  .statut6 .cols5-l label { justify-content: space-between; }
  .statut6 .cols5-l label span { flex: 1; }
  .statut6 .cols5-l b { color: var(--n-encre-2); font-weight: 600; font-variant-numeric: tabular-nums; }
  .statut6 .cols5-l { left: 0; right: auto; }
  .n6 { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px 8px; color: var(--n-encre-2); font: 400 14px/20px -apple-system, Inter, system-ui, sans-serif; }
  .n6-d { display: inline-flex; align-items: center; gap: 8px; }
  .n6 .vue5 { min-width: 0; }
  .n6 .vue5 button { min-width: 44px; font-size: 16px; }
  .table6 { margin: 0 16px; border-radius: 12px; overflow: hidden; background: var(--n-carte); }   /* NATIF §1 bis : un groupe blanc, sans filet */
  .table6 .rangs { margin: 0; padding: 0; list-style: none; }
  .table6 .rangs > li + li { border-top: .5px solid var(--n-trait); }
  .corps6 .table5 { margin: 0 16px; border: .5px solid var(--n-trait); border-radius: 12px; overflow: hidden; }
  .corps6 .table5 .rangs > li, .table6 .rangs > li, .corps6 .gauche5 .rangs > li, .corps6 .gauche5 .rang { background: var(--n-carte) !important; }
  .corps6 .gauche5 .rang[aria-current="true"], .corps6 .gauche5 li[data-ouverte] > .rang { background: var(--n-neutre) !important; }
  .table6 .rangs > li:hover { background: rgb(127 127 127 / .05) !important; }
  .tr6 { display: grid; grid-template-columns: 44px minmax(220px, 1fr) minmax(0, max-content) 44px; align-items: center; gap: 0 12px; padding: 0 8px; min-height: 64px; }
  .tr6 .cels6 { display: grid; grid-template-columns: var(--g6, repeat(var(--n6, 4), minmax(92px, auto))); gap: 0 12px; align-items: center; }
  .cel6 { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .th6-fixe { cursor: default; }
  .cel6[data-col="bordereau"] { white-space: normal; } .cel6 .pas6 { display: block; line-height: 16px; }
  .th6r { min-height: 44px; background: var(--n-carte); border-bottom: .5px solid var(--n-trait); }
  .th6 { appearance: none; border: 0; background: transparent; display: inline-flex; align-items: center; justify-content: flex-end; gap: 4px; min-height: 44px; padding: 0; font: 500 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); cursor: pointer; text-align: right; }
  .th6r > .th6 { justify-content: flex-start; }
  .th6 i { font-style: normal; font-size: 11px; opacity: .7; }
  .th6[aria-sort="ascending"], .th6[aria-sort="descending"] { color: var(--n-encre); }
  .art6 { appearance: none; border: 0; background: transparent; display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 8px 0; text-align: left; color: var(--n-encre); cursor: pointer; font: inherit; min-width: 0; }
  .art6 .vig { width: 48px; height: 48px; border-radius: 8px; flex: none; object-fit: cover; background: var(--n-carte-2); }
  .art6 .ti { font: 400 15px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .art6 .st6 { display: block; font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cel6 { text-align: right; font: 400 15px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .cel6 b { font-weight: 600; }
  .cel6[data-col="statut"], .cel6[data-col="transporteur"], .cel6[data-col="limite"], .cel6[data-col="bordereau"] { text-align: left; }
  .th6r .cels6 > [data-ven-tri="statut"], .th6r .cels6 > [data-ven-tri="transporteur"], .th6r .cels6 > [data-ann-tri="statut"], .th6r .cels6 > .th6-fixe { justify-content: flex-start; }
  .tr-l6 { display: inline-flex; align-items: center; gap: 8px; }
  /* 5.410.2 : le livreur, le suivi, la date limite et le bordereau de chaque vente */
  .cel6 .tr-l6 + .suivi6, .env6 .suivi6 { display: block; margin-top: 2px; font: 400 12px/16px ui-monospace, "SF Mono", Menlo, monospace; color: var(--n-encre-2); letter-spacing: .02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
  .lim6 { font: 500 14px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .gris6 { color: var(--n-encre-2); }
  .imp6 { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--n-trait); background: var(--n-carte); color: var(--n-encre); font: 600 14px/18px -apple-system, Inter, system-ui, sans-serif; cursor: pointer; white-space: nowrap; transition: background-color .16s ease, transform .12s ease; }
  .imp6:hover { background: var(--n-neutre); } .imp6:active { transform: scale(.97); } .imp6:disabled { opacity: .55; cursor: default; }
  .imp6:focus-visible { outline: 2px solid var(--n-accent); outline-offset: 2px; }
  .pas6 { font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  .imp-etat6 { padding: 8px 16px; } .imp-etat6[data-ton="ambre"] { color: var(--n-ambre, #8A4B00); }
  .revue6 { padding: 8px 16px 0; margin: 0; }
  .acc6 .imp-etat6 { padding: 4px 0; }
  .vte6 > span:first-child { min-width: 0; display: flex; flex-direction: column; gap: 2px; } .vte6 > span:first-child b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .env6 { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 13px; color: var(--n-encre-2); } .env6 .suivi6 { margin: 0; }
  @media (prefers-reduced-motion: reduce) { .imp6 { transition: none; } }
  .vu-transp { display: inline-flex; border-radius: 5px; overflow: hidden; flex: none; }
  .et6 { display: inline-block; padding: 2px 10px; border-radius: 999px; background: var(--n-carte-2); color: var(--n-encre-2); font: 600 13px/18px -apple-system, Inter, system-ui, sans-serif; white-space: nowrap; }
  .et6[data-ton="ambre"] { background: var(--n-ambre-fond, #FFF4DD); color: var(--n-ambre, #8A4B00); }
  /* 5.426 : « Vendue → retirée sur » — une rangée par paire, une étiquette douce par site (ambre = encore à retirer). */
  .rp6 .rp6-l > span { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .rp6-sites { display: flex; flex-wrap: wrap; gap: 4px 6px; }
  .rp6-s { display: inline-block; padding: 1px 8px; border-radius: 999px; background: var(--n-carte-2); color: var(--n-encre-2); font: 500 12px/18px -apple-system, Inter, system-ui, sans-serif; }
  .rp6-s[data-ton="ambre"] { background: var(--n-ambre-fond, #FFF4DD); color: var(--n-ambre, #8A4B00); }
  .note5[data-ton="ambre"] { color: var(--n-ambre, #8A4B00); }
  .et6[data-statut="en_vente"] { background: var(--n-vert-fond); color: var(--n-vert); }
  .et6[data-statut="en_route"] { background: var(--n-teal-fond); color: var(--n-teal); }
  .et6[data-statut="finalisee"] { background: var(--n-vert-fond); color: var(--n-vert); }
  /* 5.410.7 — les favoris en tableau (mêmes pièces que Commandes) ; l'état en étiquette, l'accent seulement pour « en cours ». */
  .et6[data-ton="accent"] { background: var(--n-teal-fond); color: var(--n-teal); }
  .et6[data-statut="envoye"], .et6[data-statut="offre"] { background: var(--n-vert-fond); color: var(--n-vert); }
  .fav6-barre .seg6 { flex: 0 1 auto; min-width: 0; }
  .fav6-barre .seg6 button { padding: 0 12px; white-space: nowrap; }
  .fav6-barre .seg6 b { font-weight: 600; opacity: .72; margin-left: 2px; }
  .fav6-barre .reg6 { min-height: 44px; padding: 0 16px; border-radius: 12px; margin-left: auto; }
  .fav6-table .rangs > li[data-fav-qui] { cursor: pointer; }
  .fav6-table .rangs > li[data-fav-off] { cursor: default; }
  .fav6-table .art6 { cursor: inherit; }
  .fav6-table .tr6 { min-height: 64px; grid-template-columns: 44px minmax(220px, 1fr) minmax(0, max-content) 8px; }
  .cel6[data-col="acheteur"], .cel6[data-col="etat"], .cel6[data-col="date"] { text-align: left; }
  .th6r .cels6 > [data-fav6-tri="acheteur"], .th6r .cels6 > [data-fav6-tri="etat"], .th6r .cels6 > [data-fav6-tri="date"] { justify-content: flex-start; }
  .cel6 .of6, .cel6 .rs6 { display: block; margin-top: 2px; font: 400 12px/16px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); white-space: normal; }
  .cel6[data-col="etat"] { white-space: normal; }
  .fav6-envoi { margin: 12px 16px 0; }
  .fav6-file { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin: 12px 16px 0; padding: 10px 12px 10px 16px; border-radius: 14px; background: var(--n-ambre-fond, #FFF4DD); color: var(--n-ambre, #8A4B00); }
  .fav6-file > span { flex: 1 1 220px; display: flex; flex-direction: column; font: 600 15px/20px -apple-system, Inter, system-ui, sans-serif; }
  .fav6-file small { font-weight: 400; font-size: 13px; line-height: 18px; }
  .fav6-file .vu-btn { min-height: 44px; padding: 0 16px; border-radius: 12px; }
  .fav6 > .note5 { padding: 0 16px; margin: 4px 0 8px; }
  .fav6-bas .vu-btn { flex: 0 0 auto; width: auto; }
  /* 5.419 : Commandes — filtres rapides, barre de la sélection, confirmation « Commander ». */
  .ven6-seg { margin: 0 16px 10px; display: flex; flex-wrap: wrap; }
  /* 5.425 : « À relancer » (Commandes) et le tri des conversations (Messagerie). */
  .rl6-t { display: flex; align-items: center; gap: 12px; padding: 0 16px 8px; }
  .rl6-t .note5 { flex: 1; margin: 0; }
  .rl6-t .vu-btn { flex: 0 0 auto; width: auto; min-height: 44px; }
  .rl6-g h3 b { font-weight: 600; }
  .rl6 .rangs { max-height: none; }
  .rl6-r { padding: 10px 16px; }
  .rl6-r + .rl6-r { border-top: .5px solid var(--n-trait); }
  .rl6-l { display: flex; align-items: center; gap: 12px; min-height: 52px; }
  .rl6-l .case5 { flex: 0 0 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }
  .rl6-l .mil { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .rl6-l .ti { font-weight: 600; color: var(--n-encre); overflow-wrap: anywhere; }
  .rl6 > .note5 { padding: 0 16px; }
  .rl6-l .me { color: var(--n-encre-2); font-size: 13px; line-height: 18px; }
  .rl6-m { margin: 8px 0 0 56px; display: flex; flex-direction: column; gap: 6px; }
  .rl6-m small { color: var(--n-encre-2); font-size: 13px; }
  .rl6-m textarea { width: 100%; box-sizing: border-box; min-height: 88px; border-radius: 10px; border: 1px solid var(--n-trait); padding: 8px 10px; font: 400 15px/20px -apple-system, Inter, system-ui, sans-serif; background: var(--n-carte); color: var(--n-encre); }
  .rl6-m .ge5 .vu-btn { width: auto; min-height: 44px; }
  .rl6-ko { margin: 6px 0 0 56px; color: var(--n-ambre, #8A4B00); }
  .rl6-reg .champ6 input[type="number"] { max-width: 120px; min-height: 44px; }
  .rl6-reg textarea { min-height: 88px; }
  .rl6-reg select { min-height: 44px; }
  .rl6-case span { display: flex; align-items: center; justify-content: flex-start; gap: 10px; min-height: 44px; }
  .rl6-case input[type="checkbox"] { width: 22px !important; height: 22px; min-height: 0; flex: 0 0 22px; margin: 0; padding: 0; }
  .rl6-case b { flex: 1; }
  .tc6-seg { margin: 0 0 8px; display: flex; flex-wrap: wrap; }
  .tc6-seg button { flex: 1 1 auto; min-height: 44px; }
  .tc6-r { display: block; color: var(--n-encre-2); font-size: 12px; line-height: 16px; }
  .tc6-r[data-urgent] { color: var(--n-ambre, #8A4B00); }
  .tc6-pt { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; margin-right: 6px; vertical-align: middle; }
  @media (max-width: 760px) { .rl6-m, .rl6-ko { margin-left: 0; } .rl6-t { flex-direction: column; align-items: stretch; gap: 8px; } .rl6-t .vu-btn { width: 100%; } .rl6-r { padding: 10px 8px; } .rl6-l { gap: 8px; } .rl6-l .v6 { align-self: flex-start; } }
  .ven6-seg button { flex: 1 1 auto; min-height: 44px; }
  .ven6-bas { flex-wrap: wrap; }
  @media (max-width: 760px) {
    .fav6-bas.ven6-bas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .fav6-bas.ven6-bas .fav6-bas-t, .fav6-bas.ven6-bas .vu-plein { grid-column: 1 / -1; }
    .fav6-bas.ven6-bas .vu-btn { width: 100%; min-width: 0; white-space: normal; padding: 0 10px; font-size: 15px; line-height: 18px; }
    .ven6-conf { bottom: 8px; margin: 8px 8px 0; }
  }
  .ven6-conf { position: sticky; bottom: 76px; z-index: 3; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 8px 16px 0; padding: 12px 14px; border-radius: 14px; background: var(--n-carte); border: 1px solid var(--n-trait); color: var(--n-encre); font: 500 15px/20px -apple-system, Inter, system-ui, sans-serif; }
  .ven6-conf > span { flex: 1 1 220px; }
  .ven6-conf .vu-btn { min-height: 44px; width: auto; }
  .tout6 { display: none; min-height: 44px; }
  .fav6 .err6 { color: var(--n-ambre); }
  .fav6-bas { position: sticky; bottom: 0; z-index: 2; display: flex; align-items: center; gap: 10px; margin: 12px 16px 0; padding: 10px 12px 10px 16px; border-radius: 14px; background: var(--n-carte); box-shadow: 0 -1px 0 var(--n-trait), 0 8px 28px rgb(0 0 0 / .16); }
  .fav6-bas-t { flex: 1; min-width: 0; display: flex; flex-direction: column; color: var(--n-encre); font: 600 15px/20px -apple-system, Inter, system-ui, sans-serif; }
  .fav6-bas-t small { font-weight: 400; font-size: 13px; line-height: 18px; color: var(--n-encre-2); }
  .fav6-bas .vu-btn { min-height: 44px; padding: 0 16px; border-radius: 12px; white-space: nowrap; }
  .fav6-voile { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgb(0 0 0 / .38); }
  .fav6-feuille { position: relative; width: min(560px, 100%); max-height: calc(100% - 32px); overflow-y: auto; overscroll-behavior: contain; border-radius: 18px; padding: 8px 0 12px; background: var(--n-fond); color: var(--n-encre); box-shadow: 0 18px 50px rgb(0 0 0 / .3); }
  .fav6-feuille .fl-recap { padding: 8px 16px 0; }
  .fav6-x { position: absolute; top: 8px; right: 8px; z-index: 1; }
  .fav6-reg { padding: 8px 16px; }
  .fav6-reg h3 { margin: 8px 0 12px; font: 700 20px/26px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); }
  .fav6-reg .rg6 { flex-wrap: wrap; gap: 8px; }
  .fav6-reg .rg6 .vu-seg { flex: 1 1 100%; }
  .fav6-reg .pied6 { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 0 0; }
  /* 5.417 (favorisperso2) — l'éditeur des messages aux favoris : sobre, des rangées séparées par un filet, la bulle
     d'aperçu comme un message reçu ; ambre = un texte à corriger ; aucune carte flottante empilée. */
  .fav6-feuille[data-fav6-feuille="reglages"] { width: min(760px, 100%); }
  .fp6 h3 { margin: 18px 0 6px; font: 600 17px/22px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); }
  .fp6 h3:first-of-type { margin-top: 4px; }
  .fp6 .fp-sous { margin: 0 0 6px; font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  .fp6 .fp-compte { display: flex; align-items: center; gap: 8px; min-height: 44px; border-bottom: .5px solid var(--n-trait); font: 500 15px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); }
  .fp6 .fp-compte small { color: var(--n-encre-2); font-weight: 400; }
  .fp-v { padding: 10px 0; border-bottom: .5px solid var(--n-trait); }
  .fp-vt { display: flex; align-items: center; gap: 8px; min-height: 44px; }
  .fp-vt b { font: 500 15px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); }
  .fp-st { margin-left: auto; font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .fp-v textarea { display: block; width: 100%; box-sizing: border-box; min-height: 72px; resize: vertical; font: 400 15px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); background: var(--n-carte); border: .5px solid var(--n-trait); border-radius: 10px; padding: 10px 12px; }
  .fp-v[data-fp-ko] textarea { border-color: var(--n-ambre, #B26B00); }
  .fp-pied { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; padding-top: 4px; font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  .fp-n { font-variant-numeric: tabular-nums; }
  .fp-al { color: var(--n-ambre, #B26B00); }
  .fp-al:empty { display: none; }
  .fp-ins { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 0 4px; }
  .fp-ins button, .fp-ajout { appearance: none; min-height: 44px; padding: 0 12px; border-radius: 10px; border: .5px solid var(--n-trait); background: var(--n-carte); color: var(--n-encre); font: 500 14px/18px -apple-system, Inter, system-ui, sans-serif; cursor: pointer; }
  .fp-ajout { border-style: dashed; color: var(--n-encre, #111114); margin: 8px 0 0; }
  .fp-r { padding: 4px 0 8px; border-top: .5px solid var(--n-trait); }
  .fp-rt { display: flex; align-items: center; gap: 4px; min-height: 44px; }
  .fp-rt b { font: 600 15px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); margin-right: 6px; }
  .fp-rt small { color: var(--n-encre-2); margin-right: auto; }
  .fp-cond { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
  .fp-cond .champ6 input { max-width: none; }
  .fp-cond .vu-seg { flex-wrap: wrap; }
  .fp-ap { padding: 10px 0; }
  .fp-ap small { display: block; font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  .fp6 textarea:focus, .fp6 input:focus, .fp6 select:focus { outline: none; border-color: var(--n-accent); box-shadow: 0 0 0 3px var(--n-teinte); }
  .fp-bulle { margin: 6px 0; padding: 10px 14px; border-radius: 16px 16px 16px 4px; background: var(--n-carte); border: .5px solid var(--n-trait); color: var(--n-encre); font: 400 15px/21px -apple-system, Inter, system-ui, sans-serif; white-space: pre-wrap; overflow-wrap: anywhere; }
  .fp-bulle[data-vide] { color: var(--n-encre-2); font-style: italic; }
  .fp6 select { min-height: 44px; width: 100%; border-radius: 10px; border: .5px solid var(--n-trait); background: var(--n-carte); color: var(--n-encre); padding: 0 10px; font: 400 15px/20px -apple-system, Inter, system-ui, sans-serif; }
  .fp6 .cd6-l input[type=number] { width: 84px; min-height: 44px; box-sizing: border-box; border-radius: 10px; border: .5px solid var(--n-trait); background: var(--n-carte); color: var(--n-encre); padding: 0 10px; font: 400 15px/20px -apple-system, Inter, system-ui, sans-serif; }
  @media (max-width: 760px) { .fp-cond { grid-template-columns: minmax(0, 1fr); } .fp-st { flex-basis: 100%; margin-left: 0; order: 3; } .fp-vt { flex-wrap: wrap; } .fp-vt .rond6 { margin-left: auto; } }
  @media (max-width: 760px) {
    .fav6-barre .seg6 { flex: 1 1 100%; overflow-x: auto; scrollbar-width: none; display: flex; }
    .fav6-barre .seg6 button { flex: 0 0 auto; }
    .fav6-barre .reg6 { margin-left: 0; }
    .fav6-table .tr6 { grid-template-columns: 44px minmax(0, 1fr) 8px; min-height: 56px; }
    .fav6-table .art6 { min-height: 0; padding: 8px 0 2px; }
    .fav6-table .art6 .ti { -webkit-line-clamp: 1; }
    .fav6-table .tr6 .cels6 { gap: 2px 10px; padding: 0 0 8px 60px; align-items: baseline; }
    .fav6-table .lc5 { display: none; }
    .fav6-table .cel6 { font-size: 13px; line-height: 18px; color: var(--n-encre-2); }
    .fav6-table .cel6 b { color: var(--n-encre); }
    .fav6-table .cel6 .of6 { display: inline; margin: 0 0 0 6px; }
    .fav6-table .cel6[data-col="etat"] { flex: 0 1 auto; }
    .fav6-table .cel6 .et6 { padding: 0 8px; font-size: 12px; line-height: 18px; }
    .fav6-table .cel6 .rs6 { display: inline; margin-left: 6px; }
    .fav6-bas { margin: 8px 8px 0; flex-wrap: wrap; }
    .fav6-bas-t { flex: 1 1 100%; }
    .fav6-bas .vu-plein { flex: 1 1 auto; }
    .fav6-voile { align-items: flex-end; padding: 0; }
    .fav6-feuille { width: 100%; max-height: 88%; border-radius: 18px 18px 0 0; padding-bottom: max(12px, env(safe-area-inset-bottom)); }
    .fav6-envoi { margin: 8px 8px 0; }
    .tout6 { display: inline-flex; align-items: center; }
  }
  .plus6 { appearance: none; border: 0; background: transparent; width: 44px; height: 44px; border-radius: 10px; color: var(--n-encre-2); font-size: 20px; cursor: pointer; }
  .plus6:hover { background: rgb(127 127 127 / .10); }
  .table6 li[data-coche] > .tr6 { background: var(--n-neutre); }
  .vide6 { margin: 24px 16px; text-align: center; }
  .av6 { width: 40px; height: 40px; border-radius: 50%; flex: none; object-fit: cover; display: inline-grid; place-items: center; background: var(--n-carte-2); color: var(--n-encre-2); font: 600 16px/1 -apple-system, Inter, system-ui, sans-serif; }
  .vig6 { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; flex: none; margin-left: auto; background: var(--n-carte-2); }
  .carte[data-grand] .corps6 .deux5 { min-height: calc(100vh - 120px); }
  .carte[data-grand] .corps6 .gauche5 .rangs .rang { min-height: 64px; }
  .au6-l { list-style: none; margin: 0; padding: 0; }
  .au6-i { appearance: none; border: 0; background: transparent; width: 100%; display: flex; align-items: center; gap: 10px; min-height: 72px; padding: 10px 16px; text-align: left; color: var(--n-encre); cursor: pointer; border-bottom: .5px solid var(--n-trait); font: inherit; }
  .au6-i[aria-selected="true"] { background: var(--n-teinte); box-shadow: inset 3px 0 0 var(--n-accent); }
  .au6-i .ti { display: block; font: 600 15px/20px -apple-system, Inter, system-ui, sans-serif; }
  .au6-i .me { display: block; font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
  .au6-d { padding: 0 !important; display: flex; flex-direction: column; }
  .au6-t { padding: 16px 24px; border-bottom: .5px solid var(--n-trait); }
  .au6-t h2 { margin: 0; font: 600 17px/22px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); }
  .au6-t p { margin: 2px 0 0; color: var(--n-encre-2); font-size: 14px; }
  .sec6 { padding: 12px 24px 4px; }
  .cb10-t { margin: 0 0 6px; }
  .cb10-t figcaption { display: flex; justify-content: space-between; font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  .cb10-t figcaption b { color: var(--n-encre); font-weight: 600; font-variant-numeric: tabular-nums; }
  .cb10-svg { display: block; width: 100%; height: 56px; overflow: visible; }
  .cb10-base { stroke: var(--n-trait); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .cb10-l { fill: none; stroke: var(--n-encre); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .cb10-p { stroke-width: 4; }
  .cb10-c { fill: transparent; } .cb10-c:hover { fill: var(--n-trait); }
  .cb10-r { display: block; width: 100%; height: 12px; }
  .cb10-rl { stroke: var(--n-encre-2); stroke-width: 1.5; stroke-dasharray: 2 2; vector-effect: non-scaling-stroke; }
  .cb10-axe { display: flex; justify-content: space-between; font: 400 12px/16px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-3, var(--n-encre-2)); }
  .sec6 h3 { margin: 8px 0 6px; font: 600 12px/16px -apple-system, Inter, system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: var(--n-encre-2); }
  .rg6 { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; padding: 6px 0; border-bottom: .5px solid var(--n-trait); }
  .rg6 b { display: block; font: 500 15px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); }
  /* 22 nov. (audit, banc « tout toucher ») : les sept jours de la semaine faisaient 32 px de large — chacun 44 px, la rangée passe à la ligne s'il le faut. */
  .rg6.jours6 { flex-wrap: wrap; }
  .rg6.jours6 > .vue5 { grid-auto-columns: minmax(44px, 1fr); flex: 1 1 322px; max-width: 100%; }
  .rg6 small { display: block; font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  .rg6 .v6 { font-weight: 600; text-align: right; }
  /* 5.438 : la rangée « Note de santé » de l'Accueil se touche (elle mène à Santé) — une rangée, pas un bouton. */
  .rg6.sn6-b { width: 100%; background: none; border: 0; border-bottom: .5px solid var(--n-trait); border-radius: 0; text-align: left; color: inherit; font: inherit; cursor: pointer; padding: 6px 0; min-height: 52px; }
  .rg6.sn6-b:active { background: var(--n-presse, rgba(0,0,0,.04)); }
  .sn6-n[data-ton="ambre"] { color: var(--n-ambre, #8A4B00); }
  [data-bm-section="lotFavoris"] .rg6 { flex-wrap: wrap; gap: 8px; } [data-bm-section="lotFavoris"] .rg6 .vu-seg { flex: 1 1 100%; }
  .rg6 .md6-g { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .rg6 .md6-g .vu-lien { min-height: 44px; display: inline-flex; align-items: center; }
  .msg6 { display: flex; align-items: center; gap: 12px; padding: 12px 14px; margin: 6px 0; border: .5px solid var(--n-trait); border-radius: 12px; color: var(--n-encre); }
  .msg6 span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .apercu6 { font: 600 17px/22px -apple-system, Inter, system-ui, sans-serif; font-variant-numeric: tabular-nums; color: var(--n-encre); }
  .pied6 { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 24px; border-top: .5px solid var(--n-trait); }
  .pied6 .vu-plein { flex: none !important; width: auto !important; min-width: 140px; min-height: 44px; padding: 0 22px; border-radius: 12px; }
  .pied6 .vu-lien { white-space: nowrap; }
  .acc6 { padding: 8px 0; max-width: 980px; }
  .au6-retour { display: none; align-items: center; gap: 4px; min-height: 44px; padding: 0 16px; border: 0; background: transparent; color: var(--n-encre); font: 500 15px/20px -apple-system, Inter, system-ui, sans-serif; cursor: pointer; }
  .geste6 { margin: 12px 16px; padding: 12px 16px; border-radius: 12px; background: var(--n-carte); }
  /* 5.424 — Publier aussi sur… : la feuille avant / après et la frise */
  .au6-art { margin: 10px 0; padding: 10px 12px; border-radius: 12px; background: var(--n-carte-2); }
  .au6-site { margin-top: 8px; }
  .au6-site h4 { margin: 6px 0; font: 600 14px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .au6-tab { overflow-x: auto; }
  .au6-t { width: 100%; border-collapse: collapse; font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); }
  .au6-t th, .au6-t td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: .5px solid var(--n-trait); overflow-wrap: anywhere; }
  .au6-t thead th { color: var(--n-encre-2); font-weight: 600; }
  .au6-t tbody th { font-weight: 600; white-space: nowrap; }
  .au6-t small { display: block; color: var(--n-encre-2); }
  .au6-t select { min-height: 44px; max-width: 100%; border-radius: 10px; border: .5px solid var(--n-trait); background: var(--n-carte); color: var(--n-encre); padding: 0 8px; }
  .au6-ok { color: var(--n-accent); font-weight: 700; }
  .au6-ph { display: flex; gap: 6px; overflow-x: auto; padding: 4px 0; }
  .au6-vig { position: relative; flex: 0 0 auto; }
  .au6-vig img { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; display: block; background: var(--n-neutre); }
  .au6-vig i { position: absolute; left: 4px; top: 4px; font: 700 11px/16px -apple-system, system-ui, sans-serif; font-style: normal; background: var(--n-carte); color: var(--n-encre); border-radius: 8px; padding: 0 5px; }
  .au6-frise { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; padding: 0; }
  .au6-frise li { padding: 2px 10px; border-radius: 999px; background: var(--n-neutre); color: var(--n-encre-2); font: 500 12px/20px -apple-system, Inter, system-ui, sans-serif; }
  .au6-frise li[data-etat="fait"] { background: var(--n-vert-fond); color: var(--n-vert); }
  .au6-frise li[data-etat="en-cours"] { background: var(--n-teal-fond); color: var(--n-teal); }
  @media (max-width: 760px) { .au6-t thead { display: none; } .au6-t tr { display: grid; grid-template-columns: 1fr 1fr; } .au6-t tbody th { grid-column: 1 / -1; padding-bottom: 0; border-bottom: 0; } }
  .carte[data-grand] .geste6 .vu-btn:not(.vu-plein) { background: var(--n-carte-2); color: var(--n-encre); box-shadow: none; }
  .carte[data-grand] .geste6 .rg6:last-child { border-bottom: 0; }
  .geste6 h3 { margin: 4px 0 8px; font: 600 15px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); }
  /* 5.432 (gardeprix, prixpartout) : la confirmation du chiffre EN GRAND ; les autres sites sous la saisie. */
  .garde6 { display: block; border-left: 3px solid var(--vu-ambre); }
  .garde6 h3 { margin: 0 0 6px; }
  @media (min-width: 761px) { .garde6 { max-width: 880px; } .garde6 .outils { flex-wrap: nowrap; } .garde6 .outils .vu-btn { flex: 0 1 auto; width: auto; } }
  .garde6-l { padding: 6px 0; border-bottom: .5px solid var(--n-trait); }
  .garde6-l:last-of-type { border-bottom: 0; }
  .garde6-q { margin: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; }
  .garde6-chiffre { font: 700 30px/36px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); font-variant-numeric: tabular-nums; }
  .garde6-q span { font: 500 15px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  .garde6-q small, .garde6 ul { color: var(--n-encre-2); font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; }
  .garde6 ul { margin: 4px 0 0; padding-left: 18px; }
  .garde6 .outils { margin-top: 10px; }
  .garde6 .outils .vu-btn { min-height: 44px; }
  ul.pp6 { list-style: none; margin: 6px 0 0; padding: 0; flex: 1 1 100%; }
  ul.pp6 li { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; border-top: .5px solid var(--n-trait); font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  ul.pp6 li > span:first-child { color: var(--n-encre); font-weight: 500; }
  small.pp6 { flex: 1 1 100%; display: block; margin-top: 4px; color: var(--n-encre-2); }
  .geste6 .rg6[data-prix-ligne] { flex-wrap: wrap; }
  .pp6-choix { flex-wrap: wrap; gap: 8px; align-items: center; }
  .pp6-tous { display: flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer; }
  .pp6-tous input { width: 22px; height: 22px; }
  .pp6-n { width: 72px; }
  .pp6-choix .vu-seg { flex: 1 1 100%; }
  .pp6-choix .vu-seg button { white-space: normal; min-height: 44px; line-height: 18px; }
  .vu-aa-site { font-weight: 600; }
  .geste6 .outils { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .conf5 .prog6-q { flex: 1 1 100%; margin: 0; }   /* 5.422 : la phrase dite avant de programmer */
  .conf5 .prog6-pied { flex: 1 1 100%; margin: 0; padding: 0; border: 0; }
  .prix6.heure6 { width: auto; min-width: 200px; max-width: 100%; }   /* 5.422 : « Programmer à … » */
  .prix6 { width: 110px; min-height: 44px; box-sizing: border-box; padding: 8px 10px; border-radius: 10px; border: .5px solid var(--n-trait); background: var(--n-carte); color: var(--n-encre); font: 500 15px/20px -apple-system, Inter, system-ui, sans-serif; font-variant-numeric: tabular-nums; }
  .geste6 select { min-height: 44px; border-radius: 10px; border: .5px solid var(--n-trait); background: var(--n-carte); color: var(--n-encre); padding: 0 10px; max-width: 520px; }
  .geste6 .au6-l li { border-bottom: .5px solid var(--n-trait); }
  .geste6 .pied6 { padding: 12px 0 0; }
  /* 5.423 (modifavantapres) : la frise dans une rangée de l'atelier, le suivi en cours, la feuille Avant | Après. */
  .geste6 .rg6-frise { flex-wrap: wrap; }
  .geste6 .rg6-frise > .vu-frise { flex: 1 1 100%; padding: 2px 0 8px; }
  .modif6 .vu-frise { margin: 8px 0 4px; }
  .modif6 .vu-bl { margin-top: 10px; }
  .geste6 .vu-aa { margin: 4px 0 0; }
  .aa6 { margin: 0 12px 8px; }
  .carte[data-grand] a.vu-btn { text-decoration: none; display: inline-flex; width: auto; }
  /* 5.435 (sauvegardereglages) : l’aperçu de la restauration se lit en colonne (une ligne par réglage), Non / Oui en bas. */
  .conf5.sr6 { display: block; } .conf5.sr6 > * + * { margin-top: 8px; } .conf5.sr6 .rangs { width: 100%; } .conf5.sr6 .outils { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; } .conf5.sr6 .outils .vu-btn { width: auto; flex: 0 0 auto; min-width: 96px; }
  .offre6 .conf5 { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0; }
  @media (max-width: 760px) { .geste6 { margin: 8px; } .offre6 { flex-direction: column; align-items: stretch; } .geste6 .rg6 { flex-wrap: wrap; } }
  /* 5.433 : la file d'actions — rangées fines, position, sorte (N° en plaque), site · compte · heure, étiquette, gestes 44 px */
  .q7-l { list-style: none; margin: 0; padding: 0; }
  .q7-r { justify-content: flex-start; align-items: center; }
  .q7-p { flex: 0 0 22px; color: var(--n-encre-3, var(--n-encre-2)); font-variant-numeric: tabular-nums; font-size: 13px; text-align: right; }
  .q7-c { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .q7-c b { font-weight: 600; overflow-wrap: anywhere; }
  .q7-c small { color: var(--n-encre-2); font-size: 12.5px; overflow-wrap: anywhere; }
  .q7-c .q7-essai { color: var(--vu-ambre, #b45309); }
  .q7-g { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px; }
  .q7-g .vu-btn { min-height: 44px; }
  .q7-g .rond6[disabled] { opacity: .3; cursor: default; }
  .q7-pause { gap: 10px; }
  .q7-pause .vu-btn { min-height: 44px; white-space: nowrap; }
  .q7-acc { width: 100%; appearance: none; background: none; border: 0; border-bottom: .5px solid var(--n-trait); font: inherit; color: inherit; text-align: left; cursor: pointer; }
  .q7-g .rond6 { font-size: 20px; }
  @media (max-width: 760px) { .q7-g { gap: 0; } .q7-pause { flex-wrap: wrap; } .q7-pause .v6 { margin-left: auto; } }
  .cd6-l { display: flex; align-items: center; gap: 12px; max-width: 520px; }
  .cd6-l input[type=range] { flex: 1; min-height: 44px; accent-color: var(--n-accent); padding: 0; border: 0; background: transparent; }
  .cd6-l output { min-width: 88px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .champ6 { display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-bottom: .5px solid var(--n-trait); }
  .champ6 b { font: 500 15px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); }
  .champ6 small { font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  .champ6 textarea, .champ6 input { font: 400 15px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre); background: var(--n-carte); border: .5px solid var(--n-trait); border-radius: 10px; padding: 10px 12px; min-height: 44px; box-sizing: border-box; width: 100%; max-width: 520px; }
  /* 5.410.3 : un choix (rond ou case) À GAUCHE de son libellé, la ligne entière se touche (44 px). */
  .champ6.cb6 { flex-direction: row; align-items: flex-start; gap: 12px; min-height: 44px; cursor: pointer; }
  .champ6.cb6 input[type="radio"], .champ6.cb6 input[type="checkbox"] { width: 22px; height: 22px; min-height: 0; max-width: none; flex: none; margin: 1px 0 0; padding: 0; accent-color: var(--n-accent, #0F6B4C); }
  .champ6.cb6 > span { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .champ6.cb6 .note5 { margin: 0; }
  .champ6.ot6 { flex-direction: row; align-items: center; justify-content: space-between; gap: 12px; }
  .champ6.ot6 > span { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .champ6.ot6 .vu-btn { flex: none; min-height: 44px; background: var(--n-carte-2); color: var(--n-encre); border: 1px solid var(--n-trait); }
  .au6-d .conf5 { margin: 12px 24px 0; }
  .conf5[data-irreversible] { display: block !important; }
  .conf5[data-irreversible] p { margin: 0 0 8px; }
  /* (20 nov., intégration 5.410) Cadence : la question et ses deux touches sur une ligne ; « Enregistrer » se retire
     pendant la question (un seul plein à l'écran). */
  [data-cad-confirme] p { flex: 1 1 220px; margin: 0; }
  [data-cad-confirme] .outils { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; border: 0; }
  .ra6 { flex: none !important; width: auto !important; min-width: 120px; min-height: 44px; }
  .au6-d [data-ra-etat] { margin: 8px 24px 0; }
  .tuiles6 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .tu6 { appearance: none; border: 0; background: var(--n-carte-2); transition: background-color .16s ease; border-radius: 12px; padding: 12px 14px; text-align: left; cursor: pointer; color: var(--n-encre); }
  .tu6 span { display: block; font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
  .tu6 b { display: block; font: 700 28px/34px -apple-system, Inter, system-ui, sans-serif; font-variant-numeric: tabular-nums; }
  .tu6[data-ton="ambre"] b { color: var(--n-ambre, #8A4B00); }
  /* Au téléphone / Orion : la barre latérale devient une rangée défilante en haut ; le tableau, des rangées empilées. */
  @media (max-width: 760px) {
    .carte[data-grand] { top: 0 !important; bottom: 0 !important; left: 0 !important; right: 0 !important; border-radius: 0; }
    .vx6, .vx6[data-reduit] { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) auto; }
    .side6 { flex-direction: row; overflow-x: auto; padding: 6px 8px max(6px, env(safe-area-inset-bottom)) 8px; border-right: 0; border-bottom: .5px solid var(--n-trait); gap: 4px; scrollbar-width: none; order: 2; }
    .main6 { order: 1; min-height: 0; }
    .side6 .marque6, .side6 .grp6 { display: none; }
    .side6 .bas6 { margin: 0; padding: 0; border: 0; }
    .nav6 { flex: none; width: auto; flex-direction: column; gap: 2px; min-height: 52px; min-width: 64px; padding: 4px 8px; font-size: 11px; line-height: 14px; justify-content: center; }
    .vx6[data-reduit] .nav6 span { display: inline; }
    .tete6 { padding: max(6px, env(safe-area-inset-top)) 8px 6px; }
    .tete6 [data-vx-reduire] { display: none; }
    .tete6 h1 { font-size: 22px; }
    .maj6 span { display: none; }
    .compte6 { max-width: 40vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .barre6 { padding: 10px 12px; }
    /* (20 nov., intégration 5.410) « Choisir une action » n'est plus coupé au téléphone : action et Statut sur la 1re ligne,
       la recherche en dessous sur toute la largeur. */
    .barre6 .act5 { min-width: 0; flex: 1 1 140px; }
    .barre6 .cherche5 { flex: 1 1 100%; max-width: none; order: 3; }
    .table6 { margin: 0 8px; }
    .th6r { display: none !important; }
    .tr6 { grid-template-columns: 44px minmax(0, 1fr) 40px; padding: 4px 4px; }
    .tr6 .cels6 { grid-column: 2 / 4; grid-row: 2; display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 0 0 10px 60px; }
    .tr6 > .plus6 { grid-column: 3; grid-row: 1; }
    .cel6 { text-align: left; font-size: 14px; }
    .tuiles6 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .au6 .volet5, .au6 .au6-d { display: flex !important; }
    .au6 { display: block !important; }
    /* 5.410.1 : au téléphone, le grand panneau occupe l'écran — le rond VRM s'écarte (le × ferme), il ne couvre plus
       la barre du bas ; Automatisations : la LISTE seule, puis le détail en page poussée avec « ‹ Retour ». */
    .carte.on[data-grand] ~ .btn { display: none !important; }
    .au6[data-auto-vue="liste"] .au6-d { display: none !important; }
    .au6[data-auto-vue="detail"] .gauche5 { display: none !important; }
    .au6-retour { display: inline-flex !important; }
    .sec6, .au6-t, .pied6 { padding-left: 16px; padding-right: 16px; }
  }
  /* ══ 5.413 — LE PANNEAU AU TÉLÉPHONE (Julien, 21 nov. : « dans ce style-là, surtout sur le téléphone ») ═══════════
     À l'ordinateur : la barre latérale garde ses huit entrées (la feuille « Plus » s'y fond : display: contents).
     Au téléphone / Orion (≤ 760 px) : cinq onglets égaux en bas, « Plus » ouvre une feuille du bas ; en-tête « Titre ·
     compte » puis « Mis à jour … ⟳ » ; recherche sur toute la largeur, la barre d'outils sur UNE ligne qui défile ;
     les menus Statut / Colonnes deviennent des feuilles du bas ; chaque rangée : case · vignette 48 · titre complet +
     phrase d'état grise · ⋯, puis la ligne méta « prix · date · étiquette » sans libellés ; champs à 16 px (pas de
     zoom de Safari/Orion à la saisie). Seulement la présentation : aucun geste, aucune règle ne change. */
  .plusb6, .plus6t, .voile6 { display: none; }
  .plus6g { display: contents; }
  @media (max-width: 760px) {
    .vx6 { grid-template-rows: minmax(0, 1fr) auto; }
    .side6 { display: grid !important; grid-template-columns: repeat(5, minmax(0, 1fr)); overflow: visible; gap: 0; padding: 2px 4px max(4px, env(safe-area-inset-bottom)); border-top: .5px solid var(--n-trait); border-bottom: 0; background: var(--n-carte); position: relative; z-index: 6; }
    .side6 > .nav6, .side6 .plusb6 { min-width: 0; width: 100%; min-height: 50px; padding: 4px 0 2px; border-radius: 10px; gap: 2px; font: 500 10px/13px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif; letter-spacing: .01em; }
    .side6 > .nav6 span, .side6 .plusb6 span { display: block !important; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .side6 .nav6[aria-current="page"] { background: transparent; }
    .plusb6 { display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .plusb6[aria-current="page"], .plusb6[aria-expanded="true"] { color: var(--n-accent); font-weight: 600; }
    .plus6g { display: none; }
    .vx6[data-plus] .plus6g { display: flex; flex-direction: column; position: fixed; left: 0; right: 0; bottom: calc(56px + env(safe-area-inset-bottom)); z-index: 41; margin: 0; padding: 8px 8px 10px; border-radius: 18px 18px 0 0; background: var(--n-carte); box-shadow: 0 -10px 40px rgb(0 0 0 / .22); }
    .vx6[data-plus] .plus6t { display: block; padding: 6px 12px 8px; font: 600 13px/18px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); }
    .vx6[data-plus] .plus6g .nav6 { flex-direction: row; justify-content: flex-start; gap: 14px; width: 100%; min-height: 52px; padding: 0 12px; font: 500 17px/22px -apple-system, Inter, system-ui, sans-serif; }
    .vx6[data-plus] .plus6g .bas6 { margin: 4px 0 0; padding: 4px 0 0; border-top: .5px solid var(--n-trait); }
    .voile6 { display: block; position: fixed; inset: 0; z-index: 5; background: rgb(0 0 0 / .32); }
    /* En-tête : « Titre · compte ⋯ × », puis « Mis à jour à l'instant ⟳ » en gris (le texte reste dit). */
    .tete6 { flex-wrap: wrap; gap: 0 8px; min-height: 0; padding: max(6px, env(safe-area-inset-top)) 8px 0 16px; }
    .tete6 h1 { font: 700 22px/28px -apple-system, "SF Pro Display", Inter, system-ui, sans-serif; letter-spacing: -.01em; }
    .compte6 { max-width: 38vw; }
    .tete6 .maj6 { order: 5; flex: 0 0 auto; margin: -4px 0 0 -8px; min-height: 44px; padding: 0 8px; border: 0; background: transparent; color: var(--n-encre-2); font: 400 13px/18px -apple-system, Inter, system-ui, sans-serif; gap: 6px; }
    .tete6 .maj6 span { display: inline !important; }
    .tete6 .maj6 svg { width: 14px; height: 14px; }
    /* La barre d'outils : la recherche sur toute la largeur, puis UNE ligne d'outils qui défile (action, Statut…). */
    .barre6 { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 12px 10px; align-items: center; }
    .barre6 .cherche5 { order: -1; flex: 1 1 100%; max-width: none; }
    .barre6 > .cols5, .barre6 > .impn6, .barre6 > .vu-btn { flex: 0 0 auto; min-width: 0; }
    .barre6 > .act5 { flex: 1 1 0; min-width: 0; }
    .carte[data-grand] input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), .carte[data-grand] select, .carte[data-grand] textarea { font-size: 16px !important; }
    /* Les menus Statut / Colonnes : une feuille du bas, un voile derrière (le toucher sur le voile la referme). */
    .carte[data-grand] details.cols5[open] > summary::before { content: ''; position: fixed; inset: 0; z-index: 40; background: rgb(0 0 0 / .32); cursor: default; }
    .carte[data-grand] details.cols5 > .cols5-l { position: fixed; left: 0; right: 0; top: auto; bottom: 0; z-index: 41; min-width: 0; max-height: 70vh; overflow-y: auto; overscroll-behavior: contain; border-radius: 18px 18px 0 0; padding: 10px 8px max(12px, env(safe-area-inset-bottom)); box-shadow: 0 -10px 40px rgb(0 0 0 / .22); }
    .carte[data-grand] details.cols5 > .cols5-l label { min-height: 52px; font-size: 17px; }
    .n6 { padding: 10px 16px 6px; font-size: 13px; }
    /* Les rangées empilées : case · vignette 48 · titre complet (et la phrase d'état grise) · ⋯ ; la ligne méta dessous. */
    .table6 { margin: 0 8px; }
    .tr6, .fav6-table .tr6 { grid-template-columns: 44px minmax(0, 1fr) 44px; gap: 0 4px; padding: 6px 0 0; min-height: 0; align-items: start; }
    .tr6 > .case5 { width: 44px; height: 48px; }
    .tr6 > .plus6 { grid-column: 3; grid-row: 1; height: 48px; }
    .tr6 .art6, .fav6-table .art6 { min-height: 48px; padding: 0; gap: 12px; align-items: flex-start; }
    .tr6 .art6 .vig { width: 48px; height: 48px; }
    .tr6 .art6 .ti, .fav6-table .art6 .ti { display: block; -webkit-line-clamp: none; overflow: visible; font: 400 15px/20px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif; padding-top: 2px; overflow-wrap: anywhere; }
    .tr6 .art6 .st6 { white-space: normal; margin-top: 1px; }
    .tr6 .cels6, .fav6-table .tr6 .cels6 { grid-column: 2 / 4; grid-row: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 0; padding: 4px 8px 10px 60px; }
    .tr6 .cels6 .cel6 { display: inline-flex; align-items: center; gap: 4px; font: 400 14px/20px -apple-system, Inter, system-ui, sans-serif; color: var(--n-encre-2); white-space: nowrap; overflow: visible; }
    .tr6 .cels6 .cel6 b { color: var(--n-encre); font-weight: 600; }
    .tr6 .cels6 .cel6[data-col="date"]::before, .tr6 .cels6 .cel6[data-col="statut"]::before, .tr6 .cels6 .cel6[data-col="limite"]::before { content: '·'; margin: 0 6px; color: var(--n-encre-2); }
    .tr6 .cels6::before { content: ''; order: 4; flex: 0 0 100%; height: 0; }
    .tr6 .cels6 .cel6[data-col="vues"], .tr6 .cels6 .cel6[data-col="favoris"], .tr6 .cels6 .cel6[data-col="mini"], .tr6 .cels6 .cel6[data-col="achat"], .tr6 .cels6 .cel6[data-col="place"] { margin-right: 14px; }
    .tr6 .cels6 .lc5 { display: none !important; }
    .tr6 .cels6 .cel6[data-col="vues"] .lc5, .tr6 .cels6 .cel6[data-col="favoris"] .lc5, .tr6 .cels6 .cel6[data-col="mini"] .lc5, .tr6 .cels6 .cel6[data-col="achat"] .lc5, .tr6 .cels6 .cel6[data-col="place"] .lc5 { display: inline !important; margin: 0; font-size: 14px; }
    .tr6 .cels6 .cel6:has(> .gris6:only-of-type) { display: none; }
    .tr6 .cels6 .cel6[data-col="statut"] { order: 3; }
    .tr6 .cels6 .cel6[data-col="statut"] .et6 { padding: 0 8px; font-size: 12px; line-height: 20px; }
    .tr6 .cels6 .cel6[data-col="transporteur"], .tr6 .cels6 .cel6[data-col="bordereau"] { order: 6; flex: 0 0 100%; margin-top: 4px; white-space: normal; }
    .tr6 .cels6 .cel6[data-col="transporteur"] .tr-l6 { color: var(--n-encre); }
    .tr6 .cels6 .cel6[data-col="limite"] { order: 3; }
    .tr6 .cels6 .cel6[data-col="vues"], .tr6 .cels6 .cel6[data-col="favoris"], .tr6 .cels6 .cel6[data-col="mini"], .tr6 .cels6 .cel6[data-col="achat"], .tr6 .cels6 .cel6[data-col="place"] { order: 5; }
    .tr6 .cels6 .cel6[data-col="prix"] { order: 1; } .tr6 .cels6 .cel6[data-col="date"] { order: 2; }
    /* Notifications : les mêmes rangées fines, l'heure en gris, l'étiquette douce. */
    .trn5 { grid-template-columns: minmax(0, 1fr) auto auto 16px; gap: 0 8px; min-height: 52px; padding: 0 12px 0 16px; }
    .trn5 .cel5 { font-size: 13px; color: var(--n-encre-2); white-space: nowrap; }
    .corps6 .table5 { margin: 0 8px; }
    .corps6 .panneau > .barre5:not(.barre6) { padding: 8px 12px; gap: 8px; }
    .corps6 .panneau > .barre5:not(.barre6) > .act5 { flex: 1 1 100%; }
    .corps6 .panneau > .barre5:not(.barre6) > .vue5 { flex: 1 1 100%; display: flex; }
    .corps6 .panneau > .barre5:not(.barre6) > .vue5 > button { flex: 1 1 0; }
    /* Accueil : « Nouvelle vente · <titre> » en entier (deux lignes s'il le faut), le bouton dessous. */
    .vte6 { flex-wrap: wrap; } .vte6 > span:first-child { flex: 1 1 100%; } .vte6 > span:first-child b { white-space: normal; overflow: visible; }
    .corps6 .lu { padding: 8px 16px 6px; font-size: 13px; }
  }
  /* 5.410.5 — une vérification de Vinted AFFICHÉE sur la page : le panneau s'écarte en une pastille, en HAUT, petite,
     qui ne recouvre jamais le centre de la vérification ; la toucher rouvre le panneau. */
  .verif6 { position: fixed; top: var(--verif-haut, 12px); right: 12px; max-width: min(320px, calc(100vw - 24px)); min-height: 44px; padding: 10px 14px;
    display: flex; align-items: center; gap: 10px; text-align: left; border: 0; border-radius: 14px; cursor: pointer; pointer-events: auto;
    background: #FFF4DD; color: #3D2600; font: 600 14px/1.35 -apple-system, "SF Pro Text", Inter, system-ui, sans-serif; box-shadow: 0 6px 20px rgb(0 0 0 / .22); }
  .verif6[hidden] { display: none !important; }
  .verif6 .pv { width: 8px; height: 8px; border-radius: 4px; background: #B26A00; flex: none; }
  .verif6[data-verif="faite"] { background: #FFFFFF; color: #111114; }
  .verif6[data-verif="faite"] .pv { background: var(--n-accent, #0F6B4C); }
  @media (prefers-color-scheme: dark) { .verif6 { background: #3A2A10; color: #FFE7B8; } .verif6[data-verif="faite"] { background: #1C1C1E; color: #FFFFFF; } }
  :host([data-verif-replie]) .carte, :host([data-verif-replie]) .btn, :host([data-verif-replie]) .question, :host([data-verif-replie]) .capte { display: none !important; }
  /* ══ 5.427 — « 2ᵉ JET » (Julien, 21 nov. : « le visuel doit être mieux que ça ») ══════════════════════
     La DERNIÈRE couche de la feuille du panneau : présentation seule (aucun geste, aucune règle). Jetons et échelle de
     les maquettes du 21 nov. (docs/design/iphone-2026-11-21/) : fond très légèrement teinté, surfaces blanches à ombre douce, contours
     fins #E4E4E7, rayon 8, titres 18–22, texte 14, méta 12 ; contrôles DESSINÉS à 36 px dans une zone de 44 px (bordure
     transparente de 4 px + fond limité à la boîte intérieure : la cible reste 44, l'œil voit 36) ; étiquettes pastel
     franches ; plaque N° fine (20 px, gris très clair, encre) ; un seul plein à l'encre, compact ; secondaire à contour ;
     accent vert sapin rare (onglet actif, interrupteurs, progression) ; aucun bleu, rouge seulement doublon de N°. */
  .carte[data-grand] { --n-fond:#F1F3F6; --n-carte:#FFFFFF; --n-carte-2:#F8F9FA; --n-trait:#E4E4E7; --n-filet:#EEF0F2; --n-encre:#16181D; --n-encre-2:#5F646C; --n-encre-3:#6E737B;
    --n-neutre:#F1F2F4; --n-vert:#17744A; --n-vert-fond:#DDF4E6; --n-vert-bord:#C3EAD2; --n-teal:#0D6A6B; --n-teal-fond:#DAF0F0; --n-teal-bord:#BCE3E3;
    --n-ambre:#874600; --n-ambre-fond:#FFEBC4; --n-ambre-bord:#F8D79B; --n-gris:#4C525B; --n-gris-fond:#ECEEF1; --n-gris-bord:#DFE2E6;
    --n-ombre-xs:0 1px 2px rgb(16 24 40/.05); --n-ombre:0 1px 2px rgb(16 24 40/.04), 0 2px 6px rgb(16 24 40/.04); --n-police:var(--vu-police, Inter, -apple-system, system-ui, sans-serif);
    --vu-socle:var(--n-neutre); --vu-kraft:#F1F2F4; --vu-kraft-encre:#16181D; --vu-kraft-doux:#5F646C; --vu-kraft-bord:#E3E5E9; --vu-plein:#16181D; --vu-plein-sur-plaque:#16181D; }
  @media (prefers-color-scheme: dark) { :host(:not([data-theme="clair"])) .carte[data-grand] { --n-fond:#0E0F11; --n-carte:#17181B; --n-carte-2:#1D1F23; --n-trait:#2C2F35; --n-filet:#24272C; --n-encre:#F2F3F5; --n-encre-2:#B0B4BB; --n-encre-3:#90959D;
    --n-neutre:#24272C; --n-vert:#7FD39A; --n-vert-fond:rgb(48 209 88/.14); --n-vert-bord:rgb(48 209 88/.28); --n-teal:#7CC9CE; --n-teal-fond:rgb(124 201 206/.14); --n-teal-bord:rgb(124 201 206/.28);
    --n-ambre:#FFB340; --n-ambre-fond:rgb(255 159 10/.16); --n-ambre-bord:rgb(255 159 10/.32); --n-gris:#C3C7CE; --n-gris-fond:#24272C; --n-gris-bord:#33363D;
    --n-ombre-xs:none; --n-ombre:0 0 0 1px rgb(255 255 255/.02); --vu-kraft:#24272C; --vu-kraft-encre:#F2F3F5; --vu-kraft-doux:#A0A5AD; --vu-kraft-bord:#33363D; --vu-plein:#F2F3F5; --vu-plein-sur-plaque:#F2F3F5; } }
  :host([data-theme="sombre"]) .carte[data-grand] { --n-fond:#0E0F11; --n-carte:#17181B; --n-carte-2:#1D1F23; --n-trait:#2C2F35; --n-filet:#24272C; --n-encre:#F2F3F5; --n-encre-2:#B0B4BB; --n-encre-3:#90959D;
    --n-neutre:#24272C; --n-vert:#7FD39A; --n-vert-fond:rgb(48 209 88/.14); --n-vert-bord:rgb(48 209 88/.28); --n-teal:#7CC9CE; --n-teal-fond:rgb(124 201 206/.14); --n-teal-bord:rgb(124 201 206/.28);
    --n-ambre:#FFB340; --n-ambre-fond:rgb(255 159 10/.16); --n-ambre-bord:rgb(255 159 10/.32); --n-gris:#C3C7CE; --n-gris-fond:#24272C; --n-gris-bord:#33363D;
    --n-ombre-xs:none; --n-ombre:0 0 0 1px rgb(255 255 255/.02); --vu-kraft:#24272C; --vu-kraft-encre:#F2F3F5; --vu-kraft-doux:#A0A5AD; --vu-kraft-bord:#33363D; --vu-plein:#F2F3F5; --vu-plein-sur-plaque:#F2F3F5; }
  /* La petite carte et la question (hors du grand panneau) : la même plaque N° fine. */
  .plaque { height: 20px; padding: 0 6px; border-radius: 5px; clip-path: none; box-shadow: inset 0 0 0 1px var(--vu-kraft-bord); font-weight: 600; font-size: 12px; line-height: 20px; }
  .plaque::before { display: none; }
  .carte[data-grand] .vx6 { font: 400 14px/20px var(--n-police); color: var(--n-encre); -webkit-font-smoothing: antialiased; }
  .carte[data-grand] .vx6 svg { stroke-width: 1.5; }
  .carte[data-grand] .main6 { background: var(--n-fond); }
  .carte[data-grand] .corps6 { background: var(--n-fond); }
  /* En-tête : « Titre · puce de compte » à gauche, ⟳ et × à droite ; blanc, un filet dessous. */
  .carte[data-grand] .tete6 { background: var(--n-carte); border-bottom: 1px solid var(--n-trait); min-height: 52px; gap: 8px; }
  .carte[data-grand] .tete6 h1 { font: 600 18px/24px var(--n-police); letter-spacing: -.2px; color: var(--n-encre); }
  .carte[data-grand] .compte6 { height: 26px; padding: 0 10px 0 4px; border: 1px solid var(--n-trait); background: var(--n-carte); font: 500 12px/1 var(--n-police); color: var(--n-encre); }
  .carte[data-grand] .compte6 i { width: 18px; height: 18px; background: #0D6A6B; color: #FFFFFF; font: 600 10px/1 var(--n-police); }
  .carte[data-grand] .rond6 { color: var(--n-encre-2); font-size: 18px; border-radius: 8px; }
  .carte[data-grand] .tete6 .fermer, .carte[data-grand] .tete6 .rond6.fermer { background: transparent; width: 44px; height: 44px; }
  .carte[data-grand] .rond6:hover { background: var(--n-neutre); }
  /* Les contrôles : 36 dessinés, 44 touchés. */
  .carte[data-grand] .vx6 .vu-btn, .carte[data-grand] .vx6 .imp6, .carte[data-grand] .vx6 .maj6, .carte[data-grand] .vx6 .filtre5, .carte[data-grand] .vx6 details.cols5 > summary,
  .carte[data-grand] .vx6 .fp-ins button, .carte[data-grand] .vx6 .fp-ajout, .carte[data-grand] .vx6 .fl-puce, .carte[data-grand] .vx6 .pu6,
  .carte[data-grand] .vx6 .vu-seg button, .carte[data-grand] .vx6 .seg6 button {
    box-sizing: border-box; min-height: 44px; padding: 0 12px; border: 4px solid transparent !important; border-left-width: 0 !important; border-right-width: 0 !important;
    background-clip: padding-box !important; border-radius: 8px / 12px; box-shadow: inset 0 0 0 1px var(--n-trait); background-color: var(--n-carte); color: var(--n-encre);
    font: 500 14px/20px var(--n-police); letter-spacing: 0; text-decoration: none; }
  .carte[data-grand] .vx6 .vu-btn:hover:not(:disabled), .carte[data-grand] .vx6 .imp6:hover:not(:disabled), .carte[data-grand] .vx6 .maj6:hover, .carte[data-grand] .vx6 details.cols5 > summary:hover { background-color: var(--n-carte-2); }
  .carte[data-grand] .vx6 .vu-btn.vu-plein, .carte[data-grand] .vx6 .vu-plein { background-color: var(--n-encre) !important; color: var(--n-carte) !important; box-shadow: none !important; font-weight: 600; }
  .carte[data-grand] .vx6 .vu-btn.vu-plein:hover:not(:disabled) { filter: brightness(1.12); }
  .carte[data-grand] .vx6 .vu-btn.vu-sec, .carte[data-grand] .vx6 .geste6 .vu-btn:not(.vu-plein), .carte[data-grand] .vx6 .champ6.ot6 .vu-btn { background-color: var(--n-carte); color: var(--n-encre); box-shadow: inset 0 0 0 1px var(--n-trait); }
  .carte[data-grand] .vx6 .vu-btn:active:not(:disabled) { transform: scale(.98); }
  .carte[data-grand] .vx6 .vu-lien { min-height: 44px; padding: 0 4px; font: 500 14px/20px var(--n-police); color: var(--n-encre); text-decoration: none; }
  .carte[data-grand] .vx6 .vu-lien:hover { text-decoration: underline; text-underline-offset: 3px; }
  /* Les filtres et segments : des puces à contour, la choisie enfoncée (fond gris clair, contour d'encre). */
  .carte[data-grand] .vx6 .vu-seg, .carte[data-grand] .vx6 .seg6 { background: transparent !important; padding: 0; gap: 6px; border-radius: 0; box-shadow: none; }
  .carte[data-grand] .vx6 .vu-seg button, .carte[data-grand] .vx6 .seg6 button { color: var(--n-encre-2); padding: 0 10px; font-size: 13px; }
  .carte[data-grand] .vx6 .vu-seg button b, .carte[data-grand] .vx6 .seg6 button b { font-weight: 600; color: var(--n-encre-3); opacity: 1; margin-left: 4px; font-variant-numeric: tabular-nums; }
  .carte[data-grand] .vx6 .vu-seg button[aria-selected="true"], .carte[data-grand] .vx6 .vu-seg button[aria-pressed="true"], .carte[data-grand] .vx6 .seg6 button[aria-selected="true"], .carte[data-grand] .vx6 .seg6 button[aria-pressed="true"],
  .carte[data-grand] .vx6 .pu6[aria-pressed="true"], .carte[data-grand] .vx6 .fl-puce[aria-pressed="true"], .carte[data-grand] .vx6 .filtre5[aria-pressed="true"] {
    background-color: var(--n-neutre) !important; color: var(--n-encre) !important; box-shadow: inset 0 0 0 1px var(--n-encre-3) !important; }
  .carte[data-grand] .vx6 .vu-seg button[aria-selected="true"] b, .carte[data-grand] .vx6 .seg6 button[aria-pressed="true"] b, .carte[data-grand] .vx6 .seg6 button[aria-selected="true"] b { color: var(--n-encre-2); }
  .carte[data-grand] .vx6 .ven6-seg { display: flex; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; gap: 6px; margin: 10px 16px 0; padding: 0; }
  .carte[data-grand] .vx6 .ven6-seg::-webkit-scrollbar { display: none; }
  .carte[data-grand] .vx6 .ven6-seg button { flex: 0 0 auto; }
  /* Les champs : blancs, contour fin, rayon 8, dessinés à 36. */
  .carte[data-grand] .vx6 .cherche5, .carte[data-grand] .vx6 .act5, .carte[data-grand] .vx6 .prix6, .carte[data-grand] .vx6 .geste6 select, .carte[data-grand] .vx6 .fp6 select, .carte[data-grand] .vx6 .fl-filtres select,
  .carte[data-grand] .vx6 .champ6 input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), .carte[data-grand] .vx6 .env6-libre input, .carte[data-grand] .vx6 .fp6 .cd6-l input[type=number] {
    box-sizing: border-box; min-height: 44px; padding: 0 10px; border: 4px solid transparent !important; border-left-width: 0 !important; border-right-width: 0 !important; background-clip: padding-box !important;
    border-radius: 8px / 12px; background-color: var(--n-carte); box-shadow: inset 0 0 0 1px var(--n-trait); color: var(--n-encre); font: 400 14px/20px var(--n-police); }
  .carte[data-grand] .vx6 .cherche5::placeholder { color: var(--n-encre-3); }
  .carte[data-grand] .vx6 .act5 { color: var(--n-encre-2); }
  .carte[data-grand] .vx6 .cherche5:focus, .carte[data-grand] .vx6 .act5:focus, .carte[data-grand] .vx6 .champ6 input:focus, .carte[data-grand] .vx6 .prix6:focus { outline: none; box-shadow: inset 0 0 0 1.5px var(--n-encre); }
  .carte[data-grand] .vx6 textarea { border: 1px solid var(--n-trait) !important; border-radius: 8px; background: var(--n-carte); color: var(--n-encre); box-shadow: var(--n-ombre-xs); }
  .carte[data-grand] .vx6 input[type=checkbox] { accent-color: var(--n-encre); width: 16px; height: 16px; }
  /* La barre d'outils : blanche, un filet dessous. */
  .carte[data-grand] .barre6 { background: var(--n-carte); border-bottom: 1px solid var(--n-trait); padding: 8px 16px; gap: 6px; }
  .carte[data-grand] .n6 { padding: 10px 16px 8px; font: 400 12px/16px var(--n-police); color: var(--n-encre-2); }
  .carte[data-grand] .n6 .vue5 button { min-width: 44px; padding: 0 8px; }
  /* Les tableaux : une carte blanche à contour, rayon 12, ombre douce ; des rangées séparées d'un filet très clair. */
  .carte[data-grand] .table6, .carte[data-grand] .corps6 .table5 { margin: 0 16px; border: 1px solid var(--n-trait); border-radius: 12px; background: var(--n-carte); box-shadow: var(--n-ombre); overflow: hidden; }
  .carte[data-grand] .table6 .rangs > li + li, .carte[data-grand] .corps6 .table5 .rangs > li + li, .carte[data-grand] .rangs > li + li { border-top: 1px solid var(--n-filet); }
  .carte[data-grand] .th6r { background: var(--n-carte); border-bottom: 1px solid var(--n-trait); min-height: 44px; }
  .carte[data-grand] .th6 { font: 500 12px/16px var(--n-police); color: var(--n-encre-2); min-height: 44px; }
  .carte[data-grand] .tr6 { min-height: 56px; }
  .carte[data-grand] .table6 li[data-coche] > .tr6 { background: var(--n-carte-2); }
  .carte[data-grand] .art6 { min-height: 56px; gap: 10px; }
  .carte[data-grand] .art6 .vig, .carte[data-grand] .rang .vig, .carte[data-grand] .fl-r-l .vig, .carte[data-grand] .fl-r-l img, .carte[data-grand] .vig6 { border-radius: 10px; background: var(--n-gris-fond); box-shadow: 0 0 0 1px rgb(0 0 0/.04); }
  .carte[data-grand] .art6 .ti { font: 400 14px/18px var(--n-police); color: var(--n-encre); }
  .carte[data-grand] .art6 .st6 { font: 400 12px/16px var(--n-police); color: var(--n-encre-3); margin-top: 2px; }
  .carte[data-grand] .cel6 { font: 400 13px/18px var(--n-police); color: var(--n-encre); }
  .carte[data-grand] .cel6[data-col="prix"] b, .carte[data-grand] .cel6 b { font-weight: 600; }
  .carte[data-grand] .plus6 { color: var(--n-encre-2); font-size: 18px; border-radius: 8px; }
  /* Les étiquettes : pastel franches, 20 px, un liseré de la même teinte. */
  .carte[data-grand] .et6 { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 999px; font: 600 11.5px/1 var(--n-police); background: var(--n-gris-fond); color: var(--n-gris); box-shadow: inset 0 0 0 1px var(--n-gris-bord); }
  .carte[data-grand] .et6[data-ton="ambre"] { background: var(--n-ambre-fond); color: var(--n-ambre); box-shadow: inset 0 0 0 1px var(--n-ambre-bord); }
  .carte[data-grand] .et6[data-statut="en_vente"], .carte[data-grand] .et6[data-statut="finalisee"], .carte[data-grand] .et6[data-statut="envoye"], .carte[data-grand] .et6[data-statut="offre"] { background: var(--n-vert-fond); color: var(--n-vert); box-shadow: inset 0 0 0 1px var(--n-vert-bord); }
  .carte[data-grand] .et6[data-statut="en_route"], .carte[data-grand] .et6[data-ton="accent"] { background: var(--n-teal-fond); color: var(--n-teal); box-shadow: inset 0 0 0 1px var(--n-teal-bord); }
  /* La plaque N° : fine et discrète (20 px, 12 px, gris très clair, encre) — plus de kraft, de coin coupé ni d'œillet. */
  .carte[data-grand] .vu-n, .carte[data-grand] .plaque { height: 20px; padding: 0 6px; gap: 2px; align-items: center; border-radius: 5px; clip-path: none; background: var(--vu-kraft); color: var(--vu-kraft-encre);
    box-shadow: inset 0 0 0 1px var(--vu-kraft-bord); font: 600 12px/20px var(--n-police); vertical-align: 1px; }
  .carte[data-grand] .vu-n::before, .carte[data-grand] .plaque::before { display: none; }
  .carte[data-grand] .vu-n small, .carte[data-grand] .plaque i { font-size: 11px; font-weight: 500; color: var(--vu-kraft-doux); }
  .carte[data-grand] .vu-n.vu-grand { height: 24px; padding: 0 8px; font-size: 14px; line-height: 24px; clip-path: none; }
  .carte[data-grand] .vu-n.vu-grand small { font-size: 12px; }
  .carte[data-grand] .et5, .carte[data-grand] .st5 { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 999px; font: 600 11.5px/1 var(--n-police); background: var(--n-gris-fond); color: var(--n-gris); box-shadow: inset 0 0 0 1px var(--n-gris-bord); white-space: nowrap; }
  .carte[data-grand] .et5[data-etat="on"] { background: var(--n-vert-fond); color: var(--n-vert); box-shadow: inset 0 0 0 1px var(--n-vert-bord); }
  .carte[data-grand] .st5[data-statut="nouveau"] { background: var(--n-ambre-fond); color: var(--n-ambre); box-shadow: inset 0 0 0 1px var(--n-ambre-bord); }
  .carte[data-grand] .trn5 .ti { font: 500 14px/18px var(--n-police); color: var(--n-encre); }
  .carte[data-grand] .trn5 .cel5 { font: 400 12px/16px var(--n-police); color: var(--n-encre-2); }
  .carte[data-grand] .vx6 select { box-sizing: border-box; min-height: 44px; padding: 0 10px; border: 4px solid transparent !important; border-left-width: 0 !important; border-right-width: 0 !important; background-clip: padding-box !important;
    border-radius: 8px / 12px; background-color: var(--n-carte); box-shadow: inset 0 0 0 1px var(--n-trait); color: var(--n-encre); font: 400 14px/20px var(--n-police); }
  .carte[data-grand] .tr6 .plus6 { font-size: 16px; }
  .carte[data-grand] .cols5-l label b, .carte[data-grand] .cols5-l label span { font-size: inherit; }
  /* Les listes (Messagerie, Notifications, Accueil…) : la même échelle. */
  .carte[data-grand] .rang { min-height: 56px; padding: 8px 16px; gap: 10px; }
  .carte[data-grand] .rang .vig { width: 48px; height: 48px; }
  .carte[data-grand] .rang .ti, .carte[data-grand] .au6-i .ti { font: 500 14px/18px var(--n-police); color: var(--n-encre); }
  .carte[data-grand] .rang.nonlu .ti { font-weight: 600; }
  .carte[data-grand] .rang .me, .carte[data-grand] .au6-i .me { font: 400 12px/16px var(--n-police); color: var(--n-encre-2); }
  .carte[data-grand] .rang .px { font: 600 14px/18px var(--n-police); }
  .carte[data-grand] .rang .px.quand { font: 400 12px/16px var(--n-police); color: var(--n-encre-2); }
  .carte[data-grand] .av6 { width: 36px; height: 36px; font: 600 13px/1 var(--n-police); background: var(--n-gris-fond); color: var(--n-gris); }
  .carte[data-grand] .au6-i { min-height: 56px; padding: 10px 16px; }
  .carte[data-grand] .au6-i[aria-selected="true"] { background: var(--n-carte-2); box-shadow: inset 2px 0 0 var(--n-accent); }
  .carte[data-grand] .au6-t h2 { font: 600 18px/24px var(--n-police); letter-spacing: -.2px; }
  .carte[data-grand] .au6-t p, .carte[data-grand] .note5, .carte[data-grand] .fp6 .fp-sous, .carte[data-grand] .et10-n, .carte[data-grand] .fl-note { font: 400 13px/18px var(--n-police); color: var(--n-encre-2); }
  .carte[data-grand] .sec6 h3, .carte[data-grand] .grp5 h3, .carte[data-grand] .grp6 { font: 500 12px/16px var(--n-police); letter-spacing: 0; text-transform: none; color: var(--n-encre-2); }
  .carte[data-grand] .geste6 h3, .carte[data-grand] .fp6 h3, .carte[data-grand] .conv5-t b { font: 600 15px/20px var(--n-police); letter-spacing: -.1px; color: var(--n-encre); }
  .carte[data-grand] .rg6, .carte[data-grand] .rg5, .carte[data-grand] .champ6 { border-bottom: 1px solid var(--n-filet); border-top-color: var(--n-filet); }
  .carte[data-grand] .rg6 { min-height: 52px; }
  .carte[data-grand] .rg6 b, .carte[data-grand] .champ6 b, .carte[data-grand] .fp-vt b, .carte[data-grand] .fp-rt b { font: 500 14px/20px var(--n-police); color: var(--n-encre); }
  .carte[data-grand] .rg6 small, .carte[data-grand] .champ6 small, .carte[data-grand] .champ6 .note5 { font: 400 12px/16px var(--n-police); color: var(--n-encre-2); }
  .carte[data-grand] .rg6 .v6, .carte[data-grand] .cd6-l output { font: 600 14px/20px var(--n-police); }
  .carte[data-grand] .rg5 { font: 400 14px/20px var(--n-police); }
  .carte[data-grand] .rg5 i { font-size: 16px; color: var(--n-encre-3); }
  .carte[data-grand] .f5 { background: var(--n-carte); padding: 10px 12px; }
  .carte[data-grand] .f5 span { font: 500 12px/16px var(--n-police); color: var(--n-encre-2); }
  .carte[data-grand] .f5 b { font: 600 14px/20px var(--n-police); }
  .carte[data-grand] .desc5, .carte[data-grand] .conv5 .bulle { font: 400 14px/20px var(--n-police); }
  .carte[data-grand] .conv5 .bulle { border-radius: 12px; background: var(--n-carte-2); border: 1px solid var(--n-filet); }
  /* Les tuiles de chiffres (Accueil, Santé, Statistiques) : cartes blanches, libellé 12, chiffre 20. */
  .carte[data-grand] .tuiles6 { gap: 8px; }
  .carte[data-grand] .tu6 { background: var(--n-carte); border: 1px solid var(--n-trait); border-radius: 12px; box-shadow: var(--n-ombre); padding: 12px; }
  .carte[data-grand] .tu6 span { font: 500 12px/16px var(--n-police); color: var(--n-encre-2); }
  .carte[data-grand] .tu6 b { font: 600 20px/28px var(--n-police); letter-spacing: -.2px; margin-top: 2px; }
  .carte[data-grand] .ag5-t { background: var(--n-carte); border-color: var(--n-trait); }
  .carte[data-grand] .ag5-t b { font: 600 18px/24px var(--n-police); }
  /* Les blocs posés (Accueil, gestes, offres) : des surfaces blanches à contour, jamais des fonds gris lourds. */
  .carte[data-grand] .geste6, .carte[data-grand] .conf5, .carte[data-grand] .msg6 { background: var(--n-carte); border: 1px solid var(--n-trait); border-radius: 12px; box-shadow: var(--n-ombre); }
  .carte[data-grand] .conf5 { font: 500 14px/20px var(--n-police); }
  .carte[data-grand] .fav6-file { background: var(--n-ambre-fond); box-shadow: inset 0 0 0 1px var(--n-ambre-bord); border-radius: 12px; }
  .carte[data-grand] .fav6-file > span { font: 600 14px/20px var(--n-police); }
  .carte[data-grand] .fav6-bas, .carte[data-grand] .ven6-conf { background: var(--n-carte); border: 1px solid var(--n-trait); border-radius: 12px; box-shadow: 0 4px 16px rgb(16 24 40/.08); }
  .carte[data-grand] .fav6-bas-t { font: 600 14px/20px var(--n-police); }
  .carte[data-grand] .fav6-bas-t small { font: 400 12px/16px var(--n-police); }
  .carte[data-grand] .ext6 { margin: 8px 16px 0; }
  .carte[data-grand] .ext6 > * { background: var(--n-carte) !important; border: 1px solid var(--n-trait); border-radius: 12px !important; box-shadow: var(--n-ombre) !important; color: var(--n-encre) !important; }
  .carte[data-grand] .ext6 > :not(.champ6) { padding: 12px 14px !important; }
  .carte[data-grand] .ext6 .principal .p-t { font: 600 14px/20px var(--n-police); }
  .carte[data-grand] .ext6 .principal .p-t .p-n { font-size: 15px; }
  .carte[data-grand] .ext6 .principal .p-l2 { font: 500 13px/18px var(--n-police); }
  .carte[data-grand] .ext6 .vu-bandeau { background: var(--n-carte-2); color: var(--n-encre); border: 1px solid var(--n-trait); }
  /* L'onglet de travail : UNE ligne discrète « ● Onglet de travail actif · Voir » (le chemin reste dit à l'ordinateur). */
  .carte[data-grand] .ext6 > .champ6.ot6 { display: flex; flex-direction: row; align-items: center; gap: 8px; min-height: 44px; padding: 0 4px 0 12px; border: 1px solid var(--n-trait); border-radius: 8px !important; box-shadow: none !important; background: var(--n-carte) !important; }
  .carte[data-grand] .champ6.ot6 { justify-content: flex-start; gap: 8px; }
  .carte[data-grand] .champ6.ot6 > span { flex: 0 1 auto; flex-direction: row; align-items: baseline; gap: 6px; min-width: 0; overflow: hidden; }
  .carte[data-grand] .champ6.ot6::before { content: ''; flex: none; width: 6px; height: 6px; border-radius: 3px; background: var(--n-accent); }
  .carte[data-grand] .champ6.ot6[data-onglet-travail="repos"]::before { background: var(--n-encre-3); }
  .carte[data-grand] .champ6.ot6 b { font: 500 13px/18px var(--n-police); color: var(--n-encre); white-space: nowrap; }
  .carte[data-grand] .champ6.ot6 .note5 { font: 400 12px/16px var(--n-police); color: var(--n-encre-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .carte[data-grand] .champ6.ot6 .vu-btn { min-height: 44px; padding: 0 10px; border: 0 !important; box-shadow: none !important; background: transparent !important; font: 500 13px/18px var(--n-police); color: var(--n-encre); }
  .carte[data-grand] .champ6.ot6 .vu-btn:hover { text-decoration: underline; text-underline-offset: 3px; }
  /* Seule dans son bloc, la ligne fait partie de la tête : blanche sous le titre, un filet dessous, « · Voir » à la suite. */
  .carte[data-grand] .ext6:has(> .champ6.ot6:only-child) { margin: 0; }
  .carte[data-grand] .ext6 > .champ6.ot6:only-child { min-height: 44px; padding: 0 8px 0 16px; border: 0; border-bottom: 1px solid var(--n-trait); border-radius: 0 !important; background: var(--n-carte) !important; justify-content: flex-start; }
  .carte[data-grand] .champ6.ot6 > span { flex: 0 1 auto; }
  .carte[data-grand] .champ6.ot6 .vu-btn { padding: 0 8px 0 0; }
  .carte[data-grand] .champ6.ot6 .vu-btn::before { content: '·'; margin-right: 6px; color: var(--n-encre-3); }
  /* Le parcours en étapes (favoris) : des pastilles numérotées et leur nom ; au téléphone, une barre de progression fine
     de 4 segments, et « Étape 1 sur 4 · Sélection » dit dessous — jamais un libellé coupé. */
  .carte[data-grand] .et10 { gap: 6px; margin: 0 0 4px; }
  .carte[data-grand] .et10 li { padding: 6px 0; border-bottom: 2px solid var(--n-trait); font: 500 13px/18px var(--n-police); color: var(--n-encre-2); gap: 6px; }
  .carte[data-grand] .et10 li span { overflow: visible; text-overflow: clip; white-space: nowrap; }
  .carte[data-grand] .et10 li i { width: 20px; height: 20px; font: 600 11px/1 var(--n-police); background: var(--n-carte); box-shadow: inset 0 0 0 1px var(--n-trait); color: var(--n-encre-2); }
  .carte[data-grand] .et10 li[aria-current="step"] { color: var(--n-encre); border-bottom-color: var(--n-accent); }
  .carte[data-grand] .et10 li[aria-current="step"] i { background: var(--n-encre); box-shadow: none; color: var(--n-carte); }
  .carte[data-grand] .et10 li[data-fait] { border-bottom-color: var(--n-accent); }
  .carte[data-grand] .et10 li[data-fait] i { background: var(--n-accent); box-shadow: none; color: #FFFFFF; }
  @media (max-width: 560px) {
    .carte[data-grand] .et10 { gap: 4px; margin: 2px 0 8px; }
    .carte[data-grand] .et10 li, .carte[data-grand] .et10 li:not([aria-current]), .carte[data-grand] .et10 li[aria-current] { flex: 1 1 0; height: 4px; min-height: 0; padding: 0; border: 0; border-radius: 2px; background: var(--n-trait); font-size: 0; }
    .carte[data-grand] .et10 li i, .carte[data-grand] .et10 li span { display: none !important; }
    .carte[data-grand] .et10 li[aria-current="step"], .carte[data-grand] .et10 li[data-fait] { background: var(--n-accent); }
    .carte[data-grand] .et10-n { margin: 0 0 8px; font: 500 12px/16px var(--n-police); color: var(--n-encre-2); }
  }
  .carte[data-grand] .etapes5 li { font: 500 12px/16px var(--n-police); border-top-width: 2px; }
  /* Les rangées de la feuille (sélection, récapitulatif) : vignette 40, titre 14, méta 12 ; « Retirer » = un ✕ discret. */
  .carte[data-grand] .fl-r-l { background: var(--n-carte); border: 1px solid var(--n-trait); border-radius: 12px; padding: 0 4px 0 12px; box-shadow: var(--n-ombre); }
  .carte[data-grand] .fl-r-l > li { grid-template-columns: 40px minmax(0, 1fr) auto; gap: 0 10px; min-height: 56px; padding: 8px 0; }
  .carte[data-grand] .fl-r-l > li + li { border-top: 1px solid var(--n-filet); }
  .carte[data-grand] .fl-r-l .vig, .carte[data-grand] .fl-r-l img { width: 40px; height: 40px; }
  .carte[data-grand] .fl-ti { font: 400 14px/18px var(--n-police); color: var(--n-encre); }
  .carte[data-grand] .fl-me, .carte[data-grand] .fl-mini, .carte[data-grand] .fl-px s { font: 400 12px/16px var(--n-police); color: var(--n-encre-2); }
  .carte[data-grand] .fl-px { font: 600 14px/18px var(--n-police); }
  .carte[data-grand] .fl-etat { font: 500 12px/16px var(--n-police); }
  .carte[data-grand] .fl-duree { font: 500 13px/18px var(--n-police); }
  .carte[data-grand] .et10-sel [data-fav-etape-retirer] { width: 44px; min-width: 44px; height: 44px; min-height: 44px; padding: 0; justify-content: center; border-radius: 8px; color: var(--n-encre-3); font-size: 0; }
  .carte[data-grand] .et10-sel [data-fav-etape-retirer]::before { content: '✕'; font: 400 14px/1 var(--n-police); }
  .carte[data-grand] .et10-sel [data-fav-etape-retirer]:hover { background: var(--n-neutre); color: var(--n-encre); text-decoration: none; }
  .carte[data-grand] .et10-r li { padding: 10px 0; border-bottom: 1px solid var(--n-filet); font: 400 14px/20px var(--n-police); }
  .carte[data-grand] .et10-r li span { font-size: 13px; color: var(--n-encre-2); }
  .carte[data-grand] .et10-qui { font: 500 14px/20px var(--n-police); }
  /* « 5 favoris seront sautés » : une ligne à chevron, jamais un lien brut entre parenthèses. */
  .carte[data-grand] .et10-sautes { margin-top: 4px; border-top: 1px solid var(--n-filet); }
  .carte[data-grand] .et10-sautes summary { list-style: none; justify-content: space-between; gap: 8px; font: 400 13px/18px var(--n-police); color: var(--n-encre-2); }
  .carte[data-grand] .et10-sautes summary::-webkit-details-marker { display: none; }
  .carte[data-grand] .et10-sautes summary::after { content: ''; flex: none; width: 6px; height: 6px; margin-right: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg) translateY(-2px); opacity: .7; }
  .carte[data-grand] .et10-sautes[open] summary::after { transform: rotate(225deg); }
  .carte[data-grand] .et10-sautes ul { margin: 0 0 6px; padding: 0 0 0 2px; list-style: none; font-size: 13px; color: var(--n-encre-2); }
  .carte[data-grand] .et10-sautes li b { color: var(--n-encre); font-weight: 600; margin-right: 4px; }
  /* Le pied des feuilles et des parcours : collant, un filet dessus, les boutons à la même hauteur ; « Annuler » à
     contour, le plein compact à côté. */
  .carte[data-grand] .et10-pied, .carte[data-grand] .fav6-reg .pied6 { position: sticky; bottom: calc(-1 * max(12px, env(safe-area-inset-bottom))); z-index: 2; display: flex; gap: 8px; justify-content: flex-end; align-items: center; margin: 12px -16px 0; padding: 8px 16px max(8px, env(safe-area-inset-bottom)); background: var(--n-carte); border-top: 1px solid var(--n-trait); }
  .carte[data-grand] .et10-pied .vu-btn, .carte[data-grand] .fav6-reg .pied6 .vu-btn { flex: 0 0 auto; width: auto; min-width: 104px; min-height: 44px; height: 44px; margin: 0; padding: 0 16px; border-radius: 8px / 12px; }
  .carte[data-grand] .et10-pied .vu-plein { flex: 0 0 auto; }
  @media (max-width: 560px) { .carte[data-grand] .et10-pied .vu-btn { flex: 1 1 0; min-width: 0; } }
  /* Les feuilles : une poignée, le titre et le × alignés sur une ligne, un fond blanc. */
  .carte[data-grand] .fav6-voile { background: rgb(16 24 40/.36); }
  .carte[data-grand] .fav6-feuille { background: var(--n-carte); border-radius: 14px; padding: 0 0 12px; box-shadow: 0 20px 50px rgb(16 24 40/.22); }
  .carte[data-grand] .fe6-h { position: sticky; top: 0; z-index: 3; display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 4px 4px 0 16px; background: var(--n-carte); }
  .carte[data-grand] .fe6-h b { flex: 1 1 auto; min-width: 0; font: 600 16px/22px var(--n-police); letter-spacing: -.1px; color: var(--n-encre); }
  .carte[data-grand] .fe6-h .fav6-x { position: static; top: auto; right: auto; color: var(--n-encre-2); font-size: 20px; }
  .carte[data-grand] .fav6-feuille .fl-recap { padding: 0 16px; }
  .carte[data-grand] .fav6-feuille .fav6-reg { padding: 0 16px; }
  .carte[data-grand] .fav6-reg h3 { font: 600 16px/22px var(--n-police); margin: 4px 0 10px; }
  @media (max-width: 760px) {
    .carte[data-grand] .fav6-feuille { border-radius: 14px 14px 0 0; padding-top: 10px; }
    .carte[data-grand] .fav6-feuille::before { content: ''; position: sticky; top: 0; z-index: 4; display: block; width: 36px; height: 4px; margin: 0 auto -4px; border-radius: 2px; background: var(--n-trait); }
  }
  /* La barre latérale (ordinateur) : 14 px, l'onglet actif sur voile vert sapin pâle. */
  .carte[data-grand] .side6 { background: var(--n-carte); border-right: 1px solid var(--n-trait); }
  .carte[data-grand] .nav6 { font: 500 14px/20px var(--n-police); min-height: 44px; color: var(--n-encre); border-radius: 8px; }
  .carte[data-grand] .nav6[aria-current="page"] { background: var(--n-teinte); color: var(--n-accent); font-weight: 600; }
  .carte[data-grand] .marque6 { font: 700 15px/20px var(--n-police); }
  .carte[data-grand] .cols5-l { background: var(--n-carte); border: 1px solid var(--n-trait); border-radius: 10px; box-shadow: 0 8px 24px rgb(16 24 40/.12); }
  .carte[data-grand] .cols5-l label { font: 400 14px/20px var(--n-police); }
  @media (max-width: 760px) {
    .carte[data-grand] .tete6 { padding: max(6px, env(safe-area-inset-top)) 4px 0 16px; min-height: 0; }
    .carte[data-grand] .tete6 h1 { font: 700 20px/26px var(--n-police); letter-spacing: -.3px; }
    .carte[data-grand] .tete6 .maj6 { margin: -10px 0 -2px -10px; padding: 0 10px; border: 0 !important; box-shadow: none !important; background: transparent !important; font: 400 12px/16px var(--n-police); color: var(--n-encre-2); }
    .carte[data-grand] .tete6 .maj6 svg { width: 13px; height: 13px; }
    .carte[data-grand] .barre6 { padding: 8px 12px; }
    .carte[data-grand] .table6, .carte[data-grand] .corps6 .table5 { margin: 0 12px; }
    .carte[data-grand] .ext6 { margin: 8px 12px 0; }
    .carte[data-grand] .ext6 > .champ6.ot6 { min-height: 40px; }
    .carte[data-grand] .champ6.ot6 .note5 { display: none; }
    .carte[data-grand] .vx6 .ven6-seg { margin: 8px 12px 0; }
    .carte[data-grand] .tr6 { padding-top: 4px; }
    .carte[data-grand] .tr6 .art6 .ti, .carte[data-grand] .fav6-table .art6 .ti { font: 400 14px/18px var(--n-police); padding-top: 1px; }
    .carte[data-grand] .tr6 .cels6, .carte[data-grand] .fav6-table .tr6 .cels6 { padding: 2px 8px 10px 60px; }
    .carte[data-grand] .tr6 .cels6 .cel6, .carte[data-grand] .fav6-table .cel6 { font: 400 12px/18px var(--n-police); color: var(--n-encre-2); }
    .carte[data-grand] .tr6 .cels6 .cel6 b { font: 600 14px/18px var(--n-police); color: var(--n-encre); }
    .carte[data-grand] .tr6 .cels6 .cel6[data-col="statut"] .et6, .carte[data-grand] .fav6-table .cel6 .et6 { height: 20px; padding: 0 8px; font-size: 11.5px; line-height: 1; }
    .carte[data-grand] .tr6 .cels6 .cel6[data-col="vues"] .lc5, .carte[data-grand] .tr6 .cels6 .cel6[data-col="favoris"] .lc5, .carte[data-grand] .tr6 .cels6 .cel6[data-col="mini"] .lc5,
    .carte[data-grand] .tr6 .cels6 .cel6[data-col="achat"] .lc5, .carte[data-grand] .tr6 .cels6 .cel6[data-col="place"] .lc5 { font-size: 12px; }
    .carte[data-grand] .side6 { border-top: 1px solid var(--n-trait); border-right: 0; background: var(--n-carte); }
    .carte[data-grand] .side6 > .nav6, .carte[data-grand] .side6 .plusb6 { font: 500 10.5px/12px var(--n-police); color: var(--n-encre-2); }
    .carte[data-grand] .side6 > .nav6[aria-current="page"], .carte[data-grand] .side6 .plusb6[aria-current="page"], .carte[data-grand] .side6 .plusb6[aria-expanded="true"] { color: var(--n-accent); font-weight: 600; background: transparent; }
    .carte[data-grand] .side6 > .nav6 svg, .carte[data-grand] .side6 .plusb6 svg { width: 20px; height: 20px; }
    .carte[data-grand] .vx6[data-plus] .plus6g { border-radius: 14px 14px 0 0; }
    .carte[data-grand] .vx6[data-plus] .plus6g .nav6 { font: 500 15px/20px var(--n-police); min-height: 48px; }
    .carte[data-grand] .vx6[data-plus] .plus6t { font: 500 12px/16px var(--n-police); }
    .carte[data-grand] details.cols5 > .cols5-l { border-radius: 14px 14px 0 0; border: 0; }
    .carte[data-grand] details.cols5 > .cols5-l label { min-height: 48px; font-size: 15px; }
    .carte[data-grand] .tuiles6 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .carte[data-grand] .geste6 { margin: 8px 12px; padding: 12px; }
    .carte[data-grand] .rang { padding: 8px 12px; }
    .carte[data-grand] .sec6 { padding: 10px 16px 4px; }
    .carte[data-grand] .au6-t { padding: 12px 16px; }
    .carte[data-grand] .pied6 { padding: 10px 16px; }
  }
  /* ══ fin 5.427 ══ */
</style>
<div class="carte" part="carte"><div class="contenu"></div><div class="connexion" hidden></div></div>
<div class="question" role="dialog" aria-label="Confirmer le compte Vinted"></div>
<div class="capte" role="status" aria-live="polite" data-capte hidden></div>
<button class="verif6" type="button" data-verif-pastille hidden></button>
<button class="btn" title="VRM" aria-label="VRM"><span class="pt"></span></button>`;

  U.monter(ombre);   // 5.406 : la feuille commune d'abord (les règles de la carte, plus bas, la précisent)
  const btn = ombre.querySelector('.btn');
  const pt = ombre.querySelector('.pt');
  const carte = ombre.querySelector('.carte');
  const contenu = carte.querySelector('.contenu');
  const connexion = carte.querySelector('.connexion');
  const question = ombre.querySelector('.question');

  // ══ 5.332 : LE CADRE (dans l'iframe de l'extension) ══════════════════════
  // Le formulaire seul, posé à plat dans la page de l'extension : ni logo, ni
  // état, ni verre (le verre est celui de la carte du site, derrière). Il dit à
  // la carte du site qu'il s'affiche (« prête ») et sa hauteur — rien d'autre
  // ne sort d'ici (ni e-mail, ni code, ni mot de passe, ni état).
  const direAuSite = (d) => { if (!CADRE) return; try { window.parent.postMessage(Object.assign({ __vrmCarte: '' }, d), '*'); } catch (_) {} };
  if (LISTES) {
    const st = document.createElement('style');
    st.textContent = `.btn, .question, .connexion, .capte { display: none !important; }
  .carte, .carte.on { position: static; display: block; width: auto; max-width: 560px; max-height: none; overflow: visible; margin: 8px auto 24px; animation: none; }`;
    ombre.appendChild(st);
    carte.classList.add('on');
  }
  if (CADRE) {
    const st = document.createElement('style');
    st.textContent = `.btn, .question, .contenu { display: none !important; }
  .carte, .carte.on { position: static; display: block; width: auto; max-height: none; overflow: visible; background: transparent; border: 0;
    box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; padding: 0; border-radius: 0; }
  .connexion, .carte > .connexion { margin: 0; border: 0; border-top: 0; padding: 0 0 2px; border-radius: 0; background: transparent; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; }
  .carte.on { animation: none; }`;
    ombre.appendChild(st);
    carte.classList.add('on');
    // Le cadre part (navigation, quelle qu'elle soit) : la carte le cache AVANT
    // que l'autre page ne s'affiche, et attend un nouveau « prête ».
    try { window.addEventListener('pagehide', () => direAuSite({ __vrmCarte: 'depart' })); } catch (_) {}
    try { new ResizeObserver(() => direAuSite({ __vrmCarte: 'hauteur', h: Math.ceil(hote.getBoundingClientRect().height) + 6 })).observe(hote); } catch (_) {}
  }

  // Le logo de l'app (le même qu'en haut de chaque écran de VRM). S'il ne
  // charge pas : « VRM » en texte, jamais une image cassée.
  const img = document.createElement('img');
  img.alt = 'VRM';
  // 5.351 : l'image ne se « tire » pas comme un fichier (sinon le navigateur annule
  // le glisser du logo par un `pointercancel`).
  img.draggable = false;
  img.addEventListener('dragstart', (ev) => ev.preventDefault());
  img.addEventListener('error', () => { img.remove(); const t = document.createElement('span'); t.className = 'txt'; t.textContent = 'VRM'; btn.appendChild(t); });
  try { img.src = chrome.runtime.getURL('logo-vrm-96.png'); } catch (_) {}
  btn.appendChild(img);

  // ══ AU DOIGT (19 octobre, « l'extension pour iPhone et Samsung ») ═════════
  // Sur un téléphone il n'y a pas de SURVOL : la carte d'état (et le « Capter
  // ce compte » qui permet de revenir sur un « Non ») n'était joignable qu'à la
  // souris. On mesure l'ENTRÉE du geste (`pointerType`), jamais « c'est un
  // téléphone » : au doigt, toucher le logo OUVRE la carte, qui porte le geste
  // du logo dans un bouton (« Ouvrir VRM »), ou le formulaire de connexion.
  let dernierPointeur = '';
  // 5.410.5 : une vérification de Vinted est-elle VRAIMENT affichée sur cette page ? (présence seulement)
  const verifAffichee = () => { try { return !!vrmVerifVisible('iframe[src*="captcha-delivery"], iframe[src*="datadome"], #datadome-captcha, iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare"]'); } catch (_) { return false; } };
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
  // 5.371 : `force` — « Réparer » touché alors que le service worker ne répond plus :
  //    la page de réparation relance l'extension si rien ne répond en 6 s (jamais
  //    pendant une republication, une fois par 10 min au plus — voir popup.js).
  function reparer(force) {
    if (reparationPosee || CADRE) return;
    reparationPosee = true;
    try {
      const f = document.createElement('iframe');
      f.src = chrome.runtime.getURL('popup.html') + '?mode=reparer' + (force === true ? '&force=1' : '');
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

  // 5.328 : un refus noté AVANT que cette session soit donnée (mot de passe dans
  // la carte, liaison) ne demande plus « connecte-toi » : c'est fait. `depuis`
  // vient du service worker ; 0 (pas su) ⇒ rien n'est conclu, la phrase d'avant.
  const refusAvantConnexion = (f, v) => !!(v && v.connecte === true && Number(v.depuis) > 0 && f && Number(f.koAt) > 0 && Number(f.koAt) < Number(v.depuis));
  // Ce qui demande un geste (et seulement ça) allume l'ambre.
  const aFaire = (e) => {
    if (!e) return false;
    const v = e.vrm;
    if (v && v.connecte === false) return true;                               // pas connecté, ou session expirée (le geste : se connecter)
    if (e.bascule) return true;                                               // une autre session VRM a été adoptée
    if (e.site && e.site.choix === 'non' && e.plateforme === 'vinted') return false;   // un CHOIX n'est pas une panne
    const f = e.flux;
    if (f && f.koAt && (!f.okAt || f.koAt > f.okAt) && f.koStatut !== 'sans_session' && !refusAvantConnexion(f, v)) return true;            // dernier envoi refusé
    if (e.plateforme === 'leboncoin' && e.aRetirer && Array.isArray(e.aRetirer.liste) && e.aRetirer.liste.length) return true;   // une paire vendue ailleurs, encore en ligne ici
    if (e.plateforme === 'leboncoin' && e.lbc && e.lbc.compte && e.lbc.compte.ok === false) return true;
    if (e.plateforme === 'leboncoin' && deCoteLbc()) return true;   // 5.379 : VRM s'est mis de côté sur cette page (le disjoncteur)   // 5.335 : le compte Leboncoin attend un geste (recharger, se connecter)
    if (e.secu && e.secu.niveau === 'robot') return true;                     // 5.366 : le site vérifie le compte (le geste : la vérification, à lui)
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
    if (v && v.connecte === false) return ' — connecte-toi ci-dessous pour que ça reparte';
    const st = String((f && f.koStatut) || '');
    // 5.193 : rien n'est parti, faute de session VRM vivante (morte ou en pause
    // de renouvellement) — ce n'est ni une panne ni un refus de la base.
    if (st === 'sans_session') return ' — ta session VRM n’a pas pu être renouvelée : rien ne part en attendant. Si ça dure, clique le logo pour te reconnecter.';
    if (st === '403') return ' — ta base VRM refuse ce compte. Vérifie que ton abonnement VRM est actif, et que tu es connecté avec ton compte principal (celui qui ne paie pas). Rien ne partira tant que ce n’est pas réglé.';
    if (st === '401') return ' — la base a refusé ta session. Reconnecte-toi à VRM (clique le logo). Ça ne repartira pas tout seul.';
    if (st === '400') return ' — la base n’est pas dans l’état attendu. Rien ne part ; préviens le support VRM.';
    if (/^4\d\d$/.test(st)) return ` — la base a refusé l’envoi (code ${st}). Reconnecte-toi à VRM ; si ça persiste, préviens le support.`;
    // 5.325 (8 nov., vu sur son iPhone) : une seule phrase couvrait le réseau,
    // les 5xx et l'inconnu — on ne pouvait rien diagnostiquer. Chaque cause DIT
    // la sienne ; toutes trois réessaient d'elles-mêmes.
    return ' — ' + causeRefus(st) + ', ça réessaie tout seul';
  }
  // La cause d'un refus, d'après son code (même texte dans la ligne et l'historique).
  function causeRefus(st) {
    const c = String(st == null ? '' : st);
    if (c === 'reseau') return 'réseau coupé (le navigateur a interrompu l’envoi)';
    if (/^5\d\d$/.test(c)) return `la base a répondu une erreur (code ${c})`;
    if (c === 'sans_session') return 'pas de session VRM';
    if (/^4\d\d$/.test(c)) return `refusé par la base (code ${c})`;
    return 'code inconnu';
  }
  // 5.325 : les 5 derniers refus, datés, en petit sous la ligne (repli fermé).
  // Famille de la ligne et taille de l'envoi : de quoi voir un envoi trop gros
  // qui échoue en boucle. Jamais un identifiant (la famille n'en porte pas).
  const tailleLisible = (n) => { const o = Number(n) || 0; if (!o) return ''; return o >= 1e6 ? `${(o / 1e6).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(o / 1000))} Ko`; };
  function historiqueRefus(f) {
    // 5.328 : « pas de session » n'est pas un refus (rien n'est parti) — jamais listé.
    const h = f && Array.isArray(f.refus) ? f.refus.filter((r) => r && r.statut !== 'sans_session').slice(-5).reverse() : [];
    if (!h.length) return '';
    const heure = (t) => { try { return new Date(Number(t)).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
    const lignes = h.map((r) => `<li data-refus-statut="${esc(r.statut == null ? 'inconnu' : r.statut)}">${esc(heure(r.at))} · ${esc(causeRefus(r.statut))}${r.famille ? ' · ' + esc(r.famille) : ''}${r.octets ? ' · ' + esc(tailleLisible(r.octets)) : ''}</li>`).join('');
    return `<details class="refus" data-refus-historique="${h.length}"><summary>${h.length > 1 ? `Les ${h.length} derniers refus` : 'Le dernier refus'}</summary><ul>${lignes}</ul></details>`;
  }

  // 5.327 (8 nov.) : vrm.center n'a pas répondu plusieurs fois de suite ⇒ les
  // ventes sont parties par la voie DIRECTE, bornée (jamais plus de 256 Ko d'un
  // coup) — ou rien n'est parti parce que la liste était trop lourde pour elle.
  // Dit tel quel : jamais « tout va bien » sur un envoi de secours.
  function ligneSecours(f) {
    const s = f && f.secours;
    if (!s || !s.at) return '';
    if (s.etat === 'trop_lourd') return `<div class="val alerte" data-secours="trop_lourd">vrm.center ne répond pas, et la liste (≈ ${esc(tailleLisible(s.octets))}) est trop lourde pour la voie directe : rien n’est parti ${esc(depuis(s.at))}. Rien n’est perdu, ça repart par vrm.center à la prochaine visite.</div>`;
    return `<div class="val" data-secours="envoi">vrm.center ne répond pas : envoyé par la voie directe ${esc(depuis(s.at))} (${esc(tailleLisible(s.octets))}).</div>`;
  }

  // ══ 5.351 (lot extension-visuel) : UN MESSAGE PRINCIPAL ═══════════════════
  // Julien : « l'extension aussi belle et pratique que l'app ». En tête de la carte,
  // une ligne qui dit l'état (« angeled92 · à jour à 14:05 ✓ »), puis les gestes ;
  // le détail (comptes, envois, refus) est replié — OUVERT dès qu'il y a un geste
  // à faire. Tout vient de l'état que la carte avait déjà (aucune lecture de plus) :
  // la ligne ne dit jamais plus que les lignes du détail. `geste` = ambre, `pause` =
  // Vinted freine (gris), `ok` (gris, ✓), `attente` (gris, pas su ou rien encore).
  const heureCourte = (t) => { try { const n = Number(t); if (!(n > 0)) return ''; if (Date.now() - n > 20 * 3600000) return depuis(n); return 'à ' + new Date(n).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
  const heureFin = (t) => { try { return new Date(Number(t)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
  const envoiRefuse = (f, v) => !!(f && f.koAt && (!f.okAt || f.koAt > f.okAt) && f.koStatut !== 'sans_session' && !refusAvantConnexion(f, v));
  function resumeEtat(e) {
    if (perime) return { etat: 'geste', texte: 'Extension à redémarrer — voir ci-dessous' };
    if (!e) return { etat: 'attente', texte: pasSu ? 'L’extension ne répond pas' : 'Vérification…' };
    const v = e.vrm;
    if (!v) return { etat: 'attente', texte: 'Connexion à VRM pas sue pour l’instant' };
    if (v.connecte === false) return { etat: 'geste', texte: v.expiree ? 'Session VRM expirée : reconnecte-toi' : 'À connecter à VRM' };
    if (e.bascule) return { etat: 'geste', texte: 'Compte VRM changé : vérifie ci-dessous' };
    const site = e.site || {};
    const nom = site.nom || '';
    if (e.plateforme === 'vinted') {
      if (!site.id) return { etat: 'attente', texte: 'Aucun compte Vinted connecté ici' };
      if (site.choix === 'non') return { etat: 'attente', texte: (nom || 'Ce compte') + ' ignoré : ton choix' };
      const maint = Date.now();
      if (site.pause && Number(site.pause.jusqua) > maint) return { etat: 'pause', texte: 'Pause : Vinted freine · reprise à ' + heureFin(site.pause.jusqua) };
      if (site.frein && Number(site.frein.jusqua) > maint) return { etat: 'pause', texte: (site.frein.restreint ? 'Mises en ligne bloquées 24 h' : 'Mises en ligne en pause') + ' · reprise à ' + heureFin(site.frein.jusqua) };
    }
    const f = e.flux || {};
    if (e.capte && envoiRefuse(f, v) && !(site.choix === 'non' && e.plateforme === 'vinted')) return { etat: 'geste', texte: 'Dernier envoi refusé : voir ci-dessous' };
    if (e.plateforme === 'leboncoin') {
      const n = e.aRetirer && Array.isArray(e.aRetirer.liste) ? e.aRetirer.liste.length : 0;
      if (n) return { etat: 'geste', texte: (() => { const m = (globalThis.VRM_MOTS ? globalThis.VRM_MOTS.mots() : null) || { nom: 'paire', noms: 'paires' }; return n > 1 ? `${n} ${m.noms} à retirer de Leboncoin` : `1 ${m.nom} à retirer de Leboncoin`; })() };
      const l = e.lbc;
      if (l && l.compte && l.compte.ok === false) return { etat: 'geste', texte: 'Leboncoin attend un geste : voir ci-dessous' };
      if (!site.id && !(l && l.compte && l.compte.ok === true)) return { etat: 'attente', texte: 'Compte Leboncoin pas encore reconnu' };
      if (l && l.annonces && l.annonces.ok === true) return { etat: 'ok', texte: (nom || 'Leboncoin') + ' · annonces lues', coche: true };
      return { etat: 'attente', texte: (nom || 'Leboncoin') + ' · annonces pas encore lues' };
    }
    if (e.plateforme === 'vestiaire') {
      const c = e.vcCapte || {};
      const ats = Object.keys(c).map((k) => Number(c[k] && c[k].at) || 0).filter((x) => x > 0);
      if (Object.keys(c).some((k) => c[k] && c[k].inconnu)) return { etat: 'attente', texte: 'Vestiaire : une page pas encore lue' };
      return ats.length ? { etat: 'ok', texte: 'Vestiaire lu ' + depuis(Math.max(...ats)), coche: true } : { etat: 'attente', texte: 'Vestiaire pas encore lu' };
    }
    if (!e.capte) return { etat: 'attente', texte: `VRM ne lit pas encore ${NOM_SITE[e.plateforme] || 'ce site'}` };
    if (f.okAt) return { etat: 'ok', texte: (nom || 'Compte ' + (NOM_SITE[e.plateforme] || '')) + ' · à jour ' + heureCourte(f.okAt), coche: true };
    return { etat: 'attente', texte: (nom || 'Ce compte') + ' · rien envoyé pour l’instant' };
  }
  // 5.354 : le mini-résumé du mois. Chaque nombre est celui de VRM, ou « — ».
  let moisOuvert = false;
  const euros = (n) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
  function ligneMois(m) {
    const ca = m.ca == null || (m.caAuMoins && !(m.ca > 0)) ? '—' : (m.caAuMoins ? 'au moins ' : '') + euros(m.ca);
    const nv = m.ventes == null ? '—' : Number(m.ventes).toLocaleString('fr-FR');
    const ae = m.aExpedier == null ? '—' : (m.aExpedierAuMoins ? 'au moins ' : '') + Number(m.aExpedier).toLocaleString('fr-FR');
    const ventesMot = m.ventes != null && m.ventes <= 1 ? 'vente' : 'ventes';   // « 0 vente », « 1 vente », « 42 ventes »
    const note = m.raison === 'mois' ? 'VRM n’a pas encore publié les chiffres de ce mois : ouvre VRM une fois.'
      : m.raison === 'jamais' ? 'Pas encore de chiffres publiés : ouvre VRM une fois.'
      : m.maj ? `Chiffres de VRM, publiés ${depuis(m.maj)}${m.aExpedier == null ? ' · colis : ouvre VRM pour les recompter' : ''}.` : '';
    return `<details class="detail mois" data-mois${moisOuvert ? ' open' : ''}><summary>Ce mois dans VRM</summary>
      <div class="val mois-l" data-mois-ca="${m.ca == null ? '' : esc(m.ca)}" data-mois-ventes="${m.ventes == null ? '' : esc(m.ventes)}" data-mois-expedier="${m.aExpedier == null ? '' : esc(m.aExpedier)}"><span class="seg">Ce mois : <b>${esc(ca)}</b> vendus</span> · <span class="seg"><b>${esc(nv)}</b> ${ventesMot}</span> · <span class="seg"><b>${esc(ae)}</b> à expédier</span></div>
      ${note ? `<div class="val gris" data-mois-note="${esc(m.raison || 'ok')}">${esc(note)}</div>` : ''}
      <div class="outils"><button class="lien" data-mois-masquer>Masquer ce résumé</button></div>
    </details>`;
  }
  const resumeHtml = (r) => `<div class="resume" data-resume="${esc(r.etat)}" role="status"><span class="d" aria-hidden="true"></span><span class="t">${esc(r.texte)}${r.coche ? ' <span class="coche" aria-label="vérifié">✓</span>' : ''}</span></div>`;

  // ══ 5.376 (Julien, 14 nov., midi) : LA CARTE OUVRE LE SITE, JAMAIS VRM ══════════
  // « Quand tu appuies dessus ça ouvre juste les ventes de ce compte, les messages de
  // ce compte, mais pas plus, ça n'ouvre pas VRM. » Les liens viennent du service
  // worker (`liensCartePour` : des pages du MÊME site que l'onglet, celles du compte
  // connecté) ; la carte ne compose aucune adresse, et n'en garde aucune d'un autre
  // site. Pendant que des messages partent depuis cet onglet, un lien s'ouvre dans un
  // NOUVEL onglet du même site (l'envoi garde le sien).
  const ORIGINE_ICI = (() => { try { return String(location.origin || ''); } catch (_) { return ''; } })();
  // 5.379 (capture « Page not found ») : la carte n'affiche un lien que si son chemin est
  // ATTESTÉ — une page que l'app ou l'extension ouvre ou lit déjà, servie par le site :
  //   Vinted    `/inbox` (conversations, ouvertes par l'app), `/member/{id}` (Réglages →
  //             « Ouvrir ») — l'id du compte de l'onglet, sinon pas de lien ;
  //   Leboncoin `/compte/part/mes-annonces`, `/compte/part/mes-transactions` (pages lues par
  //             l'extension), `/messages` ;  eBay `/sh/lst/active`, `/sh/ord` (Seller Hub).
  // `/my_orders/sold` n'a JAMAIS été vue chez Vinted (404) : elle ne passe plus.
  const CHEMINS_ATTESTES = {
    vinted: [/^\/inbox$/, /^\/member\/[1-9]\d{0,19}$/],
    leboncoin: [/^\/compte\/part\/mes-annonces$/, /^\/compte\/part\/mes-transactions$/, /^\/messages$/],
    ebay: [/^\/sh\/lst\/active$/, /^\/sh\/ord$/],
  };
  const cheminAtteste = (plateforme, u) => !u.search && !u.hash && (CHEMINS_ATTESTES[plateforme] || []).some((re) => re.test(u.pathname));
  function liensHtml(e, nouvelOnglet) {
    const l = Array.isArray(e && e.liens) ? e.liens.filter((x) => { try { const u = new URL(x.url); return u.protocol === 'https:' && u.origin === ORIGINE_ICI && cheminAtteste(e.plateforme, u); } catch (_) { return false; } }) : [];
    if (!l.length) return '';
    return `<nav class="liens" data-liens aria-label="Sur ${esc(NOM_SITE[e.plateforme] || 'ce site')}">`
      + l.map((x) => `<a class="lien-site" data-lien-site="${esc(x.cle)}" href="${esc(x.url)}" target="${nouvelOnglet ? '_blank' : '_top'}"${nouvelOnglet ? ' rel="noopener"' : ''}><span>${esc(x.libelle)}</span><i aria-hidden="true"></i></a>`).join('')
      + '</nav>';
  }

  // ══ 5.376 / 5.379 : LES MESSAGES AUX FAVORIS, LANCÉS D'ICI ═══════════════════════
  // « Comme ça on peut lancer les messages aux favoris directement quand on est sur le
  // compte. » Tout vient du service worker : l'aperçu (calculé par VRM avec les règles
  // de l'app), la file en cours (`vrmFavorisCarte`). Rien ne part sans SON clic.
  // 5.379 (Julien, 15 nov., capture : « Favoris » n'affichait qu'une phrase) : l'onglet
  // Favoris MONTRE la liste dès qu'elle est lue — du plus récent au plus ancien, photo,
  // article, qui, quand — et dit ce qui manque pour écrire, avec le geste (« Écris
  // d'abord ton message dans VRM › »). Plus d'étape « Voir » : la liste est là.
  let vueFav = null, apercuFav = null, apercuFavAt = 0, favEnVol = false, favErreur = '', favLectureKo = '', favOccupe = false, aideFav = false, minuteurFav = null;
  // 5.377 : ce qu'il a coché (identifiants de l'aperçu), du plus récent au plus ancien.
  let selFav = new Set(), selFavIds = '';
  const triFav = (l) => (Array.isArray(l) ? l.map((x, i) => [x, i]).sort((p, q) => ((Date.parse(q[0].date || '') || 0) - (Date.parse(p[0].date || '') || 0)) || (p[1] - q[1])).map((p) => p[0]) : []);
  function listeFavTriee(a) { return triFav(a && a.liste); }
  const photoFav = (u) => (u && /^https:\/\/[\w.-]*vinted\.net\//.test(String(u)) ? `<img class="vig" src="${esc(u)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '<span class="vig" aria-hidden="true"></span>');
  // 5.406 : en cinq langues (vrm-ui.js) ; `verification` et `garde` (une garde qui ne repart pas seule).
  const ATTENTES_FAV = new Proxy({}, { get: (o, k) => (['tout_arrete', 'reseau', 'pause', 'autre_compte', 'onglet', 'vrm', 'verification', 'garde'].includes(k) ? TU('fa_' + k) : undefined) });

  // L'écran de VRM où s'écrit le message aux favoris (Messages → Favoris) : la MÊME adresse
  // que l'app reconnaît (`tab=messages&vue=favoris`), dans un NOUVEL onglet — l'onglet Vinted
  // reste où il est. Le seul lien de la carte vers VRM, et seulement quand le message manque.
  const BLOCAGES_FAV = {
    reglages: 'Pour leur écrire d’ici, écris ton message une fois pour ce compte (Messages → Favoris → Ton message).',
    favoris_absents: 'Ouvre une fois ta cloche Vinted (tes notifications) : VRM y lit qui a mis tes articles en favori.',
    dressing_absent: 'Pour leur écrire, ouvre une fois ton dressing : VRM vérifie que chaque article est encore en vente.',
    dressing_ancien: 'Pour leur écrire, ouvre une fois ton dressing (lu il y a plus de 24 h) : VRM revérifie tes articles.',
    dressing_partiel: 'Pour leur écrire, fais défiler ton dressing jusqu’en bas une fois : VRM ne l’a pas lu en entier.',
  };
  const ETAT_FAV = { envoye: 'déjà écrit', en_cours: 'message en cours', a_verifier: 'à vérifier sur Vinted', pas_envoye: 'pas envoyé' };
  const eurosFav = (n) => { const x = Number(n); if (!isFinite(x) || x <= 0) return ''; const c = Math.round(x * 100); return (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €'; };
  // 5.455.4 (« le chronomètre ne marche pas ») : UNE horloge pour tout ce que le panneau montre — la carte (même fermée,
  //    le grand panneau, la page principale, les rangées de la liste) : chaque `[data-fav-dans]` de l'ombre, chaque seconde.
  //    Avant : un minuteur posé sur la seule carte, arrêté dès qu'elle n'était pas ouverte ; ailleurs, un temps figé.
  //    À zéro : le panneau se relit (une fois par échéance), pour montrer l'envoi qui part.
  let horlogeFavId = null, horlogeFavRelu = 0;
  function tourHorlogeFav() {
    let l = []; try { l = [...ombre.querySelectorAll('[data-fav-dans]')]; } catch (_) { l = []; }
    if (!l.length) return 0;
    let echu = 0;
    for (const el of l) { const t = Number(el.getAttribute('data-fav-dans')); if (!(t > 0)) continue; if (t <= Date.now()) { echu = Math.max(echu, t); el.textContent = dansFav(t); continue; } const x = dansFav(t); if (el.textContent !== x) el.textContent = x; }
    if (echu && echu !== horlogeFavRelu) { horlogeFavRelu = echu; try { rafraichir(); } catch (_) {} }
    return l.length;
  }
  // Toujours là (une lecture de l'ombre par seconde, rien si aucun compte à rebours n'est affiché) : quel que soit l'écran qui
  //    a dessiné le compte à rebours, il avance.
  function horlogeFav() { if (horlogeFavId == null) horlogeFavId = setInterval(tourHorlogeFav, 1000); tourHorlogeFav(); }
  horlogeFav();
  const dansFav = (t) => { const s = Math.max(0, Math.round((Number(t) - Date.now()) / 1000)); if (s < 60) return s + ' s'; const m = Math.round(s / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); };
  const plurielFav = (n, un, plusieurs) => `${Number(n).toLocaleString('fr-FR')} ${Number(n) > 1 ? plusieurs : un}`;
  const fileFavActive = (e) => !!(e && e.site && e.site.favoris && e.site.favoris.file && e.site.favoris.file.actif);
  // La file en cours (ou finie depuis moins de 6 h) : ce qui part, d'ici.
  // 5.406 : la LIGNE PRINCIPALE de la carte pendant l'envoi — « Messages aux favoris · 3 sur 15 ·
  // prochain dans 3 min », un trait fin, la VRAIE raison de l'attente (`quoi`, posé par le fond :
  // ouverture de Vinted, 15/h, 50/h…) et UN plein : « Tout arrêter ». Mêmes marques `data-fav*`.
  const QUOI_FAV = { ouverture: 'q_ouverture', sorte: 'q_sorte', heure: 'q_heure', jour: 'q_jour', rythme: 'q_rythme', 'autre-compte': 'q_autre', serie: 'q_serie', rodage: 'q_rodage', espace: 'q_espace', calme: 'q_calme' };
  // 5.440.1 (Julien, 23 nov. : « 1 sauté » dans la fenêtre, « 1 refusé » au bilan, « 1 pas envoyé(s) » ici pour le MÊME favori) :
  //    les nombres du serveur (`pasEnvoyes`, `sautes` : la règle du bilan) et UN mot par état — pas envoyé · sauté · en attente.
  function comptesFav(fi) {
    const n = (v) => Number(v) || 0;
    const pas = fi.pasEnvoyes != null ? n(fi.pasEnvoyes) : n(fi.refuses), sautes = fi.sautes != null ? n(fi.sautes) : n(fi.ignores);
    return { pas, sautes, verifier: n(fi.incertains), attente: n(fi.attente), annules: n(fi.annules) };
  }
  function motsComptesFav(cf, fin) {
    const p = (n, a, b) => TU(n === 1 ? a : b, { n });
    return [cf.pas ? p(cf.pas, 'fa_pas_1', 'fa_pas_n') : '', cf.sautes ? p(cf.sautes, 'fa_saute_1', 'fa_saute_n') : '', !fin && cf.verifier ? p(cf.verifier, 'fa_verif_1', 'fa_verif_n') : '', fin && cf.annules ? p(cf.annules, 'fa_annule_1', 'fa_annule_n') : '', fin && cf.attente ? p(cf.attente, 'fa_attente_1', 'fa_attente_n') : ''].filter(Boolean).join(' · ');
  }
  function favorisFileHtml(e) {
    if (!e || e.plateforme !== 'vinted' || !e.site || !e.site.id || !e.site.favoris) return '';
    const st = e.site.favoris.file;
    if (st && st.actif) {
      const fi = st.file || {}, total = Number(fi.total) || Number(st.total) || 0, faits = Number(fi.envoyes) || 0;
      const cf = comptesFav(fi), pas = cf.pas + cf.sautes + cf.verifier;
      const dans = !st.enCours && Number(st.prochain) > Date.now() ? dansFav(st.prochain) : '';
      const att = st.attente && ATTENTES_FAV[st.attente];
      const pour = QUOI_FAV[st.quoi] ? TU(QUOI_FAV[st.quoi]) : '';
      const etat = st.enCours ? `<span class="p-dans">· ${esc(TU('f_part'))}</span>` : dans ? `<span class="p-dans">· ${esc(TU('f_prochain', { dans: '\u0000' })).replace('\u0000', `<span data-fav-dans="${Number(st.prochain)}">${esc(dans)}</span>`)}${['sorte', 'heure', 'jour'].includes(String(st.quoi || '')) || Number(st.prochain) - Date.now() > 120000 ? ` <span class="p-h" data-fav-heure="${Number(st.prochain)}">${esc(TU('f_a_heure', { h: heureFl(st.prochain) }))}</span>` : ''}</span>` : '';   // 5.419 : un plafond qui bloque dit l'HEURE du prochain envoi
      return `<section class="fav principal" data-fav="encours" data-fav-envoyes="${faits}" data-fav-total="${total}"${st.attente ? ` data-fav-attente="${esc(st.attente)}"` : ''}${st.quoi ? ` data-fav-quoi="${esc(st.quoi)}"` : ''}>
        <div class="p-t fav-l" role="status"><span class="p-nom">${esc(TU('f_titre'))}</span><b class="p-n">${esc(TU('f_sur', { n: faits, total }))}</b></div>
        ${U.barre(total ? 100 * faits / total : 0, ' aria-label="' + esc(TU('f_titre')) + '"')}
        <div class="p-l2">${etat.replace('· ', '')}${pas ? `<span class="p-dans" data-fav-comptes="${cf.pas}:${cf.sautes}:${cf.verifier}"> · ${esc(motsComptesFav(cf, false))}</span>` : ''}</div>
        ${st.robot ? `<div class="p-pour ambre" data-fav-robot>${esc(TU(verifAffichee() ? 'a_verif_page' : 'a_refus_robot'))}</div><div class="p-pour">${esc(TU('a_doucement'))}</div>${favErreur ? `<div class="p-pour ambre" role="alert">${esc(favErreur)}</div>` : ''}<button class="vu-btn vu-plein" data-fav-reprendre>${esc(TU('a_reprendre'))}</button><button class="vu-btn vu-sec" data-fav-arreter>${esc(TU('c_tout_arreter'))}</button>`
          : `${att ? `<div class="p-pour ambre" data-fav-attente-texte>${esc(att)}</div>` : `<div class="p-pour" data-fav-pour>${esc(pour || TU('f_garde'))}</div>`}
        <button class="vu-btn vu-plein" data-fav-arreter>${esc(TU('c_tout_arreter'))}</button>`}
      </section>`;
    }
    if (st && !st.actif && st.fin && Date.now() - Number(st.fin.at || 0) < 6 * 3600000) {
      const fi = st.file || {}, env = Number(fi.envoyes) || 0, inc = Number(fi.incertains) || 0;
      const cf = comptesFav(fi), pas = cf.pas + cf.sautes + cf.attente + cf.annules;
      const quoi = st.fin.raison === 'robot' ? TU('f_fin_robot')
        : st.fin.raison === 'arret' ? TU('f_fin_arret')
        : st.fin.raison === 'travail_ferme' ? TU('f6_fin_travail')
        : st.fin.raison === 'interrompu' ? (st.fin.texte || st.fin.code ? TU('f_fin_interrompu_t', { t: U.raisonFileFav(st.fin) }) : TU('f_fin_interrompu'))
        : TU('a_fini');
      return `<section class="fav principal" data-fav="fini" data-fav-fin="${esc(st.fin.raison || '')}" data-fav-envoyes="${env}">
        <div class="p-t fav-l" role="status"><span>${esc(TU('f_titre'))}</span><span>· <b>${esc(env > 0 ? '✓ ' + TU('f_envoye_a', { n: env }) : TU(env === 1 ? 'fa_envoye_1' : 'fa_envoye_n', { n: env }))}</b></span>${pas ? `<span class="p-dans" data-fav-comptes="${cf.pas}:${cf.sautes}:${cf.attente}:${cf.annules}">· ${esc(motsComptesFav(cf, true))}</span>` : ''}</div>
        <div class="p-pour${st.fin.raison === 'robot' ? ' ambre' : ''}" data-fav-raison-fin>${esc(quoi)}</div>
        ${st.fin.bilan ? `<div class="p-pour" data-fav-bilan>${esc(st.fin.bilan)}</div>` : ''}
        ${env > 0 && st.fin.raison !== 'robot' ? `<div class="p-pour" data-fav-ensuite>${esc(TU('f_ensuite'))}</div>` : ''}
        ${inc ? `<div class="p-pour ambre" data-fav-verifier="${inc}">${esc(TU('f_verifier', { n: inc }))}</div>` : ''}
        <button class="vu-btn vu-sec" data-fav-ok>OK</button>
      </section>`;
    }
    return '';
  }
  // Les favoris LUS (lecture seule) : photo, article, qui · quand, où il en est.
  const ligneFavLu = (x) => {
    const etatT = ETAT_FAV[x.etat] || '';
    const quand = x.date ? depuis(Date.parse(x.date)) : '';
    return `<li class="rang" data-fav-qui="${esc(x.id)}"${x.date ? ` data-fav-date="${esc(x.date)}"` : ''} data-fav-etat="${esc(x.etat || '')}">${photoFav(x.photo)}<span class="mil"><span class="ti">${esc(x.titre || 'Article')}</span><span class="me"><span class="sg">${esc(x.pseudo || 'Un acheteur')}</span>${quand ? ' · <span class="sg">' + esc(quand) + '</span>' : ''}${etatT ? ' · <span class="sg">' + esc(etatT) + '</span>' : ''}</span></span></li>`;
  };
  // 5.410 : le message se règle DANS le panneau (Automatisations · Messages aux favoris), plus dans VRM.
  const gesteEcrire = () => `<div class="ecrire" data-fav-ecrire-bloc><div class="val gris">${esc(BLOCAGES_FAV.reglages)}</div><button type="button" class="lien-site" data-fav-ecrire data-onglet-b="automatisations"><span>${esc(TU('g6_ecrire_message'))}</span><i aria-hidden="true"></i></button></div>`;
  // L'onglet Favoris de la carte (compte de l'onglet, Vinted).
  // 5.409 (Julien : « pour les messages aux favoris, un accompagnement parfait de A à Z pour ne pas être perdu ») :
  // les étapes numérotées au-dessus de chaque écran du parcours (1 Choisir · 2 Offre et message · 3 Rythme ·
  // 4 Confirmer · 5 Suivi), et UNE phrase qui dit quoi faire. Le parcours lui-même est celui de la 5.407
  // (liste à cocher, récapitulatif, « Confirmer l'envoi », file gardée) : rien ne part sans son toucher.
  function etapeFav(e) {
    const a = apercuFav;
    if (favorisFileHtml(e)) return 5;
    if (a && avecListe(a) && vueFav === 'recap' && a.etat === 'pret') return 4;
    if (a && (avecListe(a) || (a.etat === 'pret' && Array.isArray(a.liste) && a.liste.length))) return 1;
    return 0;
  }
  function etapesFavHtml(n) {
    if (!n) return '';
    const noms = ['f5_choisir', 'f5_offre', 'f5_rythme', 'f5_confirmer', 'f5_suivi'];
    // Le récapitulatif montre l'offre, le message et le rythme ensemble : 2 et 3 y sont faites.
    return `<ol class="etapes5" data-fav-etape="${n}">${noms.map((k, i) => `<li${i + 1 < n ? ' data-fait' : ''}${i + 1 === n ? ' aria-current="step"' : ''}>${esc(TU(k))}</li>`).join('')}</ol><p class="guide5" data-fav-guide>${esc(TU('f5_guide_' + n))}</p>`;
  }
  const grand6 = () => !LISTES && carte.hasAttribute('data-grand');
  function favorisOngletHtml(e) {
    if (grand6() && e && e.plateforme === 'vinted' && e.site && e.site.id) return favorisGrandHtml(e);   // 5.410.7 : le tableau
    const corps = favorisOngletCorps(e);
    return LISTES || !corps ? corps : etapesFavHtml(etapeFav(e)) + corps;
  }
  function favorisOngletCorps(e) {
    if (!e || e.plateforme !== 'vinted' || !e.site || !e.site.id) return '';
    // 5.406 : l'envoi en cours (ou son bilan) est la ligne PRINCIPALE, en haut de la carte : il
    // n'est pas redit ici (sauf dans la fenêtre « listes », qui n'a pas de ligne principale).
    const file = favorisFileHtml(e);
    if (file) return LISTES ? file : `<div class="val gris" data-fav-en-haut>${esc(TU('f_en_haut'))}</div>`;
    const a = apercuFav;
    // 5.455.8 (Julien, 28 nov. : « ça m'affiche que les favoris n'ont pas pu être lus ») : cette phrase ne dit QUE la LECTURE ratée
    //    de la liste (`favLectureKo`) — jamais un envoi refusé, qui se dit sur la rangée du favori, la liste restant affichée.
    if (!a && favLectureKo) return `<section class="fav" data-fav="erreur"><div class="val gris" role="status" data-fav-erreur>Tes favoris n’ont pas pu être lus : ${esc(favLectureKo)}</div><button class="b sec" data-fav-relire>Réessayer</button></section>`;
    if (!a) return '<section class="fav" data-fav="charge"><div class="val gris" role="status" data-fav-charge>Je lis tes favoris…</div></section>';
    if (avecListe(a)) return vueFav === 'recap' && a.etat === 'pret' ? recapFavHtml(a) : listeFavHtml(a);
    if (a.etat === 'pret' && Array.isArray(a.liste) && a.liste.length) return pretFavHtml(a);
    if (a.etat === 'encours') return '<section class="fav" data-fav="encours-ailleurs"><div class="val" data-fav-apercu="encours">Des messages partent déjà sur ce compte (depuis VRM ou une autre carte). Attends la fin avant d’en lancer d’autres.</div></section>';
    const lus = triFav(a.lus), total = Number(a.totalLus) || lus.length;
    const tete = lus.length ? `<div class="lu" data-fav-lus-n="${total}">${plurielFav(total, 'favori lu', 'favoris lus')} · du plus récent au plus ancien</div>` : '';
    const liste = lus.length ? `<ul class="rangs" data-fav-lus="${lus.length}" data-defil="fav-lus">${lus.map(ligneFavLu).join('')}</ul>${total > lus.length ? `<div class="val gris">Les ${lus.length} plus récents sur ${total.toLocaleString('fr-FR')}.</div>` : ''}` : '';
    let geste;
    if (a.etat === 'bloque' && a.raison === 'reglages') geste = gesteEcrire();
    else if (a.etat === 'bloque' && a.raison === 'favoris_absents') geste = `<div class="val gris" data-fav-pas-su>${esc(BLOCAGES_FAV.favoris_absents)}</div>${a.sansMessage ? gesteEcrire() : ''}`;
    else if (a.etat === 'bloque') geste = `<div class="val gris">${esc(BLOCAGES_FAV[a.raison] || 'VRM ne peut pas préparer les messages pour l’instant.')}</div>`;
    else geste = `<div class="val gris" data-fav-rien>Personne à qui écrire pour l’instant : chaque favori a déjà reçu un message, ou son article n’est plus en vente.</div>${a.nonProuves ? `<div class="val gris">${plurielFav(a.nonProuves, 'favori attend', 'favoris attendent')} : ouvre un de leurs favoris depuis la cloche de Vinted pour que VRM sache à qui écrire.</div>` : ''}`;
    return `<section class="fav" data-fav="${esc(a.etat || '')}"${a.raison ? ` data-fav-raison="${esc(a.raison)}"` : ''}>${tete}${liste}${geste}</section>`;
  }
  // Prêt : la liste à cocher (la rangée entière), le message, l'offre, UN bouton plein.
  function pretFavHtml(a) {
    const triee = listeFavTriee(a), n = triee.filter((x) => selFav.has(x.id)).length, m = a.message || {}, premier = triee[0];
    const rythme = Number(m.intervalleMinutes) === 0 ? 'quelques secondes d’écart' : m.intervalleMaxMinutes ? `${m.intervalleMinutes} à ${m.intervalleMaxMinutes} min d’écart` : `${m.intervalleMinutes} min d’écart`;
    const offreTxt = m.offre ? (m.offre.mode === 'pct' ? `−${m.offre.valeur} %` : m.offre.mode === 'euros' ? `−${eurosFav(m.offre.valeur)}` : `à ${eurosFav(m.offre.valeur)}`) + (m.offre.arrondi ? ', arrondie à l’euro' : '') : '';
    const aide = aideFav ? `<ol class="ap-aide" data-fav-aide-texte>
        <li>Pour chaque personne, VRM ouvre la conversation sur Vinted${m.offre ? ', fait l’offre' : ''}, prend le temps d’écrire, puis envoie le message.</li>
        <li>15 messages par heure au plus sur ce compte. Une pause de Vinted, un autre compte dans l’onglet ou une vérification de Vinted arrête tout, et c’est dit ici.</li>
        <li>Garde cet onglet Vinted ouvert. Tu peux tout arrêter à tout moment, ici.</li></ol>` : '';
    return `<section class="fav apercu" data-fav="pret" data-fav-n="${Number(a.total) || triee.length}" data-fav-vue="apercu">
      <div class="lu" data-fav-ordre>${plurielFav(Number(a.total) || triee.length, 'favori', 'favoris')} à qui écrire · du plus récent au plus ancien</div>
      <div class="ap-tout"><span class="ap-lbl" data-fav-coches="${n}">${n} coché${n > 1 ? 's' : ''} sur ${triee.length}</span><button class="lien" data-fav-tout="${n === triee.length ? 'aucun' : 'tous'}">${n === triee.length ? 'Tout décocher' : 'Tout cocher'}</button></div>
      <ul class="ap-liste" data-fav-liste="${triee.length}" data-defil="fav">${triee.map((x) => `<li class="coche-l" data-fav-qui="${esc(x.id)}"${x.date ? ` data-fav-date="${esc(x.date)}"` : ''}><input type="checkbox" data-fav-coche="${esc(x.id)}"${selFav.has(x.id) ? ' checked' : ''} aria-label="Écrire à ${esc(x.pseudo || 'cet acheteur')}">${photoFav(x.photo)}<span class="quoi">${esc(x.titre || 'Article')}</span><span class="qui">${esc(x.pseudo || 'Un acheteur')}${x.date ? ` <span class="quand">· ${esc(depuis(Date.parse(x.date)))}</span>` : ''}</span><span class="px">${x.offre != null ? `<s>${esc(eurosFav(x.prix))}</s> ${esc(eurosFav(x.offre))}` : esc(eurosFav(x.prix))}</span></li>`).join('')}</ul>
      ${Number(a.total) > triee.length ? `<div class="val gris" data-fav-reste="${Number(a.total) - triee.length}">Les ${triee.length} plus récents d’abord ; les ${Number(a.total) - triee.length} autres, relance après.</div>` : ''}
      ${a.nonProuves ? `<div class="val gris" data-fav-non-prouves="${Number(a.nonProuves)}">${plurielFav(a.nonProuves, 'autre en attente', 'autres en attente')} : ouvre un favori depuis la cloche de Vinted, VRM saura à qui écrire.</div>` : ''}
      <div class="ap-lbl">Le message${Number(m.versions) > 1 ? ` · une de tes ${Number(m.versions)} versions, au hasard` : ''}</div>
      <div class="bulle" data-fav-message>${esc(premier.texte)}</div>
      ${m.offre ? `<div class="ap-lbl" data-fav-offre="${esc(m.offre.mode)}">Avec une offre ${esc(offreTxt)}</div>` : '<div class="ap-lbl" data-fav-offre="aucune">Sans offre de prix</div>'}
      <div class="val gris" data-fav-rythme>Écrit pour chacun · ${esc(rythme)} · 15 par heure au plus.</div>
      ${a.ventesAilleurs === 'pas_su' ? '<div class="val alerte" data-fav-ailleurs>Tes ventes sur les autres sites n’ont pas été revérifiées récemment : assure-toi que ces articles ne sont pas vendus ailleurs.</div>' : ''}
      <p class="ap-phrase">VRM va écrire à ${n > 1 ? `ces ${n} personnes, une par une` : n === 1 ? 'cette personne' : 'celles que tu coches'}, depuis cet onglet. Rien ne part avant « Envoyer le message ».</p>
      ${favErreur ? `<div class="err" role="alert">${esc(favErreur)}</div>` : ''}
      ${n ? '' : '<div class="val gris" data-fav-aucun>Coche au moins une personne pour envoyer le message.</div>'}
      <button class="b" data-fav-lancer${favOccupe || !n ? ' disabled' : ''}>${favOccupe ? 'Envoi…' : `Envoyer le message (${n})`}</button>
      <div class="outils"><button class="lien" data-fav-aide aria-expanded="${aideFav ? 'true' : 'false'}">Comment ça marche ?</button></div>${aide}
    </section>`;
  }
  // ══ 5.407 — LA LISTE DES FAVORIS À COCHER (Julien, 17 nov. : « il faut une liste avec les
  // favoris pour pouvoir les sélectionner etc ») ═══════════════════════════════════════════════
  // La liste est celle que VRM calcule (`apercu.tous`, api/_lib/favoris-carte.js, les règles de
  // l'app : article ENCORE en vente, état de l'envoi par etatFavori, destinataire prouvé) — la carte
  // n'en décide rien : elle trie (date du favori, le plus récent en haut), filtre (une annonce,
  // « pas encore contactés ») et coche. Seuls les `cochable` ont une case active ; les autres disent
  // pourquoi. Au plus `max` (15) par envoi. Le choix survit à un rechargement (chrome.storage.local,
  // PAR COMPTE). « Envoyer à N favoris » ouvre un récapitulatif ; seul « Confirmer l'envoi » lance.
  const SEL_CLE = 'vrmFavSelection';
  const LOT_CLE = 'vrmFavLot', PAGE_FL = 100;
  let filtreAnnonce = '', filtreNouveaux = false, selTimer = null, lotFav = null, vusFl = PAGE_FL;
  const favTous = (a) => (a && Array.isArray(a.tous) ? triFav(a.tous) : []);
  const favMax = (a) => (Number(a && a.max) > 0 ? Math.min(50, Number(a.max)) : 15);
  const favCochables = (a) => favTous(a).filter((x) => x.cochable === true);
  const avecListe = (a) => !!(a && Array.isArray(a.tous) && a.tous.length && (a.etat === 'pret' || a.etat === 'rien'));
  function etatFl(x) {
    if (x.cochable) return '';
    if (x.envoi === 'envoye') return TU(x.offreFaite ? 'fl_e_offre' : 'fl_e_message');
    if (x.envoi === 'en_cours') return TU('fl_e_encours');
    if (x.envoi === 'a_verifier') return TU('fl_e_verifier');
    if (x.envoi === 'pas_envoye') return TU('fl_e_pas');
    if (x.raison === 'sans_acheteur') return TU('fl_e_sans_acheteur');   // 5.455.6 : la notification ne porte pas de personne
    if (x.raison === 'non_prouve') return TU('fl_e_prouve');
    if (x.raison === 'offre_prix') return TU('fl_e_prix');
    return TU('fl_e_pas');
  }
  const visibleFl = (x) => (!filtreAnnonce || String(x.itemId) === filtreAnnonce) && (!filtreNouveaux || x.envoi === 'a_envoyer');
  function ligneFl(x) {
    const on = x.cochable === true, coche = on && selFav.has(x.id), etat = etatFl(x);
    const qui = x.pseudo || TU('fl_acheteur'), quand = x.date ? depuis(Date.parse(x.date)) : '';
    const px = on && x.offre != null && Number(x.offre) !== Number(x.prix) ? `<s>${esc(eurosFav(x.prix))}</s>${esc(eurosFav(x.offre))}` : esc(eurosFav(x.prix));
    return `<li class="fl-l" data-fav-qui="${esc(x.id)}" data-fav-item="${esc(x.itemId)}" data-fav-envoi="${esc(x.envoi || '')}"${x.date ? ` data-fav-date="${esc(x.date)}"` : ''}${on ? '' : ' data-fav-off'}>`
      + `<label class="fl-case"><input type="checkbox" data-fav-coche="${esc(x.id)}"${coche ? ' checked' : ''}${on ? '' : ' disabled'} aria-label="${esc(TU('fl_cocher', { qui }))}${etat ? ' — ' + esc(etat) : ''}"></label>`
      + `<span class="fl-photo">${photoFav(x.photo)}${x.num ? U.etiquette(x.num) : ''}</span>`
      + `<span class="fl-mil"><span class="fl-ti">${esc(x.titre || TU('fl_article'))}</span><span class="fl-me">${esc(qui)}${quand ? ' · ' + esc(quand) : ''}</span>${etat ? `<span class="fl-etat" data-fav-raison-l="${esc(x.raison || x.envoi || '')}">${esc(etat)}</span>` : ''}</span>`
      + `<span class="fl-px">${px}${'mini' in x ? `<span class="fl-mini" data-fav-mini="${x.mini == null ? '' : esc(x.mini)}">${esc(x.mini == null ? TU('fl_mini_rien') : TU('fl_mini', { p: eurosFav(x.mini) }))}</span>` : ''}</span></li>`;
  }
  const FIXER_MINI_URL = 'https://vrm.center/?tab=annonces';
  const fixerMini = (n) => `<div class="fl-note fl-sans-mini" data-fav-sans-mini="${n}"><span>${esc(TU('fl_sans_mini', { n }))}</span><a class="vu-lien" data-fav-fixer href="${FIXER_MINI_URL}" target="_blank" rel="noopener">${esc(TU('fl_fixer'))}</a></div>`;
  // Le compteur, le bouton et la phrase du bas — remis à jour sur place (aucun redessin de la liste).
  // 15 PAR HEURE (sécurité des comptes, 12 nov.) : un envoi part avec les 15 plus récents cochés ; les
  // autres RESTENT cochés pour l'heure suivante. Après un envoi complet (15), le bouton dit l'heure où
  // les suivants peuvent partir (« Envoyer les 15 suivants à 20:45 ») et attend jusque-là.
  const heureFl = (t) => { try { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
  function envoiFl(a) {
    if (favEnv && favEnv.auto) { const ex = exemplesAuto(a); return { choisis: ex, envoi: ex, max: ex.length }; }   // 5.420 : les étapes « automatique » montrent des exemples
    const choisis = favCochables(a).filter((x) => selFav.has(x.id) && !(favRefus && favRefus.ids.has(x.id))), max = favMax(a);
    return { choisis, envoi: choisis.slice(0, max), max };
  }
  function piedFl(a) {
    const { choisis, envoi, max } = envoiFl(a), n = choisis.length, k = envoi.length, reste = n - k;
    // 5.455.8 (Julien, 28 nov.) : le plafond de l'heure ne FERME plus le bouton — les favoris partent dans la file et ATTENDENT
    //    leur place (compte à rebours sur leur rangée), les plafonds de l'extension restent les mêmes (15/h, 50/h, jour).
    const attente = 0;
    return { n, k, max, reste, attente,
      compte: n === 1 ? TU('fl_coche1') : TU('fl_coches', { n }),
      bouton: attente ? TU('fl_suivants', { n: k, h: heureFl(attente) }) : k === 1 ? TU('fl_envoyer1') : TU('fl_envoyer', { n: k }),
      note: !n ? TU('fl_aucun') : reste > 0 ? TU('fl_reste', { n: reste, max }) : '' };
  }
  function listeFavHtml(a) {
    const tous = favTous(a), vis = tous.filter(visibleFl), p = piedFl(a), montres = vis.slice(0, Math.max(PAGE_FL, vusFl)), suite = Math.min(PAGE_FL, vis.length - montres.length);
    const total = Number(a.totalTous) || tous.length;
    const parAnnonce = new Map();
    for (const x of tous) { const k = String(x.itemId || ''); if (!k) continue; const o = parAnnonce.get(k) || { titre: x.titre || TU('fl_article'), n: 0, num: x.num || '' }; o.n++; parAnnonce.set(k, o); }
    if (filtreAnnonce && !parAnnonce.has(filtreAnnonce)) filtreAnnonce = '';
    const options = [...parAnnonce.entries()].sort((x, y) => y[1].n - x[1].n || x[1].titre.localeCompare(y[1].titre))
      .map(([k, o]) => `<option value="${esc(k)}"${k === filtreAnnonce ? ' selected' : ''}>${o.num ? 'N°' + esc(o.num) + ' · ' : ''}${esc(o.titre.slice(0, 48))} (${o.n})</option>`).join('');
    const pret = a.etat === 'pret' && favCochables(a).length > 0;
    return `<section class="fav fl" data-fav="${esc(a.etat)}" data-fav-vue="liste" data-fav-n="${tous.length}">
      <div class="lu" data-fav-ordre>${esc(TU('fl_lu', { n: total.toLocaleString('fr-FR') }))}</div>
      ${pret ? `<div class="fl-tete"><span class="fl-n" data-fav-coches="${p.n}" aria-live="polite">${esc(p.compte)}</span><span class="fl-max" data-fav-max="${p.max}">· ${esc(TU('fl_max', { max: p.max }))}</span><span class="fl-outils"><button class="vu-lien" data-fav-tout="tous">${esc(TU('fl_tout'))}</button><button class="vu-lien" data-fav-tout="aucun">${esc(TU('fl_rien'))}</button></span></div>` : `<div class="fl-note" data-fav-rien>${esc(TU('fl_personne'))}</div>`}
      <div class="fl-filtres"><select data-fav-annonce aria-label="${esc(TU('fl_annonce'))}"><option value="">${esc(TU('fl_toutes'))}</option>${options}</select><button class="fl-puce" data-fav-nouveaux aria-pressed="${filtreNouveaux ? 'true' : 'false'}">${esc(TU('fl_nouveaux'))}</button></div>
      <ul class="fl-liste" data-fav-liste="${vis.length}" data-fav-montres="${montres.length}" data-defil="fav">${vis.length ? montres.map(ligneFl).join('') : `<li class="fl-vide" data-fav-vide>${esc(TU('fl_vide'))}</li>`}${suite > 0 ? `<li class="fl-suite"><button class="vu-lien" data-fav-suite="${suite}">${esc(TU('fl_voir', { n: suite }))}</button></li>` : ''}</ul>
      ${total > tous.length ? `<div class="fl-note" data-fav-reste="${total - tous.length}">${esc(TU('fl_plus', { n: tous.length, total: total.toLocaleString('fr-FR') }))}</div>` : ''}
      ${(() => { const n = favCochables(a).filter((x) => 'mini' in x && x.mini == null).length; return n ? fixerMini(n) : ''; })()}
      ${Number(a.retires) > 0 ? `<div class="fl-note" data-fav-caches="${Number(a.retires)}">${esc(TU('fl_caches', { n: Number(a.retires) }))}</div>` : ''}
      ${a.ventesAilleurs === 'pas_su' ? '<div class="val alerte" data-fav-ailleurs>Tes ventes sur les autres sites n’ont pas été revérifiées récemment : assure-toi que ces articles ne sont pas vendus ailleurs.</div>' : ''}
      ${favErreur ? `<div class="err" role="alert">${esc(favErreur)}</div>` : ''}
      ${pret ? `<div class="fl-pied"><div class="fl-note" data-fav-note${p.note ? '' : ' hidden'}>${esc(p.note)}</div>
      <button class="vu-btn vu-plein" data-fav-envoyer${p.attente ? ` data-fav-a="${p.attente}"` : ''}${!p.k || p.attente ? ' disabled' : ''}>${esc(p.bouton)}</button></div>` : ''}
    </section>`;
  }
  // La durée attendue AU VRAI RYTHME : chaque message (ouvrir, l'offre, 8–20 s, le temps de l'écrire)
  // ≈ 45 s, plus l'écart choisi entre deux messages (« Rapide » : 6–10 s), et au plus 15 par heure
  // (sécurité des comptes, 12 nov.) : au-delà, la suite attend l'heure suivante.
  // 5.409 (Julien : « 4 min entre les messages c'est peut-être beaucoup, on garde toujours le temps aléatoire ») :
  // le rythme de CET envoi — « Au hasard » 40 à 90 s (défaut), « Plus prudent » 2 à 4 min — choisi à l'étape 3 ;
  // le serveur tire le temps (api/_lib/favoris-file.js `delaiRythme`), le temps d'écriture s'ajoute.
  let rythmeFav = null;
  const rythmeDe = (m) => rythmeFav || (m && ['normal', 'prudent', 'perso'].includes(m.rythme) ? m.rythme : 'normal');
  function dureeFavMs(n, m) {
    n = Math.max(0, Math.round(Number(n) || 0)); if (!n) return 0;
    m = m || {};
    const lo = Number(m.intervalleMinutes) || 0, hi = Number(m.intervalleMaxMinutes) || lo;
    const ry = rythmeDe(m);
    const ecart = ry === 'normal' ? 40 / 60 : ry === 'prudent' ? 3 : lo === 0 && hi === 0 ? 8 / 60 : (lo + hi) / 2;
    let min = n * 0.75 + (n - 1) * ecart;
    const HEURE = 15;
    if (n > HEURE) min = Math.max(min, Math.floor((n - 1) / HEURE) * 60 + ((n - 1) % HEURE) * Math.max(ecart, 0.75) + 0.75);
    return Math.max(60000, Math.round(min * 60000));
  }
  // ══ 5.419 (Julien, 21 nov. : « avant, je veux un message pré-rempli et je veux pouvoir choisir le taux de réduction
  //    que j'applique à mes articles ») — LA FEUILLE « CONFIRMER L'ENVOI » DU GRAND PANNEAU ═══════════════════════════
  //    · le TAUX : 5 / 10 / 15 / 20 % ou un autre (1 à 90), l'aperçu « 59 € → 53 € » par article coché, l'offre REMONTÉE
  //      au plancher (prix mini, sinon achat + 10 %) dite sur sa ligne — tout calculé par le FOND (`favorisPerso · envoi`,
  //      la règle de l'envoi, `offreFavoriDetail`) ; le taux choisi est gardé pour CE compte (son réglage, réécrit au
  //      lancement par le chemin gardé) ;
  //    · le MESSAGE PRÉ-REMPLI : la version qui partira, remplie pour le 1er favori (`choisirMessageFavori`, même règle
  //      que l'envoi, rien inventé) ; « Modifier pour cet envoi » ouvre SON modèle (variables comprises), jugé par le fond
  //      pendant la frappe ; « Enregistrer comme modèle » le range dans ses messages (`favorisPerso · enregistrer`).
  let favEnv = null, favEnvT = null, favEnvN = 0;
  const ENV_TAUX = [5, 10, 15, 20];
  function envInit(a) {
    const of = (a && a.message && a.message.offre) || null;
    const t0 = of && of.mode === 'pct' && Number.isInteger(Number(of.valeur)) ? Number(of.valeur) : null;
    favEnv = { taux: t0, taux0: t0, autreMode: of && of.mode !== 'pct' ? of.mode : null, arrondi: !!(of && of.arrondi), texte: null, edition: false, info: null, juge: null, etat: null, enVol: false, relire: false, etape: 1, idx: 0, version: '' };
    // 5.420 : le dernier choix de chaque étape, PAR COMPTE (le taux, le message de cet envoi ou la version choisie, le rythme).
    const uid = String((listes && listes.compte && listes.compte.id) || '');
    if (/^\d{1,20}$/.test(uid)) { try { chrome.storage.local.get(ETAPES_CLE, (g) => { try { void chrome.runtime.lastError; } catch (_) {} const m = g && g[ETAPES_CLE] && g[ETAPES_CLE][uid]; if (!m || !favEnv) return; if (Number.isInteger(m.taux) && m.taux >= 1 && m.taux <= 90) favEnv.taux = m.taux; if (typeof m.texte === 'string' && m.texte.trim()) { favEnv.texte = m.texte.slice(0, 2000); favEnv.version = typeof m.version === 'string' ? m.version : ''; } if (['normal', 'prudent'].includes(m.rythme)) rythmeFav = m.rythme; rendre(); envDemander(apercuFav, true); }); } catch (_) {} }
  }
  // ══ 5.420 (Julien, 21 nov. : « on sélectionne, après on valide le prix de réduction et le message à envoyer, puis après on
  //    lance ») — LE PARCOURS EN ÉTAPES : 1 Sélection · 2 Réduction · 3 Message · 4 Lancer. « Suivant » valide l'étape (et
  //    garde son choix pour CE compte), « Retour » revient sans rien perdre ; RIEN ne part avant « Lancer » (le chemin
  //    `lancer` de toujours, avec le taux et le message VALIDÉS). La feuille unique de la 5.419 est découpée, ses pièces
  //    gardées (taux, plancher en ambre, message pré-rempli, « Modifier pour cet envoi », « Enregistrer comme modèle »).
  const ETAPES_CLE = 'vrmFavEtapes';
  const ETAPES_ENV = ['e10_selection', 'e10_reduction', 'e10_message', 'e10_lancer'];
  function garderEtape(champs) {
    const uid = String((listes && listes.compte && listes.compte.id) || '');
    if (!/^\d{1,20}$/.test(uid)) return;
    try { chrome.storage.local.get(ETAPES_CLE, (g) => { try { void chrome.runtime.lastError; } catch (_) {} const m = (g && g[ETAPES_CLE]) || {}; m[uid] = Object.assign({}, m[uid] || {}, champs, { at: Date.now() }); try { chrome.storage.local.set({ [ETAPES_CLE]: m }); } catch (_) {} }); } catch (_) {}
  }
  function barreEtapesHtml() {
    const k = favEnv ? favEnv.etape : 1;
    const noms = favEnv && favEnv.auto ? ETAPES_ENV.map((c) => (c === 'e10_lancer' ? 'e10_enregistrer' : c)) : ETAPES_ENV;
    return `<ol class="et10" data-fav-etapes="${k}" aria-label="${esc(TU('e10_etapes'))}">${noms.map((c, i) => `<li data-fav-etape-pas="${i + 1}"${i + 1 === k ? ' aria-current="step"' : ''}${i + 1 < k ? ' data-fait' : ''}><i aria-hidden="true">${i + 1 < k ? '✓' : i + 1}</i><span>${esc(TU(c))}</span></li>`).join('')}</ol>`
      + `<p class="et10-n" data-fav-etape-nom>${esc(TU('e10_pas', { n: k, t: TU(noms[k - 1]) }))}</p>`;
  }
  // Ceux qui seront SAUTÉS (non cochables de la liste), comptés par raison — jamais cachés.
  function sautesHtml(a) {
    const st = null, par = new Map();
    for (const x of favTous(a)) { if (x.cochable === true) continue; const et = etatFav6(x, st); if (et.k === 'nouveau') continue; const r = et.raison || et.t; par.set(r, (par.get(r) || 0) + 1); }
    if (!par.size) return '';
    return `<details class="et10-sautes" data-fav-sautes="${[...par.values()].reduce((s2, v) => s2 + v, 0)}"><summary>${esc(TU('e10_sautes', { n: [...par.values()].reduce((s2, v) => s2 + v, 0) }))}</summary><ul>${[...par.entries()].map(([r, n]) => `<li><b>${n}</b> ${esc(r)}</li>`).join('')}</ul></details>`;
  }
  function etapesEnvHtml(a) {
    const choisis = envoiFl(a).envoi, n = choisis.length, p = piedFl(a), m = a.message || {};
    const k = favEnv.etape;
    let corps = '';
    if (k === 1) {
      corps = `<ul class="fl-r-l et10-sel" data-fav-etape-liste="${n}">${choisis.map((x) => `<li data-fav-recap-item="${esc(x.itemId)}" data-fav-qui="${esc(x.id)}">${photoFav(x.photo)}<span class="fl-mil"><span class="fl-ti">${x.num ? U.etiquette(x.num) + ' ' : ''}${esc(x.titre || TU('fl_article'))}</span><span class="fl-me">${esc(x.pseudo || TU('fl_acheteur'))} · ${esc(eurosFav(x.prix))}</span></span><button type="button" class="vu-lien" data-fav-etape-retirer="${esc(x.id)}" aria-label="${esc(TU('e10_retirer_aria', { qui: x.pseudo || TU('fl_acheteur') }))}">${esc(TU('e10_retirer'))}</button></li>`).join('')}</ul>`
        + `<p class="fl-note" data-fav-etape-compte>${esc(TU('e10_compte', { n, max: p.max }))}${p.reste > 0 ? ' · ' + esc(TU('fl_reste', { n: p.reste, max: p.max })) : ''}</p>` + sautesHtml(a);
    } else if (k === 2) {
      const sous = choisis.filter((x) => envLigneOffre(x).remontee).length;
      corps = envTauxHtml() + `<ul class="fl-r-l" data-fav-recap-annonces="${n}">${recapLignes(a)}</ul>` + (sous ? `<p class="fl-note ambre" data-fav-etape-remontees="${sous}">${esc(TU('e10_remontees', { n: sous }))}</p>` : '');
    } else if (k === 3) {
      const vs = favEnv.info && Array.isArray(favEnv.info.versions) ? favEnv.info.versions.filter((v) => v.sure) : [];
      const x = choisis[Math.min(favEnv.idx, n - 1)] || null;
      corps = `<div class="et10-qui" data-fav-etape-idx="${favEnv.idx}"><button type="button" class="rond6" data-fav-env-idx="-1"${favEnv.idx <= 0 ? ' disabled' : ''} aria-label="${esc(TU('e10_prec'))}">‹</button><span>${esc(TU('e10_favori_n', { i: favEnv.idx + 1, n, qui: (x && x.pseudo) || TU('fl_acheteur') }))}</span><button type="button" class="rond6" data-fav-env-idx="1"${favEnv.idx >= n - 1 ? ' disabled' : ''} aria-label="${esc(TU('e10_suiv'))}">›</button></div>`
        + envMessageHtml(a)
        + (vs.length > 1 && !favEnv.edition ? `<div class="et10-v" role="group" aria-label="${esc(TU('e10_versions'))}" data-fav-env-versions="${vs.length}"><span class="fl-lbl">${esc(TU('e10_versions'))}</span>${vs.map((v, i) => `<button type="button" class="pu6" data-fav-env-version="${esc(v.id)}" aria-pressed="${favEnv.version === v.id ? 'true' : 'false'}">${esc(TU('fp_message_n', { n: i + 1 }))}</button>`).join('')}${favEnv.version ? `<button type="button" class="vu-lien" data-fav-env-version="">${esc(TU('e10_version_auto'))}</button>` : ''}</div>` : '');
    } else {
      const t = favEnv.taux == null ? TU('fr_sans_offre') : TU('e10_r_taux', { t: favEnv.taux });
      // 5.455.8 : le fond n'a pas (encore) répondu ⇒ le texte que le SERVEUR a préparé pour le 1er favori choisi (jamais « — »
      //    quand un texte existe), comme la bulle de l'étape « Message ».
      const msgCourt = (() => { const mm = favEnv.info && favEnv.info.ok && favEnv.info.message && favEnv.info.message.ok ? favEnv.info.message.texte : (favEnv.texte != null ? favEnv.texte : ((choisis[0] && choisis[0].texte) || '')); return mm ? (mm.length > 90 ? mm.slice(0, 88) + '…' : mm) : '—'; })();
      const plus = p.reste > 0 ? TU('e10_r_plafond', { k: n, r: p.reste, h: heureFl(Date.now() + 3600000) }) : TU('e10_r_tous', { k: n });
      corps = `<ul class="et10-r" data-fav-etape-recap>`
        + `<li data-fav-r="n"><span>${esc(TU('e10_r_favoris'))}</span><b>${esc(String(n))}</b></li>`
        + `<li data-fav-r="taux" data-taux="${favEnv.taux == null ? '' : favEnv.taux}"><span>${esc(TU('e10_reduction'))}</span><b>${esc(t)}</b></li>`
        + `<li data-fav-r="message"${favEnv.texte != null ? ' data-fav-env-modifie' : ''}><span>${esc(TU('e10_message'))}</span><b>${esc(msgCourt)}</b></li>`
        + `<li data-fav-r="plafond"><span>${esc(TU('e10_r_rythme'))}</span><b>${esc(plus)}</b></li></ul>`
        + `<div class="vu-seg fl-rythme" role="group" aria-label="${esc(TU('f5_rythme'))}" data-fav-rythme="${esc(rythmeDe(m))}">${['normal', 'prudent'].map((r) => `<button type="button" data-fav-rythme-b="${r}" aria-pressed="${rythmeDe(m) === r ? 'true' : 'false'}">${esc(TU(r === 'prudent' ? 'fr_rythme_prudent' : 'fr_rythme_normal'))}</button>`).join('')}</div>`
        + `<div class="fl-duree" data-fav-duree="${dureeFavMs(n, m)}">${esc(TU('fr_duree', { d: U.duree(dureeFavMs(n, m)), h: 15 }))}</div>`
        + `<p class="fl-note">${esc(TU('e10_premier'))}</p>`;
    }
    if (favEnv.auto && k === 4) {
      const t = favEnv.taux == null ? TU('fr_sans_offre') : TU('e10_r_taux', { t: favEnv.taux });
      corps = `<ul class="et10-r" data-fav-etape-recap data-fav-auto-recap><li data-fav-r="taux" data-taux="${favEnv.taux == null ? '' : favEnv.taux}"><span>${esc(TU('e10_reduction'))}</span><b>${esc(t)}</b></li><li data-fav-r="message"><span>${esc(TU('e10_message'))}</span><b>${esc(favEnv.texte != null ? (favEnv.texte.length > 90 ? favEnv.texte.slice(0, 88) + '…' : favEnv.texte) : TU('e10_versions_gardees'))}</b></li><li data-fav-r="plancher"><span>${esc(TU('e10_plancher'))}</span><b>${esc(TU('e9_plancher'))}</b></li></ul><p class="fl-note">${esc(TU('e10_auto_rien'))}</p>`;
    }
    const suivantKo = (!n && !favEnv.auto) || (k === 3 && (envBloque() || (!favEnv.auto && !(favEnv.info && favEnv.info.ok))));
    if (favEnv.auto) {
      const piedA = k < 4 ? `<div class="et10-pied"><button type="button" class="vu-btn" data-fav-etape-retour>${esc(TU(k === 2 ? 'ra_annuler' : 'e10_retour'))}</button><button type="button" class="vu-btn vu-plein" data-fav-etape-suivant${suivantKo ? ' disabled' : ''}>${esc(TU(k === 2 ? 'e10_valider_taux' : 'e10_valider_msg'))}</button></div>`
        : `${favErreur ? `<div class="err" role="alert">${esc(favErreur)}</div>` : ''}<div class="et10-pied"><button type="button" class="vu-btn" data-fav-etape-retour>${esc(TU('e10_retour'))}</button><button type="button" class="vu-btn vu-plein" data-fav-auto-enregistrer${favEnv.enVol || envBloque() ? ' disabled' : ''}>${esc(TU('ra_enregistrer'))}</button></div>`;
      return `<section class="fav fl-recap et10-f" data-fav="pret" data-fav-vue="auto" data-fav-etape="${k}" data-fav-auto>${barreEtapesHtml()}<div class="et10-c">${corps}</div>${piedA}</section>`;
    }
    const pied = k < 4
      ? `<div class="et10-pied"><button type="button" class="vu-btn" data-fav-etape-retour>${esc(TU(k === 1 ? 'ra_annuler' : 'e10_retour'))}</button><button type="button" class="vu-btn vu-plein" data-fav-etape-suivant${suivantKo ? ' disabled' : ''}>${esc(TU(k === 2 ? 'e10_valider_taux' : k === 3 ? 'e10_valider_msg' : 'e10_suivant'))}</button></div>`
      : `${favErreur ? `<div class="err" role="alert">${esc(favErreur)}</div>` : ''}<div class="et10-pied"><button type="button" class="vu-btn" data-fav-etape-retour>${esc(TU('e10_retour'))}</button><button class="vu-btn vu-plein" data-fav-lancer${favOccupe || !n || n > favMax(a) || p.attente || envBloque() ? ' disabled' : ''}>${esc(favOccupe ? TU('fr_envoi') : TU('e10_lancer_n', { n }))}</button></div>`;
    return `<section class="fav fl-recap et10-f" data-fav="pret" data-fav-vue="recap" data-fav-n="${n}" data-fav-etape="${k}">${barreEtapesHtml()}<div class="et10-c">${corps}</div>${pied}</section>`;
  }
  function envAncien() {
    const f = (listes && listes.automatisations && listes.automatisations.favoris) || null;
    return f ? { message: (f.textes || [])[0] || '', variantes: (f.textes || []).slice(1) } : null;
  }
  function envDemander(a, vite) {
    clearTimeout(favEnvT);
    favEnvT = setTimeout(() => {
      if (!favEnv || !a) return;
      const n = ++favEnvN;
      const items = envoiFl(a).envoi.map((x) => ({ itemId: String(x.itemId || ''), prix: x.prix, pseudo: x.pseudo || '', titre: x.titre || '' }));
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'favorisPerso', quoi: 'envoi', taux: favEnv.taux, arrondi: favEnv.arrondi, items, ancien: envAncien(), texte: favEnv.texte, index: favEnv.idx || 0 }, (r) => {
        void chrome.runtime.lastError; if (n !== favEnvN || !favEnv) return;
        favEnv.info = r && r.ok ? r : { ok: false, raison: (r && r.raison) || '' };
        favEnv.juge = r && r.ok ? r.juge : null;
        if (favFeuille === 'confirmer') { if (favEnv.etape === 4) rendre(); else envMajSurPlace(a); }   // 5.455.8 : le récapitulatif montre le message prêt
      }); } catch (_) {}
    }, vite ? 0 : 240);
  }
  // L'offre d'UN article coché, telle que le fond l'a calculée (null tant qu'il n'a pas répondu).
  const envOffre = (x) => (favEnv && favEnv.info && favEnv.info.ok && Array.isArray(favEnv.info.offres) ? favEnv.info.offres.find((o) => o.itemId === String(x.itemId)) || null : null);
  function envJugeTexte() {
    const j = favEnv && favEnv.juge;
    if (!j) return '';
    if (j.erreur) return TU(FP_ERR[j.erreur] || 'fp_err_variable');
    if (j.motifs && j.motifs.length) return TU('fp_risque', { quoi: TU(FP_RISQUE[j.motifs[0].code] || 'fp_r_lien'), mot: j.motifs[0].mot });
    return '';
  }
  function envTauxHtml() {
    const t = favEnv ? favEnv.taux : null;
    const libre = t != null && !ENV_TAUX.includes(t) ? String(t) : '';
    return `<div class="env6-taux" data-fav-env-taux="${t == null ? '' : t}"><div class="fl-lbl">${esc(TU('e9_taux'))}</div>`
      + `<div class="env6-l"><div class="vu-seg env6-seg" role="group" aria-label="${esc(TU('e9_taux'))}">${ENV_TAUX.map((k) => `<button type="button" data-fav-env-pct="${k}" aria-pressed="${t === k}">−${k} %</button>`).join('')}</div>`
      + `<label class="env6-libre"><span>${esc(TU('e9_autre'))}</span><input type="number" min="1" max="90" step="1" inputmode="numeric" data-fav-env-libre value="${esc(libre)}" aria-label="${esc(TU('e9_autre_aria'))}"><b>%</b></label></div>`
      + `<p class="fl-note" data-fav-env-note>${esc(t == null ? TU(favEnv && favEnv.autreMode ? 'e9_autre_mode' : 'e9_sans_taux') : TU('e9_plancher'))}</p></div>`;
  }
  function envMessageHtml(a) {
    const info = favEnv && favEnv.info, m = info && info.ok ? info.message : null, x0 = envoiFl(a).envoi[0] || null;
    const qui = x0 ? (x0.pseudo || TU('fl_acheteur')) : '';
    // Le fond n'a pas répondu en détail (extension d'avant, fond muet) : le texte que le SERVEUR a préparé pour ce favori.
    const repli = (!info || !info.ok || !info.message) && favEnv && favEnv.texte == null ? ((x0 && x0.texte) || (favCochables(a).find((x) => x.texte) || {}).texte || '') : '';
    const bulle = m && m.ok ? m.texte : repli ? repli : (!info ? '' : null);
    const raisonKo = m && !m.ok ? TU(m.raison === 'variable' ? 'e9_msg_variable' : m.raison === 'aucun_message' ? 'e9_msg_aucun' : 'e9_msg_refuse') : '';
    const ed = favEnv && favEnv.edition;
    return `<div class="env6-msg" data-fav-env-msg="${ed ? 'edition' : 'apercu'}"${favEnv && favEnv.texte != null ? ' data-fav-env-modifie' : ''}>`
      + `<div class="fl-lbl">${esc(TU('e9_message', { qui }))}${favEnv && favEnv.texte != null ? ' · ' + esc(TU('e9_modifie')) : ''}</div>`
      + (bulle == null ? `<p class="note5 ambre6" data-fav-env-ko>${esc(raisonKo || TU('e9_msg_refuse'))}</p>` : `<div class="bulle" data-fav-message${bulle === '' ? ' data-fav-env-charge' : ''}>${esc(bulle || TU('e9_charge'))}</div>`)
      + (ed ? `<textarea data-fav-env-texte maxlength="2000" rows="4" aria-label="${esc(TU('e9_modele'))}">${esc(favEnv.texte != null ? favEnv.texte : (info && info.modele) || '')}</textarea>`
        + `<p class="fl-note">${esc(TU('e9_vars'))}</p><p class="fp-al" data-fav-env-juge role="alert">${esc(envJugeTexte())}</p>`
        + `<div class="env6-g"><button type="button" class="vu-btn vu-sec" data-fav-env-garder${favEnv.enVol || favEnv.texte == null || envJugeTexte() ? ' disabled' : ''}>${esc(TU('e9_garder'))}</button><button type="button" class="vu-lien" data-fav-env-annuler>${esc(TU('e9_mes_messages'))}</button></div>`
        + (favEnv.etat ? `<p class="fl-note${favEnv.etat.ok ? '' : ' ambre'}" data-fav-env-etat role="status">${esc(favEnv.etat.texte)}</p>` : '')
        : `<button type="button" class="vu-lien" data-fav-env-modifier>${esc(TU('e9_modifier'))}</button>`
          + (favEnv && favEnv.etat ? `<p class="fl-note${favEnv.etat.ok ? '' : ' ambre'}" data-fav-env-etat role="status">${esc(favEnv.etat.texte)}</p>` : ''))
      + '</div>';
  }
  // Les lignes des articles cochés : « 59 € → 53 € », la remontée au plancher dite (jamais sous le prix mini / achat + 10 %).
  function envLigneOffre(x) {
    if (!favEnv || favEnv.taux == null) return { px: esc(eurosFav(x.prix)), note: '' };
    const o = envOffre(x), info = favEnv.info;
    if (!o) {
      const muet = info && (!info.ok || !Array.isArray(info.offres) || !info.offres.length);
      // Fond muet : l'offre préparée par le serveur au taux réglé ; un autre taux ⇒ recalculée à l'envoi (dit).
      if (muet && favEnv.taux === favEnv.taux0 && x.offre != null) return { px: `<s>${esc(eurosFav(x.prix))}</s> → ${esc(eurosFav(x.offre))}`, note: '', offre: x.offre };
      return { px: esc(eurosFav(x.prix)), note: TU(muet ? 'e9_a_lenvoi' : 'e9_calcul') };
    }
    if (o.offre == null) return { px: esc(eurosFav(x.prix)), note: TU(o.raison === 'offre_sous_plancher' ? 'e9_sans_plancher' : 'e9_sans_prix'), sans: true };
    return { px: `<s>${esc(eurosFav(x.prix))}</s> → ${esc(eurosFav(o.offre))}`, note: o.remontee ? TU(o.de === 'achat' ? 'e9_remontee_achat' : 'e9_remontee_mini', { p: eurosFav(o.offre), b: eurosFav(o.base) }) : '', remontee: !!o.remontee, offre: o.offre };
  }
  function recapLignes(a) {
    const choisis = envoiFl(a).envoi;
    const parAnnonce = new Map();
    for (const x of choisis) { const k = String(x.itemId); const o = parAnnonce.get(k) || { x, n: 0 }; o.n++; parAnnonce.set(k, o); }
    return [...parAnnonce.values()].map(({ x, n: k }) => { const L = envLigneOffre(x);
      return `<li data-fav-recap-item="${esc(x.itemId)}"${L.offre != null ? ` data-fav-env-offre="${L.offre}"` : ''}${L.remontee ? ' data-fav-env-remontee' : ''}${L.sans ? ' data-fav-env-sans' : ''}>${photoFav(x.photo)}<span class="fl-mil"><span class="fl-ti">${x.num ? U.etiquette(x.num) + ' ' : ''}${esc(x.titre || TU('fl_article'))}</span><span class="fl-me">${esc(k === 1 ? TU('fr_par1') : TU('fr_par', { n: k }))}${'mini' in x ? ' · ' + esc(x.mini == null ? TU('fl_mini_rien') : TU('fl_mini', { p: eurosFav(x.mini) })) : ''}</span>${L.note ? `<span class="fl-etat${L.remontee || L.sans ? ' ambre' : ''}" data-fav-env-note-l>${esc(L.note)}</span>` : ''}</span><span class="fl-px">${L.px}</span></li>`; }).join('');
  }
  // Rien ne part tant que le texte modifié serait refusé (ou vide).
  const envBloque = () => !!(favEnv && favEnv.texte != null && (envJugeTexte() || !favEnv.texte.trim()));
  // Sur place (le curseur et le champ du taux gardent leur place) : les lignes, la bulle, le jugement, les boutons.
  function envMajSurPlace(a) {
    const f = carte.querySelector('.fav6-feuille[data-fav6-feuille="confirmer"]'); if (!f || !favEnv) return;
    const l = f.querySelector('[data-fav-recap-annonces]'); if (l) poserHtml(l, recapLignes(a));
    const m = f.querySelector('.env6-msg');
    if (m) {
      const b = m.querySelector('[data-fav-message], [data-fav-env-ko]'), d = document.createElement('div'); d.innerHTML = envMessageHtml(a);
      const nb = d.querySelector('[data-fav-message], [data-fav-env-ko]'); if (b && nb) b.replaceWith(nb);
      const j = m.querySelector('[data-fav-env-juge]'); if (j) j.textContent = envJugeTexte();
      const g = m.querySelector('[data-fav-env-garder]'); if (g) g.disabled = !!(favEnv.enVol || favEnv.texte == null || envJugeTexte());
      const t = m.querySelector('[data-fav-env-texte]'); if (t && !t.value && favEnv.texte == null && favEnv.info && favEnv.info.modele) t.value = favEnv.info.modele;
    }
    const lc = f.querySelector('[data-fav-lancer]'); if (lc) lc.disabled = !!(favOccupe || envBloque() || !envoiFl(a).envoi.length || piedFl(a).attente);
    const sv = f.querySelector('[data-fav-etape-suivant]'); if (sv && favEnv.etape === 3) sv.disabled = !!(envBloque() || (!favEnv.auto && !(favEnv.info && favEnv.info.ok)));   // 5.420 : « Valider le message » fermé tant qu'il serait refusé
    const ag = f.querySelector('[data-fav-auto-enregistrer]'); if (ag) ag.disabled = !!(favEnv.enVol || envBloque());
  }
  function brancherEnv(a) {
    const f = carte.querySelector('.fav6-feuille[data-fav6-feuille="confirmer"]'); if (!f || !favEnv) return;
    f.querySelectorAll('[data-fav-env-pct]').forEach((b) => b.addEventListener('click', () => { favEnv.taux = Number(b.getAttribute('data-fav-env-pct')); rendre(); envDemander(a, true); }));
    const li = f.querySelector('[data-fav-env-libre]');
    if (li) li.addEventListener('input', () => {
      const v = Number(li.value);
      if (!(Number.isInteger(v) && v >= 1 && v <= 90)) return;
      favEnv.taux = v;
      f.querySelectorAll('[data-fav-env-pct]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-fav-env-pct')) === v)));
      const tx = f.querySelector('.env6-taux'); if (tx) tx.setAttribute('data-fav-env-taux', String(v));
      const no = f.querySelector('[data-fav-env-note]'); if (no) no.textContent = TU('e9_plancher');
      envDemander(a, false);
    });
    const mo = f.querySelector('[data-fav-env-modifier]'); if (mo) mo.addEventListener('click', () => { favEnv.edition = true; favEnv.etat = null; if (!listes || !listes.automatisations) chargerListes(true); rendre(); const t = carte.querySelector('[data-fav-env-texte]'); if (t) { try { t.focus({ preventScroll: true }); } catch (_) {} } });
    const tx = f.querySelector('[data-fav-env-texte]');
    if (tx) tx.addEventListener('input', () => { favEnv.texte = tx.value.slice(0, 2000); favEnv.etat = null; const ms = f.querySelector('.env6-msg'); if (ms) ms.setAttribute('data-fav-env-modifie', ''); const lc = f.querySelector('[data-fav-lancer]'); if (lc && envBloque()) lc.disabled = true; const sv = f.querySelector('[data-fav-etape-suivant]'); if (sv && envBloque()) sv.disabled = true; envDemander(a, false); });
    const an = f.querySelector('[data-fav-env-annuler]'); if (an) an.addEventListener('click', () => { favEnv.texte = null; favEnv.edition = false; favEnv.juge = null; favEnv.etat = null; rendre(); envDemander(a, true); });
    const ga = f.querySelector('[data-fav-env-garder]'); if (ga) ga.addEventListener('click', () => envGarderModele(a));
    // 5.420 : les étapes (rien ne part ici : « Lancer » reste le seul geste qui envoie).
    const su = f.querySelector('[data-fav-etape-suivant]');
    if (su) su.addEventListener('click', () => {
      if (su.disabled || !favEnv) return;
      if (favEnv.etape === 2) garderEtape({ taux: favEnv.taux });
      if (favEnv.etape === 3) garderEtape({ texte: favEnv.texte != null ? favEnv.texte : '', version: favEnv.version || '' });
      favEnv.etape = Math.min(4, favEnv.etape + 1); favEnv.edition = false; rendre(); if (favEnv.etape >= 2) envDemander(a, true);
    });
    const re = f.querySelector('[data-fav-etape-retour]');
    if (re) re.addEventListener('click', (ev) => { ev.stopImmediatePropagation(); if (!favEnv) return; if (favEnv.etape <= 1 || (favEnv.auto && favEnv.etape <= 2)) { favFeuille = null; vueFav = null; favEnv = null; rendre(); return; } favEnv.etape -= 1; rendre(); }, true);
    const ae = f.querySelector('[data-fav-auto-enregistrer]'); if (ae) ae.addEventListener('click', () => enregistrerAuto(a));
    f.querySelectorAll('[data-fav-etape-retirer]').forEach((b) => b.addEventListener('click', () => { selFav.delete(b.getAttribute('data-fav-etape-retirer')); try { garderSelection(String((listes && listes.compte && listes.compte.id) || '')); } catch (_) {} if (!envoiFl(a).envoi.length) { favFeuille = null; vueFav = null; favEnv = null; } rendre(); }));
    f.querySelectorAll('[data-fav-env-idx]').forEach((b) => b.addEventListener('click', () => { const n = envoiFl(a).envoi.length; favEnv.idx = Math.max(0, Math.min(n - 1, favEnv.idx + Number(b.getAttribute('data-fav-env-idx')))); favEnv.info = null; rendre(); envDemander(a, true); }));
    f.querySelectorAll('[data-fav-env-version]').forEach((b) => b.addEventListener('click', () => { const id = b.getAttribute('data-fav-env-version'); const v = id && favEnv.info && (favEnv.info.versions || []).find((y) => y.id === id); favEnv.version = v ? id : ''; favEnv.texte = v ? v.texte : null; favEnv.juge = null; favEnv.etat = null; rendre(); envDemander(a, true); }));
    f.querySelectorAll('[data-fav-rythme-b]').forEach((b) => b.addEventListener('click', () => garderEtape({ rythme: b.getAttribute('data-fav-rythme-b') })));
  }
  // « Enregistrer comme modèle » : SON texte remplace la version qui allait partir (ou devient sa 1re version), par le
  //    même chemin gardé que l'éditeur (`favorisPerso · enregistrer`) ; l'aperçu sera relu au lancement (`relire`).
  function envGarderModele(a) {
    if (!favEnv || favEnv.enVol || favEnv.texte == null || !favEnv.texte.trim()) return;
    const br = fpInit(), cle = favEnv.info && favEnv.info.cle, t = favEnv.texte.trim();
    let mis = false;
    for (const l of [br.un, ...br.regles.map((r) => r.textes)]) { const v = l.find((y) => y.id === cle); if (v) { v.texte = t; mis = true; break; } }
    if (!mis) br.un.unshift({ id: fpNouvelId('u'), texte: t });
    favEnv.enVol = true; favEnv.etat = null; rendre();
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'favorisPerso', quoi: 'enregistrer', reglage: { un: br.un, lot: br.lot, regles: br.regles } }, (r) => {
      void chrome.runtime.lastError; if (!favEnv) return; favEnv.enVol = false;
      if (r && r.ok) { favEnv.etat = { ok: true, texte: TU('e9_garde_ok') }; favEnv.texte = null; favEnv.edition = false; favEnv.relire = true; chargerListes(true); envDemander(a, true); }
      else favEnv.etat = { ok: false, texte: (r && r.raison) || TU('ra_ko') };
      rendre();
    }); } catch (_) { favEnv.enVol = false; favEnv.etat = { ok: false, texte: TU('ra_ko') }; rendre(); }
  }
  function recapFavHtml(a) {
    const m = a.message || {}, choisis = envoiFl(a).envoi;
    const parAnnonce = new Map();
    for (const x of choisis) { const k = String(x.itemId); const o = parAnnonce.get(k) || { x, n: 0 }; o.n++; parAnnonce.set(k, o); }
    const offreTxt = m.offre ? (m.offre.mode === 'pct' ? `−${m.offre.valeur} %` : m.offre.mode === 'euros' ? `−${eurosFav(m.offre.valeur)}` : `${eurosFav(m.offre.valeur)}`) + (m.offre.arrondi ? ', ' + TU('fr_arrondi') : '') : '';
    const premier = choisis.find((x) => x.texte) || favCochables(a).find((x) => x.texte) || null, n = choisis.length;
    // Une offre SOUS le prix mini posé pour l'article : dit, avant « Confirmer » (il décoche, ou il fixe le mini).
    const sous = (x) => !grand6() && m.offre && x.offre != null && x.mini != null && Number(x.offre) < Number(x.mini);   // 5.410.7 : le grand panneau dit « sans offre » sur la rangée
    // 5.410.7 : dans le grand panneau, l'offre montrée est celle de la rangée (jamais sous le plancher ; sans plancher, aucune).
    const offreR = (x) => { if (!m.offre || x.offre == null) return null; if (!grand6()) return x.offre; const o = offreFav6(x, a); return o && o.v != null ? o.v : null; };
    const nSous = choisis.filter(sous).length;
    return `<section class="fav fl-recap" data-fav="pret" data-fav-vue="recap" data-fav-n="${n}">
      <div class="fl-r-t">${esc(n === 1 ? TU('fl_envoyer1') : TU('fl_envoyer', { n }))}</div>
      ${grand6() && favEnv ? envTauxHtml() : ''}
      <ul class="fl-r-l" data-fav-recap-annonces="${parAnnonce.size}">${grand6() && favEnv ? recapLignes(a) : [...parAnnonce.values()].map(({ x, n: k }) => `<li data-fav-recap-item="${esc(x.itemId)}">${photoFav(x.photo)}<span class="fl-mil"><span class="fl-ti">${x.num ? U.etiquette(x.num) + ' ' : ''}${esc(x.titre || TU('fl_article'))}</span><span class="fl-me">${esc(k === 1 ? TU('fr_par1') : TU('fr_par', { n: k }))}${offreR(x) != null ? ' · ' + esc(TU('fr_offre', { p: eurosFav(offreR(x)) })) : m.offre && grand6() ? ' · ' + esc(TU((offreFav6(x, a) || {}).sans || 'f6_sans_offre')) : ''}${'mini' in x ? ' · ' + esc(x.mini == null ? TU('fl_mini_rien') : TU('fl_mini', { p: eurosFav(x.mini) })) : ''}</span>${sous(x) ? `<span class="fl-etat ambre" data-fav-sous-mini="${esc(x.itemId)}">${esc(TU('fr_sous_mini', { o: eurosFav(x.offre), m: eurosFav(x.mini) }))}</span>` : ''}</span><span class="fl-px">${offreR(x) != null ? `<s>${esc(eurosFav(x.prix))}</s>${esc(eurosFav(offreR(x)))}` : esc(eurosFav(x.prix))}</span></li>`).join('')}</ul>
      ${nSous ? `<div class="fl-alerte" data-fav-sous="${nSous}"><div>${esc(TU('fr_sous_n', { n: nSous }))}</div><div class="fl-alerte-g"><button class="vu-btn vu-sec" data-fav-decocher-sous>${esc(TU('fr_decocher'))}</button><a class="vu-lien" href="${FIXER_MINI_URL}" target="_blank" rel="noopener">${esc(TU('fl_fixer'))}</a></div></div>` : ''}
      ${grand6() && favEnv ? envMessageHtml(a) : `<div class="fl-lbl" data-fav-offre="${m.offre ? esc(m.offre.mode) : 'aucune'}">${esc(m.offre ? TU('fr_offre_mode', { o: offreTxt }) : TU('fr_sans_offre'))}</div>
      <div class="fl-lbl">${esc(TU('fr_message'))}${Number(m.versions) > 1 ? ' · ' + esc(TU('fr_versions', { n: Number(m.versions) })) : ''}</div>
      ${premier ? `<div class="bulle" data-fav-message>${esc(premier.texte)}</div>` : ''}`}
      <div class="vu-seg fl-rythme" role="group" aria-label="${esc(TU('f5_rythme'))}" data-fav-rythme="${esc(rythmeDe(m))}">${['normal', 'prudent'].map((k) => `<button type="button" data-fav-rythme-b="${k}" aria-pressed="${rythmeDe(m) === k ? 'true' : 'false'}">${esc(TU(k === 'prudent' ? 'fr_rythme_prudent' : 'fr_rythme_normal'))}</button>`).join('')}</div>
      <div class="fl-duree" data-fav-duree="${dureeFavMs(n, m)}">${esc(TU('fr_duree', { d: U.duree(dureeFavMs(n, m)), h: 15 }))}</div>
      <p class="fl-note">${esc(TU('fr_rien_avant'))}</p>
      ${favErreur ? `<div class="err" role="alert">${esc(favErreur)}</div>` : ''}
      <button class="vu-btn vu-plein" data-fav-lancer${favOccupe || !n || n > favMax(a) || piedFl(a).attente || (grand6() && envBloque(a)) ? ' disabled' : ''}>${esc(favOccupe ? TU('fr_envoi') : TU('fr_confirmer'))}</button>
      <div class="fl-retour"><button class="vu-lien" data-fav-retour>${esc(TU('fr_retour'))}</button></div>
    </section>`;
  }
  // ══ 5.410.7 — LES FAVORIS EN TABLEAU, COMME LES COMMANDES (Julien, 21 nov. : « je veux qu'on ait une liste pour les
  //    favoris comme pour les ventes ») ═══════════════════════════════════════════════════════════════════════════════
  //    Le grand panneau : plus de parcours en étapes. Une rangée par favori du compte de l'onglet (`apercu.tous`, la règle
  //    du serveur), mêmes pièces que « Commandes » (`table6`, `tr6`, `case5`, `art6`, `cels6`, `et6`, `plaque`) ; l'ÉTAT de
  //    chaque rangée vient de l'aperçu, puis, pendant et après un envoi, de la file du serveur (`file.jobs`, copiée par le
  //    fond, `jobsDuLot`) — aucune règle nouvelle. Les réglages et la confirmation sont des FEUILLES ; rien ne part sans
  //    « Confirmer l'envoi » (le chemin `lancer` d'avant, ses gardes). Un refus du serveur se dit sur les rangées concernées.
  let favFiltre = 'tous', favCherche = '', favTri = { col: 'date', sens: -1 }, favFeuille = null, favRefus = null, dernierApercuFav = null;
  const DERNIER_CLE = 'vrmFavDernier';
  const COLS_F6 = ['prix', 'acheteur', 'date', 'etat'];
  const W6F = { prix: '128px', acheteur: '150px', date: '116px', etat: '210px' };
  const mot6 = (k, d) => { const v = TU(k); return v === k ? TU(d) : v; };
  const RAISON_F6 = { annonce_indisponible: 'vendu', article_vendu: 'vendu', conversation_deja_contactee: 'deja', conversation_existante: 'deja', offre_sous_plancher: 'sous_mini',
    conversation_refusee: 'conv', texte_interdit: 'texte', texte_refuse: 'texte', vinted_robot: 'robot', vinted_frein: 'frein', pause_vinted: 'frein', offre_refusee: 'offre_refusee',
    non_prouve: 'non_prouve', sans_acheteur: 'sans_acheteur', offre_prix: 'offre_prix', annule: 'annule', pas_envoye: 'pas', favori_trop_ancien: 'trop_ancien', trop_ancien: 'trop_ancien', vendue: 'vendu', conversation: 'deja', deja_contacte: 'deja', contacte_30j: 'deja' };
  const raison6 = (c) => mot6('f6_r_' + (RAISON_F6[c] || c || 'autre'), 'f6_r_autre');
  // La file qui compte pour les rangées : en cours, ou finie depuis moins de 6 h (la même borne que la ligne d'envoi).
  const fileVue6 = (e) => { favAgent6 = (e && e.site && e.site.favoris && e.site.favoris.agent) || null; favFaits6 = (e && e.site && e.site.favoris && e.site.favoris.faits && typeof e.site.favoris.faits === 'object') ? e.site.favoris.faits : {}; const st = e && e.site && e.site.favoris ? e.site.favoris.file : null; return st && (st.actif || (st.fin && Date.now() - Number(st.fin.at || 0) < 6 * 3600000)) ? st : null; };
  // ══ 5.455.7 (Julien, 27 nov. 23:00 : « l'extension ne doit pas refuser d'elle-même », il ne comprend pas « Ignoré / Refusé ») ══
  //  SIX états, pas un de plus : Pas encore contacté · En attente (compte à rebours, la raison) · Envoi en cours · Message envoyé
  //  (+ l'offre ; « déjà contacté avant » compte comme envoyé) · Vendu / réservé · une erreur PRÉCISE seulement quand VINTED a
  //  refusé (vérification, pause, texte, offre, téléphone…), avec le geste. Les gardes vraies (plafonds, pause, jamais deux fois)
  //  se disent « En attente » avec leur raison. Plus aucun « Ignoré » ni « Refusé ».
  //  Le DÉTAIL de chaque favori (`faits` du fond : offre faite 49,50 € · 18:42, message envoyé · 18:43 · version 2) vient du
  //  registre écrit au geste, jamais deviné.
  const R6_VENDU = new Set(['annonce_indisponible', 'article_vendu', 'vendue', 'vendu', 'reservee', 'fermee', 'en_pause']);
  const R6_DEJA = new Set(['conversation_deja_contactee', 'conversation_existante', 'deja', 'deja_contacte', 'contacte_30j', 'conversation', 'confirme_vendeur']);
  const R6_VINTED = new Set(['vinted_robot', 'pause_vinted', 'vinted_frein', 'texte_refuse', 'offre_refusee', 'telephone_a_verifier', 'conversation_refusee', 'vinted_refus']);
  const R6_ATTENTE = new Set(['quota_extension', 'notification_pas_trouvee', 'fil_non_relu', 'autorisation_expiree', 'onglet_vinted', 'compte_vinted_absent', 'compte_vinted_different', 'tout_arrete', 'session_extension', 'extension_indisponible', 'element_introuvable', 'trop_tard', 'historique_non_verifie']);
  let favFaits6 = {}, fileVue6Actif = false;
  const heure6 = (t) => { try { return new Date(Number(t)).toLocaleTimeString(langue6(), { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
  const langue6 = () => { try { return (chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || 'fr-FR'; } catch (_) { return 'fr-FR'; } };
  function details6(id) {
    const f = favFaits6 && favFaits6[id]; if (!f || typeof f !== 'object') return [];
    const l = [];
    if (Number(f.o) > 0) l.push(Number(f.px) > 0 ? TU('f6_d_offre', { p: eurosFav(Number(f.px)), h: heure6(f.o) }) : TU('f6_d_offre_sans', { h: heure6(f.o) }));
    if (Number(f.m) > 0) l.push(Number.isInteger(f.v) && f.v > 0 ? TU('f6_d_message_v', { h: heure6(f.m), v: f.v }) : TU('f6_d_message', { h: heure6(f.m) }));
    // 5.455.8 : le refus de Vinted, SA phrase, tant que le favori n'est pas parti depuis.
    if (typeof f.refus === 'string' && f.refus && !(Number(f.m) > Number(f.refusAt))) l.push(TU('f6_d_refus', { t: f.refus, h: heure6(f.refusAt) }));
    return l;
  }
  function etatRaison6(raison, base) {
    const r = String(raison || '');
    if (R6_DEJA.has(r)) return { k: 'envoye', t: TU('f6_e_envoye'), raison: TU('f6_r_deja_avant') };
    if (R6_VENDU.has(r)) return { k: 'vendu', t: TU('f6_e_vendu') };
    if (R6_VINTED.has(r)) return { k: 'vinted', t: TU('f6_e_vinted'), ton: 'ambre', raison: raison6(r) };
    if (R6_ATTENTE.has(r)) return { k: 'attente', t: TU('f6_e_attente'), raison: raison6(r) };
    return Object.assign({ k: 'nouveau', t: TU('f6_e_nouveau') }, r || base ? { raison: raison6(r || base) } : {});
  }
  function etatFav6(x, st) {
    // 5.455.8 : un envoi refusé se dit sur SA rangée (la raison exacte, de Vinted ou de VRM) ; la rangée reste envoyable (« Envoyer »).
    if (favRefus && favRefus.ids.has(x.id) && !(st && Array.isArray(st.jobs) && st.jobs.some((r) => r && r[0] === x.id))) return x.cochable === true ? { k: 'nouveau', t: TU('f6_e_nouveau'), ton: 'ambre', raison: favRefus.raison, refus: true } : { k: 'attente', t: TU('f6_e_attente'), raison: favRefus.raison };
    const j = st && Array.isArray(st.jobs) ? st.jobs.find((r) => r && r[0] === x.id) : null;
    const f = favFaits6 && favFaits6[x.id];
    if (j) {
      const et = j[1];
      if (et === 'envoye') return { k: j[3] || (f && f.o) ? 'offre' : 'envoye', t: TU('f6_e_envoye') };
      if (et === 'reserve' || (st.actif && st.enCours && st.cours === x.id)) return { k: 'encours', t: TU('f6_e_encours'), ton: 'accent' };
      if (et === 'attente') {
        const premier = st.actif && !st.enCours && Number(st.prochain) > Date.now() && st.jobs.find((r) => r && r[1] === 'attente') === j;
        // 5.455.4 (« le chronomètre ne marche pas ») : le prochain favori compte « dans 42 s » en direct.
        return { k: 'attente', t: TU('f6_e_attente'), ...(premier ? { dans: Number(st.prochain) } : {}) };
      }
      if (et === 'incertain') return { k: 'verifier', t: TU('f6_e_verifier'), ton: 'ambre' };
      if (et === 'annule') return { k: 'nouveau', t: TU('f6_e_nouveau') };
      if (f && Number(f.m) > 0) return { k: f.o ? 'offre' : 'envoye', t: TU('f6_e_envoye') };
      return etatRaison6(j[2], et);
    }
    if (f && Number(f.m) > 0) return { k: f.o ? 'offre' : 'envoye', t: TU('f6_e_envoye') };
    if (x.cochable === true) return { k: 'nouveau', t: TU('f6_e_nouveau') };
    if (x.envoi === 'envoye') return { k: x.offreFaite ? 'offre' : 'envoye', t: TU('f6_e_envoye') };
    if (x.envoi === 'en_cours') return { k: 'attente', t: TU('f6_e_attente') };
    if (x.envoi === 'a_verifier') return { k: 'verifier', t: TU('f6_e_verifier'), ton: 'ambre' };
    if (x.raisonFiltre) return { k: 'nouveau', t: TU('f6_e_nouveau'), raison: TU('f6_r_filtre') };
    return etatRaison6(x.raison || x.raisonEnvoi || '', x.envoi === 'pas_envoye' ? 'pas_envoye' : '');
  }
  const GROUPE_F6 = { nouveau: 'nouveaux', attente: 'envoyes', encours: 'envoyes', envoye: 'envoyes', offre: 'envoyes', vendu: 'ignores', verifier: 'ignores', vinted: 'ignores' };
  // L'offre prévue : seulement si une offre est réglée ; jamais sous le plancher (prix mini, sinon achat + 10 % — la règle
  // que le fond revérifie à l'envoi, `plancherFavori`) ; sans plancher, pas d'offre. Le plancher pas su ici est DIT.
  function offreFav6(x, a) {
    const m = (a && a.message) || {};
    if (!m.offre || x.offre == null || !(Number(x.offre) > 0)) return null;
    const toutes = (listes && listes.annonces && (listes.annonces.toutes || listes.annonces.liste)) || null;
    const ann = toutes ? toutes.find((y) => String(y.id) === String(x.itemId)) : null;
    // 5.410.8 (Julien : « comme Bleam ») : l'offre part toujours au prix de SA règle ; le plancher ne fait que la REMONTER
    //    (`offreAvecPlancher` du fond) ; sans plancher connu, au % réglé ; plancher au prix de l'annonce ⇒ pas d'offre.
    const pl = plancher6(Object.assign({}, ann || {}, Number(x.mini) > 0 ? { mini: x.mini } : {}));
    let c = Math.round(Number(x.offre) * 100);
    if (pl && c < Math.round(pl.v * 100)) c = Math.round(pl.v * 100);
    if (c >= Math.round(Number(x.prix) * 100)) return { sans: 'f6_sous_plancher' };
    return { v: c / 100, remontee: c !== Math.round(Number(x.offre) * 100) };
  }
  const valeurF6 = (x, c, st) => (c === 'prix' ? Number(x.prix) || 0 : c === 'date' ? Date.parse(x.date || '') || 0 : c === 'acheteur' ? String(x.pseudo || '').toLowerCase() : c === 'etat' ? etatFav6(x, st).k : String(x.titre || '').toLowerCase());
  const enTeteF6 = (c, lib) => `<button type="button" class="th6" data-fav6-tri="${c}" aria-sort="${favTri.col === c ? (favTri.sens > 0 ? 'ascending' : 'descending') : 'none'}">${esc(lib)}<i aria-hidden="true">${favTri.col === c ? (favTri.sens > 0 ? '↑' : '↓') : '↕'}</i></button>`;
  function celluleF6(x, c, a, st, et) {
    if (c === 'prix') {
      const o = offreFav6(x, a);
      const sous = !o ? '' : o.sans ? `<small class="of6" data-fav-offre6="sans">${esc(TU(o.sans))}</small>` : `<small class="of6" data-fav-offre6="${o.remontee ? 'remontee' : 'oui'}" data-offre="${o.v}">${esc(TU(o.remontee ? 'f6_offre_remontee' : 'f6_offre', { p: eurosFav(o.v) }))}</small>`;
      return `<b>${esc(eurosFav(x.prix) || '—')}</b>${sous}`;
    }
    if (c === 'acheteur') return esc(x.pseudo || TU('fl_acheteur'));
    if (c === 'date') return x.date ? `<span title="${esc(dateCourte5(Date.parse(x.date)))}">${esc(dateCourte5(Date.parse(x.date)).replace(/^(\d\d\/\d\d)\/\d{4}/, '$1 ·'))}</span>` : '<span class="gris6">—</span>';
    // 5.453.2 (Julien, 26 nov. : file bloquée sur « Vérifie les envois incertains », sans geste) : un envoi À VÉRIFIER se tranche
    //    sur SA ligne — il regarde la conversation sur Vinted, puis « C'est parti » ou « Pas parti ». Jamais renvoyé seul.
    const tranche = et.k === 'verifier' ? `<span class="tr6" data-fav6-trancher-ligne="${esc(x.id)}"><button type="button" class="vu-btn" data-fav6-trancher="parti" data-id="${esc(x.id)}">${esc(TU('f6_parti'))}</button><button type="button" class="vu-btn" data-fav6-trancher="pas" data-id="${esc(x.id)}">${esc(TU('f6_pas_parti'))}</button></span>` : '';
    const det = details6(x.id).map((t) => `<small class="rs6 det6" data-fav-fait6>${esc(t)}</small>`).join('');
    const detOffre = et.k === 'offre' && !(favFaits6[x.id] && favFaits6[x.id].o) ? `<small class="rs6 det6" data-fav-fait6="offre">${esc(TU('f6_e_offre'))}</small>` : '';
    // « Envoyer » sur CHAQUE favori pas encore contacté (Julien : « pour chaque favori ») : la même feuille de confirmation, pour
    //    lui seul — le même chemin, les mêmes gardes ; rien ne part sans « Confirmer l'envoi ».
    const un = et.k === 'nouveau' && x.cochable === true ? `<button type="button" class="vu-btn un6" data-fav6-un="${esc(x.id)}" aria-label="${esc(TU('f6_envoyer_un', { qui: x.pseudo || TU('fl_acheteur') }))}">${esc(TU('f6_envoyer'))}</button>` : '';
    return `${etiquette5(et.k, et.t, et.ton === 'ambre' ? 'ambre' : et.ton === 'accent' ? 'accent' : '')}${un}${det}${detOffre}${et.dans ? ` <small class="rs6" data-fav-prochain6>${esc(TU('f_prochain', { dans: '\u0000' })).replace('\u0000', `<span data-fav-dans="${Number(et.dans)}">${esc(dansFav(et.dans))}</span>`)}</small>` : ''}${et.raison ? `<small class="rs6${et.refus ? ' ambre6' : ''}" data-fav-raison6="${esc(et.k)}"${et.refus ? ' data-fav-refus6 role="alert"' : ''}>${esc(et.raison)}</small>` : ''}${tranche}`;
  }
  // ══ 5.420 (Julien, 21 nov. : « sauf si j'ai activé les messages aux favoris automatiques ») — L'AUTOMATIQUE ═══════════
  // Allumé pour ce compte : les NOUVEAUX favoris reçoivent le message sans passer par les étapes (le pilote de toujours,
  // avec les réglages ENREGISTRÉS : taux, versions, filtres, délai, plafonds). L'état reste visible ici ; « Modifier »
  // rouvre les étapes Réduction et Message sur les réglages enregistrés (rien n'est envoyé : « Enregistrer » seulement).
  function autoFavResume() {
    const f = listes && listes.automatisations && listes.automatisations.favoris;
    if (!f) return null;
    const fa = f.auto || null;
    const taux = f.offre && f.offre.mode === 'pct' && Number(f.offre.pct) > 0 ? Number(f.offre.pct) : null;
    return { on: fa ? fa.actif === true : null, taux, versions: Number(f.versions) || (Array.isArray(f.textes) ? f.textes.length : 0), parHeure: fa && Number(fa.parHeure) > 0 ? Number(fa.parHeure) : null, textes: Array.isArray(f.textes) ? f.textes : [], arrondi: !!(f.offre && f.offre.arrondi) };
  }
  // ══ 5.455.8 (Julien, 28 nov. : « je veux un vrai agent autonome qui envoie des messages aux favoris ») — L'AGENT ═══════════
  //  UN interrupteur par compte, éteint tant qu'IL ne l'allume pas (son « Allumer » est l'autorisation) : il dit le message, le
  //  taux de l'offre et le plancher qu'il utilisera. Allumé : la ligne en direct (« Agent favoris : actif · N envoyés
  //  aujourd'hui · prochain dans 42 s »), « Pause » / « Reprendre », « Arrêter », et le journal de chaque envoi (heure, personne,
  //  article, offre, message) — lus de l'état du fond (`agentFavorisPour`), jamais devinés. Le chemin d'envoi est celui de la main.
  let favAgent6 = null, agConfirme = false, agEnVol = false;
  function autoFavLigneHtml() {
    const r = autoFavResume();
    if (!r) return '';
    const on = r.on === true, ag = favAgent6 || {};
    const texte = (r.textes[0] || '').replace(/\s+/g, ' ').trim();
    const desc = [texte ? TU('afv_message', { t: texte.length > 80 ? texte.slice(0, 78) + '…' : texte }) : '', r.taux != null ? TU('afv_offre', { t: r.taux }) : TU('fr_sans_offre'), TU('afv_plancher'), on && r.parHeure ? TU('e10_par_h', { n: r.parHeure }) : ''].filter(Boolean).join(' · ');
    const inter = `<button type="button" class="ag6-int" role="switch" aria-checked="${on}" data-ag-switch="${on ? 'on' : 'off'}"${agEnVol ? ' disabled' : ''}><span class="ag6-t"><b>${esc(TU('afv_titre'))}</b><small>${esc(desc)}</small></span><i class="ag6-i" aria-hidden="true"></i></button>`;
    const conf = !on && agConfirme ? `<div class="ag6-conf" data-ag-confirme role="alertdialog"><p>${esc(TU('afv_conf'))}</p><div class="ag6-b"><button type="button" class="vu-btn" data-ag-non>${esc(TU('ra_annuler'))}</button><button type="button" class="vu-btn vu-plein" data-ag-oui${agEnVol ? ' disabled' : ''}>${esc(TU('afv_allumer'))}</button></div></div>` : '';
    let vivant = '';
    if (on) {
      const dans = !ag.pause && Number(ag.prochain) > Date.now() ? ` · ${esc(TU('afv_prochain'))} <span data-fav-dans="${Number(ag.prochain)}">${esc(dansFav(ag.prochain))}</span>` : '';
      const etat = ag.pause ? TU('afv_en_pause') : TU('afv_actif');
      const tete = `<p class="ag6-l" data-ag-ligne="${ag.pause ? 'pause' : 'actif'}" role="status"><b>${esc(TU('afv_ligne', { etat, n: Number(ag.envoyes) || 0 }))}</b>${dans}</p>`;
      const bout = `<div class="ag6-b">${ag.pause ? `<button type="button" class="vu-btn" data-ag-reprendre>${esc(TU('afv_reprendre'))}</button>` : `<button type="button" class="vu-btn" data-ag-pause>${esc(TU('afv_pause'))}</button>`}<button type="button" class="vu-btn" data-ag-arreter>${esc(TU('afv_arreter'))}</button><button type="button" class="vu-btn" data-fav-auto-modifier>${esc(TU('e10_modifier'))}</button></div>`;
      const tous = apercuFav ? favTous(apercuFav) : [];
      const jr = Array.isArray(ag.journal) ? ag.journal : [];
      const ligneJ = (x) => { const fv = tous.find((y) => y.id === x.n) || null;
        const quoi = [heure6(x.at), (fv && fv.pseudo) || TU('fl_acheteur'), (fv && fv.titre) || ('#' + x.item), Number(x.px) > 0 ? TU('afv_j_offre', { p: eurosFav(Number(x.px)) }) : '', x.etat === 'envoye' ? (x.t ? '« ' + x.t + ' »' : TU('f6_e_envoye')) : TU('afv_j_saute', { r: raison6(x.r || '') })].filter(Boolean).join(' · ');
        return `<li data-ag-j="${esc(x.etat)}">${esc(quoi)}</li>`; };
      const journal = `<details class="ag6-j" data-ag-journal="${jr.length}"><summary>${esc(TU('afv_journal', { n: jr.length }))}</summary>${jr.length ? `<ul>${jr.map(ligneJ).join('')}</ul>` : `<p class="note5">${esc(TU('afv_journal_vide'))}</p>`}</details>`;
      vivant = tete + bout + journal;
    }
    return `<div class="rg6 auto10 ag6" data-fav-auto-etat="${on ? 'on' : 'off'}"${r.taux != null ? ` data-taux="${r.taux}"` : ''}>${inter}${conf}${vivant}</div>`;
  }
  function ouvrirAutoEtapes(a) {
    const r = autoFavResume(); if (!r) return;
    favRefus = null; favErreur = ''; vueFav = 'recap'; favFeuille = 'confirmer';
    envInit(a);
    favEnv.auto = true; favEnv.etape = 2; favEnv.taux = r.taux; favEnv.taux0 = r.taux; favEnv.arrondi = r.arrondi; favEnv.texte = null; favEnv.version = '';
    rendre(); envDemander(a, true);
  }
  // L'exemple des étapes « automatique » : les favoris de la liste (cochables d'abord) — jamais un envoi.
  const exemplesAuto = (a) => { const t = favTous(a); return t.filter((x) => x.cochable === true).concat(t.filter((x) => x.cochable !== true)).slice(0, 5); };
  function enregistrerAuto(a) {
    const r = autoFavResume(); if (!r || !favEnv || favEnv.enVol) return;
    const textes = r.textes.slice();
    if (favEnv.texte != null && favEnv.texte.trim()) { const t = favEnv.texte.trim(); const i = textes.indexOf(t); if (i >= 0) textes.splice(i, 1); textes.unshift(t); }
    favEnv.enVol = true; rendre();
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'reglagesFavoris', message: textes[0] || '', variantes: textes.slice(1, 5), ...(favEnv.taux != null ? { offre: { pct: favEnv.taux, arrondi: !!favEnv.arrondi } } : {}) }, (x) => {
      void chrome.runtime.lastError; if (!favEnv) return; favEnv.enVol = false;
      if (x && x.ok) { garderEtape({ taux: favEnv.taux }); favFeuille = null; favEnv = null; vueFav = null; favErreur = ''; chargerListes(true); }
      else favErreur = (x && x.raison) || TU('ra_ko');
      rendre();
    }); } catch (_) { favEnv.enVol = false; favErreur = TU('ra_ko'); rendre(); }
  }
  // ══ 5.420 — FAVORIS → STATISTIQUES : l'entonnoir (contactés → réponses → offres acceptées → ventes) par compte et par
  // version, puis la répartition des ventes attribuées — la règle <favoris-ventes-regle> du fond (la même que l'app).
  // Moins de 3 cas ⇒ « — » ; une vente sans date sûre ⇒ « au moins » ; CA et bénéfice : dans l'app (règle Compta).
  let favStJours = 30, favSt;
  function lireStatsFav(frais) {
    if (!frais && favSt !== undefined) return;
    favSt = null;
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'favorisPerso', quoi: 'ventes', jours: favStJours }, (r) => { void chrome.runtime.lastError; favSt = r && r.ok ? r : { ok: false }; if (favFeuille === 'stats') rendre(); }); } catch (_) { favSt = { ok: false }; }
  }
  function statsFavHtml() {
    const seg = `<div class="vu-seg seg6" role="group" aria-label="${esc(TU('e10_periode'))}">${[7, 30, 90].map((j) => `<button type="button" data-fav-st-jours="${j}" aria-pressed="${favStJours === j}">${esc(TU('e10_jours', { n: j }))}</button>`).join('')}</div>`;
    const tete = `<div class="fl-r-t">${esc(TU('e10_stats_titre'))}</div>${seg}`;
    if (favSt == null) return `<section class="fav st10" data-fav-stats="lecture">${tete}<p class="note5" role="status">${esc(TU('sa_lecture'))}</p></section>`;
    if (!favSt.ok) return `<section class="fav st10" data-fav-stats="pas-su">${tete}<p class="note5">— ${esc(TU('sa_pas_su'))}</p></section>`;
    const pc = (v) => (v == null ? '—' : v + ' %');
    const ent = (o, k) => `<div class="tr6 st10-l" data-fav-st-ligne="${esc(k)}"><span class="ti">${esc(k)}</span>${['contactes', 'reponses', 'offresAcceptees', 'ventes'].map((c) => `<span data-col="${c}" data-n="${o[c]}"><i class="lc5">${esc(TU('e10_c_' + c))}</i>${nbFr(o[c])}</span>`).join('')}</div>`;
    const T = favSt.total || {};
    const comptes = Object.entries(favSt.parCompte || {}).map(([u, o]) => ent(o, (favSt.noms && favSt.noms[u]) || u)).join('');
    const versions = Object.entries(favSt.parVersion || {}).map(([k, o], i) => ent(o, k ? TU('fp_message_n', { n: i + 1 }) : TU('e10_version_inconnue'))).join('');
    const rp = favSt.repartition, at = favSt.attribuees;
    const cat = (k) => `<div class="rg6" data-fav-st-cat="${k}"><span><b>${esc(TU('e10_cat_' + k))}</b></span><span class="v6">${rp ? (k === 'sans_contact' && !favSt.sansContactLu ? '—' : nbFr(rp[k])) : '—'}</span></div>`;
    return `<section class="fav st10" data-fav-stats="lu" data-jours="${favSt.jours}">${tete}
      <div class="tuiles6" data-fav-st-entonnoir>${['contactes', 'reponses', 'offresAcceptees', 'ventes'].map((c) => `<div class="tu6" data-fav-st="${c}"><span>${esc(TU('e10_c_' + c))}</span><b>${nbFr(T[c] || 0)}</b></div>`).join('')}</div>
      <p class="note5" data-fav-st-taux>${esc(TU('e10_taux_rep', { p: pc(favSt.tauxReponse), l: nbFr(T.relues || 0) }))} · ${esc(TU('e10_taux_vente', { p: pc(favSt.tauxVente) }))}${T.auto ? ' · ' + esc(TU('e10_dont_auto', { n: T.auto })) : ''}</p>
      <h3>${esc(TU('e10_par_compte'))}</h3>${comptes || '<p class="note5">—</p>'}
      <h3>${esc(TU('e10_par_version'))}</h3>${versions || '<p class="note5">—</p>'}
      <h3>${esc(TU('e10_ventes_attribuees'))}</h3>${favSt.ventesLues ? '' : `<p class="note5 ambre6">${esc(TU('fp_stats_sans_ventes', { n: T.contactes || 0 }))}</p>`}
      ${cat('message_seul')}${cat('message_offre')}${cat('offre_acheteur')}${cat('sans_contact')}
      ${favSt.incertaines ? `<p class="note5" data-fav-st-incertaines="${favSt.incertaines}">${esc(TU('e10_incertaines', { n: favSt.incertaines }))}</p>` : ''}
      <div class="rg6" data-fav-st="delai"><span><b>${esc(TU('e10_delai'))}</b></span><span class="v6">${at && at.delaiMoyenJours != null ? esc(TU('e10_j', { n: at.delaiMoyenJours })) : '—'}</span></div>
      <p class="note5">${esc(TU('e10_stats_note'))}</p></section>`;
  }
  function favorisGrandHtml(e) {
    const st = fileVue6(e), actif = !!(st && st.actif);
    const a = avecListe(apercuFav) ? apercuFav : (st && avecListe(dernierApercuFav) ? dernierApercuFav : null);
    const envoi = favorisFileHtml(e);
    if (!a) {
      const corps = favorisOngletCorps(e);
      return `<div class="fav6" data-fav6="sans-liste">${envoi ? `<div class="fav6-envoi">${envoi}</div>` : corps}</div>`;
    }
    const tous = favTous(a);
    const parGroupe = { tous: tous.length, nouveaux: 0, envoyes: 0, ignores: 0 };
    const etats = new Map();
    for (const x of tous) { const et = etatFav6(x, st); etats.set(x.id, et); parGroupe[GROUPE_F6[et.k] || 'ignores']++; }
    const q = favCherche.trim().toLowerCase();
    const vus = tous.filter((x) => (favFiltre === 'tous' || GROUPE_F6[etats.get(x.id).k] === favFiltre) && (!filtreAnnonce || String(x.itemId) === filtreAnnonce)
      && (!q || String(x.titre || '').toLowerCase().includes(q) || String(x.pseudo || '').toLowerCase().includes(q) || String(x.num || '').toLowerCase() === q))
      .sort((y, z) => { const va = valeurF6(y, favTri.col, st), vb = valeurF6(z, favTri.col, st); return (va > vb ? 1 : va < vb ? -1 : 0) * favTri.sens; });
    const montres = vus.slice(0, Math.max(PAGE_FL, vusFl)), suite = Math.min(PAGE_FL, vus.length - montres.length);
    const cochablesVus = actif ? [] : vus.filter((x) => x.cochable === true);
    const tout = cochablesVus.length > 0 && cochablesVus.every((x) => selFav.has(x.id));
    const p = piedFl(a);
    const fi = a.file || null, restes = !actif && fi && (fi.active || Number(fi.attente) > 0) ? Number(fi.attente) || 0 : 0;
    const seg = (k, lib) => `<button type="button" data-fav6-filtre="${k}" aria-pressed="${favFiltre === k}"><span>${esc(TU(lib))}</span> <b data-n="${parGroupe[k]}">${parGroupe[k]}</b></button>`;
    const outils = `<div class="barre5 barre6 fav6-barre"><div class="vu-seg seg6" role="group" aria-label="${esc(TU('c_favoris'))}">${seg('tous', 'f6_seg_tous')}${seg('nouveaux', 'f6_seg_nouveaux')}${seg('envoyes', 'f6_seg_envoyes')}${seg('ignores', 'f6_seg_ignores')}</div>`
      + `<input type="search" class="cherche5" data-fav6-cherche placeholder="${esc(TU('f6_chercher'))}" aria-label="${esc(TU('f6_chercher'))}" value="${esc(favCherche)}">`
      + `<button type="button" class="vu-btn vu-sec reg6" data-fav6-stats aria-haspopup="dialog">${esc(TU('e10_stats'))}</button>`
      + `<button type="button" class="vu-btn vu-sec reg6" data-fav6-reglages aria-haspopup="dialog">${esc(TU('f6_reglages'))}</button></div>`;
    const total = Number(a.totalTous) || tous.length;
    const ligneN = `<div class="n6"><span data-fav6-n="${vus.length}">${esc(vus.length === 1 ? TU('f6_n1') : TU('f6_n', { n: vus.length.toLocaleString('fr-FR') }))}${total > tous.length ? ' · ' + esc(TU('fl_plus', { n: tous.length, total: total.toLocaleString('fr-FR') })) : ''}</span><span class="n6-d">${filtreAnnonce ? `<button type="button" class="vu-lien" data-fav6-annonce-tout>${esc(TU('fl_toutes'))}</button>` : ''}${cochablesVus.length ? `<button type="button" class="vu-lien tout6" data-fav-tout="${tout ? 'aucun' : 'tous'}">${esc(TU(tout ? 'fl_rien' : 'fl_tout'))}</button>` : ''}</span></div>`;
    const notes = [
      autoFavLigneHtml(),
      // 5.455.7 (Julien, 27 nov. 23:10 : « sans crainte de se faire embêter ») : ses messages par défaut sont à lui seul, et les
      //    protections actives, dites en clair (rien n'est réglé ici : ce sont celles de l'extension, inchangées).
      `<p class="note5" data-fav6-uniques>${esc(TU('f6_uniques'))}</p><details class="sur6" data-fav6-sur><summary>${esc(TU('f6_sur_t'))}</summary><ul>${[1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<li>${esc(TU('f6_sur_' + i))}</li>`).join('')}</ul></details>`,
      // 5.455.6 : un dressing ancien ne bloque plus — il est DIT (VRM relit l'annonce et son prix au moment d'envoyer).
      /^dressing_/.test(String(a.avertissement || '')) ? `<p class="note5" data-fav6-avertissement="${esc(a.avertissement)}">${esc(TU('f6_avert_dressing'))}</p>` : '',
      a.ventesAilleurs === 'pas_su' ? '<p class="note5 ambre6" data-fav-ailleurs>Tes ventes sur les autres sites n’ont pas été revérifiées récemment : assure-toi que ces articles ne sont pas vendus ailleurs.</p>' : '',
      Number(a.retires) > 0 ? `<p class="note5" data-fav-caches="${Number(a.retires)}">${esc(TU('fl_caches', { n: Number(a.retires) }))}</p>` : '',
      favErreur ? `<p class="note5 err6" role="alert" data-fav-erreur6>${esc(favErreur)}</p>` : '',
    ].join('');
    fileVue6Actif = !!actif;
    const g6 = COLS_F6.map((c) => W6F[c]).join(' ');
    const enTete = `<div class="tr6 th6r" style="--n6:${COLS_F6.length};--g6:${g6}">${cochablesVus.length ? `<label class="case5"><input type="checkbox" data-fav-tout="${tout ? 'aucun' : 'tous'}"${tout ? ' checked' : ''} aria-label="${esc(TU('f6_tout'))}" title="${esc(TU('f6_tout'))}"></label>` : '<span></span>'}${enTeteF6('titre', TU('c5_article'))}<span class="cels6">${COLS_F6.map((c) => enTeteF6(c, TU('f6_c_' + c))).join('')}</span><span></span></div>`;
    const ligne = (x) => {
      const et = etats.get(x.id), on = !actif && x.cochable === true && !(favRefus && favRefus.ids.has(x.id)), coche = on && selFav.has(x.id), qui = x.pseudo || TU('fl_acheteur');
      return `<li data-fav-qui="${esc(x.id)}" data-fav-item="${esc(x.itemId)}" data-fav-etat6="${esc(et.k)}"${x.date ? ` data-fav-date="${esc(x.date)}"` : ''}${coche ? ' data-coche' : ''}${on ? '' : ' data-fav-off'}><div class="tr6" style="--n6:${COLS_F6.length};--g6:${g6}">`
        + (on ? `<label class="case5"><input type="checkbox" data-fav-coche="${esc(x.id)}"${coche ? ' checked' : ''} aria-label="${esc(TU('fl_cocher', { qui }))}"></label>` : '<span class="case5" aria-hidden="true"></span>')
        + `<span class="art6">${vignette(x.photo)}<span class="ti">${x.num ? plaque(x.num) + ' ' : ''}${esc(x.titre || TU('fl_article'))}</span></span>`
        + `<span class="cels6">${COLS_F6.map((c) => `<span class="cel6" data-col="${c}"><i class="lc5">${esc(TU('f6_c_' + c))}</i>${celluleF6(x, c, a, st, et)}</span>`).join('')}</span><span></span></div></li>`;
    };
    const table = vus.length ? `<div class="table6 fav6-table" data-favoris6="${vus.length}" data-tri="${favTri.col}:${favTri.sens}">${enTete}<ul class="rangs" data-fav-liste="${vus.length}" data-fav-montres="${montres.length}">${montres.map(ligne).join('')}${suite > 0 ? `<li class="fl-suite"><button class="vu-lien" data-fav-suite="${suite}">${esc(TU('fl_voir', { n: suite }))}</button></li>` : ''}</ul></div>`
      : `<div class="val gris vide6" data-fav6-vide>${esc(TU('f6_vide'))}</div>`;
    const bas = !actif && p.n > 0 ? `<div class="fav6-bas" data-fav6-bas><span class="fav6-bas-t"><b data-fav-coches="${p.n}" aria-live="polite">${esc(p.compte)}</b><small>${esc(p.note || TU('fl_max', { max: p.max }))}</small></span>`
      + `<button type="button" class="vu-btn vu-sec" data-fav-tout="aucun">${esc(TU('fl_rien'))}</button><button type="button" class="vu-btn vu-plein" data-fav-envoyer${fi && fi.active ? ' data-fav6-remplacer' : ''}${p.attente ? ` data-fav-a="${p.attente}"` : ''}${!p.k || p.attente || favOccupe ? ' disabled' : ''}>${esc(fi && fi.active && !p.attente ? TU('f6_remplacer', { n: p.k }) : p.bouton)}</button></div>` : '';
    // 5.410.8 : une file restée chez VRM (active ou en pause, son reste d'hier) que ce navigateur ne mène pas : DITE, avec
    //    « Reprendre » et « Annuler » — plus un nouvel envoi qui se fait refuser « déjà préparés ».
    const ancienne = !actif && fi && (fi.active || restes > 0) ? `<div class="fav6-file" data-fav6-file="${fi.active ? 'active' : 'pause'}" data-fav6-attente="${restes}" role="status"><span><b>${esc(TU(fi.active ? 'f6_file_active' : 'f6_file_pause', { n: restes }))}</b>${!fi.active && (fi.raison || fi.raisonCode) ? `<small data-fav6-file-raison>${esc(U.raisonFileFav(fi))}</small>` : ''}<small>${esc(TU('f6_file_note'))}</small></span>${restes ? `<button type="button" class="vu-btn vu-sec" data-fav6-continuer${favOccupe ? ' disabled' : ''}>${esc(TU('a_reprendre'))}</button>` : ''}<button type="button" class="vu-btn vu-sec" data-fav6-annuler${favOccupe ? ' disabled' : ''}>${esc(TU('f6_annuler_file'))}</button></div>` : '';
    return `<div class="fav6" data-fav6="liste" data-fav-vue="tableau"${actif ? ' data-fav6-envoi' : ''}>${envoi ? `<div class="fav6-envoi">${envoi}</div>` : ''}${ancienne}${actif ? '' : lotsHtml()}${outils}${ligneN}${notes}${table}${bas}</div>${feuilleFav6(a)}`;
  }
  // ══ 5.417 (`favorisperso2`, Julien 21 nov. : « on n'a pas la possibilité de personnaliser, améliore ça ») ══════════
  //    L'ÉDITEUR DES MESSAGES AUX FAVORIS, compte de l'onglet : versions « 1 article » et « lot » (une au hasard à chaque
  //    envoi), variables insérables, messages conditionnels (heures, jours, prix, marque ; la plus précise puis la plus
  //    haute), offre au % + arrondi (toujours remontée au plancher), délai et filtres, aperçu sur un VRAI favori de la
  //    liste, statistiques par version. Tout est jugé par le FOND (`favorisPerso` : la règle du moteur) ; rien ne
  //    s'enregistre sans « Enregistrer ».
  let fpBr = null, fpVerif = null, fpStats = null, fpFavori = '', fpActif = null, fpRestaurer = false, fpDernierClic = 0, fpDefil = 0, fpEtat = null, fpEnVol = false, fpVerifT = null, fpDemande = 0;
  const FP_MAX = 2000, FP_VERSIONS = 8, FP_REGLES = 10, FP_RV = 5;
  const FP_VARS_B = [['prénom', 'fp_v_prenom'], ['article', 'fp_v_article'], ['marque', 'fp_v_marque'], ['taille', 'fp_v_taille'], ['prix', 'fp_v_prix'], ['prix_offre', 'fp_v_prix_offre'], ['remise', 'fp_v_remise']];
  const FP_JOURS = [1, 2, 3, 4, 5, 6, 0];
  // Les clés de texte écrites EN ENTIER (audit-extension-feuille L3).
  const FP_ERR = { vide: 'fp_err_vide', long: 'fp_err_long', variable: 'fp_err_variable', accolade: 'fp_err_accolade' };
  const FP_RISQUE = { telephone: 'fp_r_telephone', email: 'fp_r_email', lien: 'fp_r_lien', paiement: 'fp_r_paiement', messagerie: 'fp_r_messagerie', hors: 'fp_r_hors', mainpropre: 'fp_r_mainpropre', contrefacon: 'fp_r_contrefacon' };
  const fpNouvelId = (pre) => pre + Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 1296).toString(36);
  const fpRegleLue = (r) => ({ id: r.id, heures: r.heures ? { de: r.heures.de, a: r.heures.a } : null, jours: Array.isArray(r.jours) ? r.jours.slice() : null, prix: r.prix ? { min: r.prix.min, max: r.prix.max } : null, marques: Array.isArray(r.marques) ? r.marques.slice() : null, textes: (r.textes || []).map((v) => ({ id: v.id, texte: v.texte })) });
  function fpInit() {
    const au = (listes && listes.automatisations) || {}, f = au.favoris || {}, fm = au.bleam && au.bleam.favMessages;
    const of = f.offre || null;
    const offre = { pct: of && of.mode === 'pct' && of.pct ? of.pct : '', arrondi: !!(of && of.arrondi), mode: of ? of.mode : null, valeur: of ? of.valeur : null };
    if (fm && Array.isArray(fm.un) && fm.un.length) return { source: 'perso', un: fm.un.map((v) => ({ id: v.id, texte: v.texte })), lot: (fm.lot || []).map((v) => ({ id: v.id, texte: v.texte })), regles: (fm.regles || []).map(fpRegleLue), offre };
    // Rien d'écrit ici : SES textes d'avant deviennent « Message 1, 2… » (mêmes n° : leurs statistiques suivent).
    const lotAvant = cbEtat && cbEtat.reglages && typeof cbEtat.reglages.messageLot === 'string' ? cbEtat.reglages.messageLot.trim() : '';
    return { source: 'ancien', un: (Array.isArray(f.textes) ? f.textes : []).map((t, i) => ({ id: 'a' + (i + 1), texte: String(t || '') })).filter((v) => v.texte.trim()), lot: lotAvant ? [{ id: 'lot', texte: lotAvant }] : [], regles: [], offre };
  }
  const fpListe = (cle) => (cle === 'un' ? fpBr.un : cle === 'lot' ? fpBr.lot : ((fpBr.regles.find((r) => 'r:' + r.id === cle) || {}).textes || []));
  const fpTrouver = (cleId) => { const i = cleId.lastIndexOf(':'); const cle = cleId.slice(0, i), id = cleId.slice(i + 1); return { cle, id, l: fpListe(cle), v: fpListe(cle).find((x) => x.id === id) }; };
  function fpAlerte(id) {
    const j = fpVerif && fpVerif.versions ? fpVerif.versions[id] : null;
    if (!j) return '';
    if (j.erreur) return TU(FP_ERR[j.erreur] || 'fp_err_variable');
    if (j.motifs && j.motifs.length) return TU('fp_risque', { quoi: TU(FP_RISQUE[j.motifs[0].code] || 'fp_r_lien'), mot: j.motifs[0].mot });
    return '';
  }
  function fpStatsTexte(id) {
    const s = fpStats && fpStats.stats ? fpStats.stats[id] : null;
    const n = s ? s.envoyes : 0;
    // 5.420 (`favorisreponses`) : les réponses de l'acheteur, sur les fils RELUS après l'envoi (« pas relu » ≠ « pas de réponse »).
    const rep = s && s.relues ? ' · ' + TU('fp_st_rep', { r: s.reponses, l: s.relues, p: Math.round((s.reponses * 100) / s.relues) }) : s && s.envoyes ? ' · ' + TU('fp_st_rep_passu') : '';
    const oa = s && s.offresAcceptees ? ' · ' + TU('fp_st_oa', { n: s.offresAcceptees }) : '';
    if (!s || !s.mesure) return TU('fp_st_non', { n }) + rep + oa;
    return TU('fp_st', { n, o: s.avecOffre, v: s.vendus }) + rep + oa + (s.vendusSansDate ? ' · ' + TU('fp_st_sans_date', { n: s.vendusSansDate }) : '');
  }
  function fpVersionsHtml(cle, max) {
    const l = fpListe(cle);
    const ver = l.map((v, i) => { const al = fpAlerte(v.id);
      return `<div class="fp-v" data-fp-v="${esc(cle)}:${esc(v.id)}"${al ? ' data-fp-ko' : ''}><div class="fp-vt"><b>${esc(TU('fp_message_n', { n: i + 1 }))}</b><span class="fp-st" data-fp-stats="${esc(v.id)}">${esc(fpStatsTexte(v.id))}</span>`
        + `<button type="button" class="rond6" data-fp-retirer="${esc(cle)}:${esc(v.id)}" aria-label="${esc(TU('fp_retirer', { n: i + 1 }))}" title="${esc(TU('fp_retirer', { n: i + 1 }))}">×</button></div>`
        + `<textarea data-fp-texte="${esc(cle)}:${esc(v.id)}" maxlength="${FP_MAX}" rows="3" aria-label="${esc(TU('fp_message_n', { n: i + 1 }))}">${esc(v.texte)}</textarea>`
        + `<div class="fp-pied"><span class="fp-n" data-fp-n="${esc(v.id)}">${v.texte.length}/${FP_MAX}</span><span class="fp-al" data-fp-alerte="${esc(v.id)}" role="alert">${esc(al)}</span></div></div>`; }).join('');
    const ins = `<div class="fp-ins" role="group" aria-label="${esc(TU('fp_inserer'))}">${FP_VARS_B.map(([k, lib]) => `<button type="button" data-fp-inserer="${k}" data-fp-cible="${esc(cle)}">+ ${esc(TU(lib))}</button>`).join('')}</div>`;
    return ver + (l.length ? ins : '') + (l.length < max ? `<button type="button" class="fp-ajout" data-fp-ajouter="${esc(cle)}">+ ${esc(TU('fp_ajouter'))}</button>` : '');
  }
  const fpNb = (v) => (v == null || v === '' ? '' : String(v));
  function fpReglesHtml() {
    return fpBr.regles.map((r, i) => {
      const n = (r.heures ? 1 : 0) + (r.jours && r.jours.length && r.jours.length < 7 ? 1 : 0) + (r.prix && (r.prix.min != null || r.prix.max != null) ? 1 : 0) + (r.marques && r.marques.length ? 1 : 0);
      const id = esc(r.id), j = r.jours || [];
      return `<div class="fp-r" data-fp-regle="${id}" data-fp-precision="${n}"><div class="fp-rt"><b>${esc(TU('fp_regle_n', { n: i + 1 }))}</b><small>${esc(n === 1 ? TU('fp_cond1') : TU('fp_condn', { n }))}</small>`
        + `<button type="button" class="rond6" data-fp-monter="${id}" aria-label="${esc(TU('fp_monter'))}" title="${esc(TU('fp_monter'))}"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" class="rond6" data-fp-descendre="${id}" aria-label="${esc(TU('fp_descendre'))}" title="${esc(TU('fp_descendre'))}"${i === fpBr.regles.length - 1 ? ' disabled' : ''}>↓</button><button type="button" class="rond6" data-fp-regle-retirer="${id}" aria-label="${esc(TU('fp_regle_retirer'))}" title="${esc(TU('fp_regle_retirer'))}">×</button></div>`
        + `<div class="fp-cond"><label class="champ6"><b>${esc(TU('fp_c_heures'))}</b><span class="cd6-l"><input type="number" min="0" max="23" inputmode="numeric" data-fp-rc="${id}.hde" value="${esc(fpNb(r.heures && r.heures.de))}" aria-label="${esc(TU('fp_de'))}"> – <input type="number" min="1" max="24" inputmode="numeric" data-fp-rc="${id}.ha" value="${esc(fpNb(r.heures && r.heures.a))}" aria-label="${esc(TU('fp_a'))}"> h</span></label>`
        + `<label class="champ6"><b>${esc(TU('fp_c_prix'))}</b><span class="cd6-l"><input type="number" min="0" step="1" inputmode="decimal" data-fp-rc="${id}.pmin" value="${esc(fpNb(r.prix && r.prix.min))}" aria-label="${esc(TU('fp_de'))}"> – <input type="number" min="0" step="1" inputmode="decimal" data-fp-rc="${id}.pmax" value="${esc(fpNb(r.prix && r.prix.max))}" aria-label="${esc(TU('fp_a'))}"> €</span></label>`
        + `<div class="champ6"><b>${esc(TU('fp_c_jours'))}</b><div class="vu-seg vue5" role="group" aria-label="${esc(TU('fp_c_jours'))}">${FP_JOURS.map((d) => `<button type="button" data-fp-rj="${id}.${d}" aria-pressed="${j.includes(d)}">${esc(TU(BM_JOUR[d]))}</button>`).join('')}</div></div>`
        + `<label class="champ6"><b>${esc(TU('fp_c_marques'))}</b><input type="text" data-fp-rc="${id}.marques" value="${esc((r.marques || []).join(', '))}" placeholder="${esc(TU('fp_marques_ex'))}"></label></div>`
        + fpVersionsHtml('r:' + r.id, FP_RV) + '</div>';
    }).join('') + (fpBr.regles.length < FP_REGLES ? `<button type="button" class="fp-ajout" data-fp-regle-ajouter>+ ${esc(TU('fp_regle_ajouter'))}</button>` : '');
  }
  // L'offre prévue pour l'aperçu : la règle du fond (prix au % réglé, arrondi, REMONTÉE au plancher prix mini / achat + 10 %).
  function fpOffreApercu(x) {
    const pct = Number(fpBr.offre.pct), prix = Number(x && x.prix);
    if (!(prix > 0)) return null;
    if (!(Number.isInteger(pct) && pct >= 1 && pct <= 99)) return fpBr.offre.mode && fpBr.offre.mode !== 'pct' && x.offre > 0 ? { v: Number(x.offre), remontee: false, autre: true } : null;
    let c = Math.round(Math.round(prix * 100) * (100 - pct) / 100);
    if (fpBr.offre.arrondi) c = Math.floor(c / 100) * 100;
    const toutes = (listes && listes.annonces && (listes.annonces.toutes || listes.annonces.liste)) || null;
    const ann = toutes ? toutes.find((y) => String(y.id) === String(x.itemId)) : null;
    const pl = plancher6(Object.assign({}, ann || {}, Number(x.mini) > 0 ? { mini: x.mini } : {}));
    const brut = c;
    if (pl && c < Math.round(pl.v * 100)) c = Math.round(pl.v * 100);
    if (c >= Math.round(prix * 100) || c < 100) return { sans: true, pl };
    return { v: c / 100, remontee: c !== brut, pl, pct };
  }
  const fpFavoris = (a) => favTous(a).filter((x) => x && x.itemId).slice(0, 60);
  function fpFavoriChoisi(a) { const l = fpFavoris(a); return l.find((x) => x.id === fpFavori) || l.find((x) => x.cochable) || l[0] || null; }
  function fpFavoriPourFond(a) {
    const x = fpFavoriChoisi(a); if (!x) return null;
    const toutes = (listes && listes.annonces && (listes.annonces.toutes || listes.annonces.liste)) || null;
    const ann = toutes ? toutes.find((y) => String(y.id) === String(x.itemId)) : null;   // par IDENTITÉ d'annonce
    return { pseudo: x.pseudo || '', titre: x.titre || '', prix: x.prix, marque: (ann && ann.marque) || '', taille: (ann && ann.taille) || '' };
  }
  function fpApercuHtml(a) {
    const l = fpFavoris(a), x = fpFavoriChoisi(a);
    if (!x) return `<p class="note5" data-fp-apercu-vide>${esc(TU('fp_ap_aucun'))}</p>`;
    const sel = `<label class="champ6"><b>${esc(TU('fp_ap_sur'))}</b><select data-fp-favori>${l.map((y) => `<option value="${esc(y.id)}"${y.id === x.id ? ' selected' : ''}>${esc((y.pseudo || TU('fl_acheteur')) + ' · ' + (y.titre || TU('fl_article')))}</option>`).join('')}</select></label>`;
    const ap = fpVerif && fpVerif.apercu, o = fpOffreApercu(x);
    const casTxt = !ap ? TU('fp_ap_calcul') : !ap.ok ? TU(ap.raison === 'variable' ? 'fp_ap_rien_variable' : 'fp_ap_rien_texte') : ap.cas === 'regle' ? TU('fp_ap_regle', { n: Math.max(1, fpBr.regles.findIndex((r) => r.id === ap.regle) + 1) }) : TU('fp_ap_defaut');
    const hasard = ap && ap.ok && ap.possibles > 1 ? ' · ' + TU('fp_ap_hasard', { n: ap.possibles }) : '';
    const offreTxt = !o ? TU('fp_ap_sans_offre') : o.sans ? TU('fp_ap_sous_plancher') : o.autre ? TU('fp_ap_offre', { p: eurosFav(o.v) }) : o.remontee ? TU(o.pl && o.pl.de === 'achat' ? 'fp_ap_offre_achat' : 'fp_ap_offre_mini', { p: eurosFav(o.v) }) : TU('fp_ap_offre_pct', { p: eurosFav(o.v), pct: o.pct });
    const lot = fpVerif && fpVerif.apercuLot && fpVerif.apercuLot.ok && fpVerif.apercuLot.cas === 'lot' ? `<small>${esc(TU('fp_ap_lot'))}</small><p class="fp-bulle" data-fp-ap-lot>${esc(fpVerif.apercuLot.texte)}</p>` : '';
    return sel + `<div class="fp-ap" data-fp-ap-cas="${esc(ap && ap.ok ? ap.cas : ap ? 'rien' : 'calcul')}" data-fp-ap-regle="${esc(ap && ap.regle || '')}" data-fp-ap-cle="${esc(ap && ap.cle || '')}"><small data-fp-ap-titre>${esc(TU('fp_ap_recevrait') + ' · ' + casTxt + hasard)}</small>`
      + `<p class="fp-bulle" data-fp-ap-texte${ap && ap.ok ? '' : ' data-vide'}>${esc(ap && ap.ok ? ap.texte : ap ? TU('fp_ap_rien_note') : '…')}</p><small data-fp-ap-offre="${o && !o.sans ? o.v : ''}">${esc(offreTxt)}</small>${lot}</div>`;
  }
  function fpEditeurHtml(a) {
    if (!fpBr) fpBr = fpInit();
    const au = (listes && listes.automatisations) || {}, f = au.favoris || null;
    if (!f) return `<section class="fav6-reg fp6" data-fav6-reglages-feuille><h3>${esc(TU('f6_reglages_titre'))}</h3><p class="note5" role="status">${esc(TU('f6_reglages_charge'))}</p><div class="pied6"><button type="button" class="vu-btn" data-fav6-fermer>${esc(TU('f6_fermer'))}</button></div></section>`;
    const nom = listes && listes.compte && listes.compte.nom ? '@' + listes.compte.nom : '';
    const ry = (raBrouillon.favoris && raBrouillon.favoris.rythme) || f.rythme || 'normal';
    const etat = fpEtat ? `<p class="note5" role="status" data-fp-etat="${fpEtat.ok ? 'ok' : 'ko'}">${esc(fpEtat.texte)}</p>` : '';
    const sureKo = fpVerif && fpVerif.sure === false && fpBr.un.length ? `<p class="note5 fp-al" data-fp-sure-ko>${esc(TU('fp_sure_ko'))}</p>` : '';
    const of = fpBr.offre;
    const autreOffre = of.mode && of.mode !== 'pct' ? `<p class="fp-sous" data-fp-offre-autre>${esc(TU('fp_offre_autre', { o: of.mode === 'euros' ? '−' + eurosFav(of.valeur) : eurosFav(of.valeur) }))}</p>` : '';
    const bmF = bmVal('favoris'), bmOn = bmF.actif === true;
    const confF = bmConfirme && bmConfirme.section === 'favoris' ? `<div class="conf5" role="alertdialog" data-bm-confirme="favoris"><p>${esc(TU('ra_confirme_q', { nom: TU('bm_s_favoris') }))}</p><div class="outils"><button type="button" class="vu-btn vu-plein" data-bm-oui>${esc(TU('ra_oui'))}</button><button type="button" class="vu-btn" data-bm-non>${esc(TU('ra_annuler'))}</button></div></div>` : '';
    return `<section class="fav6-reg fp6" data-fav6-reglages-feuille data-fp-editeur data-fp-source="${esc(fpBr.source)}"><h3>${esc(TU('f6_reglages_titre'))}</h3>`
      + `<div class="fp-compte" data-fp-compte>${esc(TU('fp_sur', { c: nom || TU('fl_acheteur') }))}<small>${esc(TU('fp_sur_note'))}</small></div>${etat}`
      + `<h3>${esc(TU('fp_t_un'))}</h3><p class="fp-sous">${esc(TU('fp_un_note'))}</p>${sureKo}<div data-fp-cas="un">${fpVersionsHtml('un', FP_VERSIONS)}</div>`
      + `<h3>${esc(TU('fp_t_lot'))}</h3><p class="fp-sous">${esc(TU('fp_lot_note'))}</p><div data-fp-cas="lot">${fpVersionsHtml('lot', FP_VERSIONS)}</div>`
      + `<h3>${esc(TU('fp_t_regles'))}</h3><p class="fp-sous">${esc(TU('fp_regles_note'))}</p><div data-fp-regles="${fpBr.regles.length}">${fpReglesHtml()}</div>`
      + `<h3>${esc(TU('fp_t_offre'))}</h3><p class="fp-sous">${esc(TU('fp_offre_note'))}</p>${autreOffre}`
      + `<div class="rg6"><span><b>${esc(TU('fp_offre_pct'))}</b></span><span class="cd6-l"><input type="number" min="1" max="90" step="1" inputmode="numeric" data-fp-offre-pct value="${esc(fpNb(of.pct))}" aria-label="${esc(TU('fp_offre_pct'))}"> %</span></div>`
      + `<div class="rg6"><span><b>${esc(TU('fp_arrondi'))}</b></span><div class="vu-seg vue5" role="group">${[['non', 'fp_arrondi_non'], ['oui', 'fp_arrondi_oui']].map(([k, l]) => `<button type="button" data-fp-arrondi="${k}" aria-pressed="${(k === 'oui') === !!of.arrondi}">${esc(TU(l))}</button>`).join('')}</div></div>`
      + `<h3>${esc(TU('fp_t_delai'))}</h3><p class="fp-sous">${esc(TU('fp_delai_note'))}</p>${confF}`
      + `<div class="rg6"><span><b>${esc(TU('ra_etat'))}</b></span><button type="button" class="vu-btn ra6" data-bm-bascule="favoris" aria-pressed="${bmOn}">${esc(TU(bmOn ? 'ra_eteindre' : 'ra_allumer'))}</button></div>`
      + bmNombre('favoris', 'apresMin', 'fp_delai', 0, 1440) + bmNombre('favoris', 'noteMin', 'bm_note_min', 0, 5) + bmNombre('favoris', 'parArticle', 'bm_par_article', 0, 50) + bmNombre('favoris', 'periodeJours', 'bm_periode', 0, 90) + bmNombre('favoris', 'reecrireJours', 'bm_reecrire', 0, 30)
      + `<div class="rg6"><span><b>${esc(TU('f5_rythme'))}</b><small>${esc(TU('f6_rythme_note'))}</small></span><div class="vu-seg vue5" role="group">${['normal', 'prudent'].map((k) => `<button type="button" data-rf-rythme="${k}" aria-pressed="${ry === k}">${esc(TU(k === 'prudent' ? 'fr_rythme_prudent' : 'fr_rythme_normal'))}</button>`).join('')}</div></div>`
      + `<h3>${esc(TU('fp_t_apercu'))}</h3><div data-fp-apercu>${fpApercuHtml(a)}</div>`
      + `<p class="fp-sous" data-fp-stats-note>${esc(fpStats ? (fpStats.ok ? TU(fpStats.ventesLues ? 'fp_stats_note' : 'fp_stats_sans_ventes', { n: fpStats.envois }) : TU('fp_stats_ko')) : TU('fp_stats_charge'))}</p>`
      + `<div class="pied6"><button type="button" class="vu-btn" data-fav6-fermer>${esc(TU('f6_fermer'))}</button><button type="button" class="vu-btn vu-plein" data-fp-enregistrer${fpEnVol ? ' disabled' : ''}>${esc(TU('ra_enregistrer'))}</button></div></section>`;
  }
  // Ce que le fond juge (la règle du moteur) : chaque version, et l'aperçu sur le favori choisi.
  function fpVerifier(a, tout) {
    clearTimeout(fpVerifT);
    fpVerifT = setTimeout(() => {
      if (!fpBr) return;
      const n = ++fpDemande, x = fpFavoriChoisi(a), o = x ? fpOffreApercu(x) : null;
      const f = (listes && listes.automatisations && listes.automatisations.favoris) || {};
      const ancien = { message: (f.textes || [])[0] || '', variantes: (f.textes || []).slice(1), lot: cbEtat && cbEtat.reglages ? cbEtat.reglages.messageLot || '' : '' };
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'favorisPerso', quoi: 'verifier', reglage: { un: fpBr.un, lot: fpBr.lot, regles: fpBr.regles }, ancien, favori: fpFavoriPourFond(a), offre: o && !o.sans ? { prix: o.v } : null }, (r) => {
        void chrome.runtime.lastError; if (n !== fpDemande || !r || !r.ok) return; fpVerif = r;
        if (tout) { rendre(); return; }
        fpMajSurPlace(a);
      }); } catch (_) {}
    }, tout ? 0 : 260);
  }
  // Sans redessiner (le curseur reste où il est) : alertes, compteurs, aperçu.
  function fpMajSurPlace(a) {
    const r = carte.querySelector('[data-fp-editeur]'); if (!r) return;
    r.querySelectorAll('[data-fp-alerte]').forEach((el) => { const id = el.getAttribute('data-fp-alerte'); const t = fpAlerte(id); el.textContent = t; const v = el.closest('.fp-v'); if (v) { if (t) v.setAttribute('data-fp-ko', ''); else v.removeAttribute('data-fp-ko'); } });
    const ap = r.querySelector('[data-fp-apercu]'); if (ap) poserHtml(ap, fpApercuHtml(a));
    const sk = r.querySelector('[data-fp-sure-ko]'); if (sk && fpVerif && fpVerif.sure !== false) sk.remove();
    fpBrancherApercu(a);
  }
  function fpBrancherApercu(a) {
    const s = carte.querySelector('[data-fp-favori]'); if (s && !s.__fp) { s.__fp = 1; s.addEventListener('change', () => { fpFavori = s.value; fpVerifier(a, false); }); }
  }
  function fpOuvrir(a) {
    fpBr = null; fpVerif = null; fpEtat = null; fpStats = null; fpActif = null; fpDefil = 0;
    lireCommeBleam(true);
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'favorisPerso', quoi: 'stats' }, (r) => { void chrome.runtime.lastError; fpStats = r && r.ok ? r : { ok: false }; if (favFeuille === 'reglages') rendre(); }); } catch (_) {}
    fpVerifier(a, true);
  }
  function fpEnregistrer(a) {
    if (fpEnVol || !fpBr) return;
    fpEnVol = true; fpEtat = null; rendre();
    const pct = Number(fpBr.offre.pct);
    const offre = Number.isInteger(pct) && pct >= 1 && pct <= 90 && (fpBr.offre.changee || fpBr.offre.mode === 'pct') ? { pct, arrondi: !!fpBr.offre.arrondi } : null;
    const rythme = raBrouillon.favoris && raBrouillon.favoris.rythme;
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'favorisPerso', quoi: 'enregistrer', reglage: { un: fpBr.un, lot: fpBr.lot, regles: fpBr.regles }, ...(offre ? { offre } : {}), ...(rythme ? { rythme } : {}) }, (r) => {
      void chrome.runtime.lastError; fpEnVol = false;
      fpEtat = { ok: !!(r && r.ok), texte: r && r.ok ? TU('ra_ok') : ((r && r.raison) || TU('ra_ko')) };
      if (r && r.ok) { if (raBrouillon.favoris) delete raBrouillon.favoris.rythme; chargerListes(true); apercuFavAt = 0; if (bmBrouillon.favoris) bmEnvoyer('favoris', bmVal('favoris').actif === true, false); }
      rendre();
    }); } catch (_) { fpEnVol = false; fpEtat = { ok: false, texte: TU('ra_ko') }; rendre(); }
  }
  function brancherFp(a) {
    const r = carte.querySelector('[data-fp-editeur]'); if (!r || !fpBr) return;
    // Un redessin (ajouter, retirer, un jour touché, la réponse du fond) garde l'endroit où il était dans la feuille.
    const fe = r.closest('.fav6-feuille'); if (fe) { if (fpDefil) fe.scrollTop = fpDefil; fe.addEventListener('scroll', () => { fpDefil = fe.scrollTop; }, { passive: true }); }
    const regle = (id) => fpBr.regles.find((x) => x.id === id);
    r.querySelectorAll('[data-fp-texte]').forEach((t) => {
      const k = t.getAttribute('data-fp-texte');
      t.addEventListener('focus', () => { if (!fpActif || fpActif.k !== k) fpActif = { k, pos: t.selectionStart, t: Date.now() }; });
      t.addEventListener('input', () => { const f = fpTrouver(k); if (f.v) f.v.texte = t.value.slice(0, FP_MAX); fpActif = { k, pos: t.selectionStart, t: Date.now() }; const n = r.querySelector(`[data-fp-n="${f.id}"]`); if (n) n.textContent = `${t.value.length}/${FP_MAX}`; fpVerifier(a, false); });
      t.addEventListener('keyup', () => { if (fpActif && fpActif.k === k) fpActif.pos = t.selectionStart; });
      t.addEventListener('click', () => { fpActif = { k, pos: t.selectionStart, t: Date.now() }; });
    });
    r.querySelectorAll('[data-fp-inserer]').forEach((b) => b.addEventListener('mousedown', (ev) => ev.preventDefault()));
    r.querySelectorAll('[data-fp-inserer]').forEach((b) => b.addEventListener('click', () => {
      const cible = b.getAttribute('data-fp-cible'), l = fpListe(cible); if (!l.length) return;
      const k = fpActif && fpActif.k.slice(0, fpActif.k.lastIndexOf(':')) === cible ? fpActif.k : cible + ':' + l[l.length - 1].id;
      const f = fpTrouver(k); if (!f.v) return;
      const mot = '{' + b.getAttribute('data-fp-inserer') + '}', pos = fpActif && fpActif.k === k && Number.isInteger(fpActif.pos) ? fpActif.pos : f.v.texte.length;
      const avant = f.v.texte.slice(0, pos), apres = f.v.texte.slice(pos), sep = avant && !/\s$/.test(avant) ? ' ' : '', sep2 = apres && !/^[\s,.!?;:)]/.test(apres) ? ' ' : '';
      f.v.texte = (avant + sep + mot + sep2 + apres).slice(0, FP_MAX); fpActif = { k, pos: (avant + sep + mot).length, t: Date.now() }; fpRestaurer = true;
      rendre(); fpVerifier(a, false);
    }));
    r.querySelectorAll('[data-fp-ajouter]').forEach((b) => b.addEventListener('click', () => { const c = b.getAttribute('data-fp-ajouter'), l = fpListe(c); const id = fpNouvelId(c === 'un' ? 'u' : c === 'lot' ? 'l' : 'v'); l.push({ id, texte: '' }); fpActif = { k: c + ':' + id, pos: 0, t: Date.now() }; fpRestaurer = true; rendre(); }));
    r.querySelectorAll('[data-fp-retirer]').forEach((b) => b.addEventListener('click', () => { const f = fpTrouver(b.getAttribute('data-fp-retirer')); const i = f.l.indexOf(f.v); if (i >= 0) f.l.splice(i, 1); fpActif = null; rendre(); fpVerifier(a, false); }));
    const ra = r.querySelector('[data-fp-regle-ajouter]'); if (ra) ra.addEventListener('click', () => { fpBr.regles.push({ id: fpNouvelId('r'), heures: null, jours: null, prix: null, marques: null, textes: [{ id: fpNouvelId('v'), texte: '' }] }); rendre(); });
    r.querySelectorAll('[data-fp-regle-retirer]').forEach((b) => b.addEventListener('click', () => { fpBr.regles = fpBr.regles.filter((x) => x.id !== b.getAttribute('data-fp-regle-retirer')); rendre(); fpVerifier(a, false); }));
    const bouger = (id, d) => { const i = fpBr.regles.findIndex((x) => x.id === id), j = i + d; if (i < 0 || j < 0 || j >= fpBr.regles.length) return; const l = fpBr.regles; [l[i], l[j]] = [l[j], l[i]]; rendre(); fpVerifier(a, false); };
    r.querySelectorAll('[data-fp-monter]').forEach((b) => b.addEventListener('click', () => bouger(b.getAttribute('data-fp-monter'), -1)));
    r.querySelectorAll('[data-fp-descendre]').forEach((b) => b.addEventListener('click', () => bouger(b.getAttribute('data-fp-descendre'), 1)));
    r.querySelectorAll('[data-fp-rc]').forEach((c) => c.addEventListener('input', () => {
      const [id, ch] = c.getAttribute('data-fp-rc').split('.'); const x = regle(id); if (!x) return; const v = c.value.trim();
      if (ch === 'hde' || ch === 'ha') { const h = Object.assign({ de: null, a: null }, x.heures || {}); h[ch === 'hde' ? 'de' : 'a'] = v === '' ? null : Number(v); x.heures = h.de == null && h.a == null ? null : h; }
      else if (ch === 'pmin' || ch === 'pmax') { const p = Object.assign({ min: null, max: null }, x.prix || {}); p[ch === 'pmin' ? 'min' : 'max'] = v === '' ? null : Number(v.replace(',', '.')); x.prix = p.min == null && p.max == null ? null : p; }
      else if (ch === 'marques') { const l = v.split(/[,;]+/).map((m) => m.trim()).filter(Boolean); x.marques = l.length ? l : null; }
      const pr = r.querySelector(`[data-fp-regle="${id}"] .fp-rt small`); if (pr) { const bloc = pr.closest('[data-fp-regle]'); const n = (x.heures && x.heures.de != null && x.heures.a != null && x.heures.de !== x.heures.a ? 1 : 0) + (x.jours && x.jours.length && x.jours.length < 7 ? 1 : 0) + (x.prix ? 1 : 0) + (x.marques ? 1 : 0); pr.textContent = n === 1 ? TU('fp_cond1') : TU('fp_condn', { n }); if (bloc) bloc.setAttribute('data-fp-precision', String(n)); }
      fpVerifier(a, false);
    }));
    r.querySelectorAll('[data-fp-rj]').forEach((b) => b.addEventListener('click', () => { const [id, d] = b.getAttribute('data-fp-rj').split('.'); const x = regle(id); if (!x) return; const j = Number(d); const l = Array.isArray(x.jours) ? x.jours.slice() : []; x.jours = l.includes(j) ? l.filter((y) => y !== j) : l.concat([j]); if (!x.jours.length) x.jours = null; rendre(); fpVerifier(a, false); }));
    const pc = r.querySelector('[data-fp-offre-pct]'); if (pc) pc.addEventListener('input', () => { fpBr.offre.pct = pc.value === '' ? '' : Number(pc.value); fpBr.offre.changee = true; fpVerifier(a, false); });
    r.querySelectorAll('[data-fp-arrondi]').forEach((b) => b.addEventListener('click', () => { fpBr.offre.arrondi = b.getAttribute('data-fp-arrondi') === 'oui'; fpBr.offre.changee = true; rendre(); fpVerifier(a, false); }));
    const en = r.querySelector('[data-fp-enregistrer]'); if (en) en.addEventListener('click', () => fpEnregistrer(a));
    fpBrancherApercu(a);
    // Le curseur revient là où il était (un redessin ne fait pas perdre la saisie).
    //    Seulement après SON geste d'écriture (insérer, ajouter) ou s'il tapait il y a moins de 4 s sans avoir touché
    //    autre chose depuis — jamais quand il vient de toucher un autre bouton.
    r.addEventListener('pointerdown', (ev) => { const b = ev.target && ev.target.closest ? ev.target.closest('button, select, input:not([data-fp-texte])') : null; if (b && !b.hasAttribute('data-fp-inserer')) fpDernierClic = Date.now(); }, true);
    const garder = fpActif && (fpRestaurer || (Number(fpActif.t) > fpDernierClic && Date.now() - Number(fpActif.t) < 4000));
    fpRestaurer = false;
    if (garder) { const t = r.querySelector(`[data-fp-texte="${fpActif.k}"]`); if (t) { const p = Math.min(t.value.length, Number.isInteger(fpActif.pos) ? fpActif.pos : t.value.length); try { t.focus({ preventScroll: true }); t.setSelectionRange(p, p); } catch (_) {} fpActif.pos = p; } }
  }
  // Les feuilles : « Réglages » (textes et rythme — le même chemin gardé que la page Automatisations, `reglagesFavoris`)
  // et la confirmation (le récapitulatif de toujours, `recapFavHtml`, avec « Confirmer l'envoi »).
  function feuilleFav6(a) {
    if (!favFeuille) return '';
    let corps = '';
    if (favFeuille === 'confirmer' && a && favEnv && favEnv.auto && grand6()) corps = etapesEnvHtml(a);
    else if (favFeuille === 'confirmer' && a && a.etat === 'pret' && envoiFl(a).envoi.length) corps = grand6() && favEnv ? etapesEnvHtml(a) : recapFavHtml(a);   // 5.420 : le parcours en étapes
    else if (favFeuille === 'reglages') {
      corps = fpEditeurHtml(a);   // 5.417 (`favorisperso2`) : l'éditeur des messages
    } else if (favFeuille === 'stats') corps = statsFavHtml();   // 5.420 : les ventes obtenues
    else return '';
    return `<div class="fav6-voile" data-fav6-voile><div class="fav6-feuille" role="dialog" aria-modal="true" data-fav6-feuille="${favFeuille}">${favFeuille === 'confirmer' || favFeuille === 'stats' ? `<header class="fe6-h"><b>${esc(TU(favFeuille === 'stats' ? 'fe6_stats' : favEnv && favEnv.auto ? 'fe6_auto' : 'fe6_confirmer'))}</b><button type="button" class="rond6 fav6-x" data-fav6-fermer aria-label="${esc(TU('f6_fermer'))}">×</button></header>` : ''}${corps}</div></div>`;
  }
  // Pendant un envoi, la liste montrée au lancement (gardée par compte : un rechargement de la page la retrouve).
  function garderDernier(uid, a) {
    dernierApercuFav = a;
    try {
      const leger = Object.assign({}, a, { tous: favTous(a).slice(0, 300).map((x) => { const y = Object.assign({}, x); delete y.texte; return y; }), liste: [] });
      chrome.storage.local.get(DERNIER_CLE, (g) => { try { void chrome.runtime.lastError; } catch (_) {} const m = (g && g[DERNIER_CLE]) || {}; for (const k of Object.keys(m)) if (Date.now() - Number(m[k] && m[k].at || 0) > 6 * 3600000) delete m[k]; m[String(uid)] = { at: Date.now(), a: leger }; try { chrome.storage.local.set({ [DERNIER_CLE]: m }); } catch (_) {} });
    } catch (_) {}
  }
  let dernierLu = '';
  function lireDernier(uid) {
    if (dernierApercuFav || dernierLu === String(uid)) return;
    dernierLu = String(uid);
    try { chrome.storage.local.get(DERNIER_CLE, (g) => { try { void chrome.runtime.lastError; } catch (_) {} const v = g && g[DERNIER_CLE] && g[DERNIER_CLE][String(uid)]; if (v && v.a && Date.now() - Number(v.at || 0) < 6 * 3600000) { dernierApercuFav = v.a; if (carte.classList.contains('on')) rendre(); } }); } catch (_) {}
  }
  function brancherFavoris6(e) {
    const racine = carte.querySelector('.fav6');
    if (!racine) return;
    const uid = e && e.site && e.site.id ? String(e.site.id) : '';
    const liste = racine.querySelector('.fav6-table .rangs');
    const suivre = (id, on) => { if (on) selFav.add(id); else selFav.delete(id); garderSelection(uid); rendre(); };
    if (liste) {
      liste.addEventListener('change', (ev) => { const el = ev.target; if (!el || !el.matches || !el.matches('[data-fav-coche]') || el.disabled) return; suivre(el.getAttribute('data-fav-coche'), el.checked); });
      liste.addEventListener('click', (ev) => { const li = ev.target && ev.target.closest ? ev.target.closest('li[data-fav-qui]') : null; if (!li || (ev.target.closest && ev.target.closest('label.case5'))) return; const c = li.querySelector('[data-fav-coche]'); if (c && !c.disabled) suivre(c.getAttribute('data-fav-coche'), !c.checked); });
    }
    racine.querySelectorAll('[data-fav-tout]').forEach((b) => b.addEventListener(b.tagName === 'INPUT' ? 'change' : 'click', () => {
      const a = avecListe(apercuFav) ? apercuFav : null; if (!a) return;
      if (b.getAttribute('data-fav-tout') === 'aucun') selFav = new Set();
      else { const st = fileVue6(e); for (const x of favCochables(a)) { const et = etatFav6(x, st); const q = favCherche.trim().toLowerCase(); if ((favFiltre === 'tous' || GROUPE_F6[et.k] === favFiltre) && et.k === 'nouveau' && (!filtreAnnonce || String(x.itemId) === filtreAnnonce) && (!q || String(x.titre || '').toLowerCase().includes(q) || String(x.pseudo || '').toLowerCase().includes(q))) selFav.add(x.id); } }
      garderSelection(uid); rendre();
    }));
    racine.querySelectorAll('[data-fav6-filtre]').forEach((b) => b.addEventListener('click', () => { favFiltre = b.getAttribute('data-fav6-filtre'); vusFl = PAGE_FL; rendre(); }));
    racine.querySelectorAll('[data-fav6-tri]').forEach((b) => b.addEventListener('click', () => { const c = b.getAttribute('data-fav6-tri'); favTri = favTri.col === c ? { col: c, sens: -favTri.sens } : { col: c, sens: c === 'titre' || c === 'acheteur' || c === 'etat' ? 1 : -1 }; rendre(); }));
    const ch = racine.querySelector('[data-fav6-cherche]'); if (ch) ch.addEventListener('input', () => { favCherche = ch.value; const pos = ch.selectionStart; vusFl = PAGE_FL; rendre(); const n = carte.querySelector('[data-fav6-cherche]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } });
    const at = racine.querySelector('[data-fav6-annonce-tout]'); if (at) at.addEventListener('click', () => { filtreAnnonce = ''; rendre(); });
    const su = racine.querySelector('[data-fav-suite]'); if (su) su.addEventListener('click', () => { vusFl += PAGE_FL; rendre(); });
    const reg = racine.querySelector('[data-fav6-reglages]'); if (reg) reg.addEventListener('click', () => { favFeuille = 'reglages'; raEtat = null; if (!listes || !listes.automatisations) chargerListes(true); fpOuvrir(apercuFav); rendre(); });
    if (favFeuille === 'reglages') brancherFp(apercuFav);   // 5.417
    racine.querySelectorAll('[data-fav6-un]').forEach((bt) => bt.addEventListener('click', (ev) => { ev.stopPropagation(); const id = bt.getAttribute('data-fav6-un'); selFav = new Set([id]); garderSelection(uid); if (favRefus) favRefus.ids.delete(id); favErreur = ''; vueFav = 'recap'; favFeuille = 'confirmer'; envInit(apercuFav); favEnv.etape = 4; if (!listes || !listes.automatisations) chargerListes(true); rendre(); envDemander(apercuFav, true); }));   // 5.455.8 : directement « Envoyer » (récapitulatif : offre, message, rythme ; « Retour » pour changer)
    const env = racine.querySelector('[data-fav-envoyer]'); if (env) env.addEventListener('click', () => { const p = piedFl(apercuFav); if (!p.k || p.attente) return; favRefus = null; favErreur = ''; vueFav = 'recap'; favFeuille = 'confirmer'; envInit(apercuFav); favEnv.etape = 4; if (!listes || !listes.automatisations) chargerListes(true); rendre(); envDemander(apercuFav, true); });
    if (favFeuille === 'confirmer') brancherEnv(apercuFav);   // 5.419
    { const sb = racine.querySelector('[data-fav6-stats]'); if (sb) sb.addEventListener('click', () => { favFeuille = 'stats'; lireStatsFav(true); rendre(); }); }
    carte.querySelectorAll('[data-fav-st-jours]').forEach((b) => b.addEventListener('click', () => { favStJours = Number(b.getAttribute('data-fav-st-jours')); lireStatsFav(true); rendre(); }));
    { const am = racine.querySelector('[data-fav-auto-modifier]'); if (am) am.addEventListener('click', () => ouvrirAutoEtapes(apercuFav)); }   // 5.420
    // 5.455.8 : l'agent — l'interrupteur (allumer demande SON « Allumer »), Pause / Reprendre, Arrêter.
    { const envAuto = (actif) => { if (agEnVol) return; agEnVol = true; rendre(); try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'favorisAuto', actif, ...(actif ? { confirme: true } : {}) }, (x) => { void chrome.runtime.lastError; agEnVol = false; agConfirme = false; favErreur = x && x.ok ? '' : ((x && x.raison) || TU('ra_ko')); chargerListes(true); rafraichir(); }); } catch (_) { agEnVol = false; rendre(); } };
      const sw = racine.querySelector('[data-ag-switch]'); if (sw) sw.addEventListener('click', () => { if (sw.getAttribute('data-ag-switch') === 'on') envAuto(false); else { agConfirme = true; rendre(); } });
      const oui = racine.querySelector('[data-ag-oui]'); if (oui) oui.addEventListener('click', () => envAuto(true));
      const non = racine.querySelector('[data-ag-non]'); if (non) non.addEventListener('click', () => { agConfirme = false; rendre(); });
      const ar = racine.querySelector('[data-ag-arreter]'); if (ar) ar.addEventListener('click', () => envAuto(false));
      const geste = (quoi) => { try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'agentFavoris', quoi }, () => { void chrome.runtime.lastError; rafraichir(); }); } catch (_) {} };
      const pa = racine.querySelector('[data-ag-pause]'); if (pa) pa.addEventListener('click', () => geste('pause'));
      const re = racine.querySelector('[data-ag-reprendre]'); if (re) re.addEventListener('click', () => geste('reprendre')); }
    const fermer = () => { favFeuille = null; vueFav = null; favEnv = null; rendre(); };
    const fileGeste = (quoi) => { if (favOccupe) return; favOccupe = true; favErreur = ''; rendre();
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'favorisCarte', quoi, uid }, (r) => { void chrome.runtime.lastError; favOccupe = false; if (!r || !r.ok) favErreur = (r && r.raison) || TU('ra_ko'); apercuFavAt = 0; rafraichir(); }); } catch (_) { favOccupe = false; rendre(); } };   // 5.455.8 : la liste reste, relue sur place
    racine.querySelectorAll('[data-fav6-trancher]').forEach((b) => b.addEventListener('click', (ev) => {
      ev.stopPropagation(); if (favOccupe) return;
      const parti = b.getAttribute('data-fav6-trancher') === 'parti', notificationId = b.getAttribute('data-id') || '';
      favOccupe = true; favErreur = ''; rendre();
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'favorisCarte', quoi: 'trancher', uid, notificationId, parti }, (r) => { void chrome.runtime.lastError; favOccupe = false; favRefus = null; if (!r || !r.ok) favErreur = (r && r.raison) || TU('ra_ko'); apercuFavAt = 0; rafraichir(); }); } catch (_) { favOccupe = false; rendre(); }
    }));
    const cont = racine.querySelector('[data-fav6-continuer]'); if (cont) cont.addEventListener('click', () => fileGeste('continuer'));
    const ann = racine.querySelector('[data-fav6-annuler]'); if (ann) ann.addEventListener('click', () => fileGeste('arreter'));
    carte.querySelectorAll('[data-fav6-fermer]').forEach((b) => b.addEventListener('click', fermer));
    const voile = carte.querySelector('[data-fav6-voile]'); if (voile) voile.addEventListener('click', (ev) => { if (ev.target === voile) fermer(); });
    const ret = carte.querySelector('.fav6-feuille [data-fav-retour]'); if (ret) ret.addEventListener('click', (ev) => { ev.stopImmediatePropagation(); fermer(); }, true);
    const dsous = carte.querySelector('.fav6-feuille [data-fav-decocher-sous]');
    if (dsous) dsous.addEventListener('click', () => { const m = apercuFav.message || {}; for (const x of envoiFl(apercuFav).envoi) if (m.offre && x.offre != null && x.mini != null && Number(x.offre) < Number(x.mini)) selFav.delete(x.id); garderSelection(uid); if (!envoiFl(apercuFav).envoi.length) fermer(); else rendre(); });
  }
  // Le choix, PAR COMPTE, dans chrome.storage.local (survit à un rechargement de la page).
  function garderSelection(uid) {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      try {
        chrome.storage.local.get(SEL_CLE, (g) => {
          try { void chrome.runtime.lastError; } catch (_) {}
          const m = (g && g[SEL_CLE] && typeof g[SEL_CLE] === 'object') ? g[SEL_CLE] : {};
          m[String(uid)] = { ids: [...selFav].slice(0, 1000), at: Date.now() };
          for (const k of Object.keys(m)) if (!/^[1-9]\d{0,19}$/.test(k) || Date.now() - Number(m[k] && m[k].at || 0) > 30 * 86400000) delete m[k];
          try { chrome.storage.local.set({ [SEL_CLE]: m }); } catch (_) {}
        });
      } catch (_) {}
    }, 150);
  }
  function lireSelection(uid, fin) {
    try { chrome.storage.local.get([SEL_CLE, LOT_CLE], (g) => { try { void chrome.runtime.lastError; } catch (_) {} const v = g && g[SEL_CLE] && g[SEL_CLE][String(uid)]; const l = g && g[LOT_CLE] && g[LOT_CLE][String(uid)]; lotFav = l && Number(l.at) > Date.now() - 3600000 ? l : null; fin(v && Array.isArray(v.ids) ? v.ids.map(String) : null); }); } catch (_) { fin(null); }
  }
  function majPiedFl() {
    const a = apercuFav; if (!avecListe(a)) return;
    const p = piedFl(a);
    const c = carte.querySelector('[data-fav-coches]'); if (c) { c.textContent = p.compte; c.setAttribute('data-fav-coches', String(p.n)); }
    const b = carte.querySelector('[data-fav-envoyer]'); if (b) { b.textContent = p.bouton; b.disabled = !p.k || !!p.attente; }
    const no = carte.querySelector('[data-fav-note]'); if (no) { no.textContent = p.note; no.hidden = !p.note; }
  }

  // L'aperçu est demandé à VRM (jamais à Vinted : aucune action, aucune lecture Vinted),
  // gardé une minute ; une erreur se redemande au plus une fois par minute (ou « Réessayer »).
  function chargerFavoris(e, force) {
    // Seulement carte OUVERTE (un redessin de la carte fermée ne demande rien à VRM).
    if (LISTES || favEnVol || !vivant() || !carte.classList.contains('on')) return;
    const uid = e && e.site && e.site.id ? String(e.site.id) : '';
    if (uid && e.plateforme === 'vinted' && fileFavActive(e) && grand6()) lireDernier(uid);   // 5.410.7 : la liste du lancement
    if (!uid || e.plateforme !== 'vinted' || fileFavActive(e)) return;
    if (!force && Date.now() - apercuFavAt < 60000 && (apercuFav || favLectureKo)) return;
    favEnVol = true;
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'favorisCarte', quoi: 'apercu', uid }, (r) => {
        void chrome.runtime.lastError;
        favEnVol = false; apercuFavAt = Date.now();
        if (r && r.ok && r.apercu && avecListe(r.apercu)) {
          // 5.407 : le choix gardé pour CE compte, réduit aux favoris encore cochables ; sinon les plus récents (au plus `max`).
          const a = r.apercu, ok = new Set(favCochables(a).map((x) => x.id));
          lireSelection(uid, (gardes) => {
            apercuFav = a; favLectureKo = '';
            const ids = favTous(a).map((x) => x.id + ':' + (x.cochable ? 1 : 0)).join(',');
            if (ids !== selFavIds || !gardes) { selFavIds = ids; selFav = new Set((gardes || (grand6() ? [] : Array.isArray(a.selection) ? a.selection : [])).filter((id) => ok.has(id)).slice(0, gardes ? 1000 : favMax(a))); }   // 5.410.8 : le tableau part SANS case cochée d'office
            if (vueFav === 'recap' && !favCochables(a).some((x) => selFav.has(x.id))) vueFav = null;
            if (carte.classList.contains('on')) rendre();
          });
          return;
        }
        if (r && r.ok && r.apercu) {
          apercuFav = r.apercu; favLectureKo = '';
          const ids = listeFavTriee(r.apercu).map((x) => x.id).join(',');
          if (ids !== selFavIds) { selFavIds = ids; selFav = new Set(Array.isArray(r.apercu.selection) ? r.apercu.selection : (r.apercu.liste || []).map((x) => x.id)); }
        } else if (!avecListe(apercuFav)) { apercuFav = null; favLectureKo = (r && r.raison) || 'l’extension n’a pas répondu.'; }   // 5.455.8 : une liste déjà là reste montrée
        if (carte.classList.contains('on')) rendre();
      });
    } catch (_) { favEnVol = false; }
  }
  // 5.440.2 (Julien : « c'est à l'extension d'aller capter les favoris et d'actualiser l'écran, pas à moi ») : dès que le
  //    fond a lu la liste des notifications de Vinted (`vrmFavorisListeLue`), la liste des favoris de la carte ouverte est
  //    redemandée à VRM et redessinée — sans attendre la minute de l'aperçu, sans aucun geste.
  try { chrome.storage.onChanged.addListener((ch, zone) => { if (zone !== 'local' || !ch.vrmFavorisListeLue) return; apercuFavAt = 0; if (!LISTES && vivant() && carte.classList.contains('on')) rendre(); }); } catch (_) {}
  function brancherFavoris(e) {
    const uid = e && e.site && e.site.id ? String(e.site.id) : '';
    const demander = (quoi, extra, fin) => {
      try { chrome.runtime.sendMessage(Object.assign({ from: 'vrm-badge', action: 'favorisCarte', quoi, uid }, extra || {}), (r) => { void chrome.runtime.lastError; fin(r || null); }); } catch (_) { fin(null); }
    };
    const relire = carte.querySelector('[data-fav-relire]');
    if (relire) relire.addEventListener('click', () => { favErreur = ''; favLectureKo = ''; apercuFav = null; rendre(); chargerFavoris(e, true); });
    const aideB = carte.querySelector('[data-fav-aide]');
    if (aideB) aideB.addEventListener('click', () => { aideFav = !aideFav; rendre(); });
    carte.querySelectorAll('[data-fav-rythme-b]').forEach((b) => b.addEventListener('click', () => { rythmeFav = b.getAttribute('data-fav-rythme-b'); rendre(); }));
    if (grand6()) brancherFavoris6(e);
    const lancer = carte.querySelector('[data-fav-lancer]');
    if (lancer) lancer.addEventListener('click', () => {
      const a = apercuFav;
      if (!a || a.etat !== 'pret' || favOccupe) return;
      // SON clic : ce qu'IL a coché dans la liste montrée (du plus récent au plus ancien), `confirme` posé ici seulement.
      // 5.407 : avec la liste, seulement depuis le RÉCAPITULATIF (« Confirmer l'envoi »), et
      // seulement les favoris COCHABLES qu'il a cochés (jamais un favori déjà contacté).
      const src = avecListe(a) ? (vueFav === 'recap' && !piedFl(a).attente ? envoiFl(a).envoi : []) : listeFavTriee(a);
      const selection = src.map((x) => x.id).filter((id) => selFav.has(id));
      if (!selection.length) return;
      favOccupe = true; favErreur = ''; favRefus = null; rendre();
      // 5.406 : la photo et le titre de chaque favori choisi (ce que l'aperçu montre), pour l'écran « action en cours ».
      const items = src.filter((x) => selFav.has(x.id)).map((x) => ({ itemId: String(x.itemId || ''), notificationId: String(x.id || ''), photo: x.photo || '', titre: x.titre || '' }));   // 5.440 : l'état de CHAQUE ligne sur la fenêtre de vinted.fr
      // 5.419 : le taux qu'il a choisi dans la feuille (gardé pour ce compte), le message modifié POUR CET ENVOI.
      const env9 = grand6() && favEnv ? Object.assign({}, favEnv.taux != null && favEnv.taux !== favEnv.taux0 ? { taux: favEnv.taux, arrondi: favEnv.arrondi } : {}, favEnv.texte != null && favEnv.texte.trim() ? { texte: favEnv.texte.trim() } : {}, favEnv.relire ? { relire: true } : {}) : {};
      demander('lancer', { selection, reglages: a.reglages, confirme: true, items, ...env9, ...(rythmeDe(a.message) === 'perso' ? {} : { rythme: rythmeDe(a.message) }) }, (r) => {
        favOccupe = false;
        if (r && r.ok) {
          if (grand6()) { garderDernier(uid, a); favFeuille = null; favEnv = null; }
          // 5.455.8 : la liste RESTE affichée pendant l'envoi (chaque rangée passe « En attente » → « Envoi en cours » → « Message envoyé ») ;
          //    elle est relue dès la fin de la file. Les favoris écartés au lancement (vendus, déjà contactés) le disent sur LEUR rangée.
          const suite = () => { vueFav = null; apercuFavAt = 0; if (r && Array.isArray(r.ecartes) && r.ecartes.length) favRefus = { ids: new Set(r.ecartes.map(String)), raison: TU('f6_r_plus_a_contacter') }; rafraichir(); };
          if (!avecListe(a)) return suite();
          // Les envoyés quittent le choix ; les AUTRES restent cochés pour l'heure suivante, et l'heure du lot est gardée
          // (rangés AVANT de relire la liste : la relecture lit ce choix-là).
          for (const id of selection) selFav.delete(id);
          lotFav = { at: Date.now(), n: selection.length };
          clearTimeout(selTimer);
          try {
            chrome.storage.local.get([SEL_CLE, LOT_CLE], (g) => {
              try { void chrome.runtime.lastError; } catch (_) {}
              const ms = (g && g[SEL_CLE]) || {}, ml = (g && g[LOT_CLE]) || {};
              ms[uid] = { ids: [...selFav].slice(0, 1000), at: Date.now() }; ml[uid] = lotFav;
              try { chrome.storage.local.set({ [SEL_CLE]: ms, [LOT_CLE]: ml }, () => { try { void chrome.runtime.lastError; } catch (_) {} suite(); }); } catch (_) { suite(); }
            });
          } catch (_) { suite(); }
          return;
        }
        favErreur = (r && r.raison) || 'Rien n’est parti : l’extension n’a pas répondu.';
        // 5.453.2 : un envoi À VÉRIFIER retient la file : la phrase dit le geste (sur SA ligne), la sélection n'est pas « pas partie ».
        if (r && /incertain/i.test(String(r.raison || ''))) { favErreur = TU('f6_incertain_geste'); favFeuille = null; vueFav = null; apercuFavAt = 0; rafraichir(); return; }   // 5.455.8 : la liste reste
        // 5.410.7 : le refus se dit SUR les rangées concernées (celles que le fond nomme, sinon le lot choisi), la feuille se ferme.
        if (grand6()) { favRefus = { ids: new Set((r && Array.isArray(r.ids) && r.ids.length ? r.ids : selection).map(String)), raison: favErreur }; for (const id of favRefus.ids) selFav.delete(id); garderSelection(uid); favFeuille = null; vueFav = null; if (r && r.code === 'selection') { apercuFavAt = 0; } }
        rendre();
      });
    });
    if (avecListe(apercuFav) && !grand6()) {
      // 5.407 : cocher ne redessine RIEN (300 rangées, défilement gardé) : le compteur et le bouton suivent sur place.
      const liste = carte.querySelector('.fl-liste');
      if (liste) {
        // La case et SON état (aucun évènement fabriqué : la rangée touchée bascule la case et le compte directement).
        const suivre = (el) => { const id = el.getAttribute('data-fav-coche'); if (el.checked) selFav.add(id); else selFav.delete(id); majPiedFl(); garderSelection(uid); };
        liste.addEventListener('change', (ev) => { const el = ev.target; if (!el || !el.matches || !el.matches('[data-fav-coche]') || el.disabled) return; suivre(el); });
        liste.addEventListener('click', (ev) => { const li = ev.target && ev.target.closest ? ev.target.closest('li.fl-l') : null; if (!li || (ev.target.closest && ev.target.closest('label.fl-case'))) return; const c = li.querySelector('[data-fav-coche]'); if (c && !c.disabled) { c.checked = !c.checked; suivre(c); } });
      }
      carte.querySelectorAll('[data-fav-tout]').forEach((b) => b.addEventListener('click', () => {
        if (b.getAttribute('data-fav-tout') === 'aucun') selFav = new Set();
        else { for (const x of favCochables(apercuFav).filter(visibleFl)) selFav.add(x.id); }
        carte.querySelectorAll('.fl-liste [data-fav-coche]').forEach((c) => { c.checked = selFav.has(c.getAttribute('data-fav-coche')); });
        majPiedFl(); garderSelection(uid);
      }));
      const fa = carte.querySelector('[data-fav-annonce]');
      if (fa) fa.addEventListener('change', () => { filtreAnnonce = String(fa.value || ''); vusFl = PAGE_FL; rendre(); });
      const fn = carte.querySelector('[data-fav-nouveaux]');
      if (fn) fn.addEventListener('click', () => { filtreNouveaux = !filtreNouveaux; vusFl = PAGE_FL; rendre(); });
      const env = carte.querySelector('[data-fav-envoyer]');
      const suiteB = carte.querySelector('[data-fav-suite]');
      if (suiteB) suiteB.addEventListener('click', () => { vusFl += PAGE_FL; rendre(); });
      if (env) env.addEventListener('click', () => { const p = piedFl(apercuFav); if (!p.k || p.attente) return; vueFav = 'recap'; favErreur = ''; rendre(); const rc = carte.querySelector('.fl-recap'); if (rc) { try { carte.scrollTop = Math.max(0, rc.getBoundingClientRect().top - carte.getBoundingClientRect().top + carte.scrollTop - 8); } catch (_) {} } });
      const dsous = carte.querySelector('[data-fav-decocher-sous]');
      if (dsous) dsous.addEventListener('click', () => { const m = apercuFav.message || {}; for (const x of envoiFl(apercuFav).envoi) if (m.offre && x.offre != null && x.mini != null && Number(x.offre) < Number(x.mini)) selFav.delete(x.id); garderSelection(uid); if (!envoiFl(apercuFav).envoi.length) vueFav = null; rendre(); });
      const ret = carte.querySelector('[data-fav-retour]');
      if (ret) ret.addEventListener('click', () => { vueFav = null; favErreur = ''; rendre(); });
    } else if (!grand6()) carte.querySelectorAll('[data-fav-coche]').forEach((el) => el.addEventListener('change', () => { const id = el.getAttribute('data-fav-coche'); if (el.checked) selFav.add(id); else selFav.delete(id); rendre(); }));
    carte.querySelectorAll('li.coche-l').forEach((li) => li.addEventListener('click', (ev) => { if (ev.target && ev.target.matches && ev.target.matches('input')) return; const c = li.querySelector('[data-fav-coche]'); if (c) { c.checked = !c.checked; c.dispatchEvent(new Event('change')); } }));
    const tout = avecListe(apercuFav) || grand6() ? null : carte.querySelector('[data-fav-tout]');
    if (tout) tout.addEventListener('click', () => { selFav = tout.getAttribute('data-fav-tout') === 'tous' ? new Set(listeFavTriee(apercuFav).map((x) => x.id)) : new Set(); rendre(); });
    const repr = carte.querySelector('[data-fav-reprendre]');
    if (repr) repr.addEventListener('click', () => {
      repr.disabled = true;
      let capte = false; try { capte = !!vrmVerifVisible('iframe[src*="captcha-delivery"], iframe[src*="datadome"], #datadome-captcha, iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare"]'); } catch (_) {}
      demander('reprendre', { captcha: capte }, (r) => { favErreur = r && r.ok ? '' : ((r && r.raison) || 'Rien n’a repris : l’extension n’a pas répondu.'); rafraichir(); });
    });
    const arreter = carte.querySelector('[data-fav-arreter]');
    if (arreter) arreter.addEventListener('click', () => { arreter.disabled = true; arreter.textContent = 'Arrêt…'; demander('arreter', null, () => rafraichir()); });
    const okB = carte.querySelector('[data-fav-ok]');
    if (okB) okB.addEventListener('click', () => demander('oublier', null, () => { apercuFav = null; apercuFavAt = 0; rafraichir(); }));
    // « prochain dans … » suit l'horloge tant que la carte est ouverte (aucune requête).
    horlogeFav();
  }

  // ══ 5.377 — FAVORIS · ANNONCES · VENTES, LE COMPTE DE L'ONGLET D'ABORD ══════════
  // Julien : « que l'on puisse voir les favoris du plus récent au plus vieux pour
  // envoyer des messages aux favoris, voir les annonces et ventes à chaque fois sur le
  // compte connecté ; les autres comptes sont floutés sauf si la personne met tous les
  // comptes sélectionnés, mais aucune action n'est possible dessus ».
  //   · trois onglets (touches, l'actif enfoncé + diode) : Favoris · Annonces · Ventes ;
  //   · « Ce compte · Tous les comptes » : par défaut le compte de l'onglet seul ; « Tous »
  //     ajoute les autres comptes FLOUTÉS, `inert`, détails `aria-hidden`, sans aucune
  //     commande (« Connecte-toi à ce compte pour agir ») — le fond refuse de toute façon
  //     toute commande pour un autre compte que celui de l'onglet ;
  //   · une rangée n'a pas de bouton : une annonce s'ouvre en la touchant (sa page sur le
  //     site), une vente est une ligne ; les liens du site restent ceux de la carte.
  // Tout vient du service worker (`carteListes`, lecture seule) ; pas su ⇒ « — », dit.
  // 5.409 (Julien, 19 nov. : « Fais un onglet Messages (très important), Mes annonces / mon dressing, Favoris, et
  // Ventes […] Tu peux faire des Paramètres dans l'extension ») : cinq onglets ; « Messages » d'abord.
  const ONGLETS5 = ['accueil', 'messages', 'annonces', 'favoris', 'ventes', 'notifications', 'automatisations', 'sante', 'parametres'];
  let ficheOuverte = '';   // 'a:{id}' (une annonce) ou 'v:{tx}' (une vente) dépliée — une à la fois
  let menuCompteOuvert = false, ongletListe = 'accueil', porteeTous = false, listes = null, listesAt = 0, listesEnVol = false, listesErreur = '';
  try { chrome.storage.local.get(['vrmCarteOnglet', 'vrmCartePortee'], (g) => { try { void chrome.runtime.lastError; } catch (_) {} g = g || {}; if (ONGLETS5.includes(g.vrmCarteOnglet) && !hote.hasAttribute('data-lien-panneau')) ongletListe = g.vrmCarteOnglet; if (g.vrmCartePortee === 'tous') porteeTous = true; }); } catch (_) {}
  const eurosL = (n) => { const x = Number(n); if (!(x > 0)) return '—'; const c = Math.round(x * 100); return (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €'; };
  // 5.409 (captures « Commandes » de Vintex) : l'état en mots clairs — « Action requise : à expédier » en ambre, le reste neutre.
  const ETAT_VENTE = { a_expedier: 'Action requise : à expédier', en_route: 'En route : rien à faire', finalisee: 'Terminée', annulee: 'Annulée — pas une vente', pas_su: 'État pas encore lu' };
  let relectureEssais = 0;
  function chargerListes(force) {
    if (listesEnVol || !vivant()) return;
    if (!force && listes && Date.now() - listesAt < 60000 && (!porteeTous || Array.isArray(listes.autres))) return;
    listesEnVol = true; listesErreur = '';
    try {
      chrome.runtime.sendMessage({ from: LISTES ? 'cancale-popup' : 'vrm-badge', action: 'carteListes', tous: porteeTous }, (r) => {
        void chrome.runtime.lastError;
        listesEnVol = false;
        if (r && r.ok) { listes = r; listesAt = Date.now(); } else listesErreur = 'L’extension n’a pas répondu. Réessaie dans un instant.';
        // 5.440.4 : la feuille du prix ouverte par le lien de l'app ne garde que les annonces du compte de l'onglet (lues) ;
        //    aucune ⇒ elle se ferme (le lien d'une paire d'un autre compte n'ouvre rien). Une liste vide ne décide rien.
        if (r && r.ok && geste6 && geste6.k === 'prix' && geste6.lien && !geste6.aa) {
          const ts = (r.annonces && Array.isArray(r.annonces.toutes)) ? r.annonces.toutes : [];
          if (ts.length) { geste6.ids = geste6.ids.filter((id) => ts.some((x) => x.id === id)); if (!geste6.ids.length) { geste6 = null; geste6Etat = null; } }
        }
        // 5.410.2 : le dressing de CE compte est en relecture (budget de lecture, compte de l'onglet, une requête à la
        // fois — `retourSurVinted` du fond) ⇒ la liste est redemandée seule quand elle a eu le temps d'arriver (3 fois au
        // plus) : ses annonces redeviennent « En vente » sans geste.
        if (r && r.ok && r.annonces && r.annonces.relecture && !LISTES && relectureEssais < 3) { relectureEssais++; setTimeout(() => { if (carte.classList.contains('on')) chargerListes(true); }, 25000); }
        else if (r && r.ok && r.annonces && !r.annonces.relecture) relectureEssais = 0;
        if (LISTES) rendreListesSeules(); else if (carte.classList.contains('on')) rendre();
      });
    } catch (_) { listesEnVol = false; }
  }
  const vignette = (u) => (u && /^https:\/\/[\w.-]*vinted\.net\//.test(u) ? `<img class="vig" src="${esc(u)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '<span class="vig" aria-hidden="true"></span>');
  // 5.379 (capture de Julien : une case « — » au début de chaque vente) : la plaque N° ne
  // s'affiche que quand le N° est CONNU (par identité d'annonce, `carteListes`) ; une liste
  // où aucune ligne n'a de N° n'a pas de colonne N° ; une ligne sans N° dans une liste qui
  // en a garde la place vide (rien d'écrit, rien de lu à l'écran).
  const plaque = (n) => (n ? `<span class="plaque" data-num="${esc(n)}"><i>N°</i>${esc(n)}</span>` : '');
  const debutN = (avecN, n) => (avecN ? (n ? plaque(n) : '<span class="sans-n" aria-hidden="true"></span>') : '');
  const nbVentes = (n) => `${Number(n).toLocaleString('fr-FR')} ${Number(n) > 1 ? 'ventes' : 'vente'}`;
  // ══ 5.409 — ANNONCES DU GRAND PANNEAU (captures « Articles » de Vintex envoyées par Julien) : « Choisir une
  //    action ▾ » (les gestes en série PERMIS ; jamais de suppression en série, CLAUDE.md §3), recherche, filtre
  //    « Statut » à compteurs LUS (en vente, brouillon, masqué, réservé, vendu, à confirmer), liste / grille,
  //    « Colonnes ▾ » mémorisé (chrome.storage.local), cases + « tout ». Rien ne part d'ici : une action ouvre le
  //    geste gardé (VRM, ou le parcours des favoris de la carte).
  const COLS5 = ['num', 'prix', 'mini', 'achat', 'date', 'vues', 'favoris', 'place', 'statut'];
  const COLS5_DEFAUT = ['prix', 'date', 'vues', 'favoris', 'statut'];
  // 5.410 (comme Vintex) : le N° est la plaque devant le titre, plus une colonne ; les colonnes de Vintex d'abord.
  const COLS6 = ['prix', 'date', 'vues', 'favoris', 'statut', 'mini', 'achat', 'place'];
  // 5.410.2 (passe de finition) : des colonnes de LARGEUR FIXE — chaque rangée était sa propre grille, les valeurs
  // glissaient d'une ligne à l'autre et les en-têtes ne tombaient pas au-dessus de leur colonne.
  const W6 = { prix: '76px', date: '148px', vues: '60px', favoris: '72px', statut: '150px', mini: '84px', achat: '84px', place: '140px' };
  const W6V = { prix: '72px', date: '96px', transporteur: '156px', limite: '112px', statut: '108px', bordereau: '128px' };
  const STATUTS5 = ['en_vente', 'brouillon', 'masque', 'reserve', 'vendu', 'a_confirmer'];
  let annConfirme = null, annEnVol = false, annResultat = null, annActionPre = '';
  // ══ 5.410 — LES GESTES DU PANNEAU (l'app ne les fait plus) : prix, atelier Republier, publier, offres ══
  //    Chacun passe par le chemin gardé du fond ; rien n'ouvre vrm.center.
  let geste6 = null, geste6Etat = null, geste6EnVol = false, offreConf = null, offreEtat = null, offreContre = {};
  const euroTxt = (n) => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  // Le plancher montré (la règle du fond le revérifie) : le prix mini, sinon l'achat + 10 %, sinon « pas su ».
  const plancher6 = (x) => (Number(x.mini) > 0 ? { v: Number(x.mini), de: 'mini' } : Number(x.achat) > 0 ? { v: Math.ceil(Number(x.achat) * 110) / 100, de: 'achat' } : null);
  // 5.437 (`prixminipublier`) : le prix minimum demandé AVANT de publier — proposition lue au fond (lecture seule), SES
  //    réponses rangées à côté du N° (`prixMiniCarte` · `poser`) AVANT le lancement ; une écriture ratée ⇒ rien ne part.
  const PM6 = U.PRIX_MINI;
  function pmCharger6(g, arts) {
    if (!PM6 || !g || g.pmLu) return; g.pmLu = true; g.pm = g.pm || {};
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'prixMiniCarte', quoi: 'proposer', articles: arts.map((a) => ({ num: a.num, item: a.item })) }, (r) => { void chrome.runtime.lastError; if (geste6 !== g) return; g.pmProps = r && r.ok ? r.articles : null; rendre(); }); } catch (_) { g.pmProps = null; }
  }
  function pmPoser6(g, arts, suite) {
    const rep6 = PM6 ? PM6.reponses(arts, g.pmProps, g.pm || {}) : [];
    if (!rep6.length) { suite(); return; }
    envoyer6({ action: 'prixMiniCarte', quoi: 'poser', articles: rep6, confirme: true }, (r) => { if (r && r.ok) { g.pmLu = false; suite(); } else { geste6Etat = { ok: false, texte: TU('pm_ko', { r: (r && r.raison) || '' }) }; g.confirme = false; } });
  }
  const envoyer6 = (msg, fin) => { geste6EnVol = true; rendre(); try { chrome.runtime.sendMessage(Object.assign({ from: 'vrm-badge' }, msg), (r) => { void chrome.runtime.lastError; geste6EnVol = false; try { fin(r || null); } catch (_) {} rendre(); }); } catch (_) { geste6EnVol = false; fin(null); rendre(); } };
  // 5.422 (`repubprogramme`) : « Lancer maintenant » ou « Programmer à … » (SON heure, tapée) ; la phrase dite
  //    AVANT de confirmer : « Republier 6 paires ce soir à 20:00, espacées de 4 à 8 min ».
  const LOC6 = () => ({ fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', de: 'de-DE' })[(U.langue && U.langue()) || 'fr'] || 'fr-FR';
  const deux6 = (n) => String(n).padStart(2, '0');
  const valeurLocale6 = (t) => { const d = new Date(t); return `${d.getFullYear()}-${deux6(d.getMonth() + 1)}-${deux6(d.getDate())}T${deux6(d.getHours())}:${deux6(d.getMinutes())}`; };
  function atDefaut6() { const t = Date.now() + 60 * 60000; return valeurLocale6(Math.ceil(t / 300000) * 300000); }
  const atDe6 = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(v || '')); if (!m) return null; const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).getTime(); return Number.isFinite(t) ? t : null; };
  function quandProg6(t) {
    const d = new Date(t), n = new Date();
    const j = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
    const h = d.toLocaleTimeString(LOC6(), { hour: '2-digit', minute: '2-digit' });
    if (j === 0) return TU(d.getHours() >= 18 ? 'g6_q_soir' : 'g6_q_auj', { h });
    if (j === 1) return TU('g6_q_demain', { h });
    return TU('g6_q_le', { j: d.toLocaleDateString(LOC6(), { weekday: 'short', day: 'numeric', month: 'short' }), h });
  }
  const pairesTxt6 = (n) => TU(n === 1 ? 'g6_paire' : 'g6_paires', { n });
  const espaceTxt6 = (e) => (e.mode === 'aleatoire' && e.max > e.min ? TU('g6_prog_esp', { a: e.min, b: e.max }) : TU('g6_prog_esp_fixe', { a: e.min }));
  function phraseProg6(n, t, e) { return n === 1 ? TU('g6_prog_conf_un', { p: pairesTxt6(n), quand: quandProg6(t) }) : TU('g6_prog_conf', { p: pairesTxt6(n), quand: quandProg6(t), e: espaceTxt6(e) }); }
  const PROG_AVANCE_MIN = 2 * 60000, PROG_AVANCE_MAX = 7 * 86400000;
  // 5.423 : les lignes de la feuille Avant | Après — ce que le panneau a LU (dressing rangé, contrôle avant départ) et ce que
  //    SON geste posera (son nouveau prix, « maintenant », « masquée »). Une valeur absente reste absente (« — »).
  const prixSaisi6 = (v) => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };
  const deAnn6 = (id) => (((listes && listes.annonces && listes.annonces.toutes) || []).find((y) => y.id === id) || { id });
  const avantAnn6 = (x) => ({ prix: Number(x.prix) > 0 ? Number(x.prix) : null, statut: x.statut || null, depuis: Number(x.depuis) > 0 ? Number(x.depuis) : null });
  // 5.432 (`prixpartout`) : les AUTRES sites de chaque annonce (lus par le fond, par identité), le choix « sur tous les
  //    sites » (coché d'office s'il y en a), « même prix partout » ou « +N % sur Leboncoin / Vestiaire ».
  const NOM_SITE6 = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire', ebay: 'eBay' };
  const ppAutres6 = (id) => { const p = geste6 && geste6.pp && geste6.pp.par ? geste6.pp.par[id] : null; return p && p.lu ? (p.autres || []) : []; };
  const ppAgissables6 = (id) => ppAutres6(id).filter((a) => a.mode === 'ext' && Number(a.prix) > 0);
  const ppTous6 = () => !!(geste6 && geste6.pp && geste6.pp.par && (geste6.tous == null ? geste6.ids.some((id) => ppAgissables6(id).length) : geste6.tous));
  const ppPrix6 = (site, p) => { if (!(p > 0)) return null; if (geste6.ajuste === 'plus' && (site === 'leboncoin' || site === 'vestiaire')) return Math.round(p * (100 + (Number(geste6.plusN) || 0))) / 100; return p; };
  function ppCharger6(g) {
    g.pp = { charge: true };
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'prixPartoutSites', ids: g.ids.slice() }, (r) => { void chrome.runtime.lastError; if (geste6 !== g) return; g.pp = r && r.ok ? { par: r.par || {} } : { raison: (r && r.raison) || TU('pp_pas_su') }; if (r && r.ok && g.plusN == null) g.plusN = Number(r.plusPct) || 10; rendre(); }); } catch (_) { g.pp = { raison: TU('pp_pas_su') }; }
  }
  function lignesPrix6() {
    const L = [];
    for (const id of geste6.ids) {
      const x = deAnn6(id); const p = prixSaisi6(geste6.prix[id]);
      if (!p) continue;
      const ici = /leboncoin\.fr$/i.test(location.hostname) ? 'leboncoin' : /vestiairecollective\.com$/i.test(location.hostname) ? 'vestiaire' : 'vinted';
      L.push({ id, ...(ppTous6() && ppAgissables6(id).length ? { site: ici } : {}), sorte: 'baisse', titre: x.titre || '', photo: x.photo || '', num: x.num || '', avant: avantAnn6(x), apres: { prix: p } });
      if (ppTous6()) for (const a of ppAgissables6(id)) L.push({ id: a.id, site: a.site, source: id, sorte: 'baisse', titre: a.titre || x.titre || '', photo: a.photo || x.photo || '', num: x.num || '', avant: { prix: Number(a.prix) }, apres: { prix: ppPrix6(a.site, p) } });
    }
    return L;
  }
  // La confirmation de la garde : le chiffre EN GRAND, « au lieu de … », les raisons, « Oui, 4,50 € » / « Corriger ».
  function gardeConfHtml6(liste) {
    return `<div class="conf5 garde6" role="alertdialog" data-garde-confirme="${liste.length}"><h3>${esc(TU('gp_titre'))}</h3>${liste.map((c) => {
      const r = [];
      if ((c.raisons || []).includes('frappe')) r.push(TU('gp_r_frappe'));
      if ((c.raisons || []).includes('chute')) r.push(TU('gp_r_chute', { pct: c.chutePct, seuil: c.seuil }));
      if ((c.raisons || []).includes('plancher')) r.push(TU(c.plancherDe === 'mini' ? 'gp_r_plancher_mini' : 'gp_r_plancher_achat', { p: euroTxt((c.plancherC || 0) / 100) }));
      return `<div class="garde6-l" data-garde-ligne="${esc(c.site + ':' + c.id)}"><p class="garde6-q"><b class="garde6-chiffre" data-garde-prix="${c.prixC}">${esc(euroTxt(c.prixC / 100))}</b> <span>${esc(TU('gp_au_lieu', { avant: euroTxt(c.actuelC / 100) }))}</span> <small>${esc(NOM_SITE6[c.site] || '')}${c.num ? ' · N°' + esc(c.num) : ''}</small></p><ul>${r.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
    }).join('')}<div class="outils"><button type="button" class="vu-btn vu-plein" data-garde-oui>${esc(TU('gp_oui', { p: liste.length === 1 ? euroTxt(liste[0].prixC / 100) : liste.map((c) => euroTxt(c.prixC / 100)).join(', ') }))}</button><button type="button" class="vu-btn" data-garde-non>${esc(TU('gp_corriger'))}</button></div></div>`;
  }
  // Les autres sites d'une annonce, sous sa saisie : « Leboncoin · 45 € → 49,50 € », ce qui est DIT (Vestiaire, eBay).
  function ppSousLigne6(id) {
    const g = geste6;
    if (!g.pp || g.pp.charge) return `<small class="pp6" data-pp="charge">${esc(TU('pp_lecture'))}</small>`;
    if (!g.pp.par) return `<small class="pp6" data-pp="pas-su">${esc(g.pp.raison || TU('pp_pas_su'))}</small>`;
    const P = g.pp.par[id];
    if (!P || !P.lu) return `<small class="pp6" data-pp="pas-su">${esc(TU('pp_pas_su'))}</small>`;
    const autres = P.autres || [];
    if (!autres.length) return `<small class="pp6" data-pp="0">${esc(TU('pp_aucun'))}</small>`;
    const p = prixSaisi6(g.prix[id]);
    return `<ul class="pp6" data-pp="${autres.length}">${autres.map((a) => `<li data-pp-site="${esc(a.site)}" data-pp-id="${esc(a.id)}" data-pp-mode="${esc(a.mode)}"><span>${esc(NOM_SITE6[a.site] || a.site)}</span><span>${a.mode === 'dit' ? esc(TU('pp_dit_vc_court')) : `${esc(Number(a.prix) > 0 ? euroTxt(a.prix) : '—')}${p && ppTous6() ? ' → <b>' + esc(euroTxt(ppPrix6(a.site, p))) + '</b>' : ''}${a.autreCompte ? ' · ' + esc(TU('pp_dit_compte')) : ''}`}</span></li>`).join('')}</ul>`;
  }
  function lignesAtelier6() {
    const g = geste6, V = (g.verif && g.verif.paires) || {};
    return g.ids.filter((id) => !(V[id] && V[id].etat === 'absente')).map((id) => { const x = deAnn6(id), v = V[id] || null; const pl = plancher6(x);
      const pc = v && Number(v.prixCoffre) > 0 ? Number(v.prixCoffre) : null;
      return { id, sorte: 'republier', titre: x.titre || '', photo: x.photo || '', num: x.num || '', avant: avantAnn6(x), apres: { prix: pc ? (pl && pc < pl.v ? pl.v : pc) : null, statut: 'en_vente', depuis: 'maintenant' }, champs: v && Array.isArray(v.champs) ? v.champs : null }; });
  }
  function lignesMasquer6(c) {
    return c.ids.map((id) => { const x = deAnn6(id); return { id, sorte: c.k, titre: x.titre || '', photo: x.photo || '', num: x.num || '', avant: avantAnn6(x), apres: { statut: c.k === 'masquer' ? 'masque' : 'en_vente' } }; });
  }
  // 5.429 (Julien, 21 nov. : « la republication à la main, je veux aussi qu'il y ait ») — UN geste DIRECT : sur une annonce
  //    (la fiche « ⋯ ») ou la sélection, « Republier » ouvre TOUT DE SUITE la feuille Avant | Après de CETTE paire (le contrôle
  //    avant départ lancé en même temps), puis « Republier maintenant » (SON 2e toucher) lance le MÊME chemin que l'atelier
  //    (`atelierLancer` : contrôle, ordre coffre → brouillon relu → suppression → mise en ligne, onglet de travail, plafonds,
  //    jamais deux en ligne). Espacement par défaut (au hasard 2 à 6 min) ; « Retour » montre les réglages de l'atelier.
  function republierDirect6(ids) {
    const l = [...new Set((ids || []).map(String).filter((x) => /^\d{4,15}$/.test(x)))].slice(0, 50);
    if (!l.length) return;
    geste6 = { k: 'atelier', ids: l, mode: 'aleatoire', min: 2, max: 6, photo: { rot: 0, bright: 1, contrast: 1, sat: 1, zoom: 1 }, lettre: false, verif: null, verifEnCours: false, quand: 'maintenant', at: atDefaut6(), progConf: false, aa: true, direct: true };
    geste6Etat = null; rendre(); atelierVerifier6(null, null);
  }
  // ══ 5.424 — « PUBLIER AUSSI SUR… » : la feuille avant / après (champ par champ, ✓ ou « à choisir »), puis la frise ══
  //    Tout vient du FOND (`publierAussiApercu` : la règle de l'app recopiée) ; rien ne part tant qu'un champ est à
  //    choisir ; SON toucher « Publier sur N sites », puis SA confirmation ; pendant : chaque étape datée sur sa preuve.
  const SITES_AUSSI6 = ['leboncoin', 'vestiaire'];
  const NOM_AUSSI6 = { leboncoin: 'Leboncoin', vestiaire: 'Vestiaire' };
  const ETAPES_AUSSI6 = ['verifie', 'onglet', 'compte', 'photos', 'champs', 'relu', 'publie', 'retenue'];
  const cleRepAussi = (q) => (q.site ? q.site + '|' : '') + q.champ;
  function ouvrirAussi6(ids) {
    geste6 = { k: 'aussi', ids: ids.slice(0, 10), sites: SITES_AUSSI6.slice(), pct: { leboncoin: 0, vestiaire: 0 }, reponses: {}, ap: null, charge: true, confirme: false, jobId: '', job: null };
    geste6Etat = null; rendre(); aussiCharger6();
  }
  function aussiCharger6() {
    const g = geste6; if (!g || g.k !== 'aussi') return;
    g.charge = true; g.confirme = false;
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'publierAussiApercu', ids: g.ids, sites: g.sites, pct: g.pct, reponses: g.reponses }, (r) => { void chrome.runtime.lastError; if (geste6 !== g) return; g.charge = false; g.ap = r && r.ok ? r : null; geste6Etat = r && !r.ok ? { ok: false, texte: r.raison || TU('ra_ko') } : null; rendre(); }); } catch (_) { g.charge = false; rendre(); }
  }
  let aussiMinuterie = 0;
  function aussiSuivre6() {
    clearInterval(aussiMinuterie);
    aussiMinuterie = setInterval(() => {
      const g = geste6; if (!g || g.k !== 'aussi' || !g.jobId) { clearInterval(aussiMinuterie); return; }
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'publierAussiEtat', jobId: g.jobId }, (r) => { void chrome.runtime.lastError; if (geste6 !== g || !r || !r.ok) return; g.job = r.job; if (r.job && r.job.etat === 'fini') clearInterval(aussiMinuterie); rendre(); }); } catch (_) {}
    }, 1500);
  }
  function aussiLigne6(art, site, l) {
    const champ = esc(TU('pa_c_' + l.champ));
    const vinted = l.champ === 'prix' ? (l.vinted ? euroTxt(Number(l.vinted)) : '—') : l.champ === 'photos' ? esc(l.vinted || '0') : esc(l.vinted || '—');
    let apres;
    if (l.etat === 'ok') {
      const corps = l.champ === 'description' && l.ref && String(l.site).endsWith(l.ref) ? String(l.site).slice(0, -l.ref.length).trim() : String(l.site);
      const v = l.champ === 'prix' ? euroTxt(Number(l.site)) : l.champ === 'description' ? esc(corps.slice(0, 160)) + (corps.length > 160 ? '…' : '') : esc(l.site);
      const note = l.champ === 'description' && l.ref ? `<small>${esc(TU('pa_ref', { ref: l.ref }))}</small>` : l.coupe ? `<small>${esc(TU('pa_coupe'))}</small>` : l.champ === 'prix' && art.sites[site].prix && art.sites[site].prix.arrondi ? `<small>${esc(TU('pa_arrondi'))}</small>` : '';
      apres = `<span class="au6-ok" data-aussi-ok>✓</span> <span>${v}</span>${note}`;
    } else if (l.question && l.question.choix && l.question.choix.length) {
      const k = cleRepAussi(l.question); const cur = ((geste6.reponses[art.id] || {})[k]) || '';
      apres = `<select data-aussi-rep="${esc(art.id)}|${esc(k)}" aria-label="${champ}"><option value="">${esc(TU('pa_choisir'))}</option>${l.question.choix.map((c) => `<option${cur === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select> ${etiquette5('a-choisir', TU('pa_a_choisir'), 'ambre')}`;
    } else if (l.champ === 'prix' && l.raison === 'sous-plancher') {
      apres = `${etiquette5('a-choisir', TU('pa_a_choisir'), 'ambre')} <small>${esc(TU('pa_sous_plancher', { p: euroTxt(l.plancher) }))}</small>`;
    } else apres = `${etiquette5('a-choisir', TU('pa_a_choisir'), 'ambre')}${l.question && l.question.raison ? ` <small>${esc(l.question.raison)}</small>` : ''}`;
    return `<tr data-aussi-ligne="${esc(l.champ)}" data-etat="${esc(l.etat)}"><th scope="row">${champ}</th><td>${vinted}</td><td>${apres}</td></tr>`;
  }
  function aussiHtml6(g, de, etat, fermer) {
    const titreH = `<h3>${esc(TU('pa_titre'))} — ${esc(TU('pa_n', { n: g.ids.length }))}</h3>`;
    if (g.job) {
      const j = g.job;
      const arts = (j.articles || []).map((a) => `<div class="au6-art" data-aussi-suivi="${esc(a.id)}"><p><b>${a.numero ? plaque(a.numero) + ' ' : ''}${esc(a.titre || a.id)}</b></p>`
        + Object.entries(a.sites || {}).map(([st, x]) => {
          const ton = x.etat === 'arrete' || x.etat === 'pas-su' ? 'ambre' : '';
          const st6 = x.etat === 'publiee' ? 'envoye' : x.etat === 'en-cours' ? 'en_route' : x.etat;
          const frise = `<ol class="au6-frise" data-aussi-frise="${esc(st)}">${(x.frise || []).map((f) => `<li data-etape="${esc(f.k)}" data-etat="${esc(f.etat)}">${f.etat === 'fait' ? '✓' : f.etat === 'en-cours' ? '…' : '·'} ${esc(TU('pa_f_' + f.k))}</li>`).join('')}</ol>`;
          const ecarts = (x.ecarts || []).map((e) => `<li>${esc(e.code === 'pas-relu' ? TU('pa_pas_relu', { champ: TU('pa_c_' + e.champ) }) : TU('pa_ecart', { champ: TU('pa_c_' + e.champ), a: e.attendu, l: e.lu }))}</li>`).join('');
          return `<div class="au6-site" data-aussi-site="${esc(st)}" data-etat="${esc(x.etat)}"><p data-aussi-etat="${esc(x.etat)}">${etiquette5(st6, NOM_AUSSI6[st] + ' · ' + TU('pa_e_' + String(x.etat).replace('-', '_')), ton)}${x.lien ? ` <a class="vu-btn vu-sec" href="${esc(x.lien)}" target="_blank" rel="noopener" data-aussi-voir="${esc(st)}">${esc(TU('pa_voir', { site: NOM_AUSSI6[st] }))}</a>` : ''}</p>${frise}${x.raison ? `<p class="note5" data-aussi-raison>${esc(x.raison)}</p>` : ''}${ecarts ? `<ul class="note5" data-aussi-ecarts>${ecarts}</ul>` : ''}</div>`;
        }).join('') + '</div>').join('');
      const enCours = j.etat === 'en-cours';
      return `<section class="geste6" data-geste="aussi" data-aussi-job="${esc(j.etat)}">${titreH}<p class="note5" role="status">${esc(TU(enCours ? 'pa_en_cours' : 'pa_fini'))}</p>${arts}
        <div class="pied6">${enCours ? `<button type="button" class="vu-btn" data-aussi-stop>${esc(TU('pa_arreter'))}</button>` : `<button type="button" class="vu-btn" data-geste-fermer>${esc(TU('c_fermer'))}</button>`}</div></section>`;
    }
    const segs = `<div class="rg6"><span><b>${esc(TU('pa_sur'))}</b></span><div class="vu-seg vue5" role="group">${SITES_AUSSI6.map((k) => `<button type="button" data-aussi-site-b="${k}" aria-pressed="${g.sites.includes(k)}">${NOM_AUSSI6[k]}</button>`).join('')}</div></div>`;
    const pcts = g.sites.map((s) => `<label class="rg6"><span><b>${esc(TU('pa_prix_sur', { site: NOM_AUSSI6[s] }))}</b></span><select data-aussi-pct="${s}">${[0, 5, 10, 15, 20].map((p) => `<option value="${p}"${Number(g.pct[s]) === p ? ' selected' : ''}>${p ? '+' + p + ' %' : esc(TU('pa_meme'))}</option>`).join('')}</select></label>`).join('');
    if (g.charge && !g.ap) return `<section class="geste6" data-geste="aussi" data-aussi-charge>${titreH}${etat}${segs}<p class="note5" role="status">${esc(TU('pa_charge'))}</p><div class="pied6">${fermer}</div></section>`;
    const ap = g.ap;
    const comptes = ap ? g.sites.map((s) => { const c = ap.comptes && ap.comptes[s]; return `<p class="note5" data-aussi-compte="${s}" data-ok="${c && c.ok ? 1 : 0}">${c && c.ok ? '✓ ' + esc(TU('pa_compte_ok', { site: NOM_AUSSI6[s] })) : etiquette5('a-faire', TU('pa_compte_ko', { site: NOM_AUSSI6[s], raison: (c && c.raison) || '—' }), 'ambre')}</p>`; }).join('') : '';
    const arts = ap ? (ap.articles || []).map((a) => {
      const x = de(a.id);
      if (!a.ok) return `<div class="au6-art" data-aussi-art="${esc(a.id)}" data-ok="0"><p><b>${x.num ? plaque(x.num) + ' ' : ''}${esc(x.titre || a.id)}</b></p><p class="note5">${etiquette5('a-faire', a.raison || '—', 'ambre')}</p></div>`;
      return `<div class="au6-art" data-aussi-art="${esc(a.id)}" data-ok="1"><p><b>${a.numero ? plaque(a.numero) + ' ' : ''}${esc(a.titre || '')}</b></p>`
        + g.sites.map((s) => {
          const S = a.sites[s]; if (!S) return '';
          if (S.etat === 'deja') return `<div class="au6-site" data-aussi-site="${s}" data-etat="deja"><p>${etiquette5('deja', TU('pa_deja', { site: NOM_AUSSI6[s] }))}${S.refus && S.refus.lien ? ` <a class="vu-btn vu-sec" href="${esc(S.refus.lien)}" target="_blank" rel="noopener">${esc(TU('pa_voir', { site: NOM_AUSSI6[s] }))}</a>` : ''}</p></div>`;
          if (S.etat === 'refus') return `<div class="au6-site" data-aussi-site="${s}" data-etat="refus"><p class="note5">${etiquette5('refus', TU('pa_refus', { site: NOM_AUSSI6[s], raison: (S.refus && (S.refus.marque || S.refus.code)) || '—' }), 'ambre')}</p></div>`;
          const ph = (S.photos || []).map((u, i) => `<span class="au6-vig"><img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer"><i>${i + 1}</i></span>`).join('');
          return `<div class="au6-site" data-aussi-site="${s}" data-etat="${esc(S.etat)}"><h4>${esc(TU('pa_vers', { site: NOM_AUSSI6[s] }))} ${S.etat === 'pret' ? etiquette5('envoye', TU('pa_pret')) : etiquette5('a-choisir', TU('pa_a_choisir'), 'ambre')}</h4>`
            + `<div class="au6-tab"><table class="au6-t"><thead><tr><th>${esc(TU('pa_champ'))}</th><th>Vinted</th><th>${esc(NOM_AUSSI6[s])}</th></tr></thead><tbody>${(S.lignes || []).filter((l) => l.champ !== 'photos').map((l) => aussiLigne6(a, s, l)).join('')}</tbody></table></div>`
            + `<p class="note5" data-aussi-photos="${(S.photos || []).length}">${esc(TU('pa_photos', { n: (S.photos || []).length }))}${S.photosEnTrop ? ' · ' + esc(TU('pa_photos_trop', { n: S.photosEnTrop })) : ''}</p><div class="au6-ph">${ph}</div></div>`;
        }).join('') + '</div>';
    }).join('') : '';
    const pmArts = ap ? (ap.articles || []).filter((a) => a.ok).map((a) => ({ num: a.numero || '', item: a.id, titre: a.titre || '', prix: a.prixVinted })) : [];
    if (pmArts.length) pmCharger6(g, pmArts);
    const pmH = pmArts.length && PM6 ? PM6.html(pmArts, g.pmProps === undefined ? undefined : g.pmProps, g.pm || {}) : '';
    const pret = !!(ap && ap.pret) && g.sites.length > 0;
    const conf = g.confirme ? `<div class="conf5" role="alertdialog" data-aussi-conf><p>${esc(TU('pa_conf'))}</p><div class="outils"><button type="button" class="vu-btn vu-plein" data-aussi-confirmer${geste6EnVol ? ' disabled' : ''}>${esc(TU('pa_confirmer'))}</button><button type="button" class="vu-btn vu-sec" data-aussi-annuler>${esc(TU('ra_annuler'))}</button></div></div>` : '';
    return `<section class="geste6" data-geste="aussi" data-aussi-pret="${pret ? 1 : 0}">${titreH}${etat}${segs}${pcts}${comptes}${arts}
      ${pmH}${pret ? '' : `<p class="note5" data-aussi-rien>${esc(TU('pa_rien_ne_part'))}</p>`}${conf}
      <div class="pied6">${fermer}${g.confirme ? '' : `<button type="button" class="vu-btn vu-plein" data-aussi-publier${pret && !g.charge && !geste6EnVol ? '' : ' disabled'}>${esc(TU('pa_publier_n', { n: g.sites.length }))}</button>`}</div></section>`;
  }
  function brancherAussi6(R) {
    if (PM6 && geste6 && (geste6.k === 'aussi' || geste6.k === 'publier')) PM6.lier(R, geste6.pm = geste6.pm || {}, rendre);
    R.querySelectorAll('[data-aussi-site-b]').forEach((b) => b.addEventListener('click', () => { const g = geste6; const s = b.getAttribute('data-aussi-site-b'); g.sites = g.sites.includes(s) ? g.sites.filter((x) => x !== s) : SITES_AUSSI6.filter((x) => x === s || g.sites.includes(x)); g.ap = null; if (g.sites.length) aussiCharger6(); else rendre(); }));
    R.querySelectorAll('[data-aussi-pct]').forEach((c) => c.addEventListener('change', () => { geste6.pct[c.getAttribute('data-aussi-pct')] = Number(c.value) || 0; aussiCharger6(); }));
    R.querySelectorAll('[data-aussi-rep]').forEach((c) => c.addEventListener('change', () => { const [id, k] = String(c.getAttribute('data-aussi-rep')).split(/\|(.*)/s); const r = geste6.reponses[id] = geste6.reponses[id] || {}; if (c.value) r[k] = c.value; else delete r[k]; aussiCharger6(); }));
    const pb = R.querySelector('[data-aussi-publier]'); if (pb) pb.addEventListener('click', () => { geste6.confirme = true; rendre(); });
    const an = R.querySelector('[data-aussi-annuler]'); if (an) an.addEventListener('click', () => { geste6.confirme = false; rendre(); });
    const cf = R.querySelector('[data-aussi-confirmer]'); if (cf) cf.addEventListener('click', () => {
      const g = geste6;
      const pmArts = g.ap ? (g.ap.articles || []).filter((a) => a.ok).map((a) => ({ num: a.numero || '', item: a.id, titre: a.titre || '', prix: a.prixVinted })) : [];
      pmPoser6(g, pmArts, () => envoyer6({ action: 'publierAussiLancer', ids: g.ids, sites: g.sites, pct: g.pct, reponses: g.reponses, confirme: true }, (r) => {
        g.confirme = false;
        if (r && r.accepte) { g.jobId = r.jobId; g.job = { etat: 'en-cours', articles: [] }; geste6Etat = null; aussiSuivre6(); }
        else { geste6Etat = { ok: false, texte: (r && r.raison) || TU('ra_ko') }; if (r && r.apercu) g.ap = r.apercu; }
      }));
    });
    const st = R.querySelector('[data-aussi-stop]'); if (st) st.addEventListener('click', () => { try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'publierAussiStop' }, () => { void chrome.runtime.lastError; }); } catch (_) {} });
    R.querySelectorAll('[data-aussi-un]').forEach((b) => b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); ongletListe = 'annonces'; ouvrirAussi6([b.getAttribute('data-aussi-un')]); }));
  }
  // La page d'une de SES annonces sur vinted.fr (`/items/{id}`) : l'annonce de l'onglet, si elle est dans SES articles.
  function annonceIci6() {
    try { const m = /^\/items\/(\d{4,15})(?:[-/]|$)/.exec(location.pathname); if (!m) return null; const t = (listes && listes.annonces && listes.annonces.toutes) || []; return t.find((x) => String(x.id) === m[1]) || null; } catch (_) { return null; }
  }
  function aussiIciHtml6() {
    const x = listes && listes.plateforme === 'vinted' ? annonceIci6() : null;
    if (!x || (geste6 && geste6.k === 'aussi')) return '';
    return `<section class="sec6" data-aussi-ici="${esc(x.id)}"><h3>${esc(TU('pa_ici'))}</h3><div class="rg6"><span><b>${x.num ? plaque(x.num) + ' ' : ''}${esc(x.titre || '')}</b></span><button type="button" class="vu-btn" data-aussi-un="${esc(x.id)}">${esc(TU('ac_aussi'))}</button></div></section>`;
  }
  function geste6Html() {
    if (!geste6) return '';
    const toutes = (listes && listes.annonces && listes.annonces.toutes) || [];
    const de = (id) => toutes.find((y) => y.id === id) || { id };
    const etat = geste6Etat ? `<p class="note5" role="status" data-geste-etat="${geste6Etat.ok ? 'ok' : 'ko'}">${esc(geste6Etat.texte)}</p>` : '';
    const fermer = `<button type="button" class="vu-btn" data-geste-fermer>${esc(TU('ra_annuler'))}</button>`;
    // 5.423 (`modifavantapres`) : AVANT de lancer, la feuille Avant | Après de chaque annonce (valeurs LUES, « — » sinon) ;
    //    « Modifier » revient à la saisie, le bouton plein lance. Rien ne part avant SON « Lancer ».
    if (geste6.k === 'prix' && geste6.aa) {
      const hc = geste6.hausseConf ? `<div class="conf5" role="alertdialog" data-prix-hausse="${geste6.hausseConf.length}">${geste6.hausseConf.map((h) => `<p>${esc(TU('g6_monter_q', { p: euroTxt(h.prix), avant: euroTxt(h.prixVu) }))}${h.num ? ' · N°' + esc(h.num) : ''}</p>`).join('')}<div class="outils"><button type="button" class="vu-btn vu-plein" data-prix-hausse-oui>${esc(TU('g6_monter_oui'))}</button><button type="button" class="vu-btn" data-prix-hausse-non>${esc(TU('ra_annuler'))}</button></div></div>` : '';
      const L = lignesPrix6();
      const gc = geste6.gardeConf && geste6.gardeConf.length ? gardeConfHtml6(geste6.gardeConf) : '';
      const un = L.some((l) => l.site) ? `<p class="note5" data-pp-un>${esc(TU('pp_un_a_la_fois'))}</p>` : '';
      return `<section class="geste6" data-geste="prix" data-aa-vue><h3>${esc(TU('m3_feuille'))}</h3>${etat}${hc}${gc}${U.MODIF ? U.MODIF.avantApresHtml(L) : ''}${un}<div class="pied6"><button type="button" class="vu-btn" data-aa-retour>${esc(TU('m3_retour'))}</button><button type="button" class="vu-btn vu-plein" data-prix-confirmer${geste6EnVol || !L.length || geste6.hausseConf || gc ? ' disabled' : ''}>${esc(TU('m3_lancer'))}</button></div></section>`;
    }
    if (geste6.k === 'atelier' && geste6.aa) {
      const g = geste6, lp = g.verif && g.verif.lancer;
      const L = lignesAtelier6();
      const lpN = lp && !lp.ok ? `<p class="note5" data-atelier-ferme>${esc(TU(lp.raison === 'a-corriger' ? 'g6_lancer_ferme' : 'g6_toutes_absentes', { n: lp.n || 0 }))}</p>` : '';
      return `<section class="geste6" data-geste="atelier" data-aa-vue${g.direct ? ' data-repub-direct' : ''}><h3>${esc(g.direct ? TU(g.ids.length === 1 ? 'rd_titre_un' : 'rd_titre', { n: g.ids.length }) : TU('m3_feuille'))}</h3>${etat}<p class="note5">${esc(TU('g6_atelier_ordre'))}</p>${g.verifEnCours ? `<p class="note5" data-atelier-recap="cours">${esc(TU('g6_verif_cours'))}</p>` : ''}${U.MODIF ? U.MODIF.avantApresHtml(L) : ''}${lpN}<div class="pied6">${g.direct ? fermer : ''}<button type="button" class="vu-btn" data-aa-retour>${esc(TU(g.direct ? 'rd_reglages' : 'm3_retour'))}</button><button type="button" class="vu-btn vu-plein" data-atelier-lancer${geste6EnVol || g.verifEnCours || !L.length || (lp && !lp.ok) ? ' disabled' : ''}>${esc(TU(g.direct ? 'rd_maintenant' : 'm3_lancer'))}</button></div></section>`;
    }
    if (geste6.k === 'prix') {
      const lignes = geste6.ids.map((id) => { const x = de(id); const pl = plancher6(x); const v = geste6.prix[id] != null ? geste6.prix[id] : '';
        return `<div class="rg6" data-prix-ligne="${esc(id)}"><span><b>${x.num ? plaque(x.num) + ' ' : ''}${esc(x.titre || id)}</b><small>${esc(TU('g6_prix_vu', { p: Number(x.prix) > 0 ? euroTxt(x.prix) : '—' }))} · ${esc(pl ? TU(pl.de === 'mini' ? 'g6_plancher_mini' : 'g6_plancher_achat', { p: euroTxt(pl.v) }) : TU('g6_plancher_pas_su'))}</small></span><input type="text" inputmode="decimal" class="prix6" data-prix-nouveau="${esc(id)}" value="${esc(v)}" aria-label="${esc(TU('g6_nouveau_prix'))}" placeholder="${esc(TU('g6_nouveau_prix'))}">${ppSousLigne6(id)}</div>`; }).join('');
      if (!geste6.pp) ppCharger6(geste6);
      const aDesAutres = geste6.pp && geste6.pp.par && geste6.ids.some((id) => ppAgissables6(id).length);
      const tous = ppTous6();
      const ppChoix = aDesAutres ? `<div class="rg6 pp6-choix" data-pp-choix><label class="pp6-tous"><input type="checkbox" data-pp-tous${tous ? ' checked' : ''}> <b>${esc(TU('pp_tous'))}</b></label>${tous ? `<div class="vu-seg vue5" role="group"><button type="button" data-pp-ajuste="meme" aria-pressed="${geste6.ajuste !== 'plus'}">${esc(TU('pp_meme'))}</button><button type="button" data-pp-ajuste="plus" aria-pressed="${geste6.ajuste === 'plus'}">${esc(TU('pp_plus', { n: Number(geste6.plusN) || 10 }))}</button></div>${geste6.ajuste === 'plus' ? `<input type="number" min="1" max="50" step="1" class="prix6 pp6-n" data-pp-n value="${esc(Number(geste6.plusN) || 10)}" aria-label="%">` : ''}` : ''}</div><p class="note5" data-pp-ebay>${esc(TU('pp_dit_ebay'))}</p>` : '';
      const hc = geste6.hausseConf ? `<div class="conf5" role="alertdialog" data-prix-hausse="${geste6.hausseConf.length}">${geste6.hausseConf.map((h) => `<p>${esc(TU('g6_monter_q', { p: euroTxt(h.prix), avant: euroTxt(h.prixVu) }))}${h.num ? ' · N°' + esc(h.num) : ''}</p>`).join('')}<div class="outils"><button type="button" class="vu-btn vu-plein" data-prix-hausse-oui>${esc(TU('g6_monter_oui'))}</button><button type="button" class="vu-btn" data-prix-hausse-non>${esc(TU('ra_annuler'))}</button></div></div>` : '';
      return `<section class="geste6" data-geste="prix"><h3>${esc(TU('g6_prix_titre', { n: geste6.ids.length }))}</h3>${etat}${hc}<div class="outils">${[5, 10, 15, 20].map((p) => `<button type="button" class="vu-btn" data-prix-pct="${p}">−${p} %</button>`).join('')}</div>${lignes}${ppChoix}<div class="pied6">${fermer}<button type="button" class="vu-btn vu-plein" data-prix-confirmer${geste6EnVol ? ' disabled' : ''}>${esc(TU('m3_revoir'))}</button></div></section>`;
    }
    if (geste6.k === 'atelier') {
      const g = geste6, ph = g.photo;
      const liste = g.ids.map((id, i) => { const x = de(id); const v = g.verif && g.verif.paires ? g.verif.paires[id] : null;
        const detail = v ? `${etiquette5(v.etat, TU('g6_v_' + (['ok', 'corrige', 'a-corriger', 'absente'].includes(v.etat) ? v.etat.replace('-', '_') : 'pas_verifie')), v.etat === 'a-corriger' ? 'ambre' : '')}${(v.corrections || []).map((c) => `<small>${esc((c.nom || c.champ) + ' : ' + (c.raison || ''))}</small>`).join('')}${(v.manque || []).map((m) => `<small>${esc(TU('g6_manque', { m }))}</small>`).join('')}${v.raison && v.etat !== 'ok' ? `<small>${esc(v.raison)}</small>` : ''}${v.etat === 'a-corriger' && v.question && Array.isArray(v.question.options) ? `<label class="champ6"><b>${esc(TU('g6_choisir', { nom: v.question.nom || v.question.champ }))}</b><select data-atelier-question="${esc(id)}" data-champ="${esc(v.question.champ)}"><option value=""></option>${v.question.options.map((o) => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select></label>` : v.etat === 'a-corriger' && v.question && v.question.geste ? `<small>${esc(v.question.geste)}</small>` : ''}${v.etat === 'a-corriger' || v.etat === 'absente' ? `<button type="button" class="vu-btn" data-atelier-retirer="${esc(id)}">${esc(TU('g6_retirer'))}</button>` : ''}` : '';
        return `<li class="rg6" data-atelier-paire="${esc(id)}" data-verif="${esc(v ? v.etat : '')}"><span><b>${i + 1}. ${x.num ? plaque(x.num) + ' ' : ''}${esc(x.titre || id)}</b>${detail}</span><span class="outils"><button type="button" class="rond6" data-atelier-haut="${i}" aria-label="${esc(TU('g6_monter'))}"${i ? '' : ' disabled'}>↑</button><button type="button" class="rond6" data-atelier-bas="${i}" aria-label="${esc(TU('g6_descendre'))}"${i < g.ids.length - 1 ? '' : ' disabled'}>↓</button></span></li>`; }).join('');
      const curseur = (k, min, max, pas, lib) => `<label class="champ6 cd6"><b>${esc(TU(lib))}</b><span class="cd6-l"><input type="range" min="${min}" max="${max}" step="${pas}" value="${ph[k]}" data-atelier-photo="${k}"><output>${esc(String(ph[k]))}</output></span></label>`;
      const rs = g.verif && g.verif.resume, lp = g.verif && g.verif.lancer;
      const recap = g.verifEnCours ? `<p class="note5" data-atelier-recap="cours">${esc(TU('g6_verif_cours'))}</p>` : rs ? `<p class="note5" data-atelier-recap="${rs.aCorriger ? 'bloque' : 'ok'}"><b>${esc(TU('g6_verif_recap', { v: rs.verifiees, c: rs.corrige, a: rs.aCorriger }))}</b>${rs.absente ? ' · ' + esc(TU('g6_verif_absentes', { n: rs.absente })) : ''}${rs.pasVerifie ? ' · ' + esc(TU('g6_verif_pas', { n: rs.pasVerifie })) : ''}</p>` : '';
      return `<section class="geste6" data-geste="atelier"><h3>${esc(TU('g6_atelier_titre', { n: g.ids.length }))}</h3><p class="note5">${esc(TU('g6_atelier_ordre'))}</p>${etat}${recap}<ol class="au6-l">${liste}</ol>
        <div class="rg6"><span><b>${esc(TU('g6_espacement'))}</b></span><div class="vu-seg vue5" role="group">${['fixe', 'aleatoire'].map((k) => `<button type="button" data-atelier-mode="${k}" aria-pressed="${g.mode === k}">${esc(TU('g6_' + k))}</button>`).join('')}</div></div>
        <div class="rg6"><span><b>${esc(TU(g.mode === 'aleatoire' ? 'g6_entre' : 'g6_toutes'))}</b></span><span class="outils"><input type="number" min="1" max="120" class="prix6" data-atelier-min value="${g.min}" aria-label="min">${g.mode === 'aleatoire' ? `<input type="number" min="1" max="120" class="prix6" data-atelier-max value="${g.max}" aria-label="max">` : ''}<span>min</span></span></div>
        ${curseur('bright', 0.5, 1.5, 0.05, 'g6_luminosite')}${curseur('contrast', 0.5, 1.5, 0.05, 'g6_contraste')}${curseur('sat', 0, 2, 0.05, 'g6_saturation')}${curseur('zoom', 1, 2, 0.05, 'g6_zoom')}${curseur('rot', -15, 15, 1, 'g6_rotation')}
        <label class="rg6"><span><b>${esc(TU('g6_lettre'))}</b></span><input type="checkbox" data-atelier-lettre${g.lettre ? ' checked' : ''}></label>
        <div class="rg6" data-atelier-quand="${esc(g.quand)}"><span><b>${esc(TU('g6_quand'))}</b></span><div class="vu-seg vue5" role="group" aria-label="${esc(TU('g6_quand'))}">${['maintenant', 'programmer'].map((k) => `<button type="button" data-atelier-quand-choix="${k}" aria-pressed="${g.quand === k}">${esc(TU('g6_' + k))}</button>`).join('')}</div></div>
        ${g.quand === 'programmer' ? `<label class="rg6" data-atelier-heure><span><b>${esc(TU('g6_prog_heure'))}</b><small>${esc(TU('g6_prog_ouvert'))}</small></span><input type="datetime-local" class="prix6 heure6" data-atelier-at value="${esc(g.at)}" min="${esc(valeurLocale6(Date.now() + PROG_AVANCE_MIN))}" max="${esc(valeurLocale6(Date.now() + PROG_AVANCE_MAX))}" aria-label="${esc(TU('g6_prog_heure'))}"></label>` : ''}
        ${g.progConf ? `<div class="conf5" role="alertdialog" data-atelier-prog-confirme="${esc(String(atDe6(g.at) || ''))}"><p class="prog6-q">${esc(phraseProg6(g.ids.length, atDe6(g.at), { mode: g.mode, min: g.min, max: g.mode === 'aleatoire' ? g.max : g.min }))}</p><div class="pied6 prog6-pied"><button type="button" class="vu-btn" data-atelier-prog-non>${esc(TU('ra_annuler'))}</button><button type="button" class="vu-btn vu-plein" data-atelier-prog-oui${geste6EnVol ? ' disabled' : ''}>${esc(TU('g6_confirmer'))}</button></div></div>` : ''}
        ${g.progConf ? '' : `<div class="pied6">${fermer}<button type="button" class="vu-btn vu-plein" data-atelier-lancer${geste6EnVol || g.verifEnCours || (lp && !lp.ok) ? ' disabled' : ''}>${esc(TU(g.quand === 'programmer' ? 'g6_programmer_btn' : 'm3_revoir'))}</button></div>`}${lp && !lp.ok ? `<p class="note5" data-atelier-ferme>${esc(TU(lp.raison === 'a-corriger' ? 'g6_lancer_ferme' : 'g6_toutes_absentes', { n: lp.n || 0 }))}</p>` : ''}</section>`;
    }
    if (geste6.k === 'aussi') return aussiHtml6(geste6, de, etat, fermer);
    if (geste6.k === 'publier') {
      const g = geste6, x = de(g.id);
      const q = (g.questions || []).map((qq) => `<label class="champ6"><b>${esc(TU('g6_q_' + (['categorie', 'etat', 'pointure', 'marque'].includes(qq.champ) ? qq.champ : 'autre')))}</b>${(() => { const k = (qq.site ? qq.site + '|' : '') + qq.champ; return qq.choix && qq.choix.length ? `<select data-publier-rep="${esc(k)}"><option value=""></option>${qq.choix.map((c) => `<option${g.reponses[k] === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>` : `<input type="text" data-publier-rep="${esc(k)}" value="${esc(g.reponses[k] || '')}">`; })()}</label>`).join('');
      const pb = (g.problemes || []).map((p) => `<p class="note5" data-publier-probleme="${esc(p.code)}">· ${esc(p.texte)}</p>`).join('');
      return `<section class="geste6" data-geste="publier"><h3>${esc(TU('g6_publier_titre'))} — ${x.num ? plaque(x.num) + ' ' : ''}${esc(x.titre || g.id)}</h3>${etat}
        <div class="rg6"><span><b>${esc(TU('g6_publier_sur'))}</b></span><div class="vu-seg vue5" role="group">${['leboncoin', 'vestiaire'].map((k) => `<button type="button" data-publier-site="${k}" aria-pressed="${g.site === k}">${k === 'leboncoin' ? 'Leboncoin' : 'Vestiaire'}</button>`).join('')}</div></div>
        ${q}${pb ? `<div data-publier-verif>${pb}</div>` : ''}
        ${(() => { if (!PM6) return ''; const a6 = [{ num: x.num || '', item: g.id, titre: x.titre || '', prix: x.prix }]; pmCharger6(g, a6); return PM6.html(a6, g.pmProps === undefined ? undefined : g.pmProps, g.pm || {}); })()}
        <div class="pied6">${fermer}<button type="button" class="vu-btn vu-plein" data-publier-envoyer${geste6EnVol ? ' disabled' : ''}>${esc(TU(pb ? 'g6_publier_quand_meme' : 'g6_publier'))}</button></div></section>`;
    }
    return '';
  }
  // L'atelier en cours (fond) : chaque paire et son étape ; « Reprendre » une paire arrêtée ; « Arrêter ».
  // 5.410 (lot lbc-vc-interesses) — LEBONCOIN : les INTÉRESSÉS de chaque annonce (lecture : `interessesLbc`) et
  //    « Leur écrire » (SA série, récapitulatif CONFIRMÉ : `ecrireInteressesLbc`, un message à la fois, temps au hasard).
  let lbcInt = null, lbcIntEtat = null;
  function interessesLbcHtml() {
    if (!listes || listes.plateforme !== 'leboncoin') return '';
    if (!lbcInt) { lbcInt = { charge: true }; try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'interessesLbc' }, (r) => { void chrome.runtime.lastError; lbcInt = { data: r && r.ok ? r : null, raison: r && !r.ok ? r.raison : '', coches: new Set(), textes: [''], annonce: '', etat: lbcIntEtat }; lbcIntEtat = null; rendre(); }); } catch (_) {} return ''; }
    if (lbcInt.charge) return `<section class="geste6" data-lbc-interesses="charge"><p class="note5">${esc(TU('m_charge'))}</p></section>`;
    const d = lbcInt.data;
    if (!d) return lbcInt.raison ? `<section class="geste6" data-lbc-interesses="ko"><p class="note5">${esc(lbcInt.raison)}</p></section>` : '';
    const toutes = (listes.annonces && listes.annonces.toutes) || [];
    const titre = (id) => { const x = toutes.find((y) => String(y.id) === String(id)); return x ? x.titre : '#' + id; };
    const etat = lbcInt.etat ? `<p class="note5" role="status" data-lbc-int-etat="${lbcInt.etat.ok ? 'ok' : 'ko'}">${esc(lbcInt.etat.texte)}</p>` : '';
    const serie = d.serie ? `<p class="note5" data-lbc-int-serie>${esc(TU('li_serie', { n: d.serie.reste || 0 }))}</p>` : '';
    const annonces = (d.annonces || []).map((a) => `<div class="rg6" data-lbc-int-annonce="${esc(a.annonce)}"><span><b>${esc(titre(a.annonce))}</b><small>${esc(TU('li_n', { n: a.n, a: a.attendent }))}</small></span><button type="button" class="vu-btn" data-lbc-int-voir="${esc(a.annonce)}" aria-pressed="${lbcInt.annonce === a.annonce}">${esc(TU('li_voir'))}</button></div>`).join('');
    let detail = '';
    if (lbcInt.annonce) {
      const gens = (d.liste || []).filter((x) => x.annonce === lbcInt.annonce);
      const n = [...lbcInt.coches].filter((c) => gens.some((g) => g.conv === c && !g.dejaEcrit)).length;
      detail = `<div data-lbc-int-gens="${gens.length}">${gens.map((g) => `<label class="rg6"><span><b>${esc(TU('li_personne', { n: g.messagesDeLui }))}</b><small>${esc(depuis(Date.parse(g.dernierAt)) || '')}${g.attendTaReponse ? ' · ' + esc(TU('li_attend')) : ''}${g.dejaEcrit ? ' · ' + esc(TU('li_deja')) : ''}</small></span><input type="checkbox" data-lbc-int-conv="${esc(g.conv)}"${lbcInt.coches.has(g.conv) ? ' checked' : ''}${g.dejaEcrit ? ' disabled' : ''}></label>`).join('')}</div>`
        + lbcInt.textes.map((t, i) => `<label class="champ6"><b>${esc(TU('rf_version', { n: i + 1 }))}</b><textarea data-lbc-int-texte="${i}" maxlength="2000" rows="2">${esc(t)}</textarea></label>`).join('')
        + (d.appris ? '' : `<p class="note5" data-lbc-int-pas-appris>${esc(TU('li_pas_appris'))}</p>`)
        + (lbcInt.conf ? `<div class="conf5" role="alertdialog" data-lbc-int-confirme="${n}"><p>${esc(TU('li_conf', { n, a: d.ecartS ? d.ecartS[0] : 40, b: d.ecartS ? d.ecartS[1] : 90, m: d.parToucher || 10 }))}</p><div class="outils"><button type="button" class="vu-btn vu-plein" data-lbc-int-oui>${esc(TU('li_oui'))}</button><button type="button" class="vu-btn" data-lbc-int-non>${esc(TU('ra_annuler'))}</button></div></div>`
          : `<div class="pied6"><span></span><button type="button" class="vu-btn vu-plein" data-lbc-int-ecrire${!n || !d.appris || d.serie || !lbcInt.textes.some((t) => t.trim()) ? ' disabled' : ''}>${esc(TU('li_ecrire', { n }))}</button></div>`);
    }
    return `<section class="geste6" data-lbc-interesses="${(d.annonces || []).length}"><h3>${esc(TU('li_titre', { n: (d.liste || []).length }))}</h3>${etat}${serie}${annonces || `<p class="note5">${esc(TU('li_aucun'))}</p>`}${detail}</section>`;
  }
  function brancherLbcInt(R) {
    R.querySelectorAll('[data-lbc-int-voir]').forEach((b) => b.addEventListener('click', () => { lbcInt.annonce = b.getAttribute('data-lbc-int-voir'); lbcInt.coches = new Set((lbcInt.data.liste || []).filter((x) => x.annonce === lbcInt.annonce && !x.dejaEcrit).map((x) => x.conv)); lbcInt.conf = false; rendre(); }));
    R.querySelectorAll('[data-lbc-int-conv]').forEach((c) => c.addEventListener('change', () => { const k = c.getAttribute('data-lbc-int-conv'); if (c.checked) lbcInt.coches.add(k); else lbcInt.coches.delete(k); rendre(); }));
    R.querySelectorAll('[data-lbc-int-texte]').forEach((c) => c.addEventListener('input', () => { lbcInt.textes[Number(c.getAttribute('data-lbc-int-texte'))] = c.value; }));
    R.querySelectorAll('[data-lbc-int-texte]').forEach((c) => c.addEventListener('change', () => { if (lbcInt.textes.length < 5 && lbcInt.textes[lbcInt.textes.length - 1].trim()) lbcInt.textes.push(''); rendre(); }));
    const ec = R.querySelector('[data-lbc-int-ecrire]'); if (ec) ec.addEventListener('click', () => { lbcInt.conf = true; rendre(); });
    const non = R.querySelector('[data-lbc-int-non]'); if (non) non.addEventListener('click', () => { lbcInt.conf = false; rendre(); });
    const oui = R.querySelector('[data-lbc-int-oui]'); if (oui) oui.addEventListener('click', () => {
      const gens = (lbcInt.data.liste || []).filter((x) => x.annonce === lbcInt.annonce && !x.dejaEcrit && lbcInt.coches.has(x.conv)).map((x) => x.conv);
      envoyer6({ action: 'ecrireInteressesLbc', annonce: lbcInt.annonce, convs: gens, textes: lbcInt.textes.map((t) => t.trim()).filter(Boolean), confirme: true }, (r) => { lbcInt.conf = false; lbcInt.etat = { ok: !!(r && r.accepte), texte: r && r.accepte ? TU('li_parti') : (r && r.raison) || TU('ra_ko') }; if (r && r.accepte) { lbcIntEtat = lbcInt.etat; lbcInt = null; } });
    });
  }
  function atelierProgHtml() {
    const p = listes && listes.atelierProg;
    if (!p || !Array.isArray(p.ids) || (p.etat !== 'attente' && p.etat !== 'pas-partie')) return '';
    const e = p.espacement || { mode: 'fixe', min: 1, max: 1 };
    if (p.etat === 'attente') return `<section class="geste6" data-atelier-prog="attente" data-atelier-prog-at="${esc(String(p.at))}"><h3>${esc(TU('g6_prog_titre'))}</h3><p class="note5" data-atelier-prog-phrase>${esc(p.ids.length === 1 ? TU('g6_prog_attente_un', { p: pairesTxt6(1), quand: quandProg6(p.at) }) : TU('g6_prog_attente', { p: pairesTxt6(p.ids.length), quand: quandProg6(p.at), e: espaceTxt6(e) }))}</p><p class="note5">${esc(TU('g6_prog_ouvert'))}</p><div class="pied6"><span></span><button type="button" class="vu-btn" data-atelier-prog-annuler${geste6EnVol ? ' disabled' : ''}>${esc(TU('g6_prog_annuler'))}</button></div></section>`;
    const code = ['ferme', 'onglet', 'compte', 'en-cours', 'stockage'].includes(p.code) ? p.code.replace('-', '_') : 'ferme';
    return `<section class="geste6" data-atelier-prog="pas-partie" data-atelier-prog-code="${esc(p.code || '')}"><h3>${etiquette5('arret', TU('g6_prog_pas', { quand: quandProg6(p.at) }), 'ambre')}</h3><p class="note5">${esc(TU('g6_prog_r_' + code))}</p><div class="pied6"><button type="button" class="vu-btn" data-atelier-prog-effacer${geste6EnVol ? ' disabled' : ''}>${esc(TU('g6_prog_effacer'))}</button><button type="button" class="vu-btn vu-plein" data-atelier-prog-relancer${geste6EnVol ? ' disabled' : ''}>${esc(TU('g6_prog_relancer'))}</button></div></section>`;
  }
  // 5.423 (`modifavantapres`) : la modification EN COURS — l'état que le fond pose pour l'écran plein (`vrmActionEnCours`,
  //    lu dans chrome.storage.local, compte de CET onglet seulement) : la frise de l'annonce en cours (preuve par preuve),
  //    « 2 sur 6 », le temps, « Tout arrêter » ; puis le bilan de la série (Avant | Après, « Voir sur Vinted », « Reprendre »).
  let modifEtat = null, modifSig = '', modifFermeDebut = 0, modifReprise = '';
  const SORTES_MODIF6 = ['republier', 'baisse', 'masquer'];
  const modifDuCompte6 = () => { const a = modifEtat; return a && listes && listes.compte && String(a.uid) === String(listes.compte.id) && SORTES_MODIF6.includes(a.sorte) && a.modif && Date.now() - Number(a.maj || 0) < 30 * 60000 ? a : null; };
  function lireModif6() {
    try {
      chrome.storage.local.get('vrmActionEnCours', (g) => {
        void chrome.runtime.lastError;
        const a = g && g.vrmActionEnCours && g.vrmActionEnCours.v === 1 ? g.vrmActionEnCours : null;
        modifEtat = a;
        const sig = a && a.modif ? JSON.stringify([a.uid, a.actif, a.enCours, a.fait, a.total, a.modif, (a.bilan || []).map((b) => [b.id, b.ok, b.at])]) : '';
        if (sig === modifSig) return;
        modifSig = sig;
        let saisie = false; try { const f = ombre.activeElement; saisie = !!(f && /^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName)); } catch (_) {}
        if (!saisie && carte.hasAttribute('data-grand')) rendre();
      });
    } catch (_) {}
  }
  try { chrome.storage.onChanged.addListener((ch, zone) => { if (zone === 'local' && ch.vrmActionEnCours) lireModif6(); }); } catch (_) {}
  setTimeout(lireModif6, 0);
  const tempsModif6 = (a) => { const m = a.modif, e = Math.max(0, Date.now() - Number(m.debut || Date.now())), est = Number(m.estimeMs) || 0, apres = Math.max(0, (Number(a.total) || 0) - (Number(a.fait) || 0) - 1);
    return est ? TU('m3_ecoule', { e: U.duree(e), r: U.duree(Math.max(0, est - e) + apres * est) }) : TU('m3_ecoule_seul', { e: U.duree(e) }); };
  setInterval(() => { const a = modifDuCompte6(); if (!a || !a.actif || !a.enCours) return; const tp = ombre.querySelector('[data-modif6-temps]'); if (tp) tp.textContent = tempsModif6(a); }, 1000);
  function suiviModif6Html(sansRepublier) {
    const a = modifDuCompte6(); if (!a || !U.MODIF) return '';
    const enCours = a.actif === true && a.enCours === true && !a.modif.fin;
    const bilan = (Array.isArray(a.bilan) ? a.bilan : []).filter((b) => b && b.sorte === a.sorte);
    if (sansRepublier && a.sorte === 'republier') return '';
    if (!enCours && (!bilan.length || modifFermeDebut === Number(a.modif.debut))) return '';
    const it = a.item || {}, i = Math.min(Number(a.total) || 0, (Number(a.fait) || 0) + (enCours ? 1 : 0));
    const tete = enCours ? TU('m3_suivi', { i: Math.max(1, i), n: Math.max(1, i, Number(a.total) || 1) }) : TU('m3_suivi_fin');
    const cours = enCours ? `<div class="rg6 modif6-cours" data-modif6-cours="${esc(it.id || '')}">${/^https:\/\/[\w.-]*vinted\.net\//.test(String(it.photo || '')) ? `<img class="vu-aa-img" src="${esc(it.photo)}" alt="" referrerpolicy="no-referrer" decoding="async">` : '<span class="vu-aa-img" aria-hidden="true"></span>'}<span style="flex:1;min-width:0"><b>${it.num ? plaque(it.num) + ' ' : ''}${esc(it.titre || '—')}</b></span></div>${U.MODIF.friseHtml(a.modif)}<p class="note5" data-modif6-temps>${esc(tempsModif6(a))}</p>` : '';
    return `<section class="geste6 modif6" data-modif6="${esc(a.sorte)}" data-modif6-etat="${enCours ? 'cours' : 'fin'}"><h3>${esc(tete)}</h3>${cours}${U.MODIF.bilanHtml(bilan, { domaine: location.hostname })}${modifReprise ? `<p class="note5" role="status" data-modif6-reprise-ko>${esc(modifReprise)}</p>` : ''}<div class="pied6">${enCours ? `<button type="button" class="vu-btn vu-plein" data-modif6-arreter>${esc(TU('c_tout_arreter'))}</button>` : `<span></span><button type="button" class="vu-btn" data-modif6-fermer>${esc(TU('m3_fermer'))}</button>`}</div></section>`;
  }
  function brancherModif6(R) {
    const ar = R.querySelector('[data-modif6-arreter]'); if (ar) ar.addEventListener('click', () => { ar.disabled = true; try { chrome.runtime.sendMessage({ from: 'vrm-action', action: 'arreter' }, () => { void chrome.runtime.lastError; lireModif6(); }); } catch (_) {} });
    const fe = R.querySelector('[data-modif6-fermer]'); if (fe) fe.addEventListener('click', () => { const a = modifDuCompte6(); modifFermeDebut = a ? Number(a.modif.debut) : 0; modifReprise = ''; rendre(); });
    R.querySelectorAll('.modif6 [data-modif-reprendre]').forEach((b) => b.addEventListener('click', () => {
      b.disabled = true; modifReprise = '';
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'reprendreModif', id: b.getAttribute('data-modif-reprendre'), confirme: true }, (r) => { void chrome.runtime.lastError; if (!(r && r.ok)) modifReprise = (r && r.raison) || TU('ra_ko'); chargerListes(true); lireModif6(); rendre(); }); } catch (_) { b.disabled = false; }
    }));
  }
  const domaineVinted6 = () => (/(^|\.)vinted\.(fr|com|it|de)$/.test(location.hostname) ? location.hostname : 'www.vinted.fr');
  function atelierEtatHtml() {
    const a = listes && listes.atelier;
    const pr = atelierProgHtml();
    if (!a || !Array.isArray(a.ids)) return pr;
    const toutes = (listes.annonces && listes.annonces.toutes) || [];
    // 5.423 : chaque paire de l'atelier a SA frise — la paire en cours suit l'écran (preuves en direct), les autres gardent
    //    les preuves rangées à leur fin (`paires[id].preuves`) ; une paire arrêtée dit son étape en ambre et « Reprendre ».
    const live = (() => { const m = modifDuCompte6(); return m && m.sorte === 'republier' && m.modif ? m : null; })();
    const l = a.ids.map((id) => { const x = toutes.find((y) => y.id === id) || {}; const p = a.paires && a.paires[id]; const et = p ? p.etape : 'attente';
      const fr = !U.MODIF ? '' : live && String(live.modif.id) === String(id) && !live.modif.fin && et === 'cours' ? U.MODIF.friseHtml(live.modif)
        : p && p.preuves && (et === 'fait' || et === 'arret' || et === 'planifiee') ? U.MODIF.friseHtml({ sorte: 'republier', preuves: p.preuves, fin: 1, ...(et === 'arret' ? { erreur: p.erreur || { raison: p.raison || '' } } : {}) }) : '';
      const voir = et === 'fait' && p && /^\d{4,15}$/.test(String(p.nouvelId || '')) ? ` <a class="vu-btn" href="https://${domaineVinted6()}/items/${esc(p.nouvelId)}" target="_blank" rel="noopener" data-atelier-voir="${esc(p.nouvelId)}">${esc(TU('m3_voir'))}</a>` : '';
      return `<div class="rg6${fr ? ' rg6-frise' : ''}" data-atelier-etape="${esc(id)}:${esc(et)}"><span><b>${x.num ? plaque(x.num) + ' ' : ''}${esc(x.titre || id)}</b>${p && p.raison ? `<small>${esc(p.raison)}</small>` : ''}</span><span>${etiquette5(et, TU('g6_e_' + (['cours', 'fait', 'planifiee', 'arret'].includes(et) ? et : 'attente')), et === 'arret' ? 'ambre' : '')}${et === 'arret' ? ` <button type="button" class="vu-btn" data-atelier-reprendre="${esc(id)}">${esc(TU('g6_reprendre'))}</button>` : ''}${voir}</span>${fr}</div>`; }).join('');
    // 5.437 : la série en pause parce que Vinted vérifie une annonce (relue 5 → 10 → 20 → 30 min ; 24 h ⇒ SON geste).
    const vf = a.verif && a.etat === 'cours' ? a.verif : null;
    const vfH = vf ? `<div class="conf5" role="status" data-atelier-verif="${vf.aToi ? 'a-toi' : 'attente'}"><p>${esc(TU(vf.aToi ? 'rv_24h' : 'rv_pause', { t: vf.titre || vf.nouvelId }))}</p>${vf.aToi ? '' : `<p class="note5">${esc(TU('rv_relu', { h: (() => { try { return new Date(Number(vf.prochaine)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } })() }))}</p>`}${vf.aToi ? `<div class="outils"><a class="vu-btn vu-sec" href="https://www.vinted.fr/items/${esc(vf.nouvelId)}" target="_blank" rel="noopener">${esc(TU('rv_voir'))}</a><button type="button" class="vu-btn vu-plein" data-atelier-verif-reprendre>${esc(TU('rv_reprendre'))}</button></div>` : ''}</div>` : '';
    return pr + `<section class="geste6" data-atelier-etat="${esc(a.etat)}"><h3>${esc(TU('g6_atelier_suivi', { i: Math.min(a.i, a.ids.length), n: a.ids.length }))}</h3>${vfH}${l}${a.etat === 'cours' ? `<div class="pied6"><span></span><button type="button" class="vu-btn" data-atelier-arreter>${esc(TU('g6_arreter'))}</button></div>` : ''}</section>`;
  }
  // Les OFFRES en attente (Messagerie, Commandes) : accepter (vend la paire : confirmation, garde anti double-vente),
  // contre-offre (au-dessus de son offre, jamais sous ton plancher), refuser.
  const etoiles6 = (e) => { try { return new Intl.NumberFormat(U.langue ? U.langue() : 'fr', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(e)); } catch (_) { return String(e); } };
  function offresHtml(conv) {
    const l = listes && Array.isArray(listes.offres) ? listes.offres.filter((o) => !conv || String(o.conv) === String(conv)) : [];
    if (!l.length) return '';
    const etat = offreEtat ? `<p class="note5" role="status" data-offre-etat="${offreEtat.ok ? 'ok' : 'ko'}">${esc(offreEtat.texte)}</p>` : '';
    return `<section class="geste6" data-offres="${l.length}"><h3>${esc(TU('g6_offres', { n: l.length }))}</h3>${etat}${l.map((o) => { const k = o.tx + ':' + o.oid; const c = offreConf && offreConf.k === k ? offreConf : null;
      return `<div class="rg6 offre6" data-offre="${esc(k)}"><span><b>${esc(euroTxt(o.prix))} · ${esc(o.pseudo || '')}</b>${U.noteAcheteur && o.note ? U.noteAcheteur(o.note) : ''}<small>${esc(o.titre || '')}</small></span><span class="outils">`
        + (c ? `<span class="conf5" role="alertdialog" data-offre-confirme="${esc(c.quoi)}"><span>${esc(c.avis || TU(c.quoi === 'accept' ? 'g6_accepter_q' : 'g6_refuser_q', { p: euroTxt(o.prix) }))}</span>${c.bloque ? '' : `<button type="button" class="vu-btn vu-plein" data-offre-oui${c.noteAvis ? ' data-offre-note-avis' : ''}${geste6EnVol ? ' disabled' : ''}>${esc(TU(c.noteAvis ? 'na_accepter_quand_meme' : c.avis ? 'g6_verifie_accepter' : c.quoi === 'accept' ? 'g6_accepter' : 'g6_refuser'))}</button>`}<button type="button" class="vu-btn" data-offre-non>${esc(TU('ra_annuler'))}</button></span>`
          : `<button type="button" class="vu-btn" data-offre-quoi="accept">${esc(TU('g6_accepter'))}</button><input type="text" inputmode="decimal" class="prix6" data-offre-contre-prix="${esc(k)}" value="${esc(offreContre[k] || '')}" placeholder="${esc(TU('g6_contre_prix'))}" aria-label="${esc(TU('g6_contre_prix'))}"><button type="button" class="vu-btn" data-offre-quoi="contre">${esc(TU('g6_contre'))}</button><button type="button" class="vu-btn" data-offre-quoi="reject">${esc(TU('g6_refuser'))}</button>`)
        + `</span></div>`; }).join('')}</section>`;
  }
  // Le contrôle avant de lancer (fond : `verifierRepub`) ; `ids` vides ⇒ seulement recalculer pour la file actuelle.
  function atelierVerifier6(ids, reponses) {
    const g = geste6; if (!g || g.k !== 'atelier') return;
    const cibles = ids && ids.length ? ids : g.ids;
    if (!cibles.length) { g.verif = null; rendre(); return; }
    g.verifEnCours = true; rendre();
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'atelierVerifier', ids: cibles, tous: g.ids.slice(), ...(reponses ? { reponses } : {}) }, (r) => { void chrome.runtime.lastError; if (geste6 !== g) return; g.verifEnCours = false; if (r && r.ok) g.verif = { paires: r.paires, resume: r.resume, lancer: r.lancer }; else geste6Etat = { ok: false, texte: (r && r.raison) || TU('ra_ko') }; rendre(); }); } catch (_) { g.verifEnCours = false; rendre(); }
  }
  function brancherGestes6(racine) {
    const R = racine;
    try { brancherLbcInt(R); } catch (_) {}
    try { const dv = depotVue(); if (dv) dv.lier(R); } catch (_) {}   // 5.429
    R.querySelectorAll('[data-repub-direct-b]').forEach((b) => b.addEventListener('click', () => republierDirect6([b.getAttribute('data-repub-direct-b')])));   // 5.429
    try { brancherModif6(R); } catch (_) {}
    try { brancherAussi6(R); } catch (_) {}
    const fermer = R.querySelector('[data-geste-fermer]'); if (fermer) fermer.addEventListener('click', () => { geste6 = null; geste6Etat = null; clearInterval(aussiMinuterie); rendre(); });
    // Prix
    R.querySelectorAll('[data-prix-nouveau]').forEach((c) => { c.addEventListener('input', () => { geste6.prix[c.getAttribute('data-prix-nouveau')] = c.value; }); c.addEventListener('change', () => { if (geste6 && geste6.pp && geste6.pp.par) rendre(); }); });   // 5.432 : les autres sites suivent le prix tapé
    R.querySelectorAll('[data-prix-pct]').forEach((b) => b.addEventListener('click', () => { const p = Number(b.getAttribute('data-prix-pct')); const toutes = (listes.annonces && listes.annonces.toutes) || [];
      for (const id of geste6.ids) { const x = toutes.find((y) => y.id === id); if (x && Number(x.prix) > 0) geste6.prix[id] = (Math.round(Number(x.prix) * (100 - p)) / 100).toFixed(2).replace('.', ','); } rendre(); }));
    const hOui = R.querySelector('[data-prix-hausse-oui]'); if (hOui) hOui.addEventListener('click', () => { geste6.hausseConf = null; geste6.hausseOk = true; confirmerPrix6(); });   // (20 nov.) la même fonction, jamais un clic simulé (audit-confiance-publique G5)
    const hNon = R.querySelector('[data-prix-hausse-non]'); if (hNon) hNon.addEventListener('click', () => { geste6.hausseConf = null; rendre(); });
    { const t6 = R.querySelector('[data-pp-tous]'); if (t6) t6.addEventListener('change', () => { geste6.tous = !!t6.checked; rendre(); }); }
    R.querySelectorAll('[data-pp-ajuste]').forEach((b) => b.addEventListener('click', () => { geste6.ajuste = b.getAttribute('data-pp-ajuste'); rendre(); }));
    { const n6 = R.querySelector('[data-pp-n]'); if (n6) n6.addEventListener('change', () => { geste6.plusN = Math.max(1, Math.min(50, Math.round(Number(n6.value)) || 10)); rendre(); }); }
    { const go = R.querySelector('[data-garde-oui]'); if (go) go.addEventListener('click', () => { geste6.gardeOk = Object.assign({}, geste6.gardeOk || {}); for (const c of geste6.gardeConf || []) geste6.gardeOk[c.site + ':' + c.id] = c.prixC; geste6.gardeConf = null; geste6.aa = true; confirmerPrix6(); }); }
    { const gn = R.querySelector('[data-garde-non]'); if (gn) gn.addEventListener('click', () => { geste6.gardeConf = null; geste6.gardeOk = null; geste6.aa = false; rendre(); }); }
    const confirmerPrix6 = () => {
      const toutes = (listes.annonces && listes.annonces.toutes) || [];
      const siteIci = /leboncoin\.fr$/i.test(location.hostname) ? 'leboncoin' : /vestiairecollective\.com$/i.test(location.hostname) ? 'vestiaire' : 'vinted';
      const ok6 = (st, id, prix) => { const c = geste6.gardeOk && geste6.gardeOk[st + ':' + id]; return Number.isInteger(c) && c === Math.round(Number(prix) * 100) ? { gardeConfirmeC: c } : {}; };
      const items = geste6.ids.map((id) => { const x = toutes.find((y) => y.id === id) || {}; const pr = String(geste6.prix[id] || '').replace(',', '.'); return { id, prix: pr, prixVu: x.prix, num: x.num || '', ...ok6(siteIci, id, pr) }; }).filter((x) => x.prix);
      // 5.432 : « sur tous les sites » — les autres sites de chaque annonce (relus par le fond PAR IDENTITÉ avant d'agir).
      if (ppTous6()) for (const it of items.slice()) { const p = prixSaisi6(it.prix); if (!p) continue; for (const a of ppAgissables6(it.id)) { const pa = ppPrix6(a.site, p); items.push({ id: a.id, site: a.site, source: it.id, prix: String(pa), prixVu: a.prix, num: it.num, ...ok6(a.site, a.id, pa) }); } }
      if (!items.length) { geste6Etat = { ok: false, texte: TU('g6_prix_vide') }; rendre(); return; }
      // 5.423 : la première fois, la feuille Avant | Après (rien ne part) ; « Lancer » depuis la feuille envoie.
      if (!geste6.aa) { geste6.aa = true; geste6Etat = null; rendre(); return; }
      // Une HAUSSE se confirme d'abord (« Monter à X € ? ») — jamais automatique.
      const hausses = items.filter((x) => Number(x.prix) > Number(x.prixVu));
      if (hausses.length && !geste6.hausseOk) { geste6.hausseConf = hausses; geste6.items = items; rendre(); return; }
      geste6.hausseOk = false;
      geste6.aa = false;
      envoyer6({ action: 'prixCarte', items, confirme: true, ...(hausses.length ? { hausseConfirmee: true } : {}) }, (r) => {
        // 5.432 (`gardeprix`) : un prix suspect ⇒ RIEN n'est parti ; la feuille Avant | Après revient avec SA confirmation du chiffre.
        if (r && r.code === 'garde-confirmer' && Array.isArray(r.aConfirmer) && r.aConfirmer.length) { geste6.aa = true; geste6.gardeConf = r.aConfirmer; geste6Etat = null; return; }
        const n = r && Array.isArray(r.ranges) ? r.ranges.length : 0; const ref = r && Array.isArray(r.refus) ? r.refus : [];
        const att = r && Array.isArray(r.attente) ? [...new Set(r.attente.map((a) => a.site))] : [];
        geste6Etat = { ok: n > 0 && !ref.length, texte: TU('g6_prix_resultat', { n, r: ref.length }) + (ref.length ? ' — ' + ref.map((x) => x.code === 'plancher' ? TU('g6_sous_plancher', { p: euroTxt(x.plancher) }) : x.code === 'hausse-confirmer' ? TU('g6_hausse') : x.code === 'dit-vestiaire' ? TU('pp_dit_vc') : (x.raison || x.code)).join(' · ') : '')
          + att.map((st) => ' · ' + TU('pp_attente', { site: NOM_SITE6[st] || st })).join('') };
        geste6.gardeOk = null;
        if (n) chargerListes(true); });
    };
    const pc = R.querySelector('[data-prix-confirmer]'); if (pc) pc.addEventListener('click', confirmerPrix6);
    // Atelier
    R.querySelectorAll('[data-atelier-haut],[data-atelier-bas]').forEach((b) => b.addEventListener('click', () => { const h = b.hasAttribute('data-atelier-haut'); const i = Number(b.getAttribute(h ? 'data-atelier-haut' : 'data-atelier-bas')); const j = h ? i - 1 : i + 1; const l = geste6.ids; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; rendre(); }));
    R.querySelectorAll('[data-atelier-mode]').forEach((b) => b.addEventListener('click', () => { geste6.mode = b.getAttribute('data-atelier-mode'); if (geste6.mode === 'aleatoire' && !(geste6.max > geste6.min)) geste6.max = geste6.min + 3; rendre(); }));
    const am = R.querySelector('[data-atelier-min]'); if (am) am.addEventListener('change', () => { geste6.min = Math.max(1, Math.min(120, Math.round(Number(am.value)) || 1)); rendre(); });
    const ax = R.querySelector('[data-atelier-max]'); if (ax) ax.addEventListener('change', () => { geste6.max = Math.max(1, Math.min(120, Math.round(Number(ax.value)) || 1)); rendre(); });
    R.querySelectorAll('[data-atelier-photo]').forEach((c) => c.addEventListener('input', () => { geste6.photo[c.getAttribute('data-atelier-photo')] = Number(c.value); const o = c.parentNode.querySelector('output'); if (o) o.textContent = c.value; }));
    const al = R.querySelector('[data-atelier-lettre]'); if (al) al.addEventListener('change', () => { geste6.lettre = al.checked; });
    R.querySelectorAll('[data-atelier-question]').forEach((c) => c.addEventListener('change', () => { if (!c.value) return; const id = c.getAttribute('data-atelier-question'); atelierVerifier6([id], { [id]: { [c.getAttribute('data-champ')]: c.value } }); }));
    R.querySelectorAll('[data-atelier-retirer]').forEach((b) => b.addEventListener('click', () => { const id = b.getAttribute('data-atelier-retirer'); geste6.ids = geste6.ids.filter((x) => x !== id); atelierVerifier6([], null); }));
    R.querySelectorAll('[data-atelier-quand-choix]').forEach((b) => b.addEventListener('click', () => { geste6.quand = b.getAttribute('data-atelier-quand-choix'); geste6.progConf = false; geste6Etat = null; rendre(); }));
    const aat = R.querySelector('[data-atelier-at]'); if (aat) { const poser = () => { geste6.at = aat.value; geste6.progConf = false; }; aat.addEventListener('input', poser); aat.addEventListener('change', () => { poser(); rendre(); }); }
    const pNon = R.querySelector('[data-atelier-prog-non]'); if (pNon) pNon.addEventListener('click', () => { geste6.progConf = false; rendre(); });
    const pOui = R.querySelector('[data-atelier-prog-oui]'); if (pOui) pOui.addEventListener('click', () => {
      const g = geste6; const at = atDe6(g.at);
      envoyer6({ action: 'atelierProgrammer', ids: g.ids.slice(), espacement: { mode: g.mode, min: g.min, max: g.mode === 'aleatoire' ? g.max : g.min }, photo: Object.assign({}, g.photo), lettre: g.lettre === true, at, confirme: true }, (r) => {
        if (r && r.ok) { geste6 = null; geste6Etat = null; annSel.clear(); chargerListes(true); } else { g.progConf = false; geste6Etat = { ok: false, texte: r && r.code === 'precieux' ? TU('pr_b_repub') : (r && r.raison) || TU('ra_ko') }; } });
    });
    const pAn = R.querySelector('[data-atelier-prog-annuler]'); if (pAn) pAn.addEventListener('click', () => envoyer6({ action: 'atelierProgAnnuler' }, () => chargerListes(true)));
    const pEf = R.querySelector('[data-atelier-prog-effacer]'); if (pEf) pEf.addEventListener('click', () => envoyer6({ action: 'atelierProgAnnuler' }, () => chargerListes(true)));
    const pRe = R.querySelector('[data-atelier-prog-relancer]'); if (pRe) pRe.addEventListener('click', () => envoyer6({ action: 'atelierProgRelancer', confirme: true }, (r) => { if (!(r && r.ok)) geste6Etat = { ok: false, texte: (r && r.raison) || TU('ra_ko') }; chargerListes(true); }));
    const aaR = R.querySelector('[data-aa-retour]'); if (aaR) aaR.addEventListener('click', () => { if (geste6) { geste6.aa = false; geste6.hausseConf = null; } rendre(); });
    const la = R.querySelector('[data-atelier-lancer]'); if (la) la.addEventListener('click', () => {
      const g = geste6;
      // « Programmer à … » : l'heure qu'IL a tapée, vérifiée ici (2 min à 7 jours), puis la phrase à confirmer.
      if (g.quand === 'programmer') { const at = atDe6(g.at); if (at == null || at < Date.now() + PROG_AVANCE_MIN || at > Date.now() + PROG_AVANCE_MAX) { geste6Etat = { ok: false, texte: TU('g6_prog_heure_ko') }; rendre(); return; } geste6Etat = null; g.progConf = true; rendre(); return; }
      if (!g.aa) { g.aa = true; geste6Etat = null; rendre(); return; }   // 5.423 : d'abord la feuille Avant | Après (« Republier maintenant »)
      envoyer6({ action: 'atelierLancer', ids: g.ids.slice(), espacement: { mode: g.mode, min: g.min, max: g.mode === 'aleatoire' ? g.max : g.min }, photo: Object.assign({}, g.photo), lettre: g.lettre === true, confirme: true }, (r) => {
        if (r && r.ok) { geste6 = null; geste6Etat = null; annSel.clear(); chargerListes(true); } else geste6Etat = { ok: false, texte: r && r.code === 'precieux' ? TU('pr_b_repub') : (r && r.raison) || TU('ra_ko') }; });   // 5.438 : « compte précieux » dit dans SA langue
    });
    R.querySelectorAll('[data-atelier-reprendre]').forEach((b) => b.addEventListener('click', () => envoyer6({ action: 'atelierReprendre', id: b.getAttribute('data-atelier-reprendre'), confirme: true }, () => chargerListes(true))));
    { const vr = R.querySelector('[data-atelier-verif-reprendre]'); if (vr) vr.addEventListener('click', () => envoyer6({ action: 'atelierVerifReprendre', confirme: true }, () => chargerListes(true))); }   // 5.437
    const aa = R.querySelector('[data-atelier-arreter]'); if (aa) aa.addEventListener('click', () => envoyer6({ action: 'atelierArreter' }, () => chargerListes(true)));
    // Publier
    R.querySelectorAll('[data-publier-site]').forEach((b) => b.addEventListener('click', () => { geste6.site = b.getAttribute('data-publier-site'); geste6.questions = []; geste6.problemes = []; geste6Etat = null; rendre(); }));
    R.querySelectorAll('[data-publier-rep]').forEach((c) => c.addEventListener('change', () => { geste6.reponses[c.getAttribute('data-publier-rep')] = c.value; }));
    const pe = R.querySelector('[data-publier-envoyer]'); if (pe) pe.addEventListener('click', () => {
      const g = geste6; const rep = Object.fromEntries(Object.entries(g.reponses).filter(([, v]) => v));
      const x6 = (((listes && listes.annonces && listes.annonces.toutes) || []).find((y) => y.id === g.id)) || {};
      pmPoser6(g, [{ num: x6.num || '', item: g.id, titre: x6.titre || '', prix: x6.prix }], () => envoyer6({ action: 'publierCarte', site: g.site, id: g.id, ...(Object.keys(rep).length ? { reponses: rep } : {}), ...(g.problemes && g.problemes.length ? { verifVu: true } : {}) }, (r) => {
        if (r && r.accepte) { geste6Etat = { ok: true, texte: TU('g6_publie') }; g.problemes = []; g.questions = []; }
        else if (r && r.code === 'questions') { g.questions = r.questions || []; geste6Etat = { ok: false, texte: TU('g6_questions') }; }
        else if (r && r.code === 'verification') { g.problemes = r.problemes || []; geste6Etat = { ok: false, texte: TU('g6_verifier') }; }
        else geste6Etat = { ok: false, texte: (r && r.raison) || TU('ra_ko') }; }));
    });
    // Offres
    R.querySelectorAll('[data-offre-contre-prix]').forEach((c) => c.addEventListener('input', () => { offreContre[c.getAttribute('data-offre-contre-prix')] = c.value; }));
    R.querySelectorAll('[data-offre-quoi]').forEach((b) => b.addEventListener('click', () => { const k = b.closest('[data-offre]').getAttribute('data-offre'); const quoi = b.getAttribute('data-offre-quoi');
      if (quoi === 'contre') { const [tx, oid] = k.split(':'); envoyer6({ action: 'offreCarte', quoi: 'contre', tx, oid, prix: String(offreContre[k] || '').replace(',', '.'), confirme: true }, (r) => { offreEtat = { ok: !!(r && r.ok), texte: r && r.ok ? TU('g6_contre_ok') : (r && r.raison) || TU('ra_ko') }; if (r && r.ok) chargerListes(true); }); return; }
      offreConf = { k, quoi }; offreEtat = null; rendre(); }));
    const on = R.querySelector('[data-offre-non]'); if (on) on.addEventListener('click', () => { offreConf = null; rendre(); });
    const oo = R.querySelector('[data-offre-oui]'); if (oo) oo.addEventListener('click', () => { const c = offreConf; if (!c) return; const [tx, oid] = c.k.split(':');
      envoyer6({ action: 'offreCarte', quoi: c.quoi, tx, oid, confirme: true, ...(c.avisGarde ? { avisVu: true } : {}), ...(c.noteAvis ? { noteVue: true } : {}) }, (r) => {
        if (r && r.ok) { offreConf = null; offreEtat = { ok: true, texte: TU(c.quoi === 'accept' ? 'g6_accepte_ok' : 'g6_refuse_ok') }; chargerListes(true); }
        else if (r && r.code === 'avis') { offreConf = Object.assign({}, c, { avis: r.avis || r.raison, avisGarde: true, noteAvis: false }); }
        // 5.430 : la note de l'acheteur (≤ SON seuil, compte neuf qu'il n'accepte pas, ou pas lue) — SON second toucher accepte quand même.
        else if (r && r.code === 'note') { const n = r.note || {}; offreConf = Object.assign({}, c, { noteAvis: true, avis: TU(r.decision === 'basse' ? 'na_avis_basse' : r.decision === 'neuf-refuse' ? 'na_avis_neuf' : 'na_avis_pas_su', { e: etoiles6(n.etoiles), n: n.n, s: etoiles6(r.seuil) }) }); }
        else if (r && r.code === 'vendue-ailleurs') { offreConf = Object.assign({}, c, { avis: r.avis || r.raison, bloque: true }); }
        else { offreConf = null; offreEtat = { ok: false, texte: (r && r.raison) || TU('ra_ko') }; } }); });
  }
  let annStatut = 'en_vente', annVue = 'liste', annCols = new Set(COLS5_DEFAUT), annSel = new Set(), annCherche = '', annColsOuvert = false;
  try { chrome.storage.local.get(['vrmPanneauAnnonces'], (g) => { try { void chrome.runtime.lastError; } catch (_) {} const v = g && g.vrmPanneauAnnonces; if (v && typeof v === 'object') { if (v.vue === 'grille' || v.vue === 'liste') annVue = v.vue; if (Array.isArray(v.cols)) annCols = new Set(v.cols.filter((c) => COLS6.includes(c))); } }); } catch (_) {}
  const garderAnn = () => ranger({ vrmPanneauAnnonces: { vue: annVue, cols: [...annCols] } });
  const celluleAnn = (x, c) => {
    if (c === 'num') return x.num ? plaque(x.num) : '—';
    if (c === 'prix') return esc(eurosL(x.prix));
    if (c === 'mini') return Number(x.mini) > 0 ? esc(eurosL(x.mini)) : '—';
    if (c === 'achat') return Number(x.achat) > 0 ? esc(eurosL(x.achat)) : '—';
    if (c === 'date') return x.jours != null ? esc(TU('p_jours', { n: x.jours })) : '—';
    if (c === 'vues') return x.vues != null ? esc(String(x.vues)) : '—';
    if (c === 'favoris') return x.favoris != null ? esc(String(x.favoris)) + ' ♥' : '—';
    if (c === 'place') return x.place ? esc(x.place) : '—';
    if (c === 'statut') return `<span class="st5" data-statut="${esc(x.statut || '')}">${esc(libStatut5(x.statut || 'a_confirmer'))}</span>`;
    return '';
  };
  // ══ 5.410 (Julien, 20 nov. : « pour l'extension, tu fais pareil que Vintex ») — ARTICLES EN TABLEAU ═══════════════
  //    « Choisir une action ▾ », recherche, « Statut ▾ » (cases À COMPTEURS lus), « N articles », liste ⇄ grille,
  //    « Colonnes ▾ » (mémorisé) ; tableau : case | vignette 48 + titre (N° en plaque) | colonnes triables ↑↓ alignées à
  //    droite | Statut en étiquette douce | ⋯ (la fiche). Rien ne part d'ici sans SON toucher de confirmation.
  const dateCourte5 = (t) => { const n = Number(t); if (!(n > 0)) return '—'; try { const d = new Date(n); const p = (x) => String(x).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; } catch (_) { return '—'; } };
  const jourCourt5 = (t) => dateCourte5(t).split(' ')[0];
  let annStatuts = null, annStatutOuvert = false, annTri = { col: 'date', sens: -1 };
  const valeurTri5 = (x, c) => (c === 'prix' ? Number(x.prix) || 0 : c === 'date' ? Number(x.depuis) || 0 : c === 'vues' ? Number(x.vues) || 0 : c === 'favoris' ? Number(x.favoris) || 0 : c === 'mini' ? Number(x.mini) || 0 : c === 'achat' ? Number(x.achat) || 0 : c === 'statut' ? String(x.statut || '') : c === 'num' ? String(x.num || '') : String(x.titre || '').toLowerCase());
  const trier5 = (l, tri) => l.slice().sort((a, b) => { const va = valeurTri5(a, tri.col), vb = valeurTri5(b, tri.col); return (va > vb ? 1 : va < vb ? -1 : 0) * tri.sens; });
  const etiquette5 = (k, texte, ton) => `<span class="et6" data-statut="${esc(k)}"${ton ? ` data-ton="${ton}"` : ''}>${esc(texte)}</span>`;
  const enTeteTri5 = (c, libelle, attrTri) => `<button type="button" class="th6" ${attrTri}="${c}" aria-sort="${annTri.col === c ? (annTri.sens > 0 ? 'ascending' : 'descending') : 'none'}">${esc(libelle)}<i aria-hidden="true">${annTri.col === c ? (annTri.sens > 0 ? '↑' : '↓') : '↕'}</i></button>`;
  // 5.410.2 (Julien, 20 nov. : « je ne comprends pas ce qu'est le statut "à confirmer", ça veut rien dire ») : la
  // RÈGLE <enligne-regle> ne change pas (lecture complète de plus de 24 h ⇒ ni « en ligne » ni « partie ») ; ce qu'on
  // MONTRE dit ce qui se passe : « Pas revue depuis 3 j », et UNE fois, en tête du groupe, le geste.
  const joursDepuis5 = (t) => { const ms = Date.now() - Number(t || 0); return t && isFinite(ms) && ms >= 0 ? Math.max(1, Math.floor(ms / 86400000)) : null; };
  function libStatut5(k) {
    if (k !== 'a_confirmer') return TU('s_' + k);
    const n = joursDepuis5(listes && listes.annonces && listes.annonces.lu);
    return n ? TU('s_pas_revue_j', { n }) : TU('s_pas_revue');
  }
  function noteRevue5(a) {
    if (!a || !(a.statuts ? a.statuts.a_confirmer > 0 : a.aConfirmer)) return '';
    return `<p class="note5 revue6" data-pas-revue="${a.relecture ? 'relecture' : 'geste'}">${esc(TU(a.relecture ? 's_relecture' : 's_ouvre_compte'))}</p>`;
  }
  function annoncesGrandHtml(e) {
    const a = listes.annonces;
    const ici = ORIGINE_ICI || 'https://www.vinted.fr';
    const st = a.statuts || null;
    const q = annCherche.trim().toLowerCase();
    const toutes = Array.isArray(a.toutes) ? a.toutes : a.liste.map((x) => Object.assign({ statut: a.aConfirmer ? 'a_confirmer' : 'en_vente' }, x));
    const choisis = annStatuts || new Set(STATUTS5);
    const vus = trier5(toutes.filter((x) => choisis.has(x.statut || 'a_confirmer') && (!q || String(x.titre).toLowerCase().includes(q) || String(x.num || '').toLowerCase() === q)), annTri);
    for (const id of [...annSel]) if (!toutes.some((x) => x.id === id)) annSel.delete(id);
    const nSel = [...annSel].length;
    const cols = COLS6.filter((c) => annCols.has(c));
    const site = (e && e.plateforme) || 'vinted';
    const gestes = site === 'leboncoin' ? ['baisser', 'supprimer', 'ouvrir'] : site === 'vestiaire' ? ['baisser', 'ouvrir'] : ['republier_direct', 'republier', 'baisser', 'aussi', 'masquer', 'afficher', 'favoris', 'ouvrir'];
    const actions = `<select class="act5" data-ann-action aria-label="${esc(TU('a_choisir'))}"${nSel ? '' : ' disabled'}><option value="">${esc(nSel ? TU('a_choisir_n', { n: nSel }) : TU('a_choisir'))}</option>`
      + gestes.map((k) => `<option value="${k}"${((k === 'ouvrir' || k === 'supprimer' || k === 'publier') && nSel !== 1) || ((k === 'masquer' || k === 'afficher' || k === 'aussi') && nSel > 10) ? ' disabled' : ''}${annActionPre === k ? ' selected' : ''}>${esc(TU('ac_' + k))}</option>`).join('') + '</select>';
    const statutMenu = `<details class="cols5 statut6" data-ann-statut-menu${annStatutOuvert ? ' open' : ''}><summary>${esc(TU('a_statut'))}${annStatuts ? ` · ${annStatuts.size}` : ''}</summary><div class="cols5-l">${STATUTS5.filter((k) => k !== 'a_confirmer' || (st && st.a_confirmer)).map((k) => `<label><input type="checkbox" data-ann-statut="${k}"${choisis.has(k) ? ' checked' : ''}> <span>${esc(TU(k === 'a_confirmer' ? 's_pas_revues' : 's_' + k))}</span><b>${st ? Number(st[k] || 0).toLocaleString('fr-FR') : '—'}</b></label>`).join('')}</div></details>`;
    const outils = `<div class="barre5 barre6">${actions}<input type="search" class="cherche5" data-ann-cherche placeholder="${esc(TU('a_chercher'))}" aria-label="${esc(TU('a_chercher'))}" value="${esc(annCherche)}">${statutMenu}</div>`
      + (st ? '' : `<div class="val gris" data-statuts-pas-su>${esc(TU('a_statuts_pas_su'))}</div>`) + noteRevue5(a);
    const ligneN = `<div class="n6"><span data-ann-n="${vus.length}">${esc(TU('a_n_articles', { n: vus.length }))}</span><span class="n6-d"><span class="vu-seg vue5" role="group" aria-label="${esc(TU('a_vue'))}"><button type="button" data-ann-vue="liste" aria-pressed="${annVue === 'liste'}" aria-label="${esc(TU('a_liste'))}">☰</button><button type="button" data-ann-vue="grille" aria-pressed="${annVue === 'grille'}" aria-label="${esc(TU('a_grille'))}">▦</button></span>`
      + `<details class="cols5" data-ann-cols${annColsOuvert ? ' open' : ''}><summary>${esc(TU('a_colonnes'))}</summary><div class="cols5-l">${COLS6.map((c) => `<label><input type="checkbox" data-ann-col="${c}"${annCols.has(c) ? ' checked' : ''}> ${esc(TU('c5_' + c))}</label>`).join('')}</div></details></span></div>`;
    // 5.410 : supprimer sur Leboncoin — LA confirmation de l'app (recopiée dans le fond : titre, l'annonce, ce qui reste,
    //    « sans retour »), rendue par le fond lui-même ; « Oui, supprimer de Leboncoin » renvoie avec `sansRetour`.
    const cs = annConfirme && annConfirme.k === 'supprimer' && annConfirme.conf ? annConfirme.conf : null;
    const conf = cs ? `<div class="conf5" role="alertdialog" data-ann-confirme="supprimer" data-irreversible><p><b>${esc(cs.titre)}</b></p>${(cs.lignes || []).map((l) => `<p>${esc(l)}</p>`).join('')}<p class="note5">${esc(cs.reste || '')}</p><p><b>${esc(cs.sansRetour || '')}</b></p><div class="outils"><button type="button" class="vu-btn vu-plein" data-ann-confirme-ok${annEnVol ? ' disabled' : ''}>${esc(cs.ok)}</button><button type="button" class="vu-btn vu-sec" data-ann-confirme-non>${esc(TU('a_annuler'))}</button></div></div>`
      : annConfirme ? `${U.MODIF && (annConfirme.k === 'masquer' || annConfirme.k === 'afficher') ? `<div class="aa6" data-ann-aa>${U.MODIF.avantApresHtml(lignesMasquer6(annConfirme))}</div>` : ''}<div class="conf5" role="alertdialog" data-ann-confirme="${esc(annConfirme.k)}"><span>${esc(TU(annConfirme.k === 'masquer' ? 'a_conf_masquer' : 'a_conf_afficher', { n: annConfirme.ids.length }))}</span><button type="button" class="vu-btn vu-plein" data-ann-confirme-ok${annEnVol ? ' disabled' : ''}>${esc(TU(annConfirme.k === 'masquer' ? 'ac_masquer' : 'ac_afficher'))}</button><button type="button" class="vu-btn vu-sec" data-ann-confirme-non>${esc(TU('a_annuler'))}</button></div>` : '';   // 5.423 : l'avant / après de chaque annonce AVANT les boutons
    const res = annResultat ? `<div class="${annResultat.ok ? 'val' : 'err'}" role="status" data-ann-resultat="${annResultat.ok ? 'ok' : 'ko'}">${esc(annResultat.texte)}</div>` : '';
    const tout = vus.length && vus.every((x) => annSel.has(x.id));
    const depot = depotVue();
    if (depot && site === 'vinted') depot.charger(false);
    const haut = (depot && site === 'vinted' ? depot.depotHtml(site) : '') + outils + aussiIciHtml6() + conf + res + suiviModif6Html(!!(listes && listes.atelier && Array.isArray(listes.atelier.ids))) + atelierEtatHtml() + geste6Html() + interessesLbcHtml() + ligneN;
    if (!vus.length) return haut + `<div class="val gris vide6" data-annonces-filtre="0">${esc(TU('a_aucune'))}</div>`;
    if (annVue === 'grille') {
      return haut + `<label class="tout5"><input type="checkbox" data-ann-tout${tout ? ' checked' : ''}> ${esc(TU('a_tout'))}</label><ul class="grille5" data-annonces="${vus.length}" data-vue="grille">${vus.map((x) => `<li${annSel.has(x.id) ? ' data-coche' : ''}><label class="case5"><input type="checkbox" data-ann-sel="${esc(x.id)}"${annSel.has(x.id) ? ' checked' : ''} aria-label="${esc(x.titre || '')}"></label><button type="button" class="carte5" data-annonce="${esc(x.id)}" data-fiche-b="a:${esc(x.id)}">${x.photo ? `<img src="${esc(x.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="vig"></span>'}<span class="ti">${esc(x.titre || '')}</span><span class="me">${x.num ? plaque(x.num) : ''} ${esc(eurosL(x.prix))} · ${etiquette5(x.statut || '', TU('s_' + (x.statut || 'a_confirmer')))}</span></button></li>`).join('')}</ul>`
        + (ficheOuverte.startsWith('a:') ? (() => { const x = vus.find((y) => 'a:' + y.id === ficheOuverte); return x ? ficheAnnonceHtml(x, ici) : ''; })() : '');
    }
    const cellule = (x, c) => {
      if (c === 'prix') return `<b>${esc(eurosL(x.prix))}</b>`;
      if (c === 'date') return x.depuis ? (x.depuisAuMoins ? `<span data-date-au-moins title="${esc(TU('g6_au_moins_note'))}">${esc(TU('g6_au_moins', { d: dateCourte5(x.depuis) }))}</span>` : esc(dateCourte5(x.depuis))) : '—';
      if (c === 'statut') return etiquette5(x.statut || '', libStatut5(x.statut || 'a_confirmer'), x.statut === 'brouillon' ? 'ambre' : '');   // 5.410.2 : « pas revue » est gris (rien à faire ici)
      return celluleAnn(x, c);
    };
    const enTete = `<div class="tr6 th6r" style="--n6:${cols.length};--g6:${cols.map((c) => W6[c] || '96px').join(' ')}"><label class="case5"><input type="checkbox" data-ann-tout${tout ? ' checked' : ''} aria-label="${esc(TU('a_tout'))}"></label>${enTeteTri5('titre', TU('c5_article'), 'data-ann-tri')}<span class="cels6">${cols.map((c) => enTeteTri5(c, TU('c5_' + c), 'data-ann-tri')).join('')}</span><span></span></div>`;
    return haut + `<div class="table6" data-annonces="${vus.length}" data-vue="liste" data-cols="${cols.join(' ')}" data-tri="${annTri.col}:${annTri.sens}">${enTete}<ul class="rangs" data-defil="annonces">${vus.map((x) => `<li${ficheOuverte === 'a:' + x.id ? ' data-ouverte' : ''}${annSel.has(x.id) ? ' data-coche' : ''}><div class="tr6" style="--n6:${cols.length};--g6:${cols.map((c) => W6[c] || '96px').join(' ')}"><label class="case5"><input type="checkbox" data-ann-sel="${esc(x.id)}"${annSel.has(x.id) ? ' checked' : ''} aria-label="${esc(x.titre || '')}"></label><button type="button" class="art6" data-annonce="${esc(x.id)}" data-statut="${esc(x.statut || '')}" data-fiche-b="a:${esc(x.id)}" aria-expanded="${ficheOuverte === 'a:' + x.id}">${vignette(x.photo)}<span class="ti">${x.num ? plaque(x.num) + ' ' : ''}${esc(x.titre || '')}</span></button><span class="cels6">${cols.map((c) => `<span class="cel6" data-col="${c}"><i class="lc5">${esc(TU('c5_' + c))}</i>${cellule(x, c)}</span>`).join('')}</span><button type="button" class="plus6" data-fiche-b="a:${esc(x.id)}" aria-label="${esc(TU('a_plus'))}">⋯</button></div>${ficheOuverte === 'a:' + x.id ? ficheAnnonceHtml(x, ici) : ''}</li>`).join('')}</ul></div>`;
  }
  // ══ 5.410 — COMMANDES (= les ventes) EN TABLEAU, comme Vintex : article + statut DE VINTED en sous-titre, Prix, Date,
  //    Transporteur (son logo, la copie de l'app ; rien relié ⇒ « — », jamais « inconnu »), état en étiquette (« Action
  //    requise » en ambre, le reste neutre), ⋯ (la fiche). « Choisir une action » : ouvrir la conversation, voir dans VRM.
  const COLS_V6 = ['prix', 'date', 'transporteur', 'limite', 'statut', 'bordereau'];
  // ══ 5.410.2 — LE BORDEREAU ET LE LIVREUR DE CHAQUE VENTE (Julien, 20 nov. : « quand j'ai fait une vente, on doit
  // pouvoir imprimer le bordereau, avoir le livreur ») ═══════════════════════════════════════════════════════════
  // Transporteur (SON logo + nom), n° de suivi et date limite LUS (e-mail du bordereau, suivi) — jamais devinés ;
  // « Imprimer le bordereau » ouvre le PDF que VRM a déjà rangé (`bordereauCarte` : lecture seule, compte de l'onglet,
  // aucune requête vers Vinted, rien d'acheté) ; « Imprimer les N » pour une sélection (un fichier par bordereau).
  // Vinted ne l'a pas encore fourni ⇒ « Pas encore de bordereau », dit ; la base muette ⇒ « pas su », dit.
  const venSel = new Set();
  let impEtat = null, impEnVol = false;
  const imprimable = (x) => !!(x && listes && listes.plateforme === 'vinted' && x.etat === 'a_expedier' && x.bordereau === true && /^\d{1,20}$/.test(String(x.tx || '')));   // Leboncoin / Vestiaire : leurs bordereaux restent sur le site
  const transpHtml6 = (x, taille) => (x.transporteurCle && U.logoTransp ? `<span class="tr-l6">${U.logoTransp(x.transporteurCle, taille || 18)}<span>${esc(x.transporteur || U.nomTransp(x.transporteurCle))}</span></span>` : x.transporteur ? `<span class="tr-l6"><span>${esc(x.transporteur)}</span></span>` : '<span class="gris6">—</span>')
    + (x.suivi ? `<small class="suivi6" data-suivi="${esc(x.suivi)}">${esc(x.suivi)}</small>` : '');
  // « 23/11/2026 10 h 00 » ⇒ « 23/11 · 10 h 00 » dans la colonne (l'en-tête dit « Date limite ») ; le texte lu entier en titre.
  const limiteCourte6 = (t) => { const m = /^(\d{1,2})\/(\d{1,2})\/\d{4}\s*(.*)$/.exec(String(t || '').trim()); return m ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}${m[3] ? ' · ' + m[3] : ''}` : String(t || ''); };
  const limiteHtml6 = (x, long) => (x.limite ? `<span class="lim6" data-limite title="${esc(x.limite)}">${esc(long ? TU('v_avant', { d: x.limite }) : limiteCourte6(x.limite))}</span>` : '<span class="gris6">—</span>');
  function boutonImp6(x, court) {
    if (imprimable(x)) return `<button type="button" class="imp6" data-imprimer="${esc(x.tx)}"${impEnVol ? ' disabled' : ''}${court ? ` aria-label="${esc(TU('imp_un'))}" title="${esc(TU('imp_un'))}"` : ''}><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M7 8V3.5h10V8M7 17H4.5V9.5a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5V17H17"/><path d="M7 13.5h10v7H7z"/></svg><span>${esc(TU(court ? 'imp_court' : 'imp_un'))}</span></button>`;
    if (x && listes && listes.plateforme === 'vinted' && x.etat === 'a_expedier' && x.bordereau === false) return `<span class="pas6" data-bordereau-manque="${esc(x.tx)}" title="${esc(TU('imp_pas_note'))}">${esc(TU('imp_pas'))}</span>`;
    return '<span class="gris6">—</span>';
  }
  function pdfDepuisB64(b64) { const bin = atob(String(b64 || '')); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Blob([u8], { type: 'application/pdf' }); }
  // 5.420 (`bordereauxunpdf`, Julien, 21 nov.) : deux bordereaux ou plus ⇒ UN fichier (une étiquette par page, l'ordre de la
  // sélection), ouvert dans un onglet pour l'impression. Le fond rend les PDF déjà rangés et charge la bibliothèque PDF
  // (`vrm-pdf.js`, pdf-lib) dans CET onglet ; un bordereau illisible n'entre pas dans le fichier : il s'ouvre seul, dit.
  // Bibliothèque absente (navigateur qui refuse) ⇒ les fichiers un par un, comme avant, et c'est dit.
  async function unSeulPdf(r) {
    const A = globalThis.__vrmAssemblerPdf;
    if (!r || r.assembler !== true || typeof A !== 'function') return null;
    try { const x = await A((r.pdfs || []).map((p) => ({ tx: String(p.tx), b64: p.b64 }))); return x && (x.ok || x.code === 'illisibles') ? x : null; } catch (_) { return null; }
  }
  // 5.450 (§3, audit-confiance-publique G5) : un fichier pour LUI se télécharge par le service worker (`chrome.downloads`,
  //    permission « downloads » déjà là) ; le contenu voyage en data: (le worker ne lit pas une adresse blob: de la page).
  function telechargerParExtension(blob, nom) {
    try {
      const fr = new FileReader();
      fr.onload = () => { try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'telecharger', url: String(fr.result || ''), nom: String(nom || 'vrm.pdf') }, () => { void chrome.runtime.lastError; }); } catch (_) {} };
      fr.readAsDataURL(blob);
    } catch (_) {}
  }
  function imprimerBordereaux(txs) {
    const ids = [...new Set(txs.map(String).filter((t) => /^\d{1,20}$/.test(t)))].slice(0, 10);
    if (!ids.length || impEnVol) return;
    impEnVol = true; impEtat = { ton: '', texte: TU(ids.length > 1 ? 'imp_un_pdf_en_cours' : 'imp_en_cours', { n: ids.length }) }; rendre();
    // Ouvert DANS le geste (un onglet vide d'abord : le navigateur ne bloque pas la fenêtre), rempli à la réponse.
    let fen = null; try { fen = window.open('', '_blank'); } catch (_) { fen = null; }
    const nomDe = (tx) => { const v = listes && listes.ventes && (listes.ventes.liste || []).find((y) => y.tx === tx); return `bordereau-${v && v.num ? String(v.num).replace(/[^\w-]/g, '') : tx}.pdf`; };
    let premierPris = false;
    const ouvrir = (blob, nom) => {
      let url = ''; try { url = URL.createObjectURL(blob); } catch (_) { return ''; }
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 120000);
      if (!premierPris && fen) { premierPris = true; try { fen.location.href = url; return 'ouvert'; } catch (_) {} }
      // 5.450 : téléchargé par le service worker (`chrome.downloads`), jamais un clic simulé dans la page (§3).
      telechargerParExtension(blob, nom); return 'telecharge';
    };
    const fini = (r, un) => {
      impEnVol = false;
      const pdfs = Array.isArray(r.pdfs) ? r.pdfs : [];
      let ouverts = 0, telecharges = 0, dansUn = 0, pages = 0, unOuvert = false;
      // Les bordereaux qui ne sont PAS dans le fichier unique : illisibles, ou tous si le fichier n'a pas pu être fait.
      const seuls = un ? new Set((un.illisibles || []).map(String)) : null;
      if (un && un.ok) {
        const o = ouvrir(new Blob([un.octets], { type: 'application/pdf' }), `bordereaux-${un.inclus.length}.pdf`);
        if (o) { dansUn = un.inclus.length; pages = un.pages; unOuvert = o === 'ouvert'; }
      }
      for (const p of pdfs) {
        if (un && un.ok && dansUn && !seuls.has(String(p.tx))) continue;
        let blob = null; try { blob = pdfDepuisB64(p.b64); } catch (_) { continue; }
        const o = ouvrir(blob, nomDe(p.tx));
        if (o === 'ouvert') ouverts++; else if (o === 'telecharge') telecharges++;
      }
      if (fen && !premierPris) { try { fen.close(); } catch (_) {} }
      const manque = (r.manque || []).length, passu = (r.passu || []).length, illisibles = un && dansUn ? seuls.size : 0;
      const parts = [];
      if (dansUn) parts.push(TU(unOuvert ? 'imp_un_pdf' : 'imp_un_pdf_telecharge', { n: dansUn, p: pages }));
      else if (ouverts) parts.push(TU('imp_ouvert'));
      if (telecharges) parts.push(TU('imp_telecharges', { n: telecharges }));
      if (illisibles) parts.push(TU('imp_illisibles', { n: illisibles }));
      if (pdfs.length > 1 && !dansUn) parts.push(TU('imp_un_pdf_absent'));
      if (manque) parts.push(TU('imp_manque', { n: manque }));
      if (passu) parts.push(TU('imp_passu'));
      impEtat = { ton: manque || passu || illisibles ? 'ambre' : '', texte: parts.filter(Boolean).join(' · ') || TU('imp_passu'), un: dansUn, pages };
      for (const p of pdfs) venSel.delete(String(p.tx));
      rendre();
    };
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: ids.length > 1 ? 'bordereauxUnPdf' : 'bordereauCarte', txs: ids }, (r) => {
        try { void chrome.runtime.lastError; } catch (_) {}
        if (!r || !r.ok) { impEnVol = false; try { if (fen) fen.close(); } catch (_) {} impEtat = { ton: 'ambre', texte: TU('imp_passu') }; rendre(); return; }
        if (ids.length > 1 && (r.pdfs || []).length > 1) unSeulPdf(r).then((un) => fini(r, un), () => fini(r, null));
        else fini(r, null);
      });
    } catch (_) { impEnVol = false; impEtat = { ton: 'ambre', texte: TU('imp_passu') }; rendre(); }
  }
  function brancherImpression(racine) {
    racine.querySelectorAll('[data-imprimer]').forEach((b) => b.addEventListener('click', (ev) => { ev.stopPropagation(); imprimerBordereaux([b.getAttribute('data-imprimer')]); }));
    const tous = racine.querySelector('[data-imprimer-n]'); if (tous) tous.addEventListener('click', () => imprimerBordereaux(String(tous.getAttribute('data-imprimer-n')).split(',')));
    racine.querySelectorAll('[data-ven-sel]').forEach((c) => c.addEventListener('change', () => { const k = c.getAttribute('data-ven-sel'); if (c.checked) venSel.add(k); else venSel.delete(k); venConfirme = null; rendre(); }));
    // 5.419 : tout sélectionner (les commandes MONTRÉES), filtres rapides, la barre de la sélection.
    const vt = racine.querySelector('[data-ven-tout]'); if (vt) vt.addEventListener('change', () => { racine.querySelectorAll('[data-ven-sel]').forEach((c) => { const k = c.getAttribute('data-ven-sel'); if (vt.checked) venSel.add(k); else venSel.delete(k); }); venConfirme = null; rendre(); });
    racine.querySelectorAll('[data-ven-filtre]').forEach((b) => b.addEventListener('click', () => { venFiltre = b.getAttribute('data-ven-filtre'); venConfirme = null; rendre(); }));
    const vr = racine.querySelector('[data-ven-rien]'); if (vr) vr.addEventListener('click', () => { venSel.clear(); venConfirme = null; rendre(); });
    const vc = racine.querySelector('[data-ven-copier]');
    if (vc) vc.addEventListener('click', () => { const l = selVentes().filter((x) => x.suivi).map((x) => String(x.suivi)); const sans = selVentes().length - l.length; copierTexte(l.join('\n')).then((okC) => { impEtat = okC ? { ton: '', texte: TU('v9_copies', { n: l.length }) + (sans ? ' · ' + TU('v9_sans_suivi', { n: sans }) : '') } : { ton: 'ambre', texte: TU('v9_copie_ko') }; rendre(); }); });
    const vo = racine.querySelector('[data-ven-ouvrir]');
    if (vo) vo.addEventListener('click', () => {
      const ici = ORIGINE_ICI || 'https://www.vinted.fr', l = selVentes().filter((x) => x.conv).slice(0, 5);
      let ouverts = 0; for (const x of l) { try { if (window.open(ici + '/inbox/' + encodeURIComponent(x.conv), '_blank', 'noopener')) ouverts++; } catch (_) {} }
      impEtat = { ton: ouverts < l.length ? 'ambre' : '', texte: TU('v9_ouverts', { n: ouverts }) + (ouverts < l.length ? ' · ' + TU('v9_bloques', { n: l.length - ouverts }) : '') }; rendre();
    });
    const vk = racine.querySelector('[data-ven-commander]'); if (vk) vk.addEventListener('click', () => { venConfirme = { k: 'commander', txs: String(vk.getAttribute('data-ven-commander')).split(',').filter(Boolean) }; rendre(); });
    const vn = racine.querySelector('[data-ven-confirme-non]'); if (vn) vn.addEventListener('click', () => { venConfirme = null; rendre(); });
    const vy = racine.querySelector('[data-ven-confirme-ok]'); if (vy) vy.addEventListener('click', () => { if (venConfirme && venConfirme.k === 'commander') commanderBordereaux(venConfirme.txs); });
  }
  let venStatuts = null, venStatutOuvert = false, venTri = { col: 'date', sens: -1 }, venCherche = '';
  // ══ 5.419 (Julien, 21 nov. : « dans les Commandes, je veux pouvoir sélectionner les commandes et faire des choses
  //    dessus, par exemple sélectionner celles qui ne sont pas encore expédiées pour imprimer les bordereaux ») ════════
  //    · une case sur CHAQUE commande (identité : son n° de transaction), « tout sélectionner » sur le filtre montré ;
  //    · des filtres rapides : À expédier — pas de bordereau · Bordereau prêt · En route · Terminées ;
  //    · une barre sur la sélection : « Imprimer N bordereaux » (les bordereaux DÉJÀ rangés, `bordereauCarte`, lecture
  //      seule ; une commande sans bordereau est DITE, jamais imprimée), « Commander N bordereaux » (Vinted seulement,
  //      à expédier sans bordereau, SON toucher confirmé, la commande d'après-vente `bordereau` — jamais eBay, §2.8),
  //      « Copier les n° de suivi », « Ouvrir sur Vinted ».
  let venFiltre = 'tous', venConfirme = null;
  const FILTRES_V9 = ['tous', 'sans_bord', 'bord_pret', 'en_route', 'terminees'];
  const filtreV9 = (x, k) => (k === 'tous' ? true : k === 'sans_bord' ? x.etat === 'a_expedier' && x.bordereau !== true : k === 'bord_pret' ? x.etat === 'a_expedier' && x.bordereau === true : k === 'en_route' ? x.etat === 'en_route' : k === 'terminees' ? x.etat === 'finalisee' || x.etat === 'annulee' : true);
  // « Commander le bordereau » : Vinted, à expédier, sans bordereau rangé (jamais un autre site : eBay, §2.8).
  const commandable = (x) => !!(x && listes && listes.plateforme === 'vinted' && x.etat === 'a_expedier' && x.bordereau === false && /^\d{1,20}$/.test(String(x.tx || '')));
  function selVentes() { const l = (listes && listes.ventes && listes.ventes.liste) || []; return l.filter((x) => venSel.has(String(x.tx))); }
  function copierTexte(t) {
    const repli = () => { try { const z = document.createElement('textarea'); z.value = t; z.setAttribute('readonly', ''); z.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(z); z.select(); const ok = document.execCommand('copy'); z.remove(); return ok; } catch (_) { return false; } };
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(() => true, () => repli()); } catch (_) {}
    return Promise.resolve(repli());
  }
  function barreVentesHtml(prets) {
    const sel = selVentes(); if (!sel.length) return '';
    const imp = sel.filter(imprimable), sans = sel.filter((x) => x.etat === 'a_expedier' && !imprimable(x)), cmd = sel.filter(commandable), suivis = sel.filter((x) => x.suivi), ouvrables = listes.plateforme === 'vinted' ? sel.filter((x) => x.conv) : [];
    void prets;
    const conf = venConfirme && venConfirme.k === 'commander' ? `<div class="ven6-conf" role="alertdialog" data-ven-confirme="commander"><span>${esc(TU('v9_cmd_conf', { n: venConfirme.txs.length }))}</span><button type="button" class="vu-btn vu-sec" data-ven-confirme-non>${esc(TU('v9_non'))}</button><button type="button" class="vu-btn vu-plein" data-ven-confirme-ok${impEnVol ? ' disabled' : ''}>${esc(TU('v9_cmd_oui'))}</button></div>` : '';
    return `<div class="fav6-bas ven6-bas" data-ven-bas="${sel.length}"><span class="fav6-bas-t"><b data-ven-sel-n="${sel.length}" aria-live="polite">${esc(TU(sel.length === 1 ? 'v9_sel1' : 'v9_sel', { n: sel.length }))}</b>${sans.length ? `<small data-ven-sans-bord="${sans.length}">${esc(TU(sans.length === 1 ? 'v9_sans1' : 'v9_sans', { n: sans.length }))}</small>` : ''}</span>`
      + `<button type="button" class="vu-btn vu-sec" data-ven-rien>${esc(TU('fl_rien'))}</button>`
      + (suivis.length ? `<button type="button" class="vu-btn vu-sec" data-ven-copier="${suivis.length}">${esc(TU('v9_copier', { n: suivis.length }))}</button>` : '')
      + (ouvrables.length ? `<button type="button" class="vu-btn vu-sec" data-ven-ouvrir="${ouvrables.length}">${esc(TU('v9_ouvrir'))}</button>` : '')
      + (cmd.length ? `<button type="button" class="vu-btn vu-sec" data-ven-commander="${esc(cmd.slice(0, 6).map((x) => x.tx).join(','))}"${impEnVol ? ' disabled' : ''}>${esc(TU(cmd.length === 1 ? 'v9_cmd1' : 'v9_cmd', { n: Math.min(6, cmd.length) }))}</button>` : '')
      + `<button type="button" class="vu-btn vu-plein" data-imprimer-n="${esc(imp.slice(0, 10).map((x) => x.tx).join(','))}" data-ven-imprimer="${imp.length}"${!imp.length || impEnVol ? ' disabled' : ''}>${esc(TU(imp.length === 1 ? 'imp_un' : 'v9_imp', { n: Math.min(10, imp.length) }))}</button></div>${conf}`;
  }
  function commanderBordereaux(txs) {
    const ids = [...new Set(txs.map(String).filter((t) => /^\d{1,20}$/.test(t)))].slice(0, 6);
    if (!ids.length || impEnVol) return;
    impEnVol = true; venConfirme = null; impEtat = { ton: '', texte: TU('v9_cmd_en_cours') }; rendre();
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'bordereauxCommander', txs: ids, confirme: true }, (r) => {
        try { void chrome.runtime.lastError; } catch (_) {}
        impEnVol = false;
        if (!r || !r.ok) { impEtat = { ton: 'ambre', texte: (r && r.raison) || TU('ra_ko') }; rendre(); return; }
        const n = (r.acceptes || []).length, k = (r.refus || []).length;
        impEtat = { ton: k ? 'ambre' : '', texte: [n ? TU('v9_cmd_ok', { n }) : '', k ? TU('v9_cmd_ko', { n: k, r: String((r.refus[0] && r.refus[0].raison) || '') }) : ''].filter(Boolean).join(' · ') };
        chargerListes(true);
        rendre();
      });
    } catch (_) { impEnVol = false; impEtat = { ton: 'ambre', texte: TU('ra_ko') }; rendre(); }
  }
  const ETAT_V6 = { a_expedier: ['v_action', 'ambre'], en_route: ['v_rien', ''], finalisee: ['v_terminee', ''], annulee: ['v_annulee', ''], pas_su: ['v_pas_su', ''] };
  function ventesGrandHtml(e) {
    const v = listes.ventes;
    const ici = ORIGINE_ICI || 'https://www.vinted.fr';
    const q = venCherche.trim().toLowerCase();
    const etats = ['a_expedier', 'en_route', 'finalisee', 'annulee', 'pas_su'];
    const compte = Object.fromEntries(etats.map((k) => [k, v.liste.filter((x) => (x.etat || 'pas_su') === k).length]));
    const choisis = venStatuts || new Set(etats);
    const valeur = (x, c) => (c === 'prix' ? Number(x.prix) || 0 : c === 'date' ? Number(x.date) || 0 : c === 'transporteur' ? String(x.transporteur || '') : c === 'statut' ? String(x.etat || '') : String(x.titre || '').toLowerCase());
    const nF = Object.fromEntries(FILTRES_V9.map((k) => [k, v.liste.filter((x) => filtreV9(x, k)).length]));
    if (!FILTRES_V9.includes(venFiltre) && !(venFiltre === 'relancer' && listes.plateforme === 'vinted')) venFiltre = 'tous';
    // 5.425 : « À relancer » (Vinted) — le nombre de commandes à relancer, lu par le fond ; « — » tant qu'il n'est pas su.
    if (listes.plateforme === 'vinted' && !rlEnVol && (!rlEtat || rlPour !== (Number(listesAt) || 0))) chargerRelances();
    const nRl = rlNbOk();
    const segV = `<div class="vu-seg seg6 ven6-seg" role="group" aria-label="${esc(TU('v9_filtres'))}">${FILTRES_V9.map((k) => `<button type="button" data-ven-filtre="${k}" aria-pressed="${venFiltre === k}"><span>${esc(TU('v9_f_' + k))}</span> <b data-n="${nF[k]}">${nF[k]}</b></button>`).join('')}${listes.plateforme === 'vinted' ? `<button type="button" data-ven-filtre="relancer" aria-pressed="${venFiltre === 'relancer'}"><span>${esc(TU('rl_filtre'))}</span> <b data-n="${nRl == null ? '' : nRl}"${nRl ? ' data-ton="ambre"' : ''}>${nRl == null ? '—' : nRl}</b></button>` : ''}</div>`;
    if (venFiltre === 'relancer') return segV + relancesAcheteursHtml();
    const vus = v.liste.filter((x) => filtreV9(x, venFiltre) && choisis.has(x.etat || 'pas_su') && (!q || String(x.titre).toLowerCase().includes(q) || String(x.num || '').toLowerCase() === q)).slice().sort((a2, b2) => { const va = valeur(a2, venTri.col), vb = valeur(b2, venTri.col); return (va > vb ? 1 : va < vb ? -1 : 0) * venTri.sens; });
    const menu = `<details class="cols5 statut6" data-ven-statut-menu${venStatutOuvert ? ' open' : ''}><summary>${esc(TU('a_statut'))}${venStatuts ? ` · ${venStatuts.size}` : ''}</summary><div class="cols5-l">${etats.map((k) => `<label><input type="checkbox" data-ven-statut="${k}"${choisis.has(k) ? ' checked' : ''}> <span>${esc(TU(ETAT_V6[k][0]))}</span><b>${compte[k]}</b></label>`).join('')}</div></details>`;
    const prets = v.liste.filter(imprimable);
    for (const t of [...venSel]) if (!v.liste.some((x) => String(x.tx) === t)) venSel.delete(t);
    const aImprimer = venSel.size ? [] : prets;   // 5.419 : une sélection ⇒ la barre du bas ; sinon « Imprimer les N » prêts, comme avant
    const impN = aImprimer.length ? `<button type="button" class="vu-btn vu-sec impn6" data-imprimer-n="${esc(aImprimer.slice(0, 10).map((x) => x.tx).join(','))}"${impEnVol ? ' disabled' : ''}>${esc(TU(aImprimer.length === 1 ? 'imp_un' : 'imp_n', { n: Math.min(10, aImprimer.length) }))}</button>` : '';
    const outils = segV + `<div class="barre5 barre6">${impN}<input type="search" class="cherche5" data-ven-cherche placeholder="${esc(TU('v_chercher'))}" aria-label="${esc(TU('v_chercher'))}" value="${esc(venCherche)}">${menu}</div>`;
    const ligneN = `<div class="n6"><span data-ven-n="${vus.length}">${esc(TU('v_n_commandes', { n: vus.length }))}</span></div>` + (impEtat ? `<p class="note5 imp-etat6" role="status" data-imp-etat${impEtat.ton ? ` data-ton="${impEtat.ton}"` : ''}>${esc(impEtat.texte)}</p>` : '');
    if (!vus.length) return outils + ligneN + `<div class="val gris vide6" data-ventes-filtre="0">${esc(TU('a_aucune'))}</div>` + barreVentesHtml(prets);
    const toutV = vus.every((x) => venSel.has(String(x.tx)));
    const cellule = (x, c) => (c === 'prix' ? `<b>${esc(eurosL(x.prix))}</b>` : c === 'date' ? esc(jourCourt5(x.date)) : c === 'transporteur' ? transpHtml6(x) : c === 'limite' ? limiteHtml6(x) : c === 'bordereau' ? boutonImp6(x, true) : etiquette5(x.etat || 'pas_su', TU(ETAT_V6[x.etat || 'pas_su'] ? ETAT_V6[x.etat || 'pas_su'][0] : 'v_pas_su'), (ETAT_V6[x.etat] || [])[1] || ''));
    const enTete = `<div class="tr6 th6r" style="--n6:${COLS_V6.length};--g6:${COLS_V6.map((c) => W6V[c] || '96px').join(' ')}"><label class="case5"><input type="checkbox" data-ven-tout${toutV ? ' checked' : ''} aria-label="${esc(TU('v9_tout'))}" title="${esc(TU('v9_tout'))}"></label>${enTeteTri5('titre', TU('c5_article'), 'data-ven-tri')}<span class="cels6">${COLS_V6.map((c) => (c === 'limite' || c === 'bordereau' ? `<span class="th6 th6-fixe">${esc(TU('c6_' + c))}</span>` : enTeteTri5(c, TU('c6_' + c), 'data-ven-tri'))).join('')}</span><span></span></div>`;
    return outils + offresHtml() + ligneN + `<div class="table6" data-ventes="${vus.length}" data-tri="${venTri.col}:${venTri.sens}">${enTete}<ul class="rangs" data-defil="ventes">${vus.map((x) => `<li${ficheOuverte === 'v:' + x.tx ? ' data-ouverte' : ''}${venSel.has(String(x.tx)) ? ' data-coche' : ''}><div class="tr6" style="--n6:${COLS_V6.length};--g6:${COLS_V6.map((c) => W6V[c] || '96px').join(' ')}"><label class="case5"><input type="checkbox" data-ven-sel="${esc(x.tx)}"${venSel.has(String(x.tx)) ? ' checked' : ''} aria-label="${esc(TU('v9_choisir', { t: x.titre || x.tx }))}"></label><button type="button" class="art6" data-vente="${esc(x.tx)}" data-vente-etat="${esc(x.etat || 'pas_su')}"${x.bordereau != null ? ` data-bordereau="${x.bordereau ? 'pret' : 'manque'}"` : ''} data-fiche-b="v:${esc(x.tx)}">${vignette(x.photo)}<span class="ti">${x.num ? plaque(x.num) + ' ' : ''}${esc(x.titre || '')}<small class="st6">${esc(x.statutVinted || '')}</small></span></button><span class="cels6">${COLS_V6.map((c) => `<span class="cel6" data-col="${c}"><i class="lc5">${esc(TU('c6_' + c))}</i>${cellule(x, c)}</span>`).join('')}</span><button type="button" class="plus6" data-fiche-b="v:${esc(x.tx)}" aria-label="${esc(TU('a_plus'))}">⋯</button></div>${ficheOuverte === 'v:' + x.tx ? ficheVenteHtml(x, ici) : ''}</li>`).join('')}</ul></div>` + barreVentesHtml(prets);
  }
  // ══ 5.425 — « À RELANCER » (Julien, 21 nov. : « acheteurs qui ne finalisent pas, ou ne vont pas chercher le colis ») ══
  //    Deux listes LUES par le fond (`relancesCarte`, statuts PROUVÉS, litige jamais) : livrées pas confirmées · au point
  //    relais pas retirées (ce qui reste de la garde). Un message poli prêt (SES versions, la langue de la conversation),
  //    « Modifier », « Envoyer la relance » ; en lot : cases + « Envoyer N relances » + SA confirmation. Le fond revérifie
  //    tout juste avant, note au registre AVANT, envoie par la page (une relance par commande et par motif).
  let rlPour = 0, rlEtat = null, rlEnVol = false, rlConfirme = null, rlInfo = null, rlEdit = '', rlReg = null, rlRegLangue = '', rlRegEtat = null, rlAutoQ = false;
  const rlSel = new Set(), rlTextes = {};
  const rlCle = (x) => x.tx + ':' + x.motif;
  const RL_LG = { fr: 'rl_lg_fr', en: 'rl_lg_en', es: 'rl_lg_es', it: 'rl_lg_it', de: 'rl_lg_de' };   // clés écrites en entier (audit-extension-feuille L3)
  function chargerRelances() {
    if (rlEnVol) return; rlEnVol = true; rlPour = Number(listesAt) || 0;
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'relancesCarte', langue: U.langue ? U.langue() : 'fr' }, (r) => {
        void chrome.runtime.lastError; rlEnVol = false;
        rlEtat = r && r.ok ? r : { ko: true, raison: (r && r.raison) || TU('v_pas_su') };
        for (const k of [...rlSel]) if (!(rlEtat.lignes || []).some((x) => rlCle(x) === k && x.eligible && x.eligible.ok)) rlSel.delete(k);
        // Un envoi en cours : relu toutes les 4 s (l'état de chaque rangée vient du fond).
        if (rlEtat.lot && !rlEtat.lot.fin) setTimeout(() => { if (ongletListe === 'ventes' && venFiltre === 'relancer') chargerRelances(); }, 4000);
        rendre();
      });
    } catch (_) { rlEnVol = false; rlEtat = { ko: true, raison: TU('v_pas_su') }; }
  }
  const rlNbOk = () => (rlEtat && Array.isArray(rlEtat.lignes) ? rlEtat.lignes.filter((x) => x.eligible && x.eligible.ok).length : null);
  const rlJour = (t) => { try { return new Date(Number(t)).toLocaleDateString(U.langue ? U.langue() : 'fr', { day: '2-digit', month: '2-digit' }); } catch (_) { return ''; } };
  const rlHeure = (t) => { try { return new Date(Number(t)).toLocaleTimeString(U.langue ? U.langue() : 'fr', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
  function rlPhrase(x) {
    const j = x.depuis ? Math.max(0, Math.floor((Date.now() - Number(x.depuis)) / 864e5)) : null;
    if (x.motif === 'livre') return j == null ? TU('rl_titre_livre') : TU(x.preuve === 'vu' ? 'rl_livre_depuis_vu' : 'rl_livre_depuis', { n: j });
    const a = j == null ? TU('rl_m_relais') : TU(x.preuve === 'vu' ? 'rl_relais_depuis_vu' : 'rl_relais_depuis', { n: j });
    const l = x.limite;
    const b = !l ? TU('rl_limite_passu') : l.reste <= 0 ? TU('rl_reste_passe') : l.estimee ? TU('rl_reste_estime', { n: l.reste, t: U.nomTransp ? U.nomTransp(x.transporteur) : x.transporteur }) : TU('rl_reste', { n: l.reste });
    return a + ' · ' + b;
  }
  function rlEtiquette(x) {
    const e = x.eligible || {}, res = rlEtat && rlEtat.lot && rlEtat.lot.res ? rlEtat.lot.res[rlCle(x)] : null;
    if (res && res.ok) return etiquette5('fait', TU('rl_envoyee'), '');
    if (e.ok) return etiquette5('a_relancer', TU(e.rang === 2 ? 'rl_rang2' : 'rl_rang1'), 'ambre');
    const der = (x.envois || [])[x.envois.length - 1];
    if (e.raison === 'deja-deux') return etiquette5('relancee', TU('rl_deja_deux'), '');
    if (e.raison === 'trop-tot-2') return etiquette5('relancee', TU('rl_trop_tot_2', { d: rlJour(der), n: Math.max(1, Math.ceil((Number(der) + (e.seuil || 1) * 864e5 - Date.now()) / 864e5)) }), '');
    return etiquette5('relancee', TU('rl_deja', { d: rlJour(der) }), '');
  }
  function rlRangee(x) {
    const k = rlCle(x), e = x.eligible || {}, res = rlEtat && rlEtat.lot && rlEtat.lot.res ? rlEtat.lot.res[k] : null;
    const enCours = !!(rlEtat && rlEtat.lot && !rlEtat.lot.fin);
    const peut = e.ok && !(res && res.ok);
    const txt = rlTextes[k] != null ? rlTextes[k] : (x.texte || '');
    const qui = x.pseudo ? '@' + x.pseudo : TU('rl_l_acheteur');
    return `<li class="rl6-r" data-relance="${esc(k)}" data-rl-motif="${esc(x.motif)}" data-rl-ok="${peut ? '1' : '0'}"${rlSel.has(k) ? ' data-coche' : ''}>
      <div class="rl6-l">${peut ? `<label class="case5"><input type="checkbox" data-rl-sel="${esc(k)}"${rlSel.has(k) ? ' checked' : ''}${enCours ? ' disabled' : ''} aria-label="${esc(TU('rl_choisir', { t: x.titre || x.tx }))}"></label>` : '<span class="case5" aria-hidden="true"></span>'}${vignette(x.photo)}
        <span class="mil"><span class="ti">${esc(x.titre || '—')}</span><span class="me" data-rl-phrase>${esc((x.pseudo ? '@' + x.pseudo + ' · ' : '') + rlPhrase(x))}</span></span><span class="v6">${rlEtiquette(x)}</span></div>
      ${res && !res.ok ? `<p class="note5 rl6-ko" role="status" data-rl-refus>${esc(res.raison || '')}</p>` : ''}
      ${peut && txt ? `<div class="rl6-m"><small>${esc(TU('rl_message', { qui }))}${x.langueTexte && x.langueTexte !== (U.langue ? U.langue() : 'fr') ? ' · ' + esc(TU('rl_langue_conv', { l: TU(RL_LG[x.langueTexte] || 'rl_lg_fr') })) : ''}</small>
        ${rlEdit === k ? `<textarea data-rl-texte="${esc(k)}" rows="4" maxlength="1000" aria-label="${esc(TU('rl_modifier'))}">${esc(txt)}</textarea>` : `<div class="bulle" data-rl-bulle>${esc(txt)}</div>`}
        <div class="ge5"><button type="button" class="vu-btn vu-sec" data-rl-modifier="${esc(k)}"${enCours ? ' disabled' : ''}>${esc(rlEdit === k ? TU('rl_fermer') : TU('rl_modifier'))}</button><button type="button" class="vu-btn vu-sec" data-rl-un="${esc(k)}"${enCours || !txt.trim() ? ' disabled' : ''}>${esc(TU('rl_envoyer_un'))}</button></div></div>` : ''}
    </li>`;
  }
  function rlReglagesHtml() {
    if (!rlReg) return '';
    const R = rlReg, lg = rlRegLangue || (U.langue ? U.langue() : 'fr');
    const m = (motif) => ((R.modeles || {})[motif] || {})[lg] || [];
    const auto = rlAutoQ ? `<div class="conf5" role="alertdialog" data-rl-auto-q><p>${esc(TU('rl_auto_q'))}</p><div class="outils"><button type="button" class="vu-btn vu-plein" data-rl-auto-oui>${esc(TU('rl_allumer'))}</button><button type="button" class="vu-btn" data-rl-auto-non>${esc(TU('rl_annuler'))}</button></div></div>` : '';
    return `<section class="sec6 rl6-reg" data-rl-reglages role="region" aria-label="${esc(TU('rl_reglages'))}"><h3>${esc(TU('rl_reglages'))}</h3>
      <label class="champ6"><b>${esc(TU('rl_seuil_livre'))}</b><input type="number" min="1" max="14" step="1" data-rl-champ="livreJours" value="${esc(R.livreJours)}"></label>
      <label class="champ6"><b>${esc(TU('rl_seuil_relais'))}</b><input type="number" min="1" max="14" step="1" data-rl-champ="relaisJours" value="${esc(R.relaisJours)}"></label>
      <label class="champ6 rl6-case"><span><input type="checkbox" data-rl-champ="deuxieme"${R.deuxieme ? ' checked' : ''}> <b>${esc(TU('rl_deuxieme'))}</b></span></label>
      <div class="rg6"><span><b>${esc(TU('rl_auto'))}</b><small>${esc(TU('rl_auto_note'))}</small></span><button type="button" class="vu-btn ra6" data-rl-auto aria-pressed="${R.actif === true}">${esc(TU(R.actif ? 'ra_eteindre' : 'ra_allumer'))}</button></div>${auto}
      <div class="rg6"><span><b>${esc(TU('rl_modeles'))}</b><small>${esc(TU('rl_modeles_note'))}</small></span><select data-rl-langue aria-label="${esc(TU('rl_modeles'))}">${['fr', 'en', 'es', 'it', 'de'].map((l) => `<option value="${l}"${l === lg ? ' selected' : ''}>${esc(TU(RL_LG[l]))}</option>`).join('')}</select></div>
      <label class="champ6"><b>${esc(TU('rl_m_livre'))}</b><textarea data-rl-modele="livre" rows="3" maxlength="10000">${esc(m('livre').join('\n'))}</textarea></label>
      <label class="champ6"><b>${esc(TU('rl_m_relais'))}</b><textarea data-rl-modele="relais" rows="3" maxlength="10000">${esc(m('relais').join('\n'))}</textarea></label>
      ${rlRegEtat ? `<p class="note5" role="status" data-rl-reg-etat>${esc(rlRegEtat)}</p>` : ''}
      <div class="ge5"><button type="button" class="vu-btn vu-sec" data-rl-reg-fermer>${esc(TU('rl_fermer'))}</button><button type="button" class="vu-btn vu-sec" data-rl-reg-ok>${esc(TU('rl_enregistrer'))}</button></div></section>`;
  }
  function relancesAcheteursHtml() {   // (22 nov., intégration) renommée : la 5.421 a déjà `relancesHtml` (relance des offres) — la seconde déclaration écrasait celle-ci
    if (!listes || listes.plateforme !== 'vinted') return `<div class="val gris">${esc(TU('m_site', { site: NOM_SITE[listes && listes.plateforme] || '' }))}</div>`;
    if (!rlEtat) { chargerRelances(); return `<div class="val gris" role="status" data-relances="charge">${esc(TU('rl_charge'))}</div>`; }
    if (rlEtat.ko) return `<div class="val gris" data-relances="pas-su">${esc(rlEtat.raison)}</div>`;
    const tout = rlEtat.lignes || [];
    const montrees = tout.filter((x) => (x.eligible && x.eligible.ok) || (x.envois || []).length);
    const autres = tout.length - montrees.length;
    const lot = rlEtat.lot;
    const enCours = !!(lot && !lot.fin);
    const etatLot = !lot ? '' : enCours ? TU('rl_en_cours', { i: Math.min(lot.n, lot.i + 1), n: lot.n }) + (lot.prochainAt > Date.now() ? ' · ' + TU('rl_prochain', { h: rlHeure(lot.prochainAt) }) : '')
      : lot.fin && lot.fin.raison !== 'fait' ? TU('rl_arrete', { r: lot.fin.raison }) : TU('rl_fini', { ok: Object.values(lot.res || {}).filter((y) => y.ok).length, ko: Object.values(lot.res || {}).filter((y) => !y.ok).length });
    const groupe = (motif, titre) => { const l = montrees.filter((x) => x.motif === motif); return `<section class="sec6 rl6-g" data-rl-groupe="${motif}"><h3>${esc(TU(titre))} · <b data-n="${l.length}">${l.length}</b></h3>${l.length ? `<ul class="rangs rl6-l0">${l.map(rlRangee).join('')}</ul>` : ''}</section>`; };
    const tete = `<div class="rl6-t"><p class="note5" data-rl-note>${esc(TU('rl_note'))}</p><button type="button" class="vu-btn vu-sec" data-rl-reg-ouvrir aria-expanded="${rlReg ? 'true' : 'false'}">${esc(TU('rl_reglages'))}</button></div>`
      + (etatLot ? `<p class="note5 imp-etat6" role="status" data-rl-lot="${enCours ? 'en-cours' : 'fini'}">${esc(etatLot)}</p>` : '') + (rlInfo ? `<p class="note5 imp-etat6" role="status" data-ton="ambre" data-rl-info>${esc(rlInfo)}</p>` : '');
    const pied = (rlEtat.litiges ? `<p class="note5" data-rl-litiges="${rlEtat.litiges}">${esc(TU('rl_litiges', { n: rlEtat.litiges }))}</p>` : '') + (autres ? `<p class="note5" data-rl-autres="${autres}">${esc(TU('rl_autres', { n: autres }))}</p>` : '');
    const corps = montrees.length ? groupe('livre', 'rl_titre_livre') + groupe('relais', 'rl_titre_relais') : `<div class="val gris vide6" data-relances="0">${esc(TU('rl_vide'))}</div>`;
    const sel = [...rlSel];
    const cad = (listes && listes.automatisations && listes.automatisations.cadence) || {};
    const conf = rlConfirme ? `<div class="ven6-conf" role="alertdialog" data-rl-confirme="${rlConfirme.length}"><span>${esc(TU('rl_conf', { n: rlConfirme.length, compte: (listes.compte && listes.compte.nom) || '', a: Number(cad.pauseMin) || 20, b: Number(cad.pauseMax) || 60 }))}</span><button type="button" class="vu-btn vu-sec" data-rl-non>${esc(TU('rl_annuler'))}</button><button type="button" class="vu-btn vu-plein" data-rl-oui>${esc(TU('rl_oui'))}</button></div>` : '';
    const bas = sel.length && !enCours ? `<div class="fav6-bas ven6-bas" data-rl-bas="${sel.length}"><span class="fav6-bas-t"><b aria-live="polite">${esc(TU('rl_sel', { n: sel.length }))}</b></span><button type="button" class="vu-btn vu-sec" data-rl-rien>${esc(TU('fl_rien'))}</button><button type="button" class="vu-btn vu-plein" data-rl-lot="${sel.length}">${esc(TU('rl_envoyer_n', { n: Math.min(10, sel.length) }))}</button></div>${conf}` : (rlConfirme ? conf : '');
    return `<div class="rl6" data-relances="${montrees.length}">${tete}${rlReglagesHtml()}${corps}${pied}${bas}</div>`;
  }
  function rlEnvoyer(items) {
    rlConfirme = null; rlInfo = null;
    const l = items.slice(0, 10).map((k) => { const x = (rlEtat.lignes || []).find((y) => rlCle(y) === k); return x ? { tx: x.tx, motif: x.motif, ...(rlTextes[k] != null && rlTextes[k] !== x.texte ? { texte: rlTextes[k] } : {}) } : null; }).filter(Boolean);
    if (!l.length) return;
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'relancesEnvoyer', items: l, confirme: true, langue: U.langue ? U.langue() : 'fr' }, (r) => {
        void chrome.runtime.lastError;
        if (!r || !r.ok) rlInfo = (r && r.raison) || TU('ra_ko'); else { rlSel.clear(); rlEdit = ''; }
        chargerRelances(); rendre();
      });
    } catch (_) { rlInfo = TU('ra_ko'); rendre(); }
  }
  function rlEnregistrer(actif, confirme) {
    const uid = listes && listes.compte && listes.compte.id;
    if (!rlReg || !uid) return;
    const valeur = { actif: actif === true, livreJours: Number(rlReg.livreJours), relaisJours: Number(rlReg.relaisJours), deuxieme: rlReg.deuxieme === true, modeles: rlReg.modeles || {} };
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'reglageAuto', cle: 'vinted_bleam', valeur: { uid, section: 'relances', valeur }, confirme: confirme === true }, (r) => {
        void chrome.runtime.lastError;
        if (r && r.code === 'confirmation') { rlAutoQ = true; rendre(); return; }
        rlRegEtat = r && r.ok ? TU('rl_enregistre') : ((r && r.raison) || TU('ra_ko'));
        if (r && r.ok) { rlReg.actif = actif === true; rlEtat = null; chargerRelances(); }
        rendre();
      });
    } catch (_) { rlRegEtat = TU('ra_ko'); rendre(); }
  }
  function brancherRelances(racine) {
    racine.querySelectorAll('[data-rl-sel]').forEach((c) => c.addEventListener('change', () => { const k = c.getAttribute('data-rl-sel'); if (c.checked) rlSel.add(k); else rlSel.delete(k); rlConfirme = null; rendre(); }));
    racine.querySelectorAll('[data-rl-modifier]').forEach((b) => b.addEventListener('click', () => { const k = b.getAttribute('data-rl-modifier'); rlEdit = rlEdit === k ? '' : k; rendre(); }));
    racine.querySelectorAll('[data-rl-texte]').forEach((t) => t.addEventListener('input', () => { rlTextes[t.getAttribute('data-rl-texte')] = t.value; }));
    racine.querySelectorAll('[data-rl-un]').forEach((b) => b.addEventListener('click', () => { rlConfirme = [b.getAttribute('data-rl-un')]; rendre(); }));
    const lt = racine.querySelector('button[data-rl-lot]'); if (lt) lt.addEventListener('click', () => { rlConfirme = [...rlSel].slice(0, 10); rendre(); });
    const rn = racine.querySelector('[data-rl-rien]'); if (rn) rn.addEventListener('click', () => { rlSel.clear(); rlConfirme = null; rendre(); });
    const no = racine.querySelector('[data-rl-non]'); if (no) no.addEventListener('click', () => { rlConfirme = null; rendre(); });
    const oui = racine.querySelector('[data-rl-oui]'); if (oui) oui.addEventListener('click', () => { if (rlConfirme) rlEnvoyer(rlConfirme); });
    const ro = racine.querySelector('[data-rl-reg-ouvrir]'); if (ro) ro.addEventListener('click', () => { rlReg = rlReg ? null : Object.assign({ livreJours: 2, relaisJours: 3, deuxieme: false, actif: false, modeles: {} }, JSON.parse(JSON.stringify((rlEtat && rlEtat.reglage) || {}))); rlRegEtat = null; rlAutoQ = false; rendre(); });
    const rf = racine.querySelector('[data-rl-reg-fermer]'); if (rf) rf.addEventListener('click', () => { rlReg = null; rendre(); });
    racine.querySelectorAll('[data-rl-champ]').forEach((c) => c.addEventListener(c.type === 'checkbox' ? 'change' : 'input', () => { if (!rlReg) return; const k = c.getAttribute('data-rl-champ'); rlReg[k] = c.type === 'checkbox' ? c.checked : c.value; }));
    const lg = racine.querySelector('[data-rl-langue]'); if (lg) lg.addEventListener('change', () => { rlRegLangue = lg.value; rendre(); });
    racine.querySelectorAll('[data-rl-modele]').forEach((t) => t.addEventListener('input', () => { if (!rlReg) return; const motif = t.getAttribute('data-rl-modele'), l = rlRegLangue || (U.langue ? U.langue() : 'fr'); const m = (rlReg.modeles = rlReg.modeles || {}); m[motif] = Object.assign({}, m[motif] || {}, { [l]: t.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 5) }); }));
    const ok = racine.querySelector('[data-rl-reg-ok]'); if (ok) ok.addEventListener('click', () => rlEnregistrer(rlReg && rlReg.actif === true, false));
    const au = racine.querySelector('[data-rl-auto]'); if (au) au.addEventListener('click', () => { if (!rlReg) return; if (rlReg.actif) rlEnregistrer(false, false); else { rlAutoQ = true; rendre(); } });
    const ao = racine.querySelector('[data-rl-auto-oui]'); if (ao) ao.addEventListener('click', () => { rlAutoQ = false; rlEnregistrer(true, true); });
    const an = racine.querySelector('[data-rl-auto-non]'); if (an) an.addEventListener('click', () => { rlAutoQ = false; rendre(); });
  }
  // ══ 5.425 — LE TRI DES CONVERSATIONS (Messagerie, lecture seule) : À répondre · Offre en attente · Litige / retour ·
  //    En attente de l'acheteur · Traité (· Pas encore lu) ; les urgentes d'abord, la raison en petit ; compte de l'onglet.
  let tcEtat = null, tcEnVol = false, tcGroupe = 'tout', tcPour = 0;
  const TC_GROUPES = ['repondre', 'offre', 'litige', 'attente', 'traite', 'passu'];
  const TC_TITRE = { repondre: 'tc_g_repondre', offre: 'tc_g_offre', litige: 'tc_g_litige', attente: 'tc_g_attente', traite: 'tc_g_traite', passu: 'tc_g_passu' };
  const TC_RAISON = { message: 'tc_r_message', 'non-lu': 'tc_r_non_lu', 'colis-point': 'tc_r_colis_point', 'ta-reponse': 'tc_r_ta_reponse', finie: 'tc_r_finie', 'rien-a-faire': 'tc_r_rien', 'pas-lu': 'tc_r_pas_lu', 'fil-ancien': 'tc_r_fil_ancien', 'litige-mots': 'tc_r_litige_mots' };
  function chargerTri() {
    if (tcEnVol) return; tcEnVol = true; tcPour = Number(listesAt) || 0;
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'triConversations' }, (r) => { void chrome.runtime.lastError; tcEnVol = false; tcEtat = r && r.ok ? { par: new Map((r.lignes || []).map((x, i) => [String(x.conv), Object.assign({ rangTri: i }, x)])), compte: r.compteGroupes || {} } : { ko: true }; rendre(); }); } catch (_) { tcEnVol = false; tcEtat = { ko: true }; }
  }
  function tcRaison(conv) {
    const c = tcEtat && tcEtat.par ? tcEtat.par.get(String(conv)) : null;
    if (!c) return '';
    const r = c.raison === 'offre' ? (c.prix ? TU('tc_r_offre', { p: eurosL(c.prix), h: c.heures != null ? c.heures : '—' }) : TU('tc_r_offre_sans')) : /^litige-/.test(c.raison || '') ? TU(c.raison === 'litige-mots' ? 'tc_r_litige_mots' : 'tc_r_litige') : TU(TC_RAISON[c.raison] || 'tc_r_rien');
    return `<small class="tc6-r" data-tc-groupe="${esc(c.groupe)}"${c.urgent ? ' data-urgent' : ''} data-tc-raison="${esc(c.raison || '')}">${c.urgent ? '<i class="tc6-pt" aria-hidden="true"></i>' : ''}${esc(r)}</small>`;
  }
  function triHtml() {
    if (!tcEtat || !tcEtat.par) return '';
    const n = tcEtat.compte || {};
    const tot = tcEtat.par.size;
    const b = (k, lib, nb) => `<button type="button" data-tc-g="${k}" aria-pressed="${tcGroupe === k}"><span>${esc(lib)}</span> <b data-n="${nb}">${nb}</b></button>`;
    return `<div class="vu-seg seg6 tc6-seg" role="group" aria-label="${esc(TU('tc_groupes'))}" data-tri-conv>${b('tout', TU('tc_tout'), tot)}${TC_GROUPES.filter((g) => g !== 'passu' || n.passu).map((g) => b(g, TU(TC_TITRE[g]), Number(n[g]) || 0)).join('')}</div>`;
  }
  function triFiltrer(vus) {
    if (!tcEtat || !tcEtat.par) return vus;
    const l = tcGroupe === 'tout' ? vus.slice() : vus.filter((x) => { const c = tcEtat.par.get(String(x.conv)); return c && c.groupe === tcGroupe; });
    return l.sort((a, b) => { const ca = tcEtat.par.get(String(a.conv)), cb = tcEtat.par.get(String(b.conv)); return (ca ? ca.rangTri : 1e9) - (cb ? cb.rangTri : 1e9); });
  }
  function brancherAnnonces(racine) {
    racine.querySelectorAll('[data-ann-statut]').forEach((c) => c.addEventListener('change', () => { const k = c.getAttribute('data-ann-statut'); const base = annStatuts || new Set(STATUTS5); if (c.checked) base.add(k); else base.delete(k); annStatuts = base; rendre(); }));
    const sm = racine.querySelector('[data-ann-statut-menu]'); if (sm) sm.addEventListener('toggle', () => { annStatutOuvert = sm.open; });
    racine.querySelectorAll('[data-ann-tri]').forEach((b) => b.addEventListener('click', () => { const c = b.getAttribute('data-ann-tri'); annTri = annTri.col === c ? { col: c, sens: -annTri.sens } : { col: c, sens: c === 'titre' ? 1 : -1 }; rendre(); }));
    racine.querySelectorAll('[data-ven-statut]').forEach((c) => c.addEventListener('change', () => { const k = c.getAttribute('data-ven-statut'); const base = venStatuts || new Set(['a_expedier', 'en_route', 'finalisee', 'annulee', 'pas_su']); if (c.checked) base.add(k); else base.delete(k); venStatuts = base; rendre(); }));
    const vm = racine.querySelector('[data-ven-statut-menu]'); if (vm) vm.addEventListener('toggle', () => { venStatutOuvert = vm.open; });
    racine.querySelectorAll('[data-ven-tri]').forEach((b) => b.addEventListener('click', () => { const c = b.getAttribute('data-ven-tri'); venTri = venTri.col === c ? { col: c, sens: -venTri.sens } : { col: c, sens: c === 'titre' ? 1 : -1 }; rendre(); }));
    const vc = racine.querySelector('[data-ven-cherche]'); if (vc) vc.addEventListener('input', () => { venCherche = vc.value; const pos = vc.selectionStart; rendre(); const n = carte.querySelector('[data-ven-cherche]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } });
    racine.querySelectorAll('[data-ann-vue]').forEach((b) => b.addEventListener('click', () => { annVue = b.getAttribute('data-ann-vue'); garderAnn(); rendre(); }));
    const cd = racine.querySelector('[data-ann-cols]'); if (cd) cd.addEventListener('toggle', () => { annColsOuvert = cd.open; });
    // (20 nov., intégration 5.410) Un menu Colonnes / Statut ouvert se ferme quand on touche ailleurs : resté ouvert, il
    // couvrait la colonne Statut et la table pendant « Changer le prix » ou « Publier sur… » (planche du panneau).
    if (!racine.__vrmMenusFerme) { racine.__vrmMenusFerme = true; racine.addEventListener('pointerdown', (e) => { racine.querySelectorAll('details.cols5[open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; }); }, true); }
    racine.querySelectorAll('[data-ann-col]').forEach((c) => c.addEventListener('change', () => { const k = c.getAttribute('data-ann-col'); if (c.checked) annCols.add(k); else annCols.delete(k); garderAnn(); rendre(); }));
    racine.querySelectorAll('[data-ann-sel]').forEach((c) => c.addEventListener('change', () => { const k = c.getAttribute('data-ann-sel'); if (c.checked) annSel.add(k); else annSel.delete(k); rendre(); }));
    const t = racine.querySelector('[data-ann-tout]'); if (t) t.addEventListener('change', () => { racine.querySelectorAll('[data-ann-sel]').forEach((c) => { const k = c.getAttribute('data-ann-sel'); if (t.checked) annSel.add(k); else annSel.delete(k); }); rendre(); });
    const ch = racine.querySelector('[data-ann-cherche]'); if (ch) ch.addEventListener('input', () => { annCherche = ch.value; const pos = ch.selectionStart; rendre(); const n = carte.querySelector('[data-ann-cherche]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } });
    const cnon = racine.querySelector('[data-ann-confirme-non]'); if (cnon) cnon.addEventListener('click', () => { annConfirme = null; rendre(); });
    const cok = racine.querySelector('[data-ann-confirme-ok]');
    if (cok) cok.addEventListener('click', () => {
      const c = annConfirme; if (!c || annEnVol) return;
      if (c.k === 'supprimer') {
        annEnVol = true; rendre();
        const x = ((listes && listes.annonces && listes.annonces.toutes) || []).find((y) => y.id === c.ids[0]) || {};
        try {
          chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'supprimerLbcCarte', id: c.ids[0], numero: x.num || '', titre: x.titre || '', confirme: true, sansRetour: true }, (r) => {
            void chrome.runtime.lastError; annEnVol = false; annConfirme = null;
            annResultat = r && r.accepte ? { ok: true, texte: TU('a_supprime_ok') } : { ok: false, texte: (r && r.raison) || TU('ra_ko') };
            if (r && r.accepte) { annSel.clear(); chargerListes(true); }
            rendre();
          });
        } catch (_) { annEnVol = false; annConfirme = null; annResultat = { ok: false, texte: TU('ra_ko') }; rendre(); }
        return;
      }
      annEnVol = true; rendre();
      try {
        chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'masquerCarte', ids: c.ids, voulu: c.k === 'masquer', confirme: true }, (r) => {
          void chrome.runtime.lastError; annEnVol = false; annConfirme = null;
          const n = r && Array.isArray(r.faits) ? r.faits.filter((x) => x.ok).length : 0;
          annResultat = r && r.ok ? { ok: true, texte: TU(c.k === 'masquer' ? 'a_masque_ok' : 'a_affiche_ok', { n }) } : { ok: false, texte: (r && r.raison) || TU('a_masque_ko', { n }) };
          if (n) { annSel.clear(); chargerListes(true); }
          rendre();
        });
      } catch (_) { annEnVol = false; annConfirme = null; annResultat = { ok: false, texte: TU('a_masque_ko', { n: 0 }) }; rendre(); }
    });
    const act = racine.querySelector('[data-ann-action]');
    if (act) act.addEventListener('change', () => {
      const k = act.value; act.value = ''; annActionPre = '';
      const ids = [...annSel];
      if (!k || !ids.length) return;
      // Les gestes en série passent par leurs chemins GARDÉS : l'atelier Republier et la baisse de VRM (sur SON
      // clic là-bas), le parcours des favoris de la carte. Jamais de suppression en série.
      if (k === 'republier_direct') { republierDirect6(ids); return; }   // 5.429 : « Republier maintenant », sans passer par l'atelier
      if (k === 'republier') { geste6 = { k: 'atelier', ids: ids.slice(0, 50), mode: 'aleatoire', min: 3, max: 8, photo: { rot: 0, bright: 1, contrast: 1, sat: 1, zoom: 1 }, lettre: false, verif: null, verifEnCours: false, quand: 'maintenant', at: atDefaut6(), progConf: false }; geste6Etat = null; rendre(); atelierVerifier6(null, null); return; }
      if (k === 'baisser') { geste6 = { k: 'prix', ids: ids.slice(0, 20), prix: {} }; geste6Etat = null; rendre(); return; }
      if (k === 'aussi' && ids.length <= 10) { ouvrirAussi6(ids); return; }
      if (k === 'publier' && ids.length === 1) { geste6 = { k: 'publier', id: ids[0], site: 'leboncoin', questions: [], problemes: [], reponses: {} }; geste6Etat = null; rendre(); return; }
      if (k === 'ouvrir' && ids.length === 1) { const x = ((listes && listes.annonces && listes.annonces.toutes) || []).find((y) => y.id === ids[0]); try { window.top.location.href = x && x.url ? x.url : (ORIGINE_ICI || 'https://www.vinted.fr') + '/items/' + encodeURIComponent(ids[0]); } catch (_) {} return; }
      // 5.409 : masquer / afficher sur Vinted, sur SON clic CONFIRMÉ (le geste appris de la règle « vendue ailleurs »).
      if ((k === 'masquer' || k === 'afficher') && ids.length <= 10) { annConfirme = { k, ids }; annResultat = null; rendre(); return; }
      // 5.410 : supprimer sur Leboncoin, UNE annonce : le fond rend d'abord SA confirmation « sans retour » (rien ne part).
      if (k === 'supprimer' && ids.length === 1) {
        const x = ((listes && listes.annonces && listes.annonces.toutes) || []).find((y) => y.id === ids[0]) || {};
        try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'supprimerLbcCarte', id: ids[0], numero: x.num || '', titre: x.titre || '', confirme: true }, (r) => { void chrome.runtime.lastError; if (r && r.code === 'sans-retour' && r.confirmation) { annConfirme = { k: 'supprimer', ids, conf: r.confirmation }; annResultat = null; } else annResultat = { ok: false, texte: (r && r.raison) || TU('ra_ko') }; rendre(); }); } catch (_) {}
        return;
      }
      if (k === 'favoris') { ongletListe = 'favoris'; if (ids.length === 1) filtreAnnonce = ids[0]; ranger({ vrmCarteOnglet: ongletListe }); rendre(); }
    });
  }
  function annoncesHtml(e) {
    if (listesErreur) return `<div class="val gris" role="status">${esc(listesErreur)}</div>`;
    if (!listes) return '<div class="val gris" role="status" data-listes-charge>Je lis tes annonces…</div>';
    const a = listes.annonces;
    if (!a) return '<div class="val gris" data-annonces="pas_su">Tes annonces n’ont pas pu être lues pour l’instant : rien n’est affiché plutôt qu’une liste fausse.</div>';
    if (!LISTES && carte.hasAttribute('data-grand')) return annoncesGrandHtml(e);
    const ici = ORIGINE_ICI && !LISTES ? ORIGINE_ICI : 'https://www.vinted.fr';
    const tete = `<div class="lu" data-annonces-lu="${a.lu || ''}">${a.aConfirmer ? esc(TU('s_pas_revue_lu', { d: depuis(a.lu) || TU('s_longtemps') })) : `${Number(a.total).toLocaleString('fr-FR')} en ligne · lues ${esc(depuis(a.lu) || '')}`}${a.relecture ? ' · relecture en cours' : ''}</div>`;
    if (!a.liste.length) return tete + '<div class="val gris" data-annonces="0">Aucune annonce en ligne dans la dernière lecture de ton dressing.</div>';
    const avecN = a.liste.some((x) => x.num);
    return tete + `<ul class="rangs${avecN ? ' avec-n' : ''}" data-annonces="${a.liste.length}" data-defil="annonces">${a.liste.map((x) => `${LISTES ? `<li><a class="rang" data-annonce="${esc(x.id)}" href="${esc(ici + '/items/' + encodeURIComponent(x.id))}" target="_blank" rel="noopener">${debutN(avecN, x.num)}${vignette(x.photo)}<span class="mil"><span class="ti">${esc(x.titre || 'Annonce')}</span><span class="me"><span class="sg">${x.jours != null ? `en ligne depuis ${x.jours} j` : 'date pas lue'}</span>${x.favoris != null ? ` · <span class="sg">${x.favoris} ♥</span>` : ''}${a.aConfirmer ? ` · <span class="sg">${esc(libStatut5('a_confirmer'))}</span>` : ''}</span></span><span class="px">${esc(eurosL(x.prix))}</span></a></li>` : `<li${ficheOuverte === 'a:' + x.id ? ' data-ouverte' : ''}><button type="button" class="rang" data-annonce="${esc(x.id)}" data-fiche-b="a:${esc(x.id)}" aria-expanded="${ficheOuverte === 'a:' + x.id ? 'true' : 'false'}">${debutN(avecN, x.num)}${vignette(x.photo)}<span class="mil"><span class="ti">${esc(x.titre || 'Annonce')}</span><span class="me"><span class="sg">${x.jours != null ? `en ligne depuis ${x.jours} j` : 'date pas lue'}</span>${x.favoris != null ? ` · <span class="sg">${x.favoris} ♥</span>` : ''}${a.aConfirmer ? ` · <span class="sg">${esc(libStatut5('a_confirmer'))}</span>` : ''}</span></span><span class="px">${esc(eurosL(x.prix))}</span></button>${ficheOuverte === 'a:' + x.id ? ficheAnnonceHtml(x, ici) : ''}</li>`}`).join('')}</ul>`
      + (a.total > a.liste.length ? `<div class="val gris">Les ${a.liste.length} plus récentes · ${Number(a.total).toLocaleString('fr-FR')} en tout.</div>` : '');
  }
  function ventesHtml(e) {
    if (listesErreur) return `<div class="val gris" role="status">${esc(listesErreur)}</div>`;
    if (!listes) return '<div class="val gris" role="status" data-listes-charge>Je lis tes ventes…</div>';
    const v = listes.ventes;
    if (!v) return '<div class="val gris" data-ventes="pas_su">Tes ventes n’ont pas pu être lues pour l’instant : rien n’est affiché plutôt qu’une liste fausse.</div>';
    if (!v.liste.length) return '<div class="val gris" data-ventes="0">Aucune vente lue sur ce compte pour l’instant : ouvre une fois la page de tes ventes sur Vinted.</div>';
    if (!LISTES && carte.hasAttribute('data-grand')) return ventesGrandHtml(e);
    const lu = depuis(v.lu);
    const tete = `<div class="lu" data-ventes-total="${Number(v.total || v.liste.length)}">${nbVentes(v.total || v.liste.length)}${lu ? ' · lues ' + esc(lu) : ''}</div>`;
    const ici = ORIGINE_ICI && !LISTES ? ORIGINE_ICI : 'https://www.vinted.fr';
    const avecN = v.liste.some((x) => x.num);
    const corps = (x) => `${debutN(avecN, x.num)}${vignette(x.photo)}<span class="mil"><span class="ti">${esc(x.titre || 'Vente')}</span><span class="me"><span class="sg${x.etat === 'a_expedier' ? ' ambre' : ''}">${esc(ETAT_VENTE[x.etat] || 'état pas encore lu')}</span>${x.bordereau === true ? ' · <span class="sg">bordereau prêt</span>' : x.bordereau === false ? ' · <span class="sg">bordereau pas encore là</span>' : ''}${x.date ? ' · <span class="sg">' + esc(depuis(x.date)) + '</span>' : ''}</span></span><span class="px">${esc(eurosL(x.prix))}</span>`;
    const attrs = (x) => `data-vente="${esc(x.tx)}" data-vente-etat="${esc(x.etat)}"${x.bordereau != null ? ` data-bordereau="${x.bordereau ? 'pret' : 'manque'}"` : ''}`;
    if (!LISTES) return tete + `<ul class="rangs${avecN ? ' avec-n' : ''}" data-ventes="${v.liste.length}" data-defil="ventes">${v.liste.map((x) => `<li${ficheOuverte === 'v:' + x.tx ? ' data-ouverte' : ''}><button type="button" class="rang" ${attrs(x)} data-fiche-b="v:${esc(x.tx)}" aria-expanded="${ficheOuverte === 'v:' + x.tx ? 'true' : 'false'}">${corps(x)}</button>${ficheOuverte === 'v:' + x.tx ? ficheVenteHtml(x, ici) : ''}</li>`).join('')}</ul>`;
    return tete + `<ul class="rangs${avecN ? ' avec-n' : ''}" data-ventes="${v.liste.length}" data-defil="ventes">${v.liste.map((x) => /^[1-9]\d{0,19}$/.test(String(x.conv || ''))
      ? `<li><a class="rang" ${attrs(x)} data-vente-conv="${esc(x.conv)}" href="${esc(ici + '/inbox/' + x.conv)}" target="${LISTES ? '_blank' : '_top'}"${LISTES ? ' rel="noopener"' : ''}>${corps(x)}</a></li>`
      : `<li><div class="rang" ${attrs(x)}>${corps(x)}</div></li>`).join('')}</ul>`;
  }
  // ══ 5.409 — LA FICHE DÉPLIÉE (« dès qu'on clique sur un élément, le grand déroulé s'affiche : la photo, la
  //    description, toutes les infos qu'on a, le N°, le prix mini accepté, absolument tout ») ══════════════
  // Tout vient de `carteListes` (ce qui est RANGÉ) ; une valeur absente s'écrit « — » (pas su), jamais devinée.
  // Les gestes passent par les chemins existants : la page Vinted de l'annonce, ou VRM (sa fiche, ses gestes
  // gardés : baisse, republication, offre…). Rien ne part d'ici sans son toucher.
  const fait5 = (k, v, attr) => `<div class="f5"${attr ? ` data-fait="${attr}"` : ''}><span>${esc(TU(k))}</span><b>${v == null || v === '' ? '—' : esc(v)}</b></div>`;
  const ecart5 = (prix, achat) => (Number(prix) > 0 && Number(achat) > 0 ? eurosL(Number(prix) - Number(achat)).replace(/^(?=\d)/, Number(prix) - Number(achat) >= 0 ? '+' : '') : null);
  // ══ 5.428 (choix 58) : LA COURBE DE L'ANNONCE dans sa fiche (deux petits graphiques à un axe : vues, favoris ; un jour non
  //    lu n'a ni point ni trait — jamais interpolé ; repères du journal sous les courbes, nommés dans la liste). Le fond calcule
  //    la série (`courbeAnnonce`, règle de src/courbeAnnonce.js) ; ici on ne fait que la dessiner. Lecture VRM seule.
  const courbesV = {};
  function lireCourbe(id) {
    if (courbesV[id] !== undefined) return;
    courbesV[id] = null;
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'courbeAnnonce', id }, (r) => { void chrome.runtime.lastError; courbesV[id] = r && r.ok && r.serie ? r : { ok: false }; rendre(); }); } catch (_) { courbesV[id] = { ok: false }; }
  }
  const dateJour10 = (j) => { const t = Number(j) * 864e5; const d = new Date(t + new Date(t).getTimezoneOffset() * 60000); try { return d.toLocaleDateString((U.langue && U.langue()) || 'fr', { day: 'numeric', month: 'short' }); } catch (_) { return d.toISOString().slice(5, 10); } };
  function traceCourbe10(jours, cle, lib) {
    const L = 300, H = 56, HA = 6, BA = 6, n = jours.length;
    const vals = jours.map((d) => (d.lu ? d[cle] : null));
    const lus = vals.filter((v) => v != null);
    const max = lus.length ? Math.max(...lus) : 0, min = lus.length ? Math.min(...lus) : 0, ec = max - min || 1;
    const X = (i) => (n <= 1 ? L / 2 : (i * L) / (n - 1)), Y = (v) => HA + (H - HA - BA) * (1 - (v - min) / ec);
    const segs = []; let cur = [];
    vals.forEach((v, i) => { if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([X(i).toFixed(1), Y(v).toFixed(1)]); });
    if (cur.length) segs.push(cur);
    // L'écart MESURÉ entre le premier et le dernier jour lus de la fenêtre (le total, lui, est déjà dans la fiche : jamais deux fois).
    const iP = vals.findIndex((v) => v != null), iD = vals.length - 1 - [...vals].reverse().findIndex((v) => v != null);
    const ecart = lus.length > 1 ? vals[iD] - vals[iP] : null;
    const w = L / Math.max(2, n - 1);
    return `<figure class="cb10-t" data-cb-trace="${cle}" data-cb-segments="${segs.length}" data-cb-points="${lus.length}" data-cb-ecart="${ecart == null ? '' : ecart}"><figcaption><span>${esc(lib)}</span><b>${ecart == null ? '—' : esc(TU('cb_delta', { d: (ecart > 0 ? '+' : '') + nbFr(ecart).replace(/^-/, '−'), date: dateJour10(jours[iP].j) }))}</b></figcaption>
      <svg class="cb10-svg" viewBox="-4 0 ${L + 8} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(lib)}"><line class="cb10-base" x1="0" x2="${L}" y1="${H - BA + 2}" y2="${H - BA + 2}"/>
      ${segs.map((sg) => (sg.length > 1 ? `<polyline class="cb10-l" points="${sg.map((q) => q.join(',')).join(' ')}"/>` : '')).join('')}${segs.filter((sg) => sg.length === 1).map((sg) => `<line class="cb10-l cb10-p" x1="${sg[0][0]}" x2="${sg[0][0]}" y1="${sg[0][1]}" y2="${sg[0][1]}"/>`).join('')}
      ${jours.map((d, i) => `<rect class="cb10-c" x="${(X(i) - w / 2).toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${H}" data-cb-jour="${d.j}" data-cb-lu="${d.lu ? 1 : 0}"><title>${esc(d.lu ? TU('cb_jour', { date: dateJour10(d.j), vues: d.vues == null ? '—' : nbFr(d.vues), fav: d.fav == null ? '—' : nbFr(d.fav) }) : TU('cb_pas_lu', { date: dateJour10(d.j) }))}</title></rect>`).join('')}</svg></figure>`;
  }
  function courbeHtml(id) {
    lireCourbe(id);
    const c = courbesV[id];
    const tete = `<h3>${esc(TU('cb_titre'))}</h3>`;
    if (c == null) return `<section class="sec6 cb10" data-courbe="lecture">${tete}<p class="note5" role="status">${esc(TU('sa_lecture'))}</p></section>`;
    if (!c.ok) return `<section class="sec6 cb10" data-courbe="pas-su">${tete}<p class="note5">${esc(TU('cb_pas_su'))}</p></section>`;
    const S = c.serie;
    if (!S.lus) return `<section class="sec6 cb10" data-courbe="vide">${tete}<p class="note5">${esc(TU('cb_vide'))}</p></section>`;
    const n = S.jours.length, L = 300;
    const xr = (j) => (n <= 1 ? L / 2 : ((j - S.debut) / (n - 1)) * L);
    return `<section class="sec6 cb10" data-courbe="lu" data-cb-lus="${S.lus}" data-cb-reperes="${esc(S.reperes.map((r) => r.code).join(','))}">${tete}
      ${traceCourbe10(S.jours, 'vues', TU('cb_vues'))}${traceCourbe10(S.jours, 'fav', TU('cb_favoris'))}
      ${S.reperes.length ? `<svg class="cb10-r" viewBox="-4 0 ${L + 8} 12" preserveAspectRatio="none" aria-hidden="true">${S.reperes.map((r) => `<g data-cb-repere="${esc(r.code)}"><title>${esc(TU('cb_r_' + r.code))}</title><line class="cb10-rl" x1="${xr(r.j).toFixed(1)}" x2="${xr(r.j).toFixed(1)}" y1="1" y2="11"/></g>`).join('')}</svg>` : ''}
      <div class="cb10-axe"><span>${esc(dateJour10(S.debut))}</span><span>${esc(dateJour10(S.fin))}</span></div>
      ${S.reperes.slice(-6).reverse().map((r) => `<div class="rg6" data-cb-repere-l="${esc(r.code)}"><span><b>${esc(TU('cb_r_' + r.code))}</b></span><span class="v6">${esc(dateJour10(r.j))}</span></div>`).join('')}
      <p class="note5">${esc(TU('cb_pied', { lus: S.lus, n }))}</p></section>`;
  }
  function ficheAnnonceHtml(x, ici) {
    const photos = (Array.isArray(x.photos) && x.photos.length ? x.photos : (x.photo ? [x.photo] : [])).slice(0, 8);
    const lien = x.url ? String(x.url) : ici + '/items/' + encodeURIComponent(x.id);
    return `<div class="fiche5" data-fiche="a:${esc(x.id)}" role="region" aria-label="${esc(x.titre || '')}">`
      + (photos.length ? `<div class="ph5" data-photos="${photos.length}">${photos.map((u) => `<img src="${esc(u)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`).join('')}</div>` : '')
      + `<div class="g5">${fait5('p_num', x.num || null, 'num')}${fait5('p_prix', Number(x.prix) > 0 ? eurosL(x.prix) : null, 'prix')}${fait5('p_mini', Number(x.mini) > 0 ? eurosL(x.mini) : null, 'mini')}${fait5('p_achat', Number(x.achat) > 0 ? eurosL(x.achat) : null, 'achat')}`
      + `${fait5('p_ecart', ecart5(x.prix, x.achat), 'ecart')}${fait5('p_taille', x.taille, 'taille')}${fait5('p_marque', x.marque, 'marque')}${fait5('p_etat', x.etat, 'etat')}`
      + `${fait5('p_depuis', x.jours != null ? TU('p_jours', { n: x.jours }) : null, 'depuis')}${fait5('p_favoris', x.favoris != null ? String(x.favoris) : null, 'favoris')}${fait5('p_vues', x.vues != null ? String(x.vues) : null, 'vues')}${fait5('p_place', x.place || null, 'place')}</div>`
      + (x.description ? `<p class="desc5" data-desc>${esc(x.description)}</p>` : '')
      + (/vinted\./.test(String(ici || '')) && /^\d{4,15}$/.test(String(x.id || '')) ? courbeHtml(String(x.id)) : '')
      + `<div class="ge5">${/^\d{4,15}$/.test(String(x.id)) && /(^|\.)vinted\./.test(String(location.hostname || '')) && x.statut !== 'vendu' && x.statut !== 'brouillon' ? `<button type="button" class="vu-btn vu-sec" data-repub-direct-b="${esc(x.id)}">${esc(TU('rd_bouton'))}</button>` : ''}${listes && listes.plateforme === 'vinted' ? `<button type="button" class="vu-btn vu-sec" data-aussi-un="${esc(x.id)}">${esc(TU('ac_aussi'))}</button>` : ''}<a class="vu-btn vu-sec" href="${esc(lien)}" target="_top" data-geste="ouvrir">${esc(TU('p_ouvrir_vinted'))}</a><a class="vu-btn vu-sec" href="https://vrm.center/?tab=annonces&site=vinted" target="_blank" rel="noopener" data-geste="vrm">${esc(TU('p_gerer_vrm'))}</a></div></div>`;
  }
  function ficheVenteHtml(x, ici) {
    const conv = /^[1-9]\d{0,19}$/.test(String(x.conv || '')) ? x.conv : '';
    return `<div class="fiche5" data-fiche="v:${esc(x.tx)}" role="region" aria-label="${esc(x.titre || '')}">`
      + (x.photo ? `<div class="ph5" data-photos="1"><img src="${esc(x.photo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>` : '')
      + `<div class="g5">${fait5('p_num', x.num || null, 'num')}${fait5('p_prix', Number(x.prix) > 0 ? eurosL(x.prix) : null, 'prix')}${fait5('p_etat_vente', ETAT_VENTE[x.etat] || null, 'etat')}`
      + `${fait5('p_bordereau', x.bordereau === true ? TU('p_pret') : x.bordereau === false ? TU('p_pas_la') : null, 'bordereau')}${fait5('p_date', x.date ? depuis(x.date) : null, 'date')}${fait5('p_transporteur', x.transporteur || null, 'transporteur')}${fait5('p_suivi', x.suivi || null, 'suivi')}${fait5('c6_limite', x.limite || null, 'limite')}</div>`
      + `<div class="ge5">${imprimable(x) ? boutonImp6(x) : ''}${conv ? `<a class="vu-btn vu-sec" href="${esc(ici + '/inbox/' + conv)}" target="_top" data-geste="conv">${esc(TU('p_ouvrir_conv'))}</a>` : ''}<a class="vu-btn vu-sec" href="https://vrm.center/?tab=ventes&site=vinted&cible=vente&tx=${encodeURIComponent(x.tx)}" target="_blank" rel="noopener" data-geste="vrm">${esc(TU('p_gerer_vrm'))}</a></div></div>`;
  }
  // ══ 5.409 — MESSAGES : les conversations du compte de l'onglet (la boîte rangée), du plus récent ═════════
  // Toucher une conversation l'ouvre sur Vinted (la réponse part de Vinted : la carte n'envoie pas encore).
  // 5.409 (captures « Conversations » de Vintex envoyées par Julien) : deux volets à l'ordinateur — la liste à gauche
  // (filtre « Non lus · N », recherche), la conversation choisie à droite (article, pseudo, dernier message, la
  // réponse s'ouvre sur Vinted) ; au téléphone, la liste seule, une conversation dépliée sous sa rangée.
  let convChoisie = '', msgNonLus = false, msgCherche = '';
  const brouillons = new Map(); const repConv = {}; let repEnVol = false;
  function envoyerReponse(conv) {
    const texte = String(brouillons.get(conv) || '').trim();
    if (!texte || repEnVol) return;
    repEnVol = true; repConv[conv] = null; rendre();
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'repondreCarte', conv, texte, confirme: true }, (r) => {
        void chrome.runtime.lastError; repEnVol = false;
        if (r && r.ok) { brouillons.delete(conv); repConv[conv] = { ok: true, texte: listes && listes.plateforme === 'vestiaire' ? TU('vc_parti') : TU('m_parti') }; if (filsVc[conv]) delete filsVc[conv]; }
        else repConv[conv] = { ok: false, texte: (r && r.raison) || TU('m_pas_parti'), url: r && r.code === 'ouvrir' && /^https:\/\/([\w-]+\.)*vestiairecollective\.com\/[\w/?=.%-]{1,150}$/.test(String(r.url || '')) && String(r.url).includes(conv) ? String(r.url) : '' };
        rendre();
      });
    } catch (_) { repEnVol = false; repConv[conv] = { ok: false, texte: TU('m_pas_parti') }; rendre(); }
  }
  // 5.412 — VESTIAIRE : le FIL de la conversation (ce que l'extension a rangé, `filVcCarte`), et l'envoi par l'interface
  // de la page (le message est tapé dans le champ de Vestiaire puis « Envoyer », vérifié dans le fil) : il part de
  // l'onglet qui MONTRE cette conversation — sinon « Ouvrir la conversation » (rien n'est tapé avant).
  const filsVc = {};
  function filVcHtml(x) {
    const f = filsVc[x.conv];
    if (!f) { filsVc[x.conv] = { charge: true }; try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'filVcCarte', conv: x.conv }, (r) => { void chrome.runtime.lastError; filsVc[x.conv] = r && r.ok ? { data: r } : { raison: (r && r.raison) || TU('vc_fil_pas_su') }; rendre(); }); } catch (_) {} return `<div class="val gris" role="status" data-vc-fil="charge">${esc(TU('m_charge'))}</div>`; }
    if (f.charge) return `<div class="val gris" role="status" data-vc-fil="charge">${esc(TU('m_charge'))}</div>`;
    if (!f.data) return `<div class="val gris" data-vc-fil="pas-su">${esc(f.raison)}</div>`;
    const ms = f.data.messages;
    const ouvrir = f.data.ouverte ? '' : `<a class="vu-btn vu-sec" href="${esc(f.data.url)}" target="_top" data-vc-ouvrir="${esc(x.conv)}">${esc(TU('vc_ouvrir_conv'))}</a>`;
    if (!ms) return `<div class="val gris" data-vc-fil="jamais">${esc(TU('vc_fil_jamais'))}</div>` + ouvrir;
    const clesVc = ms.map((m, i) => (m.deMoi === true ? '' : x.conv + ':vc' + i)).filter(Boolean);
    return `<div class="fil5" data-vc-fil="lu" data-vc-fil-n="${ms.length}">${ms.map((m, i) => `<div class="bulle${m.deMoi === true ? ' moi' : ''}" data-vc-msg="${m.deMoi === true ? 'moi' : m.deMoi === false ? 'autre' : 'passu'}"><small>${esc(m.deMoi === true ? TU('vc_toi') : m.deMoi === false ? TU('vc_lui') : TU('vc_auteur_passu'))}${m.at ? ' · ' + esc(depuis(m.at)) : ''}${m.vrm ? ' · ' + esc(TU('vc_depuis_vrm')) : ''}</small>${esc(m.t)}${m.deMoi === true ? '' : tradBulle(x.conv + ':vc' + i, m.t || '', '')}</div>`).join('')}</div>` + tradAbsente(clesVc)
      + (f.data.ouverte ? '' : `<p class="note5" data-vc-pas-ouverte>${esc(TU('vc_pas_ouverte'))}</p>${ouvrir}`);
  }
  function convHtml(x, ici) {
    const vc = listes && listes.plateforme === 'vestiaire';
    return `<div class="conv5" data-conv-ouverte="${esc(x.conv)}">${x.photo ? `<img class="conv5-ph" src="${esc(x.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<div class="conv5-t"><b>${esc(x.qui || '—')}</b><span>${esc(x.at ? depuis(x.at) : '')}</span></div>` + noteConvHtml(x)
      + (vc ? filVcHtml(x) : (() => {
        // 5.430 : la question de l'acheteur repérée par la règle des réponses rapides (sinon le dernier message), sa langue.
        const rr = rrParConv[x.conv] && rrParConv[x.conv].data, q = rr && rr.question ? String(rr.question) : '';
        const cle = x.conv + ':d', ind = rr && rr.langueIndice ? rr.langueIndice : '';
        const h = `<div class="bulle" data-conv-texte>${esc(x.texte || '')}</div>` + tradBulle(cle, x.texte || '', ind);
        if (q && q !== x.texte) { langueTexte(x.conv + ':q', q, ind); }
        // La langue reconnue par le navigateur choisit SES versions dans cette langue (une seule relecture).
        const lq = trads[x.conv + ':q'] && trads[x.conv + ':q'].lang || trads[cle] && trads[cle].lang;
        if (rr && lq && ['fr', 'en', 'es', 'it', 'de'].includes(lq) && lq !== rr.langue && rrParConv[x.conv].langueAcheteur !== lq) rrCharger(x.conv, lq);
        return h + tradAbsente([cle, x.conv + ':q']);
      })())
      // 5.409 : répondre ICI, sur SON toucher — le même chemin que la réponse depuis l'app (garde stricte, 50/h, réserve,
      // pause, compte de l'onglet ; `repondreCarte` dans le fond). Le fil complet reste sur Vinted (« Ouvrir »).
      // 5.421 : SES réponses rapides, reconnues dans la question de l'acheteur (mots-clés, sans IA), remplies par identité.
      + rrHtml(x)
      + `<div class="rep5"><textarea data-rep-texte="${esc(x.conv)}" rows="3" maxlength="1000" placeholder="${esc(TU('m_ecrire'))}" aria-label="${esc(TU('m_ecrire'))}">${esc(brouillons.get(x.conv) || '')}</textarea>` + tradRepHtml(x.conv)
      + `${repConv[x.conv] ? `<div class="${repConv[x.conv].ok ? 'val' : 'err'}" role="status" data-rep-etat="${repConv[x.conv].ok ? 'ok' : 'refus'}">${esc(repConv[x.conv].texte)}</div>${repConv[x.conv].url ? `<a class="vu-btn vu-sec" href="${esc(repConv[x.conv].url)}" target="_top" data-vc-ouvrir="${esc(x.conv)}">${esc(TU('vc_ouvrir_conv'))}</a>` : ''}` : ''}`
      + `<div class="ge5"><button type="button" class="vu-btn vu-plein" data-rep-envoyer="${esc(x.conv)}"${(brouillons.get(x.conv) || '').trim() && !repEnVol ? '' : ' disabled'}>${esc(repEnVol ? TU('m_envoi') : TU('m_envoyer'))}</button>${listes && listes.plateforme === 'leboncoin' ? `<a class="vu-btn vu-sec" href="https://www.leboncoin.fr/messages" target="_top" data-geste="repondre">${esc(TU('m_ouvrir_site'))}</a>` : listes && listes.plateforme === 'vestiaire' ? '' : `<a class="vu-btn vu-sec" href="${esc(ici + '/inbox/' + x.conv)}" target="_top" data-geste="repondre">${esc(TU('m_ouvrir_vinted'))}</a>`}</div></div></div>`;
  }
  // 5.412 — VESTIAIRE · FAVORIS : les personnes qui ont AIMÉ les articles de CE compte (Vestiaire les nomme sur ses
  // notifications ; VRM ne garde que leur identifiant, dans CE navigateur). « Leur écrire » : ouvrir SA conversation
  // sur Vestiaire (dans cet onglet), puis écrire dans Messages — sur SON toucher, par l'interface de la page, une
  // personne à la fois. Aucun envoi automatique, aucun nom affiché.
  let aimesVc = null;
  function aimesVcHtml() {
    if (!aimesVc) { aimesVc = { charge: true }; try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'aimesVcCarte' }, (r) => { void chrome.runtime.lastError; aimesVc = r && r.ok ? { data: r } : { raison: (r && r.raison) || TU('vc_fil_pas_su') }; rendre(); }); } catch (_) {} }
    if (aimesVc.charge) return `<div class="val gris" role="status" data-vc-aimes="charge">${esc(TU('m_charge'))}</div>`;
    if (!aimesVc.data) return `<div class="val gris" data-vc-aimes="pas-su">${esc(aimesVc.raison)}</div>`;
    const d = aimesVc.data;
    const tete = `<p class="note5" data-vc-aimes-note>${esc(TU('vc_aimes_note'))}</p>` + (d.appris ? '' : `<p class="note5" data-vc-aimes-appris="non">${esc(TU('vc_pas_appris'))}</p>`);
    if (!d.articles.length) return tete + `<div class="val gris" data-vc-aimes="0">${esc(TU(d.sansArticle ? 'vc_aimes_sans_article' : 'vc_aimes_aucun'))}</div>`;
    return tete + `<ul class="rangs" data-vc-aimes="${d.articles.length}">${d.articles.map((a) => `<li data-vc-aime-article="${esc(a.produit)}"><div class="rang">${a.photo ? `<img class="vig" src="${esc(a.photo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '<span class="vig" aria-hidden="true"></span>'}<span class="mil"><span class="ti">${esc(a.titre || '—')}</span><span class="me">${esc(TU('vc_aimes_n', { n: a.n, e: a.ecrits }))}</span></span></div>`
      + `<div class="ge5">${a.gens.map((g, i) => `<a class="vu-btn vu-sec" href="${esc(g.url)}" target="_top" data-vc-aime="${g.ecrit ? 'ecrit' : 'a-ecrire'}">${esc(TU(g.ecrit ? 'vc_aime_ecrit' : 'vc_aime_ecrire', { n: i + 1 }))}${g.at ? ' · ' + esc(depuis(g.at)) : ''}</a>`).join('')}</div></li>`).join('')}</ul>`;
  }
  // 5.410 (comme Vintex) : l'avatar de l'acheteur (sa photo Vinted, sinon son initiale sur un rond neutre).
  const avatar6 = (x) => (x.avatar ? `<img class="av6" src="${esc(x.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="av6" aria-hidden="true">${esc(String(x.qui || '?').trim().charAt(0).toUpperCase() || '?')}</span>`);
  function messagesHtml() {
    if (listesErreur) return `<div class="val gris" role="status">${esc(listesErreur)}</div>`;
    if (!listes) return `<div class="val gris" role="status" data-listes-charge>${esc(TU('m_charge'))}</div>`;
    const m = listes.messages;
    if (!m) return `<div class="val gris" data-messages="pas_su">${esc(TU('m_pas_su'))}</div>`;
    if (!m.liste.length) return m.site ? `<div class="val gris" data-messages="0" data-messages-site="${esc(m.site)}">${esc(m.nonlusSite != null ? TU('m_site_nonlus', { n: m.nonlusSite }) : TU('m_site_rien'))}</div>` : `<div class="val gris" data-messages="0">${esc(TU('m_aucun'))}</div>`;
    const ici = ORIGINE_ICI && !LISTES ? ORIGINE_ICI : 'https://www.vinted.fr';
    const nl = m.liste.filter((x) => x.nonlu).length;
    const q = msgCherche.trim().toLowerCase();
    let vus = m.liste.filter((x) => (!msgNonLus || x.nonlu) && (!q || String(x.qui).toLowerCase().includes(q) || String(x.texte).toLowerCase().includes(q)));
    // 5.425 : le tri des conversations (Vinted, grand panneau) — groupes, urgentes d'abord, la raison sur la rangée.
    const triOn = !LISTES && carte.hasAttribute('data-grand') && listes.plateforme === 'vinted';
    if (triOn && !tcEnVol && (!tcEtat || tcPour !== (Number(listesAt) || 0))) chargerTri();
    if (triOn) vus = triFiltrer(vus);
    const lu = depuis(m.lu);
    // 5.412 : sur Vestiaire, la conversation que la PAGE montre (`/chat?id=…`) est choisie d'office — c'est d'elle que part l'envoi.
    if (!convChoisie && !LISTES && listes.plateforme === 'vestiaire') { try { const q = new URLSearchParams(location.search).get('id') || ''; if (q && m.liste.some((x) => x.conv === q)) convChoisie = q; } catch (_) {} }
    const choisie = vus.find((x) => x.conv === convChoisie) || null;
    const outils = LISTES ? '' : (triOn ? triHtml() : '') + `<div class="outils5"><input type="search" class="cherche5" data-msg-cherche placeholder="${esc(TU('m_chercher'))}" aria-label="${esc(TU('m_chercher'))}" value="${esc(msgCherche)}"><button type="button" class="filtre5" data-msg-nonlus aria-pressed="${msgNonLus ? 'true' : 'false'}">${esc(TU('m_filtre_nonlus', { n: nl }))}</button></div>`;
    const liste = `<ul class="rangs" data-messages="${vus.length}" data-defil="messages">${vus.map((x) => LISTES
      ? `<li><a class="rang${x.nonlu ? ' nonlu' : ''}" data-conv="${esc(x.conv)}" href="${esc(ici + '/inbox/' + x.conv)}" target="_blank" rel="noopener">${vignette(x.photo)}<span class="mil"><span class="ti">${esc(x.qui || '—')}</span><span class="me">${esc(x.texte || '')}</span></span></a></li>`
      : `<li${x.conv === convChoisie ? ' data-ouverte' : ''}><button type="button" class="rang${x.nonlu ? ' nonlu' : ''}" data-conv="${esc(x.conv)}" data-conv-b="${esc(x.conv)}" aria-pressed="${x.conv === convChoisie ? 'true' : 'false'}">${avatar6(x)}<span class="mil"><span class="ti">${x.nonlu ? '<i class="pt5" aria-label="non lu"></i>' : ''}${esc(x.qui || '—')}</span><span class="me">${esc(x.at ? depuis(x.at) : '')}${x.texte ? ' · ' + esc(x.texte) : ''}</span>${triOn ? tcRaison(x.conv) : ''}</span>${x.photo ? `<img class="vig6" src="${esc(x.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</button>${x.conv === convChoisie ? `<div class="conv5-sous">${convHtml(x, ici)}</div>` : ''}</li>`).join('')}</ul>`;
    const tete = `<div class="lu" data-messages-nonlus="${nl}">${esc(nl ? TU('m_nonlus', { n: nl }) : TU('m_tous_lus'))}${lu ? ' · ' + esc(TU('c_lu', { quand: lu })) : ''}</div>`;
    if (LISTES) return tete + liste;
    const droite = `<div class="volet5" data-volet-conv="${choisie ? esc(choisie.conv) : ''}">${choisie ? offresHtml(choisie.conv) + convHtml(choisie, ici) : `<div class="vide5"><b>${esc(TU('m_choisir'))}</b><span>${esc(TU('m_choisir_note'))}</span></div>`}</div>`;
    return `${carte.hasAttribute('data-grand') && !LISTES ? offresHtml() : ''}<div class="deux5"><div class="gauche5">${outils}${tete}${vus.length ? liste : `<div class="val gris" data-messages-filtre="0">${esc(TU('m_aucun_filtre'))}</div>`}</div>${droite}</div>`;
  }
  // ══ 5.409 — AUTOMATISATIONS (capture « Automatisations » de Vintex) : l'état LU de ses vrais réglages — messages
  //    aux favoris (versions tirées au hasard, rythme, mode automatique et ses délais), offres auto (prix mini posés),
  //    baisse automatique (pas encore livrée : dit). Ils se changent dans VRM (les mêmes clés, le même serveur) : la
  //    carte n'écrit pas `main` (l'extension n'écrit JAMAIS la ligne `main`, CLAUDE.md §5).
  const pastilleEtat = (on) => `<span class="et5" data-etat="${on === true ? 'on' : on === false ? 'off' : 'pas-su'}">${esc(TU(on === true ? 'au_active' : on === false ? 'au_desactive' : 'au_pas_su'))}</span>`;
  // ══ 5.410 — AUTOMATISATIONS EN DEUX VOLETS (comme Vintex) : à gauche la liste des automatismes avec leur état
  //    « Activé / Désactivé » (LU dans les vrais réglages) ; à droite le détail en sections MESSAGES · CIBLAGE · DÉLAIS
  //    (négociation : l'aperçu « 100 → 93 → 88 → 85 »), en bas « Modifier dans VRM » et un plein « Démarrer ». Les
  //    réglages se changent dans VRM (l'extension n'écrit jamais la ligne `main`) ; « Démarrer » des favoris ouvre le
  //    parcours pas à pas de la carte (rien ne part sans SA confirmation).
  let autoChoisie = 'favoris', autoDetail = false;   // 5.410.1 : au téléphone, le détail est une page poussée
  let raBrouillon = {}, raConfirme = null, raEtat = null, raEnVol = false;   // 5.410 : réglages écrits depuis le panneau
  const apercuPaliers6 = (pcts) => { const p = 100, f = 85, out = [p]; for (const pct of (pcts || []).slice().sort((a, b) => a - b)) { let v = Math.round(p - (p - f) * pct / 100); if (v < f) v = f; if (v < p && v < out[out.length - 1]) out.push(v); } return out; };
  // ══ 5.410.4 — « COMME BLEAM », LA SUITE : après-vente, stock auto, cycle de vie, filtres + analyse des favoris,
  //    sauvegarde horaire, dressing amélioré — chaque section se règle ICI (vinted_bleam.comptes[uid][section]), éteinte
  //    par défaut ; allumer passe par « Oui, allumer » ; le fond relit et normalise (règle partagée).
  const BM_ITEMS = ['apresvente', 'stockauto', 'cycle', 'favfiltres', 'sauvegarde', 'dressing'];
  const BM_SECTIONS_DE = { agent: ['agent'], relance: ['relanceOffres'], lot: ['lotFavoris'], brouillons: ['brouillonsAuto'], precieux: ['precieux'], apresvente: ['bordereau', 'msgVente', 'msgFinalise', 'msgRelais', 'msgEvaluation', 'eval5'], stockauto: ['stockAuto'], cycle: ['cycle'], favfiltres: ['favoris'], sauvegarde: ['sauvegarde'], dressing: ['dressing'] };
  // Les clés de texte écrites EN ENTIER (audit-extension-feuille L3 : chaque clé utilisée existe).
  const BM_TITRE = { agent: 'ag_titre', relanceOffres: 'rel_titre', lotFavoris: 'lot_auto_titre', brouillonsAuto: 'bm_brouillons', precieux: 'pr_titre', bordereau: 'bm_s_bordereau', msgVente: 'bm_s_msgVente', msgFinalise: 'bm_s_msgFinalise', msgRelais: 'bm_s_msgRelais', msgEvaluation: 'bm_s_msgEvaluation', eval5: 'bm_s_eval5', stockAuto: 'bm_s_stockAuto', cycle: 'bm_s_cycle', favoris: 'bm_s_favoris', sauvegarde: 'bm_s_sauvegarde', dressing: 'bm_s_dressing' };
  const BM_JOUR = ['bm_j0', 'bm_j1', 'bm_j2', 'bm_j3', 'bm_j4', 'bm_j5', 'bm_j6'];
  const BM_TRI = { recentes: 'bm_tri_recentes', anciennes: 'bm_tri_anciennes', vues_plus: 'bm_tri_vues_plus', vues_moins: 'bm_tri_vues_moins', favoris: 'bm_tri_favoris', prix_bas: 'bm_tri_prix_bas', prix_haut: 'bm_tri_prix_haut', republiees: 'bm_tri_republiees' };
  const BM_STRAT_NOTE = { anti: 'bm_anti_note', destock: 'bm_destock_note', vierge: 'bm_vierge_note' };
  let bmBrouillon = {}, bmConfirme = null, bmEtat = null, bmEnVol = false, bmAnalyse = null;
  const bmLu = (s) => { const b = listes && listes.automatisations && listes.automatisations.bleam; return b && b[s] ? b[s] : null; };
  const bmVal = (s) => Object.assign({}, bmLu(s) || {}, bmBrouillon[s] || {});
  const bmOnItem = (id) => { const b = listes && listes.automatisations && listes.automatisations.bleam; if (!b) return null; return BM_SECTIONS_DE[id].some((s) => b[s] && b[s].actif === true); };
  const lignes6 = (l) => (Array.isArray(l) ? l : []).join('\n');
  function bmSectionHtml(s, corps, titre, note) {
    const v = bmVal(s), on = v.actif === true;
    return `<section class="sec6" data-bm-section="${s}"><h3>${esc(TU(titre))}</h3><div class="rg6"><span><b>${esc(TU('ra_etat'))}</b>${note ? `<small>${esc(TU(note))}</small>` : ''}</span><button type="button" class="vu-btn ra6" data-bm-bascule="${s}" aria-pressed="${on}">${esc(TU(on ? 'ra_eteindre' : 'ra_allumer'))}</button></div>${corps || ''}</section>`;
  }
  const bmTexte = (s, k, lab, note) => `<label class="champ6"><b>${esc(TU(lab))}</b>${note ? `<small>${esc(TU(note))}</small>` : ''}<textarea data-bm-champ="${s}.${k}" data-bm-lignes maxlength="5000" rows="3">${esc(lignes6(bmVal(s)[k]))}</textarea></label>`;
  const bmNombre = (s, k, lab, min, max) => `<label class="champ6"><b>${esc(TU(lab))}</b><input type="number" min="${min}" max="${max}" step="1" data-bm-champ="${s}.${k}" value="${esc(bmVal(s)[k] != null ? bmVal(s)[k] : '')}"></label>`;
  const bmSeg = (s, k, choix) => `<div class="vu-seg vue5" role="group" data-bm-seg="${s}.${k}">${choix.map(([x, l]) => `<button type="button" data-bm-choix="${s}.${k}" data-bm-v="${x}" aria-pressed="${String(bmVal(s)[k]) === String(x)}">${esc(TU(l))}</button>`).join('')}</div>`;
  function bleamDetailHtml(id) {
    if (!listes.automatisations.bleam) return `<p class="note5">${esc(TU('au_pas_su'))}</p>`;
    const conf = bmConfirme ? `<div class="conf5" role="alertdialog" data-bm-confirme="${esc(bmConfirme.section)}"><p>${esc(TU('ra_confirme_q', { nom: TU(BM_TITRE[bmConfirme.section] || 'bm_s_cycle') }))}</p>${bmConfirme.section === 'agent' ? `<p data-ag-confirme-resume>${esc(TU('ag_confirme_resume'))}</p><p data-ag-confirme-essai>${esc(TU(bmVal('agent').essaiDemarrer === 'non' ? 'ag_confirme_reel' : 'ag_confirme_essai', { n: Number(bmVal('agent').essaiJours) || 3 }))}</p>` : bmConfirme.section === 'relanceOffres' ? `<p>${esc(TU('rel_confirme_auto'))}</p>` : ''}<div class="outils"><button type="button" class="vu-btn vu-plein" data-bm-oui>${esc(TU('ra_oui'))}</button><button type="button" class="vu-btn" data-bm-non>${esc(TU('ra_annuler'))}</button></div></div>` : '';
    const etat = bmEtat ? `<p class="note5" role="status" data-bm-etat="${bmEtat.ok ? 'ok' : 'ko'}">${esc(bmEtat.texte)}</p>` : '';
    let corps = '';
    if (id === 'agent') corps = agentDetailHtml() + precieuxBloqueHtml();
    else if (id === 'relance') corps = relanceDetailHtml();
    else if (id === 'lot') corps = lotAutoDetailHtml();
    else if (id === 'brouillons') corps = brouillonsDetailHtml();
    else if (id === 'apresvente') {
      corps = bmSectionHtml('bordereau', `<div class="rg6"><span><b>${esc(TU('bm_colissimo'))}</b><small>${esc(TU('bm_colissimo_note'))}</small></span>${bmSeg('bordereau', 'colissimo', [['relais', 'bm_relais'], ['boite', 'bm_boite']])}</div><p class="note5">${esc(TU('bm_ebay_jamais'))}</p>`, 'bm_s_bordereau', 'bm_bordereau_note')
        + bmSectionHtml('msgVente', bmTexte('msgVente', 'textes', 'bm_versions', 'bm_versions_note'), 'bm_s_msgVente')
        + bmSectionHtml('msgFinalise', bmTexte('msgFinalise', 'textes', 'bm_versions', 'bm_versions_note'), 'bm_s_msgFinalise')
        + bmSectionHtml('msgRelais', bmTexte('msgRelais', 'textes', 'bm_versions', 'bm_versions_note') + bmNombre('msgRelais', 'heures', 'bm_heures', 1, 168), 'bm_s_msgRelais', 'bm_relais_note')
        + bmSectionHtml('msgEvaluation', bmTexte('msgEvaluation', 'textes', 'bm_versions', 'bm_versions_note') + bmNombre('msgEvaluation', 'heures', 'bm_heures', 1, 168), 'bm_s_msgEvaluation', 'bm_litige_note')
        + bmSectionHtml('eval5', bmTexte('eval5', 'textes', 'bm_versions', 'bm_versions_note') + `<p class="note5">${esc(TU('bm_eval_appris'))}</p>`, 'bm_s_eval5', 'bm_litige_note');
    } else if (id === 'stockauto') {
      const st = bmVal('stockAuto').stock || {};
      const txt = bmBrouillon.stockAuto && bmBrouillon.stockAuto.stockTexte != null ? bmBrouillon.stockAuto.stockTexte : Object.entries(st).map(([k, n]) => `${k} = ${n}`).join('\n');
      corps = bmSectionHtml('stockAuto', `<label class="champ6"><b>${esc(TU('bm_quantites'))}</b><small>${esc(TU('bm_quantites_note'))}</small><textarea data-bm-champ="stockAuto.stockTexte" rows="4">${esc(txt)}</textarea></label><p class="note5">${esc(TU('bm_stock_identite'))}</p>`, 'bm_s_stockAuto');
    } else if (id === 'cycle') {
      const c = bmVal('cycle'), r = c.rythme || {};
      const etTxt = bmBrouillon.cycle && bmBrouillon.cycle.etapesTexte != null ? bmBrouillon.cycle.etapesTexte : (c.etapes || []).map((e) => e.action === 'republier' ? `${e.apres} republier` : `${e.apres} baisse ${e.pct}`).join('\n');
      const jours = Array.isArray(r.jours) ? r.jours : [0, 1, 2, 3, 4, 5, 6];
      corps = bmSectionHtml('cycle', `<div class="rg6"><span><b>${esc(TU('bm_strategie'))}</b></span>${bmSeg('cycle', 'strategie', [['anti', 'bm_anti'], ['destock', 'bm_destock'], ['vierge', 'bm_vierge']])}</div>`
        + `<p class="note5" data-bm-strategie-note>${esc(TU(BM_STRAT_NOTE[c.strategie] || BM_STRAT_NOTE.anti))}</p>`
        + ((c.strategie || 'anti') === 'vierge' ? `<label class="champ6"><b>${esc(TU('bm_etapes'))}</b><small>${esc(TU('bm_etapes_note'))}</small><textarea data-bm-champ="cycle.etapesTexte" rows="4">${esc(etTxt)}</textarea></label>${bmNombre('cycle', 'repeter', 'bm_repeter', 0, 90)}${bmNombre('cycle', 'plafondPct', 'bm_plafond', 1, 50)}` : '')
        + `<h3>${esc(TU('bm_rythme'))}</h3>`
        + `<label class="champ6"><b>${esc(TU('bm_repub_jour'))}</b><span class="cd6-l"><input type="number" min="0" max="50" data-bm-champ="cycle.r.repub.min" value="${esc((r.repub || {}).min)}" aria-label="min"> – <input type="number" min="0" max="50" data-bm-champ="cycle.r.repub.max" value="${esc((r.repub || {}).max)}" aria-label="max"></span></label>`
        + `<label class="champ6"><b>${esc(TU('bm_prix_jour'))}</b><span class="cd6-l"><input type="number" min="0" max="50" data-bm-champ="cycle.r.prix.min" value="${esc((r.prix || {}).min)}" aria-label="min"> – <input type="number" min="0" max="50" data-bm-champ="cycle.r.prix.max" value="${esc((r.prix || {}).max)}" aria-label="max"></span></label>`
        + `<div class="rg6 jours6"><span><b>${esc(TU('bm_jours'))}</b></span><div class="vu-seg vue5" role="group">${[1, 2, 3, 4, 5, 6, 0].map((j) => `<button type="button" data-bm-jour="${j}" aria-pressed="${jours.includes(j)}">${esc(TU(BM_JOUR[j]))}</button>`).join('')}</div></div>`
        + `<label class="champ6"><b>${esc(TU('bm_heures_plage'))}</b><span class="cd6-l"><input type="number" min="0" max="23" data-bm-champ="cycle.r.heureDebut" value="${esc(r.heureDebut)}" aria-label="début"> – <input type="number" min="1" max="24" data-bm-champ="cycle.r.heureFin" value="${esc(r.heureFin)}" aria-label="fin"></span></label>`
        + `<p class="note5">${esc(TU('bm_cycle_plancher'))}</p>`, 'bm_s_cycle');
    } else if (id === 'favfiltres') {
      const an = bmAnalyse;
      corps = bmSectionHtml('favoris', bmNombre('favoris', 'noteMin', 'bm_note_min', 0, 5) + bmNombre('favoris', 'parArticle', 'bm_par_article', 0, 50) + bmNombre('favoris', 'periodeJours', 'bm_periode', 0, 90) + bmNombre('favoris', 'apresMin', 'bm_apres_min', 0, 1440) + bmNombre('favoris', 'reecrireJours', 'bm_reecrire', 0, 30) + `<p class="note5">${esc(TU('bm_filtres_note'))}</p>`, 'bm_s_favoris')
        + `<section class="sec6" data-bm-analyse><h3>${esc(TU('bm_analyse'))}</h3><p class="note5">${esc(TU('bm_analyse_note'))}</p>`
        + (an && an.versions ? (an.versions.length ? `<div class="table5"><div class="tr5 th5"><span>${esc(TU('bm_version'))}</span><span>${esc(TU('bm_envoyes'))}</span><span>${esc(TU('bm_reponses'))}</span><span>${esc(TU('bm_taux'))}</span></div><ul class="rangs">${an.versions.map((v) => `<li class="tr5" data-bm-v-taux="${v.taux == null ? '' : v.taux}"><span>${esc(TU('rf_version', { n: v.version || '—' }))}</span><span class="cel5">${v.envoyes}</span><span class="cel5">${v.reponses} / ${v.relues}</span><span class="cel5">${v.taux == null ? '—' : v.taux + ' %'}</span></li>`).join('')}</ul></div>` : `<p class="val gris">${esc(TU('bm_analyse_vide'))}</p>`) : an && an.ko ? `<p class="val gris">—</p>` : '')
        + `<div class="outils"><button type="button" class="vu-btn" data-bm-analyser>${esc(TU('bm_analyser'))}</button></div></section>`;
    } else if (id === 'sauvegarde') {
      const sv = listes.automatisations.sauvegarde;
      corps = bmSectionHtml('sauvegarde', `<p class="note5" data-bm-sauve-at="${sv && sv.at ? sv.at : ''}">${esc(sv && sv.at ? TU('bm_sauve_derniere', { quand: depuis(sv.at), n: sv.n }) : TU('bm_sauve_jamais'))}</p>`, 'bm_s_sauvegarde', 'bm_sauve_note');
    } else if (id === 'dressing') {
      corps = bmSectionHtml('dressing', `<label class="champ6"><b>${esc(TU('bm_tri'))}</b><select class="act5" data-bm-champ="dressing.tri">${['recentes', 'anciennes', 'vues_plus', 'vues_moins', 'favoris', 'prix_bas', 'prix_haut', 'republiees'].map((k) => `<option value="${k}"${bmVal('dressing').tri === k ? ' selected' : ''}>${esc(TU(BM_TRI[k]))}</option>`).join('')}</select></label><div class="rg6"><span><b>${esc(TU('bm_filtre'))}</b></span>${bmSeg('dressing', 'filtre', [['toutes', 'bm_f_toutes'], ['sauvegardees', 'bm_f_sauve'], ['non', 'bm_f_non']])}</div><p class="note5">${esc(TU('bm_dressing_note'))}</p>`, 'bm_s_dressing');
    }
    return conf + etat + corps + `<div class="pied6" data-bm-pied="${id}"><button type="button" class="vu-lien" data-bm-reinit>${esc(TU('ra_reinit'))}</button><button type="button" class="vu-btn vu-plein" data-bm-enregistrer${bmEnVol ? ' disabled' : ''}>${esc(TU('ra_enregistrer'))}</button></div>`;
  }
  // La valeur d'une section telle qu'elle part (le fond la NORMALISE : bornes, textes, jamais un plafond).
  function bmValeurEnvoi(s, actif) {
    const v = bmVal(s), out = Object.assign({}, v, { actif });
    const lig = (t) => String(t == null ? '' : t).split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 5);
    if (Array.isArray(v.textes) === false && typeof v.textes === 'string') out.textes = lig(v.textes);
    if (s === 'stockAuto' && v.stockTexte != null) { const st = {}; for (const l of String(v.stockTexte).split('\n')) { const m = /^\s*([A-Za-z]{0,3}\s*\d{1,6})\s*[=:]\s*(\d{1,2})\s*$/.exec(l); if (m) st[m[1]] = Number(m[2]); } out.stock = st; delete out.stockTexte; }
    if (s === 'cycle') {
      if (v.etapesTexte != null) { out.etapes = String(v.etapesTexte).split('\n').map((l) => /^\s*(\d{1,2})\s*j?\s*(republier|baisse)\s*(\d{1,2})?/i.exec(l)).filter(Boolean).map((m) => m[2].toLowerCase() === 'republier' ? { apres: Number(m[1]), action: 'republier' } : { apres: Number(m[1]), action: 'baisse', pct: Number(m[3]) }); delete out.etapesTexte; }
      const r = Object.assign({}, (bmLu('cycle') || {}).rythme || {}, v.rythme || {});
      out.rythme = r; delete out.r;
    }
    for (const k of ['heures', 'noteMin', 'parArticle', 'periodeJours', 'apresMin', 'reecrireJours', 'repeter', 'plafondPct', 'jours', 'taux', 'essaiJours']) if (out[k] != null && out[k] !== '') out[k] = Number(out[k]);
    // 5.421 : l'Agent VRM — oui/non en booléens, heures calmes ; au PREMIER allumage, le mode Essai (proposé par défaut).
    if (s === 'noteAcheteurs') { out.seuil = Number(out.seuil); out.neufAccepter = !(out.neufAccepter === false || out.neufAccepter === 'non'); delete out.actif; }
    if (s === 'agent') {
      for (const k of ['negocier', 'repondre']) if (out[k] === 'oui' || out[k] === 'non') out[k] = out[k] === 'oui';
      const lu = bmLu('agent') || {};
      const de = v.hcDe != null && v.hcDe !== '' ? Number(v.hcDe) : (lu.heuresCalmes || {}).de, a = v.hcA != null && v.hcA !== '' ? Number(v.hcA) : (lu.heuresCalmes || {}).a;
      if (de != null && a != null) out.heuresCalmes = { de, a };
      delete out.hcDe; delete out.hcA;
      if (actif && lu.actif !== true) {
        out.allumeAt = Date.now();
        const j = Number(out.essaiJours != null ? out.essaiJours : 3);
        out.essaiJusqua = out.essaiDemarrer !== 'non' && j > 0 ? Date.now() + j * 86400000 : null;
      }
      delete out.essaiDemarrer;
    }
    return out;
  }
  function bmEnvoyer(s, actif, confirme, fin) {
    const uid = listes && listes.compte && listes.compte.id;
    bmEnVol = true; bmEtat = null; rendre();
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'reglageAuto', cle: 'vinted_bleam', valeur: { uid, section: s, valeur: bmValeurEnvoi(s, actif) }, confirme: confirme === true }, (r) => {
        void chrome.runtime.lastError; bmEnVol = false;
        if (r && r.code === 'confirmation') { bmConfirme = { section: s }; }
        else { bmConfirme = null; bmEtat = { ok: !!(r && r.ok), texte: r && r.ok ? TU('ra_ok') : ((r && r.raison) || TU('ra_ko')) }; if (r && r.ok) { delete bmBrouillon[s]; chargerListes(true); } }
        rendre(); if (fin) fin(r);
      });
    } catch (_) { bmEnVol = false; bmEtat = { ok: false, texte: TU('ra_ko') }; rendre(); }
  }
  function brancherBleam(racine) {
    const br = (s) => (bmBrouillon[s] = bmBrouillon[s] || {});
    racine.querySelectorAll('[data-bm-champ]').forEach((c) => c.addEventListener('input', () => {
      const [s, ...ch] = c.getAttribute('data-bm-champ').split('.'); const b = br(s);
      const v = c.hasAttribute('data-bm-lignes') ? c.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 5) : c.value;
      if (ch[0] === 'r') { const r = (b.rythme = Object.assign({}, (bmLu(s) || {}).rythme || {}, b.rythme || {})); if (ch.length === 3) r[ch[1]] = Object.assign({}, r[ch[1]] || {}, { [ch[2]]: Number(v) }); else r[ch[1]] = Number(v); }
      else b[ch[0]] = v;
    }));
    racine.querySelectorAll('select[data-bm-champ]').forEach((c) => c.addEventListener('change', () => { const [s, k] = c.getAttribute('data-bm-champ').split('.'); br(s)[k] = c.value; }));
    racine.querySelectorAll('[data-bm-choix]').forEach((b) => b.addEventListener('click', () => { const [s, k] = b.getAttribute('data-bm-choix').split('.'); br(s)[k] = b.getAttribute('data-bm-v'); rendre(); }));
    racine.querySelectorAll('[data-bm-jour]').forEach((b) => b.addEventListener('click', () => { const b0 = br('cycle'); const r = (b0.rythme = Object.assign({}, (bmLu('cycle') || {}).rythme || {}, b0.rythme || {})); const j = Number(b.getAttribute('data-bm-jour')); const l = Array.isArray(r.jours) ? r.jours.slice() : [0, 1, 2, 3, 4, 5, 6]; r.jours = l.includes(j) ? l.filter((x) => x !== j) : [...l, j]; rendre(); }));
    racine.querySelectorAll('[data-bm-bascule]').forEach((b) => b.addEventListener('click', () => { const s = b.getAttribute('data-bm-bascule'); const on = bmVal(s).actif === true; if (on) bmEnvoyer(s, false, false); else { bmConfirme = { section: s }; bmEtat = null; rendre(); } }));
    const oui = racine.querySelector('[data-bm-oui]'); if (oui) oui.addEventListener('click', () => { const c = bmConfirme; bmConfirme = null; if (c) bmEnvoyer(c.section, true, true); });
    const non = racine.querySelector('[data-bm-non]'); if (non) non.addEventListener('click', () => { bmConfirme = null; rendre(); });
    const re = racine.querySelector('[data-bm-reinit]'); if (re) re.addEventListener('click', () => { bmBrouillon = {}; bmConfirme = null; bmEtat = null; rendre(); });
    const en = racine.querySelector('[data-bm-enregistrer]'); if (en) en.addEventListener('click', () => {
      const ss = Object.keys(bmBrouillon).filter((s) => (BM_SECTIONS_DE[autoChoisie] || []).includes(s));
      if (!ss.length) { bmEtat = { ok: true, texte: TU('ra_rien') }; rendre(); return; }
      const suite = () => { const s = ss.shift(); if (s) bmEnvoyer(s, bmVal(s).actif === true, false, (r) => { if (r && r.ok) suite(); }); };
      suite();
    });
    const an = racine.querySelector('[data-bm-analyser]'); if (an) an.addEventListener('click', () => { try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'analyseFavoris' }, (r) => { void chrome.runtime.lastError; bmAnalyse = r && r.ok ? r : { ko: true }; rendre(); }); } catch (_) { bmAnalyse = { ko: true }; rendre(); } });
  }
  // 5.410.4 — la négociation « comme Bleam » : tranches de prix, rester flexible, arrondi, bonus de lot, messages par
  //    étape ({price}), délais. Le plancher absolu (prix mini / achat + 10 %) n'est PAS réglable : il est dit.
  const tranchesTexte = (l) => (Array.isArray(l) ? l : []).map((x) => `${x.de}-${x.a}:${x.baisse}`).join('\n');
  const tranchesLues = (t) => String(t || '').split('\n').map((l) => /^\s*(\d+(?:[.,]\d+)?)\s*[-–à]\s*(\d+(?:[.,]\d+)?)\s*[:=]\s*(\d+(?:[.,]\d+)?)\s*$/.exec(l)).filter(Boolean).map((m) => ({ de: Number(m[1].replace(',', '.')), a: Number(m[2].replace(',', '.')), baisse: Number(m[3].replace(',', '.')) }));
  function paliersPlusHtml(pa, b0) {
    const tr = b0.tranches != null ? tranchesLues(b0.tranches) : (pa.tranches || []);
    const ex = tr[0] ? (() => { const p = Math.round((tr[0].de + tr[0].a) / 2); return TU('pp_exemple', { p, b: Math.ceil((p - tr[0].baisse) * 100) / 100 }); })() : TU('pp_exemple_vide');
    const fx = b0.flexible != null ? b0.flexible === 'oui' : Number(pa.flexible) > 0;
    const pas = b0.pas != null ? Number(b0.pas) : (pa.pas === 0.5 ? 0.5 : 1);
    const lg = (k) => esc(b0[k] != null ? b0[k] : (Array.isArray(pa[k]) ? pa[k].join('\n') : ''));
    const d = pa.delais || {};
    const intel = b0.intel != null ? b0.intel === 'oui' : pa.intelligente === true;
    return `<section class="sec6" data-paliers-plus><div class="rg6" data-pp-intelligente="${intel ? 'oui' : 'non'}"><span><b>${esc(TU('pp_intel'))}</b><small>${esc(TU(intel ? 'pp_intel_note' : 'pp_fixe_note'))}</small></span><div class="vu-seg vue5" role="group">${['oui', 'non'].map((k) => `<button type="button" data-pp-intel="${k}" aria-pressed="${(k === 'oui') === intel}">${esc(TU(k === 'oui' ? 'pp_intel_oui' : 'pp_intel_non'))}</button>`).join('')}</div></div><h3>${esc(TU('pp_tranches'))}</h3><label class="champ6"><b>${esc(TU('pp_tranches_l'))}</b><small>${esc(TU('pp_tranches_note'))}</small><textarea data-ra-champ="tranches" rows="3">${esc(b0.tranches != null ? b0.tranches : tranchesTexte(pa.tranches))}</textarea></label><p class="apercu6" data-pp-exemple>${esc(ex)}</p>`
      + `<div class="rg6"><span><b>${esc(TU('pp_flexible'))}</b><small>${esc(TU('pp_flexible_note'))}</small></span><div class="vu-seg vue5" role="group">${['non', 'oui'].map((k) => `<button type="button" data-pp-flexible="${k}" aria-pressed="${(k === 'oui') === fx}">${esc(TU(k === 'oui' ? 'pp_oui' : 'pp_non'))}</button>`).join('')}</div></div>`
      + `<label class="champ6"><b>${esc(TU('pp_ecart'))}</b><input type="number" min="0.5" max="10" step="0.5" data-ra-champ="ecart" value="${esc(b0.ecart != null ? b0.ecart : (Number(pa.flexible) > 0 ? pa.flexible : 2))}"></label>`
      + `<div class="rg6"><span><b>${esc(TU('pp_arrondi'))}</b></span><div class="vu-seg vue5" role="group">${[1, 0.5].map((k) => `<button type="button" data-pp-pas="${k}" aria-pressed="${pas === k}">${esc(k === 1 ? '1 €' : '0,50 €')}</button>`).join('')}</div></div>`
      + `<label class="champ6"><b>${esc(TU('pp_bonus'))}</b><small>${esc(TU('pp_bonus_note'))}</small><input type="number" min="0" max="50" step="1" data-ra-champ="bonusLot" value="${esc(b0.bonusLot != null ? b0.bonusLot : (pa.bonusLot || ''))}"></label>`
      + `<h3>${esc(TU('pp_messages'))}</h3><p class="note5">${esc(TU('pp_messages_note'))}</p>`
      + [['msgAccepte', 'pp_msgAccepte'], ['msgContre', 'pp_msgContre'], ['msgFinale', 'pp_msgFinale']].map(([k, l]) => `<label class="champ6"><b>${esc(TU(l))}</b><textarea data-ra-champ="${k}" rows="2">${lg(k)}</textarea></label>`).join('')
      + `<label class="champ6"><b>${esc(TU('pp_delais'))}</b><span class="cd6-l"><input type="number" min="1" max="240" data-ra-champ="delaiMin" value="${esc(b0.delaiMin != null ? b0.delaiMin : (d.min || ''))}" aria-label="min"> – <input type="number" min="2" max="240" data-ra-champ="delaiMax" value="${esc(b0.delaiMax != null ? b0.delaiMax : (d.max || ''))}" aria-label="max"></span></label>`
      + `<p class="note5" data-pp-plancher>${esc(TU('pp_plancher_absolu'))}</p></section>`;
  }
  // 5.437 : le BILAN du jour du mode auto (le fond le tient dans `vrmPiloteFavoris.bilan`, par compte) — envoyés, sautés et pourquoi.
  let pfBilan = null, pfBilanLu = 0;
  function bilanAutoFavHtml() {
    if (Date.now() - pfBilanLu > 15000) { pfBilanLu = Date.now(); try { chrome.storage.local.get('vrmPiloteFavoris', (r) => { void chrome.runtime.lastError; const b = r && r.vrmPiloteFavoris && r.vrmPiloteFavoris.bilan; const avant = JSON.stringify(pfBilan); pfBilan = b || {}; if (JSON.stringify(pfBilan) !== avant) rendre(); }); } catch (_) {} }
    const uid = listes && listes.compte && listes.compte.id; const c = pfBilan && uid ? pfBilan[String(uid)] : null;
    const auj = new Date().toISOString().slice(0, 10);
    if (!c || c.j !== auj) return `<p class="note5" data-fav-auto-bilan="0">${esc(TU('fa_bilan_rien'))}</p>`;
    const RS = { annonce_indisponible: 'fa_r_vendu', sous_prix_mini: 'fa_r_mini', deja_contacte: 'fa_r_contacte', favori_trop_ancien: 'fa_r_ancien' };
    const s = Object.entries(c.sautes || {}).map(([k, n]) => `${n} ${TU(RS[k] || (/filtre|contact/.test(k) ? 'fa_r_contacte' : 'fa_r_autre'))}`).join(' · ');
    return `<p class="note5" data-fav-auto-bilan="${Number(c.envoyes) || 0}">${esc(TU('fa_bilan', { n: Number(c.envoyes) || 0 }))}${s ? ' · ' + esc(TU('fa_sautes', { l: s })) : ''}</p>`;
  }
  // 5.420 : le récapitulatif montré UNE fois au moment d'allumer l'automatique — le message rendu sur un exemple par la
  // règle de l'envoi (`favorisPerso · envoi`, un favori de la liste, sinon le modèle), le taux, les plafonds, le plancher.
  let autoRecap = null;
  function autoRecapHtml(f, fa) {
    const taux = f && f.offre && f.offre.mode === 'pct' ? Number(f.offre.pct) : null;
    if (!autoRecap) {
      autoRecap = { info: null };
      const ex = apercuFav ? favTous(apercuFav).slice(0, 1).map((x) => ({ itemId: String(x.itemId || ''), prix: x.prix, pseudo: x.pseudo || '', titre: x.titre || '' })) : [];
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'favorisPerso', quoi: 'envoi', taux, items: ex, ancien: { message: ((f && f.textes) || [])[0] || '', variantes: ((f && f.textes) || []).slice(1) }, texte: null }, (r) => { void chrome.runtime.lastError; if (autoRecap) { autoRecap.info = r && r.ok ? r : { ok: false }; rendre(); } }); } catch (_) {}
    }
    const m = autoRecap.info && autoRecap.info.ok && autoRecap.info.message && autoRecap.info.message.ok ? autoRecap.info.message.texte : (f && f.textes && f.textes[0]) || '';
    return `<ul class="et10-r" data-fav-auto-allumer><li data-fav-r="taux" data-taux="${taux == null ? '' : taux}"><span>${esc(TU('e10_reduction'))}</span><b>${esc(taux ? TU('e10_r_taux', { t: taux }) : TU('fr_sans_offre'))}</b></li>`
      + `<li data-fav-r="message"><span>${esc(TU('e10_exemple'))}</span><b>${esc(m || '—')}</b></li>`
      + `<li data-fav-r="plafond"><span>${esc(TU('au_plafonds'))}</span><b>${esc(fa && fa.parHeure ? TU('au_par', { h: fa.parHeure, j: fa.parJour || '—' }) : '—')}</b></li>`
      + `<li data-fav-r="plancher"><span>${esc(TU('e10_plancher'))}</span><b>${esc(TU('e9_plancher'))}</b></li></ul>`;
  }
  // ══ 5.421 (21 nov., Julien, choix n° 4, 5, 6 + l'agent) — RÉPONSES RAPIDES · LOTS AUX FAVORIS · À RELANCER · AGENT VRM ══
  // Tout ce qui part, part sur SON toucher (« Envoyer », « Envoyer le lot », « Relancer », « Oui, allumer ») par le chemin
  // gardé du fond (interface de la page, compte de l'onglet, plafonds). Les règles sont dans le fond (blocs recopiés).
  const RR_CATS = ['dispo', 'taille', 'envoi', 'lot', 'prix', 'etat', 'authenticite', 'photos', 'echange'];
  const RR_LIB = { dispo: 'rr_c_dispo', taille: 'rr_c_taille', envoi: 'rr_c_envoi', lot: 'rr_c_lot', prix: 'rr_c_prix', etat: 'rr_c_etat', authenticite: 'rr_c_authenticite', photos: 'rr_c_photos', echange: 'rr_c_echange' };
  const RR_MANQUE = { taille: 'rr_m_taille', prix: 'rr_m_prix', article: 'rr_m_article', pseudo: 'rr_m_pseudo', partie: 'rr_m_partie', prix_mini_cache: 'rr_m_mini', texte_interdit: 'rr_m_interdit' };
  const rrParConv = {}; const rrEnvoi = {};
  function rrCharger(conv, langueAcheteur) {
    rrParConv[conv] = { charge: true, langueAcheteur: langueAcheteur || '' };
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'reponsesRapides', conv, langue: U.langue ? U.langue() : 'fr', ...(langueAcheteur ? { langueAcheteur } : {}) }, (r) => { void chrome.runtime.lastError; rrParConv[conv] = r && r.ok ? { data: r, langueAcheteur: langueAcheteur || '' } : { raison: (r && r.raison) || TU('rr_pas_su') }; rendre(); }); } catch (_) { rrParConv[conv] = { raison: TU('rr_pas_su') }; }
  }
  // ══ 5.430 (choix n° 69) — TRADUIRE, SUR L'APPAREIL : la langue d'un message reconnue par le navigateur (LanguageDetector
  //    de Chrome ; sinon l'indice simple que la règle des réponses rapides a lu dans la question), « Traduire » l'affiche
  //    traduit SOUS l'original (Translator de Chrome). Aucun service en ligne, aucune clé (§2.9). Navigateur sans ces API ⇒
  //    pas de bouton, UNE ligne qui dit pourquoi. Sa réponse peut être traduite vers la langue de l'acheteur : il voit les
  //    deux textes, met la traduction dans le champ, et elle ne part que sur SON toucher « Envoyer ».
  const UI_LANGUE = U.langue ? U.langue() : 'fr';
  const TRAD = U.traduction || { presente: () => false, detecter: async () => null, traduire: async () => ({ ok: false, code: 'absente' }) };
  const nomL = (c) => (U.nomLangue ? U.nomLangue(c) : c);
  const trads = {};      // clé (conv:bulle) → { lang: undefined (en cours) | '' (pas reconnue) | code, etat, texte }
  const tradsRep = {};   // conv → { etat, texte, original, lang }
  function langueTexte(cle, texte, indice) {
    let t = trads[cle];
    if (!t) {
      t = trads[cle] = { lang: undefined, etat: 'idle' };
      TRAD.detecter(texte).then((l) => { t.lang = l || (indice || ''); rendre(); }, () => { t.lang = indice || ''; rendre(); });
    } else if (t.lang === '' && indice) t.lang = indice;
    return t;
  }
  const etrangere = (t) => !!(t && t.lang && t.lang !== UI_LANGUE);
  function tradBulle(cle, texte, indice) {
    const t = langueTexte(cle, texte, indice);
    if (!etrangere(t) || !TRAD.presente()) return '';
    if (t.etat === 'fait') return `<div class="vu-trad" data-traduit="${esc(t.lang)}">${esc(t.texte)}<small>${esc(TU('tr_depuis', { l: nomL(t.lang) }))}</small></div>`;
    if (t.etat === 'ko') return `<p class="note5" data-traduction="ko">${esc(TU('tr_ko'))}</p>`;
    return `<button type="button" class="vu-lien" data-traduire="${esc(cle)}"${t.etat === 'charge' ? ' disabled aria-busy="true"' : ''}>${esc(TU(t.etat === 'charge' ? 'tr_charge' : 'tr_traduire'))}</button>`;
  }
  // La ligne « pourquoi pas de bouton » : une fois par conversation, seulement si un message étranger est reconnu.
  function tradAbsente(cles) {
    if (TRAD.presente()) return '';
    const t = cles.map((k) => trads[k]).find(etrangere);
    return t ? `<p class="note5" data-traduction="absente" data-traduction-langue="${esc(t.lang)}">${esc(TU('tr_absente', { l: nomL(t.lang) }))}</p>` : '';
  }
  function traduireBulle(cle, texte) {
    const t = trads[cle]; if (!t || !etrangere(t) || t.etat === 'charge') return;
    t.etat = 'charge'; rendre();
    TRAD.traduire(texte, t.lang, UI_LANGUE).then((r) => { if (r && r.ok) { t.etat = 'fait'; t.texte = r.texte; } else t.etat = 'ko'; rendre(); });
  }
  // La langue de l'ACHETEUR d'une conversation : sa question repérée (règle des réponses rapides), sinon son dernier message.
  function langueAcheteurConv(conv) { const k = Object.keys(trads).find((x) => x.startsWith(conv + ':') && etrangere(trads[x])); return k ? trads[k].lang : ''; }
  function tradRepHtml(conv) {
    const l = langueAcheteurConv(conv);
    if (!l || !TRAD.presente()) return '';
    const r = tradsRep[conv];
    // Le champ montre SON texte ; dessous, la traduction (les deux à la fois, jamais deux fois le même). Une fois la
    // traduction mise dans le champ, c'est SON texte d'origine qui reste dit dessous.
    if (r && r.etat === 'utilise') return String(brouillons.get(conv) || '').trim() === r.texte ? `<div class="vu-trad" data-trad-rep="utilise" data-trad-rep-langue="${esc(r.lang)}"><b>${esc(TU('tr_ton_texte'))}</b><span data-trad-rep-original>${esc(r.original)}</span><small>${esc(TU('tr_verifie'))}</small></div>` : '';
    if (r && r.etat === 'fait') return `<div class="vu-trad" data-trad-rep="fait" data-trad-rep-langue="${esc(r.lang)}" data-trad-rep-texte><b>${esc(TU('tr_ta_reponse', { l: nomL(r.lang) }))}</b><span>${esc(r.texte)}</span><small>${esc(TU('tr_verifie'))}</small></div>`
      + `<div class="ge5"><button type="button" class="vu-btn vu-sec" data-trad-rep-utiliser="${esc(conv)}">${esc(TU('tr_utiliser'))}</button></div>`;
    if (r && r.etat === 'ko') return `<p class="note5" data-trad-rep="ko">${esc(TU('tr_ko'))}</p>`;
    return `<button type="button" class="vu-lien" data-trad-rep-lancer="${esc(conv)}"${r && r.etat === 'charge' ? ' disabled aria-busy="true"' : ''}>${esc(TU(r && r.etat === 'charge' ? 'tr_charge' : 'tr_ma_reponse', { l: nomL(l) }))}</button>`;
  }
  function traduireReponse(conv) {
    const texte = String(brouillons.get(conv) || '').trim(), l = langueAcheteurConv(conv);
    if (!texte || !l) return;
    tradsRep[conv] = { etat: 'charge', original: texte, lang: l }; rendre();
    TRAD.traduire(texte, UI_LANGUE, l).then((r) => { tradsRep[conv] = r && r.ok ? { etat: 'fait', texte: r.texte, original: texte, lang: l } : { etat: 'ko' }; rendre(); });
  }
  // ══ 5.430 (choix n° 75) — LA NOTE DE L'ACHETEUR d'une conversation ouverte : déjà sue (la liste), sinon lue par le fond
  //    sur SON toucher (budget de lecture, une requête à la fois).
  const notesConv = {};
  function noteConvHtml(x) {
    if (!U.noteAcheteur || !listes || listes.plateforme === 'leboncoin' || listes.plateforme === 'vestiaire') return '';
    let et = notesConv[x.conv] && notesConv[x.conv].note ? notesConv[x.conv].note : x.note || null;
    if ((!et || et.k === 'pas-su') && !notesConv[x.conv]) {
      notesConv[x.conv] = { charge: true };
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'noteAcheteur', conv: x.conv }, (r) => { void chrome.runtime.lastError; notesConv[x.conv] = { note: r && r.ok && r.note ? r.note : null }; rendre(); }); } catch (_) {}
    }
    return et ? `<div class="conv5-note" data-conv-note>${U.noteAcheteur(et)}</div>` : '';
  }
  function rrHtml(x) {
    const conv = String(x.conv || '');
    if (!conv) return '';
    const s = rrParConv[conv];
    if (!s) { rrCharger(conv); return `<div class="rr5" data-rr="charge" role="status"><small>${esc(TU('rr_lecture'))}</small></div>`; }
    if (s.charge) return `<div class="rr5" data-rr="charge" role="status"><small>${esc(TU('rr_lecture'))}</small></div>`;
    if (!s.data) return `<div class="rr5" data-rr="pas-su"><small>${esc(s.raison)}</small></div>`;
    const d = s.data, l = Array.isArray(d.propositions) ? d.propositions : [];
    const ia = `<small class="rr5-ia" data-rr-ia="absente">${esc(TU('rr_ia_absente'))}</small>`;
    const modif = `<button type="button" class="vu-lien" data-rr-modeles>${esc(TU('rr_mes_modeles'))}</button>`;
    if (d.fil === 'pas_lu') return `<div class="rr5" data-rr="pas-lu"><small>${esc(d.raison || TU('rr_pas_lu'))}</small></div>`;
    if (!l.length) return `<div class="rr5" data-rr="0"><small>${esc(TU('rr_aucune'))}</small> ${modif}</div>`;
    const env = rrEnvoi[conv];
    return `<div class="rr5" data-rr="${l.length}" role="group" aria-label="${esc(TU('rr_titre'))}"><div class="rr5-t"><b>${esc(TU('rr_titre'))}</b>${modif}</div>`
      + l.map((p, i) => p.texte
        ? `<div class="rr5-p" data-rr-cat="${esc(p.cat)}" data-rr-sienne="${p.sienne ? '1' : '0'}"><span class="rr5-c">${esc(TU(RR_LIB[p.cat] || 'rr_c_dispo'))}</span><p data-rr-texte>${esc(p.texte)}</p><div class="ge5"><button type="button" class="vu-btn vu-sec" data-rr-envoyer="${i}" data-rr-conv="${esc(conv)}"${env && env.enVol ? ' disabled' : ''}>${esc(TU(env && env.enVol && env.i === i ? 'm_envoi' : 'rr_envoyer'))}</button><button type="button" class="vu-lien" data-rr-modifier="${i}" data-rr-conv="${esc(conv)}">${esc(TU('rr_modifier'))}</button></div></div>`
        : `<div class="rr5-p rr5-manque" data-rr-cat="${esc(p.cat)}" data-rr-manque="${esc(p.manque || '')}"><span class="rr5-c">${esc(TU(RR_LIB[p.cat] || 'rr_c_dispo'))}</span><small>${esc(TU(RR_MANQUE[p.manque] || 'rr_m_autre'))}</small></div>`).join('')
      + (env && env.fin ? `<div class="${env.fin.ok ? 'val' : 'err'}" role="status" data-rr-etat="${env.fin.ok ? 'ok' : 'refus'}">${esc(env.fin.texte)}</div>` : '') + ia + '</div>';
  }
  function rrEnvoyer(conv, i) {
    const s = rrParConv[conv], p = s && s.data && s.data.propositions ? s.data.propositions[i] : null;
    if (!p || !p.texte || (rrEnvoi[conv] && rrEnvoi[conv].enVol)) return;
    rrEnvoi[conv] = { enVol: true, i }; rendre();
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'repondreCarte', conv, texte: p.texte, confirme: true }, (r) => {
        void chrome.runtime.lastError;
        rrEnvoi[conv] = { fin: r && r.ok ? { ok: true, texte: TU('m_parti') } : { ok: false, texte: (r && r.raison) || TU('m_pas_parti') } };
        if (r && r.ok) delete rrParConv[conv];
        rendre();
      });
    } catch (_) { rrEnvoi[conv] = { fin: { ok: false, texte: TU('m_pas_parti') } }; rendre(); }
  }
  // ── SES MODÈLES (Automatisations → « Réponses rapides ») : une ligne = une version, par catégorie ; `vrm_reponses_rapides`.
  let rrBrouillon = null, rrModEtat = null, rrModEnVol = false;
  const rrLu = () => (listes && listes.automatisations && listes.automatisations.reponsesRapides) || null;
  function rrModelesHtml() {
    const lu = rrLu() || { modeles: {}, revelerMini: false };
    const b = rrBrouillon || { modeles: Object.assign({}, lu.modeles), revelerMini: lu.revelerMini === true };
    return `<section class="sec6" data-rr-modeles-ed><h3>${esc(TU('rr_modeles_t'))}</h3><p class="note5">${esc(TU('rr_modeles_note'))}</p>`
      + RR_CATS.map((c) => `<label class="champ6"><b>${esc(TU(RR_LIB[c]))}</b><textarea data-rr-champ="${c}" rows="2" maxlength="5000" placeholder="${esc(TU('rr_defaut_ph'))}">${esc((b.modeles[c] || []).join('\n'))}</textarea></label>`).join('')
      + `<div class="rg6"><span><b>${esc(TU('rr_reveler'))}</b><small>${esc(TU('rr_reveler_note'))}</small></span><button type="button" class="vu-btn ra6" data-rr-reveler aria-pressed="${b.revelerMini === true}">${esc(TU(b.revelerMini ? 'ra_eteindre' : 'ra_allumer'))}</button></div>`
      + `<p class="note5" data-rr-ia="absente">${esc(TU('rr_ia_absente'))}</p></section>`
      + (rrModEtat ? `<p class="note5" role="status" data-rr-mod-etat="${rrModEtat.ok ? 'ok' : 'ko'}">${esc(rrModEtat.texte)}</p>` : '')
      + `<div class="pied6"><button type="button" class="vu-btn vu-plein" data-rr-enregistrer${rrModEnVol ? ' disabled' : ''}>${esc(TU('ra_enregistrer'))}</button></div>`;
  }
  // ── LOTS AUX FAVORIS (au-dessus de la liste des favoris) ──
  let lotsData = null, lotConfirme = '', lotEtat = null, lotEnVol = false;
  function lotsCharger() {
    lotsData = { charge: true };
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'lotsFavoris', quoi: 'lire' }, (r) => { void chrome.runtime.lastError; lotsData = r && r.ok ? { data: r } : { raison: (r && r.raison) || TU('lot_pas_su') }; rendre(); }); } catch (_) { lotsData = { raison: TU('lot_pas_su') }; }
  }
  const eur5 = (c) => (Number(c) > 0 ? ((c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €') : '—');
  function lotsHtml() {
    if (!lotsData) lotsCharger();
    if (!lotsData || lotsData.charge) return `<section class="lot5" data-lots="charge" role="status"><small>${esc(TU('lot_lecture'))}</small></section>`;
    if (!lotsData.data) return `<section class="lot5" data-lots="pas-su"><small>${esc(lotsData.raison)}</small></section>`;
    const d = lotsData.data, l = d.lots || [];
    if (!l.length) return `<section class="lot5" data-lots="0"><small>${esc(TU('lot_aucun'))}</small></section>`;
    const tx = bmVal('lotFavoris').taux || d.taux || 10;
    return `<section class="lot5" data-lots="${l.length}"><div class="lot5-t"><b>${esc(TU('lot_titre', { n: l.length }))}</b><div class="vu-seg vue5" role="group" aria-label="${esc(TU('lot_taux'))}">${[5, 10, 15, 20].map((t) => `<button type="button" data-lot-taux="${t}" aria-pressed="${tx === t}">−${t} %</button>`).join('')}</div></div>`
      + `<p class="note5">${esc(TU(d.lotAppris ? 'lot_appris' : 'lot_pas_appris'))}</p><ul class="rangs">`
      + l.map((g) => {
        const o = g.offre || {}, ids = g.items.map((x) => x.itemId).join(',');
        const sous = o.ok ? TU(o.remontee ? 'lot_prix_remonte' : 'lot_prix', { prix: eur5(o.prix), somme: eur5(o.somme) }) : TU(o.raison === 'plancher_inconnu' ? 'lot_sans_plancher' : o.raison === 'plancher_au_prix' ? 'lot_plancher_prix' : 'lot_prix_pas_su');
        const conf = lotConfirme === g.receiver ? `<div class="conf5" role="alertdialog" data-lot-confirme="${esc(g.receiver)}"><p>${esc(TU('lot_confirme_q', { pseudo: g.pseudo || '—', n: g.items.length, prix: eur5(o.prix) }))}</p><div class="outils"><button type="button" class="vu-btn vu-plein" data-lot-oui="${esc(g.receiver)}" data-lot-items="${esc(ids)}" data-lot-prix="${o.prix || ''}"${lotEnVol ? ' disabled' : ''}>${esc(TU(lotEnVol ? 'm_envoi' : 'lot_oui'))}</button><button type="button" class="vu-btn" data-lot-non>${esc(TU('ra_annuler'))}</button></div></div>` : '';
        return `<li data-lot="${esc(g.receiver)}" data-lot-n="${g.items.length}" data-lot-prix="${o.ok ? o.prix : ''}"><div class="rang"><span class="vig">${g.items[0] && g.items[0].photo ? `<img src="${esc(g.items[0].photo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span><span class="mil"><span class="ti">${esc(TU('lot_ligne', { n: g.items.length, pseudo: g.pseudo || '—' }))}</span><span class="me"${o.remontee ? ' data-ambre' : ''}>${esc(sous)}</span><span class="me">${esc(g.items.map((x) => x.titre || x.itemId).join(' · ').slice(0, 140))}</span></span>`
          + (g.deja ? `<span class="et5" data-etat="on">${esc(TU('lot_deja'))}</span>` : o.ok ? `<button type="button" class="vu-btn vu-sec" data-lot-envoyer="${esc(g.receiver)}">${esc(TU('lot_envoyer'))}</button>` : '') + `</div>${conf}</li>`;
      }).join('') + `</ul>${lotEtat ? `<div class="${lotEtat.ok ? 'val' : 'err'}" role="status" data-lot-etat="${lotEtat.ok ? 'ok' : 'ko'}">${esc(lotEtat.texte)}</div>` : ''}</section>`;
  }
  // ── À RELANCER (offres refusées ou expirées) ──
  let relData = null, relConfirme = '', relEtat = null, relEnVol = false;
  function relCharger() {
    relData = { charge: true };
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'relancesOffres', quoi: 'lire' }, (r) => { void chrome.runtime.lastError; relData = r && r.ok ? { data: r } : { raison: (r && r.raison) || TU('rel_pas_su') }; rendre(); }); } catch (_) { relData = { raison: TU('rel_pas_su') }; }
  }
  const REL_RAISON = { note_basse: 'rel_r_note_basse', relire: 'rel_r_relire', deja: 'rel_r_deja', plus_en_vente: 'rel_r_vendu', pas_su: 'rel_r_pas_su', prix_inconnu: 'rel_r_prix', plancher_inconnu: 'rel_r_plancher', plancher_au_prix: 'rel_r_plancher_prix', date_inconnue: 'rel_r_date' };
  function relancesHtml() {
    if (!relData) relCharger();
    if (!relData || relData.charge) return `<p class="note5" role="status" data-rel="charge">${esc(TU('rel_lecture'))}</p>`;
    if (!relData.data) return `<p class="note5" data-rel="pas-su">${esc(relData.raison)}</p>`;
    const l = relData.data.liste || [];
    const vis = l.filter((x) => x.etat !== 'ecarte' || x.raison !== 'deja');
    if (!vis.length) return `<p class="note5" data-rel="0">${esc(TU('rel_aucune'))}</p>`;
    return `<ul class="rangs" data-rel="${vis.length}">${vis.map((x) => {
      const k = x.conv + ':' + x.item;
      const etat = x.etat === 'pret' ? TU('rel_pret', { prix: eur5(x.prix), offre: eur5(x.offre) }) : x.etat === 'attente' && x.raison === 'relire' ? TU('rel_r_relire') : x.etat === 'attente' ? TU('rel_attente', { prix: eur5(x.prix), quand: x.quand ? new Date(x.quand).toLocaleDateString() : '—' }) : TU(REL_RAISON[x.raison] || 'rel_r_pas_su');
      const conf = relConfirme === k ? `<div class="conf5" role="alertdialog" data-rel-confirme="${esc(k)}"><p>${esc(TU('rel_confirme_q', { pseudo: x.pseudo || '—', prix: eur5(x.prix) }))}</p><div class="outils"><button type="button" class="vu-btn vu-plein" data-rel-oui="${esc(k)}" data-rel-prix="${x.prix}"${relEnVol ? ' disabled' : ''}>${esc(TU(relEnVol ? 'm_envoi' : 'rel_oui'))}</button><button type="button" class="vu-btn" data-rel-non>${esc(TU('ra_annuler'))}</button></div></div>` : '';
      return `<li data-rel-ligne="${esc(k)}" data-rel-etat="${esc(x.etat)}"><div class="rang"><span class="mil"><span class="ti">${esc((x.pseudo || '—') + (x.titre ? ' · ' + x.titre : ''))}</span><span class="me"${x.etat === 'pret' ? ' data-ambre' : ''}>${esc(etat)}</span><span class="me">${esc(TU(x.etatOffre === 'acceptee' ? 'rel_acceptee_n' : x.etatOffre === 'expiree' ? 'rel_expiree' : 'rel_refusee', { offre: eur5(x.offre) }))}</span></span>${x.etat === 'pret' ? `<button type="button" class="vu-btn vu-sec" data-rel-envoyer="${esc(k)}">${esc(TU('rel_envoyer', { prix: eur5(x.prix) }))}</button>` : ''}</div>${conf}</li>`;
    }).join('')}</ul>${relEtat ? `<div class="${relEtat.ok ? 'val' : 'err'}" role="status" data-rel-etat-fin="${relEtat.ok ? 'ok' : 'ko'}">${esc(relEtat.texte)}</div>` : ''}`;
  }
  // ── L'AGENT VRM : réglages + tableau de bord ──
  let agData = null;
  function agCharger() {
    agData = { charge: true };
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'agentVrm', quoi: 'lire' }, (r) => { void chrome.runtime.lastError; agData = r && r.ok ? { data: r } : { raison: (r && r.raison) || TU('ag_pas_su') }; rendre(); }); } catch (_) { agData = { raison: TU('ag_pas_su') }; }
  }
  // Les raisons de l'agent, en mots (un code inconnu ⇒ « autre raison », jamais le code brut).
  const AG_RAISON = { palier: 'ag_r_palier', flexible: 'ag_r_flexible', au_dessus_du_seuil: 'ag_r_seuil', sous_le_refus: 'ag_r_refus', plancher_inconnu: 'ag_r_plancher', prix_inconnu: 'ag_r_prix',
    pas_prouvee_en_vente: 'ag_r_en_vente', double_vente_pas_exclue: 'ag_r_double', sous_plancher: 'ag_r_sous_plancher', palier_hors_bornes: 'ag_r_paliers', paliers_epuises: 'ag_r_paliers',
    question_ambigue: 'ag_r_ambigue', plusieurs_questions: 'ag_r_plusieurs', photos_absentes: 'ag_r_photos', annonce_partie: 'ag_r_partie', dispo_pas_su: 'ag_r_partie', prix_mini: 'ag_r_mini',
    dispo: 'rr_c_dispo', taille: 'rr_c_taille', envoi: 'rr_c_envoi', lot: 'rr_c_lot', photos: 'rr_c_photos', note_basse: 'ag_r_note', compte_neuf: 'ag_r_neuf' };
  const agRaison = (c) => { const k = String(c || ''); if (AG_RAISON[k]) return TU(AG_RAISON[k]); if (/^risque_/.test(k)) return TU('ag_r_risque'); if (/^categorie_/.test(k)) return TU('ag_r_categorie'); if (/^info_manquante/.test(k)) return TU('ag_r_info'); return TU('ag_r_autre'); };
  const AG_GESTE = { accepter: 'ag_g_accepter', contre: 'ag_g_contre', refuser: 'ag_g_refuser', repondre: 'ag_g_repondre', a_toi: 'ag_g_a_toi' };
  const AG_ETAT = { prevu: 'ag_e_prevu', envol: 'ag_e_envol', fait: 'ag_e_fait', essai: 'ag_e_essai', a_toi: 'ag_e_a_toi', saute: 'ag_e_saute', refuse: 'ag_e_refuse', incertain: 'ag_e_incertain' };
  function agentTableauHtml() {
    if (!agData) agCharger();
    if (!agData || agData.charge) return `<p class="note5" role="status" data-ag="charge">${esc(TU('ag_lecture'))}</p>`;
    if (!agData.data) return `<p class="note5" data-ag="pas-su">${esc(agData.raison)}</p>`;
    const d = agData.data, t = d.tableau || {};
    const tuile = (k, v, attr) => `<div class="ag5-t" data-ag-tuile="${attr}"><b>${v == null ? '—' : esc(String(v))}</b><span>${esc(TU(k))}</span></div>`;
    return `<section class="sec6" data-ag-tableau data-ag-essai="${d.essai ? '1' : '0'}"${d.arrete ? ` data-ag-arrete="${esc(d.arrete.raison)}"` : ''}><h3>${esc(TU('ag_tableau'))}</h3>`
      + (d.arrete ? `<p class="note5" data-ambre role="alert">${esc(TU('ag_arrete', { raison: d.arrete.raison }))}</p>` : '')
      + (d.essai ? `<p class="note5" data-ag-essai-note>${esc(TU('ag_essai_en_cours', { quand: d.agent && d.agent.essaiJusqua ? new Date(d.agent.essaiJusqua).toLocaleDateString() : '—' }))}</p>` : '')
      + `<div class="ag5-g">${tuile('ag_t_jour', t.jour, 'jour')}${tuile('ag_t_attente', t.attente, 'attente')}${tuile('ag_t_a_toi', t.aToi, 'a-toi')}${tuile('ag_t_taux', t.taux == null ? null : t.taux + ' %', 'taux')}</div>`
      + ((d.decisions || []).length ? `<ul class="rangs" data-ag-decisions="${d.decisions.length}">${d.decisions.map((e) => `<li data-ag-decision="${esc(e.id)}" data-ag-geste="${esc(e.geste)}" data-ag-etat="${esc(e.etat)}"><div class="rang"><span class="mil"><span class="ti">${esc(TU(AG_GESTE[e.geste] || 'ag_g_a_toi'))}${e.prix != null ? ' · ' + esc(eur5(Math.round(e.prix * 100))) : ''}${e.offre != null && e.offre !== e.prix ? ' · ' + esc(TU('ag_offre_de', { m: eur5(Math.round(e.offre * 100)) })) : ''}</span><span class="me">${esc(TU(AG_ETAT[e.etat] || 'ag_e_prevu'))} · ${esc(agRaison(e.raison))}${e.at ? ' · ' + esc(depuis(e.at)) : ''}</span>${e.texte ? `<span class="me">« ${esc(e.texte)} »</span>` : ''}</span>${e.geste === 'a_toi' && !e.vu ? `<a class="vu-btn vu-sec" href="${esc('https://www.vinted.fr/inbox/' + (e.conv || ''))}" target="_top" data-ag-vu="${esc(e.id)}">${esc(TU('ag_voir'))}</a>` : ''}</div></li>`).join('')}</ul>` : `<p class="note5" data-ag-decisions="0">${esc(TU('ag_aucune'))}</p>`)
      + '</section>';
  }
  function agentDetailHtml() {
    const v = bmVal('agent'), on = v.actif === true;
    const seg = (k) => `<div class="vu-seg vue5" role="group"><button type="button" data-bm-choix="agent.${k}" data-bm-v="oui" aria-pressed="${v[k] !== false && v[k] !== 'non'}">${esc(TU('ag_oui'))}</button><button type="button" data-bm-choix="agent.${k}" data-bm-v="non" aria-pressed="${v[k] === false || v[k] === 'non'}">${esc(TU('ag_non'))}</button></div>`;
    const hc = v.heuresCalmes || { de: '', a: '' };   // 5.437 : aucune heure calme par défaut (la nuit n'arrête rien)
    return bmSectionHtml('agent', `<p class="note5" data-ag-resume>${esc(TU('ag_resume'))}</p>`
      + `<div class="rg6"><span><b>${esc(TU('ag_negocier'))}</b><small>${esc(TU('ag_negocier_note'))}</small></span>${seg('negocier')}</div>`
      + `<div class="rg6"><span><b>${esc(TU('ag_repondre'))}</b><small>${esc(TU('ag_repondre_note'))}</small></span>${seg('repondre')}</div>`
      + `<div class="rg6"><span><b>${esc(TU('ag_essai'))}</b><small>${esc(TU('ag_essai_note'))}</small></span>${on ? '' : `<button type="button" class="vu-btn ra6" data-bm-choix="agent.essaiDemarrer" data-bm-v="${v.essaiDemarrer === 'non' ? 'oui' : 'non'}" aria-pressed="${v.essaiDemarrer !== 'non'}">${esc(TU(v.essaiDemarrer === 'non' ? 'ag_non' : 'ag_oui'))}</button>`}</div>`
      + bmNombre('agent', 'essaiJours', 'ag_essai_jours', 0, 14)
      + `<label class="champ6"><b>${esc(TU('ag_calme'))}</b><small>${esc(TU('ag_calme_note'))}</small><span class="cd6-l"><input type="number" min="0" max="23" data-bm-champ="agent.hcDe" value="${esc(v.hcDe != null ? v.hcDe : hc.de)}" aria-label="de"> – <input type="number" min="0" max="23" data-bm-champ="agent.hcA" value="${esc(v.hcA != null ? v.hcA : hc.a)}" aria-label="à"></span></label>`
      + `<p class="note5">${esc(TU('ag_gardes'))}</p>`, 'ag_titre', 'ag_etat_note') + noteReglageHtml() + agentTableauHtml();
  }
  // 5.430 : SON seuil (1,5 ★ par défaut) et « compte sans évaluation » — écrits dans `vinted_bleam.comptes[uid].noteAcheteurs`.
  function noteReglageHtml() {
    if (!listes || !listes.automatisations || !listes.automatisations.bleam) return '';
    const v = bmVal('noteAcheteurs'), seuil = Number(v.seuil) > 0 ? Number(v.seuil) : 1.5, neuf = !(v.neufAccepter === false || v.neufAccepter === 'non');
    const choix = [1, 1.5, 2, 2.5, 3, 3.5, 4];
    if (!choix.includes(seuil)) choix.push(seuil);
    return `<section class="sec6" data-na-reglage data-na-seuil-lu="${seuil}" data-na-neuf-lu="${neuf ? 'oui' : 'non'}"><h3>${esc(TU('na_titre'))}</h3><p class="note5">${esc(TU('na_expl'))}</p>`
      + `<label class="champ6"><b>${esc(TU('na_seuil'))}</b><select class="act5" data-na-seuil>${choix.sort((a, b) => a - b).map((x) => `<option value="${x}"${x === seuil ? ' selected' : ''}>${esc(TU('na_seuil_opt', { s: etoiles6(x) }))}</option>`).join('')}</select></label>`
      + `<div class="rg6"><span><b>${esc(TU('na_neuf_r'))}</b><small>${esc(TU('na_neuf_r_note'))}</small></span><div class="vu-seg vue5" role="group"><button type="button" data-na-neuf="oui" aria-pressed="${neuf}">${esc(TU('ag_oui'))}</button><button type="button" data-na-neuf="non" aria-pressed="${!neuf}">${esc(TU('ag_non'))}</button></div></div></section>`;
  }
  function relanceDetailHtml() {
    return bmSectionHtml('relanceOffres', `<p class="note5">${esc(TU('rel_note'))}</p><p class="note5" data-rel-sans-achat>${esc(TU('rel_sans_achat'))}</p>` + bmNombre('relanceOffres', 'jours', 'rel_jours', 1, 30) + bmNombre('relanceOffres', 'taux', 'rel_taux', 0, 50) + bmTexte('relanceOffres', 'messages', 'rel_messages', 'rel_messages_note') + precieuxBloqueHtml(), 'rel_titre', 'rel_auto_note')
      + bilanHtml('relance') + `<section class="sec6" data-rel-liste><h3>${esc(TU('rel_liste'))}</h3>${relancesHtml()}</section>`;
  }
  function brancher5430(racine) {
    racine.querySelectorAll('[data-traduire]').forEach((b) => b.addEventListener('click', () => { const cle = b.getAttribute('data-traduire'); const conv = cle.split(':')[0];
      const x = listes && listes.messages && listes.messages.liste ? listes.messages.liste.find((y) => y.conv === conv) : null;
      let texte = '';
      if (/:d$/.test(cle)) texte = x ? x.texte || '' : '';
      else { const m = /:vc(\d+)$/.exec(cle); const f = filsVc[conv]; texte = m && f && f.data && f.data.messages && f.data.messages[Number(m[1])] ? f.data.messages[Number(m[1])].t || '' : ''; }
      if (texte) traduireBulle(cle, texte); }));
    racine.querySelectorAll('[data-trad-rep-lancer]').forEach((b) => b.addEventListener('click', () => traduireReponse(b.getAttribute('data-trad-rep-lancer'))));
    racine.querySelectorAll('[data-trad-rep-utiliser]').forEach((b) => b.addEventListener('click', () => { const conv = b.getAttribute('data-trad-rep-utiliser'), r = tradsRep[conv]; if (r && r.etat === 'fait') { brouillons.set(conv, r.texte); tradsRep[conv] = Object.assign({}, r, { etat: 'utilise' }); rendre(); } }));
    { const sel = racine.querySelector('[data-na-seuil]'); if (sel) sel.addEventListener('change', () => { bmBrouillon.noteAcheteurs = Object.assign({}, bmVal('noteAcheteurs'), { seuil: Number(sel.value) }); bmEnvoyer('noteAcheteurs', false, false); }); }
    racine.querySelectorAll('[data-na-neuf]').forEach((b) => b.addEventListener('click', () => { bmBrouillon.noteAcheteurs = Object.assign({}, bmVal('noteAcheteurs'), { neufAccepter: b.getAttribute('data-na-neuf') === 'oui' }); bmEnvoyer('noteAcheteurs', false, false); }));
  }
  function brancher5421(racine) {
    racine.querySelectorAll('[data-rr-envoyer]').forEach((b) => b.addEventListener('click', () => rrEnvoyer(b.getAttribute('data-rr-conv'), Number(b.getAttribute('data-rr-envoyer')))));
    racine.querySelectorAll('[data-rr-modifier]').forEach((b) => b.addEventListener('click', () => { const conv = b.getAttribute('data-rr-conv'), s = rrParConv[conv]; const p = s && s.data && s.data.propositions[Number(b.getAttribute('data-rr-modifier'))]; if (p && p.texte) { brouillons.set(conv, p.texte); rendre(); const t = racine.querySelector(`[data-rep-texte="${conv}"]`); if (t) { try { t.focus(); } catch (_) {} } } }));
    racine.querySelectorAll('[data-rr-modeles]').forEach((b) => b.addEventListener('click', () => { ongletListe = 'automatisations'; autoChoisie = 'reponses'; autoDetail = true; ranger({ vrmCarteOnglet: ongletListe }); chargerListes(false); rendre(); }));
    racine.querySelectorAll('[data-rr-champ]').forEach((c) => c.addEventListener('input', () => { const lu = rrLu() || { modeles: {}, revelerMini: false }; rrBrouillon = rrBrouillon || { modeles: Object.assign({}, lu.modeles), revelerMini: lu.revelerMini === true }; rrBrouillon.modeles[c.getAttribute('data-rr-champ')] = c.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 5); }));
    { const b = racine.querySelector('[data-rr-reveler]'); if (b) b.addEventListener('click', () => { const lu = rrLu() || { modeles: {}, revelerMini: false }; rrBrouillon = rrBrouillon || { modeles: Object.assign({}, lu.modeles), revelerMini: lu.revelerMini === true }; rrBrouillon.revelerMini = !rrBrouillon.revelerMini; rendre(); }); }
    { const b = racine.querySelector('[data-rr-enregistrer]'); if (b) b.addEventListener('click', () => {
      const lu = rrLu() || { modeles: {}, revelerMini: false }; const v = rrBrouillon || lu;
      rrModEnVol = true; rrModEtat = null; rendre();
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'reglageAuto', cle: 'vrm_reponses_rapides', valeur: { modeles: v.modeles || {}, revelerMini: v.revelerMini === true } }, (r) => { void chrome.runtime.lastError; rrModEnVol = false; rrModEtat = { ok: !!(r && r.ok), texte: r && r.ok ? TU('ra_ok') : ((r && r.raison) || TU('ra_ko')) }; if (r && r.ok) { rrBrouillon = null; for (const k of Object.keys(rrParConv)) delete rrParConv[k]; chargerListes(true); } rendre(); }); } catch (_) { rrModEnVol = false; rrModEtat = { ok: false, texte: TU('ra_ko') }; rendre(); }
    }); }
    racine.querySelectorAll('[data-lot-taux]').forEach((b) => b.addEventListener('click', () => { bmBrouillon.lotFavoris = { taux: Number(b.getAttribute('data-lot-taux')) }; bmEnvoyer('lotFavoris', bmVal('lotFavoris').actif === true, false, () => { lotsData = null; rendre(); }); }));
    racine.querySelectorAll('[data-lot-envoyer]').forEach((b) => b.addEventListener('click', () => { lotConfirme = b.getAttribute('data-lot-envoyer'); lotEtat = null; rendre(); }));
    racine.querySelectorAll('[data-lot-non]').forEach((b) => b.addEventListener('click', () => { lotConfirme = ''; rendre(); }));
    racine.querySelectorAll('[data-lot-oui]').forEach((b) => b.addEventListener('click', () => {
      if (lotEnVol) return; lotEnVol = true; rendre();
      const receiver = b.getAttribute('data-lot-oui'), items = String(b.getAttribute('data-lot-items') || '').split(',').filter(Boolean), prix = Number(b.getAttribute('data-lot-prix')) / 100;
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'lotsFavoris', quoi: 'envoyer', receiver, items, prix, confirme: true }, (r) => { void chrome.runtime.lastError; lotEnVol = false; lotConfirme = ''; lotEtat = r && r.ok ? { ok: true, texte: TU('lot_parti', { prix: eur5(Math.round(r.prix * 100)) }) } : { ok: false, texte: (r && r.raison) || TU('m_pas_parti') }; lotsData = null; rendre(); }); } catch (_) { lotEnVol = false; lotEtat = { ok: false, texte: TU('m_pas_parti') }; rendre(); }
    }));
    racine.querySelectorAll('[data-rel-envoyer]').forEach((b) => b.addEventListener('click', () => { relConfirme = b.getAttribute('data-rel-envoyer'); relEtat = null; rendre(); }));
    racine.querySelectorAll('[data-rel-non]').forEach((b) => b.addEventListener('click', () => { relConfirme = ''; rendre(); }));
    racine.querySelectorAll('[data-rel-oui]').forEach((b) => b.addEventListener('click', () => {
      if (relEnVol) return; relEnVol = true; rendre();
      const [conv, item] = String(b.getAttribute('data-rel-oui')).split(':'), prix = Number(b.getAttribute('data-rel-prix')) / 100;
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'relancesOffres', quoi: 'envoyer', conv, item, prix, confirme: true }, (r) => { void chrome.runtime.lastError; relEnVol = false; relConfirme = ''; relEtat = r && r.ok ? { ok: true, texte: TU('rel_parti', { prix: eur5(Math.round(r.prix * 100)) }) } : { ok: false, texte: (r && r.raison) || TU('m_pas_parti') }; relData = null; rendre(); }); } catch (_) { relEnVol = false; relEtat = { ok: false, texte: TU('m_pas_parti') }; rendre(); }
    }));
    racine.querySelectorAll('[data-ag-vu]').forEach((a) => a.addEventListener('click', () => { try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'agentVrm', quoi: 'vu', id: a.getAttribute('data-ag-vu') }, () => { void chrome.runtime.lastError; }); } catch (_) {} }));
  }
  // ══ 5.426 (`retirerpartout`) — UNE PAIRE VENDUE EST RETIRÉE PARTOUT : le tableau « Vendue → retirée sur » (LU : la liste
  //    de VRM, le registre de l'extension, les masquées Vinted) et le réglage par site (Leboncoin, Vestiaire : allumer =
  //    « Oui, allumer » ; Vinted toujours allumé ; eBay se règle dans VRM). Rien ne part d'ici : le moteur est au fond.
  let rpConfirme = null, rpEtat = null, rpEnVol = false;
  const RP_ETAT_CLE = { retiree: 'rp_e_retiree', 'hors-ligne': 'rp_e_horsligne', attente: 'rp_e_attente', envoye: 'rp_e_envoye', incertain: 'rp_e_incertain', refuse: 'rp_e_refuse', 'pas-appris': 'rp_e_pasappris', eteint: 'rp_e_eteint', 'a-faire': 'rp_e_afaire', ebay: 'rp_e_ebay' };
  const RP_FAITS = ['retiree', 'hors-ligne'];
  function retraitsTableHtml(R, max) {
    if (!R || !R.lu) return '';
    const att = Object.entries(R.attente || {}).filter(([, n]) => n > 0).map(([site, n]) => `<p class="note5 rp6-att" data-rp-attente="${esc(site)}" data-n="${Number(n)}" data-ton="ambre">${esc(TU('rp_attente', { n, site: NOM_SITE[site] || site }))}</p>`).join('');
    const tard = R.enRetard ? `<p class="note5" data-rp-retard="${Number(R.enRetard)}" data-ton="ambre" role="alert">${esc(TU('rp_retard', { n: R.enRetard }))}</p>` : '';
    const lignes = (R.lignes || []).slice(0, max || 60);
    if (!lignes.length) return att + tard + `<p class="note5" data-rp-vide>${esc(TU('rp_rien'))}</p>`;
    return att + tard + `<ul class="rangs rp6" data-rp-tableau="${lignes.length}">${lignes.map((l) => {
      const reste = l.sites.filter((x) => !RP_FAITS.includes(x.etat)).length;
      return `<li class="rg6 rp6-l" data-rp-num="${esc(l.num)}" data-rp-reste="${reste}"><span><b>${plaque(l.num)} ${esc(TU('rp_vendue_sur', { site: l.venduSur || '—' }))}</b><span class="rp6-sites">${l.sites.map((x) => `<span class="rp6-s" data-rp-site="${esc(x.site)}" data-rp-etat="${esc(x.etat)}"${x.retard ? ' data-rp-en-retard' : ''}${!RP_FAITS.includes(x.etat) && x.etat !== 'eteint' && x.etat !== 'ebay' ? ' data-ton="ambre"' : ''}>${esc(NOM_SITE[x.site] || x.site)} · ${esc(TU(RP_ETAT_CLE[x.etat] || 'rp_e_attente'))}</span>`).join('')}</span></span></li>`;
    }).join('')}</ul>`;
  }
  function retirerDetailHtml() {
    const R = listes && listes.retraits;
    if (!R) return `<p class="note5" data-rp-pas-su>${esc(TU('au_pas_su'))}</p>`;
    const rg = R.reglage || {};
    const conf = rpConfirme ? `<div class="conf5" role="alertdialog" data-rp-confirme="${esc(rpConfirme)}"><p>${esc(TU('rp_confirme', { site: NOM_SITE[rpConfirme] || rpConfirme }))}</p><div class="outils"><button type="button" class="vu-btn vu-plein" data-rp-oui>${esc(TU('ra_oui'))}</button><button type="button" class="vu-btn" data-rp-non>${esc(TU('ra_annuler'))}</button></div></div>` : '';
    const etat = rpEtat ? `<p class="note5" role="status" data-rp-etat-envoi="${rpEtat.ok ? 'ok' : 'ko'}">${esc(rpEtat.texte)}</p>` : '';
    const ligneSite = (site, note, droite) => `<div class="rg6" data-rp-reglage="${site}"><span><b>${esc(NOM_SITE[site])}</b><small>${esc(TU(note))}</small></span>${droite}</div>`;
    const bascule = (site) => `<button type="button" class="vu-btn ra6" data-rp-bascule="${site}" aria-pressed="${rg[site] === true}"${rpEnVol ? ' disabled' : ''}>${esc(TU(rg[site] === true ? 'ra_eteindre' : 'ra_allumer'))}</button>`;
    return conf + etat + `<section class="sec6" data-rp-reglages>`
      + ligneSite('vinted', 'rp_vinted_note', pastilleEtat(true))
      + ligneSite('leboncoin', 'rp_lbc_note', bascule('leboncoin'))
      + ligneSite('vestiaire', 'rp_vc_note', bascule('vestiaire'))
      + ligneSite('ebay', 'rp_ebay_note', pastilleEtat(rg.ebay === true ? true : rg.ebay === false ? false : null))
      + `</section><section class="sec6"><h3>${esc(TU('rp_tableau'))}</h3>${retraitsTableHtml(R)}</section>`;
  }
  function rpEnvoyer(site, actif, confirme) {
    rpEnVol = true; rpEtat = null; rendre();
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'reglageAuto', cle: 'vrm_retirer_partout_reglage', valeur: { site, actif }, confirme: confirme === true }, (r) => {
        void chrome.runtime.lastError; rpEnVol = false;
        if (r && r.code === 'confirmation') rpConfirme = site;
        else { rpConfirme = null; rpEtat = { ok: !!(r && r.ok), texte: r && r.ok ? TU('ra_ok') : ((r && r.raison) || TU('ra_ko')) }; if (r && r.ok) chargerListes(true); }
        rendre();
      });
    } catch (_) { rpEnVol = false; rpEtat = { ok: false, texte: TU('ra_ko') }; rendre(); }
  }
  function brancherRetirer(racine) {
    racine.querySelectorAll('[data-rp-bascule]').forEach((b) => b.addEventListener('click', () => {
      const site = b.getAttribute('data-rp-bascule'); const on = b.getAttribute('aria-pressed') === 'true';
      if (on) rpEnvoyer(site, false, false); else { rpConfirme = site; rpEtat = null; rendre(); }
    }));
    const oui = racine.querySelector('[data-rp-oui]'); if (oui) oui.addEventListener('click', () => { const s0 = rpConfirme; rpConfirme = null; if (s0) rpEnvoyer(s0, true, true); });
    const non = racine.querySelector('[data-rp-non]'); if (non) non.addEventListener('click', () => { rpConfirme = null; rendre(); });
  }
  function automatisationsHtml() {
    if (!(raConfirme && raConfirme.auto === 'favoris')) autoRecap = null;
    if (listesErreur) return `<div class="val gris" role="status">${esc(listesErreur)}</div>`;
    if (!listes) return `<div class="val gris" role="status" data-listes-charge>${esc(TU('m_charge'))}</div>`;
    const au = listes.automatisations;
    if (!au) return `<div class="val gris" data-auto="pas_su">${esc(TU('au_pas_su_tout'))}</div>`;
    const f = au.favoris, o = au.offres, fa = f && f.auto, pa = au.paliers, ba = au.baisse;
    const items = [
      // 5.421 : l'Agent VRM en tête (éteint par défaut), puis SES réponses rapides et la relance des offres ratées.
      { id: 'agent', titre: 'bm_agent', sous: 'bm_agent_sous', on: bmOnItem('agent') },
      { id: 'favoris', titre: 'au_favoris', sous: 'au6_favoris_sous', on: fa ? fa.actif : null },
      { id: 'reponses', titre: 'bm_reponses', sous: 'bm_reponses_sous', on: au.reponsesRapides ? Object.keys(au.reponsesRapides.modeles || {}).length > 0 : null },
      { id: 'relance', titre: 'bm_relance', sous: 'bm_relance_sous', on: bmOnItem('relance') },
      // 5.438 : le lot proposé seul aux favoris, les brouillons préparés seuls (éteints par défaut).
      { id: 'lot', titre: 'bm_lot', sous: 'bm_lot_sous', on: bmOnItem('lot') },
      { id: 'brouillons', titre: 'bm_brouillons', sous: 'bm_brouillons_sous', on: bmOnItem('brouillons') },
      { id: 'offres', titre: 'au_offres', sous: 'au6_offres_sous', on: o ? o.actif : null },
      { id: 'paliers', titre: 'au_paliers', sous: 'au6_paliers_sous', on: pa ? pa.actif : null },
      { id: 'baisse', titre: 'au_baisse', sous: 'au6_baisse_sous', on: ba ? ba.actif : null },
      // 5.410.4 : la suite « comme Bleam » (Vinted seulement, par compte).
      ...BM_ITEMS.map((id) => ({ id, titre: 'bm_' + id, sous: 'bm_' + id + '_sous', on: bmOnItem(id) })),
      // 5.426 : une paire vendue est retirée partout (Vinted toujours allumé ⇒ « Activé »).
      { id: 'retirer', titre: 'rp_titre', sous: 'rp_sous', on: listes && listes.retraits ? true : null },
    ];
    // 5.410 : sur Leboncoin / Vestiaire, la baisse par règle de CE compte seulement.
    if (au.site === 'leboncoin' || au.site === 'vestiaire') { items.splice(0, items.length, ...items.filter((x) => x.id === 'baisse' || x.id === 'retirer')); if (autoChoisie !== 'retirer') autoChoisie = 'baisse'; }
    if (!items.some((x) => x.id === autoChoisie)) autoChoisie = 'favoris';
    const gauche = `<ul class="au6-l" role="listbox" aria-label="${esc(TU('c_automatisations'))}">${items.map((x) => `<li><button type="button" class="au6-i" role="option" data-auto-choix="${x.id}" aria-selected="${autoChoisie === x.id}"><span class="mil"><span class="ti">${esc(TU(x.titre))}</span><span class="me">${esc(TU(x.sous))}</span></span>${pastilleEtat(x.on)}</button></li>`).join('')}</ul>`;
    const ligne = (k, v, note) => `<div class="rg6"><span><b>${esc(TU(k))}</b>${note ? `<small>${esc(TU(note))}</small>` : ''}</span><span class="v6">${v == null || v === '' ? '—' : esc(v)}</span></div>`;
    const section = (k, corps) => `<section class="sec6"><h3>${esc(TU(k))}</h3>${corps}</section>`;
    let droite = '';
    const ch = items.find((x) => x.id === autoChoisie);
    // 5.438 : « compte précieux » dit en tête de chaque automatisation qu'il bloque (favoris auto, offres auto, paliers, cycle de vie).
    const tete = `<div class="au6-t"><h2>${esc(TU(ch.titre))}</h2><p>${esc(TU(ch.sous))}</p></div>${['favoris', 'offres', 'paliers', 'cycle'].includes(autoChoisie) ? precieuxBloqueHtml() : ''}`;
    if (autoChoisie === 'reponses') {
      droite = tete + `<div data-rr-detail>${rrModelesHtml()}</div>`;
    } else if (autoChoisie === 'retirer') {
      droite = tete + `<div data-rp-detail>${retirerDetailHtml()}</div>`;
    } else if (BM_ITEMS.includes(autoChoisie) || ['agent', 'relance', 'lot', 'brouillons'].includes(autoChoisie)) {
      droite = tete + `<div data-bm-detail="${autoChoisie}">${bleamDetailHtml(autoChoisie)}</div>`;
    } else if (autoChoisie === 'favoris') {
      // 5.410 : les messages aux favoris se RÈGLENT ici (textes, rythme, mode auto) — leur ligne dédiée
      //    `vrm_favoris_reglages_{uid}` (règle de l'app) et le mode auto chez VRM (`auto_regler`) ; allumer ⇒ « Oui, allumer ».
      const textes = f && Array.isArray(f.textes) ? f.textes : [];
      const b0 = raBrouillon.favoris || {};
      const tx = Array.isArray(b0.textes) ? b0.textes : textes.slice();
      while (tx.length < Math.min(5, Math.max(2, tx.length + (tx[tx.length - 1] ? 1 : 0)))) tx.push('');
      const ry = b0.rythme || (f && f.rythme) || 'normal';
      const autoOn = fa ? fa.actif === true : null;
      const recapA = raConfirme && raConfirme.auto === 'favoris' ? autoRecapHtml(f, fa) : '';
      const conf = raConfirme && raConfirme.auto === 'favoris' ? `<div class="conf5" role="alertdialog" data-ra-confirme="favoris-auto">${recapA}<p>${esc(TU('ra_confirme_q', { nom: TU('au_favoris') }))}</p><div class="outils"><button type="button" class="vu-btn vu-plein" data-ra-oui>${esc(TU('ra_oui'))}</button><button type="button" class="vu-btn" data-ra-non>${esc(TU('ra_annuler'))}</button></div></div>` : '';
      const etat = raEtat && raEtat.auto === 'favoris' ? `<p class="note5" role="status" data-ra-etat="${raEtat.ok ? 'ok' : 'ko'}">${esc(raEtat.texte)}</p>` : '';
      droite = tete + conf + etat
        + `<section class="sec6">${autoOn == null ? '' : `<div class="rg6"><span><b>${esc(TU('rf_mode_auto'))}</b><small>${esc(TU('rf_mode_auto_note'))}</small></span><button type="button" class="vu-btn ra6" data-rf-auto aria-pressed="${autoOn}">${esc(TU(autoOn ? 'ra_eteindre' : 'ra_allumer'))}</button></div>${autoOn ? bilanAutoFavHtml() : ''}`}</section>`
        + section('au6_messages', `<p class="note5">${esc(TU('au6_messages_note'))}</p>` + tx.map((t, i) => `<label class="champ6"><b>${esc(TU('rf_version', { n: i + 1 }))}</b><textarea data-rf-texte="${i}" maxlength="2000" rows="2">${esc(t)}</textarea></label>`).join(''))
        + section('au6_ciblage', `<div class="rg6"><span><b>${esc(TU('f5_rythme'))}</b><small>${esc(TU('au6_rythme_note'))}</small></span><div class="vu-seg vue5" role="group">${['normal', 'prudent'].map((k) => `<button type="button" data-rf-rythme="${k}" aria-pressed="${ry === k}">${esc(TU(k === 'prudent' ? 'fr_rythme_prudent' : 'fr_rythme_normal'))}</button>`).join('')}</div></div>` + ligne('au_horaires', fa && fa.heureDebut != null ? `${fa.heureDebut} h – ${fa.heureFin} h` : null))
        + section('au6_delais', ligne('au_attente', fa && fa.attenteMin ? TU('au_minutes', { a: fa.attenteMin, b: fa.attenteMax || fa.attenteMin }) : null, 'au6_attente_note') + ligne('au_plafonds', fa && fa.parHeure ? TU('au_par', { h: fa.parHeure, j: fa.parJour || '—' }) : null))
        + `<div class="pied6"><button type="button" class="vu-lien" data-ra-reinit>${esc(TU('ra_reinit'))}</button><span class="outils"><button type="button" class="vu-btn" data-auto-guide>${esc(TU('au6_demarrer'))}</button><button type="button" class="vu-btn vu-plein" data-rf-enregistrer${raEnVol ? ' disabled' : ''}>${esc(TU('ra_enregistrer'))}</button></span></div>`;
    } else {
      // 5.410 (Julien, 20 nov. : les automatisations vivent dans l'extension) : offres auto, paliers et baisse par
      // règle se RÈGLENT ici, sur SON toucher ; allumer demande « Oui, allumer » ; écrit dans `vrm_reglages_auto`.
      const cleDe = { offres: 'vinted_offres_auto', paliers: 'vinted_offres_paliers', baisse: 'vinted_baisse_regle' }[autoChoisie];
      const on = autoChoisie === 'offres' ? (o ? o.actif === true : null) : autoChoisie === 'paliers' ? (pa ? pa.actif === true : null) : (ba ? ba.actif === true : null);
      const b0 = raBrouillon[autoChoisie] || {};
      const bascule = on == null ? '' : `<div class="rg6"><span><b>${esc(TU('ra_etat'))}</b><small>${esc(TU('ra_confirme_note'))}</small></span><button type="button" class="vu-btn ra6" data-ra-bascule="${autoChoisie}" aria-pressed="${on}">${esc(TU(on ? 'ra_eteindre' : 'ra_allumer'))}</button></div>`;
      const conf = raConfirme && raConfirme.auto === autoChoisie ? `<div class="conf5" role="alertdialog" data-ra-confirme="${esc(raConfirme.cle)}"><p>${esc(autoChoisie === 'offres' ? TU('ra_confirme_offres') : TU('ra_confirme_q', { nom: TU(ch.titre) }))}</p><div class="outils"><button type="button" class="vu-btn vu-plein" data-ra-oui>${esc(TU('ra_oui'))}</button><button type="button" class="vu-btn" data-ra-non>${esc(TU('ra_annuler'))}</button></div></div>` : '';
      const etat = raEtat && raEtat.auto === autoChoisie ? `<p class="note5" role="status" data-ra-etat="${raEtat.ok ? 'ok' : 'ko'}">${esc(raEtat.texte)}</p>` : '';
      let corpsR = '';
      if (autoChoisie === 'offres') {
        const t = b0.refus != null ? b0.refus : (o && o.refusTexte) || '';
        corpsR = section('au6_regle', ligne('au_minis', o ? TU('au_minis_n', { n: o.minis }) : null, 'au6_minis_note'))
          + section('au6_messages', `<label class="champ6"><b>${esc(TU('ra_refus_msg'))}</b><small>${esc(TU('ra_refus_note'))}</small><textarea data-ra-champ="refus" maxlength="1000" rows="3">${esc(t)}</textarea></label>`)
          + section('au6_delais', ligne('au_attente', TU('au6_offres_delai'))) + noteReglageHtml();
      } else if (autoChoisie === 'paliers') {
        const pcts = b0.paliers != null ? b0.paliers : (pa ? pa.paliers.join(', ') : '50, 80, 100');
        const rem = b0.remise != null ? b0.remise : (pa && pa.remiseMax ? String(pa.remiseMax) : '');
        const ap = apercuPaliers6(String(pcts).split(/[,;\s]+/).map(Number).filter((x) => x > 0 && x <= 100));
        corpsR = section('au6_regle', `<label class="champ6"><b>${esc(TU('ra_paliers_pcts'))}</b><small>${esc(TU('ra_paliers_note'))}</small><input type="text" inputmode="numeric" data-ra-champ="paliers" value="${esc(pcts)}"></label>`
          + `<label class="champ6"><b>${esc(TU('ra_remise'))}</b><small>${esc(TU('ra_remise_note'))}</small><input type="number" min="1" max="89" step="1" data-ra-champ="remise" value="${esc(rem)}"></label>`)
          + section('au6_apercu', `<p class="apercu6" data-paliers-apercu="${ap.join('>')}">${esc(ap.join(' → '))} · ${esc(TU('au6_plancher', { p: 85 }))}</p>`)
          + paliersPlusHtml(pa || {}, b0)
          + section('au6_messages', ligne('au_messages', pa ? (pa.messages ? TU('au_versions', { n: pa.messages }) : TU('au_pas_de_message')) : null));
      } else {
        const pct = Number(b0.pct || (ba && ba.pct) || 5), jours = Number(b0.jours || (ba && ba.jours) || 14);
        const seg = (k, l, v, suf) => `<div class="vu-seg vue5" role="group" data-ra-seg="${k}">${l.map((x) => `<button type="button" data-ra-${k}="${x}" aria-pressed="${x === v}">${x}${suf}</button>`).join('')}</div>`;
        corpsR = section('au6_regle', `<div class="rg6"><span><b>${esc(TU('ra_pct'))}</b></span>${seg('pct', [5, 10, 15], pct, ' %')}</div><div class="rg6"><span><b>${esc(TU('ra_jours'))}</b></span>${seg('jours', [7, 14, 30], jours, ' j')}</div><p class="note5">${esc(TU('au_baisse_plancher'))}</p>${au.site === 'vestiaire' ? `<p class="note5" data-au-baisse-vc-date>${esc(TU('g6_vc_date'))}</p>` : ''}`);
      }
      droite = tete + conf + etat + `<section class="sec6">${bascule}</section>` + corpsR
        + `<div class="pied6" data-ra-pied="${esc(cleDe)}"><button type="button" class="vu-lien" data-ra-reinit>${esc(TU('ra_reinit'))}</button><button type="button" class="vu-btn vu-plein" data-ra-enregistrer${raEnVol ? ' disabled' : ''}>${esc(TU('ra_enregistrer'))}</button></div>`;
    }
    const vueAuto = items.length <= 1 || autoDetail ? 'detail' : 'liste';
    droite = (items.length > 1 ? `<button type="button" class="au6-retour" data-auto-retour>‹ ${esc(TU('au6_retour'))}</button>` : '') + droite;
    return `<div class="deux5 au6" data-automatisations data-auto-choisie="${autoChoisie}" data-auto-vue="${vueAuto}"><div class="gauche5">${gauche}</div><div class="volet5 au6-d">${droite}</div></div>`;
  }
  // ══ 5.410 — LA CADENCE (Julien, 20 nov. « vas-y fais ») : SON réglage par compte, ici dans Paramètres. Défauts
  //    inchangés ; plus vite que le défaut ⇒ « Oui, aller plus vite ». Le reste (captcha, prudence, 403/429, un compte
  //    à la fois, une requête à la fois, compte de l'onglet, temps d'écriture, réserve de 5) n'est pas réglable.
  // ══ 5.410.3 (`repubformulaire`, `favorisbleam`) — « tout comme Bleam » : la méthode de republication, le message
  //    « lot » et le délai de l'offre, réglés ici sur SON toucher ; l'onglet qui travaille est NOMMÉ (rien de caché).
  let cbEtat = null, cbLu = 0, cbLot = null, cbOffre = null, cbMsg = null, cbEnVol = false;
  function lireCommeBleam(force) {
    if (!force && Date.now() - cbLu < 4000) return;
    cbLu = Date.now();
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'commeBleamLire' }, (r) => { void chrome.runtime.lastError; if (r && r.ok) { const avant = JSON.stringify(cbEtat); cbEtat = { reglages: r.reglages, onglet: r.onglet || null }; if (JSON.stringify(cbEtat) !== avant) rendre(); } }); } catch (_) {}
  }
  function ongletTravailHtml() {
    const o = cbEtat && cbEtat.onglet;
    if (!o) return '';
    return `<div class="champ6 ot6" data-onglet-travail="${o.travaille ? 'actif' : 'repos'}" title="${esc(TU(o.travaille ? 'cb_onglet' : 'cb_onglet_libre') + ' · ' + (o.chemin || '/'))}"><span><b>${esc(TU(o.travaille ? 'cb_onglet_court' : 'cb_onglet_libre_court'))}</b><span class="note5">${esc(o.chemin || '/')}</span></span><button type="button" class="vu-btn" data-voir-onglet aria-label="${esc(TU('cb_voir'))}">${esc(TU('cb_voir_court'))}</button></div>`;
  }
  function commeBleamHtml() {
    if (!cbEtat) { lireCommeBleam(false); return `<section class="grp5" data-comme-bleam="pas-su"><h3>${esc(TU('cb_titre'))}</h3><p class="note5">—</p></section>`; }
    const g = cbEtat.reglages || {};
    const choix = (v, lib, note) => `<label class="champ6 cb6"><input type="radio" name="vrm-cb-methode" value="${v}" data-cb-methode="${v}"${g.methode === v ? ' checked' : ''}><span><b>${esc(TU(lib))}</b><span class="note5">${esc(TU(note))}</span></span></label>`;
    const lot = cbLot != null ? cbLot : (g.messageLot || '');
    const oA = cbOffre ? cbOffre.offreMin : (Number(g.offreMin) || 11), oB = cbOffre ? cbOffre.offreMax : (Number(g.offreMax) || 18);
    return `<section class="grp5" data-comme-bleam="${esc(g.methode || '')}"><h3>${esc(TU('cb_titre'))}</h3>
      ${choix('formulaire', 'cb_formulaire', 'cb_formulaire_note')}<p class="note5" data-cb-seule>${esc(TU('cb_seule'))}</p>${g.methodeAvant === 'directe' ? `<p class="note5" data-cb-directe-ignoree>${esc(TU('cb_directe_ignoree'))}</p>` : ''}
      ${ongletTravailHtml()}
      <div class="rg6" data-cb-description="${g.description === 'taper' ? 'taper' : 'coller'}"><span><b>${esc(TU('cb_desc'))}</b><small>${esc(TU(g.description === 'taper' ? 'cb_desc_taper_note' : 'cb_desc_coller_note'))}</small></span><div class="vu-seg vue5" role="group" aria-label="${esc(TU('cb_desc'))}">${['coller', 'taper'].map((k) => `<button type="button" data-cb-desc="${k}" aria-pressed="${(g.description === 'taper' ? 'taper' : 'coller') === k}">${esc(TU('cb_desc_' + k))}</button>`).join('')}</div></div>
      <p class="note5" data-cb-ordre>${esc(TU('cb_ordre_note'))}</p>
      <label class="champ6 cb6" data-cb-eveil-l><input type="checkbox" data-cb-eveil${g.eveil !== false ? ' checked' : ''}><span><b>${esc(TU('cb_eveil'))}</b><span class="note5">${esc(TU('cb_eveil_note'))}</span></span></label>
    </section>
    <section class="grp5" data-comme-bleam-favoris><h3>${esc(TU('cb_favoris_titre'))}</h3>
      <label class="champ6 cb6"><input type="checkbox" data-cb-favoris${g.favoris !== false ? ' checked' : ''}><span><b>${esc(TU('cb_sequence'))}</b></span></label>
      <label class="champ6"><b>${esc(TU('cb_lot'))}</b><textarea rows="3" maxlength="2000" data-cb-lot aria-label="${esc(TU('cb_lot'))}">${esc(lot)}</textarea><span class="note5">${esc(TU('cb_lot_note'))}</span></label>
      <label class="champ6 cd6"><b data-cb-offre-lib>${esc(TU('cb_offre', { a: oA, b: oB }))}</b><span class="cd6-l"><input type="range" min="11" max="60" step="1" value="${oA}" data-cb-offre="offreMin" aria-label="min"><input type="range" min="12" max="120" step="1" value="${oB}" data-cb-offre="offreMax" aria-label="max"></span><span class="note5">${esc(TU('cb_offre_note'))}</span></label>
      ${cbMsg ? `<p class="note5" role="status" data-cb-etat="${cbMsg.ok ? 'ok' : 'ko'}">${esc(cbMsg.texte)}</p>` : ''}
      <div class="outils"><button type="button" class="vu-btn vu-plein" data-cb-enregistrer${cbEnVol ? ' disabled' : ''}>${esc(TU('ra_enregistrer'))}</button></div>
    </section>`;
  }
  function poserCommeBleam(valeur) {
    cbEnVol = true; rendre();
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'commeBleamPoser', valeur }, (r) => {
        void chrome.runtime.lastError; cbEnVol = false;
        cbMsg = { ok: !!(r && r.ok), texte: r && r.ok ? TU('ra_ok') : ((r && r.raison) || TU('ra_ko')) };
        if (r && r.ok && r.reglages) { cbEtat = Object.assign({}, cbEtat, { reglages: r.reglages }); if (valeur.messageLot != null) cbLot = null; if (valeur.offreMin != null) cbOffre = null; }
        rendre();
      });
    } catch (_) { cbEnVol = false; cbMsg = { ok: false, texte: TU('ra_ko') }; rendre(); }
  }
  // ══ 5.420 (`vacancesinterface`, Julien, 21 nov.) — LE MODE VACANCES DU COMPTE DE L'ONGLET, PAR L'INTERFACE ═══════════
  // L'état LU (profil capté : en vacances · ouvert · « — » pas su) ; « Mettre en vacances » / « Rouvrir » ⇒ SA
  // confirmation ⇒ le fond ouvre les réglages de Vinted dans l'onglet de travail et touche l'interrupteur (`vacancesCarte`).
  // Le résultat est dit : fait (vu à l'écran), déjà dans cet état, élément introuvable NOMMÉ, refus, incertain.
  let vacEtat, vacConfirme = null, vacMsg = null, vacEnVol = false;
  function lireVacances() {
    if (vacEtat !== undefined) return;
    vacEtat = null;
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'vacancesCarte', quoi: 'lire' }, (r) => { void chrome.runtime.lastError; vacEtat = r && r.ok ? r : { ok: false }; if (ongletListe === 'parametres') rendre(); }); } catch (_) { vacEtat = { ok: false }; }
  }
  function vacancesHtml(e) {
    if (!e || e.plateforme !== 'vinted') return '';
    lireVacances();
    const v = vacEtat && vacEtat.ok ? vacEtat.vacances : undefined;
    const etat = vacEtat == null ? '…' : v === true ? TU('va_on') : v === false ? TU('va_off') : '—';
    const cible = v === true ? false : true;
    const conf = vacConfirme != null ? `<div class="conf5" role="alertdialog" data-vac-confirme="${vacConfirme ? 'on' : 'off'}"><span>${esc(TU(vacConfirme ? 'va_q_on' : 'va_q_off'))}</span><div class="outils"><button type="button" class="vu-btn vu-plein" data-vac-oui${vacEnVol ? ' disabled' : ''}>${esc(TU(vacConfirme ? 'va_oui_on' : 'va_oui_off'))}</button><button type="button" class="vu-btn" data-vac-non>${esc(TU('ra_annuler'))}</button></div></div>` : '';
    return `<section class="grp5" data-vacances="${v === true ? 'on' : v === false ? 'off' : 'pas-su'}"><h3>${esc(TU('va_titre'))}</h3>
      <div class="rg6"><span><b>${esc(TU('va_etat'))}</b><small>${esc(TU('va_note'))}</small></span><span class="v6" data-vac-etat>${esc(etat)}</span></div>
      ${conf}
      ${vacMsg ? `<p class="note5" role="status" data-vac-msg="${esc(vacMsg.code)}"${vacMsg.ton ? ` data-ton="${vacMsg.ton}"` : ''}>${esc(vacMsg.texte)}</p>` : ''}
      ${vacConfirme == null ? `<div class="outils"><button type="button" class="vu-btn" data-vac-poser="${cible ? 'on' : 'off'}"${vacEnVol || vacEtat == null ? ' disabled' : ''}>${esc(TU(cible ? 'va_mettre' : 'va_rouvrir'))}</button></div>` : ''}
    </section>`;
  }
  function vacEnvoyer() {
    if (vacConfirme == null || vacEnVol) return;
    const voulu = vacConfirme; vacEnVol = true; vacMsg = { code: 'en-cours', ton: '', texte: TU('va_en_cours') }; rendre();
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'vacancesCarte', quoi: 'poser', vacances: voulu, confirme: true }, (r) => {
        void chrome.runtime.lastError; vacEnVol = false; vacConfirme = null;
        if (r && r.ok) { vacEtat = Object.assign({}, vacEtat || {}, { ok: true, vacances: r.vacances }); vacMsg = { code: r.deja ? 'deja' : 'fait', ton: '', texte: TU(r.deja ? 'va_deja' : (voulu ? 'va_fait_on' : 'va_fait_off')) }; }
        else vacMsg = { code: (r && r.code) || 'ko', ton: 'ambre', texte: (r && r.code === 'element' && r.manque ? TU('va_manque', { m: r.manque }) : (r && r.raison)) || TU('ra_ko') };
        rendre();
      });
    } catch (_) { vacEnVol = false; vacMsg = { code: 'ko', ton: 'ambre', texte: TU('ra_ko') }; rendre(); }
  }
  let cadBrouillon = null, cadConfirme = false, cadEtat = null, cadEnVol = false;
  // 5.432 (`gardeprix`) : SON seuil de la garde du prix (Paramètres) et les dernières écritures qu'elle a bloquées.
  let gpBrouillon = null, gpConfirme = false, gpEtat = null, gpEnVol = false;
  function gardePrixHtml() {
    const g0 = listes && listes.automatisations && listes.automatisations.gardePrix;
    if (!g0) return '';
    const v = gpBrouillon != null ? gpBrouillon : g0.seuil;
    const NOMS = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire' };
    const bl = (g0.bloquees || []).slice(0, 5);
    return `<section class="grp5" data-garde-seuil="${esc(g0.seuil)}"><h3>${esc(TU('gp_seuil'))} ${esc(v)} %</h3>
      <label class="champ6 cd6"><span class="cd6-l"><input type="range" min="10" max="90" step="5" value="${esc(v)}" data-gp-seuil aria-label="${esc(TU('gp_seuil'))}"><output data-gp-v>${esc(v)} %</output></span></label>
      <p class="note5">${esc(TU('gp_seuil_note'))}</p>
      ${gpConfirme ? `<div class="conf5" role="alertdialog" data-gp-confirme><p>${esc(TU('gp_confirme_q'))}</p><div class="outils"><button type="button" class="vu-btn vu-plein" data-gp-oui>${esc(TU('gp_confirme_oui'))}</button><button type="button" class="vu-btn" data-gp-non>${esc(TU('ra_annuler'))}</button></div></div>` : ''}
      ${gpEtat ? `<p class="note5" role="status" data-gp-etat="${gpEtat.ok ? 'ok' : 'ko'}">${esc(gpEtat.texte)}</p>` : ''}
      ${gpConfirme ? '' : `<div class="outils"><button type="button" class="vu-btn vu-plein" data-gp-enregistrer${gpEnVol || gpBrouillon == null ? ' disabled' : ''}>${esc(TU('ra_enregistrer'))}</button></div>`}
      ${bl.length ? `<h3>${esc(TU('gp_bloquees'))}</h3><ul class="rangs" data-gp-bloquees="${bl.length}">${bl.map((b) => `<li data-gp-bloquee="${esc(b.site + ':' + b.id)}"><div class="rang"><span class="mil"><span class="ti">${esc(euroTxt((b.prixC || 0) / 100))}${b.actuelC ? ' · ' + esc(TU('gp_au_lieu', { avant: euroTxt(b.actuelC / 100) })) : ''}</span><span class="me">${esc(NOMS[b.site] || b.site)} · ${esc(new Date(b.at).toLocaleString())}</span></span></div></li>`).join('')}</ul>` : ''}
    </section>`;
  }
  // ══ 5.435 (`sauvegardereglages`, choix 22) : « Sauvegarder mes réglages » (un fichier lisible, daté, sans aucun secret) et
  //    « Restaurer » (le fichier lu, ce qui changerait montré avant/après, rien n'est écrit sans SON « Oui »). Un réglage d'un
  //    AUTRE compte ne va au compte de l'onglet que sur sa case cochée.
  let srEtat = null, srEnVol = false, srAp = null, srChoix = {}, srTexte = '';
  const SR_LIB = { vinted_offres_auto: 'sr_l_offres_auto', vinted_offre_refus_msg: 'sr_l_refus_msg', vinted_offre_refus_variantes: 'sr_l_refus_var', vinted_offres_paliers: 'sr_l_paliers',
    vrm_reponses_rapides: 'sr_l_rapides', vrm_seuil_prix: 'sr_l_seuil', vrm_retirer_partout_reglage: 'sr_l_retirer', vrm_agent_publier: 'sr_l_publier', vinted_cadence: 'sr_l_cadence',
    vinted_baisse_regle: 'sr_l_baisse', vrm_favoris_reglages: 'sr_l_favoris' };
  const SR_SECTIONS = { bordereau: 'sr_s_bordereau', msgVente: 'sr_s_msg', msgFinalise: 'sr_s_msg', msgRelais: 'sr_s_msg', msgEvaluation: 'sr_s_msg', eval5: 'sr_s_eval', stockAuto: 'sr_s_stock', cycle: 'sr_s_cycle',
    favoris: 'sr_s_favfiltres', sauvegarde: 'sr_s_sauvegarde', dressing: 'sr_s_dressing', favMessages: 'sr_l_favoris', lotFavoris: 'sr_s_lot', relanceOffres: 'sr_s_relance', relances: 'sr_s_relances', agent: 'sr_s_agent', noteAcheteurs: 'sr_s_note' };
  function srLibelle(c) {
    if (c.cle === 'vinted_bleam') return TU(SR_SECTIONS[c.section] || 'sr_s_autre') + (/^msg/.test(c.section) ? ' (' + c.section.replace(/^msg/, '') + ')' : '');
    if (c.cle === 'vrm_retirer_partout_reglage') return TU('sr_l_retirer') + ' · ' + (NOM_SITE[c.section] || c.section);
    return TU(SR_LIB[c.cle] || 'sr_s_autre');
  }
  function srValeur(r) {
    if (!r || r.rien) return TU('sr_rien');
    const bouts = [];
    if (typeof r.b === 'boolean') bouts.push(TU(r.b ? 'sr_oui' : 'sr_non'));
    if (typeof r.actif === 'boolean') bouts.push(TU(r.actif ? 'sr_allume' : 'sr_eteint'));
    if (r.t != null) bouts.push('« ' + r.t + ' »');
    if (r.x != null && Number.isFinite(Number(r.x))) bouts.push(String(r.x));
    else if (r.n != null && typeof r.actif !== 'boolean') bouts.push(TU(Number(r.n) === 1 ? 'sr_n_1' : 'sr_n', { n: r.n }));
    return bouts.join(' · ') || '—';
  }
  function sauvegardeHtml() {
    const a = srAp;
    const lignes = a && Array.isArray(a.changements) ? a.changements : [];
    const apercu = a ? `<div class="conf5 sr6" role="alertdialog" data-sr-apercu="${lignes.length}">
        ${lignes.length ? `<p><b>${esc(TU(lignes.length === 1 ? 'sr_q_1' : 'sr_q', { n: lignes.length }))}</b></p>` : ''}
        <p class="note5" data-sr-version="${a.memeVersion ? 'meme' : 'autre'}">${esc(TU(a.memeVersion ? 'sr_meme_version' : 'sr_autre_version', { v: a.extension || '?' }))}${a.cree && Number.isFinite(Date.parse(a.cree)) ? ' · ' + esc(new Date(a.cree).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })) : ''}</p>
        ${a.retires ? `<p class="note5" data-sr-retires="${esc(a.retires)}">${esc(TU('sr_retires', { n: a.retires }))}</p>` : ''}
        ${(a.autres || []).map((u) => `<label class="rg6" data-sr-autre="${esc(u)}"><span><b>${esc(TU('sr_autre_compte', { c: u }))}</b><small>${esc(TU('sr_autre_note'))}</small></span><span class="v6"><input type="checkbox" class="sr-case" data-sr-choix="${esc(u)}"${srChoix[u] ? ' checked' : ''} aria-label="${esc(TU('sr_autre_compte', { c: u }))}"></span></label>`).join('')}
        ${lignes.length ? `<ul class="rangs" data-sr-lignes>${lignes.slice(0, 60).map((c) => `<li class="rg6" data-sr-ligne="${esc(c.cle + (c.section ? ':' + c.section : '') + (c.compte ? '@' + c.compte : ''))}"${c.allume ? ' data-sr-allume' : ''}><span><b>${esc(srLibelle(c))}</b><small>${c.compte ? esc(TU('sr_compte', { c: c.compte })) + ' · ' : ''}${esc(srValeur(c.avant))} → ${esc(srValeur(c.apres))}</small></span>${c.allume ? `<span class="v6">${etiquette5('sr', TU('sr_s_allume'), 'ambre')}</span>` : ''}</li>`).join('')}</ul>` : `<p class="note5" data-sr-rien>${esc(TU('sr_rien_a_changer'))}</p>`}
        ${(a.refus || []).length ? `<p class="note5" data-sr-refus="${a.refus.length}">${esc(TU('sr_refuses', { n: a.refus.length }))} ${esc(a.refus.slice(0, 3).map((x) => x.raison).join(' · '))}</p>` : ''}
        <div class="outils"><button type="button" class="vu-btn" data-sr-non>${esc(TU(lignes.length ? 'sr_non_btn' : 'c_fermer'))}</button>${lignes.length ? `<button type="button" class="vu-btn vu-plein" data-sr-oui${srEnVol ? ' disabled' : ''}>${esc(TU('sr_oui_btn'))}</button>` : ''}</div>
      </div>` : '';
    return `<section class="grp5" data-sauvegarde-reglages><h3>${esc(TU('sr_titre'))}</h3><p class="note5">${esc(TU('sr_note'))}</p>
      ${srEtat ? `<p class="note5" role="status" data-sr-etat="${srEtat.ok ? 'ok' : 'ko'}">${esc(srEtat.texte)}</p>` : ''}
      ${apercu}
      ${a ? '' : `<div class="outils"><button type="button" class="vu-btn" data-sr-sauver${srEnVol ? ' disabled' : ''}>${esc(TU('sr_sauver'))}</button><label class="vu-btn sr-fichier"><input type="file" accept="application/json,.json" data-sr-fichier hidden><span>${esc(TU('sr_restaurer'))}</span></label></div>`}
    </section>`;
  }
  function srApercuDemander() {
    srEnVol = true; rendre();
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'sauvegardeReglages', quoi: 'apercu', texte: srTexte, choix: srChoix }, (r) => { void chrome.runtime.lastError; srEnVol = false;
      if (r && r.ok) { srAp = r; srEtat = null; } else { srAp = null; srEtat = { ok: false, texte: (r && r.raison) || TU('ra_ko') }; }
      rendre(); }); } catch (_) { srEnVol = false; srEtat = { ok: false, texte: TU('ra_ko') }; rendre(); }
  }
  function brancherSauvegarde(R) {
    const sv = R.querySelector('[data-sr-sauver]'); if (sv) sv.addEventListener('click', () => {
      srEnVol = true; srEtat = null; rendre();
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'sauvegardeReglages', quoi: 'exporter' }, (r) => { void chrome.runtime.lastError; srEnVol = false;
        if (r && r.ok && typeof r.texte === 'string') {
          // 5.450 : le fichier part par le service worker (`chrome.downloads`) — aucun lien ajouté à la page de Vinted, aucun clic simulé.
          try { telechargerParExtension(new Blob([r.texte], { type: 'application/json' }), r.nom || 'vrm-reglages.json');
            srEtat = { ok: true, texte: TU('sr_sauve', { nom: r.nom || '' }) }; } catch (_) { srEtat = { ok: false, texte: TU('ra_ko') }; }
        } else srEtat = { ok: false, texte: (r && r.raison) || TU('ra_ko') };
        rendre(); }); } catch (_) { srEnVol = false; rendre(); }
    });
    const fi = R.querySelector('[data-sr-fichier]'); if (fi) fi.addEventListener('change', () => {
      const f = fi.files && fi.files[0]; if (!f) return;
      if (f.size > 1000000) { srEtat = { ok: false, texte: TU('sr_trop_grand') }; rendre(); return; }
      const lec = new FileReader();
      lec.onload = () => { srTexte = String(lec.result || ''); srChoix = {}; srApercuDemander(); };
      lec.onerror = () => { srEtat = { ok: false, texte: TU('sr_illisible') }; rendre(); };
      lec.readAsText(f);
    });
    R.querySelectorAll('[data-sr-choix]').forEach((c) => c.addEventListener('change', () => { srChoix[c.getAttribute('data-sr-choix')] = c.checked === true; srApercuDemander(); }));
    const no = R.querySelector('[data-sr-non]'); if (no) no.addEventListener('click', () => {
      srAp = null; srTexte = ''; srChoix = {}; srEtat = { ok: true, texte: TU('sr_rien_change') };
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'sauvegardeReglages', quoi: 'annuler' }, () => { void chrome.runtime.lastError; }); } catch (_) {}
      rendre();
    });
    const oui = R.querySelector('[data-sr-oui]'); if (oui) oui.addEventListener('click', () => {
      if (!srAp || srEnVol) return;
      srEnVol = true; rendre();
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'sauvegardeReglages', quoi: 'restaurer', confirme: true, jeton: srAp.jeton }, (r) => { void chrome.runtime.lastError; srEnVol = false; srAp = null; srTexte = '';
        srEtat = r && r.ok ? { ok: !(r.refus || []).length, texte: TU(Number(r.faits) === 1 ? 'sr_fait_1' : 'sr_fait', { n: Number(r.faits) || 0 }) + ((r.refus || []).length ? ' ' + TU('sr_refuses', { n: r.refus.length }) : '') } : { ok: false, texte: (r && r.raison) || TU('ra_ko') };
        rendre(); }); } catch (_) { srEnVol = false; rendre(); }
    });
  }
  // 5.440.3 : « Observer Vinted (10 min) » — l'interrupteur, l'état (minutes restantes, étapes notées) et « Envoyer
  //    l'observation ». L'état est lu au fond (`vrmObservation`) ; la frise n'est jamais montrée ici (seulement dans VRM).
  let obsVue = null, obsTexte = '', obsEnVol = false, obsLu = 0, obsRelire = null;
  function lireObservation(forcer) {
    if (!forcer && Date.now() - obsLu < 4000) return;
    obsLu = Date.now();
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'observation', quoi: 'etat' }, (r) => {
        void chrome.runtime.lastError;
        if (!(r && r.ok)) return;
        const avant = JSON.stringify(obsVue); obsVue = r;
        if (JSON.stringify(obsVue) !== avant) rendre();
      });
    } catch (_) {}
    clearTimeout(obsRelire);
    if (obsVue && obsVue.actif) obsRelire = setTimeout(() => lireObservation(true), 5000);
  }
  function observationHtml(e) {
    if (!e || e.plateforme !== 'vinted') return '';
    lireObservation(false);
    const o = obsVue, actif = !!(o && o.actif);
    const reste = actif ? Math.max(1, Math.ceil((Number(o.fin) - Date.now()) / 60000)) : 0;
    const sous = actif ? TU('ob_en_cours', { min: reste, n: o.n || 0 }) : o && o.n ? TU('ob_fini', { n: o.n }) : TU('ob_eteint');
    return `<section class="grp5" data-observation="${actif ? 'on' : 'off'}" data-observation-n="${Number(o && o.n) || 0}"><h3>${esc(TU('ob_titre'))}</h3><p class="note5">${esc(TU('ob_note'))}</p>
      <label class="rg6"><span><b>${esc(TU('ob_switch'))}</b><small data-obs-sous>${esc(sous)}</small></span><span class="v6"><input type="checkbox" data-obs-switch${actif ? ' checked' : ''}${obsEnVol ? ' disabled' : ''} aria-label="${esc(TU('ob_switch'))}"></span></label>
      ${o && o.n ? `<div class="outils"><button type="button" class="vu-btn" data-obs-envoyer${obsEnVol ? ' disabled' : ''}>${esc(TU('ob_envoyer'))}</button><button type="button" class="vu-btn" data-obs-fichier${obsEnVol ? ' disabled' : ''}>${esc(TU('ob_fichier'))}</button></div>` : ''}
      ${obsTexte ? `<p class="note5" role="status" data-obs-etat>${esc(obsTexte)}</p>` : ''}
    </section>`;
  }
  function brancherObservation(R) {
    const envoyerObs = (quoi, apres) => {
      obsEnVol = true; obsTexte = ''; rendre();
      try {
        chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'observation', quoi }, (r) => {
          void chrome.runtime.lastError; obsEnVol = false;
          if (r && r.ok) { if (quoi !== 'envoyer') obsVue = r; apres(r); } else obsTexte = (r && r.raison) || TU('ob_ko');
          lireObservation(true); rendre();
        });
      } catch (_) { obsEnVol = false; obsTexte = TU('ob_ko'); rendre(); }
    };
    const sw = R.querySelector('[data-obs-switch]');
    if (sw) sw.addEventListener('change', () => envoyerObs(sw.checked ? 'demarrer' : 'arreter', () => {}));
    const env = R.querySelector('[data-obs-envoyer]');
    if (env) env.addEventListener('click', () => envoyerObs('envoyer', (r) => { obsTexte = TU('ob_envoye', { n: r.n || 0 }); }));
    // (26 nov., 5.453.3) Le fichier de l'observation, téléchargé sur SON ordinateur (formes seulement, voir `<observation-regle>`).
    const fic = R.querySelector('[data-obs-fichier]');
    if (fic) fic.addEventListener('click', () => envoyerObs('fichier', (r) => {
      try {
        const blob = new Blob([JSON.stringify(r.fichier, null, 1)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `observation-vinted-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        obsTexte = TU('ob_fichier_ok', { n: r.n || 0 });
      } catch (_) { obsTexte = TU('ob_ko'); }
    }));
  }
  function cadenceHtml() {
    const c0 = listes && listes.automatisations && listes.automatisations.cadence;
    if (!listes || !listes.compte || !/^\d{1,20}$/.test(String(listes.compte.id || ''))) return '';
    if (!c0) return `<section class="grp5" data-cadence="pas-su"><h3>${esc(TU('cd_titre'))}</h3><p class="note5">—</p></section>`;
    const c = Object.assign({}, c0, cadBrouillon || {});
    const jour = c.parJour || 200;
    const LIB = { favorisHeure: TU('cd_fav_h'), actionsHeure: TU('cd_act_h'), parJour: TU('cd_jour'), pauseMin: TU('cd_pause_min'), pauseMax: TU('cd_pause_max') };
    const curseur = (k, min, max, pas, val, txt) => `<label class="champ6 cd6"><b>${esc(LIB[k])}</b><span class="cd6-l"><input type="range" min="${min}" max="${max}" step="${pas}" value="${val}" data-cad="${k}" aria-label="${esc(LIB[k])}"><output data-cad-v="${k}">${esc(txt)}</output></span></label>`;
    return `<section class="grp5" data-cadence="${esc(listes.compte.id)}"><h3>${esc(TU('cd_titre'))}</h3>
      ${curseur('favorisHeure', 1, 15, 1, Math.min(15, c.favorisHeure), TU('cd_par_heure', { n: Math.min(15, c.favorisHeure) }))}<p class="note5" data-cad-fav-limite>${esc(TU('cd_fav_limite'))}</p>
      ${curseur('actionsHeure', 10, 100, 1, c.actionsHeure, TU('cd_par_heure', { n: c.actionsHeure }))}
      ${curseur('parJour', 20, 1000, 10, jour, TU('cd_par_jour', { n: jour }))}
      ${curseur('pauseMin', 20, 240, 5, c.pauseMin, TU('cd_secondes', { n: c.pauseMin }))}
      ${curseur('pauseMax', 20, 240, 5, c.pauseMax, TU('cd_secondes', { n: c.pauseMax }))}
      <p class="note5" data-cad-risque>${esc(TU('cd_risque'))}</p>
      ${cadConfirme ? `<div class="conf5" role="alertdialog" data-cad-confirme><p>${esc(TU('cd_confirme_q'))}</p><div class="outils"><button type="button" class="vu-btn vu-plein" data-cad-oui>${esc(TU('cd_oui'))}</button><button type="button" class="vu-btn" data-cad-non>${esc(TU('ra_annuler'))}</button></div></div>` : ''}
      ${cadEtat ? `<p class="note5" role="status" data-cad-etat="${cadEtat.ok ? 'ok' : 'ko'}">${esc(cadEtat.texte)}</p>` : ''}
      ${cadConfirme ? '' : `<div class="outils"><button type="button" class="vu-lien" data-cad-defaut>${esc(TU('cd_defaut'))}</button><button type="button" class="vu-btn vu-plein" data-cad-enregistrer${cadEnVol || !cadBrouillon ? ' disabled' : ''}>${esc(TU('ra_enregistrer'))}</button></div>`}
    </section>`;
  }
  // ══ 5.409 — NOTIFICATIONS (capture « Notifications » de Vintex) : le journal capté des 7 derniers jours, en tableau
  //    filtrable (type, statut « nouveau » / « vu » selon le marqueur de l'app), chaque ligne mène à VRM par identité.
  let notifType = 'tous', notifStatut = 'tous';
  const SORTES_NOTIF = ['refus', 'ventes', 'codes', 'bordereaux', 'achats', 'offres', 'messages', 'versements', 'numerotes', 'annonces'];
  function notificationsHtml() {
    if (listesErreur) return `<div class="val gris" role="status">${esc(listesErreur)}</div>`;
    if (!listes) return `<div class="val gris" role="status" data-listes-charge>${esc(TU('m_charge'))}</div>`;
    const n = listes.notifications;
    if (!n) return `<div class="val gris" data-notifs="pas_su">${esc(TU('no_pas_su'))}</div>`;
    const vu = Number(n.vu) || 0;
    const statut = (e) => (vu && e.t <= vu ? 'vu' : 'nouveau');
    const vus = n.liste.filter((e) => (notifType === 'tous' || e.s === notifType) && (notifStatut === 'tous' || statut(e) === notifStatut));
    const quand = (t) => { try { return new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
    const lienVrm = (e) => { const id = String(e.id).split(/[:@]/)[0]; const tx = /^\d{1,20}$/.test(id) ? id : '';
      return 'https://vrm.center/' + (e.s === 'ventes' || e.s === 'versements' ? `?tab=ventes&site=vinted${tx ? '&cible=vente&tx=' + tx : ''}` : e.s === 'codes' ? `?tab=achats${tx ? '&cible=retrait&tx=' + tx : ''}` : e.s === 'bordereaux' ? `?tab=ventes${tx ? '&cible=colis&tx=' + tx : ''}` : e.s === 'achats' ? `?tab=achats&vue=achats${tx ? '&cible=achat&tx=' + tx : ''}` : e.s === 'messages' || e.s === 'offres' ? '?tab=messages&site=vinted' : e.s === 'refus' ? '?tab=settings&section=toutvabien' : '?tab=annonces&site=vinted'); };
    const filtres = `<div class="barre5"><select class="act5" data-notif-type aria-label="${esc(TU('no_type'))}"><option value="tous">${esc(TU('no_tous_types'))}</option>${SORTES_NOTIF.map((k) => `<option value="${k}"${notifType === k ? ' selected' : ''}>${esc(TU('ns_' + k))}</option>`).join('')}</select>`
      + `<div class="vu-seg vue5" role="group" aria-label="${esc(TU('no_statut'))}">${['tous', 'nouveau', 'vu'].map((k) => `<button type="button" data-notif-statut="${k}" aria-pressed="${notifStatut === k}">${esc(TU('nt_' + k))}</button>`).join('')}</div></div>`;
    const tete = `<div class="lu" data-notifs-n="${vus.length}">${esc(TU('no_7j', { n: vus.length }))}</div>`;
    if (!vus.length) return filtres + tete + `<div class="val gris" data-notifs="0">${esc(TU('no_aucune'))}</div>`;
    return filtres + tete + `<div class="table5 notif5" data-notifs="${vus.length}"><div class="tr5 th5 trn5"><span>${esc(TU('no_type'))}</span><span>${esc(TU('no_quand'))}</span><span>${esc(TU('no_statut'))}</span><span></span></div><ul class="rangs">${vus.map((e) => `<li><a class="tr5 trn5" data-notif="${esc(e.s)}" data-notif-statut-l="${statut(e)}" href="${esc(lienVrm(e))}" target="_blank" rel="noopener"><span class="ti">${esc(TU('ns_' + e.s))}</span><span class="cel5">${esc(quand(e.t))}</span><span class="cel5"><span class="st5" data-statut="${statut(e)}">${esc(TU('nt_' + statut(e)))}</span></span><span class="cel5 chev5" aria-hidden="true">›</span></a></li>`).join('')}</ul></div>`;
  }
  function autresHtml() {
    if (!porteeTous) return '';
    if (!listes || !Array.isArray(listes.autres)) return '<div class="val gris" role="status">Je lis tes autres comptes…</div>';
    if (!listes.autres.length) return '<div class="val gris" data-autres="0">Aucun autre compte Vinted relié à VRM.</div>';
    return `<div class="autres" data-autres="${listes.autres.length}">${listes.autres.map((c) => {
      const a = c.annonces, v = c.ventes;
      const lignes = ongletListe === 'ventes' ? (v ? v.liste.map((x) => `<li class="rang">${vignette('')}<span class="mil"><span class="ti">${esc(x.titre)}</span><span class="me">${esc(ETAT_VENTE[x.etat] || '')}</span></span><span class="px">${esc(eurosL(x.prix))}</span></li>`) : [])
        : (a ? a.liste.map((x) => `<li class="rang">${vignette('')}<span class="mil"><span class="ti">${esc(x.titre)}</span></span><span class="px">${esc(eurosL(x.prix))}</span></li>`) : []);
      return `<section class="autre" data-autre="${esc(c.id)}" inert aria-label="${esc(c.nom || 'Autre compte')} — lecture seule"><div class="autre-t"><b>${esc(c.nom || 'Autre compte')}</b>${a && a.n != null ? ` · ${Number(a.n).toLocaleString('fr-FR')} annonces` : ''}${v && v.n != null ? ` · ${Number(v.n).toLocaleString('fr-FR')} ventes` : ''}</div><ul class="rangs flou" aria-hidden="true">${lignes.join('')}</ul><div class="autre-a">Connecte-toi à ce compte pour agir.</div></section>`;
    }).join('')}</div>`;
  }
  // Le bloc entier (carte du site, ou fenêtre de l'extension).
  // ══ 5.410 — LE PANNEAU « COMME VINTEX » : barre latérale fixe (Accueil · Articles · Commandes · Messagerie · Favoris ·
  //    Notifications · Automatisations ; Paramètres en bas ; réductible en icônes), en-tête « {Page} · pastille du compte »
  //    et « Mis à jour il y a … ⟳ » à droite, la page dessous. Au téléphone / Orion : la même chose empilée (la barre
  //    devient une rangée d'onglets défilante en haut).
  let vxReduit = false;
  // 5.413 (téléphone) : la barre du bas a CINQ onglets égaux (Accueil · Articles · Commandes · Messagerie · Plus) ; « Plus »
  // ouvre une feuille du bas avec les quatre autres pages. À l'ordinateur, rien ne change (la feuille est la barre latérale).
  let vxPlus = false;
  const PLUS6 = ['favoris', 'notifications', 'automatisations', 'file', 'sante', 'parametres'];
  try { chrome.storage.local.get(['vrmPanneauReduit'], (g) => { try { void chrome.runtime.lastError; } catch (_) {} vxReduit = !!(g && g.vrmPanneauReduit === true); }); } catch (_) {}
  const ICO6 = {
    accueil: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
    annonces: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    ventes: '<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
    messages: '<path d="M4 5h16v11H9l-5 4z"/>',
    favoris: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    notifications: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    automatisations: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5"/>',
    sante: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    file: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    parametres: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  };
  const ico6 = (k) => `<svg class="ico6" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICO6[k] || ''}</svg>`;
  const PAGES6 = { accueil: 'v6_accueil', annonces: 'v6_articles', ventes: 'v6_commandes', messages: 'v6_messagerie', favoris: 'c_favoris', notifications: 'c_notifications', automatisations: 'c_automatisations', file: 'q7_titre', sante: 'sa_titre', parametres: 'c_parametres' };
  // L'heure de la dernière lecture de CE que la page montre (jamais une heure inventée ; « — » sinon).
  function luDeLaPage(e) {
    const l = listes || {};
    const pick = ongletListe === 'annonces' ? l.annonces && l.annonces.lu : ongletListe === 'ventes' ? l.ventes && l.ventes.lu : ongletListe === 'messages' ? l.messages && l.messages.lu : null;
    return Number(pick) || Number(listesAt) || Number(e && e.flux && e.flux.okAt) || 0;
  }
  // L'ACCUEIL : un petit tableau de bord — le compte de l'onglet et sa liaison à VRM, les chiffres du jour, la jauge,
  // ce que l'extension vient de capter. Tout vient de ce qui est déjà lu ; « — » quand ce n'est pas su.
  // ══ 5.420 (`santecomptes`, Julien, 21 nov.) — LA SANTÉ DE CHAQUE COMPTE ════════════════════════════════════════════
  // Une section par compte Vinted de ce navigateur : l'état (Bon · Attention · Pause) avec la raison et quoi faire, puis les
  // chiffres : actions de l'heure / du jour face aux plafonds, favoris envoyés, refus de Vinted des 24 h, dernière
  // vérification, pause en cours, compte bloqué. Tout vient du fond (`santeCarte`, lecture locale) ; « pas su » = « — ».
  let santeV, santeAt = 0;
  function lireSante(frais) {
    if (!frais && santeV !== undefined && Date.now() - santeAt < 30000) return;
    santeAt = Date.now(); if (santeV === undefined) santeV = null;
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'santeCarte', frais: !!frais }, (r) => { void chrome.runtime.lastError; santeV = r && r.ok ? r : { ok: false }; if (['sante', 'accueil', 'parametres'].includes(ongletListe) || !ongletListe) rendre(); }); } catch (_) { santeV = { ok: false }; }
  }
  const TON_SANTE = { bon: '', attention: 'ambre', pause: 'ambre', passu: '' };
  function santeHtml() {
    lireSante(false);
    if (santeV == null) return `<div class="sa10" data-sante="lecture"><p class="note5" role="status">${esc(TU('sa_lecture'))}</p></div>`;
    if (!santeV.ok) return `<div class="sa10" data-sante="pas-su"><p class="note5">— ${esc(TU('sa_pas_su'))}</p></div>`;
    const cs = Array.isArray(santeV.comptes) ? santeV.comptes : [];
    if (!cs.length) return `<div class="sa10" data-sante="vide"><p class="note5">${esc(TU('sa_aucun'))}</p></div>`;
    const nb = (v) => (v == null ? '—' : nbFr(v));
    const sur = (a, b) => (a == null ? '—' : b == null ? nbFr(a) : TU('sa_sur', { a: nbFr(a), b: nbFr(b) }));
    const hh = (t) => (Number(t) > 0 ? heureFl(Number(t)) : '');
    const quand = (t) => (Number(t) > 0 ? dateCourte5(Number(t)) : '—');
    return `<div class="sa10" data-sante="lu">${cs.map((c) => {
      const v = c.sante || { etat: 'passu', raison: 'passu', geste: '' };
      const lib = TU('sa_e_' + v.etat);
      const raison = TU('sa_r_' + v.raison, { h: hh(v.jusqua) });
      const geste = v.geste ? TU('sa_g_' + v.geste, { h: hh(v.jusqua) }) : '';
      const r = c.refus;
      const ligne = (k, val, attr) => `<div class="rg6" data-sante-l="${k}"${attr || ''}><span><b>${esc(TU('sa_l_' + k))}</b></span><span class="v6">${esc(val)}</span></div>`;
      return `<section class="sec6" data-sante-compte="${esc(c.uid)}" data-sante-etat="${esc(v.etat)}" data-sante-raison="${esc(v.raison)}"${santeV.ici === c.uid ? ' data-sante-ici' : ''}>
        <h3>${esc(c.nom || c.uid)}${santeV.ici === c.uid ? ` <small>${esc(TU('sa_ici'))}</small>` : ''}</h3>
        <div class="rg6 sa10-t"><span><b>${esc(raison)}</b>${geste ? `<small data-sante-geste="${esc(v.geste)}">${esc(geste)}</small>` : ''}</span><span class="v6">${etiquette5(v.etat, lib, TON_SANTE[v.etat] || '')}</span></div>
        ${ligne('heure', sur(c.h, c.maxH) + (c.complet === false ? ' · ' + TU('sa_au_moins') : ''), ` data-h="${c.h == null ? '' : c.h}" data-max-h="${c.maxH == null ? '' : c.maxH}"`)}
        ${ligne('jour', sur(c.j, c.maxJ), ` data-j="${c.j == null ? '' : c.j}"`)}
        ${ligne('favoris', c.favH == null ? '—' : TU('sa_fav', { h: sur(c.favH, c.favMaxH), j: nb(c.favJour) }))}
        ${ligne('refus', r ? TU('sa_refus', { a: nb(r['403']), b: nb(r['429']) }) : '—', r ? ` data-403="${r['403']}" data-429="${r['429']}"` : '')}
        ${ligne('verifs', r ? nb(r.captcha) : '—')}
        ${ligne('pasvu', r ? nb(r.pasvu) : '—')}
        ${ligne('derniere', quand(c.dernierCaptcha))}
        ${ligne('pause', Number(c.pauseJusqua) > Date.now() ? TU('sa_jusqua', { h: hh(c.pauseJusqua) }) : Number(c.prudenceJusqua) > Date.now() ? TU('sa_prudence', { h: hh(c.prudenceJusqua) }) : TU('sa_non'))}
        ${ligne('bloque', c.bloque === 'banni' ? TU('sa_oui') : c.bloque === 'actif' ? TU('sa_non') : '—')}
        ${noteSanteHtml(c)}
      </section>`; }).join('')}<p class="note5" data-sante-note>${esc(TU('sa_note'))}</p><p class="note5" data-sante-remonte>${esc(TU('sn_remonte'))}</p></div>`;
  }
  // ══ 5.438 (`santenote`, `precieux`, Julien 22 nov., choix 1 et 2) — LA NOTE, SES POINTS, LA CADENCE APPLIQUÉE ══════
  // Tout vient du fond (`santeCarte` : la règle <sante-note-regle>) ; « pas su » = « — » avec sa raison, jamais un chiffre.
  const maj6 = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  function phraseNote6(c) {
    const ph = c && c.phrase ? c.phrase : { cle: 'passu', v: {} };
    if (ph.cle === 'passu') return TU('sn_passu');
    const v = ph.v || {}, r = ph.raison;
    const raison = r ? (r.k === 'vues' ? TU('sn_raison_vues', { pct: r.pct != null ? r.pct : '—' }) : TU('sn_raison', { n: r.n, k: TU('sn_k_' + r.k), h: r.h })) : '';
    return TU('sn_ph_' + ph.cle, { cap: v.cap != null ? v.cap : '—', raison });
  }
  function noteSanteHtml(c) {
    const n = c && c.note;
    const lu = !!(n && n.note != null);
    const tete = `<div class="rg6 sn6" data-sante-note-compte="${lu ? n.note : ''}" data-sante-pct="${lu ? n.pct : ''}" data-sante-cap="${c && c.cadence ? c.cadence.actionsHeure : ''}" data-sante-fav="${c && c.cadence ? c.cadence.favorisHeure : ''}"${c && c.precieux ? ' data-sante-precieux' : ''}><span><b>${esc(TU('sn_titre'))}</b><small data-sante-phrase="${esc(c && c.phrase ? c.phrase.cle : 'passu')}">${esc(phraseNote6(c))}</small></span><span class="v6">${lu ? etiquette5('note', TU('sn_sur', { n: n.note }), n.pct < 100 ? 'ambre' : '') : '—'}${c && c.precieux ? ' ' + etiquette5('precieux', TU('pr_on'), '') : ''}</span></div>`;
    if (!lu) return tete;
    const pts = (n.points || []).map((p) => `<div class="rg6" data-sante-point="${esc(p.k)}" data-retire="${esc(p.retire)}"><span><b>${esc(maj6(TU('sn_k_' + p.k)))}</b><small>${esc(p.k === 'vues' ? TU('sn_point_vues', { apres: nbFr(p.apres), avant: nbFr(p.avant) }) : TU('sn_point', { n24: p.n24, n72: p.n72 }))}</small></span><span class="v6">${esc(TU('sn_retire', { r: String(p.retire).replace('.', ',') }))}</span></div>`).join('');
    const mq = (n.manque || []).filter((k) => k === 'masquees' || k === 'vues').map((k) => `<p class="note5" data-sante-manque="${k}">— ${esc(TU('sn_manque_' + k))}</p>`).join('');
    return tete + (pts || `<p class="note5" data-sante-aucun-point>${esc(TU('sn_aucun'))}</p>`) + mq;
  }
  const santeDuCompte6 = () => { const id = listes && listes.compte && String(listes.compte.id || ''); if (!/^\d{1,20}$/.test(id || '')) return null; lireSante(false); return santeV && santeV.ok && Array.isArray(santeV.comptes) ? santeV.comptes.find((x) => x.uid === id) || null : null; };
  // 5.438 : la programmation d'avant en pause « en vérification » — le même état et le même « Reprendre la série » que la série.
  function progVerifHtml() {
    const l = listes && Array.isArray(listes.progVerif) ? listes.progVerif : [];
    if (!l.length) return '';
    const hh = (t) => { try { return new Date(Number(t)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
    return `<section class="sec6" data-prog-verif="${l.length}">${l.map((v) => `<div class="conf5" role="status" data-prog-verif-etat="${v.aToi ? 'a-toi' : 'attente'}"><p>${esc(TU(v.aToi ? 'rv_24h' : 'rv_pause', { t: v.titre || v.nouvelId }))}</p>${v.aToi ? `<div class="outils"><button type="button" class="vu-btn vu-plein" data-prog-verif-reprendre="${esc(v.id)}">${esc(TU('rv_reprendre'))}</button></div>` : `<p class="note5">${esc(TU('rv_relu', { h: hh(v.prochaine) }))}</p>`}</div>`).join('')}</section>`;
  }
  function noteAccueilHtml() {
    const c = santeDuCompte6();
    if (!c) return '';
    const n = c.note, lu = !!(n && n.note != null);
    return `<button type="button" class="rg6 sn6-b" data-onglet-b="sante" data-accueil-note="${lu ? n.note : ''}" data-accueil-phrase="${esc(c.phrase ? c.phrase.cle : 'passu')}"><span><b>${esc(TU('sn_titre'))} · ${lu ? `<span${n.pct < 100 ? ' data-ton="ambre" class="sn6-n"' : ''}>${esc(TU('sn_sur', { n: n.note }))}</span>` : '—'}</b><small>${esc(phraseNote6(c))}</small></span><span class="v6">${c.precieux ? etiquette5('precieux', TU('pr_on'), '') : ''}</span></button>`;
  }
  // « Compte précieux » (Paramètres) : l'allumer protège (aucune question) ; l'éteindre demande SA confirmation.
  let prConfirme = false;
  function precieuxHtml() {
    if (!listes || !listes.compte || !/^\d{1,20}$/.test(String(listes.compte.id || '')) || !listes.automatisations || !listes.automatisations.bleam) return '';
    const on = bmVal('precieux').actif === true;
    const c = santeDuCompte6();
    const ph = c ? `<p class="note5" data-pr-cadence="${esc(c.phrase ? c.phrase.cle : 'passu')}">${esc(phraseNote6(c))}</p>` : '';
    const conf = prConfirme ? `<div class="conf5" role="alertdialog" data-pr-confirme><p>${esc(TU('pr_conf_q'))}</p><div class="outils"><button type="button" class="vu-btn vu-plein" data-pr-oui>${esc(TU('pr_oui'))}</button><button type="button" class="vu-btn" data-pr-non>${esc(TU('ra_annuler'))}</button></div></div>` : '';
    return `<section class="grp5" data-precieux="${on ? 'oui' : 'non'}"><h3>${esc(TU('pr_titre'))}</h3><p class="note5" data-pr-note>${esc(TU('pr_note'))}</p><div class="rg6"><span><b>${esc(TU(on ? 'pr_on' : 'pr_non'))}</b></span><button type="button" class="vu-btn ra6" data-pr-bascule aria-pressed="${on}"${bmEnVol ? ' disabled' : ''}>${esc(TU(on ? 'pr_eteindre' : 'pr_allumer'))}</button></div>${conf}${ph}${bmEtat && !prConfirme && bmEtatPr ? `<p class="note5" role="status" data-pr-etat="${bmEtat.ok ? 'ok' : 'ko'}">${esc(bmEtat.texte)}</p>` : ''}</section>`;
  }
  let bmEtatPr = false;
  // La ligne « bloqué : compte précieux » posée dans chaque automatisation qu'il bloque.
  const precieuxBloqueHtml = () => (listes && listes.automatisations && listes.automatisations.bleam && bmVal('precieux').actif === true ? `<p class="note5" data-ton="ambre" data-pr-bloque>${esc(TU('pr_bloque'))}</p>` : '');
  // Le bilan des relances et des lots (60 jours) — lu au fond (`bilanAuto`), « — » si pas su.
  let biData = null;
  function bilanHtml(quoi) {
    if (!biData) { biData = { charge: true }; try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'bilanAuto' }, (r) => { void chrome.runtime.lastError; biData = r && r.ok ? { data: r } : { ko: true }; rendre(); }); } catch (_) { biData = { ko: true }; } }
    if (biData.charge) return `<section class="sec6" data-bilan="charge"><h3>${esc(TU('bi_titre'))}</h3><p class="note5">…</p></section>`;
    if (!biData.data) return `<section class="sec6" data-bilan="pas-su"><h3>${esc(TU('bi_titre'))}</h3><p class="note5">—</p></section>`;
    const d = biData.data, r = d.relances || {};
    const corps = quoi === 'lot' ? `<p class="note5" data-bilan-lots="${d.lots ? d.lots.envoyes : ''}">${esc(TU('bi_lots', { n: d.lots ? d.lots.envoyes : '—', a: d.lots ? d.lots.auto : '—' }))}</p>`
      : `<p class="note5" data-bilan-relances="${r.envoyees != null ? r.envoyees : ''}" data-bilan-ventes="${r.ventes != null ? r.ventes : ''}">${esc(TU('bi_relances', { n: r.envoyees != null ? r.envoyees : '—', v: r.ventes != null ? r.ventes : '—' }))}${d.sansAchat ? ' · ' + esc(TU('bi_sans_achat', { n: d.sansAchat })) : ''}</p>${r.ventes ? `<p class="note5" data-bilan-montant>${esc(TU('bi_montant', { m: eur5(r.montant) }))}</p>` : ''}<p class="note5">${esc(TU('bi_note'))}</p>`;
    return `<section class="sec6" data-bilan="${quoi}"><h3>${esc(TU('bi_titre'))}</h3>${corps}</section>`;
  }
  function lotAutoDetailHtml() {
    const tx = Number(bmVal('lotFavoris').taux) || 10;
    return bmSectionHtml('lotFavoris', `<p class="note5" data-lot-auto-note>${esc(TU('lot_auto_note'))}</p><div class="rg6"><span><b>${esc(TU('lot_taux'))}</b></span><div class="vu-seg vue5" role="group">${[5, 10, 15, 20].map((t) => `<button type="button" data-bm-choix="lotFavoris.taux" data-bm-v="${t}" aria-pressed="${tx === t}">−${t} %</button>`).join('')}</div></div>${precieuxBloqueHtml()}`, 'lot_auto_titre') + bilanHtml('lot');
  }
  function brouillonsDetailHtml() {
    return bmSectionHtml('brouillonsAuto', `<p class="note5" data-br-note>${esc(TU('br_note'))}</p><p class="note5">${esc(TU('br_ou'))}</p>${precieuxBloqueHtml()}`, 'bm_brouillons');
  }
  function brancher5438(racine) {
    const b = racine.querySelector('[data-pr-bascule]');
    if (b) b.addEventListener('click', () => { const on = bmVal('precieux').actif === true; bmEtatPr = true; if (on) { prConfirme = true; rendre(); } else bmEnvoyer('precieux', true, false, () => { santeAt = 0; lireSante(true); }); });
    racine.querySelectorAll('[data-prog-verif-reprendre]').forEach((x) => x.addEventListener('click', () => { try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'progVerifReprendre', id: x.getAttribute('data-prog-verif-reprendre'), confirme: true }, () => { void chrome.runtime.lastError; chargerListes(true); }); } catch (_) {} }));
    const oui = racine.querySelector('[data-pr-oui]'); if (oui) oui.addEventListener('click', () => { prConfirme = false; bmEnvoyer('precieux', false, true, () => { santeAt = 0; lireSante(true); }); });
    const non = racine.querySelector('[data-pr-non]'); if (non) non.addEventListener('click', () => { prConfirme = false; rendre(); });
  }
  // ══ 5.433 (`filevisible`, `pauseapres`, `apprisclic`, Julien 21 nov., choix n° 97, 99, 102) — LA FILE D'ACTIONS ══════════
  // UNE liste : ce qui passe (en cours), ce qui attend son tour, les paires de l'atelier pas encore parties (heure prévue),
  // la republication programmée — position, sorte, site et compte, N°, heure. SON toucher : retirer / monter / descendre
  // une action pas commencée (une action commencée ne bouge plus) ; « Pause après celle-ci » / « Reprendre ». Tout vient du
  // fond (`vrmFile`, lecture locale) ; rien ici n'agit chez une plateforme.
  let fileV, fileAt = 0, fileEtat = null, fileEnVol = false, apprisV, apprisConf = false, apprisEtat = null;
  function lireFile6(frais) {
    if (!frais && fileV !== undefined && Date.now() - fileAt < 4000) return;
    fileAt = Date.now(); if (fileV === undefined) fileV = null;
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'fileLire' }, (r) => { void chrome.runtime.lastError; fileV = r && r.ok && r.file ? r.file : { pasSu: true }; if (['file', 'accueil'].includes(ongletListe)) rendre(); }); } catch (_) { fileV = { pasSu: true }; }
  }
  try { chrome.storage.onChanged.addListener((ch, zone) => { if (zone === 'local' && (ch.vrmFile || ch.vrmAtelierRepub || ch.vrmAtelierProg) && ['file', 'accueil'].includes(ongletListe)) lireFile6(true); }); } catch (_) {}
  function lireAppris6(frais) {
    if (!frais && apprisV !== undefined) return;
    apprisV = apprisV || null;
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'apprisLire' }, (r) => { void chrome.runtime.lastError; apprisV = r && r.ok ? r : { pasSu: true }; if (ongletListe === 'parametres') rendre(); }); } catch (_) { apprisV = { pasSu: true }; }
  }
  const SORTES_Q7 = ['republier', 'baisse', 'prix', 'masquer', 'supprimer', 'publier', 'favori', 'lot', 'message', 'offre', 'reponse', 'agent', 'relance', 'bordereau', 'vacances', 'evaluation', 'apresvente', 'pause', 'retrait'];
  const sorteQ7 = (s) => TU('q7_s_' + (SORTES_Q7.includes(s) ? s : 'autre'));
  const compteQ7 = (l) => { const c = listes && listes.compte; return c && String(c.id) === String(l.uid) && c.nom ? c.nom : ''; };
  function ligneQ7(l, i, bornes) {
    const site = NOM_SITE[l.site] || '';
    const nom = compteQ7(l);
    const quand = l.etat === 'cours' ? (Number(l.debut) > 0 ? TU('q7_depuis', { h: heureFl(Number(l.debut)) }) : '') : Number(l.prevu) > Date.now() + 30000 ? TU('q7_a', { h: heureFl(Number(l.prevu)) }) : l.etat === 'prevue' ? TU('q7_ensuite') : '';
    const titre = l.source === 'programme' ? TU(Number(l.n) === 1 ? 'q7_prog_1' : 'q7_prog', { n: Number(l.n) || 0 }) : sorteQ7(l.sorte);
    // L'étiquette douce seulement pour celle qui passe ; l'état des autres est dit dans la ligne grise (« En attente · … »).
    const etq = l.etat === 'cours' ? etiquette5('cours', TU('q7_e_cours'), '') : '';
    const etatTxt = l.etat === 'cours' ? '' : TU('q7_e_' + (l.etat === 'prevue' ? 'prevue' : 'attente'));
    const bouge = l.etat !== 'cours';
    const essai = l.essai && U.MODIF && U.MODIF.essaiTxt ? U.MODIF.essaiTxt(l.essai) : '';
    return `<li class="rg6 q7-r" data-q7="${esc(l.id)}" data-q7-etat="${esc(l.etat)}" data-q7-sorte="${esc(l.sorte)}" data-q7-site="${esc(l.site)}">
      <span class="q7-p" aria-hidden="true">${i + 1}</span>
      <span class="q7-c"><b>${l.num ? plaque(l.num) + ' ' : ''}${esc(titre)}</b><small>${esc([etatTxt, site, nom, quand].filter(Boolean).join(' · '))}</small>${l.titre ? `<small class="q7-t">${esc(l.titre)}</small>` : ''}${essai ? `<small class="q7-essai" role="status" data-q7-essai>${esc(essai)}</small>` : ''}</span>
      <span class="q7-g">${etq}${bouge ? `${l.source === 'programme' ? '' : `<button type="button" class="rond6" data-q7-geste="monter" data-q7-id="${esc(l.id)}" aria-label="${esc(TU('q7_monter'))}" title="${esc(TU('q7_monter'))}"${i <= bornes.premier ? ' disabled' : ''}>↑</button><button type="button" class="rond6" data-q7-geste="descendre" data-q7-id="${esc(l.id)}" aria-label="${esc(TU('q7_descendre'))}" title="${esc(TU('q7_descendre'))}"${i >= bornes.dernier[l.source] ? ' disabled' : ''}>↓</button>`}<button type="button" class="rond6 q7-x" data-q7-geste="retirer" data-q7-id="${esc(l.id)}" aria-label="${esc(TU('q7_retirer'))}" title="${esc(TU('q7_retirer'))}"${fileEnVol ? ' disabled' : ''}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : ''}</span>
    </li>`;
  }
  function pauseQ7Html(f) {
    if (f.pause === 'oui') return `<div class="rg6 q7-pause" data-q7-pause="oui"><span><b>${esc(TU('q7_pause_oui'))}</b></span><span class="v6"><button type="button" class="vu-btn vu-plein" data-q7-geste="reprendre"${fileEnVol ? ' disabled' : ''}>${esc(TU('q7_reprendre'))}</button></span></div>`;
    if (f.pause === 'apres') return `<div class="rg6 q7-pause" data-q7-pause="apres"><span><b>${esc(TU('q7_pause_attente'))}</b></span><span class="v6"><button type="button" class="vu-btn" data-q7-geste="reprendre"${fileEnVol ? ' disabled' : ''}>${esc(TU('q7_reprendre'))}</button></span></div>`;
    return (f.lignes || []).length ? `<div class="rg6 q7-pause" data-q7-pause=""><span><small>${esc(TU('q7_note'))}</small></span><span class="v6"><button type="button" class="vu-btn" data-q7-geste="pause"${fileEnVol ? ' disabled' : ''}>${esc(TU('q7_pause_apres'))}</button></span></div>` : '';
  }
  function fileHtml() {
    lireFile6(false);
    if (fileV == null) return `<div class="q7" data-q7-page="lecture"><p class="note5" role="status">${esc(TU('q7_lecture'))}</p></div>`;
    if (fileV.pasSu) return `<div class="q7" data-q7-page="pas-su"><p class="note5">— ${esc(TU('sa_pas_su'))}</p></div>`;
    const f = fileV, L = Array.isArray(f.lignes) ? f.lignes : [];
    // Les bornes du déplacement : on ne monte pas au-dessus d'une action en cours, chaque source reste dans sa famille.
    const premier = L.findIndex((l) => l.etat !== 'cours');
    const dernier = {}; L.forEach((l, i) => { if (l.etat !== 'cours') dernier[l.source] = i; });
    const bornesFile = { premier: L.findIndex((l) => l.etat !== 'cours' && l.source === 'file'), dernier };
    const bornesAt = { premier: L.findIndex((l) => l.source === 'atelier'), dernier };
    const faites = Array.isArray(f.faites) ? f.faites : [];
    return `<div class="q7" data-q7-page="lu" data-q7-pause-etat="${esc(f.pause || '')}" data-q7-n="${L.length}">
      <section class="sec6" aria-label="${esc(TU('q7_titre'))}">${pauseQ7Html(f)}${fileEtat ? `<p class="note5" role="status" data-q7-etat-geste="${fileEtat.ok ? 'ok' : 'ko'}">${esc(fileEtat.texte)}</p>` : ''}
        ${L.length ? `<ol class="q7-l" aria-label="${esc(TU('q7_titre'))}">${L.map((l, i) => ligneQ7(l, i, l.source === 'atelier' ? bornesAt : bornesFile)).join('')}</ol>` : `<p class="note5" data-q7-vide>${esc(TU('q7_vide'))}</p>`}
      </section>
      ${faites.length ? `<section class="sec6"><h3>${esc(TU('q7_faites'))}</h3>${faites.map((x) => `<div class="rg6" data-q7-faite="${esc(x.issue)}"><span><b>${x.num ? plaque(x.num) + ' ' : ''}${esc(sorteQ7(x.sorte))}</b><small>${esc([NOM_SITE[x.site] || '', Number(x.fin) > 0 ? heureFl(Number(x.fin)) : ''].filter(Boolean).join(' · '))}${x.raison && !['faite', 'retiree'].includes(x.issue) ? ' · ' + esc(x.raison) : ''}</small></span><span class="v6">${etiquette5(x.issue, TU('q7_i_' + String(x.issue || 'erreur').replace('-', '')), x.issue === 'incertaine' ? 'ambre' : '')}</span></div>`).join('')}</section>` : ''}
    </div>`;
    void premier;
  }
  // L'accueil : une ligne quand la file n'est pas vide ou en pause (« Voir la file »).
  function fileAccueilHtml() {
    lireFile6(false);
    const f = fileV; if (!f || f.pasSu) return '';
    const n = Array.isArray(f.lignes) ? f.lignes.length : 0;
    if (!n && !f.pause) return '';
    const cours = (f.lignes || []).find((l) => l.etat === 'cours');
    return `<section class="sec6" data-accueil-file="${n}"><h3>${esc(TU('q7_titre'))}</h3><button type="button" class="rg6 q7-acc" data-onglet-b="file"><span><b>${esc(TU(n === 1 ? 'q7_en_cours_n_1' : 'q7_en_cours_n', { n }))}</b><small>${esc(f.pause === 'oui' ? TU('q7_pause_oui') : f.pause === 'apres' ? TU('q7_pause_attente') : cours ? sorteQ7(cours.sorte) + ' · ' + TU('q7_e_cours') : TU('q7_e_attente'))}</small></span><span class="v6">${esc(TU('q7_voir'))} ›</span></button></section>`;
  }
  function brancherFile6(R) {
    R.querySelectorAll('[data-q7-geste]').forEach((b) => b.addEventListener('click', () => {
      if (fileEnVol) return;
      const quoi = b.getAttribute('data-q7-geste'), id = b.getAttribute('data-q7-id') || '';
      fileEnVol = true; fileEtat = null; rendre();
      try {
        chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'fileGeste', quoi, id }, (r) => {
          void chrome.runtime.lastError; fileEnVol = false;
          if (r && r.ok && r.file) { fileV = r.file; fileAt = Date.now(); fileEtat = null; } else fileEtat = { ok: false, texte: (r && r.raison) || TU('ra_ko') };
          rendre();
        });
      } catch (_) { fileEnVol = false; }
    }));
    const ob = R.querySelector('[data-appris-oublier]'); if (ob) ob.addEventListener('click', () => { apprisConf = true; apprisEtat = null; rendre(); });
    const on = R.querySelector('[data-appris-non]'); if (on) on.addEventListener('click', () => { apprisConf = false; rendre(); });
    const oo = R.querySelector('[data-appris-oui]'); if (oo) oo.addEventListener('click', () => {
      oo.disabled = true;
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'apprisOublier', confirme: true }, (r) => { void chrome.runtime.lastError; apprisConf = false; apprisEtat = r && r.ok ? { ok: true, texte: TU('ap7_oublie') } : { ok: false, texte: (r && r.raison) || TU('ra_ko') }; lireAppris6(true); rendre(); }); } catch (_) {}
    });
  }
  // Paramètres : ce que VRM a appris dans CE navigateur, et « Oublier » (SON toucher, une confirmation).
  function apprisHtml() {
    lireAppris6(false);
    const a = apprisV;
    const n = a && !a.pasSu ? Number(a.n) || 0 : null;
    return `<section class="grp5" data-appris="${n == null ? '' : n}"><h3>${esc(TU('ap7_titre'))}</h3><p class="note5">${esc(TU('ap7_note'))}</p>
      ${n == null ? `<p class="note5">—</p>` : n === 0 ? `<p class="note5" data-appris-aucun>${esc(TU('ap7_aucun'))}</p>` : `<p class="note5"><b>${esc(TU(n === 1 ? 'ap7_n_1' : 'ap7_n', { n }))}</b></p>${(a.liste || []).slice(0, 8).map((x) => `<div class="rg6" data-appris-el="${esc(x.nom)}"><span><b>${esc(x.libelle)}</b><small>${esc(NOM_SITE[x.site] || x.site)}${x.at ? ' · ' + esc(dateCourte5(x.at)) : ''}</small></span>${x.confirme ? `<span class="v6">${etiquette5('ok', TU('ap7_confirme'), '')}</span>` : ''}</div>`).join('')}`}
      ${apprisEtat ? `<p class="note5" role="status" data-appris-etat="${apprisEtat.ok ? 'ok' : 'ko'}">${esc(apprisEtat.texte)}</p>` : ''}
      ${n ? (apprisConf ? `<div class="conf5" role="alertdialog" data-appris-conf><p>${esc(TU('ap7_oublier_q'))}</p><div class="outils"><button type="button" class="vu-btn" data-appris-non>${esc(TU('ra_annuler'))}</button><button type="button" class="vu-btn vu-plein" data-appris-oui>${esc(TU('ap7_oublier'))}</button></div></div>` : `<div class="outils"><button type="button" class="lien" data-appris-oublier>${esc(TU('ap7_oublier'))}</button></div>`) : ''}
    </section>`;
  }
  // ══ 5.428 (choix 57) : « VINTED A MASQUÉ » dans l'Accueil — les annonces masquées PAR VINTED (ni par lui ni par VRM), encore
  //    masquées, du compte de l'onglet : titre et taille, la raison si Vinted la donne (sinon « Vinted ne dit pas pourquoi »),
  //    le conseil, le lien vers l'annonce. Lecture VRM seule (la ligne `moderation_vinted_{uid}`), 60 s de mémoire.
  let modV, modAt = 0;
  function lireModeration() {
    if (modV !== undefined && Date.now() - modAt < 60000) return;
    modAt = Date.now(); if (modV === undefined) modV = null;
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'moderationCarte' }, (r) => { void chrome.runtime.lastError; modV = r && r.ok ? r : { ok: false }; if (ongletListe === 'accueil' || !ongletListe) rendre(); }); } catch (_) { modV = { ok: false }; }
  }
  function moderationHtml() {
    lireModeration();
    const rev = modV && modV.ok && Array.isArray(modV.revenues) ? modV.revenues : [];
    if (!modV || !modV.ok || !Array.isArray(modV.liste) || (!modV.liste.length && !rev.length)) return '';
    // 5.438 (choix 3) : les gestes — vérifier (ouvrir), modifier, contacter Vinted — et « à nouveau visible ».
    const revH = rev.map((m) => { const art = m.ti ? (m.ta ? TU('md_art_taille', { t: m.ti, ta: m.ta }) : m.ti) : TU('md_art_id', { id: m.a });
      return `<div class="rg6" data-moderation-revenue="${esc(m.a)}"><span><b>${esc(TU('md_visible', { a: art }))}</b><small>${esc(TU('md_visible_note'))}</small></span><span class="v6"><a class="vu-btn vu-sec" href="https://www.vinted.fr/items/${esc(m.a)}" target="_top">${esc(TU('md_ouvrir'))}</a></span></div>`; }).join('');
    return `<section class="sec6" data-accueil-moderation="${modV.liste.length}"><h3>${esc(TU('md_titre'))}</h3>${revH}${modV.liste.map((m) => {
      const art = m.ti ? (m.ta ? TU('md_art_taille', { t: m.ti, ta: m.ta }) : m.ti) : TU('md_art_id', { id: m.a });
      const raison = m.r ? TU('md_raison', { r: m.r }) : TU('md_sans_raison');
      const conseil = TU('md_c_' + (m.r ? (m.c || 'autre') : 'inconnu'));
      return `<div class="rg6" data-moderation-item="${esc(m.a)}" data-moderation-raison="${esc(m.r ? (m.c || 'autre') : 'inconnue')}"><span><b>${esc(TU('md_masquee', { a: art }))}</b><small>${esc(raison)}</small><small>${esc(TU('md_que_faire', { c: conseil }))}${m.r ? '' : ' ' + esc(TU('md_prudence'))}</small></span><span class="v6 md6-g"><a class="vu-btn vu-sec" href="https://www.vinted.fr/items/${esc(m.a)}" target="_top" data-moderation-ouvrir="${esc(m.a)}">${esc(TU('md_ouvrir'))}</a><a class="vu-lien" href="https://www.vinted.fr/items/${esc(m.a)}/edit" target="_top" data-moderation-modifier="${esc(m.a)}">${esc(TU('md_modifier'))}</a><a class="vu-lien" href="https://www.vinted.fr/help" target="_blank" rel="noopener" data-moderation-contacter="${esc(m.a)}">${esc(TU('md_contacter'))}</a></span></div>`;
    }).join('')}</section>`;
  }
  function accueilHtml(e) {
    const l = listes || {};
    const site = (e && e.site) || {};
    const v = e && e.vrm;
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    const ventesJour = l.ventes && Array.isArray(l.ventes.liste) ? l.ventes.liste.filter((x) => Number(x.date) >= auj.getTime() && x.etat !== 'annulee').length : null;
    const aExpedier = l.ventes && Array.isArray(l.ventes.liste) ? l.ventes.liste.filter((x) => x.etat === 'a_expedier').length : null;
    const nonLus = l.messages && Array.isArray(l.messages.liste) ? l.messages.liste.filter((x) => x.nonlu).length : (l.messages && l.messages.nonlusSite != null ? l.messages.nonlusSite : null);
    const enVente = l.annonces && l.annonces.statuts ? l.annonces.statuts.en_vente : (l.annonces ? l.annonces.total : null);
    const j = e && e.plateforme === 'vinted' ? site.jauge : null;
    const tuile = (k, n, page, ton) => `<button type="button" class="tu6" data-onglet-b="${page}" data-accueil="${k}"${ton ? ` data-ton="${ton}"` : ''}><span>${esc(TU(k))}</span><b>${n == null ? '—' : Number(n).toLocaleString('fr-FR')}</b></button>`;
    const capte = l.notifications && Array.isArray(l.notifications.liste) ? l.notifications.liste.filter((x) => !l.notifications.vu || Number(x.t) > Number(l.notifications.vu)).slice(0, 5) : null;
    const nomCompte = (l.compte && l.compte.nom) || site.nom || '—';
    return `<div class="acc6" data-accueil-page>${aussiIciHtml6()}${e && e.plateforme === 'vinted' ? progVerifHtml() + moderationHtml() : ''}
      ${fileAccueilHtml()}
      <section class="sec6"><h3>${esc(TU('v6_comptes'))}</h3>
        <div class="rg6"><span><b>${esc(nomCompte)}</b><small>${esc(NOM_SITE[e.plateforme] || '')} · ${esc(TU('v6_compte_onglet'))}</small></span><span class="v6">${etiquette5('lie', TU(v && v.connecte ? 'v6_lie' : 'v6_pas_lie'), v && v.connecte ? '' : 'ambre')}</span></div>
        <div class="rg6"><span><b>${esc((v && v.email) || '—')}</b><small>${esc(TU('v6_compte_vrm'))}</small></span><span class="v6">${esc(e && e.version ? 'VRM ' + e.version : '')}</span></div>
        ${e && e.plateforme === 'vinted' ? noteAccueilHtml() : ''}
      </section>
      <section class="sec6"><h3>${esc(TU('v6_aujourdhui'))}</h3><div class="tuiles6">
        ${tuile('v6_ventes_jour', ventesJour, 'ventes')}${tuile('v6_a_expedier', aExpedier, 'ventes', aExpedier ? 'ambre' : '')}${tuile('v6_non_lus', nonLus, 'messages')}${tuile('v6_en_vente', enVente, 'annonces')}
      </div>${j ? `<p class="note5" data-accueil-jauge>${esc(TU(j.complet ? 'c_heure' : 'c_heure_min', { n: nbFr(j.h), max: nbFr(j.maxH) }))} · ${esc(TU('c_jour', { n: nbFr(j.j), max: j.maxJ ? nbFr(j.maxJ) : '—' }))}</p>` : ''}</section>
      ${l.retraits && l.retraits.lu && (l.retraits.lignes || []).length ? `<section class="sec6" data-accueil-retraits><h3>${esc(TU('rp_tableau'))}</h3>${retraitsTableHtml(l.retraits, 8)}</section>` : ''}
      <section class="sec6"><h3>${esc(TU('v6_capte'))}</h3>${impEtat ? `<p class="note5 imp-etat6" role="status" data-imp-etat${impEtat.ton ? ` data-ton="${impEtat.ton}"` : ''}>${esc(impEtat.texte)}</p>` : ''}${capte === null ? `<p class="note5">—</p>` : capte.length ? capte.map((x) => { const vt = (x.s === 'ventes' || x.s === 'bordereaux') && l.ventes && Array.isArray(l.ventes.liste) ? l.ventes.liste.find((y) => y.tx === String(x.id || '').split(':')[0]) : null;
        // 5.410.2 : une vente captée dit son livreur, son n° de suivi, sa date limite et s'imprime d'ici.
        return vt ? `<div class="rg6 vte6" data-accueil-capte="${esc(x.s)}" data-accueil-vente="${esc(vt.tx)}"><span><b>${esc(TU('ns_' + x.s))} · ${esc(vt.titre || '')}</b><small>${esc(depuis(x.t) || '')}${vt.limite ? ' · ' + esc(TU('v_avant', { d: limiteCourte6(vt.limite) })) : ''}</small><span class="env6">${transpHtml6(vt, 16)}</span></span><span class="v6">${boutonImp6(vt)}</span></div>`
          : `<div class="rg6" data-accueil-capte="${esc(x.s)}"><span><b>${esc(TU('ns_' + x.s))}</b><small>${esc(depuis(x.t) || '')}</small></span></div>`; }).join('') : `<p class="note5">${esc(TU('v6_rien_capte'))}</p>`}</section>
    </div>`;
  }
  // 5.413 (`panneautelephone`) : la fin de la barre — au téléphone « Plus » + sa feuille du bas (les quatre autres pages) ;
  // à l'ordinateur la feuille se fond dans la barre latérale (display: contents) et « Plus » ne se montre pas.
  function barreTelephone6(cle, nav) {
    return `<button type="button" class="nav6 plusb6" data-vx-plus aria-expanded="${vxPlus ? 'true' : 'false'}" aria-current="${PLUS6.includes(cle) ? 'page' : 'false'}" title="${esc(TU('v6_plus'))}"><svg class="ico6" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/></svg><span>${esc(TU('v6_plus'))}</span></button>
        <div class="plus6g" data-vx-plus-feuille role="group" aria-label="${esc(TU('v6_plus_titre'))}"><b class="plus6t">${esc(TU('v6_plus_titre'))}</b>${nav('favoris')}${nav('notifications')}${nav('automatisations')}${nav('file')}${nav('sante')}
        <div class="bas6">${nav('parametres')}</div></div>
      </nav>${vxPlus ? '<div class="voile6" data-vx-plus-voile aria-hidden="true"></div>' : ''}`;
  }
  function vxHtml(e, corps, extras) {
    const cle = PAGES6[ongletListe] ? ongletListe : 'accueil';
    const nav = (k) => `<button type="button" class="nav6" data-onglet-b="${k}" aria-current="${ongletListe === k ? 'page' : 'false'}" title="${esc(TU(PAGES6[k]))}">${ico6(k)}<span>${esc(TU(PAGES6[k]))}</span></button>`;
    const nom = (listes && listes.compte && listes.compte.nom) || (e && e.site && e.site.nom) || '';
    const lu = luDeLaPage(e);
    return `<div class="vx6"${vxReduit ? ' data-reduit' : ''}${vxPlus ? ' data-plus' : ''} data-vx data-page="${cle}">
      <nav class="side6" aria-label="VRM">
        <div class="marque6"><img src="${esc(chrome.runtime.getURL('logo-vrm-96.png'))}" alt="" width="24" height="24"><b>VRM</b></div>
        <div class="grp6">${esc(TU('v6_general'))}</div>${nav('accueil')}
        <div class="grp6">${esc(NOM_SITE[e.plateforme] || TU('v6_plateforme'))}</div>${nav('annonces')}${nav('ventes')}${nav('messages')}${barreTelephone6(cle, nav)}
      <div class="main6">
        <header class="tete6"><button type="button" class="rond6" data-vx-reduire aria-label="${esc(TU('v6_reduire'))}" title="${esc(TU('v6_reduire'))}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/></svg></button>
          <h1 data-vx-titre>${esc(TU(PAGES6[cle]))}</h1>${nom ? `<span class="compte6" data-vx-compte><i aria-hidden="true">${esc(nom.charAt(0).toUpperCase())}</i>${esc(nom)}</span>` : ''}
          <span class="esp6"></span><button type="button" class="maj6" data-vx-maj data-lu="${lu || ''}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/></svg><span>${esc(lu ? TU('v6_mis_a_jour', { quand: depuis(lu) || '' }) : TU('v6_mettre_a_jour'))}</span></button>
          <button class="fermer rond6" data-fermer-carte title="${esc(TU('c_fermer'))}" aria-label="${esc(TU('c_fermer'))}">×</button></header>
        <div class="corps6" data-defil="corps6">${extras || ''}${corps}</div>
      </div>
    </div>`;
  }
  function listesHtml(e, parametres) {
    if (ongletListe === 'accueil' && (LISTES || !carte.hasAttribute('data-grand'))) ongletListe = 'messages';
    const vinted = !e || e.plateforme === 'vinted';
    const nomSite = (e && NOM_SITE[e.plateforme]) || 'ce site';
    let panneau;
    if (ongletListe === 'accueil' && !LISTES && carte.hasAttribute('data-grand')) panneau = accueilHtml(e);
    else if (ongletListe === 'sante' && carte.hasAttribute('data-grand')) panneau = santeHtml();
    else if (ongletListe === 'file' && carte.hasAttribute('data-grand')) panneau = fileHtml();
    else if (ongletListe === 'favoris') panneau = !vinted ? (e.plateforme === 'vestiaire' && !LISTES ? aimesVcHtml() : `<div class="val gris" data-favoris-site="${esc(e.plateforme)}">${e.plateforme === 'vestiaire' ? esc(TU('f_vc_aimes')) : `${esc(nomSite)} ne dit pas qui a mis tes annonces en favori : il n’y a personne à qui écrire d’ici.`}</div>`)
      : LISTES ? '<div class="val gris" data-favoris-fenetre>Les messages aux favoris partent de l’onglet Vinted : ouvre vinted.fr, puis touche le logo VRM.</div>'
      : (favorisOngletHtml(e) || '<div class="val gris">Pas encore de favoris lus : ouvre la cloche de Vinted une fois.</div>');
    else if (!vinted && carte.hasAttribute('data-grand') && ongletListe === 'automatisations' && listes && listes.automatisations && listes.automatisations.baisse) panneau = `<p class="note5" data-auto-site="${esc(e.plateforme)}">${esc(TU(e.plateforme === 'leboncoin' ? 'au_site_lbc' : 'au_site_vc'))}</p>` + automatisationsHtml();
    else if (!vinted && carte.hasAttribute('data-grand') && ongletListe === 'automatisations') panneau = `<div class="par5" data-auto-site="${esc(e.plateforme)}"><p class="note5">${esc(TU(e.plateforme === 'leboncoin' ? 'au_site_lbc' : 'au_site_vc'))}</p></div>`;
    else if (!vinted && carte.hasAttribute('data-grand') && ongletListe === 'annonces' && listes && listes.plateforme === e.plateforme) panneau = annoncesHtml(e) + (listes.annonces && listes.annonces.sansCompte ? `<div class="val gris" data-sans-compte="${Number(listes.annonces.sansCompte)}">${esc(TU('a_sans_compte', { n: listes.annonces.sansCompte }))}</div>` : '');
    else if (!vinted && carte.hasAttribute('data-grand') && ongletListe === 'ventes' && listes && listes.plateforme === e.plateforme) panneau = ventesHtml(e);
    else if (!vinted && carte.hasAttribute('data-grand') && ongletListe === 'notifications') panneau = notificationsHtml();
    else if (!vinted && ongletListe === 'messages') panneau = carte.hasAttribute('data-grand') && listes && listes.plateforme === e.plateforme && listes.messages ? messagesHtml() : (!listes && carte.hasAttribute('data-grand') ? `<div class="val gris" role="status" data-listes-charge>${esc(TU('m_charge'))}</div>` : `<div class="val gris" data-liste-site="${esc(e.plateforme)}">${esc(TU('m_site', { site: nomSite }))}</div>`);
    else if (!vinted) panneau = `<div class="val gris" data-liste-site="${esc(e.plateforme)}">Sur ${esc(nomSite)}, tes ${ongletListe === 'ventes' ? 'ventes' : 'annonces'} sont dans les pages du site (liens ci-dessous) : la carte ne les recopie pas encore.</div>`;
    else if (ongletListe === 'parametres') panneau = parametres || `<div class="val gris">${esc(TU('r_rien'))}</div>`;
    else if (ongletListe === 'sante') panneau = santeHtml();
    else if (ongletListe === 'automatisations') panneau = !vinted ? `<div class="val gris">${esc(TU('m_site', { site: nomSite }))}</div>` : automatisationsHtml();
    else if (ongletListe === 'notifications') panneau = notificationsHtml();
    else if (ongletListe === 'messages') panneau = !vinted && !(carte.hasAttribute('data-grand') && listes && listes.plateforme === e.plateforme && listes.messages) ? `<div class="val gris" data-liste-site="${esc(e.plateforme)}">${esc(TU('m_site', { site: nomSite }))}</div>` : messagesHtml();
    else panneau = ongletListe === 'annonces' ? annoncesHtml(e) : ventesHtml(e);
    const tab = (k, t) => `<button role="tab" data-onglet-b="${k}" aria-selected="${ongletListe === k ? 'true' : 'false'}"${ongletListe === k ? ' data-actif' : ''}>${t}</button>`;
    const nom = listes && listes.compte && listes.compte.nom ? listes.compte.nom : (e && e.site && e.site.nom) || '';
    return `<section class="listes listes5" data-listes data-onglet="${ongletListe}" data-portee="${porteeTous ? 'tous' : 'ce'}">
      ${vinted && LISTES ? `<div class="vu-seg seg-portee portee" role="group" aria-label="${esc(TU('c_tous'))}"><button data-portee-b="ce" aria-pressed="${porteeTous ? 'false' : 'true'}"${porteeTous ? '' : ' data-actif'}>${nom ? esc(nom) : esc(TU('c_ce_compte'))}</button><button data-portee-b="tous" aria-pressed="${porteeTous ? 'true' : 'false'}"${porteeTous ? ' data-actif' : ''}>${esc(TU('c_tous'))}</button></div>` : ''}
      <div class="vu-seg seg5" role="tablist" aria-label="${esc(TU('c_ce_compte'))}">${tab('messages', esc(TU('c_messages')))}${tab('annonces', esc(TU('c_annonces')))}${tab('favoris', esc(TU('c_favoris')))}${tab('ventes', esc(TU('c_ventes')))}${!LISTES && carte.hasAttribute('data-grand') ? tab('notifications', esc(TU('c_notifications'))) + tab('automatisations', esc(TU('c_automatisations'))) : ''}${LISTES ? '' : `<button role="tab" class="reg5" data-onglet-b="parametres" aria-label="${esc(TU('c_parametres'))}" title="${esc(TU('c_parametres'))}" aria-selected="${ongletListe === 'parametres' ? 'true' : 'false'}"${ongletListe === 'parametres' ? ' data-actif' : ''}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.6 4.9-1.7-.3a7 7 0 0 1-.6 1.5l1 1.4-1.4 1.4-1.4-1a7 7 0 0 1-1.5.6l-.3 1.7h-2l-.3-1.7a7 7 0 0 1-1.5-.6l-1.4 1-1.4-1.4 1-1.4a7 7 0 0 1-.6-1.5l-1.7-.3v-2l1.7-.3c.1-.5.3-1 .6-1.5l-1-1.4 1.4-1.4 1.4 1c.5-.3 1-.5 1.5-.6l.3-1.7h2l.3 1.7c.5.1 1 .3 1.5.6l1.4-1 1.4 1.4-1 1.4c.3.5.5 1 .6 1.5l1.7.3v2Z"/></svg><span class="lib5">${esc(TU('c_parametres'))}</span></button>`}</div>
      <div class="panneau" role="tabpanel" data-panneau="${ongletListe}">${panneau}</div>
      ${vinted && (ongletListe === 'annonces' || ongletListe === 'ventes') ? autresHtml() : ''}
    </section>`;
  }
  function brancherListes(racine, e) {
    brancherImpression(racine);
    try { brancherGestes6(racine); } catch (_) {}
    racine.querySelectorAll('[data-onglet-b]').forEach((b) => b.addEventListener('click', () => {
      ongletListe = b.getAttribute('data-onglet-b'); vxPlus = false; ranger({ vrmCarteOnglet: ongletListe });
      if (ongletListe !== 'favoris' || grand6()) chargerListes(false);
      if (LISTES) rendreListesSeules(); else rendre();
    }));
    const mc = racine.querySelector('[data-compte-menu]');
    if (mc) mc.addEventListener('click', () => { menuCompteOuvert = !menuCompteOuvert; rendre(); });
    racine.querySelectorAll('[data-portee-b]').forEach((b) => b.addEventListener('click', () => {
      menuCompteOuvert = false;
      porteeTous = b.getAttribute('data-portee-b') === 'tous'; ranger({ vrmCartePortee: porteeTous ? 'tous' : 'ce' });
      if (porteeTous && ongletListe === 'favoris') ongletListe = 'annonces';
      chargerListes(porteeTous);
      if (LISTES) rendreListesSeules(); else rendre();
    }));
    brancherAnnonces(racine);
    brancherRelances(racine);
    racine.querySelectorAll('[data-tc-g]').forEach((b) => b.addEventListener('click', () => { tcGroupe = b.getAttribute('data-tc-g'); rendre(); }));
    { const pb = racine.querySelector('[data-vx-plus]'); if (pb) pb.addEventListener('click', () => { vxPlus = !vxPlus; rendre(); }); }
    { const pv = racine.querySelector('[data-vx-plus-voile]'); if (pv) pv.addEventListener('click', () => { vxPlus = false; rendre(); }); }
    const rd = racine.querySelector('[data-vx-reduire]'); if (rd) rd.addEventListener('click', () => { vxReduit = !vxReduit; ranger({ vrmPanneauReduit: vxReduit }); rendre(); });
    const mj = racine.querySelector('[data-vx-maj]'); if (mj) mj.addEventListener('click', () => { chargerListes(true); });
    const nt = racine.querySelector('[data-notif-type]'); if (nt) nt.addEventListener('change', () => { notifType = nt.value; rendre(); });
    racine.querySelectorAll('[data-notif-statut]').forEach((b) => b.addEventListener('click', () => { notifStatut = b.getAttribute('data-notif-statut'); rendre(); }));
    racine.querySelectorAll('[data-auto-choix]').forEach((b) => b.addEventListener('click', () => { autoChoisie = b.getAttribute('data-auto-choix'); autoDetail = true; bmBrouillon = {}; bmConfirme = null; bmEtat = null; rendre(); }));
    const auR = racine.querySelector('[data-auto-retour]'); if (auR) auR.addEventListener('click', () => { autoDetail = false; rendre(); });
    // 5.410.3 : la méthode de republication (un toucher l'écrit), la séquence des favoris, le message « lot », le délai de l'offre.
    racine.querySelectorAll('[data-cb-desc]').forEach((b) => b.addEventListener('click', () => poserCommeBleam({ description: b.getAttribute('data-cb-desc') })));   // 5.437
    { const ev = racine.querySelector('[data-cb-eveil]'); if (ev) ev.addEventListener('change', () => poserCommeBleam({ eveil: !!ev.checked })); }   // 5.437
    racine.querySelectorAll('[data-cb-methode]').forEach((c) => c.addEventListener('change', () => { if (c.checked) poserCommeBleam({ methode: c.getAttribute('data-cb-methode') }); }));
    { const l = racine.querySelector('[data-cb-lot]'); if (l) l.addEventListener('input', () => { cbLot = l.value; cbMsg = null; }); }
    racine.querySelectorAll('[data-cb-offre]').forEach((c) => c.addEventListener('input', () => {
      const a = racine.querySelector('[data-cb-offre="offreMin"]'), b = racine.querySelector('[data-cb-offre="offreMax"]');
      if (a && b) cbOffre = { offreMin: Number(a.value), offreMax: Number(b.value) }; cbMsg = null;
      const lib = racine.querySelector('[data-cb-offre-lib]'); if (lib && a && b) lib.textContent = TU('cb_offre', { a: a.value, b: b.value });
    }));
    { const e = racine.querySelector('[data-cb-enregistrer]'); if (e) e.addEventListener('click', () => {
      const f = racine.querySelector('[data-cb-favoris]'), a = racine.querySelector('[data-cb-offre="offreMin"]'), b = racine.querySelector('[data-cb-offre="offreMax"]'), l = racine.querySelector('[data-cb-lot]');
      poserCommeBleam({ favoris: !!(f && f.checked), ...(l ? { messageLot: l.value } : {}), ...(a && b ? { offreMin: Number(a.value), offreMax: Number(b.value) } : {}) });
    }); }
    { const v = racine.querySelector('[data-voir-onglet]'); if (v) v.addEventListener('click', () => { try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'voirOngletTravail' }, () => { void chrome.runtime.lastError; }); } catch (_) {} }); }
    // 5.410 : la cadence (Paramètres). Un curseur change le brouillon ; « Enregistrer » écrit (plus vite ⇒ confirmation).
    racine.querySelectorAll('[data-cad]').forEach((c) => c.addEventListener('input', () => {
      const k = c.getAttribute('data-cad'); const v = Number(c.value);
      cadBrouillon = Object.assign({}, cadBrouillon || {}, { [k]: v });
      if (k === 'pauseMin' && (cadBrouillon.pauseMax || (listes.automatisations.cadence || {}).pauseMax) <= v) cadBrouillon.pauseMax = Math.min(240, v + 5);
      if (k === 'pauseMax' && (cadBrouillon.pauseMin || (listes.automatisations.cadence || {}).pauseMin) >= v) cadBrouillon.pauseMin = Math.max(20, v - 5);
      cadConfirme = false; cadEtat = null;
      const o = racine.querySelector(`[data-cad-v="${k}"]`); if (o) o.textContent = TU(k === 'parJour' ? 'cd_par_jour' : /pause/.test(k) ? 'cd_secondes' : 'cd_par_heure', { n: v });
      const e = racine.querySelector('[data-cad-enregistrer]'); if (e) e.disabled = false;
    }));
    racine.querySelectorAll('[data-cad]').forEach((c) => c.addEventListener('change', () => rendre()));
    const cadEnvoyer = (confirme) => {
      const c = Object.assign({}, (listes.automatisations && listes.automatisations.cadence) || {}, cadBrouillon || {});
      const valeur = { uid: listes.compte.id, favorisHeure: c.favorisHeure, actionsHeure: c.actionsHeure, pauseMin: c.pauseMin, pauseMax: c.pauseMax, ...(cadBrouillon && cadBrouillon.parJour != null ? { parJour: cadBrouillon.parJour } : c.parJour ? { parJour: c.parJour } : {}) };
      cadEnVol = true; rendre();
      try {
        chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'reglageAuto', cle: 'vinted_cadence', valeur, confirme: confirme === true }, (r) => {
          void chrome.runtime.lastError; cadEnVol = false;
          if (r && r.code === 'confirmation') { cadConfirme = true; cadEtat = null; }
          else { cadConfirme = false; cadEtat = { ok: !!(r && r.ok), texte: r && r.ok ? TU('ra_ok') : ((r && r.raison) || TU('ra_ko')) }; if (r && r.ok) { cadBrouillon = null; chargerListes(true); } }
          rendre();
        });
      } catch (_) { cadEnVol = false; cadEtat = { ok: false, texte: TU('ra_ko') }; rendre(); }
    };
    const cadE = racine.querySelector('[data-cad-enregistrer]'); if (cadE) cadE.addEventListener('click', () => cadEnvoyer(false));
    brancherSauvegarde(racine);
    // 5.432 : le seuil de la garde du prix (desserrer au-delà de 40 % ⇒ SA confirmation).
    { const gs = racine.querySelector('[data-gp-seuil]'); if (gs) { gs.addEventListener('input', () => { gpBrouillon = Number(gs.value); gpConfirme = false; gpEtat = null; const o = racine.querySelector('[data-gp-v]'); if (o) o.textContent = gs.value + ' %'; const e = racine.querySelector('[data-gp-enregistrer]'); if (e) e.disabled = false; }); gs.addEventListener('change', () => rendre()); } }
    const gpEnvoyer = (confirme) => {
      if (gpBrouillon == null) return;
      gpEnVol = true; rendre();
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'reglageAuto', cle: 'vrm_seuil_prix', valeur: { seuil: gpBrouillon }, confirme: confirme === true }, (r) => { void chrome.runtime.lastError; gpEnVol = false; if (r && r.code === 'confirmation') { gpConfirme = true; gpEtat = null; } else { gpConfirme = false; gpEtat = { ok: !!(r && r.ok), texte: r && r.ok ? TU('ra_ok') : ((r && r.raison) || TU('ra_ko')) }; if (r && r.ok) { gpBrouillon = null; chargerListes(true); } } rendre(); }); } catch (_) { gpEnVol = false; gpEtat = { ok: false, texte: TU('ra_ko') }; rendre(); }
    };
    { const e = racine.querySelector('[data-gp-enregistrer]'); if (e) e.addEventListener('click', () => gpEnvoyer(false)); }
    { const e = racine.querySelector('[data-gp-oui]'); if (e) e.addEventListener('click', () => gpEnvoyer(true)); }
    { const e = racine.querySelector('[data-gp-non]'); if (e) e.addEventListener('click', () => { gpConfirme = false; rendre(); }); }
    // 5.420 : le mode vacances (SA confirmation d'abord).
    { const vp = racine.querySelector('[data-vac-poser]'); if (vp) vp.addEventListener('click', () => { vacConfirme = vp.getAttribute('data-vac-poser') === 'on'; vacMsg = null; rendre(); }); }
    { const vo = racine.querySelector('[data-vac-oui]'); if (vo) vo.addEventListener('click', () => vacEnvoyer()); }
    { const vn = racine.querySelector('[data-vac-non]'); if (vn) vn.addEventListener('click', () => { vacConfirme = null; rendre(); }); }
    const cadO = racine.querySelector('[data-cad-oui]'); if (cadO) cadO.addEventListener('click', () => cadEnvoyer(true));
    const cadN = racine.querySelector('[data-cad-non]'); if (cadN) cadN.addEventListener('click', () => { cadConfirme = false; rendre(); });
    const cadD = racine.querySelector('[data-cad-defaut]'); if (cadD) cadD.addEventListener('click', () => { cadBrouillon = { favorisHeure: 15, actionsHeure: 50, pauseMin: 20, pauseMax: 60 }; cadConfirme = false; cadEtat = null; rendre(); });
    // 5.410 : régler une automatisation ici. Rien ne part sans SON toucher ; allumer passe par « Oui, allumer ».
    const raValeur = (auto, actif) => {
      const au = (listes && listes.automatisations) || {}, b0 = raBrouillon[auto] || {};
      if (auto === 'offres') return { cle: 'vinted_offres_auto', valeur: actif };
      if (auto === 'paliers') { const pa = au.paliers || {}; const pcts = String(b0.paliers != null ? b0.paliers : (pa.paliers || [50, 80, 100]).join(',')).split(/[,;\s]+/).map(Number).filter((x) => x > 0 && x <= 100); const rem = Number(b0.remise != null ? b0.remise : pa.remiseMax);
        // 5.410.4 : les champs « comme Bleam » (absents = comme avant) ; le fond les normalise.
        const vl = (k) => (b0[k] != null ? String(b0[k]).split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 5) : (Array.isArray(pa[k]) ? pa[k] : []));
        const fx = b0.flexible != null ? b0.flexible === 'oui' : Number(pa.flexible) > 0; const ec = Number(b0.ecart != null ? b0.ecart : pa.flexible || 2);
        const dmn = Number(b0.delaiMin != null ? b0.delaiMin : (pa.delais || {}).min), dmx = Number(b0.delaiMax != null ? b0.delaiMax : (pa.delais || {}).max);
        return { cle: 'vinted_offres_paliers', valeur: { actif, paliers: pcts, remiseMax: rem > 0 && rem < 90 ? Math.round(rem) : null, messages: Array.isArray(pa.textes) ? pa.textes : [], arrondi: pa.arrondi !== false,
          tranches: b0.tranches != null ? tranchesLues(b0.tranches) : (pa.tranches || []), bonusLot: Number(b0.bonusLot != null ? b0.bonusLot : pa.bonusLot) || 0, pas: Number(b0.pas != null ? b0.pas : pa.pas) === 0.5 ? 0.5 : 1,
          ...(fx ? { flexible: { actif: true, ecart: ec } } : {}), ...((b0.intel != null ? b0.intel === 'oui' : pa.intelligente === true) ? { intelligente: true } : {}), msgAccepte: vl('msgAccepte'), msgContre: vl('msgContre'), msgFinale: vl('msgFinale'), ...(dmn >= 1 && dmx > dmn ? { delais: { min: Math.round(dmn), max: Math.round(dmx) } } : {}) } }; }
      const ba = au.baisse || {}; return { cle: 'vinted_baisse_regle', valeur: { uid: au.cle || (listes && listes.compte && listes.compte.id), actif, pct: Number(b0.pct || ba.pct || 5), jours: Number(b0.jours || ba.jours || 14) } };
    };
    const raActif = (auto) => { const au = (listes && listes.automatisations) || {}; const x = auto === 'offres' ? au.offres : auto === 'paliers' ? au.paliers : au.baisse; return !!(x && x.actif === true); };
    const raEnvoyer = (auto, cle, valeur, confirme) => {
      if (raEnVol) return; raEnVol = true; raEtat = null; rendre();
      try {
        chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'reglageAuto', cle, valeur, confirme: confirme === true }, (r) => {
          void chrome.runtime.lastError; raEnVol = false; raConfirme = null;
          raEtat = { auto, ok: !!(r && r.ok), texte: r && r.ok ? TU('ra_ok') : ((r && r.raison) || TU('ra_ko')) };
          if (r && r.ok) { delete raBrouillon[auto]; chargerListes(true); }
          rendre();
        });
      } catch (_) { raEnVol = false; raEtat = { auto, ok: false, texte: TU('ra_ko') }; rendre(); }
    };
    racine.querySelectorAll('[data-ra-bascule]').forEach((b) => b.addEventListener('click', () => {
      const auto = b.getAttribute('data-ra-bascule'), allumer = !raActif(auto), v = raValeur(auto, allumer);
      if (allumer) { raConfirme = { auto, cle: v.cle, valeur: v.valeur }; raEtat = null; rendre(); } else raEnvoyer(auto, v.cle, v.valeur, false);
    }));
    const raOui = racine.querySelector('[data-ra-oui]'); if (raOui) raOui.addEventListener('click', () => { const c = raConfirme; if (c && c.cle !== 'favoris-auto') raEnvoyer(c.auto, c.cle, c.valeur, true); });
    const raNon = racine.querySelector('[data-ra-non]'); if (raNon) raNon.addEventListener('click', () => { raConfirme = null; rendre(); });
    racine.querySelectorAll('[data-ra-champ]').forEach((c) => c.addEventListener('input', () => { const k = c.getAttribute('data-ra-champ'); (raBrouillon[autoChoisie] = raBrouillon[autoChoisie] || {})[k] = c.value; }));
    racine.querySelectorAll('[data-ra-pct],[data-ra-jours]').forEach((b) => b.addEventListener('click', () => { const k = b.hasAttribute('data-ra-pct') ? 'pct' : 'jours'; (raBrouillon[autoChoisie] = raBrouillon[autoChoisie] || {})[k] = Number(b.getAttribute('data-ra-' + k)); rendre(); }));
    // 5.410 : messages aux favoris — textes, rythme, mode auto.
    const rfEnvoyer = (action, donnees) => {
      if (raEnVol) return; raEnVol = true; raEtat = null; rendre();
      try {
        chrome.runtime.sendMessage(Object.assign({ from: 'vrm-badge', action }, donnees), (r) => {
          void chrome.runtime.lastError; raEnVol = false;
          if (r && r.code === 'confirmation' && action === 'favorisAuto') { raConfirme = { auto: 'favoris', cle: 'favoris-auto', valeur: donnees }; }
          else { raConfirme = null; raEtat = { auto: 'favoris', ok: !!(r && r.ok), texte: r && r.ok ? TU('ra_ok') : ((r && r.raison) || TU('ra_ko')) }; if (r && r.ok) { delete raBrouillon.favoris; chargerListes(true); if (ongletListe === 'favoris' && action === 'reglagesFavoris') { apercuFavAt = 0; chargerFavoris(e, true); } } }
          rendre();
        });
      } catch (_) { raEnVol = false; raEtat = { auto: 'favoris', ok: false, texte: TU('ra_ko') }; rendre(); }
    };
    const rfBr = () => { const au = (listes && listes.automatisations && listes.automatisations.favoris) || {}; return (raBrouillon.favoris = raBrouillon.favoris || { textes: Array.isArray(au.textes) ? au.textes.slice() : [] }); };
    racine.querySelectorAll('[data-rf-texte]').forEach((c) => c.addEventListener('input', () => { const b = rfBr(); b.textes = Array.isArray(b.textes) ? b.textes : []; b.textes[Number(c.getAttribute('data-rf-texte'))] = c.value; }));
    racine.querySelectorAll('[data-rf-texte]').forEach((c) => c.addEventListener('change', () => rendre()));
    racine.querySelectorAll('[data-rf-rythme]').forEach((b) => b.addEventListener('click', () => { rfBr().rythme = b.getAttribute('data-rf-rythme'); rendre(); }));
    const rfEn = racine.querySelector('[data-rf-enregistrer]'); if (rfEn) rfEn.addEventListener('click', () => {
      const b = raBrouillon.favoris; if (!b) { raEtat = { auto: 'favoris', ok: true, texte: TU('ra_rien') }; rendre(); return; }
      const t = (Array.isArray(b.textes) ? b.textes : []).map((x) => String(x || '').trim()).filter(Boolean);
      rfEnvoyer('reglagesFavoris', { message: t[0] || '', variantes: t.slice(1, 5), ...(b.rythme ? { rythme: b.rythme } : {}) });
    });
    const rfA = racine.querySelector('[data-rf-auto]'); if (rfA) rfA.addEventListener('click', () => { const on = rfA.getAttribute('aria-pressed') === 'true'; rfEnvoyer('favorisAuto', { actif: !on }); });
    const raOuiF = racine.querySelector('[data-ra-confirme="favoris-auto"] [data-ra-oui]'); if (raOuiF) raOuiF.addEventListener('click', (ev) => { ev.stopImmediatePropagation(); const c = raConfirme; raConfirme = null; if (c) rfEnvoyer('favorisAuto', Object.assign({}, c.valeur, { confirme: true })); }, true);
    const raRe = racine.querySelector('[data-ra-reinit]'); if (raRe) raRe.addEventListener('click', () => { delete raBrouillon[autoChoisie]; raConfirme = null; raEtat = null; rendre(); });
    brancherBleam(racine);   // 5.410.4
    brancher5421(racine);   // 5.421 : réponses rapides, lots, relances, agent
    brancherFile6(racine);   // 5.433 : la file d'actions, la pause, ce que VRM a appris
    brancherRetirer(racine);   // 5.426
    brancher5430(racine);   // 5.430 : traduction sur l'appareil, note des acheteurs
    brancher5438(racine);   // 5.438 : compte précieux
    racine.querySelectorAll('[data-pp-flexible],[data-pp-pas],[data-pp-intel]').forEach((b) => b.addEventListener('click', () => { const k = b.hasAttribute('data-pp-flexible') ? 'flexible' : b.hasAttribute('data-pp-intel') ? 'intel' : 'pas'; (raBrouillon[autoChoisie] = raBrouillon[autoChoisie] || {})[k] = b.getAttribute('data-pp-' + k); rendre(); }));
    const raEn = racine.querySelector('[data-ra-enregistrer]'); if (raEn) raEn.addEventListener('click', () => {
      const auto = autoChoisie, b0 = raBrouillon[auto] || {};
      if (auto === 'offres') { if (b0.refus == null) { raEtat = { auto, ok: true, texte: TU('ra_rien') }; rendre(); return; } raEnvoyer(auto, 'vinted_offre_refus_msg', String(b0.refus), false); return; }
      const v = raValeur(auto, raActif(auto)); raEnvoyer(auto, v.cle, v.valeur, false);
    });
    const gd = racine.querySelector('[data-auto-guide]'); if (gd) gd.addEventListener('click', () => { ongletListe = 'favoris'; ranger({ vrmCarteOnglet: ongletListe }); rendre(); chargerFavoris(e, false); });
    racine.querySelectorAll('[data-rep-envoyer]').forEach((b) => b.addEventListener('click', () => envoyerReponse(b.getAttribute('data-rep-envoyer'))));
    racine.querySelectorAll('[data-rep-texte]').forEach((t) => t.addEventListener('input', () => { brouillons.set(t.getAttribute('data-rep-texte'), t.value); const b = carte.querySelector(`[data-rep-envoyer="${t.getAttribute('data-rep-texte')}"]`); if (b) b.disabled = !t.value.trim() || repEnVol; }));
    racine.querySelectorAll('[data-conv-b]').forEach((b) => b.addEventListener('click', () => { const k = b.getAttribute('data-conv-b'); convChoisie = convChoisie === k ? '' : k; rendre(); }));
    const nlB = racine.querySelector('[data-msg-nonlus]'); if (nlB) nlB.addEventListener('click', () => { msgNonLus = !msgNonLus; rendre(); });
    const ch = racine.querySelector('[data-msg-cherche]'); if (ch) ch.addEventListener('input', () => { msgCherche = ch.value; const pos = ch.selectionStart; rendre(); const n = carte.querySelector('[data-msg-cherche]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } });
    // 5.409 : toucher une rangée déplie SA fiche (une à la fois) ; la retoucher la replie.
    racine.querySelectorAll('[data-fiche-b]').forEach((b) => b.addEventListener('click', () => {
      const k = b.getAttribute('data-fiche-b'); ficheOuverte = ficheOuverte === k ? '' : k;
      if (LISTES) rendreListesSeules(); else rendre();
    }));
    if (!['favoris', 'parametres'].includes(ongletListe) || porteeTous || (ongletListe === 'favoris' && grand6())) chargerListes(false);
    // 5.379 : l'onglet Favoris montre la liste lue (aperçu demandé à VRM, gardé une minute).
    if (ongletListe === 'favoris' && !LISTES && e) chargerFavoris(e, false);
  }
  // La fenêtre de l'extension (popup.html?mode=onglet) : le bloc seul, sous l'état.
  function rendreListesSeules() {
    if (!LISTES) return;
    poserHtml(contenu, `<div class="tete"><b>${listes && listes.compte && listes.compte.nom ? esc(listes.compte.nom) : 'Ton compte Vinted'}</b><span class="ver">compte connecté dans ce navigateur</span></div>${listes && listes.connecte === false ? '<div class="val gris">Connecte d’abord l’extension à VRM.</div>' : listes && listes.compte === null ? '<div class="val gris">Aucun compte Vinted connecté dans ce navigateur.</div>' : listesHtml({ plateforme: 'vinted', site: listes && listes.compte })}`);
    brancherListes(contenu, null);
  }
  // ══ 5.371 (Julien, 12 nov.) : LA CARTE EN 4 LIGNES AU PLUS ══════════════════
  // Compte (pseudo) · Lu (« il y a 3 min ») · Jauge (« 23/50 cette heure · 112/200
  // aujourd'hui », Vinted) · État (normal / prudence jusqu'à … / pause / Tout arrêté).
  // Tout vient de l'état du service worker ; pas su ⇒ « — » ; jauge pas complète
  // (ligne partagée pas lue) ⇒ « au moins ». `data-resume` reste porté par le bloc.
  const nbFr = (n) => Number(n || 0).toLocaleString('fr-FR');
  function etatQuatre(e, r) {
    const site = e.site || {}, maint = Date.now();
    if (r.etat === 'geste') return { k: 'geste', t: r.texte };
    if (e.toutArrete) return { k: 'arrete', t: 'Tout arrêté' };
    if (site.arret) return { k: 'geste', t: site.arret.quoi === 'moderation' ? 'Arrêté : message de Vinted à lire' : site.arret.quoi === 'deconnecte' ? 'Arrêté : Vinted t’a déconnecté' : 'Arrêté : Vinted demande une vérification' };
    if (r.etat === 'pause') return { k: 'pause', t: r.texte };
    const pr = site.jauge && Number(site.jauge.prudence);
    if (pr > maint) return { k: 'prudence', t: 'Prudence jusqu’à ' + heureFin(pr) };
    const n = Number(e.enAttenteReseau) || 0;
    if (n > 0) return { k: 'reseau', t: n > 1 ? `${n} gestes en attente de réseau` : '1 geste en attente de réseau' };
    if (r.etat === 'attente') return { k: 'attente', t: r.texte };
    return { k: 'normal', t: 'Normal', coche: true };
  }
  // 5.376 : ce qui est capté et ce qui manque pour CE compte et CE site — une phrase, un geste.
  function ligneCapture(e) {
    const c = e && e.capture;
    if (!c || !c.phrase) return '';
    const lien = c.lien && /^https:\/\/www\.vinted\.fr\//.test(String(c.lien)) ? String(c.lien) : '';
    const geste = c.geste ? (lien ? ` · <a href="${esc(lien)}" target="_blank" rel="noopener" data-capture-geste>${esc(c.geste)}</a>` : ` · <span data-capture-geste>${esc(c.geste)}</span>`) : '';
    return `<div class="q4" data-capture="${esc(c.k || '')}" data-capture-n="${Number(c.n) || 0}" role="status"><span class="k">Capté</span><span class="v${c.k === 'ok' ? '' : ''}">${esc(c.phrase)}${c.k === 'ok' ? '<span class="coche" aria-label="vérifié">✓</span>' : ''}${geste}</span></div>`;
  }
  // 5.406 (Julien, 17 nov.) : la tête en UNE ligne (compte · point · état) et UNE ligne
  // secondaire (jauge de l'heure et du jour · lu · capté) — la même source qu'avant (le fond),
  // les mêmes marques `data-q4*` (bancs), « pas su » ⇒ « — ». Le nom de la fonction reste
  // `quatreLignes` (capacité `carte4`).
  function quatreLignes(e, r) {
    const site = e.site || {}, f = e.flux || {};
    let compte = site.nom || (site.id && e.plateforme !== 'leboncoin' ? 'n° ' + site.id : '');
    let lu = 0;
    if (e.plateforme === 'vestiaire' && e.vcCapte) { for (const k of Object.keys(e.vcCapte)) lu = Math.max(lu, Number(e.vcCapte[k] && e.vcCapte[k].at) || 0); }
    else lu = Number(f.okAt) || 0;
    const j = e.plateforme === 'vinted' ? site.jauge : null;
    const et = etatQuatre(e, r);
    const pointK = et.k === 'normal' ? 'ok' : et.k;
    // 5.406 (revue) : le choix « ce compte / tous les comptes » vit dans la TÊTE (« compte_banc ⌄ »),
    // plus un second contrôle segmenté. Seulement sur Vinted, connecté, compte de l'onglet nommé.
    const menuCompte = e.plateforme === 'vinted' && !!compte && !!site.id && site.choix !== 'non' && !!(e.vrm && e.vrm.connecte);
    const etTexte = et.k === 'normal' ? TU('c_normal') : et.t;
    const tete = `<div class="t5 q4 resume" data-resume="${esc(r.etat)}" data-q4-bloc role="status">`
      + `<span class="vu-point" data-k="${esc(pointK)}" aria-hidden="true"></span>`
      + (menuCompte
        ? `<button class="nom nom-b" data-q4="compte" data-compte-menu aria-haspopup="true" aria-expanded="${menuCompteOuvert ? 'true' : 'false'}">${esc(porteeTous ? TU('c_tous') : compte)}<i aria-hidden="true"></i></button>`
        : `<b class="nom" data-q4="compte">${compte ? esc(compte) : esc(e.plateforme === 'vinted' ? TU('c_aucun_compte') : '—')}</b>`)
      + `<span class="et" data-q4="etat" data-q4-etat="${esc(et.k)}">${esc(etTexte)}</span></div>`
      + (menuCompte ? `<div class="menu5" data-menu-compte role="group" aria-label="${esc(TU('c_tous'))}"${menuCompteOuvert ? '' : ' hidden'}>`
        + `<button data-portee-b="ce" aria-pressed="${porteeTous ? 'false' : 'true'}"${porteeTous ? '' : ' data-actif'}><span>${esc(compte)}</span><small>${esc(TU('c_ce_compte'))}</small></button>`
        + `<button data-portee-b="tous" aria-pressed="${porteeTous ? 'true' : 'false'}"${porteeTous ? ' data-actif' : ''}><span>${esc(TU('c_tous'))}</span></button></div>` : '');
    const morceaux = [];
    if (j) morceaux.push(`<span data-q4="jauge" data-q4-h="${Number(j.h) || 0}" data-q4-maxh="${Number(j.maxH) || 0}" data-q4-j="${Number(j.j) || 0}" data-q4-maxj="${Number(j.maxJ) || ''}" data-q4-complet="${j.complet ? '1' : '0'}"><b>${esc(TU(j.complet ? 'c_heure' : 'c_heure_min', { n: nbFr(j.h), max: nbFr(j.maxH) }))}</b> · ${esc(TU('c_jour', { n: nbFr(j.j), max: j.maxJ ? nbFr(j.maxJ) : '—' }))}</span>`);
    if (lu || morceaux.length) morceaux.push(`<span data-q4="lu" data-q4-at="${lu || ''}">${lu ? esc(TU('c_lu', { quand: depuis(lu) })) : '—'}</span>`);
    const c = e && e.capture;
    if (c && c.phrase) {
      const lien = c.lien && /^https:\/\/www\.vinted\.fr\//.test(String(c.lien)) ? String(c.lien) : '';
      const geste = c.geste ? (lien ? ` · <a href="${esc(lien)}" target="_blank" rel="noopener" data-capture-geste>${esc(c.geste)}</a>` : ` · <span data-capture-geste>${esc(c.geste)}</span>`) : '';
      morceaux.push(`<span data-capture="${esc(c.k || '')}" data-capture-n="${Number(c.n) || 0}">${esc(c.phrase)}${c.k === 'ok' ? ' ✓' : ''}${geste}</span>`);
    }
    return tete + (morceaux.length ? `<div class="vu-sous" data-sous>${morceaux.join('<span class="sep" aria-hidden="true"> · </span>')}</div>` : '');
  }
  // « Nouvelle version disponible » : seulement installée À LA MAIN (zip, fichier
  // Orion) et plus ancienne que celle servie. Boutique ⇒ rien (elle se met à jour).
  const LIENS_PAQUET = ['https://vrm.center/VRM-extension.zip', 'https://vrm.center/VRM-Orion.xpi'];
  // 5.406 : un bandeau FIN (« Version 5.406 disponible · Mettre à jour ») ; les étapes ne
  // s'ouvrent qu'au toucher (« Comment ? »). Plus le bloc qui prenait la moitié de la carte.
  function majHtml(m) {
    if (!m || m.nouvelle !== true || m.origine === 'boutique' || !LIENS_PAQUET.includes(String(m.lien || ''))) return '';
    const orion = m.moteur === 'firefox';
    const etapes = orion ? ['c_maj_orion1', 'c_maj_orion2', 'c_maj_orion3'] : ['c_maj_chrome1', 'c_maj_chrome2', 'c_maj_chrome3'];
    return `<div class="maj5" data-maj="${esc(m.servie)}"><div class="vu-bandeau"><span>${esc(TU('c_maj', { v: m.servie }))}</span>`
      + `<a class="vu-btn" data-maj-telecharger href="${esc(m.lien)}" target="_blank" rel="noopener" download>${esc(TU('c_maj_b'))}</a></div>`
      + `<details data-maj-comment><summary>${esc(TU('c_maj_comment'))}</summary><ol data-maj-etapes="${etapes.length}">${etapes.map((x) => `<li>${esc(TU(x))}</li>`).join('')}</ol></details></div>`;
  }
  // « Réparer » : seulement quand l'extension a MESURÉ un état cassé (session perdue,
  // commande bloquée, canal de la page absent) — ou ne répond plus du tout.
  let repTexte = '', repEtat = '';
  const repHtml = () => (repTexte ? `<div class="rep" data-rep="${esc(repEtat)}" role="status">${esc(repTexte)}</div>` : '');
  const NOMS_REP = { session: 'session VRM', file: 'commande bloquée', canal: 'page Vinted' };
  function brancherReparer() {
    const b = carte.querySelector('[data-reparer]');
    if (!b) return;
    b.addEventListener('click', () => {
      b.disabled = true; b.textContent = 'Réparation…';
      if (!etat) { reparationPosee = false; reparer(true); repEtat = 'attente'; repTexte = 'L’extension redémarre si elle ne répond toujours pas.'; setTimeout(() => { rafraichir(); }, 7000); rendre(); return; }
      try {
        chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'reparer' }, (r) => {
          void chrome.runtime.lastError;
          if (r && r.ok) {
            const reste = Array.isArray(r.reste) ? r.reste : [];
            repEtat = reste.length ? 'reste' : 'ok';
            repTexte = reste.length ? 'Pas réparé : ' + reste.map((x) => NOMS_REP[x] || x).join(', ') + '. Envoie un rapport.' : 'Réparé ✓';
          } else { repEtat = 'refus'; repTexte = (r && r.raison) || 'L’extension n’a pas répondu. Réessaie.'; }
          rafraichir();
        });
      } catch (_) { repEtat = 'refus'; repTexte = 'L’extension n’a pas répondu. Réessaie.'; rendre(); }
    });
  }
  let rapTexte = '';
  function brancherRapport() {
    const b = carte.querySelector('[data-rapport]');
    if (!b) return;
    b.addEventListener('click', () => {
      b.disabled = true; b.textContent = 'Envoi…';
      try {
        chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'rapport' }, (r) => {
          void chrome.runtime.lastError;
          rapTexte = r && r.ok ? 'Rapport envoyé ✓ (sans tes données)' : ((r && r.raison) || 'Rapport pas envoyé. Réessaie.');
          rendre();
        });
      } catch (_) { rapTexte = 'Rapport pas envoyé. Réessaie.'; rendre(); }
    });
  }

  function rendre() {
    if (LISTES) { rendreListesSeules(); return; }
    rendreCarte();
    if (CADRE) { if (!cadreDitPrete) { cadreDitPrete = true; direAuSite({ __vrmCarte: 'hauteur', h: Math.ceil(hote.getBoundingClientRect().height) + 6 }); direAuSite({ __vrmCarte: 'prete' }); } return; }
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
      poserHtml(contenu, `${doigt ? '<button class="fermer" data-fermer-carte title="Fermer" aria-label="Fermer">×</button>' : ''}<div class="tete"><b>VRM</b></div>
        ${resumeHtml(resumeEtat(null))}
        ${lignePerime || `<div class="ligne"><div class="val gris">${pasSu ? SI_MUETTE : 'Vérification…'}</div></div>`}
        ${pasSu && !perime ? '<button class="b sec" data-reparer>Réparer</button>' : ''}${repHtml()}`);
      brancherReparer();
      const fermerV = carte.querySelector('[data-fermer-carte]');
      if (fermerV) fermerV.addEventListener('click', fermerCarte);
      poserFormulaire(formulaireDemande);
      return;
    }
    const v = e.vrm;
    let compteVrm;
    if (!v) compteVrm = '<div class="val gris">pas su pour l\'instant</div>';
    else if (v.connecte) compteVrm = `<div class="val">${esc(v.email || 'connecté')}</div>`;
    else if (v.expiree) compteVrm = `<div class="val alerte">Session expirée${v.email ? ' (' + esc(v.email) + ')' : ''} — reconnecte-toi ci-dessous</div>`;
    else compteVrm = '<div class="val alerte">Pas connecté — connecte-toi ci-dessous</div>';
    // 5.330 : l'adresse dite UNE fois (« Connecté à VRM : x@y »), puis « C'est fait ».
    if (v && v.connecte && justeConnecte) compteVrm = `<div class="val">Connecté à VRM${v.email ? ' : ' + esc(v.email) : ''}</div><div class="val gris" data-juste-connecte>C’est fait : l’extension est connectée.</div>`;

    const nomSite = NOM_SITE[e.plateforme] || 'ce site';
    let compteSite;
    if (!e.capte && !e.mesure) compteSite = `<div class="val gris">VRM ne capte pas encore ${esc(nomSite)}.</div>`;
    else if (!e.capte) compteSite = '<div class="val gris">pas encore reconnu</div>';
    else if (e.site && e.site.nom && e.site.choix === 'non') compteSite = `<div class="val gris" data-compte-ignore>${esc(e.site.nom)} — ignoré dans ce navigateur (ton choix) : rien n'est capté pour lui.</div><button class="b sec" data-capter>Capter ce compte</button>`;
    else if (e.site && e.site.nom) compteSite = `<div class="val">${esc(e.site.nom)}${e.site.type === 'pro' ? ' · pro' : ''}</div>`;
    else if (e.site && e.site.id && e.plateforme !== 'leboncoin') compteSite = `<div class="val">compte n° ${esc(e.site.id)}</div>`;
    else if (e.plateforme === 'vestiaire') compteSite = (e.vcCapte && Object.keys(e.vcCapte).length)
      ? '<div class="val">connecté — VRM lit ton compte en passant</div>'
      : '<div class="val gris">pas encore lu — ouvre « Mon compte » sur Vestiaire (ventes, articles, messages)</div>';
    else if (e.plateforme === 'vinted') compteSite = '<div class="val gris">aucun compte Vinted connecté dans ce navigateur</div>';
    else compteSite = '<div class="val gris">pas encore reconnu</div>';

    // 5.344 : l'historique de départ (ventes puis achats) — lu / total, ou pages lues.
    const nb = (x) => Number(x || 0).toLocaleString('fr-FR');
    const heure = (ms) => { try { return new Date(Number(ms)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
    // 5.455.8 : la ligne « Import de ton passé / Tout récupérer » et son bouton sont RETIRÉS du panneau (plus de code mort) ;
    //    l'import lit tout l'historique, seul (background.js, `departImport`).
    const historique = '';

    // 5.335 (9 nov.) — Julien : « le "à confirmer" je ne comprends pas, ça doit
    // être beaucoup plus clair ». Sur Leboncoin : Compte · Annonces · Ventes, ce
    // que le fond a résumé (`resumeCarteLbc`), et UN geste.
    const lbcVal = (x) => {
      if (!x) return '<div class="val gris">pas su pour l’instant</div>';
      const t = esc(String(x.texte || '')).replace('{quand}', esc(depuis(x.at) || ''));
      return `<div class="val${x.ok === true ? '' : x.ok === false ? ' alerte' : ' gris'}" data-lbc-etat="${x.ok === true ? 'ok' : x.ok === false ? 'geste' : 'attente'}">${t}${x.ok === true ? '<span class="coche" aria-label="vérifié">✓</span>' : ''}</div>`;
    };
    if (e.plateforme === 'leboncoin' && e.lbc && e.capte) compteSite = lbcVal(e.lbc.compte);
    let flux = '';
    const ignore = !!(e.site && e.site.choix === 'non' && e.plateforme === 'vinted');
    if (e.capte && ignore) flux = '<div class="val gris">Rien n’est capté pour ce compte — ton choix.</div>';
    else if (e.capte) {
      const f = e.flux || {};
      // 5.328 (Julien : « il ne doit pas y avoir d'envoi si l'extension n'est
      // pas connectée ») : pas connecté ⇒ rien ne part, et la carte le dit
      // calmement — jamais « refusé » pour un envoi qui n'a pas eu lieu.
      if (v && v.connecte === false) {
        flux = '<div class="val gris" data-flux-attente>En attente : connecte l’extension pour envoyer tes données.</div>';
      } else if (f.koAt && (!f.okAt || f.koAt > f.okAt) && (f.koStatut === 'sans_session' || refusAvantConnexion(f, v))) {
        flux = `<div class="val gris" data-refus-avant>Connecté : les prochains envois partent avec ta session.</div>${historiqueRefus(f)}`;
      } else if (f.koAt && (!f.okAt || f.koAt > f.okAt)) {
        flux = `<div class="val alerte" data-refus-cause="${esc(String(f.koStatut == null ? 'inconnu' : f.koStatut))}">Dernier envoi refusé ${esc(depuis(f.koAt))}${esc(raisonRefus(f, v))}</div>${historiqueRefus(f)}`;
      } else if (f.okAt) flux = e.plateforme === 'leboncoin' ? `<div class="val">Dernier échange enregistré ${esc(depuis(f.okAt))}</div><div class="val gris">Cet échange ne confirme pas la récupération des annonces et des photos.</div>` : `<div class="val" data-flux-ok>Tes données sont à jour · ${esc(depuis(f.okAt))}</div>`;
      else flux = '<div class="val gris">Rien envoyé depuis ce navigateur pour l\'instant</div>';
      flux += ligneSecours(f);
    }
    // 5.341 : les dates de versement encore à lire sur CE compte (pas su ⇒ rien).
    // 5.351 : une carte de PROGRESSION, visible sous le message principal (jamais
    // repliée : c'est ce qui avance pendant qu'il laisse Vinted ouvert).
    const dt = e.capte && !ignore && e.plateforme === 'vinted' && e.site && e.site.dates;
    // 5.378 : l'estimation en HEURES de Vinted ouvert sur ce compte (plus des jours de 24 h) ;
    // ⚠️ 5.390 (15 nov., Julien : « pas que ça soit à nous de le faire ») : plus AUCUN geste
    //    demandé ici — la ligne « ouvre une fois Porte-monnaie → Historique » est retirée ;
    //    la recette du relevé s'apprend quand même s'il ouvre cette page de lui-même.
    const progression = (dt && Number(dt.reste) > 0
      ? `<div class="progres val gris" data-dates-versement="${Number(dt.reste)}" data-dates-heures="${Number(dt.heures) || 0}">Dates de versement : l'extension les récupère · ${Number(dt.reste).toLocaleString('fr-FR')} restantes · environ ${Number(dt.heures) || 1} h avec Vinted ouvert sur ce compte</div>` : '');

    // 5.243 : sur Vestiaire, ce qui est capté, famille par famille.
    if (e.plateforme === 'vestiaire' && e.vcCapte) {
      // 5.299 : « lues » ne suffit pas — le NOMBRE trouvé, ou « format pas encore lu ».
      const noms = { annonces: ['Annonces', 'annonce', 'annonces'], ventes: ['Ventes', 'vente', 'ventes'], achats: ['Achats', 'achat', 'achats'], messages: ['Conversations', 'conversation', 'conversations'], nonlus: ['Messages non lus', 'non lu', 'non lus'] };
      const lignes = Object.keys(noms).filter((k) => e.vcCapte[k]).map((k) => {
        const c = e.vcCapte[k], [titre, un, plusieurs] = noms[k], n = Number(c.n) || 0;
        if (c.inconnu) return `<div class="val alerte" data-vc-capte="${k}" data-vc-capte-n="inconnu">${titre} : Vestiaire a répondu dans une forme pas encore lue (${esc(depuis(c.at))}) — rien n'est deviné</div>`;
        if (k === 'nonlus') return `<div class="val" data-vc-capte="${k}" data-vc-capte-n="${n}">${titre} : ${n} (relevé ${esc(depuis(c.at))})</div>`;
        return n > 0 ? `<div class="val" data-vc-capte="${k}" data-vc-capte-n="${n}">${titre} : ${n} ${n > 1 ? plusieurs : un} lue${n > 1 ? 's' : ''} ${esc(depuis(c.at))}</div>`
          : `<div class="val gris" data-vc-capte="${k}" data-vc-capte-n="0">${titre} : aucune dans ce que Vestiaire a rendu (${esc(depuis(c.at))}) — ouvre la page de tes ${plusieurs} sur Vestiaire</div>`;
      });
      if (lignes.length) flux = lignes.join('') + flux.replace(/<div class="val gris">Rien envoyé[^<]*<\/div>/, '');
    }
    // 5.335 : plus de « nouvelle intégration non confirmée » ni de diagnostic
    // technique : les lignes Annonces et Ventes, puis le geste (un seul).
    const lbcLignes = e.plateforme === 'leboncoin' && e.lbc && e.capte && !(v && v.connecte === false)
      ? `<div class="ligne"><div class="lib">Annonces</div>${lbcVal(e.lbc.annonces)}</div><div class="ligne"><div class="lib">Ventes</div>${lbcVal(e.lbc.ventes)}</div>` : '';
    const RECHARGER = /^Recharge/.test(String((e.lbc && e.lbc.geste) || ''));
    const diagnosticLbc = e.plateforme === 'leboncoin' && e.lbc && e.lbc.geste && !(v && v.connecte === false)
      ? `<div class="geste" data-lbc-geste>${esc(e.lbc.geste)}${RECHARGER ? '<button class="b sec" data-lbc-recharger>Recharger la page</button>' : ''}</div>` : '';
    // (29 oct.) Les paires vendues sur Vinted, encore en ligne sur Leboncoin — ce
    // que VRM a calculé (une règle, dans l'app) ; la carte ne recalcule rien.
    let aRetirerLbc = '';
    if (e.plateforme === 'leboncoin' && e.aRetirer && Array.isArray(e.aRetirer.liste) && e.aRetirer.liste.length) {
      const ici = String(location.pathname || '');
      const lignes = e.aRetirer.liste.slice(0, 6).map((r) => {
        const cette = r.lbcId && ici.includes(String(r.lbcId));
        const nom = (r.numero ? 'N°' + r.numero + ' · ' : '') + (r.titre || (globalThis.VRM_MOTS ? globalThis.VRM_MOTS.mots() : {}).un || 'une paire');
        return `<div class="val alerte" data-a-retirer="${esc(r.lbcId || r.numero || '')}">${cette ? '<b>C’est cette annonce</b> — ' : ''}${esc(nom)} — vendue sur Vinted, encore en ligne ici${r.lu ? ' (vu ' + esc(depuis(r.lu)) + ')' : ''}${r.url && !cette ? ` · <a href="${esc(r.url)}" target="_top">voir l’annonce</a>` : ''}</div>`;
      }).join('');
      const plus = e.aRetirer.liste.length > 6 ? `<div class="val gris">et ${e.aRetirer.liste.length - 6} autre(s) — la liste complète est dans VRM → Leboncoin → Annonces</div>` : '';
      const n = e.aRetirer.liste.length;
      aRetirerLbc = `<div class="ligne"><div class="lib">À retirer de Leboncoin</div>${lignes}${plus}<div class="val gris">Supprime-la${n > 1 ? 's' : ''} dans « Mes annonces », ou depuis VRM → Leboncoin → Annonces.</div></div>`;
    }
    // 5.379 (15 nov., Orion iPhone : leboncoin.fr restait NOIRE) — le disjoncteur de
    // lbc-relay.js a mis VRM de côté sur CET onglet (`vrm_lbc_de_cote`, sessionStorage de
    // l'onglet, 30 min) : la carte le DIT, et ce qu'il a mesuré ensuite (sans VRM, la page
    // s'est affichée ⇒ VRM était en cause ; elle reste vide ⇒ ce n'est pas VRM), avec UN
    // geste : « Rebrancher VRM ici » (efface la marque, recharge la page).
    const deCote = e.plateforme === 'leboncoin' ? deCoteLbc() : null;
    const ligneDeCote = deCote
      ? `<div class="ligne" data-lbc-de-cote="${esc(deCote.apres || 'mesure')}"><div class="lib">Leboncoin</div><div class="val alerte">VRM s’est mis de côté sur cette page : elle ne s’affichait pas.</div><div class="val gris">${deCote.apres === 'affichee' ? 'Sans VRM, elle s’affiche : VRM ne lit rien dans cet onglet pendant 30 min (un nouvel onglet repart avec VRM). Tes annonces seront relues à la prochaine visite.' : deCote.apres === 'vide' ? 'Même sans VRM, elle reste vide : ce n’est pas VRM. Recharge la page ; si elle reste vide, essaie un autre navigateur.' : 'VRM vérifie qu’elle s’affiche sans lui…'}</div><button class="b sec" data-lbc-rebrancher>Rebrancher VRM ici</button></div>`
      : '';
    // 5.366 (Julien : « faire comme Vintex, pour ne pas se faire bannir ») : l'état du compte
    // en UNE phrase (calculée par le fond, la même que dans VRM) et « Tout arrêter ».
    // 5.406 : pendant un envoi, « Tout arrêter » est LE plein de la ligne principale : la ligne de
    // sécurité garde sa phrase, sans second bouton du même nom.
    const enCoursFav = !!(e.site && e.site.favoris && e.site.favoris.file && e.site.favoris.file.actif);
    const ligneSecu = e.secu && e.secu.texte && v && v.connecte
      ? `<div class="ligne secu" data-secu="${esc(e.secu.niveau || '')}"><div class="secu-t"><div class="lib">Sécurité du compte</div><div class="val${e.secu.niveau === 'robot' ? ' alerte' : (e.secu.niveau === 'ok' ? '' : ' gris')}">${esc(e.secu.texte)}</div></div>${enCoursFav && !e.secu.arrete ? '' : `<button class="touche secu-b" data-secu-arret="${e.secu.arrete ? 'relancer' : 'arreter'}">${e.secu.arrete ? esc(TU('c_reprendre')) : esc(TU('c_tout_arreter'))}</button>`}</div>`
      : '';
    let bascule = '';
    if (e.bascule) {
      const b = e.bascule;
      const quand = (() => { try { return new Date(b.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } })();
      bascule = `<div class="ligne"><div class="lib">Attention</div><div class="val alerte">Le ${esc(quand)}, ce Chrome est passé du compte VRM ${esc(b.de || '?')} à ${esc(b.vers || '?')}. Les captures suivent le compte connecté : si ce n'est pas le tien, reconnecte-toi avec le bon.</div></div>`;
    }

    // 5.328 : pas connecté ⇒ le formulaire est juste en dessous, rien à dire de plus.
    const formulaire = CADRE ? (!(v && v.connecte) || changerCompte) : (!!(v && v.connecte === false) || (!v && formulaireDemande) || changerCompte);
    // Julien, 27 oct. : « je veux pouvoir me connecter à mon compte VRM depuis
    // Vestiaire et Leboncoin aussi ». Les gestes sont dans la carte sur TOUS
    // les sites et à la souris comme au doigt (la session est celle du
    // navigateur : elle vaut pour Vinted, Leboncoin et Vestiaire).
    // 5.351 : connecté ⇒ « Ouvrir VRM » en premier (souris et doigt), puis les
    // trois écrans les plus demandés à un clic (Colis · Messages · Offres) ;
    // « Changer de compte VRM » passe dans le détail (geste rare).
    // 5.376 (Julien, 14 nov.) : plus de « Ouvrir VRM » ni de « Colis · Messages · Offres »
    // qui ouvraient VRM : les messages aux favoris se lancent ICI, et les liens ouvrent
    // le site lui-même (ventes, messages, dressing du compte de l'onglet).
    const connecte = !!(v && v.connecte) && !changerCompte;
    const fileFav = !!(e.site && e.site.favoris && e.site.favoris.file && e.site.favoris.file.actif);
    // 5.377 : Favoris · Annonces · Ventes du compte de l'onglet (Vinted, Leboncoin, Vestiaire).
    const avecListes = connecte && ['vinted', 'leboncoin', 'vestiaire'].includes(e.plateforme) && !(e.plateforme === 'vinted' && (!e.site || !e.site.id || e.site.choix === 'non'));
    const gestes = (connecte
      ? (avecListes ? '\u0000LISTES\u0000' : '')
      : (v && v.connecte) || formulaire ? '' : `<button class="b" data-montrer-connexion>Me connecter</button>`) + (formulaire ? '' : liensHtml(e, fileFav));
    const resume = resumeEtat(e);
    // Leboncoin (5.335, sa décision du 9 nov.) : les trois lignes Compte · Annonces ·
    // Ventes SONT le message principal — visibles, jamais repliées, pas doublées.
    const lbcVisible = !!lbcLignes;
    // 5.344 + 5.351 : l'historique de départ est une carte de PROGRESSION — toujours
    // visible, « Tout est récupéré ✓ » compris (c'est le signal promis : il laisse
    // vinted.fr ouvert jusque-là).
    // Le détail s'OUVRE tout seul dès qu'il y a un geste à faire (ou rien de sûr).
    // (Un compte ignoré garde « Capter ce compte » sous les yeux : le moyen de revenir.)
    // (« Connecté à VRM : x — C’est fait » se lit sans rien ouvrir, une fois.)
    const ouvert = resume.etat === 'geste' || ignore || justeConnecte || detailOuvert || !!rapTexte;
    // 5.354 (lot extension-resume) : « Ce mois : 1 340 € vendus · 42 ventes · 3 à
    // expédier » — les chiffres PUBLIÉS par VRM (widget_stats), rien recalculé ici ;
    // « pas su » ⇒ « — », jamais 0. Absent (compte de l'onglet pas prouvé à ce compte
    // VRM, eBay, pas connecté) ⇒ rien du tout. Masqué ⇒ « Afficher » dans le détail.
    const mois = connecte && e.mois && !e.mois.masque ? e.mois : null;
    const moisMasque = connecte && !!(e.mois && e.mois.masque);
    const moisHtml = mois ? ligneMois(mois) : '';
    const outils = [
      moisMasque ? '<button class="lien" data-mois-afficher>Afficher le résumé du mois</button>' : '',
      // 5.370 : « Tout arrêter » — les gestes automatiques de TOUS les comptes, jusqu'à « Reprendre ».
      // 5.409 (Julien, 19 nov. : « "Sécuriser le compte" ça sert à rien, tu peux enlever l'onglet, et "Tout arrêter" ») :
      // plus de « Tout arrêter » sur la carte ; s'il a été posé (depuis VRM), « Reprendre » reste le moyen d'en sortir.
      // Les garde-fous eux-mêmes ne bougent pas (50/h, réserve, jour, prudence, pause, captcha, un compte à la fois).
      connecte && e.toutArrete ? '<button class="lien" data-tout-reprendre>Reprendre les gestes automatiques</button>' : '',
      v && v.connecte && !changerCompte ? '<button class="lien" data-changer-vrm>Changer de compte VRM</button>' : '',
      // 5.371 : « Envoyer un rapport » — l'état technique seulement, jamais tes données.
      v && v.connecte ? '<button class="lien" data-rapport>Envoyer un rapport</button>' : '',
      // 5.377 : « VRM a capté » près du logo — le réglage (le même que dans VRM → Paramètres).
      e.capteCoupe === true || e.capteCoupe === false ? `<button class="lien" data-capte-reglage="${e.capteCoupe ? 'allumer' : 'couper'}">${e.capteCoupe ? 'Dire ce que VRM capte' : 'Ne plus dire ce que VRM capte'}</button>` : '',
      `<button class="lien" data-mini-logo>${mini ? 'Agrandir le logo' : 'Réduire le logo'}</button>`,
      posPerso ? `<button class="lien" data-replacer-logo>${esc(TU('r_remettre'))}</button>` : '',
    ].filter(Boolean).join('');
    carte.classList.toggle('doigt', doigt || formulaire);
    const defils = {}; contenu.querySelectorAll('[data-defil]').forEach((el) => { defils[el.getAttribute('data-defil')] = el.scrollTop; });
    const hautCarte = carte.scrollTop;
    // 5.406 : tête (compte · point · état) → ligne PRINCIPALE (ce qui se passe, un plein) → ligne
    // secondaire (jauge, lu, capté) → bandeau de version → listes (contrôle segmenté) → le reste.
    const q5 = lbcVisible ? '' : quatreLignes(e, resume), k5 = q5.indexOf('<div class="vu-sous"');
    const tete5 = k5 >= 0 ? q5.slice(0, k5) : q5, sous5 = k5 >= 0 ? q5.slice(k5) : '';
    // 5.409 (le grand panneau) : le technique (compte VRM, envois, version) va dans « Détails », replié, sous
    // Paramètres ; la carte des autres sites garde son « Détails » en bas, comme avant.
    void ligneSecu;   // 5.409 : la ligne « Sécurité du compte » n'est plus montrée (sa décision) ; les garde-fous restent.
    const grand5 = !!avecListes && ['vinted', 'leboncoin', 'vestiaire'].includes(e.plateforme) && !LISTES && !CADRE;   // 5.409 : Leboncoin et Vestiaire aussi
    const detailsHtml = `
      <details class="detail" data-detail${ouvert ? ' open' : ''}><summary><span>${esc(TU('c_details'))}${e.version ? ' · ' + esc(e.version) : ''}</span></summary>
      <div class="ligne"><div class="lib">Compte VRM utilisé</div>${compteVrm}</div>
      ${lbcVisible ? '' : `<div class="ligne"><div class="lib">Compte ${esc(nomSite)}</div>${compteSite}</div>`}
      ${e.capte && !(e.plateforme === 'leboncoin' && e.lbc) ? `<div class="ligne"><div class="lib">Tes données</div>${flux}</div>` : ''}
      ${e.mesure ? `<div class="ligne"><div class="lib">Mesure</div><div class="val gris">VRM apprend à lire ${esc(nomSite)} : il relève la forme des pages, jamais leur contenu. Aucune vente ni annonce n'est encore captée.</div>${(() => { const f = e.flux || {}; return f.koAt && (!f.okAt || f.koAt > f.okAt) ? `<div class="val alerte">Dernier relevé refusé ${esc(depuis(f.koAt))}</div>` : f.okAt ? `<div class="val gris">Relevé envoyé ${esc(depuis(f.okAt))}</div>` : ''; })()}</div>` : ''}
      ${outils ? `<div class="outils">${outils}</div>` : ''}${rapTexte ? `<div class="rep" data-rapport-etat role="status">${esc(rapTexte)}</div>` : ''}
      ${v && v.connecte ? observationHtml(e) : ''}
      </details>`;
    const lienVrm = (q, k) => `<a class="rg5" href="https://vrm.center/${q}" target="_blank" rel="noopener" data-reglage-vrm="${esc(k)}"><span>${esc(TU(k))}</span><i aria-hidden="true">›</i></a>`;
    const parametres5 = grand5 ? `<div class="par5" data-parametres>
      ${vacancesHtml(e)}
      ${commeBleamHtml()}
      ${apprisHtml()}
      ${cadenceHtml()}
      ${precieuxHtml()}
      ${gardePrixHtml()}
      ${sauvegardeHtml()}
      <section class="grp5"><h3>${esc(TU('r_logo'))}</h3><p class="note5">${esc(TU('r_logo_note'))}</p><div class="outils">${`<button class="lien" data-mini-logo>${mini ? 'Agrandir le logo' : 'Réduire le logo'}</button>`}${`<button class="lien" data-replacer-logo>${esc(TU('r_remettre'))}</button>`}</div></section>
      <section class="grp5"><h3>${esc(TU('r_arrivee'))}</h3><div class="outils">${e.capteCoupe === true || e.capteCoupe === false ? `<button class="lien" data-capte-reglage="${e.capteCoupe ? 'allumer' : 'couper'}">${e.capteCoupe ? 'Dire ce que VRM capte' : 'Ne plus dire ce que VRM capte'}</button>` : ''}${moisMasque ? '<button class="lien" data-mois-afficher>Afficher le résumé du mois</button>' : ''}</div></section>
      <section class="grp5"><h3>${esc(TU('r_vrm'))}</h3>${lienVrm('?tab=settings&section=notifications', 'r_notifs')}${lienVrm('?tab=settings', 'r_langue')}</section>
      ${connecte && e.toutArrete ? '<div class="outils"><button class="lien" data-tout-reprendre>Reprendre les gestes automatiques</button></div>' : ''}
      ${detailsHtml.replace('<div class="outils">' + outils + '</div>', '<div class="outils">' + [v && v.connecte && !changerCompte ? '<button class="lien" data-changer-vrm>Changer de compte VRM</button>' : '', v && v.connecte ? '<button class="lien" data-rapport>Envoyer un rapport</button>' : ''].join('') + '</div>')}
    </div>` : '';
    if (grand5) carte.setAttribute('data-grand', ''); else carte.removeAttribute('data-grand');
    const principal = connecte && e.plateforme === 'vinted' ? favorisFileHtml(e) : '';
    if (grand5) {
      // 5.410 : le panneau « comme Vintex ». Ce qui se passe maintenant (envoi en cours, version, réparation, lecture de
      // l'historique, alertes du site) reste AU-DESSUS de la page ; les listes sont la page.
      if (e.plateforme === 'vinted') lireCommeBleam(false);   // 5.410.3 : l'onglet qui travaille, nommé en haut du panneau
      const extras = [ongletListe === 'favoris' && e.plateforme === 'vinted' ? '' : principal, e.plateforme === 'vinted' && cbEtat && cbEtat.onglet && cbEtat.onglet.travaille ? ongletTravailHtml() : '', majHtml(e.maj), Array.isArray(e.aReparer) && e.aReparer.length && v && v.connecte !== false ? `<button class="b sec" data-reparer data-a-reparer="${esc(e.aReparer.join(' '))}">Réparer</button>` : '', repHtml(), progression, historique, lignePerime, ligneDeCote, aRetirerLbc, diagnosticLbc, bascule].filter(Boolean).map((h) => `<div class="ext6">${h}</div>`).join('');
      const liste = listesHtml(e, parametres5);
      poserHtml(contenu, vxHtml(e, `<div class="gestes">${liste}</div>`, extras));
    } else poserHtml(contenu, `<button class="fermer" data-fermer-carte title="${esc(TU('c_fermer'))}" aria-label="${esc(TU('c_fermer'))}">×</button>${lbcVisible ? `<div class="t5"><b class="nom">VRM</b></div>` : tete5}
      ${lbcVisible ? `<div class="lbc5"><div class="ligne lbc-tete"><div class="lib">Compte ${esc(nomSite)}</div>${compteSite}</div>${lbcLignes}${ligneCapture(e)}</div>` : ''}
      ${principal}
      ${sous5}
      ${majHtml(e.maj)}
      ${Array.isArray(e.aReparer) && e.aReparer.length && v && v.connecte !== false ? `<button class="b sec" data-reparer data-a-reparer="${esc(e.aReparer.join(' '))}">Réparer</button>` : ''}${repHtml()}
      ${progression}
      ${historique}
      ${lignePerime}
      ${ligneDeCote}
      ${aRetirerLbc}
      ${diagnosticLbc}
      ${bascule}
      ${gestes.replace('\u0000LISTES\u0000', () => `<div class="gestes">${listesHtml(e, parametres5)}</div>`)}
      ${moisHtml}
      ${grand5 ? '' : detailsHtml}`);
    contenu.querySelectorAll('[data-defil]').forEach((el) => { const v = defils[el.getAttribute('data-defil')]; if (v) el.scrollTop = v; });
    if (hautCarte) carte.scrollTop = hautCarte;
    reposerDefil();
    if (grand5) garderPanneau();
    brancherReparer();
    brancherRapport();
    brancherObservation(carte);
    const det = carte.querySelector('[data-detail]');
    if (det) det.addEventListener('toggle', () => { if (resume.etat !== 'geste') detailOuvert = det.open; });
    brancherFavoris(e);
    if (avecListes) brancherListes(carte, e);
    const moisD = carte.querySelector('[data-mois]');
    if (moisD) moisD.addEventListener('toggle', () => { moisOuvert = moisD.open; });
    carte.querySelectorAll('[data-mois-masquer],[data-mois-afficher]').forEach((el) => el.addEventListener('click', () => {
      const masquer = el.hasAttribute('data-mois-masquer');
      el.disabled = true;
      try {
        chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'resumeMasque', masque: masquer }, (r) => {
          void chrome.runtime.lastError;
          if (r && r.ok) { if (masquer) { e.mois = { masque: true }; moisOuvert = false; rendre(); } else { e.mois = null; rafraichir(); } return; }
          el.disabled = false;
        });
      } catch (_) { el.disabled = false; }
    }));
    carte.querySelectorAll('[data-tout-arreter],[data-tout-reprendre]').forEach((el) => el.addEventListener('click', () => {
      const on = el.hasAttribute('data-tout-arreter');
      el.disabled = true;
      try {
        chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'toutArreter', on }, (r) => {
          void chrome.runtime.lastError;
          if (r && r.ok) { e.toutArrete = on; rendre(); return; }
          el.disabled = false;
        });
      } catch (_) { el.disabled = false; }
    }));
    const capteB = carte.querySelector('[data-capte-reglage]');
    if (capteB) capteB.addEventListener('click', () => {
      const couper = capteB.getAttribute('data-capte-reglage') === 'couper';
      capteB.disabled = true;
      try {
        chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'capteReglage', coupe: couper }, (r) => {
          void chrome.runtime.lastError;
          if (r && r.ok) { e.capteCoupe = r.coupe === true; if (couper) cacherCapte('reglage'); rendre(); return; }
          capteB.disabled = false;
        });
      } catch (_) { capteB.disabled = false; }
    });
    const miniB = carte.querySelector('[data-mini-logo]');
    if (miniB) miniB.addEventListener('click', () => { poserMini(!mini); rendre(); });
    const replacer = carte.querySelector('[data-replacer-logo]');
    if (replacer) replacer.addEventListener('click', () => { remettreEnPlace(); rendre(); });
    const changer = carte.querySelector('[data-changer-vrm]');
    // 5.329 : changer de compte se fait ICI (le formulaire), jamais en ouvrant VRM.
    if (changer) changer.addEventListener('click', () => { changerCompte = true; formulaireDemande = true; doigt = true; rendre(); focaliser(); });
    const fermerC = carte.querySelector('[data-fermer-carte]');
    if (fermerC) fermerC.addEventListener('click', fermerCarte);
    const montrer = carte.querySelector('[data-montrer-connexion]');
    if (montrer) montrer.addEventListener('click', () => { formulaireDemande = true; rendre(); });
    poserFormulaire(formulaire);
    const recharger = carte.querySelector('[data-lbc-recharger]');
    const rebrancher = carte.querySelector('[data-lbc-rebrancher]');
    if (rebrancher) rebrancher.addEventListener('click', () => { try { sessionStorage.removeItem('vrm_lbc_de_cote'); } catch (_) {} try { location.reload(); } catch (_) {} });
    if (recharger) recharger.addEventListener('click', () => { try { location.reload(); } catch (_) {} });
    const capter = carte.querySelector('[data-capter]');
    if (capter) capter.addEventListener('click', () => { capter.disabled = true; envoyerChoix('oui'); });
    const secuB = carte.querySelector('[data-secu-arret]');
    if (secuB) secuB.addEventListener('click', () => {
      const arreter = secuB.getAttribute('data-secu-arret') === 'arreter';
      secuB.disabled = true;
      try {
        chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'secuArret', arret: arreter }, (r) => {
          void chrome.runtime.lastError;
          if (r && r.accepte && e.secu) { e.secu.arrete = !!r.arrete; if (r.arrete) { e.secu.niveau = 'arret'; e.secu.texte = 'Tout est arrêté · rien d’automatique ne part'; } else { e.secu.niveau = 'ok'; e.secu.texte = 'Relancé'; } rendre(); return; }
          secuB.disabled = false;
        });
      } catch (_) { secuB.disabled = false; }
    });
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
    if (LISTES) { chargerListes(true); rendreListesSeules(); return; }
    const r = await demander();
    if (r === undefined) { hote.remove(); return; }
    pasSu = r === null;
    const avant = !!(etat && etat.vrm && etat.vrm.connecte === false) || ((!!formulaireEl || !!cadreEl) && !changerCompte);
    if (r) etat = r;
    // 5.328 : connecté depuis la carte ⇒ elle reste ouverte et NOMME le compte.
    if (avant && etat && etat.vrm && etat.vrm.connecte) { justeConnecte = true; formulaireDemande = false; }
    // 5.330 : de retour de Google / Discord dans CET onglet (Orion) ⇒ la carte
    // s'ouvre d'elle-même, une fois, et dit le résultat.
    const rev = r && r.oauthRevenu;
    if (rev && (rev.etat === 'ok' || rev.etat === 'erreur')) {
      doigt = true; carte.classList.add('on');
      if (rev.etat === 'ok' && etat && etat.vrm && etat.vrm.connecte) { justeConnecte = true; formulaireDemande = false; }
      else if (rev.etat === 'erreur') { formulaireDemande = true; erreurAuRetour = rev.message || 'La connexion n’a pas abouti.'; }
    }
    rendre();
  }

  // ── LA CONNEXION, DESSINÉE DANS LA CARTE (5.329) ─────────────────────────
  // Julien, 8 nov., 22 h (iPhone, Orion, 5.328) : « je veux avoir les outils de
  // connexion directement là, et que ça n'ouvre AUCUN autre onglet ».
  // ⚠️ Pourquoi plus d'iframe : la 5.328 posait `popup.html?mode=carte` (une page
  //    de l'extension) dans la carte et attendait qu'il dise « prête » ; sur
  //    Orion il ne l'a jamais dit (page d'extension dans une page web, et
  //    `ev.source === iframe.contentWindow` entre deux mondes : rien de garanti
  //    par le moteur d'Orion), et au bout de 6 s la carte proposait « Se
  //    connecter avec VRM », qui ouvrait VRM dans un onglet.
  // ⇒ Les champs vivent dans la shadow root FERMÉE de la carte (la page reçoit
  //    `null` pour `hote.shadowRoot` et ne voit aucun <input> dans son DOM),
  //    `autocomplete="off"` et des noms à nous (pas mélangés avec les
  //    identifiants Vinted). Les événements du clavier, de saisie, de
  //    composition et du presse-papiers sont ARRÊTÉS à la frontière de la carte
  //    (`bouclier`, sur l'hôte et sur `window` en capture) : les écouteurs de la
  //    page posés après nous n'entendent rien. ⚠️ Limite dite : un écouteur que
  //    la page a posé sur `window` en capture AVANT nous entend toujours la
  //    touche (`key`) — la valeur du champ, elle, ne lui est jamais lisible.
  // ⇒ Le mot de passe part UNE fois au service worker (`authLogin`, depuis la
  //    carte : `from: 'vrm-badge'`), n'est jamais rangé ni dans une adresse ni
  //    `postMessage` ; le champ est vidé dès la réponse. Aucun onglet ouvert.
  // ⇒ Google / Discord : seulement si le service worker dit qu'il peut ouvrir
  //    une PETITE FENÊTRE qui se ferme seule au retour (`oauthFenetre`, Chrome,
  //    Edge, Firefox sur ordinateur). Orion (iPhone) n'a pas de fenêtre : les
  //    boutons n'y sont pas montrés — le mot de passe suffit.
  let formulaireEl = null, formulaireDemande = false, justeConnecte = false, changerCompte = false, envoiEnVol = false, fournisseurs = null, fournisseursDemandes = false;
  // 5.332 : le cadre de « Changer de compte VRM » (la carte du site le demande par l'adresse).
  if (CADRE) formulaireDemande = true;
  if (CADRE && /[?&]changer=1(?:&|$)/.test(location.search)) changerCompte = true;
  let cadreDitPrete = false;
  const EVTS_BOUCLIER = ['keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'textInput', 'compositionstart', 'compositionupdate', 'compositionend', 'paste', 'copy', 'cut'];
  const vientDeLaCarte = (ev) => { try { const p = ev.composedPath(); return p[0] === hote || p.includes(hote); } catch (_) { return ev.target === hote; } };
  // ⚠️ 5.330 : arrêté sur `window` en capture, l'événement n'atteint plus NOS
  // champs non plus. Le champ du code a besoin de sa saisie (chiffres, cases) :
  // elle lui est remise ICI, avant l'arrêt (`surSaisieCode`) — la page, elle,
  // n'entend toujours rien.
  let surSaisieCode = null;
  const bouclier = (ev) => {
    if (!formulaireEl || !vientDeLaCarte(ev)) return;
    // (Vu de `window`, une racine FERMÉE cache sa cible : on lit le champ actif de la racine.)
    try { const c = champ('vrm-cx-code'); if (ev.type === 'input' && surSaisieCode && c && ombre.activeElement === c) surSaisieCode(ev); } catch (_) {}
    ev.stopImmediatePropagation();
  };
  for (const t of EVTS_BOUCLIER) {
    try { window.addEventListener(t, bouclier, true); } catch (_) {}
    try { hote.addEventListener(t, (ev) => { if (formulaireEl) ev.stopPropagation(); }, false); } catch (_) {}
  }
  const LOGO_FOURN = {
    google: '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.5 46 24 46z"/><path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5C3 17 2.1 20.4 2.1 24s.9 7 2.4 9.9l7.3-5.7z"/><path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.5 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"/></svg>',
    discord: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true" focusable="false"><path d="M19.3 5.3A16.9 16.9 0 0 0 15.1 4l-.2.4a15.7 15.7 0 0 1 3.7 1.2 13.1 13.1 0 0 0-11.2 0A15.6 15.6 0 0 1 11.1 4.4L10.9 4a16.9 16.9 0 0 0-4.2 1.3C4 9.3 3.3 13.2 3.7 17a17 17 0 0 0 5.1 2.6l1-1.7a11 11 0 0 1-1.7-.8l.4-.3a12.1 12.1 0 0 0 10.4 0l.4.3a11 11 0 0 1-1.7.8l1 1.7a17 17 0 0 0 5.1-2.6c.5-4.4-.6-8.3-2.4-11.7ZM9.7 14.7c-1 0-1.8-.9-1.8-2.1 0-1.1.8-2.1 1.8-2.1s1.9 1 1.8 2.1c0 1.2-.8 2.1-1.8 2.1Zm4.6 0c-1 0-1.8-.9-1.8-2.1 0-1.1.8-2.1 1.8-2.1s1.9 1 1.8 2.1c0 1.2-.8 2.1-1.8 2.1Z"/></svg>',
  };
  const NOM_FOURN = { google: 'Google', discord: 'Discord' };
  const champ = (id) => (formulaireEl ? formulaireEl.querySelector('#' + id) : null);
  // ══ 5.330 : TROIS FAÇONS, DANS LA CARTE, DANS CET ORDRE ═════════════════
  // Julien, 8 nov. : « il n'y a pas la connexion Discord et Google, parce que
  // certains ont créé leur compte comme ça » — ces comptes n'ont pas de mot de
  // passe. ⇒ 1. l'e-mail et « Me connecter avec un code » (un code reçu par
  // e-mail, marche pour TOUS les comptes VRM) ; 2. « J'ai un mot de passe »
  // (déplie le champ) ; 3. Google, Discord — dans une petite fenêtre sur
  // ordinateur, dans CET onglet sur Orion (il revient ici, connecté).
  // `modeCx` : 'code' (l'e-mail) · 'mdp' (e-mail + mot de passe) · 'saisie' (les cases du code).
  let modeCx = 'code', mailSaisi = '', codeEnvoi = null, codeEtatDemande = false, minuteurRenvoi = null, erreurAuRetour = '';
  const LONG_CODE = 6;
  function focaliser() {
    setTimeout(() => {
      try {
        const c = champ('vrm-cx-code'); if (c) { c.focus({ preventScroll: true }); return; }
        const m = champ('vrm-cx-mail'); const p = champ('vrm-cx-mdp');
        (m && !m.value ? m : p || m).focus({ preventScroll: true });
      } catch (_) {}
    }, 30);
  }
  function direErreur(t) {
    const e = champ('vrm-cx-err'); if (!e) return;
    e.textContent = t || ''; e.hidden = !t;
  }
  function direEtat(t) { const e = champ('vrm-cx-etat'); if (!e) return; e.textContent = t || ''; e.hidden = !t; }
  function viderSecrets() {
    try { const p = champ('vrm-cx-mdp'); if (p) p.value = ''; } catch (_) {}
    try { const c = champ('vrm-cx-code'); if (c) c.value = ''; } catch (_) {}
  }
  // ══ 5.332 : L'IFRAME DE L'EXTENSION (Chrome, Edge, Firefox) ══════════════
  // Décision de Julien (9 nov., défaut #6 de la revue sécurité) : là où une page
  // d'extension s'affiche dans un iframe, le formulaire y vit (`popup.html?
  // mode=carte`, origine de l'extension) : la page du site n'entend AUCUNE
  // touche, même avec un écouteur posé en capture avant nous. Orion est exclu
  // d'office (paquet MV2, `__vrmOrionCompat` : l'iframe ne s'y affichait pas,
  // 5.328). Ailleurs, le cadre doit dire « prête » DEPUIS l'origine de
  // l'extension en 1,5 s ; sinon (cadre muet) : le formulaire dessiné dans la
  // carte (shadow root fermée), comme avant — jamais un onglet. Le cadre reste
  // CACHÉ tant qu'il n'a pas dit « prête », et se re-cache à chaque nouveau
  // chargement : une page qui ferait naviguer l'iframe vers SA page (une fausse
  // connexion) n'est jamais montrée — la carte retombe sur son formulaire.
  const CADRE_DELAI_MS = 1500;
  // ⚠️ 5.362 (revue, moyenne 69) — JAMAIS LE MOT DE PASSE DANS LA CARTE DESSINÉE.
  //    Dessinée (Orion, ou cadre muet), la carte vit dans le DOM de la page du site :
  //    un écouteur de touches posé par la page AVANT le nôtre recevait chaque lettre.
  //    Le mot de passe n'est donc proposé QUE dans l'iframe de l'extension (`CADRE`,
  //    origine de l'extension) ; dessinée, la carte connecte par CODE reçu par e-mail
  //    (tout compte VRM) — un code à usage unique, sans valeur une fois utilisé.
  //    (`MDP_PERMIS` est posé en tête, juste après `CADRE`.)
  const ORIGINE_EXT = (() => { try { return new URL(chrome.runtime.getURL('popup.html')).origin; } catch (_) { return ''; } })();
  let cadreH = 0, cadreEl = null, cadreChanger = false, cadreMuet = false, cadreMinuteur = null, cadreChargements = 0, cadrePret = false;
  function cadreVoulu() {
    if (CADRE || cadreMuet || !ORIGINE_EXT || ORIGINE_EXT === 'null') return false;
    try {
      if (globalThis.__vrmOrionCompat) return false;
      const m = chrome.runtime.getManifest();
      return !!(m && m.manifest_version === 3);
    } catch (_) { return false; }
  }
  function retirerCadre() {
    clearTimeout(cadreMinuteur);
    if (cadreEl) { try { cadreEl.remove(); } catch (_) {} }
    cadreEl = null; cadrePret = false; cadreChargements = 0; cadreH = 0;
    connexion.removeAttribute('data-cadre');
  }
  function cadreRepli() {
    // Muet, ou parti ailleurs : le formulaire de la carte, pour toute la page.
    cadreMuet = true;
    retirerCadre();
    if (connexion.childNodes.length) connexion.replaceChildren();
    connexion.setAttribute('data-cadre', 'repli');
    poserFormulaire(true, true);
    connexion.setAttribute('data-cadre', 'repli');
  }
  function attendrePrete() {
    clearTimeout(cadreMinuteur);
    cadrePret = false;
    if (cadreEl) { cadreEl.style.visibility = 'hidden'; cadreEl.style.height = '0px'; }
    connexion.setAttribute('data-cadre', 'attente');
    const att = connexion.querySelector('[data-cadre-attente]'); if (att) att.hidden = false;
    cadreMinuteur = setTimeout(() => { if (!cadrePret) cadreRepli(); }, CADRE_DELAI_MS);
  }
  function poserCadre() {
    if (formulaireEl) { viderSecrets(); formulaireEl = null; }
    if (cadreEl && cadreChanger === changerCompte) { connexion.hidden = false; return true; }
    retirerCadre();
    connexion.hidden = false;
    cadreChanger = changerCompte;
    const f = document.createElement('iframe');
    f.src = chrome.runtime.getURL('popup.html') + '?mode=carte' + (changerCompte ? '&changer=1' : '');
    f.title = 'Connexion à VRM';
    f.setAttribute('data-cadre-connexion', '');
    f.style.cssText = 'display:block;width:100%;height:0;border:0;margin:0;background:transparent;color-scheme:normal;visibility:hidden;';
    poserHtml(connexion, `${erreurAuRetour ? `<div class="err" role="alert">${esc(erreurAuRetour)}</div>` : ''}<div class="etat" data-cadre-attente>Chargement de la connexion…</div>`);
    erreurAuRetour = '';
    connexion.appendChild(f);
    cadreEl = f; cadreChargements = 0;
    f.addEventListener('load', () => {
      if (cadreEl !== f) return;
      cadreChargements += 1;
      // Un second chargement = le cadre a navigué (pas nous) : on recache et on
      // exige un nouveau « prête » venu de l'extension.
      if (cadreChargements > 1) attendrePrete();
    });
    attendrePrete();
    return true;
  }
  try {
    window.addEventListener('message', (ev) => {
      if (!cadreEl || CADRE) return;
      if (ev.origin !== ORIGINE_EXT || ev.source !== cadreEl.contentWindow) return;
      const d = ev.data;
      if (!d || typeof d !== 'object' || typeof d.__vrmCarte !== 'string') return;
      if (d.__vrmCarte === 'prete') {
        clearTimeout(cadreMinuteur); cadrePret = true;
        const att = connexion.querySelector('[data-cadre-attente]'); if (att) att.hidden = true;
        cadreEl.style.visibility = 'visible';
        cadreEl.style.height = (cadreH || 220) + 'px';
        connexion.setAttribute('data-cadre', 'pret');
      } else if (d.__vrmCarte === 'hauteur') {
        cadreH = Math.max(60, Math.min(640, Math.ceil(Number(d.h) || 0)));
        if (cadrePret) cadreEl.style.height = cadreH + 'px';
      } else if (d.__vrmCarte === 'depart') {
        attendrePrete();
      } else if (d.__vrmCarte === 'annuler') {
        changerCompte = false; formulaireDemande = false; rendre();
      } else if (d.__vrmCarte === 'aller' && cadrePret) {
        // Google / Discord sans petite fenêtre : CET onglet part (jamais un autre).
        const u = String(d.url || '');
        if (URL_AUTORISE.test(u)) { try { location.assign(u); } catch (_) {} }
      }
    });
  } catch (_) {}

  function poserFormulaire(montrer, refaire) {
    if (montrer && cadreVoulu() && poserCadre()) return;
    if (!montrer) retirerCadre();
    if (!montrer) {
      connexion.hidden = true;
      if (formulaireEl) viderSecrets();
      formulaireEl = null; envoiEnVol = false; clearInterval(minuteurRenvoi);
      if (connexion.childNodes.length) connexion.replaceChildren();
      return;
    }
    connexion.hidden = false;
    if (formulaireEl && !refaire) { rendreFournisseurs(); majAnnuler(); return; }
    if (formulaireEl) { const m = champ('vrm-cx-mail'); if (m) mailSaisi = String(m.value || '').trim(); viderSecrets(); }
    clearInterval(minuteurRenvoi);
    if (!mailSaisi && etat && etat.vrm && etat.vrm.expiree && etat.vrm.email) mailSaisi = etat.vrm.email;
    const mail = `<label class="lab" for="vrm-cx-mail">E-mail de ton compte VRM</label>
      <input id="vrm-cx-mail" name="vrm-carte-identifiant" type="email" inputmode="email" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="${modeCx === 'mdp' ? 'next' : 'send'}" placeholder="prenom@exemple.fr" value="${esc(mailSaisi)}" data-1p-ignore data-lpignore="true">`;
    const pied = `<button type="button" class="b sec" data-annuler-changer hidden>Annuler</button>
      <div class="err" id="vrm-cx-err" role="alert" hidden></div>
      <div class="etat" id="vrm-cx-etat" role="status" aria-live="polite" hidden></div>`;
    let corps;
    if (modeCx === 'saisie' && codeEnvoi) {
      corps = `<div class="envoye">Code envoyé à <b>${esc(codeEnvoi.email)}</b>. Regarde ta boîte mail (et les indésirables).</div>
      <label class="lab" for="vrm-cx-code">Code reçu par e-mail</label>
      <div class="cases" data-cases>${Array.from({ length: LONG_CODE }, () => '<span class="case" aria-hidden="true"></span>').join('')}
        <input id="vrm-cx-code" name="vrm-carte-code" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="10" autocomplete="one-time-code" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-describedby="vrm-cx-aide-code" data-1p-ignore data-lpignore="true">
      </div>
      <div class="aide" id="vrm-cx-aide-code">6 chiffres. Seul le dernier code reçu marche.</div>
      <button type="submit" class="b" data-principal data-code-valider disabled>Valider le code</button>
      ${pied}
      <button type="button" class="b sec" data-code-renvoyer disabled>Renvoyer le code</button>
      <button type="button" class="lien" data-code-changer>Changer d’e-mail</button>`;
    } else if (modeCx === 'mdp' && MDP_PERMIS) {
      corps = `${mail}
      <label class="lab" for="vrm-cx-mdp">Mot de passe VRM</label>
      <input id="vrm-cx-mdp" name="vrm-carte-secret" type="password" autocomplete="off" enterkeyhint="go" placeholder="Mot de passe VRM" data-1p-ignore data-lpignore="true">
      <div class="aide">Ceux de vrm.center — pas ceux de Vinted.</div>
      <button type="submit" class="b" data-principal data-me-connecter>Me connecter</button>
      ${pied}
      <button type="button" class="b sec" data-basculer-mode>Recevoir un code à la place</button>
      <a class="oubli" href="https://vrm.center/?connexion&amp;mot-de-passe-oublie" target="_blank" rel="noreferrer" data-oubli>Mot de passe oublié ?</a>`;
    } else {
      corps = `${mail}
      <button type="submit" class="b" data-principal data-code-demander>Me connecter avec un code</button>
      <div class="aide">Un code à 6 chiffres arrive sur cet e-mail. Marche aussi si tu as créé ton compte avec Google ou Discord.</div>
      ${pied}
      ${MDP_PERMIS ? '<button type="button" class="b sec" data-basculer-mode>J’ai un mot de passe</button>' : ''}`;
    }
    poserHtml(connexion, `<form class="cx" data-connexion-carte data-mode="${modeCx}" novalidate autocomplete="off">${corps}
      <div data-fournisseurs-carte hidden></div></form>`);
    formulaireEl = connexion.querySelector('form');
    formulaireEl.addEventListener('submit', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      if (modeCx === 'mdp') seConnecter(); else if (modeCx === 'saisie') validerCode(); else demanderCode();
    });
    formulaireEl.querySelector('[data-annuler-changer]').addEventListener('click', () => { if (CADRE) { direAuSite({ __vrmCarte: 'annuler' }); return; } changerCompte = false; formulaireDemande = false; modeCx = 'code'; rendre(); });
    const bascule = formulaireEl.querySelector('[data-basculer-mode]');
    if (bascule) bascule.addEventListener('click', () => { modeCx = (modeCx === 'mdp' || !MDP_PERMIS) ? 'code' : 'mdp'; poserFormulaire(true, true); focaliser(); });
    if (modeCx === 'saisie') brancherCases();
    if (erreurAuRetour) { direErreur(erreurAuRetour); erreurAuRetour = ''; }
    rendreFournisseurs(); majAnnuler();
    // Une demande de code déjà partie (iOS a pu recharger la page pendant qu'il
    // lisait ses e-mails) : on reprend aux cases, une fois par page.
    if (!codeEtatDemande && modeCx === 'code') {
      codeEtatDemande = true;
      try {
        chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'authCodeEtat' }, (r) => {
          let err = null; try { err = chrome.runtime.lastError; } catch (_) {}
          if (err || !r || !r.enCours || !formulaireEl || modeCx !== 'code') return;
          codeEnvoi = { email: r.email, at: r.at }; mailSaisi = r.email; modeCx = 'saisie';
          poserFormulaire(true, true);
        });
      } catch (_) {}
    }
  }
  function majAnnuler() { const b = formulaireEl && formulaireEl.querySelector('[data-annuler-changer]'); if (b) b.hidden = !changerCompte; }
  // Les cases : UN vrai champ (chiffres seulement, `one-time-code` pour que
  // l'iPhone propose le code reçu), posé sur des cases qui en montrent les
  // chiffres. Coller ou remplir d'un coup un code complet le valide tout seul.
  function brancherCases() {
    const c = champ('vrm-cx-code'), boite = formulaireEl.querySelector('[data-cases]');
    const valider = formulaireEl.querySelector('[data-code-valider]');
    if (!c || !boite) return;
    const peindre = () => {
      const v = String(c.value || '');
      const n = Math.max(LONG_CODE, Math.min(10, v.length));
      let cases = boite.querySelectorAll('.case');
      while (cases.length < n) { const s = document.createElement('span'); s.className = 'case'; s.setAttribute('aria-hidden', 'true'); boite.insertBefore(s, c); cases = boite.querySelectorAll('.case'); }
      while (cases.length > n) { cases[cases.length - 1].remove(); cases = boite.querySelectorAll('.case'); }
      const actif = c.matches(':focus');
      cases.forEach((s, i) => { s.textContent = v[i] || ''; s.classList.toggle('cur', actif && i === Math.min(v.length, n - 1)); });
      if (valider) valider.disabled = envoiEnVol || !/^\d{6,10}$/.test(v);
    };
    // Appelée par le bouclier (sur `window`, en capture) ; l'écouteur posé sur le
    // champ ne sert que si le bouclier n'a pas pu être posé. Une fois par événement.
    surSaisieCode = (ev) => {
      if (ev && ev.__vrmCode) return; try { ev.__vrmCode = true; } catch (_) {}
      if (champ('vrm-cx-code') !== c) return;
      const avant = String(c.value || '');
      const v = avant.replace(/\D+/g, '').slice(0, 10);
      if (v !== avant) c.value = v;
      if (v) direErreur('');
      peindre();
      // Un code COMPLET arrivé d'un coup (collé, ou proposé par l'iPhone) part tout seul.
      const enBloc = ev && (ev.inputType === 'insertFromPaste' || ev.inputType === 'insertReplacementText' || (typeof ev.data === 'string' && ev.data.length > 1) || ev.inputType === undefined || ev.inputType === '');
      if (enBloc && /^\d{6,10}$/.test(v)) validerCode();
    };
    c.addEventListener('input', surSaisieCode);
    c.addEventListener('focus', peindre); c.addEventListener('blur', peindre);
    peindre();
    minuterRenvoi();
    const ren = formulaireEl.querySelector('[data-code-renvoyer]');
    if (ren) ren.addEventListener('click', () => demanderCode(true));
    const chg = formulaireEl.querySelector('[data-code-changer]');
    if (chg) chg.addEventListener('click', () => { modeCx = 'code'; codeEnvoi = null; poserFormulaire(true, true); focaliser(); });
  }
  function minuterRenvoi() {
    clearInterval(minuteurRenvoi);
    const ren = formulaireEl && formulaireEl.querySelector('[data-code-renvoyer]');
    if (!ren || !codeEnvoi) return;
    const tic = () => {
      const reste = Math.ceil((60000 - (Date.now() - Number(codeEnvoi.at || 0))) / 1000);
      if (reste > 0 && reste <= 60) { ren.disabled = true; ren.textContent = `Renvoyer le code (dans ${reste} s)`; return; }
      ren.disabled = false; ren.textContent = 'Renvoyer le code'; clearInterval(minuteurRenvoi);
    };
    tic(); minuteurRenvoi = setInterval(tic, 1000);
  }
  // Une demande au service worker, jamais un bouton figé (iOS peut le suspendre en route).
  function demanderAuFond(msg, finir) {
    let fini = false;
    const fin = (r, muet) => { if (fini) return; fini = true; clearTimeout(attente); finir(r, muet); };
    const attente = setTimeout(() => fin(null, true), 20000);
    try {
      chrome.runtime.sendMessage(msg, (r) => {
        let err = null; try { err = chrome.runtime.lastError; } catch (_) {}
        fin(err ? null : r, !!err || r === undefined);
      });
    } catch (_) { fin(null, true); }
  }
  function demanderCode(renvoi) {
    if (envoiEnVol || !formulaireEl) return;
    const m = champ('vrm-cx-mail');
    const email = renvoi && codeEnvoi ? codeEnvoi.email : String((m && m.value) || '').trim();
    if (!email) { direErreur('Tape l’e-mail de ton compte VRM.'); try { m.focus(); } catch (_) {} return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { direErreur('Cet e-mail n’a pas la bonne forme (exemple : prenom@exemple.fr).'); return; }
    mailSaisi = email;
    const b = formulaireEl.querySelector(renvoi ? '[data-code-renvoyer]' : '[data-code-demander]');
    const texte = b ? b.textContent : '';
    envoiEnVol = true; direErreur(''); direEtat('');
    if (b) { b.disabled = true; b.textContent = 'Envoi du code…'; }
    demanderAuFond({ from: 'vrm-badge', action: 'authCodeDemande', email }, (r, muet) => {
      envoiEnVol = false;
      if (r && r.ok) {
        codeEnvoi = { email: r.email || email.toLowerCase(), at: Number(r.at) || Date.now() };
        modeCx = 'saisie'; poserFormulaire(true, true);
        if (renvoi) direEtat('Nouveau code envoyé. Seul ce dernier code marche.');
        focaliser(); return;
      }
      if (b) { b.textContent = texte; b.disabled = false; }
      if (renvoi) minuterRenvoi();
      direErreur(muet ? 'L’extension n’a pas répondu. Réessaie dans un instant.' : ((r && r.error) || 'Le code n’a pas pu partir.'));
    });
  }
  function validerCode() {
    if (envoiEnVol || !formulaireEl || !codeEnvoi) return;
    const c = champ('vrm-cx-code'), b = formulaireEl.querySelector('[data-code-valider]');
    const code = String((c && c.value) || '').replace(/\D+/g, '');
    if (!/^\d{6,10}$/.test(code)) { direErreur('Tape les 6 chiffres du code reçu par e-mail.'); return; }
    envoiEnVol = true; direErreur(''); direEtat('');
    if (b) { b.disabled = true; b.textContent = 'Vérification…'; }
    demanderAuFond({ from: 'vrm-badge', action: 'authCodeVerif', email: codeEnvoi.email, code }, (r, muet) => {
      envoiEnVol = false;
      // Le code ne reste nulle part : le champ est vidé dès la réponse.
      try { if (c) { c.value = ''; c.dispatchEvent(new Event('blur')); } } catch (_) {}
      if (b) { b.textContent = 'Valider le code'; b.disabled = true; }
      if (r && r.ok) { justeConnecte = true; changerCompte = false; formulaireDemande = false; modeCx = 'code'; codeEnvoi = null; rafraichir(); return; }
      if (r && r.expire) { modeCx = 'code'; poserFormulaire(true, true); }
      direErreur(muet ? 'L’extension n’a pas répondu. Réessaie dans un instant.' : ((r && r.error) || 'Code refusé.'));
      focaliser();
    });
  }
  function seConnecter() {
    if (envoiEnVol || !formulaireEl) return;
    const m = champ('vrm-cx-mail'), p = champ('vrm-cx-mdp'), b = formulaireEl.querySelector('[data-me-connecter]');
    const email = String((m && m.value) || '').trim(), password = String((p && p.value) || '');
    if (!email || !password) { direErreur(!email && !password ? 'Tape l’e-mail et le mot de passe de ton compte VRM.' : !email ? 'Tape l’e-mail de ton compte VRM.' : 'Tape ton mot de passe VRM.'); try { (!email ? m : p).focus(); } catch (_) {} return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { direErreur('Cet e-mail n’a pas la bonne forme (exemple : prenom@exemple.fr).'); return; }
    mailSaisi = email;
    envoiEnVol = true; direErreur(''); direEtat('');
    if (b) { b.disabled = true; b.textContent = 'Connexion…'; }
    demanderAuFond({ from: 'vrm-badge', action: 'authLogin', email, password }, (r, muet) => {
      envoiEnVol = false;
      if (b) { b.disabled = false; b.textContent = 'Me connecter'; }
      try { if (p) p.value = ''; } catch (_) {}
      if (r && r.ok) { justeConnecte = true; changerCompte = false; formulaireDemande = false; modeCx = 'code'; rafraichir(); return; }
      if (muet) { direErreur('L’extension n’a pas répondu. Réessaie dans un instant.'); return; }
      if (r && r.captcha) { direErreur('VRM demande une vérification anti-robot que la carte ne sait pas afficher. Touche l’icône VRM dans les réglages de l’extension pour te connecter.'); return; }
      direErreur((r && r.error) || 'Connexion refusée.');
      try { if (p) p.focus(); } catch (_) {}
    });
  }
  // Google / Discord : seulement pour un fournisseur que Supabase dit activé.
  // Ordinateur : une petite fenêtre qui se ferme seule. Sans fenêtre (Orion) :
  // CET onglet part chez Google / Discord et revient sur cette page, connecté.
  function rendreFournisseurs() {
    const box = formulaireEl && formulaireEl.querySelector('[data-fournisseurs-carte]');
    if (!box) return;
    if (modeCx === 'saisie') { box.hidden = true; return; }
    if (!fournisseursDemandes) {
      fournisseursDemandes = true;
      try {
        chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'fournisseursConnexion' }, (r) => {
          let err = null; try { err = chrome.runtime.lastError; } catch (_) {}
          fournisseurs = !err && r && r.ok === true ? r : null;
          rendreFournisseurs();
        });
      } catch (_) { fournisseurs = null; }
      return;
    }
    const actifs = fournisseurs ? ['google', 'discord'].filter((f) => fournisseurs[f] === true) : [];
    box.setAttribute('data-fournisseurs', actifs.join(',') || 'aucun');
    box.setAttribute('data-oauth', etat && etat.oauthFenetre === true ? 'fenetre' : 'meme-onglet');
    if (!actifs.length) { box.hidden = true; return; }
    if (box.querySelector('[data-fournisseur]')) { box.hidden = false; return; }
    poserHtml(box, `<div class="ou"><span>ou</span></div>` + actifs.map((f) => `<button type="button" class="b sec fourn" data-fournisseur="${f}">${LOGO_FOURN[f]}<span>Continuer avec ${NOM_FOURN[f]}</span></button>`).join(''));
    box.querySelectorAll('[data-fournisseur]').forEach((el) => el.addEventListener('click', () => connexionFournisseur(el.getAttribute('data-fournisseur'))));
    box.hidden = false;
  }
  const URL_AUTORISE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/auth\/v1\/authorize\?provider=(google|discord)&/;
  function connexionFournisseur(f) {
    if (!NOM_FOURN[f] || envoiEnVol) return;
    const fenetre = !!(etat && etat.oauthFenetre === true);
    direErreur(''); direEtat(fenetre ? `Une petite fenêtre ${NOM_FOURN[f]} s’ouvre. Connecte-toi : elle se ferme toute seule.` : `Je t’emmène chez ${NOM_FOURN[f]}, dans cet onglet. Tu reviendras ici, connecté.`);
    demanderAuFond({ from: 'vrm-badge', action: 'oauthDepart', fournisseur: f }, (r, muet) => {
      if (muet || !r) { direEtat(''); direErreur('L’extension n’a pas répondu. Connecte-toi avec un code reçu par e-mail.'); return; }
      if (!r.ok) { direEtat(''); direErreur(r.message || 'La connexion n’a pas pu démarrer.'); return; }
      // Sans fenêtre : CET onglet navigue (jamais un onglet de plus, jamais window.open).
      if (r.memeOnglet && typeof r.url === 'string' && URL_AUTORISE.test(r.url) && r.url.split('?provider=')[1].startsWith(f + '&')) {
        if (CADRE) { direAuSite({ __vrmCarte: 'aller', url: r.url }); return; }   // c'est l'onglet du site qui part, pas le cadre
        try { location.assign(r.url); } catch (_) { direEtat(''); direErreur('La connexion n’a pas pu démarrer.'); }
      }
    });
  }
  // ══ 5.410 — LE LIEN DE L'APP (Julien, 20 nov. : « toute action doit être faite dans l'extension ») : VRM ouvre le site
  //    avec `?vrm=panneau&page=…&ids=…&action=…` (src/ouvrirPanneau.js `lienPanneau`, le même contrat) ⇒ le panneau
  //    s'ouvre sur la page, la sélection PRÉ-COCHÉE, l'action PRÉ-CHOISIE. Rien ne part : un geste qui écrit attend SA
  //    confirmation dans le panneau (la barre « Masquer N annonces ? », le récapitulatif des favoris…). Les paramètres
  //    `vrm*` sont retirés de l'adresse (un rechargement ne rouvre rien) ; ids : chiffres et tirets seulement, 50 au plus.
  // Le vocabulaire de l'app (src/actionsExtension.js du chantier actions-extension) ET celui du panneau : une page
  // inconnue ⇒ Accueil ; une action inconnue ⇒ aucune. Une action n'est jamais FAITE : elle est pré-choisie.
  const PAGES_LIEN = { articles: 'annonces', annonces: 'annonces', commandes: 'ventes', ventes: 'ventes', messagerie: 'messages', messages: 'messages', offres: 'messages', notifications: 'notifications', automatisations: 'automatisations', favoris: 'favoris', republier: 'annonces', prix: 'annonces', publier: 'annonces', vacances: 'parametres', accueil: 'accueil', parametres: 'parametres' };
  const ACTIONS_LIEN = ['baisser', 'changer', 'remettre', 'masquer', 'afficher', 'republier-direct', 'republier', 'mettre-en-ligne', 'brouillon', 'creer', 'deposer', 'publier', 'pause', 'supprimer', 'favoris', 'envoyer', 'ouvrir', 'offre', 'repondre', 'regler', 'vacances', 'relancer'];
  // L'action pré-choisie dans « Choisir une action » du tableau (seulement si ce geste y existe pour ce site).
  const ACTION_MENU = { baisser: 'baisser', changer: 'baisser', remettre: 'baisser', republier: 'republier', 'mettre-en-ligne': 'republier', brouillon: 'republier', masquer: 'masquer', afficher: 'afficher', favoris: 'favoris', envoyer: 'favoris' };
  function lireLienPanneau() {
    try {
      if (CADRE || LISTES || !/(^|\.)(vinted\.[a-z.]+|leboncoin\.fr|vestiairecollective\.com)$/i.test(String(location.hostname || ''))) return null;
      const p = new URLSearchParams(String(location.search || ''));
      if (p.get('vrm') !== 'panneau') return null;
      const page = PAGES_LIEN[String(p.get('page') || '').toLowerCase()] || 'accueil';
      const ids = String(p.get('ids') || '').split(',').map((x) => x.trim()).filter((x) => /^[\w-]{1,40}$/.test(x)).slice(0, 200);
      let action = String(p.get('action') || '').toLowerCase();
      if (!ACTIONS_LIEN.includes(action)) action = p.get('page') === 'republier' ? 'republier' : p.get('page') === 'prix' ? 'baisser' : '';
      try { for (const k of ['vrm', 'page', 'ids', 'action']) p.delete(k); const q = p.toString(); history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '') + location.hash); } catch (_) {}
      return { page, ids, action };
    } catch (_) { return null; }
  }
  const lienPanneau = lireLienPanneau();
  // 5.429 (`depotpanneau`) : « Déposer N sur Vinted » — les brouillons préparés dans VRM (vrm-depot.js, la vue ; le fond
  //    refait toutes les gardes). Absent (ancienne page, banc qui ne le charge pas) ⇒ rien n'est montré.
  // (`var` + fonction : lue par le rendu qui peut tourner AVANT cette ligne — jamais une zone morte temporelle, §4.6.)
  var _depotV;
  function depotVue() { if (_depotV === undefined) _depotV = !CADRE && !LISTES && globalThis.VRM_DEPOT ? globalThis.VRM_DEPOT.creer({ demander: (m, cb) => demanderAuFond(m, (r) => cb(r)), rendre: () => { try { if (carte.classList.contains('on')) rendre(); } catch (_) {} } }) : null; return _depotV; }
  if (lienPanneau) {
    ongletListe = lienPanneau.page;
    // Un lien « Déposer » porte des FICHES de l'app (jamais des annonces) : elles sont pré-cochées dans « Brouillons préparés ».
    if ((lienPanneau.action === 'deposer' || lienPanneau.action === 'creer') && depotVue()) depotVue().ouvrir(lienPanneau.ids);
    else if (lienPanneau.action === 'republier-direct' && lienPanneau.ids.length) { for (const id of lienPanneau.ids) annSel.add(id); setTimeout(() => { try { republierDirect6(lienPanneau.ids); } catch (_) {} }, 450); }
    else for (const id of lienPanneau.ids) annSel.add(id);
    if ((lienPanneau.action === 'masquer' || lienPanneau.action === 'afficher') && lienPanneau.ids.length && lienPanneau.ids.length <= 10) annConfirme = { k: lienPanneau.action, ids: lienPanneau.ids.slice() };
    // 5.432 (`prixpartout`) : « Changer le prix » d'une paire depuis l'app ⇒ la feuille du prix s'ouvre sur elle (ses autres
    //    sites lus par identité, « sur tous les sites » coché d'office) ; rien ne part avant SON « Lancer ».
    // 5.440.4 (25 nov.) : « Baisser » / « Remettre les prix » aussi — avant, l'action n'était que PRÉ-CHOISIE dans le menu, et
    //    re-choisir l'option déjà choisie ne déclenche rien : il fallait passer par une autre option. La feuille du prix
    //    s'ouvre donc sur la paire, comme « Changer » ; rien ne part avant SON « Revoir » puis « Lancer ».
    else if ((lienPanneau.action === 'changer' || lienPanneau.action === 'baisser' || lienPanneau.action === 'remettre') && lienPanneau.page === 'annonces' && lienPanneau.ids.length && lienPanneau.ids.length <= 20) { geste6 = { k: 'prix', ids: lienPanneau.ids.slice(0, 20), prix: {}, lien: true }; annActionPre = 'baisser'; }
    else if (ACTION_MENU[lienPanneau.action]) annActionPre = ACTION_MENU[lienPanneau.action];
    if (lienPanneau.page === 'favoris' && lienPanneau.ids.length === 1) filtreAnnonce = lienPanneau.ids[0];
    if (lienPanneau.action === 'vacances') hote.setAttribute('data-lien-vacances', '');   // 5.420 : la section « Mode vacances » de Paramètres
    // 5.425 : « Relancer » depuis Ventes de l'app ⇒ Commandes, filtre « À relancer » (rien ne part sans son toucher ici).
    if (lienPanneau.page === 'ventes' && lienPanneau.action === 'relancer') venFiltre = 'relancer';
    // (21 nov., ci-offres-panneau) La carte d'offre de l'app (`BoutonExtension action="offres" ids={[conv]}`) ouvre
    // CETTE conversation : son offre et la conversation dans le volet (avant : la page Messages sans rien de choisi).
    if (lienPanneau.page === 'messages' && lienPanneau.ids.length === 1 && /^\d{1,20}$/.test(lienPanneau.ids[0])) convChoisie = lienPanneau.ids[0];
    hote.setAttribute('data-lien-panneau', lienPanneau.page);
    setTimeout(() => { try { doigt = true; carte.classList.add('on'); rafraichir(); } catch (_) {} }, 400);
  }

  // 5.409 : Échap ferme le grand panneau (le ✕ aussi) ; jamais quand on tape dans un champ du site.
  try { document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && vxPlus && carte.classList.contains('on')) { vxPlus = false; ev.stopPropagation(); rendre(); return; } if (ev.key === 'Escape' && favFeuille && carte.classList.contains('on')) { favFeuille = null; vueFav = null; ev.stopPropagation(); rendre(); return; } if (ev.key === 'Escape' && carte.classList.contains('on') && carte.hasAttribute('data-grand')) { let dedans = false; try { dedans = ev.composedPath().includes(hote); } catch (_) {} const t = ev.target; let site = false; try { site = !dedans && !!(t && t.closest && t.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="dialog"],[aria-modal="true"]')); } catch (_) {} if (!site) fermerCarte(); } }, true); } catch (_) {}
  function ouvrirConnexion() { doigt = true; formulaireDemande = true; carte.classList.add('on'); rendre(); }
  function fermerCarte() { if (LISTES) return; if (carte.hasAttribute('data-grand')) oublierPanneau(); doigt = false; justeConnecte = false; vueFav = null; favErreur = ''; if (changerCompte) { changerCompte = false; formulaireDemande = false; rendre(); } carte.classList.remove('on'); }

  // ══ 5.410.2 — LE PANNEAU RESTE OUVERT, DANS LE MÊME ÉTAT, JUSQU'À SON × ═══════════════════════════════════════
  // Julien, 20 nov. : « parfois l'extension se ferme toute seule sur Vinted ». Mesuré au banc
  // (scripts/bancs/panneau-persistant.cjs) sur la 5.410.1 — quatre façons de le perdre :
  //  1. la PAGE retire l'hôte (Vinted / Next.js qui refait le document à une navigation ou à une hydratation
  //     ratée) : rien ne le remettait, la carte disparaissait jusqu'au rechargement ;
  //  2. une navigation pleine (un lien, « retour ») recharge ce script : l'état « ouvert » vivait en mémoire ⇒
  //     panneau fermé, page, sélection et défilement perdus ;
  //  3. le SURVOL du logo ouvrait le grand panneau et la sortie de la souris (vers la barre d'onglets) le
  //     refermait 180 ms après ;
  //  4. un toucher sur le voile autour du panneau (ou une page de Vinted) le fermait.
  // L'état (ouvert, page, sélection, fiche, conversation, défilement) est rangé PAR ONGLET par le fond
  // (`panneauEtat` : chrome.storage.session, il survit au service worker tué — §4.9), jamais dans la page.
  // Seuls son × et Échap (hors d'un champ ou d'une fenêtre du site) le ferment ; l'état est alors oublié.
  let panneauDernier = '', panneauMinut = null, defilARendre = null, defilJusque = 0;
  function etatPanneauVu() {
    const defil = {}; try { contenu.querySelectorAll('[data-defil]').forEach((el) => { if (el.scrollTop > 0) defil[el.getAttribute('data-defil')] = Math.round(el.scrollTop); }); } catch (_) {}
    return { ouvert: true, page: ongletListe, sel: [...annSel].slice(0, 200), selV: [...venSel].slice(0, 200), fiche: ficheOuverte || '', conv: convChoisie || '', defil };
  }
  function garderPanneau() {
    if (CADRE || LISTES || !carte.hasAttribute('data-grand') || !carte.classList.contains('on')) return;
    clearTimeout(panneauMinut);
    panneauMinut = setTimeout(() => {
      if (!carte.classList.contains('on')) return;
      const e = etatPanneauVu(), j = JSON.stringify(e);
      if (j === panneauDernier) return;
      panneauDernier = j;
      try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'panneauEtat', quoi: 'poser', etat: e }, () => { try { void chrome.runtime.lastError; } catch (_) {} }); } catch (_) {}
    }, 350);
  }
  function oublierPanneau() {
    clearTimeout(panneauMinut); panneauDernier = ''; defilARendre = null;
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'panneauEtat', quoi: 'fermer' }, () => { try { void chrome.runtime.lastError; } catch (_) {} }); } catch (_) {}
  }
  // Le défilement rangé se repose dès que la liste est assez longue pour lui (les listes arrivent après le 1er rendu).
  function reposerDefil() {
    if (!defilARendre) return;
    if (Date.now() > defilJusque) { defilARendre = null; return; }
    try { contenu.querySelectorAll('[data-defil]').forEach((el) => { const k = el.getAttribute('data-defil'), v = defilARendre[k]; if (v == null) return; if (el.scrollHeight - el.clientHeight >= v - 1) { el.scrollTop = v; delete defilARendre[k]; } }); } catch (_) {}
    if (!Object.keys(defilARendre).length) defilARendre = null;
  }
  function restaurerPanneau(et) {
    if (!et || et.ouvert !== true || CADRE || LISTES || lienPanneau) return;
    if (ONGLETS5.includes(et.page)) ongletListe = et.page;
    annSel = new Set((Array.isArray(et.sel) ? et.sel : []).map(String).filter((x) => /^[\w-]{1,40}$/.test(x)));
    venSel.clear(); for (const t of Array.isArray(et.selV) ? et.selV : []) if (/^\d{1,20}$/.test(String(t))) venSel.add(String(t));
    if (typeof et.fiche === 'string' && /^[av]:[\w-]{1,40}$/.test(et.fiche)) ficheOuverte = et.fiche;
    if (typeof et.conv === 'string' && /^[\w@:.-]{0,80}$/.test(et.conv)) convChoisie = et.conv;
    defilARendre = et.defil && typeof et.defil === 'object' ? Object.assign({}, et.defil) : null; defilJusque = Date.now() + 15000;
    hote.setAttribute('data-panneau-repris', et.page || '');
    doigt = true; carte.classList.add('on'); rafraichir();
  }
  if (!CADRE && !LISTES && !lienPanneau) {
    try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'panneauEtat', quoi: 'lire' }, (r) => { try { void chrome.runtime.lastError; } catch (_) {} if (r && r.ok && r.etat) restaurerPanneau(r.etat); }); } catch (_) {}
    try { contenu.addEventListener('scroll', garderPanneau, true); } catch (_) {}
  }
  // La page a retiré l'hôte ⇒ il revient tout de suite, au même endroit, panneau et défilement compris.
  function replacerHote() {
    if (hote.isConnected || CADRE || LISTES) return;
    if (!vivant()) return;
    let defil = null; try { defil = panneauDernier ? JSON.parse(panneauDernier).defil : null; } catch (_) {}
    try { (document.documentElement || document.body).appendChild(hote); } catch (_) { return; }
    hote.setAttribute('data-replace', String((Number(hote.getAttribute('data-replace')) || 0) + 1));
    if (defil && carte.classList.contains('on')) { defilARendre = defil; defilJusque = Date.now() + 15000; reposerDefil(); }
  }
  if (!CADRE && !LISTES) setInterval(() => { if (!vivant()) { try { hote.remove(); } catch (_) {} return; } replacerHote(); }, 1000);

  // ══ 5.351 (lot extension-visuel) : DÉPLACER, RÉDUIRE, TEINTE ══
  // (5.376 : la carte n'ouvre plus VRM — « Colis · Messages · Offres » sont retirés.)
  // Le logo se GLISSE où il gêne le moins (souris ou doigt) et retient sa place
  // PAR SITE (`vrmBadgePos`, ce navigateur) ; il se RÉDUIT en pastille
  // (`vrmBadgeMini`). La carte s'ouvre du côté où il y a la place. Rien n'est
  // envoyé nulle part : le stockage local de l'extension.
  let detailOuvert = false, mini = false, posPerso = null, modeApparence = null, vientDeGlisser = false, glisse = null;
  const CLE_SITE = (() => { const h = String(location.hostname || ''); return /vinted\./.test(h) ? 'vinted' : /leboncoin\./.test(h) ? 'leboncoin' : /ebay\./.test(h) ? 'ebay' : /vestiairecollective\./.test(h) ? 'vestiaire' : 'autre'; })();
  // 5.371 : au téléphone le logo est plus petit (38 px) — la taille LUE, jamais supposée.
  const taille = () => { const w = btn && btn.offsetWidth; return w > 0 ? w : (mini ? 30 : 44); };
  const borne = (x, min, max) => Math.max(min, Math.min(max, x));
  // ══ 5.371 (Julien, 12 nov., capture Orion sur Vestiaire : le logo cachait
  //    l'onglet « Moi » de la barre du bas) : LE LOGO NE RECOUVRE JAMAIS UNE BARRE
  //    FIXE DU SITE. Les éléments `position: fixed/sticky` larges (> 30 % de
  //    l'écran, < 40 % de sa hauteur) présents dans la zone du logo (+ 12 px) le
  //    repoussent : au-dessus d'une barre du bas, sous une barre du haut (marge
  //    12 px), et jamais sous la zone sûre de l'iPhone (`safe-area-inset-bottom`).
  //    La place CHOISIE (glissée) reste rangée telle quelle ; seul l'affichage se
  //    décale. Recalculé au redimensionnement, au défilement et quand la page
  //    change (une mesure par image au plus, jamais en boucle : nos propres
  //    changements de style ne sont pas observés).
  const MARGE_BARRE = 12;
  const sonde = document.createElement('i');
  sonde.setAttribute('aria-hidden', 'true');
  sonde.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom, 0px);padding-top:env(safe-area-inset-top, 0px);';
  ombre.appendChild(sonde);
  const zoneSure = () => { try { const c = getComputedStyle(sonde); return { bas: parseFloat(c.paddingBottom) || 0, haut: parseFloat(c.paddingTop) || 0 }; } catch (_) { return { bas: 0, haut: 0 }; } };
  function barresDans(x0, y0, x1, y1) {
    const W = window.innerWidth || 1024, H = window.innerHeight || 768;
    const pts = [];
    for (const fx of [0.05, 0.5, 0.95]) for (const fy of [0.05, 0.5, 0.95]) pts.push([x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy]);
    const vus = new Set(), barres = [];
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      let els = []; try { els = document.elementsFromPoint(x, y); } catch (_) { els = []; }
      for (const el of els) {
        if (el === hote || el === document.documentElement || el === document.body) continue;
        for (let n = el, i = 0; n && n !== document.documentElement && n !== document.body && i < 15; n = n.parentElement, i++) {
          if (n === hote) break;
          if (vus.has(n)) break;
          let cs = null; try { cs = getComputedStyle(n); } catch (_) { cs = null; }
          if (!cs || (cs.position !== 'fixed' && cs.position !== 'sticky')) continue;
          vus.add(n);
          const r = n.getBoundingClientRect();
          if (cs.visibility !== 'hidden' && cs.display !== 'none' && (parseFloat(cs.opacity) || 0) > 0.05 && r.width >= W * 0.3 && r.height > 0 && r.height < H * 0.4) barres.push(r);
          break;
        }
      }
    }
    return barres;
  }
  let decalBarre = 0;   // ce que les barres ont ajouté au `bottom` (mesuré)
  function eviterBarres(rr, bb) {
    const W = window.innerWidth || 1024, H = window.innerHeight || 768, t = taille();
    const sur = zoneSure();
    let b = Math.max(bb, 8 + sur.bas);
    for (let i = 0; i < 4; i++) {
      const gauche = W - rr - t, haut = H - b - t;
      const barres = barresDans(gauche - MARGE_BARRE, haut - MARGE_BARRE, gauche + t + MARGE_BARRE, haut + t + MARGE_BARRE);
      if (!barres.length) break;
      let nb = b;
      for (const r of barres) {
        const centreBarre = (r.top + r.bottom) / 2, centreLogo = haut + t / 2;
        if (centreBarre >= centreLogo || r.bottom >= H - 2) nb = Math.max(nb, Math.ceil(H - r.top + MARGE_BARRE));   // barre du bas : au-dessus
        else nb = Math.min(nb, Math.floor(H - (r.bottom + MARGE_BARRE) - t));                                         // barre du haut : en dessous
      }
      nb = borne(nb, 8 + sur.bas, Math.max(8, H - t - 8 - sur.haut));
      if (nb === b) break;
      b = nb;
    }
    return b;
  }
  function placer(r, b) {
    if (CADRE || LISTES) return;
    const W = window.innerWidth || 1024, H = window.innerHeight || 768, t = taille();
    const rr = borne(Math.round(r), 8, Math.max(8, W - t - 8)), bb = borne(Math.round(b), 8, Math.max(8, H - t - 8));
    // Pendant un glisser, le logo suit le doigt ; il s'écarte des barres une fois posé.
    const affiche = glisse ? bb : eviterBarres(rr, bb);
    decalBarre = affiche - bb;
    hote.style.setProperty('right', rr + 'px'); hote.style.setProperty('bottom', affiche + 'px');
    if (decalBarre) hote.setAttribute('data-evite-barre', String(decalBarre)); else hote.removeAttribute('data-evite-barre');
    // La carte s'ouvre vers le bas si le logo est dans la moitié haute, vers la droite s'il est à gauche.
    if (H - affiche - t < H / 2) hote.setAttribute('data-haut', ''); else hote.removeAttribute('data-haut');
    if (W - rr - t / 2 < W / 2) hote.setAttribute('data-gauche', ''); else hote.removeAttribute('data-gauche');
    return { r: rr, b: bb };
  }
  const ranger = (o) => { try { chrome.storage.local.set(o); } catch (_) {} };
  function enregistrerPlace(p) {
    posPerso = p;
    try { chrome.storage.local.get('vrmBadgePos', (g) => { let m = {}; try { m = Object.assign({}, (g && g.vrmBadgePos) || {}); } catch (_) {} if (p) m[CLE_SITE] = p; else delete m[CLE_SITE]; ranger({ vrmBadgePos: m }); }); } catch (_) {}
  }
  function remettreEnPlace() { placer(16, 16); enregistrerPlace(null); }
  function poserMini(oui) {
    mini = !!oui;
    if (mini) hote.setAttribute('data-mini', ''); else hote.removeAttribute('data-mini');
    placer(posPerso ? posPerso.r : 16, posPerso ? posPerso.b : 16);
    ranger({ vrmBadgeMini: mini });
  }
  // La teinte : celle choisie dans VRM (clair, sombre, le soir) ; « automatique »
  // ou pas su ⇒ le système, comme avant.
  function appliquerTeinte() {
    const m = modeApparence;
    let t = '';
    if (m === 'sombre' || m === 'clair') t = m;
    else if (m === 'soir') { const h = new Date().getHours(); t = h >= 19 || h < 7 ? 'sombre' : 'clair'; }
    if (t) hote.setAttribute('data-theme', t); else hote.removeAttribute('data-theme');
  }
  try {
    chrome.storage.local.get(['vrmApparence', 'vrmBadgePos', 'vrmBadgeMini'], (g) => {
      try { if (chrome.runtime.lastError) return; } catch (_) { return; }
      g = g || {};
      if (['clair', 'sombre', 'auto', 'soir'].includes(g.vrmApparence)) { modeApparence = g.vrmApparence; appliquerTeinte(); }
      if (g.vrmBadgeMini === true) { mini = true; hote.setAttribute('data-mini', ''); }
      const p = g.vrmBadgePos && g.vrmBadgePos[CLE_SITE];
      if (p && Number.isFinite(Number(p.r)) && Number.isFinite(Number(p.b))) posPerso = placer(Number(p.r), Number(p.b));
      else placer(16, 16);
      if (etat) rendre();
    });
  } catch (_) {}
  // 5.371 : une mesure par image au plus (redimensionnement, défilement, page qui change).
  let replacerDemande = false;
  const replacerLogo = () => {
    if (CADRE || replacerDemande || glisse) return;
    replacerDemande = true;
    const go = () => { replacerDemande = false; if (glisse) return; if (posPerso) placer(posPerso.r, posPerso.b); else placer(16, 16); };
    try { requestAnimationFrame(go); } catch (_) { setTimeout(go, 16); }
  };
  try { window.addEventListener('resize', replacerLogo); } catch (_) {}
  try { window.addEventListener('scroll', replacerLogo, { passive: true }); } catch (_) {}
  try { if (window.visualViewport) window.visualViewport.addEventListener('resize', replacerLogo); } catch (_) {}
  try {
    let minut = null;
    const mo = new MutationObserver(() => { if (!hote.isConnected) replacerHote(); if (minut) return; minut = setTimeout(() => { minut = null; replacerLogo(); }, 300); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
  setTimeout(replacerLogo, 600); setTimeout(replacerLogo, 2000);   // les barres posées après le premier rendu du site
  // Glisser : au-delà de 6 px, c'est un déplacement (le clic qui suit est mangé) ;
  // en deçà, c'est un clic comme avant.
  btn.addEventListener('pointerdown', (ev) => {
    if (CADRE || (ev.button != null && ev.button > 0)) return;
    const r = hote.getBoundingClientRect();
    glisse = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, r0: (window.innerWidth || 0) - r.right, b0: (window.innerHeight || 0) - r.bottom, bouge: false };
    try { btn.setPointerCapture(ev.pointerId); } catch (_) {}
  });
  btn.addEventListener('pointermove', (ev) => {
    if (!glisse || ev.pointerId !== glisse.id) return;
    const dx = ev.clientX - glisse.x, dy = ev.clientY - glisse.y;
    if (!glisse.bouge && Math.hypot(dx, dy) < 6) return;
    if (!glisse.bouge) { glisse.bouge = true; btn.classList.add('glisse'); clearTimeout(minuteur); carte.classList.remove('on'); }
    glisse.p = placer(glisse.r0 - dx, glisse.b0 - dy);
  });
  const finGlisse = (ev) => {
    if (!glisse || (ev && ev.pointerId !== glisse.id)) return;
    const g = glisse; glisse = null;
    btn.classList.remove('glisse');
    try { btn.releasePointerCapture(g.id); } catch (_) {}
    if (g.bouge && g.p) { vientDeGlisser = true; enregistrerPlace(g.p); setTimeout(() => { vientDeGlisser = false; }, 350); }
    replacerLogo();   // 5.371 : posé sur une barre du site ⇒ il s'écarte (sa place choisie reste rangée)
  };
  btn.addEventListener('pointerup', finGlisse);
  btn.addEventListener('pointercancel', finGlisse);

  btn.addEventListener('click', async () => {
    if (vientDeGlisser) { vientDeGlisser = false; return; }   // c'était un déplacement, pas un clic
    cacherCapte('carte');   // 5.377 : la carte s'ouvre, le petit message s'efface
    // Au doigt : toucher le logo ouvre (ou referme) la carte — c'est elle qui
    // porte le geste « Ouvrir VRM », et le moyen de revenir sur un « Non ».
    if (auDoigt()) {
      if (carte.classList.contains('on')) { fermerCarte(); return; }
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
      // 5.376 (Julien, 14 nov. : « ça n'ouvre pas VRM s'il te plaît ») : un clic sur le
      // logo ÉPINGLE la carte (elle ne se ferme plus au survol) — jamais VRM. VRM reste
      // à un clic de l'icône de l'extension, dans la barre du navigateur.
      if (doigt && carte.classList.contains('on')) { fermerCarte(); return; }
      doigt = true; carte.classList.add('on'); rendre();
      return;
    }
    // ⚠️ 8 nov. (5.328, Julien sur Orion : « "Se connecter" change de page VRM
    //    et ça ne se connecte pas ») : pas connecté, le logo ouvre la carte AVEC
    //    le formulaire (e-mail + mot de passe VRM, dessiné dans la carte en
    //    5.329 ; Google / Discord seulement en petite fenêtre). Aucun onglet.
    //    (11 octobre, retiré : le logo ouvrait VRM, qui adressait sa session.)
    ouvrirConnexion();
  }
  // Le type d'entrée du DERNIER geste (souris, doigt, stylet) : c'est lui qui
  // décide, pas la taille de l'écran (un portable tactile garde sa souris).
  hote.addEventListener('pointerdown', (e) => { dernierPointeur = String(e.pointerType || ''); }, true);
  // La carte d'état au SURVOL — à la souris seulement : au doigt, un toucher
  // déclenche aussi `pointerenter`, et la carte s'ouvrirait puis se fermerait
  // au même geste.
  let minuteur = null;
  hote.addEventListener('pointerenter', (e) => {
    if (CADRE || (e.pointerType && e.pointerType !== 'mouse')) return;
    if (question.classList.contains('on')) return;
    // 5.410.2 : le GRAND panneau ne s'ouvre pas au simple survol (il couvrait l'écran puis se refermait dès que la
    // souris sortait de la fenêtre : « il se ferme tout seul ») — un clic sur le logo l'ouvre, son × le ferme.
    if (carte.hasAttribute('data-grand') && !carte.classList.contains('on')) return;
    // 22 nov. (audit) : le grand panneau DÉJÀ ouvert n'a rien à ouvrir — la souris qui revient dessus (depuis la barre
    //    d'onglets, une autre fenêtre) relançait une lecture d'état et un rendu complet à chaque passage.
    if (carte.hasAttribute('data-grand')) return;
    // 5.377 : la souris sur le petit message n'ouvre pas la carte (elle le garderait affiché).
    if (!capteEl.hidden) { const r = capteEl.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return; }
    cacherCapte('carte');
    clearTimeout(minuteur);
    doigt = false;
    rafraichir();
    carte.classList.add('on');
  });
  hote.addEventListener('pointerleave', (e) => {
    if (CADRE || (e.pointerType && e.pointerType !== 'mouse')) return;
    if (doigt || !connexion.hidden) return;             // un formulaire ouvert ne se ferme pas au survol
    if (carte.hasAttribute('data-grand')) return;        // 5.410.2 : le grand panneau ne se ferme QUE par son ×
    clearTimeout(minuteur); minuteur = setTimeout(() => carte.classList.remove('on'), 180);
  });
  // Au doigt, toucher ailleurs dans la page referme la carte (sans rien cliquer
  // à sa place : on n'empêche pas le geste du site).
  document.addEventListener('pointerdown', (e) => {
    if (CADRE || !carte.classList.contains('on')) return;
    if (carte.hasAttribute('data-grand')) return;        // 5.410.2 : un clic sur le voile, sur la page : le panneau reste
    let dedans = false; try { dedans = e.composedPath().includes(hote); } catch (_) {}
    if (!dedans) fermerCarte();
  }, true);

  // Une connexion réussie, un envoi noté, une bascule : la carte suit, sans
  // interroger qui que ce soit en boucle.
  try {
    chrome.storage.onChanged.addListener((ch, zone) => {
      if (zone !== 'local') return;
      // 5.329 : Google / Discord dans la petite fenêtre — un refus est dit dans la carte.
      const o = ch.vrmOAuthEtat && ch.vrmOAuthEtat.newValue;
      if (o && o.etat === 'erreur' && formulaireEl) { direEtat(''); direErreur(o.message || 'La connexion n’a pas abouti.'); }
      if (ch.vrmApparence) { const m = ch.vrmApparence.newValue; modeApparence = ['clair', 'sombre', 'auto', 'soir'].includes(m) ? m : null; appliquerTeinte(); }
      if (ch.vrmFavorisCarte || ch.vrmFavorisApercu || ch.vrmPauseVinted || ch.vrmFreinRepub || ch.vrmSession || ch.vrmFlux || ch.vrmVcCapte || ch.vrmBascule || ch.vrmLbcCompte || ch.vrmChoixComptes || ch.vrmLoginsVus || ch.vrmLogins) rafraichir();
    });
  } catch (_) {}
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { appliquerTeinte(); rafraichir(); } });


  // ══ 5.377 — « VRM A CAPTÉ » : LE PETIT MESSAGE PRÈS DU LOGO ══════════════════
  // Julien : « on a un petit popup qui dit que l'extension a capté ça ». Le fond
  // (background.js `annoncerCapte`) a compté, PAR IDENTITÉ, ce qu'une écriture
  // réussie vient de ranger pour le compte de CET onglet ; ici on le dit, une fois :
  //   · « VRM a capté · shop_x » puis « 2 nouvelles ventes · 1 bordereau » ; à la
  //     connexion « Compte relié · shop_x » puis « 14 annonces · 3 ventes lues » ;
  //   · « Voir » ouvre la page du SITE (Mes ventes, Messages, dressing) — jamais VRM ;
  //   · il part seul après ~6 s, se ferme d'un toucher (× de 44 px, ou la bulle),
  //     ne recouvre JAMAIS un bouton ni un lien du site (mesuré à l'affichage, sinon
  //     il attend), jamais par-dessus la carte ouverte ; montré ⇒ noté vu (`capteVu`),
  //     il ne revient pas ;
  //   · rien de nouveau, lecture ratée, réglage coupé ⇒ rien (jamais « 0 »).
  // Aucune requête : le stockage de l'extension seulement (Chrome, Edge, Firefox, Orion).
  const capteEl = ombre.querySelector('.capte');
  const CAPTE_NOMS = {
    ventes: ['nouvelle vente', 'nouvelles ventes', 'vente', 'ventes', 'f'], achats: ['nouvel achat', 'nouveaux achats', 'achat', 'achats', 'm'],
    bordereaux: ['bordereau', 'bordereaux', 'bordereau', 'bordereaux', 'm'], codes: ['code de retrait', 'codes de retrait', 'code de retrait', 'codes de retrait', 'm'],
    versements: ['date de versement', 'dates de versement', 'date de versement', 'dates de versement', 'f'], messages: ['message', 'messages', 'message', 'messages', 'm'],
    offres: ['offre reçue', 'offres reçues', 'offre', 'offres', 'f'], annonces: ['nouvelle annonce', 'nouvelles annonces', 'annonce', 'annonces', 'f'],
  };
  // 5.379 : « VRM a numéroté · 3 paires » (ou « articles », le profil du vendeur, vrm-mots.js).
  const nomsNumerotes = () => { const m = (globalThis.VRM_MOTS ? globalThis.VRM_MOTS.mots() : null) || { nom: 'paire', noms: 'paires', e: 'e' }; const e = m.e || ''; return [`${m.nom} numéroté${e}`, `${m.noms} numéroté${e}s`, `${m.nom} numéroté${e}`, `${m.noms} numéroté${e}s`, e ? 'f' : 'm']; };
  const CAPTE_ORDRE = ['numerotes', 'ventes', 'achats', 'bordereaux', 'codes', 'versements', 'messages', 'offres', 'annonces'];
  const CAPTE_DUREE = 6000;
  let capteMontre = null, capteMinuteur = null, capteEssais = 0, capteDemande = false, capteSurvol = false;
  const nbCapte = (n) => Number(n).toLocaleString('fr-FR');
  function phrasesCapte(l) {
    const parts = [];
    let dernier = null;
    for (const s of CAPTE_ORDRE) {
      const n = Number((l.n || {})[s]) || 0;
      const nom = s === 'numerotes' ? nomsNumerotes() : CAPTE_NOMS[s];
      if (!(n > 0) || !nom) continue;     // jamais « 0 »
      parts.push({ s, n, t: `${nbCapte(n)} ${l.relie ? (n > 1 ? nom[3] : nom[2]) : (n > 1 ? nom[1] : nom[0])}` });
      dernier = { n, g: nom[4] };
    }
    if (!parts.length) return null;
    if (l.relie && dernier) parts[parts.length - 1].t += ' ' + (dernier.g === 'f' ? (dernier.n > 1 ? 'lues' : 'lue') : (dernier.n > 1 ? 'lus' : 'lu'));
    // 5.379 : un lot qui ne porte QUE des N° donnés par VRM se dit « VRM a numéroté ».
    const titre = l.relie ? 'Compte relié' : parts.every((p) => p.s === 'numerotes') ? 'VRM a numéroté' : 'VRM a capté';
    return { titre, ligne: parts.map((p) => p.t).join(' · '), parts };
  }
  const INTERACTIF = 'a[href],button,input,select,textarea,summary,label,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[onclick],[tabindex]:not([tabindex="-1"])';
  // Un bouton ou un lien du site sous ce rectangle ? (on regarde SOUS la carte : notre hôte est sauté)
  function couvreUnBouton(r) {
    const W = window.innerWidth || 1024, H = window.innerHeight || 768;
    if (r.left < 0 || r.top < 0 || r.right > W || r.bottom > H) return true;
    // Une grille serrée (tous les 10 px, bords compris) : un bouton de 24 px ne passe pas entre deux points.
    const xs = [], ys = [];
    for (let x = r.left + 2; x < r.right - 1; x += 10) xs.push(x); xs.push(r.right - 2);
    for (let y = r.top + 2; y < r.bottom - 1; y += 10) ys.push(y); ys.push(r.bottom - 2);
    for (const x of xs) for (const y of ys) {
      let els = []; try { els = document.elementsFromPoint(x, y); } catch (_) { els = []; }
      const sous = els.find((el) => el !== hote && el !== document.documentElement && el !== document.body);
      if (!sous) continue;
      let cible = null; try { cible = sous.closest(INTERACTIF); } catch (_) { cible = null; }
      if (cible && cible !== document.body) { const cs = getComputedStyle(cible); if (cs.visibility !== 'hidden' && cs.display !== 'none' && (parseFloat(cs.opacity) || 0) > 0.05) return true; }
    }
    return false;
  }
  // Les places possibles, autour du logo (au-dessus, à côté, en dessous) : la première libre.
  function placerCapte() {
    const haut = hote.hasAttribute('data-haut'), gauche = hote.hasAttribute('data-gauche');
    const t = taille() + 10;
    const places = [
      haut ? { top: t + 'px' } : { bottom: t + 'px' },
      Object.assign(gauche ? { left: t + 'px' } : { right: t + 'px' }, haut ? { top: '0px' } : { bottom: '0px' }),
      haut ? { bottom: t + 'px' } : { top: t + 'px' },
    ];
    capteEl.style.visibility = 'hidden'; capteEl.hidden = false;
    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      for (const k of ['top', 'bottom', 'left', 'right']) capteEl.style.removeProperty(k);
      if (p.left == null && p.right == null) capteEl.style.setProperty(gauche ? 'left' : 'right', '0px');
      for (const k of Object.keys(p)) capteEl.style.setProperty(k, p[k]);
      if (!couvreUnBouton(capteEl.getBoundingClientRect())) { capteEl.setAttribute('data-capte-place', String(i)); capteEl.style.visibility = ''; return true; }
    }
    capteEl.hidden = true; capteEl.style.visibility = '';
    return false;
  }
  function cacherCapte(raison) {
    clearTimeout(capteMinuteur); capteMinuteur = null;
    if (capteEl.hidden) { capteMontre = null; return; }
    capteEl.setAttribute('data-capte-fin', raison || 'seul');
    capteEl.classList.remove('on');
    capteEl.hidden = true;
    capteMontre = null;
  }
  function minuterCapte() { clearTimeout(capteMinuteur); capteMinuteur = setTimeout(() => { if (capteSurvol) { minuterCapte(); return; } cacherCapte('seul'); }, CAPTE_DUREE); }
  function dessinerCapte(l) {
    const ph = phrasesCapte(l);
    if (!ph) return false;
    let voir = '';
    try { const u = new URL(String(l.voir || '')); if (u.protocol === 'https:' && u.origin === ORIGINE_ICI) voir = u.href; } catch (_) {}
    const nom = l.nom ? ` · <span class="capte-nom">${esc(l.nom)}</span>` : '';
    poserHtml(capteEl, `<div class="capte-t">${esc(ph.titre)}${nom}</div><div class="capte-r"><div class="capte-l" data-capte-ligne>${ph.parts.map((p) => `<span class="seg">${esc(p.t)}</span>`).join(' · ')}</div>${voir ? `<a class="capte-voir" data-capte-voir href="${esc(voir)}" target="_top">Voir<i aria-hidden="true"></i></a>` : ''}</div><button class="capte-x" type="button" data-capte-fermer aria-label="Fermer">×</button>`);
    capteEl.setAttribute('data-capte-lot', String(l.lot || ''));
    capteEl.setAttribute('data-capte-relie', l.relie ? '1' : '0');
    for (const p of ph.parts) capteEl.setAttribute('data-capte-' + p.s, String(p.n));
    const x = capteEl.querySelector('[data-capte-fermer]');
    if (x) x.addEventListener('click', (ev) => { ev.stopPropagation(); cacherCapte('fermer'); });
    const v = capteEl.querySelector('[data-capte-voir]');
    if (v) v.addEventListener('click', (ev) => { ev.stopPropagation(); cacherCapte('voir'); });
    return true;
  }
  function demanderCapte() {
    if (CADRE || LISTES || !vivant() || capteDemande || document.visibilityState !== 'visible') return;
    if (carte.classList.contains('on') || question.classList.contains('on')) return;   // jamais par-dessus la carte
    capteDemande = true;
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'capteLot' }, (r) => {
        void chrome.runtime.lastError;
        capteDemande = false;
        const l = r && r.ok && r.lot;
        if (!l || !l.lot || (capteMontre && capteMontre.lot === l.lot)) return;
        if (carte.classList.contains('on') || question.classList.contains('on')) return;
        // Un popup encore affiché pour le MÊME compte : ce qui arrive s'y ajoute.
        const fusion = !!(capteMontre && capteMontre.compte === l.compte && capteMontre.p === l.p);
        const vue = Object.assign({}, l, { n: Object.assign({}, fusion ? capteMontre.n : l.n) }, fusion ? { relie: !!(l.relie || capteMontre.relie), voir: capteMontre.voir || l.voir } : {});
        if (fusion) for (const s of Object.keys(l.n || {})) vue.n[s] = (Number(vue.n[s]) || 0) + (Number(l.n[s]) || 0);
        if (!dessinerCapte(vue)) return;
        if (!placerCapte()) {
          // Pas de place libre (un bouton du site partout autour) : on réessaie un peu plus tard.
          if (capteEssais++ < 4) setTimeout(demanderCapte, 1500);
          return;
        }
        capteEssais = 0;
        capteMontre = vue;
        capteEl.classList.add('on');
        try { chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'capteVu', lot: l.lot }, () => { void chrome.runtime.lastError; }); } catch (_) {}
        minuterCapte();
      });
    } catch (_) { capteDemande = false; }
  }
  if (!CADRE && !LISTES) {
    capteEl.addEventListener('click', () => cacherCapte('toucher'));
    capteEl.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') capteSurvol = true; });
    capteEl.addEventListener('pointerleave', () => { capteSurvol = false; });
    try { chrome.storage.onChanged.addListener((ch, zone) => { if (zone === 'local' && (ch.vrmCapteLots || ch.vrmCapteReglage)) setTimeout(demanderCapte, 250); }); } catch (_) {}
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(demanderCapte, 600); });
    setTimeout(demanderCapte, 1200);
  }

  // ══ 5.410.5 — UNE VÉRIFICATION DE VINTED AFFICHÉE : LE PANNEAU S'ÉCARTE (capture de Julien, 20 nov. 22:29) ══════
  // Quel que soit le moteur (favoris, republication, offres, baisse…), dès qu'une vérification est PRÉSENTE dans la page
  // (iframe DataDome / captcha — la même liste que l'écran plein, vrm-action.js), le grand panneau et la carte se replient
  // en une pastille en haut à droite, qui ne recouvre pas le centre de la vérification. La pastille rouvre le panneau (SON
  // toucher). La vérification disparue : « Vérification faite — Reprendre ? » — rien ne repart seul, « Reprendre » reste
  // le bouton du panneau. On ne regarde que la PRÉSENCE de l'élément, jamais son contenu ; rien n'est cliqué dedans.
  if (!CADRE && !LISTES) {
    const SEL_VERIF_PAGE = 'iframe[src*="captcha-delivery"], iframe[src*="datadome"], #datadome-captcha, iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare"]';
    const pastilleV = ombre.querySelector('[data-verif-pastille]');
    let etatV = '', ouvertMalgre = false, minuteV = null;
    const verifPresente = () => { try { const el = vrmVerifVisible(SEL_VERIF_PAGE); return !!(el && !hote.contains(el)); } catch (_) { return false; } };
    const placerV = () => {
      // La carte de l'écran plein (vrm-action.js) se met déjà en haut au centre : la pastille passe dessous si elles se croisent.
      let bas = 0; try { const a = document.getElementById('vrm-action'); bas = a && a.style.display !== 'none' ? Number(a.getAttribute('data-cote-bas')) || 0 : 0; } catch (_) {}
      pastilleV.style.setProperty('--verif-haut', (window.innerWidth < 900 && bas > 0 ? Math.round(bas + 8) : 12) + 'px');
    };
    const poserV = (e) => {
      etatV = e;
      if (!e) { pastilleV.hidden = true; hote.removeAttribute('data-verif-replie'); pastilleV.removeAttribute('data-verif'); return; }
      // Le bandeau de l'écran d'action dit déjà la phrase ? La pastille ne la redit pas (une phrase, une fois) : « Ouvrir VRM ».
      let bandeau = false; try { const a = document.getElementById('vrm-action'); bandeau = !!(a && a.style.display !== 'none' && a.hasAttribute('data-cote-bas')); } catch (_) {}
      const t = e === 'page' ? (bandeau ? TU('a_ouvrir_vrm') : TU('a_verif_page')) : TU('a_verif_faite_q');
      pastilleV.replaceChildren(); const pv = document.createElement('span'); pv.className = 'pv'; pv.setAttribute('aria-hidden', 'true'); const tx = document.createElement('span'); tx.textContent = t; pastilleV.append(pv, tx);
      pastilleV.setAttribute('data-verif', e); pastilleV.setAttribute('aria-label', t + ' · ' + TU('a_ouvrir_vrm'));
      pastilleV.hidden = false; hote.setAttribute('data-verif-replie', e); placerV();
    };
    const regarderV = () => {
      minuteV = null;
      const la = verifPresente();
      if (la) { if (!ouvertMalgre && etatV !== 'page') poserV('page'); else if (etatV === 'page') poserV('page'); }
      else if (etatV === 'page') poserV('faite');                 // disparue : on le DIT, on ne relance rien
      else if (ouvertMalgre && !la) ouvertMalgre = false;          // une prochaine vérification repliera à nouveau
    };
    const bientotV = () => { if (!minuteV) minuteV = setTimeout(regarderV, 200); };
    pastilleV.addEventListener('click', () => {
      ouvertMalgre = etatV === 'page';
      poserV('');
      try { doigt = true; carte.classList.add('on'); rendre(); } catch (_) {}
    });
    try { new MutationObserver(bientotV).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'id', 'data-cote-bas'] }); } catch (_) {}
    window.addEventListener('resize', () => { if (etatV) placerV(); });
    setTimeout(regarderV, 300);
    globalThis.__vrmBadgeVerif = () => ({ etat: etatV, replie: hote.hasAttribute('data-verif-replie') });   // pour les bancs (lecture seule)
  }

  (CADRE || LISTES ? (document.body || document.documentElement) : (document.documentElement || document.body)).appendChild(hote);
  rafraichir();
})();
