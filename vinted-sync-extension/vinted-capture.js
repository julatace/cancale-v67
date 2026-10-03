// vinted-capture.js — CE QUI RESTE SUR VINTED : LIRE LA PAGE, RIEN AFFICHER.
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
})();
