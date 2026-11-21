// audit-transporteur-lu.cjs — UN TRANSPORTEUR N'EST NOMMÉ QUE S'IL EST LU (6 nov. 2026)
//
// Constat de Julien, mesuré en base : Colis → À retirer montrait « Tabavap · Chronopost » pour un
// achat dont le n° est un n° POSTAL INTERNATIONAL (UPU S10 : 2 lettres + 9 chiffres + le PAYS,
// ici « IE » = Irlande). Rien ne disait Chronopost : la forme le devinait (api/_lib/suivi-colis.js,
// api/_lib/transporteurs.js), le serveur l'interrogeait donc chez Chronopost (3 lignes
// `transp_chronopost_…IE` jamais lues), et l'écran prenait cette ligne VIDE pour une preuve.
// Julien l'a pris pour son colis Mondial Relay du même point.
// Ce qui est protégé (§5 : « pas su ne vaut pas oui », « mieux vaut un blanc qu'un faux ») :
//  1. la forme ne nomme Chronopost que pour SA forme propre (« XW/ZW + 9 chiffres + TS/SP », 50
//     lignes sur 50 venues d'un e-mail ou d'une lecture Chronopost) ; un S10 « …FR » ⇒ rien ;
//     un S10 d'un autre pays ⇒ « Colis international (<pays>) », jamais un transporteur ;
//  2. le serveur n'interroge pas Chronopost pour un S10 étranger sans transporteur lu ;
//  3. une ligne `transp_` sans lecture réussie ne nomme pas le transporteur à l'écran ;
//     une lecture réussie, si ;
//  4. le même colis, de la vraie FORME (achat Vinted relu par l'extension, `transporteur: null`,
//     journey « Disponible pour retrait »), n'est plus « Chronopost » sur sa carte.
// Données INVENTÉES (n° CP000000123IE, XW000000042TS).
// Usage : node scripts/audit-transporteur-lu.cjs   (RACINE=<arbre> pour l'arbre d'avant)
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const path = require('path'), fs = require('fs');
const RACINE = process.env.RACINE || path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) { ok++; console.log('  ✓ ' + m); } else { ko++; console.log('  ✗ ' + m + (d ? '\n      ' + d : '')); } };
const IE = 'CP000000123IE', FRS10 = 'XW000000042FR', CHRONO = 'XW000000042TS';
(async () => {
  const S = await import('file://' + path.join(RACINE, 'api/_lib/suivi-colis.js'));
  const T = await import('file://' + path.join(RACINE, 'api/_lib/transporteurs.js'));
  let V = null;
  try { V = await import('file://' + path.join(RACINE, 'src/transporteursVisuels.js')); } catch (e) { console.log('  (transporteursVisuels non importable : ' + String(e.message).slice(0, 120) + ')'); }

  console.log('§1 la forme seule');
  dit(S.transporteurDeForme(IE) === null, 'un n° postal irlandais (S10 « …IE ») n’est pas Chronopost', String(S.transporteurDeForme(IE)));
  dit(S.transporteurDeForme(FRS10) === null, 'un S10 « …FR » : La Poste ou Chronopost, on ne choisit pas ⇒ rien', String(S.transporteurDeForme(FRS10)));
  dit(S.transporteurDeForme(CHRONO) === 'chronopost', 'la forme propre à Chronopost (« XW…TS ») reste Chronopost', String(S.transporteurDeForme(CHRONO)));
  dit(typeof S.colisInternational === 'function' && S.colisInternational(IE) === 'Colis international (Irlande)' && S.colisInternational(FRS10) === '' && S.colisInternational(CHRONO) === '',
    '« Colis international (Irlande) » lu dans le n° ; rien pour un n° français ou Chronopost', typeof S.colisInternational === 'function' ? [S.colisInternational(IE), S.colisInternational(FRS10)].join(' | ') : 'absent');

  console.log('§2 le serveur n’interroge pas Chronopost au hasard');
  const it = T.suivisAInterroger({ vinted: [{ suivi: IE, transporteur: null, cap: '2026-10-31T15:38:11.513Z' }], maintenant: Date.parse('2026-11-06T10:00:00Z'), max: 50, parTransporteur: 50 });
  dit(!it.some((x) => x.carrier === 'chronopost'), 'achat Vinted au n° « …IE », transporteur pas lu ⇒ aucune lecture Chronopost demandée', JSON.stringify(it.map((x) => [x.carrier, x.suivi])));
  const it2 = T.suivisAInterroger({ vinted: [{ suivi: CHRONO, transporteur: null, cap: '2026-10-31T15:38:11.513Z' }], maintenant: Date.parse('2026-11-06T10:00:00Z'), max: 50, parTransporteur: 50 });
  dit(it2.some((x) => x.carrier === 'chronopost'), 'un vrai n° Chronopost (forme propre) est toujours lu chez Chronopost', JSON.stringify(it2.map((x) => [x.carrier, x.suivi])));
  const it3 = T.suivisAInterroger({ vinted: [{ suivi: IE, transporteur: 'chronopost', cap: '2026-10-31T15:38:11.513Z' }], maintenant: Date.parse('2026-11-06T10:00:00Z'), max: 50, parTransporteur: 50 });
  dit(it3.some((x) => x.carrier === 'chronopost'), 'un transporteur LU (« chronopost ») est suivi, quelle que soit la forme du n°', JSON.stringify(it3.map((x) => [x.carrier, x.suivi])));

  console.log('§3 la carte : une ligne transporteur jamais lue n’est pas une preuve');
  if (V && typeof V.transporteurDuColis === 'function') {
    const vide = new Map([[IE, { suivi: IE, carrier: 'chronopost', etat: null, lu: null, essais: 3, essaiRes: 'introuvable' }]]);
    const t1 = V.transporteurDuColis({ declare: '', suivi: IE, transp: vide });
    dit(t1.cle !== 'chronopost' && t1.nom === 'Colis international (Irlande)', 'n° « …IE » + ligne `transp_chronopost_…` jamais lue ⇒ « Colis international (Irlande) », pas Chronopost', JSON.stringify(t1));
    const lue = new Map([[CHRONO, { suivi: CHRONO, carrier: 'chronopost', etat: 'disponible', lu: '2026-11-06T08:00:00.000Z' }]]);
    const t2 = V.transporteurDuColis({ declare: '', suivi: CHRONO, transp: lue });
    dit(t2.cle === 'chronopost' && t2.source === 'transporteur', 'une lecture Chronopost RÉUSSIE nomme Chronopost (source : le transporteur)', JSON.stringify(t2));
    const t3 = V.transporteurDuColis({ declare: 'mondialrelay', suivi: IE, transp: vide });
    dit(t3.cle === 'mondialrelay', 'un transporteur ÉCRIT par la plateforme garde son nom', JSON.stringify(t3));
  } else dit(false, 'transporteurDuColis importable');

  console.log('§4 le même colis, de la vraie forme (achat Vinted relu par l’extension)');
  // La ligne `harvest_{uid}_suivi_{tx}` telle que rangée : transporteur null, journey lu.
  const ligne = { tx: '90000000001', uid: '111', suivi: IE, transporteur: null, source: 'journey', v: 1, n: 10, capturedAt: '2026-10-31T15:38:11.513Z',
    dernier: { t: 'Disponible pour retrait', at: '2026-10-30T15:01:00.000Z', code: 'available_for_pickup' }, etapes: [{ t: 'Disponible pour retrait', at: '2026-10-30T15:01:00.000Z', code: 'available_for_pickup' }, { t: `Numéro de suivi créé - ${IE}`, at: '2026-10-20T17:01:04.000Z', code: '' }] };
  if (V && typeof V.transporteurDuColis === 'function') {
    const tr = V.transporteurDuColis({ declare: ligne.transporteur || '', suivi: ligne.suivi, transp: new Map([[IE, { suivi: IE, carrier: 'chronopost', etat: null, lu: null }]]) });
    dit(!/chronopost/i.test(tr.nom) && tr.cle !== 'chronopost', 'sa carte ne dit plus « Chronopost »', JSON.stringify(tr));
  }
  const app = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');
  dit((app.match(/transporteurDeForme\(su[VXC]\) \|\| colisInternational\(su[VXC]\)/g) || []).length === 3, 'l’écran ne dit pas « transporteur inconnu » d’un colis dont le pays est lu (3 cartes : extra, à vérifier, à confirmer)');
  console.log(`\n${ok} vérifications, ${ko} en échec`); process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('ERREUR', e && e.stack); process.exit(1); });
