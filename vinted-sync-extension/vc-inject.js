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
  // 5.299 (1er nov.) — UN TEXTE COUPÉ NE COUPE JAMAIS UN ÉMOJI EN DEUX. `slice`
  // compte en unités UTF-16 : couper à 160 au milieu d'un émoji laisse une
  // moitié (« surrogate » seul) ; `JSON.stringify` l'écrit `\ud83d`, et la base
  // (jsonb de Postgres) REFUSE toute la ligne — un aperçu de message avec un
  // émoji à la mauvaise place empêchait d'enregistrer TOUTES les conversations.
  // On retire les moitiés orphelines et on coupe avant un émoji entamé.
  const bienForme = (x) => String(x == null ? '' : x).replace(/[\ud800-\udbff](?![\udc00-\udfff])|(^|[^\ud800-\udbff])[\udc00-\udfff]/g, '$1');
  const coupe = (x, n) => { let t = bienForme(x); if (t.length <= n) return t; t = t.slice(0, n); return /[\ud800-\udbff]$/.test(t) ? t.slice(0, -1) : t; };

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
  // 5.314 (2 nov.) — LA FORME RÉELLE DE « MES ARTICLES » (mesurée chez Julien,
  // noms de clés seulement) : chaque élément est une ENVELOPPE
  // `{ type: 'published', published: { product: { id, headline, subHeadline,
  // price: { cents, currency }, sellerEarnings, picturePath, path }, listingDate,
  // negotiationsSummary } }`. Sans id au premier niveau, la liste entière tombait
  // en « forme inconnue » : aucune annonce Vestiaire n'était lue. On DÉPLIE
  // l'enveloppe (son contenu, plus `status` = le type) ; une annonce prend
  // l'identifiant de SON produit. Rien d'autre n'est deviné.
  const enveloppe = (e) => (e && typeof e === 'object' && !Array.isArray(e) && e.id == null && e.productId == null && e.product_id == null
    && typeof e.type === 'string' && /^[\w-]{1,40}$/.test(e.type) && e[e.type] && typeof e[e.type] === 'object' && !Array.isArray(e[e.type])) ? e[e.type] : null;
  // 5.316 — LA PHOTO D'UN ARTICLE : Vestiaire n'écrit que le NOM du fichier
  // (« 73026101-1_3.jpg », `picturePath` / `imageUrl`) ; ses pages l'affichent
  // depuis https://images.vestiairecollective.com/produit/{nom} (adresse relevée
  // dans ses propres réponses). Un nom d'une autre forme ⇒ pas de photo.
  const photoVc = (nom) => (typeof nom === 'string' && /^\d{5,12}-\d{1,3}_\d{1,3}\.(jpe?g|png|webp)$/i.test(nom) ? 'https://images.vestiairecollective.com/produit/' + nom : '');
  function deplier(e) {
    const env = enveloppe(e);
    if (!env) return e;
    const out = Object.assign({}, env, { status: e.type });
    const p = env.product && typeof env.product === 'object' && !Array.isArray(env.product) ? env.product : null;
    if (out.id == null && p && p.id != null) out.productId = p.id;
    if (p && photoVc(p.picturePath)) out.picture = photoVc(p.picturePath);
    // Le titre affiché : « headline » et « subHeadline » de Vestiaire, mis bout à
    // bout (affichage seul, jamais une identité — §5).
    if (p && out.name == null && (typeof p.headline === 'string' || typeof p.subHeadline === 'string')) out.name = [p.headline, p.subHeadline].filter((x) => typeof x === 'string' && x.trim()).join(' ');
    return out;
  }
  function tableauAnnonces(obj) {
    const cands = [];
    const visite = (x, prof) => {
      if (!x || typeof x !== 'object' || prof > 3) return;
      if (Array.isArray(x)) { const d = x.map(deplier); if (d.length && d.every((e) => e && typeof e === 'object' && (e.id != null || e.productId != null || e.product_id != null))) cands.push(d); return; }
      for (const k of Object.keys(x)) visite(x[k], prof + 1);
    };
    visite(obj, 0);
    return cands.sort((a, b) => b.length - a.length)[0] || null;
  }
  // 5.295 — LES FAVORIS d'une annonce : un NOMBRE, lu sur une clé dont le nom le
  // dit (likes, favorites, wishlist…) ; une LISTE de personnes n'en donne que la
  // longueur (jamais qui). Aucune clé ⇒ `null` (« pas su »), jamais 0.
  const CLE_FAVORIS = /^(likes|likesCount|likes_count|likeCount|like_count|nbLikes|nb_likes|numberOfLikes|favorites|favoritesCount|favorites_count|favouritesCount|favourites_count|favourites|wishlistCount|wishlist_count|wishCount|wishes|followers|followersCount)$/i;
  function favorisDe(o) {
    let n = null, cle = '';
    const visite = (x, prof) => {
      if (n != null || !x || typeof x !== 'object' || Array.isArray(x) || prof > 2) return;
      for (const k of Object.keys(x).slice(0, 80)) {
        const v = x[k];
        if (CLE_FAVORIS.test(k)) {
          if (typeof v === 'number' && isFinite(v) && v >= 0) { n = Math.floor(v); cle = k; return; }
          if (Array.isArray(v)) { n = v.length; cle = k + '[]'; return; }
          if (v && typeof v === 'object' && typeof v.count === 'number') { n = Math.floor(v.count); cle = k + '.count'; return; }
        } else if (v && typeof v === 'object' && !Array.isArray(v)) visite(v, prof + 1);
      }
    };
    visite(o, 0);
    return { n, cle };
  }
  const idDe = (e) => String(e.id != null ? e.id : (e.productId != null ? e.productId : e.product_id)).slice(0, 40);
  // 5.296 (1er nov.) — LA FICHE D'UNE ANNONCE : Julien veut ses annonces Vestiaire
  // « en fiches comme Vinted ». La forme d'une annonce de `product-listings`
  // n'a JAMAIS été vue pleine chez lui : on ne lit que des clés dont le NOM dit
  // ce qu'elles portent, et rien d'autre (« pas su » ⇒ vide, jamais deviné) :
  //   · le TITRE (name/title…) — affichage seul, JAMAIS une identité (§5) ;
  //   · UNE photo : une adresse https d'un hôte vestiairecollective.com, sous une
  //     clé picture/photo/image… ;
  //   · le PRIX avec le nom de sa clé (comme une vente) ;
  //   · l'ÉTAT de l'annonce (status/state…) — un mot court recopié tel quel.
  //   Jamais rien sous une clé de personne (`PAS_ACHETEUR`).
  // Et la FORME de la première annonce (noms de clés et types, jamais une valeur)
  // pour viser juste ensuite.
  const CLE_TITRE = /^(name|title|productName|product_name|displayName|display_name)$/i;
  const CLE_PHOTO = /^(picture|pictures|photo|photos|image|images|thumbnail|thumbnails|cover|coverPicture|cover_picture|mainPicture|main_picture|path|url|src|large|medium|small)$/i;
  const CLE_PRIX = /^(price|prices|sellingPrice|selling_price|listingPrice|listing_price|salePrice|sale_price|amount)$/i;
  const CLE_STATUT_ANNONCE = /^(status|state|productStatus|product_status|listingStatus|listing_status|publicationStatus|publication_status)$/i;
  // 5.299 (1er nov.) — LA FICHE SE LIT DU PLUS PROCHE AU PLUS PROFOND, et jamais
  // chez le vendeur ni la marque. Avant, la lecture descendait dans le premier
  // objet rencontré : une annonce `{ brand: { name: 'Nike' }, name: 'Dunk Low' }`
  // prenait « Nike » pour titre (la clé `brand` venait avant), et
  // `{ seller: { picture: … }, pictures: [...] }` prenait l'AVATAR du vendeur
  // pour photo de l'annonce. ⇒ niveau par niveau (la clé de l'annonce elle-même
  // gagne), et rien sous une clé de vendeur, de marque, de profil ou de logo.
  const PAS_FICHE = /seller|vendor|owner|shop|store|brand|designer|avatar|profile|logo|badge|flag|icon/i;
  function photoAnnonce(e) {
    let out = '';
    const essai = (x) => {
      if (out || typeof x !== 'string') return;
      try { const u = new URL(x, location.origin); if (u.protocol === 'https:' && !u.username && !u.password && /(^|\.)vestiairecollective\.com$/i.test(u.hostname) && /\.(jpe?g|png|webp|avif)(\?|$)|\/(images?|pictures?|photos?)\//i.test(u.pathname)) out = u.href.slice(0, 400); } catch (_) {}
    };
    // Niveau par niveau : [valeur, profondeur, sous une clé de photo ?] ; les
    // chaînes d'un niveau passent avant tout ce qui est plus profond.
    let niveau = [[e, 0, false]];
    while (niveau.length && !out) {
      const suivant = [];
      for (const [x, prof, sousPhoto] of niveau) {
        if (out || x == null || prof > 4) continue;
        if (typeof x === 'string') { if (sousPhoto) essai(x); continue; }
        if (Array.isArray(x)) { for (const v of x.slice(0, 6)) suivant.push([v, prof + 1, sousPhoto]); continue; }
        if (typeof x !== 'object') continue;
        for (const k of Object.keys(x).slice(0, 80)) { if (PAS_ACHETEUR.test(k) || PAS_FICHE.test(k)) continue; suivant.push([x[k], prof + 1, sousPhoto || CLE_PHOTO.test(k)]); }
      }
      niveau = suivant;
    }
    return out;
  }
  function ficheAnnonce(e) {
    const out = { titre: '', prix: null, statut: '' };
    let niveau = [[e, '']];
    for (let prof = 0; prof <= 2 && niveau.length; prof++) {
      const suivant = [];
      for (const [x, chemin] of niveau) {
        if (!x || typeof x !== 'object' || Array.isArray(x)) continue;
        for (const k of Object.keys(x).slice(0, 80)) {
          const v = x[k];
          if (PAS_ACHETEUR.test(k) || PAS_FICHE.test(k)) continue;
          if (!out.titre && CLE_TITRE.test(k) && typeof v === 'string' && v.trim()) out.titre = coupe(v.replace(/\s+/g, ' ').trim(), 120);
          if (!out.statut && CLE_STATUT_ANNONCE.test(k) && (typeof v === 'string' || typeof v === 'number')) { const t = String(v); if (/^[\w .:-]{1,40}$/.test(t)) out.statut = t; }
          if (!out.prix && CLE_PRIX.test(k)) {
            if (typeof v === 'number' && isFinite(v)) out.prix = { valeur: v, devise: '', cle: chemin + k };
            else if (v && typeof v === 'object' && !Array.isArray(v)) {
              const n = typeof v.amount === 'number' ? v.amount : (typeof v.value === 'number' ? v.value : (typeof v.cents === 'number' ? v.cents / 100 : (typeof v.amount === 'string' && /^\d+([.,]\d+)?$/.test(v.amount) ? Number(v.amount.replace(',', '.')) : null)));
              const d = typeof v.currency === 'string' ? v.currency : (typeof v.currencyCode === 'string' ? v.currencyCode : '');
              if (n != null && isFinite(n)) out.prix = { valeur: n, devise: /^[A-Z]{3}$/.test(d) ? d : '', cle: chemin + k + (typeof v.cents === 'number' ? '.cents' : '') };
            }
          }
          if (v && typeof v === 'object' && !Array.isArray(v) && !CLE_PRIX.test(k)) suivant.push([v, chemin + k + '.']);
        }
      }
      niveau = suivant;
    }
    out.photo = photoAnnonce(e);
    return out;
  }
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
  // 5.299 (1er nov.) — « RIEN LU » NE VAUT PAS « LISTE VIDE ». Quand aucune
  // liste n'est trouvée dans la réponse, ce n'est une liste VIDE que si la
  // réponse a la forme connue d'une liste vide (`[]`, `{data: []}`, ou un total
  // de 0) ; sinon c'est un FORMAT INCONNU (champ renommé, autre API) : le fond
  // n'en tire rien — ni fraîcheur, ni « aucune annonce » — et garde sa forme.
  const listeConnue = (obj, arr) => arr.length > 0 || (Array.isArray(obj) && obj.length === 0) || (obj && Array.isArray(obj.data) && obj.data.length === 0) || !!(obj && obj.meta && obj.meta.count === 0);
  const formeInconnue = (obj) => cheminsDeCles(obj).map(sansId).filter((c) => !PAS_ACHETEUR.test(c.split(':')[0])).slice(0, 60);
  // 5.299 — UNE LISTE EN PLUSIEURS PAGES. Seule la page 0 qui rend tout faisait
  // foi : au-delà d'une page (plus de 20, 48… annonces), la liste n'était jamais
  // ENTIÈRE, et une annonce vendue ou supprimée restait « en ligne » pour
  // toujours. La règle de la liste complète Leboncoin (22 oct.) : les pages lues
  // dans CE document, à la MÊME requête (hors pagination), au MÊME total, sur le
  // MÊME compte, en moins de 3 minutes, dont les identifiants DISTINCTS
  // atteignent le total ⇒ la liste est entière (on envoie ses identifiants) ;
  // un total qui change repart de zéro ; plus d'identifiants que le total ⇒
  // incohérent, rien ne décide. En mémoire de la page seulement.
  const PARAMS_PAGE = /^(offset|limit|page|per_?page|pagesize|page_?size|_|t|ts)$/i;
  const lots = new Map();
  function lotComplet(famille, u, total, ids) {
    if (typeof total !== 'number' || !(total > 0) || total > 2000) return null;
    const req = [...u.searchParams.entries()].filter(([k]) => !PARAMS_PAGE.test(k)).map(([k, v]) => k + '=' + v).sort().join('&');
    const tete = famille + '|' + u.hostname + u.pathname + '|';
    const cle = tete + req + '|' + total + '|' + moiId;
    for (const k of [...lots.keys()]) if (k.startsWith(tete) && k !== cle) lots.delete(k);
    let l = lots.get(cle);
    if (!l || Date.now() - l.t0 > 180000) { l = { ids: new Set(), t0: Date.now() }; lots.set(cle, l); }
    for (const id of ids) l.ids.add(String(id));
    if (l.ids.size > total) { lots.delete(cle); return null; }
    return l.ids.size === total ? [...l.ids] : null;
  }
  function noteAnnonces(url, texte) {
    try {
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!DE_VC(url) || !/\/users\/me\/product-listings\/?$/i.test(u.pathname)) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      if (!obj || typeof obj !== 'object') return;
      const arr = tableauAnnonces(obj) || [];
      const offset = Number(u.searchParams.get('offset') || (obj.meta && obj.meta.offset) || 0) || 0;
      const total = obj.meta && typeof obj.meta.count === 'number' && sansFiltre(u) ? obj.meta.count : null;
      const items = arr.slice(0, 200).map((e) => { const b = boostDe(e); const f = favorisDe(e); const fi = ficheAnnonce(e); return { id: idDe(e), boost: b.boost, cles: b.cles, ref: refDe(e), favoris: f.n, cleFavoris: f.cle, titre: fi.titre, photo: fi.photo, prix: fi.prix, statut: fi.statut }; }).filter((x) => /^[\w-]{1,40}$/.test(x.id));
      const forme = arr.length ? cheminsDeCles(arr[0]).map(sansId).filter((c) => !PAS_ACHETEUR.test(c.split(':')[0])).slice(0, 120) : [];
      if (!listeConnue(obj, arr)) { post({ kind: 'vcannonces', items: [], offset, total: null, lus: 0, forme: [], inconnu: formeInconnue(obj), moi: moiId }); return; }
      post({ kind: 'vcannonces', items, offset, total, lus: arr.length, forme, complet: lotComplet('annonces', u, total, items.map((x) => x.id)), moi: moiId });
      retenirPrixVus(url, items);
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
  // 5.316 — CE QUE VESTIAIRE TE VERSE : `sellerEarning` (« 203,23 € », une
  // chaîne mise en forme) — mesuré sur ta vente du 2 nov. Lu seulement s'il est
  // écrit en euros, au centime.
  const eurosEcrits = (t) => { const m = /^\s*(\d{1,3}(?:[\s\u00a0\u202f.]?\d{3})*|\d+)(?:,(\d{2}))?\s*€\s*$/.exec(String(t || '')); return m ? Number(m[1].replace(/[\s\u00a0\u202f.]/g, '')) + (m[2] ? Number(m[2]) / 100 : 0) : null; };
  function scalairesVente(e) {
    const out = { etat: '', date: '', montant: null, prixVente: null };
    if (e && typeof e.sellerEarning === 'string' && eurosEcrits(e.sellerEarning) != null) out.montant = { valeur: eurosEcrits(e.sellerEarning), devise: 'EUR', cle: 'sellerEarning' };
    // 5.340 — LE PRIX DE VENTE de l'article (`sellerPrice`, une chaîne à côté de
    // `sellerEarning`, mesurée dans `vc_ventes.forme` le 10 nov.) : pour la facture
    // Pro. Lu SEULEMENT s'il est écrit en euros au centime ; sinon rien (jamais deviné).
    if (e && typeof e.sellerPrice === 'string') { const pv = eurosEcrits(e.sellerPrice); if (pv != null && pv > 0) out.prixVente = { valeur: pv, devise: 'EUR', cle: 'sellerPrice' }; }
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
  // 5.316 — LE SUIVI D'UNE VENTE (`/contents/timeline/seller?product=…`, la page
  // « Mes ventes » d'un article) : le transporteur choisi, le n° de suivi, le
  // BORDEREAU (un PDF déposé par Vestiaire, adresse signée et datée), la date
  // limite d'envoi, l'étape et la date de paiement estimée. Rien de l'acheteur.
  function noteTimeline(url, texte) {
    try {
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!DE_VC(url) || !/\/contents\/timeline\/seller\/?$/i.test(u.pathname)) return;
      const pid = String(u.searchParams.get('product') || '');
      if (!/^\d{3,15}$/.test(pid)) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      const d = obj && obj.data && typeof obj.data === 'object' ? obj.data : null;
      if (!d) return;
      const st = d.steps && typeof d.steps === 'object' ? d.steps : {};
      const exp = st.sellerShipment && st.sellerShipment.shipmentDetails && typeof st.sellerShipment.shipmentDetails === 'object' ? st.sellerShipment.shipmentDetails : {};
      const lab = typeof exp.shippingLabelUrl === 'string' ? exp.shippingLabelUrl : (typeof exp.labelUrl === 'string' ? exp.labelUrl : '');
      let bordereau = '';
      try { const b = new URL(lab); if (b.protocol === 'https:' && /(^|\.)amazonaws\.com$/i.test(b.hostname) && /\.pdf$/i.test(b.pathname)) bordereau = b.href.slice(0, 2000); } catch (_) {}
      const etapes = Object.keys(st).filter((k) => st[k] && typeof st[k] === 'object' && typeof st[k].status === 'string').reduce((o, k) => { o[k] = st[k].status.slice(0, 20); return o; }, {});
      post({ kind: 'vctimeline', productId: pid,
        transporteur: exp.chosenCarrier && typeof exp.chosenCarrier.carrierName === 'string' ? exp.chosenCarrier.carrierName.slice(0, 40) : '',
        suivi: typeof exp.trackingNumber === 'string' && /^[A-Z0-9]{6,40}$/i.test(exp.trackingNumber) ? exp.trackingNumber : '',
        bordereau, typeBordereau: typeof exp.labelType === 'string' ? exp.labelType.slice(0, 30) : '',
        statut: typeof d.status === 'string' ? d.status.slice(0, 40) : '', etapes,
        paiementEstime: d.header && typeof d.header.date === 'string' ? d.header.date.slice(0, 40) : '', moi: moiId });
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
        const fi = ficheAnnonce(e);
        const titre = [typeof e.brandName === 'string' ? e.brandName.trim() : '', fi.titre].filter(Boolean).join(' ').slice(0, 140);
        return { id: idDe(e), productId: /^[\w-]{1,40}$/.test(pid) ? pid : '', ref: refVente(e), etat: sc.etat, date: sc.date, montant: sc.montant, ...(sc.prixVente ? { prixVente: sc.prixVente } : {}), limite: cv.limite, etiquette: cv.etiquette, suivi: sv.suivi, transporteur: sv.transporteur, titre, photo: photoVc(e.imageUrl) || photoAnnonce(e) };
      }).filter((x) => /^[\w-]{1,40}$/.test(x.id));
      // La FORME d'une vente (noms de clés et types, jamais une valeur) : pour viser juste ensuite.
      const forme = arr.length ? cheminsDeCles(arr[0]).map(sansId).filter((c) => !PAS_ACHETEUR.test(c.split(':')[0])).slice(0, 120) : [];
      if (!listeConnue(obj, arr)) { post({ kind: 'vcventes', source, ventes: [], offset, total: null, lus: 0, forme: [], inconnu: formeInconnue(obj), moi: moiId }); return; }
      post({ kind: 'vcventes', source, ventes, offset, total, lus: arr.length, forme, complet: lotComplet('ventes-' + source, u, total, ventes.map((x) => x.id)), moi: moiId });
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
      post({ kind: 'vccompteur', messages: Math.floor(un.messages), moi: moiId });
    } catch (_) {}
  }
  function noteMessages(url, texte) {
    try {
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!DE_VC(url)) return;
      const ch = u.pathname;
      if (/zendesk|partners|notification|support|help/i.test(ch)) return;
      if (!/\/(conversations?|messages|messaging|inbox|threads?|chats?)\/?$/i.test(ch)) return;
      // 5.295 : `…/conversations/{id}/messages` est UN fil (`noteFil`), pas la liste.
      if (/\/(?:conversations?|threads?|chats?)\/[\w-]*\d[\w-]*\/messages\/?$/i.test(ch)) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      if (!obj || typeof obj !== 'object') return;
      const arr = tableauAnnonces(obj) || [];
      const offset = Number(u.searchParams.get('offset') || (obj.meta && obj.meta.offset) || 0) || 0;
      const total = obj.meta && typeof obj.meta.count === 'number' && sansFiltre(u) ? obj.meta.count : null;
      const conversations = arr.slice(0, 200).map((e) => {
        const prod = e.product && typeof e.product === 'object' ? e.product : (e.item && typeof e.item === 'object' ? e.item : null);
        const pid = prod && prod.id != null ? String(prod.id) : (e.productId != null ? String(e.productId) : (e.product_id != null ? String(e.product_id) : ''));
        // 5.295 : l'aperçu du dernier message (son TEXTE seulement, jamais son auteur nommé).
        const ap = apercuConv(e);
        return { id: String(e.id != null ? e.id : '').slice(0, 40), productId: /^[\w-]{1,40}$/.test(pid) ? pid : '', ref: refVente(e), nonLu: nonLuDe(e), date: scalairesVente(e).date, apercu: ap ? ap.t : '', apercuDeMoi: ap ? ap.deMoi : null };
      }).filter((x) => /^[\w-]{1,40}$/.test(x.id));
      for (const c of conversations) if (ID_CONV.test(c.id)) convsVues.add(c.id);
      const forme = arr.length ? cheminsDeCles(arr[0]).map(sansId).filter((c) => !PAS_ACHETEUR.test(c.split(':')[0])).slice(0, 120) : [];
      if (!listeConnue(obj, arr)) { post({ kind: 'vcmessages', conversations: [], offset, total: null, lus: 0, forme: [], inconnu: formeInconnue(obj), page: normChemin(sansId(location.pathname)), moi: moiId }); return; }
      post({ kind: 'vcmessages', conversations, offset, total, lus: arr.length, forme, complet: lotComplet('messages', u, total, conversations.map((x) => x.id)), page: normChemin(sansId(location.pathname)), moi: moiId });
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
    return coupe([typeof b === 'string' ? b : '', t].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(), 80);
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
      if (!listeConnue(obj, arr)) { post({ kind: 'vcachats', achats: [], offset, total: null, lus: 0, forme: [], inconnu: formeInconnue(obj), page: normChemin(sansId(location.pathname)), moi: moiId }); return; }
      post({ kind: 'vcachats', achats, offset, total, lus: arr.length, forme, page: normChemin(sansId(location.pathname)), moi: moiId });
    } catch (_) {}
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LE COMPTE OUVERT, TES CONVERSATIONS EN CLAIR, ET RÉPONDRE SUR SON CLIC
  // (31 octobre, 5.295)
  // ══════════════════════════════════════════════════════════════════════════
  // Julien : « au moins pouvoir lire les messages et écrire aux personnes, sans
  // forcément automatiser ». Toujours la même méthode : ce que la page charge
  // DÉJÀ, aucune requête de plus (§3). ⚠️ Aucune de ces réponses n'a jamais été
  // vue d'ici (seuls `notification-feed-counter/v2`, `users/me/product-listings`,
  // `users/me/awaiting-shipping-items`, `orders/current-light`, `deposit/*` et
  // le support `partners/zendesk/conversations` l'ont été) : chacune est
  // reconnue à son CHEMIN et à des noms de clés qui disent ce qu'ils portent ;
  // autre chose ⇒ rien (« pas su »), et sa FORME (clés + types) part avec pour
  // viser juste ensuite.
  //   · LE COMPTE (`/users/me`) : son identifiant seulement — `data.id` (la
  //     forme des réponses de l'API v2, `{meta, data}`) ou `id` à la racine.
  //     Il dit QUEL compte Vestiaire est ouvert dans CET onglet (le fond le
  //     tient par onglet) et qui a écrit un message (`deMoi`).
  //   · UN FIL (`…/conversations/{id}` ou `…/conversations/{id}/messages`) : le
  //     TEXTE des messages (une clé body/text/content/message), leur date, et
  //     s'ils sont DE TOI (une clé booléenne qui le dit, ou l'auteur = le
  //     compte ouvert ; sinon `null`). ⚠️ JAMAIS le nom, le pseudo, la photo
  //     ni l'adresse de l'autre personne.
  //   · LA LISTE (5.238, `noteMessages`) gagne l'aperçu du dernier message.
  //   · RÉPONDRE : rien ne part à l'aveugle. L'adresse et la forme du corps
  //     s'APPRENNENT quand TU envoies un message toi-même sur la page (une
  //     écriture 2xx sur un chemin de conversation) : la « recette » garde la
  //     méthode, l'hôte, le chemin avec l'identifiant de la conversation remis
  //     en `{conv}`, la clé du texte, les autres clés et leurs valeurs SI ce
  //     sont des mots (`"type": "message"`), et les NOMS des en-têtes — jamais
  //     une valeur d'en-tête, jamais ton texte. Une recette qui demanderait de
  //     deviner (deux identifiants, une valeur inconnue, une conversation jamais
  //     vue dans cet onglet) est notée « pas rejouable », avec sa raison.
  //     VRM ne la rejoue que sur TON clic, depuis cet onglet, avec les en-têtes
  //     que la page elle-même vient d'envoyer (gardés en MÉMOIRE ici, jamais
  //     transmis) — exactement la requête qu'aurait faite la page.
  let moiId = '';
  const convsVues = new Set();
  let entetesApi = null;
  const ID_CONV = /^(?=[\w-]*\d)[\w-]{3,40}$/;
  const PAS_FIL = /zendesk|partners|notification|support|help|report|block|signal/i;
  function noteMoi(url, texte) {
    try {
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!DE_VC(url) || !/^\/(?:v\d+\/)?users\/me\/?$/i.test(u.pathname)) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
      const d = obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data) ? obj.data : null;
      if (d && d.type != null && !/user|member|account|profile/i.test(String(d.type))) return;
      const brut = d ? d.id : obj.id;
      if (!(typeof brut === 'string' || typeof brut === 'number')) return;
      const id = String(brut);
      if (!/^[\w-]{1,40}$/.test(id)) return;
      moiId = id; moiSource = 'users/me';
      post({ kind: 'vcmoi', id, forme: cheminsDeCles(obj).map(sansId).slice(0, 80) });
    } catch (_) {}
  }
  const CLE_TEXTE_MSG = /^(body|text|content|message|messageText|message_text|msg)$/i;
  const CLE_MOI_MSG = /^(isMine|is_mine|mine|fromMe|from_me|isOwn|is_own|own|sentByMe|sent_by_me|isSender|is_sender|outgoing|isOutgoing|is_outgoing)$/i;
  const CLE_AUTEUR_ID = /^(senderId|sender_id|authorId|author_id|fromId|from_id|userId|user_id|ownerId|owner_id)$/i;
  const CLE_AUTEUR = /^(sender|author|from|user|owner|createdBy|created_by)$/i;
  const CLE_DATE_MSG = /^(createdAt|created_at|sentAt|sent_at|date|timestamp|time|updatedAt|updated_at)$/i;
  const propreTexte = (s, max) => coupe(String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, ' ').replace(/[ \t]+/g, ' ').trim(), max || 2000);
  function texteMsg(e, prof) {
    if (!e || typeof e !== 'object' || Array.isArray(e) || (prof || 0) > 1) return '';
    for (const k of Object.keys(e).slice(0, 60)) {
      if (!CLE_TEXTE_MSG.test(k)) continue;
      const v = e[k];
      if (typeof v === 'string' && v.trim()) return propreTexte(v);
      if (v && typeof v === 'object') { const t = texteMsg(v, (prof || 0) + 1); if (t) return t; }
    }
    return '';
  }
  function deMoiMsg(e) {
    for (const k of Object.keys(e || {}).slice(0, 60)) {
      if (CLE_MOI_MSG.test(k) && typeof e[k] === 'boolean') return e[k];
      if (/^direction$/i.test(k) && typeof e[k] === 'string') { if (/^(out|outgoing|sent)$/i.test(e[k])) return true; if (/^(in|incoming|received)$/i.test(e[k])) return false; }
    }
    if (!moiId) return null;
    let auteur = null;
    for (const k of Object.keys(e || {}).slice(0, 60)) {
      const v = e[k];
      if (CLE_AUTEUR_ID.test(k) && (typeof v === 'string' || typeof v === 'number')) { auteur = String(v); break; }
      if (CLE_AUTEUR.test(k) && v && typeof v === 'object' && (typeof v.id === 'string' || typeof v.id === 'number')) { auteur = String(v.id); break; }
    }
    return auteur == null ? null : auteur === moiId;
  }
  function dateMsg(e) {
    for (const k of Object.keys(e || {}).slice(0, 60)) {
      if (!CLE_DATE_MSG.test(k)) continue;
      const v = e[k];
      if (typeof v === 'string' && /\d{4}-\d{2}-\d{2}/.test(v) && isFinite(Date.parse(v))) return new Date(Date.parse(v)).toISOString();
      if (typeof v === 'number' && v > 1.5e9) { const ms = v < 1e12 ? v * 1000 : v; if (ms < Date.now() + 86400000) return new Date(ms).toISOString(); }
    }
    return '';
  }
  function tableauMessages(obj) {
    const cands = [];
    const visite = (x, prof) => {
      if (!x || typeof x !== 'object' || prof > 4) return;
      if (Array.isArray(x)) { const n = x.filter((e) => texteMsg(e)).length; if (n) cands.push([n, x]); for (const e of x.slice(0, 5)) visite(e, prof + 1); return; }
      for (const k of Object.keys(x).slice(0, 60)) visite(x[k], prof + 1);
    };
    visite(obj, 0);
    return (cands.sort((a, b) => b[0] - a[0])[0] || [0, null])[1];
  }
  function noteFil(url, texte) {
    try {
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!DE_VC(url) || PAS_FIL.test(u.pathname)) return;
      const m = /\/(?:conversations?|threads?|chats?)\/([\w-]{3,40})(?:\/messages)?\/?$/i.exec(u.pathname);
      if (!m || !ID_CONV.test(m[1])) return;
      const conv = m[1];
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      if (!obj || typeof obj !== 'object') return;
      const arr = tableauMessages(obj) || [];
      const messages = arr.slice(0, 200).map((e) => {
        const id = e && (typeof e.id === 'string' || typeof e.id === 'number') && /^[\w-]{1,40}$/.test(String(e.id)) ? String(e.id) : '';
        return { id, t: texteMsg(e), deMoi: deMoiMsg(e), at: dateMsg(e) };
      }).filter((x) => x.t);
      const racine = obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data) ? obj.data : obj;
      const prod = racine.product && typeof racine.product === 'object' ? racine.product : (racine.item && typeof racine.item === 'object' ? racine.item : null);
      const pid = prod && prod.id != null ? String(prod.id) : (racine.productId != null ? String(racine.productId) : '');
      convsVues.add(conv);
      const forme = arr.length ? cheminsDeCles(arr[0]).map(sansId).filter((c) => !/name|pseudo|avatar|picture|photo|email|phone|address/i.test(c.split(':')[0])).slice(0, 80) : [];
      post({ kind: 'vcfil', conv, productId: /^[\w-]{1,40}$/.test(pid) ? pid : '', ref: refVente(racine), messages, lus: arr.length, forme, moi: moiId, page: normChemin(sansId(location.pathname)) });
    } catch (_) {}
  }
  const CLE_APERCU = /^(lastMessage|last_message|latestMessage|latest_message|preview|lastMessagePreview|last_message_preview|snippet)$/i;
  function apercuConv(e) {
    for (const k of Object.keys(e || {}).slice(0, 80)) {
      if (!CLE_APERCU.test(k)) continue;
      const v = e[k];
      if (typeof v === 'string' && v.trim()) return { t: propreTexte(v, 160), deMoi: null };
      if (v && typeof v === 'object' && !Array.isArray(v)) { const t = texteMsg(v); if (t) return { t: coupe(t, 160), deMoi: deMoiMsg(v) }; }
    }
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5.317 (3 nov.) — LA MESSAGERIE VESTIAIRE PASSE PAR « STREAM »
  // ══════════════════════════════════════════════════════════════════════════
  // Julien (3 nov., 10 h 02) : « les messages Vestiaire ne marchent pas, ils ne
  // sont pas captés, même avec la dernière extension ». MESURÉ dans ce que la
  // 5.315/5.316 a gardé chez lui (noms de clés et hôtes, lecture seule) :
  //   · la page `/chat/` charge `apiv2…/chat/user/token` ⇒ `{ userToken: {
  //     provider: 'stream' } }` puis `POST apiv2…/chat/channel/` ⇒ `{ id:
  //     '{acheteur}-{article}', type: 'chat_channel', product: '{article}' }` ;
  //   · les conversations et leurs messages viennent ENSUITE d'un autre hôte,
  //     `chat.stream-chat.com` (relevé 14 fois dans `vc_recon.hotes`) — un
  //     service de messagerie (Stream Chat) que la page appelle elle-même ;
  //   · `vc-inject` ne lisait QUE les réponses de vestiairecollective.com : aucune
  //     conversation, aucun fil n'a jamais été rangé (`vc_fil_*` : 0 ligne) ;
  //   · la seule LISTE sur vestiairecollective.com est le fil des notifications
  //     `notification-feed?category=messages` (une carte par conversation :
  //     `productLink.meta.data.id` = la conversation, `lastChatMessage`,
  //     `date`, `status`, `senderId`, `productTitle`, `productPicture`) — que
  //     `noteMessages` écartait exprès (« jamais le fil des notifications »).
  // ⇒ On lit, toujours SANS aucune requête de plus (ce que la page charge déjà) :
  //   · les réponses REST de Stream que la page reçoit (`POST /channels` = la
  //     liste, `POST /channels/{type}/{id}/query` = une conversation ouverte,
  //     `POST …/message` = un message que TU viens d'envoyer) : par conversation
  //     son identifiant, l'article, « non lu » (la ligne `read` du compte
  //     ouvert), et ses messages (texte, date, « de toi ») — JAMAIS un nom, un
  //     pseudo ni une photo de personne ;
  //   · le compte ouvert : Stream reçoit `user_id` dans l'adresse de CHAQUE
  //     requête de la page (le compte pour lequel Vestiaire a délivré le jeton) —
  //     seulement s'il a la forme d'un identifiant Vestiaire (des chiffres), et
  //     jamais à la place d'un `/users/me` lu dans ce document ;
  //   · le fil des notifications « messages » : une conversation par carte, le
  //     titre et la photo de l'ARTICLE (jamais ceux de la personne).
  // Aucune permission ajoutée : c'est la page qui parle à Stream, on regarde ses
  // réponses ; le fond de l'extension n'appelle jamais Stream.
  const DE_STREAM = (url) => { try { const u = new URL(url, location.origin); return u.protocol === 'https:' && /(^|\.)(stream-chat\.com|stream-io-api\.com)$/i.test(u.hostname); } catch (_) { return false; } };
  let moiSource = '';
  function noteMoiStream(url) {
    try {
      if (!DE_STREAM(url)) return;
      const id = new URL(url, location.origin).searchParams.get('user_id') || '';
      if (!/^\d{3,15}$/.test(id)) return;
      if (moiId && moiSource !== 'stream') return;   // `/users/me` lu dans ce document fait foi
      if (moiId === id) return;
      moiId = id; moiSource = 'stream';
      post({ kind: 'vcmoi', id, source: 'stream', forme: [] });
    } catch (_) {}
  }
  const CANAL_ARTICLE = /^\d{3,15}-(\d{3,15})$/;    // mesuré : « {acheteur}-{article} »
  const idCanal = (ch) => {
    if (!ch || typeof ch !== 'object') return '';
    const id = typeof ch.id === 'string' || typeof ch.id === 'number' ? String(ch.id) : (typeof ch.cid === 'string' ? ch.cid.split(':').pop() : '');
    return ID_CONV.test(id) ? id : '';
  };
  const articleCanal = (ch, conv) => {
    for (const k of ['product', 'productId', 'product_id']) {
      const v = ch && ch[k];
      if ((typeof v === 'string' || typeof v === 'number') && /^\d{3,15}$/.test(String(v))) return String(v);
      if (v && typeof v === 'object' && (typeof v.id === 'string' || typeof v.id === 'number') && /^\d{3,15}$/.test(String(v.id))) return String(v.id);
    }
    const m = CANAL_ARTICLE.exec(conv || ''); return m ? m[1] : '';
  };
  const SANS_PERSONNE = /name|pseudo|avatar|image|picture|photo|email|phone|address|bio|language|country|city/i;
  // Un message Stream : son texte (`text`), sa date, son auteur comparé au compte
  // ouvert. Un message supprimé ou sans texte (photo seule) ne passe pas.
  function messageStream(e) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
    if (e.type === 'deleted' || e.deleted_at) return null;
    const t = typeof e.text === 'string' && e.text.trim() ? propreTexte(e.text) : '';
    if (!t) return null;
    const id = (typeof e.id === 'string' || typeof e.id === 'number') && /^[\w-]{1,40}$/.test(String(e.id)) ? String(e.id) : '';
    const auteur = e.user && typeof e.user === 'object' && (typeof e.user.id === 'string' || typeof e.user.id === 'number') ? String(e.user.id) : (typeof e.user_id === 'string' ? e.user_id : '');
    return { id, t, deMoi: moiId && auteur ? auteur === moiId : null, at: dateMsg(e) };
  }
  // « Non lu » : la ligne `read` du COMPTE OUVERT (`unread_messages`) ; compte
  // pas su, ou aucune ligne ⇒ `null` (pas su), jamais « lu ».
  function nonLuStream(etat) {
    if (!moiId || !etat || !Array.isArray(etat.read)) return null;
    for (const r of etat.read.slice(0, 50)) {
      const u = r && r.user && (typeof r.user.id === 'string' || typeof r.user.id === 'number') ? String(r.user.id) : (r && typeof r.user_id === 'string' ? r.user_id : '');
      if (u !== moiId) continue;
      const n = r.unread_messages;
      return typeof n === 'number' && isFinite(n) ? n > 0 : null;
    }
    return null;
  }
  function etatCanalStream(etat) {
    if (!etat || typeof etat !== 'object' || Array.isArray(etat) || !etat.channel || typeof etat.channel !== 'object') return null;
    const conv = idCanal(etat.channel);
    if (!conv) return null;
    const messages = Array.isArray(etat.messages) ? etat.messages.slice(-200).map(messageStream).filter(Boolean) : null;
    const dernier = messages && messages.length ? messages[messages.length - 1] : null;
    const ch = etat.channel;
    const date = dernier && dernier.at ? dernier.at : dateMsg({ date: ch.last_message_at || ch.updated_at || '' });
    return { conv, productId: articleCanal(ch, conv), nonLu: nonLuStream(etat), date, apercu: dernier ? coupe(dernier.t, 160) : '', apercuDeMoi: dernier ? dernier.deMoi : null, messages };
  }
  const formeStream = (x) => cheminsDeCles(x).map(sansId).filter((c) => !SANS_PERSONNE.test(c.split(':')[0])).slice(0, 80);
  const pageIci = () => normChemin(sansId(location.pathname));
  function postConvsStream(etats, lus, forme) {
    const conversations = etats.map((s) => ({ id: s.conv, productId: s.productId, ref: '', nonLu: s.nonLu, date: s.date, apercu: s.apercu, apercuDeMoi: s.apercuDeMoi, source: 'stream' }));
    for (const s of etats) convsVues.add(s.conv);
    // Jamais « la liste entière » : la page ne demande que les conversations récentes.
    post({ kind: 'vcmessages', conversations, offset: 0, total: null, lus, forme, page: pageIci(), moi: moiId });
    for (const s of etats) if (s.messages) post({ kind: 'vcfil', conv: s.conv, productId: s.productId, ref: '', messages: s.messages, lus: s.messages.length, forme: [], moi: moiId, page: pageIci() });
  }
  function noteStream(url, methode, statut, texte) {
    try {
      if (!DE_STREAM(url) || !(statut >= 200 && statut < 300)) return;
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      const p = u.pathname.replace(/\/+$/, '');
      const liste = /^\/channels$/i.test(p);
      const une = /^\/channels\/[\w-]{1,40}\/[\w-]{3,64}\/query$/i.test(p);
      const envoi = /^\/channels\/[\w-]{1,40}\/([\w-]{3,64})\/message$/i.exec(p);
      if (!liste && !une && !envoi) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
      if (envoi) {
        const conv = ID_CONV.test(envoi[1]) ? envoi[1] : '';
        const m = messageStream(obj.message);
        if (conv && m && convsVues.has(conv)) post({ kind: 'vcfil', conv, productId: '', ref: '', messages: [m], lus: 1, forme: [], moi: moiId, page: pageIci() });
        return;
      }
      if (liste) {
        // « rien lu » ≠ « liste vide » : `{channels: []}` est une liste vide, autre chose une forme inconnue.
        if (!Array.isArray(obj.channels)) { post({ kind: 'vcmessages', conversations: [], offset: 0, total: null, lus: 0, forme: [], inconnu: formeStream(obj), page: pageIci(), moi: moiId }); return; }
        const etats = obj.channels.slice(0, 200).map(etatCanalStream).filter(Boolean);
        if (obj.channels.length && !etats.length) { post({ kind: 'vcmessages', conversations: [], offset: 0, total: null, lus: 0, forme: [], inconnu: formeStream(obj.channels[0]), page: pageIci(), moi: moiId }); return; }
        postConvsStream(etats, obj.channels.length, obj.channels.length ? formeStream(obj.channels[0]) : []);
        return;
      }
      const s = etatCanalStream(obj);
      if (!s) { post({ kind: 'vcmessages', conversations: [], offset: 0, total: null, lus: 0, forme: [], inconnu: formeStream(obj), page: pageIci(), moi: moiId }); return; }
      postConvsStream([s], 1, formeStream(obj));
    } catch (_) {}
  }
  // Le fil des notifications « messages » de Vestiaire : une carte par
  // conversation (mesuré). Seules les cartes dont le lien dit `type: 'chat'`.
  const photoProduitVc = (p) => { try { const u = new URL(p && typeof p === 'object' ? String(p.url || '') : ''); return u.protocol === 'https:' && u.hostname === 'images.vestiairecollective.com' && /^\/produit\/[\w.-]{1,60}$/.test(u.pathname) ? u.href : ''; } catch (_) { return ''; } };
  function noteFluxMessages(url, texte) {
    try {
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!DE_VC(url) || !/\/notification-feed(\/v\d+)?\/?$/i.test(u.pathname)) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      if (!obj || !Array.isArray(obj.data)) return;
      const par = new Map();
      for (const e of obj.data.slice(0, 200)) {
        const lien = e && e.productLink && e.productLink.meta;
        if (!lien || lien.type !== 'chat' || !lien.data) continue;
        const conv = String(lien.data.id == null ? '' : lien.data.id);
        if (!ID_CONV.test(conv)) continue;
        const date = dateMsg({ date: e.date });
        const prec = par.get(conv);
        if (prec && prec.date >= date) continue;
        const auteur = typeof e.senderId === 'string' || typeof e.senderId === 'number' ? String(e.senderId) : '';
        const deMoi = moiId && auteur ? auteur === moiId : null;
        // « lu » : la carte est lue (`status: 'read'`) ou c'est TON message ; un autre mot ⇒ pas su.
        const nonLu = deMoi === true || e.status === 'read' ? false : null;
        const ap = typeof e.lastChatMessage === 'string' && e.lastChatMessage.trim() ? propreTexte(e.lastChatMessage, 160) : '';
        const m = CANAL_ARTICLE.exec(conv);
        par.set(conv, { id: conv, productId: m ? m[1] : '', ref: '', nonLu, date, apercu: ap, apercuDeMoi: ap ? deMoi : null,
          titre: typeof e.productTitle === 'string' ? coupe(e.productTitle.replace(/\s+/g, ' ').trim(), 120) : '', photo: photoProduitVc(e.productPicture), source: 'notifications' });
      }
      if (!par.size) return;
      for (const id of par.keys()) convsVues.add(id);
      post({ kind: 'vcmessages', conversations: [...par.values()], offset: 0, total: null, lus: par.size, forme: [], page: '/chat/', moi: moiId });
    } catch (_) {}
  }
  // L'ouverture d'une conversation (`POST apiv2…/chat/channel/`, mesurée) : son
  // identifiant et son article — jamais l'acheteur ni le vendeur.
  function noteCanal(url, methode, texte) {
    try {
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!DE_VC(url) || !/\/chat\/channel\/?$/i.test(u.pathname)) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      const d = obj && obj.data;
      if (!d || d.type !== 'chat_channel') return;
      const conv = String(d.id == null ? '' : d.id);
      if (!ID_CONV.test(conv)) return;
      convsVues.add(conv);
      post({ kind: 'vcmessages', conversations: [{ id: conv, productId: articleCanal(d, conv), ref: '', nonLu: null, date: '', apercu: '', apercuDeMoi: null, source: 'canal' }], offset: 0, total: null, lus: 1, forme: [], page: '/chat/', moi: moiId });
    } catch (_) {}
  }

  // ── APPRENDRE COMMENT LA PAGE ENVOIE UN MESSAGE ─────────────────────────
  const CHEMIN_ENVOI = /(conversation|message|thread|chat|inbox)/i;
  const PAS_ENVOI = /zendesk|partners|support|notification|help|report|block|signal|read|seen|typing|archive|delete|mark/i;
  const ENTETES_INTERDITS = /^(cookie|content-length|host|connection|origin|referer|user-agent|accept-encoding|content-type)$/i;
  const nomsEntetes = (h) => {
    const out = {};
    try {
      if (!h) return out;
      if (typeof h.forEach === 'function' && !Array.isArray(h)) h.forEach((v, k) => { out[String(k).toLowerCase()] = String(v); });
      else if (Array.isArray(h)) for (const [k, v] of h) out[String(k).toLowerCase()] = String(v);
      else if (typeof h === 'object') for (const k of Object.keys(h)) out[String(k).toLowerCase()] = String(h[k]);
    } catch (_) {}
    return out;
  };
  const noterEntetesPage = (url, h) => { try { if (!DE_VC(url) || !/^apiv2\./i.test(hoteDe(url))) return; const e = nomsEntetes(h); if (Object.keys(e).length) entetesApi = e; } catch (_) {} };
  function recetteEnvoi(url, methode, corps, entetes) {
    let u; try { u = new URL(url, location.origin); } catch (_) { return null; }
    // 5.317 — un message que TU envoies passe par Stream (mesuré : la page n'écrit
    // rien sur vestiairecollective.com en envoyant). Son corps porte un
    // identifiant fabriqué par la page et le jeton de Stream voyage dans un
    // en-tête : rien n'y est sûr à refaire. On le NOTE (pas rejouable, raison
    // dite) — VRM ne l'envoie jamais à ta place.
    if (DE_STREAM(url) && /^(POST|PUT)$/i.test(String(methode || '')) && /^\/channels\/[\w-]{1,40}\/[\w-]{3,64}\/message\/?$/i.test(u.pathname))
      return { methode: String(methode).toUpperCase(), hote: u.hostname, chemin: normChemin(sansId(u.pathname)), rejouable: false, raison: 'messagerie-stream' };
    if (!DE_VC(url) || !/^(POST|PUT)$/i.test(String(methode || ''))) return null;
    if (!CHEMIN_ENVOI.test(u.pathname) || PAS_ENVOI.test(u.pathname)) return null;
    // 5.317 — ouvrir une conversation ou demander le jeton de la messagerie n'est
    // PAS un envoi (mesuré : `POST /chat/channel/` notait un faux « essai »).
    if (/\/chat\/(channel|user)(\/|$)/i.test(u.pathname)) return null;
    const base = { methode: String(methode).toUpperCase(), hote: u.hostname, chemin: normChemin(sansId(u.pathname)) };
    const non = (raison) => ({ ...base, rejouable: false, raison });
    if (typeof corps !== 'string') return non('corps-illisible');
    let obj; try { obj = JSON.parse(corps); } catch (_) { return non('corps-pas-json'); }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return non('corps-pas-objet');
    const feuilles = []; let tableau = false;
    const marche = (v, ch) => {
      if (ch.length > 4) { tableau = true; return; }
      if (Array.isArray(v)) { tableau = true; return; }
      if (v && typeof v === 'object') { for (const k of Object.keys(v).slice(0, 30)) marche(v[k], ch.concat(k)); return; }
      feuilles.push([ch, v]);
    };
    marche(obj, []);
    if (tableau) return non('corps-tableau');
    const textes = feuilles.filter(([ch, v]) => CLE_TEXTE_MSG.test(ch[ch.length - 1]) && typeof v === 'string');
    if (textes.length !== 1) return non('texte-introuvable');
    const segs = u.pathname.split('/');
    const idSegs = segs.map((s, i) => (ID_CONV.test(s) && /\d/.test(s) ? i : -1)).filter((i) => i >= 0);
    if (idSegs.length > 1) return non('chemin-ambigu');
    let conv = idSegs.length === 1 ? segs[idSegs[0]] : '';
    const fixes = [];
    for (const [ch, v] of feuilles) {
      if (ch === textes[0][0]) continue;
      if (!conv && (typeof v === 'string' || typeof v === 'number') && convsVues.has(String(v))) conv = String(v);
      if (conv && (typeof v === 'string' || typeof v === 'number') && String(v) === conv) { fixes.push([ch.map((k) => cleSure(k)), '{conv}', typeof v]); continue; }
      if (typeof v === 'boolean' || v === null) { fixes.push([ch.map((k) => cleSure(k)), v, typeof v]); continue; }
      if (typeof v === 'string' && /^[A-Za-z_.:-]{1,40}$/.test(v)) { fixes.push([ch.map((k) => cleSure(k)), v, 'string']); continue; }
      return non('valeur-inconnue');
    }
    if (fixes.some(([ch]) => ch.includes('{k}')) || textes[0][0].some((k) => cleSure(k) === '{k}')) return non('cle-illisible');
    if (!conv) return non('conversation-introuvable');
    if (!convsVues.has(conv)) return non('conversation-non-vue');
    if (u.search && /\d{3,}|@/.test(u.search)) return non('adresse-a-parametres');
    const modele = segs.map((s, i) => (idSegs.length === 1 && i === idSegs[0] ? '{conv}' : s)).join('/');
    const noms = Object.keys(nomsEntetes(entetes)).filter((k) => !ENTETES_INTERDITS.test(k)).slice(0, 20);
    return { ...base, rejouable: true, raison: '', modele, recherche: u.search || '', cleTexte: textes[0][0], fixes, entetes: noms };
  }
  function noteEnvoi(url, methode, statut, corps, entetes) {
    try {
      if (!(statut >= 200 && statut < 300)) return;
      const r = recetteEnvoi(url, methode, corps, entetes);
      if (r) post({ kind: 'vcenvoiappris', recette: r });
    } catch (_) {}
  }
  // ── L'ENVOI, SUR SON CLIC (l'ordre vient du fond de l'extension par vc.js) ──
  let envoiEnCours = false;
  const poser = (o, ch, v) => { let x = o; for (let i = 0; i < ch.length - 1; i++) { if (!x[ch[i]] || typeof x[ch[i]] !== 'object') x[ch[i]] = {}; x = x[ch[i]]; } x[ch[ch.length - 1]] = v; };
  try { window.addEventListener('message', async (event) => {
    const d = event && event.data;
    if (event.source !== window || !d || d.__tag !== 'CANCALE_VC_ORDRE' || d.kind !== 'repondre') return;
    const jeton = String(d.jeton || ''), conv = String(d.conv || ''), texte = typeof d.texte === 'string' ? d.texte : '';
    const r = d.recette;
    if (!/^[a-z0-9-]{8,64}$/i.test(jeton)) return;
    const fin = (o) => post(Object.assign({ kind: 'vcenvoiresultat', jeton }, o));
    if (window.top !== window || !/(^|\.)vestiairecollective\.com$/i.test(location.hostname)) return fin({ statut: 0, erreur: 'pas-vestiaire' });
    if (!ID_CONV.test(conv) || !texte.trim() || texte.length > 2000) return fin({ statut: 0, erreur: 'invalide' });
    if (!r || r.rejouable !== true || !/^(POST|PUT)$/.test(String(r.methode)) || !/(^|\.)vestiairecollective\.com$/i.test(String(r.hote || ''))
      || typeof r.modele !== 'string' || !/^\/[\w\-/{}.]*$/.test(r.modele) || (r.modele.split('{conv}').length - 1) > 1
      || !Array.isArray(r.cleTexte) || !r.cleTexte.length || !Array.isArray(r.fixes)) return fin({ statut: 0, erreur: 'recette' });
    if (envoiEnCours) return fin({ statut: 0, erreur: 'en-cours' });
    // 5.299 — au nom du compte OUVERT DANS CETTE PAGE seulement (le fond dit
    // lequel il attend) : un onglet où l'on vient de changer de compte, ou qui
    // n'a pas encore lu `/users/me`, ne parle pour personne.
    if (d.compte !== undefined && (!moiId || String(d.compte) !== moiId)) return fin({ statut: 0, erreur: moiId ? 'autre-compte' : 'compte-pas-su' });
    const h = {};
    for (const n of (Array.isArray(r.entetes) ? r.entetes : [])) {
      const k = String(n).toLowerCase();
      if (ENTETES_INTERDITS.test(k)) continue;
      if (!entetesApi || entetesApi[k] == null) return fin({ statut: 0, erreur: 'entetes' });
      h[k] = entetesApi[k];
    }
    h['content-type'] = 'application/json'; h.accept = h.accept || 'application/json';
    const corps = {};
    try {
      for (const [ch, v, t] of r.fixes) poser(corps, ch.map(String), v === '{conv}' ? (t === 'number' ? Number(conv) : conv) : v);
      poser(corps, r.cleTexte.map(String), texte);
    } catch (_) { return fin({ statut: 0, erreur: 'recette' }); }
    const adresse = 'https://' + r.hote + r.modele.replace('{conv}', encodeURIComponent(conv)) + (/^\?[\w=&.%-]*$/.test(String(r.recherche || '')) ? r.recherche : '');
    envoiEnCours = true;
    try {
      let statut = 0, rep = '', erreur = '';
      try {
        const res = await origFetch.call(window, adresse, { method: r.methode, credentials: 'include', headers: h, body: JSON.stringify(corps) });
        statut = Number(res.status) || 0;
        try { rep = String(await res.text()).slice(0, 4000); } catch (_) {}
      } catch (e) { erreur = String((e && e.message) || e).slice(0, 80) || 'reseau'; }
      let cles = [], idMsg = '';
      try { const j = JSON.parse(rep); cles = cheminsDeCles(j).map(sansId).slice(0, 60); const dd = j && (j.data && typeof j.data === 'object' ? j.data : j); if (dd && (typeof dd.id === 'string' || typeof dd.id === 'number') && /^[\w-]{1,40}$/.test(String(dd.id))) idMsg = String(dd.id); } catch (_) {}
      fin({ statut, cles, idMsg, erreur });
    } finally { envoiEnCours = false; }
  }); } catch (_) {}


  // ── 5.319 (4 nov., Julien : « voir les offres reçues sur Vestiaire et y répondre
  //    depuis VRM ») — LES OFFRES (« négociations »). MESURÉ sur sa base (lecture
  //    seule, 4 nov.) : la page charge `GET apiv2…/negotiations?role=seller&withEvents=true`
  //    ⇒ `{ data: [ { id, type: 'negotiation', product: { id, name, brand: { name },
  //    pictures: [{ path }], path, price: { cents } }, events: [{ action: 'offer' |
  //    'accept', createdBy: 'buyer' | 'seller', price: { cents }, sellerPvnPrice,
  //    creationDate }], isOpened, isClosed, isAccepted, initialPrice, minOffer,
  //    maxOffer, expirationDate, sellerRemainingOffers, buyer, seller } ] }` (les
  //    événements du plus récent au plus ancien). Rien n'est DEMANDÉ : on lit ce que
  //    la page charge déjà. ⚠️ JAMAIS la personne : ni le nom, ni le pseudo, ni
  //    l'avatar, ni l'identifiant de l'acheteur ne sortent (son identifiant reste
  //    en MÉMOIRE de cette page, pour refaire la requête de la page elle-même).
  //  · RÉPONDRE (accepter, refuser, contre-offre) : la requête n'a JAMAIS été vue
  //    chez lui. Elle s'APPREND quand TU réponds toi-même à une offre sur la page
  //    (une écriture 2xx sur un chemin de négociation dont la réponse montre TON
  //    geste en dernier) : la « recette » d'UN geste garde la méthode, l'hôte, le
  //    chemin avec les identifiants remis en `{nego}` / `{produit}` / `{acheteur}`,
  //    les clés du corps (le prix remis en `{prixCents}` ou `{prix}`, les mots
  //    tels quels) et les NOMS des en-têtes — jamais une valeur d'en-tête. Une
  //    valeur qu'on ne sait pas refaire ⇒ « pas rejouable », avec sa raison.
  //    VRM ne la rejoue que sur TON clic, depuis cet onglet, au nom du compte de
  //    l'onglet, sur une offre que CETTE page a vue.
  const negosVues = new Map();   // id → { produit, acheteur, aToi, offreCents, initialCents } — mémoire de la page
  const ID_NEGO = /^\d{3,15}$/;
  const centsVc = (p) => (p && typeof p === 'object' && p.cents != null && isFinite(Number(p.cents)) && String(p.currency || 'EUR').toUpperCase() === 'EUR' ? Math.round(Number(p.cents)) : null);
  const ACTION_OFFRE = (a) => { const s = String(a || '').toLowerCase(); return s === 'offer' || s === 'counter_offer' || s === 'counteroffer' ? 'offer' : s === 'accept' || s === 'accepted' ? 'accept' : /^(decline|declined|refuse|refused|reject|rejected)$/.test(s) ? 'decline' : /^(cancel|cancelled|canceled|expire|expired)$/.test(s) ? 'close' : ''; };
  const PAR_OFFRE = (c) => { const s = String(c || '').toLowerCase(); return s === 'buyer' ? 'acheteur' : s === 'seller' ? 'vendeur' : ''; };
  function evenementsNego(n) {
    const brut = Array.isArray(n.events) ? n.events.slice(0, 40) : [];
    return brut.map((e) => (e && typeof e === 'object' ? { action: ACTION_OFFRE(e.action), par: PAR_OFFRE(e.createdBy), cents: centsVc(e.price), net: centsVc(e.sellerPvnPrice), at: /^\d{4}-\d{2}-\d{2}T/.test(String(e.creationDate || '')) ? String(e.creationDate).slice(0, 30) : '' } : null))
      .filter((e) => e && e.action && e.at).sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0));
  }
  function ficheNego(n) {
    if (!n || typeof n !== 'object' || Array.isArray(n) || String(n.type || '') !== 'negotiation') return null;
    const id = String(n.id == null ? '' : n.id);
    if (!ID_NEGO.test(id)) return null;
    const prod = n.product && typeof n.product === 'object' ? n.product : {};
    const produit = /^\d{3,15}$/.test(String(prod.id == null ? '' : prod.id)) ? String(prod.id) : '';
    const evs = evenementsNego(n);
    const der = evs[evs.length - 1] || null;
    const ouverte = n.isOpened === true && n.isClosed !== true;
    const offreA = [...evs].reverse().find((e) => e.action === 'offer' && e.par === 'acheteur') || null;
    const marque = prod.brand && typeof prod.brand === 'object' && typeof prod.brand.name === 'string' ? prod.brand.name : '';
    const nom = typeof prod.name === 'string' ? prod.name : '';
    const pic = Array.isArray(prod.pictures) && prod.pictures[0] && typeof prod.pictures[0] === 'object' ? prod.pictures[0].path : '';
    const lien = typeof prod.path === 'string' && /^\/[\w\-/.]{1,300}\.shtml$/i.test(prod.path) ? 'https://fr.vestiairecollective.com' + prod.path : '';
    const exp = /^\d{4}-\d{2}-\d{2}T/.test(String(n.expirationDate || '')) ? String(n.expirationDate).slice(0, 30) : '';
    return {
      id, produit, ouverte, fermee: n.isClosed === true, acceptee: n.isAccepted === true,
      // « À toi de répondre » : ouverte, et le DERNIER geste est une offre de l'acheteur.
      aToi: !!(ouverte && der && der.action === 'offer' && der.par === 'acheteur'),
      titre: coupe(propreTexte([marque, nom].filter(Boolean).join(' '), 140), 140), photo: photoVc(pic), lien,
      offre: offreA ? offreA.cents : null, net: offreA ? offreA.net : null,
      initial: centsVc(n.initialPrice) != null ? centsVc(n.initialPrice) : centsVc(prod.price),
      min: centsVc(n.minOffer), expire: exp,
      resteVendeur: Number.isFinite(n.sellerRemainingOffers) ? n.sellerRemainingOffers : null,
      dernier: der ? { action: der.action, par: der.par, cents: der.cents, at: der.at } : null,
      evenements: evs.slice(-10).map((e) => ({ action: e.action, par: e.par, cents: e.cents, at: e.at })),
      _acheteur: n.buyer && /^\d{3,15}$/.test(String(n.buyer.id == null ? '' : n.buyer.id)) ? String(n.buyer.id) : '',
      _vendeur: n.seller && /^\d{3,15}$/.test(String(n.seller.id == null ? '' : n.seller.id)) ? String(n.seller.id) : '',
    };
  }
  // Ce qui sort de la page : la fiche sans l'acheteur ni le vendeur (gardés ici).
  const ficheSortie = (f) => { const o = Object.assign({}, f); delete o._acheteur; delete o._vendeur; return o; };
  const retenirNego = (f) => { negosVues.set(f.id, { produit: f.produit, acheteur: f._acheteur, aToi: f.aToi, offreCents: f.offre, initialCents: f.initial }); if (negosVues.size > 400) negosVues.delete(negosVues.keys().next().value); };
  const CHEMIN_NEGO = /negotiation/i;
  const PAS_NEGO = /initial-conditions|conditions-view|eligib/i;
  function noteOffres(url, methode, texte) {
    try {
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!DE_VC(url) || !CHEMIN_NEGO.test(u.pathname) || PAS_NEGO.test(u.pathname)) return;
      // Les offres que TU fais sur l'article d'un autre (rôle acheteur) ne sont pas les tiennes à trancher.
      if (/(^|[?&])role=buyer(&|$)/i.test(u.search)) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      if (!obj || typeof obj !== 'object') return;
      const d = obj.data;
      const liste = Array.isArray(d);
      const brut = liste ? d.slice(0, 200) : (d && typeof d === 'object' ? [d] : null);
      if (!brut) { post({ kind: 'vcoffres', offres: [], liste: false, inconnu: cheminsDeCles(obj).map(sansId).slice(0, 60), page: pageIci(), moi: moiId }); return; }
      const fiches = brut.map(ficheNego);
      // Une liste dont un élément n'a pas la forme mesurée n'est pas « lue en entier ».
      if (fiches.some((f) => !f)) { post({ kind: 'vcoffres', offres: [], liste: false, inconnu: cheminsDeCles(obj).map(sansId).slice(0, 60), page: pageIci(), moi: moiId }); return; }
      const miennes = fiches.filter((f) => {
        if (liste) return /(^|[?&])role=seller(&|$)/i.test(u.search) || /\/selling-offers\//i.test(u.pathname) || (moiId && f._vendeur === moiId);
        // Une réponse seule : TON article (vendeur = compte ouvert), ou TON geste de vendeur.
        return (moiId && f._vendeur === moiId) || (!/^GET$/i.test(String(methode || 'GET')) && f.dernier && f.dernier.par === 'vendeur');
      });
      for (const f of miennes) retenirNego(f);
      if (!miennes.length && !liste) return;
      post({ kind: 'vcoffres', offres: miennes.map(ficheSortie), liste, page: pageIci(), moi: moiId });
    } catch (_) {}
  }
  // ⚠️ La recette d'UN geste, apprise de TA réponse faite sur la page.
  function recetteOffre(url, methode, corps, entetes, texte) {
    let u; try { u = new URL(url, location.origin); } catch (_) { return null; }
    if (!DE_VC(url) || !/^(POST|PUT|PATCH)$/i.test(String(methode || '')) || !CHEMIN_NEGO.test(u.pathname) || PAS_NEGO.test(u.pathname)) return null;
    let obj; try { obj = JSON.parse(texte); } catch (_) { return null; }
    const f = obj && obj.data && !Array.isArray(obj.data) ? ficheNego(obj.data) : null;
    if (!f || !f.dernier || f.dernier.par !== 'vendeur') return null;
    const evs = f.evenements;
    const avantAcheteur = evs.slice(0, -1).some((e) => e.action === 'offer' && e.par === 'acheteur');
    const geste = f.dernier.action === 'accept' ? 'accepter' : f.dernier.action === 'decline' ? 'refuser' : (f.dernier.action === 'offer' && avantAcheteur) ? 'contre' : '';
    if (!geste) return null;   // une offre que TU proposes d'abord (à un favori) n'est pas une réponse
    const base = { geste, methode: String(methode).toUpperCase(), hote: u.hostname, chemin: normChemin(sansId(u.pathname)) };
    const non = (raison) => ({ ...base, rejouable: false, raison });
    const ids = { '{nego}': f.id, '{produit}': f.produit, '{acheteur}': f._acheteur };
    const quoi = (v) => { const s = String(v); for (const k of Object.keys(ids)) if (ids[k] && s === ids[k]) return k; return ''; };
    const segs = u.pathname.split('/');
    const modeleSegs = [];
    for (const s of segs) {
      const q = s ? quoi(s) : '';
      if (q) { modeleSegs.push(q); continue; }
      if (/\d{3,}/.test(s)) return non('chemin-ambigu');
      modeleSegs.push(s);
    }
    const modele = modeleSegs.join('/');
    if (!modele.includes('{nego}') && !modele.includes('{produit}')) { /* l'identité peut être dans le corps */ }
    if (u.search && /\d{3,}|@/.test(u.search)) return non('adresse-a-parametres');
    // Le prix de TON geste : celui de l'événement (contre-offre), sinon l'offre de l'acheteur.
    const prixGeste = f.dernier.cents != null ? f.dernier.cents : f.offre;
    const fixes = [];
    let avecPrix = false, sansCorps = false;
    if (corps == null || corps === '') sansCorps = true;
    else {
      if (typeof corps !== 'string') return non('corps-illisible');
      let c; try { c = JSON.parse(corps); } catch (_) { return non('corps-pas-json'); }
      if (!c || typeof c !== 'object' || Array.isArray(c)) return non('corps-pas-objet');
      const feuilles = []; let tableau = false;
      const marche = (v, ch) => {
        if (ch.length > 4 || Array.isArray(v)) { tableau = true; return; }
        if (v && typeof v === 'object') { for (const k of Object.keys(v).slice(0, 30)) marche(v[k], ch.concat(k)); return; }
        feuilles.push([ch, v]);
      };
      marche(c, []);
      if (tableau) return non('corps-tableau');
      for (const [ch, v] of feuilles) {
        const cles = ch.map((k) => cleSure(k));
        if (cles.includes('{k}')) return non('cle-illisible');
        const q = (typeof v === 'string' || typeof v === 'number') ? quoi(v) : '';
        if (q) { fixes.push([cles, q, typeof v]); continue; }
        if (prixGeste != null && typeof v === 'number' && v === prixGeste) { fixes.push([cles, '{prixCents}', 'number']); avecPrix = true; continue; }
        if (prixGeste != null && (typeof v === 'number' || (typeof v === 'string' && /^\d{1,6}([.,]\d{1,2})?$/.test(v))) && Math.round(Number(String(v).replace(',', '.')) * 100) === prixGeste) { fixes.push([cles, '{prix}', typeof v]); avecPrix = true; continue; }
        if (typeof v === 'boolean' || v === null) { fixes.push([cles, v, typeof v]); continue; }
        if (typeof v === 'string' && /^[A-Za-z_.:-]{1,40}$/.test(v)) { fixes.push([cles, v, 'string']); continue; }
        return non('valeur-inconnue');
      }
    }
    if (geste === 'contre' && !avecPrix) return non('prix-introuvable');
    if (!modele.includes('{nego}') && !modele.includes('{produit}') && !fixes.some((x) => x[1] === '{nego}' || x[1] === '{produit}')) return non('offre-introuvable');
    if (!negosVues.has(f.id)) return non('offre-non-vue');
    const noms = Object.keys(nomsEntetes(entetes)).filter((k) => !ENTETES_INTERDITS.test(k)).slice(0, 20);
    return { ...base, rejouable: true, raison: '', modele, recherche: u.search || '', fixes, sansCorps, entetes: noms };
  }
  function noteReponseOffre(url, methode, statut, corps, entetes, texte) {
    try {
      if (!(statut >= 200 && statut < 300)) return;
      // La recette AVANT de retenir la réponse : `offre-non-vue` se juge sur ce que la page avait vu.
      const r = recetteOffre(url, methode, corps, entetes, texte);
      if (r) post({ kind: 'vcoffreappris', recette: r });
      noteOffres(url, methode, texte);
    } catch (_) {}
  }
  // ── RÉPONDRE À UNE OFFRE, SUR SON CLIC (l'ordre vient du fond par vc.js) ──
  let offreEnCours = false;
  try { window.addEventListener('message', async (event) => {
    const d = event && event.data;
    if (event.source !== window || !d || d.__tag !== 'CANCALE_VC_ORDRE' || d.kind !== 'offre') return;
    const jeton = String(d.jeton || ''), nego = String(d.nego || ''), geste = String(d.geste || '');
    const r = d.recette;
    if (!/^[a-z0-9-]{8,64}$/i.test(jeton)) return;
    const fin = (o) => post(Object.assign({ kind: 'vcoffreresultat', jeton }, o));
    if (window.top !== window || !/(^|\.)vestiairecollective\.com$/i.test(location.hostname)) return fin({ statut: 0, erreur: 'pas-vestiaire' });
    if (!ID_NEGO.test(nego) || !/^(accepter|refuser|contre)$/.test(geste)) return fin({ statut: 0, erreur: 'invalide' });
    const prixDemande = Number(d.prixCents);
    if (geste === 'contre' && !(Number.isInteger(prixDemande) && prixDemande > 0 && prixDemande < 10000000)) return fin({ statut: 0, erreur: 'invalide' });
    if (!r || r.rejouable !== true || r.geste !== geste || !/^(POST|PUT|PATCH)$/.test(String(r.methode)) || !/(^|\.)vestiairecollective\.com$/i.test(String(r.hote || ''))
      || typeof r.modele !== 'string' || !/^\/[\w\-/{}.]*$/.test(r.modele) || !Array.isArray(r.fixes)) return fin({ statut: 0, erreur: 'recette' });
    if (offreEnCours) return fin({ statut: 0, erreur: 'en-cours' });
    // Au nom du compte OUVERT DANS CETTE PAGE seulement.
    if (d.compte !== undefined && (!moiId || String(d.compte) !== moiId)) return fin({ statut: 0, erreur: moiId ? 'autre-compte' : 'compte-pas-su' });
    const mem = negosVues.get(nego);
    if (!mem) return fin({ statut: 0, erreur: 'offre-non-vue' });
    if (!mem.aToi) return fin({ statut: 0, erreur: 'plus-a-toi' });
    if (geste === 'contre' && mem.offreCents != null && prixDemande <= mem.offreCents) return fin({ statut: 0, erreur: 'invalide' });
    if (geste === 'contre' && mem.initialCents != null && prixDemande >= mem.initialCents) return fin({ statut: 0, erreur: 'invalide' });
    const prix = geste === 'contre' ? prixDemande : mem.offreCents;
    const vals = { '{nego}': nego, '{produit}': mem.produit, '{acheteur}': mem.acheteur };
    const besoin = (k) => r.modele.includes(k) || r.fixes.some((x) => x && x[1] === k);
    for (const k of Object.keys(vals)) if (besoin(k) && !vals[k]) return fin({ statut: 0, erreur: 'recette' });
    if ((besoin('{prixCents}') || besoin('{prix}')) && !(Number.isInteger(prix) && prix > 0)) return fin({ statut: 0, erreur: 'recette' });
    const h = {};
    for (const n of (Array.isArray(r.entetes) ? r.entetes : [])) {
      const k = String(n).toLowerCase();
      if (ENTETES_INTERDITS.test(k)) continue;
      if (!entetesApi || entetesApi[k] == null) return fin({ statut: 0, erreur: 'entetes' });
      h[k] = entetesApi[k];
    }
    h.accept = h.accept || 'application/json';
    let corps = null;
    if (!r.sansCorps) {
      corps = {};
      try {
        for (const [ch, v, t] of r.fixes) {
          let x = v;
          if (v === '{prixCents}') x = prix;
          else if (v === '{prix}') x = t === 'number' ? prix / 100 : (prix % 100 ? (prix / 100).toFixed(2) : String(prix / 100));
          else if (typeof v === 'string' && vals[v] !== undefined) x = t === 'number' ? Number(vals[v]) : vals[v];
          poser(corps, ch.map(String), x);
        }
      } catch (_) { return fin({ statut: 0, erreur: 'recette' }); }
      h['content-type'] = 'application/json';
    }
    let chemin = r.modele;
    for (const k of Object.keys(vals)) chemin = chemin.split(k).join(encodeURIComponent(vals[k] || ''));
    const adresse = 'https://' + r.hote + chemin + (/^\?[\w=&.%:-]*$/.test(String(r.recherche || '')) ? r.recherche : '');
    offreEnCours = true;
    try {
      let statut = 0, rep = '', erreur = '';
      try {
        const res = await origFetch.call(window, adresse, Object.assign({ method: r.methode, credentials: 'include', headers: h }, corps ? { body: JSON.stringify(corps) } : {}));
        statut = Number(res.status) || 0;
        try { rep = String(await res.text()).slice(0, 400000); } catch (_) {}
      } catch (e) { erreur = String((e && e.message) || e).slice(0, 80) || 'reseau'; }
      // La réponse dit-elle TON geste en dernier ? (sinon : « fait » n'est pas dit)
      let confirme = null;
      if (statut >= 200 && statut < 300) {
        try {
          const j = JSON.parse(rep); const f = j && j.data && !Array.isArray(j.data) ? ficheNego(j.data) : null;
          if (f && f.id === nego && f.dernier) {
            confirme = f.dernier.par === 'vendeur' && f.dernier.action === (geste === 'accepter' ? 'accept' : geste === 'refuser' ? 'decline' : 'offer');
            retenirNego(f);
            post({ kind: 'vcoffres', offres: [ficheSortie(f)], liste: false, page: pageIci(), moi: moiId });
          }
        } catch (_) {}
      }
      fin({ statut, confirme, erreur });
    } finally { offreEnCours = false; }
  }); } catch (_) {}

  // ── 5.364 (11 nov., Julien : « baisser le prix en série sur Vestiaire, sur mon
  //    clic ») — LE PRIX D'UNE ANNONCE. La requête qui change un prix n'a JAMAIS été
  //    vue chez lui (mesuré le 11 nov. : `vc_recon.chemins` ne porte aucune
  //    écriture sur un article publié). Elle s'APPREND, comme les offres, de SON
  //    geste fait à la main sur vestiairecollective.com : une écriture 2xx dont le
  //    chemin ou le corps porte un article que CETTE page a montré dans « Mes
  //    articles », et dont le corps porte UN prix différent de celui lu. La recette
  //    n'est « apprise » qu'une fois le NOUVEAU prix RELU (dans la réponse, ou dans
  //    « Mes articles » relu ensuite) : un prix mal compris (euros pris pour des
  //    centimes) ne devient jamais rejouable. Jamais une valeur d'en-tête.
  const annoncesVuesPrix = new Map();   // productId → { cents, url } — mémoire de la page
  const prixEnAttente = new Map();      // productId → { cents, recette, at }
  const PAS_PRIX = /negotiation|deposit|draft|like|favorite|favourite|notification|chat|search|recommend|cart|basket|order|session|reconciliation|photo|picture|message|conversation|follow|report/i;
  const CLE_PRIX_ECRIT = /price|prix|amount|cents/i;
  const centsFiche = (fi) => (fi && fi.prix && typeof fi.prix.valeur === 'number' && isFinite(fi.prix.valeur) && /price/i.test(String(fi.prix.cle || '')) && (!fi.prix.devise || fi.prix.devise === 'EUR') ? Math.round(fi.prix.valeur * 100) : null);
  function retenirPrixVus(url, items) {
    for (const x of items) {
      if (!x || !/^\d{3,15}$/.test(String(x.id || ''))) continue;
      const c = centsFiche({ prix: x.prix });
      if (c == null) continue;
      annoncesVuesPrix.set(String(x.id), { cents: c, url: String(url).slice(0, 600) });
      if (annoncesVuesPrix.size > 600) annoncesVuesPrix.delete(annoncesVuesPrix.keys().next().value);
      // Le nouveau prix RELU dans « Mes articles » ⇒ la recette en attente est apprise.
      const att = prixEnAttente.get(String(x.id));
      if (att && att.cents === c && Date.now() - att.at < 15 * 60000) { prixEnAttente.delete(String(x.id)); post({ kind: 'vcprixappris', recette: Object.assign({}, att.recette, { relu: 'liste' }) }); }
    }
  }
  // Le prix d'un article dans une réponse (l'article lui-même, ou une liste qui le porte).
  function centsDansReponse(obj, pid) {
    try {
      const cand = [];
      const d = obj && obj.data !== undefined ? obj.data : obj;
      if (Array.isArray(d)) cand.push(...d.map(deplier)); else if (d && typeof d === 'object') cand.push(deplier(d));
      for (const e of cand) {
        if (!e || typeof e !== 'object') continue;
        const id = String(e.id != null ? e.id : (e.productId != null ? e.productId : (e.product && e.product.id != null ? e.product.id : '')));
        if (id !== pid) continue;
        const c = centsFiche(ficheAnnonce(e));
        if (c != null) return c;
      }
    } catch (_) {}
    return null;
  }
  function recettePrix(url, methode, corps, entetes) {
    let u; try { u = new URL(url, location.origin); } catch (_) { return null; }
    if (!DE_VC(url) || !/^(POST|PUT|PATCH)$/i.test(String(methode || '')) || PAS_PRIX.test(u.pathname)) return null;
    if (typeof corps !== 'string' || !corps) return null;
    let c; try { c = JSON.parse(corps); } catch (_) { return null; }
    if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
    // L'article : un segment du chemin, sinon une valeur du corps, que CETTE page a montré.
    const segs = u.pathname.split('/');
    let pid = segs.find((s) => /^\d{3,15}$/.test(s) && annoncesVuesPrix.has(s)) || '';
    const feuilles = []; let tableau = false;
    const marche = (v, ch) => {
      if (ch.length > 4 || Array.isArray(v)) { tableau = true; return; }
      if (v && typeof v === 'object') { for (const k of Object.keys(v).slice(0, 30)) marche(v[k], ch.concat(k)); return; }
      feuilles.push([ch, v]);
    };
    marche(c, []);
    if (!pid) { const f = feuilles.find(([, v]) => (typeof v === 'string' || typeof v === 'number') && annoncesVuesPrix.has(String(v))); if (f) pid = String(f[1]); }
    if (!pid) return null;                               // pas une annonce que la page a montrée : rien à apprendre
    const avant = annoncesVuesPrix.get(pid).cents;
    const base = { methode: String(methode).toUpperCase(), hote: u.hostname, chemin: normChemin(sansId(u.pathname)) };
    const non = (raison) => ({ recette: { ...base, rejouable: false, raison }, pid, cents: null });
    if (tableau) return non('corps-tableau');
    const modeleSegs = [];
    for (const s of segs) {
      if (s === pid) { modeleSegs.push('{produit}'); continue; }
      if (/\d{3,}/.test(s)) return non('chemin-ambigu');
      modeleSegs.push(s);
    }
    if (u.search && /\d{3,}|@/.test(u.search)) return non('adresse-a-parametres');
    const fixes = []; let cents = null, nPrix = 0;
    for (const [ch, v] of feuilles) {
      const cles = ch.map((k) => cleSure(k));
      if (cles.includes('{k}')) return non('cle-illisible');
      if ((typeof v === 'string' || typeof v === 'number') && String(v) === pid) { fixes.push([cles, '{produit}', typeof v]); continue; }
      const chemin = ch.join('.');
      const nombre = typeof v === 'number' ? v : (typeof v === 'string' && /^\d{1,7}([.,]\d{1,2})?$/.test(v) ? Number(v.replace(',', '.')) : null);
      if (nombre != null && isFinite(nombre) && CLE_PRIX_ECRIT.test(chemin)) {
        const enCents = /cents/i.test(chemin) ? (Number.isInteger(nombre) ? nombre : null) : Math.round(nombre * 100);
        if (enCents == null || !(enCents > 0)) return non('prix-illisible');
        nPrix++; cents = enCents;
        fixes.push([cles, /cents/i.test(chemin) ? '{prixCents}' : '{prix}', typeof v]);
        continue;
      }
      if (typeof v === 'boolean' || v === null) { fixes.push([cles, v, typeof v]); continue; }
      if (typeof v === 'string' && /^[A-Za-z_.:-]{1,40}$/.test(v)) { fixes.push([cles, v, 'string']); continue; }
      return non('valeur-inconnue');
    }
    if (nPrix !== 1) return nPrix ? non('plusieurs-prix') : null;
    if (cents === avant) return null;                     // pas un changement de prix
    const noms = Object.keys(nomsEntetes(entetes)).filter((k) => !ENTETES_INTERDITS.test(k)).slice(0, 20);
    return { recette: { ...base, rejouable: true, raison: '', modele: modeleSegs.join('/'), recherche: u.search || '', fixes, entetes: noms }, pid, cents };
  }
  function notePrixManuel(url, methode, statut, corps, entetes, texte) {
    try {
      if (!(statut >= 200 && statut < 300) || prixVcEnCours) return;
      const r = recettePrix(url, methode, corps, entetes);
      if (!r) return;
      if (!r.recette.rejouable) { post({ kind: 'vcprixappris', recette: r.recette }); return; }
      // Le nouveau prix relu dans la RÉPONSE ⇒ appris tout de suite ; sinon en attente de « Mes articles ».
      let lu = null; try { lu = texte ? centsDansReponse(JSON.parse(texte), r.pid) : null; } catch (_) { lu = null; }
      if (lu === r.cents) { post({ kind: 'vcprixappris', recette: Object.assign({}, r.recette, { relu: 'reponse' }) }); return; }
      prixEnAttente.set(r.pid, { cents: r.cents, recette: r.recette, at: Date.now() });
      post({ kind: 'vcprixappris', recette: Object.assign({}, r.recette, { rejouable: false, raison: 'pas-encore-relu' }) });
    } catch (_) {}
  }
  // ── BAISSER UN PRIX, SUR SON CLIC (l'ordre vient du fond par vc.js) ──
  let prixVcEnCours = false;
  try { window.addEventListener('message', async (event) => {
    const d = event && event.data;
    if (event.source !== window || !d || d.__tag !== 'CANCALE_VC_ORDRE' || d.kind !== 'prix') return;
    const jeton = String(d.jeton || ''), produit = String(d.produit || '');
    const r = d.recette;
    if (!/^[a-z0-9-]{8,64}$/i.test(jeton)) return;
    const fin = (o) => post(Object.assign({ kind: 'vcprixresultat', jeton }, o));
    if (window.top !== window || !/(^|\.)vestiairecollective\.com$/i.test(location.hostname)) return fin({ statut: 0, erreur: 'pas-vestiaire' });
    const avant = Number(d.avantCents), apres = Number(d.apresCents);
    if (!/^\d{3,15}$/.test(produit) || !Number.isInteger(avant) || !Number.isInteger(apres) || !(apres >= 100) || !(apres < avant)) return fin({ statut: 0, erreur: 'invalide' });
    if (!r || r.rejouable !== true || !/^(POST|PUT|PATCH)$/.test(String(r.methode)) || !/(^|\.)vestiairecollective\.com$/i.test(String(r.hote || ''))
      || typeof r.modele !== 'string' || !/^\/[\w\-/{}.]*$/.test(r.modele) || !Array.isArray(r.fixes)) return fin({ statut: 0, erreur: 'recette' });
    if (prixVcEnCours) return fin({ statut: 0, erreur: 'en-cours' });
    if (d.compte !== undefined && (!moiId || String(d.compte) !== moiId)) return fin({ statut: 0, erreur: moiId ? 'autre-compte' : 'compte-pas-su' });
    // Le prix LU AVANT, dans cette page : celui que tu as vu dans l'aperçu, sinon rien ne part.
    const vu = annoncesVuesPrix.get(produit);
    if (!vu) return fin({ statut: 0, erreur: 'annonce-non-vue' });
    if (vu.cents !== avant) return fin({ statut: 0, erreur: 'prix-change', prixVuCents: vu.cents });
    const h = {};
    for (const n of (Array.isArray(r.entetes) ? r.entetes : [])) {
      const k = String(n).toLowerCase();
      if (ENTETES_INTERDITS.test(k)) continue;
      if (!entetesApi || entetesApi[k] == null) return fin({ statut: 0, erreur: 'entetes' });
      h[k] = entetesApi[k];
    }
    h.accept = h.accept || 'application/json';
    const corps = {};
    try {
      for (const [ch, v, t] of r.fixes) {
        let x = v;
        if (v === '{prixCents}') x = t === 'string' ? String(apres) : apres;
        else if (v === '{prix}') x = t === 'number' ? apres / 100 : (apres % 100 ? (apres / 100).toFixed(2) : String(apres / 100));
        else if (v === '{produit}') x = t === 'number' ? Number(produit) : produit;
        poser(corps, ch.map(String), x);
      }
    } catch (_) { return fin({ statut: 0, erreur: 'recette' }); }
    h['content-type'] = 'application/json';
    const adresse = 'https://' + r.hote + r.modele.split('{produit}').join(encodeURIComponent(produit)) + (/^\?[\w=&.%:-]*$/.test(String(r.recherche || '')) ? r.recherche : '');
    prixVcEnCours = true;
    try {
      let statut = 0, rep = '', erreur = '';
      try {
        const res = await origFetch.call(window, adresse, { method: r.methode, credentials: 'include', headers: h, body: JSON.stringify(corps) });
        statut = Number(res.status) || 0;
        try { rep = String(await res.text()).slice(0, 400000); } catch (_) {}
      } catch (e) { erreur = String((e && e.message) || e).slice(0, 80) || 'reseau'; }
      // RELIRE APRÈS : la réponse si elle porte l'article, sinon « Mes articles » relu (la même adresse que la page).
      let prixVuCents = null, relu = '';
      if (statut >= 200 && statut < 300) {
        try { prixVuCents = rep ? centsDansReponse(JSON.parse(rep), produit) : null; if (prixVuCents != null) relu = 'reponse'; } catch (_) {}
        if (prixVuCents == null && vu.url) {
          try {
            const hl = Object.assign({}, h); delete hl['content-type'];
            const res2 = await origFetch.call(window, vu.url, { method: 'GET', credentials: 'include', headers: hl });
            if (res2.status >= 200 && res2.status < 300) {
              const t2 = String(await res2.text());
              noteAnnonces(vu.url, t2);
              prixVuCents = centsDansReponse(JSON.parse(t2), produit);
              if (prixVuCents != null) relu = 'liste';
            }
          } catch (_) {}
        }
        if (prixVuCents != null) annoncesVuesPrix.set(produit, { cents: prixVuCents, url: vu.url });
      }
      fin({ statut, prixVuCents, relu, erreur });
    } finally { prixVcEnCours = false; }
  }); } catch (_) {}

  // ⛔ 5.323 (6 nov., Julien : « coupe la capture Vestiaire ») — LA CAPTURE BRUTE
  //    DE LA 5.315 EST RETIRÉE. Elle envoyait au fond la réponse JSON ENTIÈRE de
  //    chaque appel Vestiaire, les données de page (`__NEXT_DATA__`) et tout PDF
  //    reçu (bordereaux) : noms, e-mails, adresses, téléphones d'acheteurs partaient
  //    dans `vc_brut_*` (`audit-vc-recon` rouge). Personne ne les lisait : chaque
  //    fonction Vestiaire a son propre lecteur ci-dessus (annonces, ventes, achats,
  //    messages, offres, suivi, recettes apprises), qui ne garde que ses champs.
  //    ⚠️ NE PAS la remettre (ni une « liste noire » de clés : c'est une liste
  //    blanche par fonction qui protège, jamais un filtre après coup).

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      const url = (typeof input === 'string') ? input : (input && input.url) || '';
      const meth = (init && init.method) || (typeof input === 'object' && input && input.method) || 'GET';
      const ent = (init && init.headers) || (typeof input === 'object' && input && input.headers) || null;
      const corpsEnvoye = init && typeof init.body === 'string' ? init.body : null;
      try { noterEntetesPage(url, ent); noteMoiStream(url); } catch (_) {}
      const p = origFetch.apply(this, arguments);
      try {
        p.then((res) => {
          try {
            const ct = res.headers && res.headers.get && res.headers.get('content-type');
            noteVu(url, meth, res.status, ct);
            if ((DE_VC(url) || DE_STREAM(url)) && /^(POST|PUT)$/i.test(String(meth))) noteEnvoi(url, meth, res.status, corpsEnvoye, ent);
            if (DE_STREAM(url) && res.status >= 200 && res.status < 300 && /json/i.test(String(ct || ''))) res.clone().text().then((t) => noteStream(url, meth, res.status, t)).catch(() => {});
            // 5.299 : une réponse d'ERREUR (401, 404, 500…) n'est ni une liste, ni un compte, ni un schéma.
            // 5.364 : TON changement de prix à la main (réponse JSON ou non) ⇒ la recette du prix.
            if (DE_VC(url) && res.status >= 200 && res.status < 300 && /^(POST|PUT|PATCH)$/i.test(String(meth)) && !/json/i.test(String(ct || ''))) notePrixManuel(url, meth, res.status, corpsEnvoye, ent, '');
            if (DE_VC(url) && res.status >= 200 && res.status < 300 && /json/i.test(String(ct || ''))) res.clone().text().then((t) => { if (/^(POST|PUT|PATCH)$/i.test(String(meth))) { notePrixManuel(url, meth, res.status, corpsEnvoye, ent, t); noteReponseOffre(url, meth, res.status, corpsEnvoye, ent, t); } else noteOffres(url, meth, t); noteSchema(url, t); noteCatalogue(url, t); noteMoi(url, t); noteAnnonces(url, t); noteVentes(url, t); noteTimeline(url, t); noteCompteur(url, t); noteMessages(url, t); noteFluxMessages(url, t); noteCanal(url, meth, t); noteFil(url, t); noteAchats(url, t); notePublication(url, meth, res.status, t); }).catch(() => {});
          } catch (_) {}
        }).catch(() => {});
      } catch (_) {}
      return p;
    };
  }
  const OX = window.XMLHttpRequest;
  if (OX) {
    const origOpen = OX.prototype.open, origSend = OX.prototype.send, origSetH = OX.prototype.setRequestHeader;
    OX.prototype.open = function (method, url) { this.__vcUrl = url; this.__vcMeth = method; this.__vcH = null; return origOpen.apply(this, arguments); };
    if (origSetH) OX.prototype.setRequestHeader = function (k, v) { try { (this.__vcH = this.__vcH || {})[String(k)] = String(v); } catch (_) {} return origSetH.apply(this, arguments); };
    OX.prototype.send = function (corpsXhr) {
      try { noterEntetesPage(this.__vcUrl || '', this.__vcH); noteMoiStream(String(this.__vcUrl || '')); this.__vcCorps = typeof corpsXhr === 'string' ? corpsXhr : null; } catch (_) {}
      try {
        this.addEventListener('load', function () {
          try {
            const url = this.__vcUrl || '';
            const ct = this.getResponseHeader && this.getResponseHeader('content-type');
            noteVu(url, this.__vcMeth, this.status, ct);
            // 5.299 : une page qui demande `responseType = 'json'` était ignorée (rien n'était lu).
            let t = null;
            try { t = this.responseType === 'json' ? (this.response == null ? null : JSON.stringify(this.response)) : (this.responseType === '' || this.responseType === 'text') ? this.responseText : null; } catch (_) { t = null; }
            if ((DE_VC(url) || DE_STREAM(url)) && /^(POST|PUT)$/i.test(String(this.__vcMeth || ''))) noteEnvoi(url, this.__vcMeth, this.status, this.__vcCorps, this.__vcH);
            if (t && DE_STREAM(url) && this.status >= 200 && this.status < 300 && /json/i.test(String(ct || ''))) noteStream(url, this.__vcMeth, this.status, t);
            if (DE_VC(url) && this.status >= 200 && this.status < 300 && /^(POST|PUT|PATCH)$/i.test(String(this.__vcMeth || ''))) notePrixManuel(url, this.__vcMeth, this.status, this.__vcCorps, this.__vcH, t && /json/i.test(String(ct || '')) ? t : '');
            if (t && this.status >= 200 && this.status < 300 && /json/i.test(String(ct || ''))) { if (DE_VC(url) && /^(POST|PUT|PATCH)$/i.test(String(this.__vcMeth || ''))) noteReponseOffre(url, this.__vcMeth, this.status, this.__vcCorps, this.__vcH, t); else if (DE_VC(url)) noteOffres(url, this.__vcMeth, t); noteSchema(url, t); noteCatalogue(url, t); noteMoi(url, t); noteAnnonces(url, t); noteVentes(url, t); noteTimeline(url, t); noteCompteur(url, t); noteMessages(url, t); noteFluxMessages(url, t); noteCanal(url, this.__vcMeth, t); noteFil(url, t); noteAchats(url, t); notePublication(url, this.__vcMeth, this.status, t); }
          } catch (_) {}
        });
      } catch (_) {}
      return origSend.apply(this, arguments);
    };
  }
})();
