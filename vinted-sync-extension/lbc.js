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

  let queue = [];
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
  `;

  let open = false;
  function render() {
    const items = queue;
    root.innerHTML = `<style>${css}</style>` + (open
      ? `<div class="panel">
           <div class="hd"><span class="t">🟠 ${items.length} annonce${items.length > 1 ? 's' : ''} à publier</span>
             <button data-a="refresh" title="Rafraîchir">⟳</button>
             <button data-a="close" title="Fermer">×</button></div>
           <div class="body">${items.length ? items.map(cardHtml).join('') : '<div class="empty">Rien à publier pour le moment.<br>Dès qu&#39;une annonce numérotée est en ligne sur Vinted, elle apparaît ici.</div>'}</div>
           <div class="hint">Sur « Déposer une annonce », clique <b>Pré-remplir</b> puis vérifie et publie toi-même. Rien n&#39;est publié automatiquement.</div>
         </div>`
      : `<button class="fab" data-a="open">🟠 VRM <span class="b">${items.length}</span></button>`);
  }
  function cardHtml(ad) {
    const ph = (ad.photos || []).slice(0, 6).map((u) => `<img src="${esc(u)}" data-full="${esc(u)}" title="Ouvrir la photo">`).join('');
    return `<div class="card" data-id="${esc(ad.id)}">
      <div class="row"><span class="num">N°${esc(ad.numero)}</span><span class="cat">${esc(ad.category)}</span><span class="acc">${esc(ad.account)}</span></div>
      <div class="tt">${esc(ad.title)}</div>
      <div class="pr">${esc(ad.price)} €</div>
      ${ph ? `<div class="ph">${ph}</div>` : ''}
      <div class="desc">${esc(ad.description)}</div>
      <div class="btns">
        <button class="btn p" data-a="prefill">✍️ Pré-remplir</button>
        <button class="btn" data-a="ctitle">Titre</button>
        <button class="btn" data-a="cdesc">Description</button>
        <button class="btn" data-a="cprice">Prix</button>
        <button class="btn" data-a="photos">📷 Photos</button>
        <button class="btn g" data-a="posted">✓ Publiée</button>
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
    if (n) toast(n + ' champ' + (n > 1 ? 's' : '') + ' pré-rempli' + (n > 1 ? 's' : '') + ' — vérifie la catégorie « ' + ad.category + ' » et les photos, puis publie.');
    else { copy(ad.title + '\n\n' + ad.description); toast('Formulaire non détecté sur cette page — titre + description copiés.'); }
  }

  root.addEventListener('click', async (e) => {
    const a = e.target.getAttribute && e.target.getAttribute('data-a');
    if (e.target.tagName === 'IMG' && e.target.dataset.full) { window.open(e.target.dataset.full, '_blank'); return; }
    if (!a) return;
    if (a === 'open') { open = true; render(); return; }
    if (a === 'close') { open = false; render(); return; }
    if (a === 'refresh') { await load(); toast('Actualisé'); return; }
    const card = e.target.closest('.card'); const id = card && card.getAttribute('data-id');
    const ad = queue.find((x) => x.id === id); if (!ad && a !== 'open') return;
    if (a === 'ctitle') { copy(ad.title); toast('Titre copié'); }
    else if (a === 'cdesc') { copy(ad.description); toast('Description copiée'); }
    else if (a === 'cprice') { copy(ad.price); toast('Prix copié'); }
    else if (a === 'photos') { (ad.photos || []).forEach((u, i) => setTimeout(() => window.open(u, '_blank'), i * 250)); toast('Photos ouvertes — enregistre-les pour les déposer'); }
    else if (a === 'prefill') { prefill(ad); }
    else if (a === 'posted') {
      if (!confirm('Marquer la N°' + ad.numero + ' comme publiée sur Leboncoin ?\nElle disparaîtra de la liste à publier.')) return;
      await send({ action: 'markPosted', id: ad.id });
      queue = queue.filter((x) => x.id !== ad.id); render(); toast('N°' + ad.numero + ' marquée publiée ✓');
    }
  });

  async function load() {
    const r = await send({ action: 'getQueue' });
    queue = (r && r.ok && Array.isArray(r.queue)) ? r.queue : [];
    render();
  }
  render();
  load();
  // Rafraîchit quand on revient sur l'onglet (nouvelle annonce entre-temps).
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
})();
