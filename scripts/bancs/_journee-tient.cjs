// ════════════════════════════════════════════════════════════════════════════
//  AUJOURD'HUI À L'ORDINATEUR : CHAQUE TEXTE TIENT DANS SA COLONNE (27 nov.).
//
//  Deux défauts vus sur les captures du 27 nov., qu'aucun contrôle ne voyait :
//   · 1008 × 633 (Edge à 150 %, `iphone-reprise` O) : trois colonnes trop étroites — « 2 146 € » et « 70 € » coupés
//     dans « Vendu · mois / Reçu · mois », le compte sous le prix dans « À envoyer » (« boutique_c 44 € »), « À faire »
//     cassé lettre à lettre (« nouvea / ux »), le « S » de la semaine rogné à gauche ;
//   · 1512 (`journee-coherence`, « Relancer au bon moment ») : la raison posée À CÔTÉ de « Écrire aux favoris dans
//     l'extension » sortait de la carte, coupée.
//
//  La règle jugée, sur chaque nœud de TEXTE visible de la grille `.sj-grille-colonnes` (rectangles de `Range`, jamais
//  un libellé) :
//   T1 SORT    — aucune ligne de texte ne sort de SA colonne (`.sj-col`) à gauche ou à droite ;
//   T2 COUPÉ   — aucune ligne n'est rognée par un ancêtre qui cache (overflow hidden/clip) — sauf la coupe VOULUE
//                (`text-overflow: ellipsis` sur cet ancêtre ou en chemin : le « … » le dit) ;
//   T3 MOT     — aucun mot n'est cassé sur deux lignes (coupe permise après un trait d'union, une barre, un point médian) ;
//   T4 DESSUS  — dans une rangée d'« À envoyer » (`.sj-v-ligne`), aucun texte ne passe sous le prix.
//  Plus le nombre de colonnes et leur largeur, pour le dire.
//  Utilisé par `iphone-reprise.cjs` (O3) et `journee-coherence.cjs` (E12).
// ════════════════════════════════════════════════════════════════════════════
'use strict';

