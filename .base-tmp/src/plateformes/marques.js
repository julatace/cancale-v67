// ── LES MARQUES DES PLATEFORMES : UNE SEULE SOURCE (15 nov.) ─────────────────
// Julien (capture d'Annonces · Vestiaire) : « fais de meilleurs logos pour les
// plateformes ». Un « V » penché, un carré, le mot « ebay » gris et « VC » n'avaient
// ni la même hauteur ni le même poids. Ici, les quatre marques, MONOCHROMES (elles
// prennent la couleur du texte, `currentColor` : aucune couleur de marque, §7 — l'accent
// reste rare), dessinées pour se lire nettes de 14 à 24 px, chacune dans SON cadre
// (`vb`, serré autour du dessin) et avec sa hauteur optique (`echelle`, 1 = la hauteur
// pleine) pour qu'une rangée de quatre paraisse d'une même taille.
//
// Origine et licence de chaque tracé (rien n'est chargé au moment de l'exécution : la
// CSP n'autorise que 'self' ; les tracés sont ICI, recopiés tels quels) :
//  · Vinted et eBay : Simple Icons 16.37.0 (paquet npm `simple-icons`, icons/vinted.svg
//    et icons/ebay.svg), licence CC0-1.0, https://github.com/simple-icons/simple-icons.
//  · Leboncoin : Simple Icons n'a pas de Leboncoin. Marque DESSINÉE pour VRM : le carré
//    au coin replié (le « bon coin »), deux traits. Ce n'est pas le logo officiel.
//  · Vestiaire Collective : absent de Simple Icons. Monogramme « VC » DESSINÉ pour VRM
//    (un V et un C de même trait, même hauteur). Ce n'est pas le logo officiel.
// Les marques appartiennent à leurs propriétaires ; elles ne servent qu'à reconnaître
// le site dans VRM.
//
// Les fichiers `public/brands/*.svg` (les masques CSS de la navigation, l'image du rail)
// sont FABRIQUÉS depuis ce module (`node scripts/marques-svg.cjs --ecrire`) et vérifiés
// par `scripts/audit-plateformes-logo.cjs` : on ne les retouche jamais à la main.
//
// Module PUR (aucun React, aucune lecture) : l'app, le script et l'audit le lisent.

