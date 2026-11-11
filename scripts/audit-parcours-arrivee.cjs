// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE PARCOURS D'ARRIVÉE (11 nov.) : src/parcoursArrivee.js EXÉCUTÉ.
//  R1  compte neuf : seule l'étape « compte » est faite ; on continue par « configuration » ;
//  R2  aucune étape n'est faite sans PREUVE LUE : en cours, pas su, illisible ≠ fait ;
//      l'extension qui répond mais n'est pas connectée à CE compte n'est pas faite ;
//      un compte Vinted relié sans dressing lu ATTEND ; un dressing d'un AUTRE compte
//      ne compte pas ; un compteur illisible n'est jamais 0 ;
//  R3  « N annonces lues », « N ventes lues » viennent de la preuve, rien d'inventé ;
//  R4  position : l'écran reprend à l'étape rangée si elle n'est pas faite, sinon la
//      suivante ; « C'est prêt » seulement quand tout est fait ; écrire seulement si
//      ça change ;
//  R5  « Plus tard » : 7 jours ; l'extension met Vinted de côté ; l'écran passe à la
//      suivante (jamais une étape de côté), ou se ferme ;
//  R6  la carte : un vendeur installé jamais ouvert n'est pas interrompu ; « C'est
//      prêt » une fois ; « pas su » ne finit rien ;
//  R7  le branchement : `vrm_parcours` dans SYNC_KEYS, lectures scalaires (`nItems`,
//      `select=id`), jamais `select=data`, chaque preuve reçoit une LECTURE.
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
    ['module', 'e-mails pas lus (null) cochés', "if (!Array.isArray(lignes)) return { etat: 'passu' };\n  return lignes.length > 0", "if (!Array.isArray(lignes)) return { etat: 'fait' };\n  return lignes.length > 0"],
    ['module', 'compte relié = Vinted fait sans lecture du dressing', "if (!siennes.length) return { etat: 'attente', detail: 'lecture' };", "if (!siennes.length) return { etat: 'fait', n: 0 };"],
    ['module', 'le dressing d’un autre compte compte', 'const siennes = lignes.filter((l) => uids.has(uidDe(l && l.id, \'listings\')));', 'const siennes = lignes.filter((l) => uidDe(l && l.id, \'listings\'));'],
    ['module', 'compteur illisible lu comme 0', "return illisible ? null : 0;", 'return 0;'],
    ['module', 'dressing illisible coché', "if (!lus.length) return { etat: 'passu' };", "if (!lus.length) return { etat: 'fait', n: 0 };"],
    ['module', 'preuve absente vaut fait', "const etat = ETATS.has(p.etat) ? p.etat : 'passu';", "const etat = ETATS.has(p.etat) ? p.etat : 'fait';"],
    ['module', 'configuration « plus tard » comptée faite', "if (etat === 'fait') return { etat: 'fait' };", "if (etat) return { etat: 'fait' };"],
    ['module', '« Plus tard » qui ne revient jamais', 'maintenant - t < JOURS_REPORT * 86400000', 'true'],
    ['module', 'reprise ignorée (toujours la courante)', "if (e && e.etat !== 'fait') return e.cle;", ''],
    ['module', '« C’est prêt » à un installé jamais ouvert', "if (etat.fini) return p ? 'pret' : 'cachee';", "if (etat.fini) return 'pret';"],
    ['module', 'écriture même sans changement', "if (avant.etape === apres.etape && avant.ouvert === apres.ouvert && avant.fini === apres.fini && lireParcours(brut)) return null;", ''],
    ['module', 'le chiffre « annonces lues » inventé', "return { etat: 'fait', n: lus.reduce((a, b) => a + b, 0) };", "return { etat: 'fait', n: 12 };"],
    ['app', 'position pas synchronisée (hors SYNC_KEYS)', "  'vrm_parcours',\n", ''],
    ['app', 'dressing lu en entier (select=data)', "'id=like.harvest_*_listings&select=id,n:data->>nItems'", "'id=like.harvest_*_listings&select=id,data'"],
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
  const T0 = Date.parse('2026-11-11T10:00:00Z');
  const etats = (g) => Object.fromEntries(g.etapes.map((e) => [e.cle, e.etat]));
  const C1 = [{ vinted_user_id: '9101', login: 'a' }];
  const L = (uid, suffixe, n) => ({ id: `harvest_${uid}_${suffixe}`, n });
  const preuves = (o = {}) => ({
    compte: P.preuveCompte('u1'),
    configuration: P.preuveConfiguration({ pret: true, etat: null, plateformes: false }),
    extension: P.preuveExtension('absente', []),
    emails: P.preuveEmails([]),
    vinted: P.preuveVinted([], []),
    premiere: P.preuvePremiere([]),
    ...o,
  });

  // R1
  const neuf = P.etatParcours(preuves(), { maintenant: T0 });
  dit(neuf.faites === 1 && neuf.total === 6 && neuf.courante === 'configuration', 'R1 compte neuf : 1 sur 6, on continue par la configuration', neuf);
  dit(P.ETAPES_PARCOURS.map((e) => e.cle).join(',') === 'compte,configuration,extension,emails,vinted,premiere', 'R1 les six étapes, dans l’ordre');

  // R2
  dit(P.preuveExtension('pasconnectee', []).etat === 'afaire' && P.preuveExtension('autrecompte', []).etat === 'afaire', 'R2 extension pas connectée / autre compte VRM : pas faite');
  dit(P.preuveExtension('demande', []).etat === 'encours' && P.preuveExtension('muette', []).etat === 'passu', 'R2 extension en cours / muette : ni faite ni à faire');
  dit(P.preuveExtension('connectee', []).etat === 'fait' && P.preuveExtension('absente', C1).etat === 'fait', 'R2 extension connectée à CE compte, ou un compte rangé : faite');
  dit(P.preuveEmails(null).etat === 'passu' && P.preuveEmails(undefined).etat === 'encours' && P.preuveEmails([]).etat === 'afaire' && P.preuveEmails([{ id: 'email_reception_x' }]).etat === 'fait', 'R2 e-mails : pas su ≠ aucun ≠ reçu');
  dit(P.preuveVinted(C1, []).etat === 'attente', 'R2 compte relié sans dressing lu : on ATTEND la lecture', P.preuveVinted(C1, []));
  dit(P.preuveVinted(C1, [L('777', 'listings', 9)]).etat === 'attente', 'R2 le dressing d’un AUTRE compte ne compte pas', P.preuveVinted(C1, [L('777', 'listings', 9)]));
  dit(P.preuveVinted(C1, [L('9101', 'listings', 'x')]).etat === 'passu', 'R2 un dressing au compteur illisible : pas su', P.preuveVinted(C1, [L('9101', 'listings', 'x')]));
  dit(P.preuveVinted(C1, null).etat === 'passu' && P.preuveVinted(null, []).etat === 'passu' && P.preuveVinted(undefined, []).etat === 'encours', 'R2 lectures ratées : pas su, jamais fait');
  dit(P.preuvePremiere([L('9101', 'orders_sold', 'x')]).etat === 'passu', 'R2 compteur de ventes illisible : pas su (jamais 0)', P.preuvePremiere([L('9101', 'orders_sold', 'x')]));
  dit(P.preuvePremiere(null).etat === 'passu' && P.preuvePremiere(undefined).etat === 'encours' && P.preuvePremiere([L('9101', 'orders_sold', 0)]).etat === 'attente', 'R2 première vente : pas su / en cours / attente');
  dit(P.preuveConfiguration({ pret: true, etat: 'plusTard' }).etat === 'afaire' && P.preuveConfiguration({ pret: false, etat: 'fait' }).etat === 'encours', 'R2 configuration mise de côté : pas faite ; nuage pas lu : en cours');
  dit(P.preuveConfiguration({ pret: true, etat: null, plateformes: true }).etat === 'fait', 'R2 le choix des plateformes d’avant le 9 nov. vaut configuration');
  const sansPreuve = P.etatParcours({ compte: P.preuveCompte('u') }, { maintenant: T0 });
  dit(sansPreuve.faites === 1 && !sansPreuve.fini, 'R2 une preuve absente n’est jamais faite', etats(sansPreuve));

  // R3
  const v12 = P.preuveVinted(C1, [L('9101', 'listings', 7), L('777', 'listings', 40)]);
  dit(v12.etat === 'fait' && v12.n === 7 && P.reussite({ ...v12, cle: 'vinted' }) === '7 annonces lues', 'R3 « 7 annonces lues » vient du compteur lu (SES comptes seulement)', v12);
  const pv = P.preuvePremiere([L('9101', 'orders_sold', 1), L('9101', 'orders_purchased', 2)]);
  dit(pv.etat === 'fait' && P.reussite({ ...pv, cle: 'premiere' }) === '1 vente lue · 2 achats lus', 'R3 « 1 vente lue · 2 achats lus »', pv);
  dit(P.reussite({ cle: 'emails', etat: 'fait' }) === 'Reçu ✓' && P.reussite({ cle: 'vinted', etat: 'attente' }) === '', 'R3 « Reçu ✓ » seulement fait');

  // R4
  const tout = P.etatParcours(preuves({ configuration: { etat: 'fait' }, extension: { etat: 'fait' }, emails: { etat: 'fait' }, vinted: v12, premiere: pv }), { maintenant: T0 });
  dit(tout.fini && P.etapeAMontrer(tout, 'emails') === 'pret', 'R4 tout fait ⇒ « C’est prêt »');
  const mi = P.etatParcours(preuves({ configuration: { etat: 'fait' }, extension: { etat: 'fait' } }), { maintenant: T0 });
  dit(P.etapeAMontrer(mi, 'emails') === 'emails' && P.etapeAMontrer(mi, 'extension') === 'emails' && P.etapeAMontrer(mi, null) === 'emails', 'R4 reprise : l’étape rangée si pas faite, sinon la suivante');
  const miV = P.etatParcours(preuves({ configuration: { etat: 'fait' }, extension: { etat: 'fait' } }), { maintenant: T0 });
  dit(P.etapeAMontrer(miV, 'vinted') === 'vinted', 'R4 reprise exacte : on revient sur Vinted, même si les e-mails restent', P.etapeAMontrer(miV, 'vinted'));
  dit(P.ecritureParcours({ v: 1, etape: 'emails', ouvert: true, fini: null }, { etape: 'emails' }) === null, 'R4 rien ne change ⇒ rien n’est écrit');
  const w = P.ecritureParcours(null, { etape: 'emails', ouvert: true }, 'T');
  dit(w && w.etape === 'emails' && w.ouvert === true && w.fini === null && w.at === 'T', 'R4 l’écriture porte étape, ouvert, fin, date', w);
  dit(P.lireParcours({ etape: 'n’importe', ouvert: 'oui' }).etape === null && P.lireParcours({ ouvert: 'oui' }).ouvert === false, 'R4 une position illisible n’ouvre rien');

  // R5
  const pt = { extension: new Date(T0 - 3600e3).toISOString() };
  const r5 = P.etatParcours(preuves({ configuration: { etat: 'fait' } }), { plusTard: pt, maintenant: T0 });
  dit(r5.courante === 'emails' && r5.etapes.find((e) => e.cle === 'vinted').reportee, 'R5 l’extension de côté met Vinted de côté, on passe aux e-mails', r5.courante);
  const r5b = P.etatParcours(preuves({ configuration: { etat: 'fait' } }), { plusTard: pt, maintenant: T0 + 8 * 86400000 });
  dit(r5b.courante === 'extension', 'R5 sept jours plus tard, l’étape revient');
  dit(P.suivanteApres(mi, 'extension', pt, T0) === 'emails' && P.suivanteApres(P.etatParcours(preuves({ configuration: { etat: 'fait' }, extension: { etat: 'fait' }, emails: { etat: 'fait' }, vinted: v12 }), { maintenant: T0 }), 'premiere', null, T0) === null, 'R5 « Plus tard » ⇒ la suivante, ou on ferme');

  // R6
  dit(P.carteParcours(tout, null) === 'cachee', 'R6 vendeur installé jamais ouvert : rien');
  dit(P.carteParcours(tout, { v: 1, etape: 'premiere', ouvert: false }) === 'pret' && P.carteParcours(tout, { v: 1, fini: 'T' }) === 'cachee', 'R6 « C’est prêt » une fois, puis rien');
  dit(P.carteParcours(neuf, null) === 'etape' && P.carteParcours(neuf, null, { exemple: true }) === 'cachee', 'R6 compte neuf : la carte ; mode exemple : rien');
  const passu = P.etatParcours(preuves({ configuration: { etat: 'fait' }, extension: { etat: 'fait' }, emails: { etat: 'fait' }, vinted: P.preuveVinted(C1, null), premiere: pv }), { maintenant: T0 });
  dit(!passu.fini && P.carteParcours(passu, { v: 1 }) !== 'pret', 'R6 « pas su » ne finit rien', etats(passu));

  // R7
  const app = fs.readFileSync(APP, 'utf8');
  dit(/\n  'vrm_parcours',\n/.test(app), 'R7 `vrm_parcours` est synchronisé (SYNC_KEYS)');
  const bloc = app.slice(app.indexOf('// ── LE PARCOURS D\'ARRIVÉE, BRANCHÉ'), app.indexOf('// ── « VÉRIFIER MON INSTALLATION »'));
  dit(bloc.length > 1000, 'R7 le bloc du parcours est trouvé');
  dit(/harvest_\*_listings&select=id,n:data->>nItems/.test(bloc) && /harvest_\*_orders_\*&select=id,n:data->>nItems/.test(bloc) && /email_reception_\*&select=id&limit=1/.test(bloc), 'R7 lectures scalaires (`nItems`, `select=id`)');
  const code = bloc.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');   // commentaires retirés (§6.4)
  dit(!/select=(id,)?data[&'`]/.test(code), 'R7 jamais `select=data`');
  dit(/extension: preuveExtensionParcours\(pont, comptes\)/.test(bloc) && /emails: preuveEmails\(emails\)/.test(bloc) && /vinted: preuveVinted\(comptes, annonces\)/.test(bloc) && /premiere: preuvePremiere\(commandes\)/.test(bloc), 'R7 chaque preuve reçoit une lecture');

  console.log(ko ? `\n❌ ${ko} contrôle(s) en échec` : '\n✅ parcours d’arrivée : tout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('KO  ' + (e && e.stack || e)); process.exit(1); });
