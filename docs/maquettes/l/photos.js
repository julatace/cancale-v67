// Les « photos » : des baskets DESSINÉES, inventées, sans marque ni logo (le dépôt est public, aucune photo réelle).
// Fond de studio uni, ombre au sol, deux silhouettes (basse, à grosse semelle), 14 coloris. Format 4:5 (celui des apps de mode).
const COLORIS = [
  ['#F4F1EC', '#1E2A38', '#E9E4DA', '#B4232A'], ['#EDE6D6', '#2F5D3A', '#F6F1E6', '#2F5D3A'], ['#FFFFFF', '#111111', '#F2EFE8', '#111111'],
  ['#C9CED6', '#7B8592', '#EDEDED', '#3E6FB0'], ['#1D1D1F', '#FFFFFF', '#2B2B2D', '#D9D9D9'], ['#E8D9C4', '#8A5A3B', '#C49A6C', '#8A5A3B'],
  ['#D7DCE2', '#9AA3AD', '#F4F4F2', '#5D6670'], ['#2C4A7A', '#FFFFFF', '#E9E1CF', '#FFFFFF'], ['#F7F7F5', '#D9D6CF', '#FFFFFF', '#B9B9B4'],
  ['#BFC6CE', '#2D5BA8', '#ECEEF0', '#2D5BA8'], ['#202124', '#F2F2F2', '#F2F2F2', '#F2F2F2'], ['#6B1F2A', '#F3EEE2', '#F1ECE3', '#F3EEE2'],
  ['#B3262D', '#FFFFFF', '#F1ECE3', '#1D1D1F'], ['#E7C84A', '#1D1D1F', '#F3EEE2', '#1D1D1F'],
];
const FONDS = ['#E9E6E0', '#E4E6E8', '#ECE7E0', '#E3E7E3', '#E8E4E9', '#E6E8EA'];
export function photo(graine) {
  let h = 7; for (const c of String(graine)) h = (h * 131 + c.charCodeAt(0) * 7) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  const [corps, bande, semelle, detail] = COLORIS[h % COLORIS.length];
  const fond = FONDS[(h >>> 5) % FONDS.length];
  const miroir = (h >>> 9) % 2 ? '' : ' transform="translate(832 0) scale(-1 1)"';
  const s = (h >>> 11) % 3 === 0 ? 26 : 0; // grosse semelle : le dessus remonte
  const y = (v) => v - s;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="70 0 690 862">
<rect x="0" y="-60" width="830" height="1037" fill="${fond}"/>
<ellipse cx="415" cy="575" rx="310" ry="18" fill="#000" opacity=".14"/>
<g${miroir}>
<path d="M120 ${y(505)} C118 ${y(470)} 140 ${y(450)} 182 ${y(440)} C240 ${y(426)} 290 ${y(410)} 330 ${y(386)} L430 ${y(332)} C452 ${y(320)} 472 ${y(314)} 496 ${y(318)} C520 ${y(304)} 546 ${y(304)} 562 ${y(320)} C600 ${y(332)} 640 ${y(322)} 668 ${y(332)} C700 ${y(346)} 712 ${y(400)} 712 ${y(450)} L716 ${y(505)} Z" fill="${corps}" stroke="#1F2328" stroke-opacity=".5" stroke-width="3" stroke-linejoin="round"/>
<path d="M120 ${y(505)} C118 ${y(470)} 140 ${y(450)} 182 ${y(440)} C214 ${y(433)} 244 ${y(444)} 252 ${y(476)} L256 ${y(505)} Z" fill="${detail}" opacity=".9"/>
<path d="M622 ${y(338)} C664 ${y(330)} 702 ${y(360)} 708 ${y(420)} L712 ${y(505)} L634 ${y(505)} C646 ${y(452)} 644 ${y(392)} 622 ${y(338)} Z" fill="${detail}" opacity=".9"/>
<path d="M300 ${y(486)} C380 ${y(440)} 470 ${y(410)} 596 ${y(402)} C618 ${y(401)} 624 ${y(418)} 604 ${y(424)} C500 ${y(440)} 420 ${y(466)} 342 ${y(505)} L300 ${y(505)} Z" fill="${bande}" opacity=".95"/>
<path d="M496 ${y(318)} C520 ${y(311)} 546 ${y(312)} 562 ${y(322)} C542 ${y(331)} 516 ${y(330)} 496 ${y(318)} Z" fill="#1F2328" opacity=".55"/>
<path d="M352 ${y(384)} L366 ${y(402)} M376 ${y(370)} L390 ${y(388)} M400 ${y(357)} L414 ${y(375)} M424 ${y(345)} L438 ${y(363)} M448 ${y(334)} L462 ${y(352)}" stroke="#1F2328" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>
<path d="M110 ${y(505)} L722 ${y(505)} L720 540 C600 552 260 552 132 544 C114 542 106 526 110 ${y(505)} Z" fill="${semelle}" stroke="#1F2328" stroke-opacity=".4" stroke-width="3" stroke-linejoin="round"/>
</g></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
// Un QR INVENTÉ (motif de démonstration, il ne se lit pas). VRM n'en fabrique jamais : il montre l'image reçue du transporteur.
export function qr(graine) {
  let g = 0; for (const c of String(graine)) g = (g * 31 + c.charCodeAt(0)) >>> 0;
  const n = 29, c = 8; let s = '';
  const fin = (x, y) => `<rect x="${x * c}" y="${y * c}" width="${7 * c}" height="${7 * c}"/><rect x="${(x + 1) * c}" y="${(y + 1) * c}" width="${5 * c}" height="${5 * c}" fill="#fff"/><rect x="${(x + 2) * c}" y="${(y + 2) * c}" width="${3 * c}" height="${3 * c}"/>`;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g = (g * 1103515245 + 12345) >>> 0; const coin = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9); if (!coin && (g >>> 16) % 2) s += `<rect x="${x * c}" y="${y * c}" width="${c}" height="${c}"/>`; }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n * c} ${n * c}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#111">${s}${fin(0, 0)}${fin(n - 7, 0)}${fin(0, n - 7)}</g></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
