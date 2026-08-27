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
  // ⚠️ « republier » N'EST PLUS UN ONGLET (demande de Julien : « ne mets pas
  // l'onglet republié, ce n'est pas obligé »). `renderRepublier` reste dans le
  // fichier mais PLUS RIEN NE L'OUVRE — même parti pris que « Renuméroter à la
  // suite » côté app (§5.45) : on retire l'entrée, on ne charcute pas le code.
  const PANEL_TABS = ['journee', 'recherche', 'paire', 'chaussures', 'ventes', 'coffre', 'reponse', 'expedier', 'achats', 'litiges', 'messages', 'favoris'];
  // ── LA BARRE D'ONGLETS : 5 au quotidien, le reste derrière « Plus » ────────
  // Douze pastilles sur trois rangées, c'est un mur : on ne lit plus, on
  // cherche. Même remède que la barre du bas de l'app (§5.53) — les écrans du
  // quotidien restent visibles, les autres passent derrière un bouton, et ce
  // bouton s'allume quand l'onglet affiché vient de derrière (sinon on ne sait
  // plus où on est).
  const TABS_PLUS = ['ventes', 'recherche', 'coffre', 'litiges', 'favoris'];
  let plusOuvert = false;
  // Le COFFRE, chargé à la demande (une requête, seulement quand tu ouvres l'onglet).
  let coffre = null, coffreBusy = false, coffreQuery = '', coffreOuvert = null;
  let chaussuresQuery = ''; // filtre de l'onglet « Mes paires »
  let chaussuresSort = 'num'; // tri : num | marge | vues | favs | age | prix
  let chaussuresFilter = 'all'; // sous-vue : all | relance | sleep | nonum
  let ventesFilter = 'all'; // onglet Ventes : all | pending | completed
  let ventesQuery = ''; // recherche dans l'onglet Ventes (gardée entre rendus)
  let ventesAcct = 'all';   // filtre par COMPTE Vinted (uid) sur les ventes
  let ventesFrom = '';      // période : date de début (aaaa-mm-jj), vide = pas de borne
  let ventesTo = '';        // période : date de fin
  let calOpen = false;      // le calendrier de période est-il déplié ?
  let calMonth = 0;         // mois affiché par le calendrier (ms, 1er du mois)
  let chaussuresVue = 'online'; // « Mes paires » : online (en ligne) | sold (vendues)
  const readLS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
  const readJSON = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  let open = readLS('vrm_panel_open', '0') === '1';
  let big = readLS('vrm_panel_big', '0') === '1'; // panneau agrandi (quasi plein écran)
  let tab = (() => { const t = readLS('vrm_panel_tab', 'journee'); return PANEL_TABS.includes(t) ? t : 'journee'; })(); // journee | paire | relance | dorment | sansnum | republier | reponse | expedier | achats | messages | favoris
  // ── File de republication ASSISTÉE ─────────────────────────────────────────
  // repubSel = les annonces cochées. repubRun = le défilement une-par-une en
  // cours ({ queue:[ids], idx }). ⚠️ AUCUNE automatisation : le panneau OUVRE
  // l'annonce, c'est TOI qui republies sur Vinted, puis tu passes à la suivante.
  // Pas de file qui s'exécute seule, pas de délai, pas de requête envoyée à ta
  // place — c'est ce qui protège tes comptes.
  const repubSel = new Set();
  let repubRun = null;
  let shipCheck = 0;        // dernier « J'ai généré → vérifier » (pour l'accusé de réception)
  // Message TYPE préparé une fois, réutilisé sur chaque conversation cochée.
  // Stocké en localStorage : la conversation s'ouvre dans un AUTRE onglet, donc
  // un simple état mémoire ne suivrait pas.
  let msgModele = readLS('vrm_msg_modele', '');
  let repubQuery = ''; // filtre texte de la liste Republier (gardé entre rendus)
  // « ✓ Republiée » demande une confirmation, et la question posée est CELLE qui
  // compte : l'ancienne annonce est-elle supprimée ? C'est le geste qu'on oublie
  // (§5.05), et l'oublier met deux paires sur le même numéro.
  let repubArm = null, repubArmT = 0;
  // ── Mémoire LOCALE des republications faites (par appareil, PAS d'action Vinted) :
  //    {id: timestamp}. Sert à ne jamais te faire refaire une paire déjà republiée
  //    récemment, à montrer ta progression, et à ranger en bas ce qui est fait.
  //    Purement un aide-mémoire d'affichage : rien n'est envoyé à Vinted, rien n'est
  //    écrit dans le cloud. Une paire redevient « à republier » après ~20 h.
  const REPUB_FRESH_MS = 20 * 3600 * 1000;
  let repubDone = readJSON('vrm_repub_done', {});
  const isRepubRecent = (id) => { const t = repubDone[String(id)]; return t && (Date.now() - t) < REPUB_FRESH_MS; };
  // ⚠️ On mémorise AUSSI le N° et le titre : republier crée une NOUVELLE annonce
  // (nouvel id), donc le numéro se détache de la paire. Sans ça, le N° repart
  // dans le pool et peut être donné à une autre paire alors que la tienne occupe
  // toujours sa boîte au garage (cf. background.js `marquerRepublie`).
  const markRepub = (id) => {
    repubDone[String(id)] = Date.now();
    writeJSON('vrm_repub_done', repubDone);
    const o = (DATA && DATA.byId && DATA.byId[String(id)]) || null;
    try {
      chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'repubMarque',
        id: String(id), numero: o && o.numero != null ? String(o.numero) : '', title: (o && o.title) || '' });
    } catch (_) {}
  };
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
  // Ventes cochees pour un lot de bordereaux (par n° de transaction). Gardé
  // entre deux rendus : un `load()` ne doit pas vider la selection en cours.
  const bordPick = new Set();
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
  // Vignette photo d'une paire (ou pictogramme si pas de photo captée). Taille au choix.
  const pairThumb = (o, sz) => { const s = sz || 44; return (o && o.photo)
    ? `<img src="${esc(o.photo)}" alt="" style="width:${s}px;height:${s}px;border-radius:9px;object-fit:cover;flex-shrink:0;background:#eee">`
    : `<div style="width:${s}px;height:${s}px;border-radius:9px;background:#eef1f4;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:${Math.round(s * 0.42)}px">👟</div>`; };
  // Badge N° (avant le titre) quand la paire a un numéro retrouvé. Réutilise .vrm-num.
  const numBadge = (o) => (o && o.numero != null && o.numero !== '') ? `<span class="vrm-num">N°${esc(o.numero)}</span> ` : '';
  // ── Icônes au trait (Feather, MIT) : look pro, plus d'emojis dans la nav. ──
  const ICONS = {
    "more-horizontal": '<circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle>',
    "archive": '<polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line>',
    "calendar": '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
    "file-text": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>',
    "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>',
    "send": '<line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>',
    "check-circle": '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
    "edit-3": '<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>',
    "dollar-sign": '<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>',
    "sliders": '<line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>',
    "home": '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
    "eye": '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>',
    "grid": '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>',
    "trending-up": '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>',
    "refresh-cw": '<polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>',
    "printer": '<polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect>',
    "shopping-bag": '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path>',
    "alert-triangle": '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    "message-circle": '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>',
    "heart": '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>',
    "settings": '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
    "maximize-2": '<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>',
    "minimize-2": '<polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line>',
    "x": '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
    "search": '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
    "zap": '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
    "tag": '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>',
    "moon": '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>',
    "hash": '<line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line>',
  };
  const svgi = (name, sz) => { const p = ICONS[name]; if (!p) return ''; const s = sz || 16; return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;flex-shrink:0">${p}</svg>`; };
  // Conseil marché compact réutilisable (même règle partout : écart >15% vs médiane
  // des paires comparables o.peer). Renvoie '' si pas d'écart net ou pas de peer.
  const marketNote = (o) => {
    const sell = eur(o && o.price), pe = (o && o.peer != null) ? Number(o.peer) : null;
    if (pe == null || sell == null) return '';
    const cible = Math.round(pe);
    if (sell > pe * 1.15) return `<div class="vrm-m" style="margin-top:6px;padding:5px 8px;border-radius:8px;background:#fff6ec;color:#9a5b16;border:1px solid #ffd7a8">📊 Trop cher (marché ~${fmt(pe)}) → essaie <b>~${cible} €</b></div>`;
    if (sell < pe * 0.85) return `<div class="vrm-m" style="margin-top:6px;padding:5px 8px;border-radius:8px;background:#eefaf3;color:#0f6b4f;border:1px solid #bfe6d3">📊 Sous le marché (~${fmt(pe)}) → tu peux monter vers <b>~${cible} €</b></div>`;
    return '';
  };
  // Lien 1-tap vers la page d'édition Vinted d'une annonce (change prix/titre).
  const editLink = (id) => `<a class="vrm-link" href="https://www.vinted.fr/items/${esc(id)}/edit" target="_blank" rel="noreferrer" style="border:1px solid #D2401E;background:#D2401E;color:#fff;border-radius:8px;padding:6px 12px;font-weight:700;font-size:12px;text-decoration:none">✏️ Modifier ↗</a>`;

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
  // Textes que Vinted met dans `og:description` quand la vraie description
  // n'est pas (encore) dans la page. Ce n'est jamais l'annonce du vendeur.
  const PUB_VINTED = /une communaut[ée].{0,60}marques|pour chaque achat effectu|thousands of brands|politique de rembours/i;
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
        // ⚠️ `og:description` retombe sur le TEXTE MARKETING DE VINTED quand le
        // bloc description n'est pas encore rendu (« Une communauté, des
        // milliers de marques… », « Pour chaque achat effectué… »). Enregistré
        // tel quel, ce texte remplaçait la vraie annonce dans Republier : on
        // aurait recollé la pub de Vinted à la place de la description de
        // Julien. Mesuré : 5 fiches sur 20 étaient dans ce cas.
        if (t.length > 15 && !PUB_VINTED.test(t)) { out.description = t.slice(0, 3000); break; }
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
      background:#D2401E;color:#fff;border:none;cursor:pointer;font:800 18px/1 system-ui,-apple-system,sans-serif;
      box-shadow:0 6px 20px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center}
    #vrm-fab:hover{transform:scale(1.05)}
    #vrm-fab .vrm-badge{position:absolute;top:-4px;right:-4px;background:#e8590c;color:#fff;border-radius:999px;
      min-width:20px;height:20px;padding:0 5px;font:800 11px/20px system-ui,sans-serif;text-align:center}
    #vrm-panel{position:fixed;right:18px;bottom:80px;z-index:2147483000;width:min(540px,95vw);max-height:86vh;overflow:auto;
      background:#EFE8DC;color:#151110;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.3);border:1px solid #D9CFBE;
      font:13.5px/1.5 system-ui,-apple-system,sans-serif;padding:0}
    /* Mode agrandi : quasi plein écran, pour piloter toute la boutique sans l'app. */
    /* Agrandi = QUASI TOUTE LA PAGE Vinted (demande de Julien : « essaye de
       remplir toute la page »). Marges minimales, une seule colonne partout. */
    #vrm-panel.vrm-big{width:calc(100vw - 24px);max-width:none;height:calc(100vh - 24px);max-height:none;right:12px;bottom:12px;border-radius:14px}
    #vrm-panel .vrm-head{position:sticky;top:0;z-index:6;background:#EFE8DC;padding:13px 16px 9px;
      border-bottom:1px solid #eef0f4;border-radius:16px 16px 0 0}
    #vrm-panel #vrm-body{padding:12px 16px 0}
    #vrm-panel.vrm-big .vrm-tab{font-size:12.5px;padding:6px 12px}
    #vrm-panel.vrm-big h3{font-size:17px}
    #vrm-panel h3{margin:0 0 2px;font-size:15px;font-weight:800;letter-spacing:.3px;
      color:#151110;background:none;-webkit-background-clip:border-box;background-clip:border-box}
    #vrm-panel .vrm-sub{color:#7a6d5f;font-size:11.5px;margin-bottom:9px}
    #vrm-panel .vrm-tabs{display:flex;gap:5px;flex-wrap:wrap}
    #vrm-panel .vrm-tab{display:inline-flex;align-items:center;gap:6px;border:1px solid #DED3C1;background:#FBF7F0;color:#4a4038;border-radius:6px;padding:6px 11px;
      font:600 11.5px system-ui,sans-serif;cursor:pointer;transition:background .12s,border-color .12s,color .12s,box-shadow .12s}
    #vrm-panel .vrm-tab svg{opacity:.7}
    #vrm-panel .vrm-tab:hover{border-color:#C3B49C;color:#151110;background:#F3ECE1}
    #vrm-panel .vrm-tab.on{background:#151110;border-color:#151110;color:#EFE8DC;box-shadow:0 2px 6px rgba(21,17,16,.22)}
    #vrm-panel .vrm-tab.on svg{opacity:1}
    #vrm-panel .vrm-refresh{position:absolute;top:12px;right:38px;border:none;background:transparent;
      cursor:pointer;color:#8a929e;padding:0;line-height:0;display:flex}
    #vrm-panel .vrm-refresh:hover{color:#0f172a}
    #vrm-panel .vrm-spin{display:inline-flex;animation:vrmspin 1s linear infinite}
    @keyframes vrmspin{to{transform:rotate(360deg)}}
    #vrm-panel .vrm-max{position:absolute;top:12px;right:64px;border:none;background:transparent;
      cursor:pointer;color:#8a929e;padding:0;line-height:0;display:flex}
    #vrm-panel .vrm-max:hover{color:#0f172a}
    #vrm-panel .vrm-card{border:1px solid #DED3C1;border-radius:6px;padding:11px;margin-bottom:8px;background:#FBF7F0;box-shadow:0 1px 2px rgba(21,17,16,.05)}
    #vrm-panel .vrm-num{display:inline-block;background:linear-gradient(135deg,#0bbcc5,#B33418);color:#fff;border-radius:8px;padding:2px 9px;font-weight:800;box-shadow:0 1px 2px rgba(9,177,186,.3)}
    #vrm-panel .vrm-row{display:flex;gap:9px;align-items:center}
    #vrm-panel .vrm-row img{width:44px;height:44px;border-radius:10px;object-fit:cover;flex-shrink:0;background:#eee}
    #vrm-panel .vrm-t{font-weight:700;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #vrm-panel .vrm-m{color:#66707d;font-size:11px}
    #vrm-panel a.vrm-link{color:#D2401E;font-weight:800;text-decoration:none;font-size:11.5px}
    /* UNE SEULE LIGNE PAR INFO (demande de Julien : plus rien côte à côte).
       Chaque chiffre occupe toute la largeur : libellé à gauche, valeur à droite. */
    #vrm-panel .vrm-stats{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
    #vrm-panel .vrm-st{display:flex;align-items:baseline;justify-content:space-between;gap:12px;width:100%;box-sizing:border-box;
      border:1px solid #eceff4;border-radius:12px;padding:9px 12px;background:#fbfcfe;box-shadow:0 1px 2px rgba(16,24,40,.03)}
    #vrm-panel .vrm-st b{order:2;font-size:18px;letter-spacing:-.2px;white-space:nowrap;flex-shrink:0}
    #vrm-panel .vrm-st .vrm-m{order:1;flex:1 1 auto;min-width:0;font-size:12px}
    /* Rangées cliquables (Mes paires, etc.) : léger relief au survol. */
    #vrm-panel .vrm-ch-row,#vrm-panel .vrm-repub-row,#vrm-panel .vrm-bord-row{transition:border-color .12s,box-shadow .12s,transform .06s}
    #vrm-panel .vrm-ch-row:hover,#vrm-panel .vrm-repub-row:hover{border-color:#bfe4e6;box-shadow:0 3px 10px rgba(9,177,186,.10)}
    /* Listes en 2 colonnes quand le panneau est agrandi (plus de paires d'un coup). */
    #vrm-panel .vrm-grid{display:flex;flex-direction:column;gap:7px}
    #vrm-panel.vrm-big .vrm-grid{display:flex;flex-direction:column;gap:8px}
    #vrm-panel .vrm-grid>*{margin-bottom:0!important}
    #vrm-panel .vrm-close{position:absolute;top:9px;right:12px;border:none;background:transparent;cursor:pointer;font-size:16px;color:#889;padding:0;line-height:1}
    #vrm-panel .vrm-close:hover{color:#334}
    #vrm-panel .vrm-todo{display:inline-flex;align-items:center;gap:5px;border:1px solid #ffd7a8;background:#fff6ec;color:#9a5b16;border-radius:999px;padding:5px 11px;
      font:600 11.5px system-ui,sans-serif;cursor:pointer}
    #vrm-panel .vrm-todo:hover{background:#ffedd8}
    @media (prefers-color-scheme: dark){
      #vrm-panel{background:#161a20;color:#e8eef5;border-color:#2a3038}
      #vrm-panel .vrm-head{background:#161a20;border-bottom-color:#2a3038}
      #vrm-panel .vrm-card,#vrm-panel .vrm-st{border-color:#2a3038}
      #vrm-panel .vrm-tab{background:#1e242c;border-color:#2a3038;color:#cfd8e3}
      #vrm-panel .vrm-tab:hover{background:#252c35;border-color:#3a424d;color:#fff}
      #vrm-panel .vrm-tab.on{background:#e8edf3;border-color:#e8edf3;color:#0f172a;box-shadow:none}
      #vrm-panel .vrm-refresh,#vrm-panel .vrm-max,#vrm-panel .vrm-close{color:#8a929e}
      #vrm-panel .vrm-refresh:hover,#vrm-panel .vrm-max:hover,#vrm-panel .vrm-close:hover{color:#e8eef5}
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
  // Les chiffres d'argent (CA du mois, argent en attente, encaissé) viennent de la
  // ligne `widget_stats` PUBLIÉE PAR L'APP → jamais recalculés ici, donc jamais un
  // chiffre qui contredit l'app. On affiche leur fraîcheur honnêtement.
  const eurInt = (v) => (v == null ? '—' : Number(v).toLocaleString('fr-FR') + ' €');
  function renderJournee() {
    const s = (DATA && DATA.stats) || {};
    const a = (DATA && DATA.appStats) || null;
    const heure = new Date().getHours();
    const bonjour = heure < 18 ? 'Bonjour 👋' : 'Bonsoir 👋';
    const todo = [
      s.toPrint ? { t: 'expedier', ic: 'printer', n: s.toPrint, lbl: 'à imprimer' } : null,
      s.toShip ? { t: 'expedier', ic: 'printer', n: s.toShip, lbl: 'à générer' } : null,
      s.toPickup ? { t: 'achats', ic: 'shopping-bag', n: s.toPickup, lbl: 'à retirer' } : null,
      s.offres ? { t: 'messages', ic: 'dollar-sign', n: s.offres, lbl: s.offres > 1 ? 'offres reçues' : 'offre reçue' } : null,
      s.unread ? { t: 'messages', ic: 'message-circle', n: s.unread, lbl: s.unread > 1 ? 'messages' : 'message' } : null,
    ].filter(Boolean);
    const tile = (label, val, color) => `<div class="vrm-st"><b style="color:${color || 'inherit'}">${val}</b><span class="vrm-m">${label}</span></div>`;
    const money = a ? `
      <div class="vrm-card" style="text-align:center;background:linear-gradient(135deg,#D2401E0f,#D2401E05);border-color:#D2401E55">
        <div class="vrm-m" style="text-transform:uppercase;font-size:10px;letter-spacing:.6px">Ce mois-ci</div>
        <div style="font-weight:800;font-size:30px;color:#D2401E;line-height:1.1;margin:2px 0">${eurInt(a.caMois)}</div>
        <div class="vrm-m">${a.ventesMois != null ? `${a.ventesMois} vente${a.ventesMois > 1 ? 's' : ''}` : ''}</div>
      </div>
      <div class="vrm-stats" style="margin-top:8px">
        ${tile('Argent en attente', eurInt(a.enAttente), '#c98a1a')}
        ${tile('Encaissé', eurInt(a.caEncaisse), '#0f6b4f')}
      </div>`
      : `<div class="vrm-card"><div class="vrm-m">Ouvre l'app une fois pour voir ton <b>CA du mois</b> et ton <b>argent en attente</b> ici (ils sont calculés par l'app).</div></div>`;
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
          <div style="margin-top:6px;height:9px;border-radius:999px;background:#e6eaee;overflow:hidden"><div style="height:100%;width:${pct}%;border-radius:999px;background:${atteint ? '#0f6b4f' : '#D2401E'};transition:width .4s"></div></div>
          <div class="vrm-m" style="margin-top:4px">${atteint ? '🎉 Objectif atteint, bravo !' : `${pct}% — plus que ${eurInt(goal - ca)}`}</div>
        </div>`;
    }
    const stockLine = `
      <div class="vrm-stats" style="margin-top:8px">
        ${tile('En ligne', s.online != null ? s.online : '—')}
        ${tile('Valeur du stock', eurInt(s.value != null ? Math.round(s.value) : null))}
      </div>
      ${(s.viewsTotal != null || s.favsTotal != null) ? `<div class="vrm-m" style="text-align:center;margin-top:6px">👁 <b>${s.viewsTotal != null ? s.viewsTotal : '—'}</b> vues · ❤️ <b>${s.favsTotal != null ? s.favsTotal : '—'}</b> favoris <span style="opacity:.7">cumulés</span></div>` : ''}`;
    const todoBlock = todo.length ? `
      <div class="vrm-m" style="font-weight:700;margin:12px 0 5px">À faire aujourd'hui</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${todo.map(x => `<button class="vrm-todo" data-t="${x.t}">${svgi(x.ic, 13)} ${x.n} ${x.lbl}</button>`).join('')}</div>`
      : `<div class="vrm-card" style="margin-top:12px"><div class="vrm-m">✅ Rien d'urgent : tout est à jour. Beau boulot.</div></div>`;
    // Optimisation : opportunités déjà calculées (mêmes onglets), pour vendre plus.
    const optim = [
      s.relance ? { f: 'relance', ic: 'zap', n: s.relance, lbl: 'à relancer' } : null,
      s.overMarket ? { f: 'over', ic: 'trending-up', n: s.overMarket, lbl: 'trop cher' } : null,
      s.sleeping ? { f: 'sleep', ic: 'moon', n: s.sleeping, lbl: 'dorment' } : null,
      s.noNum ? { f: 'nonum', ic: 'hash', n: s.noNum, lbl: 'sans N°' } : null,
    ].filter(Boolean);
    const optimBlock = optim.length ? `
      <div class="vrm-m" style="font-weight:700;margin:12px 0 5px">Pour vendre plus</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${optim.map(x => `<button class="vrm-todo" data-t="chaussures" data-filter="${x.f}">${svgi(x.ic, 13)} ${x.n} ${x.lbl}</button>`).join('')}</div>` : '';
    // Dernières ventes (lecture seule) : la liste des commandes moissonnées, mêmes
    // règles de statut que l'app. Aucun total ici — le CA reste celui de l'app.
    const rs = (DATA && DATA.recentSales) || [];
    const etatLbl = { completed: '✅ finalisée', pending: '⏳ en cours' };
    const salesBlock = rs.length ? `
      <div class="vrm-m" style="font-weight:700;margin:12px 0 5px">🧾 Dernières ventes</div>
      <div style="border:1px solid #eceff3;border-radius:12px;overflow:hidden">
        ${rs.map((v, i) => `<a href="${esc(v.url)}" target="_blank" rel="noreferrer" style="display:flex;gap:9px;align-items:center;padding:8px 10px;text-decoration:none;color:inherit;${i ? 'border-top:1px solid #f0f2f5' : ''}">
          ${pairThumb(v, 42)}
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${numBadge(v)}${esc(v.title || 'Vente')}</div>
            <div class="vrm-m" style="font-size:11px;margin-top:1px">${etatLbl[v.etat] || ''}${v.ts ? ` · ${esc(timeago(v.ts))}` : ''}</div>
          </div>
          <div style="flex-shrink:0;font-weight:700;font-size:13px;color:#0f6b4f">${fmt(v.price)}</div>
        </a>`).join('')}
      </div>` : '';
    const fresh = a && a.updatedAt ? `<div class="vrm-m" style="text-align:center;margin-top:8px;opacity:.7">Chiffres de l'app · ${esc(timeago(Date.parse(a.updatedAt)))}</div>` : '';
    return `<div class="vrm-m" style="font-weight:700;font-size:14px;margin-bottom:8px">${bonjour}</div>${money}${goalBlock}${stockLine}${todoBlock}${optimBlock}${salesBlock}${comptesBlock()}${fresh}`;
  }

  // ── COMPTES VINTED : afficher / masquer, DEPUIS L'EXTENSION ──────────────────
  // Un compte masqué disparaît de TOUT le panneau (paires, ventes, achats,
  // messages, litiges) — plus besoin de rouvrir l'app pour retirer un compte.
  // Écrit dans une ligne DÉDIÉE (`panel_accounts_off`), jamais dans la ligne
  // `main` de l'app : aucune sauvegarde de l'app ne peut être écrasée.
  // ── LE COMPTE CONNECTÉ DANS CE NAVIGATEUR ───────────────────────────────────
  // Il n'y a RIEN à relier à la main : l'extension lit l'identifiant du compte
  // dans le cookie de session Vinted. Mais quand il n'arrive pas dans l'app,
  // trois causes se ressemblent — jamais capté, supprimé définitivement, ou
  // simplement masqué. On les distingue, avec le bouton qui va avec.
  function connecteBloc() {
    const c = DATA && DATA.connecte;
    if (!c) return `<div class="vrm-card" style="padding:9px 11px;margin-bottom:8px">
      <div style="font-weight:800;font-size:12.5px">👤 Aucun compte Vinted connecté ici</div>
      <div class="vrm-m" style="font-size:11px;margin-top:3px">Connecte-toi sur vinted.fr : l'extension capte le compte toute seule, tu n'as rien à choisir.</div>
    </div>`;
    const carte = (coul, titre, sous, bouton) => `<div class="vrm-card" style="padding:9px 11px;margin-bottom:8px;border-left:3px solid ${coul}">
      <div style="font-weight:800;font-size:12.5px;color:${coul}">${titre}</div>
      <div class="vrm-m" style="font-size:11px;margin-top:3px">${sous}</div>${bouton || ''}</div>`;
    const btn = (cls, txt, coul) => `<button class="${cls}" data-uid="${esc(c.uid)}" style="width:100%;margin-top:7px;border:none;background:${coul};color:#fff;border-radius:9px;padding:9px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">${txt}</button>`;
    const nom = esc(c.name || ('compte ' + c.uid));
    if (c.refus === 'supprime' || c.raison === 'supprime') {
      return carte('#b4232a', `⛔ ${nom} n'est pas synchronisé`,
        "Ce compte a été <b>supprimé définitivement</b> depuis l'app. L'extension refuse donc de l'envoyer, et efface sa ligne à chaque passage — c'est pour ça que rien n'arrive.",
        btn('vrm-reautoriser', '↺ Réautoriser et relier ce compte', '#b4232a'));
    }
    if (!c.capte) {
      return carte('#b06b00', `⏳ ${nom} n'est pas encore relié`,
        "Tu es connecté à ce compte dans ce navigateur, mais l'app ne l'a pas encore reçu.",
        btn('vrm-relier', '🔗 Relier ce compte maintenant', '#0f6b4f'));
    }
    if (c.off) {
      return carte('#b06b00', `🙈 ${nom} est relié mais masqué`,
        "Ses paires et ses ventes existent, elles sont juste cachées dans VRM. Réaffiche-le pour les revoir.",
        btn('vrm-reautoriser', '↺ Réafficher ce compte', '#0f6b4f'));
    }
    return carte('#0f6b4f', `✓ ${nom} est relié`,
      c.moissonne ? "Ses annonces sont bien captées." : "Ouvre ton dressing une fois sur Vinted pour capter ses annonces.");
  }

  function comptesBlock() {
    const accs = (DATA && DATA.accounts) || [];
    const tete = connecteBloc();
    if (accs.length < 2) return tete;
    const nOff = accs.filter(a => a.off).length;
    // D'où vient le masquage ? Un compte peut être coupé depuis l'app
    // (`vinted_accounts_hidden`), supprimé définitivement, ou masqué ici. Sans
    // cette mention, un compte disparaît sans raison visible et on croit à un
    // bug de capture. « ↺ Réafficher » marche désormais dans les trois cas.
    const pourquoi = { app: "masqué depuis l'app", supprime: "supprimé dans l'app", panneau: 'masqué ici' };
    // Depuis quand ce compte n'a-t-il rien envoyé ? Un compte muet depuis
    // deux semaines, c'est une session expirée — il faut repasser dessus.
    // Même échelle que l'écran Santé et que l'app : un même état ne doit pas
    // porter deux couleurs selon l'écran.
    const fraicheurTxt = (t) => {
      if (!t) return 'jamais capté';
      const j = (Date.now() - t) / 86400000;
      if (j < 1) return 'capté aujourd\'hui';
      if (j < 2) return 'capté hier';
      if (j < 7) return `capté il y a ${Math.round(j)} j`;
      return `⚠️ rien depuis ${Math.round(j)} j — repasse dessus`;
    };
    const rows = accs.map(a => `
      <div style="display:flex;gap:8px;align-items:center;padding:7px 2px;border-top:1px solid #f0f2f5">
        <div style="flex:1 1 120px;min-width:0">
          <div style="font-weight:700;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${a.off ? 'opacity:.5;text-decoration:line-through' : ''}">${esc(a.name)}</div>
          <div class="vrm-m" style="font-size:10.5px">${a.online} en ligne${a.off && pourquoi[a.raison] ? ` · ${pourquoi[a.raison]}` : ''} · ${fraicheurTxt(a.capte)}</div>
        </div>
        <button class="vrm-acct-off" data-uid="${esc(a.uid)}" data-off="${a.off ? '0' : '1'}" style="flex-shrink:0;border:1px solid ${a.off ? '#0f6b4f' : '#dde'};background:${a.off ? 'rgba(15,107,79,.08)' : '#fff'};color:${a.off ? '#0f6b4f' : '#556'};border-radius:8px;padding:5px 10px;font-weight:700;font-size:11px;cursor:pointer">${a.off ? '↺ Réafficher' : '✕ Masquer'}</button>
      </div>`).join('');
    // ⚠️ « TOUT RECAPTER » — la capture passive ne voit que ce que la page
    // charge, donc un compte peut rester avec un dressing partiel (mesuré :
    // 4 annonces captées sur 100 annoncées par Vinted). Ce bouton relit le
    // dressing COMPLET (toutes les pages), les ventes, les achats et la boîte,
    // pour le compte actuellement connecté — depuis ta session, sur ton IP.
    const recap = `<button id="vrm-recapter" style="width:100%;margin-top:8px;border:none;background:#0f6b4f;color:#fff;border-radius:10px;padding:10px;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer">🔄 Tout recapter (compte connecté)</button>
      <div class="vrm-m" style="font-size:10.5px;margin-top:4px">Relit toutes tes annonces, ventes et achats pour le compte ouvert dans ce navigateur. À faire une fois par compte.</div>`;
    return `${tete}${recap}<details class="vrm-card" style="margin-top:10px;padding:9px 11px"${nOff ? ' open' : ''}>
      <summary style="cursor:pointer;font-weight:700;font-size:12.5px;list-style:none">👤 Mes comptes Vinted (${accs.length}${nOff ? ` · ${nOff} masqué${nOff > 1 ? 's' : ''}` : ''})</summary>
      <div class="vrm-m" style="margin:5px 0 2px">Masque un compte que tu n'utilises plus : ses paires, ventes et messages disparaissent partout dans VRM.</div>
      ${rows}
    </details>`;
  }

  // ── ONGLET « MES PAIRES » : la liste de toutes tes chaussures en ligne, en
  //    grand (photo, N°, prix, marge, engagement, case garage). Lecture seule ;
  //    un clic ouvre l'annonce sur Vinted. Recherche par titre/marque/N°.
  function renderChaussures() {
    const online = (DATA && DATA.online) || [];
    const vendues = (DATA && DATA.sales) || [];
    // ── LE filtre principal, celui que Julien demandait : EN LIGNE ou VENDU.
    //    Deux gros boutons, rien d'autre à comprendre. Les tris/filtres fins
    //    (à relancer, dorment, sans N°…) restent en dessous, en option.
    const vueBtn = (k, l, n) => `<button class="vrm-chvue" data-v="${k}" style="flex:1;border:1px solid ${chaussuresVue === k ? '#0f172a' : '#dde'};background:${chaussuresVue === k ? '#0f172a' : '#fff'};color:${chaussuresVue === k ? '#fff' : '#334'};border-radius:11px;padding:9px;font-weight:800;font-size:12.5px;cursor:pointer">${l} ${n}</button>`;
    const vueBar = `<div style="display:flex;gap:6px;margin-bottom:9px">${vueBtn('online', '👟 En ligne', online.length)}${vueBtn('sold', '💶 Vendues', vendues.length)}</div>`;
    if (chaussuresVue === 'sold') {
      if (!vendues.length) return `${vueBar}<div class="vrm-m">Aucune vente captée pour l'instant.<br>Ouvre « Mes ventes » sur Vinted une fois pour les capter.</div>`;
      const parCompte = ventesAcct === 'all' ? vendues : vendues.filter(v => String(v.uid || '') === ventesAcct);
      return `${vueBar}${acctChipsFor(vendues, ventesAcct, 'vrm-vacct')}
        <div class="vrm-m" style="font-weight:800;margin-bottom:6px">💶 ${parCompte.length} paire${parCompte.length > 1 ? 's' : ''} vendue${parCompte.length > 1 ? 's' : ''}</div>
        <div class="vrm-grid">${parCompte.slice(0, 200).map(v => venteRow(v)).join('')}</div>`;
    }
    if (!online.length) return `${vueBar}<div class="vrm-m">Aucune annonce en ligne captée pour l'instant.<br>Ouvre ta boutique Vinted une fois pour les capter (0 requête ajoutée).</div>`;
    // Sous-vues (ex-onglets, maintenant fondus ici) : filtrent la même liste.
    const relanceIds = new Set(((DATA && DATA.relance) || []).map(o => String(o.id)));
    const sleepIds = new Set(((DATA && DATA.sleeping) || []).map(o => String(o.id)));
    const noNumIds = new Set(((DATA && DATA.noNum) || []).map(o => String(o.id)));
    // « Au-dessus du marché » : prix > +15 % de la médiane des paires comparables.
    const isOver = (o) => o.peer != null && o.price != null && Number(o.price) > Number(o.peer) * 1.15;
    const overCount = online.filter(isOver).length;
    const FILTERS = [['all', 'Toutes', online.length], ['relance', '💡 À relancer', relanceIds.size], ['over', '📊 Trop cher', overCount], ['sleep', '😴 Dorment', sleepIds.size], ['nonum', '🔢 Sans N°', noNumIds.size]];
    const all = chaussuresFilter === 'relance' ? online.filter(o => relanceIds.has(String(o.id)))
      : chaussuresFilter === 'over' ? online.filter(isOver)
      : chaussuresFilter === 'sleep' ? online.filter(o => sleepIds.has(String(o.id)))
      : chaussuresFilter === 'nonum' ? online.filter(o => noNumIds.has(String(o.id)))
      : online;
    const filterChips = `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">${FILTERS.map(([k, l, n]) => `<button class="vrm-chfilter" data-f="${k}" style="border:1px solid ${chaussuresFilter === k ? '#111' : '#dde'};background:${chaussuresFilter === k ? '#111' : '#fff'};color:${chaussuresFilter === k ? '#fff' : '#334'};border-radius:999px;padding:4px 10px;font-weight:700;font-size:11px;cursor:pointer">${l}${n ? ` ${n}` : ''}</button>`).join('')}</div>`;
    // Bandeau « boutique en un coup d'œil » — calculé sur TOUTES les annonces en
    // ligne (pas la vue filtrée), pour refléter le stock réel comme le bandeau
    // Annonces de l'app. Champs captés défensivement : un absent ne fausse rien.
    const vTot = online.reduce((s, o) => s + (eur(o.price) || 0), 0);
    const viewsTot = online.reduce((s, o) => s + (o.views != null ? Number(o.views) || 0 : 0), 0);
    const favsTot = online.reduce((s, o) => s + (o.favs != null ? Number(o.favs) || 0 : 0), 0);
    const nEur = (n) => Math.round(n).toLocaleString('fr-FR') + ' €';
    // Une seule ligne de résumé (pas de tuiles côte à côte).
    const statsBanner = `<div style="background:linear-gradient(135deg,#f2fbfc,#eaf6f7);border:1px solid #d3ebed;border-radius:12px;padding:9px 12px;margin-bottom:8px;font-size:12.5px;font-weight:700;color:#0a323a">
      👟 ${online.length} en ligne · ${nEur(vTot)} · 👁 ${viewsTot} · ❤️ ${favsTot}
    </div>`;
    if (!all.length) return `${vueBar}${statsBanner}${filterChips}<div class="vrm-m" style="padding:6px 2px">Rien dans cette vue. 👌</div>`;
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
    const sortChips = `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">${SORTS.map(([k, l]) => `<button class="vrm-chsort" data-sort="${k}" style="border:1px solid ${chaussuresSort === k ? '#D2401E' : '#dde'};background:${chaussuresSort === k ? '#D2401E' : '#fff'};color:${chaussuresSort === k ? '#fff' : '#334'};border-radius:999px;padding:4px 10px;font-weight:700;font-size:11px;cursor:pointer">${l}</button>`).join('')}</div>`;
    const rows = sorted.slice(0, 300).map(o => {
      const buy = eur(o.buyPrice), sell = eur(o.price);
      const marge = (buy != null && sell != null && !isNaN(buy)) ? sell - buy : null;
      const eng = [o.views != null ? `👁 ${o.views}` : '', o.favs != null ? `❤️ ${o.favs}` : '', o.ageDays != null ? `${o.ageDays} j` : '', o.cell ? `🏠 ${esc(o.cell)}` : '', o.acct ? esc(o.acct) : ''].filter(Boolean).join(' · ');
      // Repère marché : uniquement quand l'écart est net (>15%), sinon on n'encombre pas.
      let peerTag = '';
      if (o.peer != null && sell != null) {
        const pe = Number(o.peer);
        if (sell > pe * 1.15) peerTag = `<span style="color:#9a5b16">📊 au-dessus du marché (~${fmt(pe)})</span>`;
        else if (sell < pe * 0.85) peerTag = `<span style="color:#0f6b4f">📊 sous le marché (~${fmt(pe)})</span>`;
      }
      return `
      <div class="vrm-ch-row" data-s="${esc(((o.numero != null ? 'n°' + o.numero + ' ' : '') + (o.title || '') + ' ' + (o.acct || '')).toLowerCase())}" style="display:flex;gap:8px;align-items:stretch;border:1px solid #eceff3;border-radius:12px;padding:8px;margin-bottom:7px">
        <a href="${esc(o.url)}" target="_blank" rel="noreferrer" style="flex:1;min-width:0;display:flex;gap:10px;align-items:center;text-decoration:none;color:inherit">
          ${o.photo ? `<img src="${esc(o.photo)}" alt="" style="width:58px;height:58px;border-radius:10px;object-fit:cover;flex-shrink:0;background:#eee">` : '<div style="width:58px;height:58px;border-radius:10px;background:#eef1f4;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px">👟</div>'}
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.numero ? `<span class="vrm-num">N°${esc(o.numero)}</span> ` : ''}${esc(o.title || 'Annonce')}</div>
            <div class="vrm-m" style="margin-top:2px">${fmt(o.price)}${buy != null ? ` · achat ${fmt(o.buyPrice)}` : ''}${marge != null ? ` · marge <b style="color:#0f6b4f">${fmt(marge)}</b>` : ''}</div>
            ${eng ? `<div class="vrm-m" style="margin-top:1px">${eng}</div>` : ''}
            ${peerTag ? `<div class="vrm-m" style="margin-top:1px;font-weight:600">${peerTag}</div>` : ''}
          </div>
        </a>
        <a href="https://www.vinted.fr/items/${esc(o.id)}/edit" target="_blank" rel="noreferrer" title="Modifier le prix sur Vinted" style="flex-shrink:0;align-self:center;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:#D2401E14;color:#D2401E;text-decoration:none;font-size:15px">✏️</a>
      </div>`;
    }).join('');
    return `
      ${vueBar}
      ${statsBanner}
      ${filterChips}
      <div class="vrm-m" style="font-weight:800;margin-bottom:6px">👟 ${all.length} paire${all.length > 1 ? 's' : ''}${chaussuresFilter === 'all' ? ' en ligne' : ''}</div>
      ${sortChips}
      ${all.length > 8 ? `<input id="vrm-ch-search" type="search" value="${esc(chaussuresQuery)}" placeholder="🔍 Filtrer (titre, marque, N°)…" style="width:100%;box-sizing:border-box;margin-bottom:8px;border:1px solid #d7dde3;border-radius:9px;padding:8px 10px;font:inherit;font-size:12.5px">` : ''}
      <div class="vrm-grid">${rows}</div>`;
  }
  function wireChaussures() {
    panel.querySelectorAll('.vrm-chvue').forEach(b => { b.onclick = () => { chaussuresVue = b.dataset.v; render(); }; });
    panel.querySelectorAll('.vrm-vacct').forEach(b => { b.onclick = () => { ventesAcct = b.dataset.a; render(); }; });
    panel.querySelectorAll('.vrm-chfilter').forEach(b => { b.onclick = () => { chaussuresFilter = b.dataset.f; render(); }; });
    panel.querySelectorAll('.vrm-chsort').forEach(b => { b.onclick = () => { chaussuresSort = b.dataset.sort; render(); }; });
    const cs = panel.querySelector('#vrm-ch-search');
    const apply = () => { const q = chaussuresQuery.trim().toLowerCase(); panel.querySelectorAll('.vrm-ch-row').forEach(r => { r.style.display = (!q || (r.dataset.s || '').includes(q)) ? 'flex' : 'none'; }); };
    if (cs) { cs.oninput = () => { chaussuresQuery = cs.value; apply(); }; apply(); }
  }

  // ── ONGLET « VENTES » : la liste des ventes moissonnées (mêmes commandes et
  //    mêmes règles de statut que l'app, cf. `classifySale` dans buildPanelData).
  //    ⚠️ COHÉRENCE : le CA du mois / argent en attente / encaissé viennent d'`appStats`
  //    (publiés par l'app) — on NE recalcule AUCUN de ces totaux ici, pour ne jamais
  //    afficher un chiffre qui contredit l'app. La liste, elle, est lecture seule.
  function renderVentes() {
    const all = (DATA && DATA.sales) || [];
    const a = (DATA && DATA.appStats) || null;
    // En-tête chiffres = ceux de l'app, tels quels (aucun recalcul).
    const eurI = (v) => (v == null ? '—' : Number(v).toLocaleString('fr-FR') + ' €');
    const head = a ? `
      <div class="vrm-stats" style="margin-bottom:8px">
        <div class="vrm-st"><b style="color:#D2401E">${eurI(a.caMois)}</b><span class="vrm-m">CA du mois</span></div>
        <div class="vrm-st"><b style="color:#c98a1a">${eurI(a.enAttente)}</b><span class="vrm-m">Argent en attente</span></div>
        <div class="vrm-st"><b style="color:#0f6b4f">${eurI(a.caEncaisse)}</b><span class="vrm-m">Encaissé</span></div>
      </div>
      <div class="vrm-m" style="text-align:center;margin:-2px 0 8px;opacity:.7">Chiffres de l'app · ${a.updatedAt ? esc(timeago(Date.parse(a.updatedAt))) : ''}</div>` : '';

    if (!all.length) return `${head}<div class="vrm-m">Aucune vente captée pour l'instant.<br>Ouvre « Mes ventes » sur Vinted une fois pour les capter (0 requête ajoutée).</div>`;
    // 1) PÉRIODE (deux dates) — appliquée AVANT tout le reste, pour que les
    //    compteurs des autres filtres correspondent à ce que tu vois vraiment.
    const parDate = periodeFilter(all);
    // 2) COMPTE — chips construites sur les comptes qui ont VRAIMENT une vente
    //    dans la période (pas la liste théorique des comptes).
    const acctChips = acctChipsFor(parDate, ventesAcct, 'vrm-vacct');
    const parCompte = ventesAcct === 'all' ? parDate : parDate.filter(v => String(v.uid || '') === ventesAcct);
    // 3) ÉTAT
    const nPend = parCompte.filter(v => v.etat === 'pending').length;
    const nDone = parCompte.filter(v => v.etat === 'completed').length;
    const FILTERS = [['all', 'Toutes', parCompte.length], ['pending', '⏳ En cours', nPend], ['completed', '✅ Finalisées', nDone]];
    const filterChips = `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">${FILTERS.map(([k, l, n]) => `<button class="vrm-vfilter" data-f="${k}" style="border:1px solid ${ventesFilter === k ? '#111' : '#dde'};background:${ventesFilter === k ? '#111' : '#fff'};color:${ventesFilter === k ? '#fff' : '#334'};border-radius:999px;padding:4px 10px;font-weight:700;font-size:11px;cursor:pointer">${l}${n ? ` ${n}` : ''}</button>`).join('')}</div>`;
    const list = ventesFilter === 'all' ? parCompte : parCompte.filter(v => v.etat === ventesFilter);
    if (!list.length) return `${head}${periodeBar()}${acctChips}${filterChips}<div class="vrm-m" style="padding:6px 2px">Aucune vente dans cette sélection.</div>`;
    const rows = list.slice(0, 200).map(v => venteRow(v)).join('');
    return `
      ${head}
      ${periodeBar()}
      ${acctChips}
      ${filterChips}
      ${parCompte.length > 8 ? `<input id="vrm-v-search" type="search" value="${esc(ventesQuery)}" placeholder="🔍 Filtrer par titre ou N°…" style="width:100%;box-sizing:border-box;margin-bottom:8px;border:1px solid #d7dde3;border-radius:9px;padding:8px 10px;font:inherit;font-size:12.5px">` : ''}
      <div class="vrm-grid">${rows}</div>
      <div class="vrm-m" style="margin-top:6px;opacity:.8">Ventes lues sur Vinted (annulées/remboursées exclues). Le total du mois reste celui de l'app.</div>`;
  }

  // ── UNE LIGNE DE VENTE, partout pareil (Ventes, Mes paires → Vendues) ────────
  // Le BORDEREAU est SUR la ligne de la vente (demande de Julien : plus de liste
  // séparée à cocher). Trois états possibles, tous certains :
  //   • rien           → le colis est parti (Vinted l'a confirmé) : on n'affiche rien ;
  //   • « à générer »  → Vinted attend le colis, pas encore de bordereau reçu ;
  //   • « à imprimer » → le bordereau est arrivé par email, avec son N°.
  const etatLbl = { completed: '✅ finalisée', pending: '⏳ en cours' };
  function venteRow(v) {
    const b = v.bord || null;
    const bordPill = !b ? ''
      : b.etat === 'print'
        ? `<button class="vrm-bord-dl" data-row="${esc(b.row || '')}" title="Ouvrir le bordereau (PDF) — prêt à imprimer" style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;width:56px;border:0;border-radius:12px;background:#0f6b4f14;color:#0f6b4f;font:inherit;font-weight:800;font-size:15px;cursor:pointer">${svgi('printer', 16)}<span style="font-size:9px;font-weight:700">ouvrir</span></button>`
        : (DATA && DATA.compteActif && v.uid && String(DATA.compteActif) !== String(v.uid))
        // Compte non connecté → on n'offre pas le bouton : on renvoie sur Vinted.
        // (Générer depuis la session d'un autre compte = signal multi-comptes.)
        ? `<a href="${esc(v.url)}" target="_blank" rel="noreferrer" title="Vente d'un autre compte : bascule dessus sur Vinted" style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;width:56px;border-radius:12px;background:#f2f5f8;color:#66707c;text-decoration:none;font-weight:800;font-size:15px">📄<span style="font-size:9px;font-weight:700">autre cpte</span></a>`
        : `<button class="vrm-gen-bord" data-uid="${esc(v.uid || '')}" data-tx="${esc(v.transaction || '')}" title="Générer le bordereau maintenant (c'est l'extension qui le fait)" style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;width:56px;border:0;border-radius:12px;background:#c98a1a14;color:#9a5b16;font:inherit;font-weight:800;font-size:15px;cursor:pointer">${svgi('file-text', 16)}<span style="font-size:9px;font-weight:700">générer</span></button>`;
    const sub = [etatLbl[v.etat] || '', v.ts ? timeago(v.ts) : '', v.acct || ''].filter(Boolean).join(' · ');
    return `
      <div class="vrm-v-row" data-s="${esc((((v.numero != null ? 'n°' + v.numero + ' ' : '') + (v.title || '') + ' ' + (v.acct || '')).toLowerCase()))}" style="display:flex;gap:6px;align-items:stretch;margin-bottom:6px">
        <a href="${esc(v.url)}" target="_blank" rel="noreferrer" style="flex:1;min-width:0;display:flex;gap:9px;align-items:center;border:1px solid #eceff3;border-radius:12px;padding:8px 10px;text-decoration:none;color:inherit">
          ${pairThumb(v, 46)}
          <div style="flex:1 1 130px;min-width:0">
            <div style="font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${numBadge(v)}${esc(v.title || 'Vente')}</div>
            <div class="vrm-m" style="font-size:11px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sub)}</div>
            ${b && b.etat === 'print' && b.dateLimite ? `<div class="vrm-m" style="font-size:11px;color:#9a5b16;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">à envoyer avant ${esc(b.dateLimite)}</div>` : ''}
          </div>
          <div style="flex-shrink:0;font-weight:700;font-size:13px;color:#0f6b4f">${fmt(v.price)}</div>
        </a>
        ${bordPill}
        ${v.pro ? `<a href="${APP_URL}/?tab=cat_bord" target="vrm_app" rel="noreferrer" title="Compte pro : facture disponible dans l'app" style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;width:52px;border-radius:12px;background:#B3341814;color:#B33418;text-decoration:none;font-weight:800;font-size:16px">🧾<span style="font-size:9px;font-weight:700">facture</span></a>` : ''}
      </div>`;
  }

  // ── PÉRIODE : un CALENDRIER qu'on clique (façon Airbnb) ─────────────────────
  // Julien : « je veux cliquer un peu comme sur les calendriers Airbnb, telle
  // date à telle date, qu'on n'ait pas besoin de remplir à chaque fois. »
  // Un clic = date de début, deuxième clic = date de fin. Plus des raccourcis
  // (7 jours / 30 jours / ce mois / mois dernier) parce que 90 % du temps c'est
  // ça qu'on veut, sans toucher au calendrier.
  const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const joli = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}`; };
  // Raccourcis : [clé, libellé, calcul → {from,to}]
  const RACCOURCIS = [
    ['7', '7 jours', () => { const t = new Date(); const f = new Date(); f.setDate(f.getDate() - 6); return { from: iso(f), to: iso(t) }; }],
    ['30', '30 jours', () => { const t = new Date(); const f = new Date(); f.setDate(f.getDate() - 29); return { from: iso(f), to: iso(t) }; }],
    ['mois', 'Ce mois', () => { const t = new Date(); return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) }; }],
    ['prec', 'Mois dernier', () => { const t = new Date(); const f = new Date(t.getFullYear(), t.getMonth() - 1, 1); return { from: iso(f), to: iso(new Date(t.getFullYear(), t.getMonth(), 0)) }; }],
  ];
  function periodeBar() {
    const label = (!ventesFrom && !ventesTo) ? 'Toute la période'
      : (ventesFrom && ventesTo) ? `${joli(ventesFrom)} → ${joli(ventesTo)}`
      : ventesFrom ? `à partir du ${joli(ventesFrom)}` : `jusqu'au ${joli(ventesTo)}`;
    const actif = !!(ventesFrom || ventesTo);
    const chips = RACCOURCIS.map(([k, l]) => `<button class="vrm-vquick" data-q="${k}" style="border:1px solid #dde;background:#fff;color:#334;border-radius:999px;padding:4px 10px;font-weight:700;font-size:11px;cursor:pointer">${l}</button>`).join('');
    return `<div style="margin-bottom:8px">
      <button id="vrm-cal-toggle" style="width:100%;box-sizing:border-box;display:flex;align-items:center;gap:8px;border:1px solid ${actif ? '#0f172a' : '#d7dde3'};background:${actif ? '#0f172a' : '#fff'};color:${actif ? '#fff' : '#334'};border-radius:11px;padding:8px 11px;font:inherit;font-weight:700;font-size:12.5px;cursor:pointer;text-align:left">
        <span style="flex-shrink:0;display:flex">${svgi('calendar', 15)}</span>
        <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(label)}</span>
        ${actif ? `<span class="vrm-vdate" data-act="clear" title="Tout afficher" style="flex-shrink:0;opacity:.85;font-size:14px">✕</span>` : ''}
      </button>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">${chips}</div>
      ${calOpen ? calendrier() : ''}
    </div>`;
  }
  // Le calendrier lui-même. Lundi en premier (France). Les jours sans aucune
  // vente restent cliquables : on filtre une période, pas une liste de dates.
  function calendrier() {
    const base = calMonth ? new Date(calMonth) : new Date();
    const y = base.getFullYear(), m = base.getMonth();
    const premier = new Date(y, m, 1);
    const decal = (premier.getDay() + 6) % 7;         // lundi = 0
    const nbJours = new Date(y, m + 1, 0).getDate();
    const cases = [];
    for (let i = 0; i < decal; i++) cases.push('<div></div>');
    for (let j = 1; j <= nbJours; j++) {
      const d = iso(new Date(y, m, j));
      const deb = ventesFrom && d === ventesFrom, fin = ventesTo && d === ventesTo;
      const dedans = ventesFrom && ventesTo && d > ventesFrom && d < ventesTo;
      const bg = (deb || fin) ? '#0f172a' : dedans ? '#0f172a14' : 'transparent';
      const col = (deb || fin) ? '#fff' : '#223';
      cases.push(`<button class="vrm-cal-d" data-d="${d}" style="border:0;background:${bg};color:${col};border-radius:9px;padding:6px 0;font:inherit;font-weight:${(deb || fin) ? 700 : 500};font-size:12px;cursor:pointer">${j}</button>`);
    }
    const jours = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<div class="vrm-m" style="text-align:center;font-size:10px;font-weight:700">${x}</div>`).join('');
    return `<div style="margin-top:8px;border:1px solid #eceff3;border-radius:12px;padding:8px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <button class="vrm-cal-nav" data-n="-1" style="border:1px solid #dde;background:#fff;border-radius:8px;padding:2px 8px;font:inherit;cursor:pointer">‹</button>
        <div style="flex:1;text-align:center;font-weight:700;font-size:12.5px">${MOIS_FR[m]} ${y}</div>
        <button class="vrm-cal-nav" data-n="1" style="border:1px solid #dde;background:#fff;border-radius:8px;padding:2px 8px;font:inherit;cursor:pointer">›</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">${jours}${cases.join('')}</div>
      <div class="vrm-m" style="margin-top:6px;font-size:10.5px">${!ventesFrom || ventesTo ? 'Clique la date de DÉBUT' : 'Clique la date de FIN'}</div>
    </div>`;
  }
  // Filtre par période sur `ts` (ms). Une date absente = pas de borne de ce côté.
  function periodeFilter(list) {
    const from = ventesFrom ? Date.parse(ventesFrom + 'T00:00:00') : null;
    const to = ventesTo ? Date.parse(ventesTo + 'T23:59:59') : null;
    if (from == null && to == null) return list;
    return list.filter(v => { const t = Number(v.ts) || 0; if (!t) return false; if (from != null && t < from) return false; if (to != null && t > to) return false; return true; });
  }
  // Chips « par compte », construites sur les comptes réellement présents dans la
  // liste (jamais un compte vide, jamais un compte masqué : il n'est plus dans DATA).
  function acctChipsFor(list, cur, cls) {
    const n = {};
    for (const v of list) { const k = String(v.uid || ''); if (!k) continue; n[k] = (n[k] || 0) + 1; }
    const uids = Object.keys(n);
    if (uids.length < 2) return ''; // un seul compte → pas de chips inutiles
    const nameOf = (uid) => { const a = ((DATA && DATA.accounts) || []).find(x => String(x.uid) === uid); return (a && a.name) || ('compte ' + uid.slice(-4)); };
    const chip = (k, l, count) => `<button class="${cls}" data-a="${esc(k)}" style="border:1px solid ${cur === k ? '#111' : '#dde'};background:${cur === k ? '#111' : '#fff'};color:${cur === k ? '#fff' : '#334'};border-radius:999px;padding:4px 10px;font-weight:700;font-size:11px;cursor:pointer">${esc(l)} ${count}</button>`;
    return `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">${chip('all', 'Tous les comptes', list.length)}${uids.sort((a, b) => n[b] - n[a]).map(k => chip(k, nameOf(k), n[k])).join('')}</div>`;
  }

  function wireVentes() {
    panel.querySelectorAll('.vrm-vfilter').forEach(b => { b.onclick = () => { ventesFilter = b.dataset.f; render(); }; });
    panel.querySelectorAll('.vrm-vacct').forEach(b => { b.onclick = () => { ventesAcct = b.dataset.a; render(); }; });
    // Calendrier de période (clic début → clic fin, façon Airbnb).
    const tog = panel.querySelector('#vrm-cal-toggle');
    if (tog) tog.onclick = (e) => {
      if (e.target.closest('.vrm-vdate')) { ventesFrom = ''; ventesTo = ''; calOpen = false; render(); return; }
      calOpen = !calOpen;
      if (calOpen && !calMonth) { const d = ventesFrom ? new Date(ventesFrom + 'T12:00:00') : new Date(); calMonth = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
      render();
    };
    panel.querySelectorAll('.vrm-cal-nav').forEach(b => { b.onclick = () => { const d = new Date(calMonth || Date.now()); calMonth = new Date(d.getFullYear(), d.getMonth() + Number(b.dataset.n), 1).getTime(); render(); }; });
    panel.querySelectorAll('.vrm-cal-d').forEach(b => {
      b.onclick = () => {
        const d = b.dataset.d;
        // Pas de début, ou plage déjà complète → on repart d'un début.
        // Un clic AVANT le début en cours redémarre aussi (sinon on bloque).
        if (!ventesFrom || ventesTo || d < ventesFrom) { ventesFrom = d; ventesTo = ''; }
        else { ventesTo = d; calOpen = false; }
        render();
      };
    });
    panel.querySelectorAll('.vrm-vquick').forEach(b => {
      b.onclick = () => {
        const r = RACCOURCIS.find(x => x[0] === b.dataset.q);
        if (!r) return;
        const { from, to } = r[2]();
        ventesFrom = from; ventesTo = to; calOpen = false;
        calMonth = new Date(new Date(to + 'T12:00:00').getFullYear(), new Date(to + 'T12:00:00').getMonth(), 1).getTime();
        render();
      };
    });
    const vs = panel.querySelector('#vrm-v-search');
    const apply = () => { const q = ventesQuery.trim().toLowerCase(); panel.querySelectorAll('.vrm-v-row').forEach(r => { r.style.display = (!q || (r.dataset.s || '').includes(q)) ? 'flex' : 'none'; }); };
    if (vs) { vs.oninput = () => { ventesQuery = vs.value; apply(); }; apply(); }
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
    let suggested = null; // prix conseillé (€ entier) quand l'écart est net
    if (o.peer != null && sell != null) {
      const pe = Number(o.peer);
      const cible = Math.round(pe); // prix conseillé = médiane des comparables, arrondie
      const cmp = sell > pe * 1.15 ? { txt: `Ton prix est <b>au-dessus</b> de tes paires similaires → essaie <b>~${cible} €</b> pour accélérer la vente.`, bg: '#fff6ec', fg: '#9a5b16', bd: '#ffd7a8', sug: true }
        : sell < pe * 0.85 ? { txt: `Ton prix est <b>en-dessous</b> de tes paires similaires → tu peux monter vers <b>~${cible} €</b>.`, bg: '#eefaf3', fg: '#0f6b4f', bd: '#bfe6d3', sug: true }
        : { txt: `Ton prix est <b>dans la moyenne</b> de tes paires similaires. 👍`, bg: '#f2f5f8', fg: '#44515e', bd: '#e0e6ec', sug: false };
      if (cmp.sug) suggested = cible;
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
      </div>${diag}
      ${achatBloc(o)}
      ${minBloc(o)}
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
        <a class="vrm-link" href="https://www.vinted.fr/items/${esc(id)}/edit" target="_blank" rel="noreferrer" style="border:1px solid #D2401E;background:#D2401E;color:#fff;border-radius:8px;padding:6px 12px;font-weight:700;font-size:12px;text-decoration:none">✏️ Modifier sur Vinted ↗</a>
        ${suggested != null ? `<button class="vrm-baisse" data-id="${esc(id)}" data-p="${suggested}" title="Copie ${suggested} € et ouvre la page de modification : il ne te reste que le champ prix à coller" style="border:1px solid #D2401E;background:#D2401E;color:#fff;border-radius:8px;padding:6px 12px;font-weight:700;font-size:12px;cursor:pointer">Passer à ${suggested} € ↗</button>` : ''}
        ${o.numero ? `<button class="vrm-copy-line" data-c="N°${esc(o.numero)} · ${esc(o.title || '')}" style="border:1px solid #D2401E;background:#D2401E14;color:#D2401E;border-radius:8px;padding:5px 12px;font-weight:700;font-size:12px;cursor:pointer">📋 Copier N° + titre</button>` : ''}
      </div>`;
    return card(o, extra);
  }

  // ── LE N° DE LA PAIRE, VISIBLE SUR LA PAGE VINTED ───────────────────────────
  // Sur une de tes annonces, une pastille discrète en haut à gauche : le N° de
  // la paire, sa case au garage, et sa marge si le prix d'achat est connu. Tu
  // sais où aller chercher la chaussure sans rien ouvrir.
  // ⚠️ Position FIXE, jamais insérée dans la mise en page de Vinted : le jour où
  // ils changent leur HTML, une pastille flottante continue de marcher, une
  // pastille greffée sur leur `<h1>` disparaît sans prévenir.
  let badgeEl = null;
  function majBadge() {
    try {
      const id = currentItemId();
      const o = (id && DATA && DATA.byId && DATA.byId[id]) || null;
      if (!o || !o.numero) { if (badgeEl) { badgeEl.remove(); badgeEl = null; } return; }
      if (!badgeEl) {
        badgeEl = document.createElement('div');
        badgeEl.id = 'vrm-badge';
        badgeEl.style.cssText = 'position:fixed;top:12px;left:12px;z-index:2147483646;background:#0f172a;color:#fff;'
          + 'border-radius:12px;padding:7px 11px;font:600 13px/1.25 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;'
          + 'box-shadow:0 6px 18px rgba(0,0,0,.28);cursor:pointer;max-width:230px';
        badgeEl.title = 'Ouvrir VRM sur cette paire';
        badgeEl.onclick = () => { tab = 'paire'; toggle(true); };
        document.documentElement.appendChild(badgeEl);
      }
      const marge = (o.buyPrice != null && o.price != null) ? (Number(o.price) - Number(o.buyPrice)) : null;
      // Une paire qui dort se signale ICI, sur sa propre page : c'est le moment
      // où tu peux agir (baisser, republier), pas trois écrans plus loin.
      const dort = o.ageDays != null && o.ageDays >= 30;
      badgeEl.style.background = dort ? '#9a5b16' : '#0f172a';
      badgeEl.innerHTML = `<span style="font-size:15px;font-weight:800">N°${esc(o.numero)}</span>`
        + (o.cell ? `<span style="opacity:.85"> · 🏠 ${esc(o.cell)}</span>` : '')
        + (dort ? `<div style="font-size:11px;font-weight:700;margin-top:1px">😴 en ligne depuis ${o.ageDays} j</div>` : '')
        + (marge != null ? `<div style="font-size:11px;opacity:.8;margin-top:1px">marge ${esc(fmt(marge))}</div>`
                         : `<div style="font-size:11px;opacity:.8;margin-top:1px">achat ?</div>`);
    } catch (_) {}
  }

  // ── LE N° ET LE PRIX PLANCHER SUR CHAQUE VIGNETTE DU PROFIL ────────────────
  // Demande de Julien : « je veux que le prix minimum s'affiche à côté des vues
  // dans l'annonce quand on est sur le profil, ainsi que son numéro, comme ça
  // on peut voir direct d'un coup d'œil. »
  // On décore chaque lien d'annonce QUI EST UNE DES SIENNES (présente dans
  // `DATA.byId`) — donc jamais l'annonce d'un autre vendeur.
  // ⚠️ ON N'ÉCRIT JAMAIS DANS LE HTML DE VINTED : on ajoute un enfant en
  //    surimpression sur la vignette. Si Vinted refond sa grille, le badge ne
  //    s'affiche simplement pas — rien ne casse (§4.95).
  const TAG = 'vrmTag';
  function decorerVignettes() {
    try {
      if (!DATA || !DATA.byId) return;
      const liens = document.querySelectorAll('a[href*="/items/"]');
      for (const a of liens) {
        const m = /\/items\/(\d+)/.exec(a.getAttribute('href') || '');
        if (!m) continue;
        const o = DATA.byId[m[1]];
        if (!o || (o.numero == null && o.minPrice == null)) continue;
        if (a.dataset[TAG] === m[1]) continue;          // déjà décorée
        // Une vignette de grille, pas un lien de texte : on écarte le trop petit.
        const r = a.getBoundingClientRect();
        if (r.width < 90 || r.height < 90) continue;
        a.dataset[TAG] = m[1];
        if (getComputedStyle(a).position === 'static') a.style.position = 'relative';
        let b = a.querySelector(':scope > .vrm-vig');
        if (!b) { b = document.createElement('div'); b.className = 'vrm-vig'; a.appendChild(b); }
        b.style.cssText = 'position:absolute;top:6px;left:6px;z-index:20;display:flex;flex-direction:column;gap:3px;'
          + 'pointer-events:none;font:700 11px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
        const pastille = (txt, fond, encre) => `<span style="background:${fond};color:${encre};border-radius:4px;`
          + `padding:2px 6px;box-shadow:0 1px 4px rgba(0,0,0,.25);white-space:nowrap">${esc(txt)}</span>`;
        b.innerHTML =
          (o.numero != null ? pastille('N°' + o.numero, '#151110', '#EFE8DC') : '')
          + (o.minPrice != null ? pastille('min ' + fmt(o.minPrice), '#D2401E', '#fff')
                                : pastille('min ?', 'rgba(21,17,16,.55)', '#EFE8DC'));
      }
    } catch (_) {}
  }
  // La grille se remplit au défilement : on redécore quand le DOM bouge, mais
  // au plus une fois par 400 ms (sinon on repasse sur toute la page en boucle).
  let decoTimer = null;
  function planifierDeco() { clearTimeout(decoTimer); decoTimer = setTimeout(decorerVignettes, 400); }
  try { new MutationObserver(planifierDeco).observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}

  // ── LE PRIX D'ACHAT, LÀ OÙ TU REGARDES L'ANNONCE ────────────────────────────
  // Mesuré : 0 prix d'achat sur 177 paires — donc bénéfice, marge et rapport
  // comptable tournent tous avec un coût de zéro. La raison n'est pas la
  // paresse : il fallait retrouver la bonne paire parmi ~700 achats classés par
  // date. Ici l'extension propose les candidats les plus probables (même marque,
  // même taille, payé moins cher) pendant que tu es SUR l'annonce. Un tap.
  // ⚠️ Rien n'est associé tout seul : un faux prix d'achat fausse la compta plus
  //    sûrement qu'une case vide.
  let achatCands = null, achatPour = null, achatBusy = false;
  function achatBloc(o) {
    if (o.buyPrice != null) {
      const marge = (o.price != null) ? (Number(o.price) - Number(o.buyPrice)) : null;
      return `<div class="vrm-card" style="margin-top:8px;padding:9px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="flex:1 1 130px;min-width:0">
            <div style="font-weight:800;font-size:12.5px">Acheté ${fmt(o.buyPrice)}</div>
            ${marge != null ? `<div class="vrm-m" style="font-size:11px">marge <b style="color:${marge >= 0 ? '#0f6b4f' : '#a33'}">${fmt(marge)}</b></div>` : ''}
          </div>
          <button class="vrm-achat-clear" data-id="${esc(o.id)}" style="flex-shrink:0;border:1px solid #dde;background:#fff;color:#556;border-radius:9px;padding:6px 10px;font:inherit;font-weight:700;font-size:11px;cursor:pointer">Changer</button>
        </div>
      </div>`;
    }
    const cands = (achatPour === String(o.id) && achatCands) ? achatCands : null;
    const liste = cands === null ? `<button class="vrm-achat-go" data-id="${esc(o.id)}" data-t="${esc(o.title || '')}" data-p="${esc(String(o.price ?? ''))}" style="width:100%;border:none;background:#0f172a;color:#fff;border-radius:9px;padding:9px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">${achatBusy ? '⏳ recherche…' : '🔎 Retrouver dans mes achats'}</button>`
      : (!cands.length ? `<div class="vrm-m" style="font-size:11px">Aucun achat ne correspond (même marque / même taille). Saisis le prix à la main ci-dessous.</div>`
      : cands.map(c => `
        <button class="vrm-achat-pick" data-id="${esc(o.id)}" data-prix="${esc(String(c.prix ?? ''))}" data-tx="${esc(c.tx || '')}" data-titre="${esc(c.title || '')}"
          style="width:100%;display:flex;gap:8px;align-items:center;text-align:left;border:1px solid ${c.score >= 8 ? '#0f6b4f' : '#dde'};background:#fff;border-radius:10px;padding:7px 8px;margin-bottom:5px;font:inherit;cursor:pointer">
          ${c.photo ? `<img src="${esc(c.photo)}" alt="" style="width:34px;height:34px;border-radius:7px;object-fit:cover;flex-shrink:0">` : '<span style="width:34px;flex-shrink:0;text-align:center">👟</span>'}
          <span style="flex:1 1 110px;min-width:0;overflow:hidden">
            <span style="display:block;font-weight:600;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.title)}</span>
            <span class="vrm-m" style="font-size:10.5px">${c.ts ? esc(timeago(c.ts)) : ''}${c.score >= 8 ? ' · <b style="color:#0f6b4f">suggéré</b>' : ''}</span>
          </span>
          <b style="flex-shrink:0;font-size:12.5px;color:#0f6b4f">${c.prix != null ? fmt(c.prix) : '?'}</b>
        </button>`).join(''));
    return `<div class="vrm-card" style="margin-top:8px;padding:9px;background:#fff6ec;border-color:#ffd7a8">
      <div style="font-weight:800;font-size:12.5px;color:#9a5b16;margin-bottom:5px">Prix d'achat manquant</div>
      <div class="vrm-m" style="font-size:11px;margin-bottom:7px">Sans lui, la marge et le bénéfice de cette paire sont faux.</div>
      ${liste}
      <div style="display:flex;gap:6px;align-items:center;margin-top:7px">
        <input class="vrm-achat-in" data-id="${esc(o.id)}" type="number" inputmode="decimal" min="0" step="0.5" placeholder="ou saisis le prix" style="flex:1 1 90px;min-width:0;border:1px solid #d7dde3;border-radius:9px;padding:7px 10px;font:inherit;font-size:13px">
        <span class="vrm-m" style="flex-shrink:0">€</span>
        <button class="vrm-achat-save" data-id="${esc(o.id)}" style="flex-shrink:0;border:none;background:#9a5b16;color:#fff;border-radius:9px;padding:7px 12px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">OK</button>
      </div>
    </div>`;
  }

  // ── PRIX MINIMUM ACCEPTÉ (par paire) ────────────────────────────────────────
  // Julien : « sur chaque paire je mets un montant minimum que je peux accepter,
  // et dès qu'une offre arrive… ». Le montant se pose ici, en 3 secondes.
  // ⚠️ Ce que l'extension fait ensuite : elle TRANCHE POUR TOI (accepte / contre
  // à X €) et te met le chiffre prêt à coller. Elle n'accepte PAS l'offre à ta
  // place : répondre à Vinted par script, c'est le geste qui fait bloquer un
  // compte (§32) — et une offre acceptée par erreur, c'est une vente à perte.
  function minBloc(o) {
    const v = o && o.minPrice != null ? o.minPrice : '';
    return `<div class="vrm-card" style="margin-top:8px;padding:9px">
      <div style="font-weight:800;font-size:12.5px;margin-bottom:5px;display:flex;align-items:center;gap:6px">${svgi('tag', 14)} Mon prix plancher</div>
      <div style="display:flex;gap:6px;align-items:center">
        <input id="vrm-min-in" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(String(v))}" placeholder="ex. 35" style="flex:1 1 90px;min-width:0;border:1px solid #d7dde3;border-radius:9px;padding:7px 10px;font:inherit;font-size:13px">
        <span class="vrm-m" style="flex-shrink:0">€</span>
        <button id="vrm-min-save" data-id="${esc(o.id)}" style="flex-shrink:0;border:none;background:#0f172a;color:#fff;border-radius:9px;padding:7px 12px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">Enregistrer</button>
      </div>
      <div class="vrm-m" style="margin-top:6px;font-size:10.5px">${v !== '' ? `Toute offre ≥ <b>${fmt(v)}</b> te sera signalée « à accepter », les autres avec une contre-offre prête.` : 'En dessous, on te proposera une contre-offre ; au-dessus, on te dira d\'accepter.'}</div>
    </div>`;
  }
  // ── OFFRES REÇUES : la décision est déjà prise, il reste à cliquer ───────────
  function renderOffres() {
    const list = (DATA && DATA.offers) || [];
    if (!list.length) return '';
    const ligne = (of) => {
      const ok = of.verdict === 'accepter';
      const sansMin = of.verdict === 'sansmin';
      const coul = sansMin ? '#44515e' : ok ? '#0f6b4f' : '#9a5b16';
      const fond = sansMin ? '#f2f5f8' : ok ? '#eefaf3' : '#fff6ec';
      const verdict = sansMin ? 'Pose ton prix plancher sur cette paire pour trancher d\'un coup d\'œil'
        : ok ? `✅ <b>Accepte</b> — c\'est au-dessus de ton plancher (${fmt(of.min)})`
        : `↩️ <b>Contre à ${fmt(of.min)}</b> — l\'offre est sous ton plancher`;
      return `<div class="vrm-card" style="margin-bottom:6px;padding:8px;background:${fond}">
        <div style="display:flex;gap:9px;align-items:center">
          ${pairThumb(of, 40)}
          <div style="flex:1 1 130px;min-width:0">
            <div style="font-weight:700;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${numBadge(of)}${esc(of.title || 'Article')}</div>
            <div class="vrm-m" style="font-size:11px">offre reçue <b>${fmt(of.price)}</b>${of.prixVente != null ? ` · en ligne à ${fmt(of.prixVente)}` : ''}</div>
          </div>
        </div>
        <div class="vrm-m" style="margin-top:6px;color:${coul};font-size:11.5px">${verdict}</div>
        ${agir(of, coul, ok, sansMin)}
      </div>`;
    };
    return `<div style="margin-bottom:10px">
      <div class="vrm-m" style="font-weight:800;margin-bottom:6px;display:flex;align-items:center;gap:6px">${svgi('dollar-sign', 14)} ${list.length} offre${list.length > 1 ? 's' : ''} à trancher</div>
      ${autoOffresBloc()}
      ${list.slice(0, 20).map(ligne).join('')}
      <div class="vrm-m" style="font-size:10.5px;opacity:.8">Un bouton = une réponse envoyée depuis ton navigateur, sur ton clic. Rien ne part tout seul : une offre acceptée est une vente ferme.</div>
    </div>`;
  }
  // ── ACCEPTER TOUT SEUL AU-DESSUS DU PRIX PLANCHER ───────────────────────────
  // Julien : « pour chaque annonce que je poste je mets un prix minimum que
  // l'app accepte dès que je reçois une offre ».
  // ⚠️ ÉTEINT PAR DÉFAUT, et il faut un plancher POSÉ SUR L'ANNONCE (dans l'app,
  //    champ « Min. accepté ») : sans plancher, aucune offre n'est touchée.
  //    Accepter engage une vente ferme — le seuil est SA décision, prise à
  //    l'avance, pas celle de la machine.
  let autoOffres = null;                       // null = pas encore lu
  function autoOffresBloc() {
    const on = autoOffres === true;
    const nMin = ((DATA && DATA.online) || []).filter(o => o.minPrice != null).length;
    return `<div class="vrm-card" style="margin-bottom:8px;padding:9px">
      <label style="display:flex;align-items:center;gap:9px;cursor:pointer">
        <input type="checkbox" id="vrm-auto-offres" ${on ? 'checked' : ''} style="width:18px;height:18px;flex-shrink:0;accent-color:#0f6b4f">
        <span style="flex:1;min-width:0">
          <span style="display:block;font-weight:700;font-size:12.5px">Accepter automatiquement au-dessus de mon prix minimum</span>
          <span class="vrm-m" style="display:block;font-size:11px">${nMin} annonce${nMin > 1 ? 's ont' : ' a'} un prix minimum. Une offre en dessous n'est jamais touchée, et une paire sans minimum non plus.</span>
        </span>
      </label>
      ${on ? '<div class="vrm-m" style="margin-top:6px;font-size:10.5px;opacity:.85">Au plus 3 offres par visite, uniquement sur le compte connecté ici. Une offre acceptée est une VENTE FERME : le minimum se pose annonce par annonce dans l\'app.</div>' : ''}
    </div>`;
  }
  // Les trois réponses possibles, en un clic, sans quitter le panneau.
  // On ne les propose QUE si l'offre porte ses deux identifiants certains
  // (transaction + demande d'offre) : sinon on renvoie sur Vinted, comme avant.
  function agir(of, coul, ok, sansMin) {
    const lien = `<a href="${esc(of.url)}" target="_blank" rel="noreferrer" style="flex:1 1 120px;text-align:center;text-decoration:none;border:1px solid ${coul};background:transparent;color:${coul};border-radius:9px;padding:7px;font-weight:700;font-size:12px">Voir le fil ↗</a>`;
    // ⚠️ ANTI-BLOCAGE : on ne propose PAS d'agir au nom d'un compte qui n'est
    // pas celui connecté. Envoyer une requête du compte B depuis la session du
    // compte A, c'est le signal multi-comptes que Vinted sanctionne (§5).
    // On le dit AVANT le clic plutôt que de refuser après.
    const actif = DATA && DATA.compteActif;
    if (actif && of.uid && String(actif) !== String(of.uid)) {
      const nom = ((DATA.accounts || []).find(a => String(a.uid) === String(of.uid)) || {}).name || 'un autre compte';
      return `<div class="vrm-m" style="margin-top:7px;padding:7px 9px;border-radius:9px;background:#f2f5f8;border:1px solid #e0e6ec;font-size:11.5px">
          Cette offre est sur <b>${esc(nom)}</b>, et ton navigateur est connecté ailleurs.
          Bascule sur ce compte sur Vinted avant de répondre — agir depuis la mauvaise session, c'est ce qui fait repérer le multi-comptes.
        </div>
        <div style="display:flex;gap:6px;margin-top:6px">${lien}</div>`;
    }
    if (!of.tx || !of.oid || !of.uid) {
      return `<div style="display:flex;gap:6px;margin-top:7px;flex-wrap:wrap"><a href="${esc(of.url)}" target="_blank" rel="noreferrer" style="flex:1;text-align:center;text-decoration:none;border:1px solid ${coul};background:${coul};color:#fff;border-radius:9px;padding:7px;font-weight:800;font-size:12px">Répondre sur Vinted ↗</a></div>`;
    }
    const base = (bg, fg, bd) => `flex:1 1 96px;border:1px solid ${bd};background:${bg};color:${fg};border-radius:9px;padding:7px 6px;font:inherit;font-weight:800;font-size:12px;cursor:pointer`;
    const d = `data-uid="${esc(of.uid)}" data-tx="${esc(of.tx)}" data-oid="${esc(of.oid)}" data-titre="${esc(of.title || '')}" data-prix="${esc(String(of.price))}"`;
    // « Accepter » est mis en avant seulement quand l'offre passe ton plancher ;
    // en dessous, c'est la contre-offre qui est en avant. Le bouton existe quand
    // même dans les deux cas — c'est toi qui tranches, pas la couleur.
    const acc = `<button class="vrm-offre" data-quoi="accept" ${d} style="${base(ok ? '#0f6b4f' : 'transparent', ok ? '#fff' : '#0f6b4f', '#0f6b4f')}">✅ Accepter ${fmt(of.price)}</button>`;
    const con = (!sansMin && of.min != null) ? `<button class="vrm-offre" data-quoi="contre" data-montant="${esc(String(of.min))}" ${d} style="${base(!ok ? '#9a5b16' : 'transparent', !ok ? '#fff' : '#9a5b16', '#9a5b16')}">↩️ Contre ${fmt(of.min)}</button>` : '';
    const ref = `<button class="vrm-offre" data-quoi="reject" ${d} style="${base('transparent', '#a33', '#d9b3b3')}">✕ Refuser</button>`;
    return `<div style="display:flex;gap:6px;margin-top:7px;flex-wrap:wrap">${acc}${con}${ref}${lien}</div>
      <div class="vrm-m" style="margin-top:5px;font-size:10px;opacity:.75">Envoyé depuis ton navigateur, à ton clic.</div>`;
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

  // Le badge d'un onglet = ce qui demande une action, jamais un total.
  function badgeOnglet(t) {
    const st = (DATA && DATA.stats) || {};
    if (t === 'chaussures') return st.online || 0;
    if (t === 'expedier') return (st.toPrint || 0) + (st.toShip || 0);
    if (t === 'achats') return st.toPickup || 0;
    if (t === 'litiges') return st.litiges || 0;
    if (t === 'messages') return st.unread || 0;
    return 0;
  }
  const LIB_ONGLET = {
    journee: ['home', 'Ma journée'], paire: ['eye', 'Cette paire'], chaussures: ['grid', 'Mes paires'],
    ventes: ['trending-up', 'Ventes'], recherche: ['search', 'Chercher'], coffre: ['archive', 'Coffre'],
    expedier: ['printer', 'Bordereaux'], achats: ['shopping-bag', 'Achats'],
    litiges: ['alert-triangle', 'Litiges'], messages: ['message-circle', 'Messages'], favoris: ['heart', 'Favoris'],
  };
  function pastille(t, actif) {
    const [ic, lbl] = LIB_ONGLET[t] || ['home', t];
    const n = badgeOnglet(t);
    return `<button class="vrm-tab ${actif ? 'on' : ''}" data-t="${t}">${svgi(ic, 15)} ${lbl}${n ? ` ${n}` : ''}</button>`;
  }
  function barreOnglets() {
    const principaux = ['journee'];
    if (currentItemId()) principaux.push('paire');
    principaux.push('chaussures', 'expedier', 'achats', 'messages');
    let html = principaux.map(t => pastille(t, tab === t || (t === 'messages' && tab === 'reponse'))).join('');
    const cachesActif = TABS_PLUS.includes(tab);
    const nPlus = TABS_PLUS.reduce((a, t) => a + badgeOnglet(t), 0);
    html += `<button class="vrm-tab ${cachesActif || plusOuvert ? 'on' : ''}" id="vrm-plus">${svgi('more-horizontal', 15)} ${cachesActif ? (LIB_ONGLET[tab] || [])[1] : 'Plus'}${nPlus ? ` ${nPlus}` : ''}</button>`;
    if (plusOuvert) html += `<div style="flex:0 0 100%;display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${TABS_PLUS.map(t => pastille(t, tab === t)).join('')}</div>`;
    return html;
  }

  function render() {
    writeLS('vrm_panel_tab', tab); // garde l'onglet actif d'une page à l'autre
    majBadge(); decorerVignettes();                    // pastille N° sur la page Vinted (voir majBadge)
    const s = (DATA && DATA.stats) || { online: 0, relance: 0, noNum: 0, value: 0 };
    const fresh = (DATA && DATA.freshestAt) ? ` · capté ${esc(timeago(DATA.freshestAt))}` : '';
    panel.innerHTML = `
      <div class="vrm-head">
        <button class="vrm-close" title="Fermer">${svgi('x', 16)}</button>
        <button class="vrm-refresh" title="Rafraîchir les données">${dataBusy ? '<span class="vrm-spin">' + svgi('refresh-cw', 15) + '</span>' : svgi('refresh-cw', 15)}</button>
        <button class="vrm-max" title="${big ? 'Réduire le panneau' : 'Agrandir le panneau'}">${big ? svgi('minimize-2', 15) : svgi('maximize-2', 15)}</button>
        <h3>VRM</h3>
        <div class="vrm-sub">Tes infos, sur Vinted.${fresh}</div>
        <div class="vrm-tabs">${barreOnglets()}</div>
      </div>
      <div id="vrm-body">${bandeauAlerte()}${depotBandeau()}${modeleBandeau()}${
        !DATA ? '<div class="vrm-m">Chargement…</div>'
        : tab === 'journee' ? renderJournee()
        : tab === 'paire' ? renderPaire()
        : tab === 'chaussures' ? renderChaussures()
        : tab === 'ventes' ? renderVentes()
        : tab === 'coffre' ? renderCoffre()
        : tab === 'recherche' ? renderRecherche()
        : tab === 'reponse' ? renderReponse()
        : tab === 'expedier' ? renderExpedier()
        : tab === 'achats' ? renderAchats()
        : tab === 'litiges' ? renderLitiges()
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
    panel.classList.toggle('vrm-big', big); // garde la taille en phase avec l'état
    panel.querySelector('.vrm-close').onclick = () => toggle(false);
    const rb = panel.querySelector('.vrm-refresh'); if (rb) rb.onclick = () => { if (!dataBusy) load(); };
    const mb = panel.querySelector('.vrm-max'); if (mb) mb.onclick = () => { big = !big; writeLS('vrm_panel_big', big ? '1' : '0'); render(); };
    panel.querySelectorAll('.vrm-tab').forEach(b => { b.onclick = () => {
      // Le bouton « Plus » n'ouvre pas un onglet : il déplie les autres.
      if (b.id === 'vrm-plus') { plusOuvert = !plusOuvert; render(); return; }
      tab = b.dataset.t; plusOuvert = false; render();   // render() enregistre déjà l'onglet
    }; });
    panel.querySelectorAll('.vrm-todo').forEach(b => { b.onclick = () => { if (b.dataset.filter) chaussuresFilter = b.dataset.filter; tab = b.dataset.t; render(); }; });
    // Bouton « copier » générique : copie son data-c (réutilisable partout).
    panel.querySelectorAll('.vrm-copy-line').forEach(b => { b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.c || ''); } catch (_) {} const p = b.textContent; b.textContent = '✓ Copié !'; setTimeout(() => { try { b.textContent = p; } catch (_) {} }, 1000); }; });
    // Masquer / réafficher un compte (bloc « Mes comptes Vinted », Ma journée).
    panel.querySelectorAll('.vrm-acct-off').forEach(b => {
      b.onclick = () => {
        const uid = b.dataset.uid; if (!uid) return;
        const off = b.dataset.off === '1';
        b.disabled = true; b.textContent = '⏳';
        chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'setAccountOff', uid, off }, () => { load(); });
      };
    });
    // « Relier ce compte » / « Réautoriser » : le compte connecté ici est lu
    // dans le cookie de session — il n'y a aucun choix à faire, donc aucun
    // risque de relier le mauvais compte.
    panel.querySelectorAll('.vrm-relier').forEach(b => {
      b.onclick = () => {
        b.disabled = true; b.textContent = '⏳ liaison…';
        chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'relierCompte' }, (r) => {
          b.disabled = false;
          if (r && r.ok) { alerte = null; b.textContent = '✓ relié'; load(); }
          else { b.textContent = '↺ Réessayer'; alerte = (r && r.error) || 'liaison impossible'; render(); }
        });
      };
    });
    panel.querySelectorAll('.vrm-reautoriser').forEach(b => {
      b.onclick = () => {
        const uid = b.dataset.uid; if (!uid) return;
        b.disabled = true; b.textContent = '⏳';
        // `off:false` = réautorisation explicite : elle prime sur la liste des
        // comptes supprimés ET relance la capture des jetons côté service worker.
        chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'setAccountOff', uid, off: false }, () => { load(); });
      };
    });
    // « Tout recapter » : une seule requête par type, sur le compte connecté.
    const rec = panel.querySelector('#vrm-recapter');
    if (rec) rec.onclick = () => {
      rec.disabled = true; rec.textContent = '⏳ lecture de tes annonces, ventes et achats…';
      chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'recapter' }, (r) => {
        rec.disabled = false;
        if (r && r.ok) { rec.textContent = '✓ recapté'; load(); }
        else { rec.textContent = '❌ ' + ((r && r.error) || 'échec'); }
        setTimeout(() => { try { rec.textContent = '🔄 Tout recapter (compte connecté)'; } catch (_) {} }, 6000);
      });
    };
    // Ouvrir le PDF d'un bordereau — présent sur plusieurs onglets (Ventes,
    // Bordereaux, Mes paires → Vendues) : on le câble une seule fois, ici.
    panel.querySelectorAll('.vrm-bord-dl').forEach(b => { b.onclick = () => ouvrirBordereau(b.dataset.row, b); });
    // GÉNÉRER / RÉCUPÉRER un bordereau, sur TON clic, pour LE compte connecté.
    // Le bouton rend compte lui-même : on ne renvoie pas dans un journal ailleurs.
    // ⚠️ Classe DISTINCTE de `.vrm-gen-bord` (les lignes de vente) : deux
    // câblages sur la même classe, le second écrase le premier — et le bouton
    // paraît mort. C'est exactement ce qui s'est passé au premier essai.
    panel.querySelectorAll('.vrm-bord-act').forEach(b => {
      b.onclick = async () => {
        const { uid, tx, act } = b.dataset;
        if (!uid || !tx) return;
        const avant = b.textContent;
        b.disabled = true; b.textContent = act === 'gen' ? '⏳ Génération…' : '⏳ Récupération…';
        try {
          const r = await new Promise(res => chrome.runtime.sendMessage(
            { from: 'cancale-vpanel', action: act === 'gen' ? 'genererBord' : 'recupBord', uid, tx },
            (x) => res(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : x)));
          if (r && r.ok && r.envoye) { b.textContent = '✓ envoyé à l\'app'; b.style.background = '#0f6b4f'; setTimeout(load, 1200); }
          else if (r && r.ok) { b.textContent = '✓ généré'; b.style.background = '#0f6b4f'; b.title = "Le PDF n'est pas encore récupérable — il arrivera par email"; setTimeout(load, 1200); }
          else { b.disabled = false; b.textContent = avant; alerte = (r && (r.error || r.message)) || 'Vinted a refusé'; render(); }
        } catch (e) { b.disabled = false; b.textContent = avant; alerte = String(e).slice(0, 120); render(); }
      };
    });
    // ── UN LOT DE BORDEREAUX, MAIS UN PAR UN ──────────────────────────────
    // Julien : « je veux pouvoir sélectionner plusieurs ventes pour générer des
    // bordereaux ». Ce qui reste refusé, c'est la RAFALE : N requêtes lâchées
    // d'un coup. Ici la boucle attend la réponse de Vinted avant la suivante —
    // c'est le rythme du réseau, pas une temporisation déguisée (§32) — et le
    // plafond existant de 20 actions/h par compte reste le vrai garde-fou : dès
    // qu'il refuse, on ARRÊTE le lot au lieu de s'acharner.
    const majPick = () => {
      bordPick.clear();
      panel.querySelectorAll('.vrm-bord-pick').forEach(c => { if (c.checked) bordPick.add(String(c.dataset.tx)); });
    };
    panel.querySelectorAll('.vrm-bord-pick').forEach(c => { c.onchange = majPick; });
    panel.querySelectorAll('.vrm-bord-all').forEach(a => {
      a.onchange = () => {
        panel.querySelectorAll('.vrm-bord-pick').forEach(c => { if (c.dataset.uid === a.dataset.uid) c.checked = a.checked; });
        majPick();
      };
    });
    panel.querySelectorAll('.vrm-bord-lot').forEach(btn => {
      btn.onclick = async () => {
        majPick();
        const cases = [...panel.querySelectorAll('.vrm-bord-pick')].filter(c => c.checked && c.dataset.uid === btn.dataset.uid);
        const etat = panel.querySelector(`.vrm-bord-lot-etat[data-uid="${btn.dataset.uid}"]`);
        if (!cases.length) { if (etat) etat.textContent = 'coche au moins une vente'; return; }
        btn.disabled = true;
        let faits = 0, rates = 0;
        for (let i = 0; i < cases.length; i++) {
          const c = cases[i];
          const carte = c.closest('.vrm-card');
          const bAct = carte ? carte.querySelector('.vrm-bord-act') : null;
          if (etat) etat.textContent = `⏳ ${i + 1}/${cases.length}…`;
          if (bAct) { bAct.disabled = true; bAct.textContent = '⏳'; }
          const r = await new Promise(res => chrome.runtime.sendMessage(
            { from: 'cancale-vpanel', action: c.dataset.act === 'gen' ? 'genererBord' : 'recupBord', uid: c.dataset.uid, tx: c.dataset.tx },
            (x) => res(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : x)));
          if (r && r.ok) {
            faits++; c.checked = false; bordPick.delete(String(c.dataset.tx));
            if (bAct) { bAct.textContent = r.envoye ? '✓ envoyé à l\'app' : '✓ généré'; bAct.style.background = '#0f6b4f'; }
          } else {
            rates++;
            if (bAct) { bAct.disabled = false; bAct.textContent = '❌'; bAct.title = (r && r.error) || 'échec'; }
            // Refus du garde-fou (autre compte, trop d'actions) : inutile de
            // continuer, les suivantes tomberaient sur le même mur.
            if (r && r.code) { alerte = r.error; if (etat) etat.textContent = `arrêté après ${faits} — ${r.error}`; btn.disabled = false; render(); return; }
          }
        }
        if (etat) etat.textContent = `✓ ${faits} traité${faits > 1 ? 's' : ''}${rates ? ` · ${rates} en échec` : ''}`;
        btn.disabled = false;
        setTimeout(load, 1400);
      };
    });
    // Aller chercher le texte d'une annonce (lecture de ta propre annonce).
    const gt = panel.querySelector('#vrm-gab');
    if (gt) gt.oninput = () => { gabarit = gt.value; };   // pas de re-render : on garde le focus
    const gs = panel.querySelector('#vrm-gab-save');
    if (gs) gs.onclick = () => {
      gs.disabled = true; gs.textContent = '⏳';
      chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'gabarit', set: gabarit || '' }, () => {
        gs.disabled = false; gs.textContent = '✓ enregistré';
        setTimeout(() => render(), 900);
      });
    };
    panel.querySelectorAll('.vrm-capt-annonce').forEach(b => {
      b.onclick = () => {
        const avant = b.textContent;
        b.disabled = true; b.textContent = '⏳ lecture…';
        chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'capterAnnonce', itemId: b.dataset.id, uid: b.dataset.uid }, (r) => {
          if (r && r.ok) { b.textContent = '✓ texte récupéré'; setTimeout(() => load(), 900); }
          else { b.disabled = false; b.textContent = '❌ ' + ((r && r.error) || 'échec'); setTimeout(() => { try { b.textContent = avant; } catch (_) {} }, 3500); }
        });
      };
    });
    // Générer le bordereau — l'extension le fait, tu ne vas plus sur Vinted.
    // Un clic = un bordereau (pas de génération en rafale, cf. background.js).
    panel.querySelectorAll('.vrm-gen-bord').forEach(b => {
      b.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!b.dataset.uid || !b.dataset.tx) return;
        const avant = b.innerHTML;
        b.disabled = true; b.innerHTML = '<span style="font-size:11px">⏳</span>';
        chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'genererBord', uid: b.dataset.uid, tx: b.dataset.tx }, (r) => {
          if (r && r.ok) { alerte = null; b.innerHTML = '<span style="font-size:11px">✓ généré</span>'; setTimeout(() => load(), 1200); }
          else if (r && r.code) { alerte = r.error; render(); }
          else {
            b.disabled = false;
            b.title = (r && r.error) || 'échec';
            b.innerHTML = '<span style="font-size:10px">❌ voir ↗</span>';
            setTimeout(() => { try { b.innerHTML = avant; } catch (_) {} }, 4000);
          }
        });
      };
    });
    // Répondre à une offre. Deux taps : le premier arme, le second envoie.
    // Une offre acceptée est une VENTE FERME qu'on n'annule pas — un tap de
    // travers dans une liste ne doit pas vendre une paire.
    panel.querySelectorAll('.vrm-offre').forEach(b => {
      b.onclick = () => {
        if (b.dataset.arme !== '1') {
          panel.querySelectorAll('.vrm-offre').forEach(x => { if (x.dataset.arme === '1') { x.dataset.arme = ''; x.innerHTML = x.dataset.lbl || x.innerHTML; } });
          b.dataset.lbl = b.innerHTML; b.dataset.arme = '1';
          b.innerHTML = 'Confirmer ?';
          setTimeout(() => { try { if (b.dataset.arme === '1') { b.dataset.arme = ''; b.innerHTML = b.dataset.lbl; } } catch (_) {} }, 5000);
          return;
        }
        b.dataset.arme = ''; b.disabled = true; b.innerHTML = '⏳';
        chrome.runtime.sendMessage({
          from: 'cancale-vpanel', action: 'offre', quoi: b.dataset.quoi,
          uid: b.dataset.uid, tx: b.dataset.tx, oid: b.dataset.oid, prix: b.dataset.montant,
        }, (r) => {
          if (r && r.ok) { alerte = null; b.innerHTML = '✓ envoyé'; setTimeout(() => load(), 900); }
          else if (r && r.code) { alerte = r.error; render(); }   // garde-fou : message complet en haut
          else { b.disabled = false; b.innerHTML = '❌ ' + ((r && r.error) || 'échec'); setTimeout(() => { try { b.innerHTML = b.dataset.lbl; } catch (_) {} }, 3500); }
        });
      };
    });
    // ── BAISSER LE PRIX : copie + ouvre l'écran de modification ───────────────
    // ⚠️ POURQUOI L'EXTENSION NE L'ENVOIE PAS ELLE-MÊME. La requête captée
    // (`PUT /api/v2/item_upload/items/{id}`) exige l'annonce ENTIÈRE : titre,
    // description, catégorie, couleurs, attributs, mesures, `package_size_id`,
    // `shipment_prices`, un `temp_uuid`, et surtout `assigned_photos` avec
    // l'identifiant de CHAQUE photo. Reconstruire tout ça pour changer un seul
    // nombre, c'est risquer de renvoyer une annonce SANS ses photos ou avec la
    // mauvaise catégorie. Aucune capture ne permet aujourd'hui de vérifier la
    // correspondance entre ce que renvoie la lecture et ce qu'attend l'écriture.
    // Tant que ce n'est pas vérifié, on ne touche pas : perdre les photos d'une
    // annonce coûte bien plus cher que les deux secondes gagnées.
    panel.querySelectorAll('.vrm-baisse').forEach(b => {
      b.onclick = () => {
        try { navigator.clipboard.writeText(String(b.dataset.p || '')); } catch (_) {}
        window.open(`https://www.vinted.fr/items/${b.dataset.id}/edit`, '_blank', 'noopener');
        const avant = b.textContent;
        b.textContent = `✓ ${b.dataset.p} € copié — colle dans le champ prix`;
        setTimeout(() => { try { b.textContent = avant; } catch (_) {} }, 3000);
      };
    });
    // Prix d'achat : chercher, choisir, saisir, effacer.
    const enregistrerAchat = (id, prix, tx, titre, btn) => {
      const avant = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
      chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'setBuyPrice', itemId: id, prix, tx, titre }, () => {
        achatCands = null; achatPour = null; load();
        if (btn) { btn.disabled = false; btn.textContent = avant; }
      });
    };
    panel.querySelectorAll('.vrm-achat-go').forEach(b => {
      b.onclick = () => {
        achatBusy = true; achatPour = b.dataset.id; render();
        chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'achatsPour', title: b.dataset.t, price: b.dataset.p }, (r) => {
          achatBusy = false; achatCands = (r && r.ok && r.items) || []; render();
        });
      };
    });
    panel.querySelectorAll('.vrm-achat-pick').forEach(b => {
      b.onclick = () => enregistrerAchat(b.dataset.id, b.dataset.prix, b.dataset.tx, b.dataset.titre, b);
    });
    panel.querySelectorAll('.vrm-achat-save').forEach(b => {
      b.onclick = () => {
        const inp = panel.querySelector(`.vrm-achat-in[data-id="${b.dataset.id}"]`);
        if (!inp || !String(inp.value).trim()) return;
        enregistrerAchat(b.dataset.id, inp.value, '', '', b);
      };
    });
    panel.querySelectorAll('.vrm-achat-clear').forEach(b => {
      b.onclick = () => enregistrerAchat(b.dataset.id, '', '', '', b);
    });
    const minSave = panel.querySelector('#vrm-min-save');
    if (minSave) minSave.onclick = () => {
      const inp = panel.querySelector('#vrm-min-in');
      const amount = inp ? inp.value : '';
      minSave.disabled = true; minSave.textContent = '⏳';
      chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'setMinPrice', id: minSave.dataset.id, amount }, () => { load(); });
    };
    const mg = panel.querySelector('#vrm-modele-go');
    if (mg) mg.onclick = () => {
      const how = insertReply(msgModele);
      const p = mg.innerHTML;
      mg.innerHTML = how === 'inserted' ? '✓ Collé — relis, puis appuie sur Envoyer' : '✓ Copié (champ Vinted introuvable)';
      setTimeout(() => { try { mg.innerHTML = p; } catch (_) {} }, 2200);
    };
    if (tab === 'republier') wireRepublier();
    if (tab === 'coffre') wireCoffre();
    if (tab === 'recherche') wireRecherche();
    if (tab === 'reponse') wireReponse();
    if (tab === 'chaussures') wireChaussures();
    if (tab === 'ventes') wireVentes();
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
    const offres = renderOffres();
    if (!list.length) return `${offres}<div class="vrm-m">Aucune conversation captée. Ouvre ta messagerie Vinted une fois pour les capter.</div>`;
    if (msgRun) {
      const total = msgRun.queue.length, i = msgRun.idx;
      if (i >= total) return `<div class="vrm-card" style="text-align:center"><div style="font-size:15px;font-weight:800;margin-bottom:4px">✓ Terminé</div><div class="vrm-m">${total} conversation${total > 1 ? 's' : ''} passée${total > 1 ? 's' : ''}.</div><button class="vrm-msg-go" data-act="stop" style="margin-top:10px;border:none;background:#D2401E;color:#fff;border-radius:10px;padding:8px 14px;font-weight:800;cursor:pointer">Fermer</button></div>`;
      const c = msgRun.queue[i];
      return `
        <div class="vrm-m" style="margin-bottom:8px">Conversation <b>${i + 1}</b> / ${total} — ouvre-la, réponds (onglet <b>Réponse ✍️</b> pour un texte suggéré), puis <b>Suivante</b>.</div>
        <div class="vrm-card" style="display:flex;gap:8px;align-items:center">
          ${c.photo ? `<img src="${esc(c.photo)}" alt="" style="width:42px;height:42px;border-radius:8px;object-fit:cover;flex-shrink:0" />` : '<span style="font-size:24px;flex-shrink:0">💬</span>'}
          <div style="flex:1;min-width:0"><div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.login || 'Acheteur')}${c.unread ? ' 🔴' : ''}</div><div class="vrm-m" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.title || '')}</div></div>
        </div>
        ${msgModele.trim() ? `<div class="vrm-m" style="margin-top:8px;padding:7px 9px;border:1px dashed #0f172a44;border-radius:9px">✉️ Message type prêt : « ${esc(msgModele.slice(0, 90))}${msgModele.length > 90 ? '…' : ''} » — une fois la conversation ouverte, clique <b>Coller mon message type</b> en haut du panneau.</div>` : ''}
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="vrm-msg-go" data-act="open" style="flex:1;border:none;background:#D2401E;color:#fff;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">Ouvrir ↗</button>
          <button class="vrm-msg-go" data-act="next" style="flex:1;border:1px solid #D2401E;background:transparent;color:#D2401E;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">Suivante ▶</button>
        </div>
        <div style="text-align:center;margin-top:8px"><button class="vrm-msg-go" data-act="stop" style="border:none;background:transparent;color:#889;font-size:11.5px;cursor:pointer;text-decoration:underline">Arrêter</button></div>`;
    }
    const rows = list.slice(0, 200).map(c => `
      <label class="vrm-card" style="display:flex;gap:9px;align-items:center;cursor:pointer;margin-bottom:6px;padding:8px">
        <input type="checkbox" class="vrm-msg-chk" data-k="${esc(c.id)}" ${msgSel.has(c.id) ? 'checked' : ''} style="width:18px;height:18px;flex-shrink:0;accent-color:#D2401E">
        ${c.photo ? `<img src="${esc(c.photo)}" alt="" style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex-shrink:0;background:#eee">` : '<div style="width:38px;height:38px;border-radius:8px;background:#eee;flex-shrink:0"></div>'}
        <div style="flex:1;min-width:0"><div class="vrm-t">${c.unread ? '🔴 ' : ''}${esc(c.login || 'Acheteur')}</div><div class="vrm-m" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.title || '')}</div></div>
      </label>`).join('');
    return `
      ${offres}
      <button class="vrm-msg-go" data-act="reponse" style="width:100%;margin-bottom:8px;border:1px dashed #D2401E;background:#D2401E0e;color:#D2401E;border-radius:10px;padding:9px;font-weight:800;font-size:12.5px;cursor:pointer">✍️ Assistant de réponse (IA)</button>
      <div class="vrm-m" style="margin-bottom:8px">Coche les conversations où <b>répondre</b>. Tu réponds <b>une par une, toi-même</b> (aucun envoi automatique). 🔴 = non lu.</div>
      ${modeleBloc()}
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="vrm-msg-go" data-act="unread" style="flex:1;border:1px solid #dde;background:#fff;color:#334;border-radius:8px;padding:6px;font-weight:700;font-size:11.5px;cursor:pointer">Cocher non lus</button>
        <button class="vrm-msg-go" data-act="none" style="flex:1;border:1px solid #dde;background:#fff;color:#334;border-radius:8px;padding:6px;font-weight:700;font-size:11.5px;cursor:pointer">Tout décocher</button>
      </div>
      <div class="vrm-grid" style="margin-bottom:8px">${rows}</div>
      <button class="vrm-msg-go" data-act="start" ${msgSel.size ? '' : 'disabled'} style="position:sticky;bottom:0;width:100%;border:none;background:${msgSel.size ? '#D2401E' : '#9bb'};color:#fff;border-radius:10px;padding:11px;font-weight:800;cursor:${msgSel.size ? 'pointer' : 'default'};box-shadow:0 -6px 14px rgba(0,0,0,.12)">Répondre à ma sélection (${msgSel.size})</button>`;
  }
  // ── LE MESSAGE TYPE (préparé une fois, inséré partout) ──────────────────────
  // Julien : « prédéfinir un message qui sera envoyé par l'extension ».
  // Ce qui est fait : tu l'écris ici, et sur CHAQUE conversation ouverte un
  // bouton le colle dans le champ de Vinted — tu relis, tu appuies sur Envoyer.
  // ⚠️ L'extension n'ENVOIE rien elle-même : un script qui poste des messages en
  // série est exactement ce que Vinted sanctionne (§32). Coller le texte fait
  // gagner tout le temps sans prendre ce risque.
  function modeleBloc() {
    const qr = ((DATA && DATA.quickReplies) || []).slice(0, 6);
    const chips = qr.length ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">${qr.map((t, i) => `<button class="vrm-msg-modele-qr" data-i="${i}" title="${esc(String(t))}" style="border:1px solid #dde;background:#fff;color:#334;border-radius:999px;padding:4px 9px;font-weight:600;font-size:11px;cursor:pointer;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(String(t).slice(0, 34))}${String(t).length > 34 ? '…' : ''}</button>`).join('')}</div>` : '';
    return `<div class="vrm-card" style="margin-bottom:8px;padding:9px">
      <div style="font-weight:800;font-size:12.5px;margin-bottom:5px;display:flex;align-items:center;gap:6px">${svgi('edit-3', 14)} Mon message type</div>
      <textarea id="vrm-msg-modele" rows="3" placeholder="Bonjour ! Merci pour ton intérêt…" style="width:100%;box-sizing:border-box;border:1px solid #d7dde3;border-radius:9px;padding:8px 10px;font:inherit;font-size:12.5px;resize:vertical">${esc(msgModele)}</textarea>
      ${chips}
      <div class="vrm-m" style="margin-top:6px;font-size:10.5px">Sur chaque conversation ouverte, un bouton le colle dans le champ Vinted. <b>C'est toi qui appuies sur Envoyer</b> — rien n'est envoyé tout seul.</div>
    </div>`;
  }
  // Bandeau visible sur une page de conversation, quel que soit l'onglet du
  // panneau : le message type est prêt, un clic le colle dans le champ Vinted.
  // ⚠️ « L'humain choisit, l'outil exécute » — argument de Julien, et il est
  // juste : c'est LUI qui a écrit le message et qui ouvre la conversation. On
  // pré-remplit donc le champ TOUT SEUL à l'ouverture d'un fil, une seule fois
  // par conversation. Ce qui reste à lui : relire et appuyer sur Envoyer.
  // On ne franchit pas la ligne suivante — envoyer à sa place, et surtout
  // envoyer en RAFALE à vingt personnes d'affilée : c'est le rythme qui fait
  // repérer un robot, pas le fait que le texte soit prérédigé.
  let modeleColleSur = null;
  function autoCollerModele() {
    try {
      const cid = currentConvId();
      if (!cid || !msgModele.trim() || modeleColleSur === cid) return;
      const champ = document.querySelector('textarea, [contenteditable="true"]');
      if (!champ) return;                                  // page pas encore prête
      const dejaEcrit = (champ.value || champ.textContent || '').trim();
      if (dejaEcrit) { modeleColleSur = cid; return; }      // ne JAMAIS écraser ce que tu tapes
      modeleColleSur = cid;
      insertReply(msgModele);
    } catch (_) {}
  }

  function modeleBandeau() {
    if (!msgModele.trim() || !currentConvId()) return '';
    return `<button id="vrm-modele-go" style="width:100%;box-sizing:border-box;margin-bottom:8px;display:flex;align-items:center;gap:8px;border:1px solid #0f172a;background:#0f172a;color:#fff;border-radius:11px;padding:9px 11px;font:inherit;font-weight:700;font-size:12.5px;cursor:pointer;text-align:left">
      <span style="flex-shrink:0;display:flex">${svgi('send', 15)}</span>
      <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Coller mon message type</span>
    </button>`;
  }

  function wireMessages() {
    // L'interrupteur d'acceptation automatique. On lit l'état une fois (il vit
    // dans le service worker, par navigateur) puis on redessine ; sans ce
    // premier appel la case afficherait « éteint » même quand c'est allumé.
    const ao = panel.querySelector('#vrm-auto-offres');
    if (ao) {
      if (autoOffres === null) {
        chrome.runtime.sendMessage({ action: 'autoOffresEtat' }, (r) => {
          const v = !!(r && r.actif);
          if (autoOffres !== v) { autoOffres = v; render(); } else { autoOffres = v; }
        });
      }
      ao.onchange = () => {
        const v = !!ao.checked;
        chrome.runtime.sendMessage({ action: 'autoOffresSet', actif: v }, () => { autoOffres = v; render(); });
      };
    }
    const mt = panel.querySelector('#vrm-msg-modele');
    if (mt) mt.oninput = () => { msgModele = mt.value; writeLS('vrm_msg_modele', msgModele); }; // pas de re-render : on garde le focus
    panel.querySelectorAll('.vrm-msg-modele-qr').forEach(b => {
      b.onclick = () => { const t = ((DATA && DATA.quickReplies) || [])[Number(b.dataset.i)]; if (t == null) return; msgModele = String(t); writeLS('vrm_msg_modele', msgModele); render(); };
    });
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
  // ── LA REMISE À PROPOSER, CHIFFRÉE ──────────────────────────────────────────
  // C'est « l'offre chiffrée à chaque favori » que vendent les autres outils.
  // Chez eux elle part toute seule ; ici le montant est calculé et prêt, et
  // c'est le bouton natif de Vinted qui l'envoie — donc rien d'automatisé.
  // Règle : on descend au prix plancher s'il est posé, sinon −10 % arrondi.
  // ⚠️ Jamais en dessous du prix d'achat : on le signale au lieu de proposer
  //    une vente à perte (le prix d'achat, quand il est connu, fait foi).
  function remiseLigne(o) {
    const prix = Number(o.price);
    if (!isFinite(prix) || prix <= 0) return '';
    const plancher = Number(o.minPrice);
    const cible = Math.max(1, Math.round(isFinite(plancher) && plancher > 0 ? plancher : prix * 0.9));
    if (cible >= prix) return '';
    const achat = Number(o.buyPrice);
    const perte = isFinite(achat) && cible <= achat;
    const pct = Math.round((1 - cible / prix) * 100);
    return `<div class="vrm-m" style="font-size:11px;margin-top:2px;color:${perte ? '#a33' : '#0f6b4f'}">
      ${perte ? `⚠️ ${cible} € serait sous ton prix d'achat (${fmt(achat)})`
              : `propose <b>${cible} €</b> (−${pct} %)${isFinite(achat) ? ` · marge ${fmt(cible - achat)}` : ''}`}
    </div>`;
  }

  function renderFavoris() {
    const list = ((DATA && DATA.online) || []).filter(o => (o.favs || 0) > 0).sort((a, b) => (b.favs || 0) - (a.favs || 0));
    if (!list.length) return `<div class="vrm-m">Aucune annonce avec des favoris captée. Ouvre ta boutique Vinted une fois pour capter les compteurs.</div>`;
    if (favRun) {
      const total = favRun.queue.length, i = favRun.idx;
      if (i >= total) return `<div class="vrm-card" style="text-align:center"><div style="font-size:15px;font-weight:800;margin-bottom:4px">✓ Terminé</div><div class="vrm-m">${total} annonce${total > 1 ? 's' : ''} passée${total > 1 ? 's' : ''}.</div><button class="vrm-fav-go" data-act="stop" style="margin-top:10px;border:none;background:#D2401E;color:#fff;border-radius:10px;padding:8px 14px;font-weight:800;cursor:pointer">Fermer</button></div>`;
      const o = favRun.queue[i];
      return `
        <div class="vrm-m" style="margin-bottom:8px">Annonce <b>${i + 1}</b> / ${total} — ouvre-la, propose une remise à tes <b>${o.favs} favori${o.favs > 1 ? 's' : ''}</b> (bouton Vinted « offre aux favoris »), puis <b>Suivante</b>.</div>
        ${card(o, `<div class="vrm-m" style="margin-top:3px">❤️ ${o.favs} favori${o.favs > 1 ? 's' : ''}${o.views != null ? ` · 👁 ${o.views}` : ''}</div>${remiseLigne(o)}${(() => {
          const prix = Number(o.price), plancher = Number(o.minPrice);
          if (!isFinite(prix) || prix <= 0) return '';
          const cible = Math.max(1, Math.round(isFinite(plancher) && plancher > 0 ? plancher : prix * 0.9));
          if (cible >= prix) return '';
          return `<button class="vrm-copy-line" data-c="${cible}" style="margin-top:6px;border:1px solid #0f6b4f;background:#0f6b4f;color:#fff;border-radius:9px;padding:7px 12px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">📋 Copier ${cible} €</button>`;
        })()}`)}
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="vrm-fav-go" data-act="open" style="flex:1;border:none;background:#D2401E;color:#fff;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">Ouvrir ↗</button>
          <button class="vrm-fav-go" data-act="next" style="flex:1;border:1px solid #D2401E;background:transparent;color:#D2401E;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">Suivante ▶</button>
        </div>
        <div style="text-align:center;margin-top:8px"><button class="vrm-fav-go" data-act="stop" style="border:none;background:transparent;color:#889;font-size:11.5px;cursor:pointer;text-decoration:underline">Arrêter</button></div>`;
    }
    const rows = list.slice(0, 200).map(o => `
      <label class="vrm-card" style="display:flex;gap:9px;align-items:center;cursor:pointer;margin-bottom:6px;padding:8px">
        <input type="checkbox" class="vrm-fav-chk" data-k="${esc(o.id)}" ${favSel.has(o.id) ? 'checked' : ''} style="width:18px;height:18px;flex-shrink:0;accent-color:#D2401E">
        ${o.photo ? `<img src="${esc(o.photo)}" alt="" style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex-shrink:0;background:#eee">` : '<div style="width:38px;height:38px;border-radius:8px;background:#eee;flex-shrink:0"></div>'}
        <div style="flex:1;min-width:0"><div class="vrm-t">${esc(o.title)}</div><div class="vrm-m">❤️ ${o.favs}${o.views != null ? ` · 👁 ${o.views}` : ''} · ${fmt(o.price)}</div>${remiseLigne(o)}</div>
      </label>`).join('');
    const favTot = list.reduce((s, o) => s + (o.favs || 0), 0);
    return `
      <div class="vrm-stats" style="margin-bottom:8px">
        <div class="vrm-st"><b style="color:#e2456b">❤️ ${favTot}</b><span class="vrm-m">favoris en attente</span></div>
        <div class="vrm-st"><b>${list.length}</b><span class="vrm-m">annonce${list.length > 1 ? 's' : ''} likée${list.length > 1 ? 's' : ''}</span></div>
      </div>
      <div class="vrm-m" style="margin-bottom:8px">Ces annonces ont été mises en <b>favori</b> par des acheteurs. Coche celles où tu veux <b>leur envoyer une petite remise</b> pour déclencher la vente. L'extension t'ouvre chaque annonce, tu cliques le bouton <b>« Proposer une remise »</b> de Vinted. Rien n'est envoyé automatiquement.</div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="vrm-fav-go" data-act="all" style="flex:1;border:1px solid #dde;background:#fff;color:#334;border-radius:8px;padding:6px;font-weight:700;font-size:11.5px;cursor:pointer">Tout cocher</button>
        <button class="vrm-fav-go" data-act="none" style="flex:1;border:1px solid #dde;background:#fff;color:#334;border-radius:8px;padding:6px;font-weight:700;font-size:11.5px;cursor:pointer">Tout décocher</button>
      </div>
      <div class="vrm-grid" style="margin-bottom:8px">${rows}</div>
      <button class="vrm-fav-go" data-act="start" ${favSel.size ? '' : 'disabled'} style="position:sticky;bottom:0;width:100%;border:none;background:${favSel.size ? '#D2401E' : '#9bb'};color:#fff;border-radius:10px;padding:11px;font-weight:800;cursor:${favSel.size ? 'pointer' : 'default'};box-shadow:0 -6px 14px rgba(0,0,0,.12)">Envoyer une remise aux favoris (${favSel.size})</button>`;
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
    const readBtn = isConvPage() ? `<button id="vrm-rep-read" style="width:100%;margin-bottom:8px;border:1px dashed #D2401E;background:#D2401E0e;color:#D2401E;border-radius:10px;padding:8px;font-weight:700;font-size:12.5px;cursor:pointer">📥 Lire le message de cette conversation</button>` : '';
    let out = `
      <div class="vrm-m" style="margin-bottom:6px">${isConvPage() ? 'Récupère le message de l\'acheteur (ou colle-le), l\'IA propose des réponses.' : 'Colle le message de l\'acheteur : l\'IA te propose des réponses.'} <b>Tu relis et tu envoies toi‑même</b> — rien ne part tout seul.</div>
      ${readBtn}
      <textarea id="vrm-rep-msg" placeholder="Message de l'acheteur…" style="width:100%;box-sizing:border-box;min-height:64px;border:1px solid #d7dde3;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;resize:vertical">${esc(repMsg)}</textarea>
      <button id="vrm-rep-go" ${repBusy ? 'disabled' : ''} style="width:100%;margin-top:8px;border:none;background:#D2401E;color:#fff;border-radius:10px;padding:9px;font-weight:800;cursor:${repBusy ? 'default' : 'pointer'};opacity:${repBusy ? 0.6 : 1}">${repBusy ? '⏳ L\'IA réfléchit…' : '💬 Proposer des réponses'}</button>`;
    if (repResult && repResult.ok && Array.isArray(repResult.suggestions)) {
      out += `<div class="vrm-m" style="margin-top:10px">Intention : <b>${esc(repResult.intent || '—')}</b>${repResult.confidence ? ` · confiance ${repResult.confidence}%` : ''}</div>`;
      out += repResult.suggestions.map((s, i) => `
        <div class="vrm-card" style="margin-top:6px">
          <div class="vrm-m" style="text-transform:uppercase;font-size:10px;letter-spacing:.5px;margin-bottom:3px">${esc(s.tone || 'réponse')}</div>
          <div style="font-size:13px;line-height:1.45">${esc(s.text)}</div>
          <div style="display:flex;gap:6px;margin-top:6px">
            <button class="vrm-insert" data-i="${i}" style="border:none;background:#D2401E;color:#fff;border-radius:8px;padding:5px 12px;font-weight:800;font-size:12px;cursor:pointer">↳ Insérer sur Vinted</button>
            <button class="vrm-copy" data-i="${i}" style="border:1px solid #D2401E;background:#D2401E14;color:#D2401E;border-radius:8px;padding:5px 12px;font-weight:700;font-size:12px;cursor:pointer">📋 Copier</button>
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

  // ── LE BORDEREAU, DONNÉ POUR DE VRAI ────────────────────────────────────────
  // Julien : « je ne sais pas trop comment tu comptes me les donner. » Réponse :
  // un clic, le PDF s'ouvre. L'extension va chercher le fichier déjà reçu par
  // email (la version TAMPONNÉE avec le N° de la paire quand l'app l'a produite),
  // et l'ouvre dans un onglet — prêt à imprimer, sans passer par l'app.
  function ouvrirBordereau(row, btn) {
    if (!row) return;
    const avant = btn ? btn.innerHTML : '';
    const dire = (t) => { if (!btn) return; btn.innerHTML = t; setTimeout(() => { try { btn.innerHTML = avant; btn.disabled = false; } catch (_) {} }, 2200); };
    if (btn) { btn.innerHTML = '⏳'; btn.disabled = true; }
    chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'bordPdf', row }, (r) => {
      if (!r || !r.ok || !r.b64) { dire(r && r.reason === 'no-pdf' ? 'pas de PDF' : 'introuvable'); return; }
      try {
        const bin = atob(String(r.b64).replace(/^data:[^,]+,/, ''));
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' }));
        window.open(url, '_blank', 'noopener');
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 60000);
        if (btn) { btn.disabled = false; btn.innerHTML = avant; }
      } catch (_) { dire('PDF illisible'); }
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
            <button class="vrm-ship-go" data-act="stop" style="margin-top:10px;border:none;background:#D2401E;color:#fff;border-radius:10px;padding:8px 14px;font-weight:800;cursor:pointer">Fermer</button>
          </div>`;
      }
      const t = shipRun.queue[i];
      // État RÉEL du bordereau de cette vente, relu à chaque rendu : dès que tu as
      // cliqué « Générer » sur Vinted, l'extension capte le PDF et la ligne passe
      // au vert ici. Le bouton « J'ai généré » recharge pour te le confirmer.
      const frais = ((DATA && DATA.toShip) || []).find(x => String(x.transaction || '') === String(t.transaction || ''));
      const capte = !!(frais && frais.hasBord);
      // Le bordereau lui-même, s'il est déjà arrivé → on peut l'ouvrir ICI.
      const bordIci = ((DATA && DATA.bordsToPrint) || []).find(x => String(x.transaction || '') === String(t.transaction || ''));
      return `
        <div class="vrm-m" style="margin-bottom:8px">Vente <b>${i + 1}</b> / ${total} — ouvre-la, clique <b>Générer le bordereau</b> sur Vinted. L'extension capte le PDF toute seule ; tu le retrouves dans « à imprimer ».</div>
        <div class="vrm-card" style="display:flex;gap:8px;align-items:center;border-color:${capte ? '#0f6b4f' : '#eceff4'}">
          ${pairThumb(t, 42)}
          <div style="flex:1 1 130px;min-width:0"><div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${numBadge(t)}${esc(t.title || 'Vente')}</div><div class="vrm-m" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.status || '')}${t.price != null ? ` · ${fmt(t.price)}` : ''}</div></div>
          ${capte ? '<span style="flex-shrink:0;font-weight:800;color:#0f6b4f;font-size:12px">✓ bordereau capté</span>' : ''}
        </div>
        ${bordIci ? `<button class="vrm-bord-dl" data-row="${esc(bordIci.row || '')}" style="width:100%;margin-top:8px;border:none;background:#0f172a;color:#fff;border-radius:10px;padding:10px;font:inherit;font-weight:800;cursor:pointer">${svgi('printer', 15)} Ouvrir le bordereau (PDF)</button>` : ''}
        ${(shipCheck && !capte) ? `<div class="vrm-m" style="margin-top:8px;color:#9a5b16">Pas encore reçu. Le bordereau arrive par email juste après la génération — laisse une minute puis « vérifier » à nouveau.</div>` : ''}
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          <button class="vrm-ship-go" data-act="open" style="flex:1 1 140px;border:none;background:#D2401E;color:#fff;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">Ouvrir sur Vinted ↗</button>
          <button class="vrm-ship-go" data-act="check" style="flex:1 1 140px;border:1px solid #0f6b4f;background:rgba(15,107,79,.06);color:#0f6b4f;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">J'ai généré → vérifier</button>
          <button class="vrm-ship-go" data-act="next" style="flex:1 1 100%;border:1px solid #D2401E;background:transparent;color:#D2401E;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">Suivante ▶</button>
        </div>
        <div style="text-align:center;margin-top:8px"><button class="vrm-ship-go" data-act="stop" style="border:none;background:transparent;color:#889;font-size:11.5px;cursor:pointer;text-decoration:underline">Arrêter</button></div>`;
    }

    if (!toPrint.length && !pending.length && !justDone.length) {
      return `<div class="vrm-m">✓ Rien à imprimer ni à générer pour l'instant.${done.length ? ` (${done.length} bordereau${done.length > 1 ? 'x' : ''} déjà traité${done.length > 1 ? 's' : ''}.)` : ''}</div><div class="vrm-m" style="margin-top:6px">Ouvre tes ventes / bordereaux sur Vinted pour les capter.</div>`;
    }

    // ── 0) GÉNÉRER LES BORDEREAUX, COMPTE PAR COMPTE, AVEC LE COMPTE RENDU ──
    // Demande de Julien : voir ses ventes groupées par compte, celles des autres
    // comptes FLOUTÉES (on ne peut pas agir dessus tant qu'on n'y est pas
    // connecté), un bouton « Générer » par vente, et à droite l'état réel — a-t-on
    // capté le bordereau, l'a-t-on envoyé à l'app ?
    // ⚠️ Le flou n'est pas décoratif : agir au nom d'un compte qui n'est pas
    // celui connecté envoie une requête depuis la session d'un autre — c'est LE
    // signal multi-comptes que Vinted sanctionne (§48). On le montre au lieu de
    // laisser cliquer puis échouer.
    const actifUid = DATA && DATA.compteActif ? String(DATA.compteActif) : null;
    const parCompte = {};
    for (const t of list) {
      const k = String(t.uid || '—');
      (parCompte[k] = parCompte[k] || { nom: t.acct || ('compte ' + k.slice(-4)), uid: k, lignes: [] }).lignes.push(t);
    }
    const groupes = Object.values(parCompte).sort((a, b) => (a.uid === actifUid ? -1 : b.uid === actifUid ? 1 : 0));
    const etatVente = (t) => {
      if (t.envoye) return { txt: '✓ dans l\'app', coul: '#0f6b4f', fond: 'rgba(15,107,79,.1)', act: null };
      if (t.hasBord) return { txt: '📧 reçu par email', coul: '#0f6b4f', fond: 'rgba(15,107,79,.08)', act: 'recup' };
      if (t.emis) return { txt: 'étiquette prête', coul: '#9a5b16', fond: 'rgba(154,91,22,.1)', act: 'recup' };
      return { txt: 'pas encore générée', coul: '#c53030', fond: 'rgba(197,48,48,.08)', act: 'gen' };
    };
    const parCompteSection = list.length ? `
      <div class="vrm-m" style="font-weight:800;margin-bottom:6px">📮 ${list.length} vente${list.length > 1 ? 's' : ''} à expédier</div>
      <div class="vrm-m" style="margin-bottom:8px;opacity:.85">Tu appuies, l'extension génère le bordereau chez Vinted, <b>va chercher le PDF</b> et l'envoie dans l'app avec le N° de la paire. La colonne de droite dit où ça en est.<br>Coche plusieurs ventes puis « Traiter la sélection » : elles sont faites <b>l'une après l'autre</b>, jamais en rafale, et le plafond de 20 actions/heure par compte s'applique toujours.</div>
      ${groupes.map(g => {
        const estActif = actifUid && g.uid === actifUid;
        return `
        <div style="margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
            <span style="font-weight:800;font-size:12.5px">${esc(g.nom)}</span>
            ${estActif
              ? '<span style="font-size:11px;font-weight:700;color:#0f6b4f;background:rgba(15,107,79,.1);border-radius:999px;padding:2px 8px">compte connecté</span>'
              : '<span style="font-size:11px;font-weight:700;color:#9a5b16;background:rgba(154,91,22,.1);border-radius:999px;padding:2px 8px">connecte-toi à ce compte pour agir</span>'}
          </div>
          <div style="${estActif ? '' : 'filter:blur(1.6px);opacity:.55;pointer-events:none;user-select:none'}">
          ${estActif && g.lignes.some(t => etatVente(t).act) ? `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
              <label style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;cursor:pointer"><input type="checkbox" class="vrm-bord-all" data-uid="${esc(g.uid)}"> tout cocher</label>
              <button class="vrm-bord-lot" data-uid="${esc(g.uid)}" style="border:none;background:#D2401E;color:#fff;border-radius:9px;padding:6px 11px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">▶ Traiter la sélection</button>
              <span class="vrm-bord-lot-etat vrm-m" data-uid="${esc(g.uid)}"></span>
            </div>` : ''}
          ${g.lignes.map(t => { const e = etatVente(t); return `
            <div class="vrm-card" data-tx="${esc(t.transaction || '')}" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;padding:8px">
              ${estActif && e.act ? `<input type="checkbox" class="vrm-bord-pick" data-uid="${esc(t.uid || '')}" data-tx="${esc(t.transaction || '')}" data-act="${e.act}"${bordPick.has(String(t.transaction)) ? ' checked' : ''} style="flex-shrink:0;cursor:pointer">` : ''}
              ${pairThumb(t, 40)}
              <span style="flex-shrink:0;min-width:34px;text-align:center;font-weight:800;font-size:12px;border-radius:8px;padding:5px 6px;color:${t.numero ? '#0f6b4f' : '#c53030'};background:${t.numero ? 'rgba(15,107,79,.1)' : 'rgba(197,48,48,.1)'}">${t.numero ? 'N°' + esc(t.numero) : 'N° ?'}</span>
              <div style="flex:1 1 90px;min-width:0">
                <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title || 'Vente')}</div>
                <div class="vrm-m" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.status || '')}</div>
              </div>
              <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                <span style="font-size:11px;font-weight:700;color:${e.coul};background:${e.fond};border-radius:999px;padding:2px 8px;white-space:nowrap">${e.txt}</span>
                ${e.act ? `<button class="vrm-bord-act" data-uid="${esc(t.uid || '')}" data-tx="${esc(t.transaction || '')}" data-act="${e.act}" style="border:none;background:${e.act === 'gen' ? '#D2401E' : '#0f172a'};color:#fff;border-radius:8px;padding:5px 9px;font:inherit;font-weight:800;font-size:11.5px;cursor:pointer;white-space:nowrap">${e.act === 'gen' ? '📄 Générer' : '📥 Récupérer'}</button>` : ''}
              </div>
            </div>`; }).join('')}
          </div>
        </div>`;
      }).join('')}` : '';

    // 1) BORDEREAUX À IMPRIMER — le N° de la paire + le titre, comme dans l'app.
    //    L'impression (avec le N° tamponné sur le PDF) se fait dans l'app en 1 tap.
    const printSection = toPrint.length ? `
      <div class="vrm-m" style="margin-bottom:6px;opacity:.85">Les paires que Vinted a déjà vues partir <b>disparaissent toutes seules</b> de cette liste — rien à cocher.</div>
      <div class="vrm-m" style="font-weight:800;margin-bottom:6px">🖨️ ${toPrint.length} bordereau${toPrint.length > 1 ? 'x' : ''} à imprimer${(()=>{const n=toPrint.filter(b=>b.pro).length;return n?` · <span style="color:#B33418">🧾 ${n} avec facture</span>`:'';})()}</div>
      ${toPrint.length > 8 ? `<input id="vrm-bord-search" type="search" value="${esc(bordQuery)}" placeholder="🔍 Filtrer (titre ou N°)…" style="width:100%;box-sizing:border-box;margin-bottom:8px;border:1px solid #d7dde3;border-radius:9px;padding:7px 10px;font:inherit;font-size:12.5px">` : ''}
      ${toPrint.slice(0, 60).map(b => `
        <div class="vrm-card vrm-bord-row" data-s="${esc((((b.numero != null ? 'n°' + b.numero + ' ' : '') + (b.title || '')).toLowerCase()))}" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;padding:8px">
          ${pairThumb(b, 42)}
          <span style="flex-shrink:0;min-width:36px;text-align:center;font-weight:800;color:${b.numero ? '#0f6b4f' : '#c53030'};background:${b.numero ? 'rgba(15,107,79,.1)' : 'rgba(197,48,48,.1)'};border-radius:8px;padding:5px 6px;font-size:12px">${b.numero ? ('N°' + esc(b.numero)) : 'N° ?'}</span>
          <div style="flex:1;min-width:0"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(b.title || 'Bordereau')}</div>${b.dateLimite ? `<div class="vrm-m">à envoyer avant ${esc(b.dateLimite)}</div>` : ''}</div>
          <button class="vrm-bord-dl" data-row="${esc(b.row || '')}" title="Ouvrir le PDF du bordereau (prêt à imprimer)" style="flex-shrink:0;border:1px solid #0f172a;background:#0f172a;color:#fff;border-radius:8px;padding:6px 9px;font-weight:800;font-size:12px;cursor:pointer">${svgi('printer', 13)} Ouvrir</button>
          <button class="vrm-bord-done" data-k="${esc(b.key)}" title="Marquer traité → le retire de la liste (colis fait)" style="flex-shrink:0;border:1px solid #0f6b4f;background:rgba(15,107,79,.08);color:#0f6b4f;border-radius:8px;padding:6px 9px;font-weight:800;font-size:12px;cursor:pointer">✓ Traiter</button>
        </div>`).join('')}
      <a href="${APP_URL}/?tab=cat_bord&print=bord" target="vrm_app" rel="noreferrer" title="Ouvre l'app et imprime TOUS les bordereaux d'un coup (tous les comptes), factures pro jointes" style="display:block;text-align:center;text-decoration:none;background:#D2401E;color:#fff;border-radius:10px;padding:10px;font-weight:800;margin-bottom:14px">🖨️ Tout imprimer (dans l'app) ↗</a>` : '';

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

    // ⚠️ L'ANCIEN FLUX « coche puis je t'ouvre chaque vente » A ÉTÉ RETIRÉ :
    // il faisait le tour des ventes pour que Julien clique « Générer » sur
    // Vinted lui-même. Le bouton « 📄 Générer » de la section par compte fait
    // la même chose en un clic, avec le compte rendu à côté — deux chemins pour
    // le même geste, c'était la meilleure façon de ne plus savoir lequel marche.
    return parCompteSection + printSection + doneSection;
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
        // Relit les données : si tu viens de générer le bordereau sur Vinted,
        // l'extension l'a capté et la ligne passe au vert. Aucun clic à ta place.
        else if (act === 'check') { shipCheck = Date.now(); load(); }
        else if (act === 'next') { if (shipRun) { shipRun.idx++; shipCheck = 0; render(); } }
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
    // Derniers achats (lecture seule) : commandes moissonnées `orders_purchased`.
    // On ne relabelle PAS le statut (pas d'invention) : titre + prix + date.
    const buys = (DATA && DATA.recentBuys) || [];
    const buysBlock = buys.length ? `
      <div class="vrm-m" style="font-weight:700;margin:12px 0 5px">🧾 Derniers achats</div>
      <div style="border:1px solid #eceff3;border-radius:12px;overflow:hidden">
        ${buys.slice(0, 40).map((v, i) => `<a href="${esc(v.url)}" target="_blank" rel="noreferrer" style="display:flex;gap:9px;align-items:center;padding:8px 10px;text-decoration:none;color:inherit;${i ? 'border-top:1px solid #f0f2f5' : ''}">
          ${pairThumb(v, 42)}
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${numBadge(v)}${esc(v.title || 'Achat')}</div>
            ${v.ts ? `<div class="vrm-m" style="font-size:11px;margin-top:1px">${esc(timeago(v.ts))}</div>` : ''}
          </div>
          <div style="flex-shrink:0;font-weight:700;font-size:13px;color:#334">${fmt(v.price)}</div>
        </a>`).join('')}
      </div>` : '';
    if (!list.length && !gotten.length) {
      return `<div class="vrm-m">✓ Aucun colis à retirer pour l'instant.</div><div class="vrm-m" style="margin-top:6px">Les colis « disponibles » (avec code de retrait) apparaissent ici dès que le mail du transporteur arrive.</div>${buysBlock}`;
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
      <div class="vrm-m" style="margin-top:6px;opacity:.85">Mondial Relay = code + pièce d'identité. Chronopost = QR (dans l'app).</div>
      ${buysBlock}`;
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

  // ── ONGLET « LITIGES » : les paires qui te reviennent (lecture seule) ────────
  // Source = le STATUT des ventes moissonnées (remboursement / retour / litige /
  // suspension) — même signal que l'app (`saleOutcome`), rien de deviné. Le MOTIF
  // vient des réclamations captées passivement quand il est disponible.
  // Aucune action sur Vinted : chaque ligne renvoie à la transaction pour agir là-bas.
  function renderLitiges() {
    const all = (DATA && DATA.disputes) || [];
    if (!all.length) {
      return `<div class="vrm-m">✓ Aucun litige ni retour en cours. 👌</div>
        <div class="vrm-m" style="margin-top:6px;opacity:.85">Une paire remboursée, retournée ou en litige apparaît ici automatiquement dès que Vinted change son statut (0 requête ajoutée). Ouvre ta page « Litiges » sur Vinted pour capter le motif détaillé.</div>`;
    }
    // Répartition par type (pour un résumé honnête en tête).
    const byKind = {};
    all.forEach(d => { byKind[d.kind] = (byKind[d.kind] || 0) + 1; });
    const KIND_LBL = { remboursement: '💸 remboursées', retour: '📦 retours', litige: '⚠️ litiges', suspendu: '⏸️ suspendues' };
    const resume = Object.keys(byKind).map(k => `${byKind[k]} ${KIND_LBL[k] || k}`).join(' · ');
    const BG = { remboursement: '#fdeef0', retour: '#eef4ff', litige: '#fff6ec', suspendu: '#f2f5f8' };
    const FG = { remboursement: '#b23a4e', retour: '#2b5b9a', litige: '#9a5b16', suspendu: '#44515e' };
    const rows = all.slice(0, 200).map(d => `
      <a href="${esc(d.url)}" target="_blank" rel="noreferrer" style="display:flex;gap:9px;align-items:center;border:1px solid #eceff3;border-radius:12px;padding:9px 10px;margin-bottom:6px;text-decoration:none;color:inherit">
        ${pairThumb(d, 46)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${numBadge(d)}${esc(d.title || 'Vente')}</div>
          <div style="margin-top:3px;display:flex;flex-wrap:wrap;gap:5px;align-items:center">
            <span style="flex-shrink:0;background:${BG[d.kind] || '#f2f5f8'};color:${FG[d.kind] || '#44515e'};border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700">${esc(d.label)}</span>
            ${d.reason ? `<span class="vrm-m" style="font-size:11px">${esc(d.reason)}</span>` : ''}
            ${d.ts ? `<span class="vrm-m" style="font-size:11px">· ${esc(timeago(d.ts))}</span>` : ''}
          </div>
        </div>
        ${d.price != null ? `<div style="flex-shrink:0;font-weight:700;font-size:13px;color:#334">${fmt(d.price)}</div>` : ''}
      </a>`).join('');
    return `
      <div class="vrm-m" style="font-weight:800;margin-bottom:6px">⚠️ ${all.length} paire${all.length > 1 ? 's' : ''} qui te revien${all.length > 1 ? 'nent' : 't'}</div>
      ${resume ? `<div class="vrm-m" style="margin-bottom:8px">${esc(resume)}</div>` : ''}
      <div class="vrm-grid">${rows}</div>
      <div class="vrm-m" style="margin-top:6px;opacity:.8">Déduit du statut Vinted de tes ventes. Agis directement sur Vinted (bouton sur la transaction).</div>`;
  }

  // ── ONGLET REPUBLIER : sélection + défilement UNE-PAR-UNE ────────────────────
  // Tu coches les annonces à remettre en avant, puis « Commencer » : le panneau
  // t'OUVRE chaque annonce à ton clic, une à la fois. Tu republies toi-même sur
  // Vinted (bouton natif) et tu passes à la suivante. Rien ne part tout seul.
  // ══ LE COFFRE ════════════════════════════════════════════════════════════════
  // Tout ce que l'extension a enregistré de tes annonces : le texte complet et
  // les liens des photos. Sert à trois choses que tu as demandées —
  //   • un catalogue hors-ligne de tes annonces (36) ;
  //   • recréer une annonce supprimée par erreur (32) ;
  //   • recopier le texte existant pour republier (35) — pas de texte inventé,
  //     c'est le tien, à l'identique.
  // Les photos ne sont pas stockées en base (des centaines de Mo, cf. le quota
  // crevé en août) : on garde leurs liens, et « Ouvrir les photos » te les
  // affiche pour que tu les réenregistres.
  // Le bouton de sauvegarde des numéros — défini une fois, utilisé dans le
  // coffre plein ET dans le coffre vide.
  // ══ RECHERCHE UNIVERSELLE + PASSEPORT DE LA PAIRE ════════════════════════════
  // Un seul champ qui atteint TOUT : annonces en ligne, ventes, achats,
  // bordereaux, conversations, coffre. Tape un N°, un bout de titre, une marque
  // ou un pseudo d'acheteur — tu tombes dessus sans savoir dans quel onglet
  // chercher. Et un clic ouvre le PASSEPORT : la vie complète de la paire,
  // recomposée depuis les six sources.
  // ⚠️ Le passeport rapproche par **NUMÉRO** (identité certaine) et, à défaut,
  //    par titre EXACT. Jamais par ressemblance : afficher la vente d'une autre
  //    paire serait pire que de ne rien afficher (§24).
  let q = '', passeport = null;
  // Message d'alerte affiché en haut du panneau (refus du garde-fou anti-blocage).
  let alerte = null;
  const bandeauAlerte = () => alerte ? `<div class="vrm-card" style="margin-bottom:8px;padding:9px;background:#fff6ec;border-color:#ffd7a8">
      <div style="font-weight:800;font-size:12.5px;color:#9a5b16;display:flex;align-items:center;gap:6px">${svgi('alert-triangle', 14)} Action non envoyée</div>
      <div class="vrm-m" style="font-size:11.5px;margin-top:3px">${esc(alerte)}</div>
    </div>` : '';
  const cont = (s, t) => String(s || '').toLowerCase().includes(t);
  function renderRecherche() {
    if (passeport) return renderPasseport(passeport);
    const t = q.trim().toLowerCase();
    const champ = `<input id="vrm-q" type="search" value="${esc(q)}" placeholder="N°, titre, marque, acheteur…" style="width:100%;box-sizing:border-box;margin-bottom:10px;border:1px solid #d7dde3;border-radius:11px;padding:11px 12px;font:inherit;font-size:14px">`;
    // ⚠️ Un seul caractère suffit si c'est un CHIFFRE : « 7 » doit trouver la
    //    paire N°7. Le seuil de deux caractères ne vaut que pour du texte.
    if (t.length < 2 && !/^\d$/.test(t)) return `${champ}<div class="vrm-m">Tape un numéro, ou au moins deux lettres.<br><br>Ça cherche partout à la fois : tes annonces en ligne, tes ventes, tes achats, tes bordereaux, tes conversations et le coffre.</div>`;
    const D = DATA || {};
    const parNum = (o) => o && o.numero != null && String(o.numero).toLowerCase() === t.replace(/^n°?/, '');
    const annonces = (D.online || []).filter(o => parNum(o) || cont(o.title, t) || cont(o.brand, t));
    const ventes = (D.sales || []).filter(o => parNum(o) || cont(o.title, t) || cont(o.acct, t));
    const achats = (D.recentBuys || []).filter(o => cont(o.title, t));
    const bords = (D.bordsToPrint || []).filter(b => parNum(b) || cont(b.title, t));
    const convs = (D.convs || []).filter(c => cont(c.login, t) || cont(c.title, t));
    const coff = (coffre || []).filter(c => cont(c.title, t) || cont(c.brand, t));
    const total = annonces.length + ventes.length + achats.length + bords.length + convs.length + coff.length;
    if (!total) return `${champ}<div class="vrm-m">Rien trouvé pour « ${esc(q)} ».</div>`;
    const groupe = (titre, items, rendu) => items.length ? `
      <div class="vrm-m" style="font-weight:800;margin:8px 0 5px">${titre} · ${items.length}</div>
      ${items.slice(0, 12).map(rendu).join('')}` : '';
    const ligneAnn = (o) => `<div class="vrm-card vrm-pass" data-n="${esc(o.numero || '')}" data-t="${esc(o.title || '')}" style="display:flex;gap:9px;align-items:center;margin-bottom:5px;padding:8px;cursor:pointer">
        ${pairThumb(o, 38)}<div style="flex:1 1 120px;min-width:0"><div style="font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${numBadge(o)}${esc(o.title || '')}</div><div class="vrm-m" style="font-size:11px">${fmt(o.price)}${o.ageDays != null ? ` · ${o.ageDays} j` : ''}</div></div></div>`;
    return `${champ}
      <div class="vrm-m" style="margin-bottom:4px"><b>${total}</b> résultat${total > 1 ? 's' : ''}</div>
      ${groupe('👟 En ligne', annonces, ligneAnn)}
      ${groupe('💶 Ventes', ventes, ligneAnn)}
      ${groupe('📦 Achats', achats, (o) => `<div class="vrm-card" style="display:flex;gap:9px;align-items:center;margin-bottom:5px;padding:8px">${pairThumb(o, 34)}<div style="flex:1 1 120px;min-width:0"><div style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(o.title || '')}</div><div class="vrm-m" style="font-size:11px">${o.price != null ? fmt(o.price) : ''}${o.ts ? ` · ${esc(timeago(o.ts))}` : ''}</div></div></div>`)}
      ${groupe('🖨️ Bordereaux', bords, (b) => `<div class="vrm-card" style="display:flex;gap:9px;align-items:center;margin-bottom:5px;padding:8px">${pairThumb(b, 34)}<div style="flex:1;min-width:0"><div style="font-size:12px">${b.numero ? `N°${esc(b.numero)} · ` : ''}${esc(b.title || '')}</div></div>${b.row ? `<button class="vrm-bord-dl" data-row="${esc(b.row)}" style="flex-shrink:0;border:1px solid #0f172a;background:#0f172a;color:#fff;border-radius:8px;padding:5px 9px;font:inherit;font-weight:700;font-size:11px;cursor:pointer">Ouvrir</button>` : ''}</div>`)}
      ${groupe('💬 Conversations', convs, (c) => `<a href="${esc(c.url || '#')}" target="_blank" rel="noreferrer" class="vrm-card" style="display:flex;gap:9px;align-items:center;margin-bottom:5px;padding:8px;text-decoration:none;color:inherit"><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600">${c.unread ? '🔴 ' : ''}${esc(c.login || '')}</div><div class="vrm-m" style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.title || '')}</div></div></a>`)}
      ${groupe('🗄️ Coffre', coff, (c) => `<div class="vrm-card vrm-coffre-row" data-id="${esc(c.id)}" style="display:flex;gap:9px;align-items:center;margin-bottom:5px;padding:8px;cursor:pointer">${c.photos && c.photos[0] ? `<img src="${esc(c.photos[0])}" alt="" style="width:34px;height:34px;border-radius:7px;object-fit:cover">` : ''}<div style="flex:1;min-width:0"><div style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.title || '')}</div><div class="vrm-m" style="font-size:11px">${c.desc ? 'texte enregistré' : 'sans texte'}</div></div></div>`)}`;
  }

  // Le PASSEPORT : toute la vie d'une paire sur un écran.
  function renderPasseport(p) {
    const D = DATA || {};
    const num = String(p.n || ''), titre = String(p.t || '');
    const memePaire = (o) => (num && String(o.numero || '') === num) || (!num && titre && String(o.title || '') === titre);
    const ann = (D.online || []).find(memePaire) || null;
    const ventes = (D.sales || []).filter(memePaire);
    const bord = (D.bordsToPrint || []).find(memePaire) || null;
    const coff = (coffre || []).find(c => (ann && String(c.id) === String(ann.id)) || String(c.title || '') === titre) || null;
    const base = ann || ventes[0] || {};
    const etape = (icone, titreL, detail, ok) => `<div style="display:flex;gap:9px;align-items:flex-start;padding:7px 0;border-top:1px solid #eceff3">
        <span style="flex-shrink:0;width:20px;text-align:center;opacity:${ok ? 1 : .35}">${icone}</span>
        <div style="flex:1 1 120px;min-width:0"><div style="font-size:12.5px;font-weight:${ok ? 700 : 500};opacity:${ok ? 1 : .55}">${titreL}</div>${detail ? `<div class="vrm-m" style="font-size:11px">${detail}</div>` : ''}</div>
      </div>`;
    const marge = (base.buyPrice != null && base.price != null) ? Number(base.price) - Number(base.buyPrice) : null;
    return `
      <button id="vrm-pass-back" style="margin-bottom:8px;border:1px solid #dde;background:#fff;color:#334;border-radius:9px;padding:6px 10px;font:inherit;font-weight:700;font-size:11.5px;cursor:pointer">‹ Retour</button>
      <div class="vrm-card" style="padding:10px">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">
          ${pairThumb(base, 52)}
          <div style="flex:1 1 130px;min-width:0">
            <div style="font-weight:700;font-size:13px">${num ? `<span class="vrm-num">N°${esc(num)}</span> ` : ''}${esc(base.title || titre)}</div>
            <div class="vrm-m" style="font-size:11px">${base.price != null ? fmt(base.price) : ''}${base.acct ? ` · ${esc(base.acct)}` : ''}</div>
          </div>
        </div>
        ${etape('📦', base.buyPrice != null ? `Achetée ${fmt(base.buyPrice)}` : "Prix d'achat inconnu", base.buyPrice == null ? 'sans lui, la marge est fausse' : '', base.buyPrice != null)}
        ${etape('🏠', ann && ann.cell ? `Rangée en case ${esc(ann.cell)}` : 'Pas rangée au garage', '', !!(ann && ann.cell))}
        ${etape('👟', ann ? 'En ligne' : 'Plus en ligne', ann ? `${ann.ageDays != null ? `depuis ${ann.ageDays} j · ` : ''}${ann.views != null ? `👁 ${ann.views}` : ''}${ann.favs != null ? ` · ❤️ ${ann.favs}` : ''}` : '', !!ann)}
        ${etape('🗄️', coff ? (coff.desc ? 'Texte et photos au coffre' : 'Au coffre (sans texte)') : 'Pas au coffre', coff && coff.photos ? `${coff.photos.length} photo${coff.photos.length > 1 ? 's' : ''}` : '', !!coff)}
        ${etape('💶', ventes.length ? `Vendue ${fmt(ventes[0].price)}` : 'Pas encore vendue', ventes.length && ventes[0].ts ? esc(timeago(ventes[0].ts)) : '', !!ventes.length)}
        ${etape('🖨️', bord ? 'Bordereau reçu' : (ventes.length ? 'Pas de bordereau en attente' : ''), bord && bord.dateLimite ? `à envoyer avant ${esc(bord.dateLimite)}` : '', !!bord)}
        ${marge != null ? `<div style="border-top:1px solid #eceff3;margin-top:6px;padding-top:8px;display:flex;justify-content:space-between;align-items:baseline">
          <span style="font-weight:700;font-size:12.5px">Marge</span>
          <b style="font-size:15px;color:${marge >= 0 ? '#0f6b4f' : '#a33'}">${fmt(marge)}</b></div>` : ''}
      </div>`;
  }

  function wireRecherche() {
    const i = panel.querySelector('#vrm-q');
    if (i) {
      i.oninput = () => { q = i.value; render(); const n = panel.querySelector('#vrm-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } };
      if (!passeport) i.focus();
    }
    panel.querySelectorAll('.vrm-pass').forEach(r => { r.onclick = () => { passeport = { n: r.dataset.n, t: r.dataset.t }; render(); }; });
    const b = panel.querySelector('#vrm-pass-back'); if (b) b.onclick = () => { passeport = null; render(); };
    // le coffre peut ne pas être encore chargé : on le demande en fond
    if (coffre == null && !coffreBusy) { coffreBusy = true; chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'coffre' }, (r) => { coffreBusy = false; coffre = (r && r.ok && r.items) || []; render(); }); }
  }

  // ── SANTÉ DE LA CAPTURE ─────────────────────────────────────────────────────
  // « Est-ce que ça capte ? » se voit ici, compte par compte, au lieu d'aller
  // lire la base. Un compte muet = session expirée : repasse dessus sur Vinted.
  // ── CE QUE VINTED PEUT VOIR DE TOI ──────────────────────────────────────────
  // Le risque de blocage est invisible, donc on le subit. Ici on le chiffre :
  // combien de comptes vivent dans ce navigateur, combien ont été utilisés
  // récemment, et le rythme d'actions de l'heure. Le premier chiffre est le
  // décisif — même appareil, même empreinte — et aucune automatisation n'y
  // change rien (c'est ce qui a fait tomber vanessa5723).
  let emp = null, empBusy = false;
  function empreinteBloc() {
    if (emp == null) {
      if (!empBusy) { empBusy = true; chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'empreinte' }, (r) => { empBusy = false; emp = (r && r.ok) ? r : { comptes: [] }; render(); }); }
      return '';
    }
    const n = (emp.comptes || []).length;
    if (!n) return '';
    const grave = n >= 3, moyen = n === 2;
    const coul = grave ? '#a33' : moyen ? '#9a5b16' : '#0f6b4f';
    const fond = grave ? '#fdf0f0' : moyen ? '#fff6ec' : '#eefaf3';
    const bord = grave ? '#e9c3c3' : moyen ? '#ffd7a8' : '#bfe6d3';
    const ligne = (c) => `<div class="vrm-m" style="display:flex;justify-content:space-between;gap:8px;font-size:11px;padding:1px 0">
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.actif ? '● ' : '○ '}${esc(c.login || ('compte ' + c.uid.slice(-4)))}${c.actif ? ' <b>(connecté)</b>' : ''}</span>
        <b style="flex-shrink:0">${c.actions ? `${c.actions} action${c.actions > 1 ? 's' : ''}/h` : '—'}</b>
      </div>`;
    return `<div class="vrm-card" style="margin-bottom:10px;padding:9px;background:${fond};border-color:${bord}">
      <div style="font-weight:800;font-size:12.5px;color:${coul}">Ce que Vinted peut voir · ${n} compte${n > 1 ? 's' : ''} dans ce navigateur</div>
      <div class="vrm-m" style="font-size:11px;margin:3px 0 6px">${
        grave ? "C'est le signal le plus lourd : même appareil, même empreinte. Aucun réglage de l'extension ne l'efface — seul le fait d'en garder moins ici le réduit."
        : moyen ? "Deux comptes sur la même machine se rapprochent facilement. Garde les actions sur un seul autant que possible."
        : "Un seul compte ici : c'est la situation la plus sûre."}</div>
      ${(emp.comptes || []).slice(0, 8).map(ligne).join('')}
      ${emp.comptesActifs > 1 ? `<div class="vrm-m" style="font-size:11px;margin-top:5px;color:${coul}"><b>${emp.comptesActifs} comptes</b> ont reçu une action dans l'heure — basculer de l'un à l'autre pour agir, c'est ce même signal en mouvement.</div>` : ''}
      <div class="vrm-m" style="font-size:10.5px;margin-top:5px;opacity:.8">Plafond de sécurité : 20 actions par compte et par heure.</div>
    </div>`;
  }

  function santeBloc() {
    const list = (DATA && DATA.sante) || [];
    if (!list.length) return '';
    const jour = 86400000;
    const etat = (t) => {
      if (!t) return { txt: 'jamais', c: '#a33' };
      const j = (Date.now() - t) / jour;
      return { txt: timeago(t), c: j < 2 ? '#0f6b4f' : j < 7 ? '#9a5b16' : '#a33' };
    };
    const ligne = (s) => {
      const cases = [['annonces', s.annonces], ['ventes', s.ventes], ['achats', s.achats], ['messages', s.messages]];
      const muet = cases.every(([, t]) => !t);
      return `<div class="vrm-card" style="margin-bottom:6px;padding:8px${s.off ? ';opacity:.5' : ''}">
        <div style="font-weight:700;font-size:12.5px">${esc(s.name || ('compte ' + String(s.uid).slice(-4)))}${s.off ? ' <span class="vrm-m">(masqué)</span>' : ''}${s.online ? ` <span class="vrm-m">· ${s.online} en ligne</span>` : ''}</div>
        ${muet ? `<div class="vrm-m" style="font-size:11px;color:#a33;margin-top:3px">Rien de capté. La session a sans doute expiré : ouvre Vinted avec ce compte une fois.</div>`
               : cases.map(([lbl, t]) => { const e = etat(t); return `<div class="vrm-m" style="display:flex;justify-content:space-between;gap:8px;font-size:11px"><span>${lbl}</span><b style="color:${e.c}">${esc(e.txt)}</b></div>`; }).join('')}
      </div>`;
    };
    return `<div style="margin-bottom:10px">
      ${empreinteBloc()}
      <div class="vrm-m" style="font-weight:800;margin-bottom:6px">Santé de la capture</div>
      ${list.map(ligne).join('')}
      <div class="vrm-m" style="font-size:10.5px;opacity:.8">Vert = frais du jour · orange = quelques jours · rouge = à réveiller.</div>
    </div>`;
  }

  const boutonSaveNums = () => `<button id="vrm-save-nums" title="Tes numéros de boîte et prix d'achat, dans un fichier" style="flex:1 1 150px;border:1px solid #0f172a;background:#fff;color:#0f172a;border-radius:9px;padding:8px;font:inherit;font-weight:700;font-size:12px;cursor:pointer">${svgi('hash', 14)} Sauvegarder mes N°</button>`;

  function renderCoffre() {
    if (coffre == null) {
      if (!coffreBusy) { coffreBusy = true; chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'coffre' }, (r) => { coffreBusy = false; coffre = (r && r.ok && r.items) || []; render(); }); }
      return `<div class="vrm-m">Ouverture du coffre…</div>`;
    }
    if (!coffre.length) {
      // ⚠️ La sauvegarde des N° reste proposée : elle ne dépend pas du coffre
      // (elle lit tes numéros dans l'app), et c'est justement quand tout est
      // vide qu'on a envie d'un filet.
      return `${santeBloc()}<div class="vrm-m" style="margin-bottom:10px">Le coffre est encore vide.<br><br>Il se remplit tout seul en naviguant : dès que ton dressing se charge, chaque annonce en ligne y est enregistrée (titre, prix, marque, taille, photo). La <b>description</b> arrive quand tu ouvres l'annonce, ou avec le bouton « Récupérer le texte » de l'onglet Republier.</div>
        ${boutonSaveNums()}`;
    }
    const q = coffreQuery.trim().toLowerCase();
    const list = q ? coffre.filter(c => (`${c.title} ${c.brand} ${c.size}`).toLowerCase().includes(q)) : coffre;
    const avecTexte = coffre.filter(c => c.desc).length;
    if (coffreOuvert) {
      const c = coffre.find(x => String(x.id) === String(coffreOuvert));
      if (c) return detailCoffre(c);
    }
    const ligne = (c) => `
      <div class="vrm-card vrm-coffre-row" data-id="${esc(c.id)}" style="display:flex;gap:9px;align-items:center;margin-bottom:6px;padding:8px;cursor:pointer">
        ${c.photos && c.photos[0] ? `<img src="${esc(c.photos[0])}" alt="" style="width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0;background:#eee">` : '<div style="width:40px;height:40px;border-radius:8px;background:#eee;flex-shrink:0"></div>'}
        <div style="flex:1 1 130px;min-width:0">
          <div style="font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.title || 'Annonce')}</div>
          <div class="vrm-m" style="font-size:11px">${c.price != null ? fmt(c.price) : ''}${c.brand ? ` · ${esc(c.brand)}` : ''}${c.size ? ` · ${esc(c.size)}` : ''}${c.desc ? '' : ' · <span style="color:#9a5b16">texte manquant</span>'}</div>
        </div>
        <span class="vrm-m" style="flex-shrink:0;font-size:11px">${(c.photos || []).length} 📷</span>
      </div>`;
    return `
      ${santeBloc()}
      <div class="vrm-m" style="margin-bottom:8px"><b>${coffre.length}</b> annonce${coffre.length > 1 ? 's' : ''} enregistrée${coffre.length > 1 ? 's' : ''} · ${avecTexte} avec leur description.<br>Même si une annonce disparaît de Vinted, elle reste ici.</div>
      ${coffre.length > 8 ? `<input id="vrm-coffre-search" type="search" value="${esc(coffreQuery)}" placeholder="🔍 Chercher dans le coffre…" style="width:100%;box-sizing:border-box;margin-bottom:8px;border:1px solid #d7dde3;border-radius:9px;padding:8px 10px;font:inherit;font-size:12.5px">` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <button id="vrm-coffre-export" style="flex:1 1 150px;border:1px solid #0f172a;background:#fff;color:#0f172a;border-radius:9px;padding:8px;font:inherit;font-weight:700;font-size:12px;cursor:pointer">${svgi('download', 14)} Sauvegarder le coffre</button>
        ${boutonSaveNums()}
      </div>
      ${list.slice(0, 150).map(ligne).join('')}
      ${list.length > 150 ? `<div class="vrm-m">… et ${list.length - 150} autres</div>` : ''}`;
  }

  // Le détail d'une annonce archivée : tout est là, prêt à recoller.
  function detailCoffre(c) {
    const cp = (lbl, txt) => `<button class="vrm-copy-line" data-c="${esc(txt)}" style="flex:1 1 100px;border:1px solid #0f172a;background:#fff;color:#0f172a;border-radius:9px;padding:7px 9px;font:inherit;font-weight:700;font-size:11.5px;cursor:pointer">${lbl}</button>`;
    // ⚠️ Les sections sont séparées par une LIGNE VIDE : ce bloc est fait pour
    // être collé tel quel, et un titre collé à la description est illisible.
    const carac = [c.brand ? `Marque : ${c.brand}` : '', c.size ? `Taille : ${c.size}` : '',
                   c.etat ? `État : ${c.etat}` : '', c.price != null ? `Prix : ${c.price} €` : '']
                   .filter(Boolean).join('\n');
    const tout = [c.title, c.desc, carac].filter(x => String(x || '').trim()).join('\n\n');
    return `
      <button id="vrm-coffre-back" style="margin-bottom:8px;border:1px solid #dde;background:#fff;color:#334;border-radius:9px;padding:6px 10px;font:inherit;font-weight:700;font-size:11.5px;cursor:pointer">‹ Retour au coffre</button>
      <div class="vrm-card" style="padding:9px">
        <div style="display:flex;gap:9px;align-items:center;margin-bottom:8px">
          ${c.photos && c.photos[0] ? `<img src="${esc(c.photos[0])}" alt="" style="width:52px;height:52px;border-radius:10px;object-fit:cover;flex-shrink:0">` : ''}
          <div style="flex:1 1 130px;min-width:0">
            <div style="font-weight:700;font-size:13px">${esc(c.title || 'Annonce')}</div>
            <div class="vrm-m" style="font-size:11px">${c.price != null ? fmt(c.price) : ''}${c.brand ? ` · ${esc(c.brand)}` : ''}${c.size ? ` · ${esc(c.size)}` : ''}${c.etat ? ` · ${esc(c.etat)}` : ''}</div>
          </div>
        </div>
        ${c.desc ? `<div class="vrm-m" style="font-size:11px;white-space:pre-wrap;max-height:150px;overflow:auto;background:#f7f9fb;border-radius:8px;padding:8px;margin-bottom:8px">${esc(c.desc)}</div>`
                 : `<div class="vrm-m" style="font-size:11px;color:#9a5b16;margin-bottom:8px">La description n'est pas encore enregistrée. Ouvre l'annonce sur Vinted, ou utilise « Récupérer le texte » dans Republier.</div>`}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${cp('📋 Titre', c.title || '')}
          ${c.desc ? cp('📋 Description', c.desc) : ''}
          ${c.price != null ? cp('📋 Prix', String(c.price)) : ''}
          ${cp('📋 Tout', tout)}
        </div>
        ${(c.photos || []).length ? `
          <div class="vrm-m" style="font-size:11px;margin-bottom:5px">Vinted refuse un fichier identique quand tu recrées l'annonce : recadre chaque photo avant de la redéposer.</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            ${(c.photos || []).map((u, i) => `
              <div style="flex:0 0 auto;text-align:center">
                <img src="${esc(u)}" alt="" style="width:56px;height:56px;border-radius:8px;object-fit:cover;display:block;background:#eee">
                <button class="vrm-photo-edit" data-u="${esc(u)}" data-t="${esc(c.title || '')}" style="margin-top:3px;width:56px;border:1px solid #0f172a;background:#fff;color:#0f172a;border-radius:7px;padding:3px 0;font:inherit;font-weight:700;font-size:10px;cursor:pointer">✂️ ${i + 1}</button>
              </div>`).join('')}
          </div>
          <button class="vrm-prep-photos" data-id="${esc(c.id)}" style="width:100%;border:none;background:#0f6b4f;color:#fff;border-radius:9px;padding:10px;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer;margin-bottom:6px">📦 Préparer les ${(c.photos || []).length} photos (recadrées, prêtes à déposer)</button>
          <button class="vrm-coffre-photos" data-id="${esc(c.id)}" style="width:100%;border:1px solid #0f172a;background:#0f172a;color:#fff;border-radius:9px;padding:9px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">${svgi('eye', 14)} Voir les ${(c.photos || []).length} photos en grand</button>` : ''}
        <button class="vrm-depot-go" data-id="${esc(c.id)}" style="width:100%;margin-top:6px;border:1px solid #0f6b4f;background:#fff;color:#0f6b4f;border-radius:9px;padding:9px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">Recréer cette annonce sur Vinted ↗</button>
      </div>`;
  }

  // ── RETOUCHER UNE PHOTO DU COFFRE ───────────────────────────────────────────
  // Julien : « pour republier, je ne peux pas avoir les mêmes photos, même si
  // c'est le même article ». Vinted refuse un fichier identique quand tu
  // supprimes puis recrées — donc il faut RECOMPOSER l'image.
  // Ce que fait cet éditeur : tu recadres, tu zoomes, tu redresses, TOI, photo
  // par photo. Le résultat est une image réellement différente — et le plus
  // souvent meilleure (cadrage plus serré sur la chaussure).
  // ⚠️ Ce n'est PAS un outil qui retouche en masse : une photo à la fois, tes
  // réglages, ton téléchargement. Même principe que l'éditeur déjà présent dans
  // l'app (« ✂️ Retoucher une photo »).
  function ouvrirEditeurPhoto(dataUrl, titre) {
    const html = `<!doctype html><meta charset="utf-8"><title>Retoucher — ${esc(titre || '')}</title>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#e8edf3">
<div style="max-width:760px;margin:0 auto;padding:18px">
  <h1 style="font-size:16px;margin:0 0 4px">Retoucher la photo</h1>
  <p style="color:#9fb0c3;font-size:12.5px;margin:0 0 14px">Recadre et redresse comme tu veux, puis enregistre. Vinted refuse un fichier identique : une image recomposée passe, et un cadrage plus serré vend mieux.</p>
  <canvas id="c" width="360" height="480" style="background:#fff;border-radius:12px;max-width:100%;touch-action:none;cursor:grab"></canvas>
  <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px">
    <label style="font-size:12.5px">Zoom <input id="z" type="range" min="1" max="3" step="0.01" value="1" style="width:100%"></label>
    <label style="font-size:12.5px">Luminosité <input id="b" type="range" min="0.6" max="1.6" step="0.01" value="1" style="width:100%"></label>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button id="rot" style="flex:1 1 120px;border:1px solid #33455c;background:#1b2739;color:#e8edf3;border-radius:9px;padding:10px;font:inherit;font-weight:700;cursor:pointer">↻ Tourner 90°</button>
      <button id="ratio" style="flex:1 1 120px;border:1px solid #33455c;background:#1b2739;color:#e8edf3;border-radius:9px;padding:10px;font:inherit;font-weight:700;cursor:pointer">Format : 3:4</button>
      <button id="dl" style="flex:1 1 100%;border:none;background:#0f6b4f;color:#fff;border-radius:9px;padding:12px;font:inherit;font-weight:800;cursor:pointer">⬇ Enregistrer la photo</button>
    </div>
    <p style="color:#9fb0c3;font-size:11.5px;margin:0">Glisse l'image pour la déplacer. Puis dépose le fichier enregistré dans ta nouvelle annonce Vinted.</p>
  </div>
</div>
<script>
(function(){
  var img=new Image(); var zoom=1,bright=1,rot=0,off={x:0,y:0},drag=null;
  var RAT=[[3,4],[1,1],[4,3]], ri=0;
  var c=document.getElementById('c'), ctx=c.getContext('2d');
  function size(){ var w=360,h=Math.round(360*RAT[ri][1]/RAT[ri][0]); c.width=w; c.height=h; }
  function draw(){
    ctx.save(); ctx.clearRect(0,0,c.width,c.height);
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height);
    if(img.naturalWidth){
      try{ ctx.filter='brightness('+bright+')'; }catch(e){}
      var iw=img.naturalWidth, ih=img.naturalHeight;
      if(rot%180!==0){ var t=iw; iw=ih; ih=t; }
      var s=Math.max(c.width/iw, c.height/ih)*zoom;
      ctx.translate(c.width/2+off.x, c.height/2+off.y);
      ctx.rotate(rot*Math.PI/180);
      ctx.drawImage(img, -img.naturalWidth*s/2, -img.naturalHeight*s/2, img.naturalWidth*s, img.naturalHeight*s);
    }
    ctx.restore();
  }
  img.onload=function(){ size(); draw(); };
  img.src=${JSON.stringify(dataUrl)};
  document.getElementById('z').oninput=function(e){ zoom=+e.target.value; draw(); };
  document.getElementById('b').oninput=function(e){ bright=+e.target.value; draw(); };
  document.getElementById('rot').onclick=function(){ rot=(rot+90)%360; draw(); };
  document.getElementById('ratio').onclick=function(e){ ri=(ri+1)%RAT.length; e.target.textContent='Format : '+RAT[ri][0]+':'+RAT[ri][1]; size(); draw(); };
  c.addEventListener('pointerdown',function(e){ drag={x:e.clientX-off.x,y:e.clientY-off.y}; c.setPointerCapture(e.pointerId); c.style.cursor='grabbing'; });
  c.addEventListener('pointermove',function(e){ if(!drag)return; off={x:e.clientX-drag.x,y:e.clientY-drag.y}; draw(); });
  c.addEventListener('pointerup',function(){ drag=null; c.style.cursor='grab'; });
  document.getElementById('dl').onclick=function(){
    var big=document.createElement('canvas'); var k=3;
    big.width=c.width*k; big.height=c.height*k;
    var bx=big.getContext('2d'); bx.scale(k,k);
    var old=ctx; ctx=bx; draw(); ctx=old; draw();
    big.toBlob(function(bl){
      var u=URL.createObjectURL(bl); var a=document.createElement('a');
      a.href=u; a.download='photo-vrm-'+Date.now()+'.jpg'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(u); },20000);
    },'image/jpeg',0.92);
  };
})();
<\/script></body>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 120000);
  }

  // ══ DÉPÔT ASSISTÉ : le formulaire de nouvelle annonce, pré-rempli ═══════════
  // Tu choisis l'annonce à recréer dans le coffre ; sur la page de dépôt, le
  // panneau remplit titre, description et prix. Tu relis, tu ajoutes les photos
  // (préparées juste à côté) et **c'est toi qui cliques sur Publier**.
  // ⚠️ Aucune publication automatique — même principe que l'assistant Leboncoin
  //    déjà présent dans cette extension.
  // Le remplissage passe par le setter natif + les événements `input`/`change` :
  // sans ça, React ne « voit » pas la valeur et le champ se vide à la validation.
  const surPageDepot = () => /\/items\/(new|upload)/.test(location.pathname);
  function remplirChamp(el, val) {
    if (!el) return false;
    try {
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (_) { return false; }
  }
  function champVinted(motifs) {
    const els = Array.from(document.querySelectorAll('input, textarea'));
    for (const m of motifs) {
      for (const el of els) {
        if (el.type === 'hidden' || el.disabled) continue;
        const foin = `${el.name || ''} ${el.id || ''} ${el.getAttribute('aria-label') || ''} ${el.placeholder || ''} ${el.getAttribute('data-testid') || ''}`.toLowerCase();
        if (m.test(foin)) return el;
      }
    }
    return null;
  }
  function depotBandeau() {
    if (!surPageDepot()) return '';
    let d = null;
    try { d = JSON.parse(readLS('vrm_depot', 'null')); } catch (_) {}
    if (!d || !d.title) return '';
    return `<div class="vrm-card" style="margin-bottom:8px;padding:9px;background:#eefaf3;border-color:#bfe6d3">
      <div style="font-weight:800;font-size:12.5px;color:#0f6b4f">Annonce prête à recréer</div>
      <div class="vrm-m" style="font-size:11px;margin:3px 0 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.title)}${d.price != null ? ` · ${fmt(d.price)}` : ''}</div>
      <button id="vrm-depot-fill" style="width:100%;border:none;background:#0f6b4f;color:#fff;border-radius:9px;padding:10px;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer">✍️ Remplir le formulaire</button>
      <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
        <button class="vrm-copy-line" data-c="${esc(d.title)}" style="flex:1 1 90px;border:1px solid #0f172a;background:#fff;color:#0f172a;border-radius:9px;padding:6px;font:inherit;font-weight:700;font-size:11px;cursor:pointer">📋 Titre</button>
        ${d.desc ? `<button class="vrm-copy-line" data-c="${esc(d.desc)}" style="flex:1 1 90px;border:1px solid #0f172a;background:#fff;color:#0f172a;border-radius:9px;padding:6px;font:inherit;font-weight:700;font-size:11px;cursor:pointer">📋 Description</button>` : ''}
        ${d.price != null ? `<button class="vrm-copy-line" data-c="${esc(String(d.price))}" style="flex:1 1 90px;border:1px solid #0f172a;background:#fff;color:#0f172a;border-radius:9px;padding:6px;font:inherit;font-weight:700;font-size:11px;cursor:pointer">📋 Prix</button>` : ''}
      </div>
      <div class="vrm-m" style="font-size:10.5px;margin-top:6px">Marque, taille et catégorie restent à choisir dans les menus de Vinted${d.brand || d.size ? ` — c'était <b>${esc([d.brand, d.size].filter(Boolean).join(' · '))}</b>` : ''}. <b>C'est toi qui publies.</b></div>
    </div>`;
  }

  // ── PRÉPARER LES PHOTOS D'UNE ANNONCE ───────────────────────────────────────
  // Le vrai temps perdu quand on republie, ce n'est pas les clics : c'est
  // récupérer chaque image, la recadrer, la renommer, puis la redéposer.
  // Ici : un bouton, toutes les photos de la paire sortent recadrées au format
  // portrait de Vinted (3:4), numérotées dans l'ordre, prêtes à glisser.
  // ⚠️ Tout se passe CHEZ TOI : on lit les images (comme le ferait la page) et
  //    on les redessine dans un canvas. **Aucune requête vers l'API Vinted**,
  //    donc rien qui puisse ressembler à de l'automatisation.
  // Le recadrage 3:4 « couvre » le cadre (pas de bandes blanches) et sort en
  // 1200×1600, la taille que Vinted accepte sans recompresser bêtement.
  async function preparerPhotos(photos, nomBase, btn) {
    const total = (photos || []).length;
    if (!total) return;
    const dire = (t) => { if (btn) btn.innerHTML = t; };
    let ok = 0;
    for (let i = 0; i < total; i++) {
      dire(`⏳ photo ${i + 1}/${total}…`);
      try {
        const r = await new Promise(res => chrome.runtime.sendMessage(
          { from: 'cancale-vpanel', action: 'photoBytes', url: photos[i] }, res));
        if (!r || !r.ok || !r.dataUrl) continue;
        const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = r.dataUrl; });
        const W = 1200, H = 1600;
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
        const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);   // couvre le cadre
        const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        x.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
        const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.92));
        if (!blob) continue;
        const u = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = u; a.download = `${nomBase}-${String(i + 1).padStart(2, '0')}.jpg`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => { try { URL.revokeObjectURL(u); } catch (_) {} }, 20000);
        ok += 1;
        await new Promise(res => setTimeout(res, 250));   // laisse le navigateur enregistrer
      } catch (_) { /* une photo ratée n'arrête pas les autres */ }
    }
    dire(ok === total ? `✓ ${ok} photos prêtes` : `✓ ${ok}/${total} (les autres ont échoué)`);
  }

  function wireCoffre() {
    panel.querySelectorAll('.vrm-photo-edit').forEach(b => {
      b.onclick = () => {
        const avant = b.textContent;
        b.disabled = true; b.textContent = '⏳';
        chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'photoBytes', url: b.dataset.u }, (r) => {
          b.disabled = false; b.textContent = avant;
          if (r && r.ok && r.dataUrl) ouvrirEditeurPhoto(r.dataUrl, b.dataset.t || '');
          else { b.textContent = '❌ ' + ((r && r.error) || 'échec'); setTimeout(() => { try { b.textContent = avant; } catch (_) {} }, 2500); }
        });
      };
    });
    const s = panel.querySelector('#vrm-coffre-search');
    if (s) s.oninput = () => { coffreQuery = s.value; render(); setTimeout(() => { const n = panel.querySelector('#vrm-coffre-search'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 0); };
    panel.querySelectorAll('.vrm-coffre-row').forEach(r => { r.onclick = () => { coffreOuvert = r.dataset.id; render(); }; });
    const back = panel.querySelector('#vrm-coffre-back'); if (back) back.onclick = () => { coffreOuvert = null; render(); };
    panel.querySelectorAll('.vrm-depot-go').forEach(b => {
      b.onclick = () => {
        const c = (coffre || []).find(x => String(x.id) === String(b.dataset.id));
        if (!c) return;
        writeLS('vrm_depot', JSON.stringify({ title: c.title, desc: c.desc, price: c.price, brand: c.brand, size: c.size, etat: c.etat }));
        window.open('https://www.vinted.fr/items/new', '_blank', 'noopener');
        b.textContent = '✓ ouvert — le panneau remplira le formulaire';
      };
    });
    const df = panel.querySelector('#vrm-depot-fill');
    if (df) df.onclick = () => {
      let d = null; try { d = JSON.parse(readLS('vrm_depot', 'null')); } catch (_) {}
      if (!d) return;
      let n = 0;
      if (d.title && remplirChamp(champVinted([/titre|title/]), d.title)) n++;
      if (d.desc && remplirChamp(champVinted([/description|d[ée]cris/]), d.desc)) n++;
      if (d.price != null && remplirChamp(champVinted([/prix|price/]), String(d.price))) n++;
      df.textContent = n ? `✓ ${n} champ${n > 1 ? 's' : ''} rempli${n > 1 ? 's' : ''} — relis et publie` : '❌ champs introuvables — utilise les boutons copier';
      setTimeout(() => { try { df.textContent = '✍️ Remplir le formulaire'; } catch (_) {} }, 4000);
    };
    wirePhotosEtDepot();   // « 📦 Préparer les photos » — même bouton qu'en Republier
    panel.querySelectorAll('.vrm-coffre-photos').forEach(b => {
      b.onclick = () => {
        const c = (coffre || []).find(x => String(x.id) === String(b.dataset.id));
        if (!c) return;
        // Une seule page qui les montre toutes : tu fais « enregistrer » sur
        // chacune. On n'ouvre pas 8 onglets d'un coup.
        const html = `<!doctype html><meta charset="utf-8"><title>${esc(c.title || 'Photos')}</title>`
          + `<body style="font-family:system-ui;margin:16px;background:#f6f8fa"><h2 style="font-size:16px">${esc(c.title || '')}</h2>`
          + `<p style="color:#556;font-size:13px">Clic droit → « Enregistrer l'image sous… » sur chaque photo.</p>`
          + (c.photos || []).map(u => `<img src="${esc(u)}" style="max-width:340px;border-radius:10px;margin:0 8px 8px 0;vertical-align:top">`).join('')
          + `</body>`;
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        window.open(url, '_blank', 'noopener');
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 60000);
      };
    });
    // Sauvegarde des numéros : le N° est ce qui est ÉCRIT sur la boîte, il ne se
    // recalcule pas. Un fichier chez toi, c'est le seul vrai filet.
    const sn = panel.querySelector('#vrm-save-nums');
    if (sn) sn.onclick = () => {
      const avant = sn.innerHTML;
      sn.disabled = true; sn.textContent = '⏳';
      chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'sauvegardeNumeros' }, (r) => {
        sn.disabled = false;
        if (!r || !r.ok) { sn.textContent = '❌ échec'; setTimeout(() => { try { sn.innerHTML = avant; } catch (_) {} }, 2500); return; }
        const n = Object.keys((r.data && r.data.vinted_annonce_numeros) || {}).length;
        const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 1)], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url; a.download = `numeros-vrm-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 30000);
        sn.textContent = `✓ ${n} N° sauvegardés`;
        setTimeout(() => { try { sn.innerHTML = avant; } catch (_) {} }, 2500);
      });
    };
    const ex = panel.querySelector('#vrm-coffre-export');
    if (ex) ex.onclick = () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(coffre || [], null, 1)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = `coffre-vrm-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 30000);
      ex.textContent = '✓ Sauvegardé';
      setTimeout(() => { try { render(); } catch (_) {} }, 1500);
    };
  }

  // ── ANNONCES EN DOUBLE (republication à moitié faite) ───────────────────────
  // Julien : « quand je republie, l'ancienne doit disparaître, c'est impératif ».
  // Quand la recréation passe mais que la suppression n'a pas été faite, deux
  // annonces identiques restent en ligne. Deux conséquences, la seconde grave :
  //   • elles se font concurrence et se partagent les vues ;
  //   • surtout, **deux paires portent le même numéro** → au moment d'expédier,
  //     c'est la mauvaise chaussure qui part (§19, le risque n°1).
  // ⚠️ On DÉTECTE et on t'emmène dessus ; la suppression se fait sur Vinted,
  //    par toi. Supprimer par script est irréversible et sans filet : une
  //    détection un peu trop large effacerait une annonce vivante.
  //    On ne signale donc QUE des titres STRICTEMENT identiques, même compte.
  function doublonsBloc() {
    const on = (DATA && DATA.online) || [];
    if (on.length < 2) return '';
    const normT = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
    // Deux façons d'être en double, et la première est la plus grave :
    //   • MÊME NUMÉRO → deux paires dans la même boîte. Certain, et ça marche
    //     même si tu as retouché le titre en republiant (le cas que la
    //     détection par titre ratait).
    //   • MÊME TITRE sur le même compte → la republication classique.
    const groupes = new Map();   // clé de paire → { raisons:Set, items:[] }
    const ajoute = (liste, raison) => {
      const cle = liste.map(o => o.id).sort().join('+');
      const g = groupes.get(cle) || { raisons: new Set(), items: liste };
      g.raisons.add(raison); groupes.set(cle, g);
    };
    const parNum = new Map(), parTitre = new Map();
    for (const o of on) {
      const n = String(o.numero || '').trim();
      if (n) { if (!parNum.has(n)) parNum.set(n, []); parNum.get(n).push(o); }
      const t = normT(o.title);
      if (t) { const k = `${o.uid || ''}|${t}`; if (!parTitre.has(k)) parTitre.set(k, []); parTitre.get(k).push(o); }
    }
    for (const [n, g] of parNum) if (g.length > 1) ajoute(g, `même N°${n}`);
    for (const [, g] of parTitre) if (g.length > 1) ajoute(g, 'titre identique');
    if (!groupes.size) return '';
    // LAQUELLE GARDER : celle qui travaille le plus (favoris, puis vues), et à
    // égalité la plus récente. Supprimer celle qui a l'engagement serait
    // absurde — c'est justement l'erreur qu'on veut t'éviter.
    const score = (o) => (Number(o.favs) || 0) * 1000 + (Number(o.views) || 0) - (Number(o.ageDays) || 0) / 1000;
    const detail = (o) => [o.numero ? `N°${o.numero}` : null,
                           o.ageDays != null ? `${o.ageDays} j` : null,
                           o.views != null ? `👁 ${o.views}` : null,
                           o.favs ? `❤️ ${o.favs}` : null].filter(Boolean).join(' · ');
    const n = [...groupes.values()].reduce((s, g) => s + g.items.length - 1, 0);
    const bloc = (g) => {
      const l = g.items.slice().sort((a, b) => score(b) - score(a));
      const garde = l[0];
      return `<div style="margin-top:8px;border-top:1px solid #eceff3;padding-top:8px">
        <div style="font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(garde.title || '')}</div>
        <div class="vrm-m" style="font-size:10.5px;margin:2px 0 6px;color:#a33">${[...g.raisons].join(' · ')}</div>
        ${l.map((o, i) => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:5px">
          ${pairThumb(o, 34)}
          <div style="flex:1 1 100px;min-width:0">
            <div style="font-size:11.5px;font-weight:${i === 0 ? 700 : 500}">${i === 0 ? '✅ à garder' : '🗑️ à supprimer'}</div>
            <div class="vrm-m" style="font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(detail(o) || '—')}</div>
          </div>
          <a href="${esc(o.url || '#')}" target="_blank" rel="noreferrer" style="flex-shrink:0;text-decoration:none;border:1px solid ${i === 0 ? '#dde' : '#a33'};background:${i === 0 ? '#fff' : '#a33'};color:${i === 0 ? '#334' : '#fff'};border-radius:9px;padding:6px 10px;font-weight:700;font-size:11px">${i === 0 ? 'Voir ↗' : 'Supprimer ↗'}</a>
        </div>`).join('')}
      </div>`;
    };
    return `<div class="vrm-card" style="margin-bottom:8px;padding:9px;background:#fdf0f0;border-color:#e9c3c3">
      <div style="font-weight:800;font-size:12.5px;color:#a33;display:flex;align-items:center;gap:6px">${svgi('alert-triangle', 14)} ${n} annonce${n > 1 ? 's' : ''} à retirer</div>
      <div class="vrm-m" style="font-size:11px;margin-top:3px">Deux annonces pour la même paire : elles se partagent les vues, et si elles portent le même numéro, c'est la <b>mauvaise chaussure qui part à l'expédition</b>. On te dit laquelle garder — celle qui a le plus d'engagement — et laquelle retirer sur Vinted.</div>
      ${[...groupes.values()].slice(0, 6).map(bloc).join('')}
    </div>`;
  }

  // ── LE N° À REMETTRE APRÈS UNE REPUBLICATION ────────────────────────────────
  // Republier crée une nouvelle annonce : la paire perd son numéro, et ce numéro
  // redevient « libre » alors que la chaussure occupe toujours sa boîte. Tant
  // qu'on ne l'a pas remis, deux paires peuvent se retrouver dans la même case.
  // Le panneau ne l'écrit pas lui-même (le numéro vit dans l'app) : il te dit
  // exactement quoi remettre, et t'ouvre l'écran au bon endroit.
  function renumBandeau() {
    const list = (DATA && DATA.renumSuggest) || [];
    if (!list.length) return '';
    const ligne = (r) => `<div style="display:flex;gap:8px;align-items:center;margin-top:6px">
      ${r.photo ? `<img src="${esc(r.photo)}" alt="" style="width:34px;height:34px;border-radius:8px;object-fit:cover;flex-shrink:0">` : ''}
      <div style="flex:1 1 120px;min-width:0">
        <div style="font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.title || 'Paire republiée')}</div>
        <div class="vrm-m" style="font-size:11px">remets le <b>N°${esc(r.numero)}</b> sur la nouvelle annonce</div>
      </div>
      <a href="${APP_URL}/?tab=cat_annonces" target="vrm_app" rel="noreferrer" style="flex-shrink:0;text-decoration:none;border:1px solid #9a5b16;background:#9a5b16;color:#fff;border-radius:9px;padding:6px 10px;font-weight:800;font-size:11.5px">Ouvrir ↗</a>
    </div>`;
    return `<div class="vrm-card" style="margin-bottom:8px;padding:9px">
      <div style="font-weight:800;font-size:12.5px;display:flex;align-items:center;gap:6px">${svgi('hash', 14)} ${list.length} paire${list.length > 1 ? 's' : ''} republiée${list.length > 1 ? 's' : ''} sans son N°</div>
      <div class="vrm-m" style="font-size:11px;margin-top:3px">Republier recrée l'annonce, donc le numéro se détache. <b>L'app le remet toute seule</b> à sa prochaine ouverture (elle ne le fait que si la correspondance est certaine). Ouvre-la si tu veux vérifier.</div>
      ${list.slice(0, 6).map(ligne).join('')}
    </div>`;
  }

  // ── NE SABORDE PAS UNE PAIRE QUI TRAVAILLE ──────────────────────────────────
  // Republier = supprimer + recréer : l'annonce repart de ZÉRO. Elle perd ses
  // favoris et ses vues, et les acheteurs qui l'avaient mise de côté ne la
  // retrouvent plus. Sur une paire qui a de l'engagement, c'est une perte sèche.
  // ⚠️ On ne l'INTERDIT pas — c'est ta boutique. On te met le chiffre sous les
  //    yeux avant, parce qu'une fois supprimée, on ne revient pas en arrière.
  function alerteMomentum(o) {
    const favs = Number(o.favs) || 0, vues = Number(o.views) || 0;
    if (favs < 2 && vues < 40) return '';
    const quoi = [];
    if (favs) quoi.push(`<b>${favs}</b> favori${favs > 1 ? 's' : ''}`);
    if (vues) quoi.push(`<b>${vues}</b> vue${vues > 1 ? 's' : ''}`);
    return `<div class="vrm-card" style="margin-top:8px;padding:9px;background:#fff6ec;border-color:#ffd7a8">
      <div style="font-weight:800;font-size:12.5px;color:#9a5b16">Celle-ci travaille déjà — ${quoi.join(' et ')}</div>
      <div class="vrm-m" style="font-size:11px;margin-top:3px">Republier la remet à zéro : ${favs ? `les ${favs} personnes qui l'ont mise en favori la perdent de vue, et ` : ''}le compteur repart de rien.${favs >= 2 ? ` <b>Propose-leur plutôt une remise</b> (onglet Favoris) : ça déclenche la vente sans rien perdre.` : ` Si elle est très vue mais peu mise en favori, c'est le <b>prix</b> qu'il faut baisser, pas l'annonce qu'il faut refaire.`}</div>
    </div>`;
  }

  // ── LE GABARIT DE DESCRIPTION ───────────────────────────────────────────────
  // C'est le « template » que vendent les autres extensions, et c'est la seule
  // de leurs fonctions qui ne repose sur aucune automatisation risquée : ton
  // texte type, écrit une fois, rempli avec les VRAIES caractéristiques de la
  // paire. Variables reconnues : {titre} {marque} {taille} {etat} {prix}.
  let gabarit = null, gabaritBusy = false;
  const appliqueGabarit = (g, o) => String(g || '')
    .replace(/\{titre\}/gi, o.title || '')
    .replace(/\{marque\}/gi, o.brand || '')
    .replace(/\{taille\}/gi, o.size || extraireTailleTxt(o.title) || '')
    .replace(/\{etat\}/gi, o.etat || o.status || '')
    .replace(/\{prix\}/gi, o.price != null ? String(o.price) : '');
  const extraireTailleTxt = (t) => { const m = /\b(\d{2}(?:[.,]5)?)\b/.exec(String(t || '')); return m ? m[1] : ''; };
  function gabaritBloc(o) {
    if (gabarit == null) {
      if (!gabaritBusy) { gabaritBusy = true; chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'gabarit' }, (r) => { gabaritBusy = false; gabarit = (r && r.texte) || ''; render(); }); }
      return '';
    }
    const rendu = gabarit.trim() ? appliqueGabarit(gabarit, o || {}) : '';
    return `<div class="vrm-card" style="margin-top:8px;padding:9px">
      <div style="font-weight:800;font-size:12.5px;margin-bottom:4px">Mon gabarit de description</div>
      <div class="vrm-m" style="font-size:10.5px;margin-bottom:5px">Variables : <code>{titre}</code> <code>{marque}</code> <code>{taille}</code> <code>{etat}</code> <code>{prix}</code></div>
      <textarea id="vrm-gab" rows="3" placeholder="👟 {titre}&#10;&#10;📏 Taille {taille}&#10;{etat}&#10;&#10;Expédition rapide ☺️" style="width:100%;box-sizing:border-box;border:1px solid #d7dde3;border-radius:9px;padding:8px 10px;font:inherit;font-size:12.5px;resize:vertical">${esc(gabarit)}</textarea>
      ${rendu ? `<div class="vrm-m" style="font-size:11px;white-space:pre-wrap;background:#f7f9fb;border-radius:8px;padding:7px;margin-top:6px">${esc(rendu)}</div>` : ''}
      <div style="display:flex;gap:6px;margin-top:6px">
        <button id="vrm-gab-save" style="flex:1 1 100px;border:1px solid #0f172a;background:#fff;color:#0f172a;border-radius:9px;padding:7px;font:inherit;font-weight:700;font-size:11.5px;cursor:pointer">Enregistrer</button>
        ${rendu ? `<button class="vrm-copy-line" data-c="${esc(rendu)}" style="flex:1 1 100px;border:none;background:#0f172a;color:#fff;border-radius:9px;padding:7px;font:inherit;font-weight:800;font-size:11.5px;cursor:pointer">📋 Copier pour cette paire</button>` : ''}
      </div>
    </div>`;
  }

  // ── LE KIT DE REPUBLICATION ─────────────────────────────────────────────────
  // Chez Vinted, « republier » n'est PAS un bouton « remonter » : ça n'existe
  // pas. Vérifié dans les requêtes captées — c'est `POST /items/{id}/delete`
  // puis `POST /item_upload/items` avec TOUT le contenu à refournir. Donc quand
  // tu republies, tu dois retaper le titre et la description.
  // Ce bloc te les rend prêts à coller. Sans la fiche captée, on n'a que la
  // longueur du texte, pas le texte : on te le dit et on va la chercher.
  function kitRepub(o) {
    if (!o) return '';
    const bouton = (lbl, txt) => `<button class="vrm-copy-line" data-c="${esc(txt)}" style="flex:1 1 110px;border:1px solid #0f172a;background:#fff;color:#0f172a;border-radius:9px;padding:7px 9px;font:inherit;font-weight:700;font-size:11.5px;cursor:pointer">${lbl}</button>`;
    if (!o.desc) {
      return `<div class="vrm-card" style="margin-top:8px;padding:9px;background:#fff6ec;border-color:#ffd7a8">
        <div style="font-weight:800;font-size:12px;color:#9a5b16;margin-bottom:4px">Le texte de l'annonce n'est pas encore capté</div>
        <div class="vrm-m" style="font-size:11px;margin-bottom:7px">Republier chez Vinted, c'est supprimer puis recréer : il faut refournir le titre et la description. Je vais les chercher pour toi.</div>
        <button class="vrm-capt-annonce" data-id="${esc(o.id)}" data-uid="${esc(o.uid || '')}" style="width:100%;border:none;background:#9a5b16;color:#fff;border-radius:9px;padding:9px;font:inherit;font-weight:800;font-size:12px;cursor:pointer">📥 Récupérer le texte de cette annonce</button>
      </div>`;
    }
    const apercu = o.desc.length > 220 ? o.desc.slice(0, 220) + '…' : o.desc;
    return `<div class="vrm-card" style="margin-top:8px;padding:9px">
      <div style="font-weight:800;font-size:12px;margin-bottom:5px">Prêt à recoller</div>
      <div class="vrm-m" style="font-size:11px;white-space:pre-wrap;max-height:110px;overflow:auto;background:#f7f9fb;border-radius:8px;padding:7px;margin-bottom:7px">${esc(apercu)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${bouton('📋 Titre', o.title || '')}
        ${bouton('📋 Description', o.desc)}
        ${o.price != null ? bouton('📋 Prix', String(o.price)) : ''}
      </div>
    </div>`;
  }

  // ── LES 4 ÉTAPES D'UNE REPUBLICATION, SUR LA MÊME CARTE ─────────────────────
  // Republier chez Vinted = supprimer + recréer (§46). Ça demande quatre gestes,
  // et jusqu'ici ils étaient éparpillés : le texte ici, les photos dans le
  // Coffre, le formulaire ailleurs, et la suppression de l'ancienne nulle part
  // — d'où les annonces en double que la 5.05/5.06 doit rattraper après coup.
  // Tout est maintenant sur la carte de la paire en cours, dans l'ordre.
  const coffrePour = (o) => (coffre || []).find(c => String(c.id) === String(o && o.id)) || null;
  const nomFichier = (t) => (String(t || 'annonce').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'annonce');
  function etapeRepub(n, titre, corps, faite) {
    return `<div class="vrm-card" style="margin-top:8px;padding:9px">
      <div style="display:flex;gap:7px;align-items:center;margin-bottom:6px">
        <span style="flex-shrink:0;width:19px;height:19px;border-radius:999px;background:${faite ? '#0f6b4f' : '#0f172a'};color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center">${faite ? '✓' : n}</span>
        <span style="font-weight:800;font-size:12.5px">${titre}</span>
      </div>
      ${corps}
    </div>`;
  }
  // Étape 2 — LES PHOTOS. C'est le vrai goulot (§5.03) : Vinted refuse un
  // fichier identique, donc chaque image doit être recomposée. Le bouton était
  // enfoui dans le Coffre ; il est maintenant là où on republie.
  // ⚠️ Rapprochement par ID d'annonce UNIQUEMENT (identité certaine, §24) :
  //    jamais par titre — préparer les photos d'une AUTRE paire serait pire que
  //    de ne rien proposer.
  function photosRepub(o) {
    if (coffre == null) {
      if (!coffreBusy) { coffreBusy = true; chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'coffre' }, (r) => { coffreBusy = false; coffre = (r && r.ok && r.items) || []; render(); }); }
      return `<div class="vrm-m" style="font-size:11px">Ouverture du coffre…</div>`;
    }
    const c = coffrePour(o);
    const n = ((c && c.photos) || []).length;
    if (!n) {
      return `<div class="vrm-m" style="font-size:11px">Les photos de cette paire ne sont pas encore au coffre. Elles y arrivent toutes seules quand ton dressing se charge — repasse sur ta boutique Vinted, ou enregistre-les depuis l'annonce.</div>`;
    }
    return `<div class="vrm-m" style="font-size:11px;margin-bottom:6px">Vinted refuse un fichier identique quand tu recrées : les ${n} photos ressortent <b>recadrées en 1200×1600</b>, numérotées dans l'ordre, prêtes à glisser.</div>
      <button class="vrm-prep-photos" data-id="${esc(c.id)}" style="width:100%;border:none;background:#0f6b4f;color:#fff;border-radius:9px;padding:10px;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer">📦 Préparer les ${n} photo${n > 1 ? 's' : ''}</button>`;
  }
  // Étape 3 — LE FORMULAIRE. Le contenu part dans `vrm_depot` et le panneau le
  // pose dans les champs sur /items/new (§5.04). Le coffre prime (il a la
  // description) ; sinon on repart de ce qu'on connaît de l'annonce en ligne.
  function recreerRepub(o) {
    const c = coffrePour(o);
    const desc = (c && c.desc) || o.desc || '';
    return `<div class="vrm-m" style="font-size:11px;margin-bottom:6px">Ouvre le dépôt avec ${desc ? 'le titre, la description et le prix' : 'le titre et le prix'} déjà prêts. Marque, taille et catégorie restent à choisir dans les menus Vinted — <b>et c'est toi qui publies</b>.</div>
      <button class="vrm-depot-repub" data-id="${esc(o.id)}" style="width:100%;border:1px solid #0f6b4f;background:#fff;color:#0f6b4f;border-radius:9px;padding:10px;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer">✍️ Recréer l'annonce sur Vinted ↗</button>`;
  }
  // Étape 4 — SUPPRIMER L'ANCIENNE. Julien : « quand je republie, l'ancienne
  // doit être supprimée, c'est impératif » — sinon deux annonces portent le même
  // N° et la mauvaise chaussure part à l'expédition (§19, §5.05).
  // ⚠️ La suppression reste SON clic sur Vinted : elle est irréversible et sans
  //    confirmation côté Vinted. On la rappelle au bon moment, on ne la fait pas.
  function supprimerRepub(o) {
    return `<div class="vrm-m" style="font-size:11px;margin-bottom:6px">Sans ça, deux annonces identiques restent en ligne <b>avec le même N°${o.numero ? ` (N°${esc(o.numero)})` : ''}</b> : elles se partagent les vues, et au moment d'expédier tu ne sais plus laquelle est dans la boîte.</div>
      ${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener" style="display:block;text-align:center;border:1px solid #b42318;background:#fff;color:#b42318;border-radius:9px;padding:10px;font-weight:800;font-size:12.5px;text-decoration:none">Ouvrir l'ancienne pour la supprimer ↗</a>` : ''}`;
  }

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
            <button class="vrm-go" data-act="stop" style="margin-top:10px;border:none;background:#D2401E;color:#fff;border-radius:10px;padding:8px 14px;font-weight:800;cursor:pointer">Fermer la file</button>
          </div>`;
      }
      const o = (DATA.byId && DATA.byId[repubRun.queue[done]]) || null;
      if (!o) { repubRun.idx++; return renderRepublier(); }
      const pct = Math.round(done / total * 100);
      return `
        <div class="vrm-m" style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:4px"><span>Annonce <b>${done + 1}</b> / ${total}</span><span style="opacity:.7">${done} republiée${done > 1 ? 's' : ''}</span></div>
        <div style="height:7px;border-radius:999px;background:#e6eaee;overflow:hidden;margin-bottom:8px"><div style="height:100%;width:${pct}%;border-radius:999px;background:#D2401E;transition:width .3s"></div></div>
        <div class="vrm-m" style="margin-bottom:8px">Les 4 gestes d'une republication, dans l'ordre. <b>Tout se fait depuis cette carte.</b></div>
        ${card(o, `${o.numero ? `<div class="vrm-m" style="margin-top:3px">N°${esc(o.numero)}${o.cell ? ` · 🏠 case ${esc(o.cell)}` : ''}</div>` : ''}${marketNote(o)}<div style="margin-top:7px">${editLink(o.id)}</div>`)}
        ${alerteMomentum(o)}
        ${etapeRepub(1, 'Récupérer le texte', `${kitRepub(o)}${gabaritBloc(o)}`)}
        ${etapeRepub(2, 'Préparer les photos', photosRepub(o))}
        ${etapeRepub(3, 'Recréer l\'annonce', recreerRepub(o))}
        ${etapeRepub(4, 'Supprimer l\'ancienne', supprimerRepub(o))}
        <div style="display:flex;gap:6px;margin-top:10px">
          <button class="vrm-go" data-act="done" style="flex:2;border:none;background:${repubArm === String(o.id) ? '#b42318' : '#0f6b4f'};color:#fff;border-radius:10px;padding:9px;font-weight:800;cursor:pointer">${repubArm === String(o.id) ? 'L\'ancienne est supprimée ? Confirmer' : '✓ Republiée'}</button>
          <button class="vrm-go" data-act="next" style="flex:1;border:1px solid #dde;background:#fff;color:#556;border-radius:10px;padding:9px;font-weight:700;cursor:pointer">Passer</button>
        </div>
        <div style="text-align:center;margin-top:8px"><button class="vrm-go" data-act="stop" style="border:none;background:transparent;color:#889;font-size:11.5px;cursor:pointer;text-decoration:underline">Arrêter</button></div>`;
    }
    // Mode sélection : la liste avec des cases à cocher.
    // Priorité de republication : on remonte en haut ce qui en a le PLUS besoin —
    // dort (😴), à relancer (💡), trop cher vs comparables (📊). Mêmes signaux que
    // les onglets/Ma journée → aucune divergence. Chaque ligne dit POURQUOI.
    const sleepIds = new Set(((DATA && DATA.sleeping) || []).map(o => String(o.id)));
    const relIds = new Set(((DATA && DATA.relance) || []).map(o => String(o.id)));
    const overOf = (o) => o.peer != null && o.price != null && Number(o.price) > Number(o.peer) * 1.15;
    // ── PRÊTE À REPUBLIER ? ────────────────────────────────────────────────
    // Republier = supprimer + recréer : sans le TEXTE et sans les PHOTOS, il
    // faut tout retaper. On dit donc, paire par paire, ce qui est déjà en
    // magasin — au lieu de le découvrir une fois lancé dans le défilement.
    if (coffre == null && !coffreBusy) {
      coffreBusy = true;
      chrome.runtime.sendMessage({ from: 'cancale-vpanel', action: 'coffre' }, (r) => { coffreBusy = false; coffre = (r && r.ok && r.items) || []; render(); });
    }
    const photosDe = (o) => { const c = coffrePour(o); return c ? (c.photos || []).length : 0; };
    // Combien l'annonce en a vraiment (coffre, sinon le compteur du dressing) :
    // dire « prête · 📸1 » pour une annonce qui a six photos, c'est faire
    // découvrir le problème une fois lancé — exactement ce qu'on veut éviter.
    const photosReelles = (o) => { const c = coffrePour(o); return Number((c && c.nPhotos) || o.nPhotosVinted) || 0; };
    const photosCompletes = (o) => { const n = photosDe(o), r = photosReelles(o); return n > 0 && (!r || n >= r); };
    const pretes = list.filter(o => o.desc && photosCompletes(o)).length;
    const reasonsOf = (o) => {
      const r = [];
      if (isRepubRecent(o.id)) r.push({ t: '✓ republiée', c: '#0f6b4f', bg: '#eefaf3', bd: '#bfe6d3' });
      const np = photosDe(o), nr = photosReelles(o), okPh = photosCompletes(o);
      const VERT = { c: '#0f6b4f', bg: '#eefaf3', bd: '#bfe6d3' }, ORANGE = { c: '#9a5b16', bg: '#fff6ec', bd: '#ffd7a8' };
      if (o.desc && okPh) r.push(Object.assign({ t: `prête · ✍️ 📸${np}` }, VERT));
      else if (!o.desc && !np) r.push(Object.assign({ t: 'texte + photos à capter' }, ORANGE));
      else if (!o.desc && !okPh) r.push(Object.assign({ t: `texte + ${nr ? `${np}/${nr} photos` : 'photos'}` }, ORANGE));
      else if (!o.desc) r.push(Object.assign({ t: 'texte à capter' }, ORANGE));
      else r.push(Object.assign({ t: nr ? `📸 ${np}/${nr} photos` : 'photos à capter' }, ORANGE));
      if (sleepIds.has(String(o.id))) r.push({ t: `😴 ${o.ageDays} j`, c: '#2b5b9a', bg: '#eef4ff', bd: '#c9dbf7' });
      if (relIds.has(String(o.id))) r.push({ t: '💡 à relancer', c: '#9a5b16', bg: '#fff6ec', bd: '#ffd7a8' });
      if (overOf(o)) r.push({ t: '📊 trop cher', c: '#9a5b16', bg: '#fff6ec', bd: '#ffd7a8' });
      return r;
    };
    // Déjà republiée récemment → tout en bas (gros malus), pour que tu voies
    // d'abord ce qui reste à faire. Sinon priorité relance/trop cher/dort.
    const prio = (o) => (isRepubRecent(o.id) ? -1e6 : 0) + (sleepIds.has(String(o.id)) ? (o.ageDays || 30) : 0) + (relIds.has(String(o.id)) ? 200 : 0) + (overOf(o) ? 150 : 0);
    const ordered = list.slice().sort((a, b) => prio(b) - prio(a));
    const nDone = list.filter(o => isRepubRecent(o.id)).length;
    const rows = ordered.slice(0, 200).map(o => {
      const reasons = reasonsOf(o);
      const badges = reasons.map(r => `<span style="display:inline-block;font-size:10px;font-weight:700;color:${r.c};background:${r.bg};border:1px solid ${r.bd};border-radius:999px;padding:1px 7px;margin-right:4px">${r.t}</span>`).join('');
      return `
      <label class="vrm-card vrm-repub-row" data-s="${esc(((o.numero != null ? 'n°' + o.numero + ' ' : '') + (o.title || '')).toLowerCase())}" style="display:flex;gap:9px;align-items:center;cursor:pointer;margin-bottom:6px;padding:8px">
        <input type="checkbox" class="vrm-chk" data-id="${esc(o.id)}" ${repubSel.has(o.id) ? 'checked' : ''} style="width:18px;height:18px;flex-shrink:0;accent-color:#D2401E">
        ${o.photo ? `<img src="${esc(o.photo)}" alt="" style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex-shrink:0;background:#eee">` : '<div style="width:38px;height:38px;border-radius:8px;background:#eee;flex-shrink:0"></div>'}
        <div style="flex:1;min-width:0">
          <div class="vrm-t">${o.numero ? `<span class="vrm-num">N°${esc(o.numero)}</span> ` : ''}${esc(o.title)}</div>
          <div class="vrm-m">${fmt(o.price)}${o.ageDays != null ? ` · ${o.ageDays} j` : ''}</div>
          ${badges ? `<div style="margin-top:3px">${badges}</div>` : ''}
        </div>
      </label>`;
    }).join('');
    // Ton créneau réel, calculé sur TES ventes (jamais un conseil générique).
    const mv = DATA && DATA.momentVente;
    const bandeauMoment = mv ? `<div class="vrm-card" style="margin-bottom:8px;padding:9px;background:#eefaf3;border-color:#bfe6d3">
        <div style="font-weight:800;font-size:12.5px;color:#0f6b4f">Tes paires partent surtout le <u>${esc(mv.jour)}</u>, ${esc(mv.creneau)}</div>
        <div class="vrm-m" style="font-size:11px;margin-top:2px">Sur ${mv.total} ventes datées : ${mv.nJour} un ${esc(mv.jour)}, ${mv.nCreneau} ${esc(mv.creneau)}. Republie juste avant ce créneau — ton annonce sera en haut quand les acheteurs regardent.</div>
      </div>` : '';
    return `
      ${doublonsBloc()}
      ${renumBandeau()}
      ${bandeauMoment}
      <div class="vrm-m" style="margin-bottom:8px">Coche les annonces à <b>remettre en avant</b>. Tu les republieras <b>une par une, toi-même</b> — aucune action automatique.</div>
      ${(() => {
        // Le vrai frein n'est pas de cocher : c'est d'avoir le texte et les
        // photos sous la main. On l'annonce avant de commencer.
        if (!list.length) return '';
        const manque = list.length - pretes;
        return `<div class="vrm-card" style="margin-bottom:8px;padding:9px;background:${pretes ? '#eefaf3' : '#fff6ec'};border-color:${pretes ? '#bfe6d3' : '#ffd7a8'}">
          <div style="font-weight:800;font-size:12.5px;color:${pretes ? '#0f6b4f' : '#9a5b16'}">${pretes} paire${pretes > 1 ? 's' : ''} prête${pretes > 1 ? 's' : ''} à republier${manque > 0 ? ` · ${manque} incomplète${manque > 1 ? 's' : ''}` : ''}</div>
          <div class="vrm-m" style="font-size:11px;margin-top:3px">« Prête » = son texte et ses photos sont au coffre, donc tout se recolle en un tap.${manque > 0 ? " Pour les autres : <b>ouvre l'annonce sur Vinted une fois</b>, le panneau capte le texte et les photos au passage." : ''}</div>
        </div>`;
      })()}
      ${nDone ? `<div class="vrm-m" style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;padding:6px 9px;border-radius:8px;background:#eefaf3;color:#0f6b4f;border:1px solid #bfe6d3"><span>✓ <b>${nDone}</b> republiée${nDone > 1 ? 's' : ''} récemment (rangées en bas)</span><button class="vrm-go" data-act="resetdone" style="border:none;background:transparent;color:#0f6b4f;font-size:11px;font-weight:700;cursor:pointer;text-decoration:underline;flex-shrink:0">Réinitialiser</button></div>` : ''}
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
      <div class="vrm-grid" style="margin-bottom:8px">${rows}</div>
      <button class="vrm-go" data-act="start" ${repubSel.size ? '' : 'disabled'} style="position:sticky;bottom:0;width:100%;border:none;background:${repubSel.size ? '#D2401E' : '#9bb'};color:#fff;border-radius:10px;padding:11px;font-weight:800;cursor:${repubSel.size ? 'pointer' : 'default'};box-shadow:0 -6px 14px rgba(0,0,0,.12)">Commencer (${repubSel.size})</button>`;
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
        else if (act === 'resetdone') { repubDone = {}; writeJSON('vrm_repub_done', repubDone); render(); }
        else if (act === 'start') { if (!repubSel.size) return; repubRun = { queue: list.filter(o => repubSel.has(o.id)).map(o => o.id), idx: 0 }; render(); }
        else if (act === 'stop') { repubRun = null; render(); }
        else if (act === 'open') { const o = DATA.byId[repubRun.queue[repubRun.idx]]; if (o && o.url) window.open(o.url, '_blank', 'noopener'); }
        else if (act === 'done') {
          // 1er clic = on ARME et on demande si l'ancienne est supprimée ;
          // 2e clic = on valide. Une paire marquée « republiée » alors que
          // l'ancienne est toujours en ligne, c'est le doublon de numéro.
          const id = repubRun && repubRun.queue[repubRun.idx];
          if (!id) return;
          if (repubArm !== String(id) || Date.now() - repubArmT > 8000) { repubArm = String(id); repubArmT = Date.now(); render(); return; }
          repubArm = null; markRepub(id); repubSel.delete(String(id)); repubRun.idx++; render();
        }
        else if (act === 'next') { repubArm = null; repubRun.idx++; render(); }
      };
    });
    wirePhotosEtDepot();
  }

  // Les étapes 2 et 3 réutilisent les boutons du Coffre (préparer les photos,
  // armer le dépôt) : une seule définition, câblée depuis les deux onglets.
  function wirePhotosEtDepot() {
    panel.querySelectorAll('.vrm-prep-photos').forEach(b => {
      b.onclick = () => {
        const c = (coffre || []).find(x => String(x.id) === String(b.dataset.id));
        if (!c || !(c.photos || []).length) return;
        b.disabled = true;
        preparerPhotos(c.photos, nomFichier(c.title), b).then(() => { setTimeout(() => { try { b.disabled = false; render(); } catch (_) {} }, 2500); });
      };
    });
    panel.querySelectorAll('.vrm-depot-repub').forEach(b => {
      b.onclick = () => {
        const o = (DATA && DATA.byId && DATA.byId[b.dataset.id]) || null;
        const c = (coffre || []).find(x => String(x.id) === String(b.dataset.id));
        if (!o && !c) return;
        // Le coffre prime (seul à porter la description) ; l'annonce en ligne
        // complète ce qui manque. Rien n'est inventé : que du déjà capté.
        writeLS('vrm_depot', JSON.stringify({
          title: (c && c.title) || (o && o.title) || '',
          desc: (c && c.desc) || (o && o.desc) || '',
          price: (c && c.price != null) ? c.price : (o ? o.price : null),
          brand: (c && c.brand) || (o && o.brand) || '',
          size: (c && c.size) || (o && o.size) || '',
          etat: (c && c.etat) || (o && o.etat) || '',
        }));
        window.open('https://www.vinted.fr/items/new', '_blank', 'noopener');
        b.textContent = '✓ ouvert — le panneau remplira le formulaire';
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
        ouvrirSiNouveau();
      });
    } catch (_) { dataBusy = false; /* extension rechargée */ }
  }

  // ── LE PANNEAU S'OUVRE QUAND IL Y A UNE VENTE À TRAITER ─────────────────────
  // Julien : « je veux que l'extension s'ouvre dès que je reçois… et qu'elle me
  // dise quand j'ai vendu, si je veux générer les bordereaux ».
  // ⚠️ SEULEMENT SUR DU NOUVEAU, ET UNE FOIS PAR VENTE. Un panneau qui se rouvre
  //    à chaque page devient un panneau qu'on ferme sans regarder — c'est le
  //    défaut qu'on a corrigé partout ailleurs (§5.66). On mémorise donc les
  //    transactions déjà signalées : une même vente n'ouvre le panneau qu'une
  //    fois, et rien ne s'ouvre s'il n'y a rien à faire.
  function ouvrirSiNouveau() {
    try {
      if (open) return;                                  // déjà ouvert : on ne touche à rien
      const aFaire = [
        ...((DATA && DATA.toShip) || []).map(v => 'v' + (v.tx || v.transaction || '')),
        ...((DATA && DATA.offers) || []).map(o => 'o' + (o.oid || o.conv || '')),
      ].filter(k => k.length > 1);
      if (!aFaire.length) return;
      let vus = [];
      try { vus = JSON.parse(readLS('vrm_panel_vus', '[]')) || []; } catch (_) { vus = []; }
      const dejaVu = new Set(vus);
      const neufs = aFaire.filter(k => !dejaVu.has(k));
      if (!neufs.length) return;                         // rien de neuf : on n'ouvre pas
      // On borne la mémoire : au-delà, ce sont des ventes parties depuis longtemps.
      writeLS('vrm_panel_vus', JSON.stringify([...aFaire].slice(-200)));
      tab = ((DATA && DATA.toShip) || []).length ? 'expedier' : 'messages';
      toggle(true);
    } catch (_) { /* jamais bloquer la navigation pour ça */ }
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

  /* ── PROPOSITION DE BORDEREAU, SANS OUVRIR LE PANNEAU ────────────────────
     Julien : « dès que je me connecte sur un compte Vinted, sans même avoir
     ouvert l'extension, s'il y a une vente, propose de générer et d'envoyer le
     bordereau dans l'app ».
     ⚠️ C'est une PROPOSITION : générer, c'est agir sur Vinted, donc ça reste
     son clic (§5.32). La carte s'affiche au-dessus du FAB, se referme, et ne
     revient pas pour la même vente avant 20 h (côté service worker).
     ⚠️ Elle ne s'affiche QUE pour le compte connecté dans cet onglet — c'est le
     service worker qui l'a déterminé (agir au nom d'un autre compte est LE
     signal multi-comptes que Vinted sanctionne, §48). */
  let propo = null;
  function fermerPropo() { if (propo) { propo.remove(); propo = null; } }
  // ══════════════════════════════════════════════════════════════════════════
  // LE RÉCAP D'ARRIVÉE — au milieu de l'écran, et SEULEMENT s'il y a du nouveau
  // ══════════════════════════════════════════════════════════════════════════
  // Demandes de Julien, dans l'ordre où elles sont venues :
  //  1. « je veux avoir AU MILIEU DE MON ÉCRAN un message qui me dit si j'ai
  //     fait une vente, et qui me demande si je génère les bordereaux. Je veux
  //     mettre oui, non et seulement cela. »
  //  2. « je veux juste que ça s'allume s'il y a des nouveautés. Il ne faut pas
  //     que ça s'allume s'il n'y a rien. Ou alors ça peut faire un résumé de
  //     tout ce qui s'est passé — ça m'évite d'aller dans les messages, dans
  //     les notifications, etc. »
  // Donc : une seule fenêtre. Elle résume ce qui a bougé, et elle ne pose la
  // question OUI/NON que s'il y a vraiment un bordereau à générer. Le
  // background ne l'envoie même pas quand il n'y a rien (voir `nouveautes`).
  // ⚠️ « Oui » enchaîne les ventes UNE PAR UNE en attendant la réponse de
  //    Vinted avant d'envoyer la suivante — jamais un lot lâché d'un coup
  //    (§5.36), aucune temporisation « faussement humaine » (§32) : c'est le
  //    rythme du réseau. Un refus du garde-fou ARRÊTE la série.
  function afficherPropo(uid, recap) {
    fermerPropo();
    if (!recap) return;
    const ventes = recap.ventes || [], aGen = recap.aGenerer || [];
    const nMsg = recap.messages || 0, nOff = recap.offres || 0, nEnv = recap.envoyes || 0;
    if (!ventes.length && !nMsg && !nOff && !aGen.length && !nEnv) return;

    const eur = (v) => (Math.round(v * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
    const lignes = [];
    if (ventes.length) lignes.push(['💶', ventes.length === 1 ? '1 vente' : ventes.length + ' ventes',
      recap.eur ? eur(recap.eur) : '']);
    if (nMsg) lignes.push(['💬', nMsg === 1 ? '1 nouveau message' : nMsg + ' nouveaux messages', '']);
    if (nOff) lignes.push(['🏷️', nOff === 1 ? '1 offre à trancher' : nOff + ' offres à trancher', '']);
    // Ce qui vient de partir tout seul dans l'app (Julien, 27 août : « une fois
    // que la vente a été faite, je veux que le bordereau soit automatiquement
    // envoyé dans l'app »). On le DIT : un geste silencieux n'inspire pas
    // confiance, surtout celui-là.
    if (nEnv) lignes.push(['🖨️', nEnv === 1 ? '1 bordereau envoyé dans l\'app' : nEnv + ' bordereaux envoyés dans l\'app', '✓']);
    // Ce qui n'a PAS pu être généré tout seul : là, on demande.
    if (aGen.length) lignes.push(['📦', aGen.length === 1 ? '1 bordereau à générer' : aGen.length + ' bordereaux à générer', '']);

    propo = document.createElement('div');
    propo.id = 'vrm-propo';
    propo.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;'
      + 'background:rgba(21,17,16,.45);backdrop-filter:blur(2px);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    const question = aGen.length
      ? (aGen.length === 1 ? 'Je génère le bordereau ?' : 'Je génère les ' + aGen.length + ' bordereaux ?')
      : '';
    propo.innerHTML = `
      <div id="vrm-propo-box" role="dialog" aria-modal="true" style="background:#FBF7F0;color:#151110;border:1px solid #D9CFBE;
           border-radius:8px;box-shadow:0 24px 60px rgba(0,0,0,.35);padding:24px 22px 18px;width:340px;max-width:calc(100vw - 32px);text-align:center">
        <div style="font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:#7a6d5f;font-weight:600">Depuis ton dernier passage</div>
        <div id="vrm-propo-lignes" style="margin-top:12px;text-align:left">
          ${lignes.map(([ic, t, v]) => `
            <div style="display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid #EFE6D8">
              <span style="font-size:16px;flex:0 0 auto">${ic}</span>
              <span style="flex:1;font-weight:600;font-size:14px">${esc(t)}</span>
              ${v ? `<span style="font-weight:700;color:${v === '✓' ? '#0f6b4f' : '#D2401E'};font-size:14px">${esc(v)}</span>` : ''}
            </div>`).join('')}
        </div>
        <div id="vrm-propo-s" style="font-size:13.5px;color:#5c5148;margin-top:14px">${esc(question)}</div>
        <div id="vrm-propo-btns" style="display:flex;gap:10px;margin-top:${question ? 14 : 16}px"></div>
      </div>`;
    document.documentElement.appendChild(propo);
    const sous = propo.querySelector('#vrm-propo-s');
    const btns = propo.querySelector('#vrm-propo-btns');
    const bouton = (id, txt, plein) => `<button id="${id}" style="flex:1;border:${plein ? 'none' : '1px solid #C3B49C'};`
      + `background:${plein ? '#151110' : '#FBF7F0'};color:${plein ? '#EFE8DC' : '#151110'};border-radius:6px;padding:11px 0;`
      + `font-size:15px;font-weight:${plein ? 700 : 600};cursor:pointer;font-family:inherit">${txt}</button>`;
    // Pas de bordereau à générer ⟹ c'est une information, pas une question.
    btns.innerHTML = aGen.length ? bouton('vrm-propo-non', 'Non', false) + bouton('vrm-propo-oui', 'Oui', true)
                                 : bouton('vrm-propo-ok', 'Fermer', true);
    const ok = propo.querySelector('#vrm-propo-ok'); if (ok) ok.onclick = fermerPropo;
    const non = propo.querySelector('#vrm-propo-non'); if (non) non.onclick = fermerPropo;
    // Cliquer à côté = « Non » (aucune action envoyée à Vinted).
    propo.onclick = (e) => { if (e.target === propo) fermerPropo(); };

    const oui = propo.querySelector('#vrm-propo-oui');
    if (oui) oui.onclick = async () => {
      btns.innerHTML = '';
      let faits = 0, rates = 0, arret = '';
      for (const v of aGen) {
        sous.textContent = `Génération ${faits + rates + 1} sur ${aGen.length}…`;
        const r = await new Promise(res => {
          try { chrome.runtime.sendMessage({ action: 'genererBord', uid, tx: v.tx }, x => res(x || {})); }
          catch (_) { res({}); }
        });
        if (r && r.ok) faits++;
        else {
          rates++;
          // Un refus du garde-fou vaut pour toutes les suivantes : on s'arrête.
          if (r && r.code) { arret = r.error || r.raison || ''; break; }
        }
      }
      sous.textContent = arret ? arret
        : rates ? `${faits} généré${faits > 1 ? 's' : ''}, ${rates} non — le détail est dans le panneau VRM.`
        : (faits === 1 ? 'Bordereau généré, il part dans ton application.' : faits + ' bordereaux générés, ils partent dans ton application.');
      sous.style.color = rates ? '#b45309' : '#0f6b4f';
      sous.style.fontWeight = '600';
      btns.innerHTML = bouton('vrm-propo-ok', 'Fermer', true);
      const o2 = propo.querySelector('#vrm-propo-ok'); if (o2) o2.onclick = fermerPropo;
      try { load(); } catch (_) {}
    };
  }
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.__vrm === 'recap') afficherPropo(msg.uid, msg);
    });
  } catch (_) {}

  load();   // pastille dès l'arrivée sur Vinted
  onPage(); // lit la date si on arrive directement sur une annonce
})();
