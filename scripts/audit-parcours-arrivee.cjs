// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE PARCOURS D'ARRIVÉE (11 nov. ; TROIS étapes le 13 nov., lot 46) :
//  src/parcoursArrivee.js EXÉCUTÉ.
//  R1  trois étapes, dans l'ordre : compte · extension · Vinted ouvert une fois ;
//      compte neuf : seul « compte » est fait, on continue par l'extension ;
//  R2  aucune étape n'est faite sans PREUVE LUE : en cours, pas su, illisible ≠ fait ;
//      l'extension qui répond mais n'est pas connectée à CE compte n'est pas faite ;
//      un compte Vinted relié sans aucune lecture rangée ATTEND ; une lecture d'un
//      AUTRE compte ne compte pas ; un compteur illisible n'est jamais 0 ;
//      ses ventes OU son dressing suffisent (un débutant sans vente finit) ;
//  R3  « N ventes lues », « N annonces lues » viennent de la preuve, rien d'inventé ;
//  R4  position : l'écran reprend à l'étape rangée si elle n'est pas faite, sinon la
//      suivante ; « C'est prêt » seulement quand tout est fait ; écrire seulement si
//      ça change ; une étape d'avant le 13 nov. ne vaut rien ;
//  R5  « Plus tard » : 7 jours ; l'extension met Vinted de côté ;
//  R6  la carte : jamais à un vendeur installé (compte Vinted rangé, jamais ouvert),
//      ni quand la liste des comptes n'est pas lue ; les trois faites ⇒ plus rien ;
//      « pas su » ne finit rien ; mode exemple : rien ;
//  R7  une étape bloquée dit le geste exact (télécharger, ouvrir vinted.fr dans CE
//      navigateur, connecter), ≤ 12 mots ;
//  R8  le branchement : `vrm_parcours` dans SYNC_KEYS, lectures scalaires (`nItems`),
//      jamais `select=data`, chaque preuve reçoit une LECTURE.
//  `--prouve` : rejoue l'audit sur des copies MUTÉES — chacune doit le faire échouer.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const MODULE = process.env.AUDIT_PA_MODULE || path.join(RACINE, 'src', 'parcoursArrivee.js');
const APP = process.env.AUDIT_PA_APP || path.join(RACINE, 'src', 'App.jsx');

