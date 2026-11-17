// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE N — LES VISUELS : une basket dessinée UNE fois (profil, mêmes proportions partout,
//  sans aucun logo de marque) déclinée en coloris ; un jeu d'icônes au trait (style Lucide, 1,75 px).
// ════════════════════════════════════════════════════════════════════════════
(function () {
  // Trois familles de coloris, tirées de la teinte de la paire : claire, sombre, gomme.
  function coloris(h, i) {
    const k = i % 3;
    if (k === 0) return { tige: `hsl(${h} 18% 96%)`, renfort: `hsl(${h} 42% 52%)`, bande: `hsl(${h} 55% 40%)`, semelle: '#F6F4F0', dessous: '#2B2B2D', lacet: '#FFFFFF', col: `hsl(${h} 20% 22%)` };
    if (k === 1) return { tige: `hsl(${h} 14% 26%)`, renfort: `hsl(${h} 10% 16%)`, bande: `hsl(${h} 70% 58%)`, semelle: '#F2F0EB', dessous: '#1C1C1E', lacet: '#E9E7E2', col: '#0E0E10' };
    return { tige: `hsl(${h} 35% 88%)`, renfort: `hsl(${h} 30% 70%)`, bande: `hsl(${h} 48% 36%)`, semelle: '#F7F5F1', dessous: 'hsl(32 52% 52%)', lacet: '#FFFFFF', col: `hsl(${h} 25% 30%)` };
  }
  let n = 0;
  window.basket = function (teinte, graine = 0) {
    const c = coloris(teinte, graine); const id = 'b' + (n++);
    return `<svg class="basket" viewBox="0 0 200 120" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <ellipse cx="102" cy="106" rx="82" ry="5" fill="#000" opacity=".10"/>
      <path d="M17 90c-1.5 7 3 12 10 12.5h149c8 0 12.5-5 11-12.5z" fill="${c.dessous}"/>
      <path d="M16 82h171c3 5 2 11-3 13H22c-6-1.5-8-7-6-13z" fill="${c.semelle}"/>
      <path d="M22 89.5h160" stroke="#000" stroke-opacity=".08" stroke-width="1.2"/>
      <path d="M19 83c0-14 6-23 20-27l29-6.5c11-2.5 17-11 25-19 4.5-4.5 12-6 19-2l18 10.5c15 8.5 31 14.5 46 22 10 5 12.5 13 11 22z" fill="${c.tige}"/>
      <path d="M140 45.5c17 7 33 12.5 41.5 21 5 5 6 10.5 5.5 16.5h-37c.5-13.5-3.5-26-10-37.5z" fill="${c.renfort}"/>
      <path d="M19 83c0-14 6-23 20-27l7.5-1.6c-4.5 9-5 19.5-1.5 28.6z" fill="${c.renfort}"/>
      <path d="M56 79c20-13 52-20 96-13.5-33 1.5-62 8-86 17.5z" fill="${c.bande}"/>
      <path d="M93 30.5c4.5-4.5 12-6 19-2l6 3.5c-9-2-17 0-23.5 5.5z" fill="${c.col}"/>
      <g stroke="${c.lacet}" stroke-width="3.2" stroke-linecap="round"><path d="M104 40l7-6.5"/><path d="M112.5 45l7-6.5"/><path d="M121 49.5l7-6.5"/><path d="M129.5 53.5l7-6.5"/></g>
      <g fill="${c.col}" opacity=".55"><circle cx="102" cy="42" r="1.4"/><circle cx="110.5" cy="47" r="1.4"/><circle cx="119" cy="51.5" r="1.4"/><circle cx="127.5" cy="55.5" r="1.4"/></g>
      <path d="M21 62l9-4.5 2 11-8.5 3.5z" fill="${c.bande}"/>
      <path d="M19 83c0-14 6-23 20-27l29-6.5c11-2.5 17-11 25-19 4.5-4.5 12-6 19-2l18 10.5c15 8.5 31 14.5 46 22 10 5 12.5 13 11 22z" fill="url(#${id})"/>
      <path d="M24 82.5h158" stroke="#000" stroke-opacity=".18" stroke-width="1" stroke-dasharray="2.5 2.5"/>
    </svg>`;
  };

  // Les icônes : un seul trait (1,75), bouts ronds — dans l'esprit de Lucide.
  const P = {
    colis: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/><path d="m7.5 5.5 9 5"/>',
    imprimer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    epingle: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    offre: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
    euro: '<path d="M18 7a6.5 6.5 0 1 0 0 10"/><path d="M4 10.5h9M4 13.5h9"/>',
    prix: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/>',
    boite: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
    commandes: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
    annonces: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    argent: '<rect x="2.5" y="6" width="19" height="13" rx="2.5"/><path d="M2.5 10.5h19"/><path d="M6.5 15h4"/>',
    chercher: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/>',
    coche: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    aide: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.8 1c0 1.7-2.3 2.2-2.3 3.5"/><path d="M12 17.2v.01"/>',
    personne: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    lune: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    coeur: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  };
  window.ico = (nom, t = 20) => `<svg class="ico" width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nom] || ''}</svg>`;
})();
