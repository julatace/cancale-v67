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

  // ── Le dessin d'une basket, d'après une graine stable ──
  const UPPERS = ['#F4F3EF', '#1F2024', '#EAE0CB', '#B8BCC2', '#25324E', '#2E4A3A', '#6A2331', '#D8C29E', '#A8C5E2', '#C9372F', '#F1F1EE', '#3A3B40'];
  const ACCENTS = ['#1F2024', '#C9372F', '#2B5DAA', '#2E6B47', '#E0A43A', '#F4F3EF', '#7A4B2A', '#8FA9C9'];
  const SOLES = ['#F6F5F1', '#F6F5F1', '#C69256', '#F6F5F1', '#2A2B2F'];
  function basket(graine) {
    let h = 2166136261; for (const c of String(graine)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const r = (n) => { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return h % n; };
    const up = UPPERS[r(UPPERS.length)]; let ac = ACCENTS[r(ACCENTS.length)]; if (ac === up) ac = ACCENTS[(ACCENTS.indexOf(ac) + 1) % ACCENTS.length];
    const so = SOLES[r(SOLES.length)]; const forme = r(3); const tf = 30 + r(12);
    const fond = ['#F1F0EE', '#EEF0F2', '#F2F0EC', '#EFEFEF'][r(4)];
    const trait = ['#1F2024', '#3A3B40', '#25324E'].includes(up) ? '#0E0F12' : '#3B3B3E';
    const haut = forme === 2 ? 'C206 150 214 96 244 92 L300 92 C306 120 316 170 330 196' : forme === 1 ? 'C200 168 214 150 236 152 C256 154 264 172 284 182' : 'C196 168 212 150 234 150 C252 150 260 168 278 178';
    const base = forme === 1 ? 256 : 262;
    const semelle = forme === 1 ? `<path d="M52 256 L348 256 Q358 256 358 268 L358 286 Q358 296 346 296 L64 296 Q50 296 50 284 Z" fill="${so}" stroke="${trait}" stroke-width="2.5"/><path d="M56 276 L354 276" stroke="${trait}" stroke-width="2" opacity=".35"/>`
      : `<path d="M56 262 L344 262 Q352 262 352 272 L352 280 Q352 290 340 290 L66 290 Q54 290 54 278 Z" fill="${so}" stroke="${trait}" stroke-width="2.5"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 400 400"><rect width="400" height="400" fill="${fond}"/>
<g transform="translate(10 ${tf - 6}) scale(0.95)"><ellipse cx="204" cy="${base + 34}" rx="160" ry="9" fill="#000" opacity=".08"/>
<path d="M60 ${base} C58 230 82 216 114 208 L168 192 ${haut} C310 196 334 204 342 226 C348 240 348 252 344 ${base} Z" fill="${up}" stroke="${trait}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M60 ${base} C59 242 70 230 92 224 L118 ${base} Z" fill="${ac}" opacity=".9"/>
<path d="M150 ${base - 8} C184 220 246 206 306 220 L312 238 C252 230 198 238 168 ${base - 4} Z" fill="${ac}"/>
<path d="M314 ${forme === 2 ? 120 : 200} C334 ${forme === 2 ? 150 : 210} 344 222 344 242 L330 244 C328 226 322 214 308 ${forme === 2 ? 132 : 206} Z" fill="${ac}"/>
<g stroke="${trait}" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M182 ${forme === 2 ? 178 : 186} l12 -8 M198 ${forme === 2 ? 166 : 176} l12 -8 M214 ${forme === 2 ? 152 : 166} l12 -8 ${forme === 2 ? 'M230 136 l12 -8 M244 118 l12 -6' : ''}"/></g>
${semelle}</g></svg>`;
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
