// audit-colis-prochain.cjs — LE PROCHAIN GESTE DE COLIS (6 nov. 2026, onglets B)
//
// Ce qu'il protège (src/prochainGesteColis.js + son branchement dans src/App.jsx) :
//  1. « À imprimer » = les bordereaux reçus PAS ENCORE imprimés. Mesuré sur sa base le
//     6 nov. : la case disait 9 quand 6 avaient été imprimés la veille (3 réellement).
//  2. L'urgent passe devant, quel que soit l'onglet : un retrait d'ici demain (le colis
//     repart), puis un envoi pour aujourd'hui ou demain. Ambre seulement là.
//  3. La phrase d'un point dit SES colis comptés et leurs codes (« codes prêts », « 7 codes
//     prêts, 3 à venir ») ; le point le plus chargé d'abord ; les autres points résumés.
//  4. « Pas su » n'est pas « rien » : un total inconnu ou partiel ne fait jamais dire
//     « Rien à envoyer ni à retirer ».
//  5. Le branchement : l'écran passe les colis COMPTÉS seulement (jamais un « à vérifier »
//     ni un « peut-être en double »), la case « à imprimer » lit la même fonction, le
//     compte muet mène à Comptes liés.
// Données INVENTÉES (points « Tabac du Port », « Locker Gare », n° fictifs).
// Usage : node scripts/audit-colis-prochain.cjs   (MODULE=<chemin> pour une mutation)
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const MODULE = process.env.MODULE || path.join(RACINE, 'src/prochainGesteColis.js');
const APP = process.env.APP || path.join(RACINE, 'src/App.jsx');
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) { ok++; console.log('  ✓ ' + m); } else { ko++; console.log('  ✗ ' + m + (d ? '\n      ' + d : '')); } };

