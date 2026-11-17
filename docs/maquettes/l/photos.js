// Les « photos » : des baskets DESSINÉES une fois, proprement, inventées, sans marque ni logo (dépôt public :
// aucune photo réelle). Détourées sur UN fond de studio uni, mêmes proportions, même lumière (du haut),
// même ombre au sol. Deux silhouettes (basse ; à grosse semelle), 14 coloris. Format 4:5.
const COLORIS = [
  // dessus, bande, semelle, renforts
  ['#F6F4EF', '#1E2A38', '#EFEAE0', '#B4232A'], ['#EFE8D8', '#2F5D3A', '#F6F1E6', '#2F5D3A'], ['#FBFBF9', '#141414', '#F2EFE8', '#141414'],
  ['#CDD2D9', '#7B8592', '#EDEDED', '#3E6FB0'], ['#2A2A2C', '#F4F4F4', '#38383A', '#DCDCDC'], ['#E6D6BF', '#8A5A3B', '#C49A6C', '#8A5A3B'],
  ['#D9DEE4', '#9AA3AD', '#F4F4F2', '#5D6670'], ['#2C4A7A', '#FFFFFF', '#ECE5D4', '#FFFFFF'], ['#F7F7F5', '#CFCBC3', '#FFFFFF', '#B9B5AC'],
  ['#C3CAD2', '#2D5BA8', '#ECEEF0', '#2D5BA8'], ['#232426', '#F2F2F2', '#F2F2F2', '#F2F2F2'], ['#6B1F2A', '#F3EEE2', '#F1ECE3', '#F3EEE2'],
  ['#B3262D', '#FFFFFF', '#F1ECE3', '#1D1D1F'], ['#E7C84A', '#1D1D1F', '#F3EEE2', '#1D1D1F'],
];
export const FOND_STUDIO = '#EDEBE7';
function graineDe(g) { let h = 7; for (const c of String(g)) h = (h * 131 + c.charCodeAt(0) * 7) >>> 0; return (h ^ (h >>> 13)) >>> 0; }
export function basketSvg(graine, fond = FOND_STUDIO) {
  const h = graineDe(graine);
  const [corps, bande, semelle, renfort] = COLORIS[h % COLORIS.length];
  const miroir = (h >>> 9) % 2 ? '' : ' transform="translate(832 0) scale(-1 1)"';
  const s = (h >>> 11) % 3 === 0 ? 24 : 0; // grosse semelle : le dessus remonte
  const y = (v) => v - s;
  const trait = '#26282B';
  const dessus = `M120 ${y(505)} C118 ${y(470)} 140 ${y(450)} 182 ${y(440)} C240 ${y(426)} 290 ${y(410)} 330 ${y(386)} L430 ${y(332)} C452 ${y(320)} 472 ${y(314)} 496 ${y(318)} C520 ${y(304)} 546 ${y(304)} 562 ${y(320)} C600 ${y(332)} 640 ${y(322)} 668 ${y(332)} C700 ${y(346)} 712 ${y(400)} 712 ${y(450)} L716 ${y(505)} Z`;
  const mi = y(505) + (532 - y(505)) * 0.55;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="36 -40 760 950">
<defs>
<linearGradient id="lu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".30"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>
<linearGradient id="se" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".10"/></linearGradient>
<radialGradient id="om" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset=".6" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="fd" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<clipPath id="cd"><path d="${dessus}"/></clipPath>
</defs>
<rect x="0" y="-60" width="840" height="1060" fill="${fond}"/><rect x="0" y="-60" width="840" height="1060" fill="url(#fd)"/>
<ellipse cx="416" cy="556" rx="340" ry="34" fill="url(#om)"/>
<g${miroir}>
<path d="M584 ${y(318)} C590 ${y(288)} 612 ${y(280)} 628 ${y(290)} C634 ${y(300)} 630 ${y(318)} 620 ${y(326)} Z" fill="${corps}" stroke="${trait}" stroke-opacity=".45" stroke-width="2.5"/>
<path d="${dessus}" fill="${corps}"/>
<g clip-path="url(#cd)">
<path d="M100 ${y(520)} C100 ${y(470)} 130 ${y(440)} 182 ${y(430)} C222 ${y(424)} 252 ${y(440)} 262 ${y(480)} L266 ${y(520)} Z" fill="${renfort}"/>
<path d="M610 ${y(320)} C670 ${y(314)} 720 ${y(360)} 724 ${y(430)} L726 ${y(520)} L640 ${y(520)} C652 ${y(460)} 648 ${y(388)} 610 ${y(320)} Z" fill="${renfort}"/>
<path d="M330 ${y(386)} L430 ${y(332)} C452 ${y(320)} 472 ${y(314)} 496 ${y(318)} L512 ${y(346)} C470 ${y(350)} 420 ${y(380)} 352 ${y(420)} Z" fill="${renfort}" opacity=".35"/>
<path d="M296 ${y(492)} C380 ${y(444)} 470 ${y(412)} 598 ${y(404)} C622 ${y(403)} 628 ${y(422)} 606 ${y(428)} C500 ${y(444)} 424 ${y(470)} 344 ${y(510)} L296 ${y(510)} Z" fill="${bande}"/>
<rect x="100" y="${y(290)}" width="640" height="250" fill="url(#lu)"/>
</g>
<path d="M190 ${y(442)} C228 ${y(436)} 250 ${y(452)} 256 ${y(486)}" fill="none" stroke="${trait}" stroke-opacity=".35" stroke-width="2" stroke-dasharray="6 6"/>
<path d="M306 ${y(482)} C384 ${y(438)} 470 ${y(410)} 596 ${y(398)}" fill="none" stroke="${trait}" stroke-opacity=".28" stroke-width="2" stroke-dasharray="6 6"/>
<path d="${dessus}" fill="none" stroke="${trait}" stroke-opacity=".55" stroke-width="3" stroke-linejoin="round"/>
<path d="M500 ${y(318)} C522 ${y(310)} 548 ${y(311)} 562 ${y(322)} C544 ${y(334)} 518 ${y(332)} 500 ${y(318)} Z" fill="#26282B" opacity=".8"/>
<g stroke="${trait}" stroke-opacity=".7" stroke-width="5" stroke-linecap="round" fill="none">
<path d="M352 ${y(386)} L368 ${y(404)} M376 ${y(372)} L392 ${y(390)} M400 ${y(359)} L416 ${y(377)} M424 ${y(347)} L440 ${y(365)} M448 ${y(336)} L464 ${y(354)}"/>
<path d="M470 ${y(330)} C486 ${y(306)} 500 ${y(300)} 506 ${y(312)} M472 ${y(332)} C462 ${y(306)} 470 ${y(292)} 482 ${y(298)}" stroke-width="4"/>
</g>
<path d="M110 ${y(505)} L722 ${y(505)} L721 532 C600 544 260 544 130 538 C114 536 106 524 110 ${y(505)} Z" fill="${semelle}"/>
<path d="M110 ${y(505)} L722 ${y(505)} L721 532 C600 544 260 544 130 538 C114 536 106 524 110 ${y(505)} Z" fill="url(#se)"/>
<path d="M126 ${mi} C300 ${mi + 5} 560 ${mi + 5} 718 ${mi}" fill="none" stroke="${trait}" stroke-opacity=".18" stroke-width="2.5"/>
<path d="M130 538 C260 544 600 544 721 532 L720 546 C600 556 260 556 136 550 C126 549 124 544 130 538 Z" fill="#2B2B2B" opacity=".85"/>
<path d="M110 ${y(505)} L722 ${y(505)} L720 546 C600 556 260 556 136 550 C118 548 106 530 110 ${y(505)} Z" fill="none" stroke="${trait}" stroke-opacity=".45" stroke-width="3" stroke-linejoin="round"/>
</g></svg>`;
}
export const photo = (graine) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(basketSvg(graine));
// Un QR INVENTÉ (motif de démonstration, il ne se lit pas). VRM n'en fabrique jamais : il montre l'image reçue du transporteur.
export function qr(graine) {
  let g = 0; for (const c of String(graine)) g = (g * 31 + c.charCodeAt(0)) >>> 0;
  const n = 29, c = 8; let s = '';
  const fin = (x, y) => `<rect x="${x * c}" y="${y * c}" width="${7 * c}" height="${7 * c}"/><rect x="${(x + 1) * c}" y="${(y + 1) * c}" width="${5 * c}" height="${5 * c}" fill="#fff"/><rect x="${(x + 2) * c}" y="${(y + 2) * c}" width="${3 * c}" height="${3 * c}"/>`;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g = (g * 1103515245 + 12345) >>> 0; const coin = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9); if (!coin && (g >>> 16) % 2) s += `<rect x="${x * c}" y="${y * c}" width="${c}" height="${c}"/>`; }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n * c} ${n * c}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#111">${s}${fin(0, 0)}${fin(n - 7, 0)}${fin(0, n - 7)}</g></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
