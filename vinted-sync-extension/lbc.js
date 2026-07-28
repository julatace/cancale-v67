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
  const send = (m) => new Promise((res) => { try { chrome.runtime.sendMessage(Object.assign({ from: 'cancale-lbc' }, m), (r) => res(r || { ok: false })); } catch (_) { res({ ok: false }); } });

  // L'observateur réseau MAIN world (lbc-inject.js) est injecté via le manifest
  // (content_script world:MAIN) → immunisé à la CSP de Leboncoin. Ici on ne fait
  // que RELAYER au background ce qu'il capte (window.postMessage).
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const d = event.data; if (!d || d.__tag !== 'CANCALE_LBC') return;
    if (d.kind === 'lbcraw' && d.body) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcRaw', url: d.url, body: d.body }); } catch (_) {} }
    else if (d.kind === 'lbcpaths' && d.paths) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcPaths', paths: d.paths, url: location.href }); } catch (_) {} }
  }, false);

  let queue = [];
  let removals = []; // paires vendues sur Vinted → à retirer de Leboncoin
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
  function captureLbcListings() {
    let listings = [];
    try {
      const el = document.getElementById('__NEXT_DATA__');
      if (el && el.textContent) {
        const data = JSON.parse(el.textContent);
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
              });
            }
          }
          for (const k in node) { if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k], depth + 1); }
        };
        walk(data, 0);
        listings = found;
      }
    } catch (_) {}
    if (listings.length) {
      send({ action: 'lbcCapture', url: location.href, listings });
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
  `;

  let open = false;
  function render() {
    const items = queue;
    const badge = items.length + (removals.length ? '+' + removals.length : '');
    const remHtml = removals.length
      ? `<div class="remsec"><div class="remhd">🔴 ${removals.length} vendue${removals.length > 1 ? 's' : ''} sur Vinted — à retirer de Leboncoin</div>${removals.map(remHtmlOne).join('')}</div>`
      : '';
    root.innerHTML = `<style>${css}</style>` + (open
      ? `<div class="panel">
           <div class="hd"><span class="t">🟠 ${items.length} à publier${removals.length ? ' · ' + removals.length + ' à retirer' : ''}</span>
             <button data-a="refresh" title="Rafraîchir">⟳</button>
             <button data-a="close" title="Fermer">×</button></div>
           <a class="deposit" href="https://www.leboncoin.fr/deposer-une-annonce" target="_blank" rel="noreferrer">➕ Déposer une annonce sur Leboncoin</a>
           <div class="body">${photoHtml()}${counterHtml()}${remHtml}${items.length ? items.map(cardHtml).join('') : emptyHtml()}${donePostedHtml()}</div>
           <div class="hint">1) Clique <b>➕ Déposer une annonce</b>. 2) Sur la page, clique <b>✍️ Pré-remplir</b> sur la paire voulue. 3) Vérifie et publie toi-même. Rien n&#39;est publié automatiquement.</div>
         </div>`
      : `<button class="fab" data-a="open">🟠 VRM <span class="b">${badge}</span></button>`);
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
  function remHtmlOne(r) {
    return `<div class="rem" data-rid="${esc(r.id)}">
      <div style="flex:1;min-width:0"><b>N°${esc(r.numero)}</b> ${esc((r.title || '').slice(0, 34))}<div style="font-size:10.5px;color:#a33">cherche « ${esc(r.ref)} » dans tes annonces Leboncoin et supprime-la</div></div>
      <button class="btn" data-a="removed" style="border-color:#c0392b;color:#c0392b">✓ Retirée</button>
    </div>`;
  }
  function cardHtml(ad) {
    const ph = (ad.photos || []).slice(0, 6).map((u) => `<img src="${esc(u)}" data-full="${esc(u)}" title="Ouvrir la photo">`).join('');
    const onPage = pageRefs.has(String(ad.numero));
    return `<div class="card" data-id="${esc(ad.id)}">
      <div class="row"><span class="num">N°${esc(ad.numero)}</span><span class="cat">${esc(ad.category)}</span>${onPage ? '<span class="cat" style="background:#e6f6ec;color:#0a7f3f">déjà sur cette page ?</span>' : ''}<span class="acc">${esc(ad.account)}</span></div>
      <div class="tt">${esc(ad.title)}</div>
      <div class="pr">${esc(ad.price)} €</div>
      ${ph ? `<div class="ph">${ph}</div>` : ''}
      <div class="desc">${esc(ad.description)}</div>
      <div class="btns">
        <button class="btn p" data-a="prefill">✍️ Pré-remplir le formulaire</button>
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
  function copy(t) { try { navigator.clipboard.writeText(t); } catch (_) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) {} ta.remove(); } }

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
  function findField(patterns) {
    const els = Array.from(document.querySelectorAll('input, textarea'));
    for (const p of patterns) {
      for (const el of els) {
        const hay = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.placeholder || '')).toLowerCase();
        if (p.test(hay)) return el;
      }
    }
    return null;
  }
  function prefill(ad) {
    let n = 0;
    if (setField(findField([/titre|title|subject/]), ad.title)) n++;
    if (setField(findField([/description|texte|body|détail|detail/]), ad.description)) n++;
    if (setField(findField([/prix|price|montant/]), ad.price)) n++;
    // Champ RÉFÉRENCE des comptes PRO : on y met VRM-{N°} → pas besoin de le mettre
    // dans le titre, et tu peux rechercher la paire par ce numéro dans ton profil.
    if (setField(findField([/référ|referen|\bref\b|\bsku\b|identifiant|code.?article|numéro.?article/]), ad.ref || ('VRM-' + ad.numero))) n++;
    if (n) toast(n + ' champ' + (n > 1 ? 's' : '') + ' pré-rempli' + (n > 1 ? 's' : '') + ' (dont la réf ' + (ad.ref || ('VRM-' + ad.numero)) + ') — vérifie la catégorie « ' + ad.category + ' » et les photos, puis publie.');
    else { copy(ad.title + '\n\n' + ad.description); toast('Formulaire non détecté sur cette page — titre + description copiés.'); }
  }
  // Capture la STRUCTURE du formulaire de dépôt Leboncoin (noms/libellés des champs)
  // pour que je puisse brancher le pré-remplissage exactement (réf, catégorie…).
  function captureDepositForm() {
    try {
      if (!/depos|d[ée]p[oô]t|\/ai\/|creation|nouvelle-annonce/i.test(location.href)) return;
      const fields = [];
      document.querySelectorAll('input, select, textarea').forEach((el) => {
        fields.push({ tag: el.tagName.toLowerCase(), type: el.type || '', name: el.name || '', id: el.id || '', ph: el.placeholder || '', aria: el.getAttribute('aria-label') || '', label: ((el.labels && el.labels[0] && el.labels[0].innerText) || '').slice(0, 50), qa: el.getAttribute('data-qa-id') || el.getAttribute('data-testid') || '' });
      });
      if (fields.length) chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcForm', url: location.href, fields: fields.slice(0, 150) });
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
    else if (a === 'prefill') { prefill(ad); }
    else if (a === 'posted') {
      if (!confirm('⚠️ Ceci NE publie PAS l\'annonce.\n\nÀ cliquer seulement si tu as DÉJÀ publié la N°' + ad.numero + ' toi-même sur Leboncoin.\nÇa la retire juste de la liste « à publier ». Continuer ?')) return;
      await send({ action: 'markPosted', id: ad.id });
      queue = queue.filter((x) => x.id !== ad.id); render(); toast('N°' + ad.numero + ' retirée de la liste (tu peux annuler dans « déjà publiées »)');
    }
  });

  async function load() {
    scanPageRefs();
    captureLbcListings();
    captureDepositForm();
    const r = await send({ action: 'getQueue' });
    loadError = !(r && r.ok);
    queue = (r && r.ok && Array.isArray(r.queue)) ? r.queue : [];
    removals = (r && r.ok && Array.isArray(r.removals)) ? r.removals : [];
    postedList = (r && r.ok && Array.isArray(r.postedList)) ? r.postedList : [];
    if (r && r.ok && r.stats) stats = r.stats;
    render();
  }
  render();
  load();
  // Rafraîchit quand on revient sur l'onglet (nouvelle annonce entre-temps) et
  // re-scanne la page après navigation interne (Leboncoin est une SPA).
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  let lastUrl = location.href;
  setInterval(() => { if (location.href !== lastUrl) { lastUrl = location.href; setTimeout(load, 1200); } }, 2000);
})();
