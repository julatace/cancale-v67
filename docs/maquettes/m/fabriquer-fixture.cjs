// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE M « UNE MAIN » — la FIXTURE (17 nov.). Tout est INVENTÉ (le dépôt est public) :
//  aucun pseudo, aucune vente, aucun code réels. `node docs/maquettes/m/fabriquer-fixture.cjs`
//  réécrit fixture.js. La page (index.html) n'importe RIEN de src/ : elle lit seulement ce fichier.
//
//  Les identités suivent les règles de VRM (§5) : une paire = un N° ; une vente porte le N° de SON
//  annonce (par son id, jamais par le titre) ; un colis porte son code de retrait ; le QR n'existe que
//  quand le transporteur l'ENVOIE (Chronopost : une image) — Mondial Relay n'en a pas, on montre le code.
//  Ici le banc dessine l'image que Chronopost aurait envoyée (qrcode-generator), pour la maquette seulement.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const qrcode = require(require.resolve('qrcode-generator', { paths: [path.join(__dirname, '../../..'), '/home/user/cancale-v67'] }));

const MAINTENANT = Date.parse('2026-11-17T10:40:00+01:00');
const J = 86400000, H = 3600000;
const iso = (t) => new Date(t).toISOString();
const COMPTES = ['atelier_sneakers_paris', 'second_compte_vintage', 'troisieme_dressing_lyon69'];
// Des modèles plausibles, des titres comme on les écrit sur Vinted (courts ou longs : la page ne coupe rien).
const MODELES = [
  ['Adidas', 'Samba OG blanche', 18], ['Nike', 'Dunk Low Panda', 0], ['New Balance', '550 crème', 38], ['Salomon', 'XT-6 noire', 210],
  ['Asics', 'Gel-1130 argent', 200], ['Adidas', 'Gazelle bleu marine', 225], ['New Balance', '2002R gris', 30], ['Nike', 'Air Force 1 blanche', 40],
  ['Vans', 'Old Skool noire', 260], ['Adidas', 'Spezial Handball beige', 30], ['Nike', 'Air Max 90 Infrared', 355], ['Asics', 'Gel-Kayano 14 crème', 45],
  ['New Balance', '9060 sel de mer', 160], ['Nike', 'Cortez blanche et rouge', 0], ['Salomon', 'Speedcross 6 kaki', 95], ['Adidas', 'Campus 00s vert', 140],
  ['Nike', 'Air Max 1 ’86 Big Bubble', 5], ['Puma', 'Palermo bordeaux', 345], ['Onitsuka Tiger', 'Mexico 66 jaune', 48], ['Converse', 'Chuck 70 Hi noire', 220],
];
let graine = 7; const rnd = () => (graine = (graine * 16807) % 2147483647) / 2147483647;
const pick = (a) => a[Math.floor(rnd() * a.length)];

// 40 ANNONCES EN LIGNE (N° 101 à 140 ; deux sans N° ; six qui dorment depuis plus de 60 jours).
const annonces = [];
for (let i = 0; i < 40; i++) {
  const [marque, modele, teinte] = MODELES[(i * 7) % MODELES.length];
  const taille = 37 + ((i * 5) % 9);
  const jours = i < 6 ? 64 + i * 9 : Math.floor(rnd() * 50) + (i % 3);
  annonces.push({ id: String(5200001000 + i), numero: i === 11 || i === 27 ? null : String(101 + i), marque, titre: `${marque} ${modele} ${taille}`, taille: String(taille),
    prix: 3500 + Math.round(rnd() * 14) * 500, compte: COMPTES[i % 3], enLigneLe: iso(MAINTENANT - jours * J - 5 * H), fav: Math.floor(rnd() * 14), vues: 30 + Math.floor(rnd() * 400), teinte, cas: i < 30 ? `${'ABCD'[i % 4]}-${1 + (i % 6)}` : null });
}
annonces.sort((a, b) => Date.parse(b.enLigneLe) - Date.parse(a.enLigneLe));

// 15 VENTES : 6 à envoyer (4 bordereaux reçus avec leur date limite LUE, 2 sans bordereau), 4 en route, 5 payées (versées ce mois).
const ventes = [];
const etats = ['a_envoyer', 'a_envoyer', 'a_envoyer', 'a_envoyer', 'a_envoyer', 'a_envoyer', 'en_route', 'en_route', 'en_route', 'en_route', 'payee', 'payee', 'payee', 'payee', 'payee'];
const venduLe = [3, 9, 20, 26, 30, 44, 50, 70, 75, 98, 120, 150, 190, 240, 300];
etats.forEach((etat, i) => {
  const [marque, modele, teinte] = MODELES[(i * 3 + 1) % MODELES.length];
  const taille = 38 + ((i * 3) % 7);
  const date = MAINTENANT - venduLe[i] * H;
  const prix = 4500 + ((i * 1300) % 9000);
  const v = { tx: String(23990000100 + i), item: String(5200009000 + i), numero: String(80 + i), marque, titre: `${marque} ${modele} ${taille}`, prix, compte: COMPTES[i % 3], date: iso(date), etat, teinte,
    cout: i % 4 === 3 ? null : Math.round(prix * (0.42 + rnd() * 0.18) / 50) * 50, acheteur: null };
  if (etat === 'a_envoyer' && i < 4) v.bordereau = { suivi: `XW48${2913307 + i}FR`, limite: iso(MAINTENANT + [20, 30, 54, 78][i] * H), recu: iso(date + 2 * H) };
  if (etat === 'a_envoyer' && i >= 4) v.bordereau = null;
  if (etat === 'payee') v.verseLe = iso(MAINTENANT - [1, 2, 4, 9, 13][i - 10] * J - 3 * H);
  ventes.push(v);
});
// La paire racontée de bout en bout : N° 124 — achetée sur un autre compte, case B-3, vendue hier, bordereau reçu.
ventes.unshift({ tx: '23999000001', item: '7700000001', numero: '124', marque: 'Nike', titre: 'Nike Air Max 1 ’86 OG Big Bubble Sport Red 43', prix: 12900, compte: COMPTES[0], date: iso(MAINTENANT - 19 * H), etat: 'a_envoyer', teinte: 355,
  cout: 6240, bordereau: { suivi: 'XW482913307FR', limite: iso(MAINTENANT + 2 * J + 3 * H), recu: iso(MAINTENANT - 17 * H) }, achat: { tx: '23888000001', compte: COMPTES[1], date: iso(MAINTENANT - 33 * J), prix: 5890 }, cas: 'B-3', enLigneLe: iso(MAINTENANT - 24 * J), fav: 7, vues: 214 });
