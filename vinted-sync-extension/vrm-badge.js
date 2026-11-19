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
  const MDP_PERMIS = CADRE;
  // 5.377 : la fenêtre de l'extension (popup.html?mode=onglet) charge CE fichier en mode
  // « listes » : Favoris · Annonces · Ventes du compte connecté, sans logo ni carte flottante.
  const LISTES = (() => { try { return globalThis.__vrmListes === true && /^(chrome|moz|safari-web)-extension:$/.test(location.protocol); } catch (_) { return false; } })();   // 5.362 (moyenne 69) : le mot de passe seulement dans l'iframe de l'extension
  if (window.top !== window && !CADRE) return;       // une seule carte par onglet
  if (document.getElementById('vrm-badge')) return;  // déjà posée (SPA, double injection)
  const vivant = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; } };
  if (!vivant()) return;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 5.406 : la feuille et les pièces COMMUNES de l'extension (vrm-ui.js, chargé avant ce fichier) ;
  // `U.T(clé, vars)` : les textes neufs, en cinq langues. Absent (ancien manifeste) ⇒ le français.
  const U = globalThis.VRM_UI || { T: (k, v) => k, duree: (ms) => Math.round(ms / 60000) + ' min', etiquette: () => '', barre: () => '', monter: () => {}, esc };
  const TU = (k, v) => U.T(k, v);
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
    --fond: #060E19; --carte: #122135; --bord: rgba(255,255,255,.10); --filet: rgba(255,255,255,.08); --texte: #EAF2FB; --doux: #9CB0C6; --pale: #7F93AA;
    --accent: #6CB4FF; --ambre: #F2B65E; --survol: rgba(255,255,255,.06); --remplir: rgb(20 35 54 / .9); --verre: #122135;
    --champ: rgb(0 0 0 / .22); --anneau: rgba(74,163,255,.35);
    --ombre: inset 0 .5px 0 rgb(255 255 255 / .12), 0 0 0 .5px rgb(0 0 0 / .5), 0 34px 60px -22px rgb(0 0 0 / .95);
    --fond-carte: linear-gradient(180deg, #15263D 0%, #0C1829 100%);
    --plan: rgb(20 35 54 / .9); --plan-ombre: inset 0 .5px 0 rgb(255 255 255 / .09), 0 0 0 .5px rgb(0 0 0 / .5), 0 12px 26px -12px rgb(0 0 0 / .8);
    --touche-fond: linear-gradient(180deg, #1D3049, #172840); --touche-ombre: inset 0 .5px 0 rgb(255 255 255 / .12), 0 0 0 .5px rgb(0 0 0 / .55), 0 4px 10px -5px rgb(0 0 0 / .8);
    --enfonce: inset 0 1px 3px rgb(0 0 0 / .7), inset 0 0 0 .5px rgb(0 0 0 / .5);
    --plein-fond: radial-gradient(120% 90% at 50% 0%, #FFFFFF 0%, #EAF2FB 60%); --plein-encre: #0C1D30; --plein-ombre: inset 0 .5px 0 #FFFFFF, 0 1px 2px rgb(0 0 0 / .5), 0 12px 24px -10px rgb(0 0 0 / .9); }
  /* 5.351 : la teinte CHOISIE dans VRM (Réglages → Apparence, recopiée par le pont
     de vrm.center : data-theme sur l'hôte) passe avant celle du système ; sans
     choix connu, le système décide, comme avant. */
  @media (prefers-color-scheme: light) {
    :host(:not([data-theme="sombre"])) { --carte: #FFFFFF; --bord: rgba(18,52,96,.12); --filet: rgba(18,52,96,.10); --texte: #0C1D30; --doux: #3F5468; --pale: #6B7F94;
      --accent: #0055B8; --ambre: #764300; --survol: rgba(18,52,96,.05); --remplir: rgb(255 255 255 / .82); --verre: #E6F1FA;
      --champ: #FFFFFF; --anneau: rgba(0,96,204,.25);
      --ombre: inset 0 1px 0 #FFFFFF, 0 0 0 .5px rgb(18 52 96 / .10), 0 2px 5px rgb(18 52 96 / .08), 0 34px 60px -26px rgb(18 52 96 / .48);
      --fond-carte: linear-gradient(180deg, #EEF6FD 0%, #D6E8F5 100%);
      --plan: rgb(255 255 255 / .82); --plan-ombre: inset 0 1px 0 #FFFFFF, 0 0 0 .5px rgb(18 52 96 / .07), 0 1px 2px rgb(18 52 96 / .07), 0 12px 26px -14px rgb(18 52 96 / .30);
      --touche-fond: linear-gradient(180deg, #FFFFFF, #F3F7FB); --touche-ombre: inset 0 1px 0 #FFFFFF, 0 0 0 .5px rgb(18 52 96 / .14), 0 1px 1.5px rgb(18 52 96 / .08), 0 4px 9px -5px rgb(18 52 96 / .26);
      --enfonce: inset 0 1px 2px rgb(18 52 96 / .20), inset 0 0 0 .5px rgb(18 52 96 / .12);
      --plein-fond: radial-gradient(120% 90% at 50% 0%, #4A5A6E 0%, #0C1D30 55%); --plein-encre: #FFFFFF; --plein-ombre: inset 0 .5px 0 rgb(255 255 255 / .25), 0 1px 2px rgb(18 52 96 / .25), 0 12px 22px -10px rgb(18 52 96 / .6); }
  }
  :host([data-theme="clair"]) { --carte: #FFFFFF; --bord: rgba(18,52,96,.12); --filet: rgba(18,52,96,.10); --texte: #0C1D30; --doux: #3F5468; --pale: #6B7F94;
      --accent: #0055B8; --ambre: #764300; --survol: rgba(18,52,96,.05); --remplir: rgb(255 255 255 / .82); --verre: #E6F1FA;
      --champ: #FFFFFF; --anneau: rgba(0,96,204,.25);
      --ombre: inset 0 1px 0 #FFFFFF, 0 0 0 .5px rgb(18 52 96 / .10), 0 2px 5px rgb(18 52 96 / .08), 0 34px 60px -26px rgb(18 52 96 / .48);
      --fond-carte: linear-gradient(180deg, #EEF6FD 0%, #D6E8F5 100%);
      --plan: rgb(255 255 255 / .82); --plan-ombre: inset 0 1px 0 #FFFFFF, 0 0 0 .5px rgb(18 52 96 / .07), 0 1px 2px rgb(18 52 96 / .07), 0 12px 26px -14px rgb(18 52 96 / .30);
      --touche-fond: linear-gradient(180deg, #FFFFFF, #F3F7FB); --touche-ombre: inset 0 1px 0 #FFFFFF, 0 0 0 .5px rgb(18 52 96 / .14), 0 1px 1.5px rgb(18 52 96 / .08), 0 4px 9px -5px rgb(18 52 96 / .26);
      --enfonce: inset 0 1px 2px rgb(18 52 96 / .20), inset 0 0 0 .5px rgb(18 52 96 / .12);
      --plein-fond: radial-gradient(120% 90% at 50% 0%, #4A5A6E 0%, #0C1D30 55%); --plein-encre: #FFFFFF; --plein-ombre: inset 0 .5px 0 rgb(255 255 255 / .25), 0 1px 2px rgb(18 52 96 / .25), 0 12px 22px -10px rgb(18 52 96 / .6); }
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
  :host { --porc1: #16273C; --porc2: #122135; --creux: #091320; --diode: #4AA3FF; --o: 0 0 0; --plaque-t: #EAF2FB; }
  @media (prefers-color-scheme: light) { :host(:not([data-theme="sombre"])) { --porc1: #FFFFFF; --porc2: #F7FAFD; --creux: #E4EEF7; --diode: #0060CC; --o: 18 52 96; --plaque-t: #0C1D30; } }
  :host([data-theme="clair"]) { --porc1: #FFFFFF; --porc2: #F7FAFD; --creux: #E4EEF7; --diode: #0060CC; --o: 18 52 96; --plaque-t: #0C1D30; }
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
  :host { --vb-fond-uni: #0C2848;
    --vb-fond: radial-gradient(120% 60% at 12% 0%, rgb(90 150 220 / .14) 0%, rgb(90 150 220 / 0) 60%), linear-gradient(170deg, #133A68 0%, #0C2848 50%, #06142A 100%);
    --vb-verre: rgb(8 18 33 / .72); --vb-verre-o: #0E2139; --vb-verre-bord: rgb(255 255 255 / .12);
    --vb-verre-ombre: inset 0 .5px 0 rgb(255 255 255 / .10), 0 10px 24px -14px rgb(0 0 0 / .85);
    --vb-sur: #FFFFFF; --vb-sur-2: #D6E4F3; --pale: #8FA3B9;
    --plan: rgb(255 255 255 / .05); --plan-ombre: inset 0 0 0 .5px rgb(255 255 255 / .07);
    --vb-plein-sur-bleu: #FFFFFF; --vb-plein-sur-bleu-t: #0C1D30; }
  @media (prefers-color-scheme: light) {
    :host(:not([data-theme="sombre"])) { --vb-fond-uni: #174C88;
      --vb-fond: radial-gradient(120% 60% at 12% 0%, rgb(120 180 240 / .16) 0%, rgb(120 180 240 / 0) 55%), radial-gradient(70% 45% at 100% 38%, rgb(61 139 224 / .16) 0%, rgb(61 139 224 / 0) 70%), linear-gradient(170deg, #1E5DA4 0%, #174C88 45%, #0F2F57 100%);
      --vb-verre: rgb(247 250 253 / .9); --vb-verre-o: #D7DEE6; --vb-verre-bord: rgb(255 255 255 / .75);
      --vb-verre-ombre: inset 0 1px 0 rgb(255 255 255 / .9), 0 12px 26px -16px rgb(8 26 50 / .6);
      --vb-sur: #FFFFFF; --vb-sur-2: #EEF4FB; --pale: #4F6276;
      --plan: rgb(255 255 255 / .55); --plan-ombre: inset 0 0 0 .5px rgb(18 52 96 / .08); }
  }
  :host([data-theme="clair"]) { --vb-fond-uni: #174C88;
      --vb-fond: radial-gradient(120% 60% at 12% 0%, rgb(120 180 240 / .16) 0%, rgb(120 180 240 / 0) 55%), radial-gradient(70% 45% at 100% 38%, rgb(61 139 224 / .16) 0%, rgb(61 139 224 / 0) 70%), linear-gradient(170deg, #1E5DA4 0%, #174C88 45%, #0F2F57 100%);
      --vb-verre: rgb(247 250 253 / .9); --vb-verre-o: #D7DEE6; --vb-verre-bord: rgb(255 255 255 / .75);
      --vb-verre-ombre: inset 0 1px 0 rgb(255 255 255 / .9), 0 12px 26px -16px rgb(8 26 50 / .6);
      --vb-sur: #FFFFFF; --vb-sur-2: #EEF4FB; --pale: #4F6276;
      --plan: rgb(255 255 255 / .55); --plan-ombre: inset 0 0 0 .5px rgb(18 52 96 / .08); }
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
    border-radius: 22px; padding: 12px; width: min(380px, calc(100vw - 24px)); box-shadow: 0 1px 2px rgb(0 0 0/.2), 0 30px 60px -24px rgb(8 26 50/.75); }
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

  /* ══ 5.409 — LE GRAND PANNEAU (Julien, 19 nov. : « je veux que l'extension prenne tout l'écran, ou une très
     grosse partie de l'écran sur Vinted, beaucoup plus visuel et compréhensible ») : sur vinted.fr, connecté,
     la carte devient un panneau de 76 % de la largeur (1100 px au plus) à l'ordinateur, PLEIN ÉCRAN au
     téléphone ; design natif (docs/design/NATIF.md : fond #F2F2F7 / #000, cartes blanches / #1C1C1E, accent
     #0068D6 rare). Les jetons --vu-* sont redéfinis DANS le panneau : les pièces existantes le suivent. */
  .carte[data-grand] { --n-fond:#F2F2F7; --n-carte:#FFFFFF; --n-carte-2:#F2F2F7; --n-trait:rgb(60 60 67/.18); --n-encre:#111114; --n-encre-2:#6C6C70; --n-accent:#0068D6; --n-teinte:rgb(0 104 214/.12);
    --vu-coque-uni:var(--n-fond); --vu-coque:none; --vu-sur:var(--n-encre); --vu-sur-2:var(--n-encre-2); --vu-plaque:var(--n-carte); --vu-plaque-2:var(--n-carte-2); --vu-encre:var(--n-encre); --vu-muet:var(--n-encre-2);
    --vu-filet:var(--n-trait); --vu-ombre:none; --vu-plein:#0068D6; --vu-plein-appui:#0058B6; --vu-plein-encre:#FFFFFF; --vu-plein-sur-plaque:#0068D6; --vu-plein-sur-plaque-encre:#FFFFFF;
    --vu-teinte:var(--n-teinte); --vu-teinte-encre:#0058B6; --vu-lien:#0068D6; --vu-socle:#E5E5EA; --vu-barre:#0068D6; --vu-ambre:#8A4B00;
    position: fixed; top: 4vh; bottom: 4vh; right: 2vw; left: auto; width: min(1100px, 76vw) !important; max-height: none; height: auto; border-radius: 16px; border: 0;
    padding: 12px 20px 20px; background: var(--n-fond) !important; color: var(--n-encre); box-shadow: 0 8px 30px rgb(0 0 0/.12), 0 0 0 100vmax rgb(0 0 0/.28); overflow-y: auto; overscroll-behavior: contain; }
  @media (prefers-color-scheme: dark) { :host(:not([data-theme="clair"])) .carte[data-grand] { --n-fond:#000000; --n-carte:#1C1C1E; --n-carte-2:#2C2C2E; --n-trait:rgb(84 84 88/.6); --n-encre:#FFFFFF; --n-encre-2:#98989F; --n-accent:#409CFF; --n-teinte:rgb(64 156 255/.20); --vu-plein:#0068D6; --vu-teinte-encre:#8CC4FF; --vu-lien:#409CFF; --vu-socle:#2C2C2E; --vu-barre:#409CFF; --vu-ambre:#FFB340; } }
  :host([data-theme="sombre"]) .carte[data-grand] { --n-fond:#000000; --n-carte:#1C1C1E; --n-carte-2:#2C2C2E; --n-trait:rgb(84 84 88/.6); --n-encre:#FFFFFF; --n-encre-2:#98989F; --n-accent:#409CFF; --n-teinte:rgb(64 156 255/.20); --vu-teinte-encre:#8CC4FF; --vu-lien:#409CFF; --vu-socle:#2C2C2E; --vu-barre:#409CFF; --vu-ambre:#FFB340; }
  @media (max-width: 760px) { .carte[data-grand] { top: 0; bottom: 0; right: 0; left: 0; width: 100vw !important; height: 100dvh; border-radius: 0; padding: max(8px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); box-shadow: none; } }
  .carte[data-grand] .t5 { min-height: 52px; }
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
  .pt5 { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--n-accent, #0068D6); margin-right: 6px; vertical-align: middle; }
  .carte[data-grand] li[data-ouverte] > .rang { background: var(--n-teinte); }
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
    .carte[data-grand] .seg5 button[aria-selected="true"] { background: var(--n-teinte); color: var(--n-accent); box-shadow: none; }
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
  .filtre5[aria-pressed="true"] { background: var(--n-teinte); color: var(--n-accent); }
  .volet5 { padding: 16px; }
  .vide5 { display: grid; place-content: center; text-align: center; gap: 6px; min-height: 50vh; color: var(--n-encre-2); font: 400 15px/20px -apple-system, Inter, system-ui, sans-serif; }
  .vide5 b { color: var(--n-encre); font: 600 17px/22px -apple-system, Inter, system-ui, sans-serif; }
  .conv5 { padding: 8px 0; }
  .conv5-ph { width: 120px; height: 120px; border-radius: 12px; object-fit: cover; }
  .conv5-t { display: flex; align-items: baseline; gap: 8px; margin: 8px 0; color: var(--n-encre); }
  .conv5-t b { font: 600 17px/22px -apple-system, Inter, system-ui, sans-serif; }
  .conv5-t span { color: var(--n-encre-2); font-size: 13px; }
  .conv5 .bulle { background: var(--n-carte-2); color: var(--n-encre); border-radius: 16px; padding: 10px 14px; font: 400 17px/22px -apple-system, Inter, system-ui, sans-serif; max-width: 520px; }
  .conv5-sous { padding: 0 16px 12px; }

  .carte[data-grand] .reg5 .lib5 { display: none; }
  @media (min-width: 1024px) { .carte[data-grand] .reg5 { gap: 10px; } .carte[data-grand] .reg5 .lib5 { display: inline; } }
  @media (max-width: 760px) { .carte[data-grand] .seg5 button { font-size: 13px; padding: 0 2px; } .carte[data-grand] .seg5 { grid-template-columns: repeat(4, minmax(0,1fr)) 44px; } }
  /* Le grand panneau a ses onglets : les liens « Messages › » de la petite carte n'y sont pas redits. */
  .carte[data-grand] .contenu > .liens { display: none; }

  @media (max-width: 760px) { .etapes5 li:not([aria-current]) { font-size: 0; } .etapes5 li:not([aria-current])::before { font-size: 12px; content: counter(e5); } }
</style>
<div class="carte" part="carte"><div class="contenu"></div><div class="connexion" hidden></div></div>
<div class="question" role="dialog" aria-label="Confirmer le compte Vinted"></div>
<div class="capte" role="status" aria-live="polite" data-capte hidden></div>
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
  let vueFav = null, apercuFav = null, apercuFavAt = 0, favEnVol = false, favErreur = '', favOccupe = false, aideFav = false, minuteurFav = null;
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
  const ECRIRE_MESSAGE_URL = 'https://vrm.center/?tab=messages&vue=favoris';
  const BLOCAGES_FAV = {
    reglages: 'Pour leur écrire d’ici, écris ton message une fois pour ce compte (Messages → Favoris → Ton message).',
    favoris_absents: 'Ouvre une fois ta cloche Vinted (tes notifications) : VRM y lit qui a mis tes articles en favori.',
    dressing_absent: 'Pour leur écrire, ouvre une fois ton dressing : VRM vérifie que chaque article est encore en vente.',
    dressing_ancien: 'Pour leur écrire, ouvre une fois ton dressing (lu il y a plus de 24 h) : VRM revérifie tes articles.',
    dressing_partiel: 'Pour leur écrire, fais défiler ton dressing jusqu’en bas une fois : VRM ne l’a pas lu en entier.',
  };
  const ETAT_FAV = { envoye: 'déjà écrit', en_cours: 'message en cours', a_verifier: 'à vérifier sur Vinted', pas_envoye: 'pas envoyé' };
  const eurosFav = (n) => { const x = Number(n); if (!isFinite(x) || x <= 0) return ''; const c = Math.round(x * 100); return (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €'; };
  const dansFav = (t) => { const s = Math.max(0, Math.round((Number(t) - Date.now()) / 1000)); if (s < 60) return s + ' s'; const m = Math.round(s / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); };
  const plurielFav = (n, un, plusieurs) => `${Number(n).toLocaleString('fr-FR')} ${Number(n) > 1 ? plusieurs : un}`;
  const fileFavActive = (e) => !!(e && e.site && e.site.favoris && e.site.favoris.file && e.site.favoris.file.actif);
  // La file en cours (ou finie depuis moins de 6 h) : ce qui part, d'ici.
  // 5.406 : la LIGNE PRINCIPALE de la carte pendant l'envoi — « Messages aux favoris · 3 sur 15 ·
  // prochain dans 3 min », un trait fin, la VRAIE raison de l'attente (`quoi`, posé par le fond :
  // ouverture de Vinted, 15/h, 50/h…) et UN plein : « Tout arrêter ». Mêmes marques `data-fav*`.
  const QUOI_FAV = { ouverture: 'q_ouverture', sorte: 'q_sorte', heure: 'q_heure', jour: 'q_jour', rythme: 'q_rythme', 'autre-compte': 'q_autre', serie: 'q_serie', rodage: 'q_rodage', espace: 'q_espace', calme: 'q_calme' };
  function favorisFileHtml(e) {
    if (!e || e.plateforme !== 'vinted' || !e.site || !e.site.id || !e.site.favoris) return '';
    const st = e.site.favoris.file;
    if (st && st.actif) {
      const fi = st.file || {}, total = Number(fi.total) || Number(st.total) || 0, faits = Number(fi.envoyes) || 0;
      const pas = (Number(fi.refuses) || 0) + (Number(fi.ignores) || 0) + (Number(fi.incertains) || 0);
      const dans = !st.enCours && Number(st.prochain) > Date.now() ? dansFav(st.prochain) : '';
      const att = st.attente && ATTENTES_FAV[st.attente];
      const pour = QUOI_FAV[st.quoi] ? TU(QUOI_FAV[st.quoi]) : '';
      const etat = st.enCours ? `<span class="p-dans">· ${esc(TU('f_part'))}</span>` : dans ? `<span class="p-dans">· ${esc(TU('f_prochain', { dans: '\u0000' })).replace('\u0000', `<span data-fav-dans="${Number(st.prochain)}">${esc(dans)}</span>`)}</span>` : '';
      return `<section class="fav principal" data-fav="encours" data-fav-envoyes="${faits}" data-fav-total="${total}"${st.attente ? ` data-fav-attente="${esc(st.attente)}"` : ''}${st.quoi ? ` data-fav-quoi="${esc(st.quoi)}"` : ''}>
        <div class="p-t fav-l" role="status"><span class="p-nom">${esc(TU('f_titre'))}</span><b class="p-n">${esc(TU('f_sur', { n: faits, total }))}</b></div>
        ${U.barre(total ? 100 * faits / total : 0, ' aria-label="' + esc(TU('f_titre')) + '"')}
        <div class="p-l2">${etat.replace('· ', '')}${pas ? `<span class="p-dans"> · ${esc(TU('f_pas', { n: pas }))}</span>` : ''}</div>
        ${st.robot ? `<div class="p-pour ambre" data-fav-robot>${esc(TU('a_verif_robot'))}</div><div class="p-pour">${esc(TU('a_doucement'))}</div>${favErreur ? `<div class="p-pour ambre" role="alert">${esc(favErreur)}</div>` : ''}<button class="vu-btn vu-plein" data-fav-reprendre>${esc(TU('a_reprendre'))}</button><button class="vu-btn vu-sec" data-fav-arreter>${esc(TU('c_tout_arreter'))}</button>`
          : `${att ? `<div class="p-pour ambre" data-fav-attente-texte>${esc(att)}</div>` : `<div class="p-pour" data-fav-pour>${esc(pour || TU('f_garde'))}</div>`}
        <button class="vu-btn vu-plein" data-fav-arreter>${esc(TU('c_tout_arreter'))}</button>`}
      </section>`;
    }
    if (st && !st.actif && st.fin && Date.now() - Number(st.fin.at || 0) < 6 * 3600000) {
      const fi = st.file || {}, env = Number(fi.envoyes) || 0, inc = Number(fi.incertains) || 0;
      const pas = (Number(fi.refuses) || 0) + (Number(fi.ignores) || 0) + (Number(fi.annules) || 0);
      const quoi = st.fin.raison === 'robot' ? TU('f_fin_robot')
        : st.fin.raison === 'arret' ? TU('f_fin_arret')
        : st.fin.raison === 'interrompu' ? (st.fin.texte ? TU('f_fin_interrompu_t', { t: st.fin.texte }) : TU('f_fin_interrompu'))
        : TU('a_fini');
      return `<section class="fav principal" data-fav="fini" data-fav-fin="${esc(st.fin.raison || '')}" data-fav-envoyes="${env}">
        <div class="p-t fav-l" role="status"><span>${esc(TU('f_titre'))}</span><span>· <b>${esc(env > 0 ? '✓ ' + TU('f_envoye_a', { n: env }) : TU('f_envoyes', { n: env }))}</b></span>${pas ? `<span class="p-dans">· ${esc(TU('f_pas', { n: pas }))}</span>` : ''}</div>
        <div class="p-pour${st.fin.raison === 'robot' ? ' ambre' : ''}">${esc(quoi)}</div>
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
  const gesteEcrire = () => `<div class="ecrire" data-fav-ecrire-bloc><div class="val gris">${esc(BLOCAGES_FAV.reglages)}</div><a class="lien-site lien-vrm" data-fav-ecrire href="${ECRIRE_MESSAGE_URL}" target="_blank" rel="noopener"><span>Écris d’abord ton message dans VRM</span><i aria-hidden="true"></i></a></div>`;
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
  function favorisOngletHtml(e) {
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
    if (!a && favErreur) return `<section class="fav" data-fav="erreur"><div class="val gris" role="status" data-fav-erreur>Tes favoris n’ont pas pu être lus : ${esc(favErreur)}</div><button class="b sec" data-fav-relire>Réessayer</button></section>`;
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
    const choisis = favCochables(a).filter((x) => selFav.has(x.id)), max = favMax(a);
    return { choisis, envoi: choisis.slice(0, max), max };
  }
  function piedFl(a) {
    const { choisis, envoi, max } = envoiFl(a), n = choisis.length, k = envoi.length, reste = n - k;
    const l = lotFav && Number(lotFav.n) >= max ? Number(lotFav.at) + 3600000 : 0;
    const attente = l > Date.now() ? l : 0;
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
    const ecart = ry === 'normal' ? 65 / 60 : ry === 'prudent' ? 3 : lo === 0 && hi === 0 ? 8 / 60 : (lo + hi) / 2;
    let min = n * 0.75 + (n - 1) * ecart;
    const HEURE = 15;
    if (n > HEURE) min = Math.max(min, Math.floor((n - 1) / HEURE) * 60 + ((n - 1) % HEURE) * Math.max(ecart, 0.75) + 0.75);
    return Math.max(60000, Math.round(min * 60000));
  }
  function recapFavHtml(a) {
    const m = a.message || {}, choisis = envoiFl(a).envoi;
    const parAnnonce = new Map();
    for (const x of choisis) { const k = String(x.itemId); const o = parAnnonce.get(k) || { x, n: 0 }; o.n++; parAnnonce.set(k, o); }
    const offreTxt = m.offre ? (m.offre.mode === 'pct' ? `−${m.offre.valeur} %` : m.offre.mode === 'euros' ? `−${eurosFav(m.offre.valeur)}` : `${eurosFav(m.offre.valeur)}`) + (m.offre.arrondi ? ', ' + TU('fr_arrondi') : '') : '';
    const premier = choisis.find((x) => x.texte) || favCochables(a).find((x) => x.texte) || null, n = choisis.length;
    // Une offre SOUS le prix mini posé pour l'article : dit, avant « Confirmer » (il décoche, ou il fixe le mini).
    const sous = (x) => m.offre && x.offre != null && x.mini != null && Number(x.offre) < Number(x.mini);
    const nSous = choisis.filter(sous).length;
    return `<section class="fav fl-recap" data-fav="pret" data-fav-vue="recap" data-fav-n="${n}">
      <div class="fl-r-t">${esc(n === 1 ? TU('fl_envoyer1') : TU('fl_envoyer', { n }))}</div>
      <ul class="fl-r-l" data-fav-recap-annonces="${parAnnonce.size}">${[...parAnnonce.values()].map(({ x, n: k }) => `<li data-fav-recap-item="${esc(x.itemId)}">${photoFav(x.photo)}<span class="fl-mil"><span class="fl-ti">${x.num ? U.etiquette(x.num) + ' ' : ''}${esc(x.titre || TU('fl_article'))}</span><span class="fl-me">${esc(k === 1 ? TU('fr_par1') : TU('fr_par', { n: k }))}${m.offre && x.offre != null ? ' · ' + esc(TU('fr_offre', { p: eurosFav(x.offre) })) : ''}${'mini' in x ? ' · ' + esc(x.mini == null ? TU('fl_mini_rien') : TU('fl_mini', { p: eurosFav(x.mini) })) : ''}</span>${sous(x) ? `<span class="fl-etat ambre" data-fav-sous-mini="${esc(x.itemId)}">${esc(TU('fr_sous_mini', { o: eurosFav(x.offre), m: eurosFav(x.mini) }))}</span>` : ''}</span><span class="fl-px">${m.offre && x.offre != null ? `<s>${esc(eurosFav(x.prix))}</s>${esc(eurosFav(x.offre))}` : esc(eurosFav(x.prix))}</span></li>`).join('')}</ul>
      ${nSous ? `<div class="fl-alerte" data-fav-sous="${nSous}"><div>${esc(TU('fr_sous_n', { n: nSous }))}</div><div class="fl-alerte-g"><button class="vu-btn vu-sec" data-fav-decocher-sous>${esc(TU('fr_decocher'))}</button><a class="vu-lien" href="${FIXER_MINI_URL}" target="_blank" rel="noopener">${esc(TU('fl_fixer'))}</a></div></div>` : ''}
      <div class="fl-lbl" data-fav-offre="${m.offre ? esc(m.offre.mode) : 'aucune'}">${esc(m.offre ? TU('fr_offre_mode', { o: offreTxt }) : TU('fr_sans_offre'))}</div>
      <div class="fl-lbl">${esc(TU('fr_message'))}${Number(m.versions) > 1 ? ' · ' + esc(TU('fr_versions', { n: Number(m.versions) })) : ''}</div>
      ${premier ? `<div class="bulle" data-fav-message>${esc(premier.texte)}</div>` : ''}
      <div class="vu-seg fl-rythme" role="group" aria-label="${esc(TU('f5_rythme'))}" data-fav-rythme="${esc(rythmeDe(m))}">${['normal', 'prudent'].map((k) => `<button type="button" data-fav-rythme-b="${k}" aria-pressed="${rythmeDe(m) === k ? 'true' : 'false'}">${esc(TU(k === 'prudent' ? 'fr_rythme_prudent' : 'fr_rythme_normal'))}</button>`).join('')}</div>
      <div class="fl-duree" data-fav-duree="${dureeFavMs(n, m)}">${esc(TU('fr_duree', { d: U.duree(dureeFavMs(n, m)), h: 15 }))}</div>
      <p class="fl-note">${esc(TU('fr_rien_avant'))}</p>
      ${favErreur ? `<div class="err" role="alert">${esc(favErreur)}</div>` : ''}
      <button class="vu-btn vu-plein" data-fav-lancer${favOccupe || !n || n > favMax(a) || piedFl(a).attente ? ' disabled' : ''}>${esc(favOccupe ? TU('fr_envoi') : TU('fr_confirmer'))}</button>
      <div class="fl-retour"><button class="vu-lien" data-fav-retour>${esc(TU('fr_retour'))}</button></div>
    </section>`;
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
    if (!uid || e.plateforme !== 'vinted' || fileFavActive(e)) return;
    if (!force && Date.now() - apercuFavAt < 60000 && (apercuFav || favErreur)) return;
    favEnVol = true;
    try {
      chrome.runtime.sendMessage({ from: 'vrm-badge', action: 'favorisCarte', quoi: 'apercu', uid }, (r) => {
        void chrome.runtime.lastError;
        favEnVol = false; apercuFavAt = Date.now();
        if (r && r.ok && r.apercu && avecListe(r.apercu)) {
          // 5.407 : le choix gardé pour CE compte, réduit aux favoris encore cochables ; sinon les plus récents (au plus `max`).
          const a = r.apercu, ok = new Set(favCochables(a).map((x) => x.id));
          lireSelection(uid, (gardes) => {
            apercuFav = a; favErreur = '';
            const ids = favTous(a).map((x) => x.id + ':' + (x.cochable ? 1 : 0)).join(',');
            if (ids !== selFavIds || !gardes) { selFavIds = ids; selFav = new Set((gardes || (Array.isArray(a.selection) ? a.selection : [])).filter((id) => ok.has(id)).slice(0, gardes ? 1000 : favMax(a))); }
            if (vueFav === 'recap' && !favCochables(a).some((x) => selFav.has(x.id))) vueFav = null;
            if (carte.classList.contains('on')) rendre();
          });
          return;
        }
        if (r && r.ok && r.apercu) {
          apercuFav = r.apercu; favErreur = '';
          const ids = listeFavTriee(r.apercu).map((x) => x.id).join(',');
          if (ids !== selFavIds) { selFavIds = ids; selFav = new Set(Array.isArray(r.apercu.selection) ? r.apercu.selection : (r.apercu.liste || []).map((x) => x.id)); }
        } else { apercuFav = null; favErreur = (r && r.raison) || 'l’extension n’a pas répondu.'; }
        if (carte.classList.contains('on')) rendre();
      });
    } catch (_) { favEnVol = false; }
  }
  function brancherFavoris(e) {
    const uid = e && e.site && e.site.id ? String(e.site.id) : '';
    const demander = (quoi, extra, fin) => {
      try { chrome.runtime.sendMessage(Object.assign({ from: 'vrm-badge', action: 'favorisCarte', quoi, uid }, extra || {}), (r) => { void chrome.runtime.lastError; fin(r || null); }); } catch (_) { fin(null); }
    };
    const relire = carte.querySelector('[data-fav-relire]');
    if (relire) relire.addEventListener('click', () => { favErreur = ''; apercuFav = null; rendre(); chargerFavoris(e, true); });
    const aideB = carte.querySelector('[data-fav-aide]');
    if (aideB) aideB.addEventListener('click', () => { aideFav = !aideFav; rendre(); });
    carte.querySelectorAll('[data-fav-rythme-b]').forEach((b) => b.addEventListener('click', () => { rythmeFav = b.getAttribute('data-fav-rythme-b'); rendre(); }));
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
      favOccupe = true; favErreur = ''; rendre();
      // 5.406 : la photo et le titre de chaque favori choisi (ce que l'aperçu montre), pour l'écran « action en cours ».
      const items = src.filter((x) => selFav.has(x.id)).map((x) => ({ itemId: String(x.itemId || ''), photo: x.photo || '', titre: x.titre || '' }));
      demander('lancer', { selection, reglages: a.reglages, confirme: true, items, ...(rythmeDe(a.message) === 'perso' ? {} : { rythme: rythmeDe(a.message) }) }, (r) => {
        favOccupe = false;
        if (r && r.ok) {
          const suite = () => { vueFav = null; apercuFav = null; apercuFavAt = 0; rafraichir(); };
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
        rendre();
      });
    });
    if (avecListe(apercuFav)) {
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
    } else carte.querySelectorAll('[data-fav-coche]').forEach((el) => el.addEventListener('change', () => { const id = el.getAttribute('data-fav-coche'); if (el.checked) selFav.add(id); else selFav.delete(id); rendre(); }));
    carte.querySelectorAll('li.coche-l').forEach((li) => li.addEventListener('click', (ev) => { if (ev.target && ev.target.matches && ev.target.matches('input')) return; const c = li.querySelector('[data-fav-coche]'); if (c) { c.checked = !c.checked; c.dispatchEvent(new Event('change')); } }));
    const tout = avecListe(apercuFav) ? null : carte.querySelector('[data-fav-tout]');
    if (tout) tout.addEventListener('click', () => { selFav = tout.getAttribute('data-fav-tout') === 'tous' ? new Set(listeFavTriee(apercuFav).map((x) => x.id)) : new Set(); rendre(); });
    const repr = carte.querySelector('[data-fav-reprendre]');
    if (repr) repr.addEventListener('click', () => {
      repr.disabled = true;
      let capte = false; try { capte = !!document.querySelector('iframe[src*="captcha-delivery"], iframe[src*="datadome"], #datadome-captcha, iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare"]'); } catch (_) {}
      demander('reprendre', { captcha: capte }, (r) => { favErreur = r && r.ok ? '' : ((r && r.raison) || 'Rien n’a repris : l’extension n’a pas répondu.'); rafraichir(); });
    });
    const arreter = carte.querySelector('[data-fav-arreter]');
    if (arreter) arreter.addEventListener('click', () => { arreter.disabled = true; arreter.textContent = 'Arrêt…'; demander('arreter', null, () => rafraichir()); });
    const okB = carte.querySelector('[data-fav-ok]');
    if (okB) okB.addEventListener('click', () => demander('oublier', null, () => { apercuFav = null; apercuFavAt = 0; rafraichir(); }));
    // « prochain dans … » suit l'horloge tant que la carte est ouverte (aucune requête).
    clearInterval(minuteurFav); minuteurFav = null;
    const dans = carte.querySelector('[data-fav-dans]');
    if (dans) minuteurFav = setInterval(() => { if (!dans.isConnected || !carte.classList.contains('on')) { clearInterval(minuteurFav); minuteurFav = null; return; } const t = Number(dans.getAttribute('data-fav-dans')); if (t <= Date.now()) { clearInterval(minuteurFav); minuteurFav = null; rafraichir(); return; } dans.textContent = dansFav(t); }, 1000);
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
  const ONGLETS5 = ['messages', 'annonces', 'favoris', 'ventes', 'parametres'];
  let ficheOuverte = '';   // 'a:{id}' (une annonce) ou 'v:{tx}' (une vente) dépliée — une à la fois
  let menuCompteOuvert = false, ongletListe = 'messages', porteeTous = false, listes = null, listesAt = 0, listesEnVol = false, listesErreur = '';
  try { chrome.storage.local.get(['vrmCarteOnglet', 'vrmCartePortee'], (g) => { try { void chrome.runtime.lastError; } catch (_) {} g = g || {}; if (ONGLETS5.includes(g.vrmCarteOnglet)) ongletListe = g.vrmCarteOnglet; if (g.vrmCartePortee === 'tous') porteeTous = true; }); } catch (_) {}
  const eurosL = (n) => { const x = Number(n); if (!(x > 0)) return '—'; const c = Math.round(x * 100); return (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €'; };
  // 5.409 (captures « Commandes » de Vintex) : l'état en mots clairs — « Action requise : à expédier » en ambre, le reste neutre.
  const ETAT_VENTE = { a_expedier: 'Action requise : à expédier', en_route: 'En route : rien à faire', finalisee: 'Terminée', annulee: 'Annulée — pas une vente', pas_su: 'État pas encore lu' };
  function chargerListes(force) {
    if (listesEnVol || !vivant()) return;
    if (!force && listes && Date.now() - listesAt < 60000 && (!porteeTous || Array.isArray(listes.autres))) return;
    listesEnVol = true; listesErreur = '';
    try {
      chrome.runtime.sendMessage({ from: LISTES ? 'cancale-popup' : 'vrm-badge', action: 'carteListes', tous: porteeTous }, (r) => {
        void chrome.runtime.lastError;
        listesEnVol = false;
        if (r && r.ok) { listes = r; listesAt = Date.now(); } else listesErreur = 'L’extension n’a pas répondu. Réessaie dans un instant.';
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
  function annoncesHtml(e) {
    if (listesErreur) return `<div class="val gris" role="status">${esc(listesErreur)}</div>`;
    if (!listes) return '<div class="val gris" role="status" data-listes-charge>Je lis tes annonces…</div>';
    const a = listes.annonces;
    if (!a) return '<div class="val gris" data-annonces="pas_su">Tes annonces n’ont pas pu être lues pour l’instant : rien n’est affiché plutôt qu’une liste fausse.</div>';
    const ici = ORIGINE_ICI && !LISTES ? ORIGINE_ICI : 'https://www.vinted.fr';
    const tete = `<div class="lu" data-annonces-lu="${a.lu || ''}">${a.aConfirmer ? `À confirmer · lues ${esc(depuis(a.lu) || 'il y a longtemps')}` : `${Number(a.total).toLocaleString('fr-FR')} en ligne · lues ${esc(depuis(a.lu) || '')}`}${a.relecture ? ' · relecture en cours' : ''}</div>`;
    if (!a.liste.length) return tete + '<div class="val gris" data-annonces="0">Aucune annonce en ligne dans la dernière lecture de ton dressing.</div>';
    const avecN = a.liste.some((x) => x.num);
    return tete + `<ul class="rangs${avecN ? ' avec-n' : ''}" data-annonces="${a.liste.length}" data-defil="annonces">${a.liste.map((x) => `${LISTES ? `<li><a class="rang" data-annonce="${esc(x.id)}" href="${esc(ici + '/items/' + encodeURIComponent(x.id))}" target="_blank" rel="noopener">${debutN(avecN, x.num)}${vignette(x.photo)}<span class="mil"><span class="ti">${esc(x.titre || 'Annonce')}</span><span class="me"><span class="sg">${x.jours != null ? `en ligne depuis ${x.jours} j` : 'date pas lue'}</span>${x.favoris != null ? ` · <span class="sg">${x.favoris} ♥</span>` : ''}${a.aConfirmer ? ' · <span class="sg">à confirmer</span>' : ''}</span></span><span class="px">${esc(eurosL(x.prix))}</span></a></li>` : `<li${ficheOuverte === 'a:' + x.id ? ' data-ouverte' : ''}><button type="button" class="rang" data-annonce="${esc(x.id)}" data-fiche-b="a:${esc(x.id)}" aria-expanded="${ficheOuverte === 'a:' + x.id ? 'true' : 'false'}">${debutN(avecN, x.num)}${vignette(x.photo)}<span class="mil"><span class="ti">${esc(x.titre || 'Annonce')}</span><span class="me"><span class="sg">${x.jours != null ? `en ligne depuis ${x.jours} j` : 'date pas lue'}</span>${x.favoris != null ? ` · <span class="sg">${x.favoris} ♥</span>` : ''}${a.aConfirmer ? ' · <span class="sg">à confirmer</span>' : ''}</span></span><span class="px">${esc(eurosL(x.prix))}</span></button>${ficheOuverte === 'a:' + x.id ? ficheAnnonceHtml(x, ici) : ''}</li>`}`).join('')}</ul>`
      + (a.total > a.liste.length ? `<div class="val gris">Les ${a.liste.length} plus récentes · ${Number(a.total).toLocaleString('fr-FR')} en tout.</div>` : '');
  }
  function ventesHtml(e) {
    if (listesErreur) return `<div class="val gris" role="status">${esc(listesErreur)}</div>`;
    if (!listes) return '<div class="val gris" role="status" data-listes-charge>Je lis tes ventes…</div>';
    const v = listes.ventes;
    if (!v) return '<div class="val gris" data-ventes="pas_su">Tes ventes n’ont pas pu être lues pour l’instant : rien n’est affiché plutôt qu’une liste fausse.</div>';
    if (!v.liste.length) return '<div class="val gris" data-ventes="0">Aucune vente lue sur ce compte pour l’instant : ouvre une fois la page de tes ventes sur Vinted.</div>';
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
  function ficheAnnonceHtml(x, ici) {
    const photos = (Array.isArray(x.photos) && x.photos.length ? x.photos : (x.photo ? [x.photo] : [])).slice(0, 8);
    const lien = ici + '/items/' + encodeURIComponent(x.id);
    return `<div class="fiche5" data-fiche="a:${esc(x.id)}" role="region" aria-label="${esc(x.titre || '')}">`
      + (photos.length ? `<div class="ph5" data-photos="${photos.length}">${photos.map((u) => `<img src="${esc(u)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`).join('')}</div>` : '')
      + `<div class="g5">${fait5('p_num', x.num || null, 'num')}${fait5('p_prix', Number(x.prix) > 0 ? eurosL(x.prix) : null, 'prix')}${fait5('p_mini', Number(x.mini) > 0 ? eurosL(x.mini) : null, 'mini')}${fait5('p_achat', Number(x.achat) > 0 ? eurosL(x.achat) : null, 'achat')}`
      + `${fait5('p_ecart', ecart5(x.prix, x.achat), 'ecart')}${fait5('p_taille', x.taille, 'taille')}${fait5('p_marque', x.marque, 'marque')}${fait5('p_etat', x.etat, 'etat')}`
      + `${fait5('p_depuis', x.jours != null ? TU('p_jours', { n: x.jours }) : null, 'depuis')}${fait5('p_favoris', x.favoris != null ? String(x.favoris) : null, 'favoris')}${fait5('p_vues', x.vues != null ? String(x.vues) : null, 'vues')}</div>`
      + (x.description ? `<p class="desc5" data-desc>${esc(x.description)}</p>` : '')
      + `<div class="ge5"><a class="vu-btn vu-sec" href="${esc(lien)}" target="_top" data-geste="ouvrir">${esc(TU('p_ouvrir_vinted'))}</a><a class="vu-btn vu-sec" href="https://vrm.center/?tab=annonces&site=vinted" target="_blank" rel="noopener" data-geste="vrm">${esc(TU('p_gerer_vrm'))}</a></div></div>`;
  }
  function ficheVenteHtml(x, ici) {
    const conv = /^[1-9]\d{0,19}$/.test(String(x.conv || '')) ? x.conv : '';
    return `<div class="fiche5" data-fiche="v:${esc(x.tx)}" role="region" aria-label="${esc(x.titre || '')}">`
      + (x.photo ? `<div class="ph5" data-photos="1"><img src="${esc(x.photo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>` : '')
      + `<div class="g5">${fait5('p_num', x.num || null, 'num')}${fait5('p_prix', Number(x.prix) > 0 ? eurosL(x.prix) : null, 'prix')}${fait5('p_etat_vente', ETAT_VENTE[x.etat] || null, 'etat')}`
      + `${fait5('p_bordereau', x.bordereau === true ? TU('p_pret') : x.bordereau === false ? TU('p_pas_la') : null, 'bordereau')}${fait5('p_date', x.date ? depuis(x.date) : null, 'date')}</div>`
      + `<div class="ge5">${conv ? `<a class="vu-btn vu-sec" href="${esc(ici + '/inbox/' + conv)}" target="_top" data-geste="conv">${esc(TU('p_ouvrir_conv'))}</a>` : ''}<a class="vu-btn vu-sec" href="https://vrm.center/?tab=ventes&site=vinted&cible=vente&tx=${encodeURIComponent(x.tx)}" target="_blank" rel="noopener" data-geste="vrm">${esc(TU('p_gerer_vrm'))}</a></div></div>`;
  }
  // ══ 5.409 — MESSAGES : les conversations du compte de l'onglet (la boîte rangée), du plus récent ═════════
  // Toucher une conversation l'ouvre sur Vinted (la réponse part de Vinted : la carte n'envoie pas encore).
  // 5.409 (captures « Conversations » de Vintex envoyées par Julien) : deux volets à l'ordinateur — la liste à gauche
  // (filtre « Non lus · N », recherche), la conversation choisie à droite (article, pseudo, dernier message, la
  // réponse s'ouvre sur Vinted) ; au téléphone, la liste seule, une conversation dépliée sous sa rangée.
  let convChoisie = '', msgNonLus = false, msgCherche = '';
  function convHtml(x, ici) {
    return `<div class="conv5" data-conv-ouverte="${esc(x.conv)}">${x.photo ? `<img class="conv5-ph" src="${esc(x.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<div class="conv5-t"><b>${esc(x.qui || '—')}</b><span>${esc(x.at ? depuis(x.at) : '')}</span></div>`
      + `<div class="bulle" data-conv-texte>${esc(x.texte || '')}</div><div class="ge5"><a class="vu-btn vu-plein" href="${esc(ici + '/inbox/' + x.conv)}" target="_top" data-geste="repondre">${esc(TU('m_repondre'))}</a></div></div>`;
  }
  function messagesHtml() {
    if (listesErreur) return `<div class="val gris" role="status">${esc(listesErreur)}</div>`;
    if (!listes) return `<div class="val gris" role="status" data-listes-charge>${esc(TU('m_charge'))}</div>`;
    const m = listes.messages;
    if (!m) return `<div class="val gris" data-messages="pas_su">${esc(TU('m_pas_su'))}</div>`;
    if (!m.liste.length) return `<div class="val gris" data-messages="0">${esc(TU('m_aucun'))}</div>`;
    const ici = ORIGINE_ICI && !LISTES ? ORIGINE_ICI : 'https://www.vinted.fr';
    const nl = m.liste.filter((x) => x.nonlu).length;
    const q = msgCherche.trim().toLowerCase();
    const vus = m.liste.filter((x) => (!msgNonLus || x.nonlu) && (!q || String(x.qui).toLowerCase().includes(q) || String(x.texte).toLowerCase().includes(q)));
    const lu = depuis(m.lu);
    const choisie = vus.find((x) => x.conv === convChoisie) || null;
    const outils = LISTES ? '' : `<div class="outils5"><input type="search" class="cherche5" data-msg-cherche placeholder="${esc(TU('m_chercher'))}" aria-label="${esc(TU('m_chercher'))}" value="${esc(msgCherche)}"><button type="button" class="filtre5" data-msg-nonlus aria-pressed="${msgNonLus ? 'true' : 'false'}">${esc(TU('m_filtre_nonlus', { n: nl }))}</button></div>`;
    const liste = `<ul class="rangs" data-messages="${vus.length}" data-defil="messages">${vus.map((x) => LISTES
      ? `<li><a class="rang${x.nonlu ? ' nonlu' : ''}" data-conv="${esc(x.conv)}" href="${esc(ici + '/inbox/' + x.conv)}" target="_blank" rel="noopener">${vignette(x.photo)}<span class="mil"><span class="ti">${esc(x.qui || '—')}</span><span class="me">${esc(x.texte || '')}</span></span></a></li>`
      : `<li${x.conv === convChoisie ? ' data-ouverte' : ''}><button type="button" class="rang${x.nonlu ? ' nonlu' : ''}" data-conv="${esc(x.conv)}" data-conv-b="${esc(x.conv)}" aria-pressed="${x.conv === convChoisie ? 'true' : 'false'}">${vignette(x.photo)}<span class="mil"><span class="ti">${x.nonlu ? '<i class="pt5" aria-label="non lu"></i>' : ''}${esc(x.qui || '—')}</span><span class="me">${esc(x.texte || '')}</span></span><span class="px quand">${esc(x.at ? depuis(x.at) : '')}</span></button>${x.conv === convChoisie ? `<div class="conv5-sous">${convHtml(x, ici)}</div>` : ''}</li>`).join('')}</ul>`;
    const tete = `<div class="lu" data-messages-nonlus="${nl}">${esc(nl ? TU('m_nonlus', { n: nl }) : TU('m_tous_lus'))}${lu ? ' · ' + esc(TU('c_lu', { quand: lu })) : ''}</div>`;
    if (LISTES) return tete + liste;
    const droite = `<div class="volet5" data-volet-conv="${choisie ? esc(choisie.conv) : ''}">${choisie ? convHtml(choisie, ici) : `<div class="vide5"><b>${esc(TU('m_choisir'))}</b><span>${esc(TU('m_choisir_note'))}</span></div>`}</div>`;
    return `<div class="deux5"><div class="gauche5">${outils}${tete}${vus.length ? liste : `<div class="val gris" data-messages-filtre="0">${esc(TU('m_aucun_filtre'))}</div>`}</div>${droite}</div>`;
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
  function listesHtml(e, parametres) {
    const vinted = !e || e.plateforme === 'vinted';
    const nomSite = (e && NOM_SITE[e.plateforme]) || 'ce site';
    let panneau;
    if (ongletListe === 'favoris') panneau = !vinted ? `<div class="val gris" data-favoris-site="${esc(e.plateforme)}">${esc(nomSite)} ne dit pas qui a mis tes annonces en favori : il n’y a personne à qui écrire d’ici.</div>`
      : LISTES ? '<div class="val gris" data-favoris-fenetre>Les messages aux favoris partent de l’onglet Vinted : ouvre vinted.fr, puis touche le logo VRM.</div>'
      : (favorisOngletHtml(e) || '<div class="val gris">Pas encore de favoris lus : ouvre la cloche de Vinted une fois.</div>');
    else if (!vinted) panneau = `<div class="val gris" data-liste-site="${esc(e.plateforme)}">Sur ${esc(nomSite)}, tes ${ongletListe === 'ventes' ? 'ventes' : 'annonces'} sont dans les pages du site (liens ci-dessous) : la carte ne les recopie pas encore.</div>`;
    else if (ongletListe === 'parametres') panneau = parametres || `<div class="val gris">${esc(TU('r_rien'))}</div>`;
    else if (ongletListe === 'messages') panneau = !vinted ? `<div class="val gris" data-liste-site="${esc(e.plateforme)}">${esc(TU('m_site', { site: nomSite }))}</div>` : messagesHtml();
    else panneau = ongletListe === 'annonces' ? annoncesHtml(e) : ventesHtml(e);
    const tab = (k, t) => `<button role="tab" data-onglet-b="${k}" aria-selected="${ongletListe === k ? 'true' : 'false'}"${ongletListe === k ? ' data-actif' : ''}>${t}</button>`;
    const nom = listes && listes.compte && listes.compte.nom ? listes.compte.nom : (e && e.site && e.site.nom) || '';
    return `<section class="listes listes5" data-listes data-onglet="${ongletListe}" data-portee="${porteeTous ? 'tous' : 'ce'}">
      ${vinted && LISTES ? `<div class="vu-seg seg-portee portee" role="group" aria-label="${esc(TU('c_tous'))}"><button data-portee-b="ce" aria-pressed="${porteeTous ? 'false' : 'true'}"${porteeTous ? '' : ' data-actif'}>${nom ? esc(nom) : esc(TU('c_ce_compte'))}</button><button data-portee-b="tous" aria-pressed="${porteeTous ? 'true' : 'false'}"${porteeTous ? ' data-actif' : ''}>${esc(TU('c_tous'))}</button></div>` : ''}
      <div class="vu-seg seg5" role="tablist" aria-label="${esc(TU('c_ce_compte'))}">${tab('messages', esc(TU('c_messages')))}${tab('annonces', esc(TU('c_annonces')))}${tab('favoris', esc(TU('c_favoris')))}${tab('ventes', esc(TU('c_ventes')))}${LISTES ? '' : `<button role="tab" class="reg5" data-onglet-b="parametres" aria-label="${esc(TU('c_parametres'))}" title="${esc(TU('c_parametres'))}" aria-selected="${ongletListe === 'parametres' ? 'true' : 'false'}"${ongletListe === 'parametres' ? ' data-actif' : ''}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.6 4.9-1.7-.3a7 7 0 0 1-.6 1.5l1 1.4-1.4 1.4-1.4-1a7 7 0 0 1-1.5.6l-.3 1.7h-2l-.3-1.7a7 7 0 0 1-1.5-.6l-1.4 1-1.4-1.4 1-1.4a7 7 0 0 1-.6-1.5l-1.7-.3v-2l1.7-.3c.1-.5.3-1 .6-1.5l-1-1.4 1.4-1.4 1.4 1c.5-.3 1-.5 1.5-.6l.3-1.7h2l.3 1.7c.5.1 1 .3 1.5.6l1.4-1 1.4 1.4-1 1.4c.3.5.5 1 .6 1.5l1.7.3v2Z"/></svg><span class="lib5">${esc(TU('c_parametres'))}</span></button>`}</div>
      <div class="panneau" role="tabpanel" data-panneau="${ongletListe}">${panneau}</div>
      ${vinted && (ongletListe === 'annonces' || ongletListe === 'ventes') ? autresHtml() : ''}
    </section>`;
  }
  function brancherListes(racine, e) {
    racine.querySelectorAll('[data-onglet-b]').forEach((b) => b.addEventListener('click', () => {
      ongletListe = b.getAttribute('data-onglet-b'); ranger({ vrmCarteOnglet: ongletListe });
      if (ongletListe !== 'favoris') chargerListes(false);
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
    racine.querySelectorAll('[data-conv-b]').forEach((b) => b.addEventListener('click', () => { const k = b.getAttribute('data-conv-b'); convChoisie = convChoisie === k ? '' : k; rendre(); }));
    const nlB = racine.querySelector('[data-msg-nonlus]'); if (nlB) nlB.addEventListener('click', () => { msgNonLus = !msgNonLus; rendre(); });
    const ch = racine.querySelector('[data-msg-cherche]'); if (ch) ch.addEventListener('input', () => { msgCherche = ch.value; const pos = ch.selectionStart; rendre(); const n = carte.querySelector('[data-msg-cherche]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } });
    // 5.409 : toucher une rangée déplie SA fiche (une à la fois) ; la retoucher la replie.
    racine.querySelectorAll('[data-fiche-b]').forEach((b) => b.addEventListener('click', () => {
      const k = b.getAttribute('data-fiche-b'); ficheOuverte = ficheOuverte === k ? '' : k;
      if (LISTES) rendreListesSeules(); else rendre();
    }));
    if ((ongletListe !== 'favoris' && ongletListe !== 'parametres') || porteeTous) chargerListes(false);
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
    const grand5 = !!avecListes && e.plateforme === 'vinted' && !LISTES && !CADRE;
    const detailsHtml = `
      <details class="detail" data-detail${ouvert ? ' open' : ''}><summary><span>${esc(TU('c_details'))}${e.version ? ' · ' + esc(e.version) : ''}</span></summary>
      <div class="ligne"><div class="lib">Compte VRM utilisé</div>${compteVrm}</div>
      ${lbcVisible ? '' : `<div class="ligne"><div class="lib">Compte ${esc(nomSite)}</div>${compteSite}</div>`}
      ${e.capte && !(e.plateforme === 'leboncoin' && e.lbc) ? `<div class="ligne"><div class="lib">Tes données</div>${flux}</div>` : ''}
      ${e.mesure ? `<div class="ligne"><div class="lib">Mesure</div><div class="val gris">VRM apprend à lire ${esc(nomSite)} : il relève la forme des pages, jamais leur contenu. Aucune vente ni annonce n'est encore captée.</div>${(() => { const f = e.flux || {}; return f.koAt && (!f.okAt || f.koAt > f.okAt) ? `<div class="val alerte">Dernier relevé refusé ${esc(depuis(f.koAt))}</div>` : f.okAt ? `<div class="val gris">Relevé envoyé ${esc(depuis(f.okAt))}</div>` : ''; })()}</div>` : ''}
      ${outils ? `<div class="outils">${outils}</div>` : ''}${rapTexte ? `<div class="rep" data-rapport-etat role="status">${esc(rapTexte)}</div>` : ''}
      </details>`;
    const lienVrm = (q, k) => `<a class="rg5" href="https://vrm.center/${q}" target="_blank" rel="noopener" data-reglage-vrm="${esc(k)}"><span>${esc(TU(k))}</span><i aria-hidden="true">›</i></a>`;
    const parametres5 = grand5 ? `<div class="par5" data-parametres>
      <section class="grp5"><h3>${esc(TU('r_logo'))}</h3><p class="note5">${esc(TU('r_logo_note'))}</p><div class="outils">${`<button class="lien" data-mini-logo>${mini ? 'Agrandir le logo' : 'Réduire le logo'}</button>`}${`<button class="lien" data-replacer-logo>${esc(TU('r_remettre'))}</button>`}</div></section>
      <section class="grp5"><h3>${esc(TU('r_arrivee'))}</h3><div class="outils">${e.capteCoupe === true || e.capteCoupe === false ? `<button class="lien" data-capte-reglage="${e.capteCoupe ? 'allumer' : 'couper'}">${e.capteCoupe ? 'Dire ce que VRM capte' : 'Ne plus dire ce que VRM capte'}</button>` : ''}${moisMasque ? '<button class="lien" data-mois-afficher>Afficher le résumé du mois</button>' : ''}</div></section>
      <section class="grp5"><h3>${esc(TU('r_vrm'))}</h3>${lienVrm('?tab=settings&section=discretion', 'r_rythme')}${lienVrm('?tab=settings&section=notifications', 'r_notifs')}${lienVrm('?tab=settings', 'r_langue')}</section>
      ${connecte && e.toutArrete ? '<div class="outils"><button class="lien" data-tout-reprendre>Reprendre les gestes automatiques</button></div>' : ''}
      ${detailsHtml.replace('<div class="outils">' + outils + '</div>', '<div class="outils">' + [v && v.connecte && !changerCompte ? '<button class="lien" data-changer-vrm>Changer de compte VRM</button>' : '', v && v.connecte ? '<button class="lien" data-rapport>Envoyer un rapport</button>' : ''].join('') + '</div>')}
    </div>` : '';
    if (grand5) carte.setAttribute('data-grand', ''); else carte.removeAttribute('data-grand');
    const principal = connecte && e.plateforme === 'vinted' ? favorisFileHtml(e) : '';
    poserHtml(contenu, `<button class="fermer" data-fermer-carte title="${esc(TU('c_fermer'))}" aria-label="${esc(TU('c_fermer'))}">×</button>${lbcVisible ? `<div class="t5"><b class="nom">VRM</b></div>` : tete5}
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
    brancherReparer();
    brancherRapport();
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
  // 5.409 : Échap ferme le grand panneau (le ✕ aussi) ; jamais quand on tape dans un champ du site.
  try { document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && carte.classList.contains('on') && carte.hasAttribute('data-grand')) { fermerCarte(); } }, true); } catch (_) {}
  function ouvrirConnexion() { doigt = true; formulaireDemande = true; carte.classList.add('on'); rendre(); }
  function fermerCarte() { if (LISTES) return; doigt = false; justeConnecte = false; vueFav = null; favErreur = ''; if (changerCompte) { changerCompte = false; formulaireDemande = false; rendre(); } carte.classList.remove('on'); }

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

  (CADRE || LISTES ? (document.body || document.documentElement) : (document.documentElement || document.body)).appendChild(hote);
  rafraichir();
})();
