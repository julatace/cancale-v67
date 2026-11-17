// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE O « GALERIE » — DONNÉES INVENTÉES (aucune donnée réelle : le dépôt est public).
//  40 annonces (5 sans photo, deux paires sous le même N° pour montrer le seul rouge),
//  15 ventes, 10 achats, 3 colis à retirer (code + QR), 3 comptes.
//  Règles gardées : une paire rejoint sa vente par l'id de SON annonce (jamais le titre) ;
//  un coût pas saisi reste `null` (« — ») ; une date limite pas lue n'est pas devinée.
//  Les photos sont des DESSINS (une basket de profil sur fond de studio), pas des photos.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const MAINTENANT = Date.parse('2026-11-17T10:00:00+01:00');
  const J = 86400000, H = 3600000;
  const COMPTES = ['atelier_sneakers_paris', 'second_compte_vintage', 'troisieme_dressing_lyon69'];
  const MODELES = [
    ['Adidas', 'Samba OG blanche'], ['Nike', 'Air Max 1 ’86 Big Bubble'], ['New Balance', '550 crème vert'], ['Salomon', 'XT-6 noire'],
    ['Asics', 'Gel-1130 argent'], ['Adidas', 'Gazelle bleu nuit'], ['Nike', 'Dunk Low Panda'], ['Vans', 'Old Skool noire'],
    ['New Balance', '2002R grise'], ['Adidas', 'Spezial bordeaux'], ['Nike', 'Air Force 1 blanche'], ['Asics', 'Gel-Kayano 14 crème'],
    ['Salomon', 'ACS Pro sable'], ['Adidas', 'Campus 00s vert'], ['New Balance', '9060 bleu ciel'], ['Nike', 'Cortez rouge'],
  ];
  const ETATS = ['Très bon état', 'Neuf avec étiquette', 'Bon état', 'Très bon état'];

  // ── LE DESSIN D'UNE BASKET (une fois, proprement) : un modèle bas de profil, détouré sur un fond
  //    de studio uni, mêmes proportions partout ; seuls les coloris changent (12, tirés d'une graine stable).
  const COLORIS = [
    // tige, empiècement, talon/pointe, intérieur du col, semelle intermédiaire, semelle
    ['#F7F6F2', '#1D1E21', '#1D1E21', '#2A2B2F', '#FBFAF7', '#F1EFEA'],
    ['#F7F6F2', '#C8322B', '#B9BCC2', '#C8322B', '#FBFAF7', '#E8E4DC'],
    ['#EFE6D2', '#2F5B43', '#2F5B43', '#2F5B43', '#F6F1E6', '#B98552'],
    ['#25262A', '#3A3B40', '#16171A', '#111214', '#2E2F33', '#1A1B1E'],
    ['#26324F', '#E9E3D5', '#26324F', '#E9E3D5', '#F3EFE6', '#B98552'],
    ['#C9CCD1', '#8E939B', '#F4F3F0', '#5F646C', '#F7F6F2', '#E4E1DA'],
    ['#F4F3EF', '#9CC3E4', '#F4F3EF', '#5E86AE', '#FBFAF7', '#E9E6DF'],
    ['#6B2232', '#F2EDE3', '#6B2232', '#F2EDE3', '#F4EFE5', '#B98552'],
    ['#E7D8BC', '#8B6A45', '#E7D8BC', '#8B6A45', '#F5EFE2', '#E9DFC9'],
    ['#F4F3EF', '#E3A23A', '#F4F3EF', '#2B2C30', '#FBFAF7', '#2B2C30'],
    ['#DCE3DB', '#4E6B57', '#F4F3EF', '#4E6B57', '#F7F6F2', '#E6E3DC'],
    ['#F4F3EF', '#B9BCC2', '#8E939B', '#5F646C', '#FBFAF7', '#E8E5DE'],
  ];
  function basket(graine) {
    let h = 2166136261; for (const c of String(graine)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const [tige, emp, talon, col, mid, sem] = COLORIS[h % COLORIS.length];
    const sombre = ['#25262A', '#26324F', '#6B2232'].includes(tige);
    const trait = sombre ? '#0C0D10' : '#2C2D31';
    const ligne = sombre ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.28)';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 400 400">
<defs>
<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>
<linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity=".08"/></linearGradient>
<filter id="o" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="7"/></filter>
</defs>
<rect width="400" height="400" fill="#F3F2EF"/>
<g transform="translate(200 208) scale(1.1) translate(-202 -211)">
<ellipse cx="204" cy="288" rx="150" ry="9" fill="#000" opacity=".22" filter="url(#o)"/>
<g stroke="${trait}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
<path d="M196 168 C198 146 210 132 226 132 C238 132 243 140 241 152 L232 170 Z" fill="${tige}"/>
<path d="M52 252 C46 232 58 216 86 208 L150 192 C172 186 190 172 204 157 C215 146 229 142 245 144 L287 150 C301 152 307 162 313 172 C323 188 339 198 351 212 C361 224 361 240 357 252 Z" fill="${tige}"/>
<path d="M204 157 C215 146 229 142 245 144 L287 150 C301 152 307 162 313 172 C297 167 269 163 241 163 C227 163 214 162 204 157 Z" fill="${col}"/>
<path d="M52 252 C47 236 58 221 84 213 L106 208 C97 222 96 238 104 252 Z" fill="${talon}"/>
<path d="M313 172 C323 188 339 198 351 212 C361 224 361 240 357 252 L323 252 C326 228 320 202 302 184 Z" fill="${talon}"/>
<path d="M150 192 C172 186 190 172 204 157 L223 164 C207 182 187 197 163 205 Z" fill="${emp}"/>
<path d="M120 252 C142 222 200 205 268 207 C298 208 318 216 333 228 L329 241 C300 231 251 228 212 235 C183 241 163 247 153 252 Z" fill="${emp}"/>
</g>
<path d="M52 252 C46 232 58 216 86 208 L150 192 C172 186 190 172 204 157 C215 146 229 142 245 144 L287 150 C301 152 307 162 313 172 C323 188 339 198 351 212 C361 224 361 240 357 252 Z" fill="url(#v)"/>
<g fill="none" stroke="${ligne}" stroke-width="1.4" stroke-dasharray="3 3"><path d="M108 248 C102 234 104 222 112 212"/><path d="M160 248 C186 230 236 216 300 222"/><path d="M318 248 C320 226 314 204 300 190"/></g>
<g stroke="${trait}" stroke-width="2.6" stroke-linecap="round"><path d="M168 194 l14 -10"/><path d="M181 185 l14 -11"/><path d="M193 175 l13 -11"/><path d="M204 164 l12 -9"/></g>
<g fill="${sombre ? '#E8E6E1' : '#2C2D31'}"><circle cx="166" cy="200" r="2.2"/><circle cx="180" cy="191" r="2.2"/><circle cx="192" cy="181" r="2.2"/><circle cx="203" cy="171" r="2.2"/></g>
<g stroke="${trait}" stroke-width="2.2" stroke-linejoin="round">
<path d="M44 252 H358 Q364 252 364 260 V268 Q364 274 358 274 H46 Q40 274 40 266 V260 Q40 252 44 252 Z" fill="${mid}"/>
<path d="M44 274 H360 Q364 274 364 280 Q364 290 352 290 H58 Q40 290 40 278 Q40 274 44 274 Z" fill="${sem}"/>
</g>
<path d="M44 254 H358 V266 H44 Z" fill="url(#m)" opacity=".7"/>
<path d="M60 282 H344" stroke="${trait}" stroke-width="1.2" opacity=".25" stroke-dasharray="6 5"/>
</g>
</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // ── 40 annonces en ligne ──
  const annonces = [];
  for (let i = 0; i < 40; i++) {
    const [marque, mod] = MODELES[(i * 5) % MODELES.length];
    const taille = 37 + ((i * 3) % 9);
    const numero = String(i === 17 ? 87 : 60 + i * 3);   // N° 87 porté par deux fiches : le seul rouge (§5)
    annonces.push({ id: 'a' + (7700001 + i), numero, titre: `${marque} ${mod} taille ${taille}`, taille: String(taille), etat: ETATS[i % 4],
      prix: (35 + ((i * 17) % 110)) * 100, cout: i % 4 === 3 ? null : (18 + ((i * 7) % 50)) * 100, jours: [1, 2, 2, 3, 5, 6, 8, 9, 12, 14, 17, 21, 23, 27, 31, 38, 44, 52, 61, 66, 72, 79, 85, 91, 98, 104, 112, 120, 133, 141, 150, 162, 171, 180, 188, 195, 203, 210, 214, 220][i],
      compte: COMPTES[i % 3], fav: (i * 3) % 11, vues: 40 + ((i * 37) % 260), photo: [2, 9, 21, 30, 36].includes(i) ? '' : basket('annonce-' + i) });
  }
  const doubles = new Set(['87']);

  // ── 15 ventes (6 à envoyer, 4 en route, 5 livrées) ──
  const PSEUDOS = ['ines_kicks_collector', 'thomas.martin92', 'lea_vintage_paris', 'hugo1307', 'chloe_shop', 'nathan75', 'camille-dressing', 'jules_sneakers', 'sarah.dubois', 'louis_lyon69', 'emma_kicks', 'adam_shop', 'zoe1307', 'gabriel75', 'jade-dressing'];
  const ventes = [];
  const VENTES = [
    ['envoyer', 0.8, 'Nike Air Max 1 ’86 OG Big Bubble Sport Red', 129, 62.4, 124, 1.2, 'XW482913307FR'],
    ['envoyer', 1.4, 'New Balance 550 crème vert taille 41', 96, 41, 309, 1.25, 'XW482913412FR'],
    ['envoyer', 1.9, 'Adidas Samba OG blanche taille 42', 88, null, 315, 3.4, 'XW482913519FR'],
    ['envoyer', 2.2, 'Salomon XT-6 noire taille 44', 118, 70, 321, null, null],
    ['envoyer', 3.1, 'Asics Gel-1130 argent taille 40', 74, 32, 327, null, null],
    ['envoyer', 3.6, 'Adidas Gazelle bleu nuit taille 39', 58, 24, 333, null, null],
    ['route', 4.2, 'Nike Dunk Low Panda taille 38', 92, 55, 339], ['route', 5.0, 'Vans Old Skool noire taille 43', 38, 12, 345],
    ['route', 6.3, 'New Balance 2002R grise taille 42', 104, 61, 351], ['route', 7.1, 'Adidas Spezial bordeaux taille 41', 72, null, 357],
    ['finie', 9.0, 'Nike Air Force 1 blanche taille 44', 64, 30, 363], ['finie', 10.5, 'Asics Gel-Kayano 14 crème taille 42', 115, 58, 369],
    ['finie', 12.0, 'Salomon ACS Pro sable taille 43', 126, 80, 375], ['finie', 13.2, 'Adidas Campus 00s vert taille 38', 66, 28, 381],
    ['finie', 15.5, 'New Balance 9060 bleu ciel taille 40', 138, null, 387],
  ];
  VENTES.forEach(([etat, ilya, titre, prix, cout, numero, limiteDans, suivi], i) => {
    ventes.push({ tx: String(23999000001 + i), etat, titre, prix: prix * 100, cout: cout == null ? null : Math.round(cout * 100), numero: String(numero),
      date: MAINTENANT - ilya * J, limite: limiteDans == null ? null : MAINTENANT + limiteDans * J, bordereau: limiteDans != null, suivi: suivi || null,
      pseudo: PSEUDOS[i], compte: COMPTES[i % 3], photo: basket('vente-' + i) });
  });

  // ── 10 achats (6 en route, 4 reçus) ──
  const achats = [];
  for (let i = 0; i < 10; i++) {
    const [marque, mod] = MODELES[(i * 3 + 1) % MODELES.length];
    achats.push({ tx: String(23888000001 + i), titre: `${marque} ${mod} taille ${38 + (i % 6)}`, prix: (24 + ((i * 11) % 60)) * 100 + (i % 3 ? 0 : 90),
      date: MAINTENANT - (1 + i * 1.7) * J, etat: i < 6 ? 'route' : 'recu', compte: COMPTES[(i + 1) % 3], photo: i === 4 ? '' : basket('achat-' + i) });
  }

  // ── 3 colis à retirer : le code et le lieu LUS dans l'e-mail du transporteur ──
  const colis = [
    { id: 'XR700000100FR', code: '482100', art: 'Adidas Samba OG blanche 42', point: 'Super U Cleunay', adresse: '27 rue de Cleunay, Rennes', limite: MAINTENANT + 2 * J },
    { id: 'XR700000101FR', code: '483479', art: 'New Balance 550 crème 41', point: 'Super U Cleunay', adresse: '27 rue de Cleunay, Rennes', limite: MAINTENANT + 2 * J },
    { id: 'XR700000104FR', code: '486237', art: 'Asics Gel-1130 argent 40', point: 'Tabac Le Narval', adresse: '4 place du Marché, Rennes', limite: MAINTENANT + 5 * J },
  ];

  window.VRM_O = { MAINTENANT, comptes: COMPTES, annonces, doubles, ventes, achats, colis };
})();
