// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE I « L'ÉPURE » — FIXTURE INVENTÉE (aucune donnée réelle : le dépôt est public).
//  40 annonces · 15 ventes · 10 achats · 3 colis à retirer (code + QR) · les chiffres du mois.
//  Chaque vente est reliée à SA paire par son N° (posé à la numérotation, jamais par le titre).
//  Les chiffres du mois sont CALCULÉS depuis ces lignes (rien n'est écrit à la main deux fois).
// ════════════════════════════════════════════════════════════════════════════
window.VRM_FIXTURE = (() => {
  const AUJ = new Date(2026, 10, 17, 10, 40);   // mardi 17 novembre 2026, 10 h 40
  const J = 86400000;
  const jour = (n) => new Date(AUJ.getTime() + n * J);
  const C = ['atelier_sneakers_paris', 'second_compte_vintage', 'troisieme_dressing_lyon69'];

  const MODELES = [
    ['Nike Air Max 1 ’86 OG Big Bubble Sport Red', 43, 135], ['Adidas Samba OG blanche', 42, 79], ['New Balance 550 crème', 41, 89],
    ['Salomon XT-6 noire', 44, 120], ['Asics Gel-1130 argent', 40, 75], ['Nike Dunk Low Panda', 38, 85], ['Adidas Gazelle Indoor bleue', 39, 92],
    ['New Balance 2002R grise', 42, 110], ['Vans Old Skool noire', 43, 38], ['Nike Air Force 1 ’07 blanche', 44, 65],
    ['Asics Gel-Kayano 14 argent', 41, 115], ['Adidas Spezial Handball bordeaux', 40, 72], ['Nike Air Max 90 Infrared', 42, 105],
    ['New Balance 990v6 grise', 43, 160], ['Salomon ACS Pro vert sauge', 42, 135], ['Nike Cortez blanche et rouge', 39, 58],
    ['Adidas Campus 00s grise', 38, 70], ['Onitsuka Tiger Mexico 66 jaune', 41, 82], ['Nike Air Jordan 1 Low Chicago', 44, 140],
    ['New Balance 1906R argent', 42, 118],
  ];

  // 40 annonces en ligne (N° 1180 → 1219), dont 6 qui dorment (plus de 60 j) et 3 sans N°.
  const annonces = [];
  for (let i = 0; i < 40; i++) {
    const [t, taille, prix] = MODELES[(i * 7) % MODELES.length];
    const jours = i < 6 ? 64 + i * 11 : (i * 5) % 52 + 1;
    annonces.push({
      id: 'a' + (7700100 + i), num: i >= 37 ? null : String(1180 + i), titre: `${t} taille ${taille + (i % 3) - 1}`,
      prix: prix - (i % 4) * 5, jours, fav: (i * 3) % 13, compte: C[i % 5 === 0 ? 1 : i % 7 === 0 ? 2 : 0],
      case: i >= 37 ? null : 'ABCDE'[i % 5] + '-' + (1 + (i % 8)),
    });
  }

  // 15 ventes de novembre : 5 à envoyer (3 bordereaux reçus), 4 en route, 6 finies et versées.
  const V = (num, m, prix, acheteur, compte, etat, x = {}) => ({ tx: 'tx' + num, num: String(num), titre: `${MODELES[m][0]} taille ${MODELES[m][1]}`, prix, acheteur, compte: C[compte], etat, ...x });
  const ventes = [
    V(124, 0, 129, 'ines_kicks_collector', 0, 'envoyer', { bord: true, limite: jour(1.4), suivi: 'XW482913307FR', case: 'B-3', cout: 62.4, vendu: jour(-0.8) }),
    V(131, 5, 82, 'lucas.m75', 0, 'envoyer', { bord: true, limite: jour(1.4), suivi: 'XW482913341FR', case: 'B-3', cout: 41, vendu: jour(-1.1) }),
    V(118, 11, 70, 'camille_b', 1, 'envoyer', { bord: true, limite: jour(2.4), suivi: 'XW482913356FR', case: 'A-6', vendu: jour(-1.6) }),
    V(142, 2, 86, 'theo_sneakers', 2, 'envoyer', { bord: false, estimee: jour(6), case: 'C-2', cout: 38, vendu: jour(-0.2) }),
    V(147, 16, 68, 'manon.v', 0, 'envoyer', { bord: false, estimee: jour(6.5), case: 'D-1', vendu: jour(-0.1) }),
    V(97, 3, 118, 'hugo_run', 0, 'route', { suivi: 'XW482912001FR', cout: 70, vendu: jour(-3) }),
    V(103, 9, 62, 'lea_vintage', 1, 'route', { suivi: 'XW482912055FR', cout: 30, vendu: jour(-4) }),
    V(88, 14, 130, 'nathan.k', 0, 'route', { suivi: 'XW482912102FR', vendu: jour(-4.5) }),
    V(91, 6, 90, 'sarah_shoes', 2, 'route', { suivi: 'XW482912130FR', cout: 45, vendu: jour(-5) }),
    V(76, 7, 108, 'jules.p', 0, 'finie', { cout: 55, vendu: jour(-9), verse: jour(-2) }),
    V(81, 12, 102, 'emma_lyon', 2, 'finie', { cout: 48, vendu: jour(-10), verse: jour(-3) }),
    V(69, 4, 72, 'adam_b', 0, 'finie', { vendu: jour(-11), verse: jour(-4) }),
    V(72, 18, 138, 'chloe.r', 1, 'finie', { cout: 80, vendu: jour(-12), verse: jour(-6) }),
    V(64, 10, 112, 'louis_kicks', 0, 'finie', { cout: 60, vendu: jour(-13), verse: jour(-8) }),
    V(58, 1, 76, 'zoe.m', 0, 'finie', { cout: 35, vendu: jour(-15), verse: jour(-9) }),
  ];

  // 10 achats : 6 en route vers toi, 4 arrivés (à numéroter).
  const A = (m, taille, prix, compte, etat, n) => ({ titre: `${MODELES[m][0]} T${taille}`, prix, compte: C[compte], etat, date: jour(-n) });
  const achats = [
    A(13, 42, 64, 1, 'route', 0.5), A(8, 44, 18, 0, 'route', 0.9), A(15, 40, 28, 2, 'route', 1.2), A(19, 42, 61, 1, 'route', 1.8),
    A(2, 41, 39.9, 0, 'route', 2.2), A(17, 39, 33, 1, 'route', 2.6),
    A(5, 38, 42, 0, 'arrive', 3), A(11, 41, 34, 1, 'arrive', 3.4), A(3, 44, 58, 2, 'arrive', 4.1), A(1, 42, 36.5, 0, 'arrive', 4.6),
  ];

  // 3 colis à retirer : le code et la date limite LUS dans l'e-mail du transporteur. Un point = un groupe.
  const colis = [
    { code: '482100', titre: 'Adidas Samba OG blanche 42', point: 'Super U Cleunay', adresse: '27 rue de Cleunay · Rennes', limite: jour(2), transporteur: 'Chronopost' },
    { code: '483479', titre: 'New Balance 550 crème 41', point: 'Super U Cleunay', adresse: '27 rue de Cleunay · Rennes', limite: jour(2), transporteur: 'Chronopost' },
    { code: '486237', titre: 'Asics Gel-1130 argent 40', point: 'Tabac Le Narval', adresse: '4 place du Marché · Rennes', limite: jour(5), transporteur: 'Mondial Relay' },
  ];

  const offres = [
    { titre: 'Nike Air Max 90 Infrared taille 42', montant: 88, prix: 105, acheteur: 'kevin_92' },
    { titre: 'Salomon XT-6 noire taille 44', montant: 95, prix: 120, acheteur: 'anais.t' },
    { titre: 'Adidas Gazelle Indoor bleue taille 39', montant: 75, prix: 92, acheteur: 'yanis_s' },
    { titre: 'Nike Cortez blanche et rouge taille 39', montant: 45, prix: 58, acheteur: 'clara.d' },
  ];

  // Ce que Vinted annonce dans le porte-monnaie (lu, pas calculé).
  const porteMonnaie = { disponible: 90, attente: 398 };
  return { AUJ, comptes: C, annonces, ventes, achats, colis, offres, porteMonnaie };
})();
