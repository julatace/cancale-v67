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
(() => {
  // 5.332 (défaut #6, décision de Julien du 9 nov.) : sur Chrome / Edge /
  // Firefox, le formulaire de connexion vit dans un IFRAME de l'extension
  // (`popup.html?mode=carte`) — l'origine de l'extension, que la page du site ne
  // peut ni lire ni écouter (ses écouteurs de clavier, même posés en capture
  // AVANT nous, n'entendent rien). Cette page-là charge CE fichier en mode
  // « cadre » (`__vrmCadre`, posé par popup.js — une variable que la page d'un
  // site ne peut pas écrire dans le monde de l'extension) : le formulaire seul,
  // sans logo ni état (la carte du site les montre).
  const CADRE = (() => { try { return globalThis.__vrmCadre === true && window.top !== window; } catch (_) { return false; } })();
  const MDP_PERMIS = CADRE;   // 5.362 (moyenne 69) : le mot de passe seulement dans l'iframe de l'extension
  if (window.top !== window && !CADRE) return;       // une seule carte par onglet
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
  hote.style.cssText = CADRE ? 'all:initial;display:block;' : 'all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483646;';
  const ombre = hote.attachShadow({ mode: 'closed' });
  ombre.innerHTML = `
<style>
  /* 5.328 — les jetons de l’app (--d-*, DESIGN.md) : style Apple, police
     système, UN accent bleu rare (#0071E3 / #0A84FF), ambre = un geste, jamais
     violet ; verre clair et sombre qui suivent le système ; rayons 12 / 14. */
  :host { all: initial;
    --fond: #000000; --carte: #1C1C1E; --bord: rgba(84,84,88,.6); --filet: rgba(84,84,88,.45); --texte: #F5F5F7; --doux: #98989D; --pale: #8E8E93;
    --accent: #0A84FF; --ambre: #FF9F0A; --survol: rgba(118,118,128,.24); --remplir: rgba(118,118,128,.24); --verre: rgba(28,28,30,.92);
    --champ: rgba(118,118,128,.24); --anneau: rgba(10,132,255,.35);
    --ombre: 0 0 0 .5px rgba(255,255,255,.08), 0 24px 56px rgba(0,0,0,.6); }
  /* 5.351 : la teinte CHOISIE dans VRM (Réglages → Apparence, recopiée par le pont
     de vrm.center : data-theme sur l'hôte) passe avant celle du système ; sans
     choix connu, le système décide, comme avant. */
  @media (prefers-color-scheme: light) {
    :host(:not([data-theme="sombre"])) { --carte: #FFFFFF; --bord: rgba(60,60,67,.18); --filet: rgba(60,60,67,.14); --texte: #1D1D1F; --doux: #6E6E73; --pale: #8E8E93;
      --accent: #0071E3; --ambre: #B25000; --survol: rgba(118,118,128,.12); --remplir: rgba(118,118,128,.12); --verre: rgba(255,255,255,.88);
      --champ: #FFFFFF; --anneau: rgba(0,113,227,.25);
      --ombre: 0 6px 16px rgba(0,0,0,.08), 0 24px 56px rgba(0,0,0,.14); }
  }
  :host([data-theme="clair"]) { --carte: #FFFFFF; --bord: rgba(60,60,67,.18); --filet: rgba(60,60,67,.14); --texte: #1D1D1F; --doux: #6E6E73; --pale: #8E8E93;
      --accent: #0071E3; --ambre: #B25000; --survol: rgba(118,118,128,.12); --remplir: rgba(118,118,128,.12); --verre: rgba(255,255,255,.88);
      --champ: #FFFFFF; --anneau: rgba(0,113,227,.25);
      --ombre: 0 6px 16px rgba(0,0,0,.08), 0 24px 56px rgba(0,0,0,.14); }
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
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
  @keyframes vrm-entree { from { opacity: 0; transform: translateY(4px) scale(.98); } to { opacity: 1; transform: none; } }
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
</style>
<div class="carte" part="carte"><div class="contenu"></div><div class="connexion" hidden></div></div>
<div class="question" role="dialog" aria-label="Confirmer le compte Vinted"></div>
<button class="btn" title="VRM" aria-label="VRM"><span class="pt"></span></button>`;

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
  if (CADRE) {
    const st = document.createElement('style');
    st.textContent = `.btn, .question, .contenu { display: none !important; }
  .carte, .carte.on { position: static; display: block; width: auto; max-height: none; overflow: visible; background: transparent; border: 0;
    box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; padding: 0; border-radius: 0; }
  .connexion { margin: 0; border-top: 0; padding: 0 0 2px; }
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
    if (e.plateforme === 'leboncoin' && e.lbc && e.lbc.compte && e.lbc.compte.ok === false) return true;   // 5.335 : le compte Leboncoin attend un geste (recharger, se connecter)
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
  function liensHtml(e, nouvelOnglet) {
    const l = Array.isArray(e && e.liens) ? e.liens.filter((x) => { try { const u = new URL(x.url); return u.protocol === 'https:' && u.origin === ORIGINE_ICI; } catch (_) { return false; } }) : [];
    if (!l.length) return '';
    return `<nav class="liens" data-liens aria-label="Sur ${esc(NOM_SITE[e.plateforme] || 'ce site')}">`
      + l.map((x) => `<a class="lien-site" data-lien-site="${esc(x.cle)}" href="${esc(x.url)}" target="${nouvelOnglet ? '_blank' : '_top'}"${nouvelOnglet ? ' rel="noopener"' : ''}><span>${esc(x.libelle)}</span><i aria-hidden="true"></i></a>`).join('')
      + '</nav>';
  }

  // ══ 5.376 : LES MESSAGES AUX FAVORIS, LANCÉS D'ICI ═════════════════════════════
  // « Comme ça on peut lancer les messages aux favoris directement quand on est sur le
  // compte. » Tout vient du service worker : l'aperçu (calculé par VRM avec les règles
  // de l'app), la file en cours (`vrmFavorisCarte`). Rien ne part sans « Lancer ».
  let vueFav = null, apercuFav = null, favErreur = '', favOccupe = false, aideFav = false, minuteurFav = null;
  const ATTENTES_FAV = {
    tout_arrete: '« Tout arrêter » est posé : rien ne part. Touche « Reprendre » dans Détails.',
    reseau: 'Pas de réseau : rien ne part. Ça reprend tout seul.',
    pause: 'Vinted demande de ralentir : rien ne part. Ça reprend tout seul après la pause.',
    autre_compte: 'Cet onglet est connecté sur un autre compte Vinted : rien ne part. Reviens sur le bon compte.',
    onglet: 'Aucun onglet Vinted ouvert sur ce compte : rien ne part. Garde un onglet Vinted ouvert.',
    vrm: 'VRM ne répond pas pour l’instant : rien ne part. Ça reprend tout seul.',
  };
  const BLOCAGES_FAV = {
    reglages: 'Écris ton message une seule fois dans VRM (Messages → Favoris → Ton message). Ensuite, tout se lance d’ici.',
    favoris_absents: 'Ouvre la cloche de Vinted une fois : VRM y lit qui a mis tes articles en favori.',
    dressing_absent: 'Ouvre ton dressing une fois : VRM vérifie que chaque article est encore en vente.',
    dressing_ancien: 'Ton dressing a été lu il y a plus de 24 h : ouvre-le une fois pour que VRM revérifie tes articles.',
    dressing_partiel: 'Ton dressing n’a pas été lu en entier : fais-le défiler jusqu’en bas une fois.',
  };
  const eurosFav = (n) => { const x = Number(n); if (!isFinite(x) || x <= 0) return ''; const c = Math.round(x * 100); return (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €'; };
  const dansFav = (t) => { const s = Math.max(0, Math.round((Number(t) - Date.now()) / 1000)); if (s < 60) return s + ' s'; const m = Math.round(s / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); };
  const plurielFav = (n, un, plusieurs) => `${Number(n).toLocaleString('fr-FR')} ${Number(n) > 1 ? plusieurs : un}`;
  function favorisHtml(e) {
    if (!e || e.plateforme !== 'vinted' || !e.site || !e.site.id || !e.site.favoris) return '';
    const f = e.site.favoris, st = f.file, ap = f.apercu;
    if (st && st.actif) {
      const fi = st.file || {}, total = Number(fi.total) || Number(st.total) || 0, faits = Number(fi.envoyes) || 0;
      const pas = (Number(fi.refuses) || 0) + (Number(fi.ignores) || 0) + (Number(fi.incertains) || 0);
      const dans = !st.enCours && Number(st.prochain) > Date.now() ? dansFav(st.prochain) : '';
      const att = st.attente && ATTENTES_FAV[st.attente];
      return `<section class="fav" data-fav="encours" data-fav-envoyes="${faits}" data-fav-total="${total}"${st.attente ? ` data-fav-attente="${esc(st.attente)}"` : ''}>
        <div class="fav-t">Messages aux favoris</div>
        <div class="fav-l" role="status"><b>${faits}/${total}</b> envoyés${pas ? ` · ${plurielFav(pas, 'pas envoyé', 'pas envoyés')}` : ''}${st.enCours ? ' · un message part' : dans ? ` · prochain dans <span data-fav-dans="${Number(st.prochain)}">${esc(dans)}</span>` : ''}</div>
        <div class="barre" aria-hidden="true"><i style="width:${total ? Math.round(100 * faits / total) : 0}%"></i></div>
        ${att ? `<div class="val alerte" data-fav-attente-texte>${esc(att)}</div>` : '<div class="val gris">Garde cet onglet ouvert : les messages partent un par un, d’ici.</div>'}
        <button class="b sec" data-fav-arreter>Tout arrêter</button>
      </section>`;
    }
    if (st && !st.actif && st.fin && Date.now() - Number(st.fin.at || 0) < 6 * 3600000) {
      const fi = st.file || {}, env = Number(fi.envoyes) || 0, inc = Number(fi.incertains) || 0;
      const pas = (Number(fi.refuses) || 0) + (Number(fi.ignores) || 0) + (Number(fi.annules) || 0);
      const quoi = st.fin.raison === 'robot' ? 'Arrêté : Vinted demande une vérification. Réponds-lui sur Vinted, puis relance d’ici.'
        : st.fin.raison === 'arret' ? 'Arrêté, comme tu l’as demandé. Le reste n’est pas parti.'
        : st.fin.raison === 'interrompu' ? (st.fin.texte ? 'Interrompu : ' + st.fin.texte : 'Interrompu : le reste n’est pas parti.')
        : 'Terminé.';
      return `<section class="fav" data-fav="fini" data-fav-fin="${esc(st.fin.raison || '')}" data-fav-envoyes="${env}">
        <div class="fav-t">Messages aux favoris</div>
        <div class="fav-l" role="status"><b>${plurielFav(env, 'envoyé', 'envoyés')}</b>${pas ? ` · ${plurielFav(pas, 'pas envoyé', 'pas envoyés')}` : ''}</div>
        <div class="val${st.fin.raison === 'robot' ? ' alerte' : ' gris'}">${esc(quoi)}</div>
        ${inc ? `<div class="val alerte" data-fav-verifier="${inc}">${plurielFav(inc, 'message', 'messages')} à vérifier sur Vinted : regarde la conversation avant de relancer.</div>` : ''}
        <div class="outils"><button class="lien" data-fav-ok>OK</button></div>
      </section>`;
    }
    if (ap && ap.etat === 'pret' && Number(ap.total) > 0) {
      const n = Number(ap.total);
      return `<section class="fav" data-fav="pret" data-fav-n="${n}"><button class="fav-ligne" data-fav-voir><span><b>${plurielFav(n, 'favori', 'favoris')}</b> à qui écrire</span><span class="fav-go">Voir</span></button></section>`;
    }
    if (ap && ap.etat === 'bloque' && BLOCAGES_FAV[ap.raison]) return `<section class="fav" data-fav="bloque" data-fav-raison="${esc(ap.raison)}"><div class="fav-t">Messages aux favoris</div><div class="val gris">${esc(BLOCAGES_FAV[ap.raison])}</div></section>`;
    if (ap && ap.etat === 'rien') return `<section class="fav" data-fav="rien"><div class="fav-t">Messages aux favoris</div><div class="val gris">Personne à qui écrire pour l’instant.</div></section>`;
    return `<section class="fav" data-fav="inconnu"><button class="fav-ligne" data-fav-voir><span>Messages aux favoris</span><span class="fav-go">Voir</span></button></section>`;
  }
  function apercuHtml(e) {
    const a = apercuFav;
    const tete = `<div class="ap-tete"><button class="ap-retour" data-fav-retour aria-label="Retour">‹</button><b>Messages aux favoris</b><button class="ap-aide-b" data-fav-aide aria-expanded="${aideFav ? 'true' : 'false'}" aria-label="Comment ça marche ?">?</button></div>`;
    const aide = aideFav ? `<ol class="ap-aide" data-fav-aide-texte>
        <li>Pour chaque personne, VRM ouvre la conversation sur Vinted${a && a.message && a.message.offre ? ', fait l’offre' : ''}, prend le temps d’écrire, puis envoie le message.</li>
        <li>15 messages par heure au plus sur ce compte. Une pause de Vinted, un autre compte dans l’onglet ou une vérification de Vinted arrête tout, et c’est dit ici.</li>
        <li>Garde cet onglet Vinted ouvert. Tu peux tout arrêter à tout moment, ici.</li></ol>` : '';
    if (!a) return `${tete}${aide}<div class="val gris" role="status" data-fav-charge>${favErreur ? '' : 'Je regarde qui a mis tes articles en favori…'}</div>${favErreur ? `<div class="err" role="alert">${esc(favErreur)}</div><button class="b sec" data-fav-retour>Retour</button>` : ''}`;
    if (a.etat !== 'pret') {
      const t = a.etat === 'encours' ? 'Des messages partent déjà sur ce compte (depuis VRM ou une autre carte). Attends la fin avant d’en lancer d’autres.'
        : a.etat === 'bloque' ? (BLOCAGES_FAV[a.raison] || 'VRM ne peut pas préparer les messages pour l’instant.')
        : 'Personne à qui écrire pour l’instant : chaque favori a déjà reçu un message, ou son article n’est plus en vente.';
      return `${tete}${aide}<div class="val" data-fav-apercu="${esc(a.etat)}">${esc(t)}</div>${a.nonProuves ? `<div class="val gris">${plurielFav(a.nonProuves, 'favori attend', 'favoris attendent')} : ouvre un de leurs favoris depuis la cloche de Vinted pour que VRM sache à qui écrire.</div>` : ''}<button class="b sec" data-fav-retour>Retour</button>`;
    }
    const n = a.liste.length, m = a.message || {}, premier = a.liste[0];
    const rythme = Number(m.intervalleMinutes) === 0 ? 'quelques secondes d’écart' : m.intervalleMaxMinutes ? `${m.intervalleMinutes} à ${m.intervalleMaxMinutes} min d’écart` : `${m.intervalleMinutes} min d’écart`;
    const offreTxt = m.offre ? (m.offre.mode === 'pct' ? `−${m.offre.valeur} %` : m.offre.mode === 'euros' ? `−${eurosFav(m.offre.valeur)}` : `à ${eurosFav(m.offre.valeur)}`) + (m.offre.arrondi ? ', arrondie à l’euro' : '') : '';
    return `${tete}${aide}
      <p class="ap-phrase">VRM va écrire à ${n > 1 ? `ces ${n} personnes, une par une` : 'cette personne'}, depuis cet onglet. Rien ne part avant «\u00a0Lancer\u00a0».</p>
      <div class="ap-lbl">Le message${Number(m.versions) > 1 ? ` · une de tes ${Number(m.versions)} versions, au hasard` : ''}</div>
      <div class="bulle" data-fav-message>${esc(premier.texte)}</div>
      ${m.offre ? `<div class="ap-lbl" data-fav-offre="${esc(m.offre.mode)}">Avec une offre ${esc(offreTxt)}</div>` : '<div class="ap-lbl" data-fav-offre="aucune">Sans offre de prix</div>'}
      <ul class="ap-liste" data-fav-liste="${n}">${a.liste.map((x) => `<li data-fav-qui="${esc(x.id)}"><span class="qui">${esc(x.pseudo || 'Un acheteur')}</span><span class="quoi">${esc(x.titre || 'Article')}</span><span class="px">${x.offre != null ? `<s>${esc(eurosFav(x.prix))}</s> ${esc(eurosFav(x.offre))}` : esc(eurosFav(x.prix))}</span></li>`).join('')}</ul>
      <div class="val gris" data-fav-rythme>Écrit pour chacun · ${esc(rythme)} · 15 par heure au plus.</div>
      ${Number(a.total) > n ? `<div class="val gris" data-fav-reste="${Number(a.total) - n}">Les ${n} plus récents d’abord ; les ${Number(a.total) - n} autres, relance après.</div>` : ''}
      ${a.nonProuves ? `<div class="val gris" data-fav-non-prouves="${Number(a.nonProuves)}">${plurielFav(a.nonProuves, 'autre en attente', 'autres en attente')} : ouvre un favori depuis la cloche de Vinted, VRM saura à qui écrire.</div>` : ''}
      ${a.ventesAilleurs === 'pas_su' ? '<div class="val alerte" data-fav-ailleurs>Tes ventes sur les autres sites n’ont pas été revérifiées récemment : assure-toi que ces articles ne sont pas vendus ailleurs.</div>' : ''}
      ${favErreur ? `<div class="err" role="alert">${esc(favErreur)}</div>` : ''}
      <button class="b" data-fav-lancer${favOccupe ? ' disabled' : ''}>${favOccupe ? 'Lancement…' : `Lancer (${n})`}</button>
      <button class="b sec" data-fav-retour>Pas maintenant</button>`;
  }
  function brancherFavoris(e) {
    const uid = e && e.site && e.site.id ? String(e.site.id) : '';
    const demander = (quoi, extra, fin) => {
      try { chrome.runtime.sendMessage(Object.assign({ from: 'vrm-badge', action: 'favorisCarte', quoi, uid }, extra || {}), (r) => { void chrome.runtime.lastError; fin(r || null); }); } catch (_) { fin(null); }
    };
    carte.querySelectorAll('[data-fav-voir]').forEach((el) => el.addEventListener('click', () => {
      vueFav = 'apercu'; apercuFav = null; favErreur = ''; favOccupe = true; doigt = true; rendre();
      demander('apercu', null, (r) => {
        favOccupe = false;
        if (r && r.ok && r.apercu) apercuFav = r.apercu; else favErreur = (r && r.raison) || 'L’extension n’a pas répondu. Réessaie.';
        rendre();
      });
    }));
    carte.querySelectorAll('[data-fav-retour]').forEach((el) => el.addEventListener('click', () => { vueFav = null; apercuFav = null; favErreur = ''; rafraichir(); }));
    const aideB = carte.querySelector('[data-fav-aide]');
    if (aideB) aideB.addEventListener('click', () => { aideFav = !aideFav; rendre(); });
    const lancer = carte.querySelector('[data-fav-lancer]');
    if (lancer) lancer.addEventListener('click', () => {
      const a = apercuFav;
      if (!a || a.etat !== 'pret' || favOccupe) return;
      favOccupe = true; favErreur = ''; rendre();
      // SON clic : la sélection et les réglages de l'aperçu montré, `confirme` posé ici seulement.
      demander('lancer', { selection: a.selection, reglages: a.reglages, confirme: true }, (r) => {
        favOccupe = false;
        if (r && r.ok) { vueFav = null; apercuFav = null; rafraichir(); return; }
        favErreur = (r && r.raison) || 'Rien n’est parti : l’extension n’a pas répondu.';
        rendre();
      });
    });
    const arreter = carte.querySelector('[data-fav-arreter]');
    if (arreter) arreter.addEventListener('click', () => { arreter.disabled = true; arreter.textContent = 'Arrêt…'; demander('arreter', null, () => rafraichir()); });
    const okB = carte.querySelector('[data-fav-ok]');
    if (okB) okB.addEventListener('click', () => demander('oublier', null, () => rafraichir()));
    // « prochain dans … » suit l'horloge tant que la carte est ouverte (aucune requête).
    clearInterval(minuteurFav); minuteurFav = null;
    const dans = carte.querySelector('[data-fav-dans]');
    if (dans) minuteurFav = setInterval(() => { if (!dans.isConnected || !carte.classList.contains('on')) { clearInterval(minuteurFav); minuteurFav = null; return; } const t = Number(dans.getAttribute('data-fav-dans')); if (t <= Date.now()) { clearInterval(minuteurFav); minuteurFav = null; rafraichir(); return; } dans.textContent = dansFav(t); }, 1000);
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
  function quatreLignes(e, r) {
    const site = e.site || {}, f = e.flux || {};
    let compte = site.nom || (site.id && e.plateforme !== 'leboncoin' ? 'compte n° ' + site.id : '');
    if (!compte && e.plateforme === 'vinted') compte = '';
    let lu = 0;
    if (e.plateforme === 'vestiaire' && e.vcCapte) { for (const k of Object.keys(e.vcCapte)) lu = Math.max(lu, Number(e.vcCapte[k] && e.vcCapte[k].at) || 0); }
    else lu = Number(f.okAt) || 0;
    const j = e.plateforme === 'vinted' ? site.jauge : null;
    const jauge = j ? `${j.complet ? '' : 'au moins '}${nbFr(j.h)}/${nbFr(j.maxH)} cette heure · ${nbFr(j.j)}/${j.maxJ ? nbFr(j.maxJ) : '—'} aujourd’hui` : '';
    const et = etatQuatre(e, r);
    const ligne = (k, cle, v, cls, attrs) => `<span class="k">${k}</span><span class="v${cls ? ' ' + cls : ''}" data-q4="${cle}"${attrs || ''}>${v}</span>`;
    return `<div class="q4 resume" data-resume="${esc(r.etat)}" data-q4-bloc role="status">`
      + ligne('Compte', 'compte', compte ? esc(compte) : (e.plateforme === 'vinted' ? 'aucun compte connecté' : '—'), compte ? 'nom' : 'gris')
      + ligne('Lu', 'lu', lu ? esc(depuis(lu)) : '—', lu ? '' : 'gris', ` data-q4-at="${lu || ''}"`)
      + (jauge ? ligne('Jauge', 'jauge', esc(jauge), '', ` data-q4-h="${Number(j.h) || 0}" data-q4-maxh="${Number(j.maxH) || 0}" data-q4-j="${Number(j.j) || 0}" data-q4-maxj="${Number(j.maxJ) || ''}" data-q4-complet="${j.complet ? '1' : '0'}"`) : '')
      + ligne('État', 'etat', esc(et.t) + (et.coche ? '<span class="coche" aria-label="vérifié">✓</span>' : ''), et.k === 'geste' ? '' : (et.k === 'normal' ? '' : 'gris'), ` data-q4-etat="${esc(et.k)}"`)
      + '</div>' + ligneCapture(e);
  }
  // « Nouvelle version disponible » : seulement installée À LA MAIN (zip, fichier
  // Orion) et plus ancienne que celle servie. Boutique ⇒ rien (elle se met à jour).
  const LIENS_PAQUET = ['https://vrm.center/VRM-extension.zip', 'https://vrm.center/VRM-Orion.xpi'];
  function majHtml(m) {
    if (!m || m.nouvelle !== true || m.origine === 'boutique' || !LIENS_PAQUET.includes(String(m.lien || ''))) return '';
    const orion = m.moteur === 'firefox';
    const etapes = orion
      ? ['Touche « Télécharger ».', 'Orion → Extensions → + → ce fichier.', 'Recharge cette page.']
      : ['Ouvre le fichier téléchargé : il se dézippe.', 'Remplace l’ancien dossier VRM par le nouveau.', 'chrome://extensions → ⟳ sur VRM.'];
    return `<div class="maj" data-maj="${esc(m.servie)}"><div class="maj-t">Nouvelle version disponible · ${esc(m.servie)}</div>`
      + `<a class="b sec" data-maj-telecharger href="${esc(m.lien)}" target="_blank" rel="noopener" download>Télécharger</a>`
      + `<ol data-maj-etapes="${etapes.length}">${etapes.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>`;
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
    const ligneImport = (im) => {
      if (!im || !im.etat) return '';
      const unType = (t, nom, attente) => {
        if (!t) return '';
        if (t.fini) return `<div class="imp" data-import-type="${nom}" data-import-lus="${Number(t.lus) || 0}"><div class="imp-l"><span>${nom === 'ventes' ? 'Ventes' : 'Achats'}</span><span>${nb(t.lus)} ✓</span></div></div>`;
        // 5.375 : sur 12 mois, l'estimation (« 340 / ~1 200 ») ; sinon le total de Vinted.
        const est = im.horizonMois && Number(t.estime) > 0 ? Number(t.estime) : 0;
        const tot = est || Number(t.total) || 0;
        const pc = tot > 0 ? Math.max(2, Math.min(100, Math.round((Number(t.lus) || 0) / tot * 100))) : 0;
        const droite = est ? `${nb(Math.min(t.lus, tot))} / ~${nb(tot)}` : tot > 0 ? `${nb(Math.min(t.lus, tot))} sur ${nb(tot)}` : (Number(t.pages) > 0 ? `${nb(t.pages)} page${t.pages > 1 ? 's' : ''} lue${t.pages > 1 ? 's' : ''} · encore…` : (attente ? 'ensuite' : 'bientôt'));
        return `<div class="imp" data-import-type="${nom}" data-import-lus="${Number(t.lus) || 0}" data-import-total="${tot || ''}"><div class="imp-l"><span>${nom === 'ventes' ? 'Ventes' : 'Achats'}</span><span>${droite}</span></div>${tot > 0 ? `<div class="barre" role="progressbar" aria-valuemin="0" aria-valuemax="${tot}" aria-valuenow="${Math.min(Number(t.lus) || 0, tot)}"><i style="width:${pc}%"></i></div>` : ''}</div>`;
      };
      let tete;
      if (im.etat === 'fini') tete = `<div class="val" data-import-etat="fini">${im.horizonMois ? 'Ton passé est importé (12 mois)' : 'Tout est récupéré'}<span class="coche" aria-label="vérifié">✓</span></div>`;
      else if (im.etat === 'pause' && im.horizonMois) { const mn = Math.max(1, Math.ceil((Number(im.repriseA) - Date.now()) / 60000)); tete = `<div class="val gris" data-import-etat="pause">${im.cause === 'vinted' ? 'Vinted freine' : 'Pour ménager ton compte'} : suite dans ${mn >= 60 ? Math.ceil(mn / 60) + ' h' : mn + ' min'}.</div>`; }
      else if (im.etat === 'pause') tete = `<div class="val gris" data-import-etat="pause">${im.cause === 'vinted' ? 'En pause : Vinted freine.' : 'En pause pour ménager ton compte.'} Reprise à ${esc(heure(im.repriseA))}.</div>`;
      else {
        const m = Number(im.resteMin) || 0;
        const duree = m >= 60 ? `environ ${Math.ceil(m / 60)} h` : `environ ${Math.max(5, m)} min`;
        tete = `<div class="val gris" data-import-etat="${im.etat === 'encours' ? 'encours' : 'attente'}">${im.etat === 'encours' ? 'Lecture de ton historique' : 'Ton historique arrive'} · ${duree}, Vinted ouvert.</div>`;
      }
      const bouton = im.etat === 'encours' ? '' : '<button class="b sec" data-import-tout>Tout récupérer</button>';
      return `<div class="ligne" data-import="${esc(im.etat)}"><div class="lib">${im.horizonMois ? 'Import de ton passé' : 'Ton historique Vinted'}</div>${tete}${unType(im.ventes, 'ventes', false)}${unType(im.achats, 'achats', !(im.ventes && im.ventes.fini))}${bouton}</div>`;
    };
    const historique = e.plateforme === 'vinted' && e.capte && e.site && e.site.id && e.site.choix !== 'non' && v && v.connecte ? ligneImport(e.site.import) : '';

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
    const progression = dt && Number(dt.reste) > 0
      ? `<div class="progres val gris" data-dates-versement="${Number(dt.reste)}">Dates de versement en cours de lecture · ${Number(dt.reste).toLocaleString('fr-FR')} restantes · environ ${Number(dt.jours)} jour${Number(dt.jours) > 1 ? 's' : ''}, Vinted ouvert</div>` : '';

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
    // 5.366 (Julien : « faire comme Vintex, pour ne pas se faire bannir ») : l'état du compte
    // en UNE phrase (calculée par le fond, la même que dans VRM) et « Tout arrêter ».
    const ligneSecu = e.secu && e.secu.texte && v && v.connecte
      ? `<div class="ligne" data-secu="${esc(e.secu.niveau || '')}"><div class="lib">Sécurité du compte</div><div class="val${e.secu.niveau === 'robot' ? ' alerte' : (e.secu.niveau === 'ok' ? '' : ' gris')}">${esc(e.secu.texte)}</div><button class="b sec" data-secu-arret="${e.secu.arrete ? 'relancer' : 'arreter'}">${e.secu.arrete ? 'Relancer' : 'Tout arrêter'}</button></div>`
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
    if (vueFav === 'apercu' && connecte && e.plateforme === 'vinted' && e.site && e.site.id) {
      carte.classList.add('doigt');
      poserHtml(contenu, `<button class="fermer" data-fermer-carte title="Fermer" aria-label="Fermer">×</button><div class="apercu" data-fav-vue="apercu">${apercuHtml(e)}</div>`);
      const fermerA = carte.querySelector('[data-fermer-carte]');
      if (fermerA) fermerA.addEventListener('click', fermerCarte);
      brancherFavoris(e);
      poserFormulaire(false);
      return;
    }
    const gestes = (connecte
      ? `<div class="gestes">${favorisHtml(e)}</div>`
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
      connecte ? (e.toutArrete ? '<button class="lien" data-tout-reprendre>Reprendre les gestes automatiques</button>' : '<button class="lien" data-tout-arreter>Tout arrêter</button>') : '',
      v && v.connecte && !changerCompte ? '<button class="lien" data-changer-vrm>Changer de compte VRM</button>' : '',
      // 5.371 : « Envoyer un rapport » — l'état technique seulement, jamais tes données.
      v && v.connecte ? '<button class="lien" data-rapport>Envoyer un rapport</button>' : '',
      `<button class="lien" data-mini-logo>${mini ? 'Agrandir le logo' : 'Réduire le logo'}</button>`,
      posPerso ? '<button class="lien" data-replacer-logo>Logo en bas à droite</button>' : '',
    ].filter(Boolean).join('');
    carte.classList.toggle('doigt', doigt || formulaire);
    poserHtml(contenu, `${doigt || formulaire ? '<button class="fermer" data-fermer-carte title="Fermer" aria-label="Fermer">×</button>' : ''}<div class="tete"><b>VRM</b><span class="ver">${e.version ? 'extension ' + esc(e.version) : ''}</span></div>
      ${lbcVisible ? `<div class="ligne lbc-tete"><div class="lib">Compte ${esc(nomSite)}</div>${compteSite}</div>${lbcLignes}${ligneCapture(e)}` : quatreLignes(e, resume)}
      ${majHtml(e.maj)}
      ${Array.isArray(e.aReparer) && e.aReparer.length && v && v.connecte !== false ? `<button class="b sec" data-reparer data-a-reparer="${esc(e.aReparer.join(' '))}">Réparer</button>` : ''}${repHtml()}
      ${progression}
      ${historique}
      ${lignePerime}
      ${ligneSecu}
      ${aRetirerLbc}
      ${diagnosticLbc}
      ${bascule}
      ${gestes}
      ${moisHtml}
      <details class="detail" data-detail${ouvert ? ' open' : ''}><summary>Détails</summary>
      <div class="ligne"><div class="lib">Compte VRM utilisé</div>${compteVrm}</div>
      ${lbcVisible ? '' : `<div class="ligne"><div class="lib">Compte ${esc(nomSite)}</div>${compteSite}</div>`}
      ${e.capte && !(e.plateforme === 'leboncoin' && e.lbc) ? `<div class="ligne"><div class="lib">Tes données</div>${flux}</div>` : ''}
      ${e.mesure ? `<div class="ligne"><div class="lib">Mesure</div><div class="val gris">VRM apprend à lire ${esc(nomSite)} : il relève la forme des pages, jamais leur contenu. Aucune vente ni annonce n'est encore captée.</div>${(() => { const f = e.flux || {}; return f.koAt && (!f.okAt || f.koAt > f.okAt) ? `<div class="val alerte">Dernier relevé refusé ${esc(depuis(f.koAt))}</div>` : f.okAt ? `<div class="val gris">Relevé envoyé ${esc(depuis(f.okAt))}</div>` : ''; })()}</div>` : ''}
      ${outils ? `<div class="outils">${outils}</div>` : ''}${rapTexte ? `<div class="rep" data-rapport-etat role="status">${esc(rapTexte)}</div>` : ''}
      </details>`);
    brancherReparer();
    brancherRapport();
    const det = carte.querySelector('[data-detail]');
    if (det) det.addEventListener('toggle', () => { if (resume.etat !== 'geste') detailOuvert = det.open; });
    brancherFavoris(e);
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
    if (recharger) recharger.addEventListener('click', () => { try { location.reload(); } catch (_) {} });
    const capter = carte.querySelector('[data-capter]');
    if (capter) capter.addEventListener('click', () => { capter.disabled = true; envoyerChoix('oui'); });
    // 5.344 : « Tout récupérer » — l'historique du compte de l'onglet, depuis la page 1.
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
    const impTout = carte.querySelector('[data-import-tout]');
    if (impTout) impTout.addEventListener('click', () => {
      impTout.disabled = true; impTout.textContent = 'C’est parti…';
      try {
        chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'importTout', uid: String((e.site && e.site.id) || '') }, (r) => {
          void chrome.runtime.lastError;
          if (r && r.ok) { if (e.site) e.site.import = r.etat; rendre(); return; }
          impTout.disabled = false; impTout.textContent = 'Tout récupérer';
          const err = document.createElement('div'); err.className = 'err'; err.textContent = (r && r.raison) || 'L’extension n’a pas répondu. Réessaie.';
          impTout.after(err);
        });
      } catch (_) { impTout.disabled = false; impTout.textContent = 'Tout récupérer'; }
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
  function ouvrirConnexion() { doigt = true; formulaireDemande = true; carte.classList.add('on'); rendre(); }
  function fermerCarte() { doigt = false; justeConnecte = false; vueFav = null; apercuFav = null; favErreur = ''; if (changerCompte) { changerCompte = false; formulaireDemande = false; rendre(); } carte.classList.remove('on'); }

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
    if (CADRE) return;
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
    const mo = new MutationObserver(() => { if (minut) return; minut = setTimeout(() => { minut = null; replacerLogo(); }, 300); });
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
    clearTimeout(minuteur);
    doigt = false;
    rafraichir();
    carte.classList.add('on');
  });
  hote.addEventListener('pointerleave', (e) => {
    if (CADRE || (e.pointerType && e.pointerType !== 'mouse')) return;
    if (doigt || !connexion.hidden) return;             // un formulaire ouvert ne se ferme pas au survol
    clearTimeout(minuteur); minuteur = setTimeout(() => carte.classList.remove('on'), 180);
  });
  // Au doigt, toucher ailleurs dans la page referme la carte (sans rien cliquer
  // à sa place : on n'empêche pas le geste du site).
  document.addEventListener('pointerdown', (e) => {
    if (CADRE || !carte.classList.contains('on')) return;
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

  (CADRE ? (document.body || document.documentElement) : (document.documentElement || document.body)).appendChild(hote);
  rafraichir();
})();