ventes.pop();   // toujours 15 ventes

// 10 ACHATS : 3 au point relais (les 3 colis à retirer), 5 en route, 2 arrivés (à numéroter).
const achats = [];
const ACH = [['Adidas', 'Samba OG blanche', 18, 42], ['New Balance', '550 crème', 38, 41], ['Asics', 'Gel-1130 argent', 200, 40], ['Nike', 'Dunk Low Panda', 0, 38], ['Salomon', 'XT-6 noire', 210, 44],
  ['Adidas', 'Gazelle bleu marine', 225, 43], ['Vans', 'Old Skool noire', 260, 43], ['New Balance', '2002R gris', 30, 42], ['Nike', 'Cortez blanche et rouge', 0, 39], ['Puma', 'Palermo bordeaux', 345, 41]];
ACH.forEach(([marque, modele, teinte, t], i) => achats.push({ tx: String(23777000100 + i), titre: `${marque} ${modele} ${t}`, marque, teinte, prix: 2200 + i * 450, compte: COMPTES[(i + 1) % 3],
  date: iso(MAINTENANT - (2 + i * 1.5) * J), etat: i < 3 ? 'au_point' : i < 8 ? 'en_route' : 'arrive' }));

// 3 COLIS À RETIRER : deux au même point (UN POINT = UNE CARTE), Chronopost (QR envoyé) ; un Mondial Relay (code seul).
const qrSvg = (texte) => { const q = qrcode(0, 'M'); q.addData(texte); q.make(); const n = q.getModuleCount(); let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
  return { n, d }; };
const colis = [
  { id: 'c1', achat: achats[0].tx, code: '482100', transporteur: 'Chronopost', point: 'Super U Cleunay', adresse: '27 rue de Cleunay, Rennes', limite: iso(MAINTENANT + 2 * J + 9 * H), art: achats[0].titre, teinte: achats[0].teinte, qr: qrSvg('CHR-XR700000100FR-482100') },
  { id: 'c2', achat: achats[1].tx, code: '483479', transporteur: 'Chronopost', point: 'Super U Cleunay', adresse: '27 rue de Cleunay, Rennes', limite: iso(MAINTENANT + 3 * J + 9 * H), art: achats[1].titre, teinte: achats[1].teinte, qr: qrSvg('CHR-XR700000101FR-483479') },
  { id: 'c3', achat: achats[2].tx, code: '486237', transporteur: 'Mondial Relay', point: 'Tabac Le Narval', adresse: '4 place du Marché, Rennes', limite: iso(MAINTENANT + 5 * J + 9 * H), art: achats[2].titre, teinte: achats[2].teinte, qr: null },
];

// LE MOIS : le solde que Vinted annonce (par compte) ; le reçu = la somme des versements DATÉS de ce mois (450).
const portemonnaie = [{ compte: COMPTES[0], dispo: 8450, attente: 21400 }, { compte: COMPTES[1], dispo: 3200, attente: 9650 }, { compte: COMPTES[2], dispo: 0, attente: 5800 }];
// Ce qui attend un geste et n'est pas une vente ou un achat : paires numérotées sans case ; rangées, en ligne nulle part.
const sansCase = annonces.filter((a) => a.numero && !a.cas).map((a) => a.numero);
const aPublier = [{ numero: '141', titre: 'Nike Air Max 90 blanche 41', teinte: 0, cas: 'D-2' }, { numero: '142', titre: 'Adidas Samba OG noire 40', teinte: 220, cas: 'D-2' }, { numero: '143', titre: 'New Balance 550 crème 39', teinte: 38, cas: 'D-3' }];

const fixture = { maintenant: iso(MAINTENANT), comptes: COMPTES, annonces, ventes, achats, colis, portemonnaie, sansCase, aPublier };
fs.writeFileSync(path.join(__dirname, 'fixture.js'), '// Généré par fabriquer-fixture.cjs — données INVENTÉES.\nwindow.FIXTURE = ' + JSON.stringify(fixture) + ';\n');
console.log('fixture.js :', annonces.length, 'annonces,', ventes.length, 'ventes,', achats.length, 'achats,', colis.length, 'colis');
