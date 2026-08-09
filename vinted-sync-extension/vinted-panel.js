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
  // ── Mémoire de navigation du panneau (localStorage, partagé entre onglets
  //    Vinted) : on garde OUVERT/FERMÉ et l'onglet actif d'une page à l'autre.
  //    Sinon, dès que tu navigues (ou qu'un flux t'ouvre une annonce dans un
  //    nouvel onglet), le panneau se refermait et repartait sur « Cette paire »,
  //    te faisant perdre ta place au milieu d'un tri de bordereaux/messages.
  //    Le ✕ pose OUVERT=faux (respecté partout) ; c'est purement ta position,
  //    aucune donnée ni action Vinted là-dedans.
  const PANEL_TABS = ['journee', 'paire', 'chaussures', 'republier', 'reponse', 'expedier', 'achats', 'messages', 'favoris'];
  let chaussuresQuery = ''; // filtre de l'onglet « Mes paires »
  let chaussuresSort = 'num'; // tri : num | marge | vues | favs | age | prix
  let chaussuresFilter = 'all'; // sous-vue : all | relance | sleep | nonum
  const readLS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
  let open = readLS('vrm_panel_open', '0') === '1';
  let tab = (() => { const t = readLS('vrm_panel_tab', 'journee'); return PANEL_TABS.includes(t) ? t : 'journee'; })(); // journee | paire | relance | dorment | sansnum | republier | reponse | expedier | achats | messages | favoris
  // ── File de republication ASSISTÉE ─────────────────────────────────────────
  // repubSel = les annonces cochées. repubRun = le défilement une-par-une en
  // cours ({ queue:[ids], idx }). ⚠️ AUCUNE automatisation : le panneau OUVRE
  // l'annonce, c'est TOI qui republies sur Vinted, puis tu passes à la suivante.
  // Pas de file qui s'exécute seule, pas de délai, pas de requête envoyée à ta
  // place — c'est ce qui protège tes comptes.
  const repubSel = new Set();
  let repubRun = null;
  let repubQuery = ''; // filtre texte de la liste Republier (gardé entre rendus)
  // ── Assistant de RÉPONSE (Messaging Intelligence) : tu colles le message de
  //    l'acheteur, l'IA propose des réponses ; tu relis et tu envoies TOI-MÊME
  //    sur Vinted (rien n'est envoyé automatiquement). État gardé entre rendus.
  let repMsg = '';
  let repResult = null;
  let repBusy = false;
  // ── File de BORDEREAUX pilotée par TA sélection ────────────────────────────
  // shipSel = ventes cochées. shipRun = défilement une-par-une ({queue, idx}).
  // Même principe que la republication : TU sélectionnes, l'extension t'ouvre
  // chaque vente, TU cliques « Générer le bordereau » sur Vinted (bouton natif),
  // elle capte le PDF, puis « Suivante ». L'extension n'appuie JAMAIS le bouton à
  // ta place — c'est ce geste (un script qui clique) que Vinted sanctionne.
  const shipSel = new Set();
  let shipRun = null;
  // Bordereaux marqués « ✓ Traité » pendant cette session : on les garde visibles
  // dans une petite section « Traités » avec un « ↺ Remettre » (annulation), au
  // lieu de les faire disparaître d'un coup. Après un rechargement, la moisson les
  // exclut d'elle-même (buildPanelData lit panel_bords_done).
  const bordDoneLocal = new Set();
  let bordQuery = ''; // filtre texte de la liste « bordereaux à imprimer »
  // Mêmes files pilotées par TA sélection pour : répondre aux messages, et
  // relancer les personnes qui ont mis en favori (offre native Vinted). Tu
  // sélectionnes, l'extension t'ouvre chaque élément, TU agis (réponds / proposes),
  // puis Suivante. Aucun message ni aucune offre envoyés automatiquement.
  const msgSel = new Set();
  let msgRun = null;
  const favSel = new Set();
  let favRun = null;
  // Colis marqués « ✓ Récupéré » cette session (annulables tant que pas rechargé).
  const pickupDoneLocal = new Set();
  let dataBusy = false; // rafraîchissement des données en cours (icône ⏳)
  let lastLoad = 0;     // horodatage du dernier chargement (pour rafraîchir à l'ouverture si périmé)

  const eur = (v) => (v == null || v === '' ? null : Number(v));
  const fmt = (v) => { const n = eur(v); return n == null || isNaN(n) ? '—' : n.toFixed(2).replace('.', ',') + ' €'; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const timeago = (t) => { const s = Math.max(0, (Date.now() - Number(t || 0)) / 1000); return s < 60 ? "à l'instant" : s < 3600 ? `il y a ${Math.floor(s / 60)} min` : s < 86400 ? `il y a ${Math.floor(s / 3600)} h` : `il y a ${Math.floor(s / 86400)} j`; };

  // Champ de réponse de la conversation Vinted (le plus grand textarea /
  // contenteditable visible). Sert à INSÉRER la réponse rédigée par l'IA — c'est
  // toujours TOI qui relis et qui cliques « Envoyer » sur Vinted (rien n'est
  // envoyé automatiquement).
  function findReplyField() {
    const sel = 'textarea, [contenteditable="true"], input[type="text"]';
    const nodes = [...document.querySelectorAll(sel)].filter(n => n.offsetParent !== null && !panel.contains(n));
    return nodes.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight))[0] || null;
  }
  function insertReply(text) {
    const f = findReplyField();
    if (!f) { try { navigator.clipboard.writeText(text); } catch (_) {} return 'copied'; }
    if (f.isContentEditable) { f.focus(); try { document.execCommand('insertText', false, text); } catch (_) { f.textContent = text; } }
    else { f.focus(); f.value = text; f.dispatchEvent(new Event('input', { bubbles: true })); }
    return 'inserted';
  }

  // Id de l'annonce affichée si on est sur une page article (/items/123456-titre).
  const currentItemId = () => {
    const m = /\/items\/(\d+)/.exec(location.pathname);
    return m ? m[1] : null;
  };
  // Sur une page de conversation (/inbox/123…) : sert à mettre l'assistant de
  // réponse en avant automatiquement (contexte).
  const isConvPage = () => /\/inbox\/[\w-]+/.test(location.pathname);
  const currentConvId = () => { const m = /\/inbox\/(\d+)/.exec(location.pathname); return m ? m[1] : null; };

  // ── DATE DE MISE EN LIGNE (« Ajouté il y a … », bas de l'annonce) ──────────
  // Vinted affiche l'ancienneté sur la page de l'annonce, mais ne la renvoie pas
  // dans les données du dressing. Comme ce panneau tourne DÉJÀ sur la page, on
  // lit simplement ce qui est affiché — zéro requête supplémentaire — et on le
  // mémorise. Au fil de ta navigation, on constitue la vraie ancienneté de
  // chaque annonce, ce qui rend le « qui dort » enfin fiable.
  const REL = [
    [/(\d+)\s*(?:minute|min)/i, 60e3],
    [/(\d+)\s*(?:heure|h)\b/i, 3600e3],
    [/(\d+)\s*jour/i, 86400e3],
    [/(\d+)\s*semaine/i, 7 * 86400e3],
    [/(\d+)\s*mois/i, 30 * 86400e3],
    [/(\d+)\s*an/i, 365 * 86400e3],
  ];
  function parseFrRelative(txt) {
    const s = String(txt || '');
    if (/à l'instant|maintenant/i.test(s)) return Date.now();
    for (const [re, ms] of REL) {
      const m = re.exec(s);
      if (m) return Date.now() - Number(m[1]) * ms;
    }
    return null;
  }
  // Cherche la date sur la page : d'abord un <time datetime>, sinon le texte
  // « Ajouté il y a … ». Best-effort et défensif : si Vinted change sa page, on
  // renvoie simplement null (le panneau affiche alors juste sans l'ancienneté).
  function readListingDateFromPage() {
    try {
      for (const t of document.querySelectorAll('time[datetime]')) {
        const v = Date.parse(t.getAttribute('datetime'));
        if (!isNaN(v)) return { ts: v, text: (t.textContent || '').trim() };
      }
      const nodes = document.querySelectorAll('div,span,p,li');
      for (const n of nodes) {
        const txt = (n.textContent || '').trim();
        if (txt.length > 80) continue;
        if (!/ajout[ée]/i.test(txt)) continue;
        const ts = parseFrRelative(txt);
        if (ts) return { ts, text: txt };
      }
    } catch (_) { /* page inattendue */ }
    return null;
  }
  // ── DESCRIPTION + PHOTOS HD ────────────────────────────────────────────────
  // Vinted ne renvoie plus le détail d'une annonce par son API quand on la
  // consulte (la page est rendue côté serveur). On lit donc la DESCRIPTION et
  // les PHOTOS directement sur la page que tu regardes — zéro requête en plus.
  // À quoi ça sert : (1) tes annonces Leboncoin reprennent ta vraie description
  // au lieu d'un texte générique ; (2) tu gardes une copie de tes photos et de
  // tes textes, donc tu ne les perds jamais et tu n'as pas à tout refaire.
  function readListingDetailFromPage() {
    const out = { description: '', photos: [] };
    try {
      // Description : plusieurs pistes, de la plus fiable à la plus générale.
      const sel = [
        '[itemprop="description"]',
        '[data-testid*="description"] span',
        '[data-testid*="description"]',
        'meta[property="og:description"]',
      ];
      for (const s of sel) {
        const el = document.querySelector(s);
        if (!el) continue;
        const v = (el.tagName === 'META' ? el.getAttribute('content') : el.textContent) || '';
        const t = v.trim();
        if (t.length > 15) { out.description = t.slice(0, 3000); break; }
      }
      // Photos : les images Vinted en grand format présentes sur la page.
      const seen = new Set();
      const og = document.querySelector('meta[property="og:image"]');
      if (og && og.getAttribute('content')) { const u = og.getAttribute('content'); seen.add(u); out.photos.push(u); }
      for (const img of document.querySelectorAll('img[src*="vinted.net"]')) {
        const u = img.getAttribute('src') || '';
        // On ne garde que les grands formats (les vignettes 70x100 ne servent à rien).
        if (!/\/(f800|f1200|tc)\//.test(u)) continue;
        if (seen.has(u)) continue;
        seen.add(u); out.photos.push(u);
        if (out.photos.length >= 20) break;
      }
    } catch (_) { /* page inattendue */ }
    return (out.description || out.photos.length) ? out : null;
  }

  // Mémorise ce qu'on a lu sur la page (date + description + photos), une fois
  // par annonce et par visite.
  const savedDates = new Set();
  const savedDetails = new Set();
  function captureDate(id) {
    if (!id) return;
    if (!savedDates.has(id)) {
      const d = readListingDateFromPage();
      if (d) {
        savedDates.add(id);
        try {
          chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'saveDate', id, ts: d.ts, text: d.text }, () => {
            if (chrome.runtime.lastError) return; // extension rechargée
            if (DATA && DATA.byId && DATA.byId[id]) {
              DATA.byId[id].ageDays = Math.floor((Date.now() - d.ts) / 86400000);
              if (open && tab === 'paire') render();
            }
          });
        } catch (_) {}
      }
    }
    if (!savedDetails.has(id)) {
      const det = readListingDetailFromPage();
      if (det) {
        savedDetails.add(id);
        try {
          chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'saveDetail', id, detail: det }, () => {
            if (chrome.runtime.lastError) return;
            if (DATA && DATA.byId && DATA.byId[id]) {
              DATA.byId[id].hasDetail = true;
              if (open && tab === 'paire') render();
            }
          });
        } catch (_) {}
      }
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #vrm-fab{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:52px;height:52px;border-radius:999px;
      background:#09b1ba;color:#fff;border:none;cursor:pointer;font:800 18px/1 system-ui,-apple-system,sans-serif;
      box-shadow:0 6px 20px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center}
    #vrm-fab:hover{transform:scale(1.05)}
    #vrm-fab .vrm-badge{position:absolute;top:-4px;right:-4px;background:#e8590c;color:#fff;border-radius:999px;
      min-width:20px;height:20px;padding:0 5px;font:800 11px/20px system-ui,sans-serif;text-align:center}
    #vrm-panel{position:fixed;right:18px;bottom:80px;z-index:2147483000;width:min(460px,94vw);max-height:82vh;overflow:auto;
      background:#fff;color:#111;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.3);border:1px solid #eef0f4;
      font:13px/1.45 system-ui,-apple-system,sans-serif;padding:0}
    #vrm-panel .vrm-head{position:sticky;top:0;z-index:6;background:#fff;padding:13px 14px 9px;
      border-bottom:1px solid #eef0f4;border-radius:16px 16px 0 0}
    #vrm-panel #vrm-body{padding:12px 14px 0}
    #vrm-panel h3{margin:0 0 2px;font-size:15px;font-weight:800}
    #vrm-panel .vrm-sub{color:#667;font-size:11.5px;margin-bottom:9px}
    #vrm-panel .vrm-tabs{display:flex;gap:6px;flex-wrap:wrap}
    #vrm-panel .vrm-tab{border:1px solid #dde;background:#fff;color:#334;border-radius:999px;padding:5px 10px;
      font:700 11.5px system-ui,sans-serif;cursor:pointer;transition:background .12s,border-color .12s}
    #vrm-panel .vrm-tab:hover{border-color:#09b1ba;color:#09b1ba}
    #vrm-panel .vrm-tab.on{background:#09b1ba;border-color:#09b1ba;color:#fff}
    #vrm-panel .vrm-refresh{position:absolute;top:11px;right:36px;border:none;background:transparent;font-size:14px;
      cursor:pointer;opacity:.7;padding:0;line-height:1}
    #vrm-panel .vrm-refresh:hover{opacity:1}
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
    #vrm-panel .vrm-close{position:absolute;top:9px;right:12px;border:none;background:transparent;cursor:pointer;font-size:16px;color:#889;padding:0;line-height:1}
    #vrm-panel .vrm-close:hover{color:#334}
    #vrm-panel .vrm-todo{border:1px solid #ffd7a8;background:#fff6ec;color:#9a5b16;border-radius:999px;padding:5px 10px;
      font:700 11.5px system-ui,sans-serif;cursor:pointer}
    #vrm-panel .vrm-todo:hover{background:#ffedd8}
    @media (prefers-color-scheme: dark){
      #vrm-panel{background:#161a20;color:#e8eef5;border-color:#2a3038}
      #vrm-panel .vrm-head{background:#161a20;border-bottom-color:#2a3038}
      #vrm-panel .vrm-card,#vrm-panel .vrm-st{border-color:#2a3038}
      #vrm-panel .vrm-tab{background:#1e242c;border-color:#2a3038;color:#cfd8e3}
      #vrm-panel .vrm-todo{background:#2a2113;border-color:#4a3a1c;color:#f0c88a}
      #vrm-panel .vrm-todo:hover{background:#33280f}
    }`;
  document.documentElement.appendChild(style);

  const fab = document.createElement('button');
  fab.id = 'vrm-fab';
  fab.title = 'VRM — mes infos sur cette paire';
  fab.innerHTML = 'VRM';
  document.documentElement.appendChild(fab);

  const panel = document.createElement('div');
  panel.id = 'vrm-panel';
  panel.style.display = open ? 'block' : 'none'; // restauré depuis ta dernière position
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

  // ── ONGLET « MA JOURNÉE » : toute ta boutique en un coup d'œil, sur Vinted ────
  // Les chiffres d'argent (CA du mois, argent bloqué, encaissé) viennent de la
  // ligne `widget_stats` PUBLIÉE PAR L'APP → jamais recalculés ici, donc jamais un
  // chiffre qui contredit l'app. On affiche leur fraîcheur honnêtement.
  const eurInt = (v) => (v == null ? '—' : Number(v).toLocaleString('fr-FR') + ' €');
  function renderJournee() {
    const s = (DATA && DATA.stats) || {};
    const a = (DATA && DATA.appStats) || null;
    const heure = new Date().getHours();
    const bonjour = heure < 18 ? 'Bonjour 👋' : 'Bonsoir 👋';
    const todo = [
      s.toPrint ? { t: 'expedier', ic: '🖨️', n: s.toPrint, lbl: 'à imprimer' } : null,
      s.toShip ? { t: 'expedier', ic: '📄', n: s.toShip, lbl: 'à générer' } : null,
      s.toPickup ? { t: 'achats', ic: '📦', n: s.toPickup, lbl: 'à retirer' } : null,
      s.unread ? { t: 'messages', ic: '💬', n: s.unread, lbl: s.unread > 1 ? 'messages' : 'message' } : null,
    ].filter(Boolean);
    const tile = (label, val, color) => `<div class="vrm-st" style="flex:1 1 44%"><b style="color:${color || 'inherit'}">${val}</b><span class="vrm-m">${label}</span></div>`;
    const money = a ? `
      <div class="vrm-card" style="text-align:center;background:linear-gradient(135deg,#09b1ba0f,#09b1ba05);border-color:#09b1ba55">
        <div class="vrm-m" style="text-transform:uppercase;font-size:10px;letter-spacing:.6px">Ce mois-ci</div>
        <div style="font-weight:800;font-size:30px;color:#09b1ba;line-height:1.1;margin:2px 0">${eurInt(a.caMois)}</div>
        <div class="vrm-m">${a.ventesMois != null ? `${a.ventesMois} vente${a.ventesMois > 1 ? 's' : ''}` : ''}</div>
      </div>
      <div class="vrm-stats" style="margin-top:8px">
        ${tile('Argent bloqué', eurInt(a.enAttente), '#c98a1a')}
        ${tile('Encaissé', eurInt(a.caEncaisse), '#0f6b4f')}
      </div>`
      : `<div class="vrm-card"><div class="vrm-m">Ouvre l'app une fois pour voir ton <b>CA du mois</b> et ton <b>argent bloqué</b> ici (ils sont calculés par l'app).</div></div>`;
    // Objectif de CA mensuel (fixé dans l'app) : barre de progression motivante.
    const goal = (DATA && DATA.goal) || 0;
    let goalBlock = '';
    if (a && goal > 0) {
      const ca = Number(a.caMois) || 0;
      const pct = Math.max(0, Math.min(100, Math.round(ca / goal * 100)));
      const atteint = ca >= goal;
      goalBlock = `
        <div class="vrm-card" style="margin-top:8px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><div class="vrm-m" style="font-weight:700">🎯 Objectif du mois</div><div class="vrm-m">${eurInt(ca)} / ${eurInt(goal)}</div></div>
          <div style="margin-top:6px;height:9px;border-radius:999px;background:#e6eaee;overflow:hidden"><div style="height:100%;width:${pct}%;border-radius:999px;background:${atteint ? '#0f6b4f' : '#09b1ba'};transition:width .4s"></div></div>
          <div class="vrm-m" style="margin-top:4px">${atteint ? '🎉 Objectif atteint, bravo !' : `${pct}% — plus que ${eurInt(goal - ca)}`}</div>
        </div>`;
    }
    const stockLine = `
      <div class="vrm-stats" style="margin-top:8px">
        ${tile('En ligne', s.online != null ? s.online : '—')}
        ${tile('Valeur du stock', eurInt(s.value != null ? Math.round(s.value) : null))}
      </div>`;
    const todoBlock = todo.length ? `
      <div class="vrm-m" style="font-weight:700;margin:12px 0 5px">À faire aujourd'hui</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${todo.map(x => `<button class="vrm-todo" data-t="${x.t}">${x.ic} ${x.n} ${x.lbl}</button>`).join('')}</div>`
      : `<div class="vrm-card" style="margin-top:12px"><div class="vrm-m">✅ Rien d'urgent : tout est à jour. Beau boulot.</div></div>`;
    // Optimisation : opportunités déjà calculées (mêmes onglets), pour vendre plus.
    const optim = [
      s.relance ? { f: 'relance', ic: '💡', n: s.relance, lbl: 'à relancer' } : null,
      s.sleeping ? { f: 'sleep', ic: '😴', n: s.sleeping, lbl: 'dorment' } : null,
      s.noNum ? { f: 'nonum', ic: '🔢', n: s.noNum, lbl: 'sans N°' } : null,
    ].filter(Boolean);
    const optimBlock = optim.length ? `
      <div class="vrm-m" style="font-weight:700;margin:12px 0 5px">Pour vendre plus</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${optim.map(x => `<button class="vrm-todo" data-t="chaussures" data-filter="${x.f}">${x.ic} ${x.n} ${x.lbl}</button>`).join('')}</div>` : '';
    const fresh = a && a.updatedAt ? `<div class="vrm-m" style="text-align:center;margin-top:8px;opacity:.7">Chiffres de l'app · ${esc(timeago(Date.parse(a.updatedAt)))}</div>` : '';
    return `<div class="vrm-m" style="font-weight:700;font-size:14px;margin-bottom:8px">${bonjour}</div>${money}${goalBlock}${stockLine}${todoBlock}${optimBlock}${fresh}`;
  }

  // ── ONGLET « MES PAIRES » : la liste de toutes tes chaussures en ligne, en
  //    grand (photo, N°, prix, marge, engagement, case garage). Lecture seule ;
  //    un clic ouvre l'annonce sur Vinted. Recherche par titre/marque/N°.
  function renderChaussures() {
    const online = (DATA && DATA.online) || [];
    if (!online.length) return `<div class="vrm-m">Aucune annonce en ligne captée pour l'instant.<br>Ouvre ta boutique Vinted une fois pour les capter (0 requête ajoutée).</div>`;
    // Sous-vues (ex-onglets, maintenant fondus ici) : filtrent la même liste.
    const relanceIds = new Set(((DATA && DATA.relance) || []).map(o => String(o.id)));
    const sleepIds = new Set(((DATA && DATA.sleeping) || []).map(o => String(o.id)));
    const noNumIds = new Set(((DATA && DATA.noNum) || []).map(o => String(o.id)));
    const FILTERS = [['all', 'Toutes', online.length], ['relance', '💡 À relancer', relanceIds.size], ['sleep', '😴 Dorment', sleepIds.size], ['nonum', '🔢 Sans N°', noNumIds.size]];
    const all = chaussuresFilter === 'relance' ? online.filter(o => relanceIds.has(String(o.id)))
      : chaussuresFilter === 'sleep' ? online.filter(o => sleepIds.has(String(o.id)))
      : chaussuresFilter === 'nonum' ? online.filter(o => noNumIds.has(String(o.id)))
      : online;
    const filterChips = `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">${FILTERS.map(([k, l, n]) => `<button class="vrm-chfilter" data-f="${k}" style="border:1px solid ${chaussuresFilter === k ? '#111' : '#dde'};background:${chaussuresFilter === k ? '#111' : '#fff'};color:${chaussuresFilter === k ? '#fff' : '#334'};border-radius:999px;padding:4px 10px;font-weight:700;font-size:11px;cursor:pointer">${l}${n ? ` ${n}` : ''}</button>`).join('')}</div>`;
    if (!all.length) return `${filterChips}<div class="vrm-m" style="padding:6px 2px">Rien dans cette vue. 👌</div>`;
    const margeOf = (o) => { const b = eur(o.buyPrice), s = eur(o.price); return (b != null && s != null && !isNaN(b)) ? s - b : null; };
    const byNum = (a, b) => { const na = a.numero != null && a.numero !== '' ? +a.numero : 1e9, nb = b.numero != null && b.numero !== '' ? +b.numero : 1e9; return na - nb || String(a.title || '').localeCompare(String(b.title || '')); };
    // Un champ absent va en fin de liste (on ne le fait pas passer devant à tort).
    const desc = (f) => (a, b) => { const va = f(a), vb = f(b); if (va == null && vb == null) return byNum(a, b); if (va == null) return 1; if (vb == null) return -1; return vb - va; };
    // Écart au marché = ton prix − médiane de tes paires comparables (o.peer).
    // Positif = au-dessus du marché → candidate à une baisse (tri « Marché »).
    const ecartMarche = (o) => { const p = eur(o.price), pe = o.peer; return (p != null && pe != null) ? p - Number(pe) : null; };
    const sorters = { num: byNum, marge: desc(margeOf), vues: desc(o => o.views), favs: desc(o => o.favs), age: desc(o => o.ageDays), prix: desc(o => eur(o.price)), marche: desc(ecartMarche) };
    const sorted = all.slice().sort(sorters[chaussuresSort] || byNum);
    const SORTS = [['num', 'N°'], ['marge', '💰 Marge'], ['marche', '📊 Marché'], ['vues', '👁 Vues'], ['favs', '❤️ Favoris'], ['age', '😴 Âge'], ['prix', '€ Prix']];
    const sortChips = `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">${SORTS.map(([k, l]) => `<button class="vrm-chsort" data-sort="${k}" style="border:1px solid ${chaussuresSort === k ? '#09b1ba' : '#dde'};background:${chaussuresSort === k ? '#09b1ba' : '#fff'};color:${chaussuresSort === k ? '#fff' : '#334'};border-radius:999px;padding:4px 10px;font-weight:700;font-size:11px;cursor:pointer">${l}</button>`).join('')}</div>`;
    const rows = sorted.slice(0, 300).map(o => {
      const buy = eur(o.buyPrice), sell = eur(o.price);
      const marge = (buy != null && sell != null && !isNaN(buy)) ? sell - buy : null;
      const eng = [o.views != null ? `👁 ${o.views}` : '', o.favs != null ? `❤️ ${o.favs}` : '', o.ageDays != null ? `${o.ageDays} j` : '', o.cell ? `🏠 ${esc(o.cell)}` : ''].filter(Boolean).join(' · ');
      // Repère marché : uniquement quand l'écart est net (>15%), sinon on n'encombre pas.
      let peerTag = '';
      if (o.peer != null && sell != null) {
        const pe = Number(o.peer);
        if (sell > pe * 1.15) peerTag = `<span style="color:#9a5b16">📊 au-dessus du marché (~${fmt(pe)})</span>`;
        else if (sell < pe * 0.85) peerTag = `<span style="color:#0f6b4f">📊 sous le marché (~${fmt(pe)})</span>`;
      }
      return `
      <a class="vrm-ch-row" href="${esc(o.url)}" target="_blank" rel="noreferrer" data-s="${esc(((o.numero != null ? 'n°' + o.numero + ' ' : '') + (o.title || '')).toLowerCase())}" style="display:flex;gap:10px;align-items:center;text-decoration:none;color:inherit;border:1px solid #eceff3;border-radius:12px;padding:8px;margin-bottom:7px">
        ${o.photo ? `<img src="${esc(o.photo)}" alt="" style="width:58px;height:58px;border-radius:10px;object-fit:cover;flex-shrink:0;background:#eee">` : '<div style="width:58px;height:58px;border-radius:10px;background:#eef1f4;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px">👟</div>'}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.numero ? `<span class="vrm-num">N°${esc(o.numero)}</span> ` : ''}${esc(o.title || 'Annonce')}</div>
          <div class="vrm-m" style="margin-top:2px">${fmt(o.price)}${buy != null ? ` · achat ${fmt(o.buyPrice)}` : ''}${marge != null ? ` · marge <b style="color:#0f6b4f">${fmt(marge)}</b>` : ''}</div>
          ${eng ? `<div class="vrm-m" style="margin-top:1px">${eng}</div>` : ''}
          ${peerTag ? `<div class="vrm-m" style="margin-top:1px;font-weight:600">${peerTag}</div>` : ''}
        </div>
        <span style="flex-shrink:0;color:#09b1ba;font-size:16px">↗</span>
      </a>`;
    }).join('');
    return `
      ${filterChips}
      <div class="vrm-m" style="font-weight:800;margin-bottom:6px">👟 ${all.length} paire${all.length > 1 ? 's' : ''}${chaussuresFilter === 'all' ? ' en ligne' : ''}</div>
      ${sortChips}
      ${all.length > 8 ? `<input id="vrm-ch-search" type="search" value="${esc(chaussuresQuery)}" placeholder="🔍 Filtrer (titre, marque, N°)…" style="width:100%;box-sizing:border-box;margin-bottom:8px;border:1px solid #d7dde3;border-radius:9px;padding:8px 10px;font:inherit;font-size:12.5px">` : ''}
      ${rows}`;
  }
  function wireChaussures() {
    panel.querySelectorAll('.vrm-chfilter').forEach(b => { b.onclick = () => { chaussuresFilter = b.dataset.f; render(); }; });
    panel.querySelectorAll('.vrm-chsort').forEach(b => { b.onclick = () => { chaussuresSort = b.dataset.sort; render(); }; });
    const cs = panel.querySelector('#vrm-ch-search');
    const apply = () => { const q = chaussuresQuery.trim().toLowerCase(); panel.querySelectorAll('.vrm-ch-row').forEach(r => { r.style.display = (!q || (r.dataset.s || '').includes(q)) ? 'flex' : 'none'; }); };
    if (cs) { cs.oninput = () => { chaussuresQuery = cs.value; apply(); }; apply(); }
  }

  function renderPaire() {
    const id = currentItemId();
    if (!id) return `<div class="vrm-m">Ouvre une de tes annonces sur Vinted pour voir son N°, son prix d'achat et sa case au garage ici.</div>`;
    const o = DATA && DATA.byId ? DATA.byId[id] : null;
    if (!o) return `<div class="vrm-m">Cette annonce n'est pas (encore) dans tes annonces en ligne captées.<br>Ouvre ta boutique une fois pour la capter.</div>`;
    const buy = eur(o.buyPrice), sell = eur(o.price);
    const marge = (buy != null && sell != null && !isNaN(buy)) ? sell - buy : null;
    // Diagnostics IN-CONTEXTE : on réutilise EXACTEMENT les signaux déjà calculés
    // pour les onglets « À relancer » et « Dorment » (même source → aucun chiffre
    // qui contredit l'app). But : pendant que tu regardes l'annonce, on te dit tout
    // de suite si elle mérite une baisse de prix ou une republication.
    const inRelance = ((DATA && DATA.relance) || []).some(r => String(r.id) === String(id));
    const dort = o.ageDays != null && o.ageDays >= 30;
    let diag = '';
    if (inRelance) diag += `<div class="vrm-m" style="margin-top:6px;padding:6px 8px;border-radius:8px;background:#fff6ec;color:#9a5b16;border:1px solid #ffd7a8">💡 <b>Très vue, peu de favoris</b> par rapport à tes autres annonces → le prix est sans doute trop haut. Baisse-le toi-même.</div>`;
    if (dort) diag += `<div class="vrm-m" style="margin-top:6px;padding:6px 8px;border-radius:8px;background:#eef4ff;color:#2b5b9a;border:1px solid #c9dbf7">😴 <b>En ligne depuis ${o.ageDays} j</b> — pense à la republier ou à baisser le prix.</div>`;
    // Prix des paires comparables (même marque + taille EN LIGNE, ≥2 paires) —
    // calculé par l'extension sur ta propre moisson (0 requête). Purement indicatif.
    if (o.peer != null && sell != null) {
      const pe = Number(o.peer);
      const cmp = sell > pe * 1.15 ? { txt: `Ton prix est <b>au-dessus</b> de tes paires similaires → une baisse peut accélérer la vente.`, bg: '#fff6ec', fg: '#9a5b16', bd: '#ffd7a8' }
        : sell < pe * 0.85 ? { txt: `Ton prix est <b>en-dessous</b> de tes paires similaires → tu peux sans doute monter un peu.`, bg: '#eefaf3', fg: '#0f6b4f', bd: '#bfe6d3' }
        : { txt: `Ton prix est <b>dans la moyenne</b> de tes paires similaires. 👍`, bg: '#f2f5f8', fg: '#44515e', bd: '#e0e6ec' };
      diag += `<div class="vrm-m" style="margin-top:6px;padding:6px 8px;border-radius:8px;background:${cmp.bg};color:${cmp.fg};border:1px solid ${cmp.bd}">📊 Paires similaires en ligne (${esc(o.brand)} · ${esc(o.size)}) : <b>autour de ${fmt(pe)}</b> <span style="opacity:.75">(${o.peerN} paires)</span><br>${cmp.txt}</div>`;
    }
    const extra = `<div class="vrm-m" style="margin-top:3px">
        ${o.buyPrice != null ? `Achat ${fmt(o.buyPrice)}` : '<b>Prix d\'achat non renseigné</b>'}
        ${marge != null ? ` · Marge <b>${fmt(marge)}</b>` : ''}
        ${o.cell ? ` · 🏠 case <b>${esc(o.cell)}</b>` : (o.numero ? ' · 🏠 pas rangée' : '')}
      </div>
      ${o.buyPrice == null ? `<div style="margin-top:5px"><a class="vrm-link" href="${APP_URL}/?tab=cat_annonces" target="_blank" rel="noreferrer">➕ Renseigner le prix d'achat dans l'app${o.numero ? ` (cherche N°${esc(o.numero)})` : ''} ↗</a><div class="vrm-m" style="opacity:.8;margin-top:1px">Sans lui, la marge et le bénéfice sont faux.</div></div>` : ''}
      <div class="vrm-m" style="margin-top:3px">
        ${o.hasDesc ? '✅ description enregistrée' : '⏳ description en cours de lecture…'}
        ${o.nPhotos ? ` · 📷 ${o.nPhotos} photo${o.nPhotos > 1 ? 's' : ''} gardées` : ''}
      </div>${diag}${o.numero ? `<div style="margin-top:6px"><button class="vrm-copy-line" data-c="N°${esc(o.numero)} · ${esc(o.title || '')}" style="border:1px solid #09b1ba;background:#09b1ba14;color:#09b1ba;border-radius:8px;padding:5px 12px;font-weight:700;font-size:12px;cursor:pointer">📋 Copier N° + titre</button></div>` : ''}`;
    return card(o, extra);
  }

  // L'ancienneté n'est connue que pour les annonces dont tu as ouvert la page.
  // On le dit clairement plutôt que d'afficher un « 0 » trompeur.
  function sleepEmpty() {
    const s = (DATA && DATA.stats) || {};
    const k = s.datesKnown || 0, n = s.online || 0;
    if (k === 0) return 'Aucune date connue pour l&#39;instant.<br>Vinted ne donne l&#39;ancienneté que sur la page de l&#39;annonce : ouvre-en quelques-unes, VRM lit la date « Ajouté il y a… » au passage et la retient.';
    if (k < n) return `Aucune ne dort parmi les ${k} annonce${k > 1 ? 's' : ''} dont la date est connue (sur ${n}). Ouvre les autres pour compléter.`;
    return 'Aucune annonce ne dort. 👌';
  }

  function renderList(list, empty, hint) {
    if (!list || !list.length) return `<div class="vrm-m">${empty}</div>`;
    return (hint ? `<div class="vrm-m" style="margin-bottom:8px">${hint}</div>` : '') + list.slice(0, 40).map(o => card(o)).join('');
  }

  function render() {
    writeLS('vrm_panel_tab', tab); // garde l'onglet actif d'une page à l'autre
    const s = (DATA && DATA.stats) || { online: 0, relance: 0, noNum: 0, value: 0 };
    const fresh = (DATA && DATA.freshestAt) ? ` · capté ${esc(timeago(DATA.freshestAt))}` : '';
    panel.innerHTML = `
      <div class="vrm-head">
        <button class="vrm-close" title="Fermer">✕</button>
        <button class="vrm-refresh" title="Rafraîchir les données">${dataBusy ? '⏳' : '🔄'}</button>
        <h3>VRM</h3>
        <div class="vrm-sub">Tes infos, sur Vinted.${fresh}</div>
        <div class="vrm-tabs">
          <button class="vrm-tab ${tab === 'journee' ? 'on' : ''}" data-t="journee">🏠 Ma journée</button>
          ${currentItemId() ? `<button class="vrm-tab ${tab === 'paire' ? 'on' : ''}" data-t="paire">👟 Cette paire</button>` : ''}
          <button class="vrm-tab ${tab === 'chaussures' ? 'on' : ''}" data-t="chaussures">👟 Mes paires${DATA && DATA.stats && DATA.stats.online ? ` ${DATA.stats.online}` : ''}</button>
          <button class="vrm-tab ${tab === 'republier' ? 'on' : ''}" data-t="republier">♻️ Republier</button>
          <button class="vrm-tab ${tab === 'expedier' ? 'on' : ''}" data-t="expedier">📄 Bordereaux${DATA && DATA.stats && ((DATA.stats.toPrint || 0) + (DATA.stats.toShip || 0)) ? ` ${(DATA.stats.toPrint || 0) + (DATA.stats.toShip || 0)}` : ''}</button>
          <button class="vrm-tab ${tab === 'achats' ? 'on' : ''}" data-t="achats">📦 Achats${DATA && DATA.stats && DATA.stats.toPickup ? ` ${DATA.stats.toPickup}` : ''}</button>
          <button class="vrm-tab ${tab === 'messages' || tab === 'reponse' ? 'on' : ''}" data-t="messages">💬 Messages${DATA && DATA.stats && DATA.stats.unread ? ` ${DATA.stats.unread}` : ''}</button>
          <button class="vrm-tab ${tab === 'favoris' ? 'on' : ''}" data-t="favoris">❤️ Favoris</button>
        </div>
      </div>
      <div id="vrm-body">${
        !DATA ? '<div class="vrm-m">Chargement…</div>'
        : tab === 'journee' ? renderJournee()
        : tab === 'paire' ? renderPaire()
        : tab === 'chaussures' ? renderChaussures()
        : tab === 'republier' ? renderRepublier()
        : tab === 'reponse' ? renderReponse()
        : tab === 'expedier' ? renderExpedier()
        : tab === 'achats' ? renderAchats()
        : tab === 'messages' ? renderMessages()
        : tab === 'favoris' ? renderFavoris()
        : renderJournee()
      }</div>
      ${(DATA && DATA.activity && DATA.activity.length) ? `
        <div style="margin-top:10px;border-top:1px solid rgba(0,0,0,.08);padding-top:8px">
          <div class="vrm-m" style="font-weight:700;margin-bottom:4px">🟢 Activité récente</div>
          ${DATA.activity.slice(0, 5).map(a => `<div class="vrm-m" style="display:flex;justify-content:space-between;gap:8px;padding:1px 0"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.text)}</span><span style="flex-shrink:0;opacity:.65">${esc(timeago(a.t))}</span></div>`).join('')}
        </div>` : ''}
      <div style="margin-top:10px;text-align:center">
        <a class="vrm-link" href="${APP_URL}" target="_blank" rel="noreferrer">Ouvrir l'app VRM ↗</a>
      </div>`;
    panel.querySelector('.vrm-close').onclick = () => toggle(false);
    const rb = panel.querySelector('.vrm-refresh'); if (rb) rb.onclick = () => { if (!dataBusy) load(); };
    panel.querySelectorAll('.vrm-tab').forEach(b => { b.onclick = () => { tab = b.dataset.t; render(); }; });
    panel.querySelectorAll('.vrm-todo').forEach(b => { b.onclick = () => { if (b.dataset.filter) chaussuresFilter = b.dataset.filter; tab = b.dataset.t; render(); }; });
    // Bouton « copier » générique : copie son data-c (réutilisable partout).
    panel.querySelectorAll('.vrm-copy-line').forEach(b => { b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.c || ''); } catch (_) {} const p = b.textContent; b.textContent = '✓ Copié !'; setTimeout(() => { try { b.textContent = p; } catch (_) {} }, 1000); }; });
    if (tab === 'republier') wireRepublier();
    if (tab === 'reponse') wireReponse();
    if (tab === 'chaussures') wireChaussures();
    if (tab === 'expedier') wireExpedier();
    if (tab === 'achats') wireAchats();
    if (tab === 'messages') wireMessages();
    if (tab === 'favoris') wireFavoris();
  }

  // ── ONGLET MESSAGES : répondre, piloté par TA sélection (une-par-une) ────────
  // Tu coches les conversations, l'extension t'ouvre chacune à ton clic ; tu
  // réponds toi-même (l'onglet « Réponse ✍️ » peut te suggérer un texte). Aucun
  // message n'est envoyé automatiquement.
  function renderMessages() {
    const list = (DATA && DATA.convs) || [];
    if (!list.length) return `<div class="vrm-m">Aucune conversation captée. Ouvre ta messagerie Vinted une fois pour les capter.</div>`;
    if (msgRun) {
      const total = msgRun.queue.length, i = msgRun.idx;
      if (i >= total) return `<div class="vrm-card" style="text-align:center"><div style="font-size:15px;font-weight:800;margin-bottom:4px">✓ Terminé</div><div class="vrm-m">${total} conversation${total > 1 ? 's' : ''} passée${total > 1 ? 's' : ''}.</div><button class="vrm-msg-go" data-act="stop" style="margin-top:10px;border:none;background:#09b1ba;color:#fff;border-radius:10px;padding:8px 14px;font-weight:800;cursor:pointer">Fermer</button></div>`;
      const c = msgRun.queue[i];
      return `
        <div class="vrm-m" style="margin-bottom:8px">Conversation <b>${i + 1}</b> / ${total} — ouvre-la, réponds (onglet <b>Réponse ✍️</b> pour un texte suggéré), puis <b>Suivante</b>.</div>
        <div class="vrm-card" style="display:flex;gap:8px;align-items:center">
          ${c.photo ? `<img src="${esc(c.photo)}" alt="" style="width:42px;height:42px;border-radius:8px;object-fit:cover;flex-shrink:0" />` : '<span style="font-size:24px;flex-shrink:0">💬</span>'}
          <div style="flex:1;min-width:0"><div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.login || 'Acheteur')}${c.unread ? ' 🔴' : ''}</div><div class="vrm-m" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.title || '')}</div></div>
        </div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="vrm-msg-go" data-act="open" style="flex:1;border:none;background:#09b1ba;color:#fff;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">Ouvrir ↗</button>
          <button class="vrm-msg-go" data-act="next" style="flex:1;border:1px solid #09b1ba;background:transparent;color:#09b1ba;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">Suivante ▶</button>
        </div>
        <div style="text-align:center;margin-top:8px"><button class="vrm-msg-go" data-act="stop" style="border:none;background:transparent;color:#889;font-size:11.5px;cursor:pointer;text-decoration:underline">Arrêter</button></div>`;
    }
    const rows = list.slice(0, 200).map(c => `
      <label class="vrm-card" style="display:flex;gap:9px;align-items:center;cursor:pointer;margin-bottom:6px;padding:8px">
        <input type="checkbox" class="vrm-msg-chk" data-k="${esc(c.id)}" ${msgSel.has(c.id) ? 'checked' : ''} style="width:18px;height:18px;flex-shrink:0;accent-color:#09b1ba">
        ${c.photo ? `<img src="${esc(c.photo)}" alt="" style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex-shrink:0;background:#eee">` : '<div style="width:38px;height:38px;border-radius:8px;background:#eee;flex-shrink:0"></div>'}
        <div style="flex:1;min-width:0"><div class="vrm-t">${c.unread ? '🔴 ' : ''}${esc(c.login || 'Acheteur')}</div><div class="vrm-m" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.title || '')}</div></div>
      </label>`).join('');
    return `
      <button class="vrm-msg-go" data-act="reponse" style="width:100%;margin-bottom:8px;border:1px dashed #09b1ba;background:#09b1ba0e;color:#09b1ba;border-radius:10px;padding:9px;font-weight:800;font-size:12.5px;cursor:pointer">✍️ Assistant de réponse (IA)</button>
      <div class="vrm-m" style="margin-bottom:8px">Coche les conversations où <b>répondre</b>. Tu réponds <b>une par une, toi-même</b> (aucun envoi automatique). 🔴 = non lu.</div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="vrm-msg-go" data-act="unread" style="flex:1;border:1px solid #dde;background:#fff;color:#334;border-radius:8px;padding:6px;font-weight:700;font-size:11.5px;cursor:pointer">Cocher non lus</button>
        <button class="vrm-msg-go" data-act="none" style="flex:1;border:1px solid #dde;background:#fff;color:#334;border-radius:8px;padding:6px;font-weight:700;font-size:11.5px;cursor:pointer">Tout décocher</button>
      </div>
      <div style="margin-bottom:8px">${rows}</div>
      <button class="vrm-msg-go" data-act="start" ${msgSel.size ? '' : 'disabled'} style="position:sticky;bottom:0;width:100%;border:none;background:${msgSel.size ? '#09b1ba' : '#9bb'};color:#fff;border-radius:10px;padding:11px;font-weight:800;cursor:${msgSel.size ? 'pointer' : 'default'};box-shadow:0 -6px 14px rgba(0,0,0,.12)">Répondre à ma sélection (${msgSel.size})</button>`;
  }
  function wireMessages() {
    panel.querySelectorAll('.vrm-msg-chk').forEach(c => { c.onchange = () => { const k = c.dataset.k; if (c.checked) msgSel.add(k); else msgSel.delete(k); render(); }; });
    panel.querySelectorAll('.vrm-msg-go').forEach(b => {
      b.onclick = () => {
        const act = b.dataset.act;
        const list = (DATA && DATA.convs) || [];
        if (act === 'reponse') { tab = 'reponse'; render(); }
        else if (act === 'unread') { list.filter(c => c.unread).forEach(c => msgSel.add(c.id)); render(); }
        else if (act === 'none') { msgSel.clear(); render(); }
        else if (act === 'start') { if (!msgSel.size) return; msgRun = { queue: list.filter(c => msgSel.has(c.id)), idx: 0 }; render(); }
        else if (act === 'stop') { msgRun = null; render(); }
        else if (act === 'open') { const c = msgRun && msgRun.queue[msgRun.idx]; if (c && c.url) window.open(c.url, '_blank', 'noopener'); }
        else if (act === 'next') { if (msgRun) { msgRun.idx++; render(); } }
      };
    });
  }

  // ── ONGLET FAVORIS : relancer ceux qui ont mis en favori, piloté par TA
  //    sélection. Tu coches des annonces, l'extension t'ouvre chacune ; TU
  //    utilises l'offre native Vinted « proposer une remise aux personnes qui ont
  //    ajouté en favori ». Aucune offre ni message envoyés automatiquement.
  function renderFavoris() {
    const list = ((DATA && DATA.online) || []).filter(o => (o.favs || 0) > 0).sort((a, b) => (b.favs || 0) - (a.favs || 0));
    if (!list.length) return `<div class="vrm-m">Aucune annonce avec des favoris captée. Ouvre ta boutique Vinted une fois pour capter les compteurs.</div>`;
    if (favRun) {
      const total = favRun.queue.length, i = favRun.idx;
      if (i >= total) return `<div class="vrm-card" style="text-align:center"><div style="font-size:15px;font-weight:800;margin-bottom:4px">✓ Terminé</div><div class="vrm-m">${total} annonce${total > 1 ? 's' : ''} passée${total > 1 ? 's' : ''}.</div><button class="vrm-fav-go" data-act="stop" style="margin-top:10px;border:none;background:#09b1ba;color:#fff;border-radius:10px;padding:8px 14px;font-weight:800;cursor:pointer">Fermer</button></div>`;
      const o = favRun.queue[i];
      return `
        <div class="vrm-m" style="margin-bottom:8px">Annonce <b>${i + 1}</b> / ${total} — ouvre-la, propose une remise à tes <b>${o.favs} favori${o.favs > 1 ? 's' : ''}</b> (bouton Vinted « offre aux favoris »), puis <b>Suivante</b>.</div>
        ${card(o, `<div class="vrm-m" style="margin-top:3px">❤️ ${o.favs} favori${o.favs > 1 ? 's' : ''}${o.views != null ? ` · 👁 ${o.views}` : ''}</div>`)}
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="vrm-fav-go" data-act="open" style="flex:1;border:none;background:#09b1ba;color:#fff;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">Ouvrir ↗</button>
          <button class="vrm-fav-go" data-act="next" style="flex:1;border:1px solid #09b1ba;background:transparent;color:#09b1ba;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">Suivante ▶</button>
        </div>
        <div style="text-align:center;margin-top:8px"><button class="vrm-fav-go" data-act="stop" style="border:none;background:transparent;color:#889;font-size:11.5px;cursor:pointer;text-decoration:underline">Arrêter</button></div>`;
    }
    const rows = list.slice(0, 200).map(o => `
      <label class="vrm-card" style="display:flex;gap:9px;align-items:center;cursor:pointer;margin-bottom:6px;padding:8px">
        <input type="checkbox" class="vrm-fav-chk" data-k="${esc(o.id)}" ${favSel.has(o.id) ? 'checked' : ''} style="width:18px;height:18px;flex-shrink:0;accent-color:#09b1ba">
        ${o.photo ? `<img src="${esc(o.photo)}" alt="" style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex-shrink:0;background:#eee">` : '<div style="width:38px;height:38px;border-radius:8px;background:#eee;flex-shrink:0"></div>'}
        <div style="flex:1;min-width:0"><div class="vrm-t">${esc(o.title)}</div><div class="vrm-m">❤️ ${o.favs}${o.views != null ? ` · 👁 ${o.views}` : ''} · ${fmt(o.price)}</div></div>
      </label>`).join('');
    return `
      <div class="vrm-m" style="margin-bottom:8px">Coche les annonces dont tu veux <b>relancer les favoris</b>. Une par une, tu proposes toi-même une remise via l'<b>offre native Vinted</b>. Aucun envoi automatique.</div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="vrm-fav-go" data-act="all" style="flex:1;border:1px solid #dde;background:#fff;color:#334;border-radius:8px;padding:6px;font-weight:700;font-size:11.5px;cursor:pointer">Tout cocher</button>
        <button class="vrm-fav-go" data-act="none" style="flex:1;border:1px solid #dde;background:#fff;color:#334;border-radius:8px;padding:6px;font-weight:700;font-size:11.5px;cursor:pointer">Tout décocher</button>
      </div>
      <div style="margin-bottom:8px">${rows}</div>
      <button class="vrm-fav-go" data-act="start" ${favSel.size ? '' : 'disabled'} style="position:sticky;bottom:0;width:100%;border:none;background:${favSel.size ? '#09b1ba' : '#9bb'};color:#fff;border-radius:10px;padding:11px;font-weight:800;cursor:${favSel.size ? 'pointer' : 'default'};box-shadow:0 -6px 14px rgba(0,0,0,.12)">Relancer ma sélection (${favSel.size})</button>`;
  }
  function wireFavoris() {
    panel.querySelectorAll('.vrm-fav-chk').forEach(c => { c.onchange = () => { const k = c.dataset.k; if (c.checked) favSel.add(k); else favSel.delete(k); render(); }; });
    panel.querySelectorAll('.vrm-fav-go').forEach(b => {
      b.onclick = () => {
        const act = b.dataset.act;
        const list = ((DATA && DATA.online) || []).filter(o => (o.favs || 0) > 0);
        if (act === 'all') { list.forEach(o => favSel.add(o.id)); render(); }
        else if (act === 'none') { favSel.clear(); render(); }
        else if (act === 'start') { if (!favSel.size) return; favRun = { queue: list.filter(o => favSel.has(o.id)).sort((a, b) => (b.favs || 0) - (a.favs || 0)), idx: 0 }; render(); }
        else if (act === 'stop') { favRun = null; render(); }
        else if (act === 'open') { const o = favRun && favRun.queue[favRun.idx]; if (o && o.url) window.open(o.url, '_blank', 'noopener'); }
        else if (act === 'next') { if (favRun) { favRun.idx++; render(); } }
      };
    });
  }

  // ── ONGLET RÉPONSE : aide à répondre aux acheteurs (Messaging Intelligence) ──
  // Tu colles le message de l'acheteur, l'IA propose 3 à 5 réponses naturelles
  // (tons variés). Tu cliques « Copier », tu colles dans Vinted, tu ajustes et tu
  // envoies TOI-MÊME. ⚠️ Rien n'est envoyé automatiquement — c'est ce qui protège
  // ton compte (aucun comportement de robot).
  function renderReponse() {
    // Sur une conversation : bouton pour LIRE tout seul le dernier message de
    // l'acheteur (depuis la conversation déjà captée) — plus besoin de copier.
    const readBtn = isConvPage() ? `<button id="vrm-rep-read" style="width:100%;margin-bottom:8px;border:1px dashed #09b1ba;background:#09b1ba0e;color:#09b1ba;border-radius:10px;padding:8px;font-weight:700;font-size:12.5px;cursor:pointer">📥 Lire le message de cette conversation</button>` : '';
    let out = `
      <div class="vrm-m" style="margin-bottom:6px">${isConvPage() ? 'Récupère le message de l\'acheteur (ou colle-le), l\'IA propose des réponses.' : 'Colle le message de l\'acheteur : l\'IA te propose des réponses.'} <b>Tu relis et tu envoies toi‑même</b> — rien ne part tout seul.</div>
      ${readBtn}
      <textarea id="vrm-rep-msg" placeholder="Message de l'acheteur…" style="width:100%;box-sizing:border-box;min-height:64px;border:1px solid #d7dde3;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;resize:vertical">${esc(repMsg)}</textarea>
      <button id="vrm-rep-go" ${repBusy ? 'disabled' : ''} style="width:100%;margin-top:8px;border:none;background:#09b1ba;color:#fff;border-radius:10px;padding:9px;font-weight:800;cursor:${repBusy ? 'default' : 'pointer'};opacity:${repBusy ? 0.6 : 1}">${repBusy ? '⏳ L\'IA réfléchit…' : '💬 Proposer des réponses'}</button>`;
    if (repResult && repResult.ok && Array.isArray(repResult.suggestions)) {
      out += `<div class="vrm-m" style="margin-top:10px">Intention : <b>${esc(repResult.intent || '—')}</b>${repResult.confidence ? ` · confiance ${repResult.confidence}%` : ''}</div>`;
      out += repResult.suggestions.map((s, i) => `
        <div class="vrm-card" style="margin-top:6px">
          <div class="vrm-m" style="text-transform:uppercase;font-size:10px;letter-spacing:.5px;margin-bottom:3px">${esc(s.tone || 'réponse')}</div>
          <div style="font-size:13px;line-height:1.45">${esc(s.text)}</div>
          <div style="display:flex;gap:6px;margin-top:6px">
            <button class="vrm-insert" data-i="${i}" style="border:none;background:#09b1ba;color:#fff;border-radius:8px;padding:5px 12px;font-weight:800;font-size:12px;cursor:pointer">↳ Insérer sur Vinted</button>
            <button class="vrm-copy" data-i="${i}" style="border:1px solid #09b1ba;background:#09b1ba14;color:#09b1ba;border-radius:8px;padding:5px 12px;font-weight:700;font-size:12px;cursor:pointer">📋 Copier</button>
          </div>
        </div>`).join('');
      out += `<div class="vrm-m" style="margin-top:8px;opacity:.85">« Insérer » met le texte dans le champ de réponse de Vinted — <b>tu relis et tu cliques Envoyer toi-même</b>. Rien n'est envoyé automatiquement.</div>`;
    } else if (repResult && !repResult.ok) {
      const why = repResult.reason === 'no-key' ? "L'assistant IA n'est pas branché : ajoute la clé AI_API_KEY côté serveur (Vercel), puis réessaie."
        : repResult.reason === 'no-message' ? "Colle d'abord le message de l'acheteur."
        : "L'IA n'a pas pu répondre pour l'instant. Réessaie dans un instant.";
      out += `<div class="vrm-m" style="margin-top:10px">${esc(why)}</div>`;
    }
    // Réponses rapides (celles de ton app, synchronisées) : insérables en 1 tap.
    const qr = (DATA && DATA.quickReplies) || [];
    if (qr.length) {
      out += `<div class="vrm-m" style="font-weight:700;margin:12px 0 5px">⚡ Tes réponses rapides</div><div style="display:flex;flex-direction:column;gap:5px">`
        + qr.map((t, i) => `<button class="vrm-qr" data-i="${i}" title="Insérer dans Vinted" style="text-align:left;border:1px solid #e6eaee;background:#f8fafb;color:#14181f;border-radius:9px;padding:7px 10px;font-size:12.5px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t)}</button>`).join('')
        + `</div>`;
    }
    return out;
  }

  function wireReponse() {
    const ta = panel.querySelector('#vrm-rep-msg');
    if (ta) ta.oninput = () => { repMsg = ta.value; }; // pas de re-render (on garde le focus)
    const readB = panel.querySelector('#vrm-rep-read');
    if (readB) readB.onclick = () => {
      const cid = currentConvId(); if (!cid) return;
      readB.textContent = '⏳ Lecture…';
      chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'convLastMessage', convId: cid }, (resp) => {
        if (resp && resp.ok && resp.message) { repMsg = resp.message; render(); }
        else { readB.textContent = '❌ Pas encore capté — ouvre le fil, patiente 2 s, réessaie'; setTimeout(() => { try { readB.textContent = '📥 Lire le message de cette conversation'; } catch (_) {} }, 2500); }
      });
    };
    const go = panel.querySelector('#vrm-rep-go');
    if (go) go.onclick = () => {
      const m = (repMsg || '').trim();
      if (!m) { repResult = { ok: false, reason: 'no-message' }; render(); return; }
      repBusy = true; repResult = null; render();
      // Contexte article : le titre de l'annonce si on est sur une page article.
      let art = '';
      try { const h = document.querySelector('h1'); art = (h && h.textContent || '').trim().slice(0, 120); } catch (_) {}
      chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'aiReply', message: m, article: art }, (resp) => {
        repBusy = false; repResult = resp || { ok: false, reason: 'network' }; render();
      });
    };
    panel.querySelectorAll('.vrm-copy').forEach(b => {
      b.onclick = () => {
        const i = Number(b.dataset.i);
        const s = repResult && repResult.suggestions && repResult.suggestions[i];
        if (!s) return;
        try { navigator.clipboard.writeText(s.text); } catch (_) {}
        const p = b.textContent; b.textContent = '✓ Copié !'; setTimeout(() => { try { b.textContent = p; } catch (_) {} }, 1000);
      };
    });
    panel.querySelectorAll('.vrm-insert').forEach(b => {
      b.onclick = () => {
        const i = Number(b.dataset.i);
        const s = repResult && repResult.suggestions && repResult.suggestions[i];
        if (!s) return;
        const how = insertReply(s.text); // insère dans le champ Vinted (ou copie si introuvable)
        const p = b.textContent; b.textContent = how === 'inserted' ? '✓ Inséré — relis puis Envoie' : '✓ Copié (champ introuvable)';
        setTimeout(() => { try { b.textContent = p; } catch (_) {} }, 1600);
      };
    });
    panel.querySelectorAll('.vrm-qr').forEach(b => {
      b.onclick = () => {
        const t = ((DATA && DATA.quickReplies) || [])[Number(b.dataset.i)];
        if (t == null) return;
        const how = insertReply(String(t));
        const p = b.textContent; b.textContent = how === 'inserted' ? '✓ Inséré — relis puis Envoie' : '✓ Copié';
        setTimeout(() => { try { b.textContent = p; } catch (_) {} }, 1500);
      };
    });
  }

  // ── ONGLET « À EXPÉDIER » : bordereaux pilotés par TA sélection ─────────────
  // Tu coches les bordereaux à générer, tu lances : l'extension t'ouvre chaque
  // vente UNE PAR UNE ; TU cliques « Générer le bordereau » sur Vinted, elle capte
  // le PDF, puis « Suivante ». ⚠️ L'extension n'appuie JAMAIS le bouton à ta place
  // (ce geste — un script qui clique — est ce que Vinted sanctionne). C'est TA
  // sélection qui pilote, TON clic qui génère : tu es l'auteur.
  const shipKey = (t) => t.transaction || t.url;
  function renderExpedier() {
    const toPrintAll = (DATA && DATA.bordsToPrint) || [];
    const toPrint = toPrintAll.filter(b => !bordDoneLocal.has(b.key)); // encore à faire
    const justDone = toPrintAll.filter(b => bordDoneLocal.has(b.key)); // traités (annulables)
    const list = (DATA && DATA.toShip) || [];
    const pending = list.filter(t => !t.hasBord);
    const done = list.filter(t => t.hasBord);

    // Mode défilement : une vente à la fois (piloté par ta sélection).
    if (shipRun) {
      const total = shipRun.queue.length, i = shipRun.idx;
      if (i >= total) {
        return `<div class="vrm-card" style="text-align:center">
            <div style="font-size:15px;font-weight:800;margin-bottom:4px">✓ Terminé</div>
            <div class="vrm-m">${total} vente${total > 1 ? 's' : ''} passée${total > 1 ? 's' : ''}. Les bordereaux générés sont captés tout seuls (voir « Activité »).</div>
            <button class="vrm-ship-go" data-act="stop" style="margin-top:10px;border:none;background:#09b1ba;color:#fff;border-radius:10px;padding:8px 14px;font-weight:800;cursor:pointer">Fermer</button>
          </div>`;
      }
      const t = shipRun.queue[i];
      return `
        <div class="vrm-m" style="margin-bottom:8px">Vente <b>${i + 1}</b> / ${total} — ouvre-la, clique <b>Générer le bordereau</b> sur Vinted, puis <b>Suivante</b>. L'extension capte le PDF.</div>
        <div class="vrm-card" style="display:flex;gap:8px;align-items:center">
          ${t.photo ? `<img src="${esc(t.photo)}" alt="" style="width:42px;height:42px;border-radius:8px;object-fit:cover;flex-shrink:0" />` : '<span style="font-size:24px;flex-shrink:0">📦</span>'}
          <div style="flex:1;min-width:0"><div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title || 'Vente')}</div><div class="vrm-m" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.status || '')}${t.price != null ? ` · ${fmt(t.price)}` : ''}</div></div>
        </div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="vrm-ship-go" data-act="open" style="flex:1;border:none;background:#09b1ba;color:#fff;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">Ouvrir sur Vinted ↗</button>
          <button class="vrm-ship-go" data-act="next" style="flex:1;border:1px solid #09b1ba;background:transparent;color:#09b1ba;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">Suivante ▶</button>
        </div>
        <div style="text-align:center;margin-top:8px"><button class="vrm-ship-go" data-act="stop" style="border:none;background:transparent;color:#889;font-size:11.5px;cursor:pointer;text-decoration:underline">Arrêter</button></div>`;
    }

    if (!toPrint.length && !pending.length && !justDone.length) {
      return `<div class="vrm-m">✓ Rien à imprimer ni à générer pour l'instant.${done.length ? ` (${done.length} bordereau${done.length > 1 ? 'x' : ''} déjà traité${done.length > 1 ? 's' : ''}.)` : ''}</div><div class="vrm-m" style="margin-top:6px">Ouvre tes ventes / bordereaux sur Vinted pour les capter.</div>`;
    }

    // 1) BORDEREAUX À IMPRIMER — le N° de la paire + le titre, comme dans l'app.
    //    L'impression (avec le N° tamponné sur le PDF) se fait dans l'app en 1 tap.
    const printSection = toPrint.length ? `
      <div class="vrm-m" style="font-weight:800;margin-bottom:6px">🖨️ ${toPrint.length} bordereau${toPrint.length > 1 ? 'x' : ''} à imprimer</div>
      ${toPrint.length > 8 ? `<input id="vrm-bord-search" type="search" value="${esc(bordQuery)}" placeholder="🔍 Filtrer (titre ou N°)…" style="width:100%;box-sizing:border-box;margin-bottom:8px;border:1px solid #d7dde3;border-radius:9px;padding:7px 10px;font:inherit;font-size:12.5px">` : ''}
      ${toPrint.slice(0, 60).map(b => `
        <div class="vrm-card vrm-bord-row" data-s="${esc((((b.numero != null ? 'n°' + b.numero + ' ' : '') + (b.title || '')).toLowerCase()))}" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;padding:8px">
          <span style="flex-shrink:0;min-width:36px;text-align:center;font-weight:800;color:${b.numero ? '#0f6b4f' : '#c53030'};background:${b.numero ? 'rgba(15,107,79,.1)' : 'rgba(197,48,48,.1)'};border-radius:8px;padding:5px 6px;font-size:12px">${b.numero ? ('N°' + esc(b.numero)) : 'N° ?'}</span>
          <div style="flex:1;min-width:0"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(b.title || 'Bordereau')}</div>${b.dateLimite ? `<div class="vrm-m">à envoyer avant ${esc(b.dateLimite)}</div>` : ''}</div>
          <button class="vrm-bord-done" data-k="${esc(b.key)}" title="Marquer traité → le retire de la liste (colis fait)" style="flex-shrink:0;border:1px solid #0f6b4f;background:rgba(15,107,79,.08);color:#0f6b4f;border-radius:8px;padding:6px 9px;font-weight:800;font-size:12px;cursor:pointer">✓ Traiter</button>
        </div>`).join('')}
      <a href="${APP_URL}/?tab=cat_bord" target="_blank" rel="noreferrer" style="display:block;text-align:center;text-decoration:none;background:#09b1ba;color:#fff;border-radius:10px;padding:10px;font-weight:800;margin-bottom:14px">🖨️ Imprimer dans l'app ↗</a>` : '';

    // 1bis) TRAITÉS À L'INSTANT — annulables (« ↺ Remettre ») tant que tu n'as pas
    //       rechargé. Sécurise le clic par erreur sur « ✓ Traiter ».
    const doneSection = justDone.length ? `
      <div class="vrm-m" style="font-weight:700;margin:4px 0 6px;color:#0f6b4f">✅ ${justDone.length} traité${justDone.length > 1 ? 's' : ''}</div>
      ${justDone.slice(0, 60).map(b => `
        <div class="vrm-card" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;padding:8px;opacity:.7">
          <span style="flex-shrink:0;min-width:36px;text-align:center;font-weight:800;color:#0f6b4f;background:rgba(15,107,79,.1);border-radius:8px;padding:5px 6px;font-size:12px">${b.numero ? ('N°' + esc(b.numero)) : '✓'}</span>
          <div style="flex:1;min-width:0"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:line-through">${esc(b.title || 'Bordereau')}</div></div>
          <button class="vrm-bord-undo" data-k="${esc(b.key)}" title="Annuler : le remettre dans la liste" style="flex-shrink:0;border:1px solid #b0b6bf;background:transparent;color:#556;border-radius:8px;padding:6px 9px;font-weight:700;font-size:12px;cursor:pointer">↺ Remettre</button>
        </div>`).join('')}
      <div style="margin-bottom:14px"></div>` : '';

    // 2) À GÉNÉRER D'ABORD — ventes sans bordereau, sélection pilotée par toi.
    let genSection = '';
    if (pending.length) {
      const rows = pending.map(t => { const k = shipKey(t); return `
        <label class="vrm-card" style="display:flex;gap:9px;align-items:center;cursor:pointer;margin-bottom:6px;padding:8px">
          <input type="checkbox" class="vrm-ship-chk" data-k="${esc(k)}" ${shipSel.has(k) ? 'checked' : ''} style="width:18px;height:18px;flex-shrink:0;accent-color:#09b1ba">
          ${t.photo ? `<img src="${esc(t.photo)}" alt="" style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex-shrink:0;background:#eee">` : '<div style="width:38px;height:38px;border-radius:8px;background:#eee;flex-shrink:0"></div>'}
          <div style="flex:1;min-width:0"><div class="vrm-t">${esc(t.title || 'Vente')}</div><div class="vrm-m">${esc(t.status || 'à expédier')}${t.price != null ? ` · ${fmt(t.price)}` : ''}</div></div>
        </label>`; }).join('');
      genSection = `
        <div class="vrm-m" style="font-weight:800;margin:2px 0 6px">📄 ${pending.length} bordereau${pending.length > 1 ? 'x' : ''} à générer d'abord</div>
        <div class="vrm-m" style="margin-bottom:8px">Coche, puis « Générer ma sélection » : l'extension t'ouvre chaque vente, <b>tu</b> cliques « Générer » sur Vinted, elle capte le PDF.</div>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button class="vrm-ship-go" data-act="all" style="flex:1;border:1px solid #dde;background:#fff;color:#334;border-radius:8px;padding:6px;font-weight:700;font-size:11.5px;cursor:pointer">Tout cocher</button>
          <button class="vrm-ship-go" data-act="none" style="flex:1;border:1px solid #dde;background:#fff;color:#334;border-radius:8px;padding:6px;font-weight:700;font-size:11.5px;cursor:pointer">Tout décocher</button>
        </div>
        <div style="margin-bottom:8px">${rows}</div>
        <button class="vrm-ship-go" data-act="start" ${shipSel.size ? '' : 'disabled'} style="width:100%;border:none;background:${shipSel.size ? '#09b1ba' : '#9bb'};color:#fff;border-radius:10px;padding:11px;font-weight:800;cursor:${shipSel.size ? 'pointer' : 'default'}">Générer ma sélection (${shipSel.size})</button>`;
    }
    return printSection + doneSection + genSection;
  }

  function wireExpedier() {
    // Filtre local des bordereaux à imprimer (DOM, garde le focus ; persisté).
    const bs = panel.querySelector('#vrm-bord-search');
    const applyBordFilter = () => { const q = bordQuery.trim().toLowerCase(); panel.querySelectorAll('.vrm-bord-row').forEach(row => { row.style.display = (!q || (row.dataset.s || '').includes(q)) ? '' : 'none'; }); };
    if (bs) { bs.oninput = () => { bordQuery = bs.value; applyBordFilter(); }; applyBordFilter(); }
    // « ✓ Traiter » un bordereau : on l'enregistre (ligne panel_bords_done) et on
    // le déplace en « Traités » (annulable). On NE mute PAS DATA.bordsToPrint pour
    // garder l'info et permettre « ↺ Remettre ». L'app s'aligne à sa synchro.
    panel.querySelectorAll('.vrm-bord-done').forEach(b => {
      b.onclick = () => {
        const k = b.dataset.k; if (!k) return;
        b.disabled = true; b.textContent = '⏳';
        chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'markBordDone', key: k, done: true }, (resp) => {
          if (resp && resp.ok) {
            bordDoneLocal.add(k);
            if (DATA && DATA.stats) DATA.stats.toPrint = Math.max(0, (DATA.stats.toPrint || 1) - 1);
            render();
          } else { try { b.disabled = false; b.textContent = '✓ Traiter'; } catch (_) {} }
        });
      };
    });
    // « ↺ Remettre » : annule le « traité » (retire la clé de panel_bords_done).
    panel.querySelectorAll('.vrm-bord-undo').forEach(b => {
      b.onclick = () => {
        const k = b.dataset.k; if (!k) return;
        b.disabled = true; b.textContent = '⏳';
        chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'markBordDone', key: k, done: false }, (resp) => {
          if (resp && resp.ok) {
            bordDoneLocal.delete(k);
            if (DATA && DATA.stats) DATA.stats.toPrint = (DATA.stats.toPrint || 0) + 1;
            render();
          } else { try { b.disabled = false; b.textContent = '↺ Remettre'; } catch (_) {} }
        });
      };
    });
    panel.querySelectorAll('.vrm-ship-chk').forEach(c => {
      c.onchange = () => { const k = c.dataset.k; if (c.checked) shipSel.add(k); else shipSel.delete(k); render(); };
    });
    panel.querySelectorAll('.vrm-ship-go').forEach(b => {
      b.onclick = () => {
        const act = b.dataset.act;
        const pending = ((DATA && DATA.toShip) || []).filter(t => !t.hasBord);
        if (act === 'all') { pending.forEach(t => shipSel.add(shipKey(t))); render(); }
        else if (act === 'none') { shipSel.clear(); render(); }
        else if (act === 'start') { if (!shipSel.size) return; shipRun = { queue: pending.filter(t => shipSel.has(shipKey(t))), idx: 0 }; render(); }
        else if (act === 'stop') { shipRun = null; render(); }
        else if (act === 'open') { const t = shipRun && shipRun.queue[shipRun.idx]; if (t && t.url) window.open(t.url, '_blank', 'noopener'); }
        else if (act === 'next') { if (shipRun) { shipRun.idx++; render(); } }
      };
    });
  }

  // ── ONGLET ACHATS : colis à retirer, AVEC LE CODE DE RETRAIT ─────────────────
  // Source = les emails de suivi (seule source du code + point relais). Le code
  // s'affiche en GROS pour le présenter au comptoir sans ouvrir l'app. Bouton
  // « ✓ Récupéré » (annulable). On écrit dans la ligne dédiée
  // `panel_colis_collected` — jamais dans `main` ; l'app s'aligne à sa synchro.
  const CARRIER_NAMES = { mondialrelay: 'Mondial Relay', chronopost: 'Chronopost', relaiscolis: 'Relais Colis', colissimo: 'Colissimo', shop2shop: 'Shop2Shop', inpost: 'InPost', ups: 'UPS', dpd: 'DPD', gls: 'GLS', dhl: 'DHL', fedex: 'FedEx', vinted: 'Vinted Go', autre: 'Colis' };
  const cleanLieuLite = (s) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return (t && t.length <= 70) ? t : ''; };
  function renderAchats() {
    const all = (DATA && DATA.pickups) || [];
    const list = all.filter(p => !pickupDoneLocal.has(p.key));
    const gotten = all.filter(p => pickupDoneLocal.has(p.key));
    if (!list.length && !gotten.length) {
      return `<div class="vrm-m">✓ Aucun colis à retirer pour l'instant.</div><div class="vrm-m" style="margin-top:6px">Les colis « disponibles » (avec code de retrait) apparaissent ici dès que le mail du transporteur arrive.</div>`;
    }
    const row = (p) => {
      const carrier = CARRIER_NAMES[p.carrier] || (p.carrier || 'Colis');
      const lieu = cleanLieuLite(p.lieu);
      return `
      <div class="vrm-card" style="margin-bottom:8px;padding:9px">
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-size:20px;flex-shrink:0">📦</span>
          <div style="flex:1;min-width:0"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.title || 'Colis')}</div><div class="vrm-m">${esc(carrier)}${lieu ? ` · ${esc(lieu)}` : ''}</div></div>
          <button class="vrm-pk-done" data-k="${esc(p.key)}" title="Marquer récupéré → le retire de la liste" style="flex-shrink:0;border:1px solid #0f6b4f;background:rgba(15,107,79,.08);color:#0f6b4f;border-radius:8px;padding:6px 9px;font-weight:800;font-size:12px;cursor:pointer">✓ Récupéré</button>
        </div>
        ${p.code ? `<div style="margin-top:7px;text-align:center;background:#f2f7f4;border:1px dashed #0f6b4f;border-radius:10px;padding:8px"><div class="vrm-m" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.5px">Code de retrait</div><div style="font-weight:800;font-size:26px;letter-spacing:3px;color:#0f6b4f;font-variant-numeric:tabular-nums">${esc(p.code)}</div>${p.code2 ? `<div class="vrm-m" style="margin-top:2px">Code d'ouverture : <b>${esc(p.code2)}</b></div>` : ''}<button class="vrm-pk-copy" data-c="${esc(p.code)}" style="margin-top:6px;border:1px solid #0f6b4f;background:transparent;color:#0f6b4f;border-radius:8px;padding:4px 12px;font-weight:700;font-size:12px;cursor:pointer">📋 Copier le code</button></div>`
          : (p.qrUrl ? `<div class="vrm-m" style="margin-top:6px">📱 QR de retrait — présente-le au comptoir (dans l'app, onglet Achats).</div>`
          : `<div class="vrm-m" style="margin-top:6px">Présente-toi au point relais avec une pièce d'identité.</div>`)}
      </div>`;
    };
    const gotRow = (p) => `
      <div class="vrm-card" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;padding:8px;opacity:.7">
        <span style="font-size:20px;flex-shrink:0">✓</span>
        <div style="flex:1;min-width:0"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:line-through">${esc(p.title || 'Colis')}</div></div>
        <button class="vrm-pk-undo" data-k="${esc(p.key)}" title="Annuler : le remettre à retirer" style="flex-shrink:0;border:1px solid #b0b6bf;background:transparent;color:#556;border-radius:8px;padding:6px 9px;font-weight:700;font-size:12px;cursor:pointer">↺ Remettre</button>
      </div>`;
    return `
      ${list.length ? `<div class="vrm-m" style="font-weight:800;margin-bottom:6px">📦 ${list.length} colis à retirer</div>${list.slice(0, 60).map(row).join('')}` : ''}
      ${gotten.length ? `<div class="vrm-m" style="font-weight:700;margin:8px 0 6px;color:#0f6b4f">✅ ${gotten.length} récupéré${gotten.length > 1 ? 's' : ''}</div>${gotten.slice(0, 60).map(gotRow).join('')}` : ''}
      <div class="vrm-m" style="margin-top:6px;opacity:.85">Mondial Relay = code + pièce d'identité. Chronopost = QR (dans l'app).</div>`;
  }
  function wireAchats() {
    panel.querySelectorAll('.vrm-pk-copy').forEach(b => {
      b.onclick = () => {
        const c = b.dataset.c; if (!c) return;
        try { navigator.clipboard.writeText(c); } catch (_) {}
        const p = b.textContent; b.textContent = '✓ Copié !'; setTimeout(() => { try { b.textContent = p; } catch (_) {} }, 1200);
      };
    });
    panel.querySelectorAll('.vrm-pk-done').forEach(b => {
      b.onclick = () => {
        const k = b.dataset.k; if (!k) return;
        b.disabled = true; b.textContent = '⏳';
        chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'markPickupDone', key: k, done: true }, (resp) => {
          if (resp && resp.ok) {
            pickupDoneLocal.add(k);
            if (DATA && DATA.stats) DATA.stats.toPickup = Math.max(0, (DATA.stats.toPickup || 1) - 1);
            render();
          } else { try { b.disabled = false; b.textContent = '✓ Récupéré'; } catch (_) {} }
        });
      };
    });
    panel.querySelectorAll('.vrm-pk-undo').forEach(b => {
      b.onclick = () => {
        const k = b.dataset.k; if (!k) return;
        b.disabled = true; b.textContent = '⏳';
        chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'markPickupDone', key: k, done: false }, (resp) => {
          if (resp && resp.ok) {
            pickupDoneLocal.delete(k);
            if (DATA && DATA.stats) DATA.stats.toPickup = (DATA.stats.toPickup || 0) + 1;
            render();
          } else { try { b.disabled = false; b.textContent = '↺ Remettre'; } catch (_) {} }
        });
      };
    });
  }

  // ── ONGLET REPUBLIER : sélection + défilement UNE-PAR-UNE ────────────────────
  // Tu coches les annonces à remettre en avant, puis « Commencer » : le panneau
  // t'OUVRE chaque annonce à ton clic, une à la fois. Tu republies toi-même sur
  // Vinted (bouton natif) et tu passes à la suivante. Rien ne part tout seul.
  function renderRepublier() {
    const list = (DATA && DATA.online) || [];
    if (!list.length) return `<div class="vrm-m">Aucune annonce en ligne captée pour l'instant. Ouvre ta boutique Vinted une fois pour les capter.</div>`;
    // Mode défilement : une annonce à la fois.
    if (repubRun) {
      const total = repubRun.queue.length;
      const done = repubRun.idx;
      if (done >= total) {
        return `<div class="vrm-card" style="text-align:center">
            <div style="font-size:15px;font-weight:800;margin-bottom:4px">✓ Terminé</div>
            <div class="vrm-m">${total} annonce${total > 1 ? 's' : ''} passée${total > 1 ? 's' : ''} en revue.</div>
            <button class="vrm-go" data-act="stop" style="margin-top:10px;border:none;background:#09b1ba;color:#fff;border-radius:10px;padding:8px 14px;font-weight:800;cursor:pointer">Fermer la file</button>
          </div>`;
      }
      const o = (DATA.byId && DATA.byId[repubRun.queue[done]]) || null;
      if (!o) { repubRun.idx++; return renderRepublier(); }
      return `
        <div class="vrm-m" style="margin-bottom:8px">Annonce <b>${done + 1}</b> / ${total} — republie-la sur Vinted, puis <b>Suivante</b>.</div>
        ${card(o, o.numero ? `<div class="vrm-m" style="margin-top:3px">N°${esc(o.numero)}${o.cell ? ` · 🏠 case ${esc(o.cell)}` : ''}</div>` : '')}
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="vrm-go" data-act="open" style="flex:1;border:none;background:#09b1ba;color:#fff;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">Ouvrir sur Vinted ↗</button>
          <button class="vrm-go" data-act="next" style="flex:1;border:1px solid #09b1ba;background:transparent;color:#09b1ba;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">Suivante ▶</button>
        </div>
        <div style="text-align:center;margin-top:8px"><button class="vrm-go" data-act="stop" style="border:none;background:transparent;color:#889;font-size:11.5px;cursor:pointer;text-decoration:underline">Arrêter</button></div>`;
    }
    // Mode sélection : la liste avec des cases à cocher.
    const rows = list.slice(0, 200).map(o => `
      <label class="vrm-card vrm-repub-row" data-s="${esc(((o.numero != null ? 'n°' + o.numero + ' ' : '') + (o.title || '')).toLowerCase())}" style="display:flex;gap:9px;align-items:center;cursor:pointer;margin-bottom:6px;padding:8px">
        <input type="checkbox" class="vrm-chk" data-id="${esc(o.id)}" ${repubSel.has(o.id) ? 'checked' : ''} style="width:18px;height:18px;flex-shrink:0;accent-color:#09b1ba">
        ${o.photo ? `<img src="${esc(o.photo)}" alt="" style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex-shrink:0;background:#eee">` : '<div style="width:38px;height:38px;border-radius:8px;background:#eee;flex-shrink:0"></div>'}
        <div style="flex:1;min-width:0">
          <div class="vrm-t">${o.numero ? `<span class="vrm-num">N°${esc(o.numero)}</span> ` : ''}${esc(o.title)}</div>
          <div class="vrm-m">${fmt(o.price)}${o.ageDays != null ? ` · ${o.ageDays} j` : ''}</div>
        </div>
      </label>`).join('');
    return `
      <div class="vrm-m" style="margin-bottom:8px">Coche les annonces à <b>remettre en avant</b>. Tu les republieras <b>une par une, toi-même</b> — aucune action automatique.</div>
      ${list.length > 8 ? `<input id="vrm-repub-search" type="search" value="${esc(repubQuery)}" placeholder="🔍 Filtrer (titre ou N°)…" style="width:100%;box-sizing:border-box;margin-bottom:8px;border:1px solid #d7dde3;border-radius:9px;padding:7px 10px;font:inherit;font-size:12.5px">` : ''}
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="vrm-go" data-act="all" style="flex:1;border:1px solid #dde;background:#fff;color:#334;border-radius:8px;padding:6px;font-weight:700;font-size:11.5px;cursor:pointer">Tout cocher</button>
        <button class="vrm-go" data-act="none" style="flex:1;border:1px solid #dde;background:#fff;color:#334;border-radius:8px;padding:6px;font-weight:700;font-size:11.5px;cursor:pointer">Tout décocher</button>
      </div>
      ${(() => {
        // Cocher d'un coup les PRIORITÉS (mêmes listes que les onglets « Dorment »
        // et « À relancer » → aucune divergence). Aide à republier ce qui rapporte
        // le plus d'abord, sans rien automatiser.
        const nS = ((DATA && DATA.sleeping) || []).length, nR = ((DATA && DATA.relance) || []).length;
        if (!nS && !nR) return '';
        return `<div class="vrm-m" style="margin-bottom:4px">Cocher en priorité :</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${
          nS ? `<button class="vrm-go" data-act="psleep" style="border:1px solid #c9dbf7;background:#eef4ff;color:#2b5b9a;border-radius:999px;padding:5px 11px;font-weight:700;font-size:11.5px;cursor:pointer">😴 ${nS} qui dorment</button>` : ''
        }${
          nR ? `<button class="vrm-go" data-act="prelance" style="border:1px solid #ffd7a8;background:#fff6ec;color:#9a5b16;border-radius:999px;padding:5px 11px;font-weight:700;font-size:11.5px;cursor:pointer">💡 ${nR} à relancer</button>` : ''
        }</div>`;
      })()}
      <div style="margin-bottom:8px">${rows}</div>
      <button class="vrm-go" data-act="start" ${repubSel.size ? '' : 'disabled'} style="position:sticky;bottom:0;width:100%;border:none;background:${repubSel.size ? '#09b1ba' : '#9bb'};color:#fff;border-radius:10px;padding:11px;font-weight:800;cursor:${repubSel.size ? 'pointer' : 'default'};box-shadow:0 -6px 14px rgba(0,0,0,.12)">Commencer (${repubSel.size})</button>`;
  }

  function wireRepublier() {
    // Filtre local (sur le DOM, sans re-render → l'input garde le focus).
    const si = panel.querySelector('#vrm-repub-search');
    const applyFilter = () => {
      const q = repubQuery.trim().toLowerCase();
      panel.querySelectorAll('.vrm-repub-row').forEach(row => {
        row.style.display = (!q || (row.dataset.s || '').includes(q)) ? '' : 'none';
      });
    };
    if (si) { si.oninput = () => { repubQuery = si.value; applyFilter(); }; applyFilter(); }
    panel.querySelectorAll('.vrm-chk').forEach(c => {
      c.onchange = () => { const id = c.dataset.id; if (c.checked) repubSel.add(id); else repubSel.delete(id); render(); };
    });
    panel.querySelectorAll('.vrm-go').forEach(b => {
      b.onclick = () => {
        const act = b.dataset.act;
        const list = (DATA && DATA.online) || [];
        if (act === 'all') { list.forEach(o => repubSel.add(o.id)); render(); }
        else if (act === 'none') { repubSel.clear(); render(); }
        else if (act === 'psleep') { ((DATA && DATA.sleeping) || []).forEach(o => o && o.id && repubSel.add(o.id)); render(); }
        else if (act === 'prelance') { ((DATA && DATA.relance) || []).forEach(o => o && o.id && repubSel.add(o.id)); render(); }
        else if (act === 'start') { if (!repubSel.size) return; repubRun = { queue: list.filter(o => repubSel.has(o.id)).map(o => o.id), idx: 0 }; render(); }
        else if (act === 'stop') { repubRun = null; render(); }
        else if (act === 'open') { const o = DATA.byId[repubRun.queue[repubRun.idx]]; if (o && o.url) window.open(o.url, '_blank', 'noopener'); }
        else if (act === 'next') { repubRun.idx++; render(); }
      };
    });
  }

  function load() {
    try {
      dataBusy = true; render();
      chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'panelData' }, (resp) => {
        dataBusy = false; lastLoad = Date.now();
        if (chrome.runtime.lastError) { DATA = { stats: {}, byId: {}, relance: [], sleeping: [], noNum: [] }; render(); return; }
        DATA = (resp && resp.ok) ? resp : { stats: {}, byId: {}, relance: [], sleeping: [], noNum: [] };
        render();
        // Pastille = ce qui T'ATTEND concrètement : colis à expédier + messages
        // non lus (les vraies actions), sinon les paires à relancer.
        const st = DATA.stats || {};
        const n = (st.toPrint || 0) + (st.toShip || 0) + (st.toPickup || 0) + (st.unread || 0) || (DATA.relance || []).length;
        const old = fab.querySelector('.vrm-badge'); if (old) old.remove();
        if (n > 0) { const b = document.createElement('span'); b.className = 'vrm-badge'; b.textContent = n > 99 ? '99+' : String(n); fab.appendChild(b); }
      });
    } catch (_) { dataBusy = false; /* extension rechargée */ }
  }

  function toggle(v) {
    open = v == null ? !open : v;
    writeLS('vrm_panel_open', open ? '1' : '0'); // mémorise ouvert/fermé
    panel.style.display = open ? 'block' : 'none';
    // Rafraîchit à l'ouverture si les données datent de plus de 2 min (sinon on
    // garde le cache — pas de lecture Supabase à chaque petit aller-retour).
    if (open) { render(); if (!DATA || Date.now() - lastLoad > 120000) load(); }
  }
  fab.onclick = () => toggle();

  // Navigation interne Vinted (SPA) : si on change d'annonce, on rafraîchit
  // l'onglet « Cette paire » sans recharger les données.
  let lastPath = location.pathname;
  const onPage = () => {
    const id = currentItemId();
    // La page Vinted se remplit progressivement : on retente un peu.
    if (id) { captureDate(id); setTimeout(() => captureDate(id), 1500); setTimeout(() => captureDate(id), 4000); }
  };
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      onPage();
      // Contexte : en ARRIVANT sur une conversation, on met l'assistant de
      // réponse en avant (tu n'as qu'à coller le message de l'acheteur). On ne
      // force jamais en sortant — c'est juste un coup de pouce à l'arrivée.
      if (open && isConvPage() && tab !== 'reponse' && tab !== 'messages') { tab = 'reponse'; render(); }
      else if (open && tab === 'paire') render();
    }
  }, 800);

  load();   // pastille dès l'arrivée sur Vinted
  onPage(); // lit la date si on arrive directement sur une annonce
})();