function mesureTient() {
  const grille = document.querySelector('.sj-journee[data-sj-ordi="1"] .sj-grille-colonnes');
  if (!grille) return null;
  const cols = [...grille.children].filter((c) => c.classList.contains('sj-col') && c.getClientRects().length);
  const colonnes = cols.map((c) => { const r = c.getBoundingClientRect(); return { cle: c.getAttribute('data-sj-col'), g: Math.round(r.left), d: Math.round(r.right), l: Math.round(r.width), haut: Math.round(r.top) }; });
  const nColonnes = new Set(colonnes.map((c) => c.g)).size;   // côte à côte = des bords gauches différents
  const sortants = [], coupes = [], mots = [], dessus = [];
  const court = (s) => String(s).replace(/\s+/g, ' ').trim().slice(0, 40);
  const visible = (e) => {
    if (!e.getClientRects().length) return false;
    if (e.closest('[inert], [hidden]')) return false;
    // texte pour lecteur d'écran (`.vrm-sr-seul` : 1 px, clip) ou boîte rognée à rien : pas vu (sous zoom, 1 px vaut 1,25)
    for (let a = e; a && a !== grille; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false;
      if ((cs.clipPath && cs.clipPath !== 'none') || (cs.clip && cs.clip !== 'auto')) return false;
      // (une boîte écrasée à 2 px dans le flux — le grand chiffre du jour à 1008 px — EST un défaut : jugée, pas écartée)
      if (cs.position === 'absolute') { const q = a.getBoundingClientRect(); if (q.width <= 2 && q.height <= 2) return false; }
    }
    return true;
  };
  // les ancêtres (jusqu'à la colonne) qui CACHENT ce qui dépasse en largeur, et s'il y a une ellipse voulue en chemin
  const cachent = (e, col) => {
    const out = []; let ellipse = false;
    for (let a = e; a && a !== col.parentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.textOverflow === 'ellipsis') ellipse = true;
      if (/hidden|clip/.test(cs.overflowX) || cs.contain.includes('paint')) out.push({ a, ellipse });
    }
    return out;
  };
  const marche = document.createTreeWalker(grille, NodeFilter.SHOW_TEXT);
  for (let n = marche.nextNode(); n; n = marche.nextNode()) {
    const txt = n.nodeValue; if (!/\S/.test(txt)) continue;
    const el = n.parentElement; if (!el || !visible(el)) continue;
    const col = el.closest('.sj-col'); if (!col) continue;
    const rc = col.getBoundingClientRect();
    const rg = document.createRange(); rg.selectNodeContents(n);
    const lignes = [...rg.getClientRects()].filter((q) => q.width > 0.5 && q.height > 0.5);
    const lieu = `${col.getAttribute('data-sj-col')} ${el.tagName.toLowerCase()}.${String(el.getAttribute('class') || '').split(' ')[0]}`;
    // T1
    for (const q of lignes) if (q.right > rc.right + 1 || q.left < rc.left - 1) { sortants.push({ lieu, texte: court(txt), ligne: [Math.round(q.left), Math.round(q.right)], colonne: [Math.round(rc.left), Math.round(rc.right)] }); break; }
    // T2
    const caches = cachent(el, col);
    for (const q of lignes) {
      const c = caches.find(({ a, ellipse }) => { if (ellipse) return false; const ra = a.getBoundingClientRect(); return q.right > ra.right + 1 || q.left < ra.left - 1; });
      if (c) { const ra = c.a.getBoundingClientRect(); coupes.push({ lieu, texte: court(txt), ligne: [Math.round(q.left), Math.round(q.right)], boite: [Math.round(ra.left), Math.round(ra.right)], par: String(c.a.className).slice(0, 40) }); break; }
    }
    // T3 — un mot (entre deux blancs ordinaires ; une espace insécable lie, elle ne sépare pas) sur une seule ligne,
    // morceau par morceau entre les coupes permises (- ‐ / · –).
    const reMot = /[^ \t\n\r]+/g; let m;
    while ((m = reMot.exec(txt))) {
      const reMorceau = /[^-‐/·–]+[-‐/·–]?/g; let p;
      while ((p = reMorceau.exec(m[0]))) {
        const brut = p[0].replace(/[-‐/·–]$/, ''); if (brut.replace(/[  ]/g, '').length < 2) continue;
        const r = document.createRange(); r.setStart(n, m.index + p.index); r.setEnd(n, m.index + p.index + brut.length);
        const hauts = new Set([...r.getClientRects()].filter((q) => q.width > 0.5).map((q) => Math.round(q.top / 4)));
        if (hauts.size > 1) { mots.push({ lieu, mot: brut }); }
      }
    }
  }
  // T4
  for (const ligne of grille.querySelectorAll('.sj-v-ligne')) {
    const prix = ligne.querySelector('.sj-v-ligne-prix'); if (!prix || !visible(prix)) continue;
    const rp = prix.getBoundingClientRect();
    const m2 = document.createTreeWalker(ligne, NodeFilter.SHOW_TEXT);
    for (let n = m2.nextNode(); n; n = m2.nextNode()) {
      if (!/\S/.test(n.nodeValue) || prix.contains(n)) continue;
      const el = n.parentElement; if (!el || !visible(el)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      // ce qu'un ancêtre cache (une ellipse) n'est pas vu : on borne le texte par la boîte qui le coupe
      let g = -Infinity, d = Infinity;
      for (let a = el; a && a !== ligne; a = a.parentElement) { const cs = getComputedStyle(a); if (/hidden|clip/.test(cs.overflowX)) { const ra = a.getBoundingClientRect(); g = Math.max(g, ra.left); d = Math.min(d, ra.right); } }
      for (const q of rg.getClientRects()) {
        const l = Math.max(q.left, g), r = Math.min(q.right, d);
        if (r - l > 1 && l < rp.right - 1 && r > rp.left + 1 && q.top < rp.bottom - 1 && q.bottom > rp.top + 1) { dessus.push({ texte: court(n.nodeValue), prix: court(prix.textContent), ligne: [Math.round(l), Math.round(r)], prixAt: [Math.round(rp.left), Math.round(rp.right)] }); break; }
      }
    }
  }
  return { nColonnes, colonnes, sortants, coupes, mots, dessus };
}

// `dit(vrai, quoi, detail)` : le rapporteur du banc appelant. `T` : le cas, pour le message.
function juger(dit, r, T) {
  if (!r) { dit(false, `${T} la grille d'Aujourd'hui (ordinateur) est rendue`); return; }
  const cols = r.colonnes.map((c) => `${c.cle}:${c.l}px`).join(' ');
  dit(r.sortants.length === 0, `${T} T1 aucun texte ne sort de sa colonne (${cols})`, JSON.stringify(r.sortants.slice(0, 6)));
  dit(r.coupes.length === 0, `${T} T2 aucun texte rogné (hors « … » voulu)`, JSON.stringify(r.coupes.slice(0, 6)));
  dit(r.mots.length === 0, `${T} T3 aucun mot cassé sur deux lignes`, JSON.stringify(r.mots.slice(0, 8)));
  dit(r.dessus.length === 0, `${T} T4 « À envoyer » : aucun texte sous le prix`, JSON.stringify(r.dessus.slice(0, 6)));
}

module.exports = { mesureTient, juger };
