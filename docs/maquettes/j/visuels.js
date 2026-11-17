// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE J — LES VISUELS (17 nov.) : une basket dessinée UNE fois avec soin (profil, pointe à gauche),
//  détourée (fond transparent : la vignette pose le fond uni), mêmes proportions partout ; ses coloris
//  changent, jamais sa forme. Ce sont des ILLUSTRATIONS inventées, jamais des photos réelles.
//  Les icônes : un seul jeu, trait 1,75, bouts arrondis (style Lucide / SF Symbols), dessiné ici.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  // [tige, renforts (bout + talon), panneau latéral, œillets, semelle intermédiaire, semelle d'usure, lacets, col]
  const COLORIS = [
    ['#f6f5f1', '#e4e1da', '#cfd3d9', '#e4e1da', '#ffffff', '#d9d4c9', '#f6f5f1', '#2a2a2c'],  // 0 blanc et gris
    ['#1d1d1f', '#2c2c2f', '#2c2c2f', '#3a3a3d', '#efe9dd', '#b88a5a', '#f2efe8', '#0e0e0f'],  // 1 noir et gomme
    ['#f3efe4', '#e8e2d2', '#2f6b4f', '#2f6b4f', '#f6f2e8', '#e2dac8', '#f3efe4', '#2f6b4f'],  // 2 crème et vert
    ['#8a8e95', '#5d6169', '#4a4e56', '#3d4047', '#d4d6da', '#2b2d31', '#30333a', '#2b2d31'],  // 3 gris orage
    ['#dcdfe4', '#b8bec8', '#a3abb7', '#8f98a6', '#f4f5f7', '#c9ced6', '#ffffff', '#5a6474'],  // 4 argent
    ['#f7f7f5', '#1c1c1e', '#1c1c1e', '#1c1c1e', '#ffffff', '#1c1c1e', '#f7f7f5', '#1c1c1e'],  // 5 noir et blanc (panda)
    ['#22325c', '#1a284d', '#f1ede4', '#1a284d', '#ece6d8', '#c7a77a', '#f1ede4', '#14203d'],  // 6 bleu marine
    ['#b9bdc4', '#8d929a', '#757a83', '#6b7079', '#eceef1', '#9da3ad', '#d8dbe0', '#4b4f56'],  // 7 gris nuage
    ['#161618', '#161618', '#161618', '#2a2a2c', '#fafafa', '#161618', '#161618', '#161618'],  // 8 noir
    ['#fbfbfa', '#f1f1ef', '#f1f1ef', '#ebebe9', '#ffffff', '#e8e8e6', '#ffffff', '#e2e2e0'],  // 9 blanc
    ['#6c1e2a', '#5a1823', '#efe7da', '#5a1823', '#ede5d7', '#c49a6c', '#efe7da', '#43111a'],  // 10 bordeaux
    ['#f1f3f6', '#cfd5dd', '#b4bbc6', '#5a6474', '#ffffff', '#c9ced6', '#ffffff', '#5a6474'],  // 11 blanc et argent
    ['#f7f5f0', '#f7f5f0', '#c8102e', '#e9e5dc', '#ffffff', '#c8102e', '#ffffff', '#c8102e'],  // 12 blanc et rouge
    ['#d9ccb2', '#c4b493', '#a88d63', '#a88d63', '#efe6d4', '#6c5838', '#e8dcc4', '#6c5838'],  // 13 sable
    ['#f5f3ee', '#d9d4ca', '#c8102e', '#e6e2da', '#f2ece0', '#b8b2a6', '#ffffff', '#c8102e'],  // 14 ’86 rouge (la 124)
  ];
  const cache = new Map();
  function basket(coloris) {
    if (cache.has(coloris)) return cache.get(coloris);
    const [tige, renfort, panneau, oeillets, inter, usure, lacet, col] = COLORIS[coloris % COLORIS.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340">
<defs>
<radialGradient id="o" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".6" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".30"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".10"/></linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset="1" stop-color="#000" stop-opacity=".10"/></linearGradient>
</defs>
<ellipse cx="300" cy="300" rx="270" ry="16" fill="url(#o)"/>
<!-- tige -->
<path d="M46 248C40 226 56 208 92 200C142 190 182 178 216 162L326 114C342 107 356 108 366 116L382 130C398 142 420 142 440 134L498 110C516 104 532 108 540 122C558 152 568 202 564 246Z" fill="${tige}"/>
<!-- languette et col -->
<path d="M326 114C330 92 346 80 366 84C372 86 376 92 376 100L382 130Z" fill="${tige}"/>
<path d="M326 114C330 92 346 80 366 84C372 86 376 92 376 100L382 130Z" fill="url(#v)"/>
<path d="M366 116C380 132 418 142 442 134L498 110C478 126 424 152 382 140Z" fill="${col}"/>
<!-- panneau latéral -->
<path d="M132 250C166 222 252 204 352 198C404 196 446 202 488 214L490 248Z" fill="${panneau}"/>
<path d="M150 236C190 218 262 206 352 204C400 203 440 208 480 220" fill="none" stroke="#000" stroke-opacity=".16" stroke-width="2" stroke-dasharray="6 6"/>
<!-- bout renforcé -->
<path d="M46 248C40 226 56 208 92 200L134 192C122 212 120 232 126 250Z" fill="${renfort}"/>
<path d="M60 232C66 218 84 210 118 202" fill="none" stroke="#000" stroke-opacity=".16" stroke-width="2" stroke-dasharray="6 6"/>
<!-- talon -->
<path d="M488 248C482 200 486 152 502 110L498 110C516 104 532 108 540 122C558 152 568 202 564 246Z" fill="${renfort}"/>
<path d="M500 240C496 200 498 160 510 124" fill="none" stroke="#000" stroke-opacity=".16" stroke-width="2" stroke-dasharray="6 6"/>
<!-- œillets -->
<path d="M206 170L324 120C340 113 354 114 364 122L376 132L366 152L236 204Z" fill="${oeillets}"/>
<g fill="#000" fill-opacity=".35"><circle cx="246" cy="186" r="3.5"/><circle cx="276" cy="173" r="3.5"/><circle cx="306" cy="160" r="3.5"/><circle cx="336" cy="147" r="3.5"/></g>
<!-- lacets -->
<g stroke="${lacet}" stroke-width="7" stroke-linecap="round"><path d="M234 176L258 194"/><path d="M264 163L288 181"/><path d="M294 150L318 168"/><path d="M324 137L348 155"/></g>
<!-- volume de la tige -->
<path d="M46 248C40 226 56 208 92 200C142 190 182 178 216 162L326 114C342 107 356 108 366 116L382 130C398 142 420 142 440 134L498 110C516 104 532 108 540 122C558 152 568 202 564 246Z" fill="url(#v)"/>
<!-- semelles -->
<path d="M38 244L566 240C570 252 570 262 566 270L40 274C34 264 34 252 38 244Z" fill="${inter}"/>
<path d="M38 244L566 240C570 252 570 262 566 270L40 274C34 264 34 252 38 244Z" fill="url(#s)"/>
<path d="M40 274L566 270C568 282 560 292 546 292L66 294C50 294 40 286 40 274Z" fill="${usure}"/>
<path d="M70 284H540" stroke="#000" stroke-opacity=".12" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>
</svg>`;
    const u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    cache.set(coloris, u); return u;
  }

  const P = (d) => `<path d="${d}"/>`;
  const ICONES = {
    aujourdhui: '<circle cx="12" cy="12" r="4"/>' + P('M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'),
    annonces: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    achats: P('M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z') + P('M3 6h18') + P('M16 10a4 4 0 0 1-8 0'),
    ventes: P('M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z') + P('m3.3 7 8.7 5 8.7-5') + P('M12 22V12'),
    argent: P('M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1') + P('M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4'),
    chercher: '<circle cx="11" cy="11" r="7"/>' + P('m20 20-4-4'),
    aide: '<circle cx="12" cy="12" r="9"/>' + P('M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3') + P('M12 17h.01'),
    imprimer: P('M6 9V2h12v7') + P('M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2') + '<rect x="6" y="14" width="12" height="8" rx="1"/>',
    plus: P('M12 5v14M5 12h14'),
    agrandir: P('M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7'),
    crayon: P('M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'),
    horloge: '<circle cx="12" cy="12" r="9"/>' + P('M12 7v5l3 2'),
    epingle: P('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z') + '<circle cx="12" cy="10" r="3"/>',
    camion: P('M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2') + P('M15 18H9') + P('M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14') + '<circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    coeur: P('M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'),
    grille: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    liste: P('M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'),
    chevron: P('m9 18 6-6-6-6'),
    bas: P('m6 9 6 6 6-6'),
    euro: P('M4 10h12M4 14h9') + P('M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2'),
    caisse: '<rect x="2" y="7" width="20" height="14" rx="2"/>' + P('M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2'),
  };
  const ico = (n, t = 24, cls = '') => `<svg class="j-ico ${cls}" width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[n]}</svg>`;
  window.VRM_J_VISUELS = { basket, ico };
})();
