// lbc-inject.js — tourne dans le MAIN world de leboncoin.fr.
// OBSERVATION PURE : on enveloppe fetch/XHR pour LIRE les réponses que la page
// charge déjà (tes annonces), sans faire la moindre requête en plus. On envoie
// les réponses « annonces » au content script (lbc.js) qui les relaie au
// background. Un mouchard note aussi les chemins d'API vus (pour brancher juste).
(function () {
  'use strict';
  if (window.__vrmLbcInjected) return; window.__vrmLbcInjected = true;
  const TAG = 'CANCALE_LBC';
  const post = (payload) => { try { window.postMessage(Object.assign({ __tag: TAG }, payload), '*'); } catch (_) {} };

  // Une réponse « intéressante » = du JSON qui parle d'annonces. On reste large
  // (Leboncoin a plusieurs endpoints) mais on évite le bruit (pub, tracking).
  const AD_HINT = /(list_id|\"ads\"|\"subject\"|annonce|myads|\/ads|classified|listing|dashboard|selection|owner)/i;
  // ⚠️ L'IDENTITÉ DU COMPTE CONNECTÉ vit souvent dans une réponse `/account`,
  //    `/user`, `/me`, `/pro`… que `AD_HINT` ne matche pas. On la laisse passer
  //    aussi : le background y lit à QUI (id + nom + pro/particulier) appartient
  //    la session, pour relier ensuite chaque annonce à son compte. Julien aura
  //    plusieurs comptes Leboncoin — sans ce lien, tout se mélange.
  const ACCOUNT_HINT = /(\/account|\/users?\b|\/me\b|profile|\/pro\/|dashboard|store_id|\"siren\"|pseudo)/i;
  const NOISE = /(datadome|captcha|track|metric|event|telemetr|analytic|consent|pixel|gtm|batch\.bmcdn|xiti|adservice)/i;

  // ⚠️⚠️ ON N'ÉCHANTILLONNE QUE LEBONCOIN. Mesuré le 17 septembre sur sa base :
  //    **3 des 6 échantillons gardés n'étaient pas Leboncoin** — `fast.nexx360.io`,
  //    `ib.adnxs.com`, `hbopenbid.pubmatic.com`, des enchères publicitaires. Elles
  //    passent `AD_HINT` justement parce qu'une enchère parle d'« ads », et elles
  //    évinçaient les réponses de Leboncoin, les seules qui servent. Une réponse
  //    d'un tiers n'a rien à faire dans sa base : on ne la relaie pas.
  const DE_LEBONCOIN = (url) => {
    try {
      const u = new URL(url, location.origin);
      return /(^|\.)leboncoin\.fr$/i.test(u.hostname);
    } catch (_) { return false; }        // adresse illisible ⇒ on ne relaie pas
  };

  // LE CATALOGUE : les codes exacts que le formulaire de dépôt attend (catégorie,
  // marque, taille, état). Deux endpoints, tous deux VUS dans son navigateur.
  // Ils partent dans leur propre ligne, ENTIERS — pas dans le flot d'échantillons
  // où ils étaient coupés à 9 000 caractères et évincés par le reste.
  // ⚠️⚠️ MESURÉ LE 17 SEPTEMBRE — ET C'EST LA VRAIE CARTE. Julien : « il y a des
  //    choses que je remplis, d'autres où c'est fait tout seul ». Ses
  //    `lbc_recon.paths` disent pourquoi, et où regarder :
  //      api/adsubmit/dynamic-deposit/config   ← LE FORMULAIRE EST **DYNAMIQUE**
  //      api/ad-prediction/v2/public/adparams  ← ce que Leboncoin PRÉ-REMPLIT
  //      api/consumergoods/proxy/v2/pages/ad-submit
  //      _next/data/…/deposer-une-annonce/options.json
  //      api/pintad/v1/public/upload/image     ← l'envoi des photos
  //      api/adsubmit/v2/classifieds           ← la soumission
  //    Le formulaire n'est pas écrit en dur : il est CONSTRUIT à partir d'une
  //    config renvoyée par l'API, et cette config change avec la catégorie.
  //    C'est exactement « c'est différent pour chaque annonce », et ça se lit
  //    **dans la réponse**, pas en scrutant des `<div role="combobox">`.
  //    ⇒ On garde ces réponses-là ENTIÈRES. C'est infiniment plus sûr que le DOM.
  const CATALOGUE = /(\/data\/v\d+\/(fdata|fforms)\b|adsubmit|ad-prediction|ad-submit|dynamic-deposit|adparams|deposer-une-annonce.*\.json|\/upload\/image)/i;
  const CAT_MAX = 3000000;   // mesuré : à 400 000 le catalogue arrivait COUPÉ

  // ⚠️⚠️ LA VENTE LEBONCOIN — « capter le bordereau comme sur Vinted ». Mesuré le
  //    20 sept. : ses chemins portent enfin la surface d'une vente —
  //      api/consumergoods/proxy/v{n}/pages/transactions/{id}   ← le détail vente
  //      _next/data/…/compte/part/transaction/{id}.json · mes-transactions.json
  //      api/pro-order-proxy/v2/users/own_orders                ← les commandes
  //      api/delivery-configurator-api/v1/configs               ← la livraison
  //      api/consumergoods/purchase/v1/purchases/{id}/action/…  ← les actions
  //    Mais leur CORPS ne partait pas (AD_HINT/ACCOUNT_HINT ne matchent pas une
  //    transaction). On les relaie donc — c'est une LECTURE de SES propres ventes
  //    (§3), rangée dans une ligne dédiée. Sans ça, sa prochaine vente est perdue
  //    pour l'analyse, exactement comme le dépôt qu'on avait jeté (le défaut le
  //    plus coûteux du projet). Le jour où j'ai la forme, je câble « vendue → à
  //    retirer » + la capture du bordereau (PDF) — pas avant (on ne devine pas).
  const VENTE_HINT = /(consumergoods\/proxy\/v\d+\/pages\/transactions|compte\/part\/(transaction|mes-transactions)|pro-order-proxy|own_orders|delivery-configurator|purchases\/[^/]+\/(action|delivery|label)|\/orders?\b)/i;
  const VENTE_MAX = 150000;
  // ⚠️⚠️ MESURÉ le 20 sept. : le détail d'une transaction Leboncoin (_next/data)
  //    porte sa vraie donnée (livraison, bordereau, état) APRÈS ~150 000
  //    caractères de TRADUCTIONS (`pageProps.messages`) — le plafond coupait
  //    juste avant. On fait sauter ce bruit pur (i18n + flags A/B) AVANT de
  //    caper : ni donnée de vente, ni donnée perso là-dedans, que des libellés
  //    d'interface. Ce qui reste (purchaseId, article, prix, livraison…) rentre.
  const allegeVente = (txt) => {
    try {
      const j = JSON.parse(txt);
      const pp = (j && j.pageProps) || j;
      if (pp && typeof pp === 'object') { delete pp.messages; delete pp.confidence; delete pp.experimentContext; delete pp._sentryTraceData; delete pp.i18n; }
      return JSON.stringify(j);
    } catch (_) { return txt; }   // corps tronqué/illisible ⇒ on garde le brut
  };

  // ⚠️ ET LA FORME DE CE QUI PART. La requête de soumission dit, mieux que tout
  //    le reste, quels champs Leboncoin attend vraiment. Mais elle contient SON
  //    annonce — titre, description, prix. **On n'envoie donc QUE les chemins de
  //    clés, jamais les valeurs** : la promesse de confidentialité ne bouge pas,
  //    et c'est la structure qui sert, pas le contenu.
  // ⚠️⚠️ ON NOTE **TOUTE** ÉCRITURE LEBONCOIN, PAS SEULEMENT LE DÉPÔT.
  //    Mesuré le 17 septembre : ses 232 chemins Leboncoin portent bien plus que
  //    le dépôt — `api/ad-classifier/v2/classify` (c'est LUI qui devine la
  //    catégorie depuis le titre : voilà « ce qui est fait tout seul »),
  //    `api/ad-prediction/v1/public/description-price` (la description ET le
  //    prix proposés), `api/ad-geoloc/v2/autocomplete`, `api/options/v7/pricing/
  //    classifieds`, `api/pintad/v1/public/expired`…
  //    Et quand Julien décrit un bouton que je n'ai jamais vu, la seule façon de
  //    savoir ce qu'il envoie est de l'AVOIR NOTÉ. C'est déjà ce que fait
  //    `inject.js` sur Vinted (`writereq`), et c'est comme ça que j'ai trouvé
  //    son `PUT …/shipment/order` : cette moitié-là manquait côté Leboncoin.
  //    ⇒ Toute requête qui MODIFIE quelque chose (POST/PUT/PATCH/DELETE) est
  //      notée — **chemins de clés et types uniquement, jamais les valeurs**.
  const ENVOI = /leboncoin\.fr\/(api|messaging|finder|_next)/i;
  const MODIFIE = /^(POST|PUT|PATCH|DELETE)$/i;
  function cheminsDeCles(v, prefixe, out, prof) {
    if (!out) out = []; if (out.length > 400 || (prof || 0) > 6) return out;
    if (Array.isArray(v)) { if (v.length) cheminsDeCles(v[0], (prefixe || '') + '[]', out, (prof || 0) + 1); return out; }
    if (v && typeof v === 'object') {
      for (const k of Object.keys(v).slice(0, 80)) cheminsDeCles(v[k], (prefixe ? prefixe + '.' : '') + k, out, (prof || 0) + 1);
      return out;
    }
    // La FEUILLE : on note son chemin et son TYPE, jamais sa valeur.
    if (prefixe) out.push(prefixe + ':' + (v === null ? 'null' : typeof v));
    return out;
  }
  // ⚠️ UN UUID EST UN IDENTIFIANT (4 octobre) : la règle « 3 chiffres ou plus →
  //    {id} » mangeait le DÉBUT d'un UUID et laissait le reste — les UUID de ses
  //    conversations et de son compte partaient dans `lbc_recon`, et chaque
  //    conversation créait sa propre clé de schéma. On les remplace d'abord.
  const sansUuid = (x) => String(x).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}');
  const noteEnvoi = (url, corps, methode) => {
    try {
      if (!DE_LEBONCOIN(url) || !ENVOI.test(url)) return;
      if (methode && !MODIFIE.test(methode)) return;
      // Un corps vide compte aussi : le bouton peut n'envoyer qu'une adresse.
      if (!corps) { post({ kind: 'lbcenvoi', url: sansUuid(url), methode: String(methode || ''), cles: ['(sans corps)'] }); return; }
      let cles = [];
      if (typeof corps === 'string') { try { cles = cheminsDeCles(JSON.parse(corps)); } catch (_) { return; } }
      else if (corps instanceof FormData) { cles = [...corps.keys()].slice(0, 80).map((k) => k + ':formdata'); }
      else return;
      if (cles.length) post({ kind: 'lbcenvoi', url: sansUuid(url), methode: String(methode || ''), cles: cles.slice(0, 400) });
    } catch (_) {}
  };
  // ⚠️⚠️ LE MOUCHARD DE CHEMINS — À PARITÉ AVEC CELUI DE VINTED (`inject.js`).
  //    Julien veut « capter le bordereau du Bon Coin comme sur Vinted » : le jour
  //    d'une vente, Leboncoin émet une étiquette (un PDF, ou une réponse qui y
  //    mène). Pour la RECONNAÎTRE parmi des dizaines d'appels, un chemin nu ne
  //    suffit pas — un GET qui répond un `pdf` ne se lit pas comme un JSON de
  //    vente, et un 403 ne se corrige pas comme un 200. On note donc, par chemin,
  //    **la méthode + le statut + le TYPE de réponse** — JAMAIS le corps, JAMAIS
  //    la query (la promesse de confidentialité ne bouge pas). C'est la même
  //    mesure qui a fait trouver le `PUT …/shipment/order` de Vinted.
  //    On garde Leboncoin, plus **tout PDF** (un bordereau peut être servi par le
  //    transporteur) et **tout échec ≥400** ; jamais le bruit publicitaire en
  //    200/json, qui évincerait les seuls chemins qui servent (leçon du catalogue).
  const seenPaths = new Set(); let seenDirty = false;
  const typeCourt = (ctype) => {
    const c = String(ctype || '').toLowerCase();
    return /pdf/.test(c) ? 'pdf' : /json/.test(c) ? 'json' : /html/.test(c) ? 'html'
      : /image/.test(c) ? 'img' : /(octet|binary|zip)/.test(c) ? 'bin' : '';
  };
  const noteSeen = (url, methode, statut, ctype) => {
    try {
      if (NOISE.test(url)) return;
      const t = typeCourt(ctype);
      const s = Number(statut) || 0;
      if (!DE_LEBONCOIN(url) && t !== 'pdf' && !(s >= 400)) return;
      let host = '', chemin = '';
      try { const u = new URL(url, location.origin); host = u.host; chemin = u.pathname; }
      catch (_) { chemin = String(url).split('?')[0]; }
      chemin = sansUuid(chemin).replace(/\/\d{3,}/g, '/{id}').replace(/\/[0-9a-f]{16,}/gi, '/{id}');
      const rec = ((methode ? String(methode).toUpperCase() + ' ' : '') + host + chemin
        + (s ? ' → ' + s : '') + (t ? ' [' + t + ']' : '')).slice(0, 160);
      if (!seenPaths.has(rec)) { seenPaths.add(rec); seenDirty = true; }
    } catch (_) {}
  };
  setInterval(() => { if (seenDirty) { seenDirty = false; post({ kind: 'lbcpaths', paths: [...seenPaths].slice(0, 200) }); } }, 4000);

  // ── LA CARTE COMPLÈTE DE LEBONCOIN (Julien, 23 sept. : « capte tout ») ─────
  //    Pour CHAQUE réponse JSON Leboncoin, on relève sa STRUCTURE — chemins de
  //    clés + TYPE de feuille, JAMAIS une valeur (même règle que `lbcenvoi`).
  //    Une seule fois par endpoint et par page (dédup), borné. Le jour où on
  //    cherche un champ (vente, bordereau, compte, messagerie, livraison…), on
  //    sait exactement où il vit — sans deviner, sans que Julien ait à me le
  //    montrer. Les identifiants dans les chemins deviennent `{id}` : aucune
  //    donnée qui désigne quelqu'un ne part.
  const schemaVus = new Set();
  const noteSchema = (url, text) => {
    try {
      let ep = '';
      try { const u = new URL(url, location.origin); ep = u.host + u.pathname; } catch (_) { ep = String(url).split('?')[0]; }
      ep = sansUuid(ep).replace(/\/\d{3,}/g, '/{id}').replace(/\/[0-9a-f]{16,}/gi, '/{id}');
      if (schemaVus.has(ep)) return;
      let obj = null; try { obj = JSON.parse(text); } catch (_) { return; }
      if (!obj || typeof obj !== 'object') return;
      schemaVus.add(ep);
      const cles = cheminsDeCles(obj)
        .map((c) => sansUuid(c).replace(/\.\d{3,}(?=[.:[])/g, '.{id}').replace(/\.[0-9a-f]{16,}(?=[.:[])/gi, '.{id}'))
        .slice(0, 200);
      if (cles.length) post({ kind: 'lbcschema', endpoint: ep, cles });
    } catch (_) {}
  };

  // ── LE DÉTAIL DES TRANSACTIONS, LU ACTIVEMENT (1er oct.) ─────────────────
  // Mesuré : la LISTE (`v3/pages/transactions`) ne dit pas si tu es vendeur ou
  // acheteur ; seul le DÉTAIL (`v2/pages/transactions/{id}`, relevé dans tes
  // requêtes) porte `is_seller` et le statut à jour. La vente des Air Max 1
  // olive n'avait été vue qu'en liste (21 sept.) : côté inconnu, statut figé à
  // « ongoing » → elle ne sortait nulle part.
  // ⇒ Quand la liste s'affiche, on lit le détail des transactions non
  //   annulées : LECTURE de tes propres données (§3), 5 au plus par page, une par
  //   une, avec les MÊMES en-têtes que Leboncoin vient d'envoyer. Une transaction
  //   terminée n'est plus relue ; une en cours, pas avant 6 h. La réponse passe
  //   par le même chemin que si tu avais ouvert la transaction.
  let entetesLbc = null;                                   // copiés d'une vraie requête du site
  const DETAIL_MAX = 5, DETAIL_REVOIR_MS = 6 * 3600e3;
  const FINI = /^(done|cancelled|canceled|closed|refunded)$/i;
  const memoDetail = () => { try { return JSON.parse(localStorage.getItem('vrm_lbc_detail_vus') || '{}') || {}; } catch (_) { return {}; } };
  const ecrireMemo = (m) => { try { localStorage.setItem('vrm_lbc_detail_vus', JSON.stringify(m)); } catch (_) {} };
  let detailEnCours = false;
  const lireDetails = async (listeTexte) => {
    if (detailEnCours) return;
    let arr; try { arr = JSON.parse(listeTexte); } catch (_) { return; }
    if (!Array.isArray(arr)) return;
    const memo = memoDetail(); const now = Date.now();
    const aLire = arr.map((t) => t && {
      id: String((t.id && t.id.purchase_id) || t.purchase_id || ''),
      st: typeof t.step === 'string' ? t.step : ((t.step && t.step.status) || ''),
    }).filter((t) => t && t.id && !/cancel/i.test(t.st)).filter((t) => {
      const m = memo[t.id];
      if (!m) return true;
      if (FINI.test(m.st || '')) return false;             // déjà lue une fois terminée
      return now - (m.t || 0) > DETAIL_REVOIR_MS;
    }).slice(0, DETAIL_MAX);
    if (!aLire.length) return;
    detailEnCours = true;
    try {
      for (const t of aLire) {
        const url = 'https://api.leboncoin.fr/api/consumergoods/proxy/v2/pages/transactions/' + encodeURIComponent(t.id);
        let st = t.st;
        try {
          // window.fetch (notre crochet) : la réponse repasse par `handle`, donc
          // elle est rangée exactement comme une transaction ouverte à la main.
          const res = await window.fetch(url, { method: 'GET', credentials: 'include', headers: entetesLbc || { Accept: 'application/json' } });
          if (res.status === 401 || res.status === 403) break;   // refusé : on s'arrête
          if (res.ok) { try { const j = await res.clone().json(); st = (j && j.step && j.step.status) || (j && j.pageProps && j.pageProps.transaction && j.pageProps.transaction.step && j.pageProps.transaction.step.status) || st; } catch (_) {} }
        } catch (_) {}
        memo[t.id] = { t: Date.now(), st };
      }
      ecrireMemo(memo);
    } finally { detailEnCours = false; }
  };

  const handle = (url, text, ctype) => {
    try {
      if (NOISE.test(url)) return;
      if (!text || text.length > 1500000) return;
      if (ctype && !/json/i.test(ctype)) return;
      if (!DE_LEBONCOIN(url)) return;                       // ni pub, ni tiers
      // ⚠️ Un jeton de connexion temps réel : rien, nulle part, pas même ses clés.
      if (/\/realtime\/credentials/i.test(url)) return;
      noteSchema(url, text);                                // la structure, jamais les valeurs
      // ── LA MESSAGERIE (4 octobre) : SEULEMENT LE NOMBRE DE NON-LUS ─────────
      // Julien : « dans Leboncoin, il y ait les messages ». Mesuré : la page
      // recharge elle-même un compteur `{userId, unread, pollingTime}` — un
      // NOMBRE, par compte. On relaie ce nombre et rien d'autre. ⚠️ Aucune
      // réponse de messagerie ne part en `lbcraw` ni en échantillon : un jour un
      // message contiendra « annonce » ou « owner », et le texte d'un client
      // finirait dans la base. Lire les fils viendra après avoir MESURÉ leur
      // forme (un passage de Julien), pas avant.
      if (/\/messaging\//i.test(url)) {
        const m = /\/messaging\/proxy\/api\/hal\/([0-9a-f-]{8,64})\/counter\/?(?:\?|$)/i.exec(url);
        if (m) { try { const o = JSON.parse(text); const n = Number(o && o.unread); if (Number.isFinite(n) && n >= 0) post({ kind: 'lbcmsgcompteur', userId: m[1], unread: Math.round(n) }); } catch (_) {} }
        return;
      }
      // Ses comptes Leboncoin liés (le sélecteur de compte) : identifiant, nom,
      // pro ou non. JAMAIS l'email. Le relais habituel continue en dessous.
      if (/\/authenticator\/v\d+\/users\/me\/linked_accounts/i.test(url)) {
        try {
          const o = JSON.parse(text);
          const arr = Array.isArray(o) ? o : ((o && (o.linked_accounts || o.accounts)) || []);
          const comptes = (Array.isArray(arr) ? arr : []).map((a) => a && ({ id: String(a.user_id || a.id || ''), name: String(a.display_name || a.name || '').slice(0, 60), pro: !!a.is_business_user })).filter((c) => c && c.id).slice(0, 10);
          if (comptes.length) post({ kind: 'lbccomptes', comptes });
        } catch (_) {}
      }
      if (CATALOGUE.test(url)) {
        // On le garde entier dans la limite, et on DIT s'il a été coupé : la
        // moitié d'un catalogue a l'air d'un catalogue.
        post({ kind: 'lbccatalogue', url, body: text.slice(0, CAT_MAX), coupe: text.length > CAT_MAX });
        return;
      }
      // LA VENTE : sa propre transaction/commande/livraison. Ligne dédiée, capée.
      if (VENTE_HINT.test(url)) {
        const c = allegeVente(text); post({ kind: 'lbcvente', url, body: c.slice(0, VENTE_MAX), coupe: c.length > VENTE_MAX });
        if (/consumergoods\/proxy\/v\d+\/pages\/transactions(?:\?|$)/i.test(url)) setTimeout(() => { lireDetails(text); }, 800);
        return;
      }
      if (!AD_HINT.test(text) && !AD_HINT.test(url) && !ACCOUNT_HINT.test(url) && !ACCOUNT_HINT.test(text)) return;
      post({ kind: 'lbcraw', url, body: text });
    } catch (_) {}
  };

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      const url = (typeof input === 'string') ? input : (input && input.url) || '';
      const meth = (init && init.method) || (typeof input === 'object' && input && input.method) || 'GET';
      try { if (MODIFIE.test(meth)) noteEnvoi(url, init && init.body, meth); } catch (_) {}
      // En-têtes d'une requête du SITE vers ses transactions : on les réutilise
      // tels quels pour lire le détail (restent dans la page, jamais envoyés ailleurs).
      try {
        if (/api\.leboncoin\.fr\/api\/consumergoods\//i.test(url) && init && init.headers && !/vrm/i.test(String(init.headers['x-vrm'] || ''))) {
          const h = init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : Object.assign({}, init.headers);
          if (Object.keys(h).length) entetesLbc = h;
        }
      } catch (_) {}
      const p = origFetch.apply(this, arguments);
      try {
        p.then((res) => {
          try {
            const ct = res.headers && res.headers.get && res.headers.get('content-type');
            if (/vinted|supabase/i.test(url)) return; // ne touche pas aux autres domaines
            noteSeen(url, meth, res.status, ct);
            res.clone().text().then((t) => handle(url, t, ct)).catch(() => {});
          } catch (_) {}
        }).catch(() => {});
      } catch (_) {}
      return p;
    };
  }

  const OX = window.XMLHttpRequest;
  if (OX) {
    const origOpen = OX.prototype.open, origSend = OX.prototype.send;
    OX.prototype.open = function (method, url) { this.__lbcUrl = url; this.__lbcMeth = method; return origOpen.apply(this, arguments); };
    OX.prototype.send = function (corps) {
      try { if (MODIFIE.test(this.__lbcMeth || '')) noteEnvoi(this.__lbcUrl || '', corps, this.__lbcMeth); } catch (_) {}
      try {
        this.addEventListener('load', function () {
          try {
            const url = this.__lbcUrl || '';
            if (/vinted|supabase/i.test(url)) return;
            const ct = this.getResponseHeader && this.getResponseHeader('content-type');
            noteSeen(url, this.__lbcMeth, this.status, ct);
            const t = (this.responseType === '' || this.responseType === 'text') ? this.responseText : null;
            if (t) handle(url, t, ct);
          } catch (_) {}
        });
      } catch (_) {}
      return origSend.apply(this, arguments);
    };
  }
})();
