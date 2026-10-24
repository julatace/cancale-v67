// inject.js — tourne dans le "MAIN world" de la page vinted.fr (le meme monde
// que le JavaScript du site), ce qui permet d'observer les vraies requetes que
// la page fait deja. On NE declenche AUCUNE requete : on se contente de
// regarder passer ce que Vinted envoie deja au navigateur quand tu navigues.
//
// Deux choses capturees :
//   1) le header 'x-csrf-token' des requetes (introuvable autrement) ;
//   2) le CORPS des reponses des endpoints utiles (annonces, ventes, messages,
//      profil) — c'est la "capture passive" : la donnee est deja la, on la lit.
//
// Tout est renvoye a content.js via window.postMessage (le seul canal entre le
// MAIN world et l'extension).
(function () {
  'use strict';
  if (window.__cancaleVintedInjected) return;
  window.__cancaleVintedInjected = true;

  const TAG = 'CANCALE_VINTED';

  // Endpoints dont on veut garder la reponse, avec le "type" de donnee associe.
  // ⚠️ Motifs volontairement TOLÉRANTS à la version d'API (v2, v3, …). Vinted a
  // migré une partie de son site vers /api/v3/ : les motifs figés sur /api/v2/
  // ne captaient plus rien pour les annonces / commandes / boîte de réception
  // (moisson bloquée pendant 18 jours sans que personne ne s'en aperçoive).
  const HARVEST = [
    { re: /\/api\/v\d+\/wardrobe\/(\d+)\/items/, type: 'listings' },
    // Variante « dressing » : certaines versions listent les articles d'un
    // utilisateur via /items?user_id=… au lieu de /wardrobe/{id}/items.
    { re: /\/api\/v\d+\/items\?[^]*user_id=(\d+)/, type: 'listings' },
    // Détail COMPLET d'un article : /api/v2/items/{id} → titre, DESCRIPTION,
    // marque, taille, état, couleur, matière, CATÉGORIE (catalog_id), dimensions
    // du colis, photos HD. Capté passivement quand tu ouvres une de tes annonces
    // (et complété activement, voir plus bas) → l'app a TOUT pour la republier.
    { re: /\/api\/v\d+\/items\/(\d+)(?:\?|$)/,   type: 'item'     },
    { re: /\/api\/v\d+\/my_orders/,             type: 'orders'   },
    { re: /\/api\/v\d+\/(?:inbox|conversations)(?:\?|$)/, type: 'inbox' },
    { re: /\/api\/v\d+\/conversations\/(\d+)/,  type: 'conversation' },
    // Détail d'une transaction (vente/achat) : son ÉTAT (`status`, `status_title`,
    // `shipment {id, status, status_title, status_updated_at}`), capté passivement
    // quand tu ouvres une commande ou télécharges un bordereau. On ne matche QUE le
    // détail (…/transactions/{id}), pas les sous-chemins (…/shipment/order).
    // ⚠️⚠️ (23 octobre) CE COMMENTAIRE DISAIT QUE LE N° DE SUIVI DU TRANSPORTEUR
    //    ÉTAIT ICI (« shipment / tracking_code ») : FAUX, mesuré en lecture seule —
    //    0 n° de suivi sur 1 290 transactions captées, 0 dans 1 400 conversations,
    //    0 dans les commandes. Le suivi que Vinted MONTRE de ses achats (le bouton
    //    « Suivre le colis ») passe par `…/shipment/journey_summary` : voir
    //    `noteSuivi` plus bas (5.214).
    { re: /\/api\/v\d+\/transactions\/(\d+)(?:\?|$)/, type: 'transaction' },
    { re: /\/api\/v\d+\/users\/current/,        type: 'profile'  },
    // NOTIFICATIONS VINTED (la cloche) — 30 septembre. Mesuré par l'observation
    // de Vintex : c'est là que Vinted dit QUI a mis un article en favori
    // (« X a marqué ton article Y comme favori »), avec le pseudo. §3 disait
    // « Vinted ne dit jamais qui met en favori » : faux pour ce flux-là.
    // L'extension n'avait JAMAIS vu cette adresse (0 dans seen_urls). On garde
    // la réponse telle quelle quand la page la charge (ouvrir la cloche), pour
    // MESURER sa forme avant d'écrire la moindre règle dessus.
    // Le service inbox-notifications vit hors /api/. Son comptage seul
    // (unread_count) n'est pas une liste et ne remplace jamais la capture.
    // Le rapprochement favoris/conversation reste à vérifier sur le vrai flux.
    // LITIGES / RÉCLAMATIONS. Quand un acheteur ouvre un litige, la paire te
    // revient (ou pas) et il faut la republier — mais Vinted ne le dit que dans
    // cet écran. On capte la LISTE et le DÉTAIL, passivement, quand tu ouvres la
    // page « Litiges » ou une conversation en litige : l'app peut alors afficher
    // le vrai motif et le vrai statut au lieu de les déduire du statut de vente.
    { re: /\/api\/v\d+\/complaints(?:\?|$)/,     type: 'complaints' },
    { re: /\/api\/v\d+\/complaints\/(\d+)(?:\?|$)/, type: 'complaint' },
    // Facturation / porte-monnaie : c'est là que Vinted liste tes dépenses de
    // BOOST (remontées d'annonce, mise en avant du dressing). Capté passivement
    // quand tu ouvres ton porte-monnaie / ta facturation → l'app calcule ton
    // bénéfice NET tout seul. Motif large (plusieurs noms selon la version).
    { re: /\/(wallet|invoices?|billing|bumps?|item_bumps|push_ups?|dressing_spotlight|vas_entries|payments?)/i, type: 'billing' },
    // Points relais que Vinted te propose quand tu choisis un relais (achat) :
    // c'est SA liste officielle, complète, autour de l'adresse de livraison. On
    // la capte passivement pour l'afficher sur la carte. Motif large (Vinted a
    // plusieurs noms d'endpoint selon le transporteur / la version).
    { re: /pickup[_-]?points?|pudo|drop[_-]?off[_-]?points?|shipping[_-]?points?|parcel[_-]?shops?|point[_-]?of[_-]?delivery|delivery[_-]?points?/i, type: 'pickup_points' },
    // DÉTAIL D'UNE EXPÉDITION — « où vais-je chercher ce colis ? ».
    // ⚠️ Mesuré : la transaction ne porte QUE `shipment {id,status,status_title,
    // status_updated_at}` — aucune adresse (§16, reconfirmé aujourd'hui). Et les
    // 2 colis réellement à retirer n'ont AUCUN email de suivi, donc ni code ni
    // lieu : c'est exactement « je ne sais pas où aller chercher mes colis ».
    // La transaction donne pourtant le `shipment.id`, et Vinted sert bien des
    // `/shipments/{id}/…` (vus dans seen_urls). On capte donc le détail quand la
    // page de suivi le charge — une ligne PAR COLIS (`ship_{id}`), sinon un colis
    // écraserait le précédent.
    // ⚠️ Borné à `(?:\?|$)` : les sous-chemins (label_url, label_options,
    // nearby_drop_off_points) ont déjà leur propre traitement, il ne faut pas
    // que ce motif les avale.
    { re: /\/api\/v\d+\/shipments\/(\d+)(?:\?|$)/, type: 'shipment' },
  ];
  const adresseNotificationsVinted = (url) => {
    try {
      const u = new URL(url, location.origin);
      if (u.protocol !== 'https:' || u.username || u.password || !/^(?:(?:www|api)\.)?vinted\.(?:fr|com|it|de)$/i.test(u.hostname)) return null;
      return u;
    } catch (_) { return null; }
  };
  const listeNotificationsVinted = (url) => {
    const u = adresseNotificationsVinted(url);
    return !!u && /^\/(?:api\/v\d+\/(?:user_)?notifications|inbox-notifications\/v\d+\/notifications)\/?$/i.test(u.pathname);
  };
  const traceNotificationsVinted = (url) => {
    const u = adresseNotificationsVinted(url);
    return !!u && /^\/(?:api\/v\d+\/(?:user_)?notifications|inbox-notifications\/v\d+\/notifications)(?:\/|$)/i.test(u.pathname);
  };
  const matchHarvest = (url) => {
    if (listeNotificationsVinted(url)) return {type:'notifications',id:null};
    for (const h of HARVEST) {
      const m = h.re.exec(url);
      if (!m) continue;
      let type = h.type;
      // Pour les commandes, on distingue achats et ventes via le param ?type=
      // (ex: my_orders?type=sold -> "orders_sold"), sinon elles s'ecraseraient.
      if (type === 'orders') {
        const t = /[?&]type=([^&]+)/.exec(url);
        // Sans ?type=, la reponse MELANGE ventes et achats : la ranger
        // produirait une ligne ambigue que l'app ne peut pas departager (elle
        // affichait alors des achats dans les ventes). On ne la garde pas.
        if (!t) return null;
        const raw = decodeURIComponent(t[1]).toLowerCase();
        // ⚠️ On NE range QUE les deux clefs canoniques : orders_sold (ventes) et
        // orders_purchased (achats). Le param ?type=bought renvoie chez certains
        // comptes les VENTES (verifie en base) : rangee en "orders_bought", cette
        // ligne faisait afficher des ventes dans les achats. On l'ignore, ainsi
        // que tout autre type inconnu.
        if (/sold|sell/.test(raw)) type = 'orders_sold';
        else if (raw === 'purchased' || raw === 'purchases') type = 'orders_purchased';
        else return null;
      }
      return { type, id: m[1] || null };
    }
    return null;
  };

  const post = (payload) => {
    try { window.postMessage(Object.assign({ __tag: TAG }, payload), '*'); } catch (_) {}
  };

  let lastCsrf = null; // dernier x-csrf-token vu (réutilisé pour la moisson active)
  let lastAnon = null; // dernier x-anon-id vu
  const sendCsrf = (headers) => {
    try {
      let csrf = null;
      if (headers instanceof Headers) { csrf = headers.get('x-csrf-token'); const a = headers.get('x-anon-id'); if (a) lastAnon = a; }
      else if (headers && typeof headers === 'object') {
        for (const k in headers) { const kl = k.toLowerCase(); if (kl === 'x-csrf-token') csrf = headers[k]; else if (kl === 'x-anon-id') lastAnon = headers[k]; }
      }
      if (csrf) { lastCsrf = csrf; post({ kind: 'csrf', csrf }); }
    } catch (_) {}
  };

  // MOUCHARD D'ENDPOINTS (diagnostic). On note UNIQUEMENT le chemin des appels
  // API que la page fait (jamais le contenu, jamais les paramètres). Ça permet
  // de voir tout de suite quand Vinted renomme/déplace un endpoint, au lieu de
  // découvrir des semaines plus tard que la moisson est muette. Envoyé au plus
  // une fois par minute, liste dédupliquée.
  const seenPaths = new Set();
  const seenRep = {};                    // "METHOD /chemin" → { st, n }
  let seenDirty = false;
  // ⚠️⚠️ POURQUOI LE CODE DE RÉPONSE, ET POURQUOI LES PAGES NON-API.
  // Demande de Julien, 19 septembre : son compte PRO est bloqué, et le bouton
  // « télécharger mes données » des réglages Vinted le renvoie sur « ton compte
  // est bloqué ». Impossible de savoir, de l'extérieur, si la requête d'export
  // PART et se fait refuser par le serveur (403 → aucun contournement côté
  // navigateur ne servira) ou si elle n'est jamais envoyée parce que c'est
  // seulement la page qui redirige (→ la donnée est peut-être atteignable). Les
  // deux cas n'appellent pas du tout le même geste, et les distinguer demande
  // **le statut**, que ce mouchard ne notait pas. Il ne notait pas non plus les
  // adresses hors `/api/` : une page de réglages ne laissait donc aucune trace.
  // ⚠️ La promesse de confidentialité ne change pas : chemin + méthode + statut,
  //    JAMAIS le contenu, jamais les paramètres — les identifiants numériques
  //    sont même remplacés par `{id}` (voir `chemin()`).
  const PAGE_A_NOTER = /(export|download|telecharg|takeout|gdpr|rgpd|privacy|donnees|data|settings|parametres|reglages|account|compte|blocked|bloque|suspend|restrict)/i;
  const chemin = (url) => {
    let p = url;
    try { p = new URL(url, location.origin).pathname; } catch (_) { p = String(url).split('?')[0]; }
    return p.replace(/\/\d{3,}/g, '/{id}');       // jamais un identifiant réel
  };
  const noteSeen = (url, method, status) => {
    try {
      const estApi = /\/api\//.test(url || '');
      const p = chemin(url || '');
      // Hors API, on ne note que ce qui peut concerner un export ou le compte :
      // tout noter ferait une liste de bruit, et §7 vaut aussi pour un diagnostic.
      if (!estApi && !PAGE_A_NOTER.test(p) && !traceNotificationsVinted(url)) return;
      if (!seenPaths.has(p)) { seenPaths.add(p); seenDirty = true; }
      if (status == null) return;
      const cle = `${String(method || 'GET').toUpperCase()} ${p}`;
      const av = seenRep[cle];
      // On garde le dernier statut vu et combien de fois : « 403 une fois » et
      // « 403 à chaque essai » ne se lisent pas pareil.
      if (!av || av.st !== Number(status)) seenDirty = true;
      seenRep[cle] = { st: Number(status), n: ((av && av.n) || 0) + 1, at: new Date().toISOString() };
      // ⚠️⚠️ UNE PAGE QUI REBONDIT N'ATTEINT JAMAIS LE VIDAGE À 5 s.
      // Mesuré le 19 septembre : il a cliqué sur « télécharger mes infos » avec
      // son compte bloqué, la page l'a renvoyé aussitôt sur « compte bloqué »,
      // et le relevé de CETTE page n'est jamais parti — seuls les chemins de la
      // page d'avant (son dressing) ont été rangés. `pagehide` ne suffit pas :
      // un `sendMessage` depuis une page qui se décharge part rarement.
      // ⇒ Ce qui est INTÉRESSANT s'envoie sur-le-champ : un appel qui ÉCHOUE
      //   (≥ 400), ou un appel sur un chemin de compte/export. C'est justement
      //   le cas où la page ne nous laisse pas le temps.
      try { if (Number(status) >= 400 || PAGE_A_NOTER.test(p) || traceNotificationsVinted(url)) setTimeout(flushSeen, 0); } catch (_) {}
    } catch (_) {}
  };
  const flushSeen = () => {
    if (!seenDirty || (!seenPaths.size && !Object.keys(seenRep).length)) return;
    seenDirty = false;
    post({ kind: 'seen_urls', paths: Array.from(seenPaths).slice(0, 300), reponses: seenRep });
  };
  // Envoi RAPIDE puis régulier : une page Vinted est souvent quittée avant 60 s,
  // et le diagnostic ne partait alors jamais. On envoie à 5 s, puis toutes les
  // 20 s, et aussi quand tu quittes/masques la page (dernière chance).
  setTimeout(flushSeen, 5000);
  setInterval(flushSeen, 20000);
  try {
    window.addEventListener('pagehide', flushSeen);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushSeen(); });
  } catch (_) {}
  // La page elle-même est notée : c'est elle qui redirige quand un compte est
  // bloqué, et sans ça on ne sait même pas qu'il y est passé.
  try { noteSeen(location.href, 'PAGE', null); } catch (_) {}

  const sendHarvest = (url, text, method = 'GET', status = null) => {
    noteSeen(url);
    const h = matchHarvest(url);
    if (!h) return;
    if (h.type === 'notifications' && (String(method).toUpperCase() !== 'GET' || (status != null && (status < 200 || status >= 300)))) return;
    // On limite la taille pour ne pas saturer (les reponses Vinted sont petites).
    if (text && text.length < 800000) post({ kind: 'harvest', type: h.type, id: h.id, url, body: text });
  };

  // CAPTURE PASSIVE DES REQUETES D'ECRITURE. Toujours de l'OBSERVATION pure : on
  // note la forme des requetes que TU declenches quand tu agis sur Vinted
  // (baisser un prix, repondre a un message...). Ca sert a l'app pour reproduire
  // ensuite exactement la meme action en 1 clic, sans jamais deviner. On exclut
  // le bruit (tracking/metrics) et on ne garde que les vraies actions API.
  const WRITE_METHODS = /^(POST|PUT|PATCH|DELETE)$/i;
  const WRITE_NOISE = /(track|metric|event|impression|visit|telemetr|analytic|log|pageview|consent)/i;
  const sendWriteReq = (method, url, body) => {
    try {
      if (!WRITE_METHODS.test(method || '')) return;
      if (!/\/api\//.test(url || '')) return;
      if (WRITE_NOISE.test(url)) return;
      let b = body;
      if (b && typeof b !== 'string') {
        if (typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams) b = b.toString();
        else if (typeof FormData !== 'undefined' && b instanceof FormData) {
          // 1er oct. : la FORME de l'envoi (noms des champs, type et taille des
          // fichiers), jamais le contenu d'un fichier. C'est ce qui manque pour
          // renvoyer une photo lors d'une republication (POST /api/v2/photos).
          // Les valeurs texte courtes sont gardées (type, uuid temporaire) ;
          // les longues sont réduites à leur longueur.
          try {
            const parts = [];
            b.forEach((v, k) => {
              if (typeof File !== 'undefined' && v instanceof File) parts.push(k + '=Fichier(' + (v.type || '?') + ',' + v.size + 'o)');
              else { const t = String(v); parts.push(k + '=' + (t.length <= 40 ? t : '[' + t.length + ' car.]')); }
            });
            b = '[FormData] ' + parts.slice(0, 20).join(' & ');
          } catch (_) { b = '[FormData]'; }
        }
        else { try { b = JSON.stringify(b); } catch (_) { b = String(b); } }
      }
      if (b && b.length > 100000) b = b.slice(0, 100000);
      post({ kind: 'writereq', method: String(method).toUpperCase(), url, body: b || '' });
    } catch (_) {}
  };

  // ── UNE ANNONCE QUE TU SUPPRIMES SORT DE VRM TOUT DE SUITE (5.165) ──────────
  // Julien, 9 octobre : « je viens de supprimer beaucoup de paires et elles sont
  // encore marquées dans les annonces ». La seule trace était `writereq`, posée
  // AVANT la requête (donc aussi pour une suppression REFUSÉE) et sans statut —
  // et une ligne par compte, écrasée à chaque fois. Le statut, lui, ne partait
  // qu'au vidage du mouchard (5 s, 20 s) : une page qui navigue juste après le
  // 200 le perdait, et il ne portait pas l'identifiant (`{id}`).
  // ⇒ On regarde la RÉPONSE, dans son rappel (avant le code de Vinted qui
  //   navigue), et on ne retient qu'une suppression RÉUSSIE (2xx), sur Vinted,
  //   par son IDENTIFIANT d'annonce (§5) — jamais le corps, jamais un titre.
  //   C'est une LECTURE de ce que la page vient de faire sur SON clic : zéro
  //   requête de plus vers Vinted (§3).
  const RE_SUPPR = /^\/api\/v\d+\/items\/(\d{4,15})\/delete\/?$/;
  const noteSuppression = (method, url, status) => {
    try {
      if (String(method || '').toUpperCase() !== 'POST') return;
      const st = Number(status);
      if (!(st >= 200 && st < 300)) return;               // refusée, échouée : rien
      let U = null; try { U = new URL(url, location.origin); } catch (_) { return; }
      if (!/(^|\.)vinted\.[a-z.]+$/i.test(U.hostname)) return;
      const m = RE_SUPPR.exec(U.pathname);
      if (!m) return;
      post({ kind: 'suppression', itemId: m[1], status: st, at: new Date().toISOString() });
    } catch (_) {}
  };

  // ── LA PUBLICATION D'UNE ANNONCE (20 octobre, 5.201) ───────────────────────
  // Vinted crée l'annonce par `POST /api/v2/item_upload/items` (vu dans ses
  // chemins captés). On lit l'IDENTIFIANT de l'annonce dans la réponse (2xx
  // seulement) — c'est lui qui relie le numéro affiché à côté du bouton à
  // CETTE annonce (§5). Jamais un titre. Forme inconnue ⇒ on dit seulement
  // les NOMS de clés (rien de lié). (22 oct. : le corps envoyé part à part,
  // en `fiche`, pour sa description — voir `noteModification` juste après.)
  const RE_PUBLIE = /^\/api\/v\d+\/item_upload\/items\/?$/;
  const notePublication = (method, url, status, lireTexte, corps) => {
    try {
      if (String(method || '').toUpperCase() !== 'POST') return;
      const st = Number(status);
      if (!(st >= 200 && st < 300)) return;
      let U = null; try { U = new URL(url, location.origin); } catch (_) { return; }
      if (!/(^|\.)vinted\.[a-z.]+$/i.test(U.hostname) || !RE_PUBLIE.test(U.pathname)) return;
      Promise.resolve().then(lireTexte).then((t) => {
        let j = null; try { j = JSON.parse(t); } catch (_) {}
        const it = j && (j.item && typeof j.item === 'object' ? j.item : j);
        const id = it && it.id != null ? String(it.id) : '';
        if (/^\d{4,15}$/.test(id)) {
          post({ kind: 'publication', itemId: id, status: st });
          const tc = (typeof corps === 'string' && corps.length <= 100000) ? corps : '';   // 22 oct. : sa fiche, sous l'identifiant que Vinted vient de donner
          if (tc) post({ kind: 'fiche', itemId: id, status: st, via: 'publication', corps: tc });
        }
        else post({ kind: 'publication', itemId: null, status: st, cles: j && typeof j === 'object' ? Object.keys(j).slice(0, 12) : [] });
      }).catch(() => {});
    } catch (_) {}
  };

  // ── SA FICHE, TELLE QU'IL L'ENREGISTRE (22 octobre) ────────────────────────
  // Quand il publie (`POST …/item_upload/items`) ou MODIFIE une annonce
  // (`PUT …/item_upload/items/{id}`), la page envoie SA description et les codes
  // de CETTE annonce (catégorie, marque, couleurs, taille, état). On ne la
  // transmet qu'après un 2xx de Vinted, avec l'identifiant de l'ADRESSE (la
  // modification) ou de la RÉPONSE (la publication) — jamais un titre (§5).
  // Le fond n'en garde que la description et les codes (`noterFicheVinted`).
  // C'est une LECTURE de ce que la page vient de faire sur SON clic : zéro
  // requête de plus vers Vinted (§3).
  const RE_MODIF = /^\/api\/v\d+\/item_upload\/items\/(\d{4,15})\/?$/;
  const corpsTexte = (c) => (typeof c === 'string' && c.length <= 100000) ? c : '';
  const noteModification = (method, url, status, corps) => {
    try {
      if (String(method || '').toUpperCase() !== 'PUT') return;
      const st = Number(status);
      if (!(st >= 200 && st < 300)) return;
      let U = null; try { U = new URL(url, location.origin); } catch (_) { return; }
      if (!/(^|\.)vinted\.[a-z.]+$/i.test(U.hostname)) return;
      const m = RE_MODIF.exec(U.pathname);
      const t = corpsTexte(corps);
      if (!m || !t) return;
      post({ kind: 'fiche', itemId: m[1], status: st, via: 'modif', corps: t });
    } catch (_) {}
  };

// <suivi-regle> — LA MÊME RÈGLE DANS inject.js ET background.js (§11), texte pour
// texte ; comparées par scripts/audit-suivi-vinted.cjs (23 octobre, 5.214).
// Le suivi que VINTED montre de SES commandes d'achat (le bouton « Suivre le
// colis » : `/transactions/{id}/shipment/journey_summary`, et la page d'une
// commande : `/escrow_orders/{id}/shipment`). Leur FORME n'a jamais été vue :
//  · `formeSuivi` — les NOMS de clés et les TYPES, jamais une valeur (une clé qui
//    ressemble à une donnée — e-mail, nombre de 3 chiffres ou plus, longue suite
//    hexadécimale, espace — devient `{k}`) ;
//  · `allegerSuivi` — une LISTE BLANCHE de noms de clés : statut, titre /
//    libellé / message, dates, transporteur, n° de suivi, nom du point relais.
//    Tout le reste (noms, adresses, e-mails, téléphones, codes de retrait, QR)
//    est RETIRÉ ; et un texte gardé qui CITE une valeur retirée (le nom du
//    destinataire, sa rue, le code) la perd aussi (`…`), comme une adresse
//    e-mail, un téléphone, « code 482913 », « 12 rue … », « 35000 Rennes » ;
//  · `contratSuivi` — ce qu'on en range (le CONTRAT de `harvest_{uid}_suivi_{tx}`) :
//    les étapes (30 au plus, la plus RÉCENTE en premier), la dernière DATÉE,
//    le transporteur et le n° de suivi s'ils y sont. Aucune étape reconnue ⇒
//    `null` : la forme est gardée, le contenu ne l'est pas (« pas su »). Une
//    étape sans date lisible n'est jamais « la dernière » (mieux vaut un blanc
//    qu'un faux) : sans date, rien ne sonne.
const SUIVI_TEXTES = ['title', 'status_title', 'state_title', 'event_title', 'label', 'libelle', 'status_label', 'state_label', 'event_label', 'headline', 'message', 'status_message', 'description', 'event_description', 'status_text', 'text', 'summary', 'subtitle'];
const SUIVI_CODES = ['status_code', 'event_code', 'state_code', 'event_type', 'status', 'state', 'statut', 'etat', 'step', 'step_type', 'event_status', 'current_status', 'shipment_status', 'tracking_status'];
const SUIVI_DATE = /(?:^|_)(?:date|time|datetime|timestamp|at|ts|heure|happened|occurred)(?:_|$)/i;
const SUIVI_LIMITE = /(?:^|_)(?:deadline|until|expires?|expiry|limit|limite|estimated|estimation|expected|eta|planned|promised|scheduled|prevue?|prevision(?:nelle)?)(?:_|$)/i;
// Une étape n'a eu lieu que si sa date est passée (quelques minutes d'horloge
// décalée tolérées) : une étape datée dans le FUTUR — une livraison estimée —
// n'est jamais « la dernière » et ne sonne jamais (revue du 24 octobre).
const SUIVI_FUTUR_MS = 10 * 60000;
// Un code ou un statut MACHINE (« at_pickup », « 4 », « in_transit ») : sans
// espace. Une valeur d'état qui n'en a pas la forme (« Code de retrait :
// 482913 ») est un TEXTE, et un texte se lave (revue du 24 octobre).
const SUIVI_CODE_MACHINE = /^[A-Za-z0-9_.:-]{1,40}$/;
const SUIVI_NUMERO = /^(?:tracking_code|tracking_number|tracking_no|tracking_id|parcel_number|parcel_tracking_number|shipment_tracking_code|numero_suivi|numero_de_suivi)$/i;
const SUIVI_TRANSP = /^(?:carrier|carrier_name|carrier_title|carrier_code|transporteur|courier|courier_name|shipping_provider|provider_name|delivery_company|shipping_company)$/i;
const SUIVI_PARENT_TRANSP = /(?:carrier|courier|transporteur|shipping_provider|provider)/i;
const SUIVI_PARENT_RELAIS = /(?:pickup|relay|relais|drop_?off|pudo|locker|parcel_?shop|service_?point)/i;
const SUIVI_PARENT_NUMERO = /^(?:tracking|suivi|parcel_tracking)$/i;
// Un parent qui désigne une PERSONNE (le contact du point relais, le
// destinataire, l'expéditeur) : son `name` n'est ni un transporteur ni un point
// relais, il reste dehors (revue du 24 octobre : « pickup_contact.name »).
const SUIVI_PARENT_PERSONNE = /(?:contact|person|recipient|destinataire|owner|user|customer|client|buyer|seller|sender|expediteur|receiver|holder|member|membre)/i;
const SUIVI_PERSO = /(?:^|_)(?:name|first_?name|last_?name|full_?name|surname|username|login|nickname|email|e_?mail|phone|phone_?number|telephone|tel|mobile|address|adresse|street|street_?name|line\d?|address_?line\d?|house_?number|city|ville|town|postal_?code|post_?code|zip|zip_?code|code|pickup_?code|collection_?code|pin|qr|qr_?code|barcode|password|token|iban)(?:_|$)/i;
const SUIVI_PAS_PERSO = /(?:country|currency|locale|language|lang|type|status|state)/i;
const SUIVI_TYPES = ['string', 'number', 'boolean', 'null', 'object', 'array'];
function suiviCleSure(k) {
  const s = String(k == null ? '' : k);
  return !!s && s.length <= 40 && !/@|\d{3,}|[0-9a-f]{16,}|\s/i.test(s);
}
function suiviDateIso(v, futurMs) {
  if (v == null || v === '' || typeof v === 'boolean') return null;
  let ms = NaN;
  if (typeof v === 'number') ms = v < 1e12 ? v * 1000 : v;
  else {
    const s = String(v).trim();
    if (/^\d{9,13}$/.test(s)) { const n = Number(s); ms = n < 1e12 ? n * 1000 : n; }
    else if (/^\d{4}-\d{2}-\d{2}/.test(s)) ms = Date.parse(s);
  }
  if (!Number.isFinite(ms) || ms < Date.UTC(2020, 0, 1) || ms > Date.now() + (futurMs == null ? 60 * 86400000 : futurMs)) return null;
  return new Date(ms).toISOString();
}
function suiviNumero(v) {
  const s = String(v == null ? '' : v).replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z0-9]{6,40}$/.test(s) && /\d/.test(s) ? s : null;
}
function nettoyerTexteSuivi(s, interdits) {
  let t = String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]+/g, ' ');
  for (const x of interdits || []) {
    const e = String(x).trim();
    if (e.length < 3) continue;
    t = t.replace(new RegExp(e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '…');
  }
  t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '…')
    .replace(/(?:\+\d{2}\s?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/g, '…')
    .replace(/\b\d{1,4}\s*(?:bis|ter)?\s*,?\s*(?:rue|avenue|av\.?|bd|boulevard|chemin|place|all[ée]e|impasse|route|quai|cours|square|r[ée]sidence|lotissement|lieu[- ]dit)\b[^,.;\n]*/gi, '…')
    .replace(/\b\d{5}\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:[ -][A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’-]+)*/g, '…')
    .replace(/((?:\b[Cc]ode|\bCODE|\bPIN|\b[Pp]in)(?:\s+(?:de\s+retrait|retrait|PIN|d['’]acc[èe]s))?\s*(?:[:：=]|est(?:\s+(?:le|la))?|is)?\s*)([A-Za-z0-9-]{4,})/g, (m, a, b) => (/\d/.test(b) ? a + '…' : m))
    .replace(/\b(remis(?:e|es)?\s+[àa]|d[ée]pos[ée](?:e|es|s)?\s+par|livr[ée](?:e|es|s)?\s+[àa])(?![a-zà-ÿ])\s*:?\s*(?:(?!\s(?:au|aux|en|dans|chez|depuis|via)\b)[^,.;\n…])+/gi, '$1 …');
  t = t.replace(/\s*(?:…\s*)+/g, ' … ').replace(/\s+/g, ' ').trim();
  return /^[…\s.,;:!?-]*$/.test(t) ? '' : t.slice(0, 200);
}
// Une feuille gardée : `{ sorte, v }`, ou `null` (retirée).
function suiviFeuille(cle, parent, v) {
  const k = String(cle).toLowerCase(), p = String(parent || '');
  if (!(typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) return null;
  if (SUIVI_PARENT_TRANSP.test(p) && !SUIVI_PARENT_PERSONNE.test(p) && /^(?:name|title|label|code)$/.test(k) && typeof v === 'string') return { sorte: 'texte', v };
  if (SUIVI_PARENT_RELAIS.test(p) && !SUIVI_PARENT_PERSONNE.test(p) && /^(?:name|title|label)$/.test(k) && typeof v === 'string') return { sorte: 'texte', v };
  if (SUIVI_PARENT_NUMERO.test(p) && /^(?:code|number|numero|id)$/.test(k)) { const n = suiviNumero(v); return n ? { sorte: 'numero', v: n } : null; }
  if (SUIVI_NUMERO.test(k)) { const n = suiviNumero(v); return n ? { sorte: 'numero', v: n } : null; }
  if (SUIVI_TRANSP.test(k)) return typeof v === 'string' ? { sorte: 'texte', v } : null;
  if (SUIVI_TEXTES.includes(k)) return typeof v === 'string' ? { sorte: 'texte', v } : null;
  if (SUIVI_CODES.includes(k)) {
    if (typeof v === 'string' && !SUIVI_CODE_MACHINE.test(v.trim())) return { sorte: 'texte', v };
    return { sorte: 'code', v };
  }
  if (SUIVI_DATE.test(k) || SUIVI_LIMITE.test(k)) { const d = suiviDateIso(v); return d ? { sorte: 'date', v: d } : null; }
  return null;
}
function allegerSuivi(racine) {
  const interdits = new Set(), aLaver = [];
  const marche = (v, parent, prof) => {
    if (prof > 8 || v == null) return undefined;
    if (Array.isArray(v)) {
      const out = [];
      for (const x of v.slice(0, 40)) { const r = marche(x, parent, prof + 1); if (r !== undefined) out.push(r); }
      return out.length ? out : undefined;
    }
    if (typeof v !== 'object') return undefined;
    const out = {};
    for (const k of Object.keys(v).slice(0, 80)) {
      const x = v[k];
      if (x && typeof x === 'object') {
        if (!suiviCleSure(k)) continue;
        const r = marche(x, k, prof + 1);
        if (r !== undefined) out[k] = r;
        continue;
      }
      const g = suiviCleSure(k) ? suiviFeuille(k, parent, x) : null;
      if (g) { out[k] = g.v; if (g.sorte === 'texte') aLaver.push([out, k]); continue; }
      if (typeof x === 'string' || typeof x === 'number') {
        const s = String(x).trim();
        if (s.length >= 3 && ((SUIVI_PERSO.test(k) && !SUIVI_PAS_PERSO.test(k)) || /[\w.+-]+@[\w-]+\.[\w-]+/.test(s))) interdits.add(s.slice(0, 200));
      }
    }
    return Object.keys(out).length ? out : undefined;
  };
  const garde = marche(racine, '', 0) || {};
  const liste = [...interdits].sort((a, b) => b.length - a.length);
  for (const [o, k] of aLaver) {
    const t = nettoyerTexteSuivi(o[k], liste);
    if (t) o[k] = t; else delete o[k];
  }
  return garde;
}
function formeSuivi(racine) {
  const out = {};
  let n = 0;
  const poser = (c, t) => {
    if (out[c] === undefined) { if (n < 200) { out[c] = t; n++; } return; }
    if (!out[c].split('|').includes(t)) out[c] = (out[c] + '|' + t).slice(0, 60);
  };
  const marche = (v, chemin, prof) => {
    if (prof > 8) return;
    if (Array.isArray(v)) {
      if (!v.length) { poser(chemin || '(racine)', 'array'); return; }
      for (const x of v.slice(0, 5)) marche(x, chemin + '[]', prof + 1);
      return;
    }
    if (v && typeof v === 'object') {
      const cles = Object.keys(v);
      if (!cles.length) { poser(chemin || '(racine)', 'object'); return; }
      for (const k of cles.slice(0, 80)) marche(v[k], (chemin ? chemin + '.' : '') + (suiviCleSure(k) ? k : '{k}'), prof + 1);
      return;
    }
    poser(chemin || '(racine)', v === null ? 'null' : typeof v);
  };
  marche(racine, '', 0);
  return out;
}
// La forme reçue d'une page (ou d'un message forgé) : seulement des chemins de
// noms de clés sûrs et des types connus — jamais une valeur.
function nettoyerFormeSuivi(f) {
  const out = {};
  if (!f || typeof f !== 'object' || Array.isArray(f)) return out;
  let n = 0;
  for (const c of Object.keys(f)) {
    if (n >= 200) break;
    const t = String(f[c] == null ? '' : f[c]);
    if (!/^[A-Za-z0-9_.[\]{}()-]{1,160}$/.test(c) || /\d{3,}|@/.test(c)) continue;
    if (!t || !t.split('|').every((x) => SUIVI_TYPES.includes(x))) continue;
    out[c] = t.slice(0, 60); n++;
  }
  return out;
}
function suiviVal(o, cle) {
  for (const k of Object.keys(o)) if (k.toLowerCase() === cle) return o[k];
  return undefined;
}
function suiviEtape(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  let t = '';
  for (const k of SUIVI_TEXTES) { const x = suiviVal(o, k); if (typeof x === 'string' && x.trim()) { t = x.trim(); break; } }
  if (!t) return null;
  let at = null, futur = false;
  for (const k of Object.keys(o)) {
    if (!SUIVI_DATE.test(k) || SUIVI_LIMITE.test(k)) continue;
    const d = suiviDateIso(o[k], SUIVI_FUTUR_MS);
    if (d) { at = d; break; }
    if (suiviDateIso(o[k])) futur = true;
  }
  // Datée seulement dans l'avenir : une prévision, pas une étape.
  if (!at && futur) return null;
  let code = null;
  for (const k of SUIVI_CODES) {
    const x = suiviVal(o, k);
    if ((typeof x === 'string' && SUIVI_CODE_MACHINE.test(x.trim()) && x !== t) || typeof x === 'number') { code = String(x).trim(); break; }
  }
  return { t: t.slice(0, 200), at, code };
}
function contratSuivi(a) {
  if (!a || typeof a !== 'object') return null;
  const groupes = [], seuls = [];
  const dansGroupe = new Set();
  const marche = (v, prof) => {
    if (prof > 8 || !v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      const g = [];
      for (const x of v) { const e = suiviEtape(x); if (e) { g.push(e); dansGroupe.add(x); } }
      if (g.length) groupes.push(g);
      for (const x of v) marche(x, prof + 1);
      return;
    }
    for (const k of Object.keys(v)) marche(v[k], prof + 1);
  };
  marche(a, 0);
  const objets = (v, prof) => {
    if (prof > 8 || !v || typeof v !== 'object') return;
    if (Array.isArray(v)) { for (const x of v) objets(x, prof + 1); return; }
    if (!dansGroupe.has(v)) { const e = suiviEtape(v); if (e && e.at) seuls.push(e); }
    for (const k of Object.keys(v)) objets(v[k], prof + 1);
  };
  objets(a, 0);
  if (seuls.length) groupes.push(seuls);
  const score = (g) => g.filter((e) => e.at).length * 100 + g.length;
  let meilleur = null;
  for (const g of groupes) if (!meilleur || score(g) > score(meilleur)) meilleur = g;
  if (!meilleur || !meilleur.length) return null;
  const vues = new Set(), etapes = [];
  for (const e of meilleur) { const c = `${e.at || ''}|${e.t}|${e.code || ''}`; if (!vues.has(c)) { vues.add(c); etapes.push(e); } }
  const datees = etapes.filter((e) => e.at).sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
  const sansDate = etapes.filter((e) => !e.at);
  const toutes = datees.concat(sansDate).slice(0, 30);
  let transporteur = null, suivi = null;
  const cherche = (v, parent, prof) => {
    if (prof > 8 || !v || typeof v !== 'object') return;
    if (Array.isArray(v)) { for (const x of v) cherche(x, parent, prof + 1); return; }
    for (const k of Object.keys(v)) {
      const x = v[k], kl = k.toLowerCase();
      if (x && typeof x === 'object') { cherche(x, k, prof + 1); continue; }
      if (!transporteur && typeof x === 'string' && x.trim() && !/^\d+$/.test(x.trim())
          && ((SUIVI_PARENT_TRANSP.test(String(parent || '')) && !SUIVI_PARENT_PERSONNE.test(String(parent || '')) && /^(?:name|title|label)$/.test(kl)) || /^(?:carrier|carrier_name|carrier_title|transporteur|courier|courier_name|shipping_provider|provider_name|delivery_company|shipping_company)$/.test(kl))) transporteur = x.trim().slice(0, 80);
      if (!suivi && (SUIVI_NUMERO.test(kl) || (SUIVI_PARENT_NUMERO.test(String(parent || '')) && /^(?:code|number|numero|id)$/.test(kl)))) suivi = suiviNumero(x);
    }
  };
  cherche(a, '', 0);
  return { etapes: toutes, dernier: datees.length ? datees[0] : null, transporteur, suivi };
}
// </suivi-regle>

  // ── LE SUIVI QUE VINTED MONTRE DE SES ACHATS (23 octobre, 5.214) ──────────
  // Julien : « enregistrer le numéro de suivi et tracer le colis » ; « que ça me
  // prévienne dès qu'il y a une mise à jour d'un colis ». Les transporteurs
  // n'ouvrent rien de gratuit (mesuré) ; la meilleure source est le suivi que
  // VINTED montre de SES commandes d'achat. Son navigateur a déjà vu passer
  // (chemin + statut, jamais le contenu) : `…/transactions/{id}/shipment/
  // journey_summary` (le bouton « Suivre le colis »), `…/escrow_orders/{id}/
  // shipment` (la page d'une commande) et `…/parcel_collection_code`. Leur FORME
  // n'a jamais été vue. On regarde la RÉPONSE que la page vient de recevoir —
  // AUCUNE requête de plus (§3) — et il ne part d'ici que :
  //   · la FORME (noms de clés + types, jamais une valeur) ;
  //   · pour le suivi et l'expédition, le contenu ALLÉGÉ par liste blanche
  //     (`allegerSuivi`, bloc <suivi-regle> : rien d'un nom, d'une adresse, d'un
  //     e-mail, d'un téléphone, d'un code de retrait ni d'un QR) ;
  //   · pour le code de retrait : la forme SEULEMENT — le code lui-même reste
  //     rangé par le chemin existant (la conversation), rien de plus.
  // C'est le fond qui décide si la transaction est un ACHAT de CE compte
  // (identité) ; une vente n'y laisse que sa forme.
  const RE_SUIVI = [
    [/^\/api\/v\d+\/transactions\/(\d{4,20})\/shipment\/journey_summary\/?$/, 'journey'],
    [/^\/api\/v\d+\/escrow_orders\/(\d{4,20})\/shipment\/?$/, 'escrow'],
    [/^\/api\/v\d+\/transactions\/(\d{4,20})\/shipment\/parcel_collection_code\/?$/, 'code'],
  ];
  // `transaction_id` à la racine ou un niveau plus bas : une IDENTITÉ lue dans la
  // réponse (l'identifiant d'une commande « escrow » n'est peut-être pas celui de
  // la transaction — le fond essaie les deux, et ne garde que celui qui est un
  // achat de ce compte).
  const txDuCorps = (j) => {
    const essai = (o) => (o && typeof o === 'object' && !Array.isArray(o) && /^\d{4,20}$/.test(String(o.transaction_id == null ? '' : o.transaction_id))) ? String(o.transaction_id) : '';
    if (essai(j)) return essai(j);
    if (j && typeof j === 'object' && !Array.isArray(j)) for (const k of Object.keys(j)) { const t = essai(j[k]); if (t) return t; }
    return '';
  };
  const noteSuivi = (method, url, status, lireTexte) => {
    try {
      if (String(method || 'GET').toUpperCase() !== 'GET') return;
      const st = Number(status);
      if (!(st >= 200 && st < 300)) return;
      let U = null; try { U = new URL(url, location.origin); } catch (_) { return; }
      if (!/(^|\.)vinted\.[a-z.]+$/i.test(U.hostname)) return;
      let quoi = null, id = null;
      for (const [re, q] of RE_SUIVI) { const m = re.exec(U.pathname); if (m) { quoi = q; id = m[1]; break; } }
      if (!quoi) return;
      Promise.resolve().then(lireTexte).then((t) => {
        if (typeof t !== 'string' || !t || t.length > 400000) return;
        let j = null; try { j = JSON.parse(t); } catch (_) { return; }
        if (!j || typeof j !== 'object') return;
        if (typeof j.message_code === 'string' && typeof j.code === 'number' && j.code !== 0) return;   // un refus de Vinted n'est pas une forme
        const msg = { kind: 'suivi', quoi, id, forme: formeSuivi(j) };
        if (quoi !== 'code') { msg.allege = allegerSuivi(j); const tc = txDuCorps(j); if (tc) msg.txCorps = tc; }
        post(msg);
      }).catch(() => {});
    } catch (_) {}
  };

  // Convertit un ArrayBuffer en base64 (par morceaux pour eviter le débordement
  // de pile sur les gros PDF).
  const abToB64 = (buf) => {
    let binary = '';
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };
  // Capture un BORDEREAU (PDF) que Vinted renvoie quand tu le telecharges. On
  // repere par le content-type application/pdf (l'URL du label n'est pas connue
  // d'avance). Sert a tamponner automatiquement le bordereau cote app.
  // Un PDF de FACTURE / REÇU (compta pro) se distingue du bordereau par son URL.
  const RECEIPT_URL = /invoice|receipt|facture|re[çc]u|billing|document/i;
  const maybeCaptureLabel = (contentType, url, getArrayBuffer) => {
    try {
      if (!/application\/pdf/i.test(contentType || '')) return;
      const isReceipt = RECEIPT_URL.test(url || '');
      getArrayBuffer().then((buf) => {
        // Les OCTETS d'un PDF (`%PDF`), pas seulement l'en-tête : une page de
        // session expirée servie en `application/pdf` n'est pas un bordereau.
        const t = buf && buf.byteLength >= 4 ? new Uint8Array(buf, 0, 4) : null;
        const estPdf = !!(t && t[0] === 0x25 && t[1] === 0x50 && t[2] === 0x44 && t[3] === 0x46);
        if (estPdf && buf.byteLength < 4000000) {
          post({ kind: isReceipt ? 'receipt' : 'label', url, b64: abToB64(buf) });
        }
      }).catch(() => {});
    } catch (_) {}
  };

  // --- Patch de fetch ---
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      try {
        const url = (typeof input === 'string') ? input : (input && input.url) || '';
        if (init && init.headers) sendCsrf(init.headers);
        else if (input && input.headers) sendCsrf(input.headers);
        const method = (init && init.method) || (input && input.method) || 'GET';
        const corpsEnvoye = init && init.body;
        sendWriteReq(method, url, corpsEnvoye);
        const p = origFetch.apply(this, arguments);
        noteSeen(url); // diagnostic : TOUT appel API, pas seulement ceux qui matchent
        p.then((res) => {
          try {
            noteSuppression(method, url, res.status);   // 5.165 : AVANT tout le reste (la page va naviguer)
            notePublication(method, url, res.status, () => res.clone().text(), corpsEnvoye);   // 5.201
            noteModification(method, url, res.status, corpsEnvoye);   // 22 oct.
            noteSuivi(method, url, res.status, () => res.clone().text());   // 5.214 : le suivi Vinted de ses achats
            noteSeen(url, method, res.status);          // le STATUT, pas seulement le chemin
            const ct = (res.headers && res.headers.get) ? (res.headers.get('content-type') || '') : '';
            if (/application\/pdf/i.test(ct)) {
              maybeCaptureLabel(ct, url, () => res.clone().arrayBuffer());
            } else if (url && matchHarvest(url)) {
              res.clone().text().then((t) => sendHarvest(url, t, method, res.status)).catch(() => {});
            }
          } catch (_) {}
        }).catch(() => {});
        return p;
      } catch (_) {
        return origFetch.apply(this, arguments);
      }
    };
  }

  // --- Patch de XMLHttpRequest ---
  const XHR = window.XMLHttpRequest;
  if (XHR) {
    const origOpen = XHR.prototype.open;
    const origSend = XHR.prototype.send;
    const origSetHeader = XHR.prototype.setRequestHeader;
    XHR.prototype.open = function (method, url) {
      this.__cancaleUrl = url;
      this.__cancaleMethod = method;
      return origOpen.apply(this, arguments);
    };
    XHR.prototype.setRequestHeader = function (name, value) {
      try { if (String(name).toLowerCase() === 'x-csrf-token' && value) post({ kind: 'csrf', csrf: value }); } catch (_) {}
      return origSetHeader.apply(this, arguments);
    };
    XHR.prototype.send = function (bodyArg) {
      try {
        const url = this.__cancaleUrl || '';
        // Capte aussi le csrf/anon posé via setRequestHeader (déjà relayé plus
        // haut) pour la moisson active.
        sendWriteReq(this.__cancaleMethod, url, bodyArg);
        noteSeen(url); // diagnostic : TOUT appel API (XHR aussi)
        this.addEventListener('load', function () {
          try {
            noteSuppression(this.__cancaleMethod, url, this.status);   // 5.165
            notePublication(this.__cancaleMethod, url, this.status, () => (typeof this.responseText === 'string' ? this.responseText : ''), bodyArg);   // 5.201
            noteModification(this.__cancaleMethod, url, this.status, bodyArg);   // 22 oct.
            noteSuivi(this.__cancaleMethod, url, this.status, () => { try { if (this.responseType === 'json') return JSON.stringify(this.response); return typeof this.responseText === 'string' ? this.responseText : ''; } catch (_) { return ''; } });   // 5.214
            noteSeen(url, this.__cancaleMethod, this.status);   // le STATUT aussi
            const ct = this.getResponseHeader ? (this.getResponseHeader('content-type') || '') : '';
            // Bordereau PDF via XHR (si Vinted le charge en binaire).
            if (/application\/pdf/i.test(ct) && this.response && this.response.byteLength) {
              maybeCaptureLabel(ct, url, () => Promise.resolve(this.response));
            } else if (url && matchHarvest(url) && typeof this.responseText === 'string') {
              sendHarvest(url, this.responseText, this.__cancaleMethod, this.status);
            }
          } catch (_) {}
        });
      } catch (_) {}
      return origSend.apply(this, arguments);
    };
  }

  // ── MOISSON ACTIVE (v3.8) ──────────────────────────────────────────────────
  // Vinted construit désormais le dressing et les commandes CÔTÉ SERVEUR : la
  // page ne fait plus l'appel /wardrobe/items ni /my_orders, donc il n'y a plus
  // rien à intercepter passivement. On rétablit la moisson en faisant l'appel
  // NOUS-MÊMES — mais depuis TON navigateur, TON IP, TA session (cookies inclus
  // automatiquement). C'est exactement la requête que le site faisait avant :
  // indistinguable de toi. C'était la piste prévue de longue date (porter les
  // appels par l'extension plutôt que par l'IP serveur de Vercel).
  // Garde-fous « profil humain » : au plus une fois toutes les 30 min, seulement
  // quand l'onglet est visible, un léger délai aléatoire, un seul compte (celui
  // connecté dans cet onglet). Se rabat en silence si un endpoint a disparu.
  const ACTIVE_TTL = 30 * 60 * 1000;
  const jitter = (min, max) => min + Math.random() * (max - min);
  // ⚠️ 5.162 — L'ARRÊT NET SUR 429 / 403. Cette moisson part DE LA PAGE, hors
  // de la file du fond : quand Vinted répondait « ralentis » (429) ou « non »
  // (403), chaque boucle cassait la sienne et la suivante repartait (ventes,
  // achats, boîte : des dizaines de requêtes après le refus). Désormais le
  // premier frein ARRÊTE tout ce qui reste de cette moisson, et le fond en est
  // prévenu (`vintedFrein`) : il pose la même pause que pour ses propres
  // requêtes. Et une moisson ne DÉMARRE pas pendant une pause : `content.js`
  // nous transmet sa fin (`CANCALE_VINTED_PAUSE`).
  let freinVinted = 0;
  let pauseJusqua = 0;
  try {
    window.addEventListener('message', (e) => {
      try {
        if (e.source !== window || !e.data || e.data.__tag !== 'CANCALE_VINTED_PAUSE') return;
        pauseJusqua = Number(e.data.jusqua) || 0;
      } catch (_) {}
    }, false);
  } catch (_) {}
  // ── LE RELAIS DE LA PAGE (20 octobre, Orion iPhone) ──────────────────────
  // Un navigateur sans `scripting` (ou sans monde MAIN) ne peut pas injecter
  // une fonction ici : le fond demande alors UNE requête GET, relayée par
  // content.js, et on la fait d'ici — exactement ce que la fonction injectée
  // aurait fait sur Chrome (même page, mêmes cookies). Seulement un chemin
  // relatif de l'API Vinted, seulement en lecture ; la réponse repart par le
  // même relais. Sur Chrome personne ne l'appelle.
  try {
    window.addEventListener('message', async (e) => {
      try {
        if (e.source !== window || !e.data || e.data.__tag !== 'CANCALE_VINTED_REQ') return;
        const id = String(e.data.id || ''), p = String(e.data.p || '');
        if (!id || !/^\/(api|web\/api)\//.test(p)) return;
        const h = {};
        const src = e.data.h && typeof e.data.h === 'object' ? e.data.h : {};
        for (const k of Object.keys(src)) if (/^(accept|x-csrf-token)$/i.test(k)) h[k] = String(src[k]);
        let out = { status: 0, ok: false, json: null };
        try {
          const r = await window.fetch(p, { credentials: 'include', headers: h });
          let json = null; try { json = await r.json(); } catch (_) {}
          out = { status: r.status, ok: r.ok, json };
        } catch (_) {}
        window.postMessage({ __tag: 'CANCALE_VINTED_REP', id, status: out.status, ok: out.ok, json: out.json, origine: location.origin }, location.origin);
      } catch (_) {}
    }, false);
  } catch (_) {}
  const apiGet = async (path) => {
    if (freinVinted) return null;                         // Vinted a freiné : plus rien ne part
    try {
      const h = { accept: 'application/json' };
      if (lastCsrf) h['x-csrf-token'] = lastCsrf;
      if (lastAnon) h['x-anon-id'] = lastAnon;
      const r = await fetch(path, { credentials: 'include', headers: h });
      if (r && (r.status === 429 || r.status === 403)) {
        freinVinted = r.status;
        post({ kind: 'vintedFrein', statut: r.status });
        return null;
      }
      if (!r || !r.ok) return null;
      return await r.text();
    } catch (_) { return null; }
  };
  const activeHarvest = async () => {
    try {
      if (!/(^|\.)vinted\./i.test(location.host)) return; // uniquement sur Vinted
      if (document.hidden) return;                        // onglet au premier plan seulement
      if (Date.now() < pauseJusqua) return;               // Vinted a demandé de ralentir (5.162)
      freinVinted = 0;                                    // nouvelle moisson, hors pause
      const KEY = '__cancale_active_ts';
      let last = 0; try { last = +(localStorage.getItem(KEY) || 0); } catch (_) {}
      if (Date.now() - last < ACTIVE_TTL) return;
      try { localStorage.setItem(KEY, String(Date.now())); } catch (_) {}
      // 1) profil (donne l'ID de dressing, ≠ id de compte).
      const who = await apiGet('/api/v2/users/current');
      let pid = null;
      if (who) { sendHarvest('/api/v2/users/current', who); try { pid = JSON.parse(who).user.id; } catch (_) {} }
      // 2) annonces en ligne (dressing).
      if (pid) {
        await new Promise(r => setTimeout(r, jitter(600, 1500)));
        // TOUTES les pages : Vinted plafonne per_page (~96 malgre le 200
        // demande). Un compte de 604 articles ne rendait que sa 1re page, et
        // l'app croyait le reste disparu.
        let tout = null;
        for (let page = 1; page <= 10; page++) {
          const w = await apiGet(`/api/v2/wardrobe/${pid}/items?page=${page}&per_page=200&order=relevance`);
          if (!w) break;
          let j = null; try { j = JSON.parse(w); } catch (_) { break; }
          const lot = Array.isArray(j.items) ? j.items : null;
          if (!lot) break;
          if (!tout) tout = j; else tout.items = tout.items.concat(lot);
          const tp = j.pagination && j.pagination.total_pages;
          if (!lot.length || (tp && page >= tp)) break;
          await new Promise(r => setTimeout(r, jitter(600, 1500)));
        }
        if (tout) sendHarvest(`/api/v2/wardrobe/${pid}/items`, JSON.stringify(tout));
      }
      // 2b) ⚠️ RETIRÉ — 6 REQUÊTES PAR VISITE POUR RIEN.
      //     On demandait ici le détail de 6 annonces par passage
      //     (`GET /api/v2/items/{id}`), avec une pause de 0,9–2,2 s entre
      //     chacune, en espérant récupérer la DESCRIPTION.
      //     Le compteur de diagnostic (`panel_diag_capture`, relevé du 24 août)
      //     est sans appel :
      //         recu_item = 73   ·   abandon_json_item = 73   ·   ecrit_item = 0
      //     73 tentatives, 73 échecs, ZÉRO ligne écrite. La cause est connue
      //     depuis §5.26 : Vinted renvoie sur cette URL une PAGE D'ERREUR HTML
      //     avec un statut 200, donc `apiGet` la laisse passer et `JSON.parse`
      //     casse. L'endpoint ne rend plus la fiche, point.
      //     Ce que ça coûtait à chaque visite sur Vinted : 6 appels inutiles,
      //     6 à 13 secondes de retard sur la vraie moisson, et 6 requêtes de
      //     plus dans l'empreinte du compte — le signal qu'on passe justement
      //     notre temps à réduire (§5, §48).
      //     ⚠️ Rien n'est perdu : la DESCRIPTION arrive par la lecture de la
      //     PAGE (`readListingDetailFromPage` → `vinted_item_details`), qui
      //     fonctionne, et c'est elle que le coffre et « Republier » lisent
      //     (§5.10, §5.50). Le bouton manuel « 📥 Récupérer le texte »
      //     (`capterAnnonce`) reste disponible si Vinted rétablit un jour
      //     l'endpoint — il le dira tout seul en écrivant une ligne.
      //     NE PAS remettre cette boucle sans avoir vu `ecrit_item > 0`.
      // 3) ventes + achats — TOUTES les pages (comme le dressing en 2).
      // ⚠️ Avant : seulement `page=1&per_page=100` → un vendeur de 300 ventes ne
      // rendait QUE ses 100 dernières, le reste n'arrivait JAMAIS dans l'app.
      // On concatène toutes les pages en UN SEUL envoi : `storeHarvest` garde la
      // capture la plus RICHE (`listePlusRiche` compare le nombre d'items), donc
      // une liste partielle n'écrase jamais une complète — mais il faut lui
      // donner la liste complète d'un coup, des pages envoyées séparément
      // s'écraseraient l'une l'autre (pas d'union côté fond). Mêmes garde-fous
      // que le dressing : une requête à la fois, délai humain entre chacune,
      // plafond de pages, et tout ça au plus une fois / 30 min (ACTIVE_TTL).
      // ⚠️ « purchased » et PAS « bought » : ?type=bought renvoie chez certains
      // comptes les ventes (vérifié en base) → des ventes dans les achats.
      for (const t of ['sold', 'purchased']) {
        let tout = null;
        for (let page = 1; page <= 20; page++) {
          await new Promise(r => setTimeout(r, jitter(600, 1500)));
          const o = await apiGet(`/api/v2/my_orders?type=${t}&page=${page}&per_page=100`);
          if (!o) break;
          let j = null; try { j = JSON.parse(o); } catch (_) { break; }
          const lot = Array.isArray(j.my_orders) ? j.my_orders : null;
          if (!lot) break;
          if (!tout) tout = j; else tout.my_orders = tout.my_orders.concat(lot);
          const tp = j.pagination && j.pagination.total_pages;
          if (lot.length < 100 || !lot.length || (tp && page >= tp)) break;
        }
        if (tout) sendHarvest(`/api/v2/my_orders?type=${t}`, JSON.stringify(tout));
      }
      // 4) boîte de réception — TOUTES les pages aussi (avant : 50 max).
      {
        let tout = null;
        for (let page = 1; page <= 15; page++) {
          await new Promise(r => setTimeout(r, jitter(600, 1500)));
          const inb = await apiGet(`/api/v2/inbox?page=${page}&per_page=50`);
          if (!inb) break;
          let j = null; try { j = JSON.parse(inb); } catch (_) { break; }
          const lot = Array.isArray(j.conversations) ? j.conversations : null;
          if (!lot) break;
          if (!tout) tout = j; else tout.conversations = tout.conversations.concat(lot);
          const tp = j.pagination && j.pagination.total_pages;
          if (lot.length < 50 || !lot.length || (tp && page >= tp)) break;
        }
        if (tout) sendHarvest('/api/v2/inbox', JSON.stringify(tout));
      }
    } catch (_) {}
  };
  // Lancement différé (laisse la page s'installer et le csrf se capter), puis à
  // chaque retour au premier plan (throttlé par ACTIVE_TTL).
  setTimeout(activeHarvest, 6000);
  try { document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(activeHarvest, 3000); }); } catch (_) {}
})();