if (process.argv.includes('--prouve')) {
  const brut = fs.readFileSync(path.join(RACINE, 'src', 'parcoursArrivee.js'), 'utf8');
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const MUTATIONS = [
    ['module', 'extension pas connectée comptée faite', "if (pont === 'pasconnectee') return { etat: 'afaire', detail: 'pasconnectee' };", "if (pont === 'pasconnectee') return { etat: 'fait' };"],
    ['module', 'extension d’un autre compte VRM comptée faite', "if (pont === 'autrecompte') return { etat: 'afaire', detail: 'autrecompte' };", "if (pont === 'autrecompte') return { etat: 'fait' };"],
    ['module', 'compte relié = Vinted fait sans aucune lecture', "return { etat: 'attente', detail: 'lecture' };", "return { etat: 'fait' };"],
    ['module', 'une lecture d’un autre compte compte', "if (!uids.has(uidDe(l && l.id, suffixe))) continue;", "if (!uidDe(l && l.id, suffixe)) continue;"],
    ['module', 'compteur illisible lu comme 0', "return vu ? n : illisible ? null : undefined;", 'return vu ? n : illisible ? 0 : undefined;'],
    ['module', 'le dressing seul ne suffit plus (le débutant ne finit jamais)', "if (lu(n) || lu(ventes) || lu(achats))", "if (lu(ventes) || lu(achats))"],
    ['module', 'preuve absente vaut fait', "const etat = ETATS.has(p.etat) ? p.etat : 'passu';", "const etat = ETATS.has(p.etat) ? p.etat : 'fait';"],
    ['module', '« Plus tard » qui ne revient jamais', 'maintenant - t < JOURS_REPORT * 86400000', 'true'],
    ['module', 'reprise ignorée (toujours la courante)', "if (e && e.etat !== 'fait') return e.cle;", ''],
    ['module', 'la carte montrée à un vendeur installé', "if (!p && !(Array.isArray(comptes) && comptes.length === 0)) return 'cachee';", ''],
    ['module', 'la carte reste quand les trois sont faites', "  if (etat.fini) return 'cachee';\n  if (!p", "  if (!p"],
    ['module', 'écriture même sans changement', "if (avant.etape === apres.etape && avant.ouvert === apres.ouvert && avant.fini === apres.fini && lireParcours(brut)) return null;", ''],
    ['module', 'le chiffre « ventes lues » inventé', "return v === 1 ? '1 vente lue' : `${v} ventes lues`;", "return '12 ventes lues';"],
    ['module', 'Vinted bloqué sans dire où l’ouvrir', "`Ouvre vinted.fr ${ou}, connecté à ton compte.`", "'Ouvre Vinted.'"],
    ['app', 'position pas synchronisée (hors SYNC_KEYS)', "  'vrm_parcours',\n", ''],
    ['app', 'dressing lu en entier (select=data)', "'id=like.harvest_*_listings&select=id,n:data->>nItems'", "'id=like.harvest_*_listings&select=id,data'"],
    ['app', 'les ventes ne servent plus de preuve', 'vinted: preuveVinted(comptes, annonces, commandes)', 'vinted: preuveVinted(comptes, annonces, [])'],
  ];
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-pa-'));
  let rates = 0, i = 0;
  for (const [ou, nom, avant, apres] of MUTATIONS) {
    const src = ou === 'module' ? brut : app;
    if (!src.includes(avant)) { console.log(`KO  mutation introuvable : ${nom}`); rates++; continue; }
    const f = path.join(dossier, `m${i++}${ou === 'module' ? '.mjs' : '.jsx'}`);
    fs.writeFileSync(f, src.replace(avant, apres));
    const env = { ...process.env, [ou === 'module' ? 'AUDIT_PA_MODULE' : 'AUDIT_PA_APP']: f };
    const r = spawnSync(process.execPath, [__filename], { env, encoding: 'utf8' });
    const rouge = r.status !== 0;
    console.log(`${rouge ? 'OK  ' : 'KO  '}mutation « ${nom} » ⇒ ${rouge ? 'rouge' : 'VERTE (le contrôle ne la voit pas)'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non vue(s)` : `\n✅ les ${MUTATIONS.length} mutations font échouer l’audit`);
  process.exit(rates ? 1 : 0);
}

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 300) : ''}`); };

(async () => {
  const P = await import(pathToFileURL(MODULE).href);
  const T0 = Date.parse('2026-11-13T10:00:00Z');
  const etats = (g) => Object.fromEntries(g.etapes.map((e) => [e.cle, e.etat]));
  const C1 = [{ vinted_user_id: '9101', login: 'a' }];
  const L = (uid, suffixe, n) => ({ id: `harvest_${uid}_${suffixe}`, n });
  const preuves = (o = {}) => ({
    compte: P.preuveCompte('u1'),
    extension: P.preuveExtension('absente', []),
    vinted: P.preuveVinted([], [], []),
    ...o,
  });

  // R1
  dit(P.ETAPES_PARCOURS.map((e) => e.cle).join(',') === 'compte,extension,vinted', 'R1 trois étapes, dans l’ordre : compte · extension · Vinted', P.ETAPES_PARCOURS.map((e) => e.cle));
  const neuf = P.etatParcours(preuves(), { maintenant: T0 });
  dit(neuf.faites === 1 && neuf.total === 3 && neuf.courante === 'extension', 'R1 compte neuf : 1 sur 3, on continue par l’extension', neuf);

  // R2
  dit(P.preuveExtension('pasconnectee', []).etat === 'afaire' && P.preuveExtension('autrecompte', []).etat === 'afaire', 'R2 extension pas connectée / autre compte VRM : pas faite');
  dit(P.preuveExtension('demande', []).etat === 'encours' && P.preuveExtension('muette', []).etat === 'passu', 'R2 extension en cours / muette : ni faite ni à faire');
  dit(P.preuveExtension('connectee', []).etat === 'fait' && P.preuveExtension('absente', C1).etat === 'fait', 'R2 extension connectée à CE compte, ou un compte rangé : faite');
  dit(P.preuveVinted([], [], []).etat === 'afaire', 'R2 aucun compte Vinted relié : à faire');
  dit(P.preuveVinted(C1, [], []).etat === 'attente', 'R2 compte relié sans aucune lecture rangée : on ATTEND', P.preuveVinted(C1, [], []));
  dit(P.preuveVinted(C1, [L('777', 'listings', 9)], [L('777', 'orders_sold', 4)]).etat === 'attente', 'R2 les lectures d’un AUTRE compte ne comptent pas', P.preuveVinted(C1, [L('777', 'listings', 9)], [L('777', 'orders_sold', 4)]));
  dit(P.preuveVinted(C1, [L('9101', 'listings', 'x')], []).etat === 'passu', 'R2 un dressing au compteur illisible : pas su', P.preuveVinted(C1, [L('9101', 'listings', 'x')], []));
  dit(P.preuveVinted(C1, [], [L('9101', 'orders_sold', 'x')]).etat === 'passu', 'R2 un compteur de ventes illisible : pas su (jamais 0)', P.preuveVinted(C1, [], [L('9101', 'orders_sold', 'x')]));
  dit(P.preuveVinted(C1, null, []).etat === 'passu' && P.preuveVinted(C1, [], null).etat === 'passu' && P.preuveVinted(null, [], []).etat === 'passu', 'R2 lectures ratées : pas su, jamais fait');
  dit(P.preuveVinted(undefined, [], []).etat === 'encours' && P.preuveVinted(C1, undefined, []).etat === 'encours' && P.preuveVinted(C1, [], undefined).etat === 'encours', 'R2 lectures en cours : en cours');
  const deb = P.preuveVinted(C1, [L('9101', 'listings', 3)], []);
  dit(deb.etat === 'fait' && deb.n === 3, 'R2 un débutant SANS vente : son dressing lu suffit (une liste vide n’est jamais rangée)', deb);
  const ach = P.preuveVinted(C1, [], [L('9101', 'orders_purchased', 1)]);
  dit(ach.etat === 'fait', 'R2 un achat lu suffit aussi', ach);
  const mix = P.preuveVinted(C1, null, [L('9101', 'orders_sold', 2)]);
  dit(mix.etat === 'fait' && mix.ventes === 2, 'R2 une lecture lue gagne sur une lecture ratée de l’autre', mix);
  const sansPreuve = P.etatParcours({ compte: P.preuveCompte('u') }, { maintenant: T0 });
  dit(sansPreuve.faites === 1 && !sansPreuve.fini, 'R2 une preuve absente n’est jamais faite', etats(sansPreuve));

  // R3
  const v = P.preuveVinted(C1, [L('9101', 'listings', 7), L('777', 'listings', 40)], [L('9101', 'orders_sold', 5), L('777', 'orders_sold', 90)]);
  dit(v.etat === 'fait' && v.ventes === 5 && v.n === 7 && P.reussite({ ...v, cle: 'vinted' }) === '5 ventes lues', 'R3 « 5 ventes lues » vient du compteur lu (SES comptes seulement)', v);
  dit(P.reussite({ ...deb, cle: 'vinted' }) === '3 annonces lues' && P.reussite({ cle: 'vinted', etat: 'fait', n: 0 }) === 'Dressing lu · aucune annonce en ligne', 'R3 sans vente : « 3 annonces lues »');
  dit(P.reussite({ cle: 'vinted', etat: 'attente' }) === '' && P.reussite({ cle: 'extension', etat: 'fait' }) === 'Connectée à ton compte', 'R3 rien de dit pour une étape pas faite');

  // R4
  const tout = P.etatParcours(preuves({ extension: { etat: 'fait' }, vinted: v }), { maintenant: T0 });
  dit(tout.fini && P.etapeAMontrer(tout, 'vinted') === 'pret', 'R4 les trois faites ⇒ « C’est prêt »');
  const mi = P.etatParcours(preuves({ extension: { etat: 'fait' } }), { maintenant: T0 });
  dit(P.etapeAMontrer(mi, 'vinted') === 'vinted' && P.etapeAMontrer(mi, 'extension') === 'vinted' && P.etapeAMontrer(mi, null) === 'vinted', 'R4 reprise : l’étape rangée si pas faite, sinon la suivante');
  dit(P.etapeAMontrer(neuf, 'extension') === 'extension', 'R4 reprise exacte sur l’extension');
  dit(P.ecritureParcours({ v: 1, etape: 'vinted', ouvert: true, fini: null }, { etape: 'vinted' }) === null, 'R4 rien ne change ⇒ rien n’est écrit');
  const w = P.ecritureParcours(null, { etape: 'vinted', ouvert: true }, 'T');
  dit(w && w.etape === 'vinted' && w.ouvert === true && w.fini === null && w.at === 'T', 'R4 l’écriture porte étape, ouvert, fin, date', w);
  dit(P.lireParcours({ etape: 'emails', ouvert: true }).etape === null && P.lireParcours({ ouvert: 'oui' }).ouvert === false, 'R4 une étape d’avant le 13 nov. (e-mails…) ou une position illisible ne vaut rien');

  // R5
  const pt = { extension: new Date(T0 - 3600e3).toISOString() };
  const r5 = P.etatParcours(preuves(), { plusTard: pt, maintenant: T0 });
  dit(r5.courante === null && r5.etapes.find((e) => e.cle === 'vinted').reportee, 'R5 l’extension de côté met Vinted de côté', r5.courante);
  const r5b = P.etatParcours(preuves(), { plusTard: pt, maintenant: T0 + 8 * 86400000 });
  dit(r5b.courante === 'extension', 'R5 sept jours plus tard, l’étape revient');
  dit(P.suivanteApres(neuf, 'extension', pt, T0) === null, 'R5 « Plus tard » sur l’extension ⇒ on ferme (Vinted la suit)');
  dit(P.etapeAMontrer(r5, 'vinted') === 'vinted', 'R5 reprise exacte même quand tout est de côté (Vinted rangé ⇒ Vinted)', P.etapeAMontrer(r5, 'vinted'));

  // R6
  dit(P.carteParcours(neuf, null, { comptes: [] }) === 'etape', 'R6 compte neuf (aucun compte Vinted) : la carte');
  dit(P.carteParcours(mi, null, { comptes: C1 }) === 'cachee' && P.carteParcours(tout, null, { comptes: C1 }) === 'cachee', 'R6 vendeur installé (compte rangé), jamais ouvert : rien, même avec une étape pas faite');
  dit(P.carteParcours(neuf, null, { comptes: null }) === 'cachee' && P.carteParcours(neuf, null, {}) === 'cachee', 'R6 liste des comptes pas lue, jamais ouvert : rien (pas su)');
  dit(P.carteParcours(mi, { v: 1, etape: 'vinted', ouvert: false }, { comptes: C1 }) === 'etape', 'R6 parcours commencé : la carte suit, même compte relié');
  dit(P.carteParcours(tout, { v: 1, etape: 'vinted', ouvert: false }, { comptes: C1 }) === 'cachee' && P.carteParcours(tout, { v: 1, fini: 'T' }, { comptes: [] }) === 'cachee', 'R6 les trois faites : la carte disparaît');
  dit(P.carteParcours(neuf, null, { comptes: [], exemple: true }) === 'cachee' && P.carteParcours(neuf, null, { comptes: [], masque: true }) === 'cachee', 'R6 mode exemple / guide masqué : rien');
  const passu = P.etatParcours(preuves({ extension: { etat: 'fait' }, vinted: P.preuveVinted(C1, null, null) }), { maintenant: T0 });
  dit(!passu.fini && P.carteParcours(passu, { v: 1 }, { comptes: C1 }) === 'etape', 'R6 « pas su » ne finit rien', etats(passu));

  // R7
  const mots = (t) => String(t).trim().split(/\s+/).length;
  const ex = P.etatParcours(preuves(), { maintenant: T0 }).etapes.find((e) => e.cle === 'extension');
  const lExt = P.ligneEtape(ex, { ou: 'dans Chrome' });
  dit(/Télécharge/.test(lExt) && /dans Chrome/.test(lExt) && mots(lExt) <= 12, 'R7 extension absente : « Télécharge-la… dans Chrome »', lExt);
  const lCo = P.ligneEtape({ cle: 'extension', etat: 'afaire', detail: 'pasconnectee' });
  dit(/Connecte-la à ce compte VRM/.test(lCo), 'R7 extension pas connectée : « Connecte-la à ce compte VRM »', lCo);
  const lV = P.ligneEtape({ cle: 'vinted', etat: 'afaire' }, { ou: 'dans Chrome' });
  dit(/^Ouvre vinted\.fr dans Chrome/.test(lV) && mots(lV) <= 12, 'R7 Vinted : « Ouvre vinted.fr dans Chrome, connecté à ton compte »', lV);
  dit(/sur ton ordinateur/.test(P.ligneEtape({ cle: 'vinted', etat: 'afaire' }, { ou: 'sur ton ordinateur' })), 'R7 au téléphone : « sur ton ordinateur »');
  dit(P.ligneEtape({ cle: 'vinted', etat: 'fait' }) === '' && P.ligneEtape({ cle: 'vinted', etat: 'passu' }) === 'Pas pu vérifier.', 'R7 faite : rien ; pas su : « Pas pu vérifier. »');

  // R8
  const app = fs.readFileSync(APP, 'utf8');
  dit(/\n  'vrm_parcours',\n/.test(app), 'R8 `vrm_parcours` est synchronisé (SYNC_KEYS)');
  const bloc = app.slice(app.indexOf('// ── LE PARCOURS D\'ARRIVÉE, BRANCHÉ'), app.indexOf('// ── « VÉRIFIER MON INSTALLATION »'));
  dit(bloc.length > 1000, 'R8 le bloc du parcours est trouvé');
  dit(/harvest_\*_listings&select=id,n:data->>nItems/.test(bloc) && /harvest_\*_orders_\*&select=id,n:data->>nItems/.test(bloc), 'R8 lectures scalaires (`nItems`)');
  const code = bloc.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');   // commentaires retirés (§6.4)
  dit(!/select=(id,)?data[&'`]/.test(code), 'R8 jamais `select=data`');
  dit(/extension: preuveExtensionParcours\(pont, comptes\)/.test(bloc) && /vinted: preuveVinted\(comptes, annonces, commandes\)/.test(bloc), 'R8 chaque preuve reçoit une lecture');
  dit(/carteParcours\(etat, parcoursBrut, \{[^}]*comptes \}\)/.test(bloc), 'R8 la carte reçoit la liste des comptes (installé ⇒ rien)');

  console.log(ko ? `\n❌ ${ko} contrôle(s) en échec` : '\n✅ parcours d’arrivée : tout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('KO  ' + (e && e.stack || e)); process.exit(1); });
