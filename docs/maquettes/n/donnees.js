// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE N — LE JEU DE DONNÉES (INVENTÉ, aucune donnée réelle : le dépôt est public).
//  40 annonces · 15 ventes · 10 achats · 3 colis à retirer (code ; QR seulement chez Chronopost,
//  qui en héberge un vrai — Mondial Relay n'en a pas) · 2 offres · le porte-monnaie du mois.
//  Les identités suivent §5 : une paire = son N° ; une vente = son n° de transaction ; un colis = son n° de suivi.
//  « maintenant » est FIXE (mardi 17 novembre 2026, 10:40 à Paris) pour que les captures ne bougent pas.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const MAINTENANT = Date.parse('2026-11-17T09:40:00Z');
  const H = 3600e3, J = 24 * H;
  const il = (ms) => new Date(MAINTENANT - ms).toISOString();
  const dans = (ms) => new Date(MAINTENANT + ms).toISOString();
  const C = ['atelier_sneakers_paris', 'second_compte_vintage', 'troisieme_dressing_lyon69'];

  const MODELES = [
    ['Nike Air Max 1 ’86 OG Big Bubble', 'rouge'], ['Adidas Samba OG', 'blanche'], ['New Balance 550', 'crème'], ['Salomon XT-6', 'noire'],
    ['Asics Gel-1130', 'argent'], ['Nike Dunk Low Panda', ''], ['Adidas Gazelle Indoor', 'bleue'], ['New Balance 2002R', 'grise'],
    ['Vans Old Skool', 'noire'], ['Nike Air Force 1 ’07', 'blanche'], ['Asics Gel-Kayano 14', 'argent'], ['Adidas Spezial Handball', 'verte'],
    ['New Balance 990v6', 'grise'], ['Nike Air Max 90', 'infrarouge'], ['Salomon ACS Pro', 'beige'], ['Puma Palermo', 'verte'],
    ['Nike Cortez', 'blanche'], ['Onitsuka Tiger Mexico 66', 'jaune'], ['Adidas Campus 00s', 'grise'], ['New Balance 1906R', 'argent'],
  ];
  const TEINTES = [4, 210, 40, 220, 200, 0, 215, 30, 0, 45, 205, 140, 220, 10, 35, 150, 0, 50, 220, 205];

  // ── 40 ANNONCES EN LIGNE ── (N° écrit sur le carton ; 2 sans N° ; 6 qui dorment, plus de 60 jours)
  const annonces = [];
  for (let i = 0; i < 40; i++) {
    const m = MODELES[i % MODELES.length];
    const jours = i < 6 ? 64 + i * 9 : (i * 3) % 52;
    annonces.push({
      id: 'A' + (7700 + i), numero: i === 17 || i === 31 ? null : String(1180 + i), titre: `${m[0]}${m[1] ? ' ' + m[1] : ''}`, taille: String(38 + (i % 8)),
      prix: [95, 70, 85, 140, 110, 90, 75, 120, 55, 80][i % 10] + (i % 3) * 5, jours, favoris: (i * 7) % 13, compte: C[i % 3], teinte: TEINTES[i % 20],
    });
  }

  // ── 15 VENTES ── (état de commande lu ; bordereau et date limite lus dans l'e-mail ; coût saisi par lui ou rien)
  const V = (tx, numero, mi, taille, prix, compte, il_, etat, extra = {}) => ({ tx, numero, titre: MODELES[mi][0] + (MODELES[mi][1] ? ' ' + MODELES[mi][1] : ''), taille, prix, compte, date: il(il_), etat, teinte: TEINTES[mi], ...extra });
  const ventes = [
    V('23999000101', '1204', 0, '43', 129, C[0], 2 * H, 'envoyer', { limite: dans(32 * H + 20 * 60e3), cout: 62.4 }),
    V('23999000102', '1187', 2, '41', 85, C[1], 5 * H, 'envoyer', { limite: dans(32 * H + 20 * 60e3), cout: 38 }),
    V('23999000103', '1211', 3, '44', 140, C[0], 9 * H, 'envoyer', { limite: dans(32 * H + 20 * 60e3), cout: 71 }),
    V('23999000104', '1199', 5, '38', 90, C[2], 20 * H, 'envoyer', { limite: dans(32 * H + 20 * 60e3), cout: null }),
    V('23999000105', '1162', 1, '42', 75, C[0], 26 * H, 'envoyer', { limite: dans(2 * J + 9 * H), cout: 30 }),
    V('23999000106', '1158', 7, '40', 120, C[1], 30 * H, 'envoyer', { limite: dans(2 * J + 9 * H), cout: 55 }),
    V('23999000107', '1149', 9, '45', 80, C[2], 44 * H, 'sansbord', { cout: 35 }),
    V('23999000108', '1133', 4, '40', 110, C[0], 3 * J, 'route', { cout: 48 }),
    V('23999000109', '1127', 12, '42', 160, C[1], 4 * J, 'route', { cout: 82 }),
    V('23999000110', '1118', 6, '39', 70, C[2], 4 * J + 5 * H, 'route', { cout: null }),
    V('23999000111', '1102', 10, '41', 115, C[0], 6 * J, 'finie', { verseLe: il(1 * J + 3 * H), cout: 60 }),
    V('23999000112', '1097', 8, '43', 55, C[1], 7 * J, 'finie', { verseLe: il(2 * J), cout: 22 }),
    V('23999000113', '1088', 11, '42', 90, C[0], 8 * J, 'finie', { verseLe: il(3 * J + 6 * H), cout: null }),
    V('23999000114', '1076', 13, '44', 135, C[2], 10 * J, 'finie', { verseLe: il(5 * J), cout: 70 }),
    V('23999000115', '1069', 15, '41', 85, C[1], 13 * J, 'finie', { verseLe: il(8 * J), cout: 41 }),
  ];

  // ── 10 ACHATS ── (sur ses comptes d'achat ; l'état lu sur Vinted)
  const A = (tx, mi, taille, prix, compte, il_, etat) => ({ tx, titre: MODELES[mi][0] + (MODELES[mi][1] ? ' ' + MODELES[mi][1] : ''), taille, prix, compte, date: il(il_), etat, teinte: TEINTES[mi] });
  const achats = [
    A('23888000201', 1, '42', 48, C[1], 3 * J, 'point'), A('23888000202', 2, '41', 52.9, C[1], 3 * J + 4 * H, 'point'), A('23888000203', 5, '38', 61, C[0], 4 * J, 'point'),
    A('23888000204', 16, '43', 39, C[2], 1 * J, 'route'), A('23888000205', 18, '40', 44.5, C[1], 1 * J + 7 * H, 'route'), A('23888000206', 13, '42', 72, C[0], 2 * J, 'route'),
    A('23888000207', 19, '44', 88, C[2], 6 * J, 'recu'), A('23888000208', 14, '41', 65, C[1], 8 * J, 'recu'), A('23888000209', 17, '39', 41, C[0], 9 * J, 'recu'), A('23888000210', 3, '44', 79, C[2], 12 * J, 'recu'),
  ];

  // ── 3 COLIS À RETIRER ── (l'e-mail du transporteur : point, code, date limite ; le QR seulement s'il est réel)
  const Q = window.QR_FIXTURE || {};
  const colis = [
    { suivi: 'XR700000100FR', achat: '23888000201', transporteur: 'Chronopost', point: 'Super U Cleunay', adresse: '27 rue de Cleunay, Rennes', code: '482100', limite: dans(2 * J + 9 * H), qr: Q['CHR-XR700000100FR-482100'] || '' },
    { suivi: 'XR700000101FR', achat: '23888000202', transporteur: 'Chronopost', point: 'Super U Cleunay', adresse: '27 rue de Cleunay, Rennes', code: '483479', limite: dans(3 * J + 9 * H), qr: Q['CHR-XR700000101FR-483479'] || '' },
    { suivi: '48291733', achat: '23888000203', transporteur: 'Mondial Relay', point: 'Tabac Le Narval', adresse: '4 place du Marché, Rennes', code: 'MR7716', limite: dans(4 * J + 6 * H), qr: '' },
  ];

  // ── 2 OFFRES ── (dans SA conversation ; l'annonce par son id)
  const offres = [
    { conv: 'C52999000301', annonce: 'A7704', pseudo: 'ines_kicks', montant: 95, date: il(2 * H) },
    { conv: 'C52999000302', annonce: 'A7712', pseudo: 'adam.martin92', montant: 62, date: il(7 * H) },
  ];

  // ── LE PORTE-MONNAIE ── (ce que Vinted annonce) et les versements datés au jour du versement (450)
  const portemonnaie = { disponible: 90, attente: 360 };

  window.FIXTURE = { MAINTENANT, comptes: C, annonces, ventes, achats, colis, offres, portemonnaie };
})();