// Chaque élément : { d, plein } (plein = rempli de la couleur du texte) ou
// { d, trait } (dessiné au trait, épaisseur `trait` dans les unités du cadre).
export const MARQUES = Object.freeze({
  vinted: Object.freeze({
    nom: 'Vinted',
    // Le « V » de Vinted (Simple Icons, CC0). Cadre serré sur le dessin.
    vb: [4.25, 0, 15.51, 24],
    echelle: 1,
    elements: Object.freeze([
      { plein: true, d: 'M19.316 0c-.258 0-.571.217-1.415.953-.3.108-.627.027-1.008.613-2.15 3.09-3.825 14.648-5.255 17.984-.286-1.444-.885-10.837-1.116-13.41-.028-.477.027-1.076.027-1.43 0-2.368-.516-3.567-2.886-3.567-1.198 0-2.382.436-3.008 1.226-.299.408-.409.708-.409 1.443 0 4.915 1.171 12.973 2.478 18.228C7.132 23.688 8.603 24 9.99 24c.654 0 1.307-.081 2.233-.544 3.212-1.567 4.07-5.84 4.9-9.993.15-.749.899-4.37 1.253-6.275.476-2.6 1.02-5.54 1.347-6.617C19.833.245 19.63 0 19.317 0z' },
    ]),
  }),
  leboncoin: Object.freeze({
    nom: 'Leboncoin',
    // Le carré aux coins ronds dont le coin du bas, à droite, est replié vers le centre.
    vb: [2, 2, 20, 20],
    echelle: 0.9,
    elements: Object.freeze([
      { trait: 2, d: 'M12 21H7.5A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3h9A4.5 4.5 0 0 1 21 7.5V12' },
      { trait: 2, plein: true, d: 'M12 12h9l-9 9z' },
    ]),
  }),
  ebay: Object.freeze({
    nom: 'eBay',
    // Le mot « ebay » (Simple Icons, CC0). Cadre serré sur les lettres : le mot est la marque.
    vb: [0, 7.21, 24, 9.58],
    echelle: 0.86,
    elements: Object.freeze([
      { plein: true, d: 'M6.056 12.132v-4.92h1.2v3.026c.59-.703 1.402-.906 2.202-.906 1.34 0 2.828.904 2.828 2.855 0 .233-.015.457-.06.668.24-.953 1.274-1.305 2.896-1.344.51-.018 1.095-.018 1.56-.018v-.135c0-.885-.556-1.244-1.53-1.244-.72 0-1.245.3-1.305.81h-1.275c.136-1.29 1.5-1.62 2.686-1.62 1.064 0 1.995.27 2.415 1.02l-.436-.84h1.41l2.055 4.125 2.055-4.126H24l-3.72 7.305h-1.346l1.07-2.04-2.33-4.38c.13.255.2.555.2.93v2.46c0 .346.01.69.04 1.005H16.8a6.543 6.543 0 01-.046-.765c-.603.734-1.32.96-2.32.96-1.48 0-2.272-.78-2.272-1.695 0-.15.015-.284.037-.405-.3 1.246-1.36 2.086-2.767 2.086-.87 0-1.694-.315-2.2-.93 0 .24-.015.494-.04.734h-1.18c.02-.39.04-.855.04-1.245v-1.05h-4.83c.065 1.095.818 1.74 1.853 1.74.718 0 1.355-.3 1.568-.93h1.24c-.24 1.29-1.61 1.725-2.79 1.725C.95 15.009 0 13.822 0 12.232c0-1.754.982-2.91 3.116-2.91 1.688 0 2.93.886 2.94 2.806v.005zm9.137.183c-1.095.034-1.77.233-1.77.95 0 .465.36.97 1.305.97 1.26 0 1.935-.69 1.935-1.814v-.13c-.45 0-.99.006-1.484.022h.012zm-6.06 1.875c1.11 0 1.876-.806 1.876-2.02s-.768-2.02-1.893-2.02c-1.11 0-1.89.806-1.89 2.02s.765 2.02 1.875 2.02h.03zm-4.35-2.514c-.044-1.125-.854-1.546-1.725-1.546-.944 0-1.694.474-1.815 1.546z' },
    ]),
  }),
  vestiaire: Object.freeze({
    nom: 'Vestiaire Collective',
    // « VC » : un V et un C au même trait, sur la même hauteur (le C ouvert vers la droite).
    vb: [0.45, 4.45, 22.9, 15.1],
    echelle: 0.86,
    elements: Object.freeze([
      { trait: 2.3, d: 'M1.6 5.6 5.95 18.4 10.3 5.6' },
      { trait: 2.3, d: 'M22.2 7.75A6.4 6.4 0 1 0 22.2 16.25' },
    ]),
  }),
});

export const IDS_MARQUES = Object.freeze(Object.keys(MARQUES));
export const marque = (id) => MARQUES[String(id || '').toLowerCase()] || null;

// Le cadre CARRÉ (24 × 24 autour du centre du dessin) : pour un masque CSS ou une
// image posés dans une boîte carrée (la navigation, le rail, les e-mails).
export function cadreCarre(m) {
  const [x, y, w, h] = m.vb;
  const c = Math.max(w, h);
  const r = (v) => Math.round(v * 1000) / 1000;
  return [r(x - (c - w) / 2), r(y - (c - h) / 2), r(c), r(c)];
}

// Le SVG en texte (fichier `public/brands/<id>.svg`) : noir sur transparent, cadre carré.
export function svgTexte(id) {
  const m = marque(id); if (!m) return '';
  const vb = cadreCarre(m).join(' ');
  const corps = m.elements.map((e) => e.trait
    ? `<path d="${e.d}" fill="${e.plein ? '#000' : 'none'}" stroke="#000" stroke-width="${e.trait}" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${e.d}" fill="#000"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img"><title>${m.nom}</title>${corps}</svg>\n`;
}