(async () => {
  let M;
  try { M = await import('file://' + MODULE); } catch (e) { dit(false, 'le module du prochain geste existe', String(e && e.message)); return fin(); }
  const { prochainGesteColis, bordereauxAImprimer } = M;
  dit(typeof prochainGesteColis === 'function' && typeof bordereauxAImprimer === 'function', 'le module exporte prochainGesteColis et bordereauxAImprimer');

  console.log('§1 « à imprimer » = pas encore imprimés');
  const lot = [...Array(9)].map((_, i) => ({ cle: String(90000001 + i), imprime: i < 6 ? '2026-11-05T10:19:34.137Z' : null }));
  dit(bordereauxAImprimer(lot).length === 3, '9 bordereaux reçus dont 6 imprimés ⇒ 3 à imprimer', String(bordereauxAImprimer(lot).length));
  dit(bordereauxAImprimer(null).length === 0 && bordereauxAImprimer([]).length === 0, 'rien lu ⇒ aucune ligne (jamais une erreur)');

  console.log('§2 l’urgent passe devant');
  const C = (n, code = true, jours = 4) => [...Array(n)].map(() => ({ code, jours }));
  const pts = [
    { cle: 'tabacduport|35000', nom: 'Tabac du Port', colis: C(7) },
    { cle: 'lockergare|35000', nom: 'Locker Gare', colis: [{ code: true, jours: 1 }] },
  ];
  const envoiCalme = { total: 4, aImprimer: [{ jours: 5, limite: '5 j pour l’envoyer' }], aDeposer: 0, sansBordereau: 1 };
  const g1 = prochainGesteColis({ onglet: 'envoyer', envoi: envoiCalme, retrait: { total: 8, points: pts } });
  dit(g1 && g1.cle === 'retirer-urgent' && g1.onglet === 'retirer' && g1.point === 'lockergare|35000' && g1.ambre === true, 'un retrait d’ici demain gagne, même sur « À envoyer »', JSON.stringify(g1));
  dit(g1 && /^Locker Gare : 1 colis à retirer d’ici demain — code prêt$/.test(g1.texte), 'sa phrase : le nombre, « d’ici demain », le point, le code', g1 && g1.texte);
  const g1b = prochainGesteColis({ onglet: 'envoyer', envoi: envoiCalme, retrait: { total: 8, points: [{ ...pts[1], colis: [{ code: false, jours: 0 }] }] } });
  dit(g1b && /aujourd’hui/.test(g1b.texte) && /code pas encore arrivé/.test(g1b.texte), 'dernier jour aujourd’hui, sans code : « aujourd’hui », « code pas encore arrivé »', g1b && g1b.texte);
  const envoiPresse = { total: 4, aImprimer: [{ jours: 3, limite: '3 j pour l’envoyer' }, { jours: 1, limite: 'à envoyer avant demain 10 h' }], aDeposer: 0 };
  const g2 = prochainGesteColis({ onglet: 'retirer', envoi: envoiPresse, retrait: { total: 7, points: [pts[0]] } });
  dit(g2 && g2.cle === 'imprimer-urgent' && g2.action === 'imprimer' && g2.ambre === true, 'un envoi pour demain gagne sur un retrait calme, même sur « À retirer »', JSON.stringify(g2));
  dit(g2 && g2.texte === '2 bordereaux à imprimer — à envoyer avant demain 10 h', 'sa phrase : le nombre et la limite LA PLUS PROCHE', g2 && g2.texte);
  const g2b = prochainGesteColis({ onglet: 'retirer', envoi: envoiPresse, retrait: { total: 8, points: pts } });
  dit(g2b && g2b.cle === 'retirer-urgent', 'retrait d’ici demain ET envoi pour demain : le retrait d’abord (le colis repart)', g2b && g2b.cle);

  console.log('§3 la phrase d’un point');
  const g3 = prochainGesteColis({ onglet: 'retirer', envoi: envoiCalme, retrait: { total: 10, points: [{ cle: 'a', nom: 'Tabac du Port', colis: C(10) }] } });
  dit(g3 && g3.cle === 'retirer' && g3.ambre === false && g3.texte === 'Tabac du Port : 10 colis à retirer — codes prêts', '10 colis avec code : « Tabac du Port : 10 colis à retirer — codes prêts », neutre', g3 && g3.texte);
  const g4 = prochainGesteColis({ onglet: 'retirer', envoi: null, retrait: { total: 12, points: [{ cle: 'b', nom: 'Locker Gare', colis: C(2) }, { cle: 'a', nom: 'Tabac du Port', colis: [...C(7), ...C(3, false)] }] } });
  dit(g4 && g4.point === 'a' && g4.texte === 'Tabac du Port : 10 colis à retirer — 7 codes prêts, 3 à venir' && g4.sous === 'et 2 colis dans 1 autre point', 'le point le plus chargé d’abord, ses codes comptés, les autres points résumés', JSON.stringify(g4));
  const g4b = prochainGesteColis({ onglet: 'retirer', envoi: envoiCalme, retrait: { total: 0, points: [{ cle: 'a', nom: 'Tabac du Port', colis: [] }] } });
  dit(g4b && g4b.onglet === 'envoyer', 'rien à retirer sur « À retirer » : le geste d’envoi (l’autre onglet)', JSON.stringify(g4b));

  console.log('§4 « pas su » n’est pas « rien »');
  dit(prochainGesteColis({ onglet: 'envoyer', envoi: { total: null }, retrait: { total: null } }) === null, 'deux totaux inconnus ⇒ rien n’est dit');
  dit(prochainGesteColis({ onglet: 'envoyer', envoi: { total: 0, partiel: true }, retrait: { total: 0 } }) === null, 'un total partiel à 0 ⇒ jamais « rien à faire »');
  dit(prochainGesteColis({ onglet: 'envoyer', envoi: { total: 0 }, retrait: { total: null } }) === null, 'retraits pas lus ⇒ jamais « rien à faire »');
  const g5 = prochainGesteColis({ onglet: 'envoyer', envoi: { total: 0 }, retrait: { total: 0, points: [] } });
  dit(g5 && g5.cle === 'rien' && g5.texte === 'Rien à envoyer ni à retirer', 'tout lu, complet, nul ⇒ « Rien à envoyer ni à retirer »', JSON.stringify(g5));
  const g6 = prochainGesteColis({ onglet: 'envoyer', envoi: { total: 5, partiel: true, aImprimer: [{ jours: 4, limite: '4 j pour l’envoyer' }] }, retrait: { total: 0 } });
  dit(g6 && g6.partiel === true, 'un envoi lu en partie le dit (« au moins »)', JSON.stringify(g6));
  const g7 = prochainGesteColis({ onglet: 'envoyer', envoi: { total: 6, aImprimer: [], aDeposer: 6 }, retrait: { total: 0 } });
  dit(g7 && g7.cle === 'deposer' && g7.action === 'tournee' && g7.texte === '6 colis imprimés à déposer', 'tout imprimé ⇒ « 6 colis imprimés à déposer », la tournée', JSON.stringify(g7));
  const g8 = prochainGesteColis({ onglet: 'envoyer', envoi: { total: 1, aImprimer: [], aDeposer: 0, sansBordereau: 1 }, retrait: { total: 0 } });
  dit(g8 && g8.cle === 'attente' && g8.texte === '1 vente attend son bordereau', 'une vente sans bordereau : elle attend le sien (rien à imprimer)', JSON.stringify(g8));

  console.log('§6 (audit des chiffres, 6 nov.) « à imprimer » hors de Colis : la même notion');
  const { compteAImprimer } = M;
  dit(typeof compteAImprimer === 'function', 'le module exporte compteAImprimer');
  if (typeof compteAImprimer === 'function') {
    const a = compteAImprimer({ local: 2, complet: true, pub: { aImprimer: 9, total: 5 }, totalAPoster: 5 });
    dit(a.n === 2 && a.exact, 'tout lu ⇒ son propre compte, exact (la publication ne le remplace pas)', JSON.stringify(a));
    const b = compteAImprimer({ local: 1, complet: false, pub: { prets: 10, aImprimer: 4, total: 11 }, totalAPoster: 11 });
    dit(b.n === 4 && b.exact, 'pas tout lu, publication du MÊME lot ⇒ ses « à imprimer » (4), jamais ses « prêts » (10)', JSON.stringify(b));
    const c = compteAImprimer({ local: 1, complet: false, pub: { prets: 10, total: 11 }, totalAPoster: 11 });
    dit(c.n === 1 && !c.exact, 'publication d’avant (sans aImprimer) ⇒ « au moins » ce qu’il sait', JSON.stringify(c));
    const d = compteAImprimer({ local: 1, complet: false, pub: { aImprimer: 4, total: 9 }, totalAPoster: 11 });
    dit(d.n === 1 && !d.exact, 'publication d’un autre lot ⇒ « au moins »', JSON.stringify(d));
  }

  console.log('§5 le branchement dans l’écran');
  dit(/compteAImprimer\(\{ local: bordereauxAImprimer\(lignesLot\(\)\)\.length/.test(fs.readFileSync(APP, 'utf8')), 'Ma journée compte « à imprimer » par la même fonction que la case de Colis (pas encore imprimés)');
  const src = fs.readFileSync(APP, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  dit(/const nPrets = bordereauxAImprimer\(lignesImpr\)\.length/.test(src), 'la case « à imprimer » compte les bordereaux PAS ENCORE imprimés (la même fonction)');
  dit(/data-colis-prochain=\{g\.cle\}/.test(src) && /prochainGesteColis\(\{ onglet,/.test(src), 'la ligne du prochain geste est rendue en tête de Colis');
  dit(/\(p\.arrives \|\| \[\]\)\.filter\(\(c\) => !c\.horsCompte\)/.test(src), 'seuls les colis COMPTÉS d’un point entrent dans la phrase (jamais « à vérifier » ni « peut-être en double »)');
  dit(/function ComptesMuetsColis[\s\S]{0,200}useEtatEmailsComptes\(accounts\)/.test(src) && /onNav\('vintedaccounts'\)\}>Relier/.test(src), 'un compte muet (la règle de Comptes liés) mène à Comptes liés');
  dit(/<ComptesMuetsColis accounts=\{accounts\} onNav=\{onNav\}\/>/.test(src), 'la ligne des comptes muets est rendue sur Colis');
  dit(/l: 'd’ici demain', titre: 'À retirer aujourd’hui ou demain'/.test(src) && !/l: 'dernier jour'/.test(src), 'la case des retraits pressés dit « d’ici demain » (elle compte aussi demain)');
  fin();
})();
function fin() { console.log(`\n${ok} vérifications, ${ko} en échec`); process.exit(ko ? 1 : 0); }
