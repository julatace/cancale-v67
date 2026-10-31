// vc-inject.js — tourne dans le MAIN world de vestiairecollective.com.
// ── VESTIAIRE COLLECTIVE : APPRENDRE À LIRE LE SITE, SANS RIEN LIRE DE SES DONNÉES ──
// Julien, 4 octobre : « commence à faire Vestiaire Collective bien ». Mesuré :
// AUCUNE donnée Vestiaire en base, et le site est inaccessible d'ici (403) — on
// ne connaît ni ses adresses d'API ni la forme de ses pages. Écrire un analyseur
// de ventes aujourd'hui serait deviner (§4.10, §6.3).
// ⇒ On fait MESURER le site par son navigateur, comme pour Leboncoin : on
//   enveloppe fetch/XHR pour regarder les réponses que la page charge DÉJÀ
//   (aucune requête de plus, aucun clic, aucun délai « humain » — §3), et on
//   relève uniquement :
//     · les CHEMINS d'API vus (méthode + chemin normalisé + code de réponse) ;
//     · la STRUCTURE des réponses JSON (chemins de clés + type de feuille) ;
//     · les familles de PAGES visitées ;
//     · les HÔTES tiers (le nom seul, jamais le chemin) — pour savoir si l'API
//       vit ailleurs.
//   ⚠️ JAMAIS UNE VALEUR : ni un nom, ni un prix, ni une adresse, ni un message.
//   Les identifiants dans les chemins et les clés deviennent `{id}` / `{uuid}`.
// Rien n'est encore « capté » : le jour où la structure dit où vivent une vente,
// son montant net et sa date, on écrira l'analyseur — pas avant.
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
      s.src = rt.getURL('vc-inject.js');
      s.onload = function () { this.remove(); };
      (document.head || document.documentElement).appendChild(s);
      return;
    }
  } catch (_) {}
  if (window.__vrmVcInjected) return; window.__vrmVcInjected = true;
  const TAG = 'CANCALE_VC';
  const post = (payload) => { try { window.postMessage(Object.assign({ __tag: TAG }, payload), '*'); } catch (_) {} };
  const NOISE = /(datadome|captcha|track|metric|telemetr|analytic|consent|pixel|gtm|beacon|sentry|hotjar|optimizely|segment\.io)/i;
  const DE_VC = (url) => { try { return /(^|\.)vestiairecollective\.com$/i.test(new URL(url, location.origin).hostname); } catch (_) { return false; } };
  const hoteDe = (url) => { try { return new URL(url, location.origin).hostname; } catch (_) { return ''; } };

  // Un identifiant ne part jamais : UUID, longues suites hexadécimales, nombres
  // de 3 chiffres ou plus, et tout segment qui n'a pas la forme d'un mot.
  const sansId = (x) => String(x)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}')
    .replace(/[0-9a-f]{16,}/gi, '{id}')
    .replace(/\d{3,}/g, '{id}');
  const normChemin = (p) => String(p || '').split('/').map((s) => {
    if (!s) return s;
    if (/^\{(id|uuid)\}$/.test(s)) return s;
    if (/^[a-z][a-z0-9_-]{0,30}$/i.test(s) && !/\d{3,}/.test(s)) return s;
    if (/\.(s?html?|json)$/i.test(s)) return '{page}.' + s.split('.').pop();
    return '{x}';
  }).join('/').slice(0, 160);
  const cleSure = (k) => (/@|\d{3,}|[0-9a-f]{16,}/i.test(k) || k.length > 40) ? '{k}' : k;

  function cheminsDeCles(v, prefixe, out, prof) {
    if (!out) out = []; if (out.length > 300 || (prof || 0) > 6) return out;
    if (Array.isArray(v)) { if (v.length) cheminsDeCles(v[0], (prefixe || '') + '[]', out, (prof || 0) + 1); return out; }
    if (v && typeof v === 'object') {
      for (const k of Object.keys(v).slice(0, 80)) cheminsDeCles(v[k], (prefixe ? prefixe + '.' : '') + cleSure(k), out, (prof || 0) + 1);
      return out;
    }
    // La FEUILLE : son chemin et son TYPE, jamais sa valeur.
    if (prefixe) out.push(prefixe + ':' + (v === null ? 'null' : typeof v));
    return out;
  }

  const typeCourt = (ctype) => { const c = String(ctype || '').toLowerCase(); return /pdf/.test(c) ? 'pdf' : /json/.test(c) ? 'json' : /html/.test(c) ? 'html' : /image/.test(c) ? 'img' : ''; };
  const chemins = new Set(), hotes = {}, pages = new Set(), schemas = {};
  let sale = false;
  const noteVu = (url, methode, statut, ctype) => {
    try {
      if (NOISE.test(url)) return;
      if (!DE_VC(url)) { const h = hoteDe(url); if (h && Object.keys(hotes).length < 40) { hotes[h] = (hotes[h] || 0) + 1; sale = true; } return; }
      let chemin = ''; try { chemin = new URL(url, location.origin).pathname; } catch (_) { chemin = String(url).split('?')[0]; }
      const rec = ((methode ? String(methode).toUpperCase() + ' ' : '') + hoteDe(url) + normChemin(sansId(chemin)) + (statut ? ' → ' + statut : '') + (typeCourt(ctype) ? ' [' + typeCourt(ctype) + ']' : '')).slice(0, 200);
      if (!chemins.has(rec) && chemins.size < 300) { chemins.add(rec); sale = true; }
    } catch (_) {}
  };
  const noteSchema = (url, texte) => {
    try {
      if (!DE_VC(url) || NOISE.test(url) || !texte || texte.length > 1500000) return;
      let ep = ''; try { const u = new URL(url, location.origin); ep = u.hostname + normChemin(sansId(u.pathname)); } catch (_) { return; }
      if (schemas[ep] || Object.keys(schemas).length >= 60) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      if (!obj || typeof obj !== 'object') return;
      const cles = cheminsDeCles(obj).map(sansId).slice(0, 200);
      if (cles.length) { schemas[ep] = cles; sale = true; }
    } catch (_) {}
  };
  const notePage = () => { try { const f = normChemin(sansId(location.pathname)); if (!pages.has(f) && pages.size < 60) { pages.add(f); sale = true; } } catch (_) {} };
  notePage();
  try {
    const ps = history.pushState, rs = history.replaceState;
    history.pushState = function () { const r = ps.apply(this, arguments); notePage(); return r; };
    history.replaceState = function () { const r = rs.apply(this, arguments); notePage(); return r; };
    window.addEventListener('popstate', notePage);
  } catch (_) {}
  // Envoi groupé, au plus toutes les 5 s, et seulement s'il y a du neuf.
  setInterval(() => {
    if (!sale) return; sale = false;
    post({ kind: 'vcrecon', chemins: [...chemins], hotes: Object.assign({}, hotes), pages: [...pages], schemas: Object.assign({}, schemas),
      nextData: !!document.getElementById('__NEXT_DATA__'), nextFlux: !!(window.self && window.self.__next_f) });
  }, 5000);


  // ══════════════════════════════════════════════════════════════════════════
  // TES ANNONCES ET LEUR BOOST (27 octobre, 5.236)
  // ══════════════════════════════════════════════════════════════════════════
  // Julien : « l'extension doit sur Vestiaire, comme pour Vinted et Leboncoin,
  // capter si des annonces ont été boostées — ce n'est pas au vendeur de le
  // faire ». La seule liste de SES annonces vue chez lui est
  // `users/me/product-listings` (mesuré le 26 oct., vide ce jour-là : la FORME
  // d'une annonce n'a jamais été vue). Donc, sur cette réponse seulement :
  //   · l'identifiant de chaque annonce (le sien, pas une donnée personnelle) ;
  //   · son BOOST, lu sur une clé dont le NOM le dit (boost, promoted, featured,
  //     sponsored, spotlight, highlight, bump…) : `true`/`false`, un nombre > 0,
  //     une date encore à venir, ou un objet `{active|enabled|isActive}`. Aucune
  //     clé de ce nom ⇒ `null` (« pas su »), jamais « non boostée » ;
  //   · la référence `VRM-{n°}` si un texte de l'annonce la porte — SEULEMENT la
  //     référence, jamais le texte (c'est elle qui relie à la paire, §5).
  // Et le NOM des clés lues (jamais leur valeur), pour viser juste ensuite.
  const BOOST_CLE = /boost|promot|featur|sponsor|spotlight|highlight|bump|mise.?en.?avant|visibility.?(?:option|boost)/i;
  const RE_REF = /VRM-([A-Z]{0,3}\d{1,6})\b/i;
  function lireBoost(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v > 0;
    if (typeof v === 'string') {
      if (/^(true|active|on|yes|enabled|boosted)$/i.test(v)) return true;
      if (/^(false|inactive|off|no|disabled|none|)$/i.test(v)) return false;
      const t = Date.parse(v); if (isFinite(t)) return t > Date.now();
      return null;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const k of ['active', 'isActive', 'enabled', 'isEnabled', 'status']) if (k in v) { const r = lireBoost(v[k]); if (r !== null) return r; }
      for (const k of ['endDate', 'endsAt', 'end_date', 'expiresAt', 'expirationDate', 'until']) if (v[k]) { const t = Date.parse(v[k]); if (isFinite(t)) return t > Date.now(); }
    }
    return null;
  }
  function boostDe(o) {
    let res = null; const cles = [];
    const visite = (x, prof) => {
      if (!x || typeof x !== 'object' || prof > 2) return;
      for (const k of Object.keys(x).slice(0, 80)) {
        if (BOOST_CLE.test(k)) { cles.push(cleSure(k)); const b = lireBoost(x[k]); if (b === true) res = true; else if (b === false && res === null) res = false; }
        else if (x[k] && typeof x[k] === 'object' && !Array.isArray(x[k])) visite(x[k], prof + 1);
      }
    };
    visite(o, 0);
    return { boost: res, cles: [...new Set(cles)].slice(0, 6) };
  }
  function refDe(o) {
    let ref = '';
    const visite = (x, prof) => {
      if (ref || !x || prof > 2) return;
      if (typeof x === 'string') { const m = x.match(RE_REF); if (m) ref = m[1].toUpperCase(); return; }
      if (typeof x !== 'object') return;
      for (const k of Object.keys(x).slice(0, 80)) visite(x[k], prof + 1);
    };
    visite(o, 0);
    return ref;
  }
  function tableauAnnonces(obj) {
    const cands = [];
    const visite = (x, prof) => {
      if (!x || typeof x !== 'object' || prof > 3) return;
      if (Array.isArray(x)) { if (x.length && x.every((e) => e && typeof e === 'object' && (e.id != null || e.productId != null || e.product_id != null))) cands.push(x); return; }
      for (const k of Object.keys(x)) visite(x[k], prof + 1);
    };
    visite(obj, 0);
    return cands.sort((a, b) => b.length - a.length)[0] || null;
  }
  const idDe = (e) => String(e.id != null ? e.id : (e.productId != null ? e.productId : e.product_id)).slice(0, 40);
  // ⚠️ (31 oct., 5.294) UNE LISTE FILTRÉE N'EST PAS LA LISTE. Le fond tient une
  // liste pour ENTIÈRE quand la page 0 rend autant d'éléments que le `total`
  // annoncé — et alors il REMPLACE (annonces) ou retire ce qui n'y est plus
  // (« à expédier », « non lu »). Or ce total est celui de la REQUÊTE : un onglet
  // ou une recherche (`?status=sold`, `?q=…`) rend le total du filtre, et une
  // seule annonce « vendue » effaçait toutes les autres, un onglet vide disait
  // « Aucune annonce sur Vestiaire », une vente « à expédier » cachée par un
  // filtre ne l'était plus. Même règle que la liste complète Leboncoin (la
  // requête ne filtre sur RIEN) : hors pagination, tri et langue, le total n'est
  // pas transmis (`null` ⇒ la page ne fait que compléter, « au moins »). Les
  // paramètres que Vestiaire met vraiment n'ont jamais été vus : liste blanche,
  // le doute garde tout.
  const PARAMS_NEUTRES = /^(offset|limit|page|per_?page|pagesize|page_?size|sort|sort_?by|sort_?order|order|order_?by|direction|lang|language|locale|iso_?country|country|currency|site_?id|_|t|ts)$/i;
  const sansFiltre = (u) => { for (const k of u.searchParams.keys()) if (!PARAMS_NEUTRES.test(k)) return false; return true; };
  function noteAnnonces(url, texte) {
    try {
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!DE_VC(url) || !/\/users\/me\/product-listings\/?$/i.test(u.pathname)) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      if (!obj || typeof obj !== 'object') return;
      const arr = tableauAnnonces(obj) || [];
      const offset = Number(u.searchParams.get('offset') || (obj.meta && obj.meta.offset) || 0) || 0;
      const total = obj.meta && typeof obj.meta.count === 'number' && sansFiltre(u) ? obj.meta.count : null;
      const items = arr.slice(0, 200).map((e) => { const b = boostDe(e); return { id: idDe(e), boost: b.boost, cles: b.cles, ref: refDe(e) }; }).filter((x) => /^[\w-]{1,40}$/.test(x.id));
      post({ kind: 'vcannonces', items, offset, total, lus: arr.length });
    } catch (_) {}
  }
  // La CRÉATION d'une annonce : son identifiant, rendu par Vestiaire, relie
  // l'annonce à la paire que VRM vient de préparer dans cet onglet (le fond
  // n'accepte que l'onglet du dépôt). Une écriture 2xx sur un chemin d'article.
  function notePublication(url, methode, statut, texte) {
    try {
      if (!DE_VC(url) || !/^(POST|PUT|PATCH)$/i.test(String(methode || '')) || !(statut >= 200 && statut < 300)) return;
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!/product|listing|draft|item|article/i.test(u.pathname) || /search|like|recommend|cart|basket|order/i.test(u.pathname)) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      const cand = obj && (obj.data && typeof obj.data === 'object' ? obj.data : obj);
      const id = cand && (cand.id != null ? cand.id : (cand.productId != null ? cand.productId : cand.product_id));
      if (id == null || !/^[\w-]{1,40}$/.test(String(id))) return;
      post({ kind: 'vcpublie', productId: String(id), chemin: normChemin(sansId(u.pathname)), methode: String(methode).toUpperCase() });
    } catch (_) {}
  }


  // ══════════════════════════════════════════════════════════════════════════
  // TES VENTES (27 octobre, 5.237)
  // ══════════════════════════════════════════════════════════════════════════
  // Julien : « fais pareil pour capter les ventes Vestiaire ». Même méthode que
  // le boost : on lit ce que la page charge DÉJÀ (aucune requête de plus, §3),
  // sur deux familles de réponses seulement :
  //   · `users/me/awaiting-shipping-items` (vue chez lui, vide le 26 oct.) :
  //     les ventes À EXPÉDIER ;
  //   · une liste de VENTES du vendeur (`users/me/…sales|sold|transactions`,
  //     `/sales`) — jamais vue d'ici : reconnue à son chemin.
  //   Jamais le panier ni les achats (`orders/current…`, `cart`, `basket`).
  // De chaque vente, des SCALAIRES seulement : son identifiant, celui de
  // l'article, la référence `VRM-{n°}` (la seule chose lue dans un texte), un
  // état (un mot court sous status/state), une date, un montant AVEC le nom de
  // sa clé (on ne sait pas encore si c'est le prix ou ce qui t'est versé).
  // ⚠️ JAMAIS le nom, l'adresse, l'email ni le message de l'acheteur.
  const CLE_ETAT = /^(status|state|orderStatus|order_status|shippingStatus|shipping_status|step|statusLabel|transactionStatus)$/i;
  const CLE_DATE = /date|created|sold|paid|ordered|At$/i;
  const CLE_MONTANT = /^(price|amount|total|totalPrice|total_price|totalAmount|total_amount|paidAmount|paid_amount|sellerPrice|seller_price|earning|earnings|payout|netAmount|net_amount|sellingPrice|selling_price)$/i;
  const PAS_ACHETEUR = /buyer|customer|address|recipient|shipping_?address|email|phone|message|user|member|interlocutor|sender|participant|author|counterpart|contact/i;
  function scalairesVente(e) {
    const out = { etat: '', date: '', montant: null };
    const visite = (x, prof, chemin) => {
      if (!x || typeof x !== 'object' || prof > 2) return;
      for (const k of Object.keys(x).slice(0, 80)) {
        const v = x[k];
        if (PAS_ACHETEUR.test(k)) continue;
        if (!out.etat && CLE_ETAT.test(k) && (typeof v === 'string' || typeof v === 'number')) { const t = String(v); if (/^[\w .:-]{1,40}$/.test(t)) out.etat = t; }
        if (!out.date && CLE_DATE.test(k) && typeof v === 'string' && isFinite(Date.parse(v)) && /\d{4}-\d{2}-\d{2}/.test(v)) out.date = v.slice(0, 30);
        if (!out.montant && CLE_MONTANT.test(k)) {
          if (typeof v === 'number') out.montant = { valeur: v, devise: '', cle: chemin + k };
          else if (v && typeof v === 'object') {
            const n = typeof v.amount === 'number' ? v.amount : (typeof v.value === 'number' ? v.value : (typeof v.cents === 'number' ? v.cents / 100 : (typeof v.amount === 'string' && /^\d+([.,]\d+)?$/.test(v.amount) ? Number(v.amount.replace(',', '.')) : null)));
            const d = typeof v.currency === 'string' ? v.currency : (typeof v.currencyCode === 'string' ? v.currencyCode : '');
            if (n != null && isFinite(n)) out.montant = { valeur: n, devise: /^[A-Z]{3}$/.test(d) ? d : '', cle: chemin + k + (typeof v.cents === 'number' ? '.cents' : '') };
          }
        }
        if (v && typeof v === 'object' && !Array.isArray(v)) visite(v, prof + 1, chemin + k + '.');
      }
    };
    visite(e, 0, '');
    return out;
  }
  function refVente(e) {
    // La référence se lit sur l'ARTICLE (sa description), jamais dans un champ
    // de l'acheteur ou un message.
    let ref = '';
    const visite = (x, prof) => {
      if (ref || !x || prof > 3) return;
      if (typeof x === 'string') { const m = x.match(RE_REF); if (m) ref = m[1].toUpperCase(); return; }
      if (typeof x !== 'object') return;
      for (const k of Object.keys(x).slice(0, 80)) { if (PAS_ACHETEUR.test(k)) continue; visite(x[k], prof + 1); }
    };
    visite(e, 0);
    return ref;
  }
  // 5.240 — LE COLIS d'une vente : la date limite d'envoi (une clé dont le NOM
  // le dit), le transporteur et le n° de suivi (la règle des achats), et SI un
  // bordereau existe — seulement `true` : son adresse ne part jamais (elle peut
  // suffire à l'ouvrir), on l'imprime sur Vestiaire.
  const CLE_LIMITE = /^(shipBy|ship_by|shipByDate|ship_by_date|shippingDeadline|shipping_deadline|deadline|dueDate|due_date|sendBefore|send_before|shippingLimitDate|expectedShippingDate|expected_shipping_date|limitDate|limit_date)$/i;
  const CLE_ETIQUETTE = /^(label|labelUrl|label_url|shippingLabel|shipping_label|shippingLabelUrl|waybill|waybillUrl|prepaidLabel|labelPdf|label_pdf)$/i;
  function colisVente(e) {
    const out = { limite: '', etiquette: null };
    const visite = (x, prof) => {
      if (!x || typeof x !== 'object' || prof > 3) return;
      for (const k of Object.keys(x).slice(0, 80)) {
        const v = x[k];
        if (PAS_ACHETEUR.test(k)) continue;
        if (!out.limite && CLE_LIMITE.test(k) && typeof v === 'string' && /\d{4}-\d{2}-\d{2}/.test(v) && isFinite(Date.parse(v))) out.limite = v.slice(0, 30);
        if (CLE_ETIQUETTE.test(k)) { if ((typeof v === 'string' && /^https?:\/\//i.test(v)) || (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length)) out.etiquette = true; else if (out.etiquette !== true && (v === null || v === '' || v === false)) out.etiquette = false; continue; }
        if (v && typeof v === 'object' && !Array.isArray(v)) visite(v, prof + 1);
      }
    };
    visite(e, 0);
    return out;
  }
  // 5.243 (Julien, 27 oct. : « l'extension doit s'adapter à la différence entre
  // les catégories Vinted et Vestiaire pour publier toute seule ») : le
  // CATALOGUE du dépôt — `deposit/catalog` (univers → catégories) et
  // `deposit/brands` — que la page de dépôt charge déjà. Ce sont des libellés
  // PUBLICS (ceux du site), aucune donnée de personne : on le garde ENTIER,
  // comme le catalogue Leboncoin, et on dit s'il a été coupé.
  const VC_CATALOGUE_MAX = 3000000;
  const vcCatVu = {};
  function noteCatalogue(url, texte) {
    try {
      let p = ''; try { p = new URL(url, location.origin).pathname; } catch (_) { return; }
      if (!/\/deposit\/(catalog|brands)(\/|$)/i.test(p)) return;
      const t = String(texte || '');
      if (!t || t[0] !== '{' && t[0] !== '[') return;
      const cle = p.replace(/\/+$/, '');
      if (vcCatVu[cle] === t.length) return;
      vcCatVu[cle] = t.length;
      post({ kind: 'vccatalogue', chemin: cle.slice(0, 160), body: t.slice(0, VC_CATALOGUE_MAX), coupe: t.length > VC_CATALOGUE_MAX });
    } catch (_) {}
  }
  function noteVentes(url, texte) {
    try {
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!DE_VC(url)) return;
      const ch = u.pathname;
      if (/current|cart|basket|purchase|bought|achat/i.test(ch)) return;
      const source = /\/users\/me\/awaiting-shipping-items\/?$/i.test(ch) ? 'a-expedier'
        : (/\/users\/me\/[\w-]*(sales|sold|transactions)[\w-]*\/?$/i.test(ch) || /\/sales\/?$/i.test(ch)) ? 'ventes' : '';
      if (!source) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      if (!obj || typeof obj !== 'object') return;
      const arr = tableauAnnonces(obj) || [];
      const offset = Number(u.searchParams.get('offset') || (obj.meta && obj.meta.offset) || 0) || 0;
      const total = obj.meta && typeof obj.meta.count === 'number' && sansFiltre(u) ? obj.meta.count : null;
      const ventes = arr.slice(0, 200).map((e) => {
        const prod = e.product && typeof e.product === 'object' ? e.product : (e.item && typeof e.item === 'object' ? e.item : null);
        const pid = prod && prod.id != null ? String(prod.id) : (e.productId != null ? String(e.productId) : (e.product_id != null ? String(e.product_id) : ''));
        const sc = scalairesVente(e);
        const cv = colisVente(e); const sv = suiviAchat(e);
        return { id: idDe(e), productId: /^[\w-]{1,40}$/.test(pid) ? pid : '', ref: refVente(e), etat: sc.etat, date: sc.date, montant: sc.montant, limite: cv.limite, etiquette: cv.etiquette, suivi: sv.suivi, transporteur: sv.transporteur };
      }).filter((x) => /^[\w-]{1,40}$/.test(x.id));
      // La FORME d'une vente (noms de clés et types, jamais une valeur) : pour viser juste ensuite.
      const forme = arr.length ? cheminsDeCles(arr[0]).map(sansId).filter((c) => !PAS_ACHETEUR.test(c.split(':')[0])).slice(0, 120) : [];
      post({ kind: 'vcventes', source, ventes, offset, total, lus: arr.length, forme });
    } catch (_) {}
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TES MESSAGES (27 octobre, 5.238)
  // ══════════════════════════════════════════════════════════════════════════
  // Julien : « fais pareil pour les messages Vestiaire ». Même méthode : ce que
  // la page charge DÉJÀ, aucune requête de plus (§3).
  //   · Le COMPTEUR (mesuré le 26 oct. : `notification-feed-counter/v2` →
  //     `data.unseen.messages`, un nombre) : le nombre de messages non lus.
  //   · Une LISTE de conversations (`…/conversations`, `…/messages`, `…/inbox`,
  //     `…/threads` — jamais vue d'ici : reconnue à son chemin), jamais le
  //     support (`zendesk`, `partners`) ni le fil des notifications.
  // De chaque conversation, des SCALAIRES seulement : son identifiant, celui de
  // l'article, la référence `VRM-{n°}` lue sur l'ARTICLE, « non lu » (une clé
  // dont le NOM le dit), une date. ⚠️ JAMAIS le texte d'un message, ni le nom,
  // le pseudo ou la photo de l'autre personne (PAS_ACHETEUR écarte `message`,
  // `user`, `member`, `buyer`…). Et la page où la liste a été vue (sans les
  // identifiants) : c'est elle que VRM ouvre, jamais une adresse devinée.
  const CLE_NON_LU = /^(unread|isUnread|is_unread|unreadCount|unread_count|unreadMessages|unreadMessagesCount|unseen|unseenCount|hasUnread|has_unread|read|isRead|is_read|seen|isSeen)$/i;
  function nonLuDe(e) {
    for (const k of Object.keys(e || {}).slice(0, 80)) {
      if (!CLE_NON_LU.test(k)) continue;
      const v = e[k]; const lu = /^(is_?)?(read|seen|isRead|isSeen)$/i.test(k);
      if (typeof v === 'boolean') return lu ? !v : v;
      if (typeof v === 'number' && isFinite(v)) return lu ? v === 0 : v > 0;
    }
    return null;   // aucune clé qui le dise : « pas su »
  }
  function noteCompteur(url, texte) {
    try {
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!DE_VC(url) || !/\/notification-feed-counter(\/v\d+)?\/?$/i.test(u.pathname)) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      const un = obj && obj.data && obj.data.unseen;
      if (!un || typeof un.messages !== 'number' || !isFinite(un.messages) || un.messages < 0) return;
      post({ kind: 'vccompteur', messages: Math.floor(un.messages) });
    } catch (_) {}
  }
  function noteMessages(url, texte) {
    try {
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!DE_VC(url)) return;
      const ch = u.pathname;
      if (/zendesk|partners|notification|support|help/i.test(ch)) return;
      if (!/\/(conversations?|messages|messaging|inbox|threads?|chats?)\/?$/i.test(ch)) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      if (!obj || typeof obj !== 'object') return;
      const arr = tableauAnnonces(obj) || [];
      const offset = Number(u.searchParams.get('offset') || (obj.meta && obj.meta.offset) || 0) || 0;
      const total = obj.meta && typeof obj.meta.count === 'number' && sansFiltre(u) ? obj.meta.count : null;
      const conversations = arr.slice(0, 200).map((e) => {
        const prod = e.product && typeof e.product === 'object' ? e.product : (e.item && typeof e.item === 'object' ? e.item : null);
        const pid = prod && prod.id != null ? String(prod.id) : (e.productId != null ? String(e.productId) : (e.product_id != null ? String(e.product_id) : ''));
        return { id: String(e.id != null ? e.id : '').slice(0, 40), productId: /^[\w-]{1,40}$/.test(pid) ? pid : '', ref: refVente(e), nonLu: nonLuDe(e), date: scalairesVente(e).date };
      }).filter((x) => /^[\w-]{1,40}$/.test(x.id));
      const forme = arr.length ? cheminsDeCles(arr[0]).map(sansId).filter((c) => !PAS_ACHETEUR.test(c.split(':')[0])).slice(0, 120) : [];
      post({ kind: 'vcmessages', conversations, offset, total, lus: arr.length, forme, page: normChemin(sansId(location.pathname)) });
    } catch (_) {}
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TES ACHATS (27 octobre, 5.239)
  // ══════════════════════════════════════════════════════════════════════════
  // Julien : « fais pareil pour les achats Vestiaire ». Ce que la page charge
  // DÉJÀ, aucune requête de plus (§3). Mesuré le 26 oct. : seul le panier en
  // cours (`orders/current-light`, 204) a été vu — JAMAIS lu ici (un panier
  // n'est pas un achat). La liste de tes achats (`users/me/…orders|purchases|
  // bought…`, `/purchases`) n'a jamais été vue d'ici : reconnue à son chemin.
  // De chaque achat, des SCALAIRES seulement : son identifiant, celui de
  // l'article, le NOM de l'article (pour que tu le reconnaisses — jamais un
  // rapprochement, §5), un état, une date, un montant avec le nom de sa clé, et
  // le n° de suivi du colis avec son transporteur. ⚠️ JAMAIS le vendeur, ton
  // adresse, ton email, un message (PAS_ACHETEUR + vendeur).
  const PAS_ACHAT = /seller|vendor|shop|store|address|recipient|email|phone|message|user|member|customer|buyer|contact|payment|card|iban/i;
  const CLE_SUIVI = /^(trackingNumber|tracking_number|trackingCode|tracking_code|parcelNumber|parcel_number|shipmentNumber)$/i;
  const CLE_TRANSP = /^(carrier|carrierName|carrier_name|shippingCarrier|transporter)$/i;
  function nomArticle(prod) {
    if (!prod || typeof prod !== 'object') return '';
    const b = prod.brand && typeof prod.brand === 'object' ? prod.brand.name : prod.brand;
    const t = typeof prod.name === 'string' ? prod.name : (typeof prod.title === 'string' ? prod.title : '');
    return [typeof b === 'string' ? b : '', t].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  function suiviAchat(e) {
    const out = { suivi: '', transporteur: '' };
    const visite = (x, prof) => {
      if (!x || typeof x !== 'object' || prof > 3) return;
      for (const k of Object.keys(x).slice(0, 80)) {
        const v = x[k];
        if (PAS_ACHAT.test(k)) continue;
        if (!out.suivi && CLE_SUIVI.test(k) && (typeof v === 'string' || typeof v === 'number') && /^[A-Z0-9]{6,40}$/i.test(String(v))) out.suivi = String(v).toUpperCase();
        if (!out.transporteur && CLE_TRANSP.test(k)) { const t = typeof v === 'string' ? v : (v && typeof v.name === 'string' ? v.name : ''); if (/^[\w .&'-]{1,30}$/.test(t)) out.transporteur = t; }
        if (v && typeof v === 'object' && !Array.isArray(v)) visite(v, prof + 1);
      }
    };
    visite(e, 0);
    return out;
  }
  function scalairesAchat(e) {
    // Les scalaires de la vente, mais sans jamais descendre chez le vendeur.
    const propre = {};
    for (const k of Object.keys(e || {}).slice(0, 80)) if (!PAS_ACHAT.test(k)) propre[k] = e[k];
    return scalairesVente(propre);
  }
  function noteAchats(url, texte) {
    try {
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!DE_VC(url)) return;
      const ch = u.pathname;
      if (/current|cart|basket|checkout|sales|sold|awaiting-shipping|selling/i.test(ch)) return;
      if (!(/\/users\/me\/[\w-]*(orders|purchases|bought|buyings?)[\w-]*\/?$/i.test(ch) || /\/purchases\/?$/i.test(ch))) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      if (!obj || typeof obj !== 'object') return;
      const arr = tableauAnnonces(obj) || [];
      const offset = Number(u.searchParams.get('offset') || (obj.meta && obj.meta.offset) || 0) || 0;
      const total = obj.meta && typeof obj.meta.count === 'number' && sansFiltre(u) ? obj.meta.count : null;
      const achats = arr.slice(0, 200).map((e) => {
        const prod = e.product && typeof e.product === 'object' ? e.product : (e.item && typeof e.item === 'object' ? e.item : null);
        const pid = prod && prod.id != null ? String(prod.id) : (e.productId != null ? String(e.productId) : (e.product_id != null ? String(e.product_id) : ''));
        const sc = scalairesAchat(e); const sv = suiviAchat(e);
        return { id: String(e.id != null ? e.id : '').slice(0, 40), productId: /^[\w-]{1,40}$/.test(pid) ? pid : '', nom: nomArticle(prod), etat: sc.etat, date: sc.date, montant: sc.montant, suivi: sv.suivi, transporteur: sv.transporteur };
      }).filter((x) => /^[\w-]{1,40}$/.test(x.id));
      const forme = arr.length ? cheminsDeCles(arr[0]).map(sansId).filter((c) => !PAS_ACHAT.test(c.split(':')[0])).slice(0, 120) : [];
      post({ kind: 'vcachats', achats, offset, total, lus: arr.length, forme, page: normChemin(sansId(location.pathname)) });
    } catch (_) {}
  }

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      const url = (typeof input === 'string') ? input : (input && input.url) || '';
      const meth = (init && init.method) || (typeof input === 'object' && input && input.method) || 'GET';
      const p = origFetch.apply(this, arguments);
      try {
        p.then((res) => {
          try {
            const ct = res.headers && res.headers.get && res.headers.get('content-type');
            noteVu(url, meth, res.status, ct);
            if (DE_VC(url) && /json/i.test(String(ct || ''))) res.clone().text().then((t) => { noteSchema(url, t); noteCatalogue(url, t); noteAnnonces(url, t); noteVentes(url, t); noteCompteur(url, t); noteMessages(url, t); noteAchats(url, t); notePublication(url, meth, res.status, t); }).catch(() => {});
          } catch (_) {}
        }).catch(() => {});
      } catch (_) {}
      return p;
    };
  }
  const OX = window.XMLHttpRequest;
  if (OX) {
    const origOpen = OX.prototype.open, origSend = OX.prototype.send;
    OX.prototype.open = function (method, url) { this.__vcUrl = url; this.__vcMeth = method; return origOpen.apply(this, arguments); };
    OX.prototype.send = function () {
      try {
        this.addEventListener('load', function () {
          try {
            const url = this.__vcUrl || '';
            const ct = this.getResponseHeader && this.getResponseHeader('content-type');
            noteVu(url, this.__vcMeth, this.status, ct);
            const t = (this.responseType === '' || this.responseType === 'text') ? this.responseText : null;
            if (t && /json/i.test(String(ct || ''))) { noteSchema(url, t); noteCatalogue(url, t); noteAnnonces(url, t); noteVentes(url, t); noteCompteur(url, t); noteMessages(url, t); noteAchats(url, t); notePublication(url, this.__vcMeth, this.status, t); }
          } catch (_) {}
        });
      } catch (_) {}
      return origSend.apply(this, arguments);
    };
  }
})();
