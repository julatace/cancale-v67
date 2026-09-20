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
  const noteEnvoi = (url, corps, methode) => {
    try {
      if (!DE_LEBONCOIN(url) || !ENVOI.test(url)) return;
      if (methode && !MODIFIE.test(methode)) return;
      // Un corps vide compte aussi : le bouton peut n'envoyer qu'une adresse.
      if (!corps) { post({ kind: 'lbcenvoi', url, methode: String(methode || ''), cles: ['(sans corps)'] }); return; }
      let cles = [];
      if (typeof corps === 'string') { try { cles = cheminsDeCles(JSON.parse(corps)); } catch (_) { return; } }
      else if (corps instanceof FormData) { cles = [...corps.keys()].slice(0, 80).map((k) => k + ':formdata'); }
      else return;
      if (cles.length) post({ kind: 'lbcenvoi', url, methode: String(methode || ''), cles: cles.slice(0, 400) });
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
      chemin = chemin.replace(/\/\d{3,}/g, '/{id}').replace(/\/[0-9a-f]{16,}/gi, '/{id}');
      const rec = ((methode ? String(methode).toUpperCase() + ' ' : '') + host + chemin
        + (s ? ' → ' + s : '') + (t ? ' [' + t + ']' : '')).slice(0, 160);
      if (!seenPaths.has(rec)) { seenPaths.add(rec); seenDirty = true; }
    } catch (_) {}
  };
  setInterval(() => { if (seenDirty) { seenDirty = false; post({ kind: 'lbcpaths', paths: [...seenPaths].slice(0, 200) }); } }, 4000);

  const handle = (url, text, ctype) => {
    try {
      if (NOISE.test(url)) return;
      if (!text || text.length > 1500000) return;
      if (ctype && !/json/i.test(ctype)) return;
      if (!DE_LEBONCOIN(url)) return;                       // ni pub, ni tiers
      if (CATALOGUE.test(url)) {
        // On le garde entier dans la limite, et on DIT s'il a été coupé : la
        // moitié d'un catalogue a l'air d'un catalogue.
        post({ kind: 'lbccatalogue', url, body: text.slice(0, CAT_MAX), coupe: text.length > CAT_MAX });
        return;
      }
      // LA VENTE : sa propre transaction/commande/livraison. Ligne dédiée, capée.
      if (VENTE_HINT.test(url)) { const c = allegeVente(text); post({ kind: 'lbcvente', url, body: c.slice(0, VENTE_MAX), coupe: c.length > VENTE_MAX }); return; }
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
