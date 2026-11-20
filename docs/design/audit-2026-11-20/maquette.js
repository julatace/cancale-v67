// Maquettes de l'audit du 20 nov. — icônes en trait (1,7), barre d'état, barre d'onglets, vignettes inventées.
// `?theme=dark` : le sombre (comme `vinted_dark`). Aucune donnée réelle.
(function () {
  if (/theme=dark/.test(location.search)) document.documentElement.setAttribute('data-theme', 'dark');
  const T = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  const ICO = {
    soleil: `<svg viewBox="0 0 24 24" ${T}><path d="M4 17h16M7 17a5 5 0 0 1 10 0M12 6v2M5.5 9.5l1.4 1.4M18.5 9.5l-1.4 1.4M3 13h2M19 13h2"/></svg>`,
    boite: `<svg viewBox="0 0 24 24" ${T}><path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="m4 7 8 4 8-4M12 11v10"/></svg>`,
    sac: `<svg viewBox="0 0 24 24" ${T}><path d="M6 8h12l-1 12H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>`,
    chariot: `<svg viewBox="0 0 24 24" ${T}><path d="M3 4h2l2.4 11h10.1L20 7H6.2"/><circle cx="9" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/></svg>`,
    euro: `<svg viewBox="0 0 24 24" ${T}><path d="M17 6.5A6.5 6.5 0 1 0 17 17.5M5 10h8M5 14h8"/></svg>`,
    bulle: `<svg viewBox="0 0 24 24" ${T}><path d="M4 5h16v11H9l-5 4z"/></svg>`,
    loupe: `<svg viewBox="0 0 24 24" ${T}><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>`,
    scan: `<svg viewBox="0 0 24 24" ${T}><path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M8 9v6M11 9v6M14 9v6M17 9v6"/></svg>`,
    chevron: `<svg viewBox="0 0 8 14" ${T} stroke-width="2"><path d="m1 1 6 6-6 6"/></svg>`,
    bas: `<svg viewBox="0 0 12 8" ${T} stroke-width="2" width="12" height="8"><path d="m1 1.5 5 5 5-5"/></svg>`,
    imprimante: `<svg viewBox="0 0 24 24" ${T}><path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v6H7z"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" ${T}><path d="M12 5v14M5 12h14"/></svg>`,
    point: `<svg viewBox="0 0 24 24" ${T}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`,
    lien: `<svg viewBox="0 0 24 24" ${T}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>`,
    camion: `<svg viewBox="0 0 24 24" ${T}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>`,
  };
  const forme = (g) => { let h = 0; for (const c of String(g)) h = (h * 31 + c.charCodeAt(0)) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; const t = h % 360;
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"><rect width="100" height="100" fill="hsl(${t},26%,88%)"/><path d="M14 64c6-13 18-15 26-20l10-6c6 7 14 9 24 10 8 1 12 6 11 14v4H14z" fill="hsl(${t},34%,${38 + (h % 24)}%)"/><rect x="14" y="68" width="71" height="5" rx="2" fill="#fafafa"/></svg>`; };
  for (const el of document.querySelectorAll('[data-ico]')) el.insertAdjacentHTML('afterbegin', ICO[el.getAttribute('data-ico')] || '');
  for (const el of document.querySelectorAll('[data-vg]')) el.innerHTML = forme(el.getAttribute('data-vg'));
  const tel = document.querySelector('.tel');
  tel.insertAdjacentHTML('afterbegin', '<div class="statut"><span>9:41</span><span>5G ▮</span></div>');
  const actif = tel.getAttribute('data-onglet');
  const ong = [['journee', 'soleil', "Aujourd’hui"], ['annonces', 'boite', 'Annonces'], ['ventes', 'sac', 'Ventes', 30], ['achats', 'chariot', 'Achats'], ['argent', 'euro', 'Argent']];
  tel.insertAdjacentHTML('beforeend', '<nav class="onglets">' + ong.map(([k, i, l, p]) => `<a class="${k === actif ? 'actif' : ''}">${ICO[i]}${p ? `<span class="p">${p}</span>` : ''}<span>${l}</span></a>`).join('') + '</nav><div class="indicateur"></div>');
})();
