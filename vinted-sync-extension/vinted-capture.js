// vinted-capture.js — CE QUI RESTE SUR VINTED : LIRE LA PAGE, ET LE NUMÉRO VRM (20 oct.).
//
// Julien, 2 octobre : « l'extension est simplement là pour capter ; tout doit
// être centralisé dans VRM ». Le panneau VRM (bouton orange, 14 onglets, fenêtre
// récapitulative, bulle de connexion) est RETIRÉ ; la petite carte en bas à
// droite (vrm-badge.js) le remplace.
//
// Ce fichier garde la seule chose que le panneau faisait et que rien d'autre ne
// fait : lire, sur la page d'une annonce, ce que l'API ne renvoie pas — sa date
// de mise en ligne, sa description et ses photos en grand format. C'est la
// SEULE source de `vinted_listing_dates` (l'ancienneté, « qui dort ») et la
// source des descriptions et photos reprises sur Leboncoin.
// Zéro requête vers Vinted : on lit ce qui est déjà affiché.

(() => {
  if (window.__vrmCaptureLoaded) return;
  window.__vrmCaptureLoaded = true;
  const vivant = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; } };

  // Id de l'annonce affichée si on est sur une page article (/items/123456-titre).
  const currentItemId = () => {
    const m = /\/items\/(\d+)/.exec(location.pathname);
    return m ? m[1] : null;
  };

  // ── DATE DE MISE EN LIGNE (« Ajouté il y a … », bas de l'annonce) ──────────
  // Vinted affiche l'ancienneté sur la page de l'annonce, mais ne la renvoie pas
  // dans les données du dressing. Comme ce script tourne DÉJÀ sur la page, on
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
      // ⚠️ MESURÉ le 19 sept. : 0 annonce > 6 photos captées, alors que ses
      //    annonces en ont plus. CAUSE : le carrousel Vinted charge ses images
      //    au fur et à mesure — les slides pas encore affichées n'ont pas de
      //    `src`, seulement un `srcset`/`data-src`. Lire seulement `img[src]`
      //    n'en voyait donc que ~5-6. On lit AUSSI `srcset`, `data-src`,
      //    `data-srcset` et les <source>. Filtré au MÊME domaine + grand format :
      //    ça ne peut ajouter qu'une VRAIE photo Vinted, jamais autre chose.
      const seen = new Set(); // par IDENTITÉ de photo, pas par URL
      // ⚠️ Deux URL de la MÊME photo ne diffèrent que par le format (/f800/,
      //    /f1200/, /tc/) et la query `?s=…`. On les ramène à une clé stable
      //    pour ne pas envoyer DEUX FOIS la même image à des tailles
      //    différentes (Leboncoin recevrait un doublon).
      const cle = (u) => String(u).replace(/\?.*$/, '').replace(/\/(f\d+|tc)\//, '/');
      const ajoute = (u) => {
        if (!u || !/vinted\.net/.test(u)) return;
        // On ne garde que les grands formats (les vignettes 70x100 ne servent à rien).
        if (!/\/(f800|f1200|tc)\//.test(u)) return;
        const k = cle(u);
        if (seen.has(k)) return;
        seen.add(k);
        if (out.photos.length < 20) out.photos.push(u);
      };
      // un `srcset` est « url1 1x, url2 2x » : on prend chaque URL.
      const urlsDe = (v) => String(v || '').split(',').map((p) => p.trim().split(/\s+/)[0]).filter(Boolean);
      const og = document.querySelector('meta[property="og:image"]');
      if (og) ajoute(og.getAttribute('content')); // la photo principale d'abord
      for (const img of document.querySelectorAll('img')) {
        ajoute(img.getAttribute('src'));
        for (const u of urlsDe(img.getAttribute('srcset'))) ajoute(u);
        for (const u of urlsDe(img.getAttribute('data-srcset'))) ajoute(u);
        ajoute(img.getAttribute('data-src'));
      }
      for (const s of document.querySelectorAll('source')) {
        for (const u of urlsDe(s.getAttribute('srcset'))) ajoute(u);
      }
    } catch (_) { /* page inattendue */ }
    return (out.description || out.photos.length) ? out : null;
  }

  // Mémorise ce qu'on a lu sur la page (date + description + photos), une fois
  // par annonce et par visite.
  const savedDates = new Set();
  const savedDetails = new Set();
  const envoyer = (msg) => {
    if (!vivant()) return;
    try { chrome.runtime.sendMessage(Object.assign({ from: 'cancale-vcapture' }, msg), () => { void chrome.runtime.lastError; }); } catch (_) {}
  };
  function captureDate(id) {
    if (!id) return;
    if (!savedDates.has(id)) {
      const d = readListingDateFromPage();
      if (d) { savedDates.add(id); envoyer({ action: 'saveDate', id, ts: d.ts, text: d.text }); }
    }
    if (!savedDetails.has(id)) {
      const det = readListingDetailFromPage();
      if (det) { savedDetails.add(id); envoyer({ action: 'saveDetail', id, detail: det }); }
    }
  }

  // Navigation interne Vinted (SPA) : à chaque nouvelle annonce, on relit la
  // page — qui se remplit progressivement, d'où deux essais de plus.
  let lastPath = location.pathname;
  const onPage = () => {
    const id = currentItemId();
    if (id) { captureDate(id); setTimeout(() => captureDate(id), 1500); setTimeout(() => captureDate(id), 4000); }
  };
  setInterval(() => {
    if (!vivant()) return;
    if (location.pathname !== lastPath) { lastPath = location.pathname; onPage(); }
  }, 800);
  onPage(); // si on arrive directement sur une annonce

  // ── LE NUMÉRO VRM SUR VINTED (20 octobre, 5.201) ─────────────────────────
  // Julien : « quand on publie sur Vinted je veux que le numéro soit écrit à
  // côté du bouton Publier ; après, sur Vinted, qu'il y ait le numéro dessus ;
  // pareil dans les ventes ». Un numéro ne s'affiche que s'il est CONNU par
  // identité (annonce, transaction, conversation) — jamais deviné d'un titre.
  // Sur la page de dépôt, le numéro est RÉSERVÉ par le fond avant d'être montré.
  // Rien ne clique, rien n'envoie à Vinted : on pose une étiquette dans la page.
  const NUM_ATTR = 'data-vrm-num';
  const STYLE_PILULE = 'display:inline-flex;align-items:center;gap:4px;font:700 11.5px/1 -apple-system,system-ui,sans-serif;'
    + 'color:#fff;background:rgba(16,20,27,.88);border:1px solid rgba(61,123,255,.9);border-radius:999px;padding:4px 8px;white-space:nowrap;letter-spacing:.01em;'
    + 'box-shadow:0 1px 3px rgba(0,0,0,.25);flex:none;width:auto;max-width:max-content;box-sizing:border-box;';
  // (28 oct.) Sur une carte de Vinted, le lien RECOUVRE la photo (sans image
  // dedans) et sa mise en page étirait l'étiquette sur toute la largeur, en bas
  // de la photo. On la pose toujours en petite pastille, en haut à gauche, sans
  // que le style du site puisse la déformer (!important), et sans gêner le clic.
  const epingler = (e, a) => {
    if (getComputedStyle(a).position === 'static') a.style.position = 'relative';
    const P = { position: 'absolute', top: '8px', left: '8px', right: 'auto', bottom: 'auto', width: 'auto', height: 'auto', 'max-width': 'calc(100% - 16px)', margin: '0', 'align-self': 'flex-start', 'z-index': '3', 'pointer-events': 'none', transform: 'none' };
    for (const k in P) e.style.setProperty(k, P[k], 'important');
  };
  const pilule = (texte, titre) => { const e = document.createElement('span'); e.setAttribute(NUM_ATTR, '1'); e.style.cssText = STYLE_PILULE; e.textContent = texte; if (titre) e.title = titre; return e; };
  const demander = (msg) => new Promise((res) => {
    if (!vivant()) return res(null);
    try { chrome.runtime.sendMessage(Object.assign({ from: 'cancale-vcapture', domain: location.host }, msg), (r) => { void chrome.runtime.lastError; res(r || null); }); } catch (_) { res(null); }
  });
  const estDepot = () => /^\/items\/new\/?$/.test(location.pathname);
  // Le bouton qui publie : un bouton d'envoi du formulaire de dépôt. On ne le
  // touche pas — on pose l'étiquette juste à côté.
  const boutonPublier = () => {
    const cands = [...document.querySelectorAll('button[type="submit"], button')];
    return cands.find((b) => /^(ajouter|publier|mettre en ligne|upload|add item|valider)\b/i.test((b.textContent || '').trim())) || null;
  };
  let resa = null, resaDemandee = false;
  async function poserNumeroDepot() {
    if (!estDepot()) return;
    if (!resaDemandee) { resaDemandee = true; resa = await demander({ action: 'numeroPourPublier' }); }
    const b = boutonPublier();
    const deja = document.querySelector('[data-vrm-num-depot]');
    if (deja && b && deja.previousElementSibling === b) return;
    if (deja) deja.remove();
    const texte = resa && resa.ok && resa.numero ? `N°${resa.numero} — écris-le sur le carton` : 'VRM n’a pas pu réserver de numéro : il sera donné dans VRM';
    const e = pilule(texte, resa && resa.ok ? 'Ce numéro est réservé pour cette annonce : VRM le lui donnera après la publication.' : '');
    e.setAttribute('data-vrm-num-depot', resa && resa.ok ? String(resa.numero) : 'pas-su');
    e.style.whiteSpace = 'normal'; e.style.maxWidth = 'min(100%, 320px)'; e.style.lineHeight = '1.3';
    if (!(resa && resa.ok)) e.style.borderColor = '#B45309';
    if (b && b.parentElement) { e.style.marginLeft = '10px'; b.insertAdjacentElement('afterend', e); }
    else { e.style.position = 'fixed'; e.style.left = '16px'; e.style.bottom = '16px'; e.style.zIndex = '2147483000'; document.body.appendChild(e); }
  }
  // Annonces, ventes : les numéros connus pour les liens de la page.
  const connus = { items: {}, convs: {}, txs: {} }, demandes = { items: new Set(), convs: new Set(), txs: new Set() };
  let enVol = false;
  async function completer() {
    if (enVol || !vivant()) return;
    const items = [], convs = [], txs = [];
    for (const a of document.querySelectorAll('a[href*="/items/"], a[href*="/inbox/"], a[href*="/transactions/"]')) {
      const h = a.getAttribute('href') || '';
      let m = /\/items\/(\d{4,15})/.exec(h); if (m && !demandes.items.has(m[1])) { demandes.items.add(m[1]); items.push(m[1]); }
      m = /\/inbox\/(\d{4,15})/.exec(h); if (m && !demandes.convs.has(m[1])) { demandes.convs.add(m[1]); convs.push(m[1]); }
      m = /\/transactions\/(\d{4,15})/.exec(h); if (m && !demandes.txs.has(m[1])) { demandes.txs.add(m[1]); txs.push(m[1]); }
    }
    const ici = currentItemId(); if (ici && !demandes.items.has(ici)) { demandes.items.add(ici); items.push(ici); }
    const conv = /^\/inbox\/(\d{4,15})/.exec(location.pathname); if (conv && !demandes.convs.has(conv[1])) { demandes.convs.add(conv[1]); convs.push(conv[1]); }
    if (!items.length && !convs.length && !txs.length) return;
    enVol = true;
    const r = await demander({ action: 'numeros', items, convs, txs });
    enVol = false;
    if (!r || !r.ok) { items.forEach((x) => demandes.items.delete(x)); convs.forEach((x) => demandes.convs.delete(x)); txs.forEach((x) => demandes.txs.delete(x)); return; }
    Object.assign(connus.items, r.items || {}); Object.assign(connus.convs, r.convs || {}); Object.assign(connus.txs, r.txs || {});
  }
  function poserSurLiens() {
    for (const a of document.querySelectorAll('a[href*="/items/"], a[href*="/inbox/"], a[href*="/transactions/"]')) {
      if (a.querySelector('[' + NUM_ATTR + ']') || a.closest('[' + NUM_ATTR + ']')) continue;
      const h = a.getAttribute('href') || '';
      let m = /\/items\/(\d{4,15})/.exec(h), n = m && connus.items[m[1]];
      if (!n) { m = /\/inbox\/(\d{4,15})/.exec(h); n = m && connus.convs[m[1]]; }
      if (!n) { m = /\/transactions\/(\d{4,15})/.exec(h); n = m && connus.txs[m[1]]; }
      if (!n) continue;
      const e = pilule(`N°${n}`, 'Numéro VRM de cette paire');
      const pa = getComputedStyle(a).position;
      if (a.querySelector('img') || pa === 'absolute' || pa === 'fixed' || a.getBoundingClientRect().height > 80) epingler(e, a);
      else { e.style.setProperty('margin-left', '6px', 'important'); e.style.setProperty('vertical-align', 'middle', 'important'); }
      a.appendChild(e);
    }
  }
  function poserSurPage() {
    const ici = currentItemId();
    const conv = /^\/inbox\/(\d{4,15})/.exec(location.pathname);
    const n = (ici && connus.items[ici]) || (conv && connus.convs[conv[1]]) || null;
    const deja = document.querySelector('[data-vrm-num-page]');
    if (!n) { if (deja) deja.remove(); return; }
    if (deja && deja.getAttribute('data-vrm-num-page') === String(n)) return;
    if (deja) deja.remove();
    const e = pilule(`N°${n}`, 'Numéro VRM de cette paire');
    e.setAttribute('data-vrm-num-page', String(n));
    const h1 = document.querySelector('h1');
    if (h1 && !conv) { e.style.marginLeft = '8px'; e.style.verticalAlign = 'middle'; h1.appendChild(e); }
    else { e.style.position = 'fixed'; e.style.left = '16px'; e.style.top = '76px'; e.style.zIndex = '2147483000'; document.body.appendChild(e); }
  }
  let dernierChemin = '';
  // Une paire numérotée pendant qu'on regarde : on redemande ce qui n'était pas connu.
  setInterval(() => { demandes.items.clear(); demandes.convs.clear(); demandes.txs.clear(); }, 60000);
  setInterval(async () => {
    if (!vivant()) return;
    if (location.pathname !== dernierChemin) { dernierChemin = location.pathname; resaDemandee = estDepot() ? resaDemandee : false; }
    try { await poserNumeroDepot(); await completer(); poserSurLiens(); poserSurPage(); } catch (_) {}
  }, 1200);
})();
