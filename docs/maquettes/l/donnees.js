// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE L « Le dressing » — DONNÉES INVENTÉES (aucune donnée réelle : le dépôt est public).
//  40 annonces · 15 ventes · 10 achats · 3 colis à retirer (code + QR quand il existe vraiment).
//  Chaque paire porte l'état que les règles de VRM lui donneraient (CLAUDE.md §5) : « vendue »
//  prouvée par un état de commande, « en ligne » par une lecture du dressing < 24 h, le code de
//  retrait relié à l'achat par SON n° de transaction, deux paires sous un N° ⇒ à vérifier (rouge).
//  Les « photos » sont des dessins de baskets inventés, sans marque ni logo (photos.js).
// ════════════════════════════════════════════════════════════════════════════
const J = 86400000;
export const MAINTENANT = Date.parse('2026-11-17T10:00:00+01:00');
const il = (j) => new Date(MAINTENANT - j * J).toISOString();
const dans = (j) => new Date(MAINTENANT + j * J).toISOString();
const COMPTES = ['atelier_sneakers_paris', 'second_compte_vintage', 'troisieme_dressing_lyon'];
const MODELES = [
  ['Nike Air Max 1 ’86 OG', 42], ['New Balance 550 crème', 43], ['Adidas Samba OG blanche', 41], ['Asics Gel-1130 argent', 44],
  ['Nike Dunk Low Panda', 42], ['Salomon XT-6 noire', 43], ['New Balance 2002R grise', 42], ['Adidas Gazelle Indoor bleue', 40],
  ['Nike Air Force 1 ’07', 45], ['Asics Gel-Kayano 14', 42], ['Vans Old Skool noire', 41], ['Nike Vomero 5 argent', 43],
  ['Puma Speedcat rouge', 39], ['Onitsuka Tiger Mexico 66', 40], ['New Balance 990v6 grise', 44], ['Adidas Spezial bordeaux', 42],
];
let n = 201, k = 0;
const paire = (o) => { const [titre, taille] = MODELES[k++ % MODELES.length]; return { cle: 'p' + (n), numero: String(n++), titre, taille, photo: 'v' + k, compte: COMPTES[k % 2], ...o }; };

export const PAIRES = [];
// 15 VENTES : 6 à envoyer (bordereau reçu, date limite LUE sur le bordereau), 5 vendues pas parties ou en route, 4 payées
[0.6, 1.4, 2.6, 2.6, 3.5, 5.5].forEach((lim, i) => PAIRES.push(paire({ etat: 'envoyer', prix: 8800 + i * 600, cout: i === 3 ? null : 4200 + i * 300, vendueLe: il(1 + i * 0.4), limite: dans(lim), suivi: 'XW4821' + (3307 + i) + 'FR' })));
[['bordereau attendu', 0.3], ['bordereau attendu', 0.8], ['en route', 2], ['en route', 3], ['en route', 4]].forEach(([d, j], i) => PAIRES.push(paire({ etat: 'vendue', detail: d, prix: 6400 + i * 700, cout: 3500 + i * 200, vendueLe: il(j) })));
export const PAYEES = [2.1, 4.3, 6.2, 9.4].map((j, i) => paire({ etat: 'payee', prix: 9900 + i * 900, cout: i === 2 ? null : 4800 + i * 400, vendueLe: il(j + 4), verse: il(j) }));
// 40 ANNONCES : 34 en ligne, 2 sous le même N° 157 (deux comptes), 2 dont le dressing est lu il y a 3 jours, 2 brouillons
for (let i = 0; i < 34; i++) PAIRES.push(paire({ etat: 'enligne', prix: 4500 + ((i * 700) % 9000), cout: 2000 + ((i * 300) % 3000), jours: i < 6 ? 62 + i * 9 : 2 + ((i * 7) % 50), favoris: (i * 5) % 13, vues: 40 + ((i * 37) % 300) }));
PAIRES.push({ ...paire({ etat: 'verifier', prix: 8500, cout: 3900, doublon: true, detail: 'deux sous ce N°' }), numero: '157' });
PAIRES.push({ ...paire({ etat: 'verifier', prix: 8200, cout: 4100, doublon: true, detail: 'deux sous ce N°' }), numero: '157', compte: COMPTES[1] });
for (let i = 0; i < 2; i++) PAIRES.push(paire({ etat: 'verifier', prix: 6000 + i * 500, cout: 2800, compte: COMPTES[2], detail: 'lue il y a 3 j', raison: 'Le dressing de ce compte n’a pas été relu depuis 3 jours : « en ligne » n’est plus prouvé.' }));
for (let i = 0; i < 2; i++) PAIRES.push(paire({ etat: 'publier', prix: 8000 + i * 500, cout: 3600, detail: 'brouillon' }));
// 10 ACHATS : 3 au point relais (code relié par le n° de transaction de l'achat), 4 en route, 3 arrivés sans N°
const achat = (o) => { const [titre, taille] = MODELES[k++ % MODELES.length]; return { cle: 'a' + k, numero: null, achat: true, titre, taille, photo: 'v' + k, compte: COMPTES[1], tx: String(24100000000 + k), ...o }; };
PAIRES.push(achat({ etat: 'retirer', prix: 2500, achete: il(4), limite: dans(1.5), retrait: { code: '913556', lieu: 'Locker Vinted Go, gare Saint-Charles', transporteur: 'Vinted Go', suivi: 'VG77120441', qr: 'qr1' } }));
PAIRES.push(achat({ etat: 'retirer', prix: 2900, achete: il(5), limite: dans(3), retrait: { code: 'CH4821', lieu: 'Tabac du Port, 12 quai Jean Bart', transporteur: 'Chronopost', suivi: 'XY12044581', qr: 'qr2' } }));
PAIRES.push(achat({ etat: 'retirer', prix: 3300, achete: il(6), limite: dans(5), retrait: { code: '482107', lieu: 'Relais Le Marigny, 4 rue Thiers', transporteur: 'Mondial Relay', suivi: '41800271', qr: null } }));
[['envoyé', 1], ['en transit', 2], ['en transit', 3], ['payé', 0.5]].forEach(([d, j], i) => PAIRES.push(achat({ etat: 'enroute', detail: d, prix: 3000 + i * 400, achete: il(j) })));
[1, 2, 4].forEach((j, i) => PAIRES.push(achat({ etat: 'numeroter', detail: j === 1 ? 'arrivée hier' : `arrivée il y a ${j} j`, prix: 2700 + i * 500, achete: il(j + 3) })));
