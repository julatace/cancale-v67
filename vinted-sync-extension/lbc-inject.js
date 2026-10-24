// lbc-inject.js — tourne dans le MAIN world de leboncoin.fr.
// OBSERVATION PURE : on enveloppe fetch/XHR pour LIRE les réponses que la page
// charge déjà (tes annonces), sans faire la moindre requête en plus. On envoie
// les réponses « annonces » au content script (lbc.js) qui les relaie au
// background. Un mouchard note aussi les chemins d'API vus (pour brancher juste).
(function () {
  'use strict';
  // 20 octobre (Orion iPhone, tout navigateur qui ignorerait `world: "MAIN"`
  // dans le manifeste) : ce fichier tournerait alors dans le monde ISOLÉ — où
  // envelopper fetch/XHR ne voit RIEN de la page, en silence. Le signe est
  // sûr : seul un script de contenu isolé voit `chrome.runtime.id`, et il n'a
  // pas de `document.currentScript`. Dans ce cas on se pose dans la page par
  // une balise <script> (ressource web-accessible), comme inject.js sur Vinted.
  // Sur Chrome et Firefox (monde MAIN honoré) rien ne change.
  try {
    const rt = (typeof chrome !== 'undefined' && chrome && chrome.runtime) || null;
    if (!document.currentScript && rt && rt.id && typeof rt.getURL === 'function') {
      const s = document.createElement('script');
      s.src = rt.getURL('lbc-inject.js');
      s.onload = function () { this.remove(); };
      (document.head || document.documentElement).appendChild(s);
      return;
    }
  } catch (_) {}
  if (window.__vrmLbcInjected) return; window.__vrmLbcInjected = true;
  const TAG = 'CANCALE_LBC';
  const CAPTEUR_VERSION='5.218.0';
  // Le monde MAIN peut précéder le relais isolé, même à document_start.
  // Rejouer uniquement en mémoire, borné, sans requête ni persistance locale.
  let relaisPret=false,sequence=0,octetsAttente=0;
  const attente=[];
  const post = (payload) => {
    const m=Object.assign({__tag:TAG,__vrmSequence:++sequence},payload);
    if(!relaisPret){const taille=JSON.stringify(m).length;if(taille<=1500000){attente.push({m,taille});octetsAttente+=taille;while(attente.length>64||octetsAttente>4000000)octetsAttente-=attente.shift().taille;}}
    try{window.postMessage(m,'*');}catch(_){}
    return m.__vrmSequence;
  };
  try{window.addEventListener('message',event=>{
    if(event.source!==window||event.data?.__tag!=='CANCALE_LBC_RELAY'||event.data.kind!=='pret')return;
    if(!relaisPret)try{window.postMessage({__tag:'CANCALE_LBC_CAPTEUR',kind:'actif',version:CAPTEUR_VERSION},'*');}catch(_){}
    relaisPret=true;for(const {m} of attente.splice(0))try{window.postMessage(m,'*');}catch(_){}octetsAttente=0;
  });window.postMessage({__tag:'CANCALE_LBC_CAPTEUR',kind:'pret',version:CAPTEUR_VERSION},'*');}catch(_){}


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
    } catch (_) { return null; }   // Un JSON illisible n'est jamais tronqué puis présenté comme reçu.
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
      // (20 oct.) Un chemin revu remonte en dernier (ordre = du plus ancien au
      // plus récent), et ce sont les 200 PLUS RÉCENTS qui partent : la ligne de
      // base, pleine, remplace désormais les plus anciens par ceux-là.
      if (seenPaths.has(rec)) seenPaths.delete(rec); else seenDirty = true;
      seenPaths.add(rec);
      if (seenPaths.size > 400) seenPaths.delete(seenPaths.values().next().value);
    } catch (_) {}
  };
  setInterval(() => { if (seenDirty) { seenDirty = false; post({ kind: 'lbcpaths', paths: [...seenPaths].slice(-200) }); } }, 4000);

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
  const detailsTentes=new Map(),accusesTransactions=new Map();
  window.addEventListener('message',event=>{
    const d=event.data;if(event.source!==window||d?.__tag!=='CANCALE_LBC_ACCUSE'||!Number.isSafeInteger(d.sequence))return;
    const a=accusesTransactions.get(d.sequence);if(!a)return;clearTimeout(a.timer);accusesTransactions.delete(d.sequence);
    if(d.ok===true){const memo=memoDetail();memo[a.id]={t:Date.now(),st:a.st,preuve:'detail-integre-v1'};ecrireMemo(memo);}
  });
  const envoyerAvecAccuse=payload=>{
    const seq=post(payload);if(payload.kind!=='lbcvente')return;
    const id=/transactions?\/(\d+)/.exec(payload.url)?.[1];if(!id)return;
    try{const j=JSON.parse(payload.body),d=j?.pageProps?.transaction||j?.pageProps?.data||j;if(typeof d?.is_seller!=='boolean')return;
      const st=typeof d.step==='string'?d.step:d.step?.status||'';
      const timer=setTimeout(()=>accusesTransactions.delete(seq),25000);
      accusesTransactions.set(seq,{id,st,timer});
    }catch(_){}
  };
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
      if(now-(detailsTentes.get(t.id)||0)<60000)return false;
      if (!m || m.preuve!=='detail-integre-v1') return true;
      if (FINI.test(m.st || '')) return false;             // déjà lue une fois terminée
      return now - (m.t || 0) > DETAIL_REVOIR_MS;
    }).slice(0, DETAIL_MAX);
    if (!aLire.length) return;
    detailEnCours = true;
    try {
      for (const t of aLire) {
        detailsTentes.set(t.id,Date.now());
        const url = 'https://api.leboncoin.fr/api/consumergoods/proxy/v2/pages/transactions/' + encodeURIComponent(t.id);
        let st = t.st;
        try {
          // window.fetch (notre crochet) : la réponse repasse par `handle`, donc
          // elle est rangée exactement comme une transaction ouverte à la main.
          const res = await window.fetch(url, { method: 'GET', credentials: 'include', headers: entetesLbc || { Accept: 'application/json' } });
          if ([401,403,429].includes(res.status)) break;   // refusé : on s'arrête
          if (!res.ok) continue;
          if (res.ok) { try { const j=await res.clone().json(),d=j?.pageProps?.transaction||j?.pageProps?.data||j;if(typeof d?.is_seller!=='boolean'||!d.item||!d.step)continue;st=typeof d.step==='string'?d.step:d.step.status||st; } catch (_) {continue;} }
        } catch (_) {continue;}
        // Le mémo durable attend l'accusé du fond, pas la seule réponse HTTP.
      }
    } finally { detailEnCours = false; }
  };

  // Attribution des listes : identité privée du compte, dans ce document.
  // Les compteurs restent lisibles mais ne déclenchent plus l'envoi des annonces.
  // Les listes attendent jusqu'à 90 secondes ; deux identités privées différentes
  // dans le même document bloquent toute nouvelle attribution.
  const MOI_LISTE = /(\/adfinder\/v\d+\/myads\b|\/classifieds\/analysis\/list)/i;
  let sessDoc = '', basculeDoc = false;
  const listesEnAttente = [];
  const noterCompteurDoc = (id) => {
    if(comptePriveDoc)return;
    if (!sessDoc) {
      sessDoc = id;
      // Les listes attendent l'identité privée ; un compteur n'en est pas la preuve.
    } else if (id !== sessDoc && !basculeDoc) {
      basculeDoc = true;
      // On conserve les listes en attente pour une éventuelle identité privée.
    }
  };
  const posterListeMoi=(url,body)=>posterDonneeMoi('lbcraw',url,body);
  const posterDonneeMoi = (kind, url, body) => {
    // Un détail porte déjà is_seller : on peut le lire sans inventer un compte.
    // Seules les annonces exigent une identité privée pour prouver leur propriétaire.
    if(kind==='lbcvente'&&!comptePriveDoc){envoyerAvecAccuse({kind,url,body,session:''});return;}
    if (basculeDoc && comptePriveDoc) return;
    if (comptePriveDoc) { envoyerAvecAccuse({ kind, url, body, session: sessDoc }); return; }
    if (listesEnAttente.length >= 3) clearTimeout(listesEnAttente.shift().t);
    const x = { kind, url, body, t: 0 };
    x.t = setTimeout(() => { const i = listesEnAttente.indexOf(x); if (i >= 0) listesEnAttente.splice(i, 1); }, 90000);
    listesEnAttente.push(x);
  };


  let comptePriveDoc='';
  const sessionPrivee=(url,text)=>{
    let u,j;try{u=new URL(url,location.origin);j=JSON.parse(text);}catch(_){return false;}
    if(u.username||u.password||u.origin!=='https://api.leboncoin.fr'||!/^\/api\/account\/v\d+\/members\/me\/account\/?$/.test(u.pathname))return false;
    const a=j?.account,m=j?.member,id=String(a?.account_id||''),nom=m?.nickname?.value;
    if(!['string','number'].includes(typeof a?.account_id)||!['string','number'].includes(typeof m?.account_id)||!/^[a-z0-9_-]{1,64}$/i.test(id)||String(m?.account_id||'')!==id||typeof nom!=='string'||!nom.trim())return false;
    const cle='lbc-account:'+id;
    const preuve={account:{account_id:id,type:typeof a.type==='string'?a.type:''},member:{account_id:id,nickname:{value:nom.slice(0,60)}}};
    post({kind:'lbcsessionprivee',url:u.origin+u.pathname,preuve});
    if(comptePriveDoc&&comptePriveDoc!==cle){basculeDoc=true;return true;}
    if(!comptePriveDoc)basculeDoc=false;
    comptePriveDoc=cle;sessDoc=cle;
    while(listesEnAttente.length){const x=listesEnAttente.shift();clearTimeout(x.t);if(!basculeDoc)envoyerAvecAccuse({kind:x.kind,url:x.url,body:x.body,session:cle});}
    return true;
  };
  // ── LA DATE DES VENTES (20 oct., 5.196) ────────────────────────────────────
  // La date de VENTE n'est que dans la LISTE des transactions (`created_at`) ;
  // le détail n'en porte aucune. Une vente ouverte directement (un lien, une
  // notification) n'était donc jamais datée tant qu'il ne repassait pas par
  // « Mes transactions ». ⇒ On retient les adresses EXACTES des listes que le
  // site a lui-même demandées (jamais une adresse devinée) et les ventes qu'on
  // y a vues datées ; quand un détail « je suis le vendeur » arrive pour une
  // vente jamais vue datée, on relit ces listes — LECTURE de ses données (§3),
  // 3 au plus, une par une, pas avant 6 h.
  const LISTES_CLE = 'vrm_lbc_listes', DATEES_CLE = 'vrm_lbc_datees', RELU_CLE = 'vrm_lbc_listes_relues';
  const lireLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (_) { return d; } };
  const ecrireLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const noterListe = (url, text) => {
    let arr; try { arr = JSON.parse(text); } catch (_) { return; }
    if (!Array.isArray(arr)) return;
    const l = lireLS(LISTES_CLE, []).filter((u) => u !== url); l.push(url); ecrireLS(LISTES_CLE, l.slice(-3));
    const d = lireLS(DATEES_CLE, {});
    for (const t of arr) { const id = String((t && ((t.id && t.id.purchase_id) || t.purchase_id)) || ''); if (id && t && typeof t.created_at === 'string' && !isNaN(Date.parse(t.created_at))) d[id] = 1; }
    const ks = Object.keys(d); if (ks.length > 500) for (const k of ks.slice(0, ks.length - 500)) delete d[k];
    ecrireLS(DATEES_CLE, d);
  };
  let relectureListes = false;
  const relusParNous = new Set();               // nos propres relectures : elles ne relancent pas la lecture des détails
  const dateSiVendeur = async (url, text) => {
    try {
      if (relectureListes) return;
      const m = /pages\/transactions\/(\d+)/.exec(url); if (!m) return;
      let j; try { j = JSON.parse(text); } catch (_) { return; }
      const d = (j && j.pageProps && j.pageProps.transaction) || j;
      if (!d || d.is_seller !== true) return;
      if (lireLS(DATEES_CLE, {})[m[1]]) return;                  // déjà vue datée
      if (Date.now() - Number(lireLS(RELU_CLE, 0)) < DETAIL_REVOIR_MS) return;
      const listes = lireLS(LISTES_CLE, []);
      if (!listes.length) return;                                 // aucune adresse du site : rien deviné
      ecrireLS(RELU_CLE, Date.now());
      relectureListes = true;
      for (const u of listes.slice(-3)) {
        try {
          relusParNous.add(u);
          const res = await window.fetch(u, { method: 'GET', credentials: 'include', headers: entetesLbc || { Accept: 'application/json' } });
          if (res.status === 401 || res.status === 403 || res.status === 429) break;
        } catch (_) {}
      }
    } finally { relectureListes = false; }
  };


  // ── LA LISTE COMPLÈTE D'UN VENDEUR (22 octobre — proposition 14) ──────────
  // Mesuré (lecture seule) : sa page profil Leboncoin charge
  // `POST api.leboncoin.fr/api/adfinder/v2/owner_listing`, corps
  // `{limit, offset, sort_by, sort_order, filters:{owner:{user_id}, enums:{ad_type}}}`,
  // réponse `{total, total_active, max_pages, referrer_id, ads:[{list_id, owner:{user_id}}]}`.
  // Une liste ne DÉCIDE que si elle est PROUVÉE complète, sinon rien :
  //   · la requête ne filtre QUE sur le vendeur (aucun mot-clé, aucune catégorie,
  //     aucune annonce mise à part — la v1 « autres annonces du vendeur » exclut
  //     l'annonce affichée : elle ne décide jamais) ;
  //   · chaque annonce rendue est à CE vendeur ;
  //   · le total annoncé est atteint par les annonces distinctes de toutes les
  //     pages lues dans ce document, au même total, en moins de 3 minutes (une
  //     liste qui bouge entre deux pages repart de zéro) ;
  //   · un total nul ne décide rien (une réponse vide peut être un hoquet).
  // On n'envoie que des identifiants et le total : la décision (« plus vue sur
  // Leboncoin ») est prise par le fond, sur SES comptes seulement.
  const OWNER_LISTING = /^https:\/\/api\.leboncoin\.fr\/api\/adfinder\/v2\/owner_listing\/?(?:\?.*)?$/i;
  const requeteProprietaire = (corps) => {
    let r; try { r = typeof corps === 'string' ? JSON.parse(corps) : null; } catch (_) { return null; }
    if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
    for (const k of Object.keys(r)) if (!['limit', 'offset', 'filters', 'sort_by', 'sort_order'].includes(k)) return null;
    const f = r.filters;
    if (!f || typeof f !== 'object' || Array.isArray(f)) return null;
    for (const k of Object.keys(f)) if (k !== 'owner' && k !== 'enums') return null;
    const o = f.owner;
    if (!o || typeof o !== 'object' || Object.keys(o).length !== 1 || typeof o.user_id !== 'string' || !/^[0-9a-f-]{8,64}$/i.test(o.user_id)) return null;
    if (f.enums !== undefined) {
      const e = f.enums;
      if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
      for (const k of Object.keys(e)) if (k !== 'ad_type') return null;
      if (e.ad_type !== undefined && !(Array.isArray(e.ad_type) && e.ad_type.length === 1 && e.ad_type[0] === 'offer')) return null;
    }
    const offset = r.offset === undefined ? 0 : r.offset;
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(r.limit) || r.limit <= 0) return null;
    return { owner: o.user_id, offset, tri: String(r.sort_by || '') + '/' + String(r.sort_order || '') };
  };
  const reponseProprietaire = (texte, owner) => {
    let j; try { j = JSON.parse(texte); } catch (_) { return null; }
    if (!j || typeof j !== 'object' || !Array.isArray(j.ads) || !Number.isInteger(j.total) || j.total < 0) return null;
    if (j.referrer_id != null && String(j.referrer_id) !== '') return null;      // une annonce mise à part
    const ids = [];
    for (const a of j.ads) {
      const id = a && a.list_id;
      if (!(Number.isSafeInteger(id) || /^\d{1,15}$/.test(String(id == null ? '' : id)))) return null;
      if (String((a.owner && a.owner.user_id) || '') !== owner) return null;    // l'annonce d'un autre : pas SA liste
      ids.push(String(id));
    }
    if (new Set(ids).size !== ids.length) return null;
    return { total: j.total, ids };
  };
  const lecturesProprio = new Map();          // cle → { ids:Set, t0, envoye } — en mémoire, ce document seulement
  const noterListeProprietaire = (url, texte, corpsReq) => {
    if (!OWNER_LISTING.test(String(url || ''))) return;
    const req = requeteProprietaire(corpsReq); if (!req) return;
    const rep = reponseProprietaire(texte, req.owner); if (!rep) return;
    const cle = req.owner + '|' + req.tri + '|' + rep.total;
    // Un autre total pour ce vendeur : la liste a bougé, on repart.
    for (const k of [...lecturesProprio.keys()]) if (k.startsWith(req.owner + '|') && k !== cle) lecturesProprio.delete(k);
    let l = lecturesProprio.get(cle);
    if (!l || Date.now() - l.t0 > 180000) { l = { ids: new Set(), t0: Date.now(), envoye: false }; lecturesProprio.set(cle, l); }
    for (const id of rep.ids) l.ids.add(id);
    if (l.ids.size > rep.total) { lecturesProprio.delete(cle); return; }           // incohérent : rien ne décide
    if (rep.total > 0 && l.ids.size === rep.total && !l.envoye) {
      l.envoye = true;
      post({ kind: 'lbclistecomplete', owner: req.owner, ids: [...l.ids], total: rep.total });
    }
  };

  // ── LES EN-TÊTES DU SITE, POUR LA MISE EN PAUSE SUR SON CLIC (22 oct.) ─────
  // La mise en pause part de CETTE page, avec les en-têtes que Leboncoin met
  // lui-même sur ses appels à son API (jamais vus d'ici : on les recopie, on ne
  // les devine pas). Gardés en mémoire, dans la page — jamais envoyés ailleurs,
  // jamais rangés. Seuls leurs NOMBRE part dans le diagnostic.
  let entetesApi = null, entetesPintad = null;
  const SANS_ENTETE = /^(content-type|content-length|cookie|host|x-vrm)$/i;
  const noterEntetes = (url, h) => {
    try {
      if (!/^https:\/\/api\.leboncoin\.fr\/api\//i.test(String(url || '')) || !h) return;
      const o = h instanceof Headers ? Object.fromEntries(h.entries()) : (Array.isArray(h) ? Object.fromEntries(h) : Object.assign({}, h));
      for (const k of Object.keys(o)) if (SANS_ENTETE.test(k) || typeof o[k] !== 'string') delete o[k];
      if (!Object.keys(o).length) return;
      if (/\/api\/pintad\//i.test(url)) entetesPintad = o; else entetesApi = o;
    } catch (_) {}
  };

  const handle = (url, text, ctype, statut = 200, corpsReq = null) => {
    try {
      if (NOISE.test(url)||statut<200||statut>=300) return;
      if (!text || text.length > 8000000) return;
      if (ctype && !/json/i.test(ctype)) return;
      if (!DE_LEBONCOIN(url)) return;                       // ni pub, ni tiers
      // ⚠️ Un jeton de connexion temps réel : rien, nulle part, pas même ses clés.
      if (/\/realtime\/credentials/i.test(url)) return;
      if(sessionPrivee(url,text))return;
      // Alléger les grosses réponses de transaction AVANT le plafond générique.
      // Ne jamais couper du JSON : la fin contient souvent la vraie transaction.
      if(VENTE_HINT.test(url)){
        const c=allegeVente(text);
        if(c)noteSchema(url,c);
        if(!c||new TextEncoder().encode(c).length>VENTE_MAX){post({kind:'lbcblocage',famille:'transactions',raison:c?'taille':'format'});return;}
        posterDonneeMoi('lbcvente',url,c);
        if(/consumergoods\/proxy\/v\d+\/pages\/transactions(?:\?|$)/i.test(url)){noterListe(url,c);if(relusParNous.has(url))relusParNous.delete(url);else setTimeout(()=>lireDetails(c),800);}
        else if(/consumergoods\/proxy\/v\d+\/pages\/transactions\/\d+/i.test(url))setTimeout(()=>dateSiVendeur(url,c),800);
        return;
      }
      if(text.length>1500000)return;

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
        if (m) { try { const o = JSON.parse(text); const n = Number(o && o.unread); if (Number.isFinite(n) && n >= 0) { post({ kind: 'lbcmsgcompteur', userId: m[1], unread: Math.round(n) }); noterCompteurDoc(m[1]); } } catch (_) {} }
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
      if (!AD_HINT.test(text) && !AD_HINT.test(url) && !ACCOUNT_HINT.test(url) && !ACCOUNT_HINT.test(text)) return;
      if (MOI_LISTE.test(url)) { posterListeMoi(url, text); return; }
      post({ kind: 'lbcraw', url, body: text });
      // APRÈS les annonces : la liste complète ne part qu'une fois rangées (même file).
      try { noterListeProprietaire(url, text, corpsReq); } catch (_) {}
    } catch (_) {}
  };

  // Certaines pages contiennent déjà les données : aucun fetch n'aura lieu.
  // La source est le document privé exact, jamais un objet public du DOM.
  const cheminInitial=location.pathname;
  const lireDocumentInitial=()=>{
    if(window.top!==window||location.pathname!==cheminInitial)return;
    const el=document.getElementById('__NEXT_DATA__');if(!el?.textContent||el.textContent.length>8000000)return;
    let j;try{j=JSON.parse(el.textContent);}catch(_){return;}
    const p=j?.props?.pageProps||j?.pageProps;if(!p||typeof p!=='object')return;
    const url=location.origin+cheminInitial;
    if(/^\/compte\/(?:part|pro)\/mes-annonces\/?$/.test(cheminInitial)){
      const ads=Array.isArray(p.ads)?p.ads:Array.isArray(p.data?.ads)?p.data.ads:null;
      if(ads){const body=JSON.stringify({ads});noteSchema(url,body);if(body.length<=1500000)posterListeMoi(url,body);}
    }else if(/^\/compte\/(?:part|pro)\/transaction\/\d+\/?$/.test(cheminInitial)){
      const d=p.transaction||p.data;
      if(d&&typeof d.is_seller==='boolean')handle(url,JSON.stringify({pageProps:{transaction:d}}),'application/json',200);
    }else if(/^\/compte\/(?:part|pro)\/mes-transactions\/?$/.test(cheminInitial)&&Array.isArray(p.transactions)){
      handle(url,JSON.stringify(p.transactions),'application/json',200);
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',lireDocumentInitial,{once:true});else lireDocumentInitial();

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      const url = (typeof input === 'string') ? input : (input instanceof URL ? input.href : (input && input.url) || '');
      const meth = (init && init.method) || (typeof input === 'object' && input && input.method) || 'GET';
      try { if (MODIFIE.test(meth)) noteEnvoi(url, init && init.body, meth); } catch (_) {}
      // La liste d'un vendeur : son corps de requête dit si elle peut DÉCIDER (22 oct.).
      let corpsReq = null;
      try { if (init && typeof init.body === 'string' && OWNER_LISTING.test(url)) corpsReq = init.body; } catch (_) {}
      try { noterEntetes(url, init && init.headers); } catch (_) {}
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
            res.clone().text().then((t) => handle(url, t, ct, res.status, corpsReq)).catch(() => {});
          } catch (_) {}
        }).catch(() => {});
      } catch (_) {}
      return p;
    };
  }

  const OX = window.XMLHttpRequest;
  if (OX) {
    const origOpen = OX.prototype.open, origSend = OX.prototype.send, origSetH = OX.prototype.setRequestHeader;
    OX.prototype.open = function (method, url) { this.__lbcUrl = url; this.__lbcMeth = method; this.__lbcH = null; return origOpen.apply(this, arguments); };
    if (origSetH) OX.prototype.setRequestHeader = function (k, v) { try { (this.__lbcH = this.__lbcH || {})[String(k)] = String(v); } catch (_) {} return origSetH.apply(this, arguments); };
    OX.prototype.send = function (corps) {
      try { if (MODIFIE.test(this.__lbcMeth || '')) noteEnvoi(this.__lbcUrl || '', corps, this.__lbcMeth); } catch (_) {}
      try { this.__lbcCorps = (typeof corps === 'string' && OWNER_LISTING.test(this.__lbcUrl || '')) ? corps : null; noterEntetes(this.__lbcUrl || '', this.__lbcH); } catch (_) {}
      try {
        this.addEventListener('load', function () {
          try {
            const url = this.__lbcUrl || '';
            if (/vinted|supabase/i.test(url)) return;
            const ct = this.getResponseHeader && this.getResponseHeader('content-type');
            noteSeen(url, this.__lbcMeth, this.status, ct);
            const t = this.responseType === 'json' ? JSON.stringify(this.response) : (this.responseType === '' || this.responseType === 'text') ? this.responseText : null;
            if (t) handle(url, t, ct, this.status, this.__lbcCorps || null);
          } catch (_) {}
        });
      } catch (_) {}
      return origSend.apply(this, arguments);
    };
  }

  // ── METTRE EN PAUSE, SUR SON CLIC (22 octobre — proposition 6) ─────────────
  // L'ordre vient du relais (lbc-relay.js), qui le tient du fond de l'extension,
  // qui le tient de l'app — après SA confirmation, et après avoir vérifié que
  // l'annonce est sur le compte connecté dans CET onglet. Ici : UNE adresse,
  // écrite en dur, VUE dans ses propres gestes (`lbc_recon.envois`, 23 sept.) ;
  // une méthode (PUT), un corps (`{list_ids:[n]}`), une annonce. Jamais une
  // suppression, jamais une autre adresse. La réponse de Leboncoin repart telle
  // quelle (statut + 300 premiers caractères + la FORME du corps).
  const URL_PAUSE_LBC = 'https://api.leboncoin.fr/api/pintad/v1/public/manual/pause/ads';
  let pauseEnCours = false;
  try { window.addEventListener('message', async (event) => {
    const d = event && event.data;
    if (event.source !== window || !d || d.__tag !== 'CANCALE_LBC_ORDRE' || d.kind !== 'pause') return;
    const id = String(d.id || ''), jeton = String(d.jeton || '');
    if (!/^\d{6,12}$/.test(id) || !/^[a-z0-9-]{8,64}$/i.test(jeton)) return;
    if (window.top !== window || !/(^|\.)leboncoin\.fr$/i.test(location.hostname)) return;
    if (pauseEnCours) { post({ kind: 'lbcpauseresultat', jeton, id, statut: 0, erreur: 'en-cours' }); return; }
    pauseEnCours = true;
    try {
      const h = Object.assign({}, entetesPintad || entetesApi || {}, { 'Content-Type': 'application/json', Accept: 'application/json' });
      let statut = 0, corps = '', erreur = '';
      try {
        const res = await origFetch.call(window, URL_PAUSE_LBC, { method: 'PUT', credentials: 'include', headers: h, body: JSON.stringify({ list_ids: [Number(id)] }) });
        statut = Number(res.status) || 0;
        try { corps = String(await res.text()).slice(0, 2000); } catch (_) {}
      } catch (e) { erreur = String((e && e.message) || e).slice(0, 80) || 'reseau'; }
      let cles = [];
      try { cles = cheminsDeCles(JSON.parse(corps)).slice(0, 60); } catch (_) {}
      post({ kind: 'lbcpauseresultat', jeton, id, statut, corps: corps.slice(0, 300), cles, erreur, entetes: Object.keys(h).length });
    } finally { pauseEnCours = false; }
  }); } catch (_) {}
})();
