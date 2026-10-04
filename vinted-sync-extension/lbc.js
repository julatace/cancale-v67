// lbc.js — sur leboncoin.fr, dans TON navigateur. Plus aucun panneau (5.130).
//
// Julien, 2 octobre : « tout doit être centralisé dans VRM ; l'extension est
// simplement là pour capter ». Ce fichier fait trois choses, sans rien afficher
// d'autre que la petite carte VRM (vrm-badge.js) :
//  1. il RELAIE ce que lbc-inject.js capte (annonces, ventes, codes, étapes) ;
//  2. il enregistre la carte du formulaire de dépôt (noms de champs, jamais un
//     contenu saisi) ;
//  3. quand l'APP a demandé « Publier sur Leboncoin » pour une paire, il remplit
//     le dépôt (photos, titre, description, prix, catégorie, pointure, état) et
//     publie SANS booster — décision de Julien du 20 septembre. Le bandeau en
//     bas à gauche dit, pendant ce temps, ce qui est fait.
(function () {
  if (window.__vrmLbcLoaded) return; window.__vrmLbcLoaded = true;
  // ⚠️⚠️ ET SI LE FORMULAIRE DE DÉPÔT VIT DANS UN CADRE (iframe) ? Le script ne
  //    tournait que dans la page du haut (`all_frames: false`) : l'enregistreur
  //    n'aurait alors **jamais rien vu**, et le dépôt fait à la main aurait été
  //    fait pour rien. Il tourne désormais dans TOUS les cadres de leboncoin.fr
  //    — mais le PANNEAU, lui, ne se dessine que dans la page du haut : sinon on
  //    en aurait un par cadre. Dans un cadre, on n'enregistre, on n'affiche rien.
  const DANS_UN_CADRE = (() => { try { return window.top !== window; } catch (_) { return true; } })();
  const send = (m) => new Promise((res) => { try { chrome.runtime.sendMessage(Object.assign({ from: 'cancale-lbc' }, m), (r) => res(r || { ok: false })); } catch (_) { res({ ok: false }); } });

  // L'observateur réseau MAIN world (lbc-inject.js) est injecté via le manifest
  // (content_script world:MAIN) → immunisé à la CSP de Leboncoin. Ici on ne fait
  // que RELAYER au background ce qu'il capte (window.postMessage).
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const d = event.data; if (!d || d.__tag !== 'CANCALE_LBC') return;
    if (d.kind === 'lbcraw' && d.body) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcRaw', url: d.url, body: d.body }); } catch (_) {} }
    else if (d.kind === 'lbccatalogue' && d.body) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcCatalogue', url: d.url, body: d.body, coupe: !!d.coupe }); } catch (_) {} }
    else if (d.kind === 'lbcenvoi' && d.cles) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcEnvoi', url: d.url, methode: d.methode || '', cles: d.cles }); } catch (_) {} }
    else if (d.kind === 'lbcvente' && d.body) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcVente', url: d.url, body: d.body, coupe: !!d.coupe }); } catch (_) {} }
    else if (d.kind === 'lbcpaths' && d.paths) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcPaths', paths: d.paths, url: location.href }); } catch (_) {} }
    else if (d.kind === 'lbcschema' && d.cles) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcSchema', endpoint: d.endpoint, cles: d.cles }); } catch (_) {} }
    // La messagerie : le NOMBRE de non-lus d'un compte, et la liste de ses comptes
    // liés (sans email). Jamais un texte de message (voir lbc-inject.js).
    else if (d.kind === 'lbcmsgcompteur' && d.userId) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcMsgCompteur', userId: String(d.userId).slice(0, 64), unread: Number(d.unread) }); } catch (_) {} }
    else if (d.kind === 'lbccomptes' && Array.isArray(d.comptes)) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcComptes', comptes: d.comptes.slice(0, 10).map((c) => ({ id: String(c.id || '').slice(0, 64), name: String(c.name || '').slice(0, 60), pro: !!c.pro })) }); } catch (_) {} }
  }, false);


  // ── CAPTURE de TES annonces Leboncoin (passif : on lit ce que la page a déjà
  //    chargé, aucune requête en plus). Leboncoin est du Next.js → les données
  //    sont dans la balise <script id="__NEXT_DATA__"> du DOM. On y cherche les
  //    objets « annonce » (un prix + un titre) et on remonte les champs utiles.
  //    Sert au dispatcher (LBC → choisir un compte Vinted) et à la synchro inverse.
  // ⚠️⚠️ CETTE CAPTURE ÉTAIT MORTE EN SILENCE — ET PERSONNE NE POUVAIT LE SAVOIR.
  // Mesuré le 12 septembre : `lbc_listings` ET `lbc_accounts` sont ABSENTES de sa
  // base, alors que `lbc_recon` (écrite par un autre chemin) existe depuis le
  // 2 août. Or le compte Leboncoin se lit sur N'IMPORTE QUELLE page dès que
  // `__NEXT_DATA__` est là : s'il n'a jamais été écrit, c'est que cet élément
  // n'existe plus (Leboncoin est passé au routeur « app » de Next, qui diffuse
  // ses données dans `self.__next_f` au lieu de `__NEXT_DATA__`).
  // Conséquence : le panneau annonçait « 📊 0 annonce sur Leboncoin », aucun
  // rapprochement automatique, et surtout **aucun « à retirer »** — donc le
  // « vendue sur Vinted → retire-la » qu'il vient de demander ne pouvait pas
  // marcher, sans que rien ne le dise. C'est « rien lu ne vaut pas rien », sur
  // cet écran-ci.
  // ⇒ On essaie les DEUX sources, et on REMONTE ce qu'on a trouvé (`lbcCapture`)
  //   pour que le panneau puisse dire « je n'ai pas encore vu tes annonces »
  //   plutôt qu'un zéro inventé. Je n'ai jamais pu voir la page (403 depuis mes
  //   outils) : c'est donc l'extension qui mesure, comme pour le formulaire eBay.
  function donneesNext() {
    // 1) L'ancien format : un <script id="__NEXT_DATA__"> avec tout le JSON.
    try {
      const el = document.getElementById('__NEXT_DATA__');
      if (el && el.textContent) return { data: JSON.parse(el.textContent), source: 'next_data' };
    } catch (_) {}
    // 2) Le routeur « app » : les données arrivent en morceaux dans
    //    `self.__next_f`, sous forme de fragments de texte. On en extrait les
    //    objets JSON qui ressemblent à des annonces, sans rien supposer du reste.
    try {
      const f = self.__next_f;
      if (Array.isArray(f) && f.length) {
        const txt = f.map((c) => (Array.isArray(c) ? c[1] : c)).filter((x) => typeof x === 'string').join('');
        if (txt) return { data: objetsDuFlux(txt), source: 'next_f' };
      }
    } catch (_) {}
    return { data: null, source: 'aucune_source' };
  }
  // Extrait les objets JSON complets d'un flux texte. On ne parse QUE ce qui est
  // du JSON valide et bien fermé : un fragment tronqué est ignoré, jamais deviné.
  function objetsDuFlux(txt) {
    const out = [];
    let i = 0;
    while (i < txt.length && out.length < 400) {
      const d = txt.indexOf('{', i);
      if (d < 0) break;
      let p = 0, fin = -1, chaine = false, ech = false;
      for (let j = d; j < txt.length && j < d + 20000; j++) {
        const c = txt[j];
        if (ech) { ech = false; continue; }
        if (c === '\\') { ech = true; continue; }
        if (c === '"') { chaine = !chaine; continue; }
        if (chaine) continue;
        if (c === '{') p++;
        else if (c === '}') { p--; if (!p) { fin = j; break; } }
      }
      if (fin < 0) { i = d + 1; continue; }
      const brut = txt.slice(d, fin + 1);
      if (/"(subject|list_id|ad_id)"/.test(brut)) {
        try { out.push(JSON.parse(brut)); } catch (_) {}
      }
      i = fin + 1;
    }
    return out;
  }
  // Le numéro porté par « VRM-B125 » / « VRM-125 » (la même règle que l'app et
  // le fond : majuscules, sans tiret, « 007 » = « 7 »).
  function refVRMTexte(txt) {
    const m = /VRM[-\s]?((?:[A-Z]{1,3})?\d{1,6})(?!\d)/i.exec(String(txt || ''));
    if (!m) return '';
    let s = m[1].toUpperCase(); if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
    return s;
  }
  function captureLbcListings() {
    let listings = [];
    const src = donneesNext();
    try {
      if (src.data) {
        const data = src.data;
        const found = [];
        const seen = new Set();
        const looksLikeAd = (o) => o && typeof o === 'object' && (o.subject || o.title) && (o.price != null || o.price_cents != null || (o.attributes && o.price));
        const walk = (node, depth) => {
          if (!node || depth > 8 || found.length > 120) return;
          if (Array.isArray(node)) { for (const v of node) walk(v, depth + 1); return; }
          if (typeof node !== 'object') return;
          if (looksLikeAd(node)) {
            const id = String(node.list_id || node.ad_id || node.id || '');
            if (id && !seen.has(id)) {
              seen.add(id);
              const price = Array.isArray(node.price) ? node.price[0] : (node.price != null ? node.price : (node.price_cents != null ? node.price_cents / 100 : null));
              const body = String(node.body || node.description || '');
              found.push({
                id, subject: node.subject || node.title || '', price, url: node.url || '',
                body: body.slice(0, 400),
                ref: refVRMTexte(body) || refVRMTexte(node.subject) || null,
                images: (node.images && (node.images.urls || node.images.thumb_urls)) || node.image_urls || [],
                category: (node.category_name || node.category_id || ''),
                status: node.status || node.ad_status || '',
                // COMPTE LEBONCOIN proprietaire de l'annonce. Julien peut avoir
                // plusieurs comptes LBC : sans cette info, toutes les annonces
                // se melangeaient dans un seul tas et on ne savait plus laquelle
                // republier depuis quel compte.
                lbcUser: String((node.owner && (node.owner.user_id || node.owner.store_id)) || node.user_id || node.store_id || ''),
                lbcUserName: String((node.owner && (node.owner.name || node.owner.pseudo)) || node.owner_name || ''),
              });
            }
          }
          for (const k in node) { if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k], depth + 1); }
        };
        walk(data, 0);
        listings = found;
      }
    } catch (_) {}
    // Qui est connecte sur cette page ? Leboncoin met la session dans
    // __NEXT_DATA__. On le remonte pour que l'app sache quels comptes LBC sont
    // reellement branches, et lequel a servi a publier quoi.
    let account = null;
    try {
      if (src.data) {
        const data = src.data;
        const walk = (node, depth) => {
          if (account || !node || depth > 8 || typeof node !== 'object') return;
          if (Array.isArray(node)) { for (const v of node) walk(v, depth + 1); return; }
          const id = node.user_id || node.userId || node.store_id;
          const name = node.pseudo || node.pseudonym || node.name || node.email;
          if (id && name && (node.email || node.pseudo || node.pseudonym)) {
            account = { id: String(id), name: String(name), seenAt: new Date().toISOString() };
            return;
          }
          for (const k in node) if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k], depth + 1);
        };
        walk(data, 0);
      }
    } catch (_) {}
    // ⚠️ ON REMONTE LA MESURE, PAS SEULEMENT LE RÉSULTAT. Sans ça, « 0 annonce
    //    captée » et « je n'ai pas pu lire la page » sont le même silence — et
    //    c'est le silence qui a caché pendant des semaines que cette capture ne
    //    marchait plus. Aucune donnée d'annonce ici : juste ce qui existe.
    try {
      send({
        // ⚠️ NOM DISTINCT, ET CE N'EST PAS UN DÉTAIL : `lbcCapture` existe déjà et
        //    transporte les ANNONCES. Mon premier jet réutilisait ce nom — le
        //    handler du fond prenait le premier des deux et **avalait la vraie
        //    capture** en silence. C'est le banc qui l'a vu (champs `undefined`)
        //    avant que ça ne parte. Un diagnostic ne doit jamais partager le
        //    canal de la donnée qu'il observe.
        action: 'lbcDiag',
        source: src.source,
        vues: listings.length,
        compte: !!account,
        url: location.href.slice(0, 160),
        // Ce que la page porte VRAIMENT, pour viser juste au prochain passage.
        a_next_data: !!document.getElementById('__NEXT_DATA__'),
        a_next_f: !!(self.__next_f && self.__next_f.length),
      });
    } catch (_) {}
    // ⚠️⚠️ CE QUI EST SUR LA PAGE N'EST PAS FORCÉMENT À LUI.
    // Mesuré le 13 septembre, juste après la mise à jour : la capture a rangé
    // **81 « annonces »** — des chalets, des gîtes, un appartement à La Plagne.
    // C'était le flux `api/discovery/category/53` de la page qu'il regardait.
    // Mon parser prenait tout objet en forme d'annonce, sans se demander À QUI
    // elle est. Conséquences : le compteur aurait annoncé « 81 annonces sur
    // Leboncoin », et le rapprochement aurait travaillé sur des inconnues.
    // ⇒ On ne garde que ce qu'on peut ATTRIBUER : l'annonce porte une référence
    //   `VRM-{n°}` (c'est nous qui l'y mettons), OU son propriétaire est le
    //   compte connecté sur la page. Le reste est ignoré — pas caché, ignoré :
    //   il n'a jamais été à lui.
    //   C'est la même discipline que « mieux vaut un blanc qu'un faux » (§5).
    const moi = account && account.id ? String(account.id) : null;
    const aMoi = (l) => !!(l && (l.ref || (moi && String(l.lbcUser || '') === moi)));
    const avant = listings.length;
    listings = listings.filter(aMoi);
    if (avant !== listings.length) {
      try { send({ action: 'lbcDiag', source: src.source, vues: listings.length, ecartees: avant - listings.length, compte: !!account, url: location.href.slice(0, 160), a_next_data: !!document.getElementById('__NEXT_DATA__'), a_next_f: !!(self.__next_f && self.__next_f.length) }); } catch (_) {}
    }
    if (listings.length || account) {
      send({ action: 'lbcCapture', url: location.href, listings, account });
    }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // Un message bref sur la page de dépôt (ce qui vient d'être rempli). Plus de
  // panneau : il vit seul, en bas, et disparaît. VRM Noir (§7).
  function toast(t) {
    try {
      const el = document.createElement('div');
      el.setAttribute('data-vrm', 'toast');
      el.textContent = t;
      el.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);max-width:min(460px,calc(100vw - 32px));background:#10141B;color:#E8ECF2;border:1px solid #1E2530;padding:10px 14px;border-radius:10px;font:600 12.5px/1.45 -apple-system,system-ui,sans-serif;z-index:2147483646;box-shadow:0 1px 2px rgba(0,0,0,.35),0 12px 30px rgba(0,0,0,.3);opacity:0;transition:opacity .2s';
      document.documentElement.appendChild(el);
      requestAnimationFrame(() => { el.style.opacity = '1'; });
      setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, 2200);
    } catch (_) {}
  }
  // Pré-remplissage BEST-EFFORT du formulaire « Déposer une annonce ».
  // Leboncoin change souvent son formulaire : si un champ n'est pas trouvé, on
  // ne casse rien (l'utilisateur a toujours les boutons « copier »).
  function setField(el, val) {
    if (!el) return false;
    try {
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (_) { return false; }
  }
  // ⚠️ LA GARDE D'EN-TÊTE EXISTAIT DANS `ebay.js`, PAS ICI — sur le script le
  //    plus utilisé des deux. Le panneau tourne sur TOUTES les pages de
  //    Leboncoin : cliquer « Pré-remplir » depuis une page de résultats visait
  //    la barre de recherche et annonçait « 1 champ pré-rempli » sur une page où
  //    rien d'utile n'a été rempli. On écarte en-tête, pied de page, navigation
  //    et recherche — et un champ caché ou désactivé.
  const DANS_ENTETE = (el) => !!el.closest('header, footer, [role="search"], [role="banner"], [role="navigation"], nav, form[action*="recherche"]');
  // ⚠️ ET UN CHAMP DE FILTRE N'EST PAS UN CHAMP DE DÉPÔT. Le panneau tourne sur
  //    TOUTES les pages de Leboncoin : une page de résultats porte « Prix min »
  //    et « Prix max », qui correspondent parfaitement à `/prix|price|montant/`.
  //    Y écrire son prix ne remplit rien d'utile — et le panneau annoncerait
  //    « 1 champ rempli ». On les écarte par ce qu'ils SONT, pas par l'URL :
  //    borner sur l'adresse casserait le pré-remplissage aux étapes suivantes du
  //    dépôt, dont je ne connais pas les URL (une nouveauté ne doit pas éteindre
  //    ce qui marchait).
  const PAS_UN_CHAMP_DE_DEPOT = /recherch|\bmin\b|\bmax\b|filtr|\btri\b|code.?postal|localisation|mot.?cl/i;
  function findField(patterns) {
    const els = Array.from(document.querySelectorAll('input, textarea'));
    for (const p of patterns) {
      for (const el of els) {
        if (el.type === 'hidden' || el.disabled) continue;
        if (DANS_ENTETE(el)) continue;
        const lab = (el.labels && el.labels[0] && el.labels[0].innerText) || '';
        const hay = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.placeholder || '') + ' ' + lab).toLowerCase();
        if (PAS_UN_CHAMP_DE_DEPOT.test(hay)) continue;
        if (p.test(hay)) return el;
      }
    }
    return null;
  }
  // ⚠️⚠️ LE PANNEAU ANNONÇAIT « (dont la réf VRM-401) » MÊME QUAND LA RÉFÉRENCE
  // N'AVAIT PAS ÉTÉ MISE. Mesuré le 12 septembre sur la structure que SON
  // navigateur a rapportée de la vraie page de dépôt (`lbc_recon`, 2 août) :
  // cette page ne contient qu'UN SEUL champ — `name="subject"`, « Que
  // proposez-vous aujourd'hui ? ». C'est un formulaire en ÉTAPES : ni la
  // description, ni le prix, ni la référence n'y existent. La référence n'était
  // donc JAMAIS remplie, et le message disait le contraire à chaque fois.
  // Ce n'est pas un détail d'affichage : la référence `VRM-{n°}` est ce qui
  // relie l'annonce Leboncoin à la paire SANS rapprochement par titre (§5). Sans
  // elle, « vendue sur Vinted → à retirer de Leboncoin » ne peut pas la
  // reconnaître — et il vend la même paire deux fois.
  // ⇒ On dit CE QUI a été rempli, on nomme ce qui manque, et on rappelle que la
  //   référence est dans la description copiée (`buildLbcAd` l'y met en haut et
  //   en bas). Le chiffre, jamais la promesse — leçon du bandeau eBay.
  // ══════════════════════════════════════════════════════════════════════════
  // LES PHOTOS S'ATTACHENT — MESURÉ, PAS SUPPOSÉ
  // ══════════════════════════════════════════════════════════════════════════
  // Ce que le dossier affirmait (« un navigateur interdit de remplir un champ
  // fichier par programme ») est FAUX, et je l'avais écrit. Ce qui est interdit
  // c'est `input.value = '/chemin/…'`. `input.files = dataTransfer.files`, lui,
  // marche : la page reçoit un vrai `File` et son `change` part. Vérifié dans
  // Chromium le 13 septembre, puis au banc sur le VRAI `lbc.js`.
  // ⇒ Julien n'a plus rien à télécharger : le fond lit les octets (le CDN de
  //   Vinted n'a pas d'en-tête CORS, la page seule ne peut pas), on fabrique les
  //   fichiers ici, et on les attache.
  // ⚠️ On n'invente aucun clic : `input.files` et un `change` sont l'API du
  //   navigateur, pas un faux clic de souris (§3 — ce qui est refusé, c'est
  //   piloter la souris à l'aveugle sur Vinted).
  function champsFichier() {
    return Array.from(document.querySelectorAll('input[type="file"]'))
      .filter((el) => !el.disabled && !DANS_ENTETE(el));
  }
  function fichiersDepuis(photos, numero) {
    const out = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (!p || !p.b64) continue;
      try {
        const bin = atob(p.b64);
        const buf = new Uint8Array(bin.length);
        for (let j = 0; j < bin.length; j++) buf[j] = bin.charCodeAt(j);
        const type = p.type || 'image/jpeg';
        const ext = /png/.test(type) ? 'png' : (/webp/.test(type) ? 'webp' : 'jpg');
        out.push(new File([buf], `VRM-${numero}-${i + 1}.${ext}`, { type }));
      } catch (_) {}
    }
    return out;
  }
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  function zonePhotos() {
    return document.querySelector('[class*="drop"],[class*="Drop"],[data-testid*="photo"],[class*="photo"],[class*="upload"],[class*="Upload"],[aria-label*="photo" i]');
  }
  // Combien de VIGNETTES d'aperçu de photos sont visibles (blob:/data:). C'est
  // ainsi qu'on SAIT combien de photos Leboncoin a réellement acceptées, sans
  // voir sa page : on avance jusqu'à ce que ce nombre atteigne le nôtre.
  // ⚠️⚠️ MESURÉ LE 20 SEPTEMBRE : ce compteur est AVEUGLE sur le vrai dépôt.
  //    Leboncoin téléverse chaque photo (`api/pintad/v1/public/upload/image`) et
  //    affiche la vignette RENVOYÉE par le serveur (une URL https), PAS un
  //    `blob:`/`data:`. Il rendait donc **0** quoi qu'il arrive — d'où la fausse
  //    réussite « tout attaché » alors qu'il n'y avait que la couverture. On ne
  //    PILOTE donc plus le remplissage dessus (on pilote sur ce qu'on POSE) ; il
  //    ne sert qu'à confirmer, quand il le peut. Un `null` veut dire « pas su ».
  function apercusPhotos() {
    try { return document.querySelectorAll('img[src^="blob:"], img[src^="data:"]').length; } catch (_) { return 0; }
  }
  // ── SONDE (lecture seule, aucun contenu) : à quoi ressemblent les vignettes
  //    acceptées, pour MESURER — sans voir sa page — combien Leboncoin a pris et
  //    sous quelle forme. Le prochain dépôt me dira la vérité, et je pourrai
  //    alors compter juste. *Faire mesurer par ce qui y a accès.*
  function sondePhotos() {
    const c = (s) => { try { return document.querySelectorAll(s).length; } catch (_) { return 0; } };
    let bg = 0;
    try { for (const el of document.querySelectorAll('[style*="background-image"]')) if (/url\(/i.test(el.getAttribute('style') || '')) bg++; } catch (_) {}
    return {
      blob: c('img[src^="blob:"]'), data: c('img[src^="data:"]'),
      http: c('img[src^="http"]'), canvas: c('canvas'), bg,
      fichierMultiple: (() => { const f = champsFichier()[0]; return f ? !!f.multiple : null; })(),
    };
  }
  function poserFichiers(input, fichiers) {
    try {
      const dt = new DataTransfer(); fichiers.forEach((f) => dt.items.add(f));
      input.files = dt.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (_) { return false; }
  }
  function dropSur(zone, fichiers) {
    try {
      const dt = new DataTransfer(); fichiers.forEach((f) => dt.items.add(f));
      ['dragenter', 'dragover', 'drop'].forEach((t) => zone.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt })));
      return true;
    } catch (_) { return false; }
  }
  // La raison du serveur, dite en clair (§2.7 : il n'est pas développeur).
  function raisonDetourage(r) {
    const t = {
      'session': 'connecte l\'extension à ton compte VRM',
      'no-key': 'la clé Photoroom n\'est pas encore posée',
      'plafond': 'le plafond de détourage du mois est atteint',
      'abonnement': 'ton abonnement VRM est à régulariser',
      'reserve': 'le détourage est réservé au compte principal',
      'compteur': 'le compteur du mois n\'a pas pu être lu, réessaie',
      'photoroom-402': 'les crédits Photoroom sont épuisés',
      'photoroom-403': 'la clé Photoroom est refusée',
      'delai': 'Photoroom a mis trop de temps à répondre',
      'pas-une-photo': 'la couverture n\'est pas une photo de la paire',
      'trop-lourde': 'la photo est trop lourde',
      'cache': 'le serveur n\'a pas pu vérifier si elle était déjà détourée',
      'acces': 'le serveur n\'a pas pu vérifier ton abonnement',
    };
    return t[r] || 'le détourage n\'a pas marché cette fois';
  }
  async function attacherPhotos(ad) {
    // ⚠️ Compte PARTICULIER : jusqu'à 15 photos. Compte PRO : 5 max sans le pack.
    //    On ENVOIE jusqu'à 15 et Leboncoin plafonne lui-même selon le compte.
    const urls = (ad.photos || []).slice(0, 15);
    if (!urls.length) return { n: 0, raison: 'aucune photo à attacher' };
    if (!champsFichier()[0] && !zonePhotos()) return { n: 0, raison: 'aucun champ photo sur cette étape' };
    const r = await send({ action: 'photoBytes', urls, max: 15 });
    const photos = (r && r.ok && Array.isArray(r.photos)) ? r.photos : [];
    const fichiers = fichiersDepuis(photos, ad.numero);
    const rates = photos.filter((p) => p && p.erreur).length;   // le CDN a refusé
    // Détourage Photoroom (réglage de l'app) : le fond le fait AVANT de rendre les
    // octets ; ici on ne fait que COMPTER ce qui est revenu détouré, pour le dire.
    // La raison qui compte : une raison d'ARRÊT (clé, plafond, crédits…) passe
    // avant « la couverture n'est pas une photo de la paire », qui ne vaut que
    // pour une photo.
    const raisons = photos.filter((p) => p && p.detoure === false && p.detourage).map((p) => p.detourage);
    const detourageRaison = raisons.find((r) => r !== 'pas-une-photo') || raisons[0] || '';
    if (!fichiers.length) return { n: 0, rates, raison: rates ? 'les photos n\'ont pas pu être lues' : 'aucune photo lisible' };

    const base = apercusPhotos();
    const champGarde = () => { const f = champsFichier()[0]; return f && f.files ? f.files.length : 0; };
    // ⚠️⚠️ DEUX UPLOADERS, DEUX GESTES OPPOSÉS — et le SEUL signal fiable pour les
    //    distinguer n'est PAS l'attribut `multiple`, mais si le champ GARDE le
    //    fichier qu'on vient d'y poser :
    //    · champ CONTRÔLÉ (source de vérité) → il garde `input.files` → on pose
    //      tout d'un coup (un séquentiel le REMPLACERAIT par une seule).
    //    · uploader « à chaque change » (le vrai dépôt Leboncoin, mesuré le
    //      20 sept. : `multiple:true` pourtant) → il lit UNE photo, l'envoie au
    //      serveur, et VIDE le champ. Un envoi groupé n'y dépose que la couverture
    //      (« il n'y a qu'une seule photo qui se téléverse »). Il faut les poser
    //      UNE PAR UNE, chacune dans son propre `change`.
    //    On POSE la première, puis on REGARDE : le champ l'a-t-il gardée ?
    let placees = 0, voie = 'seq', manques = 0;
    { const first = champsFichier()[0]; let ok = first ? poserFichiers(first, [fichiers[0]]) : false;
      if (!ok) { const z = zonePhotos(); if (z) ok = dropSur(z, [fichiers[0]]); }
      if (ok) placees = 1; }
    await attendre(700);
    if (placees === 1 && champGarde() >= 1 && fichiers.length > 1) {
      // CONTRÔLÉ : il a gardé la 1re → on remplace par TOUTES d'un coup.
      const f = champsFichier()[0];
      if (f) { poserFichiers(f, fichiers); voie = 'multiple'; placees = fichiers.length; await attendre(900); }
    }
    if (voie === 'seq') {
      // « À chaque change » : il a vidé le champ (ou ne le garde pas). On continue
      //  photo par photo, sans jamais reposer la même (pas de doublon), en
      //  re-cherchant le champ à chaque fois (l'uploader le remonte). On pilote
      //  sur ce qu'on POSE — le compteur de vignettes est aveugle ici.
      const cap = fichiers.length * 4 + 8;
      for (let garde = 0; garde < cap && placees < fichiers.length && manques < 4; garde++) {
        const vues0 = apercusPhotos() - base;
        if (vues0 >= fichiers.length) break;           // vignettes comptables ET complètes
        let input = null;
        for (let e = 0; e < 6 && !input; e++) { input = champsFichier()[0]; if (!input) await attendre(300); }
        let ok = false;
        if (input) ok = poserFichiers(input, [fichiers[placees]]);
        if (!ok) { const z = zonePhotos(); if (z) ok = dropSur(z, [fichiers[placees]]); }
        if (ok) { placees++; manques = 0; } else { manques++; }
        await attendre(700);
      }
    }
    const vues = apercusPhotos() - base;
    // On ne PRÉTEND jamais plus que ce qu'on a envoyé. « confirmées » = ce qu'on a
    // pu COMPTER (vignettes blob/data, ou fichiers gardés par un champ contrôlé) ;
    // sinon `null` = « pas su » (les vignettes de Leboncoin sont hors de portée).
    const confirmees = vues > 0 ? Math.min(vues, fichiers.length)
      : (voie === 'multiple' && champGarde() >= 1 ? Math.min(champGarde(), fichiers.length) : null);
    const n = confirmees != null ? Math.max(confirmees, placees) : placees;
    // ── SONDE renvoyée au fond (lecture seule, aucun contenu) pour MESURER la
    //    vraie mécanique de l'uploader — le prochain dépôt me dira la vérité.
    try { send({ action: 'photoDiag', diag: Object.assign({ envoyees: placees, lisibles: fichiers.length, rates, voie, at: new Date().toISOString() }, sondePhotos()) }); } catch (_) {}
    // « dont N détourées » ne compte que les photos réellement POSÉES : un
    // sous-total plus grand que le total serait un chiffre faux (§5).
    const lisibles = photos.filter((p) => p && p.b64);
    const detourees = lisibles.slice(0, Math.min(placees, fichiers.length)).filter((p) => p.detoure === true).length;
    return { n: Math.min(n, fichiers.length), envoyees: placees, confirmees, rates, total: fichiers.length, voie, detourees, detourageRaison };
  }

  // ⚠️⚠️ LE CHAMP PRIX S'APPELLE `price_cents` — IL ATTEND DES CENTIMES.
  // Mesuré le 19 septembre sur la carte du dépôt (`lbc_recon.etapes`, étape à
  // 5 champs : `subject, body, price_cents, location`). L'ancien code posait
  // `ad.price` (54) directement → Leboncoin affichait **0,54 €** sur l'annonce.
  // Le NOM du champ porte l'unité : s'il contient « cent », on pose l'entier en
  // centimes ; sinon (un champ euros ailleurs) on pose les euros. On ne devine
  // pas l'unité, on la LIT.
  function poserPrix(euros, siVide) {
    const el = findField([/prix|price|montant/]);
    if (!el) return false;
    if (siVide && String(el.value || '').trim()) return false;   // ne pas écraser une correction manuelle
    const n = Number(euros);
    if (!isFinite(n) || n <= 0) return false;
    const nom = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
    return setField(el, /cent/.test(nom) ? String(Math.round(n * 100)) : String(n));
  }
  // Capture la STRUCTURE du formulaire de dépôt Leboncoin (noms/libellés des champs)
  // pour que je puisse brancher le pré-remplissage exactement (réf, catégorie…).
  let derniereEtape = '';
  // ══════════════════════════════════════════════════════════════════════════
  // ⚠️⚠️ « C'EST DIFFÉRENT POUR CHAQUE ANNONCE » — Julien, 17 septembre, et il a
  //       raison : le dépôt Leboncoin n'a pas les mêmes étapes selon la
  //       CATÉGORIE. Des chaussures n'ont pas les champs d'un livre.
  // ══════════════════════════════════════════════════════════════════════════
  // Trois choses manquaient pour que l'enregistrement serve à quelque chose, et
  // les trois font qu'un dépôt fait à la main aurait été fait pour rien :
  //
  //  1. ⚠️⚠️ **SEULS LES `<select>` NATIFS ÉTAIENT REGARDÉS.** Leboncoin est une
  //     application React : ses listes sont presque sûrement des composants
  //     (`role="combobox"` + `role="listbox"`), pas des `<select>`. Dans ce cas
  //     on rapportait **zéro liste** — donc ni catégorie, ni état, ni pointure,
  //     c'est-à-dire exactement ce qu'on vient chercher. Je ne peux pas le
  //     vérifier moi-même (leboncoin.fr me répond 403) : on couvre **les deux
  //     formes**, et l'étape DIT laquelle elle a trouvée.
  //  2. **Rien ne disait DANS QUELLE CATÉGORIE l'étape avait été vue.** Recevoir
  //     un champ « Pointure » sans savoir sur quel chemin, c'est risquer de le
  //     remplir sur le formulaire d'un livre. La catégorie choisie est donc
  //     notée — c'est un libellé d'option, pas un contenu saisi.
  //  3. **Aucun ordre, et deux dépôts se mélangeaient.** Chaque visite porte un
  //     identifiant et chaque étape son rang : on saura quelle étape suit
  //     laquelle, et laquelle appartient à quelle annonce.
  //
  // ⚠️ LA PROMESSE DE CONFIDENTIALITÉ NE BOUGE PAS : ce qu'il TAPE (titre,
  //    description, prix) ne part jamais. Seuls partent des noms de champs et
  //    des libellés d'options — y compris celui qu'il a choisi dans une liste.
  const DEPOT_ID = Math.random().toString(36).slice(2, 8);
  // ⚠️ LA VERSION QUI A ÉCRIT L'ÉTAPE. Sans elle je dois DEVINER si une étape
  //    manquante vient d'un défaut ou d'une extension plus ancienne — et le
  //    dossier dit noir sur blanc de ne plus redéduire une version. Mesuré le
  //    17 septembre : trois étapes enregistrées, aucune n'était le formulaire du
  //    milieu, et je n'avais aucun moyen de savoir laquelle des versions
  //    tournait. On l'écrit.
  const EXT_VER = (() => { try { return (chrome.runtime.getManifest() || {}).version || ''; } catch (_) { return ''; } })();
  let ordreEtape = 0;

  // ⚠️⚠️ ET `querySelectorAll` NE TRAVERSE PAS LE SHADOW DOM. Une application
  //    moderne peut y enfermer tout son formulaire : on chercherait alors dans
  //    une page vide sans le savoir — le même « 0 liste » que les composants,
  //    mais silencieux. On descend dans les racines fantômes, borné (300
  //    racines) pour ne jamais bloquer la page.
  function tousLesNoeuds(sel) {
    const out = [];
    const racines = [document];
    let vues = 0;
    while (racines.length && vues < 300) {
      const r = racines.shift(); vues++;
      let n = [];
      try { n = Array.from(r.querySelectorAll(sel)); } catch (_) { n = []; }
      for (const el of n) out.push(el);
      let tous = [];
      try { tous = Array.from(r.querySelectorAll('*')); } catch (_) { tous = []; }
      for (const el of tous) if (el.shadowRoot) racines.push(el.shadowRoot);
    }
    return out;
  }

  // Le texte visible d'un élément, borné (un composant de liste affiche sa
  // valeur choisie en clair).
  function texteVisible(el, max) {
    try { return String((el.innerText || el.textContent || '')).replace(/\s+/g, ' ').trim().slice(0, max || 40); } catch (_) { return ''; }
  }
  function libelleDe(el) {
    try {
      if (el.labels && el.labels[0]) return texteVisible(el.labels[0], 50);
      const al = el.getAttribute && el.getAttribute('aria-label'); if (al) return String(al).slice(0, 50);
      const lb = el.getAttribute && el.getAttribute('aria-labelledby');
      if (lb) { const n = document.getElementById(lb); if (n) return texteVisible(n, 50); }
      const p = el.closest && el.closest('label'); if (p) return texteVisible(p, 50);
    } catch (_) {}
    return '';
  }
  // TOUTES les listes déroulantes de la page : les `<select>` natifs ET les
  // composants. `forme` dit laquelle des deux, pour que la prochaine passe vise
  // juste au lieu de supposer.
  function listesDeroulantes() {
    const out = [];
    try {
      tousLesNoeuds('select').filter(estDuDepot).forEach((el) => {
        const opts = Array.from(el.options || []);
        out.push({ forme: 'select', name: el.name || '', id: el.id || '', label: libelleDe(el),
          choisi: (el.selectedIndex >= 0 && opts[el.selectedIndex] ? String(opts[el.selectedIndex].textContent || '').trim().slice(0, 40) : ''),
          options: opts.slice(0, 25).map((o) => String(o.textContent || '').trim().slice(0, 40)) });
      });
    } catch (_) {}
    try {
      // Les composants : ce qu'une page React expose vraiment.
      tousLesNoeuds('[role="combobox"], [role="listbox"], [aria-haspopup="listbox"], [aria-haspopup="menu"]').forEach((el) => {
        if (el.tagName && el.tagName.toLowerCase() === 'select') return;      // déjà pris
        // ⚠️ Mesuré : les quatre « listes » de son dépôt étaient la BARRE DE
        //    RECHERCHE de l'en-tête (« Valider votre recherche »).
        if (!estDuDepot(el)) return;
        let options = [];
        // ⚠️ Le CODE de chaque option, jamais vu jusqu'ici. Leboncoin soumet un
        //    code (`{value,label}` de fforms/fdata), pas le libellé : sans lui,
        //    la passe qui remplit Pointure/État ne peut que DEVINER (le défaut le
        //    plus coûteux du projet). On relève donc les attributs qui portent
        //    peut-être ce code — value/data-value/data-qa-id/id — pour que la
        //    prochaine passe vise le vrai code de SA page, pas un mapping supposé.
        //    LECTURE SEULE : uniquement des libellés d'options et des attributs
        //    de structure, jamais un contenu saisi (même promesse que les étapes).
        let optcodes = [];
        try {
          const id = el.getAttribute('aria-controls') || el.getAttribute('aria-owns');
          const boite = (id && document.getElementById(id)) || el.parentElement;
          if (boite) {
            const els = Array.from(boite.querySelectorAll('[role="option"], [role="menuitem"]')).slice(0, 25);
            options = els.map((o) => texteVisible(o, 40));
            optcodes = els.map((o) => ({
              t: texteVisible(o, 40),
              v: (o.getAttribute('data-value') || o.getAttribute('value') || o.getAttribute('data-qa-id')
                || o.getAttribute('data-testid') || o.id || '').slice(0, 60),
            }));
          }
        } catch (_) {}
        out.push({ forme: 'composant', name: el.getAttribute('name') || '', id: el.id || '',
          qa: el.getAttribute('data-qa-id') || el.getAttribute('data-testid') || '',
          role: el.getAttribute('role') || '', controls: !!(el.getAttribute('aria-controls') || el.getAttribute('aria-owns')),
          label: libelleDe(el), choisi: texteVisible(el, 40), options, optcodes });
      });
    } catch (_) {}
    return out;
  }
  // La catégorie sur laquelle on se trouve : le fil d'Ariane s'il existe, sinon
  // la valeur choisie d'une liste dont le libellé parle de catégorie. Vide si on
  // ne SAIT pas — on n'invente pas un chemin (§5, mieux vaut un blanc qu'un faux).
  function categorieCourante(listes) {
    try {
      const fil = document.querySelector('nav[aria-label*="il d’ariane" i], nav[aria-label*="il d\'ariane" i], nav[aria-label*="readcrumb" i], [class*="readcrumb"]');
      if (fil) { const t = texteVisible(fil, 120); if (t) return t; }
    } catch (_) {}
    const l = (listes || []).find((x) => /cat[ée]gorie|rubrique|type de bien/i.test(String(x.label || '') + ' ' + String(x.name || '')));
    return (l && l.choisi) || '';
  }


  // ══════════════════════════════════════════════════════════════════════════
  // ⚠️⚠️ CE QUI N'EST PAS LE FORMULAIRE DE DÉPÔT
  // ══════════════════════════════════════════════════════════════════════════
  // MESURÉ sur son vrai dépôt du 17 septembre, et c'est ce qui gâchait tout :
  // sur trois étapes enregistrées, **deux ne portaient que du bruit** —
  // `high-contrast-toggle`, `search-header-mobile-input`,
  // `search-header-extendable-input` (l'en-tête du site) et une volée de champs
  // cachés `id, ev, dl, rl, if, ts, iw, sw, sh, v, r` (du pistage). Les quatre
  // « listes » vues étaient la barre de recherche (« Valider votre recherche »).
  // Pendant ce temps le VRAI formulaire — catégorie, photos, prix — n'a jamais
  // été enregistré : le bruit changeait la signature et consommait les places.
  // C'est la garde `DANS_ENTETE` d'`ebay.js`, qu'il fallait ici aussi.
  const BRUIT = /high-contrast|search-header|cookie|consent|newsletter|recherche|autocomplete|^(id|ev|dl|rl|if|ts|iw|sw|sh|v|r|u|t|c)$/i;
  function estDuDepot(el) {
    try {
      if (el.type === 'hidden') return false;                     // pistage
      if (el.closest && el.closest('header, footer, nav, [role="banner"], [role="contentinfo"], [role="search"], form[action*="recherche"]')) return false;
      const cle = String(el.name || el.id || el.getAttribute('data-qa-id') || '');
      if (cle && BRUIT.test(cle)) return false;
      // Un champ qu'on ne voit pas n'est pas une étape à remplir.
      const r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      if (r && r.width === 0 && r.height === 0 && el.type !== 'file') return false;
      return true;
    } catch (_) { return true; }                                   // « pas su » ne retire rien
  }

  function captureDepositForm() {
    try {
      if (!/depos|d[ée]p[oô]t|\/ai\/|creation|nouvelle-annonce/i.test(location.href)) return;
      // La page de FIN n'est pas une étape du formulaire — mesuré : elle a
      // fourni deux des trois étapes enregistrées, et rien d'utilisable.
      if (/confirmation|merci|succes|succ[eè]s/i.test(location.href)) return;
      const fields = [];
      tousLesNoeuds('input, select, textarea').filter(estDuDepot).forEach((el) => {
        // ⚠️ AUCUNE valeur saisie : ni `el.value`, ni le texte d'un textarea.
        //    Mais on note SI le champ est déjà rempli et sa LONGUEUR — Leboncoin
        //    écrit parfois la description lui-même, et je dois savoir lesquels
        //    pour ne pas les écraser (§ « adapte face à l'auto-remplissage »).
        //    Un booléen et un nombre, jamais le texte.
        const val = (() => { try { return String(el.value || ''); } catch (_) { return ''; } })();
        // ⚠️ `multiple`/`accept` sur un champ fichier : c'est CE qui décide si on
        //    pose toutes les photos d'un coup ou une par une. On le relève pour
        //    ne plus deviner (« une seule photo se téléverse », Julien 19 sept.).
        fields.push({ tag: el.tagName.toLowerCase(), type: el.type || '', name: el.name || '', id: el.id || '', ph: el.placeholder || '', aria: el.getAttribute('aria-label') || '', label: libelleDe(el), qa: el.getAttribute('data-qa-id') || el.getAttribute('data-testid') || '', rempli: !!val.trim(), len: val.length, multiple: el.type === 'file' ? !!el.multiple : undefined, accept: el.type === 'file' ? (el.accept || '') : undefined });
      });
      const sels = listesDeroulantes();
      // ── LA LIVRAISON (« Envoi ») ────────────────────────────────────────
      // Julien, 23 sept. : « active la livraison quand tu republies, mes
      // annonces partent SANS livraison ». Mesuré : le dépôt SOUMET bien
      // `extended_attributes.shipping.shipping_types[]` — donc le contrôle
      // existe — mais il n'est PAS un <input>/<select> : c'est un composant
      // React (toggle/checkbox), que `captureDepositForm` manquait. On le
      // RELÈVE ici (libellé, rôle, état coché) — LECTURE SEULE, jamais une
      // valeur saisie — pour câbler « livraison ON » à coup sûr la prochaine
      // passe. On ne l'active PAS à l'aveugle : un poids de colis faux fait
      // payer le mauvais prix d'envoi (§ « le boost coûte de l'argent »).
      const MOTS_LIV = /livrais|envoi|coliss|mondial|remise\s*en\s*main|point\s*relais|\bpoids\b|\bweight\b|shipping|exp[eé]di|chronopost|shop2shop|\bcolis\b|\brelais\b/i;
      const livraison = [];
      try {
        tousLesNoeuds('[role="switch"],[role="checkbox"],[role="radio"],input[type="checkbox"],input[type="radio"],button,[data-qa-id]').forEach((el) => {
          if (!estDuDepot(el)) return;
          const g = (a) => { try { return (el.getAttribute && el.getAttribute(a)) || ''; } catch (_) { return ''; } };
          const lib = [libelleDe(el), g('aria-label'), el.name || el.id || g('data-qa-id'), String(el.textContent || '').slice(0, 60)].join(' ');
          if (!MOTS_LIV.test(lib)) return;
          const ac = g('aria-checked');
          livraison.push({ tag: (el.tagName || '').toLowerCase(), type: el.type || '', role: g('role'),
            name: el.name || '', id: el.id || '', qa: g('data-qa-id') || g('data-testid'),
            label: (libelleDe(el) || String(el.textContent || '').trim()).slice(0, 60),
            checked: ac || (el.checked != null ? String(!!el.checked) : '') });
        });
      } catch (_) {}
      const fileInputs = tousLesNoeuds('input[type="file"]');
      const fichiers = fileInputs.length;
      const fichiersMultiple = fileInputs.some((el) => el.multiple);
      const categorie = categorieCourante(sels);
      // La signature dédoublonne les étapes identiques — mais deux CATÉGORIES
      // donnent deux formulaires différents, donc la catégorie en fait partie.
      const signature = fields.map((f) => f.name || f.id).join('|') + '#' + sels.length + '#' + fichiers + (categorie ? '#' + categorie.slice(0, 40) : '') + (livraison.length ? '#L' + livraison.length : '');
      if (signature === derniereEtape) return;
      derniereEtape = signature;
      if (fields.length || sels.length || fichiers) {
        ordreEtape++;
        chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcForm', url: location.href,
          fields: fields.slice(0, 150), selects: sels.slice(0, 30), livraison: livraison.slice(0, 30), fichiers, fichiersMultiple,
          categorie, depot: DEPOT_ID, ordre: ordreEtape, ver: EXT_VER,
          etape: signature.slice(0, 160) });
      }
    } catch (_) {}
  }



  // ── REMPLISSAGE AUTOMATIQUE DE LA PAGE DE DEPOT ─────────────────────────
  // Leboncoin est une application a page unique : le formulaire n'existe pas
  // encore quand la page finit de charger, et il se reconstruit a chaque etape.
  // On surveille donc l'apparition des champs et on remplit des qu'ils sont la.
  // ⚠️ On remplit, on ne publie PAS : c'est toi qui relis et qui valides.
  // ⚠️ CE COMMENTAIRE DISAIT ENCORE « les photos ne peuvent pas être injectées,
  //    un navigateur interdit de remplir un champ fichier par programme » — la
  //    phrase mesurée FAUSSE le 13 septembre, dans le fichier même où je venais
  //    de l'attacher quinze lignes plus haut. `attacherPhotos` les attache, et
  //    rien ne touche son disque. *Une suppression « terminée » se vérifie sur ce
  //    qui RESTE*, commentaires compris : un commentaire faux se relit comme une
  //    règle.
  let pending = null, pendingTries = 0, pendingDone = 0, pendingTimer = null, pendingArrete = false;
  // `photosEnCours` : le fond lit (et détoure) les photos — jusqu'à 45 s. Tant
  // qu'elles ne sont pas posées, on NE clique PAS « Continuer » : l'étape photo
  // partirait sans elles.
  let photosFaites = false, photosEtat = null, photosEnCours = false;
  const lancerPhotos = () => {
    photosFaites = true; photosEnCours = true;
    attacherPhotos(pending).then((r) => { photosEtat = r; }, () => {}).finally(() => { photosEnCours = false; banner(); });
  };
  let publieFait = false, publieEtat = null;
  async function autoPrefill() {
    if (!/deposer|depot|d[ée]p[oô]t/i.test(location.href)) return;
    const r = await send({ action: 'getPending' });
    pending = (r && r.ok && r.ad) ? r.ad : null;
    if (!pending) return;
    banner();
    clearInterval(pendingTimer);
    pendingTimer = setInterval(() => {
      pendingTries++;
      const n = fillNow(pending);
      if (n > pendingDone) { pendingDone = n; banner(); }
      // Les photos : dès qu'une étape porte un champ fichier, on attache. Une
      // seule fois — ré-attacher écraserait ce qu'il vient d'ajouter lui-même.
      if (!photosFaites && champsFichier().length) lancerPhotos();
      // ⚠️ PUBLIER SANS BOOSTER — seulement pour une paire qu'IL a lancée par le
      //   bouton (`pending.publier !== false`), seulement à l'étape des boosts
      //   (mesurée), et seulement si des photos ont été ENVOYÉES (sinon Leboncoin
      //   refuse de toute façon — on ne clique pas pour rien). Une fois.
      if (!publieFait && pending.publier !== false && estEtapePublication()
          && photosEtat && (photosEtat.envoyees || photosEtat.n || 0) > 0) {
        publieFait = true;
        publierSansBooster().then((r) => {
          publieEtat = r; banner();
          if (r && r.ok) {
            clearInterval(pendingTimer);
            send({ action: 'markPosted', id: pending.id });   // sort de la file
            send({ action: 'setPending', ad: null });          // ne pas republier
          }
        });
      }
      // On s'arrete au bout de 90 s : au-dela, soit c'est rempli, soit la page
      // n'est pas celle qu'on croit — inutile de tourner en fond.
      // ⚠️ MAIS IL FAUT LE DIRE. Le dépôt Leboncoin se fait en ÉTAPES (mesuré :
      //    la première page ne porte qu'un champ, « Que proposez-vous ? ») ;
      //    choisir la catégorie, remplir l'état, arriver au prix prend plus de
      //    90 secondes. Passé ce délai, le remplissage s'arrêtait EN SILENCE :
      //    il attendait que les champs suivants se remplissent seuls, et rien ne
      //    venait. Le bandeau dit maintenant que c'est à lui de cliquer.
      if (pendingTries > 90) { clearInterval(pendingTimer); pendingArrete = true; banner(); }
    }, 1000);
  }
  // ── LES MENUS D'ATTRIBUTS DE LEBONCOIN sont des COMPOSANTS React (mesuré sur
  //    le vrai dépôt de Julien, `lbc_recon.etapes`) : un `[role="combobox"]`
  //    (`:form-field-_r_XX_`) + une liste `[role="option"]`. `choisirListe` ne
  //    voyait que les `<select>` natifs → il ne remplissait RIEN (« ça ne met pas
  //    la catégorie ni le reste »). `choisirComposant` OUVRE le menu et CLIQUE
  //    l'option — exactement le geste d'un humain, pas une valeur posée en douce.
  //    ⚠️ Les identifiants `_r_XX_` CHANGENT à chaque rendu React : on trouve le
  //    menu par son LIBELLÉ, jamais par un id figé.
  function labelCombobox(el) {
    let lbl = el.getAttribute('aria-label') || '';
    const lb = el.getAttribute('aria-labelledby');
    if (lb) { try { for (const id of lb.split(/\s+/)) { const e = document.getElementById(id); if (e) lbl += ' ' + (e.innerText || ''); } } catch (_) {} }
    const id = el.getAttribute('id');
    if (id) { try { const l = document.querySelector('label[for="' + ((window.CSS && CSS.escape) ? CSS.escape(id) : id) + '"]'); if (l) lbl += ' ' + (l.innerText || ''); } catch (_) {} }
    const f = el.closest('div,fieldset,section'); if (f) { const l = f.querySelector('label'); if (l) lbl += ' ' + (l.innerText || ''); }
    return lbl.toLowerCase();
  }
  async function choisirComposant(motif, valeurExacte) {
    // ⚠️ CORRESPONDANCE EXACTE, une seule valeur — jamais « le premier qui
    //    ressemble » ni un « premier de la liste ». Aucune option exacte ⇒ on
    //    laisse VIDE (mieux vaut un blanc qu'un faux, §5) : un attribut faux sur
    //    une annonce publiée est le coût le plus élevé du projet.
    const cible = String(valeurExacte || '').trim();
    if (!cible) return false;
    const boxes = Array.from(document.querySelectorAll('[role="combobox"]')).filter((el) => !DANS_ENTETE(el));
    for (const box of boxes) {
      if (!motif.test(labelCombobox(box))) continue;
      const val = String(box.value || box.getAttribute('data-choisi') || '').trim();
      if (val) return false;                          // déjà choisi : on ne touche pas
      try { box.focus(); box.click(); } catch (_) {}
      await new Promise((r) => setTimeout(r, 160));    // le menu React s'ouvre
      const opt = Array.from(document.querySelectorAll('[role="option"]'))
        .find((o) => String(o.textContent || '').trim().toLowerCase() === cible.toLowerCase());
      if (opt) { try { opt.click(); } catch (_) {} return true; }
      try { box.blur(); } catch (_) {}                 // referme le menu, rien choisi
      return false;
    }
    return false;
  }
  // On ne remplit ces menus qu'UNE fois par paire (l'observateur du formulaire
  // rappelle fillNow à chaque mutation — sans ça on ré-ouvrirait le menu en
  // boucle). Réinitialisé par « Re-remplir » (fillNowForce).
  let _composFaits = new Set(); let _composEnCours = false;
  async function remplirComposants(ad) {
    if (_composEnCours) return 0; _composEnCours = true;
    let k = 0;
    try {
      const cle = (q) => String(ad.id) + ':' + q;
      // POINTURE : sa taille Vinted (« 40.5 » → « 40,5 » côté Leboncoin).
      const taille = String(ad.taille || '').trim().replace('.', ',');
      if (taille && !_composFaits.has(cle('p')) && await choisirComposant(/pointure|taille|size/, taille)) { _composFaits.add(cle('p')); k++; }
      // ÉTAT : son état Vinted, par correspondance EXACTE. « Satisfaisant »
      // (Vinted) ≠ « État satisfaisant » (Leboncoin) : pas de correspondance
      // exacte ⇒ laissé vide, exprès.
      const etat = String(ad.etat || '').trim();
      if (etat && !_composFaits.has(cle('e')) && await choisirComposant(/[ée]tat|condition/, etat)) { _composFaits.add(cle('e')); k++; }
    } catch (_) {}
    _composEnCours = false;
    if (k) toast('👟 ' + k + ' menu' + (k > 1 ? 's' : '') + ' rempli' + (k > 1 ? 's' : '') + ' (pointure / état)');
    return k;
  }
  // ── LA LIVRAISON — Julien, 23 sept. : « active la livraison quand tu
  //    republies » puis « pour mon cas c'était activé par défaut ». On GARANTIT
  //    donc que l'interrupteur maître d'envoi reste ACTIVÉ, sans jamais toucher
  //    au POIDS ni aux méthodes (Leboncoin garde ses valeurs par défaut, celles
  //    qu'il utilise déjà — un poids faux coûterait de l'argent, §3/§5).
  //    Sûr par construction : on n'agit QUE sur un contrôle au libellé
  //    clairement « livraison/envoi », et SEULEMENT s'il est ÉTEINT ; sinon
  //    on ne touche à rien (déjà activé, illisible, ou absent → no-op).
  const MOTS_LIV_MAITRE = /proposer\s+la\s+livraison|je\s+propose\s+la\s+livraison|activer\s+la\s+livraison|mode\s+d.envoi|^\s*livraison\s*$|^\s*envoi\s*$/i;
  function activerLivraison() {
    try {
      const cands = tousLesNoeuds('[role="switch"],[role="checkbox"],input[type="checkbox"]').filter(estDuDepot);
      for (const el of cands) {
        const g = (a) => { try { return (el.getAttribute && el.getAttribute(a)) || ''; } catch (_) { return ''; } };
        const lib = [libelleDe(el), g('aria-label'), String(el.textContent || '').slice(0, 60)].join(' ');
        if (!MOTS_LIV_MAITRE.test(lib)) continue;
        const ac = g('aria-checked');
        const connu = ac === 'true' || ac === 'false' || typeof el.checked === 'boolean';
        if (!connu) return 'illisible';                          // état inconnu → on ne touche pas
        const on = ac === 'true' || (ac === '' && el.checked === true);
        if (on) return 'deja';                                   // déjà activée (son défaut) → rien
        try { el.click(); } catch (_) {}                         // éteinte → on l'active (clic humain)
        return 'active';
      }
      return 'absent';
    } catch (_) { return 'absent'; }
  }
  // ── LA CATÉGORIE — mesuré au RENDU (capture d'écran de Julien, 20 sept.) :
  //    c'est des BOUTONS RADIO (« Mode > Chaussures », « Loisirs > Sport »,
  //    « Mode > Vêtements »), pas une liste. On clique celui qui correspond à sa
  //    catégorie (`ad.category`, « Chaussures » pour ses paires). Repli : la
  //    liste « Ou choisissez une autre catégorie » (un composant), au cas où
  //    aucune suggestion ne colle.
  function choisirCategorie(ad) {
    // ⚠️ Plus de défaut « Chaussures » : catégorie inconnue ⇒ on ne coche RIEN,
    //    Leboncoin la propose (il la devine du titre) et l'utilisateur choisit.
    //    Un reseller qui ne fait pas de chaussures ne doit pas voir « Chaussures »
    //    cochée à sa place (Julien, 20 sept.).
    const cat = String(ad.category || '').trim().toLowerCase();
    if (!cat) return false;
    const radios = Array.from(document.querySelectorAll('input[type="radio"],[role="radio"]')).filter((el) => !el.disabled && !DANS_ENTETE(el));
    for (const rb of radios) {
      let lab = (libelleDe(rb) || '').toLowerCase();
      if (!lab) { const c = rb.closest('label,li,div,button'); if (c) { try { lab = (c.innerText || '').toLowerCase(); } catch (_) {} } }
      if (lab.includes(cat)) {
        if (rb.checked || rb.getAttribute('aria-checked') === 'true') return false;
        try { rb.click(); } catch (_) {}
        return true;
      }
    }
    return false;
  }
  // ⚠️⚠️ JAMAIS « Publier » — on n'AVANCE que d'une étape (§3/§5 : aucune
  //    publication à l'aveugle). On n'accepte QUE « Continuer »/« Suivant », et
  //    on écarte tout bouton qui publie, dépose, valide, paye ou finalise.
  const BTN_PUBLIER = /publier|d[ée]poser|mettre en ligne|payer|valider|confirmer|finaliser|en ligne/i;
  const BTN_AVANCER = /continuer|suivant|[ée]tape suivante/i;
  function cliquerContinuer() {
    const btns = Array.from(document.querySelectorAll('button,[role="button"],input[type="submit"],a[role="button"]')).filter((el) => !DANS_ENTETE(el));
    for (const b of btns) {
      const t = (((b.innerText || b.value || '') + ' ' + (b.getAttribute('aria-label') || '')) || '').trim();
      if (!t) continue;
      if (BTN_PUBLIER.test(t)) continue;              // ⚠️ on ne publie jamais tout seul
      if (BTN_AVANCER.test(t)) {
        if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
        try { b.click(); } catch (_) {}
        return true;
      }
    }
    return false;
  }
  // Enchaîne les étapes tout seul : après avoir rempli ce qu'on peut, on clique
  // « Continuer ». Une fois par étape (signature), quelques essais puis on cède —
  // si ça n'avance pas, c'est qu'un champ OBLIGATOIRE qu'on ne devine pas manque
  // (ex. Univers/Type) : on le DIT plutôt que de tourner en rond.
  let _avanceFaite = new Set(); const _avanceEssais = {}; let _avanceEnCours = false;
  async function avancer() {
    // Une étape qui porte un champ photo n'avance pas avant que les photos soient
    // POSÉES (elles peuvent mettre 45 s à revenir du détourage).
    const photosAttendues = () => photosEnCours || (!photosFaites && champsFichier().length > 0);
    if (_avanceEnCours || photosAttendues()) return; const sig = derniereEtape; if (!sig || _avanceFaite.has(sig)) return;
    const n = (_avanceEssais[sig] = (_avanceEssais[sig] || 0) + 1);
    if (n > 4) { if (n === 5) toast('⚠️ Un champ obligatoire reste à choisir (ex. Univers) — fais-le, je continue'); return; }
    _avanceEnCours = true;
    try { await attendre(1100); if (!photosAttendues() && cliquerContinuer()) { _avanceFaite.add(sig); toast('→ étape suivante'); } } catch (_) {}
    _avanceEnCours = false;
  }
  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIER — SANS BOOSTER (Julien, 20 sept. : « c'est toi qui appuies sur
  // publier sans booster, ça me dérange pas »). C'est SA décision d'owner.
  // ⚠️⚠️ LE BOOST = DE L'ARGENT. La seule erreur pire qu'un clic manuel serait de
  //   cocher un boost. Mesuré (`lbc_recon.etapes`) : l'étape options ne porte que
  //   des CASES À COCHER de boost (gallery, daily_bump, sub_toplist, urgent…),
  //   toutes inspectables. La garantie « sans booster » est donc SÛRE :
  //   1) on DÉCOCHE toute option payante ; s'il en reste une cochée → on NE
  //      publie pas (on le dit) ;
  //   2) on clique un bouton de publication GRATUITE — jamais un bouton qui porte
  //      un PRIX (€ / 9,90) ni « booster/remonter/payer/premium/pack/option ».
  //   Au pire (bouton introuvable, forme inconnue) : rien n'est cliqué, il publie
  //   à la main — jamais un faux, jamais une dépense.
  function optionsBoost() {
    return Array.from(document.querySelectorAll('input[type="checkbox"],[role="checkbox"],[role="switch"]')).filter((cb) => {
      if (DANS_ENTETE(cb)) return false;
      const n = ((cb.name || '') + ' ' + (cb.id || '') + ' ' + (cb.getAttribute('aria-label') || '') + ' ' + (libelleDe(cb) || '')).toLowerCase();
      return /(gallery|galerie|bump|remont|toplist|top.?liste|urgent|boost|mise en avant|premium|\bpack\b|photos?\s*suppl)/.test(n);
    });
  }
  const estCoche = (cb) => cb.checked || cb.getAttribute('aria-checked') === 'true';
  async function publierSansBooster() {
    // 1) décocher toute option payante.
    for (const cb of optionsBoost()) if (estCoche(cb)) { try { cb.click(); } catch (_) {} }
    await attendre(450);
    if (optionsBoost().some(estCoche)) return { ok: false, raison: 'une option payante n\'a pas pu être décochée — publie toi-même, sans booster' };
    // 2) le bouton de publication GRATUITE, jamais un bouton payant.
    const PRIX = /€|\beuros?\b|\d[.,]\d{2}|booster|remont|payer|premium|\bpack\b|\boption/i;
    const PUBLIER = /publier|d[ée]poser\s+(?:mon|l)|d[ée]poser l['’]annonce|mettre en ligne|valider\s+(?:mon|l['’])\s*annonce/i;
    const NEG = /annuler|retour|pr[ée]c[ée]dent|revenir|\bback\b|supprim|brouillon|plus tard|aper[çc]u|pr[ée]visualis/i;
    const CONTINUER = /continuer|suivant/i;
    const libBtn = (b) => (((b.innerText || b.value || '') + ' ' + (b.getAttribute('aria-label') || '')) || '').trim();
    const actif = (b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true' && !!libBtn(b);
    // ⚠️ On exclut NOTRE PROPRE interface (bandeau/témoin VRM) : sinon la
    //   recherche du bouton « le plus bas » cliquerait un bouton de notre bandeau,
    //   pas celui de Leboncoin (le bandeau est en position fixe, tout en bas).
    const NOTRE_UI = (el) => !!el.closest('#vrm-lbc-banner,#vrm-badge,[data-vrm]');
    const btns = Array.from(document.querySelectorAll('button,[role="button"],input[type="submit"]')).filter((el) => !DANS_ENTETE(el) && !NOTRE_UI(el));
    let publier = btns.find((b) => {
      if (!actif(b)) return false;
      if (PRIX.test(libBtn(b))) return false;         // paie / boost → jamais
      return PUBLIER.test(libBtn(b));
    });
    // Julien 20 sept. : « le clic Publier est tout en bas de la page ; même si tu
    // ne l'as pas, essaie de le deviner ». On tente donc le bouton le PLUS BAS de
    // l'étape — mais la garde ARGENT ne bouge pas : jamais un bouton à prix ou à
    // boost (PRIX), jamais « annuler/retour/aperçu » (NEG), jamais « Continuer »
    // (géré par l'enchaînement des étapes). Au pire rien n'est dépensé, jamais un faux.
    if (!publier) {
      const surs = btns.filter((b) => { const t = libBtn(b); return actif(b) && !PRIX.test(t) && !NEG.test(t) && !CONTINUER.test(t); });
      surs.sort((a, b) => a.getBoundingClientRect().bottom - b.getBoundingClientRect().bottom);
      publier = surs[surs.length - 1] || null;
    }
    if (!publier) return { ok: false, raison: 'bouton « Publier » introuvable sur cette étape' };
    try { publier.click(); } catch (_) {}
    return { ok: true, bouton: ((publier.innerText || publier.value || '') + '').trim().slice(0, 40) };
  }
  // On est à l'étape de publication quand l'étape des boosts (cases mesurées) est
  // là : c'est la dernière, tout le reste a été rempli pour y arriver.
  const estEtapePublication = () => optionsBoost().length > 0;
  function fillNow(ad) {
    let n = 0;
    if (setIfEmpty(findField([/titre|title|subject|proposez/]), ad.title)) n++;
    { const d = poserDescription(ad); if (d.fait || d.ref) n++; }   // jamais d'écrasement ; la réf est garantie
    if (poserPrix(ad.price, true)) n++;   // §11 : le prix a UNE règle (centimes), une seule
    if (setIfEmpty(findField([/référ|referen|\bref\b|\bsku\b|identifiant|code.?article|numéro.?article/]), ad.ref || ('VRM-' + ad.numero))) n++;
    // ⚠️ « ça ne met pas la catégorie ni le reste » (Julien, 13 septembre). Les
    //    listes déroulantes ne sont pas des `input` : `findField` ne les voyait
    //    même pas. `choisirListe` couvre le cas d'un `<select>` natif (repli),
    //    `remplirComposants` (async, ci-dessous) couvre les COMPOSANTS React —
    //    la vraie forme mesurée sur son dépôt. On ne choisit QUE si une option
    //    correspond VRAIMENT — sinon on laisse vide (une catégorie fausse fait
    //    plus de mal que pas de catégorie, leçon eBay).
    if (ad.category && choisirListe([/cat[ée]gorie|category|rubrique/], [ad.category])) n++;
    if (choisirListe([/[ée]tat|condition|state/], [ad.etat])) n++;
    if (choisirListe([/marque|brand/], [ad.marque])) n++;
    if (choisirListe([/pointure|taille|size/], [ad.taille])) n++;
    // La CATÉGORIE — des boutons RADIO (« Mode > Chaussures »…), mesuré au rendu.
    if (choisirCategorie(ad)) n++;
    // Les menus React (pointure, état) — sans bloquer le comptage synchrone.
    remplirComposants(ad);
    if (activerLivraison() === 'active') n++;   // garantir l'envoi activé (son défaut)
    // Puis on enchaîne l'étape : clic « Continuer » (JAMAIS « Publier »).
    avancer();
    return n;
  }
  // Une liste déroulante : on ne prend une option que si son libellé contient
  // vraiment ce qu'on cherche. Aucune approximation, aucun « premier de la
  // liste » — laisser vide est toujours préférable à choisir faux (§5).
  function choisirListe(motifs, valeurs) {
    const sels = Array.from(document.querySelectorAll('select')).filter((el) => !el.disabled && !DANS_ENTETE(el));
    for (const m of motifs) {
      for (const el of sels) {
        const lab = (el.labels && el.labels[0] && el.labels[0].innerText) || '';
        const hay = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + lab).toLowerCase();
        if (!m.test(hay)) continue;
        if (String(el.value || '').trim()) return false;          // déjà choisi : on ne touche pas
        for (const v of (valeurs || [])) {
          const cible = String(v || '').trim().toLowerCase();
          if (!cible) continue;
          const opt = Array.from(el.options || []).find((o) => {
            const t = String(o.textContent || '').trim().toLowerCase();
            return t === cible || (t.length > 2 && cible.includes(t)) || (cible.length > 2 && t.includes(cible));
          });
          if (opt) {
            el.value = opt.value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;                                             // trouvé le champ, aucune option qui colle
      }
    }
    return false;
  }
  // On ne remplit QUE les champs vides : sinon, a chaque passage, on effacerait
  // ce que tu viens de corriger a la main.
  function setIfEmpty(el, val) {
    if (!el || !val) return false;
    if (String(el.value || '').trim()) return false;
    return setField(el, val);
  }
  // La description : Leboncoin l'écrit PARFOIS lui-même (Julien, 19 sept.). On ne
  // l'écrase JAMAIS — mais la référence VRM-{n°} doit y être : c'est elle qui
  // relie l'annonce à la paire, sans rapprochement par titre (§5). Sinon
  // « vendue sur Vinted → retire-la » ne reconnaît plus l'annonce.
  //  • champ VIDE → on met la description complète (elle porte déjà la réf) ;
  //  • champ DÉJÀ REMPLI (Leboncoin ou lui) → on GARDE son texte et on ajoute la
  //    réf à la fin, UNE seule fois (jamais un doublon).
  // Rend { fait, garde, ref } pour que le bandeau dise ce qui s'est passé.
  function poserDescription(ad) {
    const el = findField([/description|texte|body|détail|detail/]);
    if (!el) return { trouve: false, fait: false, garde: false, ref: false };
    const ref = ad.ref || ('VRM-' + ad.numero);
    const actuel = String(el.value || '');
    if (!actuel.trim()) { const ok = setField(el, ad.description); return { trouve: true, fait: ok, garde: false, ref: /VRM-(?:[A-Z]{1,3})?\d/i.test(ad.description) }; }
    // La réf ENTIÈRE, jamais un morceau : « VRM-12 » n'est pas dans « VRM-125 ».
    const dejaRef = new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![0-9A-Z])', 'i').test(actuel);
    if (dejaRef) return { trouve: true, fait: false, garde: true, ref: true };
    const ok = setField(el, actuel.replace(/\s+$/, '') + '\n\nRéférence : ' + ref);
    return { trouve: true, fait: false, garde: true, ref: ok };
  }
  function banner() {
    let el = document.getElementById('vrm-lbc-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'vrm-lbc-banner';
      el.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147483646;max-width:300px;background:#10141B;color:#E8ECF2;border:1px solid #1E2530;border-radius:12px;padding:12px 14px;font:12px/1.5 -apple-system,system-ui,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.35),0 16px 40px rgba(0,0,0,.36)';
      document.documentElement.appendChild(el);
    }
    el.innerHTML =
      '<div style="font-weight:700;font-size:13px;margin-bottom:3px">N°' + esc(String(pending.numero || '?')) + ' — ' + esc(String(pending.title || '').slice(0, 46)) + '</div>' +
      '<div style="color:#8A93A3">' + pendingDone + ' champ' + (pendingDone > 1 ? 's' : '') + ' rempli' + (pendingDone > 1 ? 's' : '') +
      '. Catégorie <b style="color:#E8ECF2">' + esc(pending.category || '—') + '</b>.</div>' +
      '<div style="color:#8A93A3;margin-top:3px">' + (photosEtat
        ? (photosEtat.n > 0
            // On dit ce qu'on SAIT : « confirmées » quand on a pu compter les
            // vignettes, sinon « envoyées » + vérifie (les vignettes de Leboncoin
            // ne sont pas comptables de l'extérieur — mesuré le 20 sept.).
            ? (photosEtat.confirmees != null
                ? '📷 <b style="color:#E8ECF2">' + photosEtat.confirmees + '/' + photosEtat.total + ' photo' + (photosEtat.total > 1 ? 's' : '') + ' attachée' + (photosEtat.confirmees > 1 ? 's' : '') + '</b>'
                : '📷 <b style="color:#E8ECF2">' + photosEtat.envoyees + ' photo' + (photosEtat.envoyees > 1 ? 's' : '') + ' envoyée' + (photosEtat.envoyees > 1 ? 's' : '') + '</b> au formulaire — <b style="color:#F5A524">vérifie qu\'elles y sont toutes</b> avant de publier')
              + (photosEtat.rates ? ' (' + photosEtat.rates + ' illisible' + (photosEtat.rates > 1 ? 's' : '') + ')' : '')
              + (photosEtat.detourees ? ', dont <b style="color:#E8ECF2">' + photosEtat.detourees + ' détourée' + (photosEtat.detourees > 1 ? 's' : '') + '</b> (fond blanc)' : '')
              + (photosEtat.detourageRaison && !(photosEtat.detourees && photosEtat.detourageRaison === 'pas-une-photo')
                  ? '<br><span style="color:#8A93A3">Fond d\'origine gardé : ' + esc(raisonDetourage(photosEtat.detourageRaison)) + '.</span>' : '')
              + (photosEtat.total <= 6 ? '<br><span style="color:#F5A524">Seules ' + photosEtat.total + ' photos sont captées de Vinted : rouvre l\'annonce sur Vinted (extension à jour) pour les avoir toutes.</span>' : '')
            : '📷 aucune photo attachée — ' + esc(photosEtat.raison || 'raison inconnue'))
        : '📷 j\'attache les photos dès que l\'étape photo s\'affiche.') + '</div>' +
      // Statut de PUBLICATION : ce qui compte, dit clairement.
      (publieEtat
        ? '<div style="margin-top:6px">' + (publieEtat.ok
            ? '✅ <b style="color:#E8ECF2">Publiée sans booster.</b>'
            : '<span style="color:#F5A524">Je n\'ai pas publié — ' + esc(publieEtat.raison || 'à faire toi-même') + '.</span>') + '</div>'
        : '') +
      (pendingArrete && !(publieEtat && publieEtat.ok)
        ? '<div style="color:#F5A524;margin-top:6px">Le dépôt se fait en étapes ; si une nouvelle étape s\'affiche, clique <b style="color:#E8ECF2">↻ Reprendre</b>.</div>'
        : '') +
      '<div style="display:flex;gap:6px;margin-top:9px">' +
      (pendingArrete && !(publieEtat && publieEtat.ok)
        ? '<button id="vrm-refill" style="flex:1;border:1px solid #1E2530;background:transparent;color:#E8ECF2;border-radius:9px;padding:7px;font-size:11.5px;font-weight:600;cursor:pointer">↻ Reprendre</button>'
        : '') +
      '<button id="vrm-close" title="Fermer" style="border:1px solid #1E2530;background:transparent;color:#8A93A3;border-radius:9px;padding:7px 11px;font-size:11.5px;cursor:pointer">✕</button>' +
      '</div>' +
      '<div style="color:#6B7485;font-size:10px;margin-top:7px">VRM remplit tout et publie <b>sans booster</b> (aucune option payante). Tu peux relire avant que ça parte.</div>';
    const refill = el.querySelector('#vrm-refill');
    if (refill) refill.onclick = () => {
      pendingDone = fillNowForce(pending);
      pendingArrete = false; pendingTries = 0; publieFait = false;
      // « Reprendre » rend ses essais à l'enchaînement des étapes (sinon une étape
      // tentée 4 fois pendant le détourage resterait bloquée pour toujours).
      for (const k of Object.keys(_avanceEssais)) delete _avanceEssais[k];
      clearInterval(pendingTimer);
      pendingTimer = setInterval(() => {
        pendingTries++;
        const n2 = fillNow(pending);
        if (n2 > pendingDone) { pendingDone = n2; banner(); }
        if (!photosFaites && champsFichier().length) lancerPhotos();
        if (!publieFait && pending.publier !== false && estEtapePublication() && photosEtat && (photosEtat.envoyees || photosEtat.n || 0) > 0) {
          publieFait = true;
          publierSansBooster().then((r) => { publieEtat = r; banner(); if (r && r.ok) { clearInterval(pendingTimer); send({ action: 'markPosted', id: pending.id }); send({ action: 'setPending', ad: null }); } });
        }
        if (pendingTries > 90) { clearInterval(pendingTimer); pendingArrete = true; banner(); }
      }, 1000);
      banner();
    };
    el.querySelector('#vrm-close').onclick = () => { clearInterval(pendingTimer); el.remove(); send({ action: 'setPending', ad: null }); };
  }
  function fillNowForce(ad) {
    let n = 0;
    if (setField(findField([/titre|title|subject/]), ad.title)) n++;
    { const d = poserDescription(ad); if (d.fait || d.ref) n++; }   // même face à « Re-remplir » : on n'écrase pas l'auto-description de Leboncoin
    if (poserPrix(ad.price)) n++;   // §11 : la même règle de prix que partout
    if (setField(findField([/référ|referen|\bref\b|\bsku\b|identifiant|code.?article|numéro.?article/]), ad.ref || ('VRM-' + ad.numero))) n++;
    if (choisirCategorie(ad)) n++;
    // « Re-remplir » relance aussi les menus React et l'enchaînement d'étape
    // (on oublie qu'on les a déjà faits, au cas où on serait revenu en arrière).
    _composFaits = new Set(); remplirComposants(ad);
    if (activerLivraison() === 'active') n++;
    _avanceFaite = new Set(); avancer();
    return n;
  }

  // Le démarrage : capter, et — sur une page de dépôt lancée depuis l'APP —
  // remplir et publier. Plus de panneau ni de liste à charger (5.130).
  function demarrer() {
    autoPrefill();
    captureLbcListings();
    captureDepositForm();
  }
  if (!DANS_UN_CADRE) {
    demarrer();
    // Leboncoin est une SPA : on relit après une navigation interne, et au
    // retour sur l'onglet.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) demarrer(); });
    let lastUrl = location.href;
    setInterval(() => { if (location.href !== lastUrl) { lastUrl = location.href; setTimeout(demarrer, 1200); } }, 2000);
  } else {
    // Dans un cadre : la seule chose qui compte est d'enregistrer l'étape.
    captureDepositForm();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LES ÉTAPES DU DÉPÔT SE SUIVENT SANS CHANGER D'ADRESSE
  // ══════════════════════════════════════════════════════════════════════════
  // ⚠️⚠️ `captureDepositForm()` ne tournait QUE dans `load()` — c'est-à-dire au
  //    démarrage, au retour sur l'onglet, et quand `location.href` CHANGE. Or le
  //    dépôt Leboncoin est un assistant : il remplace l'étape **sur place**,
  //    sans toucher à l'adresse. Les étapes 2, 3, 4… n'étaient donc jamais
  //    enregistrées — exactement la seule chose pour laquelle ce code existe.
  //    Et ça colle à la mesure : `lbc_recon.form` porte UNE étape (le titre),
  //    écrite le 13 septembre, et rien d'autre depuis le 2 août.
  // ⇒ On regarde le FORMULAIRE, pas l'URL. La signature dédoublonne déjà, donc
  //   réobserver ne coûte rien ; ce qui coûterait, c'est une étape manquée.
  // ⚠️ BORNÉ : uniquement sur les pages de dépôt, au plus une capture par
  //    seconde, et on s'arrête après 12 étapes distinctes — un assistant n'en a
  //    pas trente, et une page qui mute sans fin ne doit pas nous faire tourner
  //    en boucle.
  (function surveillerLesEtapes() {
    try {
      if (!/depos|d[ée]p[oô]t|\/ai\/|creation|nouvelle-annonce/i.test(location.href)) return;
      let enAttente = null, vues = 0;
      const MAX_ETAPES = 24;   // le bruit en consommait la moitié (mesuré)
      const obs = new MutationObserver(() => {
        if (vues >= MAX_ETAPES) { try { obs.disconnect(); } catch (_) {} return; }
        if (enAttente) return;
        enAttente = setTimeout(() => {
          enAttente = null;
          const avant = derniereEtape;
          captureDepositForm();
          if (derniereEtape !== avant) vues++;   // une étape VRAIMENT nouvelle
        }, 1000);
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) { /* pas d'observateur : on garde le comportement d'avant */ }
  })();
})();
