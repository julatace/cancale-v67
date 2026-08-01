// vinted-panel.js — LE PANNEAU VRM, DIRECTEMENT SUR VINTED.
//
// But : quand tu navigues sur Vinted, avoir SOUS LES YEUX ce que ton app sait
// déjà — le N° de la paire, son prix d'achat, sa case au garage, sa marge, et
// la liste des paires à relancer. Plus besoin de faire des allers-retours entre
// Vinted et l'app.
//
// ⚠️ CE PANNEAU N'AGIT JAMAIS À TA PLACE. Il lit tes données (Supabase) et les
// affiche. Aucune requête vers Vinted, aucun clic automatisé, aucun message
// envoyé : c'est TOI qui cliques sur Vinted. C'est ce qui le rend sûr pour tes
// comptes (rien qui ressemble à un robot).

(() => {
  if (window.__vrmPanelLoaded) return;
  window.__vrmPanelLoaded = true;

  const APP_URL = 'https://cancale-v67-ten.vercel.app';
  let DATA = null;
  let open = false;
  let tab = 'paire'; // paire | relance | sansnum

  const eur = (v) => (v == null || v === '' ? null : Number(v));
  const fmt = (v) => { const n = eur(v); return n == null || isNaN(n) ? '—' : n.toFixed(2).replace('.', ',') + ' €'; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Id de l'annonce affichée si on est sur une page article (/items/123456-titre).
  const currentItemId = () => {
    const m = /\/items\/(\d+)/.exec(location.pathname);
    return m ? m[1] : null;
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #vrm-fab{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:52px;height:52px;border-radius:999px;
      background:#09b1ba;color:#fff;border:none;cursor:pointer;font:800 18px/1 system-ui,-apple-system,sans-serif;
      box-shadow:0 6px 20px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center}
    #vrm-fab:hover{transform:scale(1.05)}
    #vrm-fab .vrm-badge{position:absolute;top:-4px;right:-4px;background:#e8590c;color:#fff;border-radius:999px;
      min-width:20px;height:20px;padding:0 5px;font:800 11px/20px system-ui,sans-serif;text-align:center}
    #vrm-panel{position:fixed;right:18px;bottom:80px;z-index:2147483000;width:340px;max-height:74vh;overflow:auto;
      background:#fff;color:#111;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.3);
      font:13px/1.45 system-ui,-apple-system,sans-serif;padding:14px}
    #vrm-panel h3{margin:0 0 2px;font-size:15px;font-weight:800}
    #vrm-panel .vrm-sub{color:#667;font-size:11.5px;margin-bottom:10px}
    #vrm-panel .vrm-tabs{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
    #vrm-panel .vrm-tab{border:1px solid #dde;background:#fff;color:#334;border-radius:999px;padding:5px 10px;
      font:700 11.5px system-ui,sans-serif;cursor:pointer}
    #vrm-panel .vrm-tab.on{background:#09b1ba;border-color:#09b1ba;color:#fff}
    #vrm-panel .vrm-card{border:1px solid #e6e8ee;border-radius:12px;padding:10px;margin-bottom:8px}
    #vrm-panel .vrm-num{display:inline-block;background:#09b1ba;color:#fff;border-radius:8px;padding:2px 9px;font-weight:800}
    #vrm-panel .vrm-row{display:flex;gap:9px;align-items:center}
    #vrm-panel .vrm-row img{width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;background:#eee}
    #vrm-panel .vrm-t{font-weight:700;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #vrm-panel .vrm-m{color:#667;font-size:11px}
    #vrm-panel a.vrm-link{color:#09b1ba;font-weight:800;text-decoration:none;font-size:11.5px}
    #vrm-panel .vrm-stats{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
    #vrm-panel .vrm-st{flex:1;min-width:72px;border:1px solid #e6e8ee;border-radius:10px;padding:7px 9px}
    #vrm-panel .vrm-st b{display:block;font-size:16px}
    #vrm-panel .vrm-close{float:right;border:none;background:transparent;cursor:pointer;font-size:16px;color:#889}
    @media (prefers-color-scheme: dark){
      #vrm-panel{background:#161a20;color:#e8eef5}
      #vrm-panel .vrm-card,#vrm-panel .vrm-st{border-color:#2a3038}
      #vrm-panel .vrm-tab{background:#1e242c;border-color:#2a3038;color:#cfd8e3}
    }`;
  document.documentElement.appendChild(style);

  const fab = document.createElement('button');
  fab.id = 'vrm-fab';
  fab.title = 'VRM — mes infos sur cette paire';
  fab.innerHTML = 'VRM';
  document.documentElement.appendChild(fab);

  const panel = document.createElement('div');
  panel.id = 'vrm-panel';
  panel.style.display = 'none';
  document.documentElement.appendChild(panel);

  const card = (o, extra) => `
    <div class="vrm-card">
      <div class="vrm-row">
        ${o.photo ? `<img src="${esc(o.photo)}" alt="">` : '<img alt="">'}
        <div style="flex:1;min-width:0">
          <div class="vrm-t">${o.numero ? `<span class="vrm-num">N°${esc(o.numero)}</span> ` : ''}${esc(o.title)}</div>
          <div class="vrm-m">${fmt(o.price)}${o.ageDays != null ? ` · en ligne depuis ${o.ageDays} j` : ''}${o.views != null ? ` · 👁 ${o.views}` : ''}${o.favs != null ? ` · ❤️ ${o.favs}` : ''}</div>
          ${extra || ''}
        </div>
      </div>
      <div style="margin-top:7px"><a class="vrm-link" href="${esc(o.url)}" target="_blank" rel="noreferrer">Ouvrir l'annonce ↗</a></div>
    </div>`;

  function renderPaire() {
    const id = currentItemId();
    if (!id) return `<div class="vrm-m">Ouvre une de tes annonces sur Vinted pour voir son N°, son prix d'achat et sa case au garage ici.</div>`;
    const o = DATA && DATA.byId ? DATA.byId[id] : null;
    if (!o) return `<div class="vrm-m">Cette annonce n'est pas (encore) dans tes annonces en ligne captées.<br>Ouvre ta boutique une fois pour la capter.</div>`;
    const buy = eur(o.buyPrice), sell = eur(o.price);
    const marge = (buy != null && sell != null && !isNaN(buy)) ? sell - buy : null;
    const extra = `<div class="vrm-m" style="margin-top:3px">
        ${o.buyPrice != null ? `Achat ${fmt(o.buyPrice)}` : '<b>Prix d\'achat non renseigné</b>'}
        ${marge != null ? ` · Marge <b>${fmt(marge)}</b>` : ''}
        ${o.cell ? ` · 🏠 case <b>${esc(o.cell)}</b>` : (o.numero ? ' · 🏠 pas rangée' : '')}
      </div>`;
    return card(o, extra);
  }

  function renderList(list, empty, hint) {
    if (!list || !list.length) return `<div class="vrm-m">${empty}</div>`;
    return (hint ? `<div class="vrm-m" style="margin-bottom:8px">${hint}</div>` : '') + list.slice(0, 40).map(o => card(o)).join('');
  }

  function render() {
    const s = (DATA && DATA.stats) || { online: 0, relance: 0, noNum: 0, value: 0 };
    panel.innerHTML = `
      <button class="vrm-close" title="Fermer">✕</button>
      <h3>VRM</h3>
      <div class="vrm-sub">Tes infos, affichées sur Vinted. Les actions restent les tiennes.</div>
      <div class="vrm-stats">
        <div class="vrm-st"><b>${s.online}</b><span class="vrm-m">en ligne</span></div>
        <div class="vrm-st"><b>${s.relance || 0}</b><span class="vrm-m">à relancer</span></div>
        <div class="vrm-st"><b>${s.noNum}</b><span class="vrm-m">sans N°</span></div>
      </div>
      <div class="vrm-tabs">
        <button class="vrm-tab ${tab === 'paire' ? 'on' : ''}" data-t="paire">Cette paire</button>
        <button class="vrm-tab ${tab === 'relance' ? 'on' : ''}" data-t="relance">À relancer 💡</button>
        <button class="vrm-tab ${tab === 'sansnum' ? 'on' : ''}" data-t="sansnum">Sans N°</button>
      </div>
      <div id="vrm-body">${
        !DATA ? '<div class="vrm-m">Chargement…</div>'
        : tab === 'paire' ? renderPaire()
        : tab === 'relance' ? renderList(DATA.relance, 'Rien à relancer : tes annonces accrochent bien. 👌', 'Beaucoup vues mais peu mises en favori <b>par rapport à tes autres annonces</b> → le prix est sans doute trop haut. Ouvre-les et baisse le prix toi-même.')
        : renderList(DATA.noNum, 'Toutes tes annonces ont un N°. 👌', 'Ces annonces n\'ont pas encore de numéro dans ton app.')
      }</div>
      <div style="margin-top:10px;text-align:center">
        <a class="vrm-link" href="${APP_URL}" target="_blank" rel="noreferrer">Ouvrir l'app VRM ↗</a>
      </div>`;
    panel.querySelector('.vrm-close').onclick = () => toggle(false);
    panel.querySelectorAll('.vrm-tab').forEach(b => { b.onclick = () => { tab = b.dataset.t; render(); }; });
  }

  function load() {
    try {
      chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'panelData' }, (resp) => {
        if (chrome.runtime.lastError) { DATA = { stats: {}, byId: {}, relance: [], noNum: [] }; render(); return; }
        DATA = (resp && resp.ok) ? resp : { stats: {}, byId: {}, relance: [], noNum: [] };
        render();
        // Pastille : nombre de paires à relancer.
        const n = (DATA.relance || []).length;
        const old = fab.querySelector('.vrm-badge'); if (old) old.remove();
        if (n > 0) { const b = document.createElement('span'); b.className = 'vrm-badge'; b.textContent = n > 99 ? '99+' : String(n); fab.appendChild(b); }
      });
    } catch (_) { /* extension rechargée */ }
  }

  function toggle(v) {
    open = v == null ? !open : v;
    panel.style.display = open ? 'block' : 'none';
    if (open) { render(); if (!DATA) load(); }
  }
  fab.onclick = () => toggle();

  // Navigation interne Vinted (SPA) : si on change d'annonce, on rafraîchit
  // l'onglet « Cette paire » sans recharger les données.
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) { lastPath = location.pathname; if (open && tab === 'paire') render(); }
  }, 800);

  load(); // pastille dès l'arrivée sur Vinted
})();
