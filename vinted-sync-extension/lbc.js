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
    else if (d.kind === 'lbcpaths' && d.paths) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcPaths', paths: d.paths, url: location.href }); } catch (_) {} }
  }, false);

  let queue = [];
  let removals = []; // paires vendues sur Vinted → à retirer de Leboncoin
  let unlinked = []; // annonces LBC que VRM n'a pas su relier à une paire connue
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

  const css = `
    *{box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,sans-serif}
    .fab{background:#ff6e14;color:#fff;border:none;border-radius:999px;padding:12px 16px;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.28);display:flex;align-items:center;gap:8px}
    .fab .b{background:#fff;color:#ff6e14;border-radius:999px;min-width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;padding:0 6px}
    .panel{width:380px;max-width:92vw;max-height:80vh;background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.3);overflow:hidden;display:flex;flex-direction:column}
    .hd{background:#ff6e14;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px}
    .hd .t{font-size:14px;font-weight:900;flex:1}
    .hd button{background:rgba(255,255,255,.25);color:#fff;border:none;width:28px;height:28px;border-radius:999px;font-size:16px;cursor:pointer}
    .body{overflow:auto;padding:10px;background:#f6f7f9}
    .empty{padding:26px 16px;text-align:center;color:#666;font-size:13px;line-height:1.5}
    .card{background:#fff;border:1px solid #e6e8eb;border-radius:12px;padding:10px;margin-bottom:10px}
    .row{display:flex;gap:8px;align-items:center}
    .num{background:#111;color:#fff;border-radius:999px;font-size:11px;font-weight:900;padding:2px 8px}
    .cat{background:#eef2f7;color:#2b5aa0;border-radius:999px;font-size:10.5px;font-weight:800;padding:2px 8px}
    .acc{color:#888;font-size:10.5px;font-weight:700;margin-left:auto}
    .tt{font-size:13.5px;font-weight:800;color:#111;margin-top:7px}
    .pr{font-size:15px;font-weight:900;color:#ff6e14;margin-top:2px}
    .ph{display:flex;gap:5px;margin-top:7px;overflow-x:auto}
    .ph img{width:52px;height:52px;object-fit:cover;border-radius:7px;flex-shrink:0;cursor:pointer;border:1px solid #e6e8eb}
    .desc{font-size:11.5px;color:#444;white-space:pre-wrap;background:#f6f7f9;border-radius:8px;padding:8px;margin-top:7px;max-height:110px;overflow:auto}
    .btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .btn{border:1px solid #d7dbe0;background:#fff;color:#222;border-radius:8px;padding:6px 10px;font-size:11.5px;font-weight:800;cursor:pointer}
    .btn.p{background:#ff6e14;color:#fff;border-color:#ff6e14}
    .btn.g{background:#0a7f3f;color:#fff;border-color:#0a7f3f}
    .hint{font-size:10.5px;color:#8a8f98;padding:4px 2px 8px;line-height:1.4}
    .toast{position:fixed;left:50%;bottom:80px;transform:translateX(-50%);background:#111;color:#fff;padding:9px 14px;border-radius:10px;font-size:12.5px;font-weight:700;opacity:0;transition:opacity .2s;z-index:2147483647}
    .remsec{border:1px solid #f0b6b0;background:#fdeceb;border-radius:12px;padding:8px;margin-bottom:10px}
    .remhd{font-size:12px;font-weight:900;color:#c0392b;margin-bottom:6px}
    .rem{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #f2cfcb;border-radius:9px;padding:7px 9px;margin-bottom:6px;font-size:12px}
    .counter{background:#fff;border:1px solid #e6e8eb;border-radius:12px;padding:9px 11px;margin-bottom:10px}
    .crow{display:flex;align-items:center;gap:6px;font-size:12.5px;color:#111}
    .cbar{height:7px;border-radius:999px;background:#eef0f2;overflow:hidden;margin-top:7px}
    .cbarfill{height:100%;border-radius:999px;transition:width .3s}
    .cmsg{font-size:11px;font-weight:700;margin-top:5px}
    .deposit{display:block;text-align:center;background:#ff6e14;color:#fff;text-decoration:none;font-size:13px;font-weight:900;padding:10px;margin:0 10px 6px;border-radius:10px}
  
  .grp{font-size:11px;font-weight:800;color:#10151b;margin:10px 2px 4px;letter-spacing:.2px}
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
           <div class="body">${photoHtml()}${counterHtml()}${preuveHtml()}${exclusHtml()}${remHtml}${unlHtml}${items.length ? listeGroupee(items) : emptyHtml()}${donePostedHtml()}</div>
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
    const onPage = pageRefs.has(String(ad.numero));
    return `<div class="card" data-id="${esc(ad.id)}">
      <div class="row"><span class="num">N°${esc(ad.numero)}</span><span class="cat">${esc(ad.category)}</span>${onPage ? '<span class="cat" style="background:#e6f6ec;color:#0a7f3f">déjà sur cette page ?</span>' : ''}<span class="acc">${esc(ad.account)}</span></div>
      <div class="tt">${esc(ad.title)}</div>
      <div class="pr">${esc(euro(ad.price))}</div>
      ${ph ? `<div class="ph">${ph}</div>` : ''}
      <div class="pko" hidden>⚠️ Une photo ne s'affiche plus (le lien Vinted a expiré). Ouvre l'annonce sur Vinted${ad.vintedUrl ? ` — <a href="${esc(ad.vintedUrl)}" target="_blank" rel="noreferrer">ici</a>` : ''} : l'extension recapte des liens frais au passage.</div>
      ${photosLigne(ad)}
      <div class="desc">${esc(ad.description)}</div>
      <div class="btns">
        <button class="btn p" data-a="prepare" style="flex:1 1 100%" title="Télécharge les photos, copie tout le texte de l'annonce et ouvre la page de dépôt Leboncoin.">🚀 Tout préparer (photos + texte + page)</button>
        <button class="btn" data-a="prefill">✍️ Pré-remplir</button>
        <button class="btn" data-a="ctitle">Titre</button>
        <button class="btn" data-a="cdesc">Description</button>
        <button class="btn" data-a="cprice">Prix</button>
        <button class="btn" data-a="photos">⬇️ Photos</button>
        <button class="btn" data-a="posted" style="border-color:#0a7f3f;color:#0a7f3f" title="À cliquer SEULEMENT après avoir publié toi-même sur Leboncoin. Ça ne publie rien, ça la retire juste de la liste.">✓ Je l'ai déjà publiée</button>
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
  async function attacherPhotos(ad) {
    const urls = (ad.photos || []).slice(0, 10);
    if (!urls.length) return { n: 0, raison: 'aucune photo à attacher' };
    const cible = champsFichier()[0];
    const zone = document.querySelector('[class*="drop"],[class*="Drop"],[data-testid*="photo"],[class*="photo"]');
    if (!cible && !zone) return { n: 0, raison: 'aucun champ photo sur cette étape' };
    const r = await send({ action: 'photoBytes', urls, max: 10 });
    const photos = (r && r.ok && Array.isArray(r.photos)) ? r.photos : [];
    const fichiers = fichiersDepuis(photos, ad.numero);
    // ⚠️ On DIT ce qui a échoué : une photo que le CDN refuse n'est pas une
    //    photo attachée, et un compte rond ne doit pas la compter.
    const rates = photos.filter((p) => p && p.erreur).length;
    if (!fichiers.length) return { n: 0, rates, raison: rates ? 'les photos n\'ont pas pu être lues' : 'aucune photo lisible' };
    try {
      const dt = new DataTransfer();
      fichiers.forEach((f) => dt.items.add(f));
      if (cible) {
        cible.files = dt.files;
        cible.dispatchEvent(new Event('input', { bubbles: true }));
        cible.dispatchEvent(new Event('change', { bubbles: true }));
        if (cible.files && cible.files.length) return { n: cible.files.length, rates };
      }
      if (zone) {
        const dt2 = new DataTransfer();
        fichiers.forEach((f) => dt2.items.add(f));
        zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt2 }));
        zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt2 }));
        return { n: fichiers.length, rates, voie: 'glisser-déposer' };
      }
      return { n: 0, rates, raison: 'le champ n\'a pas accepté les fichiers' };
    } catch (e) { return { n: 0, rates, raison: String((e && e.message) || e).slice(0, 60) }; }
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
    if (!faits.length) {
      copy(ad.title + '\n\n' + ad.description);
      toast('Aucun champ reconnu sur cette page — titre + description copiés (la réf ' + ref + ' est dedans). Le dépôt Leboncoin se fait en plusieurs étapes : reviens cliquer ici à l\'étape du titre.');
      return;
    }
    const manque = refMise ? '' : ' La référence ' + ref + ' n\'a PAS pu être mise dans un champ : elle est dans la description (en haut et en bas) — garde-la, c\'est elle qui relie l\'annonce à ta paire.';
    toast(faits.length + ' champ' + (faits.length > 1 ? 's' : '') + ' rempli' + (faits.length > 1 ? 's' : '') + ' : ' + faits.join(', ') + '.' + manque + ' Vérifie la catégorie « ' + ad.category + ' » et les photos, puis publie.');
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
        fields.push({ tag: el.tagName.toLowerCase(), type: el.type || '', name: el.name || '', id: el.id || '', ph: el.placeholder || '', aria: el.getAttribute('aria-label') || '', label: libelleDe(el), qa: el.getAttribute('data-qa-id') || el.getAttribute('data-testid') || '', rempli: !!val.trim(), len: val.length });
      });
      const sels = listesDeroulantes();
      const fichiers = tousLesNoeuds('input[type="file"]').length;
      const categorie = categorieCourante(sels);
      // La signature dédoublonne les étapes identiques — mais deux CATÉGORIES
      // donnent deux formulaires différents, donc la catégorie en fait partie.
      const signature = fields.map((f) => f.name || f.id).join('|') + '#' + sels.length + '#' + fichiers + (categorie ? '#' + categorie.slice(0, 40) : '');
      if (signature === derniereEtape) return;
      derniereEtape = signature;
      if (fields.length || sels.length || fichiers) {
        ordreEtape++;
        chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcForm', url: location.href,
          fields: fields.slice(0, 150), selects: sels.slice(0, 30), fichiers,
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
      const nbPh = (ad.photos || []).length;
      copy('TITRE :\n' + ad.title + '\n\nDESCRIPTION :\n' + ad.description + '\n\nPRIX : ' + ad.price + ' €\nRÉFÉRENCE : ' + (ad.ref || ('VRM-' + ad.numero)) + '\nCATÉGORIE : ' + ad.category);
      // ON MEMORISE L'ANNONCE EN COURS. C'est ce qui manquait : la page de depot
      // s'ouvrait dans un NOUVEL onglet, qui n'avait aucune idee de la paire
      // choisie — donc rien n'etait rempli et il fallait tout recoller a la main.
      await send({ action: 'setPending', ad });
      window.open('https://www.leboncoin.fr/deposer-une-annonce', '_blank');
      toast('🚀 ' + nbPh + ' photo' + (nbPh > 1 ? 's' : '') + ' prête' + (nbPh > 1 ? 's' : '') + ' — le formulaire se remplit dans le nouvel onglet, photos comprises. Rien n\'est téléchargé sur ton ordinateur.');
    }
    else if (a === 'prefill') { prefill(ad); }
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
  function fillNow(ad) {
    let n = 0;
    if (setIfEmpty(findField([/titre|title|subject|proposez/]), ad.title)) n++;
    { const d = poserDescription(ad); if (d.fait || d.ref) n++; }   // jamais d'écrasement ; la réf est garantie
    if (poserPrix(ad.price, true)) n++;   // §11 : le prix a UNE règle (centimes), une seule
    if (setIfEmpty(findField([/référ|referen|\bref\b|\bsku\b|identifiant|code.?article|numéro.?article/]), ad.ref || ('VRM-' + ad.numero))) n++;
    // ⚠️ « ça ne met pas la catégorie ni le reste » (Julien, 13 septembre). Les
    //    listes déroulantes ne sont pas des `input` : `findField` ne les voyait
    //    même pas. On les traite, et on ne choisit QUE si une option correspond
    //    vraiment — sinon on laisse vide. Une catégorie fausse fait plus de mal
    //    que pas de catégorie (leçon eBay).
    if (choisirListe([/cat[ée]gorie|category|rubrique/], [ad.category, 'Chaussures'])) n++;
    if (choisirListe([/[ée]tat|condition|state/], ['Très bon état', 'Bon état', 'Satisfaisant'])) n++;
    if (choisirListe([/marque|brand/], [ad.marque])) n++;
    if (choisirListe([/pointure|taille|size/], [ad.taille])) n++;
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
            ? '📷 <b style="color:#eef4f0">' + photosEtat.n + ' photo' + (photosEtat.n > 1 ? 's' : '') + ' attachée' + (photosEtat.n > 1 ? 's' : '') + '</b>' + (photosEtat.rates ? ' (' + photosEtat.rates + ' illisible' + (photosEtat.rates > 1 ? 's' : '') + ')' : '')
            : '📷 aucune photo attachée — ' + esc(photosEtat.raison || 'raison inconnue'))
        : '📷 j\'attache les photos dès que l\'étape photo s\'affiche.') + '</div>' +
      (pendingArrete
        ? '<div style="color:#e8b35d;margin-top:6px">Je ne remplis plus tout seul (c\'est fini après 1 min 30). Le dépôt se fait en plusieurs étapes : à chaque nouvelle étape, clique <b style="color:#eef4f0">Re-remplir</b>.</div>'
        : '') +
      '<div style="display:flex;gap:6px;margin-top:9px">' +
      '<button id="vrm-refill" style="flex:1;border:1px solid #3a4a43;background:transparent;color:#eef4f0;border-radius:9px;padding:7px;font-size:11.5px;font-weight:600;cursor:pointer">Re-remplir</button>' +
      '<button id="vrm-cdesc" style="flex:1;border:1px solid #3a4a43;background:transparent;color:#eef4f0;border-radius:9px;padding:7px;font-size:11.5px;font-weight:600;cursor:pointer">Copier la description</button>' +
      '<button id="vrm-close" title="Fermer" style="border:1px solid #3a4a43;background:transparent;color:#8b9b92;border-radius:9px;padding:7px 9px;font-size:11.5px;cursor:pointer">✕</button>' +
      '</div>' +
      '<div style="color:#6f7f77;font-size:10px;margin-top:7px">VRM ne publie jamais à ta place : relis et clique toi-même sur Publier.</div>';
    el.querySelector('#vrm-refill').onclick = () => {
      pendingDone = fillNowForce(pending);
      // Et on RELANCE la surveillance : sans ça, « Re-remplir » ne servait
      // qu'une fois, et l'étape suivante repartait dans le silence.
      pendingArrete = false; pendingTries = 0;
      clearInterval(pendingTimer);
      pendingTimer = setInterval(() => {
        pendingTries++;
        const n2 = fillNow(pending);
        if (n2 > pendingDone) { pendingDone = n2; banner(); }
        if (pendingTries > 90) { clearInterval(pendingTimer); pendingArrete = true; banner(); }
      }, 1000);
      banner();
    };
    el.querySelector('#vrm-cdesc').onclick = () => { copy(pending.description || ''); toast('Description copiée'); };
    el.querySelector('#vrm-close').onclick = () => { clearInterval(pendingTimer); el.remove(); send({ action: 'setPending', ad: null }); };
  }
  function fillNowForce(ad) {
    let n = 0;
    if (setField(findField([/titre|title|subject/]), ad.title)) n++;
    { const d = poserDescription(ad); if (d.fait || d.ref) n++; }   // même face à « Re-remplir » : on n'écrase pas l'auto-description de Leboncoin
    if (poserPrix(ad.price)) n++;   // §11 : la même règle de prix que partout
    if (setField(findField([/référ|referen|\bref\b|\bsku\b|identifiant|code.?article|numéro.?article/]), ad.ref || ('VRM-' + ad.numero))) n++;
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
