// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE J « PREMIUM » — FIXTURE INVENTÉE (17 nov.). Aucune donnée réelle (le dépôt est public).
//  Les chiffres de l'écran sont CALCULÉS sur cette fixture (rien n'est écrit à la main deux fois) :
//  reçu du mois = somme des ventes VERSÉES ce mois (date de versement) ; bénéfice = seulement les ventes
//  dont le coût est saisi, couverture dite à côté ; une identité (N°, n° de transaction, code) relie,
//  jamais un titre. Ce qui n'est pas connu vaut `null` et s'affiche « — ».
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const J = 86400000;
  const NOW = Date.parse('2026-11-17T09:40:00+01:00');
  const COMPTES = ['atelier_sneakers_paris', 'second_compte_vintage', 'troisieme_dressing_lyon69'];
  const CATALOGUE = [
    ['Nike', 'Air Max 90', 'blanc et gris', 0], ['Adidas', 'Samba OG', 'noir et gomme', 1], ['New Balance', '550', 'crème et vert', 2],
    ['Salomon', 'XT-6', 'gris orage', 3], ['Asics', 'Gel-Kayano 14', 'argent', 4], ['Nike', 'Dunk Low', 'noir et blanc', 5],
    ['Adidas', 'Gazelle', 'bleu marine', 6], ['New Balance', '2002R', 'gris nuage', 7], ['Vans', 'Old Skool', 'noir', 8],
    ['Nike', 'Air Force 1', 'blanc', 9], ['Adidas', 'Spezial', 'bordeaux', 10], ['Asics', 'Gel-1130', 'blanc et argent', 11],
    ['New Balance', '990v6', 'gris', 7], ['Nike', 'Cortez', 'blanc et rouge', 12], ['Salomon', 'ACS Pro', 'sable', 13], ['Adidas', 'Campus 00s', 'gris foncé', 3],
  ];
  const modele = (i, t) => { const [m, mo, c, col] = CATALOGUE[i % CATALOGUE.length]; return { titre: `${m} ${mo} ${c}`, taille: t, coloris: col }; };
  const jour = (d) => new Date(NOW - d * J).toISOString();

  // 40 annonces en ligne (N° 1101 → 1140) ; 9 en ligne depuis plus de 60 jours.
  const annonces = [];
  for (let i = 0; i < 40; i++) {
    const m = modele(i * 3 + 1, 37 + (i % 9));
    const age = i < 31 ? (i * 7) % 58 + 1 : 64 + (i - 31) * 11;
    annonces.push({ id: 'a' + (7700001200 + i), numero: String(1101 + i), ...m, prix: 4500 + ((i * 1300) % 11000), age, fav: (i * 5) % 13, vues: 30 + (i * 37) % 260, compte: COMPTES[i % 3], cout: i % 4 === 3 ? null : 2400 + ((i * 900) % 5000) });
  }
  // 4 paires rangées, à publier (N° posé, case notée, aucune annonce ouverte).
  const aPublier = [0, 1, 2, 3].map((i) => ({ id: 'p' + i, numero: String(1141 + i), ...modele(i * 5 + 2, 39 + i), case: ['B-3', 'B-4', 'C-1', 'C-2'][i], cout: [3200, 4100, null, 2850][i], prix: null, age: null, fav: 0 }));

  // 15 ventes. 6 à envoyer (date limite LUE sur l'e-mail du bordereau, sauf une : estimée), 4 en route, 5 versées ce mois.
  const ventes = [
    { tx: '23999000001', numero: '124', titre: 'Nike Air Max 1 ’86 OG Big Bubble Sport Red', taille: 43, coloris: 14, prix: 12900, cout: 6240, etat: 'envoyer', limite: NOW + 3 * J + 6 * 3600e3, bord: true, acheteur: 'ines_kicks_collector', compte: COMPTES[0], vendue: jour(0.8) },
    { tx: '23999000002', numero: '303', ...modele(11, 40), prix: 9800, cout: 4400, etat: 'envoyer', limite: NOW + 30 * 3600e3, bord: true, acheteur: 'paul.m', compte: COMPTES[1], vendue: jour(1.2) },
    { tx: '23999000003', numero: '309', ...modele(1, 37), prix: 6800, cout: 3100, etat: 'envoyer', limite: NOW + 34 * 3600e3, bord: true, acheteur: 'lea_runs', compte: COMPTES[0], vendue: jour(1.4) },
    { tx: '23999000004', numero: '315', ...modele(7, 43), prix: 14100, cout: null, etat: 'envoyer', limite: NOW + 2.6 * J, bord: true, acheteur: 'sneak.nantes', compte: COMPTES[2], vendue: jour(2) },
    { tx: '23999000005', numero: '321', ...modele(13, 40), prix: 11100, cout: 5200, etat: 'envoyer', limite: NOW + 4 * J, bord: true, acheteur: 'margaux_v', compte: COMPTES[1], vendue: jour(2.5) },
    { tx: '23999000006', numero: '327', ...modele(3, 44), prix: 8100, cout: 3900, etat: 'envoyer', limite: null, estimee: NOW + 5 * J, bord: false, acheteur: 'tom.b', compte: COMPTES[0], vendue: jour(2) },
    { tx: '23999000007', numero: '298', ...modele(5, 42), prix: 9200, cout: 4800, etat: 'route', acheteur: 'nina_k', compte: COMPTES[0], vendue: jour(4) },
    { tx: '23999000008', numero: '295', ...modele(9, 41), prix: 8500, cout: 3600, etat: 'route', acheteur: 'yanis75', compte: COMPTES[2], vendue: jour(5) },
    { tx: '23999000009', numero: '290', ...modele(6, 39), prix: 7400, cout: null, etat: 'route', acheteur: 'claire.d', compte: COMPTES[1], vendue: jour(5.5) },
    { tx: '23999000010', numero: '287', ...modele(10, 38), prix: 10400, cout: 5100, etat: 'route', acheteur: 'jules_p', compte: COMPTES[0], vendue: jour(6) },
    { tx: '23999000011', numero: '281', ...modele(2, 42), prix: 12900, cout: 6100, etat: 'versee', versee: jour(0.3), acheteur: 'romane', compte: COMPTES[0], vendue: jour(8) },
    { tx: '23999000012', numero: '276', ...modele(4, 41), prix: 11600, cout: null, etat: 'versee', versee: jour(2.2), acheteur: 'kevin.l', compte: COMPTES[1], vendue: jour(9) },
    { tx: '23999000013', numero: '270', ...modele(8, 43), prix: 5900, cout: 2300, etat: 'versee', versee: jour(5.1), acheteur: 'sarah.b', compte: COMPTES[2], vendue: jour(12) },
    { tx: '23999000014', numero: '266', ...modele(12, 44), prix: 15400, cout: 7800, etat: 'versee', versee: jour(9.4), acheteur: 'antoine_r', compte: COMPTES[0], vendue: jour(15) },
    { tx: '23999000015', numero: '259', ...modele(0, 40), prix: 13200, cout: 5900, etat: 'versee', versee: jour(13.8), acheteur: 'manon.p', compte: COMPTES[1], vendue: jour(19) },
  ];

  // 3 colis à retirer (e-mails du transporteur : code, lieu, date limite LUS) — un point = une carte.
  const colis = [
    { suivi: 'XR700000100FR', code: '482100', point: 'Super U Cleunay', adresse: '27 rue de Cleunay, Rennes', transporteur: 'Chronopost', limite: NOW + 1.4 * J, achat: 'b1' },
    { suivi: 'XR700000101FR', code: '483479', point: 'Super U Cleunay', adresse: '27 rue de Cleunay, Rennes', transporteur: 'Chronopost', limite: NOW + 3 * J, achat: 'b2' },
    { suivi: 'XR700000104FR', code: '777316', point: 'Tabac Le Narval', adresse: '4 place du Marché, Rennes', transporteur: 'Mondial Relay', limite: NOW + 5 * J, achat: 'b3' },
  ];
  // 10 achats : 3 au point (les colis ci-dessus, par leur n° de transaction), 4 en route, 3 arrivés.
  const achats = [
    { id: 'b1', ...modele(1, 42), prix: 3800, etat: 'point', vendeur: 'julie_dressing', compte: COMPTES[1], date: jour(3) },
    { id: 'b2', ...modele(2, 41), prix: 4200, etat: 'point', vendeur: 'mat.collect', compte: COMPTES[0], date: jour(3.5) },
    { id: 'b3', ...modele(3, 44), prix: 5600, etat: 'point', vendeur: 'run_lyon', compte: COMPTES[2], date: jour(4) },
    { id: 'b4', ...modele(4, 40), prix: 3100, etat: 'route', vendeur: 'sami_shop', compte: COMPTES[0], date: jour(1) },
    { id: 'b5', ...modele(5, 38), prix: 2900, etat: 'route', vendeur: 'lou.vintage', compte: COMPTES[1], date: jour(1.5) },
    { id: 'b6', ...modele(6, 42), prix: 4500, etat: 'route', vendeur: 'baskets_bdx', compte: COMPTES[2], date: jour(2) },
    { id: 'b7', ...modele(7, 43), prix: 6100, etat: 'route', vendeur: 'eva.k', compte: COMPTES[0], date: jour(2.4) },
    { id: 'b8', ...modele(8, 41), prix: 2600, etat: 'arrive', vendeur: 'hugo_m', compte: COMPTES[1], date: jour(6) },
    { id: 'b9', ...modele(9, 40), prix: 3300, etat: 'arrive', vendeur: 'clem_shoes', compte: COMPTES[0], date: jour(7) },
    { id: 'b10', ...modele(10, 39), prix: 3900, etat: 'arrive', vendeur: 'nico.r', compte: COMPTES[2], date: jour(8) },
  ];
  // Le porte-monnaie : ce que VINTED annonce (somme des comptes), relevé il y a 1 h.
  const porteMonnaie = { disponible: 41260, attente: 26800 };

  window.VRM_J = { NOW, J, COMPTES, annonces, aPublier, ventes, colis, achats, porteMonnaie };
})();
