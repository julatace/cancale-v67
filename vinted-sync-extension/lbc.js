// lbc.js — Assistant Leboncoin (tourne sur leboncoin.fr, dans TON navigateur).
//
// Il ne publie RIEN tout seul : il te PRÉPARE le travail. Il lit les annonces
// Vinted en ligne (déjà moissonnées + détaillées par l'extension), et pour
// chacune il affiche une annonce Leboncoin prête (titre, description avec le N°,
// prix, catégorie, photos). Tu ouvres « Déposer une annonce », tu peux
// pré-remplir le formulaire ou copier chaque champ, tu vérifies, et c'est TOI
// qui cliques sur « Publier ». Un humain publie → pas de risque pour ton compte.
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
  }, false);

  let queue = [];
  let removals = []; // paires vendues sur Vinted → à retirer de Leboncoin
  let unlinked = []; // annonces LBC que VRM n'a pas su relier à une paire connue
  let ventes = []; // ses ventes Leboncoin captées (état + bordereau), lecture seule
  let stats = { postedCount: 0, lbcCount: 0, limit: null, plan: null, detected: null }; // compteur d'annonces LBC + offre
  let loadError = false; // vrai si getQueue a échoué (≠ file vide)
  let postedList = []; // paires marquées « publiées » (pour annuler une erreur)
  let showPosted = false;
  let photoRes = null; // { numero, title, photos:[...] } — photos d'une paire à envoyer à un acheteur
  let pageRefs = new Set(); // NOS numéros (VRM-X) déjà repérés sur la page Leboncoin
  // Lit toute l'annonce (titre + description) de la page courante et récupère nos
  // références « VRM-{num} ». Marche pour un compte PRO comme normal : on lit
  // NOTRE jeton, pas la numérotation Leboncoin. Sert à savoir ce qui est déjà en ligne.
  function scanPageRefs() {
    const s = new Set();
    try {
      const txt = (document.body && document.body.innerText || '').slice(0, 500000);
      const re = /VRM[-\s]?(\d{1,5})/gi; let m;
      while ((m = re.exec(txt))) s.add(m[1]);
    } catch (_) {}
    pageRefs = s;
  }

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
                ref: (body.match(/VRM[-\s]?(\d{1,5})/i) || [])[1] || (String(node.subject || '').match(/VRM[-\s]?(\d{1,5})/i) || [])[1] || null,
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
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;';
  const root = host.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(host);

  // ⚠️ DESIGN — Julien : « j'aime pas trop les couleurs ni les boutons, ça fait
  //    un peu simple ». On aligne le panneau sur la SIGNATURE de VRM (§7) :
  //    encre ardoise #10151B, UNE seule couleur d'accent (bleu #1E5FCC, rare),
  //    fond gris froid #F6F7F9, cartes blanches, rayons 8/10/12/14, ombres à
  //    deux couches (contact serré + diffusion large et pâle). Plus d'orange
  //    Leboncoin partout. Boutons : UNE seule forme (hauteur, rayon, graisse) —
  //    la dispersion est ce qui se lit « pas fini », pas la couleur.
  const css = `
    *{box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,sans-serif}
    .fab{background:#10151b;color:#fff;border:none;border-radius:999px;padding:11px 17px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 1px 2px rgba(16,21,27,.16),0 8px 24px rgba(16,21,27,.22);display:flex;align-items:center;gap:8px;letter-spacing:.2px}
    .fab .b{background:#1e5fcc;color:#fff;border-radius:999px;min-width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;padding:0 6px}
    .panel{width:384px;max-width:92vw;max-height:82vh;background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(16,21,27,.14),0 16px 44px rgba(16,21,27,.22);overflow:hidden;display:flex;flex-direction:column}
    .hd{background:#10151b;color:#fff;padding:13px 15px;display:flex;align-items:center;gap:8px}
    .hd .t{font-size:14px;font-weight:800;flex:1;letter-spacing:.2px}
    .hd button{background:rgba(255,255,255,.16);color:#fff;border:none;width:28px;height:28px;border-radius:999px;font-size:16px;cursor:pointer}
    .body{overflow:auto;padding:11px;background:#f6f7f9}
    .empty{padding:26px 16px;text-align:center;color:#6b7684;font-size:13px;line-height:1.5}
    .card{background:#fff;border:1px solid #e6e8eb;border-radius:12px;padding:11px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,21,27,.05)}
    /* ⚠️ « flouter pour dire que je l'ai déjà publié » (Julien) : une paire
       déjà en ligne sur Leboncoin est estompée, pour ne pas la republier. */
    .card.deja{opacity:.5;filter:grayscale(.55)}
    .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .num{background:#10151b;color:#fff;border-radius:999px;font-size:11px;font-weight:800;padding:2px 9px}
    .cat{background:#eef1f6;color:#3a4351;border-radius:999px;font-size:10.5px;font-weight:700;padding:2px 9px}
    .done{background:#e9f0fb;color:#1e5fcc;border-radius:999px;font-size:10.5px;font-weight:800;padding:2px 9px}
    .acc{color:#8a919c;font-size:10.5px;font-weight:700;margin-left:auto}
    .tt{font-size:13.5px;font-weight:700;color:#10151b;margin-top:8px;line-height:1.35}
    .pr{font-size:15px;font-weight:800;color:#10151b;margin-top:2px}
    .ph{display:flex;gap:5px;margin-top:8px;overflow-x:auto}
    .ph img{width:52px;height:52px;object-fit:cover;border-radius:8px;flex-shrink:0;cursor:pointer;border:1px solid #e6e8eb}
    .desc{font-size:11.5px;color:#3a4351;white-space:pre-wrap;background:#f6f7f9;border-radius:8px;padding:8px;margin-top:8px;max-height:110px;overflow:auto}
    .btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
    .btn{border:1px solid #dce0e6;background:#fff;color:#10151b;border-radius:8px;padding:7px 11px;font-size:12px;font-weight:700;cursor:pointer;min-height:32px;transition:background .12s,border-color .12s}
    .btn:hover{border-color:#c3c9d2}
    .btn.p{background:#1e5fcc;color:#fff;border-color:#1e5fcc}
    .btn.p:hover{background:#1a54b6;border-color:#1a54b6}
    .btn.g{background:#fff;color:#1e5fcc;border-color:#1e5fcc}
    .btn[disabled]{opacity:.5;cursor:not-allowed}
    .hint{font-size:10.5px;color:#8a919c;padding:4px 2px 8px;line-height:1.45}
    .toast{position:fixed;left:50%;bottom:80px;transform:translateX(-50%);background:#10151b;color:#fff;padding:10px 15px;border-radius:10px;font-size:12.5px;font-weight:600;opacity:0;transition:opacity .2s;z-index:2147483647;box-shadow:0 8px 24px rgba(16,21,27,.28)}
    .remsec{border:1px solid #e6e8eb;background:#fff;border-radius:12px;padding:9px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,21,27,.05)}
    .remhd{font-size:12px;font-weight:800;color:#10151b;margin-bottom:6px}
    .rem{display:flex;align-items:center;gap:8px;background:#f6f7f9;border:1px solid #e6e8eb;border-radius:9px;padding:7px 9px;margin-bottom:6px;font-size:12px}
    .counter{background:#fff;border:1px solid #e6e8eb;border-radius:12px;padding:10px 12px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,21,27,.05)}
    .crow{display:flex;align-items:center;gap:6px;font-size:12.5px;color:#10151b;font-weight:600}
    .cbar{height:7px;border-radius:999px;background:#eef0f2;overflow:hidden;margin-top:8px}
    .cbarfill{height:100%;border-radius:999px;transition:width .3s;background:#1e5fcc}
    .cmsg{font-size:11px;font-weight:600;margin-top:5px;line-height:1.45}
    .deposit{display:block;text-align:center;background:#1e5fcc;color:#fff;text-decoration:none;font-size:13px;font-weight:800;padding:11px;margin:0 11px 8px;border-radius:10px;box-shadow:0 1px 2px rgba(16,21,27,.1)}
    .grp{font-size:11px;font-weight:800;color:#10151b;margin:10px 2px 5px;letter-spacing:.2px;text-transform:uppercase}
    .pko{font-size:10.5px;color:#c0392b;line-height:1.45;margin-top:5px}
    .pko a{color:#c0392b;font-weight:700}
    .pnote{font-size:10.5px;color:#6b7684;line-height:1.45;margin-top:5px}
    .pnote a{color:#1e5fcc;font-weight:700}
`;

  let open = false;
  function render() {
    const items = queue;
    const badge = items.length + (removals.length ? '+' + removals.length : '');
    // Annonces Leboncoin non rapprochées : informatif, JAMAIS présenté comme
    // « à retirer » (VRM ne connaît pas la paire, il ne peut pas trancher).
    const unlHtml = unlinked.length
      ? `<div class="remsec"><div class="remhd" style="color:#7a8">❔ ${unlinked.length} annonce${unlinked.length > 1 ? 's' : ''} Leboncoin non reliée${unlinked.length > 1 ? 's' : ''} à une paire VRM</div>`
        + unlinked.slice(0, 20).map((u) => `<div class="rem"><div class="remt">${esc(u.title || '(sans titre)')}</div>`
          + `<div class="remm">réf ${esc(u.ref || '—')}${u.price != null ? ' · ' + esc(u.price) + ' €' : ''}${u.issue ? ' · ⚠️ ' + esc(u.issue) : ''}`
          + `${u.url ? ` · <a href="${esc(u.url)}" target="_blank" rel="noreferrer">voir</a>` : ''}</div></div>`).join('')
        + `<div class="remm" style="padding:4px 2px">VRM ne connaît pas ces numéros — à toi de voir. Ajoute la référence de la paire sur l&#39;annonce pour qu&#39;elles se relient toutes seules.</div></div>`
      : '';
    // ⚠️⚠️ « VENDUE » SE PROUVE, ELLE NE SE DÉDUIT PAS D'UNE ABSENCE.
    // Ce bandeau écrivait « N vendues sur Vinted — à retirer », en rouge, dès
    // qu'une annonce n'était plus en ligne. Or elle peut sortir de la liste
    // parce qu'il l'a MISE EN PAUSE. Mesuré le 12 septembre sur ses vraies
    // données : sur ses 400 annonces fermées, **151 seulement** portent une
    // vente prouvée par identité (`transaction → item_id`, §5). Pour les 249
    // autres, « supprime-la de Leboncoin » lui ferait perdre une vente sur une
    // paire qu'il a encore. Trois états, et le rouge est réservé à la preuve.
    const parEtat = { vendue: [], doute: [], pause: [] };
    for (const r of removals) parEtat[r.etat === 'vendue' ? 'vendue' : (r.etat === 'pause' ? 'pause' : 'doute')].push(r);
    const remHtml =
      (parEtat.vendue.length
        ? `<div class="remsec"><div class="remhd">🔴 ${parEtat.vendue.length} vendue${parEtat.vendue.length > 1 ? 's' : ''} sur Vinted — à retirer de Leboncoin</div>`
          + `<div class="remm" style="padding:2px 2px 6px">La vente est certaine. Retire-les pour ne pas vendre la même paire deux fois — le numéro de la paire, lui, ne change pas.</div>`
          + parEtat.vendue.map((r) => remHtmlOne(r, 'vendue')).join('') + '</div>'
        : '')
      + (parEtat.doute.length
        ? `<div class="remsec" style="border-color:#e8a33d"><div class="remhd" style="color:#9a5b16">⚠️ ${parEtat.doute.length} plus en ligne sur Vinted — à vérifier</div>`
          + `<div class="remm" style="padding:2px 2px 6px">Je n&#39;ai <b>pas la preuve</b> qu&#39;elles sont vendues : tu as peut-être juste retiré l&#39;annonce. Ouvre et décide — je ne te dis pas de les supprimer.</div>`
          + parEtat.doute.map((r) => remHtmlOne(r, 'doute')).join('') + '</div>'
        : '')
      + (parEtat.pause.length
        ? `<div class="remsec" style="border-color:#d7dce2"><div class="remhd" style="color:#6b7684">⏸ ${parEtat.pause.length} en pause sur Vinted</div>`
          + `<div class="remm" style="padding:2px 2px 6px">Masquées sur Vinted, pas vendues. Elles peuvent rester sur Leboncoin : <b>rien à faire</b>.</div>`
          + parEtat.pause.map((r) => remHtmlOne(r, 'pause')).join('') + '</div>'
        : '');
    root.innerHTML = `<style>${css}</style>` + (open
      ? `<div class="panel">
           <div class="hd"><span class="t">🟠 ${items.length} à publier${removals.length ? ' · ' + removals.length + ' à retirer' : ''}</span>
             <button data-a="refresh" title="Rafraîchir">⟳</button>
             <button data-a="close" title="Fermer">×</button></div>
           <a class="deposit" href="https://www.leboncoin.fr/deposer-une-annonce" target="_blank" rel="noreferrer">➕ Déposer une annonce sur Leboncoin</a>
           <div class="body">${photoHtml()}${counterHtml()}${preuveHtml()}${exclusHtml()}${ventesHtml()}${remHtml}${unlHtml}${items.length ? listeGroupee(items) : emptyHtml()}${donePostedHtml()}</div>
           <div class="hint">1) Clique <b>➕ Déposer une annonce</b>. 2) Sur la page, clique <b>✍️ Pré-remplir</b> sur la paire voulue. 3) Vérifie et publie toi-même. Rien n&#39;est publié automatiquement.</div>
         </div>`
      : `<button class="fab" data-a="open">🟠 VRM <span class="b">${badge}</span></button>`);
  }
  // La liste se groupe sur CE QU'IL PEUT FAIRE, pas sur le numéro — c'est la loi
  // de l'écran Colis : trier par numéro mettait devant des annonces qui
  // partiraient bâclées. Le titre de groupe ne s'affiche que s'il y a plusieurs
  // groupes, sinon il répète le compte de l'en-tête (§7).
  function listeGroupee(items) {
    const nb = (a) => (a.photos || []).length;
    const pretes = items.filter((a) => nb(a) >= 2);
    const une = items.filter((a) => nb(a) === 1);
    const nues = items.filter((a) => nb(a) === 0);
    const groupes = [pretes, une, nues].filter((g) => g.length).length;
    const titre = (t, n, coul) => (groupes > 1 ? `<div class="grp"${coul ? ` style="color:${coul}"` : ''}>${t} — ${n}</div>` : '');
    return titre('Aucune photo', nues.length, '#c0392b') + nues.map(cardHtml).join('')
      + titre('Prêtes, avec toutes leurs photos', pretes.length) + pretes.map(cardHtml).join('')
      + titre('Une seule photo', une.length) + une.map(cardHtml).join('');
  }
  // ⚠️ UNE FILE QUI RÉTRÉCIT SANS EXPLICATION SE LIT COMME UNE PERTE.
  // Mesuré le 13 septembre : la N°118 vient de `liliand653`, le compte que
  // Julien a lui-même mis de côté dans l'app — le panneau la proposait quand
  // même. Elle en sort ; on le DIT, en gris et sans consigne : c'est son choix,
  // pas une panne (§ « un CHOIX n'est pas une panne »), et le geste pour la
  // récupérer est de remettre le compte dans l'app.
  // ⚠️⚠️ QUAND LA PREUVE DE VENTE N'A PAS PU ÊTRE LUE, LA LISTE N'EST PAS SÛRE.
  // Mesuré le 15 septembre : cette lecture a raté une fois et la file est passée
  // de 40 à **55** paires — quinze paires déjà vendues reproposées à la
  // publication, sans un mot. On ne cache pas la liste (elle reste utile), on
  // dit ce qu'on n'a pas pu vérifier, et ce que ça change.
  // ⚠️ TES VENTES LEBONCOIN — l'état + le BORDEREAU, comme sur Vinted.
  // Tout vient de `lbc_ventes` (capté par l'extension, §« capter les ventes »).
  // On n'AFFICHE que ce qui est MESURÉ : titre, prix, état ; et le bordereau
  // seulement quand la vente le porte (`label.voucherUrl`) ET que c'est bien
  // une vente à lui (`isSeller === true`, jamais déduit). Liste vide ⇒ aucune
  // section (rien de capté encore ≠ « aucune vente », on n'invente pas).
  function ventesHtml() {
    if (!ventes.length) return '';
    const euro = (c) => (c == null ? '' : (Number(c) / 100).toFixed(2).replace('.', ',') + ' €');
    const etat = (o) => o.stepLabel || ({ ongoing: 'En cours', cancelled: 'Annulée', done: 'Terminée', refunded: 'Remboursée', action: 'À expédier' }[o.stepStatus] || o.stepStatus || '');
    const annulee = (o) => /annul|cancel|refund|rembours/i.test((o.stepStatus || '') + ' ' + (o.stepLabel || ''));
    // ⚠️⚠️ §5 : une VENTE, c'est `isSeller === true` — jamais déduit. La liste v3
    // (`mes-transactions`) ne porte PAS ce champ : toutes ses lignes sont
    // `isSeller: undefined`, et elle MÊLE ses ventes ET ses achats (mesuré : une
    // montre Rolex, une bague… sont ses ACHATS). Compter tout ça « Tes ventes »
    // désignerait le mauvais rôle — le §5 mot pour mot. Seul le DÉTAIL d'une
    // transaction porte `is_seller`, et il se capte tout seul quand il ouvre la
    // transaction sur Leboncoin (aucune requête lancée à l'aveugle).
    // ⇒ On n'affiche comme vente QUE `isSeller === true`. Un achat prouvé
    //   (`isSeller === false`) est écarté (ce n'est pas son sujet ici). Le côté
    //   pas encore su (`isSeller == null`) n'est PAS une vente non plus, mais on
    //   le DIT (une liste qui rétrécit sans un mot se lit comme une perte, §5).
    const vraies = ventes.filter((o) => o.isSeller === true);
    const inconnues = ventes.filter((o) => o.isSeller == null).length;
    if (!vraies.length && !inconnues) return '';   // que des achats prouvés : rien à montrer ici
    const lignes = vraies.slice(0, 40).map((o) => {
      const bord = (o.label && o.label.voucherUrl)
        ? `<a href="${esc(o.label.voucherUrl)}" target="_blank" rel="noreferrer" style="display:inline-block;margin-top:6px;background:#10151B;color:#fff;border-radius:8px;padding:6px 11px;font-weight:700;font-size:12px;text-decoration:none">🧾 Ouvrir le bordereau${o.label.reference ? ' · ' + esc(o.label.reference) : ''}</a>`
        : (o.label && o.label.trackingUrl ? `<a href="${esc(o.label.trackingUrl)}" target="_blank" rel="noreferrer" class="vrm-link" style="display:inline-block;margin-top:4px;font-size:12px">Suivre le colis ↗</a>` : '');
      return `<div class="rem" style="${annulee(o) ? 'opacity:.55' : ''}">
        <div class="remt">${esc(o.title || '(sans titre)')}</div>
        <div class="remm">${esc(etat(o))}${o.price != null ? ' · ' + esc(euro(o.price)) : ''}${o.deliveryLabel ? ' · ' + esc(o.deliveryLabel) : ''}</div>
        ${bord}
      </div>`;
    }).join('');
    const note = inconnues
      ? `<div class="remm" style="padding:4px 2px 6px;color:#8a8f98">${inconnues} autre${inconnues > 1 ? 's' : ''} transaction${inconnues > 1 ? 's' : ''} vue${inconnues > 1 ? 's' : ''} sur Leboncoin — vente ou achat <b>pas encore confirmé</b>. Ouvre-la sur Leboncoin : le côté se lit tout seul au passage.</div>`
      : '';
    if (!vraies.length) {
      // Aucune vente confirmée, mais des transactions vues : on ne fête rien, on explique.
      return `<div class="remsec"><div class="remhd">🧾 Tes ventes Leboncoin</div>${note}</div>`;
    }
    return `<div class="remsec"><div class="remhd">🧾 Tes ventes Leboncoin (${vraies.length})</div>
      <div class="remm" style="padding:2px 2px 6px">Capté depuis Leboncoin. Le bordereau s'ouvre quand la vente le porte — comme sur Vinted.</div>
      ${lignes}${note}</div>`;
  }
  function preuveHtml() {
    if (!stats || !stats.preuveKO) return '';
    return `<div class="counter" style="margin-top:8px">
      <div class="cmsg" style="color:#9a5b16">Je n&#39;ai pas pu vérifier lesquelles sont <b>déjà vendues sur Vinted</b> : la lecture a échoué. La liste ci-dessous peut donc en contenir. Rien n&#39;est perdu — clique <b>↻</b> dans un moment.</div>
    </div>`;
  }
  function exclusHtml() {
    const n = (stats && stats.exclues) || 0;
    if (!n) return '';
    return `<div class="counter" style="margin-top:8px">
      <div class="cmsg" style="color:#8a8f98">${n} paire${n > 1 ? 's ne sont' : ' n\'est'} pas dans la liste : ${n > 1 ? 'leurs comptes Vinted sont exclus' : 'son compte Vinted est exclu'} de l&#39;app — ton choix. Ça se règle dans <b>Réglages → Comptes liés</b>.</div>
    </div>`;
  }
  function donePostedHtml() {
    if (!postedList.length) return '';
    return `<div class="counter" style="margin-top:10px">
      <div class="crow"><b>✓ ${postedList.length} déjà publiée${postedList.length > 1 ? 's' : ''}</b>
        <button class="btn" data-a="togdone" style="margin-left:auto">${showPosted ? 'masquer' : 'gérer / annuler'}</button></div>
      ${showPosted ? postedList.map((p) => `<div class="rem" data-pid="${esc(p.id)}"><div style="flex:1;min-width:0"><b>N°${esc(p.numero)}</b> ${esc((p.title || '').slice(0, 30))}</div><button class="btn" data-a="unpost">↩︎ Remettre</button></div>`).join('') : ''}
    </div>`;
  }
  function emptyHtml() {
    if (loadError) return '<div class="empty" style="color:#c0392b">⚠️ Chargement impossible (extension endormie ?). Clique sur ⟳ en haut, ou recharge la page.</div>';
    const s = stats || {};
    if ((s.onlineCount || 0) === 0) return '<div class="empty">Aucune annonce Vinted captée.<br>Passe sur ton dressing vinted.fr avec l&#39;extension, puis reviens ici et clique ⟳.</div>';
    if ((s.numberedCount || 0) === 0) return `<div class="empty">${s.onlineCount} annonce${s.onlineCount > 1 ? 's' : ''} en ligne sur Vinted, mais <b>aucune numérotée</b>.<br>Mets un N° sur tes annonces dans l&#39;app VRM, elles apparaîtront ici.</div>`;
    return `<div class="empty">Tout est déjà publié 🎉<br><span style="font-size:10.5px">${s.numberedCount} paire${s.numberedCount > 1 ? 's' : ''} numérotée${s.numberedCount > 1 ? 's' : ''}, toutes marquées publiées sur Leboncoin.</span></div>`;
  }
  function photoHtml() {
    const res = photoRes;
    const grid = res && res.photos && res.photos.length
      ? `<div class="ph" style="flex-wrap:wrap">${res.photos.map((u) => `<img src="${esc(u)}" data-full="${esc(u)}" title="Ouvrir en grand">`).join('')}</div>
         <div class="btns" style="margin-top:6px">
           <button class="btn p" data-a="photoall">⬇️ Télécharger (${res.photos.length})</button>
           <button class="btn" data-a="photocopy">Copier les liens</button>
           <button class="btn" data-a="photoclose">Fermer</button>
         </div>`
      : (res ? '<div style="font-size:11.5px;color:#a33;margin-top:5px">Aucune photo trouvée pour ce N° (la paire n&#39;a peut-être pas encore été captée sur Vinted).</div>' : '');
    return `<div class="counter">
      <div class="crow"><b>📷 Photos d&#39;une paire</b> <span style="font-size:10.5px;color:#8a8f98;font-weight:700">pour un acheteur</span>
        <button class="btn" data-a="photolookup" style="margin-left:auto">Chercher un N°</button></div>
      ${res && res.numero ? `<div style="font-size:11px;color:#555;font-weight:700;margin-top:4px">N°${esc(res.numero)}${res.title ? ' · ' + esc(String(res.title).slice(0, 32)) : ''} — ${res.photos.length} photo${res.photos.length > 1 ? 's' : ''} Vinted</div>` : ''}
      ${grid}
    </div>`;
  }
  function counterHtml() {
    // ⚠️⚠️ UN ZÉRO INVENTÉ EST PIRE QU'UN CHIFFRE ABSENT. Tant que ses annonces
    // Leboncoin n'ont jamais été captées, « 📊 0 annonce sur Leboncoin » est
    // faux — et surtout il CACHE que « vendue sur Vinted → à retirer » ne peut
    // pas fonctionner (ça se rapproche par la référence de l'annonce Leboncoin).
    // Un tiret et la raison, jamais un zéro (§7).
    if (stats.lbcJamaisLu && !(stats.postedCount > 0)) {
      return `<div class="counter">
        <div class="crow"><b>📊 —</b> annonces sur Leboncoin
          <button class="btn" data-a="setplan" style="margin-left:auto">Choisir mon offre</button></div>
        <div class="cmsg" style="color:#9a5b16">Je n&#39;ai pas encore vu tes annonces Leboncoin. Ouvre la page de <b>tes annonces</b> une fois : je les lirai au passage.<br>Tant que c&#39;est le cas, je ne peux pas te dire <b>lesquelles retirer</b> quand une paire se vend sur Vinted.</div>
      </div>`;
    }
    const n = Math.max(stats.postedCount || 0, stats.lbcCount || 0); // le plus fiable des deux
    // Limite effective : celle que TU as choisie, sinon celle détectée sur ton offre.
    const lim = stats.limit != null ? stats.limit : (stats.detected || null);
    const auto = stats.limit == null && stats.detected;
    const planLbl = stats.plan ? stats.plan : (auto ? 'offre détectée' : (lim ? '' : 'Gratuit'));
    let bar = '';
    if (lim) {
      const pct = Math.min(100, Math.round((n / lim) * 100));
      const near = n >= lim ? 'full' : (n >= lim - 3 ? 'warn' : 'ok');
      const col = near === 'full' ? '#c0392b' : near === 'warn' ? '#e67e22' : '#0a7f3f';
      bar = `<div class="cbar"><div class="cbarfill" style="width:${pct}%;background:${col}"></div></div>
        <div class="cmsg" style="color:${col}">${n >= lim ? '⚠️ Limite atteinte — Leboncoin peut te bloquer la prochaine publication.' : near === 'warn' ? '⚠️ Tu approches de ta limite.' : 'Il te reste ' + (lim - n) + ' annonce' + ((lim - n) > 1 ? 's' : '') + '.'}</div>`;
    }
    return `<div class="counter">
      <div class="crow"><b>📊 ${n}</b> annonce${n > 1 ? 's' : ''} sur Leboncoin${lim ? ' / ' + lim : ''}
        <button class="btn" data-a="setplan" style="margin-left:auto">${lim || stats.plan ? '✎ Mon offre' : 'Choisir mon offre'}</button></div>
      ${planLbl ? `<div style="font-size:10.5px;color:#8a8f98;font-weight:700;margin-top:3px">Offre : ${esc(planLbl)}${auto ? ' · adaptée automatiquement' : ''}</div>` : ''}
      ${bar}
    </div>`;
  }
  function remHtmlOne(r, cas) {
    // Le geste dépend de la PREUVE : on ne demande de supprimer que ce qui est
    // prouvé vendu. Sur un doute on propose d'ouvrir, pas de supprimer ; sur une
    // pause on ne demande rien du tout.
    const sous = cas === 'vendue'
      ? `<div style="font-size:10.5px;color:#a33">cherche « ${esc(r.ref)} » dans tes annonces Leboncoin et supprime-la</div>`
      : cas === 'doute'
        ? `<div style="font-size:10.5px;color:#9a5b16">vendue ? retirée ? ouvre-la pour décider${r.url ? ` · <a href="${esc(r.url)}" target="_blank" rel="noreferrer">voir sur Leboncoin</a>` : ''}</div>`
        : `<div style="font-size:10.5px;color:#6b7684">en pause sur Vinted — elle peut rester ici</div>`;
    const bouton = cas === 'pause' ? ''
      : `<button class="btn" data-a="removed" style="border-color:${cas === 'vendue' ? '#c0392b;color:#c0392b' : '#9a5b16;color:#9a5b16'}">✓ Retirée</button>`;
    return `<div class="rem" data-rid="${esc(r.id)}">
      <div style="flex:1;min-width:0"><b>N°${esc(r.numero)}</b> ${esc((r.title || '').slice(0, 34))}${sous}</div>
      ${bouton}
    </div>`;
  }
  // ⚠️⚠️ 54 DE SES 59 ANNONCES PARTIRAIENT AVEC UNE SEULE PHOTO.
  // Mesuré le 12 septembre : les photos HD ne viennent QUE de la page de
  // l'annonce Vinted (l'API n'en renvoie AUCUNE — 0 sur 57 lignes
  // `harvest_*_item_*`, captures jusqu'au 9 septembre). Les annonces qu'il a
  // déjà ouvertes ont 5 photos en moyenne ; les autres, une seule — celle de la
  // vignette. Une annonce Leboncoin à une photo se vend mal, et il ne pouvait
  // pas le savoir : la carte n'en disait rien.
  // On écrit le CHIFFRE et on donne la porte (même règle que le bandeau eBay :
  // ne pas écrire « ton annonce est prête », écrire combien).
  // Le montant brut de Vinted est à l'anglaise (« 24.0 »). Deux décimales et une
  // virgule — c'est déjà la règle sur l'écran Achats (§7).
  // ⚠️ Seulement pour l'AFFICHAGE : la valeur injectée dans le formulaire reste
  //    celle de Vinted, qu'un champ numérique sait lire.
  function euro(v) {
    const n = Number(String(v == null ? '' : v).replace(',', '.'));
    return isFinite(n) ? n.toFixed(2).replace('.', ',') + ' €' : String(v || '') + ' €';
  }
  function photosLigne(ad) {
    const n = (ad.photos || []).length;
    const sansDesc = ad.aDescription === false;
    if (n >= 2 && !sansDesc) return '';
    // ⚠️ UNE SEULE LIGNE POUR LES DEUX MANQUES, parce que le geste est le MÊME :
    //    ouvrir l'annonce sur Vinted capte la description ET les photos. Deux
    //    lignes diraient deux problèmes pour une seule cause (§7).
    //    Mesuré le 12 septembre : 53 des 59 annonces n'ont pas de description
    //    captée, 54 n'ont qu'une photo — ce sont les mêmes.
    const lien = ad.vintedUrl ? ` <a href="${esc(ad.vintedUrl)}" target="_blank" rel="noreferrer">ouvrir l&#39;annonce Vinted</a>` : '';
    const manques = [];
    if (n === 0) manques.push('aucune photo');
    else if (n === 1) manques.push('1 seule photo');
    if (sansDesc) manques.push('pas de description');
    if (n === 0) {
      return `<div class="pnote" style="color:#c0392b">${manques.join(' · ')} — Leboncoin refuse une annonce sans photo.${lien}</div>`;
    }
    return `<div class="pnote">${manques.join(' · ')}. Tout est sur la page Vinted : ouvre-la une fois, l&#39;extension lit le reste toute seule.${lien}</div>`;
  }
  function cardHtml(ad) {
    // ⚠️ « IL Y A DES PHOTOS QUI N'APPARAISSENT PAS » (Julien, 13 septembre).
    //    Je n'ai pas pu vérifier pourquoi depuis mes outils : Vinted bloque mes
    //    requêtes, et l'URL d'une photo ne porte qu'une signature `?s=…`, sans
    //    date d'expiration lisible. Plutôt que de deviner, **la carte le dit
    //    elle-même** : si l'image ne charge pas, on l'écrit et on donne la porte
    //    (rouvrir l'annonce sur Vinted recapte des URL fraîches).
    //    C'est la méthode du bandeau eBay : faire constater par ce qui y a accès.
    const ph = (ad.photos || []).slice(0, 6).map((u) => `<img src="${esc(u)}" data-full="${esc(u)}" title="Ouvrir la photo" onerror="this.remove();const c=this.closest('.card');if(c){const n=c.querySelector('.pko');if(n)n.hidden=false;}">`).join('');
    // ⚠️ « on les a déjà republiés… ça peut les flouter pour dire que je l'ai
    //    déjà publié » (Julien). On repère NOTRE référence VRM-{n°} sur la page
    //    Leboncoin (identité, jamais une ressemblance de titre, §5) : si elle y
    //    est, la paire est DÉJÀ en ligne → carte estompée + « Tout préparer »
    //    désactivé, pour ne pas la republier deux fois.
    const onPage = pageRefs.has(String(ad.numero));
    return `<div class="card${onPage ? ' deja' : ''}" data-id="${esc(ad.id)}">
      <div class="row"><span class="num">N°${esc(ad.numero)}</span><span class="cat">${esc(ad.category)}</span>${onPage ? '<span class="done">✓ déjà en ligne</span>' : ''}<span class="acc">${esc(ad.account)}</span></div>
      <div class="tt">${esc(ad.title)}</div>
      <div class="pr">${esc(euro(ad.price))}</div>
      ${ph ? `<div class="ph">${ph}</div>` : ''}
      <div class="pko" hidden>⚠️ Une photo ne s'affiche plus (le lien Vinted a expiré). Ouvre l'annonce sur Vinted${ad.vintedUrl ? ` — <a href="${esc(ad.vintedUrl)}" target="_blank" rel="noreferrer">ici</a>` : ''} : l'extension recapte des liens frais au passage.</div>
      ${photosLigne(ad)}
      <div class="desc">${esc(ad.description)}</div>
      <div class="btns">
        <button class="btn p" data-a="prepare" style="flex:1 1 100%"${onPage ? ' disabled' : ''} title="${onPage ? "Cette paire porte déjà ta référence VRM sur Leboncoin — inutile de la republier." : "Ouvre Leboncoin et fait TOUT tout seul : photos, titre, description, prix, catégorie, puis publie SANS booster."}">${onPage ? '✓ déjà en ligne sur Leboncoin' : '🚀 Publier sur Leboncoin'}</button>
        <button class="btn" data-a="posted" style="flex:1 1 100%;border-color:#0a7f3f;color:#0a7f3f" title="À cliquer SEULEMENT si tu l'as publiée toi-même. Ça ne publie rien, ça la retire juste de la liste.">✓ Je l'ai déjà publiée</button>
      </div>
    </div>`;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function toast(t) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; root.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, 1600);
  }
  // ⚠️⚠️ UNE PROMESSE REJETÉE NE PASSE PAS PAR `catch`. Écrit ainsi —
  // `try { navigator.clipboard.writeText(t) } catch (_) { …repli… }` — le repli
  // ne se déclenchait QUE si l'appel levait sur place. Or `writeText` échoue en
  // rendant une promesse rejetée (document pas au premier plan, permission
  // refusée, contexte non sécurisé) : le repli ne partait pas, **rien n'était
  // copié**, et le panneau annonçait quand même « texte copié ». C'est la même
  // famille que « 1 champ pré-rempli » sur une page où rien n'a été rempli.
  // ⇒ On attend la réponse, et on retombe sur l'ancienne méthode si ça a raté.
  function copyLegacy(t) {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    ta.remove();
    return ok;
  }
  function copy(t) {
    try {
      const p = navigator.clipboard && navigator.clipboard.writeText(t);
      if (p && typeof p.then === 'function') { p.catch(() => { copyLegacy(t); }); return; }
    } catch (_) {}
    copyLegacy(t);
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
    return { n: Math.min(n, fichiers.length), envoyees: placees, confirmees, rates, total: fichiers.length, voie };
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
  function prefill(ad) {
    const ref = ad.ref || ('VRM-' + ad.numero);
    const faits = [];
    if (setField(findField([/titre|title|subject|proposez/]), ad.title)) faits.push('le titre');
    // ⚠️ Leboncoin écrit parfois la description lui-même : on ne l'écrase pas,
    //    on garde la sienne et on y GARANTIT la référence (§5).
    const desc = poserDescription(ad);
    if (desc.fait) faits.push('la description');
    else if (desc.garde && desc.ref) faits.push('ta référence ajoutée à la description que Leboncoin a déjà écrite');
    if (poserPrix(ad.price)) faits.push('le prix');
    // Champ RÉFÉRENCE des comptes PRO : on y met VRM-{N°} → pas besoin de le mettre
    // dans le titre, et tu peux rechercher la paire par ce numéro dans ton profil.
    const refMise = setField(findField([/référ|referen|\bref\b|\bsku\b|identifiant|code.?article|numéro.?article/]), ref);
    if (refMise) faits.push('la référence ' + ref);
    if (choisirCategorie(ad)) faits.push('la catégorie ' + ad.category);
    remplirComposants(ad);   // pointure + état (menus React)
    if (activerLivraison() === 'active') faits.push('la livraison');
    if (!faits.length) {
      copy(ad.title + '\n\n' + ad.description);
      toast('Aucun champ reconnu sur cette page — titre + description copiés (la réf ' + ref + ' est dedans). Le dépôt Leboncoin se fait en plusieurs étapes : reviens cliquer ici à l\'étape du titre.');
      return;
    }
    const manque = refMise ? '' : ' La référence ' + ref + ' n\'a PAS pu être mise dans un champ : elle est dans la description (en haut et en bas) — garde-la, c\'est elle qui relie l\'annonce à ta paire.';
    // La catégorie n'est nommée que si on la connaît ; sinon on dit de la choisir
    // (un reseller hors chaussures n'a pas de catégorie devinée).
    const catPhrase = ad.category ? ' Vérifie la catégorie « ' + ad.category + ' »' : ' Choisis la catégorie';
    toast(faits.length + ' champ' + (faits.length > 1 ? 's' : '') + ' rempli' + (faits.length > 1 ? 's' : '') + ' : ' + faits.join(', ') + '.' + manque + catPhrase + ' et les photos, puis publie.');
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

  // Le témoin : discret, en bas à gauche, il disparaît tout seul. Il ne
  // s'affiche QUE sur une page de dépôt et QUE dans la page du haut.
  function temoinEtape(n, nChamps, nListes, nFichiers, categorie) {
    try {
      if (DANS_UN_CADRE || !document.body) return;
      let t = document.getElementById('vrm-temoin-etape');
      if (!t) {
        t = document.createElement('div');
        t.id = 'vrm-temoin-etape';
        t.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:2147483646;max-width:330px;'
          + 'background:#10151B;color:#fff;border-radius:10px;padding:9px 12px;'
          + 'font:500 12.5px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;'
          + 'box-shadow:0 1px 2px rgba(0,0,0,.28),0 10px 26px rgba(0,0,0,.22)';
        document.body.appendChild(t);
      }
      // Ce qui MANQUE se dit en premier : c'est ça qui doit le faire s'arrêter.
      const manque = [];
      if (!nListes) manque.push('aucune liste déroulante vue');
      if (!categorie) manque.push('catégorie inconnue');
      t.innerHTML = '<div style="font-weight:800;margin-bottom:2px">VRM · étape ' + n + ' enregistrée</div>'
        + '<div style="opacity:.82">' + nChamps + ' champ' + (nChamps > 1 ? 's' : '') + ' · '
        + nListes + ' liste' + (nListes > 1 ? 's' : '') + ' · '
        + nFichiers + ' champ photo' + (nFichiers > 1 ? 's' : '') + '</div>'
        + (categorie ? '<div style="opacity:.82">catégorie : ' + String(categorie).replace(/[<>&]/g, '').slice(0, 60) + '</div>' : '')
        + (manque.length ? '<div style="margin-top:4px;color:#FFC38A">⚠️ ' + manque.join(' · ') + ' — dis-le-moi, je corrige avant que tu continues.</div>' : '');
      clearTimeout(temoinEtape._t);
      temoinEtape._t = setTimeout(() => { try { t.remove(); } catch (_) {} }, manque.length ? 14000 : 7000);
    } catch (_) {}
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
        // ⚠️⚠️ « LÀ C'EST SÛR ? » — Julien, 17 septembre. NON, et c'est la bonne
        //    réponse : je n'ai jamais pu voir la vraie page (leboncoin.fr me
        //    répond 403), donc mon banc sert une page que J'AI écrite. Ce que je
        //    PEUX faire, c'est qu'il n'ait pas à me croire : le témoin écrit, à
        //    chaque étape, CE QUI A ÉTÉ ENREGISTRÉ. S'il lit « 0 liste » il
        //    arrête tout de suite, au lieu de faire le dépôt entier pour rien.
        //    *Le chiffre, jamais la promesse.*
        temoinEtape(ordreEtape, fields.length, sels.length, fichiers, categorie);
      }
    } catch (_) {}
  }


  root.addEventListener('click', async (e) => {
    const a = e.target.getAttribute && e.target.getAttribute('data-a');
    if (e.target.tagName === 'IMG' && e.target.dataset.full) { window.open(e.target.dataset.full, '_blank'); return; }
    if (!a) return;
    if (a === 'open') { open = true; render(); return; }
    if (a === 'close') { open = false; render(); return; }
    if (a === 'refresh') { await load(); toast('Actualisé'); return; }
    if (a === 'togdone') { showPosted = !showPosted; render(); return; }
    if (a === 'unpost') {
      const pid = e.target.closest('.rem') && e.target.closest('.rem').getAttribute('data-pid');
      if (!pid) return;
      await send({ action: 'unmarkPosted', id: pid });
      await load(); toast('Remise dans la liste à publier ✓');
      return;
    }
    if (a === 'photolookup') {
      const num = window.prompt('Numéro (N°) de la paire dont tu veux les photos :', (photoRes && photoRes.numero) || '');
      if (num === null || !num.trim()) return;
      toast('Recherche des photos…');
      const r = await send({ action: 'getPhotos', numero: num.trim() });
      photoRes = (r && r.ok) ? { numero: r.numero, title: r.title, photos: r.photos || [] } : { numero: num.trim(), title: '', photos: [] };
      render();
      return;
    }
    if (a === 'photoall') { const r = await send({ action: 'downloadPhotos', urls: (photoRes && photoRes.photos) || [], numero: (photoRes && photoRes.numero) || 'paire' }); toast((r && r.count ? r.count : 0) + ' photo(s) téléchargée(s) → dossier VRM-' + ((photoRes && photoRes.numero) || '')); return; }
    if (a === 'photocopy') { copy((photoRes && photoRes.photos || []).join('\n')); toast('Liens copiés'); return; }
    if (a === 'photoclose') { photoRes = null; render(); return; }
    if (a === 'setplan') {
      const plan = window.prompt('Nom de ton offre Leboncoin (ex. Gratuit, Pack Pro…) :', stats.plan || 'Gratuit');
      if (plan === null) return;
      const cur = stats.limit != null ? stats.limit : (stats.detected || '');
      const v = window.prompt('Nombre d\'annonces incluses dans cette offre.\n(Laisse vide = illimité / pas de limite)', cur);
      if (v === null) return;
      await send({ action: 'setLimit', limit: v.trim() === '' ? 0 : v.trim(), plan });
      await load(); toast('Offre mise à jour');
      return;
    }
    if (a === 'removed') {
      const rid = e.target.closest('.rem') && e.target.closest('.rem').getAttribute('data-rid');
      if (!rid) return;
      await send({ action: 'markRemoved', id: rid });
      removals = removals.filter((x) => x.id !== rid); render(); toast('Retirée de la synchro ✓');
      return;
    }
    const card = e.target.closest('.card'); const id = card && card.getAttribute('data-id');
    const ad = queue.find((x) => x.id === id); if (!ad && a !== 'open') return;
    if (a === 'ctitle') { copy(ad.title); toast('Titre copié'); }
    else if (a === 'cdesc') { copy(ad.description); toast('Description copiée'); }
    else if (a === 'cprice') { copy(ad.price); toast('Prix copié'); }
    else if (a === 'photos') { const r = await send({ action: 'downloadPhotos', urls: ad.photos || [], numero: ad.numero }); toast((r && r.count ? r.count : 0) + ' photo(s) téléchargée(s) → dossier VRM-' + ad.numero); }
    else if (a === 'prepare') {
      // ⚠️ ON NE TÉLÉCHARGE PLUS RIEN SUR SON DISQUE. « Ça me fait télécharger
      //    des photos dans mon ordi » — et pour rien : les photos s'attachent
      //    directement au formulaire (mesuré le 13 septembre).
      // ON MEMORISE L'ANNONCE EN COURS (+ le feu vert pour publier sans booster :
      // c'est LUI qui lance, donc l'onglet de dépôt a le droit de publier). La
      // page de dépôt s'ouvre dans un nouvel onglet et fait tout tout seul.
      await send({ action: 'setPending', ad: Object.assign({}, ad, { publier: true }) });
      window.open('https://www.leboncoin.fr/deposer-une-annonce', '_blank');
      toast('🚀 J\'ouvre Leboncoin et je remplis tout (photos, titre, description, prix, catégorie) puis je publie SANS booster. Laisse l\'onglet faire — tu peux relire avant que ça parte.');
    }
    else if (a === 'posted') {
      if (!confirm('⚠️ Ceci NE publie PAS l\'annonce.\n\nÀ cliquer seulement si tu as DÉJÀ publié la N°' + ad.numero + ' toi-même sur Leboncoin.\nÇa la retire juste de la liste « à publier ». Continuer ?')) return;
      await send({ action: 'markPosted', id: ad.id });
      queue = queue.filter((x) => x.id !== ad.id); render(); toast('N°' + ad.numero + ' retirée de la liste (tu peux annuler dans « déjà publiées »)');
    }
  });

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
  let photosFaites = false, photosEtat = null;
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
      if (!photosFaites && champsFichier().length) {
        photosFaites = true;
        attacherPhotos(pending).then((r) => { photosEtat = r; banner(); });
      }
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
    if (_avanceEnCours) return; const sig = derniereEtape; if (!sig || _avanceFaite.has(sig)) return;
    const n = (_avanceEssais[sig] = (_avanceEssais[sig] || 0) + 1);
    if (n > 4) { if (n === 5) toast('⚠️ Un champ obligatoire reste à choisir (ex. Univers) — fais-le, je continue'); return; }
    _avanceEnCours = true;
    try { await attendre(1100); if (cliquerContinuer()) { _avanceFaite.add(sig); toast('→ étape suivante'); } } catch (_) {}
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
    const NOTRE_UI = (el) => !!el.closest('#vrm-lbc-banner,#vrm-temoin-etape,#vrm-fab,#vrm-panel');
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
    if (!actuel.trim()) { const ok = setField(el, ad.description); return { trouve: true, fait: ok, garde: false, ref: /VRM-\d/i.test(ad.description) }; }
    const dejaRef = new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(actuel);
    if (dejaRef) return { trouve: true, fait: false, garde: true, ref: true };
    const ok = setField(el, actuel.replace(/\s+$/, '') + '\n\nRéférence : ' + ref);
    return { trouve: true, fait: false, garde: true, ref: ok };
  }
  function banner() {
    let el = document.getElementById('vrm-lbc-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'vrm-lbc-banner';
      el.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147483646;max-width:300px;background:#0d1210;color:#eef4f0;border:1px solid #28322d;border-radius:14px;padding:12px 14px;font:12px/1.5 -apple-system,system-ui,sans-serif;box-shadow:0 18px 40px -12px rgba(0,0,0,.5)';
      document.documentElement.appendChild(el);
    }
    el.innerHTML =
      '<div style="font-weight:700;font-size:13px;margin-bottom:3px">N°' + (pending.numero || '?') + ' — ' + esc(String(pending.title || '').slice(0, 46)) + '</div>' +
      '<div style="color:#8b9b92">' + pendingDone + ' champ' + (pendingDone > 1 ? 's' : '') + ' rempli' + (pendingDone > 1 ? 's' : '') +
      '. Catégorie <b style="color:#eef4f0">' + esc(pending.category || '—') + '</b>.</div>' +
      '<div style="color:#8b9b92;margin-top:3px">' + (photosEtat
        ? (photosEtat.n > 0
            // On dit ce qu'on SAIT : « confirmées » quand on a pu compter les
            // vignettes, sinon « envoyées » + vérifie (les vignettes de Leboncoin
            // ne sont pas comptables de l'extérieur — mesuré le 20 sept.).
            ? (photosEtat.confirmees != null
                ? '📷 <b style="color:#eef4f0">' + photosEtat.confirmees + '/' + photosEtat.total + ' photo' + (photosEtat.total > 1 ? 's' : '') + ' attachée' + (photosEtat.confirmees > 1 ? 's' : '') + '</b>'
                : '📷 <b style="color:#eef4f0">' + photosEtat.envoyees + ' photo' + (photosEtat.envoyees > 1 ? 's' : '') + ' envoyée' + (photosEtat.envoyees > 1 ? 's' : '') + '</b> au formulaire — <b style="color:#e8b35d">vérifie qu\'elles y sont toutes</b> avant de publier')
              + (photosEtat.rates ? ' (' + photosEtat.rates + ' illisible' + (photosEtat.rates > 1 ? 's' : '') + ')' : '')
              + (photosEtat.total <= 6 ? '<br><span style="color:#e8b35d">Seules ' + photosEtat.total + ' photos sont captées de Vinted : rouvre l\'annonce sur Vinted (extension à jour) pour les avoir toutes.</span>' : '')
            : '📷 aucune photo attachée — ' + esc(photosEtat.raison || 'raison inconnue'))
        : '📷 j\'attache les photos dès que l\'étape photo s\'affiche.') + '</div>' +
      // Statut de PUBLICATION : ce qui compte, dit clairement.
      (publieEtat
        ? '<div style="margin-top:6px">' + (publieEtat.ok
            ? '✅ <b style="color:#5fd08a">Publiée sans booster.</b>'
            : '<span style="color:#e8b35d">Je n\'ai pas publié — ' + esc(publieEtat.raison || 'à faire toi-même') + '.</span>') + '</div>'
        : '') +
      (pendingArrete && !(publieEtat && publieEtat.ok)
        ? '<div style="color:#e8b35d;margin-top:6px">Le dépôt se fait en étapes ; si une nouvelle étape s\'affiche, clique <b style="color:#eef4f0">↻ Reprendre</b>.</div>'
        : '') +
      '<div style="display:flex;gap:6px;margin-top:9px">' +
      (pendingArrete && !(publieEtat && publieEtat.ok)
        ? '<button id="vrm-refill" style="flex:1;border:1px solid #3a4a43;background:transparent;color:#eef4f0;border-radius:9px;padding:7px;font-size:11.5px;font-weight:600;cursor:pointer">↻ Reprendre</button>'
        : '') +
      '<button id="vrm-close" title="Fermer" style="border:1px solid #3a4a43;background:transparent;color:#8b9b92;border-radius:9px;padding:7px 11px;font-size:11.5px;cursor:pointer">✕</button>' +
      '</div>' +
      '<div style="color:#6f7f77;font-size:10px;margin-top:7px">VRM remplit tout et publie <b>sans booster</b> (aucune option payante). Tu peux relire avant que ça parte.</div>';
    const refill = el.querySelector('#vrm-refill');
    if (refill) refill.onclick = () => {
      pendingDone = fillNowForce(pending);
      pendingArrete = false; pendingTries = 0; publieFait = false;
      clearInterval(pendingTimer);
      pendingTimer = setInterval(() => {
        pendingTries++;
        const n2 = fillNow(pending);
        if (n2 > pendingDone) { pendingDone = n2; banner(); }
        if (!photosFaites && champsFichier().length) { photosFaites = true; attacherPhotos(pending).then((r) => { photosEtat = r; banner(); }); }
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

  async function load() {
    autoPrefill();
    scanPageRefs();
    captureLbcListings();
    captureDepositForm();
    const r = await send({ action: 'getQueue' });
    loadError = !(r && r.ok);
    queue = (r && r.ok && Array.isArray(r.queue)) ? r.queue : [];
    removals = (r && r.ok && Array.isArray(r.removals)) ? r.removals : [];
    unlinked = (r && r.ok && Array.isArray(r.unlinked)) ? r.unlinked : [];
    postedList = (r && r.ok && Array.isArray(r.postedList)) ? r.postedList : [];
    ventes = (r && r.ok && Array.isArray(r.ventes)) ? r.ventes : [];
    if (r && r.ok && r.stats) stats = r.stats;
    render();
  }
  if (!DANS_UN_CADRE) {
    render();
    load();
    // Rafraîchit quand on revient sur l'onglet (nouvelle annonce entre-temps) et
    // re-scanne la page après navigation interne (Leboncoin est une SPA).
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
    let lastUrl = location.href;
    setInterval(() => { if (location.href !== lastUrl) { lastUrl = location.href; setTimeout(load, 1200); } }, 2000);
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
